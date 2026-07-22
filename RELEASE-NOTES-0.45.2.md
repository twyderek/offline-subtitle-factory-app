# 離線字幕工廠 0.45.2

> **發布風險提醒**：Windows x64 Setup／Portable 未使用 Authenticode 簽章，可能顯示 Unknown Publisher 或 SmartScreen；macOS arm64 未使用 Apple Developer ID 簽章與公證，首次啟動可能被 Gatekeeper 阻擋。本版尚未完成 Windows／macOS 乾淨實機安裝測試。請核對隨附 SHA-256，並先在非關鍵環境測試。

## 版本定位

0.45.2 新增多語言 LLM 字幕優化，延續 0.45.1 的 Azure GPT-5 相容性與精簡 AI 面板。離線 Whisper、影片修剪、人工校閱與字幕輸出仍可在不啟用雲端 AI 的情況下使用。

## AI 供應商

- 新增 Groq 與 Google Gemini 設定，供應商 profile 與 API Key 分開保存。
- 切換非 Azure 供應商時會清空並停用 Azure Deployment／API Version，避免把舊值誤用到其他服務。
- 不支援的供應商 ID 會明確顯示錯誤，不再無聲回退成 OpenAI-compatible。

## 多語言 LLM

- 提供繁中、簡中、英文、日文、韓文、西班牙文、法文、德文、巴西葡萄牙文、越南文、泰文與印尼文。
- 支援自訂 BCP 47 標籤，例如 `fr-CA`、`zh-Hant-TW`、`de-CH-1901`。
- 翻譯、錯字標點、斷句、術語與贅詞模式均會使用所選目標語言。
- 設定、一般 API、AI 任務與 Prompt 共用標準化語言值；新非法值會拒絕，舊版無效設定安全回退繁中。
- 模型回傳若改變 cue 數量、ID 或順序會被拒絕；時間碼只取自原字幕。

## 驗證

- 完整 `npm run check` 與核心本機 API 回歸。
- BCP 47 基本、variant、extension、40／255 字元正向及超長／注入負向測試。
- 三個 API 非法值拒絕、舊設定啟動回退、cue 順序與 metadata 保護。
- 多語言設定 UI 實際操作驗證。
- 多語言開發 round3 獨立六面向審查通過。

## 操作說明

- 安裝目錄的 `resources/docs/0.45.2/USER-GUIDE.html` 為完整離線手冊。
- 手冊包含多語言與自訂 BCP 47 操作、Azure OpenAI 設定、GPT-5 錯誤排除與既有操作動畫。

## 已知限制

- 真實 LLM 是否完全遵循目標語言仍受模型能力影響，所有建議都必須人工確認。
- 本版仍是單一 cue 文字欄位，不包含雙語同屏、雙語 cue 資料模型或完整介面本地化。
- Windows 未簽章、macOS 未公證，且尚未完成跨平台乾淨實機測試。
- 本版未使用真實 Groq／Google Gemini API Key 執行外部 smoke test；provider contract 與本機 UI 驗證已完成。

## 版本注記

- 版本：`0.45.2`
- 標籤：`v0.45.2`
