# 獨立複審報告：BUG-056 Ollama strict reader cleanup

- 審查對象 commit／版本：工作樹目前 `c06d15e`（branch `codex/0.51-anthropic-claude`）；審查對象是該 commit 上的既有 dirty worktree，包含 BUG-056 與先前 Ollama parser／UTF-8 變更，以及既有未追蹤 evidence／reviews。
- 對應 08-CHANGE-LOG 條目：2026-10-22 — Ollama strict reader 失敗後釋放與取消（BUG-056）
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-10-22（Asia/Taipei）；本報告由獨立 context 啟動，重新執行 `npm run project:preflight -- --type=full`，依目前 source、測試、治理文件、round1 原件與本報告所列只讀指令判斷，未沿用主要代理的評價性摘要。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:7-17`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-10` 明確定義 BUG-056 的 deterministic contract：正常 EOF release lock；decoder／reader rejection／外部取消先 best-effort cancel 再 release；cleanup failure 不覆蓋原始錯誤；既有 invalid encoding、timeout／取消、transport 分類與 non-strict 行為不回歸。
- 證據：`docs/project-management/08-CHANGE-LOG.md:12-14` 將 scope 限定為 `lib/ai/openai-compatible.mjs`、`scripts/test-ai-providers.mjs` 及 03／06／07／08 與本輪 review；不在範圍包括 endpoint、request body、repair／retry policy、其他 provider policy、LM Studio、UI、封裝、真實模型品質／斷網／Windows 驗收與發布。這與 `lib/ai/openai-compatible.mjs:74-127` 的 reader cleanup 變更及 `lib/ai/providers.mjs:61-100` 僅由 Ollama native path 傳入 strict options 的設計相符。工作樹另有 `providers.mjs`、optimizer 與 batch suite 的既有 dirty 變更；本報告不把那些先前變更誤歸為 BUG-056 round2。

## 2. 邏輯正確性

- 判定：通過
- 證據：`lib/ai/openai-compatible.mjs:95-120` 以 `completed=false` 作為 failure default，只有 reader EOF、strict decoder EOF flush 與 `mergeStreamingRecords()` 完成後才設為 `true`；因此正常 EOF 不進 failure cancel，而 decoder failure、reader rejection、strict framing failure 或外部 abort 均進 failure cleanup。
- 證據：`lib/ai/openai-compatible.mjs:121-126` 在 failure path 先 `await reader.cancel()` 並個別捕捉例外，再個別呼叫 `reader.releaseLock()` 並捕捉例外；cleanup exception 不會覆蓋原始串流錯誤。`lib/ai/openai-compatible.mjs:180-186` 仍將一般 reader／transport exception 分類為可重試 `network_error`，外部 signal 已 aborted 時保留原始 reason，`AiProviderError` 亦直接保留。
- 證據：`lib/ai/providers.mjs:94-100` 只由 Ollama native path 啟用 `strictJson`、`strictEncoding` 與 Ollama-specific error codes；其他 provider 的共用 transport 未因 BUG-056 放寬或強制 strict reader policy。

## 3. 邊界情況

- 判定：通過
- 證據：`scripts/test-ai-providers.mjs:186-201` 實際驗證正常 EOF 的 `cancel=0`、`release=1`；`scripts/test-ai-providers.mjs:202-216` 驗證 decoder invalid byte 的 cancel／release 各一次與 invalid-encoding error；`scripts/test-ai-providers.mjs:217-231` 的正式 automated regression fake reader 讓 `cancel()` 與 `releaseLock()` 都 throw，仍驗證 `network_error`、`retryable=true` 與 release 呼叫計數為 1。這直接解除 round1 B2「未注入 releaseLock failure」條件。
- 證據：`scripts/test-ai-providers.mjs:232-252` 驗證外部取消時 cancel／release 各一次且 `external reader cancel` reason 保留；`scripts/test-ai-providers.mjs:172-184` 保留 invalid byte 與 truncated UTF-8 的 `ollama_stream_invalid_encoding`；`scripts/test-ai-providers.mjs:253-301` 保留 strict 無 byte reader、non-strict malformed／invalid UTF-8 相容性，以及 fallback abort／timeout／transport 分類。
- 證據：本輪另執行不落檔 fault-injection probe（2026-10-22 11:00 Asia/Taipei），對 invalid encoding、network rejection、external abort 三案均讓 `cancel()` 與 `releaseLock()` 同時 throw；輸出為 `{"result":"pass","cases":["invalid encoding preserved across cancel/release failure","network error preserved across cancel/release failure","abort reason preserved across cancel/release failure"]}`，exit 0。此為本輪驗證證據，不是新增的產品檔或 evidence 檔。

## 4. 程式碼品質

- 判定：通過
- 證據：cleanup 邏輯集中在 `readStreamingJson()` 的完成旗標與兩個獨立 best-effort guard（`lib/ai/openai-compatible.mjs:95-126`），沒有用廣泛 catch 改寫 provider error；strict behavior 仍以 `streamOptions` opt-in 傳遞，避免改變共用 non-strict transport。
- 證據：BUG-056 08 條目的預計影響檔案（`docs/project-management/08-CHANGE-LOG.md:14`）與實際 BUG-056 行為 scope 一致；目前 dirty worktree 的其他 modified source／tests 具有先前 BUG-055／Ollama parser 脈絡，沒有在本輪被覆寫。round1 原件 `docs/project-management/reviews/2026-10-22-ollama-reader-cleanup-round1.md` 仍存在，round2 報告為新檔，不覆蓋既有 review 或 evidence。

## 5. 測試覆蓋

- 判定：通過
- 證據：本輪實際執行並均 exit 0：`node scripts/test-ai-providers.mjs`（AI provider contract 與術語／Prompt 測試通過）、`node scripts/test-ollama-batch-stream.mjs`（Ollama streaming multi-batch test passed）、`node scripts/test-ai-optimizer.mjs`（AI 字幕優化測試通過），以及上列不落檔 releaseLock fault-injection probe。
- 證據：`npm run check` 實際 exit 0，包含 `docs:check`（19 個治理文件）、全套 syntax、`npm test`、Ollama offline／UI／batch stream、核心 regression 與 YouTube suites；`git diff --check` 實際 exit 0。focused／完整回歸共同保留 invalid encoding、network、abort 與 non-strict compatibility 覆蓋。
- 證據：B2 的正式 automated regression 已直接存在於 `scripts/test-ai-providers.mjs:219-231`，不是只依賴本輪外部 probe；round1 報告所指的 releaseLock failure test gap 已解除。測試仍是 fake reader／fixture scope，不是 live endpoint 或模型品質測試。

## 6. 實際運行結果

- 判定：部分通過
- 證據：本輪於 2026-10-22（Asia/Taipei）重新執行 `npm run project:preflight -- --type=full`、三個 focused suites、`npm run check`、`git diff --check`；前述 deterministic／完整 regression 結果均通過。`git status --short` 顯示既有 dirty worktree；本輪除建立本報告外未修改產品檔、既有 evidence 或 round1 報告。
- 證據：`npm run docs:check:final` 實際 exit 1，輸出為「08-CHANGE-LOG.md 的最新工作紀錄尚未標示為『完成』」及「最新一輪為有條件通過，但該輪條件未記錄為需求方已接受」。這與 `docs/project-management/08-CHANGE-LOG.md:3-25` 一致：BUG-056 仍為「進行中」、仍寫「最新結論待 round2」，尚未鏈結本 round2 報告、尚未放入本 round2 逐字結論與條件接受欄位。此治理 closeout 尚待主要代理處理，本獨立複審不修改 08。
- 證據：本輪未啟動真實 Ollama daemon／endpoint，未讀取真實 raw response，未下載或評估模型，未執行 Windows、UI、封裝、OS 斷網或 FR-021 完整驗收。現有結果只證明 fake／fixture reader 的 deterministic lifecycle、錯誤分類與 regression；不能擴大為 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 BUG-056 round2 獨立複審結論為有條件通過：round1 B2 的 automated releaseLock failure regression 已由 `scripts/test-ai-providers.mjs:219-231` 正式注入並通過，invalid encoding、network error 與外部 abort reason 均保留，正常 EOF／failure cleanup、non-strict compatibility 與完整 deterministic regression 未見產品邏輯 blocker；但 `08-CHANGE-LOG.md` 仍為「進行中」且 `npm run docs:check:final` exit 1，治理 closeout 與本輪條件接受仍待主要代理完成，因此目前不得宣稱無條件完成；本結論僅限 deterministic fake／fixture scope，不延伸為 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。**
- 阻擋問題（若有）：
  - B1（治理 closeout blocker）：`docs/project-management/08-CHANGE-LOG.md:3-25` 尚未標示 BUG-056「完成」，尚未鏈結本 round2 報告／逐字結論，也未記錄最新 conditional round 的需求方接受；`npm run docs:check:final` 因此 exit 1。主要代理須完成該條目治理同步後重跑 final gate。
  - B2（round1 automated lifecycle blocker）：已解除。`scripts/test-ai-providers.mjs:219-231` 直接讓 `releaseLock()` throw 並斷言原始 `network_error` 保留；invalid encoding 與外部 abort 的既有 assertions 亦通過，且本輪補充 probe 進一步驗證三類原始錯誤在 cancel／release 同時失敗時保留。
- 剩餘風險：沒有 live Ollama raw response、不同 Ollama／model 版本、模型品質、Windows、UI、封裝、真正 OS 斷網或 FR-021 完整 acceptance 證據；`reader.cancel()` 永不 settle 的 hanging behavior 不在本輪有界 deterministic scope；non-strict provider 行為只由 fixture regression 保護。
- 給主要開發代理的具體修正要求（若有）：
  1. 在不修改本報告或 round1 原件的前提下，將本 round2 報告鏈結與本節完整結論句逐字同步至 BUG-056 的 `08-CHANGE-LOG.md`，補齊最新 round 的條件接受欄位並將狀態與實際結果一致化。
  2. 重跑 `npm run docs:check:final`；只有 final gate exit 0 後才可將 BUG-056 標示為治理上完成。
  3. 維持 deterministic scope，不宣稱 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
