# 獨立審查報告：FR-021 external prerequisite readiness recheck next1

- 審查對象 commit／版本：`c06d15e95a2f0a0981518c5873003a460e57a5ee`／`0.52.0`；工作樹依 evidence 記錄為 dirty，未將 dirty worktree 誤當成 clean source。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 external prerequisite readiness recheck next stage（`FR-021-PREREQ-20261029-READINESS-RECHECK-NEXT1`）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-29；獨立上下文，重新讀取 AGENTS.md、project-management README、00／02／03／06／07／08、readiness source／focused test／validator／evidence，未沿用主要代理的評價性結論。
- 審查限制：未重跑會建立新 evidence 的 readiness audit 或 packaged UI verifier，未 signing／notarization、未碰 keychain／candidate／Ollama／model store／OS network，僅執行讀取、唯讀驗證與既有 checks。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:3-19` 將本輪界定為 macOS arm64 外部 signing／notarization prerequisite 的 read-only、去敏 recheck，成功條件包含 platform／arch、toolchain、source provenance、identity count、credential classification、existing evidence consistency 與 capability recheck；並明確排除 signing、notarization、keychain、OS network、packaged UI、LM Studio、Windows 與 FR-021 overall。
  - 新 evidence `docs/project-management/evidence/2026-10-29-fr-021-prerequisite-readiness-recheck-next1.json` 的 schema 為 `offline-subtitle-factory.macos-signing-readiness-audit.v1`，status 為 `blocked-external-signing-identity`；`environment.platform=darwin`、`arch=arm64`，`decision.toolchainReady=true`、`sourceConfigReady=true`、`provenanceReady=true`，`identity.validIdentityCount=0`、`formalIdentityAvailable=false`。
  - 11 個 credential presence flags 全為 false；`notarization.status=absent`、`completeSetCount=0`、`ready=false`；top-level `scope` 的 15 個欄位全部為 false。這符合「若 external identity／credential 仍 blocked，固定 blocker 而不宣稱 signed／offline／UI pass」的要求。
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37,48-54` 仍把 FR-021 overall、真正斷網與 LM Studio 例外分開；`docs/project-management/03-FUNCTIONAL-DESIGN.md:3-7` 及 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-8` 也將工具存在性限縮為 bounded capability，不擴稱 acceptance。
  - 但 current `08-CHANGE-LOG.md:5` 仍是「進行中」，且 `:3-19` 尚無本輪「獨立審查是否執行」與「發布授權」欄位；這是治理結案缺口，不是 evidence 內容缺口。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - `scripts/audit-macos-signing-readiness.mjs:65-90` 以 exact top-level／source-revision key set 要求 git HEAD、audit script／package／focused-test SHA-256、git command success 與 `workingTreeDirty`；`validateReadinessEvidence()` 在 `:568-603` 再檢查 schema、darwin／arm64、identity probe、toolchain、固定 existing evidence、credential derivation、scope allowlist 與 path／secret／PEM 類洩漏。
  - `classifyReadiness()` (`scripts/audit-macos-signing-readiness.mjs:518-565`) 先拒絕 provenance、identity probe、existing evidence 或 required toolchain failure，再在 `formalIdentityAvailable=false` 時固定回傳 `blocked-external-signing-identity`；目前 evidence 的 `validIdentityCount=0`、`probeReady=true`、`commandSucceeded=true` 正確落入此分支，而不是被誤分類成 probe failure 或 ready。
  - `summarizeSourceBuildConfig()` (`scripts/audit-macos-signing-readiness.mjs:414-451`) 與 `lib/macos-signed-canary-build-config.mjs:4-12` 將 signed-canary source seam 投影為 auto-discovery、hardened runtime、Gatekeeper assess 與 arm64 targets；目前 `sourceConfigReady=true` 僅表示 source config 可供未來隔離 canary，並不表示已擁有 identity、effective entitlements、signed candidate 或 notarization。`sourceBuildConfig.entitlementsConfigured=false` 也沒有被掩飾。
  - `scripts/audit-macos-signing-readiness.mjs:687` 使用 `flag: 'wx'` 與 `mode: 0o600` 寫入 evidence；本輪實測 `validateReadinessEvidence(next1)` exit 0，避免以重新產生 evidence 取代對 immutable 原件的核對。
  - residual：`validateIdentity()` 與 `validateReadinessEvidence()` 目前主要驗證欄位型別／schema，未交叉拒絕 `validIdentityCount=0` 同時 `formalIdentityAvailable=true` 或 `decision.formalSigningReady=true` 的矛盾衍生欄位。以 current evidence 的記憶體複製資料做唯讀 probe，結果為 `contradictory-derived-fields=accepted`；本次 immutable evidence 的實際欄位仍一致，因此列為 P2 fail-closed 強化風險，不把它誤列為本次 evidence 已失真。

## 3. 邊界情況

- 判定：通過
- 證據：
  - `node scripts/test-macos-signing-readiness.mjs` exit 0；`scripts/test-macos-signing-readiness.mjs:85-114` 覆蓋 identity command failure、malformed identity output 與 toolchain unavailable 的 fail-closed classification。
  - `scripts/test-macos-signing-readiness.mjs:116-179` 覆蓋 scope pollution／unknown scope、existing evidence path／status／type 污染、空／單筆／重複 evidence set、credential key 缺失／未知、notarization derived mismatch、unknown top-level key、絕對路徑／keychain path、nested environment／toolchain unknown key 與錯誤型別；均以預期錯誤拒絕。
  - `scripts/audit-macos-signing-readiness.mjs:375-403` 僅允許固定全 false scope 與固定既有 evidence 檔名／摘要；`452-480` 對 Apple ID、API key、keychain profile 的 complete／partial／ambiguous／absent classification 以布林 presence 派生，不保存 credential value。
  - capability recheck 僅做唯讀確認：`/usr/bin/sandbox-exec` 存在，`ollama` 可執行，`ollama list` 顯示 `llama3.2:3b` 與 `llama3.2:1b`；沒有啟動／停止 Ollama、下載／修改 model、執行 UI 或套用 Seatbelt。這些結果沒有被當成 signed、offline、renderer 或 UI pass。
  - residual 為上述衍生欄位一致性 probe 未納入 focused regression；它不改變本輪現有 evidence 的實際一致值，但應在後續 source／test 強化中補齊。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - `scripts/audit-macos-signing-readiness.mjs` 將 source revision、environment、toolchain、identity、source config、credential／notarization、existing evidence、decision 與 privacy scope 分成可測試的純投影／驗證函式；`safeBooleanScope()`、`safeExistingEvidenceScope()` 與 `validateExistingEvidenceSet()` 採 exact key／type／allowlist，降低未知欄位或污染輸入被接受的風險。
  - identity 只保存 `probeReady`、數量、類別布林與 `rawOutputPersisted=false`／`identityNamesPersisted=false`／`identityHashesPersisted=false`；`interpretation` 明示不保存 raw command、absolute path、credential、keychain 內容，也不授權 network／sandbox／release 變更。
  - `package.json:42-45` 將正式 signed-canary gate 與既有 unsigned／development build 分離；`package.json:188-190` 的 base mac config 仍是 `identity:null`、hardened／Gatekeeper false，沒有把 readiness source seam 冒充為已簽章產品。
  - 目前檔案重算的 git HEAD、三個 source／package／focused-test SHA-256 與 evidence 內值完全相同；working tree dirty 被明確記錄。剩餘風險是 dirty status 只以 boolean 保存，無法重建全部未提交檔案內容，故不能推導完整 build reproducibility。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - `node scripts/test-macos-signing-readiness.mjs` exit 0；`npm run docs:check` exit 0（19 個治理文件）；`npm run check` exit 0，包含 syntax、治理 validator、readiness focused contract、signed-canary gate／result contract、核心回歸與 YouTube tests；`git diff --check` exit 0。
  - 另以唯讀 Node import 直接對本輪 `2026-10-29-fr-021-prerequisite-readiness-recheck-next1.json` 執行 `validateReadinessEvidence()`，exit 0；`stat` 顯示 mode `600`、6099 bytes，重算 SHA-256 為 `6f5447d8b0244a27eef0fdbf5b3f58cd17f071c08b7351912ab4c27424ebe8a4`。
  - source provenance 重算為 git HEAD `c06d15e95a2f0a0981518c5873003a460e57a5ee`、audit script `264633d4dafff3744ea56c082f9c680d994acbb3bbde1f3c6c1b17166989b61e`、package `0980d896c417828d08f17a5ca1399f682c5bc440bf20e2849839d766466ed79a`、focused test `bacd5e6bded37e197feb5bc476f83b7f9714dc1167a8bbec454992e3cf40e0bb`，與 evidence 完全相符。
  - coverage gap：`scripts/test-macos-signing-readiness.mjs:15-18` 的 authoritative fixture 固定指向較早的 `2026-10-29-fr-021-signing-readiness-audit12.json`，不是本輪 next1；因此完整 `npm run check` 通過的是 focused contract／audit12，不是由既有 focused test 直接鎖定 next1。上述 next1 direct validation 已補足本次審查的唯讀確認，但仍是 reviewer command，不是主要代理提交的新 regression。

## 6. 實際運行結果

- 判定：通過
- 證據：
  - 主要代理留下的 actual readiness execution（`docs/project-management/08-CHANGE-LOG.md:17-19`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-8`）記錄 `node scripts/audit-macos-signing-readiness.mjs ...next1.json` exit 0；本輪未重跑該會建立新 evidence 的 audit，改以既有檔案 hash／mode／schema validator 重新核對。
  - actual result 正確為 blocked：`identity.commandSucceeded=true`、`probeReady=true`、`validIdentityCount=0`、`formalIdentityAvailable=false`；required toolchain（codesign／xcrun／xcrun codesign）ready，signed-canary source config ready，但 formal signing false；notarization credential absent，故沒有建立 candidate 或進入 signing／notarization。
  - `ollama list` 的實際唯讀輸出只證明本機工具與兩個 model tag 可見；它沒有證明 model 品質、Ollama UI、Seatbelt deny-network、全機 egress、signed／notarized package、Windows、LM Studio 或 FR-021 overall。`docs/project-management/03-FUNCTIONAL-DESIGN.md:5-7` 與 `07-DEBUG-AND-FIX-HISTORY.md:3-8` 對此 scope 限定一致。
  - final closeout gate `npm run docs:check:final` exit 1，明確報告最新工作紀錄缺少「獨立審查是否執行：」與「發布授權：」、狀態尚未「完成」、且審查欄位必須為是／否；這是目前唯一明確的治理 closeout blocker，未由本審查代理修補。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：
  - `GOV-PREREQ-R1-01`（P1，治理 blocker）：current `08-CHANGE-LOG.md` 最新條目仍為「進行中」，缺少本輪獨立審查／發布授權欄位，且 `npm run docs:check:final` exit 1；主要代理須自行補齊 08 closeout、掛上本報告與逐字引用，並重跑 final docs gate，審查代理不得代改 08。
  - `P2-PREREQ-R1-02`（非現有 immutable evidence 失真）：validator 對 `validIdentityCount`／`formalIdentityAvailable`／`formalSigningReady` 的衍生欄位缺少交叉一致性檢查；應由主要代理評估補 source regression，直到補強前不得把 validator 的 schema pass 解讀為可接受任意矛盾 derived fields。
- 剩餘風險：
  - readiness evidence 只證明 current macOS arm64 toolchain／source seam／外部 identity／credential current state；`validIdentityCount=0`、credential absent 與 `formalSigningReady=false` 是目前環境 blocker，不是 signed package failure 的 renderer diagnosis。
  - dirty worktree 只保存 boolean 與指定檔案 digest，不保存所有 dirty file contents；source config ready 不等於 identity、effective entitlements、signing、notarization、Gatekeeper、renderer 或 UI acceptance ready。
  - `/usr/bin/sandbox-exec`、Ollama 與預裝 model 的存在性只支持 bounded local capability；不得擴稱 Seatbelt offline、全機 egress、signed／notarized、Windows、LM Studio 或 FR-021 overall。
- 給主要開發代理的具體修正要求（若有）：完成 `08-CHANGE-LOG.md` 的本輪治理 closeout 並使 `npm run docs:check:final` 通過；另評估將 next1 immutable evidence 納入 focused fixture／或明確保存 next1 validator regression，並補 derived-field consistency 的 fail-closed assertions。不得覆寫本報告或本輪 evidence。
- 可逐字引用完整結論句：**本輪 `FR-021-PREREQ-20261029-READINESS-RECHECK-NEXT1` round1 獨立複審結論為有條件通過：current macOS arm64 readiness evidence schema／source provenance／privacy／0600 immutable hash 均核對成立，required toolchain 與 signed-canary source config ready，但 identity probe 雖成功仍為 `validIdentityCount=0`、`formalIdentityAvailable=false`，11 個 credential presence flags 全 false、notarization 為 absent，故 status `blocked-external-signing-identity` 正確；唯讀 capability recheck 只確認 sandbox-exec、Ollama 與預裝 `llama3.2:3b`／`llama3.2:1b` 存在，不得擴稱 signed、Seatbelt offline、全機 egress、UI、Windows、LM Studio 或 FR-021 overall pass；因 current 08 條目仍為「進行中」且 `npm run docs:check:final` exit 1，主要代理完成 08 closeout 前本輪不得判定為無條件通過，另保留 validator derived-field consistency 與 focused test 未直接鎖定 next1 的 P2 residual。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
