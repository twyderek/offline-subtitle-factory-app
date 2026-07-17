# 離線字幕工廠 0.45.0

## 版本定位

0.45.0 完成 Roadmap 0.42～0.45 的 AI 校閱工具、安全與多供應商基礎。原有離線 Whisper、影片修剪、人工校閱及輸出流程不依賴 AI，未啟用 AI 時不會發出外部請求。

## 0.42：術語、Prompt 與選取範圍

- 專案級術語表，支援原詞、標準詞、大小寫、禁止翻譯與備註資料模型。
- CSV／JSON 匯入及 JSON／CSV 後端匯出。
- 五種 Prompt 範本獨立保存，系統 cue 安全約束不會被自訂內容覆蓋。
- 支援多段勾選、目前字幕、全部字幕及搜尋結果範圍。
- 執行前顯示預計 cue 數及批次數。

## 0.43：報告與復原

- 每次任務建立 UUID session。
- 保存來源快照、建議、決策、供應商、模型、模式及統計。
- 產出 `suggestions.json`、`optimized-preview.srt`、`REPORT.md`。
- 支援撤銷及重新套用；若字幕後續經人工修改，保留人工內容並列為衝突。

## 0.44：安全金鑰與隱私

- Electron 桌面版使用 `safeStorage`，由 macOS Keychain／Windows DPAPI 提供加密。
- 舊 `ai-secrets.json` 啟動時一次性遷移，成功後移除明文檔案。
- 金鑰依供應商隔離，可替換與清除；API 回應不回傳金鑰。
- 首次啟用雲端 AI 必須確認資料傳送同意，介面明示不傳影片與音訊。

## 0.45：多供應商 Adapter

- 統一連線測試、模型列表、優化、取消及錯誤分類介面。
- 正式支援 OpenAI、OpenAI-compatible、Azure OpenAI。
- 供應商宣告 JSON Schema、串流、模型列表與本機端點能力。
- Anthropic Claude 與 Google Gemini 依 Roadmap 延至 0.51 評估。
- Provider contract tests 不需要真實 API，也不會產生費用。

## 驗證

- `npm run check`
- cue ID、段落數與時間碼保護測試
- 術語跨批次一致性測試
- OpenAI／compatible／Azure provider contract tests
- AI 停用與 API Key 不洩漏回歸測試

## 版本注記

- 版本：`0.45.0`
- 分支：`codex/0.45-ai-workflow`
- 建議標籤：`v0.45.0`
