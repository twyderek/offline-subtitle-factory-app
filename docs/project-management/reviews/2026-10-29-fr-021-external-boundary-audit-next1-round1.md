# 獨立審查報告：FR-021 macOS signed-canary external boundary audit

- 審查對象：目前 working tree 的 `scripts/audit-macos-signed-canary-external-boundary.mjs`、`scripts/test-macos-signed-canary-external-boundary.mjs`、指定 authoritative evidence `docs/project-management/evidence/2026-10-29-fr-021-macos-signed-canary-external-boundary-next4.json`，以及 00／05／06／07／08 治理紀錄。
- 對應 08-CHANGE-LOG 條目：`FR-021-MACOS-CI-20261029-EXTERNAL-BOUNDARY-AUDIT-NEXT1`。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-29T14:22:17+08:00；獨立唯讀上下文，重新讀取 `AGENTS.md`、`docs/project-management/README.md`、full preflight 路由治理文件、source、focused test、next4 evidence 與 00／05／06／07／08；未沿用主要代理的評價性結論。
- 審查限制：未執行 GitHub writes、workflow、signing、notarization、builder、candidate、Apple toolchain 或 evidence rewrite。唯一寫入為本報告。

## 1. 需求完整性

- 判定：不通過。
- 證據：本地 contract 的主要需求大致有對應：source 固定 repository／branch／Environment／workflow，使用 `gh api --hostname github.com`，以 bounded projection、exact schema、0600 exclusive writer 保存遠端狀態；`scripts/audit-macos-signed-canary-external-boundary.mjs:264-297` 有 exact-key／privacy／scope／source-revision validation，focused test 的 complete／404／remote-mismatch／redaction／EEXIST cases 位於 `scripts/test-macos-signed-canary-external-boundary.mjs:26-101`。但指定的 authoritative next4 不是目前 source 可驗證的 evidence：以目前 validator 讀取 next4 實際得到 `EXTERNAL_BOUNDARY_SCOPE_NOT_FAIL_CLOSED`；next4 的 `scope` 含 `secretsRead` 且缺 `secretMetadataRead`／`secretValuesRead`，並且 next4 `sourceRevision.auditScriptSha256=69138c89944a7296bf68698c3829dafb1d381c46311394afa978dd6539d9f353`，不等於目前 source SHA-256 `7b1cfab779d84ab35a9bb7fde3bfeefb25ee64676a0dcd824231187c7cf90d19`。目前樹中另有後續 next5 且可被 current validator 驗證，但本審查依指示不把 next5 偷換成 next4 的 authoritative evidence。
- 證據：治理文件也曾／仍需明確區分 local contract 與 remote external configuration；next4 所觀測的 remote branch ref `22f7a09767923973c698fa817c543a1e586495f4` 與 Environment／secret metadata／branch protection／workflow 的 remote 缺口，不能被 local workflow source 或 local focused pass 取代。00／05／06／07／08 對 next4／next5 與 closeout 狀態曾出現不同步，且 08 目前仍標示「進行中」。

## 2. 邏輯正確性

- 判定：不通過。
- 證據（P1）：`projectEnvironment()` 只以 protection rule 的 `type` 是否為 `required reviewers` 判定 reviewer ready，見 `scripts/audit-macos-signed-canary-external-boundary.mjs:107-115`；沒有要求 `rule.reviewers` 為非空陣列。於 2026-10-29 實際以 exported `buildAuditEvidence()` 注入唯一差異 fixture：`protection_rules:[{type:'required_reviewers'}]`、三個 required secret、protected branch、remote workflow 與 remote/local SHA 全部合法，結果為 `status:"pass"`、`summary.ready:true`、`environment.requiredReviewerRulePresent:true`。這使 malformed／空 reviewer rule 可能將未配置 reviewer 的 Environment 誤判為 ready，並可能讓 signed-canary readiness 越過 external trust boundary。
- 證據（P2）：`collectLocalSource()` 將 `git status --porcelain` 失敗映射成 `workingTreeDirty:false`，見 `scripts/audit-macos-signed-canary-external-boundary.mjs:241-249`；沒有把 subprocess failure 投影為 unavailable／fail-closed。若 git status 不可用，source provenance 可能被誤記為乾淨，進而讓 `remoteSourceMatchesLocalHead` 在其他條件成立時錯誤通過。這是 source-level contract 風險，非本次 remote 404 觀測的證據。

## 3. 邊界情況

- 判定：部分通過。
- 證據：focused test 實際覆蓋 JSON／plain 404、403、malformed、timeout、partial secret metadata、remote SHA mismatch、scope／branch／privacy mismatch、0600 與 EEXIST；`node scripts/test-macos-signed-canary-external-boundary.mjs` exit 0。這些證明 bounded response projection 與 evidence writer 的本地邊界。
- 證據：focused test 的正向 Environment fixture 有一個 reviewer，位於 `scripts/test-macos-signed-canary-external-boundary.mjs:28-33`，但沒有空 `reviewers`、缺失 `reviewers`、非陣列 reviewer metadata 的負向案例；也沒有對 `/usr/bin/git status` failure、workflow source symlink 或 `fs.existsSync`／hash 失敗做 fail-closed fixture。故 P1 reviewer false-pass 與 P2 local-status failure 均未被邊界測試關閉。
- 證據：next4 的 remote 觀測本身是 bounded `fail`：`remoteBranch.present=true`，Environment、environment secret metadata、branch protection、workflow 均 `not-found`，local HEAD 與 remote SHA 不同；這清楚區分 remote external configuration gap 與 local source contract，但因 next4 schema／source provenance 已與目前 source 漂移，不能把它當作目前 source 的完整 authoritative evidence。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：固定 endpoint／hostname、只投影 status／boolean／count／SHA、拒絕 raw diagnostics、exact schema、privacy regex、0600 `wx` writer 與不覆寫既有 evidence 的設計清楚；`queryGitHubApi()` 位於 `scripts/audit-macos-signed-canary-external-boundary.mjs:68-70`，`writeEvidenceFile()` 位於 `:295-297`。focused test 與完整 check 均沒有發現 syntax 或回歸錯誤。
- 阻擋品質問題：reviewer rule 與 local git status 的 fail-open projection 破壞了本模組宣稱的 fail-closed external/source boundary；此外 next4 evidence 與 current validator 的 schema／hash 漂移表示 evidence generation 與 source revision 尚未維持不可混用的 provenance contract。source 可讀性尚可，但在修正上述安全與可追溯性問題前不能判為通過。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：2026-10-29T14:22（+08:00）實際執行 `npm run project:preflight -- --type=full` exit 0、`node scripts/test-macos-signed-canary-external-boundary.mjs` exit 0、`node --check scripts/audit-macos-signed-canary-external-boundary.mjs` exit 0、`npm run check` exit 0、`git diff --check` exit 0。完整 check 的外部-boundary focused regression 顯示 `macOS signed canary external boundary contract passed`。
- 證據：2026-10-29T14:22（+08:00）執行 current validator：next4 fail `EXTERNAL_BOUNDARY_SCOPE_NOT_FAIL_CLOSED`；current tree 中的 next5 pass，但它不是本審查指定的 next4。2026-10-29T14:22（+08:00）執行 `npm run docs:check:final` exit 1，工具回報最新工作紀錄缺少「獨立審查是否執行：」與「發布授權：」、最新條目尚未標示「完成」，以及 review 欄位值尚未為是／否。
- 具體補測要求：新增空／缺失／非陣列 reviewer metadata 的 fail-closed fixtures；為 `git status` 非 0／spawn error 建立可注入 seam，驗證 `workingTreeDirty` 不得默認 false；將 evidence generation、validator 與 authoritative evidence 的 source hash／scope schema 綁在同一版本，並在 final gate 前對指定 evidence 執行 current validator。

## 6. 實際運行結果

- 判定：不通過。
- 證據：本地 bounded contract 實際通過，但這不等同 remote external configuration 已完成。2026-10-29T14:22（+08:00）以 read-only `gh api --hostname github.com` 查詢：remote branch ref endpoint status 0，安全投影為 `refs/heads/codex/0.51-anthropic-claude 22f7a09767923973c698fa817c543a1e586495f4`；Environment、environment secrets、branch protection、remote workflow content endpoints 均非 0。沒有保存 raw API output，也沒有執行任何 GitHub write 或 workflow。
- 證據：next4 evidence 的實際 remote conclusion（branch 存在、其餘 external configuration 404）與上述唯讀查詢一致，但 next4 不能通過目前 source validator，且 source revision hash 不對應目前 source；因此只能作為歷史／前一版本 observation，不能作為目前實作的 authoritative closeout evidence。current next5 可驗證不改變 remote gap，也不能補正 next4 被指定為 authoritative 的不一致。
- 證據：未執行 Apple signing、notarization、stapler、hdiutil、spctl、builder、candidate、packaged app、runner 或 workflow；因此不能宣稱 required reviewer／environment secret scope／protected branch／remote workflow 已部署，也不能宣稱 signed／notarized candidate、Apple ticket、CI run 或 FR-021 overall acceptance。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-CI-20261029-EXTERNAL-BOUNDARY-AUDIT-NEXT1` round1 獨立審查結論為不通過：local bounded response／schema／privacy／0600 writer contract 與 focused／完整回歸均可重現通過，但指定 authoritative next4 evidence 以目前 validator 實際失敗於 `EXTERNAL_BOUNDARY_SCOPE_NOT_FAIL_CLOSED` 且其 audit-script provenance hash 不等於目前 source；更有 `projectEnvironment()` 只檢查 required-reviewer rule type、未檢查非空 reviewer metadata 的 P1 false-pass，以及 `collectLocalSource()` 將 git status failure 默認為 clean 的 P2 fail-open source-provenance 問題；remote read-only observation 仍只證明 branch ref 存在而 Environment、secret metadata、branch protection 與 workflow content 未部署，不能被 local workflow 或 focused pass 取代；修正 reviewer／git-status fail-closed 邏輯、補 focused fixtures、以 current-source matching evidence 重新建立 authoritative record、同步 00／05／06／07／08，並使 `npm run docs:check:final` 通過前，不得結案或宣稱 external boundary ready、signed／notarized candidate、實際 CI 或 FR-021 overall 完成。**
- 阻擋問題（若有）：P1 `projectEnvironment()` 對空／缺失 reviewer metadata 可能 false-pass；P1 指定 next4 evidence 無法通過 current validator 且 audit-script SHA 與 current source 不一致；P2 `git status` failure 被默認為 clean；治理 closeout 的 `npm run docs:check:final` 目前 exit 1。
- 剩餘風險：GitHub Environment、required reviewer 實際名單／規則、environment secret scope、protected branch、remote workflow、Apple Silicon runner、Developer ID identity／credential、notarization、實際 CI／Apple artifact、Seatbelt renderer、full-egress、Windows、LM Studio 與 FR-021 overall 均未由本輪驗證；這些是 remote／external acceptance，不得以 local contract 或 next4／next5 bounded observation 擴稱完成。
- 給主要開發代理的具體修正要求（若有）：修正 reviewer rule projection 為要求非空且結構有效的 reviewer metadata，或對不確定 response fail-closed；將 git identity/status subprocess failure 投影為 unavailable 並阻止 ready；新增對應 focused regression；重新產生與 current source／scope schema／hash 一致的 immutable evidence，保留 next4／next5 原件；更新 00／05／06／07／08 的同一 authoritative revision，加入本報告的獨立審查欄位與逐字結論，最後重跑 `npm run docs:check:final`。不得執行 GitHub writes、workflow、signing 或 notarization 來繞過本輪 findings。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、唯讀 GitHub API 查詢、指令執行與驗證，未修改任何其他專案檔案；未改寫 first-run／authoritative evidence，未執行 GitHub writes、workflow、signing 或 notarization。

若上述聲明不實，本報告無效。
