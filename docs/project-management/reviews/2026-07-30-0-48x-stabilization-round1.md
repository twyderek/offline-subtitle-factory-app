# 獨立審查報告：0.48.x 穩定化：設定遷移與驗收基線

- 審查對象 commit／版本：目前工作樹／`0.48.0`；差異限於 `scripts/test-core.mjs`、`docs/project-management/00-CURRENT-STATUS.md`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md` 與 `docs/project-management/08-CHANGE-LOG.md` 最新條目。
- 對應 08-CHANGE-LOG 條目：2026-07-30 — 0.48.x 穩定化：設定遷移與驗收基線
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-30T14:28+08:00；由主要代理啟動的獨立審查上下文，自行執行 debug preflight、讀取固定核心與任務路由、檢查指定差異及實作／既有測試，未沿用主要代理對變更品質的評價性結論。
- 審查需求／缺陷：`FR-014`、`FR-021`、`NFR-005`、`NFR-006`、`NFR-008`、`BUG-012`。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:30` 的 `FR-014` 要求可辨識的 Gemini／OpenAI-compatible 不一致值安全回復，且不得刪除 API Key 或 Gemini profile；`docs/project-management/08-CHANGE-LOG.md:52` 已連結該需求及 `BUG-012`。
  - `scripts/test-core.mjs:306-324` 現同時驗證 API 回應與磁碟 `settings.json` 的 `provider`、`baseUrl`、`model`，覆蓋本輪新增的 top-level 持久化目標。
  - 新增案例沒有建立「遷移前已存在的 Gemini profile／磁碟 Key」，因此也沒有斷言遷移後兩者仍存在。既有 `scripts/test-core.mjs:363-373` 只在遷移之後新建 Gemini runtime key，再驗證 Groq 清除不影響它，不能直接證明 BUG-012 遷移不刪除既有 Gemini profile／Key。這是 `FR-014` 尚未被本輪持久化回歸完整鎖定的邊界。
  - `FR-021` 與發布／實機缺口僅作驗收基線揭露，沒有產品行為變更；`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:127-131` 與 `docs/project-management/08-CHANGE-LOG.md:68` 均明列 LM Studio UI／取消／續跑／真正斷網仍未完成。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - 測試 server 由 `scripts/test-core.mjs:104-113` 以 `OFFLINE_SUBTITLE_DATA_DIR=dataDir`、`OFFLINE_SUBTITLE_SETTINGS_DIR=dataDir/config` 啟動；新斷言在第 321 行讀取同一 `dataDir/config/settings.json`，並非讀錯路徑或只重複檢查 HTTP body。
  - `/api/ai/settings` 在 `server.mjs:3258-3276` 先呼叫 `normalizeAiSettings`，再以同步 `writeJson(settingsPath, appSettings)` 寫入磁碟後才回應；`server.mjs:236-237` 的 `writeJson` 使用 `fs.writeFileSync`。因此第 321-324 行確實證明同一 server 寫入後的磁碟 JSON 已持久化正規化值。
  - 此測試沒有終止／重啟 server，也沒有在新 process 由 `loadSettings` 重新載入該檔。`docs/project-management/08-CHANGE-LOG.md:55` 將成功條件寫成「實際持久化／重啟路徑可回歸」，但第 60、68 行與 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:130` 又正確承認重啟仍未驗收。現有證據只滿足「寫入持久化」，尚未滿足條目成功條件中的「重啟路徑」。
  - production 遷移邏輯未在本輪修改；`server.mjs:381-407` 仍只在 provider 為 `openai-compatible` 且 URL／model 看似 Gemini 時清空 top-level Base URL／model，並保留 `profiles` 物件。未發現本輪文件／測試變更改變產品行為。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 已實測輸入為 `provider: openai-compatible`、Gemini 官方 URL 與 `gemini-3.5-flash`，結果 provider 保留、Base URL／model 在 API 與磁碟均清空（`scripts/test-core.mjs:306-324`）。
  - 鄰近既有案例涵蓋合法 OpenAI-compatible 自訂 endpoint、非法 provider、Azure 空值、Groq profile 與 provider key 隔離（`scripts/test-core.mjs:232-254,326-380`），本輪新增斷言沒有破壞這些路徑。
  - 尚未直接測試：只有 Gemini URL、只有 `gemini-*` model、刻意使用 Gemini proxy 的合法 OpenAI-compatible 進階情境、既有 Gemini profile／磁碟 Key 保存，以及已寫入 legacy 檔案後由新 server process 啟動／重啟載入。
  - 文件對 Windows／macOS 乾淨安裝、既有設定檔跨平台重啟、LM Studio 完整產品流程、真正斷網、Whisper Metal 與外部 provider smoke 均維持未完成（`docs/project-management/00-CURRENT-STATUS.md:32-41`、`docs/project-management/08-CHANGE-LOG.md:68`），沒有把自動回歸當成實機驗收。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - `scripts/test-core.mjs:321-324` 只新增一次 JSON 讀取及三個具體斷言，位置緊接既有 BUG-012 API 斷言，失敗訊息可辨識 provider／Base URL／model，變更最小且易維護。
  - 測試直接讀產品實際寫入檔案，而非複製 `normalizeAiSettings` 演算法到測試，避免同源實作錯誤造成假通過。
  - 指定差異只有一個測試檔與三個治理文件；`git diff --stat` 顯示四檔共 87 行新增、1 行刪除。`server.mjs` 雖列於工作條目的預計影響檔案，但實際沒有修改，未發現未授權的產品、封裝、發布、外部 API 或 secrets 寫入。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-30T14:34:06+08:00 在專案根目錄執行 `npm test`，2026-07-30T14:34:08+08:00 exit 0；輸出顯示 preflight、授權、治理 validator、媒體、雙語、字幕品質、Whisper quality、AI optimizer、AI provider、review UI 與核心回歸全部通過。
  - `npm test` 實際執行 `node scripts/test-core.mjs`，故新增第 321-324 行若磁碟沒有正確的 provider／空 Base URL／空 model，測試會失敗；本輪通過證明三項持久化斷言有被執行。
  - 2026-07-30T14:34:16+08:00 執行 `git diff --check`，exit 0。
  - 覆蓋仍缺 process restart/reload 與預先存在的 Gemini profile／Key 保存。若本工作要達到 `docs/project-management/08-CHANGE-LOG.md:55` 的完整成功條件及完整鎖定 `FR-014`，須補這兩類回歸，或將本輪成功條件明確收斂為「同一 server 寫入後的 top-level settings 持久化基線」。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 2026-07-30T14:28+08:00 親自執行 `npm run project:preflight -- --type=debug`，exit 0；輸出版本 `0.48.0`、分支 `codex/0.48-local-llm` 並列出 debug 路由。
  - 2026-07-30T14:34+08:00 的 `npm test` 與 `git diff --check` 均 exit 0；本輪沒有執行 Windows／macOS、重啟、LM Studio 斷網或外部 provider。
  - `docs/project-management/00-CURRENT-STATUS.md:41` 將 BUG-012 描述為 server／自動回歸已覆蓋「設定檔保存後的正規化值」，並明載跨平台啟動／重啟仍待驗收；此描述與本輪實際運行範圍一致。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：
  1. 工作條目第 55 行把「重啟路徑可回歸」列為成功條件，但現有新增測試只覆蓋同一 server 寫入後讀取磁碟，沒有新 process restart／reload。結案前須補重啟回歸，或收斂成功條件使其與第 60、68 行及測試稽核的未覆蓋聲明一致。
  2. 若本輪要宣稱 `FR-014` 的遷移保存要求已有完整防回歸，須建立預先存在的 Gemini profile 與獨立 Key fixture，遷移後斷言 `settings.json` 中 Gemini profile 未變、secret 仍存在且一般設定檔不含 Key；否則應明列此項仍待後續驗證。
- 剩餘風險：
  - 啟發式遷移仍可能影響刻意以 OpenAI-compatible proxy 使用 Gemini 的設定。
  - Windows／macOS 既有使用者資料目錄的啟動／重啟、LM Studio UI／取消／續跑／真正斷網、Whisper Metal 與外部 provider smoke 尚未執行；文件已如實保留。
  - 本輪不發布、不改封裝或產品邏輯，`NFR-008` 的既有未簽章／未公證與實機缺口未因本輪消失。
- 給主要開發代理的具體修正要求（若有）：
  1. 優先補一個 process restart 測試：用含 legacy Gemini 混用值及既有 Gemini profile 的 `settings.json`／secret fixture 啟動 server，驗證載入後公開設定、磁碟保存策略與 Key/profile 保存；若本輪不做，修改目標與遺留風險，避免把重啟寫成已達成功條件。
  2. 保留目前三個 top-level 磁碟斷言與實機／斷網限制；這些證據本身有效。

**本輪「2026-07-30 — 0.48.x 穩定化：設定遷移與驗收基線」round1 獨立審查結論為有條件通過：`scripts/test-core.mjs` 新增斷言確實讀取測試 server 實際使用的 `config/settings.json`，並由通過的 `npm test` 證明遷移後 provider、空 Base URL 與空 model 已寫入磁碟；目前狀態、測試稽核與工作紀錄也誠實保留跨平台重啟、LM Studio UI／取消／續跑、真正斷網及其他實機缺口，且未發現未授權的產品、封裝或發布變更；但測試尚未重啟新 server process，亦未以預先存在的 Gemini profile／獨立 Key fixture 證明 FR-014 的保存邊界，須補測或收斂工作條目的重啟成功條件並明列 profile／Key 未覆蓋後，方可結案。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前已確認目標路徑不存在，未覆寫既有審查報告。
- 若上述聲明不實，本報告無效。
