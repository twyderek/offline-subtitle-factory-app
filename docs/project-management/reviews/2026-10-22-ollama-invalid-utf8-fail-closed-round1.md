# 獨立審查報告：Ollama NDJSON 無效 UTF-8 串流 fail-closed（BUG-055）

- 審查對象 commit／版本：`c06d15e95a2f0a0981518c5873003a460e57a5ee` 上的 dirty worktree；branch `codex/0.51-anthropic-claude`；package version `0.52.0`。本報告評估目前工作樹，不把未提交差異當成已提交版本。
- 對應 08-CHANGE-LOG 條目：2026-10-22 — Ollama NDJSON 無效 UTF-8 串流 fail-closed（BUG-055），`docs/project-management/08-CHANGE-LOG.md:3-16`
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-22T09:02:03+08:00（Asia/Taipei；以第一個帶時間戳的驗證命令為準）。本輪為獨立上下文，只讀取目前 dirty worktree、BUG-055 相關治理／workflow／source／tests 並自行執行驗證，未沿用主要代理的評價。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/03-FUNCTIONAL-DESIGN.md:145-153` 將 Ollama native NDJSON 的 invalid UTF-8、EOF 未完成 byte sequence、`ollama_stream_invalid_encoding`、不可重試及 parser／repair 前 fail-closed 寫入設計；`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-10` 與 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 也明確列出有效跨 chunk、malformed NDJSON、provider error、timeout／取消及 optimizer 邊界。
  - `lib/ai/providers.mjs:61-112` 只在 Ollama native path 傳入 `strictJson=true`、`strictEncoding=true` 與指定錯誤碼；`lib/ai/openai-compatible.mjs:82-106` 對有 reader 的串流使用 fatal decoder，並在 EOF `decoder.decode()` flush。
  - `lib/ai/openai-compatible.mjs:69-79` 的 strict fallback 在有 `arrayBuffer()` 時也使用 fatal decode，但同一分支對 `arrayBuffer()` 讀取失敗的所有非 `AiProviderError` 例外都轉成 encoding error；這使 timeout／取消的既有契約不完整。另在沒有 `arrayBuffer()` 時，`lib/ai/openai-compatible.mjs:69-71` 仍回到 `response.text()`，無法保證 strict path 對 byte-level invalid UTF-8 fail-closed；此殘餘風險也被 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:10` 明載。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - 正常 Fetch reader path 的順序正確：`TextDecoder('utf-8', { fatal: strictEncoding })` 位於 `lib/ai/openai-compatible.mjs:81-92`，EOF flush 位於 `:98-103`，`mergeStreamingRecords()` 只在 `:106` 執行；因此 invalid byte／truncated sequence 在 NDJSON merge 前就會建立 `AiProviderError`。`lib/ai/providers.mjs:94-107` 指定 `ollama_stream_invalid_encoding` 與 `retryable=false`。
  - optimizer 的 retry gate `lib/ai/subtitle-optimizer.mjs:317-335` 只有 `error.retryable` 為 true 才重試；local JSON／empty-content repair 條件在 `:343-349`，不包含 `ollama_stream_invalid_encoding`；checkpoint 只在成功 validation 後 `:491-497` 執行。因而 reader path 的 invalid encoding 確實不會進 retry／repair／checkpoint。
  - 阻擋的 fallback 邏輯位於 `lib/ai/openai-compatible.mjs:73-79`：`await response.arrayBuffer()`、fatal `decoder.decode()` 與 `mergeStreamingRecords()` 共用一個 `try`。我於 2026-10-22T09:03:38+08:00 執行自製 deterministic probe，讓 fallback `arrayBuffer()` 在 request signal abort／timeout 時 rejection；實際輸出為 `{"externalCancel":{"errorCode":"probe_invalid_encoding","errorMessage":"AI 串流回應包含無效 UTF-8","retryable":false,"fetchAborted":true}}` 及 `{"timeout":{"errorCode":"probe_invalid_encoding","errorMessage":"AI 串流回應包含無效 UTF-8","retryable":false,"fetchAborted":true}}`。這不是 encoding failure，且錯誤已在 `requestAiJson()` 的 `lib/ai/openai-compatible.mjs:160-165` 被視為 `AiProviderError`，無法回復為取消／timeout 或可重試網路錯誤。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 2026-10-22T09:02:04+08:00 的 `node scripts/test-ai-providers.mjs` 實測通過：正常 NDJSON、多段合法跨 chunk UTF-8（`scripts/test-ai-providers.mjs:160-171`）、invalid byte（`:172-177`）、EOF truncated final sequence（`:179-184`）、非 strict malformed／invalid UTF-8 相容性（`:186-195`）、單筆與部分 content 後 provider error（`:196-209`）。
  - 2026-10-22T09:02:04+08:00 的 `node scripts/test-ollama-batch-stream.mjs` 實測通過：invalid encoding 只呼叫一次、`retryable=false`、無 checkpoint（`scripts/test-ollama-batch-stream.mjs:87-112`）；同套件也覆蓋 malformed NDJSON、provider error、正常 stream 與 timeout retry（`:40-85`, `:114-139`）。
  - 2026-10-22T09:03:07+08:00 的直接 probe 另實測 split invalid continuation、EOF truncation、`arrayBuffer()` strict fallback、非 strict compatibility 與 reader path cancellation，均符合預期；但 09:03:38 的 fallback abort／timeout probe 暴露上述分類錯誤。
  - 2026-10-22T09:04:50+08:00 的直接 no-`arrayBuffer()` probe 實際返回 `{"content":"replacement-�","accepted":true}`，證明 strict flag 在此 response shape 仍接受 replacement text；另未見 reader 在 decoder failure 後明確 `cancel()`／`releaseLock()` 的專門回歸測試。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - strict encoding 是 opt-in，參數沿 `requestAiJson()` → `readStreamingJson()` 傳遞（`lib/ai/openai-compatible.mjs:67-109, 136-140`），其他 provider 的 `createChatCompletion()` 未傳 strict options（`:186-187`），因此預設非 strict 行為沒有被全域改寫。
  - `AiProviderError` 的 code／retryable 欄位使用既有型別（`lib/ai/openai-compatible.mjs:10-18`），Ollama adapter 的 provider error 與 invalid JSON／encoding 分流可讀且錯誤碼固定（`lib/ai/providers.mjs:94-107`）。
  - 主要品質問題是 exception scope 過寬：`arrayBuffer()` 的 transport、abort 或 timeout rejection 不應與 fatal decoder failure 共用 `invalidEncodingError()`；目前這會產生錯誤診斷與錯誤 retry policy。strict 無 byte-level API 時回退 `text()` 也使「strict」名稱與實際保證不一致。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-10-22T09:02:03+08:00–09:02:05+08:00 實際執行 `node --check lib/ai/openai-compatible.mjs`、`node --check lib/ai/providers.mjs`、`node --check scripts/test-ai-providers.mjs`、`node --check scripts/test-ollama-batch-stream.mjs`、兩個 focused tests、`node scripts/test-ai-optimizer.mjs`、`git diff --check`、`node scripts/test-project-docs-validator.mjs` 與 `npm run docs:check`，全部 exit 0。
  - 2026-10-22T09:02:31+08:00–09:02:51+08:00 重跑 `npm run check`，明確 exit 0；輸出包含 AI provider／optimizer、Ollama offline／UI／stream、核心與 YouTube suites 全部通過。
  - 2026-10-22T09:04:18+08:00–09:04:19+08:00 執行 `npm run docs:check:final`，exit 1；validator 實際指出最新 08 條目缺少「獨立審查是否執行：」與「發布授權：」、尚未標示「完成」，且審查欄位不是是／否。此為主要代理尚未進行 closeout 同步的治理 blocker，本報告不代為修改 08。
  - 測試已實際覆蓋主要 reader path 的 byte、EOF、chunk、strict／非 strict、malformed、provider error、timeout／取消與 optimizer 控制流；但 repo tests 沒有覆蓋 strict `arrayBuffer()` fallback 的 abort／timeout／transport rejection，也沒有覆蓋 strict 無 `arrayBuffer()` 時拒絕 text fallback。因此完整 check 通過不能解除本報告的 fallback blocker。

## 6. 實際運行結果

- 判定：不通過
- 證據：
  - 2026-10-22T09:02:03+08:00 執行 `npm run project:preflight -- --type=full`，列出固定核心、全量任務路由與 dirty worktree；本輪未 reset、checkout、pull 或修改既有檔案。
  - 2026-10-22T09:02:04+08:00–09:02:05+08:00 focused／文件驗證通過；2026-10-22T09:02:51+08:00 `npm run check` exit 0；2026-10-22T09:03:07+08:00 直接 strict decoder boundary probe exit 0。
  - 2026-10-22T09:03:38+08:00 fallback abort／timeout probe 實際取得 `probe_invalid_encoding`、`retryable=false`，與應保留的 cancellation／timeout semantics 不符，故實際運行結果不能宣稱完整通過。
  - 本輪沒有啟動真實 Ollama endpoint、模型、UI、封裝或網路隔離驗收；所有通過結果均為 deterministic fixture／source 驗證，不等同真實 Ollama raw response、模型品質、Windows 或 FR-021 完整驗收。

## 綜合判定

- 結論：不通過。標準 Fetch reader path 已正確以 fatal UTF-8 decoder、EOF flush，在 parser／repair 前以 `ollama_stream_invalid_encoding`、`retryable=false` fail-closed；合法跨 chunk UTF-8、非 strict transport、malformed NDJSON、provider error、timeout／取消及 optimizer 的 retry／repair／checkpoint 控制在現有 deterministic tests 與直接 probe 中大致維持。但 strict `arrayBuffer()` fallback 將 abort／timeout／transport rejection 誤判為不可重試的 invalid encoding，且無 `arrayBuffer()` 時仍可回到 replacement-capable `text()`，因此 BUG-055 的完整 fail-closed／相容性契約尚未滿足。
- 阻擋問題（若有）：有，B1／B2 為產品邏輯阻擋；另有 08 final closeout 治理阻擋。
  - B1（阻擋）：修正 `lib/ai/openai-compatible.mjs:73-79` 的 exception scope，使只有 fatal `decoder.decode()` failure 轉成 invalid encoding；`arrayBuffer()` 的 abort／timeout／transport rejection 必須交由既有取消／timeout／network error 分類處理，並補上 focused regression tests。
  - B2（阻擋）：strict encoding 在沒有 `arrayBuffer()` 時不得靜默使用 `response.text()` 掩蓋 byte corruption；應採明確 fail-closed 的 byte-capability policy，並補測無 `body.getReader()`／無 `arrayBuffer()` 的 response shape。若產品 runtime 明確保證永遠是標準 Fetch Response，也必須在 code contract／測試中固定此前提，不可只把缺口列為未驗證風險。
- 剩餘風險：沒有真實 Ollama raw response、不同模型／版本、Windows、UI、封裝、真正斷網或 FR-021 整體驗收；reader failure 後的 stream cleanup 亦沒有本輪專門證據。`docs/project-management/08-CHANGE-LOG.md:3-16` 仍為「進行中」，本輪未代主要代理補寫結案欄位或獨立審查鏈結。
- 給主要開發代理的具體修正要求（若有）：先以最小差異修正 B1／B2，再重跑 `node --check`、provider／batch／optimizer focused tests、`npm run check`、`git diff --check`、source/doc validator；完成 08 結案同步後另行執行 `npm run docs:check:final`，若修正影響本結論，建立 round2，不得覆寫本報告。
- 可逐字引用的完整結論句：**本輪 BUG-055 獨立審查結論為不通過：標準 Fetch reader path 已正確以 fatal UTF-8 decoder、EOF flush，在 parser／repair 前以 `ollama_stream_invalid_encoding`、`retryable=false` fail-closed；但 strict `arrayBuffer()` fallback 將 abort／timeout／transport rejection 誤判為不可重試的 invalid encoding，且無 `arrayBuffer()` 時仍可回到 replacement-capable `text()`，因此完整 fail-closed／相容性契約尚未滿足。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
