# 獨立審查報告：Breeze ASR 25 實驗性本機轉錄整合（FR-024）

- 審查對象 commit／版本：分支 `codex/breeze-model-planning`；基準 HEAD `170e08e17d38b4c7a9c94d3e1ba031a382539d9a`；工作樹為尚未提交的 `0.48.1`／FR-024 變更
- 對應 08-CHANGE-LOG 條目：`2026-08-10 — Breeze ASR 25 實驗性本機轉錄整合（FR-024）`
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-10 10:33（Asia/Taipei）；由主要代理以獨立子代理上下文啟動，未沿用開發代理對話記憶
- 審查環境：macOS、Node.js `v22.22.3`；真實 Breeze checkpoint、官方 Python／PyTorch／patched Whisper runtime 均未安裝
- 審查範圍：FR-024 需求／設計／工作紀錄、`lib/breeze-asr.mjs`、`lib/whisper-model-download.mjs`、`server.mjs`、首頁 UI、Breeze／Whisper／核心測試與完整回歸

## 問題摘要（依優先級）

### P1 — 3,087,008,569-byte checkpoint 的完整雜湊在 server event loop 同步執行

- 證據：`lib/breeze-asr.mjs:20-40` 以 `openSync`／`readSync` 逐塊讀取完整模型；`inspectBreezeAsrModel()` 在 `lib/breeze-asr.mjs:43-65` 對正確大小檔案直接呼叫此同步雜湊。呼叫點包含狀態 API payload（`server.mjs:1074-1076`）、下載啟動（`server.mjs:1100-1103`）、基本工具探測（`server.mjs:920-939`）、任務 preflight（`server.mjs:1516-1518`）與真正執行前（`server.mjs:1602-1607`）。
- 影響：首次辨識已安裝模型，以及下載串流已經算完 SHA 後的再次驗證，會在唯一 Node.js server 執行緒同步讀取約 2.88 GiB。期間 health／status／取消等請求無法及時處理；模型越慢、記憶體／磁碟壓力越高，UI 看起來越像凍結。雖有以 `size + mtimeMs` 為鍵的程序內快取，首次雜湊、重啟後首次檢查與檔案 mtime 改變後仍會承擔完整 blocking，且真實 3 GB 實測尚未執行。
- 修正要求：把完整 SHA 驗證移出 event loop（非同步 stream 或 worker／child process），下載成功時安全傳遞已驗證結果；任務啟動仍須在不阻塞 API 的情況下拒絕篡改檔案。加入可觀察的長耗時／取消測試，證明狀態與取消 API 在驗證期間仍可回應。

### P1 — Breeze 取消在 child process 結束前即把任務視為已取消完成

- 證據：`server.mjs:1662-1672` 的 abort handler 僅呼叫 `child.kill('SIGTERM')`，不檢查回傳值、不等待 `exit`／`close`，立刻 reject；上層 `server.mjs:1359-1423` 隨即把任務標記 cancelled、釋放 concurrency slot 並允許後續任務。Breeze child 的輸出 SRT 亦未在 abort handler 清除。
- 影響：在 Python／PyTorch 載入 2B 模型或推論期間，SIGTERM 若延遲、失敗或只終止父程序，任務可已顯示取消、queue slot 已釋放，但高資源 child／descendant 仍在執行並可能繼續寫入工作目錄；使用者重試時可能產生並行推論與殘留輸出。這不滿足 FR-024／NFR-005 的取消與「不得假成功／假停止」契約。
- 修正要求：追蹤 child lifecycle，取消後等待受控 grace period 的 `close`，必要時升級強制終止並處理 Windows process tree；只有確認 child 結束後才釋放 running slot／完成 cancelled，並清除 Breeze 暫存 SRT／音訊。加入 mock child 的正常取消、忽略 SIGTERM、輸出競態及重試測試。

### P2 — runtime 能力探針沒有 timeout，單次卡住會拖住所有共用工具狀態查詢

- 證據：能力探針內容確實檢查 `whisper.available_models()`（`lib/breeze-asr.mjs:68-70`），但通用 `commandExists()` 在 `server.mjs:903-917` 沒有 timeout 或 kill；`getBasicToolsStatus()` 將它放入共用 `Promise.all` 並保存 `basicToolsPromise`（`server.mjs:920-942`）。
- 影響：Python import、PyTorch 初始化、錯誤 runtime 或驅動若卡住，Breeze 狀態、bootstrap、health 與所有任務 preflight 都可能無限等待。這在大型 ML runtime 上不是可忽略邊界。
- 修正要求：為探針設定明確 timeout、終止 child／process tree、回報 timeout reason，並以會永久等待的 mock executable 驗證 API 能在期限內回覆可採取行動的缺件提示。

### P1 — 自動測試未執行 Breeze job／SRT／取消主路徑，文件卻把相關計畫描述為已完成整合驗證

- 證據：`scripts/test-breeze-asr.mjs:14-58` 只測常數、缺檔／錯誤大小、`allowMock` 與 argv 組裝；沒有 spawn runtime、job、SRT 或取消。`scripts/test-core.mjs:441-455` 只讀狀態 API並建立含有效既有 SRT 的 Breeze 設定，未呼叫該 Breeze job 的 `/start`；即使呼叫，`server.mjs:1513-1516` 也會因既有 SRT 略過 ASR。Breeze 下載 endpoint 的 POST／GET／DELETE 也沒有專屬整合測試。相對地，`08-CHANGE-LOG.md:30` 的驗證計畫明列「Breeze SRT 產出／清理／取消」，`06-TEST-AND-PROCESS-AUDIT.md:127-133` 則以整合驗證標題呈現。
- 影響：完整 `npm run check` 雖通過，仍不會發現上述 child 取消、SRT 選檔／清理、runtime timeout、3 GB blocking 或 Breeze endpoint 狀態競態；目前證據只能支持「契約與選項已接線」，不能支持「Breeze 任務執行與取消已驗證」。
- 修正要求：為 server 提供可注入的小型 mock Breeze model inspector／runtime runner，端到端測成功 SRT、無效 SRT、非零退出、缺模型、能力負例、執行中取消與清理；加入 Breeze download endpoint 成功／取消／HTTP／大小／SHA／暫存清理整合案例。修正後同步收斂稽核文件措辭，再進 round2。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - FR-024 固定官方來源、模型驗證、能力探針、獨立引擎選項、Whisper.cpp 預設與不封裝 runtime 的需求，已分別出現在 `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:40`、`docs/project-management/03-FUNCTIONAL-DESIGN.md:57-63`。
  - `lib/breeze-asr.mjs:5-16` 固定 revision `cffe7ccb404d025296a00758d0a33468bec3a9d0`、檔名、3,087,008,569 bytes、SHA-256 `9c94a355...746b690`，URL 不使用 `main`。2026-08-10 10:36–10:37 以 Hugging Face 官方 API 獨立查核：revision API 回傳相同 commit，tree API 回傳相同路徑、size 與 LFS oid（SHA-256）。
  - UI 在 `public/index.html:215-227` 提供 Breeze 實驗性選項且 Whisper.cpp 仍 selected；`public/app.js:625-655` 下載前明示約 3 GB、固定官方版本、SHA 與需另裝 runtime，模型已就緒但 runtime 缺失時會阻擋提交並給提示。
  - 未完整之處：高風險資源與取消行為尚不符合可靠性要求，且成功／取消／SRT 主路徑沒有執行證據，故需求完整性不能判定通過。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - 正向：`server.mjs:1516-1533` 在 Breeze 分支先檢查 FFmpeg、runtime capability 與 model validity，缺件時進 `needs-action` 而非假成功；`server.mjs:1602-1713` 準備 16 kHz 音訊、建立固定 CLI、檢查 exit code、要求 SRT 並呼叫 sanitizer。
  - 反向：P1 同步完整雜湊會阻塞本機 API；P1 取消未等待 child 結束卻提前完成任務狀態；P2 runtime 探針可能永久 pending。這三項均位於核心執行／可恢復邏輯，不只是文件或顯示問題。

## 3. 邊界情況

- 判定：不通過
- 已實測邊界：
  - 2026-08-10 10:36:40，`node scripts/test-breeze-asr.mjs`：缺檔、錯誤大小、mock-valid、CPU／CUDA argv 通過。
  - 2026-08-10 10:36:40，`node scripts/test-whisper-model-download.mjs`：共用下載器的 fixture 成功、SHA 不符、超過大小、HTTP 503、timeout、AbortController 取消、Windows replace 與 `.download` 清理通過。
  - 2026-08-10 10:36:40，`node scripts/test-whisper-models.mjs`：既有 Tiny／Base／Small mock runner 與 UI 靜態斷言通過；不等於 Breeze runtime。
- 未通過／未覆蓋邊界：真實大小檔案的 blocking、Breeze endpoint 取消、下載後二次雜湊、runtime probe hang、child 忽略／延遲 SIGTERM、取消後 retry、SRT 未產生／全無效／舊檔競態、CPU 記憶體不足、磁碟空間不足、睡眠／網路中斷與長音訊。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - 模型契約集中於單一模組、常數 freeze、spawn 使用 `shell: false`、server 不接受任意下載 URL／檔名／hash；下載器以串流 hash、大小上限、暫存檔與 Windows replace/rollback 實作，結構清楚。
  - 但同步 3 GB I/O 放在 request/job path、無 timeout 的共用 probe、取消與 child lifecycle 分離，皆是高資源本機服務不應保留的責任／併發問題。另 `runBreezeAsr(job, inputDir, ...)` 的 `inputDir` 未使用，顯示此路徑仍缺少針對性收斂。

## 5. 測試覆蓋

- 判定：不通過
- 證據與指令：
  - 2026-08-10 10:36:40：`node scripts/test-breeze-asr.mjs`、`node scripts/test-whisper-model-download.mjs`、`node scripts/test-whisper-models.mjs`、`node scripts/test-review-ui.mjs` 均 exit 0。
  - 2026-08-10 10:36:47：沙箱內 `node scripts/test-core.mjs` 因 `listen EPERM 0.0.0.0:22730` 中止，屬環境限制而非斷言失敗。
  - 2026-08-10 約 10:37：受控權限執行 `npm run check` exit 0；包含 docs check、語法、Whisper/manual/AI 完整既有回歸與 `test-core.mjs`。
  - 2026-08-10 10:37:54：`git diff --check` exit 0。
  - 測試缺口詳見 P1「未執行 Breeze job／SRT／取消主路徑」；因驗證計畫明列但未落實，不能以完整 suite exit 0 取代。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 官方 metadata 已由 Hugging Face API 讀取驗證；本機 deterministic 模組、下載 fixture、API 選項／設定保存與完整既有回歸均通過。
  - UI 缺件提示有程式碼與既有開發代理瀏覽器紀錄，但本獨立上下文未取得截圖 artifact；本輪只確認 DOM／JS 接線與文字。
  - 沒有真實 3,087,008,569-byte checkpoint、官方 Python／PyTorch／patched Whisper runtime、真實音訊、Windows／macOS 安裝版或長音訊執行；亦沒有 Breeze child 成功 SRT 或執行中取消證據。故不得宣稱 Breeze 能實際完成轉錄、取消可靠、品質合格或跨平台可用。

## 綜合判定

- 結論：不通過
- 阻擋問題：上述兩項 P1 程式邏輯／資源問題、一項 P2 runtime timeout 問題，以及一項 P1 核心測試／證據缺口。
- 剩餘風險：即使修正 deterministic 問題，真實約 3 GB checkpoint 下載、Python／PyTorch／patched Whisper 相容性、台灣華語／中英混用準確率、字幕對齊、CPU／CUDA 記憶體與速度、長音訊、Windows／macOS 安裝後取消與清理仍須外部實測；模型為 pickle-based `.pt`，應持續固定 revision／SHA 並清楚揭露第三方 runtime 與資源風險。
- 給主要開發代理的具體修正要求：依問題摘要修正非阻塞模型驗證、受控 child/process-tree 取消、runtime probe timeout，補齊 Breeze job／SRT／取消／download endpoint deterministic 整合測試；同步校正 `06-TEST-AND-PROCESS-AUDIT.md` 與工作紀錄的證據邊界，重跑 `npm run check`、`git diff --check` 後建立 round2 複審。
- 可逐字引用完整結論句：**FR-024 Breeze ASR 25 實驗性本機轉錄整合 round1 獨立審查判定為不通過：固定官方 revision、3,087,008,569-byte size、SHA-256、下載器契約、runtime capability 條件、UI 實驗性提示與既有完整回歸已有可追溯證據，但約 3 GB 模型仍在 Node.js event loop 進行同步完整雜湊、轉錄取消未等待 Python child 真正結束、runtime 探針沒有 timeout，且自動測試未執行 Breeze job 的成功 SRT 與取消路徑，因此在修正上述阻擋項並完成 round2 前，不得宣稱本機 Breeze 轉錄與取消整合已通過。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
