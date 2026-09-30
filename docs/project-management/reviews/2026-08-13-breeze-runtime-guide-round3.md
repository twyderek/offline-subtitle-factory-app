# 獨立審查報告：Breeze runtime 缺件提供可操作安裝指引（BUG-021）

- 審查對象 commit／版本：`codex/021-breeze-runtime-guide` 最新工作樹（基線 0.49.0；round2 clipboard 阻擋修正版）
- 對應 08-CHANGE-LOG 條目：2026-08-13 — Breeze runtime 缺件提供可操作安裝指引（BUG-021）（`docs/project-management/08-CHANGE-LOG.md:5`）
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-08-13T14:23+08:00；同一獨立審查角色的新回合，只依 round1／round2 阻擋、最新差異與 debug 路由重新驗證
- 證據核對時間：2026-08-13T14:23–14:27+08:00

## 1. 需求完整性

- 判定：通過（限 BUG-021 引導修正範圍）
- 證據：
  - runtime 缺件時，使用者可由模型下載 modal 或 ASR 欄位 persistent 入口開啟 guide，查看官方 repo／模型連結、macOS／Linux 與 Windows 指令、重新檢查及切回 Whisper.cpp。
  - round1 的 recursive submodule 與啟動 cwd 阻擋維持解除：setup 使用家目錄與 `git clone --recurse-submodules`；開發版及 macOS／Windows 安裝版命令明確分開（`lib/breeze-asr.mjs:33-63`）。
  - round2 的 clipboard 阻擋已解除：HTML 提供開發版與安裝版兩個獨立 code block／copy button（`public/index.html:508-520`），UI 分別填入與複製 `launchCommand`、`packagedLaunchCommand`（`public/app.js:699-705,721-735`）。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `launchCommand` 與 `packagedLaunchCommand` 均只包含可貼入對應 shell 的命令，不再混入未註解中文說明；macOS／Linux 以 `BREEZE_ASR_PYTHON=... <command>`，Windows 以 `$env:BREEZE_ASR_PYTHON=...; <command>` 在同一 process environment 啟動。
  - 本輪獨立讀取 guide 物件確認：兩平台開發版與安裝版 payload 分離；Unix payload 以 `BREEZE_ASR_PYTHON=` 開頭、Windows payload 以 `$env:BREEZE_ASR_PYTHON` 開頭。安裝版中的中文字元只屬實際產品 executable 路徑「離線字幕工廠」，不是說明文字。
  - `copyLaunchCommand` 精確複製開發版欄位，`copyPackagedLaunchCommand` 精確複製安裝版欄位；切換平台時兩個 code block 同時更新，不再有顯示／clipboard 分歧。
  - App 不在現行 process 內假更新 Python 路徑；說明要求以同一終端環境重新啟動 App，之後 `/api/breeze-asr?refresh=1` 才重新執行既有只讀能力探針。

## 3. 邊界情況

- 判定：通過（已測 deterministic 邊界）
- 證據：
  - 兩平台 setup 均含 recursive submodule、家目錄路徑與 venv；Unix 對 `python3.11` 缺失明確停止，PowerShell 使用 `Join-Path` 處理家目錄與安裝路徑。
  - 模型未下載、模型有效但 runtime 缺件、runtime 就緒、切回 Whisper.cpp、modal 關閉後 persistent 入口、clipboard API 失敗 fallback 及 recheck 仍失敗等 UI 路徑都有明確安全狀態，不會自動建立 Breeze 推論或執行 shell。
  - 安裝位置自訂、Windows portable、git／pip／網路錯誤與目的 repo 已存在仍需使用者調整或外部驗收；文件沒有把這些描述成已自動處理。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - 固定非秘密 guide 集中於 `breezeRuntimeInstallGuideDetails()`，API 不接收任意 URL／command；UI 使用 `textContent`，沒有 HTML injection 或 App 自動執行第三方命令。
  - 開發版與安裝版 display／copy 使用各自同一資料欄位，消除 round2 的重複組合分歧；listener 在 modal cleanup 時逐一解除（`public/app.js:679-693`）。
  - 官方文件、功能設計、測試稽核、debug history 與程式命令契約一致；不修改既有 Breeze 模型 pin、下載 SHA、runtime probe 或 Whisper.cpp 預設路徑。

## 5. 測試覆蓋

- 判定：通過（對 BUG-021 deterministic 範圍足夠）
- 證據：
  - 2026-08-13T14:25+08:00 獨立執行 `node --check lib/breeze-asr.mjs`、`node --check server.mjs`、`node --check public/app.js`、`node scripts/test-breeze-asr.mjs`、`node scripts/test-core.mjs` 與 `git diff --check`，均通過。
  - 2026-08-13T14:26+08:00 獨立執行 `npm run check` 完整通過，包含 docs、語法、Breeze、UI source、核心 API 與全專案 deterministic 回歸。
  - `scripts/test-breeze-asr.mjs:26-48` 精確覆蓋 recursive clone、家目錄、兩平台 command prefix、兩個安裝版 executable、開發版 payload 不含中文說明及錯誤 cwd 負向條件；`:119-129` 覆蓋 packaged code block／copy button 新 id。
  - `scripts/test-core.mjs` 驗證 `/api/breeze-asr` catalog/model 的固定 guide details 一致。未執行真實 pip／checkpoint 的限制已在測試稽核明列。

## 6. 實際運行結果

- 判定：通過（限 API／UI 資料流與 deterministic smoke）
- 證據：
  - 核心測試以隔離暫存資料與 loopback server 完成 Breeze guide API 讀取，未破壞任務建立、runtime probe 或既有核心流程。
  - 本輪直接重放四個 clipboard payload，確認開發版／安裝版分離、prefix 正確且無未註解說明；靜態 handler 核對顯示欄位與複製來源一一對應。
  - 沒有安裝真實 patched runtime、沒有下載 3 GB checkpoint、沒有用安裝版完成音訊轉錄；因此本項通過只代表 BUG-021 的引導資料流，不代表 Breeze 實際推論或跨平台實機通過。

## 安全／隱私核對

- 判定：通過（限 guide 邊界）
- 證據：guide 不含 API key、token、password 或 secret；App 不自動 clone、pip、下載任意 runtime 或執行 shell。官方連結是固定 HTTPS，外連沿用 Electron IPC 協定限制。
- 外部 repo／submodule／pip 未 pin 的供應鏈、Python／PyTorch 套件執行與網路下載仍需使用者在終端明確執行，保留為剩餘風險而非宣稱安全驗收完成。

## 文件與交付風險

- 判定：通過（可進行治理結案，不含公開發布）
- 證據：`docs/BREEZE-ASR-25.md`、`03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md` 與 `07-DEBUG-AND-FIX-HISTORY.md` 已同步 submodule、雙平台命令、App 不執行、測試邊界及未驗收風險。
- 本輪為中等級來源／UI 修正，不建立 tag、Release 或公開資產，發布授權不適用。主要代理仍須引用本報告完成最新工作紀錄，執行 final docs gate 後才可結案交付來源修正。

## 綜合判定

- 結論：通過
- 阻擋問題（若有）：無。
- 剩餘風險：真實 recursive clone／submodule／pip、Python／PyTorch 相容性、第三方供應鏈、3 GB checkpoint、macOS／Windows 安裝版與 PowerShell／shell、Windows portable／自訂安裝位置、音訊品質、CPU／CUDA 效能、長音訊、取消與 process tree 仍未驗收；本結論不得擴張成公開發布或真實 Breeze 品質／跨平台實機通過。
- 給主要開發代理的具體修正要求（若有）：無阻擋修正。請在工作紀錄逐字引用下列結論，補齊實際修改／驗證／round3 連結與剩餘風險，執行 `npm run docs:check:final`、`git diff --check` 後再提交。
- 可逐字引用完整結論句：**「BUG-021 round3 獨立審查通過：recursive submodule 安裝、家目錄 runtime、開發版與 macOS／Windows 安裝版啟動命令、兩組獨立 code block／clipboard payload、persistent 入口、API 與治理文件已完成核對，round1／round2 阻擋均解除，可交付本輪 Breeze runtime 缺件引導來源修正；本結論不代表真實 patched runtime、3 GB checkpoint、模型品質、效能或跨平台安裝實機已驗收，亦不授權建立或替換公開 Release。」**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
