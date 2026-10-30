# 獨立審查報告：BUG-057 Ollama strict reader cancel bounded cleanup

- 審查對象 commit／版本：`HEAD c06d15e`、branch `codex/0.51-anthropic-claude` 的既有 dirty worktree；本輪只審查 BUG-057 在 `lib/ai/openai-compatible.mjs`／`scripts/test-ai-providers.mjs` 的差異，保留其他既存修改。
- 對應 08-CHANGE-LOG 條目：2026-10-22 — Ollama strict reader cancel bounded cleanup（BUG-057）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-22（Asia/Taipei）；獨立 context，先執行 `npm run project:preflight -- --type=development`，讀取 AGENTS.md、固定核心與 development 路由文件、BUG-057 的 03／06／07／08 條目、目前 source／tests／既有 BUG-055／056 review，未沿用主要代理的評價性摘要。

## 1. 需求完整性

- 對應面向：需求／範圍
- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:7-16`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-10`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 將 BUG-057 限定為 failure-only `reader.cancel()` 的固定 250ms bounded cleanup；timeout 後仍 `releaseLock()`；cleanup failure 不覆蓋 `ollama_stream_invalid_encoding`、timeout／取消或 `network_error`；正常 EOF 不啟動 cleanup timer。
- 證據：`docs/project-management/03-FUNCTIONAL-DESIGN.md:149` 已將相同 reader lifecycle 契約納入 Ollama strict path，且 `docs/project-management/08-CHANGE-LOG.md:12-14` 明確排除 endpoint、request body、repair／retry policy、UI、封裝、真實模型品質、斷網、Windows 與發布。實作變更與該 scope 相符，未發現範圍擴張。
- 證據：本報告的所有產品／測試結論限定 deterministic fake reader／fixture；不把本輪證據宣稱為 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。

## 2. 邏輯正確性

- 對應面向：程式邏輯
- 判定：通過
- 證據：`lib/ai/openai-compatible.mjs:97-123` 以 `completed=false` 作為 failure default，只有 reader 正常 EOF、strict decoder EOF flush 與 `mergeStreamingRecords()` 全部成功後才設為 `true`；因此正常 EOF 不進 failure cancel，decoder／reader／strict framing／外部取消 failure 會進 cleanup。
- 證據：`lib/ai/openai-compatible.mjs:124-140` 只在 failure path 建立 `cancelPromise` 與 `setTimeout(..., STREAM_READER_CLEANUP_TIMEOUT_MS)` 的 race；`cancel()` rejection 由 `.catch(() => undefined)` 吸收，250ms timeout 後仍走 `releaseLock()`，release exception 也被捕捉。`STREAM_READER_CLEANUP_TIMEOUT_MS` 在 `:33` 固定為 `250`。
- 證據：`lib/ai/providers.mjs:93-100` 只有 Ollama native adapter 注入 strict stream options；`requestAiJson()` 的 `:195-201` 仍保留 `AiProviderError`、外部 signal reason、timeout 與一般 network error 的既有分類。未發現本輪產品邏輯 blocker。

## 3. 邊界情況

- 對應面向：錯誤分類與 cleanup 邊界
- 判定：通過
- 證據：`scripts/test-ai-providers.mjs:186-201` 驗證正常 EOF `cancel=0`／`release=1`；`:202-216` 驗證 decoder invalid byte 的原始 invalid-encoding code、cancel 與 release；`:217-231` 讓 reader rejection、`cancel()` rejection 與 `releaseLock()` exception 同時發生，仍保留 `network_error`／`retryable=true` 且 release 呼叫一次。
- 證據：`scripts/test-ai-providers.mjs:232-252` 的 hanging fake reader 讓 `cancel()` 永不 settle；1 秒 watchdog 未觸發、原始 invalid-encoding code 保留、`cancel()` 只呼叫一次且 timeout 後 `releaseLock()` 呼叫一次。`:253-273` 驗證外部取消 reason 保留；`:274-289` 驗證 strict no-byte-reader fail-closed 與共用 non-strict compatibility。
- 證據：本輪不落檔 matrix probe（`2026-10-22T11:22:42+08:00`）讓 cancel／release cleanup 同時失敗，輸出 `[{"case":"network","code":"network_error","retryable":true,"releaseCalls":1},{"case":"timeout","code":"timeout","retryable":true,"releaseCalls":1},{"case":"cancel","message":"user canceled","releaseCalls":1}]`；證明 invalid／timeout／取消／network 的原始錯誤邊界未被 cleanup 覆蓋。另於 `2026-10-22T11:21:25+08:00` 量得永不 settle cancel 約 261ms 後回傳原始 code 並 release。
- 證據：同一 `2026-10-22T11:21:25+08:00` timer probe 的正常 EOF 輸出為 `normalEofCleanupTimerDelays:[]`（一般 request timeout timers 為 `[1000,1000,1000]`），因此沒有建立 250ms cleanup timer。
- 證據：固定 250ms race 只限制等待 caller／lock release 的 cleanup latency；未承諾也未證明底層永不 settle 的 cancel promise 已完成物理資源 teardown，該點列為剩餘風險而非本輪邏輯 blocker。

## 4. 程式碼品質

- 對應面向：程式實作品質；與程式邏輯及其他 provider regression 交叉核對
- 判定：通過
- 證據：變更集中在 `readStreamingJson()` 的 cleanup constant、failure-only race 與既有測試；沒有以廣泛 catch 改寫原始 provider error，也沒有變更 endpoint、request body、repair／retry、UI 或封裝。strict behavior 仍透過 `streamOptions` opt-in，其他 provider 維持既有 request path。
- 證據：`node --check lib/ai/openai-compatible.mjs`、`node --check scripts/test-ai-providers.mjs`、`node --check scripts/test-ollama-batch-stream.mjs`、`git diff --check` 均通過；完整 provider fixture 仍涵蓋 OpenAI、OpenAI-compatible、Groq、Azure、Gemini、Anthropic、Ollama 與 LM Studio compatibility registry／request contract，未見 deterministic regression。

## 5. 測試覆蓋

- 對應面向：測試充分性
- 判定：部分通過
- 證據：`2026-10-22T11:22:58+08:00` focused batch 的 provider contract、Ollama multi-batch、AI optimizer、治理 validator、相關 syntax checks 與 `git diff --check` 全部 exit 0；`2026-10-22T11:23:03+08:00` 開始的完整 `npm run check` exit 0，包含 19 份治理文件、全套 `npm test`、Ollama offline／UI／stream、核心與 YouTube suites。
- 證據：現有 automated watchdog 位於 `scripts/test-ai-providers.mjs:243-252`，以 1000ms 上限證明 `cancel()` 不會無限阻塞並確認 release；但它不量測或斷言固定 250ms，故單靠該 watchdog 不能證明「最多 250ms」，只能證明目前執行在 1 秒內返回。source 的固定常數及本輪 261ms runtime probe 支持實作行為，但 probe 不會成為持續性 regression test。
- 證據：正式 fixture 已覆蓋 network error 與 cleanup rejection、hanging cancel、正常 EOF、decoder failure、外部取消，以及 fallback timeout；但 reader-path timeout 與 cancel／release 同時失敗、外部取消與 cleanup rejection 的組合未全部固化在 `scripts/test-ai-providers.mjs`。這是測試證據精度／矩陣完整性的 closeout condition，不是目前 source 行為的已證實缺陷。
- 證據：focused／full deterministic tests 不能取代 live endpoint、不同 Ollama／模型版本、模型品質、OS stream 或跨平台實機驗證；這些不屬 BUG-057 scope。

## 6. 實際運行結果

- 對應面向：文件治理、實際驗證與剩餘風險
- 判定：部分通過
- 證據：`npm run project:preflight -- --type=development` 已列出固定核心與 development 路由；focused 與完整 `npm run check` 均實際通過。`npm run docs:check:final` 於 `2026-10-22T11:22:01+08:00` exit 1，明確回報最新工作紀錄缺少「獨立審查是否執行：」與「發布授權：」、仍未標示「完成」、且獨立審查欄位不是「是／否」。這與 `docs/project-management/08-CHANGE-LOG.md:3-16` 仍為「進行中」一致。
- 證據：本輪未啟動真實 Ollama／LM Studio、未下載模型、未執行 UI／封裝／發布、未修改 OS／網路，未做 Windows、OS 斷網或 FR-021 完整 acceptance。結果只證明目前 deterministic fake／fixture contract；不能外推 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。
- 證據：既有 dirty worktree 包含其他未提交 source、治理、evidence 與 review；本輪沒有修改產品、測試、治理文件、既有 evidence 或既有 review，唯一新增檔案是本報告。主要代理仍需在其授權流程中同步 08 closeout 並重新執行 final gate。
- 剩餘風險：cancel 永不 settle 時，250ms 後 caller 可返回且 lock 可 release，但 pending promise 的底層資源收尾仍未由 fake fixture 或本輪 scope 證明；其他 provider 僅有 deterministic regression，不是 live acceptance。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 BUG-057 獨立審查結論為有條件通過：`readStreamingJson()` 的 failure-only `reader.cancel()` 已以固定 250ms bounded race 實作，cancel rejection／timeout 後仍嘗試 `releaseLock()`，invalid encoding、timeout、取消與 network error 在 source、focused／完整 deterministic 回歸及本輪不落檔 matrix 中未被 cleanup 覆蓋，正常 EOF 不建立 250ms cleanup timer，其他 provider 未見 deterministic regression；但正式 1000ms watchdog 只能證明不無限等待，未直接斷言 250ms 上限，且 `08-CHANGE-LOG.md` 最新 BUG-057 仍為「進行中」使 `npm run docs:check:final` exit 1，因此在補強 exact-bound regression（或明確接受其證據邊界）、完成治理 closeout 並重跑 final gate 前不得宣稱無條件完成；本結論僅限 deterministic fake／fixture scope，不延伸為 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。**
- 阻擋問題（若有）：
  - B1（治理 closeout blocker）：`docs/project-management/08-CHANGE-LOG.md:3-16` 尚未標示 BUG-057 完成，也未有「獨立審查是否執行：」及「發布授權：」欄位；`npm run docs:check:final` 已於 `2026-10-22T11:22:01+08:00` exit 1。主要代理須在不修改本報告的前提下完成 08 條目、鏈結本報告並重跑 final gate。
  - B2（測試證據 blocker，非已證實產品邏輯 defect）：1000ms watchdog 未驗證 250ms exact bound，且 reader-path timeout／取消與 cleanup failure 的組合矩陣未全部固定為 automated regression。應補上可持續的時間／timer-bound assertion 與至少一組 reader-path timeout／取消原始錯誤保留案例，或由需求方明確接受目前「source constant＋不落檔 probe」的證據邊界。
- 給主要開發代理的具體修正要求（若有）：
  1. 不修改本報告或既有 review／evidence；補齊 BUG-057 的 08 closeout 與最新獨立審查鏈結，重跑 `npm run docs:check:final`。
  2. 將 watchdog 強化為能檢查 250ms bounded contract 的 deterministic regression，並補足 reader-path timeout／取消在 cleanup rejection／release failure 下的原始分類保留；若因此改動產品邏輯，需依流程新增後續 review round。
  3. 維持 deterministic fake／fixture scope，不宣稱 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
