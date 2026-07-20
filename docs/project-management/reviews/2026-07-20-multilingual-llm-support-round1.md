# 獨立審查報告：多語言 LLM 字幕優化支援

- 審查對象 commit／版本：`f781acbc14b61f7427c034bbe42f9e75804d6835` 上的未提交工作樹／`0.45.1`
- 對應 08-CHANGE-LOG 條目：`2026-07-20 — 多語言 LLM 字幕優化支援`
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-20（Asia/Taipei）；由主要開發代理啟動的獨立上下文，只收到審查範圍與唯讀限制，未沿用開發代理的判斷或測試結論。
- 審查環境：macOS／Node.js `v22.22.3`；工作樹已有未提交修改，本代理未修改既有檔案。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:24-29` 要求 cue ID／數量／時間碼鎖定，以及常用語言、自訂 BCP 47、設定／API／Prompt 同一標準值、舊設定回退。
  - `public/review.html:202-203` 已提供 12 個常用語言及自訂欄位；`public/review.js:204-215,217-227,251-267,441-450` 已實作常用／自訂值載入、保存與任務送出。
  - `server.mjs:376-393,3185-3205` 會標準化保存語言，且專用 AI 設定 API 對明示非法語言回覆 400；`server.mjs:570-610` 會在任務建立時再次驗證並將標準值保存於 request。
  - `lib/ai/languages.mjs:41-48` 對 `translate` 與其他模式產生不同且明確的目標語言指令；`lib/ai/subtitle-optimizer.mjs:97-109` 將該指令放入 system prompt。
  - 未達成處：`docs/project-management/03-FUNCTIONAL-DESIGN.md:46-52` 明訂驗證 cue 順序及允許自訂 BCP 47，但實作分別存在順序錯配與合法 BCP 47 被拒問題（見第 2、3 節）。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - `lib/ai/subtitle-optimizer.mjs:21-35` 只驗證回傳 ID 存在且不重複，未驗證結果順序等於來源順序。其後 `lib/ai/subtitle-optimizer.mjs:112-116` 卻用回傳陣列 index 取得 `source`，使交換順序的合法 ID 被配到錯誤的 `original/start/end`。
  - 2026-07-20 11:57 CST 執行最小探針，來源 `[{id:1,start:"A",text:"one"},{id:2,start:"C",text:"two"}]`，mock 回傳順序 `[id:2,id:1]`；函式未拒絕，實際產生 `id:2` 搭配 `original:"one",start:"A"`，以及 `id:1` 搭配 `original:"two",start:"C"`。這違反 `docs/project-management/03-FUNCTIONAL-DESIGN.md:48` 的 cue 順序與時間碼保護，也可能在接受建議、undo／redo 或稽核時造成文字與 cue 時間錯配。
  - 正確行為應是嚴格拒絕順序變更，或完全依 ID 查回同一來源 cue；由於設計明訂順序鎖定，建議直接拒絕並加入交換順序回歸測試。
  - 其餘已查路徑：缺少／重複 ID、數量不符會拒絕；AI 回傳的 start/end 不被採用；合法語言會在設定及任務邊界標準化；translate 與非 translate prompt 均帶標準化目標語言。

## 3. 邊界情況

- 判定：不通過
- 證據：
  - `lib/ai/languages.mjs:19-30` 在 `Intl.getCanonicalLocales` 前另加自製正規表示式，該表示式不是完整 BCP 47 文法，只接受有限的 language/script/region/長 variant 組合。
  - 2026-07-20 11:57 CST 實測：`fr-ca → fr-CA`、`zh-Hant-TW → zh-Hant-TW`，注入字串 `en;ignore` 被拒；但合法 BCP 47 `de-CH-1901`（四位數 variant）與 `en-US-u-ca-gregory`（Unicode extension）均被拒絕。這與 UI 的「自訂 BCP 47」及 FR-013 的未限定 BCP 47 承諾不一致。
  - `server.mjs:3185-3205` 的 `/api/ai/settings` 對非法明示值會 400，`server.mjs:3530-3538` 的新 AI 任務也會因 `server.mjs:579` 驗證而 400；此安全邊界成立。
  - 但既有一般設定入口 `server.mjs:3165-3173` 仍允許 POST `/api/settings` 帶入 `ai.language`，再由 `server.mjs:637-643,376-393` 靜默回退，沒有區分「磁碟舊設定」與「新 API 輸入」。若該入口仍是支援的寫入 API，則不符合 `docs/project-management/03-FUNCTIONAL-DESIGN.md:52`「新 API 輸入無效值回覆 400」；應統一拒絕 API 輸入，僅在載入舊磁碟設定時回退。
  - 舊設定缺失／非法值回退在 `normalizeLanguageTag` 與 `normalizeAiSettings` 路徑邏輯成立，且單元測試覆蓋非法值回退；但沒有以實際舊版 `settings.json` 啟動伺服器的整合測試。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - 語言驗證與 prompt 指令集中於 `lib/ai/languages.mjs`，server 與 optimizer 共用同一 canonicalizer，結構清楚，避免把自由輸入直接插入 system prompt。
  - `COMMON_AI_LANGUAGES` 同時存在於 `lib/ai/languages.mjs:3-16` 與 `public/review.html:202` 的手寫選項，未由共同資料源產生，未來容易漂移；目前兩者逐項核對一致。
  - `validateBatch` 的 ID 驗證與 index 配對混用，是本輪最嚴重的資料關聯缺陷；函式名稱及既有測試輸出「固定 cue ID、時間碼」會造成已完整保護的錯覺。
  - `git diff --check` 於 2026-07-20 11:57 CST 通過；相關 JavaScript 語法亦由 `npm run check` 的 `node --check` 階段通過。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-20 執行 `npm run check`：文件、語法、治理 fixture、媒體、AI optimizer、provider、review UI 測試通過；核心測試在 sandbox 內因 `listen EPERM 127.0.0.1:21460` 中止，這是環境限制而非產品失敗。
  - 經授權於 sandbox 外執行 `npm test`，全部現有測試通過，包含核心 API 回歸。
  - `scripts/test-ai-optimizer.mjs:5-8,30-40` 覆蓋基本 canonicalization、注入拒絕、舊值回退、translate prompt；`scripts/test-core.mjs:188-200` 覆蓋專用設定 API 的 `fr-ca` 保存與注入值 400；`scripts/test-review-ui.mjs:18-22` 僅以靜態 regex 驗證 UI 元素與函式存在。
  - 缺口：沒有回傳 cue 順序交換測試，因此上述時間碼錯配未被發現；沒有完整合法 BCP 47 variant／extension 案例；沒有 AI 任務 API 非法語言 400、一般 `/api/settings` 非法巢狀語言、實際舊設定檔啟動回退、常用與自訂 UI 真實互動／保存再載入測試；非 translate 模式目前僅預設 proofread 被斷言，未逐一涵蓋 breaks／terms／fillers 與自訂 prompt。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - sandbox 外 `npm test` 實際完成並回報核心回歸通過，證實設定 API 基本保存、API Key 隔離、AI retry／checkpoint／resume 及既有任務流程未被現有案例破壞。
  - 最小 optimizer 探針實際重現 cue 順序交換未被拒絕且 start/end 錯配，故核心保護不能判定可用。
  - 最小語言探針實際證實基本語言、script/region 與注入拒絕可用，但合法 variant／extension 被錯拒。
  - 本輪未啟動 Electron／瀏覽器進行人工 UI 操作，也未連接真實 LLM provider；因此自訂欄位 focus、顯示切換、保存再載入，以及模型實際遵循目標語言均屬未覆蓋。後者本質上仍受供應商模型能力影響，必須保留人工確認建議的產品約束。

## 綜合判定

- 結論：不通過
- 最終結論（供 `08-CHANGE-LOG.md` 逐字引用）：**本輪 round1 獨立審查結論為不通過：多語言設定、專用 API 驗證、舊值回退與目標語言 Prompt 的基本路徑已建立，現有完整自動測試亦通過，但 AI 回傳 cue 順序交換未被拒絕且會把建議綁到錯誤的原文與時間碼，並且自訂驗證器拒絕合法 BCP 47 variant／extension，因此 FR-008、FR-013 與設計所要求的 cue 順序／時間碼保護及自訂 BCP 47 支援尚未達成。**
- 阻擋問題（若有）：
  1. 修正 `validateBatch` 對順序交換的處理，確保每個 suggestion 的 ID、original、start、end 永遠來自同一來源 cue；依既定設計應拒絕任何順序變更，並新增交換順序測試。
  2. 使 BCP 47 驗證承諾與實作一致：接受 `Intl.getCanonicalLocales` 可標準化且產品允許的完整合法標籤（至少涵蓋 variant 與 extension），或明確縮減需求／UI 文案並定義受支援子集；安全長度上限須有規格依據。
  3. 查明並統一 `/api/settings` 對 `ai.language` 的寫入契約；若可寫 AI 設定，新非法 API 輸入須 400，舊磁碟設定才可回退。
- 剩餘風險：尚無真實 UI 操作與真實 provider 語言遵循證據；常用語言清單在 HTML 與後端重複維護；舊設定回退缺少啟動整合測試。
- 給主要開發代理的具體修正要求（若有）：完成上述三項阻擋修正，補齊 cue 交換、合法 BCP 47 variant／extension、兩個設定 API 與 AI 任務 API 非法值、舊設定啟動回退、各非翻譯模式 prompt 的回歸案例；重跑 `npm run check`，並建立 round2 報告複審，不得覆寫本報告。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
