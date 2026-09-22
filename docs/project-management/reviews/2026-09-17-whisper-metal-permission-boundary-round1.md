# 獨立審查報告：Whisper Metal 139 執行權限邊界釐清

- 審查對象 commit／版本：`17df9788abf2cf964d52df10b74f9a8fcd7a45d6`／0.51.0 開發中；目前工作樹另有既有未提交修改，本報告只審查本輪指定 evidence、治理文件、Whisper fallback source、fixture 與驗證宣稱。
- 對應 08-CHANGE-LOG 條目：2026-09-17 — Whisper Metal 139 執行權限邊界釐清（BUG-WHISPER-METAL-139），`docs/project-management/08-CHANGE-LOG.md:3-18`
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-09-17T15:25:09+08:00（首個留存驗證指令）；先執行 `npm run project:preflight -- --type=full`，讀取治理核心、full 任務路由、指定 evidence、需求／設計／歷史／稽核／偵錯文件與最新工作條目。本報告為獨立審查上下文，未沿用主要開發代理的評價性結論。

## 1. 需求完整性

- 判定：部分通過。
- 證據：需求原文將 `FR-003` 定義為不需 Python、封裝 runtime 可驗證且輸出可校閱，`FR-020` 要求 engine confidence／no-speech 或可重現 `rule-score` fallback，`FR-022` 要求 Tiny／Base／Small、共用 SRT／JSON 品質 metadata、取消與平台 fallback；`NFR-005`／`NFR-006` 分別要求可靠狀態與每次變更可追溯、測試、文件檢查及獨立審查（`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:19,36,38,60-61`）。
- `BUG-WHISPER-METAL-139` 本輪工作條目把成功條件限定為同一 bundled CLI／Tiny／正規化 WAV／flags 的 sandbox 與升級權限 direct 對照，以及 production server replay，並明確排除品質、長音訊、取消中的 retry、跨平台、乾淨安裝、LM Studio 與正式發布（`docs/project-management/08-CHANGE-LOG.md:9-16`）。這個範圍拆分完整且沒有把未驗收項目混入成功條件。
- 逐項判定：
  - `BUG-WHISPER-METAL-139`：本輪的「sandbox 139 是否為產品 runtime failure」問題已具體化並有對照 evidence；但真實 bundled server crash→CPU fallback 仍未達成。
  - `FR-003`：目前 macOS arm64、Tiny、1 秒靜音的 bundled path 可驗證且 server 可到 `ready-review`；不代表完整離線轉錄品質或所有支援平台。
  - `FR-020`：文件與程式保持「缺少 engine 指標時使用 rule-score、不偽造 confidence」的契約（`docs/project-management/03-FUNCTIONAL-DESIGN.md:105-111`），但本輪 evidence 沒有證明有可用的 segment-level confidence／no-speech，且 Metal crash 沒有 cue 可供評分。
  - `FR-022`：本輪只實跑 Tiny；三模型參數／缺檔契約由既有 deterministic 測試覆蓋，Base／Small 真實 runtime、長音訊與跨平台未由本輪 evidence 覆蓋。
  - `NFR-005`：deterministic child-process fixture 證明 partial 清理與 CPU retry 控制流；同一次真實 bundled server run 沒有發生 fallback，故只能部分通過。
  - `NFR-006`：證據、需求 ID、source 與測試可追溯，但目前最新 changelog 仍是「進行中」，尚未有本報告連結／獨立審查欄位；本輪 `docs:check:final` 也因此失敗，不能宣稱治理結案。

## 2. 邏輯正確性

- 判定：通過（限「執行邊界釐清」與「不誤宣稱 fallback」）；完整 defect closure 部分通過。
- 證據：指定 evidence 對兩次 direct replay 固定相同的 bundled CLI、Tiny、shared flags 與輸入環境（`docs/project-management/evidence/2026-09-17-whisper-metal-permission-boundary.json:5-17`），sandbox 結果是 `SIGSEGV`／無 SRT／JSON，而升級權限結果是 exit 0／SRT／JSON（同檔 `:19-36`）。我在 2026-09-17T15:26:28+08:00 至 15:26:29+08:00 以相同產品 flags 重新執行，得到 exit 139、`srt=false`、`json=false`；2026-09-17T15:26:44+08:00 至 15:26:47+08:00 在升級權限下重新執行同一命令，得到 exit 0、`srt=true`、`json=true`，stderr 具體出現 Apple M3 Metal initialization 與 `ggml_metal_free`。
- 因此 evidence 將 139 限定為本次 sandbox replay 的 execution-boundary artifact 是合理的（`...permission-boundary.json:58-62`），但這只能支持「此主機／此資產／此輸入的兩個邊界結果不同」，不能推廣為所有 sandbox 或所有 macOS 的普遍根因。
- 產品 fallback 邏輯與「未觀察到 crash 不得宣稱 fallback」一致：`runWhisperCpp` 在 child 非零退出時依平台／架構／`forceCpu` 決定是否刪除 `.srt`／`.json`、記錄 `Metal exit`／`CPU fallback` 並以 `forceCpu=true` 重試（`server.mjs:2166-2184`；`lib/whisper-fallback-policy.mjs:1-3`）。指定 production evidence 卻明確是 `completed`／`ready-review`、`whisperDevice=metal`、`fallbackObserved=false`（`...permission-boundary.json:39-55`），所以「server 正常 Metal smoke」與「真實 crash→CPU fallback」沒有被邏輯上混為一談。
- deterministic production wrapper 的結果也有正確隔離：它在 production server 中受控製造 exit 139，但 evidence 明確標示 `bundledRuntimeUsed=false`；文件因此只稱為 production-mode fallback control flow，不稱為 bundled runtime 實機 fallback（`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:52-58`；`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:38-45`）。

## 3. 邊界情況

- 判定：部分通過。
- 證據：已實際覆蓋的邊界：
  - default sandbox 與 `require_escalated` local process 的同條件 direct Metal 對照；實際命令與時間戳見第 2 節，保存結果見 `docs/project-management/evidence/2026-09-17-whisper-metal-permission-boundary.json:19-37`。
  - production server 為 `NODE_ENV=production`、test runners disabled，任務 `completed`／`ready-review`，SRT／JSON 存在、暫存 WAV 清理且 stale partial 清單為空（同 evidence `:39-56`）。
  - deterministic fixture 的首次 partial SRT／JSON、exit 139、CPU `--no-gpu` retry 與 stale marker 反證由 `scripts/fixtures/mock-whisper-cpp-runtime.mjs:17-45` 及 `scripts/test-core.mjs:644-663` 覆蓋。
- 未覆蓋且 evidence 如實列出：中文語音品質、長音訊、取消中的 retry、CPU retry 失敗、其他 macOS 架構、Windows、乾淨安裝（`...permission-boundary.json:64-76`）。這些未驗收風險沒有被 `ready-review` 或升級權限 Metal success 掩蓋。
- LM Studio 也如實揭露為未執行：evidence `lmStudioExecuted=false`（同檔 `:64-67`），目前狀態與需求文件說明是需求方已告知服務刪除的範圍例外，不移除 provider，也不把 FR-021 整體標為完成（`docs/project-management/00-CURRENT-STATUS.md:28-29`；`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:44-46`）。`networkCalls=false`／loopback probe 不等於作業系統層級真正斷網驗收，文件亦未作此宣稱。
- 一項尚未覆蓋的程式邊界需保留為風險：`shouldRetryWhisperOnCpu()` 對 macOS arm64 的任何 `exitCode !== 0` 都回傳 true，而不是只接受 139 或確認 Metal stderr（`lib/whisper-fallback-policy.mjs:1-3`）。既有文件把策略稱為 Metal 非零退出，現有測試主要驗證 139；若未來需區分一般 CLI／訊號／Metal allocation failure，應補更窄的錯誤分類測試。這不否定本輪 evidence 的邊界判定，但不宜將現有 policy 描述成「只對 SIGSEGV 139 fallback」。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：production verifier 在 `NODE_ENV=production` 時沒有注入 test runner；server 只有 `NODE_ENV === 'test'` 才讀取 `OFFLINE_SUBTITLE_TEST_WHISPER_CPP_RUNNER`（`server.mjs:49-51`）。實際 bundled child process 使用 `shell:false`、明確 runtime／model／output args，非零退出的 partial 清理與 retry 路徑位於 `server.mjs:2095-2105,2174-2183`。模型與 runtime 也由 `inspectWhisperModelWithCache` 驗證後才執行（`server.mjs:2047-2055`）。
- evidence 品質良好：保存 schema／UTC `generatedAt`、平台／架構、runtime／model SHA、執行邊界、exit／signal、輸出布林、server 狀態、fallback flag、範圍與暫存清理（`docs/project-management/evidence/2026-09-17-whisper-metal-permission-boundary.json:2-17,19-78`）。我於 2026-09-17T15:27:03+08:00 以 `shasum -a 256 tools/whisper-cpp/whisper-cli tools/whisper-models/ggml-tiny.bin` 重算，結果分別為 `6167fe4817a85cb011cbb58abf53f80a9e9488be26b99348e9ff6f655edc7a08` 與 `be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21`，與 evidence `:12-17` 一致。
- 文件品質一致：`00-CURRENT-STATUS.md` 明確寫 sandbox 139 不可當產品 failure、server `fallbackObserved=false` 且不宣稱真實 fallback（`:23-29`）；`04-DEVELOPMENT-HISTORY.md:28`、`06-TEST-AND-PROCESS-AUDIT.md:18-25`、`07-DEBUG-AND-FIX-HISTORY.md:47-54` 均保留同一界線。
- 文件流程仍有可結案缺口：最新 changelog 的 `狀態：進行中`、尚未寫入本輪審查欄位（`docs/project-management/08-CHANGE-LOG.md:3-18`）與 `npm run docs:check:final` 的實際失敗相符。這是本輪報告之外的主要代理結案工作，不能由本報告代替。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：本審查實際執行並通過（2026-09-17T15:25:09+08:00）：`node --check server.mjs`、`node --check lib/whisper-fallback-policy.mjs`、`node --check lib/whisper-models.mjs`、`node --check scripts/fixtures/mock-whisper-cpp-runtime.mjs`、`node --check scripts/verify-whisper-real-fallback.mjs`、`node --check scripts/verify-whisper-production-fallback.mjs`、`node scripts/test-whisper-fallback-policy.mjs`、`node scripts/test-whisper-quality.mjs`，全部 exit 0。
- 2026-09-17T15:25:13+08:00 執行 `npm run runtime:verify:mac`，回報 `[runtime] OK: darwin-arm64`，並列出 bundled FFmpeg、Whisper.cpp 與 Tiny 路徑，exit 0。
- reviewer 自己在受限 sandbox 執行完整 `npm run check`（2026-09-17T15:25:19+08:00 至 15:25:22+08:00）：`docs:check` 與前段 Whisper／Breeze／治理／AI／UI 測試均通過，但 `test-core.mjs` 建立 `0.0.0.0:22343` listener 時收到 `Error: listen EPERM: operation not permitted`，整體 exit 1。這是審查環境權限限制，非 assertion 失敗。
- 同一完整 `npm run check` 於受核准的 `require_escalated` local process 執行（2026-09-17T15:25:35+08:00 至 15:25:50+08:00）exit 0；核心回歸最後回報「核心回歸測試通過」。這個升級權限結果與上述 sandbox 失敗分開保存，不把主要代理的升級權限結果改寫成 sandbox 通過。
- `git diff --check` 於 2026-09-17T15:27:45+08:00 exit 0。`npm run docs:check:final` 於 2026-09-17T15:25:55+08:00 exit 1，validator 明確指出最新工作紀錄缺少「獨立審查是否執行」「發布授權」、尚未標示「完成」且審查欄位不得缺失；本輪遵守使用者限制，未修改 changelog。
- 覆蓋缺口仍包括：完整 bundled server 的真實 Metal crash→CPU fallback、CPU retry 再失敗、retry 交界取消／timeout、長音訊、真實中文品質、其他 macOS／Windows／乾淨安裝與 LM Studio；本輪也未重跑會新增或覆寫 evidence 的 production probe，避免建立第二份 evidence 或碰觸既有檔案。deterministic fallback 測試只證明 server 控制流，對應 `scripts/test-core.mjs:644-663` 與 `docs/project-management/evidence/2026-09-17-whisper-production-fallback.json:11-24,33-64`。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：reviewer 的 direct Metal 實測：
  - 2026-09-17T15:26:28+08:00 開始、15:26:29+08:00 結束，在 default sandbox 執行 `tools/whisper-cpp/whisper-cli -m tools/whisper-models/ggml-tiny.bin -f <generated 1-second 16 kHz mono silence WAV> -l zh -osrt -oj -ojf -of <temp>/out -t 2`；stderr 為 `ggml_metal_buffer_init: error: failed to allocate buffer, size = 2.20 MiB`，exit 139，SRT／JSON 均 false。
  - 2026-09-17T15:26:44+08:00 開始、15:26:47+08:00 結束，在 `require_escalated` local process 執行完全相同 CLI／model／input／flags；stderr 顯示 Apple M3 Metal backend 啟用、輸出 SRT／JSON，exit 0，SRT／JSON 均 true。
- 指定 production server replay 的保存結果（evidence `:39-56`）為 `require_escalated local production-mode server`、probe exit 0、`testRunnersDisabled=true`、`completed`／`ready-review`、`asrEngine=whisper.cpp`、`whisperDevice=metal`、draft／SRT／JSON true、`temporaryWavCleaned=true`、`stalePartialArtifacts=[]`；但 `fallbackObserved=false`（`:42-55`）。因此這是 server bundled Metal 正常 path 的實際成功，不是 crash→CPU fallback 的實際成功。
- evidence 的結論欄位直接且正確：`sandbox139IsProductRuntimeFailure=false`、`bundledMetalWorksOutsideSandbox=true`、`realBundledServerCrashToCpuFallbackObserved=false`，並明說不關閉真實 bundled crash-to-CPU fallback gate（`...permission-boundary.json:58-62`）。這回答本輪核心問題：sandbox 139 被正確限制為執行環境差異；沒有錯誤宣稱真實 bundled server crash→CPU fallback 已完成。
- 品質邊界也如實：目前 CPU JSON 缺少 segment-level confidence／no-speech，狀態文件因此維持 rule-score fallback 說明（`docs/project-management/00-CURRENT-STATUS.md:24`；`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:35-42`）。1 秒靜音輸出的可完成性不應推廣為中文語音品質，evidence 也將該項列為未驗收。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪 BUG-WHISPER-METAL-139 Whisper Metal 139 執行權限邊界釐清 round1 獨立審查有條件通過：同一 macOS arm64 bundled whisper-cli／Tiny、同一 1 秒 16 kHz mono silence WAV 與產品 flags 在 default sandbox direct replay 實際 SIGSEGV／exit 139 且無 SRT／JSON，在 `require_escalated` local process 實際 exit 0 且 Metal 產生 SRT／JSON；production-mode bundled server replay 亦完成 `ready-review`、`whisperDevice=metal`、輸出與暫存清理，但 `fallbackObserved=false`，所以 sandbox 139 已正確限縮為執行邊界差異，真實 bundled server crash→CPU fallback 尚未完成，deterministic wrapper／fixture 不得冒充該實機驗收。**
- 阻擋問題（若有）：
  - 若目標是本輪「權限邊界釐清」，沒有發現會推翻 evidence 判定的產品阻擋問題。
  - 若目標是關閉 `BUG-WHISPER-METAL-139` 的真實 bundled server fallback gate，仍有阻擋：指定 production run 沒有觀察到 bundled `Metal exit 139`／`CPU fallback`，只能維持未完成。
  - 治理結案仍有流程阻擋：`npm run docs:check:final` 在本輪實際 exit 1；主要代理必須在後續工作中補 changelog 的審查欄位、連結本報告並逐字引用本報告結論，將工作狀態與結案欄位同步後重跑 final gate。本輪依使用者要求未修改該檔案。
- 剩餘風險：中文語音品質、長音訊、取消中的 retry、CPU retry 失敗、其他 macOS 架構、Windows、乾淨安裝與真正 bundled server fallback 仍未驗收；CPU quality metadata 缺失時仍依 `rule-score` 安全回落。LM Studio 因需求方已刪除而未執行，這是已揭露的範圍例外，不是驗收通過；真正斷網、FR-021 完整條件與跨平台實機仍不可宣稱完成（`docs/project-management/evidence/2026-09-17-whisper-metal-permission-boundary.json:64-78`；`docs/project-management/00-CURRENT-STATUS.md:28-29`）。
- 給主要開發代理的具體修正要求（若有）：
  1. 保留本報告與既有 evidence，不覆寫；在後續 changelog 更新中只連結本報告並逐字引用上方完整結論句，補齊 `狀態：完成`、`獨立審查是否執行：是`、非發布工作的 `發布授權：不適用` 與 final gate 所需欄位後重跑 `npm run docs:check:final`。
  2. 若要關閉真實 fallback 門檻，須在同一次 `NODE_ENV=production` server run 使用實際 bundled `whisper-cli` 重現 exit 139，並保存 `Metal exit 139`／`CPU fallback`、最終 `whisperDevice=cpu`、輸出完整與暫存清理 evidence；不可用 sandbox 139、direct CLI 對照或 deterministic wrapper 代替。
  3. 後續可補一組區分「任意非零退出」與「Metal 139」的 policy／server 測試，避免文件將目前 `exitCode !== 0` 行為描述得過窄。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪未覆寫或刪除既有報告／evidence，未啟動 LM Studio，未呼叫外部服務，未執行會寫入 acceptance evidence 的 production probe；受限 sandbox 的 `npm run check` 失敗與升級權限的 exit 0 結果已分開記錄。
- 若上述聲明不實，本報告無效。
