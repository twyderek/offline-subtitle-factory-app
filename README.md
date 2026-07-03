# Offline Subtitle Factory App

這是「離線字幕生成規劃專案」的獨立本機 MVP，套用 UI Option 3：教師友善版。

它不會修改原本的 `src/subtitle-editor.html` 或既有字幕流程，所有任務資料都會存放在本資料夾的 `jobs/` 內。

## 快速啟動

### 第一次使用：安裝專案內工具

先雙擊：

```text
setup-local-tools.bat
```

它會把本服務需要的工具集中放到：

```text
tools/
  node/
  ffmpeg/
  python-venv/
  whisper-models/
  _downloads/
```

完成後，本服務啟動與轉錄都會優先使用 `tools/` 內的工具，不再呼叫系統其他位置的 Node、FFmpeg 或 Whisper。

### 一鍵啟動

在檔案總管中雙擊：

```text
start-offline-subtitle-factory.bat
```

它會自動啟動本機服務並開啟瀏覽器。
若 8790 已經有舊服務執行，啟動檔會先停止舊服務再啟動新版，避免進入校閱頁時出現 Not Found。

如果視窗顯示找不到 Project-local Node.js，請先執行 `setup-local-tools.bat`。

### 命令列啟動

```powershell
cd D:\Codex\subtitle-review-loop\offline-subtitle-factory-plan\app
npm start
```

開啟：

```text
http://127.0.0.1:8790
```

## 目前功能

- 上傳影片、規則檔與既有 SRT。
- 填寫字幕生成需求說明。
- 檢查本機 Node、FFmpeg、Python、Whisper 狀態。
- 建立獨立 job folder，保存輸入、工作檔、報告與校閱設定。
- 若提供既有 SRT，會直接產生 `draft.srt` 與 `rule-cleaned.srt`。
- 若本機有 `whisper` CLI 且未提供 SRT，會嘗試使用 Whisper 產生 SRT。
- 完成後可直接進入 `/review/{jobId}` 校閱頁，邊看影片邊修改 SRT。
- 校閱後字幕會儲存到 `jobs/{jobId}/review-output/reviewed.srt`。

## 任務資料夾

```text
jobs/{jobId}/
  input/
  working/
    draft.srt
    rule-cleaned.srt
    correction-report.md
  review-output/
    subtitle-style-settings.json
  output/
  logs/
  job-config.json
  job-status.json
```

## 需要的本機工具

工具會集中安裝到 `tools/`。第一次安裝腳本會下載或建立：

- `tools/node/node.exe`
- `tools/ffmpeg/bin/ffmpeg.exe`
- `tools/python-venv/Scripts/python.exe`
- `tools/python-venv/Scripts/whisper.exe`
- `tools/whisper-models/`

### 常見問題

**Q: 安裝完軟體後開啟，為什麼無法使用轉錄功能？**

A: 第一次開啟時會自動偵測本機環境。如果缺少 Python 或 Whisper，會顯示警告畫面並引導您執行 `setup-local-tools.bat`。請按照提示操作即可。

**Q: 安裝腳本中途失敗了怎麼辦？**

A: 腳本已支援中斷後重新執行。已安裝的工具會被跳過，只需再次執行 `setup-local-tools.bat` 即可繼續安裝剩餘工具。

**Q: 我的電腦沒有安裝 Python 怎麼辦？**

A: 請先執行 `winget install Python.Python.3.12` 安裝 Python，然後再執行 `setup-local-tools.bat`。腳本會自動建立虛擬環境並安裝 Whisper。

Whisper 模型會快取在 `tools/whisper-models/`，避免下載到使用者家目錄或其他外部位置。

## 下一步串接

- 將 `rule-cleaned.srt` 自動帶入字幕校閱頁。
- 將校閱頁輸出的修正字幕與 `subtitle-style-settings.json` 回寫到同一個 job folder。
- 串接 FFmpeg 燒錄字幕與預覽影片輸出。
- 將目前的規則套用占位流程替換為正式 rule runner。
