# 離線字幕工廠 0.30.1

發布日期：2026-07-16

## 修正內容

- 修正校閱畫面字幕樣式預覽比例：字幕字級、外框與垂直邊距現在會依照 ASS PlayRes 1920x1080、影片實際顯示尺寸與黑邊偏移換算，讓 24 字級等設定更接近 FFmpeg/ASS 實際燒錄結果。
- 修正中文檔名亂碼：影片與 SRT 上傳檔名若在 Windows/Electron multipart 流程中被誤解成 Latin-1，後端會還原為 UTF-8 中文，並套用於最近專案、review-data 與燒錄輸出檔名。
- 修正 Windows 簽章流程：正式 `npm run electron:build` 會先檢查 Code Signing 憑證，打包後驗證 Setup 與 Portable EXE 的 Authenticode 簽章；內部未簽章測試包請改用 `npm run electron:build:unsigned`。
- 更新 Windows GitHub Actions artifact 名稱為 `offline-subtitle-factory-0.30.1-windows-x64`。

## 驗證

- `npm run check`
- 語法檢查：`server.mjs`、`public/app.js`、`public/review.js`、`public/trim.js`、`electron/main.mjs`
- 測試：影片修剪資料層測試、核心 API 回歸測試、中文檔名與 mojibake 檔名案例

## 發布注意

- Windows 正式安裝版需要設定 GitHub secrets `WINDOWS_CODESIGN_PFX_BASE64` 與 `WINDOWS_CODESIGN_PASSWORD`，或在本機提供可用 Code Signing 憑證後才能產生可信簽章成品。
- 若未設定憑證，正式打包流程會停止，避免不小心發布未簽章成品。
