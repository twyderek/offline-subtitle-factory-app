# 獨立審查報告：Anthropic 連線測試低成本化（DEV-028）

- 審查對象 commit／版本：工作樹 DEV-028 變更；0.51.0
- 對應 08-CHANGE-LOG 條目：2026-08-26 — Anthropic 連線測試低成本化（DEV-028）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-26；獨立上下文，僅依工作樹差異、治理文件與指令輸出審查

## 1. 需求完整性
- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md` DEV-028 明列連線測試只使用 `/v1/models`、不發送 `/v1/messages` 生成、模型不存在回報 `modelAvailable:false`；`lib/ai/anthropic.mjs:84-92` 實作 GET models、數量與可用性回傳；Release notes、功能設計及測試稽核同步描述該行為。

## 2. 邏輯正確性
- 判定：通過
- 證據：`lib/ai/anthropic.mjs:85-92` 以 `listAnthropicModels` 取得模型並以 ID 比對指定模型；`scripts/test-ai-providers.mjs:211-226` 驗證 URL、GET、無 body、認證標頭與 modelCount；`:255-260` 驗證缺少指定模型時 `modelAvailable:false`；同檔 `:230-252` 驗證優化仍 POST `/v1/messages` 且保留 `max_tokens`／system／欄位清理。

## 3. 邊界情況
- 判定：部分通過
- 證據：已實測模型存在與不存在、Base URL 含 `/v1/` 與不含 `/v1`、API key 不進 URL、空生成 body，以及優化路徑仍可用；但測試未涵蓋 `/v1/models` 回傳空清單、缺少或非陣列 `data`、模型 ID 非字串等情況。實作 `:90` 對空清單會在指定模型存在時回傳 `modelAvailable:true`，因此空清單代表未知時可能被誤判為可用。

## 4. 程式碼品質
- 判定：通過
- 證據：變更集中於 `lib/ai/anthropic.mjs` 的連線測試函式及對應 deterministic contract；沿用既有 `requestConfig`／`listAnthropicModels`，未重複傳輸邏輯；`git diff --check`（DEV-028 驗證紀錄）無格式錯誤，文件同步列出行為與限制。

## 5. 測試覆蓋
- 判定：部分通過
- 證據：2026-08-26 執行 `node scripts/test-ai-providers.mjs`，輸出「AI provider contract 與術語／Prompt 測試通過」；工作樹記錄的完整 `npm run check` 通過。於本審查重新執行 `npm run check` 時，所有前置測試通過至 `test-core` 前，但因沙箱禁止監聽 `0.0.0.0:22156` 而以 `Error: listen EPERM` 結束，故本輪無法獨立重現完整通過；亦缺少空模型清單測試。

## 6. 實際運行結果
- 判定：部分通過
- 證據：實際執行 `node scripts/test-ai-providers.mjs` 成功，涵蓋 GET `/v1/models` 連線與 POST `/v1/messages` 優化 mock；實際執行 `npm run check` 時 `test-core` 嘗試監聽 `0.0.0.0:22156` 遭沙箱 `EPERM`，並非功能斷言失敗。未使用真實 Anthropic API key，未驗證外部 endpoint、proxy、限流、計費或跨平台封裝。

## 綜合判定
- 結論：有條件通過
- 可逐字引用的完整結論句：**DEV-028 已以 deterministic 測試證明 Anthropic 連線測試改用低成本模型清單查詢且優化仍走 Messages API，但空模型清單語意與真實外部端點仍待驗證。**
- 阻擋問題（若有）：無；空模型清單屬非阻擋邊界風險，建議補測並明確決定未知／不可用語意。
- 剩餘風險：未使用真實 API key；外部模型清單相容性、proxy／TLS、錯誤／rate-limit、模型品質、計費與平台封裝仍未驗收；本審查環境的完整回歸受監聽權限限制。

## 審查代理聲明
本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
