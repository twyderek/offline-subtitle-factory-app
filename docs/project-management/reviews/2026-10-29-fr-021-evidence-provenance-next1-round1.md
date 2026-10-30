# 獨立審查報告：FR-021 evidence provenance next1 round1

- 審查對象：`FR-021-REPLAY-20261029-EVIDENCE-PROVENANCE-NEXT1`；current `HEAD` `c06d15e95a2f0a0981518c5873003a460e57a5ee`，工作樹有既有變更，未覆蓋。
- 審查依據：`AGENTS.md`、`docs/project-management/README.md`、最新 `docs/project-management/08-CHANGE-LOG.md` 條目、`03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、`scripts/verify-electron-ollama-ui.mjs`、`lib/runner-provenance.mjs`、`scripts/test-ollama-ui-offline.mjs` 與 `docs/project-management/evidence/2026-10-29-fr-021-evidence-provenance-next1.json`。
- 審查規則：已讀取 `scripts/project-docs-validator.mjs` 的 `validateReviewReport`／`validateLatestEntry`；本報告使用六個固定標題與每節獨立 `判定`／`證據`。
- 審查方式：未重跑會建立新 live evidence 的 verifier；執行 preflight、focused／source regression、完整 `npm run check`、治理 validator、一般 docs check、final docs check 與唯讀 evidence／artifact／privacy／scope 核對。

## 1. 需求完整性

- 判定：不通過。
- 證據：本工作項目要求以 source revision／dirty digest、去敏 normalized replay invocation、timeout／environment、runner／package bytes 與 replay-time loaded artifact bytes 補足 F-02；目前 evidence 確實保存 `sourceRevision`、`sourceBytes`、`invocation`、`environment` 與 `loadedBytes`（evidence `:44-79`），且 `provenanceComplete=true`。但 `lib/runner-provenance.mjs:190-209` 的 completeness gate 沒有要求 `sourceRevision.worktreeDirty` 為 boolean；唯讀呼叫以完整其他欄位但 `worktreeDirty=null` 時仍回報 `provenanceComplete=true`。因此「缺欄位即 `REPLAY_PROVENANCE_UNAVAILABLE`」的需求尚未完整成立，F-02 不能無條件結案。

## 2. 邏輯正確性

- 判定：部分通過。
- 證據：正常 live path 會在 `scripts/verify-electron-ollama-ui.mjs:308-330` 讀取 HEAD、dirty status digest、runner／shared module／package hashes、normalized invocation、runtime environment 與 artifact hashes；缺少 provenance 時 `:594-598` 設為 `REPLAY_PROVENANCE_UNAVAILABLE`，evidence writer 以 `wx`／`0600` 保存（`:1131-1133`）。但 candidate／review.js／Framework hash 在 `:289-329`、`projectReplayProvenance()` 呼叫與 `launchElectronChild()`（`:365`）之前讀取，所保存的 `loadedBytes` 是 spawn 前的檔案 hash，不是 Electron runtime 內實際載入 bytes 的獨立觀測；目前 source 因此不足以支持文件所稱的「replay-time loaded bytes」強語義。

## 3. 邊界情況

- 判定：部分通過。
- 證據：`lib/runner-provenance.mjs:11-23,41-79,126-189` 對 commit／hash／port／timeout／platform／Node／candidate basename 與 command template 有 allowlist；focused test `scripts/test-ollama-ui-offline.mjs:48-114,184-217` 覆蓋 path、secret、invalid command／timeout／hash、argv truncation、missing argv 與不洩漏 raw value。可是 `:208-215` 的 invalid replay cases 是把已產出的 nested provenance object spread 回 `projectReplayProvenance()`，而非以完整合法輸入逐一只變更一個欄位；這些 cases 會因多個必要 top-level input 缺失而失敗，不能充分證明每個 invalid/path/secret 欄位單獨 fail-closed。另 `SAFE_MODEL` 允許中間 slash 的 model identifier，故不能把所有含 slash 的 model 字串都當成 path 泄漏已被拒絕。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：共用 projection 讓 live／offline runner 使用相同的 argv／hash／diagnostic sanitizer；source／package／runner bytes 以 SHA-256 保存，raw child output 只保存 bounded digest／bytes，source path、raw command、secret、token 不落盤。evidence 與目前 source 的 runner／provenance／package hash 分別一致；candidate executable、packaged `review.js` 與 Electron Framework 實際 hash 也分別為 `b3605c...10de4`、`ac25c6...2b04b`、`416b6c...c8cee`。但 dirty boolean 未納入 complete invariant，以及 `loadedBytes` 實際為 pre-launch file reads，造成欄位名稱／設計語義比實作更強；這是可維護性與可稽核性缺口，不是單純格式問題。

## 5. 測試覆蓋

- 判定：不通過。
- 證據：本輪 `npm run project:preflight -- --type=full` exit 0；`node scripts/test-ollama-ui-offline.mjs` exit 0；完整 `npm run check` exit 0；`node scripts/test-project-docs-validator.mjs` 與 `npm run docs:check` 均通過；`git diff --check` exit 0。測試已固定 live schema v5、`REPLAY_PROVENANCE_UNAVAILABLE`、source-before-spawn、privacy 與 lifecycle contract，但沒有 regression 斷言 `worktreeDirty=null` 必須使 `provenanceComplete=false`，也沒有以完整合法 fixture 逐一變異 dirty boolean、loaded-byte inputs、environment／invocation fields。因而 deterministic tests 尚未守住本輪需求宣稱的全欄位 fail-closed contract。`npm run docs:check:final` 因最新 08 條目仍為「進行中」且缺獨立審查／發布授權欄位而 exit 1；這是尚未完成的治理 closeout，不可用一般 docs check 取代。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：新 immutable evidence `docs/project-management/evidence/2026-10-29-fr-021-evidence-provenance-next1.json` status `pass`、mode `0600`、SHA-256 `aa35a2cc9b5e75dcc3886941ec98fc2a011ae0d365cd5b068007e11c39286bfe`；`provenanceComplete=true`，HEAD、dirty digest、normalized invocation（`cancel-resume-restart`／`llama3.2:3b`／9995／30000）、darwin／arm64／Node、source／package／loaded hashes 均存在。實際 normal-loopback run 仍通過 cancel POST HTTP 200／accepted／cancelled、checkpoint 1/6、第一／第二次 process group／app server port cleanup、同一 userData／session／checkpoint restart、resume 1 至 6/6、accept／undo／redo／save／timecode invariant 與 daemon／temporary cleanup；privacy scan 未見 secret／path，scope 明確為 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`loopbackOnlyConfiguration=true`、`apiKeySupplied=false`。然而目前 worktree dirty digest 為 `5c8df698...bcd4e6e`，與 evidence 記錄的 `950b783d...6247167` 不同，表示 evidence 是 replay 當下的 immutable snapshot，不是目前整個 dirty worktree 的現況；且 loaded hash 仍未證明 runtime 實際載入 bytes。

## 綜合判定

- 結論：不通過。
- 阻擋問題（若有）：
  - **F-02-P1（provenance completeness fail-closed）**：`projectReplayProvenance()` 的 `provenanceComplete` 未要求 `worktreeDirty` 為 boolean；缺失 dirty state 仍可能產生 complete provenance。需補 invariant、focused regression 與新 immutable evidence；不得覆寫本 evidence。
  - **F-02-P1（loaded-bytes semantic gap）**：目前 `loadedBytes` 是 Electron spawn 前對 candidate／review.js／Framework 的檔案讀取 hash，未證明 replay-time runtime 實際載入的 bytes。需明確修正欄位語義／命名與驗收契約，或增加可證明的 loaded-byte boundary，再另立 evidence。
  - **F-02-P2（negative-test quality）**：invalid replay test fixture 未以完整合法輸入逐欄變異，不能充分守住每個 invalid/path/secret 欄位的獨立 fail-closed 行為。
- F-01 live lifecycle：本輪未發現新的 app-restart／cancel／checkpoint／resume／cleanup 技術 finding；上述 F-02 findings 不否定該 bounded run 的實際 UI 結果，但阻止本工作項目的 provenance contract 無條件通過。
- Scope：本 evidence 只支持 macOS arm64 current packaged candidate、預裝 `llama3.2:3b`、既有 Ollama、normal loopback app-restart／cancel／checkpoint／resume lifecycle；不得擴稱 Seatbelt offline、全機 egress、signed／notarized package、Windows、LM Studio 或 FR-021 overall。
- 可逐字引用完整結論句：**本輪 `FR-021-REPLAY-20261029-EVIDENCE-PROVENANCE-NEXT1` round1 獨立複審結論為不通過：新 evidence 確實以 0600／exclusive-create 保存 `provenanceComplete=true`、source HEAD／dirty digest、去敏 normalized invocation、timeout／environment、runner／package hashes、candidate／review.js／Framework hashes，且同一 normal-loopback app-restart run 的 cancel POST HTTP 200／accepted／cancelled、checkpoint、第一／第二次 process／port cleanup、同一 userData／session／resume 1 至 6/6、privacy 與 cleanup 均成立；但 `projectReplayProvenance()` 未把 `worktreeDirty` boolean 納入 completeness invariant，缺失 dirty state 仍可回報 complete，focused invalid replay fixture 也未以完整合法輸入逐欄變異，且目前 `loadedBytes` 是 spawn 前檔案 hash 而非可獨立證明的 replay-time runtime loaded bytes，因此 F-02 provenance contract 尚未 fail-closed 完整收斂；本輪只支持 macOS arm64 current candidate／預裝 `llama3.2:3b`／normal-loopback app-restart lifecycle，不得擴稱 Seatbelt offline、全機 egress、signed／notarized、Windows、LM Studio 或 FR-021 overall。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪未重跑會建立 live evidence 的 verifier；未修改 source、test、evidence、00／03／06／07／08 或既有 review。唯一寫入目標為本檔案。
- 若上述聲明不實，本報告無效。
