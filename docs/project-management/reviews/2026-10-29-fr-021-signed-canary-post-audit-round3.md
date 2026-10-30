# 獨立審查報告：signed canary post-build verification contract

- 審查對象 commit／版本：`HEAD` `codex/0.51-anthropic-claude`；工作樹含既有未提交變更，本報告只審查 `FR-021-DEBUG-20261029-SIGNED-CANARY-POST-AUDIT`、round1／round2 修正及 execution3 provenance。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — signed canary post-build verification contract（`FR-021-DEBUG-20261029-SIGNED-CANARY-POST-AUDIT`）。
- 審查輪次：round3 最後獨立六面向複審。
- 審查上下文：先讀 repo `AGENTS.md`、`offline-subtitle-factory-app/AGENTS.md`、最新 `08-CHANGE-LOG.md`、round1／round2 報告、目前工作樹狀態與本輪相關 source／test；本報告為本輪唯一新增檔案。
- 執行限制：未啟動 packaged app，未執行 signing、notarization、stapler、spctl、network 或 OS policy；只執行 preflight、唯讀 source／evidence 核對、純函式 mutation probe、syntax／focused／full tests、治理文件檢查與 `git diff --check`。

## Finding 摘要

- F-01（round2 修正通過）：`compareTeamIdentifiers()` 現以六段 diagnostics 的 SHA-256 逐項對照 `objects` 固定順序產生的 digest，並要求所有 diagnostics 的 TeamIdentifier 非空且一致；固定順序置換的純函式 probe 回報 `false`，round2 指出的獨立假 diagnostics false-pass 已關閉。
- F-02（round2 修正通過）：`sourceRevision()` 已保存 `electron-builder.signed-canary.mjs` 的 `signedCanaryBuilderConfigSha256`，validator 與 fixture 也要求該欄位為 SHA-256；execution3 的 gate／package／focused-test hash 與目前檔案一致。
- F-03（P1，高）：`validateEvidence()` 仍接受錯誤的 timestamp／interpretation leaf type，亦未限制 macOS post-build evidence 的 `environment.platform`／`environment.arch` enum；可重現的 `startedAt=42`、`platform='linux'`、`arch='x64'` 均被接受。
- F-04（P1，高）：helper inventory 的 `complete` 與 count 欄位沒有完整 cross-field consistency；將 `complete=true`、`expectedHelperCount=4`、`actualHelperCount=0`、`missingHelperCount=4`、`unexpectedHelperCount=0` 的 fixture 送入 validator 仍被接受。
- F-05（P1，高）：object readiness 的 `verification.succeeded` 與 `verification.status` 沒有互相驗證；將第一個 object 的 `verification.succeeded=true`／`codeSign.verificationSucceeded=true` 但保留 `verification.status=1`，validator 仍接受。
- F-06（P1，高）：Apple status flags 仍可形成矛盾組合；將 Gatekeeper 設為 `recognizedRejection=true`、`recognizedSuccess=true`、`commandSucceeded=true`、`status='rejected'`，validator 仍接受，因目前只重算 status，沒有拒絕 mutually contradictory success／rejection flags。
- F-07（P2，中，測試覆蓋）：focused fixture 的六段 valid Team ID diagnostics 內容完全相同，因此未捕捉「不同 code object diagnostics 被交換」的 permutation mutation；目前 implementation 對帶有每物件 distinct digest 的 permutation 會拒絕，但 focused test 尚未固定此 regression。
- F-08（P1，高，流程結案阻擋）：最新 changelog 仍為「進行中」且尚未包含本 round3 closeout；`npm run docs:check:final` 實際 exit 1，缺少「獨立審查是否執行：」、`發布授權：`，且最新工作紀錄尚未標示「完成」。本輪依使用者限制不得修改 changelog，故不能把此項誤標為完成。

## Round2 F-01／F-06／F-07 逐項核對

### F-01 — Team ID diagnostics digest 與固定 object order

- 判定：round2 修正通過，但 regression test 仍可加強。
- 位置：`lib/macos-signed-canary-verification.mjs:111-117,163-169`；`scripts/test-macos-signed-canary-result.mjs:50-53`。
- 證據：`evaluateSignedCanaryVerification()` 以 `objects` 的固定 `expectedCodeObjectLabels` 順序建立 `expectedDiagnosticDigests`，再傳給 `compareTeamIdentifiers()`；`compareTeamIdentifiers()` 要求恰好六段 diagnostics，逐段以 SHA-256 對應 digest，並要求抽出的 TeamIdentifier 非空且唯一。以六段內容各自含不同 `ObjectSlot` 的純函式 probe 置換前兩段、保留原 object digest 順序，結果為 `permuted:false`。
- 邊界：目前 focused fixture 的六段 valid diagnostics 完全相同，故交換 diagnostics 的 mutation 不會改變 fixture 的值；這是 F-07 的測試覆蓋問題，不是本輪 source wiring 的可重現 false-pass。

### F-06 — `sourceRevision` 包含 signed builder wrapper

- 判定：通過。
- 位置：`scripts/audit-macos-signed-canary-result.mjs:90-102,230-233`；`scripts/test-macos-signed-canary-result.mjs:95-98,133`。
- 證據：目前 sourceRevision exact schema 包含 `signedCanaryBuilderConfigSha256`，值由 `electron-builder.signed-canary.mjs` 實際計算；focused test 要求 source 包含該欄位，fixture 也包含 64-hex digest。execution3 provenance probe 顯示 `gateScriptMatches=true`、`packageJsonMatches=true`、`focusedTestMatches=true`。
- 限制：這只證明 source／gate provenance contract；execution3 仍在 builder 前被 external identity／credential blocker 阻擋，沒有 signed candidate 可供 post-build result audit。

### F-07 — `validateEvidence()` leaf／range／enum 與 cross-field consistency

- 判定：不通過。
- 位置：`scripts/audit-macos-signed-canary-result.mjs:119-236`；focused negative matrix 位於 `scripts/test-macos-signed-canary-result.mjs:138-159`。
- 可重現 mutation probe（全部以記憶體中的 fixture 執行，未寫檔）：
  - `startedAt=42`：`ACCEPT`；timestamp leaf type 未驗證。
  - `environment.platform='linux'`：`ACCEPT`；post-build evidence 的 platform enum 未限制為 `darwin`。
  - `environment.arch='x64'`：`ACCEPT`；post-build evidence 的 arch enum 未限制為 `arm64`。
  - `helperInventory.complete=true` 但 counts 表示缺少四個 helper：`ACCEPT`；`complete` 未與 missing／unexpected counts 綁定。
  - 第一個 object `verification.succeeded=true`、`codeSign.verificationSucceeded=true` 但 `verification.status=1`：`ACCEPT`；status／success cross-field 未驗證。
  - Gatekeeper 同時 `recognizedRejection=true` 與 `recognizedSuccess=true`、`commandSucceeded=true`、`status='rejected'`：`ACCEPT`；Apple success／rejection flags 可矛盾共存。
  - `interpretation=42`：`ACCEPT`；top-level interpretation leaf type 未驗證。
- 影響：目前 validator 的 exact key、部分 boolean／integer／enum 與 summary reasons/status 重算已能拒絕 round2 原本的 forged summary、source config contradiction、錯誤 environment／code-sign／Apple byte type；但上述 mutation 仍可形成 schema-valid、語意矛盾的 evidence，故不能宣稱「所有 leaf types/ranges/enums 與 cross-field consistency 已 fail-closed」。
- 建議：補 timestamp／interpretation 字串與格式、`darwin`／`arm64` enum、helper count 上下界及 `complete === (missing===0 && unexpected===0)`、verification status／errorCode consistency、Apple success／rejection mutual exclusion，並把每個 mutation 固定進 focused test。

## 六面向核對

### 1. 需求完整性

- 判定：部分通過／不通過結案。
- 證據：round2 要求的 Team ID digest／fixed order binding 與 wrapper provenance 已完成；base build semantics、privacy projection、execution3 scope 也可重驗。但 F-03～F-06 仍未完成 validator 的完整 leaf／enum／range／cross-field fail-closed 契約，F-08 的 process closeout 也未完成。

### 2. 邏輯正確性

- 判定：不通過。
- 證據：post-build evaluator 的 Team ID source binding、effective entitlements、正向 stapler／Gatekeeper classification 與 summary reason recomputation 方向正確；但 `validateEvidence()` 對 helper completeness、object verification status 與 Apple flags 的 mutation probe 仍回報 ACCEPT，存在 evidence contract-level false acceptance。

### 3. 邊界情況

- 判定：不通過。
- 證據：round2 原有的 missing helper、ad-hoc、non-Developer-ID、missing entitlements、generic Apple output、unknown key、scope pollution、summary forged cases 均有測試；本輪新增 probe 顯示 timestamp／platform／arch／helper counts／verification status／Apple flag contradictions 尚未覆蓋或拒絕。

### 4. 程式碼品質

- 判定：部分通過。
- 證據：command 使用固定絕對路徑與非 shell argv，raw diagnostics 只保留 digest／bytes，Team ID internal diagnostic 在寫 evidence 前刪除，source／signed config 分離清楚，evidence 使用 exclusive create 與 mode `0600`。但 validator 將多項語意 consistency 留在 assembly 假設，未形成完整可重用的 schema contract。

### 5. 測試覆蓋

- 判定：不通過。
- 證據：`node --check` 相關 MJS、`node scripts/test-macos-signed-canary-result.mjs`、`npm run check`、`node scripts/test-project-docs-validator.mjs`、`npm run docs:check` 與 `git diff --check` 均通過；`npm run check` 完整回歸亦 exit 0。但 focused matrix 未捕捉 F-03～F-07 的可重現 mutation，尤其 valid diagnostics identical fixture 沒有固定 object-order permutation regression。

### 6. 實際運行結果

- 判定：部分通過，不能作 signed result acceptance。
- 證據：`docs/project-management/evidence/2026-10-29-fr-021-signed-canary-gate-execution3.json` mode `0600`；gate `ready=false`，原因為 `developer-id-application-not-ready`／`notarization-credential-set-not-ready`，`sourceConfigReady=true`、required toolchain true、`runtimeManifestStarted=false`、`builderStarted=false`、`candidateCreated=false`，execution／scope flags 全 false；execution3 source hashes 與目前 gate script／package／focused test 一致。
- 限制：未有 formal signed candidate、effective entitlements、實際 stapler validation 或 Gatekeeper assessment；`validIdentityCount=0` 與 notarization credential `absent` 仍是外部能力限制。

## Base build semantics、privacy 與 scope

- Base build semantics：唯讀摘要為 `identityConfiguration=explicit-null`、`hardenedRuntimeConfigured=false`、`gatekeeperAssessConfigured=false`、`sourceConfigReady=false`；signed config 摘要為 `auto-discovery`、hardened／Gatekeeper true、`sourceConfigReady=true`。`package.json` 的既有 `electron:build:mac:dir`／`electron:build:mac` 未改成 signed wrapper wiring。
- Privacy：目前 result schema 未保存 helper raw names、bundle version、Team ID、identity name、raw command output 或 absolute path；scope exact keys 全為 false，execution3 evidence 也未保存 secrets／identity names／raw output。
- Execution3 provenance：`gateScriptSha256`、`packageJsonSha256`、`focusedTestSha256` 與目前檔案計算值一致；本輪 post-build sourceRevision 另包含 signed builder wrapper hash。
- Bounded scope：本輪只核對 bounded post-build verification contract，不能延伸為 signed／hardened package、effective entitlements、notarization、Gatekeeper、renderer／UI／AI／Ollama／model／network acceptance 或 FR-021 overall completion。

## 綜合判定

- 結論：**本輪 `FR-021-DEBUG-20261029-SIGNED-CANARY-POST-AUDIT` round3 最後複審不通過：round2 指出的 Team ID diagnostics digest／固定 object order binding 與 signed builder wrapper provenance 已由目前 source、focused contract、execution3 hash parity 及唯讀 probe 重驗成立，base build semantics、privacy projection 與 gate-before-builder 全 false execution scope 亦成立，但 `validateEvidence()` 仍接受 timestamp／platform／arch／interpretation leaf mutation、helper completeness contradiction、object verification status contradiction 與 Gatekeeper success／rejection flag contradiction，focused matrix 也未捕捉這些 mutation 或 distinct-diagnostic permutation，且最新 changelog 尚未完成 round3 closeout；在修正並重跑受影響 focused／full validation、完成 `npm run docs:check:final` 前，不得宣稱本工作項目完成，也不得宣稱 signed／hardened package、effective entitlements、實際 notarization、Gatekeeper、renderer／UI／AI／Ollama／model／network acceptance 或 FR-021 整體完成。**
- 阻擋問題：F-03、F-04、F-05、F-06 為 validator／contract findings；F-08 為 process closeout blocker；F-07 為應一併補齊的 regression coverage gap。
- Bounded residual：即使上述 validator findings 修正並完成 docs closeout，本輪仍未執行 formal Developer ID signing、notarization、stapler、spctl、packaged app、renderer／UI／AI／Ollama／model、network 或 OS policy；目前 execution3 只證明 gate 在 builder 前因外部 identity／credential 缺失而安全停止。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、唯讀指令、記憶體純函式 mutation probe、syntax／focused／full tests、治理文件檢查與 `git diff --check`；未啟動 packaged app，未執行 signing、notarization、stapler、spctl、network 或 OS policy，未修改 changelog、source、test、package、evidence 或既有 review 原件。
- `npm run docs:check:final` 依目前 changelog 狀態實際 exit 1；本輪不修改 changelog，因使用者明確限制只能新增本報告。
- 本報告建立於固定路徑 `docs/project-management/reviews/2026-10-29-fr-021-signed-canary-post-audit-round3.md`；round1／round2 原件保留未覆寫。
- 若上述聲明不實，本報告無效。
