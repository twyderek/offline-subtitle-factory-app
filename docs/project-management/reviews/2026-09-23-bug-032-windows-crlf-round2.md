# BUG-032 Windows CRLF Breeze source-contract test 修正 round2

審查範圍：最新工作樹 diff、`docs/project-management/reviews/2026-09-23-bug-032-windows-crlf-round1.md`、BUG-032 相關治理紀錄，以及 `scripts/test-breeze-asr.mjs` 的 focused test／CRLF matcher 行為。

本輪只執行讀取、指令執行與驗證；未修改產品 runtime、`public/app.js`、公開 v0.51.0 Release 或 Windows 資產，未推送、未建立 tag／Release，未執行 Windows 實機驗收，也不將本輪結果宣稱為 Windows CI 已完成。

## Findings

- F-001｜嚴重度：中（未閉合的跨平台驗收缺口，非產品／Release 阻擋）｜位置：`docs/project-management/08-CHANGE-LOG.md:11-15`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:9-11`。修正後 Windows preview runner 尚未重跑，因此只能證明本機 CRLF fixture／focused test 與靜態 source-contract 結果，不能證明 Windows CI 已恢復。治理文件已如實揭露此限制。
- Round1 F-002｜狀態：已關閉。最新 `scripts/test-breeze-asr.mjs:154-182` 已抽出 `normalizeAppSource`、建立 `normalizedCrlfAppSource`，並以同一 `extractNoticeFunction` matcher 直接斷言正規化後 CRLF fixture 可擷取 `updateBreezePerformanceNotice`。
- 阻擋問題總結：未發現產品 runtime、公開 Release、測試修正實作或範圍控制的阻擋問題；唯一仍開放的是 Windows runner 尚未重跑。Windows 實機／安裝／renderer／轉錄品質不在本輪範圍。

## 1. 需求／範圍

- 判定：通過
- 證據：最新 diff 的產品行為變更僅限 `scripts/test-breeze-asr.mjs`，另有必要治理文件同步；`git diff --name-only` 未包含 `public/app.js`、`server.mjs`、`electron/`、`dist/`、`RELEASE-*` 或 `.github/workflows/`。BUG-032 目標仍是修正 Windows CRLF 造成的 source-contract 誤判，不修改產品 Breeze 行為、不重建／修改公開 v0.51.0 Release，且明確不把 Windows 實機驗收納入成功條件。

## 2. 實作正確性

- 判定：通過
- 證據：`scripts/test-breeze-asr.mjs:154-156` 將讀取到的 `public/app.js` 交由 `normalizeAppSource` 將 CRLF 正規化為 LF；`scripts/test-breeze-asr.mjs:157-159` 產生 CRLF fixture 並確認正規化後與 LF source 等價。`scripts/test-breeze-asr.mjs:179-182` 抽出共用 `extractNoticeFunction` matcher，分別對 LF `appSource` 與 `normalizedCrlfAppSource` 執行擷取斷言。`scripts/test-breeze-asr.mjs:183-192` 仍以 VM 執行 `updateBreezePerformanceNotice`，保留 Breeze 顯示／隱藏與文字內容 assertions；沒有修改 `public/app.js` 中的產品函式。

## 3. 跨平台重現與防回歸

- 判定：部分通過
- 證據：本輪唯讀 matcher replay 結果為 `roundTrip=true`、`lfExtracted=true`、`normalizedCrlfExtracted=true`、`crlfDirectExtracted=false`，直接證明 CRLF source 先正規化後可由同一 matcher 擷取函式，round1 F-002 的間接 fixture 缺口已補強。`node scripts/test-breeze-asr.mjs` 也實際通過所有既有 Breeze contract／行為 assertions。仍為部分通過，因修正尚未在 Windows preview runner 重跑；不能以 macOS／本機 fixture 證明 Windows CI 已恢復。

## 4. 測試證據

- 判定：部分通過
- 證據：本輪實際執行命令與結果如下：
  - `node scripts/test-breeze-asr.mjs`：通過，輸出 `Breeze ASR 25 模型契約、runtime 探針與 CLI 參數測試通過`。
  - `node --check scripts/test-breeze-asr.mjs`：通過，exit 0。
  - `git diff --check`：通過，exit 0。
  - `npm run docs:check`：通過，治理文件 19 個、版本 0.51.0。
  - 唯讀 CRLF／共用 matcher replay：`roundTrip=true`、`lfExtracted=true`、`normalizedCrlfExtracted=true`、`crlfDirectExtracted=false`。
  - `npm run docs:check:final`：失敗；最新 `08-CHANGE-LOG.md` 仍為「進行中」，且尚未填入可解析的本 round2 報告與逐字引用。這是治理結案狀態，不是 focused test 失敗。
  - 未執行：完整 `npm run check`、build、Windows runner 重跑、Windows 實機驗收與長時間測試。

## 5. 文件治理

- 判定：部分通過
- 證據：round1 報告已被重新閱讀；`07-DEBUG-AND-FIX-HISTORY.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`00-CURRENT-STATUS.md` 與 `08-CHANGE-LOG.md` 已記錄 BUG-032 根因、round1 F-002、最新 normalize／matcher 修正、未修改產品／Release 及 Windows runner 尚待重跑。`npm run docs:check` 通過，但 `docs:check:final` 仍因工作紀錄尚未標示完成與缺少本報告可解析引用而失敗；主要代理需在掛載本報告後完成結案回填。

## 6. 剩餘風險

- 判定：部分通過
- 證據：目前修正只保證 source-contract test 的 CRLF／LF 讀取等價與既有 Breeze notice 行為斷言，不證明 Breeze 真實 patched runtime、模型下載、Windows 安裝／renderer／轉錄品質或 Windows 實機驗收。既有 Windows preview failure 仍是有效歷史證據；只有修正後 runner 成功重跑，才能解除 BUG-032 的 CI 驗收缺口。macOS／公開 v0.51.0 Release 不需因本輪測試層修正重建或重新發布。

## 綜合判定

- 結論：有條件通過
- 可逐字引用完整結論句：**BUG-032 round2 已關閉 round1 F-002：`scripts/test-breeze-asr.mjs` 以 `normalizeAppSource` 建立 `normalizedCrlfAppSource`，並以共用 `extractNoticeFunction` matcher 成功擷取 `updateBreezePerformanceNotice`；focused test、syntax、CRLF matcher replay、diff 與一般文件檢查均通過，未發現產品／Release 或範圍外變更，因此本輪有條件通過，但 Windows runner 尚未重跑、CI 尚未證實恢復、Windows 實機驗收仍未完成，且治理 final gate 尚待主要代理結案回填。**
- 阻擋問題（若有）：無產品 runtime 或公開 Release 阻擋；Windows runner 尚未重跑是 BUG-032 的未閉合驗收缺口，治理 `docs:check:final` 也需由主要代理掛載本報告、回填逐字結論並將工作條目結案後重新執行。在此之前不得宣稱 Windows CI 或 Windows 實機驗收完成。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
