# 獨立審查報告：Breeze runtime 缺件提供可操作安裝指引（BUG-021）

- 審查對象 commit／版本：`codex/021-breeze-runtime-guide` 最新工作樹（基線 0.49.0；round1 阻擋修正版）
- 對應 08-CHANGE-LOG 條目：2026-08-13 — Breeze runtime 缺件提供可操作安裝指引（BUG-021）（`docs/project-management/08-CHANGE-LOG.md:5`）
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-08-13T14:16+08:00；同一獨立審查角色的新回合，只依 round1 阻擋、最新差異與 debug 路由重新驗證
- 證據核對時間：2026-08-13T14:16–14:20+08:00

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - round1 阻擋一已解除：macOS／Linux 與 Windows setup 都使用 `git clone --recurse-submodules`，venv 與 submodule 安裝路徑以使用者家目錄的絕對路徑組合，不再依賴空 submodule 或 Breeze repo cwd（`lib/breeze-asr.mjs:33-41,49-56`）。
  - round1 阻擋二已解除：guide 分開提供「在本專案目錄執行」的開發版 `npm start`，以及 macOS `/Applications/離線字幕工廠.app/Contents/MacOS/離線字幕工廠`、Windows `%LOCALAPPDATA%\Programs\離線字幕工廠\離線字幕工廠.exe` 的預設安裝版命令（`lib/breeze-asr.mjs:43-44,58-59`）；`docs/BREEZE-ASR-25.md` 亦同步說明不得在官方 Breeze repo 執行 `npm start`。
  - UI 仍具備模型下載 modal 入口、ASR 欄位 persistent 入口、雙平台指令、複製、重新檢查及切回 Whisper.cpp，且 API 與 model payload 傳輸同一份固定 guide。
  - 但「複製啟動指令」尚未完整符合成功條件：畫面會把開發版與安裝版命令合併顯示（`public/app.js:696-705`），複製按鈕卻只複製 `launchCommand`，完全省略 `packagedLaunchCommand`（`public/app.js:717-720`）。安裝版使用者看到的可用命令無法由該按鈕取得。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - setup command 的順序正確：先定義家目錄、recursive clone、建立 venv、以該 venv Python 安裝 patched Whisper，再以 `whisper.available_models()` 驗證 `breeze-asr-25`。它不會切換目前 shell cwd，也不會啟動本 App。
  - 開發版與安裝版 command 的 executable／runtime 路徑邏輯分離，兩者都在啟動 App 的同一 shell process environment 設定 `BREEZE_ASR_PYTHON`；server 重啟後既有只讀 runtime probe 才可能檢出新 venv，沒有假稱現行 process 可熱更新環境變數。
  - 複製行為與顯示內容不一致：`launchCommand.textContent` 是 `[selected.launchCommand, selected.packagedLaunchCommand]`，`copyTextToClipboard` 的參數卻只有 `selected.launchCommand`。本輪獨立印出兩平台資料都得到 `displayedHasPackagedCommand=true`、`copiedHasPackagedCommand=false`。
  - 被複製的 `launchCommand` 首行是未加 shell／PowerShell 註解的中文說明「在本專案目錄（offline-subtitle-factory-app）執行：」（`lib/breeze-asr.mjs:43,58`）。直接整段貼上會先嘗試執行這段文字並報 command-not-found／CommandNotFoundException；即使 shell 後續可能繼續執行第二行，也不符合可直接複製執行的引導品質。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - `--recurse-submodules`、家目錄含空白（Unix 皆引用；PowerShell 使用 `Join-Path`）、Python 3.11 缺失的 Unix 明確錯誤、開發／安裝位置分流、自訂 App 安裝位置提示均已處理。
  - persistent 入口只在 Breeze 模型有效且 runtime 未就緒時顯示，切換 manual／Whisper.cpp 會隱藏；模型尚缺時仍可從模型下載 modal 先開 guide。
  - 未覆蓋目的目錄已存在、recursive clone 部分失敗、PowerShell 缺少 `py -3.11`、pip／git／網路錯誤與 portable Windows executable；這些可保留為外部安裝風險，不是本輪 deterministic guide 的假成功。
  - copy 邊界沒有測試：未斷言 clipboard 內容包含安裝版命令，也未斷言複製字串的說明行是合法註解或從命令字串分離。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - 固定 guide 資料集中於 `breezeRuntimeInstallGuideDetails()`，API 不接收 URL／command 參數；UI 使用 `textContent`，App 不執行 shell／pip，外連維持既有 IPC 協定限制。沒有新增秘密讀取、HTML injection 或自動第三方程式碼執行。
  - `runtimeRequirement`、官方連結、setup／launch／packaged launch 和 after-install 分工清楚；`docs/BREEZE-ASR-25.md` 與程式碼命令基本一致。
  - UI 目前把「顯示內容」與「複製內容」以兩套表達式重複組合，導致本次遺漏。應抽出同一個 `renderedLaunchCommands`，或給開發版／安裝版各自命令與複製按鈕，避免再次分歧。
  - 第三方 repo／submodule 仍未 pin commit，屬明示的供應鏈風險；手動執行界線降低自動 RCE 面，但不能宣稱來源已被完整驗證。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-08-13T14:18+08:00 獨立執行 `node --check lib/breeze-asr.mjs`、`node --check server.mjs`、`node --check public/app.js`、`node scripts/test-breeze-asr.mjs`、`node scripts/test-core.mjs` 與 `git diff --check`，均通過。
  - 2026-08-13T14:19+08:00 獨立執行 `npm run check`，docs check、語法、全部 deterministic 單元／整合／核心 API 回歸均通過。
  - 新 focused assertions 已覆蓋兩平台 recursive clone、家目錄變數、submodule 路徑、開發版 `BREEZE_ASR_PYTHON`、macOS／Windows 安裝版路徑，以及不得 `cd`／`Set-Location` 至 Breeze repo（`scripts/test-breeze-asr.mjs:26-44`）；round1 的兩項阻擋有防回歸證據。
  - 測試只斷言 `packagedLaunchCommand` 物件存在，沒有驗證 `copyLaunchCommand` 會複製它；反而明確接受 `launchCommand` 以中文說明開頭（`scripts/test-breeze-asr.mjs:38-43`），因此完整測試通過仍未覆蓋目前 clipboard 行為錯誤。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - API／核心回歸在隔離暫存資料與 loopback server 通過，證明固定 guide 可由 `/api/breeze-asr` 傳送且未破壞既有任務流程。
  - 本輪以實際 guide 物件重放 clipboard 來源邏輯：macOS／Windows 的畫面資料皆有 packaged command，但目前複製來源皆無 packaged command，且首行為非註解說明。這是可重現的 UI 資料流錯誤，不是推測。
  - 本輪仍未執行真實 recursive clone／pip、未安裝 patched runtime／checkpoint、未以 macOS 或 Windows 安裝版啟動，也沒有真實 Breeze 音訊。這些缺口已在治理文件保留，不影響 deterministic UI/API 修正範圍，但不得被描述成實機驗收。

## 安全／隱私核對

- 判定：通過（限本輪 guide 邊界）
- 證據：guide 是固定非秘密資料，測試拒絕 secret/token/password/api-key 類欄位；API 不接受任意命令或下載來源。App 只顯示／複製命令，不自行執行。
- 外部 repo、submodule、pip 與模型仍具有網路及供應鏈風險，須由使用者在終端明確執行；這是剩餘風險，不可由「官方連結」字樣推論為已驗證安全。

## 文件與交付風險

- 判定：部分通過
- 證據：`docs/BREEZE-ASR-25.md`、`03-FUNCTIONAL-DESIGN.md:65`、`06-TEST-AND-PROCESS-AUDIT.md:207-212`、`07-DEBUG-AND-FIX-HISTORY.md:227-236` 已同步命令契約、根因、測試範圍與真實 runtime／跨平台缺口，round1 的文件閉環要求已處理。
- BUG-021 工作紀錄仍在進行中且結案欄位待執行，符合 round2 尚未通過的狀態；本輪不建立 tag／Release，發布授權不適用。
- 修正 clipboard 阻擋後須同步測試與必要文件描述，再以 round3 新報告複審；不得覆寫 round1／round2。

## 綜合判定

- 結論：不通過
- 阻擋問題（若有）：`public/app.js:701,717-720` 顯示開發版與安裝版兩組啟動指令，但「複製啟動指令」只複製開發版 `launchCommand`；且 `lib/breeze-asr.mjs:43,58` 的 copied string 以未註解中文說明開頭，直接貼到 shell／PowerShell 會先產生命令錯誤。請讓複製內容與畫面一致（或拆成兩個清楚按鈕），並讓 clipboard 內容只有可執行命令或使用各平台合法註解，再新增精確 assertions 驗證開發版／安裝版兩種 clipboard payload。
- 剩餘風險：真實 recursive clone／submodule／pip、Python／PyTorch 相容性、第三方供應鏈、3 GB checkpoint、macOS／Windows 安裝版與 PowerShell／shell、音訊品質、CPU／CUDA 效能、長音訊、取消與 process tree 仍未驗收；Windows portable／自訂安裝位置仍需使用者替換 executable 路徑。
- 給主要開發代理的具體修正要求（若有）：修正上述 clipboard payload 並補 focused test；重跑 `node --check public/app.js`、`test-breeze-asr`、`test-core`、`npm run check`、docs final 與 diff check。此修正影響驗收結論，須建立 round3 報告複審。
- 可逐字引用完整結論句：**「BUG-021 round2 獨立審查不通過：round1 的 recursive submodule 安裝與錯誤 Breeze repo 啟動兩項阻擋已解除，API、persistent 入口、雙平台命令及治理文件亦已補齊；但目前畫面顯示開發版與安裝版兩組啟動命令時，複製按鈕只複製開發版字串，且該字串以不可直接執行的未註解中文說明開頭，尚未符合可操作的複製指令驗收條件，修正 clipboard payload 並補測後須進行 round3 複審，本結論亦不代表真實 Breeze runtime、模型品質、效能或跨平台實機已驗收。」**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
