# 獨立審查報告：FR-021 evidence provenance next1 round2

- 審查對象：`FR-021-REPLAY-20261029-EVIDENCE-PROVENANCE-NEXT1`；round1 report 保留未覆寫，current `HEAD` `c06d15e95a2f0a0981518c5873003a460e57a5ee`，工作樹既有變更保留。
- 複審範圍：只複審 round1 的 `worktreeDirty` completeness、pre-launch／renderer-ready loaded bytes、逐欄 invalid fixture，以及 next2 evidence、current 08 closeout 與治理狀態。
- 審查依據：current `scripts/verify-electron-ollama-ui.mjs`、`lib/runner-provenance.mjs`、`scripts/test-ollama-ui-offline.mjs`、next1／next2 immutable evidence、round1 report、`docs/project-management/08-CHANGE-LOG.md` 與 `scripts/project-docs-validator.mjs`。
- 審查方式：未重跑會建立新 live evidence 的 verifier；執行 preflight、focused UI contract、完整 `npm run check`、一般 docs check、治理 validator、`git diff --check` 與唯讀 source／hash／privacy／scope／cleanup 核對。

## 1. 需求完整性

- 判定：部分通過。
- 證據：round1 三項 findings 均在 current source／test／next2 中找到對應修正：`sourceProvenanceComplete` 現要求 `typeof worktreeDirty === 'boolean'`（`lib/runner-provenance.mjs:206-224`）；`preLaunchBytes` 與 renderer-ready 後重新讀取的 `loadedBytes` 分離，並要求 `loadedBytesMatchPreLaunch`（`:188-246`）；focused fixture 以完整合法 input 逐欄變異 missing dirty flag、path／secret、invalid timeout 與 hash mismatch（`scripts/test-ollama-ui-offline.mjs:184-228`）。但 current 08 條目仍為「進行中」、沒有本 round2 closeout 欄位，且治理文件尚未明確揭露 `loadedBytesObservation=renderer-ready-file-read` 不等同記憶體映射 introspection，故需求完整性尚未治理結案。

## 2. 邏輯正確性

- 判定：部分通過。
- 證據：verifier 在 pre-launch 建立 source／invocation／environment／`preLaunchBytes`，於第一次 home renderer-ready 與第二次重啟後 home renderer-ready 呼叫 `refreshReplayProvenance()`（`scripts/verify-electron-ollama-ui.mjs:308-334,452-460,604-620,916-925`），最後要求 `provenanceComplete=true`（`:1087`）。next2 `sourceProvenanceComplete=true`、`provenanceComplete=true`、`loadedBytesMatchPreLaunch=true`，且 current runner／provenance／package SHA-256 與 next2 sourceBytes 一致。證據語意已比 round1 清楚，但 `loadedBytesObservation` 的準確解讀是「renderer-ready 時再次從檔案讀取並 hash」，不是 Electron memory-mapped／runtime loader introspection；此界線需在治理 closeout 中明確保留。

## 3. 邊界情況

- 判定：通過。
- 證據：`projectReplayProvenance()` 現對缺失 dirty flag、invalid timeout、path／secret-shaped input、invalid source／artifact hash 與 pre-launch／loaded mismatch fail-closed；focused test 使用完整 valid fixture 後每次只變更一個欄位，並確認 `provenanceComplete=false`／private path 不落盤。`sanitizeRunnerArgv`／`sanitizeRunnerCommand` 的既有 path／control／secret／truncation cases 仍保留。next2 scope 仍是 loopback only，沒有把 provenance pass 擴成 Seatbelt offline、全機 egress、signed／notarized、Windows、LM Studio 或 FR-021 overall。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：`preLaunchBytes`、`loadedBytes`、observation stage 與 equality invariant 使資料流比 round1 可稽核；source／package／runner hash、candidate／review.js／Framework hash、bounded child-output digest／bytes、raw output exclusion 與 evidence `wx`／0600 writer 均維持。next2 的 artifact hashes 為 candidate `b3605c589459068f894a70896b8ed843be3832a839fcdd83aa898e9b16210de4`、review.js `ac25c6639a282eb5807c903fd0bded2419a39ce304428efeb137ac4a19a2b04b`、Framework `416b6c8cf74c59188266d3ff7a3fc77b9f68bb52f7328d98b382d132580c8cee`，與實際檔案一致。剩餘品質條件是文件不可把 renderer-ready file read 簡化成 runtime memory introspection，也不能把 dirty digest 說成可重建所有 dirty file contents。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：本輪 `npm run project:preflight -- --type=full` exit 0；`node scripts/test-ollama-ui-offline.mjs` exit 0；完整 `npm run check` exit 0；`node scripts/test-project-docs-validator.mjs`、`npm run docs:check` 與 `git diff --check` 均 exit 0。另以唯讀 helper probe 確認 `worktreeDirty=undefined` 時 `sourceProvenanceComplete=false`、`provenanceComplete=false`。測試已補足 round1 的逐欄 invalid cases，但尚未有獨立 test 對 `loadedBytesObservation` 的語義文字／文件同步或在 renderer-ready 後檔案變動的 race boundary；這是剩餘測試／揭露風險，不否定 next2 的現有 pass evidence。`npm run docs:check:final` 仍因 current 08 條目缺「獨立審查是否執行／發布授權／完成」欄位而 exit 1。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：next1 保留 immutable，mode `0600`、SHA-256 `aa35a2cc9b5e75dcc3886941ec98fc2a011ae0d365cd5b068007e11c39286bfe`；next2 為修正後 authoritative evidence，status `pass`、mode `0600`、SHA-256 `9a159170c0c4dfeac9112dff755fc68f6cd1356445a9396ef49d0fe42d0f19e3`。next2 保存 `sourceProvenanceComplete=true`、`provenanceComplete=true`、完整 normalized invocation／environment、`preLaunchBytes`、`loadedBytesObservation=renderer-ready-file-read`、`loadedBytesMatchPreLaunch=true`；同一 run 的 cancel POST HTTP 200／accepted／cancelled、checkpoint 1/6、第一／第二次 process／port cleanup、same userData／session／checkpoint restart、resume batch 1 至 6/6、accept／undo／redo／save／timecode invariant、raw output exclusion、privacy 與 final cleanup 均成立。scope flags 仍為 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`loopbackOnlyConfiguration=true`、`apiKeySupplied=false`，LM Studio 明確未執行。current 08 尚未同步本 round2 report／quote／條件接受／獨立審查／發布授權，故實際治理 closeout 仍待主要代理完成。

## 綜合判定

- 結論：有條件通過。
- round1 findings：`worktreeDirty` completeness、pre-launch／renderer-ready byte separation 與逐欄 invalid fixture 均已由 current source／focused test／next2 修正；本輪未發現新的技術 blocker。
- loadedBytes 語義條件：next2 的 `loadedBytesObservation` 已正確保存 `renderer-ready-file-read`，但 03／06／07／08 closeout 必須明確揭露「renderer-ready 時重新讀取檔案 bytes，不等同記憶體映射 introspection」，不得寫成 Electron runtime memory loader 的直接觀測。
- next2 authoritative：是；next1 保留為 round1 finding 的 immutable first-run，next2 SHA-256 `9a159170...d0f19e3` 才是修正後 provenance／lifecycle bounded evidence。
- F-02 狀態：技術 contract 有條件通過；dirty flag、normalized invocation、environment、runner／package bytes、pre-launch／renderer-ready file-read equality 與 fail-closed tests 已成立，但 provenance 仍是 evidence-level commitment，dirty digest 不保存全部 dirty file contents，也不等同完整 build／memory introspection。
- 阻擋問題（若有）：
  - **GOV-R2-01（P1，治理 closeout）**：`08-CHANGE-LOG.md` 的 current work item 仍為「進行中」，缺本 round2 report path／完整 quote／條件接受／`獨立審查是否執行：是`／`發布授權：不適用`／完成狀態，且 `npm run docs:check:final` exit 1。主要代理須同步 08 後重跑 final gate；本報告不修改 08。
  - **DISC-R2-01（P2，語義揭露）**：03／06／07／08 需明確標注 `renderer-ready-file-read` 不等同記憶體映射 introspection；未同步前不得把 loaded bytes 擴稱為 runtime memory observation。
  - **F-01／F-02／F-03 round1 technical findings：無新增 blocker，均已解除。**
- Scope：本輪只支持 macOS arm64 current packaged candidate、預裝 `llama3.2:3b`、既有 Ollama、normal-loopback app-restart／cancel／checkpoint／resume lifecycle 與 evidence provenance；不得擴稱 Seatbelt offline、全機 egress、signed／notarized package、Windows、LM Studio 或 FR-021 overall。
- 可逐字引用完整結論句：**本輪 `FR-021-REPLAY-20261029-EVIDENCE-PROVENANCE-NEXT1` round2 獨立複審結論為有條件通過：round1 指出的 `worktreeDirty` completeness、pre-launch 與 renderer-ready loaded-byte separation、以及 invalid replay fixture 未逐欄變異問題，均已由目前 `projectReplayProvenance()`、`scripts/test-ollama-ui-offline.mjs` 與 next2 immutable evidence 修正；next2 status `pass`、mode `0600`、SHA-256 `9a159170c0c4dfeac9112dff755fc68f6cd1356445a9396ef49d0fe42d0f19e3`，source／invocation／environment／preLaunchBytes／loadedBytes equality、cancel／checkpoint／app-restart／resume／cleanup／privacy 與 normal-loopback scope 均核對成立；`loadedBytesObservation=renderer-ready-file-read` 必須明確解讀為 renderer-ready 時重新讀取檔案 bytes、不等同記憶體映射 introspection，而 current 08 條目仍為「進行中」且缺本 round2 治理 closeout 欄位，故主要代理同步 08、補上該語義揭露並使 `npm run docs:check:final` 通過前，本輪只能判定 bounded provenance contract 有條件通過；本輪不得擴稱 Seatbelt offline、全機 egress、signed／notarized、Windows、LM Studio 或 FR-021 overall。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪未重跑會建立 live evidence 的 verifier；未修改 source、test、evidence、00／03／06／07／08 或既有 round1 報告。唯一寫入目標為本檔案。
- 若上述聲明不實，本報告無效。
