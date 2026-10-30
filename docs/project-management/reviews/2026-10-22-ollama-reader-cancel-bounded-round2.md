# 獨立複審報告：BUG-057 Ollama strict reader cancel bounded cleanup

- 審查對象 commit／版本：`HEAD c06d15e`、branch `codex/0.51-anthropic-claude` 的既有 dirty worktree；本輪只讀複審 BUG-057 目前 source／tests／治理狀態，保留其他既存修改。
- 對應 08-CHANGE-LOG 條目：`docs/project-management/08-CHANGE-LOG.md:3-25`，2026-10-22 — Ollama strict reader cancel bounded cleanup（BUG-057）。
- 審查輪次：round2。
- 審查代理啟動時間、上下文來源：2026-10-22（Asia/Taipei）；獨立 context，先執行 `npm run project:preflight -- --type=full`，讀取 AGENTS.md、固定核心與 full 路由文件、BUG-057 的 03／06／07／08 條目、目前 `lib/ai/openai-compatible.mjs`／`scripts/test-ai-providers.mjs` 與 round1 報告；未修改產品、測試、治理文件、既有 evidence 或 round1 報告。
- 審查範圍界線：所有產品／測試結論限定 deterministic fake／fixture scope；不延伸為 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。

## 1. 需求完整性

- 對應面向：需求／範圍。
- 判定：通過。
- 證據：`08-CHANGE-LOG.md:11-17`、`06-TEST-AND-PROCESS-AUDIT.md:3-10`、`07-DEBUG-AND-FIX-HISTORY.md:3-9` 將 BUG-057 限定為 failure-only `reader.cancel()` 的固定 250ms bounded cleanup；逾時後仍 `releaseLock()`；cancel rejection、timeout 與 release exception 不覆蓋原始 invalid encoding、timeout／取消或 network error；正常 EOF 不建立 cleanup timer。
- 證據：目前變更集中於 `lib/ai/openai-compatible.mjs:33,76-141` 與 `scripts/test-ai-providers.mjs:186-318`；未擴大到 endpoint、request body、repair／retry policy、UI、封裝、發布或真實 endpoint。
- 證據：08 最新 BUG-057 條目目前仍為 `狀態：進行中`（`08-CHANGE-LOG.md:5`）；其 round1 quote 與 round1 原件的完整結論句一致，未改寫 round1 報告。

## 2. 程式邏輯

- 對應面向：程式邏輯。
- 判定：通過。
- 證據：`lib/ai/openai-compatible.mjs:97-123` 以 `completed=false` 作為 failure default，只有 reader 正常 EOF、strict decoder EOF flush 與 strict merge 成功後才設為 `true`；正常 EOF 不進 failure cleanup。
- 證據：`lib/ai/openai-compatible.mjs:124-140` 只在 failure path 建立 `reader.cancel()` promise 與 `setTimeout(..., STREAM_READER_CLEANUP_TIMEOUT_MS)` 的 race；`:33` 將常數固定為 `250`；cancel rejection／250ms timeout 後仍進入 `releaseLock()`，release exception 被捕捉而不覆蓋原始錯誤。
- 證據：`requestAiJson()` 的 timeout／network／外部 signal 分類未被 cleanup 改寫；目前 provider-focused tests 實際通過 reader timeout、transport rejection、strict encoding 與外部取消案例。

## 3. 邊界情況

- 對應面向：錯誤分類、取消與 cleanup 邊界。
- 判定：通過。
- 證據：`scripts/test-ai-providers.mjs:186-213` 的 fake reader 正常 EOF 斷言 `cancel=0`、`release=1`，並以 `setTimeout` spy 斷言 `250` 不在正常 EOF timer delays。
- 證據：`scripts/test-ai-providers.mjs:244-275` 的 hanging fake reader 讓 `cancel()` 永不 settle；1000ms watchdog 未先觸發、原始 invalid-encoding code 保留、`cancel()` 只呼叫一次、timeout 後 `releaseLock()` 呼叫一次，並以 `cleanupTimerDelays.filter(delay => delay === 250).length === 1` 固定 failure timer assertion。
- 證據：`scripts/test-ai-providers.mjs:276-297` 的 reader-path timeout fake reader 讓 `cancel()` 與 `releaseLock()` 同時 throw；request timeout 仍以 `error.code === 'timeout' && error.retryable === true` 通過，且兩個 cleanup 方法各被呼叫一次。
- 證據：`scripts/test-ai-providers.mjs:229-243` 另覆蓋 reader transport rejection、cancel failure、release failure，仍保留 `network_error`；`:298-318` 覆蓋外部取消後的 cancel／release。這些案例未發現 cleanup 覆蓋原始錯誤的產品邏輯問題。
- 剩餘邊界：250ms 後 pending cancel promise 的底層物理 teardown 不由 fake fixture 證明，屬本輪範圍外風險，不是 B2 的 automated regression blocker。

## 4. 程式碼品質

- 對應面向：實作品質與變更隔離。
- 判定：通過。
- 證據：變更使用單一固定常數與 failure-only cleanup scope，沒有以 catch 將原始錯誤改寫成 cleanup error；strict behavior 仍由 Ollama native path 的 stream options opt-in，其他 provider 的 non-strict compatibility test 保留並通過。
- 證據：本輪只建立本報告；既有產品、測試、治理文件、evidence 與 round1 報告均未修改。既有 dirty worktree 其他變更未被本輪當成 BUG-057 結論。
- 證據：`git diff --check` exit 0；focused provider／Ollama batch／optimizer tests 均 exit 0。

## 5. 測試覆蓋

- 對應面向：回歸與持續性證據。
- 判定：通過；round1 B2 已解除。
- B2 對照：
  - 正常 EOF 不建立 250ms cleanup timer：`scripts/test-ai-providers.mjs:198-213` 的 timer spy 與 `normalTimerDelays.includes(250) === false`。
  - failure path 建立固定 250ms timer：`:255-275` 的 timer spy 與 `delay === 250` 計數 assertion。
  - cancel 永不 settle 後仍 releaseLock：`:244-274` 的 hanging cancel fake、1000ms watchdog 與 `hangingCancelReleaseCalls === 1`。
  - reader-path timeout 在 cancel／release failure 時仍保留 timeout 分類：`:276-297` 的 `cancel()`／`releaseLock()` throw fixture 與 `timeout`／`retryable` assertion。
- 實際命令結果：`node scripts/test-ai-providers.mjs` exit 0（`AI provider contract 與術語／Prompt 測試通過`）；`node scripts/test-ollama-batch-stream.mjs` exit 0；`node scripts/test-ai-optimizer.mjs` exit 0。
- 完整回歸：`npm run check` exit 0，包含治理文件檢查、syntax checks、完整 `npm test`、Ollama offline／UI／stream、核心與 YouTube suites。
- 結論界線：上述是 deterministic fake／fixture regression；沒有把測試結果當成 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。

## 6. 實際運行結果與治理

- 對應面向：實際驗證、治理 closeout 與剩餘風險。
- 判定：有條件通過。
- 證據：本輪執行 `npm run project:preflight -- --type=full`；指定 focused commands、`npm run check` 與 `git diff --check` 均 exit 0。
- 證據：`npm run docs:check:final` 在目前工作樹 exit 1，validator 明確回報「08-CHANGE-LOG.md 的最新工作紀錄尚未標示為『完成』」及「最新一輪為有條件通過，但該輪條件未記錄為需求方已接受」。本輪依使用者限制未修改 08 條目，因此如實保留該治理狀態。
- 08／round1 核對：`08-CHANGE-LOG.md:21-22` 已保留 round1 報告路徑與逐字引用；目前 round1 原件 SHA-256 為 `9069afbd7faa8b9ec69d315d053d9bf0c82742fd699cb83b195dd0ef2ccd0133`，本輪未寫入該檔案。
- 不在本輪：未啟動真實 Ollama／LM Studio、未下載模型、未執行 UI／封裝／發布、未修改 OS／網路，未做 Windows、OS 斷網或 FR-021 完整 acceptance。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪 BUG-057 round2 獨立複審結論為有條件通過：round1 B2 的 automated exact-bound／reader-timeout test condition 已解除，`scripts/test-ai-providers.mjs` 持續斷言正常 EOF 不建立 250ms cleanup timer、failure path 建立固定 250ms timer、cancel 永不 settle 後仍 releaseLock，以及 reader-path timeout 在 cancel／release failure 下保留 `timeout` 分類；source、focused／完整 deterministic 回歸與 `git diff --check` 均通過，未見 BUG-057 產品邏輯 blocker，但 `08-CHANGE-LOG.md` 最新 BUG-057 仍為「進行中」，本輪 `npm run docs:check:final` 以 exit 1 回報最新工作紀錄未完成及條件未記錄為需求方已接受，因此治理 closeout 尚未解除；本結論僅限 deterministic fake／fixture scope，不延伸為 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。**
- 阻擋問題（若有）：
  - G1（治理 closeout blocker）：`08-CHANGE-LOG.md:5,20,25` 仍將 BUG-057 標示為「進行中」、最新結論待 round2；`npm run docs:check:final` 仍 exit 1。依使用者明確限制，本輪不修改 08，故不能宣稱 BUG-057 已完成治理結案。
  - B2：無。round1 所列 exact-bound／reader-timeout automated regression condition 已由目前 `scripts/test-ai-providers.mjs` 的持續性 assertions 覆蓋並通過。

## Round1 quote 核對

`08-CHANGE-LOG.md:22` 與 `docs/project-management/reviews/2026-10-22-ollama-reader-cancel-bounded-round1.md` 的「綜合判定」完整句逐字一致：**本輪 BUG-057 獨立審查結論為有條件通過：`readStreamingJson()` 的 failure-only `reader.cancel()` 已以固定 250ms bounded race 實作，cancel rejection／timeout 後仍嘗試 `releaseLock()`，invalid encoding、timeout、取消與 network error 在 source、focused／完整 deterministic 回歸及本輪不落檔 matrix 中未被 cleanup 覆蓋，正常 EOF 不建立 250ms cleanup timer，其他 provider 未見 deterministic regression；但正式 1000ms watchdog 只能證明不無限等待，未直接斷言 250ms 上限，且 `08-CHANGE-LOG.md` 最新 BUG-057 仍為「進行中」使 `npm run docs:check:final` exit 1，因此在補強 exact-bound regression（或明確接受其證據邊界）、完成治理 closeout 並重跑 final gate 前不得宣稱無條件完成；本結論僅限 deterministic fake／fixture scope，不延伸為 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
