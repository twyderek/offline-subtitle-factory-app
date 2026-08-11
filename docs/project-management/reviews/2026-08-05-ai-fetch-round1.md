# 獨立審查報告：AI 優化前端 `Failed to fetch`（BUG-020）

- 審查對象 commit／版本：工作樹目前 0.48.0 測試版（BUG-020 修正後；未指定 commit）
- 對應 08-CHANGE-LOG 條目：2026-08-05 — AI 優化前端 `Failed to fetch` 調查（BUG-020）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-05 13:48（Asia/Taipei）；由獨立審查上下文依 `docs/project-management/workflows/04-INDEPENDENT-REVIEW.md` 讀取工作紀錄、程式碼、測試及封裝證據，未沿用開發代理對話記憶。

## 1. 需求完整性

- 判定：通過
- 證據：`public/ai-fetch.mjs:1-22` 具備本機 API network error／非 JSON response 的分類與可採取行動訊息；`public/review.js:563-592` 將 AI API fetch 例外正規化並只對 AI 狀態 GET 最多重試兩次；`public/review.js:607-643,671-697` 對啟動 POST 回應遺失查詢既有任務狀態，未自動重送 POST。BUG-020 工作紀錄 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:187-196` 的需求、範圍與剩餘風險與上述實作相符。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：`requestAiApi` 先捕捉 network failure、再捕捉 `response.json()` 失敗（`public/review.js:563-577`），HTTP／API `ok` 失敗不被誤判為 network error；`requestAiStatusWithRetry` 的三次總嘗試（初次＋兩次 retry）位於 `public/review.js:580-592`。但啟動 POST 的補查走 `restoreAiOptimizationStatus` 原生 `fetch`（`public/review.js:671-697`），該路徑以空 `catch {}` 吞掉失聯／非 JSON，且對 `completed`／`failed`／`interrupted`／`cancelled` 僅更新結果或進度、未呼叫 `setAiRunning(false)`；`runAiOptimize` 隨後會因 `state.aiPolling` 仍為 `true`（`public/review.js:634-640`）提前返回。若 POST 已送達但補查回傳終態或補查本身失聯，UI 可能卡在執行中且不顯示正規化診斷訊息。

## 3. 邊界情況

- 判定：部分通過
- 證據：`node scripts/test-ai-fetch.mjs`（2026-08-05 13:48）實測 `Failed to fetch`、HTTP provider error 不誤判、非 JSON 錯誤分類及 retryable marker；`public/ai-fetch.mjs:4` 也涵蓋 `NetworkError`、`Load failed`、`fetch failed`、`ECONNREFUSED`、`ERR_CONNECTION_REFUSED`。`public/review.js:587-590` 明確上限為兩次重試且未重送 POST。尚缺瀏覽器層對「POST response lost＋server running／completed／failed／GET 也失聯／GET 非 JSON」序列的 deterministic 測試；其中補查 terminal／補查失聯的狀態機缺陷如第 2 節所述。

## 4. 程式碼品質

- 判定：通過
- 證據：錯誤分類集中於 `public/ai-fetch.mjs`，`public/review.js` 透過 `requestAiApi`／`requestAiStatusWithRetry` 使用，訊息不包含 secrets 且提供 API 位址、重載／重啟及 checkpoint 恢復指引（`public/ai-fetch.mjs:7-21`）。`node --check public/review.js`、`node --check public/ai-fetch.mjs` 均由完整檢查通過；`git diff --check` 無空白錯誤。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：`node scripts/test-ai-fetch.mjs` 與 `node scripts/test-review-ui.mjs` 均於 2026-08-05 13:48 通過；`npm run check`（含 `docs:check`、語法檢查、`npm test` 全套，輸出含 AI fetch、AI optimizer、provider、Ollama streaming、review UI、core tests）於同一輪通過。測試目前只直接驗證純函式／靜態 UI contract，未執行真實 renderer 的 fetch 斷線、回應中斷或重啟後恢復，也未覆蓋第 2 節的補查終態／補查失聯狀態機。

## 6. 實際運行結果

- 判定：部分通過
- 證據：最新測試包完整性實測通過：
  - macOS arm64 ZIP `../dist/test-0.48-whisper-macos-arm64/offline-subtitle-factory-test-0.48.0-macos-arm64.zip`（建置時間 2026-08-05 13:44:58 +0800），`unzip -t` 通過，SHA-256 `2ecba9c8d5fb1c77c835e74a47439bbc48e16ff4771ffa6a70289afd39207d8a`。
  - Windows x64 ZIP `../dist/test-0.48-whisper-windows-x64/offline-subtitle-factory-test-0.48.0-windows-x64.zip`（建置時間 2026-08-05 13:45:27 +0800），`unzip -t` 通過，SHA-256 `b33daf334099c5c87d9de0f6d2c3b93cf58977702af9dcd202291c4c989a722d`。
  - 兩包封裝內 `public/ai-fetch.mjs` SHA-256 均為 `0b88c2c8e4db0df7854991821d61151a642308e68c7f35218eadfa52bc230458`，`public/review.js` 均為 `5fa767944a40c1db7ddb5edc5dfedfd26c20918c0e3b7e1e900eb9ce79341afd`，與工作樹完全相同；兩包 `tools/manifest.json` 的 Small 欄位均為 size `487601967`、SHA-256 `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b`。
  - 基準 job `20260805024615-2af944` 目前已為 Ollama `llama3.2:3b`、55/55 completed、`nextBatchIndex=55`、33 suggestions；本機 `curl --max-time 2 http://127.0.0.1:11434/api/tags` 連線拒絕。未取得本次原始 renderer console／server log，也未在 Windows 實機啟動 renderer，因此不能宣稱真實 `Failed to fetch` 序列或跨平台操作已驗收。

## 綜合判定

- 結論：有條件通過
- 可逐字引用完整結論句：**本輪 BUG-020 的錯誤正規化、AI 狀態 GET 最多兩次重試、兩平台封裝／ZIP 完整性與來源 SHA 均有證據，focused 與完整回歸通過；但 POST response lost 補查仍可能在補查失聯或已完成／失敗終態時讓 UI 保持 polling，且尚無 renderer 斷線與 Windows 實機驗收，因此結論為有條件通過，完成補查狀態機修正與外部驗收前不得宣稱無條件通過或正式跨平台 Release。**
- 阻擋問題（若有）：若要宣稱 BUG-020 的所有恢復序列已完成，需先修正 `restoreAiOptimizationStatus` 的空 catch 與終態未停止 polling（`public/review.js:671-697`），並增加 POST response lost 的狀態機 deterministic 測試；目前此項屬修正後才能解除的邏輯條件。
- 剩餘風險：沒有實際 renderer／server 斷線證據，無法判定原始觸發原因；本機 Ollama 未啟動；Windows 實機、乾淨安裝與真實多批次 smoke 未驗證。即使補查修正，server 已停止時仍只能依訊息重啟並以 checkpoint 恢復。
- 給主要開發代理的具體修正要求（若有）：將 POST response lost 的補查改用共用 `requestAiApi`／最多兩次狀態重試或等價錯誤正規化；補查取得 terminal status 或失敗後明確 `setAiRunning(false)`，保留可恢復按鈕與診斷訊息；以 mock fetch 覆蓋 running、completed、failed、GET network failure、GET non-JSON 五條序列後再進行 round2。完成前不得把本輪結論改寫為無條件通過或宣稱正式跨平台 Release。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
