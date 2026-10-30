# 獨立審查報告：FR-021 macOS signed-canary external prerequisites revalidation next2

- 審查識別：`FR-021-MACOS-SIGNED-CANARY-PREREQUISITES-REVALIDATION-20261030-NEXT2`／round1
- 審查對象：local HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b`／版本 `0.52.0`
- 審查代理啟動時間、上下文來源：2026-10-30 07:25:23 +0800（Asia/Taipei）；獨立上下文，重新讀取本輪治理、evidence、source 與 focused tests，未以主要代理評價取代證據。
- 審查限制：只讀、執行與驗證；不觸發 workflow、keychain、builder、codesign、notarytool 或外部寫入。

## 審查輸入

- `AGENTS.md:1-16`；`docs/project-management/README.md:18-66`；full preflight：`npm run project:preflight -- --type=full`，exit 0。
- 治理規則：`docs/project-management/01-PROJECT-GOVERNANCE.md:5-14,18-32,34-46,48-64`、`docs/project-management/workflows/04-INDEPENDENT-REVIEW.md:7-12,15-18,60-68,87-93`、`docs/project-management/workflows/07-DOCUMENT-CLOSEOUT.md:9-14,20-22`。
- 需求／設計邊界：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37,48-50,62-72`、`docs/project-management/03-FUNCTIONAL-DESIGN.md:23-33`。
- 本輪 08 條目：`docs/project-management/08-CHANGE-LOG.md:3-14`；本輪同步摘要：`00-CURRENT-STATUS.md:3-7`、`05-DEVELOPMENT-AND-DEPLOYMENT.md:3-7`、`06-TEST-AND-PROCESS-AUDIT.md:3-7`、`07-DEBUG-AND-FIX-HISTORY.md:3-7`。
- 本輪 evidence：
  - `docs/project-management/evidence/2026-10-30-fr-021-macos-signed-canary-external-boundary-next15.json`
  - `docs/project-management/evidence/2026-10-30-fr-021-prerequisite-readiness-recheck-next7.json`
  - `docs/project-management/evidence/2026-10-30-fr-021-signed-canary-gate-execution7.json`
- 審查 source／tests：`scripts/audit-macos-signed-canary-external-boundary.mjs`、`scripts/audit-macos-signing-readiness.mjs`、`scripts/audit-macos-signed-canary-gate.mjs` 及其三支 focused tests。

## 六面向審查結果

## 1. 需求完整性

- 判定：部分通過。
- 證據：`08-CHANGE-LOG.md:7-14` 清楚限定本輪為 `next15`／`next7`／`execution7` 的 current-source、read-only、去敏 immutable revalidation，排除 remote／keychain／candidate write、workflow、builder、runtime manifest、codesign、notarization、stapler、Gatekeeper、UI、Ollama、network isolation、Windows 與 release；00／05／06／07 的本輪摘要與此一致。
- `next15` 確認 workflow／source match 但四項 GitHub configuration gap 未解除：`external-boundary-next15.json:46-58`；`next7` 確認 identity probe 成功但 `validIdentityCount=0`、credential `absent`：`prerequisite-readiness-recheck-next7.json:66-108,162-189`；`execution7` 在 runtime manifest／builder 前以兩個 prerequisite reasons fail-closed：`signed-canary-gate-execution7.json:12-23,69-97`。
- 沒有把 revalidation 結果擴大為 FR-021 整體、signed candidate 或 release；這符合 `02-REQUIREMENTS-ANALYSIS.md:48-50` 的 FR-021 驗收例外與 `03-FUNCTIONAL-DESIGN.md:23-33` 的 signed-canary boundary。

## 2. 邏輯正確性

- 判定：部分通過。
- 證據：External boundary 的 response projection、summary derived fields、remote/source match、scope 與 exclusive writer 具明確 fail-closed contract：`scripts/audit-macos-signed-canary-external-boundary.mjs:182-245,285-319`；focused test 覆蓋 reviewer metadata、404／403／malformed／timeout、scope/privacy 與 writer：`scripts/test-macos-signed-canary-external-boundary.mjs:27-115`。
- Readiness 的 identity／toolchain／credential derivation、existing evidence allowlist、decision consistency、privacy 與 scope gate 具 fail-closed contract：`scripts/audit-macos-signing-readiness.mjs:391-412,454-482,518-613,615-651`；focused test 覆蓋 identity failure／malformed output、credential matrix、derived mismatch、unknown keys 與 leakage：`scripts/test-macos-signing-readiness.mjs:98-206`。
- Formal evaluator 對 platform／source config／toolchain／identity／單一路徑 credential 的 decision matrix 正確：`scripts/assert-macos-signed-canary-ready.mjs:79-128`；execution7 的現況結果與 evaluator 一致。
- 技術 finding `TECH-GATE-N2-01`：`scripts/audit-macos-signed-canary-gate.mjs:64-75` 的 `validateEvidence()` 只接受 `gate.ready === false` 且 reasons 非空，未提供 formal pass evidence 的合法 schema 分支；main 在 `:94-118` 會把真正的 `ready=true` 結果寫入後立即被該 validator 拒絕。`scripts/test-macos-signed-canary-gate.mjs:54-148` 測的是 evaluator ready／blocked matrix，沒有直接測 gate evidence validator／writer 的 ready path。因此目前 blocked execution7 可正確保存，但 prerequisites 就緒後的正式 gate evidence path 尚未可用／未覆蓋。

## 3. 邊界情況

- 判定：部分通過。
- 證據：三份檔案實際 mode 均為 `0600`；SHA-256 為：`next15` `7ae2b6b4e1e069bceac479669c57cc07393f59cf904049faf76058620bc9868c`、`next7` `11996d29916cbac5dda392cf476e53f37ded8e07e23daff8f1aaf72cde97caaa`、`execution7` `29710462ca9757750a8d897418c7b3a90d01e180469f69a9261f960b90da0ab9`；實際計算值與 00／05／06／07 摘要一致。
- `next15` 的 remote／local HEAD、workflow hash 與 source revision 對齊，且 `secretValuesRead=false`、raw output／reviewer name／identity／absolute path 未保存：`next15.json:40-84`。`next7` 綁定 audit script／package／focused-test hashes，credential 只有 boolean presence，scope 全 false：`next7.json:21-28,88-108,162-189`。`execution7` 綁定 gate／package／focused-test hashes，execution 與完整 scope 全 false：`execution7.json:69-97`。
- 技術 finding `TECH-READINESS-N2-02`（P2、非本輪 evidence 失真）：`validateReadinessEvidence()`（`scripts/audit-macos-signing-readiness.mjs:615-651`）沒有驗證 `startedAt`／`completedAt` 的型別、ISO 格式或時間順序；本輪唯讀 mutation probe 將 `startedAt` 改為 `null`、`{}`、`"not-a-timestamp"` 均被接受。current `next7.json:3-4` 的實際 timestamp 正確，故此 finding 不否定本輪 immutable evidence，但 validator／focused test 尚非完整 schema fail-closed。
- External validator 已有 timestamp／exact-key／summary／scope／leakage checks：`scripts/audit-macos-signed-canary-external-boundary.mjs:285-313`；formal gate validator 的 exact top-level／timestamp／nested derived checks則仍受 `TECH-GATE-N2-01` 限制。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：本輪實際執行結果：
  - 六支指定 source／test `node --check`：exit 0。
  - 三支 focused tests：exit 0；輸出分別為 external boundary contract passed、signing readiness focused contract passed、signed canary gate contract passed。
  - `node scripts/test-project-docs-validator.mjs`：exit 0。
  - `npm run check`：exit 0；包含 `docs:check`、指定 syntax、完整 npm test、三支本輪 focused tests 與 posttest。
  - `git diff --check`：exit 0。
  - `npm run docs:check:final`：exit 1，明確報告最新 08 缺少「獨立審查是否執行：」「發布授權：」、狀態尚未「完成」，且獨立審查欄位非是／否。
- 驗證刻意未執行會產生新 evidence 或觸及禁止邊界的 audit main、workflow、keychain、builder、codesign、notarytool、stapler、Gatekeeper 或外部寫入；因此沒有真實 signed workflow／candidate／Apple ticket／release 的運行證據，不能把本輪 local contract checks 當成那些結果。

## 5. 測試覆蓋

- 判定：不通過（closeout 尚未完成）。
- 證據：`00-CURRENT-STATUS.md:3-7`、`05-DEVELOPMENT-AND-DEPLOYMENT.md:3-7`、`06-TEST-AND-PROCESS-AUDIT.md:3-7`、`07-DEBUG-AND-FIX-HISTORY.md:3-7` 已同步本輪 `next15`／`next7`／`execution7` 的結果、hash、scope 與不得過度宣稱的界線；這四份文件目前不屬於待同步項目。
- `08-CHANGE-LOG.md:3-14` 仍為「狀態：進行中」，且尚未寫入本輪獨立審查欄位與發布授權欄位；`docs:check:final` 的 exit 1 直接證實 closeout blocker。依 `workflows/04-INDEPENDENT-REVIEW.md:7-12,60-68` 與 `workflows/07-DOCUMENT-CLOSEOUT.md:9-14`，此 finding 必須由主要代理回填 08 並重跑 final gate，本審查代理不得代改。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：current evidence 與治理摘要沒有過度宣稱：外部 Environment／required reviewer／secret scope／protected branch 仍未確認；Developer ID Application identity 為 0、notarization credential 為 absent；formal gate 未啟動 runtime manifest／builder／candidate。這些是 `next15.json:46-84`、`next7.json:66-108,162-189`、`execution7.json:12-23,69-97` 可支持的 bounded conclusion。
- 仍不得宣稱 signed／hardened／notarized candidate、Apple ticket、stapler／Gatekeeper、真實 workflow、release、renderer／UI、真正全機 egress、Windows 或 FR-021 overall acceptance；既有 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false` 與其他平台／隔離 residual 仍未由本輪處理。

## Findings

### 阻擋／需處理

- `GOV-N2-01`（P1，治理 blocker）：最新 `08-CHANGE-LOG.md:3-14` 尚未 closeout；`npm run docs:check:final` exit 1。主要代理需補齊本輪審查欄位、發布授權欄位、逐字引用本報告結論並重跑 final docs gate；不得修改本報告。
- `TECH-GATE-N2-01`（P1，formal gate contract blocker）：gate evidence validator 只接受 blocked result，ready path 會被自身 validator 拒絕；focused test 未直接覆蓋 validator／writer 的 ready path。修正後應新增 ready／blocked 兩側的 exact schema、derived consistency、privacy、timestamp 與 exclusive writer regression，再視影響複審。

### 非阻擋／需補強

- `TECH-READINESS-N2-02`（P2）：readiness evidence validator 對 timestamp schema 不完整；current `next7` timestamp 本身正確，未造成本輪 evidence 失真，但應補 ISO／順序／型別驗證與負向 focused cases。
- 外部條件 residual（非 source defect）：`macos-signed-canary` Environment／required reviewer／secret metadata／protected branch、核准 Developer ID Application identity、受控 runner keychain profile／完整 notarization credential 及真實 signed workflow 均尚未具備；這些解除前不得進入或宣稱 signed candidate。

## 綜合判定

- 本輪是否可有條件通過：可以，但僅限「current-source bounded prerequisites revalidation」範圍；不可視為無條件完成、治理 closeout 完成或 signed-canary acceptance。
- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 FR-021 macOS signed-canary external prerequisites revalidation next2 round1 獨立審查結論為有條件通過：`next15`、`next7`、`execution7` 的 current-source bounded evidence、0600／SHA-256 provenance、privacy／scope 與目前 fail-closed interpretation 均如實，`next15` 正確記錄 remote workflow／source match 但 Environment／required reviewer／secret scope／protected branch 缺口，`next7` 正確記錄 0 valid Developer ID identity／credential absent，`execution7` 正確以 `developer-id-application-not-ready`／`notarization-credential-set-not-ready` 在 runtime manifest／builder 前停止且 execution／scope 全 false；但本輪仍有 `GOV-N2-01` 的 08 closeout blocker、`TECH-GATE-N2-01` 的 formal gate ready-path validator／test blocker 與 `TECH-READINESS-N2-02` 的 timestamp schema 補強項，因此不得宣稱 signed／notarized candidate、Apple ticket、release 或 FR-021 overall acceptance。**
- 阻擋問題（若有）：有；`GOV-N2-01` 與 `TECH-GATE-N2-01` 為阻擋項，`TECH-READINESS-N2-02` 為非阻擋補強項，詳見 Findings。
- 條件解除要求：主要代理完成 08 closeout 並使 `npm run docs:check:final` 通過；修正並重驗 formal gate ready-path contract；補 readiness timestamp schema／focused negative cases；外部 prerequisites 與真實 signed workflow 另行取得可回溯 evidence。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪亦未 stage、commit 或 push，未觸發 workflow、keychain、builder、codesign、notarytool 或任何外部寫入。

若上述聲明不實，本報告無效。
