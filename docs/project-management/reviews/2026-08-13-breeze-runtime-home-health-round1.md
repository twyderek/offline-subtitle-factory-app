# 獨立審查報告：Breeze macOS runtime 狀態與首頁健康卡修正（BUG-022）

- 審查對象 commit／版本：`codex/021-breeze-runtime-guide` commit `3e365b5162fecdf0a487c512a4d988b3b8b3d184` 上的 BUG-022 最新工作樹，產品版本 0.49.0
- 對應 08-CHANGE-LOG 條目：2026-08-13 — Breeze macOS runtime 狀態與首頁健康卡修正（BUG-022）（`docs/project-management/08-CHANGE-LOG.md:5`）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-13T16:03+08:00；獨立 debug 審查上下文，只依 debug preflight、最新工作樹差異、focused 負向案例與完整回歸判定
- 證據核對時間：2026-08-13T16:03–16:10+08:00

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `lib/breeze-runtime-probe.mjs:22-46` 新增 macOS `$HOME/Breeze-ASR-25/.venv/bin/python` 與 Windows home 下 `.venv/Scripts/python.exe` 候選；`server.mjs:339-369` 將同一 resolver 用於 `/api/health`、Breeze API 與 job runtime probe。
  - `public/app.js:416-438` 在 `refreshHomeHealth()` 成功取得 `/api/health` 後呼叫 `updateMetrics(tools)`，會同步 FFmpeg／ASR／Whisper／GPU 卡片，不再只更新首頁三個摘要欄位。
  - `public/app.js:799-830` 與 `server.mjs:1494-1541,1613-1621` 仍要求 `model.valid && runtimeReady`；模型或 runtime 缺件時回傳 `needs-action`／錯誤並附 guide，不啟動推論。
  - 但 Windows 標準路徑解析未在 `HOME` 與 `USERPROFILE` 同時存在時可靠使用 `USERPROFILE`，且普通 bundled Python 可遮蔽標準 patched Breeze venv，尚未完整滿足跨平台自動探測成功條件。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - `resolveBreezePython()` 先做 `env.HOME || env.USERPROFILE`（`lib/breeze-runtime-probe.mjs:24`）。本輪以 win32、同時提供不同的 `HOME`／`USERPROFILE`、只在 `USERPROFILE/Breeze-ASR-25/.venv/Scripts/python.exe` 建立 fixture，實際結果為 fallback `python`，而不是存在的 Windows 標準 runtime。
  - resolver 的 candidates 將 `toolsDir/python*` 放在 external standard venv 前（`lib/breeze-runtime-probe.mjs:38-44`）。本輪同時建立 `toolsDir/python/python` 與 `$HOME/Breeze-ASR-25/.venv/bin/python`，實際選到 generic bundled Python；普通 Python 不保證含 MediaTek patched Whisper，會把已安裝標準 runtime 誤報缺件。
  - `BREEZE_ASR_PYTHON` 的顯式覆寫位於所有自動候選之前（`:23,36`）；本輪負向 fixture 仍精確回傳 `/explicit/python`，此優先序正確。
  - `electron/main.mjs:418-472` 補上非 Windows generic Python 工具辨識，server child 又繼承 `process.env`（`:605-622`）；真正 Breeze resolver 位於 server，沒有自動安裝或執行 shell，但上述 resolver 順序會影響最終 probe。

## 3. 邊界情況

- 判定：不通過
- 證據：
  - 已通過：只有 macOS `HOME`、只有 Windows `USERPROFILE`、顯式 `BREEZE_ASR_PYTHON`、probe 成功、probe 逾時、stderr 隱私遮罩、模型無效／runtime 無效的安全阻擋。
  - 未通過且現有測試未覆蓋：win32 同時有 `HOME` 與 `USERPROFILE`；標準 patched venv 與 generic bundled Python 同時存在。兩個本輪 focused fixture 均重現錯誤選擇。
  - `scripts/test-breeze-asr.mjs:89-99` 只各自測單一 home 變數，且呼叫時沒有 `toolsDir`，因此雖然 focused suite 綠燈，無法證明真實候選優先序正確。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - 路徑解析集中於 `resolveBreezePython()`，顯式覆寫與存在性檢查清楚；server、Breeze API、health 與 job 共用同一 `toolPaths.breezePython`，避免各流程各自推導。
  - 修正沒有下載、安裝或執行第三方 setup；runtime probe 維持 `shell:false`、逾時清理、診斷遮罩，安全／隱私界線沒有退化（`lib/breeze-runtime-probe.mjs:49-85`）。
  - `03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md` 尚未加入 BUG-022 的路徑優先序、首頁卡片同步、根因／修正／測試與剩餘風險；依專案責任矩陣，中等 runtime／UI debug 變更在結案前必須同步這三份治理文件。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-08-13T16:08+08:00 獨立執行 `node --check`（probe/server/electron/app）、`node scripts/test-breeze-asr.mjs`，均通過；source assertion 也確認 `refreshHomeHealth()` 內呼叫 `updateMetrics(tools)`。
  - 第一次 sandbox 內 `npm run check` 在核心回歸因 `listen EPERM 0.0.0.0:22937` 停止；2026-08-13T16:09+08:00 以允許 loopback 的環境重跑完整 `npm run check` 通過，包含 docs、語法、Breeze、UI 與核心 API。`npm run docs:check` 與 `git diff --check` 亦通過。
  - 完整綠燈沒有涵蓋本輪重現的兩個 resolver 衝突條件；需新增「win32 HOME 與 USERPROFILE 不同」及「generic tools Python 與標準 Breeze venv 同時存在」的負向測試，才能防止相同假缺件回歸。

## 6. 實際運行結果

- 判定：部分通過（deterministic source/API 層級）
- 證據：
  - 完整核心測試證明 `/api/health`、Breeze catalog、模型狀態與任務安全阻擋沒有一般回歸；首頁 source flow 將同一 health tools 送入 `updateMetrics()`。
  - 本輪 deterministic 路徑 fixture 直接證明 macOS／Windows 單一標準 home 可解析，顯式覆寫有效；也直接證明兩個衝突邊界會選錯 command。
  - 未啟動真實 `$HOME/Breeze-ASR-25` patched runtime、未載入約 3 GB checkpoint、未以真實音訊轉錄，也未在 Windows／macOS 安裝版 GUI 實測首頁卡片；因此本項不能擴張成 runtime 或跨平台實機通過。

## 綜合判定

- 結論：不通過（限 BUG-022 本輪來源修正範圍）
- 阻擋問題（若有）：`lib/breeze-runtime-probe.mjs:24,38-44` 的自動候選優先序不完整：win32 應優先以 `USERPROFILE` 解析標準 Breeze venv，不應被不同的 `HOME` 遮蔽；在沒有 `BREEZE_ASR_PYTHON` 時，存在的標準 patched Breeze venv 應優先於 generic bundled／PATH Python。須補兩個衝突負向測試；並依責任矩陣同步 `03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md` 後進行 round2 複審。
- 剩餘風險：即使修正 resolver，真實 MediaTek patched runtime、Python／PyTorch、約 3 GB checkpoint、模型品質、CPU／CUDA 效能、長音訊、取消／失敗復原、Windows process tree、macOS／Windows 安裝版與乾淨使用者實機仍未驗收；自訂安裝路徑仍必須明確使用 `BREEZE_ASR_PYTHON`。
- 給主要開發代理的具體修正要求：平台別選擇 home（win32 優先 `USERPROFILE`，macOS／Unix 優先 `HOME`）；保留 `BREEZE_ASR_PYTHON` 為最高優先，但把標準 Breeze venv 排在 generic bundled／PATH Python 前；新增上述兩個衝突 fixture；同步三份 debug／design／audit 文件；重跑 focused、完整 `npm run check`、docs check、`git diff --check` 後提交 round2。
- 可逐字引用完整結論句：**「BUG-022 round1 獨立審查不通過：首頁 `refreshHomeHealth()` 已同步更新系統工具卡，`BREEZE_ASR_PYTHON` 明確覆寫與模型／runtime 缺件安全阻擋亦維持有效，但目前 win32 resolver 可能由 `HOME` 遮蔽 `USERPROFILE` 的標準 Breeze venv，且 generic bundled Python 會先於標準 patched Breeze runtime 被選中；修正平台 home 與候選優先序、補兩個衝突負向測試並同步功能設計／測試稽核／debug 紀錄後須進行 round2 複審，本結論不代表真實 Breeze runtime、checkpoint、模型品質、效能或跨平台實機已驗收。」**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪 focused fixture 只使用並清理系統暫存目錄，未修改產品資料或 repo 外測試包。
- 若上述聲明不實，本報告無效。
