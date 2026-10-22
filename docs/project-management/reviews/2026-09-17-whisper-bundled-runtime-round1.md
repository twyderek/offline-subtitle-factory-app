# 獨立審查報告：Whisper bundled runtime Metal／CPU 對照重驗（BUG-WHISPER-METAL-139）

- 審查對象 commit／版本：目前工作樹／0.51.0 開發中；本輪未修改程式或 runtime 資產
- 對應 08-CHANGE-LOG 條目：2026-09-17 — Whisper bundled runtime Metal／CPU 對照重驗（BUG-WHISPER-METAL-139）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-09-17（Asia/Taipei）；獨立只讀審查上下文，依目前工作樹本輪 evidence、runtime 資產、`00-CURRENT-STATUS.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md` 與相關 validator／測試程式核對。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-24` 將本輪範圍定義為目前 macOS arm64 bundled `whisper-cli`／Tiny 與 1 秒 16 kHz 單聲道靜音 WAV 的 Metal／CPU 對照，成功條件包含 exit code、SRT／JSON 產出、stderr 摘要、SHA-256 與暫存清理；同處明確排除中文語音品質、長音訊、取消、跨平台、乾淨安裝與 LM Studio。`docs/project-management/evidence/2026-09-17-whisper-bundled-runtime-recheck.json:3-11,49-60` 逐項記錄相同範圍與未驗證清單，與 `00-CURRENT-STATUS.md:23-26`、`06-TEST-AND-PROCESS-AUDIT.md:26-33`、`07-DEBUG-AND-FIX-HISTORY.md:167-180` 一致。前一輪產品 fallback fixture 與本輪 bundled runtime 對照亦在治理文件中分開記錄，沒有把兩者合併為同一種驗收。

## 2. 邏輯正確性

- 判定：通過
- 證據：`server.mjs:2047-2082` 只在 `darwin`／`arm64` 且未 `forceCpu` 時使用 Metal；`server.mjs:2175-2183` 對首次 child 非零退出呼叫 `shouldRetryWhisperOnCpu`，刪除同一 output base 的 `.srt`／`.json` 後以 `forceCpu=true` 重跑，並保留 CPU 失敗為 failed。`lib/whisper-fallback-policy.mjs:1-2` 與 `scripts/test-whisper-fallback-policy.mjs:4-10` 覆蓋平台、架構、`forceCpu` 與退出碼矩陣。`lib/whisper-models.mjs:114-130` 將 `forceCpu` 映射為 `--no-gpu`。因此 evidence 的 Metal 無輸出、CPU 成功輸出，與程式的實際 fallback 邊界一致；本輪不把 evidence 說成產品 server 已由真實 bundled CLI 完成 fallback。

## 3. 邊界情況

- 判定：部分通過
- 證據：已具體覆蓋並記錄 Metal exit `139`、CPU `--no-gpu`、Metal 無 SRT／JSON、CPU 有 SRT／JSON、CPU JSON 缺 segment-level confidence／no-speech、token probability 存在，以及暫存清理：`docs/project-management/evidence/2026-09-17-whisper-bundled-runtime-recheck.json:19-47`。`server.mjs:1476-1483,2175-2180` 也可確認 partial SRT／JSON 與 quality metadata 的清理路徑；`lib/whisper-quality.mjs:36-63` 對缺失、無效、數量不一致與時間／ID 不吻合採安全回落。惟本輪 evidence 明確未驗證長音訊、取消中的 retry、其他 macOS 架構、Windows、乾淨安裝或真實使用者媒體（evidence:51-58）；這些是已揭露的範圍外風險，不構成本輪短靜音對照的阻擋問題。

## 4. 程式碼品質

- 判定：通過
- 證據：本輪未修改 `server.mjs`、`tools/whisper-cpp/whisper-cli` 或 `tools/whisper-models/ggml-tiny.bin`；server 使用明確的 child-process、`--no-gpu`、output-base 清理與 `forceCpu` 邊界，品質 parser 只讀明示欄位，不以 token probability 臆造 segment confidence／no-speech。`node --check server.mjs`、`node --check lib/whisper-models.mjs`、`node --check lib/whisper-fallback-policy.mjs` 與 `git diff --check` 於 2026-09-17T09:42:42+08:00 後執行均通過。治理文件也將 deterministic child-process fixture（`06-TEST-AND-PROCESS-AUDIT.md:18-24`）與真實 bundled runtime 對照（同檔:26-33）分層保存。

## 5. 測試覆蓋

- 判定：通過
- 證據：2026-09-17T09:42:42+08:00 後實際執行 `npm run runtime:verify:mac`，輸出 `[runtime] OK: darwin-arm64` 並解析 bundled FFmpeg、Whisper.cpp 與 Tiny 路徑；執行 `node scripts/test-whisper-fallback-policy.mjs`，輸出「平台、架構、forceCpu 與退出碼矩陣」通過；執行 `node scripts/test-whisper-quality.mjs`，輸出「JSON 解析、時間對應、缺失與不一致回落」通過；並執行上述 Node 語法檢查與 `git diff --check`，exit `0`。既有核心整合測試的 Metal fallback 斷言位於 `scripts/test-core.mjs:650-664`，覆蓋 `ready-review`、`whisperDevice=cpu`、首次 139 marker、partial 清理與最終 SRT；本輪治理文件另記錄完整 `npm run check` 與 `docs:check:final` 已由開發驗證執行（`08-CHANGE-LOG.md:18-24`、`06-TEST-AND-PROCESS-AUDIT.md:30-33`）。

## 6. 實際運行結果

- 判定：通過
- 證據：`docs/project-management/evidence/2026-09-17-whisper-bundled-runtime-recheck.json:13-47` 記錄實際 asset／model、共用產品 flags `-m -f -l zh -osrt -oj -ojf -of`、Metal 不帶 `--no-gpu` 與 CPU 帶 `--no-gpu` 的對照：Metal exit `139`，stderr 為 `ggml_metal_buffer_init: error: failed to allocate buffer, size = 2.20 MiB`，SRT／JSON 均為 false；CPU exit `0`，SRT／JSON 均為 true，JSON 有 1 個 transcription segment，欄位只有 offsets／text／timestamps／tokens，segment confidence／no-speech 均不存在，且暫存 input／output 已清理。2026-09-17T09:42:42+08:00 的只讀檢查確認 `tools/whisper-cpp/whisper-cli` 為 `Mach-O 64-bit executable arm64`、可執行，SHA-256 為 `6167fe4817a85cb011cbb58abf53f80a9e9488be26b99348e9ff6f655edc7a08`；Tiny model SHA-256 為 `be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21`，均與 evidence:14-17 相符。另以 `./tools/whisper-cpp/whisper-cli --help` 核對到 `--output-srt`、`--output-json`、`--output-json-full`、`--output-file` 與 `--no-gpu` 選項。此結果只證明目前這組 macOS arm64 bundled runtime 的短靜音對照，不是中文語音品質、長音訊、產品 server 真實 fallback 或跨平台驗收。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 BUG-WHISPER-METAL-139 bundled runtime Metal／CPU 對照重驗有條件通過：目前 macOS arm64 bundled whisper-cli／Tiny 對 1 秒靜音 WAV 實際呈現 Metal exit 139 且無 SRT／JSON、CPU `--no-gpu` exit 0 且產生 SRT／JSON，CPU JSON 缺少 segment-level confidence／no-speech 的記錄與 runtime 資產、程式邊界及測試證據一致；本結論不代表中文語音品質、長音訊、產品 server 真實 fallback、取消中的 retry、其他 macOS 架構、Windows、乾淨安裝或跨平台驗收。**
- 阻擋問題（若有）：無。本輪範圍內未發現 evidence、runtime 資產、`server.mjs` 真實 fallback 邊界與四份治理文件之間的阻擋性矛盾；`08-CHANGE-LOG.md:15-24` 的審查欄位在本報告建立前仍標示待執行，屬主要代理後續文件結案同步，不是本輪 runtime 對照結果的阻擋問題。
- 剩餘風險：真實產品 server 以 bundled CLI 自動 fallback 尚未由本輪實際 runtime 執行證明；長音訊／真實中文語音品質、取消中的 retry 時序、quality metadata 欄位可用性、其他 macOS 架構、Windows、乾淨安裝與真實使用者媒體仍待另行驗收。LM Studio 依需求方決策未執行。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
