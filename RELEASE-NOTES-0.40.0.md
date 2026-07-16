# 離線字幕工廠 0.40.0

發布日期：2026-07-16

## AI 字幕優化

- 校閱工作區新增 OpenAI 與 OpenAI-compatible API 設定。
- 支援錯字標點、斷句、術語統一、移除贅詞及翻譯。
- 支援全部字幕或目前字幕、分批進度、取消與連線測試。
- AI 建議不會直接覆蓋字幕；可逐項或全部接受／略過。
- 後端驗證 cue ID、段落數、重複 ID、空白內容與異常文字長度。
- 接受建議時只更新字幕文字，不修改原始時間碼。

## 隱私與安全

- AI 功能預設停用，不影響原有離線轉錄、校閱、修剪與輸出。
- 啟用 AI 時只傳送字幕文字，不傳送影片或音訊。
- API Key 不會送回瀏覽器，也不會出現在任務報告與工作日誌。
- 支援以 `SUBTITLE_AI_API_KEY` 環境變數提供金鑰。

## 驗證

- `npm run check` 通過。
- AI optimizer 測試涵蓋 cue ID、時間碼、批次進度、修改差異及無效回應拒絕。
- 既有影片修剪、聲波、字幕重算、API token、Origin 與任務生命週期回歸測試通過。

## macOS Apple Silicon 成品

- DMG：`離線字幕工廠 0.40.0 macOS-arm64.dmg`（約 204 MB）
- ZIP：`離線字幕工廠 0.40.0 macOS-arm64.zip`（約 209 MB）
- DMG SHA-256：`f64a1c8b74e29c43b02e809f0dbfdc7ee244bd3502d20ac37b3c72a0284fa3d6`
- ZIP SHA-256：`227233dd9f7ec146232aa90fd60bf85ae01eb67c3a8b035f56f0e5275515e135`
- `hdiutil verify` 與 `codesign --verify --deep --strict` 通過。
- 目前為未經 Apple 公證的測試版本，首次開啟可能需要在 Finder 按右鍵選擇「打開」。
