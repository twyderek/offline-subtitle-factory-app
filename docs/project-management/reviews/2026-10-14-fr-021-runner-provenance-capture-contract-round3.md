# 獨立複審報告：FR-021 runner provenance capture contract

- 審查輪次：round3（最終複審）
- 審查日期：2026-10-14
- 審查對象：目前 dirty worktree；基準 commit `299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`／版本 0.51.0
- 審查範圍：`scripts/verify-electron-ollama-ui.mjs`、`scripts/verify-electron-ollama-ui-offline.mjs`、`scripts/test-ollama-ui-offline.mjs`、`docs/project-management/03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、`00-CURRENT-STATUS.md`、最新 `08-CHANGE-LOG.md` 條目，以及 round1／round2 報告作為複審基準。
- 審查前置：已執行 `npm run project:preflight -- --type=full`，並依其列出的核心／full 路由讀取本輪指定文件與來源。

## 審查範圍與基準

本輪只判定 runner-level evidence schema v4 contract 是否成立。基準包含：去敏 launch summary 與 outer sandbox 旗標、candidate executable／review script／Electron Framework 的 pre-launch identity、真正以 Buffer 計算且上限 16,000 bytes 的 child output fingerprint、固定 diagnostic category 白名單（最多 8）、offline wrapper 的白名單 projection、artifact read failure 的固定 code／category，以及不將上述欄位宣稱為 packaged UI acceptance、replay-time loaded bytes、exact Chromium generated profile、build provenance 或 FR-021 完成。

round1 的 pre-spawn candidate identity 與 diagnostics projection 阻擋，以及 round2 的 artifact read failure code／category 阻擋，均已由目前 source、VM regression 與 source-contract assertions 覆蓋。本輪另核對結案文件 gate；該 gate 的結果與 runner contract 判定分開列明。

## 1. 需求完整性

- 證據：`scripts/verify-electron-ollama-ui.mjs:217-225` 在 child spawn 前 best-effort 讀取 candidate executable／review script hash；`227-237` 在同一階段處理 Framework identity。`243-250` 以 Buffer 累積並以 `childOutputBuffer.length` 截斷至 16,000 bytes。live evidence schema 為 v4，保存 hash、byte length、cap 與 `rawChildOutputPersisted: false`。
- 證據：`scripts/verify-electron-ollama-ui-offline.mjs:394-396` 將 `source.diagnostics.startupDiagnosticCategories` 以固定格式白名單、最多 8 項投影至 `runnerProvenance`；`scripts/test-ollama-ui-offline.mjs:174-184` 覆蓋固定 artifact code、pre-spawn 順序、byte cap 與 diagnostics projection。
- 證據：artifact read 失敗時 `candidateArtifactReadFailed` 只作為內部旗標；`scripts/verify-electron-ollama-ui.mjs:447-450` 建立並拋出固定 `CANDIDATE_ARTIFACT_READ_FAILED`，`failureCategory()` 於 `376-380` 回傳同一固定類別，catch 寫入 evidence 的 `error.code`／`error.category` 均為固定值，不再保存 `EACCES` 等底層 code。
- 判定：通過（runner-level schema v4 需求完整；不包含 packaged acceptance 或 FR-021 結案宣稱）。

## 2. 邏輯正確性

- 證據：candidate artifact capture 的 read block 位於 `const child = spawn(...)` 前；Framework hash 失敗維持 best-effort，不阻斷後續 cleanup。child output 使用 `Buffer.isBuffer`／`Buffer.from`、`Buffer.concat` 與 byte length，截斷後只產生 fingerprint／長度。
- 證據：artifact read failure 會在主 `try/catch/finally` 內被轉為固定錯誤，`currentStage` 保持 `artifact_preflight`；VM regression `scripts/test-ollama-ui-offline.mjs:64-70` 驗證 process cleanup、temporary userData removal、固定 `error.code`、固定 `error.category` 與 raw path canary 不進 evidence。
- 證據：wrapper 對 runner provenance 欄位採型別／格式／數量限制，且 diagnostics projection 來源是 live `source.diagnostics`，不是只讀 `source.error`。
- 判定：通過。round2 發現的可變底層 code 已從 evidence contract 排除，主要控制流與 projection 語義一致。

## 3. 邊界情況

- 證據：source-contract 覆蓋 splash／trusted target、sandbox／`--no-sandbox` exclusion、raw child output exclusion、Framework／executable pre-spawn 順序、16,000-byte cap、固定 artifact failure code／category，以及 wrapper diagnostics projection。VM regression 也涵蓋 artifact read failure 後仍 cleanup。
- 證據：`safeStartupDiagnosticCategories()` 僅由固定 checks 產生固定 category，最多以 projection `.slice(0, 8)` 保存；錯誤 evidence 只保存去敏 stage、category、code、exit status 與 categories，不保存 raw exception message 或 artifact path。
- 判定：通過（在 runner-level source／contract 邊界內）。未以此推論 Chromium runtime 內部 generated profile 或 replay-time loaded bytes。

## 4. 程式碼品質

- 證據：capture、固定錯誤轉換、category filtering、wrapper projection 與 cleanup 均維持局部邏輯；固定 error code／category 的命名及 VM assertion 可讀且可追溯。round1／round2 修正已同步反映於 `07-DEBUG-AND-FIX-HISTORY.md` 與最新 changelog 條目。
- 證據：raw child output 只存在於記憶體 bounded Buffer，evidence 不寫入 raw output、使用者／暫存路徑或 secret-shaped env；文件明確保留 runner-level provenance 的非等價邊界。
- 判定：通過。未發現會阻擋本輪 runner provenance contract 的程式碼品質問題。

## 5. 測試覆蓋

- 證據：目前 focused source-contract／VM regression 已加入固定 `error.code === 'CANDIDATE_ARTIFACT_READ_FAILED'` 與 `error.category === 'CANDIDATE_ARTIFACT_READ_FAILED'`，並保留 cleanup、raw-path exclusion、pre-spawn order、projection 與 byte-cap assertions。使用者提供 focused offline contract 與完整 `npm run check` 均 exit 0；本輪未重跑該兩項，避免觸發明確禁止的 packaged／Ollama／network acceptance。
- 證據：本輪實際執行三支相關 MJS `node --check`，均 exit 0；實際執行 `git diff --check`，exit 0；實際執行 `npm run docs:check:final`，結果 exit 1，但失敗原因是最新 `08-CHANGE-LOG.md` 的結案欄位／狀態，不是 runner source／test failure。
- 判定：通過（runner contract test coverage）；完整 runtime acceptance 仍不在本輪授權與測試範圍。

## 6. 實際運行結果

- 證據：本輪 reviewer 實際完成 `npm run project:preflight -- --type=full`、三支 MJS syntax check 與 `git diff --check`，均成功；另執行 `npm run docs:check:final`，exit 1。使用者提供 focused offline contract 與完整 `npm run check` exit 0，列為既有工作樹驗證結果，未冒充本輪 reviewer 重跑結果。
- 證據：本輪未啟動 packaged Electron／Ollama，未執行 canary、network probe、OS policy change，也未使用 `--no-sandbox`；因此沒有 packaged UI acceptance、replay-time loaded bytes、exact Chromium generated profile 或 build provenance 的 runtime result。
- 判定：runner-level contract 通過；repository final documentation gate 尚未通過，屬結案流程阻擋而非本輪 runner contract blocker。

## 綜合判定

- runner-level 判定：**通過**。
- 結案狀態：**有條件通過**。`npm run docs:check:final` 目前仍因最新 `08-CHANGE-LOG.md`「狀態：進行中」且缺少「獨立審查是否執行：」欄位而 exit 1；本報告依使用者限制不修改該文件。
- 可逐字引用的完整結論句：**本輪獨立複審結論為 runner-level contract 通過：candidate executable／review script／Framework 的 pre-spawn best-effort capture、真正 16,000-byte child-output cap、固定 diagnostics projection，以及 artifact read failure 的固定 `CANDIDATE_ARTIFACT_READ_FAILED` error code／category 均已由目前 source、source-contract assertions 與 VM regression 覆蓋；本輪沒有尚未解決的 runner provenance 阻擋，但 `npm run docs:check:final` 仍因最新 08-CHANGE-LOG.md 尚未標示完成且缺少獨立審查欄位而未通過，且本結論不代表 packaged UI acceptance、replay-time loaded bytes、exact Chromium generated profile、build provenance 或 FR-021 完成。**

- 阻擋問題（runner contract）：無。
- 阻擋問題（結案流程）：最新 `docs/project-management/08-CHANGE-LOG.md` 條目仍為「進行中」，且缺少 `獨立審查是否執行：` 欄位，導致 `npm run docs:check:final` exit 1；需由主要代理依授權另行完成文件結案，非本審查代理處理。

## 明確保留風險

- candidate／Framework pre-launch hash 只證明 runner 在 spawn 前讀到的候選 bytes，不證明 replay-time loaded bytes、動態載入的 Framework identity 或 build provenance。
- bounded child-output fingerprint 只保留最多 16,000 bytes 的 hash／長度／固定 categories；raw output 不可由 evidence 還原，也不能取代受控 packaged runtime diagnostics。
- offline wrapper 的 `runnerProvenance` 是白名單 projection，不是 Chromium exact generated profile、child runtime argv 或 OS network egress proof。
- 本輪未執行 packaged Electron、Ollama、canary、network acceptance；focused／完整 check 的 exit 0 為使用者提供的工作樹結果，不能擴張為本輪實機 acceptance 或 FR-021 完成。

## 審查代理聲明

本報告是本輪唯一新增檔案；未修改程式、既有 evidence、治理文件、round1／round2 報告或其他 review 檔。未執行任何 packaged Electron／Ollama／canary／network acceptance。
