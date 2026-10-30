# 獨立審查報告：FR-021 instrumented packaged-run readiness audit

- 審查對象 commit／版本：工作樹分支 `codex/0.51-anthropic-claude`、package version `0.51.0`；本輪審查為既有 dirty worktree 的靜態 readiness audit。
- 對應 08-CHANGE-LOG 條目：2026-10-14 — FR-021 instrumented packaged-run readiness audit（`docs/project-management/08-CHANGE-LOG.md:3-17`）。
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-14T06:30:46Z；獨立上下文；先檢查 Git 狀態，再讀取 `full` preflight 列出的核心／路由文件與最新工作條目，未沿用主要代理對本輪結果的評價。

## 1. 需求完整性

- 判定：通過
- 證據：`08-CHANGE-LOG.md:7-17` 將本輪定義為驗收工具／證據準備度盤點，明列 FR-021、NFR-001、NFR-005、NFR-006、禁止啟動 packaged Electron／Ollama、禁止 network probe／canary／OS policy 變更，並要求核對 outer／child argv、stderr、Framework identity 與 exact generated profile。readiness evidence `docs/project-management/evidence/2026-10-14-fr-021-instrumented-packaged-run-readiness-audit.json:42-99` 對應保存項目、缺口、scope flags、後續授權條件與 partial 結論；`00-CURRENT-STATUS.md:11-18`、`06-TEST-AND-PROCESS-AUDIT.md` 的本輪段落及 `07-DEBUG-AND-FIX-HISTORY.md:25-30` 均維持 FR-021 blocker 與本輪非 acceptance 的範圍。
- 證據：需求分析 `02-REQUIREMENTS-ANALYSIS.md` 的 FR-021 驗收條件要求真正斷網下的本機字幕優化；本輪文件沒有將 readiness audit 當作該端到端驗收，且明列 LM Studio／Windows 等既有範圍例外未被本輪解除。

## 2. 邏輯正確性

- 判定：通過
- 證據：靜態 hash／invariant validator 重新解析 readiness audit，核對其 7 個 input SHA-256、`status=pass`、`currentContract=partial`、五個禁止操作 flags 全為 `false`、`noSandboxFlagUsed=true`，並核對 replay11 的缺失欄位均為 false。結果：`status=pass`、`currentContract="partial"`、`exactProfile=false`。
- 證據：`scripts/verify-electron-ollama-ui.mjs:183-200` 顯示 outer child argv 與 stdout／stderr 只在記憶體／最多 16,000 字元暫存；`scripts/verify-electron-ollama-ui.mjs:321-334` 只把輸出降為固定診斷 categories，`376-379` 才保存 executable／review.js hash。這與 evidence `:43-51` 的 available／missing 判定一致。
- 證據：`scripts/verify-electron-ollama-ui-offline.mjs:233-317` 將 packaged runner 參數以記憶體傳遞並只投影 UI evidence；`electron/main.mjs:62-88` 保留 renderer sandbox、context isolation、nodeIntegration=false。未發現 command-line／argv 或 Framework identity capture，與 evidence `:61-66` 一致。
- 證據：replay11 evidence `docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay11.json:19-32,87-101` 只提供 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、outer profile／scope、cleanup 與 startup categories；未提供 replay-time argv、Framework hash 或 generated profile。故現有結論「partial readiness、exact profile 需另行授權 trace」邏輯成立。

## 3. 邊界情況

- 判定：通過
- 證據：readiness evidence `:4-10` 固定 `packagedElectronLaunched=false`、`ollamaStartedOrStopped=false`、`networkProbeRun=false`、`osNetworkConfigurationChanged=false`、`canaryRerun=false`、`noSandboxFlagUsed=true`；replay11 `:117-123` 亦保持 `systemNetworkDisabled=false`、無 API key、無 external provider、LM Studio／Windows 未納入。
- 證據：`scripts/verify-electron-ollama-ui.mjs:25-32` 有 evidence exclusive-create、loopback URL 與輸入驗證；`scripts/verify-electron-ollama-ui-offline.mjs:181-194` 的 sandbox profile／外部 socket檢查屬 runner 內既有實際 acceptance path 的 source，並未在本輪被執行；本輪沒有把它誤記為新 canary 或 network probe 結果。
- 證據：static bundle identity `docs/project-management/evidence/2026-10-12-fr-021-replay11-electron-framework-identity.json:10-27` 清楚區分 executable hash match、目前 Framework 靜態 hash 與 replay-time Framework provenance；`docs/project-management/evidence/2026-10-14-fr-021-replay11-exact-profile-feasibility-audit.json:47-64` 清楚區分 static identity 與 exact generated profile。這避免把 synthetic profile、pinned Chromium source、目前 bundle identity 或 failure category 擴張為唯一 root cause／acceptance。

## 4. 程式碼品質

- 判定：通過
- 證據：兩支 UI runner 的輸入、evidence path、loopback／sandbox scope、cleanup 與錯誤分類均可由具名函式／固定欄位追溯；packaged runner 對 transient child output、diagnostic category、artifact hash 的責任邊界清楚，offline wrapper 對 process group、evidence projection 與 exclusive create 有明確分層。
- 證據：`package.json:13-20,29-30,43-56` 固定 docs scripts、acceptance scripts、Electron `^43.3.0`、Node `>=22.12.0`、`asar=false` 與 app metadata；`package-lock.json:7-19` 與 manifest version／engine／devDependency 一致。這些是 package metadata 的靜態可追溯性，不被誤稱為 replay-time binary provenance。
- 證據：`node --check scripts/verify-electron-ollama-ui.mjs`、`node --check scripts/verify-electron-ollama-ui-offline.mjs`、`node --check electron/main.mjs` 均 exit 0；未發現本輪需提出的 syntax 或明顯 evidence projection 邏輯阻擋。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：本輪實際執行 `npm run docs:check`，輸出「專案治理文件檢查通過：19 個文件，版本 0.51.0」、exit 0；`git diff --check` exit 0；source node syntax checks 全部 exit 0；JSON parse／invariant／hash validator exit 0。validator 核對的輸出包含 7 個 `hash-ok`、replay failure category、scope flags、bundle executable hash match 與 static Framework measurement。
- 證據：本輪刻意沒有執行 `npm run check`、任何 app／Electron／Ollama／network／canary，因此沒有新增 runtime、UI flow、模型、OS egress 或 canary 重播覆蓋。這是使用者明確限制下的可接受範圍，但使本面向不能判定為完整通過。
- 證據：第一個 ad hoc validator 曾因審查代理誤讀欄位名（將 `rawChildOutputPersistedInEvidence` 寫成 `rawChildOutputPersisted`）而 exit 1；未修改任何檔案，修正 validator 欄位名後同一組 source／JSON／hash invariant 重跑 exit 0。此為審查指令本身的修正，不是專案 assertion failure。

## 6. 實際運行結果

- 判定：部分通過
- 證據：本輪實際執行的是讀取／靜態驗證：`pwd && git status --short --branch`、`npm run project:preflight -- --type=full`、檔案／行號讀取、`ls`／`rg` 靜態核對、node JSON／hash validator、三個 `node --check`、`npm run docs:check` 與 `git diff --check`。所有允許的正式驗證命令均成功；初始 Git 狀態顯示既有 dirty worktree，沒有被本輪清理或覆寫。
- 證據：bundle 靜態 identity 可由保留檔案重算：`../dist/release-0.51.0-macos-53956cc/mac-arm64/離線字幕工廠.app` 的 executable hash 與 replay11／identity evidence 一致；Electron Framework `43.3.0` 的目前 binary hash 與 identity evidence 一致。identity evidence `:24-27` 同時明確聲明這不能證明 replay-time Framework bytes、exact profile 或 root cause。
- 證據：沒有執行 packaged app、Ollama、socket／network probe、canary 或 OS policy 操作，因此不存在可供本輪聲稱的 packaged UI acceptance 實際運行結果；既有 replay11 的 `electron_start` failure 只作為 read-only input，沒有被本輪重跑。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪有條件通過：instrumented packaged-run readiness 僅部分具備；source hash、JSON invariant 與 scope flags 可追溯，exact generated profile 與 replay-time binary provenance 未保存且不可由 audited artifacts 重建，FR-021 packaged UI offline acceptance blocker 保留。**
- 阻擋問題（若有）：本輪 readiness audit 無新增程式阻擋；但 FR-021 packaged UI offline acceptance 的既有 evidence blocker 仍存在，不能以本輪 `status=pass` 或 partial readiness 解除。
- 剩餘風險：尚無 outer argv 的持久化 redaction、raw／可重現 redacted stderr、replay-time Framework／build provenance、Chromium runtime generated child profile 或等價 trace；亦未取得本輪 packaged UI、真正斷網、OS-level egress control、LM Studio 或 Windows 實機結果。
- 給主要代理的整合條件：整合時只逐字引用本報告結論，保留 `00`／`06`／`07` 與本輪 evidence 對 partial readiness、exact profile 缺失及 FR-021 blocker 的限定；不得把 synthetic profile、pinned source、目前 static bundle identity、`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、audit `pass` 或本報告的條件通過改寫成 exact generated profile、replay-time binary provenance、唯一 root cause 或 packaged UI acceptance。若未來要解除 blocker，須另立明確授權的 instrumented packaged run 或等價 preserved trace，並保存 fixed candidate、Framework／build provenance、redacted argv／diagnostics、exact profile／等價 trace、exclusive evidence、cleanup 與 rollback 條件。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
