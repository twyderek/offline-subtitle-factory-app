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

### 2026-07-15 — 項目 13：字幕校對清單跟隨影片播放位置

- 狀態：規劃中
- 預計修改檔案：
  - `public/review.js`
  - 必要時調整 `public/styles.css`
- 現況：
  - 影片的 `timeupdate` 事件已能依目前播放時間找出對應字幕。
  - 對應字幕會套用 `active` 樣式，但右側字幕清單不會自動捲動到該段，超出可視範圍時仍需手動操作。
- 規劃內容：
  - 當目前字幕段落變更時，自動將右側清單捲動到對應段落，建議讓該段顯示於清單中央附近。
  - 僅在字幕索引實際改變時觸發捲動，避免每次 `timeupdate` 都重複捲動或造成畫面抖動。
  - 使用平滑捲動；若系統偏好減少動態效果，則改用立即定位。
  - 使用者正在字幕文字欄位中編輯、或主動捲動清單時，暫停自動跟隨，避免播放中的定位干擾校對。
  - 使用者按下字幕的「跳轉」按鈕或恢復跟隨後，重新啟用自動定位。
  - 搜尋篩選啟用且目前字幕未顯示於清單時，不強制捲動，也不清除搜尋條件。
- 建議實作：
  - 在 `setActiveCue()` 取得目前字幕節點後，以 `scrollIntoView({ behavior, block: 'center', inline: 'nearest' })` 定位。
  - 增加自動跟隨狀態與人工操作的暫停／恢復判斷，避免單純強制捲動造成操作衝突。
- 驗收條件：
  - 正常播放、快轉、倒轉與拖曳播放進度時，右側清單能自動顯示對應字幕。
  - 自動跟隨不會在同一字幕段落內持續觸發或造成清單抖動。
  - 使用者編輯或手動捲動字幕時，畫面不會被立即拉回；恢復跟隨後可再次同步。
  - 字幕時間存在空白區段、搜尋篩選無結果或目前沒有對應字幕時，不產生 JavaScript 錯誤。

### 2026-07-15 — 項目 14：補齊任務取消與重新執行 API

- 狀態：完成
- 修改檔案：
  - `server.mjs`
- 調整內容：
  - 新增 `POST /api/jobs/:jobId/cancel`，可取消目前執行中的字幕任務。
  - 新增 `POST /api/jobs/:jobId/retry`，允許失敗、取消或等待處理的任務清理 `working` 暫存後重新執行。
  - 每個執行中任務改為保存 `AbortController` 與 Promise，取消時會向 Whisper 子程序送出終止訊號。
  - 在環境檢查、Whisper 結束及規則清理前加入取消狀態檢查。
  - 任務執行例外會正式寫入 `failed` 狀態，不再形成未處理的 Promise rejection。
  - 重複啟動、無執行中任務、不可重試狀態均會回傳明確 API 結果。
- 驗證：
  - `node --check server.mjs` 通過。
  - `git diff --check` 通過。
  - 已確認前端既有 `/cancel`、`/retry` 呼叫現在有對應後端路由。

### 2026-07-15 — 項目 15：大型影片改用串流上傳

- 狀態：完成
- 修改檔案：
  - `server.mjs`
  - `package.json`
  - `package-lock.json`
- 調整內容：
  - 新增 `busboy` runtime dependency，使用成熟的 multipart 串流解析器。
  - 建立任務與影片資訊探測不再透過 `readRequest()`、`Buffer.concat()` 將整部影片載入 RAM。
  - 上傳內容會直接串流寫入 `.temp-upload` 或 `.temp-probe`，完成後再移入任務輸入目錄。
  - 保留單檔 2GB、最多 4 個檔案及欄位大小限制，超限或上傳中斷時會清理暫存檔。
  - 支援同磁碟直接 rename，以及跨磁碟時 copy 後刪除暫存檔的 fallback。
- 驗證：
  - `node --check server.mjs` 通過。
  - `git diff --check` 通過。
  - 使用臨時資料目錄啟動本機 server，透過 multipart 建立測試任務成功。
  - 以 `cmp` 確認串流後的影片與字幕內容和來源檔完全一致。
  - 確認任務建立完成後 `.temp-upload` 沒有殘留檔案。

### 2026-07-15 — 項目 16：加入字幕任務全域佇列

- 狀態：完成
- 修改檔案：
  - `server.mjs`
  - `public/app.js`
  - `public/styles.css`
- 調整內容：
  - 新增全域字幕處理佇列，預設同時只執行 1 個 Whisper／字幕處理任務。
  - 可透過 `OFFLINE_SUBTITLE_MAX_JOBS` 調整並行上限；無效值會安全回退為 1。
  - 超出並行上限的任務會寫入 `queued` 狀態，顯示前方等待數量。
  - 任務完成、失敗或取消後會自動啟動下一個排隊任務並更新其排序狀態。
  - 支援直接取消尚未開始的排隊任務。
  - 前端新增「排隊中」狀態與樣式，排隊中的任務也可使用中止按鈕。
- 驗證：
  - `node --check server.mjs` 通過。
  - `node --check public/app.js` 通過。
  - `git diff --check` 通過。
  - 靜態確認佇列、並行限制、取消與完成後續跑路徑均已連接。

### 2026-07-15 — 項目 17：強化字幕校對保存、跟隨與快捷鍵

- 狀態：完成
- 修改檔案：
  - `public/review.html`
  - `public/review.js`
- 調整內容：
  - 字幕文字、時間、刪除、合併與全片規則變更後，會延遲 1.5 秒自動保存。
  - 保存期間若又有新編輯，使用版本編號避免誤把新內容標記為已保存，並自動排入下一次保存。
  - 尚未保存或正在保存時關閉頁面，瀏覽器會顯示離開確認。
  - 影片播放到新字幕時，右側清單會平滑捲動到對應段落中央；系統偏好減少動態效果時改為立即定位。
  - 使用者操作字幕輸入欄位或手動捲動清單時，會暫停自動跟隨。
  - 新增「自動跟隨：開／暫停」按鈕，可手動恢復跟隨並立即對齊目前字幕。
  - 新增非編輯狀態快捷鍵：空白鍵播放／暫停、Alt+左右快退／快進 5 秒、Ctrl+上下切換字幕。
- 驗證：
  - `node --check public/review.js` 通過。
  - `git diff --check` 通過。
  - 靜態確認所有字幕內容與時間變更路徑均會標記待保存。

### 2026-07-15 — 項目 18：優化大量字幕的定位與清單渲染

- 狀態：完成
- 修改檔案：
  - `public/review.js`
  - `public/styles.css`
- 調整內容：
  - 播放時間定位先檢查目前、前一段與下一段字幕，大幅跳轉時改用二分搜尋，不再每次從第一段線性掃描。
  - 每段字幕原本各自建立的點擊、輸入與變更監聽器，改為由字幕清單統一事件委派。
  - 搜尋輸入增加 120ms debounce，快速輸入時不會每個按鍵都重建清單。
  - 字幕卡片加入 `content-visibility: auto` 與預估高度，支援的瀏覽器可延後畫面外卡片的 layout／paint。
- 效能影響：
  - 時間定位由最差 O(n) 降為 O(log n)，連續播放通常為 O(1)。
  - 清單監聽器數量由每段約 7 個降為固定 3 個。
  - 長字幕清單的初始繪製與捲動成本降低。
- 驗證：
  - `node --check public/review.js` 通過。
  - `git diff --check` 通過。
  - 已確認字幕卡片不再於 `renderCueList()` 中逐項註冊事件。

### 2026-07-15 — 項目 19：工具檢查快取與任務列表索引／分頁

- 狀態：完成
- 修改檔案：
  - `server.mjs`
  - `public/app.js`
- 調整內容：
  - Node、FFmpeg、Python、Whisper 基礎檢查結果快取 60 秒，並合併同時間的重複檢查 Promise。
  - GPU／Torch 深度檢查結果快取 5 分鐘，避免重複載入 Torch。
  - `/api/health` 與 `/api/bootstrap` 支援 `refresh=1` 強制重新檢查；前端「重新檢查」會使用此參數。
  - 任務摘要列表加入記憶體快取，建立任務、狀態更新或專案資料夾變更時自動失效。
  - `GET /api/jobs` 新增 `offset`、`limit`，並回傳 `total`、`hasMore`；未提供參數時維持原本回傳全部任務的相容行為。
  - `limit` 上限為 500，並對負值、非數字輸入進行安全正規化。
- 驗證：
  - `node --check server.mjs` 與 `node --check public/app.js` 通過。
  - `git diff --check` 通過。
  - 啟動臨時本機 server，確認 `/api/jobs?offset=0&limit=25` 正確回傳分頁 metadata。
  - 確認 `/api/bootstrap` 可正常回傳快取後的工具狀態。

### 2026-07-15 — 項目 20：Whisper 效能模式與長影片音訊最佳化

- 狀態：完成
- 修改檔案：
  - `public/index.html`
  - `public/app.js`
  - `server.mjs`
- 調整內容：
  - 新增「快速／平衡／精準」轉錄效能模式，並保存於專案檔與任務設定。
  - 新增 CPU 執行緒設定；輸入 0 時依系統可用核心自動選擇，上限 16，自訂值上限 64。
  - Whisper 啟動前會使用既有 GPU 檢測結果，自動選擇 CUDA 或 CPU。
  - CUDA 模式啟用 FP16；CPU 模式明確關閉 FP16 並傳入 threads，避免不支援警告與不合理執行緒數。
  - 快速模式使用 beam size 1，精準模式使用 beam size 5，平衡模式保留 Whisper 預設解碼設定。
  - 影片先由 FFmpeg 串流解碼成 16kHz、單聲道、PCM WAV，降低 Whisper 端格式差異並提供長影片一致的輸入路徑。
  - 音訊前處理與 Whisper 皆支援任務取消；轉錄完成或失敗後會移除大型暫存 WAV。
  - 任務狀態會顯示音訊最佳化階段、實際裝置、效能模式與 CPU 執行緒數。
- 相容性：
  - 保留原本 `python -m whisper` runtime，不更換模型格式或轉錄引擎。
  - 使用者仍可自行指定模型名稱；未指定時沿用 bundled Whisper 預設值。
- 驗證：
  - `node --check server.mjs` 與 `node --check public/app.js` 通過。
  - `git diff --check` 通過。
  - 已靜態確認 FFmpeg 與 Whisper 子程序的取消、成功、失敗及暫存清理路徑。

### 2026-07-15 — 項目 21：Electron／本機 API 安全強化與核心回歸測試

- 狀態：完成
- 修改檔案：
  - `electron/main.mjs`
  - `public/index.html`
  - `public/review.html`
  - `public/app.js`
  - `public/review.js`
  - `server.mjs`
  - `scripts/test-core.mjs`
  - `package.json`
- 安全強化：
  - Electron 每次啟動產生 256-bit 隨機 API token，透過環境變數交給本機 server。
  - Renderer 對 `/api/` 的 fetch 自動加入 token header，首頁與校閱頁切換時保留 token。
  - 本機 API 在 Electron 模式下拒絕缺少或錯誤 token 的請求，並拒絕非 localhost／127.0.0.1 Origin。
  - Electron 阻擋主視窗導覽或新視窗開啟到非本機應用來源。
  - `openExternal` 僅允許 HTTP、HTTPS，以及應用程式目錄內的 file URL。
  - `open-folder` 防止 `..` 路徑跳出 appDir；設定檔僅允許從 userData/config 開啟。
  - 任意資料夾 IPC 不再代替 renderer 建立路徑，只允許開啟已存在的資料夾。
  - CSP 的 `script-src` 移除不必要的 `'unsafe-inline'`。
- 自動測試：
  - 新增 `npm test` 與整合測試 `scripts/test-core.mjs`。
  - 新增 `npm run check`，串接 server、renderer、Electron 語法檢查與核心測試。
  - 測試涵蓋 API token、惡意 Origin、multipart 串流檔案一致性、既有 SRT 任務完成、任務列表分頁與非執行中取消。
- 驗證：
  - 所有 JavaScript／MJS 語法檢查通過。
  - `git diff --check` 通過。
  - `npm test` 通過。
  - `npm audit --omit=dev --audit-level=high` 回傳 `found 0 vulnerabilities`，正式執行依賴無已知漏洞。

### 2026-07-15 — 項目 22：保留原 UI 並補齊上方選單功能

- 狀態：完成
- 修改檔案：
  - `electron/main.mjs`
- UI 原則：
  - 保留目前主畫面、側邊步驟、校閱頁與整體配色版面。
  - 不套用新版首頁 mockup，不調整既有 renderer HTML／CSS。
- 調整內容：
  - 修復「健康檢查」在 API token 安全機制啟用後回傳 401 的問題。
  - 健康檢查改附帶 Electron 啟動時的隨機 token，並使用 `refresh=1` 取得即時狀態。
  - 「編輯」選單補上復原、重做、剪下、複製、貼上與全選等原生文字編輯功能。
  - 「說明」選單新增快捷鍵一覽，包含專案與字幕校閱快捷鍵。
  - 使用說明移除要求使用者執行 `.bat` 的過時內容，改為 APP 自動檢查與修復提示。
  - 「關於」視窗改用 `app.getVersion()` 顯示實際版本，不再固定為 0.1.0。
- 驗證：
  - `node --check electron/main.mjs` 通過。
  - `git diff --check` 通過。
  - 確認本次未修改 `public/index.html`、`public/review.html` 或既有 UI 樣式。

### 2026-07-15 — 項目 23：中英文軟體啟動讀取動畫

- 狀態：完成
- 修改／新增檔案：
  - `electron/main.mjs`
  - `electron/splash.html`
  - `electron/assets/offline-subtitle-splash.mp4`
  - `remotion-splash/`
- 調整內容：
  - 以使用者提供的「動態校徽.mp4」作為主視覺，使用 Remotion 製作 1920×1080、30 FPS、約 6.1 秒的循環啟動動畫。
  - 加入「離線字幕工廠／OFFLINE SUBTITLE FACTORY」中英文產品名稱。
  - 加入「正在啟動離線字幕服務／Starting offline subtitle services」讀取狀態、動態進度條與本機離線處理提示。
  - 顏色採用既有 UI 的深藍、亮藍與綠色狀態色，保留原校徽動畫內容與白色背景。
  - Electron 啟動視窗改為 640×360 的 16:9 無邊框視窗，自動靜音循環播放正式 MP4。
  - 啟動動畫會涵蓋環境預檢、本機服務啟動與主視窗準備期間；主視窗可顯示後自動關閉。
  - 保留 Remotion 原始碼與中段預覽圖，方便後續調整文字、時序與重新輸出。
- 驗證：
  - Remotion ESLint 與 TypeScript 檢查通過。
  - 已渲染並人工檢查第 90 幀預覽，確認校徽、雙語文字與進度資訊沒有重疊或裁切。
  - 正式 H.264 MP4 成功輸出，檔案大小約 726 KB。
  - `npm run check` 通過，包含 JavaScript／MJS 語法檢查及核心 API 回歸測試。

### 2026-07-15 — 項目 24：0.21.0 Windows x64 完整獨立安裝包

- 狀態：完成
- 修改／新增檔案：
  - `package.json`
  - `electron/main.mjs`
  - `server.mjs`
  - `scripts/test-core.mjs`
  - `scripts/verify-runtime-package.mjs`
  - `scripts/write-runtime-manifest.mjs`
  - `README.md`
  - `THIRD-PARTY-NOTICES.md`
  - 本機發版 runtime：`tools/ffmpeg/`、`tools/whisper-cpp/`、`tools/whisper-models/ggml-tiny.bin`
- 獨立執行調整：
  - 版本更新為 0.21.0。
  - 後端服務改用 Electron 執行檔搭配 `ELECTRON_RUN_AS_NODE=1` 啟動，不再需要另附或安裝 Node.js。
  - 安裝包內建 FFmpeg 8.1.2、FFprobe、Whisper.cpp 1.9.1 CPU x64 runtime 與 ggml-tiny 多語模型。
  - 字幕轉錄新增 Whisper.cpp 執行路徑，支援取消、CPU threads、語言設定、SRT 輸出與暫存音訊清理。
  - 若 Python Whisper 存在仍可相容使用；正式安裝包預設使用不依賴 Python 的 Whisper.cpp。
  - 健康檢查與啟動預檢不再把 Python 視為必要元件，也不再要求使用者執行批次檔、winget 或手動安裝套件。
  - 缺少或損壞內建 runtime 時，改為提示重新安裝 APP 修復。
  - runtime manifest 記錄元件版本、來源、檔案大小與 SHA-256；每次打包前強制驗證。
  - 正式包不再納入開發用 setup／start 腳本。
- 內建 runtime 驗證：
  - Whisper.cpp 官方 x64 發行壓縮檔 SHA-256：`7d8be46ecd31828e1eb7a2ecdd0d6b314feafd82163038ab6092594b0a063539`。
  - ggml-tiny 多語模型 SHA-256：`be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21`。
  - FFmpeg 發行壓縮檔 SHA-256：`db580001caa24ac104c8cb856cd113a87b0a443f7bdf47d8c12b1d740584a2ec`。
  - FFmpeg、FFprobe、Whisper.cpp CLI 與 DLL 均通過 Windows PE 格式檢查。
  - 模型容量與 manifest 中各 runtime SHA-256 比對通過。
- 測試：
  - `npm run check` 通過，包含所有 JavaScript／MJS 語法與核心回歸測試。
  - 來源版核心測試通過：API token、惡意 Origin 阻擋、串流上傳、任務處理、分頁與取消狀態。
  - 封裝後 `win-unpacked/resources/app` 再次執行同一組核心測試並通過。
  - 實測 Electron 內建 Node 模式可啟動 server 並完成核心測試。
  - source 與封裝後的 server、Electron main、啟動畫面、首頁程式及校閱程式逐檔 `cmp` 一致。
  - Setup 與 Portable 自解壓內容均通過 7-Zip 完整性測試，127 個檔案全部正常。
  - 由於建置主機為 Apple Silicon macOS，無法直接執行 Windows GUI；正式 Windows 實機首次安裝、選單、啟動畫面與真實影片轉錄仍建議在乾淨 Windows 10／11 x64 機器補做最終驗收。
- 正式成品：
  - `dist/離線字幕工廠 Setup 0.21.0.exe`：206,024,066 bytes。
  - `dist/離線字幕工廠 0.21.0.exe`：205,318,983 bytes。
  - Setup SHA-256：`3f76e599b24866b5530ad82725185be4a995f7ee92ac93bdf79bbc3a071477e8`。
  - Portable SHA-256：`f8e38b2a7a5228fbff36fa82e97372a723fa55a778704bf952d063073f8297a8`。
- 發布注意事項：
  - 目前成品未使用 Windows 程式碼簽章憑證，Windows SmartScreen 可能顯示未知發行者警告。

### 2026-07-15 — 項目 25：0.21.0 macOS Apple Silicon 獨立安裝版

- 狀態：完成
- 支援環境：
  - macOS 12 Monterey 或更新版本。
  - Apple Silicon arm64（M1／M2／M3／M4 系列）；本版不支援 Intel x64。
- 修改／新增檔案：
  - `package.json`
  - `electron/main.mjs`
  - `server.mjs`
  - `public/review.js`
  - `scripts/after-pack.cjs`
  - `scripts/test-core.mjs`
  - `scripts/verify-electron-renderer.mjs`
  - `scripts/verify-runtime-package.mjs`
  - `scripts/write-runtime-manifest.mjs`
  - `electron/icons/icon.icns`
  - `README.md`
  - `THIRD-PARTY-NOTICES.md`
  - macOS runtime：`tools/ffmpeg/`、`tools/whisper-cpp/`、`tools/whisper-models/ggml-tiny.bin`
- 獨立執行調整：
  - 內建 macOS arm64 FFmpeg 8.1.2、FFprobe、Whisper.cpp 1.9.1 與 ggml-tiny 多語模型。
  - Whisper.cpp 以 Apple Metal 與 Accelerate 執行，不需要使用者安裝 Python、Node.js、Homebrew、FFmpeg 或 Whisper。
  - Electron 可從 `Contents/Resources/tools` 解析封裝後的工具，並依平台選擇有／無 `.exe` 副檔名的執行檔。
  - 修正 Electron 預檢以自身執行檔查詢版本時重複啟動 App 的問題；改以 `ELECTRON_RUN_AS_NODE=1` 執行。
  - 加入 macOS 原生 Application 選單、Command 快捷鍵、Dock 重新開啟視窗及 Command+Q 結束行為。
  - 字幕校閱的上一句／下一句快捷鍵同時支援 Control 與 Command。
  - 建置時只帶入對應平台 runtime，macOS 包不會混入 Windows EXE／DLL。
  - App 完成 ad-hoc 深層簽章；未使用付費 Apple Developer ID，故未進行 Apple notarization。
- runtime 驗證：
  - FFmpeg：Mach-O 64-bit arm64，具備 `ass`、`subtitles`、`libx264` 與 `h264_videotoolbox`。
  - FFprobe：Mach-O 64-bit arm64。
  - Whisper.cpp：Mach-O 64-bit arm64，只連結 macOS 系統程式庫／Framework。
  - FFmpeg ZIP SHA-256：`ef1aa60006c7b77ce170c1608c08d8e4ba1c30c5746f2ac986ded932d0ac2c3c`。
  - FFprobe ZIP SHA-256：`c39787f4af7a3932502d2d48db6f6feaaa836b48a73ef78c32cc3285df61dfaf`。
  - ggml-tiny 模型 SHA-256：`be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21`。
- 封裝後實測：
  - Electron 正式主畫面可從 `.app` 啟動，啟動畫面可正確切換到本機 UI。
  - 設定視窗、Electron preload API、資料夾選擇、multipart 上傳、建立／啟動任務及 SRT 產出通過。
  - 使用封裝後的 FFmpeg、Whisper.cpp、模型與 Metal，完成 JFK WAV 真實語音轉錄；輸出包含預期英文內容。
  - API token、Origin 防護、串流上傳、任務狀態、分頁及取消核心回歸測試通過。
  - 封裝版 FFmpeg 成功產生 1280×720 H.264／AAC 硬字幕 MP4，並人工確認繁體中文字幕正確顯示。
  - `codesign --verify --deep --strict` 對 build 目錄及 DMG 內的 App 均通過。
  - `hdiutil verify` 確認 DMG checksum 有效；實際掛載後 App 與 Applications 安裝捷徑存在。
  - `unzip -t` 確認 ZIP 所有壓縮內容無錯誤。
- 正式成品：
  - `dist/離線字幕工廠 0.21.0 macOS-arm64.dmg`：213,907,744 bytes。
  - `dist/離線字幕工廠 0.21.0 macOS-arm64.zip`：219,289,519 bytes。
  - DMG SHA-256：`248cfd9e957fb2ac0ba4286412a4c5f6943a142be19d41df2808068c34a7442c`。
  - ZIP SHA-256：`869f264531b2a65ab914d06e7a316b39d3f767035d4c0fe054dce6d83caf3c8a`。
- 發布注意事項：
  - 因未使用 Apple Developer ID 與 notarization，Gatekeeper 會把本版本視為未受 Apple 公證；首次執行請在 Finder 對 App 按右鍵選擇「打開」，再確認開啟。

### 2026-07-15 — 項目 26：0.22.0-preview.1 轉錄修正與新版 UI 預覽

- 狀態：完成
- 使用者回報：
  - macOS 顯示 Python 未安裝。
  - 執行轉字幕直接跳到完成，沒有進行實際轉錄。
  - 軟體尚未套用先前確認的深藍側欄新版 UI。
- 實際根因：
  - 瀏覽器 FormData 會把未選擇的可選檔案欄位送成空檔。
  - 上傳解析器將沒有檔名的空白 `existingSrt` 改名為 `existingSrt.bin` 並建立 0-byte 檔案。
  - 後端只檢查 SRT 檔名是否存在，因此誤判為使用者已提供字幕，直接略過 Whisper。
  - 使用者回報任務 `20260715065700-08f760` 的紀錄證實：`existingSrt.bin`、`ruleFile.bin`、`draft.srt` 與 `rule-cleaned.srt` 均為 0 bytes，卻被標記為 completed。
  - macOS 安裝版使用 Whisper.cpp，不依賴 Python；舊 UI 仍顯示 Python 狀態，造成必須安裝 Python 的錯誤觀感。
- 轉錄修正：
  - multipart 上傳現在忽略沒有檔名或大小為 0 的可選檔案，不再建立 `.bin` 假檔。
  - 建立任務前強制確認影片／音訊檔有效且非空白。
  - 既有 SRT 必須解析出至少一段有效字幕才允許略過 ASR；空白或格式無效時自動改用內建轉錄。
  - Whisper 或規則流程結束後再次驗證 `draft.srt`；沒有有效字幕段落時任務會失敗並顯示原因，禁止標記完成。
  - ASR 預設改為 `whisper-cpp`，首頁只保留「內建 Whisper.cpp」與「僅使用既有 SRT」兩種明確選項。
- Python／內建元件顯示修正：
  - 首頁「Python」指標改為「轉錄引擎」，顯示 `whisper.cpp（內建）`。
  - 健康檢查與說明改為 FFmpeg、Whisper.cpp、模型及 Metal／GPU，不再把 Python 顯示成必要套件。
  - 啟動修復訊息改為「內建元件缺少或損壞」，不再提供 Windows `.bat` 安裝腳本按鈕。
  - macOS 預覽版仍維持完全內建，不安裝或修改使用者系統 Python。
- 新版 UI：
  - 首頁套用深藍漸層側欄，保留既有 10 步驟工作流與全部功能。
  - 字幕校對改為先前確認版本的版型：深藍功能側欄、左側影片與時間軸、右側字幕清單、上方搜尋／批次／儲存／匯出。
  - 字幕卡片改為緊湊時間碼、確認狀態、文字編輯與進階操作；目前字幕使用藍框標示。
  - 加入內建 Whisper.cpp／Apple Metal 狀態卡及獨立「樣式與輸出」畫面。
  - 載入任務後立即選取目前時間對應字幕；原有自動跟隨、編輯、自動保存、時間調整、規則、燒錄與輸出功能均保留。
- 真實影片驗證：
  - 使用使用者原回報任務中的 `media (1).mp4` 重跑，檔案大小 111,936,669 bytes、長度 11:33。
  - 任務明確經過 `audio-preprocessing`、Whisper.cpp 及 Apple Metal，不再進入 `import-srt`。
  - 約 26 秒完成並產生 138 段有效中文字幕；校對頁辨識出 27 段待檢查內容。
  - 狀態 metrics：`asrEngine=whisper.cpp`、`whisperDevice=metal`、`modelName=tiny-multilingual`。
- 自動與封裝後測試：
  - 整合測試新增空白 `existingSrt`／`ruleFile`，確認任務設定不保存假檔且必須執行 ASR。
  - 來源版與封裝版均使用 JFK WAV 通過 FFmpeg 前處理、Whisper.cpp、Metal／CPU 與 SRT 內容驗證。
  - `npm run check`、`git diff --check` 通過。
  - 0.22 預覽 `.app` 啟動、Electron preload、設定視窗、上傳、任務建立／啟動及字幕輸出流程通過。
  - 瀏覽器實際載入 11:33 影片、138 段字幕、新版校對與樣式輸出畫面，無 JavaScript 錯誤。
- 預覽畫面：
  - `預覽版-新版首頁.png`
  - `預覽版-字幕校對.png`
  - `預覽版-樣式與輸出.png`
- 預覽版成品：
  - `dist/離線字幕工廠 0.22.0-preview.1 macOS-arm64.dmg`：213,918,410 bytes。
  - `dist/離線字幕工廠 0.22.0-preview.1 macOS-arm64.zip`：219,295,337 bytes。
  - DMG SHA-256：`2802b0372f509edf6975a7f30e33aed22bf5f4e5b56160e6cc66057462ac64f6`。
  - ZIP SHA-256：`d244a932cf65c131f30fd2b86efe2140f1c3cb28f33fb3e57f8e732bb314c4da`。
  - DMG 通過 `hdiutil verify`，ZIP 通過 `unzip -t`，App 通過 `codesign --verify --deep --strict`。

### 2026-07-15 — 項目 27：首頁恢復為核定的專案總覽版本

- 狀態：完成
- 使用者回報：
  - 0.22.0-preview.1 首頁仍是字幕任務設定表單，與先前核定的首頁規劃不同。
- 修正內容：
  - 首頁恢復為深藍側欄的專案總覽版型：首頁、專案、處理中心、模型管理與設定。
  - 主畫面加入「新增字幕專案」、「匯入既有專案」、最近專案、處理中任務與底部離線環境狀態。
  - 原有字幕任務表單完整保留，改為點選「新增字幕專案」後進入的工作區，不再佔用首頁。
  - 最近專案綁定真實任務清單、狀態、進度與更新時間；使用 FFmpeg 自動產生影片縮圖，無有效影片時保留安全的預設縮圖。
  - 處理中卡片顯示真實 running／queued 任務；離線元件、預設模型與 Metal／CPU 狀態取自健康檢查。
  - 新增專案、返回首頁、專案列表、處理中心、模型檢查與設定按鈕均完成互動綁定。
- 驗證：
  - 瀏覽器實測首頁可載入三筆最近專案、真實影片縮圖、健康檢查與 Apple Silicon Metal 狀態。
  - 實測「新增字幕專案」可切換到原工作區，「返回首頁」可返回專案總覽。
  - 更新預覽圖：`預覽版-新版首頁.png`。

### 2026-07-15 — 項目 28：校閱聲波改為真實影片音軌與播放同步

- 狀態：完成
- 檢查結果：
  - 舊版聲波是固定 CSS 裝飾圖形，沒有讀取影片音訊，播放游標也固定在 44%；對字幕校閱沒有實質用途。
- 修正內容：
  - 移除假的 CSS 聲波，新增 `/api/jobs/:jobId/waveform` 真實音訊取樣 API。
  - 後端由內建 FFmpeg 將影片音軌轉為單聲道 PCM，計算 160–1200 點峰值並快取於任務 working 目錄。
  - 校閱頁使用 canvas 繪製真實聲波；時間刻度依影片總長動態產生。
  - 播放游標跟隨 `currentTime` 更新，點擊聲波可跳轉至對應影片時間。
  - 使用者手動替換本機影片時，改由瀏覽器音訊解碼產生該影片的真實聲波。
  - 音軌不存在或無法解碼時顯示明確錯誤，不再顯示看似有效的假聲波。
- 驗證：
  - 使用 11:33 真實影片產生 640 點聲波，刻度正確顯示 00:00、02:53、05:46、08:40、11:33。
  - 點擊約 50% 位置後影片跳轉至 346 秒，播放游標更新為 49.9%。
  - 核心回歸測試新增 8 kHz WAV 真實取樣，確認 160 點峰值不全為零且來源為 `ffmpeg-pcm`。
  - `npm run check` 通過，包含 server、首頁、校閱頁、Electron 主行程語法與核心測試。
  - 更新預覽圖：`預覽版-字幕校對.png`。

### 2026-07-15 — 項目 29：0.22.0-preview.2 macOS 預覽版封裝與成品驗收

- 狀態：完成
- 版本：`0.22.0-preview.2`
- 封裝內容：
  - 首頁專案總覽、真實專案縮圖與工作區切換。
  - 真實影片音軌聲波、動態時間刻度、播放游標同步與點擊跳轉。
  - 既有 FFmpeg、Whisper.cpp、ggml-tiny multilingual 與 Apple Metal 離線 runtime。
- 封裝後實測：
  - App 可正常啟動，核定首頁總覽預設顯示。
  - 首頁、專案與處理中心導覽及新增字幕專案按鈕存在。
  - Electron preload、設定視窗、資料夾功能、API 健康檢查、multipart 上傳、任務建立與啟動均通過。
  - 測試任務完成並產生 cleaned SRT。
  - App 通過 `codesign --verify --deep --strict`。
  - DMG 通過 `hdiutil verify`，ZIP 通過 `unzip -t`。
- 預覽版成品：
  - `dist/離線字幕工廠 0.22.0-preview.2 macOS-arm64.dmg`：213,884,243 bytes。
  - `dist/離線字幕工廠 0.22.0-preview.2 macOS-arm64.zip`：219,303,076 bytes。
  - DMG SHA-256：`12bba17e84d95cc19016873477fb58f9eb69e042771f55b9dc320d9f720909e7`。
  - ZIP SHA-256：`2e7a97aa78062e05d17e6de2cdb87f18bcf237ea8859ca34c407e68a7d074ec5`。

### 2026-07-15 — 項目 30：首頁設定入口可見性修正

- 狀態：完成
- 問題：設定視窗仍位於專案工作區容器；從首頁或 macOS 選單開啟時，視窗雖有 `is-open` 狀態，但可能被隱藏的工作區祖先遮蔽。
- 修正：所有設定入口會先切換到工作區，再顯示設定視窗；封裝測試改為同時檢查 class、computed display 與可見矩形，不再只檢查狀態 class。
- 驗證：來源頁與最終封裝 App 均確認「APP 常用設定」實際可見；設定、資料夾與任務流程回歸通過。

### 2026-07-16 — 項目 31：簡易影片修剪功能架構規劃

- 狀態：規劃完成，尚未進入實作。
- 規劃文件：`VIDEO-TRIM-FEATURE-PLAN.md`
- 建議第一版：單一保留區間、非破壞式、預設精準修剪，優先安排於 Whisper 轉錄前。
- 已規劃：UI 工作區、edit plan、有效影片路徑、FFmpeg 快速／精準策略、字幕時間重算、API、狀態機、快取失效、空間檢查、取消／還原、測試與分階段製作順序。
- 範圍控制：第一版不加入多軌、轉場、濾鏡或多素材拼接；多段刪除列為第二階段。

### 2026-07-16 — 項目 32：簡易影片修剪實作步驟整理

- 狀態：工作步驟整理完成，尚未開始程式實作。
- 清單文件：`VIDEO-TRIM-IMPLEMENTATION-CHECKLIST.md`
- 已依相依順序拆分為：安全基準、資料模型、後端 API／FFmpeg、獨立修剪 UI、既有流程整合、自動／真實影片測試及 macOS／Windows 封裝。
- 每一步均列出修改範圍、驗收條件與日誌節點；建議以 A–E 五個批次逐步執行。

### 2026-07-16 — 項目 33：建立 0.30 獨立專案副本

- 狀態：完成。
- 新專案資料夾：`offline-subtitle-factory-app-v0.30`。
- 舊專案 `offline-subtitle-factory-app` 保持不變；後續影片修剪實作僅修改 0.30 專案。
- 已複製原始碼、Git 歷史、內建 FFmpeg／FFprobe、Whisper.cpp、模型、圖示、啟動畫面與規劃文件。
- 排除可重建的 `node_modules`、本機 config 與封裝輸出，避免把開發機暫存狀態誤帶入新版。
- `package.json`、`package-lock.json`、首頁版本標示、README 與第三方元件說明已更新為 `0.30.0`。

### 2026-07-16 — 項目 34：修剪資料層與字幕時間軸

- 狀態：完成。
- 新增 `lib/media-edit.mjs`：edit plan 驗證、修剪檔案路徑與 effective media 解析。
- 新增 `lib/subtitle-timeline.mjs`：單一保留區間的字幕移除、邊界截短、時間平移與重新編號。
- 新增 `scripts/test-media-edit.mjs`，涵蓋非法 In／Out、最短長度、effective media 回退及字幕邊界案例。
- 測試通過：未修剪專案仍使用原始影片；完成修剪後使用衍生影片；字幕區間外刪除、區間內平移、跨界字幕標記待檢查。

### 2026-07-16 — 項目 35：修剪 API、FFmpeg、取消與還原

- 狀態：完成。
- 新增 edit plan、apply trim、trim status、cancel trim 與 restore API。
- 精準模式在 macOS 優先使用 `h264_videotoolbox`，失敗自動回退 `libx264`；快速模式使用 stream copy。
- 以 `.partial.mp4`、FFprobe 驗證與原子更名避免半成品被誤用。
- 加入磁碟空間檢查、字幕轉錄／修剪／燒錄互斥鎖、真實 FFmpeg 進度與快取失效。
- 所有處理保留 input 原始影片；還原會移除衍生影片、edit plan、trimmed SRT、聲波與縮圖快取。
- 整合測試以 4 秒 H.264／AAC 影片精準保留 1–3 秒，得到約 2 秒影片；字幕時間重算、review-data effective URL 與還原至 4 秒原片全部通過。
- `npm run check` 通過。

### 2026-07-16 — 項目 36：0.30 非破壞式影片修剪工作區

- 狀態：完成。
- 新增獨立 `/trim/:jobId` 工作區，沿用核定的深藍側欄、白色內容卡與藍色主操作風格。
- 畫面包含原始影片、真實音軌聲波、動態刻度、播放游標、In／Out 把手、保留／移除區域、精準／快速模式與處理進度。
- 支援拖曳把手、時間欄直接輸入、Enter 套用時間、I／O 設定起終點、Space 播放、方向鍵微調、前後 5 秒與區間循環。
- 首頁專案卡、任務管理與字幕校對側欄均新增「修剪」入口；首頁保留原核定版型，未更換整體 UI。
- 新增專案頁加入「先修剪影片」，可只建立任務而不立即啟動 Whisper；修剪完成後可直接按「開始字幕生成」。
- 瀏覽器實測 1600×1000 桌面版 UI、時間欄 2–9 秒同步、真實聲波、進度回報、首頁入口與校對入口均正常。
- 預覽圖：`/Users/nycu/Documents/離線字幕工廠/預覽版-0.30影片修剪.jpg`。

### 2026-07-16 — 項目 37：修剪與字幕完整流程整合

- 狀態：完成。
- Whisper 音訊前處理、FFprobe、真實聲波、首頁縮圖、校對播放器與硬字幕輸出統一改用 effective media；修剪編輯頁仍讀取原始影片，確保可重新調整完整範圍。
- 有既有 SRT 時，修剪會先移除區間外字幕、截短邊界字幕並把保留段落平移至 0 秒；轉錄任務會優先匯入重算後的 `trimmed.srt`。
- 修剪後才進行字幕生成的實測結果：12 秒影片保留 2–9 秒，輸出 7.021 秒；字幕時間由原始 0.5–9 秒正確轉為 0–7 秒。
- `review-data` 同時使用 `media-trimmed.mp4` 與重算字幕；使用者之後重新儲存校稿時，以更新時間選擇最新 reviewed／trimmed 版本。
- 任務重試只清除轉錄暫存，會保留 edit plan、修剪影片與聲波快取；套用或還原修剪仍會清除受影響的縮圖與聲波快取。
- `npm run check` 與 `git diff --check` 通過；測試涵蓋 API token、Origin、串流上傳、真實 FFmpeg 精準修剪、字幕重算、effective media、還原、分頁與取消狀態。

### 2026-07-16 — 項目 38：0.30.0 macOS 預覽版封裝與驗收

- 狀態：完成。
- 版本：`0.30.0`；平台：Apple Silicon macOS 12 以上。
- App 內建 FFmpeg、FFprobe、Whisper.cpp、ggml-tiny multilingual 與 Apple Metal runtime，不需要使用者安裝 Python、Node.js、FFmpeg 或 Whisper。
- 封裝版 smoke test 通過：核定首頁預設顯示、設定視窗可見、Electron preload、資料夾入口、健康檢查、上傳、任務建立／啟動與 SRT 產出正常。
- 封裝版真實修剪通過：4 秒 H.264／AAC 影片精準保留 1–3 秒，輸出 2.021 秒；修剪後字幕任務完成，校對資料使用 `media-trimmed.mp4` 且字幕正確平移至 0 秒。
- 封裝內容確認包含 `public/trim.html`、`public/trim.js`、`lib/media-edit.mjs` 與 `lib/subtitle-timeline.mjs`。
- `codesign --verify --deep --strict` 通過；DMG checksum 有效；ZIP 全部壓縮內容無錯誤。
- 成品：
  - `dist/離線字幕工廠 0.30.0 macOS-arm64.dmg`：213,833,363 bytes。
  - `dist/離線字幕工廠 0.30.0 macOS-arm64.zip`：219,320,960 bytes。
  - DMG SHA-256：`95bc8986612d041d3e2a1eb812d640fc2b35eb37dec60fcc5ebdec68c8444d9e`。
  - ZIP SHA-256：`d533e291ab236775678ee4c96d44b90cd3793f2a79c074ea71a135982e7616d3`。
- 發布注意：本預覽版使用 ad-hoc 簽章，尚未使用 Apple Developer ID 公證；若首次啟動遭 Gatekeeper 阻擋，請在 Finder 對 App 按右鍵選擇「打開」。

### 2026-07-16 — 項目 39：GitHub Windows 11 測試與打包發布準備

- 狀態：完成。
- 發布分支：`codex/windows-0.30-preview`。
- 新增 `.github/workflows/windows-preview.yml`：推送預覽分支或手動觸發時，在 GitHub `windows-2022` runner 執行 `npm ci`、runtime 準備、完整回歸測試、NSIS Setup／Portable 建置與 7-Zip 完整性檢查。
- 新增 `scripts/prepare-windows-runtime.ps1`：下載固定版本 FFmpeg 8.1.2、Whisper.cpp 1.9.1 與 ggml-tiny multilingual，逐一比對 SHA-256，僅放入專案 `tools`，不安裝 Python、不修改系統 PATH。
- 新增 `WINDOWS-11-TEST-CHECKLIST.md`：涵蓋乾淨 Windows 11 環境、免安裝目錄、Setup／Portable、中文路徑、離線轉錄、影片修剪、字幕同步、輸出與解除安裝驗收。
- workflow 成品包含 Setup EXE、Portable EXE、blockmap、`latest.yml` 與 `SHA256SUMS-windows-x64.txt`，保留 14 天供測試。
- 發布注意：GitHub runner 可驗證 Windows x64 建置流程，但仍需在實體 Windows 11 測試機完成 GUI、SmartScreen、安裝／升級／解除安裝與 Defender 最終驗收；預覽成品尚未使用 Windows 程式碼簽章憑證。
