# 獨立審查報告：0.48.x 穩定化：Whisper Metal CPU fallback

- 審查對象 commit／版本：目前工作樹／`0.48.0`；本輪差異為 `server.mjs` 的 Whisper.cpp Metal 非零退出後 CPU retry，以及 `06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、`08-CHANGE-LOG.md` 的對應紀錄。
- 對應 08-CHANGE-LOG 條目：2026-07-30 — 0.48.x 穩定化：Whisper Metal CPU fallback
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-30T16:47+08:00；由主要代理啟動的獨立審查上下文，自行執行 debug preflight、檢查本輪差異、沿 job／abort／retry／metadata 控制流查核，並重跑語法與差異格式檢查。
- 審查需求：`FR-003`、`FR-020`、`NFR-005`、`NFR-006`、`BUG-WHISPER-METAL-139`。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `server.mjs:1435-1477` 將首次 macOS arm64 執行辨識為 Metal，`forceCpu` retry 則加入 `--no-gpu`；`server.mjs:1523-1533` 只在 Metal 非零退出後 retry 一次，CPU 再失敗會 reject，沒有無限遞迴或把 crash 當成功。
  - `server.mjs:1525-1529` 在 retry 前刪除同一 output base 的 `.srt`／`.json`；`server.mjs:1328-1329` 又在每次 ASR 開始前清除 `quality-metadata.json`。CPU 只有在 exit 0 且存在 SRT 時才複製 `draft.srt`，符合「CPU 成功才進入後續流程」。
  - `docs/project-management/08-CHANGE-LOG.md:58-59` 承諾保留原始 Metal stderr／exit code並新增 GPU failure／CPU retry／CPU failure／取消邊界測試；目前確定性 fallback event `server.mjs:1528` 只保存 exit code，且本輪沒有新增相應的自動化測試，因此工作條目成功條件與驗證計畫尚未完整落實。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `server.mjs:1490-1495` 的 `finish(callback, cleanupAudio)` 預設刪除 `whisper-input.wav`；唯有 Metal 非零退出轉交 CPU 時以 `cleanupAudio=false` 完成外層，故 retry 使用的音訊不會被提前刪除。
  - CPU retry 建立後重新走 `server.mjs:1460-1465` 的 abort precheck及 `server.mjs:1497-1501` 的 child kill／cancel rejection；CPU 成功、失敗、spawn error或取消最後都回到預設音訊清理。未發現 retry 會刪除來源影片或 input 目錄內容；清理目標只限 working 目錄下的衍生 WAV、SRT、JSON。
  - `server.mjs:1518-1522` 在判斷非零退出前先檢查 signal；因此已取消的 Metal process 不會啟動 CPU retry。Metal exit 與 CPU spawn 之間的程式碼同步執行，若 abort 在 CPU 建立後到達，會由 CPU 的 abort handler 處理。
  - CPU 非零退出由 `server.mjs:1531-1533` reject；`server.mjs:1136-1147` 只有 signal aborted或 `JOB_CANCELLED` 才標記 cancelled，其餘 rejection 均寫入 `failed`，CPU failure 狀態傳遞正確。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - Metal 非零退出可能留下部分 `whisper-cpp-output.srt`／`.json`；`server.mjs:1525-1527` 會在 CPU retry 前移除，避免 CPU 讀到 GPU 的部分輸出。既有 `quality-metadata.json` 又在 `runJob` 與 `runWhisper` 入口分別由 `server.mjs:1241,1329` 清除，CPU failure 不會建立新的 quality metadata。
  - CPU 非零退出後可能仍留下 CPU 自己寫到一半的原始 `whisper-cpp-output.srt`／`.json`，但不會複製成 `draft.srt`、不會寫入 job `files`、job 也維持 failed；使用者要求 retry 時 `server.mjs:1205-1223` 會清空前次 working 暫存。這不是假成功，但仍應在文件中區分「不產生可校閱成功檔」與「完全不留 raw 暫存」。
  - `server.mjs:1517` 的 spawn error 不會啟動 CPU fallback，因 fallback 目前只綁在 `exit` 非零事件。這符合條目明寫的「process 非零退出」範圍，但 binary 無法啟動、權限錯誤或 spawn failure 仍會直接 failed，應保留為已知邊界。
  - 尚無可執行測試施加 abort 於 Metal exit 前、CPU retry 啟動後及 CPU exit 前等時點；靜態控制流合理，但 race 邊界不能只以閱讀代替防回歸證據。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - 變更集中在 `runWhisperCpp`，沿用既有 spawn、log sanitizer、abort及 output parsing；`forceCpu` 使 retry 最多一層，且 `settled` 防止 `error`／`exit`／abort 重複結算，修改範圍小且可讀。
  - 音訊 ownership 透過 `finish(..., false)` 的布林參數隱含轉移；目前路徑正確，但缺少測試時容易在後續新增 exit 分支時誤刪或洩漏。將「是否清理音訊／是否允許 fallback」抽成具名 helper 或至少用針對性測試鎖定，會更容易維護。
  - Metal failure 的 fallback log `server.mjs:1528` 僅寫 `Metal exit ${code}`。stderr 雖可能由 1.2 秒節流的進度 log 偶然留下片段，卻不保證包含最後的 allocation error；這與 `08-CHANGE-LOG.md:58` 的「保留原始 stderr／exit code」不完全一致，診斷能力也弱於 CPU failure 的 sanitized 尾段錯誤。
  - 2026-07-30T16:53+08:00 本審查執行 `node --check server.mjs` 與 `git diff --check`，均 exit 0。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 主要代理提供受控 `npm run check` 通過；本審查另重跑 `node --check server.mjs` 與 `git diff --check` 通過，支持既有回歸與語法／格式未退步。
  - `scripts/test-core.mjs:666-690` 的實際 ASR 測試只有設定 `OFFLINE_SUBTITLE_TEST_ASR_AUDIO` 才執行，且只斷言最終 completed／draft 內容；一般 `npm run check` 本身不保證進入該段，也沒有斷言第一次 Metal 非零、第二次參數含 `--no-gpu`、音訊跨 retry 存在、舊 output 已清理或 metrics 由 metal 切成 cpu。
  - 專案搜尋只有 `server.mjs` 包含新的 `forceCpu`／`CPU fallback` 行為；沒有 GPU failure→CPU success、CPU failure→job failed、abort→cancelled／不再 retry及 stale quality metadata 的 deterministic fixture。
  - 既有 bundled CLI／tiny model／同一 WAV 的 GPU exit 139與手動 `--no-gpu` exit 0 對照能證明 workaround 可行，但兩個分開執行的 CLI smoke 不能證明產品 orchestrator 已正確串接 retry、cleanup與 job state。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 前輪持久審查 `docs/project-management/reviews/2026-07-30-0-48x-whisper-metal-round1.md` 已獨立重現 bundled arm64 CLI 的 Metal exit 139／無 JSON，以及相同 binary、model、WAV 加 `--no-gpu` 後 exit 0／有效 JSON；CPU fallback 的底層可行性有直接證據。
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:149-153` 與 `07-DEBUG-AND-FIX-HISTORY.md:93-100` 保留目前主機、tiny model、短音訊、乾淨安裝／Windows／長音訊未驗收等限制，沒有將 CPU workaround 擴張成 Metal 上游根因已修復。
  - 本輪沒有保存一次完整產品 job 的事件序列，證明 Metal exit、fallback log、CPU device metric、completed／failed／cancelled終態與 working 目錄檔案清單；因此實際運行證據仍停留在底層兩次 CLI 對照及一般回歸，不足以完成 fallback orchestration 驗收。

## 綜合判定

- 結論：有條件通過
- 阻擋問題：
  1. 補 deterministic fallback 回歸，至少驗證：（a）Metal 非零且留下部分 SRT／JSON時先清理、保留同一音訊並以 `--no-gpu` 成功；（b）CPU 再失敗時 job 為 failed、沒有 draft／quality metadata 假成功；（c）Metal 已取消不啟動 CPU，CPU retry 中取消則 job 為 cancelled且終止 child。測試須在一般 `npm run check` 可執行，不可只依目前主機偶發 Metal crash或選配環境變數。
  2. 使「保留原始 stderr／exit code」與實作一致：在 Metal fallback event 中保存 sanitized stderr 尾段，或收斂 `08-CHANGE-LOG.md:58` 的承諾並明列只有 exit code 可保證；同步修正 06／07／08 對防回歸完成度的描述。
- 剩餘風險：
  - CPU fallback 會把同一段轉錄重新執行一次，長音訊的額外耗時、取消延遲、熱量與記憶體壓力尚未量測。
  - spawn error 不屬非零 exit，不會 fallback；CPU 自身失敗後可能保留未被產品採用的 raw output 暫存，雖不形成 completed／draft／quality metadata且 retry 會清理，仍應持續限制其可見性。
  - 只有目前 macOS arm64 bundled runtime／tiny model／短 WAV 的 GPU／CPU底層對照；乾淨 macOS 安裝、其他 Apple Silicon、真實長音訊與 Windows 非回歸尚未完成。
- 給主要開發代理的具體修正要求：先補可控 fake Whisper child／fixture 與三組 job-level 斷言，再補 Metal sanitized stderr的確定性紀錄或修正文案；重跑針對性測試、`npm run check`、`git diff --check`，同步 06／07／08 後建立 round2 複審。

**本輪「2026-07-30 — 0.48.x 穩定化：Whisper Metal CPU fallback」round1 獨立審查結論為有條件通過：`runWhisperCpp` 已只在未取消的 macOS arm64 Metal 非零退出後保留 working WAV並以 `--no-gpu` 單次重試，retry 前會清除 GPU 部分 SRT／JSON，quality metadata 在 ASR 入口清除，CPU 非零 rejection 也會由 job runner 落到 failed而不產生 draft假成功；abort precheck與 child handler的靜態控制流亦支持 Metal 取消不重試、CPU retry中取消回到 cancelled，且語法、受控完整回歸與差異格式檢查通過；但現有一般測試沒有可重現地斷言 GPU failure→CPU success、CPU 再失敗、retry 中取消、音訊 ownership與 stale metadata，兩次獨立 CLI smoke 不能取代產品 orchestration測試，工作條目宣稱保留原始 Metal stderr也未由只記 exit code的 fallback event確定實現，因此補齊 deterministic job-level 回歸並對齊 stderr紀錄／文件後方可結案。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前已確認目標路徑不存在，未覆寫既有審查報告。
- 若上述聲明不實，本報告無效。
