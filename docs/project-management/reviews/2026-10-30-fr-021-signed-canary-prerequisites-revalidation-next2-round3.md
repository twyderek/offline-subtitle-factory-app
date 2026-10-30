# 獨立複審報告：FR-021 signed-canary prerequisites revalidation next2 remediation

- 審查識別：`FR-021-MACOS-SIGNED-CANARY-PREREQUISITES-REVALIDATION-20261030-NEXT2-REMEDIATION`
- 審查對象：local HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b`／版本 `0.52.0`；工作樹含既有未提交變更
- 對應 08-CHANGE-LOG 條目：2026-10-30 — FR-021 signed-canary prerequisite revalidation review findings remediation
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-10-30（Asia/Taipei）；獨立上下文，重新讀取 `AGENTS.md`、`full` preflight 路由、round1／round2 報告、現行 source／test 與 00／05／06／07／08 摘要，未以主要代理評價取代證據。
- 審查限制：只讀、執行與驗證；不觸發 audit main、workflow、keychain、builder、codesign、notarytool 或外部寫入。

## 審查輸入與驗證範圍

- `npm run project:preflight -- --type=full`：exit 0；依列出的固定核心、00–09 與全部 workflows 取讀必要規範。
- round1：`docs/project-management/reviews/2026-10-30-fr-021-signed-canary-prerequisites-revalidation-next2-round1.md`。
- round2：`docs/project-management/reviews/2026-10-30-fr-021-signed-canary-prerequisites-revalidation-next2-round2.md`。
- remediation source／tests：`scripts/audit-macos-signed-canary-gate.mjs`、`scripts/test-macos-signed-canary-gate.mjs`、`scripts/audit-macos-signing-readiness.mjs`、`scripts/test-macos-signing-readiness.mjs`。
- current immutable evidence：`docs/project-management/evidence/2026-10-30-fr-021-signed-canary-gate-execution7.json`、`2026-10-30-fr-021-prerequisite-readiness-recheck-next7.json`、`2026-10-30-fr-021-macos-signed-canary-external-boundary-next15.json`。
- 本輪只新增本報告；未修改治理來源文件、source、test、evidence 或既有 review。

## Round1／round2 findings closure

| Finding | round3 判定 | 證據 |
|---|---|---|
| `GOV-N2-01` | 未關閉；P1 governance closeout blocker | `08-CHANGE-LOG.md:3-14` 最新 remediation 條目仍為「狀態：進行中」，缺少「獨立審查是否執行：」與「發布授權：」；`npm run docs:check:final` 明確以 exit 1 報告四項 closeout 缺口。此項只剩主要代理回填 08 並重跑 final gate。 |
| `TECH-GATE-N2-01` | 已關閉 | `scripts/audit-macos-signed-canary-gate.mjs:89-155` 驗證 exact schema／privacy／timestamp／execution／scope／provenance，並在 `:124-146` 呼叫 `evaluateFormalSignedCanaryReadiness()`，逐一比對 `sourceConfigReady`、`requiredToolchainReady`、`identityReady`、`notarizationReady`、`notarizationStatus`、`notarizationConsistent`、`reasons` 與 `ready` relation；`scripts/test-macos-signed-canary-gate.mjs:81-133` 通過 authoritative blocked evidence、synthetic ready path、五個 gate projection mismatch、nested source mismatch、timestamp／execution negatives。 |
| `TECH-READINESS-N2-02` | 已關閉 | `scripts/audit-macos-signing-readiness.mjs:175-179,621-625` 驗證 `startedAt`／`completedAt` 為 UTC ISO millisecond 且完成時間不早於開始時間；`scripts/test-macos-signing-readiness.mjs:37-39` 覆蓋 null／malformed／reverse-order。 |
| `TECH-READINESS-N2-03`（round2 新 P2） | 已關閉 | `scripts/test-macos-signing-readiness.mjs:16-24` 與 `scripts/test-macos-signed-canary-gate.mjs:82-90` 均先按日期、再按 `nextN`／`executionN` 序號選取，並要求選中 2026-10-30 evidence；current `next7`／`execution7` 直接 validator probe 均 pass。 |

## 1. 需求完整性

- 判定：部分通過（有條件通過；technical remediation scope，治理 closeout pending）。
- 證據：
- gate remediation 已達成條目要求：blocked 與 synthetic ready 兩條 evidence 路徑均可驗證；validator 不再只接受 `ready=false`，而是以 `evaluateFormalSignedCanaryReadiness()` 的同一套 derived logic 核對 source config、required toolchain、identity、credential-derived notarization、reasons、ready relation 與所有 gate projection。
- focused regression 覆蓋 authoritative blocked evidence、synthetic ready path、五個 gate projection mismatch、nested `sourceConfig` mismatch、timestamp 與 execution 負向案例；readiness focused regression 覆蓋 timestamp schema 與 date-first current evidence selector。
- 範圍仍受限於 local deterministic／current evidence contract；沒有把 readiness 或 formal gate pass 擴大為 signed／notarized candidate、Apple ticket、release 或 FR-021 overall acceptance。

## 2. 邏輯正確性

- 判定：通過（bounded local contract）。
- 證據：
- `evaluateFormalSignedCanaryReadiness()` 的 derived logic 位於 `scripts/assert-macos-signed-canary-ready.mjs:79-128`；gate validator 將 evidence 的安全 projection 轉回相同 evaluator input，並於 `scripts/audit-macos-signed-canary-gate.mjs:124-146` 比對完整 evaluation result。
- `sourceConfig`、identity、toolchain、credential presence 與 notarization nested fields 先通過 exact shape／type checks，再由 evaluator 計算 expected values；credential-derived notarization 不一致會使 `notarizationConsistent=false`／`notarizationStatus='invalid'` 而拒絕 evidence。
- current `execution7` 的 blocked result 可通過 gate validator；focused synthetic ready mutation 也可通過 validator，五種 gate projection mutation 與 nested source mutation 均被 `GATE_EVIDENCE_DERIVED_FIELDS_INVALID` 拒絕。

## 3. 邊界情況

- 判定：通過（bounded evidence contract）。
- 證據：
- gate validator 的 top-level／nested exact schema、UTC ISO millisecond timestamp／順序、`execution` 三欄全 false、17 個 `scope` 欄位全 false、64-hex source revision 與 leakage guard 見 `scripts/audit-macos-signed-canary-gate.mjs:89-155`。
- readiness validator 的 timestamp、source revision、identity privacy、credential presence、notarization derivation、decision derivation、scope 與 leakage guard 見 `scripts/audit-macos-signing-readiness.mjs:621-658`。
- 直接讀取 current evidence 並呼叫兩個 exported validator 的 local probe 結果：`execution7` validator pass、mode `0600`、SHA-256 `29710462ca9757750a8d897418c7b3a90d01e180469f69a9261f960b90da0ab9`；`next7` validator pass、mode `0600`、SHA-256 `11996d29916cbac5dda392cf476e53f37ded8e07e23daff8f1aaf72cde97caaa`。兩者均由 date-first selector 選出，未建立新 evidence。

## 4. 程式碼品質

- 判定：通過；治理 closeout 除外。
- 證據：
- `00-CURRENT-STATUS.md:3-7`、`05-DEVELOPMENT-AND-DEPLOYMENT.md:3-7`、`06-TEST-AND-PROCESS-AUDIT.md:3-7`、`07-DEBUG-AND-FIX-HISTORY.md:3-8` 的 remediation summaries 與現行四支 source／test 一致：記錄 evaluator-derived gate validation、ready／blocked regression、timestamp／date-first selector、local checks 與不得過度宣稱的邊界；只讀核對，未修改治理。
- 00／05／06／07 均保留 external Environment／identity／credential blocker 與「不代表 signed／notarized candidate 或 FR-021 overall」的限制。沒有發現新的 P1/P2 technical finding。
- 治理唯一未結案項仍是 `08-CHANGE-LOG.md:3-14`；`npm run docs:check:final` 的 exit 1 只指出最新條目缺少審查／發布授權欄位、尚未標示完成。主要代理需在 08 回填本報告路徑、逐字引用結論句、`獨立審查是否執行：是`、`發布授權：不適用`、實際驗證結果、完成狀態與遺留風險，再重跑 final gate。

## 5. 測試覆蓋

- 判定：通過（local deterministic scope）。
- 證據：
- 2026-10-30（Asia/Taipei）實際執行：
  - 四支指定檔案 `node --check`：exit 0。
  - `node scripts/test-macos-signed-canary-gate.mjs`：exit 0，`macOS signed canary gate contract passed`。
  - `node scripts/test-macos-signing-readiness.mjs`：exit 0，`macOS signing readiness focused contract passed`。
  - `node scripts/test-project-docs-validator.mjs`：exit 0。
  - `npm run check`：exit 0；docs check、完整 npm regression、兩支 focused tests 與 posttest 均通過。
  - `git diff --check`：exit 0。
  - current evidence direct validator probe：gate／readiness 均 pass；未產生新 evidence。
  - `npm run docs:check:final`：exit 1，原因為最新 08 缺少「獨立審查是否執行：」、`發布授權：`、完成狀態與是／否值；這是尚待主要代理回填的 governance closeout，不是本輪 source／test technical failure。
- 依限制未執行 audit main、workflow、keychain、builder、codesign、notarytool、stapler、Gatekeeper、packaged app／UI、Ollama／model、network isolation 或任何外部寫入；因此沒有 signed workflow、candidate、Apple ticket、release 或 FR-021 overall 的實際運行證據。

## 6. 實際運行結果

- 判定：部分通過（有條件通過；external prerequisites 與治理 closeout pending）。
- 證據：
- current `next15`／`next7`／`execution7` 仍只證明 current-source prerequisite state、去敏 schema／privacy／scope 與 fail-closed local contract；Environment／required reviewer／secret scope／protected branch、Developer ID identity、notarization credential 與真實 signed workflow 仍未具備／未執行。
- 不得宣稱 signed／hardened／notarized candidate、Apple ticket、stapler／Gatekeeper、真實 workflow run、release、renderer／UI、真正全機 egress、Windows 或 FR-021 overall acceptance；既有 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false` 與其他平台／隔離 residual 維持。

## Findings

### P1

- `GOV-N2-01`（carry-over；round1／round2 未關閉）：最新 remediation 條目尚未完成 08 closeout，`npm run docs:check:final` exit 1。此為本輪唯一未解除 finding；主要代理回填 08 後重跑 final gate 即可確認治理結案。

### P2

- 無新的 P2 finding。round2 `TECH-READINESS-N2-03` 已由 date-first selector 修正並通過 current evidence validator；external Environment／identity／credential／workflow 仍是範圍外 residual，不是本輪 source defect。

## 綜合判定

- 結論：有條件通過（technical remediation closed；governance closeout pending）。
- 阻擋問題（若有）：僅 `GOV-N2-01`；不得在主要代理完成 08 回填並使 `npm run docs:check:final` 通過前，將本 remediation 標示為完整結案。
- 條件：主要代理只需回填 08 本輪實際結果、round3 report link、以下完整結論句、獨立審查欄位、`發布授權：不適用`、完成狀態與遺留風險，然後重跑 `npm run docs:check:final`；不得修改本報告或 round1／round2 原件。
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-SIGNED-CANARY-PREREQUISITES-REVALIDATION-20261030-NEXT2-REMEDIATION` round3 獨立複審結論為有條件通過：`TECH-GATE-N2-01` 的 formal gate ready／blocked validator、`TECH-READINESS-N2-02` 的 timestamp schema、`TECH-READINESS-N2-03` 的 date-first current evidence selector 均已關閉，gate validator 現以 `evaluateFormalSignedCanaryReadiness()` 同一套 derived logic 核對 sourceConfigReady、requiredToolchainReady、identityReady、notarizationReady、notarizationStatus、notarizationConsistent、reasons 與 ready relation，focused／完整 local checks、current gate／readiness evidence validator、privacy／execution／scope／provenance checks 均通過；本輪唯一未解除項為 `GOV-N2-01`，因最新 `08-CHANGE-LOG.md` 尚未完成治理 closeout 且 `npm run docs:check:final` exit 1，故主要代理回填 08 並重跑 final gate 後，方可結案本 remediation，且本結論不得擴大為 signed／notarized candidate、Apple ticket、release 或 FR-021 overall acceptance。**

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。未修改治理文件、source、test、evidence 或既有 review，未 stage、commit 或 push，未觸發 audit main、workflow、keychain、builder、codesign、notarytool 或任何外部寫入。

若上述聲明不實，本報告無效。
