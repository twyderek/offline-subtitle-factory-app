# 獨立審查報告：0.48.x 穩定化：Whisper Metal exit 139 診斷

- 審查對象 commit／版本：目前工作樹／`0.48.0`；本輪差異為 `07-DEBUG-AND-FIX-HISTORY.md`、`06-TEST-AND-PROCESS-AUDIT.md` 與 `08-CHANGE-LOG.md` 的診斷紀錄，未修改 Whisper runtime。
- 對應 08-CHANGE-LOG 條目：2026-07-30 — 0.48.x 穩定化：Whisper Metal exit 139 診斷
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-30T16:40+08:00；由主要代理啟動的獨立審查上下文，自行執行 debug preflight、檢查差異與暫存證據，並以 bundled runtime、同一模型／WAV 獨立重放 GPU／CPU 對照。
- 審查需求：`FR-003`、`FR-020`、`NFR-005`、`NFR-006`、`BUG-WHISPER-METAL-139`。

## 1. 需求完整性

- 判定：通過
- 證據：
  - `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:90-100` 記錄現象、完整 GPU 重現指令、exit／stderr／輸出檔、CPU 對照、根因範圍、workaround、移除方向與剩餘風險。
  - `docs/project-management/08-CHANGE-LOG.md:55-60` 正確把成功條件限制為診斷 process crash 與 metadata 缺失的差異；不在範圍明列不修改 CPU／Metal 策略、不修改發布資產、不宣稱跨平台修復。
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:140-145` 將 GPU crash、CPU workaround 與「rule-score 不可用於無 cue crash」分開，符合 FR-003／FR-020 邊界。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - 2026-07-30T16:44+08:00 本審查以 bundled `tools/whisper-cpp/whisper-cli`、`ggml-tiny.bin` 與同一 1 秒／16 kHz／mono PCM WAV 重放預設路徑，process exit 139；stderr 在 `use gpu = 1`、模型載入後停止於 `ggml_metal_buffer_init: error: failed to allocate buffer, size = 2.20 MiB`，目標 JSON 不存在。
  - 同一 binary／model／WAV 加 `--no-gpu`，process exit 0；stderr 為 `use gpu = 0`、BLAS backend、完整 processing／`output_json`／timings，非空 JSON 可由 `jq` 解析。
  - 文件根因只判定「目前主機 bundled Whisper.cpp Metal buffer allocation 路徑可重現 runtime failure」，沒有進一步猜測硬體故障、所有 Metal 裝置必敗或所有媒體／模型皆受影響，證據與措辭相稱。

## 3. 邊界情況

- 判定：通過
- 證據：
  - GPU／CPU 對照只改 `--no-gpu`，binary、model、WAV 與 JSON flags 相同，能隔離目前 failure 與 GPU／Metal 初始化路徑相關。
  - `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:97-100` 明列尚未覆蓋乾淨 macOS 帳號、Windows、其他模型、真實長音訊與產品 job 狀態。
  - CPU JSON 的 silence 結果只證明可完成並寫檔，不足以驗證真實語音品質或時間碼；文件沒有擴張成 CPU 轉錄品質驗收。
  - crash 未產生 cue／JSON，因此文件正確禁止以成功轉錄後才適用的 rule-score metadata fallback 冒充 crash fallback。

## 4. 程式碼品質

- 判定：通過（本輪為診斷文件品質）
- 證據：
  - 新 BUG ID 使用獨立段落，重現命令與結果可複製，並明確區分「根因範圍」「修正狀態」「防回歸／後續」。
  - 本輪沒有修改 `tools/`、Whisper 執行路徑、server 或 runtime；工作樹內其他既有 script 差異屬前輪工作，不在本輪診斷修改範圍。
  - `git diff --check` 通過。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 本審查親自重放 GPU crash與 CPU workaround，分別得到 exit 139／無 JSON及 exit 0／有效 JSON，涵蓋本輪最核心正反路徑。
  - 需求提供受控 `npm run check` 通過證據；產品程式未變更，完整回歸目的在確認純文件診斷沒有伴隨行為退步。
  - `docs/project-management/08-CHANGE-LOG.md:61` 仍把 `npm run check` 與 `git diff --check` 寫為待執行，與需求提供的受控結果及本審查 `git diff --check` 結果不一致；應同步後再結案。
  - 尚無產品層「Metal crash → CPU retry／可診斷 failed」整合測試，文件正確列為下一個受控變更而非本輪完成項。

## 6. 實際運行結果

- 判定：通過
- 證據：
  - `file` 確認 bundled CLI 為 Mach-O arm64，WAV 為 16-bit mono 16000 Hz；CLI、tiny model、WAV SHA-256 分別為 `6167fe4817a85cb011cbb58abf53f80a9e9488be26b99348e9ff6f655edc7a08`、`be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21`、`0d1facd99af6b4e49919b5647a43bfa62fdcb4c145c27cb803ad7bb3ad06cc8e`。
  - 原開發證據 `/tmp/whisper-metal-smoke.stderr` 與 `/tmp/whisper-cpu-smoke.stderr` 分別保存 Metal allocation failure 與 CPU 完整處理；本審查以不同 output prefix 再次得到相同分歧。
  - `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:98-100` 與 `docs/project-management/08-CHANGE-LOG.md:56,60-61` 均明載 CPU 只是已驗證手動 workaround，產品未自動 fallback、runtime 未修、跨平台未驗收。

## 綜合判定

- 結論：有條件通過
- 阻擋問題：
  1. 將 `docs/project-management/08-CHANGE-LOG.md:61` 同步為受控 `npm run check` 已通過、`git diff --check` 已通過；`npm run docs:check:final` 可保留待 round2 結案後執行。
- 剩餘風險：
  - 目前產品沒有 Metal failure 後的自動 CPU retry，也未驗證 job 是否留下 stale SRT／JSON／quality metadata；使用者仍可能遇到 failed task。
  - 只使用目前主機、tiny model 與 1 秒 silence；其他 macOS、模型、真實長音訊、Windows、Electron／安裝後路徑仍未覆蓋。
  - CPU JSON 成功只證明 workaround 可執行，不代表語音品質、時間碼或 performance 已驗收。
  - Metal stderr 指向 allocation failure path，但尚未定位到底層 ggml／Metal runtime、主機資源狀態或 bundled binary 版本的更深原因。
- 給主要開發代理的具體修正要求：只需同步工作條目的受控測試最終狀態，保留目前根因範圍與未自動 fallback 邊界，再建立 round2 最小複審。

**本輪「2026-07-30 — 0.48.x 穩定化：Whisper Metal exit 139 診斷」round1 獨立審查結論為有條件通過：bundled arm64 `whisper-cli`、tiny model 與同一 1 秒 16 kHz silence WAV 的預設 GPU 路徑由本審查獨立重現 exit 139、`ggml_metal_buffer_init` 2.20 MiB allocation failure 與無 JSON，加 `--no-gpu` 則 exit 0、完成 processing 並產生可解析 JSON，因此目前主機的 Metal buffer allocation 路徑 failure 與 CPU 手動 workaround 均有直接證據；文件亦只把根因限定在目前主機／bundled runtime，不宣稱所有 macOS 受影響，也明載產品尚未自動 fallback、rule-score 不可代替無 cue crash；但 08 工作條目仍把需求已證實通過的受控 `npm run check` 與本審查已通過的 `git diff --check` 寫為待執行，同步最終測試狀態後方可結案。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前已確認目標路徑不存在，未覆寫既有審查報告。
- 若上述聲明不實，本報告無效。
