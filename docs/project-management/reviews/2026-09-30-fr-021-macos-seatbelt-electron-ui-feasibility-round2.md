# 獨立審查報告：FR-021 macOS Seatbelt packaged Electron Ollama UI 可行性查核

- 審查對象 commit／版本：`299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`（分支 `codex/0.51-anthropic-claude`）／v0.51.0；replay9 候選來源 commit `53956ccdee6e16e4c0413f09312a419613b27da6`。
- 對應 08-CHANGE-LOG 條目：2026-09-30 — FR-021 macOS Seatbelt packaged Electron Ollama UI 隔離可行性查核。
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：（2026-09-30 約 10:45 Asia/Taipei；獨立審查上下文。依 repo `AGENTS.md`、development preflight 路由及 `docs/project-management/workflows/04-INDEPENDENT-REVIEW.md` 審查，未沿用開發代理對話記憶。）

## 1. 需求完整性
- 判定：部分通過
- 證據：FR-021 原始要求包含 Ollama 與 LM Studio 的 loopback 支援、端到端及斷網驗收（`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37`）。本輪明確將 LM Studio 排除為需求方既有範圍例外，Windows 依要求暫緩；工作紀錄與 audit 也將這次定義為 macOS packaged UI「可行性查核」，明示未達 UI flow 驗收且 FR-021 未結案（`docs/project-management/08-CHANGE-LOG.md:11-24`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:18-26`）。程式和紀錄沒有把這次結果擴大成 FR-021 完成。
- round1 三項要求均有對應修正與測試：DevTools 目的地限制、startup raw-line 輸出移除、三類 process group 清理語意及邊界測試；詳見第 2–5 節。

## 2. 邏輯正確性
- 判定：通過
- 證據：`lib/electron-devtools-target.mjs:16-35` 先驗證 `ws:`、`127.0.0.1`、本輪指定 port、DevTools page path，並拒絕帳密、query、fragment；未通過即丟出固定錯誤，不呼叫 WebSocket constructor。`scripts/verify-electron-ollama-ui.mjs:92-110,354-356` 在取得 target 時先做驗證，之後才連線。Focused test 覆蓋遠端 IP／hostname、錯誤 port、錯誤 scheme／path 等拒絕案例，並用 constructor counter 證明拒絕時建構次數為 0（`scripts/test-ollama-ui-offline.mjs:61-85`）。
- `OSF_DEBUG_UI_STARTUP`、逐字 startup line 輸出及相關 redacted-line 路徑已移除；測試明確禁止這些 debug 路徑（`scripts/test-ollama-ui-offline.mjs:51-54`）。verifier 仍以最多 16,000 字元的暫存 buffer 接收 child stdout/stderr，僅供 `safeStartupDiagnosticCategories()` 轉為固定類別（`scripts/verify-electron-ollama-ui.mjs:181-186,301-313`）；查核未見原始行寫入 stderr 或 evidence。這是內部分類輸入，不是 raw-line 輸出路徑。
- `lib/process-group-cleanup.mjs:18-78` 將清理開始狀態、SIGTERM 等待、必要時 SIGKILL、最終 probe 與確認結果分開回報；無效 ID 不會發 signal，無法確認時回報未確認。Electron、host automation driver、daemon 分別使用獨立欄位，cleanup 未確認或發生強制清理會使 acceptance 維持 fail（`scripts/verify-electron-ollama-ui.mjs:625-647`、`scripts/verify-electron-ollama-ui-offline.mjs:172-183,447-487`）。

## 3. 邊界情況
- 判定：通過
- 證據：`node scripts/test-ollama-ui-offline.mjs` 實際建立 detached POSIX child group，分別驗證 graceful SIGTERM 後消失、SIGTERM 無效後升級 SIGKILL 並消失、SIGKILL 後仍無法確認時回報 fail-closed，以及 invalid group ID 不發 signal（`scripts/test-ollama-ui-offline.mjs:87-135`）。WebSocket 負例包含非 loopback、錯誤 port、非 `ws:`、帳密及非 page path；拒絕 target 不會建立連線（同檔 `:65-85`）。
- 測試另包含 test-only UI runner ENOENT 故障注入，檢查 failure evidence、外連 `EPERM` 與 driver／daemon／port／temporary-root 清理（同檔 `:138-190`）。這不是每種 OS signal／權限錯誤的實機矩陣；本輪指定的四種 cleanup 情境均有實際或受控故障測試。Windows 未在本輪執行，且明確排除於本次範圍。

## 4. 程式碼品質
- 判定：通過
- 證據：DevTools 驗證及 process-group cleanup 抽成窄責任 module；caller 對 app、driver、daemon 個別保存 cleanup-start、final absence、closed confirmation 與 forced-cleanup，不再把「child 已退出」混同「整個 group 已消失」。缺少 group ID 可安全記為不存在；無效 ID 或 final probe 不明不會被當成確認完成。Evidence 使用固定診斷類別而不保存原始啟動行；wrapper 設 `systemNetworkDisabled=false`，不冒稱全機斷網。驗收命令由 `package.json:20` 提供。
- replay9 的 host driver 明確為未置於 Seatbelt 的 host process（evidence `isolation.uiAutomationDriverSandboxed=false`）；其受信任 DevTools 目的地由上述 exact-loopback-port guard 限制。這是本輪驗收架構的既定邊界，不能描述成 driver 本身受 Seatbelt 網路隔離。

## 5. 測試覆蓋
- 判定：部分通過
- 證據：審查執行時間約 2026-09-30 10:43 Asia/Taipei。`node scripts/test-ollama-ui-offline.mjs` exit 0，輸出 `Ollama offline packaged UI contract test passed`。以下五個語法檢查皆 exit 0：
  - `node --check lib/electron-devtools-target.mjs`
  - `node --check lib/process-group-cleanup.mjs`
  - `node --check scripts/verify-electron-ollama-ui.mjs`
  - `node --check scripts/verify-electron-ollama-ui-offline.mjs`
  - `node --check scripts/test-ollama-ui-offline.mjs`
- `git diff --check` exit 0，無輸出。依本輪限定未重跑 `npm run check` 或 `npm run docs:check:final`；工作紀錄所載完整開發套件結果不是本審查重新執行的證據。

## 6. 實際運行結果
- 判定：部分通過
- 證據：直接讀取 `docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay9.json:3-4`，執行時間為 2026-09-30 10:31:59.805–10:32:04.952 Asia/Taipei；環境 macOS arm64、Node v22.22.3，候選 v0.51.0。`status=fail`、`failureStage=electron_start`、`failureCode=CHROMIUM_CHILD_SANDBOX_INIT_FAILED`；Electron signal 為 `SIGTRAP`。`externalSocketDenied=true`、錯誤 `EPERM`、loopback 可用、3B 模型已存在且未下載；`systemNetworkDisabled=false`（JSON `:19-37,117-123`）。
- Renderer／首頁及 UI flow 未啟動：`homeDashboardLoaded=false`，job／settings／optimize／accept／undo／redo／save 均沒有完成（JSON `:39-86`）。故這是 Seatbelt 隔離與啟動失敗的實際 feasibility evidence，絕不是 packaged UI acceptance pass。
- Cleanup evidence 語意明確且結果一致：Electron group 清理開始時存在，最終確認 absent，未強制 SIGKILL；Electron 已退出、app server port closed、userData removed（JSON `:87-96`）。host driver group 與 daemon group 清理開始時均不存在、最終確認 absent，未強制 SIGKILL；driver exited、daemon stopped、daemon port closed、temporary root removed（JSON `:103-115`）。
- 可重現的本輪審查指令為本節前列 focused test、五個 `node --check` 及 `git diff --check`；replay9 是已保存的原始 packaged run evidence，本審查未再次啟動 packaged app。Windows／LM Studio 未驗收，符合明示範圍排除。

## 綜合判定
- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 round2 獨立審查結論為有條件通過：round1 三項修正與限定驗證均通過，但 replay9 因 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`SIGTRAP` 未啟動 renderer，故不得視為 packaged UI acceptance 通過，FR-021 整體仍未結案。**
- 阻擋問題（若有）：round1 指出的三項實作缺失已由程式檢查及 focused 測試解除；本輪沒有發現新的程式阻擋問題。Packaged Electron renderer 仍因 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`SIGTRAP` 未啟動，這是尚未解決的產品 UI acceptance 缺口，不能以 feasibility runner 或其清理成功替代。
- 剩餘風險：FR-021 整體未結案；Ollama packaged UI 的 optimize／accept／undo／redo／save 未實測，全機物理斷網與 UI cancel／checkpoint-resume 未覆蓋。LM Studio 依需求方明示例外不驗收，Windows 依要求暫緩。任何後續報告須維持 replay9 為失敗且不得寫成 UI acceptance pass。
- 給主要開發代理的具體修正要求：round1 三項修正可接受，無需針對本輪發現代修。若另行處理 UI acceptance，應以不降低 Chromium sandbox 的方式調查可回復的 macOS per-app egress 隔離方案，重新保存實機證據並另行審查；`--no-sandbox` 不可作為通過替代。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
