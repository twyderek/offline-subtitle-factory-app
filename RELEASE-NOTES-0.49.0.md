# 離線字幕工廠 0.49.0

## 版本重點

- 首次以實驗性選項提供 MediaTek Research Breeze ASR 25，目標使用情境為台灣華語與中英混用字幕；內建 Whisper.cpp 仍為預設。
- Breeze checkpoint 固定使用官方 revision `cffe7ccb404d025296a00758d0a33468bec3a9d0`、檔名 `breeze-asr-25.pt`、大小 3,087,008,569 bytes 與 SHA-256 驗證，不接受任意模型網址或檔案契約。
- Breeze runtime 必須以 `whisper.available_models()` 確認包含 `breeze-asr-25`；模型或 runtime 缺失時不啟動推論、不標記任務成功。
- 新增 `npm run probe:breeze -- --json` 只讀驗收工具，回報固定模型契約、模型狀態與 runtime 能力；缺件時以非零狀態結束，不下載、不安裝、不啟動字幕任務。
- Runtime probe 具 timeout、POSIX process-group／Windows process-tree 終止與 child close 等待；診斷摘要會遮罩本機路徑及 token／secret／password／API Key。
- Breeze 任務沿用既有 16 kHz 音訊準備、取消、SRT 時間碼清理、繁體規則與人工校閱流程。

## 安裝與使用

- 預設 Whisper.cpp Tiny 隨安裝包提供；Base／Small 維持首次使用安全下載。
- Breeze checkpoint 約 2.88 GiB，不納入 DMG、ZIP、Setup 或 Portable。
- Breeze 的 Python、PyTorch 與 MediaTek patched Whisper runtime 不納入安裝包；只有主動選擇 Breeze 的使用者需要依 [Breeze ASR 25 說明](docs/BREEZE-ASR-25.md) 另行安裝。
- App 不會自動執行 `pip install`、clone repository 或修改系統 PATH。

## 平台資產

- macOS arm64：`offline-subtitle-factory-0.49.0-macos-arm64.dmg`、`offline-subtitle-factory-0.49.0-macos-arm64.zip`
- Windows x64：`offline-subtitle-factory-setup-0.49.0.exe`、`offline-subtitle-factory-portable-0.49.0.exe`
- macOS metadata：`latest-mac.yml`、`SHA256SUMS-macos-arm64.txt`
- Windows metadata：`latest.yml`、`SHA256SUMS-windows-x64.txt`、`SIGNING-STATUS-windows-x64.txt`

## 安全與隱私

- 影音與本機轉錄仍保存在使用者電腦；Breeze 模型下載只連線至固定官方模型 URL。
- Probe JSON 僅輸出 executable／模型目錄 basename 與安全診斷摘要，不應包含絕對使用者路徑或 credential 原值。
- Windows 資產未使用 Authenticode；macOS 資產未使用 Apple Developer ID 簽章或公證。下載後請核對 Release 所附 SHA-256。

## 已知限制

- 本版不隨安裝包提供 Breeze runtime 或 checkpoint；只下載模型仍不足以使用 Breeze。
- 發布前 deterministic 測試與缺件 probe 不等同真實 Breeze checkpoint／官方 runtime 已驗收。
- 尚未完成真實台灣華語／中英混用音訊的準確率、字幕對齊、長音訊、CPU／CUDA 效能與記憶體門檻驗收。
- Windows `taskkill /T /F` process tree、兩平台乾淨安裝後 Breeze 流程與真實 checkpoint 下載中斷／磁碟不足仍需實機驗證。
- Breeze 是實驗性選項；重要內容請在校閱頁逐段確認，遇到缺件或效能不符時可切回內建 Whisper.cpp。
