# 獨立審查報告：0.48 Ollama live probe 證據與安全性

- 審查對象 commit／版本：工作樹基準 `82af544b112423afafba8940cb5ff59e701177c7`／`0.48.0`，分支 `codex/0.48-local-llm`；審查最新 `scripts/probe-ollama-live.mjs`、`docs/project-management/evidence/2026-07-28-ollama-llama3.2-1b-live.json` 及 `06`／`08` 文件增補。
- 對應 08-CHANGE-LOG 條目：2026-07-28 — 0.48 本機 LLM 基礎支援
- 審查輪次：round6
- 審查代理啟動時間、上下文來源：2026-07-28（Asia/Taipei）；獨立讀取腳本、artifact、文件、FR-021 與前五輪報告，並以本機 HTTP API 及靜態安全檢查核對；未沿用主要代理的主觀摘要。

## Findings

### P1：live probe 可由環境變數改連遠端，且會把遠端誤標為 local-loopback

- `scripts/probe-ollama-live.mjs:4` 將 `OLLAMA_BASE_URL` 任意字串直接作為 base URL；沒有解析、hostname allowlist、loopback 驗證或拒絕 credentials／非 HTTP(S) 的保護。
- `scripts/probe-ollama-live.mjs:21-25` 使用預設 fetch redirect 行為，也沒有 `redirect: 'manual'`；即使初始 URL 為 loopback，HTTP redirect 仍可能將 subtitle prompt 送往外部站點。
- `scripts/probe-ollama-live.mjs:41` 固定寫入 `endpointPrivacy: 'local-loopback'`，因此設定 `OLLAMA_BASE_URL=https://example.invalid/v1` 時，artifact 仍會宣稱 local-loopback。這直接違反本輪「只連 loopback、無 API key 外送」的腳本安全要求與證據可信度。
- 本輪未執行遠端請求；靜態 code path 已足以重現風險，且不需要真的把字幕送出。修正前不應把此 probe 當成安全的通用 evidence generator。

### P2：artifact 內容完整但缺少部分環境／transport metadata

- `docs/project-management/evidence/2026-07-28-ollama-llama3.2-1b-live.json` 確實保存 `capturedAt`、endpoint、version、model、`/v1/models`、完整 capability／single-cue request body、HTTP status 與原始 response body；欄位大小寫、`cue` 而非 `cues`、時間碼改動、Markdown code fence 與自然語言偏差均可逐字查證。
- artifact 沒有保存 fetch headers（雖腳本固定只送 `Accept`／`Content-Type`，且沒有 API key）、redirect policy、執行指令、Node／Ollama client 環境、response headers 或網路介面；若作為正式可重放證據，應至少保存 `redirect: manual`／安全驗證結果與腳本版本／commit。
- 文件 `06:122` 與 `08:61` 對欄位大小寫、cue schema、時間碼及 Markdown 偏差的描述與 artifact 一致，且沒有將 HTTP 200 當作品質通過。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - FR-021 要求 Ollama／LM Studio 本機端點與人工／strict cue contract；artifact 的 single-cue response 具體顯示 `"cue"`（不是產品要求的 `"cues"`）、`start` 從 `00:00:00,000` 改為 `00:00:01.000`，並附 Markdown／自然語言，正好支持不得直接接受的品質結論。
  - capability response 使用 `"Traditional Chinese"`（大寫與空格），不是產品 parser 要求的 `traditionalChinese`；文件已如實揭露此偏差。
  - 真實 Ollama 單模型證據仍不滿足 LM Studio、斷網及整個 FR-021 版本完成條件。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - `probe-ollama-live.mjs:32-37` 確實查詢版本與 `/v1/models`，`requests` 逐項保存 body／response；artifact 可驗證模型 `llama3.2:1b` 與 Ollama `0.32.5`。
  - 產品 strict parser 對欄位大小寫、schema、時間碼與 Markdown 偏差應拒絕；artifact 內容支持這個安全結論。
  - 但 probe 自身把任意 env base URL 標成 local，且可 auto-follow redirect；因此其「local-only evidence」邏輯不完整，屬 P1 安全阻擋。

## 3. 邊界情況

- 判定：不通過（probe 安全範圍）
- 證據：
  - 已檢查預設 endpoint 為 `http://127.0.0.1:11434/v1`，artifact 本次確為 loopback。
  - 未檢查 `OLLAMA_BASE_URL` 的 `localhost.example.com`、IPv6／非 loopback、`https://` 遠端、URL credentials、非 HTTP(S) 或 301／302／303／307／308 redirect；這些輸入均可繞過「只連 loopback」的腳本意圖。
  - 產品 transport 已有 redirect manual 防護，但 probe 另行直接使用 fetch，不能自動繼承產品 transport 的安全政策。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - 腳本簡潔、使用固定兩個 prompt、保存完整 response，且不設定或讀取 API key；artifact JSON 格式可由 `python3 -m json.tool` 解析。
  - 但 local privacy 標籤硬編碼、base URL 未正規化／驗證與 fetch transport policy 缺失，使 evidence generator 的安全與可維護性不足。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 本輪靜態核對 `scripts/probe-ollama-live.mjs:4,21-25,41`、`python3 -m json.tool docs/project-management/evidence/2026-07-28-ollama-llama3.2-1b-live.json` 通過；本機 API 另確認 Ollama 版本與模型列表。
  - artifact 保存的 capability／single-cue 原始 response 足以重放欄位大小寫、schema、時間碼與 Markdown 偏差。
  - 沒有 probe 自動測試涵蓋遠端 env、惡意 hostname 或 redirect；這是 P1 缺口，且不應以產品 `npm run check` 取代。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - artifact 的 `endpoint` 確為 `http://127.0.0.1:11434/v1`，`version.version` 為 `0.32.5`，models 含 `llama3.2:1b`。
  - capability 原始 response 的 key 為 `Traditional Chinese`；single-cue 原始 response 為 fenced Markdown、`cue` 單數、時間碼偏移及自然語言，文件描述準確。
  - 這證明真實模型可回應，但不證明品質或 FR-021 完成；LM Studio、真正斷網與跨平台完整驗收仍未完成。

## 綜合判定

- 結論：不通過
- 阻擋問題（若有）：
  1. `probe-ollama-live.mjs` 可透過 `OLLAMA_BASE_URL` 連到任意遠端，且會固定寫入 `endpointPrivacy: local-loopback`；這使 probe 可能外送字幕並產生錯誤的隱私證據。
  2. probe fetch 未禁用 redirect，初始 loopback 也可能將 prompt 導向外部站點。
- 剩餘風險：即使修正 probe，單次 Ollama 反應仍不穩定；LM Studio、真正斷網、長批次、取消／恢復與跨平台安裝後仍未完成。
- 給主要開發代理的具體修正要求：
  1. 對 `OLLAMA_BASE_URL` 使用 URL parser，精確 allowlist `localhost`、`127.0.0.1`、`[::1]`，拒絕所有其他 hostname／scheme／credentials；artifact 的 privacy 應由解析結果產生，不得硬編碼。
  2. probe fetch 設 `redirect: 'manual'`，遇 301／302／303／307／308 立即失敗；加入遠端、惡意 localhost 子網域、redirect 與無 API key 的自動測試，並確認第二站 0 request。
  3. 保留目前 artifact 的完整 prompt／參數／原始 response，另加入腳本 commit、Node／Ollama 版本、HTTP status／headers（排除 secrets）與安全判定結果。
  4. 修正後建立下一輪獨立複審；在 LM Studio／斷網完成前 0.48 維持開發中。

**本輪「2026-07-28 — 0.48 本機 LLM 基礎支援」round6 獨立複審結論為不通過：Ollama live artifact 確實保存完整 capability／single-cue prompt、參數與原始 response，且準確呈現 `Traditional Chinese` 欄位大小寫、`cue` schema、時間碼偏移、Markdown／自然語言偏差；但 `probe-ollama-live.mjs` 可由 `OLLAMA_BASE_URL` 改連任意遠端、硬編碼 `endpointPrivacy=local-loopback` 且未禁止 redirect，可能外送字幕並產生錯誤隱私證據，直接違反只連 loopback／無 API key 外送的腳本安全要求；須修正 allowlist、privacy 判定與 redirect 防護並完成複審，且 LM Studio／真正斷網仍未完成，0.48 不得宣稱完成或發布就緒。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、HTTP 查詢與靜態驗證，未修改任何其他專案來源或治理檔案。
- 若上述聲明不實，本報告無效。
