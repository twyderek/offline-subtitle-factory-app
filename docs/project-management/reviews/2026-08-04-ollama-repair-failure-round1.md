# 2026-08-04 Ollama repair failure boundary round1 獨立審查

## 1. 需求完整性

- 判定：通過
- 證據：本輪只在 `scripts/test-ai-optimizer.mjs` 增加 Ollama translation repair failure boundary cases，明確覆蓋 second-attempt short translation、malformed JSON 與 exactly-once repair；沒有修改 production provider／optimizer，符合任務範圍。

## 2. 邏輯正確性

- 判定：通過
- 證據：過短首答先觸發 provider-scoped repair；若第二次仍回傳 `E3`，測試要求 promise 以 `翻譯內容過短` reject 並斷言 `failedRepairCalls === 2`。若第二次回傳 `not-json`，測試要求以 `不是有效 JSON` reject 並斷言 `malformedRepairCalls === 2`，證明 repair 不是無限重試、靜默接受或回退原文。

## 3. 邊界情況

- 判定：通過
- 證據：新增三條 deterministic 序列分別覆蓋成功 repair、repair 後仍過短、repair 後 malformed JSON；每條都明確固定 Ollama provider、cue ID 與英文輸出。既有 optimizer cases 仍涵蓋語系不一致、模型解說文字、cue 數量／順序錯誤與 malformed primary response。

## 4. 程式碼品質

- 判定：通過
- 證據：工作樹顯示本輪差異只在 `scripts/test-ai-optimizer.mjs`；`lib/ai/providers.mjs` 與 `lib/ai/subtitle-optimizer.mjs` 沒有本輪修改。測試使用計數器與固定 response，不依賴模型或網路，assertions 直接檢查錯誤語意與呼叫次數。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：`node scripts/test-ai-optimizer.mjs`、`node scripts/test-project-docs-validator.mjs` 與 `git diff --check` 通過；focused optimizer 已驗證成功／失敗 repair 邊界。完整 `npm run check` 本輪受 sandbox `listen EPERM` 阻塞於 core server，故尚未取得全套回歸證據。

## 6. 實際運行結果

- 判定：部分通過
- 證據：focused optimizer 實際執行成功 repair（兩次呼叫後產出完整英文）、second-attempt short reject（兩次後拒絕）與 malformed repair reject（兩次後拒絕）；沒有 production fallback 或無限 retry。完整 core run 因 sandbox 無法監聽 `0.0.0.0` 埠而中止，未將 focused 結果誇大為完整產品驗收。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無本輪 production code 阻擋；完整 `npm run check` 的 core 階段受 sandbox `listen EPERM` 阻塞。
- 剩餘風險：本輪僅 deterministic Ollama repair failure；LM Studio mirror、Windows／真實 Ollama request-response、斷網與模型品質仍未由測試證明。
- 給主要開發代理的具體修正要求：保留 production strict cue／語言 validation 與 exactly-once repair；在可監聽環境重跑完整 `npm run check`，再補 LM Studio mirror（若納入範圍）及外部 Ollama／Windows evidence。
- 可逐字引用完整結論句：**本輪 Ollama repair failure boundary tests 結論為有條件通過：deterministic optimizer cases 已確認首答過短後只 repair 一次，第二次仍過短或回傳 malformed JSON 都會拒絕且不回退原文，production provider／optimizer 未被修改；但完整 `npm run check` 的 core 階段受 sandbox `listen EPERM` 阻塞，LM Studio／Windows／真實 Ollama 與斷網 evidence 仍待補齊，不得以 focused tests 取代完整外部驗收。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前已確認目標路徑不存在，未覆寫既有審查報告。
- 若上述聲明不實，本報告無效。
