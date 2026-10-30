# 獨立審查報告：FR-021 formal signing／hardened-runtime readiness audit

- 審查對象 commit／版本：工作樹 `c06d15e95a2f0a0981518c5873003a460e57a5ee`、branch `codex/0.51-anthropic-claude`、package version `0.52.0`；工作樹含既有未提交變更，本報告只審查目前 signing-readiness source、focused test、audit5 與治理狀態。
- 對應 08-CHANGE-LOG 條目：`2026-10-29 — formal signing／hardened-runtime readiness audit（FR-021-DEBUG-20261029-SIGNING-READINESS-AUDIT）`
- 審查輪次：round4
- 審查代理啟動時間、上下文來源：2026-10-29T10:05:11+08:00 起；本報告依 `npm run project:preflight -- --type=full` 列出的治理文件、目前 source、focused test、audit5、最新 08 與本輪實際命令輸出獨立完成，未將主要代理的評價性摘要作為判定前提。
- 審查限制：僅執行讀取、source／evidence／文件檢查、記憶體內 failure-injection 與指定驗證命令；未執行 signing、notarization、keychain 修改、packaged app、UI、Ollama、model 或 network acceptance。round2／round3 原件未修改。

## 審查基線與證據集合

- R3-F01／R3-F02 本輪核對 source：`scripts/audit-macos-signing-readiness.mjs:47-50,151-186,266-285`。
- 本輪 focused regression：`scripts/test-macos-signing-readiness.mjs:66-81`；目前 `package.json:31-32` 將其納入 `npm test`／`npm run check`。
- 目前 authoritative readiness evidence：`docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit5.json:31-181`；audit5 的 source／package／git hash 與目前 `sha256sum`／`git rev-parse HEAD` 輸出一致。
- 本輪命令時間：2026-10-29T10:05:11+08:00 執行 syntax、focused、治理 validator、`git diff --check` 與 audit5 記憶體內 contract；2026-10-29T10:05:14+08:00 執行 `npm run check`；2026-10-29T10:05:36+08:00 執行 `npm run docs:check:final`。

## 1. 需求完整性

- 判定：部分通過
- 證據：`scripts/audit-macos-signing-readiness.mjs:181-186` 現在要求 existing evidence 恰為固定 allowlist 大小、兩個 filename set 完整且無重複；`:151-156` 對 top-level readiness scope 使用 exact required key set，且 `scripts/test-macos-signing-readiness.mjs:66-81` 已覆蓋 empty／one／duplicate、unknown／sensitive scope 與 wrong type；但 `08-CHANGE-LOG.md:3-27` 仍為「進行中」且尚未只引用本 round4 報告，故 formal closeout 需求尚未完整滿足。

## 2. 邏輯正確性

- 判定：通過
- 證據：`node --input-type=module` 記憶體內以 audit5 呼叫 `validateReadinessEvidence()`；empty、one、duplicate set 均輸出 rejected，top-level `unknownFutureKey=false`／`secretsPersisted=true` 均拋出 `SCOPE_PRIVACY_INVALID`，`requiredCodeSignFlagSatisfied='true'` 拋出 `EXISTING_EVIDENCE_INVALID`，與 source 的 exact-set／false-only gate 一致。

## 3. 邊界情況

- 判定：通過
- 證據：2026-10-29T10:05:11+08:00 的 `node scripts/test-macos-signing-readiness.mjs` 輸出 `macOS signing readiness focused contract passed`；同時本輪獨立以 audit5 做 empty／one／duplicate、unknown／sensitive top-level scope 與 wrong-type failure-injection，輸出 `audit5 in-memory contract: pass; empty/one/duplicate/unknown/sensitive/type cases rejected`。

## 4. 程式碼品質

- 判定：部分通過
- 證據：`audit-macos-signing-readiness.mjs:151-186,266-287` 將 required scope、existing scope、fixed filename、summary 型別與寫檔前 validator 分層，且 `node --check scripts/audit-macos-signing-readiness.mjs` 通過；但 `scripts/test-macos-signing-readiness.mjs:13` 仍讀取 audit4，而目前 authoritative artifact 是 audit5，兩者 source script digest 不同（audit4=`042d8f…`、audit5／目前 source=`076fe0…`），建議後續將 focused fixture 綁定 audit5 或明確改成純 schema fixture。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-10-29T10:05:14+08:00 的 `npm run check` exit 0，包含 `macOS signing readiness focused contract passed`；2026-10-29T10:05:11+08:00 的 `node scripts/test-project-docs-validator.mjs` 輸出 `治理文件驗證器測試通過`，同時 `git diff --check` exit 0；本輪額外 audit5 failure-injection 亦通過，但 repository focused test 尚未直接載入 audit5。

## 6. 實際運行結果

- 判定：部分通過
- 證據：`audit5.json:31-36` 的 source／package／git provenance 為目前 hash、`gitCommandSucceeded=true`、`workingTreeDirty=true`；`:74-93` 顯示 identity probe 成功但 `validIdentityCount=0`、`formalIdentityAvailable=false`、source `identityConfiguration=unset`／hardened／Gatekeeper false；`:155-181` 顯示 `blocked-external-signing-identity`、`sourceConfigReady=false`、完整 scope/privacy false。2026-10-29T10:07:24+08:00 的 `npm run docs:check:final` exit 1，原因是最新 08 未標示完成且缺少可解析審查檔案／逐字引用。未執行使用者排除的 signing、notarization、keychain、packaged app、UI、Ollama、model 或 network acceptance。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 FR-021 formal signing／hardened-runtime readiness audit round4 有條件通過（bounded readiness closeout）：R3-F01／R3-F02 已由目前 source 與 focused boundary tests 修正，audit5 的 source／package／git provenance、0 valid identity、source config、scope／privacy 與指定 checks 均通過；目前 08 尚未整合本 round4 報告，故 pre-integration `npm run docs:check:final` exit 1，主要代理須完成唯一 round4 引用、狀態與 final gate；本輪仍不宣稱正式 signed／hardened canary、renderer／UI／AI／Ollama 或 FR-021 完成。**
- 阻擋問題（若有）：
  - R4-F01 [P1] 治理 closeout 尚未整合：`08-CHANGE-LOG.md:3-27` 仍是「進行中」，目前只保留 round2 逐字引用並將 round4 標為待完成；主要代理須只連結並逐字引用本 round4 報告、記錄本輪條件已被需求方接受、更新為完成後重跑 `npm run docs:check:final`，不得修改 round2／round3 原件。這是本輪有條件通過的必要 closeout 條件。
  - External blocker：本機 `validIdentityCount=0`、無 Developer ID identity，source 未配置 identity／hardened runtime／Gatekeeper；正式 signed／hardened canary 尚未建立，這是 FR-021 後續實作的外部 prerequisite，不得以本輪 bounded readiness evidence 解除。
- 剩餘風險：本輪只證明目前 source 的 read-only signing-readiness contract 與 audit5 去敏 evidence；focused test 的固定輸入仍是 audit4，雖已由本輪獨立以 audit5 重驗，後續仍應對齊 authoritative fixture。另不證明正式 signed／hardened packaged renderer、renderer／UI／AI／Ollama／model、真正 per-app／全機 network deny、Windows 或 FR-021 完整驗收；既有診斷的 `systemNetworkDisabled=false` 界線仍須保留。
- 給主要開發代理的具體修正要求（若有）：
  1. 僅在 08 新增本 round4 報告連結與其完整結論逐字引用，將條目完成狀態與條件接受補齊，再重跑 `npm run docs:check:final`；保留 round2／round3 原件。
  2. 將 focused readiness test 的 fixture 從 audit4 對齊 audit5，或在測試中明確說明為 schema fixture 並另保留 audit5 provenance assertion；此為測試新鮮度改善，不得改寫 audit5 或既有原件。
  3. 保留 external Developer ID blocker、正式 signed／hardened canary 未建立及 renderer／UI／AI／Ollama／FR-021 未完成，不執行本輪明確排除的 acceptance。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
