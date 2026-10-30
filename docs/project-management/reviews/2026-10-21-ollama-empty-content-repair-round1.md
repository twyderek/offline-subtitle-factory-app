# 獨立審查報告：BUG-052 Ollama 空回應錯誤分類與一次性修復

- 審查對象 commit／版本：工作樹 `HEAD c06d15e95a2f0a0981518c5873003a460e57a5ee` 加上目前未提交差異；branch `codex/0.51-anthropic-claude`；package version `0.52.0`
- 對應 08-CHANGE-LOG 條目：2026-10-21 — Ollama 空回應錯誤分類與一次性修復（BUG-052）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-21 12:43:22 +0800；獨立上下文啟動，未沿用主要開發代理對話記憶。依 `project:preflight -- --type=full` 讀取固定核心、任務路由、`03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、最新 `08-CHANGE-LOG.md` 及 source/test diff。
- 審查範圍：`lib/ai/subtitle-optimizer.mjs`、`scripts/test-ai-optimizer.mjs` 及 BUG-052 對應治理文件差異。未啟動真實 Ollama／LM Studio、未下載模型、未修改 OS／網路、未執行發布操作。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `08-CHANGE-LOG.md:7-16` 明確列出 `empty_content`、Ollama-only 一次性 JSON repair、repair 後 cue ID／數量／順序／文字／時間碼驗證、非 Ollama strict failure，以及不啟動真實 endpoint／不處理 LM Studio 的範圍。
  - `03-FUNCTIONAL-DESIGN.md:135-150` 將空白／缺失 `message.content` 定義為 `empty_content`，並保留完整 strict validation；`03-FUNCTIONAL-DESIGN.md:153` 的 LM Studio current-support policy 未被本輪程式差異改寫。
  - `06-TEST-AND-PROCESS-AUDIT.md:5-10` 與 `07-DEBUG-AND-FIX-HISTORY.md:3-9` 的需求、根因、修正與 deterministic 驗證敘述均與程式行為一致。
  - 但 `08-CHANGE-LOG.md:5` 仍為「進行中」，`08-CHANGE-LOG.md:17-20` 仍為「待完成」，`08-CHANGE-LOG.md:22` 仍為「待完成」；因此本輪功能需求已實作，但治理結案條件尚未完成。`npm run docs:check:final` 於 2026-10-21 12:42:50–12:42:51 +0800 以 exit 1 結束，明確回報最新工作紀錄尚未標示「完成」且獨立審查欄位尚未填寫。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `lib/ai/subtitle-optimizer.mjs:215-245` 先抽取 `message.content`，直接 `cues` 仍優先；沒有可解析文字時建立訊息「AI 未回傳字幕內容」並設定 `error.code = 'empty_content'`；有非空文字但 JSON／cue 形狀不合時仍分別走既有 `missing_cues`／`invalid_json` 路徑。
  - `lib/ai/subtitle-optimizer.mjs:343-348` 僅在 provider 正規化為 `ollama` 且 code 為 `empty_content` 時新增 repair 分流；`lm-studio` 仍只保留既有 `invalid_json`／`missing_cues` compatibility repair，其他 provider 不進入 local JSON repair。
  - `lib/ai/subtitle-optimizer.mjs:462-489` 的 repair 是單一 catch 分支；repair response 再次呼叫 `validateBatch`。`lib/ai/subtitle-optimizer.mjs:247-284` 驗證陣列、數量、ID、順序與非空／長度文字；`lib/ai/subtitle-optimizer.mjs:491-497` 只有 validated 結果完成後才加入 suggestions 並呼叫 `onCheckpoint`，所以失敗 repair 不會寫完成 checkpoint。
  - `lib/ai/subtitle-optimizer.mjs:356-372` 只補強既有 JSON repair prompt，保留原始 body／response format，未改 provider endpoint 或請求路由。

## 3. 邊界情況

- 判定：通過
- 證據：
  - 現有回歸 `scripts/test-ai-optimizer.mjs:419-476` 實測 Ollama 空白字串、缺失 `message.content`、repair 成功、repair 後仍空白、兩次 response 上限、失敗不寫 checkpoint，以及非 Ollama 單次 strict failure。
  - `scripts/test-ai-optimizer.mjs:478-556` 保留／驗證 Ollama 與 LM Studio 的既有 `missing_cues`／nested wrapper compatibility cases、非本機 strict failure 與 failed repair checkpoint。
  - 本審查於 2026-10-21 12:43:02 +0800 執行下列只使用 deterministic mock 的 inline boundary probe：`undefined`（以缺失欄位表示）、`null`、`''`、`'  '`、`[]`、`{ text: '   ' }`；結果全部在 Ollama 第二次 response 成功 repair，且 checkpoint `nextBatchIndex=1`。同一 probe 實測 `openai-compatible` 與 `lm-studio` 空回應各只呼叫一次並 strict failure；實測 repair 後交換 ID、數量錯誤及空白文字各呼叫總計兩次、拒絕且 checkpoint 維持 `null`。輸出為：`BUG-052 boundary probe passed: empty variants, Ollama-only one-shot repair, LM Studio/non-local strictness, and post-repair ID/count/order/text/checkpoint guards`，exit 0。
  - 未觀察到空白內容繞過 cue validation、第二次空回應再次進入 repair，或非 Ollama 因本輪 code 改動而重送。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - `git diff --stat` 顯示本輪 tracked diff 僅 6 個檔案、111 insertions／7 deletions；程式行為集中在 parser error classification、provider gate、既有 repair prompt 與 deterministic test cases，沒有無關模組重寫。
  - `git diff --check` 於 2026-10-21 12:42:23 +0800 exit 0；兩個變更 JavaScript 檔案的 `node --check` 均於 12:42:22 +0800 exit 0。
  - 變更未修改 endpoint、streaming／timeout／batch checkpoint 主流程，也未新增 LM Studio 的 `empty_content` repair；`03-FUNCTIONAL-DESIGN.md:153`、`07-DEBUG-AND-FIX-HISTORY.md:7` 與 source gate 相互一致。
  - repair 後沿用同一 `validateBatch` 與 checkpoint boundary，避免將空回應修正做成另一套較寬鬆的解析器。

## 5. 測試覆蓋

- 判定：通過（限本輪 deterministic／fixture 範圍）
- 證據：
  - 2026-10-21 12:42:22–12:42:23 +0800：`node --check lib/ai/subtitle-optimizer.mjs`、`node --check scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`git diff --check` 全部 exit 0。optimizer 輸出為「AI 字幕優化測試通過：固定 cue ID、時間碼、差異建議、進度與回應驗證」；provider 與 Ollama stream 測試亦回報通過。
  - 2026-10-21 12:42:26–12:42:47 +0800：完整 `npm run check` exit 0。實際包含 `docs:check`、全部 JavaScript syntax checks、`npm test`、AI optimizer／provider、Ollama offline process／UI／batch stream、核心 regression 與 YouTube posttest；完整輸出最後回報核心回歸與 YouTube publisher／SDK／stream／lifecycle suites 通過。
  - 本輪新增測試對應成功 repair、空回應二次失敗、strict provider 與 checkpoint；本審查另外補做 post-repair ID／數量／順序／文字矩陣。測試不會將 deterministic mock 誤稱為真實模型品質或 FR-021 完整驗收。
  - 小幅覆蓋觀察：`parseCompletionContent()` 並未 export，現有測試以 repair 分流與外部錯誤行為間接證明 `empty_content` code，而非直接讀取私有 error object；在目前 source 下該行為與 code gate 已由成功／strict 分流測試共同固定，未形成本輪阻擋。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 已實際重跑 syntax、optimizer、provider、Ollama streaming、boundary probe、`git diff --check` 與完整 `npm run check`，所有產品／測試命令均 exit 0；上述時間戳與輸出可回溯。
  - 依 BUG-052 範圍，沒有啟動真實 Ollama／LM Studio endpoint、沒有下載模型、沒有執行真實網路／斷網驗收、沒有執行 OS／網路設定變更、沒有打包或發布。因此本報告不宣稱真實 endpoint、模型品質、不同模型／版本、Windows 實機或 FR-021 整體通過。
  - `npm run docs:check:final` 於 2026-10-21 12:42:50–12:42:51 +0800 exit 1，失敗原因為 `08-CHANGE-LOG.md` 最新工作紀錄仍未標示完成，以及「獨立審查是否執行」仍為待完成；這是目前結案 blocker，不是產品測試失敗。

## 綜合判定

- 結論：有條件通過
- 結論逐字句：**本輪 BUG-052 獨立審查結論為有條件通過：目前差異已正確將缺失／空白 `message.content` 分類為 `empty_content`，僅讓 Ollama 對此錯誤執行一次既有 JSON repair，repair 後仍通過 cue ID、數量、順序、文字與 checkpoint 邊界，LM Studio active policy 與非 Ollama strict failure 未被放寬；focused／完整 deterministic 驗證及本審查補做的空值與 post-repair 邊界均通過，但 08-CHANGE-LOG 的 BUG-052 條目仍為進行中且 `docs:check:final` 目前 exit 1，完成結案欄位與 final gate 後才可宣稱本工作完成。**
- 阻擋問題（若有）：
  1. 由主要開發代理補齊 `08-CHANGE-LOG.md:17-22` 的實際修改、開發驗證、獨立審查連結／逐字引用與部署結果；將狀態及相應欄位改為符合實際結果，然後重新執行 `npm run docs:check:final` 並保存 exit 0。不得把本報告建立前的 `docs:check:final` 失敗描述為已通過。
  2. 這是治理結案 blocker；本輪未發現需要修改產品 source 或測試的邏輯 blocker。
- 剩餘風險：
  - 尚無真實 Ollama raw response、不同模型／版本、Windows 實機、真實 endpoint 或真正斷網證據；deterministic tests 不代表 FR-021 整體驗收或模型品質。
  - 真實模型仍可能回傳 malformed JSON、cue contract／語言／品質不合；現行契約會拒絕並避免寫入完成 checkpoint，但不保證生成成功。
  - LM Studio runtime／registry／deterministic compatibility tests 仍保留作相容性／歷史追溯；本輪未把它改為 active repair target，也未執行其實機驗收。
- 給主要開發代理的具體修正要求（若有）：只需完成上述 BUG-052 08 條目結案同步與 `npm run docs:check:final`；不要為解除本報告條件而啟動真實 Ollama、下載模型、改 OS／網路或修改既有 LM Studio policy。若後續 source／test 改動影響本結論，保留本 round1 原件並新增 round2，不覆寫本報告。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告唯一寫入路徑為 `docs/project-management/reviews/2026-10-21-ollama-empty-content-repair-round1.md`；未修改 source、test、治理來源文件、既有 evidence 或既有審查報告。
- 未啟動真實 Ollama／LM Studio、未下載模型、未修改 OS／網路、未發布或推送。
- 若上述聲明不實，本報告無效。
