# 獨立審查報告：0.47 低可信片段工作流

- 審查對象 commit／版本：目前工作樹相對 0.46.0 的 round2 修正（2026-07-27）
- 對應 08-CHANGE-LOG 條目：2026-07-27 — 0.47 低可信片段工作流
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-07-27 08:31 CST；同一獨立審查角色的新複審上下文，未修改或覆寫 round1 報告

## 1. 需求完整性

- 判定：部分通過
- 證據：round1 指定的品質評估器單一來源已完成：`lib/subtitle-quality.mjs:1` re-export `public/subtitle-quality.mjs`，Node 測試與瀏覽器使用相同實作。`public/review.html:134` 新增「只處理品質篩選結果」，`public/review.js:460-466` 實作 `quality` AI scope；`public/review.js:914` 以 `escapeHtml` 呈現 reasons；`docs/project-management/08-CHANGE-LOG.md:47` 已改為 checker 可辨識的 `##` 標題。
- 判定：不通過
- 證據：FR-020 要求保存「可取得的 confidence／no-speech 指標」。`public/bilingual-subtitles.mjs:22-26` 現在能在正規化時保留已存在的 `confidence` 與 `noSpeechProbability`，但 Whisper.cpp 轉錄流程 `server.mjs:1421-1427` 仍只呼叫 `-osrt`、不輸出或解析 JSON／confidence／no-speech 欄位；`server.mjs:1378-1384` 也只尋找並複製 SRT。因此實際轉錄結果仍沒有品質指標進入 cue，完成的是保存通道而非來源資料整合。
- 判定：通過
- 證據：缺失指標不再由品質模組偽造為 0；`public/subtitle-quality.mjs:2` 的 `finite` 明確拒絕 null／undefined／空字串／false，並在 `:7-18` 只有有效指標才標示 `engine-metrics`，否則回傳 `rule-score`。

## 2. 邏輯正確性

- 判定：通過
- 證據：2026-07-27 08:32 CST 執行 inline Node 邊界檢查，對 confidence 為 null、空字串、false、undefined、NaN 均得到 `confidence: null`、`source: 'rule-score'` 且不含「低 confidence」；有效 0.2 仍得到 `engine-metrics`／低 confidence。`normalizeBilingualCue` 對有效 `confidence: 0.2` 與 `no_speech_prob: 0.7` 實測保留為 `0.2` 與 canonical `noSpeechProbability: 0.7`。
- 判定：通過
- 證據：`lib/subtitle-quality.mjs:1` 與 `public/subtitle-quality.mjs:1-23` 已移除兩份實作分叉，round1 指出的 score divergence 已解除；重複文字／疑似專有名詞計分現在由 public 單一來源產生。
- 判定：部分通過
- 證據：`public/review.js:465` 的 `quality` scope 會套用 `state.qualityFilter`，且 `public/review.js:896-900` 的清單篩選使用相同 filter；但 quality filter 預設為 `all`（`public/review.js:56`），若使用者未明確選擇問題 filter，品質 scope 仍會把全部 cue 送入 AI。這符合「品質篩選結果」字面，但不等於 roadmap 所述預設只送需要處理的低可信片段，應由需求方確認預設語意。

## 3. 邊界情況

- 判定：部分通過
- 證據：`public/subtitle-quality.mjs:2` 已覆蓋 null／undefined／空字串／false／非有限值的缺失判斷；`scripts/test-subtitle-quality.mjs:4-11` 仍只測 undefined 缺失與一般風險案例，未把 round1 發現的 null／空字串／false／NaN 回歸案例提交到正式測試檔。2026-07-27 08:32 CST 的 inline assertion 已實測它們通過，但未形成可持續的 fixture。
- 判定：部分通過
- 證據：`public/bilingual-subtitles.mjs:25-26` 對有效 quality 欄位做保存與 canonical 化，但以 `Number(value)` 判斷，字串只有空白（例如 `' '`）會轉為 0；這是另一個與缺失值相鄰的輸入邊界，尚無測試。`finiteQuality` 與品質模組的 `finite` 也各自實作，未共用同一個缺失判斷 helper。
- 判定：通過
- 證據：`public/review.js:459-466` 的 quality AI scope 只建立 id／時間／sourceText／translatedText／text 欄位；未將影片、音訊、quality raw payload 或檔案路徑加入 request。`public/review.js:914` 對內建 reasons 做 HTML escape，round1 指定的呈現注入風險已處理。

## 4. 程式碼品質

- 判定：部分通過
- 證據：`lib/subtitle-quality.mjs:1` 的 re-export 讓 Node／Browser 使用單一來源，維護一致性已改善；但 `public/subtitle-quality.mjs:2,21-22` 仍將主要 helper 與 filter 壓成單行，且 `public/bilingual-subtitles.mjs:25-26` 重複呼叫 `finiteQuality` 多次，可讀性與可維護性仍偏弱。
- 判定：部分通過
- 證據：`public/review.js:914` 已以 `escapeHtml` 包住品質 chip 字串；reasons 目前為模組常數而非外部訊息，現況風險低。仍建議將品質 reason 以 textContent／DOM API 渲染，避免未來規則改成引擎回傳文字時重新引入 innerHTML 風險。
- 判定：通過
- 證據：品質 filter、AI scope、cue 保存通道均採不直接修改字幕文字的資料流；AI 建議仍需既有人工接受流程，未發現高可信 cue 因品質評估自動覆寫的路徑。

## 5. 測試覆蓋

- 判定：通過（現有回歸）
- 證據：2026-07-27 08:32 CST 以升級權限執行 `npm run test`，治理、媒體、雙語、字幕品質、AI optimizer、provider、review UI 與 core 全部通過；輸出包含「字幕品質風險測試通過」與「核心回歸測試通過」。
- 判定：部分通過
- 證據：2026-07-27 08:32 CST 執行 `node --check public/review.js`、`node --check public/subtitle-quality.mjs`、`node scripts/test-subtitle-quality.mjs` 與自訂 normalize／缺失值 inline assertions 均通過；但 `scripts/test-subtitle-quality.mjs:4-11` 尚未正式加入 null／空字串／false／NaN、保存／重載 quality 欄位與 quality AI scope fixture。
- 判定：不通過（需求證據缺口）
- 證據：沒有測試 Whisper.cpp JSON／quality metadata 產出與 SRT／cue 的端到端映射，也沒有 Electron renderer 實際畫面與 network capture。`server.mjs:1421-1427` 的實作證據顯示目前根本未產出該 metadata。

## 6. 實際運行結果

- 判定：通過（自動驗證）
- 證據：2026-07-27 08:32 CST 實際執行 `npm run test`，完整既有回歸通過；品質模組與資料正規化的 round1 修正也由獨立 inline assertions 實測通過。
- 判定：不通過（文件結案門檻）
- 證據：2026-07-27 08:32 CST 執行 `npm run docs:check:final` 失敗，輸出為「最新工作紀錄尚未標示為完成」、「仍有欄位為待執行」、「獨立審查是否執行必須為是或否」。`docs/project-management/08-CHANGE-LOG.md:49,60-67,74` 仍保留進行中／待執行狀態與 round1 reference，主要代理尚未依 round2 結論補齊結案內容。
- 判定：不通過（實際 runtime 覆蓋）
- 證據：本輪未完成實際 Whisper.cpp 轉錄輸出品質 metadata、Electron renderer、Windows／macOS 實機或重啟後品質篩選操作；狀態文件 `docs/project-management/00-CURRENT-STATUS.md:61-62` 仍揭露跨平台 Whisper 欄位映射與實機驗收未完成。

## 綜合判定

- 結論：有條件通過
- 阻擋問題：0.47 的品質指標來源尚未接入 Whisper.cpp 實際轉錄流程，故目前不能宣稱「保存可取得的 confidence／no-speech 指標」已完成；正式品質回歸尚未覆蓋 null／空字串／false／NaN、保存重載與 quality AI scope；`docs:check:final` 在本輪執行時仍失敗。
- 剩餘風險：需確認 quality scope 在 filter=all 時是否應等同「只處理低可信／有問題片段」；需補 Whisper.cpp quality metadata 的實際欄位映射、跨平台 runtime、Electron renderer 與實機重啟驗證；空白字串 quality input 仍可能被轉成 0。
- 給主要開發代理的具體修正要求：
  1. 對 Whisper.cpp 至少輸出／解析可用 quality metadata（或明確記錄其不存在並以規則分數為主），將其與 SRT cue ID／時間碼穩定對應，補 mock／端到端測試。
  2. 將 null／空字串／false／NaN 與有效 quality 欄位回歸案例寫入正式測試；補保存、重載與 `quality` AI scope 測試。
  3. 統一 `finite` 與 `finiteQuality`，至少拒絕 whitespace-only 字串，避免相鄰缺失值被當成 0。
  4. 依需求方決定 quality scope 的預設 filter 語意；若 0.47 目標是成本降低，應提供並驗證預設只送問題片段的流程。
  5. 補齊本輪 CHANGE-LOG 的實際修改、測試、round1／round2 連結與結論，將狀態改為完成後重跑 `npm run docs:check:final`。
  6. 若完成以上修正，建立 round3 複審報告，不覆寫 round1／round2。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案；round1 報告未被修改。
- 若上述聲明不實，本報告無效。
