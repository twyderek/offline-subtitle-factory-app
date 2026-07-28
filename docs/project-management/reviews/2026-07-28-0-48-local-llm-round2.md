# 獨立審查報告：0.48 本機 LLM 基礎支援

- 審查對象 commit／版本：工作樹基準 `d9ab1c0c72fb0b1950da42a6baa4ebcc237b903d`／`0.48.0`，分支 `codex/0.48-local-llm`；複審包含 2026-07-28T11:17:14+08:00 前可見的未提交完整差異與 round1 後 redirect 修正。
- 對應 08-CHANGE-LOG 條目：2026-07-28 — 0.48 本機 LLM 基礎支援
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-07-28（Asia/Taipei）；同一獨立審查角色的新一輪複審，只依目前工作樹、round1 報告、需求／設計／工作條目與自行執行的測試判定，未採用主要代理對修正結果的主觀評價。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - FR-021 位於 `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37`，基礎需求包含 Ollama／LM Studio、精確 loopback、模型探測、無 Key／無雲端同意、隱私標示、小批次、cue 契約與不得自動下載；最終門檻另包含兩種真實模型及斷網端到端。
  - 目前 provider、API、UI、模型探索、能力探測與 fake server 端到端基礎均已實作；`docs/project-management/08-CHANGE-LOG.md` 最新條目維持「進行中」，並明確揭露真實模型、斷網、Electron 與跨平台尚未驗收。
  - round1 要求的 redirect 傳輸政策與回歸已補齊；但 FR-021 最終真實模型及斷網驗收尚未完成，因此本輪只能對「基礎實作」有條件放行，不能把 0.48 判為完成或發布候選。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `lib/ai/openai-compatible.mjs:31-50` 仍只允許精確 loopback 在無 Key 時建立請求，且無 Key 時完全省略 Authorization。
  - `lib/ai/openai-compatible.mjs:39-59` 現對所有共用 AI transport 請求設定 `redirect: 'manual'`，遇到 301／302／303／307／308 立即丟出 `AiProviderError`，`code` 為 `redirect_blocked` 且 `retryable` 為 false。
  - 此政策在送出下一跳前停止，不依賴最終 `response.url`，因此不會發生「檢查時 body 已外送」的時序錯誤；也一致套用於帶 Key 的雲端 provider，避免憑證或 request body 因 redirect 進入未核准端點。
  - 2026-07-28T11:16+08:00 獨立實際測試 loopback `127.0.0.1` 回覆 307 並導向另一個 `127.0.0.1` listener，輸出 `{"code":"redirect_blocked","retryable":false,"status":307,"sinkHits":0}`；確認目前明確政策為「包含 loopback→loopback 在內的所有 redirect 均拒絕」，且實際第二站零送達。
  - round1 的跨資料邊界阻擋已解除，未發現新的邏輯阻擋問題。

## 3. 邊界情況

- 判定：通過（基礎實作範圍）
- 證據：
  - `scripts/test-ai-providers.mjs:45-65` 覆蓋 Ollama／LM Studio 無 Key、Authorization 省略、IPv4／IPv6、惡意 localhost 子網域、遠端 Ollama 無 Key拒絕、context metadata 有／無與非 JSON。
  - `scripts/test-ai-providers.mjs:67-80` 逐一測試 301、302、303、307、308，斷言 transport 使用 manual redirect、錯誤碼為 `redirect_blocked`、不可重試，且 fetch 呼叫數保持一次。
  - `scripts/test-core.mjs:21-46,255-260` 以兩個真實 listener 驗證 127.0.0.1 起點回 307、目標 hostname 為 `0.0.0.0` 時 API 回 422 且第二站收到 0 次請求。
  - 本審查另補做真實 listener 的 loopback→loopback 307，第二站同樣 0 次，確認程式行為與「全面拒絕 redirect」政策一致。
  - cue ID／數量／順序／時間碼、重試、checkpoint 及取消仍由既有 optimizer／core 回歸覆蓋，redirect error 不會被分類為可重試。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - redirect 政策位於共用 `requestAiJson` transport，所有 OpenAI-compatible、Ollama、LM Studio、OpenAI、Groq、Gemini compatible 與 Azure 共用路徑均受保護，沒有只在 UI 或單一路由修補。
  - `AiProviderError` 沿用既有錯誤分類欄位，新增的 `redirect_blocked` 明確、不可重試，可被上層一致顯示與停止。
  - 測試同時具純 provider contract 與真實 socket 核心整合，避免只檢查 source 字串。
  - 非阻擋建議：`lib/ai/openai-compatible.mjs:93` 的 `isLoopbackAiUrl` import 仍置於檔尾，雖合法且所有語法／回歸通過，後續可移至檔首以提升依賴可讀性。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-28T11:15+08:00 在允許本機 listener 的環境執行 `node scripts/test-ai-providers.mjs && node scripts/test-core.mjs && npm run check && git diff --check`，全部通過。
  - 完整 `npm run check` 輸出包含治理文件、語法、preflight、授權、validator、媒體、雙語、品質、Whisper metadata、AI optimizer、provider、review UI 與 core 回歸。
  - 五種 redirect contract、實際跨 hostname 307 零送達，以及本審查額外 loopback→loopback 307 零送達共同覆蓋 round1 阻擋。
  - 尚未覆蓋真實 Ollama／LM Studio 模型、斷網端到端、Electron renderer 與 Windows／macOS 封裝後操作；這些是 0.48 版本完成條件，故整體測試覆蓋仍只能判定部分通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - fake OpenAI-compatible 核心整合實際通過無 Key／無同意設定、模型列表、連線、模型能力、批次、重試與 checkpoint。
  - 真實 socket redirect 測試確認跨 hostname 與 loopback→loopback 均在第一站停止，第二站 0 次；round1 曾重現的字幕 body 外送行為已無法重現。
  - 工作條目記錄的 source 瀏覽器驗證包含 Ollama 預設 URL、批次 8、免 Key、隱私標示、遠端 URL 回落與掃描失敗按鈕恢復。
  - 主機仍未安裝／啟動 Ollama 或 LM Studio；沒有真實模型、斷網、Electron 或 Windows／macOS 安裝版運行證據，不能以 fake server 或 source 瀏覽器替代。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：round1 的 redirect 資料外送阻擋已解除；本輪基礎實作未發現未處理的合併阻擋問題。
- 剩餘風險：
  - 真實 Ollama 與 LM Studio 各一模型尚未驗證模型探索、能力探測、字幕建議、人工接受、取消／恢復。
  - 尚未在移除外網後重跑完整本機字幕優化。
  - Electron、Windows 與 macOS 封裝後 loopback、UI 與服務相容性尚未驗收。
  - 能力探測只驗證固定短 JSON／繁中字串，不能代表長字幕品質；context metadata 缺失時仍只能標示未知。
  - 全面拒絕 redirect 是偏保守且安全的明確政策；若未來真實服務依賴 redirect，須另立需求、逐跳驗證並重新安全審查，不得直接恢復自動跟隨。
- 給主要開發代理的具體修正要求（若有）：
  1. 可將本輪基礎實作視為 round1 阻擋已解除，但工作條目與 0.48 狀態必須保持「開發中」。
  2. 0.48 完成／發布候選前，依 FR-021 以 Ollama、LM Studio 各一個真實模型完成探索、能力、字幕建議、人工接受、取消／恢復及斷網端到端。
  3. 補齊 Electron、Windows／macOS 封裝後驗收；未取得證據前持續逐項揭露，不得把 `npm run check` 當作實機證據。

**本輪「2026-07-28 — 0.48 本機 LLM 基礎支援」round2 獨立複審結論為有條件通過：共用 AI transport 已以 manual 模式拒絕 301／302／303／307／308，錯誤標示為不可重試的 redirect_blocked；provider contract、兩個真實 listener 的跨 hostname 307 測試及本輪另做的 loopback→loopback 307 測試均確認第二站收到 0 次請求，round1 的字幕 body 跨資料邊界外送阻擋已解除，完整 npm run check 與 git diff --check 亦通過；但真實 Ollama／LM Studio 各一模型、斷網端到端及 Electron／Windows／macOS 封裝後驗收仍未完成，因此只允許基礎實作進入後續開發，不得宣稱 0.48 已完成或可發布。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
