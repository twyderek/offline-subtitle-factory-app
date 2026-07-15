# 下一版修正紀錄

> 建立日期：2026-07-14  
> 目標：修正安裝版 / 免安裝版在非開發機環境下 Python、Whisper 無法正確使用的問題。  
> 原則：逐項完成、逐項記錄，作為下一版發布前查詢依據。

---

## 已知根因

目前 0.20.0 打包版使用 `tools/python-venv`。此 venv 內的 `pyvenv.cfg` 會記錄開發機 Python 絕對路徑，例如 `C:\Users\derek\AppData\Local\Programs\Python\Python313`。換到其他電腦後，此路徑通常不存在，因此安裝版 / 免安裝版會判定 Python 或 Whisper 未正確安裝。

下一版需避免依賴 `whisper.exe` launcher 與開發機 venv 路徑，改為可解析多種工具來源，並使用 `python -m whisper` 或模組匯入方式執行。

---

## 修正紀錄

### 2026-07-14 — 項目 1：建立下一版修正紀錄

- 狀態：完成
- 內容：
  - 建立 `NEXT-VERSION-FIX-LOG.md`
  - 紀錄 Python / Whisper 在安裝版與免安裝版失效的主要根因
  - 設定後續逐項修正的紀錄格式

### 2026-07-14 — 項目 2：重構 server 工具路徑解析

- 狀態：完成
- 修改檔案：
  - `server.mjs`
- 內容：
  - 新增 `resolveToolsInfo()`、`buildToolsInfo()`、`loadToolsManifest()` 等工具解析函式
  - 工具來源不再只固定為 `appDir/tools`
  - 支援 `OFFLINE_SUBTITLE_TOOLS_DIR`
  - 支援 `tools/python/python.exe`、`tools/python-embed/python.exe`、舊版 `tools/python-venv/Scripts/python.exe`
  - 新增 `toolPaths.ffprobe`
  - `/api/health` 與 `/api/bootstrap` 回傳 `toolsInfo`、候選 tools 路徑、manifest 路徑
  - `commandExists()` 支援絕對路徑與 PATH 命令 fallback
- 驗證：
  - `node --check server.mjs` 通過

### 2026-07-14 — 項目 3：Whisper 執行方式改為 `python -m whisper`

- 狀態：完成
- 修改檔案：
  - `server.mjs`
- 內容：
  - `runWhisper()` 不再直接執行 `tools/python-venv/Scripts/whisper.exe`
  - 改為使用解析後的 Python 執行：
    - `python -m whisper <video> ...`
  - PATH 改加入 FFmpeg 與 Python 所在目錄
  - 保留 `PYTHONIOENCODING=utf-8` 與 `PYTHONUTF8=1`，避免中文 Windows 主控台輸出造成編碼錯誤
- 原因：
  - `whisper.exe` launcher 容易綁定建立 venv 時的舊路徑
  - `python -m whisper` 對 portable Python 與正式工具包更穩定
- 驗證：
  - `node --check server.mjs` 通過
  - `PYTHONIOENCODING=utf-8; PYTHONUTF8=1; python -m whisper --help` 通過

### 2026-07-14 — 項目 4：Electron 啟動預檢與 server 執行環境同步

- 狀態：完成
- 修改檔案：
  - `electron/main.mjs`
- 調整內容：
  - Electron 主行程新增與 server 相同概念的 tools resolver。
  - 預檢不再依賴固定的 `tools/python-venv/Scripts/whisper.exe`，改為檢查 `python -c "import whisper; print('ok')"`。
  - server 啟動時會傳入：
    - `OFFLINE_SUBTITLE_TOOLS_DIR`
    - `WHISPER_CACHE`
    - `XDG_CACHE_HOME`
    - `PYTHONIOENCODING=utf-8`
    - `PYTHONUTF8=1`
  - 啟動 PATH 會補入已選 tools 目錄中的 FFmpeg、Python、Node 路徑。
  - 移除 Electron 端對舊固定變數 `bundledNodePath`、`bundledPythonPath`、`bundledFfmpegPath`、`bundledWhisperPath` 的依賴。
- 測試：
  - `node --check electron/main.mjs` 通過
  - `rg "bundled(Node|Python|Ffmpeg|Whisper)" electron/main.mjs` 無殘留

### 2026-07-14 — 項目 5：setup 與手動啟動腳本支援可指定 tools 目錄

- 狀態：完成
- 修改檔案：
  - `scripts/setup-local-tools.ps1`
  - `start-offline-subtitle-factory.ps1`
  - `start-offline-subtitle-factory.bat`
- 調整內容：
  - `setup-local-tools.ps1` 支援 `OFFLINE_SUBTITLE_TOOLS_DIR` 或 `ToolsDirOverride`，可把工具安裝到指定目錄。
  - setup 完成後寫出 `tools/manifest.json`，紀錄工具目錄、已安裝項目、缺少項目與主要執行檔路徑。
  - 手動啟動腳本支援以下 Python 位置：
    - `tools/python/python.exe`
    - `tools/python-embed/python.exe`
    - `tools/python-venv/Scripts/python.exe`（僅保留相容舊開發環境）
  - 手動啟動時會設定 `OFFLINE_SUBTITLE_TOOLS_DIR`、`WHISPER_CACHE`、`XDG_CACHE_HOME`、`PYTHONIOENCODING`、`PYTHONUTF8`。
- 測試：
  - `scripts/setup-local-tools.ps1` parse 通過
  - `start-offline-subtitle-factory.ps1` parse 通過

### 2026-07-14 — 項目 6：新增發版前 runtime 驗證，避免再次包入壞 venv

- 狀態：完成
- 修改檔案：
  - `scripts/verify-runtime-package.mjs`
  - `package.json`
- 調整內容：
  - 新增 `npm run runtime:verify`。
  - `npm run electron:build` 會先執行 runtime 驗證，通過才進入 electron-builder。
  - 驗證正式 runtime 必須存在於：
    - `tools/python/python.exe`
    - 或 `tools/python-embed/python.exe`
  - 若只存在 `tools/python-venv`，或 `pyvenv.cfg` 含開發機絕對路徑，會直接失敗。
  - electron-builder 檔案清單排除 `tools/python-venv/**/*`，避免再次把開發機 venv 打進正式包。
- 測試：
  - `node --check scripts/verify-runtime-package.mjs` 通過
  - `npm run runtime:verify` 依預期失敗，指出目前只有不可發布的 `tools/python-venv`，並偵測到 `pyvenv.cfg` 內含開發機絕對路徑

### 2026-07-14 — 項目 7：健康檢查資訊改為顯示實際 Whisper 執行策略

- 狀態：完成
- 修改檔案：
  - `server.mjs`
- 調整內容：
  - `/api/health` 的 `paths.whisper` 不再顯示舊的 `tools/python-venv/Scripts/whisper.exe`。
  - 改為顯示實際執行策略：`python -m whisper`。
- 測試：
  - 臨時啟動 source server，呼叫 `/api/health`。
  - 回傳確認：
    - `ready=true`
    - `canProcessJobs=true`
    - `tools.python=true`
    - `tools.whisper=true`
    - `paths.whisper="python -m whisper"`

### 2026-07-14 — 項目 8：建立正式可攜 Python runtime 並同步到 win-unpacked

- 狀態：完成
- 產出目錄：
  - `tools/python`
  - `APP-PROJECT/dist/win-unpacked/resources/app/tools/python`
- 調整內容：
  - 以本機 Python 3.13 runtime 建立 `tools/python`。
  - 將現有 venv 中 Whisper / Torch 等必要 site-packages 匯入 `tools/python/Lib/site-packages`。
  - source 與 `win-unpacked` 皆建立 `tools/manifest.json`，紀錄 bundled portable Python 策略與主要工具路徑。
  - `tools/python-venv` 保留為開發相容 fallback，但正式 build 已排除，不再作為發版 runtime。
- 測試：
  - source：
    - `tools/python/python.exe --version` 通過，版本為 Python 3.13.14。
    - `tools/python/python.exe -c "import whisper"` 通過。
    - `tools/python/python.exe -m whisper --help` 通過。
    - `npm run runtime:verify` 通過。
  - `win-unpacked`：
    - `tools/python/python.exe -c "import whisper"` 通過。
    - `tools/python/python.exe -m whisper --help` 通過。
    - `npm run runtime:verify` 通過。
    - 臨時啟動 server 呼叫 `/api/health`，確認：
      - `ready=true`
      - `canProcessJobs=true`
      - `tools.python=true`
      - `tools.whisper=true`
      - `paths.python` 指向 `resources/app/tools/python/python.exe`
      - `paths.whisper="python -m whisper"`

### 2026-07-14 — 項目 9：Electron 免安裝 exe 實際啟動驗證

- 狀態：完成
- 測試目標：
  - `APP-PROJECT/dist/win-unpacked/離線字幕工廠.exe`
- 測試內容：
  - 啟動免安裝 exe。
  - 等待 Electron 啟動 server。
  - 呼叫 `/api/health` 驗證工具狀態。
  - 測試後關閉本次啟動的 Electron 與 bundled node 程序。
- 測試結果：
  - server port：`8790`
  - `ready=true`
  - `canProcessJobs=true`
  - `tools.python=true`
  - `tools.whisper=true`
  - `paths.python` 指向 `APP-PROJECT/dist/win-unpacked/resources/app/tools/python/python.exe`
  - `paths.whisper="python -m whisper"`

### 2026-07-14 — 項目 10：避免 portable runtime 誤進 Git 版本庫

- 狀態：完成
- 修改檔案：
  - `.gitignore`
- 調整內容：
  - 新增忽略：
    - `tools/python/`
    - `tools/python-embed/`
    - `tools/manifest.json`
  - 保留本機與 `win-unpacked` 的實體 runtime，但避免 portable Python、模型與工具包被誤提交到 GitHub。
- 測試：
  - `git status --short` 不再列出整個 `tools/` runtime 目錄。

### 2026-07-14 — 項目 11：打包前納入下一版修正紀錄

- 狀態：完成
- 修改檔案：
  - `package.json`
- 調整內容：
  - electron-builder `files` 清單新增 `NEXT-VERSION-FIX-LOG.md`。
  - 確保正式成品內可查詢本輪 Python / Whisper runtime 修正與檢測紀錄。
- 測試：
  - 打包前 runtime 驗證已通過，確認可進入正式 build。

### 2026-07-14 — 項目 12：0.20.0 Windows 打包與成品檢測

- 狀態：完成
- 打包指令：
  - `npm run electron:build`
- 產出檔案：
  - `APP-PROJECT/dist/離線字幕工廠 Setup 0.20.0.exe`
  - `APP-PROJECT/dist/離線字幕工廠 0.20.0.exe`
  - `APP-PROJECT/dist/win-unpacked`
- 檢測內容：
  - source 語法檢查：
    - `node --check server.mjs`
    - `node --check electron/main.mjs`
    - `node --check scripts/verify-runtime-package.mjs`
  - source runtime：
    - `npm run runtime:verify` 通過
    - `tools/python/python.exe -c "import whisper"` 通過
    - `tools/python/python.exe -m whisper --help` 通過
  - 成品 `win-unpacked/resources/app`：
    - `tools/python/python.exe` 存在
    - `tools/python-venv/pyvenv.cfg` 不存在
    - `node scripts/verify-runtime-package.mjs` 通過
    - `tools/python/python.exe -c "import whisper"` 通過
    - `tools/python/python.exe -m whisper --help` 通過
  - 成品 exe 啟動：
    - 啟動 `APP-PROJECT/dist/win-unpacked/離線字幕工廠.exe`
    - 呼叫 `/api/health`
    - `ready=true`
    - `canProcessJobs=true`
    - `tools.python=true`
    - `tools.whisper=true`
    - `paths.python` 指向 `APP-PROJECT/dist/win-unpacked/resources/app/tools/python/python.exe`
    - `paths.whisper="python -m whisper"`
    - `venvExists=false`
- 結論：
  - 已解決先前安裝/免安裝模式下 Python 與 Whisper 指向開發機 venv、導致使用者端顯示未安裝或缺少 ASR 的問題。
  - 成品未簽章，electron-builder 顯示 no signing info，屬目前既有打包條件。
