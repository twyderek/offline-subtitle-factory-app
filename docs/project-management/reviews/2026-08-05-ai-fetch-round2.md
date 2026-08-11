# 獨立複審報告：AI 優化前端 `Failed to fetch`（BUG-020）

- 審查對象 commit／版本：工作樹目前 0.48.0 測試版（round1 修正後；未指定 commit）
- 對應 08-CHANGE-LOG 條目：2026-08-05 — AI 優化前端 `Failed to fetch` 調查（BUG-020）
- 審查輪次：round2（承接 `docs/project-management/reviews/2026-08-05-ai-fetch-round1.md`）
- 審查代理啟動時間、上下文來源：2026-08-05 14:04（Asia/Taipei）；由同一獨立審查角色依 `docs/project-management/workflows/04-INDEPENDENT-REVIEW.md` 複查 round1 指出的狀態機問題、最新 source、測試輸出及封裝證據，未修改 round1。

## 1. 需求完整性

- 判定：通過
- 證據：`public/ai-fetch.mjs:1-22` 保留本機 API network error／非 JSON response 正規化；`public/ai-status-recovery.mjs:1-12` 抽出共用 retry helper；`public/review.js:581-589,671-701` 讓輪詢與 POST response lost 補查共用同一個狀態 GET retry；`public/review.js:618-630` 僅送出一次啟動 POST。round1 指出的補查空 catch 與 terminal status 未停止 polling 已處理。

## 2. 邏輯正確性

- 判定：通過
- 證據：`requestAiApi` 在 `public/review.js:564-578` 將 fetch 失聯及 `response.json()` 失敗分別轉為診斷錯誤；`requestAiStatusWithRetry`（`public/review.js:581-590`）以 `fetchAiStatusWithRetry` 限制初次加兩次 retry。`restoreAiOptimizationStatus`（`public/review.js:671-701`）改用該共用 helper，`running` 才接回 polling，`completed`／`failed`／`interrupted`／`cancelled` 先於結果處理呼叫 `setAiRunning(false)`。`runAiOptimize` 的 network catch 只呼叫 GET 補查（`public/review.js:631-641`），未再次送出 POST，因此不會因 response lost 建立重複 AI 任務。

## 3. 邊界情況

- 判定：通過
- 證據：`scripts/test-ai-fetch.mjs:18-23` 實測 `running`、`completed`、`failed` 狀態均不重試；`scripts/test-ai-fetch.mjs:24-45` 實測 GET network failure 與 GET non-JSON 各為初次加兩次 retry，`onRetry` 次序為 `[1, 2]`，最終仍保留可診斷錯誤。`public/review.js:697` 對既有任務 404 保持無任務可恢復的相容行為；其他補查錯誤不再空吞，依 `silent` 選項保留 POST catch 的統一錯誤呈現或初始校閱頁的狀態訊息。

## 4. 程式碼品質

- 判定：通過
- 證據：重試策略集中於 `public/ai-status-recovery.mjs`，UI 只提供 request、上限與進度 callback；`public/ai-fetch.mjs` 維持純錯誤分類。`public/review.js` 的 POST／GET 邊界責任清楚，沒有自動 POST resend；round1 指出的空 catch 已改為明確分支與回傳結果。最新 `node --check public/review.js`／module syntax checks 由完整回歸通過。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-08-05 14:04 執行 `node scripts/test-ai-fetch.mjs` 與 `node scripts/test-review-ui.mjs` 均通過；同輪受控權限 `npm run check` 通過，輸出包含 docs、語法、AI fetch、AI optimizer、provider、Ollama streaming、review UI 與 core 回歸。focused fetch 測試已覆蓋五種 helper 序列（running、completed、failed、network failure、non-JSON failure），但仍是純 helper／靜態 UI contract，沒有真正 renderer DOM 中的 POST response lost 後 running／completed／failed 五條端到端序列。

## 6. 實際運行結果

- 判定：部分通過
- 證據：最新兩平台測試包均可解壓且封裝來源一致：
  - macOS arm64 `../dist/test-0.48-whisper-macos-arm64/offline-subtitle-factory-test-0.48.0-macos-arm64.zip`，建置時間 2026-08-05 13:55:46 +0800，`unzip -t` 通過，SHA-256 `ebac55d1fc7d40de54e7c113d7da4eec531c4099c52ed0be727f2d4c57da9bb0`。
  - Windows x64 `../dist/test-0.48-whisper-windows-x64/offline-subtitle-factory-test-0.48.0-windows-x64.zip`，建置時間 2026-08-05 13:56:14 +0800，`unzip -t` 通過，SHA-256 `2ec03b3de2a541e4d3272a4563cdca9d2f00f25b7fa6738954e5db0ee7c9c998`。
  - 工作樹與兩包封裝內 `public/ai-fetch.mjs` SHA-256 均為 `0b88c2c8e4db0df7854991821d61151a642308e68c7f35218eadfa52bc230458`；`public/ai-status-recovery.mjs` 均為 `58ac9ff13c334c271de2005173eec540d4a764e772d20fe27e00d2e5d701dc74`；`public/review.js` 均為 `dd915eb8edab8ae60de29e30c956d54d5955653dd3f9afec7c5bafa8cdd86be0`。兩包 `tools/manifest.json` 的 Small 均為 size `487601967`、SHA-256 `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b`。
  - 目前沒有本次實際 renderer console／server log；本機 Ollama `127.0.0.1:11434` 未啟動，Windows 實機亦未啟動 renderer，故封裝證據不等同跨平台實機或真實 provider smoke。

## 綜合判定

- 結論：有條件通過
- 可逐字引用完整結論句：**本輪 BUG-020 round2 已修正 round1 指出的 POST response lost 補查空 catch 與 terminal polling 狀態，輪詢／補查共用最多兩次 GET retry 且不重送 POST；focused 與受控完整回歸、最新 macOS／Windows ZIP 完整性、三個前端 source SHA 與 Small manifest 均核對通過，但仍缺真正 renderer 斷線序列、Windows 實機與真實 Ollama smoke，因此結論為有條件通過，不得宣稱正式跨平台 Release 完成。**
- 阻擋問題（若有）：無新的程式碼阻擋；round1 的補查狀態機阻擋已解除。若要移除本輪條件，仍須完成 renderer 斷線／response lost 操作驗收及 Windows 實機、真實 Ollama smoke。
- 剩餘風險：`restoreAiOptimizationStatus` 在 recovered `running` 狀態啟動的背景 polling 若後續再次耗盡 retry，目前只透過 callback status message 呈現，未有獨立 renderer 測試證明按鈕／狀態復原；本輪未宣稱此序列已實機通過。真實 Ollama、Windows、乾淨安裝與原始 BUG-020 log 仍待外部驗收。
- 給主要開發代理的具體修正要求（若有）：無需阻擋本輪結案；外部驗收時記錄 renderer console／server log，覆蓋 POST response lost 後 server running／completed／failed、GET 失聯重試耗盡與重啟後 checkpoint 恢復；若背景 polling retry 耗盡仍使 UI 卡住，另建後續 round3，不覆寫本報告。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
