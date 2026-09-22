# 獨立審查報告：Anthropic 模型清單分頁完整性（BUG-028）

- 審查對象 commit／版本：`codex/0.51-anthropic-claude@17df9788abf2` 的未提交 BUG-028／FR-026 差異，產品版本 0.51.0。
- 對應 08-CHANGE-LOG 條目：2026-09-14 — Anthropic 模型清單分頁完整性（BUG-028）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-09-14 16:46 CST（Asia/Taipei）；由主要開發執行緒另開的獨立審查上下文，只取得工作名稱、檔案寫入限制與驗證重點，未採用主要代理對差異品質的評價。
- 審查環境：Darwin 25.6.0 arm64、Node.js v22.22.3。

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:13-18` 要求 `/v1/models` 使用 `limit=1000`、依 `has_more`／`last_id`／`after_id` 讀完所有頁面、維持順序、後頁模型正確計入，並在缺失／重複游標或超過 100 頁時明確失敗；`lib/ai/anthropic.mjs:95-113` 已實作主要流程。`scripts/test-ai-providers.mjs:237-278` 驗證兩頁合併、第二頁 modelAvailable、完整 modelCount、特殊字元編碼、缺失 flag／cursor、重複 cursor 與頁數上限。然而工作條目第 18 行明稱 `last_id` 為 opaque cursor 並須原值傳遞，實作第 107 行的 `.trim()` 會改寫非空白游標，故需求未完整滿足。
- 官方契約核對：Anthropic 官方 [List Models API](https://platform.claude.com/docs/en/api/models/list) 說明 `after_id` 是分頁 cursor、`last_id` 可作下一頁 `after_id`，`has_more` 表示該方向仍有結果，且 `limit` 合法範圍為 1–1000。現有方向與上限選擇符合官方文件；阻擋點是專案自行承諾的 opaque 原值傳遞遭到 trim。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：`lib/ai/anthropic.mjs:98-106` 每頁以 `URLSearchParams` 建立 `limit=1000`，第二頁起加入 `after_id`，資料依頁面順序 append，`has_more=false` 即回傳；第 108-113 行對空白、重複及 100 頁上限明確拋錯。2026-09-14 16:46 CST 執行 `node scripts/test-ai-providers.mjs` exit 0，證明一般分頁路徑正確。但獨立直接測試令第一頁回傳 `last_id:"  cursor /+?  "`，第二頁 URL 解碼後的 `after_id` 實際為 `"cursor /+?"`，strict assertion exit 1；`String(result.last_id || '').trim()` 同時被用來驗證與儲存，破壞 opaque 值。
- 阻擋問題細節：應先驗證 `last_id` 是非全空白字串，再以未修改的原字串進行重複檢查與 `params.set('after_id', ...)`。例如可用 trim 結果判斷是否全空白，但不可把 trim 後結果當作 cursor；否則前後空白有意義的 cursor 會請求錯頁，兩個只在外圍空白不同的 cursor 也可能被誤判重複。

## 3. 邊界情況

- 判定：部分通過
- 證據：`scripts/test-ai-providers.mjs:258-278` 實測一般兩頁、內含空格與 `/+?` 的 cursor、缺失 `has_more`、null `last_id`、重複 `last_id`、持續 100 頁仍有後頁，以及第二頁模型命中；`scripts/test-ai-providers.mjs:313-323` 另保留缺模型與空清單案例。本輪 focused 測試全部通過。未覆蓋且實際失敗的邊界是「非全空白但具有前後空白」的 opaque cursor；該案例在 URLSearchParams 可安全編碼／解碼，卻先被 adapter trim 改寫。
- 頁數上限核對：`lib/ai/anthropic.mjs:100-113` 最多發出 100 頁請求；第 100 頁若仍 `has_more=true`，迴圈結束後明確拋出「超過 100 頁安全上限」，不會無限請求。缺失 boolean `has_more`、空白 cursor 與重複 cursor 亦均會停止。

## 4. 程式碼品質

- 判定：部分通過
- 證據：分頁常數集中於 `lib/ai/anthropic.mjs:4-5`，主迴圈位於第 95-113 行，流程短且錯誤訊息可辨識；`node --check lib/ai/anthropic.mjs`、`node --check scripts/test-ai-providers.mjs` 與 `git diff --check` 均 exit 0。惟第 107 行把「空白有效性檢查」與「cursor 正規化」混為同一步，和第 18 行設計文件所稱 opaque cursor 相衝突；應拆開驗證值與傳遞值，並新增回歸案例固定原字串。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-09-14 16:46 CST 實際執行 `node --check lib/ai/anthropic.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs` 與 `git diff --check`，全部 exit 0。其後完整 `npm run check` exit 0，包含治理、Whisper、Breeze、Electron、媒體、字幕、AI fetch／optimizer／provider、Ollama streaming、review UI 與 core 回歸。既有 provider 測試同時保護 Anthropic `/v1/messages`、headers、GET 無生成 body、sampling 欄位過濾與其他 provider contract。測試缺口是第 268 行只使用中間含空格的 `"page 1/+?"`，沒有驗證 opaque cursor 的前後字元也必須原樣保留；新增的直接測試已證明此缺口會讓完整測試假綠。

## 6. 實際運行結果

- 判定：部分通過
- 證據：2026-09-14 16:46 CST 在 Darwin 25.6.0 arm64、Node.js v22.22.3 完整執行 `npm run check`，exit 0，終端最終回報核心回歸測試通過；focused provider 測試亦回報「AI provider contract 與術語／Prompt 測試通過」。同一環境的獨立 opaque-cursor 測試則 exit 1，輸出 `{"original":"  cursor /+?  ","actual":"cursor /+?"}`，AssertionError 顯示實際值遺失前後各兩個空白。未使用真實 Anthropic API Key 符合本輪範圍，但 deterministic 失敗已足以否定 opaque 原值傳遞的成功條件。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**BUG-028 round1 獨立審查判定不通過：一般分頁、異常游標、100 頁上限、Anthropic 既有契約與完整回歸均通過，但 listAnthropicModels 會 trim 非空白 opaque last_id，導致下一頁 after_id 未原值傳遞，須修正並補測後複審。**
- 阻擋問題（若有）：`lib/ai/anthropic.mjs:107` 不得把 `.trim()` 後的字串作為下一頁 cursor。請保留原始 string 作為 `seenCursors` key 與 `after_id` 值，只用 trim 判斷是否為全空白；並在 `scripts/test-ai-providers.mjs` 加入前後空白加特殊字元的 cursor，斷言第二頁 `searchParams.get('after_id')` 與第一頁 `last_id` 完全相等。修正後重跑 focused provider 測試、完整 `npm run check`、`git diff --check` 並建立 round2 複審報告。
- 剩餘風險：未以真實 Anthropic API Key、超過 20 筆的真實模型清單或自訂 proxy 驗證；外部網路中斷、速率限制、服務回應及跨平台封裝後行為仍待另行授權驗收。正式測試目前也未把 malformed `data` 非陣列列為明確錯誤，此項不在本輪成功條件，但可於後續 request-contract 強化時評估。
- 給主要開發代理的具體修正要求（若有）：依上述方式分離 cursor 空白檢查與原值傳遞，新增可重現本輪失敗的回歸案例；不得改變 Models URL、limit、順序、Messages API、認證、無生成測試與其他 provider 行為。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
