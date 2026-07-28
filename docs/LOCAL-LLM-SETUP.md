# 本機語言模型設定手冊

本專案 0.48 支援 Ollama 與 LM Studio 的 OpenAI-compatible 本機端點。兩者都必須先在本機啟動服務，專案才可使用。

## LM Studio（macOS）

1. 從 [LM Studio 官方下載頁](https://lmstudio.ai/download) 安裝並開啟 LM Studio。
2. 下載並載入模型。建議先使用 `qwen2.5-1.5b-instruct`；本次測試已驗證可完成 JSON 與多 cue 流程。
3. 啟動 Local Server，預設端點為 `http://127.0.0.1:1234`。
4. 專案設定填入：

   - Provider：`lm-studio`
   - Base URL：`http://127.0.0.1:1234/v1`
   - Model：`qwen2.5-1.5b-instruct`
   - Batch size：1–5
   - API Key：本機端點不需要

驗證：

```bash
curl http://127.0.0.1:1234/v1/models
```

注意：Qwen 2.5 7B Q4_K_M 雖已下載（約 4.68 GB），目前主機記憶體 guardrail 阻止載入；不要把「已下載」視為「可用」。

## Ollama（macOS／Windows）

1. 從 [Ollama 官方網站](https://ollama.com/download) 安裝並啟動 Ollama。
2. 下載模型，例如：

```bash
ollama pull llama3.2:1b
```

3. 確認服務端點 `http://127.0.0.1:11434`。
4. 專案設定填入：

   - Provider：`ollama`
   - Base URL：`http://127.0.0.1:11434/v1`
   - Model：`llama3.2:1b`
   - API Key：本機端點不需要

驗證：

```bash
curl http://127.0.0.1:11434/v1/models
```

## 模型建議

| 模型 | 用途 | 本次狀態 |
| --- | --- | --- |
| Qwen 0.5B | 低資源快速連線測試 | JSON 不穩定，不建議品質驗收 |
| Qwen 1.5B | 一般本機功能測試 | 已完成單 cue／多 cue 驗證 |
| Qwen 7B Q4_K_M | 較高品質測試 | 已下載，但本機記憶體不足未載入 |
| Llama 3.2 1B | Ollama 基礎測試 | 已完成實際模型驗證 |

所有 AI 建議都必須人工逐段確認；本機模型通過 JSON 或 API 測試，不代表字幕品質驗收通過。

## 專案設定位置

macOS 持久設定：

`~/Library/Application Support/offline-subtitle-factory/config/settings.json`

本機端點會標記為 `endpointPrivacy: local`，不需要雲端同意或 API Key。遠端 URL 不應直接取代本機端點。
