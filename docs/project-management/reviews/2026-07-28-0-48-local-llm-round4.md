# 獨立審查報告：0.48 本機 LLM 基礎支援取消續跑修正

- 審查對象 commit／版本：工作樹基準 `82af544b112423afafba8940cb5ff59e701177c7`／`0.48.0`，分支 `codex/0.48-local-llm`；包含本輪 `server.mjs`、`scripts/test-core.mjs` 與治理文件未提交差異。
- 對應 08-CHANGE-LOG 條目：2026-07-28 — 0.48 本機 LLM 基礎支援
- 審查輪次：round4
- 審查代理啟動時間、上下文來源：2026-07-28（Asia/Taipei）；獨立審查上下文自行讀取 round1／round2／round3、目前完整差異、必要 server／測試程式與文件，未沿用主要代理的評價性記憶。

## Findings

### 阻擋／高嚴重度

- 無。已有 checkpoint 的取消任務現在保留可續跑狀態，且新測試實際確認恢復只處理未完成批次。

### 中／低嚴重度

- 無新的未處理問題。真實 Ollama／LM Studio、真正斷網、Windows renderer 與 macOS DMG 安裝後仍是版本級未完成項，文件已明確揭露。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `server.mjs:680-686` 將 `record.retryable` 改為 `record.checkpoint.nextBatchIndex > 0 || (!controller.signal.aborted && Boolean(error.retryable))`；因此取消不再無條件抹掉已有 checkpoint 的可續跑性。
  - `scripts/test-core.mjs:462-493` 新增「第一批完成、第二批 slow、取消、恢復」流程，直接覆蓋本輪修正目標。
  - `docs/project-management/00-CURRENT-STATUS.md`、`06-TEST-AND-PROCESS-AUDIT.md` 與 `08-CHANGE-LOG.md` 均把修正描述為已有 checkpoint 取消續跑，並維持 0.48 開發中及真實模型／斷網限制。
  - 因 FR-021 的真實模型與斷網門檻尚未完成，本輪只能對修正與測試需求部分通過，不能判定版本完成。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - 沒有 checkpoint 的取消路徑仍由 `scripts/test-core.mjs:448-460` 驗證 `retryable === false`，避免任意取消都能續跑。
  - 有 checkpoint 的取消路徑先等待檔案 `checkpoint.nextBatchIndex === 1`，再取消並斷言 `retryable === true`（`scripts/test-core.mjs:474-478`）。
  - 恢復後 fake server 收到的 cue IDs 僅為 `[2]`（`scripts/test-core.mjs:480-493`），證明第一批不會重送。
  - 修正的布林式保留既有錯誤 retryability，同時以 checkpoint 優先；永久錯誤已有 checkpoint 仍可續跑，沒有因 abort 分支而遺失恢復能力。

## 3. 邊界情況

- 判定：通過（本輪範圍）
- 證據：
  - slow-after-first 只讓包含 cue 2 的批次延遲（`scripts/test-core.mjs:70`），所以測試能區分「第一批已 checkpoint」與「第二批正在 HTTP 中」。
  - 測試在取消前等待第一批 checkpoint，避免取消時序早於 checkpoint 寫入造成假陽性。
  - 取消後等待底層 response `close`、再呼叫 resume，確認不是只改狀態文字而未中止 HTTP。
  - 完整回歸仍覆蓋無 checkpoint 取消、429 重試、永久第二批失敗與既有續跑；本輪未發現跨批次重送或錯誤分類回歸。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - production diff 僅兩行 retryable 判定，沿用既有 `record.checkpoint.nextBatchIndex` 與錯誤分類欄位，變更集中且容易回溯。
  - 測試以明確 fake mode、重設計數器與 finally 清理 server，避免依賴不穩定 sleep 或跨案例污染。
  - 文件逐項說明「無 checkpoint／有 checkpoint」、只續跑未完成批次，並未將 fake server 證據寫成真實模型驗收。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-28T11:31+08:00 在允許 loopback listener 的環境執行 `node scripts/test-core.mjs && npm run check && git diff --check`，全部通過。
  - `npm run check` 完整輸出包含治理、語法、preflight、授權、validator、媒體、雙語、品質、Whisper metadata、AI optimizer、provider、review UI 與 core 回歸。
  - 本輪新增測試實際涵蓋：已有 checkpoint 取消可續跑、第二批 HTTP 中止、resume API、第一批不重送；文件 `06-TEST-AND-PROCESS-AUDIT.md` 已同步。
  - 尚未覆蓋真實模型、斷網、Windows renderer、macOS DMG 安裝後；這些仍是版本完成門檻而非本輪修正阻擋。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 核心測試實際通過，輸出為「核心回歸測試通過」，且同一執行包含本輪新增取消／續跑案例。
  - `docs/project-management/00-CURRENT-STATUS.md` 明確列出已修正 checkpoint 取消誤標不可續跑，並將真實模型、真正斷網、Windows renderer、macOS DMG 安裝後列為待驗收。
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md` 明確區分 fake server 自動回歸與平台實機門檻；`08-CHANGE-LOG.md` 的開發驗證結果同樣未誇大。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無；本輪 retryable 修正及「已有 checkpoint 取消後只續跑未完成批次」證據充分，未發現新的合併阻擋。
- 剩餘風險：
  - 測試仍是 fake OpenAI-compatible server，不能替代 Ollama／LM Studio 真實模型品質、版本相容與模型載入驗證。
  - 真正移除外網後的端到端流程尚未執行。
  - Windows renderer、macOS DMG 安裝後與乾淨使用者資料驗收尚未完成。
- 給主要開發代理的具體要求：
  1. 可保留本輪 production 修正與測試，將 round4 報告連結至工作條目。
  2. 0.48 仍須維持開發中；完成或發布前補齊真實 Ollama／LM Studio、斷網、Windows 與 macOS DMG 證據。

**本輪「2026-07-28 — 0.48 本機 LLM 基礎支援」round4 獨立複審結論為有條件通過：`server.mjs` 已修正已有 checkpoint 的取消任務被非同步錯誤處理覆寫為不可續跑的問題；核心測試實際覆蓋第一批完成後第二批 HTTP 中止、取消後 `retryable=true`、resume API 與只送出未完成 cue `[2]`，並通過 `npm run check` 與 `git diff --check`，文件亦準確揭露 fake server 與尚未完成的真實模型、斷網及跨平台驗收；本輪無新的合併阻擋，但 0.48 仍不得宣稱完成或發布就緒。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、測試與驗證，未修改任何其他專案來源或治理檔案。
- 若上述聲明不實，本報告無效。
