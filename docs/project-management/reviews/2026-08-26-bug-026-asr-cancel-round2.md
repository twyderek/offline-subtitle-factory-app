# 獨立複審報告：BUG-026 Whisper／FFmpeg 取消生命週期

- 審查對象 commit／版本：`aa37d156b302`、工作樹未提交差異、版本 `0.50.0`
- 對應 08-CHANGE-LOG 條目：2026-08-26 — Whisper／FFmpeg 取消後子程序與部分輸出清理（BUG-026）
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-08-26（Asia/Taipei）；本輪重新讀取 `AGENTS.md`、debug preflight 列出的固定核心／路由文件、BUG-026 工作紀錄、round1 報告與目前差異，並以獨立唯讀上下文交叉核對，未把工作紀錄的「已處理」敘述當成驗收證據。

## Round1 條件複核

- Python Whisper spawn 前取消：已修正。`server.mjs:1782-1785` 在音訊建立後與工具狀態檢查後以 `throwIfJobCancelledWithAudioCleanup` 清理 `audioFile`；`server.mjs:1798-1799` 在 GPU 狀態檢查後再次清理；`server.mjs:1818-1822` 以 deterministic delay 讓取消發生在 spawn 前；`server.mjs:1824-1828` 的最後 spawn 前 guard 也 unlink `audioFile`。測試 `scripts/test-core.mjs:552-569` 確認 `whisper-input.wav` 不殘留且 child 未啟動。
- ASR partial output：已改為明確產物清單。`server.mjs:1380-1387` 只刪除呼叫端傳入的 output basename 的 `.srt`／`.json` 與固定 `quality-metadata.json`；Whisper Python 使用 `path.parse(audioFile).name`（`server.mjs:1880`、`1918`），Whisper.cpp 使用固定 `outputBase`（`server.mjs:2033`、`2074`），不再掃描工作目錄內所有 `.srt`／`.json`。`scripts/test-core.mjs:659-681` 實際確認 partial ASR／quality 檔刪除，且 `edit-plan.json`、`trim-status.json`、`waveform-512.json` 保留。
- deterministic 測試：正常完成由 Breeze／FFmpeg 路徑 `scripts/test-core.mjs:513-524`、Whisper.cpp `:526-537`、Python `:539-550` 覆蓋；取消後等待 close 由 Python `:571-595`、FFmpeg `:597-619`、Whisper.cpp `:647-678` 覆蓋；Python spawn 前競態由 `:552-569` 覆蓋；stubborn grace 由既有 Breeze `:683-701` 與新增 Whisper.cpp `:703-722` 覆蓋。這是跨路徑的 deterministic 覆蓋，不是每一 runtime 與每一邊界的完整笛卡兒積：Python／FFmpeg fixture 雖支援 stubborn（`scripts/fixtures/mock-whisper-python-runtime.mjs:13-14,25-36`、`scripts/fixtures/mock-ffmpeg-runtime.mjs:11-12,23-30`），目前沒有各自的 stubborn 測試；spawn 前競態也只對 Python 建立，符合 round1 指定缺口但仍是測試矩陣限制。
- Windows taskkill／真實 runtime：缺口已正確揭露。`server.mjs:1871-1885`、`2024-2038`、`2171-2182` 使用 `taskkill /pid <pid> /T /F` 並等待 taskkill 與 child close；`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:23-25` 明確列出 Windows taskkill 實機、真實 Whisper／FFmpeg 長音訊、Apple Metal fallback 與 Breeze runtime 未覆蓋；`08-CHANGE-LOG.md:13-14,23,26` 也明確禁止宣稱跨平台實機驗收。

## 1. 需求完整性

- 判定：部分通過
- 證據：BUG-026 成功條件仍要求 FFmpeg、Python Whisper、Whisper.cpp 取消等待 close、Unix grace／SIGKILL、Windows taskkill tree、暫存與 partial output 清理（`docs/project-management/08-CHANGE-LOG.md:13`）。round1 指出的兩個程式缺口已由上述 source／回歸測試修正；三條 deterministic 路徑均有正常與取消案例。但工作紀錄與稽核文件明確保留 Windows 實機與真實 runtime 未覆蓋（`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:18-25`），所以只能在本機 deterministic 範圍判定，不能宣稱完整跨平台／真實 runtime 需求已驗收。

## 2. 邏輯正確性

- 判定：通過（限目前 deterministic／source 可核對範圍）
- 證據：Python 在所有取消前檢查都以含音訊清理的 guard 處理（`server.mjs:1778-1822`），spawn 前 aborted guard 亦不啟動 child（`server.mjs:1824-1828`）。取消後的清理只依 output basename 與品質檔，不會刪除非 ASR 工作檔（`server.mjs:1380-1387,1914-1919,2070-2075`）。POSIX 先 SIGTERM、3 秒後 SIGKILL（`server.mjs:1886-1888,2039-2041,2183-2185`）；Windows 需同時完成 tree-kill 與 child close 才 settle（`server.mjs:1871-1885,2024-2038,2171-2182`）。

## 3. 邊界情況

- 判定：部分通過
- 證據：已實際覆蓋 Python spawn 前取消且無 child／音訊殘留（`scripts/test-core.mjs:552-569`）、三條路徑 child 尚未 close 時保持 `cancelling` 並於 close 後 `cancelled`（`:571-619,647-678`）、非 ASR metadata 保留（`:659-681`）及 POSIX stubborn grace→強制終止（`:683-722`）。但 Python／FFmpeg 各自的 stubborn grace、Windows 真實 process tree、Unix descendant process group、真實 Whisper／FFmpeg 長音訊與 Metal fallback 仍未執行；fixture 與 macOS 測試不能取代這些外部邊界，且文件已正確列為剩餘風險（`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:25`）。

## 4. 程式碼品質

- 判定：部分通過
- 證據：清理邏輯已集中至 `removeWhisperPartialOutputs`（`server.mjs:1380-1387`），呼叫端明確傳遞 output basename，且 `shell:false`、Windows tree-kill、close 等待與 idempotent `settled` guard 均可追溯（`server.mjs:1845-1869,1999-2023,2155-2170`）。仍有 Python、Whisper.cpp、FFmpeg 三處相似的取消／timer／Windows 狀態機重複；另外測試 fixture 的 stubborn 能力未對 Python／FFmpeg 各自實際執行，故品質與可維護性改善尚非完整矩陣，但沒有發現 round1 所指的廣泛副檔名刪除問題。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-08-26 本輪 `node --check server.mjs`、三個 fixture、`scripts/test-core.mjs` 均 exit 0；`git diff --check` exit 0。沙箱內 `node scripts/test-core.mjs` 因本機 listener `0.0.0.0:22817` 回報 `listen EPERM`，未產生斷言結果；在允許本機 listener 的受控環境重跑，輸出為「核心回歸測試通過」。同一受控環境的 `npm run check` exit 0，包含 `docs:check`、所有 npm test、三個新 fixture 路徑與完整核心回歸。測試已補足 round1 要求的 Python spawn 前清理、Python／FFmpeg cancel-close、allowlist 保留與正常案例；但沒有 Windows 實機 taskkill，也沒有 Python／FFmpeg stubborn grace 的獨立案例，因此不能判定所有 engine×boundary 組合均覆蓋。

## 6. 實際運行結果

- 判定：部分通過
- 證據：本機 macOS、Node.js `v22.22.3` 實際以受控 listener 執行 `node scripts/test-core.mjs` 與 `npm run check` 均 exit 0；核心輸出包含 API／任務回歸與新增取消清理案例。`server.mjs` 的 Windows 分支是可靜態核對的 `taskkill /T /F` 控制流，但本輪沒有 Windows runner／實機與 descendant process tree 證據；也沒有真實 Python Whisper、FFmpeg 長音訊或 Breeze runtime。`npm run docs:check:final` 本輪 exit 1，明確報告最新 BUG-026 工作紀錄尚未標示「完成」，並指出 round1 報告缺少目前 validator 要求的「可逐字引用的完整結論句」與「阻擋問題欄位」；依使用者「只能新增 round2 報告」限制，本輪未修改工作紀錄或 round1。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**BUG-026 round2 獨立複審結論為有條件通過：Python Whisper spawn 前取消已清理 whisper-input.wav，ASR partial cleanup 已改為明確 basename allowlist 並保留 edit-plan.json、trim-status.json 與 waveform*.json，FFmpeg／Python／Whisper.cpp 的正常與取消 close 以及 Python spawn 前競態均已由可實際執行的 deterministic 回歸覆蓋；但 Python／FFmpeg 各自 stubborn grace、Windows taskkill 實機、Unix descendant process group、真實 Whisper／FFmpeg 長音訊、Metal fallback 與 Breeze runtime 仍未驗證，且本輪不得藉由修改其他文件完成 docs:check:final，因此不得將本輪視為跨平台或真實 runtime 完整驗收。**
- 阻擋問題（若有）：本輪 round1 指出的兩個產品行為缺口已解除；若要將 BUG-026 標示為治理結案，仍須由主要代理在另一輪允許文件收尾的工作中更新工作紀錄／審查連結並重跑 `npm run docs:check:final`。Windows taskkill 與真實 runtime 未驗證是已揭露的剩餘風險，不是本輪 deterministic 修正的假證據。
- 剩餘風險：Windows `taskkill /T /F` 真實 process tree、Windows child close／taskkill 競態、Unix descendant process group、Python／FFmpeg stubborn grace、真實 Whisper／FFmpeg 長音訊、Apple Metal fallback、Breeze runtime、跨平台安裝後取消均未實測；deterministic mock 不等同真實 runtime 或跨平台實機驗收。另 `docs:check:final` 在本輪因明確禁止修改其他文件而未通過。
- 給主要開發代理的具體修正要求（若有）：不得覆寫本報告或 round1；若進行治理結案，另開允許文件同步的工作，將本 round2 報告以逐字引用方式加入最新工作紀錄，修正 round1／工作紀錄與 validator 的結構契約後重跑 `npm run docs:check:final`。若需提高測試信心，再補 Python／FFmpeg stubborn grace 與 Windows runner／實機 process-tree 證據。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
