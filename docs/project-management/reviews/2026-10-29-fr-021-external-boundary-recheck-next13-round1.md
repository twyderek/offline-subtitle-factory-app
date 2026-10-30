# 獨立審查報告：FR-021 macOS signed-canary external boundary recheck next13

- 審查對象：目前 working tree 的 `scripts/audit-macos-signed-canary-external-boundary.mjs`、`scripts/test-macos-signed-canary-external-boundary.mjs`、authoritative `docs/project-management/evidence/2026-10-29-fr-021-macos-signed-canary-external-boundary-next13.json`，以及 00／06／07／08 治理紀錄。
- 對應 08-CHANGE-LOG 條目：`FR-021-MACOS-CI-20261029-EXTERNAL-BOUNDARY-RECHECK-NEXT13`。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-29T08:37Z 起（Asia/Taipei 16:37 起）；獨立唯讀上下文，完整讀取 `AGENTS.md`、project-management README、00／06／07／08 指定內容、independent-review／document-closeout workflow、audit source／focused test／next13 evidence；未沿用主要代理的評價性結論。
- 審查限制：未重跑會覆寫 authoritative evidence 的 audit；未執行 GitHub write、workflow、builder、codesign、notarization、stapler、Gatekeeper 或 release。唯一寫入為本報告。

## 1. 需求完整性

- 判定：通過。
- 證據：08 條目要求本輪只做 `gh api --hostname github.com` 唯讀查詢、以 exclusive `next13` evidence path 保存 bounded projection，並明確要求 `remoteStateModified=false`、`workflowTriggered=false`、`secretValuesRead=false`；`docs/project-management/08-CHANGE-LOG.md:3-14`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 與 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-7` 均一致。audit source 固定 repository／branch／Environment／workflow，並在 `scripts/audit-macos-signed-canary-external-boundary.mjs:68-70` 使用固定 GitHub hostname。
- 證據：next13 evidence `:13-65` 保存 remote branch、Environment、environment secret metadata、branch protection、workflow presence、local source 與 source revision；`:67-84` 明確保存 scope、`status: fail` 與不擴大解讀的 interpretation。這符合本輪「external observation」而非 signed-canary runtime acceptance 的範圍。

## 2. 邏輯正確性

- 判定：通過。
- 證據：`projectEnvironment()` 對 required reviewer 要求非空陣列、`user`／`team` 類型與正整數 reviewer ID（`scripts/audit-macos-signed-canary-external-boundary.mjs:107-124`）；`buildSummary()` 對 Environment、required reviewer、secret scope、branch protection、workflow presence 與 remote/local source match 採 fail-closed 判定（`:182-203`）。focused test 實際覆蓋空、缺失與非陣列 reviewer metadata（`scripts/test-macos-signed-canary-external-boundary.mjs:55-64`）。
- 證據：目前 next13 的四項 external gap 被正確投影為 `environment-not-configured`、`environment-required-reviewer-not-confirmed`、`environment-secret-scope-not-confirmed`、`branch-not-protected`（evidence `:46-58`），而 remote branch SHA 與 local HEAD 相同、workflow presence 為 true；因此 `ready=false` 是外部配置未完成的 bounded fail，不是 local audit contract failure。
- 證據：`validateEvidence()` 要求 exact schema、來源 provenance 一致、summary 與 status 一致、scope 內除三個查詢旗標外全部為 false，並拒絕 leakage（`scripts/audit-macos-signed-canary-external-boundary.mjs:285-313`）；`writeEvidenceFile()` 使用 exclusive `wx`／0600（`:316-319`）。

## 3. 邊界情況

- 判定：通過。
- 證據：focused test exit 0，實際覆蓋 complete pass、空／缺失／錯型 reviewer、Environment／secret／protection／workflow 404、remote SHA mismatch、plain／JSON 404／403／malformed／timeout response、partial secret metadata、git status failure、scope／branch／privacy leakage mismatch，以及 0600／EEXIST writer（`scripts/test-macos-signed-canary-external-boundary.mjs:47-115`）。
- 證據：source 對 remote API response 只保存 bounded status／boolean／count／SHA，不保存 raw `gh` diagnostics；`classifyGhResult()` 對 404／403／timeout／invalid JSON 分類且 catch 明確不保存 raw diagnostics（`scripts/audit-macos-signed-canary-external-boundary.mjs:42-65`）。
- 證據：實際 next13 scope 為 `remoteApiQueried=true`、`networkConnectionsAttempted=true`、`secretMetadataRead=true`，而 `remoteStateModified`、`workflowTriggered`、`secretValuesRead`、`secretValuesPersisted`、`rawCommandOutputPersisted`、`absolutePathsPersisted`、`identityNamesPersisted`、`reviewerNamesPersisted`、`candidateModified`、`signingAttempted`、`notarizationAttempted` 均為 false（evidence `:67-81`）。

## 4. 程式碼品質

- 判定：通過。
- 證據：查詢常數、projection helper、summary builder、validator 與 writer 分層清楚；`projectRemoteBranch()`／`projectWorkflow()` 僅接受固定 ref／path 與合法 Git SHA（`scripts/audit-macos-signed-canary-external-boundary.mjs:85-93`、`:166-174`），local source／package／audit／workflow provenance 以 SHA 綁定（`:250-281`）。
- 證據：privacy boundary 由 exact-key validation、fail-closed scope、64-hex／40-hex digest gate、leakage scan 與 exclusive 0600 writer 共同保護；`node --check`、focused test、治理 validator 與 `git diff --check` 均通過，未發現本輪 source／test technical finding。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：2026-10-29T08:37:18Z，`node --check scripts/audit-macos-signed-canary-external-boundary.mjs && node --check scripts/test-macos-signed-canary-external-boundary.mjs` exit 0。
- 證據：2026-10-29T08:37:20.509Z，`node scripts/test-macos-signed-canary-external-boundary.mjs` exit 0，輸出 `macOS signed canary external boundary contract passed`。
- 證據：2026-10-29T08:37:22.727Z，`node scripts/test-project-docs-validator.mjs` exit 0；2026-10-29T08:37:24.938Z，`npm run docs:check` exit 0；2026-10-29T08:37:26.950Z，`git diff --check` exit 0。
- 證據：2026-10-29T08:37:31.439Z，唯讀 Node 核對 `validateEvidence()`、0600、evidence SHA-256、summary／scope／source match 通過；檔案 mode 為 `0600`，SHA-256 為 `c3ffb62230fc4ae5d6de2add79c0cce71dca1c3de9e86d0741cd822308b607ec`。
- 證據：2026-10-30T07:19:08.353+08:00，建立本報告後重新執行 `node scripts/test-project-docs-validator.mjs` 與 `npm run docs:check`，均 exit 0；確認本報告格式與目前治理文件均可被 validator 讀取。
- 限制：2026-10-29T08:37:56.801Z，`npm run check` 在 sandbox 內 exit 1，於 `test-electron-main.mjs` 的 `listen EPERM: operation not permitted 127.0.0.1` 中止；依本輪限制未重跑需額外核准的版本。此為 loopback bind 執行環境限制，沒有指向本輪 external-boundary source／focused contract failure；06 所記錄的主要代理完整 check 結果未由本獨立上下文重新宣稱。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：本輪重新讀取並以 current validator 核對 authoritative next13，未重跑會寫入 evidence 的 audit。next13 的實際 bounded observation 為 remote branch present／SHA `f16ae8be60fb132bdbb1a128722a244f70f86e6b`、local HEAD 同 SHA、remote workflow present／SHA `310f549149b12ead95d569e941415664f87545a0`，但 Environment、required reviewer、environment secret metadata 與 branch protection 均 `not-found`；因此 `status=fail`、`ready=false`。
- 證據：evidence interpretation 明確寫明這是 read-only external boundary audit，不配置 GitHub、不觸發 CI、不證明 Apple signing／notarization，亦不建立 FR-021 overall acceptance（evidence `:83-84`）。本輪沒有 workflow run、runner identity／keychain profile、codesign、notarytool、stapler、Gatekeeper、candidate、packaged UI、Windows 或 full-egress 實測。
- 證據：文件同步如實保留相同 residual：`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false`、受控 runner identity／credential、全機 egress、Windows 與 FR-021 overall 未完成（00／06／07 最新段落）。remote branch／workflow/source provenance match 沒有被解讀成 signed／notarized candidate 或 overall acceptance。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-CI-20261029-EXTERNAL-BOUNDARY-RECHECK-NEXT13` round1 獨立審查結論為有條件通過：current-source external-boundary audit 的 bounded response projection、required-reviewer／secret metadata／branch protection fail-closed 判定、privacy／scope／schema／0600 exclusive writer 與 focused／治理／syntax／diff checks 均通過，next13 也如實保存 `status=fail`、四項 external prerequisite 缺口、`remoteStateModified=false`、`workflowTriggered=false`、`secretValuesRead=false` 及未保存 raw API output／secret value／reviewer name／token；但 Environment、required reviewer、environment secret metadata 與 protected branch 仍未配置，且本輪未執行真實 workflow、runner identity、signing 或 notarization，因此條件僅限外部配置完成後另行重查／執行受控 workflow，不代表 signed／notarized candidate、release 或 FR-021 overall acceptance。**
- 阻擋問題（若有）：無 local source／test technical finding；外部阻擋為 `macos-signed-canary` Environment、required reviewer、environment secret metadata 與 branch protection 尚未確認。完整 `npm run check` 的 sandbox loopback `EPERM` 是本審查環境限制，不是本輪 external-boundary finding。
- 剩餘風險：在外部管理者完成並核驗上述 GitHub 配置、受控 macOS runner 的 Apple identity／keychain profile／notarization 後，仍需另行執行 workflow，確認 codesign、notary ticket、stapler、Gatekeeper 與候選資產；`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false`、全機 egress、Windows 與 FR-021 overall residual 仍未解除。
- 給主要開發代理的具體修正要求（若有）：無 source 修正要求。僅需在外部配置完成後建立新的 exclusive evidence path 並重新執行 bounded external recheck；若 ready，才可依既有 workflow gate 進入受控 handoff，並持續不保存 secret value／raw API output、不把 metadata match 擴大為 signing／notarization／overall acceptance。

## 審查代理聲明

- 本審查代理為獨立上下文，除建立本報告外僅執行讀取、唯讀驗證與指令執行；未修改、覆寫、刪除或建立任何其他專案檔案。
- 未 stage／commit／push，未執行 GitHub write、workflow、builder、signing、notarization、stapler、Gatekeeper 或 release；未重跑會寫入 authoritative evidence 的 audit。
- 若上述聲明不實，本報告無效。
