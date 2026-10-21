# 獨立審查報告：SYNC-028／BUG-051 AI 校稿回應 parser 修正

- 審查對象 commit／版本：目前 worktree `0.52.0`、基準 `72019ca`；對照 `origin/codex/ai-cues-response-repair@056d2ad71d8b3ea982be9ccbceba19b9e98760b3`
- 對應 08-CHANGE-LOG 條目：2026-10-21 — GitHub AI 校稿回應修正同步與現行版本整合（SYNC-028）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-21 09:57:23 Asia/Taipei；獨立讀取 `AGENTS.md`、project-management 核心／路由文件、最新 `08-CHANGE-LOG.md` 條目、需求／設計／測試／偵錯紀錄與目前 worktree diff；未沿用開發代理的評價或結論。
- 審查範圍：AI cue JSON candidate parser、root array／explicit `cues` 邊界、nested wrapper 負向行為、Ollama／LM Studio 一次性 local repair、非 local strict failure、JSON Schema response format、相關測試／治理紀錄與既有 dirty tree 保護。不包含真實模型品質、FR-021 完整本機人工流程或既有 0.52.0 發布資產重驗。

## 1. 範圍與需求

- 判定：通過。
- 證據：最新條目 `docs/project-management/08-CHANGE-LOG.md:3-18` 明確列出 `SYNC-028`、`BUG-051`、`FR-008`、`FR-010`、`FR-021`、成功條件與不在範圍。`docs/project-management/03-FUNCTIONAL-DESIGN.md:137-151` 定義根 JSON array、explicit `cues`、text-part／wrapper／fence／周邊文字與 local repair 邊界；`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:24-26,37,48-54` 保留 cue 鎖定、checkpoint 及 FR-021 實機驗收例外。
- worktree tracked diff 僅涉及 `lib/ai/subtitle-optimizer.mjs`、`scripts/test-ai-optimizer.mjs` 及本輪列明的 4 份 project-management 文件；未見 server、UI、provider registry、封裝或 Release 檔案被本輪修改。

## 2. 實作正確性

- 判定：通過，未發現產品邏輯阻擋。
- 證據：
  - `lib/ai/subtitle-optimizer.mjs:99-184` 將 text fragments、BOM／Markdown fence、平衡括號 candidate 掃描集中處理；`findJsonValueEnd` 會處理字串內 escaped quote／括號。
  - `lib/ai/subtitle-optimizer.mjs:187-213,215-241` 只在最外層字串 candidate 允許 root array；wrapper 遞迴傳入 `false`，只接受明確 `cues` array，並跳過 wrapper 直接持有的無關 array。
  - `lib/ai/subtitle-optimizer.mjs:339-343,454-473` 將 JSON／缺少 `cues` 的 repair 限定於 `ollama`／`lm-studio`；修復後再次走同一 strict validation，非 local provider 不進 repair。
  - `lib/ai/subtitle-optimizer.mjs:79-85,435-442` 讓 JSON Schema 優先於 `json_object`，並由 `buildJsonRepairBody` 的 body spread 保留同一 response format。`lib/ai/openai-compatible.mjs:139-147` 只移除 internal chat fields，不移除 `response_format`。
  - `lib/ai/subtitle-optimizer.mjs:485-490` 只在整批驗證成功後寫入 checkpoint；失敗 repair 不會寫完成 checkpoint。

## 3. 測試證據

- 判定：通過；覆蓋與本輪需求相符，未發現回歸阻擋。
- 實際執行（2026-10-21 09:55:39 Asia/Taipei 起）：
  - `node --check lib/ai/subtitle-optimizer.mjs`：通過。
  - `node --check scripts/test-ai-optimizer.mjs`：通過。
  - `node scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-fetch.mjs`：均通過。
  - `npm run check`：通過；包含 19 份治理文件、完整核心 regression、AI／Ollama suites、offline／UI／stream suites 與 YouTube suites。
  - `git diff --check`：通過。
  - `npm audit --omit=dev`（2026-10-21）：`found 0 vulnerabilities`。
- `scripts/test-ai-optimizer.mjs:41-139` 覆蓋 root array、fence／周邊文字、text-part、nested explicit `cues`、JSON Schema／repair 保留、一般 `json_object` 與停用 response format；`:397-497` 覆蓋 Ollama／LM Studio 單次 repair、nested unrelated array／nested root array 負向案例、非 local 一次 strict failure 與失敗 checkpoint。
- 另以唯讀 inline matrix 實測 `response`、`output`、`result`、`data`、`content`、`message` 六個 wrapper：各自 explicit `cues` 通過；serialized root array、fenced/prose serialized root array 與 text-part root array 均 strict failure；最外層 root array 及 fenced root array 通過。結果：`custom parser boundary matrix passed`。
- 測試界線：本輪使用 deterministic mock，未啟動或呼叫真實 Ollama／LM Studio endpoint；這與條目及設計文件明確保留的 FR-021 實機／模型品質未完成一致，不把 mock 結果冒充實機驗收。

## 4. 治理／文件一致性

- 判定：部分通過；有一項結案阻擋（P1，治理流程，不是產品回歸）。
- 通過證據：`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9`、`06-TEST-AND-PROCESS-AUDIT.md:3-9` 與 `03-FUNCTIONAL-DESIGN.md:137-151` 對 parser 邊界、repair 次數、strict failure、Schema 保留及測試限制的描述與程式一致。既有 dirty tree 中未追蹤 evidence／歷史報告未被本輪 tracked diff 修改；測試後 tracked status 仍只有本輪預期的 6 個 modified paths。
- P1 結案阻擋：`npm run docs:check:final`（2026-10-21）失敗，輸出為：最新工作紀錄缺少「獨立審查是否執行：」與「發布授權：」、最新工作紀錄尚未標示「完成」，且獨立審查欄位不能為待執行。對應 `docs/project-management/08-CHANGE-LOG.md:3-18` 目前仍為「狀態：進行中」，也尚未連結本報告。這阻擋本輪治理結案／final gate；主要代理需補齊條目欄位、逐字引用本報告判定並重跑 final gate。
- 此 P1 不等同發布授權缺失或產品發布阻擋：本輪條目明確是不發布、不打包、不修改既有 Release；但 validator 的 required field 仍須以「不適用」等誠實值補齊，不能省略。

## 5. 回復／風險界線

- 判定：通過，無新增回復或資料完整性阻擋。
- 證據：本輪程式差異集中於 parser／response-format decision／測試；未改 checkpoint schema、cue 時間碼或原始字幕寫入路徑。`buildJsonRepairBody` 保留原批次 cue IDs／順序輸入，修復結果仍受 `validateBatch` 的 ID、數量、順序、文字長度與語系規則約束。
- 失敗界線已實測：第二次 JSON repair 仍缺 `cues` 時呼叫次數為 2 且 checkpoint 為 null；非 local nested array／missing `cues` 僅呼叫 1 次並拒絕；nested wrapper root array 即使 cue-shaped 也不被升格。未觀察到無界 retry、假成功或未驗證 checkpoint。
- 既有 dirty tree 保護：`git diff --name-status HEAD` 僅列出本輪 6 個 tracked paths；未追蹤 evidence／既有 review 檔仍保留，未執行 reset、checkout、刪除或覆蓋操作。測試與 audit 後未新增本輪以外的 tracked 修改。
- 遺留風險：candidate scanner 仍是格式容錯層，不是模型品質保證；真實模型可能輸出不合約文字、品質或語系，仍需人工接受。FR-021 所列 LM Studio／Ollama 完整實機、真正斷網與模型品質驗收不由本輪完成。

## 6. 發布／安全影響

- 判定：通過；本輪無發布阻擋、無新增隱私或供應鏈阻擋。
- 證據：條目 `08-CHANGE-LOG.md:9,13,17` 明確排除打包、tag、Release、PR、推送；`git diff --name-status HEAD` 未包含 `package.json`、`package-lock.json`、`.github/`、`RELEASE-NOTES-*`、README、server、Electron 或 UI 路徑。既有 `v0.52.0` Release 不在本輪範圍。
- 對本輪新增行執行唯讀 privacy／secret scan，未命中本機絕對路徑、API key、Authorization／Bearer、secret、token、password 或 private-key material。`npm audit --omit=dev` 為 0 vulnerabilities；無依賴變更，故沒有新 production dependency 風險。
- JSON parser 只形成待人工接受建議，未放寬 cue ID／數量／順序／時間碼驗證；local repair 不會把非 local provider 轉成寬鬆模式。這是安全／資料完整性上的正向界線，但不代表真實 endpoint 或完整 FR-021 privacy acceptance 已完成。

## Findings 摘要

| Severity | Finding | 阻擋 | 狀態 |
|---|---|---:|---|
| P1 | 最新 `08-CHANGE-LOG.md` 條目尚未補獨立審查／發布授權欄位及完成狀態，`npm run docs:check:final` 失敗。 | 是，僅阻擋治理結案 | 待主要代理補記後重跑 |
| — | parser／tests／response-format／dirty-tree／security 檢查未發現產品或發布阻擋。 | 否 | 通過 |

## 綜合判定

- 結論：**有條件通過**。
- 條件／阻擋問題：先由主要代理更新最新 `08-CHANGE-LOG.md`，補上本輪獨立審查欄位、逐字引用本報告判定、`發布授權：不適用` 的範圍說明與完成狀態，再執行 `npm run docs:check:final`。此條件解除前，不得把本輪標示為已結案。
- 綜合判定句：**本輪 SYNC-028／BUG-051 的 AI cue response parser、strict 邊界、local repair、Schema 保留、測試與既有 dirty tree 保護均通過；唯一阻擋是最新工作紀錄尚未完成獨立審查欄位與 final documentation gate，因此本輪判定為有條件通過。**
- 發布／隱私／回歸結論：未發現發布、隱私、秘密洩漏、依賴或產品回歸阻擋；本輪本身不授權任何發布操作。真實本機模型／FR-021 完整驗收仍是已揭露的剩餘風險。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案；唯一新增檔案為本報告。
- 本報告未寫入不必要的本機絕對路徑、秘密或原始使用者資料。
- 若上述聲明不實，本報告無效。
