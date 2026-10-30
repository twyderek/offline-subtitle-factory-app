# FR-021 Chromium nested sandbox process-composition next-stage diagnostic round1

## 1. 需求完整性

- 判定：有條件通過
- 證據：本輪指定範圍已涵蓋 synthetic Seatbelt nested-profile composition canary、packaged candidate 的 `--single-process`／`--no-zygote` bounded startup probe、package syntax-check wiring、focused deterministic source assertions、三份指定 evidence 與 00／03／06／07／08 文件同步。文件明確寫出 synthetic canary 只執行 `/usr/bin/true`，`chromiumNetworkServiceShapeIsExactGeneratedProfile=false`；也明確把 local page、startup probe 與 packaged UI acceptance 分開，並保留 `systemNetworkDisabled=false`、Windows 與 FR-021 完整驗收未完成的界線。
- 條件：目前 00／06／07／08 頂部條目引用的是較新的 `electron-single-process-startup-probe3.json` 與 `electron-no-zygote-startup-probe2.json`，而本次指定審查 evidence 是 `probe2.json` 與 `probe1.json`。兩組檔案均存在且舊檔未覆寫，但文件與本次 review 的指定 artifact 集合不是完全同一組；若 probe3／probe2 是有意 supersede，應由後續治理條目明確留下 supersession 關聯，否則無法只靠本報告把指定 probe2／probe1 視為文件目前唯一來源。

## 2. 邏輯正確性

- 判定：部分通過
- 通過部分：`scripts/probe-electron-single-process.mjs` 目前使用 `selectTrustedElectronPageTarget(targets, port)`，由 `lib/electron-devtools-target.mjs` 同時限制 loopback page URL 與 exact-port `ws://127.0.0.1:<port>/devtools/page/`，沒有依賴 transient title；`spawnErrorCode` 也已保存。`--no-zygote` 的既有 evidence 將 local page 出現與 renderer 可操作分開，`cdpError` 為 `DEVTOOLS_RUNTIME_EVALUATE_TIMEOUT`，`childExitSignal` 為 `SIGTRAP`，沒有把 page target 當作成功。
- 主要問題：probe 的 `status` 條件（`scripts/probe-electron-single-process.mjs:275`）要求 page、CDP response、無 spawn error 與 cleanup，但沒有要求 `childExitSignal === null`／成功 exit code，也沒有要求 `pageUrlLocal` 或 `cdpResult` 具備有效 home-dashboard 結果。若未來某次先短暫發布 page／回 CDP、之後以 `SIGTRAP` 結束，這個 runner 仍可能寫出 `status=pass`。本次兩份指定 evidence 因缺 page 或 CDP timeout 而是 fail，未形成實際假 pass，但 source contract 尚未完全 fail-closed。
- 另一項證據語意問題：probe 在 `waitForPage()`／`connectAndInspect()` 中實際對 loopback DevTools 建立 HTTP 與 WebSocket 連線，但 evidence 的 `invocation.networkConnectionsAttempted=false`（probe source: `:240`）。若該欄位意指「未嘗試任何 network connection」則不正確；應區分 harness loopback control-plane 與 external network attempt。`externalSocketAttempted=false` 與 `systemNetworkDisabled=false` 則與目前 scope 一致。
- synthetic canary 的四個 case 與 `status=pass` 邏輯只證明 `/usr/bin/true` 在指定 synthetic parent／child profiles 下的 exit／EPERM 結果；evidence 自己標明 child shape 不是 exact generated Chromium profile，因此不能推導唯一 root cause，也不能作 packaged UI pass。

## 3. 邊界情況

- 判定：部分通過
- 通過部分：指定 probe source 使用 `flag: 'wx'`、evidence path 位於 `docs/project-management/evidence`、輸出檔 mode 為 0600；child output 只保留 SHA-256 與 UTF-8 byte count，`rawChildOutputPersisted=false`，沒有把 raw stderr 或使用者路徑寫進 evidence。focused assertions 也固定 `--no-sandbox`／`ELECTRON_DISABLE_SANDBOX` 不得出現、`packagedUiAcceptanceRun=false`、exclusive create 與 package syntax wiring。
- 實際 evidence 邊界可信：canary 記錄 `packagedCandidateExecuted=false`、`uiFlowRun=false`、`modelDownloaded=false`；`probe2`／`no-zygote probe1` 均記錄 `outerSandboxProfileApplied=true`、`sandboxedTargetProcessTree=true`、`modelDownloaded=false`、`existingOllamaDaemonStartedOrStopped=false`、`packagedUiAcceptanceRun=false`。三份檔案 JSON 均可解析，兩份 packaged probe 的 cleanup 均為 process group absent／closed confirmed、temporary root removed；現有 candidate／Framework SHA-256 也與目前 `../dist/mac-arm64/離線字幕工廠.app` 相符。
- residual：`probe-electron-single-process.mjs` 以線性流程配置 temp root、spawn、probe、cleanup；若在 child 建立前後的未預期同步例外（例如 temp 建立、spawn 參數或 output 組裝階段）跳出，沒有外層 `try/finally` 保證既有 temp root 一定移除。已完成的兩次 evidence 不能證明所有例外路徑都不洩漏。canary 也在所有 case 執行後才由 `wx` 拒絕既有 output，雖不會覆寫，但不是最早 fail-fast 的 exclusive reservation。

## 4. 程式碼品質

- 判定：部分通過
- 證據：診斷腳本邊界集中、變體白名單只有 `single-process`／`no-zygote`，沒有 shell、沒有 `--no-sandbox`、沒有 `ELECTRON_DISABLE_SANDBOX`，並共用 `cleanupProcessGroup()`；`package.json` 的 `check` 含 `node --check scripts/probe-electron-single-process.mjs`，`test` 含 `node scripts/test-ollama-ui-offline.mjs`。focused test 對 exact-port DevTools selection、spawn error 欄位、raw-output exclusion、scope boundary 與 forbidden sandbox flags 有 source-level assertion。
- 品質限制：目前 deterministic assertions 多為 regex／source-contract，未直接以 fixture 執行 probe 的 timeout、CDP response、child signal、evidence exclusive-write 或 output redaction runtime path；這在本輪「不重跑 Electron／Ollama」限制下可接受為 review scope，但不能取代 runtime regression。另，probe 的 `ELECTRON_EARLY_EXIT` 由 `SIGTRAP` 或 output pattern 分類，與 `childExitSignal` 並存是合理的，但 status 沒有將 signal 納入成功門檻，應視為同一套契約尚未閉合。

## 5. 測試覆蓋

- 判定：有條件通過
- 證據：`package.json` syntax wiring、focused test source assertions 與 `node --check scripts/probe-electron-single-process.mjs`／`node --check scripts/test-ollama-ui-offline.mjs` 的唯讀檢查通過；`git diff --check` 也通過。focused assertions 覆蓋 no-sandbox 負向檢查、exclusive evidence、cleanup helper、raw-output digest-only、`packagedUiAcceptanceRun=false`、兩個 startup variants、exact-port target selector 與 spawn error 欄位。
- 覆蓋缺口：沒有 deterministic assertion 固定「`childExitSignal` 非 null 時不得 status pass」、「`networkConnectionsAttempted` 必須與 loopback control-plane 語意分離」、「`pageUrlLocal`／home dashboard／有效 CDP result 是 pass 必要條件」，也沒有 current test 對本次三份 evidence 的檔名、status、`SIGTRAP`／CDP timeout 與 immutable hash 建立自動 guard。這些缺口不改變本次既有 evidence 的 fail 結果，但使 runner 未來回歸時仍可能產生過寬 success contract。

## 6. 實際運行結果

- 判定：部分通過
- 證據：`2026-10-28-fr-021-chromium-nested-profile-composition-canary1.json` 為 `pass`，四個 synthetic cases 均符合預期；它只執行 `/usr/bin/true`，且 `chromiumNetworkServiceShapeIsExactGeneratedProfile=false`，因此只能支持 synthetic profile-composition boundary。指定 `2026-10-28-fr-021-electron-single-process-startup-probe2.json` 為 `fail`：無 local page、無 CDP response、`DEVTOOLS_PAGE_TIMEOUT`、child `SIGTRAP`。指定 `2026-10-28-fr-021-electron-no-zygote-startup-probe1.json` 為 `fail`：local page／local URL 有，但 `Runtime.evaluate` 為 `DEVTOOLS_RUNTIME_EVALUATE_TIMEOUT`，child `SIGTRAP`，diagnostics 含 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`OS_PERMISSION_DENIED`、`ELECTRON_EARLY_EXIT`。
- cleanup／scope 結果：兩份 packaged probe 的 `processGroupClosedConfirmed=true`、`processGroupAbsentAfterCleanup=true`、`temporaryRootRemoved=true`、`rawChildOutputPersisted=false`；均為 `systemNetworkDisabled=false`、未下載模型、未啟動／停止既有 Ollama、未跑 UI flow、未進行 packaged UI acceptance。這些結果支持 bounded startup diagnosis，不支持 renderer-ready、Ollama flow、offline UI pass、全機 egress 或 FR-021 完整驗收。
- 本審查依使用者限制未重跑 live acceptance、Ollama、模型或 Electron replay；實際執行僅限 syntax／JSON／hash／source-contract／工作樹唯讀檢查，故不對新 runtime 結果作額外宣稱。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：本輪 bounded diagnostic 的 scope boundary、synthetic-vs-packaged distinction、no-sandbox exclusion、exclusive evidence、raw-output digest-only、cleanup evidence，以及 no-zygote 的 CDP timeout／SIGTRAP capture 均可成立；但 probe `status` 尚未把 child signal／有效 local page／有效 CDP result 納入完整 success gate，`networkConnectionsAttempted=false` 與實際 loopback control-plane 操作有語意不一致，且 00／06／07／08 使用較新 probe3／probe2 檔名而非本次指定 probe2／probe1。主要代理應在後續修正或明確記錄這些 contract／文件關聯後再結案；無論如何，本輪不得宣稱 packaged UI offline pass、全機斷網、Windows 或 FR-021 完整驗收。
- 可逐字引用的完整結論句：**本輪 FR-021 Chromium nested sandbox process-composition next-stage diagnostic round1 有條件通過：synthetic canary、bounded `--single-process`／`--no-zygote` evidence、cleanup／exclusive evidence／raw-output exclusion、no-sandbox 邊界與 no-zygote 的 CDP timeout／SIGTRAP capture 均已核對，且沒有把 synthetic canary 或 local page 當成 packaged UI pass；但 probe success gate 尚未要求 child signal／有效 CDP result，`networkConnectionsAttempted=false` 與實際 loopback control-plane 操作語意不一致，文件目前引用的 probe3／probe2 也與本次指定 probe2／probe1 不完全一致，因此本輪僅限 bounded diagnostic scope，不得宣稱 packaged UI offline pass、全機斷網、Windows 或 FR-021 完整驗收。**

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、唯讀指令與驗證；未重跑 live acceptance、Ollama、模型或 Electron replay，未修改任何其他專案檔案，未修改既有 evidence／reviews。
若上述聲明不實，本報告無效。
