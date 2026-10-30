# 獨立審查報告：BUG-058 Ollama strict abort before cancel

- 審查對象版本：目前工作樹 `0.52.0`；BUG-058 目標為 `lib/ai/openai-compatible.mjs`、`scripts/test-ai-providers.mjs`。
- 對應 08-CHANGE-LOG 條目：2026-10-28 — Ollama strict stream parser failure abort underlying request（BUG-058）。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-28（Asia/Taipei）；依 `offline-subtitle-factory-app/AGENTS.md`、`npm run project:preflight -- --type=development` 及其列出的 development 路由文件獨立啟動，未沿用主要開發代理對話記憶。工作樹既有 dirty 變更已辨識並保留，未將無關變更歸入本輪。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-16` 將 BUG-058 成功條件限定為 strict parser／decoder 的 `AiProviderError` failure 先 abort 同一 request signal，再進入既有 250ms bounded cancel／release，並明確排除 endpoint、request body、UI、封裝、真實模型品質、斷網、Windows 與發布。`docs/project-management/03-FUNCTIONAL-DESIGN.md:149` 同樣要求正常 EOF 不 abort、timeout／取消／transport 分類保留及 abort 不等同物理 socket teardown；`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 與目標 source／test 變更相符。未發現本輪範圍擴張或把 deterministic 證據冒稱為 live Ollama／FR-021 完整驗收。

## 2. 邏輯正確性

- 判定：通過
- 證據：`lib/ai/openai-compatible.mjs:97-147` 以 `completed` 區分正常 EOF 與 failure；只有 `!completed` 且 `failureError instanceof AiProviderError` 時在 `reader.cancel()` 前呼叫 `abortStream`（:129-134），其後以固定 250ms `Promise.race` 等待 cancel 並無條件嘗試 `releaseLock()`（:137-147）。`requestAiJson()` 在 :154-175 建立並傳給 fetch 的 request-local `timeoutController`，並於 :180-181 將其 abort callback 傳入 reader。獨立 fake reader probe（2026-10-28 審查期間，inline `node --input-type=module`）實際觀察 strict invalid-NDJSON 的順序為 `abort → cancel:true → release`；normal EOF 為 `abort:false, cancel:0, release:1`；timeout 保留 `timeout`，reader transport failure 保留 `network_error`。這些結果與 source 控制流一致。

## 3. 邊界情況

- 判定：通過
- 證據：`scripts/test-ai-providers.mjs:186-218` 覆蓋正常 EOF 的 no-cancel、release 與 no-abort；`:219-248` 覆蓋 decoder failure、reader transport failure、cancel／release failure 與原始分類；`:249-285` 覆蓋 cancel 永不 settle、固定 250ms timer、release 及 strict failure abort；`:286-328` 覆蓋 reader timeout、外部取消、cancel／release cleanup；`:329-377` 覆蓋 strict fallback 的 encoding-unavailable、non-strict compatibility、external cancellation、timeout 與 network failure；`:379-392` 保留 Ollama provider error 與 partial content 後 provider error。獨立 bounded fake probe 另觀察 `cancel()` 永不 settle 時約 262ms 返回、`releaseCalls=1`、request signal 已 abort；這只證明 caller／lock cleanup 邊界，不證明底層物理 teardown。

## 4. 程式碼品質

- 判定：通過
- 證據：變更集中在共用 streaming reader 與 provider focused test；`STREAM_READER_CLEANUP_TIMEOUT_MS` 在 `lib/ai/openai-compatible.mjs:33` 集中定義，failure-only cleanup、abort best-effort 與原始錯誤保留在 `:124-147` 鄰近實作，且 `requestAiJson` 的 callback 以 closure 綁定單一 request controller。`node --check lib/ai/openai-compatible.mjs`、`node --check scripts/test-ai-providers.mjs` 及 `git diff --check` 於 2026-10-28T02:28:51Z focused run 均 exit 0；未見新增 endpoint、request body 或其他 provider policy 的無關改動。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-optimizer.mjs` 於 2026-10-28T02:28:51Z focused run 均 exit 0；`scripts/test-ai-providers.mjs:284-285` 確認 failure 後 signal 為 aborted，`:145-158` 確認 strict invalid JSON 的錯誤分類。然而現有 test 將 :285 的案例命名為「strict parser failure」但 fake input 是 invalid UTF-8 decoder failure，且 invalid JSON 案例沒有 assertion signal 狀態或 `abort` 先於 `cancel` 的事件順序；因此測試尚未直接證明本輪最核心的 parser-specific abort-before-cancel 契約。source 與獨立 inline probe 已證明行為，但該缺口阻止無條件通過。建議主要代理新增 strict invalid-NDJSON reader fixture，讓 `cancel()` 入口直接 assert request signal 已 aborted並記錄 `abort < cancel < release`，同時保留現有 decoder、timeout、external cancellation、network error 與 cleanup failure assertions。

## 6. 實際運行結果

- 判定：部分通過
- 證據：2026-10-28T02:28:51Z focused run 的兩個 `node --check`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-optimizer.mjs` 與 `git diff --check` 全部 exit 0。2026-10-28T02:28:55Z 執行 `npm run check`，治理檢查、完整 deterministic tests、Ollama offline／UI／stream、核心與 YouTube suites 全部通過並 exit 0。`npm run docs:check:final` 在報告建立前 exit 1，明確原因是最新 BUG-058 工作條目仍為「進行中」且尚未有「獨立審查是否執行／發布授權」欄位；這是本輪只允許新增 review、不得修改 `08-CHANGE-LOG.md` 的治理限制，不能以此宣稱 closeout 完成。所有實際結果均限 deterministic fake／fixture；本輪未啟動 live Ollama、未下載模型、未做模型品質、Windows、OS 斷網或 FR-021 完整驗收。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 BUG-058 獨立審查結論為有條件通過：source 已在 strict streaming failure 的 AiProviderError path 於 reader.cancel() 前 abort request-local signal，正常 EOF 不 abort，timeout／external cancellation／network error 分類與 250ms bounded cancel／release 均經 focused、完整 deterministic 回歸及獨立 fake probe 核對；但 scripts/test-ai-providers.mjs 尚未對 strict invalid-NDJSON parser failure 直接斷言 abort-before-cancel 順序，故補上 parser-specific assertion 並由主要代理完成治理 closeout 前，不得宣稱無條件通過。本結論僅限 deterministic fake／fixture，不延伸為 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。**
- 阻擋問題（若有）：B1（無條件通過的測試覆蓋條件）：`scripts/test-ai-providers.mjs:145-158` 僅驗證 invalid-JSON code，`:249-285` 的 abort signal 案例實際是 invalid UTF-8 decoder failure，未直接驗證 strict parser failure 時 `abort` 先於 `reader.cancel()`；需新增 parser-specific ordering／cancel-entry assertion。這是 review closeout 的測試證據 blocker，不是本輪 source code 中已觀察到的邏輯錯誤。
- 剩餘風險：250ms bounded race 保證 caller 可繼續並嘗試 release lock，不保證 pending `reader.cancel()` promise 或底層 socket／stream 已完成物理回收；目前證據全為 deterministic fake／fixture，未涵蓋真實 Ollama response、模型／版本差異、live 網路、Windows、OS 斷網、UI、封裝或 FR-021 完整條件。另因本輪禁止修改 `08-CHANGE-LOG.md`，`npm run docs:check:final` 尚未能由本報告單獨變成通過。
- 給主要開發代理的具體修正要求（若有）：補上 B1 的 strict invalid-NDJSON abort-before-cancel deterministic assertion；整合本報告原句與 round1 路徑至 BUG-058 工作條目，依專案治理規範完成 closeout／final gate。不得把本輪結果擴大為 live Ollama、模型品質、Windows、OS 斷網或 FR-021 完整驗收。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
