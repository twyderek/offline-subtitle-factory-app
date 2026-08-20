# 獨立審查報告：Breeze 0.50 效能透明化與首次選擇提醒

- 審查對象 commit／版本：目前工作樹 `codex/0.50-breeze-hardening`／`0.50.0`，來源基準 `main@7829876`（本輪未建立 commit）
- 對應 08-CHANGE-LOG 條目：2026-08-20 — Breeze 0.50 效能透明化與首次設定強化（REL-039）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-20（Asia/Taipei）；由獨立上下文依 `npm run project:preflight -- --type=development` 讀取 `AGENTS.md`、專案管理入口、目前狀態、需求、功能設計、測試稽核與 development／validation／independent-review／closeout 路由；未沿用主要開發代理的測試結論作為本報告判定。

## 1. 需求完整性

- 判定：不通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:41` 定義 FR-025：API 固定效能參考、選取 Breeze 後於產品名稱外顯示低資源提醒、MacBook Air 參考值與 Whisper.cpp 回退建議，且不得宣稱跨機型保證或真實模型驗收。
  - `lib/breeze-asr.mjs:22-30` 已建立固定 `BREEZE_ASR_PERFORMANCE_REFERENCE`；`server.mjs:1106` 將其放入 model payload；`server.mjs:3709-3717` 的 route 實際回傳為 `/api/breeze-asr` 的 `model.performanceReference`。
  - 2026-08-20 09:22（約，+0800）以隔離資料目錄啟動本機 server，`curl -sS http://127.0.0.1:19839/api/breeze-asr` 實測得到 `model.performanceReference`，其中 `6360` 秒、`21600` 秒、`3.4`、Mac15,12／M3／8 GB、2026-08-18 與「非效能保證」訊息均存在。
  - `public/index.html:218,235` 已維持選項顯示為 `Breeze ASR 25`，並加入選擇器外獨立提示欄位；`public/app.js:860-861` 已改讀 `breezeAsrCatalog?.model?.performanceReference?.message`。但首次選擇流程在該 UI 函式內即被未宣告識別字阻擋，故 FR-025 的使用者可見驗收尚未完整達成。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - `public/app.js:483-512` 的 `updateWhisperModelUi()` 內宣告了區域變數 `const performanceNotice`；此識別字只在該函式作用域有效。
  - `public/app.js:847-861` 的 `updateAsrEngineUi()` 沒有宣告同名變數，卻在 `public/app.js:858` 直接執行 `if (performanceNotice) {`。因此在瀏覽器／Electron renderer 中，`engine === 'breeze-asr-25'` 時會拋出 `ReferenceError: performanceNotice is not defined`，在進入 `ensureBreezeAsrReady()` 前即中斷 `public/app.js:885-890` 的 Breeze change handler。
  - 這是實際的阻擋路徑：第一次選擇 Breeze 時不會可靠地開啟模型下載／runtime 協助，亦不能完成 0.49.1 已有的首次設定流程；`node --check public/app.js` 不會捕捉未宣告的執行期識別字。
  - `/api/breeze-asr` 的固定 payload 路徑本身正確；`model.performanceReference` 與 UI 讀取路徑一致，故 API 層不是本項阻擋。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 無模型邊界：隔離本機 API smoke 以空的 Breeze cache 實測回應 `model.valid=false`、`model.status="missing"`、`model.performanceReference` 存在；沒有下載或安裝外部 runtime。
  - 無 catalog／首次選擇邊界：`public/app.js:863-869` 有 `!breezeModel` 的可操作提示設計，但在進入該分支前，`public/app.js:858` 的未宣告 `performanceNotice` 會先拋錯，因此此邊界目前不能算 UI 實際通過。
  - 切回 Whisper.cpp：`public/app.js:878-881` 的 source path 會隱藏提示並呼叫既有 Whisper UI；但本輪未能以真實 renderer 操作證明因 Breeze 首次切換已被前述例外打斷，故僅列為靜態可見、未完成實機驗收。
  - 敏感資料：`BREEZE_ASR_PERFORMANCE_REFERENCE` 只含硬體描述、日期、秒數、倍率、範圍與產品訊息，未含 API key、token、原始音訊或 profiler；其 `scope` 明確寫出未保存 profiler／原始音訊。API response 另有既有 cache path 與固定官方 URL，本輪未新增秘密資料。
  - 未宣稱效能改善：`lib/breeze-asr.mjs:18-29`、`RELEASE-NOTES-0.50.0.md:9-18`、`docs/BREEZE-ASR-25.md:100` 均明示單機觀察、無 profiler／原始音訊及非跨機型保證，沒有把 0.50 宣稱為推論加速或真實模型品質驗收。

## 4. 程式碼品質

- 判定：不通過
- 證據：
  - 固定效能資料集中於 `lib/breeze-asr.mjs:22-30`，server 只轉送同一常數，避免 API／UI／文件各自硬編數值；這部分設計清楚且沒有秘密。
  - `public/app.js:487` 將提示元素查找放在 `updateWhisperModelUi()`，但新功能實際使用位置在另一個函式 `updateAsrEngineUi()`；同名區域變數作用域錯置造成 renderer runtime error。這不是格式或 lint 可見的小問題，而是主要使用路徑不可用的程式碼品質阻擋。
  - `scripts/test-breeze-asr.mjs:172` 只做 source regex，`scripts/test-whisper-models.mjs:106` 只驗證 marker，均未執行 `updateAsrEngineUi()` 的 Breeze 分支；現有測試契約因此沒有捕捉本項錯誤。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-08-20 09:24:45 +0800 執行：
    - `node scripts/test-breeze-asr.mjs`：通過。
    - `node scripts/test-whisper-models.mjs`：通過。
    - `node --check lib/breeze-asr.mjs`、`node --check server.mjs`、`node --check public/app.js`：通過。
    - `git diff --check`：通過。
  - 2026-08-20 09:25:33 +0800 以受控權限執行 `npm run check`：`docs:check`（19 個文件／0.50.0）、所有 deterministic 測試與 `test-core.mjs` 均通過，最終 exit 0；輸出包含 Breeze ASR、Whisper、核心 API、AI、校閱 UI 與取消／串流回歸通過。
  - 未受控 sandbox 的同一完整回歸曾因 `listen EPERM 0.0.0.0:22381` 中止；已在受控權限重跑成功，故不把環境限制當成產品失敗。
  - `npm run docs:check:final` 於本輪執行時 exit 1，原因是 REL-039 尚為進行中且最新工作紀錄仍含「待執行」；這與目前尚未結案的審查狀態一致，不是把文件誤報為已完成的證據。
  - 測試缺口：沒有一個現有 focused／完整測試實際載入 renderer 並選取 Breeze，因此未捕捉 `performanceNotice` 的 ReferenceError；需要修正後補上至少「無 catalog／模型下載 modal」、「模型已裝但 runtime 缺件」、「切回 Whisper.cpp」的實際 UI／renderer smoke。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 本輪以隔離資料目錄啟動 `PORT=19839 node server.mjs`（受控權限），實測 GET `/api/breeze-asr` 成功並回傳 `ok:true`、`model.performanceReference` 及固定數值；server log 記錄 `[api] GET /api/breeze-asr`。完成後以 Ctrl-C 終止測試 server，未留下專案檔變更。
  - 實際 package／Electron renderer 0.50.0 尚未在本輪重新建置；沒有把 source marker 或 mock 模型當作真實 Breeze runtime、模型品質、長音訊效能或跨平台安裝驗收。
  - 依 source-level execution path，renderer 選取 Breeze 會先在 `updateAsrEngineUi()` 讀取未宣告變數而失敗；因此本輪不能報告首次選擇 modal、下載取消、runtime 引導或切回 Whisper 的實際畫面通過。

## 綜合判定

- 結論：不通過
- 阻擋問題：
  1. `public/app.js:858` 在 `updateAsrEngineUi()` 使用未宣告的 `performanceNotice`；應在該函式內取得 `document.getElementById('breezePerformanceNotice')`（並清理錯置的區域宣告），再以 renderer 實際 smoke 驗證首次 Breeze 選擇、空 catalog／模型下載取消、runtime 缺件與切回 Whisper.cpp。
  2. 修正後需新增能執行 UI 行為的測試，不可只增加 regex marker；至少要讓測試在 Breeze change event 執行到 `ensureBreezeAsrReady()`，並驗證提示顯示／隱藏與 readiness flow。
- 剩餘風險：
  - 真實 MediaTek patched Whisper runtime、約 3 GB checkpoint、台灣華語／中英混用品質、長音訊 CPU／記憶體／取消、Windows／macOS 乾淨安裝與 packaged renderer 仍未在本輪驗收。
  - 固定 3.4× 只是單一 MacBook Air M3／8 GB 觀察，未保存 profiler／原始音訊，不代表跨機型保證或效能改善；提示仍不應改變排程或 preset。
  - 0.50.0 尚未建立 tag、GitHub Release 或安裝資產；`npm run docs:check:final` 必須待主要代理修正、測試、複審及補齊結案欄位後再執行。
- 給主要開發代理的具體修正要求：先修正 `performanceNotice` 作用域並以實際 renderer／等價 DOM harness 重放 Breeze change event；補上無 catalog、缺 runtime、切回 Whisper.cpp 與提示內容的行為測試；重跑 focused、受控權限完整 `npm run check`、`git diff --check` 與結案文件，再請同一審查角色建立 round2，不得覆寫本報告。

**完整結論句：本輪 REL-039 Breeze 0.50 獨立複審結論為不通過：`/api/breeze-asr` 的巢狀 `model.performanceReference`、固定 MacBook Air 單機觀察、獨立 UI 提示、0.50.0 版本識別、Whisper.cpp 預設與文件風險揭露均已具備，focused／受控權限完整回歸與 API smoke 也通過；但 `public/app.js:858` 在 `updateAsrEngineUi()` 使用未宣告的 `performanceNotice`，首次選擇 Breeze 會在 readiness flow 前拋出 ReferenceError，且現有測試只有 source marker 未涵蓋實際 UI 行為，因此修正作用域、補上 renderer 行為測試並完成 round2 前，不得判定 FR-025 或 0.50.0 開發完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
