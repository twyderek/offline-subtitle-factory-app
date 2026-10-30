# 獨立審查報告：已安裝版與開發版介面再次複核

- 審查對象 commit／版本：codex/0.51-anthropic-claude dirty worktree，source 與 /Applications/離線字幕工廠.app/Contents/Resources/app 均為 0.51.0；版本相同不代表內容相同。
- 對應 08-CHANGE-LOG 條目：2026-10-19 — 已安裝版與開發版介面再次複核。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-19 01:52 UTC 前開始；獨立審查上下文，依本輪委派、AGENTS、debug preflight 核心與必要路由、工具及原始證據查證，未沿用開發代理對話記憶。
- 可執行計畫：讀治理規則與本輪範圍；檢查 helper／入口及隔離邊界；重算 hashes、檢查 JSON／畫面；在 /tmp 重跑隔離驗證；建立唯一報告並驗證格式。以上已完成。
- 範圍補充：報告完成前收到使用者確認，實際現行軟體就是 /Applications 版，但使用者指出先前檢核網頁不足以和現行軟體比對。此確認只解除基準版本身分的待確認事項，沒有補足原生 runtime 驗收。主代理規劃的原生 executable／BrowserWindow 診斷未納入本輪；本代理未啟動 installed executable 或新增 runner。

## 1. 需求完整性

- 判定：部分通過
- 證據：08-CHANGE-LOG.md:3–24 定義 FR-027、NFR-006／007 的診斷、同資料三尺寸對照及不修改產品範圍；06-TEST-AND-PROCESS-AUDIT.md:3–13、00-CURRENT-STATUS.md:11–13 與 07-DEBUG-AND-FIX-HISTORY.md:3–8 均保留 BUG-049、source 殼與 fixture 限制。helper scripts/compare-installed-ui.mjs:5–19 固定已安裝 public 路徑、模式及五項資源 hash。使用者最新確認 /Applications 基準身分，但要求的現行軟體原生對照仍有缺口，本輪只能完成前端資源診斷，不能宣稱使用者實際軟體比對需求已全部完成。

## 2. 邏輯正確性

- 判定：通過
- 證據：scripts/compare-installed-ui.mjs:21–49 以同 origin、realpath 邊界限定已安裝 public 的 Fetch 替換，其他 API 繼續 source fixture；:51–114 在兩版間導航並移除攔截、回復尺寸及 source 頁面。scripts/verify-youtube-ui.mjs:9、97–100 為明示選用入口，並未執行已安裝 main。2026-10-19 01:52 UTC 後獨立 Node SHA-256 核對 v3 comparison.json 的五組 source／installed hashes 均與現有檔案一致。1280／1400 的 viewer、editor、cueList 幾何兩版相等；這支持特定 fixture 下主布局一致，不支持像素完全一致或完整 runtime 一致。首頁截圖仍可見日期資訊差異，校閱頁 source 新增 YouTube 入口使頂列向左移。

## 3. 邊界情況

- 判定：部分通過
- 證據：v3.png.comparison.json 的 1100×700 source review editor.right=1189、cueList.right=1187、viewer/editor.bottom=771.0390625；installed 前端同數值，workspace.right=1201，source workspace.right=1100。已目視 v3 source／installed-review-1100.png，確認影片跨欄遮擋、右側內容裁切，BUG-049 未修正且不能歸為 YouTube 獨有回歸。獨立 /tmp 重跑相同幾何全部重現。1024 為 modal 壓力案，不是擴大支援尺寸。沒有原生 resize、OS 縮放、長字幕／多 cue 或真實專案覆蓋。

## 4. 程式碼品質

- 判定：通過
- 證據：scripts/compare-installed-ui.mjs 使用 wx 保存截圖與 JSON、realpath 防越界及 finally 還原攔截；兩支工具 node --check 均 exit 0。scripts/verify-youtube-ui.mjs:12–40 使用 mkdtemp、自有合成 MP4 與 user-data-dir，:227–236 收尾 source 子程序及暫存 profile。非阻擋工具限制：compare-installed-ui.mjs:84–95 對新譯文完成保存後重載讀回，但還原原文後只等儲存提示，未再重載／核對磁碟，editSaveReloadRestored=true 的命名強於實際最後一步驗證；宜解讀為「編輯重載已驗證、還原儲存提示成功」。比較模式未單獨要求合成有效媒體旗標，單獨 --compare-installed 不等同本輪已驗證的完整指令。初期 setup 在外層 try 前，早期失敗清理不如正常路徑完整；本輪成功路徑未遇此情況。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：本代理於 2026-10-19 01:52 UTC 後親自執行 node scripts/verify-youtube-ui.mjs /tmp/installed-ui-independent-20261019-015230.png --compare-installed --validate-usability，exit 0；log 位於 /tmp/installed-ui-independent-20261019-015230.log。另執行兩支工具 node --check 皆 exit 0、v3 hashes 核對及重跑 JSON 對照：12 views、12 PNG 存在、interceptionErrors=[]、各 view panels 與 v3 完全一致。主代理的完整 npm run check exit 0 僅屬委派及 06／08 所載開發驗證，本代理沒有重跑，不冒稱自身實測。npm run docs:check:final 本代理執行 exit 1，當時最新 08 仍為進行中，獨立審查欄仍為尚未執行；須由主代理整合報告及後續診斷後完成結案，不能將此 gate 稱已通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：本代理重跑 source／installed 前端播放 duration=3、currentTime 分別 0.000811／0.000267，tasks 各有 editSaveReloadRestored=true，最後還原驗證限制見第四節。完整 log 後段確認 modal 三支援尺寸、樣式、1900ms 錯誤保留、Tab／Escape／Enter 及 rendererStateFixture 12 案 passed=true、videoStarts=1；JSON 只保存其中量測，不能單憑檔案存在推定後續鍵盤通過。已目視 v3 的兩版 home-1280、review-1280 與 review-1100 圖，首頁有專案卡片而非 API 驗證失敗，1280 主欄相同、1100 缺陷明顯。v1 僅有 source home 三張圖，不能視為完成；v2 保留舊量測，其首頁 token 問題不作成功驗收。v3 的導航保留 query（helper:57），本輪有效證據以 v3 及獨立重跑為準。未執行已安裝 runtime、真實 Google／Keychain 或外部上傳，也未以無 Google 流程宣稱封包級禁止外連。

## 綜合判定

- 結論：通過
- 可逐字引用的完整結論句：**本輪獨立審查通過僅限已安裝前端資源與 source 殼之隔離診斷：1280／1400 主布局幾何一致及 1100×700 的 BUG-049 均經獨立重現，程序 exit 0 不代表產品整體可用性通過；使用者已確認現行軟體為 /Applications 版，但原生已安裝 runtime 對照仍未完成，因此不得宣稱現行軟體比對需求全部完成或產品可交付。**
- 阻擋問題（若有）：本輪前端資源診斷無新增必修程式阻擋；BUG-049 是產品整體可用性阻擋，仍未修正。原生 installed runtime 對照是使用者完整比對需求的證據缺口，應由後續 round2 審查新增證據。文件 final gate 尚未通過，須由主代理完成整合與結案，審查代理不得修改 08。
- 剩餘風險：兩版共用 source Electron／preload／API，不能證明已安裝 main、原生視窗尺寸或使用者實際操作效果；fixture 的 AI 狀態恢復失敗文字不作真實 AI 任務診斷。譯文還原後缺少二次重載驗證；首頁日期等細節並非一致。真實 Google／Keychain、安裝包、Windows、OS 縮放、螢幕閱讀器與一般使用者任務成功率均未驗收。使用者已確認基準身分，不代表接受 BUG-049 或交付風險。
- 給主要開發代理的具體修正要求（若有）：本輪不要求改產品。整合時逐字引用範圍結論、更新基準身分已確認資訊，保留 v1／v2／v3 原件；將新增原生診斷交 round2，並完成 docs:check:final。不得把同場前端對照、mock 通過或程序 exit 0 擴大為整體產品 pass；後續工具可增還原後讀回與工作區可視性明確斷言，但不回寫歷史證據。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 獨立重跑輸出僅存 /tmp，自有 source profile 由 verifier 清理；未啟動 installed executable、使用者既有 profile、真實 Google／Keychain，未打包、提交、推送或修改主代理 08。大量先前工作樹變更均保留。
- 若上述聲明不實，本報告無效。
- 簽署：Codex 獨立六面向審查代理，2026-10-19。
