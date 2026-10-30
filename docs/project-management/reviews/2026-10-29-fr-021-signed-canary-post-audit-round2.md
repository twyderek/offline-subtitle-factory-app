# 獨立審查報告：signed canary post-build verification contract

- 審查對象 commit／版本：`HEAD` `codex/0.51-anthropic-claude`；工作樹含既有未提交變更，本報告只審查本輪 FR-021 post-audit 變更、round1 修正與 execution3 evidence。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — signed canary post-build verification contract（`FR-021-DEBUG-20261029-SIGNED-CANARY-POST-AUDIT`）。
- 審查輪次：round2。
- 審查代理啟動時間、上下文來源：2026-10-29 11:04:39 +0800；獨立唯讀審查上下文，先讀 repo `AGENTS.md`、`docs/project-management/README.md`、最新 `08-CHANGE-LOG.md`、round1 報告與獨立審查流程，未修改既有報告或主要代理檔案。
- 審查範圍：`lib/macos-signed-canary-verification.mjs`、`lib/macos-signed-canary-build-config.mjs`、`electron-builder.signed-canary.mjs`、`scripts/audit-macos-signed-canary-result.mjs`、`scripts/test-macos-signed-canary-result.mjs`、`scripts/assert-macos-signed-canary-ready.mjs`、`scripts/audit-macos-signing-readiness.mjs`、`package.json`、相關 `00/03/05/06/07/08` 文件與 `docs/project-management/evidence/2026-10-29-fr-021-signed-canary-gate-execution3.json`。
- 執行限制：未啟動 packaged app，未執行 signing、notarization、stapler、spctl、network 或 OS policy；只執行 syntax、focused／full tests、純函式 probe、文件 validator 與 diff 檢查。

## Finding 摘要

- F-01（P1，高）：Team ID 一致性雖已移除 round1 的可任意 boolean override，但 evaluator 仍把六段 Team ID diagnostics 作為獨立輸入，未與各 code object 的實際 diagnostic digest／來源綁定；純函式 probe 可用全假的一致 diagnostics 讓 ready 為 `true`。
- F-02（round1 已修正）：effective entitlements 已實際進入 `codeObjectReady()` gate，且 focused test 覆蓋 missing entitlements 與 command failure；本項通過。
- F-03（round1 已修正）：stapler／Gatekeeper 已要求明確正向成功 marker，generic status-0 output 會 fail-closed；本項通過，但尚未有真實 Apple command output 可供實機核對。
- F-04（round1 已修正）：base mac build config 已恢復 `identity: null`、`hardenedRuntime: false`、`gatekeeperAssess: false`；signed-canary 使用獨立 config 並由 package script 明確傳入，靜態契約通過。
- F-05（round1 已修正）：evidence 不再保存 Framework `.app` 名稱、missing／unexpected raw names 或 bundle version；只保存 fixed counts、digest／bytes／boolean／scope，通過本輪 privacy projection 核對。
- F-06（部分修正，P2，中）：post-build source provenance 已加入 readiness script、signed build-config module、`package.json` 與 lockfile hash 並拒絕 dirty source，但未納入實際傳給 electron-builder 的 wrapper `electron-builder.signed-canary.mjs` hash。
- F-07（部分修正，P2，中）：exact top-level／nested keys、hash、scope 與 status／summary 基本檢查已加入，但 validator 仍接受錯誤型別與跨欄位矛盾，focused negative matrix 未覆蓋這些 mutation。
- F-08（仍阻擋，P1，高）：最新 changelog 仍為「進行中」且缺少 round2 closeout 欄位；`npm run docs:check:final` 實際失敗，故 process closeout 未完成。

## Round1 F-01～F-08 逐項核對

### F-01 — Team ID consistency 仍可由 evaluator input spoof

- 嚴重度：P1／高。
- 位置：`lib/macos-signed-canary-verification.mjs:111-115`、`:146-165`；`scripts/audit-macos-signed-canary-result.mjs:73-80`、`:197-217`。
- round1 修正確認：`compareTeamIdentifiers()` 現要求恰好六段 diagnostics、每段有非空且相同的 `TeamIdentifier`；`evaluateSignedCanaryVerification()` 不再接受 round1 所指出的 `teamIdentifiersConsistent: true` override。這些改善由 `scripts/test-macos-signed-canary-result.mjs:50-53,70` 覆蓋。
- residual 證據：`classifyCodeSign()` 只保存 `teamIdentifierPresent` 與整段 display diagnostic 的 digest，不保存或輸出該 code object 的 Team ID；evaluator 在 `:164` 只以獨立 `teamIdentifierDiagnostics` 呼叫 `compareTeamIdentifiers()`，沒有驗證每一段 diagnostics 的 SHA-256 是否等於對應 `objects[index].codeSign.diagnosticSha256`，也沒有把 diagnostics 綁定到 object label。純函式 probe 以六個 `codeSign` 都含 `TeamIdentifier=TEAM-A` 的 object，另傳六段 `TeamIdentifier=FAKE` diagnostics，結果為 `{"ready":true,"teamIdentifiersConsistent":true,"reasons":[]}`。
- 影響：目前 audit CLI 的正常 wiring 確實把同一次 `codesign -dv` 的 raw diagnostic 同時用於 classifier 與 Team ID 比對，但共用 evaluator 契約本身仍可被錯誤 caller／未來 adapter 以另一組一致 Team ID 餵入；這不符合 round1 要求的「不可 spoof」與 source-bound consistency。
- 建議：在不落盤 raw Team ID 的前提下，至少要求每個 internal diagnostic 的 digest 與對應 `codeSign.diagnosticSha256` 完全相等，並要求 diagnostics 與 fixed object order 一一對應；最好把 Team ID extraction／consistency 放在同一個 object inspection result 內，禁止 evaluator 接受未綁定的平行陣列。新增 mismatched-diagnostic-to-object regression。

### F-02 — effective entitlements 已進 gate，通過

- 嚴重度：無新增 finding。
- 位置：`lib/macos-signed-canary-verification.mjs:58-70,133-143`；`scripts/test-macos-signed-canary-result.mjs:47,71-72`。
- 證據：`classifyEntitlements()` 只在 status 0 且輸出含 plist／dict 結構時標示 `present`；`codeObjectReady()` 同時要求 `entitlementsCommandSucceeded === true` 與 `entitlementsPresent === true`。focused matrix 將任一 object 的 `entitlementsPresent` 或 command success 改為 false 時均回報 `code-object-signature-not-ready`。
- 限制：`entitlementsPresent` 只證明有效 plist／dict 形狀，不證明特定 hardened-runtime entitlement key；本輪需求明確要求 presence／effective inspection，未將 key allowlist 列為本輪新增驗收條件，故不另列 finding。

### F-03 — stapler／Gatekeeper 已改為正向 allowlist，通過

- 嚴重度：無新增 finding。
- 位置：`lib/macos-signed-canary-verification.mjs:73-108,165-169`；`scripts/test-macos-signed-canary-result.mjs:38-39,48-53,73-74`。
- 證據：stapler 必須命中 `The staple and validate action worked!` 且無拒絕 marker；Gatekeeper 必須同時命中 `accepted`、`source=Notarized Developer ID` 且無 rejection marker。`ticket` 與 `assessment completed` 的 status-0 generic probe 均回報失敗，focused matrix 也覆蓋 invalid staple／Gatekeeper rejection。
- 限制：本輪按使用者要求未執行真實 `xcrun stapler`／`spctl`，因此只能判定 classifier contract，不代表實際 Apple output 已驗收。

### F-04 — base build semantics 與 signed config split，靜態核對通過

- 嚴重度：無新增 finding。
- 位置：`package.json:42-45,170-191`；`lib/macos-signed-canary-build-config.mjs:4-12`；`electron-builder.signed-canary.mjs:1-6`。
- 證據：唯讀載入實際 config 的摘要為：base `identityConfiguration=explicit-null`、`hardenedRuntimeConfigured=false`、`gatekeeperAssessConfigured=false`、`sourceConfigReady=false`；signed config 摘要為 `identityConfiguration=auto-discovery`、hardened／Gatekeeper true、`sourceConfigReady=true`。package script 於 `electron-builder --mac --arm64 --publish never --config electron-builder.signed-canary.mjs` 明確指定 signed config；execution3 的 package、gate script、focused test hashes 均與目前檔案一致。
- 限制：未執行 electron-builder，故本輪只能核對 CLI wiring 與 config module 輸出，不能宣稱實際 builder 已產出 signed package 或已實測 effective config。

### F-05 — privacy projection 已收斂，通過

- 嚴重度：無新增 finding。
- 位置：`scripts/audit-macos-signed-canary-result.mjs:118-169,184-190,219-259`；`lib/macos-signed-canary-verification.mjs:22-28,50-55,85-107`。
- 證據：validator 的 exact schema 沒有 `frameworkAppEntries`、missing／unexpected name 或 bundle version 欄位；runtime evidence 只保存 helper counts、object fixed labels、executable／framework／diagnostic hashes／bytes、固定分類與全 false scope。`teamIdentifierDiagnosticForInternalCheck` 在寫 evidence 前於 `:218` 刪除；`bundleVersion` 只用於 `isSafeVersion()`，未寫入 evidence。focused source assertions 也核對 raw output、identity names、entitlements 不落盤。
- 限制：本輪未對真實 candidate 執行 audit，因使用者禁止 packaged/signing/stapler/spctl；privacy 結論限於 source projection contract。

### F-06 — provenance 尚未涵蓋 signed builder wrapper

- 嚴重度：P2／中。
- 位置：`scripts/audit-macos-signed-canary-result.mjs:90-102,163-166`。
- 證據：`sourceRevision()` 已保存 `auditScriptSha256`、`verificationModuleSha256`、`signingReadinessScriptSha256`、`signedBuildConfigModuleSha256`、`packageJsonSha256`、`packageLockSha256`，並以 `workingTreeDirty === false` 作為 ready 前提；但實際 package script 在 `package.json:44` 交給 electron-builder 載入的 `electron-builder.signed-canary.mjs` 沒有 hash 欄位。round1 changelog 宣稱 provenance 已擴至 signed config，但目前只 hash loader module，未 hash builder wrapper。
- 影響：若 wrapper 的 default export、appDir resolution 或載入路徑變更，post-build evidence 的 source revision 仍可能看似完整，卻無法重建實際 electron-builder config entrypoint。這是可追溯性缺口，不是目前無 identity blocker 的直接 false-pass。
- 建議：在 exact `sourceRevision` schema 加入 `signedCanaryBuilderConfigSha256`，在 focused validator／fixture 中要求 64-hex 並與目前 wrapper digest 對照；若 wrapper 被視為純不可變入口，也應在 changelog 明確把它納入 provenance scope。

### F-07 — exact schema 基本完成，但 semantic/type negative coverage 仍不足

- 嚴重度：P2／中。
- 位置：`scripts/audit-macos-signed-canary-result.mjs:118-169`；`scripts/test-macos-signed-canary-result.mjs:100-140`。
- 證據：`validateEvidence()` 已拒絕未知 top-level／nested keys、錯誤 status／summary、scope extra key 與非 SHA-256 digest；focused test 已覆蓋 extra key、status mismatch、scope pollution、Team ID mismatch、missing entitlements、generic Apple output。可是 validator 沒有驗證 environment leaf type、codeSign／verification／entitlement leaf boolean／integer type、`summary` 各 boolean 的實際型別，也沒有驗證 `sourceBuildConfig.sourceConfigReady` 與 hardened／Gatekeeper／target 欄位一致。
- 可重現 probe：以測試 fixture 為基礎，將 `environment.platform` 改為 number、任一 `codeSign.commandSucceeded` 改為字串、`stapler.diagnosticBytes` 改為字串、或將 `sourceBuildConfig.hardenedRuntimeConfigured=false` 但保留 `sourceConfigReady=true`，`validateEvidence()` 均接受。更嚴重的是，將所有 object／stapler／Gatekeeper 實際欄位保留 failure，僅把 `summary.ready=true`、`summary.reasons=[]`、`status='pass'`，validator 仍接受，因為它只檢查 `status === (summary.ready ? 'pass' : 'fail')`，沒有重算或核對 summary 與 subordinate fields。
- 影響：exact-key validator 仍不能保證 malformed／矛盾 evidence fail-closed；若未來 audit assembly 或 evidence adapter 發生欄位映射錯誤，可能寫出表面 `pass`、實際 subordinate checks 失敗的結果。現行 `main()` 直接以同一個 `evaluation` 產生 summary，因此 focused test 尚未證明 current path 已觸發該錯誤，但契約本身仍有 regression gap。
- 建議：補齊所有 leaf type／range／enum 驗證，將 source-config、helper counts、object readiness、Team ID consistency、stapler／Gatekeeper status 與 `summary` 做跨欄位重算／一致性檢查；focused matrix 應加入上述 type mutation、summary false／pass contradiction、object label／count mismatch、negative／positive status contradiction。

### F-08 — process closeout 仍未完成

- 嚴重度：P1／高，流程結案阻擋。
- 位置：`docs/project-management/08-CHANGE-LOG.md:3` 起最新條目；`docs/project-management/workflows/04-INDEPENDENT-REVIEW.md` 的獨立審查與結案規則。
- 證據：最新條目狀態仍為「進行中」，尚未包含本 round2 報告路徑、round2 完整單句結論、獨立審查欄位與發布授權欄位。2026-10-29 11:04:39 +0800 執行 `npm run docs:check:final` 實際失敗，輸出為：最新工作紀錄缺少「獨立審查是否執行：」、缺少「發布授權：」、尚未標示「完成」，且該欄位不是是／否。這些是本輪使用者明確限制「只能新增報告」所造成的未結案狀態，不應修改本 round2 原件來繞過。
- 影響：即使程式 contract 的 F-02～F-05 已修正，FR-021 work item 仍不能宣稱完成；主要代理必須在讀取本報告後，依 F-01／F-06／F-07 修正或明確保留風險，再更新 changelog 並重跑 final gate。
- 建議：由主要代理處理程式／測試 findings，保留本報告不覆寫；完成 round3 或接受明確 bounded residual 後，補最新 changelog 的審查路徑、完整單句結論、獨立審查欄位、發布授權（本輪應標示不適用）與剩餘風險，最後重新執行 `npm run docs:check:final`。

## 六面向核對

### 1. 需求完整性

- 判定：部分通過／不通過結案。
- 證據：round1 要求的六個 code object inventory、entitlements presence、正向 Apple output classification、base／signed config split 與 privacy projection 已完成；但 F-01 的 Team ID source binding、F-06 的 builder wrapper provenance、F-07 的 exact semantic schema 與 F-08 closeout 尚未完成。`00-CURRENT-STATUS.md`、`03-FUNCTIONAL-DESIGN.md`、`05-DEVELOPMENT-AND-DEPLOYMENT.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md` 已同步本輪 bounded scope，但部分文件以「不可 spoof／all malformed fail-closed」描述超出目前 validator 可證明的程度。

### 2. 邏輯正確性

- 判定：不通過。
- 證據：F-01 純函式 probe 以不匹配 object diagnostics 與一致假 Team ID diagnostics 取得 `ready=true`；F-07 probe 以 failure subordinate fields 搭配 forged `summary.ready=true/status=pass` 通過 `validateEvidence()`。F-02、F-03 的主要 gate logic 已能 fail-closed，但不足以抵銷上述兩個 contract-level false-pass path。

### 3. 邊界情況

- 判定：不通過。
- 證據：已實際覆蓋並通過 inconsistent Team ID、missing entitlements、entitlement command failure、generic stapler／Gatekeeper output、ad-hoc／non-Developer-ID、missing helper、extra schema key、status mismatch、scope pollution；仍缺 object-to-diagnostic binding、錯誤 leaf type、source-config contradiction、summary／subordinate contradiction、wrapper provenance mutation 等負向 cases。

### 4. 程式碼品質

- 判定：部分通過。
- 證據：command 使用絕對路徑與非 shell argv、raw diagnostics 只做 digest／bytes、evidence exclusive-create／0600、fixed inventory 與 base／signed config separation 的意圖清楚；但平行 Team ID input、未 hash builder wrapper、validator 只做結構而未做語意重算，仍造成可維護性與安全邊界風險。

### 5. 測試覆蓋

- 判定：不通過。
- 證據：2026-10-29 11:04:39 +0800 執行 `node --check`（指定 MJS 全部通過）、`node scripts/test-macos-signed-canary-result.mjs` 通過、`npm run check` exit 0、`node scripts/test-project-docs-validator.mjs` 通過、`git diff --check` 通過；但 focused test 未捕捉 F-01 object／diagnostic mismatch、F-06 wrapper hash 缺失、F-07 type／semantic contradiction。未執行任何 packaged app、signing、notarization、stapler、spctl、network 或 OS policy。

### 6. 實際運行結果

- 判定：部分通過，不能作 signed result acceptance。
- 證據：execution3 `docs/project-management/evidence/2026-10-29-fr-021-signed-canary-gate-execution3.json` mode `0600`，`gate.ready=false`，阻擋原因為 `developer-id-application-not-ready`／`notarization-credential-set-not-ready`，`sourceConfigReady=true`、`requiredToolchainReady=true`、`builderStarted=false`、`candidateCreated=false`，scope flags 全 false；其 package／gate script／focused test hashes 與目前檔案一致。唯讀載入 config 的 base／signed summary 分離成立，但沒有實際 signed candidate、effective entitlements、stapler 或 Gatekeeper 結果可核對。

## 綜合判定

- 結論：**本輪 `FR-021-DEBUG-20261029-SIGNED-CANARY-POST-AUDIT` round2 複審不通過：round1 的 effective entitlements gate、正向 stapler／Gatekeeper classification、base／signed build config separation 與 privacy projection 已修正並由 source、focused contract、full `npm run check` 及 execution3 的 fail-closed gate evidence 重驗成立，但 Team ID diagnostics 尚未與各 code object source 綁定而仍可被 evaluator caller spoof，post-build provenance 未納入實際 `electron-builder.signed-canary.mjs` wrapper，evidence validator 仍接受 leaf type／跨欄位矛盾且 focused negative matrix 未覆蓋，最新 changelog 亦未完成 round2 closeout；在修正 F-01／F-06／F-07、重跑受影響驗證並完成 `npm run docs:check:final` 前，不得宣稱本工作項目完成，也不得宣稱 signed／hardened package、effective entitlements、實際 notarization、Gatekeeper、renderer／UI／AI／Ollama／model／network acceptance 或 FR-021 整體完成。**
- 阻擋問題：F-01、F-08 為結論阻擋；F-06、F-07 為本輪 post-build contract 必須修正或明確降級範圍並留下可追溯 residual 的問題。
- 剩餘風險：本輪未執行真實 signed candidate、codesign、notarization、stapler、spctl、packaged app、renderer／UI、AI／Ollama／model、network 或 OS policy；目前 external identity／credential blocker 仍在 execution3 中如實記錄。即使本報告 findings 修正，也只能表示 bounded post-build verification contract 完成，不能替代外部 Developer ID identity、credential、實際 builder load、effective entitlements、notarization 與 packaged acceptance。
- 給主要開發代理的具體修正要求：保留本 round2 原件；將 Team ID diagnostics 與 object digest／label 綁定並加入 spoof regression；將 `electron-builder.signed-canary.mjs` 納入 exact source provenance；補 leaf type／range／enum 與跨欄位 consistency validator 及 focused negative matrix；讀取本報告後更新最新 changelog、完整記錄 round2 結論與發布授權（不適用），再執行 `npm run docs:check:final`；若修正影響結論，建立 round3，不覆寫本報告。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、唯讀指令、純 classifier probe、syntax／focused／full tests、治理 validator、文件檢查與 `git diff --check`，未啟動 packaged app，未執行 signing、notarization、stapler、spctl、network 或 OS policy，未修改任何其他專案檔案或既有審查報告。
- 本報告建立於固定路徑 `docs/project-management/reviews/2026-10-29-fr-021-signed-canary-post-audit-round2.md`；round1 原件保留未覆寫。
- 若上述聲明不實，本報告無效。
