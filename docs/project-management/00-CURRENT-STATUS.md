# 目前專案狀態

> 最後查證日期：2026-08-10
> 現行版本：0.48.1（發布候選，尚未建立 tag／Release）
> 現行公開版本：0.48.0（GitHub Latest）
> 發布 tag／commit：`v0.48.0` → `4cdb0177d84693a334fac79b96c596e1b416456f`
> 主分支：`main`

## 0.48.1 發布候選（未發布）

- FR-022 已在目前工作樹加入 Whisper `tiny`／`base`／`small` 三模式選擇、模型檔案／manifest SHA 驗證與缺檔錯誤處理。
- FR-023 已加入 Base／Small 首次使用下載確認、固定官方 revision、userData 模型快取、進度與大小／SHA-256 驗證；下載失敗可依官方 URL 手動匯入。
- SYNC-024 已從 GitHub 核對 Windows Ollama 修正（遠端 `4d0bee6` 與本地 HEAD `170e08e` 完全一致），並同步最新 Azure OpenAI request parameter 修正 `baed6d7` 至目前工作樹與本機測試包。
- REL-025 已把上述工作樹收斂成 `v0.48.1` 本機發布候選：版本與 Release notes 已建立，公開封裝只內建 Tiny，Base／Small 使用首次下載；下載取消會停止背景請求並清除暫存檔。Electron 已升級至 43.3.0、electron-builder 升級至 26.15.7，完整 `npm audit` 為 0；兩平台封裝、四項資產 SHA-256、updater SHA-512、partial-body 取消與 active DELETE API 已通過核對。2026-08-11 已補驗最後 build 的 DMG `hdiutil verify` 與 packaged renderer smoke；不可變 release commit／GitHub 閉環及未實機風險接受仍是公開發布停止條件。
- FR-024 已在專用分支加入 Breeze ASR 25 實驗性流程：固定官方 revision／大小／SHA-256、約 2.88 GiB 模型下載確認、外部 patched Whisper runtime 能力探針、任務執行與可採取行動的缺件提示；Whisper.cpp 仍為預設，Breeze runtime 與模型不納入安裝包。
- 三模式 deterministic mock runner、模型下載 fixture 與核心 API 回歸已通過；目前公開安裝包仍是 0.48.0，Base／Small 中文準確率、速度、記憶體及 Windows 實機安裝後驗收尚未完成。
- 本項功能尚未建立新 Release、未修改既有 v0.48.0 公開資產。

## 已完成成果

- Windows 10／11 x64：NSIS Setup 與 Portable 已建置並發布。
- Apple Silicon macOS 12+：DMG 與 ZIP 已發布。
- GitHub Release：<https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.48.0>
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

- v0.45.2 為歷史公開 Release；目前公開版本已更新為 v0.48.0。
- v0.45.2 Windows 發布資產來自 CI run `29886823270`：`offline-subtitle-factory-setup-0.45.2.exe`、`offline-subtitle-factory-portable-0.45.2.exe`、`latest.yml` 與 SHA 已核對。
- v0.45.2 macOS arm64 發布資產為 ASCII DMG／ZIP；`latest-mac.yml` URL／path／size 與實際資產一致，DMG `hdiutil verify`、ZIP `unzip -t` 通過。

## 已知風險與未覆蓋項目

- Windows v0.45.2 候選資產未使用 Authenticode 簽章，可能顯示 Unknown Publisher／SmartScreen；使用者須核對 SHA-256。
- macOS v0.45.2 候選資產為 ad-hoc 簽章，未使用 Apple Developer ID 簽章或公證。
- Windows 尚缺乾淨實機的安裝、解除安裝、捷徑與離線手冊動畫播放 smoke test。
- 0.48.1 候選已將 Electron 33.4.11／electron-builder 25.1.8 升至 Electron 43.3.0／electron-builder 26.15.7；2026-08-10 完整 `npm audit --json` 為 0，舊 runtime／build-only advisory 已解除。
- 依 2026-07-30 工作樹盤點，現行 Windows workflow 已使用 `actions/setup-node@v4`、Node 22；先前 Node 20 deprecation 描述尚待歷史 CI 證據核對，不視為目前 workflow 已證實問題。
- Electron major 升級已通過完整自動回歸、macOS arm64 目錄版打包與 packaged renderer smoke、Windows x64 目錄版／Setup／Portable 建置；Windows renderer、乾淨安裝與 macOS DMG／ZIP 安裝後實機仍未由本輪證據覆蓋。
- 真實 LLM 是否完全遵循所選語言仍受模型能力影響，AI 建議必須逐段確認；多語言版本已完成 macOS 候選重建，但尚未完成跨平台乾淨實機驗證。
- Groq／Gemini 目前僅以 contract mock 與本機 UI 驗證，尚未用真實供應商金鑰做外部 smoke test。
- BUG-012：OpenAI-compatible 搭配舊 Gemini URL／模型的安全遷移已由 `server.mjs` 與 `scripts/test-core.mjs` 覆蓋，包含設定檔保存後的正規化值；既有使用者設定檔的跨平台啟動／重啟實機升級仍待驗收，不提前宣稱完整關閉。
- BUG-WHISPER-METAL-139：Metal 非零退出→CPU fallback 的觸發策略已抽出並由平台／架構／forceCpu／退出碼矩陣 deterministic 覆蓋；child-process 失敗、取消中的 retry、長音訊與跨平台實機仍待驗收。
- FR-023：Windows userData 模型快取與固定來源下載已完成本機 API／fixture／封裝驗證；尚缺 Windows 實機的安裝權限、外網下載中斷／重試與中文口說品質驗收。
- SYNC-024：GitHub Windows 修正已確認不需重複套用；Azure OpenAI body 清理／capability token 修正已通過 provider contract 與完整回歸，Windows Ollama／Azure 實機仍待驗收。
- FR-024：deterministic 模型契約、API、CLI 參數、前端選擇器與完整回歸已通過；尚未下載真實 3 GB checkpoint、安裝官方 Python／PyTorch／patched Whisper runtime，亦未做兩平台真實音訊品質、效能、取消或長音訊驗收。

## 有效常設授權

- `AUTH-2026-07-23-01`：需求提出者／產品負責人已統一同意 Windows Authenticode 未簽章、macOS 未經 Apple Developer ID 簽章／公證狀態下對外發布。每次發布仍須引用授權 ID、揭露風險並完成測試、審查、SHA 與資產核對；未實機測試及其他風險不在此授權範圍。詳見 `09-STANDING-AUTHORIZATIONS.md`。

## 0.48.0 正式發布狀態

1. `FR-021`：新增 Ollama／LM Studio 本機 provider、固定常見端點探測與模型清單。
2. 只有精確 loopback hostname 才免 API Key 與雲端資料傳送同意；遠端端點維持既有安全門檻。
3. 本機 provider 使用較小批次，沿用 cue ID／數量／順序／時間碼保護與人工接受流程。
4. 提供本機／雲端隱私標示及模型 JSON、繁體中文、context 能力檢查；不自動下載模型。
5. 自動回歸已分別覆蓋 Ollama 的模型探索／能力／redirect 防護，以及 LM Studio 的完整優化、重試、取消、checkpoint／續跑；已修正「已有 checkpoint 的取消任務被誤標不可續跑」問題；macOS arm64 未簽章目錄版已完成 runtime、打包與 Electron renderer 預封裝驗證。
6. macOS arm64 目錄版、DMG、ZIP 與 Windows x64 未簽章目錄版／Setup／Portable 均已產出並完成 runtime／資產驗證；Windows renderer 仍待 Windows 實機啟動，macOS DMG／ZIP 安裝後仍待驗收。
7. Ollama 已完成 `llama3.2:1b` 真實模型的模型列表、能力檢查與字幕優化；另以 `llama3.2:3b` 驗證日文翻譯與模型解說文字清理。小模型輸出品質仍需逐段人工確認。
8. GitHub `v0.48.0` 已於 2026-07-30T03:58:52Z 正式公開並標示 Latest，tag 解析至 `4cdb0177d84693a334fac79b96c596e1b416456f`。Release 共 9 項資產：macOS DMG／ZIP、Windows Setup／Portable、`latest.yml`／`latest-mac.yml`、兩平台 SHA 與 Windows 未簽章說明；名稱、大小、GitHub digest 與正式下載 URL 均已反向核對。
9. 2026-07-30 受控本機 probe 重新取得 Ollama 0.32.5、2 個模型與 `llama3.2:1b` 回應；capability 回應符合 strict JSON，但 single-cue 未符合 strict JSON／cue contract，故只證明 loopback 可連線。LM Studio 真實流程與斷網驗收依需求方決定暫緩，仍不得視為 `FR-021` 已完成。

## 本機封裝儲存空間整理（2026-07-30）

- 已移除 `dist/` 中 0.21–0.47.1 的歷史 Release 複本、Google Drive 分片、舊 Windows/macOS 封裝與舊建置快取；這些版本的公開／歷史證據仍保留於 GitHub Release、tag 與專案治理文件。
- 保留 0.48.0 正式候選的 macOS DMG／ZIP、Windows Setup／Portable、blockmap、`latest.yml`／`latest-mac.yml`、SHA、簽章狀態，以及 `mac-arm64`／`win-unpacked` 驗證目錄。
- `dist/` 由約 10 GB 降至約 1.9 GB；刪除命令的目標容量合計輸出約 8.44 GiB。清理前逐檔輸出未保存成獨立證據，因此該數值只能作為操作摘要，不能由目前檔案重新計算。被刪除的封裝不在垃圾桶內，若需重取須由 GitHub Release 下載或重新建置。

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
