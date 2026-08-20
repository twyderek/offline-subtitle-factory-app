# 獨立審查報告：Breeze 0.50 效能透明化與首次選擇提醒

- 審查對象 commit／版本：目前工作樹 `codex/0.50-breeze-hardening`／`0.50.0`；round2 修正後工作樹，尚未建立 commit
- 對應 08-CHANGE-LOG 條目：2026-08-20 — Breeze 0.50 效能透明化與首次設定強化（REL-039）
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-08-20（Asia/Taipei）；由獨立上下文重新執行受影響 focused test、`npm run docs:check` 與 `git diff --check`，並依 round2 變更重讀相關程式與治理 schema；未修改 round1／round2 或任何產品檔案。

## 1. 需求完整性

- 判定：通過
- 證據：FR-025（`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:41`）所要求的固定可追溯效能參考由 `lib/breeze-asr.mjs:22-30` 提供，`server.mjs:1106,3709-3717` 以 `model.performanceReference` 回傳；`public/index.html:217-218,235` 與 `public/app.js:846-890` 提供選取器外提示、Whisper.cpp 回退語意與乾淨 Breeze 產品名稱。`package.json:3`、`package-lock.json:3,9`、`public/index.html:69`、`public/app.js:1633` 同步 0.50.0 版本識別。

## 2. 邏輯正確性

- 判定：通過
- 證據：`public/app.js:846-856` 的 `updateBreezePerformanceNotice` 對 Breeze 顯示 API message，缺 reference 時使用保守 fallback，非 Breeze 時清空並隱藏；`public/app.js:865,868` 在 `updateAsrEngineUi` 內正確取得元素並呼叫 helper，已解除 round1 的未宣告 `performanceNotice` ReferenceError。`public/app.js:893-898` 的首次選擇 handler 可繼續進入 `ensureBreezeAsrReady()`。

## 3. 邊界情況

- 判定：通過
- 證據：2026-08-20 09:43:34 +0800 以 VM 執行 production helper，`reference=undefined` 得到含 Whisper.cpp 的 fallback、`element=null` 安全返回；`scripts/test-breeze-asr.mjs:174-185` 實測自訂 message 顯示及切回 `whisper-cpp` 後隱藏／清空。空模型 API smoke（隔離 cache）回傳 `model.valid=false`、`status="missing"` 但保留 `model.performanceReference`；固定資料只含硬體／日期／倍率／範圍，未含 secrets、原始音訊或 profiler。

## 4. 程式碼品質

- 判定：通過
- 證據：效能參考集中在 `BREEZE_ASR_PERFORMANCE_REFERENCE` 單一來源，server 不重複硬編數值；UI 提示 helper 具 null element、缺 reference 與切換引擎的明確行為。`scripts/test-breeze-asr.mjs:174-185` 新增 deterministic VM harness，補足 round1 只有 source marker 的缺口。非阻擋維護風險是 harness 仍未取代完整 Electron renderer，且 API refresh 失敗時既有提示可能短暫保留舊文字（`public/app.js:476-480`）。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-08-20 09:45:40 +0800 重跑 `node scripts/test-breeze-asr.mjs`、`node scripts/test-whisper-models.mjs`、`node --check lib/breeze-asr.mjs`、`node --check server.mjs`、`node --check public/app.js` 與 `git diff --check`，全部通過。先前 2026-08-20 09:42:09 +0800 受控權限 `npm run check` exit 0；2026-08-20 09:42:22 +0800 `node scripts/check-project-docs.mjs` 通過 19 文件／0.50.0。限制是本輪沒有重新建置 packaged Electron、Windows runner 或真實 MediaTek runtime／checkpoint。

## 6. 實際運行結果

- 判定：部分通過
- 證據：2026-08-20 09:42（+0800）隔離啟動 `PORT=19840 node server.mjs`，`curl -sS http://127.0.0.1:19840/api/breeze-asr` 實測 `ok:true`，空 cache 的 `model.performanceReference` 含 6360 秒、21600 秒、3.4×、MacBook Air Mac15,12／M3／8 GB、日期及「不是效能保證」訊息；server 隨後以 Ctrl-C 終止。VM helper 行為也已實際執行，但没有把 source／mock 證據擴張成跨平台安裝或真實 Breeze 轉錄通過。

## 綜合判定

- 結論：有條件通過
- 可逐字引用完整結論句：**本輪 REL-039 Breeze 0.50 round3 獨立複審結論為有條件通過：round1 的 performanceNotice 作用域錯誤已解除，API 的 model.performanceReference、單機效能揭露、Breeze 選項無 experimental 字樣、0.50.0 版本識別、Whisper.cpp 預設與首次 readiness path 均具備；focused 行為、Breeze／Whisper 測試、受控權限完整 npm run check、docs:check、git diff --check 與空模型 API smoke 通過，未發現本輪未處理阻擋，但真實 MediaTek runtime／模型品質／長音訊效能、雙平台 packaged／乾淨安裝與 0.50.0 Release 仍未驗收，因此本結論不代表公開發布或跨平台實機完成。**
- 阻擋問題（若有）：無本輪程式變更阻擋；round1 的 ReferenceError 已修正並由 focused 行為 harness 覆蓋。
- 剩餘風險：真實 patched Whisper runtime、3 GB checkpoint、台灣華語／中英混用品質、CPU／記憶體／取消／速度、macOS／Windows packaged 與乾淨安裝仍未驗收；3.4× 仍是單一 MacBook Air M3／8 GB 觀察，不是跨機型保證或效能改善承諾。0.50.0 尚未建立 tag、GitHub Release 或安裝資產。
- 給主要開發代理的具體修正要求（若有）：無需再修正本輪阻擋；將本報告路徑與上述完整結論句逐字連結至 REL-039 工作條目，完成 `docs:check:final`。若進入公開發布，先重建雙平台資產並重跑 packaged renderer／Windows CI，持續揭露真實 Breeze 與簽章／公證風險。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
