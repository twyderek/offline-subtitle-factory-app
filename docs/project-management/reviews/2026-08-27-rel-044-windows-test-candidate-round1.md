# 獨立審查報告：REL-044 0.51.0 Windows x64 cross-build 測試候選

- 審查對象 commit／版本：`codex/0.51-anthropic-claude@e4bc931`；版本 `0.51.0`。
- 候選目錄：`/Users/nycu/Documents/離線字幕工廠/dist/win-unpacked/`。
- 對應 08-CHANGE-LOG 條目：`2026-08-27 — 0.51.0 Windows x64 測試候選建置可行性（REL-044）`。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-08-27（Asia/Taipei）；獨立上下文重新讀取 REL-044 工作紀錄、目前狀態、測試稽核、0.51.0 Release notes、候選目錄與 source，未沿用主要代理的評價性結論。
- 審查環境：Apple Silicon macOS；Node.js v22.22.3；目前分支 `codex/0.51-anthropic-claude`。
- 審查限制：本輪只做 Windows x64 cross-build 的靜態候選與來源核對；沒有真實 Windows 主機、Wine、Windows renderer／安裝實機、真實 Anthropic API key、外部 provider smoke 或真實 Breeze／Whisper 模型品質測試。

## 1. 需求完整性

- 判定：通過（限 REL-044 定義的 Windows x64 cross-build directory 測試候選）。
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-18` 將本輪目標限定為由 `e4bc931` 產生 Windows x64 directory candidate，要求 runtime manifest／verify、版本／x64／Anthropic marker／資產核對，並明確排除 Windows 實機、renderer、模型品質、外部 API、tag 與 GitHub Release。
- 證據：候選 `PROVENANCE.txt` 與 `TEST-CANDIDATE-README.md` 明確標示 `0.51.0`、`win32-x64`、來源 branch／commit、macOS cross-build、local candidate only、未簽章與 Windows 實機尚未驗收；未把候選寫成正式 Windows Release。
- 證據：候選 `resources/app/package.json` 為 `0.51.0`；候選 `resources/tools/manifest.json` target 為 `win32-x64`；Electron `43.3.0` 與 electron-builder `26.15.7` 與本輪 source 設定一致。
- 限制：這個判定只表示需求所定義的 cross-build candidate 目標達成，不表示 Windows 使用者可直接安裝或執行。

## 2. 邏輯正確性

- 判定：部分通過（source／封裝內容與固定 runtime contract 通過；Windows runtime 行為未驗證）。
- 證據：候選 `resources/app/lib/ai/anthropic.mjs`、`resources/app/lib/ai/providers.mjs`、`resources/app/public/review.js` 與 source 對應檔案內容核對一致；候選 provider registry 含 `anthropic`、預設 `https://api.anthropic.com`、`/v1/models` 與 `/v1/messages` adapter marker。
- 證據：`resources/app/docs/BREEZE-ASR-25.md` 存在，runtime manifest 的固定元件與路徑指向 FFmpeg、Whisper.cpp、Tiny；沒有將 Breeze patched runtime 或 checkpoint 偽裝成 bundled ready。
- 證據：`OFFLINE_SUBTITLE_TOOLS_DIR=/Users/nycu/Documents/離線字幕工廠/dist/win-unpacked/resources/tools node scripts/verify-runtime-package.mjs --target=win32-x64` exit 0，輸出 `OK: win32-x64`，並通過 FFmpeg、Whisper.cpp 與 Tiny 的 manifest／hash 檢查。
- 未覆蓋：macOS 上不能執行候選 Windows PE，因此無法證明 Electron 主程序、FFmpeg、Whisper.cpp、AI provider 或 Breeze 流程在 Windows loader／DLL 環境實際工作。

## 3. 邊界情況

- 判定：部分通過（候選完整性與排除範圍已覆蓋；Windows 安裝／執行邊界未覆蓋）。
- 證據：候選提供 `TEST-CANDIDATE-README.md`、`PROVENANCE.txt` 與 `SHA256SUMS-win32-x64.txt`；README 明確要求複製整個 `win-unpacked` 到 Windows 10／11 x64，並逐項列出未驗收的 SmartScreen、安裝／解除安裝、捷徑、renderer、GPU、FFmpeg／Whisper 與 Breeze 限制。
- 證據：本審查重放候選 SHA-256，主程式、packaged `package.json`、packaged runtime manifest 與 Tiny model 四項均為 `OK`；候選與 source 的 Anthropic、provider UI、Breeze guide、runtime manifest 對應檔案存在。
- 證據：`file` 識別主程式、FFmpeg、FFprobe、Whisper CLI 與 Whisper DLL 均為 Windows x86-64 PE；`ggml-base.dll` 等是 Whisper.cpp runtime DLL，未發現 Base／Small checkpoint、Breeze checkpoint、Python／PyTorch 或憑證檔案。
- 未覆蓋：Windows 10／11 SmartScreen、首次啟動 userData、安裝權限、解除安裝清理、檔案鎖定、GPU／DLL 相容性、離線狀態、真實長音訊與跨平台差異均須 Windows 實機驗證。

## 4. 程式碼品質

- 判定：部分通過（cross-build artifact hygiene 通過；未完成 Windows code-sign 與執行環境品質驗證）。
- 證據：`git diff --check` exit 0；本輪沒有發現產品 source code 變更，候選 app 內的 `anthropic.mjs`、`providers.mjs`、`review.js` 與 source 對應檔案相同。候選 package 的 scripts／devDependencies 被 electron-builder 正常裁剪，但版本與 `main` 保留正確，並非產品程式碼遺失的證據。
- 證據：候選 `SHA256SUMS-win32-x64.txt` 僅列四項可定位、可重放的核心檔案；候選中未找到 `sk-ant-` 或已知 API key／私鑰內容，且 `TEST-CANDIDATE-README.md` 明確說明未含金鑰。
- 證據：`PROVENANCE.txt` 明確標示 `signing: not independently verified; no Windows Authenticode claim`；沒有把 macOS cross-build 產物宣稱為已簽章 Windows installer。
- 注意事項：本候選以 `asar: false` 的 directory 結構提供，這與現行 builder 設定一致，但不等同經過 Windows installer 的檔案權限、簽章、SmartScreen 或更新器驗證；候選 packaged Release notes 是建置時 `e4bc931` 的版本，後續工作紀錄的文件增補並未反向改寫候選。

## 5. 測試覆蓋

- 判定：部分通過（Windows cross-build static layer 通過；Windows 實機與 renderer layer 未覆蓋）。
- 證據：本審查重新執行候選 runtime verify，`win32-x64`、FFmpeg、Whisper.cpp、Tiny model 與 manifest SHA 均通過；重新執行四項候選 SHA-256 重放全部 `OK`。
- 證據：本審查重新執行 `file`，主程式、FFmpeg、FFprobe、Whisper CLI 與 Whisper DLL 均為 x86-64 PE；`resources/app/package.json` 為 `0.51.0`，`resources/tools/manifest.json` target 為 `win32-x64`，Anthropic module／registry marker 均存在。
- 證據：候選 README、PROVENANCE 與目前測試稽核均明確記錄沒有 Wine，故沒有嘗試在 macOS 假裝執行 Windows renderer，也沒有使用真實 Anthropic key；這符合 REL-044 的排除條件。
- 治理狀態：本審查執行 `npm run docs:check:final` 時 exit 1，原因是 REL-044 工作紀錄尚未完成、仍有「待執行／待確認」與審查欄位空白。這是主要代理結案前的治理 gate，不能當作候選 runtime verify 已失敗。

## 6. 實際運行結果

- 判定：部分通過（只能判定 cross-build directory candidate 已產生並可靜態交付；不能判定 Windows 實機可運行）。
- 證據：`/Users/nycu/Documents/離線字幕工廠/dist/win-unpacked/離線字幕工廠.exe` 為存在且具 executable bit 的 PE32+ x86-64 GUI executable；同一目錄含完整 Electron runtime、`resources/app`、`resources/tools`、Tiny model、Breeze guide、Anthropic adapter 與候選證據檔。
- 證據：候選目錄約 687 MB，runtime 約 315 MB，Tiny model 約 80 MB；核心候選 SHA-256、manifest size／hash 與 file format 已重放通過，未發現憑證或高階 checkpoint 被意外打包。
- 限制：macOS 主機沒有 Wine，不能執行 `verify-electron-renderer.mjs` 對 Windows executable 做 bridge／UI／手動 SRT／AI review smoke；也不能執行 Setup、解除安裝或 Windows process tree 驗證。因此本節不能升格為 Windows renderer／安裝／實機通過。
- 目前文件有一致的風險揭露：候選 README、PROVENANCE、Release notes、00-CURRENT-STATUS 與 06-TEST-AND-PROCESS-AUDIT 都將它限定為 cross-build candidate，並列出未驗證項目；候選目錄內的 Release notes 仍是 `e4bc931` 建置版本，新增的 REL-044 文件證據則保留在 repo。

## 綜合判定

- 結論：有條件通過（僅限 Windows x64 cross-build directory 測試候選，不是 Windows 實機或公開發布）。
- 可逐字引用的完整結論句：**本輪 REL-044 0.51.0 Windows x64 cross-build directory 測試候選獨立審查結論為有條件通過：來源 commit、版本、win32-x64 manifest、FFmpeg／Whisper.cpp／Tiny runtime verify、x86-64 PE 格式、四項 SHA-256、Anthropic provider marker 與候選限制文件均已重新核對通過，可交付至 Windows 10／11 x64 作後續隔離測試；但 macOS 主機沒有 Wine，Windows renderer／安裝／解除安裝／實機任務、Authenticode、真實 Anthropic API／模型品質／rate-limit、Breeze patched runtime、長音訊效能、乾淨環境與跨平台行為均未驗收，因此不得宣稱 Windows 實機通過、0.51.0 公開發布或 Breeze／Anthropic 已完成正式品質驗收。**
- 阻擋問題（若有）：
  1. 主要代理須將 REL-044 工作紀錄補入本報告路徑與上方逐字結論，將狀態／結案欄位完成，並重新執行 `npm run docs:check:final`；完成前治理文件不能結案。
  2. 若要宣稱 Windows 使用者可運行或建立公開 0.51.0 Release，需在 Windows 10／11 x64 完成 packaged renderer、Setup／Portable 安裝與解除安裝、FFmpeg／Whisper 任務、SmartScreen／簽章狀態與乾淨環境驗收，並另行取得對應發布授權；本報告不提供該授權。
- 剩餘風險：cross-build 不能排除 Windows loader／DLL／GPU／檔案權限問題；Authenticode、SmartScreen、Setup／Portable、更新 metadata、Windows 實機 renderer、Whisper／Breeze 真實 runtime、Anthropic endpoint／proxy／rate-limit／計費、模型品質、1:46 長音訊效能與跨平台差異仍未驗收。
- 給主要開發代理的具體修正要求：保留本報告不覆寫；完成 REL-044 的治理欄位後重跑 `npm run docs:check:final` 與 `git diff --check`；交付候選時同時提供 `/Users/nycu/Documents/離線字幕工廠/dist/win-unpacked/TEST-CANDIDATE-README.md`、`PROVENANCE.txt` 與 `SHA256SUMS-win32-x64.txt`，並把 cross-build candidate 與 Windows 實機驗收分開標示。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本審查代理未修改產品程式碼、治理文件、候選資產或既有審查報告。
- 本輪未使用真實 Anthropic API key，未呼叫外部 provider，未嘗試啟動 Windows executable、Setup 或解除安裝程式。
- 本輪的 runtime verify、checksum、file 與靜態封裝檢查均以候選目錄為讀取對象；`npm run docs:check:final` 的失敗是 REL-044 尚未結案的預期治理 gate，已如實記錄。
- 若上述聲明不實，本報告無效。
