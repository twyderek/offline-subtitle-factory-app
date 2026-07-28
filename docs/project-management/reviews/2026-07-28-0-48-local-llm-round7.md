# 獨立審查報告：0.48 Ollama live probe 安全修正

- 審查對象 commit／版本：工作樹基準 `82af544b112423afafba8940cb5ff59e701177c7`／`0.48.0`，分支 `codex/0.48-local-llm`；包含 round6 後 `scripts/probe-ollama-live.mjs`、artifact 與 `06`／`08` 文件差異。
- 對應 08-CHANGE-LOG 條目：2026-07-28 — 0.48 本機 LLM 基礎支援
- 審查輪次：round7
- 審查代理啟動時間、上下文來源：2026-07-28（Asia/Taipei）；獨立讀取 round6 報告、live probe、evidence JSON、必要 local-ai helper 與治理文件，並重跑 loopback probe 及遠端 URL 負例。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `scripts/probe-ollama-live.mjs:3-8` 現使用 `isLoopbackAiUrl`，在任何網路請求前拒絕非 `localhost`／`127.0.0.1`／`[::1]`；`endpointPrivacy` 改由 `aiEndpointPrivacy(baseUrl)` 計算（:44），不再硬編碼 local。
  - `scripts/probe-ollama-live.mjs:23-27,35-37` 的三類 fetch 均設定 `redirect: 'manual'`；符合 round6 的只連 loopback／禁止 redirect 要求。
  - FR-021 仍要求 Ollama／LM Studio 各一真實模型與斷網端到端；本輪只解除 probe 安全阻擋，不代表整個 0.48 完成。

## 2. 邏輯正確性

- 判定：通過（probe 安全修正）
- 證據：
  - `isLoopbackAiUrl` 以 URL parser 及精確 hostname allowlist 判定；遠端環境變數在建立 fetch 前即 throw。
  - 所有 probe HTTP 請求的 redirect policy 均為 manual；因此不會自動把 capability／subtitle body 送到第二站。
  - artifact 的 `endpointPrivacy` 使用同一 helper，loopback 與標示不會再互相矛盾。

## 3. 邊界情況

- 判定：通過（本輪範圍）
- 證據：
  - 2026-07-28T11:40+08:00 執行 `node scripts/probe-ollama-live.mjs /tmp/ollama-round7.json`：exit 0，版本 `0.32.5`、模型數 1、capability／singleCue 均 HTTP 200；artifact endpoint 為 `http://127.0.0.1:11434/v1`、privacy 為 `local`。
  - 同時執行 `OLLAMA_BASE_URL='https://example.invalid/v1' node scripts/probe-ollama-live.mjs ...`：exit 1，錯誤為 `Live Ollama probe 只允許 loopback URL`，且在 fetch 前停止。
  - 靜態檢查確認 301／302／303／307／308 不會自動跟隨；產品 transport 與 probe 的安全政策一致。
  - 尚未新增自動化 redirect／hostname matrix test；目前有手動遠端負例及程式碼證據，屬可補強而非已知阻擋。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - probe 重用 `lib/ai/local-ai.mjs` 的集中安全 helper，避免自行複製 hostname 規則。
  - 所有 fetch 明確標示 `redirect: 'manual'`，artifact privacy 由解析結果產生；修改小且可回溯。
  - 既有 artifact 仍保留完整 prompt／參數／raw response，round6 指出的欄位大小寫、cue schema、時間碼及 Markdown 偏差沒有被掩蓋。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 本輪實跑 loopback probe 與遠端 URL exit 1 負例；遠端錯誤發生於網路請求前。
  - `python3 -m json.tool /tmp/ollama-round7.json` 可解析，內容含版本、模型清單及兩個 request／response。
  - 未新增腳本專用自動測試覆蓋惡意 localhost 子網域、IPv6、五種 redirect 或第二站零請求；產品既有 provider contract 不會自動測到此獨立 probe，建議後續補上。
  - LM Studio、真正斷網、長批次與跨平台實機仍未覆蓋。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - loopback live probe 實際成功取得 Ollama 0.32.5／`llama3.2:1b`、模型列表與兩個 chat responses；未使用 API key。
  - 遠端環境變數實際 exit 1，錯誤訊息明確，未產生遠端 evidence artifact。
  - 文件 `06`／`08` 仍如實限定 Ollama 單模型證據，保留 `Traditional Chinese`、`cue`、時間碼／Markdown 偏差與人工品質風險，未聲稱 LM Studio／斷網或 0.48 全版通過。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：round6 的 probe 遠端外送／錯誤 privacy 標示阻擋已解除；本輪未發現新的安全或證據阻擋。
- 剩餘風險：
  - probe 尚無專用自動化安全矩陣；未來重構可能回歸，應加入 URL／redirect／第二站零送達測試。
  - 單次 Ollama response 的模型品質與能力仍非穩定基線；既有 artifact 偏差仍須 strict contract／人工審核。
  - LM Studio、真正斷網、Windows／macOS 完整安裝後驗收仍未完成。
- 給主要開發代理的具體要求：
  1. 可將 round6 阻擋標記為已解除，保留本報告並把 round7 結論連結到工作條目。
  2. 後續補 probe 專用 automated tests（遠端／惡意 hostname、IPv4／IPv6、五種 redirect、第二站零請求）。
  3. 在 LM Studio 與斷網端到端完成前，0.48 維持開發中。

**本輪「2026-07-28 — 0.48 本機 LLM 基礎支援」round7 獨立複審結論為有條件通過：`probe-ollama-live.mjs` 已以 `isLoopbackAiUrl` 在發出請求前拒絕非 loopback URL，使用 `aiEndpointPrivacy` 正確產生 privacy 標示，且版本、模型列表、capability 與 single-cue 的所有 fetch 均設定 `redirect: 'manual'`；本輪實跑 loopback probe exit 0 並取得 Ollama 0.32.5／`llama3.2:1b`，遠端 `OLLAMA_BASE_URL` 負例 exit 1 且未外送，round6 安全阻擋已解除，文件仍準確揭露真實模型品質偏差與未完成的 LM Studio／斷網驗收；建議補 probe 專用自動化安全矩陣，但本輪無新的阻擋，0.48 仍維持開發中。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、HTTP 查詢、腳本執行與驗證，未修改任何其他專案來源或治理檔案。
- 若上述聲明不實，本報告無效。
