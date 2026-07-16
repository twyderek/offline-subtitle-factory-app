# Windows 11 x64 測試與打包清單

## 1. 建置環境

- Windows 11 x64，建議使用沒有安裝 Python、FFmpeg 或 Whisper 的乾淨帳號。
- 安裝 Git 與 Node.js 22 LTS；使用一般使用者 PowerShell 即可。
- 至少保留 5 GB 建置空間，影片專案空間另計。

```powershell
git clone https://github.com/twyderek/offline-subtitle-factory-app.git
cd offline-subtitle-factory-app
git switch codex/windows-0.30-preview
npm ci
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\prepare-windows-runtime.ps1
npm run check
```

Runtime 準備腳本會下載固定版本的 FFmpeg 8.1.2、Whisper.cpp 1.9.1 與 ggml-tiny 多語模型，逐一驗證 SHA-256；不會安裝 Python，也不會修改系統 PATH。

## 2. 先測試免安裝目錄

```powershell
npm run electron:build:dir
.\..\dist\win-unpacked\離線字幕工廠.exe
```

確認：

- 啟動畫面後顯示 0.30 核定首頁。
- 健康檢查顯示 FFmpeg、Whisper.cpp 與模型可用。
- 選擇影片後可按「先修剪影片」。
- 精準修剪、快速修剪、取消與還原正常。
- 修剪後開始字幕生成，校對頁影片與字幕從 0 秒同步。
- 真實聲波、字幕自動跟隨、SRT／VTT 與硬字幕影片可輸出。
- 關閉 App 後，工作管理員沒有殘留 Electron、FFmpeg 或 Whisper 程序。

## 3. 建立安裝版與 Portable

```powershell
npm run electron:build
```

預期成品：

```text
..\dist\離線字幕工廠 Setup 0.30.0.exe
..\dist\離線字幕工廠 0.30.0.exe
```

## 4. 安裝驗收

- 測試預設路徑、自訂路徑、中文使用者名稱與含空白的專案路徑。
- 確認桌面與開始功能表捷徑、圖示、版本及解除安裝功能。
- 從 0.21 升級至 0.30 時，既有 jobs 與 config 不可被刪除。
- 解除安裝後，使用者專案不得被刪除。
- 在完全離線狀態重新啟動並完成短片轉錄。
- 使用 Windows Defender 掃描 Setup 與 Portable。

## 5. 建議測試影片

- 4 秒 H.264／AAC：保留 1–3 秒，預期約 2 秒。
- 30 秒繁體中文語音影片。
- 目前 11:33 校園影片。
- MP4、MOV、M4V、無音軌、可變幀率及 4K 各一支。

每次完成測試後，請記錄 CPU、記憶體、處理時間、輸出長度誤差、音畫同步、錯誤訊息與 App 日誌。
