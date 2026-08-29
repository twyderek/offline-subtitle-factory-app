# 獨立審查報告：AI 回應缺少 cues 的 JSON candidate parser 修正

- 審查對象：`codex/ai-cues-response-repair` 工作樹；PR #10；PR head `d0aeddb`
- 審查日期：2026-08-29（Asia/Taipei）
- 審查模式：獨立只讀審查；除本報告外未建立或修改其他檔案

## 1. 需求完整性

- 判定：部分通過
- 證據：`lib/ai/subtitle-optimizer.mjs:160-185` 已共用 `extractJsonCandidates`，可處理純 fenced JSON、前後說明文字與巢狀文字；`scripts/test-ai-optimizer.mjs:41-125` 覆蓋根 JSON array、explicit `cues`、fenced JSON、fenced prose、text-part array、巢狀 response object／string，以及 LM Studio JSON Schema。`lib/ai/subtitle-optimizer.mjs:337-340` 將缺少 cues 的 repair 限定為 Ollama／LM Studio，但根 JSON array 仍可由巢狀 wrapper 字串被接受，未完整滿足「只接受根 array 或 explicit cues array」及 wrapper array 禁止條件。

## 2. 邏輯正確性

- 判定：不通過
- 證據：[P1] `lib/ai/subtitle-optimizer.mjs:187-210` 對巢狀 wrapper 欄位先以 `allowRootArray = false` 呼叫，但字串分支 `:189-199` 解析 candidate 後又以 `findCueArray(parsed, true, seen)` 重新允許根 array。只讀 inline Node probe 實測：`{ response: "[{...cue...}]" }`、`{ data: "[{...cue...}]" }` 及含 prose／```json fence 的同類輸入皆輸出 `ACCEPTED 1 1`；`{ response: "{\"cues\":[...]}" }` 才是應接受的 explicit cues 情況。這會讓 wrapper 下序列化的 unrelated array 在元素恰好 cue-shaped 時通過 strict validation，造成靜默資料完整性風險。應保留共用 candidate extraction，但讓根 array 權限與最外層上下文綁定；巢狀 wrapper 字串必須解析到 explicit `cues`。

## 3. 邊界情況

- 判定：部分通過
- 證據：`scripts/test-ai-optimizer.mjs:48-91` 實測 plain fenced JSON、fenced prose、text-part array、nested response object 與 nested response string fenced JSON；`lib/ai/subtitle-optimizer.mjs:130-158` 的平衡括號掃描可避開 JSON 字串內的括號。`scripts/test-ai-optimizer.mjs:388-402` 只驗證實際巢狀 `data` array 被拒絕，未驗證字串化 wrapper root array 的負向案例，因此未捕捉上述 P1；`content`／`message` 等其他 wrapper 亦缺少同類負向回歸。

## 4. 程式碼品質

- 判定：部分通過
- 證據：變更集中在 `lib/ai/subtitle-optimizer.mjs` 的 parser、response-format builder 與 repair 分支；`buildResponseFormat` 於 `:79-85` 以 JSON Schema 優先於 `json_object`，`buildJsonRepairBody` 於 `:348-364` spread 原 body，沒有另行覆寫 `response_format`。`node --check lib/ai/subtitle-optimizer.mjs` 通過，`git diff --check` 通過（僅有既有換行格式警告）。但 `findCueArray` 的 `allowRootArray` 狀態在字串遞迴時被重置，形成集中且可重現的上下文邏輯缺口。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：`node scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs` 與 `node scripts/test-ai-fetch.mjs` 均於 2026-08-29 通過。Optimizer 測試在 `:388-402` 分別驗證 Ollama／LM Studio 缺少 cues 時恰好兩次 completion，在 `:404-417` 驗證非本機 provider 只呼叫一次並 strict failure，在 `:419-435` 驗證第二次 repair 失敗且不寫完成 checkpoint，在 `:93-125` 驗證 LM Studio JSON Schema／json_object／停用 response format。缺口是沒有驗證巢狀 wrapper 字串中的 root array 必須拒絕，也沒有專門斷言 LM Studio 的 repair request 仍保留 JSON Schema。

## 6. 實際運行結果

- 判定：部分通過
- 證據：`node --check lib/ai/subtitle-optimizer.mjs`、上述四個 focused tests、`git diff --check` 及 `npm run docs:check`（19 個文件）通過。`npm run check` 在大部分測試通過後於 `scripts/test-core.mjs:514` 失敗：Breeze mock job 為 `needs-action`，錯誤為 `Breeze ASR 25 尚未就緒：FFmpeg`；本環境缺少 Breeze ASR／FFmpeg runtime，這是已知環境限制。`npm run docs:check:final` 因最新 changelog 仍為 `進行中`、含 `待執行` 且尚未填入獨立審查結果而失敗，符合目前尚未結案的狀態。

## 綜合判定

- 結論：不通過
- 阻擋問題（若有）：[P1] `findCueArray` 在解析 `response`／`data` 等巢狀 wrapper 字串時重新允許 root JSON array，違反「wrapper 下非 explicit cues array 不得視為 cues」的核心契約；需修正上下文傳遞並補上字串化 wrapper array（含 fenced prose）的負向回歸。
- 可逐字引用完整結論句：**本輪獨立審查結論為不通過，因巢狀 wrapper 字串中的根 JSON array 仍可能被誤認為 cues，違反明確的回應契約。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
