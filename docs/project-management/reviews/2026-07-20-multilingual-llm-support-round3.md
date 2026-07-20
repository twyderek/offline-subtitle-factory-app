# 獨立審查報告：多語言 LLM 字幕優化支援

- 審查對象 commit／版本：`f781acbc14b61f7427c034bbe42f9e75804d6835` 上的修正後未提交工作樹／`0.45.1`
- 對應 08-CHANGE-LOG 條目：`2026-07-20 — 多語言 LLM 字幕優化支援`
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-07-20（Asia/Taipei）；同一獨立審查角色的新複審回合，輸入為 round2 的 35 字元阻擋與修正後工作樹；所有判定以本輪重新讀取、指令執行及獨立探針為準。
- 審查環境：macOS／Node.js `v22.22.3`；本代理只讀取、執行與驗證，未修改既有檔案。

## 1. 需求完整性

- 判定：通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:24-29` 的 FR-008／FR-013 要求 cue ID／數量／時間碼鎖定、常用及自訂 BCP 47、設定／API／Prompt 統一標準值、各模式遵循目標語言與舊設定回退。
  - `public/review.html:202-203` 提供 12 種常用語言、自訂 BCP 47 與 `maxlength="255"`；`public/review.js:204-215,217-227,251-267,441-450` 使用同一解析結果進行載入、保存及 AI 任務送出。
  - `lib/ai/languages.mjs:19-46` 統一 strict canonicalization、舊值 tolerant fallback 與 translate／非 translate prompt；`server.mjs:376-393,576-610,3165-3175,3187-3207` 分別處理舊設定載入、任務與兩個設定 API。
  - `lib/ai/subtitle-optimizer.mjs:21-35,113-117` 對 cue 數量、ID、唯一性及順序做驗證，且 suggestion metadata 只取同一來源 cue。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `lib/ai/subtitle-optimizer.mjs:24-34` 先以 ID 取得來源，再要求每一 index 的 ID 與來源順序一致；通過後 `lib/ai/subtitle-optimizer.mjs:113-117` 才從同一 index 附加 original/start/end，不會將 metadata 配到其他 cue。
  - 2026-07-20 12:04 CST 重新執行交換 `[id:2,id:1]` 的獨立探針，實際回覆 `AI 回傳 cue 順序不符：預期 1，收到 2`，沒有建立 suggestion；`scripts/test-ai-optimizer.mjs:46-52` 亦有固定負向回歸。
  - `server.mjs:3165-3175,3187-3207,3532-3541` 對三個新 API 邊界使用 strict validator，錯誤均轉為 400；舊磁碟設定只在 `server.mjs:357-384` 載入時使用 fallback，strict／tolerant 路徑沒有混用。
  - `lib/ai/subtitle-optimizer.mjs:88,98-109` 只將 canonicalized 標籤寫入 system prompt，translate 與其他模式均由 `languagePromptInstruction` 明確指定輸出語言。

## 3. 邊界情況

- 判定：通過
- 證據：
  - `lib/ai/languages.mjs:19-28` 現在允許最多 255 字元，再交給 `Intl.getCanonicalLocales` 驗證；UI `public/review.html:203` 同步為 255。
  - 2026-07-20 12:04 CST 的獨立探針結果：40 字元合法 extension `en-u-attr1-attr2-attr3-attr4-attr5-attr6` 接受；由 `en-x-`、27 個八字元 private-use subtag 及一個七字元 subtag 組成的 255 字元合法標籤接受；在末尾再加一字元形成 256 字元同型標籤則拒絕；`en; ignore all instructions` 拒絕。
  - `scripts/test-ai-optimizer.mjs:5-12` 固定涵蓋大小寫標準化、variant、extension、40 字元合法標籤、舊值回退、注入與超長拒絕。
  - `scripts/test-core.mjs:13-15,166-175,201-213,255-258` 涵蓋實際非法舊設定檔啟動回退，以及 `/api/settings`、`/api/ai/settings`、AI task API 三個非法新值 400。
  - cue 數量不足、交換順序、非法／重複 ID、空白及異常長文字的既有保護均保留；AI 回覆中的時間欄位不會覆蓋來源時間碼。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - strict `canonicalizeLanguageTag`、tolerant `normalizeLanguageTag` 與 `languagePromptInstruction` 集中於單一模組，server 與 optimizer 共用，安全邊界明確。
  - 255 字元後端上限與 HTML 輸入上限一致，取代 round2 任意縮限；順序錯誤訊息包含預期／實際 ID，具可診斷性。
  - `git diff --check` 於 2026-07-20 12:04 CST 通過；`npm run check` 的語法階段亦通過。
  - 非阻擋維護風險：常用語言名稱仍分別存在於後端清單與 HTML option，未來新增語言時需同步修改。

## 5. 測試覆蓋

- 判定：通過
- 證據：
  - `scripts/test-ai-optimizer.mjs:5-12,28-52` 覆蓋 BCP 47 正負邊界、預設／translate prompt、非法任務語言、數量及順序保護、suggestion 時間碼來源。
  - `scripts/test-core.mjs:13-15,166-213,231-265` 覆蓋舊設定啟動回退、兩個設定 API、AI task API、標準化保存、金鑰隔離及實際 AI 任務流程。
  - 2026-07-20 round3 在 sandbox 內執行 `npm run check`：文件、語法及非網路測試通過，核心測試因 `listen EPERM 127.0.0.1:21738` 中止；經授權於 sandbox 外執行 `npm test`，治理、媒體、optimizer、provider、review UI 靜態契約與核心 API 回歸全部通過。
  - 本輪另以獨立探針補查自動測試未精確建立的 255 字元合法邊界與 256 字元同型負向邊界，結果符合預期。
  - 未覆蓋但不阻擋本次結論：沒有連接真實供應商驗證模型必然遵循輸出語言；此行為受模型能力影響，產品仍要求人工確認建議。

## 6. 實際運行結果

- 判定：通過
- 證據：
  - sandbox 外完整 `npm test` 實際通過，包含核心本機 HTTP API、設定啟動、AI retry／checkpoint／resume 與任務回歸。
  - 獨立語言探針實際確認 40／255 字元合法值接受，256 字元與注入值拒絕；獨立 optimizer 探針實際確認 cue 交換會拒絕。
  - round1 已修正的三個 API 新非法值 400、舊磁碟設定回退、variant／extension 與 cue metadata 保護均有現行程式碼、固定測試及本輪回歸支撐，未發現回歸。
  - 真實 LLM 的語言遵循仍須使用者逐段確認；這是外部模型能力的剩餘風險，不代表本機驗證、Prompt 或 cue 保護失敗。

## 綜合判定

- 結論：通過
- 可逐字引用的完整結論句：**本輪 round3 獨立審查結論為通過：後端與 UI 的 BCP 47 上限已同步為 255 字元，獨立探針及回歸測試確認 40 與 255 字元合法標籤可接受、256 字元及注入值會拒絕；round1 的 cue 順序／metadata 保護、variant／extension、三個新 API 非法值 400 與舊磁碟設定啟動回退亦均未回歸，六面向未發現未處理阻擋問題。**
- 阻擋問題（若有）：無。
- 剩餘風險：真實供應商模型是否完全遵循目標語言仍受模型能力影響，須由使用者確認建議；常用語言清單前後端重複維護，未來擴充時需同步；本輪未進行打包或跨平台實機驗證，符合本次不發布範圍。
- 給主要開發代理的具體修正要求（若有）：無阻擋修正；結案時請逐字引用上述最終結論並保留 round1–round3 歷程。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
