# 獨立審查報告：測試包補入 Whisper Small 模型

- 審查對象 commit／版本：0.48.0 本機測試封裝資產（2026-08-05）
- 對應 08-CHANGE-LOG 條目：2026-08-05 — 測試包補入 Whisper Small 模型
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-05 09:14 +08:00；獨立讀取現行工作紀錄、封裝檔案與 runtime helper，未沿用主要代理的評價性結論。

## 1. 需求完整性

- 判定：通過
- 證據：條目限定下載官方 multilingual `ggml-small.bin`、更新 macOS／Windows 測試包與 manifest，不加入 Base、不修改正式 Release，並明確排除 Windows 實機與 Small 中文品質。來源工作樹 `tools/whisper-models/ggml-small.bin` 實測為 487,601,967 bytes，符合條目要求。

## 2. 邏輯正確性

- 判定：通過
- 證據：`shasum -a 256 tools/whisper-models/ggml-small.bin` 與兩平台 unpacked 檔案均為 `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b`；兩份 manifest 均列 Small size／SHA，未列 Base。Small `inspectWhisperModels` 實測在 macOS／Windows unpacked 均為 `installed:true, valid:true, reason:"ok"`，Base 為 `installed:false, valid:false, reason:"missing"`。

## 3. 邊界情況

- 判定：部分通過
- 證據：`whisper-cli` CPU smoke 載入 Small 顯示 `type = 3 (small)`、`n_langs = 99`、model size 約 487.01 MB，並產生 JSON；兩 ZIP `unzip -t` 均回報 `No errors detected in compressed data`。Base 仍缺檔且被 manifest／inspect 正確標示。尚未在 Windows 實機驗證 Small，亦未用中文素材證明品質、長音訊、取消或 fallback。

## 4. 程式碼品質

- 判定：通過
- 證據：本輪僅更新本機測試資產、unpacked manifest 與 ZIP，未修改來源程式；manifest 對 Small 保存相同 size／SHA，Tiny 仍保留，Base 未被虛構加入。測試產物位於 `dist/test-0.48-whisper-*`，未覆寫正式 GitHub Release 資產。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-08-05 09:14 +08:00 執行來源與兩平台 Small size／SHA 核對、`inspectWhisperModels`、`whisper-cli` CPU smoke、兩 ZIP `unzip -t` 與 SHA 核對；完整 `npm run check` 亦通過。Small 載入／JSON 與封裝契約已有證據，但 Windows 實機、中文品質、長音訊、取消／Metal→CPU 尚未覆蓋。

## 6. 實際運行結果

- 判定：部分通過
- 證據：macOS bundled `whisper-cli` 實際以 `ggml-small.bin` 與 1 秒 WAV 完成 CPU transcribe，輸出 JSON 且記錄 `type=small`／multilingual；兩平台 unpacked Small 均可由 helper 驗證，ZIP SHA 為 macOS `521ece82aabf2b51fe6f81c48b0c1723daa41cb1818bd73d3fdba0160545b119`、Windows `e8c2e515571a8dd6c3a226ee3bb45134318a3e3f356ffe3442be5d7423220af3`。Windows 只在 macOS 主機完成檔案／manifest 驗證，沒有 Windows 實機結果。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無模型檔案、SHA、manifest 或 ZIP 完整性阻擋；Windows 實機與 Small 中文品質仍未驗證。
- 剩餘風險：Base 仍未隨包提供；Small 目前只有載入／封裝／短 CPU smoke 證據，未涵蓋 Windows、長音訊、取消／fallback、中文準確率、速度與記憶體。
- 給主要開發代理的具體修正要求：保留本輪 SHA／manifest／ZIP 證據；取得 Windows 10/11 x64 實機後重跑 Small health／轉錄／取消與安裝 smoke，並以中文長音訊建立品質 evidence；Base 另行下載與驗收，不得把本輪視為三模型完成。
- 可逐字引用完整結論句：**本輪 Whisper Small 測試包更新結論為有條件通過：來源與兩平台 unpacked 的 `ggml-small.bin` 均為 487,601,967 bytes、SHA-256 `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b`，whisper-cli 實際顯示 `type=small`／multilingual 並產生 JSON，兩 ZIP SHA／unzip 與 Small valid、Base missing 均核對一致；但 Windows 實機、Small 中文品質、長音訊、取消／fallback 與 Base 模型仍未驗收，不得宣稱三模型或正式 Release 完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
