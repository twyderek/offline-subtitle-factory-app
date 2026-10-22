# BUG-032 Windows CRLF Breeze source-contract test 修正 round1

審查範圍：本輪工作樹 diff、`AGENTS.md`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md`、`docs/project-management/08-CHANGE-LOG.md`、`scripts/test-breeze-asr.mjs`，以及與 BUG-032 直接相關的 focused test／文件檢查。

本輪未修改產品 runtime、`public/app.js`、公開 v0.51.0 Release 或其他非本報告檔案；未建立 tag／Release、未推送、未執行 Windows 實機驗收，亦未將 Windows CI 修正宣稱為已完成。

## Findings

- F-001｜嚴重度：中（驗收缺口，非 macOS／產品 runtime 阻擋）｜位置：`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:9-10`、`docs/project-management/08-CHANGE-LOG.md:15`。修正後尚未由 Windows preview runner 重跑，因此 BUG-032 的 Windows 相容性成功條件仍未被遠端 CI 證實；目前只能證明本機 CRLF replay、macOS focused test 與既有本機完整回歸紀錄。文件已如實標示「尚待」且沒有宣稱 Windows CI 恢復。
- F-002｜嚴重度：低（測試強度改善建議，非本輪阻擋）｜位置：`scripts/test-breeze-asr.mjs:156-157`。新增 fixture 目前驗證 LF→CRLF→LF round-trip 等價，但沒有直接以 `crlfAppSource` 執行同一個 `updateBreezePerformanceNotice` source-contract matcher，再驗證正規化後成功；因此能支持正規化邏輯，但對「若未來移除正規化，測試必定失敗」的防回歸證據仍較間接。這不否定目前 `appSourceRaw` 先正規化後再進入所有 matcher 的實作正確性。
- 阻擋問題總結：未發現產品 runtime、公開 Release 或本輪測試修正本身的阻擋問題；F-001 是 Windows CI 尚未重跑的驗收缺口，F-002 是 fixture 強度改善建議。Windows 實機／安裝／renderer／轉錄品質仍不在本輪範圍。

## 1. 需求／範圍

- 判定：通過
- 證據：`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-11`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:18-23` 與 `docs/project-management/08-CHANGE-LOG.md:3-18` 均將 BUG-032 定義為 Windows CRLF 造成 Breeze source-contract test 誤判，成功條件是測試對 LF／CRLF 等價、不改產品 Breeze 行為，且明確排除 Windows 實機驗收、Breeze 真實 runtime／模型品質與 Release 變更。工作樹 diff 顯示只有 `scripts/test-breeze-asr.mjs` 與必要治理文件變更，`public/app.js` 無 diff，符合最小範圍。

## 2. 實作正確性

- 判定：通過
- 證據：`scripts/test-breeze-asr.mjs:154-155` 先讀取 `appSourceRaw`，再以 `replace(/\r\n/gu, '\n')` 產生供既有 source-contract matcher 使用的 `appSource`；未修改 `public/app.js` 或產品 runtime。`scripts/test-breeze-asr.mjs:177-179` 仍擷取 `updateBreezePerformanceNotice`，`scripts/test-breeze-asr.mjs:180-188` 保留並實際執行 Breeze 顯示／隱藏與文字內容行為斷言：選取 Breeze 時顯示效能提示，切回 Whisper.cpp 時隱藏並清空文字。自訂唯讀 replay 結果為 `lfMatch=true`、`crlfMatch=false`、`normalizedCrlfMatch=true`、`roundTrip=true`，與記錄的根因及修正方向一致。

## 3. 跨平台重現與防回歸

- 判定：部分通過
- 證據：自訂 CRLF regex replay 實際重現原始 LF-only matcher 在 CRLF 下失敗，並確認正規化後成功；`scripts/test-breeze-asr.mjs:156-157` 也保留 CRLF round-trip assertion。這證明修正涵蓋 Windows Git checkout 的 CRLF 邊界，且不改產品函式。不過 F-002 所述 fixture 沒有直接對 CRLF source 執行完整 matcher，防回歸契約仍屬間接；另外 F-001 所述 Windows runner 尚未以修正版重跑，因此跨平台證據尚未閉合。

## 4. 測試證據

- 判定：部分通過
- 證據：本輪實際執行命令與結果如下：
  - `node scripts/test-breeze-asr.mjs`：通過，輸出 `Breeze ASR 25 模型契約、runtime 探針與 CLI 參數測試通過`。
  - `node --check scripts/test-breeze-asr.mjs`：通過，exit 0。
  - `git diff --check`：通過，exit 0。
  - `npm run docs:check`：通過，治理文件 19 個、版本 0.51.0。
  - 唯讀 CRLF replay：`lfMatch=true`、`crlfMatch=false`、`normalizedCrlfMatch=true`、`roundTrip=true`。
  - 未執行：完整 `npm run check`、build、Windows runner 重跑、Windows 實機驗收與長時間測試。本機完整 `npm run check` 通過是本輪文件與既有開發驗證的可追溯紀錄，但不冒充本輪重新執行或 Windows 證據。

## 5. 文件治理

- 判定：部分通過
- 證據：BUG-032 已同步寫入 `07-DEBUG-AND-FIX-HISTORY.md:3-11`、`06-TEST-AND-PROCESS-AUDIT.md:18-23`、`00-CURRENT-STATUS.md` 與 `08-CHANGE-LOG.md:3-18`；文件明確記錄 CRLF 根因、最小測試層修正、沒有產品／Release 變更、Windows runner 尚待重跑及 Windows 實機仍暫緩。`npm run docs:check` 通過；`npm run docs:check:final` 唯讀執行失敗，原因是最新工作紀錄仍為「進行中」且尚未填入本報告路徑與逐字結論。這是待本輪主要代理完成結案回填的治理狀態，不是產品程式阻擋。

## 6. 剩餘風險

- 判定：部分通過
- 證據：修正只處理 `scripts/test-breeze-asr.mjs` 的 source-contract 讀取格式，沒有證明 Breeze 真實 patched runtime、模型下載、Windows 安裝／renderer／轉錄品質或 Windows 實機行為。GitHub Windows preview 既有失敗仍屬有效歷史證據；依 `07-DEBUG-AND-FIX-HISTORY.md:9-11`，需提交修正後重跑 runner，若仍失敗不得宣稱 CI 恢復。macOS／公開 v0.51.0 Release 不需因本輪測試層修正重建，且本輪沒有任何 Release 變更。

## 綜合判定

- 結論：有條件通過
- 可逐字引用完整結論句：**BUG-032 的最小修正僅在 `scripts/test-breeze-asr.mjs` 以測試層 CRLF→LF 正規化，保留 `updateBreezePerformanceNotice` 的顯示／隱藏行為斷言，且 focused test、CRLF regex replay、syntax、diff 與一般文件檢查通過，因此在目前 macOS／靜態範圍有條件通過；但 Windows runner 尚未以修正版重跑、CRLF fixture 未直接重放完整 matcher，且 `docs:check:final` 因工作條目尚未結案而失敗，Windows 實機驗收仍未完成。**
- 阻擋問題（若有）：無本輪產品 runtime 或 Release 阻擋；需由主要代理在提交修正後重跑 Windows preview runner，並補回工作條目、審查報告與逐字結論後重新執行 `npm run docs:check:final`。在此之前不得宣稱 BUG-032 已取得 Windows CI 通過，也不得宣稱 Windows 實機驗收完成。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
