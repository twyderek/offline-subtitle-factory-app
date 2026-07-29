# 獨立審查報告：0.48 Ollama 原生 structured output 修正

- 審查對象 commit／版本：`919e5567e7e836ee7c1d2d6bf54716b4074bb576`／`0.48.0`，分支 `codex/0.48-local-llm`。
- 對應工作：2026-07-29 — 本機 LLM 結構化輸出修正（位於 08-CHANGE-LOG 的 0.48 條目內）。
- 審查輪次：round9
- 審查代理啟動時間、上下文來源：2026-07-29（Asia/Taipei）；獨立讀取 commit diff、FR-021、provider／optimizer、前八輪報告及治理文件，並重跑 `npm test`／`npm run check` 與本機 Ollama 原生 `/api/chat` structured-output 請求。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `lib/ai/providers.mjs:47-92` 新增 Ollama 原生 `/api/chat` adapter、`format` JSON Schema、`stream:false`、`temperature:0`，並將原生 `message.content` 映射回既有 `choices[].message.content` 契約。
  - `lib/ai/subtitle-optimizer.mjs:100-107` 新增 `subtitle_cue_count`，system prompt 移除容易被小模型照抄的佔位字，要求使用實際文字與原文保留。
  - schema `minItems`／`maxItems` 動態鎖定每批 cue 數量，items 要求 id／text／reason 且 additionalProperties false；既有 optimizer 仍驗證順序、數量、ID、文字長度與時間碼不被模型回應修改。
  - 真實 Ollama 單 cue completed 證據支持本輪目標；LM Studio 仍未切換 native structured-output，且 0.48 的斷網／跨平台完成門檻未達成。

## 2. 邏輯正確性

- 判定：通過（Ollama native 路徑）
- 證據：
  - 2026-07-29 直接呼叫 `http://127.0.0.1:11434/api/chat`，傳入與 adapter 同形狀的 schema（cue count 1、required id/text/reason、additionalProperties false），回應為 JSON `cues` 陣列且只有一項 id 1。
  - 真實回應內容為 `"text": "這是一個測試字幕."`、`reason: "test"`：中文句號被改為英文句點，品質風險仍需人工確認；schema 結構本身有效。
  - `ollamaNativeBaseUrl` 只在 port 空白或 11434 時使用原生路徑，其他 loopback port fallback 到 OpenAI-compatible，避免把 LM Studio／自訂 fake 端點誤送 `/api/chat`。
  - 原生 response 只映射 content，不把 Ollama metadata 混入 optimizer contract；未放寬 strict parser。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 動態 `minItems/maxItems` 可防止模型回傳少於／多於當批 cue；items 的 additionalProperties false 可拒絕額外欄位（實際 parser 仍會再驗證）。
  - anti-placeholder prompt 明確禁止「優化文字／原ID／簡短原因」並要求不需修改時保留原文，降低小模型照抄示例的風險。
  - `npm test` 的 Ollama core fake server 在非 11434 port 走 fallback，未直接覆蓋 native adapter 的 request path、dynamic schema 與 Ollama `/api/chat` response mapping；這是 P2 測試缺口而非已知 production failure。
  - 尚未測試多 cue native batch、模型不支援 format、native timeout／cancel、schema reject、非 11434 自訂 Ollama port 與 LM Studio structured output。

## 4. 程式碼品質

- 判定：通過（附測試補強建議）
- 證據：
  - native adapter 封裝在 provider registry，未污染 server API 或 UI；schema 建構與 response mapping 集中，變更可回溯。
  - `subtitle_cue_count` 從實際 batch length 產生，未由使用者任意輸入，符合 cue 數量契約。
  - `ollamaNativeBaseUrl` 清除 `/v1`、query、hash 後呼叫 `/api/chat`；loopback／Key／redirect 安全仍由共用 `requestAiJson` transport 管理。
  - 目前 import／schema 皆語法與回歸通過；沒有發現把原始字幕直接覆寫或繞過人工接受的變更。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-29 執行 `npm test && npm run check`：全部通過，含 provider、optimizer、core、UI 與治理檢查。
  - 實際 native Ollama request 回 HTTP 200，`message.content` 為符合 schema 的單 cue JSON；模型 `llama3.2:1b` 回應仍將中文句號轉英文句點，風險與 changelog 一致。
  - 現有自動測試沒有 native adapter 的 mock assertion（在 `test-core` fake port 會 fallback），也沒有把 schema／temperature／`/api/chat` pathname 寫入 regression；建議新增 provider contract。
  - LM Studio、真正斷網、跨平台與長批次仍未覆蓋。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 實際 native response：`{"cues":[{"id":1,"text":"這是一個測試字幕.","reason":"test"}]}`；cue count 1/1、ID 1 正確，沒有額外 cue，證明 structured output 解決了先前 malformed／placeholder 風險的一部分。
  - 文字標點仍不符合繁中品質預期，與工作紀錄「英文句點、人工確認」一致；不得把 completed 等同品質通過。
  - 文件條目明確標示 LM Studio 尚未切換 native path、LM Studio／斷網仍待驗收，沒有將 Ollama 單 cue 升格為 0.48 完成。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無本輪新產品阻擋；native Ollama 真實單 cue 證據支持修正方向。
- 剩餘風險：
  - native adapter 的自動化 coverage 尚缺，現有 fake tests 會走 fallback，未能防止未來 `/api/chat` mapping／schema 回歸。
  - llama3.2:1b 仍有中文標點品質問題；需要人工接受與提示詞／模型調整。
  - LM Studio 仍使用舊 OpenAI-compatible 路徑，真實 1.5b、0.5b failure raw evidence、斷網、取消／恢復及跨平台安裝後未完成。
- 給主要開發代理的具體要求：
  1. 新增 native provider contract mock，斷言 11434 走 `/api/chat`、`format` 動態 cue schema、`stream:false`、temperature 0、response mapping；另測非 11434 fallback。
  2. 對真實 Ollama 多 cue／長批次與取消重試補充 evidence；保留標點品質風險與人工確認要求。
  3. LM Studio structured output、真正斷網與跨平台驗收前，0.48 維持開發中。

**本輪「2026-07-29 — 本機 LLM 結構化輸出修正」round9 獨立複審結論為有條件通過：Ollama 11434 native `/api/chat` adapter 已使用 `stream:false`、temperature 0、動態 `minItems/maxItems` cue schema 與 anti-placeholder prompt；本輪實際 llama3.2:1b 單 cue 回應為有效 JSON、cue count 1/1、ID 正確且未產生額外 cue，`npm test` 與 `npm run check` 通過，文件亦準確揭露英文句點品質風險及 LM Studio／斷網未完成；但 native adapter 尚未由自動 provider contract 直接覆蓋，LM Studio 仍未切換 structured output，0.48 不得宣稱完成或發布就緒。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、測試、HTTP 查詢與驗證，未修改任何其他專案來源或治理檔案。
- 若上述聲明不實，本報告無效。
