# 離線字幕工廠 0.51.0

## 版本重點

- 新增可選的 Anthropic Claude provider；校閱頁可保存 Anthropic Base URL、模型、批次與 API Key。
- 模型清單與連線測試使用 Anthropic `/v1/models`，依官方 cursor 契約讀完所有頁面，避免後頁模型被誤判不可用，也避免為測試連線產生模型輸出；字幕優化使用 `/v1/messages`。
- 請求使用 `x-api-key` 與 `anthropic-version: 2023-06-01`；system prompt、`max_completion_tokens` 與 Anthropic content blocks 會轉接至既有 AI optimizer contract。
- OpenAI 專用 `response_format`、`operation`、輸出語言與 cue 數量／ID metadata 不會傳送至 Anthropic；回應仍經 cue ID、數量、順序、文字長度與語言驗證，結果只形成待人工接受的建議。
- Anthropic request body 亦不傳送 `temperature`、`top_p` 或 `top_k`；這些欄位在 Claude Opus 4.7 之後以非預設值送出會被服務拒絕，0.51 改由 prompt 與既有 cue contract 約束輸出。
- Anthropic profile、runtime key 與磁碟 secret 以 provider ID 隔離；API Key 不寫入一般設定、不回傳到畫面，也不出現在測試訊息與日誌。
- provider profile 僅保存明確的連線／模型／批次／逾時欄位；即使輸入資料在巢狀 profile 內夾帶 API Key、Authorization、token、secret 或未知欄位，也不會寫入一般設定檔。
- Ollama 本機 optimizer 對合法但缺少 `cues` wrapper 的單一 cue object 增加一次性結構修復；修復後仍強制驗證 cue ID、數量、順序、文字長度與翻譯語系，不放寬其他 provider 的 strict contract。2026-09-15 以 Ollama 0.34.0／`llama3.2:1b` 完成 capability、native single-cue 與實際 optimizer path 驗收，未使用 API Key 或雲端服務。
- 2026-09-15 以 `llama3.2:1b` 完成 Ollama loopback 產品級人工流程：實際建立 2 cue 任務、完成翻譯、建立 AI session、接受 2 筆建議、undo／redo 各 2 筆，保存雙語校閱結果且時間碼未變；artifact `docs/project-management/evidence/2026-09-15-ollama-product-live-recheck-5.json` 另以保存前／後 SHA-256 證明原始 SRT 未覆蓋，並在 probe 啟動前拒絕遠端 URL／既有 evidence，以 exclusive create 防止 evidence 競態覆寫。此為 loopback 驗收，系統網路未關閉，真正斷網與 FR-021 整體仍未完成。
- 驗收範圍說明：需求方已刪除 LM Studio，本輪不執行其實機驗收；產品仍保留 `lm-studio` provider 與 deterministic tests。Ollama loopback API product path 已完成驗收，但真正斷網、Electron／瀏覽器 UI 與 FR-021 整體仍未完成，不將本輪例外視為 FR-021 整體完成。
- 已建立 `../dist/mac-arm64/` 本機 macOS arm64 directory 測試候選；受控權限 packaged renderer smoke 通過首頁、設定、Breeze 首次選擇 modal、manual SRT 任務完成、trim／AI review 資產與 Anthropic provider marker。候選僅供隔離測試，未公證、未使用真實 API Key。
- 已建立 `../dist/test-build-0.51.0-macos-88da220/` macOS arm64 DMG／ZIP 測試包；`hdiutil verify`、唯讀掛載、`unzip -t`、ad-hoc deep codesign、`latest-mac.yml` metadata、SHA-256 與 packaged renderer smoke 均通過。未完成 Developer ID／公證、DMG 拖曳安裝與乾淨環境驗收。
- 已建立 `../dist/win-unpacked/` Windows x64 cross-build directory 測試候選；runtime manifest、x86-64 PE、SHA-256 與 Anthropic marker 靜態核對通過。因建置主機為 macOS 且沒有 Wine，尚未完成 Windows renderer／安裝／解除安裝／實機 smoke。
- 已建立 `../dist/test-build-0.51.0-91eca2b/` Windows x64 unsigned Setup／Portable 測試包；Setup／Portable／blockmap／`latest.yml`、SHA-256 與 Setup SHA-512／size metadata 已核對。建置主機為 macOS，尚未完成 Windows 實機安裝、Authenticode 或 renderer smoke。
- Windows preview workflow 已更新至 0.51.0 branch／tag／artifact 與 packaged Release notes；本輪未觸發 GitHub runner，故不把 workflow 設定視為 Windows 實機或 CI 通過。
- 本次 GitHub Release 發布範圍為已完成 macOS Apple Silicon（arm64）驗收的 DMG／ZIP 與 updater metadata；Windows 安裝包、Windows 實機／CI 驗收依需求方要求暫不納入本次 Release。

## 隱私、相容性與限制

- Anthropic 是雲端服務；啟用前必須保存 API Key 並確認字幕資料傳送同意。影片與音訊不會上傳，但字幕文字會送往所選 endpoint。
- `https://api.anthropic.com` 為預設 Base URL；自訂 proxy 必須提供相容的 `/v1/models` 與 `/v1/messages` 介面及相同認證語意。
- 本輪只完成 deterministic contract、核心 API 與 renderer source 驗證，未使用真實 Claude API Key，未驗證外部模型品質、計費、速率限制或跨平台封裝。
- macOS 發布資產為 ad-hoc、未使用 Apple Developer ID 簽章／公證；Gatekeeper／`spctl` 限制、Windows 未納入、真正斷網、真實外部 AI API／模型品質與乾淨帳號安裝不在本次 Release 的已完成證據內。使用者應依附帶 SHA-256／updater metadata 核對下載內容。
