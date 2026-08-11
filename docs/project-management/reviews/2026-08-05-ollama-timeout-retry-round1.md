# 獨立審查報告：Ollama 第 3 批重試後仍逾時調查（BUG-017）

- 審查對象 commit／版本：0.48.0 工作樹與 2026-08-05 11:36 建立的 macOS arm64／Windows x64 本機測試 ZIP
- 對應 08-CHANGE-LOG 條目：2026-08-05 — Ollama 第 3 批重試後仍逾時調查（BUG-017）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-05 11:37 +08:00；獨立讀取最新來源、BUG-017 工作紀錄、基準 job checkpoint、focused／完整測試與兩平台封裝，未沿用主要開發代理的評價性結論。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:154-163` 將需求具體化為 fetch 收到 headers 後重新開始 body idle timeout、Ollama `num_predict=512`／`keep_alive=10m`、Ollama timeout retry 的可控延長、UI telemetry、checkpoint／strict cue validation 不變且不得偽造建議。`lib/ai/openai-compatible.mjs:50-99` 實作 NDJSON streaming 與 headers／chunk 後重設 timeout；`lib/ai/providers.mjs:58-90` 實作原生 `/api/chat` 的 `stream:true`、`num_predict`、`keep_alive` 與 `streamResponse:true`；`lib/ai/subtitle-optimizer.mjs:150-172` 對 Ollama timeout 將下一次 timeout 加倍並寫入 retry progress；`server.mjs:684-693` 在已有完成批次時保留可恢復提示；`public/review.js:544-547` 顯示延長後的 timeout 上限。新增的 provider／optimizer／三批次 streaming 測試均已接入 `npm test`。

## 2. 邏輯正確性

- 判定：通過
- 證據：`readStreamingJson` 以 `TextDecoder({ stream: true })`、跨 reader chunk buffer 與逐行 NDJSON 解析串接 `message.content`／`response` fragment（`lib/ai/openai-compatible.mjs:33-67`）；`requestAiJson` 在 fetch 前、收到 headers 後及每個 body chunk 到達時 arm timeout，finally 清除 timer（`lib/ai/openai-compatible.mjs:69-129`）。timeout 會轉為 `AiProviderError` 的 `code=timeout`、`retryable=true`（同檔 `120-126`）。`retryTimeoutSeconds` 僅在 provider 是 Ollama 且 error code 為 timeout 時作用，基準 120 秒重試值為 240 秒，安全上限為 600 秒（`lib/ai/subtitle-optimizer.mjs:150-172`）；provider 將 retry request options 合併到下一次請求（`lib/ai/providers.mjs:166-175`）。現有 checkpoint、批次 strict validation 與 `/resume-ai-optimize` 仍以 `nextBatchIndex` 從未完成批次繼續（`server.mjs:659-675`、`3807-3815`），未把部分結果當成功。

## 3. 邊界情況

- 判定：部分通過
- 證據：`node scripts/test-ai-providers.mjs` 實測 Ollama NDJSON fragment、100ms timeout 下 20／80／140ms chunk、收到 headers 後延遲第一個 chunk，以及 `num_predict=512`／`keep_alive='10m'` contract；`node scripts/test-ai-optimizer.mjs` 實測第三批 timeout 後 `checkpoint.nextBatchIndex=2`、續跑不重送前兩批、Ollama timeout 120→240 telemetry，並確認非 Ollama 429 不套用延長 timeout；`node scripts/test-ollama-batch-stream.mjs` 實測三批次逐批送出，另以首個串流 10ms 內無 chunk 觸發 timeout、第二次延遲 30ms 且只有延長 timeout 才成功的 provider retry fixture。尚未在真實 Ollama server 驗證模型生成、串流中途斷線／空白或 malformed NDJSON、超過 600 秒仍無輸出，以及 Windows 實機；因此這些外部與極端 transport 邊界仍待驗收。

## 4. 程式碼品質

- 判定：通過
- 證據：stream parser／transport timeout、Ollama adapter、批次 retry／checkpoint 與 UI telemetry 分層，非 Ollama provider 仍走原有完整 JSON path；原有 redirect 安全政策、API Key 條件與 strict cue validation 未被移除。2026-08-05 11:47 執行 `node --check server.mjs`、`node --check lib/ai/openai-compatible.mjs`、`node --check lib/ai/providers.mjs` 與 `git diff --check` 均通過。兩平台 unpacked app source 均可搜尋到 `readStreamingJson`、`streamResponse: true`、`num_predict: 512`、`keep_alive: '10m'`、`retryTimeoutSeconds` 與「已保留批次／恢復」提示，marker 一致。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-08-05 11:47 執行 `node scripts/test-ai-providers.mjs`（`AI provider contract 與術語／Prompt 測試通過`）、`node scripts/test-ai-optimizer.mjs`（`AI 字幕優化測試通過…`）與 `node scripts/test-ollama-batch-stream.mjs`（`Ollama streaming multi-batch test passed.`）。2026-08-05 11:48 執行完整 `npm run check`；首次 sandbox 執行因核心 HTTP 測試監聽 `0.0.0.0` 被 EPERM 拒絕，隨後在受控權限下重跑，文件檢查、語法檢查、全部 npm test（含核心回歸）均通過。基準 job `/Users/nycu/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json` 實測為 `status=failed`、`provider=ollama`、`model=llama3.2:3b`、`error=AI 請求逾時`、`completedBatches=2/55`、`activeBatch=3`、`retryAttempt=1`、`retryable=true`、`checkpoint.nextBatchIndex=2`，與 BUG-017 現象一致。兩 ZIP 皆以 `unzip -t` 回報 `No errors detected in compressed data`；重新計算 SHA-256 為 macOS `26c95be5e3040694cd788d49960c81b44c67d986857e5581b22a97b49d3a6965`、Windows `08a2a6e514e06da3b93c3d6cec65236f9779c4d6155b92218551a4db3f5456d8`。兩平台 manifest 的 Small 均為 487,601,967 bytes、SHA-256 `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b` 且 valid／installed，Base 為 missing。因本機 Ollama 尚未啟動，未有真模型回應證據。

## 6. 實際運行結果

- 判定：部分通過
- 證據：deterministic provider／optimizer／三批次 fixture 實際完成 NDJSON 合併、chunk idle reset、首次無 chunk timeout 後延長 timeout retry、第三批 checkpoint 保留與僅續跑未完成批次；完整回歸亦實際完成核心 HTTP server 測試。兩個最終 ZIP 解壓後的 production source markers 與工作樹一致，Small manifest／檔案大小／SHA 一致。實際基準 job 仍是修正前保存的 timeout 失敗狀態，`curl -sS --max-time 2 http://127.0.0.1:11434/api/tags` 實測回報連線拒絕；因此尚未取得同一 `llama3.2:3b` 的真實多批次 streaming／timeout／resume smoke，也沒有 Windows 實機操作證據。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無 deterministic code／test 或 ZIP 完整性阻擋；條件是本機 Ollama 真模型尚未啟動、基準 job 尚未由新版 server 實際重跑，且 Windows 實機未驗證，因此不得宣稱 BUG-017 已完成跨平台實機或正式 Release 驗收。
- 剩餘風險：真實 Ollama 版本可能有不同的 headers／chunk 頻率、空白訊息、模型載入時間或 body 斷線行為；即使 240／600 秒延長窗口仍無輸出，任務會安全 failed 並需從 checkpoint 恢復。`num_predict`／`keep_alive` 的實際效應、長字幕生成時間與 Windows runtime 行為仍待外部驗收。
- 給主要開發代理的具體修正要求：在 `08-CHANGE-LOG.md` 連結本報告並逐字引用本節完整結論句，記錄兩 ZIP SHA、Small manifest、基準 checkpoint、focused／完整測試時間及 Ollama connection refused；取得真模型 smoke 後若結果改變判定，另建 round2，不覆寫本報告；完成工作條目後執行 `npm run docs:check:final`。
- 可逐字引用完整結論句：**本輪 BUG-017 已由 fetch headers 後重新 arm timeout、Ollama stream／num_predict／keep_alive、timeout retry telemetry（120→240，最高 600）與 deterministic 三批次／延長 retry fixture 證明重試與 checkpoint 契約；兩平台最終 ZIP／Small manifest／SHA 亦核對一致，但本機 Ollama 未啟動、實際 job 仍是基準 timeout 且尚無真模型多批次 smoke，Windows 實機亦未驗證，因此結論為有條件通過，不得宣稱跨平台正式 Release 完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
