# 獨立發布複審報告：REL-037 Breeze 首次選擇流程與 0.49.1 候選（round4）

- 審查日期：2026-08-18（Asia/Taipei）
- 審查範圍：`codex/021-breeze-runtime-guide`、commit `b14e4d391f24a8a8e845d54ef823726908393035`；Breeze 首次選擇 UI／readiness、MacBook Air 效能發布依據、macOS arm64 0.49.1 候選、Windows CI run／artifact、版本／文件與公開發布條件。
- 審查方式：獨立讀取來源、執行 focused／完整測試、核對本機候選檔案與 GitHub Actions metadata；未修改產品程式或既有文件，本報告為本輪唯一新增檔案。

## 1. 需求完整性

- 判定：通過（隔離發布候選範圍）；公開 Release 仍有治理條件。
- 證據：`public/index.html` 的選擇器為 `<option value="breeze-asr-25">Breeze ASR 25</option>`，未把「實驗性」混入產品名稱；`public/app.js` 首次切換會進入 `ensureBreezeAsrReady()`。
- 模型缺失時會開啟固定官方版本下載，成功驗證後接續 runtime 安裝／啟動指引；可取消下載或切回內建 Whisper.cpp。App 不會自動執行 `pip install`、clone 或修改 PATH。
- MacBook Air 實機發布依據已記錄：`Mac15,12`、Apple M3、8 GB、8 cores、macOS `26.5.2`（Build `25F84`）；需求方回報 1 小時 46 分影片約需 6 小時，約 `3.4×`。文件明確標示這是單一本機 CPU／runtime 觀察，不是跨機型效能或品質保證。
- 版本與來源同步為 0.49.1；既有公開 `v0.49.0` 仍保留，未被覆寫。尚未建立 `v0.49.1` tag／公開 Release，故此判定不等於公開發布完成。

## 2. 邏輯正確性

- 判定：通過（程式契約與封裝 renderer smoke）；真實 Breeze 執行路徑仍未驗收。
- 證據：`refreshBreezeAsrStatus()` 發生 API／網路錯誤時會清除 `breezeAsrCatalog`，避免沿用過期 ready 狀態；`breezeReadinessPromise` 讓快速重複選擇／提交共用 readiness 流程，並以 `finally` 清除鎖。
- 來源 assertions 覆蓋選擇器文字、首次設定提示、readiness 重入保護、ready 狀態與 stale catalog 清理；Windows runner log 的 `breezeSelectionFlow` 實際回報 `hasSelect=true`、`opened=true`、`closed=true`，狀態為「首次選擇 Breeze ASR 25 會先協助下載模型，再引導設定 patched runtime」。
- 仍需注意：smoke 取消的是模型下載 modal，未涵蓋真實 3.09 GB checkpoint 下載完成、SHA mismatch、runtime recheck 成功／失敗與 patched CLI 實際轉錄。

## 3. 邊界情況

- 判定：部分通過
- 證據：已覆蓋模型缺失阻擋任務、選擇流程可取消、ready／缺 runtime／未安裝狀態、快速重入、Whisper fallback，以及 Windows Setup／Portable renderer 的 manual job、trim、review、folder flow。
- 本機 `npm run probe:breeze -- --json` 回報 `model.valid=false`、`reason="missing"`、`ready=false`，命令以 exit 1 結束；這符合安全缺件行為，但也證實本機沒有真實 Breeze checkpoint／patched runtime 的完整 ASR 驗收。
- macOS renderer smoke 已回報 first-selection modal 開啟／取消／關閉與既有流程通過，但輸出後 process cleanup 未自然退出，主代理以 Ctrl-C 結束；不可把該次結果描述成自然 exit 0 或完整生命週期驗收。Windows CI log 回報 Setup／Portable smoke 與卸載 smoke 通過，但不替代 Windows 10／11 不同實機的乾淨安裝驗收。

## 4. 程式碼品質

- 判定：通過（本輪變更）；公開發布文件仍須保持限制揭露。
- 證據：readiness flow 集中於既有模型下載／runtime guide 路徑，沒有在 renderer 內新增任意 shell 執行；UI、source assertions、Breeze guide、Release notes、目前狀態與測試稽核文件同步。
- 選擇器移除 experimental 字樣只影響產品名稱；`docs/BREEZE-ASR-25.md` 與 `RELEASE-NOTES-0.49.1.md` 仍保留 Breeze experimental、外部 Python／PyTorch／patched runtime、未完成品質／效能／跨平台驗收等真實限制，沒有形成誤導性正式品質承諾。
- Windows workflow 檔案目前標示 `Build Windows 0.49.1`，但 GitHub API 對 run `32093408495` 回報的 `workflowName` 仍為 `Build Windows 0.49.0`；job、artifact 名稱、封裝檔與內容均為 0.49.1。建立公開 tag 前應再確認 GitHub workflow 顯示名稱與版本 metadata 是否一致，避免發布紀錄歧義。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：本輪實際重跑通過：
  - `node --check public/app.js`、`scripts/test-breeze-asr.mjs`、`scripts/verify-electron-renderer.mjs`。
  - `node scripts/test-breeze-asr.mjs`、`node scripts/test-whisper-models.mjs`。
  - 完整 `npm run check`（含 `npm test`）通過。
  - `npm run docs:check` 通過；`npm run probe:breeze -- --json` 以預期 exit 1 結束且 `ready:false`。
- Windows CI：run `32093408495` 為 success，head SHA 為 `b14e4d3`，source／FFmpeg regression、unsigned Setup／Portable、renderer／安裝解除、7z archive、Release notes／Breeze guide／checkpoint 排除及 artifact upload 均為 success。artifact `9309205866` 名稱 `offline-subtitle-factory-0.49.1-windows-x64`、大小 `490,424,583` bytes，GitHub digest 為 `sha256:1fb0a40a3c5ce200ff82c56736e13054f10314d3f700fab9515ec3becc8ec5fc`；本機 `../dist/test-build-0.49.1-windows/offline-subtitle-factory-0.49.1-windows-x64.zip` 同大小／digest，`unzip -t` 無錯誤。
- Windows 本機解包核對：Portable `244,680,999` bytes／SHA-256 `1d8393f95cd84451cb244cdf7fdf6c8708e86bb57822fbfd03b59f8697e03321`；Setup `245,388,252` bytes／SHA-256 `af64c6159cd7d0a96e04587d33a0c6f562edc0ea3d6b6923eb875d917ee5ee6e`；`SHA256SUMS-windows-x64.txt` 與實檔一致；`latest.yml` 為 `version: 0.49.1`，Setup size／SHA-512 與實檔一致；簽章狀態明確為 unsigned internal preview。
- macOS arm64 0.49.1 候選：DMG SHA-256 `8e0afe0065f4ed3e608248dc5b26558a2e5dfb1effe9c3ef93572ceaf2eff0df`，`hdiutil verify` 為 `VALID`；ZIP SHA-256 `99837a1de3742e40d752a27a9a58e01db29bd5704de7905a07609ecfc7ebdf64`，`unzip -t` 無錯誤；封裝內 app version 為 `0.49.1`、Breeze 首次選擇 marker 存在且沒有 `.pt` checkpoint。
- `npm run docs:check:final` 目前尚未通過，原因是最新 `08-CHANGE-LOG.md` 尚未接入本 round4 報告與本輪完整發布授權／未簽章／未公證風險欄位；這是本報告完成後需由主要代理補齊並重跑的治理條件，不是產品測試通過證據。

## 6. 實際運行結果

- 判定：部分通過
- 證據：macOS 與 Windows 封裝／renderer smoke 均證明一般 UI 與首次 Breeze 選擇可進入模型下載 modal、取消後關閉，既有 manual job／trim／review／folder 流程可運作；Windows additionally 完成 Setup／Portable 安裝與靜默卸載 smoke。
- 尚未完成、不得省略的真實驗收：MediaTek patched Whisper runtime 實際載入、3.09 GB checkpoint 下載／SHA／轉錄、台灣華語品質、1:46 長音訊可重現效能、CPU／記憶體／溫度、取消／恢復、Windows／macOS 乾淨安裝與跨平台 runtime 行為。Mac Air 約 6 小時只能作低資源效能警示；不能宣稱 Breeze 即時、固定倍率或跨硬體可接受。
- Windows 資產未 Authenticode，macOS 資產未 Developer ID 簽章／公證；下載交付必須附並核對 SHA-256，且 Release notes 必須保留 Unknown Publisher／Gatekeeper 與 Breeze 外部 runtime 前置條件。

## 綜合判定

- 結論：有條件通過。
- 阻擋問題（若有）：公開 Release 前仍需完成 `docs:check:final` 治理結案、確認 GitHub workflow／0.49.1 metadata 一致、處理或揭露 macOS smoke cleanup 未自然退出，並保留真實 Breeze runtime／model／quality／performance／cross-platform 未驗收與 Windows 未簽章、macOS 未簽章／未公證風險。
- 可逐字引用完整結論句：**REL-037 round4 已核對 `b14e4d3` 的 0.49.1 來源、macOS arm64 DMG／ZIP、Windows CI run `32093408495`／artifact `9309205866` 的 digest 與本機解包 checksum／metadata；Breeze 首次選擇流程及雙平台 renderer smoke 可作隔離測試候選交付，但 `docs:check:final` 尚待接入本報告，macOS smoke cleanup 未自然退出，且真實 Breeze runtime／checkpoint／品質／效能／乾淨安裝仍未驗收，因此不得宣稱 0.49.1 公開正式 Release 已完成。**
- 公開 Release 前必要條件：
  1. 將本報告路徑、逐字結論與明確核准人／時間／範圍（含未簽章、未公證）補入最新 `08-CHANGE-LOG.md`，重跑 `npm run docs:check:final` 與 `git diff --check`。
  2. 確認 GitHub workflow 顯示名稱與 0.49.1 版本 metadata 一致；建立 tag／Release 時重新核對四項 Windows／macOS 主資產、checksum、updater metadata 與來源 SHA，避免覆寫 `v0.49.0`。
  3. 修正或明確隔離 macOS smoke cleanup 未自然退出的測試生命週期問題；若保留現況，Release 文件必須如實標為有條件候選，不可稱為完整 smoke exit 0。
  4. 保留真實 Breeze runtime／model／quality／performance／cross-platform 缺口與 Mac Air `3.4×` 觀察，不把本輪 mock／CI／封裝證據升格為模型品質或即時效能驗收。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
