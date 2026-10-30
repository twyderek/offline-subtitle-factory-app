# 獨立審查報告：FR-021 packaging config readiness

- 審查對象 commit／版本：`c06d15e95a2f0a0981518c5873003a460e57a5ee`／0.52.0；工作樹另含本輪未提交的 package、readiness source／focused test、audit7 與同步文件變更。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — formal packaging source configuration readiness（`FR-021-DEBUG-20261029-PACKAGING-CONFIG-READINESS`）。
- 審查輪次：round2（round1 findings 修正後複審）。
- 審查代理啟動時間、上下文來源：2026-10-29T02:18:44Z（UTC）；本報告由獨立審查上下文建立，未沿用主要開發代理的評價性結論。

## 審查範圍與讀取檔案

本輪只讀審查目前工作樹的 formal macOS packaging source configuration／readiness contract，以及 round1 F-01、F-02、R-01 的修正狀態。未修改既有 source、package、evidence、治理文件或 round1 報告；只新增本報告。保留 round1–round4 與 audit1–audit6 原件不變。

讀取的主要檔案與來源：

- `AGENTS.md`、`docs/project-management/README.md`、固定核心 `docs/project-management/00-CURRENT-STATUS.md`、`docs/project-management/08-CHANGE-LOG.md`，以及 full preflight 列出的 `01`–`07`、`09` 與 `workflows/01`–`07`。
- `docs/project-management/reviews/2026-10-29-fr-021-packaging-config-readiness-round1.md`。
- `package.json:168-188`；`scripts/audit-macos-signing-readiness.mjs:100-117, 189-215, 245-320, 322-409`；`scripts/test-macos-signing-readiness.mjs:14-104`。
- `docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit6.json:1-183` 與 `...-audit7.json:1-175`。
- current sections in `docs/project-management/00-CURRENT-STATUS.md:3-7`、`03-FUNCTIONAL-DESIGN.md:3-13`、`05-DEVELOPMENT-AND-DEPLOYMENT.md:46-50`、`06-TEST-AND-PROCESS-AUDIT.md:3-13`、`07-DEBUG-AND-FIX-HISTORY.md:3-9`、`08-CHANGE-LOG.md:3-21`；舊日期段落只作歷史關聯，不改寫。
- 本地 `electron-builder@26.17.0` source：`node_modules/app-builder-lib/out/macPackager.js:323-339`、`node_modules/app-builder-lib/out/codeSign/macCodeSign.js:263-278`、`node_modules/app-builder-lib/out/util/flags.js:13-14`。

## 驗證指令與結果

執行時間為 2026-10-29T02:18Z 前後；以下均為唯讀檢查或 deterministic test：

- `npm run project:preflight -- --type=full`：exit 0；列出固定核心與 full 任務路由。
- `node --check scripts/audit-macos-signing-readiness.mjs`：exit 0。
- `node --check scripts/test-macos-signing-readiness.mjs`：exit 0。
- `node scripts/test-macos-signing-readiness.mjs`：exit 0；覆蓋 audit7、auto-discovery／explicit-null／explicit-ad-hoc／hardened false、identity failure／malformed output、toolchain、evidence cardinality／污染、scope／privacy／型別 fail-closed。
- `node scripts/test-project-docs-validator.mjs`：exit 0。
- `npm run docs:check`：exit 0，19 個治理文件通過。
- `npm run check`：exit 0；完整 syntax、deterministic regression、治理檢查與 `npm test`／YouTube posttest 通過。
- `git diff --check`：exit 0。
- `npm run docs:check:final`：exit 1；最新 08 條目尚缺「獨立審查是否執行：」與「發布授權：」、仍為「進行中」，故治理 closeout 尚未完成。
- `shasum -a 256` 與 audit7 交叉核對：audit script、`package.json`、focused test 三個 SHA-256 均相符；audit7 `gitHead` 等於目前 `HEAD`；`status` 與 `decision.status` 相符。
- `git status --porcelain --untracked-files=all -- scripts/audit-macos-signing-readiness.mjs scripts/test-macos-signing-readiness.mjs package.json`：確實列出兩支 untracked script 與 package 修改，證明新的 dirty probe 能看到未追蹤檔案。
- `rg` source scan：目前 readiness source 已無 `/usr/bin/codesign --version` 或 `/usr/bin/productbuild --version`；required gate 仍以 executable presence、`xcrun --find codesign` 與 `toolchainReady` 判定。
- 未執行 signing、notarization、electron-builder packaging、packaged app、renderer／UI、AI、Ollama、model 或 network acceptance；未執行任何會改變 keychain、candidate、既有 evidence 或治理原件的操作。

## 六面向審查 findings

### 1) 功能／需求邊界

- 判定：通過（限 bounded source configuration／readiness contract）。
- `package.json:168-187` 已省略 `mac.identity`，並明確設定 `hardenedRuntime: true`、`gatekeeperAssess: true`。本地 builder source `macPackager.js:328-339` 顯示 `identity === null` 才直接跳過 signing；`macCodeSign.js:263-278` 顯示省略 identity 時可使用 `CSC_NAME` 或 auto-discovery；`flags.js:13-14` 顯示 auto-discovery 預設開啟。
- `summarizeSourceBuildConfig()` `scripts/audit-macos-signing-readiness.mjs:189-215` 將目前 config 判為 `auto-discovery`／`sourceConfigReady=true`，並將 explicit-null、explicit ad-hoc `"-"`、空值與 hardened false 排除；focused test `:30-42` 實際覆蓋這些邊界。
- audit7 `:80-86` 與 decision `:148-155` 一致表示 source seam ready，但 formal signing 仍未 ready。
- Findings：none。

### 2) 安全／隱私／signing semantics

- 判定：通過；正式 signed／hardened canary 仍被外部 identity 阻擋。
- audit7 `:66-78` 保存 `validIdentityCount=0`、`formalIdentityAvailable=false`，且 raw output、identity name／hash 均為 false；`:157-173` 的全 scope false，沒有 keychain、signing、notarization、network、packaged app、UI、Ollama、model 或 secret persistence。
- audit7 `:148-155` 的 `toolchainReady=true`、`sourceConfigReady=true`、`formalSigningReady=false`、`status=blocked-external-signing-identity` 與 identity／source config 相符；`validateReadinessEvidence()` `:295-320` 對 status、scope、credential boolean、existing evidence 與 leakage 做 fail-closed 驗證。
- mode 檢查：audit6 與 audit7 均為 `0600`。audit6 仍存在且未被覆寫；round1 報告原件亦未被覆寫。
- Findings：none。R-01 沒有被錯誤宣稱已完成；effective entitlements 與完整 notarization credential boundary 仍明確保留給後續 signed canary／release preflight。

### 3) 回歸／驗證覆蓋

- 判定：通過（對本輪指定範圍）；不等同 runtime／packaged acceptance。
- `node --check`、focused readiness test、治理 validator、`npm run docs:check`、`git diff --check` 與完整 `npm run check` 均 exit 0。完整 check 沒有執行 signing、notarization、packaged app、UI、AI、Ollama、model 或 network acceptance。
- focused test `scripts/test-macos-signing-readiness.mjs:14-28` 固定讀取 audit7，核對 status、0 identity、toolchain、formalSigningReady、auto-discovery、hardened／Gatekeeper 與 focused-test provenance；`:44-104` 覆蓋 probe、toolchain、evidence、scope、privacy 與型別負例。
- `classifyReadiness()` 的實際唯讀重放返回 `formalSigningReady=false`／`blocked-external-signing-identity`；沒有 identity 時不會進入 `ready-for-isolated-signed-canary`。
- Findings：none。未執行的 signed canary／renderer／UI／AI／Ollama 項目是本輪明確 scope，不可解讀為通過。

### 4) provenance／evidence／文件一致性

- 判定：通過；round1 F-01 已修正。
- audit7 `:21-28` 保存固定 provenance scope `audit-script-package-json-focused-test`、audit script／package／focused test SHA-256、40-hex `gitHead` 與 `workingTreeDirty=true`。實際重算三個 SHA 均與 evidence 相符；目前 untracked source／test script 也由 `git status --porcelain --untracked-files=all` 被觀察到。
- audit7 `:96-146` 仍只引用兩份固定、可驗證、去敏的 immutable existing evidence，且 `existingEvidenceReady=true`；`:148-175` 的 decision／status／scope 與 JSON 及 current docs 相符。audit6 保留為 round1 finding 前原件，未被 audit7 或本輪操作改寫。
- current sections `00:3-7`、`03:3-7`、`05:48-50`、`06:3-7`、`07:3-9`、`08:3-21` 已把 audit7 放在本輪 current conclusion，並把 audit6 作為前一輪 immutable record；較舊日期段落仍保留 audit5／舊 source config 作歷史紀錄，本輪沒有把歷史敘述當作 current evidence。
- round1 F-02 亦已修正：`audit-macos-signing-readiness.mjs:349-367` 的 version probes 僅剩受支援的 `sw_vers`；codesign／productbuild 只做 `commandPresent()` `:351-362`，required toolchain 仍由 `:382-383` 有效判定。
- Findings：none。

### 5) 可維護性／程式碼品質

- 判定：通過（本輪差異範圍）。
- classifier、identity parser、evidence validator 與 source revision producer 分工清楚；focused test 直接匯入並測試 contract，而非只測 CLI 輸出。固定 filename／scope key allowlist、exclusive evidence path、0600 write 與 privacy gate 均維持 fail-closed。
- round1 F-01 的 provenance scope 由程式常數、audit7 欄位與 focused assertion 同步；round1 F-02 的 unsupported probes 已從 source 移除，避免將工具介面錯誤混成版本 provenance。
- Findings：none。後續若要擴大 provenance scope，應以新 schema／新 evidence 與新的 focused assertions 處理，不應把目前三檔 scope 誤擴張為完整工作樹 snapshot。

### 6) release／治理風險

- 判定：有條件通過；不得批准 formal signed／hardened canary 或 release closeout。
- audit7 `:70-75` 的本機 identity probe 為 0 valid identities，`:153-155` 明確為 `formalSigningReady=false`／`blocked-external-signing-identity`；因此 formal canary 仍正確被阻止，需外部核准的 Developer ID Application identity／entitlement 後另立隔離 candidate／immutable evidence。
- R-01 已明確留給後續 canary：後續必須實際核對 effective entitlements、簽章 verification、完整 notarization credential set 與不落盤邊界；本輪 `credentialPresence` 仍不是 notarization-ready 證明，也不是 release authorization。
- `npm run docs:check:final` exit 1 是本輪唯一治理 closeout blocker：主要代理須在 08 條目補本輪 review link／逐字引用、`獨立審查是否執行：是`、非發布工作的 `發布授權：不適用`（或依治理規則填寫適用值），將狀態更新為完成後重跑 final gate。審查代理不代為修改 08。
- Findings：無新的 source／evidence finding；上述 external identity 與 final docs gate 是交付條件，不是已完成的 formal signing 或 release。

## 對 round1 findings 的逐項結論

- F-01 untracked provenance：已修正。`sourceRevision()` `scripts/audit-macos-signing-readiness.mjs:322-336` 改用 `--untracked-files=all`，並以明確 scope 綁定 audit script、package manifest、focused test 三份 SHA-256；audit7 欄位與目前檔案重算一致。此修正不宣稱保存完整工作樹清單，且目前 scope 已清楚限定。
- F-02 unsupported version probe：已修正。原 `/usr/bin/codesign --version`／`/usr/bin/productbuild --version` 已消失；目前只保留 executable presence／`xcrun --find` toolchain gate 與受支援的 `sw_vers` probes。required toolchain gate 仍為 true，audit7 未因移除錯誤版本命令而失去有效的 codesign／xcrun readiness 判定。
- R-01 effective entitlements／完整 notarization credential boundary：未在本輪執行，且正確保留為後續 signed canary／release preflight 條件；沒有被誤報為已通過。這也是本輪不得升級為 signed／hardened canary 或 release 的原因之一。

## 阻擋／條件

- 阻擋 formal signed／hardened canary：audit7 的 `validIdentityCount=0`、`formalIdentityAvailable=false`、`formalSigningReady=false`；取得外部 Developer ID Application identity／entitlement 後，才可另立隔離 canary。
- 阻擋治理 closeout：`npm run docs:check:final` 目前 exit 1，需由主要代理整合本報告後補齊 08 欄位並重新執行 final gate。
- 後續 canary 條件：實際核對 effective entitlements、完整 notarization credentials、簽章／公證驗證與 privacy boundary；保留 renderer sandbox，不使用 sandbox-disabling flags 或放寬 network policy。

## 可逐字引用的完整結論句

**本輪 `FR-021-DEBUG-20261029-PACKAGING-CONFIG-READINESS` round2 獨立複審有條件通過：round1 F-01 的 untracked provenance 已由 `--untracked-files=all`、明確的 audit-script／package／focused-test provenance scope 與三份 SHA-256 一致性修正，F-02 的不受支援 codesign／productbuild version probes 已移除且 required toolchain gate 仍有效；audit7 的 source config、package、focused test、git provenance、existing evidence、status／decision 與 privacy scope 均一致，並正確以 0 valid identities／`formalSigningReady=false` 阻止 formal signed／hardened canary；R-01 的 effective entitlements／完整 notarization credential boundary 明確留給後續 signed canary，本輪不等同 signed／hardened canary、renderer／UI／AI／Ollama、model、network acceptance 或 FR-021 完成，且治理 closeout 仍須補 08 欄位並使 `npm run docs:check:final` 通過。**

## 明確未完成項目

- 本輪不等同 signed／hardened canary：沒有 Developer ID identity，沒有正式 signed candidate，沒有 notarization，也沒有 effective entitlement 對照。
- 本輪不等同 renderer／UI／AI／Ollama／model 或 network acceptance：未執行 packaged app、renderer、UI flow、AI provider、Ollama、model 或 network acceptance。
- 本輪不等同 FR-021 完成：既有 nested Chromium／packaged renderer blocker、真正全機 egress、Windows 與完整 FR-021 驗收仍保留。
- 本輪不等同 release authorization 或治理 closeout：沒有發布資產；`npm run docs:check:final` 在本審查時仍為 exit 1。

## 綜合判定

- 結論：有條件通過（限 round1 F-01／F-02 修正後的 bounded packaging source configuration／readiness contract）。
- 本輪 findings：none；未發現新的 source、privacy、signing semantics、evidence provenance 或 focused/full regression 缺口。
- 阻擋／條件：外部 signing identity 缺失；R-01 尚待後續 signed canary；治理 final docs gate 尚未完成。
- 給主要開發代理的具體修正要求：不修改本報告或 round1 報告；在 08 條目加入本報告路徑與上方完整結論句，補齊獨立審查／發布授權／完成欄位並重跑 `npm run docs:check:final`；取得外部 identity 前維持 formal canary stop，後續另立 signed canary 處理 R-01。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告未修改既有 source、package、evidence、治理文件或 round1–round4／audit1–audit6 原件。
- 若上述聲明不實，本報告無效。
