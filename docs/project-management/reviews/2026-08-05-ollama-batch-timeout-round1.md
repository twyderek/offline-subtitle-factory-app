# 獨立審查報告：Ollama 多批次 AI 優化逾時修正（BUG-016）

- 審查對象 commit／版本：0.48.0 工作樹與 2026-08-05 最終本機測試封裝
- 對應 08-CHANGE-LOG 條目：2026-08-05 — 修正 Ollama 多批次 AI 優化逾時（BUG-016）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-05 11:13 +08:00；獨立讀取最新來源、deterministic 測試、實際 job checkpoint 與兩平台封裝，未沿用主要代理的評價性結論。

## 1. 需求完整性

- 判定：通過
- 證據：`lib/ai/openai-compatible.mjs:32-123` 新增 NDJSON streaming 合併與以每個 response chunk 重設 idle timeout；`lib/ai/providers.mjs:57-92` 讓預設 Ollama native `/api/chat` 使用 `stream:true` 並傳入 `streamResponse:true`；`server.mjs:684-693` 在已完成批次後 timeout 將 checkpoint／續跑批次數寫入錯誤提示。`scripts/test-ai-providers.mjs` 覆蓋 Ollama stream body、NDJSON fragment、延遲 chunk 與 idle timeout，`scripts/test-ai-optimizer.mjs` 覆蓋第三批 timeout 後 checkpoint 與續跑。

## 2. 邏輯正確性

- 判定：通過
- 證據：`readStreamingJson` 使用 `TextDecoder({ stream: true })`、保留跨 chunk buffer，逐行解析 NDJSON 並串接 `message.content`／`response` fragment；`requestAiJson` 的 timeout 在 fetch 前啟動、每次 reader chunk 到達即重新 arm，finally 清除 timer。非 Ollama provider 仍走既有完整 JSON path。`startAiOptimizationJob` 只有在 `error.code === 'timeout'` 且 `checkpoint.nextBatchIndex > 0` 時加入「已保留 x/y 批，可按恢復 AI 優化繼續」，並維持 `retryable`，與 `resume-ai-optimize` 讀取 checkpoint 的路徑一致（`server.mjs:3807-3815`）。

## 3. 邊界情況

- 判定：部分通過
- 證據：`node scripts/test-ai-providers.mjs` 實測連續 NDJSON、fragment 重組與 20／80／140ms 延遲 chunk（timeout 100ms）均成功，證明每個 chunk 會重設 idle timer；`node scripts/test-ai-optimizer.mjs` 實測前兩批完成、第三批 timeout，checkpoint `nextBatchIndex=2`，續跑僅處理未完成批次。測試另覆蓋 Ollama 翻譯 JSON／think:false、repair 第二次失敗與 malformed JSON。尚未對真正 Ollama server、斷線半串流、長時間無 chunk、Windows 實機做端到端測試。

## 4. 程式碼品質

- 判定：通過
- 證據：stream parser、timeout transport 與 provider contract 分層，Ollama native 才啟用 NDJSON，其他 OpenAI-compatible JSON 回應不受影響；原有 redirect／retry／API key 安全政策仍保留。`node --check server.mjs`, `node --check lib/ai/openai-compatible.mjs`, `node --check lib/ai/providers.mjs` 與 `git diff --check` 均通過。最終兩平台封裝內可搜尋到相同 `stream:true`、`streamResponse:true`、timeout 與續跑提示標記。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-08-05 11:13 +08:00 執行 `node scripts/test-ai-providers.mjs`、`node scripts/test-ai-optimizer.mjs` 與 `npm run check`，均通過；完整回歸包含核心 HTTP、AI provider、optimizer、文件與語法檢查。實際 baseline job `/Users/nycu/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json` 顯示 `provider=ollama`、`model=llama3.2:3b`、`status=failed`、`error=AI 請求逾時`、`completedBatches=2/55`、`processedCues=2/55`、`activeBatch=3`、`retryable=true`、`checkpoint.nextBatchIndex=2`，與缺陷描述一致。兩 ZIP `unzip -t` 均回報 `No errors detected in compressed data`；兩平台 Small manifest／檔案均為 487,601,967 bytes、SHA-256 `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b`、`installed:true, valid:true, reason:"ok"`，Base `reason:"missing"`。本機 Ollama `curl http://127.0.0.1:11434/api/tags` 實測連線拒絕，故沒有真模型 response evidence。

## 6. 實際運行結果

- 判定：部分通過
- 證據：deterministic delayed-stream 測試實際完成 NDJSON 合併，optimizer timeout fixture 實際保留兩批 suggestions 並從 batch 2 resume，不重送已完成批次。兩平台最終測試 ZIP SHA-256 重新計算一致：macOS `7160a31d3ff55c2fbd5b99f7753c1ea2693b96f45884008c806dfbebdea3d8cc`、Windows `e4354e5e36519ab185dc33682f0e894ca3d8086a671eff2686f5abe1be4d673c`；unpacked manifest 的 Small valid 與封裝內 provider／transport source marker 一致。實際 job 是修正前保存的 timeout 基準（checkpoint error 尚為單純「AI 請求逾時」），可證明原始失敗與已保留 checkpoint，但未能在本機 Ollama 啟動後取得修正後實模型多批次 smoke；Windows 實機亦未驗證。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無 deterministic code／test 或封裝完整性阻擋；條件是尚未取得本機 Ollama 真模型的多批次 streaming／timeout／resume smoke，也沒有 Windows 實機證據，因此不得宣稱 BUG-016 已跨平台實機或正式 Release 完成。
- 剩餘風險：NDJSON／chunk 行為已由 mock 覆蓋，但真正 Ollama 可能有不同 chunk 頻率、空白訊息、模型生成長停頓或斷線模式；本機模型仍可能單 cue 超時。現有 baseline job 的 error 尚未由新版 server 實際重寫為帶續跑提示，需在真模型或等價 server fixture 中核對 UI 顯示與 resume endpoint。
- 給主要開發代理的具體修正要求：在 `08-CHANGE-LOG.md` 逐字引用本報告結論並記錄兩 ZIP SHA、Small manifest、baseline checkpoint 與本機 Ollama 未啟動／Windows 實機缺口；若取得真模型 smoke，另補記 timeout 後錯誤提示與 `/resume-ai-optimize` HTTP 續跑結果；完成後執行 `npm run docs:check:final`。若新 evidence 改變判定，另建 round2，不覆寫本報告。
- 可逐字引用完整結論句：**本輪 BUG-016 已以 deterministic NDJSON streaming／idle timeout、Ollama `stream:true`、多批次 timeout checkpoint 與續跑測試證明已完成批次不會遺失，兩平台最終 ZIP／Small manifest／SHA 亦核對一致；但本機 Ollama 未啟動、實際 job 仍是修正前的 timeout 基準且尚無新版真模型多批次 smoke，Windows 實機亦未驗證，因此結論為有條件通過，不得宣稱跨平台正式 Release 完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
