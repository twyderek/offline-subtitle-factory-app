# 獨立審查報告：Ollama cue 文字長度異常調查（BUG-019）

- 審查對象 commit／版本：0.48.0 工作樹與 2026-08-05 12:38 建立的 macOS arm64／Windows x64 本機測試 ZIP
- 對應 08-CHANGE-LOG 條目：2026-08-05 — Ollama cue 文字長度異常調查（BUG-019）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-05 12:39 +08:00；獨立讀取最新來源、BUG-019 工作紀錄、基準 job checkpoint、focused／完整測試與兩平台封裝，未沿用主要開發代理的評價性結論。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:16-40` 與 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:176-185` 要求保留 cue ID／數量／順序與 strict 長度上限，對 Ollama 過長文字最多進行一次帶明確限制的 JSON repair，第二次仍過長時拒絕、不截斷、不套用原文、不寫入未完成 checkpoint，並提供 UI telemetry。`lib/ai/subtitle-optimizer.mjs:79-85,113-137` 抽出 per-cue `maxSubtitleTextLength` 並同時放入原始 prompt 與 validator；`lib/ai/subtitle-optimizer.mjs:210-249,319-337` 限定 Ollama length repair、附 `maxTextLength` 與一次性流程；`public/review.js:538-552` 顯示「回應文字過長，正在要求 Ollama 重新輸出」。`scripts/test-ai-optimizer.mjs:174-220` 覆蓋 cue 344、repair 成功、二次失敗與非 Ollama strict rejection。

## 2. 邏輯正確性

- 判定：通過
- 證據：`maxSubtitleTextLength(cue)` 對 cue text 使用 `Math.max(500, length * 6)`；同一 helper 用於 system prompt 的 `id=limit`、validator 的 `text.length` 檢查與 repair body 的 `maxTextLength`，避免 prompt／實際上限漂移（`lib/ai/subtitle-optimizer.mjs:79-85,126`）。cue 344 原文「如果老師選擇Excel的話」的上限為 500，過長結果先拋出 `cue 344 的 AI 文字長度異常`。`canRepairOllamaLength` 僅接受 provider `ollama` 且該長度錯誤（`210-213`）；validation catch 送出 `validationRepairReason='length'`，最多建立一次 `buildLengthRepairBody` 並重新 strict validate（`319-337`）。repair 二次仍超長時錯誤直接外拋，不截斷、不 fallback；`onCheckpoint` 只在整批 validation 成功後更新（`server.mjs:659-675`），因此已完成 checkpoint 不會被失敗批次覆寫。非 Ollama 仍走原本 strict length rejection，translation 專用 repair 分支仍先行。

## 3. 邊界情況

- 判定：部分通過
- 證據：`node scripts/test-ai-optimizer.mjs` 實測 cue 344 首答為 600 字以上過長內容、第二次 repair 回傳「如果老師選擇 Excel 的話」而成功，確認兩次呼叫、prompt 含 `344=500`／`maxTextLength:500`、`validationRepairReason='length'`；同測試實測第二次仍超長時只允許兩次呼叫並拒絕 `cue 344 的 AI 文字長度異常`，且 OpenAI-compatible 過長輸出仍拒絕。既有測試仍覆蓋 cue 數量／順序、translation／terms strict validation、checkpoint resume。尚未取得真實 Ollama raw response，無法確認 cue 344 實際過長內容是解說、重複或其他形式；未實測多 cue 不同上限、Unicode／emoji 字元計數、repair 回傳 cue contract 錯誤、超長原始字幕的 `length*6` 上限、Windows 實機與不同 Ollama 版本，因此這些邊界仍待外部驗收。

## 4. 程式碼品質

- 判定：通過
- 證據：長度 helper、prompt instruction、strict validator、Ollama repair、checkpoint 與 UI progress 分層；repair prompt 明確禁止解說／重複／Markdown，要求保留 ID、數量與順序（`lib/ai/subtitle-optimizer.mjs:234-249`）。2026-08-05 12:40 執行 `node --check server.mjs`、`node --check lib/ai/subtitle-optimizer.mjs`、`node --check public/review.js` 與 `git diff --check` 均通過。兩平台 unpacked app 與工作樹的 source SHA 一致：`lib/ai/subtitle-optimizer.mjs` 為 `9ab0789840f6932a51cb8395174fed2ca59ba7190a2137ed85b90bb7b2273372`，`public/review.js` 為 `da3f11fc208657f02dfdb24917079a17c309888d8b33aeff6dbd49faf398e655`；兩平台 markers 均含 helper、length repair 與 UI 文案。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-08-05 12:40:22 執行 `node scripts/test-ai-optimizer.mjs`（`AI 字幕優化測試通過：固定 cue ID、時間碼、差異建議、進度與回應驗證`）與 `node scripts/test-ai-providers.mjs`（`AI provider contract 與術語／Prompt 測試通過`）。同日 12:40:28 首次 `npm run check` 在核心 HTTP 測試監聽 `0.0.0.0` 時因 sandbox `listen EPERM` 中止；12:40:41 以受控權限重跑，文件檢查、語法檢查、全部 npm test（含 optimizer、provider、UI 與核心回歸）均通過。基準 job `/Users/nycu/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json` 實測為 `status=failed`、`provider=ollama`、`model=llama3.2:3b`、`error=cue 344 的 AI 文字長度異常`、`progress.completedBatches=4/55`、`checkpoint.nextBatchIndex=4`、`checkpoint.suggestions=3`、`request.mode=proofread`、`request.language=ja`、`retryable=true`，與 BUG-019 現象一致。最新兩 ZIP SHA-256 為 macOS `3862ded7ed2140987f3440e818718ed018b3056b69e17b2068cd50ae90f0eba9`、Windows `3b6a8d54ecc98ece708029b00bde285935fc82d35dbfc914cd9e5ae6e96edab1`；兩者 `unzip -t` 均回報 `No errors detected in compressed data`。兩平台 manifest 的 Small 均為 487,601,967 bytes、SHA-256 `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b`，Base 為 missing。完整回歸沒有真模型回應證據。

## 6. 實際運行結果

- 判定：部分通過
- 證據：deterministic optimizer 實際完成 cue 344 length repair、二次過長拒絕、非 Ollama strict rejection 與 length telemetry；完整受控 `npm run check` 實際通過核心 HTTP server 回歸。兩個最新 ZIP 解壓後的 optimizer／UI source SHA 與工作樹一致，Small manifest／檔案大小／SHA 一致。基準 job 保留 4/55 批次、`nextBatchIndex=4` 與 3 個 suggestions；`curl -sS --max-time 2 http://127.0.0.1:11434/api/tags` 實測回報 connection refused，沒有 raw model response 或同一 job 的修正後 55 批重跑，也沒有 Windows 實機操作證據。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無 deterministic per-cue limit／length repair／strict validation、完整回歸或 ZIP／source SHA 完整性阻擋；條件是尚未取得真實 Ollama raw response、同一 job 修正後多批次重跑與 Windows 實機／不同版本驗證，因此不得宣稱 BUG-019 已完成跨平台實機或正式 Release 驗收。
- 剩餘風險：`maxSubtitleTextLength` 目前採原文字元數乘 6、最低 500，極長原始字幕可能得到很大的上限；JavaScript `String.length` 以 UTF-16 code units 計數，emoji／組合字元與模型實際輸出 token 不完全等價。模型若持續輸出過長文字，length repair 仍會安全失敗並保留 checkpoint，但不保證成功；真實 Ollama、Windows renderer 與不同版本行為仍待外部驗收。
- 給主要開發代理的具體修正要求：在 `08-CHANGE-LOG.md` 連結本報告並逐字引用本節完整結論句，記錄 focused／完整測試時間、基準 job、Ollama connection refused、兩 ZIP SHA／unzip／source SHA markers；取得 raw response 或完成同一 job／Windows 驗收後若結論改變，另建 round2，不覆寫本報告；完成工作條目後執行 `npm run docs:check:final`。
- 可逐字引用完整結論句：**本輪 BUG-019 已由 per-cue `maxSubtitleTextLength`、原始 prompt 長度上限、Ollama 一次性 length repair、二次過長安全拒絕、strict cue validation／checkpoint 與 UI length telemetry 的 deterministic 測試，以及兩平台最新 ZIP／Small manifest／SHA／source SHA 核對證明修正契約；但本機 Ollama 連線拒絕、沒有 raw response 或同一 job 的修正後多批次重跑，Windows 實機與不同版本亦未驗證，因此結論為有條件通過，不得宣稱跨平台正式 Release 完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
