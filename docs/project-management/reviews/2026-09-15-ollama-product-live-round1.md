# 獨立審查報告：Ollama 本機產品級人工流程驗收（FR-021-032）

- 審查對象：2026-09-15 未提交工作樹中的 `scripts/probe-ollama-product-live.mjs`、`package.json` 與本輪需求／稽核文件。
- 對應 08-CHANGE-LOG 條目：2026-09-15 — Ollama 本機產品級人工流程驗收（FR-021-032）。
- 審查輪次：round1。
- 審查方式：獨立唯讀檢查；未修改產品程式、需求／稽核文件、證據或其他檔案。

## 1. 需求完整性

- 判定：有條件通過
- 證據：`08-CHANGE-LOG.md` 最新條目明確限定 FR-021、FR-010、NFR-001／005／006，並列出暫存資料、loopback、不呼叫雲端、不覆蓋使用者資料、不宣稱真正斷網與不執行 LM Studio；`02-REQUIREMENTS-ANALYSIS.md:37,44-50`、`03-FUNCTIONAL-DESIGN.md` 與 `06-TEST-AND-PROCESS-AUDIT.md:25-33` 也保留原始 FR-021 的真正斷網與 LM Studio條件，沒有把本輪結果宣稱為 FR-021 整體完成。主要缺口是文件聲稱探針「僅允許 loopback」，但實作沒有把這項範圍限制做成執行時前置條件。

## 2. 邏輯正確性

- 判定：不通過
- 證據：`scripts/probe-ollama-product-live.mjs:10` 直接接受 `OLLAMA_BASE_URL` 環境變數，`:94-97` 卻無條件寫入 `endpointPrivacy: 'local'`、`systemNetworkDisabled: false` 與 `loopbackOnlyConfiguration: true`；沒有呼叫 `isLoopbackAiUrl()`，也沒有拒絕 `https://example.invalid/v1` 或其他遠端 URL。唯讀重現確認任意 HTTP(S) URL 可被解析並進入 probe 設定。若執行者誤設環境變數，字幕會送往遠端，而 evidence 仍會誤標 local，這是本輪隱私／範圍的阻擋問題。
- 證據：`scripts/probe-ollama-product-live.mjs:204-213` 在 `save-review` 完成後才第一次讀取 `inputSrtPath` 成為 `originalSrt`，再以第二次讀取與它比較；因此沒有保存前基準，`sourceSrtPreserved: true` 並非由真正的 before／after 比對證明。雖然 `server.mjs:4520-4536` 的保存路徑寫入 `review-output/reviewed.srt` 而非 input SRT，但探針本身的保護斷言仍不足以獨立證明驗收條件。

## 3. 邊界情況

- 判定：不通過
- 證據：`scripts/probe-ollama-product-live.mjs:225-228` 將既有 evidence 不可覆寫檢查放在整個實機流程、server 關閉之後；若 output path 已存在，`:226` 直接 throw，`:228` 的暫存資料清理不會執行，且 probe 先前可能已建立任務、保存字幕並呼叫 Ollama。這雖不會覆寫既有 evidence，但會留下含字幕的暫存資料，也沒有在啟動外部流程前拒絕。這是「不可覆寫」邊界的阻擋問題，且目前只有 source regex，沒有實際既有檔案重跑測試。
- 證據：`waitForAi()`（`:58-67`）可辨識 completed／failed／cancelled／interrupted 並以 240 秒上限結束；失敗會寫入新的 fail artifact。`recheck.json` 保留語系拒絕，`recheck-2.json` 保留 HTTP 400，顯示失敗不被偽造為成功；但 probe 未涵蓋遠端 URL、既有 output path、程序中止後清理、AI session 決策未知 ID／部分接受，以及 undo／redo 後人工修改衝突等邊界。

## 4. 程式碼品質

- 判定：有條件通過
- 證據：探針責任集中且可讀，使用 `mkdtempSync`、獨立 settings／data 目錄、隨機本機 server port、隨機 API token 與 `stopProcess()`；`:127-145` 建立手動任務並確認實際 AI 建議，`:147-185` 驗證 session、接受、undo／redo，`:187-218` 保存雙語結果並記錄摘要 hash。artifact 沒有完整字幕或 API key，`recheck-3.json` 的唯讀 JSON 檢查亦未發現秘密欄位。
- 證據：品質問題集中在 hard-coded evidence metadata 與清理／拒絕順序：`:95-97` 把 local／loopback-only 當成常數，而不是由實際 URL 推導；`:226` 的拒絕例外會跳過 `rmSync`。此外，probe 以 API 直接驅動 server route，沒有實際 Electron／瀏覽器 UI 操作，因此「產品級人工流程」較準確的描述是 API product-path acceptance，不是完整 UI 人工驗收。

## 5. 測試覆蓋

- 判定：有條件通過
- 證據：獨立執行 `node --check scripts/probe-ollama-product-live.mjs`、`node --check scripts/test-ai-providers.mjs`、`git diff --check`、`node scripts/test-ai-providers.mjs` 與 `npm run check` 均通過；完整 check 包含治理文件、AI optimizer／provider、Ollama streaming、review UI 與核心 API 回歸。指定 artifact 的欄位也符合 `status=pass`、2 suggestions、accepted／undo／redo 各 2、`timecodesUnchanged=true`、`sourceSrtPreserved=true`。
- 證據：`scripts/test-ai-providers.mjs:330-338` 對本探針只做 source regex（暫存目錄、兩個宣告、不可覆寫字串、npm script），沒有執行時驗證 URL 必須 loopback、沒有重跑既有 output path、沒有驗證保存前後 SRT hash，也沒有 UI 驅動測試。故自動回歸足以支持預設成功 fixture，但不足以支持上述安全邊界與完整人工流程宣稱。

## 6. 實際運行結果

- 判定：有條件通過
- 證據：`docs/project-management/evidence/2026-09-15-ollama-product-live-recheck-3.json:11-39` 記錄預設 `http://127.0.0.1:11434/v1`、Ollama `llama3.2:1b`、AI `completed`、2 suggestions、session accepted 2、undo 2、redo 2、review cue 2、時間碼未變與原始 SRT 保留；artifact JSON 不含 API key、完整字幕或遠端 endpoint。這支持「預設 loopback 配置下的 API product path」確實跑通。
- 證據：同一 artifact 明確記錄 `scope.systemNetworkDisabled=false`，因此沒有誤宣稱真正斷網，這點通過；初次與第二次失敗 artifact 也被保留。惟實際成功執行只證明預設環境，無法抵銷探針允許遠端 `OLLAMA_BASE_URL` 的邏輯缺口，也沒有以保存前 hash 或 UI 操作直接證明原始 SRT／人工流程的完整條件。

## 阻擋問題

1. `OLLAMA_BASE_URL` 未被 runtime 強制限制為 loopback，但 evidence 永遠寫入 local／loopback-only；此可造成字幕意外送往遠端，並使驗收證據產生錯誤隱私結論。
2. `sourceSrtPreserved` 的基準在 `save-review` 之後才讀取，沒有 before／after 證據；目前 artifact 欄位不足以獨立證明原始 SRT 在保存流程中未被覆蓋。
3. evidence 已存在時的拒絕發生在整個流程之後，且 throw 會跳過暫存資料清理；沒有實際測試證明「不可覆寫」同時滿足不啟動外部流程與不留下字幕暫存資料。

## 綜合判定

- 結論：不通過
- 證據：FR-021-032 預設 `127.0.0.1` Ollama API product path 的實際 artifact 與完整回歸測試通過，且明確未宣稱真正斷網、未執行 LM Studio；但 loopback 強制限制、原始 SRT before／after 保護證據與既有 evidence 的早期不可覆寫／清理邊界仍有阻擋缺口，因此本輪不能以目前 probe 與 `recheck-3` 結果結案或宣稱 FR-021-032 驗收完整通過。

## 審查代理聲明

本報告由獨立審查代理產出，主要代理不得修改本報告內容。
除本報告外，本代理未修改任何檔案。
