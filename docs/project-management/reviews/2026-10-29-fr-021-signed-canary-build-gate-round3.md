# 獨立最終複審報告：FR-021 signed canary build gate

- 審查對象：`FR-021-DEBUG-20261029-SIGNED-CANARY-BUILD-GATE`
- 審查輪次：round3 最終複審
- 審查範圍：讀取 round1／round2 原件、本輪 changelog、`00-CURRENT-STATUS.md`、`03-FUNCTIONAL-DESIGN.md`、`05-DEVELOPMENT-AND-DEPLOYMENT.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、`package.json`、`scripts/assert-macos-signed-canary-ready.mjs`、`scripts/audit-macos-signed-canary-gate.mjs`、`scripts/test-macos-signed-canary-gate.mjs`、`scripts/audit-macos-signing-readiness.mjs`、`scripts/test-macos-signing-readiness.mjs`、audit12 與 gate execution2 evidence；執行唯讀 syntax／focused／治理／文件／diff／gate assertion 與純 evaluator invariant probes。
- 範圍限制：未執行會進入 `electron-builder`、runtime manifest、candidate、signing、notarization、keychain、network、Ollama 或 model 的命令；未執行 packaged renderer／UI／AI acceptance；未修改 round1／round2、source、tests、package、docs、evidence 或既有 reports。

## 1. 需求完整性

- 判定：通過
- 證據：`package.json` 的 `electron:build:mac:signed-canary` 以 `node scripts/assert-macos-signed-canary-ready.mjs` 作為第一個命令，後續才是 `runtime:manifest:mac`、`runtime:verify:mac` 與 `electron-builder --mac --arm64 --publish never`；既有 `electron:build:mac:dir`／`electron:build:mac` 未被接入此 gate。`summarizeSourceBuildConfig()` 嚴格要求 target entry 只有 `target`／`arch`、target 只可為 `dmg`／`zip`／`dir`、arch 非空且全為 `arm64`；focused readiness test 對 missing、malformed、非 mac target 與 `x64` 均有 fail-closed assertion。
- 證據：gate 的 credential presence 只接受固定 boolean key set，並從 presence 重算 notarization summary；Apple ID 三件組、API key 三件組與 keychain profile 只允許單一路徑 complete。audit12 與 execution2 都記錄目前 bounded gate 結果，不把 prerequisite contract 擴大成 signed package 或 FR-021 完成。

## 2. 邏輯正確性

- 判定：通過
- 證據：`evaluateFormalSignedCanaryReadiness()` 重新計算 `summarizeNotarizationCredentialState(credentialPresence)`，並以完整 JSON 一致性檢查拒絕矛盾 summary；focused gate test 實際通過 complete、partial、ambiguous、derived mismatch 與 whitespace credential fail-closed cases。`summarizeCredentialPresence()` 對 whitespace-only 值正規化為 `false`，非空值才為 `true`。
- 證據：目前唯讀執行 `node scripts/assert-macos-signed-canary-ready.mjs` exit 1，safe stdout 為 `ready=false`、`sourceConfigReady=true`、`requiredToolchainReady=true`、`formalIdentityAvailable=false`、`notarizationStatus=absent`、`notarizationConsistent=true`；stderr 只有 `developer-id-application-not-ready` 與 `notarization-credential-set-not-ready`。

## 3. 邊界情況

- 判定：通過
- 證據：source／focused coverage 涵蓋 0／非 Developer ID／malformed identity、required toolchain failure、platform／arch failure、缺少 target、空 target、未知 target、wrong arch、空 arch、extra target key、credential absent／partial／ambiguous／multiple complete、credential-derived mismatch 與 whitespace-only credential。純 evaluator invariant probe 也確認 valid arm64 target 可通過，所有上述 malformed target 變體均為 `sourceConfigReady=false`。
- 證據：credential presence、notarization、decision 與 source config 的摘要均不保存 secret、raw output、absolute path、identity name 或 hash；本輪未以 unsigned／ad-hoc 結果替代 formal signed canary。

## 4. 程式碼品質

- 判定：通過
- 證據：gate evaluator、macOS command probe、audit evidence writer 與 focused tests 分離；gate 只輸出去敏 boolean／分類／固定阻擋原因。`&&` chain 保證 gate 失敗後不會執行 runtime manifest、runtime verify 或 builder。audit script 對 evidence schema、provenance、privacy、execution 與 scope 做寫檔前 fail-closed validation，且 output path 必須位於 evidence 目錄並以 exclusive write 建立。
- 證據：本輪純 chain probe 確認 gate、manifest、verify、builder 的索引嚴格遞增，且 signed-canary chain 使用 `--publish never`；未修改既有 unsigned／development build semantics。

## 5. 測試覆蓋

- 判定：通過
- 證據：`node scripts/test-macos-signing-readiness.mjs` 與 `node scripts/test-macos-signed-canary-gate.mjs` 均實際 exit 0；四支相關腳本 `node --check` 均 exit 0。focused 測試涵蓋本輪要求的 exact arm64 target、credential-derived consistency、whitespace normalization、Developer ID／toolchain／source config fail-closed 與 privacy boundary。
- 證據：本輪實際執行 `node scripts/test-project-docs-validator.mjs` exit 0、`git diff --check` exit 0、`npm run docs:check:final` exit 0。`npm run check` 未在本輪重跑，因其 `npm test` chain 包含 Ollama／model 相關測試而落入本輪明令禁止的命令範圍；其 exit 0 已由本輪 changelog、06 稽核與 round2 原件記錄，可回溯但不冒充本輪重新執行結果。

## 6. 實際運行結果

- 判定：通過
- 證據：`docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit12.json` mode `0600`，status 為 `blocked-external-signing-identity`，`validIdentityCount=0`、`formalIdentityAvailable=false`、notarization status `absent`、`notarizationCredentialReady=false`、`formalSigningReady=false`；required toolchain 與 source config 可用，但 gate 正確維持 blocked。
- 證據：`docs/project-management/evidence/2026-10-29-fr-021-signed-canary-gate-execution2.json` mode `0600`，`gate.ready=false`、`notarizationConsistent=true`，`runtimeManifestStarted=false`、`builderStarted=false`、`candidateCreated=false`，且 execution／scope 中所有 flags 均為 `false`；其 package／gate／focused-test SHA-256 與目前檔案一致。這是 gate-before-builder 的 blocked evidence，不是 signed／hardened package、effective entitlements、實際 notarization、renderer／UI／AI／Ollama／model／network acceptance 或 FR-021 完成證據。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 `FR-021-DEBUG-20261029-SIGNED-CANARY-BUILD-GATE` round3 最終複審有條件通過：exact arm64 mac target contract、credential-derived notarization consistency、whitespace credential normalization、Developer ID／toolchain／source config fail-closed、gate-before-builder chain、0600 evidence 與全 false execution／scope flags 均由目前 source、focused tests、audit12、gate execution2 及唯讀驗證重驗成立；目前 0 valid identity／absent credential 仍是外部能力限制，formal signed canary 尚未執行，本結論不代表 signed／hardened package、effective entitlements、實際 notarization、renderer／UI／AI／Ollama／model／network acceptance 或 FR-021 整體完成。**
- 阻擋問題（若有）：外部 Developer ID Application identity 與單一有效 notarization credential set 尚未提供，因此 gate 依約於 builder 前非零停止；取得外部能力後，須另立新 immutable evidence 並在隔離環境重驗 formal signed／hardened canary、effective entitlements、實際 signing／notarization 與後續產品 acceptance。本輪 bounded gate contract 沒有新增程式或治理缺口。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
