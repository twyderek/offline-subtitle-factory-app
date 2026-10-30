# 獨立複審報告：FR-021 runner provenance capture contract

- 審查輪次：round2
- 審查日期：2026-10-14
- 審查對象：目前 dirty worktree；基準 commit `299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`／版本 0.51.0
- 審查範圍：`scripts/verify-electron-ollama-ui.mjs`、`scripts/verify-electron-ollama-ui-offline.mjs`、`scripts/test-ollama-ui-offline.mjs`、`docs/project-management/03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、`00-CURRENT-STATUS.md`、最新 `08-CHANGE-LOG.md` 條目，以及 round1 報告作為複審基準。
- 審查前置：已執行 `npm run project:preflight -- --type=full`，並依其列出的核心／full 路由讀取本輪指定文件與來源。

## 審查範圍與基準

本輪只審查 runner-level evidence schema v4 contract。基準包含：去敏 launch summary 與 outer sandbox 旗標、candidate executable／Electron Framework 的 pre-launch SHA-256、真正以 Buffer 計算且上限 16,000 bytes 的 child output fingerprint、固定 diagnostic category 白名單（最多 8）、offline wrapper 的白名單 projection，以及不將上述欄位宣稱為 packaged UI acceptance、replay-time loaded bytes、exact Chromium generated profile、build provenance 或 FR-021 完成。

round1 的兩個阻擋已確認修正：candidate executable／review script hash 現在位於 child spawn 前 best-effort capture；offline wrapper 現在將 `source.diagnostics.startupDiagnosticCategories` 以固定白名單、最多 8 項投影至 `runnerProvenance`。本輪只指出仍未解決的阻擋。

## 1. 需求完整性

- 證據：live runner 使用 schema v4，並在 `scripts/verify-electron-ollama-ui.mjs:217-225` 於 `const child = spawn(...)` 前讀取 candidate executable 與 review script hash；Framework path／hash 也在 spawn 前 best-effort 讀取。`scripts/verify-electron-ollama-ui-offline.mjs:388-398` 將 `source.diagnostics.startupDiagnosticCategories` 做格式白名單與 `.slice(0, 8)` 後寫入 `runnerProvenance`。`scripts/test-ollama-ui-offline.mjs:172-183` 已加入兩項順序與 projection source-contract assertions。
- 證據：artifact read 失敗時，runner 建立 `new Error('CANDIDATE_ARTIFACT_READ_FAILED')`，但在 `scripts/verify-electron-ollama-ui.mjs:446-449` 將 `artifactError.code` 設為底層 `candidateArtifactReadErrorCode`；catch 於 `855-864` 只把 `error.code` 寫入 evidence，未保存該固定錯誤 code／固定 category。
- 判定：不通過。round1 兩項阻擋已通過；「讀取失敗以固定錯誤 code 記錄」仍未以 evidence schema 方式滿足。

## 2. 邏輯正確性

- 證據：`candidateExecutableSha256`、`candidateReviewScriptSha256` 與 Framework identity 的 capture 均先於 child spawn；child output 使用 `Buffer.concat`，以 `childOutputBuffer.length` 截斷至 `16000` bytes，final evidence 保存 SHA-256、byte length、cap 與 `rawChildOutputPersisted: false`。wrapper 的 runner provenance category 來源已改為 `source.diagnostics.startupDiagnosticCategories`。
- 證據：artifact read 失敗仍會進入主 `try/catch/finally`，`currentStage` 保持 `artifact_preflight`，因此 cleanup 路徑可繼續執行；但 `failureCategory(error)` 未辨識 `CANDIDATE_ARTIFACT_READ_FAILED`，而 `evidence.error.code` 會是 `EACCES` 等底層 code。這使「固定 code」與實際持久化欄位不一致。
- 判定：部分通過。正常 capture、projection 與 cleanup 控制流正確；artifact read failure 的 error identity 邏輯仍不符合固定 code 契約。

## 3. 邊界情況

- 證據：目前 source-contract 已覆蓋 Framework／executable pre-spawn 順序、16,000-byte cap、byte-length measurement、raw output exclusion、`--no-sandbox` exclusion，以及 wrapper diagnostics projection。artifact read failure 的 VM regression 仍確認 cleanup、temporary userData removal 與 sanitized evidence。
- 證據：`scripts/test-ollama-ui-offline.mjs:66-67` 對 artifact read failure 的既有 assertion 仍要求 `runnerFailureEvidence.error.code === 'EACCES'`，沒有要求固定的 `CANDIDATE_ARTIFACT_READ_FAILED`；因此 regression test 目前反而固定了底層 OS code，而非本輪要求的穩定 contract code。
- 判定：不通過。cleanup 邊界已保護，但 read failure 的跨平台／可重現 error identity 仍可能隨底層讀取錯誤改變。

## 4. 程式碼品質

- 證據：capture、safe category filtering、wrapper projection 與 cleanup 均採局部處理；raw child output 不落盤，Framework identity failure 不阻斷 cleanup，整體變更與 03／06／07 的 schema v4 邊界描述一致。
- 證據：目前同一 failure 同時有固定 message `CANDIDATE_ARTIFACT_READ_FAILED`、可變 `error.code`（例如 `EACCES`）及未特別辨識的 generic `failureCategory`，但 evidence 沒有分開保存「固定分類」與「底層診斷 code」的欄位，造成讀者無法由持久化 evidence 穩定識別此類 failure。
- 判定：部分通過。結構與資料最小化品質良好，但錯誤分類／code 的契約語義仍含糊，構成目前唯一剩餘阻擋。

## 5. 測試覆蓋

- 證據：本輪實際執行 `node --check scripts/verify-electron-ollama-ui.mjs`、`node --check scripts/verify-electron-ollama-ui-offline.mjs`、`node --check scripts/test-ollama-ui-offline.mjs`，均 exit 0；實際執行 `git diff --check`，exit 0；實際執行 `npm run docs:check`，exit 0（19 個治理文件）；`npm run project:preflight -- --type=full` 完成。
- 證據：已讀取目前 source-contract assertions，確認兩項 round1 修正的順序與 projection assertion 存在；本輪未執行 focused offline UI contract、完整 `npm run check`、packaged Electron、Ollama、canary 或 network acceptance。使用者提供的 focused／完整 check exit 0 屬工作樹既有結果，本報告不將其冒充為本輪 reviewer 實際重跑結果。
- 證據：artifact read failure test 目前只驗證 `EACCES`，未驗證固定 `CANDIDATE_ARTIFACT_READ_FAILED` 是否進入持久化 evidence，因此無法防止本輪發現的 error-code regression。
- 判定：部分通過。靜態檢查與 round1 修正 assertions 可追溯；固定 error code 的測試覆蓋不足，且受明確限制未執行 runtime tests。

## 6. 實際運行結果

- 證據：本輪 reviewer 實際結果只有 preflight、三支 MJS syntax check、scoped `git diff --check` 與 `npm run docs:check`，全部 exit 0。未啟動 packaged Electron／Ollama，未執行 canary、network probe、OS policy change，也未使用 `--no-sandbox`。
- 證據：因此本輪沒有 packaged UI acceptance、replay-time loaded bytes、exact Chromium generated profile 或 build provenance 的 runtime evidence；schema v4 仍只可作 runner-level source／static contract 審查。
- 判定：部分通過。靜態檢查通過，但不構成 FR-021 完成，也不能取代受限制而未執行的實際 acceptance。

## 綜合判定

- 可逐字引用的完整結論句：**本輪獨立複審結論為不通過：round1 的 candidate executable／review script pre-spawn capture、真正 16,000-byte child-output cap 與 offline runner diagnostics projection 均已由目前 source 與 assertions 修正，但 artifact read failure 雖會進入主 try/finally 並完成 cleanup，持久化 evidence 仍只記錄 EACCES 等底層可變 code，未記錄固定的 CANDIDATE_ARTIFACT_READ_FAILED，因此 runner provenance capture contract 尚未完整成立；本輪未執行 packaged UI／Ollama／canary／network acceptance，亦不代表 replay-time loaded bytes、exact Chromium generated profile、build provenance 或 FR-021 完成。**

- 阻擋問題（尚未解決）：`scripts/verify-electron-ollama-ui.mjs:446-449,855-864` 將固定 failure message 與底層讀取 code 混用，evidence 的 `error.code` 仍是 `EACCES` 等可變值，且 `failureCategory` 未提供固定的 artifact-read-failure category；`scripts/test-ollama-ui-offline.mjs:66-67` 也只驗證 `EACCES`。應由主要代理將固定 code／category 寫入 evidence（如需保留底層 code，另存為非契約性的診斷欄位），並更新 regression assertion；本審查代理不自行修正。

## 審查代理聲明

本報告是本輪唯一新增檔案；未修改程式、既有 evidence、治理文件、round1 報告或其他 review 檔。未執行任何 packaged Electron／Ollama／canary／network acceptance。
