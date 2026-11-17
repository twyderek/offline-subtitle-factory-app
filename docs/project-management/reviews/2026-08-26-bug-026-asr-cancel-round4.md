# 獨立複審報告：BUG-026 Whisper／FFmpeg 取消生命週期

- 審查對象 commit／版本：`aa37d156b302e32d0d84ac1b775e6c9b600745cf`、目前工作樹未提交差異、版本 `0.50.0`
- 對應 08-CHANGE-LOG 條目：2026-08-26 — Whisper／FFmpeg 取消後子程序與部分輸出清理（BUG-026）
- 審查輪次：round4
- 審查代理啟動時間、上下文來源：2026-08-26（Asia/Taipei）；本輪重新執行 `npm run project:preflight -- --type=full`，讀取 `AGENTS.md`、固定核心與 full 路由文件、BUG-026 round1／round2／round3 報告、目前 source／tests／fixtures／docs，並以獨立唯讀上下文自行執行驗證；除本報告外未修改任何檔案。

## Round3 後與 Round2 FFmpeg 修正複核

- `server.mjs:2164-2170` 的 FFmpeg `finish` 預設 `cleanupAudio = false`；成功 `close` 分支 `server.mjs:2200-2207` 以 `finish(() => resolve(audioFile))` 保留 `whisper-input.wav`，取消、child error 與非零失敗分支則明確以 `true` 清理。
- 成功保留鏈路可由目前 source 與 fixture 交叉核對：`runWhisper` 在 `server.mjs:1782` 接收音訊；Python／Whisper.cpp 分別把該路徑放入 `server.mjs:1830-1838`、`1991-1997` 的 child args；`scripts/fixtures/mock-whisper-python-runtime.mjs:10-15` 與 `scripts/fixtures/mock-whisper-cpp-runtime.mjs:10-15` 在 child 啟動時檢查 WAV 存在，缺失即 exit 3。
- round1 的 Python spawn 前清理與 ASR allowlist 仍存在：`server.mjs:1374-1387`、`1783-1827`、`1904-1919`、`2060-2075`；`scripts/test-core.mjs:554-569` 驗證 spawn 前取消不啟動 child 且不殘留音訊，`647-681` 驗證刪除部分 ASR／quality 輸出並保留 `edit-plan.json`、`trim-status.json`、`waveform-512.json`。
- 文件仍如實限制驗收範圍：`docs/project-management/08-CHANGE-LOG.md:13-14,25-30`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:18-25` 未把 deterministic mock 宣稱為 Windows 或真實 runtime 完整驗收；目前最新工作紀錄仍為進行中，round3／round4 尚未被寫回既有工作紀錄，符合本輪不得修改既有檔案的限制。

## 1. 需求完整性

- 判定：有條件通過
- 證據：BUG-026 成功條件要求 FFmpeg 音訊前處理、Python Whisper／Whisper.cpp 取消等待 child `close`、Unix SIGTERM→3 秒 grace→SIGKILL、Windows taskkill tree、暫存音訊與部分 SRT／JSON／品質檔清理，並維持正常成功／失敗／Metal fallback 行為（`docs/project-management/08-CHANGE-LOG.md:13`）。目前 source 已具備三條 deterministic 路徑的正常／取消控制流；round1 的 Python spawn 前音訊清理與廣泛 JSON 刪除缺口、round2 的 FFmpeg 成功音訊誤刪缺口，均已由目前 source、fixture 與核心回歸重新核對。Windows 實機、真實 Whisper／FFmpeg 長音訊、Metal fallback 與 Breeze runtime 不在本輪可證範圍，因此不能判定跨平台／真實 runtime 需求完整完成。

## 2. 邏輯正確性

- 判定：通過（限目前 source 與 deterministic 範圍）
- 證據：FFmpeg `finish` 的成功保留、取消／失敗清理分支可直接由 `server.mjs:2164-2207` 重放；成功音訊由 Python／Whisper.cpp child 實際消費的 args 位於 `server.mjs:1782,1830-1838,1991-1997`。Python／Whisper.cpp 在 abort 後先等待 child `close`，POSIX 先 `SIGTERM`、3 秒後 `SIGKILL`（`server.mjs:1871-1888,2024-2041`），Windows 使用 `taskkill /pid ... /T /F` 並等待 taskkill 與 child close 條件（`server.mjs:1872-1885,2025-2038`）。取消完成後只依明確 output basename 清理 `.srt`／`.json` 與 `quality-metadata.json`（`server.mjs:1380-1387`），不再掃描刪除非 ASR 工作檔。

## 3. 邊界情況

- 判定：部分通過
- 證據：本輪回溯並重新核對的可執行案例包括：Python spawn 前取消、音訊清理與 child 未啟動（`scripts/test-core.mjs:554-569`）；Python／FFmpeg child 尚未 close 時維持 `cancelling`、close 後才 `cancelled`（`:571-619`）；Whisper.cpp cancel 後清除 partial SRT／JSON／quality 並保留非 ASR 工作檔（`:647-681`）；POSIX stubborn Whisper.cpp 等待至少約 2.8 秒後再由 SIGKILL 收尾（`:703-722`）。FFmpeg fixture 會先產生輸出音訊（`scripts/fixtures/mock-ffmpeg-runtime.mjs:13-29`），Python／Whisper.cpp fixture 會檢查該音訊存在；但 Python／FFmpeg 各自 stubborn grace、Windows process tree／taskkill 競態、Unix descendant process group、真實長音訊、真實 Metal fallback 與 Breeze runtime 未執行，已在 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:24-25` 揭露。

## 4. 程式碼品質

- 判定：部分通過
- 證據：`removeWhisperPartialOutputs` 將 ASR 清理規則集中於 `server.mjs:1380-1387`；各 engine 明確傳遞 output basename，child 均使用 `shell:false`，並以 `settled` guard、timer 清理、close 等待及 Windows tree-kill 控制生命週期（`server.mjs:1859-1888,2009-2042,2160-2187`）。round2 修正後 FFmpeg 成功／失敗的清理責任由參數明確表達，降低成功路徑誤刪音訊的風險。仍有 Python、Whisper.cpp、FFmpeg 三處相似 abort／timer／Windows 狀態機重複，且 descendant process group 與真實 runtime 行為未被本輪實機證明；這是可維護性與驗證矩陣限制，未發現 round1／round2 所指的清理資料完整性缺陷仍存在。

## 5. 測試覆蓋

- 判定：有條件通過
- 證據：2026-08-26 10:55 CST 批次執行 `node --check server.mjs`、`node --check scripts/test-core.mjs`、三個 fixture 的 `node --check` 與 `git diff --check`，全部 exit 0。`node scripts/test-core.mjs` 在 sandbox 首次因 `listen EPERM`（`0.0.0.0:22258`）無法開始斷言；同一指令在允許本機 listener 的受控環境重跑 exit 0，輸出為「核心回歸測試通過」。同日 `npm run check` exit 0，包含 `docs:check`、所有 npm test、語法檢查與核心回歸；`package.json:20-21` 可回溯其測試入口。測試覆蓋成功音訊保留、spawn 前取消、三路徑取消 close、部分輸出清理、非 ASR 檔保留與 Whisper.cpp stubborn；未覆蓋 Windows 實機 taskkill、Python／FFmpeg 各自 stubborn、真實 runtime／長音訊或完整 engine×boundary 笛卡兒積。

## 6. 實際運行結果

- 判定：部分通過
- 證據：實際環境為 macOS、Node.js `v22.22.3`；上述五個 `node --check` 與 `git diff --check` exit 0，受控權限下 `node scripts/test-core.mjs` exit 0，`npm run check` exit 0，且核心輸出明確為「核心回歸測試通過」。這些是目前工作樹上的可實際執行 deterministic API／任務／fixture 證據，不是真實 Whisper.cpp、Python Whisper、FFmpeg 長音訊或 Windows 執行證據。`npm run docs:check:final` 於本輪 exit 1，唯一輸出原因為「08-CHANGE-LOG.md 的最新工作紀錄尚未標示為『完成』」；因本輪明確只可新增本報告，未修改工作紀錄、round1／round2／round3 或任何其他檔案。`

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**BUG-026 round4 獨立複審結論為有條件通過：round1 的 Python Whisper spawn 前暫存音訊清理與 ASR basename allowlist、round2 後的 FFmpeg `finish` 成功保留 `whisper-input.wav` 修正，均已由目前 source、Python／Whisper.cpp 音訊存在檢查 fixture、核心取消／清理回歸與完整 `npm run check` 重新驗證通過；deterministic 產品範圍內沒有新的阻擋問題，但 Windows taskkill／process tree、Python／FFmpeg stubborn、Unix descendant、真實 Whisper／FFmpeg 長音訊、Metal／Breeze runtime 與治理 `npm run docs:check:final` 仍未驗證或未通過，因此本結論不代表跨平台或真實 runtime 完整驗收。**
- 阻擋問題（若有）：無（deterministic 產品行為範圍）。治理結案的 `npm run docs:check:final` 仍未通過，原因是最新 BUG-026 工作紀錄尚未標示「完成」；這是本輪「只新增 round4 報告」限制下未能處理的文件收尾條件，不是本輪 deterministic 產品行為阻擋。
- 剩餘風險：Windows `taskkill /T /F` 真實 process tree 與 child-close 競態、Windows 實機安裝後取消、Unix descendant process group、Python／FFmpeg stubborn grace、真實 Whisper／FFmpeg 長音訊、Apple Metal fallback、Breeze runtime、跨平台字幕品質／效能，以及 deterministic fixture 不等同真實 runtime／跨平台實機驗收。
- 給主要開發代理的具體修正要求（若有）：不得覆寫本報告或 round1／round2／round3；若要治理結案，另開允許文件同步的工作，將本 round4 報告以逐字引用方式連結至最新工作紀錄、標示 BUG-026 完成後重跑 `npm run docs:check:final`。若要提高產品信心，再補 Python／FFmpeg stubborn grace、Windows taskkill／process-tree 實機與真實 Whisper／FFmpeg 長音訊證據。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
