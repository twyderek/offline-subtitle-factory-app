# 獨立審查報告：FR-027 封裝候選驗收工具邊界補強

- 審查對象 commit／版本：基準 `HEAD 299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`，`package.json` 版本 `0.51.0`；本輪三支目標腳本在檢視時為未追蹤檔案，故本次審查對象是目前工作樹內容，不表示該 commit 已包含它們。
- 對應 08-CHANGE-LOG 條目：2026-10-19 — FR-027 封裝候選驗收工具邊界補強。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-19 14:01 CST；獨立審查上下文，自行讀取專案規則、需求、最新 08／06 條目、程式、測試及 evidence，未採用開發代理的評價性描述作為結論。
- 審查需求：FR-027、NFR-006、NFR-007。
- 審查範圍：`scripts/youtube-ui-cli.mjs`、`scripts/test-youtube-ui-cli.mjs`、`scripts/verify-youtube-ui.mjs`、`package.json` 測試註冊、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md`、`docs/project-management/00-CURRENT-STATUS.md`、`docs/project-management/08-CHANGE-LOG.md` 與候選 smoke evidence。

## 1. 需求完整性

- 判定：部分通過。
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:44-46` 定義 FR-027 為需實際 OAuth、頻道、明確同意及私人影片／字幕上傳的產品需求；`:65-66` 分別要求變更可追溯、測試與獨立審查，以及主要控制可鍵盤操作。此次工具成功拒絕多數重複／混用／缺值 target，並保存 fixture 結果（`docs/project-management/08-CHANGE-LOG.md:11,16-17`），但 candidate bundle preflight 未拒絕中介 `Contents` symlink 指向 bundle 外的 executable，未完全滿足本工作記錄所列有效 `.app` 邊界。Mock 與 unpacked smoke 不能代替 FR-027 真實 Google／Keychain／上傳驗收。

## 2. 邏輯正確性

- 判定：部分通過。
- 證據：`scripts/youtube-ui-cli.mjs:4-25` 拒絕重複、混用及 malformed native target；`:36-59` 驗證 `.app` 根目錄、`Contents/Resources/app/package.json` 與主 executable 類型／執行權限。`scripts/verify-youtube-ui.mjs:17-23,41-47` 先解析及驗證 target，後建立 profile，最後才 spawn executable，故已測輸入會在 profile／app 啟動前失敗。限制在於 `lstat(appRoot)`、`lstat(executable)` 只檢查末端路徑；祖先路徑可為 symlink。本人於 2026-10-19 14:02:37 CST 執行暫存 fixture 探測：建立一般 `.app` 目錄，令 `Contents` symlink 指向 bundle 外、內含一般 `package.json` 與 mode `0755` executable 的目錄，再呼叫 `validateCandidateApp`；實際輸出為 `nested Contents symlink accepted: external executable resolved outside .app`。驗證器其後會以該路徑啟動 executable（`verify-youtube-ui.mjs:41-47`）。

## 3. 邊界情況

- 判定：部分通過。
- 證據：`node scripts/test-youtube-ui-cli.mjs` 於 2026-10-19 14:02:01 CST exit 0；`scripts/test-youtube-ui-cli.mjs:13-20,45-65` 涵蓋重複 source／installed／candidate、混用 target、bare／空值／錯誤 candidate flag、一般檔案冒充 `.app`、缺 package／executable、無 execute bits，以及 verifier 子程序失敗且未建立 evidence。測試未涵蓋 `Contents`／`Resources`／`MacOS` 中介目錄 symlink；上述 14:02:37 CST 實測證明其中 `Contents` symlink 可繞過結構檢查。一般測試使用 `finally` 清除自己的暫存 fixtures（同檔 `:24-37,67-69`）。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：target parser 與 candidate validator 已拆至 `scripts/youtube-ui-cli.mjs:4-61`，驗證器在建立隔離 profile 前呼叫它們（`scripts/verify-youtube-ui.mjs:17-23`）。執行權限同時以 mode bits 及 `fs.accessSync(..., X_OK)` 檢查（`youtube-ui-cli.mjs:49-59`）。不過結構驗證未逐層 `lstat` `Contents`、`Contents/Resources`、`Contents/MacOS`，亦未驗證 package／executable 的 realpath 留在 candidate 根目錄內；第 2 節的實測已確認可接受 bundle 外 executable，因此 fail-closed 邊界仍不完整。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：本人於 2026-10-19 14:02:01 CST 執行 `node scripts/test-youtube-ui-cli.mjs` 與三支目標腳本的 `node --check`，均 exit 0；於 14:02:37 CST 執行 `git diff --check`，exit 0。`package.json:31` 已將 focused test 納入 `npm test`，`:32` 的 `npm run check` 會執行 `npm test`。完整 `npm run check` exit 0 是主代理最新紀錄，來源為 `docs/project-management/08-CHANGE-LOG.md:17`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:8`；該紀錄未附實際執行時間，本審查未重跑，不能視為 reviewer 自行驗證。現有 focused suite 缺少中介 symlink 外逸回歸案例。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：本人於 2026-10-19 14:02:01 CST 對候選 `/Users/nycu/Documents/離線字幕工廠/dist/test-build-0.51.0-youtube-ui-20261019/mac-arm64/離線字幕工廠.app` 作唯讀靜態檢查：bundle 為目錄、包內 `package.json` 版本 `0.51.0`、`Contents/MacOS/離線字幕工廠` 存在且 mode `755`，`X_OK` 通過；未啟動候選或已安裝 App。既存 v2 usability JSON（`docs/project-management/evidence/2026-10-19-packaged-youtube-ui-v2.png.json:2-3,214-238`）記錄 `candidate-electron-usability-audit`、`googleRequests=false`、3 秒媒體 duration、播放開始時間、輪詢前後錯誤一致，以及 `rendererStateFixture.passed=true`、12 個 case names、`videoStarts=1`、`realGoogleRequests=false`。comparison JSON 記錄 `native-candidate-app`、字幕保存／重載／還原與實際 1100×700 resize（`:2,194,207-211`）；cleanup JSON 記錄 process group 已確認關閉、未 force、profile 已移除（`docs/project-management/evidence/2026-10-19-packaged-youtube-ui-v2.png.cleanup.json:2-6`）。三份 JSON 修改時間為 2026-10-19 13:59:49–13:59:58 CST，本審查檢查其內容及可解析性，但未重播候選。JSON 的 playback `currentTime=0.000458`（usability JSON `:214-217`）只支持播放曾啟動，不代表完整播放 3 秒。未執行真實 Google／Keychain／上傳，亦未改動已安裝 App。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪 FR-027 封裝候選驗收工具邊界補強審查不通過：重複／混用／缺值參數、一般錯誤 bundle 與 executable 權限的 focused 驗證及候選 smoke v2 evidence 大致符合記錄，但 `Contents` 中介路徑可經 symlink 指向 bundle 外，使 `validateCandidateApp` 接受並由 verifier 啟動 bundle 外 executable；修正此邊界並加入 fail-before-side-effect 回歸測試後，方可結案；此結果不代表 FR-027 真實 Google／Keychain 上傳功能已驗收。**
- 阻擋問題：候選 `.app` 的 `Contents` 中介路徑 symlink 可指向 bundle 外並讓其 executable 通過檢查；此結果直接破壞 candidate bundle preflight 的結構保證。
- 剩餘風險：本審查未重播 candidate smoke；完整 `npm run check` 僅引用主代理紀錄，沒有 reviewer 重跑。最新 08 條目仍標記「進行中」、final gate 計畫尚未記錄結果（`docs/project-management/08-CHANGE-LOG.md:5,15,18-19`）。真實 Google／Keychain／頻道上傳、安裝後與 Windows 驗收仍在範圍外；不得據此宣稱 FR-027 產品驗收完成。
- 給主要開發代理的具體修正要求：逐層拒絕 `.app/Contents`、`Contents/Resources`、`Contents/MacOS` 等必要結構 symlink，並以 realpath 確保 package 與 executable 位於 candidate 根目錄內；新增中介 symlink 指向外部 package／executable 的負向 fixture，驗證 verifier 在 spawn、profile 與 evidence 建立前失敗；重跑 focused tests、完整 `npm run check` 及 `docs:check:final`，更新 08／06 後交 round2 複審。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
