# 獨立審查報告：BUG-026 Whisper／FFmpeg 取消生命週期

- 審查對象 commit／版本：`aa37d156b302e32d0d84ac1b775e6c9b600745cf`、工作樹未提交差異、版本 `0.50.0`
- 對應 08-CHANGE-LOG 條目：2026-08-26 — Whisper／FFmpeg 取消後子程序與部分輸出清理（BUG-026）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-26（Asia/Taipei）；本輪以獨立審查上下文重新讀取專案規範、BUG-026 差異、指定治理文件並自行執行驗證，未採用主要開發代理的評價性摘要

## 1. 需求完整性

- 判定：不通過
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:3-28` 明確要求 FFmpeg 音訊前處理、Python Whisper、Whisper.cpp 取消時等待 child `close`，Unix 先 SIGTERM、3 秒 grace period 後 SIGKILL，Windows 使用 taskkill tree，並清理暫存音訊、部分 SRT／JSON／品質檔。
  - `docs/project-management/03-FUNCTIONAL-DESIGN.md:118` 已同步描述 `cancelling`、等待 close、平台終止策略與輸出清理；`06-TEST-AND-PROCESS-AUDIT.md:18-26` 也列出對應測試與未覆蓋項目。
  - `server.mjs:1830-1900`、`1992-2063`、`2142-2190` 已實作 Python Whisper、Whisper.cpp 與 FFmpeg 的 close 後取消處理；但 Python 路徑 `server.mjs:1798-1802` 在已建立音訊暫存檔後若 signal 已 aborted，直接 reject，沒有刪除 `audioFile`，因此未滿足所有取消清理成功條件。
  - `server.mjs:1842-1848` 與 `2003-2009` 以所有 `.srt`／`.json` 檔案作廣泛刪除；同一工作樹中 `retryJob` 明確把 `edit-plan.json`、`trim-status.json` 與 waveform JSON 列為必須保留的檔案（`server.mjs:1476-1483`），顯示取消清理範圍未完整區分「部分 ASR 輸出」與既有修剪／快取資料。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - 通過部分：Unix 分支在 `server.mjs:1865-1868`、`2026-2029`、`2167-2169` 先 SIGTERM 並設定 3 秒 SIGKILL；Windows 分支在 `server.mjs:1851-1864`、`2012-2025`、`2155-2166` 以 taskkill `/T /F`，且 cancellation 只在 child close 後完成（例如 `server.mjs:1893-1899`、`2057-2063`）。
  - 阻擋問題一：Python Whisper 在 `runWhisper` 已由 `prepareWhisperAudio` 取得 `audioFile`（`server.mjs:1765`）並完成 `getGpuStatus` 後，若取消發生於 spawn 前，`server.mjs:1798-1802` 只 reject `JOB_CANCELLED`，沒有 unlink；這是可達的取消競態，會留下 `working/whisper-input.wav`。
  - 阻擋問題二：`removePartialOutputs` 的副檔名掃描（`server.mjs:1842-1848`、`2003-2009`）會刪除 `working/edit-plan.json`、`working/trim-status.json` 與 `working/waveform*.json`，但這些不是本次 child 產生的部分 ASR 輸出，可能破壞非破壞式修剪的可恢復狀態與 waveform 快取。
  - `runWhisperCpp` 的 Metal fallback 在 `server.mjs:2065-2072` 仍保留；取消先於 fallback 判定，正常成功／失敗路徑未被本輪變更顯著改寫，但上述兩個取消清理問題足以阻擋結案。

## 3. 邊界情況

- 判定：不通過
- 證據：
  - 已實測的邊界：`scripts/test-core.mjs:563-591` 驗證 Whisper.cpp child 尚未 close 時維持 `running/cancelling`，close 後才 `cancelled`，並清理音訊、部分 SRT、部分 JSON、quality metadata；`scripts/test-core.mjs:613-632` 驗證 Unix stubborn child 等待至少約 2.8 秒後由 SIGKILL 結束並清理輸出。
  - 未覆蓋的取消邊界：沒有測試 Python Whisper 在 `getGpuStatus` 完成至 spawn 前取消、FFmpeg child 尚未 close 時取消、或取消時工作目錄同時存在 `edit-plan.json`／`trim-status.json`／waveform JSON 的保留性。
  - 平台邊界：測試僅在目前 macOS 環境執行；`06-TEST-AND-PROCESS-AUDIT.md:23-26` 自身也承認 Windows taskkill 實機、真實 Whisper／FFmpeg 長音訊、Apple Metal fallback 與 Breeze 真實 runtime 未覆蓋。Windows taskkill 只存在 source 分支，沒有本輪可回溯的 Windows 執行證據。
  - 子程序樹邊界：Unix 只對直接 child 呼叫 `child.kill`（`server.mjs:1866`、`2027`、`2168`），沒有 process-group／descendant 的 deterministic 證據；若實際 Whisper／FFmpeg 另生子程序，仍有背景寫檔風險，列為剩餘風險。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - `server.mjs:1830-1869`、`1992-2030`、`2142-2171` 三處重複維護 `settled`、grace timer、Windows tree kill、child close 狀態與 abort handler；重複結構仍可讀，且 `finish` 使用 idempotent guard，避免重複 resolve／reject。
  - `server.mjs:1842-1848`、`2003-2009` 的目錄全掃副檔名策略過於寬鬆，未採用本次 ASR 產物 allowlist，也未重用 `retryJob` 已存在的保留規則，造成可預見的資料完整性風險。
  - `scripts/fixtures/mock-whisper-cpp-runtime.mjs:21-41` 對正常、延遲、忽略 SIGTERM 三種 fixture 行為清楚；但 fixture 只覆蓋 Whisper.cpp，無法支撐同一套取消邏輯在 FFmpeg／Python 上的品質結論。
  - `node --check` 與 `git diff --check` 均通過，未發現語法或 whitespace 問題；這不能抵銷上述生命週期與清理範圍問題。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-08-26 10:19:25（Asia/Taipei）：`node --check server.mjs`、`node --check scripts/fixtures/mock-whisper-cpp-runtime.mjs`、`node --check scripts/test-core.mjs`、`git diff --check` 通過。
  - 2026-08-26 10:19:29：sandbox 內 `node scripts/test-core.mjs` 因本機 listener `listen EPERM` 結束，沒有產生測試斷言結果；這是執行環境限制。
  - 2026-08-26 10:19:41-10:19:50：在允許本機 listener 的環境重跑 `node scripts/test-core.mjs`，通過；輸出明確包含 API／任務回歸、Whisper.cpp mock 完成、取消等待、stubborn child grace period 與部分檔案清理。
  - 2026-08-26 10:19:56-10:19:59：sandbox 內 `npm run check` 在既有回歸項目通過後，於 `test-core.mjs` 再次因 listener `EPERM` 中止。
  - 2026-08-26 10:20:11-10:20:23：在允許本機 listener 的環境重跑 `npm run check`，`docs:check`、所有列出的 npm test 項目、語法檢查與核心回歸均通過。
  - 測試新增集中於 `scripts/test-core.mjs:523-632` 的 Whisper.cpp mock，沒有對 BUG-026 成功條件中的 FFmpeg／Python 取消、spawn 前競態、保留修剪 metadata 或 Windows taskkill 建立等價回歸案例，因此覆蓋不足。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 實際執行環境為本機 macOS、Node.js `v22.22.3`；核心測試與完整 `npm run check` 在允許本機 HTTP listener 後均以 exit 0 結束，證明 deterministic mock 與既有回歸可運行。
  - 測試實際執行的是 `scripts/fixtures/mock-whisper-cpp-runtime.mjs`，不是封裝內真實 Whisper.cpp、Python Whisper 或 FFmpeg 長音訊流程；因此不能把本輪成功輸出等同真實 runtime／跨平台驗收。
  - 2026-08-26 10:20:27 的 `npm run docs:check:final` 以 exit 1 結束，具體原因是最新 BUG-026 工作紀錄仍未標示「完成」、仍含「待執行」，且「獨立審查是否執行」仍為待執行（`docs/project-management/08-CHANGE-LOG.md:5-26`）。
  - 目前工作樹仍包含 BUG-026 的未完成文件與程式差異，以及既有 SYNC-025 報告；本報告只針對 BUG-026，沒有把其他工作樹變更當成本輪驗收證據。

## 綜合判定

- 結論：不通過
- 阻擋問題：
  1. Python Whisper 在 `server.mjs:1798-1802` 的 spawn 前取消分支未清理已建立的 `whisper-input.wav`，違反取消後暫存音訊清理要求。
  2. `server.mjs:1842-1848`、`2003-2009` 的廣泛 `.json`／`.srt` 清理會刪除非部分 ASR 輸出的修剪計畫、修剪狀態與 waveform 快取，存在資料遺失／無法恢復修剪狀態風險。
  3. 高風險成功條件要求 FFmpeg、Python Whisper 與 Whisper.cpp 以及 Windows taskkill；目前只有 Whisper.cpp deterministic fixture／macOS 實際執行證據，缺少其餘路徑的可回溯回歸或實機證據。
- 剩餘風險：真實 Whisper／FFmpeg 長音訊、Windows taskkill tree、Unix descendant process group、Apple Metal fallback 的真實 runtime 行為、Breeze 真實 runtime 與跨平台安裝後取消仍未驗收；`docs:check:final` 亦須由主要代理完成 BUG-026 工作紀錄收尾後重跑。
- 給主要開發代理的具體修正要求：
  - round2 前將 ASR cleanup 改為明確的產物 allowlist／保留清單，至少保留 `edit-plan.json`、`trim-status.json`、`waveform*.json` 與其他非本次轉錄產物，並新增取消後保留修剪狀態的回歸測試。
  - round2 前在 Python Whisper spawn 前 cancellation branch 清理 `audioFile`，並加入可穩定觸發「音訊已建立、child 尚未啟動」競態的測試；同時補 FFmpeg cancel-after-start／close-after-cancel 測試。
  - round2 前補 Windows taskkill tree 的可回溯測試或受控 Windows 實機證據，並在工作紀錄完成實際修改／測試結果、連結本報告後重跑 `npm run docs:check:final`；修正若改變結論，必須新增 round2 報告，不得覆寫本報告。

**完整單句結論：本輪 BUG-026 獨立審查結論為不通過：Whisper.cpp deterministic 取消等待與完整回歸雖已在 macOS 通過，但 Python Whisper spawn 前暫存音訊洩漏、取消時廣泛刪除非部分 ASR metadata，以及 FFmpeg／Python／Windows 路徑證據不足仍未解除，因此在完成上述修正、補足回歸或平台證據並通過 round2 前不得結案。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
