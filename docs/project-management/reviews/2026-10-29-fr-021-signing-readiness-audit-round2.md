# 獨立審查報告：FR-021 formal signing／hardened-runtime readiness audit

- 審查對象 commit／版本：工作樹 `c06d15e95a2f0a0981518c5873003a460e57a5ee`、branch `codex/0.51-anthropic-claude`、package version `0.52.0`；工作樹含既有未提交變更，本報告只審查本輪 signing-readiness 相關 source、evidence、文件與命令結果。
- 對應 08-CHANGE-LOG 條目：`2026-10-29 — formal signing／hardened-runtime readiness audit（FR-021-DEBUG-20261029-SIGNING-READINESS-AUDIT）`
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-10-29T09:56:49+08:00；本報告依目前工作樹、`npm run project:preflight -- --type=full` 列出的治理文件、round1 報告、source、audit3 與實際命令輸出獨立完成，未將主要代理的結論作為證據前提。
- 審查限制：只執行讀取、source／文件／測試驗證與既有 evidence parity check；未執行 signing、notarization、keychain 修改、packaged app、UI、Electron／Ollama／model 或 network acceptance。未重跑 readiness helper，避免依其 exclusive-create 行為新增第二份 evidence；本次唯一寫入為本報告。

## 審查基線與證據集合

- round1 報告與 F-01～F-05：`docs/project-management/reviews/2026-10-29-fr-021-signing-readiness-audit-round1.md:38-85`。
- 被審查 source：`scripts/audit-macos-signing-readiness.mjs:106-354`。
- dedicated focused regression：`scripts/test-macos-signing-readiness.mjs:1-61`。
- authoritative readiness evidence：`docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit3.json:1-179`；audit1／audit2 保留為 immutable 前置原件。
- 目前 source parity：read-only SHA check 顯示 audit3 的 `sourceScriptSha256`、`packageJsonSha256` 與目前檔案一致，`gitHead` 與目前 HEAD 一致；三者結果均為 `true`。

## 1. 需求完整性

- 判定：部分通過。
- bounded readiness 的需求界線仍正確：audit3 明確是 `blocked-external-signing-identity`，不是 FR-021 pass；`00-CURRENT-STATUS.md:3-7`、`03-FUNCTIONAL-DESIGN.md:3-7`、`05-DEVELOPMENT-AND-DEPLOYMENT.md:48-62`、`06-TEST-AND-PROCESS-AUDIT.md:3-8`、`07-DEBUG-AND-FIX-HISTORY.md:3-7` 與 `08-CHANGE-LOG.md:17-20` 均保留 0 valid identity、source config 未開啟 hardened runtime，以及不執行 packaged UI／AI／Ollama／model 的界線。
- F-01：已修正。identity command failure 與 malformed output 都使 `probeReady=false`，`classifyReadiness()` 返回 `identity-probe-unavailable`（`audit-macos-signing-readiness.mjs:106-130,183-197`）；focused regression 實際覆蓋 EACCES／空輸出與 misleading Developer ID text（`test-macos-signing-readiness.mjs:22-42`）。
- F-02：部分修正，仍有 Finding R2-F02（見第 2、3 節）。目前已加入 status／digest／bytes／signature summary／scopeSafe／寫檔前 privacy gate，但 existing evidence 的 scope 只檢查五個鍵，未形成完整敏感欄位 allowlist 與 unknown-key rejection。
- F-03：已修正。source 將 `toolchain.required` 與 `toolchain.optional` 分開，`toolchainReady` 只消費 required contract（`audit-macos-signing-readiness.mjs:286-297,325-326`）；audit3 同時保存 required／optional 結果（`audit3.json:38-72`）。
- F-04：已修正且可追溯。audit3 保存 git HEAD、source script SHA、package SHA、git command result／dirty state（`audit3.json:31-36`），並保存安全的 version result（`audit3.json:5-29`）；目前檔案 hash／HEAD parity check 全部相符。
- F-05：程式與測試部分已修正。dedicated failure-injection focused test 已存在並納入 `npm test`／`npm run check`（`package.json:31-32`）；但治理 closeout 尚未完成，故本 finding 的 final-gate 部分仍未解除。

## 2. 邏輯正確性

- 判定：部分通過。
- 正面結果：`validateReadinessEvidence()` 在寫檔前要求 schema／status、source provenance、identity probe、required／optional toolchain contract、existing evidence summary、credential boolean、全量 readiness scope false，並執行 serialized leakage guard（`audit-macos-signing-readiness.mjs:233-254`）；`main()` 在 `fs.writeFileSync(..., { flag: 'wx', mode: 0o600 })` 前呼叫該 gate（`:321-354`）。這足以支持目前 audit3 的去敏與 exclusive write claim。
- Finding R2-F02 [P1]：`safeExistingEvidenceScope()` 只驗證 `candidateModified`、`networkConnectionsAttempted`、`packagedAppExecuted`、`rawCommandOutputPersisted`、`absolutePathsPersisted` 五個欄位（`audit-macos-signing-readiness.mjs:141-144`）。它不驗證或拒絕 existing evidence scope 中的 `keychainModified`、`signingAttempted`、`notarizationAttempted`、`uiFlowRun`、`existingOllamaDaemonStartedOrStopped`、`modelDownloaded`、`identityNamesPersisted`、`identityHashesPersisted`、`secretsPersisted` 等敏感欄位，也不拒絕未知欄位。若既有 evidence 帶有未檢查的 `secretsPersisted: true` 或額外敏感欄位，projector 仍可能只保存 `scopeSafe: true`，新的 readiness evidence 的 serialized leakage gate 看不到被省略的原始 scope。
- `validateExistingEvidenceSummary()` 對目前保存的 filename regex、64-hex digest、bytes、`pass` status、signature summary 與 runtime flag 有明確 allowlist（`audit-macos-signing-readiness.mjs:146-155`），但 `requiredCodeSignFlagSatisfied` 在 `requiredCodeSignFlag === null` 時沒有獨立 primitive／null 型別斷言，且 filename 是格式限制而非明確的兩檔 allowlist。這不影響目前兩個 hard-coded input 的結果，但不足以稱為完整 existing-evidence allowlist/privacy contract。
- 目前 audit3 的實際兩份既有 evidence scope 都是安全值；因此 R2-F02 是可達的 source boundary gap，不是目前 audit3 已含 secret 或已遭污染的證據。

## 3. 邊界情況

- 判定：部分通過。
- 已實際覆蓋的邊界：identity command non-zero／error code、malformed identity output、required toolchain false、readiness scope tamper，以及 imported summary status 污染；focused test exit 0（`test-macos-signing-readiness.mjs:22-61`）。
- audit3 實際為 `identity.commandSucceeded=true`、`probeReady=true`、`validIdentityCount=0`、`formalIdentityAvailable=false`（`audit3.json:74-86`），所以 `blocked-external-signing-identity` 是可解釋的真實讀取結果，不是 command failure 被誤歸類成無 identity。
- 未覆蓋的關鍵邊界：existing evidence hidden／unknown scope key、hash mismatch、非 primitive `requiredCodeSignFlagSatisfied`、optional-tool failure 不阻擋 required decision、以及 provenance／version malformed input 的 focused mutation。這些不否定目前 audit3，但使 R2-F02 與 focused coverage 仍不完整。

## 4. 程式碼品質

- 判定：部分通過。
- 正面結果：command 使用固定 executable／argument，不使用 shell interpolation；raw stdout／stderr 只在記憶體中處理；evidence 使用 exclusive create 與 `0600` mode；parser、classifier、validator 已拆成可直接測試的 exported pure functions（`audit-macos-signing-readiness.mjs:42-64,106-130,183-254,354`）。
- F-03／F-04 的修正具可讀性：required／optional toolchain contract 與 source/package/git provenance 在 evidence schema 中可辨識；stderr-only／不可安全保存的 version 會以 `commandSucceeded`、`reportedOnStdout`、`value: null` 表達，而不落盤 raw output（`audit-macos-signing-readiness.mjs:96-104`；`audit3.json:20-29`）。
- R2-F02 使 privacy projector 的安全性仍依賴「只取目前五個 scope keys」而非完整 schema；這是 code quality／可維護性風險，因為未來新增 scope key 可能被靜默忽略。

## 5. 測試覆蓋

- 判定：部分通過。
- 實際執行結果：
  - `npm run check`：exit 0；包含 `docs:check`、readiness syntax、`npm test`、dedicated readiness focused test、AI／Ollama deterministic contracts、core 與 YouTube suites。
  - `node scripts/test-macos-signing-readiness.mjs`：exit 0，輸出 `macOS signing readiness focused contract passed: identity failure, malformed output, toolchain gate, provenance and privacy fail-closed cases`。
  - `node scripts/test-project-docs-validator.mjs`：exit 0。
  - `git diff --check`：exit 0。
  - `npm run docs:check:final`：exit 1，具體錯誤為最新工作紀錄缺少「獨立審查是否執行：」與「發布授權：」、狀態仍非「完成」，以及獨立審查欄位不是是／否。
- F-05 的 focused regression／full-check integration 已通過；但 focused test 沒有對 R2-F02 的 hidden scope、unknown key、hash／type mutation 建立 failure-injection，因此不能把「privacy」測試結果擴大為完整 existing evidence privacy contract。
- Finding R2-F05 [P1]：round1 所要求的治理 final gate 尚未修正。`08-CHANGE-LOG.md:3-20` 仍為 `狀態：進行中`，且沒有本輪獨立審查欄位與發布授權欄位；`npm run docs:check:final` 的 exit 1 是實際阻擋，不是推測。

## 6. 實際運行結果

- 判定：部分通過。
- audit3 是由修正後 source 產生的證據：其 `sourceScriptSha256`、`packageJsonSha256`、`gitHead` 與目前工作樹 parity check 相符；`provenanceReady=true`、`existingEvidenceReady=true`、`toolchainReady=true`，status 為 `blocked-external-signing-identity`（`audit3.json:31-36,135-142`）。
- audit3 的實際 readiness 結果為 macOS arm64；required `codesign`／`xcrun` 與 `xcrun --find codesign` 可用，identity probe 成功但 `validIdentityCount=0`，source `identityConfiguration=unset`、`hardenedRuntimeConfigured=false`、`gatekeeperAssessConfigured=false`（`audit3.json:5-7,38-93`）。兩份既有 evidence 的 digest、bytes、summary、scopeSafe 均保存於 `audit3.json:103-133`。
- 目前文件的事實內容一致：00／03／05／06／07／08 均保留 external Developer ID identity blocker、正式 signed／hardened package 尚未建立，以及 renderer／UI／AI／Ollama／FR-021 尚未完成；唯一尚未完成的是 08 的治理 closeout 欄位與 final gate。
- 依使用者限制，本輪沒有執行 signing、notarization、keychain、packaged app、UI、Ollama、model 或 network acceptance；因此 audit3 不構成正式 signed／hardened canary，也不構成 FR-021 runtime acceptance。

## 綜合判定

- 結論：有條件通過（conditional pass）。
- 阻擋問題：
  - R2-F02 [P1]：existing evidence scope/privacy gate 沒有對完整敏感 scope schema 與 unknown keys fail-closed；需要補齊完整 allowlist／型別／hash／privacy regression。
  - R2-F05 [P1]：`08-CHANGE-LOG.md` 尚未完成本輪 closeout，導致 `npm run docs:check:final` exit 1。
  - 外部 packaging blocker：readiness audit 的 read-only identity 結果為 0 valid identity；source 仍 `identity: null`、hardened runtime／Gatekeeper assess false，因此正式 signed／hardened canary 未建立。
- 可逐字引用的完整結論句：**本輪 FR-021 formal signing／hardened-runtime readiness audit round2 有條件通過：F-01 identity command failure／malformed output fail-closed、F-03 required／optional toolchain decision、F-04 source／package／git provenance 與 version result，以及 F-05 dedicated failure-injection focused test 納入 `npm run check` 均已由目前 source、audit3、focused test 與實際命令支持；但 F-02 existing evidence allowlist／hash／scope／privacy gate 仍未對完整敏感 scope 與 unknown fields fail-closed，且 `npm run docs:check:final` 仍因最新 08 條目缺少獨立審查／發布授權欄位並維持「進行中」而失敗，因此 external Developer ID identity blocker 仍在、正式 signed／hardened canary 未建立，renderer／UI／AI／Ollama／FR-021 未完成。**
- 給主要開發代理的具體修正要求：
  1. 對 existing evidence 建立明確 filename allowlist，驗證完整 scope schema 的所有敏感鍵為明確 `false`，拒絕未知鍵；補 `requiredCodeSignFlagSatisfied` null／boolean 型別、digest／bytes／污染與 secret/path mutation focused cases。
  2. 在 `08-CHANGE-LOG.md` 補「狀態：完成」、「獨立審查是否執行：是」、「發布授權：不適用」、round2 報告連結與本報告的逐字完整結論句，再重跑 `npm run docs:check:final`；不得因此把 readiness blocker 或 FR-021 宣稱為完成。
  3. 保留 audit1／audit2／audit3 原件、external Developer ID identity blocker、正式 signed／hardened canary 未建立與 renderer／UI／AI／Ollama／FR-021 未完成的界線；取得外部 identity／entitlement 後才另立隔離 packaging work item。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他 source、evidence、`08-CHANGE-LOG.md` 或既有文件。
- 未執行 signing、notarization、keychain 修改、packaged app／UI／Ollama／model／network acceptance。
- 若上述聲明不實，本報告無效。
