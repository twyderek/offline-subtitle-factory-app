# FR-021 Chromium nested sandbox process-composition next-stage diagnostic round2

## 1. 需求完整性

- 判定：通過（限本輪 bounded diagnostic scope）
- 證據：round1 指出的 success gate、loopback network 語意、例外 cleanup 與較早／最新 evidence 關聯，均已在目前 source／evidence／文件中有對應修正。`00-CURRENT-STATUS.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md` 與 `08-CHANGE-LOG.md` 現以 probe4／probe3 標示最新結果，並保留較早 probe 原件；08 另明確記錄 round1 finding、修正與 supersession 關係。
- scope boundary 完整：本輪只驗證 macOS arm64、outer loopback-only Seatbelt、bounded startup probe、process／temporary cleanup、evidence provenance 與 synthetic profile composition。文件與最新 evidence 均沒有把 canary、local page 或 startup probe 當成 packaged UI acceptance；`systemNetworkDisabled=false`、全機 egress、Windows 與 FR-021 完整驗收仍明確未完成。

## 2. 邏輯正確性

- 判定：通過（本輪修正已解除 round1 的 source-level blockers）
- 證據：`scripts/probe-electron-single-process.mjs:216-225` 在 cleanup 前保存 `preCleanupExitCode`／`preCleanupExitSignal`，以 `childExitedBeforeCleanup` 表示 child 是否已提前退出；`scripts/probe-electron-single-process.mjs:223-225` 要求 page URL 為 local 且 `cdpResult.href` 為 local；`scripts/probe-electron-single-process.mjs:283-284` 的 pass gate 同時要求 `pageUrlLocal`、`validCdpResult`、`!childExitedBeforeCleanup`、無 spawn error、cleanup confirmed 與 temporary root removed。這已避免「先有 page／CDP、後 SIGTRAP 仍 pass」的 round1 風險。
- network 語意已修正：`invocation.networkConnectionsAttempted=true`、`loopbackConnectionsAttempted=true`、`externalSocketAttempted=false`，與 probe 實際使用 loopback HTTP／WebSocket DevTools control-plane 一致；`systemNetworkDisabled=false` 仍正確表示沒有全機斷網。
- no-zygote／single-process 變體均仍只作 diagnostics，不進入 formal acceptance；source 沒有 `--no-sandbox`、`ELECTRON_DISABLE_SANDBOX` 或等價 sandbox 關閉方式，也沒有放寬 outer Seatbelt policy。

## 3. 邊界情況

- 判定：通過（保留 bounded runner 的一般性限制）
- 證據：outer `try/finally` 自 `scripts/probe-electron-single-process.mjs:177-300` 覆蓋 temp／child 啟動後的 probe、cleanup 與 unexpected exception path；若 cleanup 未確認，finally 會再次嘗試 process-group cleanup，且會再次移除 temporary root。正常最新 evidence probe4／probe3 均記錄 `processGroupAbsentAfterCleanup=true`、`processGroupClosedConfirmed=true`、`temporaryRootRemoved=true`，故可接受作為本輪 cleanup 證據。
- evidence isolation 仍可信：`flag: 'wx'` 防止覆寫，path 限於 evidence directory，child output 只保存 SHA-256／byte count，`rawChildOutputPersisted=false`；最新 probe evidence 的 mode 為 owner-only，沒有保存 raw stderr、userData 路徑或 secret-shaped environment。
- 保留限制：finally 的第二次 cleanup 若仍失敗，既有 evidence 會保留第一次失敗狀態而不再更新，這是保守且可接受的 fail-closed 行為；本輪沒有要求把 exception path 另做 live fault injection。canary 仍只執行 `/usr/bin/true`，`chromiumNetworkServiceShapeIsExactGeneratedProfile=false`，因此不能外推為 Chromium exact profile 或 UI root cause。

## 4. 程式碼品質

- 判定：通過（本輪 scope）
- 證據：變體輸入仍以白名單限制為 `single-process`／`no-zygote`；DevTools target 使用 shared exact-port loopback guard；spawn error、pre-cleanup exit、CDP validity、cleanup 與 raw-output exclusion 均以明確欄位保存。package `check` 已包含 probe 的 `node --check`，focused test 已增加 `childExitedBeforeCleanup`、`validCdpResult`、outer `finally` 與 loopback network contract assertion。
- `scripts/test-ollama-ui-offline.mjs` 的 deterministic assertions 對正式 acceptance runner 仍保留 no-sandbox 負向檢查，且沒有把 startup probe 的 variants 加入 formal acceptance argv。這使本輪診斷旗標與產品驗收路徑保持分離。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：目前工作紀錄記載 focused contract、source syntax、immutable old-evidence hash／scope guard、latest probe scope／process-leak guard、完整 `npm run check` 均 exit 0；package wiring 也明確讓 `check` syntax-check probe，`test` 執行 focused offline UI contract。source-level assertions 已補上 round1 三項 findings 的回歸門檻。
- 條件：本複審依使用者限制沒有重跑 `npm run check`、live acceptance、Ollama、模型或 Electron replay；上述完整 check 結果是讀取目前 08／06 的既有執行紀錄，不冒稱由本審查代理重新取得。因而本報告確認的是修正與既有結果一致，並非新的 runtime replay 證據。
- 覆蓋仍不包括真正 packaged UI／AI flow、全機網路封鎖、Windows 或 exact Chromium generated child profile；這些缺口是本輪明確 scope boundary，不是被修正成 pass 的項目。

## 6. 實際運行結果

- 判定：通過（bounded diagnostic 結果）；完整 FR-021：不適用／未完成
- 證據：最新 `2026-10-28-fr-021-electron-single-process-startup-probe4.json` status 為 `fail`，`localPagePublished=false`、`pageUrlLocal=false`、`cdpResponseReceived=false`、`validCdpResult=false`、`waitError=DEVTOOLS_PAGE_TIMEOUT`、`childExitSignal=SIGTRAP`、`childExitedBeforeCleanup=true`，cleanup confirmed 且 temporary root removed。最新 `2026-10-28-fr-021-electron-no-zygote-startup-probe3.json` 亦 status 為 `fail`，無 local page／CDP、`childExitSignal=SIGTRAP`、`childExitedBeforeCleanup=true`，並分類 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`OS_PERMISSION_DENIED`／`ELECTRON_EARLY_EXIT`；兩份均記錄 loopback control-plane connection、external socket 未嘗試、未啟動 Ollama／模型、未跑 UI flow。
- synthetic canary `2026-10-28-fr-021-chromium-nested-profile-composition-canary1.json` 仍是 synthetic profile-composition `pass`，只執行 `/usr/bin/true`；文件、source 與 evidence 均沒有把它升格為 packaged UI pass。較早 probe evidence 保留，並由最新文件標為較早／latest 關係，未覆寫原件。
- `08-CHANGE-LOG.md` 記載完整 `npm run check` exit 0；目前工作條目仍待 round2 review 與 final docs gate，故不能把該既有 check 結果誤稱為本審查重新執行，也不能以它解除 packaged Chromium blocker。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：round1 指出的三項程式與證據契約問題已由目前 source、focused assertions、最新 probe4／probe3 evidence 與 00／06／07／08 文件同步解除；bounded diagnostic closeout 在主要代理將本報告整合進 08 並完成 `npm run docs:check:final` 後可接受。剩餘的 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`SIGTRAP` 是 packaged renderer blocker，不是本輪 runner 修正未完成的誤報，也不應以 local page、synthetic canary 或 deterministic check 取代真正 UI acceptance。
- 可逐字引用的完整結論句：**本輪 FR-021 Chromium nested sandbox process-composition next-stage diagnostic round2 獨立複審有條件通過：round1 指出的 child 提前退出／CDP validity success gate、loopback control-plane network 語意、outer exception cleanup 與較早／最新 probe evidence 關聯均已修正並由 source、最新 probe4／probe3 evidence、focused assertions 與文件同步支持；最新兩個 startup probe 仍 fail／無可操作 renderer／SIGTRAP，synthetic canary 仍只執行 `/usr/bin/true`，因此本輪僅可接受 bounded diagnostic closeout，絕不得宣稱 packaged UI offline pass、全機斷網、Windows 或 FR-021 完整驗收。**

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
