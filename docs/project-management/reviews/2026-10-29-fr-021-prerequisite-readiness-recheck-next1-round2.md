# 獨立複審報告：FR-021 external prerequisite readiness recheck next1

- 審查對象 commit／版本：`c06d15e95a2f0a0981518c5873003a460e57a5ee`／`0.52.0`；目前工作樹仍 dirty，next2 以新的 source／focused-test SHA 綁定本輪修正。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 external prerequisite readiness recheck next stage（`FR-021-PREREQ-20261029-READINESS-RECHECK-NEXT1`）
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-10-29；獨立上下文，重新讀取目前 source、next1／next2 evidence、round1 報告、current 08、02／03／06／07 相關治理內容與 `scripts/project-docs-validator.mjs`。
- 審查限制：未重跑會建立 live evidence 的 verifier／readiness audit，未 signing／notarization，未修改 OS、keychain、candidate、Ollama、model store、source、test、evidence、治理文件或既有 review；只新增本報告。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:3-20` 記錄本輪 read-only macOS arm64 prerequisite recheck 的目標、去敏 evidence、source provenance、identity／credential classification、toolchain 與 capability scope；新增條目明確記錄 round1 修正、authoritative next2 與 next1 原件保留。
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37,48-54`、`docs/project-management/03-FUNCTIONAL-DESIGN.md:3-7`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-8` 均維持界線：FR-021 overall、真正斷網、Seatbelt packaged renderer、signed／notarized UI、Windows 與 LM Studio 不由本輪 readiness 或 capability presence 推導完成。
  - next2 evidence 使用 `offline-subtitle-factory.macos-signing-readiness-audit.v1`、status `blocked-external-signing-identity`，required toolchain／source config／existing evidence／provenance ready；identity probe 成功但 `validIdentityCount=0`、`formalIdentityAvailable=false`，11 個 credential presence flags 全 false、notarization `absent`／`ready=false`，scope 全 false，符合需求的 blocked 結果。
  - round1 P2 的兩個要求已實作：`scripts/audit-macos-signing-readiness.mjs:582-613` 新增 derived-field consistency，`scripts/test-macos-signing-readiness.mjs:15-18` 改以 authoritative next2 作 focused fixture，next1 原件未覆寫。
  - 但 current 08 `:5` 仍為「進行中」，且本輪尚未掛上 round2 review／「獨立審查是否執行」／「發布授權」欄位；因此需求內容已完成核對，治理 closeout 仍是 blocker。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `validateDerivedReadinessFields()` (`scripts/audit-macos-signing-readiness.mjs:582-613`) 現在拒絕 `matchingIdentityCount > validIdentityCount`，以 command／probe／count／Developer ID presence 重算 `formalIdentityAvailable`，以 required toolchain、source config、existing evidence 與 source provenance 重算 decision flags，並以 `classifyReadiness()` 重算 `formalSigningReady`、status 與 nextAction；`validateReadinessEvidence()` 在 `:647` 強制執行該 gate。
  - focused negative cases (`scripts/test-macos-signing-readiness.mjs:158-169`) 實際覆蓋 contradictory identity、contradictory formal decision、toolchain decision mismatch 與 matching-count overflow，均預期並實際拒絕 `DERIVED_FIELDS_CONSISTENCY_INVALID`；round1 的 P2 derived-field fail-closed finding 已解除。
  - next2 的 `gitHead` 仍為 `c06d15e95a2f0a0981518c5873003a460e57a5ee`，但 source script SHA 已更新為 `7803b418fe5962dbc5e79d742599522eb30ab94ad0f8503360ff4de739083277`，focused-test SHA 為 `cd09442102a1019e732ef3846c66f40fb8ce19154dbc4b7d97fbd113230dafb9`，package SHA 為 `0980d896c417828d08f17a5ca1399f682c5bc440bf20e2849839d766466ed79a`；與目前檔案重算值相符。next1 的舊 source／test hash 保留為 immutable first-run，沒有被冒充為 current authoritative record。
  - 目前 next2 的衍生欄位彼此一致：identity count 0 → formal identity false；required toolchain／source config／existing evidence／provenance true；formal signing false、status blocked；notarization derived from 11 個 presence flags 為 absent／false。

## 3. 邊界情況

- 判定：通過
- 證據：
  - `node scripts/test-macos-signing-readiness.mjs` exit 0；測試 current next2 並保留 identity command failure、malformed output、toolchain failure、scope／privacy、existing evidence path／status／type、credential schema、notarization mismatch、absolute path／secret leakage 與 nested schema 負向案例。
  - 新增負向矩陣 (`scripts/test-macos-signing-readiness.mjs:158-169`) 具體拒絕 formal identity、formal signing、toolchain ready 與 matching-count 的衍生矛盾；這比 round1 僅測欄位型別更能保證 fail-closed decision。
  - `safeBooleanScope()`／`validateExistingEvidenceSet()` (`scripts/audit-macos-signing-readiness.mjs:375-412`) 仍只接受固定 key set、固定 existing evidence 檔名、pass／ad-hoc／no-Team-ID／無 entitlement 摘要與全部 false scope；`validateReadinessEvidence()` (`:615-651`) 仍拒絕 unknown key、path、secret、raw output 與 PEM 類內容。
  - capability recheck 只以唯讀方式確認 `/usr/bin/sandbox-exec`、`ollama` 與 `ollama list` 的 `llama3.2:3b`／`llama3.2:1b`；沒有啟動／停止 Ollama、下載／修改 model、套用 Seatbelt、執行 packaged UI 或 signing。工具存在性未被擴稱為 signed、offline、UI 或 FR-021 pass。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - derived consistency 已集中於 `validateDerivedReadinessFields()`，重用 `requiredToolchainReady()`、`provenanceReady()`、`validateExistingEvidenceSet()` 與 `classifyReadiness()`，避免另寫一套可能分叉的 decision 判斷；schema／privacy／derived contract 的責任分層清楚。
  - `scripts/audit-macos-signing-readiness.mjs:654-667` 仍只保存 validated git HEAD、固定 provenance scope、SHA-256、git command success 與 dirty boolean；沒有把 raw git status、identity output、keychain 內容或 secret 寫入 evidence。
  - `scripts/audit-macos-signing-readiness.mjs:671-735` 保持 platform／arch gate、output path boundary、existing-file stop、固定 toolchain／credential／existing evidence projection，並以 `wx`／`0600` 建立 immutable evidence。`package.json` 的 signed-canary source seam 與 unsigned／development base config 仍分離。
  - round1 residual 的 validator contradiction probe 已由目前 source／focused test 覆蓋；剩餘只是不保存所有 dirty file contents，因此 `workingTreeDirty=true` 仍不等於完整 working-tree reproducibility，這是 evidence scope 的明示限制而非本輪 defect。

## 5. 測試覆蓋

- 判定：通過
- 證據：
  - `node scripts/test-macos-signing-readiness.mjs` exit 0，且 fixture 在 `:15` 明確讀取 `2026-10-29-fr-021-prerequisite-readiness-recheck-next2.json`；negative cases 在 `:158-169` 覆蓋本輪修正的四類 derived mismatch。
  - 對 next1 與 next2 各自以唯讀 Node import 執行 `validateReadinessEvidence()` 均 exit 0；兩份 evidence 均 status `blocked-external-signing-identity`、identity count 0、toolchain ready、credential status absent、scope all false。
  - `npm run docs:check` exit 0；完整 `npm run check` exit 0，包含 syntax、治理 validator、readiness focused contract、signed-canary gate／result contract、核心回歸與 posttest；`git diff --check` exit 0。
  - next2 immutable metadata：mode `600`、6099 bytes、SHA-256 `b7ee6038368f946fd7ead6c7ca11255f88e8e86d87cfc87da4881fe5db4dc031`；next1 原件 mode `600`、SHA-256 `6f5447d8b0244a27eef0fdbf5b3f58cd17f071c08b7351912ab4c27424ebe8a4`，未被覆寫。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 本輪未重跑會產生新 evidence 的 readiness audit 或 live verifier；實際核對的是主要代理保存的 immutable next1／next2 execution results，加上 current source validator、focused／full checks 與 capability read-only probe。
  - next2 actual result 保持與 next1 相同且正確的 external blocker：`probeReady=true`、`validIdentityCount=0`、`matchingIdentityCount=0`、`formalIdentityAvailable=false`；required toolchain／source config／existing evidence／provenance true，`formalSigningReady=false`，status `blocked-external-signing-identity`，notarization absent／false。
  - next2 `scope` 的 `candidateModified`、`keychainModified`、`signingAttempted`、`notarizationAttempted`、network／packaged app／UI／Ollama／model／raw output／absolute path／identity／secret flags 均為 false；`identity.rawOutputPersisted`、`identityNamesPersisted`、`identityHashesPersisted` 也均為 false。evidence interpretation 明確說明 blocked readiness 不代表 FR-021 pass 或 renderer diagnosis。
  - `npm run docs:check:final` 仍 exit 1，錯誤為 current latest entry 缺少「獨立審查是否執行：」與「發布授權：」、狀態尚未「完成」及審查欄位非是／否；故技術 P2 已解除，但治理 closeout 尚未實際完成。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：
  - `GOV-PREREQ-R2-01`（P1，治理 blocker）：current `08-CHANGE-LOG.md` 最新條目仍為「進行中」，未記錄本輪 round2 review／獨立審查欄位／發布授權，且 `npm run docs:check:final` exit 1。主要代理須自行完成 08 closeout、掛上本報告與完整逐字引用，再重跑 final docs gate；本審查代理不得修改 08。
- 剩餘風險：
  - P2 `derived-field consistency` 已解除；next2 是 current source 的 authoritative readiness evidence，但仍只描述 external signing prerequisite，不提供 Developer ID identity、effective entitlements、signed／notarized candidate、renderer acceptance 或 FR-021 overall evidence。
  - dirty worktree 只保存 dirty boolean 與指定 source／package／focused-test bytes digest，不保存全部未提交內容；因此不應宣稱完整 build reproducibility。
  - sandbox-exec／Ollama／預裝 model 只證明 bounded local capability；不可擴稱 Seatbelt offline、全機 egress、signed／notarized、UI、Windows、LM Studio 或 FR-021 overall pass。
- 給主要開發代理的具體修正要求（若有）：只需由主要代理補齊 current 08 的 round2 治理 closeout 並使 `npm run docs:check:final` 通過；不得覆寫 next1／next2 evidence、round1 report 或本 round2 report。
- 可逐字引用完整結論句：**本輪 `FR-021-PREREQ-20261029-READINESS-RECHECK-NEXT1` round2 獨立複審結論為有條件通過：round1 P2 的 derived-field consistency 缺口已由 `validateDerivedReadinessFields()`、`validateReadinessEvidence()` 與 next2-authoritative focused negative cases 修正並核對通過，next2 schema `offline-subtitle-factory.macos-signing-readiness-audit.v1`、status `blocked-external-signing-identity`、mode `0600`、SHA-256 `b7ee6038368f946fd7ead6c7ca11255f88e8e86d87cfc87da4881fe5db4dc031`、current source／package／focused-test hashes、privacy 與全 false scope 均成立；identity probe 成功但 `validIdentityCount=0`、credential presence 全 false、notarization absent、required toolchain ready，且 sandbox-exec／Ollama／預裝模型的 capability recheck 未擴稱 signed、offline、UI 或 FR-021 overall pass；唯一阻擋是 current 08 仍未 closeout，`npm run docs:check:final` exit 1，因此主要代理完成 08 治理同步前，本輪只能判定為有條件通過。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
