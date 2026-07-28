# 獨立審查報告：0.47 低可信片段工作流

- 審查對象 commit／版本：目前工作樹相對 0.46.0 的未提交 0.47 差異（2026-07-27）
- 對應 08-CHANGE-LOG 條目：2026-07-27 — 0.47 低可信片段工作流
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-27 08:28 CST；獨立上下文，未沿用主要開發代理對話記憶

## 1. 需求完整性

- 判定：不通過
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:36` 新增 FR-020，要求保存可取得的 confidence／no-speech 指標、缺失時標示規則分數來源，並支援五類問題篩選與批次選取。`public/review.html:103` 與 `public/review.js:896-913` 確實提供篩選與風險 chip；但 `public/bilingual-subtitles.mjs:9-25` 的 `normalizeBilingualCue` 未保留 `confidence`、`noSpeechProbability` 或 `no_speech_prob`，因此從任務資料載入後品質指標無法到達 UI。`server.mjs`／Whisper runtime 也未見本輪把引擎指標映射進 cue 的實作；目前只接受評估器輸入欄位，不能證明「保存可取得指標」已完成。
- 證據：`docs/project-management/03-FUNCTIONAL-DESIGN.md:63-67` 宣稱可取得指標時使用 `engine-metrics`，但實際校閱載入路徑會丟失該欄位，與設計不一致。

## 2. 邏輯正確性

- 判定：不通過
- 證據：`lib/subtitle-quality.mjs:3` 的 `finite(value)` 使用 `Number(value)`；因此 `null`、空字串與 `false` 都被轉成 `0`。2026-07-27 08:29 CST 實測：`assessSubtitleCue({ confidence: null })`、`{ confidence: '' }`、`{ confidence: false }` 都回傳 `confidence: 0`、`source: 'engine-metrics'`、`reasons: ['低 confidence']`。這直接違反缺失指標不得偽造／誤判的要求。
- 判定：不通過
- 證據：`lib/subtitle-quality.mjs:19-24` 對重複文字與疑似專有名詞加分；`public/subtitle-quality.mjs:17-18` 沒有相同加分，造成 Node 測試及瀏覽器 UI 對同一 cue 的 score 不一致。兩檔案也以複製方式維護，缺少單一來源或 parity test。
- 判定：部分通過
- 證據：`public/review.js:459-466` 的 AI scope 仍只支援 all／selected／search／current，沒有以品質篩選結果作為 scope；品質下拉只影響 `renderCueList`（`public/review.js:896-900`）。使用者選取「低可信」後仍可用「處理全部字幕」送出高可信 cue，未完整落實低可信片段工作流的降範圍目的。

## 3. 邊界情況

- 判定：不通過
- 證據：`scripts/test-subtitle-quality.mjs:4-11` 覆蓋缺少欄位（undefined）、低值、長度、速度、重複與一個篩選案例，但未覆蓋 `null`、空字串、`false`、`NaN`、超界 confidence／probability、負／零時間長度、空文字、Unicode 重複與各篩選選項。上述 null／空字串／false 實測均錯誤轉為 0。
- 判定：不通過
- 證據：`public/bilingual-subtitles.mjs:16-25` 正規化 cue 只回傳雙語欄位與時間碼，丟失品質欄位；`public/review.js:831-845` 載入時立即呼叫該正規化。因此含品質欄位的 `.osfp`／review package 重啟情境無法保留指標，且沒有對應遷移／回歸測試。
- 判定：部分通過
- 證據：`lib/subtitle-quality.mjs:7` 對負 duration 使用 `Math.max(0, ...)`，但並未將時間碼無效標示為問題；`public/review.js:924` 可由 UI 修改時間，品質評估對不合理時間資料沒有明確錯誤狀態。既有字幕 parser 會先驗證正常時間碼，但品質模組本身的邊界契約未封閉。

## 4. 程式碼品質

- 判定：不通過
- 證據：Node 與 browser 兩份品質模組內容不等價（`lib/subtitle-quality.mjs:19-23` 對額外規則計分，`public/subtitle-quality.mjs:17` 未計分），且 browser 版本大量壓成單行（`public/subtitle-quality.mjs:20-22`），增加維護與審查風險。
- 判定：不通過
- 證據：`public/review.js:913` 將 `quality.reasons.join('、')` 插入 `innerHTML`。目前 reasons 是內建常數，短期沒有外部注入，但品質模組若未來保留引擎／模型訊息，這個呈現點沒有 `escapeHtml`；同區塊的 AI reason／text 已使用 escape，品質 reason 應採相同防護。
- 判定：通過
- 證據：`public/review.js:71` 明確綁定品質篩選 change；`public/review.js:896-900` 只篩選呈現資料，未直接修改 cue；`public/review.js:466` AI request 仍只建立文字／時間欄位，未加入影片／音訊內容。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-07-27 08:28 CST 執行 `npm run test`（升級權限以允許核心測試 listen）通過既有治理、媒體、雙語、品質、AI、provider、UI 測試，輸出包含「字幕品質風險測試通過」與「核心回歸測試通過」。本輪新增測試已接入 `package.json:16`。
- 判定：不通過
- 證據：品質測試只 import `../lib/subtitle-quality.mjs`（`scripts/test-subtitle-quality.mjs:2`），沒有載入 `public/subtitle-quality.mjs` 或 parity comparison；因此 browser 版 score divergence 未被偵測。也沒有 UI 實際載入品質欄位、品質篩選、批次 AI scope 的自動測試。
- 判定：通過（環境門檻）
- 證據：2026-07-27 08:28 CST 在受限 sandbox 直接執行 `npm run test` 時，最後核心測試因 `listen EPERM 127.0.0.1:<random-port>` 中止；2026-07-27 08:28 CST 以升級權限重跑後完整通過。這是可解釋的環境差異，不是測試斷言通過證據的缺失。
- 判定：部分通過
- 證據：2026-07-27 08:28 CST 執行 `npm run docs:check:final` 顯示「最新紀錄已結案」，但 `docs/project-management/08-CHANGE-LOG.md:47` 的本輪項目是 `###`，而 checker `scripts/check-project-docs.mjs:60-61` 只擷取 `## YYYY-MM-DD`；因此 final check 實際檢查的是舊的 `## 2026-07-23` 條目，沒有驗證本輪進行中、待執行欄位。

## 6. 實際運行結果

- 判定：部分通過
- 證據：2026-07-27 08:28 CST 執行 `npm run test`（升級權限）實際啟動核心本機 HTTP server 並完成：治理、媒體、雙語、品質、AI、provider、review UI、core 全部通過。2026-07-27 08:29 CST 以 Node inline module 實測品質評估器的缺失值轉換，確認 null／空字串／false 均被當作 0。
- 判定：不通過
- 證據：本輪未完成 Electron renderer／瀏覽器實際畫面操作，也未用含 confidence／no-speech 的實際 Whisper.cpp 輸出完成端到端保存、重啟、篩選與 AI request 驗證；`00-CURRENT-STATUS.md:60-61` 亦承認跨平台 Whisper 實際欄位映射與實機驗收尚未完成。
- 判定：部分通過
- 證據：靜態檢查確認 `public/review.js:466` request payload 只有 id、start、end、text、sourceText、translatedText，未含影片／音訊欄位；但未以實際 browser network capture 驗證品質篩選後的 AI scope 行為。

## 綜合判定

- 結論：不通過
- 阻擋問題：品質欄位在校閱資料正規化時遺失；null／空字串／false 指標被誤判為 confidence=0；Node／browser 評估器分數不一致；品質篩選沒有接入 AI scope；新增測試未覆蓋上述問題；本輪 CHANGE-LOG 使用錯誤標題層級導致 `docs:check:final` 未驗證本輪條目。
- 剩餘風險：即使修正上述阻擋，Whisper.cpp 實際輸出欄位、Windows／macOS runtime、Electron renderer 與真實任務重啟流程仍需另行驗證；品質風險只應作為人工校閱排序，不可自動改寫字幕。
- 給主要開發代理的具體修正要求：
  1. 以明確缺失判斷取代 `Number(value)`，讓 null／空字串／false／NaN 不產生 confidence；補齊邊界 fixture。
  2. 讓品質欄位在 `normalizeBilingualCue`、server job／review package 保存與載入全鏈路保留，並補重啟回歸測試。
  3. 以單一來源或 parity test 統一 `lib` 與 `public` 評估器，修正 score divergence，並對 UI reason 做 escape。
  4. 決定並測試品質篩選如何成為 AI scope；至少提供「只處理目前品質篩選結果」且確認高可信 cue 不會送出／修改。
  5. 將本輪 CHANGE-LOG 改為 checker 可辨識的最新 `## YYYY-MM-DD — ...` 條目，完成欄位後再重跑 `docs:check:final`。
  6. 修正後建立 round2，不覆寫本 round1 報告。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
