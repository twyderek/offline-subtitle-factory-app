# 獨立審查報告：FR-021 current-source packaged UI normal-loopback 3B cancel-resume replay next stage

- 審查對象 commit／版本：`c06d15e95a2f0a0981518c5873003a460e57a5ee`、版本 `0.52.0`、branch `codex/0.51-anthropic-claude`；工作樹為 dirty，僅審查本輪指定範圍。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — current-source packaged UI normal-loopback 3B cancel-resume replay next stage（`FR-021-REPLAY-20261029-UI-NORMAL-3B-CANCEL-RESUME-NEXT1`）。
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-29 Asia/Taipei；獨立審查上下文，未沿用主要開發代理對話記憶；已讀 `AGENTS.md`、project-management README、00–09、全部 workflows、指定 evidence、相關 runner／測試與 git diff，並執行 `npm run project:preflight -- --type=full`。
- 審查範圍：macOS arm64 current packaged candidate、預裝 `llama3.2:3b`、normal loopback only 的 packaged UI cancel／checkpoint／reload／same-session resume／complete replay。
- 唯讀限制：未重播 live verifier、未啟動或停止 Ollama／Electron、未下載模型、未修改 OS network／sandbox／keychain／candidate／source／evidence；未發布。live replay evidence 已以 hash、權限、結構與 source／candidate parity 唯讀核對；本輪唯一建立的檔案為本報告。

## 1. 需求完整性

- 判定：部分通過
- 證據：

  - `02-REQUIREMENTS-ANALYSIS.md:26` 的 FR-010 要求批次、取消、續傳與 checkpoint 恢復；`:37` 的 FR-021 要求 Ollama loopback、本機不強制 API Key／雲端同意、不自動下載模型，且 `:48-60` 明確規定 `systemNetworkDisabled=false` 時不得宣稱 FR-021 overall 完成。
  - `03-FUNCTIONAL-DESIGN.md:171-179` 明定取消後 checkpoint／來源字幕保持、`OSF_OLLAMA_UI_SCENARIO=cancel-resume` 使用六段／batchSize 1、page reload、UI resume 與 Session／hash 證據；本輪 evidence `...2026-10-29-fr-021-ui-normal-3b-cancel-resume-next1.json:1-3,52-70` 的 scenario、平台、model、loopback scope 與該界線一致。
  - 工作紀錄 `08-CHANGE-LOG.md:3-20`、測試稽核 `06-TEST-AND-PROCESS-AUDIT.md:12-19`、偵錯歷程 `07-DEBUG-AND-FIX-HISTORY.md:3-8` 均把本輪限定為 normal-loopback lifecycle，沒有把它寫成 Seatbelt offline、全機 egress、signed／notarized、Windows 或 FR-021 overall。

本輪 bounded requirement 已覆蓋，但它不是 FR-021 全部驗收；LM Studio 也依 `02-REQUIREMENTS-ANALYSIS.md:48-54` 的現行範圍例外／政策不在本輪。

## 2. 邏輯正確性

- 判定：通過
- 證據：

  - runner 在 `scripts/verify-electron-ollama-ui.mjs:685-745` 只在 `running` 且 `0 < completedBatches < totalBatches` 時觸發 UI cancel，要求 terminal `cancelled`、`retryable`、部分批次，並直接讀取 checkpoint，核對 `nextBatchIndex` 與 suggestion count。
  - `scripts/verify-electron-ollama-ui.mjs:747-819` 以 page time-origin 變化確認 reload，核對 checkpoint／status／session 未變，攔截 resume POST 的 `resumedFromBatch`，最後要求 resume 從同一 checkpoint／同一 Session 完成。
  - server contract `server.mjs:689-709,789-858,4613-4634` 對 checkpoint 持久化、同一 `sessionId` 恢復、cancel 狀態／retryable 與 resume batch index 的語意一致。指定 evidence `:187-209` 實際記錄 `1/6` cancel checkpoint、persisted suggestion 1、reload 後 session／checkpoint unchanged、`resumedFromBatch=1`、6/6 completed。
  - evidence `:127-185` 記錄 job `201/202/completed`、6 cues／6 batches、6 suggestions、accept 6、undo／redo、`reviewed.srt`、cue count 6、timecodes unchanged 與 English translation；`:115-119` 記錄 original SRT before／after hash 一致。

未發現 runner 將 cancel window missed、failed 或錯誤模型結果誤寫成 pass 的路徑；若 checkpoint window missed，`scripts/verify-electron-ollama-ui.mjs:720-741` 會失敗而不進入成功 evidence。

## 3. 邊界情況

- 判定：部分通過
- 證據：

  - evidence `:62-70` 明確為 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`loopbackOnlyConfiguration=true`、`apiKeySupplied=false`、`isolatedAcceptanceDaemon=false`；因此本輪只證明既有桌面 Ollama 的 normal loopback，不能推導 process-tree／全機斷網或 Seatbelt 結果。
  - `scripts/verify-electron-ollama-ui.mjs:209-220,491-515,567-585` 對 renderer home、loopback endpoint、review navigation 與去敏 token 傳遞設有 bounded gate；token 只在記憶體中使用，`homeEvidence` 不保存 token。`scripts/test-ollama-ui-offline.mjs:305-345` 的 focused source regression 固定 exclusive 0600、token non-persistence、raw output exclusion、loopback target 與禁止 `--no-sandbox`。
  - evidence `:71-85` 的 Electron process group、server port、temporary userData 與 cleanup 均確認完成，forced cleanup 為 false；`:20-40` 的 argv／child-output provenance 僅保存去敏 argv、digest／bytes 與固定 diagnostic categories。
  - 成功 fixture 是六段極短中文句（`scripts/verify-electron-ollama-ui.mjs:39-53`），單次 macOS arm64／單一 3B model replay；未覆蓋長字幕、長 prompt、模型品質泛化、模型故障／timeout、app restart resume、其他硬體／版本或全機網路隔離。

normal run 的 `cleanup.ownedDaemon` 欄位在 `isolatedAcceptanceDaemon=false` 時是無 owned daemon 的 cleanup projection，不應解讀為本輪建立並獨立管理了 Ollama daemon；evidence 也沒有獨立保存 `modelDownloadAttempted=false` 的 normal-daemon 欄位。這是證據語意與可重現性限制，不足以推翻已完成的 UI lifecycle pass。

## 4. 程式碼品質

- 判定：通過
- 證據：

  - `scripts/verify-electron-ollama-ui.mjs:242-260,288-314` 在 spawn 前取得 candidate executable／review.js／Framework hash，並用 shared `projectRunnerProvenance` 投影 argv、sandbox flags、bounded child output 與 privacy boundary；`:920-958` 在 cleanup 後以 exclusive `wx`、owner-only `0600` 寫 evidence，cleanup 不完整會 fail-closed。
  - `scripts/test-ollama-ui-offline.mjs:337-355` 固定 token 僅記憶體傳遞、candidate／Framework provenance、raw child output 不落盤與 shared provenance projection；本輪沒有發現正式 runner 使用 `--no-sandbox`、`sandbox:false` 或等價 workaround。
  - 本審查重算 candidate executable、review.js、Electron Framework hash，均與 evidence `:4-9,31-35` 相符；另以 `cmp` 唯讀核對 candidate bundle 與目前工作樹的 `server.mjs`、`public/review.js`、`lib/ai/providers.mjs`、`lib/ai/subtitle-optimizer.mjs` 均 exit 0，支持本輪宣稱的 current-source packaged bytes 關聯。

目前沒有 source／candidate 行為不一致的技術 finding；但 evidence 本身未保存 source revision／commit、完整 candidate path、timeout／環境變數或可直接複製的完整 replay command，只能由 `06-TEST-AND-PROCESS-AUDIT.md:15`、`08-CHANGE-LOG.md:6-18` 與 candidate hash 共同重建 replay context，不能視為 standalone byte-level provenance。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：

  - 2026-10-29T12:38:50+08:00 本審查執行 `node --check scripts/verify-electron-ollama-ui.mjs`、`node scripts/test-ollama-ui-offline.mjs` 與 `git diff --check -- scripts/verify-electron-ollama-ui.mjs scripts/test-ollama-ui-offline.mjs lib/runner-provenance.mjs package.json`，全部 exit 0；focused test 實際通過 missing-model／no-download、bundle preflight 三案例與 normal／offline evidence contract。
  - 本審查執行結構化 evidence assertions：JSON schema／scenario／scope、1/6 checkpoint、persisted suggestion、reload／resume same session、6/6 completion、accept／undo／redo／save、timecode／original SRT invariant、cleanup、privacy、0600、evidence SHA-256 與 candidate artifact hash 均通過；evidence hash 重算為 `397983b2388083c64c161c7f0e3bf340be4c919bde1abcc7da532c661545e31c`。
  - 2026-10-29T12:39:11+08:00 起執行完整 `npm run check`，`docs:check`、全部 syntax checks、完整 `npm test` 與 YouTube posttest 均 exit 0；其中核心回歸、Ollama streaming multi-batch、review UI、治理 validator 均通過。
  - 本輪沒有重播 live verifier，因它會建立新的 evidence，而治理指示限定審查代理唯一寫入本報告；因此 live pass 依指定 immutable evidence 與上述唯讀 hash／scope／structure assertions 核對，未冒稱本審查代理重新執行 live replay。

測試足以支持本輪 bounded evidence 與 runner／server contract，但單一 live pass、短句 fixture 與同 session reload 不能替代 app restart、長內容、失敗／timeout、Seatbelt offline、Windows 或 FR-021 overall 測試。

## 6. 實際運行結果

- 判定：通過
- 證據：

  - 指定 evidence `:49-70` 記錄時間、darwin／arm64、Ollama、loopback base URL、local privacy、`llama3.2:3b`、normal scope 與 `status: pass`；`:121-185` 記錄 home／review、設定保存、local privacy／empty key、AI completion、accept／history／save。
  - `:187-209` 是本輪核心實測：cancel observed `cancelled`、retryable、completed `1/6`、checkpoint persisted、reload 後 session／checkpoint unchanged、resume accepted／from batch 1／same session；`:71-85` cleanup 全部完成。
  - 2026-10-29 唯讀重算 candidate executable hash `b3605c589459068f894a70896b8ed843be3832a839fcdd83aa898e9b16210de4`、review.js hash `ac25c6639a282eb5807c903fd0bded2419a39ce304428efeb137ac4a19a2b04b`、Framework hash `416b6c8cf74c59188266d3ff7a3fc77b9f68bb52f7328d98b382d132580c8cee`，均與 evidence 相符；evidence mode 為 `0600`。
  - 這是本機 normal loopback lifecycle evidence，不是 release／deployment evidence；沒有簽章、公證、Seatbelt offline、全機 egress、Windows 或 LM Studio 實測結果可供本輪通過。

## 綜合判定

- 判定：有條件通過
- findings：
  - F-01（P1，治理 closeout blocker）：`08-CHANGE-LOG.md:3` 仍為「狀態：進行中」，`:20` 的開發驗證仍寫「獨立六面向審查與 final docs gate 尚待完成」，且最新條目尚無本 round1 報告路徑、逐字引用、`獨立審查是否執行` 與 `發布授權` 欄位。依 governance／workflow，技術 pass 不能替代 closeout；在主要代理完成欄位同步並成功執行 `npm run docs:check:final` 前，本工作項目不能標示治理結案。
  - F-02（P2，evidence reproducibility limitation）：evidence `:11-40` 只有去敏 command／argv 與 artifact hashes，未保存 source revision、完整 replay command、timeout／環境前提或 normal existing-daemon 的 model no-download observation。現有 `06`／`08` 工作紀錄與本審查的 candidate／source parity 可重建 context，但 evidence 不是獨立可重播的完整 provenance record；不阻擋本次 bounded lifecycle 判定，應列入後續 evidence schema／工作紀錄改善。
  - F-03（P2，live evidence observability limitation）：runner `scripts/verify-electron-ollama-ui.mjs:693-718` 以 terminal poll 觀察 `cancelled`，未把 cancel POST 的 HTTP status／回應單獨保存；因此可證明實際 terminal cancellation／checkpoint／resume 結果，但不能從 evidence 單獨區分「按鈕 POST 已被 200 接受」與「其他已存在的 cancelled transition」。現有 UI handler、server cancel endpoint 與 final checkpoint／session assertions 支持本次結果，列為可觀測性改善，不是本次生命週期技術 blocker。
- 結論：有條件通過
- 阻擋問題（若有）：F-01；F-02／F-03 為非阻擋的 evidence／observability findings。不得以本輪 pass 關閉既有 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` Seatbelt renderer blocker 或 signed identity／notarization blocker。
- 條件：
  1. 主要代理須保留本報告原文，在最新 `08-CHANGE-LOG.md` 補上本報告路徑、完整逐字引用、`獨立審查是否執行：是`、`發布授權：不適用` 與結案狀態，然後成功執行 `npm run docs:check:final`；不得以此擴大 normal loopback 結論。
  2. 後續若要宣稱更高可重現性，應在新 immutable evidence／工作條目保存 source revision／candidate build provenance、完整命令與 normal-daemon no-download boundary；不得回寫本 evidence。
- 本輪條件是否已被需求方接受：待確認（本次指示要求獨立審查與報告，未明確接受治理 closeout 或後續 evidence schema 條件）。
- 剩餘風險：本結論只適用於當時 macOS arm64 candidate、已可用的 `llama3.2:3b`、既有桌面 Ollama、normal loopback、6 個極短 synthetic cues 與同一 Electron／server session 的 reload／resume；不代表模型翻譯品質、長內容、app restart resume、Ollama failure／timeout recovery、Seatbelt／全機 egress、signed／hardened／notarized package、Windows、LM Studio 或 FR-021 overall。`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false` 必須持續揭露。
- 可逐字引用的完整結論句：**本輪 `FR-021-REPLAY-20261029-UI-NORMAL-3B-CANCEL-RESUME-NEXT1` round1 獨立審查結論為有條件通過：macOS arm64 current packaged candidate 搭配預裝 `llama3.2:3b` 的 normal-loopback UI cancel／checkpoint／同 session reload／resume／complete／accept／undo／redo／save lifecycle，及其 candidate hash、privacy、cleanup 與 timecode／原始 SRT invariant 均由指定 evidence、現行 runner／server 契約與獨立驗證支持；但 `08-CHANGE-LOG.md` 最新條目仍為「進行中」、未完成本輪審查引用與 final docs closeout，且本證據不得擴稱為 Seatbelt offline、全機斷網、signed/notarized package、Windows 或 FR-021 overall。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
