# 離線字幕工廠 0.52.0

## YouTube 私人影片與字幕上傳（選用）

- 可從校閱頁選擇已匯出的 MP4 與最後保存的 `reviewed.srt`，連結 YouTube 頻道並檢視將上傳的標題、說明、語言及兒童內容設定。
- 必須明確勾選外送同意才會開始；影片隱私狀態固定為私人，字幕以獨立操作上傳。
- 需先在 Google Cloud 建立 Desktop OAuth client、啟用 YouTube Data API v3，並在 App 匯入 OAuth client JSON。首次連線會開啟系統瀏覽器供使用者登入及授權；OAuth Testing 模式下，登入帳號需列為測試使用者。
- 本功能要求 `youtube.force-ssl` OAuth scope。Google 將此 scope 列為可檢視、編輯及永久刪除 YouTube 影片、評分、留言與字幕；請在 Google 授權畫面確認授權對象與範圍。
- 若字幕上傳失敗而已有影片 ID，可只重試原字幕 snapshot。若影片上傳結果不明且沒有影片 ID，請先至 YouTube Studio 核對，避免重複上傳。此版不提供跨重啟位元組續傳；移除本機授權或專案不會撤銷 Google 帳戶端授權、刪除遠端影片或清除本機發布摘要。

## 穩定性與相依套件

- 更新至 Electron 43.8.0 與 electron-builder 26.17.0；Electron 仍維持 43 系列，以保留 macOS 12 最低支援目標。
- 加強 Ollama 子程序生命週期、Whisper 長媒體錯誤復原、字幕校閱窄版排版與 packaged UI 測試。
- 修正尚無 AI 優化紀錄的一般校閱工作被誤報為 AI 狀態恢復失敗。
- `npm run check`、YouTube OAuth／傳輸／生命週期 mock 測試與本機 packaged UI 檢查通過。這些檢查不等同真實 Google 頻道驗收。

## 本版範圍與已知限制

- 本次候選發行範圍為 macOS Apple Silicon（arm64）。Windows 0.52.0 尚未完成此版封裝及實機驗收，不包含 Windows 發行資產。
- 尚未以真實 Google OAuth client、macOS Keychain、個人頻道完成登入、影片上傳及字幕上傳端到端驗收。請將 YouTube 上傳視為尚未完成實帳號驗收的功能，首次使用前先以非重要／私人測試素材確認。
- 本版 packaged UI smoke 只驗證版面與互動；3 秒合成影片僅前進 0.000525 秒，不能視為有效播放、完整轉錄或上傳驗收。
- GitHub 自動產生的原始碼封存包含追蹤中的歷史治理文件；個人 home 路徑前綴已匿名化為 `<user-home>`。封存會包含治理紀錄，不包含本機建置產物。
- macOS app 為 ad-hoc 簽章，未使用 Apple Developer ID 簽章或公證；macOS 可能顯示安全性警告。只從本專案 GitHub Release 下載並核對發布頁提供的 SHA-256。
- Production dependency audit 為 0 vulnerabilities。完整開發相依樹仍包含 GitHub Advisory `GHSA-hp3w-g68c-fv3c`（`sprintf-js` <= 1.1.3，moderate；位於 electron-builder 的 build-time dependency chain）。該 advisory 目前未列出修補版本，且此套件不屬於 production dependency；升級前請重新檢查 advisory 與依賴解析結果。

## 安裝與驗證

請從 [GitHub Releases](https://github.com/twyderek/offline-subtitle-factory-app/releases) 取得與 CPU 架構相符的安裝檔。僅 macOS Apple Silicon 資產屬於本次 0.52.0 範圍；若尚未在 Release 頁看到 `v0.52.0`，請勿使用開發候選包作正式安裝。

開發驗證：

```bash
npm ci
npm run check
npm audit --omit=dev
```
