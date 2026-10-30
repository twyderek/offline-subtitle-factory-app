# 獨立審查報告：FR-021 macOS signed-canary current-source signing readiness recheck next5

- 審查對象 commit／版本：local HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b`／0.52.0
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS signed-canary current-source signing readiness recheck next stage（`FR-021-PREREQ-20261029-READINESS-RECHECK-NEXT5`）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-29（Asia/Taipei）；僅依 repo 內 AGENTS.md、治理文件、next5 相關摘要、audit／test source、authoritative evidence 與本輪唯讀指令結果判斷，未以主要代理的評價性摘要作為證據。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-14` 明確限定本輪為 current-source signing／notarization prerequisite read-only audit，要求綁定 HEAD／working tree／audit script／package／focused test provenance、投影 identity／credential derived fields、保存 fail-closed evidence 且不宣稱 signed candidate；`02-REQUIREMENTS-ANALYSIS.md:37,48-54` 與 `00-CURRENT-STATUS.md:3-8` 同時保留 FR-021 overall 與本輪 bounded readiness 的界線，未把本輪 scope 擴大為 runtime acceptance。

## 2. 邏輯正確性

- 判定：通過
- 證據：`next5.json:21-28` 的 `gitHead` 與三個 source hash 以本輪重算值吻合，`git rev-parse HEAD` 亦為 `f16ae8be60fb132bdbb1a128722a244f70f86e6b`；next3／next4 evidence 分別仍綁定舊 `c06d15e95a2f0a0981518c5873003a460e57a5ee`。`audit-macos-signing-readiness.mjs:344-368,518-565,582-613,654-716` 會區分 probe unavailable、identity blocker、source/toolchain/provenance readiness 並重算 derived fields；實際 `validIdentityCount=0`、`developerIdApplicationPresent=false`、`formalIdentityAvailable=false`、credential 三路由均 false／`notarization.status=absent`、`formalSigningReady=false`（`next5.json:66-108,162-170`），因此 `blocked-external-signing-identity` 的 fail-closed 解讀正確。source／toolchain ready 僅是 prerequisite projection，未被當作 signed candidate。

## 3. 邊界情況

- 判定：通過
- 證據：`scripts/test-macos-signing-readiness.mjs:41-115,117-229` 實際覆蓋 malformed／failed identity probe、0 identity、required toolchain failure、source target／identity configuration 變體、credential absent／partial／ambiguous／multiple complete、derived mismatch、matching count 超界、existing evidence 缺失／重複、unknown keys／scope、型別污染、absolute path／secret leakage 與 nested schema tampering；測試 exit 0。`audit-macos-signing-readiness.mjs:671-693` 僅執行 identity／toolchain availability／version read-only probes，未呼叫 builder、codesign signing、notarytool、workflow、UI、Ollama 或 network isolation。

## 4. 程式碼品質

- 判定：通過
- 證據：source 以 allowlist／exact-key schema、固定 evidence filenames、derived-field recomputation、`wx` exclusive writer 與 mode `0600` 實作 bounded contract（`audit-macos-signing-readiness.mjs:48-80,615-650,671-735`）；credential 只投影 boolean presence（`audit-macos-signing-readiness.mjs:484-488`），identity raw output／name／hash 明確固定為 false。authoritative next5 mode 為 `0600`，SHA-256 為 `11312386df77c2bee79accf6f07a055693abeef236c15ea8a13d8b3d2dcc1937`，且 `git diff --check` exit 0；未發現需要主要代理修改 source 的技術 finding。

## 5. 測試覆蓋

- 判定：通過
- 證據：本輪實際執行（2026-10-29）`node --check scripts/audit-macos-signing-readiness.mjs` exit 0、`node scripts/test-macos-signing-readiness.mjs` exit 0（輸出 `macOS signing readiness focused contract passed: identity failure, malformed output, toolchain gate, provenance and privacy fail-closed cases`）、`node scripts/test-project-docs-validator.mjs` exit 0、`npm run docs:check` exit 0、`git diff --check` exit 0；`06-TEST-AND-PROCESS-AUDIT.md:3-7` 的 next5 驗證摘要與上述結果一致。未執行 full `npm run check`、builder 或 signed workflow，符合本輪明確禁止的操作邊界，而非將未執行結果誤報為通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：authoritative `docs/project-management/evidence/2026-10-29-fr-021-prerequisite-readiness-recheck-next5.json:3-28,66-108,162-189` 記錄實際 macOS arm64 read-only audit：toolchain／source config／existing evidence／provenance ready，但 `validIdentityCount=0`、credential absent、`formalSigningReady=false`；scope 的 candidate／keychain／signing／notarization／network／packaged app／UI／Ollama／model／raw output／absolute path／identity／secret flags 全為 false。`00-CURRENT-STATUS.md:3-8`、`05-DEVELOPMENT-AND-DEPLOYMENT.md:3-7`、`06-TEST-AND-PROCESS-AUDIT.md:3-7`、`07-DEBUG-AND-FIX-HISTORY.md:3-7` 均如實同步 next5 與不宣稱 signed candidate 的界線。`npm run docs:check:final` 本輪 exit 1，明確原因是 `08-CHANGE-LOG.md:3-14` 的 next5 條目仍為「進行中」且尚未有「獨立審查是否執行／發布授權」欄位；本輪依使用者限制未修改 08 或其他既有檔案。真實 Developer ID／credential、signed workflow、builder、signing、notarization、Apple ticket、Gatekeeper 與 release 均未執行，故本項不能解讀為 signed runtime acceptance。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 `FR-021-PREREQ-20261029-READINESS-RECHECK-NEXT5` round1 獨立審查結論為有條件通過：current-source readiness audit、source provenance、identity／credential derived fields、privacy／scope／schema 與 00／05／06／07 文件同步均如實且通過，next5 正確綁定 local HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b` 並將 next3／next4 的 `c06d15e95a2f0a0981518c5873003a460e57a5ee` 視為過時；`validIdentityCount=0`、`formalSigningReady=false` 與 credential `absent` 的 fail-closed 解讀正確，未擴大為 signed candidate；條件僅為外部受控 signing environment 尚未提供核准的 Developer ID Application identity／完整 notarization credential，且真實 signed workflow 尚未執行，因此不得宣稱 signed／notarized candidate、Apple ticket、release 或 FR-021 overall acceptance。**
- 阻擋問題（若有）：僅有外部條件：Developer ID Application identity／完整 notarization credential 尚未提供，真實 signed workflow 尚未執行；本輪未發現 source／test technical blocker。
- 剩餘風險：`npm run docs:check:final` 仍反映 08 next5 條目尚未完成治理 closeout；本報告不修改該既有條目。即使外部條件補齊，仍須另行取得真實受控 workflow 的 signing／notarization／ticket／Gatekeeper evidence，且不得把本 bounded readiness report 擴大為 FR-021 overall acceptance。
- 給主要開發代理的具體修正要求（若有）：無 source 技術修正要求；在允許進行治理 closeout 且外部條件具備後，另行重跑真實受控 signed workflow 與相應 evidence／final gate。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
