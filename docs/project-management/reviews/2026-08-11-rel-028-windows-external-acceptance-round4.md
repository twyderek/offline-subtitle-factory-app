# 獨立複審報告：REL-028 Windows／外部驗收阻擋修正

- 審查對象 commit／版本：`e621b218102432ff64c493581d22e6c5b7ac00d3`（`test: retry settings event in renderer smoke`），版本 `0.48.1`，分支 `codex/release-v0.48.1`。
- 對應 08-CHANGE-LOG 條目：`2026-08-11 — Windows／外部驗收阻擋修正（REL-028）`（`docs/project-management/08-CHANGE-LOG.md:16`）。
- 前輪報告：`docs/project-management/reviews/2026-08-11-rel-028-windows-external-acceptance-round3.md`。
- 審查輪次：round4。
- 審查代理啟動時間、上下文來源：2026-08-11T13:16:34+08:00 前完成 release preflight、最新 commit／workflow／changelog、Git ref、完整本機回歸與文件結案閘門核對；本報告由獨立複審上下文建立，只新增本報告。
- 審查環境：macOS Apple Silicon、Node.js `v22.22.3`；本機未直接啟動 Windows executable，且本輪沒有取得 GitHub Actions 原始 log／artifact 下載內容，故對 run `31460797622` 以目前工作紀錄的可追溯摘要為證據並明確標示未反向核驗項目。

## 審查摘要

相較 round3，`e621b21` 所在提交鏈已包含 PowerShell ASCII-only、Windows renderer cache cleanup retry、應用標題 target 選擇、CDP response shape normalization，以及設定事件 3 秒輪詢／重送；目前 changelog 記錄 [run 31460797622](https://github.com/twyderek/offline-subtitle-factory-app/actions/runs/31460797622)（head commit `e621b218102432ff64c493581d22e6c5b7ac00d3`）已完整通過 source regression、Setup／Portable packaged renderer、靜默安裝／解除安裝、archive／SHA 與 artifact upload，且 remote-tracking branch 已指向 e621b21。本機 `npm run check` 亦通過。另有主要代理新增的 `docs/project-management/evidence/2026-08-11-whisper-base-small-download-acceptance.json` 記錄 Base／Small 固定 revision、size、SHA-256 均 pass；該檔案尚未提交且本輪未自行下載模型。`v0.48.1` tag 仍指向舊提交、最新 changelog 更新仍有未提交差異，CI artifact／SHA 沒有本輪獨立下載反向核對，Base／Small 中文品質、真實 provider、Windows 10／11 實機與使用者品質仍未驗收；結論維持有條件通過。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - REL-028 的成功條件包含 Windows taskkill／POSIX 語意、Setup／Portable／解除安裝 renderer smoke、Base／Small 固定來源驗收與 provider strict contract；條目明確排除把 CI 當 Windows 10／11 實機、把模型完整性當中文品質、把 endpoint smoke 當人工翻譯品質（`docs/project-management/08-CHANGE-LOG.md:16-30`）。
  - `e621b21` 的提交內容雖只新增一行設定事件重送／輪詢，前序提交鏈已包含 renderer cache lock retry、CDP 單／雙層 response、target title 過濾及 ASCII-only PowerShell；這些修正與 run `31460797622` 所記錄的歷次失敗根因相符。
  - 目前未提交 changelog 差異已加入 `31460797622` 的成功摘要（Windows source regression、Setup／Portable renderer、靜默安裝／解除安裝、archive／SHA、artifact upload），但該差異不屬 e621b21 commit tree，報告目標與治理紀錄尚未形成同一不可變快照。
  - round3 條件仍為 Windows／實機、Base／Small 品質、真實 provider 與安裝後證據；新增 evidence JSON 可補足 Base／Small 檔案完整性，但 run `31460797622` 與該 JSON 均不能關閉中文品質、效能或外部使用者流程缺口。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - `verify-electron-renderer.mjs:149-162` 將設定 modal 從固定 300ms 等待改成最多 3 秒、每 100ms 重送 `open-app-settings` 事件並檢查可見性，直接對應歷次 startup／event race；`waitForTarget` 另要求應用標題含「字幕」，避免誤選 `about:blank`。
  - `removeSmokeUserDataWithRetries` 對 Windows `EBUSY`／`EPERM`／`ENOTEMPTY` 最多重試 20 次，每次 500ms，並在 child termination 後清理 userData；這與 run `31458728556` 所記錄的 Chromium cache lock 失敗根因一致。
  - `evaluateValue` 支援 CDP 單層／雙層 result shape；但 `const rendererJobId = uploadFlow.result.result.value.jobId`（`verify-electron-renderer.mjs:211`）仍直接取雙層結構，若 upload response 再次呈單層，後續 review smoke 仍可能在 normalization 前失敗；run `31460797622` 通過只能證明該 runner 當次 response shape 可用。
  - Windows workflow 在 smoke 前先建立 Setup／Portable，再由 PowerShell 呼叫 renderer verifier，之後才執行 7z archive、SHA 產生與 artifact upload；流程順序符合需求，但本輪未直接執行 Windows process／NSIS。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - CI 摘要涵蓋 source regression、Setup／Portable packaged renderer、靜默安裝／解除安裝、archive／SHA／artifact upload，並已歷經 PowerShell 編碼、EBUSY、設定事件 race、CDP shape、about:blank target 等失敗修正；這是比 round3 更完整的候選包流程覆蓋。
  - renderer verifier 的 modal 輪詢有 3 秒上限，cache cleanup 有固定 20 次上限；超過上限會失敗而非吞錯，邊界行為可追溯。
  - CI smoke 仍使用 synthetic upload／manual ASR 與隔離 userData；沒有真實 30–60 秒中文音訊、SmartScreen、捷徑、手冊動畫、離線、userData 權限或乾淨 Windows 10／11 使用者流程。
  - Base／Small 固定下載 evidence JSON（`docs/project-management/evidence/2026-08-11-whisper-base-small-download-acceptance.json`）記錄 base `147951465` bytes／`60ed5bc3...` 與 small `487601967` bytes／`1be3a9b2...` 均符合固定 revision；但沒有中文品質／效能／記憶體、Groq／Gemini／Azure／OpenAI-compatible 真實 response、429／timeout／取消證據。LM Studio 仍依需求暫緩。
  - `verify-windows-installation.ps1` 以第一個非 `Uninstall*.exe` 作安裝後 executable；若安裝目錄有多個主程式／runtime executable，選擇穩定性仍未由本輪 Windows log 證明。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - `npm run check`、`git diff --check` 通過；`verify-electron-renderer.mjs` 的 retry／target／modal／CDP 修正均在小範圍、具明確錯誤邊界的 helper／流程中，未修改產品 runtime。
  - 目前工作樹唯一未提交差異為 `docs/project-management/08-CHANGE-LOG.md`，產品／測試來源與 e621 commit clean；這避免把報告或治理草稿混入 CI commit，但也造成 changelog 成功摘要尚未成為 e621 不可變來源的一部分。
  - Workflow 仍使用 `if: env.CSC_LINK != ''` 而 `CSC_LINK` 僅在同一步 env 設定（`.github/workflows/windows-preview.yml:40-52`）；run 成功摘要未提供簽章分支實際選擇與 Authenticode 狀態，不能將 archive／SHA pass 解讀為 signed release。
  - `evaluateValue` 已集中處理 CDP shape，但 line 211 的直接雙層取值是剩餘可維護性風險；不影響當次成功 run 的已記錄結果，卻應在後續修正中統一使用 helper。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 本輪獨立執行 `npm run check` 完整通過，涵蓋治理、語法、Whisper／Breeze／下載取消、媒體／雙語／品質、AI／Ollama／review UI 與核心 API；證明 e621 前序修正鏈未造成 host platform 回歸。
  - 目前 changelog 的 [run `31460797622`](https://github.com/twyderek/offline-subtitle-factory-app/actions/runs/31460797622) 摘要明確列出 source regression、Setup／Portable packaged renderer、靜默安裝／解除安裝、archive／SHA、artifact upload 均通過，head commit 為 `e621b218102432ff64c493581d22e6c5b7ac00d3`；本報告將其列為主要代理／CI 工作紀錄證據，不冒充本輪直接重播。
  - 本輪未取得 Actions 原始 log、artifact archive、SHA 清單下載或 GitHub digest，因此無法獨立反算 Setup／Portable 的實際 SHA、確認 artifact 內容與 run head SHA 的對應。
  - Base／Small 下載完整性已有主要代理 evidence JSON，但本輪未反向下載／重算；provider live、Windows 實機、真實音訊／人工品質、SmartScreen／事件檢視器仍沒有測試證據，CI 綠燈不覆蓋這些範圍。
  - `npm run docs:check:final` 目前 exit 1：最新條目仍非完成、最新審查引用與報告逐字句不一致、round4 條件尚未被需求方接受。這是治理結案阻擋，不是 CI regression 失敗。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - `git status --short` 顯示只有主要代理未提交的 `docs/project-management/08-CHANGE-LOG.md`；`git rev-parse HEAD` 與 `refs/remotes/origin/codex/release-v0.48.1` 均為 `e621b218102432ff64c493581d22e6c5b7ac00d3`，證明 e621 已推送至該遠端 branch。
  - `refs/tags/v0.48.1^{}` 仍為 `5566243fbd2306c4d9033e4bc9d75fb5e30fa723`，不等於 e621；因此 branch 已包含成功 CI commit，但既有 tag／任何公開 Release 尚未移動或反向核對。
  - [run `31460797622`](https://github.com/twyderek/offline-subtitle-factory-app/actions/runs/31460797622)（head `e621b218102432ff64c493581d22e6c5b7ac00d3`）依 changelog 已通過 source regression、Setup／Portable renderer、靜默安裝／解除安裝、archive／SHA 與 artifact upload；這足以把 round3 的「沒有修正後 Windows runner smoke 證據」條件更新為「CI 候選包流程證據已補齊」，但不等於使用者 Windows 實機驗收。
  - 沒有本輪可直接操作的 Windows executable、artifact、SHA 清單或真實音訊；因此不能 independently claim archive bytes、SHA values、artifact file list、Authenticode 或 installer screenshots。
  - 文件目前有未提交 changelog 差異，且 `docs:check:final` 紅燈；round4 報告需先由主要代理連結並逐字引用，完成條目後再決定是否仍因未實機／模型／provider 風險維持停止。

## 發現分級

### 阻擋

1. **外部驗收尚未完成。** run `31460797622` 證明候選包 CI 流程，但不證明 Windows 10／11 乾淨實機、真實音訊、SmartScreen、捷徑、離線手冊或 userData 權限；Base／Small 雖有檔案完整性 JSON，中文品質／效能與真實 provider 仍無證據。
2. **tag／Release 追溯未閉環。** remote branch 已到 e621，但 `v0.48.1` tag 仍指向 5566243，未建立指向 e621 的不可變 tag／公開 Release，也沒有下載後 digest／URL 反向核對。
3. **治理文件尚未結案。** changelog 成功摘要仍是未提交差異；`docs:check:final` 回報 latest entry 未完成、審查逐字句不一致、條件未獲接受。不能因 CI 綠燈而宣稱 REL-028 或 0.48.1 正式發布結案。

### 重要

1. 補強 `verify-electron-renderer.mjs:211` 使用 `evaluateValue(uploadFlow)?.jobId` 等統一 helper，避免單層／雙層 CDP response 對 upload flow 造成下一次假失敗。
2. 在 CI 證據中保存 run URL、head SHA、artifact 名稱／size、SHA 清單、簽章狀態與下載後 `7z t`／SHA 反向結果；目前 changelog 只有 pass 摘要，缺少可獨立重算的數值。
3. 明確核對 signed／unsigned workflow 分支與 `AUTH-2026-07-23-01` 範圍；unsigned／未公證風險獲授權不等於未實機風險獲接受。

### 建議

1. 在 Windows 10／11 乾淨實機補 Setup／Portable、真實音訊、SmartScreen、手冊、捷徑、userData、解除安裝與離線流程，保存截圖／事件／字幕／人工品質。
2. 以 evidence JSON 的固定 revision 為基準，補 Base／Small 中文長音訊品質／速度／記憶體驗收，並對 Groq／Gemini／Azure／OpenAI-compatible 以可撤銷低額度 key 保存 strict probe 與人工品質 evidence；LM Studio 維持暫緩。
3. 以 e621（或後續完成 commit）建立明確 tag／Release 前，重新核對四資產、updater metadata、SHA、簽章與下載 URL，不覆寫既有 tag。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：run `31460797622` 依工作紀錄已補齊 Windows runner 的 source regression、Setup／Portable renderer、靜默安裝／解除安裝、archive／SHA、artifact upload 證據，且 e621 已推送到遠端 branch；主要代理另提供 Base／Small 固定 revision size／SHA pass JSON，但 tag／Release 未指向 e621、CI artifact／SHA 未由本輪反向下載核驗，Windows 10／11 實機、Base／Small 中文品質、真實 provider、真實音訊與需求方風險接受仍不存在，治理 changelog 也尚未結案。
- 剩餘風險：CDP upload flow 仍有直接雙層取值、Windows signed／unsigned branch、NSIS／renderer／userData／SmartScreen、Base／Small 下載後中文品質／效能／記憶體、真實 provider contract／人工品質、tag／Release／artifact 下載追溯與未簽章／未公證。
- 給主要開發代理的具體修正要求（若有）：將本報告連結並逐字引用，提交 changelog 更新使 e621／run `31460797622`／round4 證據一致；保留 CI 綠燈但補齊 Windows 實機、模型、provider 與發布後資產核對，再建立指向同一已驗證 commit 的 tag／Release。若來源或封裝改變，重新計算 SHA／metadata 並進行受影響複審。
- 可逐字引用完整結論句：**REL-028 round4 獨立六面向複審結論為有條件通過：目前工作紀錄顯示 run 31460797622 已成功通過 Windows source regression、Setup／Portable packaged renderer、靜默安裝／解除安裝、archive／SHA 與 artifact upload，且 e621b21 已與遠端 branch 同步，因而 round3 的修正後 Windows CI smoke 缺口在候選包流程範圍內獲得補證；主要代理另提供 Base／Small 固定 revision 的 size／SHA pass JSON，但 `v0.48.1` tag／公開 Release 尚未指向 e621、CI artifact／SHA 未由本輪反向下載核驗，Windows 10／11 實機、Base／Small 中文品質、真實 provider／音訊及需求方風險接受仍未完成，changelog／final gate 也尚未結案，因此本輪只證明 Windows CI 候選包流程與模型檔案完整性證據補齊，不構成跨平台外部驗收完成或 0.48.1 公開發布授權。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告明確區分工作紀錄所載的 run `31460797622` CI 證據、本輪獨立本機回歸與尚未取得的 artifact／Windows 實機／模型／provider／發布後核對，不以 CI 綠燈冒充完整外部驗收。
- 若上述聲明不實，本報告無效。
