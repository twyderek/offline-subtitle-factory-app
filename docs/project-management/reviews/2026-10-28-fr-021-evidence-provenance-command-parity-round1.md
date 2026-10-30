# FR-021 provenance command parity：獨立六面向審查

- 審查日期：2026-10-28（Asia/Taipei）
- 審查角色：本輪獨立六面向審查代理
- 對應工作：`FR-021-REPLAY-20261028-EVIDENCE-PROVENANCE-COMMAND-PARITY`
- 審查範圍：`lib/runner-provenance.mjs` 的 `sanitizeRunnerCommand()`、live verifier、offline wrapper projection、deterministic regression、replay4 evidence，以及 00／06／07／08 的本輪紀錄。
- 唯讀限制：未執行 live runner、network、Ollama／Electron replay 或模型操作；未下載模型、未修改 OS 網路；僅執行 syntax、helper boundary、JSON／hash／scope 與 whitespace 的唯讀檢查。
- 審查前確認：指定報告路徑不存在；本報告是本輪唯一新增檔案。

## 1. 需求完整性

- 判定：部分通過
- 證據：

  - `lib/runner-provenance.mjs:12,50-55` 新增 basename-only `sanitizeRunnerCommand()`，允許 `離線字幕工廠` 等 Unicode primitive basename，拒絕空值、`.`／`..`、separator、ASCII control、DEL、超過 128 個 Unicode 字元與非 primitive 值；不保存原始 executable path。
  - `scripts/verify-electron-ollama-ui.mjs:12,224-225,283-300` 與 `scripts/verify-electron-ollama-ui-offline.mjs:10,326,381-400` 均 import 並使用同一 helper；live 與 offline 的 command projection 規則未再分叉。
  - `scripts/test-ollama-ui-offline.mjs:71-118` 直接固定 Unicode pass、ASCII pass、empty／dot／path／separator／control／oversize／non-primitive fail-closed，以及 wrapper projection 的 Unicode/path parity。
  - `2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay4.json` 實際保存 `runnerProvenance.command="離線字幕工廠"`，並保留 argv redaction、artifact identity、bounded child-output digest 與 cleanup 欄位。
  - 但 FR-021 全體仍未完成：replay4 的 `scope.systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`；本輪也沒有 Windows 或 Seatbelt packaged UI offline 證據。LM Studio 則依需求方既有政策例外不在本輪執行。

## 2. 邏輯正確性

- 判定：通過
- 證據：

  - live `summarizeLaunch()` 先以 `path.basename(command)` 取得 command identity（`scripts/verify-electron-ollama-ui.mjs:78-85`），再由 shared helper 做 basename boundary validation；因此 runner path 不會直接落入 `runnerProvenance.command`。
  - live evidence 在 spawn 前保存 command／argv projection，artifact hash 與 framework identity；child output 僅以 bounded buffer 產生 digest／bytes／固定 categories，`rawChildOutputPersisted=false`（`scripts/verify-electron-ollama-ui.mjs:283-300,898-912`）。
  - offline wrapper 對 source evidence 的 command 重新使用同一 helper，並對 argv 再套用既有 allowlist（`scripts/verify-electron-ollama-ui-offline.mjs:320-400`），沒有把 source 的 raw command path 原樣轉存。
  - VM regression 對 private path／secret-shaped input 的 JSON 輸出確認不包含 `/home/private` 或 `sk-live-secret`（`scripts/test-ollama-ui-offline.mjs:77-79,113-118`）；本代理的純 helper probe 與 replay4 jq assertion 亦通過。

## 3. 邊界情況

- 判定：部分通過
- 證據：

  - deterministic boundary 已覆蓋空字串、`.`、`..`、Unix absolute／relative path、Windows separator、newline、129 字元、boxed String，且所有案例均 fail-closed（`scripts/test-ollama-ui-offline.mjs:71-79`）。
  - regex 使用 Unicode mode 並限制長度與 `/`、`\\`、ASCII control／DEL；安全輸入 `離線字幕工廠` 可保留，符合本輪 localized executable identity 需求。
  - replay4 的 command、argv 與 provenance hash 都是安全投影；`argvRedactionValidated=true`、`argvDroppedCount=0`、`rawChildOutputPersisted=false`，且 cleanup 全通過。
  - 未覆蓋 Unicode normalization／format characters、Windows reserved-name semantics、其他平台的 path implementation 差異，以及完整 runner provenance schema 的所有欄位 parity。這些是後續邊界或更大 scope 風險，不否定本輪要求的 Unicode basename command parity。

## 4. 程式碼品質

- 判定：部分通過
- 證據：

  - command sanitizer 集中於 `lib/runner-provenance.mjs`，live 與 offline caller 只消費 shared contract；這比兩份 verifier 各自維護 ASCII regex 更可維護，也降低未來規則漂移。
  - helper fail-closed 且不嘗試從任意輸入抽取 basename，避免在保存邊界重新接觸 raw path；註解也明確說明 localized identity 與 path/control/bound 的目的。
  - 本輪只改 runner／evidence contract 與 tests，未改產品 runtime、provider、Ollama request、OS 網路或既有 evidence／review 原件。
  - 「live/offline parity」在本輪已達成 command projection parity；若將 parity 解讀為完整 `runnerProvenance` schema 同構，offline projection 仍未包含 live 的 `candidateReviewScriptSha256`（offline `:389-400` 對照 live `:291-295`）。因此不應把本輪描述擴大為完整 runner schema parity。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：

  - `scripts/test-ollama-ui-offline.mjs:71-118` 有直接 helper boundary、offline projection Unicode/path parity 與 secret/path exclusion；`runnerContext` 也注入 shared helper（`:131-165`），VM failure path 保留 cleanup／bounded output／raw-output exclusion assertions。
  - 本代理唯讀執行 `node --check`：`lib/runner-provenance.mjs`、live verifier、offline verifier、offline test 均 exit 0；純 helper boundary probe、replay4 jq schema/scope assertion 與 `git diff --check` 均 pass。
  - 主要代理紀錄的 focused tests、`node scripts/test-ai-providers.mjs` 與完整 `npm run check` 均為 exit 0；08 最新條目並記錄 final docs gate 已通過。這些既有結果本代理未以 live runner 或 network 重跑。
  - 缺口是 deterministic test 沒有直接執行 live verifier 的完整 command projection，也沒有涵蓋完整 runner schema parity；live 行為由既有 replay4 evidence 補足，且本輪明確不重播。

## 6. 實際運行結果

- 判定：部分通過
- 證據：

  - 既有 immutable replay4 `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay4.json` 為 `status=pass`，`runnerProvenance.command="離線字幕工廠"`，argv redaction validated、candidate executable／review.js／Framework hash、bounded child-output digest／bytes、6-batch cancel checkpoint、same-session resume、6 suggestions／accept／save 與 process／port／userData／daemon cleanup 均有保存。
  - replay4 的 candidate executable hash 為 `b3605c589459068f894a70896b8ed843be3832a839fcdd83aa898e9b16210de4`，Framework hash 為 `416b6c8cf74c59188266d3ff7a3fc77b9f68bb52f7328d98b382d132580c8cee`；provenance hash 與 artifact hash 一致，未覆寫 replay1／replay2／replay3。
  - 實際 scope 只到 normal loopback：`loopbackOnlyConfiguration=true`、`apiKeySupplied=false`、`isolatedAcceptanceDaemon=true`，但 `systemNetworkDisabled=false`、未套用 outer Seatbelt。這支持 command parity／normal packaged UI evidence，不支持 packaged UI offline 或全機 egress 結論。
  - 本代理未執行 live runner、network、replay，因此本節採既有 evidence 與治理紀錄作為實際運行結果，而非冒稱本代理重新驗收。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：本輪 scope 內未發現會造成 command path、secret 或 raw child output 落盤的阻擋問題。必須保留兩項明確條件：第一，本輪只完成 Unicode basename 的 live/offline command projection parity，沒有完成完整 runner provenance schema parity（offline 仍缺 review.js hash）；第二，既有 replay4 仍是 normal loopback，`systemNetworkDisabled=false`，不能據此宣稱 Seatbelt offline、全機斷網、Windows 或 FR-021 完整驗收。若需求方要求上述更大範圍，需另立工作並新增對應證據。
- 本輪條件是否已被需求方接受：是
- 可逐字引用的完整結論句：**本輪 provenance command parity 獨立六面向審查結論為有條件通過：`sanitizeRunnerCommand()` 已以 shared basename-only contract 讓 live／offline projection 安全保留 Unicode executable basename，path／separator／control／empty／oversize／non-primitive boundary、secret/path exclusion、syntax／helper regression、replay4 evidence 與 normal loopback scope 均核對通過；本輪只限 Unicode basename/live-offline provenance parity 與 normal loopback，未完成完整 runner provenance schema parity，且不得宣稱 Seatbelt offline、全機斷網、Windows 或 FR-021 完整驗收；`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false` 的限制必須持續揭露。**

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

本審查代理只讀取本輪變更與既有證據，未執行 live runner、network、Ollama／Electron replay，未修改任何既有檔案；唯一新增檔案為：

`/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/reviews/2026-10-28-fr-021-evidence-provenance-command-parity-round1.md`

若上述聲明不實，本報告無效。
