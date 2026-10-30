# 獨立審查報告：Ollama malformed NDJSON 串流 fail-closed（BUG-054）

- 審查對象 commit／版本：目前工作樹（`package.json` 版本 `0.52.0`；BUG-054 變更以 `git diff` 相對目前 `HEAD` 檢查）
- 對應 08-CHANGE-LOG 條目：2026-10-21 — Ollama malformed NDJSON 串流 fail-closed（BUG-054）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-21（Asia/Taipei；本報告建立前僅讀取 source、tests、治理文件並執行驗證）；獨立上下文，未沿用主要開發代理的評價性摘要
- 審查範圍：`lib/ai/openai-compatible.mjs`、`lib/ai/providers.mjs`、`scripts/test-ai-providers.mjs`、`scripts/test-ollama-batch-stream.mjs`、`docs/project-management/03-FUNCTIONAL-DESIGN.md`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md`、`docs/project-management/08-CHANGE-LOG.md` 最新 BUG-054 條目；另追溯 `lib/ai/subtitle-optimizer.mjs` 與 BUG-053 相關 tests。未啟動真實 Ollama、LM Studio、UI、封裝或發布流程。

## 1. 需求完整性

- 判定：通過（功能需求範圍）；結案文件同步另列為綜合條件
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:7-16` 明列 BUG-054 目標、成功條件、非 Ollama／timeout／取消／正常多段串流的回歸邊界，以及本輪 deterministic 驗證計畫。
  - `docs/project-management/03-FUNCTIONAL-DESIGN.md:149` 明定 Ollama 原生 NDJSON 任一非空 malformed record 必須在 parser／repair 前轉為不可重試的 `ollama_stream_invalid_json`，不得靜默丟棄或交給 repair；同一行也保留 `ollama_stream_error` 與其他 provider 不放寬的契約。
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-10`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 與上述需求一致，且明確限定 deterministic／fixture 證據，不把本輪宣稱擴大成真實 Ollama 或完整 FR-021 驗收。
  - 目前 `08-CHANGE-LOG.md:5` 仍為「進行中」，且最新條目尚未有「獨立審查是否執行／發布授權」欄位；這是結案同步缺口，不是 BUG-054 功能需求遺漏，且依本次指示未修改 08。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `lib/ai/openai-compatible.mjs:33-57` 將串流每一個非空 line 個別 `JSON.parse`；`strictJson` 下任一 parse failure 立即建立 `AiProviderError`，code 由呼叫端指定且 `retryable: false`，不再進入合併結果。非 strict 仍保留原本忽略 malformed line 的行為。
  - `lib/ai/openai-compatible.mjs:60-76` 將 `streamOptions` 傳到有 reader 與 fallback `response.text()` 兩條路徑；`requestAiJson` 在 `lib/ai/openai-compatible.mjs:79-141` 只於 `response.ok && streamResponse` 走該串流 parser，並保留既有 timeout／取消／HTTP error 分流。
  - `lib/ai/providers.mjs:50-107` 僅由 Ollama native path 啟用 `strictJson: true` 與 `ollama_stream_invalid_json`；合併結果的明確 `error` 仍在回傳 `choices` 前轉成 `ollama_stream_error`、`retryable=false`，維持 BUG-053 行為。
  - `lib/ai/subtitle-optimizer.mjs:317-335` 只有 `error.retryable` 才進 retry；`lib/ai/subtitle-optimizer.mjs:343-349` 的 local JSON repair 只接受 `invalid_json`／`missing_cues`／Ollama `empty_content`，不接受 `ollama_stream_invalid_json` 或 `ollama_stream_error`；`lib/ai/subtitle-optimizer.mjs:460-496` 只有 validation 成功後才寫 checkpoint。因此 strict framing error 會在 optimizer parser、repair、retry、checkpoint 前終止。
  - 這個控制流由實際 test 覆蓋：`scripts/test-ai-providers.mjs:144-179` 與 `scripts/test-ollama-batch-stream.mjs:63-85` 均驗證 malformed record、code、不可重試、單次 request 與零 checkpoint。

## 3. 邊界情況

- 判定：通過（本輪 deterministic scope）
- 證據：
  - malformed-only：`scripts/test-ai-providers.mjs:144-149` 使用 HTTP 200 `not-json`，實際得到 `ollama_stream_invalid_json` 且不可重試。
  - 合法片段前／後 malformed：`scripts/test-ai-providers.mjs:150-159` 與 `scripts/test-ollama-batch-stream.mjs:63-85` 驗證合法 JSON content 不會掩蓋中間 malformed line，optimizer 只呼叫一次且不寫 checkpoint。
  - 正常多段串流／多批次：`scripts/test-ai-providers.mjs:137-143`、`scripts/test-ollama-batch-stream.mjs:10-38` 實際通過三段 content、三個 batch 與三筆 suggestions。
  - BUG-053 provider error：`scripts/test-ai-providers.mjs:166-179` 與 `scripts/test-ollama-batch-stream.mjs:40-61` 覆蓋單筆 error、部分 content 後 error；保留 `ollama_stream_error`、不可重試、不 repair／retry／checkpoint。
  - timeout：`scripts/test-ai-providers.mjs:181-214` 覆蓋 chunk idle timeout 與 response headers 後的 body idle window；`scripts/test-ollama-batch-stream.mjs:87-112` 覆蓋 timeout 延長後恰好一次 retry。
  - 取消與非 strict：2026-10-21T15:19:09+08:00 執行獨立 inline boundary probe；取消中的 Ollama stream 確認 abort 傳播且不被誤分類為 `ollama_stream_invalid_json`，共用 transport 預設非 strict 時含 malformed line 仍保留合法 content，probe exit 0。另有 `scripts/test-ai-providers.mjs:160-165` 的相同非 strict regression。
  - 未覆蓋且保留為風險：真實 Ollama、不同模型／版本、Windows、UI、封裝與發布；這些均在 `docs/project-management/03-FUNCTIONAL-DESIGN.md:151-155`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:5-10` 的範圍界線內，不能由 fixture 結果推論通過。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - 變更以 opt-in `streamOptions.strictJson` 集中在共用 transport，沒有複製另一套串流 parser；Ollama-specific error code 由 provider 明確傳入，責任邊界清楚（`lib/ai/openai-compatible.mjs:33-76`、`lib/ai/providers.mjs:61-104`）。
  - `AiProviderError` 已是既有共用錯誤型別（`lib/ai/openai-compatible.mjs:10-19`），本輪沿用既有 status／code／retryable 欄位，未引入新的隱性 retry 或 parser 旁路。
  - `node --check` 對 `lib/ai/openai-compatible.mjs`、`lib/ai/providers.mjs`、`scripts/test-ai-providers.mjs`、`scripts/test-ollama-batch-stream.mjs` 均通過；`git diff --check` 亦通過（2026-10-21T15:17:41+08:00 與 2026-10-21T15:18:34+08:00）。
  - 無發現會改動 endpoint、request body、LM Studio compatibility code、UI、封裝或既有 evidence／review 原件的本輪程式碼問題。

## 5. 測試覆蓋

- 判定：通過（deterministic／fixture 範圍）；final gate 條件未完成
- 證據：
  - 2026-10-21T15:17:41+08:00：
    - `node --check lib/ai/openai-compatible.mjs` — exit 0。
    - `node --check lib/ai/providers.mjs` — exit 0。
    - `node --check scripts/test-ai-providers.mjs` — exit 0。
    - `node scripts/test-ai-providers.mjs` — exit 0，輸出 `AI provider contract 與術語／Prompt 測試通過`。
    - `node --check scripts/test-ollama-batch-stream.mjs` — exit 0。
    - `node scripts/test-ollama-batch-stream.mjs` — exit 0，輸出 `Ollama streaming multi-batch test passed.`。
    - `node scripts/test-ai-optimizer.mjs` — exit 0，輸出 `AI 字幕優化測試通過...`。
  - 2026-10-21T15:18:11+08:00 至 15:18:31+08:00：`npm run check` — exit 0；包含 `docs:check`（19 個治理文件）、AI optimizer／provider、Ollama offline／UI／stream、核心與 YouTube suites。
  - 2026-10-21T15:18:34+08:00：`git diff --check` — exit 0。
  - 2026-10-21T15:18:34+08:00：`npm run docs:check:final` — exit 1；validator 實際指出最新工作紀錄缺少「獨立審查是否執行：」與「發布授權：」、最新工作紀錄尚未標示「完成」、且前者必須為是／否。這與 `08-CHANGE-LOG.md:5` 的「進行中」一致。

## 6. 實際運行結果

- 判定：通過（程式與 deterministic integration 實際運行）；治理結案未通過
- 證據：
  - 2026-10-21T15:17:41+08:00 的兩個 focused suites 實際以 mocked `fetch`／ReadableStream 執行，分別證明 Ollama native request 使用 `/api/chat`、streaming、多段合併、malformed fail-closed 與 BUG-053 provider error；不是只做靜態檢查。
  - 2026-10-21T15:17:41+08:00 至 15:17:42+08:00 的 optimizer batch suite 實際跑過正常三批、provider error、malformed stream、timeout retry，觀測 request 次數與 checkpoint 次數。
  - 2026-10-21T15:18:11+08:00 至 15:18:31+08:00 的完整 `npm run check` 實際完成所有列出的 regression suites，exit 0。
  - 本輪沒有真實 Ollama endpoint／模型、LM Studio、UI、封裝、發布或網路隔離實機操作；依 `08-CHANGE-LOG.md:9-12`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:5-10` 應將證據限制為 deterministic／fixture。

## 綜合判定

- 結論：有條件通過
- 阻擋問題：
  - 唯一目前確認的阻擋是結案治理條件：`08-CHANGE-LOG.md:3-16` 最新 BUG-054 條目仍為「進行中」，缺少 final validator 要求的「獨立審查是否執行／發布授權」欄位，因此 `npm run docs:check:final` 於 2026-10-21T15:18:34+08:00 exit 1。
  - 主要開發代理需依專案規範補齊 BUG-054 的實際開發驗證、獨立審查鏈結／欄位與不適用的發布授權說明，標示完成後重跑 `npm run docs:check:final`；本審查代理依本次指示未修改 08。
- 剩餘風險：
  - deterministic fixture 未替代真實 Ollama endpoint、模型品質、不同 Ollama 版本／模型、Windows、UI、封裝或發布驗收。
  - 本輪契約針對 HTTP 200 native NDJSON 的非空 malformed record；其他 HTTP／transport failure 與未涵蓋 provider-specific response shape 仍須沿用既有錯誤邊界並另行驗證。
  - LM Studio 僅保留既有 compatibility／歷史範圍，不是本輪 active support 或 acceptance 目標。
- 給主要開發代理的具體修正要求：完成上述 08 結案同步並重跑 final gate；若文件同步不改變本輪程式／測試邏輯，後續可用 round2 只確認 closeout condition 已解除，不需重寫 round1 原件。

可逐字引用的完整結論句：**本輪 BUG-054 獨立審查結論為有條件通過：Ollama native HTTP 200 NDJSON 任一非空 malformed record 已在 parser／repair 前轉為 `ollama_stream_invalid_json`、`retryable=false`，正常多段串流、BUG-053 明確 provider error、timeout／取消與預設非 strict streaming 均通過 deterministic 驗證且未發現產品邏輯 blocker，但 `npm run docs:check:final` 於 2026-10-21T15:18:34+08:00 因最新 `08-CHANGE-LOG.md:3-16` 仍為「進行中」並缺少「獨立審查是否執行／發布授權」欄位而 exit 1，故需由主要代理完成 08 結案同步並重跑 final gate 後，才能宣稱 BUG-054 無條件完成；本結論不延伸為真實 Ollama、模型品質、LM Studio、UI、封裝、發布或 Windows 驗收。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前確認目標檔不存在；既有 `docs/project-management/evidence/` 與既有 `docs/project-management/reviews/` 原件未修改。
- 若上述聲明不實，本報告無效。
