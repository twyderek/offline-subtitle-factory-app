# 獨立審查報告：REL-028 Windows／外部驗收阻擋修正

- 審查對象 commit／版本：`cf95ebe95ddb7e043bcf6d715e858cf32b747afa`（`test: harden external acceptance flows`），版本 `0.48.1`，分支 `codex/release-v0.48.1`。
- 對應 08-CHANGE-LOG 條目：`2026-08-11 — Windows／外部驗收阻擋修正（REL-028）`（`docs/project-management/08-CHANGE-LOG.md:16`）。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-08-11T12:07:08+08:00 前完成 release preflight、提交差異、文件、唯讀 Git ref、完整本機回歸與腳本失敗路徑檢查；本報告由獨立審查上下文建立，不把主要代理的預期結果當成通過證據。
- 審查環境：macOS Apple Silicon、Node.js `v22.22.3`；本機沒有 PowerShell／Windows runner，GitHub CLI token 已失效且 DNS 無法解析 GitHub，故無法從本輪獨立取得 Actions logs 或遠端 run metadata。

## 審查摘要

REL-028 的 Windows cross-platform test-core 條件分支、Setup／Portable lifecycle 驗收腳本、Base／Small 固定 revision 下載驗收入口及明確 opt-in provider probe 已加入，macOS 本機 `npm run check` 全部通過；但本輪無法證明任何 Windows runner 已執行新 smoke、無法證明 Base／Small 真實模型下載成功、無法證明 provider 真實端點通過，且 `probe-provider-live.mjs` 目前只檢查回應可解析為 JSON，沒有驗證 cue schema。`cf95ebe` 尚未被遠端 branch 或 `v0.48.1` tag 指向，文件現況亦與 REL-027 的已推送 tag 敘述衝突，因此結論為有條件通過，不能解除公開發布阻擋。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - REL-028 條目明確要求四類能力：Windows taskkill／POSIX 測試語意修正、Windows packaged renderer／Setup／Portable／解除安裝 smoke、Base／Small 真實下載入口、provider endpoint 外部驗收入口，並明確聲明不把 CI 當使用者 Windows 實機、不把模型完整性當中文品質、不把 provider connection 當人工翻譯品質（`docs/project-management/08-CHANGE-LOG.md:16-37`）。
  - `scripts/test-core.mjs:536-542` 依 `process.platform === 'win32'` 分開驗證 child close marker，符合既有 Windows `taskkill` 與 POSIX SIGTERM 行為差異；`scripts/verify-windows-installation.ps1:1-55` 具備 Setup 靜默安裝、安裝後 renderer、解除安裝檔移除及 Portable renderer 步驟；workflow 已在 archive／SHA 前呼叫該腳本（`.github/workflows/windows-preview.yml:54-62`）。
  - `scripts/verify-whisper-model-downloads.mjs:12-70` 只允許 `base,small`，使用固定 revision、大小／SHA-256、輸出 JSON 與可選快取；`scripts/probe-provider-live.mjs:19-27,89-106` 強制 opt-in、環境變數金鑰與 URL 遮罩並輸出 evidence。
  - 需求的「建立可重播入口」已完成，但「外部驗收完成」不是本提交已證明的結果；REL-028 自己仍將 Windows 10／11、模型中文品質、真實 Azure／Ollama／其他 endpoint 列為後續風險（`docs/project-management/08-CHANGE-LOG.md:37`）。
  - `00-CURRENT-STATUS.md:4` 仍寫 `0.48.1`「尚未建立 tag／Release」，但 `08-CHANGE-LOG.md` 的 REL-027 記錄 `v0.48.1` tag 已推送；這是文件一致性缺口，且目前 `cf95ebe` 實際未被 tag 指向。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - 本機 `npm run check`（2026-08-11）完整通過，包含 `docs:check`、語法檢查、Whisper／Breeze／治理／媒體／AI／Ollama／review UI／核心 API；macOS 分支實際驗證 child close marker 為存在，未改變 POSIX 原有語意。
  - `verify-whisper-model-downloads.mjs` 呼叫正式 `downloadWhisperModelFile`，會將下載檔寫入暫存、核對預期 size／SHA 後才通過，失敗仍寫出每模型 `status: fail` evidence；這是完整性驗收，不是品質驗收。
  - `verify-windows-installation.ps1` 使用隔離暫存目錄與 `verify-electron-renderer.mjs` 的隔離 userData，先 Setup、後解除安裝，再 Portable，流程方向正確；但只能在 Windows 執行，本輪沒有實際執行結果可證明其路徑、NSIS `/D` 行為或 child cleanup。
  - `probe-provider-live.mjs:70-83` 將任何可解析 JSON 的內容記為 `contentIsJson: true`，沒有解析 `cues` 陣列、`LIVE-1` ID、單筆數量、`text`／`reason` 欄位，也沒有把 `testResult.ok === false` 判為失敗。這會讓不符合正式字幕 contract 的 provider 回應產生假陽性，故不能把該 probe 的 `status: pass` 解讀為單 cue contract 通過。
  - Azure 未強制要求 `OSF_DEPLOYMENT`（`scripts/probe-provider-live.mjs:24,47` 會以空 deployment 建 endpoint），配置錯誤會延後到網路請求才失敗；這不會洩漏金鑰，但降低驗收入口的前置診斷品質。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 本機完整回歸保留模型下載前／partial-body 取消清理、API DELETE、Windows model replacement fixture 與 Breeze cancel；REL-028 只改 platform-specific marker 期待，未刪除暫存音訊／SRT 清理斷言。
  - Windows lifecycle 腳本覆蓋 Setup 不存在、安裝 exit code、安裝後 executable 不存在、缺少 uninstaller、解除安裝 exit code、解除安裝後 executable 殘留、Portable renderer 失敗等明確失敗路徑；但沒有真實音訊、SmartScreen、捷徑、操作手冊動畫、userData 權限或離線流程。
  - 模型腳本允許逐一記錄 base／small 下載失敗並繼續另一模型，且在未指定 `--cache-dir` 時預設清理暫存快取；`--keep-cache`／指定 cache 的保存語意可追溯，但沒有中斷、重試、磁碟不足或 Windows file-handle 的外部測試。
  - provider probe 對 LM Studio 明確拒絕，符合需求暫緩；但沒有內建 429、逾時、錯誤金鑰、取消／重試矩陣，也沒有人工翻譯品質、長字幕、費用或服務停止測試。
  - 本輪執行 `node scripts/verify-whisper-model-downloads.mjs --output /tmp/osf-models.json`，base 與 small 均為 `status: fail`、`error: fetch failed`（環境無法解析外網）；這是未取得模型證據，不是模型 checksum 失敗，也不能宣稱 Base／Small 可用。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - `node --check scripts/probe-provider-live.mjs`、`node --check scripts/verify-whisper-model-downloads.mjs`、`git diff --check cf95ebe^ cf95ebe` 通過；完整 `npm run check` 亦通過，未發現本提交造成 macOS 回歸。
  - 外部驗收腳本將秘密僅由環境變數讀取，evidence 只保存遮罩後 URL、provider／model／狀態／錯誤，不寫入 API key；模型 revision 與 SHA 固定在程式碼中，輸入模型名也受 base／small 白名單限制。
  - workflow 的 Setup／Portable lifecycle 步驟位置正確，位於封裝產物建立後、archive／SHA 前；但 Windows PowerShell 語法、本機安裝位置與 renderer child cleanup 本輪均未實跑，不能視為程式碼品質已跨平台證明。
  - workflow 的簽章條件使用 `if: env.CSC_LINK != ''`，而 `CSC_LINK` 只在同一步的 `env` 區段設定（`.github/workflows/windows-preview.yml:40-52`）；這個既有配置使 signed／unsigned 分支是否按 secret 狀態選擇缺少可由本機證明的依據，應在 CI 實跑時確認並列為交付風險。
  - provider probe 的 JSON-only 判定與 Azure deployment 前置檢查不足，是本提交新增驗收工具的可維護性／可信度問題，應在宣稱外部驗收前修正或明確降級為 connectivity-only。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-08-11 本機 `npm run check` 全部通過；其輸出包含「核心回歸測試通過」及所有既有測試群組，證明 commit 在 macOS／Node 22 的 deterministic 與核心 API 回歸未破壞。
  - 新增入口的失敗路徑已實際檢查：provider probe 未設定 `OSF_ACCEPT_EXTERNAL=1` 時立即拒絕；模型下載入口在外網不可達時寫出兩筆 `fail` evidence。新腳本語法檢查通過。
  - GitHub CLI `gh auth status` 顯示 `twyderek` token invalid；隨後 `gh run list --workflow windows-preview.yml` 無法取得結果，`git ls-remote` 亦因 DNS `Could not resolve host: github.com` 失敗。因此本輪沒有任何 cf95ebe Windows run 的成功 log；REL-028 只引用的 runs `31456061945`、`31456099247`、`31456211215` 都是修正前在 `scripts/test-core.mjs:536` 失敗的基準證據。
  - 本機沒有 `pwsh`，不能執行 `verify-windows-installation.ps1`；也沒有安全的真實 API key／endpoint，不能執行 provider live probe。故 Setup／Portable 安裝後 smoke、Windows taskkill 分支、Base／Small 真實模型、Groq／Gemini／Azure／OpenAI-compatible live endpoint 均未被本輪測試覆蓋。
  - `npm run docs:check:final` 不應在本輪被宣稱通過：REL-028 條目仍是「進行中／待執行獨立審查」，且本報告結論仍有未獲需求方接受的外部條件。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - `git status --short` 在審查開始時 clean；`git rev-parse HEAD` 為 `cf95ebe95ddb7e043bcf6d715e858cf32b747afa`，提交內容與工作樹一致，`git diff --check` 通過。
  - macOS 本機 `npm run check` 實際完成，治理、語法、單元、API／媒體回歸均通過；這證明 cross-platform 分支沒有破壞目前 host 平台，不證明 Windows branch 的 `taskkill` 行為。
  - `git rev-parse refs/remotes/origin/codex/release-v0.48.1` 得 `cb8c3625f07fc6a96891d58230476039c0b56dc3`，`git rev-parse refs/tags/v0.48.1^{}` 得 `5566243fbd2306c4d9033e4bc9d75fb5e30fa723`；兩者都不是 `cf95ebe`，且 `git branch --contains cf95ebe` 只有本地 `codex/release-v0.48.1`。REL-028 尚未被遠端 branch／tag 交付。
  - `/tmp/osf-models.json` 的 evidence 顯示 platform `darwin`、arch `arm64`、固定 revision `5359861c...`，base／small 各自 `fetch failed`；沒有模型檔、SHA 或中文音訊品質證據可供驗收。
  - 沒有 provider live JSON、Windows runner log、Setup／Portable 安裝後截圖／事件檢視器、真實音訊字幕或 SmartScreen 證據；因此實際運行結果只能判定本機候選回歸通過，不能判定外部驗收通過。

## 發現分級

### 阻擋

1. **Windows CI／安裝後 smoke 尚無成功證據。** GitHub token 無效、DNS 不通，且本機無 PowerShell；修正前的三個 run 均在同一測試斷言失敗，不能以 workflow YAML 的新增步驟代替 cf95ebe 的 Windows runner 成功 log。
2. **Base／Small 真實下載與中文品質未驗收。** 本輪下載入口因 `fetch failed` 兩模型均失敗；即使網路恢復並 checksum 通過，仍須使用合法 30–60 秒中文音訊、人工基準及資源／速度紀錄，不能把完整性當準確率。
3. **真實 provider endpoint 未驗收且 probe 目前可假陽性。** 沒有安全 endpoint／金鑰 evidence；新增腳本只驗證可 `JSON.parse`，不驗證 cue ID／數量／文字／reason，故不得解除 Groq／Gemini／Azure／OpenAI-compatible 的外部阻擋。
4. **來源追溯未包含 REL-028。** `cf95ebe` 不在遠端 branch 或 `v0.48.1` tag；REL-028 若需合併或交付，必須先建立明確來源 commit／推送並重新核對 workflow 產物，不得把舊 tag `5566243` 當成此修正已交付。

### 重要

1. 文件 `00-CURRENT-STATUS.md` 的「尚未建立 tag／Release」與 REL-027「tag 已推送」互相矛盾；應在後續治理條目中以遠端實際 ref 更新，不覆寫歷史證據。
2. `if: env.CSC_LINK != ''` 的 signed／unsigned 分支需以 Actions 實際 secret context 核對；目前無法由本機確認簽章路徑，且常設授權只涵蓋未簽章／未公證，不能將未知狀態描述為已簽章。
3. Windows lifecycle smoke 使用 synthetic upload／manual ASR 的 renderer verifier，未涵蓋真實音訊、內建 FFmpeg／Whisper、離線手冊、SmartScreen、捷徑與 userData 權限；即使 CI 後續綠燈，也只代表候選包流程，不代表 Windows 10／11 外部驗收。
4. provider probe 應至少檢查 `testResult.ok`、JSON object、`cues.length === 1`、ID `LIVE-1`、非空文字／reason，並對 Azure 缺少 deployment 做前置錯誤；否則 evidence schema 的 `status: pass` 不足以供發布決策使用。

### 建議

1. 取得有效 `gh` 認證與網路後，重跑 cf95ebe 對應 workflow，保存 run URL／commit SHA／job log、Setup／Portable smoke 輸出、SHA／archive／簽章狀態；另以 Windows 10／11 乾淨實機重播真實音訊與安裝後流程。
2. 將 Base／Small 模型 JSON、實際音訊、預期文字、人工校閱、耗時／記憶體與完整 SHA 證據保存於受控 evidence 目錄；模型不進 Git，大檔與金鑰不進 repo。
3. 修正 provider probe contract 後，使用可撤銷／低額度 endpoint 分 provider 保存遮罩後 JSON，另外記錄 429／timeout／錯誤金鑰／取消與人工品質結果；LM Studio 維持暫緩。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：本機 macOS `npm run check` 與新入口的靜態／失敗路徑檢查通過，但 Windows CI／Setup／Portable 安裝後 smoke 沒有 cf95ebe 成功證據，Base／Small 真實下載與中文品質未完成，真實 provider 未執行且 probe contract 不足，cf95ebe 也尚未進入遠端 branch／`v0.48.1` tag；上述條件未解決前不得宣稱 REL-028 外部驗收完成或解除 0.48.1 公開發布阻擋。
- 剩餘風險：Windows taskkill／PowerShell／NSIS／renderer／解除安裝／userData、真實 Windows 10／11 音訊與 SmartScreen、Base／Small CDN／中文準確率／效能／記憶體、Groq／Gemini／Azure／OpenAI-compatible 真實 contract 與人工品質、簽章分支判定、文件 tag／Release 狀態不一致。
- 給主要開發代理的具體修正要求（若有）：先修正 provider probe 的 strict cue contract 與 Azure deployment 前置檢查，取得有效 GitHub Actions 證據並在 Windows runner／實機重播安裝與真實音訊；保存 Base／Small 與 provider evidence，將 cf95ebe 推送並核對 ref／tag。完成後以新一輪獨立審查複驗，不得用本輪 macOS deterministic 通過或修正前失敗 run 取代外部證據。
- 可逐字引用完整結論句：**REL-028 round1 獨立六面向審查結論為有條件通過：cf95ebe 已正確加入 Windows taskkill／POSIX 測試分支、Setup／Portable 安裝後 smoke、Base／Small 固定 revision 下載入口與 opt-in provider probe，且本機 macOS `npm run check` 全部通過，但本輪沒有 cf95ebe 的 Windows runner 成功 log、Setup／Portable 實際安裝後證據、Base／Small 真實模型與中文品質證據或真實 provider evidence，新增 provider probe 也只檢查可解析 JSON 而未驗證 cue contract，並且 cf95ebe 尚未進入遠端 branch／`v0.48.1` tag，因此只能視為本機驗收流程修正有條件通過，不得宣稱 Windows／模型／真實端點外部驗收完成或解除公開發布阻擋。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告未把 workflow 設計、修正前失敗 run、macOS host 回歸或模型下載入口的 `fetch failed` 當成 Windows／模型／provider 通過證據。
- 若上述聲明不實，本報告無效。
