# packaged Ollama UI live evidence runner provenance hardening：獨立六面向審查

- 審查日期：2026-10-28（Asia/Taipei）
- 審查角色：本輪獨立六面向審查代理
- 對應 08-CHANGE-LOG 條目：2026-10-28 — packaged Ollama UI live evidence runner provenance hardening（`FR-021-REPLAY-20261028-EVIDENCE-PROVENANCE-LIVE-UI`）
- 審查輪次：round1
- 審查範圍：`scripts/verify-electron-ollama-ui.mjs` 的 `runnerProvenance` projection、`scripts/test-ollama-ui-offline.mjs` 的 VM／redaction regression、`lib/runner-provenance.mjs`、replay1／replay2／replay3 evidence、00／06／07／08 最新條目與 current candidate identity
- 唯讀限制：未啟動 Electron、Ollama、live replay 或任何 network；未下載模型、未修改 OS network；僅讀取既有檔案並執行唯讀 shell checks
- 指定報告路徑在審查開始前確認不存在；除本報告外未建立或修改任何檔案
- current candidate identity：executable SHA-256 `b3605c589459068f894a70896b8ed843be3832a839fcdd83aa898e9b16210de4`；Electron Framework SHA-256 `416b6c8cf74c59188266d3ff7a3fc77b9f68bb52f7328d98b382d132580c8cee`

## 1. 需求完整性

- 判定：部分通過
- 證據：

  - `scripts/verify-electron-ollama-ui.mjs:12,78-84,213-228,272-336,895-912` 已接入 `sanitizeRunnerArgv`，並在 live evidence 寫入安全 argv、redaction counts、sandbox flags、candidate executable／Framework／review.js hashes、bounded child-output digest／bytes／diagnostic categories 與 `rawChildOutputPersisted=false`。
  - `lib/runner-provenance.mjs:1-46` 只接受固定 placeholder、受限 diagnostic port、已去敏且白名單化的 environment token，以及 ASCII candidate basename；未知 token、過長 token、缺失 argv 或超過 32 個 token 會被丟棄並使 `argvRedactionValidated=false`。
  - replay3 evidence 的 `runnerProvenance` 實際落盤：`argvRedactionValidated=true`、`argvDroppedCount=0`、`argvInputCount=2`、兩個 argv 均為 `--remote-debugging-port=9999`／`--user-data-dir=<temporary-user-data>`；candidate executable／review.js／Framework hash、Framework relative path、child-output hash／bytes／limit、diagnostic categories 與 raw-output flag 均存在。
  - replay3 的 artifact hashes 與磁碟 current candidate hash 完全一致；replay1／replay2 的 `runnerProvenance=null` 仍保留為 hardening 前的 immutable 歷史 evidence，未被覆寫。00／06／07／08 也清楚區分 replay3 hardening 與前兩份 normal replay。
  - `runnerProvenance.command=null` 的原因可由 source 與 evidence 對照確認：實際 `launch.command` 是中文 basename `離線字幕工廠`，`runnerProvenance.command` 只接受 `/^[A-Za-z0-9._ -]+$/`。這是安全 ASCII projection 的預期 fail-safe，不是保存 raw path／secret 的缺口；但它使 provenance 區塊本身無法單獨提供 executable basename，需與同份 evidence 的 `launch.command` 及 artifact hashes 合併追溯，屬非阻擋的自足性限制。
  - 最新 `08-CHANGE-LOG.md` 仍為「進行中」，尚未包含本報告引用與完整 review／發布欄位；因此治理 closeout 需求尚未完整完成。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：

  - live runner 先對 launch argv 做 `redactLaunchArgument`，再交給 `sanitizeRunnerArgv`；候選 executable、outer profile、user-data、環境值與 remote-debugging port 均有明確投影邊界，未知值不以原文落盤。
  - candidate executable／review.js／Framework identity 在 child spawn 前讀取；child stdout／stderr 只在記憶體內以最多 16,000 bytes 保留尾段，final evidence 只寫 SHA-256、byte count、capture limit 與 category，不寫 raw child output。
  - `finally` 路徑無論成功或 failure 都更新 provenance digest、執行 process／port／userData／owned-daemon cleanup，再以 exclusive `wx` 寫 evidence；replay3 的 pass 與 replay1 的 fail 均呈現上述 immutable evidence 行為。
  - `scripts/test-ollama-ui-offline.mjs:31-104,106-151,245-267` 以 VM 執行實際 runner failure path，驗證未知 secret/path argv 被排除、artifact-read failure 仍 cleanup、private path canary 不會出現在 evidence、child output 只保存 digest／bytes 且 raw flag 為 false；並以 source assertions 禁止 raw child log／exception text。
  - `command=null` 的 fail-safe 判定符合安全優先邏輯：非 ASCII basename 不被放進 ASCII-only provenance projection；目前 sibling `launch.command` 僅是 `path.basename(command)`，不是絕對路徑，且 candidate hash 提供穩定 identity。未發現因 null 而造成秘密、使用者路徑或 raw child output 洩漏。
  - 邏輯上的 residual 是 command projection 未抽成與 helper 共用的 basename validator，且沒有直接 regression assertion 固定「中文 command 必須為 null」；這降低未來變更時的防回歸強度，但不改變 replay3 當下的 fail-safe 結果。

## 3. 邊界情況

- 判定：部分通過
- 證據：

  - helper regression 覆蓋合法 placeholder／redacted env／port、未知 absolute path、secret-shaped env、unknown custom flag、`null` argv 與 33-token truncation；對 unsafe projection 的 JSON 內容確認不含 `sk-live-secret` 或 `/home/private`。
  - `sanitizeRunnerArgv` 對 token 長度限制 512、總數限制 32、port 範圍 1024–65535、candidate basename ASCII 長度 1–128 均 fail-closed；純唯讀 probe 亦確認含 `/Users/nycu` 與 secret 的輸入不會出現在輸出，且 safe projection 維持 `argvRedactionValidated=true`。
  - replay1／replay2／replay3 的 evidence JSON 均可解析；對三份原件的唯讀掃描未發現 absolute user／private／tmp path、secret marker、`childLogTail`／`childLogs`，且 diagnostics 的 `rawChildOutputPersisted=false`。replay3 另明確記錄 `captureLimitBytes=16000`、child-output digest 與 bytes。
  - replay3 的實際 scope 為 `loopbackOnlyConfiguration=true`、`apiKeySupplied=false`、`isolatedAcceptanceDaemon=true`，但 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`；這些邊界已被 evidence 與治理文件如實保留，沒有把 loopback 設定誤當作 OS network isolation。
  - 已保留 replay1 failure（`checkpoint_cancel`）與 replay2 pass；hardening replay3 的成功沒有刪除或改寫歷史結果。未覆蓋的邊界包括 Seatbelt packaged UI、真正全機 egress、Windows、其他模型／版本、長 prompt 與 command 的 Unicode 專門 regression。

## 4. 程式碼品質

- 判定：部分通過
- 證據：

  - 去敏與白名單規則集中在 `lib/runner-provenance.mjs`，live runner 只負責產生 launch summary 與將安全 projection／digest 合併進 evidence；責任分層清楚，且沒有修改產品 runtime 或 provider contract。
  - evidence schema 明確區分 `launch`、`runnerProvenance`、`diagnostics`、`artifact`；`rawChildOutputPersisted=false` 同時在 diagnostics 與 runner provenance 落盤，避免以缺欄位推測未保存 raw output。
  - child-output capture 以 `Buffer.length` 計算 bytes 並固定 cap，避免 UTF-16 length 誤判；startup diagnostics 只由固定 category regex 投影，不保存原始 stdout／stderr。
  - candidate hash 在 spawn 前取得、cleanup 在 `finally` 執行、evidence 使用 `wx` 防止覆寫；replay3 的 candidate identity、cleanup 與 raw-output flags 均與 source contract 一致。
  - 程式品質 residual 為 `command` 的 ASCII regex 在 live runner 與 offline wrapper 各自重複，且 `projectUiEvidence` 未把 candidate review.js hash 投影到 wrapper 的 runnerProvenance；本輪目標是 live verifier，故未形成 replay3 安全性阻擋，但若要求所有 runner schema 完全同構，應另立後續修正。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：

  - `scripts/test-ollama-ui-offline.mjs` 直接覆蓋 `sanitizeRunnerArgv` 合法／不合法／截斷契約、VM wrapper projection、實際 runner 的 artifact-read failure cleanup、private-path canary、raw child-output exclusion，以及 source-level 禁止 raw logs／exception text／debug startup output；這對本輪 regression 風險有實質覆蓋。
  - 本審查代理唯讀執行 `node --check scripts/verify-electron-ollama-ui.mjs`、`node --check scripts/test-ollama-ui-offline.mjs`、`node --check lib/runner-provenance.mjs`、`node --check scripts/verify-electron-ollama-ui-offline.mjs`、`git diff --check`，全部通過。
  - 本審查代理唯讀執行三份 evidence `jq empty`、candidate／Framework hash 對照、helper 的 secret/path fail-closed probe，以及 `node scripts/test-project-docs-validator.mjs`；全部通過。主要代理 08／06 所記錄的 focused／完整 `npm run check` 與 replay3 exit 0 結果與現有 source／evidence 一致，但本審查代理因明確限制未重跑 live 或會啟動 local service 的測試。
  - 缺口是測試沒有直接 assert `projectUiEvidence`／live projection 對非 ASCII `launch.command` 必須輸出 `command=null`，也沒有以 live test 再次證明三份歷史 evidence 的 provenance 差異；現有 replay3 evidence 與 source regex 能支持目前結果，但未完全固定未來回歸契約。
  - `npm run docs:check:final` 的唯讀執行目前 exit 1，具體原因是最新 08 條目缺少「獨立審查是否執行」「發布授權」、尚未標示「完成」且 review 欄位未完成；這是本輪治理 closeout 尚未完成，不是 hardening source syntax 或 replay3 evidence 的測試失敗。

## 6. 實際運行結果

- 判定：部分通過
- 證據：

  - replay3 `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay3.json` status `pass`；6 cues／6 batches 的 checkpoint cancel、同 session reload／resume、complete、save、cleanup 均通過，且 `runnerProvenance` 已非 null。
  - replay3 記錄 `candidateExecutableSha256=b3605c589459068f894a70896b8ed843be3832a839fcdd83aa898e9b16210de4`、`candidateFrameworkSha256=416b6c8cf74c59188266d3ff7a3fc77b9f68bb52f7328d98b382d132580c8cee`、`candidateFrameworkPresent=true`、`childOutputBytes=5554`、`captureLimitBytes=16000`、`startupDiagnosticCategories=[]` 與 `rawChildOutputPersisted=false`；磁碟 candidate hash 對照通過。
  - replay3 也記錄 `preinstalledModelFound=true`、`modelDownloadAttempted=false`、`existingServiceModified=false`，並確認 Electron process group、app port、temporary userData、owned daemon process／port／temporary root cleanup 全部成功；這些是現有 evidence 的 normal loopback run 結果，不是本審查代理重新啟動的服務。
  - replay1／replay2 既有 evidence 維持 immutable，分別保存 hardening 前 `runnerProvenance=null` 的 failure／pass 歷史；replay3 是新的 exclusive path，未覆寫任何既有 evidence 或 review。
  - 本輪沒有發布、tag、Release、PR、GitHub asset、模型下載或 OS network 變更。實際運行結論只能到 normal loopback packaged UI evidence provenance hardening；不能延伸到 Seatbelt offline、全機斷網、Windows 或 FR-021 完整驗收。
  - 治理實際結果仍未 close：`npm run docs:check:final` 因最新 08 條目尚未引用本報告與標示完成而失敗，需由主要代理在本輪唯一允許的其他工作流程中完成治理同步後再重跑 final gate。

## 綜合判定

- 結論：有條件通過。
- 阻擋問題（若有）：本輪未發現會造成 raw child output、secret 或使用者絕對路徑落盤的產品／evidence 安全阻擋；`runnerProvenance.command=null` 是中文 executable basename 未通過 ASCII-safe projection 的預期 fail-safe，造成的是 provenance 區塊自足 command identity 的非阻擋限制，不是安全洩漏。治理 closeout 仍有條件性阻擋：最新 `08-CHANGE-LOG.md` 尚未引用本報告、補齊 review／發布欄位、標示完成，故目前 `npm run docs:check:final` 仍失敗。
- 本輪條件是否已被需求方接受：是。
- 可逐字引用的完整結論句：**本輪「packaged Ollama UI live evidence runner provenance hardening」獨立六面向審查結論為有條件通過：`runnerProvenance` 的安全 argv／sandbox／candidate identity／bounded child-output digest projection 已由 source、VM／redaction regression、replay3 pass evidence 與 candidate hash 核對，未發現 evidence 保存 raw child output、secret 或使用者絕對路徑；`runnerProvenance.command=null` 是中文 executable basename 未通過 ASCII-safe projection 的預期 fail-safe，造成的僅是 command 自足追溯限制而非安全洩漏，且 sibling `launch.command` basename 與 executable／Framework hash 仍可對照；但本結論只適用 evidence provenance hardening／normal loopback packaged UI，`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`，不得宣稱 Seatbelt offline、全機斷網、Windows 或 FR-021 完整驗收，並須完成 08 review citation、欄位補齊與 `npm run docs:check:final` 才能完成治理 closeout。**
- Closeout condition：主要代理須將本報告路徑與上述完整結論句逐字同步至最新 `08-CHANGE-LOG.md`，補齊「獨立審查是否執行：是」「發布授權：不適用」及實際 closeout 欄位，將該條目標示為完成後重跑 `npm run docs:check:final`。此條件只關閉本輪 evidence provenance hardening 的治理文件，不擴大任何 offline、全機斷網、Windows 或 FR-021 完整驗收語意。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

唯一寫入路徑：`/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/reviews/2026-10-28-fr-021-evidence-provenance-live-ui-round1.md`

若上述聲明不實，本報告無效。
