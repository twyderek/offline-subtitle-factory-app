# 獨立複審報告：REL-028 Windows／外部驗收阻擋修正 round5

- 審查對象 commit／版本：`cb904a1edf51d5243652a66389a1d1906dc9994f`，版本 `0.48.1`，分支 `codex/release-v0.48.1`。
- 審查輪次：round5；前輪報告：`docs/project-management/reviews/2026-08-11-rel-028-windows-external-acceptance-round4.md`。
- 審查環境：macOS arm64、Node.js `v22.22.3`；本機不具 Windows executable／實機，GitHub Actions 原始 log 與 artifact 未由本輪直接下載。
- CI 證據：主要代理提供 Windows Actions [run `31461704805`](https://github.com/twyderek/offline-subtitle-factory-app/actions/runs/31461704805)，head `cb904a1edf51d5243652a66389a1d1906dc9994f`，記錄 source regression、Setup／Portable packaged renderer、靜默安裝／解除安裝、archive／SHA 與 artifact upload 成功；本報告將其標示為可追溯工作紀錄，不冒充本輪重播。
- 本輪驗證時間：2026-08-11 13:39（Asia/Taipei）完成受控權限下 `npm run check`；另執行 `npm run docs:check:final`，因治理條件尚未接受而失敗。

## 審查摘要

`cb904a1` 將 renderer upload flow 的 job ID 取值改為既有 `evaluateValue(uploadFlow)?.jobId` helper，並對缺少 job ID 明確失敗，修正 round4 指出的 CDP 單層／雙層 response 風險。Base／Small evidence JSON 以固定 revision 在 macOS arm64 完成 size／SHA pass；round4 報告已被 changelog 逐字引用且條件仍明示未獲接受。工作紀錄所載的 run `31461704805` 補上最新 Windows CI 成功流程，但目前 changelog 仍只列 run `31460797622`／`e621b21`，尚未把本輪 run／commit／round5 報告納入同一治理快照。綜合判定維持有條件通過，不構成跨平台外部驗收完成或公開 Release 授權。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - REL-028 條目要求 Windows taskkill／POSIX 語意、Setup／Portable／解除安裝 renderer smoke、Base／Small 固定來源驗收及 provider strict contract；同時明確排除把 CI 當 Windows 10／11 實機、把模型完整性當中文品質、把 endpoint smoke 當人工翻譯品質（`docs/project-management/08-CHANGE-LOG.md:16-30`）。
  - `cb904a1` 已完成 round4 所指出的 `rendererJobId` helper 缺口；`npm run check` 在受控權限下完整通過，涵蓋模型下載部分寫入後取消、核心 API、AI/provider 與回歸測試。
  - round4 報告路徑與完整結論已在 changelog `:34-36` 引用，且仍記錄 Windows／Base／Small／真實 provider／音訊及需求方風險接受未完成；但 changelog `:31` 的 CI 成功摘要仍是 run `31460797622`，未記錄本輪指定的 run `31461704805`，文件與最新 CI 事實尚未完全一致。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - `scripts/verify-electron-renderer.mjs:211-212` 現為 `const rendererJobId = evaluateValue(uploadFlow)?.jobId` 並檢查空值；這與 helper 的單層／雙層 CDP normalization 一致，且不再直接依賴 `uploadFlow.result.result.value.jobId`。
  - renderer smoke 仍依序驗證 health／settings、synthetic upload→completed／cleaned SRT、trim assets、review AI／七 provider、glossary round-trip 與 folder flow；run `31461704805` 的成功步驟摘要與此流程相符。
  - `evaluateValue` 與 explicit missing-job error 讓 response shape／缺資料邊界可診斷；但本輪未取得 Actions 原始 log，無法獨立確認每一步實際 response、Setup／Portable 進程或 artifact digest。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - Windows workflow 已覆蓋 source regression、Setup／Portable packaged renderer、靜默安裝／解除安裝、7z archive test、SHA 產生與 artifact upload；歷次 PowerShell 編碼、EBUSY、設定事件 race、CDP shape 與 about:blank target 根因均有修正鏈。
  - `verify-electron-renderer.mjs` 對 modal 使用 3 秒輪詢／事件重送，對 Windows cache lock 使用有限 retry；超出上限會失敗，不會吞錯。
  - Base／Small evidence `docs/project-management/evidence/2026-08-11-whisper-base-small-download-acceptance.json` 僅證明 macOS arm64 固定檔案完整性：base `147951465` bytes／SHA `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe`，small `487601967` bytes／SHA `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b`；沒有 Windows 下載、中文長音訊品質、速度／記憶體、真實 provider 429／timeout／取消或人工翻譯證據。
  - Windows 10／11 乾淨實機、SmartScreen、捷徑、userData 權限、離線流程及 LM Studio（依需求暫緩）仍未覆蓋。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - 本輪差異集中在 helper 使用與缺失 job ID 的明確錯誤，範圍小且可維護；`npm run check`、治理文件檢查及所有列出的回歸測試通過。
  - commit `cb904a1` 同時提交 changelog 與 Base／Small evidence，來源可追溯；遠端 branch ref `origin/codex/release-v0.48.1` 與 HEAD 均為 cb904a1。
  - workflow 的 signed／unsigned 分支與 `SIGNING-STATUS-windows-x64.txt` 可產出簽章狀態，但本輪沒有 Actions log／Authenticode 證明實際採用哪一分支；`AUTH-2026-07-23-01` 的未簽章／未公證常設授權不涵蓋未實機、模型品質或真實端點風險。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-08-11 13:39（+08）受控權限下 `npm run check` 完整通過，包含 `docs:check`、語法檢查、Whisper／Breeze、模型下載取消、媒體／雙語／品質、AI／Ollama／provider、review UI 與核心回歸。
  - 工作紀錄的 Windows run `31461704805`（head cb904a1）記錄 source regression、Setup／Portable renderer、靜默安裝／解除安裝、archive／SHA、artifact upload success；其 URL 與 head 已列於本報告，但尚未由本輪獨立重播。
  - `npm run docs:check:final` 於本輪 exit 1，明確回報最新工作紀錄尚未「完成」及有條件通過條件未被需求方接受；這是治理結案阻擋，不是程式回歸失敗。
  - 未取得 CI artifact／SHA 清單下載、7z 反向核對、Windows 實機畫面／事件紀錄、模型品質或 provider live probe，故測試證據仍不足以授權正式發布。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 本地 HEAD／遠端 branch 均為 `cb904a1edf51d5243652a66389a1d1906dc9994f`；`git rev-parse refs/tags/v0.48.1^{}` 仍為舊提交 `5566243fbd2306c4d9033e4bc9d75fb5e30fa723`，tag 未指向本輪 commit。
  - 依工作紀錄，run `31461704805` 已成功完成 Windows CI 候選包流程；但本輪沒有可直接操作的 Windows executable、CI 原始 log、artifact、SHA 清單或真實音訊，不能 independently claim 安裝後 bytes、簽章、artifact 內容或 Windows 10／11 使用者流程。
  - round4 的 changelog 引用明確保留「有條件通過」與「需求方風險接受：否」；本輪新增的 run／helper／model evidence 尚未形成 round5 changelog 引用與 final gate 完成快照。
  - 尚無指向 cb904a1 的新 `v0.48.1` tag 或 GitHub 公開 Release；因此不能將 CI success 解讀為公開發布完成。

## 發現分級

### 阻擋

1. **外部驗收仍未完成。** run `31461704805` 僅補強 Windows CI 候選包流程；Windows 10／11 實機、安裝後使用者流程、Base／Small 中文品質／效能、真實 provider／音訊與需求方風險接受均無證據。
2. **CI／文件追溯尚未閉環。** 本輪指定 run `31461704805` 尚未寫入 changelog，CI 原始 log／artifact／SHA 未反向下載核驗，`docs:check:final` 仍紅燈。
3. **發布 ref 尚未對齊。** `v0.48.1` tag 仍指向 `5566243`，未建立指向 cb904a1 的不可變 tag／公開 Release。

### 重要

1. Base／Small JSON 是 macOS arm64 size／SHA 完整性證據，不是 Windows 下載或中文口說品質證據。
2. workflow 的 signed／unsigned 實際分支與 Authenticode 狀態尚未由本輪 CI 原始證據確認；未簽章常設授權不等於實機風險接受。
3. provider strict contract／live endpoint（含 Azure deployment、Groq／Gemini／OpenAI-compatible）與人工品質尚未完成；LM Studio 仍依需求略過。

### 建議

1. 將 run `31461704805`、head SHA、artifact 名稱／size、SHA、簽章狀態與下載後 `7z t`／hash 結果保存為可獨立重算 evidence，並在 changelog 引用本報告逐字結論。
2. 以乾淨 Windows 10／11 實機補 Setup／Portable、Base／Small 下載與中文長音訊、SmartScreen／捷徑／userData／離線／解除安裝證據。
3. 以可撤銷低額度 key 執行各真實 provider strict cue contract、timeout／429／取消與人工品質，再由需求方逐項接受剩餘風險後建立指向同一已驗證 commit 的 tag／Release。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：`cb904a1` 的 `evaluateValue` helper 修正、Base／Small macOS arm64 size／SHA evidence、`npm run check` 與工作紀錄所載 run `31461704805` 已補齊候選包／模型檔案證據；然而本輪未直接重播 Windows runner 或反向下載 artifact，run 尚未寫入 changelog，Windows 10／11 實機、Base／Small 中文品質、真實 provider／音訊、tag／公開 Release 與需求方風險接受仍缺失，`docs:check:final` 亦未通過。
- 剩餘風險：Windows signed／unsigned 與未簽章／未公證、NSIS／Portable／userData／SmartScreen、模型下載後品質／效能／記憶體、真實 provider contract／人工品質、CI artifact 追溯、tag／Release 與發布後下載核對。
- 給主要開發代理的具體修正要求（若有）：將本報告及完整結論句加入 REL-028 changelog，補保存 run `31461704805` 的原始 log／artifact／SHA 反向證據，完成 Windows 實機／模型品質／provider 驗收與需求方逐項風險接受；來源或封裝改變時重新建立受影響資產 checksum／metadata 並複審。
- 可逐字引用完整結論句：**REL-028 round5 獨立六面向複審結論為有條件通過：cb904a1 已以 evaluateValue helper 修正 packaged renderer 的單層／雙層 CDP upload job ID 取值，Base／Small 固定 revision size／SHA evidence 亦通過，本輪採用的 Windows run 31461704805（head cb904a1）記錄 source regression、Setup／Portable packaged renderer、靜默安裝／解除安裝、archive／SHA 與 artifact upload 成功且 round4 引用已保留；但本輪未直接下載 CI artifact／重播 Windows runner，Windows 10／11 實機、Base／Small 中文品質、真實 provider／音訊、tag／公開 Release 與需求方外部風險接受仍未完成，因此本輪只證明 Windows CI 候選包流程與模型檔案完整性補證，不構成跨平台外部驗收完成或 0.48.1 公開發布授權。**

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

本報告明確區分 cb904a1 helper／模型 evidence／本機回歸、工作紀錄所載的 run `31461704805`，以及尚未取得的 Windows 實機／CI artifact／provider／品質／發布後核對，不以 CI 綠燈冒充完整外部驗收。

若上述聲明不實，本報告無效。
