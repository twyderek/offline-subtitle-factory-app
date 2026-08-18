# 專案功能設計

## 系統邊界

```text
Electron 主行程
  ├─ 啟動與預檢本機 Node server
  ├─ 視窗、選單、檔案與 OS 整合
  └─ 使用者資料目錄與 bundled resources

瀏覽器 UI（public/） ←HTTP→ server.mjs
  ├─ 專案／任務／校閱／修剪
  ├─ 媒體與字幕 API
  ├─ FFmpeg / FFprobe / Whisper.cpp
  └─ 選用 AI adapters（lib/ai/）→ loopback 本機 LLM 或使用者設定的雲端服務
```

## 主要模組

| 模組 | 主要檔案 | 責任 |
|---|---|---|
| Electron shell | `electron/main.mjs`、`preload.*` | 啟動、預檢、視窗、選單、資料路徑與本機服務生命週期 |
| 本機 API | `server.mjs` | HTTP API、任務狀態、檔案驗證、媒體／字幕工作協調 |
| 首頁／任務 | `public/index.html`、`public/app.js` | 建立、匯入、任務管理、健康狀態 |
| 修剪 | `public/trim.*`、`lib/media-edit.mjs` | In/Out、有效媒體、非破壞輸出與時間重算 |
| 校閱 | `public/review.*`、`public/bilingual-subtitles.mjs` | 播放同步、原文／譯文個別編輯、時間編輯、狀態、排列預覽、樣式與輸出 |
| 字幕時間軸 | `lib/subtitle-timeline.mjs` | cue 時間計算與邊界處理 |
| AI provider | `lib/ai/providers.mjs`、`openai-compatible.mjs`、`local-ai.mjs` | 供應商差異、loopback 安全分類、本機服務探測、HTTP、逾時、取消與錯誤正規化 |
| AI optimizer | `lib/ai/subtitle-optimizer.mjs` | Prompt、批次、回應驗證、建議、重試、checkpoint |
| AI languages | `lib/ai/languages.mjs` | BCP 47 驗證、標準化、常用語言名稱與不可注入的 Prompt 指令 |
| AI settings migration | `server.mjs`、`scripts/test-core.mjs` | 載入設定時檢查 provider 與 Base URL／model 一致性；只遷移可辨識的 legacy Gemini／OpenAI-compatible 混用值 |
| 打包／runtime | `package.json`、`scripts/*runtime*`、`after-pack.cjs` | 固定 runtime、manifest、hash、平台封裝與驗證 |

## 主要資料

- `jobs/<job-id>/`：輸入、草稿、校閱結果、輸出、manifest 與任務狀態。
- `config/`：一般設定、規則、Prompt、術語與 AI checkpoint。
- secrets：與一般設定分離，檔案權限限制；API 僅回傳是否存在，不回傳原文。
- `.osfp`：專案檔；不得假設來源影音永遠位於相同絕對路徑。

## 核心流程

### 離線字幕流程

匯入影音 → FFprobe →（選用）修剪 → Whisper.cpp → 規則處理 → 人工校閱 → SRT/VTT／硬字幕／軟字幕。

### Whisper 多模型模式（FR-022）

離線轉錄使用固定白名單模型設定：`tiny`（快速，既有預設）、`base`（平衡）與 `small`（精準）。任務設定保存 `modelName` 的正規化值；空值與舊任務維持 `tiny` 相容。後端只接受白名單值，依目前平台 runtime manifest 解析對應模型檔，不接受使用者提供的任意路徑。模型檔存在性、最小大小與 manifest SHA-256 必須先通過，否則任務以可採取行動的錯誤失敗，不產生假成功字幕。

三個模型共用既有 whisper.cpp CLI、SRT／JSON 輸出、quality metadata 容錯解析、取消與 Metal→CPU fallback。正式安裝包只內建 tiny；Base／Small 缺失時，UI 在首次選擇或提交任務前提供官方固定來源下載確認，也保留手動匯入／下載說明。下載來源使用 pinned revision、固定檔名、預期大小與 SHA-256，寫入 Electron `userData` 下的可寫入模型快取，不覆寫安裝包內建檔案；下載先寫暫存檔，校驗成功後原子置換，取消或失敗清理暫存檔。模型狀態由 server API 回報 `missing`／`downloading`／`cancelled`／`installed`／`failed`；缺失或驗證失敗不得建立或啟動 ASR 任務。測試使用 deterministic mock runner 模擬三模型輸出，並以本機 HTTP fixture 驗證下載成功／取消／失敗／校驗與狀態契約，不把 mock 結果宣稱為實際模型品質或跨平台實機驗收。

### Whisper 高階模型下載資料流（FR-023）

首頁模型管理與任務表單共用 `/api/whisper-models` 狀態；選擇未安裝的 Base／Small 時，前端顯示模型大小、來源與「下載並安裝」確認。POST `/api/whisper-models/:model/download` 只啟動固定白名單下載，GET 同一路徑回傳進度，DELETE 同一路徑以 AbortController 中止背景下載；任務提交前再次查詢狀態，避免健康檢查快取過期造成缺檔任務。伺服器不接受任意 URL，下載 response 需通過 HTTP 成功、大小上限／預期大小與 SHA-256，並以暫存檔完成後 rename；取消、HTTP、超時、內容長度或 hash 錯誤均回報可採取行動訊息並刪除暫存檔。

### Breeze ASR 25 實驗性轉錄（FR-024）

Breeze ASR 25 是獨立的 ASR 引擎選項，不加入 Whisper.cpp `tiny`／`base`／`small` 模型白名單，也不把 Breeze ASR 26 台語模型混入一般繁中流程。首頁選擇 Breeze 後停用 Whisper.cpp 模型欄位，改查詢 `/api/breeze-asr`；未安裝時共用模型下載對話框，但下載端點固定為 `/api/breeze-asr/download`，不接受前端 URL、檔名、大小或 hash。

模型來源固定為 MediaTek Research 官方 Hugging Face revision `cffe7ccb404d025296a00758d0a33468bec3a9d0` 下的 patched Whisper checkpoint，檔名 `breeze-asr-25.pt`、大小 3,087,008,569 bytes、SHA-256 `9c94a3554ff4f0de83494e2ed7ba5826efa74bd87955c034b4d0fd681746b690`。下載沿用暫存檔、串流 hash、大小上限、取消、Windows 原子置換與失敗清理契約，存入 Electron `userData` 模型快取，不寫入 repo 或安裝目錄。

執行路徑使用外部 Python 與 MediaTek 官方 patched Whisper CLI；健康檢查不是只驗證 `import whisper`，而是執行能力探針確認 `whisper.available_models()` 包含 `breeze-asr-25`。模型與 runtime 任一缺失時，任務在音訊推論前進入可採取行動的失敗／等待狀態，不允許 patched CLI 自行從未固定的 `main` 下載。模型有效時以 `python -m whisper <audio> --model breeze-asr-25 --model_dir <cache>` 執行，沿用 16 kHz 音訊、CPU／CUDA、beam preset、取消、SRT 清理與後續規則／人工校閱。由於本輪不封裝 Python、PyTorch 或 patched Whisper，UI 必須明示這是需另裝官方 runtime 的實驗功能；Whisper.cpp 仍為預設與可回復路徑。

首次選取 Breeze 時，UI 立即查詢模型與 runtime；模型缺件會開啟固定官方模型下載對話框，下載完成且驗證成功後若 runtime 缺件則接續開啟安裝指引。使用者取消下載或切回 Whisper.cpp 都不會建立 Breeze 任務。runtime 缺件時，UI 提供可操作的官方安裝指引：使用 `git clone --recurse-submodules` 取得 patched Whisper submodule，將 venv 放在使用者家目錄，並分別提供本專案開發版與 macOS／Windows 預設安裝版的啟動命令。指引不會在 App 內執行 clone、pip 或任意 shell；使用者完成外部安裝並以同一 process environment 設定 `BREEZE_ASR_PYTHON` 後，可按「重新檢查 runtime」。選擇器使用一般產品名稱，experimental／效能與品質限制留在說明與發布文件中。

runtime 探測與首頁健康狀態（BUG-022）

未設定 `BREEZE_ASR_PYTHON` 時，Breeze runtime 探針會依平台尋找使用者家目錄的標準路徑：macOS／Linux 為 `$HOME/Breeze-ASR-25/.venv/bin/python`，Windows 優先 `%USERPROFILE%\\Breeze-ASR-25\\.venv\\Scripts\\python.exe`。外部 patched venv 優先於一般 bundled Python，避免把未安裝 patched Whisper 的通用 Python 誤判為 Breeze runtime；明確設定的 `BREEZE_ASR_PYTHON` 仍具有最高優先權。首頁健康檢查成功後同步更新 FFmpeg、ASR、Whisper 與 GPU 狀態卡片；Breeze 模型存在但 runtime 探針失敗時仍顯示可採取行動的缺件指引，不自動安裝或執行第三方命令。

### AI 優化流程

使用者啟用與設定 → 測試連線 → 選擇範圍／模式 → 分批傳送字幕文字 → 驗證 cue ID、數量、順序與內容 → 顯示建議 → 使用者接受／略過 → 自動保存。AI 不可修改時間碼或直接覆寫原字幕。

供應商 ID 由後端 provider registry 統一驗證，支援 `openai`、`openai-compatible`、`azure`、`groq`、`gemini`、`ollama`、`lm-studio`；新 API 輸入非法 ID 會回覆 400，不得無聲回退。各供應商的 profile、runtime key 與磁碟 secret 以 ID 隔離。Groq 使用 OpenAI 相容的 models／chat completions 路徑；Gemini 原生 models API 使用 `x-goog-api-key`，優化則依官方 OpenAI 相容介面使用 Bearer 認證與 chat completions 路徑，保留 optimizer 預期的 `choices[].message.content` 回應契約。非 Azure 供應商的 Deployment 與 API Version 欄位必須清空並停用。

Azure OpenAI 使用 deployment URL、`api-version` query 與 `api-key` header；送出 chat completion 前移除 optimizer 內部的 `operation`、`output_language`、cue count／ID 與 model 欄位，避免將內部控制資料當成 Azure 請求 schema。模型能力探測使用 `max_completion_tokens`，不使用舊的 `max_tokens` 參數。

### 0.48 本機 LLM 設計

Provider registry 新增 `ollama` 與 `lm-studio`，兩者均使用 OpenAI-compatible `/models` 與 `/chat/completions` 契約。只有 URL 經標準解析後 hostname 精確為 `localhost`、`127.0.0.1` 或 `::1` 才分類為 loopback；不得以字串前綴判定，避免 `localhost.example.com` 等非本機位址繞過雲端同意與金鑰門檻。

本機服務探測只請求固定候選端點，採短逾時並只回傳可連線服務及模型 ID，不掃描任意連接埠。Ollama 預設 `http://127.0.0.1:11434/v1`，LM Studio 預設 `http://127.0.0.1:1234/v1`。使用者仍可保存其他 loopback port；非 loopback URL 一律視為雲端／遠端服務。

loopback 本機 provider 可在沒有 API Key 與雲端資料傳送同意時呼叫；HTTP client 會完全省略 Authorization header。非 loopback 端點維持既有 API Key 與資料傳送同意門檻。本機 provider 預設較小批次，仍沿用 optimizer 的嚴格 cue ID、數量、順序與時間碼保護，所有結果只形成待人工接受的建議。不自動下載、啟動、停止或刪除模型。

### 多語言 LLM 流程

設定介面提供繁中、英文、日文、韓文、西班牙文、法文、德文、巴西葡萄牙文、越南文、泰文與印尼文，也允許輸入自訂 BCP 47 標籤；簡體中文不列入介面或 AI 輸出語言選單。前端只負責選擇；伺服器會驗證並標準化語言標籤，設定檔及每次 AI 任務保存同一標準值。Prompt 只使用驗證後的標籤與內建名稱，避免把自由文字插入 system prompt。`translate` 模式明確要求完整翻譯，其他模式亦要求輸出為所選目標語言。既有設定缺少語言或含舊版無效值時回退 `zh-TW`，但新 API 輸入無效值會回覆 400；既有 `appLanguage: zh-CN` 亦視為不再支援值並回退繁中。自訂 BCP 47 API 的 `zh-CN` 相容性仍由 FR-013 的標準化規則處理。

### 0.46 雙語字幕設計

每個 cue 的正規模型包含 `id`、`start`、`end`、`sourceText`、`translatedText`，並保留相容性的 `text`（等於 `translatedText || sourceText`）。載入單語 SRT 時，`sourceText` 與 `translatedText` 都填入原字幕文字；保存雙語校閱包時另存 `bilingual-cues.json` 與排列設定，`reviewed.srt` 則保存目前排列後的可播放／可匯入表示。

校閱頁以兩個 textarea 分別編輯原文與譯文，排列設定只影響預覽與輸出，不改變 cue 數量、ID 或時間碼。SRT／VTT 使用雙行 cue 文字；ASS 使用 `\\N` 換行並清除可能破壞 ASS 結構的 `{}`，硬字幕沿用同一份 ASS。

### 0.47 品質風險設計

`lib/subtitle-quality.mjs` 與 `public/subtitle-quality.mjs` 對 cue 的 `confidence`、`noSpeechProbability`／`no_speech_prob`、時間長度與文字內容做純函式評估。可取得引擎指標時來源標示為 `engine-metrics`；指標缺失時來源為 `rule-score`，不得填入或推導假的 confidence。規則包含低 confidence、高 no-speech、過長、閱讀速度過快、重複文字與疑似專有名詞，輸出可重現的 score 與 reasons。

Whisper.cpp 轉錄會要求 `--output-json` 與 `--output-json-full`，由 `lib/whisper-quality.mjs` 解析可取得的 segment quality 欄位，並以 segment 數量、開始／結束時間及容許誤差對應 SRT cue。JSON 缺失、格式錯誤、數量或時間不一致時不阻斷 SRT 完成，也不寫入偽造品質欄位；只有成功對應且包含有效 engine 欄位時才保存 `working/quality-metadata.json`，供校閱資料載入。

校閱頁的品質篩選只改變顯示與批次選取範圍，不修改 cue；AI request 仍從文字欄位建立，不讀取或上傳影片／音訊。高可信 cue 不會因篩選流程自動改寫，所有 AI 變更仍須人工接受。

### 發布流程

來源與版本確認 → runtime 準備及 hash 驗證 → `npm run check` → 平台打包 → 封裝內容／簽章／SHA 驗證 → 獨立審查 → Release notes 與資產上傳 → 發布後 digest 與下載核對。

## 錯誤處理原則

- 使用者輸入錯誤回傳可採取行動的訊息，不洩漏 secrets 或內部 stack。
- 外部 AI 的 408、429、5xx、逾時與網路錯誤可按上限退避重試；永久錯誤立即停止。
- 媒體／字幕處理失敗不得標記成功；保留原檔與可診斷資訊。
- 取消、interrupted、failed、completed 狀態必須可區分。

## 設計變更要求

涉及 API、資料格式、磁碟位置、外部傳輸、金鑰、時間碼或安裝資源時，必須在工作紀錄中寫相容性與遷移方案，並在測試稽核中新增對應證據。
