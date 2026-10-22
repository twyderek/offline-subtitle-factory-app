# 獨立審查報告：Whisper SIGSEGV signal fallback 可觀測性修正（BUG-WHISPER-METAL-139）

- 審查對象 commit／版本：`17df9788abf2cf964d52df10b74f9a8fcd7a45d6` 加目前未提交工作樹／0.51.0 開發中
- 對應 08-CHANGE-LOG 條目：2026-09-18 — Whisper SIGSEGV signal fallback 可觀測性修正（BUG-WHISPER-METAL-139）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-09-18T09:58:45+08:00（Asia/Taipei；本輪為獨立上下文，未沿用主要開發代理對話記憶；先執行 `npm run project:preflight -- --type=debug` 並閱讀其固定核心與任務路由要求）

## 1. 需求完整性

- 判定：通過。
- 證據：最新工作條目把本輪成功條件限定為 macOS arm64 首次 Metal 嘗試只對明確非零整數 exit 或非空 termination signal fallback，排除 exit 0、無有效失敗資訊、CPU retry 與非 macOS arm64，並要求區分 exit／signal log marker 及 parser 假陽性（`docs/project-management/08-CHANGE-LOG.md:3-19`）；關聯項目完整列出 `BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`、`NFR-005`、`NFR-006`（同檔 `:9`；`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:18-25`）。功能設計明定只 retry CPU 一次、CPU 再失敗維持 failed，且只有 failure marker 與 CPU marker 同時存在才視為 fallback（`docs/project-management/03-FUNCTIONAL-DESIGN.md:47-53`）。
- 證據：治理文件沒有把範圍擴張成真實 bundled crash→CPU fallback：目前狀態明載 bundled replay 正常走 Metal、`fallbackObserved=false`（`docs/project-management/00-CURRENT-STATUS.md:23-29,110`）；測試稽核及偵錯紀錄也明列 bundled crash fallback、CPU retry failure、取消、長音訊、中文品質與跨平台仍未驗收，LM Studio 依需求方決策未執行（`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:23-25`；`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:21-29`）。

## 2. 邏輯正確性

- 判定：通過。
- 證據：`isWhisperProcessFailure` 僅接受非零整數 exit 或 trim 後非空的字串 signal；`shouldRetryWhisperOnCpu` 再加上 `platform === 'darwin'`、`arch === 'arm64'`、`!forceCpu` gate（`lib/whisper-fallback-policy.mjs:1-20`）。因此 exit 0、`null` 無 signal、字串 exit、空白 signal、force CPU、其他平台／架構均不會 fallback。`describeWhisperProcessFailure` 產生 `exit <code>`／`signal <name>`，parser 的 exit regex 排除 0，並要求 failure marker 與 `CPU fallback` 同時存在才設定 `fallbackObserved=true`（同檔 `:9-35`）。
- 證據：`runWhisperCpp` 在 `close(code, signalName)` 先處理取消，再依上述 contract 判斷；第一次 Metal 失敗會刪除 `${outputBase}.srt`／`.json`、寫入原因 marker，並以 `forceCpu=true` 呼叫同一函式（`server.mjs:2047-2105,2140-2185`）。CPU 再失敗時 `!forceCpu` gate 為 false，直接 reject，不會遞迴；成功前仍須存在有效 SRT 並通過 sanitizer（同檔 `:2187-2205`）。
- 證據：全檔搜尋 `signalName` 只有 `server.mjs:2166,2174-2176` 四個、都在 `runWhisperCpp`；GPU probe、Breeze、Python Whisper 的 close handlers 仍分別是 `child.on('close', (code) => ...)`（`server.mjs:1349,1843,2010`），未殘留錯位修改。

## 3. 邊界情況

- 判定：通過（未執行的實機邊界列入剩餘風險）。
- 證據：既有 policy 測試直接覆蓋 exit 1、exit 139、`code=null/signal=SIGSEGV`、exit 0、null 無 signal、字串 exit、`NaN`、forceCpu、Windows x64、macOS x64，以及 exit／signal marker 與缺 CPU marker／exit 0 假陽性（`scripts/test-whisper-fallback-policy.mjs:1-42`）。本審查另於 2026-09-18T09:56:35+08:00 執行額外矩陣，確認字串 `'1'`、空白 signal、Linux arm64 signal、macOS x64 signal、forceCpu exit 1、只有 failure marker、只有 CPU marker及 exit 0＋CPU marker均為 false，`SIGSEGV`＋CPU marker為 true；指令 exit 0。
- 證據：fixture 的 signal 案在首次非 `--no-gpu` 執行先寫 partial SRT／JSON，再對自身送出真實 `SIGSEGV`；CPU retry 若仍看到 partial 會留下 stale marker（`scripts/fixtures/mock-whisper-cpp-runtime.mjs:17-48`）。核心整合同時斷言 exit 139 與 SIGSEGV 案的 `completed`／`ready-review`、`whisperDevice=cpu`、對應 log marker、draft 內容與 stale marker 不存在（`scripts/test-core.mjs:646-687`）。
- 證據：CPU retry failure 尚無 child-process integration fixture，但不可遞迴由同一次呼叫的 `forceCpu=true` 與 policy 的 `!forceCpu` gate 共同保證，且 unit matrix同時覆蓋 forceCpu 下 exit 與 signal（`server.mjs:2174-2184`；`scripts/test-whisper-fallback-policy.mjs:10-12`）。取消恰發生於 retry 交界、真實 bundled crash、其他 macOS 架構與 Windows 未由本輪動態驗證。

## 4. 程式碼品質

- 判定：通過。
- 證據：process failure 判定、可讀原因與 log parser 集中於單一小型模組，server 與真實 probe 共用同一 parser／contract，避免再由 probe 硬編碼 exit 139（`lib/whisper-fallback-policy.mjs:1-36`；`server.mjs:13,2166-2185`；`scripts/verify-whisper-real-fallback.mjs:1-12,194-237`）。probe 在啟動及寫入前拒絕覆寫既有 evidence，最後以 `flag: 'wx'` 寫入，且使用隔離暫存資料、loopback、production mode、停用 test runner 語意與本機生成 WAV（`scripts/verify-whisper-real-fallback.mjs:9-16,116-164,246-258`）。
- 證據：第一次核心重播確曾因 callback patch 錯位，使真正 Whisper.cpp handler 引用未定義 `signalName` 且一般 mock 任務停在 running；第二次重現後才加入 timeout 診斷並精確回復非目標 handlers。這段失敗沒有被刪除，保存在 `docs/project-management/08-CHANGE-LOG.md:17-19`；目前 `waitForJob` timeout 會輸出最後狀態與 server 尾端輸出（`scripts/test-core.mjs:184-195`），而 source 搜尋確認錯位修改已清除。歷史兩次卡住的原始 console 未另存入本輪 JSON evidence，故只能由工作紀錄回溯，不把它表述為本審查重新重現的結果。

## 5. 測試覆蓋

- 判定：通過（限定本輪修正；未覆蓋項已揭露）。
- 證據：2026-09-18T09:56:35+08:00 執行六個相關檔案的 `node --check`、`node scripts/test-whisper-fallback-policy.mjs` 與獨立 edge matrix，全部 exit 0。2026-09-18T09:56:40+08:00 在預設 sandbox 執行 `node scripts/test-core.mjs`，listener 建立即因 `listen EPERM 0.0.0.0:22190` exit 1，未進入產品斷言；改以一般本機權限於 09:56:53 開始、09:57:05 結束，核心整合 exit 0。
- 證據：2026-09-18T09:57:18+08:00 至 09:57:34+08:00，以同一一般本機權限執行完整 `npm run check`，`docs:check`、語法、全部 module／UI／core tests 均 exit 0；輸出明列 fallback policy 及核心回歸通過。`git diff --check` 亦 exit 0。sandbox EPERM 與成功的升級權限結果已分開記錄，沒有把環境失敗隱去。
- 證據：保存 evidence 的 policy／core／controlled／bundled 結果與程式及文件一致（`docs/project-management/evidence/2026-09-18-whisper-signal-aware-fallback.json:13-97`）。該 evidence 明確把 CPU retry failure 列為 not validated（同檔 `:86-95`），沒有由 unit／source 證明擴張成動態 integration 已完成。
- 證據：建立本報告後於 2026-09-18T10:00:33+08:00 重跑 `npm run docs:check`、`git diff --check` 及六節結構計數均 exit 0；10:00:41 執行 `npm run docs:check:final` exit 1，僅回報最新 `08-CHANGE-LOG` 條目仍缺「獨立審查是否執行」、「發布授權」且狀態尚非完成。這是主要代理尚未連結本報告及結案的預期治理狀態，本審查依只允許寫入本報告的限制未修改 `08-CHANGE-LOG.md`，故不把 final docs gate 誤記為已通過。

## 6. 實際運行結果

- 判定：通過（限定 controlled fallback 與 bundled 正常 Metal replay 的各自範圍）。
- 證據：本審查於 2026-09-18T09:58:02+08:00 至 09:58:07+08:00 獨立重跑兩個 acceptance probe，輸出只暫存於 `/private/tmp/osf-review-whisper-production-83319.json` 與 `/private/tmp/osf-review-whisper-bundled-83319.json`，讀取摘要後已刪除，未建立或覆寫專案 acceptance evidence。controlled production probe exit 0：`completed`／`ready-review`、`whisperDevice=cpu`、exit 139 與 CPU fallback marker 皆為 true，draft／SRT／JSON 完整、stale partial 為 false、暫存 WAV 已清理；該結果是 deterministic wrapper，不是 bundled runtime。
- 證據：同次 bundled production probe exit 0，實際 runtime／model SHA-256 分別為 `6167fe4817a85cb011cbb58abf53f80a9e9488be26b99348e9ff6f655edc7a08`、`be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21`；任務以 `whisperDevice=metal` 完成 `ready-review`，輸出完整且 `metalFailure=false`、`cpuFallback=false`、`fallbackObserved=false`。這與保存 evidence 的 `bundledRuntimeUsed=false` controlled 區塊及 `realBundledCrashToCpuFallbackObserved=false` bundled 區塊一致（`docs/project-management/evidence/2026-09-18-whisper-signal-aware-fallback.json:54-87`）。
- 證據：兩個 probe 均記錄 `externalNetwork=false`、`userSubtitleModified=false`、`lmStudio=not-run-by-explicit-scope-exception`；保存 evidence 另明列 `lmStudioExecuted=false`（同檔 `:5-11`）。因此本輪沒有執行 LM Studio，也沒有宣稱 bundled server 真實 crash→CPU fallback 已完成。

## 綜合判定

- 結論：通過。
- 可逐字引用的完整結論句：**本輪「2026-09-18 — Whisper SIGSEGV signal fallback 可觀測性修正（BUG-WHISPER-METAL-139）」round1 獨立審查通過：macOS arm64 首次 Metal 嘗試的非零整數 exit／非空 termination signal 契約、`Metal exit <code>`／`Metal signal <name>` 可觀測 marker、partial SRT／JSON 清理與單次 `--no-gpu` CPU retry、exit 139／真實自我 SIGSEGV 核心整合、parser 假陽性防護及完整回歸均經獨立核對通過；controlled wrapper 與 bundled runtime 證據已正確分離，bundled replay 本次正常走 Metal且 `fallbackObserved=false`，故本結論不宣稱真實 bundled server crash→CPU fallback、CPU retry failure、取消競態、長音訊、中文品質、其他 macOS 架構、Windows、乾淨安裝或發布已完成，LM Studio 亦依需求方決策未執行。**
- 阻擋問題（若有）：無。
- 剩餘風險：真實 bundled production server 尚未在同一次 run 觀察 crash→CPU fallback；CPU retry failure 與 retry 交界取消只有 policy／source 保證，尚無 child-process integration；長音訊、中文品質、其他 macOS 架構、Windows、乾淨安裝與發布仍未驗收。歷史錯位 patch 的兩次 running 卡住由 change log 如實保存，但沒有獨立 raw console artifact。
- 給主要開發代理的具體修正要求（若有）：本輪無產品阻擋修正；結案時應把本報告連結與上述完整結論句逐字寫回 `08-CHANGE-LOG.md`，補齊「獨立審查是否執行」與「發布授權」欄位、將狀態改為完成後重跑 `npm run docs:check:final`。若後續要關閉更廣的 runtime 門檻，需另取得同一次 bundled production server crash→CPU fallback evidence，並補 CPU retry failure／取消競態 integration，不得以本輪 controlled wrapper 結果替代。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
