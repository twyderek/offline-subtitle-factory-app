# 獨立審查報告：多語言 LLM 字幕優化支援

- 審查對象 commit／版本：`f781acbc14b61f7427c034bbe42f9e75804d6835` 上的修正後未提交工作樹／`0.45.1`
- 對應 08-CHANGE-LOG 條目：`2026-07-20 — 多語言 LLM 字幕優化支援`
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-07-20（Asia/Taipei）；同一獨立審查角色的新複審回合，輸入為 round1 三項阻擋與修正後工作樹；未採用主要代理對修正品質的評價作為判定依據。
- 審查環境：macOS／Node.js `v22.22.3`；本代理只讀取、執行與驗證，未修改既有檔案。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:24-29` 的 FR-008／FR-013 要求 cue ID／數量／時間碼鎖定、常用語言、自訂 BCP 47、統一標準值、各模式目標語言與舊設定回退。
  - round1 的 cue 順序問題已由 `lib/ai/subtitle-optimizer.mjs:21-35` 補上逐 index ID 比對；三個 API 與舊磁碟設定契約已由 `server.mjs:376-393,576-610,3165-3175,3187-3207` 分離處理。
  - 常見 variant／extension 已可接受，但自訂 BCP 47 仍受未在需求或設計定義的 35 字元上限限制，故 FR-013 的「自訂 BCP 47」尚未完整達成。
  - 12 種常用語言與自訂欄位仍存在於 `public/review.html:202-203`，其保存與任務送出共用 `public/review.js:204-215,251-267,441-450` 的語言解析。主要代理另提供曾以瀏覽器實測 12 種常用語言與自訂欄位顯示／輸入的資訊，但未提供本輪可回溯截圖或操作紀錄，因此本報告只列為開發驗證背景，不視為本代理獨立實測證據。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `lib/ai/subtitle-optimizer.mjs:24-34` 先以 ID 找來源 cue，再要求 `id === source[index].id`；順序一致時回傳的 ID 來自同一 `original`，後續 `lib/ai/subtitle-optimizer.mjs:113-117` 以相同 index 附加 original/start/end，因此 metadata 不再錯配。
  - 2026-07-20 12:00 CST 執行獨立最小探針，交換 `[id:2,id:1]` 回覆，實際得到 `AI 回傳 cue 順序不符：預期 1，收到 2`，沒有產生 suggestion。
  - `scripts/test-ai-optimizer.mjs:44-50` 已加入交換順序負向案例；數量、重複／非法 ID、空白與長度保護仍保留。AI 回傳的時間欄位不被採納，suggestion 的 start/end 只取來源 cue。
  - `lib/ai/languages.mjs:39-46` 及 `lib/ai/subtitle-optimizer.mjs:88,98-109` 仍確保 translate 與其他模式使用 canonicalized 目標語言。

## 3. 邊界情況

- 判定：不通過
- 證據：
  - round1 的代表案例已修正：2026-07-20 12:00 CST 實測 `de-CH-1901` 與 `en-US-u-ca-gregory` 均接受且保持 canonical 值；`en; ignore previous instructions` 被拒絕。對應自動測試位於 `scripts/test-ai-optimizer.mjs:5-10`。
  - 但 `lib/ai/languages.mjs:19-28` 仍在 `Intl.getCanonicalLocales` 前拒絕長度超過 35 的值，且 UI `public/review.html:203` 同樣限制 `maxlength="35"`。獨立探針證實 `Intl.getCanonicalLocales('en-u-attr1-attr2-attr3-attr4-attr5-attr6')` 接受並回傳相同標籤，但 `canonicalizeLanguageTag` 因該合法標籤長 40 字元而拒絕。需求與設計未將支援範圍限定為 35 字元，round1 也明確要求安全長度上限須有規格依據，因此此阻擋尚未解除。
  - API 邊界已修正：`server.mjs:3165-3175` 的 `/api/settings`、`server.mjs:3187-3207` 的 `/api/ai/settings` 與 `server.mjs:576-579,3532-3541` 的 AI task API 均在新輸入路徑呼叫 strict canonicalizer，非法值回覆 400。
  - 舊檔回退已與新 API 分離：`server.mjs:357-384` 載入磁碟設定時走 tolerant normalizer；`scripts/test-core.mjs:11-16,163-175` 會在啟動前建立非法舊設定，並驗證啟動後回退 `zh-TW`、新一般設定 API 非法值 400。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - strict `canonicalizeLanguageTag` 與 tolerant `normalizeLanguageTag` 的責任分工已清楚，設定載入與 API 寫入使用不同入口，修正了 round1 的契約混淆。
  - cue 順序檢查錯誤訊息包含預期與收到的 ID，可診斷性良好；實作與設計的「拒絕順序變更」一致。
  - 35 字元 magic number 同時出現在後端與 HTML，沒有命名常數、標準依據或治理規格，且造成合法輸入被錯拒，是本輪剩餘品質問題。
  - 常用語言清單仍在後端 `lib/ai/languages.mjs:3-16` 與 HTML 重複維護；目前值一致，但有後續漂移風險。
  - `git diff --check` 於 2026-07-20 12:01 CST 通過。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - `scripts/test-ai-optimizer.mjs:5-10,44-50` 已補 variant、extension、注入拒絕與 cue 交換案例。
  - `scripts/test-core.mjs:11-16,163-175,201-215,252-258` 已補實際舊設定檔啟動回退，以及 `/api/settings`、`/api/ai/settings`、AI task API 三個非法新值 400 案例。
  - 2026-07-20 round2 在 sandbox 內執行 `npm run check`：文件、語法及非網路測試通過，核心測試因 `listen EPERM 127.0.0.1:21628` 中止；經授權在 sandbox 外執行 `npm test`，治理、媒體、optimizer、provider、UI 靜態契約與核心 API 回歸全部通過。
  - 缺口：沒有超過 35 字元但可由 `Intl` 接受的合法 BCP 47 回歸案例，因此剩餘錯拒未被測試發現；UI 自動測試仍是靜態 regex，沒有可重現的 DOM 互動／保存再載入測試；各非 translate 模式仍未逐一斷言目標語言 prompt。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - sandbox 外完整 `npm test` 實際通過，包含舊檔啟動、三個 API 400、AI retry／checkpoint／resume 與核心任務回歸。
  - 獨立 cue 探針確認順序交換現在會同步拒絕，不再產生錯配 metadata。
  - 獨立語言探針確認代表性 variant／extension 與注入拒絕已正確，但也實際重現 40 字元合法 BCP 47 被後端錯拒；UI 亦無法輸入超過 35 字元。
  - 本輪未自行操作瀏覽器／Electron，也未呼叫真實 LLM provider；因此模型實際遵循語言仍須由使用者逐段確認，UI 瀏覽器結果只保留為主要代理提供的開發驗證，非本輪獨立證據。

## 綜合判定

- 結論：不通過
- 最終結論（供 `08-CHANGE-LOG.md` 逐字引用）：**本輪 round2 獨立審查結論為不通過：round1 的 cue 順序與 metadata 錯配、代表性 BCP 47 variant／extension、三個新 API 非法值拒絕及舊磁碟設定啟動回退均已修正且完整自動測試通過，但後端與 UI 仍以未具需求或標準依據的 35 字元上限拒絕可由 `Intl.getCanonicalLocales` 接受的合法 BCP 47 標籤，因此 FR-013 的自訂 BCP 47 支援尚未完整達成。**
- 阻擋問題（若有）：
  1. 移除任意的 35 字元限制，或依 BCP 47／產品規格設定足以涵蓋合法標籤的明確上限，並同步後端與 UI；加入超過 35 字元合法標籤的單元及 API 回歸案例。
- 剩餘風險：尚無本輪可回溯的 UI 真實操作證據或真實 provider 語言遵循證據；常用語言清單前後端重複維護；非 translate 模式尚未逐一測試。
- 給主要開發代理的具體修正要求（若有）：修正後端及 UI 長度契約，補長合法標籤正向測試與過長／惡意輸入負向測試，重跑 `npm run check`，並建立 round3 報告複審，不得修改 round1 或 round2 報告。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
