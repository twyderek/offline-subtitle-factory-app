# 獨立審查報告：Whisper 三模型本機測試版封裝

- 審查對象 commit／版本：0.48.0 工作樹測試封裝（2026-08-05）
- 對應 08-CHANGE-LOG 條目：2026-08-05 — Whisper 三模型本機測試版封裝
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-05 08:52 +08:00；獨立讀取 release preflight 路由與現行封裝，未沿用主要代理的結果評價。

## 1. 需求完整性

- 判定：通過
- 證據：FR-022 要求三模式選擇、模型驗證與不假成功；`docs/project-management/08-CHANGE-LOG.md` 最新條目限定本輪為本機測試封裝、不改版本／正式 Release，且不宣稱 Base／Small 權重或中文品質已驗收。兩個指定 ZIP 與對應 macOS／Windows x64 目錄版均存在，並包含 app source、runtime manifest 與 Tiny 模型。

## 2. 邏輯正確性

- 判定：通過
- 證據：兩份封裝的 `manifest.json` 均列 `target`（darwin-arm64／win32-x64）、三模式 metadata，但 `files.models` 僅列 `tiny`；封裝 server health/bootstrap 實測回報 Tiny `valid:true`、Base／Small `installed:false`、`reason:"missing"`，沒有把可選 UI 當成已安裝模型。macOS health `ready:true`／`canProcessJobs:true`；Windows bundle 在 macOS 主機執行時因 `.exe` 無法啟動而 `ready:false`，此為主機限制而非誤報成功。

## 3. 邊界情況

- 判定：部分通過
- 證據：2026-08-05 focused mock／核心回歸已覆蓋三模型與缺檔、大小／SHA／manifest 邊界；本輪封裝檢查確認 ZIP 只有 Tiny 權重。`unzip -t` 對兩 ZIP 均回報 `No errors detected in compressed data`；PE32+ Windows executable 與 arm64 Mach-O 均由 `file` 識別。Windows 未在 Windows 實機啟動，macOS renderer 若在 LaunchServices／Electron 環境受限則不以此推論 Windows 行為。

## 4. 程式碼品質

- 判定：通過
- 證據：兩 ZIP 內均列出 `public/index.html`、`server.mjs`、`lib/ai/providers.mjs`、`lib/ai/subtitle-optimizer.mjs`、`resources/tools/manifest.json` 與 `ggml-tiny.bin`；unpacked app 的 markers（professional subtitle translator、think:false、operation: mode、canRepairTranslationValidation）可在對應 app source 找到。測試產物置於 `dist/test-0.48-whisper-*`，沒有覆寫正式 Release 資產。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-08-05 執行 `npm run check`（受控權限）通過，包含 docs、語法、Whisper mock、core API／任務回歸；`shasum -a 256` 取得 macOS ZIP `26e1f350a15151f558f7e458ae3296e6256086b593843d7de594e1a2d0087fdd`、Windows ZIP `c925a0ad57bc9f3f277b4ad36c692a3f1dc30f5f0463ae06e87fd8a02cdfa42f`。封裝 server health/bootstrap 已分別實測；macOS Electron renderer smoke 通過 upload／manual job、review assets、settings modal 與 trim assets。Windows renderer／安裝後測試未覆蓋。

## 6. 實際運行結果

- 判定：部分通過
- 證據：macOS packaged renderer `verify-electron-renderer.mjs` 實際回報 `healthOk:true`、`finalStatus:"completed"`、`hasCleanedSrt:true`、review／trim assets 均為 true；macOS server health/bootstrap 讀取封裝 tools，確認 Tiny valid、Base／Small missing。Windows server 可在 macOS 主機讀取 manifest 並回報 Tiny valid／Base／Small missing，但因 `.exe`／FFmpeg／Whisper 不能在 macOS 執行而 `ready:false`；Windows 實機與 Electron renderer 仍未驗證。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無封裝檔案、SHA、ZIP 完整性或 macOS packaged renderer 的阻擋；Windows x64 實機 renderer／安裝後 smoke 尚未取得。
- 剩餘風險：測試包未含 Base／Small 實際權重；Windows 在非 Windows 主機的 health `ready:false` 不能替代 Windows 實機結果；未涵蓋 Windows 安裝／解除安裝、簽章、公證、長音訊與三模型中文品質。
- 給主要開發代理的具體修正要求：保留兩 ZIP 與 SHA／manifest evidence；在 Windows 10/11 x64 實機解壓或安裝後重跑 health、bootstrap、renderer、Tiny transcription，並於取得 Base／Small 權重後另行完成三模型品質／取消／fallback smoke；不得把本輪測試包當正式 Release。
- 可逐字引用完整結論句：**本輪 Whisper 三模型本機測試版封裝結論為有條件通過：macOS arm64 與 Windows x64 測試 ZIP 均可解壓、SHA／格式與封裝 markers 核對一致，封裝 health/bootstrap 正確顯示 Tiny valid 且 Base／Small missing，macOS packaged renderer 與完整 `npm run check` 通過；但 Windows renderer／安裝後實機、簽章／公證、Base／Small 實際權重與模型品質仍未驗收，不得視為正式發布或三模型實機完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
