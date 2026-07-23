# 獨立審查報告：0.46 規劃與移除簡體中文設定選項

- 審查對象 commit／版本：目前工作樹／0.45.2；以審查時工作樹內容為準
- 對應 08-CHANGE-LOG 條目：2026-07-23 — 0.46 規劃與移除簡體中文設定選項
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-23；獨立委派上下文，未沿用開發代理對話記憶

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:30` 新增 FR-015，明確要求兩個選單不提供簡體中文，既有 `zh-CN` 介面設定回退繁中，並保留自訂 BCP 47 API 相容性。`public/index.html:256-262` 移除介面語言選項；`public/review.html:202` 移除 AI 輸出選項。`docs/project-management/00-CURRENT-STATUS.md:49-53` 提供 0.46 雙語資料模型、遷移、校閱、輸出、驗證與 7–10 個有效工作日的規劃。

## 2. 邏輯正確性

- 判定：通過
- 證據：`server.mjs:369` 將介面語言白名單限制為 `zh-TW`／`en`，因此舊 `appLanguage: zh-CN` 會走 `defaultSettings.appLanguage`；`public/app.js:653-657` 不再產生 `zh-Hans`／`zh` 介面狀態；`lib/ai/languages.mjs:3-15` 移除簡體中文常用選項，但 `canonicalizeLanguageTag` 仍保留一般 BCP 47 標準化，符合 FR-015 對自訂 API 相容性的區分。

## 3. 邊界情況

- 判定：部分通過
- 證據：`scripts/test-core.mjs:15,168-169` 實際以舊設定 `appLanguage: zh-CN` 啟動並驗證回退 `zh-TW`；`scripts/test-review-ui.mjs:21-22` 驗證校閱頁不存在 `value="zh-CN"` 與 `簡體中文`；`scripts/test-ai-optimizer.mjs` 既有測試仍覆蓋非法語言、舊值回退與自訂 BCP 47。未見 Windows／macOS 實際瀏覽器設定載入畫面或既有使用者資料目錄的 UI smoke test，因此此面向仍有實機未覆蓋項目。

## 4. 程式碼品質

- 判定：通過
- 證據：修改集中於兩個 HTML 選單、介面語言正規化、AI 常用語言清單、核心／UI 測試及治理文件；沒有新增重複語言邏輯或改動字幕資料模型。`git diff --check` 通過，變更範圍與 BUG-013／FR-015 一致。

## 5. 測試覆蓋

- 判定：通過
- 證據：2026-07-23 審查期間執行 `npm run check`，結果包含 `docs:check` 通過、JavaScript 語法檢查通過、治理／媒體／optimizer／provider／review UI／core 測試全部通過；其中核心回歸實際通過設定回退，review UI 實際通過簡體中文選項不存在。另執行 `git diff --check` 通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：完整 `npm run check` 在允許本機 listen 的環境成功完成；輸出明確包含「校閱 UI 測試通過」與「核心回歸測試通過」。本輪未執行 Electron／瀏覽器手動操作、Windows／macOS 實機或打包後 renderer 驗證，因此不能將實際平台 UI 行為宣稱為已完成覆蓋。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無程式邏輯或自動測試阻擋問題。
- 剩餘風險：`08-CHANGE-LOG.md` 本條目在審查時仍為「進行中／待執行」欄位，主要代理需補齊實際修改、驗證、審查結果與遺留風險後結案；另需保留未執行 Windows／macOS 實機 UI smoke test 的揭露。0.46 的 7–10 日為目前估算，尚未以舊專案樣本與輸出格式測試排程確認。
- 給主要開發代理的具體修正要求（若有）：完成工作紀錄結案欄位，連結本報告並逐字引用本報告的綜合判定；若要宣稱平台驗收完成，另執行實際 Electron／跨平台 smoke test。未完成上述文件結案前，不應將本輪治理狀態標為完全完成。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
