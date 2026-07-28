# 獨立審查報告：0.47 品質風險工作與正式回歸補強

- 審查對象 commit／版本：相對 0.46.0 release-audit 基準 `142b85ddfd7912621e88d71c19cc817e0079c5b0`；目前 HEAD `8d042d3b2e0b63957020d391f3758b59db3e9407` 加上未提交工作樹
- 對應 08-CHANGE-LOG 條目：2026-07-27 — 0.47 低可信片段工作流；2026-07-27 — 補強 0.47 品質流程正式回歸
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-27 08:58 CST；依 `project:preflight -- --type=full` 取得治理上下文的獨立審查上下文，未沿用主要開發代理的評價，且未修改既有 round1／round2／round3 報告

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:36` 新增 FR-020，要求保存可取得的 confidence／no-speech 指標、缺失時使用可重現規則分數，以及依低可信、過長、速度過快、重複文字與疑似專有名詞篩選。`docs/project-management/03-FUNCTIONAL-DESIGN.md:63-67` 定義 `engine-metrics`／`rule-score` 來源、只影響顯示／批次範圍及 AI 不上傳影音。`docs/project-management/08-CHANGE-LOG.md:79-97` 已記錄正式回歸範圍、非發布範圍與剩餘風險。
- 證據：目前實作已提供品質評估器、品質篩選、保存欄位正規化與 AI scope：`public/subtitle-quality.mjs:3-22`、`public/bilingual-subtitles.mjs:9-34`、`public/review.js:459-468`、`public/review.html:134`。
- 未完成證據：Whisper.cpp 實際轉錄仍只呼叫 `-osrt`，並在完成時尋找 SRT、複製為 `draft.srt`，沒有 quality metadata 輸出／解析／cue 對應：`server.mjs:1378-1384`、`server.mjs:1421-1428`。`docs/project-management/00-CURRENT-STATUS.md:58-61` 也明確標示該缺口，因此 FR-020 目前只完成可保存／評估通道，未完成引擎來源整合。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：`public/subtitle-quality.mjs:2,7-18` 對 null、undefined、空字串、空白、false、NaN、Infinity 等缺失／非有限品質值不產生低 confidence 或高 no-speech reason，只有有效值才標示 `engine-metrics`；沒有引擎值時標示 `rule-score`。`public/bilingual-subtitles.mjs:25-26,30-34` 會保留有效品質值並將 `no_speech_prob` 正規化為 `noSpeechProbability`。
- 證據：`public/review.js:459-468` 的 quality scope 只建立 cue id、時間及字幕文字欄位，沒有影片、音訊、檔案路徑或 raw quality metadata；`public/review.js:897-918` 使用同一品質 filter 控制清單與品質 chip，且 reason 透過 `escapeHtml` 呈現。
- 需確認的邏輯決策：`public/review.js:56` 將品質 filter 預設為 `all`，而 `public/review.js:465` 的 quality scope 會依此送出全部 cue。這符合「品質篩選結果」的字面行為，但若 0.47 的產品意圖是降低成本、只處理問題片段，預設行為尚未被需求方明確決定。

## 3. 邊界情況

- 判定：部分通過
- 證據：2026-07-27 09:00 CST 執行 `node scripts/test-subtitle-quality.mjs`、`node scripts/test-bilingual-subtitles.mjs` 與 `node scripts/test-review-ui.mjs` 均通過。`scripts/test-subtitle-quality.mjs:8-15` 覆蓋 null、空字串、空白、false、NaN、Infinity；`scripts/test-bilingual-subtitles.mjs:20-30` 覆蓋無效值、snake_case 正規化與 JSON stringify／parse 後的品質欄位保留。
- 證據：`public/subtitle-quality.mjs:6,13-14` 對無效時間碼、零／負時長及閱讀速度使用 null／正值判斷；`public/subtitle-quality.mjs:15-16` 對重複文字與專有名詞採固定規則。現有測試包含過長、速度過快與重複文字，但未建立含有效品質欄位的所有篩選分類矩陣。
- 覆蓋缺口：正式 JSON round-trip 是資料模型層的 `normalizeBilingualCues(JSON.parse(JSON.stringify(...)))`，不是帶有 confidence／no-speech 欄位的 `/api/jobs/:id/save-review-package` → 磁碟 → `/review-data` 端到端回歸。既有核心測試 `scripts/test-core.mjs:400-415` 確實測試保存／重新載入，但 fixture 沒有品質欄位，只驗證 translatedText。

## 4. 程式碼品質

- 判定：部分通過
- 證據：`lib/subtitle-quality.mjs:1-2` 讓 Node 測試與瀏覽器共用 `public/subtitle-quality.mjs`，避免兩份評估邏輯漂移；品質欄位正規化集中在 `public/bilingual-subtitles.mjs:9-34`，AI request 仍與媒體資料分離。
- 證據：`public/subtitle-quality.mjs:2,21-22` 將主要 helper／filter 壓縮成單行，`public/bilingual-subtitles.mjs:25-26` 也重複呼叫 `finiteQuality`；`lib/subtitle-quality.mjs:3-41` 保留整段已不再執行的註解舊實作。這些不構成功能阻擋，但會降低可讀性、增加日後維護時誤以為存在第二實作的風險。
- 證據：`public/review.js:909-918` 仍使用 `innerHTML` 產生 cue；品質 reason 目前有 `escapeHtml`，所以本輪沒有發現可由品質欄位直接注入的實際漏洞，但後續新增外部 reason 時仍須維持相同安全邊界。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-07-27 08:58 CST 執行 `npm run check`，`docs:check`、語法、治理、媒體、雙語、字幕品質、AI optimizer、provider、review UI 與核心回歸均通過；輸出包含「字幕品質風險測試通過」及「核心回歸測試通過」。
- 證據：2026-07-27 08:58 CST 執行 `npm run docs:check:final` 通過，輸出為「專案治理文件檢查通過：19 個文件，版本 0.46.0，最新紀錄已結案」。2026-07-27 09:00 CST 執行 `git diff --check`、相關 JavaScript `node --check` 與三支針對性測試亦通過。
- 覆蓋缺口：`scripts/test-review-ui.mjs:28-35` 主要以 HTML／JS 字串契約驗證 quality filter、quality scope 及隱私欄位，未實際執行 `review.js` 的 `aiRequestCues()` 對含多個 cue 的 fixture 產生 payload；沒有品質篩選後 cue 集合與 request body 的數量／內容斷言。另無 Whisper.cpp quality metadata mock／端到端映射測試。

## 6. 實際運行結果

- 判定：通過（自動回歸與文件門檻）
- 證據：2026-07-27 08:58 CST 實際執行 `npm run check` 與 `npm run docs:check:final` 均 exit 0；2026-07-27 09:00 CST 實際執行語法檢查、品質／雙語／UI 測試與 `git diff --check` 均通過。
- 判定：部分通過（本機校閱頁）
- 證據：以本機 `OFFLINE_SUBTITLE_DATA_DIR=/tmp/osf-ui-review PORT=9880 node server.mjs` 啟動服務後，於 2026-07-27 08:58–09:00 CST 開啟 `http://127.0.0.1:9880/review/test`。頁面實際呈現「品質篩選」與「AI 優化範圍」控制；選取品質 filter `issues`、AI scope `quality` 後，DOM 實際值為 `qualityFilter: 'issues'`、`aiScope: 'quality'`、估算「預計 0 段・約 0 批」；瀏覽器 error／warning log 為空。因沒有現成可安全上傳的含品質欄位任務，本次未以真實 cue 操作頁面。
- 判定：不通過（0.47 完整 runtime 驗收範圍）
- 證據：沒有 Electron renderer、Windows／macOS 安裝後操作、真實 Whisper.cpp quality metadata、跨平台欄位映射或重啟後品質篩選的實際證據；`server.mjs:1421-1428` 仍顯示轉錄命令沒有 JSON／quality metadata 輸出。這些缺口與 `docs/project-management/00-CURRENT-STATUS.md:60-61` 及 `08-CHANGE-LOG.md:97` 的揭露一致，不能以 `npm run check` 通過替代實機驗收。

## 綜合判定

- 結論：有條件通過
- 完整逐字結論句：**本輪 2026-07-27 0.47 品質流程正式回歸獨立審查結論為有條件通過：品質評估單一來源、缺失值不偽造、有效品質欄位正規化、文件 final gate、完整 `npm run check` 與本機校閱頁控制均已驗證；但 Whisper.cpp quality metadata 尚未由實際轉錄流程產出／映射，品質欄位尚未以 API 保存／重新載入專門 fixture 驗證，quality AI scope 尚未以含 cue 的實際 request payload 測試，且 Electron／Windows／macOS／真實 Whisper runtime 尚未驗收，因此不得宣稱 0.47 已完成完整驗收或發布核准。**
- 阻擋問題（若有）：
  1. 0.47 完整驗收仍被 Whisper.cpp quality metadata 來源／映射缺口阻擋；目前只能宣稱品質評估與保存通道已完成，不能宣稱實際轉錄已提供 confidence／no-speech。
  2. 本輪正式回歸沒有專門驗證品質欄位經 save-review-package／review-data API 的保存與重載，也沒有含 cue fixture 的 quality AI request payload 執行測試。
  3. 跨平台與 Electron／真實 Whisper runtime 未實測；`npm run check` 通過不解除這些風險。
- 剩餘風險：
  - quality filter 為 `all` 時，quality AI scope 會處理全部 cue 的產品語意尚待確認。
  - `lib/subtitle-quality.mjs` 的死碼註解、壓縮單行 helper 與重複的有限數值判斷降低可維護性。
  - 規則式專有名詞／重複文字判定可能產生誤報，仍須人工確認；現有需求與設計已將品質分數定位為輔助而非自動改寫。
- 給主要開發代理的具體修正要求：
  1. 補 Whisper.cpp metadata 的來源調查、輸出／解析與 cue ID／時間碼對應；至少加入可失敗的 mock／端到端測試，明確驗證缺失 metadata 時仍落回 `rule-score`。
  2. 擴充核心保存／重載 fixture，讓 `/api/jobs/:id/save-review-package` 寫入含 confidence／no-speech 的 bilingual cues，再從 `/review-data` 讀回並逐欄斷言。
  3. 將 `aiRequestCues()` 抽成可注入／可測試單元，使用含正常與問題 cue 的 fixture，逐項斷言 `quality` scope 的 request 只含篩選後文字與必要欄位、不含影音／品質 raw 欄位。
  4. 取得需求方對 `qualityFilter=all` 的預設產品決策；若目標是成本降低，明確提供並驗證問題片段預設流程，否則在設計與工作紀錄寫明 `all` 的意圖。
  5. 清理 `lib/subtitle-quality.mjs` 舊註解實作、拆開壓縮 helper，完成 Electron、Windows／macOS 與真實 Whisper runtime 驗證後，再建立下一輪複審；不得覆寫本報告，也不得把有條件通過改寫成完整驗收。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行、瀏覽器驗證與程序清理，未修改任何其他專案檔案；未修改既有審查報告、程式碼、測試或治理來源文件。
- 本報告是本輪獨立上下文產出；若上述聲明不實，本報告無效。
