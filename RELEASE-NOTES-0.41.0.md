# 離線字幕工廠 0.41.0

發布日期：2026-07-17

## 更新說明

本版完成 AI 字幕優化可靠性階段。長字幕處理遇到限流、逾時或暫時性服務錯誤時可自動重試；每批完成後保存 checkpoint，任務失敗或應用程式重啟後可以從未完成批次繼續。

## 新增功能

- HTTP 408、429、500、502、503、504 可重試錯誤分類。
- 網路錯誤及請求逾時分類。
- 支援 `Retry-After`、指數退避及隨機抖動。
- AI 設定新增最大重試次數與起始等待時間。
- 進度列顯示目前批次、重試次數及等待秒數。
- 新增 `POST /api/jobs/:id/resume-ai-optimize`。
- 每個 AI 任務具備 session ID、checkpoint、部分建議及可恢復狀態。
- server 重啟後將未完成任務標記為 interrupted，避免誤認為仍在執行。

## 安全與資料一致性

- 已完成批次不會在續傳時重送。
- 任務完成並由使用者接受建議前，不修改原字幕。
- cue ID、段落數、順序及時間碼保護維持不變。
- checkpoint 不包含 API Key 或 Authorization header。

## 測試

- mock provider 模擬 429 後成功，確認只重試一次並完成任務。
- mock provider 模擬第二批永久失敗，確認 checkpoint 停在第一批。
- 恢復後只送第二批，不重送第一批。
- `npm run check` 必須通過後才建立發布包。

## 版本注記

- 版本：`0.41.0`
- 分支：`codex/0.41-ai-reliability`
- 標籤：`v0.41.0`
- macOS：Apple Silicon DMG／ZIP，ad-hoc 簽章、未經 Apple 公證。
- Windows：x64 Setup／Portable，由 GitHub Actions 建置；正式簽章取決於 repository Code Signing secrets。
- Windows Actions 在有 Code Signing secrets 時建立並驗證正式簽章包；沒有 secrets 時只建立明確標示 `UNSIGNED INTERNAL PREVIEW` 的內部測試包。

## macOS Apple Silicon 成品

- DMG：`離線字幕工廠 0.41.0 macOS-arm64.dmg`，約 204 MB。
- ZIP：`離線字幕工廠 0.41.0 macOS-arm64.zip`，約 209 MB。
- DMG SHA-256：`3410607e1bba78678a4e890cdedc922e0d0de49d202be6a881318e6570e8db1d`。
- ZIP SHA-256：`3a233de24285ee96180e0b64d83a713916edf55aae13a782eb7ac606021e8bca`。
- `hdiutil verify` 與 `codesign --verify --deep --strict` 通過。
