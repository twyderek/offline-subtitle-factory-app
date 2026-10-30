# 獨立審查報告：報告參考優化：任務狀態輪詢、快取與安全錯誤處理

- 審查對象 commit／版本：working tree、版本 0.51.0、branch `codex/0.51-anthropic-claude`；本輪未提交 commit。
- 對應 08-CHANGE-LOG 條目：2026-09-29 — 報告參考優化：任務狀態輪詢、快取與安全錯誤處理
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-09-29T15:53:05+08:00；本報告由獨立審查上下文建立，未以主要代理先前的測試敘述作為證據。

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:12-16` 要求自適應且不重疊輪詢、狀態保存時清除列表快取、生產 API 不回傳內部 stack／路徑、校閱動態值轉義；`docs/project-management/03-FUNCTIONAL-DESIGN.md:34-40` 記錄實作邊界。`public/app.js:1288-1335`、`server.mjs:934-944`、`public/review.js:1062-1074` 與 `scripts/test-report-optimizations.mjs:14-30` 對應完成主要項目。
- 證據：工作紀錄 `08-CHANGE-LOG.md:14` 明列輪詢需覆蓋頁面隱藏，但目前 `startPolling()` 區段沒有 `document.hidden` 或可見度處理；`server.mjs:3997-4723` 仍有多個 API catch 直接回傳 `error.message`，不符合工作紀錄對「生產 API」的未限定描述。需求範圍因此未完全閉合。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：`public/app.js:1288-1293` 以 `clearTimeout` 與 generation 停止舊 timer；`public/app.js:1304-1335` 在 `await fetch` 完成後才排程下一次，並依狀態變化／失敗退避至 10 秒，避免原報告範例中修改 `setInterval` 變數但實際間隔不變的問題。`server.mjs:934-944` 將 `jobsListCache = null` 放入 `saveStatus()`；`public/review.js:1062-1074` 對時間碼與 input value 使用 `escapeHtml()`。
- 證據：`server.mjs:175-179` 的固定錯誤訊息邊界只被 `server.mjs:4194-4232` 的影片 probe、任務列表與建立任務三個 catch 使用；同一 API handler 的 `server.mjs:3997-4147`、`4256-4693` 仍直接傳送 `error.message`。因此安全錯誤邊界在已涵蓋端點邏輯正確，但不是全 API 邊界。
- 證據：`public/app.js:1997-2001` 在取消 API 立即讀取一次狀態後停止輪詢；這沿用原本 `clearInterval` 行為，本輪沒有新增終態等待機制，故取消後若立即回傳非終態，最終狀態更新未被本輪證明。

## 3. 邊界情況

- 判定：部分通過
- 證據：2026-09-29T15:53:16+08:00 執行 `node scripts/test-report-optimizations.mjs` 通過；測試以 `NODE_ENV=production` 啟動獨立 server，送出無效影片，實際驗證 `/api/video/probe` 回傳固定錯誤且不含 `/Users/`、`/private/`、`ENOENT` 或 `ffprobe`。同一測試也檢查輪詢 generation、URL encoding、`setTimeout`、快取 source contract 與校閱 HTML 轉義。
- 證據：同一 focused test 只做 source-contract assertions，沒有實際建立兩個重疊 `startPolling()` 呼叫、模擬晚到 fetch response、切換 `document.hidden`、或以 DOM 執行惡意時間碼／數值 attribute。`server.mjs:3997-4723` 的其他錯誤端點也沒有 production 負向測試。

## 4. 程式碼品質

- 判定：通過
- 證據：`public/app.js:1288-1335` 將輪詢停止、generation、排程與 fetch 控制流集中在小範圍函式；`server.mjs:175-179` 以固定 fallback 與 development／test 詳細錯誤分流；`server.mjs:218-224` 對預期 `ENOENT` 不製造清理日誌噪音；`server.mjs:934-944` 移除 `updateJob()` 對同一快取的重複清除。沒有改資料格式、SSE／WebSocket 或無關大型重構。
- 證據：`git diff --check` 於 2026-09-29T15:53:16+08:00 通過；`node --check server.mjs`、`public/app.js`、`public/review.js` 與 `scripts/test-report-optimizations.mjs` 同一指令鏈通過。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-09-29T15:53:20+08:00 執行 `npm run check`，`docs:check` 通過，所有 syntax checks、`npm test`、新增優化測試、既有校閱 UI 測試與核心 API 回歸均以 exit 0 完成；輸出包含「報告參考優化測試通過」、「校閱 UI 測試通過」與「核心回歸測試通過」。
- 證據：目前測試足以覆蓋固定字串邊界、無效影片 production API、source contract 與既有核心流程，但沒有覆蓋所有 `error.message` API catch、頁面隱藏輪詢、真實瀏覽器 timer／DOM 行為、Electron packaged UI 或實機環境。`npm run check` 是 source／mock／核心回歸，不是 Electron 實機驗收。

## 6. 實際運行結果

- 判定：部分通過
- 證據：2026-09-29T15:53:16+08:00 的 focused test 實際啟動 production server 並完成無效影片 probe；2026-09-29T15:53:20+08:00 的 `npm run check` 實際完成 19 個治理文件檢查與整套回歸，exit 0。測試產生的暫存資料由測試 finally 清除，沒有修改既有工作樹檔案（本報告除外）。
- 證據：2026-09-29T15:54:09+08:00 執行 `npm run docs:check:final` 失敗，原因為最新工作紀錄仍為「進行中」，且「獨立審查是否執行」尚未填入是／否；這是結案前置條件尚未完成，不是程式回歸失敗。未執行 packaged Electron、瀏覽器人工操作或跨平台實機驗收。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：(1) 需將 production 錯誤訊息政策套用至所有對外 API catch，或明確把本輪範圍縮限為影片 probe／任務列表／建立任務並在工作紀錄揭露其餘端點風險；(2) 需處理或明確標記 `document.hidden` 輪詢需求未覆蓋；(3) 主要代理須同步本報告至 `08-CHANGE-LOG.md`、完成工作紀錄狀態欄位並重新執行 `npm run docs:check:final`。
- 剩餘風險：未驗證實際瀏覽器中的 timer 重入／晚到回應、頁面可見度切換與 DOM XSS 執行結果；未驗證 Electron packaged UI、Windows、乾淨安裝、發布資產或跨平台實機。列表快取的行為以 source contract 驗證，未有專門測試直接觀察狀態保存後的快取刷新。
- 給主要開發代理的具體修正要求：先修正上述範圍／文件條件，不要覆寫本 round1 報告；若程式改動影響本報告結論，建立新的 `2026-09-29-report-optimization-round2.md`，由獨立上下文複審後再結案。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
