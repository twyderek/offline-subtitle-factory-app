# 獨立審查報告：0.48 LM Studio 真實模型驗收

- 審查對象 commit／版本：`b217fb2`（`docs: record LM Studio local model validation`）及目前工作樹／`0.48.0`。
- 對應 08-CHANGE-LOG 條目：2026-07-28 — 0.48 本機 LLM 基礎支援
- 審查輪次：round8
- 審查代理啟動時間、上下文來源：2026-07-28（Asia/Taipei）；獨立讀取最新 changelog、目前狀態、測試稽核、FR-021、前七輪報告，並直接查詢 `127.0.0.1:1234/v1` LM Studio API；未將主要代理摘要視為原始證據。

## Findings

### P2：LM Studio 實測沒有保存可重放 evidence artifact

- `08-CHANGE-LOG.md:63` 聲稱 LM Studio 0.4.20、兩個模型的行為及 1 cue completed，但 repo 沒有 LM Studio probe script 或 JSON／raw request-response artifact；`docs/project-management/evidence/` 目前只有 Ollama artifact。依治理證據規則，這是可追溯性缺口。
- 本輪直接 `GET http://127.0.0.1:1234/v1/models` 確認模型列表含 `qwen2.5-0.5b-instruct` 與 `qwen2.5-1.5b-instruct`，但 HTTP API 沒有提供 LM Studio app 版本 0.4.20 的可獨立核對欄位；版本仍只能採文件記錄。
- 直接以 `qwen2.5-1.5b-instruct` 重放同類 capability prompt 得 `{"traditionalChinese":"繁體中文"}`，與 changelog 的「能力探測仍為 false」不一致；這與 Ollama round5 一樣，顯示單次模型輸出／prompt／runtime 狀態不穩，不能把 false 當穩定能力基線。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - changelog 對 `qwen2.5-0.5b-instruct` 無效 JSON、改用 `qwen2.5-1.5b-instruct`、1 cue completed、1/1 batch、0 retries、0 changed cues 的敘述，與 FR-021 的「至少一個真實模型」方向一致。
  - 文件仍明確寫「繁體中文能力探測 false、品質與真正斷網尚待驗收」，沒有升格成整個 0.48 通過；LM Studio 只是部分里程碑。
  - 斷網端到端、人工接受／取消恢復的真實 LM Studio evidence 尚未由 artifact 可回溯。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - `GET /v1/models` 回傳兩個 qwen 模型，與設定 `qwen2.5-1.5b-instruct` 一致；provider 端點為 loopback，無 API key 外送。
  - 本輪重放 1 cue chat completion 實際回傳 `cues` 陣列、id 1、未帶時間碼欄位（符合 optimizer 僅接受 id／text／reason 的回應契約）且文字不變，與 0 changed cues 的合理性一致。
  - 能力 probe 重放為 true 而文件為 false，說明能力欄位受單次 prompt／狀態影響；需要原始 artifact 才能確定當次產品 API 的 false 結果。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 文件涵蓋 0.5b 無效 JSON → 1.5b 可用的模型選擇邊界，以及能力 false／品質人工審核風險。
  - 直接 API 重放確認 1.5b 目前可回傳 strict-looking JSON；尚未重現 0.5b malformed payload、長批次、timeout、取消／恢復或斷網。
  - 未保存原始 0.5b failure body，無法獨立判定該 failure 是 JSON parse、cue schema、timeout 或模型載入錯誤。

## 4. 程式碼品質

- 判定：通過（本輪無 production code 變更）
- 證據：
  - 本輪僅變更治理紀錄，產品 provider／strict validator 未被改動。
  - 文件保持「模型可用但品質不能直接接受」與「斷網仍待驗收」的限定，未把 1 cue HTTP 完成誤寫成品質完成。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 本輪實際查詢 `/v1/models` 與兩次 `/v1/chat/completions`，得到 capability 與 single cue 原始 response；模型列表與 1 cue 結果可直接觀察。
  - 沒有 repo 內 LM Studio probe／artifact，沒有可重跑的 0.5b malformed、0 retries、任務 completed／provider／model 欄位證據；changelog 摘要不能替代完整 command／response evidence。
  - 既有 `npm run check`／fake server 測試驗證產品流程，但不是 LM Studio 真實服務驗收；斷網仍未測。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 本機 endpoint 實際回傳 qwen2.5-0.5b、qwen2.5-1.5b 及 embedding 模型。
  - qwen2.5-1.5b 直接 1 cue 回應為 JSON `cues`、id 1、原文不變，支持 0 changed cues 的結果；capability response 為 `traditionalChinese` true，未重現文件 false。
  - 尚未取得 LM Studio app version、產品 API 任務 record、0.5b raw failure 或斷網 evidence，故不能把 changelog 摘要升格為完整端到端通過。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無產品程式碼阻擋；P2 為實測 evidence 可追溯性缺口，需在將 LM Studio 里程碑升格為完整驗收前補齊。
- 剩餘風險：
  - 能力結果與文件摘要不一致，單次 true／false 不足以代表繁中品質。
  - 0.5b malformed response、1.5b completed 任務原始 record、取消／恢復、人工接受與真正斷網尚未有可回溯 artifact。
  - 0.48 仍未完成兩模型正式端到端與跨平台驗收。
- 給主要開發代理的具體要求：
  1. 新增 LM Studio live probe／evidence JSON，保存 app／endpoint version、models、完整 prompt／參數／HTTP status／raw responses、strict validation 結果與任務 record（排除 secrets）。
  2. 用同一可重放 prompt 多次測 capability，明確記錄 false／true 非決定性；保留 0.5b failure 原文與 1.5b success 原文。
  3. 在真正斷網、人工接受、取消／恢復完成前，0.48 維持開發中。

**本輪「2026-07-28 — 0.48 本機 LLM 基礎支援」round8 獨立複審結論為有條件通過：LM Studio loopback API 實際列出 `qwen2.5-0.5b-instruct` 與 `qwen2.5-1.5b-instruct`，直接重放 `qwen2.5-1.5b-instruct` 的 1 cue 回應為 JSON `cues`、id 1、原文不變，與 changelog 的 0 changed cues 方向一致；文件也正確保留 0.5b 無效 JSON、能力 false、品質及真正斷網風險，未宣稱 0.48 完成；但 repo 沒有 LM Studio 原始 evidence artifact，且重放 capability 得 true 與文件 false 不一致，故實測不可重現、不能升格為完整驗收，0.48 維持開發中。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、HTTP 查詢與驗證，未修改任何其他專案來源或治理檔案。
- 若上述聲明不實，本報告無效。
