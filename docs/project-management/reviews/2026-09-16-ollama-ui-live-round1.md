# 獨立審查報告：Ollama packaged 校閱頁 live UI 流程驗收（FR-021-033）

- 審查對象 commit／版本：`codex/0.51-anthropic-claude@17df9788abf2`；版本 `0.51.0`；工作樹含本輪未提交變更。
- 對應 08-CHANGE-LOG 條目：`2026-09-16 — Ollama packaged 校閱頁 live UI 流程驗收（FR-021-033）`。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-09-16 12:49:54 CST（Asia/Taipei）；獨立上下文，依專案 `AGENTS.md`、full preflight 路由、指定程式與保存證據重新查證，未沿用主要開發代理的評價性結論。
- 審查限制：依需求只執行不改動既有專案檔的靜態檢查、focused test 與完整回歸；未重跑會建立新 evidence 的 live GUI probe。指定 evidence SHA-256 為 `e0796e058af6726dbaf2aea83baaad8dcf3ceb4e1829ab655b9cef33e08d558f`。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-16` 將成功條件限定為隔離 userData 的 packaged Electron／校閱頁 Ollama loopback UI 流程，包含 2 cue、英文輸出、建議、全部接受、undo／redo、保存與時間碼保護，並於 `:14` 明確排除真正斷網、LM Studio、模型管理、外部 API Key、使用者資料及發布；`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37,44-50` 保留 FR-021 原始完整需求與 LM Studio 範圍例外，沒有把本輪局部驗收誤標為 FR-021 整體完成。

## 2. 邏輯正確性

- 判定：通過
- 證據：`scripts/verify-electron-ollama-ui.mjs:205-266` 由 packaged 首頁建立並完成 2 cue 手動任務、保留 token 導覽校閱頁；`:268-323` 從 UI 設定 Ollama、loopback URL、`llama3.2:1b` 與英文；`:348-381` 按下 translate／AI 優化並要求 completed、2 suggestions 與 session；`:383-447` 從 UI 全部接受、undo、redo、保存 `reviewed.srt`，再驗證 cue 數與時間碼；`public/review.js:605-668,763-821,1565` 顯示這些按鈕實際連到 AI optimize、decision、session direction 與 save-review 產品流程。

## 3. 邊界情況

- 判定：通過
- 證據：`scripts/verify-electron-ollama-ui.mjs:17-22` 在啟動前拒絕無效 port／timeout、既有 evidence 與非 loopback URL；`:147-159` 使用隔離 Electron userData 並清空 `SUBTITLE_AI_API_KEY`／`SUBTITLE_AI_KEYS_JSON`；`:180-185` 如實標記 `systemNetworkDisabled=false`、loopback、無 API Key 與 LM Studio 例外；`:465-475` 以 exclusive `flag: 'wx'` 建立 evidence 並 finally 清理暫存資料。審查於 2026-09-16 12:49 CST 實跑遠端 URL 拒絕，得到 `REMOTE_URL_REJECTED_BEFORE_LAUNCH`／`REMOTE_GUARD_NO_OUTPUT_CREATED`，並實跑既有 evidence 拒絕得到 `EXISTING_EVIDENCE_REJECTED_BEFORE_LAUNCH`；指定 evidence `:12-20,40-51` 同時記錄 endpoint local、無 key、local privacy 與 consent disabled。

## 4. 程式碼品質

- 判定：通過
- 證據：`scripts/verify-electron-ollama-ui.mjs:29-145` 將 hash、SRT、assertion、DevTools target／WebSocket 與 renderer evaluation 拆成可檢查函式；`:190-203,461-479` 集中處理 Electron 終止、錯誤摘要、exclusive evidence 與清理；`scripts/test-ai-providers.mjs:325-358` 對 UI 導覽、設定、啟動、接受、undo／redo、保存、loopback、空 API Key、未宣稱斷網、exclusive create 與 npm script 建立 source contract；`package.json:18` 提供可重放的 `acceptance:ollama:ui` 入口。`node --check scripts/verify-electron-ollama-ui.mjs`、`node --check scripts/test-ai-providers.mjs` 與限定差異的 `git diff --check` 均於 2026-09-16 12:49 CST exit 0。

## 5. 測試覆蓋

- 判定：通過
- 證據：2026-09-16 12:49 CST 執行 `node scripts/test-ai-providers.mjs` exit 0，輸出「AI provider contract 與術語／Prompt 測試通過」；同時以 `jq -e` 核對 evidence schema、pass、loopback、無 API Key、未關閉系統網路、2 cue job、英文設定、2 suggestions、2 accepted、undo／redo、保存與時間碼未變，並以秘密樣式掃描得到 `EVIDENCE_SECRET_SCAN_CLEAN`。其後執行 `npm run check` exit 0，涵蓋治理文件、Node 語法、Whisper、Breeze、Electron、媒體、雙語、品質、AI fetch／optimizer／providers、Ollama streaming、review UI 與核心 API 回歸。

## 6. 實際運行結果

- 判定：通過
- 證據：`docs/project-management/evidence/2026-09-16-ollama-ui-live-final.json:2-22` 記錄 macOS arm64、packaged executable、Ollama `llama3.2:1b`、loopback local 與 `status=pass`；`:28-38` 記錄任務 HTTP 201／202、job completed、2 cue 與校閱頁 ready；`:40-70` 記錄 UI 設定保存、英文、無 key、AI completed、2 suggestions、0 retries 與接受 2 筆；`:72-102` 記錄 undo／redo、`reviewed.srt` 保存、2 cue、時間碼未變、英文內容旗標及來源時間碼/hash。`docs/project-management/workflows/04-INDEPENDENT-REVIEW.md` 要求的獨立報告、六面向、可回溯證據與聲明均由本檔提供；最新 CHANGE-LOG 仍為進行中，應由主要開發代理引用本報告後完成結案門檻。

## 綜合判定

- 結論：通過
- 可逐字引用的完整結論句：**本輪 FR-021-033 獨立審查通過限定的 macOS arm64 packaged Ollama loopback 校閱頁 live UI 流程：保存證據顯示 UI 設定英文輸出、2 cue 任務完成、2 筆 AI 建議、全部接受、undo／redo、reviewed.srt 保存及時間碼未變；本結論不代表真正斷網、LM Studio、Windows／乾淨安裝、模型翻譯品質或 FR-021 整體完成。**
- 阻擋問題（若有）：無
- 剩餘風險：`systemNetworkDisabled=false`，因此沒有真正斷網證據；LM Studio 依需求方範圍例外未執行；只驗證既有 macOS arm64 packaged candidate，未覆蓋 Windows、乾淨安裝、簽章／公證或發布。Evidence 為保存結果，本審查未重跑會產生新檔的 live GUI；`hasEnglishTranslation` 是「含 ASCII 且至少一 cue 與來源不同」的粗粒度旗標，fixture 本身含英文詞，故只能支持流程與基本英文內容存在，不能取代逐 cue 完整翻譯品質審查。undo／redo evidence 保存成功布林值但未保存每一步的變更筆數／內容快照；source-contract 測試則屬靜態 regex 防回歸，不等同所有 runtime 邊界測試。
- 給主要開發代理的具體修正要求（若有）：無阻擋修正；結案時必須維持上述限定範圍與剩餘風險，引用本報告完整結論句，並在更新最新工作條目後執行 `npm run docs:check:final` 與 `git diff --check`。若後續要宣稱英文翻譯品質或完整 undo／redo 資料正確性，建議另存逐 cue 語言判定摘要與每一步變更計數／hash，不保存字幕全文或秘密。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
