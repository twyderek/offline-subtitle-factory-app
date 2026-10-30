# 獨立 closeout 複審報告：FR-021 macOS signed-canary CI handoff next stage

- 審查對象 commit／版本：`c06d15e95a2f0a0981518c5873003a460e57a5ee`、package version `0.52.0`、branch `codex/0.51-anthropic-claude`；工作樹為 dirty，保留既有使用者修改與 round1／round2／round3 原件。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS signed-canary CI handoff next stage（`FR-021-MACOS-CI-20261029-SIGNED-CANARY-HANDOFF-NEXT1`）。
- 審查輪次：round4 closeout 複審
- 審查代理啟動時間、上下文來源：2026-10-29T13:36:21+08:00；獨立唯讀複審上下文，讀取 round1／round2／round3 reports、目前已標示完成的 08 entry、workflow、source、focused tests、相關治理文件，並重新執行 preflight／local deterministic checks；未沿用主要代理的評價性結論。
- 審查範圍：`docs/project-management/reviews/2026-10-29-fr-021-macos-ci-signed-canary-handoff-next1-round1.md`、`round2.md`、`round3.md`、`docs/project-management/08-CHANGE-LOG.md`、`.github/workflows/macos-signed-canary.yml`、`scripts/assert-macos-signed-canary-ready.mjs`、`scripts/test-macos-signed-canary-gate.mjs`、`scripts/test-macos-signed-canary-result.mjs`、`lib/macos-signed-canary-build-config.mjs`、`electron-builder.signed-canary.mjs`、`package.json`、05／06／07 治理文件。
- 唯讀限制：未觸發 workflow，未執行 signing、notarization、keychain、packaged UI、Electron candidate、DMG 實機流程、sandbox／network policy 或外部網路操作；除建立本報告外未修改任何其他檔案。

## 1. 需求完整性

- 判定：部分通過（有條件通過）
- 證據：

  - 08 entry 已標示 `狀態：完成`，並把本輪工作界線限定為 dormant、`workflow_dispatch`、protected current ref、`macos-signed-canary` environment、Apple Silicon runner 與 source/local handoff contract；同一 entry 明確保留未觸發 workflow、未建立 signed／notarized candidate 與 FR-021 overall residual（`docs/project-management/08-CHANGE-LOG.md:3-16,23-32`）。
  - round1／round2／round3 原件均存在且未覆寫；round3 已記錄 F-03A direct-child locator 修正，以及 Environment reviewer／secret scope、DMG evidence schema、未觸發 workflow、nested-helper fixture integration proof residual（`docs/project-management/reviews/2026-10-29-fr-021-macos-ci-signed-canary-handoff-next1-round3.md:1-14,68-92`）。
  - round4 的 bounded closeout 範圍與 08 的已接受界線一致：只結案 source/local deterministic handoff contract，不把未執行項目寫成 pass。

## 2. 邏輯正確性

- 判定：部分通過（有條件通過）
- 證據：

  - F-03A 已修正：workflow 只遍歷 `"$OSF_SIGNED_CANARY_OUTPUT_DIR"/mac-arm64/*.app` 的直接子項（`.github/workflows/macos-signed-canary.yml:107-130`），不遞迴主 `.app` 內的 Electron Helper.app；app 必須恰好一個，DMG 必須是 output root 的唯一 `*-macos-arm64.dmg`。
  - formal gate-before-builder 成立：readiness evidence 後無條件執行 `node scripts/assert-macos-signed-canary-ready.mjs`，只有 gate exit 0 才離開該 step 並進入 output preparation／builder（`.github/workflows/macos-signed-canary.yml:56-86`）；package script 亦以同一 formal gate 先於 runtime manifest／verify／`electron-builder`（`package.json:44-45`）。
  - protected-ref／environment declaration 成立為 source contract：workflow 僅接受 `workflow_dispatch` 與 `refs/heads/codex/0.51-anthropic-claude`，runner 必須為 Darwin arm64 且 clean checkout，job 宣告 `macos-signed-canary` environment（`.github/workflows/macos-signed-canary.yml:3-19,29-38`）。
  - immutable actions／concurrency 成立：checkout、setup-node、upload-artifact 均使用 40-hex commit SHA，`concurrency` 以 ref 分組且 `cancel-in-progress: false`（`.github/workflows/macos-signed-canary.yml:6-11,22-23,40-44,167-174`）。
  - out-of-tree run-scoped output 成立：output 位於 `$RUNNER_TEMP/osf-signed-canary-dist-$GITHUB_RUN_ID`，既存即 fail，build config 拒絕相對路徑與 source tree 內路徑（`.github/workflows/macos-signed-canary.yml:88-98`、`lib/macos-signed-canary-build-config.mjs:12-22`）。

## 3. 邊界情況

- 判定：部分通過
- 證據：

  - DMG fail-closed sequence 成立為 source contract：唯一 DMG locator 後，`notarytool submit --wait --output-format json` 成功才繼續；app／DMG 均 staple，DMG 再執行 `xcrun stapler validate` 與 `hdiutil verify`，各命令在 `set -euo pipefail` 下失敗即停止（`.github/workflows/macos-signed-canary.yml:134-156`）。
  - 不把 source contract 擴稱為遠端 trust boundary：YAML 宣告 `macos-signed-canary` environment 並引用 `OSF_APPLE_ID`、`OSF_APPLE_APP_SPECIFIC_PASSWORD`、`OSF_APPLE_TEAM_ID`，但本輪沒有 GitHub Environment required reviewer、protected branch 遠端設定或 environment-scoped secret scope 的外部證據（`.github/workflows/macos-signed-canary.yml:17-18,56-61,100-105`；`docs/project-management/05-DEVELOPMENT-AND-DEPLOYMENT.md:54-62`）。
  - round3 的 P2 residual 如實保留：workflow 尚未把 app／DMG notarization、staple、`hdiutil verify` 結果投影為完整對應的去敏 DMG evidence leaf；本輪只確認 fail-closed command sequence，沒有實跑結果。
  - nested-helper focused regression 仍是 source-pattern guard，不是含主 app 與四個 nested Helper.app 的實際 filesystem fixture integration proof；本輪不把它擴寫為 integration pass。

## 4. 程式碼品質

- 判定：部分通過（有條件通過）
- 證據：

  - round1／round2 所指出的 gate bypass、persistent stale `../dist` candidate 與 recursive helper counting 已在目前 source-level contract 收斂；責任分界清楚：readiness evidence 先分類，formal gate 決定是否可建置，builder 使用隔離 output，locator 再做唯一性檢查。
  - `loadSignedCanaryBuildConfig()` 固定 `hardenedRuntime: true`、`gatekeeperAssess: true`，移除 base config 的 identity override，並以 absolute、source-tree 外 output boundary fail-closed（`lib/macos-signed-canary-build-config.mjs:4-23`）。
  - cleanup 只接受 exact expected run-scoped path，未對不明路徑執行 recursive delete（`.github/workflows/macos-signed-canary.yml:176-184`）。
  - 尚未以實際 GitHub runner、Environment approval、Apple identity／entitlements、notarytool 或 DMG post-build evidence 驗證上述合約；這些保留為 operational／external residual，不降低本輪對 source contract 的 bounded 判定。

## 5. 測試覆蓋

- 判定：部分通過（有條件通過）
- 證據：

  - 本輪 `npm run project:preflight -- --type=full` exit 0；`node scripts/test-macos-signed-canary-gate.mjs` exit 0；`node scripts/test-macos-signed-canary-result.mjs` exit 0；相關 `node --check`、完整 `npm run check` 與 `git diff --check` 均 exit 0。
  - focused gate test 明確要求 `mac-arm64/*.app` direct-child glob 並拒絕 recursive `find ... -name '*.app'` pattern，亦覆蓋 absolute／source-tree output boundary 與 readiness fail-closed matrix（`scripts/test-macos-signed-canary-gate.mjs:135-145`）。
  - result test 覆蓋 inventory、Developer ID、runtime、entitlements、stapler、Gatekeeper 與 evidence schema 的 fail-closed cases；本輪只執行 deterministic test，未宣稱實際 Apple result（`scripts/test-macos-signed-canary-result.mjs:1-220`）。
  - `npm run docs:check:final` 本輪目前 exit 1，輸出為「最新一輪獨立審查結論為不通過」；原因是目前最新 review 仍為 round3，尚未由主要代理把本 round4 報告與 conditional conclusion 回填 08。這是待主要代理完成 closeout linkage 後可再驗證的治理 gate，不是 source／test contract 失敗。

## 6. 實際運行結果

- 判定：部分通過
- 證據：

  - 本輪只執行 preflight、讀取與 local deterministic checks；focused／full checks 通過，未觸發 GitHub workflow，未執行 `electron-builder`、`codesign`、`notarytool`、`stapler`、`spctl`、`hdiutil`、packaged UI 或外部網路。
  - 本輪沒有 signed／hardened candidate、notarization、staple、Gatekeeper、DMG verification、renderer/offline UI、Windows 或 FR-021 overall acceptance evidence；未執行項目維持未執行，不當作 pass。
  - 目前 readiness／環境 residual 與 round3 一致：GitHub Environment required reviewer／secret scope、protected branch 的實際遠端設定、Apple Silicon runner、Developer ID identity／entitlements、notarytool、stapler、Gatekeeper、DMG evidence schema 與 nested-helper fixture integration proof 均尚待外部或更強測試；本機 `0 valid identities`／credential absent、Seatbelt renderer、全機 egress、Windows、LM Studio policy exclusion 與 FR-021 overall residual 不因本 handoff 改變。

## 綜合判定

- 結論：有條件通過（conditional pass）
- 阻擋問題（若有）：
  - 治理 closeout 尚需主要代理把本 round4 report、以下逐字結論句與條件接受回填 `08-CHANGE-LOG.md`，再重跑 `npm run docs:check:final`；目前 final gate 因 round3「不通過」而 exit 1。
  - 外部 Environment required reviewer／secret scope、protected ref 實際遠端設定、signed／notarized candidate、實際 workflow、DMG evidence schema、renderer/offline、Windows 與 FR-021 overall 仍未驗收；這些不是本輪可解除的 source/local contract 條件。
- round3 residual 是否如實揭露：是。round3 列出的 Environment reviewer／secret scope 外部核驗、DMG evidence schema、未觸發 workflow、nested-helper fixture integration proof 與 FR-021 overall residual 均在本報告保留，未改寫為 pass。
- 本輪結案範圍：只結案 source/local deterministic handoff contract：F-03A direct-child app locator、formal gate-before-builder、protected-ref／environment declaration、immutable action SHA、concurrency、out-of-tree run-scoped output、direct-child app／DMG cardinality 與 DMG fail-closed command sequence；不結案外部設定或任何 runtime／release acceptance。
- 本輪條件是否已被需求方接受：待主要代理依本報告完成 08 closeout linkage；可接受的條件邊界是只結案上述 bounded source/local contract，並保留全部外部／P2 residual。
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-CI-20261029-SIGNED-CANARY-HANDOFF-NEXT1` round4 獨立 closeout 複審結論為有條件通過：目前 source／local deterministic checks 確認 F-03A direct-child app locator、formal gate-before-builder、protected-ref／environment declaration、immutable action SHA、concurrency、out-of-tree run-scoped output、direct-child app／DMG cardinality 與 DMG fail-closed command sequence 均成立；本輪只結案上述 bounded source/local handoff contract，並如實保留 Environment reviewer／secret scope 外部核驗、DMG evidence schema、nested-helper fixture integration proof、未執行 workflow、signed／notarized candidate、renderer/offline、Windows 與 FR-021 overall residual，不宣稱任何未執行項目為 pass，待主要代理將本報告與本句回填已標示完成的 08 entry 後重跑 `npm run docs:check:final`。**
- 剩餘風險：本輪沒有 Apple Silicon runner、Developer ID identity／entitlements、notarytool／stapler／Gatekeeper／DMG 實跑或完整 app／DMG evidence；Environment reviewer／secret scope 與 protected ref 仍無外部證據；source-pattern test 尚非 nested-helper filesystem fixture integration；Seatbelt `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false`、true full-egress、Windows、LM Studio policy exclusion 與 FR-021 overall 均維持。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
