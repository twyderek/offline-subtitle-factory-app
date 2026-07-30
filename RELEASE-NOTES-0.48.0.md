# 離線字幕工廠 0.48.0

## 版本重點

- 支援 Ollama 與 LM Studio 本機 OpenAI-compatible 端點。
- AI 翻譯模式固定使用原文輸入，結果只寫入譯文欄位。
- 新增雙語顯示開關，可選擇同時顯示原文／譯文或僅顯示譯文。
- 術語表按字幕批次篩選，避免不相關術語污染模型提示。
- 防止 cue ID、段落數、順序、時間碼與翻譯語言錯誤。
- 清理模型混入的分析文字、JSON 後綴與提示詞回聲。
- 過短、不符語系或無法安全清理的結果會拒絕或保留原文，不自動覆蓋字幕。

## 本機模型建議

- Ollama 基礎測試：`llama3.2:1b`
- 日文／較高品質測試：`llama3.2:3b`
- 安裝：`ollama pull llama3.2:3b`
- Base URL：`http://127.0.0.1:11434/v1`
- API Key：本機 Ollama 不需要。
- LM Studio 設定與模型建議請參考 `docs/LOCAL-LLM-SETUP.md`。

## 平台資產

- macOS arm64：`offline-subtitle-factory-0.48.0-macos-arm64.dmg`、`offline-subtitle-factory-0.48.0-macos-arm64.zip`
- Windows x64：`offline-subtitle-factory-setup-0.48.0.exe`、`offline-subtitle-factory-portable-0.48.0.exe`
- macOS：`latest-mac.yml`、`SHA256SUMS-macos-arm64.txt`
- Windows：`latest.yml`、`SHA256SUMS-windows-x64.txt`、`SIGNING-STATUS-windows-x64.txt`

## 已知限制

- Windows 未 Authenticode 簽章，macOS 未 Apple Developer ID 簽章／公證。
- 尚未完成乾淨 Windows 10／11 實機的安裝、啟動、解除安裝與完整字幕工作流驗收；macOS 亦未完成乾淨使用者帳號的 DMG 安裝後完整操作驗收。現有證據包含封裝、runtime、macOS 複製安裝 smoke test 與自動回歸，不能取代跨平台乾淨實機測試。
- 小型本機模型可能產生不自然翻譯，所有 AI 建議仍須逐段人工確認。
- 若模型無法輸出所選語言，系統會安全拒絕，不會將錯誤內容寫入原文。
