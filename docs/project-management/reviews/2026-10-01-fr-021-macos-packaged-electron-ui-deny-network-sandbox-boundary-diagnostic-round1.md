# 獨立審查報告：FR-021 macOS packaged Electron UI deny-network sandbox 邊界診斷

- 審查對象 commit／版本：preflight 記錄版本 0.51.0、分支 `codex/0.51-anthropic-claude`；本輪允許閱讀的資料未記錄目前 HEAD。既有 packaged replay11 executable SHA-256 為 `e872f406bfb64ced064cdf8efaf0ae329e0db82e3ac0d92a4b192da3963f80ec`，nested-profile canary 所列 candidate executable SHA-256 為 `75e6c676265dfbc6c980458f56435505dae532eec05dc9f04a7acd29326454ac`。
- 對應 08-CHANGE-LOG 條目：2026-10-01 — FR-021 macOS packaged Electron UI deny-network sandbox 邊界診斷
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-01 09:01:40 UTC；本輪以獨立上下文啟動，未沿用主要開發代理對話記憶。依使用者指定只讀 preflight 路由文件及列明的工作紀錄、稽核、歷史、evidence 與兩支 runner／test source；未執行 tests、未啟動 app／UI、未操作 OS 網路設定、Ollama 或模型。

## 1. 需求完整性
- 判定：部分通過
- 證據：最新工作條目界定了保留 Chromium sandbox、deny-network、不得改 OS 網路設定的成功條件及無合規路徑時的停止方式（`docs/project-management/08-CHANGE-LOG.md:11-16`）；同時明確記錄本輪沒有找到 task-local 解法、不宣稱 UI 通過，並將 OS-level per-app egress control 與 rollback 留待另行授權（同檔 `:17-22`）。但條目仍是「進行中」，`git diff --check`、final gate 與獨立審查原先列為待完成（`:5,19,21`）；其計畫要求核對 Apple 一手文件，而 canary 只列 Electron release 與 Chromium source 參考，沒有 Apple 文件（canary `:58-60`）。因此目前證據足以支持有限範圍的可行性診斷，不足以完成 FR-021 packaged UI offline 驗收或證明一般受支援的替代方案已被窮盡。

## 2. 邏輯正確性
- 判定：部分通過
- 證據：canary 三案結果彼此一致：同等受限父／子 profile exit 0；受限父拒絕要求 remote TCP／UDP 的子 profile，exit 71；父層允許後 exit 0（`docs/project-management/evidence/2026-10-01-macos-seatbelt-nested-profile-canary.json:26-47`）。報告也正確限定這只是合成 profile composition conflict，使用 `/usr/bin/true`，不是 Chromium 生成的 exact profile，不能單獨證明 packaged app 唯一根因或 UI acceptance（同檔 `:19-24,57`；`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:5-8`）。因此「與既有失敗一致」有證據支持；「已確定 Electron 啟動失敗根因」則沒有。

## 3. 邊界情況
- 判定：部分通過
- 證據：已保存的 canary 覆蓋受限／受限、受限父／要求 remote TCP／UDP 子 profile、以及父層允許該子 profile 三種組合，並記錄沒有網路連線或外部 socket 嘗試、沒有更改系統網路或重跑 packaged app（evidence `:19-24,26-47,49-56`）。既有 replay11 則記錄 loopback allowed、外部 socket 被 `EPERM` 拒絕、Electron 在 `electron_start` 以 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`SIGTRAP` 結束且 UI 未載入（`docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay11.json:19-32,39-46,94-101`）。缺少 Chromium 實際產生的子 profile／同一 packaged candidate 重現；canary 所列 candidate hash 也與 replay11 hash 不同，故不能把三案矩陣當成該 Electron candidate 的直接重現。

## 4. 程式碼品質
- 判定：部分通過
- 證據：offline wrapper 以 Seatbelt 明確 deny inbound／outbound／bind，只允許 localhost，並要求 sandbox probe 成功證明 loopback 可用且外部測試位址回 `EPERM`（`scripts/verify-electron-ollama-ui-offline.mjs:11-13,181-194`）；Ollama 與 packaged UI driver／target 的啟動及清理有明確階段與 failure code（同檔 `:233-317,433-515`）。focused test 對 deny 規則、無 `--no-sandbox`、隔離 process tree 與 cleanup 有 source-contract assertions（`scripts/test-ollama-ui-offline.mjs:132-176`）。但這些 assertions 不檢驗 canary 的 Seatbelt profile composition，也沒有在本次允許閱讀的兩支檔案中提供可重播 canary 的完整 profile／命令；diagnostic evidence 的可重現性因此有限。

## 5. 測試覆蓋
- 判定：部分通過
- 證據：主要代理保存的結果記錄 `node scripts/test-ollama-ui-offline.mjs` exit 0（包含 missing-model integration、三案 bundle preflight 與 packaged UI contract）及完整 `npm run check` exit 0（含全套 `npm test`）；來源為 `docs/project-management/08-CHANGE-LOG.md:19`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:20-23`。這些是讀取主要代理保存的執行結果，不是本審查的獨立重跑；所列來源沒有附 focused test／check 的命令執行時間戳或原始 transcript。canary 時間戳與三案結果取自主要代理保存的 evidence JSON（2026-10-01T08:37:20.452Z 至 08:37:20.493Z，`:3-4,26-47`），本審查沒有重跑 canary。本審查依使用者限制未執行任何 test；`scripts/test-ollama-ui-offline.mjs:114-129,315-369` 顯示符合環境條件時會進行本機 Ollama integration／wrapper subprocess，因此跳過重跑也避免可能啟動 Ollama。覆蓋缺口是：canary 沒有成為可重播的 regression，focused tests 主要檢查 runner contract，不能驗證實際 Chromium nested-profile 啟動。

## 6. 實際運行結果
- 判定：部分通過
- 證據：讀取主要代理保存的 replay11 evidence 顯示 packaged UI 實機執行失敗於 Electron 啟動，renderer／dashboard 未載入，沒有 UI job（`docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay11.json:3-5,19-21,39-47`）；主要代理保存的 canary evidence 記錄命令只執行 `/usr/bin/true`，沒有連線，且 `packagedElectronRerun=false`、`uiFlowRun=false`、`systemNetworkDisabled=false`（`docs/project-management/evidence/2026-10-01-macos-seatbelt-nested-profile-canary.json:19-24,49-57`）。這兩份均是本審查讀取的歷史 evidence，不是本審查重跑。主要代理在工作條目記錄 focused test 與完整 check 通過，但也明確記錄未重跑 app，這些通過結果不是 packaged UI acceptance（`docs/project-management/08-CHANGE-LOG.md:19`；`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:20-24`）。故診斷 canary 有實際保存結果，FR-021 packaged UI offline 流程仍未通過。

## 綜合判定
- 結論：有條件通過（僅限「目前限制內未找到 task-local 路徑」的邊界診斷；不代表 FR-021 packaged UI offline acceptance 通過）
- 阻擋問題（若有）：同一 packaged Electron UI 在 deny-network 下仍有 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`，且沒有保留 Chromium sandbox、維持 process-tree 外連 fail-closed、又能完成 UI 流程的已驗證方案。canary 與 replay11 的 profile／candidate 關聯不足以確定唯一根因；目前也沒有 packaged UI 成功證據。因此 FR-021 offline UI 驗收仍被阻擋，工作項目不應據此結案為 FR-021 完成。
- 剩餘風險：canary 為 `/usr/bin/true` 加合成 profile，未使用 Chromium exact generated profile；evidence 未保存完整 profile text／可直接重播命令；canary candidate SHA 與 replay11 candidate SHA 不同。主要代理記錄的 tests/check 沒有時間戳或原始執行輸出，本審查未重跑。`systemNetworkDisabled=false`，不代表全機斷網。任何 OS-level per-app egress control 的支援性、範圍與 rollback 尚未由本輪允許資料證明。
- 給主要開發代理的具體修正要求（若有）：保留本工作項目「進行中」及上述根因限制，不要把 canary 或 contract tests 摘要成 UI／FR-021 通過。若要主張根因或完成 packaged UI acceptance，下一階段需保存可重播的 exact profile／命令及與目標 candidate 的關聯，引用 Apple／Electron 一手支援資料，並在明確核准的 egress 控制下實際驗證 packaged UI、Chromium sandbox 與整棵程序樹外連拒絕；同時記錄控制失敗時的 rollback。若沒有滿足這些條件的授權方案，應明確將 UI acceptance 留作阻擋項。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
