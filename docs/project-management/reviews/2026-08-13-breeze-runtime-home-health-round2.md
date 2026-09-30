# 獨立複審報告：Breeze macOS runtime 狀態與首頁健康卡修正（BUG-022）

- 審查對象 commit／版本：`codex/021-breeze-runtime-guide` commit `3e365b5162fecdf0a487c512a4d988b3b8b3d184` 上的 BUG-022 round1 阻擋修正版工作樹，產品版本 0.49.0
- 對應 08-CHANGE-LOG 條目：2026-08-13 — Breeze macOS runtime 狀態與首頁健康卡修正（BUG-022）（`docs/project-management/08-CHANGE-LOG.md:5`）
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-08-13T16:30+08:00；同一獨立審查角色的新複審回合，只依 round1 阻擋、最新差異、修正後 fixture 與重新執行的驗證判定
- 證據核對時間：2026-08-13T16:30–16:35+08:00

## 1. 需求完整性

- 判定：通過（限 BUG-022 來源修正範圍）
- 證據：
  - `lib/breeze-runtime-probe.mjs:22-48` 現在依平台解析標準 runtime：Windows 優先 `%USERPROFILE%/Breeze-ASR-25/.venv/Scripts/python.exe`，macOS／Unix 優先 `$HOME/Breeze-ASR-25/.venv/bin/python`。
  - `BREEZE_ASR_PYTHON` 仍在所有自動候選之前明確 return（`:23,38`）；未設定時，標準 external patched venv 排在 generic bundled／PATH Python 前（`:40-46`）。
  - `public/app.js:416-438` 的 `refreshHomeHealth()` 在 `/api/health` 成功後呼叫 `updateMetrics(tools)`，同步 FFmpeg／ASR／Whisper／GPU 卡片與首頁摘要。
  - Breeze model/runtime 缺件安全邊界維持：前端 `ensureBreezeAsrReady()` 只在 `model.valid && model.runtimeReady` 時回傳 true；server preflight 仍以 `needs-action` 阻止缺件任務並附 runtime guide（`public/app.js:799-830`、`server.mjs:1494-1541`）。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - round1 的 Windows home 優先序已解除：resolver 以 win32 分支選 `USERPROFILE || HOME`；同時存在兩者且各有 fixture 時，測試精確選到 `USERPROFILE` 下的 runtime。
  - round1 的 generic Python 遮蔽已解除：external runtime candidates 現在位於 tools candidates 前；修正後 macOS 與 Windows fixture 都在 resolver 實際查找的 `toolsDir/python/python(.exe)` 建立 generic candidate，並精確斷言標準 Breeze venv獲選。
  - macOS／Unix 反向 home 衝突也已覆蓋：`HOME` 與 `USERPROFILE` 同時存在時選 `HOME` 下的 runtime，平台邏輯對稱且明確。
  - `server.mjs:339-369` 用共用 resolver 產生 `toolPaths.breezePython`；`getBasicToolsStatus()`、Breeze API 與 job preflight／spawn 共用此 command。Electron server 啟動繼承 process env，並補齊 Unix `bin/python` 的 tools 探測，不會另行覆寫 `BREEZE_ASR_PYTHON`。

## 3. 邊界情況

- 判定：通過（deterministic 邊界足夠；實機缺口保留）
- 證據：
  - `scripts/test-breeze-asr.mjs:89-117` 覆蓋顯式 override、單一 macOS HOME、macOS HOME／USERPROFILE 衝突、macOS external／bundled 衝突、單一 Windows USERPROFILE、Windows USERPROFILE／HOME 衝突、Windows external／bundled 衝突。
  - probe success、spawn error／逾時、child close、stderr／secret／本機路徑遮罩等既有安全邊界仍通過；本輪未改動 shell 執行策略。
  - model valid/runtime false 時，UI 顯示 persistent guide／modal 並停止提交；server 在執行前再次檢查 `breezeRuntime` 與 model validity，避免只依前端狀態啟動。
  - 自訂安裝位置不猜測：仍需 `BREEZE_ASR_PYTHON`；不存在標準 venv 時才回退 bundled／PATH Python，最後由 capability probe 判定，而非只靠檔名宣稱 ready。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - 平台 home、candidate order 與 exists check 集中於單一純 resolver，server 不複製同一優先序；普通 Python 與 Breeze runtime command 保持不同欄位，減少 Whisper 一般 Python 被錯當 patched runtime 的機會。
  - 本輪只讀探測現有檔案並執行固定 capability probe；不 clone、不 pip install、不下載 checkpoint、不接受 API 傳入任意 command，且 `runBreezeRuntimeProbe()` 維持 `shell:false`、timeout／process cleanup 與診斷遮罩。
  - `03-FUNCTIONAL-DESIGN.md` 已同步平台路徑、external 優先、override、首頁卡片與不自動安裝邊界；`06-TEST-AND-PROCESS-AUDIT.md` 記錄 fixture／source assertion／未覆蓋範圍；`07-DEBUG-AND-FIX-HISTORY.md` 補齊 BUG-022 現象、根因、修正、防回歸與剩餘風險。

## 5. 測試覆蓋

- 判定：通過（對 BUG-022 deterministic 範圍足夠）
- 證據：
  - 2026-08-13T16:34:24+08:00 獨立執行 `node --check lib/breeze-runtime-probe.mjs`、`server.mjs`、`electron/main.mjs`、`public/app.js`、`node scripts/test-breeze-asr.mjs` 與 `git diff --check`，均通過。
  - 同一時間以可使用 loopback 的環境獨立執行完整 `npm run check`，exit 0；包含 `npm run docs:check`（19 個治理文件、版本 0.49.0）、全部 Node syntax、Breeze、Whisper、媒體、AI、UI 與核心 API deterministic regression。
  - 首頁修正由 `scripts/test-breeze-asr.mjs:146-149` source assertion 精確要求 `refreshHomeHealth()` 內呼叫 `updateMetrics(tools)`；完整 core test 另確保 health/API 基本資料流無回歸。
  - round1 曾指出原 bundled fixture 少一層路徑；round2 最新 fixture 已改為真正的 `toolsDir/python/python(.exe)` 並傳入正確 toolsDir，故此測試不再是假衝突綠燈。

## 6. 實際運行結果

- 判定：通過（限 resolver、API/UI source 與 deterministic runtime probe）
- 證據：
  - 本輪重放的 macOS／Windows home／generic conflict fixtures 均選到預期標準 Breeze venv，且 explicit override 保持最高優先；round1 兩個實際失敗情境已轉為通過。
  - 完整核心回歸證明 Breeze model/status API、runtime probe、缺件任務阻擋與引導沒有鄰近回歸；首頁 health success path 已接回既有 metric renderer。
  - 沒有啟動真實 MediaTek patched runtime、沒有載入約 3 GB checkpoint、沒有以真實音訊轉錄，也未在 macOS／Windows 安裝版 GUI 操作首頁卡片；因此本項通過只代表本輪來源修正，不是 runtime／品質／跨平台實機驗收。

## 綜合判定

- 結論：通過
- 阻擋問題（若有）：無。
- 剩餘風險：真實 MediaTek patched runtime、Python／PyTorch／submodule、約 3 GB checkpoint、模型品質、CPU／CUDA 效能、長音訊、取消／失敗復原、Windows process tree、macOS／Windows packaged GUI 與乾淨使用者實機仍未驗收；自訂 runtime 位置仍須明確設定 `BREEZE_ASR_PYTHON`，本結論不得擴張為公開 Release 或已完成跨平台 Breeze 品質驗收。
- 給主要開發代理的具體修正要求：無阻擋修正。請在 BUG-022 工作紀錄逐字引用下列結論，補齊實際修改／驗證／round2 連結與剩餘風險，再執行 `npm run docs:check:final`、`git diff --check` 後交付來源修正。
- 可逐字引用完整結論句：**「BUG-022 round2 獨立複審通過：Windows `USERPROFILE`／Unix `HOME` 平台優先序、標準 external Breeze venv 優先 generic bundled Python、`BREEZE_ASR_PYTHON` 明確覆寫、首頁 `refreshHomeHealth()` 系統工具卡同步，以及模型／runtime 缺件的任務阻擋與引導均已完成核對，round1 的兩項 resolver 阻擋與 fixture 缺口已解除，可交付本輪來源修正；本結論不代表真實 MediaTek patched runtime、約 3 GB checkpoint、模型品質、效能、Windows process tree 或 macOS／Windows 乾淨實機已驗收，亦不授權建立或替換公開 Release。」**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪測試只使用測試腳本管理的系統暫存目錄，未修改產品資料或 repo 外測試包。
- 若上述聲明不實，本報告無效。
