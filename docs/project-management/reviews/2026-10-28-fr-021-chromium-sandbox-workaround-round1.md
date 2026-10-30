# FR-021 Chromium nested sandbox startup diagnosis round1

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/08-CHANGE-LOG.md` 最上方工作項目已明確把本輪範圍限定為 current-source macOS arm64 packaged Electron 在 Seatbelt loopback-only boundary 的 bounded startup diagnosis 與 runner robustness hardening，並明確寫出不宣稱 UI offline pass、全機斷網、Windows 或 FR-021 完整驗收。`docs/project-management/00-CURRENT-STATUS.md`、`03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md` 亦保留 nested Chromium blocker 與 scope 限制。部分通過的條件是：本輪工作項目雖可按「診斷／hardening」子範圍結案，但完整 FR-021 驗收需求沒有完成，且 08 條目自身記載完整 `npm run check`、治理 validator、immutable guard 與 final docs gate 需在審查後完成，不能把工作項目狀態解讀為 FR-021 pass。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：`lib/electron-devtools-target.mjs` 已改為以受信任的 `http://127.0.0.1:<port>` page URL 與 exact-port WebSocket 檢查選取 DevTools target，不再依賴 transient title；`scripts/verify-electron-ollama-ui.mjs` 已加入 bounded `waitForHomeDashboard()`，並把 DevTools／renderer／home timeout 與 persistent startup diagnostic category 分開保存；`lib/runner-provenance.mjs` 與 `scripts/test-ollama-ui-offline.mjs` 共同覆蓋去敏 argv、candidate／Framework／review.js hash 與固定 diagnostic token 的 fail-closed contract。部分通過的原因是：workaround evidence 的 argv 仍包含 `--enable-features=NetworkServiceInProcess2` 與 `--disable-gpu-sandbox`，但目前 acceptance source 已撤回這兩個旗標；因此該 evidence 只能作為 bounded diagnostic run，不能被解讀為目前正式 acceptance path 的修正或可接受 workaround。另有 `failureCategory()` 中重複的 `ELECTRON_RENDERER_TIMEOUT` 分支，雖不改變本次 blocker 分類，但應在後續維護中收斂。

## 3. 邊界情況

- 判定：部分通過
- 證據：工作項目與目前狀態文件記錄 `node scripts/test-ollama-ui-offline.mjs`、四支相關 source `node --check` 與 focused UI contract assertions 已通過；`package.json` 的 `check` script 也明確包含 `scripts/verify-electron-ollama-ui.mjs`、`scripts/test-ollama-ui-offline.mjs`、`lib/electron-devtools-target.mjs`、`lib/runner-provenance.mjs` 的 syntax check 及 `npm test`。本審查未執行 live runner、network、Ollama、Electron replay 或模型操作。部分通過的原因是：本輪最上方 08 條目把完整 `npm run check`、治理 validator、immutable replay hash／scope guard 與 `npm run docs:check:final` 記為審查後待執行；在這份 review 建立前，讀到的本輪紀錄不足以把這些 final gate 宣稱為已完成。

## 4. 程式碼品質

- 判定：部分通過
- 證據：`docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-offline-chromium-workaround-replay1.json` 明確記錄 `status=fail`、`failureCode=CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`failureStage=electron_start`、`homeDashboardLoaded=false`，並在 nested `ui.runnerProvenance` 保存固定旗標、`argvRedactionValidated=true`、`argvDroppedCount=0`、candidate／review.js／Framework hash、child-output digest／bytes 與 `rawChildOutputPersisted=false`。既有 immutable current-source replay1 的 SHA-256 `fdd8d2ff0e5b4fceae00d73494985d01b351370ffbad01615acbb47214ddd808` 未被覆寫；其 failure、`systemNetworkDisabled=false`、原始 Unicode candidate argv residual 與 cleanup 結果均保留。兩份 evidence 都記錄 Seatbelt loopback、external `EPERM`、process／port／temporary cleanup 邊界。部分通過的原因是：workaround evidence 在 startup failure 時的 top-level `artifact`、`launch`、`runnerProvenance`、`diagnostics` 為 null，主要 provenance 落在 `ui.runnerProvenance`；這仍足以支持本次 bounded failure claim，但不宜當成完整 packaged acceptance schema 或 UI pass evidence。

## 5. 測試覆蓋

- 判定：通過
- 證據：本輪沒有使用 `--no-sandbox` 或等價的 Electron 全域 sandbox 關閉；evidence 記錄 macOS Seatbelt `deny-network-loopback-only-v1`、`loopbackAllowed=true`、external socket `EPERM`、`electronAppStartedInSandbox=true`、`networkSandboxInheritedByElectronAndServer=true`、`rawChildOutputPersisted=false`，且所有 Electron／driver／daemon／port／temporary cleanup 欄位通過。文件同步明確揭露 `systemNetworkDisabled=false`，沒有把 process-level Seatbelt boundary 說成全機 egress control。`--disable-gpu-sandbox` 僅出現在 bounded diagnostic evidence，且目前正式 acceptance source 已撤回；其削弱 GPU child sandbox 的殘餘風險因此不能被隱藏或升格為產品安全修正。此面向只表示本輪風險與安全邊界有如實揭露，不表示 FR-021 的全機斷網安全要求已完成。

## 6. 實際運行結果

- 判定：部分通過
- 證據：workaround replay1 的實際結果是 packaged Electron 在 `electron_start` 以 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` fail，UI 沒有進入 home／AI flow；同一 evidence 的 loopback／external `EPERM`、preinstalled model／no-download、Electron／driver／daemon／port／temporary cleanup 與 raw-output exclusion 均支持診斷子範圍。既有 immutable current-source replay1 同樣是 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／SIGTRAP，SHA-256 為 `fdd8d2ff0e5b4fceae00d73494985d01b351370ffbad01615acbb47214ddd808`。因此本輪可確認 blocker diagnosis 與 cleanup／provenance evidence，但不能確認 UI offline pass、renderer 可操作、AI flow、cancel／resume、全機斷網或 Windows。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：`CHROMIUM_CHILD_SANDBOX_INIT_FAILED` 仍在 packaged Electron startup 阻擋 renderer／home／AI flow；`systemNetworkDisabled=false`，沒有全機 egress isolation；workaround evidence 的兩個 Chromium flags 不是目前正式 acceptance source 的可接受修正；完整 FR-021、全機斷網、Windows 與 packaged UI offline pass 均未完成。工作項目若要完成治理 closeout，仍須由主要代理在本報告後完成並記錄 `npm run check`、治理 validator、immutable hash／scope guard 與 `npm run docs:check:final`。
- 可逐字引用的完整結論句：**本輪 FR-021 Chromium nested sandbox startup diagnosis round1 有條件通過：bounded macOS arm64 Seatbelt startup diagnosis、loopback／external EPERM 邊界、failure classification、cleanup 與去敏 runner provenance 均有 evidence 支持，且既有 immutable replay1 未被覆寫；但 packaged Electron 仍因 CHROMIUM_CHILD_SANDBOX_INIT_FAILED 未進入 home／AI flow，workaround flags 僅屬診斷 evidence，systemNetworkDisabled=false，故本輪不得宣稱 packaged UI offline pass、全機斷網、Windows 或 FR-021 完整驗收。**

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
