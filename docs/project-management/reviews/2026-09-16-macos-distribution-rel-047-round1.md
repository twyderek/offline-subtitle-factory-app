# REL-047 macOS DMG／ZIP 分發檔啟動驗收獨立審查（round1）

## 1. 需求完整性
- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-22` 將目標限定為既有 0.51.0 macOS arm64 DMG 唯讀掛載、ZIP 隔離解壓，並從兩條分發路徑內的 app executable 啟動既有 renderer smoke；成功條件包含隔離 userData、首頁／Electron bridge／設定、Breeze 選擇取消、手動 SRT、trim／post-trim、AI review asset、provider marker 與清理。`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:17-26` 與 `docs/project-management/evidence/2026-09-16-macos-distribution-live-rel-047.json:4-10,22-72` 對同一範圍、平台、結果與限制有一致記錄。
- 證據：不在範圍已明確排除重建封裝、Applications 安裝、真實 Anthropic／Ollama API、系統斷網、LM Studio、Windows、tag／公開 Release；`00-CURRENT-STATUS.md:22-27`、`04-DEVELOPMENT-HISTORY.md:28` 亦維持 0.51.0 開發中與跨平台／正式發布未完成的狀態。未將本次分發檔啟動驗收擴張為乾淨安裝、Gatekeeper／公證或 FR-021 整體驗收。

## 2. 邏輯正確性
- 判定：通過（限 REL-047 定義的分發檔內 packaged app smoke）
- 證據：`scripts/verify-electron-renderer.mjs:33-37` 為每次 smoke 建立隔離 userData 並以 executable 啟動；`61-75` 等待實際 Electron renderer target；`127-371` 依序檢查首頁／bridge／設定、Breeze modal、manual job、trim assets、AI review、glossary 與完整 8 provider registry；`264-311` 只有傳入 real trim media 時才執行 trim／post-trim branch，且 `372-377` 對 trim 完成、約 2 秒輸出、trimmed media 與 shifted subtitle 作硬性斷言。
- 證據：`scripts/verify-electron-renderer.mjs:381-394` 在 finally 關閉子程序並清理 smoke userData；證據 JSON 的 DMG flow `mountDetached=true`、ZIP flow `tempDirectoryCleaned=true`，兩者均記錄 `isolatedUserDataCleaned=true`（`2026-09-16-macos-distribution-live-rel-047.json:22-60`）。這與工作紀錄所述 DMG detach、ZIP trap 清理相符。
- 證據：本審查對候選 `../dist/test-build-0.51.0-macos-88da220/` 做靜態 `shasum -a 256 -c SHA256SUMS-macos-arm64.txt`，DMG、DMG blockmap、ZIP、ZIP blockmap 與 `latest-mac.yml` 均為 `OK`；實際 DMG／ZIP 大小分別為 242,726,077／249,959,846 bytes，與 `latest-mac.yml:3-8` 一致。這支持資產身份與 manifest 一致，但不把 checksum 當作啟動或安裝證據。

## 3. 邊界情況
- 判定：部分通過
- 證據：REL-047 已涵蓋兩種分發邊界：DMG 以唯讀 volume path 直接啟動（evidence `:23-40`），ZIP 以 `/private/tmp/<zip-smoke>/` 隔離解壓後直接啟動（` :42-59`）；兩條路徑均記錄 manual subtitle job、real trim、post-trim subtitle、AI review、8 provider marker 與隔離資料清理完成。
- 證據：candidate `PROVENANCE.txt:8-11`、`TEST-CANDIDATE-README.md:18-20` 與 `SIGNING-STATUS-macos-arm64.txt:1-3` 明確標示 local isolated testing only、ad-hoc、未提供 Developer ID／公證，以及乾淨安裝、Gatekeeper、Windows、跨平台、長音訊與真實 AI 未驗收；既有 REL-043／REL-046 報告（`docs/project-management/reviews/2026-08-27-rel-043-macos-test-candidate-round1.md:58-66`、`docs/project-management/reviews/2026-08-27-rel-046-macos-package-round1.md:45-50`）的範圍限制也未被本輪覆蓋或矛盾。
- 證據：本輪未重播 GUI／測試，依需求方指示只做檔案與文件靜態核對；DMG attach、ZIP 解壓、renderer smoke、detach／trap 的實際執行結果是主要代理以 `recordedAt=2026-09-16T07:55:40+08:00` 保存的原始 evidence（`evidence:3`、`22-60`）。因此本節對未獨立重播的環境／程序差異保留條件，不將其誤寫成另一組本審查實機結果。

## 4. 程式碼品質
- 判定：通過（限既有驗收 verifier 與候選封裝治理）
- 證據：verifier 的流程分支與驗收斷言集中且可追溯：隔離啟動與 target 等待（`scripts/verify-electron-renderer.mjs:33-75`）、UI／API 檢查（`127-262`）、real trim 可選分支（`264-311`）、清理與失敗後處置（`381-394`）。未見以靜態 marker 取代既有 renderer job／trim status 的硬性結果斷言。
- 證據：候選 `PROVENANCE.txt:1-11`、`TEST-CANDIDATE-README.md:12-22`、`SIGNING-STATUS-macos-arm64.txt:1-3` 將版本、來源 commit `88da220`、平台、簽章狀態、模型範圍與未驗收風險分開記錄；沒有把 ad-hoc 簽章稱作 Developer ID／公證，也沒有把測試包稱作公開 Release。這與 `docs/project-management/05-DEVELOPMENT-AND-DEPLOYMENT.md:46-58` 的 macOS 打包規則一致。

## 5. 測試覆蓋
- 判定：通過（限本輪 macOS arm64 DMG／ZIP 分發檔啟動範圍）
- 證據：主要代理記錄的開發驗證結果（`docs/project-management/08-CHANGE-LOG.md:16-20`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:18-24`）包含 DMG／ZIP SHA-256 manifest、`hdiutil verify` `VALID`、`unzip -t` `OK`、DMG 唯讀掛載後 executable smoke exit 0、ZIP 解壓後 executable smoke exit 0、real trim／post-trim、AI review 與清理；另記錄 `npm run check`、evidence JSON parse、`git diff --check` 均 exit 0。
- 證據：本審查僅重放靜態 checksum 指令，五項檔案皆為 `OK`；未重跑 `npm run check` 或 `verify-electron-renderer.mjs`，因需求方明確要求不要重跑 GUI 或測試。故測試覆蓋判定依可追溯的原始結果、verifier source contract 與 evidence contract，不把本審查宣稱為第二次動態測試。
- 證據：`scripts/verify-electron-renderer.mjs:347-380` 的失敗門檻涵蓋 UI 必要節點、manual job `201/202/completed`、cleaned SRT、trim output、review synchronization、8 provider IDs 與 folder flow；`evidence:28-58` 所記欄位與這些門檻相符。這些測試仍不涵蓋真實 AI、真正斷網、乾淨安裝、Gatekeeper／公證、Windows 或公開 Release。

## 6. 實際運行結果
- 判定：通過（依原始實機 evidence，限兩條分發路徑）
- 證據：`docs/project-management/evidence/2026-09-16-macos-distribution-live-rel-047.json:22-60` 分別記錄 `dmg-readonly-mounted` 與 `zip-extracted` 的 packaged executable path shape、唯讀／隔離條件、renderer smoke、trim／post-trim、AI review、8 provider definitions 及清理結果；`result` 為 `pass`（`evidence:68`）。
- 證據：`docs/project-management/08-CHANGE-LOG.md:16-20` 與 `06-TEST-AND-PROCESS-AUDIT.md:19-24` 對原始操作結果補充說明：DMG 最後 detach exit 0，ZIP trap 清理暫存目錄，兩條路徑均未安裝至 Applications。這足以支持「分發檔內 packaged app 在既有 macOS arm64 環境可啟動並通過限定 smoke」，不足以支持「安裝完成」或「公開可發布」。

## 綜合判定
- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 REL-047 macOS arm64 0.51.0 DMG 唯讀掛載與 ZIP 隔離解壓後的 packaged app 啟動驗收有條件通過：原始 evidence 與 verifier 驗收條件一致，兩條路徑均記錄 renderer／手動字幕／real trim／post-trim／AI review／8 provider marker 通過，DMG 已 detach、ZIP 暫存已清理，且 DMG／ZIP checksum、`hdiutil verify` 與 `unzip -t` 結果一致；本結論僅證明既有 macOS arm64 分發檔在既有環境可啟動並完成限定 smoke，不代表 Applications／乾淨安裝、Gatekeeper、Developer ID／公證、Windows、真正斷網、真實 AI、模型品質或 FR-021 整體驗收。**
- 阻擋問題（若有）：無本輪產品或資產阻擋問題。結案前仍須由主要代理將 REL-047 工作紀錄狀態、獨立審查報告路徑與逐字結論補齊，並依治理流程執行 `npm run docs:check:final`；這是文件結案條件，不是本輪分發檔 smoke 的失敗。
- 剩餘風險：本審查遵照指示未重跑 GUI／renderer smoke、`npm run check` 或發布操作；動態結果依主要代理於 `2026-09-16T07:55:40+08:00` 保存的原始 evidence，未取得第二次獨立重播的環境／程序差異證據。候選仍為 ad-hoc／未公證測試包，未驗收 Applications／乾淨帳號／Gatekeeper、真正斷網、真實 Anthropic／Ollama、模型品質、長音訊、Windows、跨平台或公開 Release。
- 給主要開發代理的具體修正要求（若有）：在不改寫本報告的前提下，將本報告路徑與上方完整結論逐字連結／引用至 REL-047 工作紀錄，將條目由「進行中」更新為與實際結案狀態一致，保留所有未涵蓋項目，然後執行 `npm run docs:check:final` 與 `git diff --check`。不得把本輪結果改寫成乾淨安裝、Gatekeeper／公證、Windows、真正斷網、真實 AI 或 FR-021 整體通過。

## 審查代理聲明
本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
