# 獨立審查報告：0.51.0 macOS packaged renderer smoke 重驗（FR-021 UI 範圍補證）

- 審查對象 commit／版本：`codex/0.51-anthropic-claude@17df9788abf2cf964d52df10b74f9a8fcd7a45d6`；版本 `0.51.0`。
- 對應 08-CHANGE-LOG 條目：`2026-09-16 — 0.51.0 macOS packaged renderer smoke 重驗（FR-021 UI 範圍補證）`（`docs/project-management/08-CHANGE-LOG.md:3-16`）。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-09-16（Asia/Taipei）；獨立上下文，依 preflight `--type=full` 列出的核心／路由文件、指定 evidence、verifier、需求／功能設計與既有工作樹狀態重新讀取，未沿用主要開發代理對話記憶。
- 審查方式與範圍：只審查本輪宣稱的隔離 macOS arm64 packaged Electron renderer／共用校閱 UI 補證；不把前一輪 Ollama API product path 證據推論成 UI live AI、真正斷網或 FR-021 整體完成。

## 1. 需求完整性

- 判定：部分通過。
- 證據：原始 `FR-021` 要求同時包含 Ollama 與 LM Studio loopback、模型探測、隱私／金鑰門檻、嚴格 cue 契約、各至少一模型端到端驗證及斷網完成（`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37`）。本輪工作條目則把成功條件收斂為 packaged renderer 的首頁／bridge／設定、Breeze 首次選擇取消、手動 SRT、校閱 AI 控制資產、provider registry 與資料夾按鈕流程，並明確排除 Ollama live UI AI、系統斷網、LM Studio 與發布（`docs/project-management/08-CHANGE-LOG.md:3-16`）。
- 證據：功能設計明確區分 renderer 與本機 API／AI adapter 邊界（`docs/project-management/03-FUNCTIONAL-DESIGN.md:3-15`），並要求本機 AI 的 loopback 判定、無 API Key／同意門檻、較小批次與嚴格 cue 契約（`docs/project-management/03-FUNCTIONAL-DESIGN.md:85-93`）。目前狀態及稽核文件也明確記錄本輪只補 UI／Electron 證據，`systemNetworkDisabled=false`、`ollamaLiveUiFlow=false`，不宣稱 FR-021 整體完成（`docs/project-management/00-CURRENT-STATUS.md:18-28`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:40-46`）。
- 評估：限定工作項目的需求與不在範圍敘述一致；但原始 FR-021 的 live provider／斷網驗收並未由本輪滿足，因此不能給整體 FR-021「通過」。

## 2. 邏輯正確性

- 判定：部分通過。
- 證據：verifier 以隔離暫存 `userData` 啟動 packaged executable（`scripts/verify-electron-renderer.mjs:17-41`），只選取本機 HTTP renderer target 並以 DevTools WebSocket 執行 renderer 評估（`scripts/verify-electron-renderer.mjs:43-124`）。它實際檢查首頁／導航／新專案／修剪入口、Electron bridge 與安全金鑰 API（`scripts/verify-electron-renderer.mjs:127-144`），開啟設定 modal、切換 Breeze 並按取消（`scripts/verify-electron-renderer.mjs:145-187`），再以手動 SRT 建立並啟動任務，要求 HTTP 201／202、`completed` 與 cleaned SRT（`scripts/verify-electron-renderer.mjs:189-223`、`scripts/verify-electron-renderer.mjs:347-365`）。
- 證據：校閱檢查讀取 review HTML、保存 glossary／prompt 並 round-trip，再讀取 provider ID；它只檢查校閱 UI 資產與設定 API，不發出 AI optimize 請求（`scripts/verify-electron-renderer.mjs:238-262`）。保存的 artifact 也明確記錄 `ollamaLiveUiFlow=false`、`systemNetworkDisabled=false` 及 LM Studio 未執行（`docs/project-management/evidence/2026-09-16-macos-renderer-smoke-fr-021.json:13-19,74-78`）。
- 限制：`trimAssets` 只 fetch packaged trim 頁面與 `trim.js` 並比對工作區／啟動字串（`scripts/verify-electron-renderer.mjs:225-234`）；真正 trim API 流程位於只有傳入第五個 `trimMediaPath` 參數才執行的分支（`scripts/verify-electron-renderer.mjs:264-311`），而保存 artifact 所記錄的指令沒有第五個參數（artifact `:11`），所以不能把本輪結果描述成實際 trim 行為通過。資料夾按鈕同樣設定 `__skipNativeFolderOpenForTest=true`，驗證的是 request／skipped marker，不是 OS 原生開啟（`scripts/verify-electron-renderer.mjs:313-331`）。
- 評估：已執行的檢查與其結論相符；但可支持的行為集合窄於「完整 UI 流程」，上述未執行分支不可從 artifact 推論通過。

## 3. 邊界情況

- 判定：部分通過。
- 實際驗證的邊界與結果：
  - 乾淨／隔離 profile：verifier 使用 `mkdtempSync` 的 userData，結束時在 `finally` 關閉 WebSocket、終止 child 並清理暫存目錄（`scripts/verify-electron-renderer.mjs:33-41,381-394`）；artifact 為 `isolatedUserData=true`、`externalApiKey=false`（`docs/project-management/evidence/2026-09-16-macos-renderer-smoke-fr-021.json:13-19`）。本輪另以 `find /tmp -maxdepth 1 -type d -name 'offline-subtitle-renderer-smoke-*' -print` 檢查，沒有留下 smoke userData 目錄。
  - Breeze 首次選擇：選取 `breeze-asr-25` 後等候下載 modal 開啟、按取消、確認 modal 關閉，再切回 Whisper.cpp（`scripts/verify-electron-renderer.mjs:164-187`）；artifact 記錄 `opened=true`、`closed=true`（`docs/project-management/evidence/2026-09-16-macos-renderer-smoke-fr-021.json:38-43`）。
  - 手動字幕任務：使用短暫假影片 bytes、單 cue SRT、規則檔與 `asrEngine=manual`，要求建立／啟動／完成與 cleaned SRT（`scripts/verify-electron-renderer.mjs:189-223`）；artifact 記錄 201、202、`completed`、`hasCleanedSrt=true`（`docs/project-management/evidence/2026-09-16-macos-renderer-smoke-fr-021.json:44-52`）。
  - provider／校閱資產：artifact 記錄 selection、session、secure key、collapsed toolbar、glossary round-trip 與八個 provider ID（`docs/project-management/evidence/2026-09-16-macos-renderer-smoke-fr-021.json:59-67`）。
- 未覆蓋的邊界：Ollama live UI 呼叫與模型回應／嚴格 cue 驗證、真正斷網、LM Studio、AI 取消／續跑／人工接受／undo／redo、非 loopback 金鑰／同意拒絕、網路錯誤與 timeout、原生資料夾開啟、含真實媒體的 trim、Windows／乾淨安裝／長音訊。這些限制與需求／設計及 artifact 一致，不能以既有 API product path 證據補足 UI 或斷網邊界。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：verifier 有明確的 CLI 參數、受控 timeout、renderer target 過濾、WebSocket request timeout、child／socket／暫存 userData 清理，以及每個主要檢查的失敗 assertion（`scripts/verify-electron-renderer.mjs:8-15,17-31,43-75,77-119,347-394`）。Node 語法檢查於 2026-09-16T02:57:29.213Z–02:57:29.312Z exit 0。
- 證據：程式品質相關 deterministic 測試通過：`scripts/test-electron-main.mjs:6-16` 驗證乾淨 profile 先檢查 secure key 檔再觸發 Keychain；`scripts/test-review-ui.mjs:14-89` 驗證 AI toolbar、provider UI、loopback 判定、無 API Key 及主要校閱資產；`scripts/test-ai-providers.mjs:47-109` 驗證八個 provider registry 與 local provider 不送空 Authorization。
- 限制：verifier 多處使用 HTML／script substring contract，而不是實際點擊、鍵盤操作、畫面截圖或 browser console／server log；artifact 的 `offline-subtitle-factory.electron-renderer-acceptance.v1` 由外部保存，`verify-electron-renderer.mjs` 本身只在 stdout 輸出 result JSON（`scripts/verify-electron-renderer.mjs:334-345`），沒有寫入或驗證該 artifact schema。因此證據可讀且內容一致，但 provenance／schema enforcement 仍較弱。

## 5. 測試覆蓋

- 判定：部分通過。
- 實際執行指令與輸出摘要：
  - `node --check scripts/verify-electron-renderer.mjs`：2026-09-16T02:57:29.213Z–02:57:29.312Z，exit 0。
  - JSON parse／schema 摘要檢查：2026-09-16T02:57:29.221Z–02:57:29.345Z，exit 0；讀得 `schema=offline-subtitle-factory.electron-renderer-acceptance.v1`、`status=pass`、artifact `observedAt=2026-09-16T10:53:39+08:00`。
  - `node scripts/test-electron-main.mjs`：2026-09-16T02:57:29.221Z–02:57:29.337Z，exit 0；輸出「Electron 啟動安全儲存測試通過」。
  - `node scripts/test-review-ui.mjs`：2026-09-16T02:57:29.221Z–02:57:29.334Z，exit 0；輸出「校閱 UI 測試通過」。
  - `node scripts/test-ai-providers.mjs`：2026-09-16T02:57:29.221Z–02:57:29.682Z，exit 0；輸出「AI provider contract 與術語／Prompt 測試通過」。
  - `npm run check`：2026-09-16T03:00:36.101Z–03:00:51.324Z，exit 0；治理文件、所有 package test 與 Node syntax 均通過，包含 Electron、provider、Ollama streaming、review UI 與核心 API 回歸。
  - `npm run docs:check:final`：2026-09-16T02:57:29.221Z–02:57:29.489Z，exit 1；因最新 CHANGE-LOG 工作條目仍為「進行中」、尚未有「獨立審查是否執行／發布授權」欄位，且尚未標示「完成」。這是本報告建立前的結案前置狀態，本審查未修改 CHANGE-LOG。
- 評估：自動回歸足以支持「既有程式與限定 UI contract 沒有明顯回歸」；不足以覆蓋真實 local AI UI、真正斷網、原生 OS 互動、real trim branch 或完整 FR-021。

## 6. 實際運行結果

- 判定：部分通過。
- 已保存的主要實機證據：`docs/project-management/evidence/2026-09-16-macos-renderer-smoke-fr-021.json:1-12` 記錄 macOS arm64、Node v22.22.3、controlled permission、候選 executable、指定 smoke 指令及 `status=pass`。artifact 的首頁／bridge／設定結果在 `:21-37`，Breeze 開啟／取消在 `:38-43`，手動 SRT 任務在 `:44-52`，校閱／provider 結果在 `:59-73`；其限制在 `:74-79`。
- 主要代理保存的指令結果：`node scripts/verify-electron-renderer.mjs '../dist/mac-arm64/離線字幕工廠.app/Contents/MacOS/離線字幕工廠' 9987 60000` 及 exit 0 已記錄於 artifact `:11-12` 與最新工作條目 `docs/project-management/08-CHANGE-LOG.md:13-16`。這是可回溯的已保存 pass artifact，不等同本審查代理重新取得相同 pass。
- 本審查代理重放：以同一 macOS arm64 候選／同一 verifier，改用未占用的 DevTools port 執行 `node scripts/verify-electron-renderer.mjs '../dist/mac-arm64/離線字幕工廠.app/Contents/MacOS/離線字幕工廠' 9988 60000`；exit 1，輸出為 `scripts/verify-electron-renderer.mjs:74` 的 `Error: Timed out waiting for Electron renderer target`，沒有附 child log。此結果不能被忽略，也不能反向改寫已保存 artifact；目前證據不足以區分暫時性 packaged app／renderer 啟動環境差異與可重現問題。
- 評估：已保存 artifact 足以證明在其觀測時間的受控環境中曾完成限定 smoke；但獨立重放未成功，故目前不能宣稱 packaged smoke 在本審查環境可穩定重現，也不能把本輪定性為無條件通過。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪 0.51.0 macOS packaged renderer smoke 的限定 UI／Electron 補證為有條件通過：已保存的 macOS arm64 隔離 renderer artifact 與 `npm run check` 支持首頁、bridge、設定、Breeze 首次選擇取消、手動 SRT 任務、校閱 AI 資產、glossary round-trip 與 provider registry 的受控結果，但本審查重放同一候選未取得 renderer target 而於 `verify-electron-renderer.mjs:74` timeout，且實際指令未啟用 real trim branch；因此必須維持「不證明 Ollama live UI AI、真正斷網、LM Studio 或 FR-021 整體完成」的範圍聲明，並在結案前重放成功或保存可解釋的 renderer 啟動環境差異證據。**
- 阻擋問題（若有）：
  - 本審查重放的 renderer target timeout 尚未有 child log 或環境差異解釋；若工作項目要求 smoke 可由獨立上下文重現，這是結案前阻擋。
  - 若工作項目要宣稱 trim 行為已驗收，需以第五個 `trimMediaPath` 參數實際執行 verifier 的 `packagedTrimFlow`，並保存對應結果；目前只可宣稱 trim page／script asset 存在。
- 剩餘風險：未執行 Ollama live UI AI 優化、未取得真正斷網證據、LM Studio 依需求方範圍例外未執行；未驗證原生資料夾開啟、真實 trim、AI UI 取消／續跑／接受／undo／redo、真實 provider endpoint／模型品質、長音訊、Windows renderer、DMG／ZIP 乾淨安裝、簽章／公證與發布。現有 Ollama API product path 證據只能支持 API product path，不能推論成本輪 UI live AI 或真正斷網。
- 給主要開發代理的具體修正要求（若有）：不要求本輪修改產品程式；結案前應（1）重放 packaged smoke 並保存 exit 0 或保存 renderer 啟動失敗的可診斷環境證據，並依結果決定是否需 round2；（2）若 trim 屬本輪成功條件，補跑 real trim branch；（3）維持最新狀態／CHANGE-LOG 對上述未覆蓋範圍的精確揭露，再執行 `npm run docs:check:final`。不得以本 artifact 將 FR-021 整體標示完成。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案；本輪未發布、未提交、未刪除、未覆寫既有檔案，未關閉系統網路、未呼叫雲端、未啟動 LM Studio。

若上述聲明不實，本報告無效。
