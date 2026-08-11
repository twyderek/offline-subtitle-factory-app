# 2026-08-04 Ollama contract／repair deterministic tests round1 獨立審查

## 1. 需求完整性

- 判定：通過
- 證據：本輪條目限定修改 `scripts/test-ai-providers.mjs` 與 `scripts/test-ai-optimizer.mjs`，目標是覆蓋 native translate request body 與 provider-scoped translation repair；不放寬 production validator、不取代 Ollama 實測、不處理 LM Studio 實機，測試範圍與需求一致。

## 2. 邏輯正確性

- 判定：通過
- 證據：`test-ai-providers.mjs` 對 Ollama native translate request 斷言 `format === 'json'`、`think === false`，並確認 system prompt 包含 professional subtitle translator 與目標語言 `en`；`test-ai-optimizer.mjs` 以 Ollama config 首次回傳過短 `E3`、第二次回傳完整英文，斷言恰好兩次呼叫、repair prompt／cue ID 與最終建議。

## 3. 邊界情況

- 判定：部分通過
- 證據：repair 測試驗證首次翻譯內容過短會進入一次 repair，並保留原始 cue ID；同一 optimizer 測試仍覆蓋非 Ollama config 的過短翻譯拒絕、日文語系不一致拒絕、模型說明清理、cue 數量與順序錯誤。尚未新增 LM Studio-specific repair、repair 後仍失敗、重複 ID 或 malformed JSON 的專屬 deterministic 案例，但既有 strict validator 仍處理這些錯誤。

## 4. 程式碼品質

- 判定：通過
- 證據：本輪 diff 僅增加測試 assertions 與 deterministic mock callback，沒有修改 `lib/ai/providers.mjs` 或 `lib/ai/subtitle-optimizer.mjs`；測試檢查必要 contract 欄位、repair 次數與結果，而非依賴真實模型的非確定文字。focused AI provider／optimizer 測試均輸出通過。

## 5. 測試覆蓋

- 判定：通過
- 證據：`node scripts/test-ai-providers.mjs` 與 `node scripts/test-ai-optimizer.mjs` 均通過；完整 `npm run check` 本輪亦已通過，包含文件、語法、既有 AI／UI／core 回歸。新增 assertions 覆蓋 native format／think／prompt、一次 repair、repair body cue ID 與 strict output，並保留既有短翻譯／語系 rejection。

## 6. 實際運行結果

- 判定：通過
- 證據：mock provider 實際捕捉並解析 JSON request body，確認 Ollama native translate 的 `format`、`think` 與 prompt；mock optimizer 實際執行失敗→repair→成功序列，確認只 repair 一次且產生完整翻譯建議。完整 `npm run check` 已通過；這些是 deterministic／contract 證據，不等同 Windows 實機或真實 Ollama 模型品質驗收。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無本輪測試程式碼阻擋；真實 Ollama／Windows request-response、斷網與模型品質仍不由 deterministic tests 證明。
- 剩餘風險：LM Studio repair 尚無專項案例，repair 後再次失敗與 malformed response 未新增獨立測試；外部實機與模型品質仍需 evidence。
- 給主要開發代理的具體修正要求：保留目前 strict cue／語言 validation；後續可補 LM Studio mirror、repair failure 與 malformed JSON cases，並在 Windows／可連線 Ollama 環境保存 request／response、repair 次數與輸出語言 evidence。
- 可逐字引用完整結論句：**本輪 Ollama contract／repair deterministic tests 結論為有條件通過：provider 測試已斷言 native translate 的 JSON format、think:false 與專用 prompt，optimizer 測試已 deterministic 驗證過短翻譯只觸發一次 Ollama repair 並保留 cue ID，且既有 strict cue／語言拒絕仍通過；完整 `npm run check` 已通過，但 LM Studio mirror、repair 後失敗／malformed response 與真實 Ollama／Windows／斷網模型品質證據仍待補齊，不得以本輪測試取代外部驗收。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前已確認目標路徑不存在，未覆寫既有審查報告。
- 若上述聲明不實，本報告無效。
