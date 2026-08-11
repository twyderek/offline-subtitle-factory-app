# 獨立審查報告：Ollama 回傳內容非有效 JSON 調查（BUG-018）

- 審查對象 commit／版本：0.48.0 工作樹與 2026-08-05 12:15 建立的 macOS arm64／Windows x64 本機測試 ZIP
- 對應 08-CHANGE-LOG 條目：2026-08-05 — Ollama 回傳內容非有效 JSON 調查（BUG-018）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-05 12:16 +08:00；獨立讀取最新來源、BUG-018 工作紀錄、基準 job checkpoint、focused／完整測試與兩平台封裝，未沿用主要開發代理的評價性結論。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:16-29` 與 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:165-174` 要求在 strict cue validation 前安全擷取完整 JSON wrapper；對 Ollama malformed JSON 最多進行一次明確 repair；第二次仍無效時拒絕、不回退原文或不完整 cue；保留 checkpoint／cue ID／數量／順序驗證並顯示 UI telemetry。`lib/ai/subtitle-optimizer.mjs:82-102` 實作 code fence／前後包裝文字的 `{...}`／`[...]` candidates 與 `invalid_json`；`lib/ai/subtitle-optimizer.mjs:196-218,286-310` 將 JSON repair 限定於 Ollama malformed JSON 並在 repair 後再次 strict validation；`public/review.js:538-548` 顯示「正在要求 Ollama 重新輸出 JSON」。`scripts/test-ai-optimizer.mjs:36-41,137-173` 覆蓋 wrapper、proofread malformed→repair、第二次 malformed 拒絕與最多兩次請求。

## 2. 邏輯正確性

- 判定：通過
- 證據：`parseCompletionContent` 先取 `choices[0].message.content`、移除 code fence，再依完整內容、首尾 object、首尾 array 順序嘗試 `JSON.parse`；解析成功的 object 只取 `parsed.cues`，array 直接使用，否則建立 `code=invalid_json`（`lib/ai/subtitle-optimizer.mjs:82-102`）。`validateBatch` 仍先拒絕非陣列、數量不符、未知／重複／順序錯誤 ID，再檢查文字長度與語系／模式條件（同檔 `104-137`）。`canRepairOllamaJson` 僅接受 provider `ollama` 且 `invalid_json`，並在同一批次 validation catch 中建立一次 repair body、重新呼叫並再次 validate（`196-218,286-310`）；repair 第二次失敗不再進入另一個 repair 分支。既有 translation 專用 repair 先行，非 Ollama provider 不會套用此 malformed JSON repair。`onCheckpoint` 仍只在整批 validate 後保存（`server.mjs:659-675`），因此失敗批次不會被當作成功或覆蓋已完成批次。

## 3. 邊界情況

- 判定：部分通過
- 證據：`node scripts/test-ai-optimizer.mjs` 實測前後說明文字包住完整 JSON 可擷取、Ollama proofread 首答截斷 JSON 後只 repair 一次並成功、repair 第二次仍 `not-json` 時拒絕且呼叫次數為 2；同測試也保留既有 translation repair 第二次過短／malformed 拒絕、cue 數量／順序與語系 strict validation。`proofreadProgress` 斷言 `validationRepair=true`，證明 optimizer telemetry 已發出。尚未有真實 Ollama raw response，無法判定原始失敗究竟是 wrapper、截斷、未跳脫內層引號或 schema 失守；未實測巢狀／多段 JSON、串流切片後 wrapper、repair response 具 cue contract 錯誤、Windows 實機或不同 Ollama 版本，因此這些邊界仍待外部驗收。

## 4. 程式碼品質

- 判定：通過
- 證據：wrapper parser、strict validator、provider-specific repair、checkpoint 與 UI progress 分層，且未放寬 cue ID／數量／順序／文字規則；repair prompt 明確禁止 Markdown、前後說明、註解與未跳脫換行，要求保留 ID、數量與原順序（`lib/ai/subtitle-optimizer.mjs:201-215`）。2026-08-05 12:18 執行 `node --check server.mjs`、`node --check lib/ai/subtitle-optimizer.mjs`、`node --check public/review.js` 與 `git diff --check` 均通過。兩平台 unpacked app source 均可搜尋到 `parseCompletionContent`、`canRepairOllamaJson`、`buildJsonRepairBody`、`validationRepair` 與 UI repair 文案，markers 一致。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-08-05 12:18 執行 `node scripts/test-ai-optimizer.mjs`（`AI 字幕優化測試通過：固定 cue ID、時間碼、差異建議、進度與回應驗證`）與 `node scripts/test-ai-providers.mjs`（`AI provider contract 與術語／Prompt 測試通過`）。同日 12:18:04 首次 `npm run check` 在核心 HTTP 測試監聽 `0.0.0.0` 時因 sandbox `listen EPERM` 中止；12:18:18 以受控權限重跑，文件檢查、語法檢查、全部 npm test（含 `test-ai-optimizer`、`test-ai-providers`、`test-review-ui` 與核心回歸）均通過。基準 job `/Users/nycu/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json` 實測為 `status=failed`、`provider=ollama`、`model=llama3.2:3b`、`error=AI 回傳內容不是有效 JSON`、`completedBatches=2/55`、`checkpoint.nextBatchIndex=2`、`suggestions=2`、`request.mode=proofread`、`request.language=ja`、`retryable=true`，與 BUG-018 現象一致。兩 ZIP 以 `unzip -t` 均回報 `No errors detected in compressed data`；重新計算 SHA-256 為 macOS `74b574ead3c1924a926608784550a2170bd6c0621248f699743e318a34d041df`、Windows `6f65f56c63148abde82067ebf96e738fca11924fbe92ed8ed7a1d1b3375884f9`。兩平台 manifest 的 Small 均為 487,601,967 bytes、SHA-256 `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b` 且 marker／檔案一致，Base 仍為 missing。完整回歸沒有真模型 response 證據。

## 6. 實際運行結果

- 判定：部分通過
- 證據：deterministic optimizer 實際完成 wrapper extraction、Ollama malformed proofread 的一次性 repair、repair 第二次 malformed 的安全拒絕與 telemetry；完整受控 `npm run check` 實際通過核心 HTTP server 回歸。兩個最新 ZIP 解壓後的 `lib/ai/subtitle-optimizer.mjs`／`public/review.js` production markers 與工作樹一致，Small manifest／檔案大小／SHA 一致。基準 job 顯示兩批 suggestions 與 `nextBatchIndex=2` 仍保留；`curl -sS --max-time 2 http://127.0.0.1:11434/api/tags` 實測回報 connection refused，沒有可保存或比對的 raw Ollama response，也沒有 Windows 實機操作證據。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無 deterministic parser／repair／strict validation、完整回歸或 ZIP 完整性阻擋；條件是未取得真實 Ollama raw response／同一 job 的修正後重跑，且 Windows 實機與不同 Ollama 版本未驗證，因此不得宣稱 BUG-018 已完成跨平台實機或正式 Release 驗收。
- 剩餘風險：目前 extraction 是首尾索引候選，不是完整 JSON tokenizer；巢狀／多段 wrapper、截斷、內層未跳脫引號或 valid JSON 但 cue contract 錯誤仍可能安全失敗。一次 repair 仍可能受模型能力影響；若失敗會保留 checkpoint，但需人工恢復。真實 Ollama response、不同版本行為與 Windows renderer／實機尚待外部驗收。
- 給主要開發代理的具體修正要求：在 `08-CHANGE-LOG.md` 連結本報告並逐字引用本節完整結論句，記錄 focused／完整測試時間、基準 job、Ollama connection refused、兩 ZIP SHA／unzip／markers；取得 raw response 後若結論改變，另建 round2，不覆寫本報告；完成工作條目後執行 `npm run docs:check:final`。
- 可逐字引用完整結論句：**本輪 BUG-018 已由 JSON wrapper extraction、Ollama malformed proofread 一次性 repair、第二次 malformed 拒絕、strict cue validation／checkpoint 與 UI validationRepair telemetry 的 deterministic 測試，以及兩平台最新 ZIP／Small manifest／SHA 核對證明修正契約；但本機 Ollama 連線拒絕、沒有 raw response 或同一 job 的修正後真模型重跑，Windows 實機與不同版本亦未驗證，因此結論為有條件通過，不得宣稱跨平台正式 Release 完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
