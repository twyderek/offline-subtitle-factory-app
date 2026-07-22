# 獨立審查報告：BUG-012 供應商設定遷移與 0.45.3 規劃

- 審查對象版本：`0.45.2` 工作樹修正；目標納入 `0.45.3`
- 審查輪次：round1
- 審查代理上下文：由獨立委派上下文執行；僅讀取、執行與驗證

## 1. 需求完整性

- 判定：部分通過
- 阻擋問題：無。
- 證據：`FR-014` 已新增供應商設定一致性遷移需求；`BUG-012`、`NEXT-VERSION-FIX-LOG.md`、`00-CURRENT-STATUS.md`、`04-DEVELOPMENT-HISTORY.md` 與 `06-TEST-AND-PROCESS-AUDIT.md` 均記錄 OpenAI-compatible／Gemini 混用問題與 0.45.3 工作重點。`server.mjs` 只在 provider 為 `openai-compatible` 時套用遷移。
- 剩餘風險：尚未完成既有 0.45.2 使用者設定檔的實機升級驗收，因此 0.45.3 仍屬規劃中，未可宣稱已發布。

## 2. 邏輯正確性

- 判定：部分通過
- 阻擋問題：無。
- 證據：`normalizeAiSettings` 偵測 `generativelanguage.googleapis.com` 或 `gemini-*` 模型，且只有 `provider === 'openai-compatible'` 時將 Base URL 回復為 OpenAI-compatible 預設空值並清空模型；正常 Gemini provider 不進入該分支。正常自訂 endpoint `https://api.example.test/v1` 的既有核心測試仍可保存；API Key 與 provider profile 儲存邏輯未被遷移分支修改。
- 剩餘風險：目前遷移判斷只靠 URL／模型字串啟發式；若使用者刻意以 OpenAI-compatible proxy 呼叫 Gemini 模型，會被視為 legacy 混用並要求重新輸入設定。

## 3. 邊界情況

- 判定：部分通過
- 阻擋問題：無。
- 證據：測試案例涵蓋 Gemini URL `/v1beta/interactions` 加 `gemini-3.5-flash` 的混用資料，確認 provider 保持 `openai-compatible`、Base URL／model 皆清空；`test-core.mjs` 亦保留非法 provider、空 Azure、Groq profile 與 Gemini runtime key 隔離案例。
- 剩餘風險：尚未以實際舊版 `settings.json`、重啟流程與現有 Gemini profile／磁碟金鑰做端到端升級測試；模型名稱非 `gemini-*` 但 URL 為 Gemini 的案例由 URL 規則涵蓋，反向自訂 proxy 情境未涵蓋。

## 4. 程式碼品質

- 判定：通過
- 阻擋問題：無。
- 證據：遷移邏輯集中於 `normalizeAiSettings`，變更範圍小；沒有刪除 secrets、重寫 Gemini profile 或改動 provider adapter；測試以 API 行為驗證實際正規化結果，而非只測私有函式。
- 剩餘風險：`server.mjs` 的啟發式條件未抽成命名的可重用 helper；若 0.45.3 擴充更多供應商，應避免持續增加字串判斷。

## 5. 測試覆蓋

- 判定：部分通過
- 阻擋問題：無。
- 證據：獨立審查執行 `npm run project:preflight`；主要代理已執行 `node scripts/test-core.mjs` 與完整 `npm run check`，核心回歸及 provider／UI／治理測試通過。新增 `test-core.mjs` migration case 確認混用資料的 provider、Base URL、model 結果。
- 未覆蓋：真實 0.45.2 使用者設定升級、跨平台實機 UI、真實 Groq／Gemini 外部 API smoke test，以及刻意使用 Gemini proxy 的 OpenAI-compatible 進階情境。

## 6. 實際運行結果

- 判定：部分通過
- 阻擋問題：無。
- 證據：核心 API 回歸實際通過；設定 POST 經 `normalizeAiSettings` 後回傳 `provider: openai-compatible`、`baseUrl: ''`、`model: ''`，符合避免畫面帶入 Gemini 資料的目標。版本仍為已發布 `0.45.2`，文件明確將修正與驗收列入下一版 `0.45.3`，本輪未宣稱發布 0.45.3。
- 剩餘風險：尚未重新封裝 0.45.3 或在使用者實際資料目錄啟動驗收；目前修正僅存在工作樹。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無。
- 剩餘風險：啟發式遷移可能影響刻意使用 Gemini proxy 的 OpenAI-compatible 設定；實機舊設定升級、跨平台驗收與真實供應商 smoke test 尚未完成。
- 條件：0.45.3 發布前完成既有設定檔重啟／UI 驗收，確認 Gemini profile／API Key 不受影響；補測正常 OpenAI-compatible 自訂 endpoint 與刻意 proxy 邊界；維持目前版本／下一版本文件一致。
- 可逐字引用的完整結論句：**本輪 BUG-012 獨立審查結論為有條件通過：遷移邏輯只作用於 OpenAI-compatible 的可辨識 Gemini URL／模型混用資料，正常 Gemini provider、API Key／profile 隔離、正常自訂 endpoint 與 migration API 測試均未發現阻擋問題；完成 0.45.3 實機舊設定升級、proxy 邊界與跨平台驗收後，才可將本修正納入 0.45.3 發布。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本檔案為本輪唯一新增檔案。
- 若上述聲明不實，本報告無效。
