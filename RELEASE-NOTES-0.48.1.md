# 離線字幕工廠 0.48.1

## 版本重點

- Whisper.cpp 可選 Tiny／Base／Small；安裝包維持只內建 Tiny，Base／Small 在首次使用時由 App 確認下載。
- 高階模型固定使用官方 Whisper.cpp revision，完成後驗證檔案大小與 SHA-256，並寫入使用者可寫入的模型快取。
- 模型下載支援進度、取消、重試與手動下載說明；取消或驗證失敗不會留下未完成檔案。
- Whisper 輸出的零長度或無效時間碼會安全略過；若沒有任何有效字幕則明確失敗。
- macOS Apple Silicon 的 Whisper.cpp Metal 非零退出可自動改用 CPU 重試。
- Ollama 多批次優化改用串流與 idle timeout，保留已完成 checkpoint，並補強逾時重試、無效 JSON、過長文字與翻譯契約修復。
- 前端會區分本機服務無法連線、非 JSON 回應與 AI provider 錯誤；啟動回應遺失時只查詢既有任務，不重複送出優化 POST。
- Azure OpenAI 能力檢查改用 `max_completion_tokens`，正式請求移除 deployment 不接受的內部欄位與 `model`。
- Electron 已由 33.4.11 升級至 43.3.0，electron-builder 由 25.1.8 升級至 26.15.7；升級後完整 `npm audit` 為 0 項已知弱點。

## Whisper 模型

- Tiny：隨安裝包提供，適合低資源與快速處理。
- Base：約 148 MB，適合一般電腦的品質／速度平衡。
- Small：約 488 MB，中文口說辨識通常較佳，但需要更多記憶體與處理時間。
- Base／Small 模型下載與手動匯入說明：`docs/WHISPER-MODEL-DOWNLOAD.md`。

## 平台資產

- macOS arm64：`offline-subtitle-factory-0.48.1-macos-arm64.dmg`、`offline-subtitle-factory-0.48.1-macos-arm64.zip`
- Windows x64：`offline-subtitle-factory-setup-0.48.1.exe`、`offline-subtitle-factory-portable-0.48.1.exe`
- macOS：`latest-mac.yml`、`SHA256SUMS-macos-arm64.txt`
- Windows：`latest.yml`、`SHA256SUMS-windows-x64.txt`、`SIGNING-STATUS-windows-x64.txt`

## 安全與隱私

- Whisper 模型只允許固定官方 URL、檔名、大小與 SHA-256，不接受任意下載網址。
- 模型寫入使用者資料目錄，不修改 Windows 安裝目錄。
- 影音與本機 Whisper 轉錄維持離線；只有使用者主動使用所設定的 AI provider 時，字幕文字才會送往該服務。
- API Key 不會寫入一般設定檔、Release 資產或工作日誌。
- 發布候選使用 Electron 43.3.0／electron-builder 26.15.7 建置，並已執行完整依賴安全稽核。

## 已知限制

- Windows 資產未使用 Authenticode，可能顯示 Unknown Publisher／SmartScreen；macOS 資產未使用 Apple Developer ID 簽章或公證。下載後請核對 SHA-256。
- 尚未取得本版 Windows 10／11 乾淨實機的安裝、解除安裝、首次 Base／Small 真實下載與長音訊完整工作流證據。
- macOS Metal fallback 已有 deterministic 與本機 runtime 證據，但仍缺本版乾淨使用者帳號的長音訊安裝後驗收。
- 真實 Azure endpoint 與不同 Windows Ollama 版本尚未完成本版外部 smoke；AI 建議仍須逐段人工確認。
- 模型檔案完整性通過不代表中文口說準確率已驗收；Base／Small 的速度、記憶體與準確率會依硬體及音訊品質不同。
