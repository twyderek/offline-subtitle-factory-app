# 獨立審查報告：FR-021 packaging config readiness

- 審查對象 commit／版本：`c06d15e95a2f0a0981518c5873003a460e57a5ee`／0.52.0；工作樹保留既有 source、package、evidence 與治理變更。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — formal packaging source configuration readiness（`FR-021-DEBUG-20261029-PACKAGING-CONFIG-READINESS`）。
- 審查輪次：round3 bounded closeout review。
- 審查代理啟動時間、上下文來源：2026-10-29T02:22:03Z（UTC）；本報告由新的獨立上下文建立，未沿用主要開發代理的評價性結論。

本輪只讀檢查目前工作樹、round1／round2 原件、readiness source、package config、audit7、治理文件與本地 electron-builder source。除建立本報告外，未執行 signing、notarization、electron-builder packaging、packaged app、renderer／UI、AI／Ollama／model 或 network acceptance。

## 1. 需求完整性

- 判定：通過
- 證據：`package.json:168-188` 已省略 `build.mac.identity`，並設定 `hardenedRuntime=true`、`gatekeeperAssess=true`；audit7 `:80-86` 對應記錄 `identityConfiguration=auto-discovery` 與 `sourceConfigReady=true`，符合本工作項目只收斂 source packaging readiness、而不宣稱正式 signed package 的範圍。
- 證據：`docs/project-management/00-CURRENT-STATUS.md:3-7`、`05-DEVELOPMENT-AND-DEPLOYMENT.md` macOS 打包段落及 `08-CHANGE-LOG.md:3-31` 均將目前結果限定為 bounded preparation，明確保留 external identity blocker；本輪沒有把這項工作擴大為 FR-021 完成。
- 本輪不等同 signed／hardened canary、renderer／UI／AI／Ollama／model／network acceptance，也不等同 FR-021 完成。

## 2. 邏輯正確性

- 判定：通過
- 證據：本地 `node_modules/app-builder-lib/out/macPackager.js:328-339` 顯示 `identity === null` 會直接走 null identity path，而 `macCodeSign.js:263-278` 顯示省略 identity 時可由 `CSC_NAME` 或 keychain auto-discovery 選擇 identity；`flags.js:13-14` 顯示 auto-discovery 預設開啟。source classifier `scripts/audit-macos-signing-readiness.mjs:189-215` 與這個 contract 一致。
- 證據：`classifyReadiness()` `scripts/audit-macos-signing-readiness.mjs:245-292` 在 provenance、identity probe、existing evidence、toolchain、formal identity 與 source config 間 fail-closed；audit7 `:148-155` 實際結果為 `toolchainReady=true`、`sourceConfigReady=true`、`formalSigningReady=false`、`status=blocked-external-signing-identity`，因此沒有把 source seam ready 誤判成 formal signing ready。
- round1 F-01 已關閉：`sourceRevision()` `:322-336` 使用 `--untracked-files=all`，並綁定 audit script、package.json、focused test 三份 SHA-256；round1 F-02 已關閉：`:349-367` 移除不受支援的 codesign／productbuild `--version` probes，只保留 executable presence、xcrun lookup 與受支援的 `sw_vers`。

## 3. 邊界情況

- 判定：通過
- 證據：`node scripts/test-macos-signing-readiness.mjs` exit 0，實際覆蓋 identity command failure、malformed output、required toolchain failure、auto-discovery、explicit-null、explicit-ad-hoc、hardened false、existing evidence cardinality／污染、unknown／sensitive scope、wrong type 與 privacy fail-closed cases。
- 證據：audit7 `:66-86` 的 identity probe 可解析但為 `validIdentityCount=0`、`formalIdentityAvailable=false`；`:157-171` 的 candidate、keychain、signing、notarization、network、packaged app、UI、Ollama、model、raw output、path、identity 與 secret flags 全為 false，未以缺少 identity 的 ad-hoc metadata 解除 formal canary gate。
- R-01 仍保留：`sourceBuildConfig.entitlementsConfigured=false` 不被誤解為 effective entitlements 已驗證；後續 signed canary／release preflight 仍須實際核對 effective entitlements、簽章驗證與完整 notarization credential boundary。

## 4. 程式碼品質

- 判定：通過
- 證據：readiness source 將 config summarization、identity parsing、existing evidence validation、readiness classification 與 evidence privacy validation 分離；寫檔前執行 `validateReadinessEvidence()`，並以 `flag: 'wx'`、mode `0600` 保存 evidence。audit7 檔案實測 mode 為 `600`。
- 證據：audit7 `sourceRevision` `:21-28` 的 provenance scope 為 `audit-script-package-json-focused-test`，三份 SHA-256 與目前檔案重算一致；本輪自訂 invariant 亦確認 status／decision、source config、identity zero、evidence cardinality、privacy scope 均成立。
- 本輪 findings：none；未發現新的 source、privacy、signing semantics、provenance 或 maintainability 缺口。後續若擴大 provenance scope，仍須另立 schema／evidence／focused assertions，不應把目前三檔 scope 解讀為完整工作樹 snapshot。

## 5. 測試覆蓋

- 判定：通過
- 證據：2026-10-29T02:22Z 前後實際執行 `node --check scripts/audit-macos-signing-readiness.mjs`、`node --check scripts/test-macos-signing-readiness.mjs`、focused readiness test、`node scripts/test-project-docs-validator.mjs`、`npm run docs:check`、`npm run check` 與 `git diff --check`，全部 exit 0；`docs:check` 回報 19 個治理文件通過。
- 證據：完整 `npm run check` 實際通過 syntax、deterministic regression、治理 validator、readiness focused contract 與既有離線測試；其輸出沒有執行 signing、notarization、electron-builder packaging、packaged app、renderer／UI、AI／Ollama／model 或 network acceptance。
- round2 原件格式問題已獨立核對：以目前 `scripts/project-docs-validator.mjs` 驗證 round2 報告，結果缺少六個固定標題下的有效判定／具體證據、逐字結論句與阻擋問題欄位；因此 round2 保留為原件但不作最新引用，本報告提供格式合規的 round3 引用候選。

## 6. 實際運行結果

- 判定：通過
- 證據：audit7 `docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit7.json:66-86,148-175` 與目前 source／package／focused-test SHA-256 交叉核對一致；audit7 invariant exit 0，明確得到 `validIdentityCount=0`、`formalSigningReady=false`、`blocked-external-signing-identity`，所以 formal signed／hardened canary 仍被正確阻止。
- 證據：本輪未執行任何會改變 keychain、candidate、既有 evidence 或治理原件的操作；未執行 signing、notarization、electron-builder packaging、packaged app、renderer／UI、AI／Ollama／model／network acceptance。故本輪不等同 signed／hardened canary、renderer／UI／AI／Ollama／model／network acceptance 或 FR-021 完成。
- 治理結果仍有條件：`npm run docs:check:final` 於本報告建立前 exit 1，唯一回報為最新工作紀錄已執行獨立審查但缺少可解析的審查檔案與逐字引用；主要代理整合本報告後仍須重跑 final gate。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 `FR-021-DEBUG-20261029-PACKAGING-CONFIG-READINESS` round3 bounded closeout review 有條件通過：package 的 auto-discovery source seam、hardened／Gatekeeper 設定、round1 F-01／F-02 修正、audit7 provenance／privacy／status／decision 與指定回歸驗證均成立，且以 0 valid identities／`formalSigningReady=false` 正確阻止 formal signed／hardened canary；本輪不等同 signed／hardened canary、renderer／UI／AI／Ollama／model／network acceptance 或 FR-021 完成，R-01 的 effective entitlements／完整 notarization credential boundary、external signing identity 與 governance final docs gate 仍是後續條件。**
- 阻擋問題（若有）：本輪沒有新的 source／evidence finding；bounded closeout 的條件是取得核准 external Developer ID Application identity／entitlement 後另立隔離 signed canary、保留 R-01 的 effective entitlements／完整 notarization credential boundary，並由主要代理將本 round3 報告與上述完整結論句整合至 08 後使 `npm run docs:check:final` 通過。
- 本輪 findings：none。round1 F-01／F-02 已關閉；round2 原件格式問題已確認且不作最新引用；R-01 未被誤宣稱完成。
- 遺留風險與未完成項目：目前沒有 Developer ID Application identity；沒有正式 signed candidate、notarization 或 effective entitlements 對照；既有 nested Chromium／packaged renderer blocker、真正全機 egress、Windows 與完整 FR-021 acceptance 仍未完成。不得以 auto-discovery seam、ad-hoc runtime flag、metadata pass 或本輪 full check 取代後續 signed canary。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告未修改 round1／round2 報告、source、package、evidence 或治理文件；round1／round2 原件均保留。
- 若上述聲明不實，本報告無效。
