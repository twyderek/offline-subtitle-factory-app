# 獨立複審報告：FR-021 signed-canary distribution evidence hardening next stage

- 審查對象：目前 working tree 最新內容；對照前一輪原件 `docs/project-management/reviews/2026-10-29-fr-021-distribution-evidence-next1-round1.md`。
- 對應 08-CHANGE-LOG 條目：`FR-021-MACOS-CI-20261029-DISTRIBUTION-EVIDENCE-NEXT1`。
- 審查輪次：round2；本報告由獨立唯讀複審上下文建立。既有 dirty worktree、evidence 與 round1 report 均保留。
- 審查範圍：`.github/workflows/macos-signed-canary.yml`、`lib/macos-signed-canary-artifact-selection.mjs`、`scripts/select-macos-signed-canary-artifacts.mjs`、`scripts/audit-macos-signed-canary-distribution.mjs`、`scripts/test-macos-signed-canary-gate.mjs`、`scripts/test-macos-signed-canary-distribution.mjs`、`package.json`、治理文件 00／05／06／07／08。
- 限制：未執行 GitHub workflow、Apple signing／notarization、`stapler`、`hdiutil`、`spctl`、keychain、packaged app 或外部 network；除本報告外未修改其他檔案。

## 複審摘要

round1 的 candidate metadata／digest cross-field 與 timestamp／environment／interpretation validator 修正已成立；selector direct-child、nested Helper fixture、cardinality fail-closed、exclusive 0600／EEXIST writer 與 workflow 的正常 copy／cleanup → app result audit 順序也成立。但 round1 F-01 尚未完整解除：marker 已改成 raw notarytool JSON，然而 audit 仍可接受 caller-supplied 的任意絕對路徑，缺少 CI run identity／`RUNNER_TEMP` 的強制邊界，且 output digest 是自行計算的診斷摘要而非精確 raw-file digest。另在 notarytool／stapler 前置步驟失敗時，workflow 沒有保證清理 raw JSON 與 stderr。故本輪不通過。

## Findings

### F-01 — P1 blocker：raw notarytool output 仍未完全成為固定、不可任意替換的 run-scoped input

- 位置：`scripts/audit-macos-signed-canary-distribution.mjs:78-96`；`.github/workflows/macos-signed-canary.yml:127-139`。
- 已修正部分：workflow 不再建立 round1 的明文 success marker，而是把 `xcrun notarytool submit --wait --output-format json` 直接導向 `$RUNNER_TEMP/osf-signed-canary-notarytool-$GITHUB_RUN_ID.json`；audit 會 parse JSON、要求 `status` 為 Accepted 語意，並以 JSON 內的 `sha256` 與 DMG digest 比對。
- 未解除部分：audit 只在 `GITHUB_RUN_ID` 存在時檢查 basename；沒有要求 `GITHUB_RUN_ID` 必須存在，也沒有要求 output path 位於 `RUNNER_TEMP` 或等於固定的 run-scoped path。`GITHUB_RUN_ID` 未設定時，任意絕對路徑的同形 JSON 可回傳 `commandSucceeded=true`；即使設定 run ID，basename 相同但位於其他目錄的檔案仍可被接受。`diagnosticSummary()` 對 raw stdout 額外串接換行再 hash（49-56），因此保存的是 synthetic diagnostic digest／bytes，不是精確 raw JSON file digest，也沒有與 workflow 預先固定的 output digest 做獨立 binding。另以 `.toLowerCase() === 'accepted'` 接受小寫 `accepted`，不是嚴格的 canonical `Accepted`。
- deterministic probe 證據：在 `GITHUB_RUN_ID=123`、`RUNNER_TEMP` 指向另一個目錄時，位於 runner temp 外、basename 為 `osf-signed-canary-notarytool-123.json` 的人工 JSON 仍被判定 valid；刪除 `GITHUB_RUN_ID` 後同一檔案仍被判定 valid；無換行 raw JSON 為 113 bytes，但回傳的 diagnostic bytes 為 114。
- 影響：marker 雖已移除，但 caller 仍可把自製 raw JSON path 傳給 audit；DMG digest、run basename 與自行產生的 output digest 只能證明檔案內容彼此一致，不能證明該檔案是本次固定 workflow command 的受控輸出。這未滿足本輪要求的「不信任 caller-supplied marker／raw output fixed run-scoped」邊界。
- 建議：在 audit 端缺少 `GITHUB_RUN_ID`／`RUNNER_TEMP` 時直接 fail，要求 resolved path 精確等於 `path.join(RUNNER_TEMP, `osf-signed-canary-notarytool-${GITHUB_RUN_ID}.json`)`；以精確 raw bytes 計算 output digest，嚴格要求 canonical `Accepted`，並補齊 no-run-id、outside-`RUNNER_TEMP`、wrong-run、malformed／empty 與 lowercase negative cases。若仍需在 workflow 外測試，應使用明確的 injected test seam，而不是放寬 production parser。

### F-02 — P1 blocker：notary raw JSON／stderr 的失敗路徑沒有保證清理

- 位置：`.github/workflows/macos-signed-canary.yml:119-141,150-173,193-201`。
- 證據：`Notarize and staple signed canary` step 建立 raw JSON 與 stderr，但沒有 `trap`。若 `notarytool submit` 非零、app／DMG `stapler staple` 失敗，step 會在 `set -e` 下中止，後續 `Write app and DMG distribution evidence` step（沒有 `if: always()`）不會執行，因此其中的 `cleanup_distribution_inputs()` 不會被註冊或呼叫。即使 `Verify notarized DMG container` 失敗，同樣會跳過該 cleanup step。最後的 `Clean run-scoped signed-canary output` 只刪除 `$RUNNER_TEMP/osf-signed-canary-dist-$GITHUB_RUN_ID`，沒有刪除 notary raw JSON／stderr。
- 影響：成功且進入 distribution audit 的路徑會由 exit trap 清理，但前置 command failure／staple failure／DMG verification failure 會把 raw Apple output 與 stderr 留在 runner temp；這違反本輪明訂的成功／失敗路徑清理、raw output 不留存與 bounded provenance 要求，並可能使 persistent self-hosted runner 留有敏感診斷內容。
- 建議：把 raw input cleanup 放進獨立 `if: always()` 的最後 cleanup step，且在該 step 以固定 run-scoped path／存在性檢查清除 JSON 與 stderr；必要時在 notary step 內再加 trap 作為早期失敗保護。新增 workflow static regression，模擬每個前置 step failure 時 cleanup 仍會執行且不把 raw files 上傳。

### F-03 — P2：notary trust boundary 與 workflow failure cleanup 的 focused regression 不足

- 位置：`scripts/test-macos-signed-canary-distribution.mjs:86-104`；`scripts/test-macos-signed-canary-gate.mjs:144-149`。
- 已成立：writer fixture 驗證 mode `0600` 與第二次 `wx` write 的 `EEXIST`；notary fixture 覆蓋 valid output、DMG digest mismatch 與 missing file；workflow selector／run basename／cleanup symbol static assertions 與 YAML parse 均通過。
- 缺口：notary test 未覆蓋缺少 `GITHUB_RUN_ID`、path 在 `RUNNER_TEMP` 外、wrong-run basename、empty／malformed JSON、canonical `Accepted` 與 lowercase 差異，也沒有驗證 output digest 是 raw bytes digest。gate static test 沒有約束 `if: always()` cleanup 或 raw JSON／stderr 在 notarytool／stapler／verify failure 時仍被清除。
- 影響：目前 focused／full test 綠燈不足以防止 F-01／F-02 回歸；round1 的問題可再次以 workflow static contract 未涵蓋的 failure branch 重新出現。
- 建議：補上上述 deterministic parser cases，並把 cleanup sequence 抽成可檢查的固定 workflow contract；不需執行 Apple command 即可由 fixture／static assertion 驗證 failure path。

### F-04 — P2：F-04 實作已修正，但 environment／interpretation leaf type 負向測試仍不完整

- 位置：`scripts/audit-macos-signed-canary-distribution.mjs:117-119,138`；`scripts/test-macos-signed-canary-distribution.mjs:78-84`。
- 判定：validator 已正確要求 ISO timestamp、`completedAt >= startedAt`、environment 四個 leaf 為非空 string、interpretation 為非空 string；candidate cross-field 已要求 `appMetadataValid === (appExecutableSha256 !== null)`，round1 F-02 的兩個矛盾 fixture 也已加入並通過。
- 缺口：focused fixture 目前只實際測 timestamp ordering，沒有把 `environment.node`／`environment.osRelease` 改成 `null`／空字串／非字串，也沒有把 interpretation 改成 `null`／空字串來確認各自錯誤碼；因此文件宣稱的完整 schema negative matrix 尚未由測試完全支撐。
- 影響：目前不是已觀察到的 validator correctness failure，而是治理所要求的 fail-closed leaf contract 缺少回歸保護。
- 建議：補上每個 leaf type／empty negative case，並保留目前 timestamp ordering 與 candidate digest contradiction cases。

### F-05 — P2：治理文件對 F-01 的完成語意早於實際 contract

- 位置：`docs/project-management/00-CURRENT-STATUS.md:5-7`、`docs/project-management/05-DEVELOPMENT-AND-DEPLOYMENT.md:60-62`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-7`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-7`；`docs/project-management/08-CHANGE-LOG.md:3-15`。
- 證據：00／05／06／07 已寫成 fixed run-scoped output、run ID／basename／DMG／output digest binding 且不接受 caller-supplied marker；但 F-01 顯示 production audit 仍接受任意絕對路徑／缺少 run env，F-02 顯示 failure cleanup 尚未完整。08 雖仍正確標為「進行中」，但尚未列出 round1／本 round2 findings 與未完成條件。
- 影響：若直接以目前文件作為 closeout，會把 source-level partial contract 誤讀為完整 notary provenance／cleanup acceptance。
- 建議：在 F-01／F-02 修正及 round3／後續複審前，維持 08 進行中；同步將 00／05／06／07 降級為 source contract candidate，並於真正 closeout 時連結 round1／round2／後續 accepted report 與 `npm run docs:check:final` 結果。

## 六面向判定

### 1. 需求／範圍：部分通過

artifact selector、nested Helper fixture、唯一性 cardinality、DMG／app evidence schema 與未執行 Apple workflow 的界線符合範圍；但 fixed run-scoped raw output 與成功／失敗清理仍未完全符合本輪要求（F-01、F-02）。

### 2. 正確性與 fail-closed：不通過

candidate metadata／digest cross-field、timestamp ordering、environment／interpretation leaf type、stapler／archive status consistency 已 fail-closed；notary path／run binding 在缺少 env 或 runner-temp boundary 時未 fail-closed，workflow failure cleanup 也不完整。

### 3. 證據／provenance：不通過

app／DMG digest、source revision、exclusive writer 與正常 workflow 順序方向正確；但 caller-supplied raw output 可被 parser 接受，output digest 不是精確 raw-file digest，且 failure path 可留下 raw output，因此尚不能視為完整 distribution provenance。

### 4. 隱私／安全：部分通過

repository evidence 使用 bounded path、exclusive create／0600 且不保存 raw output；但 raw JSON／stderr 在前置失敗時可能殘留 runner temp，且 audit 沒有限制 `RUNNER_TEMP` path boundary，故安全與清理條件未完成。

### 5. 測試／回歸：部分通過

focused tests、完整 `npm run check`、syntax、YAML parse、`npm run docs:check` 與 `git diff --check` 均通過；但 no-run-id／outside-runner-temp／wrong-run／malformed／lowercase notary cases、failure cleanup static contract、environment／interpretation leaf negatives 尚未覆蓋。

### 6. 治理／文件：部分通過

08 仍標示進行中且未將本輪審查誤寫成外部 Apple pass；然而 00／05／06／07 已使用超過目前實作所能支撐的 run binding／cleanup 完成語意，應待修正與後續 accepted review 後再 closeout。

## 驗證命令

- `node scripts/test-macos-signed-canary-gate.mjs`：exit 0。
- `node scripts/test-macos-signed-canary-distribution.mjs`：exit 0。
- 相關 `node --check`：exit 0。
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/macos-signed-canary.yml")'`：exit 0。
- `npm run docs:check`：exit 0，19 個治理文件通過。
- `npm run check`：完整回歸完成且 exit 0；包含上述 distribution contract test 與既有全套測試，未執行 Apple command。
- `git diff --check`：exit 0。
- deterministic `readNotaryOutput` probe：確認缺少 `GITHUB_RUN_ID` 仍可接受、設定 run ID 但 path 在 `RUNNER_TEMP` 外仍可接受、`accepted` 小寫仍可接受，以及 diagnostic bytes 比 raw file bytes 多一個 synthetic newline。
- 未執行：GitHub Actions、Apple signing／notarization、`stapler`、`hdiutil`、`spctl`、keychain、packaged app 或外部 network。

## 綜合結論

**本輪 `FR-021-MACOS-CI-20261029-DISTRIBUTION-EVIDENCE-NEXT1` round2 獨立複審結論為不通過：round1 的 candidate metadata／digest cross-field、timestamp ordering、environment／interpretation leaf type、selector／nested Helper fixture、exclusive 0600／EEXIST writer、workflow 正常 evidence copy／cleanup 順序與 YAML／回歸檢查均已成立，但 raw notarytool JSON 仍可在缺少 CI run identity 或位於 `RUNNER_TEMP` 外時由 caller-supplied path 通過，output digest 不是精確 raw-file digest，且 notarytool／stapler／verify 前置失敗路徑沒有保證清理 raw JSON／stderr；因此 round1 F-01 尚未解除、distribution provenance 不能 closeout，並需修正 F-01／F-02、補齊 focused failure／leaf tests、同步治理文件後再由獨立上下文複審。**

## 審查代理聲明

本審查代理僅讀取指定 workspace、執行唯讀檢查與 deterministic temporary fixture 驗證；唯一新增檔案為本報告 `docs/project-management/reviews/2026-10-29-fr-021-distribution-evidence-next1-round2.md`，未修改任何其他檔案，未刪除或覆寫既有 evidence／reviews，亦未執行 GitHub／Apple／keychain／packaged app／外部 network 操作。

若上述聲明不實，本報告無效。
