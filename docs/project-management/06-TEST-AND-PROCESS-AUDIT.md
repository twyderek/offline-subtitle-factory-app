# 功能測試與流程稽核

## 測試層級

| 層級 | 工具／證據 | 最低適用情境 |
|---|---|---|
| 文件 | `npm run docs:check`、`git diff --check` | 每次變更 |
| 語法 | `node --check` | JavaScript／MJS 變更 |
| 模組／契約 | `test-media-edit`、`test-ai-optimizer`、`test-ai-providers`、`test-review-ui` | 對應功能變更 |
| 核心整合 | `test-core.mjs` | API、檔案、任務、輸出變更 |
| UI 人工 | 瀏覽器／Electron 操作、截圖 | 版面、互動、可存取性變更 |
| 封裝 | runtime verify、`7z t`、封裝清單、codesign | 每次平台打包 |
| 實機 | 安裝、啟動、轉錄、校閱、輸出、解除安裝 | 正式或公開發布 |
| 發布 | Release 資產、digest、checksum、下載 URL | 每次 Release |

治理前置流程另以 `test-project-preflight.mjs` 驗證任務路由，確保一般任務不載入完整歷史，發布與 full 類型仍包含必要治理／授權文件；未知類型必須失敗。

## 六面向獨立審查

審查代理必須提供證據並逐項判定：

1. 需求完整性。
2. 邏輯正確性。
3. 邊界情況。
4. 程式碼品質。
5. 測試覆蓋。
6. 實際運行結果。

審查代理只能讀取、執行、驗證，除本輪獨立審查報告外不得修改檔案。報告須存於 `docs/project-management/reviews/`，由審查代理本人產出；工作紀錄只能連結並逐字引用判定，不得由主要代理代寫或轉述。若有問題，主要代理修正；影響原判定時須建立下一輪報告複審，不得覆寫舊報告。

## 需求追溯格式

每次工作在 `08-CHANGE-LOG.md` 至少記錄：需求 ID、修改檔案、測試 ID／指令、結果、審查結論、發布證據。無自動測試時必須寫原因與人工替代證據。

## 0.45.1 已有證據

- 本機與 Windows Actions `npm run check` 通過。
- Windows Server 2022 run `29556747371` 成功產生 Setup／Portable 並通過 archive 驗證。
- Windows EXE SHA 與 GitHub Release digest 一致。
- Portable EXE 清單含離線 HTML、四張圖片與三段 10.048 秒 MP4 內容的 `.osfvideo`。
- macOS DMG／ZIP 已發布；既有發布紀錄包含 DMG 與 codesign 驗證。

## 0.45.1 未覆蓋證據

- Windows 乾淨實機安裝、解除安裝與捷徑。
- Windows 上離線手冊三段動畫的實際播放。
- Authenticode 簽章成功路徑。
- Apple Developer ID 與 notarization。

## 多語言 LLM 開發中驗證

## 0.46 雙語字幕驗證

- `test-bilingual-subtitles.mjs`：驗證單語 SRT 無損轉為雙欄、原文／譯文排列、SRT／VTT 輸出，以及無效時間碼／空文字拒絕。
- `test-review-ui.mjs`：驗證雙語排列控制、ASS 下載入口與原文／譯文欄位。
- 核心 API／保存包需驗證 `bilingual-cues.json`、排列設定、cue 數量與時間碼保護；跨平台 renderer、FFmpeg 實際雙語燒錄仍需於封裝／實機階段補測。
- 目前已完成受控環境核心保存／載入／ASS 整合驗證；未覆蓋項目明確包括 AI 雙語回應 contract、規則／分割合併專門案例、FFmpeg 實際解析／硬燒錄、Electron renderer 與 Windows／macOS 安裝後操作。

- `test-ai-optimizer.mjs`：驗證 BCP 47 基本、variant、extension 標準化，惡意／無效值拒絕、舊設定回退、翻譯 Prompt、一般優化 Prompt，以及模型交換 cue 順序時必須拒絕。
- `test-review-ui.mjs`：驗證常用語言選項、自訂語言欄位、簡體中文選項不存在與送出時共用語言解析函式。
- `test-core.mjs`：驗證自訂 `fr-CA` 可保存並標準化，專用 AI 設定、一般設定及 AI 任務 API 的非法語言值均回覆 400，舊版 AI／介面簡體中文設定在啟動時回退繁中，AI 任務沿用多語設定。
- 本項目完成自動測試與獨立審查前維持「開發中」，不得標示為 0.45.1 已發布功能。

## 發布稽核判定

- **通過**：必要測試及審查完成，無阻擋問題，發布資產與說明一致。
- **有條件通過**：風險已明確揭露並由需求方接受，具替代驗證；條件與授權來源須記錄。
- **不通過**：checksum、資料安全、核心功能、簽章宣稱、需求或資產不一致等阻擋問題未解決。

發布等級工作缺少發布授權記錄時不得判定「通過」；最高只能列為「有條件通過／發布授權待補」。歷史審查或授權缺少獨立證據時只能標示缺口，不得回溯補造。

## 0.45.2 發布候選驗證計畫

- 來源：0.45.2 版本檔、Release notes、內建 0.45.2 手冊與多語言 LLM 差異。
- macOS：runtime manifest／hash、unpacked App、DMG、ZIP、ad-hoc codesign、手冊與 SHA。
- Windows：Windows Server 2022 完整回歸、runtime hash、Setup／Portable archive、手冊、未簽章狀態與 SHA。
- 發布：獨立六面向審查、GitHub 資產名稱／大小／digest／下載核對。
- 未覆蓋：Windows／macOS 乾淨實機安裝與完整操作；風險已由需求方明確接受並須持續揭露。

## 0.45.2 AI 供應商補強驗證

- `test-ai-providers.mjs`：驗證五種 provider definition、Groq models／chat completions、Gemini models 的 `x-goog-api-key` 認證，以及 Gemini OpenAI 相容 chat completions 的 Bearer 認證、請求與回應契約；API Key 不進入 URL。
- `test-core.mjs`：驗證非法 provider 在 settings／profile API 回覆 400；Groq 設定不會回退成 OpenAI-compatible；Groq／Gemini profile 與 runtime／磁碟金鑰隔離；清除一個供應商金鑰不影響另一個。
- `test-review-ui.mjs`：驗證 Groq／Gemini 選項、供應商白名單、Azure 欄位停用與連線前欄位／金鑰提示契約。
- `verify-electron-renderer.mjs`：封裝後 renderer 驗證要求 settings API 同時列出 OpenAI、OpenAI-compatible、Azure、Groq 與 Gemini，避免 source 有選項但安裝包缺 provider definition。
- 2026-07-22 macOS 本機瀏覽器實測：Groq 自動帶入 `https://api.groq.com/openai/v1`；Gemini 自動帶入 `https://generativelanguage.googleapis.com`；兩者清空並停用 Azure 欄位；切回 Azure 後 Deployment／API Version 恢復可用；缺模型時測試連線顯示可採取行動的錯誤且按鈕恢復可用。
- round1 修正後，`ai-provider-settings.mjs` 的可執行測試覆蓋已保存 profile 與未保存 provider／Base URL／model／Azure deployment／API version／API Key；瀏覽器實測修改已保存 Groq profile 的 model 後，測試連線被阻擋、按鈕恢復，server log 確認未送出 `/api/ai/test`。
- round2 修正後，`test-review-ui.mjs` 直接執行可注入連線控制器：七類未保存／缺 key 狀態均斷言 request 0 次；已保存未變更狀態 request 1 次；阻擋、成功、HTTP 錯誤與 fetch 例外後按鈕皆恢復，錯誤訊息可診斷。
- 未覆蓋：未使用真實 Groq／Gemini API Key 呼叫外部服務；Windows／macOS 乾淨實機安裝與啟動仍待 0.45.3。0.45.2 macOS arm64 DMG／ZIP、Windows Setup／Portable 與 updater metadata 已於發布前後核對通過。

## 0.45.3 設定遷移驗證計畫

- BUG-012：`test-core.mjs` 驗證 `openai-compatible` 搭配 Gemini URL／`gemini-*` 模型時，會回復空 Base URL／空模型，且不影響供應商金鑰隔離。
- 必測：正常 OpenAI-compatible 自訂 endpoint、正常 Gemini profile、舊混用設定、空值、非法 provider、重啟後設定持久化。
- 實機：以既有 0.45.2 使用者設定升級到 0.45.3，確認 UI 不再顯示跨供應商資料。

## 0.47.0 發布閉環核對（2026-07-28）

- 本機核對：`git rev-parse HEAD` 為 `efc6259140640e65f9273284811c365da473bc88`；既有 release round1 報告記錄的 Release／Windows CI 目標為 `7946f7fa8e080f28a65639053f674fa8babcd5fe`，來源尚未一致。
- GitHub Release API 核對（2026-07-28 可取得的回應）：`v0.47.0` target 為 `7946f7f`；公開資產為 `offline-subtitle-factory-0.47.0-macos-arm64.dmg`、`offline-subtitle-factory-0.47.0-macos-arm64.zip`、`RELEASE-SHA256SUMS-0.47.0-macos-arm64.txt`，未見 Windows Release asset。
- Windows 證據：workflow run `30231912997`／artifact `8640388049`、名稱 `offline-subtitle-factory-0.47.0-windows-x64` 與 SHA-256 已記錄於 `RELEASE-NOTES-0.47.0.md`；本輪未能重新下載 artifact，內容逐檔核對與發布後下載核對仍待執行。
- 判定：發布閉環未完成；來源 commit 不一致與 Windows 未公開／未反向核對為阻擋項。未簽章／未公證、Metal exit 139、Electron 與跨平台實機缺口仍為揭露中的條件風險，不得由 CI 成功取代。

## 0.47.1 發布後核對（2026-07-28）

- 來源：annotated tag `v0.47.1` 解析至 commit `0bd3b53be0cd523d7c7beb3078b5b46dad2f81b1`；GitHub Release 已由 draft 正式發布。
- 開發驗證：受控環境外 `npm run check` 通過；`hdiutil verify` 驗證 macOS DMG；`unzip -t` 驗證 macOS ZIP 與 Windows artifact archive；Windows `latest.yml`、Setup／Portable 與 SHA-256 清單一致。
- 發布資產：GitHub Release `v0.47.1` 公開 7 項資產，API 已核對名稱、大小、digest 與直接下載 URL；macOS DMG／ZIP 的 GitHub digest 分別為 `88cc9ce8f76a2b720a74e52780d8c2340acd25cf324895233d41051cbaa35f04`、`1411e242136908a54bd8ad7cc95088e18a383c216004fa3afcbff2e5c0b7fb8e`；Windows Setup／Portable digest 分別為 `323b08300b2724b0dabf9a8e6c5aef7dfed850df7707328412a3794d24f352a9`、`5e1445b67f4a84f5c09d0dd80b854c05146cdc0efa34f1481de6fa46ae48f237`。
- 限制：Windows 未 Authenticode、macOS 未 Developer ID／公證；Metal exit 139、Electron、跨平台安裝後與長音訊實機仍未覆蓋，Release notes 已揭露。
- 独立审查：`docs/project-management/reviews/2026-07-28-0-47-1-release-round2.md`；结论为有条件通过，条件与剩余风险详见该报告及工作纪录。

## 0.48 本機 LLM 驗證計畫

- `test-ai-providers.mjs`：驗證 Ollama／LM Studio registry、loopback IPv4／IPv6、localhost 子網域拒絕、無 Key 不送 Authorization、遠端本機-provider 名稱仍不得繞過 Key，以及模型能力回應解析。
- `test-review-ui.mjs`：驗證本機 provider 選項、服務掃描、模型清單、能力檢查、隱私狀態與 loopback 無 Key 連線表單。
- `test-core.mjs`：以本機 fake OpenAI-compatible server 分別驗證 Ollama 的無 Key／無雲端同意設定、模型列表、連線、有效與無效模型能力回應、redirect 第二站零請求，以及 LM Studio 的完整 AI 批次、429 重試、無 checkpoint／有 checkpoint 取消時關閉 HTTP 請求、取消後只續跑未完成批次與 cue 契約。
- macOS 預封裝：`runtime:manifest:mac`、`runtime:verify:mac` 與 `electron:build:mac:dir` 已通過；`verify-electron-renderer.mjs` 已在產出的 arm64 App 驗證 Electron bridge、設定 modal、上傳／啟動／完成、review AI 資產、術語 round-trip，以及七個 provider（含 Ollama／LM Studio）。此證據僅涵蓋目前主機的未簽章目錄版，不等同 DMG 安裝後驗收。
- Windows 預封裝：`runtime:manifest`、`runtime:verify` 與 `electron:build:dir` 已成功產出 `dist/win-unpacked` 及 Windows x64 executable；本機為 macOS，未直接啟動 Windows renderer，故不等同 Windows 實機安裝後驗收。
- macOS 發布資產：arm64 DMG 可由 `hdiutil imageinfo` 讀取；ZIP 改用 macOS `ditto` 直接由已驗證 App 封裝，`unzip -t` 通過。DMG SHA-256 為 `906559f20242f01f2b51618280b4af65875cd83bd05aef16bc22f3eb10d3562f`，ZIP SHA-256 為 `04de598018929d687887329582488d3fa809abffed2b919a3bd7851325f46bc7`；兩者仍僅代表產出／完整性驗證，不等同乾淨帳號安裝後驗收。
- 實機門檻：Ollama 與 LM Studio 各至少一個模型完成模型探索、能力檢查、字幕建議、人工接受、取消／恢復；移除外網後重跑本機流程。
- 未覆蓋即不得宣稱：目前沒有證據時，不得將真實 Ollama／LM Studio、Windows 封裝、macOS 安裝版或斷網端到端標示為通過。
