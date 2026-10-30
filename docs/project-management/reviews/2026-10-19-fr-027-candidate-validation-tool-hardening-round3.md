# 獨立審查報告：FR-027 封裝候選驗收工具邊界補強

- 審查對象 commit／版本：`HEAD 299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`、`package.json` 版本 `0.51.0`；審查含未提交變更的目前工作樹，不表示這些變更已包含在該 commit。
- 對應 08-CHANGE-LOG 條目：2026-10-19 — FR-027 封裝候選驗收工具邊界補強。
- 審查輪次：round3。
- 審查代理啟動時間、上下文來源：2026-10-19 14:13 CST；本輪獨立複審上下文，依 development preflight 重讀專案規則、最新 08／06、round1／round2、目標程式與 evidence。
- 審查需求：FR-027、NFR-006；本輪範圍為候選驗收 CLI、bundle preflight 與 fixture evidence 邊界。
- 執行限制：唯讀檢查、指令執行與驗證；未啟動 candidate 或已安裝 App，未使用真實 Google、Keychain、帳號或上傳。

## 1. 需求完整性

- 判定：部分通過。
- 證據：工作目標要求拒絕重複、混用、帶值、拼錯及缺值的 native target，並在建立 profile／啟動 Electron 前驗證 candidate bundle（`docs/project-management/08-CHANGE-LOG.md:11-17`）。round1 的外部 symlink 與 round2 的 `--installed-native=<value>`／`--source-native=<value>` 兩項具體 findings 已有對應修正及回歸（`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:9-11`）。但獨立 probe 顯示單字拼寫錯誤 `--instaled-native` 仍被忽略、解析成預設 source target；因此「拼錯 target 必須拒絕」尚未完全達成。FR-027 真實 Google／Keychain／上傳不屬本輪工具審查，不能據此宣稱產品端到端驗收完成（`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:44-46`）。

## 2. 邏輯正確性

- 判定：部分通過。
- 證據：round1 finding 已解除：validator 逐層以 `lstat` 要求 `.app/Contents`、`Contents/Resources`、`Contents/Resources/app`、`Contents/MacOS` 為實體目錄，並以 realpath containment 限制 package 與 executable（`scripts/youtube-ui-cli.mjs:46-78`）。round2 finding 已解除：parser 對 `--installed-native`／`--source-native` 後綴帶值或額外字串明確丟錯（同檔 `:9-11`），獨立 probe 中 `--installed-native=value`、`--source-native=value` 均被拒絕。新發現的 `parseNativeTarget(["--instaled-native"])` 則回傳 `{nativeVersion:null,candidateAppPath:null}`；verifier 對 null target 選用 source Electron（`scripts/verify-youtube-ui.mjs:17-20,41-47`），仍可能把拼錯的 installed target 靜默降為 source runtime。

## 3. 邊界情況

- 判定：部分通過。
- 證據：focused suite 對四層外部 directory symlink 都有 direct validator 與 verifier 子程序案例（`scripts/test-youtube-ui-cli.mjs:42-67,84-98`）。子程序將 `TMPDIR` 指向 fixture，檢查失敗後沒有 screenshot evidence，且沒有殘留 `youtube-ui-smoke-` profile（同檔 `:100-109`）。本人另 probe 有效 source／installed／candidate、duplicate、mixed、兩種 `=value` 與 suffix typo；前述有效及舊 blocker 案例結果符合預期，但 `--instaled-native` 未被拒絕。此拼字案例尚無 focused 或 verifier subprocess regression。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：selector parser 與 bundle validator 集中於 `scripts/youtube-ui-cli.mjs`；必要目錄逐層檢查，package／executable 亦拒絕 symlink 並驗證 realpath（`:32-87`）。round2 原始帶值參數不再靜默通過。parser 目前以 `startsWith('--installed-native')`／`startsWith('--source-native')` 捕捉附加字串（`:9-11`），但任意字元拼寫錯誤落入無 target 預設值（`:27-29`），與 verifier 的 source fallback 組合後仍有 selector 誤選風險。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：本人於 2026-10-19 14:13:52 CST 執行 `node --check scripts/youtube-ui-cli.mjs && node --check scripts/test-youtube-ui-cli.mjs && node scripts/test-youtube-ui-cli.mjs`，exit 0，輸出 `YouTube UI CLI target and candidate bundle boundary tests passed.`。Focused suite 已註冊於 `npm test`（`package.json:31`），`npm run check` 會執行 `npm test`（`:32`）。round1／round2 原始 findings 的 cases 均已在目前測試覆蓋；任意拼寫錯誤的 parser／fail-before-profile regression 尚缺。完整 `npm run check` exit 0 是主代理記錄（`docs/project-management/08-CHANGE-LOG.md:17`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:11`），本審查未重跑。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：本人於 2026-10-19 14:14 CST 對既有 candidate `/Users/nycu/Documents/離線字幕工廠/dist/test-build-0.51.0-youtube-ui-20261019/mac-arm64/離線字幕工廠.app` 唯讀呼叫 `validateCandidateApp`，成功回傳 bundle 內 `Contents/Resources/app` 與 `Contents/MacOS/離線字幕工廠`；未啟動 candidate 或已安裝 App。parser probe 同時確認 round2 的兩種帶值參數均拒絕；`--instaled-native` 則回傳無 target，依 verifier 程式分支會選 source runtime，但本輪未啟動任何 App。既有 v2 smoke JSON mtime 為 2026-10-19 13:59:58 CST，且 08／06 明載該 replay 早於 symlink 修正（`docs/project-management/08-CHANGE-LOG.md:17`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:7,9`）；它只能作為較早的 candidate／mock smoke evidence，不能證明修正後工具或 candidate 曾被重播。該 evidence 記錄 `googleRequests=false`、12 個 fixture cases 通過及 3 秒影片播放曾開始（`docs/project-management/evidence/2026-10-19-packaged-youtube-ui-v2.png.json`），不是全長播放或真實 Google 驗收。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪 FR-027 封裝候選驗收工具邊界補強 round3 複審不通過：round1 的 bundle 外 symlink 外逸已由逐層目錄檢查、realpath containment 及四層 direct／verifier 負向測試解除，round2 的 `--installed-native=<value>`／`--source-native=<value>` 靜默忽略亦已由 parser 拒絕與回歸測試解除；但 `--instaled-native` 仍被靜默忽略並解析成預設 source target，故須補拼字錯誤 fail-closed 與無 profile／evidence 副作用測試後再複審；此結論不代表 FR-027 真實 Google／Keychain／帳號／上傳或安裝後驗收完成。**
- 阻擋問題：`--instaled-native`（少一個 `l`）經本人 parser probe 被接受為無 target；verifier 對無 target 選 source Electron。須避免此類拼錯 selector 靜默落入不同 runtime。
- 剩餘風險與未重跑項目：本人未重跑完整 `npm run check`、`npm run docs:check:final`、`git diff --check` 或 candidate UI smoke。`npm run check`、一般 `docs:check` 與 `git diff --check` 的 exit 0 為主代理 08／06 記錄，不是本審查結果；08 最新條目仍將 round3／final gate 列為待完成（`docs/project-management/08-CHANGE-LOG.md:17,26`）。v2 smoke evidence 早於 symlink 修正；本輪只做 candidate 唯讀 preflight。真實 Google／Keychain／帳號／上傳、DMG／ZIP 安裝後、Developer ID／公證及 Windows 驗收仍未涵蓋。
- 給主要開發代理的具體修正要求：為 native target selector 增加可辨識的拼字錯誤拒絕（至少加入 `--instaled-native` 與 `--sorce-native` 負向案例），並以 verifier 子程序及 fixture `TMPDIR` 斷言錯誤在建立 profile／evidence、啟動 runtime 前退出；完成後重跑 focused tests、完整 `npm run check` 與 `npm run docs:check:final`，再交複審。

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
