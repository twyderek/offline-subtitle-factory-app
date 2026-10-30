# 獨立審查報告：Ollama NDJSON 無效 UTF-8 串流 fail-closed（BUG-055）

- 審查對象 commit／版本：`c06d15e95a2f0a0981518c5873003a460e57a5ee`／`offline-subtitle-factory@0.52.0`；審查時為 dirty worktree，僅針對目前工作樹自行讀取與驗證。
- 對應 08-CHANGE-LOG 條目：`2026-10-22 — Ollama NDJSON 無效 UTF-8 串流 fail-closed（BUG-055）`
- 審查輪次：round2（與 round1 同一審查角色；round1 僅作為 B1／B2 基線讀取，未沿用主要代理評價）
- 審查代理啟動時間、上下文來源：本獨立上下文；首個帶時間戳的本輪驗證為 `2026-10-22T09:07:31+08:00`。已讀取 `docs/project-management/workflows/04-INDEPENDENT-REVIEW.md`、BUG-055 的 03／06／07／08 條目、round1 報告與目前 dirty worktree source，未修改既有 round1。
- 審查範圍：`lib/ai/openai-compatible.mjs`、`lib/ai/providers.mjs`、`scripts/test-ai-providers.mjs`、`scripts/test-ollama-batch-stream.mjs`、`lib/ai/subtitle-optimizer.mjs` 的相關 optimizer 邊界，以及 03／06／07／08 與獨立審查 workflow。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/03-FUNCTIONAL-DESIGN.md:149` 已明確要求：Ollama strict decoder 對 invalid UTF-8／EOF 未完成 sequence 在 parser／repair 前產生 `ollama_stream_invalid_encoding`、`retryable=false`；無 raw-byte reader 時產生 `ollama_stream_encoding_unavailable`、`retryable=false`；fallback abort／timeout／transport rejection 保留既有分類；其他 provider 維持非 strict。
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-10` 與 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 已記錄 round2 要求與 focused coverage；`08-CHANGE-LOG.md:11-16` 也列出相同成功條件與驗證計畫。
  - 目前產品契約已由 source、provider flags 與 deterministic tests 覆蓋；但 `docs/project-management/08-CHANGE-LOG.md:3-16` 仍是「進行中」，缺少必要的「獨立審查是否執行：」與「發布授權：」欄位，因此治理結案要求尚未完整滿足。這也由 `npm run docs:check:final` 在 `2026-10-22T09:08:49+08:00` 實際回報並以 exit 1 證實。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `lib/ai/openai-compatible.mjs:74-89` 已將 strict fallback 的 `await response.arrayBuffer()` 放在 decoder `try` 之外（`:81`）；`:83-87` 的 try 只包含 fatal `TextDecoder.decode(bytes)`，因此只有 decoder failure 映射為 `invalidEncodingError()`。round1 B1 已解除。
  - `lib/ai/openai-compatible.mjs:76-80` 在 strict response 沒有 `body.getReader()` 且沒有 `arrayBuffer()` 時直接建立 `encodingUnavailableError()`，不再呼叫 `response.text()`；`lib/ai/providers.mjs:94-100` 傳入 `encodingUnavailableCode: 'ollama_stream_encoding_unavailable'`。round1 B2 已解除。
  - reader path `lib/ai/openai-compatible.mjs:91-116` 使用 strict fatal decoder，逐 chunk 與 EOF flush 均捕捉 decoder failure；`mergeStreamingRecords()` 只在 decode 成功後執行。`requestAiJson()` 的既有分類仍在 `:170-176`：外部 signal error 原樣保留，timeout 轉 `timeout`／可重試，其他 rejection 轉 `network_error`／可重試。
  - `scripts/test-ai-providers.mjs:202-235` 與本輪直接 probe 均實測：fallback external cancel 不再變成 `probe_invalid_encoding`；timeout 為 `timeout`、`retryable=true`；transport rejection 為 `network_error`、`retryable=true`。

## 3. 邊界情況

- 判定：通過
- 證據：
  - 合法跨 chunk UTF-8：`scripts/test-ai-providers.mjs:160-171` 以 continuation byte 切 chunk，成功保留「跨 chunk UTF-8」；直接 probe 於 `2026-10-22T09:08:22+08:00` PASS。
  - invalid byte 與 truncated EOF：`scripts/test-ai-providers.mjs:172-184` 均要求 `ollama_stream_invalid_encoding`／不可重試；直接 probe 於同一時間戳均 PASS。
  - strict 無 byte reader：`scripts/test-ai-providers.mjs:186-190` 使用 `body:null`、只有 replacement-capable `text()` 的 response，要求 `ollama_stream_encoding_unavailable`／不可重試；直接 probe PASS，證明不回退 `text()`。
  - 非 strict 相容性：`scripts/test-ai-providers.mjs:192-201` 仍接受 malformed NDJSON 的既有寬鬆行為與 replacement-capable invalid bytes；直接 probe PASS。
  - malformed NDJSON 與 provider error：`scripts/test-ai-providers.mjs:144-158`、`:236-249` 覆蓋 malformed-only、合法片段前後 malformed、HTTP 200 provider error 與 partial content 後 provider error，均在 parser／repair 前受控失敗。
  - timeout／取消與 idle window：`scripts/test-ai-providers.mjs:202-223`、`:251-281` 覆蓋 fallback cancellation／timeout、chunk idle timeout 與 delayed headers；均通過。
  - optimizer 邊界：`scripts/test-ollama-batch-stream.mjs:40-112` 實測 provider error、malformed NDJSON、invalid UTF-8 都只呼叫一次且 checkpoint 次數為 0；`lib/ai/subtitle-optimizer.mjs:317-335` 只有 `error.retryable` 才進 retry，`:343-349` 的 repair 條件不包含 strict framing codes，成功 checkpoint 僅在 `:491-497`。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - strict encoding 是 `streamOptions.strictEncoding` opt-in（`lib/ai/openai-compatible.mjs:74-92`），非 strict 仍走既有 `response.text()`／非 fatal decoder，未把 Ollama byte policy 擴散到其他 provider。
  - error code 透過 `invalidEncodingCode`／`encodingUnavailableCode` 注入（`lib/ai/openai-compatible.mjs:60-72`），Ollama native adapter 明確指定兩個 code（`lib/ai/providers.mjs:94-100`），責任邊界清楚。
  - B1 修正只縮小 exception scope，沒有把 transport rejection 混入 decoder error；B2 修正以顯式 capability error 取代不安全 fallback，沒有改 endpoint、request body 或 repair policy。
  - `git diff --check` 於 `2026-10-22T09:07:32+08:00` exit 0；目前 source／tests 的 `node --check` 同一驗證批次均 exit 0。

## 5. 測試覆蓋

- 判定：通過
- 證據：
  - `2026-10-22T09:07:31+08:00`：`node --check lib/ai/openai-compatible.mjs`、`node --check lib/ai/providers.mjs`、`node --check scripts/test-ai-providers.mjs` exit 0；`2026-10-22T09:07:32+08:00`：`node --check scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-optimizer.mjs`、`git diff --check`、`node scripts/test-project-docs-validator.mjs` 均通過。
  - `npm run docs:check` 於 `2026-10-22T09:07:32+08:00` 通過，回報「專案治理文件檢查通過：19 個文件，版本 0.52.0」。
  - 直接 boundary probe 於 `2026-10-22T09:08:22+08:00` 全部 PASS：valid cross-chunk、invalid UTF-8、truncated EOF、non-strict、strict no byte reader、external cancel、strict fallback timeout、strict fallback transport rejection。
  - `npm run check` 於 `2026-10-22T09:08:25+08:00` 開始、`2026-10-22T09:08:46+08:00` exit 0；完整 docs check、全部 node syntax checks、`npm test` 與 posttest YouTube tests 均通過。
  - `npm run docs:check:final` 於 `2026-10-22T09:08:49+08:00` exit 1，失敗原因是最新 08 條目的治理結案欄位／狀態，不是 source 或 focused test failure。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 實際執行 deterministic provider product path：`createProvider({ provider: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1' }).optimize(...)` 的正常 NDJSON、malformed、invalid byte、truncated EOF、provider error 與 no-byte-reader cases 均得到預期 code；結果由 `scripts/test-ai-providers.mjs:137-281` 實測並於 `2026-10-22T09:07:31-32+08:00` 通過。
  - 實際執行 optimizer product path：`optimizeSubtitleCues(...)` 的 multi-batch、provider error、malformed、invalid UTF-8、timeout retry cases 均通過；invalid／malformed／provider error 均無 retry／repair／checkpoint，見 `scripts/test-ollama-batch-stream.mjs:9-139`，於 `2026-10-22T09:07:32+08:00` 通過。
  - 實際執行完整 `npm run check` 並 exit 0；沒有啟動真實 Ollama daemon、下載模型、執行 UI／封裝、Windows、真正斷網或 FR-021 完整 acceptance，因此 deterministic runtime result 不能等同 live endpoint acceptance。

## 綜合判定

- 結論：有條件通過。round1 的 B1／B2 均已解除：B1 由 `lib/ai/openai-compatible.mjs:81-89` 將 byte read 移出 decoder try，且 `:170-176` 保留取消／timeout／transport 分類；B2 由 `:80` strict no-byte-reader 明確 fail-closed，並由 `lib/ai/providers.mjs:94-100` 傳入 `ollama_stream_encoding_unavailable`。focused tests、直接 boundary probes 與完整 `npm run check` 均支持 BUG-055 產品邏輯在目前 deterministic 範圍內成立；未能無條件通過的唯一阻擋是 08 工作紀錄尚未完成治理 closeout。
- 阻擋問題（若有）：有，治理結案阻擋：`docs/project-management/08-CHANGE-LOG.md:3-16` 的 BUG-055 仍為「進行中」，且缺少「獨立審查是否執行：」與「發布授權：」欄位；`npm run docs:check:final` 於 `2026-10-22T09:08:49+08:00` 以 exit 1 實際確認。B1／B2 不再是阻擋。
- 剩餘風險：尚無真實 Ollama raw response、不同模型／版本、Windows、UI、封裝、真正斷網或 FR-021 整體驗收證據；reader decode failure 後的 reader release／cancel 亦未由本輪專門 probe 驗證。非 strict provider 仍保留 replacement-capable 相容行為，這是既定範圍而非本輪回歸。
- 給主要開發代理的具體修正要求（若有）：只需依治理格式補齊 `docs/project-management/08-CHANGE-LOG.md` 的 BUG-055 結案欄位，標示獨立審查已執行並連結本報告、填寫發布授權／不發布的明確狀態，更新完成狀態與實際驗證摘要；不得覆寫 round1。完成後重跑 `npm run docs:check:final`，確認 exit 0；若另行改動產品邏輯，應再依 workflow 產生新的審查輪次。
- 可逐字引用的完整結論句：**本輪 BUG-055 round2 結論為有條件通過：round1 B1／B2 均已解除，strict Ollama invalid UTF-8／truncated EOF／no-byte-reader 已在 parser／repair 前以不可重試錯誤 fail-closed，fallback abort／timeout／transport rejection 保留既有分類；但 08-CHANGE-LOG 尚未完成治理 closeout，故目前不能無條件通過。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
