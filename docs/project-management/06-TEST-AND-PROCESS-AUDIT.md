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

- `test-ai-optimizer.mjs`：驗證 BCP 47 基本、variant、extension 標準化，惡意／無效值拒絕、舊設定回退、翻譯 Prompt、一般優化 Prompt，以及模型交換 cue 順序時必須拒絕。
- `test-review-ui.mjs`：驗證常用語言選項、自訂語言欄位與送出時共用語言解析函式。
- `test-core.mjs`：驗證自訂 `fr-CA` 可保存並標準化，專用 AI 設定、一般設定及 AI 任務 API 的非法語言值均回覆 400，舊版非法設定檔在啟動時回退繁中，AI 任務沿用多語設定。
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
- 未覆蓋：未使用真實 Groq／Gemini API Key 呼叫外部服務；Windows 候選仍為 2026-07-20 CI 資產，尚未重建。2026-07-22 macOS arm64 已依修正來源重建，DMG `hdiutil verify`、ZIP `unzip -t` 通過；App 內含 `ai-provider-settings.mjs`、`review.js` 與 `server.mjs`。另發現 `latest-mac.yml` 內的英文資產檔名與實際中文輸出檔名不一致，updater metadata 尚未通過。
