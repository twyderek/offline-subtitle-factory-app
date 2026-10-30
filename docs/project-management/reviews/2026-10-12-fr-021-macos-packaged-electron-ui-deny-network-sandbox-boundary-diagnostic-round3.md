# 獨立審查報告：FR-021 macOS packaged Electron UI deny-network sandbox 邊界診斷

- 審查對象 commit／版本：審查工作樹 HEAD `299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`；本輪目標四份文件為未提交的工作樹差異。追溯的 v0.51.0 source tag `v0.51.0` 解析至 `53956ccdee6e16e4c0413f09312a419613b27da6`。此欄區分審查時工作樹與文件所述候選 source commit。
- 對應 08-CHANGE-LOG 條目：2026-10-01 — FR-021 macOS packaged Electron UI deny-network sandbox 邊界診斷
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-10-12 06:45 UTC 起；由本輪需求直接建立獨立審查脈絡，未沿用主要代理對本次文件更新的評價。唯讀核對工作紀錄、指定四份文件、replay11 evidence、round1／round2 原件、治理規則及官方 Electron／Chromium source。未執行 packaged app、canary、Ollama、socket／network probes 或 OS 網路設定操作。

## 1. 需求完整性
- 判定：部分通過
- 證據：最新工作項明列狀態「進行中」、診斷結果、來源版本鏈及待處理的 round3／文件驗證（`docs/project-management/08-CHANGE-LOG.md:3-27`）。四份文件均保留範圍界線：目前只更新 source／candidate 版本關聯；exact generated profile、candidate 內 Chromium framework hash 及獲授權 egress control 下的 packaged UI 驗收仍缺（`docs/project-management/00-CURRENT-STATUS.md:12-15`；`06-TEST-AND-PROCESS-AUDIT.md:23-26`；`07-DEBUG-AND-FIX-HISTORY.md:6-8`；`08-CHANGE-LOG.md:17-24`）。

  版本鏈查核結果：replay11 原件記錄 candidate `bundleVersion: 0.51.0` 及 executable SHA-256 `e872f406bfb64ced064cdf8efaf0ae329e0db82e3ac0d92a4b192da3963f80ec`（`evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay11.json:11-16`）。本輪 `git rev-parse 'v0.51.0^{commit}'`（2026-10-12 約 06:50 UTC）輸出 `53956ccdee6e16e4c0413f09312a419613b27da6`；`git show 53956ccdee6e16e4c0413f09312a419613b27da6:package-lock.json | node -e ...` 解析輸出 `node_modules/electron: 43.3.0`。Electron 官方 v43.3.0 release 列出 Chromium `150.0.7871.212`（[Electron v43.3.0 release](https://releases.electronjs.org/release/v43.3.0)）。Chromium 官方 Gitiles tag JSON 在本輪解析為 commit `69bf1c67cb894365d151bd020bb0171fd583633a`；對該 commit 的 `sandbox/policy/mac/network.sb` 計算 Git blob SHA-1 得 `58477d8d17902258b3f361d72751a32c034e0645`，tag 路徑也算得相同 blob。官方檔案第 57–67 行含 `(allow network-outbound ...)`、`(remote tcp)`、`(remote udp)`（[Chromium pinned network.sb](https://chromium.googlesource.com/chromium/src/+/69bf1c67cb894365d151bd020bb0171fd583633a/sandbox/policy/mac/network.sb)）。

  強度限制：候選 executable SHA 與 source commit 的關聯由 `06-TEST-AND-PROCESS-AUDIT.md:23` 所記 2026-09-30 稽核關聯及版本 tag／candidate identity 支持；replay11 JSON 本身沒有 source commit 欄位或可驗簽的 build provenance。因此支持「稽核所記 v0.51.0 candidate 關聯」，不單憑 replay11 證明該 SHA 必然由 commit `53956cc...` 建置。文件使用「關聯」且保留 framework hash 缺口，沒有把它寫成可驗證的二進位建置證明。

## 2. 邏輯正確性
- 判定：通過（限 source version／policy fragment 對齊）
- 證據：lockfile → Electron release → Chromium version → 固定 Chromium tag／commit → `network.sb` blob 的版本鏈在本輪唯讀查核一致；blob 實際包含 remote TCP／UDP allowance（上節官方來源與本輪指令輸出；`06-TEST-AND-PROCESS-AUDIT.md:23`、`07-DEBUG-AND-FIX-HISTORY.md:6,8`）。`00-CURRENT-STATUS.md:12,15`、`06-TEST-AND-PROCESS-AUDIT.md:23`、`07-DEBUG-AND-FIX-HISTORY.md:6` 仍明確稱 replay3 為 synthetic network-service/profile shape，並指出它不是 Chromium exact generated profile，不能由此認定 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` 的唯一根因。此推論邊界與目前證據相符。

## 3. 邊界情況
- 判定：部分通過
- 證據：replay11 evidence 保存失敗 stage `electron_start`、`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`SIGTRAP`、dashboard 未載入，以及 cleanup 狀態（`evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay11.json:19-32,39-47,87-115`）。報告及工作紀錄保留 exact generated profile、候選內 framework hash、相同 packaged candidate 重播與完整 UI egress acceptance 的缺口（`00-CURRENT-STATUS.md:12-15`；`06-TEST-AND-PROCESS-AUDIT.md:23,26`；round2 `reviews/2026-10-01-fr-021-macos-packaged-electron-ui-deny-network-sandbox-boundary-diagnostic-round2.md:34-36`）。因此 synthetic policy composition 只覆蓋所測 profile shape；不能代表 Chromium 實際產生的完整 profile 或 UI 網路邊界。

## 4. 程式碼品質
- 判定：通過（限本輪文件差異）
- 證據：本輪範圍是 `00-CURRENT-STATUS.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、`08-CHANGE-LOG.md` 的文件更新；未將工作樹中其他既有 dirty source changes 納入本輪程式碼品質判定。四份文件對版本鏈、synthetic 限制、授權缺口及未結案狀態的敘述一致（`00:12-15`；`06:23-26`；`07:6-8`；`08:17-27`）。本輪 `git diff --check` 於 2026-10-12 約 06:49–06:50 UTC exit 0。round1／round2 報告與 replay11 evidence 均存在；本輪檢查前後 `shasum -a 256` 相同，三者 digest 分別為 `38dcfc9e...a35def7`、`9b9c48c8...f6b69d05`、`99eea0f8...51fa3f7`（指令：`shasum -a 256 <三個指定檔案>`；2026-10-12 約 06:49–06:50 UTC）。原件未被覆寫。

## 5. 測試覆蓋
- 判定：部分通過
- 證據：本輪實際執行 `npm run docs:check`，2026-10-12 約 06:50 UTC exit 0，輸出「專案治理文件檢查通過：19 個文件，版本 0.51.0」；`git diff --check` exit 0；另執行上述 commit lockfile JSON 解析、Chromium tag／blob 查核及指定 evidence／報告 hash 核對。這些是本輪實際執行的唯讀檢查。沒有執行 `npm test`、`npm run check`、`npm run docs:check:final`、canary 或 packaged app；本輪結果不宣稱上述測試通過。round2 原件所列歷史完整 check 與 canary 執行紀錄仍只是保存紀錄，並非本輪重跑（round2 `:24-30`）。

## 6. 實際運行結果
- 判定：部分通過
- 證據：本輪未啟動 app、Ollama，未執行 canary、socket／network probe 或修改 OS 設定。只讀 replay11 原件的執行時間為 `2026-09-30T07:59:53.349Z`–`08:00:00.166Z`；結果是 UI fail、`homeDashboardLoaded=false`、失敗發生於 `electron_start`，而不是 UI acceptance pass（`evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay11.json:3-5,19-21,39-47`）。它記錄外部測試 socket 被拒絕、`systemNetworkDisabled=false`，且 Electron process group、daemon、port、userData、temporary root 清理確認完成（同檔 `:22-32,87-115,117-123`）。工作項也明列沒有獲授權或配置 per-app／OS egress control，packaged UI acceptance 仍待實機驗證（`00-CURRENT-STATUS.md:13-15`；`08-CHANGE-LOG.md:12,18-20,24,26`）。`09-STANDING-AUTHORIZATIONS.md:5-14` 的有效常設授權只涵蓋未簽章／未公證發布風險，不涵蓋 OS egress 設定。

## 綜合判定
- 結論：有條件通過（僅限 v0.51.0 candidate 的靜態 source-version／Chromium policy fragment 關聯補記；不代表 executable build provenance 已獨立驗證、root cause 已確定，或 FR-021 packaged UI offline acceptance 通過）
- 阻擋問題（若有）：FR-021 packaged UI egress acceptance 仍受阻。沒有獲授權及配置的 OS／per-app egress control，也沒有在該控制下以 packaged candidate 實際證明 Chromium sandbox、整棵程序樹外連 fail-closed 與完整 UI 流程。replay11 是失敗證據；synthetic replay3 不是 UI 通過證據。若要把 SHA→source commit 關聯提升為可驗證建置證明，還需可核對該 candidate 的 provenance／manifest；目前 JSON 未保存此欄位。
- 剩餘風險：`network.sb` 是對應 Chromium source 的 policy fragment，不是失敗 candidate 的 exact generated profile；candidate 內 Chromium framework hash 仍缺。replay11 JSON 只記 candidate 版本與 executable SHA，source commit 關聯依賴工作紀錄中的候選稽核紀錄。實際 UI 驗收尚未完成；Windows 暫緩、LM Studio 不驗收的範圍維持原狀。
- 給主要開發代理的具體修正要求（若有）：保持工作項「進行中」，並保留 round1／round2 原件及 replay11 原始 evidence；不要把 source fragment／synthetic profile 結果寫成 root cause 或 UI acceptance 通過。若未來需要主張 exact binary provenance，補上 candidate SHA 到 source commit 的可回溯建置來源；若要完成 UI egress acceptance，先取得涵蓋 per-app／OS egress 控制及 rollback 的明確授權，再另行執行並保存實機證據。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
