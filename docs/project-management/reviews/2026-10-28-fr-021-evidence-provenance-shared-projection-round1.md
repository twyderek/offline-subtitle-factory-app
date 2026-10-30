# 獨立審查報告：FR-021 shared runner provenance projection contract

- 審查對象 commit／版本：目前工作樹、專案版本 `0.52.0`、分支 `codex/0.51-anthropic-claude`；本輪沒有指定 commit，且工作樹原有變更均予保留。
- 對應 08-CHANGE-LOG 條目：2026-10-28 — shared runner provenance projection contract（`FR-021-REPLAY-20261028-EVIDENCE-PROVENANCE-SHARED-PROJECTION`）。
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-28T12:32:50+08:00（Asia/Taipei）；依 governance preflight 所列固定核心／任務路由與需求指定檔案重新建立本輪只讀審查上下文，逐項核對目前工作樹、source、tests、治理條目與既有 replay4 evidence，未以開發代理的評價性摘要替代證據。
- 審查限制：本輪禁止 live runner、network、Ollama／Electron replay 與模型操作；既有 replay4 僅讀取 JSON，不重播、不覆寫。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:3-21` 已把本輪目標、成功條件與不在範圍事項寫清楚：live／offline 必須共用 `projectRunnerProvenance()`、key set 與 sanitizer 同構，並補 hash boundary／secret-path exclusion；同時明確排除 Seatbelt、全機 egress、Windows、LM Studio、發布與 FR-021 完整驗收。
  - `docs/project-management/00-CURRENT-STATUS.md:3-7`、`06-TEST-AND-PROCESS-AUDIT.md:3-7`、`07-DEBUG-AND-FIX-HISTORY.md:3-8` 均同步記錄 shared projection contract、既有 replay4 只讀對照及 normal-loopback 限制，文件間的範圍敘述一致。
  - `docs/project-management/03-FUNCTIONAL-DESIGN.md:131-133` 定義 live v4／offline v5 的 runner-level provenance 邊界：保存去敏 command／argv、candidate identity、bounded child-output digest／bytes／categories，不能把它誤稱為 exact Chromium profile、build provenance 或 UI acceptance；本輪 shared helper 的方向與此設計一致。
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37,48-54` 顯示 FR-021 原始需求仍包含本機 LLM 端到端／斷網條件，LM Studio 只因需求方例外不執行；shared evidence contract 本身不可能替代這些 acceptance。故本面向不能判定為 FR-021 完整通過。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - `lib/runner-provenance.mjs:69-107` 的 `projectRunnerProvenance()` 統一產生 17 個固定欄位，對 command、SHA-256、framework path、diagnostic categories、raw-output flag 進行投影；`sanitizeRunnerCommand()`／`sanitizeRunnerSha256()`／`sanitizeDiagnosticCategories()` 的結果均為 bounded 或 fail-closed 值。
  - live wiring 位於 `scripts/verify-electron-ollama-ui.mjs:12,224-298`：先以 `sanitizeRunnerArgv(launchSummary.argv)`，再呼叫 shared helper；`finally` 於 `:902-908` 只更新 bounded child-output digest／bytes／categories，沒有把 raw child output 回填 evidence。
  - offline wiring 位於 `scripts/verify-electron-ollama-ui-offline.mjs:10,320-398`：先以同一 `sanitizeRunnerArgv(source?.launch?.argv)`，再以相同 helper 投影 artifact／diagnostic／sandbox 欄位。兩邊的 helper input mapping 與輸出 key set 對齊。
  - `scripts/test-ollama-ui-offline.mjs:112-140` 實際比較 projected offline key set 與 `projectRunnerProvenance({ argv: [] })` key set，並固定有效／缺失／boxed／path review.js hash 的結果；`npm run docs:check`、四個指定檔案 `node --check` 與 `git diff --check` 於 2026-10-28T12:32:50+08:00 前後均 exit 0。
  - 重要 residual：`projectRunnerProvenance()` 在 `lib/runner-provenance.mjs:86-93` 只要收到任何 object 型 `argvProjection` 就直接採用，沒有再次呼叫 `sanitizeRunnerArgv()` 或驗證其 `argv`／counts。只讀 static probe 的輸出為 `sharedKeyCount=17`、`unsafeProjectionPreservesPath=true`、`unsafeProjectionPreservesSecret=true`；因此「helper 自身提供完整安全 projection」尚未成立。當前 live／offline 兩個已知 caller 先 sanitize，故 replay4 的實際 evidence 沒有因此洩漏，但 shared API 的 fail-closed contract 仍有條件。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - `scripts/test-ollama-ui-offline.mjs:33-71` 覆蓋合法 allowlisted argv、private path、secret-shaped token、missing argv、33 項 truncation；` :73-81` 覆蓋 Unicode command、ASCII command、空值、`.`／`..`、絕對／相對 path、separator、control character、129 字元與 boxed command。
  - `scripts/test-ollama-ui-offline.mjs:132-140` 覆蓋 review.js hash 的非法 path、boxed 64-hex hash 與 missing hash fail-closed；` :250-307` 以 source contract assertions 固定 Seatbelt／raw output／shared helper／bounded child-output 等規則存在。
  - `lib/runner-provenance.mjs:59-67,96-106` 對 SHA、固定 Framework path、diagnostic category 與 raw-output flag 有明確型別／格式投影；目前測試與 source-level assertions 能證明指定的 missing／non-primitive hash、secret/path exclusion 與 key-set parity 子範圍。
  - 未覆蓋的關鍵 boundary 是上一節 static probe 顯示的 caller-supplied `argvProjection` bypass；另未見直接測試固定 negative／超大 `childOutputBytes` 或 `captureLimitBytes` 的 helper-level boundedness。這些不使既有 replay4 的已保存欄位失效，但阻止把 shared helper 宣稱為所有輸入路徑均 fail-closed。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - provenance 規則集中於 `lib/runner-provenance.mjs`，live／offline 只負責收集各自來源資料並呼叫同一 projection；相較兩處手寫 object，這降低未來欄位漂移與 sanitizer 分叉風險。
  - `scripts/verify-electron-ollama-ui.mjs:283-298` 與 `scripts/verify-electron-ollama-ui-offline.mjs:381-396` 的參數命名對應清楚，固定 Framework path、child-output cap 與 raw flag 的責任可追溯；`projectRunnerProvenance()` 亦沒有保存 raw output 或使用者路徑。
  - 但 `argvProjection` 同時允許 caller 傳入已組好的 object，卻沒有把它視為不可信資料重新驗證；這個 API 形狀讓「shared helper 是安全保存邊界」的責任不夠單一。具體修正方向是讓 helper 只接收原始 argv 並自行 sanitize，或對 supplied projection 的每一欄重新以同一 allowlist／bounds 驗證，再補 regression。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 本輪實際執行且未涉及 live／Ollama／Electron／模型的指令：
    - `npm run project:preflight -- --type=governance`：exit 0。
    - `node --check lib/runner-provenance.mjs`、`node --check scripts/verify-electron-ollama-ui.mjs`、`node --check scripts/verify-electron-ollama-ui-offline.mjs`、`node --check scripts/test-ollama-ui-offline.mjs`：全部 exit 0。
    - `node scripts/test-project-docs-validator.mjs`：exit 0，治理 validator 測試通過。
    - `npm run docs:check`：exit 0，19 個治理文件通過。
    - `git diff --check`：exit 0。
    - `node --input-type=module -e ...` shared helper static probe：exit 0，確認 sanitized caller projection 可通過，也確認未驗證 supplied projection 仍可保留 path／secret（僅輸出布林結果，未輸出秘密值）。
  - 本輪沒有執行 `node scripts/test-ollama-ui-offline.mjs`、`npm run check` 或任何 acceptance replay，因使用者明確禁止 Ollama／Electron replay、模型操作與 live runner；`08-CHANGE-LOG.md:19` 與 `06-TEST-AND-PROCESS-AUDIT.md:6` 所記的既有完整 `npm run check` pass 可作為開發端紀錄，但不是本輪審查重新執行的結果。
  - `scripts/test-ollama-ui-offline.mjs:125` 的 key-set assertion、` :137-140` 的 hash boundary assertion 與 ` :294-307` 的 source contract assertions 支持本輪主要測試目標；然而沒有直接 regression 固定 `projectRunnerProvenance({ argvProjection: <不可信 object> })` 必須再次 fail-closed，因此 coverage 仍不足以無條件通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 既有 replay4 evidence `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay4.json` 經 `jq` 只讀核對：`schema=offline-subtitle-factory.ollama-ui-live-acceptance.v4`、`status=pass`、`scenario=cancel-resume`、`model=llama3.2:1b`；`runnerProvenance.command="離線字幕工廠"`、argv redaction validated、argv dropped count 0、candidate executable／review.js／Framework SHA-256 與 artifact 相等、child output 5717 bytes 在 16000 cap 內、`rawChildOutputPersisted=false`。
  - 同一 evidence 的 UI／cleanup 欄位顯示 6 cues／6 batches 完成、checkpoint 1/6 cancel、同 session resume、6 suggestions／accept／save、timecodes unchanged、English translation，以及 Electron／daemon／port／userData cleanup 全部通過；這支持既有 normal packaged UI replay 的 provenance 與 flow 結果。
  - replay4 的 scope 同時明確是 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`、loopback-only、無 API key；因此它是 normal loopback 的既有實測證據，不能當成 Seatbelt offline 或全機斷網證據。本輪未重播，故不把它冒充為本輪新 runtime 結果。
  - `npm run docs:check:final` 於本輪 exit 1，實際原因為最新 08 條目仍為「進行中」且缺少「獨立審查是否執行：」「發布授權：」欄位；這是治理 closeout 尚未完成的直接證據，不是 live runtime failure。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：
  1. shared helper 的 `argvProjection` 入口可繞過 argv allowlist；在目前 live／offline caller 先 sanitize 的前提下未污染 replay4，但若要把本輪 contract 宣稱為 helper-level 完整安全邊界，須先修正 helper 或移除 bypass，並新增 regression。
  2. 最新 `08-CHANGE-LOG.md:3-21` 尚未補本報告引用、`獨立審查是否執行：`、`發布授權：` 與完成狀態；本輪 `npm run docs:check:final` exit 1，因此治理上尚未 closeout。
- 本輪條件是否已被需求方接受：是
- 剩餘風險：本輪只限 shared runner provenance projection/schema parity；既有 replay4 是 normal loopback，`systemNetworkDisabled=false`，未取得 Seatbelt packaged UI offline、真正全機 egress、Windows 或其他模型／版本的等價證據。LM Studio 依需求方既有政策／例外不在本輪執行。完整 FR-021 的本機 LLM 端到端、真正斷網與其餘需求仍未完成。
- 給主要開發代理的具體修正要求：
  1. 使 `projectRunnerProvenance()` 對 `argvProjection` 不能被 caller bypass；至少重新驗證 `argv`、counts、長度與 allowlist，並補 path／secret／malformed projection regression。
  2. 修正完成後重跑受影響的 focused test 與完整非 live checks；若 helper contract 受影響，再由同一審查角色建立 round2，不覆寫本報告。
  3. 只在補齊 08 審查／發布欄位、標示完成並重新執行 final gate 後，才可結案本輪治理條目；不得把 closeout 擴大為 FR-021 完整驗收。
- 可逐字引用的完整結論句：**本輪 FR-021 shared runner provenance projection contract 獨立六面向審查結論為有條件通過：live 與 offline verifier 已由同一 `projectRunnerProvenance()` 產生相同 key set，hash／command／argv／diagnostic boundary、source wiring、deterministic assertions 與既有 replay4 的 normal-loopback evidence 均支持 shared projection/schema parity；但直接傳入的 `argvProjection` 目前可繞過 shared helper 的 argv 再驗證，且最新 08 尚未填入獨立審查／發布授權欄位、狀態仍為「進行中」，`npm run docs:check:final` exit 1，因此本輪不得無條件 closeout；本輪只限 shared runner provenance projection/schema parity，不能宣稱 Seatbelt offline、全機斷網、Windows 或 FR-021 完整驗收。**

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
