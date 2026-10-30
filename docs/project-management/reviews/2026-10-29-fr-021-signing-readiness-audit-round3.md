# 獨立審查報告：FR-021 formal signing／hardened-runtime readiness audit

- 審查對象 commit／版本：工作樹 `c06d15e95a2f0a0981518c5873003a460e57a5ee`、branch `codex/0.51-anthropic-claude`、package version `0.52.0`；工作樹含既有未提交變更，本報告只審查本輪 signing-readiness 相關 source、evidence、文件與命令結果。
- 對應 08-CHANGE-LOG 條目：`2026-10-29 — formal signing／hardened-runtime readiness audit（FR-021-DEBUG-20261029-SIGNING-READINESS-AUDIT）`
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-10-29T09:59:57+08:00 起；本報告依目前工作樹、`npm run project:preflight -- --type=full` 列出的治理文件、round1／round2 報告、readiness source、audit4 與本輪實際命令輸出獨立完成，未將主要代理的結論作為證據前提。
- 審查限制：只執行讀取、source／文件／測試驗證與不寫檔的 failure-injection；唯一寫入為本報告。未執行 signing、notarization、keychain 修改、packaged app、UI、Ollama、model 或 network acceptance。

## 審查基線與證據集合

- round2 findings 與修正目標：`docs/project-management/reviews/2026-10-29-fr-021-signing-readiness-audit-round2.md:69-80`。
- 被審查 source：`scripts/audit-macos-signing-readiness.mjs:47-50,151-174,254-375`。
- dedicated focused regression：`scripts/test-macos-signing-readiness.mjs:1-69`；其已納入 `package.json:31-32` 的 `npm test`／`npm run check`。
- authoritative readiness evidence：`docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit4.json:1-181`；audit1／audit2／audit3 原件均保留，未覆寫。
- round3 直接 failure-injection：以 `validateReadinessEvidence()` 對 audit4 複製資料測試空集合、單筆、重複、錯誤 filename、digest、bytes、status 與 `requiredCodeSignFlagSatisfied` 型別；另測試 top-level unknown／sensitive scope key。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - R2-F02 要求的固定兩個 filename、existing evidence scope key set、全量 `false`、summary digest／bytes／status／signature 欄位，已在 `scripts/audit-macos-signing-readiness.mjs:37-50,155-174` 形成 source gate；audit4 的兩筆實際摘要與 8 個 scope key 可回溯至 `docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit4.json:103-153`。
  - audit4 已綁定 source／package／git provenance，並記錄 `validIdentityCount=0`、`formalIdentityAvailable=false` 與 source config 未啟用 identity／hardened runtime（`audit4.json:31-36,74-93`）；目前文件也保留 external Developer ID blocker、正式 signed／hardened canary 未建立與 FR-021 未完成（`00-CURRENT-STATUS.md:5-8`、`08-CHANGE-LOG.md:17-26`）。
  - 但 round3 的不寫檔 mutation 在 2026-10-29T02:02:12Z 顯示 `empty: ACCEPTED`、`one: ACCEPTED`、`duplicate: ACCEPTED`；因此 source 尚未真正要求兩個固定 filename 各出現一次，不能確認 R2-F02 已完整封鎖。
  - `npm run docs:check:final` 在本輪輸出 exit 1，指出 round2 報告缺少六節具體證據、阻擋問題欄位與完整聲明，且 conditional-pass 條件未被最新 08 條目記錄為需求方已接受；治理 closeout 尚未完成。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - 正向 gate 可確認：`allowedExistingEvidenceFiles` 是兩個固定 filename（`audit-macos-signing-readiness.mjs:47-50`）；`safeExistingEvidenceScope()` 以排序後的完整 8-key set 並要求每個值為 `false`（`:155-160`）；`validateExistingEvidenceSummary()` 驗證 64-hex digest、正整數 bytes、`pass` status、summary flags 與 null／boolean runtime contract（`:163-174`）。
  - 但 `validateReadinessEvidence()` 僅使用 `Array.isArray(evidence.existingEvidence) && evidence.existingEvidence.every(...)`（`:267-270`），沒有 `length === 2`、set equality 或 duplicate rejection。round3 command 在 2026-10-29T02:02:12Z 實測 `empty`、`one`、`duplicate` 均為 `ACCEPTED`；這直接違反「只接受兩個固定 filename」的 fail-closed 語意。
  - 另外 `safeBooleanScope()` 只要求既有 required keys 全為 `false`（`audit-macos-signing-readiness.mjs:151-153`），沒有拒絕未知 top-level key；2026-10-29T02:02:16Z 的不寫檔 mutation 實測 `topLevelUnknownFalse: ACCEPTED` 與 `topLevelSensitiveTrue: ACCEPTED`。audit4 當前 scope 本身仍是完整 14-key 且全 `false`（`audit4.json:164-178`），但 validator 邊界尚未 fail-closed。
  - 因此本輪可確認 round2 的 existing raw-scope projector 已修正 unknown／敏感 key，但 persisted readiness evidence 的 cardinality 與 top-level scope schema 仍留下可達邏輯缺口。

## 3. 邊界情況

- 判定：不通過
- 證據：
  - focused test 已實際覆蓋 identity command failure、malformed output、required toolchain false、scope true、status pollution、unknown existing scope key 與 string type mutation（`scripts/test-macos-signing-readiness.mjs:22-69`）；`node scripts/test-macos-signing-readiness.mjs` 於 2026-10-29T01:59:57Z 輸出 `macOS signing readiness focused contract passed`。
  - round3 additional mutation 於 2026-10-29T02:02:12Z 顯示 `badFilename`、`badDigest`、`badBytes`、`badStatus`、`badType` 均 `REJECTED`，證明各 summary primitive gate 有效；但同一指令顯示空／單／重複 existing evidence 被接受。
  - round3 additional scope mutation 於 2026-10-29T02:02:16Z 顯示 unknown／sensitive top-level key 被接受；這是目前 audit4 實值未觸發、但可由 validator 輸入直接到達的 privacy boundary。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - 正面結構清楚：filename、scope、summary、readiness classifier 與寫檔前 validator 分層，且 `main()` 在 `fs.writeFileSync(..., { flag: 'wx', mode: 0o600 })` 前呼叫 `validateReadinessEvidence()`（`scripts/audit-macos-signing-readiness.mjs:254-275,351-375`）；固定常數與 pure-function 邊界便於測試。
  - source／package／git provenance 綁定可追溯：audit4 `sourceRevision` 的 `gitHead`、source script SHA、package SHA 與 dirty state 位於 `audit4.json:31-36`；不寫檔 parity command 顯示三組 audit／current 值一致。
  - 可維護性缺口是 schema invariant 分散且不完整：`allowedExistingEvidenceFiles` 沒有被轉成 exact cardinality／unique-set assertion，`safeBooleanScope()` 也沒有以 exact key comparison 拒絕 unknown key；round3 mutation output 證明這不是純風格問題而是可觀察行為。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-10-29T10:01:05+08:00 執行完整 `npm run check`，pipeline status 為 `npm run check exit=0`；輸出包含 `macOS signing readiness focused contract passed`、核心回歸通過與 YouTube posttest 通過。`package.json:31-32` 也確認 focused test 與 audit syntax 已納入 check。
  - 同一輪執行 `node scripts/test-project-docs-validator.mjs`，輸出 `治理文件驗證器測試通過`，以及 `git diff --check exit=0`；audit4 invariant command 輸出 `status: PASS`、source／package／git parity 全一致、兩筆 evidence digest／bytes／scope summary 均通過。
  - 但 `scripts/test-macos-signing-readiness.mjs:53-69` 沒有對 existing evidence 缺筆、重複筆、錯誤 filename、digest／bytes mutation，亦沒有對 top-level unknown／sensitive scope key 建立 failure injection；round3 的直接 mutation 因而發現 source gap，不能把 focused test 的 green 擴大為完整 schema coverage。
  - 2026-10-29T10:01:05+08:00 執行 `npm run docs:check:final` 的結果為 `exit=1`；其失敗原因是既有 round2 報告格式／條件接受 closeout，不是 `npm run check` 的程式回歸失敗。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - audit4 實際 read-only 結果為 `status=blocked-external-signing-identity`、`toolchainReady=true`、`existingEvidenceReady=true`、`provenanceReady=true`、`formalSigningReady=false`（`docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit4.json:155-162`）。
  - identity probe 實際成功且 `validIdentityCount=0`、`formalIdentityAvailable=false`（`audit4.json:74-86`）；source config 實際為 `identityConfiguration=unset`、`hardenedRuntimeConfigured=false`、`gatekeeperAssessConfigured=false`（`audit4.json:88-93`）。
  - audit4 scope/privacy 實際全為 `false`，且 interpretation 明確禁止 keychain、signing、notarization、sandbox relaxation、network policy change 與 release publication（`audit4.json:164-181`）；本輪只執行 preflight、讀取、focused／full checks、validator、diff check 與不寫檔 mutation，未執行使用者明確排除的 acceptance。
  - 因本機沒有 Developer ID identity，正式 signed／hardened canary 未建立；現有 evidence 只能支持 bounded readiness blocker，不支持 packaged app、renderer／UI／AI／Ollama／model 或 FR-021 pass。此界線與 `05-DEVELOPMENT-AND-DEPLOYMENT.md:48-62`、`00-CURRENT-STATUS.md:5-8` 一致。

## 綜合判定

- 結論：不通過（就本輪 formal signing／hardened-runtime readiness closeout 而言；目前資料只支持 bounded readiness audit，不是 FR-021 pass）
- 可逐字引用的完整結論句：**本輪 FR-021 formal signing／hardened-runtime readiness audit round3 不通過：R2-F02 的 existing evidence filename／scope allowlist、summary digest／bytes／status、requiredCodeSignFlagSatisfied 型別與 audit4 實際 provenance／identity blocker 證據均已改善，但 validator 仍接受 existingEvidence 空集合、單筆或重複筆，且 top-level scope 仍接受 unknown／sensitive key；focused test 未覆蓋這些邊界，npm run docs:check:final 仍 exit 1；因此本輪只支持 bounded readiness evidence，不能結案 formal signing／hardened readiness，也不是正式 signed／hardened canary 或 FR-021 pass。**
- 阻擋問題（若有）：
  - R3-F01 [P1]：`validateReadinessEvidence()` 必須要求 `existingEvidence` 恰為兩筆、filename set 恰為兩個固定檔名且不得重複；補上 empty／one／duplicate／wrong-set failure injection。
  - R3-F02 [P1]：`safeBooleanScope()` 必須拒絕所有 unknown／sensitive top-level scope key，並補上 `true` 與 unknown-key failure injection；目前 audit4 實值雖安全，validator 仍可接受污染輸入。
  - R3-F03 [P1]：`npm run docs:check:final` 仍 exit 1；主要代理須修正 round2 報告為完整 workflow 格式、在 08 正確連結最新 round3／結論並記錄條件接受，再重新執行 final gate。審查代理依本輪限制不得修改 round2 報告或 08。
  - 外部條件仍為 0 valid Developer ID identity；此不是本輪 source failure，但在取得外部 identity／entitlement 前，正式 signed／hardened canary 與 FR-021 仍不能完成。
- 剩餘風險：即使 R3-F01～R3-F03 修正，audit4 仍只證明去敏 read-only readiness 與 external identity blocker；未證明正式 signed／hardened packaged renderer、UI／AI／Ollama／model、全機 network deny、Windows 或 FR-021 完整驗收。`systemNetworkDisabled=false` 的既有界線仍需保留。
- 給主要開發代理的具體修正要求（若有）：
  1. 在 `validateReadinessEvidence()` 建立 exact two-entry／unique fixed-set assertion，並把 empty／one／duplicate／wrong filename／digest／bytes／status／flag type mutation 全部納入 `scripts/test-macos-signing-readiness.mjs`。
  2. 將 top-level scope 改為 exact `requiredScopeKeys` key comparison 並拒絕 unknown／sensitive keys；新增 unknown false 與 sensitive true failure-injection。
  3. 以目前 round3 報告的六面向格式與完整聲明重整治理 closeout；不得覆寫 round1／round2 原件，不得把 bounded readiness 或 external blocker 改寫成 formal signed／hardened canary 或 FR-021 pass。
- 本輪條件是否已被需求方接受：需求方已接受本輪只讀 bounded-readiness 審查範圍與不執行 signing／notarization／keychain／packaged app／UI／Ollama／model／network acceptance；未能視為接受 R3-F01～R3-F03 未修正或接受本輪 closeout。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪未執行 signing、notarization、keychain 修改、packaged app／UI／Ollama／model／network acceptance；未寫入或覆寫任何 evidence、source、package config、08-CHANGE-LOG 或既有 review。
- 若上述聲明不實，本報告無效。
