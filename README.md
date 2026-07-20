# 離線字幕工廠

## 0.45.2 發布重點

0.45.2 新增多語言 LLM 字幕優化：提供 12 個常用目標語言與自訂 BCP 47 標籤，並統一設定、API 與 Prompt 的語言驗證。

- 翻譯及各種字幕優化模式均使用所選目標語言。
- 舊設定缺少或含無效語言時回退繁中；新的非法值會被 API 拒絕。
- AI 回傳若改變 cue 數量、ID 或順序會被拒絕，時間碼維持鎖定。
- Windows 未簽章、macOS 未公證；尚未完成跨平台乾淨實機測試。

## 0.45.1 發布重點

0.45.1 修正 Azure OpenAI GPT-5 的請求參數相容性，並讓校閱頁的 AI 優化工具可收合，未使用 AI 時可把右側空間完整留給字幕清單。

- Azure 連線測試改用 `max_completion_tokens`，不再傳送 GPT-5 不支援的 `max_tokens`。
- 正式優化請求不再固定傳送 `temperature: 0.1`。
- AI 優化面板預設收合，可手動展開／收合並記住選擇；開始或繼續 AI 任務時會自動展開。
- 新增 GPT-5 請求參數與 AI 面板回歸檢查。

## 0.45.0 發布重點

0.45.0 把 AI 優化推進為完整校閱工作流：支援專案術語表、可重用 Prompt、多段與搜尋結果選取、可稽核 session 報告、一鍵撤銷／重做、作業系統安全金鑰，以及 OpenAI、OpenAI-compatible、Azure OpenAI provider adapter。所有 AI 建議仍須經使用者確認，且 cue 數量與時間碼維持鎖定。

- 分類處理 HTTP 408、429、500、502、503、504、逾時與網路錯誤。
- 可設定最大重試次數及起始等待時間，等待採指數退避與隨機抖動。
- UI 顯示批次、累計重試、等待秒數及恢復按鈕。
- 每個任務保存本機 checkpoint、session ID、進度、部分建議與錯誤狀態。
- APP 意外關閉後會把先前執行中任務標記為 interrupted，允許繼續處理。
- 新增 mock 429、永久失敗與續傳測試，不需使用或消耗真實 AI API。

## 0.40.0 發布重點

0.40.0 新增可選用的 AI 字幕優化工作區。Whisper 轉錄、影片修剪與字幕輸出仍可完全離線使用；只有使用者主動啟用 AI 優化時，字幕文字才會傳送至自行設定的 OpenAI 或 OpenAI-compatible 服務，影片與音訊不會上傳。

- 校閱頁新增錯字標點、斷句、術語統一、移除贅詞與翻譯工具。
- 支援全部字幕或目前字幕、批次處理、進度顯示與取消。
- AI 回傳必須保留 cue ID、順序與段落數；時間碼由程式鎖定，不交由 AI 修改。
- 所有 AI 修改先以建議呈現，可逐項或全部接受／略過，接受後才進入既有自動儲存流程。
- API Key 不會回傳前端或寫入工作日誌；可使用獨立 secrets 檔案或 `SUBTITLE_AI_API_KEY` 環境變數。
- 新增不需外部金鑰的 AI optimizer 回歸測試，並通過完整 `npm test`。

## 0.30.1 發布重點

0.30.1 是 0.30 預覽版的修正版，重點修正校閱畫面字幕樣式預覽與實際 FFmpeg/ASS 燒錄結果的比例落差，並修正 Windows/Electron 匯入中文影片檔名時可能顯示成亂碼的問題。

- 校閱字幕預覽會依照 ASS PlayRes 1920x1080、影片實際顯示尺寸與黑邊偏移縮放字級、外框與垂直邊距，讓 24 字級等設定更接近實際燒錄成品。
- 上傳影片、匯入 SRT、最近專案、review-data 與燒錄輸出檔名會保留正常 UTF-8 中文，並修復 UTF-8 被誤解成 Latin-1 造成的 mojibake。
- 歷史任務列表支援刪除專案；校閱工作區支援載入規則檔後二次套用規則。
- 校閱頁補齊 VTT 下載，並新增字幕段落分割功能，可將過長段落切成兩段後再校閱。
- Windows 正式打包流程改為強制檢查 Code Signing 憑證，打包後驗證 Setup 與 Portable EXE 必須為有效簽章；未設定憑證時請使用 `npm run electron:build:unsigned` 產生內部測試包。
- 已通過 `npm run check`，包含影片修剪資料層測試、核心 API 回歸測試、中文檔名與亂碼檔名、VTT 下載、二次套規則與刪除任務案例。

## 0.30.0 影片修剪功能預覽版

此預覽版在核定的深藍側欄首頁與字幕校對工作區上，新增單一區間、非破壞式影片修剪。macOS 版使用內建 Whisper.cpp、Apple Metal、FFmpeg 與多語模型，不需要另外安裝 Python。

離線字幕工廠是供 Windows 10／11 x64 與 Apple Silicon macOS 12 以上版本使用的本機字幕生成、校閱與輸出工具。影片、字幕與任務資料都保存在使用者電腦，不需要連線到雲端字幕服務。

## 安裝版

### macOS Apple Silicon

開啟下列 DMG，將「離線字幕工廠」拖到「應用程式」：

```text
離線字幕工廠 0.45.2 macOS-arm64.dmg
```

另提供 ZIP 版本，可解壓後把 APP 移入「應用程式」。目前成品使用 ad-hoc 本機簽章，未經 Apple 公證；若首次啟動被 Gatekeeper 阻擋，請在 Finder 對 APP 按右鍵並選擇「打開」。

### Windows x64

Windows 0.45.2 版由 GitHub Actions 在 Windows Server 2022 x64 建置，輸出 NSIS Setup 與 Portable。可從 GitHub 的 `v0.45.2` Release 下載，或前往 **Actions → Build Windows 0.45.2** 取得 `offline-subtitle-factory-0.45.2-windows-x64` artifact。

目前 Windows 預覽成品尚未使用程式碼簽章憑證，Windows 11 SmartScreen 可能顯示「未知發行者」。請先在測試機驗證檔案雜湊，再由「其他資訊 → 仍要執行」啟動；不建議在完成實機驗收前對外正式發布。

## 不需要自行安裝其他軟體

0.45.2 安裝包已內建：

- 完整離線操作手冊：`resources/docs/0.45.2/USER-GUIDE.html`
- 圖文畫面與三段常見問題操作動畫

- Electron／Node 本機服務執行環境。
- FFmpeg 與 FFprobe。
- Whisper.cpp 轉錄引擎；Apple Silicon 版本會使用 Metal 加速，Windows x64 版本使用 CPU。
- Whisper tiny 多語預設模型。

使用者不需要另外安裝 Node.js、Python、Whisper、FFmpeg，不需要執行批次檔，也不會修改系統 PATH。

## 主要功能

- 上傳 MP4、MOV、M4V 等影片。
- 在字幕生成前選擇「先修剪影片」，以 In／Out 把手或時間欄設定單一保留區間。
- 提供精準修剪與快速修剪；所有輸出均為衍生檔，原始影片不會被覆蓋。
- 修剪既有字幕專案時，自動移除範圍外字幕、截短邊界並把時間軸平移至 0 秒。
- 使用內建 Whisper.cpp 進行本機離線轉錄。
- 匯入既有 SRT，略過語音轉錄直接進入規則處理。
- 套用繁體中文、專有名詞、填充詞與自訂取代規則。
- 可選擇連接 OpenAI-compatible API 產生字幕優化建議，使用前由使用者自行設定服務與 API Key。
- 影片播放時自動跟隨右側字幕校閱段落。
- 調整字幕文字、時間與樣式並自動保存。
- 輸出 SRT、硬字幕 MP4 與軟字幕 MKV／MP4。
- 管理歷史任務、專案檔、輸入與輸出資料夾。

## 修剪操作

1. 建立新專案並選擇影片後，按「先修剪影片」；既有專案可由首頁專案卡、任務管理或校對側欄進入「修剪」。
2. 拖曳綠色起點與橘色終點，或直接輸入時間；I 設起點、O 設終點、Space 播放／暫停。
3. 選擇「精準修剪」或「快速修剪」，按「套用修剪」。
4. 完成後按「開始字幕生成」，或進入校對頁繼續處理。

第一版只支援單一連續保留區間，不包含多段剪接、轉場、濾鏡、多軌或素材拼接。快速模式受來源關鍵影格影響，若需要準確邊界請使用精準模式。

## 資料位置

正式 APP 將可變動資料保存到作業系統的使用者資料目錄：

```text
%APPDATA%\離線字幕工廠\
  jobs\
  config\

~/Library/Application Support/離線字幕工廠/
  jobs/
  config/
```

內建 runtime 位於安裝目錄中，APP 會在啟動時自動檢查。若內建元件缺少或損壞，健康檢查會提示重新安裝，不會要求使用者手動安裝套件。

## 開發與測試

### Windows 11 x64

```powershell
git clone https://github.com/twyderek/offline-subtitle-factory-app.git
cd offline-subtitle-factory-app
git switch codex/0.45-ai-workflow
npm ci
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\prepare-windows-runtime.ps1
npm run check
npm run electron:build:dir
npm run electron:build
```

Windows runtime 準備腳本會下載固定版本的 FFmpeg 8.1.2、Whisper.cpp 1.9.1 與 ggml-tiny 多語模型並比對 SHA-256，不會安裝 Python，也不會修改系統 PATH。完整驗收項目請參閱 `WINDOWS-11-TEST-CHECKLIST.md`。

### macOS Apple Silicon

```bash
npm ci
npm run check
npm run electron:build:mac:dir
npm run electron:build:mac
```

`electron:build` 會先建立 runtime manifest、逐一比對 SHA-256，再產生 Windows x64 Setup 與 Portable 安裝檔。

## 第三方元件

授權與來源請參閱 `THIRD-PARTY-NOTICES.md`，FFmpeg 發行包的授權內容保存在 `tools/ffmpeg/LICENSE`。
