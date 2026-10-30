# 獨立審查報告：FR-021 macOS Seatbelt packaged Electron Ollama UI 隔離可行性查核

- 審查對象 commit／版本：`299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`／v0.51.0；候選 packaged app 來源 commit `53956ccdee6e16e4c0413f09312a419613b27da6`。
- 對應 08-CHANGE-LOG 條目：2026-09-30 — FR-021 macOS Seatbelt packaged Electron Ollama UI 隔離可行性查核。
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：（2026-09-30 10:08 Asia/Taipei；本輪獨立審查上下文，依需求方提供的範圍與 repository `AGENTS.md`、`docs/project-management/workflows/04-INDEPENDENT-REVIEW.md` 執行，未沿用開發代理對話記憶。）

## 1. 需求完整性
- 判定：部分通過
- 證據：`docs/project-management/08-CHANGE-LOG.md` 最新條目明列 FR-021／NFR-001／NFR-005／NFR-006、macOS arm64 Seatbelt deny-network／loopback-only 查核、預裝 `llama3.2:3b`、不下載、不使用 `--no-sandbox`、不修改系統網路，以及 UI 未啟動時以失敗 evidence 結案；同條目明確聲明這不是 packaged UI acceptance 通過且 FR-021 未結案。`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:20-25` 同步候選來源、scope、結果與限制。runner 的 profile 與 fail-closed checks 見 `scripts/verify-electron-ollama-ui-offline.mjs:11-12,155-168,414-466`；UI verifier 以同一 profile 啟動 packaged app process tree，未加入 `--no-sandbox`，見 `scripts/verify-electron-ollama-ui.mjs:17-18,162-172`。實際 packaged UI flow 未完成，故需求中「完成 UI flow」只有嘗試、沒有驗收通過證據；這與工作紀錄對 feasibility scope 的限定一致。

## 2. 邏輯正確性
- 判定：部分通過
- 證據：`2026-09-30 10:03:15–10:03:21 Asia/Taipei`（換算 replay6 evidence `startedAt=2026-09-30T02:03:15.131Z`、`completedAt=2026-09-30T02:03:21.351Z`），執行 `npm run acceptance:ollama:ui:offline -- '<app-bundle>' docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay6.json llama3.2:3b` 的既存結果記錄 `externalSocketError=EPERM`、`loopbackAllowed=true`、`daemonStartedInSandbox=true`、`preinstalledModelFound=true`、`modelDownloadAttempted=false`，且 `systemNetworkDisabled=false`。UI 為 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、Electron `SIGTRAP`，沒有 dashboard/job/renderer 操作。runner 會保留 UI failure 並讓最終 `status=fail`，見 `scripts/verify-electron-ollama-ui-offline.mjs:312-320,543-558`；未把 feasibility 結果轉成 UI pass。
- 證據／條件：同一 replay6 中 `ui.electronProcessGroupAbsentAtExit=false`、`ui.electronProcessGroupClosed=true`、`ui.electronProcessGroupForcedCleanup=false`，但外層 `cleanup.uiRunnerProcessGroupAbsentAtExit=true`。UI verifier 的 `stopChild()` 在第二次 SIGTERM 後若 group 消失，仍回傳 `groupAbsentAtExit:false, groupClosed:true`（`scripts/verify-electron-ollama-ui.mjs:253-266`）；同時 finally 以這個 false 將 UI status 維持 fail（`scripts/verify-electron-ollama-ui.mjs:645-660`）。因此 evidence 沒有混淆最終 runner status，但欄位名與時點不足以直接證明 Electron process group 最終不存在；外層 runner group 的 true 不能替代此項證據。需明確區分「首次觀察仍存在」與「終止後確認已消失」，或將未確認視為清理失敗。

## 3. 邊界情況
- 判定：部分通過
- 證據：`2026-09-30 10:10 Asia/Taipei`，執行 `node scripts/test-ollama-ui-offline.mjs`；該 test 發現硬編碼 packaged candidate `../dist/release-0.51.0-macos-53956cc/mac-arm64/離線字幕工廠.app` 存在，並由 `/usr/local/bin/ollama list` 確認預裝 `llama3.2:3b`。該命令輸出 `Ollama offline packaged UI contract test passed`、exit 0。測試包含 Seatbelt deny／loopback assertions、拒絕自訂 endpoint／缺少模型、exclusive evidence、無 `--no-sandbox` 及測試模式注入不存在的 UI runner，見 `scripts/test-ollama-ui-offline.mjs:15-53,62-103`。此 macOS 故障注入斷言 `UI_RUNNER_SPAWN_FAILED`、`externalSocketError=EPERM`、預裝模型與 daemon／port／temp cleanup。
- 證據／限制：同一測試在非 macOS、Seatbelt、candidate 或模型缺失時會跳過 integration branch（`scripts/test-ollama-ui-offline.mjs:62-63,103-105`）；測試只注入 UI runner ENOENT，未注入 sandbox profile probe 失敗、Ollama daemon spawn／ready 失敗、evidence 寫入失敗、清理失敗或 UI target process group 清理失敗。故障矩陣仍不完整；replay6 提供了實際 Chromium init failure 路徑，但其 cleanup 欄位有上述歧義。

## 4. 程式碼品質
- 判定：部分通過
- 證據：runner 在啟動前檢查平台、model 名稱、客製 endpoint、bundle identity/version、Ollama executable／model store，且只在 exact preinstalled model 確認後啟動 UI，見 `scripts/verify-electron-ollama-ui-offline.mjs:124-142,414-466`。子程序環境以獨立 HOME/TMP 限縮，API keys 明確清空；evidence 使用 exclusive `flag: 'wx'`，清理確認 temp root，見 `scripts/verify-electron-ollama-ui-offline.mjs:232-264,525-558`。UI verifier 不保存 raw exception 或 child log，僅保留固定 diagnostic categories，並清理 userData／port，見 `scripts/verify-electron-ollama-ui.mjs:328-338,636-673`。`package.json:20` 註冊可重播 npm 命令。
- 證據／缺口：`projectUiEvidence()` 會將 UI 子 verifier 的 cleanup 摘要放在 `evidence.ui`，外層 cleanup 另記 automation runner process group；兩層欄位容易被讀成同一目標程序的清理結論。建議命名／schema 明示目標及觀察時點，並以最終 group probe 作為「已清理」的依據。測試多處採 source regex contract，能檢查關鍵字存在，但不能替代每個故障分支的行為驗證。
- 追加安全審查（2026-09-30 10:14–10:15 Asia/Taipei；`nl -ba scripts/verify-electron-ollama-ui.mjs | sed -n '84,115p'`、`rg -n 'webSocketDebuggerUrl|OSF_DEBUG_UI_STARTUP|redactedStartupDiagnosticLines|childOutput' scripts/verify-electron-ollama-ui.mjs scripts/verify-electron-ollama-ui-offline.mjs`）：DevTools HTTP `/json` 請求固定打 `127.0.0.1:${port}`，但 `waitForTarget()` 只檢查 `target.webSocketDebuggerUrl` truthy，並以 `target.url` 的 regex 接受 `127.0.0.1` 任意 port；`connectWebSocket()` 直接 `new WebSocket(wsUrl)`，未解析／限制 ws scheme、hostname 及 port 必須分別為 `ws:`、loopback 與本輪預期 DevTools port（`scripts/verify-electron-ollama-ui.mjs:84-103,380`）。因此 host-side driver 雖以 loopback 取得 target，實際 WebSocket 連線可被回應中的 URL 指向非 loopback／非預期 port；當 reserved DevTools port 在 Electron bind 前被其他本機程序搶占並回傳偽造 target 時，driver 有機會從 Seatbelt 外對外連線。這違反工作紀錄所述 driver「只連線 loopback DevTools／app server」的隔離前提，屬阻擋問題。
- 追加隱私審查（同上命令及時間）：`OSF_DEBUG_UI_STARTUP=1` 時 verifier 將 `childOutput` 中最多八行符合錯誤關鍵字的內容寫到 stderr（`scripts/verify-electron-ollama-ui.mjs:328-338,669-670`）；遮罩只處理使用者／暫存路徑、長 hex 與看似 token/API key 的欄位，沒有移除任意應用文字、字幕或模型輸出。日誌若含上述內容，debug stderr 可能外露 raw app/model text。replay6 的 evidence 沒有保存 raw log，該次於 renderer／AI flow 前中止，故沒有觀察到實際內容外洩；但 debug 輸出路徑本身未 fail-closed，focused test 也未覆蓋此情境。

## 5. 測試覆蓋
- 判定：部分通過
- 證據：`2026-09-30 10:10 Asia/Taipei`，實際執行 `node scripts/test-ollama-ui-offline.mjs && node --check scripts/verify-electron-ollama-ui-offline.mjs && node --check scripts/verify-electron-ollama-ui.mjs && node --check scripts/test-ollama-ui-offline.mjs`，exit 0，輸出 `Ollama offline packaged UI contract test passed`。`2026-09-30 10:10 Asia/Taipei` 執行 `git diff --check`，exit 0。完整 `npm run check` exit 0 是工作紀錄所載開發驗證，本審查未獨立重跑。
- 證據／缺口：replay6 為真实 packaged app 在 macOS arm64／Node 22.22.3、Ollama 3B 下的實際重播，結果如第 2 節；它證明隔離 probe 和 failure capture，而非 UI 功能。focused test 通過只證明該測試路徑，不解除 renderer 未啟動、UI flow 未覆蓋及 cleanup evidence 欄位歧義。Windows 依決策延後，LM Studio 依需求方決策不驗收，物理斷網及 cancel/checkpoint-resume 亦未覆蓋；這些界線在 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:24-25` 有揭露。

## 6. 實際運行結果
- 判定：部分通過
- 證據：replay6 evidence `docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay6.json` 的實測時間為 `2026-09-30T02:03:15.131Z–02:03:21.351Z`（10:03:15–10:03:21 Asia/Taipei）。macOS arm64／Node v22.22.3、v0.51.0 app bundle；結果為 `status=fail`、`failureStage=electron_start`、`failureCode=CHROMIUM_CHILD_SANDBOX_INIT_FAILED`。診斷類別包含 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`CHROMIUM_GPU_SANDBOX_UNAVAILABLE`、`OS_PERMISSION_DENIED`，Electron `SIGTRAP`；dashboard 未載入、job 未建立，app server port closed、userData removed。daemon stopped、daemon port closed、runner process group closed/absent、temporary root removed 均記為 true。沒有使用 `--no-sandbox` 或系統網路設定變更；證據 `systemNetworkDisabled=false`。
- 證據／限制：此結果是明確失敗的 feasibility finding，不是 packaged UI acceptance 通過。replay6 中 Electron 目標 process group 欄位仍為 absent=false／closed=true；因此可確認清理操作完成，但不能只據此欄位斷言最終 process group absence。未以 replay1–5 取代 replay6；更早 replay 僅作為歷史 runner cleanup 修正背景。

## 綜合判定
- 結論：不通過
- 阻擋問題（若有）：host-side DevTools driver 未限制 `webSocketDebuggerUrl` 的 scheme／host／預期 port，可能依不可信 target response 從 Seatbelt 外連至任意 endpoint；`OSF_DEBUG_UI_STARTUP` 又可能把未遮罩的 app／字幕／模型文字輸出至 stderr。兩項均未滿足本工作要求的隔離／隱私 fail-closed 邊界，需修正並由 focused negative tests 證明。此輪實機仍只完成 feasibility 查核；不得報為 packaged UI acceptance 通過，`FR-021` 仍未結案。
- 剩餘風險：除上述阻擋外，Chromium child sandbox 在目前 Seatbelt 外層隔離下初始化失敗，app server／renderer 未啟動，因此 Ollama UI optimize／accept／undo／redo／save flow 未驗收。UI 目標 group evidence 顯示 `electronProcessGroupAbsentAtExit=false`；需分辨首次觀察仍存在與後續終止後最終狀態。Windows 實機延後、LM Studio 依需求方決策不驗收、全機物理斷網與 UI cancel／checkpoint-resume 未覆蓋。
- 給主要開發代理的具體修正要求（若有）：解析 DevTools WebSocket URL，僅接受 `ws:`、loopback hostname 與本輪預期 port，拒絕任意／非預期 target；補測惡意 `webSocketDebuggerUrl` 指向遠端與其他 loopback port 時 driver 不建立連線。`OSF_DEBUG_UI_STARTUP` 僅輸出固定診斷類別，或以明確 allowlist／結構化欄位生成摘要，禁止逐字輸出 child log；加入含唯一字幕／模型哨兵字串的測試並證明 stderr 不含該值。另修正 process group cleanup evidence 的首次／最終觀察語意、測試額外 SIGTERM／SIGKILL 與無法確認分支；重跑 focused tests 及 macOS fault-injection。packaged replay 若仍無法啟動 UI，維持失敗 evidence，不得宣稱 UI acceptance 通過，FR-021 保持未結案。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
