# 獨立複審報告：Ollama 本機產品級人工流程驗收（FR-021-032）

- 審查對象：目前工作樹中的 `scripts/probe-ollama-product-live.mjs`、`package.json`、FR-021-032 需求／設計／稽核文件，以及 `docs/project-management/evidence/2026-09-15-ollama-product-live-recheck-4.json`。
- 對應 08-CHANGE-LOG 條目：2026-09-15 — Ollama 本機產品級人工流程驗收（FR-021-032）。
- 審查輪次：round2。
- 審查方式：獨立唯讀檢查；除本報告外未修改任何檔案。
- round1 追蹤：round1 指出的遠端 URL、保存前 SRT hash、既有 evidence 早期拒絕／清理三項問題均逐項核對；未覆寫 round1 報告。

## 1. 需求完整性

- 判定：有條件通過
- 證據：`08-CHANGE-LOG.md` 最新 FR-021-032 條目與 `02-REQUIREMENTS-ANALYSIS.md:44-50`、`06-TEST-AND-PROCESS-AUDIT.md:25-35` 對應 FR-021、FR-010、NFR-001／005／006，限定暫存資料、loopback、不呼叫雲端、不覆蓋使用者資料，並明確記錄 `systemNetworkDisabled=false`；原始 FR-021 仍要求真正斷網與 Ollama／LM Studio 條件，LM Studio 只以需求方已刪除的範圍例外處理，沒有把 FR-021 整體標為完成。
- 證據：`package.json:14-18` 提供可重放的 `acceptance:ollama:product` script；功能與稽核文件同步記錄探針是暫存 server 的 API product path。條件是本輪不涵蓋實際 Electron／瀏覽器 UI 人工操作，也沒有真正關閉系統網路，故只能支持限定的 Ollama loopback 流程驗收。

## 2. 邏輯正確性

- 判定：有條件通過
- 證據：`scripts/probe-ollama-product-live.mjs:11-15` 先解析 `OLLAMA_BASE_URL`、檢查 evidence 是否存在，再以 `isLoopbackAiUrl()` 拒絕非 `http(s)` loopback；兩項檢查都位於 `mkdtempSync()`、設定檔寫入及 server `spawn()` 之前。`local-ai.mjs:20-32` 的判定使用 URL hostname allowlist，而非字串前綴；artifact 的 `endpointPrivacy` 與 `loopbackOnlyConfiguration` 也由同一 URL 計算。
- 證據：探針在 `scripts/probe-ollama-product-live.mjs:137-140` 建立輸入 SRT 後、AI／save-review 前讀取保存前內容與 SHA-256；`211-224` 在保存後重新讀取、比較內容、檢查 review data 時碼，並把 `sourceSrtBeforeSha256`／`sourceSrtAfterSha256` 寫入 evidence。`227-239` 的 nested `finally` 會在正常流程例外、停止 server 及 evidence 寫入成功／失敗後清理暫存目錄。
- 證據：仍有一項邊界邏輯缺口：`13` 的 early `existsSync` 與 `234` 的一般 `writeFileSync` 不是原子建立；若檔案在前置檢查後、寫入前被另一程序建立，`writeFileSync` 預設可截斷該檔案。這不影響本次單程序負例，但不構成競態下的絕對「不可覆寫」保證。

## 3. 邊界情況

- 判定：有條件通過
- 證據：唯讀重現 `OLLAMA_BASE_URL=https://example.invalid/v1 node scripts/probe-ollama-product-live.mjs /private/tmp/ollama-product-live-round2-remote-negative.json` exit 1，錯誤為只允許 loopback URL，且指定輸出檔不存在；重現既有 `docs/project-management/evidence/2026-09-15-ollama-product-live-recheck-4.json` 亦在第 13 行以既有 evidence 拒絕，未啟動 server、未建立暫存資料。遠端負例輸出檔保持不存在。
- 證據：`try/catch/finally` 結構可保護 server 啟動後的逾時、HTTP／模型失敗與保存失敗；`fs.rmSync(dataDir, { recursive: true, force: true })` 位於最內層 finally。唯讀審查未執行會寫入 fail artifact 的故意中途例外測試，因本輪唯一允許寫入檔案是本報告；因此 finally 清理主要由程式結構與成功 artifact 支持，而非新 runtime cleanup artifact。
- 證據：輸出路徑的競態建立／替換仍可能造成 evidence 檔被截斷，屬本輪新發現的不可覆寫邊界風險；此外，SIGKILL、程序崩潰或主機斷電不會執行 JavaScript finally，暫存資料不具崩潰後清理保證。探針未把這些情況誤記為已驗收通過。

## 4. 程式碼品質

- 判定：有條件通過
- 證據：探針責任集中，使用獨立 `OFFLINE_SUBTITLE_DATA_DIR`／settings 目錄、隨機 loopback server port、隨機 API token、`stopProcess()` 與 nested finally；產品流程本身使用 API 建立任務、AI optimize、session decision、undo／redo 及 save-review，未修改產品 runtime。
- 證據：artifact 只保存 schema、環境、provider／model、狀態、數量、時間碼旗標與 hash；`recheck-4.json` 沒有完整字幕文字、API Key、Authorization、Bearer、token 或 secret 欄位。完整字幕只存在探針的自然 fixture 與暫存資料目錄，流程結束由 finally 移除；這不等同於遭遇 SIGKILL 時的清理保證。
- 證據：`scripts/probe-ollama-product-live.mjs:231-238` 在寫 evidence 時再次檢查路徑，能防止一般單程序重跑覆蓋，但未使用 exclusive `wx` 建立或其他原子鎖定方式，故仍須保留上述競態風險。另因 `spawn` 的 child env 使用 `...process.env`，探針會將父程序環境傳給測試 server，雖未將其秘密寫入 artifact，最小權限隔離仍可再加強。

## 5. 測試覆蓋

- 判定：有條件通過
- 證據：`npm run project:preflight -- --type=full` exit 0；`node --check scripts/probe-ollama-product-live.mjs`、`node scripts/test-ai-providers.mjs`、`npm run docs:check`、`git diff --check` 均 exit 0；完整 `npm run check` exit 0，包含治理、AI optimizer／provider、Ollama streaming、review UI 與核心 API 回歸。
- 證據：`scripts/test-ai-providers.mjs:330-342` 已加入 product probe source contract，涵蓋暫存資料、loopback guard、未宣稱系統斷網、時間碼／SRT hash 及 evidence guard；本輪另實際重現遠端 URL 與既有 evidence 的啟動前拒絕。這些測試支持 round1 三項修正確實存在並可重放。
- 證據：目前仍沒有 deterministic runtime test 證明一般 `writeFileSync` 在競態下不可覆寫、沒有中途例外後的實際暫存清理 artifact，也沒有瀏覽器／Electron UI test 驅動本輪人工接受／undo／redo。探針對 undo／redo 檢查的是 API response 的零 conflict 與各 2 筆 `changes`，不是套用 response 後再讀取 UI／工作狀態的完整內容斷言。

## 6. 實際運行結果

- 判定：有條件通過
- 證據：`docs/project-management/evidence/2026-09-15-ollama-product-live-recheck-4.json` 記錄 macOS arm64／Node v22.22.3、Ollama `llama3.2:1b`、`http://127.0.0.1:11434/v1`、`endpointPrivacy=local`、AI `completed`、2 suggestions、0 retries、session accepted 2、undo／redo 各 2、review cue 2、`timecodesUnchanged=true`；`sourceSrtBeforeSha256` 與 `sourceSrtAfterSha256` 相同，且 `sourceSrtPreserved=true`。
- 證據：artifact 明確為 `scope.systemNetworkDisabled=false`，文件也明確說明只完成 loopback，沒有誤宣稱真正斷網；LM Studio 以需求方範圍例外記錄，沒有把缺少服務冒充實機結果。先前抽象 fixture 觸發 1B 模型輸出語系不符而安全失敗的 artifact 仍被保留，沒有以成功 fixture 推廣為通用模型品質保證。
- 證據：本次成功結果實際證明的是暫存測試 server 的 API product path；AI session 的 accepted／undo／redo 數量、雙語保存、時碼與原始 SRT hash 均有 evidence，但沒有 UI 操作與套用後畫面狀態的獨立運行紀錄。

## 新阻擋問題

1. Evidence 路徑的「不可覆寫」在競態下仍不具原子保證：`existsSync(outputPath)` 與 `writeFileSync(outputPath, ...)` 之間可被另一程序建立或替換檔案，而一般 `writeFileSync` 可能截斷既有內容。此次順序重跑負例已證明一般既有路徑會早期拒絕，但沒有消除這個競態覆寫風險。

## 綜合判定

- 結論：不通過
- 證據：FR-021-032 round2 已解除 round1 指出的遠端 URL 外送、保存前 SRT hash 缺失及既有 evidence 拒絕過晚／清理跳過問題；loopback product artifact、AI session 接受／undo／redo、雙語保存、時間碼與原始 SRT before／after hash 均有成功證據，且未誤宣稱真正斷網；然而 evidence 輸出仍以非原子 exists-then-write 方式保護，競態下可能覆寫使用者指定檔案，故本輪有新阻擋問題，不能結案。另保留 API product path 非 UI 人工驗收、非真正斷網及 SIGKILL 後清理未驗證等已揭露條件。

## 審查代理聲明

本報告由獨立審查代理產出，主要代理不得修改本報告內容。
除本報告外，本代理未修改任何檔案。
