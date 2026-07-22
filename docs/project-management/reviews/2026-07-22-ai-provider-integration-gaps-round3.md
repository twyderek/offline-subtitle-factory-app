# 獨立審查報告：完成 0.45.2 AI 供應商整合缺口

- 審查對象 commit／版本：`168abd74656acd5f190c6e7576640ba86feac488`／`0.45.2`，分支 `codex/release-v0.45.2`；審查範圍為 2026-07-22 09:52:20 CST 擷取的未提交工作樹差異。
- 對應 08-CHANGE-LOG 條目：2026-07-22 — 完成 0.45.2 AI 供應商整合缺口
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-07-22（Asia/Taipei）；使用者直接啟動、代表同一獨立審查角色的新獨立上下文，未沿用主要開發代理對話記憶。
- 審查環境：macOS sandbox；Node.js `v22.22.3`、npm `10.9.8`。sandbox 禁止監聽 `127.0.0.1`，完整回歸的核心測試收到 `listen EPERM`；依使用者指示未長時間等待、未啟動 GUI、未封裝、未修改專案繞過限制。

## 1. 需求完整性

- 判定：通過
- 證據：工作成功條件見 `docs/project-management/08-CHANGE-LOG.md:55`。round1 的 profile 快照與未保存值阻擋保留於 `public/ai-provider-settings.mjs:1-26`；round2 新增的 `runProviderConnectionTest` 包含驗證、request、HTTP／fetch 錯誤及 finally 恢復（同檔 `:29-46`）。實際 renderer handler 直接呼叫此控制器並注入真實 button、保存快照、目前表單、key 狀態、`fetch('/api/ai/test')` 與狀態函式（`public/review.js:405-424`），不是只供測試使用的旁路實作。

## 2. 邏輯正確性

- 判定：通過
- 證據：控制器在 request 前執行 `validateProviderConnectionForm`；阻擋與任何例外都回傳 `null`，成功才回傳 result，且所有路徑由 `finally` 將 button 恢復（`public/ai-provider-settings.mjs:29-46`）。handler 只在 result 非空時更新「AI 已連線」badge（`public/review.js:420-424`），失敗不會假標成功。provider/Base URL/model 及 Azure deployment/apiVersion 由正規化快照完整比較，輸入中 API Key 與缺少已保存 key 另有前置阻擋（`public/ai-provider-settings.mjs:1-26`）。
- Groq／Gemini 契約未回歸：Groq models/chat 使用 OpenAI-compatible Bearer；Gemini models 使用 `/v1beta/models`＋`x-goog-api-key`，chat 使用 `/v1beta/openai/chat/completions`＋Bearer（`lib/ai/providers.mjs:68-90`）。2026-07-22 約 09:51 CST 親自執行 `node scripts/test-ai-providers.mjs` 通過。

## 3. 邊界情況

- 判定：通過
- 證據：`scripts/test-review-ui.mjs:51-109` 直接執行與 handler 共用的控制器。未保存 provider、Base URL、model、Azure deployment、Azure apiVersion、輸入中 API Key、缺已保存 key 七類案例均斷言 request 0 次、result 為 null、失敗狀態可見且 button 恢復（`:69-83`）；已保存未變更 profile 斷言 request 1 次、成功 result／訊息及 button 恢復（`:85-89`）；HTTP 失敗斷言 request 1 次、null、後端錯誤訊息及 button 恢復（`:91-95`）；fetch 例外斷言不逃逸、可診斷訊息及 button 恢復（`:97-109`）。2026-07-22 約 09:51 CST 親自執行測試通過。

## 4. 程式碼品質

- 判定：通過
- 證據：連線流程已抽為可注入控制器，renderer 與 Node 行為測試共用同一實作；validation、request、status 與 button lifecycle 的責任邊界清楚（`public/ai-provider-settings.mjs:19-46`）。handler 保留 DOM 組裝與 badge 更新（`public/review.js:405-424`）。2026-07-22 約 09:51 CST `git diff --check` 通過。
- 非阻擋維護風險：前端 provider 白名單與 defaults 仍和後端 registry 重複，新增 provider 時需同步；現有 renderer／core 測試可降低但未消除此漂移風險。

## 5. 測試覆蓋

- 判定：通過
- 證據：
  - 2026-07-22 約 09:51 CST，`node scripts/test-review-ui.mjs`：通過；涵蓋 round2 要求的 request 0/1 次及阻擋、成功、HTTP 失敗、fetch 例外 button 恢復。
  - 2026-07-22 約 09:51 CST，`node scripts/test-ai-providers.mjs`：通過；涵蓋五 provider、Groq/Gemini URL 與認證契約。
  - 2026-07-22 約 09:51 CST，`git diff --check`：通過。
  - 2026-07-22 約 09:51 CST，`npm run check`：`docs:check`、語法、治理 fixture、media、optimizer、provider、review UI 均通過；`test-core.mjs` 因 sandbox `listen EPERM 127.0.0.1:21019` 中止。依使用者指示接受可回溯主要開發證據：`docs/project-management/08-CHANGE-LOG.md:61` 記錄相同完整指令在允許 listen 的環境通過，`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:73-79` 列出 provider、core、MIME、key 隔離及 round2 行為矩陣。
- MIME：`.mjs` 映射為 `text/javascript`（`server.mjs:39-44`），核心 HTTP 測試直接斷言 `/ai-provider-settings.mjs` status 200 與 JavaScript MIME（`scripts/test-core.mjs:170-172`）。本輪受 listen 限制未親自重現該 HTTP 斷言，但來源與主要開發完整回歸證據一致。

## 6. 實際運行結果

- 判定：通過
- 證據：本獨立上下文實際執行共用控制器的完整行為矩陣，確認阻擋時不 request、合法狀態只 request 一次，四類結束路徑均恢復 button。實際 handler 的注入參數與測試控制器完全相同（`public/review.js:412-419`、`scripts/test-review-ui.mjs:55-65`）。
- key 隔離與安全：provider/profile/runtime key/DELETE API 均驗證 provider 並依 ID 操作（`server.mjs:3188-3240`）；一般設定回應與設定檔不含 key、Groq/Gemini key 及刪除互不影響的核心斷言見 `scripts/test-core.mjs:181-203,223-252`。Gemini key 不進 URL，models/chat 使用不同正確 header；本輪 provider contract 親自通過。既有全域 `SUBTITLE_AI_API_KEY` 與 legacy `secrets.apiKey` fallback 仍可跨 provider 套用（`server.mjs:403-408`），屬已揭露相容語意風險，未發現本輪新增洩漏。
- 治理追溯：`docs/project-management/08-CHANGE-LOG.md:63-69` 保留 round1/round2 原檔連結、逐字判定與各輪處理狀態；`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:78-79` 分別記錄 round1 與 round2 修正證據。條目仍為進行中並待 round3，符合報告建立前狀態；主要代理收到本報告後需連結 round3 並結案。

## 綜合判定

- 結論：通過
- 阻擋問題（若有）：無。round1 的未保存 profile 假成功與 round2 的 UI 行為回歸缺口均已解除；指定 request 次數與 button lifecycle 全部由共用實際控制器的可執行測試證實。
- 剩餘風險：未使用真實 Groq／Gemini key 做外部 smoke test；修正後尚未重建 Windows／macOS 候選封裝或做乾淨實機驗證；前後端 provider/defaults 重複維護；全域／legacy key fallback 的跨 provider 語意尚未明文化或具 migration 測試。本輪 sandbox listen 限制使核心 HTTP 測試未親自完成，但已有可回溯主要開發完整通過證據。
- 給主要開發代理的具體修正要求（若有）：無阻擋修正；將本 round3 報告連結與本判定逐字引用寫回 `08-CHANGE-LOG.md`，再依治理流程結案。本次不需要為複審額外啟動 GUI 或封裝。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
- 簽署：Codex 獨立審查代理，2026-07-22 09:52 CST（Asia/Taipei）。
