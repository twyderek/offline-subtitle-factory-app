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
  └─ 選用 AI adapters（lib/ai/）→ 使用者設定的外部服務
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
| AI provider | `lib/ai/providers.mjs`、`openai-compatible.mjs` | 供應商差異、HTTP、逾時、取消與錯誤正規化 |
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

### AI 優化流程

使用者啟用與設定 → 測試連線 → 選擇範圍／模式 → 分批傳送字幕文字 → 驗證 cue ID、數量、順序與內容 → 顯示建議 → 使用者接受／略過 → 自動保存。AI 不可修改時間碼或直接覆寫原字幕。

供應商 ID 由後端 provider registry 統一驗證，支援 `openai`、`openai-compatible`、`azure`、`groq`、`gemini`；新 API 輸入非法 ID 會回覆 400，不得無聲回退。各供應商的 profile、runtime key 與磁碟 secret 以 ID 隔離。Groq 使用 OpenAI 相容的 models／chat completions 路徑；Gemini 原生 models API 使用 `x-goog-api-key`，優化則依官方 OpenAI 相容介面使用 Bearer 認證與 chat completions 路徑，保留 optimizer 預期的 `choices[].message.content` 回應契約。非 Azure 供應商的 Deployment 與 API Version 欄位必須清空並停用。

### 多語言 LLM 流程

設定介面提供繁中、英文、日文、韓文、西班牙文、法文、德文、巴西葡萄牙文、越南文、泰文與印尼文，也允許輸入自訂 BCP 47 標籤；簡體中文不列入介面或 AI 輸出語言選單。前端只負責選擇；伺服器會驗證並標準化語言標籤，設定檔及每次 AI 任務保存同一標準值。Prompt 只使用驗證後的標籤與內建名稱，避免把自由文字插入 system prompt。`translate` 模式明確要求完整翻譯，其他模式亦要求輸出為所選目標語言。既有設定缺少語言或含舊版無效值時回退 `zh-TW`，但新 API 輸入無效值會回覆 400；既有 `appLanguage: zh-CN` 亦視為不再支援值並回退繁中。自訂 BCP 47 API 的 `zh-CN` 相容性仍由 FR-013 的標準化規則處理。

### 0.46 雙語字幕設計

每個 cue 的正規模型包含 `id`、`start`、`end`、`sourceText`、`translatedText`，並保留相容性的 `text`（等於 `translatedText || sourceText`）。載入單語 SRT 時，`sourceText` 與 `translatedText` 都填入原字幕文字；保存雙語校閱包時另存 `bilingual-cues.json` 與排列設定，`reviewed.srt` 則保存目前排列後的可播放／可匯入表示。

校閱頁以兩個 textarea 分別編輯原文與譯文，排列設定只影響預覽與輸出，不改變 cue 數量、ID 或時間碼。SRT／VTT 使用雙行 cue 文字；ASS 使用 `\\N` 換行並清除可能破壞 ASS 結構的 `{}`，硬字幕沿用同一份 ASS。

### 發布流程

來源與版本確認 → runtime 準備及 hash 驗證 → `npm run check` → 平台打包 → 封裝內容／簽章／SHA 驗證 → 獨立審查 → Release notes 與資產上傳 → 發布後 digest 與下載核對。

## 錯誤處理原則

- 使用者輸入錯誤回傳可採取行動的訊息，不洩漏 secrets 或內部 stack。
- 外部 AI 的 408、429、5xx、逾時與網路錯誤可按上限退避重試；永久錯誤立即停止。
- 媒體／字幕處理失敗不得標記成功；保留原檔與可診斷資訊。
- 取消、interrupted、failed、completed 狀態必須可區分。

## 設計變更要求

涉及 API、資料格式、磁碟位置、外部傳輸、金鑰、時間碼或安裝資源時，必須在工作紀錄中寫相容性與遷移方案，並在測試稽核中新增對應證據。
