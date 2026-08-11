# 獨立審查報告：FR-023 Whisper 高階模型首次下載

- 審查對象 commit／版本：工作樹現行 0.48.0 測試版與 macOS arm64／Windows x64 測試封裝（2026-08-06）
- 對應 08-CHANGE-LOG 條目：2026-08-06 — FR-023 Whisper 高階模型首次下載驗證
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-06 10:43 +08:00；獨立讀取需求／設計／測試／除錯紀錄、現行來源與最新 ZIP，未沿用主要代理的評價性結論。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:39` 與 `03-FUNCTIONAL-DESIGN.md:53-55` 要求固定官方 revision／檔名／大小／SHA-256、寫入 Electron `userData` 快取、進度、暫存檔／原子置換、失敗清理、超時錯誤、首次選擇或提交前確認及手動 URL。`lib/whisper-model-download.mjs:9-34,93-149`、`electron/main.mjs:447-467,601-614`、`server.mjs:963-1035,3390-3419` 與 `public/app.js:412-584,866-867` 已對應這些契約；缺模型仍在 `server.mjs:1458-1465` 阻止 ASR。

## 2. 邏輯正確性

- 判定：通過
- 證據：下載器只接受固定白名單，檢查 HTTP、response body、`content-length` 上限、實際 byte 數與 SHA-256，成功後才置換正式檔；失敗在 `finally` 清理 `.download`。`timeoutMs` 預設 15 分鐘並以 `AbortController` 轉成可採取行動的「下載逾時」錯誤（`lib/whisper-model-download.mjs:103-147`）。Windows 既有檔案先移至唯一 `.previous` 備份，置換失敗嘗試回復；測試以 `platform:'win32'` 證明損壞既有檔案可被替換且不留備份（`scripts/test-whisper-model-download.mjs:40-45`）。Server 的 active job、狀態碼與提交前重新檢查亦保持一致。

## 3. 邊界情況

- 判定：部分通過
- 證據：focused fixture 已覆蓋成功／進度 100%、錯誤 SHA、大小超限、HTTP 503、失敗暫存檔清理、Windows 既有檔案替換與永不回應的 timeout（`scripts/test-whisper-model-download.mjs:34-66`）。仍未在真實 Windows 檔案系統驗證 userData 權限、磁碟不足、睡眠或串流中途斷線；也未測 Windows 第二次 rename 與備份回復同時失敗、`.previous` 殘留清理或使用者在 UI 關閉視窗後仍有背景下載的行為。這些是本機 fixture 未涵蓋的跨平台邊界，不應被 mock 結果取代。

## 4. 程式碼品質

- 判定：通過
- 證據：下載定義、錯誤格式化、置換策略與串流驗證集中於 `lib/whisper-model-download.mjs`；server 將狀態／啟動／完成／失敗分層，renderer 只透過固定 API 輪詢。錯誤訊息保留官方 URL 與手動快取指引，未引入任意 URL／檔名輸入。Windows 備份回復採最佳努力並吞掉清理例外，故仍需實機觀察，但目前沒有造成已證實資料遺失的證據。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：本審查於 2026-08-06 10:44 +08:00 獨立執行 `npm run check` 通過，包含 docs check、Node syntax、三模型模擬 runtime、下載 fixture（含 timeout／Windows replace）、核心 API 與完整 `npm test` 回歸。兩份最新 ZIP 均 `unzip -t` 通過；source marker 亦逐一核對一致：downloader `00fe35005bc80ec106d7445a4f6c9e1112c53bc790336c102841966dfcfc5eac`、server `e939d97092f3e9c6526da1d170f79dd306f0827f10c0ef80bdee725971c7dd95`、renderer `e79e534e53f5d0b966dfc6ab718f4f8b8bf95841d6bd40660f18ae31632780c0`、HTML `e0a010680e03ad191b6c67a278cee0c8563a6eb3a38f9534b79cf1fe4dc90bc6`、`package.json` `ce2fabe6b9e96af470a3fe056420f4b7632cb84c5bfe5c011c9abdd7ad3e12af`。測試沒有覆蓋真實 Hugging Face 網路、Windows 實機、休眠／中斷續跑或實際中文品質。

## 6. 實際運行結果

- 判定：部分通過
- 證據：最新 macOS ZIP SHA-256 為 `630a2082bc42672b4d3247f27c30891ac01b68444dbf31a26f58a4b5d671dfc3`，Windows ZIP SHA-256 為 `831780e14579dd963e6a2591ce7b7e8a7c44c900b03272ef8391ff61df6e6dd2`；兩平台封裝內的 source marker 與工作樹一致，manifest target 分別為 `darwin-arm64`／`win32-x64`，Tiny／Small manifest 大小與 SHA 一致。這證明測試包完整性與來源同步；但目前主機沒有 Windows 實機，沒有實際下載 147,951,465-byte Base 或 487,601,967-byte Small，也沒有中文口說轉錄品質、安裝後權限或真實網路結果。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無本輪來源、API、timeout、hash／size 驗證、ZIP 完整性或 source marker 的阻擋問題；正式跨平台完成宣稱仍受下列外部驗收條件限制。
- 剩餘風險：Windows userData 寫入／既有檔案替換、網路中斷／睡眠、真實下載速度與權限、中文口說辨識品質、長音訊與實機記憶體／效能尚未驗證；UI 關閉 modal 不會取消 server 端已啟動的下載，需在產品決策上明確保留或補上取消 API。
- 給主要開發代理的具體修正要求：保留本輪 source marker、ZIP SHA 與 fixture 證據；取得 Windows 10/11 x64 實機後驗證 userData 寫入、成功／失敗／中斷／重試與乾淨安裝，並以真實 Base／Small 中文素材執行轉錄品質 smoke。若補上下載取消，需加入 server abort、renderer 狀態回復與回歸測試；在上述 evidence 取得前不得宣稱正式 Release 或跨平台實機完成。
- 可逐字引用完整結論句：**本輪 FR-023 獨立審查結論為有條件通過：固定官方 revision／檔名／大小／SHA-256、userData 快取、進度、timeout、暫存檔清理、Windows 既有檔案替換與缺模型阻擋已有來源、fixture、完整 `npm run check` 及兩平台最新 ZIP source marker／SHA 證據；但 Windows 實機權限與替換、真實網路下載、中斷／續跑、中文口說品質及長音訊仍未驗證，且 UI 關閉 modal 不會取消背景下載，因此不得宣稱 FR-023 或跨平台正式 Release 已完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
