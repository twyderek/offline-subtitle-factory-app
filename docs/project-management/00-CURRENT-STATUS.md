# 目前專案狀態

> 最後查證日期：2026-07-20
> 現行版本：0.45.2（發布候選）
> 現行公開版本：0.45.1
> 主分支：`main`

## 已完成成果

- Windows 10／11 x64：NSIS Setup 與 Portable 已建置並發布。
- Apple Silicon macOS 12+：DMG 與 ZIP 已發布。
- GitHub Release：<https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.45.1>
- 線上完整操作說明：<https://offline-subtitle-factory-0451-guide.derek62101.chatgpt.site>
- Windows 安裝包內含 `resources/docs/0.45.1/USER-GUIDE.html`、圖文資產與三段操作動畫。
- 0.45.1 已修正 Azure OpenAI GPT-5 的 `max_completion_tokens` 與 `temperature` 相容性，並加入可收合 AI 優化面板。

## 未發布開發成果

- 工作樹已完成多語言 LLM 字幕優化：12 個常用目標語言、自訂 BCP 47 標籤、前後端標準化、非法 API 值拒絕、舊設定回退與目標語言 Prompt。
- cue ID、數量、順序與時間碼保護已補強；交換順序的模型回應會被拒絕。
- 自動測試與 round3 獨立審查已通過；目前正依明確發布授權建置 0.45.2，現行公開版在 GitHub Release 完成前仍是 0.45.1。

## 發布資產狀態

- Windows Setup：`offline-subtitle-factory-setup-0.45.1.exe`
- Windows Portable：`offline-subtitle-factory-portable-0.45.1.exe`
- Windows SHA-256：`SHA256SUMS-windows-x64.txt`
- macOS：`0.45.1.macOS-arm64.dmg`、`0.45.1.macOS-arm64.zip`

## 已知風險與未覆蓋項目

- Windows 0.45.1 未使用 Authenticode 簽章，可能顯示 Unknown Publisher／SmartScreen；使用者須核對 SHA-256。
- macOS 為 ad-hoc 簽章，未使用 Apple Developer ID 公證。
- Windows 尚缺乾淨實機的安裝、解除安裝、捷徑與離線手冊動畫播放 smoke test。
- npm audit 曾回報 high severity 建置依賴風險，尚待區分 runtime 與 build-only 影響。
- GitHub Actions 使用的部分 action runtime 有 Node 20 deprecation 警告。
- 真實 LLM 是否完全遵循所選語言仍受模型能力影響，AI 建議必須逐段確認；多語言版本尚未做 Windows／macOS 封裝與實機驗證。

## 下一步優先順序

1. Windows 11 實機 smoke test，保存版本、硬體、步驟、截圖與結果。
2. 評估 Windows Authenticode 與 macOS Developer ID／公證。
3. 盤點 npm audit 項目，按可達性與執行環境分類。
4. 依 `AI-ROADMAP-0.50.md` 另行立項，未核准前不視為承諾功能。
