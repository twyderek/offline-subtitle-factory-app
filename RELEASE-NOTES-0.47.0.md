# 離線字幕工廠 0.47.0

## 版本定位

0.47.0 提供低可信片段校閱工作流：品質風險分數、問題篩選、批次選取、品質欄位安全保存，以及 AI 只處理品質篩選結果的範圍控制。

## 重要限制

- 內建 Whisper.cpp 目前實際 JSON 未提供 segment-level `confidence`／`no_speech_prob`；缺失時使用可重現的 `rule-score`，不偽造 engine confidence。
- Apple Silicon Metal runtime smoke 曾發生 exit 139；CPU workaround 可完成受控 smoke，但不代表跨平台 runtime 驗收完成。
- Windows／macOS 安裝後、Electron renderer、Windows CI 安裝與真實長音訊轉錄仍須依發布資產與後續實機驗收結果判讀。
- Windows 未 Authenticode 簽章、macOS 未 Apple Developer ID 簽章／公證時，請先核對 SHA-256 並在非關鍵環境測試。

## 驗證狀態

- `npm run check`：通過。
- `npm run docs:check:final`：通過於發布條目完成後。
- 獨立複審：rule-score fallback 與安全回落有條件通過；不代表 engine metadata 或跨平台實機完整驗收。
