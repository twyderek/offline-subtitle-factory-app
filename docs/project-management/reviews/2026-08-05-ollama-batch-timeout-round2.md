# 獨立審查報告：Ollama 多批次 AI 優化逾時修正（BUG-016）

- 審查對象 commit／版本：0.48.0 工作樹與 2026-08-05 最新本機測試封裝
- 對應 08-CHANGE-LOG 條目：2026-08-05 — 修正 Ollama 多批次 AI 優化逾時（BUG-016）
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-08-05 11:17 +08:00；獨立重新讀取最新 source、round1 後測試、實際 checkpoint 與兩平台 ZIP／manifest，未修改 round1 報告或其他專案檔案。

## 1. 需求完整性

- 判定：通過
- 證據：`lib/ai/openai-compatible.mjs:33-127` 提供 NDJSON streaming 組裝與每個 reader chunk 重設 idle timeout；`lib/ai/providers.mjs:48-93` 的預設 Ollama native `/api/chat` 使用 `stream:true`／`streamResponse:true`；`server.mjs:684-693` 在已完成批次後的 timeout 寫入可識別的續跑提示。新增 `scripts/test-ollama-batch-stream.mjs` 並納入 `package.json` 的 `npm test`，補足 round1 對三批次 streaming 的覆蓋。

## 2. 邏輯正確性

- 判定：通過
- 證據：`readStreamingJson` 以 `TextDecoder` 保留跨 chunk buffer，逐行 JSON 解析並串接 `message.content`／`response`；`requestAiJson` 在 response 取得前啟動 timer、每個 chunk 到達即重設，finally 清除 timer。`test-ollama-batch-stream.mjs:10-38` 實際以三個 20／80／140ms NDJSON chunk 完成三個 batch；`test-ai-providers.mjs:74-94` 驗證 fragment 合併與 100ms idle timeout；`test-ai-optimizer.mjs:231-262` 驗證第三批 timeout 後 `nextBatchIndex=2` 且 resume 不重送前兩批。`resume-ai-optimize` 仍以保存的 checkpoint 呼叫 `startAiOptimizationJob`（`server.mjs:3807-3815`）。

## 3. 邊界情況

- 判定：部分通過
- 證據：deterministic 測試已涵蓋連續 NDJSON、fragment、最後 done chunk、idle timer 與 timeout checkpoint／續跑；provider 測試也保留 redirect、API key、Ollama translation `format:"json"`／`think:false` 與 repair failure 邊界。實測 `curl http://127.0.0.1:11434/api/tags` 仍連線拒絕，未涵蓋真實 Ollama 空訊息、半串流斷線、長時間無新 chunk、模型卡住或 Windows 實機。

## 4. 程式碼品質

- 判定：通過
- 證據：stream transport、Ollama native provider、batch optimizer checkpoint 與 server 狀態提示各自分層；非 Ollama／非 streaming provider 仍使用原有完整 JSON response。`node --check lib/ai/openai-compatible.mjs`, `node --check lib/ai/providers.mjs`, `node scripts/test-ollama-batch-stream.mjs` 與 `git diff --check` 均通過。最終 macOS／Windows unpacked app 均含相同 `readStreamingJson`、`stream:true`、`streamResponse:true` 與「已保留批次」marker。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-08-05 11:17 +08:00 重新執行 `node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ai-optimizer.mjs` 與受控權限 `npm run check`，全部通過；完整 check 包含核心 HTTP 回歸、所有既有測試、文件與語法檢查。實際 baseline `/Users/nycu/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json` 仍為 `provider=ollama`、`model=llama3.2:3b`、`status=failed`、`error=AI 請求逾時`、`completedBatches=2/55`、`activeBatch=3`、`retryable=true`、`nextBatchIndex=2`、2 suggestions，吻合原始缺陷並證明 checkpoint 可用。兩 ZIP `unzip -t` 均無壓縮錯誤；Small 487,601,967 bytes、SHA-256 `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b`，兩平台 manifest／`inspectWhisperModels` 均 `installed:true, valid:true, reason:"ok"`，Base 均 `reason:"missing"`。本機 Ollama 未啟動，無真模型 response／續跑紀錄。

## 6. 實際運行結果

- 判定：部分通過
- 證據：三批次 streaming fixture 實際送出 3 次 request 並產生 3 suggestions；timeout fixture 實際保存前兩批 suggestions、從 batch 2 resume 且不重送已完成批次。兩平台最新 ZIP SHA-256 重新計算一致：macOS `ebfc10ab6b7fe6efae6c7d343a6e804c687da6cbe81146318aa16b516c934049`、Windows `ea46b54991d8f80b404c51809ea16170deae2cd0c7ad76dfd3a8b5fb462bf0b8`；`unzip -t` 通過，unpacked manifest 的 Small valid 與 app source markers 一致。baseline job checkpoint 是修正前保存的 timeout（error 尚為單純「AI 請求逾時」），所以能證明原始失敗／續跑資料，但不能替代新版真 Ollama 多批次 smoke；Windows 實機也未運行。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無已發現的 deterministic 程式、測試或封裝完整性阻擋；必要條件是取得本機 Ollama 真模型多批次 streaming／timeout／resume 證據，以及 Windows 實機驗收前不得宣稱正式 Release 或跨平台完成。
- 剩餘風險：真實 Ollama 的 chunk 頻率、空白／done 訊息、模型長停頓與斷線模式仍未驗證；目前 baseline 沒有新版 timeout 續跑提示，`/resume-ai-optimize` 的實模型 HTTP round-trip 尚未取得。Small／ZIP 證據只代表封裝與模型完整性，不代表 Ollama 品質或速度。
- 給主要開發代理的具體修正要求：在 `08-CHANGE-LOG.md` 逐字引用本報告結論並記錄 round2 測試、baseline checkpoint、本機 Ollama 未啟動、Windows 實機缺口與最新兩 ZIP SHA；若後續完成真模型 smoke，補記 timeout 提示與 resume API response，必要時另建 round3，不覆寫本報告；完成後執行 `npm run docs:check:final`。
- 可逐字引用完整結論句：**本輪 BUG-016 round2 已由三批次 NDJSON streaming／idle timeout、Ollama `stream:true`、timeout checkpoint 與續跑 deterministic 測試，以及兩平台最新 ZIP／Small manifest／SHA 核對證明已完成批次不會遺失；但本機 Ollama 未啟動、實際 job 仍是修正前 timeout 基準且尚無真模型多批次 smoke，Windows 實機亦未驗證，因此結論為有條件通過，不得宣稱跨平台正式 Release 完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
