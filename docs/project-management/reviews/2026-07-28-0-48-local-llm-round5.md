# 獨立審查報告：0.48 真實 Ollama 單模型驗收

- 審查對象 commit／版本：工作樹基準 `82af544b112423afafba8940cb5ff59e701177c7`／`0.48.0`，分支 `codex/0.48-local-llm`；本輪僅審查最新未提交治理文件對真實 Ollama 證據的增補。
- 對應 08-CHANGE-LOG 條目：2026-07-28 — 0.48 本機 LLM 基礎支援
- 審查輪次：round5
- 審查代理啟動時間、上下文來源：2026-07-28（Asia/Taipei）；獨立讀取目前差異、FR-021、前四輪報告及測試／治理文件，並直接查詢本機 Ollama HTTP API；未將主要代理的摘要當作未驗證事實。

## Findings

### P2：真實單次輸出的可重現性不足

- `docs/project-management/00-CURRENT-STATUS.md:54`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:122` 與 `docs/project-management/08-CHANGE-LOG.md:61` 都只提供摘要，沒有原始 response、完整 prompt、執行指令／時間戳或保存的 machine-readable 證據檔。因此可確認「曾做過一輪」的治理敘述，但無法由文件逐字重放 `traditionalChinese=false` 或英文句點結果。
- 2026-07-28 直接查詢本機 API：`curl -sS http://127.0.0.1:11434/api/version` 回 `{"version":"0.32.5"}`；`GET /v1/models` 回 `llama3.2:1b`，與文件的版本／模型一致。
- 以 `/v1/chat/completions` 能力 prompt 查詢時，本輪回應為 `{"traditionalChinese":"繁體中文"}`（本輪結果為 true），與文件記錄的 `traditionalChinese=false` 不一致；模型輸出具非決定性或 prompt／參數不同的可能，故不能把文件中的 false 當作穩定模型能力結論。
- 以單 cue prompt 直接查詢時，回應含 `{"cues":[{"id":1,"text":"優化文字","reason":"簡短原因"},{"start":"00:00:01,000","end":"00:00:03,000","text":"這是一個測試。","duration":"00:00,000"}]}`，出現額外且缺少 `id` 的物件；這說明真實模型 response 仍須依 strict cue contract 拒絕或重試，不能以「HTTP 200／任務 completed」推論品質通過。此直接測試 prompt 與產品完整 prompt 不完全相同，故列為品質風險與重現性 finding，不宣稱產品任務同樣產生此具體 payload。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `FR-021`（`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37`）要求 Ollama／LM Studio 各一模型完成端到端，且斷網可完成；本輪只新增 Ollama `llama3.2:1b` 的 `/v1/models`、能力與 1 cue 摘要，LM Studio／斷網仍明確待執行。
  - 文件正確揭露 `traditionalChinese=false`、中文句號變英文句點及需人工品質審核，沒有將單模型證據升格為 0.48 完成。
  - 但原始輸出缺少可回溯 artifact，故能力 false 與標點結果只可視為該次摘要，不能作為穩定驗收基線。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - `/v1/models` 與 provider／model 對應具體一致；模型確實由本機 Ollama 提供，未涉及雲端。
  - 產品 `model-capabilities.mjs` 對 response 做 JSON／指定繁中欄位判定，且既有 optimizer 嚴格驗證 cue ID、數量、順序與時間碼；本輪直接觀察到的額外 cue object 正是應由契約層拒絕的風險類型。
  - 能力檢查單次 true 與文件 false 的差異顯示 prompt、temperature、模型狀態或非決定性會影響結果；必須保存實際請求與回應，才能作邏輯結論。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 文件揭露繁中能力失敗與標點品質風險，並保留人工審核條件，涵蓋最重要的品質負例。
  - 本輪直接 API 呼叫補充觀察到模型可能回傳額外缺少 id 的 cue，證明真實模型輸出邊界不可由 JSON parse 成功取代。
  - 尚未測試同一 prompt 多次一致性、較長批次、模型未載入／超時、取消／恢復、重啟後 checkpoint 及移除外網；這些仍是版本驗收缺口。

## 4. 程式碼品質

- 判定：通過（現有實作）
- 證據：
  - Ollama 使用共用 OpenAI-compatible transport，維持 loopback 無 Key、redirect 防護與錯誤／cue strict validation；本輪沒有發現 production code 被文件增補改壞。
  - 文件語句使用「1 cue」「能力 false」「品質不能直接接受」「需人工審核」，明確限制證據範圍；未宣稱真實模型完整通過。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 真實 endpoint：`curl -sS http://127.0.0.1:11434/api/version`、`GET /v1/models` 成功確認 Ollama 0.32.5／`llama3.2:1b`。
  - 本輪直接重放能力與單 cue chat completions，取得可解析能力 JSON 及一個包含額外 cue object 的實際回應；這支持「需人工／strict contract」風險，但無法重現文件摘要的 false／英文句點。
  - 沒有 LM Studio、斷網、長批次、跨平台真實模型或乾淨安裝驗收，因此整體 FR-021 仍部分通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 本機 API 實際回報 Ollama `0.32.5`，模型列表含 `llama3.2:1b`。
  - 本輪實際能力 response 為 `traditionalChinese=繁體中文`，單 cue response 不是可直接接受的嚴格 cue 陣列；這與文件對品質不穩定的總體警示一致，但不能驗證文件記錄的那一個 false／句點案例。
  - 文件仍準確保留 LM Studio、斷網及 0.48 未發布狀態。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無產品程式碼阻擋；P2 證據可重現性問題必須在將 Ollama 升格為「驗收通過」前補齊原始輸出與可重放命令。
- 剩餘風險：
  - Ollama 單模型品質及能力結果非穩定基線；`traditionalChinese` 可能隨 prompt／模型狀態改變。
  - 真實模型可能產生額外 cue、錯誤欄位或標點風格變化；strict contract／人工接受不可省略。
  - LM Studio、真正斷網、長批次、取消／恢復及跨平台安裝後仍未完成。
- 給主要開發代理的具體要求：
  1. 保留目前 `traditionalChinese=false` 與英文句點的風險揭露，不改寫為能力通過；補保存版本、模型、完整 prompt／參數、原始 response、HTTP 狀態與時間戳。
  2. 以同一可重放腳本重跑至少數次，分別驗證 capability 與 1 cue strict contract；若結果不穩，明確標示非決定性並維持人工審核。
  3. 完成 LM Studio 真實模型與斷網端到端前，0.48 必須維持開發中。

**本輪「2026-07-28 — 0.48 本機 LLM 基礎支援」round5 獨立複審結論為有條件通過：本機 Ollama API 實際確認版本 0.32.5 與模型 `llama3.2:1b`，文件亦如實揭露單次能力檢查 `traditionalChinese=false`、中文句號轉英文句點及人工品質風險，未將此單模型證據升格為 0.48 全部通過；但原始 prompt／response／參數未以可回溯 artifact 保存，且本輪重放同類能力 prompt 得到 true、單 cue 得到含額外缺少 id 物件的回應，故 Ollama 品質與能力結論仍不可視為穩定驗收基線，須補可重放證據並完成 LM Studio／斷網端到端，0.48 維持開發中。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、HTTP 查詢與驗證，未修改任何其他專案來源或治理檔案。
- 若上述聲明不實，本報告無效。
