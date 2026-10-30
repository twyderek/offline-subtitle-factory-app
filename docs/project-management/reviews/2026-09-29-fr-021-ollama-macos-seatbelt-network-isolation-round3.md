# 獨立審查報告：FR-021 Ollama macOS Seatbelt 網路隔離驗收

- 審查對象 commit／版本：HEAD `299ff5d`、版本 `0.51.0`；FR-021 本輪 source、測試、evidence 與治理文件為未提交工作樹內容。審查前亦有其他工作樹修改，本報告只判斷本輪 FR-021 範圍。
- 對應 08-CHANGE-LOG 條目：2026-09-29 — FR-021 Ollama macOS 作業系統網路隔離驗收（`docs/project-management/08-CHANGE-LOG.md:3-25`）。
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-09-29 07:17:42 UTC；本輪以獨立 round3 上下文開始，依 preflight 路由自行讀取需求、round1／round2 原報告、目前 source／測試／evidence 與文件差異，未沿用主要開發代理的評價性結論。

## 1. 需求完整性
- 判定：通過
- 證據：本次只審查 macOS arm64 Seatbelt-isolated Ollama acceptance subprocess。`FR-021` 原始要求及 2026-09-15 LM Studio 驗收例外見 `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37,44-50`；本輪明列不關閉全機網路、不改防火牆、不驗收 packaged Electron UI／取消續跑／Windows／LM Studio 見 `docs/project-management/08-CHANGE-LOG.md:12-16`。wrapper 固定 macOS 平台檢查及 deny-network／loopback profile，先驗證 loopback 與 RFC5737 socket `EPERM`，再檢查既有 model store 並執行 probe（`scripts/probe-ollama-product-offline.mjs:10-15,78-92,163-181,193-232`）。設計與狀態文件均明確指出不是全機斷網且 FR-021 整體未結案（`docs/project-management/03-FUNCTIONAL-DESIGN.md:103`、`docs/project-management/00-CURRENT-STATUS.md:31-36`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:261-262`）。沒有把單次 1B／3B 結果泛化為模型品質保證。

## 2. 邏輯正確性
- 判定：通過
- 證據：test-only executable override 僅在 `process.env.NODE_ENV === 'test'` 時讀取 `OSF_TEST_ONLY_OLLAMA_SPAWN_COMMAND`；否則 `daemonSpawnCommand` 預設為 `/usr/bin/sandbox-exec`（`scripts/probe-ollama-product-offline.mjs:9-15`）。profile assertion 及 product probe 也直接使用 `sandboxExec`（同檔 `78-85,217`），測試注入不會替代 Seatbelt 前置檢查。managed-child 接收 `spawn`／`error`／`close` 並等待 close（`lib/ai/managed-child-process.mjs:3-21,35-49`）；wrapper 對 spawn error 設定 `SANDBOXED_OLLAMA_SPAWN_FAILED`／`ollama_start`，進入 catch 後仍執行 daemon、port、temp cleanup 與 exclusive evidence write（`scripts/probe-ollama-product-offline.mjs:95-103,193-197,235-272`）。provider source-contract 亦檢查 test-only gate、預設 sandbox command 及 cleanup 契約（`scripts/test-ai-providers.mjs:347-368`）。

## 3. 邊界情況
- 判定：部分通過
- 證據：focused test 先以不存在的 executable 驗證 helper 收到 `ENOENT`、`started=false` 及 close（`scripts/test-ollama-offline-process.mjs:9-18`），再以不存在的 daemon command 啟動完整 wrapper subprocess；整合分支斷言 evidence `failureCode=SANDBOXED_OLLAMA_SPAWN_FAILED`、`failureStage=ollama_start`、`status=fail`、子程序 exit 1、daemon 未啟動及三項 cleanup 均為 true（同檔 `25-60`）。原始 `ENOENT` 在 helper 層斷言；wrapper evidence 使用固定化 failure code，未把底層錯誤字串寫入 evidence。其他平台或 Seatbelt／Ollama executable／model store 不存在時，只略過 wrapper 整合分支並保留 helper 測試（同檔 `27,61-63`）；本次輸出沒有 skip 訊息，故此環境實際走過整合分支。其他平台的 skip 分支及真實 `EACCES`／Seatbelt policy launch failure 未在本輪實機重現，仍是明確邊界（`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:9-10`）。

## 4. 程式碼品質
- 判定：通過
- 證據：故障注入只替換 daemon executable，條件與預設值集中在 wrapper 前段（`scripts/probe-ollama-product-offline.mjs:10-15`）；子程序環境使用明列的 `PATH`、隔離 `HOME`／`TMPDIR` 與 loopback endpoint（同檔 `186-215`）。wrapper 對清理失敗 fail closed，透過 `lstat` 確認 temp root 已移除，並以 `flag: 'wx'` 防止 evidence 覆寫（同檔 `244-272`）。本輪未修改產品 server／runtime；BUG-033 將修正範圍標為 acceptance tooling，並揭露未模擬的啟動失敗類型（`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-10`）。

## 5. 測試覆蓋
- 判定：通過
- 證據：2026-09-29 07:22:34 UTC 平行啟動以下指定命令，全部 exit 0：`node scripts/test-ollama-offline-process.mjs`（輸出 helper／cleanup 測試通過，且無 integration skip 訊息）；`node scripts/test-ai-providers.mjs`（provider contract／術語／Prompt 測試通過）；`npm run check`（19 個治理文件、相關 syntax checks 與完整 npm test suite 通過）；`git diff --check`（無 whitespace error）。2026-09-29 07:23:50 UTC 執行 `npm run docs:check:final`，exit 1，明確回報最新工作紀錄缺少「獨立審查是否執行」、尚未標示「完成」，且該欄位必須為是或否。一般 `docs:check` 已由 `npm run check` 通過，但 final gate 尚未通過。focused test 的故障 evidence 寫在獨立 temp root 並由 `finally` 移除（`scripts/test-ollama-offline-process.mjs:28-60`）；測試前後的 evidence 工作樹清單一致，本輪沒有建立或更新持久 acceptance evidence。

## 6. 實際運行結果
- 判定：通過
- 證據：本輪直接執行 wrapper fault-injection integration regression，exit 0；測試子程序對故意不存在的 daemon executable 產生受控失敗，驗證 wrapper failure evidence、exit 1 及 daemon／port／temp cleanup。未重播 product acceptance，以遵守不建立或更新 acceptance evidence 的指示。重新讀取 post-fix 1B replay8／9：兩者皆為 `MODEL_RESPONSE_CONTRACT_REJECTED`，但外連測試為 `EPERM`，`systemNetworkDisabled=false`，且 daemon stopped、port closed、temp root removed（`docs/project-management/evidence/2026-09-29-ollama-llama3.2-1b-product-offline-replay8.json:3,12-15,21-27,42-45`；`docs/project-management/evidence/2026-09-29-ollama-llama3.2-1b-product-offline-replay9.json:3,12-15,21-27,42-45`）。post-fix 3B replay1 記錄單次兩 cue product flow 通過、接受／undo／redo 各 2、時間碼與來源 SRT hash 不變，並完成相同 cleanup；同樣記錄 `systemNetworkDisabled=false`（`docs/project-management/evidence/2026-09-29-ollama-llama3.2-3b-product-offline-replay1.json:3,12-15,21-27,41-49,64-67`）。這些 artifacts 是本輪前既有證據，不代表全機斷網、任一模型品質或穩定性保證。

## 綜合判定
- 結論：有條件通過
- 可逐字引用完整結論句：**本輪 wrapper 層 ENOENT fault injection 已在具備 macOS 前置條件的環境中實際通過，證據支持 acceptance 子程序的 failure 與 cleanup 控制流；惟 docs:check:final 仍因工作紀錄未完成而 exit 1，故僅有條件通過此子範圍，FR-021 整體仍未結案。**
- 阻擋問題（若有）：wrapper 層故障注入條件已解除；結案仍受文件 final gate 阻擋。主要代理須在 `docs/project-management/08-CHANGE-LOG.md` 補上本輪審查欄位、連結本報告並逐字引用上述完整結論句，將工作紀錄結案後重跑 `npm run docs:check:final` 至 exit 0。2026-09-29 07:23:50 UTC 的實際結果為 exit 1，原因見第 5 面向。本審查依要求只建立本報告，未修改工作紀錄。
- 剩餘風險：`llama3.2:1b` post-fix replay8／9 仍因輸出契約失敗，單次 `llama3.2:3b` 成功不代表品質或穩定性。Seatbelt evidence 僅證明受隔離子程序對測試外連得到 `EPERM` 且 loopback 可用；`systemNetworkDisabled=false`，不是全機物理斷網。Packaged Electron UI、取消／checkpoint 續跑、乾淨安裝、Windows 實機及 LM Studio 均不在本輪驗收範圍，FR-021 整體未完成。
- 給主要開發代理的具體修正要求（若有）：按上述條件同步 08-CHANGE-LOG 並通過 final gate；勿移除未驗收範圍或將本輪結論擴大為全機斷網或 FR-021 整體完成。跨平台 skip 分支及真實 sandbox-exec 權限／policy 啟動失敗如需宣稱已測，須另行提供相應測試證據。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
