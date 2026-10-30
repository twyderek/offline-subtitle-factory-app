# 獨立審查報告：FR-021 Ollama macOS Seatbelt 網路隔離驗收

- 審查對象 commit／版本：HEAD `299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`、版本 `0.51.0`；本輪相關程式、文件與 evidence 均為未提交工作樹內容。審查前工作樹另有 FR-020／Whisper 修改，本報告不將其納入 FR-021 判定。
- 對應 08-CHANGE-LOG 條目：2026-09-29 — FR-021 Ollama macOS 作業系統網路隔離驗收（`docs/project-management/08-CHANGE-LOG.md:3-22`）。
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-09-29；本輪為獨立審查上下文，依指定需求重新讀取治理路由、需求／設計、工作樹、程式、測試、evidence 與 round1 報告。最初 preflight 的時分秒未同步記錄；本報告所列驗證命令均記錄 UTC 啟動時間。

## 1. 需求完整性
- 判定：通過
- 證據：具體證據：本輪範圍限 macOS acceptance subprocess，工作條目明列不關閉全機網路、不修改防火牆、不驗收 packaged UI／取消續跑／Windows／LM Studio（`docs/project-management/08-CHANGE-LOG.md:12-15`）。wrapper 以 macOS Seatbelt profile 啟動隔離 daemon 與 product probe（`scripts/probe-ollama-product-offline.mjs:10-11,156-164,186-210`）；狀態、設計與測試稽核均保留「不是全機斷網、FR-021 整體未結案」界線（`docs/project-management/00-CURRENT-STATUS.md:31-33`、`docs/project-management/03-FUNCTIONAL-DESIGN.md:103`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:261-263`）。LM Studio 及 Windows 依本輪授權界線排除，未拿單次 1B／3B 輸出推廣品質保證。

## 2. 邏輯正確性
- 判定：通過
- 證據：具體證據：managed-child helper 在 spawn 後立即監聽 `spawn`、`error`、`close`，只保存正規化 error code，並以 `closed` promise 等待 close；停止程序時採有界 SIGTERM／SIGKILL 與 close 確認（`lib/ai/managed-child-process.mjs:3-49`）。wrapper readiness loop 在 spawn error／child close 時 fail closed（`scripts/probe-ollama-product-offline.mjs:91-103`）；外層 catch 後仍執行 daemon stop、port check、temp cleanup 與 exclusive evidence write（同檔 `228-265`）。這修正 round1 所指出的未接收非同步 spawn error 路徑（`docs/project-management/reviews/2026-09-29-fr-021-ollama-macos-seatbelt-network-isolation-round1.md`「2. 邏輯正確性」）。

## 3. 邊界情況
- 判定：部分通過
- 證據：具體證據：Seatbelt profile 先以 sandbox 內 loopback HTTP 成功及 RFC5737 socket `EPERM` 作 fail-closed assertion（`scripts/probe-ollama-product-offline.mjs:74-88`）；拒絕自訂 endpoint、缺少模型不啟動 product flow，並檢查 evidence 不覆寫（同檔 `156-176,191-196,257-263`）。ENOENT focused regression 使用不存在的 executable，確認 `started=false`、接收 ENOENT、等待 close 與安全 cleanup（`scripts/test-ollama-offline-process.mjs:6-17`）。但此測試直接覆蓋 helper，沒有在 wrapper 層注入 daemon spawn failure 並斷言 `failureCode`、exit status、evidence 與完整 cleanup；`07-DEBUG-AND-FIX-HISTORY.md:10` 亦明列尚未注入 Seatbelt／sandbox-exec 啟動錯誤，故此類整合故障仍未實測。

## 4. 程式碼品質
- 判定：通過
- 證據：具體證據：改動集中於 acceptance wrapper、共用 child lifecycle helper、focused regression、provider source-contract 與 npm scripts；本輪沒有修改產品 runtime。Evidence 使用 exclusive `wx`，最小環境變數包含隔離 HOME／TMP，daemon 只綁定預留的 loopback port，模型須先在本機 tag 清單精確存在（`scripts/probe-ollama-product-offline.mjs:166-210,257-263`）。測試以 source-contract 確認 wrapper 呼叫 managed helper 並聲明 cleanup／scope 欄位（`scripts/test-ai-providers.mjs:330-375`）。

## 5. 測試覆蓋
- 判定：部分通過
- 證據：具體證據：本審查於 2026-09-29 06:56:03 UTC 執行 `npm run check`，exit 0；輸出確認 19 個治理文件檢查通過、完整測試套件通過，包含 `Ollama offline managed-child test passed: spawn error is observed, close is awaited, cleanup is safe` 及 provider contract 測試。2026-09-29 06:56:04 UTC 執行 `git diff --check`，exit 0。2026-09-29 06:56:03 UTC 執行 `npm run docs:check:final`，exit 1：最新工作紀錄缺少「獨立審查是否執行」、狀態尚未標示完成，故結案 gate 尚未通過。測試範圍的限制同第 3 面向：完整 wrapper 的 daemon spawn-error fault injection 未覆蓋。

## 6. 實際運行結果
- 判定：部分通過
- 證據：具體證據：本輪未重播 acceptance，以免建立或更新額外 evidence；重新讀取指定原始 JSON。replay7（`docs/project-management/evidence/2026-09-29-ollama-llama3.2-1b-product-offline-replay7.json:3,8,13,21-27,41,47-49,56-57,65-67`）是原始版本成功結果，不能視為 round1 修正後重播。修正後 1B replay8／9 均為 `MODEL_RESPONSE_CONTRACT_REJECTED`，但記錄外連 `EPERM`、daemon stopped、port closed、temp root removed（`docs/project-management/evidence/2026-09-29-ollama-llama3.2-1b-product-offline-replay8.json:13-14,21-27,40,43-45`；`docs/project-management/evidence/2026-09-29-ollama-llama3.2-1b-product-offline-replay9.json:13-14,21-27,40,43-45`）。修正後 3B replay1 為 pass，兩 cue 流程、接受／undo／redo、時間碼與來源 SRT hash 保護及完整 cleanup 均有記錄（`docs/project-management/evidence/2026-09-29-ollama-llama3.2-3b-product-offline-replay1.json:3,8,13,21-27,41,47-49,56-57,65-67`）。四份 evidence 均記錄 `arch=arm64` 且 `systemNetworkDisabled=false`；這支持 macOS arm64 sandbox 子程序範圍，不代表全機斷網或任一模型品質／穩定性保證。

## 綜合判定
- 結論：有條件通過
- 可逐字引用完整結論句：**本輪程式、測試與 post-fix evidence 支持 macOS arm64 Ollama acceptance 子程序的 deny-network／loopback 流程及 managed-child ENOENT／close 修正，但 wrapper 層 spawn-error 故障注入尚未驗證，且文件 final gate 目前未通過，因此僅有條件通過此子範圍，FR-021 整體仍未結案。**
- 阻擋問題（若有）：結案前需由主要代理在工作紀錄引用本報告及逐字結論，完成必要欄位後重跑並通過 `npm run docs:check:final`。若要將 daemon spawn failure 的 wrapper cleanup 宣稱為已實測，仍需補 wrapper 層故障注入；目前證據只直接驗證 helper 的 ENOENT／close，wrapper failure 路徑由 source-contract 與程式流程支持。
- 剩餘風險：post-fix 1B replay8／9 模型回應契約失敗；3B replay1 單次成功不代表品質或穩定性保證。尚未驗收全機實際斷網、packaged Electron UI、UI 取消／checkpoint 續跑、Windows 實機或 LM Studio；FR-021 整體維持未結案。
- 給主要開發代理的具體修正要求（若有）：依專案流程同步本報告路徑與上述逐字判定至工作紀錄，再執行 `npm run docs:check:final`。若工作項目仍要主張完整驗證 daemon spawn-error cleanup，新增 wrapper 層故障注入並確認 evidence failure code、非零 exit、daemon／port／temp cleanup 後請求下一輪複審。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
