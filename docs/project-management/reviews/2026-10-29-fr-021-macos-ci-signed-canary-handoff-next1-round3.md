# 獨立複審報告：FR-021 macOS signed-canary CI handoff next stage

- 審查對象 commit／版本：`c06d15e95a2f0a0981518c5873003a460e57a5ee`、package version `0.52.0`、branch `codex/0.51-anthropic-claude`；工作樹為 dirty，保留 round1／round2 原件與既有使用者修改。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS signed-canary CI handoff next stage（`FR-021-MACOS-CI-20261029-SIGNED-CANARY-HANDOFF-NEXT1`）。
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-10-29T13:34:04+08:00；獨立唯讀複審上下文，先讀 round1／round2 reports，再讀目前 `.github/workflows/macos-signed-canary.yml`、package script、signed-canary build config、focused tests、05／06／07／08 相關內容；未沿用主要代理的評價性結論。
- 審查範圍：round1／round2 reports、`.github/workflows/macos-signed-canary.yml`、`scripts/assert-macos-signed-canary-ready.mjs`、`scripts/test-macos-signed-canary-gate.mjs`、`lib/macos-signed-canary-build-config.mjs`、`electron-builder.signed-canary.mjs`、`package.json`、05／06／07／08 治理文件及目前 residual。
- 唯讀限制：只執行 preflight、source／YAML／focused／full checks、治理 final check、`git diff --check` 與讀取／列舉；未觸發 workflow，未執行 signing、notarization、keychain、packaged UI、Electron candidate、sandbox／network policy 或外部網路操作。本報告是本輪唯一新增檔案。

## 1. 需求完整性

- 判定：部分通過
- 證據：

  - round2 F-03A 的核心修正已落到目前 workflow：`.github/workflows/macos-signed-canary.yml:113-117` 只遍歷 `"$OSF_SIGNED_CANARY_OUTPUT_DIR"/mac-arm64/*.app` 的直接子項；已移除 round2 指出的遞迴 `find ... -type d -name '*.app'`。因此主 `.app` 內的 nested `Helper.app`、`Helper (GPU).app`、`Helper (Plugin).app`、`Helper (Renderer).app` 不會被 artifact cardinality loop 計入。
  - app／DMG cardinality 仍為 fail-closed：直接子項 app 必須恰好一個，output root 的 `*-macos-arm64.dmg` 必須恰好一個（`:119-130`）。這符合本輪要求的 run-scoped output、`mac-arm64` direct-child main app locator 邊界。
  - round1 F-01／F-02／F-03 的 source-level 修正仍存在：readiness 後無條件執行正式 gate、protected current ref assertion、`macos-signed-canary` environment、immutable action SHA、concurrency、run-scoped out-of-tree output 與 exact cleanup 均可觀測。
  - 08 最新工作條目仍為「進行中」，尚未新增本 round3 的審查檔案、完整結論引用、審查欄位及 closeout；`npm run docs:check:final` 仍失敗。這是本輪治理 closeout blocker，而不是 F-03A source 修正失敗。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：

  - F-03A 技術判定：已修正。direct-child glob 的搜尋根固定在 run-scoped output 的 `mac-arm64` 目錄，nested helper bundles 不會進入 `app_count`；多個 top-level `.app` 或缺少 top-level `.app` 仍會使 `test "$app_count" = 1` 失敗，保持 fail-closed。
  - focused gate regression 已成立為 source-level guard：`scripts/test-macos-signed-canary-gate.mjs:142-144` 要求 workflow 存在 `mac-arm64/*.app` direct-child loop，並拒絕原本的 recursive `find ... -name '*.app'` pattern。這能防止 round2 的遞迴 locator 回歸；但它是文字／控制流回歸，不是建立含 nested Helper.app 的實際 filesystem fixture，因此尚不能宣稱已完成 runtime artifact-discovery integration proof。
  - gate-before-builder 已成立：workflow readiness step 在 `.github/workflows/macos-signed-canary.yml:69-86` 執行 `assert-macos-signed-canary-ready.mjs`，只有 exit 0 才離開並進入 builder；package `electron:build:mac:signed-canary` 也以相同正式 gate 開頭，接著才執行 runtime manifest／verify 與 `electron-builder`。
  - protected ref／environment／action SHA／concurrency 已成立為 source contract：`:29-38` exact-checks `workflow_dispatch`、`refs/heads/codex/0.51-anthropic-claude`、Darwin／arm64／clean checkout；`:17-18` 宣告 `macos-signed-canary` environment；`:9-11` 宣告同 ref concurrency 且不取消進行中執行；checkout／setup-node／upload-artifact 均為 40-hex commit SHA。
  - out-of-tree output override 已成立：`:92-98` 將 output 放在 `$RUNNER_TEMP/osf-signed-canary-dist-$GITHUB_RUN_ID`，既存即失敗；`loadSignedCanaryBuildConfig()` 對 absolute path 與 source-tree 內 path fail-closed，且 cleanup 只接受 exact expected path。

## 3. 邊界情況

- 判定：部分通過
- 證據：

  - Environment required reviewer 與 environment-secret scope 仍是外部 residual。YAML 只宣告 `environment.name` 並引用 `secrets.OSF_APPLE_ID`、`OSF_APPLE_APP_SPECIFIC_PASSWORD`、`OSF_APPLE_TEAM_ID`；本機未連線或讀取 GitHub repository／Environment 設定，無法證明 required reviewer 實際啟用、secret 確實只在該 environment scope，或 protected branch 設定已在遠端生效。不得將 source contract 擴稱 operational trust boundary 已驗收。
  - DMG validation 的 fail-closed 命令已存在：notarytool submit 使用 JSON output 並 `--wait`，app／DMG 均執行 staple，DMG 再執行 `xcrun stapler validate` 與 `hdiutil verify`（`:134-156`）。但本輪未觸發 workflow，故沒有實際 notarization／staple／DMG verification result。
  - DMG evidence schema 仍有 round2 的 P2 residual：post-build audit 以 app 為主要輸入（`:158-165`），workflow 沒有把 DMG notarization submission outcome、DMG staple validation 與 `hdiutil verify` 結果寫成對應的去敏 bounded evidence leaf；命令失敗可阻擋流程，但目前 evidence contract 仍不足以完整追溯 app／DMG 兩種 artifact 的結果。
  - builder step 仍接觸 Apple secrets（`:100-105`），其安全前提依賴 protected ref 與已實際配置的 environment reviewer／secret scope；在沒有外部配置證據前，這是 residual，不是本機可證明的 pass。
  - concurrency、exact cleanup 與 direct-child locator 不會因 nested helper 存在而 recursive delete 或選取 helper；cleanup target 仍以 exact equality 限制，未對不明路徑執行 recursive delete。

## 4. 程式碼品質

- 判定：部分通過
- 證據：

  - workflow 控制流已從 round2 的遞迴 artifact discovery 改為明確的 top-level glob，並維持 app／DMG cardinality checks；這是針對實際 Electron bundle layout 的正確邊界修正。
  - formal gate、builder wrapper 與 output config 的責任分界清楚：readiness evidence 不替代 formal gate，formal gate 先於 manifest／builder，signed builder config 只接受 absolute、source-tree 外 output。
  - action refs 已固定 commit SHA，權限維持 `contents: read`，並有 workflow-level concurrency；這些 round1 的 supply-chain／overlap findings 在 source level 已收斂。
  - focused regression 沒有實際 fixture／helper cardinality simulation，且 DMG evidence schema 尚未把兩種 artifact 的 post-build結果統一投影；兩者降低整體可驗證性，但不重新打開已修正的 direct-child locator 控制流。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：

  - `npm run project:preflight -- --type=full` exit 0。
  - `node scripts/test-macos-signed-canary-gate.mjs` exit 0，輸出 `macOS signed canary gate contract passed`；該 focused test 包含 direct-child glob／無 recursive find 的回歸斷言、absolute／out-of-tree output boundary、identity／toolchain／source config／notarization fail-closed cases。
  - `node scripts/test-macos-signed-canary-result.mjs` exit 0，輸出 `macOS signed canary result verification contract passed`。
  - 相關 `node --check` 與 `git diff --check` exit 0；`npm run check` exit 0，包含治理非-final check、全 syntax、完整 npm test 與 YouTube posttest。測試未觸發 workflow、signing、notarization、keychain、packaged UI 或外部網路。
  - `npm run docs:check:final` exit 1，明確指出最新 08 條目缺少「獨立審查是否執行：」、缺少「發布授權：」、尚未標示「完成」，且審查欄位不是是／否；這是目前唯一明確的治理 closeout blocker。
  - focused regression 的證據強度限於 workflow source pattern；尚沒有 deterministic fixture 將主 app 與四個 nested Helper.app 建立於臨時 output，再執行相同 locator 取得 `app_count=1` 的 integration assertion。Environment reviewer／secret scope 與 DMG evidence schema 也沒有可由本機 tests 證明的外部／schema coverage。

## 6. 實際運行結果

- 判定：部分通過
- 證據：

  - 本輪實際執行了 preflight、focused gate／result tests、相關 syntax checks、完整 `npm run check`、治理 final check 與 `git diff --check`；上述 local deterministic checks 均通過，只有預期的 `docs:check:final` 因 08 closeout 未完成而失敗。
  - 本輪未執行 GitHub workflow、`electron-builder` signed candidate、`codesign`、`notarytool`、`stapler`、`spctl`、`hdiutil`、packaged UI、Seatbelt／network policy 或任何外部網路操作；因此沒有 runner、Environment approval、secret scope、signed app、notarization、staple、DMG verification 或 post-build result 的實跑證據。
  - 本機目前仍不具備可供 signed canary 的 Developer ID／notarization 前置條件；這與既有 readiness evidence／round1／round2 residual 一致，不能由 source-level workflow contract 解除。
  - round1／round2 report 均被讀取且未覆寫；round2 F-03A 的遞迴 helper 計數問題已由目前 source 關閉，round2 的 Environment reviewer／secret scope、DMG evidence schema 與未觸發 workflow residual 維持揭露。

## 綜合判定

- 結論：不通過
- findings：
  - F-03A（round2，已關閉）：artifact locator 現為 run-scoped output 的 `mac-arm64` 直接子項 `.app` glob，不再遞迴計入 nested Helper.app；focused source-pattern regression 亦通過。
  - F-01（round1，已關閉）：正式 `assert-macos-signed-canary-ready.mjs` 在 readiness 與 package builder 兩處均先於 builder，只有 exit 0 可進入 runtime manifest／builder。
  - F-02／F-03／F-04（round1，source-level 已關閉）：protected current ref assertion、environment declaration、immutable action SHA、concurrency、run-scoped out-of-tree output、existing-directory fail-closed 與 exact cleanup 均存在；Environment required reviewer／secret scope 的實際遠端設定仍待外部核驗。
  - F-05（P2 residual）：DMG staple／validation／`hdiutil verify` 命令已存在且 fail-closed，但 app／DMG 對應的完整去敏 post-build evidence schema 尚未建立。
  - F-06（P1 governance blocker）：`08-CHANGE-LOG.md` 最新工作條目仍為「進行中」，沒有本 round3 report 的 canonical 引用與完整 closeout 欄位；`npm run docs:check:final` exit 1。修正並重跑 final gate 前不得結案。
- 阻擋問題（若有）：F-06 是本輪治理 closeout blocker；F-05 與 Environment required reviewer／secret scope 是未完成的 residual／外部核驗條件。F-03A 不再是目前 source-level blocker。
- 條件（若為有條件通過）：不適用；本輪總判定為不通過。若只看 source／local deterministic contract，F-03A 修正、gate-before-builder、protected ref／environment/action SHA／concurrency、out-of-tree output 與 direct-child artifact boundary 可判為技術上收斂；但治理 final gate 尚未通過，且沒有實際 workflow／signing／notarization／DMG run evidence。
- 本輪條件是否已被需求方接受：否；使用者要求本輪 round3 獨立複審與唯讀報告，未明確接受 F-06、F-05 或外部 Environment 設定殘餘。
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-CI-20261029-SIGNED-CANARY-HANDOFF-NEXT1` round3 獨立複審結論為不通過：round2 的 F-03A 遞迴 artifact locator 已修正為只選 run-scoped output 的 `mac-arm64` 直接子項 `.app`，nested Electron Helper.app 不會再被計入，focused source-pattern regression、gate-before-builder、protected ref／environment／immutable action SHA／concurrency、out-of-tree output 與 DMG fail-closed validation 均由目前 source／local checks 支持；但 focused regression 尚非實際 nested-helper fixture integration proof，Environment required reviewer／secret scope 尚無外部設定證據，DMG app／DMG post-build evidence schema 仍有 P2 缺口，且 `08-CHANGE-LOG.md` 最新條目仍為「進行中」並使 `npm run docs:check:final` exit 1，故本 handoff 尚不得結案，也不得宣稱 signed／notarized candidate 已建立或 FR-021 overall 完成。**
- 剩餘風險：實際 GitHub Environment required reviewer／environment-scoped secret、protected branch／ref 設定尚待外部核驗；本機未觸發 workflow，沒有 Apple Silicon runner、Developer ID identity／entitlements、notarytool、stapler、Gatekeeper、DMG verification 或 post-build evidence 實跑結果；本機 `0 valid identities`／credential absent、Seatbelt `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false`、true full-egress、Windows、LM Studio policy exclusion 與 FR-021 overall residual 均維持不變。focused test 仍需更強的 nested-helper fixture integration regression，若要提升 evidence strength。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
