# 獨立審查報告：signed canary post-build verification contract

- 審查對象 commit／版本：\`HEAD\` \`codex/0.51-anthropic-claude\`；工作樹含既有未提交變更，本報告只審查指定五項範圍
- 對應 08-CHANGE-LOG 條目：2026-10-29 — signed canary post-build verification contract（\`FR-021-DEBUG-20261029-SIGNED-CANARY-POST-AUDIT\`）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-29 10:56:43 +0800；獨立審查上下文，先讀 repo \`AGENTS.md\`、\`offline-subtitle-factory-app/AGENTS.md\`、\`docs/project-management/README.md\`、\`00-CURRENT-STATUS.md\`、最新 \`08-CHANGE-LOG.md\` 與獨立審查流程，未沿用主要開發代理對本輪品質的評價
- 審查範圍：\`lib/macos-signed-canary-verification.mjs\`、\`scripts/audit-macos-signed-canary-result.mjs\`、\`scripts/test-macos-signed-canary-result.mjs\`、\`package.json\`、\`docs/project-management/08-CHANGE-LOG.md\` 最新條目；未審查範圍外的既有程式、evidence 或 reviews，也未修改它們
- 執行限制：未啟動 packaged app，未執行 signing、notarization、\`stapler\`、\`spctl\`、network 或 OS policy；只執行 Node syntax、純 classifier、治理 validator、文件檢查與 whitespace 檢查

## Finding 摘要

- F-01（P1，高）：Team ID 一致性不是 evaluator 的強制自洽條件，可能把不一致的 code objects 判為 ready。
- F-02（P1，高）：\`entitlementsPresent\` 被計算與保存但未納入 ready gate，缺少 effective entitlements 仍可能通過。
- F-03（P1，高）：stapler／Gatekeeper 輸出分類過度依賴寬鬆文字 heuristic，malformed 或截斷的 status-0 output 可能被判為成功。
- F-04（P1，高）：package 共用 mac build 設定移除明確 \`identity: null\`，改變既有 \`electron:build:mac:dir\`／\`electron:build:mac\` 的簽章邊界，與本輪 changelog 宣稱既有 development path 不變不一致。
- F-05（P1，高）：evidence 仍保存實際 helper entry／unexpected name 與未限制的 bundle version，未完全符合「固定分類／boolean／digest／bytes／scope」及 privacy projection 邊界。
- F-06（P2，中）：source provenance 未涵蓋共享 classifier 依賴與 lockfile，且 dirty source 可產生看似可追溯但不完整的 result evidence。
- F-07（P2，中）：evidence schema validator 與 focused tests 未覆蓋完整 exact schema、跨欄位一致性、0600/exclusive-create 與主要負向矩陣。
- F-08（P1，高，流程結案阻擋）：最新 changelog 仍為「進行中」，尚未記錄本輪實際驗證、獨立審查鏈結／逐字結論、final docs gate 與剩餘風險。

## 逐項 Finding

### F-01 — Team ID consistency 可被繞過

- 嚴重度：P1／高
- 位置：\`lib/macos-signed-canary-verification.mjs:149-152\`
- 證據：\`evaluateSignedCanaryVerification()\` 在未提供 \`teamIdentifiersConsistent\` 時只檢查每個 object 的 \`teamIdentifierPresent\`，沒有比較 Team ID 值；若呼叫者提供 \`teamIdentifiersConsistent: true\`，更直接信任外部 boolean。實際純函式 probe（未呼叫任何 macOS tool）輸出：\`{"inconsistentWithoutOverride":true,"inconsistentWithTrueOverride":true,...}\`；兩個 object 使用不同 \`TeamIdentifier\` 仍為 ready。
- 影響：不一致、缺乏可驗證來源或被錯誤摘要的 Team ID 可能被誤判為簽章驗證通過，直接削弱本輪要求的「Team ID present／consistent」與 malformed summary fail-closed 邊界；audit CLI 目前另行計算 boolean，不能消除共用 evaluator 本身的錯誤契約。
- 修正建議：讓 evaluator 只接受經明確 schema 驗證、由每個 code object 的內部 probe 重算且不可被任意 override 的一致性結果；至少拒絕 \`null\` fallback、要求 exact boolean 與 object cardinality／來源摘要一致，並加入不同 Team ID、空值、\`not set\`、缺欄位與 spoofed \`true\` regression。

### F-02 — effective entitlements presence 未進入 ready gate

- 嚴重度：P1／高
- 位置：\`lib/macos-signed-canary-verification.mjs:121-131\`、\`lib/macos-signed-canary-verification.mjs:56-68\`
- 證據：\`classifyEntitlements()\` 產生 \`present\`，\`inspectCodeObject()\` 也把它帶入 \`codeSign.entitlementsPresent\`，但 \`codeObjectReady()\` 只要求 \`entitlementsCommandSucceeded === true\`，完全沒有要求 \`entitlementsPresent === true\`。純函式 probe 將全部 objects 的 \`entitlementsPresent\` 設為 false，結果仍為 \`true\`。
- 影響：\`codesign -d --entitlements :-\` 成功但沒有有效 plist／dict 的 code object 仍可使 post-build result ready；這不符合 changelog 目標中對每個 object 的 effective entitlements 核對，並可能把「命令成功」誤稱為「entitlements 已驗證」。
- 修正建議：明確定義空 entitlements 是否合法；若本輪要求有效 effective entitlements，ready gate 應要求 \`entitlementsPresent === true\` 並驗證允許的 plist 結構／必要 hardened-runtime entitlement。若空集合合法，應改存明確的 allowlisted empty state，而不是只以 command exit 0 通過，並補 missing／empty／malformed／unexpected entitlement cases。

### F-03 — stapler／Gatekeeper output classification 過寬

- 嚴重度：P1／高
- 位置：\`lib/macos-signed-canary-verification.mjs:71-103\`
- 證據：\`classifyStapler()\` 只要 status 0 且文字包含 \`staple\`、\`ticket\`、\`valid\` 或 \`worked\` 且不含少數拒絕字串即回傳 \`valid\`；\`classifyGatekeeper()\` 對 status 0 只要沒有拒絕字串即回傳 \`accepted\`，沒有正向 success marker。純函式 probe 實際輸出：\`classifyStapler({status:0,stdout:'ticket'}).status === 'valid'\`、\`classifyGatekeeper({status:0,stdout:'assessment completed'}).status === 'accepted'\`。
- 影響：截斷、非預期、wrapper 誤報或未包含完整 Apple 診斷的 status-0 output 可能被誤分類為成功；這不符合「fixed success classification」與 malformed／partial summary fail-closed 要求。尤其 Gatekeeper 分類目前把「沒有已知 rejection」當成 acceptance。
- 修正建議：以 command exit status 加上明確、版本容忍但 allowlisted 的成功輸出形狀／欄位完成分類；未知、空白、截斷、矛盾或只含 generic text 一律 \`invalid\`／\`rejected\`。補 status 0 empty／generic、stderr error、mixed success+failure、status non-zero with success-looking text 與已知 Apple output fixtures。

### F-04 — shared mac build config 改變既有 development／unsigned path

- 嚴重度：P1／高
- 位置：\`package.json:43-45\`、\`package.json:170-190\`；對應 diff 移除原有 \`identity: null\`，並將 \`hardenedRuntime\`／\`gatekeeperAssess\` 設為 true
- 證據：本輪新增 \`electron:build:mac:signed-canary\` 之外，既有 \`electron:build:mac:dir\` 與 \`electron:build:mac\` 仍使用同一個 \`build.mac\`；移除明確 \`identity: null\` 後，若環境出現可用 identity，既有命令可進入 electron-builder 的 auto-discovery signing path，且共用 hardened／Gatekeeper 設定已改變。最新 changelog:9 又宣稱既有 unsigned／development build 命令不變。
- 影響：現有開發／目錄 build 可能在外部 identity 出現後意外簽章或改變 Gatekeeper 行為；這擴大了本輪 future signed-canary contract 的作用範圍，也讓既有命令與 changelog／scope 不一致。
- 修正建議：保留既有 development／unsigned config 的明確語意，為 signed-canary 使用獨立 electron-builder config 或僅由新命令注入 formal signing 設定；以 config-level tests 固定既有命令不會自動使用 identity，並在 changelog 明確記錄若需求方刻意接受此行為改變。

### F-05 — evidence projection 仍保存未 allowlist 的 candidate metadata

- 嚴重度：P1／高
- 位置：\`scripts/audit-macos-signed-canary-result.mjs:125-127\`、\`scripts/audit-macos-signed-canary-result.mjs:160-172\`、\`scripts/audit-macos-signed-canary-result.mjs:99-108\`
- 證據：script 將 Frameworks 目錄中的全部 \`.app\` basename 放入 \`frameworkAppEntries\`，並將 \`missingHelperBundleNames\`／\`unexpectedHelperBundleNames\` 寫入 evidence；同時直接保存 Info.plist 的 \`CFBundleShortVersionString\`。validator 只做少量 path／secret regex，沒有對這些欄位做 fixed-name／safe-version exact allowlist。這與最新 changelog:9 所寫的「只保存 boolean／固定分類／digest／bytes／scope」不完全一致。
- 影響：非預期 helper basename、候選 metadata 或惡意／異常 bundle version 可被寫入 immutable evidence；目前沒有 raw output／Team ID 落盤是正面邊界，但不能因此把任意 candidate-derived text 視為已完成 privacy projection。
- 修正建議：evidence 只保存 expected/missing/unexpected 的布林與數量，或只保存固定 allowlist 名稱；unexpected names 以 count／digest 表示，禁止原文字串。\`bundleVersion\` 應限於明確 semver／固定版本格式，異常值 fail-closed；測試應注入 path-like、secret-like、長字串與 Unicode metadata。

### F-06 — source provenance 不完整

- 嚴重度：P2／中
- 位置：\`scripts/audit-macos-signed-canary-result.mjs:87-96\`、\`scripts/audit-macos-signed-canary-result.mjs:178\`
- 證據：\`sourceRevision()\` 只保存 \`gitHead\`、dirty boolean、audit script／verification module／package JSON 三個 hash；實際行為還依賴 \`summarizeSourceBuildConfig()\` 所在的 \`scripts/audit-macos-signing-readiness.mjs\`、\`package-lock.json\`／Node toolchain 與其他 imported source，但這些沒有納入 provenance。validator 也只驗三個 hash 的格式，未驗 \`gitHead\`、dirty state 或 dependency hashes 的 exact schema。
- 影響：dirty worktree 下可產生具有部分 hash 的 result evidence，後續無法完整重建當時的 source classifier／dependency context；在簽章合規結果中，這會削弱「結果對應哪一份 source」的可追溯性。
- 修正建議：建立 exact provenance allowlist，至少納入所有影響分類的 imported source、\`package.json\`／lockfile、Node／tool version contract，驗證 git SHA 格式、dirty state 與各 hash cardinality；若 dirty source 不允許作正式 evidence，應直接 fail-closed 或明確標成 non-authoritative。

### F-07 — schema／test coverage 尚不足以保證 fail-closed

- 嚴重度：P2／中
- 位置：\`scripts/audit-macos-signed-canary-result.mjs:99-109\`、\`scripts/test-macos-signed-canary-result.mjs:39-85\`、\`package.json:31-32\`
- 證據：\`validateEvidence()\` 只驗 schema 字串、\`summary.ready\`、三個 hash、scope 中現有值全為 false 與一個 leakage regex；未驗 exact top-level／nested keys、\`status === summary.ready\`、inventory cardinality、object labels、stapler／Gatekeeper enum、candidate field types、scope key allowlist 或 mode 0600。focused test 只有 ready、ad-hoc、missing helper、non-Developer-ID、entitlement command failure、stapler、Gatekeeper、source mismatch cases，且 source-string assertions 只檢查幾個 regex；沒有覆蓋 F-01～F-06 的負向情境，也沒有真正執行 audit CLI 生成／拒絕 evidence。
- 影響：未來欄位漂移、缺欄位、矛盾摘要、弱輸出分類、privacy projection 或檔案權限回歸，可能在 \`npm test\` 中不被捕捉。
- 修正建議：補 exact schema validator 與 deterministic fixture matrix；加入 inconsistent Team IDs、missing/empty entitlements、malformed/partial command outputs、unexpected helper metadata、unknown keys、scope missing/extra key、status mismatch、0600、exclusive-create 與 output path boundary tests。若不能執行真實 macOS tool，至少對 command-result adapter 使用 fixtures，並保留禁止執行 packaged/signing/network 的測試界線。

### F-08 — latest changelog 尚未完成本輪 process closeout

- 嚴重度：P1／高（流程結案阻擋，不代表產品執行已被宣稱成功）
- 位置：\`docs/project-management/08-CHANGE-LOG.md:3-20\`
- 證據：最新條目狀態仍為「進行中」，目前只列計畫、預計影響與驗證計畫；尚未列本輪實際驗證結果、審查報告路徑、逐字單句結論、開發驗證／final closeout、發布授權欄位與剩餘風險。這違反 \`workflows/04-INDEPENDENT-REVIEW.md\` 對獨立報告鏈結與 \`AGENTS.md\` 對 final docs gate 的結案要求。
- 影響：即使程式問題修正，工作項目仍不可標為完成；主要代理若未補齊 closeout，\`docs:check:final\` 不應被視為已通過，且後續 reviewer 無法從最新條目追溯本輪結論與條件。
- 修正建議：先處理 P1 findings 並重跑受影響 focused／full checks，再在本條目補實際結果、此報告固定路徑與完整單句結論、獨立審查是否執行、發布授權（不適用亦須明載）、剩餘風險，最後執行 \`npm run docs:check:final\`；不得修改本報告原文，若結論改變需建立 round2。

## 六面向核對

### 1. 需求完整性

- 判定：部分通過／不通過結案。
- 證據：已有主 app、Framework、四個 helper 的 exact label／inventory、Developer ID／runtime／stapler／Gatekeeper classifier 與 read-only audit CLI；但 F-01～F-03 使 Team ID、effective entitlements、Apple output success boundary 未真正 fail-closed，F-05 也未完全符合 changelog 所載 privacy projection，F-04 改變 shared build path。

### 2. 邏輯正確性

- 判定：不通過。
- 證據：純函式 probe 實際得到不一致 Team ID ready、entitlements absent ready、generic stapler／Gatekeeper output success；因此目前 evaluator 結果不能作為可靠的 post-build acceptance gate。

### 3. 邊界情況

- 判定：不通過。
- 證據：現有測試涵蓋 ad-hoc、missing helper、non-Developer-ID、entitlement command failure、invalid staple、Gatekeeper rejection 與 source mismatch；但未覆蓋 malformed／partial summary、Team ID inconsistency、empty/malformed output、missing entitlements、unknown schema key、unexpected metadata、scope schema 與 output file boundary，且 probe 已證明至少三種弱輸入會 false-pass。

### 4. 程式碼品質

- 判定：部分通過。
- 證據：command invocation 使用絕對路徑／非 shell、raw output 只計算 digest／bytes、exclusive \`wx\` 寫檔與 scope projection 的意圖清楚；但 F-03 heuristic、F-06 provenance 不完整、F-07 validator 過窄與 F-04 shared config coupling 造成可維護性及安全邊界問題。

### 5. 測試覆蓋

- 判定：不通過。
- 證據：2026-10-29 10:56:43 +0800 執行 \`node --check lib/macos-signed-canary-verification.mjs\`、兩支新增 script syntax check、\`node scripts/test-macos-signed-canary-result.mjs\`，focused contract exit 0；但其 matrix 未捕獲 F-01～F-03。同期 \`node scripts/test-project-docs-validator.mjs\`、\`npm run docs:check\`、\`git diff --check\` 均 exit 0；這些通過不能替代缺少的 signed-result negative tests。另以純 classifier probe 驗證上述 false-pass，未啟動 macOS tools。

### 6. 實際運行結果

- 判定：部分通過，不能作 signed result acceptance。
- 證據：本輪遵守限制，沒有執行 audit CLI，因其會呼叫 \`codesign\`、\`xcrun stapler\` 與 \`spctl\`，而使用者明確禁止 signing/notarization/OS policy 操作；因此沒有 packaged candidate 的實際 post-build result。可重現的 deterministic classifier test 通過，但不能證明 real \`codesign\`／stapler／Gatekeeper output 在這些 heuristic 下安全分類。

## 綜合判定

- 結論：**本輪 \`FR-021-DEBUG-20261029-SIGNED-CANARY-POST-AUDIT\` round1 審查不通過：雖然 inventory、去敏 digest／bytes、exclusive evidence write、syntax／focused contract／治理 validator／docs check 均有可追溯基礎，但 Team ID consistency、effective entitlements、stapler／Gatekeeper output classification、shared mac build scope、privacy projection、source provenance 與 negative test／process closeout 尚未達到本輪要求的 fail-closed post-build verification contract，修正並重跑受影響驗證及 final docs gate 前不得宣稱本工作項目完成，也不得宣稱 signed／hardened package、實際 notarization、Gatekeeper、renderer／UI／AI／Ollama／model／network acceptance 或 FR-021 整體完成。**
- 阻擋問題：F-01、F-02、F-03、F-04、F-05、F-08；F-06、F-07 為必須在同輪修正或明確降級範圍並記錄的 residual/process gaps。
- 剩餘風險：本輪未執行真實 signed candidate、codesign、stapler、spctl、notarization、packaged app、renderer/UI、AI/Ollama/model、network 或 OS policy；即使上述 contract 修正，也只能表示 post-build verification contract 通過，不能取代外部 Developer ID identity／credential 與實際候選驗收。
- 給主要開發代理的具體修正要求：依 F-01～F-07 修正 classifier、shared config、privacy/provenance schema 與 focused tests；保留本 round1 原件；修正後以 round2 新報告複審，不覆寫本檔；最後補齊 F-08 的 \`08-CHANGE-LOG.md\` closeout 並執行 \`npm run docs:check:final\`。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、唯讀指令、純 classifier 驗證與文件／syntax／治理檢查，未修改任何其他專案檔案。
- 本報告建立於固定路徑 \`docs/project-management/reviews/2026-10-29-fr-021-signed-canary-post-audit-round1.md\`；同名報告在審查開始時不存在。
- 若上述聲明不實，本報告無效。
