# 獨立複審報告：BUG-058 Ollama strict abort before cancel round2

- 審查對象版本：目前工作樹 `0.52.0`；BUG-058 目標為 `lib/ai/openai-compatible.mjs`、`scripts/test-ai-providers.mjs`。
- 對應 08-CHANGE-LOG 條目：2026-10-28 — Ollama strict stream parser failure abort underlying request（BUG-058）。
- 審查輪次：round2。
- 審查代理啟動時間、上下文來源：2026-10-28（Asia/Taipei）；依 `offline-subtitle-factory-app/AGENTS.md`、`npm run project:preflight -- --type=full` 及其列出的固定核心／full 路由文件獨立啟動，並讀取 round1 原件。工作樹既有 dirty 變更已辨識並保留；本報告以目前工作樹實際內容與本輪指令結果為準。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-25` 將 BUG-058 限定為 strict parser／decoder `AiProviderError` failure 先 abort 同一 request signal，再進既有 250ms bounded cancel／release；同時要求保留 invalid encoding／invalid JSON、timeout／取消／`network_error` 分類，並排除 live endpoint、模型品質、Windows、OS 斷網與 FR-021 完整驗收。`docs/project-management/03-FUNCTIONAL-DESIGN.md:149` 與 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 的需求與修正描述一致。round1 B1 所要求的 parser-specific ordering 已在 `scripts/test-ai-providers.mjs:286-305` 直接補入，沒有擴大本輪範圍。

## 2. 邏輯正確性

- 判定：通過
- 證據：`lib/ai/openai-compatible.mjs:97-147` 以 `completed` 區分正常 EOF 與 failure；只有 failure error 是 `AiProviderError` 時，才在 `reader.cancel()` 前呼叫 request-local `abortStream`（:128-135），之後以 `STREAM_READER_CLEANUP_TIMEOUT_MS = 250`（:33、:137-145）等待 bounded cancel，最後嘗試 `releaseLock()`（:147）。`requestAiJson()` 在 :154-181 建立同一 request 的 `timeoutController` 並把 abort callback 傳給 reader。`scripts/test-ai-providers.mjs:296-305` 實際以 strict invalid-NDJSON parser failure 監聽 signal abort，再記錄 reader cleanup 事件，斷言事件正好為 `['abort', 'cancel', 'release']`；同一案例也斷言 `probe_invalid_json` 且 `retryable === false`。正常 EOF 的 `completed` path 不進 abort／cancel cleanup，timeout、外部取消與 reader transport error 則由既有分類路徑保留。

## 3. 邊界情況

- 判定：通過
- 證據：本輪實際檢視並執行的 fixture 覆蓋：`scripts/test-ai-providers.mjs:199-218` 驗證正常 EOF 不 cancel、必須 release、沒有 250ms timer 且 signal 不 abort；`:220-233` 驗證 strict decoder invalid UTF-8 的錯誤、cancel 與 release；`:234-248` 驗證 reader transport failure 即使 cleanup 失敗仍保留 `network_error`；`:249-285` 驗證 cancel 永不 settle 時只呼叫一次、固定 250ms bounded cleanup、仍 release 並保留原始錯誤及 abort signal；`:286-305` 直接驗證 strict invalid-NDJSON 的 `abort < cancel < release`；`:306-348` 驗證 reader timeout 保留 `timeout`、外部取消保留原始取消 reason 並完成 cancel／release；`:355-364` 驗證共用 transport 的 non-strict malformed／invalid UTF-8 compatibility；`:387-397` 驗證 strict fallback transport failure 保留 `network_error`；`:399-412` 驗證 Ollama provider error 與 partial content 後 provider error 不被改寫。

## 4. 程式碼品質

- 判定：通過
- 證據：變更集中於共用 streaming reader 的 request-local abort hook 與 provider deterministic fixture；250ms 常數集中於 `lib/ai/openai-compatible.mjs:33`，failure-only cleanup 與原始錯誤保留集中於 :124-147，request controller callback 於 :154-181 綁定單一 request。Ollama native adapter 僅在 `lib/ai/providers.mjs:93-98` 啟用 `strictJson`／`strictEncoding` 與 Ollama-specific error codes，未見 endpoint、request body、repair／retry policy 或其他 provider policy 的無關擴張。2026-10-28T10:34:17+08:00 執行 `node --check lib/ai/openai-compatible.mjs` 與 `node --check scripts/test-ai-providers.mjs` 均 exit 0；同日 `git diff --check` 於 10:33:23-10:33:24 exit 0。

## 5. 測試覆蓋

- 判定：通過
- 證據：2026-10-28T10:33:16-10:33:17 執行 `node scripts/test-ai-providers.mjs`，輸出 `AI provider contract 與術語／Prompt 測試通過`、exit 0；其中包含本輪新增的 parser-specific `abort < cancel < release` assertion。2026-10-28T10:33:18-10:33:19 執行 `node scripts/test-ollama-batch-stream.mjs`，輸出 `Ollama streaming multi-batch test passed.`、exit 0；2026-10-28T10:33:20 執行 `node scripts/test-ai-optimizer.mjs`，輸出 AI 字幕優化測試通過、exit 0。2026-10-28T10:33:28-10:33:49 執行 `npm run check`，治理檢查、完整 deterministic regression、Ollama offline／UI／stream、核心與 YouTube suites 全部通過、exit 0。2026-10-28T10:33:25 執行 `node scripts/test-project-docs-validator.mjs`，輸出治理文件驗證器測試通過、exit 0。測試證據仍是 fake／fixture，不是 live Ollama acceptance。

## 6. 實際運行結果

- 判定：部分通過
- 證據：本輪指定的三支 AI／Ollama scripts、`npm run check`、`git diff --check`、`node scripts/test-project-docs-validator.mjs` 與補充的兩支 `node --check` 均實際完成且通過；`npm run check` 的實際輸出包含 AI provider、AI optimizer、Ollama offline managed-child、Ollama offline UI、Ollama streaming multi-batch、核心回歸與 YouTube lifecycle suites 通過。2026-10-28T10:33:50+08:00 執行 `npm run docs:check:final` exit 1，實際錯誤為：`08-CHANGE-LOG.md` 最新工作紀錄尚未標示「完成」；工作紀錄判定不是最新審查報告完整結論句的逐字引用；最新一輪為有條件通過但條件未記錄為需求方已接受。因此程式／測試運行結果通過，但目前 08 closeout 尚未完成。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 BUG-058 round2 獨立複審結論為有條件通過：round1 B1 已解除，`scripts/test-ai-providers.mjs` 現已直接以 strict invalid-NDJSON fixture 斷言 `abort < cancel < release`，且 normal EOF no-abort、strict decoder abort、250ms bounded cleanup、reader timeout／external cancel／network error 分類與完整 deterministic 回歸均通過；但 2026-10-28T10:33:50+08:00 的 `npm run docs:check:final` 仍因 08 最新條目為「進行中」、未逐字採用最新報告且條件未記錄為需求方已接受而失敗，因此治理 closeout 尚未解除。本結論僅限 deterministic fake／fixture scope，不延伸為 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。**
- 阻擋問題（若有）：B1 已無阻擋；目前唯一阻擋是治理 closeout：主要代理仍需在 08 最新 BUG-058 條目記錄 round2 報告路徑與本報告完整結論句、將工作狀態與條件接受欄位同步為符合實際狀態，並重跑 `npm run docs:check:final`。本複審代理未修改 08，因使用者明確限定唯一可寫入檔案為本報告。
- 剩餘風險：所有本輪證據限 deterministic fake／fixture；沒有 live Ollama raw response、模型品質、不同模型／版本、Windows、UI、封裝、OS 斷網或 FR-021 完整驗收。abort 是 underlying request teardown 的 best-effort signal，不等同 live socket／stream 已完成物理回收；250ms bounded cleanup 只保護 caller 返回與 lock release latency，不證明 pending `reader.cancel()` 或底層資源已完成物理 teardown。
- 給主要開發代理的具體修正要求（若有）：保留本 round2 原件，將其路徑與完整結論句依治理 validator 格式同步到 BUG-058 的 08 條目，記錄條件是否已被需求方接受，再重跑 `npm run docs:check:final`；不得把本報告的 deterministic 結果擴大為 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
