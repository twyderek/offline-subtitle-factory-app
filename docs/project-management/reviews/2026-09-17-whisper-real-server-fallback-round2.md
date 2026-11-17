# 獨立審查報告：產品 server 真實 Whisper Metal→CPU fallback 驗收

- 審查對象 commit／版本：目前工作樹／0.51.0 開發中；工作樹另有既有修改，以下只審查本條目、round1 指出的三項 probe 修正、Whisper fallback source、deterministic tests 與指定 evidence。
- 對應 08-CHANGE-LOG 條目：2026-09-17 — 產品 server 真實 Whisper Metal→CPU fallback 驗收（BUG-WHISPER-METAL-139）
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-09-17 11:06:21 +0800 開始 focused verification；以 `npm run project:preflight -- --type=full` 開始，讀取治理核心、full 任務路由、round1 報告及使用者指定程式／evidence。本報告為獨立審查上下文，未沿用主要開發代理的評價性結論。

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-22` 將本輪成功條件分成 production-mode bundled Whisper.cpp 正常 Metal path，以及只有同一次 server run 觀察到 `Metal exit 139`／`CPU fallback` 時才追加 CPU 斷言；同段明列不在範圍的中文品質、長音訊、取消中的 retry、其他架構、Windows、乾淨安裝、發布與 LM Studio。`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:19,36,38` 對應 FR-003、FR-020、FR-022；`docs/project-management/03-FUNCTIONAL-DESIGN.md:51` 要求 Whisper.cpp 共用取消與 Metal→CPU fallback 契約。`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:35-41` 與 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:29-36` 的治理紀錄與指定 evidence 一致。
- `docs/project-management/evidence/2026-09-17-whisper-real-server-fallback.json:25-68` 實際記錄 production、loopback-only、test runners disabled、任務 `completed`／`ready-review`、Metal metrics、輸出與清理；同一 evidence 的 `fallbackObserved=false`（`:61`）表示真實 server crash→CPU fallback 目標仍未完成。round1 指出的三項 probe 修正則已在目前 source 中具體存在，故本輪對修正版給有條件評價，不把未發生的 fallback 寫成通過。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - 實際 port：`scripts/verify-whisper-real-fallback.mjs:60-69` 每次 server readiness polling 從 `dataDir/offline-subtitle-port.tmp` 讀取合法 port，並同步更新 `actualPort`／`apiBaseUrl`／evidence。該 probe 在 `:139-157` 將 `TMP`、`TEMP`、`TMPDIR` 全部明確指向同一個新建 `dataDir`；server 在 `server.mjs:4742-4751` 從 `process.env.TEMP` 寫入同名 port 檔後才 listen，因此在本 probe 中等價於從 `$TMP/offline-subtitle-port.tmp` 取得 server 回報的實際 port。指定 evidence `:25-30` 的 `requestedPort=24535`、`actualPort=24535` 與我重新計算的檔案狀態一致。
  - stale partial output：`scripts/verify-whisper-real-fallback.mjs:189-192` 實際讀取工作目錄並掃描 `whisper-cpp-stale-partial-output` 及 `.srt`／`.json` 的 `.partial`／`.tmp`／`.download` 變體；`:213-226` 將掃描清單寫入 evidence 並以清單長度為完成斷言，不再固定填值。指定 evidence `:53-60` 的 `stalePartialOutput=false` 與 `stalePartialArtifacts=[]` 是該掃描結果。
  - evidence 寫入失敗清理：`scripts/verify-whisper-real-fallback.mjs:245-257` 先停止 server，再在寫 evidence 的內層 `try` 後以 `finally` 執行 `fs.rmSync(dataDir, { recursive: true, force: true })`；因此 `mkdir`／拒絕覆寫／`wx` 寫入失敗仍會進入暫存清理。這是 source 靜態驗證；本輪沒有故意注入 evidence 寫入錯誤。
  - production fallback source：`server.mjs:2174-2183` 在 child 非零退出時，macOS arm64 policy 通過即刪除 `.srt`／`.json`、寫入 `Metal exit … CPU fallback`，再以 `forceCpu=true` 重跑；`scripts/test-core.mjs:644-663` 的 deterministic case 實際斷言 exit 139、CPU、`ready-review`、partial marker 清除與 draft。這證明控制流，但指定 production evidence 沒有觸發該分支。

## 3. 邊界情況

- 判定：部分通過
- 證據：本輪實際執行 `node --check scripts/verify-whisper-real-fallback.mjs`、`server.mjs`、`scripts/test-core.mjs` 與 fixture，均 exit 0；`node scripts/test-whisper-fallback-policy.mjs` 通過平台／架構／`forceCpu`／退出碼矩陣；`node scripts/test-whisper-quality.mjs` 通過缺失與不一致 quality metadata 回落。完整 `npm run check` 亦包含核心的 macOS arm64 fixture、取消與 partial output 清理案例。
- 目前 probe source 已有非 macOS arm64／缺 runtime／缺模型／不可執行 runtime 的拒絕條件（`scripts/verify-whisper-real-fallback.mjs:129-135`）、既有 evidence 不覆寫（`:10-11,249-252`）、port 合法範圍檢查（`:63-68`）、輸出存在／非空、輸入保存與 `whisper-input.wav` 清理斷言（`:193-228`）。
- 指定 production evidence 的 input 是生成 1 秒、16 kHz、mono 靜音 WAV，並標示 `userMediaRead=false`（`evidence/...json:18-23`）；它不覆蓋真實語音、長音訊、CPU retry 失敗、取消競態、其他架構、Windows 或乾淨安裝。round1 指出的 port collision、stale scan 與寫入失敗三項 source 缺口已解除，但本輪沒有另行強制 port collision 或 evidence write fault。

## 4. 程式碼品質

- 判定：通過（限本輪修正）
- 證據：`package.json:13-24` 正確註冊 `acceptance:whisper:fallback`，並由 `check` 進入完整 `npm test`。probe 使用新建暫存資料目錄、SHA-256、明確 production env、無 test runner、loopback token 與 `shell` 未開啟的 child process（`scripts/verify-whisper-real-fallback.mjs:8-20,137-163`）；拒絕覆寫既有 evidence 且使用 `flag: 'wx'`。
- 三項修正均維持單一責任且可追溯：port refresh 只負責更新 API base URL（`:60-70`）；stale output 以工作目錄掃描結果形成 evidence（`:189-220`）；清理位於 evidence write 的 nested `finally`（`:245-257`）。`git diff --check` 於 2026-09-17 11:06 左右 exit 0。未發現因本輪修正而新增的 shell 注入、外部 endpoint 或秘密寫入路徑；probe 明確清空 AI key／keys JSON（`:152-154`）。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-09-17 11:06:21 +0800 起實際執行：
  - `node --check scripts/verify-whisper-real-fallback.mjs && node --check server.mjs && node --check scripts/test-core.mjs && node --check scripts/fixtures/mock-whisper-cpp-runtime.mjs`：exit 0。
  - `node scripts/test-whisper-fallback-policy.mjs`：exit 0，輸出「Whisper fallback 策略測試通過：平台、架構、forceCpu 與退出碼矩陣」。
  - `node scripts/test-whisper-quality.mjs`：exit 0，輸出「Whisper quality metadata 測試通過：JSON 解析、時間對應、缺失與不一致回落」。
  - `git diff --check`：exit 0。
  - 2026-09-17 11:06:32 +0800 起在正確專案目錄執行 `npm run check`：exit 0；`docs:check` 回報 19 個治理文件，完整 `npm test` 的 Whisper policy／model／download／SRT／quality、治理、AI、UI 與核心回歸均通過，末段回報「核心回歸測試通過」。
- 2026-09-17 11:08 左右執行 `npm run docs:check:final`：exit 1；validator 回報最新 `08-CHANGE-LOG.md` 尚未標示「完成」、仍有「待執行」，且「獨立審查是否執行」不是「是／否」。本輪依使用者限制未修改 changelog；這是結案文件尚未由主要代理回填的治理狀態，不是本輪 probe source 或 deterministic test 失敗。
- `scripts/fixtures/mock-whisper-cpp-runtime.mjs:19-28` 會在首次非 `--no-gpu` 執行回傳 139 並寫入 partial output，若 CPU retry 前未清理則寫出 stale marker；`scripts/test-core.mjs:644-663` 實際驗證該 marker 不存在、CPU metrics、`ready-review` 與 draft。這是 deterministic fixture 覆蓋，不是 production bundled runtime 覆蓋。未執行 port collision、evidence write failure fault injection，亦未在本輪重跑會新增 evidence 的 production acceptance probe。

## 6. 實際運行結果

- 判定：部分通過
- 證據：指定 evidence `docs/project-management/evidence/2026-09-17-whisper-real-server-fallback.json:6-16,25-68` 記錄 darwin／arm64、Node v22.22.3、bundled runtime／Tiny SHA-256；我在 2026-09-17 11:07:27 +0800 以 Node 重新讀取 evidence 並對實際 runtime／model 檔案重算 SHA，兩者均 `true`。evidence 的 production server `requestedPort=24535`／`actualPort=24535`、任務 `completed`／`ready-review`、`asrEngine=whisper.cpp`、`whisperDevice=metal`、draft／SRT／JSON 均為 true、quality metadata 為 false、stale 清單為空、`status=pass`。
- 同一 evidence `:42-61` 明確記錄 `metalExit139=false`、`cpuFallback=false`、`fallbackObserved=false`；因此本次 production-mode server bundled Metal path smoke 通過，但同一次 server run 沒有真實 crash→CPU fallback。`docs/project-management/evidence/2026-09-17-whisper-bundled-runtime-recheck.json` 與 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:26-33` 的 direct CLI 對照只記錄獨立 bundled CLI Metal exit 139／CPU `--no-gpu` 結果，`scripts/test-core.mjs:644-663` 則是 fixture；兩者均不可取代本次 server 的真實 fallback。
- 本輪未啟動 LM Studio、未呼叫外部服務、未重新執行會寫入 acceptance evidence 的 production probe；實際執行的完整回歸僅使用專案 deterministic 測試與其本機暫存／localhost 測試 server。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪產品 server 真實 bundled Whisper.cpp 驗收有條件通過：production-mode server 的 bundled Metal path smoke 已在 macOS arm64 以生成 1 秒靜音 WAV 完成至 `ready-review` 並產出 SRT／JSON、清理 Whisper 暫存 WAV；round1 指出的三項 probe 修正均已解除——probe 已從其明確綁定的 `$TMP/offline-subtitle-port.tmp` 讀取 server 實際 port、stale partial output 已由工作目錄實際掃描結果產生、evidence 寫入失敗時仍由 nested `finally` 清理暫存；但本次 evidence 的 `fallbackObserved=false`，所以真實 Metal crash→CPU fallback 仍未驗收完成；deterministic fixture 與 direct CLI 對照不可冒充實機 server fallback。**
- 阻擋問題（若有）：無（就 round1 指出的三項 probe 修正而言）；但真實 production server 同一次 run 尚未觀察到 `Metal exit 139`／`CPU fallback`，故 `BUG-WHISPER-METAL-139` 的真實 crash→CPU fallback 仍是未完成驗收門檻，不得將本輪條件通過擴張為完整 fallback 通過。
- 剩餘風險：真實 server fallback 尚未重現；1 秒靜音不代表中文語音品質、長音訊效能或記憶體行為。CPU JSON 缺少 segment-level confidence／no-speech，品質 metadata 仍可能缺失並依設計回到 `rule-score`；取消中的 retry、CPU retry 失敗、其他 macOS 架構、Windows、乾淨安裝、真實使用者媒體與正式發布仍未覆蓋。`externalNetwork=false` 僅表示本 probe 未配置外部 endpoint，不是作業系統層級斷網證明；LM Studio 依明確範圍未執行。
- 給主要開發代理的具體修正要求（若有）：三項 round1 probe 修正已解除，無新增程式修正要求；後續若要關閉 BUG-WHISPER-METAL-139，仍須在同一次 `NODE_ENV=production` bundled server run 取得可回溯的 `Metal exit 139`、`CPU fallback`、最終 `whisperDevice=cpu`、完整 SRT／JSON 與暫存清理證據，不得以 deterministic fixture 或 direct CLI 對照替代。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 附註：本輪未覆寫 round1、未刪除檔案、未啟動 LM Studio、未呼叫外部服務，亦未執行任何會寫入 acceptance evidence 的 production probe。
- 若上述聲明不實，本報告無效。
