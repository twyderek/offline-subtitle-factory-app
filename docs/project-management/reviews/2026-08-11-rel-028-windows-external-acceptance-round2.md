# 獨立複審報告：REL-028 Windows／外部驗收阻擋修正

- 審查對象 commit／版本：`48a34ac7cb527815f2c8f1103f432b7dfbcecacc`（`fix: validate live provider cue contract`），版本 `0.48.1`，分支 `codex/release-v0.48.1`。
- 對應 08-CHANGE-LOG 條目：`2026-08-11 — Windows／外部驗收阻擋修正（REL-028）`（`docs/project-management/08-CHANGE-LOG.md:16`）。
- 前輪報告：`docs/project-management/reviews/2026-08-11-rel-028-windows-external-acceptance-round1.md`。
- 審查輪次：round2。
- 審查代理啟動時間、上下文來源：2026-08-11T12:07:08+08:00 後於新 HEAD 執行 release preflight、差異與文件核對、完整本機回歸、strict probe 失敗路徑及 Git ref 唯讀檢查；本報告為獨立複審，不修改前輪報告。
- 審查環境：macOS Apple Silicon、Node.js `v22.22.3`；本機沒有 PowerShell／Windows runner；GitHub 遠端 ref 以目前本地 remote-tracking refs 核對，Actions／最新遠端狀態仍因認證／DNS 限制無法獨立查詢。

## 審查摘要

48a34ac 已針對 round1 指出的 provider probe 假陽性完成兩項修正：Azure 缺少 deployment 會在發送請求前拒絕，provider 必須回報 `ok` 且模型可用，回應必須是含單一 `LIVE-1`、非空 `text`／`reason` 的 JSON `cues`。本機完整 `npm run check` 與新前置失敗路徑均通過，REL-028 round1 的工具邏輯缺口已修正；然而本輪仍沒有 Windows CI／Setup／Portable 安裝後證據、Base／Small 真實下載與中文品質、任何真實 provider evidence，且 48a34ac 尚未進入遠端 branch／`v0.48.1` tag。故只能有條件通過，不能解除公開發布阻擋。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - REL-028 條目仍涵蓋 Windows taskkill／POSIX 差異、Windows packaged renderer／Setup／Portable／解除安裝 smoke、Base／Small 下載入口與 provider endpoint 外部入口，並明確排除把 CI 當 Windows 10／11 實機、把模型完整性當中文品質、把 endpoint smoke 當人工翻譯品質（`docs/project-management/08-CHANGE-LOG.md:16-37`）。
  - 48a34ac 的 `scripts/probe-provider-live.mjs:25,58-80` 已實作 round1 要求：Azure 必須有 `OSF_DEPLOYMENT`；`provider.test()` 必須 `ok`；`modelAvailable === false` 會失敗；response 需可解析 JSON、`cues.length === 1`、cue ID 必須為 `LIVE-1`，且 `text`／`reason` 非空。
  - round1 獨立報告已由 changelog 連結並逐字引用（`docs/project-management/08-CHANGE-LOG.md:31-35`），且新 commit／strict contract 修正仍在本地，尚未被記錄成外部驗收完成。
  - Base／Small 與 Windows／provider 的「可重播入口」需求已具備，但其成功條件是外部證據而非程式碼存在；本輪沒有取得該證據，且 `docs/project-management/08-CHANGE-LOG.md:37` 仍誠實列為遺留風險。
  - `00-CURRENT-STATUS.md:4` 的「尚未建立 tag／Release」仍與 REL-027 條目所述已推送 `v0.48.1` 不一致；更重要的是目前 `v0.48.1` tag 仍未指向 48a34ac。文件與實際來源均未形成 REL-028 可追溯交付。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - `probe-provider-live.mjs` 先完成 opt-in、provider／URL／金鑰／Azure deployment 驗證，再呼叫 provider test，最後才送單 cue optimize；錯誤會寫成 `status: fail` evidence，不會把前置拒絕當成功。
  - strict contract 對 response 的 `choices[0].message.content`／`message.content` 做 JSON parse，再驗證單一 `cues`、`LIVE-1`、非空文字與 reason；相較 round1 的 JSON-only 假陽性已閉合主要缺口。
  - 這個 probe 仍是單 cue contract／連線驗證：沒有檢查翻譯文字不應等於來源、語言遵循、長字幕 cue 順序／時間碼、費用、429／取消／重試或人工品質；文件已將這些排除在 smoke 之外，不能擴大解讀。
  - `scripts/test-core.mjs` 的 Windows marker 條件仍只在 Windows branch 期待不存在 child SIGTERM marker、POSIX 期待存在；本機 macOS 回歸通過，但沒有 Windows process semantics 的實際執行證據。
  - `verify-windows-installation.ps1` 與 Base／Small 下載腳本本輪未改動，round1 指出的 PowerShell、固定模型完整性與真實品質缺口仍存在。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 本輪實際以缺少 `OSF_DEPLOYMENT` 執行 Azure probe，立即回報 `Azure 真實端點必須設定 OSF_DEPLOYMENT`；以 LM Studio 執行則立即回報需求暫緩，兩條前置失敗路徑均符合預期。
  - `npm run check` 保留 round1 的 partial-body cancellation、Windows model replacement fixture、Breeze cancel、核心 API 與其他回歸；strict fix 未破壞 host platform 行為。
  - strict probe 對空 `cues`、錯誤 ID、空 text／reason 的拒絕邏輯已由程式路徑可追溯，但沒有本地 fake provider contract fixture 或真實 endpoint response 讓本輪執行該四種 malformed response；因此只能判定靜態邏輯改善，不能判定所有失敗輸入已實跑。
  - Windows lifecycle 仍僅涵蓋 synthetic upload／manual ASR renderer smoke，未覆蓋真實音訊、SmartScreen、捷徑、手冊動畫、離線、userData 權限、Setup／Portable 實機；Base／Small 仍無中斷／重試／磁碟不足／中文長音訊證據。
  - LM Studio 被明確拒絕屬符合需求的邊界，不是 provider 全矩陣完成；Azure／Groq／Gemini／OpenAI-compatible 仍沒有真實 endpoint 證據。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - `node --check scripts/probe-provider-live.mjs`、`git diff --check 48a34ac^ 48a34ac` 及完整 `npm run check` 均通過；本輪沒有修改產品 runtime 或前輪報告。
  - strict probe 不把 API key 寫入 evidence，URL 仍移除 userinfo、query、fragment；provider／model／deployment／apiVersion 與 contract 狀態可追溯，前置錯誤訊息具體。
  - Azure deployment 前置要求與 `testResult.ok`／`modelAvailable` gating 提高 false-positive 防護；但程式仍未驗證 cue text 的語言或與來源文字的差異，應維持其「connectivity／contract smoke」定位。
  - Windows workflow 的 `if: env.CSC_LINK != ''` 與同一步才設定 `CSC_LINK` 的既有結構仍未由本輪修正或 CI 實跑釐清；簽章／unsigned 分支不能從本機推定。
  - 48a34ac 工作樹 clean，來源變更可由 commit diff 回溯；但因尚未推送／tag，程式碼品質與交付來源仍未形成公開候選的不可變遠端證據。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-08-11 本輪執行 `npm run check` 完整通過，包含治理文件、語法、Whisper／Breeze／下載取消、媒體／雙語／品質、AI／Ollama／review UI 與核心 API；證明 strict fix 未造成 macOS deterministic／API 回歸。
  - 本輪執行兩條新增前置失敗測試：Azure 無 `OSF_DEPLOYMENT` 及 LM Studio 暫緩，均以非零失敗並輸出預期訊息；`node --check` 亦通過。這些只證明 guard，不是 endpoint pass。
  - 沒有安全的真實 provider key／endpoint，沒有執行 `OSF_ACCEPT_EXTERNAL=1` 的成功 probe；沒有 Windows PowerShell，沒有 Setup／Portable smoke；Base／Small 下載仍受外網不可達阻擋，沒有成功 SHA／size evidence。
  - GitHub Actions 無法在本輪獨立取得：先前 `gh auth status` 顯示 token invalid，`gh run list` 不可用；網路 DNS 亦無法解析 GitHub。REL-028 目前只保留修正前失敗 run 的基準紀錄，沒有 48a34ac 成功 run log。
  - `npm run docs:check:final` 仍 exit 1（最新條目未完成、round1 有條件未獲接受）；加入本報告前不應宣稱 final gate 通過，加入後仍受未接受外部條件阻擋。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - `git status --short` clean；`git rev-parse HEAD` 為 `48a34ac7cb527815f2c8f1103f432b7dfbcecacc`；本地分支為 `codex/release-v0.48.1`。
  - `npm run check` 實際完成且所有既有測試輸出通過；strict guard 失敗路徑也實際執行。沒有本機 Windows／PowerShell／真實 provider／外網模型下載成功結果。
  - 本地 remote-tracking branch `origin/codex/release-v0.48.1` 仍指向 `cb8c3625f07fc6a96891d58230476039c0b56dc3`；本地 `v0.48.1^{}` 仍指向 `5566243fbd2306c4d9033e4bc9d75fb5e30fa723`；兩者都不是 48a34ac。`git branch --contains 48a34ac` 只有本地分支，故 strict fix 尚未推送／tag。
  - `docs/project-management/08-CHANGE-LOG.md:16-41` 已把 round1 報告與 strict fix 的驗證方向寫入，但 round2 報告尚未連結，狀態仍為進行中；本輪報告完成後仍需主要代理逐字引用本報告，不能由本輪自行改寫 changelog。
  - 沒有 Windows 安裝／解除安裝 log、renderer output、真實音訊字幕、模型 JSON／SHA、provider JSON、SmartScreen／事件檢視器或 GitHub Actions 成功證據；實際運行結果仍是「本機 host 回歸與 probe guard 通過」，不是外部驗收通過。

## 發現分級

### 阻擋

1. **Windows CI／安裝後驗收仍無成功證據。** 48a34ac 只改 provider probe，沒有新 Windows 執行結果；Setup／Portable／解除安裝、Windows taskkill 與 packaged renderer 仍未由本機或可查詢 CI 證明。
2. **Base／Small 模型仍未驗收。** 沒有固定 revision 的成功下載／size／SHA evidence，也沒有合法中文音訊、人工基準、速度／記憶體或長音訊品質資料；不得以新增下載命令解除 FR-023 阻擋。
3. **真實 provider endpoint 仍未驗收。** strict contract 修正只改善工具可信度；没有 Groq／Gemini／Azure／OpenAI-compatible 真實 response、錯誤／429／timeout／取消與人工品質 evidence。
4. **48a34ac 未進入遠端 branch／tag。** 目前 remote branch 與 tag 都指向舊提交，故新 strict contract 不能被現有 `v0.48.1` 來源或任何公開資產追溯。

### 重要

1. `00-CURRENT-STATUS.md` 的 tag／Release 敘述與 REL-027 歷史條目不一致；需由後續治理修正實際狀態，但不得把舊 tag 重新描述成包含 48a34ac。
2. Windows workflow 的 signed／unsigned secret 條件仍需在 Actions 實際核對；未知簽章狀態不能升級為已簽章證據，常設授權也不涵蓋未實機風險。
3. strict probe 的 JSON contract 已足以阻擋 malformed cue 假陽性，但仍不是翻譯品質驗收；若發布決策需要，應保存原始 response（去除秘密）與人工評分，而非只保存 cueContract 標籤。

### 建議

1. 取得有效 GitHub 認證／網路後，對 48a34ac 觸發或重跑 Windows workflow，保存 run URL、head SHA、Setup／Portable lifecycle output、archive／SHA／簽章與 artifact。
2. 在 Windows 10／11 乾淨實機重播真實音訊、離線手冊、SmartScreen、安裝／解除安裝與 userData；另保存 Base／Small 下載與品質證據。
3. 用可撤銷／低額度的 Groq、Gemini、Azure、OpenAI-compatible endpoint 分別執行 strict probe，保存遮罩 JSON、模型／deployment、錯誤／取消矩陣與人工翻譯品質；LM Studio 持續暫緩。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：round1 指出的 provider probe JSON-only 假陽性與 Azure deployment 缺少前置檢查已由 48a34ac 修正，且本機完整回歸與 guard 失敗路徑通過；但 Windows CI／Setup／Portable 安裝後、Base／Small 真實模型／中文品質、真實 provider endpoint、推送／tag／公開來源證據仍不存在，因此 REL-028 外部驗收與 0.48.1 公開發布阻擋尚未解除。
- 剩餘風險：Windows taskkill／PowerShell／NSIS／renderer／解除安裝／SmartScreen／userData、Base／Small CDN／中文長音訊準確率／效能／記憶體、Groq／Gemini／Azure／OpenAI-compatible 真實服務 contract／人工品質、簽章分支、文件 tag／Release 狀態不一致。
- 給主要開發代理的具體修正要求（若有）：先保留本輪 strict contract 修正並由主要代理連結本報告；取得有效 Windows CI／實機、Base／Small 與真實 provider evidence，再將 48a34ac（及任何後續修正）推送並核對遠端 branch／tag／資產。若任一來源或封裝改變，重新執行受影響測試與獨立複審，不得以本機 `npm run check` 或 guard 通過替代外部驗收。
- 可逐字引用完整結論句：**REL-028 round2 獨立六面向複審結論為有條件通過：48a34ac 已修正 round1 指出的 provider probe 假陽性，現在要求 Azure deployment、provider test ok／模型可用，以及單一 `LIVE-1` cue 的 JSON、非空 text／reason contract，且本機完整 `npm run check` 與前置失敗路徑通過；但 Windows CI／Setup／Portable 安裝後、Base／Small 真實模型與中文品質、Groq／Gemini／Azure／OpenAI-compatible 真實 endpoint、Windows／實機與推送／tag 證據仍不存在，48a34ac 也尚未進入遠端 branch／`v0.48.1` tag，因此本輪只證明驗收工具邏輯修正，不構成 REL-028 外部驗收完成或解除 0.48.1 公開發布阻擋。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告明確區分 48a34ac strict probe 邏輯修正、本機回歸／guard 證據與尚未取得的 Windows／模型／真實 endpoint／遠端交付證據，未以工具存在或本機 host 通過冒充外部驗收。
- 若上述聲明不實，本報告無效。
