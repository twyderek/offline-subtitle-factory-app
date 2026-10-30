# 獨立審查報告：報告參考優化：任務狀態輪詢、快取與安全錯誤處理

- 審查對象 commit／版本：working tree、版本 0.51.0、branch `codex/0.51-anthropic-claude`；本輪未提交 commit。
- 對應 08-CHANGE-LOG 條目：2026-09-29 — 報告參考優化：任務狀態輪詢、快取與安全錯誤處理
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-09-29T19:02:59+08:00；本報告由同一獨立審查角色複審，並以 2026-09-29T21:08:41+08:00 後的目前工作樹、round2 報告、治理文件與本輪實際指令輸出為證據。

## 1. 需求完整性

- 判定：通過
- 證據：round2 報告 `docs/project-management/reviews/2026-09-29-report-optimization-round2.md:46-49` 的程式條件要求任務狀態 `message` 經 production 錯誤邊界處理，並補齊 file URL 形式的內部路徑遮罩。目前 `server.mjs:161-198` 已將 `error`、`message`、`detail`、`reason`、`stderr`、`stdout` 與 `logs` 納入遞迴 `sanitizeApiErrorPayload()`；`server.mjs:161` 的 pattern 也納入 `file:///` 形式，故 `server.mjs:1557-1562`、`3183-3192`、`3450-3454` 寫入任務狀態的底層訊息會在 `server.mjs:4302-4304` 回傳前經過集中邊界。
- 證據：`public/app.js:1289-1345` 保留 generation-aware、自適應退避、頁面隱藏時立即停止／可見時恢復輪詢；`public/app.js:2010-2016` 保留取消後非終態追蹤；`server.mjs:954-963` 在 `saveStatus()` 清除 `jobsListCache`；`public/review.js:1062-1074` 對動態時間碼與 attribute 值轉義。round2 指出的程式條件已關閉；最新工作紀錄仍需完成 final gate，列於第 6 節而非程式需求缺口。

## 2. 邏輯正確性

- 判定：通過
- 證據：`public/app.js:1297-1340` 在請求完成後才排程下一次輪詢，依狀態簽章與失敗退避，並以 generation／job ID 在 fetch、response 與 JSON 完成後阻擋舊任務晚到回應；`public/app.js:1305-1309` 於頁面隱藏時立即停止，`public/app.js:1342-1345` 於恢復可見時重新啟動；`public/app.js:2010-2016` 取消後以最新狀態決定停止或繼續。`server.mjs:954-963` 將快取失效放在狀態保存入口。
- 證據：`server.mjs:163-180` 對巢狀物件／陣列遞迴處理診斷欄位，`server.mjs:193-198` 在 production 對空值、超長值、內部路徑、權限／工具 marker 與 stack 位置使用 fallback；`scripts/test-report-optimizations.mjs:25-37` 新增並驗證 `message`／診斷欄位、logs、`file://` pattern 與 handler 不直接回傳 `error.message` 的契約。round2 的 production message／file URL 邊界條件已關閉。

## 3. 邊界情況

- 判定：部分通過
- 證據：2026-09-29T21:08:41+08:00 至 21:08:42+08:00 執行 `node scripts/test-report-optimizations.mjs` 與 `git diff --check`，均 exit 0；focused test 於 `NODE_ENV=production` 啟動隔離 server，送出無效影片至 `/api/video/probe`，並以含 `ffprobe`、Unix 路徑與 `file:///` 的巢狀 status／logs fixture 驗證固定錯誤及保留正常 log，測試清理由 `scripts/test-report-optimizations.mjs:69-100` 的 finally 完成。
- 證據：2026-09-29T21:09:02+08:00 的 runtime harness 驗證非重疊輪詢、generation guard、queued／cancelled 終態、可見度恢復與晚到 `loadJobStatus` 回應；21:09:20 至 21:09:21 的 runtime checks 驗證狀態快取失效與 review 動態值 HTML escaping。
- 證據：source-contract 現已覆蓋 `document.hidden`、`visibilitychange`、generation、非重疊 timer、錯誤欄位、logs 與 file URL；但仍未在真實瀏覽器中建立重疊 `startPolling()`、延遲 fetch／JSON 回應、頁面隱藏切換或取消後暫時非終態的 timer 情境，也未用每一種 API error 欄位做完整 production 負向矩陣。這些是測試覆蓋限制，不是目前已觀察到的程式錯誤。

## 4. 程式碼品質

- 判定：通過
- 證據：`public/app.js:1289-1340` 將輪詢停止、generation、退避、排程與終態控制集中；`server.mjs:163-186` 將 JSON 安全化集中於 `sendJson()`；`server.mjs:954-963` 集中快取失效；`public/review.js:1062-1074` 只補動態 HTML 值轉義而保留既有編輯事件結構。round3 修改仍未擴大成資料格式、WebSocket／SSE 或無關大型重構。
- 證據：2026-09-29T21:10:25+08:00 執行 `git diff --check` exit 0；`scripts/test-report-optimizations.mjs:25-37` 對本輪安全邊界修正有直接、可讀的契約斷言；目前工作樹中除本報告外未由本審查代理修改任何檔案。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-09-29T21:09:46+08:00 至 21:09:59+08:00 執行 `node scripts/test-core.mjs` exit 0；2026-09-29T21:10:02+08:00 至 21:10:19+08:00 執行 `npm run check` exit 0，19 個治理文件、所有 syntax checks、`npm test` 及核心回歸均通過，輸出包含「報告參考優化測試通過」、「校閱 UI 測試通過」與「核心回歸測試通過」；21:10:25 執行 `git diff --check` exit 0。`package.json:28-29` 確認 focused test 已納入完整檢查。
- 證據：測試仍未涵蓋 packaged Electron UI、真實瀏覽器 timer／DOM 執行、Windows／Linux 實機、乾淨安裝或跨平台 production error matrix；因此本輪不能把 source-contract 與隔離 server 負向測試解讀為 Electron／跨平台驗收。

## 6. 實際運行結果

- 判定：部分通過
- 證據：focused test 實際啟動 production server，完成含內部路徑的巢狀 status／logs fixture、invalid-video API probe 與暫存清理；21:09:46 的核心回歸與 21:10:02 至 21:10:19 的 `npm run check` 均 exit 0；`git diff --check` exit 0。round2 的 production message／file URL 安全條件已由目前 source、測試契約及 focused production probe 支持關閉。
- 證據：`npm run docs:check:final` 於 2026-09-29T21:10:25+08:00 exit 1，輸出為最新工作紀錄缺少可解析的審查檔案與逐字引用；主要代理仍需以治理驗證器接受的 `審查檔案：` 標籤同步 round3 連結與完整引用後重跑 final gate。未執行 packaged Electron、真實瀏覽器人工操作或跨平台實機。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：round2 所列 production 任務狀態 `message`、診斷欄位與 `file:///` 內部路徑安全邊界已關閉；目前唯一結案阻擋為 `npm run docs:check:final` 尚未通過，主要代理需將最新工作紀錄標示為完成，並以治理驗證器接受的 `審查檔案：` 標籤加入本 round3 報告連結與完整逐字引用後重跑 final gate。不得以本報告取代治理文件的結案欄位。
- 可逐字引用的完整結論句：**本輪獨立複審結論為有條件通過；程式與測試條件已關閉，但治理 final gate 仍待主要代理同步可解析的 round3 審查檔案與逐字引用。**
- 剩餘風險：未驗證真實瀏覽器中的 timer 重入／晚到回應、頁面可見度切換與 DOM 執行結果；未覆蓋 Electron packaged UI、Windows／Linux／乾淨安裝與跨平台實機。這些風險已在工作紀錄驗證計畫中揭露，本輪不宣稱已完成 Electron 或跨平台驗收。
- 給主要開發代理的具體修正要求（若有）：保留 round1、round2 與本 round3 原件；同步本報告結論至 `08-CHANGE-LOG.md`、完成最新工作紀錄並重跑 `npm run docs:check:final`。若再修改程式或測試，應建立下一輪獨立複審，不覆寫既有報告。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
