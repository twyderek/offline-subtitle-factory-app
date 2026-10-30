# 獨立複審報告：FR-021 macOS signed-canary prerequisites revalidation next2 remediation

- 審查識別：`FR-021-MACOS-SIGNED-CANARY-PREREQUISITES-REVALIDATION-20261030-NEXT2-REMEDIATION`
- 審查對象：local HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b`／版本 `0.52.0`；工作樹含既有未提交變更
- 對應 08-CHANGE-LOG 條目：2026-10-30 — FR-021 signed-canary prerequisite revalidation review findings remediation
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-10-30 07:25–07:30 +0800（Asia/Taipei）；獨立上下文，重新讀取 `AGENTS.md`、full preflight 路由、round1 報告、目前 source／test／evidence 與 00／05／06／07／08 摘要，未以主要代理評價取代證據。
- 審查限制：只讀、執行與驗證；不觸發 audit main、workflow、keychain、builder、codesign、notarytool 或外部寫入。

## 審查輸入與範圍

- full preflight：`npm run project:preflight -- --type=full`，exit 0；依其列出的固定核心與 00–09／全部 workflows 取讀必要規範。
- round1：`docs/project-management/reviews/2026-10-30-fr-021-signed-canary-prerequisites-revalidation-next2-round1.md`；待追蹤 findings 為 `GOV-N2-01`、`TECH-GATE-N2-01`、`TECH-READINESS-N2-02`。
- remediation source／tests：
  - `scripts/audit-macos-signed-canary-gate.mjs`
  - `scripts/test-macos-signed-canary-gate.mjs`
  - `scripts/audit-macos-signing-readiness.mjs`
  - `scripts/test-macos-signing-readiness.mjs`
- current immutable evidence：`docs/project-management/evidence/2026-10-30-fr-021-macos-signed-canary-external-boundary-next15.json`、`2026-10-30-fr-021-prerequisite-readiness-recheck-next7.json`、`2026-10-30-fr-021-signed-canary-gate-execution7.json`。
- 本輪沒有修改治理來源文件；只新增本報告。

## Round1 findings closure matrix

| Finding | round2 判定 | 證據 |
|---|---|---|
| `GOV-N2-01` | 未關閉 | `08-CHANGE-LOG.md:3-13` 最新 remediation 條目仍為「狀態：進行中」，尚無「獨立審查是否執行：」與「發布授權：」欄位；`npm run docs:check:final` exit 1。 |
| `TECH-GATE-N2-01` | 部分修正，仍開放；P1 blocker | `audit-macos-signed-canary-gate.mjs:89-132` 已有 exact schema、timestamp、ready/reasons relation、execution/scope/privacy/provenance checks 並 export validator；但沒有把 `gate.*` 與 nested `sourceConfig`／`identity`／`toolchain`／`notarization` 的 derived values 互相核對。唯讀 mutation probe 對 execution7 逐一改動 `gate.sourceConfigReady`、`gate.requiredToolchainReady`、`gate.identityReady`、`gate.notarizationReady`、`gate.notarizationConsistent` 後，五種矛盾 evidence 均被 `validateEvidence()` 接受。focused test 的 synthetic ready path 亦未覆蓋這些 mismatch。 |
| `TECH-READINESS-N2-02` | 關閉 | `audit-macos-signing-readiness.mjs:175-179,621-625` 已要求 UTC ISO millisecond 字串與 `completedAt >= startedAt`；`test-macos-signing-readiness.mjs:16-35` 已選取目前候選中的 10/30 `next7` 並覆蓋 null／malformed／reverse-order。 |

## 1. 需求／範圍

- 判定：部分通過。
- remediation 條目的範圍與成功條件在 `08-CHANGE-LOG.md:7-13` 已限定為四支 local validator／focused regression，排除 workflow、candidate、keychain、remote、外部服務與新增 immutable evidence；00／05／06／07 的 remediation 摘要 (`00:3-7`、`05:3-7`、`06:3-7`、`07:3-8`) 與此一致。
- ready／blocked 兩條結果路徑已被實作並可被測試；readiness timestamp finding 已實際修正。可是條目明定須拒絕「derived」破壞，而目前 validator 仍接受 nested projection 與 gate projection 不一致，故不能判定需求完整達成。

## 2. source／test correctness

- 判定：部分通過；formal gate 仍不正確地允許矛盾 projection。
- `audit-macos-signed-canary-gate.mjs:94-131` 的 exact top-level／nested key、型別、ISO millisecond timestamp、`ready === (reasons.length === 0)`、全 execution／scope false、64-hex provenance 與 leakage checks 均存在；`export { validateEvidence }` 位於 `:180`，可由 focused test 直接驗證。
- `test-macos-signed-canary-gate.mjs:81-125` 會讀取 authoritative execution evidence、接受 synthetic ready path，並測 reasons、timestamp、execution 負向案例；但 synthetic ready path 只同步部分欄位，沒有證明 validator 會拒絕以下實際矛盾：`gate.sourceConfigReady !== sourceConfig.sourceConfigReady`、`gate.requiredToolchainReady !== toolchain` derived result、`gate.identityReady !== identity` derived result、`gate.notarizationReady !== notarization.ready`、`gate.notarizationConsistent` 與 credential-derived notarization 不一致。
- `audit-macos-signing-readiness.mjs:621-658` 的 timestamp 修正與既有 derived／privacy／provenance checks 正確；`test-macos-signing-readiness.mjs:16-35` 的現行 evidence selection 在目前目錄確實選到 10/30 `next7`。但其 filename filter 同時允許 10/29／10/30，排序只依 `nextN` 數字，未以日期優先；目前沒有較大的舊日期序號，因此本次未造成錯選，仍是可維護性 P2 風險。

## 3. evidence provenance／schema／privacy

- 判定：部分通過。
- execution7、next7、next15 的實際檔案 mode 均為 `0600`；SHA-256 與治理摘要一致：execution7 `29710462ca9757750a8d897418c7b3a90d01e180469f69a9261f960b90da0ab9`、next7 `11996d29916cbac5dda392cf476e53f37ded8e07e23daff8f1aaf72cde97caaa`、next15 `7ae2b6b4e1e069bceac479669c57cc07393f59cf904049faf76058620bc9868c`。execution7 的 exact schema、兩個 gate reasons、`execution`／`scope` 全 false 與 privacy interpretation 見 evidence `:1-97`；next7 的 current HEAD、source／package／focused-test provenance、0 valid identity、credential absent、scope 全 false 見 `:2-28,66-108,162-189`。
- current evidence 的 timestamp、去敏 projection 與 scope/privacy boundary 如實；本輪沒有把 current-source prerequisite evidence 擴大成 signed candidate、notarization 或 release evidence。
- 但 formal gate validator 的 provenance 目前只驗證 digest 形狀，不驗證 gate projection 與 nested source data 的 derived relation；這正是 P1 `TECH-GATE-N2-01` 尚未關閉的 schema integrity 缺口。另，focused test 的 authoritative evidence selection 仍是序號優先，列為 P2 residual，未造成 current evidence 失真。

## 4. 驗證完整性

- 判定：部分通過。
- 允許的安全驗證結果（2026-10-30，Asia/Taipei，本複審 session）：
  - 四支指定檔案 `node --check`：exit 0。
  - `node scripts/test-macos-signed-canary-gate.mjs`：exit 0，輸出 `macOS signed canary gate contract passed`。
  - `node scripts/test-macos-signing-readiness.mjs`：exit 0，輸出 `macOS signing readiness focused contract passed`。
  - `node scripts/test-project-docs-validator.mjs`：exit 0。
  - `npm run check`：exit 0；完整 npm regression、兩支 focused tests、docs check 與 posttest 均通過。
  - `git diff --check`：exit 0。
  - `npm run docs:check:final`：exit 1，輸出最新工作紀錄缺少「獨立審查是否執行：」「發布授權：」、狀態尚未「完成」，且獨立審查欄位不是是／否。
- 額外只讀 mutation probe：對 execution7 的五個 gate derived projection 欄位各自製造與 nested evidence 不一致，五次均輸出 `ACCEPTED`；因此 focused test 的綠燈不能代表 derived fail-closed contract 已完整。
- 按使用者限制未執行 audit mains、workflow、keychain、builder、codesign、notarytool、外部 API 寫入或任何會產生新 evidence 的操作；故沒有 signed workflow、candidate、Apple ticket、stapler／Gatekeeper 或 release 的實際運行證據。

## 5. 治理文件一致性

- 判定：不通過（closeout blocker 尚未解除）。
- 00／05／06／07 的 remediation summaries 一致地記錄四支 validator／test 修正、local checks 通過、尚待獨立複審與 final docs gate，且都保留「不代表 signed／notarized candidate 或 FR-021 overall」的界線（`00:3-7`、`05:3-7`、`06:3-7`、`07:3-8`）。
- `08-CHANGE-LOG.md:3-13` 的 remediation 條目仍是進行中，且只含計畫／範圍／驗證計畫，未填實際複審欄位、逐字結論、發布授權與完成狀態。這與 `docs:check:final` exit 1 一致；本複審代理不能代改 08，也沒有修改任何治理文件。
- 00／05／06／07 的文字宣稱目前仍未過度擴大，但其中「derived relation 已修正／完整」需在 P1 修正後重新核實，否則只能視為過度概括的 remediation summary，不能作為 technical closure 證據。

## 6. 殘餘風險／不得過度宣稱

- 判定：部分通過。
- 可以支持的 bounded conclusion：next15／next7／execution7 是 current-source、0600、去敏、fail-closed prerequisite evidence；next15 仍記錄 Environment／reviewer／secret scope／protected branch 缺口，next7 記錄 0 valid Developer ID identity／credential absent，execution7 在 runtime manifest／builder 前阻擋。
- 不得宣稱：signed／hardened／notarized candidate、Apple ticket、stapler／Gatekeeper、真實 workflow run、release、renderer／UI、真正全機 egress、Windows 或 FR-021 overall acceptance。`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false` 與其他平台／隔離 residual 仍不在本 remediation 範圍。
- P1：`TECH-GATE-N2-01` 保持開放；必須加入 gate projection 對 sourceConfig／toolchain／identity／credential-derived notarization 的一致性驗證，並新增每一類 mismatch 的 focused negative cases，確認 blocked／ready 都 fail-closed。
- P2：`TECH-READINESS-N2-03`（new, non-blocking）——readiness focused test 的 authoritative file selector 應以日期優先、再以序號排序，或明確只允許當日 evidence；目前 10/30 `next7` 選取正確，但未來較大 10/29 序號可能搶先被選取。gate focused test 的 10/29／10/30 execution selector 也有相同序號優先 residual，應一併收斂。

## Findings summary

- round1 `GOV-N2-01`：未關閉，P1 governance closeout blocker；需由主要代理補 08 欄位並重跑 `npm run docs:check:final`。
- round1 `TECH-GATE-N2-01`：未關閉，P1 technical/schema blocker；ready path 已可被接受，但 derived relation 仍可被矛盾 mutation 繞過。
- round1 `TECH-READINESS-N2-02`：已關閉；timestamp validator 與 null／malformed／reverse-order cases 已存在並通過。
- new `TECH-READINESS-N2-03`：P2，date-aware authoritative evidence selection 不完整；目前 evidence selection 結果正確，未造成 current evidence 失真。

## 綜合判定

- 結論：不通過。
- 阻擋問題：`GOV-N2-01` 與 `TECH-GATE-N2-01` 兩個 P1；前者為 08 closeout／final docs gate 未完成，後者為 formal gate evidence validator 尚未對 derived projection fail-closed。
- 剩餘風險：P2 `TECH-READINESS-N2-03` 的日期優先選證 residual；外部 Environment／required reviewer／secret scope／protected branch、Developer ID identity、notarization credential 與真實 signed workflow 仍未具備；current evidence 仍不代表 candidate 或 FR-021 overall。
- 給主要開發代理的具體修正要求：
  1. 在不改寫本報告與 round1 原件的前提下，修正 `validateEvidence()`，以同一套 deterministic derivation 驗證 gate projection 與 nested source／identity／toolchain／notarization／credential presence 一致。
  2. 為上述每一種 derived mismatch 補 focused negative case，並補 gate／readiness authoritative selector 的日期優先規則。
  3. 依治理規範補齊本 remediation 的 08 實際結果、獨立審查欄位、逐字引用本報告完整結論句、發布授權欄位與完成狀態，再重跑 `npm run docs:check:final`；治理文件的修改不由本審查代理執行。

## 完整可供 08 逐字引用的結論句

**本輪 `FR-021-MACOS-SIGNED-CANARY-PREREQUISITES-REVALIDATION-20261030-NEXT2-REMEDIATION` round2 獨立複審結論為不通過：readiness `startedAt`／`completedAt` 的 UTC ISO millisecond 與順序驗證、10/30 `next7` current evidence selection、formal gate ready／blocked exact schema、timestamp、execution／scope／privacy／provenance checks 與 exported validator 均已實作且指定 local checks 通過；但 `TECH-GATE-N2-01` 尚未關閉，因 `validateEvidence()` 仍接受 gate projection 與 nested source／identity／toolchain／notarization derived fields 不一致的矛盾 evidence，另有 P2 `TECH-READINESS-N2-03` 的日期優先 evidence selection residual，且 `GOV-N2-01` 的 08 closeout 尚未完成、`npm run docs:check:final` exit 1；因此不得宣稱 remediation 完成、signed／notarized candidate、Apple ticket、release 或 FR-021 overall acceptance。**

## 審查代理聲明

本審查代理除新增本報告外，僅執行讀取、指令執行與驗證；未修改任何其他專案檔案，未修改治理文件、既有 evidence 或既有 review，未 stage、commit 或 push，未觸發 workflow、keychain、builder、codesign、notarytool 或任何外部寫入。

若上述聲明不實，本報告無效。
