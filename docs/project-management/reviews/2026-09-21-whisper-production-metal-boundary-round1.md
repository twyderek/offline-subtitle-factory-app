# 獨立審查報告：bundled Whisper production server Metal failure 邊界重播

- 審查對象 commit／版本：目前工作樹／`17df978`／0.51.0 開發中；工作樹另有既有變更，本報告只審查本輪條目、指定 evidence 與 `scripts/verify-whisper-real-fallback.mjs`。
- 對應 08-CHANGE-LOG 條目：2026-09-21 — bundled Whisper production server Metal failure 邊界重播（BUG-WHISPER-METAL-139）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-09-21（Asia/Taipei）獨立審查 session；先執行 `npm run project:preflight -- --type=full`，讀取治理核心、full 任務路由、目前狀態、最新 08 條目、03／06／07 與指定程式／evidence，未沿用主要開發代理的評價性結論。

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-17` 將本輪成功條件限定為同一 bundled `whisper-cli`／Tiny、同一 1 秒 16 kHz mono 合成 WAV、同一 production server 路徑的預設 sandbox 與受控本機權限重播，並要求區分正常 Metal、真實 Metal failure 與環境限制；同段也明確寫出本輪未觀察真實 bundled Metal failure 或 CPU fallback。`docs/project-management/03-FUNCTIONAL-DESIGN.md:53-57` 與 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 一致要求真實 server 的 Metal 非零退出／signal 與 CPU retry 必須在同一 server run 中被觀察，deterministic wrapper 不得冒充 bundled runtime。兩份指定 evidence 均存在，且範圍標示為 production、loopback-only、無外部網路、未執行 LM Studio、未讀取使用者媒體。

## 2. 邏輯正確性

- 判定：通過（限本輪範圍）
- 證據：`scripts/verify-whisper-real-fallback.mjs:61-70` 會讀取 server 實際寫出的 `offline-subtitle-port.tmp` 並更新 API base URL；`:73-86` 在 ready polling 期間先檢查 child 是否已離開，將「ready 前 exit 0」記錄為啟動失敗，而非 Metal failure。`evidence/2026-09-21-whisper-real-server-fallback-default.json:32-50` 確認 job 未建立、`logMarkers=null`，錯誤訊息是「產品 server 在 ready 前離開，exit code 0」，沒有任何 Metal crash／fallback 結果。
- 證據：同一 script 的 `:194-236` 只從實際 job logs 解析 fallback marker，並要求 fallback 時 metrics 為 CPU、未 fallback 時 metrics 為 Metal；`:223-229` 斷言任務狀態、ready-review、輸出完整、無 stale partial 與暫存 WAV。`evidence/2026-09-21-whisper-real-server-fallback-escalated.json:32-65` 的欄位符合這個邏輯：`completed`／`ready-review`、`whisperDevice=metal`、所有 Metal failure／exit／signal／CPU fallback marker 為 false，輸出存在且 stale partial 清單為空。

## 3. 邊界情況

- 判定：部分通過
- 證據：已明確處理並驗證兩種執行邊界：預設 sandbox server 在 ready 前正常 exit 0，不能解讀成 Metal crash；受控本機權限下同一 bundled runtime 完成正常 Metal path。`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:18-23`、`docs/project-management/00-CURRENT-STATUS.md:24-27,33` 均明確保留此區分，沒有把 sandbox 結果升格為產品 runtime failure，也沒有把正常 Metal smoke 升格為 fallback。
- 證據：本輪輸入只有 1 秒合成靜音 WAV（兩份 evidence `:18-23`，`userMediaRead=false`），因此不覆蓋中文語音品質、長音訊、效能／記憶體、其他 macOS 架構、Windows、乾淨安裝、真實使用者媒體或發布。更重要的是，兩份 evidence 都沒有同一次真實 bundled server run 的 Metal 非零退出／termination signal，因此真實 crash→CPU fallback 門檻仍未完成。

## 4. 程式碼品質

- 判定：通過（限驗收 probe 與本輪未修改產品程式）
- 證據：`scripts/verify-whisper-real-fallback.mjs:11-17` 拒絕覆寫既有 evidence 並使用隔離暫存目錄；`:130-159` 限定 darwin／arm64、檢查 bundled runtime／Tiny 存在與可執行，並以 `NODE_ENV=production`、loopback token、空 AI secrets 與隔離資料目錄啟動 server；`:246-258` 在 evidence 寫入後以 nested `finally` 清理暫存資料。`docs/project-management/08-CHANGE-LOG.md:14-16` 也記錄了 exclusive create 與 finally cleanup 的範圍。
- 證據：本輪未修改 `server.mjs`、bundled runtime、模型、fallback policy 或既有報告；script 的 fallback 斷言保留正常 Metal 與 CPU fallback 的分支差異，沒有以固定值製造成功結果。未把任何 probe／fixture 結果宣稱為真實 bundled Metal crash。

## 5. 測試覆蓋

- 判定：有條件通過
- 證據：2026-09-21 本審查 session 執行 `node --check scripts/verify-whisper-real-fallback.mjs`、`node --check server.mjs` 與 `git diff --check`，均 exit 0；以只讀 Node assertions 重新讀取兩份 evidence，確認 default `status=fail`／exit 0／無 job、escalated `status=pass`／ready-review／Metal／無 fallback marker、輸出清理與 runtime／model SHA-256 均通過；完整 `npm run check` exit 0，治理文件檢查、Whisper fallback policy、核心回歸與其餘測試均通過。
- 證據：`npm run docs:check:final` exit 1，唯一回報是 `08-CHANGE-LOG.md` 最新工作紀錄仍有「待執行」，且「獨立審查是否執行」尚未填為是／否。這是主要工作條目的文件結案狀態，不是本輪程式或 evidence assertion 失敗；本審查代理不修改 08 或任何既有報告。未再啟動會產生新 evidence 的 production probe，依本輪範圍保留既有實際結果。

## 6. 實際運行結果

- 判定：部分通過
- 證據：`docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-default.json:25-50` 記錄 production／loopback-only server 在 ready 前 exit 0，job `created=false`、`started=false`、`status=null`，錯誤明示「ready 前離開，exit code 0」；這是 server 啟動權限邊界證據，不是 Metal crash，也不是 fallback 結果。
- 證據：`docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-escalated.json:25-72` 記錄同一 macOS arm64 bundled runtime／Tiny hash 與 1 秒合成 WAV，在受控本機權限下任務 `completed`／`ready-review`、`asrEngine=whisper.cpp`、`whisperDevice=metal`；`:42-65` 明確記錄 `metalFailure=false`、`metalExit=false`、`metalExit139=false`、`metalSignal=false`、`cpuFallback=false`、`fallbackObserved=false`，SRT／JSON／draft 存在、stale partial 為空。故本輪沒有真實 bundled Metal crash→CPU fallback 證據，只能確認正常 Metal server path 與預設 sandbox 的啟動邊界。

## 綜合判定

- 結論：有條件通過
- 可逐字引用完整結論句：**本輪 BUG-WHISPER-METAL-139 bundled Whisper production server Metal failure 邊界重播 round1 獨立審查有條件通過：預設 sandbox evidence 的 server 在 ready 前 exit 0 且未建立 job，不得解讀為 Metal crash；同一 macOS arm64 bundled whisper-cli／Tiny、同一 1 秒合成 WAV 與同一 production server 在受控本機權限下完成 ready-review、whisperDevice=metal、fallbackObserved=false、輸出與暫存清理，證明正常 bundled Metal path，但本輪沒有同一次真實 bundled Metal crash→CPU fallback 證據，該實機門檻仍未完成。**
- 阻擋問題（若有）：治理結案仍有一項待完成：`npm run docs:check:final` 因最新 `08-CHANGE-LOG.md` 的「獨立審查是否執行」與「遺留風險與後續事項」仍為「待執行」而失敗。就本輪 evidence、probe 邏輯與產品程式而言，沒有要求修改既有報告或新增程式修正。
- 剩餘風險：真實 bundled production server 的 Metal failure→CPU fallback 尚未觀察；1 秒靜音不代表中文品質、長音訊、效能、取消交界、CPU retry 再失敗、其他 macOS 架構、Windows、乾淨安裝或正式發布驗收。deterministic fallback fixture、direct CLI 對照與本輪正常 Metal smoke 均不可替代該門檻。
- 給主要開發代理的具體修正要求（若有）：無新增程式修正要求；僅需依治理流程完成本輪 08 工作條目的審查結案欄位，並保留「真實 bundled Metal crash→CPU fallback 未觀察」的範圍聲明。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
