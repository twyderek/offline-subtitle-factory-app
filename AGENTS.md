# 專案協作規範

## 任務開始

1. 先判定任務類型：`general`、`governance`、`requirements`、`development`、`debug`、`release`；不確定時用 `full`。
2. 執行 `npm run project:preflight -- --type=<類型>`。
3. 只讀 preflight 列出的「固定核心」與「任務路由」內容；`08-CHANGE-LOG.md` 只需讀範本規則與最新工作條目，除非任務需要歷史追溯。
4. 在 `08-CHANGE-LOG.md` 建立最新條目後才修改；保留並避開既有工作樹變更。

## 執行與結案

- 先維護可執行計畫，再依變更等級完成測試與文件同步。
- 開發完成後啟動獨立上下文審查代理。除建立本輪 `reviews/` 報告外，審查代理不得修改任何檔案；須逐項驗證需求完整性、邏輯正確性、邊界情況、程式碼品質、測試覆蓋、實際運行結果。
- 問題由主要代理修正；影響結論時建立下一輪報告複審，不覆寫舊報告。
- 完成後補齊工作條目並執行 `npm run docs:check:final`。最終交付分開呈現開發驗證、獨立審查與剩餘風險。
- 發布工作須引用本次授權或 `09-STANDING-AUTHORIZATIONS.md` 的有效常設授權；仍須揭露風險並完成版本、SHA、資產及下載核對。

完整路由、責任與停止條件以 `docs/project-management/README.md` 為準。文件與實況不一致時先查證；無法確認標示「待確認」，不得臆測或補造證據。
