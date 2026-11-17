# 獨立複審報告：Ollama loopback API product path（FR-021-032）

- 審查對象：`scripts/probe-ollama-product-live.mjs`、`scripts/test-ai-providers.mjs`、`package.json`、FR-021-032 需求／設計／稽核文件，以及 `docs/project-management/evidence/2026-09-15-ollama-product-live-recheck-5.json`。
- 審查輪次：round4。
- 審查方式：獨立唯讀複審；逐項核對 round1／round2 阻擋修正與 round3 實質結論，未執行長時間或網路測試。
- 複審範圍：僅 Ollama loopback API product path；不將本輪結果推論為 FR-021 整體完成。

## 1. 需求完整性

- 判定：通過
- 證據：`02-REQUIREMENTS-ANALYSIS.md`、`03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md` 與最新 changelog 均將本輪限定為暫存資料、Ollama loopback API product path、AI session 接受／undo／redo、雙語保存、時碼與原始 SRT 保護；同時明確保留真正斷網條件，LM Studio 依需求方已刪除例外未執行。
- 證據：`package.json` 提供 `acceptance:ollama:product` 可重放入口，文件也明確記錄 `systemNetworkDisabled=false`、未做 Electron／瀏覽器 UI，且不得宣稱 FR-021 整體完成，需求與實際驗收邊界一致。

## 2. 邏輯正確性

- 判定：通過
- 證據：`probe-ollama-product-live.mjs` 在建立暫存資料、寫設定與啟動 child server 前先檢查既有 evidence 並以 `isLoopbackAiUrl()` 拒絕非 loopback URL；round3 已以遠端負例確認 exit 1 且未建立輸出檔，避免錯誤外送字幕。
- 證據：探針在 AI／保存流程前讀取原始 SRT 並計算 `sourceSrtBeforeSha256`，保存後再計算 `sourceSrtAfterSha256`、核對 review data 時碼與原始內容；recheck-5 顯示兩個 SHA-256 相同、`sourceSrtPreserved=true` 與 `timecodesUnchanged=true`。
- 證據：evidence 寫入使用 `fs.writeFileSync` 的 exclusive `flag: 'wx'`，round2 指出的 exists-then-write 競態已由原子建立修正；child server 改用最小明確環境，不繼承父程序 AI secrets。

## 3. 邊界情況

- 判定：通過
- 證據：既有 evidence 路徑與遠端 URL 均在 `mkdtempSync()`、server 啟動及 Ollama 請求前拒絕；round3 的唯讀重現確認既有輸出檔不被覆寫、未啟動 server，且遠端負例不產生 evidence。
- 證據：child server 的 tools、Whisper／Breeze cache、`TEMP`、`TMP` 與 `TMPDIR` 均指向本次暫存路徑，AI key 欄位為空；正常例外路徑由 nested `finally` 清理暫存資料，未把 SIGKILL、主機崩潰或 UI 邊界誤記為已驗收。
- 證據：`scripts/test-ai-providers.mjs` 涵蓋 loopback／IPv6／localhost 子網域分類、遠端 Ollama 金鑰門檻、redirect 手動阻擋與 Ollama streaming／idle timeout；這些 deterministic 邊界與本次 product probe 範圍相互吻合。

## 4. 程式碼品質

- 判定：通過
- 證據：探針以單一可讀流程串接任務建立、AI optimize、session、接受、undo／redo、save-review 與 artifact 摘要，並以隨機 loopback port、暫存 settings／data／tools 及 nested `finally` 降低污染使用者資料的風險。
- 證據：artifact 僅保存狀態、數量、時間碼旗標與 hash，不保存完整字幕、API Key、Authorization、Bearer、token 或 secret；child env 為最小 allowlist，符合 round2 的隔離修正。
- 證據：探針未放寬產品 strict cue validation，也未修改產品 runtime；程式與治理文件準確使用 API product path 描述，沒有把 API 驅動流程稱為 Electron／瀏覽器 UI 驗收。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：已核對 round3 記錄的 `node --check`、`node scripts/test-ai-providers.mjs`、`npm run check` 與 `git diff --check` 均 exit 0；完整回歸包含治理文件、AI optimizer／provider、Ollama streaming、review UI 與核心 API。
- 證據：`scripts/test-ai-providers.mjs` 已覆蓋暫存目錄、空 AI secrets、啟動前 loopback／既有 evidence guard、保存前／後 hash、時間碼保護與 `flag: 'wx'`；round3 亦實際重現遠端與既有輸出負例。
- 證據：本輪未新增執行測試，且沒有 Electron／瀏覽器 UI 驅動、真正斷網、SIGKILL 後清理或 LM Studio 實機測試；因此測試覆蓋足以支持限定 API product path，不足以覆蓋 FR-021 全部驗收條件。

## 6. 實際運行結果

- 判定：通過
- 證據：`2026-09-15-ollama-product-live-recheck-5.json` 記錄 macOS arm64／Node v22.22.3、Ollama `llama3.2:1b`、`http://127.0.0.1:11434/v1`、`endpointPrivacy=local`、AI `completed`、2 suggestions 與 0 retries。
- 證據：同一 artifact 記錄 session accepted 2、undo／redo 各 2、雙語 review cue 2、`timecodesUnchanged=true`、`sourceSrtPreserved=true`，且保存前後 SHA-256 均為 `9c445ec8160ce9a3c13d28b207ca872897b6d3dd16a528f2be39460c6210da3e`。
- 證據：artifact 明確記錄 `scope.systemNetworkDisabled=false` 與 LM Studio `not-run-by-explicit-scope-exception`；實際結果可證明 loopback API product path 通過，但不證明真正斷網、UI 或 FR-021 整體完成。

## 綜合判定

- 結論：通過
- 證據：round1／round2 的遠端 URL、保存前 SRT hash、早期 evidence guard、evidence 競態與 child env 隔離問題均已由程式、deterministic contract、負例重現及 recheck-5 artifact 核對解除；本輪只確認 Ollama loopback API product path。
- 可逐字引用的完整結論句：**FR-021-032 Ollama loopback API product path round4 複審通過，但本輪只驗證 loopback API product path；systemNetworkDisabled=false 未完成真正斷網、未做 Electron／瀏覽器 UI、LM Studio 依需求方已刪除例外未執行，故不得宣稱 FR-021 整體完成。**
- 阻擋問題（若有）：無。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
