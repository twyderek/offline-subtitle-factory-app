# 2026-08-03 GitHub Ollama 翻譯同步 round1 獨立審查

## 1. 需求完整性

- 判定：通過
- 證據：commit `4d0bee6` 同時修改 `lib/ai/providers.mjs` 與 `lib/ai/subtitle-optimizer.mjs`，涵蓋 Windows Ollama native translate prompt／JSON format／think 開關，以及字幕翻譯驗證失敗後的 repair flow；未擴張到非翻譯模式。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：native Ollama translate 會注入完整翻譯指令、`format: 'json'`、`think: false`，並保留原始 messages；optimizer 以 `operation`、`output_language` 建立翻譯契約，驗證失敗時只對 ollama／lm-studio 觸發一次 repair。風險是 repair 後再次驗證若仍失敗會直接拋錯，且 `canRepairTranslationValidation` 以錯誤訊息文字分類，對未來錯誤訊息改名較脆弱。

## 3. 邊界情況

- 判定：部分通過
- 證據：`validateBatch` 仍檢查 cue ID／順序、翻譯長度、模型說明文字與輸出語言；repair prompt 要求保留每個 ID 並依原順序輸出。未見本 commit 新增針對空 cues、重複 ID、repair 回傳缺 cue 或跨語言短文本的專門回歸案例，需依既有驗證器承擔這些邊界。

## 4. 程式碼品質

- 判定：部分通過
- 證據：新增 helper 將 native prompt 與 repair body 分離，變更範圍集中且未改動公共輸出格式；但 `optimizeOllamaNative` 將 translate 的 `format` 從 schema 改成字串 `json`，同一 provider 的兩種契約分支並存，應補註 Ollama API 相容性原因與測試覆蓋。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：`npm test` 中 fallback policy、project docs、AI optimizer、AI provider contract 等前置測試均通過；然而完整測試在 `scripts/test-core.mjs` 啟動 server 時因 sandbox `listen EPERM 0.0.0.0:22224` 中止，未取得本 commit 在整體 core 流程的完整回歸證據。既有 optimizer/provider 測試輸出未單獨證明 repair retry 與 native translate request body。

## 6. 實際運行結果

- 判定：部分通過
- 證據：靜態 diff 顯示 Windows Ollama 路徑會使用 `/api/chat`、`format: 'json'` 與 `think: false`，翻譯驗證錯誤會重送 repair JSON；本機測試可執行至 core 前置階段，但受限於埠監聽權限未完成全套實際運行驗證，沒有宣稱 Windows Ollama 實機成功。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：尚無程式碼級阻擋；完整 core 回歸與 Windows Ollama 實機／斷網證據尚未取得。
- 剩餘風險：repair 分類依錯誤訊息字串、native `format` 分支相容性、缺少 repair 專項測試，以及 sandbox 埠權限導致完整測試未完成。
- 給主要開發代理的具體修正要求：補 deterministic repair／native request contract 測試，並在可監聽環境執行完整 `npm test` 與 Windows Ollama 翻譯 smoke，回填實際 request、輸出 cue 語言與證據路徑。
- 可逐字引用完整結論句：**本輪對 commit `4d0bee6` 的獨立審查結論為有條件通過：native Ollama 翻譯已加入專用 prompt、JSON format 與 think 關閉，字幕翻譯驗證失敗亦具備受限 provider 的 repair flow；但 repair／native contract 缺少 deterministic 專項回歸，完整 `npm test` 又因 sandbox 無法監聽 `0.0.0.0:22224` 中止，尚未取得 Windows Ollama 實機證據，補齊測試與 smoke evidence 後方可完整結案。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前已確認目標路徑不存在，未覆寫既有審查報告。
- 若上述聲明不實，本報告無效。
