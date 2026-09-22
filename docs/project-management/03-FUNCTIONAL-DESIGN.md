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
| AI provider | `lib/ai/providers.mjs`、`openai-compatible.mjs`、`anthropic.mjs`、`local-ai.mjs` | 供應商差異、loopback 安全分類、本機服務探測、HTTP、逾時、取消與錯誤正規化 |
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

macOS arm64 的第一次 Whisper.cpp 執行預設使用 Metal；child process 若回報明確的非零整數 exit code，或由 `SIGSEGV` 等非空 termination signal 結束，server 會記錄 `Metal exit <code>` 或 `Metal signal <name>`、刪除該次 partial SRT／JSON，並只以 `--no-gpu` 進行一次 CPU retry。exit 0、缺少有效 exit／signal 資訊、已在 CPU retry、其他平台或架構不進入此 fallback；CPU retry 再失敗時不會遞迴第三次，會先刪除固定 `whisper-cpp-output.srt`／`.json` 與該次 quality metadata，再讓任務維持 failed 並保存 CPU exit／signal reason。acceptance probe 同時辨識非零 exit 與 termination signal marker，不把正常 Metal 完成或只有單一 marker 的執行誤判為 fallback。

CPU retry child 已啟動時收到取消，沿用 Whisper.cpp 的取消生命週期：先進入 `running/cancelling`，等待 child 關閉後清除暫存音訊、固定 partial SRT／JSON 與 quality metadata，最後進入 `cancelled`；非 ASR 工作檔保留，不啟動第三個 child。Metal 失敗 callback 內清理與 CPU 啟動是同一事件迴圈中的同步路徑，外部 API 無法插入該 callback 內的毫秒窗口；目前 deterministic 整合證據只覆蓋 CPU child 已就緒後的取消。

production-mode hybrid acceptance 使用只對首次 Metal 嘗試注入 exit 139／partial outputs 的隔離工具 wrapper，CPU retry 則以產品原有 `--no-gpu` flags 委派真實 bundled `whisper-cli`／Tiny；透過兩次 invocation、CPU child exit、輸出與清理確認非測試模式 server 控制流和實際 CPU runtime 可銜接。驗收 evidence 同時記錄可重播命令及 macOS arm64／本機子程序與 loopback 權限前提（`docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback-replay.json`）。此工具只用於本機驗收，不放入產品 runtime，也不代表 bundled Metal 自身曾在同次 run 崩潰；真實 Metal failure→CPU 門檻維持未完成。

hybrid bundled CPU 取消探針沿用上述 production server 與隔離 wrapper，但輸入改為本機合成 60 秒 WAV；wrapper 在真實 bundled CPU child 的 spawn 事件寫 ready marker，探針確認任務仍 running／CPU 後才注入固定 partial SRT／JSON、quality metadata 與非 ASR edit plan 哨兵並呼叫取消 API。wrapper 轉送 SIGTERM，記錄真實 child 的 close signal，短暫延後自身 exit 以觀察 `running/cancelling`；server 在 wrapper close 後才轉 `cancelled` 並清理 ASR 哨兵，保留 edit plan。探針 server 另以獨立 process group 啟動：取消 API／等待失敗時先嘗試 API 取消，再以 SIGTERM、有界等待、必要時 SIGKILL 回收整組程序；確認 group 消失後才刪隔離暫存，若無法確認則保留暫存並將 cleanup failure 寫入 evidence。`--simulate-cancel-api-loss` 會在 CPU spawn 後故意跳過 API，驗證失敗收尾，預期 probe 本身 exit 1、但 `expectedFaultSafelyHandled=true`。此驗收只證明 wrapper 轉送訊號路徑中的 bundled CPU 取消；probe 注入的 partial 檔不是 CLI 自行產生，也不證明 server 直接向 bundled CLI 發訊號或 bundled Metal 自身 crash。正常與故障注入證據分別為 `docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-final.json`、`docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-api-loss-final.json`；round2 獨立複審通過。

Small 過長 cue 正規化（BUG-024）：Small 的 Whisper SRT 在寫入 `draft.srt` 前使用同一個 sanitizer 將超過 20 字元的行換成最多兩行；完整 cue 超過 40 字元時，優先依標點／空白拆成多個連續 cue，再依各片段字數比例分配原始時間區間。文字不截斷、不摘要，跨行／跨 cue 的英文分隔空白保留為格式分隔；每個新 cue 必須維持嚴格遞增時間碼。若原始時間不足以安全分配，保留單一 cue、最多兩行並留下可追蹤計數，不製造零長度字幕；此極端情況允許第二行超過 20 字元，以避免拆斷英文單字。Tiny／Base 與既有呼叫預設不啟用此政策。拆分來源 cue 不附原始 JSON segment 的不精確對應，但未拆分 cue 仍保留可取得的 engine metadata；拆分 cue 由校閱頁既有 rule-score 重新判讀。

### Whisper 高階模型下載資料流（FR-023）

首頁模型管理與任務表單共用 `/api/whisper-models` 狀態；選擇未安裝的 Base／Small 時，前端顯示模型大小、來源與「下載並安裝」確認。POST `/api/whisper-models/:model/download` 只啟動固定白名單下載，GET 同一路徑回傳進度，DELETE 同一路徑以 AbortController 中止背景下載；任務提交前再次查詢狀態，避免健康檢查快取過期造成缺檔任務。伺服器不接受任意 URL，下載 response 需通過 HTTP 成功、大小上限／預期大小與 SHA-256，並以暫存檔完成後 rename；取消、HTTP、超時、內容長度或 hash 錯誤均回報可採取行動訊息並刪除暫存檔。

### Breeze ASR 25 實驗性轉錄（FR-024）

Breeze ASR 25 是獨立的 ASR 引擎選項，不加入 Whisper.cpp `tiny`／`base`／`small` 模型白名單，也不把 Breeze ASR 26 台語模型混入一般繁中流程。首頁選擇 Breeze 後停用 Whisper.cpp 模型欄位，改查詢 `/api/breeze-asr`；未安裝時共用模型下載對話框，但下載端點固定為 `/api/breeze-asr/download`，不接受前端 URL、檔名、大小或 hash。

模型來源固定為 MediaTek Research 官方 Hugging Face revision `cffe7ccb404d025296a00758d0a33468bec3a9d0` 下的 patched Whisper checkpoint，檔名 `breeze-asr-25.pt`、大小 3,087,008,569 bytes、SHA-256 `9c94a3554ff4f0de83494e2ed7ba5826efa74bd87955c034b4d0fd681746b690`。下載沿用暫存檔、串流 hash、大小上限、取消、Windows 原子置換與失敗清理契約，存入 Electron `userData` 模型快取，不寫入 repo 或安裝目錄。

執行路徑使用外部 Python 與 MediaTek 官方 patched Whisper CLI；健康檢查不是只驗證 `import whisper`，而是執行能力探針確認 `whisper.available_models()` 包含 `breeze-asr-25`。模型與 runtime 任一缺失時，任務在音訊推論前進入可採取行動的失敗／等待狀態，不允許 patched CLI 自行從未固定的 `main` 下載。模型有效時以 `python -m whisper <audio> --model breeze-asr-25 --model_dir <cache>` 執行，沿用 16 kHz 音訊、CPU／CUDA、beam preset、取消、SRT 清理與後續規則／人工校閱。由於本輪不封裝 Python、PyTorch 或 patched Whisper，UI 必須明示這是需另裝官方 runtime 的實驗功能；Whisper.cpp 仍為預設與可回復路徑。

首次選取 Breeze 時，UI 立即查詢模型與 runtime；模型缺件會開啟固定官方模型下載對話框，下載完成且驗證成功後若 runtime 缺件則接續開啟安裝指引。使用者取消下載或切回 Whisper.cpp 都不會建立 Breeze 任務。runtime 缺件時，UI 提供可操作的官方安裝指引：使用 `git clone --recurse-submodules` 取得 patched Whisper submodule，將 venv 放在使用者家目錄，並分別提供本專案開發版與 macOS／Windows 預設安裝版的啟動命令。指引不會在 App 內執行 clone、pip 或任意 shell；使用者完成外部安裝並以同一 process environment 設定 `BREEZE_ASR_PYTHON` 後，可按「重新檢查 runtime」。選擇器使用一般產品名稱，experimental／效能與品質限制留在說明與發布文件中。

runtime 探測與首頁健康狀態（BUG-022）

未設定 `BREEZE_ASR_PYTHON` 時，Breeze runtime 探針會依平台尋找使用者家目錄的標準路徑：macOS／Linux 為 `$HOME/Breeze-ASR-25/.venv/bin/python`，Windows 優先 `%USERPROFILE%\\Breeze-ASR-25\\.venv\\Scripts\\python.exe`。外部 patched venv 優先於一般 bundled Python，避免把未安裝 patched Whisper 的通用 Python 誤判為 Breeze runtime；明確設定的 `BREEZE_ASR_PYTHON` 仍具有最高優先權。首頁健康檢查成功後同步更新 FFmpeg、ASR、Whisper 與 GPU 狀態卡片；Breeze 模型存在但 runtime 探針失敗時仍顯示可採取行動的缺件指引，不自動安裝或執行第三方命令。

### Breeze 效能透明化與首次選擇提醒（FR-025）

`/api/breeze-asr` 同步回傳 `performanceReference`，內容包含需求方提供的單一 MacBook Air M3／8 GB 觀察、1 小時 46 分影片約 6 小時（約 `3.4×`）的固定數值、日期與「未保存 profiler／原始音訊」範圍。前端只在選取器外的獨立提示欄位顯示此提醒，不把 experimental 或效能警語混入 `Breeze ASR 25` 產品名稱；提示同時提供切回內建 Whisper.cpp 的建議。此資料是風險揭露與決策輔助，不參與任務排程、不自動改變效能 preset，也不取代真實 runtime／品質／跨平台效能驗收。

### AI 優化流程

使用者啟用與設定 → 測試連線 → 選擇範圍／模式 → 分批傳送字幕文字 → 驗證 cue ID、數量、順序與內容 → 顯示建議 → 使用者接受／略過 → 自動保存。AI 不可修改時間碼或直接覆寫原字幕。

供應商 ID 由後端 provider registry 統一驗證，支援 `openai`、`openai-compatible`、`azure`、`groq`、`gemini`、`anthropic`、`ollama`、`lm-studio`；新 API 輸入非法 ID 會回覆 400，不得無聲回退。各供應商的 profile、runtime key 與磁碟 secret 以 ID 隔離；profile 只保存 `baseUrl`、`model`、`deployment`、`apiVersion`、`batchSize` 與 `timeoutSeconds` allowlist 欄位，巢狀 API Key、Authorization、token、secret 或未知欄位不得寫入一般設定。既有 `settings.json` 載入時，AI 根層的 legacy secret-shaped 欄位與 profile 非 allowlist／未知 provider 會以同目錄暫存檔原子置換清除；合法 profile、非敏感未知 AI 根層欄位與獨立 secrets 保留，歷史明文不會自動匯入 secrets。若一般設定檔無法寫入，runtime 仍只使用正規化後資料並輸出不含秘密值的權限警告。Groq 使用 OpenAI 相容的 models／chat completions 路徑；Gemini 原生 models API 使用 `x-goog-api-key`，優化則依官方 OpenAI 相容介面使用 Bearer 認證與 chat completions 路徑。Anthropic 使用 `/v1/models` 與 `/v1/messages`，以 `x-api-key` 及固定 `anthropic-version` 標頭認證；連線測試只讀 `/v1/models`，避免為驗證產生模型輸出，並依清單回報指定模型是否存在，空清單或缺少指定 ID 均回報不可用。Models API 每頁要求官方最大合法 `limit=1000`；`has_more=true` 時以 opaque `last_id` 作下一頁 `after_id` 並保留順序，缺失／重複游標或超過 100 頁時明確失敗，避免回傳不完整清單或無限請求。正式 optimizer 的 system message 移到 Anthropic `system` 欄位，連續 user／assistant 訊息合併，`max_completion_tokens` 映射為必要的 `max_tokens`，移除 OpenAI 專用 `response_format`、內部 cue metadata，以及共用 optimizer 可能附帶的 `temperature`／`top_p`／`top_k`；後三者依 Anthropic 最新相容性要求由 prompt 與 cue contract 取代，不依模型 ID 分支，避免新模型收到非預設值時回覆 HTTP 400。回應再正規化為 `choices[].message.content`。非 Azure 供應商的 Deployment 與 API Version 欄位必須清空並停用。

Azure OpenAI 使用 deployment URL、`api-version` query 與 `api-key` header；送出 chat completion 前移除 optimizer 內部的 `operation`、`output_language`、cue count／ID 與 model 欄位，避免將內部控制資料當成 Azure 請求 schema。模型能力探測使用 `max_completion_tokens`，不使用舊的 `max_tokens` 參數。

### 0.48 本機 LLM 設計

Provider registry 新增 `ollama` 與 `lm-studio`，兩者均使用 OpenAI-compatible `/models` 與 `/chat/completions` 契約。只有 URL 經標準解析後 hostname 精確為 `localhost`、`127.0.0.1` 或 `::1` 才分類為 loopback；不得以字串前綴判定，避免 `localhost.example.com` 等非本機位址繞過雲端同意與金鑰門檻。

本機服務探測只請求固定候選端點，採短逾時並只回傳可連線服務及模型 ID，不掃描任意連接埠。Ollama 預設 `http://127.0.0.1:11434/v1`，LM Studio 預設 `http://127.0.0.1:1234/v1`。使用者仍可保存其他 loopback port；非 loopback URL 一律視為雲端／遠端服務。

loopback 本機 provider 可在沒有 API Key 與雲端資料傳送同意時呼叫；HTTP client 會完全省略 Authorization header。非 loopback 端點維持既有 API Key 與資料傳送同意門檻。本機 provider 預設較小批次，仍沿用 optimizer 的嚴格 cue ID、數量、順序與時間碼保護，所有結果只形成待人工接受的建議。Ollama 若回傳合法但缺少 `cues` wrapper 的單一 cue object，僅可觸發一次結構修復，修復後仍須通過完整 strict validation；其他 provider 不放寬此契約。不自動下載、啟動、停止或刪除模型。

2026-09-15 驗收範圍例外：需求方已刪除本機 LM Studio，因此本輪不做 LM Studio 實機、UI、取消／續跑或斷網驗收；`lm-studio` provider 的產品支援與 deterministic tests 保留，日後若恢復服務仍須依 FR-021 重新取得實機證據。

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
- ASR 子程序取消時先進入 `cancelling`，等待 FFmpeg／Whisper 子程序關閉後才進入 `cancelled`；Unix 以 SIGTERM 後 grace period／SIGKILL 收尾，Windows 以 taskkill tree 收尾，並清理暫存音訊與部分 SRT／JSON，避免背景程序在任務取消後繼續寫檔。

## 設計變更要求

涉及 API、資料格式、磁碟位置、外部傳輸、金鑰、時間碼或安裝資源時，必須在工作紀錄中寫相容性與遷移方案，並在測試稽核中新增對應證據。
