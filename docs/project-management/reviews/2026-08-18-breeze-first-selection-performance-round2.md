# 獨立複審報告：REL-037 Breeze 首次選擇流程與 Mac Air 效能發布依據

- 審查對象 commit／版本：`348d96b`（`codex/021-breeze-runtime-guide`）加上 REL-037 round2 工作樹差異；產品版本 `0.49.0`
- 對應 08-CHANGE-LOG 條目：2026-08-18 — Breeze 首次設定流程與 Mac Air 效能發布依據（REL-037）
- 審查輪次：round2（複核 `docs/project-management/reviews/2026-08-18-breeze-first-selection-performance-round1.md` 所列 blocker）
- 審查代理啟動時間、上下文來源：2026-08-18 10:19（Asia/Taipei）；獨立上下文，僅讀取程式／文件並執行驗證，未修改產品或既有文件。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `public/index.html:216-220` 仍使用一般產品名稱 `<option value="breeze-asr-25">Breeze ASR 25</option>`，未把「實驗性」放入選擇器文字。
  - `public/app.js:875-880` 在首次切換 Breeze 時進入 readiness flow；`public/app.js:800-831` 覆蓋模型缺失下載、下載完成後 runtime 缺失指引及就緒判定；`public/app.js:756-761` 保留切回 Whisper.cpp。
  - `scripts/verify-electron-renderer.mjs:164-186,359` 已新增隔離 renderer 的 Breeze 選擇、等待模型下載 modal、取消並確認關閉、切回 Whisper.cpp 的 smoke 內容；這解除 round1 的「沒有測試腳本」缺口，但本輪尚未對新的候選封裝實際執行該腳本。
  - Mac Air 效能證據仍正確標示為需求方單一本機觀察：Mac15,12／Apple M3／8 GB／8 cores／macOS 26.5.2，1:46:00 約 6 小時（約 3.4×），沒有被誤述為品質或跨機型驗收（`docs/BREEZE-ASR-25.md:95-99`、`RELEASE-NOTES-0.49.0.md:39`）。

## 2. 邏輯正確性

- 判定：有條件通過
- 證據：
  - round1 指出的重入問題已由 `breezeReadinessPromise` 修正：`public/app.js:834-842` 讓同時進入的 callers 共用同一個 readiness Promise，並在完成／失敗後以 `finally` 清除；`scripts/test-breeze-asr.mjs:163` 亦加入 marker assertion。
  - round1 指出的就緒狀態覆蓋已修正：`public/app.js:853-864` 依 model 狀態顯示「首次協助」、「尚未安裝」、「缺 runtime」或「已就緒」，且 runtime guide 按鈕只在模型有效但 runtime 缺失時出現；`scripts/test-breeze-asr.mjs:164` 覆蓋明確已就緒文字。
  - 仍有一個未解除的錯誤狀態邊界：`refreshBreezeAsrStatus()` 在 API／網路失敗時（`public/app.js:467-477`）保留舊的 `breezeAsrCatalog`；若舊狀態曾是 ready，這次選取 Breeze 的 readiness refresh 失敗後，`public/app.js:853-864` 仍可能顯示「Breeze ASR 25 已就緒」，同時全域狀態顯示查詢失敗。這是可能的假成功 UI，公開發布前應清除 stale catalog 或在 refresh 失敗時顯示不可確認狀態。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - `breezeReadinessPromise` 已處理快速重複選擇／提交共享流程；完整 `test-core.mjs` 仍覆蓋 Breeze mock job、完成、取消與 force-cancel。
  - `scripts/verify-electron-renderer.mjs:170-185` 實際 smoke expression 覆蓋模型下載 modal 開啟及取消關閉，但只覆蓋 source script，尚未對本輪新封裝執行；也沒有覆蓋 runtime modal 的成功／失敗 recheck、模型下載失敗、離線 API 失敗或 stale catalog。
  - 因此 round1 的實際 renderer 執行條件尚未解除；新增 smoke code 使條件可執行，但不能把未執行的 script marker 當成 packaged UI 通過證據。

## 4. 程式碼品質

- 判定：有條件通過
- 證據：
  - readiness flow 由 `ensureBreezeAsrReadyInternal()` 與一層共享 Promise wrapper 組成，沒有複製下載／runtime 分支；重入保護的清理使用 `finally`，可避免 rejected promise 永久卡住。
  - UI 狀態判定集中於 `updateAsrEngineUi()`，選項文字、實作與測試 marker 已同步；`node --check public/app.js`、`node --check scripts/verify-electron-renderer.mjs` 通過。
  - stale catalog 的錯誤狀態仍須處理；此外 smoke script 目前只 assert modal open／close，沒有對實際 status 或任務未建立做更深斷言，品質門檻仍限於條件通過。

## 5. 測試覆蓋

- 判定：有條件通過
- 證據（執行時間 2026-08-18 10:19，Asia/Taipei）：
  - `node --check public/app.js`、`node --check scripts/test-breeze-asr.mjs`、`node --check scripts/verify-electron-renderer.mjs`：通過。
  - `node scripts/test-breeze-asr.mjs`、`node scripts/test-whisper-models.mjs`：通過；新增選項文字、首次 readiness、Promise 重入 marker 與已就緒文字 assertions 通過。
  - `git diff --check`：通過。
  - 受 sandbox socket 限制的第一次 `npm run check` 在 `test-core.mjs` 以 `listen EPERM` 終止；依規範以受控權限重跑同一命令成功，`docs:check`、全套 deterministic tests、Breeze mock API／job／取消與 core regression 全部通過。
  - `npm run docs:check:final`：仍未通過；最新 `08-CHANGE-LOG.md` 仍為「進行中／待執行」，獨立審查欄位尚未補 round2 結論。這是結案前治理條件。
  - `scripts/verify-electron-renderer.mjs` 的新增 smoke 只完成靜態／語法核對；沒有成功執行新的 macOS arm64／Windows 候選封裝，故仍不能宣稱 renderer 首次選擇已實跑。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 本輪實際完成 focused Node、deterministic API／mock 與受控完整 `npm run check`；沒有下載真實 Breeze checkpoint 或執行 MediaTek patched Whisper runtime，因此沒有新增模型品質／效能證據。
  - 已核對本機 `system_profiler SPHardwareDataType`／`sw_vers`：MacBook Air `Mac15,12`、Apple M3、8 GB、8 cores、macOS `26.5.2` Build `25F84`；未保存序號或硬體 UUID。約 6 小時的 1:46:00 觀察仍是需求方提供，不是本輪重新量測。
  - 既有 `../dist/test-build-c5e8bbe/` 是較早 `c5e8bbe` 來源的 0.49.0 測試包，不包含本輪 REL-037 UI 差異；本輪未將其冒充為新版本 smoke 證據，也未對新的來源候選進行封裝 smoke。

## 綜合判定

- 結論：有條件通過
- round1 blocker 解除狀態：
  - **已解除**：Breeze readiness 快速重入保護（`breezeReadinessPromise`）及已就緒／缺 runtime／未安裝的 UI 狀態覆蓋；對應 source assertions 與完整回歸通過。
  - **已補測試腳本但尚未解除執行條件**：隔離 renderer Breeze 首次選擇下載 modal 開啟／取消／關閉 smoke 已加入 `scripts/verify-electron-renderer.mjs`，但尚未在本輪新候選封裝上實跑。
  - **未解除**：版本／封裝條件與文件結案條件。
- 阻擋問題：
  1. 修正 refresh 失敗時的 stale `breezeAsrCatalog` 假成功狀態，或補充等價的可驗證錯誤狀態測試；不能在 API 不可達時顯示 Breeze 已就緒。
  2. 以包含本輪來源差異的 macOS／Windows 候選執行 `scripts/verify-electron-renderer.mjs`（至少 macOS arm64，若宣稱雙平台則兩平台），保存實際輸出；目前只有 smoke code，沒有 packaged run 結果。
  3. `package.json` 仍為 `0.49.0`，公開 `v0.49.0` tag／Release 已存在且 tag commit 為 `1f50b85c0599ef85c73f05085d70925d4d6b670a`；不得以同一版本覆寫既有資產。正常發布前須決定新的 patch 版本、重新封裝並核對 DMG／ZIP／Setup／Portable、SHA、updater metadata、封裝 marker 與下載 URL。
  4. 補齊 REL-037 `08-CHANGE-LOG.md` 的實際修改、驗證、round1／round2 報告連結與逐字結論；重跑 `npm run docs:check:final` 直到通過。
- 剩餘風險：
  - 未驗證真實 Breeze 模型品質、長音訊、CPU／CUDA 效能、記憶體／溫度、取消／恢復、Windows／macOS 乾淨安裝與跨平台 runtime 行為。
  - Mac Air 約 6 小時結果是單一本機觀察，無 profiler／原始音訊／逐段 telemetry；只可作發布警示，不可作跨機型倍率或即時性承諾。
  - 約 2.88 GiB checkpoint、Python、PyTorch 與 patched Whisper runtime 不隨安裝包提供；第三方 runtime、網路、git／pip、磁碟與 submodule 仍是使用前置條件。
  - 選單移除「實驗性」字樣不等於 Breeze 已達正式品質門檻；experimental／品質／效能限制仍須留在說明、Release notes 與目前狀態。
- 給主要開發代理的具體修正要求：
  - 先修 stale catalog failure state 並補對應 focused assertion。
  - 完成新版本候選封裝後，執行並保存 renderer smoke 實際結果；不要使用 `c5e8bbe` 舊候選替代本輪來源。
  - 完成 `08-CHANGE-LOG.md` 與版本／封裝／SHA／metadata 結案，通過 `npm run docs:check:final` 後，若要公開發布再依授權逐項核對。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
