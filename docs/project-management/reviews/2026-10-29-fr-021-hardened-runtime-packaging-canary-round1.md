# 獨立六面向審查報告：FR-021 isolated hardened-runtime packaging canary

- 審查對象：`FR-021-DEBUG-20261029-HARDENED-RUNTIME-PACKAGING-CANARY`
- 審查上下文：目前工作樹、指定 repo 外 macOS arm64 candidate metadata，以及 work item 所列 build／audit evidence；上一輪 audit3／round2 僅作 immutable baseline。
- 審查限制：未執行 packaged app、UI、Electron replay、network probe、Ollama 或模型；本報告為 read-only evidence／文件／source contract review。
- 唯一寫入：本報告。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md` 最新條目明確記錄 work item、repo 外隔離 output、CLI `mac.hardenedRuntime=true` request、既有 candidate 不覆寫、不得使用 sandbox-disabling flags，以及沒有有效 identity 對照時停止 startup probe 的條件。`00/03/05/06/07` 均同步記錄相同的 bounded scope 與未完成 FR-021 的界線。
- 證據：`2026-10-29-fr-021-hardened-runtime-packaging-canary-build1.json` 的 scope 明確記錄新 candidate 建立、既有 candidate 未修改、未執行 packaged app／UI／startup probe、未啟停 Ollama、未下載模型，並記錄 `dependencyDownloadOccurred: true`；文件同步明確揭露該 dependency download。
- 證據：`2026-10-29-fr-021-hardened-runtime-packaging-canary-audit1.json` 明確限定為 code-sign／entitlement metadata audit，沒有把 metadata pass 擴大為 renderer readiness、UI offline、根因或 FR-021 completion。

## 2. 邏輯正確性

- 判定：通過
- 證據：build1 將 `requestedOverrides.mac.hardenedRuntime` 記為 `true`，同時將 `signingSkippedBecauseIdentityIsNull`、`effectiveCodeSignChanged`、`effectiveEntitlementsChanged` 與 `effectiveHardenedRuntimeEvidence` 分別記為 `true`、`false`、`false`、`false`；這正確區分 CLI request 與 effective security identity。
- 證據：audit1 的 source config 顯示 `macIdentityConfigured: null`、`hardenedRuntimeConfigured: false`、`gatekeeperAssessConfigured: false`。此欄位代表 repo package manifest 的既有設定，不被誤讀成 CLI override 已生效；build1 才是本輪 request／effective identity 的對照記錄。
- 證據：audit1 的 6 個 code objects 均 `verification.succeeded=true`、`codeSign.commandSucceeded=true`、`entitlements.commandSucceeded=true`，summary 為 `allVerified=true`、`allAdHoc=true`、`noTeamIdentifier=true`、`anyEntitlementsPresent=false`；helper inventory 的 expected、missing、unexpected 分別完整、空、空。
- 證據：canary candidate 的 executable／Framework SHA-256 與 build1／audit1 互相一致；Framework SHA-256 亦與上一輪 audit3 baseline 一致。這支持「新 candidate 建立、不是有效 hardened identity 對照」的解讀。

## 3. 邊界情況

- 判定：通過
- 證據：指定 repo 外 canary candidate 的唯讀 metadata 顯示主 app 為 `flags=0x2(adhoc)`、`TeamIdentifier=not set`，`codesign --verify --deep --strict` 通過；Frameworks 下列出 4 個預期 helper，與 audit1 inventory 完整結果一致。這沒有被誤報為 signed／hardened pass。
- 證據：既有 `../dist/mac-arm64/離線字幕工廠.app` 的 executable SHA-256 仍為上一輪 audit3 baseline 的 `b3605c589459068f894a70896b8ed843be3832a839fcdd83aa898e9b16210de4`，Framework SHA-256 仍為 `416b6c8cf74c59188266d3ff7a3fc77b9f68bb52f7328d98b382d132580c8cee`；build1 也記錄 `existingCandidateModified=false`。
- 證據：build1 記錄 dependency download occurred，且文件沒有把它描述成 packaged app network 或 UI network；同時沒有保存 raw build output 或絕對路徑。
- 證據：由於 effective identity 沒有變化，文件與 build1 均記錄未執行 startup probe。這避免在沒有有效對照時產生無法解釋的 renderer 結果。

## 4. 程式碼品質

- 判定：通過
- 證據：`scripts/audit-macos-packaged-security-identity.mjs` 以 Frameworks 下所有 `.app` 做 inventory，保存 expected／missing／unexpected helper names，並以 `helperInventoryComplete` 納入 pass gate；evidence 以 `flag: 'wx'` exclusive create，scope 記錄 `candidateModified: false` 與 raw output 不落盤。
- 證據：audit helper 的 interpretation 明確寫出 ad-hoc／missing entitlement 只表示 packaging follow-up，不表示 sandbox 應被關閉；source 不包含 `--no-sandbox` 或 `ELECTRON_DISABLE_SANDBOX`。
- 證據：focused source contract 已核對 code-sign、entitlement、exclusive evidence、helper inventory、fail-closed 與禁止 sandbox-disabling flags；沒有因本輪 canary 偷改正式 `package.json` macOS config、runtime、Seatbelt 或 network policy。

## 5. 測試覆蓋

- 判定：通過
- 證據：本輪 evidence assertion 已核對 build1 的 requested／effective identity、dependency download disclosure、scope stop gate，以及 audit1 的 6 objects、helper inventory、ad-hoc／Team ID／entitlement 結果與 canary／baseline hash 關聯；source syntax、focused source contract、`git diff --check` 與治理文件 validator 均已通過。
- 證據：`docs/project-management/08-CHANGE-LOG.md` 記錄 canary audit、scope guard、raw-output／path guard 與後續完整 checks 的治理要求；目前 work item 仍為進行中，沒有把本輪 bounded metadata review 誤作最終 FR-021 acceptance。
- 證據：沒有以缺少 runtime 對照為理由補跑 packaged app、UI、Electron replay、network、Ollama 或模型；這是 work item 明確要求的 fail-closed 覆蓋策略，而非測試遺漏。

## 6. 實際運行結果

- 判定：部分通過
- 證據：build1 可支持「electron-builder 建立新 candidate，但因 `identity: null` 跳過 macOS code signing」；audit1 可支持「6 個 code objects deep verify 成功、全 ad-hoc、無 Team ID、無 entitlement、helper inventory complete」。
- 證據：repo 外 candidate metadata 的主 app為 `Signature=adhoc`、`TeamIdentifier=not set`，Frameworks inventory 為 4 個預期 helper；既有 current candidate 的 baseline hash 未變。上述結果與 build1／audit1 完全一致。
- 證據：本輪沒有 packaged app／UI／Electron replay／network probe／Ollama／model 實際運行，且 build1 明確記錄 `startupProbeRun=false`。因此結果只到「沒有形成有效 hardened-runtime security identity 對照」的 packaging canary 結論，不是 renderer readiness 或 UI offline 結論。

## Findings

- none

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無新增的 evidence／文件／source contract finding；但 CLI hardened-runtime request 沒有形成 effective signed／hardened identity 對照，既有 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／renderer blocker 與 FR-021 未完成狀態仍保留。
- 可逐字引用的完整結論句：**本輪 FR-021 isolated hardened-runtime packaging canary 有條件通過：build1 誠實區分了 CLI `mac.hardenedRuntime=true` request 與因 `identity: null` 而跳過 signing 的 effective identity，audit1 與 repo 外 metadata 一致顯示新 candidate 的 6 個 code objects 全為 ad-hoc、無 Team ID／entitlement 且 helper inventory complete，既有 candidate 未修改、dependency download 已揭露，並因沒有有效 security identity 對照而未執行 startup probe；本輪只接受 bounded packaging metadata 結論，不能宣稱 renderer readiness、UI offline、nested Chromium 根因、全機 egress、Windows 或 FR-021 完整驗收。**

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
