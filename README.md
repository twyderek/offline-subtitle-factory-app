# 離線字幕工廠

## 0.30.0 影片修剪功能預覽版

此預覽版在核定的深藍側欄首頁與字幕校對工作區上，新增單一區間、非破壞式影片修剪。macOS 版使用內建 Whisper.cpp、Apple Metal、FFmpeg 與多語模型，不需要另外安裝 Python。

離線字幕工廠是供 Windows 10／11 x64 與 Apple Silicon macOS 12 以上版本使用的本機字幕生成、校閱與輸出工具。影片、字幕與任務資料都保存在使用者電腦，不需要連線到雲端字幕服務。

## 安裝版

### macOS Apple Silicon

開啟下列 DMG，將「離線字幕工廠」拖到「應用程式」：

```text
離線字幕工廠 0.30.0 macOS-arm64.dmg
```

另提供 ZIP 版本，可解壓後把 APP 移入「應用程式」。目前成品使用 ad-hoc 本機簽章，未經 Apple 公證；若首次啟動被 Gatekeeper 阻擋，請在 Finder 對 APP 按右鍵並選擇「打開」。

### Windows x64

Windows 0.30 預覽版由 GitHub Actions 在 Windows Server 2022 x64 建置，輸出 NSIS Setup 與 Portable。前往專案的 **Actions → Build Windows 0.30 Preview**，開啟最新成功紀錄後下載 `offline-subtitle-factory-0.30.0-windows-x64` artifact。

目前 Windows 預覽成品尚未使用程式碼簽章憑證，Windows 11 SmartScreen 可能顯示「未知發行者」。請先在測試機驗證檔案雜湊，再由「其他資訊 → 仍要執行」啟動；不建議在完成實機驗收前對外正式發布。

## 不需要自行安裝其他軟體

0.30.0 macOS 預覽包已內建：

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
git switch codex/windows-0.30-preview
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
