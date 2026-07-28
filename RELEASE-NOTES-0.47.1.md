# 離線字幕工廠 0.47.1

## 版本定位

0.47.1 是 0.47.0 的可追溯發布修正版，包含低可信片段校閱工作流、品質風險分數、問題篩選、批次選取、品質欄位安全保存，以及 AI 只處理品質篩選結果的範圍控制。

本版另外收斂發布來源與資產命名，使版本、tag、commit、Windows workflow、macOS／Windows 資產與 checksum 可獨立核對；既有 v0.47.0 Release 保留為歷史發布，不移動或覆蓋。

## 重要限制

- 內建 Whisper.cpp 實際 JSON 未提供 segment-level `confidence`／`no_speech_prob` 時，使用可重現的 `rule-score`，不偽造 engine confidence。
- Apple Silicon Metal runtime 曾發生 exit 139；若尚未完成修正與實機證據，CPU workaround 不代表 Metal 或跨平台 runtime 已驗收。
- Windows／macOS 安裝後、Electron renderer 與真實長音訊轉錄須依本版發布後實機證據判讀。
- Windows 未 Authenticode 簽章、macOS 未 Apple Developer ID 簽章／公證時，請先核對 SHA-256 並在非關鍵環境測試。

## 驗證狀態

- `npm run check`、封裝驗證、資產 checksum／digest 與發布後下載核對結果，均以本版工作紀錄與獨立發布審查為準。
- 未完成的簽章、公證、Metal、Electron 或實機項目不得描述為已完成。

## 公開資產

- macOS arm64：`offline-subtitle-factory-0.47.1-macos-arm64.dmg`、`offline-subtitle-factory-0.47.1-macos-arm64.zip`
- Windows x64：`offline-subtitle-factory-setup-0.47.1.exe`、`offline-subtitle-factory-portable-0.47.1.exe`
- Windows `latest.yml`、`SHA256SUMS-windows-x64.txt` 與 `SIGNING-STATUS-windows-x64.txt` 同步附於本 Release。
- Windows 安裝包未 Authenticode 簽章；請先核對 SHA-256。
