# 獨立複審報告：BUG-057 Ollama strict reader cancel bounded cleanup

- 審查對象 commit／版本：`HEAD c06d15e`、branch `codex/0.51-anthropic-claude` 的既有 dirty worktree；本輪只做 BUG-057 round1／round2 報告 schema 與 closeout 複審，保留其他既存修改。
- 對應 08-CHANGE-LOG 條目：`docs/project-management/08-CHANGE-LOG.md:3-25`，2026-10-22 — Ollama strict reader cancel bounded cleanup（BUG-057）。
- 審查輪次：round3。
- 審查代理啟動時間、上下文來源：2026-10-22（Asia/Taipei）；獨立 context，重新執行 `npm run project:preflight -- --type=development`，讀取 AGENTS.md、development preflight route、目前 source／tests、round1／round2 報告及 validator；未修改產品、測試、治理文件、既有 evidence 或 round1／round2 報告。
- 審查範圍界線：本輪只確認 round1 B2、報告 schema 與 08 closeout；所有產品／測試結論限定 deterministic fake／fixture scope，不延伸為 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。

## 1. 需求完整性

- 對應面向：需求／範圍
- 判定：通過
- 證據：round1／round2 已將 BUG-057 限定為 failure-only `reader.cancel()` 的固定 250ms bounded cleanup；正常 EOF 不建立 250ms timer，failure 建立固定 250ms timer，cancel 永不 settle 後仍 `releaseLock()`，reader timeout 在 cancel／release failure 下保留 timeout 分類。
- 證據：本輪使用者授權只允許新增本報告；未擴大為產品、測試、治理文件、既有 evidence 或 round1／round2 原件修正，符合本輪 schema／closeout 複審範圍。
- 證據：`docs/project-management/08-CHANGE-LOG.md:12-14` 的 BUG-057 scope 仍排除真實 Ollama、模型品質、OS 斷網、Windows、UI、封裝、發布與 FR-021 完整驗收。

## 2. 邏輯正確性

- 對應面向：B2 條件與 closeout 判定
- 判定：通過
- 證據：`lib/ai/openai-compatible.mjs:97-140` 顯示 `completed=false` 的 failure-only cleanup；正常 EOF 只走 `releaseLock()`，failure 才以 `STREAM_READER_CLEANUP_TIMEOUT_MS = 250` race 等待 `reader.cancel()`，逾時或 rejection 後仍嘗試 release lock，cleanup exception 不覆蓋原始錯誤。
- 證據：`scripts/test-ai-providers.mjs:198-213`、`:255-275`、`:276-297` 已持續固定 round1 B2 的四項 automated assertions；round3 重新執行 `node scripts/test-ai-providers.mjs` exit 0，未發現 B2 回歸。
- 證據：本輪沒有重新解釋或修改產品控制流；round1／round2 原件內容與 SHA-256 在本輪讀取後保持不變，round3 只評估其 schema／closeout 狀態。

## 3. 邊界情況

- 對應面向：B2 四項邊界條件
- 判定：通過
- 證據：正常 EOF fake reader 斷言 `cancel=0`、`release=1` 且 timer spy 不包含 `250`；failure fake reader 斷言建立恰好一個 `250` timer。
- 證據：hanging `cancel()` fake 永不 settle 時，測試確認 bounded cleanup 不被 1000ms watchdog 擋住、原始 invalid-encoding error 保留、`cancel()` 只呼叫一次且 timeout 後 `releaseLock()` 呼叫一次。
- 證據：reader-path timeout fake 讓 `cancel()` 與 `releaseLock()` failure，測試仍斷言 `error.code === 'timeout'` 且 `retryable === true`；本輪 focused provider test exit 0。
- 證據：上述證據只涵蓋 deterministic fake／fixture；pending cancel promise 在 250ms 後的底層物理 teardown 仍是剩餘風險，不宣稱 live stream 資源已完整回收。

## 4. 程式碼品質

- 對應面向：審查隔離與報告品質
- 判定：通過
- 證據：round1／round2 報告均以唯讀方式重新讀取；既有 round1 SHA-256 為 `9069afbd7faa8b9ec69d315d053d9bf0c82742fd699cb83b195dd0ef2ccd0133`，round2 SHA-256 為 `e959932340f7f828baaa47b95ac15ab2165c0b004877078c1f49c58119f59e02`，本輪未改寫。
- 證據：本報告採用 validator 要求的六個精確標題，並在每節提供 `- 判定：` 與 `- 證據：`；綜合判定含 `- 結論：`、`- 阻擋問題（若有）：`、`- 剩餘風險：` 及完整審查代理聲明。
- 證據：`git diff --check` exit 0；本輪沒有修改產品、測試、治理文件或既有 evidence／round1／round2 報告。

## 5. 測試覆蓋

- 對應面向：round1 B2 與報告 validator regression
- 判定：通過
- 證據：BUG-057 round1 B2 已解除：正常 EOF 不建立 250ms timer、failure 建立 250ms timer、cancel 永不 settle 後仍 releaseLock、reader timeout 在 cancel／release failure 下保留 timeout；上述四項均有 `scripts/test-ai-providers.mjs` automated assertion 且本輪 exit 0。
- 證據：本輪 `node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-optimizer.mjs`、`npm run check`、`git diff --check` 與 `node scripts/test-project-docs-validator.mjs` 均 exit 0。
- 證據：`node scripts/test-project-docs-validator.mjs` 通過，表示本報告使用的 validator schema／多輪結論測試仍可執行；本報告建立後另將直接呼叫 `validateReviewReport` 驗證本檔案。
- 證據：focused／完整 deterministic 測試不取代 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收，本輪不作該等宣稱。

## 6. 實際運行結果

- 對應面向：schema／closeout 實際結果
- 判定：部分通過
- 證據：`npm run project:preflight -- --type=development` 已執行；focused tests、`npm run check`、`git diff --check` 與 `node scripts/test-project-docs-validator.mjs` 均 exit 0。
- 證據：本輪 `npm run docs:check:final` 實際 exit 1；validator 回報 `2026-10-22-ollama-reader-cancel-bounded-round2.md` 的「邏輯正確性」缺少有效判定／具體證據、「測試覆蓋」缺少具體證據，以及「實際運行結果」缺少有效判定／具體證據。
- 證據：closeout 失敗的具體原因是 08 最新條目目前仍鏈結 round2，而 round2 使用 `## 2. 程式邏輯`、`## 6. 實際運行結果與治理` 並缺少 validator 可識別的 `- 證據：` 位置；`08-CHANGE-LOG.md:5` 雖已標示 `狀態：完成`，但最新報告鏈結仍未切換至本 round3 schema，故 final gate 仍未 closeout。
- 證據：本輪未啟動真實 Ollama／LM Studio、未下載模型、未執行 UI／封裝／發布、未修改 OS／網路，未做 Windows、OS 斷網或 FR-021 完整 acceptance。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 BUG-057 round3 獨立複審結論為有條件通過：round1 B2 已解除，`scripts/test-ai-providers.mjs` 持續固定正常 EOF 不建立 250ms timer、failure 建立固定 250ms timer、cancel 永不 settle 後仍 releaseLock，以及 reader timeout 在 cancel／release failure 下保留 timeout 分類；本報告使用 validator 可識別的六個精確標題與必要欄位，focused／完整 deterministic 驗證、`git diff --check`、`node scripts/test-project-docs-validator.mjs` 均 exit 0，但 `npm run docs:check:final` 仍 exit 1，因 08 最新條目仍鏈結 schema 不相容的 round2 報告且尚未鏈結本 round3 報告，故治理 closeout 尚未完成；本結論僅限 deterministic fake／fixture scope，不延伸為 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。**
- 阻擋問題（若有）：
  - G1（schema／closeout blocker）：依本輪唯一寫入授權，未修改 `08-CHANGE-LOG.md` 或 round2 原件；主要代理後續須在其獲授權的 closeout 工作中，將 08 最新審查鏈結與逐字引用切換至本 round3 報告，並重跑 `npm run docs:check:final`。
  - B2：無。round1 B2 的四項 automated condition 已由目前 tests 覆蓋並通過，本輪沒有發現產品邏輯 blocker。
- 剩餘風險：250ms 只保護 deterministic caller 返回與 lock release latency，不證明 pending cancel promise 已完成底層物理 teardown；本輪也不涵蓋 live Ollama、模型品質、Windows、OS 斷網、UI、封裝或 FR-021 完整驗收。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
