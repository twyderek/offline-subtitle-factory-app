# 獨立審查報告：Ollama malformed NDJSON 串流 fail-closed（BUG-054）

- 審查對象 commit／版本：目前工作樹（`package.json` 版本 `0.52.0`；以目前工作樹相對 `HEAD` 的 source／tests／治理內容核對）
- 對應 08-CHANGE-LOG 條目：2026-10-21 — Ollama malformed NDJSON 串流 fail-closed（BUG-054）
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-10-21T15:23:35+08:00 至 15:24:41+08:00（Asia/Taipei；同一審查角色的獨立複審上下文，重新讀取目前工作樹、round1／round2 原件、治理 validator、08 最新條目與指定 source／tests）
- 審查範圍：核對 round2 報告 schema、08 的 round2 逐字引用、round1／round2 原件完整性、BUG-054 source／tests 行為與剩餘風險；實際重跑 final gate、focused tests、完整 check 與 diff check。未修改 round1／round2、程式碼、測試、治理來源文件或既有 evidence。

## 1. 需求完整性

- 判定：通過
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:3-18` 將 BUG-054 標示為「完成」，並明確記載成功條件：Ollama native HTTP 200 NDJSON 任一非空 malformed record 在 parser／repair 前成為 `ollama_stream_invalid_json`、`retryable=false`，不得靜默丟棄、降成 `empty_content`、repair、retry 或 checkpoint；同時保留正常 stream、BUG-053 provider error、timeout／取消與非 Ollama provider 邊界。
  - `docs/project-management/08-CHANGE-LOG.md:19-29` 保留 round1 歷史引用、round2 報告鏈結與 round2 逐字結論，並記載發布／部署不適用及 deterministic-only、真實 Ollama／模型／版本／斷網／Windows／FR-021 與 LM Studio compatibility/history 剩餘風險。
  - `docs/project-management/03-FUNCTIONAL-DESIGN.md:149`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-10`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 與 source／tests 的契約一致；沒有把 deterministic 證據擴大成真實 Ollama acceptance。
  - 2026-10-21T15:23:35+08:00 的 inline validator／quote comparison 結果為 `status=完成`、`reference=docs/project-management/reviews/2026-10-21-ollama-malformed-ndjson-fail-closed-round2.md`、`referenceRound=2`、`conditionAccepted=true`、`reportErrors=[]`、`latestErrors=[]`、`quoteMatches=true`、`deterministicOnly=true`。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `lib/ai/openai-compatible.mjs:33-57` 對非空 NDJSON line 逐一 `JSON.parse`；`strictJson` 下任一 parse failure 立即拋出 `AiProviderError`，由 Ollama 傳入的 code 為 `ollama_stream_invalid_json` 且 `retryable=false`，不會加入合併結果。
  - `lib/ai/openai-compatible.mjs:60-76,79-141` 將 `streamOptions` 傳入 reader／fallback reader，保留 response headers、body idle timeout、取消與 HTTP error 控制流；共用 transport 預設仍為非 strict。
  - `lib/ai/providers.mjs:50-107` 只有 Ollama native path 啟用 `strictJson: true` 與 `invalidJsonCode: 'ollama_stream_invalid_json'`；明確 provider error 仍在 normalized choices 前轉成 `ollama_stream_error`、`retryable=false`。
  - `lib/ai/subtitle-optimizer.mjs:317-335,343-349,460-496` 顯示 retry 僅接受 `retryable` error，repair 白名單不含 `ollama_stream_invalid_json`／`ollama_stream_error`，checkpoint 只在 validation 成功後執行，因此 malformed stream 不會 repair／retry／checkpoint。

## 3. 邊界情況

- 判定：通過
- 證據：
  - `scripts/test-ai-providers.mjs:137-159` 實測正常三段串流、malformed-only，以及合法片段前後 malformed；malformed cases 均維持 `ollama_stream_invalid_json`，不可重試。
  - `scripts/test-ai-providers.mjs:160-179` 實測共用 transport 預設非 strict 在 malformed line 後保留合法 content，以及 HTTP 200 的 BUG-053 provider error（含部分 content 後 error）維持 `ollama_stream_error`。
  - `scripts/test-ai-providers.mjs:181-214` 與 `scripts/test-ollama-batch-stream.mjs:87-112` 實測 chunk idle timeout、延遲 headers 與 timeout retry；timeout 仍是可重試的既有路徑。
  - `scripts/test-ollama-batch-stream.mjs:10-38,40-85` 實測三批正常 stream、BUG-053 error 與 malformed NDJSON；malformed／provider error 各自只發出一次 request，均無 repair、retry、checkpoint。round2 的取消／非 strict boundary probe 亦於 2026-10-21T15:22:06+08:00 exit 0，確認取消不誤分類為 malformed。
  - 未涵蓋且未被宣稱已涵蓋的範圍包括真實 Ollama endpoint、模型品質／版本、真正斷網、Windows、UI、封裝、發布及 FR-021 實機驗收；LM Studio 仍是 compatibility／歷史範圍。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - strict framing 是共用 transport 的 opt-in；provider-specific code 只在 Ollama native adapter 傳入固定 error code，責任邊界清楚（`lib/ai/openai-compatible.mjs:33-76`；`lib/ai/providers.mjs:61-104`）。
  - source／tests 仍限於 BUG-054 宣告的 streaming merge、Ollama native adapter、provider／batch tests 與既有 optimizer／治理同步，未見 round2 後新增的產品邏輯旁路或 scope 擴張。
  - 2026-10-21T15:24:06+08:00 至 15:24:07+08:00 的 focused `node --check` 與 provider／batch／optimizer tests 全部 exit 0；2026-10-21T15:24:30+08:00 `git diff --check` exit 0。
  - round1 與 round2 原件均未被覆寫：本輪核對 round1 SHA-256 `31d3b13c005431d85a53aa0415380a759a20a3a7203dbfdf9fdd9f6eb29c7391`、round2 SHA-256 `e56c644b616dbaa576d7ed434cc88d52129077f507ec5b92b0e0cadc315d3750`，與建立後先前記錄值一致。

## 5. 測試覆蓋

- 判定：通過
- 證據：
  - 2026-10-21T15:24:06+08:00 至 15:24:07+08:00：`node --check lib/ai/openai-compatible.mjs`、`node --check lib/ai/providers.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs`、`node --check scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-optimizer.mjs` 均 exit 0，輸出包含 provider contract、Ollama streaming multi-batch 與 AI optimizer 通過。
  - 2026-10-21T15:24:09+08:00 至 15:24:29+08:00：`npm run check` exit 0，包含 19 個治理文件、全套 npm test、AI provider／optimizer、Ollama offline／UI／stream、核心與 YouTube suites。
  - 2026-10-21T15:24:30+08:00：`git diff --check` exit 0。
  - 2026-10-21T15:24:02+08:00 至 15:24:03+08:00：`npm run docs:check:final` exit 0，輸出「專案治理文件檢查通過：19 個文件，版本 0.52.0，最新紀錄已結案」。2026-10-21T15:23:35+08:00 的 round2 report validator 亦為 `reportErrors=[]`，故 round2 schema 與 08 quote 的 closeout condition 已解除。

## 6. 實際運行結果

- 判定：通過
- 證據：
  - focused suites 以 mocked `fetch`／`ReadableStream` 實際跑過正常多段、多批次、malformed-only、合法片段前後 malformed、BUG-053 provider error、timeout 與 optimizer request／repair／retry／checkpoint assertions；均 exit 0。
  - round2 已實測 AbortController cancellation 與 default non-strict shared transport；本輪重新執行 provider／batch／optimizer suites 未見回歸。
  - `npm run check`、`git diff --check` 與 `npm run docs:check:final` 均為本輪實際指令輸出，不是推定結果；本輪未啟動真實 Ollama／LM Studio、未下載模型、未修改 OS／網路、未打包或發布。
  - `docs/project-management/08-CHANGE-LOG.md:29` 如實保留 deterministic-only 限制與 live risk；其中「round2 條件待 final gate 重跑後由 round3 確認」的歷史交接條件已由本報告本節所列 exit 0 結果確認解除，本審查代理未修改 08。

## 綜合判定

- 結論：通過
- 可逐字引用的完整結論句：**本輪 BUG-054 round3 最終複審結論為通過：round1 closeout condition 已解除，round2 報告 schema 與 08 round2 quote 逐字一致，round1／round2 原件 SHA-256 與內容未被修改，`npm run docs:check:final` exit 0；BUG-054 source／tests 維持 Ollama native HTTP 200 NDJSON malformed record 在 parser／repair 前以 `ollama_stream_invalid_json`、`retryable=false` fail-closed 且不 repair／retry／checkpoint，正常 stream、BUG-053 provider error、timeout／取消與預設非 strict transport 未回歸；剩餘 live risk 僅為 deterministic scope 外的真實 Ollama／模型品質／版本／斷網／Windows／FR-021、LM Studio compatibility/history、UI／封裝／發布。**
- 阻擋問題（若有）：無。
- 剩餘風險：本輪證據仍是 mocked／deterministic fixture；未替代真實 Ollama endpoint、所有模型／版本、模型品質、真正斷網、Windows 或 FR-021 實機驗收。其他 HTTP／transport failure 與未涵蓋 provider-specific response shape 仍屬既有行為與後續風險；LM Studio 僅保留 compatibility／歷史內容。
- 給主要開發代理的具體修正要求（若有）：無；維持 08 已記載的 deterministic-only 邊界與剩餘 live risk，不將本報告擴大解讀為實機、模型、Windows、UI、封裝或發布驗收。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- round1 報告原件 SHA-256 為 `31d3b13c005431d85a53aa0415380a759a20a3a7203dbfdf9fdd9f6eb29c7391`；round2 報告原件 SHA-256 為 `e56c644b616dbaa576d7ed434cc88d52129077f507ec5b92b0e0cadc315d3750`，均已核對未被修改。
- 若上述聲明不實，本報告無效。
