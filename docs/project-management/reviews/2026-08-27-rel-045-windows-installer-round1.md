# REL-045 0.51.0 Windows unsigned Setup／Portable 測試包獨立審查（round1）

審查日期：2026-08-27（Asia/Taipei）  
審查範圍：`codex/0.51-anthropic-claude@91eca2b` 建立的 Windows x64 unsigned cross-build 安裝包與 Portable 測試資產  
審查代理：獨立上下文 review_045

## 審查前提與範圍

本輪只審查 `../dist/test-build-0.51.0-91eca2b/` 的靜態產物、其來源設定／runtime 與可重放的本機檢查。這是 macOS Apple Silicon 產生的 cross-build unsigned installer／Portable 測試包，不是 Windows 實機驗收，也不是公開 GitHub Release。未使用真實 Anthropic API key，未呼叫外部 provider。

## 1. 需求完整性

- 判定：部分通過
- 證據：REL-045 目標是由 `codex/0.51-anthropic-claude@91eca2b` 執行 `npm run electron:build:unsigned`，產生可定位的 `offline-subtitle-factory-setup-0.51.0.exe`、`offline-subtitle-factory-portable-0.51.0.exe`、Setup blockmap 與 `latest.yml`；候選目錄及 `TEST-CANDIDATE-README.md`、`PROVENANCE.txt`、`SIGNING-STATUS-windows-x64.txt`、`SHA256SUMS-windows-x64.txt` 均存在。版本、Windows x64 目標、unsigned 範圍與「不代表 Windows 實機／公開發布」限制均有記錄。
- 證據：`package.json` 的 unsigned script 明確使用 `runtime:manifest`、`runtime:verify`、`electron-builder --win --x64 --publish never`；Windows targets 明確為 NSIS x64 與 Portable x64。
- 未完成：macOS 主機未安裝 Wine／PowerShell，故不能完成 Windows 實機安裝、啟動、renderer、解除安裝與 SmartScreen／Authenticode 驗收；這些未被本候選冒充為已完成。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：`latest.yml` 宣告 `version: 0.51.0`、Setup path；其中 Setup `size: 244670976` 且 SHA-512 為 `8NkEY1uhTp2GpDFCNeZESvqWY0rwxh9UYLMsHsje3iHqrUe02dLabrIw91B2wB8lnWN4RGS5qy8xec3k1xcwCQ==`，均與讀取實體檔案重新計算的值一致。
- 證據：`SHA256SUMS-windows-x64.txt` 重放結果全部為 OK：Setup `12b5a024493288fcf9b3c2a57c321f1f048bb77ef9843571b4fc414b1262b474`、Setup blockmap `102757b3f85486f4a34e1896d26888c726b83d437c450b0ff6d7059e817523ae`、Portable `34aec59149d4659651135b983cced22439cbbb5112c93ef17af09bbdc3af7c17`、`latest.yml` `d3cd3c1cd625e20332f16c6569f59cd1741d59416ef69cbc327229471b6062af`。
- 證據：runtime manifest target 為 `win32-x64`，與 `tools/manifests/win32-x64.json` 內容相同；source runtime verify 回報 FFmpeg／Whisper.cpp／Tiny model 的 hash 驗證通過。`win-unpacked` 的主程式、FFmpeg 與 Whisper.cpp 靜態格式為 x86-64 PE；候選 Setup／Portable 為 NSIS PE GUI wrapper，並不以 wrapper 的 32-bit PE header 宣稱內層 renderer 已在 Windows 執行。
- 未完成：沒有 Windows loader／NSIS archive extraction／安裝程式執行證據，故只能確認 metadata／digest 邏輯與 cross-build 產物，不能確認 Windows 執行期邏輯。

## 3. 邊界情況

- 判定：部分通過
- 證據：候選 README 與 provenance 明確列出 unsigned、未實機、未驗證 Authenticode、未驗證 renderer／安裝／解除安裝、未驗證離線行為、未驗證真實 Anthropic／Breeze／Whisper runtime、長音訊與跨平台限制；不會把 3 GB Breeze checkpoint 或 Python／PyTorch／patched runtime 當作隨包提供。
- 證據：`package.json` 的排除規則拒絕 `.env`、憑證與 key 類檔案；靜態搜尋 `win-unpacked` 未發現 `.pt`、Base／Small model 或憑證檔案。packaged `package.json` 為 `0.51.0`，`resources/tools/manifest.json` target 為 `win32-x64` 且與來源 manifest 一致；packaged provider source 含 `anthropic`、`createAnthropicMessage`、`testAnthropic` marker。
- 未完成：尚未在 Windows 10／11 實機覆蓋安裝路徑、非管理員權限、捷徑、併發／重複安裝、解除安裝後殘留、SmartScreen、網路阻斷與資料路徑；也未驗證缺少 runtime／模型時的實際 renderer 互動。

## 4. 程式碼品質

- 判定：通過
- 證據：REL-045 沒有修改產品 source；建置設定將 signed release 與 `electron:build:unsigned` 分開，且 unsigned script 使用 `--publish never`，避免誤推送發布。`TEST-CANDIDATE-README.md`、`PROVENANCE.txt`、`SIGNING-STATUS-windows-x64.txt` 對 unsigned 狀態與禁止信任發布的限制一致。
- 證據：`node --check scripts/verify-runtime-package.mjs`、`node --check scripts/verify-electron-renderer.mjs` 與 `git diff --check` 通過；目前 source 工作樹只有主要代理同步中的 Release notes／狀態／稽核／工作紀錄文件修改，未見本輪審查代理以外的產品程式碼變更。
- 限制：本判定只代表本輪沒有可歸因於 REL-045 的 source code quality regression；不代表 Windows native runtime 或實機安裝品質已通過。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：`npm run runtime:verify -- --target=win32-x64`；`npm run docs:check`；`node --check server.mjs`、`public/app.js`、`public/review.js`、`electron/main.mjs`；`node scripts/test-ai-providers.mjs`、`node scripts/test-breeze-asr.mjs`、`node scripts/test-review-ui.mjs`；完整 `npm run check`（治理、語法、全部 deterministic／核心回歸測試）均通過。
- 證據：候選四項 SHA-256、Setup SHA-512、`latest.yml` version／path／size／SHA-512 與實體檔案的一致性重算通過；`file` 對 unpacked 主程式／FFmpeg／Whisper.cpp 的 x86-64 PE 靜態核對通過；packaged source／runtime manifest／Anthropic marker 核對通過。
- 未完成：目前主機沒有 7z／Windows PowerShell／Wine，未能在本機執行 `verify-windows-installation.ps1`、`7z t` 或 Windows archive extraction；沒有把 deterministic tests 當作 Windows renderer／安裝後驗收的替代品。

## 6. 實際運行結果

- 判定：部分通過
- 證據：cross-build 指令已產生可定位的 NSIS Setup／Portable 檔案；Setup 244,670,976 bytes、Portable 243,963,613 bytes、Setup blockmap 256,197 bytes；`latest.yml` 380 bytes。檔案格式、版本命名、runtime／provider marker、checksum 與 updater metadata 均可重放。
- 未證實：由於審查環境是 macOS Apple Silicon，且沒有 Wine／Windows host，本輪沒有啟動 Windows Setup 或 Portable，沒有實際安裝／解除安裝／renderer／任務／FFmpeg／Whisper／Breeze 執行結果，也沒有 Authenticode／SmartScreen 結果。這些必須在 Windows 10／11 x64 實機另行驗收。
- 判定界線：本輪是「unsigned cross-build installer／Portable 靜態候選」通過可交付隔離測試的證據，不是「Windows 實機運行通過」或「公開發布就緒」證據。

## 可重放命令與結果摘要

以下命令均未使用真實外部 API key：

```text
npm run runtime:verify -- --target=win32-x64                         PASS
npm run docs:check                                                    PASS
node --check server.mjs public/app.js public/review.js electron/main.mjs  PASS
node scripts/test-ai-providers.mjs                                    PASS
node scripts/test-breeze-asr.mjs                                      PASS
node scripts/test-review-ui.mjs                                       PASS
npm run check                                                          PASS
git diff --check                                                       PASS
```

檔案重放：Setup SHA-256／SHA-512／size、Portable／blockmap／`latest.yml` SHA-256 與 `latest.yml` version／path／size／SHA-512 全部一致；Setup／Portable `file` 輸出為 NSIS PE GUI wrapper，unpacked payload 的主程式／FFmpeg／Whisper.cpp 為 x86-64 PE。沒有在本輪使用 Windows 實機、Wine、PowerShell 或真實 Anthropic key。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 REL-045 0.51.0 Windows x64 unsigned Setup／Portable 測試包獨立審查結論為有條件通過：候選來源、版本、NSIS Setup／Portable 產物、win32-x64 runtime manifest、FFmpeg／Whisper.cpp／Tiny 靜態驗證、SHA-256、Setup SHA-512／size、latest.yml、封裝 provider／模型排除與 unsigned 限制文件均已可重放核對通過，可交付 Windows 10／11 x64 作隔離測試；但本輪僅是 macOS Apple Silicon cross-build，未完成 Windows 實機安裝／啟動／renderer／解除安裝／任務、Authenticode／SmartScreen、離線行為、真實 Anthropic／Breeze／Whisper runtime、長音訊效能、乾淨環境或公開 0.51.0 Release 驗收，因此不得宣稱 Windows 實機通過、可信任簽章或公開發布就緒。**
- 阻擋問題（若有）：無阻擋本機候選交付的問題；Windows 實機／簽章／公開發布是後續關卡，不是本輪可省略的驗收項目。
- 條件：只可作 unsigned、隔離、Windows 10／11 x64 測試；使用者須先核對 `SHA256SUMS-windows-x64.txt`，並將 Unknown Publisher／SmartScreen 視為預期風險。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
