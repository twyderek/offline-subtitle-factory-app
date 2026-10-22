# 第三方元件與授權說明

## 本專案與第三方授權範圍

- 本儲存庫中由專案權利人可合法授權的原創程式碼，採用根目錄 [MIT License](LICENSE)；此授權**不會改變**第三方函式庫、二進位執行檔、語音模型、字型或使用者另行下載元件的授權。
- 安裝包可能包含或下載下列第三方元件；它們各自適用其原有的授權條款。重新散布安裝包前，應核對對應版本與包內附帶的授權檔案及再散布義務。
- 本文件列出主要已知相依元件與來源，**不是完整的軟體物料清單（SBOM）**；實際套件版本與直接／間接相依套件應搭配發行版內容及 package-lock.json 核對。
- v0.52.0 的發行範圍為 macOS Apple Silicon；其他平台請以各自版本 Release 說明為準。

以下列出本專案歷次發行使用的主要第三方元件（版本依各次 Release 而異）：

## Electron

- 專案：https://www.electronjs.org/
- 授權：MIT License

## FFmpeg 8.1.2 Essentials Build

- 上游：https://ffmpeg.org/
- Windows build：https://www.gyan.dev/ffmpeg/builds/
- macOS arm64 build：https://ffmpeg.martin-riedl.de/
- 授權：依發行包所附授權條款；Windows 版內容位於 `tools/ffmpeg/LICENSE`，macOS 版內容位於 `tools/ffmpeg/LICENSE-macos`。

## whisper.cpp 1.9.1

- 專案：https://github.com/ggml-org/whisper.cpp
- 發行包：https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.1
- 授權：MIT License
- Copyright (c) 2023-2026 The ggml authors

## Whisper ggml-tiny 多語模型

- 模型來源：https://huggingface.co/ggerganov/whisper.cpp
- 原始模型：https://github.com/openai/whisper
- 模型用途：安裝後可立即進行本機離線轉錄，不需另行下載。

## Busboy

- 專案：https://github.com/mscdex/busboy
- 授權：MIT License

## Google YouTube API client（選用 YouTube 私人上傳）

- `@googleapis/youtube`：https://github.com/googleapis/google-api-nodejs-client
- `google-auth-library`：https://github.com/googleapis/google-auth-library-nodejs
- 授權：Apache License 2.0；完整授權隨各 npm 套件附帶。
- 只有使用者主動連結頻道並同意上傳時，才把選取的 MP4、已保存 SRT 與影片資訊傳送到 Google／YouTube。離線字幕處理不會自動上傳影音。
