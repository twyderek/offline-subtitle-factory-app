# 獨立審查報告：FR-021 canary explicit evidence path guard（BUG-038）

- 審查對象 commit／版本：工作樹版本 0.51.0；本輪審查範圍為 `BUG-038` 變更，工作樹原有 dirty changes 不納入本輪修改。
- 對應 08-CHANGE-LOG 條目：2026-10-14 — FR-021 canary explicit evidence path guard（`docs/project-management/08-CHANGE-LOG.md:3-20`）。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-14 UTC；獨立唯讀審查上下文，先讀 `AGENTS.md`，再執行 `npm run project:preflight -- --type=debug`，依 preflight 讀取固定核心、debug 路由、相關 evidence 與 round1／round6 審查原件。
- 審查限制：未執行明確路徑 canary replay；未啟動 packaged Electron、Ollama、network probe 或 OS network policy；未使用 `--no-sandbox`。唯一允許寫入為本報告。

## 1. 需求完整性

- 判定：通過。
- 證據：
  - `08-CHANGE-LOG.md:3-20` 將本輪成功條件限定為：無輸出路徑時在任何 sandbox／case／evidence write 前 fail-closed；明確新 `.json` 路徑維持四案、`status=pass`、pinned source、exclusive-create；不擴張 packaged UI、binary provenance、exact profile 或 OS-level egress control。
  - `scripts/accept-macos-seatbelt-nested-profile-canary.mjs:12-18` 在任何 `spawnSync` 呼叫、Seatbelt case 建立及 evidence write 前檢查缺少參數，輸出清楚錯誤並 `exit 2`。
  - `00-CURRENT-STATUS.md:14-17`、`06-TEST-AND-PROCESS-AUDIT.md:29-31`、`07-DEBUG-AND-FIX-HISTORY.md:11-16` 均保留既有 replay evidence、pinned source contract 及 synthetic-only 限制；沒有把本輪修正寫成 packaged UI acceptance。

## 2. 邏輯正確性

- 判定：通過。
- 證據：
  - `scripts/accept-macos-seatbelt-nested-profile-canary.mjs:15-18` 是輸入邊界的最早副作用前停止點；`runNestedProfile()` 的 `sandbox-exec`／`/usr/bin/true` 呼叫位於 `:36-47`，四個 case 的實際建立位於 `:64-93`，均在 guard 之後。
  - 明確路徑於 `:20` 正規化，` :54-57` 限定在 `docs/project-management/evidence` 且副檔名為 `.json`；四案 pass predicate 位於 `:95-100`，與 replay5 的 exit code `[0,71,71,0]` 及四個 `pass=true` 一致。
  - `:156` 使用 `fs.writeFileSync(..., { flag: 'wx', mode: 0o600 })`，既有 evidence 存在時拒絕覆寫；replay5 靜態 invariant 亦確認 `status=pass`、四案全 pass、source pin、scope flags 與 no-network flags。

## 3. 邊界情況

- 判定：通過。
- 證據：
  - 本輪安全執行無參數命令的實際結果為 exit 2，stderr 為 `Evidence output path is required; pass a new .json path inside docs/project-management/evidence.`；同一檢查前後 evidence directory 的新增檔案數為 0，證明無參數路徑未先執行 canary 或寫入 evidence。
  - replay5 `:41-97` 保留四案結果：strict／strict 成功、受限 parent 拒絕 network-service shape、僅明示 TCP／UDP 的窄 parent 仍拒絕、`allow default` parent 接受；`replay5:99-105` 的 `systemNetworkDisabled=false`、`systemNetworkConfigurationChanged=false`、`packagedElectronRerun=false`、`uiFlowRun=false` 全部符合限定範圍。
  - replay5 與 replay4 的 stable fields 靜態比較全部相等（schema、profiles、cases、scope、source references、source policy、status）；既有 replay2 仍為原始 `status=fail`，replay3／replay4 仍為 `status=pass`。round1 source-provenance report 與 round6 report 只讀核對，未被本輪寫入。
  - `replay5:108-115` 以 versioned `150.0.7871.212` tag、commit、blob pin 及 `status=pass` 保存 source evidence；`chromiumNetworkServiceShapeIsExactGeneratedProfile=false` 且 interpretation 明確否定 packaged UI／exact profile 推論。

## 4. 程式碼品質

- 判定：通過。
- 證據：
  - script 使用固定絕對執行檔 `/usr/bin/sandbox-exec` 與 `/usr/bin/true`，`spawnSync` 設有 timeout／maxBuffer，`argumentPattern` 與 profiles 明確保存，且不經 shell；` :31-47`、`:120-127`、`:128-134` 可回溯。
  - 輸出路徑同時做 `path.resolve`、目錄前綴與 `.json` 副檔名檢查，最後以 `wx` 實現不可覆寫；錯誤輸出不洩漏個人路徑或 profile 以外的敏感資料。
  - `node --check scripts/accept-macos-seatbelt-nested-profile-canary.mjs` 於本輪通過；`git diff --check` 於本輪通過。無參數 guard 的錯誤訊息直接說明所需輸入與 evidence 目錄。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：
  - 已執行並通過：`npm run project:preflight -- --type=debug`；`node --check scripts/accept-macos-seatbelt-nested-profile-canary.mjs`；無參數 fail-closed 實跑；replay5 JSON parse／invariant；replay4／replay5 stable-field comparison；`npm run docs:check`（輸出「專案治理文件檢查通過：19 個文件，版本 0.51.0」）；`git diff --check`。
  - replay5 invariant 實際確認：schema 正確、`status=pass`、四案全 pass、exit code `[0,71,71,0]`、pinned tag／source policy、scope flags、no-network flags，以及 source 的 `flag: 'wx'`。
  - 依使用者限制，本輪沒有重跑明確 evidence path canary；因此 replay5 的 process exit 0 是由本輪讀取的 immutable evidence／工作紀錄支持，不冒稱為本審查重新取得的 subprocess exit。亦未執行完整 `npm run check` 或 `npm run docs:check:final`。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：
  - 本輪實際運行的無參數命令在 2026-10-14T04:10:32Z 前後完成，exit 2，訊息清楚且 evidence 新增 0 檔；這直接驗證 BUG-038 的 fail-closed 輸入邊界。
  - 本輪實際 `node --check`、JSON invariant、stable-field comparison、`npm run docs:check` 與 `git diff --check` 均成功；沒有啟動 `sandbox-exec`、`/usr/bin/true` 的 explicit replay、packaged Electron、Ollama、network probe 或 OS policy。
  - replay5 evidence `:3-4` 記錄保存時段 `2026-10-14T04:08:59.280Z`–`04:08:59.333Z`，` :41-97` 四案全 pass，`:99-115` 保存 scope、pinned source 與 `status=pass`。此為既有開發驗證結果的只讀核驗，不是本輪重新執行 replay。
  - `round1` source-provenance report `:38-43` 已將無參數預設 replay2 風險列為非阻擋維運問題；round6 report `:41-47` 保留 packaged UI、binary provenance、exact profile 與 OS-level egress control 未驗證的限制。本輪 guard 修正直接處理該維運問題，沒有改寫上述歷史判定。

## 綜合判定

- 判定：部分通過。
- 證據：BUG-038 的輸入 guard、四案 evidence contract、exclusive-create、既有 evidence／報告保留與範圍限制均有可回溯 source／JSON／實跑證據；本輪未重跑明確 path replay，且 final gate 仍待主要代理依治理流程執行，因此採有條件通過而非無條件通過。
- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪獨立審查結論為有條件通過：BUG-038 的 explicit evidence path guard 已在任何 `sandbox-exec`、`/usr/bin/true`、case 執行與 evidence write 前以清楚訊息 exit 2，replay5 的四案／pinned source／scope flags／exclusive-create 與既有 replay 邊界可追溯，且既有 replay2／replay3／replay4、round1 與 round6 未被本輪覆寫；但本輪未重跑明確路徑 canary，且此結論不代表 packaged UI offline acceptance、binary provenance、exact profile 或 OS-level egress control 已完成。**
- 阻擋問題（若有）：沒有發現本輪 BUG-038 程式邏輯阻擋；主要代理仍須整合本報告並依治理流程執行 `npm run docs:check:final`。這是文件收尾條件，不是對 packaged UI 或 OS-level egress control 的授權。
- 剩餘風險：FR-021 packaged UI offline acceptance、replay-time binary provenance、Chromium exact generated profile、唯一 root cause 與 OS-level／per-app egress control 仍未驗證；本輪亦未執行完整 `npm run check` 或明確 path replay。
- 給主要開發代理的具體修正要求（若有）：保留本報告、replay2／replay3／replay4／replay5 與 round1／round6 原件；整合本報告逐字結論後執行 final gate。不得把本輪結果改寫為 packaged UI acceptance、binary provenance、exact profile 或 OS-level egress control 完成。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
