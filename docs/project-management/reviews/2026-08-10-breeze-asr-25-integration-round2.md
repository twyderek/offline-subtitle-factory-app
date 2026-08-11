# 獨立複審報告：Breeze ASR 25 實驗性本機轉錄整合（FR-024）

- 審查對象 commit／版本：分支 `codex/breeze-model-planning`；基準 HEAD `170e08e17d38b4c7a9c94d3e1ba031a382539d9a`；round1 後尚未提交的修正工作樹
- 對應 08-CHANGE-LOG 條目：`2026-08-10 — Breeze ASR 25 實驗性本機轉錄整合（FR-024）`
- 前輪報告：`docs/project-management/reviews/2026-08-10-breeze-asr-25-integration-round1.md`
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-08-10 10:43（Asia/Taipei）；由主要代理重新指派同一獨立審查角色，僅依目前檔案、round1 報告與本輪指令查證
- 審查環境：macOS、Node.js `v22.22.3`；沒有真實 Breeze checkpoint、官方 Python／PyTorch／patched Whisper runtime 或 Windows 實機
- 複審範圍：round1 四項阻擋修正及其對六面向判定的影響；不重複擴張至無關 0.48.1 變更

## Round1 阻擋複審

### 1. 約 3 GB 同步完整雜湊阻塞 event loop

- 判定：已關閉（deterministic 程式結構層級）
- 證據：`lib/breeze-asr.mjs:20-30` 改用 `fs.createReadStream()` 與 `for await` 串流 SHA；`inspectBreezeAsrModel()` 已成為 async，並以 `fs.promises.stat`／`await sha256File` 檢查（`lib/breeze-asr.mjs:33-59`）。server 的基本工具、狀態、下載與 job 呼叫點均已 await（例如 `server.mjs:910-932`、`1064-1066`、`1499-1508`、`1592-1597`）。`scripts/test-breeze-asr.mjs:60-61` 另阻擋 Breeze 模組重新引入 `open/read/statSync`。
- 剩餘限制：未以真實 3,087,008,569-byte 檔案量測 I/O、完成時間或多請求併發；async stream 可讓 event loop 取得執行機會，但仍會造成顯著磁碟 I/O，且目前 hash cache 未共用 in-flight promise，並行 refresh 仍可能重複讀檔。此為已揭露資源風險，不再是 round1 的同步 event-loop 阻擋。

### 2. 取消未等待 Breeze child close

- 判定：部分關閉，仍有一項條件式阻擋
- 已關閉證據：
  - `cancelJob()` 在執行中取消時維持 `status: running`／`stage: cancelling`（`server.mjs:1415-1440`）；job slot 只在 `runJob` promise settled 後釋放（`server.mjs:1372-1400`）。
  - `runBreezeAsr()` 的 abort handler 不再立刻 reject；取消結果只在 child `close` 事件處理（`server.mjs:1670-1701`），之後清理音訊與非 draft SRT。
  - `scripts/test-core.mjs:481-514` 真正經 server、FFmpeg 與 mock runtime 驗證成功 SRT，以及取消後仍為 running/cancelling、收到 SIGTERM、延遲 close、最後才 cancelled，並確認 `whisper-input.wav`／部分 SRT 清除。
- 未關閉問題（P1）：`server.mjs:1670-1680` 先對父 child 呼叫 `child.kill('SIGTERM')`，3 秒後才準備 Windows `taskkill /T /F`；但 child 一旦 close，`finish()` 會在 `server.mjs:1662-1666` 清除該 timer。Node 在 Windows 對 `SIGTERM` 會直接終止父程序，因此父程序很可能在 3 秒內 close，導致 tree-kill 永遠不執行，descendant 仍可能存活，而 job slot 已釋放。POSIX 路徑同樣只對直接 child 送 signal，未建立／終止 process group。
- 測試缺口：`scripts/fixtures/mock-breeze-runtime.mjs:20-25` 會配合 SIGTERM 在 300ms 退出；目前沒有忽略 SIGTERM 的 stubborn child、3 秒 SIGKILL 升級或 Windows descendant/tree-kill 測試。因此 round1 對「kill 失敗／process tree 仍執行」的核心風險尚未完整消除。
- 關閉條件：重整取消策略，確保 Windows 一開始或在 parent close 前執行 `taskkill /T /F`，POSIX 視需要終止 process group；測試 stubborn child 在 grace timeout 後確實 close，且 job slot 不提前釋放、descendant 與暫存輸出不殘留。

### 3. runtime capability probe 無 timeout

- 判定：已關閉
- 證據：`lib/process-probe.mjs:5-24` 提供有下限的 timeout 與 SIGKILL；Breeze capability probe 在 `server.mjs:916-923` 明確使用 15 秒。`scripts/test-breeze-asr.mjs:56-59` 以永久 interval child 驗證 250ms 後回傳 false 且總耗時小於 2 秒。能力內容仍是 `whisper.available_models()` 包含 `breeze-asr-25`，未退化成單純 import。
- 剩餘限制：真實 PyTorch import／驅動 hang 與 Windows probe child tree 未實測；目前 deterministic timeout 已足以關閉「無限等待」阻擋。

### 4. 未執行 Breeze job／SRT／取消主路徑

- 判定：主要缺口已關閉
- 證據：`scripts/test-core.mjs:481-514` 新增 server 端到端成功與取消案例；`scripts/fixtures/mock-breeze-runtime.mjs` 依 production CLI argv 產生 SRT並模擬延遲 close。完整 `npm run check` 已實際執行這些案例並 exit 0。
- 剩餘限制：尚未測無效／缺失 SRT、非零 runtime exit、stubborn child 強制終止、Breeze download endpoint POST／GET／DELETE 狀態競態。共用下載器的成功、HTTP、大小、SHA、timeout、取消與暫存清理已有 `scripts/test-whisper-model-download.mjs` 覆蓋，因此 download endpoint 缺口列為後續補強，不作為本輪額外阻擋；stubborn child 則併入上項條件式阻擋。

## 1. 需求完整性

- 判定：部分通過
- 證據：固定官方 revision／size／SHA、runtime capability、UI 實驗性提示、Whisper.cpp 預設、成功 SRT 與 graceful 取消均已具可追溯程式與測試證據；但 Windows／descendant 強制取消尚未可靠關閉。真實模型/runtime 不在本輪封裝範圍且文件已明列未驗證。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：非同步模型檢查、probe timeout、child-close 後才 settled 與 SRT sanitizer 流程邏輯正確；Windows tree-kill timer 可被父 child 的快速 close 取消，仍存在「顯示 cancelled 但 descendant 可能存活」風險。

## 3. 邊界情況

- 判定：部分通過
- 證據：已測缺檔、錯誤大小、mock valid、CPU／CUDA argv、hang probe timeout、server 成功 SRT、執行中取消、延遲 close、音訊／部分 SRT 清理；未測 3 秒強制終止、Windows tree、真實 3 GB I/O、磁碟不足、真實長音訊及 runtime OOM。

## 4. 程式碼品質

- 判定：部分通過
- 證據：模型 I/O async 化、probe 抽成獨立模組、mock runner 僅在 `NODE_ENV=test` 且顯式環境變數存在時啟用（`server.mjs:48-49`），production 固定模型驗證未被放寬；但取消策略仍把 direct-child 與 process-tree lifecycle 混在延遲 timer，Windows 次序需再收斂。

## 5. 測試覆蓋

- 判定：部分通過
- 證據與指令：
  - 2026-08-10 10:45:54：`node scripts/test-breeze-asr.mjs` exit 0。
  - 2026-08-10 10:45:54：Breeze／probe／mock runtime／server 的 `node --check` 均 exit 0。
  - 2026-08-10 10:45:54：`node scripts/test-whisper-model-download.mjs` exit 0；`git diff --check` exit 0。
  - 2026-08-10 約 10:46：受控權限 `npm run check` exit 0，包含新增 Breeze server 成功／取消案例及既有 Whisper／manual／核心回歸。
  - 缺口：stubborn child／SIGKILL／Windows tree 未測，故測試覆蓋尚不能判定完全通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：本機 deterministic server 已實際完成 FFmpeg 音訊準備、mock Breeze SRT、後續完成狀態與 graceful 取消清理；這證明產品 orchestration，不證明真實模型品質或第三方 runtime 相容性。本輪沒有下載真實 checkpoint、安裝官方 Python／PyTorch／patched Whisper、執行真實台灣華語／中英音訊，亦未在 Windows／macOS 安裝版驗證效能、記憶體、長音訊或取消。

## 綜合判定

- 結論：有條件通過
- 已關閉：同步 3 GB event-loop I/O、runtime probe 無 timeout、缺少 Breeze server 成功 SRT／graceful 取消測試三類 round1 阻擋。
- 條件式阻擋：修正並測試 stubborn child 的 grace→強制終止，以及 Windows process tree 不會因 parent 提前 close 而跳過 `taskkill /T /F`；完成前不得宣稱跨平台取消已驗證或把 FR-024 標示為無條件通過。
- 剩餘風險：真實約 3 GB checkpoint、官方 Python／PyTorch／patched Whisper、真實台灣華語／中英混用品質、字幕對齊、CPU／CUDA 效能／記憶體、長音訊、磁碟空間、安裝版與跨平台取消仍未驗證；mock／fixture 不得取代上述證據。
- 給主要開發代理的具體修正要求：只需針對上述取消條件修正與補測，重跑 focused core、`npm run check`、`git diff --check`，再建立 round3；Breeze download endpoint 的狀態整合與真實 3 GB／runtime 實測可保留為明確後續風險，不應偽稱本輪已完成。
- 可逐字引用完整結論句：**FR-024 Breeze ASR 25 實驗性本機轉錄整合 round2 獨立複審判定為有條件通過：非同步串流模型雜湊、15 秒 runtime capability probe timeout、server 端到端 mock SRT，以及 child close 後才完成 graceful 取消與清理均已通過獨立回歸，因而關閉 round1 的主要 deterministic 缺口；但現行 Windows 取消可能在父 child 快速 close 時清除延遲 taskkill timer，且尚無 stubborn child、強制終止與 process-tree 測試，所以在修正並複審此條件前不得宣稱跨平台取消或 FR-024 整體無條件通過，真實 3,087,008,569-byte checkpoint、官方 patched runtime、品質與效能亦仍明確未驗證。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
