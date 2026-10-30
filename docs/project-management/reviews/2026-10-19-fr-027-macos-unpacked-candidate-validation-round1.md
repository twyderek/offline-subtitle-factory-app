# 獨立審查報告：FR-027 macOS arm64 unpacked 開發候選驗證

- 審查對象：`/Users/nycu/Documents/離線字幕工廠/dist/test-build-0.51.0-youtube-ui-20261019/mac-arm64/離線字幕工廠.app`；bundle 與 app package 版本均為 `0.51.0`。
- 對應 08-CHANGE-LOG 條目：2026-10-19 — FR-027 macOS 封裝開發候選可用性驗證。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-19 11:24 CST；本輪獨立 review 上下文，依指定治理文件、程式碼、候選 bundle 與既存 evidence 檢視，未以開發代理的評價作判斷。
- 審查需求：FR-027、FR-003、NFR-003、NFR-005、NFR-006、NFR-007。
- 審查界線：只判定 macOS arm64 unpacked 候選及本地驗證工具。1024 px 是壓力量測，不列作支援需求；AI fixture 的 missing-task 訊息不作 AI 驗收。

## 1. 需求完整性

- 判定：部分通過。
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:19,44-46,62-66` 定義 FR-003 為本機離線 Whisper.cpp、FR-027 為需真實 OAuth／private upload 的 YouTube MVP，及相容性、可靠性、可追溯性、鍵盤操作需求。`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-13` 對本候選明確限定合成媒體、本機 mock 與 macOS arm64 unpacked，並逐項記載版本／資源、布局、YouTube UI 與限制。故本證據適合驗證候選包的啟動及有限 UI 任務，不能證明 FR-027 真實上傳、FR-003 實際離線轉錄或 NFR-003 Windows 支援已驗收。1024 壓力案未納入通過判定。
- 可回溯時間：requirements／audit 於本輪 2026-10-19 11:24 CST 檢視；PNG、usability JSON、comparison JSON、cleanup JSON 修改時間分別為 11:15:07、11:15:07、11:15:05、11:15:14 CST。

## 2. 邏輯正確性

- 判定：部分通過。
- 證據：`scripts/verify-youtube-ui.mjs:16-30` 排除互斥 native target、解析 `--candidate-native=<path>`、要求 `.app` 後綴及 bundle package／executable 存在，並拒絕已存在的 screenshot 路徑。`verify-youtube-ui.mjs:49-54` 對候選直接啟動 bundle executable，移除 `ELECTRON_RUN_AS_NODE`，以新 `mkdtemp` profile、動態 debugger port 與 loopback 位址執行。`scripts/compare-installed-ui.mjs:17-28` 對候選記錄 app runtime 版本、executable、main 與五項前端 runtime SHA-256；comparison evidence 的五項 runtime hash 均等於本輪實際候選 resource hash，且 `interceptionErrors=[]`。
- 邊界缺口：同一 native flag 或重複 `--candidate-native=...` 不會被判為衝突；候選只作副檔名／存在性檢查，未在 CLI 先驗證目錄型態、可執行權限或 bundle 架構。這些不影響本次有效候選命令，但 malformed／重複參數未有執行證據。
- 可回溯時間：程式碼於 11:24 CST 檢視；comparison evidence 時間 11:15:05 CST。

## 3. 邊界情況

- 判定：部分通過。
- 證據：`verify-youtube-ui.mjs:160-181` 對 1400、1280、1100、1024 四個 YouTube modal viewport 量測，僅對寬度至少 1100 的案子套用尺寸與 footer／樣式斷言；`verify-youtube-ui.mjs:213-246` 覆蓋 Tab 焦點留在 dialog、Escape 關閉與焦點返回、Enter 重開、partial／failed 字幕狀態，以及 renderer state fixture。`scripts/review-layout-fixture.mjs` 記錄實際 `window.resizeTo(1100,700)` 是否生效，檢查 workspace/viewer/editor/video 幾何及 22 個控制的 hit-test，另跑八組 viewport；comparison evidence 記錄 native outer 1100×700、content 1100×668、22 個控制，以及長字幕 focus 後 `pageScrollY=0`。本審查未重播 malformed CLI 或 cleanup 失敗情境。
- 限定：1024×700 只作量測，未套用 supported-viewport 斷言，不推導為支援範圍。
- 可回溯時間：程式碼及 fixture 於 11:24 CST 檢視；layout／modal 證據 11:15:05、11:15:07 CST。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：candidate runtime hash 欄位可回溯至實際 bundle；實際核對的版本均為 0.51.0，executable SHA-256 `33b07e6837ee74124304d84fb51cee2683db2da9dd7f991b6f5f997752a8652c`、`electron/main.mjs` SHA-256 `b5fdf9f8a621332f4cf75ed9220ba40b9af67d4bee5f34c6a03eeb38e87bdb05`、`public/styles.css` SHA-256 `d01405c728ecc439da868b28974c0accbd6c8da959075154c627b0ed71672f02`，皆與 comparison evidence 對應。`verify-youtube-ui.mjs:255-263` 對 native run 先清理自有 process group，只有 `groupClosedConfirmed` 才移除 profile；未確認時 assertion 會中止後續刪除，符合 fail-closed。清理 JSON 記錄 group closed／absent、profile removed 且未 force。
- 改善項：明確拒絕重複／混用 native 參數，並以 `stat`／權限／架構檢查提升 candidate CLI 診斷力；目前屬工具邊界強化，並非本次 smoke 的執行失敗。
- 可回溯時間：原始候選與 evidence hash 於 2026-10-19 11:24 CST 獨立核對；cleanup JSON 時間 11:15:14 CST。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：`06-TEST-AND-PROCESS-AUDIT.md:7-12` 記錄指定 candidate 命令 exit 0、三秒合成影片播放、字幕保存／重載／還原、native resize、八種 viewport、YouTube modal／錯誤保留／鍵盤與 12 個 mock cases。既存 comparison JSON 記錄 `duration=3`、`editSaveReloadRestored=true`、22 個控制與零 interception errors；usability JSON 記錄 `googleRequests=false`、四組 viewport 量測及 OAuth 設定錯誤在輪詢後保持。source fixture 列出 12 類狀態案例與 assertions。
- 限制：提供的 evidence JSON 沒有保存 renderer state fixture 的完整 stdout／12-case 回傳物；此結果可由 06 的記錄與 fixture 程式追溯，不能由現存 JSON 單獨重建當次逐案結果。未執行完整 build 或全套 `npm run check`，也未重播；本輪依既存結果審查。
- 可回溯時間：06 記錄及 fixture 於 11:24 CST 檢視；JSON 時間 11:15:05 至 11:15:14 CST。

## 6. 實際運行結果

- 判定：本地 unpacked smoke 通過；整體需求驗收部分通過。
- 證據：候選 `Info.plist` 的 `CFBundleShortVersionString` 與包內 `package.json` 均為 `0.51.0`。候選位於 `dist/test-build-0.51.0-youtube-ui-20261019/mac-arm64/離線字幕工廠.app`；實際 executable 與 CSS hash 等於 comparison JSON 所記錄值。comparison JSON 的 mode 為 `native-candidate-app`，記錄首頁／校閱載入、三秒合成影片播放與字幕保存重載還原；layout.nativeResize 記錄 outer 1100×700／content 1100×668，22 controls 均可達。usability JSON 記錄無 Google requests 及錯誤文字輪詢後保留。cleanup JSON 記錄 `groupClosedConfirmed=true`、`groupAbsentAfterCleanup=true`、`forcedCleanup=false`、`profileRemoved=true`。PNG 為 renderer 畫面證據，不是安裝流程證據。
- 可回溯時間：bundle／hash 於 2026-10-19 11:24 CST 實測讀取；run evidence 時間為 11:15:05–11:15:14 CST。
- 限制：沒有真實 Google／Keychain、DMG／ZIP、安裝後／乾淨帳號、Windows、完整轉錄／匯出或發布驗收；候選為 ad-hoc signature、未 notarize。AI missing-task 狀態不構成 AI 驗收。

## 綜合判定

- 結論：**本輪 FR-027 macOS arm64 unpacked 候選驗證獨立六面向審查有條件通過；候選 0.51.0 的 native 啟動、隔離 profile、resource hash、有限布局與 YouTube 本機 mock evidence 相互吻合，未發現本次 smoke 的阻擋缺陷；此判定只涵蓋 unpacked 本地驗證，不代表 FR-027 真實 Google／Keychain 上傳、FR-003 實際離線轉錄、Windows、安裝後或發布驗收已完成。**
- 阻擋問題：本輪有限 smoke 無阻擋問題；以上明列的功能／平台驗收不在本輪範圍，仍不得據此宣稱相關需求完整驗收。
- 剩餘風險：CLI 重複參數與 malformed bundle 的直接負向測試缺失；12 個 renderer fixture cases 的當次 stdout 未存入指定 evidence；未驗收真實 OAuth／上傳、安裝生命週期、Windows、Developer ID／公證／Gatekeeper、完整轉錄／匯出。不得將 1024 壓力量測或 AI missing-task 狀態作為支援／AI 驗收。
- 給主要開發代理的具體修正要求：無需為本輪 smoke 結果阻擋候選；後續可補同 mode 重複參數拒絕及將 renderer fixture 回傳值持久化到 run evidence。若主張完整 FR-027／FR-003 或跨平台驗收，須另行執行對應驗收與複審。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行唯讀檢視與驗證，未修改任何其他專案檔案或 evidence；未重播候選命令。
- 若上述聲明不實，本報告無效。
