# 獨立審查報告：FR-021 macOS packaged Electron UI deny-network sandbox 邊界診斷

- 審查對象 commit／版本：preflight 記錄版本 0.51.0、分支 `codex/0.51-anthropic-claude`；本次指定資料未記錄目前 HEAD。既有 packaged replay11 的 executable SHA-256 為 `e872f406bfb64ced064cdf8efaf0ae329e0db82e3ac0d92a4b192da3963f80ec`。Replay3 明確標示未執行 packaged candidate，candidate SHA 為 null。
- 對應 08-CHANGE-LOG 條目：2026-10-01 — FR-021 macOS packaged Electron UI deny-network sandbox 邊界診斷
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-10-01 09:18:17 UTC；本輪依 round1 報告列出的修正條件，直接核對最新工作紀錄、程式、evidence 與官方來源；round1 報告僅作為待核對條件，不採用主要代理的評價性摘要。未執行 tests 或 canary、未啟動 packaged app／UI，未更改 OS 網路設定，也未操作 Ollama 或模型。

## 1. 需求完整性
- 判定：部分通過
- 證據：round1 要求保留工作進行中且不宣稱 UI／FR-021 acceptance pass，並要求未來若主張根因或 UI acceptance，須有可重播 profile／argv、candidate 關聯、一手來源及獲授權 egress control 下的 packaged UI 實測（round1 `:32-36`）。最新條目仍為「進行中」，明確限制結論為 synthetic diagnosis，保留 candidate identity 與 UI acceptance 缺口，並說明任何 OS-level egress control 尚待另行授權（`docs/project-management/08-CHANGE-LOG.md:5,17-24`；`docs/project-management/00-CURRENT-STATUS.md:11-14`）。bounded synthetic diagnosis 的重播與來源補強已完成；FR-021 packaged UI offline 驗收仍未完成，文件沒有把兩者混為一談。

## 2. 邏輯正確性
- 判定：部分通過
- 證據：replay3 四案結果與預期一致：strict／strict exit 0；strict parent 拒絕 network-service shape，exit 71／EPERM；加入窄 TCP／UDP 權限後仍 exit 71／EPERM；`allow default` parent 接受 child shape、exit 0（`docs/project-management/evidence/2026-10-01-macos-seatbelt-nested-profile-canary-replay3.json:41-97`）。replay2 對窄 parent 的預期成功與實際 exit 71 不符，結果保持 `status: fail`；最新 replay3 改正該 case 的預期而沒有覆寫原件（replay2 `:69-82,99`；`docs/project-management/08-CHANGE-LOG.md:17,21`）。script 明確將 child policy 說明為受 Chromium network.sb 啟發的 synthetic shape，而非 Chromium exact generated profile（`scripts/accept-macos-seatbelt-nested-profile-canary.mjs:15-18,137`）。

## 3. 邊界情況
- 判定：通過（限 synthetic profile composition）
- 證據：script 保存 strict、network-service shape、窄權限 parent 與 unrestricted parent 的完整 profile 字串，並以 `sandbox-exec -p <parent> sandbox-exec -p <child> /usr/bin/true` 建構 argv（`scripts/accept-macos-seatbelt-nested-profile-canary.mjs:11-18,29-40,57-86`）。replay3 保存四案實際結果、profile 字串及 argv pattern；記錄 `networkApiUsedByHarness=false`、沒有連線嘗試，且 OS 網路設定、既有 Ollama、模型與 packaged UI 均未動（replay3 `:19-39,41-114`）。失敗的 replay2 原件仍保留，沒有以後續 pass 取代（replay2 `:3-4,69-82,84-100`）。這些邊界只驗證合成政策載入，不涵蓋 Chromium 實際 profile 或 app egress。

## 4. 程式碼品質
- 判定：通過（限可重播診斷工具）
- 證據：script 固定 `/usr/bin/true`，直接使用 `spawnSync` 傳入 argv、不經 shell；evidence 路徑受限於 evidence 目錄且以 exclusive-create `wx` 防覆寫（`scripts/accept-macos-seatbelt-nested-profile-canary.mjs:8-18,24-40,47-55,95-155`）。本審查親自執行 `node --check scripts/accept-macos-seatbelt-nested-profile-canary.mjs`，2026-10-01 09:21:22 UTC，exit 0（沒有輸出）。script 與 replay3 足以重建 synthetic profile／argv 組合；replay evidence 明確標示 packaged candidate 未執行、candidate hash 為 null（replay3 `:13-18,34-39`）。

## 5. 測試覆蓋
- 判定：部分通過
- 證據：主要代理保存的記錄顯示，新增 replay script 後約 2026-10-01 09:15 UTC 執行完整 `npm run check` exit 0，範圍為 19 個治理文件、syntax checks 與全套 `npm test`，並包含 Ollama missing-model owned-daemon／port／temp cleanup；同一工作紀錄另列 `node --check`、replay3 JSON parse 與 `git diff --check`（`docs/project-management/08-CHANGE-LOG.md:20`；`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:24`）。這些是本審查讀取的保存執行紀錄，不是本審查重跑；check 時間為約略時間，未附完整 transcript。replay3 的保存執行時間為 2026-10-01T09:12:09.886Z–09:12:09.938Z（evidence `:3-4`），replay2 為 09:10:37.628Z–09:10:37.672Z（evidence `:3-4`），均非本審查重跑。依使用者限制，本審查未執行 tests；完整 check 包含測試且記錄有 Ollama integration，因此沒有嘗試重播。Round1 原先的 focused test 紀錄也只作保存結果引用（`06-TEST-AND-PROCESS-AUDIT.md:24`）。

## 6. 實際運行結果
- 判定：部分通過
- 證據：replay3 保存的實際結果為四案 pass，但執行對象只有巢狀 `sandbox-exec` 與 `/usr/bin/true`，不是 Electron app（`docs/project-management/evidence/2026-10-01-macos-seatbelt-nested-profile-canary-replay3.json:19-32,41-114`）。replay2 的失敗結果保留；舊 replay11 仍記錄 v0.51.0 packaged candidate 在 `electron_start` 以 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`SIGTRAP` 失敗，dashboard 未載入（replay2 `:69-82,99`；`docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay11.json:3-21,39-47,94-101`）。replay3 的 `packagedCandidateExecuted=false`、candidate SHA `null`，因此與 replay11 SHA 未建立關聯；evidence 也明確記錄未重跑 packaged UI、`systemNetworkDisabled=false`（replay3 `:13-18,99-107`）。OS-level egress control 未獲授權或配置，實際 packaged UI egress acceptance 仍缺。

## 綜合判定
- 結論：有條件通過（僅限可重播的 synthetic Seatbelt profile-composition 診斷；不代表 root cause 已確定或 FR-021 packaged UI offline acceptance 通過）
- 阻擋問題（若有）：FR-021 的 packaged UI egress acceptance 仍受阻：沒有與 replay11 同一 candidate 的 packaged UI 重播，也沒有在獲授權 egress control 下證明 Chromium sandbox 保留且整棵 app process tree 外連 fail-closed。不得以 replay3 的 synthetic pass 解除此阻擋。
- 剩餘風險：replay3 的 profile 是依 Chromium network.sb 形成的最小 shape，並非 Electron v43.3.0 所含 Chromium 的 exact generated profile；source reference 使用 Chromium `HEAD`，可變動且未固定到 Electron 對應 Chromium commit。Electron v43.3.0 官方 release 頁將其 Chromium 版本列為 150.0.7871.212；Chromium `network.sb` 頁面可見 network service 的 remote TCP／UDP outbound 與 local TCP／UDP bind／inbound 規則，支持此 synthetic shape 參考，但不證明 app 根因。Apple `NEFilterDataProvider` 文件說明 flow 層級的 pass／block 決策與 Content Filter capability 要求，Xcode 文件說明 Network Extensions capability／entitlement 設定；這些來源沒有證明本 app 已具備或已獲准使用該系統控制。來源：[Electron v43.3.0](https://releases.electronjs.org/release/v43.3.0)、[Chromium network.sb（HEAD）](https://chromium.googlesource.com/chromium/src/+/HEAD/sandbox/policy/mac/network.sb)、[Apple NEFilterDataProvider](https://developer.apple.com/documentation/networkextension/nefilterdataprovider)、[Apple configuring network extensions](https://developer.apple.com/documentation/xcode/configuring-network-extensions)。本輪只讀官方頁面；沒有建立或啟用 filter，也沒有改 OS 網路設定、Ollama 或模型。完整 `npm run check` 的日期／範圍依主要代理保存紀錄核對，未由本審查重跑。
- 給主要開發代理的具體修正要求（若有）：維持工作項目「進行中」，並保留 replay2 fail 原件；不要將 replay3 或完整 check 稱為 packaged UI／FR-021 acceptance pass。若後續要宣稱 Chromium 根因，應以與 replay11 candidate 可核對的 Chromium 版本／profile 證據重現，並將 Chromium source 固定到對應版本或 commit。若要完成 UI egress acceptance，先取得明確的 per-app／OS egress control 與 rollback 授權，再以 packaged candidate 實測外連拒絕、Chromium sandbox、完整 UI 流程及 cleanup；本輪未取得該授權，也未執行這些步驟。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
