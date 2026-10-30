# 獨立審查報告：FR-021 packaged Electron UI macOS 26.6.2 Seatbelt 可行性重播

- 審查對象 commit／版本：`299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`；重播候選為 v0.51.0 macOS arm64 app bundle，來源 commit `53956ccdee6e16e4c0413f09312a419613b27da6`。
- 對應 08-CHANGE-LOG 條目：2026-09-30 — FR-021 packaged Electron UI macOS 26.6.2 Seatbelt 可行性重播。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-09-30 16:10:03 CST（Asia/Taipei）；獨立 fresh sub-agent context，未沿用開發代理對話記憶。
- 審查範圍：僅最新工作紀錄、`00-CURRENT-STATUS.md` 對應新增段落、`06-TEST-AND-PROCESS-AUDIT.md` 對應段落、replay10／replay11 evidence，以及相關 runner／focused test。未讀取無關歷史工作。

## 1. 需求完整性
- 判定：部分通過。
- 證據：最新工作紀錄第 3–18 行定義的是可行性版本重播，明確排除 UI acceptance；成功條件包含唯一 evidence、隔離前置檢查及清理確認。replay10 記錄 `APP_BUNDLE_INVALID`／`app_bundle_preflight`（evidence 第 19–21 行），replay11 記錄 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`electron_start`（第 19–21 行），均符合「pass 或 fail 都留存結果」的目標。`00-CURRENT-STATUS.md` 第 34–35 行明確保留 UI acceptance 未通過及 FR-021 未結案。惟最新工作紀錄第 5–6、16、18 行仍標示進行中，完整回歸與文件 final gate 尚待主要代理完成，因此不能把工作項目視為已結案。

## 2. 邏輯正確性
- 判定：通過（限本次可行性重播）。
- 證據：工作紀錄第 15 行及 audit 第 21 行說明 replay10 將 executable 路徑當作 bundle 參數。offline runner 的 `inspectBundle` 解析真實路徑並要求 `.app` 目錄（`scripts/verify-electron-ollama-ui-offline.mjs` 第 126–143 行）；在 `app_bundle_preflight` 前不會進入後續啟動流程（第 390–406 行）。replay10 evidence 的 candidate 欄位為 null，失敗階段為 preflight；driver／daemon 未啟動且清理欄位為乾淨（evidence 第 11–15、19–21、28–52 行）。
- replay11 evidence 確認候選 bundle metadata 為 v0.51.0、identifier `com.offline-subtitle-factory.app`，並含 executable SHA-256（第 11–15 行）；audit 第 20–22 行記載使用 `.app` bundle 目錄及 macOS 26.6.2 arm64。Seatbelt 結果為 loopback allowed、外連 socket `EPERM`（evidence 第 22–32 行）；預裝模型存在且 `modelDownloadAttempted=false`（第 34–37 行）。Electron 失敗類別為 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、signal 為 `SIGTRAP`（第 94–100 行），failure stage 是 `electron_start`；沒有首頁、job 或 UI flow 結果（第 39–85 行）。UI runner 在取得 renderer DevTools page 前若 Electron 已退出即判定 `ELECTRON_EXITED_BEFORE_RENDERER`（`scripts/verify-electron-ollama-ui.mjs` 第 86–95 行），故「未到 renderer/UI 流程」與 evidence 相符。
- 限制：兩份 JSON 只記錄 `darwin`／`arm64`，沒有保存 macOS 完整版本或呼叫參數形狀；26.6.2 與 bundle 目錄呼叫方式由 audit 第 20–22 行及工作紀錄第 8、11、15 行支持，不能單靠 JSON 重現。建議後續 evidence 加入去敏的 OS 版本／build 與 bundle 輸入種類欄位，不回填臆測值到既有 evidence。

## 3. 邊界情況
- 判定：部分通過。
- 證據：本輪實際邊界包括 executable 路徑被 bundle preflight fail-closed（replay10 第 19–21 行；runner 第 126–143 行）、正確 app bundle 在 Seatbelt 中遇到 Chromium child sandbox 啟動失敗（replay11 第 19–21、94–100 行）、loopback 可用而外連 socket 被 `EPERM` 拒絕（第 22–32 行），以及預裝模型不下載（第 34–37 行）。replay11 cleanup 中 Electron group 起初存在、完成後不存在且確認關閉、未強制清除、userData 移除（第 87–96 行）；driver／daemon groups、daemon port、temporary root 的清理確認均為 true（第 103–115 行）。全機網路未停用（第 32、118 行）。
- focused test 的 test-only ENOENT 注入另驗證 spawn 失敗及 daemon／port／temp 清理（`scripts/test-ollama-ui-offline.mjs` 第 149–188 行）。但沒有自動化測試專門固定 replay10 的「傳 executable 而非 `.app` 目錄」回歸；建議補一個不啟動 Electron／daemon 的 preflight 負向測試，斷言錯誤碼與 stage。

## 4. 程式碼品質
- 判定：通過（限本報告查閱的 runner 路徑）。
- 證據：runner 對候選 bundle 驗證 realpath、`.app` 目錄、identifier、版本與 executable 存在性（`scripts/verify-electron-ollama-ui-offline.mjs` 第 126–143 行）；啟動 Ollama／Electron 前要求 Seatbelt loopback probe 成功且外連回 `EPERM`（第 157–170、390–406 行）。UI 失敗分類保留 Chromium sandbox failure，不把失敗轉成通過（第 271–289 行）。Evidence 使用 exclusive create（第 491–505 行），清理流程逐項確認 driver、daemon、port 與 temporary root（第 447–487 行）；Electron group／userData／app server port 的清理驗證在 `scripts/verify-electron-ollama-ui.mjs` 第 626–641 行。Focused test 的 test-only runner command 僅於 `NODE_ENV=test` 啟用（offline runner 第 23–27 行），未提供 `--no-sandbox` 路徑（focused test 第 51 行）。

## 5. 測試覆蓋
- 判定：部分通過。
- 證據：2026-09-30 16:11:45–16:11:46 CST 執行 `node scripts/test-ollama-ui-offline.mjs`，exit 0，輸出 `Ollama offline packaged UI contract test passed`。本次沒有出現「integration test skipped」訊息；測試 source 第 149–188 行顯示條件式 ENOENT 整合路徑檢查 `EPERM`、預裝模型與清理。它將不存在的 test-only UI runner 注入 wrapper（第 152–167 行；runner 第 23–27、209–238 行），沒有啟動 packaged Electron app。
- 2026-09-30 16:11:45 CST：`node --check scripts/verify-electron-ollama-ui-offline.mjs` exit 0；`node --check scripts/verify-electron-ollama-ui.mjs` exit 0；`git diff --check` exit 0。`git diff --check` 涵蓋當時 tracked worktree diff 的 whitespace 檢查，不代表本報告審查了其他 dirty 檔案。
- 依本次指示未執行 packaged app、完整測試套件、`npm run check` 或 `npm run docs:check:final`。因此本報告不認證完整回歸或文件 final gate；最新工作紀錄也仍將這些列為待辦。focused test 未直接涵蓋 replay10 的 app-bundle 參數形狀，建議按第 3 節補測。

## 6. 實際運行結果
- 判定：通過（只表示可行性重播有可回溯結果；不是 UI acceptance 通過）。
- 證據：replay10 於 2026-09-30T07:59:10.245Z 完成，0 ms，`APP_BUNDLE_INVALID`、`app_bundle_preflight`；Electron／daemon 未啟動，cleanup flags 為乾淨（`docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay10.json` 第 3–5、19–21、28–52 行）。replay11 於 2026-09-30T07:59:53.349Z 至 08:00:00.166Z 執行 6817 ms，`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`SIGTRAP`；profile loopback／外連結果、預裝模型未下載，以及 Electron、driver、daemon、port、userData、temporary root 清理狀態如第 2 節所列。Renderer dashboard 與 UI 操作沒有完成（replay11 第 39–85 行）；不得將結果稱為 packaged UI acceptance 通過。`systemNetworkDisabled=false`，所以也不代表全機斷網（第 32、118 行）。

## 綜合判定
- 結論：有條件通過。
- 阻擋問題（若有）：主要代理尚須完成最新工作紀錄第 6、16、18 行列出的完整回歸與 `npm run docs:check:final`，再同步工作紀錄狀態；本審查受限於指示，沒有執行這兩項。這是工作項目結案條件，不改變本次重播顯示 Electron sandbox 初始化失敗的結論。
- 剩餘風險：兩份 replay JSON 沒有記錄 macOS 完整版本/build 或 bundle 輸入種類；相關事實目前由 audit／work log 文字佐證。未自動化覆蓋 executable 路徑誤作 `.app` 目錄的負向 preflight。未驗收 packaged UI、取消／checkpoint 續跑、全機斷網、Windows 或 FR-021 整體需求。
- 給主要開發代理的具體修正要求：完成並記錄本項尚待的完整回歸及文件 final gate；新增只驗證 `app_bundle_preflight` 的 executable-path 負向測試，確保 Electron、driver、daemon 都不啟動；未來 replay evidence 記錄去敏的 macOS 版本/build 與 bundle 輸入種類。維持目前「可行性重播失敗、UI acceptance 未通過、FR-021 未結案」的表述。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
