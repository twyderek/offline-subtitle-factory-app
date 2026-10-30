# 獨立審查報告：FR-021 runner provenance review.js hash schema parity

- 審查對象 commit／版本：`c06d15e95a2f0a0981518c5873003a460e57a5ee` 工作樹、版本 `0.52.0`；工作樹含既有未提交變更
- 對應 08-CHANGE-LOG 條目：2026-10-28 — runner provenance review.js hash parity（`FR-021-REPLAY-20261028-EVIDENCE-PROVENANCE-SCHEMA-PARITY`）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：`2026-10-28T04:28:25Z`；以 current worktree、指定 source／test／治理文件與既有 replay4 evidence 重新取證，未將先前審查結論當作本輪證據。依需求限制，本輪不執行 live runner、network、Ollama／Electron replay 或模型操作。

## 1. 需求完整性

- 判定：通過
- 證據：本輪 08 條目列明成功條件是 offline `projectUiEvidence()` 從安全 artifact hash 投影 `candidateReviewScriptSha256`，且與 live runner 欄位名稱／hash validation 同構（`docs/project-management/08-CHANGE-LOG.md:3-20`）。live runner 在 `scripts/verify-electron-ollama-ui.mjs:272-301` 建立 `runnerProvenance.candidateReviewScriptSha256`；offline projection 在 `scripts/verify-electron-ollama-ui-offline.mjs:381-402` 以同名欄位、64-hex fail-closed 條件投影。`00`／`06`／`07` 的最新條目均把範圍限制在 schema parity，且明確記錄未新增 replay（`docs/project-management/00-CURRENT-STATUS.md:3-7`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-7`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-8`）。

## 2. 邏輯正確性

- 判定：通過
- 證據：live runner 在 child spawn 前計算 executable、`review.js` 與 Framework hash（`scripts/verify-electron-ollama-ui.mjs:225-245`），並將 `reviewScriptSha256` 寫入 artifact／runner provenance（同檔 `:272-301`）。offline wrapper 由 source artifact 讀取 `reviewScriptSha256`，只在 `/^[a-f0-9]{64}$/i` 通過時保存，否則為 `null`（`scripts/verify-electron-ollama-ui-offline.mjs:381-402`）；它沒有把原始 review.js path 投影出去。live／offline provenance 的欄位順序雖可不同，但目前欄位集合與語意對得上：command、argv projection、sandbox flags、executable／review.js／Framework identity、bounded child-output digest／bytes／limit／categories，以及 raw-output exclusion。
- 證據：`scripts/test-ollama-ui-offline.mjs:88-133` 以有效 `b/a/c` 64-hex fixture 驗證 executable／review.js／Framework hash 保留，並以 `/home/private/review.js` 驗證 review.js path fail-closed；`scripts/test-ollama-ui-offline.mjs:283-297` 另固定 wrapper 的 provenance field contract。

## 3. 邊界情況

- 判定：部分通過
- 證據：已由 deterministic test 覆蓋有效 hash、review.js path 形式的非法值、缺省 source object 可安全投影為 `null`（程式條件）、Unicode／path command、secret-shaped argv、私有路徑、child output raw exclusion；具體案例見 `scripts/test-ollama-ui-offline.mjs:71-79`、`:88-133` 與 `:171-180`。目前 code 的 regex 確實拒絕 path／非 64-hex 值，且 replay4 的保存值為安全 SHA-256 字串。
- 證據：仍缺少直接 regression assertion 固定 `reviewScriptSha256` 缺失、非 primitive／可被 `String()` 強制轉換的輸入，以及 live source 本身含有 `candidateReviewScriptSha256` 的 source-level assertion；測試也未動態比較 live／offline provenance key set。這些是 schema-boundary coverage residual，未造成目前 live-generated JSON 的功能性阻擋，但若要求嚴格 scalar schema，應補測試或收緊投影型別。

## 4. 程式碼品質

- 判定：通過
- 證據：變更集中在 `scripts/verify-electron-ollama-ui-offline.mjs:10,382-391` 與 `scripts/test-ollama-ui-offline.mjs:14,71-133,286`；沿用既有 64-hex／bounded projection pattern，沒有引入 raw path、raw child output 或 secret 保存。offline 以既有 shared `sanitizeRunnerCommand`／`sanitizeRunnerArgv` 處理 runner identity，沒有複製 command sanitizer 規則（`lib/runner-provenance.mjs:11-15,33-55`）。`node --check` 與 `git diff --check` 均通過。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：本審查於 `2026-10-28T04:28Z` 執行 `node --check scripts/verify-electron-ollama-ui-offline.mjs`、`node --check scripts/test-ollama-ui-offline.mjs`、`node --check lib/runner-provenance.mjs`、`node --check scripts/verify-electron-ollama-ui.mjs`，均 exit 0；執行 `node scripts/test-project-docs-validator.mjs`，輸出「治理文件驗證器測試通過」；執行 `git diff --check`，exit 0。另以 `jq -e` 核對 replay4 status、schema、artifact／runner review.js hash equality、raw-output false 與 normal-loopback flags，輸出 `true`。
- 證據：`scripts/test-ollama-ui-offline.mjs` 的既有 deterministic regression 與 08／06 條目記錄 `node scripts/test-ollama-ui-offline.mjs`、`node scripts/test-ai-providers.mjs`、完整 `npm run check` 曾 exit 0；本審查沒有重跑這些可能啟動 local HTTP／process fixture 的套件，因使用者明確禁止本輪 network／Ollama／Electron replay。現有 tests 的 parity assertion 是欄位／投影 fixture assertion，不是完整 live／offline JSON schema 自動比對。

## 6. 實際運行結果

- 判定：部分通過
- 證據：既有 `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay4.json` 的 `schema` 為 `offline-subtitle-factory.ollama-ui-live-acceptance.v4`、`status` 為 `pass`；`artifact.reviewScriptSha256` 與 `runnerProvenance.candidateReviewScriptSha256` 均為 `ac25c6639a282eb5807c903fd0bded2419a39ce304428efeb137ac4a19a2b04b`，`rawChildOutputPersisted=false`，candidate／Framework hash 均存在（evidence JSON `artifact`／`runnerProvenance` 欄位）。既有 00／06／07 條目均說明 replay4 是唯讀對照或 normal loopback pass，沒有新增 offline replay。
- 證據：replay4 的 `scope.systemNetworkDisabled=false`、`scope.sandboxedTargetProcessTree=false`、`scope.loopbackOnlyConfiguration=true`；因此它只能實測 live normal-loopback provenance 與 packaged UI flow，不能實測本輪 offline wrapper 在 Seatbelt 下的 runtime projection。依限制，本輪未啟動任何 live runner、network、Ollama／Electron replay 或模型。
- 證據：本輪另執行 `npm run docs:check:final`，exit 1；輸出指出最新 08 條目仍未標示完成，且缺少「獨立審查是否執行」與「發布授權」欄位。這是治理 closeout 尚未完成的可驗證狀態，不是將 replay4 擴大為 offline acceptance 的理由。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：未發現本輪 source projection 的功能性阻擋；治理 closeout 仍有條件，需由主要代理將本報告連結與逐字結論寫入最新 08 條目，補齊必要欄位並在不擴大 scope 的前提下重跑 `npm run docs:check:final`。此外，若專案要把「schema parity」提升為可機械驗證的完整契約，應補 live source review.js field assertion、missing／non-primitive hash boundary assertion 與 live／offline key-set parity assertion。
- 剩餘風險：本輪只審查 runner provenance schema parity；沒有新的 offline runtime evidence，且 replay4 是 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false` 的 normal loopback。nested Chromium sandbox、真正全機 egress、Windows、LM Studio 例外、其他模型／版本與 FR-021 其餘驗收仍未完成；不得以本報告或 replay4 代替上述驗收。
- 本輪條件是否已被需求方接受：是
- 可逐字引用的完整結論句：**本輪 FR-021 runner provenance review.js hash schema parity 獨立六面向審查結論為有條件通過：offline `projectUiEvidence()` 已以與 live runner 同名且同一 64-hex fail-closed 語意的 `candidateReviewScriptSha256` 補齊指定 runner provenance schema parity，deterministic source／boundary checks、既有 replay4 的 live hash equality 與 normal-loopback scope 均核對通過；本輪只限 runner provenance schema parity，不得宣稱 Seatbelt offline、全機斷網、Windows 或 FR-021 完整驗收。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
