# 獨立審查報告：完成 0.45.2 AI 供應商整合缺口

- 審查對象 commit／版本：`168abd74656acd5f190c6e7576640ba86feac488`／`0.45.2`，分支 `codex/release-v0.45.2`；審查範圍為 2026-07-22 09:26:26 CST 擷取的未提交工作樹差異。
- 對應 08-CHANGE-LOG 條目：2026-07-22 — 完成 0.45.2 AI 供應商整合缺口
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-22（Asia/Taipei）；由使用者直接啟動的獨立上下文，未沿用主要開發代理對話記憶。
- 審查環境：macOS sandbox；Node.js `v22.22.3`、npm `10.9.8`。sandbox 內禁止監聽 `127.0.0.1`，核心測試首次收到 `listen EPERM`；未修改專案繞過，取得執行權限後在 sandbox 外以原指令重跑。

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:24-25,35-40` 定義 FR-008、FR-009、NFR-001、NFR-002、NFR-005、NFR-006；`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:77-88` 定義 BUG-010。五個 provider 已在 `lib/ai/providers.mjs:3-21` 集中列出，UI 選項見 `public/review.html:193-200`，非法 provider 的 settings/profile 拒絕及 key 隔離整合案例見 `scripts/test-core.mjs:201-248`。
- 未完成：工作條目明定「連線測試對未保存欄位與金鑰提供可採取行動的錯誤」（`docs/project-management/08-CHANGE-LOG.md:55`），但 `public/review.js:405-411` 只檢查欄位非空、輸入框是否仍有 key，以及 `dataset.hasKey`；沒有比較目前 Base URL／model 與已保存 profile。使用者載入已有 key 的 profile 後修改 Base URL 或模型但不儲存，仍會呼叫 `/api/ai/test`；後端則固定使用已保存的 `appSettings`（`server.mjs:3242-3247`），因此可能把舊設定的成功誤報為畫面目前未保存欄位的成功。
- 治理追溯在快照時亦未結案：`docs/project-management/08-CHANGE-LOG.md:49,60-63,70` 仍為「進行中／待執行」，故 NFR-006 尚未完成；這部分應由主要開發代理依本報告結論更新，不得由審查代理代改。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：後端以 `isSupportedProvider` 驗證新 API 值（`server.mjs:3167-3179,3187-3217,3220-3239`），非法值回 400，不再無聲回退；`DELETE /api/ai/key` 明確依 query provider 清除（`server.mjs:3220-3228`）。profile、runtime key 與磁碟 key 皆以 provider ID 索引（`server.mjs:402-425,3205-3213,3230-3239`）。
- Gemini models 探測使用 `/v1beta/models` 與 `x-goog-api-key`，optimizer 使用 `/v1beta/openai/chat/completions` 與預設 Bearer header（`lib/ai/providers.mjs:73-90`）；與 Google 官方文件所示 models 認證及 OpenAI 相容端點一致：<https://ai.google.dev/api>、<https://ai.google.dev/gemini-api/docs/openai>。回應仍由 `lib/ai/subtitle-optimizer.mjs:12-18` 依 `choices[0].message.content` 解析，符合相容契約。
- 阻擋邏輯缺口為上述未保存 Base URL／model 仍測試舊設定並可能顯示成功，與條目成功條件不符。

## 3. 邊界情況

- 判定：部分通過
- 證據：2026-07-22 09:22–09:25 CST 執行 `node scripts/test-ai-providers.mjs`、`node scripts/test-review-ui.mjs`、`node scripts/test-core.mjs`。覆蓋五 provider 白名單、非法 settings/profile provider、停用 Azure 的空 Base URL、Groq profile、Gemini runtime key、跨 provider DELETE 隔離、Gemini models/chat 的不同認證（`scripts/test-ai-providers.mjs:15-55`、`scripts/test-core.mjs:201-248`）。
- Azure UI 在非 Azure profile 會清空且停用 deployment/apiVersion，切回 Azure 時恢復欄位（`public/review.js:386-396`）；初始設定套用也會停用非 Azure 欄位（`public/review.js:218-231`）。
- 未覆蓋／失敗案例：沒有行為測試模擬「已有 key → 修改 Base URL 或 model → 未儲存 → 按測試連線」；`scripts/test-review-ui.mjs:24-31` 僅以正規表示式確認程式文字存在，無法驗證狀態機與實際 fetch 目標。另未使用真實 Groq／Gemini key，外部錯誤格式、配額與模型名稱仍未覆蓋。

## 4. 程式碼品質

- 判定：部分通過
- 證據：provider registry 集中後端能力與預設 URL（`lib/ai/providers.mjs:3-21`），server API 共用驗證函式，較原本分散白名單容易維護；`git diff --check` 於 2026-07-22 09:26:26 CST 通過。
- 缺口：前端另維護 `VALID_AI_PROVIDERS`（`public/review.js:62`）及 defaults map（`public/review.js:379-385`），仍可能與後端 registry 漂移；本輪已有 renderer 封裝驗證降低風險，但未形成單一來源。連線測試缺少「目前表單是否等於已保存 profile」狀態，造成 UI 顯示語意與實際被測設定分離。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-22 約 09:22 CST，`node scripts/test-ai-providers.mjs`：通過，輸出「AI provider contract 與術語／Prompt 測試通過」。
  - 2026-07-22 約 09:22 CST，`node scripts/test-review-ui.mjs`：通過。
  - 2026-07-22 約 09:23 CST，sandbox 內 `node scripts/test-core.mjs`：因 `listen EPERM 127.0.0.1:21902` 失敗；未修改專案。sandbox 外以相同指令重跑：通過。
  - 2026-07-22 約 09:24 CST，sandbox 內 `npm run check`：前置文件、語法與模組測試通過，核心測試因 `listen EPERM 127.0.0.1:21272` 中止；sandbox 外以原指令重跑：完整通過，包含治理、語法、media、optimizer、provider、review UI 與 core API。
  - 2026-07-22 09:26:26 CST，`git diff --check`：通過。
- 缺口：缺少前述未保存 Base URL／model 的行為回歸測試；Gemini optimizer 測試雖 mock 出 `choices[].message.content`（`scripts/test-ai-providers.mjs:7-12`），但只斷言 request URL/header/body（`scripts/test-ai-providers.mjs:49-55`），未把 Gemini adapter 與 optimizer parser 串成單一整合案例。

## 6. 實際運行結果

- 判定：部分通過
- 證據：核心 HTTP 整合測試在允許本機 listen 的環境以未修改原指令成功完成；API 實際保存 Groq profile、建立 Gemini runtime key、依 provider 清除 Groq key 且保留 Gemini key（`scripts/test-core.mjs:219-248`）。provider mock 實際捕捉 Gemini models 的 `x-goog-api-key` 與 OpenAI 相容 chat 的 Bearer header（`scripts/test-ai-providers.mjs:42-55`）。
- 環境限制與未覆蓋：sandbox 內無法監聽本機連接埠，已如實記錄並在 sandbox 外重跑；本輪未以真實供應商金鑰呼叫外部服務，也未重建候選封裝。現有治理文件記載的 2026-07-22 瀏覽器手測不是本獨立上下文親自重現，僅視為主要開發證據，不取代本輪實測。
- 安全／隱私：未發現本次差異新增影音上傳或把 key 放入 URL、一般 settings 回應、repo 或測試輸出的 regression；`public/review.html:188-201` 仍明示只傳字幕文字，`server.mjs:428-431` 公開設定不含 key，核心測試在 `scripts/test-core.mjs:198-199,231-233` 驗證 key 不回應、不進一般設定。剩餘風險是 `server.mjs:403-407` 的全域環境 key／舊版 `secrets.apiKey` fallback 會套用到各 provider；這是既有相容路徑而非本輪新增，但與嚴格 provider key 隔離的期待存在語意風險，後續應明文化或補 migration 測試。

## 綜合判定

- 結論：不通過
- 阻擋問題（若有）：
  1. `public/review.js:405-415` 未辨識未保存的 Base URL／model，會用後端舊 profile 測試後把結果顯示在目前已修改的畫面欄位上；違反工作條目 `docs/project-management/08-CHANGE-LOG.md:55` 的明確成功條件，可能造成錯誤的連線成功判讀。
  2. 對應工作條目在審查快照仍未補齊實際修改、開發驗證與審查狀態（`docs/project-management/08-CHANGE-LOG.md:49,60-63,70`），NFR-006 尚未結案。
- 剩餘風險：無真實 Groq／Gemini 外部 smoke test、無修正後封裝驗證；provider 白名單與預設值仍有前後端重複維護；全域／legacy key fallback 的跨 provider 語意尚未有明確 migration 契約。未發現本輪新增的已證實 security/privacy regression。
- 給主要開發代理的具體修正要求（若有）：保存或記錄已載入 profile 快照，測試連線前比較 provider、Base URL、model（Azure 另含 deployment/apiVersion）與目前表單；若不一致，阻止測試並提示先儲存。新增可執行的 UI 行為測試，證明未保存欄位不會呼叫 `/api/ai/test`，保存後才會呼叫且按鈕必定恢復。補齊工作紀錄後，要求 round2 複審；若改動連線狀態邏輯，重跑 provider、review UI、core 與 `npm run check`。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
- 簽署：Codex 獨立審查代理，2026-07-22 09:26 CST（Asia/Taipei）。
