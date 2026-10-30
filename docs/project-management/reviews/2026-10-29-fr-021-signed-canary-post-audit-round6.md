# 獨立審查報告：signed canary post-build verification contract round6

- 審查對象：`FR-021-DEBUG-20261029-SIGNED-CANARY-POST-AUDIT` 目前 source、round1–round5、signed/base config boundary 與 execution4 gate evidence。
- 審查輪次：round6。
- 審查上下文：2026-10-29 11:19 +0800；獨立只讀複審上下文，依 `AGENTS.md`、`docs/project-management/README.md` 與 `workflows/04-INDEPENDENT-REVIEW.md` 核對，未沿用主要代理的品質評價。
- 審查限制：本輪只執行讀取、hash／schema／focused test／full check／文件治理檢查；未執行 signing、notarization、candidate、post-build audit、stapler、spctl、packaged app、UI／AI／Ollama／model／network。

## 1. 需求完整性

- 判定：部分通過
- 證據：目前 `lib/macos-signed-canary-verification.mjs:111-175` 要求六個固定 code object、Developer ID／runtime／Team ID／effective entitlements、固定 stapler／Gatekeeper 成功分類與 source config ready；`package.json:44,188-190` 與 `electron-builder.signed-canary.mjs` 維持 signed/base build boundary；`scripts/audit-macos-signed-canary-result.mjs:125-253,327-346` 提供 exact schema、privacy guard、全 false scope、cross-field consistency 與 0600 exclusive evidence。round1–round5 的技術 findings 已在目前 source／focused fixture 中收斂，但 round5 報告使用 `### 1. ...`、非 `- 判定：`／`- 證據：` canonical 欄位（該報告第 19–23 行），因此治理格式需求尚未完整滿足。

## 2. 邏輯正確性

- 判定：通過
- 證據：`compareTeamIdentifiers()` 以六段 diagnostics 與 object-order digest 對應並要求非空且一致的 Team ID；`codeObjectReady()` 與 `notarizationReady` 同時要求 Developer ID、runtime、非 ad-hoc、effective entitlements、固定 stapler 成功與 Gatekeeper `accepted`／`source=Notarized Developer ID`。2026-10-29 11:19 +0800 執行的 `node scripts/test-macos-signed-canary-result.mjs` exit 0，包含 permutation、不同 Team ID、malformed／generic Apple output 與 summary consistency 負向矩陣。

## 3. 邊界情況

- 判定：通過
- 證據：focused matrix 覆蓋 missing helper、ad-hoc／non-Developer-ID、missing／malformed entitlements、invalid／generic stapler、generic／矛盾 Gatekeeper、wrong platform／arch、timestamp／interpretation type、helper count／complete contradiction、verification status／errorCode contradiction、scope pollution、source config contradiction 與 forged summary；`validateEvidence()` 在 `scripts/audit-macos-signed-canary-result.mjs:140-253` 對 exact keys、leaf types、status／summary 重算與 leakage fail-closed。未存在 signed candidate 時，audit CLI 不以 unsigned／ad-hoc candidate 代替 signed fixture。

## 4. 程式碼品質

- 判定：通過
- 證據：`lib/macos-signed-canary-build-config.mjs:4-12` 只複製 manifest build、移除 signed canary 的 `mac.identity` 並開啟 hardened runtime／Gatekeeper assess；base `package.json` 仍保持 `identity: null`、`hardenedRuntime: false`、`gatekeeperAssess: false`，signed command 明確使用 `electron-builder.signed-canary.mjs`。`npm run check` 所含相關 `node --check` 全部通過，未發現 round1–round3 已修 findings 的回歸。

## 5. 測試覆蓋

- 判定：通過
- 證據：2026-10-29 11:19 +0800，`npm run check` exit 0，包含治理文件檢查、完整 `npm test`、signed-result／signed-gate／signing-readiness focused tests 與 YouTube posttest；`node scripts/test-project-docs-validator.mjs` 亦由完整 test suite 通過，`git diff --check` exit 0。覆蓋結論限於 deterministic contract、schema、privacy、config boundary 與 blocked gate，沒有把未執行的實際 Apple acceptance 當成測試通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：`docs/project-management/evidence/2026-10-29-fr-021-signed-canary-gate-execution4.json` 權限為 `0600`；其 `gate.ready=false`，原因為 `developer-id-application-not-ready` 與 `notarization-credential-set-not-ready`，`sourceConfigReady=true`、`requiredToolchainReady=true`、`identityReady=false`、`notarizationReady=false`，`runtimeManifestStarted`／`builderStarted`／`candidateCreated` 與所有 scope flags 均為 `false`。依 2026-10-29 11:19 +0800 重新計算，execution4 的 `gateScriptSha256=63d22ec15b56e675db7c20507d5f0eb01f77e29b07020521719d6990a4495571` 對應 `scripts/audit-macos-signed-canary-gate.mjs`，`packageJsonSha256=0980d896c417828d08f17a5ca1399f682c5bc440bf20e2849839d766466ed79a` 對應 `package.json`，`focusedTestSha256=8d6c97c238e9bbae9140de1227d448842ce69d52a821a6dd72f498883209d839` 對應 `scripts/test-macos-signed-canary-gate.mjs`，三者與目前 source 一致。`npm run docs:check:final` 同時實際 exit 1，指出最新 08 條目仍未標示「完成」且缺少可解析的審查檔案與逐字引用；因此本輪沒有 signed candidate、post-build audit、stapler、spctl、packaged app 或產品 acceptance 實測。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 FR-021-DEBUG-20261029-SIGNED-CANARY-POST-AUDIT round6 的 bounded post-build verification contract 依目前 source、round1–round5 與 execution4 核對為技術上有條件通過，但因 round5 報告未使用治理 validator canonical 格式且 08 最新工作條目仍為「進行中」並使 npm run docs:check:final 失敗，須由主要代理補上 round6 報告路徑、逐字結論、條件接受與 final docs gate 後，方可在不宣稱 signing、notarization、candidate、post-build audit、stapler、spctl、packaged app、UI／AI／Ollama／model／network 或 FR-021 overall 完成的前提下完成 bounded contract 治理結案。**
- 阻擋問題（若有）：round5 技術內容可重驗但報告格式不符合 canonical validator；目前 08 最新工作條目仍為「進行中」，且 `npm run docs:check:final` 已實際失敗。主要代理須在不修改本報告及既有 review／evidence 原件的前提下，補上本 round6 路徑、逐字結論、條件接受與剩餘風險，標示 bounded contract 的結案範圍並重新執行 final docs gate；外部 Developer ID identity／notarization credential、signed candidate、實際 Apple post-build acceptance 與 FR-021 overall 仍是未完成風險。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
