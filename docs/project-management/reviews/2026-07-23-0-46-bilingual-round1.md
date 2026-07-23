# 獨立審查報告：0.46.0 雙語字幕完整功能

- 審查對象 commit／版本：目前工作樹／0.45.2；以審查時工作樹內容為準
- 對應 08-CHANGE-LOG 條目：2026-07-23 — 0.46.0 雙語字幕完整功能
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-23；獨立委派上下文，未沿用開發代理對話記憶

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:31-34` 新增 FR-016～FR-019；`public/bilingual-subtitles.mjs:9-67`、`public/review.html:90-96` 與 `public/review.js:828-843,889-925` 已涵蓋雙語正規化、舊單語載入、原文／譯文欄位、排列控制及 SRT／VTT／ASS 入口。`docs/project-management/08-CHANGE-LOG.md:60-61` 將保存 API 與自動測試描述為已完成，但尚未提供實際保存 API 成功證據。

## 2. 邏輯正確性

- 判定：不通過
- 證據：`server.mjs:3708-3716` 的 `save-review-package` manifest 使用 `bilingualPath`，但該 handler 內未宣告 `bilingualPath` 或 `layoutPath`；實際呼叫保存校稿包會在建立 manifest 時拋出 `ReferenceError`，因此 FR-016／FR-019 的保存 API 尚未可用。另 `server.mjs:3422-3425` 的 ASS 輸出路徑只在存在雙語 JSON 時啟用，且替換字串使用 `\\N`，需以實際 ASS parser／FFmpeg 驗證換行是否正確。

## 3. 邊界情況

- 判定：部分通過
- 證據：`scripts/test-bilingual-subtitles.mjs:4-17` 覆蓋單語遷移、雙語排列、SRT／VTT、無效時間碼與空文字；但沒有測試保存 API 的 cue 數量／時間碼一致性。`server.mjs:3719-3724` 只比較 cue 數量，沒有將雙語 cue 的 start／end 與 `payload.subtitle` 或原始 cue 逐一比對；`save-review:3683-3688` 甚至未執行數量或時間碼保護。規則套用仍以雙語排列後的 `subtitle` 傳給既有單文字規則流程，可能把原文與譯文合併成單一文字並失去雙欄語意；分割／合併亦未有雙語專門測試。

## 4. 程式碼品質

- 判定：部分通過
- 證據：`public/bilingual-subtitles.mjs` 集中處理模型與序列化，方向正確；但第 1 行 `TIMECODE` 未使用，且 `public/review.js:861-887` 保留未使用的舊 `parseSrt` 與舊單文字欄位路徑，增加雙模型維護歧義。更重要的是 server 保存 handler 引用未宣告變數，屬可直接避免的執行期錯誤。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：審查期間執行 `npm run check`；治理、語法、雙語資料模型、AI、provider、UI 靜態契約測試均通過，但 `scripts/test-core.mjs` 在 sandbox 執行時因本機 listen `EPERM` 中止，未完成核心 HTTP 回歸。現有雙語測試未涵蓋 `save-review`／`save-review-package`、`review-data`、`/subtitle?format=ass` 或 FFmpeg ASS 實際解析；`scripts/test-review-ui.mjs` 只做靜態契約檢查。

## 6. 實際運行結果

- 判定：不通過
- 證據：完整 `npm run check` 的前段測試通過，但核心 server 測試於 `127.0.0.1:21200` 因 sandbox `EPERM` 中止；沒有成功保存雙語校稿包、重新載入雙語資料或執行跨平台 renderer／FFmpeg 實測。依靜態程式碼已可確認 `save-review-package` 的未宣告 `bilingualPath` 會阻擋實際保存流程，故不能將 0.46 宣稱為完整可運行。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪 0.46.0 獨立審查結論為不通過：雙語資料模型、單語遷移、校閱欄位與基礎 SRT／VTT／ASS 表示已建立且部分自動測試通過，但 `save-review-package` 引用未宣告的 `bilingualPath` 會阻擋校稿包保存，保存／重新載入、cue 時間碼保護、規則／AI／分割合併相容性與 FFmpeg／跨平台實際驗證尚未完成，因此目前不能宣稱 0.46 所有規劃內容已完成。**
- 阻擋問題（若有）：修正 `save-review-package` 的雙語檔案路徑宣告與保存流程；補上保存／載入 API、cue 數量／時間碼保護、ASS／FFmpeg、規則／AI／分割合併與實際 renderer 測試。
- 剩餘風險：0.46 目前仍是工作樹功能，不是可發布版本；跨平台實機、封裝與輸出驗證未覆蓋。
- 給主要開發代理的具體修正要求（若有）：先修正未宣告變數造成的保存 API 執行期錯誤，再新增可實際呼叫的核心整合測試；保存前逐 cue 驗證數量、ID、順序與 start／end；讓規則／AI／分割合併明確維持 sourceText／translatedText；以 FFmpeg 或 ASS parser 驗證換行；修正後建立 round2 複審報告。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
