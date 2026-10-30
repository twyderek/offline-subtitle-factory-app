# 獨立複審報告：FR-021 signed canary build gate

- 審查對象：`FR-021-DEBUG-20261029-SIGNED-CANARY-BUILD-GATE`
- 審查輪次：round2
- 審查範圍：讀取 round1 原件、本輪 changelog、00／03／05／06／07、`package.json`、`scripts/assert-macos-signed-canary-ready.mjs`、`scripts/audit-macos-signed-canary-gate.mjs`、`scripts/test-macos-signed-canary-gate.mjs`、`audit11` 與 `signed-canary-gate-execution1` evidence；唯讀執行 source／evaluator probes、syntax、focused gate test、`docs:check:final`、`git diff --check` 與不會進入 builder 的 gate assertion。
- 範圍限制：未執行會進入 `electron-builder`、runtime manifest、candidate、signing、notarization、keychain、network、Ollama 或 model 的命令；未執行 packaged renderer／UI／AI acceptance。

## 1. 需求完整性

- 判定：部分通過
- 證據：round1 要求的三項修正中，evaluator 已以 exact boolean credential presence 重算 `summarizeNotarizationCredentialState()` 並與傳入 summary 完全比對；source config 也要求 identity selection、hardened runtime、Gatekeeper 與 `macTargetConfigured` 為 true，且 `package.json` 的目前 mac target 為 arm64 dmg／zip。可是 `summarizeSourceBuildConfig()` 對任何非空 target 陣列都標示 `macTargetConfigured=true`：`[{}]`、`target:'not-a-mac-target'` 或只含 `x64` 的 target 均被回報 `sourceConfigReady=true`。因此「要求 valid mac target」尚未達到 exact semantic contract。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：`evaluateFormalSignedCanaryReadiness()` 先以 `hasExactBooleanKeys()` 拒絕 malformed／額外 credential presence，再由 presence 重算 notarization summary；對 `completeSetCount` 矛盾的 summary，唯讀 probe 得到 `ready=false`、`notarizationConsistent=false`。空白 `APPLE_ID='   '` 經 `summarizeCredentialPresence()` 正規化為 false，並使 evaluator 以 `notarization-credential-set-not-ready` fail-closed。相對地，source config evaluator 只接收摘要布林值，摘要產生器沒有驗證 target 名稱、target 形狀或 arm64 arch，故 malformed mac target 可穿過 source-config gate。

## 3. 邊界情況

- 判定：部分通過
- 證據：focused matrix 已覆蓋完整／partial／ambiguous／absent credential、credential-derived mismatch、whitespace credential、缺少 target、identity malformed／0 identity、toolchain、platform／arch failure；但 `node` 唯讀 probe 顯示 `{ hardenedRuntime:true, gatekeeperAssess:true, target:[{}] }` 與 `target:[{ target:'dmg', arch:['x64'] }]` 都得到 `sourceConfigReady=true`。缺少 malformed target、非 mac target 與非 arm64 target 的負向 regression，因此目前不能宣稱 source config 對「valid mac target」完全 fail-closed。

## 4. 程式碼品質

- 判定：部分通過
- 證據：gate、audit 與 pure evaluator 分離；credential presence 僅保存布林值，summary 不保存 secret／raw output／path；`package.json` 的 signed-canary chain 以 `&&` 將 gate 排在 runtime manifest、verify 與 `electron-builder` 前，既有 `electron:build:mac:dir`／`electron:build:mac` 字串未改。需補強 mac target 的結構與允許值驗證，否則 source-readiness 摘要的命名雖為 `macTargetConfigured`，實際只代表非空陣列。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：本輪實際執行 `node --check`（assert／audit／focused test）、`node scripts/test-macos-signed-canary-gate.mjs`、三項 round1 修正的獨立 probe、package chain 靜態順序檢查、`npm run docs:check:final` 與 `git diff --check`，均通過；`docs:check:final` 實際輸出「19 個文件，最新紀錄已結案」。`npm run check` 的 exit 0 可由本輪 changelog 實際驗證紀錄回溯，但本複審未重跑，因其 `npm test` 鏈包含 Ollama／model 相關測試且本輪明令不得執行該類命令。focused test 尚未固定上述 malformed／wrong-arch target 負例。

## 6. 實際運行結果

- 判定：部分通過
- 證據：直接執行 `node scripts/assert-macos-signed-canary-ready.mjs` exit 1，safe summary 為 `ready=false`、`sourceConfigReady=true`、`requiredToolchainReady=true`、`formalIdentityAvailable=false`、`notarizationStatus=absent`、`notarizationConsistent=true`，stderr 僅為 `developer-id-application-not-ready,notarization-credential-set-not-ready`。`package.json` 靜態順序為 gate → runtime manifest → verify → builder；`signed-canary-gate-execution1.json` 记录 blocked gate，`runtimeManifestStarted=false`、`builderStarted=false`、`candidateCreated=false`，所有 scope flags 為 false，文件 mode 為 0600，且其 gate／package／focused-test hashes 與目前相應檔案相符。`audit11` 記錄 `validIdentityCount=0`、`formalSigningReady=false`、credential `absent`；這些是 prerequisite blocker，不是 signed package 結果。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 `FR-021-DEBUG-20261029-SIGNED-CANARY-BUILD-GATE` round2 複審有條件通過：round1 指出的 credential-derived notarization consistency、source-config gate 欄位、whitespace credential fail-closed 與 gate-before-builder blocked evidence 均可由目前 source、focused contract、audit11 與 0600 execution evidence 重驗；但 `summarizeSourceBuildConfig()` 對非空 malformed／wrong-arch mac target 仍回報 ready，需補上 valid mac target 的結構／允許值負向驗證後，且在外部 Developer ID identity 與單一有效 credential 具備前，本結果不代表 signed／hardened package、effective entitlements、實際 notarization、renderer／UI／AI／Ollama／model／network acceptance 或 FR-021 整體完成。**
- 阻擋問題（若有）：新發現為 source config 的 mac target semantic validation 不足：`[{}]`、非 mac target 與 `x64` target 可標示 `sourceConfigReady=true`；需由主要代理補 source／focused regression 並重新產生與 source revision 綁定的 gate evidence。另目前 `validIdentityCount=0`、notarization credential `absent` 仍是外部 blocker；不得以本輪 blocked gate evidence 宣稱 signed／hardened package、effective entitlements、實際 notarization、renderer／UI／AI／Ollama／model／network acceptance 或 FR-021 完成。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
