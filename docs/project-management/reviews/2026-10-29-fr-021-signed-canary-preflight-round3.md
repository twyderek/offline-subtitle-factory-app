# 獨立審查報告：FR-021 signed canary／notarization prerequisite preflight

- 審查對象：`FR-021-DEBUG-20261029-SIGNED-CANARY-PREFLIGHT`
- 審查輪次：round3 複審
- 審查上下文：獨立讀取目前工作樹、round1／round2 原件、本輪治理文件、source、focused test 與 audit11 evidence；round1／round2 原件未修改。
- 審查範圍限制：未執行 signing、notarization、packaging、keychain、candidate、packaged renderer、UI、AI、Ollama、model 或 network acceptance；未執行會寫入 evidence／candidate／package／keychain 的命令。

## 1. 需求完整性

- 判定：部分通過
- 證據：本輪 bounded requirement 已由目前 source、audit11 與 focused test 覆蓋：credential presence 只保存 boolean，Apple ID／API key／keychain profile 的 absent／partial／complete／ambiguous 分類 fail-closed，且目前單一 complete set 數為 0、`notarizationCredentialReady=false`。round2 指出的 nested leaf exact schema 與 generic POSIX path leakage 已由 `validateVersionSummary()`、command／environment／toolchain／identity／source config／notarization／decision validators、通用 POSIX／Windows／UNC leakage predicate，以及 `/foo/bar`、`/bin/tool`、`/dev/null` 與 nested unknown／type focused cases 關閉。條件是最新 08 工作紀錄仍未同步 audit11 並完成治理 closeout。

## 2. 邏輯正確性

- 判定：通過
- 證據：唯讀核對 `audit11` 顯示 `status=blocked-external-signing-identity`、`identity.validIdentityCount=0`、`decision.formalSigningReady=false`、source config 為 auto-discovery 且 hardened／Gatekeeper true；notarization 狀態為 `absent`、`completeSetCount=0`、`ready=false`。validator 從 credential presence 重算 notarization summary，並要求 evidence 與 decision 關聯一致；source、package 與 focused-test SHA-256 均與 audit11 provenance 相符。0 valid identity 是外部簽章能力 blocker，不是產品程式缺陷。

## 3. 邊界情況

- 判定：通過
- 證據：audit11 的 credential presence、scope、raw output、absolute path、identity name／hash 與 secret flags 均為去敏且 false；evidence mode 為 0600，source／package／focused-test provenance 一致。validator 的 generic path predicate 已拒絕 round2 發現的 `/foo/bar`、`/bin/tool`、`/dev/null`，並拒絕 Windows drive／UNC／secret-shaped／private-key marker；未修改 keychain、candidate、OS network 或正式 package asset。仍須在真正 identity／entitlement 可用後另立隔離 canary，不能把本輪 preflight 擴張成安全性或 runtime acceptance 結論。

## 4. 程式碼品質

- 判定：部分通過
- 證據：00／03／05／06／07 已以 audit11 描述 credential、privacy、0 identity blocker 與 bounded boundary，且明確不宣稱 signed／hardened、effective entitlements、notarization、renderer／UI／AI／Ollama／model／network 或 FR-021 完成；round1／round2 report 原件也保持未修改。可是 08 最新條目仍標示「進行中」、實際結果仍引用 audit10，且缺少本輪獨立審查與發布授權欄位；因此 `npm run docs:check:final` 實際 exit 1。這是治理 closeout 缺口，不否定 audit11 或 source/test 結果。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：`node scripts/test-macos-signing-readiness.mjs`、`node scripts/test-project-docs-validator.mjs`、`git diff --check` 與完整 `npm run check` 均實際 exit 0；focused test 實際涵蓋 round2 要求的 nested unknown／type 與 generic POSIX negative cases，也涵蓋 credential matrix、derived mismatch、unknown top-level key、provenance／privacy fail-closed。audit11 invariant 核對 status、0 identity、notarization、scope 全 false、三份 provenance hash 與 0600 mode 均成立。這些是 preflight／contract tests，不是 signed canary 或 packaged acceptance tests。

## 6. 實際運行結果

- 判定：通過
- 證據：本輪實際 scope 全部保持 false：未 signing、未 notarization、未 packaging、未執行 packaged app／renderer／UI／AI／Ollama／model、未嘗試 network acceptance，也未建立 signed／hardened candidate。audit11 的 `blocked-external-signing-identity` 正確阻止 formal canary；本輪只能結案 bounded prerequisite contract，不能作為發布授權、signed／hardened canary、effective entitlements、實際 notarization 或 FR-021 overall completion。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 `FR-021-DEBUG-20261029-SIGNED-CANARY-PREFLIGHT` round3 bounded preflight 有條件通過：audit11 的 credential presence／derived notarization summary／nested exact schema／generic path privacy gate、focused regression、provenance／scope／0600 與完整 `npm run check` 均成立，且 `validIdentityCount=0` 仍是阻止 formal canary 的 external signing blocker；本輪不代表 signed／hardened canary、effective entitlements、實際 notarization、packaged renderer／UI／AI／Ollama／model／network acceptance 或 FR-021 整體完成，並須先補正 08 的 audit11／round3治理 closeout 與 `npm run docs:check:final`。**
- 阻擋問題（若有）：有條件阻擋。最新 08 工作紀錄尚未引用 audit11、尚未標示完成，且缺少獨立審查／發布授權欄位，導致 `npm run docs:check:final` 失敗；此外 0 valid identity 的 external blocker、實際 signed／hardened canary、effective entitlements、notarization 與後續 packaged renderer／UI／AI／Ollama／model／network acceptance 仍是本 phase 之外的 residual risk。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
