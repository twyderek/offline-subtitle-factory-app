# 獨立審查報告：Ollama malformed NDJSON 串流 fail-closed（BUG-054）

- 審查對象 commit／版本：目前工作樹（`package.json` 版本 `0.52.0`；BUG-054 程式與測試差異以 `git diff` 相對目前 `HEAD` 檢查）
- 對應 08-CHANGE-LOG 條目：2026-10-21 — Ollama malformed NDJSON 串流 fail-closed（BUG-054）
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-10-21T15:22:09+08:00（Asia/Taipei；同一審查角色的獨立複審上下文，重新讀取目前工作樹、round1 原件、治理 validator 與指定 source／tests）
- 審查範圍：核對 BUG-054 程式／測試 scope、目前 `08-CHANGE-LOG.md` 最新條目、round1 報告內容／SHA-256，並重跑 focused tests、boundary probe、完整 `npm run check`、`git diff --check` 與 `npm run docs:check:final`。未修改 round1 原件、程式碼、測試、治理來源文件或既有 evidence。

## 1. 需求完整性

- 判定：通過
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:3-26` 最新 BUG-054 已標示「完成」，仍保留 `BUG-054`、`FR-008`、`FR-010`、`FR-021`、`NFR-005`、成功條件、非 Ollama／timeout／取消／正常 stream 邊界與不在範圍事項。
  - `docs/project-management/08-CHANGE-LOG.md:17-18` 已補實際修改與開發驗證；`08:19-25` 已補 round1 執行狀態、round1 報告鏈結／逐字引用、條件接受、發布授權不適用與部署結果。
  - `docs/project-management/03-FUNCTIONAL-DESIGN.md:149`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-10`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 與目前程式／測試仍一致：Ollama native HTTP 200 NDJSON 任一非空 malformed record 必須在 parser／repair 前成為不可重試的 `ollama_stream_invalid_json`。
  - `08:21-22` 的 round1 引用文字與 round1 報告原件中的完整結論句逐字相同；獨立 inline comparison 於 2026-10-21T15:21:06+08:00 輸出 `quotesEqual: true`。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `lib/ai/openai-compatible.mjs:33-57` 仍以 `strictJson` opt-in 逐一 parse 非空 NDJSON line；strict path 任一 parse failure 立即建立 `AiProviderError`，code 由 Ollama 傳入為 `ollama_stream_invalid_json` 且 `retryable=false`，不加入合併結果。
  - `lib/ai/openai-compatible.mjs:60-76` 與 `79-141` 仍將 stream options 傳到 reader／fallback reader，並保留 response headers、body idle timeout、取消、HTTP error 與既有非 strict default 行為。
  - `lib/ai/providers.mjs:50-107` 仍只有 Ollama native path 啟用 strict framing；BUG-053 的明確 `error` 仍在回傳 normalized choices 前轉成 `ollama_stream_error`、`retryable=false`。
  - `lib/ai/subtitle-optimizer.mjs:317-335` 只重試 `retryable` error；`343-349` 不把 `ollama_stream_invalid_json`／`ollama_stream_error` 列入 repair；`460-496` 仍只在 validation 成功後呼叫 checkpoint。round2 focused suites 實際再次驗證此控制流。

## 3. 邊界情況

- 判定：通過（deterministic／fixture scope）
- 證據：
  - `scripts/test-ai-providers.mjs:137-159` 與 `scripts/test-ollama-batch-stream.mjs:63-85` 再次覆蓋正常三段串流、malformed-only、合法片段前後 malformed；malformed case 實際保持 `ollama_stream_invalid_json`、不可重試、單次 request、無 repair／checkpoint。
  - `scripts/test-ai-providers.mjs:160-179` 與 `scripts/test-ollama-batch-stream.mjs:40-61` 再次覆蓋共用 transport 預設非 strict、BUG-053 單筆 provider error 與部分 content 後 provider error。
  - `scripts/test-ai-providers.mjs:181-214` 與 `scripts/test-ollama-batch-stream.mjs:87-112` 再次覆蓋 chunk idle timeout、延遲 headers、timeout 延長 retry；結果均通過。
  - 2026-10-21T15:22:06+08:00 round2 inline boundary probe 實際確認取消 abort 傳播且不被誤分類為 `ollama_stream_invalid_json`，並確認 default non-strict stream 在 malformed line 後保留合法 content，exit 0。
  - 未涵蓋風險仍未被擴大宣稱：真實 Ollama endpoint／模型品質、不同模型／版本、真正斷網、Windows、UI、封裝與發布；`08:9-12,26` 明確將其排除或列為剩餘風險。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - 目前 tracked diff 的 BUG-054 程式／測試範圍仍限於 `lib/ai/openai-compatible.mjs`、`lib/ai/providers.mjs`、`scripts/test-ai-providers.mjs`、`scripts/test-ollama-batch-stream.mjs` 與既有 optimizer／治理同步；未見 round1 後新增的產品邏輯旁路。
  - strict mode 是共用 transport 的 opt-in，provider-specific code 只傳入固定 error code；既有 `AiProviderError` 欄位與非 strict default 沿用，責任邊界仍清楚（`openai-compatible.mjs:10-19,33-76`；`providers.mjs:61-104`）。
  - 2026-10-21T15:21:05+08:00 的四個 `node --check` 指令均 exit 0；2026-10-21T15:21:34+08:00 `git diff --check` exit 0。
  - round1 原件不是由 round2 覆寫：round2 建立前 `sha256sum` 為 `31d3b13c005431d85a53aa0415380a759a20a3a7203dbfdf9fdd9f6eb29c7391`，建立 round2 報告後將再核對相同 SHA。

## 5. 測試覆蓋

- 判定：部分通過（程式與 deterministic coverage 通過；final gate 仍被 round1 report schema 阻擋）
- 證據：
  - 2026-10-21T15:21:05+08:00 至 15:21:06+08:00：`node --check lib/ai/openai-compatible.mjs`、`node --check lib/ai/providers.mjs`、`node --check scripts/test-ai-providers.mjs`、`node --check scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-optimizer.mjs` 與 `node scripts/test-project-docs-validator.mjs` 均 exit 0；輸出包含 provider contract、Ollama streaming multi-batch、AI optimizer 與治理 validator 通過。
  - 2026-10-21T15:21:12+08:00 至 15:21:32+08:00：`npm run check` exit 0，包含 19 個治理文件、AI provider／optimizer、Ollama offline／UI／stream、核心與 YouTube suites。
  - 2026-10-21T15:21:34+08:00：`git diff --check` exit 0。
  - 2026-10-21T15:21:34+08:00 至 15:21:35+08:00：`npm run docs:check:final` exit 1；validator 明確指出 round1 報告缺少可識別的完整結論句與 `阻擋問題（若有）：` 欄位，且 08 引用不是 validator 解析出的最新報告完整結論句。這不是 round2 source／test failure，而是 round1 report schema／引用鏈結未完成。

## 6. 實際運行結果

- 判定：部分通過（程式實際運行通過；治理 final gate 未通過）
- 證據：
  - round2 focused provider／batch suites 以 mocked `fetch`／ReadableStream 實際執行 malformed-only、合法片段前後 malformed、正常多段、多批次、BUG-053 error、timeout 與 checkpoint／request count assertions；均 exit 0。
  - round2 inline boundary probe 以 AbortController 實際取消 Ollama stream，並以共用 `requestAiJson(..., streamResponse: true)` 實際驗證 default non-strict malformed-line compatibility；均 exit 0。
  - `npm run check` 於 2026-10-21T15:21:12+08:00 啟動並於 15:21:32+08:00 exit 0；未啟動真實 Ollama／LM Studio、未下載模型、未修改 OS／網路、未打包或發布。
  - `npm run docs:check:final` 的實際失敗可由 `scripts/project-docs-validator.mjs:12-33,51-73` 回溯：validator 只在 `## 綜合判定` 內辨識 `- 可逐字引用的完整結論句：**...**`（或相容的 `- 判定範圍：...`）與精確 `- 阻擋問題（若有）：`；round1 原件目前 `:77` 使用 `- 阻擋問題：`，`:86` 的引用句也未以該 bullet label 開始。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 BUG-054 round2 複審結論為有條件通過：BUG-054 程式 scope、Ollama native HTTP 200 NDJSON malformed fail-closed 行為、BUG-053 provider error、正常 stream、timeout／取消與預設非 strict transport 均維持，focused／完整 check／boundary probe 與 git diff --check 均 exit 0，08 最新條目狀態與 round1 逐字引用內容一致且 round1 原件 SHA-256 未變，但 round1 報告 schema 未符合 validator（缺少可識別的 bullet 完整結論句與 `阻擋問題（若有）` 欄位），使 `npm run docs:check:final` 於 2026-10-21T15:21:34+08:00 至 15:21:35+08:00 exit 1；因此 round1 closeout condition 尚未完全解除，需將本 round2 報告鏈結及本句同步至 08 後重跑 final gate，且本結論不延伸為真實 Ollama、模型品質、LM Studio、UI、封裝、發布或 Windows 驗收。**
- 阻擋問題（若有）：round1 報告 schema／08 最新審查引用鏈結尚未通過 `npm run docs:check:final`；round2 報告本身已依 validator 相容格式建立，但本審查代理不得修改 08，故目前無法把 final gate 宣稱為 exit 0。
- 剩餘風險：deterministic／fixture 證據仍不替代真實 Ollama endpoint、模型品質、不同模型／版本、真正斷網、Windows、UI、封裝或發布驗收；LM Studio 仍僅為 compatibility／歷史範圍。
- 給主要開發代理的具體修正要求：將 08 最新 BUG-054 的審查檔案與逐字引用更新為本 round2 報告，保留 round1 原件與其歷史引用，再重跑 `npm run docs:check:final`；若 final gate exit 0 且引用正確，才可將本輪結論更新為通過。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- round1 報告原件未修改；round2 建立前已核對其 SHA-256 為 `31d3b13c005431d85a53aa0415380a759a20a3a7203dbfdf9fdd9f6eb29c7391`。
- 若上述聲明不實，本報告無效。
