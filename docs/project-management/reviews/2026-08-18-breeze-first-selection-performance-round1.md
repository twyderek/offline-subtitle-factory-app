# 獨立審查報告：REL-037 Breeze 首次選擇流程與 Mac Air 效能發布依據

- 審查對象 commit／版本：`348d96b`（`codex/021-breeze-runtime-guide`）加上本輪尚未提交的 REL-037 工作樹差異；產品版本 `0.49.0`
- 對應 08-CHANGE-LOG 條目：2026-08-18 — Breeze 首次設定流程與 Mac Air 效能發布依據（REL-037）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-18 10:05（Asia/Taipei）；獨立上下文，依 `AGENTS.md`、release preflight 與 `docs/project-management/workflows/04-INDEPENDENT-REVIEW.md` 讀取及驗證，未沿用主要開發代理的評價性結論。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `public/index.html:216-220` 的選項已改為 `<option value="breeze-asr-25">Breeze ASR 25</option>`，選擇器本身不再帶「實驗性」字樣。
  - `public/app.js:856-861` 在選擇 Breeze 後呼叫 `ensureBreezeAsrReady()`；`public/app.js:799-830` 的流程會在模型缺失時開啟固定端點下載對話框，下載完成後在 runtime 缺失時開啟 runtime 指引，並保留切回 Whisper.cpp 的入口（`public/app.js:756-761`）。
  - `docs/BREEZE-ASR-25.md:15-17`、`RELEASE-NOTES-0.49.0.md:5,39`、`docs/project-management/00-CURRENT-STATUS.md:14` 已記錄首次設定流程與需求方提供的 Mac Air 效能觀察，且明確說明未作跨機型／品質驗收。
  - 但新增測試只做 source assertions（`scripts/test-breeze-asr.mjs:159-162`、`scripts/test-whisper-models.mjs:104-107`），沒有實際點擊選擇器並跑過「模型缺失→下載成功／取消→runtime 缺失→重查」的 renderer 流程；因此目前不能把需求宣稱為已完成實機 UI 驗收。

## 2. 邏輯正確性

- 判定：有條件通過
- 證據：
  - `ensureBreezeAsrReady()` 在下載完成後重新查詢 `/api/breeze-asr`，再依 `model.runtimeReady` 決定是否開啟 `openBreezeRuntimeInstallDialog()`（`public/app.js:799-830`），與既有提交前阻擋流程共用，避免在模型／runtime 缺件時啟動推論。
  - `openWhisperModelDownloadDialog()` 以 `POST` 開始、輪詢完成狀態，取消以 `DELETE` 結束（`public/app.js:594-643`）；既有 `scripts/test-whisper-model-download.mjs` 與完整回歸測試通過，下載取消清理契約仍在。
  - 首次選擇後，`public/app.js:843` 無論模型／runtime 是否已就緒，都把狀態文字重設為「首次選擇 Breeze ASR 25 會先協助下載模型，再引導設定 patched runtime。」。因此已就緒的使用者完成檢查後仍看不到「已就緒」狀態；API／runtime 重查成功也可能被同一段 UI 更新覆蓋。這是可見的 UX 不一致，需在發布前修正或補充明確成功狀態。
  - 選擇器 change handler 沒有 busy／重入鎖；快速重複選取 Breeze 可能同時發出多次 status request 或開啟多個對話框。尚未證明會造成資料損壞，但屬未覆蓋的互動邊界。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - focused Breeze 測試實際覆蓋模型缺檔、錯誤大小、mock 驗證、runtime probe 成功／timeout、標準 macOS／Windows venv 路徑及敏感輸出遮罩（`scripts/test-breeze-asr.mjs:50-144`）。
  - Whisper 模型測試實際覆蓋 tiny／base／small、manifest SHA／大小錯誤、缺檔與 `DELETE` 取消契約 marker（`scripts/test-whisper-models.mjs:38-128`）。
  - 但沒有 renderer 層的模型缺失、官方下載錯誤／中斷、使用者取消、runtime guide recheck 失敗／成功、快速連續切換或離線 API 失敗情境。這些應至少由隔離 browser／packaged renderer smoke 補上，否則發布結論只能限於 source／API contract。

## 4. 程式碼品質

- 判定：有條件通過
- 證據：
  - change handler 改為呼叫既有 readiness flow，避免複製一份模型／runtime 分支；UI、測試與 Breeze／治理文件同步，改動範圍小且 `git diff --check` 通過。
  - `scripts/test-breeze-asr.mjs` 與 `scripts/test-whisper-models.mjs` 的新增斷言可防止選項文字回退，也檢查首次選擇呼叫 readiness flow。
  - source regex 只證明文字與呼叫存在，不證明 DOM event 的執行順序或 modal promise 的實際生命週期；狀態文字覆蓋已就緒結果與缺少重入鎖，是目前品質上的主要待修項。

## 5. 測試覆蓋

- 判定：有條件通過
- 證據（執行時間 2026-08-18 10:05，Asia/Taipei）：
  - `npm run project:preflight -- --type=release`：通過，列出 release 固定核心及路由文件；確認工作樹包含本輪待審查修改。
  - `node --check public/app.js`、`node --check scripts/test-breeze-asr.mjs`、`node --check scripts/test-whisper-models.mjs`：通過。
  - `node scripts/test-breeze-asr.mjs`：通過（Breeze 模型契約、runtime probe、CLI 參數、路徑與 UI source assertions）。
  - `node scripts/test-whisper-models.mjs`：通過（Whisper 三模型模擬 runtime 與 Breeze 選項 marker）。
  - `npm run check`：通過；`docs:check`、所有 deterministic 回歸、`test-core.mjs`（含 Breeze API／mock job／取消）均通過。
  - `git diff --check`：通過。
  - `npm run docs:check:final`：未通過，因最新 `08-CHANGE-LOG.md` 仍為「進行中／待執行」，且獨立審查欄位尚未填入。這是結案前必須由主要代理補齊的治理門檻，不是可忽略的成功結果。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 以 `system_profiler SPHardwareDataType`／`sw_vers` 在本機查得：MacBook Air `Mac15,12`、Apple M3、8 GB、8 cores、macOS `26.5.2` Build `25F84`；此與治理文件記錄一致。未讀取或保存序號／硬體 UUID。
  - 目前本機沒有可供本審查重新執行的真實 MediaTek patched Whisper runtime、3 GB checkpoint、原始 1:46 音訊與 profiler artifact；「約 6 小時／約 3.4×」是需求方提供的單一本機觀察，不是本審查重新量測。文件對此限制的表述是正確且足夠保守的。
  - 本審查實際執行了 Node／API／deterministic mock 回歸，但未以 browser／Electron renderer 點擊 Breeze 選擇器或建立實際下載／runtime 導引 session；因此不能把「正常發布」或首次設定的真實 UI 執行結果寫成已驗收。

## 綜合判定

- 結論：有條件通過
- 阻擋問題：
  1. 在公開發布前，必須補做隔離 browser／packaged renderer 的實際 Breeze 首次選擇 smoke：模型缺失時開啟下載、取消／失敗不建立任務、完成後開啟 runtime 指引、runtime recheck 成功後顯示就緒，並檢查切回 Whisper.cpp。
  2. 修正 `public/app.js:843` 的狀態覆蓋，使已經完成模型／runtime 檢查的 Breeze 顯示明確「已就緒」，且為 change handler 增加至少一次進行中／重入保護或以測試證明重複選擇不會開多個流程。
  3. 目前工作樹的 package version 仍是 `0.49.0`，而公開 `v0.49.0` tag 已指向 `1f50b85c0599ef85c73f05085d70925d4d6b670a`；本分支 `348d96b` 不在該 tag 祖先線上。不得以同一版本覆寫既有公開 Release。正常發布前須由主要代理決定新的 patch 版本／候選版本，更新來源、資產與 Release notes，並完成封裝、SHA／metadata、下載核對。
  4. 結案前必須補齊 `08-CHANGE-LOG.md` 的實際修改、開發驗證、審查連結／逐字結論與發布結果，直到 `npm run docs:check:final` 通過。
- 剩餘風險：
  - Breeze 仍未由本審查覆蓋真實模型品質、長音訊、CPU／CUDA 效能、記憶體／溫度、取消／恢復、Windows／macOS 乾淨安裝與跨平台 runtime 行為。
  - Mac Air 的約 6 小時結果只有單一觀察，無 profiler／原始音訊／逐段 telemetry；可作發布警示，不可作跨機型倍率或即時性承諾。
  - 約 2.88 GiB checkpoint、Python、PyTorch 與 patched Whisper runtime 不在安裝包；下載與外部 runtime 安裝仍會受網路、Python／git／pip、磁碟與第三方 submodule 供應鏈影響。
  - 選單不顯示「實驗性」符合本輪 UI 要求，但 experimental／品質／效能限制仍須在說明、Release notes 與目前狀態保留，不能因 UI 文案變更而宣稱 Breeze 已達正式品質門檻。
- 給主要開發代理的具體修正要求：
  - 先調整 Breeze readiness 完成後的狀態顯示與重入處理，再新增實際 renderer smoke 或可重現的 DOM harness，覆蓋首次選擇成功／取消／失敗／runtime recheck 分支。
  - 依新的版本號建置隔離 macOS／Windows 候選（若要公開發布），核對封裝內 UI marker、Breeze checkpoint 排除、checksum、updater metadata 與實際下載 URL；不要移動或覆寫既有 `v0.49.0` 資產。
  - 補齊 REL-037 工作紀錄後重跑 `npm run docs:check:final`、`git diff --check` 及受影響回歸；若上述 blocker 仍存在，公開 Release 結論最高維持有條件／不通過。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
