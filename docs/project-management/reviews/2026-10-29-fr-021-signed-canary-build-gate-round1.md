# 獨立審查報告：FR-021 signed canary build gate

- 審查對象：`FR-021-DEBUG-20261029-SIGNED-CANARY-BUILD-GATE`
- 審查輪次：round1
- 審查範圍：讀取本輪 changelog 最新條目、00／03／05／06／07、`package.json`、signed-canary gate／focused test／signing-readiness source，以及 `audit11` 與必要既有 preflight evidence；唯讀執行 focused contract、syntax、docs validator、docs check、diff check 與 gate。
- 範圍限制：未執行會進入 `electron-builder` 的命令，未執行 signing、notarization、keychain、candidate、network、Ollama、model 或 packaged renderer／UI／AI acceptance。

## 1. 需求完整性

- 判定：部分通過
- 證據：`package.json` 新增獨立 `electron:build:mac:signed-canary`，其 gate 位於 `electron-builder --mac --arm64 --publish never` 前；目前 `electron:build:mac:dir` 與 `electron:build:mac` 的 script 字串與 HEAD 相同，且 gate 的 safe summary 只包含 boolean／分類／固定阻擋原因。source、required toolchain、Developer ID 與單一路徑 notarization credential 均有明確檢查，但沒有獨立 immutable gate execution evidence，且純 evaluator 對摘要內部一致性仍有缺口。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：直接執行 `node scripts/assert-macos-signed-canary-ready.mjs` 得到 `ready=false`、`sourceConfigReady=true`、`requiredToolchainReady=true`、`formalIdentityAvailable=false`、`notarizationStatus=absent`，並以非零狀態輸出 `developer-id-application-not-ready` 與 `notarization-credential-set-not-ready`；但唯讀 probe 也證明 `evaluateFormalSignedCanaryReadiness()` 會接受 `status=complete`／`ready=true`、`completeSetCount=0`／`partialCredentialSetDetected=true` 的矛盾摘要，`summarizeSourceBuildConfig()` 在缺少 target 時仍可回報 `sourceConfigReady=true`，而三個空白字串 credential 會被 Boolean presence 判為 complete。這些情況尚未達到 strict fail-closed。

## 3. 邊界情況

- 判定：部分通過
- 證據：focused matrix 已涵蓋 ready、absent／partial／ambiguous credential、0／非 Developer ID／malformed identity、source-config、required toolchain、platform／arch failure；實際輸出不含 secret、raw output、path、identity name 或 hash，`audit11` 亦記錄 0 identity、11 個 credential flags 全 false、scope flags 全 false。仍缺少 whitespace-only credential、矛盾摘要、缺少／錯誤 mac target 與 package-level gate chain 的直接負向案例，故不能把目前 fixture 的 ready 解讀為正式 signed package。

## 4. 程式碼品質

- 判定：部分通過
- 證據：gate 與 audit classifier 分離、使用固定 `/usr/bin` 工具入口、只將 command output 留在記憶體並投影為去敏結果；`package.json` 的新命令以 `&&` 保證 gate 失敗時不進入 runtime manifest／verify／builder，既有 unsigned／development 命令未被接入此 gate。需要補強 evaluator 不可信摘要的再驗證、source config exact contract 與空白 credential 正規化，並在後續工作保存可重現的 gate-before-builder 證據。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：`node scripts/test-macos-signed-canary-gate.mjs`、三個 gate／readiness `node --check`、`node scripts/test-project-docs-validator.mjs`、`npm run docs:check` 與 `git diff --check` 均 exit 0；最新 changelog／06 也記載完整 `npm run check` 曾 exit 0，但本審查未重跑該命令，因其測試鏈包含 Ollama／model 相關流程而受本輪硬性限制。focused test 沒有固定上述三種 fail-open probe，且沒有專屬 immutable gate evidence。

## 6. 實際運行結果

- 判定：部分通過
- 證據：目前 macOS arm64 的唯讀 gate 實際 exit 1，輸出只含 `{"ready":false,...}` safe summary 與兩個固定阻擋原因；`audit11` 同時證明 `validIdentityCount=0`、`formalSigningReady=false`、credential `absent`、mode 0600，且 candidate／keychain／signing／notarization／network／packaged app／UI／AI／Ollama／model scope 全為 false。由於本輪禁止執行 package build command，builder-before-gate 只能由 script chain 靜態核對，尚未有實際 package-level no-builder replay；本結果不代表 signed／hardened canary、effective entitlements、實際 notarization 或 FR-021 完成。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 `FR-021-DEBUG-20261029-SIGNED-CANARY-BUILD-GATE` build-gate contract 有條件通過：獨立命令已把去敏、fail-closed gate 放在 electron-builder 前，focused contract、syntax、治理文件、docs 與 diff checks 均通過，且目前 0 valid identity／absent notarization credential 實際以非零狀態阻擋；但在補上矛盾摘要與 source-config exact validation、空白 credential fail-closed regression、完整 full-check／package-level gate evidence 並於具備外部 Developer ID identity 與單一有效 credential 後重驗前，本輪不代表 signed／hardened package、effective entitlements、實際 notarization、renderer／UI／AI／Ollama／model／network acceptance 或 FR-021 整體完成。**
- 阻擋問題（若有）：closeout 條件為 (1) evaluator 必須重算或嚴格驗證 notarization／source-config 摘要，不接受矛盾或缺欄位摘要；(2) whitespace-only credential、缺少／錯誤 mac target 與 malformed summary 必須加入 focused fail-closed tests；(3) 後續受控環境須保留 full check 與 package-level gate-before-builder 的可核對證據；(4) 取得外部 Developer ID Application identity 與單一完整 credential set 後，另立工作項目驗證 signed／hardened canary、effective entitlements、notarization 與後續產品 acceptance。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
