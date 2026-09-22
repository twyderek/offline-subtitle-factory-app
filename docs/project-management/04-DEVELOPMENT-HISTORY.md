# 專案發展歷程

本文件記錄經查證的版本里程碑；細節與原始證據保留在 `RELEASE-NOTES-*.md`、`FINAL-VERSION-LOG.md` 與 `NEXT-VERSION-FIX-LOG.md`。

| 版本／日期 | 里程碑 | 主要驗證／備註 |
|---|---|---|
| 0.20–0.21／2026-07 | Electron 應用、任務管理、專案檔、規則、輸出及 Windows 獨立 runtime | 早期詳細紀錄見 `FINAL-VERSION-LOG.md`；部分狀態已過時 |
| 0.30.0 | 單一區間非破壞影片修剪 | 精準／快速模式、時間軸重算 |
| 0.30.1 | 校閱樣式比例、Windows 中文檔名、VTT、字幕分割、簽章關卡 | 完整回歸與打包流程補強 |
| 0.40.0／2026-07-16 | 可選 AI 字幕優化工作區 | 建議確認、時間碼鎖定、金鑰隔離、mock 測試 |
| 0.41.0 | AI 可靠性與跨平台發布 | 重試、錯誤分類、狀態恢復相關補強 |
| 0.45.0 | 術語、Prompt、多選、session 稽核、撤銷／重做、多 provider | Windows workflow 與 AI 工作流發布 |
| 0.45.1／2026-07-17 | Azure GPT-5 參數相容、AI 面板收合、圖文／動畫操作說明 | macOS DMG/ZIP、Windows Setup/Portable 已發布 |
| 文件治理／2026-07-20 | 建立必讀文件、變更紀錄、文件稽核與獨立審查制度 | 本目錄成為後續改版治理入口 |
| 下一版開發中／2026-07-20 | 多語言 LLM 字幕優化 | 常用語言、自訂 BCP 47、統一 Prompt 與舊設定相容；尚未打包或發布 |
| 0.45.2 候選／2026-07-20 | 多語言 LLM 正式發布流程 | 已取得未簽章、未公證與未完成跨平台乾淨實機測試的風險接受；資產建置與發布進行中 |
| 0.45.2／2026-07-22 | 補齊 Groq／Google Gemini 供應商整合並完成雙平台發布 | 修正 artifact naming／updater metadata；macOS DMG／ZIP 與 Windows Setup／Portable 已驗證後發布 GitHub Release v0.45.2；保留未簽章、未公證、未實機與未真實供應商 smoke test 風險 |
| 0.45.3 規劃／2026-07-22 | 供應商設定一致性與舊設定遷移 | BUG-012：OpenAI-compatible 不得載入 Gemini URL／模型；補安全遷移、回歸測試、實機驗收與真實供應商 smoke test |
| 0.45.2 修正版規劃／2026-07-23 | 移除設定中的簡體中文選項 | 設定與 AI 輸出選單不再顯示簡體中文；既有介面設定安全回退繁中；0.46 雙語字幕工作拆解與時程同步建立 |
| 0.46.0 開發中／2026-07-23 | 雙語字幕資料模型、校閱與輸出 | 已建立單語遷移、原文／譯文編輯、上下排列與 SRT／VTT／ASS 表示；API／規則／AI／實機驗證仍進行中 |
| 0.46.0／2026-07-23 | 雙語字幕與跨平台候選發布 | GitHub `v0.46.0` 已公開；macOS 資產已核對，Windows unsigned artifact 留存於 CI，跨平台乾淨實機仍未覆蓋 |
| 0.47.0–0.47.1／2026-07-28 | 品質風險、低可信片段與可追溯修正版 | `v0.47.1` 已公開並核對 7 項 macOS／Windows 資產；保留未簽章、未公證、Metal 與實機缺口 |
| 0.48.0／2026-07-30 | Ollama／LM Studio、本機 AI 翻譯與雙語顯示修正 | GitHub `v0.48.0` 已正式公開並標示 Latest；tag `4cdb017`，9 項 macOS／Windows 資產、大小、digest 與下載 URL 已核對 |
| 0.48.1／2026-08-11 | Whisper Tiny／Base／Small、安全模型下載、Windows／Ollama／Azure 穩定化 | GitHub `v0.48.1` 已公開；PR、tag、12 項雙平台資產、Windows CI 與 metadata 已核對 |
| 0.49.0／2026-08-13 | Breeze ASR 25 第一版實驗性正式發布 | 由最新 `main` 移植 runtime／模型 probe 與診斷遮罩；PR #11、最終 tag Windows workflow、9 項正式資產與發布後全量下載核對通過；真實 checkpoint／runtime／音訊品質與效能仍是已揭露的 experimental 風險 |
| 0.49.1／2026-08-18 | Breeze 首次選擇設定協助與 Mac Air 效能依據正式發布 | PR #14、merge `917ae828`、tag workflow `32095872065` 與 13 項公開資產已核對；選擇器移除 experimental 字樣並引導模型／runtime 設定；MacBook Air M3／8 GB 的 1:46 影片約 6 小時列為效能警示，真實 Breeze runtime／品質／跨平台驗收仍未完成 |
| 0.50.0 開發中／2026-08-20 | Breeze 效能透明化與首次選擇提醒 | 新增固定 `performanceReference` API payload 與獨立 UI 提醒；不改變 Whisper.cpp 預設、不宣稱效能改善；尚未建立公開 tag／Release |
| 0.51.0 開發中／2026-08-26–2026-09-18 | Anthropic Claude provider adapter 與 Ollama 本機模型重驗 | 新增 Messages API／Models API 轉接、認證標頭、profile／金鑰隔離與 deterministic contract；BUG-027 依官方新模型要求省略已淘汰取樣參數，BUG-028 補齊 Models API cursor pagination、BUG-029 封鎖巢狀 profile 秘密欄位，BUG-031 清理既有一般設定檔的 AI root／profile 歷史秘密且保留獨立 secrets，BUG-030 補上 Ollama 未包裝 cue object 的一次性 repair 並以 0.34.0／`llama3.2:1b` 完成本機 optimizer path 驗證；FR-021-032／033 再完成 Ollama loopback 產品級任務與 packaged UI 的 session／人工接受／undo／redo／雙語保存及時間碼／原始 SRT 保護驗收；REL-047 補充 macOS DMG 唯讀掛載／ZIP 隔離解壓後 packaged app 啟動 smoke；BUG-WHISPER-METAL-139 補上 macOS arm64 child-process exit 139／SIGSEGV signal→`--no-gpu` CPU retry 整合回歸、bundled runtime Metal／CPU 對照、production-mode server 正常 Metal path、deterministic production-mode fallback control-flow acceptance，並釐清 sandbox 139 與升級權限 Metal success 的執行邊界；未使用真實 API Key，server 真實 crash fallback／中文品質／長音訊／取消、LM Studio／真正斷網／跨平台實機與正式發布仍未完成 |

## 0.45.1 發布補充

- Azure 測試改用 `max_completion_tokens`，正式優化不固定傳 `temperature: 0.1`。
- AI 面板預設精簡，可記住展開狀態；任務進行時自動展開。
- Windows Release 採穩定英文資產名稱，附 SHA 與未簽章狀態。
- Windows 安裝包內含離線手冊；線上手冊另由 Sites 部署。

## 歷史文件使用原則

舊日誌中出現「目前」「尚未」等相對描述時，必須先用 `00-CURRENT-STATUS.md`、Git、package version、Actions 與 Release 實際狀態交叉查證，不得直接沿用。
