# 獨立審查報告：FR-021 signed-canary distribution evidence hardening next stage

- 審查對象：目前 working tree 最新內容；HEAD `c06d15e95a2f0a0981518c5873003a460e57a5ee`、package version `0.52.0`、branch `codex/0.51-anthropic-claude`。
- 對應 08-CHANGE-LOG 條目：`FR-021-MACOS-CI-20261029-DISTRIBUTION-EVIDENCE-NEXT1`。
- 審查輪次：round1；本報告為獨立唯讀審查上下文產物。工作樹原有 dirty state、evidence 與 reviews 均保留。
- 審查範圍：`.github/workflows/macos-signed-canary.yml`、`lib/macos-signed-canary-artifact-selection.mjs`、`scripts/select-macos-signed-canary-artifacts.mjs`、`scripts/audit-macos-signed-canary-distribution.mjs`、`scripts/test-macos-signed-canary-gate.mjs`、`scripts/test-macos-signed-canary-distribution.mjs`、`package.json`、`docs/project-management/00-CURRENT-STATUS.md`、`05-DEVELOPMENT-AND-DEPLOYMENT.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、`08-CHANGE-LOG.md`。
- 唯讀限制：未觸發 GitHub workflow，未執行 `electron-builder`、`codesign`、`notarytool`、`stapler`、`hdiutil`、`spctl`、keychain、packaged app 或外部 signing；除建立本報告外未修改其他檔案。

## 審查摘要

目前不通過。selector 的 direct-child 邊界、nested Helper.app fixture、duplicate cardinality fail-closed、workflow 的 evidence copy／cleanup 順序，以及修正後的 stapler/archive diagnostic schema 均成立；但仍有兩項 P1 blocker：notary marker 只有可重放的明文 tuple、沒有 authenticity binding，且 distribution validator 仍接受 `appMetadataValid=true` 搭配 `appExecutableSha256=null`。另有 marker／macOS writer success-path 測試覆蓋不足與 schema leaf type 驗證不足的 P2 findings。

## Findings

### F-01 — P1 blocker：notary marker 可偽造／未綁定受信任執行結果

- 位置：`.github/workflows/macos-signed-canary.yml:127-138`；`scripts/audit-macos-signed-canary-distribution.mjs:15,72-88`。
- 證據：workflow 在 `xcrun notarytool submit --wait` exit 0 後建立 `$RUNNER_TEMP/osf-signed-canary-notary-$GITHUB_RUN_ID.json`，內容只有 schema、runId、`commandSucceeded:true`、`status:"success"`，再以 `chmod 600` 保存。audit 只讀 caller-supplied marker path，檢查 exact keys、non-empty string runId、success tuple，並且只在 `GITHUB_RUN_ID` 已存在時要求 marker.runId 相等；沒有 MAC／簽章、不可預測 nonce、notarytool output digest、marker path ownership／expected path 或其他可驗證的 authenticity binding。當 audit 在非 CI 環境執行、`GITHUB_RUN_ID` 未設定時，任意非空 runId 的同形 JSON 也會被接受。
- 影響：runId 只能提供 replay／scope hint，不能證明 marker 是由本次 `notarytool` 成功步驟產生。可寫入 runner temp、或可呼叫 CLI 並指定 marker path 的 actor，能偽造 `notarytoolReady=true`，使 distribution evidence 產生不具證據力的 notarization command success projection；這不符合本輪要求的「notary marker 不可偽造且 run-scoped」。
- 建議：把 marker 綁定到本次受信任流程，例如由同一個不可插入的 shell step 直接把 command exit／受控 nonce／完整 command-result digest 傳入 audit，並在 audit 端強制 workflow run identity 與固定 `$RUNNER_TEMP` 路徑；若要宣稱不可偽造，需加入可驗證的 authenticated binding，而不是只增加 JSON 欄位或 chmod。

### F-02 — P1 blocker：candidate digest 與 metadata-ready leaf 尚未 fail-closed cross-field

- 位置：`scripts/audit-macos-signed-canary-distribution.mjs:103-111,117-128`。
- 證據：candidate validator 允許 `appExecutableSha256` 為 `null`，只要求 `appMetadataValid` 是 boolean；summary validator 只要求 `summary.candidateReady === candidate.appMetadataValid`，沒有要求 `appMetadataValid === (appExecutableSha256 !== null)`。因此一份 `appMetadataValid:true`、`appExecutableSha256:null`、summary 全部與之相容的 evidence 會被接受；本審查以 inline deterministic probe 呼叫 `validateEvidence`，該矛盾 fixture 實際回傳 `true`。
- 影響：evidence 可以宣稱 candidate metadata ready，但沒有 app executable digest。雖然目前 `main()` 的正常產生路徑以 `Boolean(executableName && appExecutableSha256)` 形成此 leaf，validator 作為 schema／tamper boundary 仍可接受不可能或被竄改的 ready record，違反本輪要求的 candidate leaf cross-field consistency。
- 建議：在 candidate validator 強制 `appMetadataValid === (appExecutableSha256 !== null)`，並保留 hash format／null branch；focused fixture 應新增 metadata-ready／digest-null 與 metadata-not-ready／digest-present 的雙向 negative cases。

### F-03 — P2：marker 與 macOS distribution writer 的關鍵路徑沒有 focused coverage

- 位置：`scripts/test-macos-signed-canary-distribution.mjs:3-71`；`scripts/test-macos-signed-canary-gate.mjs:144-164`；`scripts/audit-macos-signed-canary-distribution.mjs:72-88,137-202`。
- 證據：distribution fixture 只 import/export `validateEvidence`，notarytool leaf 固定為 `commandSucceeded:false,status:'unavailable'`，沒有建立或解析 marker，因此未測到 exact marker keys、non-empty string runId、run-id mismatch、extra key 或 malformed marker。gate test 的 workflow assertions 與 selector filesystem fixture 也未驗證 marker。audit writer 的 `main()` 在非 Darwin arm64 先以 `MACOS_ARM64_REQUIRED` 結束，focused tests 沒有執行 exclusive `wx` write、0600 mode、real `PlistBuddy`／app executable digest、`xcrun stapler validate`、`hdiutil verify` 或 evidence copy／cleanup 的成功／失敗路徑。
- 影響：`npm run check` 與 focused tests 會綠，但不會偵測 F-01 的 marker trust regression，也不會證明實際 Darwin writer 會生成 validator 可接受且在 workflow 中正確移除的 evidence。文件 06 已如實揭露沒有執行 Apple workflow，但 08／00 對 focused cross-field coverage 的敘述比實際 marker coverage 更廣。
- 建議：抽出可注入 marker／command runner 的 pure contract，增加 valid／empty／non-string／wrong-run／extra-key cases；另在 macOS runner 或 deterministic injected writer fixture 驗證 `wx`、0600、path boundary、copy／remove sequencing。未有這些證據前，維持「source contract only」而不把實際 distribution writer 視為已驗收。

### F-04 — P2：exact evidence schema 尚未完整驗證 timestamp、interpretation 與 environment leaf types

- 位置：`scripts/audit-macos-signed-canary-distribution.mjs:100-110,116-132`。
- 證據：validator 對 top-level `startedAt`／`completedAt` 與 `interpretation` 只透過 exact key presence 間接接受，沒有 ISO timestamp 或 non-empty string 檢查；environment 只檢查 `platform`／`arch` 的值，沒有驗證 `node`／`osRelease` 是 string。對照既有 signed result validator `scripts/audit-macos-signed-canary-result.mjs:140-146`，後者已對 timestamp、interpretation 與所有 environment values 做型別／格式 gate。
- 影響：目前 audit writer 產出的正常資料是字串，但被篡改或外部重用的 distribution evidence 仍可帶入 `null`、空字串或非字串 leaf 並通過「exact schema」validator。這是 schema contract 的 fail-closed 不完整，不是目前 workflow 直接必然失敗。
- 建議：補上 ISO timestamp、`completedAt >= startedAt`、non-empty interpretation、environment 全 leaf string checks，並在 focused fixture 加入 type／empty／timestamp negative cases。

## 六面向判定

### 1. 需求／範圍：部分通過

selector 只讀 `mac-arm64` 直接子項的唯一 `.app`，DMG 只讀 output root 的唯一 `*-macos-arm64.dmg`（`lib/macos-signed-canary-artifact-selection.mjs:12-34`）。fixture 實際建立 `離線字幕工廠.app/Contents/Frameworks/離線字幕工廠 Helper.app`，nested Helper 不會被計入，並覆蓋 duplicate app／DMG cardinality（`scripts/test-macos-signed-canary-gate.mjs:147-164`）。workflow 已改用共用 selector（`.github/workflows/macos-signed-canary.yml:107-117`），範圍沒有擴及實際 Apple workflow。惟 notary marker 不可偽造與 candidate cross-field 的需求尚未滿足（F-01、F-02）。

### 2. 正確性與 fail-closed：不通過

selector 與 workflow shell sequence 的 normal／cardinality failure path 成立；notarytool exit failure、stapler／archive status 的 cross-field validator 目前也已同步。前一版 stapler/archive 欄位不相容 bug 已在本次審查期間修正：現在 `diagnosticSha256`／`diagnosticBytes` exact keys、型別與 status consistency 均有 gate（`scripts/audit-macos-signed-canary-distribution.mjs:105,113-115`），focused test 亦有 diagnostic status negative case（`scripts/test-macos-signed-canary-distribution.mjs:52-57`）。但 F-01、F-02 使 evidence trust boundary 仍非 fail-closed。

### 3. 證據／provenance：不通過

DMG／app digest、source revision、bounded scope 與 evidence path／exclusive create 的設計方向正確（`scripts/audit-macos-signed-canary-distribution.mjs:60-70,137-200`）；workflow 先 copy distribution evidence、再 remove repository 暫存、再進入 app result audit（`.github/workflows/macos-signed-canary.yml:147-175`），順序正確且不把 distribution evidence 留在 subsequent app audit 的 source tree。可是 notary projection 沒有 authenticity binding（F-01），candidate ready 與 digest 也可矛盾（F-02），因此目前只能判為 bounded source contract，不是可接受的完整 distribution provenance。

### 4. 隱私／安全：部分通過

evidence 使用 `wx`／0600、限制在 `docs/project-management/evidence`、只保存 hash／bytes／status，不保存 raw Apple output、secret、absolute path、identity name／hash；privacy regex 與全 false scope gate 位於 `scripts/audit-macos-signed-canary-distribution.mjs:123-132`，workflow 也只把 bounded evidence copy 到 runner temp。風險在於 marker 是可寫入 runner temp 的明文 assertion，0600 是檔案權限而非 authenticity；因此不能把它當成安全 trust proof（F-01）。

### 5. 測試／回歸：部分通過

本輪執行的 `node scripts/test-macos-signed-canary-gate.mjs`、`node scripts/test-macos-signed-canary-distribution.mjs`、相關 `node --check`、Ruby YAML parse、`npm run check`、`npm run docs:check` 與 `git diff --check` 均 exit 0。完整回歸包含最新 distribution contract test 並通過。仍缺 marker parser、candidate digest contradiction、actual writer／Darwin command injection／copy-cleanup sequencing 的 focused coverage（F-02、F-03），因此綠色回歸不足以解除 blocker。

### 6. 治理／文件：部分通過

00／05／06／07／08 已記錄 selector、distribution evidence、workflow copy／cleanup 順序、未觸發 Apple workflow、未取得 Developer ID／credential，以及 FR-021 overall residual；08 entry 仍標示進行中，沒有把本輪 review 或外部 execution 寫成完成。文件對未執行 workflow 的界線大致如實，但 00／06／07 的「cross-field／exact schema」描述應在 F-02、F-04 修正或明確降級後再結案；05／00 對 plain marker 的「exact-schema」描述也不應被解讀為不可偽造的 trust proof。round1 report linkage 與 `npm run docs:check:final` closeout 尚待主要代理依本報告處理。

## 驗證命令

- `node scripts/test-macos-signed-canary-gate.mjs`：exit 0。
- `node scripts/test-macos-signed-canary-distribution.mjs`：exit 0。
- `npm run check`：exit 0；包含 docs validator、syntax checks、macOS signing／gate／result／distribution focused tests 與既有全套回歸。
- `npm run docs:check`：exit 0；19 個治理文件通過。
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/macos-signed-canary.yml")'`：exit 0。
- `git diff --check`：exit 0。
- deterministic probe：將 `candidate.appMetadataValid=true` 與 `candidate.appExecutableSha256=null`、其餘 summary leaf 保持一致後呼叫 `validateEvidence`，目前回傳 `true`，重現 F-02。
- 未執行：GitHub Actions、Apple signing／notarization、stapler、hdiutil、spctl、實際 macOS arm64 writer、packaged app、外部網路或 keychain。

## 綜合結論

- 判定：不通過；不得以本輪結果將 `FR-021-MACOS-CI-20261029-DISTRIBUTION-EVIDENCE-NEXT1` 標示完成或宣稱 distribution evidence 已具備完整 trust provenance。
- blocker：F-01 notary marker 可偽造／在非 CI 缺乏 run binding；F-02 candidate metadata-ready 與 executable digest 可矛盾並通過 validator。
- 條件複審：修正 F-01、F-02，補上 marker／writer／digest negative coverage；同步 00／05／06／07／08；由新的獨立 round2 context 重新審查，並在 08 closeout 後重跑 `npm run docs:check:final`。外部 GitHub Environment reviewer／secret scope、Developer ID identity／credential、實際 workflow、Apple ticket validity、Seatbelt renderer、全機 egress、Windows、LM Studio 與 FR-021 overall 仍是本輪之外的 residual。
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-CI-20261029-DISTRIBUTION-EVIDENCE-NEXT1` round1 獨立審查結論為不通過：selector direct-child／nested Helper.app fixture、cardinality fail-closed、workflow distribution evidence copy／cleanup 順序，以及修正後的 stapler／archive diagnostic schema 均成立，但 notary marker 仍只是可重放的明文 success tuple、未具備不可偽造的 authenticity binding，且 validator 仍接受 `appMetadataValid=true` 搭配 `appExecutableSha256=null` 的矛盾 candidate，因此本輪不得結案；另需補 marker／macOS writer success-path 測試、完整 schema leaf type gate 與治理 closeout，且不得把未執行的 Apple workflow／signing／notarization／ticket validity 或 FR-021 overall 宣稱為 pass。**

## 審查代理聲明

本審查代理僅讀取指定 workspace、執行唯讀檢查與驗證命令，唯一新增檔案為本報告 `docs/project-management/reviews/2026-10-29-fr-021-distribution-evidence-next1-round1.md`；未修改任何其他檔案，未刪除或覆寫既有 evidence／reviews。

若上述聲明不實，本報告無效。
