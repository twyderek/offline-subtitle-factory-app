# 獨立審查報告：current-source packaged Ollama UI Seatbelt offline replay

- 審查對象：`docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-offline-current-source-replay1.json`、`scripts/verify-electron-ollama-ui-offline.mjs`、`lib/runner-provenance.mjs`、目前 macOS arm64 directory candidate 及既有 normal replay。
- 對應 08-CHANGE-LOG 條目：2026-10-28 — current-source packaged Ollama UI Seatbelt offline replay（`FR-021-REPLAY-20261028-UI-OFFLINE-CURRENT-SOURCE`）。
- 審查輪次：round1。
- 審查限制：未執行 live runner、network、Ollama／Electron replay 或模型操作；未下載／停止模型；未修改 OS 網路或既有 evidence／source／治理文件。只執行 preflight、文件／source／candidate／evidence 讀取、hash／欄位核對、唯讀 leakage pattern scan、syntax check、治理 validator、`npm run docs:check`、`npm run docs:check:final` 與 `git diff --check`。
- 審查環境：版本 `0.52.0`、branch `codex/0.51-anthropic-claude`、macOS arm64。`node --check`（offline runner、live verifier、provenance helper）、`node scripts/test-project-docs-validator.mjs`、`npm run docs:check` 與 `git diff --check` 通過；`npm run docs:check:final` 目前因最新 08 條目尚未補審查／發布欄位且仍為「進行中」而 exit 1。

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37` 的 FR-021 要求 Ollama／LM Studio loopback、本機模型端到端驗證、嚴格 cue 契約、不自動下載，並要求斷網完成本機字幕優化；同文件的 LM Studio 例外與政策並未解除 Ollama 或 FR-021 整體要求。最新 `docs/project-management/08-CHANGE-LOG.md:3-20` 正確把本輪限定為一次 current-source packaged UI Seatbelt replay，且不預先宣稱 pass。

  指定 offline evidence `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-offline-current-source-replay1.json:22-24` 是 `status=fail`、`failureStage=electron_start`、`failureCode=CHROMIUM_CHILD_SANDBOX_INIT_FAILED`；`:42-104` 顯示 home、job、optimize、accept、history、save 均未進入成功流程。因此本輪不能完成 packaged Electron UI 的 FR-021 UI acceptance，只能完成其隔離／啟動失敗與收尾子範圍的可追溯性。

  `docs/project-management/00-CURRENT-STATUS.md:5-8`、`06-TEST-AND-PROCESS-AUDIT.md:5-8`、`07-DEBUG-AND-FIX-HISTORY.md:5-8` 均未把 failure 寫成 UI pass；正常 replay 也被文件明確排除為本範圍的替代證據。需求完整性因此是 offline boundary 子範圍通過、packaged UI acceptance 未完成，不能判定 FR-021 完成。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：offline runner 在 `scripts/verify-electron-ollama-ui-offline.mjs:13-14` 使用 Seatbelt deny-network profile，只允許 localhost bind／inbound／outbound；`:182-194` 以 sandbox probe 要求 loopback response 為 `loopback-ok` 且外部測試 socket 回 `EPERM`，否則 fail-closed。指定 evidence `:25-35` 與此契約一致：`loopbackAllowed=true`、`externalSocketDenied=true`、`externalSocketError=EPERM`、`daemonStartedInSandbox=true`、`electronAppStartedInSandbox=true`、`networkSandboxInheritedByElectronAndServer=true`。

  runner 在 `scripts/verify-electron-ollama-ui-offline.mjs:234-317` 將 UI driver 設定為 `OSF_OLLAMA_UI_NETWORK_SANDBOX=1`，讀取 live UI evidence；若 live evidence 的 `status` 不是 `pass`，會把 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` 或其 startup diagnostic category 轉成同一固定 failure code，而不是把失敗流程升格為成功。指定 evidence `:97-104` 的 `failureCategory` 與 diagnostic categories、`:98-99` 的 `SIGTRAP` 由此邏輯一致產生。

  `scripts/verify-electron-ollama-ui-offline.mjs:420-480` 先驗證 macOS arm64、candidate、模型 store、profile 與預裝 model，再啟動 sandboxed daemon／UI；`:492-538` 在成功或失敗後都執行 process-group、port、temporary-root cleanup，並以 exclusive create 保存 evidence。這支持 failure-safe 邏輯，但 `systemNetworkDisabled=false`（evidence `:35`、`:156-161`）也表示它不是全機斷網控制；`uiAutomationDriverSandboxed=false`（`:33`）表示 driver 本身不應被誤述為整棵程序樹均由 driver sandbox 執行，真正被核對的是 target Electron／server 的 network sandbox inheritance。

## 3. 邊界情況

- 判定：部分通過
- 證據：Seatbelt loopback／external boundary 通過：evidence `:25-35` 明確記錄 loopback allow、外連 `EPERM`、daemon／Electron sandbox inheritance；`daemon` `:37-40` 記錄 `preinstalledModelFound=true`、`modelDownloadAttempted=false`、`stopped=true`。這足以支持「model no-download」與本次受控本機 boundary，不能推論模型品質或所有模型／版本相容性。

  cleanup 通過：evidence `:90-96` 顯示 app port closed、Electron exited、process group absent／closed、非 forced cleanup、userData removed；`:142-154` 顯示 UI driver group、Ollama daemon group、daemon port 與 temporary root 均完成清理。runner source `:197-207`、`:492-531` 也把 group cleanup 與 cleanup failure 分開判定；因此不能把 UI startup failure 誤寫成 cleanup failure，也不能把 cleanup pass 誤寫成 UI pass。

  UI 邊界未通過：evidence `:42-89` 的 home、settings、optimize、accept、undo／redo、save 都是空值／false／0，並且 `homeDashboardLoaded=false`；這是 packaged Electron UI 因 nested Chromium startup blocker 未完成，而非模型或 subtitle flow pass。`--no-sandbox` 沒有出現在 offline runner／live probe；repository test source `scripts/test-ollama-ui-offline.mjs:285-300` 亦固定此安全邊界。

  evidence 的 top-level schema 沒有 `leakageScan` 欄位；本輪唯讀 scan 對指定 evidence 的 `/Users/`、user home／private temp path、`PRIVATE_ARTIFACT_PATH_CANARY`、實際 secret-shaped token 與 `sk-live-secret` pattern 無 match，且 `rawChildOutputPersisted=false`、child output bytes `3441` 小於 `captureLimitBytes=16000`（evidence `:131-139`）。因此可支持本次讀取核對未發現已知洩漏，但不能把未落檔的外部 scan 摘要當作 evidence 內建的自足 `leakageScan` pass 欄位。

## 4. 程式碼品質

- 判定：部分通過
- 證據：`scripts/verify-electron-ollama-ui-offline.mjs:320-397` 對 live UI evidence 做型別／格式／hash／診斷欄位的 fail-closed projection；`lib/runner-provenance.mjs:69-105` 將 command、raw argv sanitizer、candidate executable／review.js／Framework SHA-256、bounded child-output digest 與 diagnostic categories 集中到 shared projection。`scripts/test-ollama-ui-offline.mjs:261-323` 以 source assertions 固定 deny rules、預裝 model gate、cleanup、無 `--no-sandbox`、bounded output 與 shared provenance wiring。

  candidate hash 核對一致：`../dist/mac-arm64/離線字幕工廠.app` 的 executable SHA-256 為 `b3605c589459068f894a70896b8ed843be3832a839fcdd83aa898e9b16210de4`，`Contents/Resources/app/public/review.js` 為 `ac25c6639a282eb5807c903fd0bded2419a39ce304428efeb137ac4a19a2b04b`，Electron Framework 為 `416b6c8cf74c59188266d3ff7a3fc77b9f68bb52f7328d98b382d132580c8cee`；三者與 offline evidence `:18`、`:126-130` 及既有 normal replay `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-normal-replay1.json:5-9` 一致。candidate provider source 與 worktree `lib/ai/providers.mjs` SHA-256 均為 `f402f835ba55c7b776a9280d9b5637fb26fa1af59543901b6b7aef11d74967ed` 且 byte-for-byte 相同。

  已知 provenance residual 需保留：offline evidence `:105-139` 的 `argvRedactionValidated=false`、`argvDroppedCount=1`，與目前 `lib/runner-provenance.mjs:11,17,29-30` 對 candidate executable token 使用 ASCII basename allowlist 的行為一致；沒有保存 raw path／secret，但 provenance 不是完整 argv validation pass。這是 evidence 追溯欄位的 fail-safe residual，不得被改寫成 offline UI 成功，也不改變 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` 的 runtime 結果。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：本輪唯讀驗證中，offline runner、live verifier、`lib/runner-provenance.mjs` 的 `node --check` 通過；`node scripts/test-project-docs-validator.mjs`、`npm run docs:check` 與 `git diff --check` 通過。repository focused test source 具備 deny-network、EPERM、model no-download、cleanup、nested Chromium failure classification、no raw output 與 no `--no-sandbox` assertions（`scripts/test-ollama-ui-offline.mjs:261-323`），但依本輪禁止 live／Ollama／Electron／model 操作，沒有把該 focused integration test 重新執行成新的 runtime evidence。

  指定 immutable evidence 本身覆蓋一次 macOS arm64、`llama3.2:1b`、目前 candidate 的 Seatbelt replay；它覆蓋了 isolation／no-download／cleanup 與 startup failure，未覆蓋 packaged UI home、AI optimize、accept、undo／redo、save、cancel／resume、其他模型／版本、Windows 或全機 egress。既有 normal replay `...-normal-replay1.json:3,40-48` 是另一個 `sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`、`systemNetworkDisabled=false` 的 normal loopback pass，不能填補這些 offline UI 缺口。

  `npm run docs:check:final` 本輪 exit 1，具體原因是最新 `08-CHANGE-LOG.md` 尚缺「獨立審查是否執行：」與「發布授權：」，且狀態仍為「進行中」。這是本輪治理 closeout 尚未完成的實際結果，不是 packaged UI flow pass，也不能用來掩蓋指定 evidence 的 failure。

## 6. 實際運行結果

- 判定：部分通過
- 證據：指定 offline replay evidence `:3-5` 記錄 2026-10-28T04:41:52Z 至 04:41:58Z 的 5846 ms run；`status=fail`、`failureCode=CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`failureStage=electron_start`。`ui` `:42-104` 記錄 `homeDashboardLoaded=false`、`suggestionCount=0`、`accepted=0`、未保存；`electronExitSignal=SIGTRAP`。因此 packaged Electron UI offline flow 確實未完成，failure 證據不能寫成 pass。

  同一 evidence 的 isolation／daemon／cleanup 子範圍如前述均通過：Seatbelt loopback allow、external socket `EPERM`、preinstalled model、`modelDownloadAttempted=false`、Electron／driver／daemon／port／temporary cleanup 全部 true；`rawChildOutputPersisted=false`。這是本輪可接受的實際運行結果分解，而非把整份 status fail 拆成整體 pass。

  既有 normal replay 的 `status=pass` 與 UI flow（2 suggestions、accept 2、undo／redo、reviewed.srt、timecodes unchanged）只在 `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-normal-replay1.json:48-162` 成立；其 scope `:40-46` 明確是 `sandboxedTargetProcessTree=false`、`systemNetworkDisabled=false`、loopback-only normal run。它支持 candidate／provider／normal UI 的對照，不支持本輪 Seatbelt packaged UI offline pass。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：
  1. Packaged Electron UI 的 Seatbelt offline acceptance 被 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`CHROMIUM_GPU_SANDBOX_UNAVAILABLE`／`OS_PERMISSION_DENIED` 與 Electron `SIGTRAP` 阻擋；UI 未載入 home，AI flow、accept、history、save 未完成。這是本輪 runtime acceptance 的阻擋項，不能以 normal replay 代替。
  2. 最新 08 條目仍為「進行中」，`npm run docs:check:final` 尚因缺少審查／發布欄位而失敗；本報告建立後仍需由主要代理完成其治理 closeout，但不得藉此改寫 failure evidence。
  3. 指定 evidence 沒有自足的 `leakageScan` 欄位，且 provenance `argvRedactionValidated=false`；本輪 scan 未發現已知敏感路徑／secret，但這兩項仍是 evidence 完整性 residual，應在後續治理中如實保留。
- 本輪條件是否已被需求方接受：是
- 剩餘風險：`systemNetworkDisabled=false`，本輪是 process／acceptance-subtree 的 macOS Seatbelt loopback boundary，不是全機斷網或 OS-level egress proof；未涵蓋 Windows、LM Studio（依既有明確範圍例外）、其他模型／版本、長 prompt、cancel／resume 或成功的 Seatbelt packaged Electron UI。`CHROMIUM_CHILD_SANDBOX_INIT_FAILED` 是本次固定 failure category，不應被描述成已證明的唯一根因。
- 可逐字引用的完整結論句：**本輪 current-source packaged Ollama UI Seatbelt offline replay 的獨立六面向審查結論為有條件通過：Seatbelt loopback、external EPERM、preinstalled model no-download 與 process／port／temporary cleanup 子範圍均通過；packaged Electron UI 因 CHROMIUM_CHILD_SANDBOX_INIT_FAILED／SIGTRAP 於 electron_start 未完成，UI 未進入 home／AI flow；本證據僅限 macOS arm64 current candidate 的 process-level Seatbelt boundary，systemNetworkDisabled=false，不得宣稱全機斷網、Windows 或 FR-021 完整驗收。**

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
