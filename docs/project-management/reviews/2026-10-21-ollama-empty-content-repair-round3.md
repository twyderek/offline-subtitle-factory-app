# 獨立複審報告：BUG-052 Ollama 空回應錯誤分類與一次性修復

- 審查對象 commit／版本：工作樹 `HEAD c06d15e95a2f0a0981518c5873003a460e57a5ee` 加上目前未提交差異；branch `codex/0.51-anthropic-claude`；package version `0.52.0`
- 對應 08-CHANGE-LOG 條目：2026-10-21 — Ollama 空回應錯誤分類與一次性修復（BUG-052）
- 審查輪次：round3（最終複審）
- 審查代理啟動時間、上下文來源：2026-10-21 12:48 +0800；新的獨立複審上下文，未沿用主要開發代理對話記憶。依 `project:preflight -- --type=full` 重新讀取固定核心／完整任務路由、round1／round2 原件、目前 source／test／03／06／07／08 差異及報告 validator。
- 審查範圍：`lib/ai/subtitle-optimizer.mjs`、`scripts/test-ai-optimizer.mjs`、`docs/project-management/03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、`08-CHANGE-LOG.md`，以及 round1／round2 唯一 closeout condition。round1／round2 原件均保留；其 SHA-256 分別為 `b12d4e9f8f01935a41486de5518ba6dc140a285b2b9a9d2297210462eae53705` 與 `00b9cb3a53ab9abdfc960c13485b2f2c835429601e81233608069d78faae5f39`。

## 1. 需求完整性

- 判定：通過
- 證據：
  - `docs/project-management/03-FUNCTIONAL-DESIGN.md:137,149` 明確要求缺失／空白 `message.content` 分類為 `empty_content`，只有 Ollama 做一次 JSON repair，repair 後仍須完整 strict validation；非 Ollama strict，LM Studio policy 不擴大。
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-9`、`07-DEBUG-AND-FIX-HISTORY.md:3-9` 與 source/test diff 對同一需求、範圍與限制一致；`08-CHANGE-LOG.md:3-27` 已標示完成並鏈回 round2 報告及其逐字結論。
  - round1 指出的「08 結案欄位與 final gate」及 round2 指出的「08 鏈回可解析 round2 報告並重跑 final gate」均已在目前工作樹解除：`npm run docs:check:final` 於 2026-10-21 12:57:55 +0800 exit 0，回報 19 個文件、最新紀錄已結案。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `lib/ai/subtitle-optimizer.mjs:215-245` 先保留直接 `cues`；沒有可解析文字時建立 `error.code='empty_content'`，有文字但 JSON／cue 結構不合時仍走既有 `invalid_json`／`missing_cues`。
  - `lib/ai/subtitle-optimizer.mjs:343-348` 只有 provider 為 `ollama` 且 error code 為 `empty_content` 時新增 repair；LM Studio 僅保留既有 compatibility repair，其他 provider 不進入 local JSON repair。
  - `lib/ai/subtitle-optimizer.mjs:247-284,462-489` 的 `validateBatch` 保留 cue 陣列、數量、ID、順序、非空／長度等 guards；repair 後再次走同一驗證，且 `onCheckpoint` 僅在 `lib/ai/subtitle-optimizer.mjs:491-497` 驗證成功後執行。

## 3. 邊界情況

- 判定：通過
- 證據：
  - `scripts/test-ai-optimizer.mjs:419-476` 實測 Ollama 空白／缺失 `message.content` 成功一次 repair、repair 後仍空白只送兩次且不寫 checkpoint、非 Ollama 空回應只送一次 strict failure；`478-556` 保留 LM Studio compatibility 與 failed repair guards。
  - 本輪 2026-10-21 12:57:30 +0800 的 deterministic boundary probe 覆蓋 `undefined`、`null`、空字串、空白字串、空陣列與 `{ text: '   ' }`；每案 Ollama 恰兩次 response 後成功，`openai-compatible`／`lm-studio` 各只一次並拒絕。
  - 同一 probe 以「首回空內容、repair 回應錯誤 ID／數量／空白文字」驗證 post-repair guards：每案恰兩次 response、無第三次 repair、checkpoint 維持 `null`，probe exit 0。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - `git diff --name-status` 顯示本輪受檢 tracked 差異集中於 6 個既有 source/test/03/06/07/08 檔案；`lib/ai/subtitle-optimizer.mjs` 只改 error classification、Ollama gate 與 repair prompt，`scripts/test-ai-optimizer.mjs` 增加對應 deterministic cases，未改 endpoint、streaming、timeout、UI、封裝或發布資產。
  - `node --check lib/ai/subtitle-optimizer.mjs` 與 `node --check scripts/test-ai-optimizer.mjs` 於 2026-10-21 12:49:09 +0800 exit 0；`git diff --check` 於 2026-10-21 12:57:55 +0800 exit 0。
  - round1／round2 原件未被覆寫；本輪只新增本報告，符合 `workflows/04-INDEPENDENT-REVIEW.md` 的獨立寫入限制。

## 5. 測試覆蓋

- 判定：通過
- 證據：
  - 2026-10-21 12:49:09 +0800 focused suite：兩個 `node --check`、`node scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-fetch.mjs`、`node scripts/test-project-docs-validator.mjs` 均 exit 0。
  - 2026-10-21 12:57:32–12:57:55 +0800 完整 `npm run check` exit 0，包含 `docs:check`、完整 syntax checks、全部 `npm test` 與 YouTube posttest；AI optimizer／provider、Ollama offline／UI／stream 與核心 regression 均通過。
  - 2026-10-21 12:57:55 +0800 `git diff --check` exit 0；同時 `npm run docs:check:final` exit 0，完成治理 final gate。

## 6. 實際運行結果

- 判定：通過
- 證據：
  - 所有本輪產品／測試操作均為 source inspection、deterministic mock、offline fixture 或治理 validator；未啟動真實 Ollama／LM Studio、未下載模型、未修改 OS／網路、未打包、未發布、未推送或修改既有 Release 資產。
  - round3 實際確認 `08-CHANGE-LOG.md` 已可解析鏈回 `docs/project-management/reviews/2026-10-21-ollama-empty-content-repair-round2.md` 並逐字引用 round2 結論；其後 `npm run docs:check:final` exit 0，故 round1／round2 closeout condition 已解除。
  - 結論範圍限 BUG-052 deterministic／offline 驗證；不將其延伸宣稱為真實模型品質、不同模型／版本、斷網、Windows 實機或 FR-021 整體驗收。

## 綜合判定

- 結論：通過
- 可逐字引用的完整結論句：**本輪 BUG-052 round3 最終複審結論為通過：缺失／空白 `message.content` 正確分類為 `empty_content`，只有 Ollama 對此錯誤執行一次 JSON repair，repair 後仍受 cue／checkpoint strict guards 保護，非 Ollama 維持 strict failure，LM Studio policy 未變；focused tests、boundary probe、完整 `npm run check`、`git diff --check`、報告 schema validator 與 `npm run docs:check:final` 均 exit 0，且 round1／round2 唯一 closeout condition（08 結案鏈結／逐字引用與 final gate）已解除。**
- 阻擋問題（若有）：無。
- 剩餘風險：仍無真實 Ollama raw response、不同模型／版本、真正斷網、Windows 實機或 FR-021 完整本機流程 evidence；真實模型仍可能回傳 malformed JSON、錯誤 cue contract、語言或品質不合，現行 strict validation 會拒絕並避免寫入完成 checkpoint；LM Studio 僅保留相容性／歷史範圍，未作本輪實機驗收。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告唯一寫入路徑為 `docs/project-management/reviews/2026-10-21-ollama-empty-content-repair-round3.md`；round1／round2 原件、source、test、治理來源文件與既有 evidence 均未修改。
- 未啟動真實 Ollama／LM Studio、未下載模型、未修改 OS／網路、未發布或推送。
- 若上述聲明不實，本報告無效。
