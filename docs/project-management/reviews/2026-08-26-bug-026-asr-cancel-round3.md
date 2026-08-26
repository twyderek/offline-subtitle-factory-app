# 獨立複審報告：BUG-026 Whisper／FFmpeg 取消生命週期

- 審查對象 commit／版本：`aa37d156b302e32d0d84ac1b775e6c9b600745cf`、目前工作樹未提交差異、版本 `0.50.0`
- 對應工作紀錄：`docs/project-management/08-CHANGE-LOG.md:3-30` 的 BUG-026 條目
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-08-26（Asia/Taipei）；本輪重新執行 debug preflight，讀取 `AGENTS.md`、固定核心／debug 路由文件、BUG-026 工作紀錄、round1／round2 報告與目前差異，並自行重跑驗證；除本報告外未修改任何檔案。

## Round2 條件複核

- Round1 的 Python spawn 前取消清理已保留：`server.mjs:1374-1378` 定義含音訊清理的取消 guard，`server.mjs:1782-1785,1798-1799,1818-1827` 在音訊建立後、工具／GPU 檢查後、deterministic delay 後及最後 spawn 前均清理 `audioFile`；`scripts/test-core.mjs:554-569` 實際確認 spawn 前取消後 `whisper-input.wav` 不存在且 child 未啟動。
- Round1 的廣泛副檔名刪除已修正為 allowlist：`server.mjs:1380-1387` 只刪除呼叫端指定 basename 的 `.srt`／`.json` 與 `quality-metadata.json`；Python／Whisper.cpp 取消 close 分支分別以 `server.mjs:1908,1918` 與 `server.mjs:2064,2074` 傳入明確 output base；`scripts/test-core.mjs:659-681` 實際確認部分 ASR／quality 檔刪除且 `edit-plan.json`、`trim-status.json`、`waveform-512.json` 保留。
- Round2 後 FFmpeg 成功保留音訊的修正正確：`prepareWhisperAudio` 的 `finish` 在 `server.mjs:2164-2170` 以 `cleanupAudio = false` 為預設；取消／child error／非零失敗分支在 `server.mjs:2191-2199,2200-2207` 明確傳入 `true`，而成功分支 `server.mjs:2206` 呼叫 `finish(() => resolve(audioFile))` 不傳 `true`，因此成功時保留 `whisper-input.wav` 並交給 `runWhisper`；`runWhisper` 接收該路徑於 `server.mjs:1782`，Python args 於 `server.mjs:1830-1838` 使用，Whisper.cpp args 於 `server.mjs:1991-1997` 使用。
- 新增 fixture 確實檢查音訊存在：Python fixture `scripts/fixtures/mock-whisper-python-runtime.mjs:6-15` 與 Whisper.cpp fixture `scripts/fixtures/mock-whisper-cpp-runtime.mjs:6-15` 均在 child 啟動後對傳入 WAV 執行 `fs.existsSync`，不存在時寫入診斷檔並以 exit code 3 結束；FFmpeg fixture `scripts/fixtures/mock-ffmpeg-runtime.mjs:13-19,22-29` 負責產生音訊，後續 Python／Whisper.cpp 成功案例由 `scripts/test-core.mjs:526-552` 實際消費該音訊，因此成功前處理保留鏈路有可執行證據。
- Round2 已揭露的矩陣限制仍成立：`docs/project-management/08-CHANGE-LOG.md:13-14,25-30` 與 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:21-25` 均禁止把 deterministic 測試宣稱為 Windows 或真實 runtime 完整驗收；round2 報告也明列 Python／FFmpeg stubborn、Windows taskkill 實機、Unix descendant、真實長音訊與 Metal／Breeze runtime 未驗證（`docs/project-management/reviews/2026-08-26-bug-026-asr-cancel-round2.md:12-13,27-50`）。

## 1. 需求完整性

- 判定：有條件通過。
- 證據：BUG-026 成功條件要求 FFmpeg 音訊前處理、Python Whisper／Whisper.cpp 取消等待 child `close`、Unix SIGTERM→grace→SIGKILL、Windows taskkill tree、暫存音訊與部分 SRT／JSON／品質檔清理（`docs/project-management/08-CHANGE-LOG.md:13`；`docs/project-management/03-FUNCTIONAL-DESIGN.md:121`）。目前 source 已覆蓋三條 deterministic 路徑的正常／取消控制流，且 round1 兩個產品行為缺口與 round2 的 FFmpeg 成功音訊保留缺口均已修正並由回歸鏈路核對；但 Windows 實機、真實 Whisper／FFmpeg 長音訊、Metal fallback 與 Breeze runtime 仍未驗證，故不能判定完整跨平台／真實 runtime 需求已完成。

## 2. 邏輯正確性

- 判定：通過（限目前 source 與 deterministic 範圍）。
- 證據：FFmpeg `finish` 的預設 `false`、取消／失敗傳 `true`、成功不清理的分支可直接由 `server.mjs:2164-2207` 重放；成功後的音訊路徑確實被 Python／Whisper.cpp child 使用（`server.mjs:1782,1830-1838,1991-1997`）。Python／Whisper.cpp 取消均先進入 abort handler，再在 child `close`／Windows tree-kill 條件滿足後清理 partial outputs 並 reject（`server.mjs:1871-1888,1904-1923,2024-2042,2060-2087`）；POSIX 3 秒後才 SIGKILL，Windows 使用 `taskkill /T /F`（`server.mjs:1872-1888,2025-2042`）。round1 指出的音訊殘留與非 ASR metadata 誤刪在目前控制流已不再存在。

## 3. 邊界情況

- 判定：部分通過。
- 證據：Python spawn 前取消與 child 未啟動由 `scripts/test-core.mjs:554-569` 覆蓋；Python／FFmpeg child 尚未 close 時維持 `cancelling`、close 後才 `cancelled` 由 `scripts/test-core.mjs:571-619` 覆蓋；Whisper.cpp 取消時的 partial SRT／JSON／quality 清理與非 ASR 檔保留由 `scripts/test-core.mjs:647-681` 覆蓋；POSIX stubborn grace→SIGKILL 由 `scripts/test-core.mjs:683-722` 覆蓋。仍未執行 Python／FFmpeg 各自 stubborn grace、Windows 真實 process tree／taskkill 競態、Unix descendant process group、真實長音訊、真實 Metal fallback 或 Breeze runtime；這些限制已在 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:24-25` 如實揭露。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：清理責任已抽成 `removeWhisperPartialOutputs`（`server.mjs:1380-1387`），輸出 basename 由各 engine 明確提供；`shell:false`、`settled` idempotent guard、取消 timer 清除、Windows tree-kill 與 close 等待均可追溯（`server.mjs:1859-1888,2009-2042,2158-2187`）。仍有 Python、Whisper.cpp、FFmpeg 三處相似的 abort／timer／Windows 狀態機重複，且 fallback／真實 process tree 的可維護性與行為未由本輪實機證明；這是品質與驗證矩陣限制，不是 round1 已修正的資料清理缺陷。

## 5. 測試覆蓋

- 判定：有條件通過。
- 證據：成功案例 `scripts/test-core.mjs:526-552` 同時跑 Whisper.cpp 與 Python fixture；兩 fixture 各自以 `fs.existsSync(audioFile)` 驗證音訊，若 `prepareWhisperAudio` 成功 callback 誤刪音訊便會 exit 3，且測試的 completed assertion 會失敗。取消／清理／保留案例位於 `scripts/test-core.mjs:554-681`，Whisper.cpp stubborn grace 位於 `:703-722`；`npm run check` 亦將 `node scripts/test-core.mjs` 納入 `npm test`。但沒有 Windows 實機 taskkill、Python／FFmpeg stubborn 的獨立案例、真實 runtime／長音訊或所有 engine×boundary 笛卡兒積，因此不是完整矩陣覆蓋。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：`node --check server.mjs && node --check scripts/test-core.mjs && node --check scripts/fixtures/mock-whisper-cpp-runtime.mjs && node --check scripts/fixtures/mock-whisper-python-runtime.mjs && node --check scripts/fixtures/mock-ffmpeg-runtime.mjs && git diff --check` exit 0。首次在 sandbox 執行 `node scripts/test-core.mjs` 因 `listen EPERM`（本機 `0.0.0.0:22190`）exit 1；取得本機 listener 權限後同一指令 exit 0，輸出為「核心回歸測試通過」。`npm run check` exit 0，包含 `docs:check`、全部列出的 npm test、語法檢查與核心回歸；實際 Node.js 為 `v22.22.3`。`npm run docs:check:final` exit 1，唯一報告原因是 `08-CHANGE-LOG.md` 最新 BUG-026 工作紀錄仍未標示「完成」（目前 `docs/project-management/08-CHANGE-LOG.md:5-6,20,27` 仍為進行中／round3 待執行）。本輪沒有 Windows runner／實機、真實 Whisper／FFmpeg／Breeze runtime 或長音訊證據。

## Round1／Round2 修正與文件如實揭露總結

- Round1 的 Python spawn 前 `whisper-input.wav` 清理、ASR basename allowlist 與非 ASR 工作檔保留，已由目前 source／`scripts/test-core.mjs:554-569,647-681` 實際核對；Round2 的 FFmpeg 成功 callback 音訊保留，已由 `server.mjs:2164-2207` 與 Python／Whisper.cpp fixture 的存在檢查重新核對。
- 文件沒有把 deterministic 結果冒充 Windows／真實 runtime 驗收：`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:24-25`、`docs/project-management/08-CHANGE-LOG.md:25-30` 明列未覆蓋項目；round2 報告也保留相同風險。唯一尚未通過的是治理 final gate，因本輪受「只新增 round3 報告」限制不能把工作紀錄改為完成或補寫 round3 連結。

## 綜合判定

- 結論：有條件通過。
- 剩餘風險：Windows `taskkill /T /F` 真實 process tree 與 child-close 競態、Unix descendant process group、Python／FFmpeg stubborn grace、真實 Whisper／FFmpeg 長音訊、Apple Metal fallback、Breeze runtime、macOS／Windows 安裝後取消，以及真實字幕品質／效能均未實測；deterministic fixture 不等同跨平台或真實 runtime 驗收。
- 後續條件：若要治理結案，須在另一個允許文件同步的工作中更新 BUG-026 工作紀錄的 round3 連結／判定與完成狀態，再重跑 `npm run docs:check:final`；不得覆寫 round1／round2／本報告。
- 可逐字引用的完整結論句：**BUG-026 round3 獨立複審結論為有條件通過：`prepareWhisperAudio` 的 FFmpeg `finish` 僅在取消或失敗時清理 `audioFile`、成功時保留音訊供 Whisper 使用，Python／Whisper.cpp fixture 實際檢查音訊存在，round1／round2 的產品行為修正與本機 deterministic 回歸、完整 `npm run check` 均已通過；但 Windows taskkill／process tree、Python／FFmpeg stubborn、Unix descendant、真實 Whisper／FFmpeg 長音訊、Metal／Breeze runtime 與治理 `npm run docs:check:final` 仍未驗證或未通過，因此本結論不代表跨平台或真實 runtime 完整驗收。**
- 阻擋問題（若有）：本輪沒有 deterministic 產品行為阻擋；治理結案仍受 BUG-026 工作紀錄尚未標示完成且未連結本 round3 報告所阻擋，需另開允許文件同步的工作後重跑 `npm run docs:check:final`。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
