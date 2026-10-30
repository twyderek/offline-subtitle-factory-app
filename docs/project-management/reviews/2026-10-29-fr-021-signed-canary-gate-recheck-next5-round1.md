# 獨立審查報告：FR-021 macOS signed-canary current-source formal build gate recheck execution5

- 審查輪次：round1
- 審查範圍：current-source formal gate、source provenance、gate reasons、execution／scope fail-closed、evidence privacy／schema、00／05／06／07／08 文件同步與驗證真實性。
- 審查方法：依 repo `AGENTS.md` 與 full preflight 路由，僅讀取治理文件、指定 source、execution5 authoritative evidence，並執行唯讀 syntax／focused／full check／治理驗證／invariant probe；未執行 builder、runtime manifest、codesign、notarization、stapler、Gatekeeper、workflow、release 或外部寫入。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-14` 將本輪限定為 current-source formal signed-canary gate 的 read-only fail-closed evaluation，要求 execution5 綁定目前 gate script／package／focused-test provenance、保存去敏 evidence、缺少外部 identity／credential 時不進入 runtime manifest／builder，且不把 gate 當成 signed candidate；`00-CURRENT-STATUS.md:3-8`、`05-DEVELOPMENT-AND-DEPLOYMENT.md:3-7`、`06-TEST-AND-PROCESS-AUDIT.md:3-7`、`07-DEBUG-AND-FIX-HISTORY.md:3-7` 均維持相同 bounded scope。

## 2. 邏輯正確性

- 判定：通過
- 證據：`scripts/assert-macos-signed-canary-ready.mjs:79-128` 以 source config、required toolchain、Developer ID identity 與由 credential presence 重新推導且 exact compare 的 notarization summary 決定 formal readiness；`scripts/audit-macos-signed-canary-gate.mjs:87-116` 只在 gate evaluation 後投影 evidence，沒有把 `sourceConfigReady`／`requiredToolchainReady` 轉成 signed candidate。execution5 `evidence:12-23` 的 `ready=false` reasons exact 為 `developer-id-application-not-ready` 與 `notarization-credential-set-not-ready`，同時 `sourceConfigReady=true`、`requiredToolchainReady=true`、`identityReady=false`、`notarizationReady=false`、status `absent`；這是正確的 external prerequisite fail-closed 解讀。
- 證據：execution4 與 execution5 的 gate script hash 都是現行 `63d22ec15b56e675db7c20507d5f0eb01f77e29b07020521719d6990a4495571`，但 execution5 的 package hash `d93d656587e8d2f0252b3be79531a02adb68fa5d5664ea9beea221e227992454` 與 focused-test hash `32ed8246051a920e010dc603c2a5a02de211c7630fa07319914ae81f1eb99122` 已不同於 execution4 的 `0980d896c417828d08f17a5ca1399f682c5bc440bf20e2849839d766466ed79a`／`8d6c97c238e9bbae9140de1227d448842ce69d52a821a6dd72f498883209d839`；本輪 read-only invariant probe 重新計算三個 hash 並通過，故 execution5 未沿用舊 execution4 provenance。

## 3. 邊界情況

- 判定：通過
- 證據：`scripts/test-macos-signed-canary-gate.mjs:54-148` 覆蓋 ready path、keychain credential path、absent／partial／ambiguous credential、0／非 Developer ID／malformed identity、platform／arch、source config／toolchain failure、derived notarization mismatch 與 whitespace-only credential fail-closed；`scripts/audit-macos-signed-canary-gate.mjs:64-75` 另對 schema、execution keys／全 false、完整 scope keys／全 false、三個 provenance hash 與 leakage pattern 做寫檔前驗證。
- 證據：本輪未把 source config／toolchain ready 擴大為 signed candidate；execution5 `evidence:25-46` 只記錄去敏 source／identity／toolchain projection，`evidence:47-68` 只保存 boolean credential presence 與 derived status，未保存 identity name／hash、secret、raw command output 或 keychain content。

## 4. 程式碼品質

- 判定：通過
- 證據：`package.json:36` 將 `assert-macos-signed-canary-ready.mjs` 放在 `runtime:manifest:mac`、`runtime:verify:mac` 與 `electron-builder` 之前；`scripts/assert-macos-signed-canary-ready.mjs:131-182` 的 command probes 僅使用受限 PATH、10 秒 timeout 與去敏 summarizer，gate 未 ready 時 `:185-208` 以非零結果停止。`audit-macos-signed-canary-gate.mjs:78-85,118-119` 對 macOS arm64、evidence path、既有檔案、schema 與 exclusive `wx`／0600 writer fail-closed。
- 證據：authoritative execution5 evidence mode 為 `0600`、SHA-256 為 `5a1bb264b698f78d958d7bd53056c57aae5ed6cf2b4349fd0dd1905f203872e5`；實際 read-only invariant probe 確認 evidence hash、exact reasons、source provenance、execution 全 false 與 scope 全 false 均一致，未發現需要主要代理修改 source 的技術 finding。

## 5. 測試覆蓋

- 判定：通過
- 證據：本輪實際執行 `node --check scripts/audit-macos-signed-canary-gate.mjs`、`node scripts/test-macos-signed-canary-gate.mjs`、`node scripts/test-project-docs-validator.mjs`、`npm run check` 與 `git diff --check` 均 exit 0；focused output 為 `macOS signed canary gate contract passed: identity, toolchain, source config and notarization fail-closed matrix`，full check 亦通過同一 gate test、signing readiness test、相關 evidence／distribution／external-boundary contract 與完整回歸。
- 證據：execution5 的 schema／0600／SHA／provenance／execution／scope probe 另 exit 0；未執行真實 signed workflow、builder、codesign、notarization 或 candidate runtime，符合本輪明確 scope，沒有把未執行項目冒報為通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：authoritative `docs/project-management/evidence/2026-10-29-fr-021-signed-canary-gate-execution5.json:3-23,33-68` 記錄實際 darwin／arm64 gate run：identity probe command 成功但 `validIdentityCount=0`、`developerIdApplicationPresent=false`、`formalIdentityAvailable=false`；credential presence 全為 false、notarization `absent`，因此 gate `ready=false` 且僅有兩個指定 reasons。這是 expected blocked gate result，不是 audit／source failure。
- 證據：`evidence:69-90` 的 `runtimeManifestStarted`、`builderStarted`、`candidateCreated` 與完整 scope 17 個 flags 全為 `false`；`00:3-8`、`05:3-7`、`06:3-7`、`07:3-7` 對 execution5 的 gate result、privacy、未執行範圍與不代表 signed candidate 的解讀一致。`npm run docs:check:final` 本輪 exit 1，原因僅為最新 `08-CHANGE-LOG.md:3-14` 仍是「進行中」且尚未補入本輪 review／授權 closeout 欄位；這是 report-only 限制下尚未結案的文件狀態，並未被文件誤報為完成。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 `FR-021-SIGNED-CANARY-GATE-RECHECK-NEXT5` round1 獨立審查結論為有條件通過：current-source formal gate、execution5 source provenance、exact gate reasons、privacy／schema、execution／scope 全 false、focused／full validation 與 00／05／06／07 文件同步均如實且通過，`sourceConfigReady=true`／`requiredToolchainReady=true` 僅表示 gate prerequisite projection，未被擴大為 signed candidate；gate `ready=false` 正確只由 `developer-id-application-not-ready` 與 `notarization-credential-set-not-ready` 阻擋，條件僅為外部 Developer ID Application identity／完整 notarization credential 尚未具備且真實 signed workflow 尚未執行，因此不得宣稱 signed／notarized candidate、Apple ticket、release 或 FR-021 overall acceptance。**
- 阻擋問題（若有）：僅有外部條件：Developer ID Application identity 與完整 notarization credential set 尚未具備，真實 signed workflow 尚未執行；本輪未發現 source／test technical blocker，無需主要代理修改 source。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
