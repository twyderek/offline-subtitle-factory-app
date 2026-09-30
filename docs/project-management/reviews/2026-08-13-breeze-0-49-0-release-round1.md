# 獨立審查報告：Breeze 0.49.0 第一版發布候選（REL-030）

- 審查對象 commit／版本：`ba05034b53a4551a53202a829f70b125fafbfc3a`／`0.49.0`；四項候選資產來源 commit 為 `0205548`，`0205548..ba05034` 僅變更三份發布證據文件。
- 對應 08-CHANGE-LOG 條目：2026-08-13 — Breeze ASR 25 第一版發布推進（REL-030）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-13 08:44 CST；獨立子代理上下文，只接收審查範圍、候選 SHA、主要代理所報測試結果與已知缺口，未沿用主要開發代理對話記憶或其評價性結論。
- 審查環境：macOS arm64、分支 `codex/breeze-first-release`；本輪不重建、不執行長時間完整回歸，只做唯讀快速重驗。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `package.json:3`、`package-lock.json:3,9` 均為 `0.49.0`；`RELEASE-NOTES-0.49.0.md:5-17` 清楚區分內建 Whisper.cpp 與外部 Breeze checkpoint／Python／PyTorch／patched runtime，`RELEASE-NOTES-0.49.0.md:30-38` 揭露未簽章、未公證、未做真實音訊／長音訊／效能／Windows process tree／兩平台安裝後驗收。
  - `docs/project-management/08-CHANGE-LOG.md:27-31` 定義完整回歸、audit、雙平台封裝、資產／metadata／checksum、獨立審查、PR 與公開 Release 成功條件；`docs/project-management/08-CHANGE-LOG.md:41-42` 明載分支尚未推送，PR／tag／Release／發布後下載核對均未完成。
  - 2026-08-13 08:44:36 CST 執行 `git diff --name-status origin/main...HEAD`，確認候選差異為 Breeze probe／process cleanup／測試、0.49.0 版本、workflow、Release notes、說明與治理證據，未直接使用落後主線的舊分支。
  - 發布授權只部分完整：`docs/project-management/09-STANDING-AUTHORIZATIONS.md:5-14` 的 `AUTH-2026-07-23-01` 僅接受 Windows 未 Authenticode 與 macOS 未 Developer ID 簽章／公證，並在第 13 行明確排除未完成實機測試與其他未明示風險；`docs/project-management/08-CHANGE-LOG.md:36-42` 也確認真實 Breeze／效能／Windows process tree／兩平台實機缺口尚未被接受。
  - 因此本機候選與 PR 輸入已具備，但公開 Release 的完整需求、外部操作與風險授權尚未完成。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - 2026-08-13 08:45:49 CST 執行 `node scripts/test-breeze-asr.mjs`，模型契約、runtime 探針與 CLI 參數測試通過；同時執行 `npm run probe:breeze -- --json`，在 checkpoint 與 `whisper` module 缺失時回報 `installed:false`、`runtime.ok:false`、`ready:false` 並以 exit 1 結束，符合「缺件不得假成功」契約。
  - `lib/breeze-runtime-probe.mjs:1-87` 採 `spawn(..., shell:false)`、timeout、POSIX process-group／Windows `taskkill /T /F`、等待 child `close` 與診斷遮罩；`scripts/test-breeze-asr.mjs` 覆蓋正常、timeout、缺件、任意診斷省略及 quoted credential redaction。
  - `RELEASE-NOTES-0.49.0.md:34-38` 與 `docs/project-management/00-CURRENT-STATUS.md:9-15` 沒有把外部 optional runtime 寫成安裝包內建，也沒有把候選誤寫成公開版本。
  - 2026-08-13 08:44:36 CST 執行 `git show --stat 0205548..HEAD`，只見 `00-CURRENT-STATUS.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`08-CHANGE-LOG.md` 三份證據文件，故從 `0205548` 產生的二進位資產沒有被後續產品程式變更淘汰；但正式 tag 應明確記錄資產來源 `0205548` 與最終治理 HEAD 的關係，不能模糊宣稱資產由尚未建置的 `ba05034` 直接產生。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 實際重驗的邊界：缺少 checkpoint、缺少 Python `whisper` module、runtime 非零退出；結果為 `ready:false`／exit 1。focused 測試另涵蓋錯誤大小／SHA、probe timeout、child close 等待、一般診斷隱私省略、token／password／API key（含引號與空白）遮罩。
  - 2026-08-13 08:45:49 CST 對兩個 unpacked app 執行 `find ... -size +1G`，沒有輸出；Windows unpacked 只找到 Breeze guide、0.49.0 Release notes 與 probe library，未找到 `breeze-asr-25.pt`，符合 checkpoint 不入包邊界。
  - 未實測邊界仍包括：真實 3,087,008,569-byte checkpoint、官方 patched runtime、下載中斷／磁碟不足、台灣華語／中英混用、長音訊、CPU／CUDA 效能與記憶體、Windows 真實 `taskkill /T /F` process tree、兩平台乾淨安裝後 Breeze 流程；來源見 `RELEASE-NOTES-0.49.0.md:34-38` 與 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:165-166`。

## 4. 程式碼品質

- 判定：通過（僅限候選來源與本輪可靜態核對範圍）
- 證據：
  - 2026-08-13 08:44:36 CST 執行 `git status --short` 為 clean，HEAD 為 `ba05034`、`origin/main` 為 `05b275f`；`git diff --stat origin/main...HEAD` 為 20 個可追溯檔案、745 insertions／23 deletions，差異集中於 probe、共用 process cleanup、測試、版本、workflow 與文件。
  - 版本在 package／lockfile／macOS `Info.plist` 一致為 `0.49.0`；2026-08-13 08:45:49 CST 的 `plutil` 另確認 `LSMinimumSystemVersion=12.0`。
  - 2026-08-13 08:45:31 CST 執行 `npm run docs:check` 通過（19 個治理文件、版本 0.49.0），`git diff --check` 無輸出。
  - `.github/workflows/windows-preview.yml:1-18,24-38,54-71,87-105,127-134` 已鎖定 0.49.0 branch／tag、Node 22、完整回歸、Windows renderer／安裝生命週期、archive、Breeze guide 與 checkpoint 排除關卡；但 workflow 尚未實際執行，故不把靜態品質判定擴張成 Windows 運行通過。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 主要代理提供的既有證據為：focused Breeze test、`npm run check`、`npm audit --json`（0 項已知弱點）、packaged renderer smoke、runtime／archive／metadata 驗證均通過；同樣記錄於 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:157-164`。本獨立代理未重跑長時間 `npm run check` 或 audit，不能將該結果稱為本輪獨立重驗。
  - 本輪 2026-08-13 08:45:49 CST 獨立執行 focused Breeze test 與缺件 probe，均得到預期結果；2026-08-13 08:45:31 CST 獨立執行 `npm run docs:check` 與 `git diff --check` 通過。
  - 2026-08-13 08:45:14 CST 在 `../dist` 執行兩份 `shasum -a 256 -c`，DMG、ZIP、Setup、Portable 四項全數 `OK`；2026-08-13 08:46:14 CST 另自行計算三個 updater 主資產的 SHA-512／size，與 `latest-mac.yml`、`latest.yml` 完全一致。
  - Windows workflow 雖有測試設計，但分支未推送，沒有 0.49.0 Windows Actions run、Windows real runner、Setup／Portable renderer／安裝解除生命週期或 CI artifact 下載交叉驗證；依 `docs/project-management/workflows/06-BUILD-RELEASE.md:13`，正式發布不可省略 CI artifact 交叉驗證。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 2026-08-13 08:45:16 CST 執行 `hdiutil verify offline-subtitle-factory-0.49.0-macos-arm64.dmg`，結果 checksum `VALID`；`unzip -t` 結果無壓縮資料錯誤；`codesign --verify --deep --strict` 通過，`codesign -dv` 顯示 `Signature=adhoc`、`TeamIdentifier=not set`。
  - 四項資產大小分別為 DMG 242,706,559、ZIP 249,942,036、Setup 244,655,017、Portable 243,947,755 bytes，與 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:164` 一致；Windows unpacked executable 為 PE32+ x86-64，Setup／Portable 為 NSIS self-extracting archive。
  - `../dist/SIGNING-STATUS-windows-x64.txt` 明確記錄兩個 Windows EXE 未 Authenticode；Release notes 第 30 行與狀態文件沒有做相反宣稱。此狀態由常設授權涵蓋，但本機缺少可用 Authenticode 驗證工具，故本輪只核對既有 signing status、檔案格式與揭露一致性。
  - 2026-08-13 08:45:49 CST 的 `gh auth status` 顯示 `twyderek` token 無效；`git branch -r --contains HEAD` 與 `git tag --points-at HEAD` 均無候選遠端／tag 輸出。因此沒有 PR、`v0.49.0` tag、GitHub Release、公開資產 digest／URL 或發布後下載結果。
  - 本輪沒有在 Windows 或乾淨雙平台環境啟動候選，也沒有以真實 Breeze runtime／checkpoint／音訊執行轉錄，不能由 macOS cross-build 或 mock 取代。

## 綜合判定

- 結論：有條件通過（僅限本機候選與建立 PR）；公開 Release 不通過
- 候選／PR 判定：四項本機候選資產、SHA-256、macOS DMG／ZIP、metadata、版本、必要文件與限制揭露已具備；恢復 GitHub 認證後可推送分支並建立 PR，讓 Windows workflow 與正式審查關卡開始執行。此判定不代表可合併後立即公開 Release。
- 公開 Release 判定：不通過；以下阻擋問題解除或由有權責的需求方在具體範圍內明確接受前，不得建立或公開 `v0.49.0` Release，也不得宣稱 Breeze 0.49.0 已正式跨平台驗收。
- 阻擋問題：
  1. GitHub token 無效，分支尚未推送，PR／tag／Release 與發布後 asset digest、URL、實際下載核對均不存在。
  2. 沒有本候選的 Windows Actions／Windows real runner 結果，也沒有從 CI 下載 artifact 做交叉驗證；Windows renderer、Setup／Portable 安裝解除生命週期與真實 process tree 未驗證。
  3. 真實約 3 GB checkpoint、官方 patched Whisper／PyTorch runtime、真實音訊品質／對齊、長音訊與 CPU／CUDA 效能／記憶體均未驗收。
  4. 兩平台乾淨安裝後 Breeze 流程、checkpoint 下載中斷與磁碟不足未驗收；`AUTH-2026-07-23-01` 明確不涵蓋未完成實機測試，REL-030 亦未記錄需求方已接受這些公開發布風險。
  5. 建立 tag／Release 前須明確固定 tag target 與資產來源 `0205548` 的關係；若 tag 指向 `ba05034`，發布證據必須如實說明後者只比建置來源多三份未入包的治理文件，不得誤述為已從 `ba05034` 重建。
- 剩餘風險：Windows unsigned／SmartScreen 與 macOS ad-hoc／未公證雖已有 `AUTH-2026-07-23-01`，仍須在 Release notes、狀態與 GitHub Release 持續揭露；Breeze 為需外部大模型與 runtime 的實驗性選項，使用者可能因安裝複雜度、磁碟、效能或品質無法實際使用，必須保留 Whisper.cpp 預設與回退說明。
- 給主要開發代理的具體修正要求：
  1. 修復 GitHub 認證後推送 branch、建立 PR，記錄不可變來源 SHA；先讓 `.github/workflows/windows-preview.yml` 在 Windows runner 完整通過。
  2. 下載 Windows CI artifact，重放 SHA／archive／內容／簽章狀態並與最終上傳資產交叉核對。
  3. 在建立公開 Release 前，由需求方針對「未做真實 Breeze checkpoint／runtime／音訊／效能／長音訊、Windows process tree、兩平台乾淨安裝／下載失敗」逐項明確接受，或補齊相應驗收；籠統的「推進發布」與簽章常設授權不能代替。
  4. 建立 tag／Release 後核對實際 target SHA、資產名稱、大小、GitHub digest、直接下載 URL、checksum 與 updater metadata，並再進行發布後複審。

**REL-030 Breeze 0.49.0 round1 獨立審查結論為有條件通過（僅限本機候選與建立 PR）：四項本機資產、SHA-256、macOS DMG／ZIP、updater metadata、版本與風險揭露已重驗一致，但因 GitHub 分支／PR／tag／Release 尚不存在、0.49.0 Windows Actions 與 CI artifact 交叉驗證未執行、真實 Breeze checkpoint／官方 runtime／音訊品質與效能／長音訊／Windows process tree／兩平台乾淨安裝均未驗收且未獲涵蓋授權，所以公開 v0.49.0 Release 判定為不通過，解除上述阻擋並完成發布後資產核對前不得公開發布。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
