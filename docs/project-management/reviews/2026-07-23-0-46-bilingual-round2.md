# 獨立審查報告：0.46.0 雙語字幕完整功能

- 審查對象 commit／版本：目前工作樹／0.45.2；以複審時工作樹內容為準
- 對應 08-CHANGE-LOG 條目：2026-07-23 — 0.46.0 雙語字幕完整功能
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-07-23；獨立委派上下文，未沿用開發代理對話記憶

## 1. 需求完整性

- 判定：部分通過
- 證據：`server.mjs:3705-3740` 已宣告 `bilingualPath`／`layoutPath`，`scripts/test-core.mjs:398-424` 實際覆蓋雙語校稿包保存、`review-data` 重新載入與 ASS 下載；`public/review.js:891-925` 提供原文／譯文欄位與 `public/review.html` 的排列控制。FR-016～FR-019 的主要入口已建立，但規則套用仍把排列後的雙語 SRT 送入既有單文字規則流程，尚未證明雙欄語意保留。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：round1 指出的保存 handler 未宣告路徑已修正；`save-review-package` 現在先以 `parseSrtBilingual` 比對 cue 數量與 start／end，再寫入 `bilingual-cues.json`。`public/bilingual-subtitles.mjs:35-47` 會將舊單語 cue 的兩欄填為同一文字，`renderCueText` 與 server ASS 路徑使用相同排列規則。剩餘問題是 `applyRulesToAll`（`public/review.js:1040-1060`）仍只傳 `buildSrt()` 的合併文字給 `/apply-rules`，server 的 `applyRulesToReviewSubtitle` 也只處理單一 `text`，因此套用規則後可能把原文／譯文合併為單欄；AI 建議只透過 `text` 更新譯文，沒有 source／translated 專用 contract。

## 3. 邊界情況

- 判定：部分通過
- 證據：`scripts/test-bilingual-subtitles.mjs` 覆蓋單語遷移、上下排列、SRT／VTT、無效時間碼與空文字；`test-core.mjs:398-424` 覆蓋保存／重新載入及 ASS。保存 package 會比對 cue 數量與時間碼，但沒有保存 API 的 ID／順序驗證（正規化會直接重新編號），也沒有雙語規則、AI、分割／合併的自動案例。`splitCue`（`public/review.js:1110-1140`）將分割後 source／translated 都設為同一個文字，會丟失原本譯文；因此雙語分割是未處理的資料遺失邊界。合併則分別合併兩欄，邏輯較完整但沒有測試。

## 4. 程式碼品質

- 判定：部分通過
- 證據：雙語模型與序列化集中於 `public/bilingual-subtitles.mjs`，保存驗證也已集中在 server handler；`git diff --check` 與 `node --check server.mjs` 通過。但該模組第 1 行 `TIMECODE` 未使用，`public/review.js` 仍保留未使用的舊 `parseSrt` 與單文字原始欄位，並且規則／AI 流程沒有明確的雙語資料邊界，增加維護與回歸風險。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-07-23 複審執行 `npm run check`，在允許本機 listen 的受控環境完整通過：治理、語法、媒體、雙語模型、AI optimizer、provider、review UI、core 回歸均成功。core 新案例實際驗證雙語保存、重新載入與 `/subtitle?format=ass`。仍未覆蓋雙語規則保持、AI source／translated contract、分割／合併、FFmpeg ASS parser／實際燒錄、Electron／Windows／macOS renderer。

## 6. 實際運行結果

- 判定：部分通過
- 證據：核心 HTTP 測試在受控環境實際成功完成，包含雙語校稿包保存、`review-data` 回傳 `translatedText` 與 ASS 下載；`npm run check` 全部通過。尚未執行 Electron／瀏覽器手動操作、FFmpeg 實際 ASS 燒錄或 Windows／macOS 實機，因此不能宣稱完整平台驗收或發布就緒。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪 0.46.0 round2 獨立複審結論為不通過：round1 指出的雙語校稿包保存執行期錯誤已修正，雙語保存／重新載入、時間碼比對、ASS 下載與 `npm run check` 已通過，但規則套用仍可能合併並丟失 sourceText／translatedText、雙語 AI contract 尚未建立、分割會將原有譯文覆蓋且缺少對應測試，另未完成 FFmpeg／Electron／Windows／macOS 實際驗證，因此目前不能宣稱 0.46 所有規劃內容已完成。**
- 阻擋問題（若有）：修正規則套用的雙語資料流；AI 優化需明確只更新 translatedText 並保留 sourceText；分割需按兩欄分別切分或明確阻止雙語分割；補上規則／AI／分割／合併測試與 FFmpeg／renderer 驗證。
- 剩餘風險：0.46 仍不可視為完成或可發布版本；平台實機、封裝與雙語 ASS 實際燒錄未覆蓋。
- 給主要開發代理的具體修正要求（若有）：先處理上述雙語欄位資料遺失路徑，再建立 round3 複審；不得以目前 `npm run check` 通過取代未覆蓋的雙語流程與實機驗證。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
