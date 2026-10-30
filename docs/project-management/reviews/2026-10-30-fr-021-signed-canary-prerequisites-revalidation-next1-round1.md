# 獨立審查報告：FR-021 macOS signed-canary external prerequisites revalidation next1

- 審查對象 commit／版本：local HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b`／0.52.0；authoritative evidence 為 `next14` SHA-256 `3f9055efef9e7af3a508c485ac55910a5a787eeefa0e5cd4db9f26f429a0789f`、`next6` SHA-256 `15f43ad1722344019cf48e3d2e5b8d0edae280d5283c51ef05f99b3585cc5cfa`、`execution6` SHA-256 `ae372012947ffecb12f29ce607b7854474804dc78e18011b30bac4a0b5edee39`。
- 對應 08-CHANGE-LOG 條目：2026-10-30 — FR-021 macOS signed-canary external prerequisites revalidation next stage（`FR-021-MACOS-SIGNED-CANARY-PREREQUISITES-REVALIDATION-20261030-NEXT1`）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-30（Asia/Taipei）；獨立讀取 repo `AGENTS.md`、full preflight 列出的治理文件、10/30 `00`／`05`／`06`／`07`／最新 `08` 條目、三份 authoritative evidence、三支 audit script 與三支 focused test，未以主要代理的評價性摘要取代證據。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:7-14` 將範圍限定為 `next14`／`next6`／`execution6` 的 current-source、read-only、去敏 immutable revalidation，排除 remote／keychain／candidate write、workflow、builder、runtime manifest、codesign、notarization、stapler、Gatekeeper 與 release；`00-CURRENT-STATUS.md:3-8`、`05-DEVELOPMENT-AND-DEPLOYMENT.md:3-7`、`06-TEST-AND-PROCESS-AUDIT.md:3-8`、`07-DEBUG-AND-FIX-HISTORY.md:3-7` 對 scope、blocker unchanged 與不得宣稱 signed candidate 的解讀一致。三份 evidence 是 10/30 新檔，沒有以 10/29 evidence 冒充本輪結果。

## 2. 邏輯正確性

- 判定：通過
- 證據：external audit 的 `buildSummary()`／validator（`scripts/audit-macos-signed-canary-external-boundary.mjs:182-244,285-313`）將 Environment、required reviewer、secret scope、branch protection 缺口精確投影為四個 reasons；`next14.json:13-65` 顯示 remote workflow／source match 為 true，但四項配置為 `not-found`／false、`ready=false`／`status=fail`。readiness classifier（`scripts/audit-macos-signing-readiness.mjs:522-583,615-650`）與 formal gate evaluator（`scripts/assert-macos-signed-canary-ready.mjs:79-128`）均先分離 source/toolchain readiness，再以 identity／credential 決定 formal readiness；`next6.json:66-108,162-170` 的 `validIdentityCount=0`、`formalIdentityAvailable=false`、credential 全 false、notarization `absent` 與 `formalSigningReady=false`，以及 `execution6.json:12-23` 的兩個 gate reasons 均一致。`next14`／`next6` 明確保存 current HEAD，且 execution6 的三個 source-byte hashes 已由本輪重算與 current files 相符、三階段啟動時間同批；因此可支持 current-source cross-stage revalidation，但 execution6 自身只保存 gate／package／focused-test hashes，不能被過度表述為自身另有 `gitHead` 欄位。`sourceConfigReady=true`／`requiredToolchainReady=true` 僅是 prerequisite projection，未被擴大為 signed candidate。

## 3. 邊界情況

- 判定：通過
- 證據：`scripts/test-macos-signed-canary-external-boundary.mjs:27-115` 覆蓋 complete pass、空／缺失／錯誤 reviewer metadata、四項 remote 404、remote SHA mismatch、404／403／malformed／timeout、secret metadata、scope／privacy 與 exclusive writer；`scripts/test-macos-signing-readiness.mjs:98-204` 覆蓋 identity probe failure／malformed output、0 identity、toolchain／source target 變體、credential absent／partial／ambiguous、derived mismatch、unknown keys、scope 與 leakage；`scripts/test-macos-signed-canary-gate.mjs:54-180` 覆蓋 ready／keychain route、credential 狀態矩陣、invalid identity、source／toolchain／platform failure、notarization consistency、profile probe 與禁止舊 credential flags。authoritative evidence 的 privacy／scope 亦 fail-closed：`next14.json:67-84` 只讀 remote metadata 且 `secretValuesRead=false`；`next6.json:172-188` 全 scope false；`execution6.json:69-97` 的 execution 與完整 scope 全 false。

## 4. 程式碼品質

- 判定：通過
- 證據：三支 audit 均採 exact schema／derived-field validation、bounded projection、去敏欄位與 exclusive `wx`／mode `0600` writer；external audit 對 response、summary、provenance、scope、leakage 驗證見 `scripts/audit-macos-signed-canary-external-boundary.mjs:285-319`，readiness 對 provenance、credential、identity、scope、leakage 見 `scripts/audit-macos-signing-readiness.mjs:615-650`，formal gate 對 gate result、execution、scope、source hashes、leakage 見 `scripts/audit-macos-signed-canary-gate.mjs:64-75,118-120`。本輪重算結果確認三份檔案均為 mode `0600`，SHA 與治理摘要一致；未發現需要主要代理修改 source 的技術 finding。

## 5. 測試覆蓋

- 判定：通過
- 證據：2026-10-29T23:10:36Z（UTC）本輪實際執行三支 audit `node --check`、`node scripts/test-macos-signed-canary-external-boundary.mjs`、`node scripts/test-macos-signing-readiness.mjs`、`node scripts/test-macos-signed-canary-gate.mjs`、`node scripts/test-project-docs-validator.mjs`、`npm run docs:check` 與 `git diff --check`，全部 exit 0；focused outputs 分別確認 bounded GitHub projection／secret redaction、identity／privacy fail-closed、identity／toolchain／source config／notarization fail-closed。只讀 invariant probe 另確認三份 SHA／0600、`next14`／`next6` HEAD match、execution6 current source hashes、四個 external reasons、兩個 gate reasons 與全 false flags；未執行禁止的 workflow、builder、runtime manifest、codesign、notarytool、stapler、Gatekeeper 或 release。

## 6. 實際運行結果

- 判定：部分通過
- 證據：三份 evidence 的實際結果是：`next14.json:46-58,83-84` 正確記錄四項 external configuration gap、remote workflow／source match 不代表 handoff ready；`next6.json:66-78,101-108,162-189` 正確記錄 identity probe 成功但 0 valid identity、credential absent；`execution6.json:12-23,69-97` 正確以 `developer-id-application-not-ready`／`notarization-credential-set-not-ready` 在 runtime manifest／builder 前停止，candidate、signing、notarization 與其餘 scope 全 false。故本輪重新驗證了 10/29 blocker，而非沿用舊 evidence；但沒有真實 signed workflow、signed／notarized candidate、Apple ticket、stapler 或 Gatekeeper 結果，不能升格為 FR-021 runtime acceptance。`npm run docs:check:final` 實際 exit 1，原因是使用者限定不得修改 08，導致最新條目仍缺少「獨立審查是否執行：」／「發布授權：」且仍為「進行中」；這是本輪 report-only 的治理 closeout 限制，不是 source 或 revalidation contract failure。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 FR-021 macOS signed-canary external prerequisites revalidation next1 獨立審查結論為有條件通過：`next14`、`next6`、`execution6` 的 current-source bounded evidence、schema／privacy／scope 與 cross-stage fail-closed interpretation 均如實，`next14` 正確記錄 GitHub Environment／required reviewer／secret scope／protected branch 缺口，`next6` 正確記錄 0 valid Developer ID identity／credential absent，`execution6` 正確以 `developer-id-application-not-ready`／`notarization-credential-set-not-ready` 在 runtime manifest／builder 前停止且 execution／scope 全 false；條件僅為外部 prerequisites 與真實 signed workflow 尚未具備，因此不得宣稱 signed／notarized candidate、Apple ticket、release 或 FR-021 overall acceptance。**
- 阻擋問題（若有）：外部 `macos-signed-canary` Environment／required reviewer／secret scope／protected branch、核准 Developer ID Application identity／完整 notarization credential 與真實 signed workflow 尚未具備；本輪無需主要代理修改 source 的技術 finding。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
