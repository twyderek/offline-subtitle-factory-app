# 獨立審查報告：FR-021 packaged Electron helper signing／entitlement audit

- 審查對象 commit／版本：目前工作樹、專案版本 `0.52.0`、分支 `codex/0.51-anthropic-claude`；本輪未指定 commit，工作樹既有變更均予保留。
- 對應 08-CHANGE-LOG 條目：2026-10-28 — packaged Electron helper signing／entitlement audit（`FR-021-DEBUG-20261028-PACKAGED-SECURITY-IDENTITY-AUDIT`）。
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-28（Asia/Taipei）；依使用者指定檔案與目前工作樹重新建立只讀審查上下文，核對 audit source、audit2 evidence、00／03／05／06／07／08 文件與 audit1／audit2 差異，未以主要代理摘要取代原始 evidence。
- 審查限制：本輪只讀取目前工作樹及其指定檔案，未重跑 packaged app、UI、Electron replay、network、Ollama 或模型；未修改任何非本報告檔案。

## 1. 需求與範圍

- 判定：有條件通過
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:3-19` 將本輪界線限定為 current macOS arm64 bundle 的 read-only code-sign／Team ID／flags／CDHash／entitlement／build-config audit，並明確排除 runtime、candidate、Seatbelt、network、Ollama／model、UI／AI flow 與發布資產。
  - `docs/project-management/00-CURRENT-STATUS.md:3-7`、`03-FUNCTIONAL-DESIGN.md:3-7`、`05-DEVELOPMENT-AND-DEPLOYMENT.md:55-57`、`06-TEST-AND-PROCESS-AUDIT.md:3-7`、`07-DEBUG-AND-FIX-HISTORY.md:3-7` 對同一 audit2 結果與結論界線同步：6 個 object deep verify 成功，但全為 ad-hoc、無 Team ID／entitlement；這只是 packaging follow-up seam，不是 root cause 或 UI acceptance。
  - 文件沒有把本輪 audit 擴大為 FR-021 完整驗收；仍保留 nested Chromium blocker、正式 UI offline、全機 egress、Windows 與完整 FR-021 未完成。

## 2. 正確性／安全邊界

- 判定：有條件通過
- 證據：
  - `scripts/audit-macos-packaged-security-identity.mjs:91-114` 限制 macOS arm64，對主 app、Electron Framework 與目前四個標準 Electron helper 建立 code-sign／verification／entitlement 摘要；`codesign --verify --deep --strict`、code-sign command 與 entitlement command 均納入 `allVerified`。
  - `docs/project-management/evidence/2026-10-28-fr-021-packaged-security-identity-audit2.json:23-186` 逐一保存 6 個 object；所有 verification 與 commandSucceeded 均為 true，`allAdHoc=true`、`noTeamIdentifier=true`、`anyEntitlementsPresent=false`、`helperCount=4`，與文件敘述一致。
  - `audit2:198-199` 的 interpretation 明確說明 ad-hoc／missing entitlement 只表示可能需要 packaging／signing follow-up，不代表應停用 sandbox；文件同步沒有把它寫成唯一 root cause 或 UI pass。
- Finding F-01（中低嚴重度、覆蓋完整性）：`scripts/audit-macos-packaged-security-identity.mjs:101-110` 只以固定名稱 regex 收集 helper `.app`，而 `:150` 的 pass gate 也沒有要求 helper inventory 與預期集合一致。對目前 audit2 的 4 個已列 helper 沒有內部矛盾，但若 Frameworks 下存在非匹配名稱的 packaged helper，程式會靜默漏檢，仍可能產生「所有 helper」的過度概括。建議下一輪把 Frameworks 下 `.app` inventory 記錄為 bounded name-only metadata，或對非匹配 helper fail-closed，並補 deterministic regression；此 finding 不改變目前 audit2 已保存 object 的實際結果。

## 3. evidence provenance／不可覆寫與隱私

- 判定：通過（保留 F-01 的 helper inventory residual）
- 證據：
  - `scripts/audit-macos-packaged-security-identity.mjs:93-97` 僅接受 evidence 目錄內的 `.json`，先拒絕已存在檔案；`153` 再以 `flag: 'wx'` 建立，符合 exclusive、不可覆寫邊界。
  - `scripts/audit-macos-packaged-security-identity.mjs:45-69` 不保存 raw code-sign／entitlement XML，只保存欄位摘要、digest 與 byte count；`audit2:188-196` 明確記錄 `rawCommandOutputPersisted=false`、`absolutePathsPersisted=false`，且未保存 candidate 絕對路徑。
  - audit2 的 candidate／Framework／每個 object binary hash、CDHash、bundle identity 與 environment 足以對目前候選做後續唯讀比對；evidence mode 為 `0600`（由工作樹檔案狀態核對）。
  - `audit1` 與 `audit2` 的差異可直接核對：audit1 `summary.allAdHoc=false`、各 object `flags=null`；audit2 已有 `flags=0x2(adhoc)` 且 `summary.allAdHoc=true`。`08-CHANGE-LOG.md:18` 明確標示 audit1 只保留、不作 authoritative citation，audit2 才是修正 parser 後的 authoritative evidence；其他同步文件也只引用 audit2。

## 4. 測試與可重現性

- 判定：部分通過
- 證據：
  - audit2 保存 schema、時間、darwin／arm64／Node／OS、版本、bundle ID、main／Framework SHA-256、6 個 object 的 code-sign／verification／entitlement 摘要與 source build config，足以重算目前 candidate identity 的核心結果。
  - `scripts/audit-macos-packaged-security-identity.mjs:26-37` 對外部 command 設有 timeout／maxBuffer；command failure 會使 `allVerified` fail-closed，並在 evidence status 形成可辨識的 `pass`／`fail`。
  - `package.json:32` 已納入 audit source 的 `node --check`；`scripts/test-ollama-ui-offline.mjs:361-376` 以 source-level assertions 固定 code-sign、entitlement、raw-output exclusion、exclusive create、read-only 與 sandbox 不可停用等 contract。這些是目前工作樹中已記錄的 deterministic／source contract 驗證；本審查未重跑 full check。
  - 由於本輪禁止執行 app／UI／network／Ollama／model，沒有把 audit2 的 metadata pass 誤稱為 runtime reproduction，也沒有宣稱 nested renderer 已可操作。
- 測試 residual：目前未見針對「非匹配 helper `.app` 不得被靜默忽略」的 deterministic test；這與 F-01 相連，應在後續 audit source 修正時補上。

## 5. 治理流程／文件

- 判定：有條件通過
- 證據：
  - 08 work item 已先建立，並記錄需求來源、範圍、預期影響、風險、驗證計畫、實際 audit2 結果與 audit1 非 authoritative 處置；這符合先建立 work item 再修改的流程。
  - 00／03／05／06／07／08 均使用 audit2 的同一組事實與同一結論邊界；沒有文件把 ad-hoc／無 entitlement 寫成根因已證實、sandbox workaround、UI offline pass 或 FR-021 completion。
  - `08-CHANGE-LOG.md:5,19` 仍標示「進行中」且 final checks／本審查待整合，這是正確的治理狀態；本報告完成後仍需由主要代理整合 review、處理 F-01 或明確接受 residual、完成治理 validator／final checks 與 `npm run docs:check:final`，不得先標示本 work item 完成。

## 6. 殘餘風險／結論界線

- 判定：有條件通過
- 證據：
  - audit2 證明的是目前 candidate 的靜態 security identity metadata：6 個被選取的 code object 可 deep verify，全部 ad-hoc、無 Team ID、無 entitlement；它沒有證明簽章／entitlement 缺口就是 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` 的唯一原因。
  - `audit2:188-199` 與 00／03／05／06／07／08 的同步敘述一致記錄 `packagedAppExecuted=false`、`networkConnectionsAttempted=false`、`uiFlowRun=false`、`existingOllamaDaemonStartedOrStopped=false`、`modelDownloaded=false`；本輪沒有任何 packaged app／network／Ollama／model 執行聲稱與 evidence 矛盾。
  - 後續 signed／hardened packaging canary 必須另建隔離 candidate 與新的 exclusive evidence，保留 renderer sandbox、network deny、cleanup 與 provenance gate；不得修改現有 candidate 或使用 `--no-sandbox`／`ELECTRON_DISABLE_SANDBOX` 取得假 pass。
- 主要 residual：F-01 的 helper inventory coverage、缺少正式 signed／hardened candidate 的因果對照、nested Chromium exact generated profile／renderer readiness、真正 per-app／全機 egress、Windows 與 FR-021 完整驗收仍未完成。

## Findings

- F-01：helper inventory 依固定名稱 regex，未對 Frameworks 下其他非匹配 `.app` 做 inventory 或 fail-closed；目前 audit2 的 4 個列出 helper 內部一致，但「所有 helper」的未來／異常 bundle 覆蓋保證不足。此為後續 source／test 改善項，不是目前 audit2 metadata 的反證。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：
  1. F-01 應在下一輪 audit source／deterministic test 中修正或由主要代理明確接受其限定 residual；在未處理前，不宜把 helper coverage 宣稱為對任意 packaged bundle 的完整保證。
  2. 本 work item 目前在 08 仍為「進行中」；本報告、主要代理的開發驗證與 `npm run docs:check:final` 尚未整合完成前，不得治理結案。
- 本輪條件是否已被需求方接受：是；本審查接受的範圍僅為 read-only packaged security identity audit 的 bounded closeout，不代表 FR-021 完整驗收。
- 剩餘風險：目前 candidate 的 ad-hoc／無 Team ID／無 entitlement 只支持 packaging follow-up 假說；尚無正規 signed／hardened 對照證明其會改善 renderer startup，也沒有本輪 app／UI／network／Ollama／model runtime evidence。F-01 的 helper enumeration 仍需補強。
- 給主要開發代理的具體修正要求：
  1. 讓 audit 對 Frameworks 下所有 packaged helper `.app` 做可追溯 inventory，對非預期／非匹配項目 fail-closed 或明確記錄，並補 deterministic regression；不要覆寫 audit1／audit2。
  2. 維持目前對 audit1 的處置：audit1 僅為 parser 修正前的保留原件，audit2 才是 authoritative evidence；不得以 audit1 的 `allAdHoc=false` 重新解讀目前結論。
  3. 整合本報告後再完成主要代理的 focused／full checks、治理 validator、`git diff --check`、scope／immutability guard 與 `npm run docs:check:final`；若修正 F-01，視影響建立 round2，不重跑 app／UI／Ollama／model／network 作為本 audit 的必要條件。
- 可逐字引用的完整結論句：**本輪 FR-021 packaged security identity audit round1 判定為有條件通過：audit2 的 6 個 code object（主 app、Electron Framework、4 個 helper）均通過 deep verification，且 evidence、source、00／03／05／06／07／08 對 read-only scope、exclusive／去敏保存與「ad-hoc／無 Team ID／無 entitlement 只是 packaging follow-up signal」的界線一致；audit1 僅保留為非 authoritative 原件，未被用作結論；但 audit helper 以固定 helper 名稱 regex 發現 helper，未記錄或 fail-closed 排除 Frameworks 下其他非匹配 `.app`，因此 audit 的「所有 helper」保證仍有可改善的覆蓋缺口，且本輪仍未執行 packaged app、network、Ollama、model 或 UI，故不得宣稱 nested Chromium 唯一根因、UI offline pass 或 FR-021 完成。**

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
