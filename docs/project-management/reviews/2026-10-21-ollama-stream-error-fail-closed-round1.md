# 獨立審查報告：BUG-053 Ollama NDJSON 串流 provider error fail-closed

- 審查對象 commit／版本：工作樹 `HEAD=c06d15e95a2f0a0981518c5873003a460e57a5ee`、分支 `codex/0.51-anthropic-claude`、套件版本 `0.52.0`；本輪 BUG-053 差異尚未形成獨立 commit，以下以目前 dirty worktree 實況為準。
- 對應 08-CHANGE-LOG 條目：2026-10-21 — Ollama NDJSON 串流 provider error fail-closed（BUG-053）。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-21 13:32:58 +08:00 開始盤點；先執行 `npm run project:preflight -- --type=debug`，讀取 `AGENTS.md`、`docs/project-management/README.md`、`00-CURRENT-STATUS.md`、`08-CHANGE-LOG.md` 最新條目、debug 路由文件與本輪指定 source／test／治理文件。此為獨立審查上下文，未沿用主要開發代理對話記憶。
- 審查範圍：BUG-053 在 `lib/ai/providers.mjs`、`scripts/test-ai-providers.mjs`、`scripts/test-ollama-batch-stream.mjs` 及 `03`／`06`／`07`／`08` 的本輪差異；另只讀檢視 `lib/ai/openai-compatible.mjs`、`lib/ai/subtitle-optimizer.mjs` 以追溯 transport merge、retry／repair／checkpoint 控制流。工作樹中的 optimizer／其測試另有 BUG-052 既有 dirty 差異，未將其誤歸因為 BUG-053。

## 1. 需求完整性

- 判定：通過。
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:3-16` 將 BUG-053 成功條件限定為：原生 Ollama NDJSON HTTP 200 任一明確 `error` 保留診斷訊息、固定 code、不可降成 `empty_content`、不可進 JSON repair／retry／checkpoint，且正常串流、timeout／取消與既有 provider 不回歸；同段明確排除真實 endpoint、UI、封裝、發布與 LM Studio active 工作。
  - `docs/project-management/03-FUNCTIONAL-DESIGN.md:143-150` 明確要求 Ollama 原生 NDJSON 任一 record 的明確 error 在 parser／repair 前轉為不可重試 `ollama_stream_error`，即使已有部分 content 也不得解析、repair 或寫 checkpoint；`03:137` 同時維持共用 parser 與非本機 provider strict failure。
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-10`、`07-DEBUG-AND-FIX-HISTORY.md:3-9` 對現象、根因、修正、單筆／部分 content 後 error、正常串流與 deterministic scope 的描述一致。
  - 目前 08 條目仍是「進行中」，且沒有「獨立審查是否執行」與「發布授權」欄位；這是結案治理條件未完成，不是需求內容遺漏，已在綜合判定列為 blocker。

## 2. 邏輯正確性

- 判定：通過。
- 證據：
  - `lib/ai/providers.mjs:1` 匯入既有 `AiProviderError`；`providers.mjs:50-94` 只在 Ollama native port `11434` 使用原生 `/api/chat` 串流，未改 endpoint／request body 的既有契約。
  - `lib/ai/providers.mjs:95-103` 在 `requestAiJson(..., streamResponse: true)` 返回後、產生 OpenAI-compatible `choices` 之前檢查合併結果是否有非 `null`／`undefined` 的 own `error`，以最多 500 字 detail 建立 `AiProviderError`，固定 `code='ollama_stream_error'` 與 `retryable=false`；因此不會先產生空 `message.content` 再進 parser。
  - `lib/ai/openai-compatible.mjs:33-48` 的 streaming merge 會把 record 的 `error` 保留在合併結果；實際補做的 error-first 後續 content probe 於 2026-10-21 13:34:40 +08:00 仍收到 `ollama_stream_error`，證明 error 不會被一般後續 content 掩蓋。
  - `lib/ai/subtitle-optimizer.mjs:317-335` 只對 `error.retryable` 為 true 的例外 retry；`ollama_stream_error` 明確為 false。`subtitle-optimizer.mjs:460-489` 的 parser／repair 只在 provider optimize 已成功返回後執行；`subtitle-optimizer.mjs:491-497` 只在 validation 成功後呼叫 `onCheckpoint`，故 provider error 不會進 repair 或 checkpoint。
  - `lib/ai/providers.mjs:109-128` 保留其他 provider adapter；本輪只為 Ollama native stream 增加 error 分流，沒有改 LM Studio compatibility adapter。

## 3. 邊界情況

- 判定：通過。
- 證據：
  - `scripts/test-ai-providers.mjs:136-142` 實測正常三段 NDJSON content（含最後空 content done record）仍合併成 `{"cues":[]}`；`test-ai-providers.mjs:143-157` 實測單筆 HTTP 200 `{error:{message,code}}` 與「先有部分 JSON content、再有 error」兩案，均要求 `ollama_stream_error`，單筆案並斷言 `retryable=false`。
  - `scripts/test-ollama-batch-stream.mjs:10-38` 實測 3 批、每批 3 段延遲串流；`test-ollama-batch-stream.mjs:40-61` 以產品 optimizer path 實測部分 content 後 error，`streamErrorCalls=1`、`streamErrorCheckpoints=0`，且 error code／不可重試狀態保留。
  - `scripts/test-ollama-batch-stream.mjs:63-88` 實測 timeout 首次失敗後延長 timeout 重試一次並成功，確認正常 timeout retry 仍存在且未被 provider error fail-closed 改壞。
  - 2026-10-21 13:34:31 +08:00 的獨立 boundary probe 實測 Ollama 外部取消、Ollama timeout 與 LM Studio compatibility response；取消與 timeout 均受控拒絕，LM Studio 既有 JSON response 仍返回。
  - 2026-10-21 13:34:40 +08:00 的獨立 boundary probe 實測 error record 先出現、後續仍有 content 的合法 NDJSON；仍拒絕為 `ollama_stream_error`。未啟動真實 Ollama、未下載模型，因此不同 Ollama 版本／模型的未預期 error payload 仍是剩餘風險。

## 4. 程式碼品質

- 判定：通過。
- 證據：
  - BUG-053 的 runtime 改動集中在 `lib/ai/providers.mjs:1,95-103`，採用既有 `AiProviderError` contract，而非新增平行錯誤型別或把 provider-specific 判斷塞入共用 parser。
  - detail 先取 string、`message`、`detail`、`code` 或 JSON fallback，再以 `.slice(0, 500)` 限制輸出；固定 code／retryability 使下游分類可追溯，且不保存未界定長度的 provider payload。
  - 測試變更集中在 `scripts/test-ai-providers.mjs:143-157` 與 `scripts/test-ollama-batch-stream.mjs:40-61`，分別涵蓋 adapter contract 與產品 retry／checkpoint 邊界；沒有修改 endpoint、UI、封裝或既有 evidence／review。
  - `git diff --check` 於 2026-10-21 13:34:00 +08:00 exit 0，未發現 whitespace error。

## 5. 測試覆蓋

- 判定：通過（治理 final gate 另見第 6 節與綜合 blocker）。
- 證據：以下均在 `/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app` 實際執行，時間為 Asia/Taipei：

  | 時間 | 指令 | 實際結果 |
  |---|---|---|
  | 2026-10-21 13:33:27 | `node --check lib/ai/providers.mjs` | exit 0 |
  | 2026-10-21 13:33:29 | `node --check scripts/test-ai-providers.mjs` | exit 0 |
  | 2026-10-21 13:33:30 | `node scripts/test-ai-providers.mjs` | exit 0；`AI provider contract 與術語／Prompt 測試通過` |
  | 2026-10-21 13:33:32 | `node --check scripts/test-ollama-batch-stream.mjs` | exit 0 |
  | 2026-10-21 13:33:33 | `node scripts/test-ollama-batch-stream.mjs` | exit 0；`Ollama streaming multi-batch test passed.` |
  | 2026-10-21 13:33:35 | `node scripts/test-ai-optimizer.mjs` | exit 0；`AI 字幕優化測試通過` |
  | 2026-10-21 13:33:37–13:34:00 | `npm run check` | exit 0；`docs:check` 19 文件、AI provider／optimizer、Ollama offline／UI／stream、核心與 YouTube suites 均通過 |
  | 2026-10-21 13:34:00 | `git diff --check` | exit 0 |
  | 2026-10-21 13:34:02 | `npm run docs:check:final` | exit 1；最新工作紀錄缺少「獨立審查是否執行：」與「發布授權：」、未標示「完成」，且審查欄位不是是／否 |

  - 13:34:34 的第一版輔助 probe 因 shell quoting 產生字面 `\\n`、不是合法 NDJSON fixture 而 assertion fail；未採用其結果，改以 `String.fromCharCode(10)` 產生真實換行後於 13:34:40 重跑並通過。這不是產品測試失敗。
  - focused／完整測試均為 deterministic mock、offline fixture 或本機受控 regression；沒有把它們宣稱成真實 Ollama endpoint、模型品質、斷網或 FR-021 完整驗收。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：
  - 實際 source inspection 與上述指令結果確認：單筆 error、部分 content 後 error 均在 parser／repair 前轉成固定 provider error；product path 不 retry、不 repair、不 checkpoint；正常多段串流與 timeout retry 保留。
  - `npm run check` 的實際輸出包含 `AI provider contract 與術語／Prompt 測試通過`、`Ollama streaming multi-batch test passed.`、Ollama offline managed-child／UI／bundle contract tests、核心 regression 與 YouTube suites；完整命令 exit 0。
  - 取消／timeout／LM Studio 與 error-first 後續 content 的補做 probes 分別於 13:34:31 與 13:34:40 +08:00 通過；未啟動真實 Ollama／LM Studio、未下載模型、未修改 OS／網路、未打包、未發布、未推送。
  - 2026-10-21 13:34:02 +08:00 的 `npm run docs:check:final` 確實 exit 1。依 `docs/project-management/workflows/07-DOCUMENT-CLOSEOUT.md:9-14`，最新 08 條目應同步實際結果、獨立報告鏈結與結案欄位後再執行 final gate；目前不能把 BUG-053 宣稱為治理上已結案。

## 綜合判定

- 結論：有條件通過。
- 阻擋問題（若有）：
  1. `docs/project-management/08-CHANGE-LOG.md:3-16` 的 BUG-053 仍為「進行中」，缺少 final validator 要求的「獨立審查是否執行：」與「發布授權：」欄位，且尚未可解析地鏈回本報告並逐字引用本報告完整結論句。
  2. 主要代理須只補齊 BUG-053 08 條目的實際修改／開發驗證／獨立審查連結與逐字引用／發布授權不適用／部署結果／剩餘風險，將狀態改為符合實際結果後重跑 `npm run docs:check:final` 並取得 exit 0；不得修改本報告、既有 evidence 或既有 review。
  3. 本輪未發現需要修改產品 source 或測試的邏輯 blocker；上述是結案治理 blocker。
- 剩餘風險：
  - 沒有真實 Ollama raw response、不同 Ollama 模型／版本、真實 endpoint、真正斷網、Windows 實機或 FR-021 完整人工流程 evidence；deterministic／offline 測試不代表 live provider 成功或模型品質。
  - 本輪契約只處理 HTTP 200 NDJSON record 的明確 `error` 欄位；HTTP／transport 失敗、malformed NDJSON、其他供應商特有錯誤形狀仍由既有 transport／provider 行為處理，未擴大本 BUG 範圍。
  - LM Studio runtime／registry／deterministic compatibility tests 仍保留作相容性／歷史追溯；本輪未將其改為 active target，也未作其實機驗收。
- 給主要開發代理的具體修正要求（若有）：只需完成上述 BUG-053 08 結案欄位、報告鏈結／逐字引用與 final gate；不要為解除條件而啟動真實 Ollama、下載模型、改 OS／網路、修改 parser／endpoint、修改既有 evidence／review，或把 deterministic 結果擴大宣稱為 FR-021 完整通過。
- 可逐字引用的完整結論句：**本輪 BUG-053 獨立審查結論為有條件通過：Ollama 原生 NDJSON HTTP 200 的單筆與部分 content 後明確 error 已在 parser／repair 前轉為 `ollama_stream_error`、`retryable=false`，focused／完整 deterministic 驗證及 timeout／取消／既有 provider 邊界均通過且未發現產品邏輯 blocker，但 `08-CHANGE-LOG.md:5` 仍為「進行中」、缺少 final validator 要求的「獨立審查是否執行／發布授權」欄位，`npm run docs:check:final` 於 2026-10-21 13:34:02 +08:00 exit 1，故完成 08 結案同步並重跑 final gate exit 0 前不得宣稱 BUG-053 無條件完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告唯一寫入路徑為 `docs/project-management/reviews/2026-10-21-ollama-stream-error-fail-closed-round1.md`；未修改 source、test、治理來源文件、既有 evidence 或既有審查報告。
- 未啟動真實 Ollama／LM Studio、未下載模型、未修改 OS／網路、未打包、未發布或推送。
- 若上述聲明不實，本報告無效。
