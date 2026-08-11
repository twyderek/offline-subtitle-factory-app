# 獨立審查報告：0.48.1 GitHub 發布就緒收斂（REL-025）

- 審查對象 commit／版本：`codex/release-v0.48.1` 工作樹，基準 HEAD `170e08e17d38b4c7a9c94d3e1ba031a382539d9a`，應用程式版本 `0.48.1`；本輪差異尚未提交，故目前沒有可代表候選內容的不可變 release commit。
- 對應 08-CHANGE-LOG 條目：`2026-08-10 — 0.48.1 GitHub 發布就緒收斂（REL-025）`（`docs/project-management/08-CHANGE-LOG.md:47`）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-10T10:48:46+08:00；由獨立審查代理在獨立任務上下文執行，判定依 2026-08-10 11:00 Asia/Taipei 後凍結的工作樹、實際指令輸出與發布產物，不以主要開發代理的主觀評價代替查核。
- 審查環境：macOS Apple Silicon、Node.js `22.22.3`；Windows 候選為 macOS cross-build，未在 Windows 10／11 啟動。

## 審查摘要

最終凍結快照的程式回歸、依賴安全、macOS packaged renderer、四個主要資產、Tiny-only 封裝、SHA-256 與 updater SHA-512 均通過獨立重驗；目前不能直接公開發布的原因不是候選檔案 checksum，而是 REL-025 的治理結案、不可變來源 commit／GitHub 閉環及未實機風險授權仍未完成。

## 1. 需求追溯與完整性

- 判定：部分通過
- 證據：
  - `FR-022`／`FR-023` 明確要求 Tiny／Base／Small 白名單、固定來源、大小／SHA-256、userData 快取，以及取消時中止請求並清除未完成檔案（`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:38-39`）。
  - 設計把 POST／GET／DELETE、AbortController、原子置換及取消／失敗清理資料流追溯至 FR-023（`docs/project-management/03-FUNCTIONAL-DESIGN.md:47-55`）。
  - `package.json:94-145` 與 `package.json:148-204` 的 Windows／macOS `extraResources` 都只列入 `ggml-tiny.bin`；`scripts/write-runtime-manifest.mjs:13-36` 也把兩平台 `bundledModels` 固定為 `['tiny']`。
  - `RELEASE-NOTES-0.48.1.md:5-13` 說明三模型、下載取消、時間碼、Metal fallback、Ollama／Azure 與 Electron 升級，`RELEASE-NOTES-0.48.1.md:37-43` 明確揭露簽章、Windows、真實端點與模型品質限制。
  - REL-025 成功條件另包含文件結案與 GitHub 可追溯性（`docs/project-management/08-CHANGE-LOG.md:57`），目前仍缺不可變來源 commit、推送、tag、Release 與發布後下載核對，故不能判為完全通過。

## 2. 程式邏輯、程式碼品質與安全

- 判定：通過（另有一項重要測試缺口）
- 證據：
  - `downloadWhisperModelFile` 使用內部 AbortController 接收外部 `signal`，分離 timeout 與使用者取消錯誤，並在 `finally` 移除 listener、destroy stream 及刪除未 committed 暫存檔（`lib/whisper-model-download.mjs:93-161`）。
  - server 下載 state 持有 controller，DELETE 會即時標記 cancelled 並 abort，promise catch 維持 cancelled 契約；路由只接受白名單 definition（`server.mjs:988-1061`、`server.mjs:3713-3733`）。renderer 在下載視窗取消／關閉時送出 DELETE，只有 server 回覆成功才關閉 modal（`public/app.js:479-600`）。
  - 2026-08-10 11:00+08:00 重跑 `npm audit --json`：Electron `43.3.0`、electron-builder `26.15.7` 的 286 dependencies 為 0 vulnerabilities；`npm ls electron electron-builder --depth=0` 解析為上述精確版本，package lock 與 package version 均為 `0.48.1`。
  - 強特徵機密掃描涵蓋 private key、GitHub token、OpenAI key、Google key、Slack token、AWS access key，命中檔案數皆為 0；Git tracked files 未含模型、DMG、EXE、ZIP、憑證或 `.env`，未追蹤檔也沒有超過 5 MiB 的項目。`package.json:48-79` 另在封裝白名單排除 `.env`、憑證、secrets 與 credentials。
  - `git diff --check` 通過；兩平台 runtime verify 通過。既有 `asar:false`（`package.json:44`）維持為已揭露的後續封裝強化風險，不影響本輪功能判定。

## 3. 測試證據、邊界情況與覆蓋

- 判定：部分通過
- 證據：
  - 2026-08-10 11:00+08:00 在凍結快照獨立重跑 `npm run check` 全數通過，涵蓋文件、語法、Whisper fallback／三模型／下載／SRT、Breeze、治理、媒體、雙語、字幕品質、AI fetch／optimizer／providers、Ollama streaming、review UI 與核心 API。
  - 下載測試覆蓋 pinned metadata、任意模型拒絕、Windows 既有損壞檔原子替換、錯誤 SHA、過大回應、HTTP 503、timeout、外部 abort 與取消後無 `.download`（`scripts/test-whisper-model-download.mjs:15-81`）；封裝設定測試確認 Windows／macOS 都有 Tiny 且沒有 Base／Small（`scripts/test-whisper-models.mjs:100-127`）。
  - 重要缺口：目前取消 fixture 的 `neverResponds` 在 response body／暫存檔建立前就被 abort（`scripts/test-whisper-model-download.mjs:63-78`），因此「已寫入部分 `.download` 後中途取消」以及 DELETE API 對進行中下載的端到端清理未被自動測試直接證明；尤其 Windows 檔案 handle 釋放後刪除仍只靠程式推論與外部驗收。
  - 未覆蓋項目與 Release notes 一致：Windows 10／11 安裝、啟動、解除安裝、首次 Base／Small 真實下載、長音訊、真實 Azure、不同 Windows Ollama 版本、Base／Small 中文準確率與資源消耗（`RELEASE-NOTES-0.48.1.md:39-43`）。

## 4. 文件一致性與治理門檻

- 判定：部分通過
- 證據：
  - 版本在 `package.json:3`、package lock、README、Release notes、Windows workflow 與封裝內 `package.json` 均為 `0.48.1`；公開版本仍標示 `v0.48.0`，沒有把候選誤寫成已發布（`docs/project-management/00-CURRENT-STATUS.md:3-6`）。
  - 發布限制在 Release notes 與目前狀態都有揭露，常設授權邊界也明確保存（`docs/project-management/00-CURRENT-STATUS.md:42-60`、`docs/project-management/09-STANDING-AUTHORIZATIONS.md:5-14`）。
  - 需修正：`00-CURRENT-STATUS.md:14` 仍稱「待產物 metadata／SHA」，但四個 SHA 清單與 updater metadata 已在本輪獨立重驗完成，與實際狀態及 REL-025 `08-CHANGE-LOG.md:62` 不一致。
  - 需修正：同日 FR-024 條目位於 REL-025 前方（`08-CHANGE-LOG.md:16` 對 `:47`）；`scripts/check-project-docs.mjs:59-68` 對同一最新日期取第一個 matching block，所以 2026-08-10 11:02+08:00 的 `npm run docs:check:final` 雖顯示通過，實際驗證的是已結案 FR-024，未驗證仍為「進行中／待執行」的 REL-025（`08-CHANGE-LOG.md:49`、`:64-65`）。這是發布治理 gate 的假陽性，REL-025 必須移到最新位置或 validator 改為能明確選取真正最新條目，連結本報告並重新執行 final check。

## 5. 交付範圍與發布授權邊界

- 判定：部分通過
- 證據：
  - `AUTH-2026-07-23-01` 有效且涵蓋 Windows Authenticode 未簽章、macOS 未 Developer ID 簽章／公證（`docs/project-management/09-STANDING-AUTHORIZATIONS.md:5-12`）；本機 codesign 重驗為 `Signature=adhoc`、`TeamIdentifier=not set`，Windows 說明檔明示 unsigned，與揭露一致。
  - 同一授權明確排除未完成實機測試、checksum／metadata 不一致、機密、核心測試與獨立審查失敗（`docs/project-management/09-STANDING-AUTHORIZATIONS.md:13-14`）；REL-025 本身也承認本次指示只授權準備，不等於接受未實機風險或立即公開發布（`docs/project-management/08-CHANGE-LOG.md:66-71`）。
  - 因 Windows／Base／Small／真實端點缺口尚未由需求方另行接受，現階段只能是有條件候選；在補齊實機證據或取得具體風險接受前，不得建立公開 Release。
  - Windows workflow 在無簽章 secret 時產生 `UNSIGNED INTERNAL PREVIEW`、只上傳 14 天 artifact（`.github/workflows/windows-preview.yml:47-52`、`:91-113`），不等同正式 GitHub Release；若後續使用 CI 資產公開發布，須確保簽章狀態檔用語與公開 Release 身分一致。

## 6. 發布產物與 GitHub 可追溯性／實際運行結果

- 判定：部分通過（本機候選資產通過；GitHub 閉環未完成）
- 證據：
  - 2026-08-10 11:00+08:00 以 `shasum -a 256 -c` 重驗四個主要資產及兩份清單全部 OK：
    - macOS DMG：`72bf9b5700971536a1278448046880263b0bb3bb3199cc16293cef7d5e540cee`
    - macOS ZIP：`268b51400f58495dd9d69a6070294a0f98d9445e2a4b73988da64db5fbd78f32`
    - Windows Setup：`fd10704267ee28cb3f204b870d315d51ebb93e00dbd234c43681bd1f48c4b532`
    - Windows Portable：`ec3703327fd379bfe850c538eecf2f4a53ad727549b6cc14df7ca3791d7bd4ad`
  - 獨立 Node crypto 重算確認 `latest-mac.yml` 對 ZIP／DMG、`latest.yml` 對 Setup 的 URL、size、SHA-512 全部一致；DMG `hdiutil verify`、ZIP `unzip -t`、兩個 Windows NSIS EXE `7zz t` 均通過。
  - macOS `.app` 與 Windows unpacked `package.json` 都是 `0.48.1`；Windows app、FFmpeg、Whisper CLI 為 x86-64。兩平台封裝模型目錄各只有 `ggml-tiny.bin`，Base／Small 不存在，且均含 `RELEASE-NOTES-0.48.1.md`。
  - 2026-08-10 11:01+08:00 對最終 macOS packaged executable 獨立重跑 renderer smoke：Electron bridge、設定 modal、health/settings、manual upload→job completed→cleaned SRT、trim assets、術語 round-trip、七 provider 與 folder-open event 都通過；使用隔離 userData／暫存 job，未改產品檔。
  - 2026-08-10 查核：遠端沒有 `codex/release-v0.48.1` branch、沒有 `v0.48.1` tag，`gh release view v0.48.1` 回覆 `release not found`；目前 HEAD 仍是舊基準 `170e08e` 且工作樹含大量未提交差異，所以本機資產尚不能反向對應到一個 GitHub release commit。這符合本輪「不直接推送／tag／Release」範圍，但也是實際公開發布前的停止條件。

## 發現分級

### 阻擋公開發布

1. REL-025 尚未成為可追溯的不可變 commit，且尚未推送；`v0.48.1` tag／Release 不存在。必須在本報告結案後建立唯一來源 commit，推送並以該 commit 建立 tag，之後反向核對 GitHub asset digest、size 與下載 URL。
2. `docs:check:final` 目前只驗到同日置頂的 FR-024，沒有驗證 REL-025；須先修正條目順序／validator 選擇邏輯、更新 REL-025 review 欄位與狀態，再重跑 final gate。
3. `AUTH-2026-07-23-01` 不涵蓋缺少 Windows／Base／Small／真實端點實機驗收；在需求方明確接受這些具體風險或補齊證據前，不得公開發布。

### 重要

1. 補上「response body 已寫入部分暫存檔後取消」與 active DELETE API 整合測試，並在 Windows 實機驗證不殘留 `.download`／`.previous`。
2. 更新 `00-CURRENT-STATUS.md:14`，移除已完成 metadata／SHA 的過期待辦，改為只列仍存在的授權、GitHub 與實機缺口。
3. 如果正式 Windows 資產改用 Actions 產出，應以 Windows runner artifact 取代目前 macOS cross-build，完成實機啟動／安裝核對後再計算最終公開 SHA；不得把 14 天 preview artifact 或 workflow 綠燈直接當成 Release 完成。

### 建議

1. 發布時另存一份 machine-readable release manifest，記錄 release commit、四個主要資產、size、SHA-256、updater SHA-512 與簽章狀態，降低手動轉錄錯誤。
2. 後續另開工作評估 `asar:false` 封裝強化，不在 0.48.1 臨發布時更動 runtime 路徑。
3. GitHub 上傳後重新下載四個主要資產與 metadata，重算 digest；不要只核對本機 `dist/`。

## 綜合判定

- 結論：有條件通過
- 阻擋問題：本機候選資產本身未發現 checksum、版本、Tiny-only、archive 或 macOS renderer 阻擋；公開發布仍受 REL-025 final gate 假陽性、缺少不可變 source commit／遠端 branch／tag／Release，以及未實機風險未獲授權三項停止條件限制。
- 剩餘風險：Windows renderer／安裝／解除安裝、Base／Small 真實下載與中文長音訊、partial-body 下載取消清理、真實 Azure、不同 Windows Ollama 版本、macOS 乾淨帳號安裝後長音訊、未簽章／未公證與 `asar:false`。
- 給主要開發代理的具體修正要求：修正 REL-025 最新條目選擇與狀態文件、連結並逐字引用本報告、重跑 `docs:check:final`／`git diff --check`；補強 partial-body cancel 測試；在取得未實機風險接受或完成外部驗收後，再建立 release commit／push／tag／Release 並做發布後下載核對。

### 可逐字引用完整結論句

**REL-025 0.48.1 GitHub 發布就緒收斂 round1 獨立審查結論為有條件通過：固定快照已通過完整 `npm run check`、`npm audit` 0 弱點、最終 macOS packaged renderer、四項主要資產格式與版本、Tiny-only、SHA-256 及 updater SHA-512 核對，Electron 43.3.0／electron-builder 26.15.7 與 Whisper 模型下載取消實作亦可追溯，但 REL-025 目前仍未被 `docs:check:final` 真正驗證、工作樹尚未提交或推送且 `v0.48.1` tag／Release 不存在，`AUTH-2026-07-23-01` 只涵蓋未簽章／未公證而不涵蓋 Windows、Base／Small 與真實端點實機缺口，取消測試也尚未覆蓋已寫入部分暫存檔後的中途取消，因此在完成治理結案、建立可追溯來源 commit 並由需求方明確接受未實機風險或補齊外部驗收前，不得公開發布或宣稱無條件正式版。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 審查期間曾偵測到主要代理尚在完成最終 build／文件與並行分支切換；本報告沒有把當時的中間雜湊或分支狀態當成最終證據，而是等到主要代理於 11:04+08:00 明確凍結並切回 `codex/release-v0.48.1` 後，依最終穩定快照完成判定。
- 若上述聲明不實，本報告無效。
