# 獨立審查報告：Breeze 0.50 效能透明化與首次選擇提醒

- 審查對象 commit／版本：目前工作樹 `codex/0.50-breeze-hardening`／`0.50.0`；round1 阻擋修正後工作樹，尚未建立 commit
- 對應 08-CHANGE-LOG 條目：2026-08-20 — Breeze 0.50 效能透明化與首次設定強化（REL-039）
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-08-20（Asia/Taipei）；由獨立上下文重新執行 development preflight，讀取 `AGENTS.md`、專案管理入口、目前狀態、FR-025／功能設計、測試稽核與 development／validation／independent-review／closeout 路由；保留並參照 round1 原文，但未以主要代理摘要取代本輪實測。

## 1. 需求完整性

- 判定：通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:41` 的 FR-025 要求固定可追溯的 Breeze 效能參考、選取後獨立提醒、MacBook Air 參考值與 Whisper.cpp 回退建議，且不得宣稱跨機型保證或真實模型驗收。
  - `lib/breeze-asr.mjs:22-30` 將秒數、倍率、硬體、日期、範圍與不保證訊息集中為 `BREEZE_ASR_PERFORMANCE_REFERENCE`；`server.mjs:1106` 以同一常數回傳；`server.mjs:3709-3717` 的實際 API shape 為 `model.performanceReference`。
  - `public/index.html:217-218,235` 維持 `Whisper.cpp` 為 selected 預設、Breeze 選項為乾淨的 `Breeze ASR 25`，並將提示置於選擇器外的 `breezePerformanceNotice`；`public/app.js:846-855,858-880` 以共用 helper 顯示 Breeze 參考並在 Whisper／manual 隱藏。
  - `package.json:3`、`package-lock.json:3,9`、`public/index.html:69`、`public/app.js:1633` 與 0.50.0 文件均同步版本識別；沒有把 0.50.0 說成公開 Release。
  - round1 的 `performanceNotice` 未宣告阻擋已修正：`public/app.js:865` 現在在 `updateAsrEngineUi()` 內正確取得元素，`public/app.js:868` 再呼叫 helper。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `updateBreezePerformanceNotice()`（`public/app.js:846-856`）對 Breeze 顯示 API reference message；缺少 `reference` 時使用不宣稱保證的保守 fallback；非 Breeze 時清空文字並隱藏元素；元素不存在時安全返回。
  - `updateAsrEngineUi()`（`public/app.js:858-890`）先更新提示，再按 Breeze／manual／Whisper 分支更新狀態、下載按鈕與 runtime 指引；`public/app.js:893-898` 的 change handler 現在可以越過提示更新並呼叫 `ensureBreezeAsrReady()`，不再被 round1 的 `ReferenceError` 阻斷。
  - `public/app.js:468-480` 在成功取得 catalog 後同步刷新 UI；`public/app.js:802-833` 仍先查詢模型、缺模型才進固定下載、缺 runtime 才開指引，不會因效能提示改變任務排程或 preset。
  - 2026-08-20 09:43:34 +0800 以 VM 執行同一個 production helper：缺少 catalog reference 時得到包含「Whisper.cpp」的保守提示，null element 不拋錯；2026-08-20 09:41:57 +0800 的 focused test harness 另驗證自訂 message 顯示與切回 Whisper 隱藏。

## 3. 邊界情況

- 判定：通過（本輪範圍）
- 證據：
  - 無 catalog／缺 reference：VM 行為測試以 `reference=undefined` 實測顯示 generic Breeze 低資源警語與 Whisper.cpp 回退建議；沒有把缺 API 狀態誤當成固定 3.4× 證據。
  - null DOM element：同一 VM 測試以 `element=null` 實測安全返回，不拋例外。
  - 切回 Whisper.cpp：`scripts/test-breeze-asr.mjs:180-185` 執行 helper，確認選 Breeze 顯示自訂 message、切回 `whisper-cpp` 後 `hidden=true` 且 `textContent=''`；`public/index.html:217` 仍確認 Whisper.cpp selected。
  - manual：`public/app.js:881-885` 保持提示、下載與 runtime guide 隱藏並顯示手動 SRT 狀態。
  - 敏感資料：`BREEZE_ASR_PERFORMANCE_REFERENCE` 只有硬體／日期／倍率／範圍／產品訊息，明確標示未保存 profiler／原始音訊；未新增 API key、token、原始音訊或 profiler payload。API smoke 的既有 cache path 與固定官方 URL 未被效能功能擴張。
  - 未宣稱效能改善：`RELEASE-NOTES-0.50.0.md:9-18`、`README.md:3-8`、`docs/BREEZE-ASR-25.md:100` 都維持單機觀察、非跨機型保證、非真實模型品質／效能驗收及 Whisper.cpp 回退界線。

## 4. 程式碼品質

- 判定：通過（本輪變更）
- 證據：
  - round1 指出的作用域錯誤已以獨立 helper 修正，提示元素只在 `updateAsrEngineUi()` 取得並集中處理；不再依賴另一函式的區域變數。
  - 固定資料由 `lib/breeze-asr.mjs` 單一來源提供，server 不重複硬編效能數值；UI fallback 仍是保守提醒，不會默默調整 preset 或任務設定。
  - `scripts/test-breeze-asr.mjs:174-185` 的 VM harness 讓提示顯示／隱藏與 fallback 行為可 deterministic 重放；這比 round1 的 source marker 更能捕捉作用域與 DOM-like 行為。
  - 非阻擋維護風險：harness 仍以 source extraction 驗證 helper，並未取代完整瀏覽器／Electron renderer；`refreshBreezeAsrStatus()` 的失敗 catch（`public/app.js:476-480`）清空 catalog 但未再次呼叫 UI refresh，若已存在舊提示可能短暫保留，建議後續補上失敗狀態畫面測試。

## 5. 測試覆蓋

- 判定：有條件通過
- 證據：
  - 2026-08-20 09:41:57 +0800 執行 focused：`node scripts/test-breeze-asr.mjs`、`node scripts/test-whisper-models.mjs`、`node --check lib/breeze-asr.mjs`、`node --check server.mjs`、`node --check public/app.js` 及 `git diff --check`，全部通過；Breeze 輸出包含「模型契約、runtime 探針與 CLI 參數測試通過」，Whisper 輸出包含三模型與缺檔邊界通過。
  - 2026-08-20 09:42:09 +0800 以受控權限執行 `npm run check`，exit 0；`docs:check` 顯示 19 個文件／版本 0.50.0，完整 `npm test` 包含 Breeze、Whisper、核心 API、AI、校閱 UI、取消／串流等回歸均通過。
  - 2026-08-20 09:42:22 +0800 執行 `node scripts/check-project-docs.mjs` 與 `git diff --check`，均通過。
  - 2026-08-20 09:43:34 +0800 額外執行 production helper 的 VM fallback／null element 邊界，輸出 `missingCatalogFallback` 含 Whisper.cpp 且 `nullElementSafe:true`。
  - 測試限制：完整回歸使用 deterministic／mock 與本機 API fixture；沒有在本輪重新建置 0.50.0 macOS／Windows 包，也沒有在真實 MediaTek runtime／3 GB checkpoint 上做品質或長音訊效能測試。

## 6. 實際運行結果

- 判定：有條件通過
- 證據：
  - 2026-08-20 09:42（+0800）以隔離 `OFFLINE_SUBTITLE_DATA_DIR`／`OFFLINE_SUBTITLE_SETTINGS_DIR`、`PORT=19840` 啟動 `node server.mjs`，再以 `curl -sS http://127.0.0.1:19840/api/breeze-asr` 實測 `ok:true`；空 cache 回應 `model.valid=false`、`model.status="missing"`，且 `model.performanceReference` 含 `6360`、`21600`、`3.4`、MacBook Air Mac15,12／M3／8 GB、日期與「不是效能保證」訊息。測試 server 之後以 Ctrl-C 終止。
  - 2026-08-20 09:41:57 的 focused VM harness 實際執行提示顯示／自訂文字／切回 Whisper 隱藏；未把 source marker 當成 renderer 全流程通過。
  - 沒有重新執行 Electron packaged renderer 或 Windows runner；因此本輪只確認 source／DOM-like 行為與本機 API，不能擴張成跨平台安裝或真實 Breeze 轉錄通過。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無本輪 REL-039 程式變更阻擋；round1 的未宣告 `performanceNotice` 已解除，focused、受控權限完整回歸、文件檢查、API smoke 與邊界 harness 均通過。
- 剩餘風險：
  - 尚未在真實 MediaTek patched Whisper runtime、3 GB checkpoint、台灣華語／中英混用音訊與長音訊上驗證品質、CPU／記憶體／取消／速度；固定 3.4× 仍只是單一 MacBook Air M3／8 GB 觀察。
  - 尚未重新建置或實際操作 0.50.0 packaged Electron、Windows Setup／Portable、macOS 安裝版與乾淨使用者資料；本輪不能宣稱跨平台實機驗收。
  - `/api/breeze-asr` 失敗後既有提示可能短暫維持舊文字；未阻擋正常成功路徑，但發布前可補 UI failure refresh 與 packaged renderer smoke。
  - 0.50.0 尚未建立 tag、GitHub Release 或安裝資產；本輪結論不構成發布授權。
- 給主要開發代理的具體修正要求（若有）：無需再修正本輪阻擋；將本報告與逐字完整結論句連結至 REL-039 工作條目，完成 `docs:check:final` 結案。若要公開發布，先重建雙平台資產並重跑 packaged renderer／Windows CI，持續揭露真實 Breeze runtime、模型品質、效能、簽章／公證與跨平台實機缺口。

**完整結論句：本輪 REL-039 Breeze 0.50 round2 獨立複審結論為有條件通過：round1 指出的 `performanceNotice` 未宣告錯誤已由 `updateBreezePerformanceNotice` 與正確作用域修正，API 的 `model.performanceReference`、單機效能揭露、Breeze 選項無 experimental 字樣、0.50.0 版本識別、Whisper.cpp 預設與首次 readiness path 均具備；focused VM 行為、Breeze／Whisper focused、受控權限完整 `npm run check`、文件檢查、`git diff --check` 與空模型 API smoke 全部通過，未發現本輪未處理阻擋，但真實 MediaTek runtime／模型品質／長音訊效能、雙平台 packaged／乾淨安裝與 0.50.0 Release 仍未驗收，因此本結論不代表公開發布或跨平台實機完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
