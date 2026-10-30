# 獨立複審報告：BUG-052 Ollama 空回應錯誤分類與一次性修復

- 審查對象 commit／版本：工作樹 `HEAD c06d15e95a2f0a0981518c5873003a460e57a5ee` 加上目前未提交差異；branch `codex/0.51-anthropic-claude`；package version `0.52.0`
- 對應 08-CHANGE-LOG 條目：2026-10-21 — Ollama 空回應錯誤分類與一次性修復（BUG-052）
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-10-21 12:44–12:47 +0800；新的獨立複審上下文，重新讀取 `AGENTS.md`、`project:preflight -- --type=full` 所列核心／路由文件、round1 原件、目前 source／test／03／06／07／08 差異與治理 validator；未沿用主要開發代理對話記憶。
- 審查範圍：`lib/ai/subtitle-optimizer.mjs`、`scripts/test-ai-optimizer.mjs`、`docs/project-management/03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、`08-CHANGE-LOG.md`，以及 round1 指出的結案條件。round1 原件保留未修改。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:5-18` 已標示 BUG-052 為「完成」，並記錄 `empty_content`、Ollama-only 一次性 repair、repair 後 strict guards、非 Ollama strict、LM Studio policy 不變，以及 focused／完整 check 已通過；`03-FUNCTIONAL-DESIGN.md:137,149,153` 與 `07-DEBUG-AND-FIX-HISTORY.md:3-9` 的需求與範圍敘述一致。
  - `git diff --stat -- lib/ai/subtitle-optimizer.mjs scripts/test-ai-optimizer.mjs docs/project-management/03-FUNCTIONAL-DESIGN.md docs/project-management/06-TEST-AND-PROCESS-AUDIT.md docs/project-management/07-DEBUG-AND-FIX-HISTORY.md docs/project-management/08-CHANGE-LOG.md` 顯示本輪範圍為 6 個 tracked files、111 insertions／7 deletions，沒有擴大到 provider endpoint、UI、封裝或發布資產。
  - round1 唯一條件是 08 結案欄位與 `docs:check:final` 通過；本輪重跑 `npm run docs:check:final`（2026-10-21 12:46:15 +0800）仍 exit 1，輸出為「最新工作紀錄已執行獨立審查，但缺少可解析的審查檔案與逐字引用」。目前 08 條目仍只引用 round1 的 inline link／「逐字結論」文字，未鏈回本 round2 報告的 validator schema。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `lib/ai/subtitle-optimizer.mjs:215-245` 先保留直接 `cues`，再對缺失、`null`、空字串或空白文字建立 `error.code='empty_content'`；有內容但 JSON／cue 形狀不合仍走既有 `invalid_json`／`missing_cues`。
  - `lib/ai/subtitle-optimizer.mjs:343-348` 只有正規化 provider 為 `ollama` 且 error code 為 `empty_content` 時才新增 repair；LM Studio 仍只保留既有 `invalid_json`／`missing_cues` compatibility repair，非 Ollama 不進入 local JSON repair。
  - `lib/ai/subtitle-optimizer.mjs:462-489` 的 repair 只在第一次 validation 失敗時送出一次，repair response 再使用同一 `validateBatch`；`247-284` 的 cue 數量、ID、順序、非空文字與長度 guards 未被放寬，`491-496` 只在 validated 結果成功後寫入 checkpoint。
  - `03-FUNCTIONAL-DESIGN.md:137,149` 明確保留 repair 後完整 strict validation；`03-FUNCTIONAL-DESIGN.md:153` 的 LM Studio current-support policy 未被本輪改成 active repair 目標。

## 3. 邊界情況

- 判定：通過
- 證據：
  - 本輪 2026-10-21 12:46:13 +0800 執行唯讀 inline boundary probe，使用 deterministic mock 覆蓋缺失欄位、`null`、`''`、`'  '`、空陣列與 `{ text: '   ' }`；每案 Ollama 恰為兩次 response、第二次成功後產生兩筆 suggestions，且 repair prompt 含「未回傳內容」。
  - 同一 probe 實測 `lm-studio` 與 `openai-compatible` 空內容各只呼叫一次，錯誤 code 為 `empty_content`；沒有因本輪改動而重送 repair。
  - 同一 probe 以錯誤 ID、錯誤數量、交換順序與空白文字作為 Ollama repair 後 payload；每案總計兩次 response、拒絕結果且 checkpoint 保持 `null`，未進入第三次 repair。
  - `scripts/test-ai-optimizer.mjs:419-476` 固定 Ollama 空白／缺失內容、repair 後仍空白、兩次 response 上限、無 checkpoint 與非 Ollama strict；`478-556` 保留 LM Studio compatibility、nested wrapper 與 failed repair guards。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - `git diff` 顯示程式變更集中於 parser error classification、Ollama provider gate、既有 repair prompt 與 deterministic tests；沒有另建寬鬆 parser，也沒有修改 endpoint、streaming、timeout 或 batch checkpoint 主流程。
  - `node --check lib/ai/subtitle-optimizer.mjs` 與 `node --check scripts/test-ai-optimizer.mjs` 於 2026-10-21 12:45:27 +0800 均 exit 0；`git diff --check` 於本輪 exit 0。
  - `git status --short --untracked-files=no` 僅顯示原先的 6 個 tracked 差異；本輪未修改 source、test、治理來源文件、evidence 或 round1 原件。
  - round1 原件在本輪寫入前的 SHA-256 為 `b12d4e9f8f01935a41486de5518ba6dc140a285b2b9a9d2297210462eae53705`；本 round2 僅新增獨立報告。

## 5. 測試覆蓋

- 判定：通過
- 證據：
  - 2026-10-21 12:45:27–12:45:28 +0800：`node --check lib/ai/subtitle-optimizer.mjs`、`node scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-fetch.mjs` 與 `node scripts/test-project-docs-validator.mjs` 均 exit 0。
  - 2026-10-21 12:45:30–12:45:50 +0800：完整 `npm run check` exit 0；輸出包含 `docs:check` 19 個文件通過、全套 JavaScript syntax checks、核心 regression、AI optimizer／provider、Ollama offline／UI／stream 與 YouTube suites 通過。
  - 2026-10-21 12:46:13 +0800 的獨立 boundary probe exit 0；`git diff --check` exit 0。上述測試均為 deterministic mock、offline fixture 或本機受控 regression，不被宣稱為真實 Ollama 模型品質或 FR-021 完整驗收。
  - `npm run docs:check:final` 不是產品測試失敗，而是目前 08 與 round1 引用格式仍未完成同步的治理 gate；其 exit 1 必須在主要代理將本 round2 結論逐字鏈回 08 後重新驗證。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 本輪實際讀取 preflight 指定文件、目前 source／test／03／06／07／08 diff、round1 原件與 `scripts/project-docs-validator.mjs`；未修改 round1，也未建立任何 evidence 或其他 review。
  - 所有功能驗證均使用 mock／fixture；本輪沒有啟動真實 Ollama 或 LM Studio endpoint、沒有下載模型、沒有修改 OS／網路、沒有打包、發布、推送或修改既有 Release 資產。完整 check 的 Ollama 相關案例為 offline／missing-model／bundle contract tests，輸出明確為 no download／no Ollama model required。
  - `npm run check` 與 focused tests 的實際結果均為 exit 0，且 inline probe 證實缺失／空白內容分類、Ollama 一次性 repair、repair 後 cue／checkpoint guards、非 Ollama strict 與 LM Studio policy 均符合需求。
  - 但 2026-10-21 12:46:15 +0800 的 `npm run docs:check:final` exit 1，故 round1 的「08 結案欄位與 final gate」條件在目前 worktree 尚不能宣稱已完全解除。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 BUG-052 邏輯複審通過：缺失／空白 `message.content` 正確分類為 `empty_content`，只有 Ollama 對此錯誤執行一次 JSON repair，repair 後仍受 cue 與 checkpoint strict guards 保護，非 Ollama 維持 strict failure，LM Studio policy 未變；focused／完整 deterministic 驗證、git diff --check 與本輪 boundary probe 均通過，但 round1 closeout condition 尚未完全解除，因目前 `08-CHANGE-LOG.md` 尚未鏈回本 round2 可解析報告且 `npm run docs:check:final` 仍 exit 1；主要代理完成該唯一文件同步後，須重跑 final gate 才可改判通過。**
- 阻擋問題（若有）：
  1. 主要代理須將 `08-CHANGE-LOG.md` 的 BUG-052「獨立審查結論」改為可解析地連結本 round2 報告，並逐字引用本報告上述完整結論句；不得修改 round1 原件。
  2. 完成上述唯一文件同步後，重新執行 `npm run docs:check:final` 並保存 exit 0；在此之前不得宣稱 round1 closeout condition 已解除或本工作已無條件通過。
- 剩餘風險：
  - 尚無真實 Ollama raw response、不同模型／版本、真正斷網、Windows 實機或 FR-021 完整本機流程證據；deterministic／offline 測試不代表模型品質或 live endpoint 成功。
  - 真實模型仍可能回傳 malformed JSON、錯誤 cue contract、語言或品質不合；現行 strict validation 會拒絕並避免寫入完成 checkpoint，但不保證生成成功。
  - LM Studio runtime／registry／deterministic compatibility tests 與歷史文件仍保留作相容性／追溯，不代表 active support 或本輪實機驗收。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告唯一寫入路徑為 `docs/project-management/reviews/2026-10-21-ollama-empty-content-repair-round2.md`；round1 原件 SHA-256 維持 `b12d4e9f8f01935a41486de5518ba6dc140a285b2b9a9d2297210462eae53705`，未修改 source、test、治理來源文件、既有 evidence 或既有審查報告。
- 未啟動真實 Ollama／LM Studio、未下載模型、未修改 OS／網路、未發布或推送。
- 若上述聲明不實，本報告無效。
