# 獨立審查報告：FR-021 macOS malformed-candidate bounded evidence next1 round2

- 審查對象：目前工作樹指定變更 `lib/macos-signed-canary-verification.mjs`、`scripts/audit-macos-signed-canary-result.mjs`、`scripts/audit-macos-packaged-security-identity.mjs`、`scripts/test-macos-signed-canary-result.mjs` 與 `docs/project-management/08-CHANGE-LOG.md`；round1 報告保留未覆寫，其他 dirty tracked／untracked changes 不屬於本輪交付。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS candidate malformed-metadata bounded evidence hardening（`FR-021-MACOS-CI-20261029-MALFORMED-CANDIDATE-NEXT1`）。
- 審查輪次：round2；前輪報告：`docs/project-management/reviews/2026-10-29-fr-021-macos-signed-canary-malformed-candidate-next1-round1.md`。
- 審查代理啟動時間、上下文來源：2026-10-29（Asia/Taipei）；獨立唯讀審查上下文，重新讀取 `AGENTS.md`、`npm run project:preflight -- --type=full` 指定核心／路由文件、最新 08 條目、round1 report 與目前指定 source／test；未沿用主要開發代理的評價性結論。
- 審查限制：只新增本報告；未修改 source、test、evidence、candidate、08 或 round1 review，未 stage／commit／push，未觸發 workflow、builder、codesign、notarytool、stapler、spctl、signing、notarization、release 或外部 GitHub resource。
- 驗證環境：Node.js `v22.22.3`、Apple Silicon macOS；目前工作樹保留既有 unrelated dirty changes。

## 1. 需求完整性

- 判定：通過。
- 證據：`docs/project-management/08-CHANGE-LOG.md:3` 已由 round1 的 `#` 修正為 `##`，符合既有工作條目格式；`npm run docs:check:final` 現在確實解析本輪條目，而不是錯誤沿用前一個 cleanup entry。round1 F-01 的 heading／parser mismatch 已關閉。
- 證據：round1 F-02 所要求的 packaged identity strict digest contract 已加入 `scripts/audit-macos-packaged-security-identity.mjs:32-34,137-143`；`allVerified` 現在必須通過 `isSha256(item.executableSha256)`，而非只檢查 truthy 值。
- 證據：本輪仍維持原定範圍：共用 executable-name guard、null-safe hash、immutable exclusive writer、privacy projection、fail-closed audit 與 focused regression；未擴大至 ZIP、notary password、GitHub Environment／secret、workflow run 或 FR-021 overall。

## 2. 邏輯正確性

- 判定：通過。
- 證據：shared `codeObjectReady`（`lib/macos-signed-canary-verification.mjs:143-155`）與 signed-result `expectedObjectsReady`（`scripts/audit-macos-signed-canary-result.mjs:229-234`）均要求 64 個小寫 hex 字元；packaged identity 的 `allVerified`（`scripts/audit-macos-packaged-security-identity.mjs:142-143`）也使用同一語意的 `isSha256` predicate。round1 F-02 已由 source 與 test assertion 關閉。
- 證據：兩支 audit 的 objects 都固定建立 `main-app`、`electron-framework` 加四個 expected helper，result audit `scripts/audit-macos-signed-canary-result.mjs:286-290` 與 packaged audit `scripts/audit-macos-packaged-security-identity.mjs:137-141` 的順序均對應六個 expected code-object labels；缺失 helper 不再縮短 evidence objects 而改以 null／failed object 保留固定形狀。
- 證據：invalid／missing executable name 會先轉成 `null`，再以 null-safe binary hash、strict object readiness 與 `status: fail` 收斂；不再把未驗證 plist 值直接送入 `path.join` 或無保護的 hash writer。

## 3. 邊界情況

- 判定：通過（限本輪 deterministic bounded scope）。
- 證據：`scripts/test-macos-signed-canary-result.mjs:75-79` 覆蓋 null、空值、`.`／`..`、相對／絕對路徑、反斜線、換行與超長 executable name；`scripts/test-macos-signed-canary-result.mjs:229-268` 以 fake-darwin bootstrap 實際啟動兩支 audit，使用 malformed `.app`，確認兩者都以 exit status 1 失敗且仍留下 JSON evidence、`status: fail`、null executable digest、固定 6 個 objects 與 mode `0600`。
- 證據：result fake-darwin probe 另確認 `validateEvidence` 不拋例外、candidate metadata 為 false、`candidate.executableSha256` 為 null、objects 長度等於 `expectedCodeObjectLabels.length`；finally 會移除臨時 evidence／bundle，避免測試污染工作樹。
- 限制：fake-darwin probe 覆蓋的是缺失／不可讀 metadata 的 bounded path，不是真實 Developer ID app；本輪未在真實 malformed `Info.plist`、真實 `codesign`／`stapler`／Gatekeeper 或 self-hosted runner 上執行。因此本節通過不延伸為實際 macOS signing、notarization 或 workflow evidence。

## 4. 程式碼品質

- 判定：通過。
- 證據：round1 F-02 的 packaged `allVerified` truthy false-pass 已移除；local `isSha256` predicate 與 source assertion 使 packaged identity 與 signed-result 的 digest gate 對齊。executable-name validation 仍集中於 shared module，沒有在兩支 audit 重複 path traversal guard。
- 證據：固定六物件輸出保留 schema cardinality，即使 helper inventory 缺失也能形成可驗證 fail evidence；`sha256FileOrNull`、exclusive `wx` writer、privacy／scope projection 與既有 source provenance boundary 均保留。
- 證據：`git diff --check` exit 0；round1 report 檔案仍存在且本輪沒有對其寫入，指定 review path 只有本 round2 報告新增。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：`node scripts/test-macos-signed-canary-result.mjs` exit 0；`node --check` 對四個指定 source／test 均 exit 0；`node scripts/test-project-docs-validator.mjs` exit 0；完整 `npm run check` exit 0，包含 signed-canary result／packaged identity 相關 syntax 與 regression suite。
- 證據：focused test 新增 packaged source assertion `isSha256(item.executableSha256)`，並以 fake-darwin process probes 實際驗證兩份 0600 fail evidence、result schema 不拋錯及固定 6 個 objects；這已覆蓋 round1 F-02 的缺口，而不是只做靜態 grep。
- 治理 closeout condition：`npm run docs:check:final` 已正確讀取本輪 `##` entry，但 exit 1，明確回報最新條目仍為「進行中」、缺少「獨立審查是否執行：」、缺少「發布授權：」且未填本 round2 linkage。這不是 source／test failure；因使用者要求本輪只新增 review，不能在本報告中代替主要代理回填 08。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：preflight exit 0；四個指定檔案 syntax、focused result test、project-docs validator、`git diff --check` 與完整 `npm run check` 均 exit 0。fake-darwin probes 實際執行子程序並檢查落盤 evidence，而非只驗證 source string。
- 證據：`docs:check:final` 的失敗已不再是 round1 的 heading bypass；它現在針對本輪真正的 closeout 欄位失敗。需由主要代理在後續允許修改 08 時補入 round2 審查路徑、逐字 canonical 結論、審查是否執行、發布授權與完成狀態，再重跑 final gate。
- 發布／外部邊界：本輪沒有發布授權需求，也沒有 workflow run、candidate execution、Apple identity／credential、signing、notarization、Gatekeeper、release asset 或 FR-021 overall evidence；local checks 不代表上述任何結果。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪 FR-021 malformed-candidate bounded-evidence round2 複審確認 round1 的 F-01／F-02 已由可解析的 `##` 08 heading、packaged `isSha256`／`allVerified` strict predicate、source assertion、fake-darwin bounded evidence、0600 writer 與固定 6-object regression 關閉；focused／full local checks 通過，但 `docs:check:final` 仍待本輪條目回填審查欄位與結案，且本輪不代表 workflow run、signing、notarization、release 或 FR-021 overall，因此結論為有條件通過。**
- Findings 狀態：round1 F-01（P1，08 heading 導致治理 final gate 忽略本輪）已關閉；round1 F-02（P2，packaged `allVerified` 未嚴格驗證 executable digest）已關閉；本輪未新增 source blocker。
- 阻擋問題（若有）：無 source／test blocker；唯一 closeout condition 是主要代理需在後續治理回填中更新 08 本輪欄位並重新通過 `npm run docs:check:final`。本輪 review 依使用者限制未修改 08。
- 剩餘風險：真實 malformed `.app`／PlistBuddy／codesign／stapler／Gatekeeper／self-hosted workflow 尚未執行；Apple Environment、required reviewer、secret scope、protected branch、Apple identity／credential、ZIP coverage、notary password argv、tracked evidence mode、ignored runtime fixture reproducibility 與其他 FR-021 residual 均不由本輪 local checks 關閉。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
