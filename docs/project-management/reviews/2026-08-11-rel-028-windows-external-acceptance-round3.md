# 獨立複審報告：REL-028 Windows／外部驗收阻擋修正

- 審查對象 commit／版本：`1eb17c2fcf47faa11579351e62edc3a01995089c`（`fix: make Windows smoke script encoding safe`），版本 `0.48.1`，分支 `codex/release-v0.48.1`。
- 對應 08-CHANGE-LOG 條目：`2026-08-11 — Windows／外部驗收阻擋修正（REL-028）`（`docs/project-management/08-CHANGE-LOG.md:16`）。
- 前輪報告：`docs/project-management/reviews/2026-08-11-rel-028-windows-external-acceptance-round2.md`。
- 審查輪次：round3。
- 審查代理啟動時間、上下文來源：2026-08-11T12:24:16+08:00 前完成 release preflight、新提交差異、文件、ASCII 字元檢查、完整本機回歸與 Git ref 唯讀核對；本報告由獨立複審上下文建立，不修改前輪報告或產品檔案。
- 審查環境：macOS Apple Silicon、Node.js `v22.22.3`；本機沒有 PowerShell／Windows runner，無法直接重播 Windows smoke。

## 審查摘要

1eb17c2 將 Windows smoke PowerShell 腳本中的中文字串與非 ASCII executable 假設移除，改為 ASCII-only 訊息，並透過安裝目錄內第一個非 `Uninstall*.exe` 的 executable 尋找安裝後程式，直接針對 run `31458089089` 所記錄的 PowerShell 編碼解析失敗根因。腳本現在沒有非 ASCII 字元，本機完整 `npm run check` 及差異檢查通過；但沒有 1eb17c2 的 Windows rerun、Setup／Portable 安裝後輸出、Base／Small 模型或真實 provider 證據，且遠端 branch 只到 4b04343、`v0.48.1` tag 仍是舊提交。因此本輪只能有條件通過，不解除外部驗收或公開發布阻擋。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - REL-028 仍要求 Windows taskkill／POSIX 測試語意、Setup／Portable／解除安裝 smoke、Base／Small 下載入口與 provider strict contract，並明確排除將 CI 當使用者 Windows 10／11 實機、將模型完整性當中文品質（`docs/project-management/08-CHANGE-LOG.md:16-37`）。
  - 1eb17c2 的唯一產品變更是 `scripts/verify-windows-installation.ps1`：錯誤／進度／完成訊息改為 ASCII，安裝後 executable 改以 `Get-ChildItem` 篩除 `Uninstall*.exe` 後尋找（`scripts/verify-windows-installation.ps1:13-57`），直接對應 changelog 所述的 PowerShell 編碼解析失敗。
  - 前輪 strict provider contract、Base／Small 固定 revision 入口與 workflow lifecycle 仍保留；本輪沒有把任何外部測試結果寫成已通過。
  - round2 報告已由 changelog 連結且仍標示條件未被接受；1eb17c2 尚未在 changelog 建立 round3 連結，故文件結案尚未完成。
  - `00-CURRENT-STATUS.md` 對 tag／Release 的現況仍與 REL-027 歷史推送敘述不一致；本輪實際 remote-tracking branch／tag 也沒有指向 1eb17c2，來源追溯條件未滿足。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - `LC_ALL=C grep -n '[^ -~\t]' scripts/verify-windows-installation.ps1` 無輸出，證明腳本檔案本身沒有非 ASCII 字元；這是針對 run 31458089089 編碼解析失敗的合理、局部修正。
  - 安裝後 executable 不再硬編碼中文檔名，改以安裝根目錄的 `.exe` 篩選並排除 uninstaller，理論上能適應 Unicode／不同 artifact 命名；Setup、renderer、uninstall、Portable 的順序與原腳本一致。
  - 這個篩選會選取第一個非 `Uninstall*.exe` 檔案，若安裝根目錄含其他 executable，可能選錯；本輪沒有 Windows 安裝目錄實際清單，故不能證明選擇穩定。缺少 executable 時 `Test-Path -LiteralPath $installedExe` 的 null 行為也未由 PowerShell 實跑確認。
  - changelog 將 run `31458089089` 描述為 source regression／build 通過但新增 smoke 在 PowerShell 編碼解析階段失敗；1eb17c2 只修正腳本輸入，不包含 workflow、NSIS 或 renderer runtime 變更，因此邏輯上仍需同一 workflow rerun 才能確認根因已解除。
  - 前輪 48a34ac 的 provider strict cue contract 仍要求 Azure deployment、`test.ok`／模型可用、單一 `LIVE-1`、非空 text／reason；本輪未修改，未發現回退。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 本機完整回歸保留 Windows marker 分支、partial-body cancellation、model replacement 與核心清理；1eb17c2 沒有改動這些執行路徑。
  - ASCII 字元檢查涵蓋整個 PowerShell 檔案，避免原始中文字串造成 parser／code page 失敗；但沒有 Windows PowerShell 5.1／PowerShell 7 兩種 parser 實際測試。
  - Setup 安裝後若只有 uninstaller，篩選結果為空；若有多個非 uninstaller executable，`Select-Object -First 1` 可能選擇非主程式。兩種邊界均未在 Windows runner 實跑。
  - 仍未覆蓋 Windows SmartScreen、捷徑、手冊動畫、離線、真實音訊、userData 權限、解除安裝殘留、Base／Small 中斷／重試／中文長音訊，亦沒有 Groq／Gemini／Azure／OpenAI-compatible 真實 endpoint、429／timeout／cancel 矩陣。
  - LM Studio 仍依需求暫緩；這是明確範圍邊界，不代表 provider 全矩陣通過。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - `npm run check`、`node --check scripts/probe-provider-live.mjs`、`git diff --check 1eb17c2^ 1eb17c2` 通過；腳本只做 ASCII／檔名與訊息修正，變更範圍小且可回溯。
  - PowerShell 訊息改為清晰 ASCII，降低 Windows runner code page 依賴；artifact path 仍作為參數傳入，沒有把 secrets 或使用者資料寫入腳本。
  - 本機沒有 PowerShell，因此無法檢查 `Get-ChildItem` pipeline、`Test-Path` null、NSIS `/D`、uninstaller handle 或 renderer child cleanup 的實際語意；不能以 grep 通過替代 parser／執行通過。
  - workflow 的 signed／unsigned 分支（`.github/workflows/windows-preview.yml:40-52`）與 PowerShell smoke 的實際 CI context 仍未核對；簽章狀態不得從此次 ASCII 修正推論。
  - 來源追溯仍不完整：`origin/codex/release-v0.48.1` 只到 4b04343，`v0.48.1^{}` 只到 5566243，均不包含 1eb17c2。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-08-11 本輪獨立執行 `npm run check` 完整通過，包含治理、語法、Whisper／Breeze／下載取消、媒體／雙語／品質、AI／Ollama／review UI 與核心 API；證明 ASCII-only 修改未造成 host platform 回歸。
  - `LC_ALL=C grep` 無非 ASCII 字元、`node --check scripts/probe-provider-live.mjs` 與 `git diff --check` 通過，屬本機靜態證據。
  - changelog 的 run `31458089089` 是推送後基準 run，記錄 source regression／build 通過但 smoke 因 PowerShell 編碼解析失敗；本輪沒有可獨立取得的同 run log，也沒有 1eb17c2 之後的 Windows rerun，因此不能判定根因修正成功。
  - 本機沒有 `pwsh`，未能執行 `scripts/verify-windows-installation.ps1`；沒有真實 provider credentials／endpoint，未執行 live probe；外網模型下載／中文品質仍無證據。
  - `npm run docs:check:final` 仍預期因 REL-028 未完成與 round2 有條件未獲接受而 exit 1；本輪報告尚未連結前，不應宣稱 final gate 通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - `git status --short` clean，`git rev-parse HEAD` 為 `1eb17c2fcf47faa11579351e62edc3a01995089c`；本地分支 `codex/release-v0.48.1`。
  - `npm run check` 實際完成；ASCII 檔案檢查無輸出。沒有 Windows installer、renderer、uninstaller 或 Portable 的實際輸出可引用。
  - `git rev-parse refs/remotes/origin/codex/release-v0.48.1` 得 `4b04343f1cc5e7629e51792d6ba09c4944018553`；`git rev-parse refs/tags/v0.48.1^{}` 得 `5566243fbd2306c4d9033e4bc9d75fb5e30fa723`；均不等於 1eb17c2。故 ASCII 修正尚未進遠端 branch／tag。
  - `08-CHANGE-LOG.md:26` 已保存 run `31458089089` 的失敗根因及 ASCII 修正理由，且 round2 條件仍明列 Windows／模型／provider／推送缺口；但 round3 證據尚待本報告連結。
  - 沒有 Base／Small 成功下載 JSON／SHA、中文音訊字幕／人工基準、真實 provider JSON、Windows SmartScreen／事件檢視器或安裝後截圖；實際結果只能判定本機 host regression 通過。

## 發現分級

### 阻擋

1. **1eb17c2 尚未取得 Windows rerun。** run `31458089089` 的 smoke 失敗只證明原腳本的 PowerShell 編碼解析問題；ASCII 修正後沒有新的 Windows runner log，不能宣稱 Setup／Portable／解除安裝／renderer smoke 通過。
2. **外部驗收仍未完成。** Windows 10／11 實機、Base／Small 真實模型與中文品質、Groq／Gemini／Azure／OpenAI-compatible live endpoint 均無證據，亦沒有需求方對這些缺口的風險接受。
3. **來源交付未包含 1eb17c2。** remote branch 到 4b04343、`v0.48.1` tag 到 5566243；若後續 workflow 以 branch／tag 觸發，必須先推送 1eb17c2 並核對 head SHA，否則跑到舊來源。

### 重要

1. PowerShell executable discovery 應在 Windows runner 輸出安裝目錄檔案清單，確認不會因多個 `.exe` 選錯；缺少檔案時應有明確、可解析錯誤，而不是依賴 null 參數行為。
2. 以 Windows PowerShell 5.1／PowerShell 7 分別執行 smoke；ASCII-only grep 只能證明字元集，不能證明 NSIS、renderer、uninstaller handle 或工作目錄正確。
3. `00-CURRENT-STATUS.md` 的 tag／Release 現況與 REL-027 歷史條目應由後續治理條目依實際 ref 修正，不得把舊 tag 描述成包含 1eb17c2。

### 建議

1. 取得有效 GitHub Actions 權限／網路後，將 1eb17c2 推送到指定 branch，重新執行 workflow，保存 run URL／head SHA／PowerShell parser／Setup／Portable／uninstall／renderer／archive／SHA／簽章輸出。
2. 在 Windows 10／11 乾淨實機補真實音訊、SmartScreen、捷徑、手冊動畫、離線與 userData 權限；保存 Base／Small 下載、品質、速度／記憶體及 provider live evidence。
3. Windows rerun 成功後，要求新一輪獨立複審核對相同 commit 的 workflow 與 artifact；若來源／封裝再變，重新計算 checksum／metadata 並重跑受影響驗收。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：1eb17c2 已以 ASCII-only PowerShell literals 與非硬編碼中文 executable 名稱，合理修正 run 31458089089 的編碼解析根因；本機完整回歸與靜態字元檢查通過，但沒有修正後 Windows rerun、Setup／Portable／解除安裝／renderer 證據，Base／Small／真實 provider／Windows 實機仍未驗收，且 1eb17c2 尚未進遠端 branch／`v0.48.1` tag。
- 剩餘風險：PowerShell 5.1／7 parser 與 NSIS 安裝路徑、executable discovery／uninstall handle、Windows renderer／SmartScreen／離線／userData、Base／Small CDN／中文準確率／效能／記憶體、真實 provider contract／人工品質、簽章分支與遠端來源追溯。
- 給主要開發代理的具體修正要求（若有）：先將 1eb17c2 推送並重跑 Windows workflow，確認 ASCII 修正實際解除 31458089089 的 smoke 失敗；保存完整 runner／artifact 證據，再補 Windows／模型／provider／實機外部驗收並由新一輪獨立複審核對。不得以本機 `npm run check` 或 ASCII grep 通過替代 Windows 執行證據。
- 可逐字引用完整結論句：**REL-028 round3 獨立六面向複審結論為有條件通過：1eb17c2 已將 Windows smoke PowerShell 腳本改為 ASCII-only 訊息並移除中文 executable 硬編碼，合理對應 run 31458089089 所記錄的 PowerShell 編碼解析失敗，且本機完整 `npm run check`、ASCII 字元檢查與差異檢查通過；但尚無 1eb17c2 修正後的 Windows runner／Setup／Portable／解除安裝／renderer 成功證據，Base／Small 真實模型與中文品質、真實 provider、Windows 實機及推送／tag 仍未完成，1eb17c2 也尚未進入遠端 branch／`v0.48.1` tag，因此本輪只證明本機編碼修正合理，不構成 REL-028 外部驗收完成或解除 0.48.1 公開發布阻擋。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告區分 run 31458089089 的原始失敗根因、1eb17c2 的靜態 ASCII 修正及尚未取得的 Windows／模型／provider／遠端交付證據，未把本機檢查冒充為 Windows runner 通過。
- 若上述聲明不實，本報告無效。
