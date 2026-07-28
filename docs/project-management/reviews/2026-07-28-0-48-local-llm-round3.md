# 獨立審查報告：0.48 本機 LLM 基礎支援第二階段

- 審查對象 commit／版本：工作樹基準 `82af544b112423afafba8940cb5ff59e701177c7`／`0.48.0`，分支 `codex/0.48-local-llm`；審查包含 2026-07-28T11:27:33+08:00 前可見的第二階段未提交差異。
- 對應 08-CHANGE-LOG 條目：2026-07-28 — 0.48 本機 LLM 基礎支援
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-07-28（Asia/Taipei）；由主要代理啟動獨立複審上下文，審查代理自行讀取完整差異、FR-021、工作條目、round1／round2 報告與必要程式，並獨立重跑測試及 macOS 預封裝驗證。

## Findings

### 阻擋／高嚴重度

- 無。round1 的 redirect 安全問題仍維持修正狀態；第二階段未引入新的產品程式碼或安全邊界變更。

### 中嚴重度

- 無未處理問題。第二階段測試只使用 fake OpenAI-compatible server，文件也明確標示為自動回歸／fake server，未把它寫成真實 Ollama、LM Studio 或斷網驗收。

### 低嚴重度／剩餘限制

- `[P3]` `scripts/test-core.mjs:281-290` 的 invalid capability 只覆蓋回應不是 JSON；尚未專門覆蓋合法 JSON 但繁中字串不符、選定模型未列出與模型列表 malformed 等組合。不影響本輪既有判定，但可在真實模型驗收前補充。
- `[P3]` `scripts/test-core.mjs:448-460` 證明取消會關閉進行中的 HTTP request，且無 checkpoint 時不可續跑；尚未專門測試「第一批完成、第二批進行中時取消」是否保留可恢復 checkpoint。現有 `scripts/test-core.mjs:462-478` 已以第二批永久錯誤驗證 checkpoint／續跑，故此為補強建議而非阻擋。
- `[P3]` macOS Electron 證據是未簽章目錄版，不是 DMG 安裝後或乾淨帳號驗收；文件已準確限縮，不構成誤述。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - 第二階段針對 FR-021 的兩個 provider 分流、模型能力負例、取消、checkpoint／續跑與 Electron 預封裝風險增加證據，方向與 `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37` 一致。
  - `scripts/test-core.mjs:227-296` 明確以 Ollama 設定測試無 Key／無雲端同意、模型清單、連線、有效／無效能力回應與 redirect。
  - `scripts/test-core.mjs:410-478` 改以 LM Studio 設定完成優化、429 重試、取消 HTTP、失敗 checkpoint 與只續跑第二批。
  - FR-021 的真實 Ollama／LM Studio 各一模型、真正斷網與跨平台安裝後門檻仍未完成，因此只能判定第二階段證據完整、版本需求部分通過。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - provider 分流不是只改 assertion 文案：`scripts/test-core.mjs:233` 實際保存 `provider: 'ollama'`，`scripts/test-core.mjs:415` 實際保存 `provider: 'lm-studio'`，並於 `scripts/test-core.mjs:446` 斷言完成紀錄的 provider 為 `lm-studio`。
  - invalid capability 路徑在 fake server 回 `not json`，API 仍回 200 的能力結果，但 `jsonOutput` 與 `traditionalChinese` 均為 false（`scripts/test-core.mjs:281-290`），符合「能力不足是檢查結果，不是服務崩潰」的設計。
  - slow request 在 request body 完整抵達後停住；取消 API 後任務進入 `cancelled`、`retryable` 為 false，並等待 server `close` 事件（`scripts/test-core.mjs:448-460`），確實驗證 AbortController 傳至 HTTP transport。
  - checkpoint 測試先讓第一批完成、第二批失敗，確認 `nextBatchIndex === 1`，恢復後 fake server 只收到 cue 2（`scripts/test-core.mjs:462-478`），排除重送第一批。

## 3. 邊界情況

- 判定：通過（第二階段範圍）
- 證據：
  - 有效能力、無效 JSON 能力、redirect、429 重試、慢請求取消、永久第二批錯誤、checkpoint 與恢復皆有可執行 assertion。
  - 取消測試先以 `waitFor(() => fakeAiCalls > 0)` 確認 request 已抵達服務才取消，避免在 HTTP 尚未開始前取消造成假陽性。
  - `slowAiRequestsClosed` 只在 server response `close` 時計數，測試再等待其大於 0，能分辨 UI／job 狀態取消與底層連線實際中止。
  - round2 的五種 redirect contract 與實際第二站零請求仍由完整回歸重跑，未回歸。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - 第二階段集中於擴充既有 `test-core.mjs` fake server 狀態機及共用 `waitFor`，未為測試增加產品環境分支或修改 production API。
  - fake mode 在每段測試前明確重設，cancel、fail-second 與 success 不共用殘留計數；`finally` 仍關閉 app server、fake AI server 與 redirect receiver。
  - 文件使用「fake OpenAI-compatible server」「自動回歸」「未簽章目錄版」「不等同 DMG 安裝後驗收」等精確限定，沒有將 mock／預封裝證據升格為真實服務或安裝版證據。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-28T11:27+08:00 在允許 loopback listener 的環境獨立執行 `node scripts/test-core.mjs && npm run check && git diff --check`：全部通過。
  - `npm run check` 包含治理文件、語法、preflight、授權、validator、媒體、雙語、品質、Whisper metadata、AI optimizer、provider、review UI 與 core 完整回歸。
  - 第二階段新增的 Ollama／LM Studio 分流、invalid capability、取消 HTTP、checkpoint／續跑均由同一次實際 core 執行通過。
  - 覆蓋仍缺真實 Ollama／LM Studio、真正斷網、Windows 封裝與 macOS DMG 安裝後操作，故版本層級只能部分通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 2026-07-28T11:26+08:00 獨立執行 `npm run runtime:manifest:mac && npm run runtime:verify:mac && npm run electron:build:mac:dir`：darwin-arm64 runtime 驗證成功，Electron 33.4.11 arm64 目錄版打包完成；輸出明示 `skipped macOS code signing`，與文件「未簽章目錄版」一致。
  - 2026-07-28T11:27+08:00 獨立執行 `node scripts/verify-electron-renderer.mjs <macOS App executable> 9348 45000`：Electron bridge、設定 modal、上傳建立 201、啟動 202、任務 completed、review AI 資產、術語 round-trip 均通過；providerIds 實際為 `openai`、`openai-compatible`、`azure`、`groq`、`gemini`、`ollama`、`lm-studio`。
  - renderer 輸出的 `packagedTrimFlow` 為 null，因本次未提供實際 trim media；目前三份文件沒有宣稱第二階段做過封裝版真實修剪，故無證據矛盾。
  - `00-CURRENT-STATUS.md:52-53`、`06-TEST-AND-PROCESS-AUDIT.md:116-119` 與 `08-CHANGE-LOG.md` 最新條目準確區分 mock、自動回歸、macOS 未簽章目錄版、真實模型／斷網／Windows／DMG 安裝後缺口。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無；第二階段未發現新的合併阻擋，round1 redirect 阻擋仍維持解除。
- 剩餘風險：
  - Ollama／LM Studio 測試仍是 fake OpenAI-compatible server，不代表真實服務版本、模型載入、JSON 穩定性、繁中品質或 context metadata。
  - 沒有真正移除外網後的本機字幕優化證據。
  - macOS 只驗證未簽章目錄版，Windows 封裝與 macOS DMG 安裝後仍未覆蓋。
  - 取消後 checkpoint 的組合情境與更多 capability malformed 組合可再補強。
- 給主要開發代理的具體要求：
  1. 可保留第二階段測試與文件變更，並將 round3 結論連結至工作條目。
  2. 0.48 狀態維持「開發中」，不得將本報告、fake server 或 macOS 預封裝驗證描述為真實模型、斷網或跨平台安裝後通過。
  3. 下一階段應優先取得真實 Ollama／LM Studio 各一模型與真正斷網端到端，再補 Windows 與 macOS DMG 安裝後驗收。

**本輪「2026-07-28 — 0.48 本機 LLM 基礎支援」round3 獨立複審結論為有條件通過：第二階段已以可執行核心測試分別覆蓋 Ollama 的模型探索、有效／無效能力與 redirect 防護，以及 LM Studio 的完整字幕優化、429 重試、取消時中止 HTTP、checkpoint 與只續跑未完成批次；獨立重跑 npm run check 與 git diff --check 通過，macOS arm64 runtime、未簽章目錄版打包及實際 Electron renderer 亦確認 bridge、設定、任務完成、review AI 資產、術語 round-trip 與七個 provider，文件對上述證據及限制的描述準確；但這些 AI 測試仍使用 fake OpenAI-compatible server，真實 Ollama／LM Studio、真正斷網、Windows 封裝及 macOS DMG 安裝後尚未驗收，因此 0.48 必須維持開發中，不得宣稱完成或發布就緒。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、測試、預封裝與驗證，未修改任何其他專案來源或治理檔案。
- 若上述聲明不實，本報告無效。
