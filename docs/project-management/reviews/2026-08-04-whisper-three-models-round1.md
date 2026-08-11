# 獨立審查報告：Whisper 三模型可選模式與模擬 runtime 驗證

- 審查對象 commit／版本：工作樹現行 0.48.0（本輪 FR-022 變更，未指定獨立 commit）
- 對應 08-CHANGE-LOG 條目：2026-08-04 — Whisper 三模型可選模式與模擬 runtime 驗證
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-04 16:35 +08:00；獨立讀取 preflight 列出的治理、需求、設計、測試與審查流程文件，未沿用主要開發代理的評價性結論。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:38` 定義 FR-022 的 `tiny`／`base`／`small` 白名單、任務保存、缺失／大小／SHA 拒絕、SRT／JSON quality metadata／取消／fallback 共用契約；`lib/whisper-models.mjs:5-27` 定義三模型與最小大小，`:29-44` 定義 tiny 預設及 multilingual／ggml alias；`public/index.html:222-228` 提供三個 select option。`docs/project-management/08-CHANGE-LOG.md:55-61` 明確把本輪限於 mock 與 runtime／UI 契約，不宣稱實際 base／small 品質或跨平台實機驗收。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：`server.mjs:829-835` 建立任務時以 `normalizeWhisperModelName` 保存正規化值；`lib/whisper-models.mjs:40-44` 使空值、未知值與舊 alias 回到 tiny，保留舊任務相容。`server.mjs:1440-1448` 在真正 spawn 前檢查所選模型存在、最小大小及 manifest size／SHA，失敗即回傳可採取行動錯誤；`:1480-1487` 將經驗證的模型路徑傳入 whisper.cpp。`write-runtime-manifest.mjs:51-60,84` 只對存在的 optional model 建立 `files.models` hash，`verify-runtime-package.mjs:107-114` 對 manifest 已列出的 base／small 驗證檔案與 SHA。邏輯可避免缺檔假成功，但目前測試未直接重放 too-small／hash-mismatch 失敗分支。

## 3. 邊界情況

- 判定：部分通過
- 證據：`scripts/test-whisper-models.mjs:31-35` 覆蓋空值、alias、未知 `large-v3` 回 tiny；`:37-70` 逐一以 `allowMock: true` 建立 tiny／base／small，驗證模型路徑、`--no-gpu`、SRT、JSON 與 quality fields；`:72-76` 驗證 base 缺檔為 `valid:false`／`reason:'missing'`。`allowMock` 只在測試呼叫（`:42-46`），production server 未繞過大小檢查。尚缺明確的 too-small、SHA mismatch、manifest size mismatch、取消與 Metal→CPU fallback 的三模型專項案例；這些仍由 production code／既有 fallback tests 分層覆蓋，不能視為本輪三模型 mock 已完全證明。

## 4. 程式碼品質

- 判定：通過
- 證據：模型定義、正規化、manifest 檢查與 CLI args 集中於 `lib/whisper-models.mjs`；server 只消費 helper，不接受任意使用者路徑（`lib/whisper-models.mjs:59-64`）。UI 以固定 `<select>` 而非自由文字輸入（`public/index.html:222-228`），`public/app.js:1233-1239` 載入舊／非法值時回 tiny，`:1287-1295` 新專案也重置 tiny。`git status` 顯示工作樹另有先前 AI／治理變更；本輪未見把既有檔案刪除或覆寫的額外操作，FR-022 相關差異集中於預期 server、UI、runtime、測試與文件檔案。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-08-04 16:35 +08:00 執行 `node scripts/test-whisper-models.mjs` 通過；該測試的 mock runner 實際寫出 `${outputBase}.srt`／`${outputBase}.json`（`scripts/test-whisper-models.mjs:19-28`），主測試讀取兩者並呼叫 `parseWhisperQualityJson`、斷言開始／結束與 no-speech（`:61-69`）。同時執行 `npm run runtime:verify -- --target=win32-x64`、`npm run runtime:verify:mac`、`npm run docs:check` 與 `git diff --check` 均通過；受控權限執行 `npm run check` 於同日通過，包含 `test-core.mjs:416-426` 對三個 modelName 建立任務並檢查 job-config 保存。未覆蓋實際 base／small 權重、UI 瀏覽器互動、Windows／macOS 乾淨安裝與長音訊。

## 6. 實際運行結果

- 判定：部分通過
- 證據：runtime verify 實際輸出 `OK: win32-x64` 與 `OK: darwin-arm64`，目前兩份 manifest 的 `files.models` 僅列 `tiny`，tiny size／SHA 通過；這確認既有 runtime 沒有假裝包含 base／small。mock runner 逐模型實際產生並解析 SRT／JSON／quality metadata，並以缺檔模型拒絕收尾。完整 `npm run check`（受控權限）輸出所有測試通過；但沒有下載或執行 base／small 真實權重，亦沒有 Windows／macOS 安裝後或中文準確率實測。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無本輪程式碼級阻擋；FR-022 的實際 base／small 權重、跨平台安裝後 smoke 與模型品質仍未驗收。
- 剩餘風險：三模型專項測試尚未直接斷言 too-small／SHA／manifest-size mismatch；UI select 目前以靜態檢查與核心保存測試為主，未有瀏覽器互動證據；取消／Metal fallback 與長音訊仍是既有分層風險。
- 給主要開發代理的具體修正要求：保留 production `allowMock` 不可用界線與缺檔失敗行為；後續補 deterministic size／SHA／manifest mismatch 及 UI model-status interaction cases，並在取得 base／small 資產後重跑 Windows／macOS 實機、取消／fallback、quality metadata 與模型品質驗收。
- 可逐字引用完整結論句：**本輪 FR-022 Whisper 三模型可選模式與模擬 runtime 驗證結論為有條件通過：tiny／base／small 白名單、舊 alias／空值回 tiny、任務保存、固定 UI select、optional manifest hash、缺檔拒絕及 mock runner 的 SRT／JSON／quality metadata 契約均有程式與測試證據，且 runtime／完整回歸驗證通過；但未執行實際 base／small 權重、跨平台安裝後 smoke 或模型品質驗收，too-small／SHA mismatch 與 UI 互動亦需後續補強，不得將本輪 mock 結果視為三模型實機通過。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
