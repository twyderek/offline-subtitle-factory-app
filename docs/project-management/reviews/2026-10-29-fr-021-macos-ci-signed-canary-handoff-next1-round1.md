# 獨立審查報告：FR-021 macOS signed-canary CI handoff next stage

- 審查對象 commit／版本：`c06d15e95a2f0a0981518c5873003a460e57a5ee`、package version `0.52.0`、branch `codex/0.51-anthropic-claude`；工作樹為 dirty，僅審查指定工作項目與其目前 source／文件。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS signed-canary CI handoff next stage（`FR-021-MACOS-CI-20261029-SIGNED-CANARY-HANDOFF-NEXT1`）。
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-29T13:26:45+08:00；獨立審查上下文，先讀 `/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/AGENTS.md`、`docs/project-management/README.md`、00–09 與全部 workflows，並執行 `npm run project:preflight -- --type=full`；未沿用主要開發代理的評價性結論。
- 審查範圍：`.github/workflows/macos-signed-canary.yml`、`05-DEVELOPMENT-AND-DEPLOYMENT.md`、`00-CURRENT-STATUS.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、本輪 08 條目，以及其直接引用的 readiness／gate／post-build scripts、package scripts 與既有 immutable evidence。
- 唯讀限制：未觸發 GitHub workflow，未執行 signing、notarization、keychain、packaged UI、Electron candidate、sandbox／network policy 或外部網路操作；除建立本報告外未修改任何檔案。

## 1. 需求完整性

- 判定：部分通過
- 證據：

  - 需求與工作條目已清楚限定本輪為 dormant、`workflow_dispatch`、Apple Silicon self-hosted runner handoff，且不把 workflow 存在宣稱為 signed／notarized／renderer／offline／Windows 或 FR-021 overall pass（`docs/project-management/08-CHANGE-LOG.md:3-16`、`docs/project-management/00-CURRENT-STATUS.md:3-7`、`docs/project-management/05-DEVELOPMENT-AND-DEPLOYMENT.md:54-60`）。
  - YAML 有 `workflow_dispatch`、`contents: read`、`self-hosted`／`macOS`／`arm64`／`osf-signed-canary` labels、clean checkout、`npm run check`、readiness evidence、builder、`notarytool`、兩次 `stapler`、post-build audit 與 bounded artifact upload（`.github/workflows/macos-signed-canary.yml:3-13,20-49,51-77,79-130`）。
  - 但條目成功條件要求「readiness → signed-canary gate → builder」且文件反覆聲稱 gate 必然先於 builder（`08-CHANGE-LOG.md:9-10`、`05-DEVELOPMENT-AND-DEPLOYMENT.md:58`、`06-TEST-AND-PROCESS-AUDIT.md:5-7`），實際 ready 分支沒有執行獨立 gate；這是需求與實作不一致的阻擋問題，詳見 F-01。

## 2. 邏輯正確性

- 判定：不通過
- 證據：

  - workflow readiness step 在 `.github/workflows/macos-signed-canary.yml:61-67` 只檢查 `e.decision.formalSigningReady === true && e.decision.notarizationCredentialReady === true`；條件成立時直接 `rm` readiness file、`exit 0`，並不執行 `.github/workflows/macos-signed-canary.yml:68-74` 的 `audit-macos-signed-canary-gate.mjs`。
  - 同一 workflow 隨後在 `.github/workflows/macos-signed-canary.yml:79-84` 直接執行 `npm run electron:build:mac:signed-canary`。然而正式 gate 的 `evaluateFormalSignedCanaryReadiness()` 在 `scripts/assert-macos-signed-canary-ready.mjs:89-117` 額外要求 `xcrunNotarytool.commandSucceeded === true`、signed source config、Developer ID identity 與 credential set。
  - readiness classifier 的 `toolchainReady` 只使用 readiness script 的 required set（`scripts/audit-macos-signing-readiness.mjs:540-546,568-575`），required set 不包含 optional `xcrunNotarytool`；因此可構造「readiness `formalSigningReady=true`、三個 Apple secret presence complete、但 `xcrun notarytool` 不可用」的狀態，workflow 會進 builder，違反 gate-before-builder 與 fail-closed 要求。這不是目前本機 blocker 的推測，而是依兩段實際 classifier／workflow 控制流得出的靜態反例。
  - F-01（P1，gate bypass）：ready path 必須無條件執行與 `electron:build:mac:signed-canary` 相同的正式 gate，且只有 gate exit 0 才能進 runtime manifest／builder；readiness audit 只能作 evidence，不能作 gate 替代。修正前不得把 handoff 描述為已固定 fail-closed。

## 3. 邊界情況

- 判定：不通過
- 證據：

  - F-02（P1，secret／source trust boundary 不足）：workflow 使用 `actions/checkout@v5`（`.github/workflows/macos-signed-canary.yml:20-25`），沒有 protected ref／branch assertion、GitHub Environment approval 或 `environment:`；`workflow_dispatch` 可由具備相應 Actions 權限者選取 ref，而 checkout 後的 repo source、`npm ci`、builder hooks 與 scripts 均屬該 ref。三個 repository secrets 在 readiness step（`:51-61`）及 builder step（`:79-84`）被注入環境，代表未受保護的 checked-out source／builder dependency 若被執行，可能讀取 secret。文件所稱「secret 值不得寫入 log／artifact」不能取代「不讓不受信任 source 取得 secret」的邊界。
  - F-03（P1，stale artifact／candidate provenance）：runner 只清查 git checkout（`.github/workflows/macos-signed-canary.yml:27-33,47-49`），沒有清理或建立 run-specific 的 `../dist`；package config 將 output 指向 `../dist`（`package.json:57-58`），而 artifact locator 以 `find ../dist ... -print -quit` 選第一個 `.app`／DMG（workflow `:86-95`）。在 persistent self-hosted runner 上，舊候選或多個同名候選可被選中，再送去 notarize／staple／audit；post-build audit 沒有 workflow run ID 或 builder-produced manifest 來證明候選由本次 builder 產生。
  - F-04（P2，並行／供應鏈與 runner hygiene）：workflow 未設定 `concurrency`、未使用 protected environment，且 `actions/checkout@v5`、`actions/setup-node@v5`、`actions/upload-artifact@v4` 都是 mutable major tag，不是 immutable commit SHA（workflow `:20-25,35-39,123-130`）。另 `git config --global core.autocrlf false`（`:16-18`）會改變 persistent self-hosted runner 的全域 git 設定。這些不等同已洩漏 secret，但會削弱 signed runner 的可控性與可重現性。
  - F-05（P2，post-build evidence 邊界）：workflow 對 app 與 DMG 都執行 `stapler staple`（`:97-112`），但 post-build audit 只接收 `.app`（`:114-121`）；因此 artifact 沒有 DMG staple／Gatekeeper 對應的獨立 bounded result。`xcrun notarytool` 的 JSON stdout 也沒有被轉成去敏、可核對的 submission outcome；目前命令 exit code 足以阻擋失敗，但不足以讓 evidence 完整追溯 app／DMG 兩個輸出。
  - 已確認的正向邊界：目前 gate evidence `docs/project-management/evidence/2026-10-29-fr-021-signed-canary-gate-execution4.json` 為 `0600`、scope 全 false、保存 gate／package／focused-test hashes；readiness next2 `docs/project-management/evidence/2026-10-29-fr-021-prerequisite-readiness-recheck-next2.json` 為 `0600`、`workingTreeDirty=true`、credential presence 全 false、`validIdentityCount=0`。這些支持目前外部 identity blocker，但不修復 workflow ready-path bypass 或 future runner trust boundary。

## 4. 程式碼品質

- 判定：部分通過
- 證據：

  - YAML 以 `js-yaml` 唯讀解析成功，top-level keys 為 `name`、`on`、`permissions`、`jobs`，job `signed-canary` 有 13 steps；靜態 assertions 對 workflow_dispatch、readiness、gate、builder、notarytool、stapler、post-audit 與 blocked message 均通過。
  - source-level gate 與 post-build audit 本身採 fixed allowlist／去敏欄位、exclusive evidence 與 0600；`scripts/audit-macos-signed-canary-gate.mjs:58-75,94-139` 與 `scripts/audit-macos-signed-canary-result.mjs` 的 schema／cross-field checks 支持其 bounded contract 品質。
  - 但 workflow orchestration 的控制流分裂成 readiness-only success 與 gate-only failure branches，造成已知 gate contract 沒有被所有 builder entry paths 強制使用；這是整合品質問題，不是 YAML syntax 問題。`find ../dist -print -quit`、mutable action refs、builder step secret env 也使 CI handoff 的安全假設依賴 runner 管理者自律，而非 workflow 自身的可驗證約束。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：

  - 2026-10-29T13:26:45+08:00 前後執行 `npm run project:preflight -- --type=full`，exit 0；固定核心、full route 與 AGENTS 規則已讀。
  - 執行 `node scripts/test-macos-signing-readiness.mjs`、`node scripts/test-macos-signed-canary-gate.mjs`、`node scripts/test-macos-signed-canary-result.mjs`，三者均 exit 0，分別輸出 readiness privacy／provenance fail-closed matrix、gate identity／toolchain／source／credential matrix、post-build inventory／Developer ID／runtime／entitlements／staple／Gatekeeper matrix 通過。
  - 執行 YAML structural parse、workflow static assertions、`npm run check` 與 `git diff --check`；YAML／static assertions 通過，完整 `npm run check` exit 0（`docs:check`、syntax、完整 `npm test`、YouTube posttest 均通過），`git diff --check` exit 0。完整 check 未觸發 workflow、signing、notarization、keychain 或 packaged UI；YouTube transport test output 亦明示 no network。
  - 測試缺口與 F-01 直接相關：目前 focused gate test 測的是 gate classifier，沒有 workflow-level fixture／static regression 斷言「即使 readiness audit ready，仍必須呼叫 gate 且 `notarytool` 缺失不得進 builder」。也沒有測試 persistent `../dist` stale candidate、protected ref／environment、secret non-injection into builder、action SHA pinning 或 DMG result evidence。
  - 執行 `npm run docs:check:final`，exit 1；輸出為最新工作紀錄缺少「獨立審查是否執行」「發布授權」、尚未標示「完成」，且審查欄位不是是／否。這是本輪治理 closeout blocker，不能由 `npm run check` 的綠燈抵銷。

## 6. 實際運行結果

- 判定：部分通過
- 證據：

  - 實際本機狀態仍為 `security find-identity -v -p codesigning`：0 valid identities；本輪沒有 Apple Developer ID identity／notarization credential 可供 workflow 實跑。因此沒有 signed candidate、notarization、staple、Gatekeeper 或 runner execution evidence 可宣稱成功；這與 `00-CURRENT-STATUS.md:5-7`、`05-DEVELOPMENT-AND-DEPLOYMENT.md:59-60` 的未觸發揭露一致。
  - 既有 gate execution4 與 readiness next2 的唯讀 `stat` 均為 `-rw-------`；next2 內容顯示 `workingTreeDirty=true`、`validIdentityCount=0`、credential flags 全 false、scope 全 false。這證明目前本機 blocker 與 evidence privacy，不證明 future workflow orchestration。
  - 本輪只實際執行 local static／deterministic checks；沒有把 YAML parse 或 `npm run check` 誤寫成 GitHub runner、builder、notarytool、stapler、post-build audit 或 packaged UI 實測。因為 workflow 尚未被觸發，runner label、protected source ref、secret handling、candidate selection 與 external notarization 均待外部環境驗證。

## 綜合判定

- 結論：不通過
- findings：
  - F-01（P1）：readiness audit 的 ready path 在 `.github/workflows/macos-signed-canary.yml:64-67` 直接放行至 builder，未強制執行正式 signed-canary gate；`xcrun notarytool` 缺失時可違反 gate-before-builder。這是本輪最高優先阻擋。
  - F-02（P1）：沒有 protected ref／GitHub Environment／review gate；secrets 進入 readiness 與 builder，未受信 source／builder hook 可取得它們，與「受控 secret contract」不相稱。
  - F-03（P1）：persistent self-hosted runner 的 `../dist` 未清理、candidate locator 使用 first-match，可能 notarize／audit stale artifact，source／run provenance 不足。
  - F-04（P2）：actions 未 pin immutable SHA，缺少 concurrency／runner hygiene；signed workflow 的供應鏈與可重現性風險未被 workflow 自身約束。
  - F-05（P2）：post-build evidence 只審 app，不對 DMG 提供獨立 staple／Gatekeeper／notarization bounded result；workflow-wide secret／network activity 與 pre-build evidence scope 也未清楚分層。
- 阻擋問題（若有）：F-01、F-02、F-03；修正並由後續 round2 重新審查前，不得將本工作項目判為通過或結案，也不得把目前 YAML／文件存在宣稱成 signed／notarized candidate 或 FR-021 completion。
- 剩餘風險：即使上述 CI contract 修正，仍需要受保護的 Apple Silicon runner、有效 Developer ID Application identity／entitlements、完整 notarization credential、實際 signed builder、notarytool、stapler、post-build audit、Gatekeeper 與 packaged renderer／offline／Windows evidence；目前 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、true full-egress、LM Studio policy exclusion 與 FR-021 overall residual risks 不因本輪 workflow 存在而解除。
- 給主要開發代理的具體修正要求（若有）：(1) 將 `assert-macos-signed-canary-ready.mjs` 作為 workflow builder 前唯一 gate，或讓 readiness audit 與正式 gate 使用完全相同、可驗證的 readiness contract，並補 workflow-level regression；(2) 加 protected branch/ref assertion、GitHub Environment required reviewers／scoped secrets，builder step 移除不必要的 Apple secrets；(3) 使用每次 run 的隔離輸出目錄或清理後的 exact artifact manifest，禁止 `find ... -print -quit` 選 stale artifact；(4) pin action commit SHA、設定 concurrency／runner isolation；(5) 補 app／DMG 對應的去敏 post-build evidence、submission result classification 與 workflow-wide scope/provenance；(6) 修正 08 條目治理欄位後再由 round2 審查，並重新執行 `npm run docs:check:final`。
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-CI-20261029-SIGNED-CANARY-HANDOFF-NEXT1` round1 獨立審查不通過：YAML 結構、readiness／gate／post-build deterministic contracts、focused tests、完整 `npm run check` 與 `git diff --check` 均通過，且目前文件如實揭露 workflow 未觸發與 external identity blocker；但 ready path 在 readiness audit 通過時跳過正式 signed-canary gate，self-hosted workflow 沒有 protected ref／environment／secret isolation，persistent `../dist` 可選取 stale candidate，action refs 未 pin immutable SHA，且 post-build evidence 未完整核對 DMG／workflow-wide provenance，故尚不得宣稱本 handoff 已 fail-closed、signed／notarized candidate 已建立、或 FR-021 overall 已完成；修正 F-01～F-03 並完成 round2 與治理 closeout 前不得結案。**
- 本輪條件是否已被需求方接受：否；本次指示要求獨立審查與報告，未明確接受上述阻擋條件或授權以目前缺口結案。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
