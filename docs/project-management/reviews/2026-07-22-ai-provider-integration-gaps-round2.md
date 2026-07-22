# 獨立審查報告：完成 0.45.2 AI 供應商整合缺口

- 審查對象 commit／版本：`168abd74656acd5f190c6e7576640ba86feac488`／`0.45.2`，分支 `codex/release-v0.45.2`；審查範圍為 2026-07-22 09:48:09 CST 擷取的未提交工作樹差異。
- 對應 08-CHANGE-LOG 條目：2026-07-22 — 完成 0.45.2 AI 供應商整合缺口
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-07-22（Asia/Taipei）；由使用者直接啟動、代表同一獨立審查角色的新獨立上下文，未沿用主要開發代理對話記憶。
- 審查環境：macOS sandbox；Node.js `v22.22.3`、npm `10.9.8`。sandbox 禁止監聽 `127.0.0.1`，完整回歸的核心測試收到 `listen EPERM`；依使用者指示未等待、未啟動 GUI、未封裝，也未修改專案繞過限制。

## 1. 需求完整性

- 判定：部分通過
- 證據：FR-009 與 NFR-001／002／005／006 見 `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:24-25,35-40`；本工作成功條件見 `docs/project-management/08-CHANGE-LOG.md:55`。round1 的核心功能缺口已修正：`public/review.js:221-245,373-425` 在載入 settings/profile 時保存快照，測試前先比較 provider、Base URL、model，Azure 另含 deployment/apiVersion，驗證錯誤發生於 `/api/ai/test` fetch 前；`public/ai-provider-settings.mjs:1-26` 提供可執行的正規化、比較及 API Key 狀態驗證。
- 未完成：round1 明確要求「新增可執行的 UI 行為測試，證明未保存欄位不會呼叫 `/api/ai/test`，保存後才會呼叫且按鈕必定恢復」（`docs/project-management/reviews/2026-07-22-ai-provider-integration-gaps-round1.md:61`）。現有 `scripts/test-review-ui.mjs:36-50` 執行純函式斷言及原始碼先後位置比對，沒有實際執行 `testAiConnection`、沒有 mock fetch 次數，也沒有 DOM button 狀態斷言，故該成功條件的自動化部分仍不完整。

## 2. 邏輯正確性

- 判定：通過
- 證據：`providerProfileSnapshot` 會 trim 並移除 Base URL 尾斜線，僅 Azure 保留 deployment/apiVersion；`providerProfileMatches` 比較完整快照（`public/ai-provider-settings.mjs:1-17`）。`validateProviderConnectionForm` 依序阻擋空 Base URL、空 model、輸入中未保存 key、無已保存 key及 profile 差異（同檔 `:19-26`）。`testAiConnection` 在 `try` 內先驗證再 fetch，所有成功、阻擋與例外路徑都由 `finally` 恢復按鈕（`public/review.js:405-426`）。因此 round1 所指出的「畫面未保存值卻測試後端舊值」邏輯缺口已解除。
- Groq／Gemini 契約未回歸：Groq 使用 `/models` 與 Bearer；Gemini models 使用 `/v1beta/models`＋`x-goog-api-key`，optimizer 使用 `/v1beta/openai/chat/completions`＋Bearer（`lib/ai/providers.mjs:68-90`）。2026-07-22 09:46 CST 實際執行 `node scripts/test-ai-providers.mjs` 通過，請求斷言見 `scripts/test-ai-providers.mjs:36-55`。

## 3. 邊界情況

- 判定：部分通過
- 證據：2026-07-22 09:46 CST 執行 `node scripts/test-review-ui.mjs` 通過。可執行純函式案例涵蓋相同 Groq profile、Base URL 尾斜線正規化、未保存 Base URL、model、provider、Azure deployment、Azure apiVersion、輸入中 API Key、無已保存 key（`scripts/test-review-ui.mjs:38-50`）。非法 provider、停用 Azure 空設定、Groq/Gemini key 隔離與刪除隔離另有核心案例（`scripts/test-core.mjs:205-252`）。
- 未覆蓋：沒有自動化 UI 行為案例把上述每種表單狀態接到實際 click handler；特別缺少「已保存且未變更 → 確實送出一次 `/api/ai/test` → 按鈕恢復」及「驗證阻擋 → 零次 fetch → 按鈕恢復」。治理文件只記錄未保存 Groq model 的人工案例（`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:78`），不足以取代 round1 指定的雙向自動行為回歸。

## 4. 程式碼品質

- 判定：部分通過
- 證據：把 profile 狀態規則抽成無 DOM 相依的 `public/ai-provider-settings.mjs`，可供 renderer 與 Node 測試共用，較 round1 前的散落條件易於維護；2026-07-22 09:46 CST `git diff --check` 通過。`.mjs` 靜態 MIME 明確為 `text/javascript`（`server.mjs:39-44`），核心整合測試亦有實際 response header 斷言（`scripts/test-core.mjs:170-172`）。
- 缺口：前端仍另行維護 provider 白名單及 Base URL defaults（`public/review.js:63,383-389`），與後端 registry 重複。更重要的是 handler 未抽成可注入 fetch/DOM 的可測單位，導致本輪只能用原始碼字串順序推定 fetch 與 finally 行為，形成直接行為測試缺口。

## 5. 測試覆蓋

- 判定：不通過
- 證據：
  - 2026-07-22 09:46 CST，`node scripts/test-ai-providers.mjs`：通過。
  - 2026-07-22 09:46 CST，`node scripts/test-review-ui.mjs`：通過。
  - 2026-07-22 09:46 CST，`git diff --check`：通過。
  - 2026-07-22 約 09:47 CST，`npm run check`：治理、語法、治理 fixture、media、optimizer、provider、review UI 均通過；`test-core.mjs` 因 sandbox `listen EPERM 127.0.0.1:21401` 中止。依使用者指示未要求額外 listen 權限；`docs/project-management/08-CHANGE-LOG.md:61` 保存主要開發環境以相同完整指令通過的可回溯證據，本輪不冒充親自重現。
- 阻擋：`scripts/test-review-ui.mjs:36-50` 不是 round1 要求的 UI 行為測試。它沒有呼叫 handler、沒有模擬 click、沒有攔截 `/api/ai/test`、沒有斷言 fetch 0/1 次，也沒有斷言 button disabled 的完整狀態轉移。round1 的具體測試修正要求尚未完成。
- MIME 覆蓋：程式映射與 `test-core` 斷言充分；本輪因 listen 限制未親自執行該 HTTP 案例，但已有主要開發完整回歸證據。這不是本輪新增阻擋，剩餘阻擋是 UI 行為回歸本身。

## 6. 實際運行結果

- 判定：部分通過
- 證據：可執行 provider 契約與表單純函式測試在本獨立上下文通過；程式路徑可確認驗證在 fetch 前且按鈕在 finally 恢復。治理文件記錄的 macOS 瀏覽器案例實際觀察未保存 Groq model 被阻擋、按鈕恢復、server log 無 `/api/ai/test`（`docs/project-management/08-CHANGE-LOG.md:61`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:78`），可作主要開發證據，但不是本輪親自操作，也只覆蓋阻擋側。
- 安全／隱私：provider-specific runtime／磁碟 key 與清除流程見 `server.mjs:403-427,3221-3240`；一般 settings 回應不含 key，核心斷言見 `scripts/test-core.mjs:181-203,223-252`。Gemini key 不進 URL，models/chat 分別使用正確 header；本輪 provider contract 實測通過。既有全域 `SUBTITLE_AI_API_KEY` 與 legacy `secrets.apiKey` fallback 仍可跨 provider 套用（`server.mjs:403-408`），屬已知相容語意風險，未發現本輪新增的 key 洩漏。
- 治理追溯：`docs/project-management/08-CHANGE-LOG.md:60-73` 已補實際修改、開發驗證、round1 原檔連結／原判定、處理狀態、部署與遺留風險，round1 處理可回溯。條目維持「進行中」且明記待 round2（`:49,62-66`）符合複審尚未完成的事實；主要代理仍需在收到本報告後連結 round2 並依判定更新狀態。

## 綜合判定

- 結論：不通過
- 阻擋問題（若有）：round1 的功能阻擋已解除，但其明確要求的可執行 UI 行為回歸仍未完成。須新增實際執行連線 handler（或等價可測控制器）的測試，至少證明：(1) 未保存 provider／Base URL／model／Azure deployment／apiVersion／API Key 各自阻擋且 `/api/ai/test` fetch 為 0 次；(2) 已保存且未變更的 profile/key 會 fetch 1 次；(3) 阻擋、成功及 fetch 失敗後按鈕均恢復可用。純函式斷言、原始碼順序 regex 與單一人工阻擋案例不能取代此要求。
- 剩餘風險：尚無真實 Groq／Gemini key 的外部 smoke test；修正後尚未重建 Windows／macOS 候選封裝或做乾淨實機驗證；前後端 provider/defaults 重複維護；全域／legacy key fallback 的跨 provider 語意尚未明文化或具 migration 測試。sandbox listen 限制使本輪未親自完成 `test-core`／完整 `npm run check`，但主要開發紀錄已有通過證據。
- 給主要開發代理的具體修正要求（若有）：新增上述 UI 行為測試後重跑 `node scripts/test-review-ui.mjs`、`node scripts/test-core.mjs` 與 `npm run check`；把結果及本 round2 報告連結寫回 `08-CHANGE-LOG.md`，再要求 round3 複審。無需為本阻擋重做 GUI 或封裝。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
- 簽署：Codex 獨立審查代理，2026-07-22 09:48 CST（Asia/Taipei）。
