# 獨立審查報告：補強獨立審查證據與發布授權治理

- 審查對象 commit／版本：`f781acbc14b61f7427c034bbe42f9e75804d6835` 工作樹差異／`0.45.1`（分支 `main`）
- 對應 08-CHANGE-LOG 條目：2026-07-20 — 補強獨立審查證據與發布授權治理
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-20 11:06 Asia/Taipei；由主要代理啟動的獨立審查上下文，僅收到審查範圍、需求 ID、指定文件與只讀限制，未沿用主要開發代理的對話記憶或評價性結論。
- 審查環境：macOS sandbox；Node.js `v22.22.3`、npm `10.9.8`。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:39-41` 定義 `NFR-006` 的變更追溯、自動測試、文件檢查及獨立審查，以及 `NFR-008` 的發布資產一致性。
  - `docs/project-management/01-PROJECT-GOVERNANCE.md:34-45` 已明定審查報告獨立化、主要代理只能逐字引用、歷史缺口不得補造，以及發布要求不等於風險授權；`docs/project-management/08-CHANGE-LOG.md:82-83` 與 `101-102` 也誠實保留兩類歷史缺口，未回溯補造。
  - `docs/project-management/01-PROJECT-GOVERNANCE.md:16-25` 已定義低／中／高／發布及發現實際影響後的升級規則；本次條目於 `docs/project-management/08-CHANGE-LOG.md:53-56` 分類為低，範圍明確排除產品行為與發布，分類與目前差異相符。
  - 但 `scripts/check-project-docs.mjs:71-103` 未完整實作工作紀錄範本及強制規則：未驗證逐字引用、完整綜合結論、審查檔命名／輪次、聲明內容、跳過理由與需求方同意，也未驗證發布授權欄位確實位於發布授權區塊。故「自動檢查能驗證新範本與結案語意」（`docs/project-management/08-CHANGE-LOG.md:55`）尚未達成。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - `scripts/check-project-docs.mjs:60-65` 對最新條目的整段文字執行 `/待執行/`、`/待確認/`，不是只解析欄位值或未決事項。最新條目在 `docs/project-management/08-CHANGE-LOG.md:60` 只是說明本次新增「待確認／待執行」語意，仍被 `docs:check:final` 判成未完成；這正違反 `docs/project-management/01-PROJECT-GOVERNANCE.md:64` 所要求不得混用或誤判兩種語意。
  - 2026-07-20 11:08:13 Asia/Taipei 執行 `npm run docs:check:final`，實際輸出同時包含「仍含待執行」及「含待確認但未在遺留風險說明」，即使該「待確認」只出現在描述檢查器語意的 `08-CHANGE-LOG.md:60`。這是可重現的結案誤判。
  - `scripts/check-project-docs.mjs:73-86` 只要求任意 `.md` 路徑及八個章節標題；沒有確認報告內的判定、證據、完整結論句或聲明文字。只有空章節標題的文件也能通過這段邏輯，造成獨立審查漏判。
  - `scripts/check-project-docs.mjs:98-101` 以 `latest.split('\n').find(...)` 搜尋全條目第一個同名字串，沒有先界定「發布授權」區塊；任意段落中的「核准人／角色／時間／範圍」非空文字即可被當成授權，可能把需求敘述或其他證據誤認為發布授權。

## 3. 邊界情況

- 判定：不通過
- 證據：
  - 已實測邊界：最新條目只是在「實際修改」敘述中引用保留字「待確認／待執行」（`docs/project-management/08-CHANGE-LOG.md:60`）。2026-07-20 11:08:13 Asia/Taipei 的 `npm run docs:check:final` 仍回報兩者為未決，證明敘述性引用會誤判。
  - 靜態路徑邊界檢查 `scripts/check-project-docs.mjs:77-80` 有把報告限制在 `docs/project-management/reviews/`，可阻擋一般目錄逃逸；但 `:73` 不限制規定的 `YYYY-MM-DD-<slug>-round<N>.md` 命名，錯誤日期、slug 或輪次仍會漏判。
  - `scripts/check-project-docs.mjs:92-94` 對「否」只檢查字首，未驗證 `docs/project-management/workflows/04-INDEPENDENT-REVIEW.md:77-80` 要求的低風險、跳過原因及需求方同意記錄；`否`、`否（無授權）` 均可繞過。
  - `scripts/check-project-docs.mjs:63-65` 只要求「遺留風險與後續事項」同一行再次出現「待確認」字樣，沒有檢查規範要求的事實、影響與追蹤方式（`docs/project-management/08-CHANGE-LOG.md:12`）；僅填「待確認」也會漏判。
  - 依只讀限制，未建立變造 fixture；上述漏判由明確控制流及正規表示式逐行驗證，誤判則以現有工作樹實際重現。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - `scripts/check-project-docs.mjs:1-47` 結構簡潔，集中列出文件與必要標記，並核對 `package.json` 版本；`node --check scripts/check-project-docs.mjs` 於 2026-07-20 11:08:13 Asia/Taipei 通過。
  - `scripts/check-project-docs.mjs:54-104` 把整個 latest entry 當非結構化字串，以 `includes`、跨段落 `find` 及全域保留字 regex 進行 final gate，造成欄位邊界不明、規則容易互相干擾。針對這種治理門檻，應先解析固定欄位與子區塊，再逐欄驗證值與交叉關係。
  - `scripts/check-project-docs.mjs:83-86` 的報告驗證只有標題存在性；程式輸出「獨立審查已驗證」的可信程度顯著低於治理文件宣稱，命名與實際能力不一致。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-20 11:08:13 Asia/Taipei：`npm run docs:check` 通過，摘要為「18 個文件，版本 0.45.1」；`git diff --check` 通過；`node --check scripts/check-project-docs.mjs` 通過。
  - 2026-07-20 11:08:19 Asia/Taipei：`npm run check` 的文件、語法、媒體、AI optimizer、provider、校閱 UI 測試通過；核心測試在 sandbox 監聽 `127.0.0.1:21751` 時因 `EPERM` 中止。
  - 隨後依授權於 sandbox 外執行 `npm test`，2026-07-20 11:08 Asia/Taipei 全部通過，包含核心 API、token、Origin、串流上傳、任務、真實聲波、修剪、字幕重算、還原、分頁與取消狀態。
  - 未見專門針對 `check-project-docs.mjs` 的正向／負向 fixture 測試；現有測試未覆蓋敘述性保留字、空審查章節、錯誤報告命名、跳過審查無授權、授權欄位出現在錯誤區塊等關鍵情境，因而未攔截本報告所列誤判與漏判。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 2026-07-20 11:06 Asia/Taipei 執行 `npm run project:preflight` 成功，列出版本 `0.45.1`、分支 `main`、工作樹有變更及 11 份必讀文件。
  - 2026-07-20 11:08:13 Asia/Taipei 執行 `npm run docs:check` 成功，證明一般文件存在性與標記檢查可運行。
  - 同一時間執行 `npm run docs:check:final` 失敗；目前條目原本確實尚在審查中，因此「狀態未完成」與「獨立審查是否執行不是是／否」兩項屬預期，但額外將敘述中的「待確認」當成風險缺漏，證實 final 語意實作不正確。
  - 2026-07-20 11:08 Asia/Taipei 於 sandbox 外執行 `npm test` 全部通過；本次治理差異未破壞既有產品回歸。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪獨立審查結論為不通過：治理文件已涵蓋審查證據獨立化、歷史缺口、發布授權與變更分類原則，但 `docs:check:final` 仍會誤判敘述中的「待確認／待執行」，且會漏判不完整審查報告、未授權跳過審查與欄位歸屬錯誤的發布授權，因此 NFR-006 與 NFR-008 的自動治理門檻尚未達成。**
- 阻擋問題（若有）：
  1. 修正 `scripts/check-project-docs.mjs:60-65`，讓 final gate 只依結構化未決欄位判斷「待執行」，並只對實際待確認事項要求遺留風險揭露，不得因敘述或測試說明引用保留字而誤判。
  2. 強化 `scripts/check-project-docs.mjs:71-94`：驗證規定檔名／輪次、六面向各自判定與證據、完整綜合結論句、阻擋問題及審查代理聲明；驗證 change log 的判定確為逐字引用；「否」必須驗證低風險、原因與需求方同意。
  3. 強化 `scripts/check-project-docs.mjs:96-103`：解析發布授權區塊並驗證「是否需要」、核准人／角色、時間、範圍均在正確區塊，避免全條目同名文字被誤認為授權；加入需求動作文字不得充當風險授權的負向測試。
  4. 為上述規則新增可重複的正向與負向 fixture 測試，至少覆蓋敘述性保留字、空章節報告、錯誤 round 路徑、未授權跳過、欄位錯置、發布風險未納入核准範圍。
- 剩餘風險：即使完成結構檢查，自動化仍無法證實核准人真實身分、判斷證據內容是否誠實充分，這些項目仍須人工審查；變更分類升級也含實際影響判斷，檢查器只能驗證已記錄分類與升級理由，不能完全自動決定正確等級。
- 給主要開發代理的具體修正要求（若有）：依四項阻擋問題修正檢查器與測試，重跑 `node --check scripts/check-project-docs.mjs`、治理檢查器情境測試、`npm run docs:check`、`npm run docs:check:final`、`npm run check` 與 `git diff --check`；修正會影響本輪結論，須建立 `round2` 報告複審，不得覆寫本報告。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
