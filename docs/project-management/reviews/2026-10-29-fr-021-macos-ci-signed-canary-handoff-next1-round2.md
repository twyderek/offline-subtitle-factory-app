# 獨立複審報告：FR-021 macOS signed-canary CI handoff next stage

- 審查對象 commit／版本：`c06d15e95a2f0a0981518c5873003a460e57a5ee`、package version `0.52.0`、branch `codex/0.51-anthropic-claude`；工作樹為 dirty，保留既有修改與 round1 原件。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS signed-canary CI handoff next stage（`FR-021-MACOS-CI-20261029-SIGNED-CANARY-HANDOFF-NEXT1`）。
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-10-29T13:31:33+08:00；獨立複審上下文，先讀 `docs/project-management/reviews/2026-10-29-fr-021-macos-ci-signed-canary-handoff-next1-round1.md`，再讀目前 workflow、gate、build-config override、focused tests、05／06／07／08 文件；未沿用主要代理的評價性結論。
- 審查範圍：`.github/workflows/macos-signed-canary.yml`、`scripts/assert-macos-signed-canary-ready.mjs`、`electron-builder.signed-canary.mjs`、`lib/macos-signed-canary-build-config.mjs`、`scripts/test-macos-signed-canary-gate.mjs`、`scripts/audit-macos-signed-canary-result.mjs`、05／06／07／08 相關條目與 round1 findings。
- 唯讀限制：未觸發 GitHub workflow，未執行 signing、notarization、keychain、packaged UI、Electron candidate、sandbox／network policy 或外部網路操作；除建立本報告外未修改任何檔案。

## 1. 需求完整性

- 判定：部分通過
- 證據：

  - round1 F-01 的核心要求已落到目前 source：workflow 的 readiness step 會執行正式 `node scripts/assert-macos-signed-canary-ready.mjs`，`gate_status` 非 0 即在 builder 前停止；此外 `package.json` 的 `electron:build:mac:signed-canary` 以同一 gate 為第一個命令，未通過不得進入 runtime manifest 或 `electron-builder`。
  - round1 F-02 的 source-level contract 已補上 `refs/heads/codex/0.51-anthropic-claude` exact assertion、`environment.name: macos-signed-canary`、Apple Silicon self-hosted labels、environment secret references、immutable action SHA 與 concurrency。這些足以揭露 handoff 的預期 trust boundary，但 GitHub Environment 的 required reviewer 與 secret scope 是 repository 外設定，單靠目前 YAML／文件無法證明實際已配置。
  - round1 F-03 的 persistent `../dist` first-match 路徑已由 `OSF_SIGNED_CANARY_OUTPUT_DIR=$RUNNER_TEMP/osf-signed-canary-dist-$GITHUB_RUN_ID` 取代；目錄既存即停止，builder config 強制 absolute、source-tree 外輸出，artifact discovery 也要求 app／DMG 各一個。原本的 stale-directory 放行路徑已關閉。
  - 但目前唯一 app 判定沒有區分 top-level application 與 app bundle 內的 Electron Helper.app；這使「唯一 artifact」需求在合法候選上過度拒絕，詳見 F-03A。
  - 08 最新工作條目仍為「進行中」，尚無本輪 round2 的獨立審查欄位、發布授權欄位或 final closeout，詳見 F-06。

## 2. 邏輯正確性

- 判定：不通過
- 證據：

  - F-01（round1，已修正）：builder step 本身沒有繞過 gate；其命令為 `npm run electron:build:mac:signed-canary`，而 package script 明確以 `node scripts/assert-macos-signed-canary-ready.mjs &&` 開頭。workflow readiness step 也先執行相同正式 gate，只有 status 0 才能離開該 step；status 1 會執行 bounded gate classification 後 exit 1。靜態控制流核對通過。
  - F-02（round1，source-level 已修正，外部配置待證）：protected current ref assertion、environment declaration、least-scope action permissions、SHA-pinned actions 與 concurrency 均存在。required reviewer 的實際 GitHub Environment 設定、environment secret 是否沒有被 repository-level secret 覆蓋，仍不是目前 source 可驗證的事實；在未取得外部設定證據前，不應把這段 handoff 說成已完成的 operational trust boundary。
  - F-03（round1，stale path 已修正）：run-scoped output directory 在本次 run 已存在時直接失敗，且 cleanup 只接受 exact expected path；builder config 會拒絕 source-tree 內輸出。這是 fail-closed 的 stale cleanup 行為。
  - F-03A（P1，新阻擋）：workflow 第 111 行以 `find "$OSF_SIGNED_CANARY_OUTPUT_DIR" -type d -name '*.app'` 遞迴計數。既有 repo 外 dist layout 顯示每個主 `離線字幕工廠.app` 內還有 `離線字幕工廠 Helper.app`、`Helper (GPU).app`、`Helper (Plugin).app`、`Helper (Renderer).app`；因此合法輸出會得到至少五個 `.app` directory，`test "$app_count" = 1` 必然失敗。這不會放行 stale candidate，但會使 ready path 無法完成；目前 focused test 只測 output path boundary，沒有 nested-helper artifact cardinality regression。
  - DMG step 邏輯已補強：`xcrun stapler staple` 同時作用於 app／DMG，後續 `xcrun stapler validate "$OSF_SIGNED_CANARY_DMG"` 與 `hdiutil verify "$OSF_SIGNED_CANARY_DMG"` 均在 `set -euo pipefail` 下執行；這些命令未在本輪實跑。

## 3. 邊界情況

- 判定：部分通過
- 證據：

  - workflow 僅 `workflow_dispatch`，明確拒絕非預期 event、非 protected current ref、非 Darwin／arm64 runner 與 dirty checkout；三個 action refs 均為 40-hex immutable commit SHA，`concurrency.group` 以 ref 分組且 `cancel-in-progress: false`，可避免同一 ref 的重疊執行。
  - `macos-signed-canary` environment 宣告與文件要求已一致，但 required reviewer／environment secret 的實際設定沒有可審查的 repository evidence。這是仍需外部配置核驗的 P2 operational residual，不可由 YAML 欄位本身推定已生效。
  - builder step 仍注入 `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`，因 package builder script 會再次執行 formal gate；secret 不落盤、不進 readiness／result evidence，但 source／builder hook 在正式 trusted ref 上仍可讀取這些值。required reviewer、protected ref 與 environment-scoped secret 必須是實際生效的前提，否則 trust boundary 不足。
  - F-05（P2 residual）：DMG staple／hdiutil fail-closed step 已存在，但 post-build result audit 仍以 app 為主要輸入，沒有將 app 與 DMG 的 notarization submission／staple／container verification 結果轉成對應的去敏 bounded evidence leaf；目前可阻擋錯誤，尚不足以完整追溯兩種 artifact 的結果。
  - 清理 step 的 target 以 `$RUNNER_TEMP/osf-signed-canary-dist-$GITHUB_RUN_ID` exact equality 限制，沒有對不明路徑執行 recursive delete；這一點通過本輪邊界核對。

## 4. 程式碼品質

- 判定：部分通過
- 證據：

  - `assert-macos-signed-canary-ready.mjs` 將 platform／arch、source config、required toolchain、Developer ID identity、credential set 與 notarization state 以 fail-closed evaluation 統一分類；package builder wrapper 與 workflow 皆使用該正式 gate，沒有以 readiness audit 的 `formalSigningReady` 欄位直接替代 builder gate。
  - `loadSignedCanaryBuildConfig()` 對 output directory 做 absolute／out-of-tree 驗證；signed builder config 只由 `OSF_SIGNED_CANARY_OUTPUT_DIR` 注入 run-scoped output，不改寫 base unsigned/development build config。
  - YAML 結構、source syntax、focused gate／result tests 與完整 `npm run check` 均通過；但 artifact locator 對 nested helper bundles 的誤計數是 orchestration correctness defect，且 focused test 尚未固定這個實際 Electron layout。
  - round1 的 mutable action refs、缺少 concurrency、persistent `../dist` first-match 與 no-protected-ref 缺口已不再成立；不要把這些已修正項目重列為目前阻擋。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：

  - `npm run project:preflight -- --type=full` exit 0；固定核心、full route 與目前治理規範已核對。
  - 相關 source `node --check` 全部通過；`node scripts/test-macos-signed-canary-gate.mjs` 與 `node scripts/test-macos-signed-canary-result.mjs` 均 exit 0。
  - workflow static audit 通過：workflow_dispatch、exact protected ref、environment name、concurrency、三個 immutable action SHA、gate-before-builder、package gate-first、run-scoped out-of-tree output、app／DMG cardinality checks、DMG staple 與 hdiutil verify 均可觀測。
  - `npm run check` exit 0；包含治理非 final check、全 syntax、完整 npm test 與 YouTube posttest。測試未觸發 workflow、signing、notarization、keychain、packaged UI 或外部網路。
  - `git diff --check` exit 0。
  - `npm run docs:check:final` exit 1，明確指出最新工作紀錄缺少「獨立審查是否執行」「發布授權」、最新條目尚未標示「完成」，且獨立審查欄位不是是／否。這是治理 closeout 的實際失敗，不是推測。
  - 測試缺口：沒有 workflow-level assertion 驗證主 app locator 不會把 nested `*.app` helper 計入，也沒有 deterministic test 證明 environment required reviewer／environment secret scope 已於 GitHub 外部設定生效，亦沒有 DMG post-build evidence schema／cross-field regression。

## 6. 實際運行結果

- 判定：部分通過
- 證據：

  - 本輪只執行 local read-only preflight、syntax、focused／full checks、YAML static audit、`git diff --check` 與對既有 `../dist` layout 的唯讀檔案列舉；沒有執行 GitHub workflow、`electron-builder`、`codesign`、`notarytool`、`stapler`、`spctl`、packaged UI 或任何外部網路操作。
  - 既有 repo 外 dist layout 明確包含主 app 及四個 nested Helper.app，直接支持 F-03A 的靜態反例；沒有把這些既有候選列舉誤寫成本輪 signed／notarized candidate。
  - 本輪沒有產生 signed candidate、notarization、staple、Gatekeeper、renderer／offline UI 或 FR-021 overall acceptance evidence。round1 所記錄的本機 external identity／credential blocker與 Seatbelt／全機 egress／Windows／LM Studio residual 均保持不變。
  - 因 workflow 未觸發，runner label、GitHub Environment reviewer、secret scope 與 actual action execution 仍待有外部條件後另行驗證；本報告不把 source contract 寫成實際 CI pass。

## 綜合判定

- 結論：不通過
- findings：
  - F-01（round1，已關閉）：正式 `assert-macos-signed-canary-ready.mjs` 已在 workflow readiness 與 builder package script 兩處先於 builder 執行，只有 exit 0 可進入 builder。
  - F-02（round1，source-level 已關閉；P2 operational residual）：protected current ref、environment declaration、environment secret references、immutable action SHA 與 concurrency 已加入；但 required reviewer／environment secret scope 的實際 GitHub 設定未有外部證據，builder step 仍接觸 Apple secrets，須在實際 handoff 前完成外部核驗。
  - F-03（round1，stale path 已關閉）：source-tree 外 run-scoped output、existing-directory fail-closed、exact cleanup 與唯一 artifact 意圖已加入。
  - F-03A（P1）：遞迴 app locator 把主 app 內四個 Helper.app 納入 count，會使合法 build 在 locator step 失敗；需改成 top-level／manifest-bound exact candidate selection，並補 nested-helper regression。
  - F-05（P2 residual）：DMG staple／hdiutil step 已存在且 fail-closed，但沒有 app／DMG 對應的完整去敏 post-build evidence leaf。
  - F-06（P1 governance）：`08-CHANGE-LOG.md` 最新條目仍是「進行中」，缺少本輪獨立審查／發布授權欄位，`npm run docs:check:final` exit 1；修正前不得結案。
- 阻擋問題（若有）：F-03A 與 F-06；F-02 的 external Environment reviewer／secret scope 也必須在實際執行前取得設定證據。round1 的 F-01、F-02 source contract 與 F-03 stale-output bypass 不再是目前 source-level blocker。
- 條件（若為有條件通過）：不適用；本輪判定為不通過。要取得後續通過，至少須修正 top-level app candidate selection 並補 nested-helper regression、完成 08 final closeout／`npm run docs:check:final`，以及在不執行本地 signing 的前提下取得或明確記錄 GitHub Environment required-reviewer／secret-scope 外部核驗結果；P2 DMG evidence residual 需補強或由需求方明確接受並持續揭露。
- 本輪條件是否已被需求方接受：否；使用者要求本輪獨立複審與報告，未明確接受 F-03A、F-06 或 P2 residual。
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-CI-20261029-SIGNED-CANARY-HANDOFF-NEXT1` round2 獨立複審結論為不通過：round1 的 F-01 gate bypass、F-02 source/ref/environment contract 與 F-03 persistent stale-output boundary 已在目前 source 層面修正並通過靜態／focused／full checks，但 artifact locator 以遞迴 `find` 將主 `.app` 內四個 helper `.app` 一併計入，造成合法 signed build 必然 fail-closed，且 `08-CHANGE-LOG.md` 最新條目仍為「進行中」並缺少 final review／publish authorization 欄位；因此本 handoff 尚不得結案，也不得宣稱可建立 signed／notarized candidate 或 FR-021 overall 完成。**
- 剩餘風險：即使 F-03A／F-06 修正，仍需受保護的 GitHub Environment required reviewer、environment-scoped Apple secrets、預置 Developer ID Application identity／entitlements、notarytool／stapler／Gatekeeper 實機結果，以及 packaged renderer／Seatbelt offline、true full-egress、Windows、LM Studio policy exclusion 與 FR-021 overall residual 的獨立 evidence；本機 `0 valid identities`／credential absent、`CHROMIUM_CHILD_SANDBOX_INIT_FAILED` 與 `systemNetworkDisabled=false` 不因本 workflow source contract 而解除。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、唯讀檔案列舉與驗證指令，未修改任何其他專案檔案，未觸發 workflow、signing、notarization、keychain、packaged UI、sandbox／network policy 或外部網路。
- 本報告未覆寫 round1 report、既有 evidence、candidate、治理來源文件或工作條目；若上述聲明不實，本報告無效。
