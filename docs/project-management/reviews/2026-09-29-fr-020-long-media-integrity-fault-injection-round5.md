# 獨立審查報告：FR-020／NFR-006 長音訊完整性 fault injection（round5）

- 審查對象 commit／版本：0.51.0；分支 `codex/0.51-anthropic-claude`；目前工作樹含既有未提交變更，本輪未改動它們。
- 對應 08-CHANGE-LOG 條目：`2026-09-23 — FR-020／NFR-006 長音訊輸入媒體完整性 fault injection`（`docs/project-management/08-CHANGE-LOG.md:3-25`）。
- 審查輪次：round5。
- 審查代理啟動時間、上下文來源：2026-09-29，以本輪獨立審查上下文檢視工作樹、round4 報告及指定程式／證據；先執行 `npm run project:preflight -- --type=development`，閱讀 preflight 列出的核心與 development 路由文件及獨立審查流程。round4 審查時間為 2026-09-29 09:10 Asia/Taipei（round4 報告第 6 行）。
- 範圍：審查 v10 cleanup fault injection、marker 路徑驗證、失敗時殘留清理、隱私與證據／文件一致性。未重跑 5,416 秒原片、完整 `npm run check`、Windows 實機或真實 Metal fallback。

## 1. 需求完整性

- 判定：部分通過，限本輪長媒體 probe 的 cleanup failure 與 evidence privacy 範圍。
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:36,61` 的 FR-020 是低可信片段工作流、NFR-006 要求變更可追溯及測試／文件／獨立審查；長音訊 integrity probe 的專屬界線見 `docs/project-management/03-FUNCTIONAL-DESIGN.md:121-123`。round4 要求 probe 層級注入真正刪除失敗、確認 root 仍存在、並斷言 failure evidence 與 exit 1（round4 報告第 53 行）；v10 harness 對應斷言位於 `scripts/accept-whisper-long-media-integrity-fault-injection.mjs:217-239`。
- 本結論不代表 FR-020 整體、字幕辨識品質或人工影音校閱完成；現行狀態也明確保留這些風險（`docs/project-management/00-CURRENT-STATUS.md:48-49`）。

## 2. 邏輯正確性

- 判定：通過核心故障控制流；marker 路徑授權仍有條件。
- 證據：preload 對 probe temp-root 的 `fs.rmSync` 呼叫先以 exclusive marker 記錄目標，再丟出 `code='EACCES'`，沒有呼叫原始 remover（`scripts/accept-whisper-long-media-integrity-fault-injection.mjs:62-75`）。父 harness 讀 marker、檢查路徑前綴、以原生 `lstat` 確認目錄存在，斷言 probe exit 1、evidence `status=fail`、`tempRootRemoved=false`、`TEMP_ROOT_CLEANUP_FAILED` 及錯誤 canary 不在 evidence；`finally` 清理後再斷言 `ENOENT`（同檔 `:217-247`）。probe 本身只有在 `lstat` 回報 `ENOENT` 時才視為清理成功，否則記錄 fail；非 pass 或 cleanup 未確認會設 exit 1（`scripts/whisper-long-media-evidence.mjs:23-45`、`scripts/verify-whisper-long-media.mjs:247-255`）。
- 路徑檢查目前只用 `cleanupTempRoot.startsWith(cleanupTempPrefix)`（harness `:219-224,240-243`），不是確認解析後的父目錄恰為 `os.tmpdir()` 並符合單一 `mkdtemp` basename。現行 marker 由 preload 從 probe 的 `mkdtemp` 所建 root 產生，故預期正常路徑受限；但若 marker 被錯置／污染，前綴相符的其他目錄仍可能被遞迴刪除。應收緊為解析後的精確直接子目錄與 basename 驗證。

## 3. 邊界情況

- 判定：round4 所列實際殘留情境已由程式與既有 v10 evidence 覆蓋；harness 自身 marker 失效時的殘留回收未完整保證。
- 證據：v10 七案涵蓋媒體及 SRT 修改／消失、自訂路徑與 basename 隱私，以及 `probe-cleanup-removal-failed-root-remains`。既有 evidence `docs/project-management/evidence/2026-09-29-whisper-long-media-integrity-fault-injection-v10.json:80-89` 記錄 probe exit 1、failure code、root 在父清理前存在、無錯誤 canary、父 harness 清理成功。父清理的 `finally` 在 marker 已讀取且前綴相符時可涵蓋後續 assertion 失敗（harness `:220-245`）。
- 若 marker 讀取失敗，`cleanupTempRoot` 尚未取得值；若 marker 不符前綴，`finally` 也不會清理它（harness `:217-224,240-245`）。此外，marker 寫入若在 preload 拋出 EACCES 前失敗，probe root 可能已建立但父 harness 沒有可用路徑。這些 harness 自身故障分支沒有被 v10 七案證明不留殘餘。建議讓 marker 驗證失敗成為明確、可診斷的測試失敗，並用不會擴大刪除範圍的方式處理可回收 root。

## 4. 程式碼品質／隱私

- 判定：證據隱私通過；路徑清理防護需補強。
- 證據：cleanup 錯誤 evidence 使用固定訊息與錯誤碼，不序列化原始錯誤（`scripts/whisper-long-media-evidence.mjs:37-45`）；v10 harness 斷言 `PRIVATE_CLEANUP_DIAGNOSTIC_CANARY` 未進 probe evidence（`scripts/accept-whisper-long-media-integrity-fault-injection.mjs:225-229`）。marker 內容是本機 temp-root 絕對路徑，但只寫入 harness 的暫存 case 目錄（`:194-200`），v10 JSON 僅記錄布林結果／固定錯誤碼，沒有該路徑或 transcript（evidence `:1-12,80-91`）；外層 harness finally 清理其暫存 root（harness `:263-265`）。若 assertion／process 中斷而未走到 finally，暫存 marker 仍可能留在系統 temp 目錄，故不能宣稱所有中斷情境皆已清除。

## 5. 測試覆蓋

- 判定：本輪已執行的 focused／文件／diff 檢查通過；v10 harness 本輪未重跑。
- 執行時間：2026-09-29 09:23:02 Asia/Taipei，macOS arm64、Node v22.22.3（環境版本亦見既有 v10 evidence `:4-8`）。
  - `node scripts/test-whisper-long-media-evidence.mjs`：exit 0，輸出 `Whisper evidence 隱私測試通過`。
  - `node scripts/test-whisper-long-media-integrity.mjs`：exit 0，unchanged、hash mismatch、missing-after 案例通過。
  - `npm run docs:check`：exit 0，19 個文件、版本 0.51.0 檢查通過。
  - `git diff --check`：exit 0。
- `npm run acceptance:whisper:integrity-fault-injection -- <repo 外新路徑>` 本輪未執行；v10 artifact 的建立時間為 `2026-09-29T01:14:34.705Z`（09:14:34 Asia/Taipei），且文件記錄七案通過，但不能將既有紀錄冒稱成本輪重播（evidence `:1-12,80-91`; `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:24-28`）。完整 `npm run check` 與 `npm run docs:check:final` 本輪未執行；前者依需求排除，後者尚未結案。

## 6. 實際運行結果

- 判定：既有 v10 evidence 與目前 harness 實作一致；round5 未獨立重現 harness 實際執行。
- 證據：round4 曾以 preload 先刪除再合成錯誤，未能證明 root 真正殘留（round4 報告第 26、53 行）。v10 source 改為刪除前讓 `rmSync` 呼叫丟出 EACCES，父 harness 原生 `lstat` 驗證目錄存在，最後清理並要求 `ENOENT`（`scripts/accept-whisper-long-media-integrity-fault-injection.mjs:62-75,217-247`）；既有七案 artifact 記錄同一結果（v10 evidence `:80-89`）。本輪實際執行的只有第 5 節所列兩個 focused tests、`docs:check` 與 `git diff --check`。
- 這是以 preload 在 `rmSync` 呼叫邊界注入 EACCES，並非由作業系統權限設定觸發的原生 filesystem permission denial；證據支持 probe 的刪除失敗處理與殘留確認控制流，不涵蓋所有 OS／filesystem 故障模式。

## 綜合判定

- 結論：**CONDITIONAL PASS（有條件通過）**，限 FR-020／NFR-006 長媒體 integrity probe 的 cleanup failure 與 evidence privacy 控制流。
- 阻擋問題：本輪未新發現 probe evidence 將 transcript／cleanup error canary 落盤；round4 指出的 root 實際殘留驗證在 v10 程式與既有 evidence 中已有對應，但本輪未重跑 harness。
- Conditions：
  1. 以 repo 外新 evidence 路徑重跑 v10 harness，確認七案、cleanup evidence、probe exit 1、原生 `lstat` 殘留，以及父清理後 `ENOENT`；在此之前，round5 不把這些視為本輪獨立實跑結果。
  2. 收緊 marker 路徑驗證為解析後精確位於 temp directory 的直接子目錄，並補明確處理 marker 缺失／無效時的失敗清理或殘留診斷，避免前綴相符路徑被當作授權刪除目標。
  3. 完成 `npm run docs:check:final` 後才可依專案流程結案；本輪只執行 `npm run docs:check`。
- 剩餘風險／未驗項：沒有重跑 5,416 秒來源影片、完整 `npm run check`、Windows 實機、真實 Metal crash／fallback、長片語意品質或人工影音校閱；本輪亦未驗證原生 OS 權限拒絕。來源完整性 hash 不證明字幕正確性或來源 SRT 是 ground truth（`docs/project-management/03-FUNCTIONAL-DESIGN.md:123`）。
- 給主要開發代理的具體要求：按上述 Conditions 執行 repo 外 v10 重播並補強 harness 的路徑授權／marker 失效收尾；如因此修改影響本結論，依流程另建下一輪報告，不覆寫本報告。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、`npm run project:preflight -- --type=development`、本報告所列兩項 focused tests、`npm run docs:check` 與 `git diff --check`；未執行 v10 harness 或其他未列測試，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
