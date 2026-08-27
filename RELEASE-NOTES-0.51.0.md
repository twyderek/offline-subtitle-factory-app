# 離線字幕工廠 0.51.0（開發中）

## 版本重點

- 新增可選的 Anthropic Claude provider；校閱頁可保存 Anthropic Base URL、模型、批次與 API Key。
- 模型清單與連線測試使用 Anthropic `/v1/models`，避免為測試連線產生模型輸出；字幕優化使用 `/v1/messages`。
- 請求使用 `x-api-key` 與 `anthropic-version: 2023-06-01`；system prompt、`max_completion_tokens` 與 Anthropic content blocks 會轉接至既有 AI optimizer contract。
- OpenAI 專用 `response_format`、`operation`、輸出語言與 cue 數量／ID metadata 不會傳送至 Anthropic；回應仍經 cue ID、數量、順序、文字長度與語言驗證，結果只形成待人工接受的建議。
- Anthropic profile、runtime key 與磁碟 secret 以 provider ID 隔離；API Key 不寫入一般設定、不回傳到畫面，也不出現在測試訊息與日誌。
- 已建立 `../dist/mac-arm64/` 本機 macOS arm64 directory 測試候選；受控權限 packaged renderer smoke 通過首頁、設定、Breeze 首次選擇 modal、manual SRT 任務完成、trim／AI review 資產與 Anthropic provider marker。候選僅供隔離測試，未公證、未使用真實 API Key。
- 已建立 `../dist/win-unpacked/` Windows x64 cross-build directory 測試候選；runtime manifest、x86-64 PE、SHA-256 與 Anthropic marker 靜態核對通過。因建置主機為 macOS 且沒有 Wine，尚未完成 Windows renderer／安裝／解除安裝／實機 smoke。
- 已建立 `../dist/test-build-0.51.0-91eca2b/` Windows x64 unsigned Setup／Portable 測試包；Setup／Portable／blockmap／`latest.yml`、SHA-256 與 Setup SHA-512／size metadata 已核對。建置主機為 macOS，尚未完成 Windows 實機安裝、Authenticode 或 renderer smoke。

## 隱私、相容性與限制

- Anthropic 是雲端服務；啟用前必須保存 API Key 並確認字幕資料傳送同意。影片與音訊不會上傳，但字幕文字會送往所選 endpoint。
- `https://api.anthropic.com` 為預設 Base URL；自訂 proxy 必須提供相容的 `/v1/models` 與 `/v1/messages` 介面及相同認證語意。
- 本輪只完成 deterministic contract、核心 API 與 renderer source 驗證，未使用真實 Claude API Key，未驗證外部模型品質、計費、速率限制或跨平台封裝。
- 0.51.0 尚未建立 tag、正式安裝包或 GitHub Release；公開 Latest 仍為 `v0.49.1`。本機 directory candidate 不等同跨平台或正式發布驗收。
