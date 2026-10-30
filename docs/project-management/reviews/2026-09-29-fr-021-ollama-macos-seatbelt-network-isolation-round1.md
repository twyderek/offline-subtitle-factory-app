# 獨立審查報告：FR-021 Ollama macOS Seatbelt 網路隔離驗收

- 審查對象 commit／版本：工作紀錄所載 HEAD `299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`，版本 `0.51.0`；本輪變更尚未提交（`docs/project-management/08-CHANGE-LOG.md:11`）。
- 對應 08-CHANGE-LOG 條目：2026-09-29 — FR-021 Ollama macOS 作業系統網路隔離驗收（`docs/project-management/08-CHANGE-LOG.md:3`）。
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-09-29；本次獨立審查對話，依指定範圍直接讀取工作樹與 evidence，沒有沿用開發代理對話記憶。精確啟動時分秒未保存在專案紀錄。

## 1. 需求完整性
- 判定：部分通過
- 證據：工作範圍明確限定為 acceptance subprocess，不要求停用全機網路、修改防火牆或驗收 packaged UI／取消與續跑（`docs/project-management/08-CHANGE-LOG.md:12-16`）。程式以 macOS Seatbelt `deny network*` 並只放行 localhost，先驗證 loopback 成功及外部測試位址 `EPERM`，再確認預裝模型後執行既有產品流程（`scripts/probe-ollama-product-offline.mjs:9-10,73-88,165-219`）；npm entrypoint 及 source-contract assertions 存在（`package.json:16-19`、`scripts/test-ai-providers.mjs:346-360,372-375`）。但這只完成 FR-021 的一項驗收子範圍；設計及需求紀錄也明確保留 FR-021 未結案（`docs/project-management/03-FUNCTIONAL-DESIGN.md:103`、`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:44-50`）。

## 2. 邏輯正確性
- 判定：不通過
- 證據：`scripts/probe-ollama-product-offline.mjs:195-200` 直接 `spawn(sandboxExec, ...)` 啟動 daemon，未為該 ChildProcess 註冊 `error` listener；其後的主要錯誤處理是 `try/await main()`（`scripts/probe-ollama-product-offline.mjs:237-245`）。若 `sandbox-exec` 存在但 spawn 仍以 `ENOENT`／`EACCES` 等非同步錯誤失敗，ChildProcess 的 `error` event 沒有接收者，可能成為未處理事件而終止 Node 程序，繞過後續停止 daemon、確認 port 及刪除暫存目錄的清理段（`scripts/probe-ollama-product-offline.mjs:246-273`）。這與工作條目要求清理失敗可觀察且 fail closed 的條件不符（`docs/project-management/08-CHANGE-LOG.md:14,18`）。

## 3. 邊界情況
- 判定：部分通過
- 證據：直接檢視 replay6：`docs/project-management/evidence/2026-09-29-ollama-llama3.2-1b-product-offline-replay6.json`，時間 `2026-09-29T04:29:29.811Z–04:29:33.842Z`，結果 `PRODUCT_PROBE_FAILED`／`OLLAMA_TASK_FAILED`；外連測試仍為 `EPERM`，daemon、port、暫存目錄清理均成功。直接檢視 replay7：同目錄 `...product-offline-replay7.json`，時間 `2026-09-29T04:30:30.816Z–04:30:35.358Z`，結果 pass；外連 `EPERM`、loopback 可用、模型預裝，兩 cue AI completed、接受／undo／redo 各 2、保存完成、時間碼與來源 SRT hash 不變，daemon／port／暫存目錄均清理。兩個 evidence 都記錄 `systemNetworkDisabled=false`。另依工作紀錄，`OLLAMA_BASE_URL=https://example.com` 負向輸入在 daemon 啟動前回報 `CUSTOM_OLLAMA_URL_NOT_ALLOWED`，未對外發 request（`docs/project-management/08-CHANGE-LOG.md:19,260`；該負向測試的精確時分秒未記錄）。未覆蓋 daemon spawn 非同步錯誤及其清理路徑。

## 4. 程式碼品質
- 判定：不通過
- 證據：Seatbelt profile、預裝模型檢查、隔離 HOME、loopback endpoint、exclusive evidence create 與 finally cleanup 的實作可由 `scripts/probe-ollama-product-offline.mjs:9-10,165-219,246-273` 回溯；既有 live probe 拒絕非 loopback URL／覆寫 evidence，並透過暫存資料目錄完成兩 cue、session 決策、undo／redo、校閱保存及來源 SRT／時間碼保護（`scripts/probe-ollama-product-live.mjs:11-20,105-135,158-240,241-255`）。但 offline wrapper 的 daemon spawn error 未被接收，會使其宣稱的完整清理路徑在啟動失敗邊界失效（同檔 `195-200,237-273`）。

## 5. 測試覆蓋
- 判定：部分通過
- 證據：`scripts/test-ai-providers.mjs:346-360` 有 profile、EPERM、預裝模型、遠端 endpoint 拒絕、sandbox 子程序與清理欄位的 source-contract assertions；`package.json:18,28-29` 登錄 offline acceptance 與測試／完整 check。工作紀錄回報 `node --check scripts/probe-ollama-product-offline.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs`、`git diff --check`、`npm run check` exit 0（`docs/project-management/08-CHANGE-LOG.md:19`；另見 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:257-260`）。本輪依要求未重跑測試、live acceptance 或完整 suite。工作紀錄沒有為上述各指令記下執行時分秒，故這些是可追溯至工作紀錄的執行者回報，不是本審查獨立重現的結果。source-contract assertions 也未覆蓋 daemon spawn error event 分支。

## 6. 實際運行結果
- 判定：部分通過
- 證據：replay7 原始 JSON（`docs/project-management/evidence/2026-09-29-ollama-llama3.2-1b-product-offline-replay7.json`，`startedAt=2026-09-29T04:30:30.816Z`、`completedAt=2026-09-29T04:30:35.358Z`）記錄 macOS arm64／Node v22.22.3、`llama3.2:1b`、Seatbelt external socket `EPERM`、loopback 成功及完整兩 cue API product flow；清理狀態全為 true。replay6 同時保留一次產品任務失敗，不應由 replay7 推廣成模型穩定性保證。這是受 sandbox 保護的 API acceptance subprocess；不是全機斷網、packaged Electron UI offline、cancel/checkpoint-resume、LM Studio 或 Windows 實機驗收（`docs/project-management/00-CURRENT-STATUS.md:31-32`、`docs/project-management/03-FUNCTIONAL-DESIGN.md:103`）。

## 綜合判定
- 結論：不通過
- 阻擋問題：offline wrapper 啟動自有 Ollama daemon 的 `spawn` 沒有處理 ChildProcess `error` event；spawn 失敗可能中止程式並跳過 finally cleanup。請補上 spawn error 的受控失敗流程，確保仍停止已啟動的自有程序、移除暫存資料、輸出可辨識 evidence／exit status，並以 focused regression 覆蓋該路徑。修正後應建立 round2，不得覆寫本報告。
- 剩餘風險：replay6 顯示 `llama3.2:1b` product task 仍可能失敗；成功 replay7 僅證明該次流程。此驗收沒有停用全機網路；packaged Electron UI offline、取消／checkpoint 續跑與物理斷網尚未驗收。LM Studio 依需求方決策排除，Windows 實機延後；FR-021 維持開放（`docs/project-management/00-CURRENT-STATUS.md:31-32`、`docs/project-management/08-CHANGE-LOG.md:21`）。
- 給主要開發代理的具體修正要求：處理 `scripts/probe-ollama-product-offline.mjs:195-200` 的 daemon spawn error，保證錯誤進入既有 failure／cleanup／evidence 路徑；新增 focused regression，然後依影響重跑 syntax、provider contract 與相關驗證並請求 round2。不得把本次 sandbox 結果描述成全機斷網或 FR-021 整體完成。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取及驗證，未修改任何其他專案檔案。工作樹在審查前已有其他未提交變更；本報告是本輪唯一新增的 repository file。
- 若上述聲明不實，本報告無效。
