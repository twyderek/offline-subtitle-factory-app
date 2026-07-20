# 打包與發布流程

## 輸入

- 通過測試與獨立審查的 commit、版本、平台、簽章狀態、Release notes。

## 步驟

1. 確認工作樹、版本、commit、tag／branch 與建置環境。
2. 準備固定 runtime 並比對來源 SHA。
3. 執行完整測試後建置 Setup／Portable 或 DMG／ZIP。
4. 檢查 unpacked 與最終封裝內容、格式、簽章及 checksum。
5. 下載 CI artifact 做交叉驗證；不可只相信 job 綠燈。
6. 使用穩定 ASCII Release 檔名，確保 blockmap、`latest.yml` 與 checksum 一致。
7. 上傳後核對 GitHub 實際名稱、大小、digest、下載 URL 與說明。
8. 清楚揭露未簽章、未公證、未實機測試等條件。

## 輸出

- 可下載且可校驗的安裝資產、完整 Release notes、發布後核對證據。

## 停止條件

- 測試／審查失敗、checksum 不一致、簽章宣稱不實、資產命名破壞 updater、或發布權限未取得。
