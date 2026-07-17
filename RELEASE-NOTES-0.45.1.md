# 離線字幕工廠 0.45.1

## 版本定位

0.45.1 是 Azure OpenAI GPT-5 相容性與校閱介面更新。離線 Whisper、影片修剪、人工校閱及字幕輸出流程維持不變。

## Azure OpenAI GPT-5 修正

- Azure 連線測試由 `max_tokens` 改為 `max_completion_tokens`。
- 測試輸出上限提高為 16，避免推理模型因上限過低無法產生測試回應。
- 字幕優化請求移除固定的 `temperature: 0.1`，使用模型支援的預設值。
- Provider 與 optimizer 測試會確認不再送出上述不相容參數。

## 校閱介面

- AI 字幕優化工具列可展開或收合，預設使用精簡模式。
- 精簡模式保留 AI 連線狀態與「展開 AI 優化」按鈕，字幕清單可使用更多垂直空間。
- 展開／收合偏好保存在本機；開始或繼續 AI 任務時自動展開，確保進度與操作可見。
- 切換按鈕提供 `aria-expanded` 與 `aria-controls`，支援鍵盤及輔助技術。

## 驗證

- `npm run check`
- Azure provider contract tests
- AI optimizer request compatibility tests
- macOS arm64 App、DMG 映像與封裝內容驗證

## 完整操作說明

- 安裝包內含 `docs/0.45.1/USER-GUIDE.html`，無網路時也可直接用瀏覽器閱讀。
- 手冊包含安裝、建立專案、載入影片、字幕校閱、AI 優化、Azure OpenAI 設定、錯誤排除及字幕輸出。
- 容易出錯的 AI 面板切換、Azure 設定及 GPT-5 參數錯誤均附操作動畫。
- 線上版：[離線字幕工廠 0.45.1 完整操作說明](https://offline-subtitle-factory-0451-guide.derek62101.chatgpt.site)

## 版本注記

- 版本：`0.45.1`
- 建議標籤：`v0.45.1`
