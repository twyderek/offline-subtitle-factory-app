# 獨立審查報告：FR-021 packaging config readiness

- 審查對象 commit／版本：`c06d15e95a2f0a0981518c5873003a460e57a5ee`／0.52.0；工作樹另含本輪未提交的 package、source script、test script、audit6 與同步文件變更。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — formal packaging source configuration readiness（`FR-021-DEBUG-20261029-PACKAGING-CONFIG-READINESS`）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-29T02:14:01Z（UTC）；本報告由獨立審查上下文建立，未沿用主要開發代理的評價性結論。

## 審查範圍與讀取檔案

本輪只讀檢查 package macOS signing configuration、readiness classifier／focused regression、authoritative audit6、六份同步治理文件與本地 electron-builder 26.17.0 source contract。保留既有 round1–round4、audit1–audit5 原件不變；未執行 signing、notarization、packaged app、UI、renderer、AI、Ollama、model 或 network acceptance。

讀取的主要檔案與來源：

- `AGENTS.md`、`docs/project-management/README.md`、`docs/project-management/workflows/03-TEST-VALIDATION.md`、`04-INDEPENDENT-REVIEW.md`、`05-DEBUG-FIX.md`、`07-DOCUMENT-CLOSEOUT.md`。
- `package.json:168-188`；`scripts/audit-macos-signing-readiness.mjs:120-145, 189-215, 245-315, 318-406`；`scripts/test-macos-signing-readiness.mjs:14-102`。
- `docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit6.json:1-183`。
- `docs/project-management/00-CURRENT-STATUS.md:3-14`、`03-FUNCTIONAL-DESIGN.md:3-13`、`05-DEVELOPMENT-AND-DEPLOYMENT.md` 的 macOS 打包段落、`06-TEST-AND-PROCESS-AUDIT.md:3-13`、`07-DEBUG-AND-FIX-HISTORY.md:3-7`、`08-CHANGE-LOG.md:3-18`。
- 本地依賴 source：`node_modules/electron-builder/out/builder.js:127-130`、`node_modules/app-builder-lib/out/macPackager.js:323-347`、`node_modules/app-builder-lib/out/codeSign/macCodeSign.js:263-280`、`node_modules/app-builder-lib/out/util/flags.js:13-14`、`node_modules/app-builder-lib/out/mac/MacTargetHelper.js:37-47, 145-177, 219-270`；`npm ls electron-builder --depth=0` 顯示 `electron-builder@26.17.0`。

## 驗證指令與結果

以下均為唯讀驗證，執行時間為 2026-10-29T02:14Z 前後：

- `npm run project:preflight -- --type=debug`：exit 0；固定核心與 debug 路由列出完成。
- `node --check scripts/audit-macos-signing-readiness.mjs`：exit 0。
- `node --check scripts/test-macos-signing-readiness.mjs`：exit 0。
- `node scripts/test-macos-signing-readiness.mjs`：exit 0；涵蓋 identity command failure、malformed output、toolchain gate、auto-discovery、explicit-null、explicit ad-hoc、hardened false、evidence cardinality／污染、scope unknown／sensitive／wrong type 與 privacy fail-closed。
- `node scripts/test-project-docs-validator.mjs`：exit 0。
- `npm run docs:check`：exit 0，19 個治理文件通過。
- `git diff --check`：exit 0。
- package semantic parse：exit 0；`electronBuilder=^26.17.0`、`identity` omitted、`hardenedRuntime=true`、`gatekeeperAssess=true`。
- `stat`：audit6 mode 為 `0600`。
- `npm run docs:check:final`：exit 1；最新 08 條目尚缺「獨立審查是否執行」「發布授權」、仍為「進行中」，因此本報告建立前尚未滿足治理 closeout。

## 六面向 findings

### 1) 功能／需求邊界

- 判定：部分通過；本輪 source-config readiness 範圍成立，正式 canary 範圍未開放。
- 通過證據：`package.json:186-187` 移除 `identity`，並設定 `hardenedRuntime`／`gatekeeperAssess` 為 true。`audit-macos-signing-readiness.mjs:189-215` 將省略 identity 分類為 `auto-discovery`，將 explicit-null、explicit `"-"`、空字串與 hardened false 排除；focused test `scripts/test-macos-signing-readiness.mjs:28-40` 實際固定這些分支。
- 本地 source contract：`macPackager.js:328-330` 對 `identity === null` 直接呼叫 `handleNullIdentity()` 而跳過簽章；`macCodeSign.js:263-278` 先採用 config qualifier 或 `CSC_NAME`，空值時在 auto-discovery 開啟下搜尋 keychain；`flags.js:13-14` 顯示 `CSC_IDENTITY_AUTO_DISCOVERY` 未設為 `false` 時預設開啟。找不到 identity 時 `MacTargetHelper.js:45-47` 回傳 null，`macPackager.js:336-339` 不進入 signing。
- `identity:"-"` 在 `MacTargetHelper.js:37-44` 是 ad-hoc special case；本輪 classifier 將其 `explicit-adhoc` 且 `sourceConfigReady=false`，沒有把 ad-hoc 當 formal identity。
- 邊界：audit6 `:96-122` 的 `sourceConfigReady=true` 只表示 source seam 具備，不表示 identity、signed package、hardened candidate 或 renderer 可用；`audit6:154-183` 明確記錄 0 valid identity、`formalSigningReady=false`、`status=blocked-external-signing-identity`。
- Findings：none（就本輪要求的 package source seam 與 classifier 邊界而言）。

### 2) 安全／隱私／signing semantics

- 判定：通過，但正式簽章能力仍被外部 identity 阻擋。
- 證據：audit6 `:70-95` 只保存 identity count／類別布林與 `rawOutputPersisted=false`、`identityNamesPersisted=false`、`identityHashesPersisted=false`；`audit6:123-153` 的 credentialPresence 只保存 boolean；`audit6:154-183` 所有 scope／secret flags 為 false，且檔案 mode 為 0600。`validateReadinessEvidence()` `scripts/audit-macos-signing-readiness.mjs:295-315` 在寫檔前檢查 status／decision、provenance、scope 與 path／secret leakage。
- audit6 `:123-153` 的 `status` 與 `decision.status` 同為 `blocked-external-signing-identity`；`decision.formalSigningReady=false` 與 `identity.validIdentityCount=0`／`formalIdentityAvailable=false` 一致。
- 未觀察到把 auto-discovery 名稱當成已存在 formal identity、把 ad-hoc runtime flag 當成正式簽章、或把 `identity:"-"` 當成 formal path 的錯誤。
- Findings：none（本輪 audit6 的保存邊界與 signing semantics）。

### 3) 回歸／驗證覆蓋

- 判定：有條件通過；focused regression 覆蓋本輪新增 classifier，但沒有執行完整 `npm run check` 或任何 packaged／signed runtime。
- 證據：`node --check` 兩支 readiness script、`node scripts/test-macos-signing-readiness.mjs`、`node scripts/test-project-docs-validator.mjs`、`npm run docs:check` 與 `git diff --check` 均 exit 0。focused test `:42-102` 對 probe failure、malformed output、toolchain failure、imported evidence pollution、cardinality、scope unknown／sensitive／wrong type 與 privacy fail-closed 做 deterministic assertions。
- 未執行項目：沒有 `npm run check`、electron-builder packaging、codesign、notarytool、packaged app、UI／renderer、AI／Ollama、model 或 network acceptance；這與本輪工作界線一致，不得把未執行解讀為通過。
- Findings：none（就使用者指定的 focused／syntax／docs 驗證範圍而言）。

### 4) provenance／evidence／文件一致性

- 判定：有條件通過。
- 通過證據：audit6 `:26-38` 綁定 source script SHA-256、package SHA-256、40-hex git HEAD 並標示 `workingTreeDirty=true`；`:96-122` 綁定兩份固定既有 evidence 的 filename、SHA-256、bytes、status、summary 與 scope；`:154-183` 的 status／decision／scope 與 package 文件一致。現行同步文件的最上方條目均描述省略 identity、hardened／Gatekeeper true、audit6 與 external identity blocker；00／03／05／06／07／08 中 audit5 的舊設定均位於明確的歷史 audit 段落，沒有被 current conclusion 當成 audit6 結果。
- Finding F-01（P2，非本輪 formal canary 的立即阻擋）：`scripts/audit-macos-signing-readiness.mjs:318-330` 以 `git status --porcelain --untracked-files=no` 計算 dirty state，會忽略 untracked source／test script；實際 `git status --short` 顯示 `?? scripts/audit-macos-signing-readiness.mjs` 與 `?? scripts/test-macos-signing-readiness.mjs`。audit6 雖保存了 audit helper 自身 hash 且 `workingTreeDirty=true`，但沒有保存 focused test script hash，也沒有明確揭露 untracked source 檔案清單。重現：`git status --short -- scripts/audit-macos-signing-readiness.mjs scripts/test-macos-signing-readiness.mjs` 顯示兩筆 `??`，而目前 dirty probe 使用 `--untracked-files=no` 不會列出它們。建議：後續 provenance gate 要嘛納入 untracked source／test 檔案的 hash 與狀態，要嘛明確把 provenance scope 限定為 audit helper＋package，避免把 `workingTreeDirty` 解讀成完整工作樹快照。
- Finding F-02（P2，非 status／decision 一致性的立即阻擋）：`scripts/audit-macos-signing-readiness.mjs:110-117, 358-364` 對 `/usr/bin/codesign` 與 `/usr/bin/productbuild` 執行不受該工具支援的 `--version`；重現命令 `/usr/bin/codesign --version` 回報 `unrecognized option '--version'`，`/usr/bin/productbuild --version` 回報該 option 需要 argument。故 audit6 `:13-27` 的 `environment.codesign`／`productbuild` 是 `commandSucceeded=false`、`value=null`，雖不影響 required toolchain（該 gate 使用 executable presence／xcrun lookup），卻會讓版本 provenance 欄位看似失敗。建議：改用受支援的版本／工具查詢，或移除／重命名這兩個 version 欄位並加 regression，避免 future reviewer 誤把它們當成 toolchain failure。

### 5) 可維護性／程式碼品質

- 判定：部分通過。
- 通過證據：`summarizeSourceBuildConfig()` 是純函式，對 property omission、null、ad-hoc、空字串、非字串與 boolean 設定採明確分類；`classifyReadiness()` 在 provenance、identity probe、evidence、toolchain、identity 與 source config 間採 fail-closed decision order。focused test 直接從 source module 匯入這些 contract，避免只測 CLI 表面結果。
- Findings：採 F-02 作為本面向的主要維護性問題；其餘本輪 classifier／validator 未發現會把拒絕值轉成 formal-ready 的邏輯缺口。

### 6) release／治理風險

- 判定：不批准正式 signed canary；bounded source-config 工作可有條件通過。
- 立即阻擋：audit6 `:154-183` 明確是 `blocked-external-signing-identity`、`validIdentityCount=0`、`formalSigningReady=false`；因此目前不應建立或執行正式 signed／hardened canary。這不是 renderer diagnosis，也不是 FR-021 pass。
- Finding／條件 R-01（P1，後續 release／canary gate）：本輪沒有把 effective entitlements 或 notarization readiness 當作已驗收。`summarizeSourceBuildConfig()` `:207-214` 只把 `entitlementsConfigured` 作為摘要，並不將它納入 `sourceConfigReady`；本地 builder source `MacTargetHelper.js:145-170` 顯示未提供專案 entitlements 時會使用 builder default template，因此「未設定專案 entitlements」本身不是目前 source seam 的錯誤，但後續 signed canary 必須實際核對 app／helper 的 effective entitlements。另 `MacTargetHelper.js:219-268` 顯示 notarization 會依 `APPLE_ID`／`APPLE_APP_SPECIFIC_PASSWORD`／`APPLE_TEAM_ID`、API key 三件組或 keychain profile 自動啟用；audit6 只記錄部分 Apple ID credential presence，沒有覆蓋 `APPLE_API_KEY`、`APPLE_API_KEY_ID`、`APPLE_API_ISSUER`、`APPLE_KEYCHAIN`、`APPLE_KEYCHAIN_PROFILE`。因此 audit6 不得被解讀為 notarization-ready 或 release-authorized；後續應另立 canary／release preflight，完整檢查 effective entitlements、簽章驗證、notarization credentials 的完整性與不落盤邊界。
- 治理條件：`npm run docs:check:final` 在本報告建立前 exit 1，原因是 `08-CHANGE-LOG.md:3-18` 尚缺獨立審查欄位／發布授權欄位且狀態仍為「進行中」。主要代理完成本報告引用、補齊本輪結案欄位後，必須重新執行 final gate；在此之前不得宣稱本工作項目治理 closeout 完成。

## 阻擋／條件

- 阻擋正式 signed／hardened canary：本機 `security find-identity -v -p codesigning` 的 audit6 摘要為 0 valid identities，`formalSigningReady=false`；需在核准的外部 signing environment 取得 Developer ID Application identity，並另立隔離 candidate／immutable evidence。
- 阻擋本輪治理 closeout：08 尚未引用本報告並補「獨立審查是否執行」與「發布授權」欄位；`npm run docs:check:final` 必須重跑並通過。
- 後續 canary／release 條件：實際核對 effective entitlements、保留 renderer sandbox、分離 notarization credentials／notarytool 驗證，不把 auto-discovery、ad-hoc runtime 或未公證結果當正式發布通過。

## 可逐字引用的完整結論句

**本輪 `FR-021-DEBUG-20261029-PACKAGING-CONFIG-READINESS` 獨立審查結論為有條件通過：electron-builder 26.17.0 的省略 identity／`CSC_NAME`／keychain auto-discovery 語意、package 的 hardened runtime／Gatekeeper 設定、explicit-null／ad-hoc fail-closed classifier、audit6 的 status／decision／privacy 與 focused regression 均有目前 source、local dependency source、evidence 與唯讀驗證支持；但本輪不等同 signed／hardened canary、renderer／UI／AI／Ollama 或 FR-021 完成，且 formal canary 仍被 audit6 的 0 valid identities／`formalSigningReady=false` 阻擋，治理 closeout 尚須補 review citation、發布授權欄位與 final docs gate，並應在後續 canary 前補足 untracked provenance、effective entitlements 與 notarization readiness boundary。**

## 明確未完成項目

- 本輪不等同 signed/hardened canary：沒有 Developer ID identity，沒有正式 signed candidate，沒有 notarization。
- 本輪不等同 renderer/UI/AI/Ollama acceptance：沒有執行 packaged app、renderer、UI flow、AI provider、Ollama 或 model。
- 本輪不等同 FR-021 完成：既有 nested Chromium／packaged renderer blocker、真正全機 egress、Windows 與完整 FR-021 驗收仍保留。
- 本輪不等同 release authorization：沒有建立、提交、推送或發布 tag／Release／PR／GitHub asset。

## 綜合判定

- 結論：有條件通過（限 bounded packaging source configuration／readiness contract）。
- 阻擋問題：外部 Developer ID signing identity 缺失；治理 final gate 尚未完成。
- 剩餘風險：F-01 untracked provenance 邊界、F-02 unsupported version probe、R-01 effective entitlements／完整 notarization credential boundary，以及未執行的 signed／hardened、packaged runtime、UI／AI／Ollama／FR-021 驗證。
- 給主要開發代理的具體修正要求：不修改本報告原文；將本報告路徑與上方完整結論句逐字引用至本輪 08 條目，補齊狀態與發布授權欄位並重跑 `npm run docs:check:final`；在外部 identity 取得前維持 canary stop；後續另行處理 F-01／F-02 與 R-01。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告未修改既有 source、package、evidence、治理文件或 round1–round4／audit1–audit5 原件。
- 若上述聲明不實，本報告無效。
