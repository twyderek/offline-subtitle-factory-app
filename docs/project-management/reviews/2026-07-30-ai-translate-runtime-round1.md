# 獨立審查報告：翻譯模式真實模型與封裝驗證修正

- 審查對象 commit／版本：工作樹（基準 commit `5709a5e`）／0.48.0 macOS arm64 目錄測試版
- 對應 08-CHANGE-LOG 條目：2026-07-30 — 翻譯模式真實模型與封裝驗證修正
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-30 08:30 CST；獨立審查子代理 `translate_runtime_review`，未沿用主要開發代理對話記憶，僅收到變更範圍、重點檔案及待自行核實的測試項目。

## 1. 需求完整性

- 判定：通過
- 證據：
  - `public/review.js:557-560` 與 `public/review.js:569-593` 均以 `aiPromptMode` 當作唯一執行模式來源，並把 `mode` 寫入 POST payload；執行新任務前於 `public/review.js:577-579` 清除舊建議，避免前次術語／文字優化結果殘留。
  - `public/ai-scope.mjs:14-20` 在 `translate` 模式使用 `sourceText` 建立送出文字；非翻譯模式才使用譯文。
  - `lib/ai/subtitle-optimizer.mjs:148-169` 再於後端正規化時固定翻譯模式使用來源文字，並只挑選當批實際出現的術語，避免無關的 `E3／平台名稱` 污染翻譯。
  - `lib/ai/subtitle-optimizer.mjs:178-205` 明確要求完整翻譯、驗證目標語言，並為建議保存 `mode`；`public/review.js:1010-1031` 依該欄位顯示「翻譯」而非模型自由文字理由。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `lib/ai/subtitle-optimizer.mjs:78-105` 維持 cue 數量、ID、順序、非空與上限驗證；翻譯模式另拒絕過短內容及英文／日文／韓文語系明顯不符的回傳。
  - `lib/ai/subtitle-optimizer.mjs:168-184` 傳給模型的資料只含 `id` 與實際 `text`，不會把既有譯文或不相關術語作為待翻譯句子。
  - `public/review.js:693-700`、`public/review.js:723-733` 接受單筆／全部建議時只寫 `translatedText`，保留 `sourceText`。
  - 2026-07-30 08:40 CST 以封裝 App 內 `subtitle-optimizer.mjs` 與 `providers.mjs` 直接呼叫 Ollama `llama3.2:1b`，兩個 cue 均回傳英文、`mode=translate`、`changedCues=2`、`totalRetries=0`，且沒有 `E3` 或「平台名稱」。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - `node scripts/test-ai-optimizer.mjs`（2026-07-30 08:36 CST）實際涵蓋：既有譯文不作為翻譯輸入、無關術語不送入當批、英文過短回傳拒絕、日文輸出只有中文時拒絕、cue ID／順序／數量保護、術語安全回退及 checkpoint 續跑；結果通過。
  - `node scripts/test-review-ui.mjs` 同次實際涵蓋：翻譯 scope 使用原文、UI 資產含翻譯標籤，以及舊自由理由不再當模式標籤；結果通過。
  - 英文、日文、韓文具啟發式語系檢查；其他支援語言仍主要依 Prompt 與人工確認，未建立逐語言內容分類器。這是剩餘品質風險，不影響本次英文 `llama3.2:1b` 驗收。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - 模式來源集中在 `aiPromptMode`，翻譯輸入選擇集中於 `selectAiCues` 與後端正規化，避免僅靠 CSS active 狀態決定業務行為。
  - 模式標籤由固定白名單映射（`public/review.js:1011-1017`），不顯示模型自由文字為功能名稱。
  - 術語過短／語系回退只限 `terms`（`lib/ai/subtitle-optimizer.mjs:189-201`），沒有放寬 `translate` 的安全驗證。
  - `git diff --check`（2026-07-30 08:36 CST）通過。

## 5. 測試覆蓋

- 判定：通過
- 證據：
  - `node scripts/test-ai-optimizer.mjs && node scripts/test-review-ui.mjs && git diff --check`（2026-07-30 08:36 CST）：全部通過。
  - `npm run check`（2026-07-30 08:37 CST）：文件治理、JavaScript 語法、治理 fixture、媒體、雙語字幕、品質、Whisper metadata、AI optimizer、provider、review UI 與核心整合測試全部通過。
  - 來源與封裝檔案 SHA-256 逐一相同：optimizer `13a548…79`、review UI `1fee49…15`、AI scope `ef438d…74`。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 2026-07-30 08:40 CST，直接載入 `/Users/nycu/Documents/離線字幕工廠/dist/mac-arm64/離線字幕工廠.app/Contents/Resources/app/` 內模組，向 `http://127.0.0.1:11434` 的 Ollama 0.32.5／`llama3.2:1b` 送出兩個繁中 cue、目標語言 `en`。實際回傳兩筆完整英文建議，ID 分別為 `T1`、`T2`，`mode` 均為 `translate`，沒有術語表殘留；程序 exit 0。
  - macOS App `Info.plist` 版本與 build 均為 `0.48.0`；`codesign --verify --deep --strict` exit 0。
  - 尚未完成 Electron 視窗內「點選翻譯 → 開始 AI 優化 → 畫面顯示翻譯」的自動化操作；既有 AX 控制逾時，因此本輪只能證明 UI 靜態接線、完整 API／核心回歸，以及封裝內實際 optimizer/provider 到真實模型的資料路徑。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無程式或封裝阻擋問題。
- 剩餘風險：本輪未取得 Electron 視窗點擊式自動化證據；`llama3.2:1b` 的英文翻譯可通過契約但品質仍有不自然措辭，例如第一句出現「Old teacher」，使用者仍須逐段人工確認。英文／日文／韓文以外語言沒有內容語系啟發式驗證。
- 給主要開發代理的具體修正要求（若有）：交付前應明確說明已驗證的是封裝內真實模型資料路徑，並要求使用者在新 App 中做一次最小 UI 人工驗收；不可宣稱已完成 Electron 點擊式 UI 自動化。若人工畫面仍混入舊術語建議，應蒐集該 job 的 `ai-output/checkpoint.json` 與 session 證據再追查，不得直接重複打包。
- 判定句：**本輪 round1 獨立審查結論為有條件通過：來源與 macOS 封裝內三個關鍵模組 SHA-256 完全一致，完整 `npm run check`、針對性翻譯／UI 測試、封裝內模組對真實 Ollama `llama3.2:1b` 的兩 cue 英文翻譯均通過，未再產生 `E3／平台名稱` 或錯誤模式標籤；目前無程式或封裝阻擋問題，但 Electron 視窗點擊式自動化因 AX 控制逾時未取得證據，且小模型翻譯品質仍需使用者逐段人工確認。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
