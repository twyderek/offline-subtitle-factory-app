# 獨立審查報告：Whisper Metal→CPU retry 取消交界整合驗證（BUG-WHISPER-METAL-139）

- 審查對象 commit／版本：`0.51.0` 開發中；`HEAD=17df9788abf2cf964d52df10b74f9a8fcd7a45d6` 加上未提交工作樹。本輪可辨識範圍為 `scripts/fixtures/mock-whisper-cpp-runtime.mjs`、`scripts/test-core.mjs`、`docs/project-management/evidence/2026-09-18-whisper-retry-cancellation.json` 與 `00／03／06／07／08` 文件；`server.mjs` 僅核對現有控制流。工作樹另含多輪未提交變更，不把整份 `git diff` 歸於本輪。
- 對應 08-CHANGE-LOG 條目：2026-09-18 — Whisper Metal→CPU retry 取消交界整合驗證（BUG-WHISPER-METAL-139），`docs/project-management/08-CHANGE-LOG.md:3-18`。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-09-18（Asia/Taipei；本次審查 session 首次精確 UTC 校時為 `2026-09-18T03:27:52Z`）。本代理在獨立上下文依使用者審查委託啟動，先執行 `npm run project:preflight -- --type=debug`（exit 0），再讀其列出的固定核心與 debug 路由文件；`08-CHANGE-LOG.md` 僅讀範本規則與最新條目。未沿用主要開發代理的對話記憶或其評價性結論。

## 1. 需求完整性

- 判定：通過（限本輪 deterministic macOS arm64 取消交界）。
- 證據：最新條目明定首次 Metal exit 139、一次 `--no-gpu` CPU retry、CPU ready 後 API 取消、`running/cancelling`→`cancelled`、無第三次執行與檔案清理，並排除 bundled runtime、同一 callback 內窗口、Windows 等範圍（`docs/project-management/08-CHANGE-LOG.md:9-16`）。設計、狀態、測試稽核與偵錯紀錄對應描述見 `docs/project-management/03-FUNCTIONAL-DESIGN.md:53-55`、`docs/project-management/00-CURRENT-STATUS.md:30`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:18-24`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:19-25`。evidence 明示 `bundledRuntimeUsed=false`、未觀察真實 bundled crash→CPU cancellation，且 LM Studio 未執行（`docs/project-management/evidence/2026-09-18-whisper-retry-cancellation.json:5-18,55-66`）。

## 2. 邏輯正確性

- 判定：通過。
- 證據：新案例只在 `process.platform === 'darwin' && process.arch === 'arm64'` 的區塊執行（`scripts/test-core.mjs:646-647,717-754`）；fixture 以 `--no-gpu` 辨別 CPU，記錄 `metal`／`cpu`，首次非 CPU 寫 partial SRT／JSON 後 exit 139；CPU 若看到 Metal partial 會留下 stale marker（`scripts/fixtures/mock-whisper-cpp-runtime.mjs:19-25,38-47`）。CPU delayed path 先寫 partial SRT／JSON，後安裝 SIGTERM handler，最後寫 ready marker（同檔 `:62-82`）。現有 server 僅在 macOS arm64 首次使用 Metal、CPU retry 將 metrics 改為 CPU（`server.mjs:2064-2078`）；收到取消先 abort、標記 `running/cancelling`（`:1551-1577`），Whisper child `close` 時清理固定輸出及 quality metadata、reject cancellation（`:2166-2172`），外層才標記 `cancelled`（`:1518-1529`）。Metal failure 分支清 partial 後只呼叫一次 `runWhisperCpp(..., true)`；CPU 再失敗不遞迴（`:2174-2183`）。取消案例斷言兩次 invocation、CPU metrics、fallback log、SIGTERM 與 child-close marker（`scripts/test-core.mjs:734-748`）。

## 3. 邊界情況

- 判定：通過（已測邊界限於 CPU child 就緒後取消）。
- 證據：測試等 `whisper-cpp-cpu-retry-ready` 才呼叫 API，且在 ready 時先確認 CPU partial SRT／JSON 存在；另植入 `quality-metadata.json` 與非 ASR `edit-plan.json` 作清理／保留哨兵（`scripts/test-core.mjs:725-734`）。取消 API 回 202 後立即讀得 `running/cancelling`，最終為 `cancelled/cancelled`，沒有變成 failed／completed；invocation 必須精確為 `['metal','cpu']`（`:734-746`）。最終暫存 WAV、partial SRT／JSON、quality metadata、draft 不存在，stale Metal marker 不存在，edit plan 保留（`:747-753`）。`quality-metadata.json` 與 `edit-plan.json` 是測試植入檔，不是這次 child 真實產出的資料；這足以檢查清理範圍，不能推廣為真實 bundled runtime 品質路徑。外部 API 不能插入同一 Metal `close` callback 內的同步清理／重啟路徑（`server.mjs:2174-2179`、`docs/project-management/03-FUNCTIONAL-DESIGN.md:55`），本輪未覆蓋該窗口。

## 4. 程式碼品質

- 判定：通過。
- 證據：fixture 以既有 working 目錄 marker 控制情境，只在 CPU retry failure 或 delayed Metal 139 組合記錄 invocation，ready marker 限定 delayed Metal 139 的 CPU child（`scripts/fixtures/mock-whisper-cpp-runtime.mjs:17-25,80-82`）。整合案例使用既有 API helper、`waitForFile` polling、隔離的 `dataDir`，並由測試 `finally` 清理（`scripts/test-core.mjs:13,166-169,208-215,1217-1222`）；未新增產品 hook。現有產品清理 helper 僅刪指定 SRT／JSON 及 quality metadata（`server.mjs:1476-1483`）。`2026-09-18T03:27:52Z` 的 `node --check`（fixture、core、server）與 `git diff --check` 均 exit 0；工作樹混合多輪差異，無法僅靠 HEAD diff 證明每個 server hunk 的建立時間，故依最新條目與現行控制流限定本輪判讀（`docs/project-management/08-CHANGE-LOG.md:14-18`）。

## 5. 測試覆蓋

- 判定：通過（本輪聲明的回歸範圍）。
- 證據：`2026-09-18T03:27:52Z`（UTC 校時）附近獨立執行 `node --check scripts/fixtures/mock-whisper-cpp-runtime.mjs`、`node --check scripts/test-core.mjs`、`node --check server.mjs`、JSON 解析與 `git diff --check`，皆 exit 0；`uname -s -m` 為 `Darwin arm64`。預設 sandbox 執行 `node scripts/test-core.mjs` 在啟動 fake AI listener 時以 `listen EPERM 0.0.0.0:22532` exit 1（`scripts/test-core.mjs:60-75`），尚未進入產品案例，是環境權限阻擋。取得受控執行權限後，同一 focused core 指令在 `2026-09-18T03:27:52Z–03:28:22Z` 期間 exit 0；`2026-09-18T03:28:22Z–03:29:46Z` 期間受控執行 `npm run check` exit 0，輸出包含 `docs:check`、Whisper fallback policy、三模型、quality、核心 API 等全部既有測試。主要代理的 evidence 記錄三次 core exit 0（`docs/project-management/evidence/2026-09-18-whisper-retry-cancellation.json:20-53`）；本代理直接執行一次 focused core，完整 check 另再執行一次 core，未把 evidence 所載第三次當成本代理實測。建立報告後以 `validateReviewReport()` 檢查本檔，回傳 `errors=[]`、可引用結論長度 507；報告六面向及聲明結構符合 `scripts/project-docs-validator.mjs:12-33`。

## 6. 實際運行結果

- 判定：通過（deterministic child-process API 流程）。
- 證據：獨立重跑的核心測試實際以 `POST /api/jobs` 建 job、`POST /start`、等 CPU ready marker，再 `POST /cancel` 與 `GET /status`；逐一斷言狀態、metrics、logs、invocation 與磁碟清理（`scripts/test-core.mjs:717-753`），受控權限執行 exit 0，完整 `npm run check` 亦 exit 0（上述 `2026-09-18T03:27:52Z–03:29:46Z` 執行區間）。保存的 JSON 是主要代理的非敏感摘要，而非逐事件原始 trace；其 `statusBeforeChildClose`、`finalStatus`、`invocationSequence` 與清理布林值和本代理重跑的斷言一致（`docs/project-management/evidence/2026-09-18-whisper-retry-cancellation.json:25-45`）。未執行真實 bundled `whisper-cli`、長音訊、Windows 或 LM Studio 實機。`2026-09-18T03:30:32Z` 及報告建立後 `03:31:52Z` 執行 `npm run docs:check:final` 均 exit 1，錯誤只指向最新 08 工作條目缺「獨立審查是否執行」、「發布授權」欄位且狀態未為「完成」；這是主要代理結案前的文件門檻，非產品測試失敗（`docs/project-management/08-CHANGE-LOG.md:3-18`）。

## 綜合判定

- 結論：通過。
- 可逐字引用的完整結論句：**本輪「2026-09-18 — Whisper Metal→CPU retry 取消交界整合驗證（BUG-WHISPER-METAL-139）」round1 獨立審查結論為通過：在 macOS arm64 deterministic CPU child 已寫出 partial SRT／JSON 並安裝 SIGTERM handler 後的 API 取消範圍內，首次 Metal exit 139、單次 `--no-gpu` CPU retry、`running/cancelling` 至 child close 後 `cancelled`、僅兩次 invocation、CPU metrics 與 Metal fallback marker 保留、暫存音訊及 partial／quality／draft 清理和非 ASR edit plan 保留，均由現行控制流、核心斷言與獨立受控回歸支持；本結論不代表真實 bundled runtime、同一 Metal close callback 內不可外部插入的窗口、Windows、長音訊、中文品質、乾淨安裝或發布已驗收，LM Studio 實機未執行且不在範圍。**
- 阻擋問題（若有）：本輪限定範圍內無產品或測試阻擋；`docs:check:final` 因最新條目尚未結案而失敗，須由主要代理補齊並重跑，不由本審查代理修改。預設 sandbox listener `EPERM` 已以受控權限重跑排除，不列產品失敗。
- 剩餘風險：沒有同次真實 bundled server crash→CPU retry 取消、同一 Metal close callback 內窗口、Windows taskkill、長音訊、中文品質、乾淨安裝或發布證據；evidence 只有摘要，沒有逐事件原始時間序列；quality metadata 與 edit plan 以測試哨兵檢查清理／保留。LM Studio 實機未執行且不在範圍。
- 給主要開發代理的具體修正要求（若有）：本輪無程式修正要求；結案時只須於最新 08 條目連結本報告並逐字引用上列完整結論句，補齊治理欄位後重跑 `npm run docs:check:final`。若日後擴大聲明至 bundled runtime、callback 內窗口或其他平台，須另取相應證據與複審。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
