# 獨立複審報告：FR-021 macOS signed-canary external boundary audit

- 審查對象：目前 working tree 的 `scripts/audit-macos-signed-canary-external-boundary.mjs`、`scripts/test-macos-signed-canary-external-boundary.mjs`、指定 authoritative evidence `docs/project-management/evidence/2026-10-29-fr-021-macos-signed-canary-external-boundary-next6.json`，以及 00／05／06／07／08 治理紀錄。
- 對應 08-CHANGE-LOG 條目：`FR-021-MACOS-CI-20261029-EXTERNAL-BOUNDARY-AUDIT-NEXT1`。
- 審查輪次：round2；本輪針對 round1 指出的 reviewer false-pass、git status fail-open、authoritative evidence drift 與 governance closeout 重新核驗。
- 審查代理啟動時間、上下文來源：2026-10-29；獨立唯讀上下文，重新讀取 `AGENTS.md`、`docs/project-management/README.md`、full preflight 路由治理文件、round1 report、source、focused test、next6 evidence 與 00／05／06／07／08；未沿用主要代理的評價性結論。
- 審查限制：未執行 GitHub writes、workflow、signing、notarization、builder、candidate、Apple toolchain 或 evidence rewrite。唯一寫入為本報告。

## 1. 需求完整性

- 判定：部分通過
- 證據：技術修正已覆蓋 round1 的三個實質 findings，但治理 closeout 尚未完成；`projectEnvironment()`（`scripts/audit-macos-signed-canary-external-boundary.mjs:107-120`）不再只看 protection rule type，而是要求 `reviewers` 為非空陣列、每個 reviewer 為 object、type 為 `user`／`team` 且 id 為正整數。focused test（`scripts/test-macos-signed-canary-external-boundary.mjs:49-58`）實際逐一覆蓋空陣列、缺失欄位與非陣列 reviewer metadata，均投影 `requiredReviewerRulePresent=false`、summary not ready、status fail。
- git status fail-open 已修正：`projectLocalSource()`（`scripts/audit-macos-signed-canary-external-boundary.mjs:250-258`）在 git head 或 status subprocess non-zero／errorCode 時直接拋出 `EXTERNAL_BOUNDARY_GIT_STATUS_UNAVAILABLE` 或 head error，不再把 failure 默認成 clean；focused test（`:89-96`）已實際覆蓋 status failure。
- authoritative evidence drift 已修正至目前指定 next6：current validator 可通過 next6；evidence 的 `sourceRevision.auditScriptSha256`、`packageJsonSha256`、`workflowSourceSha256` 分別與目前 source、package.json、workflow SHA-256 一致，且 `localSource`／`sourceRevision` 的 HEAD、dirty flag、workflow hash 一致。next4／next5 歷史原件仍保留，未被偷換或覆寫。
- local contract、current evidence validator 與 remote external configuration 已被文件與 evidence 分開：local source／focused regression 只證明投影與 fail-closed contract；next6 validator 只證明 current-schema evidence 可驗證；remote Environment、secret metadata、protected branch 與 workflow deployment 則仍須以 read-only remote observation 判定。
- governance closeout 尚未修正：`08-CHANGE-LOG.md` 最新條目仍為「進行中」，且缺少 `獨立審查是否執行：` 與 `發布授權：` 欄位；因此本輪需求完整性不能判為完成。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：local contract 有條件通過；reviewer projection 現在採 fail-closed，即使 response 有 `required_reviewers` rule，沒有非空且結構有效的 reviewer metadata 也不會使 Environment ready。這直接關閉 round1 P1 false-pass；測試正向 fixture 仍使用一個具 type／id 的 reviewer，但 evidence projection 不保存 reviewer name。
- local provenance 現在採 fail-closed：`projectLocalSource()` 只有在 `/usr/bin/git rev-parse HEAD` 與 `git status --porcelain` 都成功，且 HEAD 為 40 字元 Git SHA 時才建立 local source projection。current working tree 實際為 dirty，next6 如實保存 `workingTreeDirty=true`，沒有把 subprocess failure 或 dirty state 隱藏成 clean。
- evidence binding 通過目前 source：next6 schema 為 `offline-subtitle-factory.macos-signed-canary-external-boundary-audit.v1`，`validateEvidence()` 實際通過；source、package、workflow hash 與 evidence 欄位逐一比對成立。這修正 round1 的 current authoritative evidence／source hash drift。
- external readiness 仍正確為 fail：next6 summary 的原因為 `environment-not-configured`、`environment-required-reviewer-not-confirmed`、`environment-secret-scope-not-confirmed`、`branch-not-protected`、`workflow-not-on-remote`、`local-source-not-on-remote`。這是 remote configuration gap，不是 local projection failure。

## 3. 邊界情況

- 判定：通過
- 證據：就 round1 findings 與目前 bounded contract 而言，focused test 實際覆蓋 complete pass、Environment／secret／branch protection／workflow 404、remote SHA mismatch、plain／JSON 404／403、malformed JSON、timeout、partial secret metadata、空／缺失／非陣列 reviewer metadata、git status subprocess failure、scope／branch／privacy／schema mismatch，以及 exclusive 0600／EEXIST writer。
- current evidence validator 以 next6 實際通過；next6 evidence mode 為 `0600`，SHA-256 為 `bb21059bb0408f0f6643f81b9e1911df20a06a4563cdd272f62de612e739a40a`。scope 明確為 `secretMetadataRead=true`、`secretValuesRead=false`、`secretValuesPersisted=false`、`rawCommandOutputPersisted=false`、`remoteStateModified=false`、`workflowTriggered=false`。
- 仍有外部邊界未被本地 fixture 證明：GitHub Environment 的實際 required reviewer configuration、secret scope、branch protection、Apple Silicon runner、Developer ID identity／credential、workflow run、signing 與 notarization 均未在本輪執行；這些不應被 local contract 或 current validator pass 擴稱。

## 4. 程式碼品質

- 判定：部分通過
- 證據：source 具固定 repository／branch／Environment／workflow constants，固定 `gh api --hostname github.com`，以 bounded response status／boolean／count／SHA projection 取代保存 raw diagnostics；`writeEvidenceFile()` 使用 schema validation、exclusive `wx` 與 owner-only `0600`，且不覆寫既有 evidence。
- privacy／scope 設計與 current evidence 一致：不保存 secret value、secret name、reviewer name、token、raw API output 或 absolute path；interpretation 也明確聲明這是 read-only external boundary audit，不證明 Apple signing／notarization 或 FR-021 overall。
- 剩餘品質問題是治理同步而非本輪 source finding：08 最新條目尚未加入本 round2 report 的正式審查欄位，也尚未標示完成。這使治理 validator 仍會拒絕 closeout，不能把 source-level conditional pass 寫成整體完成。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-10-29 本輪實際執行 `npm run project:preflight -- --type=full` exit 0、`node scripts/test-macos-signed-canary-external-boundary.mjs` exit 0、`node --check scripts/audit-macos-signed-canary-external-boundary.mjs` exit 0、current evidence validator exit 0、`npm run check` exit 0、`git diff --check` exit 0。
- focused test 已對應 round1 的兩個程式缺陷補上 negative fixtures；current evidence 已重新綁定目前 source revision，不再以 next4／next5 predecessor 代替指定 next6。
- `npm run docs:check:final` 本輪實際 exit 1，明確回報：最新工作紀錄缺少「獨立審查是否執行：」與「發布授權：」、最新條目尚未標示「完成」、以及「獨立審查是否執行」尚非是／否。故 technical checks pass 不能轉化為 governance closeout pass。

## 6. 實際運行結果

- 判定：不通過
- 證據：整體 round2 的 local contract 有條件通過，但 remote external configuration 未完成且 governance closeout 仍失敗。read-only remote query 實際取得：`refs/heads/codex/0.51-anthropic-claude` 存在，remote SHA 為 `22f7a09767923973c698fa817c543a1e586495f4`；Environment、Environment secret metadata、branch protection 與 workflow content endpoint 均為非零／未找到。next6 同樣保存該 bounded conclusion，且 local HEAD 為 `c06d15e95a2f0a0981518c5873003a460e57a5ee`、worktree dirty、local workflow 存在但尚未在 remote branch。
- 這些 remote 結果只能證明目前 external configuration 尚未部署／無法核驗，不代表 API classifier 錯誤，也不代表 local `.github/workflows/macos-signed-canary.yml` 已部署。local workflow source、current evidence validator 與 remote external configuration 三者邊界目前可追溯區分。
- round1 指出的 reviewer false-pass、git status fail-open 與 current authoritative evidence drift 已由 source、focused test、next6 evidence 與 hash／validator verification 收斂；唯一仍然明確的 closeout blocker 是 08 governance entry 與 final docs gate。
- 未執行 GitHub writes、workflow、signing、notarization、stapler、hdiutil、spctl、builder、candidate 或 Apple toolchain；不能宣稱 required reviewer／secret scope／protected branch／remote workflow、signed／notarized candidate、Apple ticket、實際 CI run 或 FR-021 overall acceptance 已完成。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-CI-20261029-EXTERNAL-BOUNDARY-AUDIT-NEXT1` round2 獨立複審結論為不通過（local contract 有條件通過、remote external configuration 未完成、governance closeout 仍失敗）：round1 指出的 `projectEnvironment()` reviewer false-pass 已由非空且結構有效的 `User`／`Team` reviewer metadata projection 與空／缺失／非陣列 focused fixtures 修正，`projectLocalSource()` git status failure 默認 clean 也已改為 fail-closed 並有 subprocess failure regression；指定 authoritative next6 evidence 可由目前 validator 通過，且 audit script、package、workflow source hashes 與 evidence provenance 一致，next4／next5 歷史原件未被覆寫；但 read-only remote observation 仍只證明 branch ref `22f7a09767923973c698fa817c543a1e586495f4` 存在，而 `macos-signed-canary` Environment、environment secret metadata、branch protection 與 workflow content 均未在 remote branch 部署，且 `npm run docs:check:final` 仍因最新 08 條目缺少獨立審查／發布授權欄位並維持「進行中」而 exit 1，故不得結案或宣稱 external boundary ready、signed／notarized candidate、實際 workflow 或 FR-021 overall 完成。**
- 阻擋問題（若有）：治理 closeout 未完成：`08-CHANGE-LOG.md` 最新條目仍為「進行中」，缺少 `獨立審查是否執行：`、`發布授權：` 與本 round2 canonical quote；`npm run docs:check:final` exit 1。remote Environment／secret metadata／branch protection／workflow 仍未部署或未核驗，屬 external configuration blocker，不可由 local contract pass 取代。
- 剩餘風險：GitHub Environment required reviewer／environment-scoped secret scope、protected branch、remote workflow、Apple Silicon runner、Developer ID identity／entitlements、notarization credential、實際 CI／Apple artifact、Seatbelt renderer、全機 egress、Windows、LM Studio 與 FR-021 overall 均未由本輪驗證；本報告不把 current evidence 的 `status=fail` 誤解為 source contract fail，也不把 local workflow file 的存在誤解為 remote deployment。
- 給主要開發代理的具體修正要求（若有）：只需先同步本報告 path、完整 round2 quote、`獨立審查是否執行：是`、round2 結論、`發布授權：不適用`、開發驗證與 residual 到最新 08 條目，將該條目標示為完成但保留 remote configuration gap，然後重跑 `npm run docs:check:final`。不得以此治理同步動作宣稱 remote Environment、workflow、signing、notarization 或 FR-021 overall 已完成。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

本輪另執行 full preflight、focused／syntax／完整 check、current evidence validator、`git diff --check` 與唯讀 GitHub API 查詢；未改寫 authoritative evidence、source、test、治理文件或既有 round1 report，未執行 GitHub writes、workflow、signing 或 notarization。

若上述聲明不實，本報告無效。
