# 獨立審查報告：報告參考優化：任務狀態輪詢、快取與安全錯誤處理

- 審查對象 commit／版本：working tree、版本 0.51.0、branch `codex/0.51-anthropic-claude`；本輪未提交 commit。
- 對應 08-CHANGE-LOG 條目：2026-09-29 — 報告參考優化：任務狀態輪詢、快取與安全錯誤處理
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-09-29；本報告由獨立審查上下文建立，未以主要代理先前的測試敘述作為證據。關鍵指令均於本報告第 5、6 節列出實際時間戳與結果。

## 1. 需求完整性

- 判定：不通過
- 證據：工作紀錄 `docs/project-management/08-CHANGE-LOG.md:12-20` 要求 production API 不回傳內部 stack／路徑、遞迴且不重疊輪詢、頁面 hidden／visibility 處理、取消後非終態追蹤、狀態保存使 `jobsListCache` 失效，以及校閱動態值轉義。`public/app.js:1289-1344` 已有 generation-aware `setTimeout`、`document.hidden` 與可見度重啟；`public/app.js:1831-1853` 已對任務載入的晚到回應檢查 generation／job ID；`server.mjs:950-960` 已將快取失效集中至 `saveStatus()`；`public/review.js:1062-1074` 已轉義時間碼與數值 attribute。
- 證據：production 錯誤安全邊界只在 `sendJson()` 對頂層 `value.error` 做處理（`server.mjs:163-166`）。任務狀態 endpoint 直接回傳 `job.status`（`server.mjs:4289-4291`），任務列表把 `job.status.message` 原樣放入 payload（`server.mjs:914-920`）；而 `runJob()`、修剪與輸出失敗流程仍會把 `error.message` 寫入持久化狀態（`server.mjs:1541-1560`、`server.mjs:3163-3188`、`server.mjs:3425-3442`）。以 production server、暫存最小 job-status fixture，實際呼叫 `GET /api/jobs/leak-test/status`，回應的 `message` 含 `ENOENT ... '/Users/secret/project/input/video.mp4'`；因此本輪「production API 不回傳內部路徑」成功條件尚未完整閉合。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：`public/app.js:1289-1337` 在每次 response／JSON 完成後檢查 generation 與任務 ID，只有上一輪完成後才排程下一次；狀態變更回到 1 秒、無變更或失敗退避至上限 10 秒，終態包含 `completed`、`failed`、`cancelled`、`needs-action`。`public/app.js:1832-1849` 也會在任務載入的 fetch 前後及 catch 檢查 request generation／current job，避免任務切換後套用晚到回應。
- 證據：在不修改專案檔案的 inline runtime harness 中，實際重播了兩次 `startPolling()`、晚到舊 generation response、hidden 後排程、visibility 恢復、`queued` 到 `cancelled` 終態；結果為「no overlap、generation guard、hidden visibility、queued/cancelled terminal」全部通過。另以 `loadJobStatus()` harness 將 current job 從 old 切換至 new 並讓 old response 晚到，結果為舊狀態未套用。
- 證據：production nested status leak 使集中錯誤邊界的邏輯仍不完整：`sendJson()` 只辨識頂層 `error`，不會遞迴／投影 `status.message`、`status.logs` 或巢狀模型狀態中的錯誤。這不是單純缺少測試，而是可達的對外資料流仍會傳出由 `error.message` 形成的內部路徑。

## 3. 邊界情況

- 判定：部分通過
- 證據：2026-09-29T16:30:17+08:00 執行 `node scripts/test-report-optimizations.mjs` 通過；測試涵蓋輪詢 source contract、URL 編碼、generation、hidden 字串、快取失效 source contract、production 無效影片 probe，以及校閱時間碼／數值 attribute 的轉義 source contract。另於同一審查上下文實際執行 hidden／visibility、重複啟動、晚到回應、queued／cancelled runtime harness，均通過。
- 證據：2026-09-29T16:30:17+08:00 的 cache runtime check 先以 `GET /api/jobs` 建立快取，再以 `POST /api/jobs/cache-test/save-review` 觸發 `saveStatus()`，後續列表實際反映 `hasReviewed=true`；校閱 escape runtime check 以 `\"><img src=x onerror=alert(1)>&'` 驗證輸出為 HTML entity。
- 證據：仍未覆蓋「已有可見頁面 timer 排程後才切換為 hidden」的實際 timer 重排；目前 `public/app.js:1305-1309` 只在排程當下讀取 `document.hidden`，`public/app.js:1342-1344` 只對恢復可見重啟，隱藏瞬間不會主動清除／重排既有 timer。另未有專門 regression test 對任務狀態／logs 中的 path、`ENOENT`、stack 做 production API 負向驗證。

## 4. 程式碼品質

- 判定：部分通過
- 證據：輪詢控制流集中於 `public/app.js:1289-1344`，`stopPolling()`、generation、完成後排程與終態停止的責任清楚；`saveStatus()`（`server.mjs:950-960`）集中處理狀態寫入與列表快取失效；`public/review.js:1062-1074` 的動態 HTML 欄位使用既有 `escapeHtml()`。本輪沒有改資料格式、SSE／WebSocket 或無關大型重構。
- 證據：安全錯誤的設計意圖雖集中於 `getSafeApiErrorMessage()`／`sendJson()`（`server.mjs:161-185`），但實際邊界以「頂層 error 字串」為單位，與工作紀錄宣稱的所有 production JSON error payload／任務錯誤狀態不一致；錯誤訊息仍在 `runJob()` 等流程先寫入持久化狀態，再由 status/list endpoint 原樣輸出。需改為明確的 public status projection 或等效的結構化遮罩，而非只增加 regex。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-09-29T16:30:17+08:00 的 `node scripts/test-report-optimizations.mjs` exit 0；同一時間 `git diff --check` exit 0。此前一次未帶時間戳的 `npm run check` 在本審查上下文曾 exit 0，輸出含治理、syntax、完整 `npm test`、報告參考優化測試、校閱 UI 與核心回歸通過。
- 證據：2026-09-29T16:30:21+08:00 執行的 `npm run check` 於 16:45:44 exit 1，`scripts/test-core.mjs` 等待 `whisper-python-child-started` 逾時；重試 `node scripts/test-core.mjs`（2026-09-29T16:46:02–16:46:15）exit 0；再次執行 `npm run check`（2026-09-29T16:46:21–17:02:17）仍 exit 1，這次為任務未進入預期 `transcribing` 階段。故本輪沒有穩定的最新完整 check 通過證據，且核心整合測試呈現間歇性失敗，須先釐清環境／測試競態再結案。
- 證據：現有 `scripts/test-report-optimizations.mjs:14-37` 對安全邊界主要做 source contract 與單一 `/api/video/probe` production 負向測試，沒有測試 `/api/jobs`、`/api/jobs/:id/status` 對巢狀 `status.message`／logs 的 production 輸出；因此沒有防止本輪實際重現的 leak。

## 6. 實際運行結果

- 判定：不通過
- 證據：production invalid-video probe 的 focused test 實際回傳固定安全訊息；polling runtime harness 實際驗證不重疊、generation、hidden／visibility 及 queued／cancelled；cache runtime check 實際驗證狀態保存後列表刷新；review escape runtime check 實際驗證 hostile value 轉義。這些結果支持本輪多數正向修正。
- 證據：同一 production server 驗收中，以暫存 job config／status 建立 `status.message` 為含 `ENOENT` 與 `/Users/secret/project/input/video.mp4` 的失敗任務，`GET /api/jobs/leak-test/status` 實際 HTTP 200 JSON 回傳該內部路徑；這直接違反本輪 production API 安全成功條件。另 `npm run docs:check:final` 於本輪早期執行時 exit 1，原因為最新工作紀錄仍為「進行中」且尚無可解析 round2 審查報告；本報告建立後仍需由主要代理處理程式阻擋、同步工作紀錄並重跑 final gate。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪獨立複審結論為不通過：直接 API catch 的 production 錯誤遮罩、generation-aware 輪詢、queued／取消終態、任務列表快取失效與校閱動態值轉義已有可追溯通過證據，但 `/api/jobs/:id/status` 與任務列表仍可透過巢狀 `status.message`／logs 回傳由 `error.message` 形成的內部路徑，且本輪最新完整 `npm run check` 出現兩次核心整合逾時／階段等待失敗，故尚不能宣稱本工作項目完成；需修正 production 狀態輸出、補回歸測試並取得穩定完整回歸與 final gate 證據。**
- 阻擋問題（若有）：
  1. 修正 production public status／job list 輸出：不能只遮罩頂層 `error`；必須讓 `status.message`、`status.logs`、AI／模型狀態中的錯誤欄位不含內部路徑、`ENOENT`／權限／工具細節／stack，並保留伺服器端診斷。至少需以 production fixture 實測 `/api/jobs` 與 `/api/jobs/:id/status`。
  2. 新增上述巢狀錯誤輸出的 regression test，並涵蓋任務失敗、修剪／輸出失敗或等效可達狀態；不得只增加 source-contract assertion。
  3. 釐清並重跑 `npm run check` 的核心整合間歇性失敗；在同一可追溯環境取得完整 exit 0，或修正已重現的測試／程序競態後再宣稱回歸通過。
  4. 主要代理須在阻擋修正後同步本報告路徑與上述完整結論句至 `08-CHANGE-LOG.md`，更新狀態與遺留風險，並重新執行 `npm run docs:check:final`；不得覆寫 round1 或本 round2 報告。
- 剩餘風險：頁面在既有 timer 排程後轉為 hidden 的立即重排尚未由測試證明；未做真實瀏覽器／Electron packaged UI、跨平台實機、乾淨安裝或發布驗收；`sendJson()` 的 regex 型錯誤辨識仍可能漏掉未列入 pattern 的敏感外部錯誤訊息，應以結構化 public payload 與負向測試持續約束。上述不擴大本輪產品範圍，但在結案時必須如實揭露。
- 給主要開發代理的具體修正要求：先完成阻擋問題 1–3，重跑受影響 focused／核心／完整測試；若程式或測試差異改變本報告結論，保留本 round2 原件並建立下一輪獨立複審報告。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
