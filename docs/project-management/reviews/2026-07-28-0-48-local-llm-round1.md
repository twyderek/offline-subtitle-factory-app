# 獨立審查報告：0.48 本機 LLM 基礎支援

- 審查對象 commit／版本：工作樹基準 `d9ab1c0c72fb0b1950da42a6baa4ebcc237b903d`／`0.48.0`，分支 `codex/0.48-local-llm`；審查包含 2026-07-28T11:12:53+08:00 前可見的未提交完整差異，含後補的 `scripts/verify-electron-renderer.mjs` 與 `03-FUNCTIONAL-DESIGN.md` provider 清單。
- 對應 08-CHANGE-LOG 條目：2026-07-28 — 0.48 本機 LLM 基礎支援
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-28（Asia/Taipei）；由主要代理以獨立子代理上下文啟動，未沿用主要開發代理的對話記憶。審查時自行讀取 preflight 指定治理規範、FR-021、功能設計、工作條目、完整工作樹差異與測試來源。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37` 已建立 FR-021，明定 Ollama／LM Studio、精確 loopback、模型探測、無 Key／無雲端同意、隱私標示、小批次、嚴格 cue 契約、不得自動下載，以及兩種真實模型與斷網端到端門檻。
  - `docs/project-management/03-FUNCTIONAL-DESIGN.md:53-59` 已描述 provider、固定候選端點、loopback 安全分類、Authorization 省略、批次與人工接受設計；`docs/project-management/08-CHANGE-LOG.md` 最新條目亦明確把真實模型、斷網及跨平台驗收列為未完成，未把計畫誤寫成已通過。
  - `lib/ai/providers.mjs:4-23,39-59`、`server.mjs:460-486,3303-3346`、`public/review.html:189-227` 與 `public/review.js:403-501` 已實作兩個 provider、固定端點探索、模型列表、能力探測及 UI。
  - FR-021 的最終驗收條件尚未完成：本輪沒有 Ollama／LM Studio 各一個真實模型、斷網端到端、Windows／macOS／Electron 封裝後操作證據；目前只能審查「基礎實作」，不能判定 0.48 功能完成。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - 正向邏輯：`lib/ai/local-ai.mjs:20-31` 使用標準 URL parser 且只接受 `localhost`、`127.0.0.1`、`[::1]`；`lib/ai/openai-compatible.mjs:31-49` 在無 Key 的精確 loopback 請求省略 Authorization；`server.mjs:623-633` 同一判定同時控制 AI 任務的 Key 與雲端同意門檻。
  - 阻擋缺陷：`lib/ai/openai-compatible.mjs:39-49` 呼叫 `fetch` 時未設定 `redirect: 'manual'`，也未驗證最終 `response.url`。Node fetch 預設跟隨 HTTP 重新導向，因此最初通過 loopback 分類的無 Key／無雲端同意請求，可被本機端點以 307/308 導向非 allowlist hostname，並將 POST 字幕 body 原樣送出。2026-07-28T11:12+08:00 的獨立動態測試以 `127.0.0.1` 起點回覆 307，導向 `0.0.0.0` hostname 的第二個 listener，結果輸出 `{"redirectedToNonAllowlistedHost":true}`，證明「只有 loopback 才可免同意」的資料邊界可被重新導向繞過。
  - 此缺陷直接違反 FR-021（`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37`）與設計宣稱（`docs/project-management/03-FUNCTIONAL-DESIGN.md:55-59`），且影響真正的 `/chat/completions` 字幕內容，屬合併阻擋問題。
  - `lib/ai/model-capabilities.mjs:35-50` 會先列出模型，再以固定 JSON／繁中 prompt 探測，並把「模型存在、context、JSON、繁中」分開回傳；未把缺少 metadata 推測成 context 數值。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - `scripts/test-ai-providers.mjs:41-68` 實際覆蓋無 Key Authorization 省略、IPv4／IPv6 loopback、惡意 `localhost.example.com`、遠端 Ollama 無 Key拒絕、context metadata 有／無及非 JSON 能力回應。
  - `scripts/test-core.mjs:208-244,353-397` 以 fake OpenAI-compatible server 覆蓋無 Key／無同意設定、批次上限、模型列表、連線、能力探測、批次重試與 checkpoint。
  - `scripts/test-review-ui.mjs:75-84` 覆蓋 loopback 表單免 Key與惡意 localhost 子網域拒絕；既有 optimizer 測試繼續覆蓋 cue ID、數量、順序與時間碼保護。
  - 未覆蓋並已由額外測試重現的核心邊界是 301/302/303/307/308 重新導向；目前測試只驗證「初始 URL」，沒有驗證每一跳及最終 URL 仍為 loopback。
  - 真實服務關閉的 connection-refused 顯示已有主要代理人工證據，但 Ollama／LM Studio 版本差異、模型未載入、長回應截斷、真實 context metadata、取消能力探測及斷網後 DNS／proxy 行為仍未實測。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - `lib/ai/local-ai.mjs` 集中 provider 常數與 loopback 分類；`lib/ai/model-capabilities.mjs` 將 metadata／probe parsing 抽成純函式；`lib/ai/providers.mjs` 讓 Ollama／LM Studio 共用 OpenAI-compatible adapter，結構清楚且避免重複。
  - `server.mjs:440-486` 將公開隱私狀態與固定候選探測集中處理；`public/ai-provider-settings.mjs:19-29` 與後端採相同精確 hostname 規則，未使用危險字串前綴。
  - `scripts/verify-electron-renderer.mjs:308` 已把 Ollama／LM Studio 納入封裝 provider 完整性清單；`docs/project-management/03-FUNCTIONAL-DESIGN.md:51` 的 registry 清單也已同步。
  - 但安全政策目前只在請求前分類一次，沒有在 HTTP transport 層封鎖跨邊界 redirect；這使集中分類看似正確、實際傳輸卻不保證同一政策，是本輪最重要的品質與安全缺口。
  - `lib/ai/openai-compatible.mjs:85` 的 import 位於檔案末端，雖為合法 ESM 且語法檢查通過，但降低依賴可見性；屬非阻擋可維護性問題。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-28T11:08+08:00 執行 `node scripts/test-ai-providers.mjs`：通過。
  - 2026-07-28T11:08+08:00 執行 `node scripts/test-review-ui.mjs`：通過。
  - 受限 sandbox 首次執行 `node scripts/test-core.mjs` 因 `listen EPERM` 失敗；依規範改在允許 loopback listen 的環境重跑。
  - 2026-07-28T11:09+08:00 在允許本機 listener 的環境執行 `node scripts/test-core.mjs && npm run check`：核心整合與完整回歸通過；輸出包含治理、媒體、雙語、品質、Whisper metadata、AI optimizer、provider、review UI 與 core 全套測試。
  - 2026-07-28T11:12+08:00 執行 `git diff --check`：通過。
  - 目前正式測試沒有 redirect safety case；額外攻擊測試已穩定重現資料離開 allowlist host，因此現有 `npm run check` 通過不足以解除安全阻擋。
  - 未執行封裝／Electron renderer、Windows／macOS 實機及真實 Ollama／LM Studio 模型；工作條目已如實標記，但 FR-021 完成前必須補測。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - fake OpenAI-compatible 核心整合確認 `/api/ai/settings`、`/api/ai/models`、`/api/ai/test`、`/api/ai/capabilities` 與 AI 批次／重試流程可在 loopback、無 Key、無雲端同意下運行，且完整回歸通過。
  - 主要工作條目記錄的瀏覽器操作確認 Ollama 預設 URL、批次 8、免 Key、隱私標示、遠端 URL 安全回落，以及掃描無服務時按鈕恢復；本審查可由 `public/review.js:239-276,403-501` 與 UI 測試交叉核對控制路徑。
  - 獨立 redirect 實測確認 307 可把原始 POST body 從 allowlisted `127.0.0.1` 轉送至 hostname `0.0.0.0`，結果為 `redirectedToNonAllowlistedHost: true`；因此實際運行安全邊界不符合需求。
  - 主機未安裝／未啟動 Ollama 或 LM Studio，沒有真實模型、斷網、取消／恢復及跨平台封裝後操作證據；不得以 fake server 或 source UI 測試替代。

## 綜合判定

- 結論：不通過
- 阻擋問題（若有）：
  1. loopback 免 Key／免雲端同意只驗證初始 Base URL；HTTP client 自動跟隨 redirect 且不驗證每一跳或最終 URL，已實測可將字幕 POST body 導向非 allowlist hostname，違反 FR-021 的外部傳輸安全邊界。
  2. 在修正上述問題前，不得把本輪基礎實作合併或宣稱安全門檻完成；FR-021 的真實 Ollama、LM Studio 與斷網端到端仍是版本完成門檻，但因工作條目已標為開發中，這部分屬未完成驗收而非本次誠信問題。
- 剩餘風險：
  - 真實 Ollama／LM Studio 的 API 版本、模型載入、JSON 穩定性、繁中品質與 context metadata 尚未驗證。
  - Windows／macOS／Electron 封裝後 UI、loopback 連線、取消／恢復及斷網操作尚未驗證。
  - 能力探測只確認固定短字串，不能代表長字幕品質；模型未提供 context metadata 時只能顯示未知。
  - 本機 HTTP 服務本身若被其他本機程序控制，仍可接收字幕；UI 應持續如實揭露「送往本機服務」而非等同絕對無風險。
- 給主要開發代理的具體修正要求（若有）：
  1. 在共用 HTTP transport 禁止自動 redirect，或逐跳驗證 redirect target 仍符合原先授權邊界；對 loopback 免同意請求，任何非 loopback redirect 必須在送出後續請求前拒絕。不要只在收到最終 response 後檢查，因 POST body 屆時已外送。
  2. 加入 301／302／303／307／308 redirect 回歸測試，至少驗證 loopback → 非 loopback 被拒絕且第二個 server 收到 0 次請求；另驗證允許或明確拒絕 loopback → loopback 的既定政策。
  3. 修正後重跑 provider、core、`npm run check` 與 `git diff --check`，並建立 round2 複審。
  4. 後續版本完成前，以真實 Ollama／LM Studio 各一模型補齊探索、能力、字幕建議、人工接受、取消／恢復與斷網端到端，並補 Electron／Windows／macOS 證據。

**本輪「2026-07-28 — 0.48 本機 LLM 基礎支援」round1 獨立審查結論為不通過：Ollama／LM Studio provider、模型探索、能力探測、UI、小批次、無 Key Authorization 省略、cue 契約與 fake server 核心回歸已具基礎證據，但 loopback 免 Key／免雲端同意的 HTTP 請求會自動跟隨重新導向，已實測可把字幕 POST body 從 allowlisted 127.0.0.1 傳至非 allowlist hostname，直接破壞 FR-021 的資料傳送安全邊界；須在 transport 層於送出後續請求前拒絕跨邊界 redirect、補齊 redirect 回歸並完成 round2 複審，且真實 Ollama／LM Studio、斷網與跨平台封裝驗收在完成前仍不得宣稱 0.48 已完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
