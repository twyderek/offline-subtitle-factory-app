# 獨立審查報告：signed canary post-build verification contract

- 審查對象 commit／版本：`HEAD` `codex/0.51-anthropic-claude`；工作樹保留既有未提交變更，本報告只審查 `FR-021-DEBUG-20261029-SIGNED-CANARY-POST-AUDIT`、round3 修正、focused regression、base／signed config split 與 execution3 evidence。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — signed canary post-build verification contract（`FR-021-DEBUG-20261029-SIGNED-CANARY-POST-AUDIT`）。
- 審查輪次：round4 最後獨立六面向複審。
- 審查上下文：2026-10-29 11:12:08 +0800；先讀 repo `AGENTS.md`、`npm run project:preflight -- --type=debug` 列出的 debug route、最新 `08-CHANGE-LOG.md`、round1／round2／round3 reports，再以目前工作樹的 source、focused test、execution3 evidence 與文件流程規則重新核對；本報告為本輪唯一新增檔案。
- 執行限制：未啟動 packaged app，未執行 signing、notarization、stapler、spctl、network 或 OS policy；未執行任何會建立 candidate 或修改 keychain／OS 狀態的命令。

## Finding 摘要

- F-01（P1，高，provenance blocker）：immutable execution3 的 `gateScriptSha256` 與 `focusedTestSha256` 不再匹配目前工作樹；因此 execution3 的 scope／gate decision 仍可作為當時的 bounded evidence，但不能直接宣稱它已 provenance-bind 到本輪目前 source／focused test。
- F-02（P1，高，process closeout blocker）：最新 `08-CHANGE-LOG.md` 仍為「進行中」，仍寫著「round4 複審待執行」，缺少本 round4 路徑／完整單句判定／獨立審查欄位／發布授權欄位，且 `npm run docs:check:final` 仍失敗；依使用者限制本輪不得修改 changelog，故此 finding 只能保留給主要代理處理。

除 F-01／F-02 外，本輪未發現 round3 所列 validator、focused mutation 或 config／privacy／scope 的新增可重現 finding。

## Round3 findings 逐項核對

### timestamp／platform／arch／interpretation

- 判定：通過。
- 證據：`scripts/audit-macos-signed-canary-result.mjs:140-146` 要求固定 ISO timestamp、`environment.platform === 'darwin'`、`environment.arch === 'arm64'`，且 interpretation 為非空字串。
- focused evidence：`scripts/test-macos-signed-canary-result.mjs:168-179,192-194` 對 `startedAt=42`、`platform='linux'`、`arch='x64'` 與 `interpretation=42` 均以對應 schema error 拒絕。

### helper complete／count consistency

- 判定：通過。
- 證據：`scripts/audit-macos-signed-canary-result.mjs:161-167` 驗證 expected count、所有 count 為非負整數、actual count 算式，以及 `complete === (missing===0 && unexpected===0)`。
- focused evidence：`scripts/test-macos-signed-canary-result.mjs:180-182` 將不完整 fixture 偽造為 `complete=true`，實際被 `SIGNED_RESULT_HELPER_SCHEMA_INVALID` 拒絕。

### verification status／errorCode consistency

- 判定：通過。
- 證據：`scripts/audit-macos-signed-canary-result.mjs:169-199` 要求每個 object 的 code-sign verification 與 nested verification 同步，成功必須 status `0` 且 errorCode 為 `null`，失敗不得 status `0`，非 null status 必須為 integer，非 null errorCode 必須為 string。
- focused evidence：`scripts/test-macos-signed-canary-result.mjs:183-187` 將 `succeeded=true` 搭配 `status=1`，實際被 `SIGNED_RESULT_OBJECT_SCHEMA_INVALID` 拒絕。

### Apple success／rejection mutual consistency

- 判定：通過。
- 證據：stapler 在 `scripts/audit-macos-signed-canary-result.mjs:201-205` 以 command success／recognized success 重算 status；Gatekeeper 在 `:206-212` 要求 success 不得同時 rejected、不得在 command failure 下成立，並以 allowlist 條件重算 `accepted`／`rejected`。
- focused evidence：`scripts/test-macos-signed-canary-result.mjs:188-191` 將 Gatekeeper 的 `recognizedRejection=true` 與 `recognizedSuccess=true` 並置，實際被 `SIGNED_RESULT_GATEKEEPER_SCHEMA_INVALID` 拒絕。

### distinct diagnostics permutation

- 判定：通過。
- 證據：focused fixture 為每個 code object 產生不同 `ObjectSlot` diagnostic（`scripts/test-macos-signed-canary-result.mjs:30-50`）；`compareTeamIdentifiers()` 的前兩段 diagnostic 交換在 `:60-62` 實際回報 false，且不同 Team ID diagnostic 也回報 false。這確認 round3 補上的 mutation 不再因六段內容完全相同而失效。
- 相關 source：`compareTeamIdentifiers()` 仍以 expected object order 對應 diagnostic digest；本輪未發現 round3 所描述的 permutation false-pass。

## 六面向核對

### 1. 需求完整性

- 判定：部分通過／不通過結案。
- 證據：round3 所列六類 validator consistency 與 distinct diagnostic regression 均已存在並通過 focused test；base／signed config、privacy projection、execution3 bounded scope 也可重驗。但 F-01 使 immutable execution3 不能作為目前 source 的完整 provenance，F-02 使治理 closeout 尚未完成。

### 2. 邏輯正確性

- 判定：通過（bounded classifier contract）。
- 證據：目前 validator 對 timestamp／environment enum／helper cardinality／object verification／Apple flag contradictions 均 fail-closed；`npm run check` 中的 signed-result focused contract 通過，未重現 round3 的 false acceptance。
- 界線：這只證明 evidence validator／classifier 邏輯，不證明任何實際 signed candidate 的 codesign、notarization、stapler 或 Gatekeeper 結果。

### 3. 邊界情況

- 判定：通過（本輪指定矩陣）。
- 實際核對：錯誤 timestamp、錯誤 platform／arch、helper `complete` 矛盾、verification success／status 矛盾、Gatekeeper success／rejection 矛盾、distinct diagnostic permutation 均被 focused test 覆蓋並拒絕；round1／round2 的 missing helper、ad-hoc／non-Developer-ID、entitlement failure、summary forged、source config contradiction 與 scope pollution cases 仍保留於同一 focused matrix。

### 4. 程式碼品質

- 判定：部分通過。
- 證據：base path 的 `package.json:42-43,184-190` 保留 `identity: null`、hardened runtime／Gatekeeper false；signed path 由 `electron-builder.signed-canary.mjs` 載入 `lib/macos-signed-canary-build-config.mjs:4-12`，只移除 identity 並開啟 hardened／Gatekeeper，split 邊界清楚。result validator 保留 exact keys、boolean／enum／digest／bytes 與 summary recomputation，且不保存 Team ID、raw command output、absolute path、identity name 或 secret。
- 限制：execution3 provenance hash drift（F-01）降低 immutable evidence 對目前 source 的可追溯性。

### 5. 測試覆蓋

- 判定：通過（目前 source／fixture）。
- 實際驗證：`node scripts/test-macos-signed-canary-result.mjs` exit 0；相關三支 MJS `node --check` exit 0；`node scripts/test-project-docs-validator.mjs` exit 0；完整 `npm run check` exit 0，包含 `npm test`、signed-result focused contract 與 YouTube posttest；`git diff --check` exit 0。
- 覆蓋結果：round3 所列 mutation 均有 focused assertions，distinct diagnostics 不再使用相同 fixture 內容。

### 6. 實際運行結果

- 判定：不通過作為 signed result acceptance；bounded gate evidence 通過。
- 證據：`docs/project-management/evidence/2026-10-29-fr-021-signed-canary-gate-execution3.json:3-23` 記錄 `darwin`／`arm64`、`ready=false`、`validIdentityCount=0`、credential `absent`、`notarizationConsistent=true`；`:69-90` 的 execution／scope flags 全 false，`:97` 明確限定為 builder 前 read-only gate decision，不是 signed package 或 FR-021 completion。
- 檔案權限：execution3 mode `0600`。
- 禁止操作核對：本輪未啟動 packaged app，未執行 signing、notarization、stapler、spctl、network 或 OS policy。

## F-01 — execution3 provenance drift（可重現）

- 重現指令：以 Node SHA-256 讀取目前 `scripts/assert-macos-signed-canary-ready.mjs`、`package.json`、`scripts/test-macos-signed-canary-result.mjs`，與 execution3 `sourceRevision` 比對。
- 實際結果：
  - gate：目前 `0c9014e1796648f5b0b8f077ab8ebe616f3e80e9457e8038233286692b158181`，evidence `63d22ec15b56e675db7c20507d5f0eb01f77e29b07020521719d6990a4495571`，不一致。
  - package：目前 `0980d896c417828d08f17a5ca1399f682c5bc440bf20e2849839d766466ed79a`，evidence 相同，一致。
  - focused test：目前 `0c62551ea3652b21caef56dca67628813be2049e898a5654547be3a7ec5cb549`，evidence `8d6c97c238e9bbae9140de1227d448842ce69d52a821a6dd72f498883209d839`，不一致。
- 影響：execution3 的 `builderStarted=false`、scope 全 false 與 blocked gate decision 仍是該 immutable record 的歷史事實；但若把它當成目前 round4 source／focused test 的 provenance，會形成不可接受的 hash parity false claim。需由主要代理重新建立一份新的 immutable execution evidence，或明確把 execution3 降級為歷史證據並在 changelog 中揭露，不得覆寫 execution3 原件。

## F-02 — process closeout 未完成（可重現）

- `docs/project-management/08-CHANGE-LOG.md:5` 仍為 `- 狀態：進行中`，`:22` 仍為「round4 複審待執行」，且目前條目沒有本 round4 review 路徑、round4 完整單句判定、`獨立審查是否執行：` 或 `發布授權：`。
- `npm run docs:check:final` 實際失敗，輸出指出缺少「獨立審查是否執行：」、缺少「發布授權：」、最新工作紀錄尚未標示「完成」，以及獨立審查欄位不是是／否。
- 影響：依 `docs/project-management/workflows/04-INDEPENDENT-REVIEW.md` 與 `07-DOCUMENT-CLOSEOUT.md`，本輪不能稱為治理完成。依使用者「只新增本報告」限制，本報告不修改 08 或其他檔案。

## 綜合判定

- 結論：**本輪 `FR-021-DEBUG-20261029-SIGNED-CANARY-POST-AUDIT` round4 不通過：round3 所列 timestamp／platform／arch／interpretation、helper complete／count、verification status／errorCode、Apple success／rejection mutual consistency 與 distinct-diagnostic permutation 均已由目前 source、focused negative matrix、syntax、完整 `npm run check` 與治理 validator 重驗通過，base／signed config split、privacy projection 及 execution3 全 false bounded scope 亦成立；但 execution3 的 gate／focused-test SHA-256 與目前工作樹不一致，且最新 08 仍維持「進行中」並使 `npm run docs:check:final` 失敗，因此在重新建立不覆寫舊 evidence 的 provenance-consistent execution record、補齊本 round4 changelog closeout 並重跑 final docs gate 前，不得宣稱本工作項目完成，也不得宣稱 signed／hardened package、effective entitlements、實際 notarization、stapler、Gatekeeper、renderer／UI／AI／Ollama／model／network acceptance 或 FR-021 整體完成。**
- 阻擋問題：F-01 execution3 provenance drift；F-02 changelog／final docs process closeout。
- Bounded residual：即使 F-01／F-02 完成，本輪仍沒有 formal Developer ID signing、notarization、stapler、spctl、packaged app、renderer／UI／AI／Ollama／model、network 或 OS policy acceptance；目前 execution3 只證明當時 gate 在 builder 前因 external identity／credential 缺失而安全停止。
- 給主要開發代理的具體修正要求：保留本 round4 原件與 execution3 原件；另建新的 immutable execution evidence 或明確標註 execution3 為歷史證據並更新其 provenance 說明；將本報告路徑與本結論逐字引用寫入最新 08，補 `獨立審查是否執行：是`、`發布授權：不適用`、剩餘風險並標示本工作項目完成（僅限 bounded post-build verification contract），最後重新執行 `npm run docs:check:final`。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、preflight、純 hash／schema／fixture 核對、syntax／focused／full tests、治理文件檢查、`docs:check:final` 與 `git diff --check`；未修改任何其他專案檔案或既有審查報告。
- 本輪未啟動 packaged app，未執行 signing、notarization、stapler、spctl、network 或 OS policy；未建立 candidate，未修改 keychain 或 OS policy。
- 本報告建立於固定路徑 `docs/project-management/reviews/2026-10-29-fr-021-signed-canary-post-audit-round4.md`；round1／round2／round3 原件與 execution3 immutable evidence 保留未覆寫。
- 若上述聲明不實，本報告無效。
