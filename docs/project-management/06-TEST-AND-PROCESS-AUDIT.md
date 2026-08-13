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

## FR-022 Whisper 三模型模式驗證（2026-08-04）

- `scripts/test-whisper-models.mjs` 以 deterministic mock runner 覆蓋 `tiny`／`base`／`small` 三個模型：模型白名單與 alias 正規化、模型路徑、whisper.cpp CLI 參數（含 `--no-gpu`）、SRT／JSON 輸出、quality metadata 解析，以及缺檔、too-small、SHA mismatch、manifest-size mismatch 與 UI option presence 拒絕／存在性。
- `npm run runtime:manifest`、`npm run runtime:verify`、`npm run runtime:manifest:mac`、`npm run runtime:verify:mac` 均通過；目前現有 runtime 只包含 tiny，manifest 已支援 optional `files.models` 對 base／small 做 hash 驗證。
- `npm test` 通過，包含核心 API／任務回歸；本輪沒有下載或執行實際 base／small 權重，因此未宣稱三模型實際中文準確率、速度、記憶體或 Windows／macOS 安裝後驗收。
- 未覆蓋：實際 base／small 模型檔、模型匯入 UI、Windows／macOS 乾淨安裝與長音訊實機；這些應於加入相應模型資產前另行驗收。

## FR-023 Whisper 高階模型首次下載驗證（2026-08-06）

- `scripts/test-whisper-model-download.mjs`：驗證 pinned revision／Base／Small metadata、禁止任意模型名稱、manifest merge、下載成功、進度 100%、SHA-256 不符、大小超限、HTTP 503、AbortController 逾時、Windows 既有損壞檔替換與失敗暫存檔清理。
- `scripts/test-whisper-models.mjs`：驗證首頁三模型選項、下載按鈕、首次使用說明與下載 modal 存在；`lib/whisper-models.mjs` 驗證 user cache 優先、封裝模型 fallback 與既有 strict size／SHA 檢查。
- `scripts/test-core.mjs`：驗證 `/api/whisper-models` 回報 Base 固定大小、Small pinned revision URL 與可寫入 whisper-models cache；完整回歸需在受控權限下執行以允許 local fixture listener。
- 下載設計：Electron 將模型快取設於 `userData/whisper-models`，server 以暫存檔下載並原子置換（Windows 既有檔先移至備份並可回復），具 15 分鐘 AbortController 逾時；UI 在首次選擇／提交前確認，並顯示 userData cache 路徑與官方 URL／手動放置說明。
- 未覆蓋：本機尚未實際下載 148 MB Base／488 MB Small；Windows 實機權限、休眠／中斷續傳、乾淨安裝與中文口說品質仍待外部驗收，不得將 deterministic fixture 或檔案 hash 視為模型品質通過。

## FR-024 Breeze ASR 25 實驗性整合驗證（2026-08-10）

- `scripts/test-breeze-asr.mjs`：驗證官方 revision、checkpoint 檔名、3,087,008,569 bytes、SHA-256 與固定 URL；涵蓋缺檔、錯誤大小、mock 正例、runtime `available_models` 探針、CLI 參數、模型檢查不得使用同步檔案 I/O，以及永久等待的 probe 必須在 timeout 後失敗。
- `scripts/test-whisper-models.mjs`／`scripts/test-core.mjs`：驗證首頁 Breeze 選項、下載端點與提交前檢查存在，並由核心 API 驗證固定 metadata、模型狀態與 job 的 `breeze-asr-25` 引擎保存。round1 後新增測試專用 mock runtime，真正經 server job／FFmpeg 音訊前處理產生並清理 SRT；取消案例等 child 收到 SIGTERM、延遲 close 後才從 `running/cancelling` 轉為 `cancelled`，並確認暫存音訊與部分 SRT 不殘留。
- round1／round2 修正：3 GB checkpoint 改以非同步 stream 驗證 SHA，避免單次同步完整讀檔阻塞 event loop；Breeze capability probe 設 15 秒 timeout；轉錄取消等待 child `close`，POSIX 在 3 秒 grace 後升級 SIGKILL，Windows 立即執行並等待 `taskkill /T /F` 完成 process-tree 終止，確認 child 與 Windows tree-kill 都結束後才釋放 job slot。另以忽略 SIGTERM 的 mock child 驗證 grace timeout、SIGKILL、取消狀態與暫存清理。
- 本機瀏覽器驗證：新增專案可選 Breeze ASR 25；選取後 Whisper 專用模型欄位停用，未安裝狀態顯示約 2.88 GB 與提交時確認下載提示。切換不會改變 Whisper.cpp 預設值。
- 完整回歸：`npm run check` 在允許本機 fixture listener 的受控環境通過；`node scripts/test-review-ui.mjs` 與 `git diff --check` 通過。首次沙箱內執行僅因 `listen EPERM` 中止，沙箱外同一指令已完整成功。
- 未覆蓋：本輪未下載真實 checkpoint，也未安裝或執行官方 Python／PyTorch／patched Whisper runtime；未驗證真實繁體中文／中英混用音訊、字幕對齊品質、GPU／CPU 效能、長音訊、取消清理、Windows／macOS 安裝後流程，故不得宣稱 Breeze ASR 已可隨安裝包直接使用或達到正式品質門檻。

## FR-024 Breeze runtime／模型外部驗收探針（2026-08-12）

- `node scripts/test-breeze-asr.mjs`：新增 runtime probe 正常／timeout、Python 路徑解析、模型缺件與 report 聚合斷言，並保留既有固定 revision／大小／SHA／CLI 契約測試。
- `npm run probe:breeze -- --json`：本機只讀執行回報 `python3` 可啟動但 `whisper` module 缺失、Breeze checkpoint 缺失、`ready=false` 與非零狀態；沒有執行 pip、網路下載或字幕任務。
- 探針固定使用 `whisper.available_models()` 能力檢查與同一 Breeze 模型 inspector；timeout 會終止探針 child，不把外部 runtime 失敗寫入設定或任務狀態。
- 未覆蓋：真實 checkpoint、官方 patched Whisper／PyTorch、真實音訊、品質、效能、跨平台安裝與 process-tree 仍須另行外部驗收。

## FR-024 Breeze runtime／模型外部驗收探針修正（2026-08-12）

- round1／round2 獨立審查指出：專用 probe timeout 原先未等待 child close／descendant 清理，且 JSON 原樣輸出絕對路徑與 raw stderr；本輪已改為 POSIX detached process group、Windows `taskkill /T /F`、等待 close，並將 Python／模型路徑改為 basename、診斷輸出改為安全摘要；其後將相同 cleanup 契約補入正式 server 共用的 `lib/process-probe.mjs`。
- `scripts/test-breeze-asr.mjs` 新增 timeout close 等待與敏感標記遮罩斷言；本機 focused test、缺件 probe 與完整 `npm run check` 均通過。
- 未覆蓋：真實 Windows process tree、官方 runtime／checkpoint、音訊品質與跨平台實機仍待外部驗收。

## FR-024 Breeze runtime probe 診斷訊息品質修正（2026-08-13）

- `lib/breeze-runtime-probe.mjs` 的敏感鍵值遮罩改用實際捕獲的鍵名與分隔符，`ImportError: token=... password:... api-key=...` 會輸出可讀的 `ImportError: token=<redacted> password:<redacted> api-key=<redacted>`，不再出現字面 `$1=<redacted>`。
- `scripts/test-breeze-asr.mjs` 新增 ImportError、token、password、api-key 的 deterministic 回歸，確認原始敏感值不會進入 probe 結果；既有任意診斷仍維持 privacy omission。
- round1 獨立複審發現 quoted 且含空白的 credential 值仍可能洩漏尾段 `LEAK_MARKER`；本輪已改為整段處理單／雙引號與 escaped 字元，並新增 quoted whitespace 負向回歸，要求 round2 複審。
- focused `node --check ...` 與 `node scripts/test-breeze-asr.mjs` 通過；完整 `npm run check`、`docs:check:final` 與 round2 獨立複審結果待本輪結案後補記。
- 未覆蓋：真實 Windows process tree、官方 runtime／checkpoint、音訊品質、效能與跨平台安裝後流程仍沿用前輪外部驗收缺口。

## REL-030 Breeze 0.49.0 第一版發布候選（2026-08-13）

- 來源基線：由 `origin/main=05b275f` 建立 `codex/breeze-first-release`，只移植 Breeze runtime probe／process cleanup／diagnostic redaction 變更並升版至 0.49.0，避免直接發布落後主線 25 個提交的舊開發分支。
- 來源驗證：focused Breeze 語法與測試通過；`npm run check` 完整通過；`npm audit --json` 為 0 項已知弱點、總依賴 286；缺件 `npm run probe:breeze -- --json` 預期以 exit 1 回報 checkpoint missing、`ModuleNotFoundError` 與 `ready:false`，未下載或安裝外部元件。
- macOS arm64：runtime manifest／SHA 驗證、目錄版封裝與 packaged renderer smoke 通過；smoke 覆蓋 Electron bridge、設定、manual SRT 任務完成、trim／review AI 資產、七 provider 與 folder event。首次 smoke 因 sandbox 無法讀取 escalated loopback DevTools 而逾時；相同 build 在同一受控權限範圍重跑通過，確認不是 renderer 缺失。
- macOS 最終候選：從乾淨 commit `0205548` 重建；DMG `hdiutil verify` checksum VALID、ZIP `unzip -t` 無錯、ad-hoc code structure 驗證通過；App bundle 版本 0.49.0、最低 macOS 12，包含 Breeze guide／0.49.0 Release notes／probe library，且沒有大於 1 GiB 檔案或 Breeze checkpoint。最終 renderer smoke 前兩次因 macOS Network Service 重啟造成 target 延後出現而逾時；精確程序診斷確認 server／renderer 隨後正常啟動，關閉診斷程序後以 240 秒期限重跑相同封裝完整通過，未隱藏失敗證據。
- Windows x64：macOS cross-build 已產出 x86-64 unpacked App、NSIS Setup／Portable 與 `latest.yml`；Setup archive 可列出 Breeze guide／probe library／0.49.0 Release notes，未包含 checkpoint；Setup／Portable 皆未 Authenticode。Windows CI workflow 已切換至本分支／`v0.49.0` 與 0.49.0 資產名稱，並新增 Breeze guide／checkpoint 排除關卡。
- 資產完整性：DMG `18fba33da3740ee28fdbb5aba575fe7305c069eb417702fc67db3ee8f54dda30`（242,706,559 bytes）、ZIP `9a4337c352e8c97ebba3de0ad02c86e192474061a2abd71faedca7dd789ce188`（249,942,036 bytes）、Setup `1a63e80bcda6fd433cb0ebba84cff7cb49d37604183ab32dd1341712fda8d8ed`（244,655,017 bytes）、Portable `9353ad38521cd6383e725063f1adbfe05373f2c21f3c95837c71c6553eb97a15`（243,947,755 bytes）。`SHA256SUMS-macos-arm64.txt` 與 `SHA256SUMS-windows-x64.txt` 重放全數 `OK`；`latest.yml`／`latest-mac.yml` 的 size 與 SHA-512 亦和實際檔案一致。
- 原候選待辦已完成：Windows Actions packaged renderer／安裝生命週期、完整獨立發布審查、GitHub PR／tag／Release 與發布後下載反向核對均已收斂，round3 判定通過。
- 獨立發布審查：round1 對四資產 SHA、DMG／ZIP、metadata、版本、封裝內容與風險揭露做快速獨立重驗後，判定「有條件通過（僅限本機候選與建立 PR）；公開 Release 不通過」。Windows Actions／CI artifact、GitHub 閉環與未獲涵蓋授權的真實 Breeze／跨平台實機缺口是公開發布阻擋項，解除後須 round2 複審。
- Windows CI：PR #11 的 push run `31659328605`（來源 `aa1ec41e0856746726774d5f16a48f96b6c103b3`）成功；Setup 安裝後 renderer、silent uninstall、Portable renderer、兩個 NSIS archive、Breeze guide、checkpoint 排除與 unsigned 狀態均通過。artifact `9165654131` 大小 490,411,929 bytes、GitHub SHA-256 `0dccf99939edd1e3dec024f16327e6bcfd3b0674885c1007ff24d5d1f0b15027`；以八段精確 range 下載重組後 digest 完全一致，ZIP `unzip -t` 通過。CI SHA：Portable `4f16f949d8cd3a207ac922574a3b4768d513f8478740d6ae9704c62447f0bff4`（244,674,637 bytes）、Setup `b39d4451d4edc5f80245a540d341f9c7158fd58f75009862c8bfc995936be925`（245,381,891 bytes）；`latest.yml` 版本 0.49.0、Setup size／SHA-512 與實檔一致。
- 最終 tag／Release：PR #11 merge commit 與 `v0.49.0` target 都是 `1f50b85c0599ef85c73f05085d70925d4d6b670a`。tag run `31661442776` 成功，artifact `9166375562` 大小 490,411,920 bytes、digest `5a45c9d04917bbdd3c7d05867e68c42e1d7f5597fe2dc369364b5039e5371418`；分段完整下載重組、ZIP 與 EXE SHA 通過。正式 Windows SHA：Portable `cbec3c244f80d9e922f7139caacbefd00cabf41a2a0cffc5385392950960f981`（244,674,635 bytes）、Setup `0a5cf5cdf3b94ce4a7621fffcbd2174a92e4288a4c0e380d31c98338b34d65a0`（245,381,896 bytes）。
- 發布後核對：GitHub v0.49.0 為 `isDraft=false`／`isPrerelease=false`／Latest，9 項 asset URL 均為 `/releases/download/v0.49.0/`。四個主資產與兩平台 checksum／updater metadata／unsigned 說明已從正式 URL 全量重新下載；兩份 SHA 清單全數 OK、DMG checksum VALID、macOS ZIP 無錯、Windows Setup archive 可讀，Setup／macOS ZIP／DMG 的 updater SHA-512 與 size 均一致。
- 未覆蓋：真實 Breeze checkpoint／官方 runtime／音訊品質、CPU／CUDA 效能、長音訊、Windows process tree、兩平台乾淨安裝後 Breeze 流程與 checkpoint 下載中斷／磁碟不足；不得以候選封裝或 mock 證據取代。

## SYNC-024 GitHub Windows 修正同步驗證（2026-08-06）

- 遠端核對：`git fetch --prune origin` 後 `origin/main=baed6d7`；Windows Ollama 修正 `4d0bee6` 與本地 HEAD `170e08e` 的指定檔案 diff 為空，故未重複套用。
- 選擇性整合：同步 Azure OpenAI 的 `max_completion_tokens` capability probe、Azure deployment body 清理與 OpenAI-compatible internal chat fields 清理；保留本地 Ollama streaming／timeout／repair 變更。
- focused：`node --check`（model capabilities／OpenAI-compatible／providers）、`node scripts/test-ai-providers.mjs`、`node scripts/test-ai-optimizer.mjs`、`node scripts/test-ollama-batch-stream.mjs` 通過。
- 審查後補強：`scripts/test-ai-providers.mjs` 新增 OpenAI-compatible sanitized body 專項斷言，確認保留 `model` 並移除 operation／language／cue metadata；focused provider test 與完整回歸重跑通過。
- 完整：受控 `npm run check` 通過；兩平台測試包關鍵 AI runtime marker 與工作樹一致，macOS／Windows ZIP `unzip -t` 均通過。
- 未覆蓋：Windows 實機 Ollama／Azure endpoint、真實模型回應、安裝後啟動與跨版本行為；GitHub commit 核對與 contract mock 不取代實機驗收。

## 0.48 本機 LLM 驗證計畫

- `test-ai-providers.mjs`：驗證 Ollama／LM Studio registry、loopback IPv4／IPv6、localhost 子網域拒絕、無 Key 不送 Authorization、遠端本機-provider 名稱仍不得繞過 Key，以及模型能力回應解析。
- `test-review-ui.mjs`：驗證本機 provider 選項、服務掃描、模型清單、能力檢查、隱私狀態與 loopback 無 Key 連線表單。
- `test-core.mjs`：以本機 fake OpenAI-compatible server 分別驗證 Ollama 的無 Key／無雲端同意設定、模型列表、連線、有效與無效模型能力回應、redirect 第二站零請求，以及 LM Studio 的完整 AI 批次、429 重試、無 checkpoint／有 checkpoint 取消時關閉 HTTP 請求、取消後只續跑未完成批次與 cue 契約。
- macOS 預封裝：`runtime:manifest:mac`、`runtime:verify:mac` 與 `electron:build:mac:dir` 已通過；`verify-electron-renderer.mjs` 已在產出的 arm64 App 驗證 Electron bridge、設定 modal、上傳／啟動／完成、review AI 資產、術語 round-trip，以及七個 provider（含 Ollama／LM Studio）。此證據僅涵蓋目前主機的未簽章目錄版，不等同 DMG 安裝後驗收。
- Windows 預封裝：`runtime:manifest`、`runtime:verify` 與 `electron:build:dir` 已成功產出 `dist/win-unpacked` 及 Windows x64 executable；本機為 macOS，未直接啟動 Windows renderer，故不等同 Windows 實機安裝後驗收。
- Windows 發布資產：`electron:build:unsigned` 已建立 x64 Setup 與 Portable；兩者均由 `file` 識別為 PE32 NSIS executable。Setup SHA-256 為 `d05a3f8d4df31048d398839666f34954c523f6928bc2500a1d98a785f7a20955`，Portable SHA-256 為 `3a1ad56e0b6e914151e7f3447966d104c426544245e68e455d5df49eaeddf1f6`；未簽章且未在 Windows 實機安裝／啟動。
- macOS 發布資產：arm64 DMG 可由 `hdiutil imageinfo` 讀取；ZIP 改用 macOS `ditto` 直接由已驗證 App 封裝，`unzip -t` 通過。DMG SHA-256 為 `906559f20242f01f2b51618280b4af65875cd83bd05aef16bc22f3eb10d3562f`，ZIP SHA-256 為 `04de598018929d687887329582488d3fa809abffed2b919a3bd7851325f46bc7`。DMG 唯讀掛載成功；直接從唯讀卷啟動未取得 DevTools target，但複製到專用暫存安裝位置後，`verify-electron-renderer.mjs` 已通過 bridge、設定、上傳／完成、review AI 資產、術語 round-trip 與七個 provider，且暫存目錄已清理。這是本機複製安裝 smoke test，不等同乾淨使用者帳號或正式簽章／公證驗收。
- 實機門檻：Ollama 與 LM Studio 各至少一個模型完成模型探索、能力檢查、字幕建議、人工接受、取消／恢復；移除外網後重跑本機流程。
- Ollama 真實模型證據（2026-07-28）：本機 Ollama 0.32.5 以 `llama3.2:1b` 完成 `/v1/models`、能力檢查與專案 API 的 1 cue `proofread` 優化；任務 `completed`、provider／model 正確、0 retries。首次能力檢查的 `traditionalChinese` 為 false，實際建議將中文句號改成英文句點；round5 重放同類能力 prompt 得到 true，單 cue 直接回應另出現額外缺少 id 的物件，顯示能力／品質結果不穩定。已確認模型可用但品質不能直接接受，需保存完整 prompt／參數／原始 response，並由人工審核／後續提示詞或模型調整。
- 可重放證據：`npm run probe:ollama:live`（底層為 `scripts/probe-ollama-live.mjs`）會保存版本、模型清單、完整 capability／single-cue 請求與原始回應；本輪 artifact 為 `docs/project-management/evidence/2026-07-28-ollama-llama3.2-1b-live.json`。該次 capability 回應使用 `Traditional Chinese` 鍵而非產品要求的 `traditionalChinese`，single-cue 回應使用 `cue`、改動時間碼並附 Markdown／自然語言，正好證明 strict contract 與人工審核仍必要。Probe 另以 `isLoopbackAiUrl`、`aiEndpointPrivacy` 與所有 fetch `redirect: manual` 保護資料邊界；本機 probe exit 0，遠端 `OLLAMA_BASE_URL` 負例在 fetch 前 exit 1。
- Probe 安全矩陣：`http://localhost:11434/v1` 實際 probe 成功；`localhost.example.com` 在 fetch 前拒絕；`[::1]` 通過 loopback 分類但因 Ollama 僅監聽 IPv4 而連線失敗，未被誤判為遠端或送出資料。
- 未覆蓋即不得宣稱：目前沒有證據時，不得將真實 Ollama／LM Studio、Windows 封裝、macOS 安裝版或斷網端到端標示為通過。

## 0.48.x 穩定化驗證（2026-07-30）

- BUG-012／FR-014：`test-core.mjs` 驗證舊 Gemini URL／模型混入 `openai-compatible` 時，API 回應與持久化 `config/settings.json` 均清空不相容的 Base URL／model，同時保留正確 provider；API Key 不進一般設定檔。
- 本輪新增的持久化斷言只證明同一 server 寫入後的設定檔內容；既有使用者設定檔跨平台啟動／重啟仍待實機驗收，不能以此取代 Windows／macOS 測試。
- `FR-021` 的真實 LM Studio artifact、模型人工接受、取消／checkpoint 續跑與真正斷網閉環仍屬未完成驗收；本輪未使用真實外部供應商金鑰。

## 0.48.x macOS 封裝與本機 LLM 驗證（2026-07-30）

- `npm run runtime:verify:mac` 通過；`verify-electron-renderer.mjs` 對 macOS arm64 目錄版 executable 結束成功。DMG／ZIP SHA-256 與既有清單一致：DMG `334e50b59a70c97314629faad88de1dd22f6680018265c54da5f1703becfbeee`、ZIP `53ca4e3886155e221048d36f103b0933a8d49647f5e509098fcac29f2c652f80`。
- 受控本機連線下 `npm run probe:ollama:live -- docs/project-management/evidence/2026-07-30-ollama-llama3.2-1b-live.json` 通過，完整 raw request／response 保存於版本化 evidence；取得 Ollama 0.32.5、2 個模型與 `llama3.2:1b` capability／single-cue 回應。capability 回應符合 strict JSON；single-cue 回應未滿足 strict JSON／cue contract（含 Markdown／自然語言或時間格式改寫），因此只證明 loopback 可連線，不是模型品質或 FR-021 完整驗收。probe 現在拒絕覆寫已存在的 evidence。
- LM Studio `http://127.0.0.1:1234/v1/models` 於本輪 connection refused；依需求方決定暫緩，不宣稱 LM Studio 真實流程、人工接受、取消／續跑或斷網完成。Windows renderer／安裝驗收亦未在本輪執行。
- 受 sandbox 本機 socket bind 限制曾有一次 `listen EPERM`；以受控權限重跑的 `npm run check` 通過。

## 0.48.x 供應鏈與 CI 風險盤點（2026-07-30）

- `npm audit --json`：總計 14 項（13 high、1 critical），依賴總數 418；lockfile 實際版本為 `electron@33.4.11`、`electron-builder@25.1.8`，延伸出 `app-builder-lib`／`builder-util`／`node-gyp`／`tar`／`cacache`。runtime production dependency 僅 `busboy`，本次未見其 advisory。
- build-only 風險：`tar`、`node-gyp`、`cacache`、`app-builder-lib` 等主要由建置／重建流程引入；可用修正集中到 `electron-builder@26.15.3`，為 major 升級，需另開相容性工作並重跑兩平台封裝。
- runtime 風險：lockfile 的 `electron@33.4.11` 命中多項 advisory，audit 建議至少升至 43.2.0；這會改變 Electron runtime，不能僅以 build-only 風險接受，須另做 renderer／IPC／打包／實機回歸。
- CI：目前 `.github/workflows/windows-preview.yml` 使用 `actions/setup-node@v4`、`node-version: 22`；本輪未發現仍使用 Node 20 的現行 workflow 設定，`00-CURRENT-STATUS.md` 的 Node 20 deprecation 描述應視為待歷史來源核對，不作為目前 workflow 已證實問題。
- 結論：本輪不修改 lockfile、Electron 或 electron-builder；將 major 升級與安全修正列為後續受控變更。`npm audit` 數字不能直接等同已發布應用的 runtime 可利用性，但 Electron advisory 仍是未解決的 runtime 風險。
- Whisper fallback 補充：`lib/whisper-fallback-policy.mjs` 已以 deterministic 矩陣測試覆蓋 macOS arm64、forceCpu、退出碼與邊界值，並由 `server.mjs` 使用；此證據只涵蓋 fallback 觸發條件，不取代實際 child-process、取消／清理與跨平台實機驗收。

## 0.48.1 Electron／builder 升級與發布候選回歸（2026-08-10）

- 升級前完整 audit 為 16 項（15 high、1 critical）；`electron@33.4.11` 與 `electron-builder@25.1.8` 分別升至 `electron@43.3.0`、`electron-builder@26.15.7`，升級後 `npm audit --json` 為 0 項，依賴總數 286。
- Electron 43 的 npm 安裝套件要求 Node.js 22.12.0 以上；專案 `engines.node` 與部署文件已同步提升，Windows workflow 使用 Node 22 的最新可用版本。
- `npm run check` 完整通過，包含 Whisper 三模型／下載取消與暫存清理、SRT sanitizer、Breeze 契約、AI fetch／optimizer／providers、Ollama streaming、review UI 與核心 API。
- round1 後補強下載取消邊界：單元 fixture 先寫入大於 0 bytes 的 `.download` 再 abort；核心 API 以 POST 啟動、GET 確認部分 bytes、DELETE 取消並等待 `.download`／`.previous` 全部清除。測試 hook 只在 `NODE_ENV=test` 與顯式旗標同時成立時啟用；Windows 真實檔案 handle 行為仍須實機驗收。
- 因上述 server 測試 hook 變更，四項候選再次重建；最終 build 已通過 SHA 清單、ZIP／NSIS archive、updater SHA-512、codesign 與兩平台封裝來源 diff。最後一次 DMG `hdiutil verify`／packaged renderer 重跑受系統權限用量上限阻擋；round1 前一 build 的兩項通過證據不能替代最終資產重驗，列為本機候選剩餘條件。
- 2026-08-11 權限恢復後補驗同一最終 build：`hdiutil verify` 回報 DMG checksum `VALID`；隔離 userData 的 packaged renderer smoke 通過 bridge、設定、上傳／完成、review AI 資產、術語 round-trip、七個 provider 與資料夾事件。round2 的本機重驗條件已解除；Windows／Base／Small／真實端點與安裝後實機仍未覆蓋。
- macOS arm64 目錄版在 Electron 43.3.0 下完成打包；隔離 userData 的 packaged renderer smoke 通過 Electron bridge、設定 modal、上傳／轉錄完成、review AI 資產、術語 round-trip、七個 provider 與資料夾開啟事件。
- Windows x64 目錄版、NSIS Setup 與 Portable 已由 macOS cross-build 產出；封裝內 App 版本為 0.48.1、PE 為 x86-64、只內建 Tiny 且包含本版 Release notes。此證據不等同 Windows 10／11 實機啟動、安裝或解除安裝。
- 兩平台 builder 仍警告 `asar:false`；本版維持既有非 ASAR 結構以避免未經回歸的 server／runtime 路徑變更，列為後續封裝強化，不把它描述為已解決。
- 簽章狀態不變：Windows 未 Authenticode，macOS 為 ad-hoc／未公證；引用 `AUTH-2026-07-23-01` 時仍須揭露，且該授權不涵蓋缺少實機驗收、metadata／checksum 不一致或機密洩漏。

## 0.48.x Whisper Metal crash 診斷（2026-07-30）

- bundled `whisper-cli`／tiny model／1 秒 16 kHz silence WAV 的預設 GPU 路徑 exit `139`；stderr 明確顯示 `ggml_metal_buffer_init: error: failed to allocate buffer`，未產生 JSON。
- 同一輸入加 `--no-gpu` exit `0` 並產生 JSON；此為已驗證 workaround，不等同產品已自動 fallback。
- 本輪未修改 runtime；Metal crash 與「成功轉錄但 quality metadata 缺失」維持不同處置，rule-score 不可用於無 cue 的 crash。
- 0.48.x 修正已在 `server.mjs` 將 Metal 非零退出導向 CPU retry；retry 前清理舊 SRT／JSON，CPU 失敗仍回報 failed。`npm run check` 通過；尚未完成長音訊／乾淨安裝實機驗收。

## 0.48.x Ollama single-cue contract 修正（2026-07-30）

- `scripts/probe-ollama-live.mjs` 現在以 native smoke 重放 Ollama adapter 使用的 `/api/chat`，帶入 `stream:false`、temperature 0、production cue schema（cue ID enum）並在 probe 內驗證 `cues`／ID／數量／文字／reason；不再以 `/v1/chat/completions` 代表 native path。
- 受控 probe（持久輸出 `docs/project-management/evidence/2026-07-30-ollama-native-contract-rerun.json`）確認 `llama3.2:1b` 的 native single-cue 回應為合法 `cues` JSON，cue ID／數量保留；模型仍將全形句號改為半形句號，屬品質／人工審核風險，不是 contract 放寬理由。
- capability probe 仍為相容端點的能力觀察；LM Studio、真正斷網與跨平台實機仍未驗收。

## 0.48.0 正式候選與本機封裝清理稽核（2026-07-30）

- 來源：`codex/0.48-local-llm` commit `dc143d24064b50ca4ddf645037d339a73d60baf4`；本機 remote-tracking ref `origin/codex/0.48-local-llm` 與 HEAD 一致。
- 開發驗證：`npm run check` 通過；`npm run docs:check:final` 通過；macOS runtime、DMG／ZIP 與 Windows runtime、Setup／Portable 已建立。macOS ZIP `unzip -t` 通過。
- 目前 SHA-256：macOS DMG `334e50b59a70c97314629faad88de1dd22f6680018265c54da5f1703becfbeee`、macOS ZIP `53ca4e3886155e221048d36f103b0933a8d49647f5e509098fcac29f2c652f80`、Windows Setup `7be0392fca7610647f1b351db182ceccbd509fdd44f79ca3eb089c09c76ebd54`、Windows Portable `b187823c1c4981211cc2b71f8a31676d6f58866589b2bf8fb61c945e75a13ca5`。兩平台 SHA 清單均已涵蓋主要安裝資產；GitHub 發布後 digest 仍待反向核對。
- GitHub 狀態：來源分支推送已由本機 remote-tracking ref 證實；`v0.48.0` Release 由需求方終端上傳中。因本執行環境無法解析 `github.com`，尚未取得公開 Release metadata、資產 digest、下載 URL 與最新 Release 指向的反向證據。
- 清理前 `dist/` 約 10 GB。逐項移除 `archive/`、`releases/`、`build-cache/`、`windows-0.45.0/`，以及根目錄 0.45.0–0.47.1 歷史封裝／blockmap／舊 checksum；刪除命令的目標容量合計輸出約 8.44 GiB，清理後約 1.9 GB。清理前逐檔輸出未保存為獨立檔案，故目前只能以 `docs/project-management/evidence/2026-07-30-dist-cleanup-summary.md` 作操作摘要，不得宣稱該數值仍可獨立重算。
- 清理後檢查：`dist/` 根目錄只保留 0.48.0 DMG／ZIP／Setup／Portable、其 blockmap、`latest.yml`／`latest-mac.yml`、兩平台 SHA、Windows 未簽章說明與 builder metadata；另保留目前的 `mac-arm64/`、`win-unpacked/` 驗證目錄。
- 回復：歷史封裝已永久移除而未送入垃圾桶；可由對應 GitHub Release 重新下載，或從既有 tag 重新建置。來源碼、tag、GitHub Release、使用者任務資料與 bundled runtime 未刪除。

## 0.48.0 GitHub 發布後核對（2026-07-30）

- 發布狀態：`v0.48.0` 已於 `2026-07-30T03:58:52Z` 正式公開，`isDraft=false`、`isPrerelease=false`，`gh release list` 顯示 `Latest`。
- 來源：tag `v0.48.0` 與遠端 `codex/0.48-local-llm` 在發布時均解析至 `4cdb0177d84693a334fac79b96c596e1b416456f`；Release URL 為 `https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.48.0`。
- 資產完整性：GitHub Release 共 9 項 uploaded 資產；macOS DMG `224057671` bytes／`334e50b...beee`、ZIP `229406028` bytes／`53ca4e...2f80`、Windows Setup `216165301` bytes／`7be039...bd54`、Portable `215460201` bytes／`b18782...3ca5`，均與本機 SHA-256 一致。
- metadata：`latest.yml` 380 bytes、`latest-mac.yml` 570 bytes；`SHA256SUMS-windows-x64.txt` 219 bytes，已同時列出 Setup 與 Portable；macOS SHA 與 Windows 未簽章狀態檔均存在。
- 下載 URL：9 項資產皆已由草稿 `untagged-*` URL 切換為 `/releases/download/v0.48.0/<asset>` 正式 URL。
- 既有風險：Windows 未 Authenticode、macOS 未 Developer ID 簽章／公證；小模型翻譯品質與跨平台乾淨實機缺口仍依 Release notes 揭露，不因 GitHub 發布完成而視為消失。
