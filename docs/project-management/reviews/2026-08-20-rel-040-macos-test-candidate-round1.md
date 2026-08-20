# 獨立發布等級審查報告：REL-040 0.50.0 macOS arm64 測試候選（round1）

- 審查日期：2026-08-20（Asia/Taipei）
- 審查對象：`codex/0.50-whisper-small-long-cues`；候選來源 commit `6beee985f50e2045fb9520630e4fde8d67b61bb7`；治理證據 HEAD `2d15d292853a3865385e9b26a41258f636254a54`；版本 `0.50.0`；候選目錄 `../dist/test-build-6beee98/`。
- 審查方式：獨立讀取目前工作樹、REL-040／BUG-024／BUG-025 證據與候選資產；重跑 focused／完整檢查、封裝完整性、runtime manifest、codesign、metadata、模型排除與 packaged renderer smoke。候選目錄在 repo 外，未修改其內容。
- 執行時間：本輪候選完整性核對約 11:45（+0800）；focused／runtime／完整 `npm run check` 約 11:46–11:48（+0800）；renderer smoke 約 11:48（+0800）；文件／diff 檢查及本報告確認於 11:49（+0800）。

## 1. 需求完整性

- 判定：通過
- 證據：
  - REL-040 工作紀錄 `docs/project-management/08-CHANGE-LOG.md:3-26` 將範圍定為 `0.50.0` macOS Apple Silicon 本機隔離測試候選，明確要求只核對 DMG／ZIP、來源、版本、runtime、Tiny 內建、模型排除、BUG-024／BUG-025、簽章、metadata、renderer 與 checksum，且不建立 tag／公開 Release。
  - 候選 `../dist/test-build-6beee98/PROVENANCE.txt:1-13` 與 `TEST-CANDIDATE-README.md:1-27` 均標示來源 branch／commit、`darwin-arm64`、版本、ad-hoc／未公證、Tiny only，以及 Base／Small／Breeze／Python／PyTorch／patched runtime 排除；候選內容與治理範圍一致。
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:127-135`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:258-280` 對 BUG-025 的 clean-profile 啟動順序與 BUG-024 的 Small 長 cue 保字／拆分／partial quality metadata 有可追溯說明，並明列真實 Small／Breeze、1:46 長音訊、乾淨安裝、Windows 與公開發布未驗收。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - BUG-025 修正可在 `electron/main.mjs:19-28` 直接核對：先檢查 `ai-keys.safe` 是否存在，再呼叫 `safeStorage.isEncryptionAvailable()`／decrypt；`node scripts/test-electron-main.mjs` exit 0，避免乾淨 profile 先觸發不必要 Keychain 查詢。
  - BUG-024 的 `lib/whisper-srt.mjs:177-230` 以 opt-in `splitLongCues` 正規化 Small；`server.mjs:1869-1872` 與 `1998-2001` 僅在 model `small` 啟用，Breeze 路徑 `server.mjs:1746` 與 Tiny／Base 預設呼叫未啟用。`node scripts/test-whisper-srt.mjs`、`test-whisper-quality.mjs`、`test-whisper-models.mjs` 均 exit 0。
  - `/api/breeze-asr` 的固定性能參考仍由 `lib/breeze-asr.mjs:22-30` 統一提供，`server.mjs:1102-1108` 回傳於 `model.performanceReference`；候選 bundle 內可找到 `performanceReference`、Small sanitizer 與 clean-profile marker。這次確認其存在，不將性能觀察誤當作效能改善或模型品質證據。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 已重跑 `npm run check` 的 deterministic 邊界，涵蓋 Small 長 cue、Tiny／Base／Small mock、Breeze 缺件契約、Keychain 啟動順序、API／取消／核心流程；候選 runtime manifest 只列 Tiny，符合「缺少高階模型時不假裝已安裝」的安全邊界。
  - 候選 `mac-renderer-smoke.json:6-36` 與本輪 `scripts/verify-electron-renderer.mjs "../dist/test-build-6beee98/mac-arm64/離線字幕工廠.app/Contents/MacOS/離線字幕工廠" 9237` 均在隔離 userData 實際通過主視窗、設定、Breeze model modal 開啟／關閉、上傳 201／啟動 202／完成與 cleaned SRT、AI review／術語 round-trip／七個 provider；本輪輸出另確認 `hasElectronApi`、safe-key API 與資料夾事件存在。
  - 候選 app 內容搜尋未發現真實 Base／Small 權重、Breeze `.pt`、PFX／P12／PEM／key 或 API token／secret 設定；`find ... -size +1G` 無結果。這只證明資產排除與去敏，不證明模型可執行。
  - 未覆蓋且不得推定通過：真實 Small／Breeze runtime、Breeze checkpoint、1:46 長音訊品質／效能、既有真實加密 AI 金鑰跨版本 decrypt、乾淨帳號 Keychain／Gatekeeper、DMG 拖曳安裝後流程、Windows 與公開 Release。DMG 以 `hdiutil verify` 通過，但本環境的 `hdiutil attach -readonly` 回報「尚未設定裝置」，故沒有把無法掛載當成 DMG 內部安裝 smoke 通過。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - BUG-024 的字元政策、標點／空白邊界、時間分配、`splitFromSource` 與 quality partial 語意集中於 `lib/whisper-srt.mjs`；server 只在 Small 路由啟用，既有 Whisper.cpp 預設與 Breeze 呼叫保持相容。
  - BUG-025 的檔案存在檢查與安全儲存解密順序單純且有註解；新 focused 測試已納入 `npm test`，完整 `npm run check` exit 0。
  - UI／Breeze 的產品名稱在 `public/index.html:215-219` 為 `Breeze ASR 25`，不含 experimental；首次選擇流程與性能提示的實作可在 `public/app.js:846-898` 核對，提示使用巢狀 `breezeAsrCatalog?.model?.performanceReference`，切回 Whisper／manual 會隱藏性能提示。文件 `RELEASE-NOTES-0.50.0.md:5-21`、`docs/BREEZE-ASR-25.md:96-101` 仍揭露單機觀察與外部 runtime 限制，未宣稱性能改善。
  - 來源 candidate commit `6beee985` 與治理 HEAD `2d15d29` 的差異僅為 `00-CURRENT-STATUS.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`08-CHANGE-LOG.md` 文件更新；候選 provenance／bundle source markers 明確固定到 `6beee985`，沒有把較後的治理文件誤包進產品來源。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 本輪 focused：`node scripts/test-whisper-srt.mjs`、`node scripts/test-whisper-quality.mjs`、`node scripts/test-whisper-models.mjs`、`node scripts/test-electron-main.mjs`、三個 `node --check`（server／app／electron）與 `npm run runtime:verify:mac` 均 exit 0。
  - 本輪完整：受控權限 `npm run check` exit 0；`docs:check` 報告 19 個治理文件、版本 `0.50.0`，`npm test` 全部 deterministic／核心回歸通過。`git diff --check` 於本報告加入前後均無 whitespace error。
  - `npm run docs:check:final` 本輪 exit 1；validator 明確指出最新 REL-040 尚未標示「完成」、仍有「待執行」、獨立審查欄位尚未改為是／否，且發布授權範圍未以 final schema 記錄公開／推送等動作。這是治理來源尚未結案的預期阻擋；本審查只被授權新增本報告，未修改 `08-CHANGE-LOG.md`。
  - 本輪候選完整性：manifest 四個唯一 runtime 檔案（FFmpeg／ffprobe／whisper-cli／Tiny）逐一重算 size／SHA-256 通過；`hdiutil verify` DMG 為 `VALID`；`unzip -t` ZIP 無錯；四項 SHA-256（DMG／ZIP／兩個 blockmap）重算與 `SHA256SUMS-macos-arm64.txt:1-4` 一致；`latest-mac.yml:1-11` 的 DMG／ZIP size／SHA-512 逐項重算一致。
  - 本輪 renderer：封裝 app 以 `scripts/verify-electron-renderer.mjs` 重新執行，流程與候選去敏 JSON 一致，且測試結束未見背景程序殘留。未執行真實 Small／Breeze 權重或 1:46 長音訊，所以測試覆蓋判定不升格為模型／效能通過。
  - 限制：本機無法以 `hdiutil attach` 掛載 DMG；沒有 Windows CI／Windows 實機結果；沒有 clean-account Gatekeeper／DMG 安裝後實機結果；沒有既有真實加密 AI key decrypt 結果。這些缺口已在候選 README 與治理文件明列。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - `codesign --verify --deep --strict --verbose=2` 對解包 app 通過；`codesign -dv --verbose=4` 顯示 identifier `com.offline-subtitle-factory.app`、`Signature=adhoc`、`TeamIdentifier=not set`，與 `SIGNING-STATUS-macos-arm64.txt:1-5` 一致。`file` 顯示 app executable 與 bundled whisper-cli 均為 arm64 Mach-O。
  - `Info.plist` 與 packaged `package.json` 均為 `0.50.0`；候選來源 `PROVENANCE.txt:2-9`、`latest-mac.yml:1-11`、SHA／blockmap 與 manifest 互相一致。解包後 source／bundle 的 `public/app.js`、`public/index.html`、`electron/main.mjs`、`server.mjs` hash 一致，且 bundle 具備 BUG-024／BUG-025／Breeze marker。
  - 這是可交付的本機 macOS arm64 隔離測試候選，不是可宣稱正式跨平台發布的軟體：ad-hoc／未公證可能觸發 Gatekeeper；Tiny 以外模型與 Breeze runtime 不在包內；真實長音訊與品質／性能尚未執行；Windows 與公開資產未驗收。

## 發布等級額外審查

- 發布授權：`docs/project-management/08-CHANGE-LOG.md:20-25` 的核准範圍只包含本機 macOS arm64 測試候選、接受 ad-hoc／未公證與未完成真實 Small／Breeze／長音訊／乾淨帳號驗收；明確不包含 tag、push、公開 Release、Windows 或覆寫公開 `v0.49.1`。本輪沒有取得或推定公開 0.50.0 Release 授權。
- 簽章／公證：已確認 ad-hoc、TeamIdentifier 未設定、未 Apple Developer ID、未公證；這個狀態與候選檔案一致，不能以 `codesign --verify` 取代 Developer ID／notarization。
- 資產／發布邊界：候選目錄的 DMG／ZIP／blockmap／`latest-mac.yml`／SHA／provenance／smoke JSON 可供本機測試；未建立 tag、未推送、未建立或更新 GitHub Release，公開 Latest 仍為 `v0.49.1`。不得把 `../dist/test-build-6beee98/` 直接視為公開發布資產。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：本機 macOS arm64 隔離測試候選沒有產品測試阻擋；但 `npm run docs:check:final` 仍因最新 REL-040 工作紀錄未結案／授權欄位未達 final schema 而失敗，且若要升格為公開 0.50.0 Release，必須先完成並重新核對真實 Small／Breeze runtime／checkpoint 與 1:46 長音訊品質／效能、既有真實加密 AI key 跨版本 decrypt、乾淨帳號 Gatekeeper／DMG 安裝、Windows／跨平台實機、正式簽章／公證，並取得明確公開發布授權。DMG direct attach 在本環境未覆蓋，不能宣稱安裝後 smoke 已完成。
- 剩餘風險：CPU／Metal 長時間資源使用、模型品質／中文斷句、runtime 安裝與首次下載、Keychain 權限提示、取消／恢復、Windows 安裝與未簽章、macOS Gatekeeper／未公證、公開 Release metadata／下載與跨平台相容性仍待外部驗收；MacBook Air M3 1:46→6 小時的 `3.4×` 觀察只能作透明化風險提示，不能解讀成性能改善或跨機型保證。
- 可逐字引用完整結論句：**本輪 REL-040 0.50.0 macOS arm64 隔離測試候選獨立審查結論為有條件通過：候選來源、版本、runtime manifest、模型排除、BUG-024／BUG-025、DMG／ZIP 完整性、SHA／updater metadata、ad-hoc codesign 與 packaged renderer smoke 均已重放通過，可交付本機測試；但真實 Whisper Small／Breeze runtime 與 1:46 長音訊品質／效能、既有加密 AI 金鑰跨版本 decrypt、乾淨帳號 Gatekeeper／DMG 安裝、Windows／跨平台實機、正式簽章／公證及公開 Release 均未驗收，因此不得宣稱 0.50.0 已完成公開正式發布。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪未修改產品程式、測試、治理來源、既有報告或 repo 外候選資產；唯一新增檔案為本報告。若上述聲明不實，本報告無效。
