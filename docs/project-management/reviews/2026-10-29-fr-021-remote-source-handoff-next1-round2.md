# 獨立審查報告：FR-021 remote source handoff

- 審查對象：目前 index 的 allowlist-only staged tree；基準 `HEAD` 為 `c06d15e95a2f0a0981518c5873003a460e57a5ee`，package version `0.52.0`，尚未建立 commit。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS signed-canary remote source handoff next stage（`FR-021-MACOS-CI-20261029-REMOTE-SOURCE-HANDOFF-NEXT1`）。
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-10-29T14:47:49+08:00（Asia/Taipei）；獨立上下文，先讀 `AGENTS.md`、`docs/project-management/README.md`、preflight `full` 路由文件、`08-CHANGE-LOG.md` 範本／最新條目及 round1 report；未沿用主要開發代理的評價性結論。
- 審查限制：只審查 index staged handoff，不把 dirty worktree 當交付內容；除建立本報告外未修改任何專案檔案，未 stage、commit、push、建立 GitHub 資源或觸發 workflow。

## 1. Scope／allowlist purity

- 判定：通過。
- `git diff --cached --name-only` 與需求指定的 23 paths 精確相等；未發現 unrelated staged path。dirty worktree 的治理文件、AI／Ollama／UI 變更、未追蹤 evidence／reviews 均未納入 index。
- `git diff --cached --check`：exit 0。
- 三個 staged evidence 在目前工作樹均為 0600；但 Git index 記錄為 mode 100644，0600 不會隨 checkout 保留。內容檢查未見 secret value、token 或 absolute path，因此這是隱私契約的注意事項，不是本節阻擋項。

## 2. Dependency closure

- 判定：通過。
- staged `.mjs` 的相對 import closure 已逐一解析；所有直接依賴不是同一 allowlist 的，均可由 `HEAD` 的既有 tracked source 提供。`package.json` 的新增 `check`／`test` references 也都能在 staged tree 或 `HEAD` 找到；`package-lock.json` 未因 script-only 變更而需要更新。
- `electron-builder.signed-canary.mjs` → signed build config、readiness／gate／result scripts → 其 shared modules 的 closure 完整；workflow 所呼叫的 readiness、formal gate、artifact selector、distribution audit、result audit 也均在 allowlist。
- `scripts/write-runtime-manifest.mjs`、`scripts/verify-runtime-package.mjs`、`scripts/after-pack.cjs` 等 builder 依賴是既有 `HEAD` tracked source，並非未納入的本輪必要修改；不應因 dirty worktree 中其他版本變更而擴大本輪 allowlist。

## 3. Workflow／source contract

- 判定：部分通過；有一項 P1 與兩項 P2 需修正。
- round1 的 formal-gate bypass 已修正：`.github/workflows/macos-signed-canary.yml:56-86` 在 readiness evidence 後無論 readiness 結果如何都執行 `assert-macos-signed-canary-ready.mjs`，只有 exit 0 才離開該 step 進入 `.github/workflows/macos-signed-canary.yml:88-105` 的 isolated builder；run-scoped output、concurrency、immutable action SHA、direct-child artifact selector 也都存在。

### F-02 — P1 — protected ref 狀態沒有由 workflow fail-closed enforce（需要修正）

- 證據：`.github/workflows/macos-signed-canary.yml:29-38` 只驗證 `workflow_dispatch`、固定 branch name、Darwin／arm64 與 clean checkout；沒有驗證 `github.ref_protected`／`GITHUB_REF_PROTECTED`，也沒有等價的 protected-ref assertion。
- 影響：workflow 在 source／builder／notary steps 注入 Apple secrets（`.github/workflows/macos-signed-canary.yml:56-61,100-105,119-149`）。若 remote branch protection 或 Environment required reviewers 的外部設定遺漏，固定 branch name 本身不能阻止未受保護 source 取得 secrets。
- 修正要求：在取得或使用 secrets 前加入實際 protected-ref assertion，並把 Environment required reviewer／deployment branch policy 的外部核驗作為 dispatch 前必要條件；若刻意完全依賴外部設定，至少要在 source contract 與執行前 gate 明確 fail-closed，不能只以 branch name 稱為 protected ref。

### F-03 — P2 — result evidence 留在 repository checkout（需要修正）

- 證據：`.github/workflows/macos-signed-canary.yml:190-197` 將 `ci-${GITHUB_RUN_ID}-macos-signed-canary-result.json` 寫入 repository、複製到 `$RUNNER_TEMP`，但最後 `.github/workflows/macos-signed-canary.yml:208-220` 只清理 notary files 與 run-scoped dist，沒有移除 result evidence。
- 影響：self-hosted runner 的 checkout 會在 run 結束後留下本輪暫存 evidence；即使內容是 bounded，這仍違反 workflow 自己宣稱的 repository temp cleanup contract，並讓後續 runner hygiene 依賴下一次 checkout 的清理行為。
- 修正要求：result step 使用 owner-only cleanup trap，或在成功複製後由 final `always()` cleanup 明確移除該 run-scoped result path；補 workflow-level regression assertion。

### F-04 — P2 — ZIP target 被建立但未納入 distribution verification（需要修正或明確限縮 scope）

- 證據：`package.json:172-193` 的 signed canary config 保留 `dmg` 與 `zip` arm64 targets；selector 只選 `.github/workflows/macos-signed-canary.yml:107-117` 的主 `.app` 與 DMG，notary／staple／distribution audit 也只處理 DMG（`:119-188`）。
- 影響：builder 產生的 ZIP 不會取得本輪 notarization／staple／archive／digest evidence。若 signed-canary 的驗收範圍包含 config 宣稱的全部 macOS targets，這是未覆蓋的 artifact boundary；若本輪刻意只驗 DMG，則目前 source／文件應明確把 ZIP 排除，而非同時宣稱有效 ZIP target contract。
- 修正要求：二選一：加入 ZIP 的選取、簽章／notary／digest evidence；或將 canary target 明確限縮為 DMG／dir 並同步 source contract 與 focused tests。

## 4. Test／provenance／reproducibility

- 判定：不通過；有一項 P1、兩項 P2。
- 本輪實際執行（2026-10-29T14:47:49+08:00 前後）：`node scripts/test-macos-signing-readiness.mjs`、`node scripts/test-macos-signed-canary-gate.mjs`、`node scripts/test-macos-signed-canary-result.mjs`、`node scripts/test-macos-signed-canary-distribution.mjs`、`node scripts/test-macos-signed-canary-external-boundary.mjs`，以及 `git diff --cached --check`，全部 exit 0。測試涵蓋 schema、privacy、identity／toolchain／credential negative matrix、artifact cardinality、notary DMG hash binding、stapler／archive failure、external response projection 與 exclusive writer。
- 需求方提供的 clean staged-tree verification 也記錄 syntax／YAML／docs check／focused tests／完整 `npm run check` 通過；完整 check 需要主 worktree 的 ignored `tools/whisper-cpp`／`tools/whisper-models` runtime fixtures。此條件依指示列為 residual，不誤報為純 checkout 完全自足。

### F-01 — P1 — staged authoritative readiness evidence 的 package provenance 已過期（需要修正）

- 證據：`docs/project-management/evidence/2026-10-29-fr-021-prerequisite-readiness-recheck-next2.json:21-28` 記錄 `packageJsonSha256=0980d896c417828d08f17a5ca1399f682c5bc440bf20e2849839d766466ed79a`。對目前 index／working file `package.json` 執行 `shasum -a 256` 得 `d93d656587e8d2f0252b3be79531a02adb68fa5d5664ea9beea221e227992454`；`git show :package.json | shasum -a 256` 相同，故不是只讀 staged／working tree 的誤差。audit script 與 focused test hashes 相符，但 package hash 不符。
- `node scripts/test-macos-signing-readiness.mjs` 仍 exit 0，因 `validateReadinessEvidence()`（`scripts/audit-macos-signing-readiness.mjs:615-647`）只驗 evidence schema／derived fields，沒有把 evidence 的 package hash 與目前 staged source 綁定；因此現有 focused test 沒有捕捉這個 provenance drift。
- 影響：allowlist handoff 會攜帶一份聲稱 `audit-script-package-json-focused-test` 的 evidence，但其 package provenance 不是本輪可交付 index。這削弱 clean checkout 的可重現性與 evidence trust root，即使目前 identity／credential 狀態本身仍正確。
- 修正要求：不要覆寫 immutable next2；應在最終 staged source 固定後重產新的 authoritative evidence，或讓 validator 明確驗證 evidence hash 對應的 source revision／manifest，並補 package hash mismatch negative fixture。修正前不得把 next2 當作 current-source authoritative provenance。

### F-05 — P2 — malformed candidate 可能讓 post-build audit 在產生 bounded evidence 前直接 throw（需要修正）

- 證據：`scripts/audit-macos-signed-canary-result.mjs:273-280` 將可能為 `null` 的 `CFBundleExecutable` 直接傳入 `path.join()`，`:309-312` 又無條件 hash 該 executable；相同模式也出現在 staged `scripts/audit-macos-packaged-security-identity.mjs:118-123,134-140`。對缺少／非法 `Info.plist` executable 的 candidate，流程會在 schema writer 前中止，而不是產出 `status: fail` 的 immutable result。
- 影響：workflow 能以非零退出停止，但沒有可上傳的 post-build failure evidence；focused result tests 只驗 serialized fixture schema，未覆蓋 malformed bundle／missing executable。
- 修正要求：先驗證 executable name／path，將 missing metadata 投影為 null／固定 reason，仍以 exclusive 0600 writer 產出 fail evidence；補 malformed bundle fixture。

## 5. Privacy／secret safety

- 判定：部分通過；有一項 P2 需修正，另有 mode residual。
- 正向證據：readiness／gate／distribution／result／external-boundary contracts 只保存 boolean、分類、digest、固定 metadata；focused tests 通過 secret redaction、absolute-path rejection、raw output non-persistence、scope all-false 與 external `secretValuesRead=false` cases。staged readiness evidence 明確記錄 11 個 credential presence flags 全 false（`...next2.json:90-99`），identity `validIdentityCount=0` 且未保存 identity name/hash（`:66-78`、`:182-186`）。

### F-06 — P2 — app-specific password 直接進入 notarytool process argv（需要修正或明確接受風險）

- 證據：`.github/workflows/macos-signed-canary.yml:144-149` 使用 `--password "$APPLE_APP_SPECIFIC_PASSWORD"`。即使 GitHub log masking 不輸出該值，password 仍會以 process argument 存在於 self-hosted runner 的 process table／診斷邊界。
- 影響：persistent／shared runner 上的其他 process 或 runner diagnostic 可能觀察到 credential；這超過「不寫入 repo／artifact／log」的狹義保證。
- 修正要求：優先使用預先配置且受 Environment 保護的 notarytool keychain profile（不在 command argv 傳 password），或由需求方明確接受受控 runner process-argv 風險並將其寫入治理 residual；不得把目前 secret masking 當成 process isolation。
- 注意：三份 tracked evidence 在 Git index 中是 100644，不能依賴工作樹的 0600 mode 保護；本次檢查確認其內容未含 secret value，因此為額外 privacy residual，不單獨阻擋。

## 6. Governance／release boundary

- 判定：不通過／尚不可結案。
- 這是 source-only handoff，不是 release、沒有建立 candidate／asset／GitHub Release，因此本輪不適用 `AUTH-2026-07-23-01` 作為發布授權，也沒有把該授權擴張成 workflow 執行或 remote write 授權。
- staged readiness evidence 明確為 `blocked-external-signing-identity`、`notarizationCredentialReady=false`、`formalSigningReady=false`（`...next2.json:162-170`）；沒有實際 signed builder、notarytool、stapler、Gatekeeper、runner 或 packaged UI execution evidence。這些是交接後的外部前置條件，不能改寫為 source handoff pass。
- 目前專案 context 已記錄 remote Environment、environment secret metadata、branch protection、remote workflow 尚未完成／可見；這些不在本輪 staged allowlist，不能由本報告代替建立或核准。source handoff 若要可執行，至少須先完成外部 reviewer／secret／protected-ref 核驗與 F-02 的 source guard。
- 依本輪指示未修改 `08-CHANGE-LOG.md`。因此在目前 dirty worktree 執行 `npm run docs:check:final` 得 exit 1，具體為最新工作紀錄缺少「獨立審查是否執行」「發布授權」、尚未標示「完成」及審查欄位非是／否；這是治理 closeout residual，不把它誤算成 staged path purity 問題。

## 綜合判定

- 結論：**不通過**。
- 阻擋問題：
  - F-01（P1）staged authoritative readiness evidence 與目前 index 的 `package.json` provenance mismatch。
  - F-02（P1）workflow 沒有驗證 ref 實際受保護，卻在多個 step 注入 Apple secrets；外部 Environment／branch protection 目前也尚未由本輪 source handoff 建立或核驗。
- 非阻擋但需在宣稱完整 signed-canary contract 前處理：F-03 result evidence cleanup、F-04 ZIP scope、F-05 malformed candidate bounded failure、F-06 process argv secret exposure。
- 已確認的正向結果：allowlist purity、staged dependency closure、`git diff --cached --check`、focused contracts、immutable action SHA、concurrency、formal gate-before-builder、run-scoped output 與 DMG artifact cardinality contract 均成立；round1 的主要 technical findings 已有實質修正，但尚不足以升級為通過。
- 剩餘風險：目前本機沒有 Developer ID Application identity／notarization credential；沒有實際 CI、signing、notarization、staple、Gatekeeper、renderer、offline、全機 egress、Windows 或 FR-021 overall evidence。純 checkout 的完整 check 仍依賴不追蹤 binary fixtures，依指示保留為明確 residual。
- 給主要開發代理的修正順序：先以最終 index source 重產或重新綁定 readiness evidence 並補 hash-mismatch regression；加入 protected-ref fail-closed guard；再補 result cleanup、ZIP scope、malformed candidate evidence 與 notary credential argv handling。修正影響本結論時，應保留本報告並建立下一輪獨立複審，不覆寫本檔。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案；未 stage、commit、push 或建立 GitHub 資源。
- 若上述聲明不實，本報告無效。
