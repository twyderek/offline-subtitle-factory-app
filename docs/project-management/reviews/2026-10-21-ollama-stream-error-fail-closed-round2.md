# 獨立審查報告：BUG-053 Ollama NDJSON 串流 provider error fail-closed

- 審查對象 commit／版本：目前工作樹 `HEAD=c06d15e95a2f0a0981518c5873003a460e57a5ee`、分支 `codex/0.51-anthropic-claude`、套件版本 `0.52.0`；BUG-053 仍未形成獨立 commit，以下以目前 dirty worktree 實況為準。
- 對應 08-CHANGE-LOG 條目：2026-10-21 — Ollama NDJSON 串流 provider error fail-closed（BUG-053）。
- 審查輪次：round2；同一審查角色對 round1 closeout condition 的複審。
- 審查代理啟動時間、上下文來源：2026-10-21 13:36:40 +08:00 執行 `npm run project:preflight -- --type=debug` 後開始複審；重新讀取 fixed core、debug／測試／獨立審查／結案流程、目前 08 最新 BUG-053、round1 原件、03／06／07 與目前 source／test。此為同一審查角色的新複審上下文，未修改或重用 round1 原件內容作為可變證據。
- round1 原件完整性：`docs/project-management/reviews/2026-10-21-ollama-stream-error-fail-closed-round1.md` 目前 SHA-256 為 `c218e65b69981e3520901c72d47a06a2058b7767fdc6fd65f563da49d522a9c3`；本輪未修改。

## 1. 需求完整性

- 判定：通過。
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:3-26` 現在將 BUG-053 標示為「完成」，補齊實際修改、開發驗證、round1 報告路徑、逐字引用、條件接受、發布授權不適用、部署結果與剩餘風險；`08:21-22` 的 round1 路徑與引用存在，且程式化比對於 2026-10-21 13:37:03 +08:00 通過。
  - `08:22` 的粗體結論與 round1 原件 `round1:88` 逐字一致；比對同時確認 08 明確鏈結 `docs/project-management/reviews/2026-10-21-ollama-stream-error-fail-closed-round1.md`。
  - `docs/project-management/03-FUNCTIONAL-DESIGN.md:149` 仍要求原生 NDJSON 任一明確 error 在 parser／repair 前成為不可重試 `ollama_stream_error`，部分 content 也不得解析、repair 或 checkpoint；`08:11-12` 的成功條件與不在範圍未被放寬。
  - `08:23-26` 明確保留 deterministic-only 界線、無真實 Ollama／FR-021 完整驗收宣稱，以及 model／version、斷網、Windows、malformed NDJSON、HTTP／transport failure、其他 error shape 與 LM Studio 相容性／歷史範圍風險。
  - round1 唯一 closeout condition 是 08 結案欄位與 final gate；本輪已由 `npm run docs:check:final` exit 0 實際解除。`06:9` 與 `07:8` 仍保留 round1 前「完整 check／獨立審查待完成」字樣，屬文件同步觀察，未改變 08 final validator 結果或本輪既定 scope。

## 2. 邏輯正確性

- 判定：通過。
- 證據：
  - `lib/ai/providers.mjs:50-107` 現行 Ollama native adapter 仍在 `requestAiJson(..., streamResponse: true)` 返回後檢查 `result` own `error`，以既有 `AiProviderError` 建立最多 500 字 detail、`code='ollama_stream_error'`、`retryable=false`；沒有把 provider error 轉成空 `message.content`。
  - `lib/ai/openai-compatible.mjs:33-48` 仍負責 NDJSON merge；`lib/ai/subtitle-optimizer.mjs:317-335` 只 retry `retryable=true`，`subtitle-optimizer.mjs:460-489` 的 parser／repair 位於 provider 成功返回之後，`491-497` 只在 validation 成功後 checkpoint。
  - `scripts/test-ai-providers.mjs:143-157` 與 `scripts/test-ollama-batch-stream.mjs:40-61` 重新執行通過；現行 product path 對單筆及部分 content 後明確 error 都保留 code／不可重試語意，且只呼叫一次、無 repair／checkpoint。
  - 2026-10-21 13:37:57 +08:00 的 round2 boundary probe 以合法 NDJSON partial content 後 error 實測 `ollama_stream_error`、`retryable=false`、request count 1，並另外驗證取消與 timeout 行為。

## 3. 邊界情況

- 判定：通過。
- 證據：
  - `scripts/test-ai-providers.mjs:136-142` 的正常多段 NDJSON（含 done record）仍合併為可用 content；`143-157` 的單筆 error 與部分 content 後 error 仍 fail-closed。
  - `scripts/test-ollama-batch-stream.mjs:10-38` 重跑三批、分段延遲正常 streaming；`40-61` 重跑 product optimizer path，`streamErrorCalls=1`、`streamErrorCheckpoints=0`；`63-88` 重跑 timeout retry，延長 timeout 後仍可重試成功。
  - `scripts/test-ai-optimizer.mjs` 重跑完整 optimizer／repair／cue／checkpoint regression；沒有把 Ollama stream error 變成 `empty_content` repair 的回歸。
  - round2 probe（13:37:57）實測 Ollama stream error、外部取消、timeout 與 LM Studio JSON compatibility response；四案均符合既有契約。
  - 未實測真實 Ollama、不同模型／版本或真正斷網；這些仍依 08:26 與 round1:84-86 揭露為剩餘風險，不被 deterministic fixtures 取代。

## 4. 程式碼品質

- 判定：通過。
- 證據：
  - round2 所核對的 runtime／test diff 仍局限於 `providers.mjs:1,95-103` 與兩個 Ollama focused test 區段；本輪沒有新增 source、test、endpoint、parser、UI、封裝或發布變更。
  - error detail 的固定 code／retryability、長度上限與既有 `AiProviderError` contract 仍清楚；retry／repair／checkpoint 的責任分層沒有被重新複製或繞過。
  - `git diff --check` 於 2026-10-21 13:37:32 +08:00 exit 0；round1 原件 SHA-256 與本輪開始時相同，未被覆寫。

## 5. 測試覆蓋

- 判定：通過。
- 證據：以下時間均為 Asia/Taipei，指令皆在 `/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app` 實際執行：

  | 時間 | 指令／操作 | 實際結果 |
  |---|---|---|
  | 2026-10-21 13:37:03 | 程式化讀取 08 與 round1 原件，核對 round1 link／粗體結論 | exit 0；逐字引用一致，round1 SHA-256 記錄如本報告標頭 |
  | 2026-10-21 13:37:08–13:37:09 | `node --check lib/ai/providers.mjs`、`node --check scripts/test-ai-providers.mjs`、`node --check scripts/test-ollama-batch-stream.mjs`、`node --check lib/ai/subtitle-optimizer.mjs`、`node --check scripts/test-ai-optimizer.mjs` | 全部 exit 0 |
  | 2026-10-21 13:37:08 | `node scripts/test-ai-providers.mjs` | exit 0；`AI provider contract 與術語／Prompt 測試通過` |
  | 2026-10-21 13:37:08 | `node scripts/test-ollama-batch-stream.mjs` | exit 0；`Ollama streaming multi-batch test passed.` |
  | 2026-10-21 13:37:09 | `node scripts/test-ai-optimizer.mjs` | exit 0；`AI 字幕優化測試通過` |
  | 2026-10-21 13:37:11–13:37:31 | `npm run check` | exit 0；治理 19 文件、核心 regression、AI provider／optimizer、Ollama offline／UI／stream、YouTube suites 均通過 |
  | 2026-10-21 13:37:32 | `git diff --check` | exit 0 |
  | 2026-10-21 13:37:34 | `npm run docs:check:final` | exit 0；`專案治理文件檢查通過：19 個文件，版本 0.52.0，最新紀錄已結案` |
  | 2026-10-21 13:37:57 | round2 boundary probe：partial content 後 error、cancel、timeout、LM Studio compatibility | exit 0；`round2 boundary probe passed` |

  - 2026-10-21 13:37:50 的第一版輔助 probe 在產品呼叫前因 shell／JavaScript nested quote 產生語法錯誤，未採用其結果；改用不含 nested quote 的合法 partial fixture 後於 13:37:57 exit 0。這不是產品測試失敗。

## 6. 實際運行結果

- 判定：通過。
- 證據：
  - 目前 08 最新條目已實際完成 round1 指定的結案欄位；程式化 link／quote 比對、focused tests、完整 `npm run check`、`git diff --check` 與 `npm run docs:check:final` 全部取得預期結果。
  - 完整 check 實際輸出包含 AI provider、AI optimizer、Ollama offline managed-child／UI／bundle／stream、核心 regression 與 YouTube suites 通過；沒有把任何 live Ollama 成功寫入證據。
  - round2 boundary probe 的取消、timeout、既有 LM Studio response 與部分 content 後 provider error 均由實際 mock transport 操作取得結果；沒有啟動真實 Ollama／LM Studio、下載模型、修改 OS／網路、打包、發布或推送。
  - round1 原件保留，08 使用其完整結論句而非重新改寫審查推理；round1 唯一治理 blocker 已由 final gate exit 0 證明解除。

## 綜合判定

- 結論：通過。
- 阻擋問題（若有）：無。本輪未發現 BUG-053 source／test 邏輯 blocker，也未發現 round1 closeout condition 尚未解除的證據。
- 剩餘風險：
  - 仍沒有真實 Ollama raw response、不同模型／版本、真實 endpoint、真正斷網、Windows 實機或 FR-021 完整人工流程 evidence；deterministic／offline tests 不等於 live provider 或模型品質驗收。
  - 契約仍只處理 HTTP 200 NDJSON 的明確 `error` 欄位；malformed NDJSON、HTTP／transport failure 與其他 provider-specific error shape 仍是既有行為／後續風險。
  - LM Studio runtime／registry／deterministic compatibility tests 仍只是相容性／歷史範圍，未恢復 active support 或實機驗收。
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:9` 與 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:8` 的 BUG-053 段落仍保留「完整 check／獨立審查待完成」的舊狀態字樣；這不阻擋本輪已通過的 08 final gate，但後續若要求所有稽核／歷程段落同步為 current state，應另行更新並重跑文件檢查。
- 給主要開發代理的具體修正要求（若有）：round1 條件已解除，無本輪必修 source／test 修正；如要消除上述 06／07 舊狀態字樣，另立文件同步變更，不修改 round1／本 round2 報告，也不要擴大 live Ollama／FR-021 驗收宣稱。
- 可逐字引用的完整結論句：**本輪 BUG-053 round2 最終複審結論為通過：round1 唯一 closeout condition 已解除，`08-CHANGE-LOG.md:3-26` 已標示完成並正確鏈結 round1 報告及逐字引用其結論，round1 原件未修改，`npm run docs:check:final`、`npm run check`、`git diff --check` 及 focused／boundary tests 均 exit 0；Ollama native NDJSON HTTP 200 明確 error 的 fail-closed 行為與既有 scope／剩餘風險均維持，本結論仍不延伸為真實 Ollama、模型品質、斷網、Windows 或 FR-021 完整驗收。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告唯一寫入路徑為 `docs/project-management/reviews/2026-10-21-ollama-stream-error-fail-closed-round2.md`；round1 原件、source、test、治理來源文件與既有 evidence 均未修改。
- 未啟動真實 Ollama／LM Studio、未下載模型、未修改 OS／網路、未打包、未發布或推送。
- 若上述聲明不實，本報告無效。
