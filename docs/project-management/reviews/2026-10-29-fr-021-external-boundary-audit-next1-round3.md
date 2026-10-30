# 獨立 closeout 複審報告：FR-021 macOS signed-canary external boundary audit

- 審查對象：目前 working tree 的 external-boundary source、focused test、round1／round2 報告、authoritative current-source `next6` evidence，以及 00／05／06／07／08。
- 對應 08-CHANGE-LOG 條目：`FR-021-MACOS-CI-20261029-EXTERNAL-BOUNDARY-AUDIT-NEXT1`。
- 審查輪次：round3 closeout 複審；本輪未沿用主要代理的評價性結論，重新讀取目前 source、tests、evidence 與治理紀錄。
- 審查限制：只執行讀取、唯讀 `gh api` 狀態核對與本地驗證；未執行 GitHub writes、workflow、signing、notarization、builder、candidate 或 Apple toolchain。唯一寫入為本報告。

## 1. 需求完整性

- 判定：通過
- 證據：round1 的技術 findings 已關閉：`projectEnvironment()` 現要求 required-reviewer rule 具有非空 reviewer array，且每一項為 `User`／`Team` 與正整數 id；空陣列、缺失 reviewers、非陣列 metadata 均 fail-closed。這直接修正 reviewer false-pass。
- `projectLocalSource()` 現對 `git rev-parse HEAD` 或 `git status --porcelain` non-zero／error 直接 fail-closed，不再把 status failure 默認成 clean；focused test 已覆蓋 status subprocess failure。
- authoritative current-source `docs/project-management/evidence/2026-10-29-fr-021-macos-signed-canary-external-boundary-next6.json` 通過目前 validator。其 source provenance 與目前 source 一致：audit script `afe6d1e...42bf2`、package `d93d65...2454`、workflow `21535d...ae34f`；完整 SHA 已由本輪重新核對。next4／next5 歷史原件仍保留，沒有以後續 evidence 覆寫前件。
- 08 最新條目已標示「完成」，並明確記錄 round1／round2、next6、remote configuration residual 與 FR-021 overall 未完成；00／05／06／07 的敘述同樣把 local contract、current evidence 與 remote deployment 分開。
- 本輪 `npm run docs:check:final` 在 round3 報告尚未整合回 08 前 exit 1，原因只有治理 validator 仍把 round2 報告的「不通過」視為最新獨立審查結論；這是 closeout sequencing condition，不是 external-boundary source failure。

## 2. 邏輯正確性

- 判定：通過
- 證據：current source 的 reviewer projection、local git provenance、exact schema、scope allowlist、privacy guard 與 summary cross-field binding 均為 fail-closed。`status: "fail"` 的 next6 是因 remote external conditions 未成立及 remote/local revision 不一致，不是 local source validator 失敗。
- next6 的 bounded result 為：remote branch present、remote SHA `22f7a09767923973c698fa817c543a1e586495f4`；Environment、environment secret metadata、branch protection、remote workflow 均 `not-found`；local workflow 存在但尚未部署到 remote branch；local worktree dirty，local HEAD 為 `c06d15e95a2f0a0981518c5873003a460e57a5ee`。
- scope 明確為 `remoteApiQueried=true`、`secretMetadataRead=true`、`secretValuesRead=false`、`secretValuesPersisted=false`、`rawCommandOutputPersisted=false`、`remoteStateModified=false`、`workflowTriggered=false`；沒有把 secret values、names、reviewer names、token 或 raw diagnostics 落盤。
- `summary.reasons` 的 external gap 為 `environment-not-configured`、`environment-required-reviewer-not-confirmed`、`environment-secret-scope-not-confirmed`、`branch-not-protected`、`workflow-not-on-remote`、`local-source-not-on-remote`。這些 reason 不應被改寫成 local source defect。

## 3. 邊界情況

- 判定：通過
- 證據：focused test 實際涵蓋 complete pass、Environment／secret／protection／workflow 404、remote SHA mismatch、plain／JSON 404／403／malformed／timeout response、partial secret metadata、空／缺失／非陣列 reviewer metadata、git status failure、scope／schema／privacy mismatch，以及 exclusive 0600／EEXIST writer；本判定限於 local bounded contract。
- next6 evidence mode 為 `0600`，current validator 通過；writer 使用 exclusive `wx`，不覆寫已存在 evidence。scope 與 interpretation 明示本輪不是 GitHub deployment、CI run、Apple signing、notarization 或 FR-021 overall acceptance。
- local fixtures 不等同實際 remote Environment reviewer、secret scope、branch protection、Apple Silicon runner、Developer ID identity／credential、workflow run 或 Apple ticket；這些仍是外部 residual，不得由 fixture pass 擴稱已完成。

## 4. 程式碼品質

- 判定：通過
- 證據：source 固定 repository／branch／Environment／workflow，固定使用 `gh api --hostname github.com`，只投影 bounded status、boolean、count 與 SHA；不保存 raw command output。schema key、provenance、scope、privacy、summary 與 0600 writer 均有 validator；本判定限於 local source quality，不代表 remote configuration 已部署。
- round1 的 reviewer metadata false-pass 與 git status fail-open 已由 source guard 及 focused regression 修正；round2 指出的 current evidence drift 已由 next6 source／package／workflow hash binding 收斂。
- 唯一尚待完成的是治理 closeout：將本 round3 報告與本輪「有條件通過」結論整合回 08 後，重跑 `npm run docs:check:final`；在該命令通過前，不把本條目稱為最終 governance closeout 已驗證。

## 5. 測試覆蓋

- 判定：通過
- 證據：本輪實際執行並通過：`node scripts/test-macos-signed-canary-external-boundary.mjs`、current next6 evidence validator、`npm run check`、`git diff --check`。`npm run check` 包含治理 validator、全部 Node syntax checks、完整 npm test 與 YouTube posttest，exit 0；`docs:check:final` 的 closeout sequencing condition 另於下列證據保留。
- 本輪 `npm run docs:check:final` 實際 exit 1，唯一訊息為「最新一輪獨立審查結論為不通過」；它對應尚未把本 round3 report 回填 08 的中間狀態。round2 的 technical findings 已由本輪重跑 focused／current validator／full check 再次確認已修正。
- 本輪另以唯讀 `gh api --hostname github.com` 核對：remote branch endpoint exit 0；Environment、environment secret metadata、branch protection 與 remote workflow content endpoints 均 exit 1。未保存 raw response，也未執行任何遠端修改。

## 6. 實際運行結果

- 判定：通過
- 證據：`next6.status="fail"` 應正確解讀為外部設定 readiness fail：Environment、secret metadata、branch protection 與 workflow 尚未在 remote branch 可見，且 local source 尚未與 remote branch SHA 匹配；它不是 local external-boundary source、focused test 或 current evidence validator failure。本判定限於本輪實際觀測與 bounded interpretation。
- 本輪未觸發 workflow，未建立／修改 Environment、required reviewer、environment secret、protected branch、runner 或 repository content；未執行 signing、notarization、stapler、hdiutil、spctl、builder、packaged UI、Ollama、model 或 release。
- 因此可結案的範圍只限 local bounded response projection、round1 技術修正、current-source next6 provenance、privacy／scope 與 remote gap observation。`macos-signed-canary` Environment、secret metadata、branch protection、remote workflow、Apple runner／identity／credential、signed／notarized candidate、實際 CI 與 FR-021 overall 均未完成。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-CI-20261029-EXTERNAL-BOUNDARY-AUDIT-NEXT1` round3 closeout 獨立複審結論為有條件通過：round1 的 reviewer metadata false-pass 與 git status fail-open 已由 fail-closed source guard 及 focused regression 修正，round2 的 current evidence drift 已由 authoritative current-source next6 validator 與 audit／package／workflow provenance hash binding 修正，focused test、current evidence validator、完整 `npm run check` 與 `git diff --check` 均通過；next6 `status: fail` 只表示 remote Environment、environment secret metadata、branch protection、remote workflow 尚未部署／可見以及 local HEAD 與 remote branch 不一致，不是 local source failure；本輪仍不得宣稱 external configuration、signed／notarized candidate、實際 workflow 或 FR-021 overall 已完成，且主要代理須將本報告回填 08 後重跑 `npm run docs:check:final` 以完成治理 closeout。**
- 阻擋問題（若有）：無新的技術阻擋；治理 closeout 尚有一項可操作條件：將本報告與上述完整結論同步至 08，並重新執行 `npm run docs:check:final`。Remote Environment、secret metadata、branch protection、workflow、Apple identity／credential 與 FR-021 overall 是明確 residual，不應被誤標為 local failure 或本輪已完成。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪另執行唯讀 GitHub API 狀態核對、source／evidence／documentation inspection 與指定本地驗證；未改寫既有 evidence／review、未執行 GitHub writes、workflow、signing、notarization、builder、candidate 或 Apple toolchain。round3 結論只適用於上述 bounded local contract 與 closeout 條件，不代表 remote external configuration 或 FR-021 overall acceptance。

若上述聲明不實，本報告無效。
