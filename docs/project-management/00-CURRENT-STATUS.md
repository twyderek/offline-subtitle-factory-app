# 目前專案狀態

> 最後查證日期：2026-07-22
> 現行版本：0.45.2（已發布）
> 現行公開版本：0.45.2
> 主分支：`main`

## 已完成成果

- Windows 10／11 x64：NSIS Setup 與 Portable 已建置並發布。
- Apple Silicon macOS 12+：DMG 與 ZIP 已發布。
- GitHub Release：<https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.45.2>
- 線上完整操作說明：<https://offline-subtitle-factory-0451-guide.derek62101.chatgpt.site>
- Windows 安裝包內含 `resources/docs/0.45.2/USER-GUIDE.html`、圖文資產與三段操作動畫。
- 0.45.1 已修正 Azure OpenAI GPT-5 的 `max_completion_tokens` 與 `temperature` 相容性，並加入可收合 AI 優化面板。

## 0.45.2 已發布成果

- 工作樹已完成多語言 LLM 字幕優化：12 個常用目標語言、自訂 BCP 47 標籤、前後端標準化、非法 API 值拒絕、舊設定回退與目標語言 Prompt。
- cue ID、數量、順序與時間碼保護已補強；交換順序的模型回應會被拒絕。
- 0.45.2 工作樹已補齊 Groq／Google Gemini 供應商識別、請求契約、profile／金鑰隔離、設定介面切換與未保存欄位連線防護；完整自動測試、本機瀏覽器實測及獨立審查通過。
- 自動測試、雙平台 CI／封裝與獨立審查已通過；v0.45.2 已公開發布。

## 發布資產狀態

- 現行公開 Release 已為 v0.45.2；GitHub Release：https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.45.2。
- v0.45.2 Windows 發布資產來自 CI run `29886823270`：`offline-subtitle-factory-setup-0.45.2.exe`、`offline-subtitle-factory-portable-0.45.2.exe`、`latest.yml` 與 SHA 已核對。
- v0.45.2 macOS arm64 發布資產為 ASCII DMG／ZIP；`latest-mac.yml` URL／path／size 與實際資產一致，DMG `hdiutil verify`、ZIP `unzip -t` 通過。

## 已知風險與未覆蓋項目

- Windows v0.45.2 候選資產未使用 Authenticode 簽章，可能顯示 Unknown Publisher／SmartScreen；使用者須核對 SHA-256。
- macOS v0.45.2 候選資產為 ad-hoc 簽章，未使用 Apple Developer ID 簽章或公證。
- Windows 尚缺乾淨實機的安裝、解除安裝、捷徑與離線手冊動畫播放 smoke test。
- npm audit 曾回報 high severity 建置依賴風險，尚待區分 runtime 與 build-only 影響。
- GitHub Actions 使用的部分 action runtime 有 Node 20 deprecation 警告。
- 真實 LLM 是否完全遵循所選語言仍受模型能力影響，AI 建議必須逐段確認；多語言版本已完成 macOS 候選重建，但尚未完成跨平台乾淨實機驗證。
- Groq／Gemini 目前僅以 contract mock 與本機 UI 驗證，尚未用真實供應商金鑰做外部 smoke test。
- 已知 BUG-012：部分舊設定會顯示 OpenAI-compatible，但沿用 Gemini URL／模型；已排入 0.45.3，將加入安全遷移與回歸測試。

## 下一版本 0.45.3 工作重點

1. BUG-012：修正 OpenAI-compatible／Gemini 舊設定遷移，確保 provider、Base URL、model 與 profile 一致。
2. 執行 Windows 11／macOS 乾淨實機安裝、啟動、解除安裝與離線手冊操作驗收。
3. 使用測試用 Groq／Gemini 帳號執行不含敏感資料的真實供應商 smoke test。
4. 評估 Windows Authenticode、macOS Developer ID／公證，以及 npm audit runtime／build-only 影響。
5. 更新 0.45.3 Release notes、跨平台候選資產與 updater metadata，完成獨立發布審查。
