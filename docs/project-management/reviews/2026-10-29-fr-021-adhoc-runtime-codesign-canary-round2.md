# 獨立六面向複審報告：FR-021 isolated ad-hoc runtime code-sign canary

- 審查對象：`FR-021-DEBUG-20261029-ADHOC-RUNTIME-CODESIGN-CANARY`
- 審查輪次：round2
- 複審範圍：round1 F-01 修正後的目前工作樹、authoritative audit2、原始 audit1／sign1／probe1／probe2 evidence，以及 00／03／05／06／07／08 最新同步；previous candidate、audit3 與 hardened canary 僅作 immutable baseline。
- 審查限制：未執行 packaged app、任何 runtime、UI、Electron replay、network、Ollama 或模型；唯一寫入本報告。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-22` 明確記錄 round1 F-01、required `runtime` gate 修正、authoritative audit2、原件未覆寫，以及本輪不把 runtime flag 或 startup failure 解讀成 FR-021 pass；work item 仍為進行中。
- 證據：`00-CURRENT-STATUS.md`、`03-FUNCTIONAL-DESIGN.md`、`05-DEVELOPMENT-AND-DEPLOYMENT.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md` 的最新 ad-hoc runtime 段落均保留無 Team ID／entitlement、probe failure、`systemNetworkDisabled=false`、未跑 UI／AI／Ollama／model 與 FR-021 未完成界線。
- 證據：round1 報告 `## Findings` 的 F-01（round1:55-63）要求 exact `0x10002(adhoc,runtime)` fail-closed source gate；目前 source、test assertion、audit2 與文件均對應此修正要求。

## 2. 邏輯正確性

- 判定：通過
- 證據：`scripts/audit-macos-packaged-security-identity.mjs:10-12,92-98` 將第四參數讀為 `requiredCodeSignFlag`，只允許可選值 `runtime`；`summary` 保存該要求與滿足結果，`status` 將 `requiredCodeSignFlagSatisfied` 納入 pass gate（同檔:124-127,147-156,174）。
- 證據：authoritative `docs/project-management/evidence/2026-10-29-fr-021-adhoc-runtime-signing-canary-audit2.json` 的 summary 記錄 `requiredCodeSignFlag: "runtime"`、`requiredCodeSignFlagSatisfied: true`、`allRuntimeFlagsObserved: true`、`allVerified: true`；這與「以第四參數 `runtime` 執行」的 source contract 及 08 的 required-runtime gate 記錄一致（audit2:182-190；08:17,21）。
- 證據：audit2 六個 object（主 app、Framework、4 helpers）逐筆均為 `flags: "0x10002(adhoc,runtime)"`、`verification.succeeded: true`、`codeSign.commandSucceeded: true`、`teamIdentifier: "not set"`、`entitlements.present: false`（audit2:25-175）。
- 證據：`scripts/test-ollama-ui-offline.mjs:369-371` 有 `allRuntimeFlagsObserved`、`requiredCodeSignFlagSatisfied` 與 exact `0x10002(adhoc,runtime)` assertions；round1 指出的 source gate 缺口已由可檢查的 deterministic contract 補上。

## 3. 邊界情況

- 判定：通過
- 證據：audit2 inventory 記錄 4 個 expected helper、`missingHelperBundleNames: []`、`unexpectedHelperBundleNames: []`、`helperInventoryComplete: true`；主 app／Framework／4 helpers 共 6 objects 均納入 audit（audit2:187-200）。
- 證據：audit2 scope 保持 `candidateModified=false`、`networkConnectionsAttempted=false`、`packagedAppExecuted=false`、`uiFlowRun=false`、`existingOllamaDaemonStartedOrStopped=false`、`modelDownloaded=false`、`rawCommandOutputPersisted=false`、`absolutePathsPersisted=false`（audit2:209-216）。
- 證據：audit1、sign1、probe1、probe2 仍各自存在於原始檔名；目前只讀 SHA-256 分別為 `47407140bd0d301e23150fda64c4ba130cacabdd0b106dcd7620d47a263b8cff`、`8c11e52842f0b4f051f1da94e8040b0b2b6f432170142711ff19d528d30412e4`、`d3398987935d290ceee739ec58b32f9b28dc9839e557fbb6c66f6119946b3785`、`1fc4aa7d91e36822c405143533fd0aa7f858a0161502573936c06dbf0f8343cf`；audit2 是獨立的新檔名，沒有以 audit1 覆寫。
- 證據：`audit-macos-packaged-security-identity.mjs` 仍以 exclusive `flag: 'wx'` 建立 evidence（同檔:177），test source 保留 helper inventory、raw-output、read-only 與 sandbox boundary assertions；未出現 sandbox-disabling implementation。

## 4. 程式碼品質

- 判定：通過
- 證據：F-01 修正採用可選 required flag，而不是硬編碼所有 future audit 都必須 runtime；未提供 requirement 時 `requiredCodeSignFlagSatisfied` 為 true，提供 `runtime` 時才要求每個 object exact `0x10002(adhoc,runtime)`（`scripts/audit-macos-packaged-security-identity.mjs:12,126-127`）。這保留了 metadata audit 的通用性，同時使本 canary 可 fail-closed。
- 證據：audit source 的 exact equality、summary provenance 與 status gate 位於同一計算鏈；test source 同時檢查 exact literal、runtime aggregate 與 required gate，避免只新增輸出欄位而未影響判定（audit source:124-127,147-152,174；test source:369-371）。
- 證據：audit source 的 interpretation 仍明確說明 ad-hoc／缺少 entitlement 是 packaging follow-up，不是關閉 sandbox 的理由；沒有將 runtime flag、metadata status 或 child failure 轉譯為 UI／AI／FR-021 acceptance。

## 5. 測試覆蓋

- 判定：通過
- 證據：本複審只執行 read-only static／JSON checks：核對 audit2 `status=pass`、required runtime gate、6 objects exact flags／verify、inventory、scope/privacy，以及原件存在與 SHA-256；結果通過。未執行 packaged/runtime，符合本輪限制。
- 證據：`scripts/test-ollama-ui-offline.mjs:369-376` 覆蓋 exact runtime flag、required gate、raw output、read-only audit、exclusive evidence、packaged UI 非 acceptance 與禁止 sandbox-disabling flags；這已補足 round1 F-01 的 deterministic source assertion。
- 證據：round1 原件中的 `F-01` 已由目前 source／test／audit2 三方交叉證明修正；audit1／sign1／probe1／probe2 的原始內容仍保留，沒有以修正後 audit2 混替歷史證據。

## 6. 實際運行結果

- 判定：部分通過
- 證據：authoritative audit2 的實際 metadata 結果為 `status=pass`、required runtime gate true、6 objects exact runtime flag、deep verification true、無 Team ID／entitlement；這只代表本次 ad-hoc code-sign metadata gate 通過，不代表正式 signed／hardened package。
- 證據：既有 probe1／probe2 原件仍分別記錄 `status=fail`、無 local page／CDP、child `SIGABRT`／`ELECTRON_EARLY_EXIT`，同時 process group closed、temporary root removed；這些 failure signal 未被改寫成 pass。
- 證據：probe 原件記錄 loopback control-plane、`externalSocketAttempted=false`、`systemNetworkDisabled=false`、outer sandbox applied、sandboxed target process tree、未跑 packaged UI／Ollama／model；因此不能把本輪結果描述成全機斷網、UI/AI 通過或 FR-021 完成。
- 證據：00／03／05／06／07／08 最新同步仍明確保留 nested Chromium blocker、未完成 FR-021 與 ad-hoc／無 Team ID／無 entitlement 風險；08:18-22 也明確禁止把 runtime flag 或 startup failure 解讀成 FR-021 pass。

## Findings

- none（round1 F-01 已修正；本複審未發現新的 evidence、source、scope 或文件同步 finding。）

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無新增阻擋；本輪條件是維持 bounded diagnostic 解讀：ad-hoc runtime flag 與 audit2 metadata gate 通過不等於正式簽章、UI／AI readiness 或 FR-021 acceptance，既有 `SIGABRT`／nested Chromium blocker 仍保留。
- 可逐字引用的完整結論句：**本輪 FR-021 isolated ad-hoc runtime code-sign canary round2 通過 round1 F-01 修正：audit helper 以可選第四參數 `runtime` 計算並納入 `allRuntimeFlagsObserved`／`requiredCodeSignFlagSatisfied`，focused test 具備 exact `0x10002(adhoc,runtime)` 與 gate assertions，authoritative audit2 status 為 pass 且 6 個 objects 均 exact runtime flag、deep verify 通過、inventory／scope／privacy 一致，audit1／sign1／probe1／probe2 原件未覆寫，round1 findings 為 none；但本輪仍只證明 bounded ad-hoc packaging metadata 與既有 startup blocker，不能宣稱正式 signed／hardened package、UI／AI 或 FR-021 pass。**

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
