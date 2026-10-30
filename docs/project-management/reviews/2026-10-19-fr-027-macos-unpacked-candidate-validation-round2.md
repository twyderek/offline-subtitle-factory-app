# 獨立審查報告：FR-027 macOS arm64 unpacked 開發候選驗證

- 審查對象／版本：`/Users/nycu/Documents/離線字幕工廠/dist/test-build-0.51.0-youtube-ui-20261019/mac-arm64/離線字幕工廠.app`；bundle 與 app package 皆為 0.51.0，Mach-O 架構為 arm64。
- 對應 08-CHANGE-LOG 條目：2026-10-19 — FR-027 macOS 封裝開發候選可用性驗證。
- 審查輪次：round2。
- 審查代理啟動時間／獨立上下文：2026-10-19 11:25 CST，本輪以獨立審查角色重新檢視原始需求、工具程式、候選 bundle 與既存 evidence；round1 僅用於定位待複審工作，不把 round1 結論當證據。本輪直接檢視截至 11:30 CST。
- 需求範圍：FR-027、FR-003、NFR-003、NFR-005、NFR-006、NFR-007。
- 範圍限制：僅判定 macOS arm64 unpacked 候選及本地 smoke。1024 px 是壓力量測，不列為支援需求；AI fixture 的 missing-task 狀態不作 AI 驗收。

## 1. 需求完整性

- 判定：部分通過。
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:19,44-46,62-66` 將 FR-003 定義為 Whisper.cpp 本機離線轉錄，FR-027 涵蓋實際 OAuth 頻道與使用者同意後的 private 影片／字幕上傳，NFR-003／005／006／007 分別涵蓋相容性、可靠性、可追溯性與鍵盤／語意可存取性。`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-13` 限定本工作為本機 unpacked smoke。其證據可支持候選啟動、合成媒體播放／編輯、局部 layout 與 mock UI；沒有實際 Whisper 轉錄、Google／Keychain／上傳、Windows 或完整 restart lifecycle 證據，因此不是上述需求的完整驗收。
- 時間戳：本輪檢視 2026-10-19 11:27 CST；PNG、usability JSON、comparison JSON、cleanup JSON 修改時間分別為 11:15:07、11:15:07、11:15:05、11:15:14 CST。

## 2. 邏輯正確性

- 判定：部分通過。
- 證據：`scripts/verify-youtube-ui.mjs:16-30` 限制 native target 組合、解析 `--candidate-native=<path>`、要求 `.app` 後綴及 package／executable 存在，並以 exclusive-create 防止覆寫指定 screenshot。`verify-youtube-ui.mjs:49-54` 直接啟動候選 executable，為 native child 建立獨立 process group，使用新 `mkdtemp` profile、動態 debugger port 與 loopback debugger address。`scripts/compare-installed-ui.mjs:17-28` 記錄 runtime version、executable／main script 與五個 frontend resource 的 runtime SHA-256。comparison JSON 的五個 runtime resource hashes 均與該候選／source 欄位相符，interception errors 為空。
- 時間戳：程式碼本輪檢視 2026-10-19 11:28 CST；comparison JSON 修改時間 11:15:05 CST。
- 邊界觀察：同一 native flag 或重複 `--candidate-native=...` 目前不會被當成衝突拒絕；`.app` 路徑只驗後綴及必要檔案存在，CLI 未先檢查目錄型態、執行權限或架構。未找到這些 malformed／duplicate 參數的執行紀錄；有效候選的本次結果不受此點影響。

## 3. 邊界情況

- 判定：部分通過。
- 證據：`scripts/review-layout-fixture.mjs:14-43,49-80` 僅在實測 outer window 確為 1100×700 時宣稱 native resize，並驗證 panel 幾何、水平溢出、22 個控制的 rect／hit-test／頁面捲動；另對八個 viewport 各做幾何與控制可達斷言。comparison JSON 記錄 outer 1100×700、content 1100×668、22 controls 與八個 viewport 各 22 controls。`scripts/verify-youtube-ui.mjs:160-181,213-247` 量測 1400／1280／1100／1024 的 modal，只有寬度至少 1100 的項目套用支援斷言；檢查 Tab 焦點留在 dialog、Escape 關閉與焦點返回、Enter 重開、錯誤保持及 partial 狀態。`scripts/youtube-ui-state-fixture.mjs:65-119` 有 12 個本機 mock 狀態斷言，且明示使用 in-memory bridge、不呼叫真實 Google。
- 時間戳：程式碼本輪檢視 2026-10-19 11:28 CST；comparison／usability JSON 修改時間 11:15:05–11:15:07 CST。
- 限定：1024×700 沒有支援尺寸斷言，不能據此擴張支援承諾；AI 缺少任務的狀態字串不是 AI 測試。未執行 malformed CLI 與清理失敗注入測試。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：`verify-youtube-ui.mjs:251-263` 在 native profile 移除前呼叫 `cleanupProcessGroup` 並斷言 `groupClosedConfirmed`；`lib/process-group-cleanup.mjs:42-78` 以 process group probe 等待，必要時升級訊號，最終只有確認 group 不存在才回報 closed。若確認失敗，caller assertion 先中止，不會執行 profile 刪除。既存 cleanup JSON 記錄 group closed／absent、profile removed 均為 true，`forcedCleanup=false`。本輪實際核對 bundle 的 `CFBundleShortVersionString` 與 package version 皆為 0.51.0；Mach-O／`lipo -archs` 均確認 arm64。2026-10-19 11:31 CST 重新計算候選 executable、main script 與五個前端 resource 的 SHA-256，七項都與 comparison JSON 對應值一致；executable hash 為 `33b07e6837ee74124304d84fb51cee2683db2da9dd7f991b6f5f997752a8652c`，main hash 為 `b5fdf9f8a621332f4cf75ed9220ba40b9af67d4bee5f34c6a03eeb38e87bdb05`，styles hash 為 `d01405c728ecc439da868b28974c0accbd6c8da959075154c627b0ed71672f02`。
- 時間戳：程式碼／bundle 首輪本輪核對 2026-10-19 11:29 CST；七項 hash 對照 11:31 CST；cleanup JSON 修改時間 11:15:14 CST。
- 改善要求：後續可讓 CLI 明確拒絕重複／混用 native 參數，並提前驗證 candidate bundle 型態與 executable 權限；此為輸入診斷改善，不是本次有效命令的阻擋缺陷。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：08 最新條目第 17 行記載指定 native candidate 命令 exit 0、三秒合成影片播放、譯文保存／重載／還原、native resize、八 viewport、modal／鍵盤／12 mock cases 及清理結果。`2026-10-19-packaged-youtube-ui-v1.png.comparison.json` 記錄 `duration=3`、`editSaveReloadRestored=true`、22 個控制與零 interception errors；同名前綴 `.json` 記錄 `googleRequests=false`、四個 modal viewport 與 OAuth 設定錯誤在輪詢後仍保留；`.cleanup.json` 記錄 group 與 profile 清理成功。state fixture 的個別 assertions 可由原始程式追溯。
- 時間戳：相關 artifact 修改時間 2026-10-19 11:15:05–11:15:14 CST；本輪檢視 11:30 CST。
- 限制：usability JSON 未持久化 renderer state fixture 的 12-case 回傳物／當次 stdout；當次 pass 由 08 記錄並可由 fixture 程式對照，不能只從 JSON 逐案重建。本輪沒有重播、build 或執行全套 `npm run check`；引用的執行結果均標為既存紀錄，不冒稱本輪新跑。

## 6. 實際運行結果

- 判定：部分通過
- 證據：候選實際位於 `dist/test-build-0.51.0-youtube-ui-20261019/mac-arm64/離線字幕工廠.app`；bundle/package 版本、arm64 架構與七項獨立 hash 對照已於第 4 節核對。既存 comparison JSON 的 mode 為 `native-candidate-app`，記錄 runtime 0.51.0、首頁／校閱 smoke、播放及保存重載還原；layout 記錄 native 1100×700、22 個控制可達。usability JSON 記錄無 Google requests、modal 尺寸及錯誤保持；PNG 是 App renderer 畫面證據。cleanup JSON 記錄未 force 且已確認移除自有 profile。
- 時間戳：bundle 本輪實查 2026-10-19 11:29 CST、七項 hash 對照 11:31 CST；run artifacts 修改時間 11:15:05–11:15:14 CST。
- 限制：本輪未再次啟動 candidate；沒有真實 Google／Keychain／上傳、DMG／ZIP、安裝後／乾淨帳號、Windows、Developer ID／公證／Gatekeeper 或完整轉錄／匯出驗收。08 記載 `verify-runtime-package.mjs --target=darwin-arm64` 曾 exit 0，但本輪未重新執行；這不等同實際 Whisper 轉錄驗收。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**Round2 獨立六面向審查確認 0.51.0 macOS arm64 unpacked 候選的本地啟動、隔離 profile、resource hashes、有限布局與 YouTube mock evidence 相符且清理已確認，本輪有條件通過；此結論不代表 FR-027 真實上傳、FR-003 實際離線轉錄、Windows、安裝後或發布驗收完成。**
- 阻擋問題（若有）：本地 smoke 範圍內未發現阻擋問題；需求完整性與測試覆蓋仍受本報告所列未驗收項目限制。round2 報告雖符合 review-report schema，`08-CHANGE-LOG.md:20-21` 目前仍指向 round1；validator 依 `scripts/project-docs-validator.mjs:62-70` 以 08 的最新審查引用／逐字句為依據，所以主代理需在允許更新工作紀錄後改連 round2 並引用本報告完整結論句，否則 final gate 不會自動採用 round2。
- 剩餘風險：真實 Google／Keychain／影片字幕上傳、FR-003 實際離線轉錄、Windows 10/11、安裝生命週期、公證／Gatekeeper、完整轉錄／匯出尚未驗收；重複 CLI 參數及 malformed bundle 缺負向測試；12 個 mock cases 的當次回傳物未留存在 evidence JSON。不得把 1024 壓力量測或 AI missing-task 畫面當支援／AI 驗收。
- 給主要開發代理的具體修正要求：無需修改產品／工具程式以解除本輪 smoke 阻擋。後續可補 duplicate/malformed CLI 參數測試並將 renderer fixture 回傳物保存至 evidence；在執行 `docs:check:final` 前，依工作流程把 08 最新條目的審查連結及逐字結論改指 round2，並另行完成仍在範圍外的需求驗收。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
