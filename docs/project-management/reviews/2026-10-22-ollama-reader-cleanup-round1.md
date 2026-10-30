# 獨立審查報告：BUG-056 Ollama strict reader cleanup

- 審查對象 commit／版本：工作樹目前 `c06d15e`（branch `codex/0.51-anthropic-claude`）；審查對象是該 commit 上的既有 dirty worktree，包含 BUG-056 產品／測試／治理變更與主代理既有未追蹤 evidence／reviews。
- 對應 08-CHANGE-LOG 條目：2026-10-22 — Ollama strict reader 失敗後釋放與取消（BUG-056）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-22（Asia/Taipei）；本報告由獨立 context 啟動，未沿用主要開發代理的評價性摘要，只依 `AGENTS.md`、development preflight、指定治理路由、目前 source／tests、Git 狀態與本報告記載的只讀指令判斷。

本報告依專案 validator 所需的六個章節，對應需求方指定的六面向：第 1 節為需求／範圍，第 2／4 節為程式正確性，第 3 節為錯誤分類與 cleanup 邊界，第 5 節為測試充分性，第 6 節為實際運行與文件／治理一致性；剩餘風險集中列於「綜合判定」。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:7-16`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 與 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-10` 將 BUG-056 限定為 `readStreamingJson()` 的 strict reader lifecycle：正常 EOF release lock；decoder／reader rejection／外部取消先 best-effort cancel 再 release；cleanup failure 不覆蓋原始錯誤；不改 endpoint、request body、repair policy、UI、封裝、發布、模型品質、斷網或 Windows 驗收。`lib/ai/openai-compatible.mjs:91-126` 的實作只在共用 streaming reader 增加該 lifecycle 邊界；`lib/ai/providers.mjs:61-100` 只有 Ollama native path 傳入 strict options，其餘 provider 未傳入 strict mode。
- 證據：`docs/project-management/03-FUNCTIONAL-DESIGN.md:143-153` 已把 Ollama strict reader 的 EOF、decoder／reader／abort cleanup、錯誤保留與其他 provider 不放寬契約寫入設計；本次未發現範圍擴張或對既有 evidence／review 的覆寫。

## 2. 邏輯正確性

- 判定：通過
- 證據：`lib/ai/openai-compatible.mjs:95-120` 以 `completed=false` 作為 failure default，只有 reader EOF、decoder flush 與 `mergeStreamingRecords()` 全部成功後才在 `:119` 設為 `true`。因此正常 EOF 進 `finally` 時不呼叫 cancel；decoder failure、EOF flush failure、reader rejection、strict NDJSON failure 或外部 abort 均保持 `completed=false`。
- 證據：`lib/ai/openai-compatible.mjs:121-126` 的 failure path 先 `await reader.cancel()`，以獨立 `try/catch` 吞掉 cancel exception，再以另一個 `try/catch` 呼叫 `reader.releaseLock()`；因此 cancel failure 不會阻止 release，release failure 也不會覆蓋原始 exception。`requestAiJson()` 的既有 `:180-186` 分類仍保留 `AiProviderError`、外部 signal reason、timeout 與 network error。
- 證據：`2026-10-22T10:56:01+08:00` 的 `node scripts/test-ai-providers.mjs` 通過，包含正常 EOF、decoder failure、reader rejection、外部取消、strict encoding／framing 與 non-strict compatibility；`2026-10-22T10:56:44+08:00` 的不落檔 fault-injection probe 以 fake reader 同時讓 cancel／release 失敗，仍分別保留 `probe_invalid_encoding` 與 `network_error`；`2026-10-22T10:56:48+08:00` 的同類 probe 讓外部 abort 的 cancel／release 都失敗，仍保留原始 `external cancel`。

## 3. 邊界情況

- 判定：通過
- 證據：已實際覆蓋並核對以下矩陣：正常 EOF（cancel=0、release=1）；decoder invalid byte（cancel=1、release=1、不可重試 invalid-encoding code）；reader rejection（cancel=1、release=1、可重試 `network_error`）；外部 abort（cancel=1、release=1、原始取消 reason 保留）；cancel 自身 rejection；releaseLock 自身 rejection；strict EOF decoder flush failure；strict malformed NDJSON；non-strict replacement-compatible stream。主要 deterministic probe 對應 `scripts/test-ai-providers.mjs:186-268`，cleanup failure 補充 probe 的實際輸出為 `{"result":"pass","cases":["normal EOF release failure is swallowed","decoder failure preserves original error across cancel/release failures","reader rejection preserves network_error across cancel/release failures"]}`，abort 補充 probe 的實際輸出為 `{"result":"pass","case":"external abort preserves original reason across cancel/release failures"}`。
- 證據：正常 EOF 與 failure 的分界可回溯到 `lib/ai/openai-compatible.mjs:97-120`；cleanup ordering 可回溯到 `:121-126`。未發現 failure path 先 return、cancel exception 遮蔽原始錯誤、或 releaseLock 未嘗試的路徑。`reader.getReader()` 本身若同步失敗時尚未取得 reader，沒有可執行的 reader cleanup；這是 API 邊界，不是本次修正遺漏。

## 4. 程式碼品質

- 判定：通過
- 證據：變更集中於 `readStreamingJson()` 的完成旗標與雙層 cleanup guard，沒有以全域 catch 改寫 provider error；註解明確說明 cancel／release exception 必須保留原始串流錯誤（`lib/ai/openai-compatible.mjs:123-125`）。`streamOptions` 維持 opt-in 設計，Ollama 的 strict flags 位於 `lib/ai/providers.mjs:93-100`，其他 provider 仍走預設 non-strict request path（`lib/ai/providers.mjs:117-181`）。
- 證據：`2026-10-22T10:56:01+08:00` 的四個 `node --check`（`lib/ai/openai-compatible.mjs`、`lib/ai/providers.mjs`、`scripts/test-ai-providers.mjs`、`scripts/test-ollama-batch-stream.mjs`）均 exit 0；同一時間的 `git diff --check` exit 0。沒有看到為 BUG-056 修改 endpoint、provider registry、retry／repair policy 或其他非必要模組。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：`2026-10-22T10:56:01+08:00` 的 `node scripts/test-ai-providers.mjs` 與 `node scripts/test-ollama-batch-stream.mjs` 均 exit 0；provider contract suite 實際涵蓋 OpenAI、OpenAI-compatible、Groq、Azure、Ollama、LM Studio deterministic registry／request contract、Gemini、Anthropic 及 shared non-strict stream behavior。`2026-10-22T10:56:03+08:00` 啟動的完整 `npm run check` exit 0，包含全套 `npm test`、Ollama offline／UI／batch stream、AI optimizer、核心與 YouTube suites。
- 證據：目前 automated lifecycle probe `scripts/test-ai-providers.mjs:186-252` 已驗證正常 EOF 不 cancel、failure cancel／release、reader rejection 的 cancel failure 不遮蔽 `network_error`、以及外部 abort，但 `scripts/test-ai-providers.mjs:221-222` 的 reader rejection fake 只有 `cancel()` throw，`releaseLock()` 仍成功；沒有 committed regression case 直接讓 `releaseLock()` throw，也沒有在 decoder／abort cases 直接注入 release failure。前述不落檔 probe 已證明現行 source 行為，但不能取代可持續的自動化回歸案例。
- 證據：其他 provider 的 deterministic contract 沒有回歸輸出；不過本輪沒有真實雲端 provider／Ollama endpoint 連線，也沒有模型輸出品質證據。這符合 BUG-056 明確排除 live endpoint 與模型品質的 scope，不應把 fixture suite 解讀成 live acceptance。

## 6. 實際運行結果

- 判定：部分通過
- 證據：已實際執行 `npm run project:preflight -- --type=development`（列出固定核心與 development 路由）、`npm run docs:check`（`2026-10-22T10:56:01+08:00`，exit 0，19 個治理文件）、四項 syntax check、兩個 provider／Ollama focused suites、`node scripts/test-ai-optimizer.mjs`、`git diff --check`，以及完整 `npm run check`（`2026-10-22T10:56:03+08:00`，exit 0）。這些結果證明目前工作樹的 deterministic source／fixture regression 通過。
- 證據：`npm run docs:check:final` 於 `2026-10-22T10:57:03+08:00` exit 1，明確報告最新 BUG-056 工作條目缺少「獨立審查是否執行」與「發布授權」、且狀態仍非「完成」。這與目前 `docs/project-management/08-CHANGE-LOG.md:3-16` 的「進行中」狀態一致；因此文件／治理一致性與 final closeout 目前尚未通過。依使用者授權，本輪只新增本報告，未修改該既有工作條目。
- 證據：本輪沒有啟動 Ollama daemon、沒有讀取真實 raw response、沒有下載／評估模型、沒有執行 Windows、live cloud provider、UI、封裝、真正 OS 斷網或 FR-021 完整 acceptance。deterministic scope 只涵蓋 fake／fixture response reader、錯誤分類與 cleanup ordering；live Ollama／模型品質、Windows／OS stream implementation 的差異均留在剩餘風險，不能由本報告宣稱已驗收。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 BUG-056 獨立審查結論為有條件通過：readStreamingJson() 的正常 EOF／failure cleanup 與原始錯誤保留均經 source、focused／完整回歸及 fault-injection probe 證實，其他 provider 未見 deterministic 回歸；但 08-CHANGE-LOG 尚未完成審查欄位與 closeout，且 automated lifecycle probe 尚未直接注入 releaseLock failure，因此完成 final gate 並補上該 deterministic regression assertion 前，不得視為無條件通過。**
- 阻擋問題（若有）：
  - B1（治理 closeout blocker）：`docs/project-management/08-CHANGE-LOG.md:3-16` 仍為「進行中」，缺少 validator 要求的「獨立審查是否執行」與「發布授權」欄位；`npm run docs:check:final` 已於 `2026-10-22T10:57:03+08:00` exit 1。主要代理必須在不覆寫本報告的前提下完成 BUG-056 工作條目、連結本報告並重新執行 final gate。
  - B2（測試證據 blocker，非目前產品邏輯 defect）：`scripts/test-ai-providers.mjs` 尚未把 `releaseLock()` rejection 固定成 automated regression case。主要代理應補上至少一個 failure path 的 release failure assertion，並保留原始 `ollama_stream_invalid_encoding`／`network_error`／外部取消 reason；補測後若只改測試，應依治理規則判斷是否需要 round2 複審。
- 剩餘風險：沒有 live Ollama raw response、不同 Ollama／model 版本、模型品質、Windows 或實際 OS stream evidence；沒有做真正斷網，也沒有完成 FR-021 整體驗收。非 strict provider 的 replacement-capable 行為只由 deterministic compatibility fixture 保護。`reader.cancel()` 若永久不 settle 的 hanging behavior 不在本輪 probe 的有界測試範圍內；目前程式是 await cancel 後才 release，若未來要承諾對 hang 具上限，需另立需求與測試。
- 給主要開發代理的具體修正要求（若有）：
  1. 補入 `releaseLock()` throw 的 deterministic lifecycle assertion，至少覆蓋 decoder／reader failure 其中一條，並確認原始錯誤與 release 呼叫計數均保留。
  2. 更新 BUG-056 的 `08-CHANGE-LOG.md` 狀態、獨立審查欄位與本報告逐字結論引用，然後重跑 `node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`npm run check`、`git diff --check` 與 `npm run docs:check:final`。
  3. 不要把本輪 deterministic pass 擴大宣稱為 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整 acceptance。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
