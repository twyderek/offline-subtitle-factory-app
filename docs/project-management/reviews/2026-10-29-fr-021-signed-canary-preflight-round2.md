# 獨立審查報告：FR-021 signed canary／notarization prerequisite preflight

- 審查對象 commit／版本：`c06d15e95a2f0a0981518c5873003a460e57a5ee`／package version `0.52.0`；工作樹為 dirty，既有變更不視為本輪修改。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — signed canary／notarization prerequisite preflight（`FR-021-DEBUG-20261029-SIGNED-CANARY-PREFLIGHT`）。
- 審查輪次：round2 複審
- 審查代理啟動時間、上下文來源：2026-10-29T02:31:50Z；獨立上下文，依 `npm run project:preflight -- --type=full` 列出的治理核心／路由文件、round1 報告、audit9、current source、focused test 與本地 electron-builder 26.17.0 source 實際唯讀審查。
- 審查範圍限制：未執行 signing、notarization、packaging、keychain、packaged app、renderer／UI、AI／Ollama／model 或 network acceptance；只新增本報告。

## 1. 需求完整性

- 判定：不通過
- 證據：round1 的 F-01 已關閉：`validateReadinessEvidence()` 以 `hasExactBooleanKeys(evidence.credentialPresence, credentialPresenceKeys)` 驗證 credential presence exact key set／boolean（`scripts/audit-macos-signing-readiness.mjs:51-63,463`）；focused test 的 missing `APPLE_ID` 與 unknown `FUTURE_SECRET` 均以 `CREDENTIAL_PRESENCE_SCHEMA_INVALID` fail-closed（`scripts/test-macos-signing-readiness.mjs:140-145`）。
- 證據：F-02 已關閉：focused test 具備 Apple ID complete + API key partial 的 complete+partial case，以及 keychain profile complete + API key complete 的 multiple-complete ambiguous case；結果分別維持 `ambiguous`／`ready=false`（`scripts/test-macos-signing-readiness.mjs:68-78`）。
- 證據：F-03 已關閉：validator 從 `credentialPresence` 重算 `expectedNotarization`，要求 evidence summary 深度一致並要求 `decision.notarizationCredentialReady` 等於 derived `ready`（`scripts/audit-macos-signing-readiness.mjs:463-466`）；focused derived mismatch case 以 `NOTARIZATION_CONTRACT_MISMATCH` fail-closed（`scripts/test-macos-signing-readiness.mjs:146-152`）。
- 證據：F-04 的指定 top-level、credential、scope 與 `/opt/credential`／`/Applications/Foo.app`／`/Library/Keychains/foo` 負例均 fail-closed（`scripts/audit-macos-signing-readiness.mjs:432-470`；`scripts/test-macos-signing-readiness.mjs:153-160`），但獨立變異顯示 `environment.macOSProductVersion`、`toolchain.required.codesign`、`toolchain.optional.productbuild` 等 nested leaf object 加入未知欄位後仍被接受；因此「exact top-level／nested schema」需求尚未完整實現。
- 證據：同一獨立變異將 `interpretation` 設為 `/foo/bar`、`/bin/tool` 或 `/dev/null` 時亦被接受；現行 leakage regex 只涵蓋列舉的敏感根目錄、Windows drive、反斜線與 secret marker，不能宣稱所有 absolute path fail-closed。`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:6` 對 generic absolute-path leakage 的敘述因此超出實際 validator 行為。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：本地 electron-builder `26.17.0` 的 `MacTargetHelper.getNotarizeOptions()` 先處理 Apple ID／app-specific password／team ID（`node_modules/app-builder-lib/out/mac/MacTargetHelper.js:219-235`），再處理 API key／key ID／issuer（同檔:236-244），最後僅在 `APPLE_KEYCHAIN_PROFILE` 存在時回傳 keychain options，`APPLE_KEYCHAIN` 只在 profile 存在時作 optional path（同檔:245-254）。classifier 的 complete／partial／ambiguous 判斷與此 precedence／optional path 語意一致（`scripts/audit-macos-signing-readiness.mjs:325-352`）。
- 證據：local source 的 signing identity lookup 以 qualifier 或 `CSC_NAME`，空值時進 auto-discovery（`node_modules/app-builder-lib/out/codeSign/macCodeSign.js:263-278`）；package config 確實省略 `build.mac.identity`，並設定 `hardenedRuntime=true`／`gatekeeperAssess=true`（`package.json:168-188`）。
- 證據：audit9 的 `credentialPresence` 全為 false、`notarization.status=absent`／`ready=false`（`docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit9.json:88-108`），且 `decision.notarizationCredentialReady=false`；audit9 invariant 實測通過 provenance hash、scope、privacy 與 derived consistency。
- 證據：剩餘邏輯缺口限於 evidence validator contract：container-level exact key checks 存在，但上述 leaf object 未有 exact key／type validator；這不污染目前 audit9，卻使受污染 imported evidence 的 fail-closed 保證不完整。

## 3. 邊界情況

- 判定：部分通過
- 證據：focused test 實際覆蓋 complete、partial、complete+partial、multiple complete／ambiguous、absent、missing／unknown credential key、derived mismatch、unknown top-level key 與指定三種敏感 absolute path；`node scripts/test-macos-signing-readiness.mjs` exit 0。
- 證據：唯讀 mutation 實測確認 missing／unknown `credentialPresence`、notarization derived mismatch、unknown top-level key、`/opt`、`/Applications`、`/Library` 均拒絕；因此 round1 F-01～F-03 及 F-04 的指定案例已關閉。
- 證據：唯讀 mutation 亦確認 generic POSIX absolute path `/foo/bar`、`/bin/tool`、`/dev/null` 被 validator 接受，且 nested leaf unknown field 被接受；這是 F-04 的剩餘 fail-closed 邊界，應補完整 recursive schema allowlist／type checks 與 generic POSIX absolute-path negative cases。
- 證據：`APPLE_KEYCHAIN` path only 仍為 partial／not ready，`APPLE_KEYCHAIN_PROFILE` without path 可為 complete；這與 builder source 的 optional path 行為一致，沒有把 keychain path 本身當 credential。

## 4. 程式碼品質

- 判定：部分通過
- 證據：credential key、evidence container、scope、existing evidence summary 的 allowlist 集中於 `scripts/audit-macos-signing-readiness.mjs:21-147`，`hasExactKeys()`／`hasExactBooleanKeys()` 與 derived summary check 使主要 round1 缺口集中且可讀；process environment 只投影 boolean presence，沒有把 secret value 傳入 child command（同檔:170-184,521-555）。
- 證據：audit evidence 以 exclusive create 與 mode `0600` 寫入（同檔:554-555）；audit9 實測 `stat` 為 mode `600`，且沒有 raw output、secret 或 identity name/hash。
- 證據：品質缺口是 schema allowlist 沒有一路套到 nested leaf object，且 leakage regex 以固定 root list 取代一般 POSIX absolute-path predicate（同檔:456-469）。這使程式表面上集中，但資料合約仍可由未知 leaf field 或非列舉根目錄路徑繞過。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：`node --check scripts/audit-macos-signing-readiness.mjs`、`node --check scripts/test-macos-signing-readiness.mjs`、`node scripts/test-macos-signing-readiness.mjs`、`node scripts/test-project-docs-validator.mjs` 與 `npm run docs:check` 均 exit 0；focused output 為 `macOS signing readiness focused contract passed`。
- 證據：`npm run check` exit 0，包含治理 validator、signing readiness focused contract、Ollama／AI／UI、核心 regression 與 YouTube suites；`git diff --check` exit 0。
- 證據：目前 focused test 已覆蓋 round1 指定的 missing／unknown credential、derived mismatch、unknown top-level 與三種敏感 path，但沒有 nested leaf unknown／missing／type mutation，也沒有 `/foo/bar`／`/bin/tool`／`/dev/null` generic absolute-path negative case；因此無法以測試證明 F-04 全部關閉。
- 證據：本輪沒有新 live signing／notarization／packaging／keychain／packaged app／network 測試，符合本輪 read-only scope；這些不是本輪應補跑的測試。

## 6. 實際運行結果

- 判定：部分通過
- 證據：`npm run project:preflight -- --type=full` exit 0；`npm run check` exit 0；audit9 invariant exit 0，確認 `status=blocked-external-signing-identity`、`validIdentityCount=0`、`sourceConfigReady=true`、`formalSigningReady=false`、notarization `absent`／not ready、scope 全 false、provenance hashes 一致、mode `0600` 且無 secret／raw output／path leakage。
- 證據：audit9 `identity` 記錄 `validIdentityCount=0`、`formalIdentityAvailable=false`（同檔:66-78），`decision` 記錄 `formalSigningReady=false` 與 `blocked-external-signing-identity`（同檔:162-170）；所以 formal canary 仍被 0 identity 阻止，未因 source config ready 或 credential classifier 通過而誤放行。
- 證據：current docs 00／03／05／06／07 對 audit9 的 boundary 均明確保留：本輪不等同 signed/hardened canary、effective entitlements、actual signing／notarization、renderer／UI／AI／Ollama／model／network acceptance 或 FR-021 completion（`docs/project-management/00-CURRENT-STATUS.md:3-7`、`03-FUNCTIONAL-DESIGN.md:3-7`、`05-DEVELOPMENT-AND-DEPLOYMENT.md:46-50`、`06-TEST-AND-PROCESS-AUDIT.md:3-7`、`07-DEBUG-AND-FIX-HISTORY.md:3-7`）。R-01 仍留給後續隔離 signed canary。
- 證據：`npm run docs:check:final` exit 1，因最新 `08-CHANGE-LOG.md` 尚缺「獨立審查是否執行：」與「發布授權：」、狀態未標示完成；本輪依使用者限定未修改 change log 或其他治理文件。這是治理 closeout 尚未完成的現況，不是以 report validator 取代 final gate。
- 證據：本輪未執行 signing、notarization、packaging、keychain、packaged app、renderer／UI、AI／Ollama／model 或 network acceptance；audit9 的 scope flags 亦全為 false（同檔:172-188）。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪 `FR-021-DEBUG-20261029-SIGNED-CANARY-PREFLIGHT` round2 獨立複審結論為不通過：F-01、F-02、F-03 及 F-04 指定的 credential／derived summary／top-level schema／`/opt`／`/Applications`／`/Library` 負例已由 source、audit9 與 focused tests 關閉，但 F-04 的 exact nested schema 與一般 POSIX absolute-path fail-closed 邊界仍未關閉；audit9 仍由 0 identity 阻止 formal canary，本輪不等同 signed/hardened canary、effective entitlements、notarization 或 FR-021 完成。**
- 阻擋問題（若有）：有。F-04 round2 residual：`validateReadinessEvidence()` 未對 environment／toolchain leaf objects 執行 exact key／type allowlist，且 `/foo/bar`、`/bin/tool`、`/dev/null` 等一般 POSIX absolute path 可被接受；另 `npm run docs:check:final` 仍因本輪禁止修改的最新 change-log 未完成而失敗。
- 新 findings：有，均為 F-04 的未關閉邊界（nested leaf unknown schema fields、generic POSIX absolute-path leakage）；F-01～F-03 無新 finding。
- 剩餘風險：未取得 Developer ID identity，`validIdentityCount=0`；effective entitlements、actual signing／notarization、signed／hardened canary、renderer／UI／AI／Ollama／model／network acceptance 與完整 FR-021 仍待後續隔離工作。不得把 audit9 或本報告視為 signed/hardened canary、effective entitlements、actual notarization 或 FR-021 完成。
- 建議後續：由主要代理補齊所有 nested leaf object 的 exact schema／type allowlist，改以一般 POSIX absolute-path predicate 加 Windows path／UNC boundary fail-closed，並新增相應 focused negative tests；修正後保留 round1／audit8／audit7 與本報告，另建 round3 複審，不覆寫歷史原件。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
