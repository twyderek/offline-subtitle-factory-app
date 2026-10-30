# 獨立審查報告：FR-021 signed canary／notarization prerequisite preflight

- 審查對象 commit／版本：`c06d15e95a2f0a0981518c5873003a460e57a5ee`／package version `0.52.0`；工作樹為 dirty，未將既有變更視為本輪修改。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — signed canary／notarization prerequisite preflight（`FR-021-DEBUG-20261029-SIGNED-CANARY-PREFLIGHT`）。
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-29T02:27:17Z；獨立上下文，依 `npm run project:preflight -- --type=debug` 列出的核心／debug 路由文件、目前 source、audit8、focused test、本地 electron-builder 26.17.0 source 與實際指令結果審查，未沿用主要開發代理的評價性結論。

## 1. 需求完整性

- 判定：部分通過
- 證據：本輪 audit helper 新增 `summarizeNotarizationCredentialState()`（`scripts/audit-macos-signing-readiness.mjs:218-245`），主流程只將 12 個 credential 環境變數轉成 boolean presence（`scripts/audit-macos-signing-readiness.mjs:410-423`），audit8 記錄 `status=absent`、`completeSetCount=0`、`notarizationCredentialReady=false`（`docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit8.json:88-109,162-189`）。
- 證據：六份同步治理文件均明確保留本輪邊界：`00-CURRENT-STATUS.md:3-7`、`03-FUNCTIONAL-DESIGN.md:3-7`、`05-DEVELOPMENT-AND-DEPLOYMENT.md:46-50`、`06-TEST-AND-PROCESS-AUDIT.md:3-7`、`07-DEBUG-AND-FIX-HISTORY.md:3-7`、`08-CHANGE-LOG.md:3-18`；均未把 preflight 描述成 signed package 或 FR-021 pass。
- 證據：需求要求的主要邏輯均成立：local `app-builder-lib` 26.17.0 `MacTargetHelper.getNotarizeOptions()` 位於 `node_modules/app-builder-lib/out/mac/MacTargetHelper.js:219-254`，Apple ID／API key／keychain profile precedence 與 classifier 一致；keychain path 僅在 profile 存在時附加，故 optional path 語意正確。
- finding F-01：`validateReadinessEvidence()` 對 `credentialPresence` 只檢查「所有現有值為 boolean」（`scripts/audit-macos-signing-readiness.mjs:346`），沒有要求 11 個預期 key 的 exact set；在唯讀記憶體 mutation 測試中，刪除 `APPLE_ID` 或加入未知 `FUTURE_SECRET` 仍可被 validator 接受。修正建議：集中定義 credential key allowlist，要求 exact key set／boolean type，並加入 missing／unknown key regression。
- finding F-02：focused test 宣稱覆蓋 complete／partial／ambiguous／absent，但 `scripts/test-macos-signing-readiness.mjs:55-71` 的 ambiguous case 是 keychain profile complete 加 API key complete，沒有直接測試「一個 complete set + 另一個 partial set」。修正建議：新增 Apple ID complete + API key partial、或 keychain profile complete + API key partial 的 composite case，固定 `status=ambiguous` 且 `ready=false`。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：本地 electron-builder 26.17.0 source 明確先處理 Apple ID／password 任一存在（`MacTargetHelper.js:221-235`），再處理 API key 三件組（`MacTargetHelper.js:236-244`），最後只在 `APPLE_KEYCHAIN_PROFILE` 存在時建立 keychain options，`APPLE_KEYCHAIN` 僅作 optional path（`MacTargetHelper.js:245-254`）。本輪 classifier 的 Apple ID／API key／keychain 分組與這個 precedence 相符，且對 partial／multiple complete／complete+partial 都以 `ready=false` fail-closed。
- 證據：獨立唯讀 matrix 實測結果為：Apple ID complete → `complete`, `ready=true`；API partial → `partial`, `ready=false`；complete+partial → `ambiguous`, `ready=false`；multiple complete → `ambiguous`, `ready=false`；keychain profile only → `complete`, `ready=true`；keychain path only → `partial`, `ready=false`；absent → `absent`, `ready=false`。
- 證據：`classifyReadiness()` 先要求 provenance、identity probe、existing evidence、toolchain，再要求 `identity.formalIdentityAvailable`，最後才可能回傳 `formalSigningReady=true`（`scripts/audit-macos-signing-readiness.mjs:275-323`）；audit8 的 `validIdentityCount=0`、`formalIdentityAvailable=false`、`formalSigningReady=false` 與 `blocked-external-signing-identity` 一致。
- finding F-03：`validateReadinessEvidence()` 只驗證 notarization 欄位型別與 `ready === (status === 'complete')`（`scripts/audit-macos-signing-readiness.mjs:344-355`），沒有重算 `completeSetCount`／status，也沒有要求 `decision.notarizationCredentialReady === notarization.ready`。唯讀 mutation 實測將 notarization 改成 complete 但保持 decision false 時仍可通過 validator。修正建議：由 `credentialPresence` 重新計算 classifier，要求 evidence summary 與 decision 的關聯欄位完全相等；對當前 schema 不應允許省略 notarization block。

## 3. 邊界情況

- 判定：部分通過
- 證據：keychain profile optional path 邊界已由本地 builder source 與 classifier 對照；`APPLE_KEYCHAIN_PROFILE=true`、無 `APPLE_KEYCHAIN` 被判為 complete，`APPLE_KEYCHAIN=true`、無 profile 被判為 partial，符合 `getNotarizeOptions()` 的實際行為（`MacTargetHelper.js:245-252`；`scripts/audit-macos-signing-readiness.mjs:225-227`）。
- 證據：Apple ID 缺任一欄位、API key 缺 issuer、keychain 只有 path、完全 absent、兩套 complete、complete 加另一套 partial 的唯讀輸出均保持 `ready=false`，沒有把 partial 或 ambiguity 當成 notarization-ready。
- 證據：audit8 的所有 scope flags 均為 false（`docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit8.json:172-186`），且 `interpretation` 明確說明 credential status 只記錄 presence、不證明 credential validity、不呼叫 notarytool（同檔:188）。
- finding F-04：`validateReadinessEvidence()` 的 schema 不是 exact object contract，且 leakage guard 只阻擋固定片段（`/Users/`、`/private/`、`/tmp/`、`/var/folders/`、`/Volumes/` 等；`scripts/audit-macos-signing-readiness.mjs:357-358`）。唯讀 mutation 對未知欄位加入 `/opt/credential`、`/Applications/Foo.app` 或 `/Library/Keychains/foo` 時仍可通過。當前 audit8 本身沒有這些內容，但若此 validator 是 evidence privacy 的 fail-closed gate，應以 exact schema／unknown-key rejection 消除此邊界。

## 4. 程式碼品質

- 判定：部分通過
- 證據：credential classifier 是小型 pure function，狀態轉換集中且易讀（`scripts/audit-macos-signing-readiness.mjs:218-245`）；主程式只讀 `process.env[name]` 的 boolean，不將 credential value 傳給 `run()`，而 `run()` 的 child environment 只保留 PATH（同檔:64-78、410-423），沒有呼叫 notarytool 或保存 raw output。
- 證據：evidence 寫入前執行 `validateReadinessEvidence()`，且以 `flag: 'wx', mode: 0o600` 建立 exclusive output（`scripts/audit-macos-signing-readiness.mjs:455-456`）；audit8 的 provenance hash 與目前 source／package／focused test 一致，scope、leakage、0600 guard 均通過。
- 證據：package mac config 省略 identity 並設定 `hardenedRuntime=true`、`gatekeeperAssess=true`（`package.json:168-188`）；這與本輪「source config ready 但無 identity」的文件敘述一致，沒有新增 entitlements 或 keychain mutation。
- finding F-01／F-03／F-04 顯示 validator 的資料合約、關聯一致性與 privacy allowlist 仍比 classifier 本體寬鬆。修正建議同前述：共用 credential key／scope schema 常數、拒絕未知欄位、重算衍生欄位並為所有 fail-closed 分支補 deterministic assertions。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：`node scripts/test-macos-signing-readiness.mjs` 於 2026-10-29T02:27Z exit 0，輸出 `macOS signing readiness focused contract passed: identity failure, malformed output, toolchain gate, provenance and privacy fail-closed cases`；測試也固定 audit8 identity／source config／notarization absent 結果（`scripts/test-macos-signing-readiness.mjs:16-39`）。
- 證據：`npm run check` 於本輪 exit 0，包含 `npm run docs:check`、所有 syntax checks、`npm test`、focused signing-readiness test 與 YouTube posttest；實際輸出包含 governance validator、Ollama offline contract、signing readiness focused contract、核心回歸與 YouTube suites 全部通過。
- 證據：`node scripts/test-project-docs-validator.mjs` exit 0，輸出治理文件驗證器測試通過；`git diff --check` exit 0。
- 證據：`npm run docs:check:final` 於報告建立後 exit 1；validator 明確回報最新 08 工作紀錄尚缺「獨立審查是否執行：」與「發布授權：」、狀態仍為「進行中」，且該欄位尚未為是／否。這是主要代理尚未完成治理 closeout 的現況，不是本審查代理修改治理文件的授權。
- 證據：獨立 audit8 invariant command exit 0，確認 status `blocked-external-signing-identity`、`validIdentityCount=0`、`formalSigningReady=false`、notarization `absent`、`notarizationCredentialReady=false`、scope all false、三份 provenance hash 一致、leakage false、mode `600`。
- finding F-02／F-03／F-04：現有 focused tests 沒有固定 complete+partial composite、credential key omission／unknown key、notarization summary／decision mismatch 或 `/opt` 類絕對路徑的負向案例。這不使當前 audit8 失真，但不足以證明 validator contract 已對所有要求的污染型輸入 fail-closed。

## 6. 實際運行結果

- 判定：通過
- 證據：`npm run project:preflight -- --type=debug` exit 0，確認本輪只讀 debug 路由；本地 `app-builder-lib` 26.17.0 source review 只讀完成，未執行 packaging、codesign、notarytool、keychain 或 packaged app。
- 證據：audit8 實際記錄 required toolchain／source config／provenance／privacy ready，但 `identity.validIdentityCount=0`、`identity.formalIdentityAvailable=false`、`decision.formalSigningReady=false`、`decision.status=blocked-external-signing-identity`（`docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit8.json:66-86,162-170`）。因此 credential preflight 沒有錯誤宣稱 notarization-ready，signed canary 仍被 0 identity 阻止。
- 證據：audit8 的 `scope` 明確全 false，包含 signing、notarization、network、packaged app、UI、AI、Ollama daemon、model、raw output、absolute path、identity names／hashes、secrets（同檔:172-186）；evidence mode 實測為 `0600`。本輪審查也沒有執行 signing、notarization、packaging、keychain changes、packaged app、renderer／UI、AI／Ollama／model／network acceptance。
- 證據：R-01 仍被文件明確留給後續 signed canary：effective entitlements、actual signing／notarization、renderer／UI／AI／Ollama／model／network acceptance 與完整 FR-021 均未由本輪證明（`00-CURRENT-STATUS.md:5-7`、`03-FUNCTIONAL-DESIGN.md:5-7`、`06-TEST-AND-PROCESS-AUDIT.md:5-7`）。本輪不等同 signed/hardened canary、effective entitlements、notarization 或 FR-021 完成。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 `FR-021-DEBUG-20261029-SIGNED-CANARY-PREFLIGHT` round1 獨立審查有條件通過：electron-builder 26.17.0 notarization precedence、keychain path optional semantics、audit8 去敏 scope／0600／provenance、0 identity fail-closed 與指定 read-only 驗證均成立；但 credentialPresence／notarization decision validator 尚未以 exact schema／關聯一致性 fail-closed，focused test 亦未直接涵蓋 complete+partial composite，因此完成治理 closeout 前須補 validator 與 regression coverage；本輪不等同 signed/hardened canary、effective entitlements、notarization 或 FR-021 完成。**
- 阻擋問題（若有）：有。F-01／F-03／F-04 是 evidence contract 的 fail-closed 完整性缺口，F-02 是需求指定 credential matrix 的 focused coverage 缺口；在主要代理補強 validator 與 regression 前，不建議把本輪宣稱為無條件通過或完成 final docs gate。
- 剩餘風險：本機仍沒有 Developer ID Application identity，`validIdentityCount=0`；尚未取得或驗證實際 notarization credential、effective entitlements、簽章／公證結果，亦未執行後續 signed canary、packaged renderer／UI、AI／Ollama／model／network acceptance。`FR-021` 仍未完成。
- 給主要開發代理的具體修正要求：只在後續代理輪次修正 `scripts/audit-macos-signing-readiness.mjs:346-358` 的 exact credential／notarization／schema／privacy gate，並在 `scripts/test-macos-signing-readiness.mjs:55-131` 補 composite credential、missing／unknown key、derived-field mismatch 與 generic absolute-path negative tests；修正後保留本報告，另建 round2 複審，不覆寫本報告或 audit7／round3 baseline。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
