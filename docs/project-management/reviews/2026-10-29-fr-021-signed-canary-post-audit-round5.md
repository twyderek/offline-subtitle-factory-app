# 獨立審查報告：signed canary post-build verification contract round5

- 審查對象：目前工作樹的 `FR-021-DEBUG-20261029-SIGNED-CANARY-POST-AUDIT`、round1–round4 修正、signed/base config boundary 與 gate execution4。
- 審查上下文：獨立複審上下文；本報告只新增本檔，未修改其他專案檔案、既有 evidence 或既有 review。
- 審查限制：本輪只做讀取、hash／schema／focused test／full check／文件治理檢查；未建立 candidate、未執行 signing、notarization、post-build audit、stapler、spctl、packaged app 或產品 UI flow。

## 驗證命令與結果

- `npm run project:preflight -- --type=debug`：通過；確認固定核心與 debug route，並確認工作樹原有 dirty changes 必須保留。
- `node scripts/test-macos-signed-canary-result.mjs`：exit 0；inventory、Developer ID、runtime、entitlements、stapler、Gatekeeper fail-closed matrix 通過。
- `node scripts/test-macos-signed-canary-gate.mjs`：exit 0；identity、toolchain、source config、notarization credential fail-closed matrix 通過。
- `node scripts/test-macos-signing-readiness.mjs`：exit 0。
- 相關新模組與 scripts `node --check`：exit 0。
- `npm run check`：exit 0；治理文件檢查、完整 npm test、signed-result／signed-gate focused tests 與 YouTube posttest 均通過。
- `npm run docs:check:final`：exit 1；最新 08 條目仍缺少「獨立審查是否執行：」與「發布授權：」，且仍為「進行中」。

## 六面向複審

### 1. 需求完整性

判定：技術範圍通過，治理結案尚未通過。

`lib/macos-signed-canary-verification.mjs` 已要求六個固定 code objects、Developer ID Application authority、非 ad-hoc runtime、Team ID consistency、effective entitlements、固定 stapler 成功分類、Gatekeeper `accepted`／`source=Notarized Developer ID` 與 source config ready；缺少、空白、矛盾或未知輸入均不會轉成 ready。`scripts/audit-macos-signed-canary-result.mjs` 與 focused fixture 已覆蓋 round1–round3 所列 failure cases，包含 helper inventory、candidate metadata、source provenance、leaf types、status／summary consistency、scope pollution 與 privacy leakage。

治理上，`08-CHANGE-LOG.md` 已記錄 round1–round4 與 execution4，但最新條目仍為「進行中」，尚未記錄 round5、獨立審查欄位與發布授權，因此不能宣稱本工作項目已完成 closeout。

### 2. 邏輯正確性

判定：通過，限於 bounded verification contract。

`compareTeamIdentifiers()` 先要求 diagnostics 與 expected digest 均為六段，再以 object-order 對應每段 digest，最後要求各段 TeamIdentifier 非空且一致；focused test 交換 diagnostics 或改變 Team ID 均拒絕。stapler 與 Gatekeeper 分類使用正向 allowlist，並由 validator 重新計算 `status`、`recognizedSuccess`、`recognizedRejection` 與 summary readiness，避免 status 0、generic output 或互相矛盾 flags 造成 false pass。

這些結果只證明 classifier／evidence contract，不證明任何實際 signed package、effective entitlements、notarization、staple 或 Gatekeeper 結果。

### 3. 邊界條件與 fail-closed

判定：通過，限於已執行的 deterministic matrix。

已核對 missing helper、ad-hoc／non-Developer-ID、missing／malformed entitlements、invalid／generic stapler、generic／矛盾 Gatekeeper、wrong platform／arch、timestamp／interpretation type、helper count／complete contradiction、verification status／errorCode contradiction、Apple success／rejection contradiction、summary forgery、source config contradiction、diagnostic permutation 與 scope pollution；各項均以非零 assertion 或 validator rejection 收斂。

候選不存在時，`scripts/audit-macos-signed-canary-result.mjs` 不會以現有 unsigned／ad-hoc candidate 代替 signed fixture，亦不會將缺少候選誤判為驗收通過。

### 4. 程式碼品質與設定邊界

判定：通過；文件有一項非阻斷性措辭可改善。

`electron-builder.signed-canary.mjs` 透過 `lib/macos-signed-canary-build-config.mjs` 複製 manifest build，移除 `mac.identity`，並只在 signed canary config 開啟 `hardenedRuntime`／`gatekeeperAssess`；base `package.json` 仍為 `identity: null`、`hardenedRuntime: false`、`gatekeeperAssess: false`，既有 unsigned／development path 未被改成 formal signed path。`app-builder-lib` 載入 signed config 的唯讀核對也顯示 signed config 與 base config 邊界成立。

`00-CURRENT-STATUS.md` 有「注入 identity auto-discovery」措辭，而實作是移除 explicit identity、由 omission 觸發 auto-discovery；其行為描述沒有造成 signed／base 邊界錯誤，但後續文件整理時應改成「省略 identity 以使用 auto-discovery」以避免語義歧義。

### 5. 隱私、schema 與 cross-field consistency

判定：通過。

result evidence validator 要求 exact top-level／nested keys、固定 ISO millisecond UTC timestamps、darwin／arm64、digest／bytes leaf types、六個固定 object labels、candidate／source config／helper／object／stapler／Gatekeeper／summary／status 的重算一致性與全 false scope。輸出 projection 不保存 raw command output、absolute path、identity name／hash、Team ID 原值、authority、entitlements XML、版本值或 secret；只保存固定分類、boolean、digest 與 bytes。

gate evidence 也使用 exact schema、去敏摘要、privacy leakage guard、exclusive write 與 `0o600`。

### 6. 實際運行結果、證據與文件治理

判定：execution4 證據通過；實際 signed acceptance 與工作項目 closeout 不通過。

execution4 `docs/project-management/evidence/2026-10-29-fr-021-signed-canary-gate-execution4.json` 的 mode 為 `0600`，`gate.ready=false`，原因為 `developer-id-application-not-ready` 與 `notarization-credential-set-not-ready`，`sourceConfigReady=true`、`requiredToolchainReady=true`、`identityReady=false`、`notarizationReady=false`、`notarizationStatus=absent`，且 `runtimeManifestStarted`、`builderStarted`、`candidateCreated` 與全部 scope flags 均為 `false`。

本輪依目前 `scripts/audit-macos-signed-canary-gate.mjs` 的 sourceRevision semantics 重新計算：`gateScriptSha256` 對 `scripts/audit-macos-signed-canary-gate.mjs`、`packageJsonSha256` 對 `package.json`、`focusedTestSha256` 對 `scripts/test-macos-signed-canary-gate.mjs`；execution4 三個 digest 與目前 source 完全一致。因此 round4 所稱 execution3 mismatch 是比較了 `scripts/assert-macos-signed-canary-ready.mjs`／`scripts/test-macos-signed-canary-result.mjs` 等不同角色檔案造成的比較歧義，不能據此推論 execution4 provenance drift；execution3／execution4 的 gate evidence 欄位均應依 audit script 自身 semantics 解讀。

00／05／06／07 的最新相關段落均保留 external identity blocker、base／signed boundary、execution4 或 round1–round4 追蹤與未執行 signing／notarization／candidate／packaged app／UI／AI／Ollama／model／network 的限制；05／06 仍保留較早 build-gate 段落中的 execution2 指標，但該段落描述的是較早 immutable gate record，並未取代其後已記錄的 execution4。最新 08 條目則仍未完成 round5 closeout，這是目前唯一實質治理阻擋。

## 未執行項目與剩餘風險

本輪未執行或未能證明：

- 未取得 Developer ID Application identity；`security find-identity -v -p codesigning` 的外部 blocker 仍為 0 valid identities。
- 未執行 formal signing、notarization credential 使用、notarytool、stapler validate、spctl／Gatekeeper assess 或建立 signed candidate。
- 未執行 `electron-builder` signed candidate build；execution4 在 runtime manifest／builder 前停止。
- 未保存或驗證 effective entitlements、實際 Team ID、authority、staple ticket 或 notarization result。
- 未啟動 packaged app，未執行 renderer／UI／AI／Ollama／model／network／OS policy acceptance。
- 未完成 FR-021 overall；本輪 contract pass 不等同 signed／hardened package、notarization、Gatekeeper 或產品 acceptance。

## 綜合結論

本輪 `FR-021-DEBUG-20261029-SIGNED-CANARY-POST-AUDIT` round5 的六面向技術複審與 execution4 provenance 核對通過且 round4 的 execution3 hash mismatch 係因比較錯誤檔案、但因最新 08-CHANGE-LOG 仍為「進行中」並使 `npm run docs:check:final` 失敗，故只能在不宣稱 signed package、notarization、UI／AI／Ollama／network acceptance 或 FR-021 overall 完成的前提下判定本輪 bounded verification contract 有條件通過、尚未完成治理 closeout。
