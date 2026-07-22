# 偵錯與修改歷程

## 紀錄格式

每個缺陷記錄：`BUG-ID`、日期／版本、現象、影響、重現、根因、修正、驗證、防回歸、剩餘風險。

## 重要既有缺陷

### BUG-001：portable Python／Whisper 綁定開發機路徑

- 現象：換到其他 Windows 電腦後找不到 Python 或 Whisper。
- 根因：venv 與 launcher 保存開發機絕對路徑。
- 修正：改用 bundled Whisper.cpp；runtime resolver、manifest 與 SHA 驗證取代開發機 venv 依賴。
- 防回歸：`verify-runtime-package.mjs` 與平台 runtime 準備腳本。

### BUG-002：Windows 中文檔名亂碼

- 現象：匯入、任務資料或輸出顯示 mojibake。
- 根因：UTF-8 被誤解為 Latin-1／Windows 編碼處理不一致。
- 修正：統一 UTF-8 路徑與回應處理。
- 防回歸：核心測試包含中文檔名案例。

### BUG-003：FFmpeg ASS filter 的 Windows 磁碟機路徑

- 現象：硬字幕輸出因 `C:` 等路徑字元解析失敗。
- 根因：filter 字串中的 Windows 絕對路徑需特殊跳脫。
- 修正：以輸出工作目錄與相對 `subtitle.ass` 執行。
- 防回歸：硬／軟字幕輸出 API 測試。

### BUG-004：Azure GPT-5 不支援 `max_tokens`

- 現象：連線測試回覆要求改用 `max_completion_tokens`。
- 根因：舊 chat completions 參數套用到 GPT-5 部署。
- 修正：0.45.1 改送 `max_completion_tokens`。
- 防回歸：AI provider contract tests 驗證請求參數。

### BUG-005：GPT-5 不接受 `temperature: 0.1`

- 現象：AI 優化在部分 GPT-5 部署回覆 unsupported value。
- 根因：optimizer 固定傳送 0.1。
- 修正：0.45.1 移除固定 temperature，使用模型預設。
- 防回歸：provider／optimizer 測試確認不再傳送不相容值。

### BUG-006：AI 優化面板佔用字幕清單空間

- 現象：未使用 AI 時仍大幅壓縮右側校閱區。
- 根因：AI 控制區始終展開。
- 修正：預設精簡、可展開／收合、保存偏好；任務開始時自動展開。
- 防回歸：`test-review-ui.mjs` 驗證狀態、記憶與自動展開。

### BUG-007：Windows 手冊 MP4 被最終 NSIS 過濾

- 現象：`win-unpacked` 有 MP4，但最終 EXE 清單缺少動畫。
- 根因：最終封裝流程未保留 `.mp4` 資產。
- 修正：保持 MP4 內容但使用 `.osfvideo` 資源副檔名，HTML 明確宣告 `type="video/mp4"`。
- 防回歸：workflow 檢查三個資源；發布前以 `7za l` 與 `ffprobe` 交叉驗證。

### BUG-008：GitHub 中文 Windows 資產名稱被簡化

- 現象：中文檔名上傳後變成 `0.45.1.exe`／`Setup.0.45.1.exe`，與 checksum、blockmap、`latest.yml` 不一致。
- 根因：GitHub CLI／Release 對上傳檔名進行平台正規化。
- 修正：Release 使用穩定 ASCII 名稱，更新 checksum，驗證後刪除錯誤重複資產。
- 防回歸：部署文件規定使用 ASCII 發布名稱並在上傳後核對實際名稱。

### BUG-009：AI 輸出語言僅支援三個固定選項

- 現象：設定介面只有繁中、簡中與英文；其他語言無法選擇，未支援值會靜默回退繁中。
- 影響：使用者誤以為指定語言已生效，但 LLM 實際收到 `zh-TW`，造成翻譯或校對語言錯誤。
- 根因：前端選項與 `normalizeAiSettings` 都以三值白名單硬編碼，Prompt 沒有共用語言驗證層。
- 修正：新增 `lib/ai/languages.mjs`，統一 BCP 47 驗證與標準化；UI 增加常用語言及自訂標籤；設定與 AI 任務 API 拒絕無效新輸入；Prompt 只採用驗證後值。
- 防回歸：optimizer、review UI 與 core API 測試覆蓋標準化、自訂語言、舊設定回退及注入型字串拒絕。
- 剩餘風險：LLM 是否完全遵循目標語言仍受供應商模型能力影響，必須由使用者逐段確認建議。

### BUG-010：Groq／Gemini 選項會被後端無聲回退

- 日期／版本：2026-07-22／0.45.2 候選修正。
- 現象：前端可選 Groq 或 Google Gemini，但儲存後供應商回到 `openai-compatible`；切換時可能殘留 Azure 欄位，Gemini 優化回應格式也與 optimizer 契約不一致。
- 影響：使用者看到的供應商與實際執行者不同，profile／API Key 可能落入錯誤供應商槽位，Gemini 優化可能在回應驗證階段失敗。
- 重現：對 `/api/ai/settings` 傳入 `provider: "groq"` 或 `"gemini"`，舊版 `normalizeAiSettings` 僅接受 OpenAI、OpenAI-compatible、Azure，因而回退預設值。
- 根因：供應商清單分散在 HTML、server endpoint 與 adapter；新增 UI／adapter 時未同步後端三處白名單，Gemini adapter 又使用原生回應格式而未符合既有 optimizer 的 OpenAI choices 契約。
- 修正：由 provider registry 匯出共同驗證函式；設定、profile、runtime key 與刪除金鑰 API 明確驗證供應商；Groq／Gemini profile 與 secrets 按 ID 隔離；Gemini 優化改用 OpenAI 相容 chat completions；UI 驗證 provider，非 Azure 欄位清空停用，連線前檢查已保存設定與金鑰。
- 驗證：`test-ai-providers.mjs`、`test-review-ui.mjs`、`test-core.mjs` 與 2026-07-22 本機瀏覽器切換實測通過。
- 防回歸：provider definitions、非法 provider 400、跨 provider 金鑰清除隔離與 UI 切換契約均納入 `npm test`。
- 剩餘風險：尚未使用真實 Groq／Gemini 帳號執行外部 smoke test；既有 0.45.2 候選安裝包未包含本修正，須重新建置與驗證。

## 新缺陷處理

發現新問題先在 `08-CHANGE-LOG.md` 記錄，再於本文件新增 `BUG-ID`。修正不得只寫「已解決」，必須包含可重現證據、根因與防回歸測試；若只能 workaround，須說明移除條件。
# BUG-012 — OpenAI-compatible 顯示 Gemini 舊設定

- 發現版本：0.45.2（2026-07-22）
- 現象：AI 設定服務類型為 `OpenAI-compatible`，但 Base URL 為 `generativelanguage.googleapis.com/...`、模型為 `gemini-3.5-flash`。
- 根因：舊設定的供應商值與 Gemini 的 Base URL／模型被分開保存；載入時供應商回退為 `openai-compatible`，卻未清除不相容的舊欄位。
- 修正方向：0.45.3 載入設定時辨識 Gemini URL／模型與 OpenAI-compatible 的不一致組合，回復 OpenAI-compatible 預設 Base URL／空模型；不刪除 API Key、不修改 Gemini profile。
- 回歸防護：核心 API 測試加入舊 Gemini／OpenAI-compatible 混用資料遷移案例。
- 未覆蓋：目前尚未完成已存在使用者設定檔的實機升級驗證，需於 0.45.3 實機 smoke test 補齊。
