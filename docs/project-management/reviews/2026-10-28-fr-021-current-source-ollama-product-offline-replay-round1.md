# 獨立審查報告：FR-021-REPLAY-20261028 目前 source Ollama product offline replay

- 審查對象 commit／版本：目前 dirty worktree；branch `codex/0.51-anthropic-claude`；package version `0.52.0`；本輪對象為 FR-021-REPLAY-20261028 的兩份新 evidence 與治理文件同步，未把既有 BUG-058 source/test dirty diff 視為本輪產品修改。
- 對應 08-CHANGE-LOG 條目：2026-10-28 — 目前 source 的 Ollama macOS Seatbelt 產品離線驗收重播（FR-021-REPLAY-20261028）。
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-28T10:53:56+08:00（Asia/Taipei）；以獨立上下文依序讀取 `AGENTS.md`、`docs/project-management/README.md`、`00-CURRENT-STATUS.md`、最新 `08-CHANGE-LOG.md`、`02-REQUIREMENTS-ANALYSIS.md`、`03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md` 與 development／test validation／independent review／document closeout workflows，並核對本輪兩份 evidence。未啟動第二次 Ollama、未下載模型、未修改 OS 網路。

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37` 的 FR-021 要求本機 LLM 至少完成模型端到端驗證，且斷網可完成本機字幕優化；同文件 `:48-58` 另記錄 LM Studio 的現行範圍例外與既有 Ollama loopback 子範圍限制。最新 08 條目 `docs/project-management/08-CHANGE-LOG.md:3-14` 將本輪目標限定為目前 source、預裝 `llama3.2:3b`、Seatbelt／loopback、產品兩 cue flow 與 cleanup，並明確排除 UI、取消／續跑、Windows、LM Studio、全 FR-021 與發布。

  `docs/project-management/evidence/2026-10-28-ollama-llama3.2-3b-product-offline-replay1.json:13-16` 明確記錄 `status=fail`、`failureStage=product_probe`、`failureCode=MODEL_RESPONSE_CONTRACT_REJECTED`；因此 product AI flow 的成功條件未滿足。相對地，`:17-45` 證明的是 loopback／Seatbelt／預裝模型／cleanup 子範圍，不是完整產品流程。`docs/project-management/evidence/2026-10-28-ollama-llama3.2-3b-product-live-diagnostic1.json:20-24` 另記錄 loopback live diagnostic 以「實際 Ollama AI 任務等待逾時」失敗，且沒有 raw model response。範圍描述與實際失敗結果一致，但不構成 FR-021 完整通過。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：`scripts/probe-ollama-product-offline.mjs:78-92` 先驗證 loopback 可用且外部測試 socket 必須回 `EPERM`；`:163-231` 先檢查 macOS／模型已預裝，再由 Seatbelt 啟動 daemon 與 sandboxed product probe，只有 child product flow 成功才會把 evidence 設為 pass。`:244-261` 在 failure 後仍檢查 daemon stop、port closed 與 temporary root removal，cleanup 失敗會維持 fail-closed。這與 offline evidence `:20-27`、`:29-45` 的實際欄位相符。

  `scripts/probe-ollama-product-live.mjs:62-70` 將 product task wait 上限固定為 240 秒；`:164-168` 在 AI task 未完成或 suggestion contract 不成立時直接失敗，`:243-255` 仍停止 app process、寫入 exclusive evidence 並清除暫存資料。這支持「diagnostic timeout」分類，但因該 evidence schema 沒有 cleanup 欄位，不能從 JSON 本身宣稱 live diagnostic cleanup 已被證明。產品 source／tests 沒有被本輪 FR-021 replay 修改；目前 dirty source/test 仍包含 BUG-058 變更，適用 deterministic regression 未見回歸，但 live product failure 不能歸因或否證 BUG-058。

## 3. 邊界情況

- 判定：部分通過
- 證據：offline probe 覆蓋了目前模型未預裝、custom endpoint、Seatbelt profile failure、daemon spawn failure、product probe failure 與 cleanup failure 的 fail-closed 路徑；`scripts/test-ai-providers.mjs:617-638` 以 source-contract assertions 固定 deny-network、EPERM、無自動下載、sandbox spawn、managed-child cleanup、exclusive evidence 與 `systemNetworkDisabled=false` 邊界。`npm run check` 內的 `scripts/test-ollama-offline-process.mjs` 亦實際通過 spawn-error／close／cleanup fault-injection，但該測試不是本次 live Ollama acceptance。

  evidence privacy probe 以唯讀 Node script 解析兩份 JSON，確認兩份 schema／status／local endpoint 欄位可解析，且未匹配 `/Users/`、`/private/var/`、`/tmp/`、`Authorization`、API key、secret、token、raw response、stdout 或 stderr 等敏感／路徑內容；結果兩份 `forbiddenMatches=[]`。offline evidence `:18-27` 也正確寫 `systemNetworkDisabled=false`，live diagnostic `:12-18` 限定為 `127.0.0.1` 並揭露同一邊界。未覆蓋的關鍵邊界仍包括成功 product AI response、接受／undo／redo／雙語保存、raw response capture、不同模型／版本、Electron UI、取消／續跑、Windows 與真正全機斷網。

## 4. 程式碼品質

- 判定：通過
- 證據：本輪沒有產品 source 或測試修改；工作樹檔案盤點顯示本輪新增的是兩份 evidence 與治理文件同步，既有 `lib/ai/openai-compatible.mjs`／`scripts/test-ai-providers.mjs` dirty diff 屬前一輪 BUG-058，未由本輪重寫。`node --check scripts/probe-ollama-product-offline.mjs`、`node --check scripts/probe-ollama-product-live.mjs` 均 exit 0。offline wrapper 使用 `flag: 'wx'`（`scripts/probe-ollama-product-offline.mjs:265-271`），live diagnostic 也在 `:247-255` 以 exclusive create 並於 finally 清理 data directory；未見覆寫既有 evidence 或把暫存／秘密寫入報告的邏輯。

  這個判定只代表本輪沒有發現 source／wrapper 靜態結構或 evidence 寫入的 deterministic 品質問題，不代表模型輸出品質或 live runtime 成功。

## 5. 測試覆蓋

- 判定：通過
- 證據：2026-10-28T10:53:56+08:00 起的唯讀驗證中，`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-optimizer.mjs`、完整 `npm run check` 與 `node scripts/test-project-docs-validator.mjs` 均 exit 0；完整 check 包含 AI／Ollama deterministic suites、offline managed-child fault-injection、offline UI contract、核心與 YouTube suites。`git diff --check` exit 0。完整 `npm run check` 沒有呼叫 `acceptance:ollama:offline` 或 `acceptance:ollama:product`，故未啟動第二次 Ollama。

  但這些是 deterministic／fixture／contract regression，不能替代本輪已失敗的 product AI flow，也不能把既有歷史成功 replay 擴大成目前 3B run 成功。測試本身沒有提供 live model raw output 或 product task 的成功 acceptance artifact。

## 6. 實際運行結果

- 判定：不通過
- 證據：offline evidence `docs/project-management/evidence/2026-10-28-ollama-llama3.2-3b-product-offline-replay1.json:3-5` 顯示 run 約 10.383 秒；`:13-16` 顯示 product probe 以 `MODEL_RESPONSE_CONTRACT_REJECTED` 失敗，但 `:20-27` 證明 loopback allowed、外連 `EPERM` 且沒有宣稱全機斷網，`:29-45` 證明預裝模型已找到、未下載、daemon stopped、port closed、temporary root removed。故「離線 Seatbelt isolation／cleanup 子範圍：通過」；「product AI flow：失敗」。

  第二份 evidence `docs/project-management/evidence/2026-10-28-ollama-llama3.2-3b-product-live-diagnostic1.json:3-5` 顯示約 240.520 秒，`:12-18` 只使用 loopback、系統網路未關閉，`:20-24` 以 AI task wait timeout 失敗且沒有 raw response。故「loopback live diagnostic：timeout」，不能推論為模型品質、strict parser、BUG-058 或 Ollama runtime 的唯一根因。`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:5-9` 與 `07-DEBUG-AND-FIX-HISTORY.md:3-9` 對這三種結果的拆分與本次原件一致。

  治理唯讀結果：`npm run docs:check:final` exit 1，錯誤為最新 08 條目缺少「獨立審查是否執行：」與「發布授權：」、狀態仍為「進行中」、且審查欄位尚非「是／否」。`npm run docs:check`／完整 `npm run check` 通過不等於 final closeout 通過。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪 FR-021-REPLAY-20261028 獨立審查結論為不通過治理結案：Seatbelt loopback／外連 EPERM／預裝模型與 daemon／port／temporary-root cleanup 子範圍通過，但 product AI flow 以 MODEL_RESPONSE_CONTRACT_REJECTED 失敗，另一次 loopback live diagnostic 在 240 秒等待上限逾時且無 raw model response；因此不能宣稱 FR-021 完整通過，亦不得把單次 evidence 擴大為模型品質、根因或跨平台驗收。**
- 阻擋問題（若有）：
  1. 目前 source 的 3B offline product probe 在 `product_probe` 失敗，未完成 AI suggestions、接受／undo／redo、雙語保存與時間碼／原始字幕完整產品流程；這是本輪 product acceptance blocker。
  2. loopback live diagnostic 在 240 秒 task wait timeout，沒有 raw response，故目前無法安全歸因或宣稱 BUG-058 已解決／造成此失敗；相同條件下重播不應以堆疊樣本取代診斷方向。
  3. `npm run docs:check:final` 尚未通過，最新 08 條目仍為進行中且尚未記錄本輪審查欄位；本報告只能提供審查，不得替主要代理修改治理文件。
- 剩餘風險：本證據只代表 2026-10-28 的 macOS arm64、`llama3.2:3b`、目前 dirty source 與單次 run；不代表其他模型／版本、Windows、Electron UI、取消／續跑、真正全機斷網、LM Studio 或 FR-021 整體。live diagnostic JSON 沒有 cleanup 狀態欄位，因此即使 wrapper finally 具備清理程式碼，也不應把 live diagnostic cleanup 當成已落檔的通過證據。offline isolation 只隔離 acceptance 子程序，`systemNetworkDisabled=false`，不等同 OS／Wi-Fi／防火牆的全機斷網安全邊界。
- 給主要開發代理的具體修正要求（若有）：保留兩份 immutable fail evidence，不修改或覆蓋；先以新的、明確授權且不下載模型／不改 OS 網路的診斷方向釐清 `MODEL_RESPONSE_CONTRACT_REJECTED` 與 240 秒 timeout（必要時補充不含字幕／秘密的受控分類或 bounded runtime telemetry），不要以相同條件重播堆疊成功樣本。若要關閉本次「診斷工作」而非宣稱產品通過，須把 08 最新條目完整標為反映實際結果的完成狀態、加入本報告連結與逐字結論句、記錄發布授權不適用，並重跑 `npm run docs:check:final`；在此之前不可進入治理 closeout。即使 final gate 之後通過，也只能是「失敗結果已文件化結案」，不可宣稱 FR-021 完整通過。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
