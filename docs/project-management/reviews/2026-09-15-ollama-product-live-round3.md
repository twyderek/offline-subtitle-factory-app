# 獨立複審報告：Ollama 本機產品級人工流程驗收（FR-021-032）

- 審查對象：目前工作樹中的 `scripts/probe-ollama-product-live.mjs`、`scripts/test-ai-providers.mjs`、`package.json`、FR-021-032 需求／設計／稽核文件，以及 `docs/project-management/evidence/2026-09-15-ollama-product-live-recheck-5.json`。
- 對應 08-CHANGE-LOG 條目：2026-09-15 — Ollama 本機產品級人工流程驗收（FR-021-032）。
- 審查輪次：round3。
- 審查方式：獨立唯讀檢查；除本報告外未修改任何檔案。
- 追蹤範圍：round1 的遠端 URL、保存前 SRT hash、早期 output guard，以及 round2 的 exists-then-write 競態與 child env 過寬問題均逐項核對；未覆寫前兩輪報告。

## 1. 需求完整性

- 判定：通過
- 證據：`08-CHANGE-LOG.md`、`02-REQUIREMENTS-ANALYSIS.md`、`03-FUNCTIONAL-DESIGN.md` 與 `06-TEST-AND-PROCESS-AUDIT.md` 均將本輪範圍限定為暫存資料、Ollama loopback API product path、AI session 接受／undo／redo／雙語保存與原始 SRT 保護；同時保留 FR-021 的真正斷網條件，並依需求方已刪除 LM Studio 的決策記錄驗收例外，沒有宣稱 FR-021 整體完成。
- 證據：`package.json` 提供 `acceptance:ollama:product` 可重放入口；文件明確揭露本輪不是 Electron／瀏覽器 UI 操作，也沒有關閉系統網路。

## 2. 邏輯正確性

- 判定：通過
- 證據：`probe-ollama-product-live.mjs` 在 `mkdtempSync()`、設定檔寫入與 child server `spawn()` 前以 `isLoopbackAiUrl()` 拒絕非 loopback URL；`OLLAMA_BASE_URL=https://example.invalid/v1` 實際以 exit 1 拒絕，未建立負例輸出檔。artifact 的 `endpointPrivacy` 與 `loopbackOnlyConfiguration` 由同一 URL 判定，未硬標遠端為 local。
- 證據：輸入 SRT 建立後、AI／save-review 前即讀取 `originalSrt` 並計算 `sourceSrtBeforeSha256`；保存後再次讀取並計算 `sourceSrtAfterSha256`，同時查詢 review data 的 cue 時碼。`recheck-5.json` 顯示兩個 SHA-256 相同、`sourceSrtPreserved=true`、`timecodesUnchanged=true`。
- 證據：evidence 寫入使用 `fs.writeFileSync(..., { flag: 'wx' })`；即使前置 `existsSync(outputPath)` 與實際寫入之間有競態，exclusive create 也會拒絕已被建立的目標，不會以一般寫入截斷既有 evidence。

## 3. 邊界情況

- 判定：通過
- 證據：既有 `recheck-5.json` 的輸出路徑實際重跑以 exit 1 早期拒絕；遠端 URL 負例也在暫存目錄建立前拒絕，指定負例輸出路徑保持不存在。這與程式中 output guard／loopback guard 均位於 `mkdtempSync()` 前一致，未啟動測試 server 或 Ollama。
- 證據：round2 的競態問題已由 `flag: 'wx'` 原子建立解除；round2 指出的 child env 過寬也已解除，child server 使用明確 `serverEnv`，沒有 `...process.env`。
- 證據：child server 的 tools、Whisper／Breeze cache、`TEMP`／`TMP`／`TMPDIR` 均指向本次 `mkdtempSync()` 建立的暫存路徑；AI key 欄位明確為空字串／空 JSON。未把 SIGKILL、主機崩潰後清理或 UI 邊界冒充已驗收。

## 4. 程式碼品質

- 判定：通過
- 證據：探針責任集中且 cleanup 使用 nested `finally`；測試 server、settings、data、tools、cache 與 temporary files 均隔離，evidence 僅保存狀態、數量、時間碼旗標與 hash，不保存完整字幕或 API key。
- 證據：child process 的環境為最小明確 allowlist，保留執行所需的 `PATH`／locale／timezone、暫存資料路徑與測試 token，未繼承父程序 AI secrets；實際設定仍由 API 送入 loopback Ollama。
- 證據：程式未修改產品 runtime，只新增可重放驗收探針與 provider source contract；文件將其準確描述為 API product path，未將它誇大為完整 UI 人工驗收。

## 5. 測試覆蓋

- 判定：有條件通過
- 證據：`node --check scripts/probe-ollama-product-live.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs` 與完整 `npm run check` 均通過；完整回歸包含治理文件、AI optimizer／provider、Ollama streaming、review UI 與核心 API。
- 證據：`scripts/test-ai-providers.mjs` 已斷言暫存 data／tools、空 AI secrets、啟動前 loopback／既有 evidence guard、未宣稱系統斷網、保存前／後 SRT hash、時間碼保護與 `flag: 'wx'`；本輪另實際執行遠端與既有 output 負例。
- 證據：`npm run docs:check:final` 在本報告建立前因最新 08-CHANGE-LOG 條目仍是「進行中」、尚未引用本報告而按治理規則拒絕；這是待主要代理完成結案欄位的程序狀態，不是本輪新增的產品阻擋。未執行 Electron／瀏覽器 UI 驅動測試或真正斷網測試，並已在需求／稽核文件揭露。

## 6. 實際運行結果

- 判定：通過
- 證據：`docs/project-management/evidence/2026-09-15-ollama-product-live-recheck-5.json` 記錄 macOS arm64／Node v22.22.3、Ollama `llama3.2:1b`、`http://127.0.0.1:11434/v1`、`endpointPrivacy=local`、`systemNetworkDisabled=false`、AI `completed`、2 suggestions、0 retries、AI session accepted 2、undo／redo 各 2、review cue 2。
- 證據：同一 artifact 記錄雙語校閱保存成功、`timecodesUnchanged=true`、`sourceSrtPreserved=true`，且 `sourceSrtBeforeSha256` 與 `sourceSrtAfterSha256` 相同；artifact 未含完整字幕、API Key、Authorization、Bearer、token 或 secret 欄位。這證明實際 loopback Ollama API product path 通過，不代表任意小模型品質或所有 UI 流程通過。

## 阻擋問題

無。round1 的遠端外送、保存前 hash、早期 output guard，以及 round2 的 evidence 競態覆寫與 child env 過寬均已核對解除。

## 綜合判定

- 結論：通過
- 證據：FR-021-032 Ollama loopback API product path 已以 `llama3.2:1b` 的實際 `recheck-5` artifact 證明任務建立、翻譯完成、AI session、2 筆接受、undo／redo 各 2 筆、雙語保存、時間碼未變與原始 SRT 保存前後 hash 相同；遠端 URL 與既有 evidence 負例均在啟動前拒絕，evidence 使用 `flag: 'wx'` 防競態覆寫，child server 不繼承 AI secrets 且 tools／cache／tmp 均隔離於暫存目錄，無本輪新增阻擋。剩餘限制為本輪不是 Electron／瀏覽器 UI 驗收，且 `systemNetworkDisabled=false`、未完成真正斷網驗收；LM Studio 依需求方已刪除的明確範圍例外未執行，因此不得據此宣稱 FR-021 整體完成。

## 審查代理聲明

本報告由獨立審查代理產出，主要代理不得修改本報告內容。
除本報告外，本代理未修改任何檔案。
