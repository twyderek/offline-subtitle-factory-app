# 獨立審查報告：0.47 低可信片段工作流

- 審查對象 commit／版本：目前工作樹相對 0.46.0 的 round3 複審狀態（2026-07-27）
- 對應 08-CHANGE-LOG 條目：2026-07-27 — 0.47 低可信片段工作流
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-07-27 08:34 CST；同一獨立審查角色的新複審上下文，未修改 round1／round2 報告

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:47-74` 已將 0.47 條目改為 `##`、標示完成，並如實揭露 Whisper.cpp metadata 尚未產出／映射、Electron renderer、跨平台實機、保存重載與真實 Whisper 流程未驗證。`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:36` 的 FR-020、`docs/project-management/03-FUNCTIONAL-DESIGN.md:63-67` 的品質設計與實際狀態相符。
- 判定：通過
- 證據：`public/review.html:134` 提供 quality AI scope；`public/review.js:465` 以同一 quality filter 產生 AI request 範圍；`public/review.js:914` 對品質 reason 使用 `escapeHtml`；`public/bilingual-subtitles.mjs:22-26` 保留有效 confidence／no-speech 欄位。round2 指出的技術條件仍被保留於工作紀錄遺留風險，而沒有被誤宣稱為完整 runtime 驗收。

## 2. 邏輯正確性

- 判定：通過
- 證據：`lib/subtitle-quality.mjs:1` 只 re-export `public/subtitle-quality.mjs`，Node 與 browser 不再有兩份評估邏輯。`public/subtitle-quality.mjs:2-18` 對 null、undefined、空字串、空白字串、false 與非有限值回傳缺失指標；有效值才標示 `engine-metrics`。
- 判定：通過
- 證據：`public/bilingual-subtitles.mjs:25-26` 將 `no_speech_prob` canonical 化為 `noSpeechProbability` 並保存；`public/review.js:459-466` 的 quality scope 只建立 cue id、時間與字幕文字，不包含影片／音訊資料；高可信 cue 不會被品質評估器自動改寫。
- 判定：部分通過
- 證據：`public/review.js:56` 的 `qualityFilter` 預設為 `all`，所以使用「只處理品質篩選結果」且未先選問題 filter 時會送全部 cue。此行為已由 UI 明確呈現，但是否符合 0.47「降低費用、只送需要片段」的預設產品意圖仍需需求方確認。

## 3. 邊界情況

- 判定：通過
- 證據：2026-07-27 08:35 CST 的 inline assertions 實測 confidence 為 null、空字串、空白字串、false、undefined、NaN 時均回傳 `confidence: null`、`source: 'rule-score'` 且不產生低 confidence reason；有效 0.2 仍正確判定低 confidence。`normalizeBilingualCue` 實測有效 `confidence: 0.2`、`no_speech_prob: 0.7` 可保留並 canonical 化。
- 判定：部分通過
- 證據：正式 `scripts/test-subtitle-quality.mjs:4-11` 已涵蓋基本品質規則，但仍沒有把上述 null／空白／false／NaN 邊界、保存重載與 quality AI scope assertions 寫入正式 fixture；目前由獨立 inline 驗證補足，尚未形成持續回歸保護。
- 判定：通過
- 證據：`public/review.js:914` 對品質 chip 完整字串 escape；`public/review.js:466` request payload 不含品質 raw 欄位、影音路徑或檔案內容，符合「只送字幕文字與必要範圍」的隱私邊界。

## 4. 程式碼品質

- 判定：通過
- 證據：`lib/subtitle-quality.mjs:1` 將 Node import 固定導向 browser 單一來源，解除 round1 的 score divergence；`public/review.js:3` 與測試均使用該來源。`public/bilingual-subtitles.mjs:25-26` 的 quality 欄位處理與既有雙語正規化保持在同一資料流。
- 判定：部分通過
- 證據：`public/subtitle-quality.mjs:2,21-22` 仍有壓縮成單行的 helper／filter，`finiteQuality` 與 `finite` 也各自存在；現行行為已通過邊界實測，但後續仍可抽出共用 helper 以降低維護差異。
- 判定：通過
- 證據：`public/review.js:914` 已使用既有 escape helper；品質評估 reason 是內建常數，不把外部引擎錯誤訊息直接插入 HTML。AI 建議仍沿用人工接受流程，未增加自動覆寫高可信字幕的路徑。

## 5. 測試覆蓋

- 判定：通過
- 證據：2026-07-27 08:34 CST 以升級權限執行 `npm run check`，`docs:check`、JavaScript syntax、治理、媒體、雙語、字幕品質、AI optimizer、provider、review UI 與 core 全部通過；輸出明確包含「字幕品質風險測試通過」與「核心回歸測試通過」。
- 判定：通過
- 證據：2026-07-27 08:35 CST 執行 `npm run docs:check:final`，目前仍失敗，但失敗原因不是 0.47 程式功能或工作紀錄狀態，而是既有 `2026-07-27-0-47-low-confidence-round2.md` 缺少 validator 要求的「可逐字引用完整結論句」、`阻擋問題（若有）` 與完整聲明，且工作紀錄判定未能與該報告 quote 對齊。這是審查證據格式阻擋，需由主要代理修正 round2 報告／引用後重跑。
- 判定：部分通過
- 證據：品質測試已接入 `package.json:16`，但 `scripts/test-subtitle-quality.mjs:4-11` 尚未正式覆蓋 round2 要求的 null／空白／false／NaN、保存重載與 quality scope fixture；Whisper.cpp metadata 產出／映射也沒有 mock／端到端測試。Round2 的技術條件因此仍然是未完成風險，而非被測試證明已完成。

## 6. 實際運行結果

- 判定：通過（自動回歸）
- 證據：2026-07-27 08:34 CST 實際執行 `npm run check`，核心測試啟動本機 HTTP server 並完成 API token、Origin、串流上傳、任務執行、波形、修剪、字幕重算、還原、分頁與取消回歸；字幕品質與 AI scope 相關檢查亦通過。
- 判定：部分通過
- 證據：2026-07-27 08:35 CST 的 `docs:check:final` 實際失敗，錯誤為 round2 審查報告格式與逐字引用不符合 validator。round1／round2 報告未被修改；本輪新增報告本身依 validator 要求包含六面向、完整 quote、阻擋問題、剩餘風險、修正要求與聲明。
- 判定：不通過（未覆蓋範圍）
- 證據：`server.mjs:1421-1427` 的 Whisper.cpp 呼叫仍只使用 `-osrt`，沒有 quality metadata 輸出／解析；本輪沒有 Electron renderer、Windows／macOS 實機、真實 Whisper metadata 或重啟後篩選的實際操作證據。`docs/project-management/00-CURRENT-STATUS.md:61-62` 仍如實揭露該限制。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 round3 獨立複審結論為有條件通過：0.47 品質評估單一來源、缺失指標不偽造、有效品質欄位保存、品質篩選／AI scope、HTML escape、完整 `npm run check` 與技術風險揭露均已驗證；但 `docs:check:final` 仍因 round2 審查報告缺少 validator 要求的完整結論句／阻擋問題欄位／聲明而失敗，且 Whisper.cpp quality metadata、正式邊界／保存重載／quality scope 測試與跨平台 runtime 仍未覆蓋，因此尚不可宣稱 0.47 完整驗收完成。**
- 阻擋問題（若有）：`docs:check:final` 尚未通過；round2 報告格式與工作紀錄逐字引用需由主要代理修正。Whisper.cpp quality metadata 尚未接入是 0.47 的已揭露技術條件，不能被宣稱為已完成。
- 剩餘風險：quality scope 在 filter=all 時是否應預設只處理問題片段仍待產品決策；正式測試仍缺少缺失值／保存重載／scope fixture；Whisper.cpp metadata 映射、Electron renderer、Windows／macOS 實機與真實重啟流程仍未驗證。
- 給主要開發代理的具體修正要求：
  1. 不修改 round1／round2 原文；補正 round2 報告的完整 quote、`- 阻擋問題（若有）：` 欄位與精確聲明，讓工作紀錄最新判定逐字對齊，重跑 `npm run docs:check:final`。
  2. 將 null／空白／false／NaN、品質欄位保存重載與 quality AI scope 寫入正式測試；補 Whisper.cpp metadata mock／端到端映射測試。
  3. 依需求方確認 quality scope 的預設 filter 語意；若目標為降低成本，應使問題片段成為可明確選擇且可驗證的預設流程。
  4. 完成 Whisper.cpp／Electron／跨平台 runtime 實測後，再建立下一輪複審或新工作條目；不得把本輪條件通過寫成完整發布驗收。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- round1／round2 報告未被修改。
- 若上述聲明不實，本報告無效。
