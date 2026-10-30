# 獨立審查報告：FR-021 macOS malformed-candidate bounded evidence next1 round1

- 審查對象：目前工作樹指定變更 `lib/macos-signed-canary-verification.mjs`、`scripts/audit-macos-signed-canary-result.mjs`、`scripts/audit-macos-packaged-security-identity.mjs`、`scripts/test-macos-signed-canary-result.mjs` 與 `docs/project-management/08-CHANGE-LOG.md`；其他 dirty tracked／untracked changes 不屬於本輪交付。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS candidate malformed-metadata bounded evidence hardening（`FR-021-MACOS-CI-20261029-MALFORMED-CANDIDATE-NEXT1`）。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-29（Asia/Taipei）；獨立唯讀審查上下文，讀取 `AGENTS.md`、`npm run project:preflight -- --type=full` 指定核心／路由文件、目前 08 條目與本輪指定 source／test；未沿用主要開發代理的評價性結論。
- 審查限制：只新增本報告；未修改 source、test、evidence、candidate、08 或既有 review，未 stage／commit／push，未觸發 workflow、builder、codesign、notarytool、stapler、spctl、signing、notarization、release 或外部 GitHub resource。
- 驗證環境：Node.js `v22.22.3`、Apple Silicon macOS；目前工作樹保留既有 unrelated dirty changes。

## 1. 需求完整性

- 判定：部分通過。
- 證據：`lib/macos-signed-canary-verification.mjs:18-24` 新增共用 `normalizeBundleExecutableName`，拒絕缺失、`.`／`..`、路徑分隔符、NUL、CR/LF 與超長 executable name；兩支 audit 均使用該 guard，並以 `sha256FileOrNull` 將不可讀 binary 表示為 bounded `null`。`08-CHANGE-LOG.md:7-14` 的範圍、成功條件與不在範圍項目也與本輪 malformed candidate hardening 相符。
- 證據：signed result 的 `codeObjectReady`（`lib/macos-signed-canary-verification.mjs:143-155`）與 `validateEvidence` 的 `expectedObjectsReady`（`scripts/audit-macos-signed-canary-result.mjs:229-234`）均要求每個 code object 的 `executableSha256` 是 64-hex；focused test `scripts/test-macos-signed-canary-result.mjs:85-109` 已加入 missing executable digest fail-closed case。
- 阻礙：F-01（P1）見「治理／文件」；F-02（P2）見「邏輯正確性」。因此本輪尚未完整滿足條目宣告的 bounded fail-closed contract。

## 2. 邏輯正確性

- 判定：不通過。
- 證據：F-02（P2，packaged audit digest contract 不一致）：`scripts/audit-macos-packaged-security-identity.mjs:138` 的 `allVerified` 仍以 `item.executableSha256 && ...` 的 truthy 判斷，不是 64-hex predicate；本輪聲稱的「code-object ready/allVerified 要求 executableSha256 為 64-hex」只在 shared signed-result path 實際成立，未在 packaged-identity path 明確成立。`sha256File` 目前正常回傳 64-hex 只能算目前 producer 的間接保證，不能取代 fail-closed contract。
- F-02 的獨立 probe 讀取目前 source 得到 `allVerifiedUses64Hex=false`，實際行為片段為 `const allVerified = objects.every((item) => item.executableSha256 && item.verification.succeeded && item.codeSign.commandSucceeded && item.entitlements.commandSucceeded);`。建議由 packaged audit 使用共用 64-hex predicate（或等價的嚴格 regex），並加入 packaged `allVerified` 的 missing／malformed digest regression；修正後需複審。
- 已確認的正確部分：signed result 的 `null` digest 會使 `objectsReady`／`expectedObjectsReady` 為 false 並留下 `code-object-signature-not-ready`，而不是形成 pass；missing object digest bounded schema probe exit 0。

## 3. 邊界情況

- 判定：部分通過。
- 證據：`scripts/test-macos-signed-canary-result.mjs:68-72` 實際覆蓋 `null`、空字串、`.`、`..`、相對／絕對路徑、反斜線、換行與 256 字元名稱；`sha256FileOrNull` 使不可讀 executable／framework binary 不再直接把 writer 前流程炸出例外。
- 證據：本輪獨立 in-memory probe 將 `objects[0].executableSha256` 設為 `null`，同步設置 fail summary，`validateEvidence` 成功返回；這驗證 bounded null evidence 可以通過 schema，而 readiness 仍維持 fail。
- 限制：未執行真實 malformed `.app`、真實 `PlistBuddy`／`codesign`／`spctl`／`stapler` 或 GitHub self-hosted workflow；因此不能把 deterministic／source probe 擴寫成 macOS workflow、signing 或 notarization evidence。F-02 也表示 packaged path 的 malformed／非 64-hex digest 邊界仍缺乏明確 contract regression。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：executable-name validation 已集中在 `lib/macos-signed-canary-verification.mjs`，兩支 audit 不再各自接受未驗證的 plist 值作為 `path.join` 輸入；exclusive `wx` evidence writer、既有 privacy projection 與 source provenance 結構未被本輪破壞。
- F-02：signed-result path 已採嚴格 64-hex，但 packaged-identity path 仍採 truthy 判斷，造成同一 fail-closed invariant 在兩個 audit 的實作不對稱；這是可維護性與未來變更安全性的 residual，不應以目前 `sha256File` 的固定輸出掩蓋。
- `git diff --check` exit 0；本報告沒有修改其他指定檔案或既有審查原件。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：`node scripts/test-macos-signed-canary-result.mjs` exit 0，輸出 `macOS signed canary result verification contract passed: inventory, Developer ID, runtime, entitlements, staple and Gatekeeper fail-closed matrix`；`node --check` 對四個指定 source／test 均 exit 0；`node scripts/test-project-docs-validator.mjs` exit 0；完整 `npm run check` exit 0。
- 證據：focused missing-digest case 驗證 shared `evaluateSignedCanaryVerification` 會 fail closed；本輪另以 in-memory `validateEvidence` probe 驗證 null object digest 的 bounded fail evidence 可被接受。
- 缺口：focused test 沒有直接驗證 packaged audit 的 `allVerified` 對非 64-hex truthy digest 必須拒絕，也沒有以 source assertion 固定該 contract；因此 F-02 尚未由 regression 關閉。
- 治理檢查注意：`npm run docs:check:final` exit 0 的輸出是「最新紀錄已結案」，但該結果並未驗證本輪條目；原因是本輪 08 標題在 `docs/project-management/08-CHANGE-LOG.md:3` 使用 `#`，而 validator 只把 `## YYYY-MM-DD —` 視為工作條目，故它仍讀取前一個 `##` cleanup entry。這構成 F-01，而非本輪治理已完成的證據。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：目前 local syntax、focused result contract、full `npm run check`、project-docs validator 與 `git diff --check` 均通過；`npm run docs:check:final` 亦 exit 0，但如第五節所述，其綠燈是因錯誤的 08 heading 使本輪條目被跳過，不能作為本輪 closeout 證據。
- F-01（P1，治理 final gate 誤報）：`docs/project-management/08-CHANGE-LOG.md:3` 的本輪工作條目應使用既有 `##` 層級，卻使用 `#`；`scripts/check-project-docs.mjs:60-68` 只解析 `^##`，所以不會檢查本輪 `狀態：進行中`、本輪 review linkage、審查結論與發布授權。修正 heading 後必須讓本輪條目成為最新可解析 entry，補齊 round1 結果與必要 closeout 欄位，再重新執行 `npm run docs:check:final`。
- 發布／外部邊界：本輪沒有發布授權需求，也沒有任何 workflow run、candidate execution、Apple identity／credential、signing、notarization、Gatekeeper、release asset 或 FR-021 overall evidence；本報告不將 local checks 宣稱為上述結果。

## 綜合判定

- 結論：不通過。
- 可逐字引用的完整結論句：**本輪 FR-021 malformed-candidate bounded-evidence round1 不通過：signed-result 的 64-hex missing-digest fail-closed path 與 packaged audit 的 null-safe evidence writer 已部分實作且 local focused/full checks 通過，但 packaged `allVerified` 尚未以 64-hex contract 明確驗證，且 08 工作條目使用錯誤的 `#` 層級使 `docs:check:final` 忽略本輪並對前一條目誤報結案；在修正 F-01／F-02 並複審前，不得將本輪宣稱為 workflow run、signing、notarization、release 或 FR-021 overall。**
- Findings：F-01（P1，08 heading 導致治理 final gate 忽略本輪）；F-02（P2，packaged `allVerified` 未嚴格驗證 executable digest 為 64-hex）。
- 阻擋問題（若有）：F-01、F-02；主要代理需修正 source／08 後另立 round2 review，不覆寫本報告。
- 剩餘風險：真實 malformed `.app`／PlistBuddy／codesign／stapler／Gatekeeper／self-hosted workflow 尚未執行；Apple Environment、required reviewer、secret scope、protected branch、Apple identity／credential、ZIP coverage、notary password argv、tracked evidence mode、ignored runtime fixture reproducibility 與其他 FR-021 residual 均不由本輪 local checks 關閉。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
