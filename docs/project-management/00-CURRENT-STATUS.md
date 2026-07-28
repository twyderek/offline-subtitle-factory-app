# 目前專案狀態

> 最後查證日期：2026-07-28
> 現行版本：0.48.0（開發中）
> 現行公開版本：0.47.1
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
- 目前工作樹新增語系選項調整：設定與 AI 輸出選單移除簡體中文；既有 `zh-CN` 介面設定載入時回退繁體中文，待本輪測試與獨立審查完成後納入下一個修正版。

## 歷史 0.45.2 發布資產狀態

- v0.45.2 為歷史公開 Release；目前公開版本已更新為 v0.47.1。
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

## 有效常設授權

- `AUTH-2026-07-23-01`：需求提出者／產品負責人已統一同意 Windows Authenticode 未簽章、macOS 未經 Apple Developer ID 簽章／公證狀態下對外發布。每次發布仍須引用授權 ID、揭露風險並完成測試、審查、SHA 與資產核對；未實機測試及其他風險不在此授權範圍。詳見 `09-STANDING-AUTHORIZATIONS.md`。

## 0.48.0 開發中工作重點

1. `FR-021`：新增 Ollama／LM Studio 本機 provider、固定常見端點探測與模型清單。
2. 只有精確 loopback hostname 才免 API Key 與雲端資料傳送同意；遠端端點維持既有安全門檻。
3. 本機 provider 使用較小批次，沿用 cue ID／數量／順序／時間碼保護與人工接受流程。
4. 提供本機／雲端隱私標示及模型 JSON、繁體中文、context 能力檢查；不自動下載模型。
5. 自動回歸已分別覆蓋 Ollama 的模型探索／能力／redirect 防護，以及 LM Studio 的完整優化、重試、取消、checkpoint／續跑；已修正「已有 checkpoint 的取消任務被誤標不可續跑」問題；macOS arm64 未簽章目錄版已完成 runtime、打包與 Electron renderer 預封裝驗證。
6. macOS arm64 目錄版與 Windows x64 未簽章目錄版均已產出並完成 runtime／資產驗證；macOS DMG 已建立且格式可讀，但 Windows renderer 仍待 Windows 實機啟動，macOS DMG 安裝後仍待驗收；本輪 ZIP 未列為通過資產。
7. Ollama／LM Studio 各至少一個真實模型、真正移除外網後的端到端仍待實機驗證；0.48.0 尚未發布。

## 0.46.0 已公開發布

0.46.0 已於 2026-07-23 建立公開 Release：https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.46.0。macOS arm64 DMG／ZIP 與 SHA-256 已上傳並核對 GitHub digest；Windows x64 由 CI run `29978500348` 完成真實 FFmpeg、EXE archive、手冊檔與 SHA-256 驗證，產出 unsigned artifact（保留 14 天），但未附 Authenticode 簽章。未核對一致性的 macOS updater metadata／blockmap 未上傳。

## 0.47.1 修正版已公開發布

- 已加入品質風險評估與校閱頁篩選：低 confidence／高 no-speech、過長、閱讀速度過快、重複文字與疑似專有名詞。
- 引擎品質指標缺失時只保存 `rule-score` 來源與規則結果，不偽造 confidence；已接入 Whisper.cpp JSON quality metadata 的容錯解析與 cue 對應通道，但本機內建 runtime smoke 發生 exit 139，尚未完成跨平台實際欄位映射與實機驗收。
- 0.47 rule-score fallback、quality metadata 安全回落、stale metadata 防護與 strict cue ID／時間／數量驗證已完成條件複審。
- GitHub `v0.47.0` Release 已保留為歷史發布，target commit 為 `7946f7f`；本版未移動或覆蓋該 tag。
- GitHub `v0.47.1` 已公開發布，annotated tag `v0.47.1` 解析至修正版 commit `0bd3b53`；Release 已包含 macOS arm64 DMG／ZIP、Windows Setup／Portable、`latest.yml`、Windows SHA-256 與簽章狀態說明。
- 发布后 GitHub API 已核对 7 项公开资产的名称、大小、SHA-256 digest 与直接下载 URL；本地 macOS DMG／ZIP 与 Windows artifact 内容及清单 SHA 已核对一致。
- 0.47.0 的 rule-score fallback、quality metadata 安全回落、stale metadata 防護與 strict cue ID／時間／數量驗證延續至本版；Metal exit 139、未簽章／未公證與跨平台實機缺口仍須如實揭露。
- 发布后仍须持续揭露 Windows 未 Authenticode、macOS 未 Developer ID／公证、Metal exit 139、Electron 与跨平台实机缺口；本版发布独立审查结果记录于工作纪錄与 reviews。
