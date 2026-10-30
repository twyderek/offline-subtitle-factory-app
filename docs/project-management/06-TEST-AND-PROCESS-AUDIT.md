# 功能測試與流程稽核

## 2026-10-30 Windows workflow POSIX mode-bit contract regression

- Windows workflow run `41013005375`（HEAD `86d9133eda44480067e2a867445f1c4688b05470`）已通過 runtime 準備並在 `scripts/test-macos-signed-canary-result.mjs:249` 因 Windows mode `438` 與 POSIX `0600` 的預期 `384` 不同而停止。
- 三支 signed-canary contract test 改以 `process.platform !== 'win32'` 條件驗證 `0600`；POSIX／macOS 仍保留嚴格 mode gate，Windows 不再把不可表達的 Unix mode bits 當成失敗。
- 本地三支 focused tests 均 exit 0；修正推送後須重新驗證 Windows source／runtime、完整 regression、unsigned／signed package 路徑、renderer／install smoke、archive 與 SHA manifest。

## 2026-10-30 Windows workflow cross-platform contract regression

- GitHub Windows workflow run `40993031453`（HEAD `4996a421de284569bc2e8660b2d6737a781e5fc1`）在 `npm run check` 的 `scripts/test-macos-signed-canary-gate.mjs:210` 失敗：實際 Windows temp path 為 `D:\\tmp\\osf-signed-canary-test-output`，fixture 卻要求 `/tmp/osf-signed-canary-test-output`。
- 修正測試改用 `os.tmpdir()`／`path.join()`；本地 `node scripts/test-macos-signed-canary-gate.mjs` 與完整 `npm run check` 均 exit 0。修正推送後須以新的 Windows workflow run 驗證 source check、runtime preparation、package build、renderer／installation smoke、archive與 SHA manifest。
- 此項目前只結案 local source／test regression；Windows runner、unsigned／signed package、安裝生命週期與 Release asset 仍待 CI 複驗，不把 local pass 擴大成 Windows release acceptance。

## 2026-10-30 FR-021 signed-canary prerequisite revalidation review findings remediation

- 修正後四支指定 source／test syntax、gate／readiness focused tests、`node scripts/test-project-docs-validator.mjs`、完整 `npm run check` 與 `git diff --check` 均 exit 0。
- gate test 現驗證 authoritative blocked evidence 與 synthetic ready path，並固定每一類 source／toolchain／identity／notarization derived mismatch、timestamp／privacy／execution negative cases；readiness test 現以 date-first 再序號選取 10/30 latest evidence，並固定 timestamp null／malformed／reverse-order rejection。
- 本輪只修正 local validator／test contract，不新增 workflow／builder／signing／notarization／candidate evidence；待複審與 `npm run docs:check:final`。

## 2026-10-30 FR-021 macOS signed-canary external prerequisites revalidation next stage 2

- 依序執行 `next15` external boundary（exit 1，四項 GitHub external configuration gap）、`next7` readiness（exit 0，`blocked-external-signing-identity`）與 `execution7` formal gate（exit 0，`ready=false`，兩項 identity／credential reasons）；三份 evidence 均 mode `0600`、綁定 current HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b`。
- 本輪 schema／mode／SHA／provenance／scope probe、三支 focused contract、三支 syntax、`node scripts/test-project-docs-validator.mjs`、完整 `npm run check` 與 `git diff --check` 均 exit 0；未觸發 workflow／signing／notarization，未啟動 runtime manifest／builder／candidate。
- remote workflow／source match 不代表 external Environment／identity／credential ready；本 evidence 不代表 signed／notarized candidate、Apple ticket、release 或 FR-021 overall acceptance。

## 2026-10-30 FR-021 macOS signed-canary external prerequisites revalidation next stage

- 依序執行 external boundary、signing readiness、formal gate 三支 read-only audit：`next14` exit 1（四項 GitHub external configuration gap）、`next6` exit 0 且 status `blocked-external-signing-identity`、`execution6` exit 0 且 gate reasons 為 `developer-id-application-not-ready`／`notarization-credential-set-not-ready`。三份 evidence 均 mode `0600`、綁定 current HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b`。
- authoritative SHA-256：next14 `3f9055efef9e7af3a508c485ac55910a5a787eeefa0e5cd4db9f26f429a0789f`；next6 `15f43ad1722344019cf48e3d2e5b8d0edae280d5283c51ef05f99b3585cc5cfa`；execution6 `ae372012947ffecb12f29ce607b7854474804dc78e18011b30bac4a0b5edee39`。
- current state 沒有 ready transition：remote workflow／source match，但 Environment／reviewer／secret metadata／branch protection 不存在；local identity／credential 不存在；formal gate 未啟動 runtime manifest／builder／candidate。scope 與 privacy flags 維持 fail-closed，未觸發 workflow／signing／notarization。
- 本輪 focused contract／syntax／schema／mode／hash／scope／provenance、完整 `npm run check`、治理 validator、`git diff --check` 與 `npm run docs:check:final` 均已重跑並通過；本證據不代表 signed／notarized candidate 或 FR-021 overall。

## 2026-10-29 FR-021 macOS signed-canary current-source formal build gate recheck next stage

- 執行 `node scripts/audit-macos-signed-canary-gate.mjs docs/project-management/evidence/2026-10-29-fr-021-signed-canary-gate-execution5.json`，exit 0 並保存 mode `0600`、SHA-256 `5a1bb264b698f78d958d7bd53056c57aae5ed6cf2b4349fd0dd1905f203872e5` 的 current-source gate evidence。gate `ready=false`，reasons 為 `developer-id-application-not-ready`、`notarization-credential-set-not-ready`。
- execution5 source config／required toolchain ready、identity／credential not ready；`runtimeManifestStarted`／`builderStarted`／`candidateCreated` 與完整 scope 均 false，未進入 builder、未建立 candidate。`node --check scripts/audit-macos-signed-canary-gate.mjs`、`node scripts/test-macos-signed-canary-gate.mjs` 與 schema／0600／SHA／provenance／execution／scope probe 通過。
- 這是 current-source formal gate 的 fail-closed evidence，不是 codesign／notarization／Apple ticket／Gatekeeper、workflow、packaged UI 或 FR-021 overall acceptance；外部 identity／credential 仍是後續必要條件。

## 2026-10-29 FR-021 macOS signed-canary current-source signing readiness recheck next stage

- 執行 `node scripts/audit-macos-signing-readiness.mjs docs/project-management/evidence/2026-10-29-fr-021-prerequisite-readiness-recheck-next5.json`，exit 0 並保存 status `blocked-external-signing-identity` 的 bounded evidence；mode `0600`、SHA-256 `11312386df77c2bee79accf6f07a055693abeef236c15ea8a13d8b3d2dcc1937`。next5 綁定目前 source HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b`，補足 next3／next4 舊 source provenance 不能代表現行 handoff 的缺口。
- readiness projection：toolchain／source config／existing evidence／provenance ready；identity probe command 成功但 `validIdentityCount=0`、`formalIdentityAvailable=false`、Developer ID Application 不存在；Apple ID／API key／keychain profile credential route 均 absent，decision 為 `blocked-external-signing-identity`。
- `node --check scripts/audit-macos-signing-readiness.mjs`、`node scripts/test-macos-signing-readiness.mjs` 與 next5 schema／0600／SHA／scope／source provenance probe 通過；scope 保持未修改 keychain／candidate、未 signing／notarization、未執行 packaged app／UI／Ollama／model／network，未保存 raw output／identity／secret。這不是 signed candidate 或 FR-021 overall evidence。

## 2026-10-29 FR-021 macOS signed-canary external boundary recheck next stage

- 執行 `node scripts/audit-macos-signed-canary-external-boundary.mjs docs/project-management/evidence/2026-10-29-fr-021-macos-signed-canary-external-boundary-next13.json`；因外部前置設定未就緒而 exit 1，authoritative evidence status `fail`、mode `0600`、SHA-256 `c3ffb62230fc4ae5d6de2add79c0cce71dca1c3de9e86d0741cd822308b607ec`。這是預期的 fail-closed boundary 結果，不是 local source／audit contract failure。
- remote branch／workflow 與 local source HEAD／workflow provenance match；`macos-signed-canary` Environment、required reviewer、environment secret metadata、branch protection 仍 `not-found`，四項 summary reasons 已保存於 next13，故 `ready=false`。
- `node scripts/test-macos-signed-canary-external-boundary.mjs` 通過，確認 schema／privacy／scope／negative matrix 與 exclusive 0600 writer；scope 為 remote API queried、remote state unmodified、workflow not triggered、secret metadata queried 但 secret value 未讀取。未執行 workflow、builder、signing、notarization、stapler、Gatekeeper 或 release。
- 本輪只更新 current external observation；後續必須由外部管理者提供 Environment／reviewer／secret scope／protected branch，並由受控 macOS runner 提供 Apple identity／keychain profile／notarization，才可進行 signed-canary handoff。renderer、全機 egress、Windows 與 FR-021 overall residual 維持。

## 2026-10-29 FR-021 macOS signed-canary notarytool keychain-profile runtime resolution preflight

- 本輪驗收新增 workflow ordering／runtime command contract：固定 profile probe 必須位於 output directory／builder 前，執行 `xcrun notarytool history --keychain-profile "$APPLE_KEYCHAIN_PROFILE" --output-format json --no-progress`，stdout／stderr 不落盤，非 0 exit fail-closed；workflow 仍不得含 `OSF_APPLE_*`、`--password`、`--apple-id` 或 `--team-id`。
- focused gate test 需覆蓋固定 profile injection count、probe command／ordering、history-versus-submit distinction、stdout／stderr suppression 與移除 `--keychain-profile`／改成 submit 的 mutation fail；YAML／syntax、完整 `npm run check`、`git diff --check` 與治理 validator 需通過。
- 本輪不在本機執行 `notarytool history`、workflow、builder、signing、notarization、stapler、Gatekeeper 或 release；runtime probe 僅能在受控 self-hosted runner 產生 profile resolution evidence，不等同 Apple ticket／signed candidate 或 FR-021 overall acceptance。
- 實作結果：workflow 新增固定 profile probe 並置於 output directory／builder 前；focused gate test 補 history／submit distinction、stdout／stderr suppression、ordering、`set -euo pipefail`、`|| true` absence 與 appended `|| true` mutation rejection。round1 review `docs/project-management/reviews/2026-10-29-fr-021-macos-signed-canary-notary-keychain-profile-probe-next2-round1.md` 發現 F-01，round2 review `docs/project-management/reviews/2026-10-29-fr-021-macos-signed-canary-notary-keychain-profile-probe-next2-round2.md` 確認已關閉，結論為 bounded source／local contract 有條件通過。
- 開發驗證／最終 closeout：full preflight、focused gate、指定 syntax、Ruby YAML parse、完整 `npm run check`、`git diff --check`、round1／round2 mutation review 均通過；allowlist-only 2-path source commit `f16ae8be60fb132bdbb1a128722a244f70f86e6b` 已推送且 remote SHA 一致。next12 evidence status `fail`、mode `0600`、SHA-256 `a0283d10dd4420744aff7fa676d8e9a6a4da7276b10548621544a80dbece6376`，remote branch／workflow／source match，Environment／reviewer／secret metadata／branch protection not-found，`secretValuesRead=false`；治理回填後執行 `npm run docs:check:final`。
- 獨立審查結論：round1 F-01 已由主要代理修正並由同一審查代理 round2 確認關閉；兩輪均保留 runner profile、Apple toolchain、workflow runtime、signing／notarization 未執行的邊界，不宣稱 signed／notarized candidate、release 或 FR-021 overall。

## 2026-10-29 FR-021 macOS signed-canary notarytool keychain-profile argv hardening

- focused gate／readiness／external-boundary tests、指定 syntax、workflow YAML parse、`git diff --check` 與完整 `npm run check` 均通過；測試明確拒絕 workflow 中的 `OSF_APPLE_*`、`--password`、`--apple-id`、`--team-id`，並要求三個固定 profile injection 與兩個 `--keychain-profile` submit flags。
- round1 獨立審查為 bounded source／local contract 有條件通過，無 source／test technical finding；審查保留 keychain profile 真實 provisioning／resolution 與 workflow runtime 未執行的外部限制。source-only commit `ce72b64f8aa2b937e1b589e1b9577835dd691ca8` 已推送。
- next11 external-boundary evidence status `fail`、mode `0600`、SHA-256 `d6364070c4cb9ee87f91b8c3a2c99018f97c4d30526cfa39cfd8d4a8b1813f4c`：remote branch／workflow 與 local source match，Environment／reviewer／secret metadata／branch protection 尚未配置，`secretValuesRead=false`；本輪不代表 Apple notarization 或 FR-021 overall。

## 2026-10-29 FR-021 macOS signed-canary ZIP target coverage hardening

- selector／gate／distribution focused tests、Darwin arm64 audit-main integration fixture、指定 source syntax、workflow YAML parse、`git diff --check` 與完整 `npm run check` 均通過；distribution contract 覆蓋 app／DMG／ZIP cardinality、dual notary digest、submitted／final archive provenance、ZIP integrity／embedded executable digest、0600／symlink／malformed／invalid UTF-8 與 cleanup mutation。
- round1 獨立審查發現目標 macOS 不支援的 `ditto -t`、notary raw provenance 缺口與 workflow guard 覆蓋不足；round2 複審確認三項均關閉，結論為 bounded source／local contract 有條件通過。source-only commit `3a8f04080d810fae55df6b58b5b1b4991a2632ba` 已推送，未執行 GitHub workflow 或 Apple signing／notarization。
- push 後 external-boundary `next10` evidence status `fail`、mode `0600`、SHA-256 `c046a1a2f295c4960ce18020391ed778aa0e92c107f50c9daaca90052d41b16a`；remote branch／workflow 與 local source match，Environment／secret metadata／branch protection 為 `not-found`，`secretValuesRead=false`。本輪不代表 workflow run、release 或 FR-021 overall。

## 2026-10-29 FR-021 macOS malformed candidate bounded evidence hardening

- focused `scripts/test-macos-signed-canary-result.mjs` 覆蓋 executable name 的 null／空值／`.`／`..`／相對與絕對路徑／反斜線／換行／超長矩陣、missing executable digest、strict packaged `isSha256` source guard，以及 fake-darwin 實際啟動兩支 audit 的 malformed `.app` path。
- fake-darwin probes 確認 result audit 與 packaged identity audit 都 exit 1、仍各自寫出 exclusive mode `0600` 的 bounded `status: fail` JSON；result evidence 通過 schema validator、candidate metadata false、null executable digest、固定 6 objects 與 `candidate-metadata-not-ready`／helper／signature failure reasons。完整 `npm run check`、project-docs validator、`git diff --check` 與 round2 review 通過。
- source-only commit `ae599e780fc246910e8e625c142c2af0ac87b412` 已推送；current-source external-boundary `next9` status `fail`、mode `0600`、SHA-256 `7ae3a89462ac1ff30e75da27e8ed65b15e87d36f22a78e96ef0aa0f519b5ba99`，remote branch／workflow present 且 source matches local HEAD，但 Environment／secret metadata／branch protection 為 `not-found`，secret value 未讀取。本項不涵蓋真實 codesign／stapler／Gatekeeper／self-hosted workflow、ZIP、notary argv 或 FR-021 overall acceptance。

## 2026-10-29 FR-021 macOS signed-canary result evidence cleanup hardening

- staged 2-path cleanup change 通過 `git diff --cached --check`、Node syntax、Ruby YAML parse、focused gate test、固定 path-to-rm mutation probe、regular／leaf-symlink／directory filesystem probe 與完整 `npm run check`；commit `4fdbcc279409690ed39ff922703e328bb49a741b` 已推送並完成 remote workflow metadata read-back。
- round1 發現 test assertion false-pass，round2 確認連續 regex 已綁定實際 `rm -f -- "$result_evidence"` 且 F-01 關閉；治理 final gate、source／remote ref 與 next8 bounded external observation 已完成。這不是實際 runner、signing、notarization 或 release evidence。

## 2026-10-29 FR-021 macOS signed-canary remote source handoff closeout

- 23-path source-only commit `8dd82fbe71e754616d1c87971670e1e5ad5bf7bc` 的 dependency closure、source／package／focused-test provenance、workflow YAML、所有 handoff source syntax、signed-canary focused tests、`git diff --cached --check` 與 clean staged-tree `npm run check` 均通過；full check 使用既有 `.gitignore` ignored `tools/whisper-cpp`／`tools/whisper-models` fixture，未將 binary／model 宣稱為交付內容。
- push 後唯讀 external-boundary `next7` 保存 remote branch／workflow presence、source SHA match、Environment／secret metadata／branch protection 缺口與 `secretValuesRead=false`；未修改 remote、讀取 secret value 或觸發 workflow。round1／round2／round3 source review 與 round4 governance closeout 均保留；round4 為有條件通過。
- 本項僅結案 source-only handoff 與可回溯驗證，不是 CI run、Apple signing／notarization、signed candidate、release 或 FR-021 overall acceptance；P2 cleanup／ZIP／malformed evidence／notary argv 與 external configuration residual 維持。

## 2026-10-29 FR-021 macOS signed-canary external boundary audit

- `scripts/audit-macos-signed-canary-external-boundary.mjs` 固定 repository／branch／Environment／workflow constants，以 `gh api --hostname github.com` 查詢 remote branch ref、Environment、environment secret metadata、branch protection 與 workflow content；projection 只保存 bounded status、boolean、secret metadata count 與 remote ref／content SHA，不保存 secret name／value、reviewer name、token 或 raw API diagnostics。
- `scripts/test-macos-signed-canary-external-boundary.mjs` 實際覆蓋 complete pass fixture、Environment／secret／protection／workflow 404、remote source mismatch、plain／JSON 404／403／malformed／timeout `gh` responses、partial secret metadata、空／缺失／非陣列 reviewer metadata、git status subprocess failure、privacy／scope／schema mismatch 與 exclusive 0600／EEXIST writer。首三份 first-run evidence、next4 predecessor 與 next5 scope-repair predecessor 保留；owner typo、implicit host routing、`secretsRead` 語意、reviewer false-pass 與 git status fail-open 均已修正，authoritative next6 status `fail`、mode `0600`、SHA-256 `bb21059bb0408f0f6643f81b9e1911df20a06a4563cdd272f62de612e739a40a`。
- next6 的 bounded 結果為 remote branch present／SHA `22f7a09767923973c698fa817c543a1e586495f4`，Environment、environment secret metadata、branch protection、remote workflow 均 `not-found`，local source dirty 且 local HEAD 未匹配 remote branch；scope 為 `secretMetadataRead=true`、`secretValuesRead=false`，reviewer metadata 與 local git status 均 fail-closed，因此不得宣稱 external reviewer／secret scope／protected branch／remote workflow 已部署。focused syntax／contract、完整 `npm run check`、治理 validator、`git diff --check`、round2／round3 獨立複審與 `npm run docs:check:final` 均已通過。

## 2026-10-29 FR-021 signed-canary distribution evidence hardening

- `scripts/test-macos-signed-canary-gate.mjs` 以實際 temporary filesystem fixture 建立主 app 及 nested `離線字幕工廠 Helper.app`，確認 selector 只回傳主 app；另覆蓋 duplicate app／DMG cardinality fail-closed。workflow static assertion 改要求共用 selector module，並拒絕 recursive app locator。
- `scripts/test-macos-signed-canary-distribution.mjs` 覆蓋 exact distribution evidence schema、app／DMG digest leaf、run-scoped notarytool JSON projection／DMG hash binding、stapler／archive fail-closed、scope 全 false、source provenance、exclusive 0600 writer／EEXIST、extra-key／forged-ready／digest contradiction／timestamp／privacy leakage negative cases；audit writer 使用 exclusive create／0600。
- 已驗證：兩個 focused tests、`npm run check`、workflow Ruby YAML parse、相關 `node --check` 與 `git diff --check` exit 0。未執行 GitHub workflow、Apple signing／notarization／stapler／hdiutil／spctl 或 packaged app；因此 evidence contract 不等同實際 signed／notarized candidate。

## 2026-10-29 FR-021 macOS signed-canary CI handoff

- 新增 `.github/workflows/macos-signed-canary.yml`，僅 `workflow_dispatch`，限定 `self-hosted`／`macOS`／`arm64`／`osf-signed-canary` runner；不在本輪觸發外部 workflow。runner identity 必須預先存在，workflow 不修改 keychain。
- workflow 先執行 `npm run check` 與 readiness audit，但 readiness 只作 evidence；之後每次都執行 `assert-macos-signed-canary-ready.mjs` 正式 gate，只有其 exit 0 才會進入 builder。blocked 時只上傳 0600 去敏 readiness／gate evidence；ready 後使用 run-scoped output directory，唯一 artifact 才能進入 signed build、notarytool、stapler 與 post-build audit。protected ref、required-reviewer environment、immutable action SHA、concurrency 與 clean output directory 是 workflow contract；Apple ID secrets 只注入必要 steps，不會寫入 repository、evidence 或 artifact。
- 本機 readiness 仍為 `blocked-external-signing-identity`（0 valid identity／credential absent），本輪未觸發 CI、未 signing、未 notarization、未建立 candidate；因此此 workflow 是交接 contract，不是 signed／notarized／Gatekeeper、offline UI 或 FR-021 overall evidence。

## 2026-10-29 FR-021 external prerequisite readiness recheck next stage

- first run `node scripts/audit-macos-signing-readiness.mjs ...next1.json` exit 0；next1 schema v1、status `blocked-external-signing-identity`、mode `0600`、SHA-256 `6f5447d8b0244a27eef0fdbf5b3f58cd17f071c08b7351912ab4c27424ebe8a4` 保留為 immutable baseline。derived-field consistency 修正與 focused fixture 更新後，authoritative `node scripts/audit-macos-signing-readiness.mjs ...next2.json` exit 0；next2 mode `0600`、SHA-256 `b7ee6038368f946fd7ead6c7ca11255f88e8e86d87cfc87da4881fe5db4dc031`，privacy scan 未見 raw output／absolute path／identity name／hash／secret，focused test 直接驗證 next2。
- readiness：required toolchain、source config、existing evidence 與 source provenance 全部 ready；`security find-identity` command 成功但 `validIdentityCount=0`、`formalIdentityAvailable=false`，credential presence 11 flags 全 false，notarization `absent`／`ready=false`。scope 全部 false，未觸碰 keychain、signing、notarization、candidate、packaged app、UI、Ollama、model 或 network。
- capability recheck：`/usr/bin/sandbox-exec` 可用，`ollama list` 顯示 `llama3.2:3b` 與 `llama3.2:1b`；未重播 known Seatbelt UI failure，未下載或修改模型。
- 解讀：本 evidence 只更新 external prerequisite 的 current state；validator 現拒絕 identity／decision derived fields 矛盾，未解除 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、true full-egress、Developer ID／notarization、Windows 或 FR-021 overall blocker。

## 2026-10-29 FR-021 current-source normal-loopback 3B live evidence provenance hardening next stage

- focused contract：`projectReplayProvenance()` 覆蓋完整 source revision／dirty digest、source bytes、normalized invocation、environment、loaded bytes 與 invalid path／secret／revision／timeout fail-closed；`scripts/test-ollama-ui-offline.mjs` 同時固定 live schema v5、`REPLAY_PROVENANCE_UNAVAILABLE` 與 source-before-spawn contract。
- first run：`OSF_OLLAMA_UI_SCENARIO=cancel-resume-restart node scripts/verify-electron-ollama-ui.mjs <candidate-executable> 9995 30000 docs/project-management/evidence/2026-10-29-fr-021-evidence-provenance-next1.json llama3.2:3b` exit 0；evidence mode `0600`、SHA-256 `aa35a2cc9b5e75dcc3886941ec98fc2a011ae0d365cd5b068007e11c39286bfe`，round1 finding 後不作 authoritative closeout。
- authoritative replay：同一 command 改用 `.../2026-10-29-fr-021-evidence-provenance-next2.json` exit 0；evidence mode `0600`、SHA-256 `9a159170c0c4dfeac9112dff755fc68f6cd1356445a9396ef49d0fe42d0f19e3`、`sourceProvenanceComplete=true`、`provenanceComplete=true`、`loadedBytesObservation=renderer-ready-file-read`、`loadedBytesMatchPreLaunch=true`。此 observation 是 renderer-ready 後重新讀取檔案 bytes，不等同 memory-mapped bytes、runtime loader 或記憶體映射 introspection。
- lifecycle／scope：cancel POST HTTP 200／accepted／cancelled、checkpoint／same-session app restart／resume 1 至 6/6、第二次 port capture／close、privacy、cleanup 均通過；normal loopback flags 保持 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`apiKeySupplied=false`，未執行 Seatbelt／LM Studio／signing／notarization。
- 本輪後續：round1 findings 已由 source／focused regression／next2 修正；round2 獨立複審為有條件通過，治理 closeout 已完成並須以 final docs gate 收斂。若再有 provenance 或 live boundary finding，保留本 evidence 並另以新 immutable record 修正，不覆寫歷史 evidence。

## 2026-10-29 FR-021 current-source packaged UI normal-loopback 3B app-restart resume replay next stage

- 預檢：`npm run project:preflight -- --type=full` exit 0；candidate executable、Ollama、`llama3.2:3b` 與 model store 存在；不套用 Seatbelt、不停止或修改既有桌面 Ollama、不下載模型。
- next1 first-run `OSF_OLLAMA_UI_SCENARIO=cancel-resume-restart ... next1.json` exit 0 但 round1 發現第二次 app server port 未實際驗證；修正後 authoritative next2 `OSF_OLLAMA_UI_SCENARIO=cancel-resume-restart node scripts/verify-electron-ollama-ui.mjs <candidate-executable> 9995 30000 docs/project-management/evidence/2026-10-29-fr-021-ui-normal-3b-app-restart-resume-next2.json llama3.2:3b` exit 0；next2 mode 0600、SHA-256 `e95aa0524fdc32684a49c03bc4c22942afe012657d77dedd6c95e66903256f24`。
- next1 status `pass`：6 cues／6 batches；第 1 批完成後 UI cancel，cancel POST HTTP 200／accepted／cancelled，`cancelled=true`／`retryable=true`／completed `1/6`，checkpoint suggestion count 1 persisted，source subtitle／original SRT unchanged。
- app-restart assertions：第一個 Electron process group／app server port 關閉且未 forced cleanup，temporary userData／job root 在兩次啟動間保留；第二次同一 candidate／DevTools port 啟動成功，第二次 app server port 已捕獲且 final close 驗證通過，same session／checkpoint 還原、page time-origin 改變，resume 從 batch 1 至 6/6 完成；accept 6、undo／redo、save `reviewed.srt` 6 cues、timecodes unchanged、最終 Electron／server／port／temporary userData／owned daemon cleanup 全部通過。
- scope：`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`、`loopbackOnlyConfiguration=true`、`apiKeySupplied=false`；這是 normal-loopback app-restart lifecycle evidence，不是 Seatbelt offline／全機 egress／signed／Windows evidence。raw child output 未保存，token／absolute path 未落盤。
- focused `node scripts/test-ollama-ui-offline.mjs`、`npm run check`、治理 validator 與 `git diff --check` 均 exit 0；round1 blocker 已修正並以 next2 重跑，round2／round3 獨立複審與 `npm run docs:check:final` final docs gate 均 exit 0。

## 2026-10-29 FR-021 current-source packaged UI normal-loopback 3B replay next stage

- 預檢：`npm run project:preflight -- --type=debug` exit 0；candidate executable、Ollama、`llama3.2:3b` 與 model store 存在；不套用 Seatbelt、不停止或修改既有桌面 Ollama、不下載模型。
- 基準 next1／next2：使用 current packaged candidate executable 啟動 normal renderer，synthetic job setup 完成；next1／next2 在 `review_navigation` 失敗，next2 保存 `ready=false`、local review `href`、title 與 `cueCount=0`，Electron／server／port／temporary cleanup 全通過。next1／next2 均非 3B model／Chromium startup failure。
- BUG-062 修正：runner 不再從去敏首頁 URL 取 token；只在記憶體保存 navigation token，另建立不含 token 的 `homeEvidence`；normal evidence writer 與 offline writer 均採 exclusive owner-only `0600`。focused source regression 已固定 token non-persistence 與 writer mode。
- next3 `docs/project-management/evidence/2026-10-29-fr-021-ui-normal-3b-replay-next3.json` status `pass`：home／review ready、job `201/202/completed`、Ollama local settings saved、2 suggestions／1 batch／0 retries、accept 2、undo／redo、save `reviewed.srt` 2 cues、timecodes unchanged、English translation；candidate／Framework provenance、raw child output excluded、cleanup 全部通過。
- next3 scope：`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`、`loopbackOnlyConfiguration=true`、`apiKeySupplied=false`；此非 offline／全機 egress／signed／Windows evidence。
- 驗證：`node --check scripts/verify-electron-ollama-ui.mjs`、`node scripts/test-ollama-ui-offline.mjs`、`npm run check`、round3 mutation probes 與 `git diff --check` 均 exit 0；next3 mode 0600、SHA-256 `b275d0e03f2c503df5eb6591d0059a1bee93aa8769ce17f5aad0aef0e9b0ae77`。BUG-062 round1／round2／round3 報告均保留；F-01 home-probe source-region 與 F-02 canonical governance state/path 均已由 round3 確認關閉，本條目治理 closeout 完成。

## 2026-10-29 FR-021 current-source packaged UI normal-loopback 3B cancel-resume replay next stage

- 預檢：`npm run project:preflight -- --type=debug` exit 0；candidate executable、Ollama、`llama3.2:3b` 與 model store 存在；不套用 Seatbelt、不停止或修改既有桌面 Ollama、不下載模型。
- `OSF_OLLAMA_UI_SCENARIO=cancel-resume node scripts/verify-electron-ollama-ui.mjs <candidate-executable> 9995 30000 docs/project-management/evidence/2026-10-29-fr-021-ui-normal-3b-cancel-resume-next1.json llama3.2:3b` exit 0；evidence mode 0600、SHA-256 `397983b2388083c64c161c7f0e3bf340be4c919bde1abcc7da532c661545e31c`。
- next1 status `pass`：job `201/202/completed`、6 cues／6 batches／0 retries；第 1 批完成後 cancel，`cancelled=true`／`retryable=true`／completed `1/6`，checkpoint persisted 且 suggestion count 1；reload 後 `sessionUnchangedAfterReload=true`、checkpoint 狀態保留，resume 從 batch 1、same session，最後 6/6 completed。
- lifecycle assertions：home／review ready、Ollama settings saved、provider／model 正確、API key empty／local privacy、accept 6、undo／redo、save `reviewed.srt` 6 cues、timecodes unchanged、English translation、source subtitle／original SRT unchanged；Electron／server／port／temporary userData／owned daemon cleanup 全部通過，`rawChildOutputPersisted=false`。
- scope：`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`、`loopbackOnlyConfiguration=true`、`apiKeySupplied=false`；這是 normal-loopback lifecycle evidence，不是 Seatbelt offline／全機 egress／signed／Windows evidence。
- focused／完整回歸、治理 validator、`git diff --check`、round1 獨立六面向審查與 round2 closeout 複審均通過；F-01 已完成 08 closeout，F-02 evidence provenance 與 F-03 cancel POST observability 列為非阻擋改善建議；`npm run docs:check:final` exit 0。

## 2026-10-29 FR-021 current-source packaged UI Seatbelt offline replay next stage

- bounded replay 實際使用 existing arm64 candidate／Ollama `llama3.2:3b`；next1／next2 均以 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`SIGTRAP` 在 `electron_start` 結束，沒有 home dashboard、AI flow 或 UI acceptance pass。
- next2 `docs/project-management/evidence/2026-10-29-fr-021-ui-offline-replay-next2.json` mode 0600；loopback／external `EPERM`、sandbox inheritance、preinstalled model、no-download、no API key／external provider、process／port／temporary cleanup 均符合範圍。`systemNetworkDisabled=false`，LM Studio／Windows 未執行。
- 針對 next1 mode 0644 的 observation，wrapper 已補 exclusive owner-only evidence create，focused offline UI contract 與完整 `npm run check` 通過；next1 不覆寫，next2 作 authoritative bounded failure record。這不是 packaged UI pass、全機斷網、signed package 或 FR-021 overall acceptance。
- round1 獨立審查為 bounded failure contract 有條件通過；`npm run docs:check:final` 已完成，範圍只限 next2 的 macOS arm64／candidate／`llama3.2:3b`／Seatbelt failure evidence，不把 renderer failure 誤稱為 UI pass。

## 2026-10-29 FR-021 signed canary post-build verification contract

- 新增的 pure classifier／audit CLI 只保存固定分類、boolean、digest／bytes、safe hash 與全 false scope；Team ID 僅以記憶體內 diagnostics 比對，不保存原值，helper metadata 只保存數量，candidate version 只驗證格式不落盤。schema validator 固定 top-level／nested keys、六個 code object、source provenance、scope、status／summary consistency 與 privacy boundary。
- `classifyStapler` 只接受固定 `The validate action worked!`／`The staple and validate action worked!` 形狀；`classifyGatekeeper` 必須同時看到 `accepted` 與 `source=Notarized Developer ID`，generic／空白／矛盾／截斷 status 0 都拒絕。完整 plist／dict entitlements、非 ad-hoc runtime flags、Developer ID authority、Team ID consistency 與 clean source provenance 都是 ready 條件。
- 本輪 focused contract、full `npm run check`、治理 validator 與 `git diff --check` 通過；config split 後 gate execution4 `docs/project-management/evidence/2026-10-29-fr-021-signed-canary-gate-execution4.json` mode 0600，sourceRevision SHA-256 與目前 gate audit script／focused test 一致，且在 builder 前停止。沒有執行 `codesign`、`stapler`、`spctl`、electron-builder、candidate、packaged app、renderer／UI／AI／Ollama／model／network。沒有 signed result evidence；外部 identity blocker 與 FR-021 packaged UI blocker 仍保留。

## 2026-10-29 FR-021 signed canary build gate

- `scripts/test-macos-signed-canary-gate.mjs` 實際通過 ready、absent／partial／ambiguous credential、0／非 Developer ID／malformed identity、malformed／wrong-arch／missing mac target、source-config、required toolchain 與 platform／arch fail-closed matrix；gate summary 不含 secret、raw output、path 或 identity name／hash。
- `npm run electron:build:mac:signed-canary` 在目前環境實際以非零狀態停止，輸出 `developer-id-application-not-ready` 與 `notarization-credential-set-not-ready`；沒有執行 runtime manifest 或 electron-builder，沒有建立 candidate。`sourceConfigReady=true`、required toolchain ready 仍保持可觀測；execution2 evidence mode 0600，builder／candidate／scope flags 全 false。
- 完整 `npm run check`、`node scripts/test-project-docs-validator.mjs`、`git diff --check` 均通過。此為 future formal signed-canary build gate，不是 signing／notarization／effective entitlements／packaged renderer／UI／AI／Ollama／model／network acceptance。

## 2026-10-29 FR-021 signed canary／notarization prerequisite preflight

- audit12 `docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit12.json` status `blocked-external-signing-identity`；source config／required toolchain／existing evidence／audit script／focused test／git provenance／privacy 均通過，但 identity probe 為 `validIdentityCount=0`、`formalSigningReady=false`；audit11／audit10／audit9／audit8 保留為前輪 immutable 原件。
- credential classifier 完整覆蓋 Apple ID／app-specific password／team ID、API key／key ID／issuer、keychain profile／optional keychain；11 個 presence flags 全 false，notarization status `absent`、`completeSetCount=0`、`partialCredentialSetDetected=false`、`notarizationCredentialReady=false`。focused test 覆蓋 complete／partial／complete+partial／multiple complete／ambiguous／absent matrix，missing／unknown key、derived mismatch、unknown top-level key、nested leaf unknown／type 與 generic POSIX absolute-path leakage 均 fail-closed；未呼叫 notarytool。
- audit12 mode 0600，scope 的 candidate／keychain／signing／notarization／network／packaged app／UI／Ollama／model／raw output／path／identity／secret flags 全 false。此為 credential／signing readiness preflight，不是 formal signed package、effective entitlements、notarization、renderer、offline UI 或 FR-021 acceptance。

## 2026-10-29 FR-021 formal packaging source configuration readiness

- package source config 已移除明確 `identity: null`，採 electron-builder auto-discovery／外部 `CSC_NAME` seam，並設定 `hardenedRuntime=true`／`gatekeeperAssess=true`；未設定固定 identity 名稱、未新增 ad-hoc identity、未新增未經確認的 entitlements。
- audit7 `docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit7.json` status `blocked-external-signing-identity`：`sourceBuildConfig.identityConfiguration=auto-discovery`、`sourceConfigReady=true`，required toolchain／existing evidence／source／package／focused-test／git provenance／privacy 均通過，但 identity probe 成功且 `validIdentityCount=0`、`formalIdentityAvailable=false`，因此 `formalSigningReady=false`；audit6 保留為 round1 finding 前的 immutable record。
- focused contract 新增 auto-discovery pass 與 explicit-null／explicit-ad-hoc／hardened false fail cases；audit6 寫檔權限 0600，raw output／absolute path／identity name／hash／secret 均未落盤。這只是正式 packaging source readiness，不是 signed package、renderer、offline UI 或 FR-021 acceptance；沒有 identity 時不建立 candidate。

## 2026-10-29 FR-021 formal signing／hardened-runtime readiness audit

- audit5 `docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit5.json` status `blocked-external-signing-identity`：platform／arch 為 darwin／arm64，required codesign／xcrun 可用，identity probe command 成功且 `validIdentityCount=0`、`formalIdentityAvailable=false`；source config mismatch 為 `identityConfiguration=unset`、hardened／Gatekeeper false。
- readiness source 在寫檔前驗證 identity probe 可解析、required／optional toolchain 分類、恰好兩份既有 pass evidence 的固定 filename／hash／完整 scope key allowlist／metadata、source script／package／git provenance、credential presence 與完整 privacy scope；所有 candidate／keychain／signing／notarization／network／packaged app／UI／Ollama／model／raw output／path／secret flags 均為 false。
- `node --check`、readiness focused contract（identity command failure、malformed output、required tool failure、auto-discovery／explicit-null／ad-hoc／hardened false、空／單／重複 evidence、privacy／imported evidence pollution、unknown scope key、型別錯誤）與 audit7 leakage／invariant guard 通過；完整 `npm run check`、治理 validator、`git diff --check` 通過。這只是環境 readiness，不是 signed package、renderer、offline UI 或 FR-021 acceptance。

## 2026-10-29 FR-021 ad-hoc runtime code-sign canary

- 新 candidate 只在 repo 外副本上以 `codesign --options runtime` 操作；audit2 required-runtime gate 核對 6 個 code object 均 deep verify、`0x10002(adhoc,runtime)`、helper inventory complete，仍無 Team ID／entitlement。signing operation evidence 為 `docs/project-management/evidence/2026-10-29-fr-021-adhoc-runtime-signing-canary-sign1.json`，audit1 保留為 gate 修正前原件。
- bounded startup probe1／probe2 分別測試 `--single-process`／`--no-zygote`：兩者均無 local page／CDP，child `SIGABRT`／`ELECTRON_EARLY_EXIT`，process group／temporary cleanup 通過；未執行完整 UI／AI flow、Ollama 或模型。`systemNetworkDisabled=false`，control-plane loopback scope 已記錄。
- 本輪只證明 ad-hoc runtime flag 的 identity contrast 與 blocker persistence，不是正式簽章、renderer readiness、offline UI、全機 egress、Windows 或 FR-021 完整驗收。

## 2026-10-29 FR-021 isolated hardened-runtime packaging canary

- repo 外 canary build 成功建立新 macOS arm64 directory candidate，但 builder 明確因 `identity: null` 跳過 macOS code signing；read-only audit 顯示 6 個 code object 全部 deep verify、helper inventory complete，仍全為 ad-hoc、無 Team ID、無 entitlement。
- build scope evidence `docs/project-management/evidence/2026-10-29-fr-021-hardened-runtime-packaging-canary-build1.json` 記錄 requested CLI override、effective identity 未變、既有 candidate 未修改、packaged app／UI／startup probe 未執行、Ollama／model 未動；dependency download occurred 已明確揭露。
- 因未形成有效 security identity 對照，本輪不把 canary 當 signed／hardened pass，也不執行無意義的 renderer replay；後續需另有正規 signing identity／entitlement 的隔離候選，不能由本輪推導 root cause 或 FR-021 completion。
- signing identity availability check `docs/project-management/evidence/2026-10-29-fr-021-hardened-runtime-packaging-canary-signing-identity-check1.json` 記錄 `security find-identity -v -p codesigning` 的 `validIdentityCount: 0`；這是環境能力證據，不是產品 runtime failure。

## 2026-10-28 FR-021 packaged security identity audit

- `scripts/audit-macos-packaged-security-identity.mjs` 以 macOS arm64 read-only 方式核對 current candidate 的主 app、Electron Framework 與所有 helper，保存 bundle identity、binary SHA-256、code-sign flags／CDHash、Team ID、entitlement presence／digest 與 deep verification 結果；不保存 raw command output 或絕對路徑。
- audit3 `docs/project-management/evidence/2026-10-28-fr-021-packaged-security-identity-audit3.json` 為 `pass`：6 個 code object 全部 deep verify 成功，helper inventory complete，但全為 ad-hoc、無 Team ID、無 entitlement；source build config 為 `identity: null`、`hardenedRuntime: false`、`gatekeeperAssess: false`。audit1／audit2 均保留為 immutable 原件，audit3 為修正後 authoritative evidence。
- scope 明確為 metadata audit：candidate 未修改、packaged app／UI 未執行、network 未嘗試、Ollama 未啟停、模型未下載；因此不能推導 nested Chromium 唯一根因、renderer readiness、UI offline、全機 egress、Windows 或 FR-021 完整驗收。後續若進行 packaging canary，須另立 work item 與 immutable candidate／evidence。

## 2026-10-28 FR-021 Chromium nested sandbox process-composition next-stage diagnostic

- 現行 nested profile canary `2026-10-28-fr-021-chromium-nested-profile-composition-canary1.json` status `pass`：same restrictive parent／child 可 exit 0；loopback-only parent 與 Chromium-like network-service child shape 以 `Operation not permitted`／exit 71 fail；只加 explicit TCP／UDP 仍 fail；unrestricted parent pass。它只執行 `/usr/bin/true`，`chromiumNetworkServiceShapeIsExactGeneratedProfile=false`，因此是 profile-composition evidence，不是 packaged UI acceptance。
- 最新 packaged probes `2026-10-28-fr-021-electron-single-process-startup-probe4.json` 與 `2026-10-28-fr-021-electron-no-zygote-startup-probe3.json` 均 status `fail`：兩個變體在 outer loopback-only Seatbelt 下都沒有 local page、沒有 CDP response，child `SIGTRAP`；較早 no-zygote probe2 曾有 local page 但 CDP `Runtime.evaluate` timeout，child `SIGTRAP`，diagnostic categories 含 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`OS_PERMISSION_DENIED`。兩次最新 probe 的 loopback control-plane connections 已明確記錄，external socket 未嘗試，process／temporary cleanup 通過，所有較早 probe evidence 原件保留。
- 兩次 packaged probe 均明確 `uiFlowRun=false`、`packagedUiAcceptanceRun=false`、`existingOllamaDaemonStartedOrStopped=false`、`modelDownloaded=false`、`systemNetworkDisabled=false`；未寫入 raw child output，保留 output digest／bytes。這兩個 flags 只作診斷，未進入 formal acceptance source。
- 開發驗證：canary 與兩次 probe 均使用 exclusive evidence path；probe source `node --check`、focused／完整 check、immutable evidence guard、獨立六面向審查、治理 validator、`git diff --check` 與 `npm run docs:check:final` 均已完成；round2 確認本項僅為 bounded process-composition diagnostic closeout。
- 界線：本階段確認 `--single-process`／`--no-zygote` 不能在不關閉 sandbox 的前提下解除 packaged renderer blocker；不宣稱 Seatbelt packaged UI offline、全機 egress、Windows 或 FR-021 完整驗收。

## 2026-10-28 FR-021 Chromium nested sandbox startup diagnosis

- 新增 failure evidence `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-offline-chromium-workaround-replay1.json`；測試版 runner argv 的固定 startup flags provenance 完整（`argvRedactionValidated=true`、`argvDroppedCount=0`），但 status 仍為 `fail`／`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`，UI 未完成 home／AI flow。Seatbelt loopback／external `EPERM`、preinstalled model／no-download、process／port／temporary cleanup 全部通過；`systemNetworkDisabled=false`。
- bounded startup-only matrix 顯示：`NetworkServiceInProcess2`＋`disable-gpu-sandbox`（含另加 `disable-gpu`）可建立 local HTTP page，但 DevTools page 的 `Runtime.evaluate` 無回應；此不構成 renderer-ready 或 UI pass。未使用 `--no-sandbox`，也未保存 raw child output；本輪診斷建立的明確 process groups 已終止並確認無殘留。
- source hardening 只保留安全修正：loopback DevTools target 不再依賴 transient `title`，home dashboard 探針改為最多 10 秒的 bounded DOM wait，並將 renderer／DevTools timeout 從 startup diagnostic category 分離；無效的 GPU／network startup flags 已撤回，不改產品 runtime、Seatbelt profile 或既有 evidence。
- 開發驗證：`node --check lib/runner-provenance.mjs`、`node --check lib/electron-devtools-target.mjs`、`node --check scripts/verify-electron-ollama-ui.mjs`、`node --check scripts/test-ollama-ui-offline.mjs` 與 `node scripts/test-ollama-ui-offline.mjs` 均 exit 0；完整 `npm run check`、immutable evidence hash／scope guard、round1／round2 獨立審查、治理 validator、`git diff --check` 與 `npm run docs:check:final` 均已通過。
- 界線：這是 blocker diagnosis 與 runner robustness hardening，不是 Seatbelt packaged UI offline pass；全機 egress、Windows、其他模型／版本、offline cancel／resume 與 FR-021 完整驗收仍未完成。

## 2026-10-28 FR-021 Unicode candidate executable argv provenance

- 變更限定於 `lib/runner-provenance.mjs` 的 evidence argv sanitizer 與 `scripts/test-ollama-ui-offline.mjs` deterministic regression：candidate wrapper 改採 Unicode-safe basename boundary，仍拒絕 path／separator／control／`.`／`..`／oversize，且不保存 dropped raw value。
- 驗證結果：`node --check lib/runner-provenance.mjs`、`node --check scripts/test-ollama-ui-offline.mjs`、`node scripts/test-ollama-ui-offline.mjs`、完整 `npm run check` 與 `git diff --check` 均 exit 0；測試固定 `<candidate-executable:離線字幕工廠>` pass，path／dot-name／control／129 字元 candidate fail-closed。
- replay1 immutable evidence 以 jq 唯讀核對 failure／Seatbelt loopback／external `EPERM`／preinstalled no-download／process／port／temporary cleanup／candidate hash 與原始 Unicode drop residual；沒有重播、沒有修改 evidence、沒有產品 runtime／OS network 變更。
- 這只改善未來 evidence provenance 的 localized candidate 可追溯性；不改變 replay1 的 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`SIGTRAP`、`systemNetworkDisabled=false`，不代表 packaged UI offline、全機斷網、Windows 或 FR-021 完整驗收。

## 2026-10-28 FR-021 current-source packaged Ollama UI Seatbelt offline replay

- 新 evidence `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-offline-current-source-replay1.json` status `fail`、`failureCode=CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`failureStage=electron_start`；candidate version `0.52.0`／arm64、executable SHA `b3605c589459068f894a70896b8ed843be3832a839fcdd83aa898e9b16210de4`，Electron UI 未載入，無產品 AI flow pass 宣稱。
- isolation evidence 通過 loopback／external boundary：`loopbackAllowed=true`、`externalSocketDenied=true`、`externalSocketError=EPERM`、`daemonStartedInSandbox=true`、`electronAppStartedInSandbox=true`、`networkSandboxInheritedByElectronAndServer=true`；`systemNetworkDisabled=false` 仍如實記錄。model `llama3.2:1b` 預裝、`modelDownloadAttempted=false`；Electron／driver／daemon／port／temporary cleanup 全通過。
- startup diagnostics 固定為 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`CHROMIUM_GPU_SANDBOX_UNAVAILABLE`、`OS_PERMISSION_DENIED`，Electron signal `SIGTRAP`；這把 current-source packaged UI offline blocker 收斂到 nested Chromium／OS permission startup boundary，但不宣稱唯一 root cause。runner argv redaction false 另因 Unicode candidate basename 被 ASCII allowlist drop，raw path／secret 未保存，列為後續 evidence sanitizer 工作。
- 這是 immutable failure evidence，不覆寫歷史 replay；不能替代 normal loopback pass、不能宣稱 Seatbelt UI offline／全機斷網／Windows／FR-021 完整驗收。

## 2026-10-28 FR-021 shared runner provenance projection contract

- live `scripts/verify-electron-ollama-ui.mjs` 與 offline `scripts/verify-electron-ollama-ui-offline.mjs` 已改由 `lib/runner-provenance.mjs:projectRunnerProvenance()` 產生同一 runner provenance key set；SHA-256、command、argv、framework path、bounded bytes／categories 與 raw-output flag 共用 fail-closed 邏輯。
- `scripts/test-ollama-ui-offline.mjs` 直接比較 shared projection key set，並覆蓋缺失／boxed review.js hash、非法 path、secret／private argv exclusion；syntax、focused UI、provider、完整 `npm run check` 與 `git diff --check` 均通過。
- round1 static probe 發現 shared helper 若接受外部 `argvProjection` 會保留 path／secret；主要代理已改為 helper 只接收 raw argv 並自行套用 `sanitizeRunnerArgv()`，新增 bypass regression，修正後完整 check 通過；既有 round2 report 與 2026-10-29 next1 current-source 審查均確認 bypass 已關閉，治理 closeout 已完成。
- 未新增 live／offline replay；既有 replay4 仍是 normal loopback，只用於唯讀 hash／scope 對照，不代表 Seatbelt offline、全機 egress、Windows 或 FR-021 完整驗收。

## 2026-10-28 FR-021 runner provenance review.js hash schema parity

- `scripts/verify-electron-ollama-ui-offline.mjs` 的 `projectUiEvidence()` 已補投影 `candidateReviewScriptSha256`，只接受 source artifact 的 64-hex `reviewScriptSha256`；與 live runner 的 artifact／runner provenance hash 欄位同名，非法／path／缺失值不保存。
- deterministic regression 覆蓋 valid executable／review.js／Framework hash、invalid review.js path fail-closed 與 source-level field contract；syntax、`node scripts/test-ollama-ui-offline.mjs`、`node scripts/test-ai-providers.mjs`、完整 `npm run check`、`git diff --check` 均通過。
- 既有 replay4 evidence 僅作唯讀 source／candidate provenance 對照，未新增 live／offline run；範圍限 evidence schema parity，不代表 Seatbelt packaged UI offline、全機 egress、Windows 或 FR-021 完整驗收。

## 2026-10-28 FR-021 runner provenance Unicode command identity and live/offline parity

- 變更僅限 evidence provenance contract 與 deterministic regression：新增共用 `sanitizeRunnerCommand()`，以 basename-only 方式允許 Unicode executable identity，拒絕 path／separator／control／empty／`.`／`..`／oversize／非 primitive；live `scripts/verify-electron-ollama-ui.mjs` 與 offline `scripts/verify-electron-ollama-ui-offline.mjs` 使用同一 projection，避免欄位規則分叉。
- `node scripts/test-ollama-ui-offline.mjs`、`node scripts/test-ai-providers.mjs`、語法檢查、`git diff --check` 與完整 `npm run check` 均通過；測試直接固定 `離線字幕工廠` pass、path／secret fail-closed、live/offline projection parity、VM failure evidence redaction 與 raw child output 不落盤。
- packaged replay4 `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay4.json` status `pass`；`runnerProvenance.command`、argv／hash／bounded child-output provenance 與 cancel-resume／save／cleanup assertions 均通過。範圍限 normal loopback：`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`；不代表 Seatbelt offline、全機 egress、Windows 或 FR-021 完整驗收。

## 2026-10-28 FR-021 packaged Ollama UI live evidence runner provenance hardening

- 稽核範圍：只強化 `scripts/verify-electron-ollama-ui.mjs` 的 live evidence provenance projection，沿用 `lib/runner-provenance.mjs` 白名單；不修改產品 runtime、不改 OS network、不下載模型、不發布。既有 replay1／replay2 evidence 保留未覆寫。
- 程式／deterministic 驗證：加入 `runnerProvenance`，包含安全 argv projection、`argvRedactionValidated`／dropped／input counts、sandbox flags、candidate executable／review.js／Framework hashes、Framework path、child-output hash／bytes／capture limit、diagnostic categories 與 `rawChildOutputPersisted=false`；`scripts/test-ollama-ui-offline.mjs` 補 runner VM failure evidence assertions。`node --check scripts/verify-electron-ollama-ui.mjs`、focused UI／provider tests、完整 `npm run check` 與 `git diff --check` 通過。
- Live replay3：`OSF_OLLAMA_UI_SCENARIO=cancel-resume OSF_OLLAMA_UI_ISOLATED_DAEMON=1 OLLAMA_MODEL=llama3.2:1b npm run acceptance:ollama:ui -- ../dist/mac-arm64/離線字幕工廠.app/Contents/MacOS/離線字幕工廠 9999 30000 docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay3.json llama3.2:1b` exit 0，status `pass`、約 13.3 秒；provenance 的 candidate executable／Framework hash 與前一輪一致，argv redaction validated、no raw output；cancel／checkpoint／reload／resume／complete／save assertions 全通過。
- Cleanup／模型：replay3 `preinstalledModelFound=true`、`modelDownloadAttempted=false`、`existingServiceModified=false`、context length 4096；Electron process group、app port、temporary userData、owned daemon process／port／temporary root 全部清理通過。
- 驗證界線：replay3 的 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`、`loopbackOnlyConfiguration=true`、`apiKeySupplied=false`；provenance 可補 candidate／runner 追溯，但不等同 Seatbelt deny-network、真正全機 egress、Windows 或 FR-021 完整驗收。`runnerProvenance.command=null` 是中文 executable basename 未通過 ASCII command projection 的明確 fail-safe 結果，argv／hash 仍有效保存。

## 2026-10-28 FR-021 current-source packaged Ollama UI cancel/resume normal-path replay

- 稽核範圍：沿用 current-source macOS arm64 directory candidate，以預裝 `llama3.2:1b`、獨立本機 Ollama daemon、normal packaged Electron UI 驗證 6 cues／6 batches 的 cancel／checkpoint／同 session reload／resume，並驗證 accept／undo／redo／save 與 cleanup；不修改 OS network、不下載模型、不停止既有桌面 daemon、不發布。
- 初次 failure 保留：`docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay1.json` status `fail`、stage `checkpoint_cancel`、`observedTaskStatus=failed`、`completedBatches=0`；原 fixture 讓 1B 模型在建立第一個可取消 checkpoint 前先產生 translation contract failure。cleanup 的 Electron process group／app port／temporary userData／owned daemon process／port／temporary root 全部通過。
- Fixture 修正：只修改 worktree-only `scripts/verify-electron-ollama-ui.mjs` 的 cancel-resume synthetic fixture，改用短而穩定的中文句，讓本輪測量取消／續跑而非小模型翻譯品質；未修改產品 runtime、candidate bundle 或 normal replay fixture。`node --check scripts/verify-electron-ollama-ui.mjs` 與 `git diff --check` 通過。
- Replay2 evidence：`docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay2.json` status `pass`、elapsed 約 13.7 秒；`cancelled=true`、`retryable=true`、checkpoint `1/6` persisted、checkpoint suggestion count 1、reload 後 session／checkpoint unchanged、resume request accepted、resumed from batch 1、同 session 完成；6 suggestions、accept 6、undo／redo、reviewed.srt 6 cues、timecodes unchanged、English translation 全部通過。
- Candidate／模型／cleanup：replay2 artifact executable／Framework hash 與前一輪 candidate 相同；`preinstalledModelFound=true`、`contextLength=4096`、`modelDownloadAttempted=false`、`existingServiceModified=false`；Electron、app server port、temporary userData 與 owned daemon cleanup 全部通過。
- 驗證界線：replay2 scope 明確為 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`、`loopbackOnlyConfiguration=true`、`apiKeySupplied=false`；它補強 packaged normal UI cancel／resume coverage，不證明 Seatbelt deny-network process tree、真正全機斷網、Windows 或 FR-021 完整驗收。replay1 failure 不被覆寫，兩份 evidence 均為 exclusive path。

## 2026-10-28 FR-021 current-source packaged Ollama UI normal-path replay

- 稽核範圍：以目前 dirty source 建立新的 macOS arm64 directory candidate，靜態核對 BUG-060 native routing／schema／`num_ctx=4096` 已進入 candidate，再以預裝 `llama3.2:1b` 與獨立本機 Ollama daemon 執行 normal packaged UI；不修改 OS network、不下載模型、不停止既有桌面 daemon、不發布。
- Build／candidate：`node scripts/test-ollama-ui-offline.mjs`、`node scripts/test-ai-providers.mjs`、`git diff --check` 均先通過；`npm run electron:build:mac:dir` exit 0，runtime manifest／verify 通過，candidate version `0.52.0`；packaged provider marker 包含 `isLoopbackAiUrl`、`buildOllamaCueResponseFormat`、`num_ctx=4096`、`strictJson=true`，`lib/ai/providers.mjs` 與 worktree source byte-for-byte 相同。candidate executable／Electron Framework hash 與 provider parity 見 `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-normal-replay1-artifact-parity.json`；`scripts/test-ai-providers.mjs` 為 worktree-only deterministic test source，未宣稱屬 packaged runtime。
- Normal UI evidence：`docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-normal-replay1.json` status `pass`、elapsed 約 14.9 秒；settings 儲存 `ollama`／`llama3.2:1b`／loopback、API Key 空值；2 cue optimize completed、2 suggestions、accept 2、undo／redo、reviewed.srt 2 cues、English translation 與 timecodes unchanged 均通過。
- Cleanup／模型：`preinstalledModelFound=true`、`modelDownloadAttempted=false`、`existingServiceModified=false`、context length 4096；Electron process group、app server port、temporary userData 與 owned daemon process／port／temporary root 全部清理通過。
- 驗證界線：此 evidence 的 `sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`、`systemNetworkDisabled=false`；它證明目前 source 已進入 packaged artifact 且 normal loopback UI flow 可用，不證明 Seatbelt deny-network process tree、真正全機斷網、Electron UI offline、Windows 或 FR-021 完整驗收。

## 2026-10-28 BUG-061 BUG-060 provider regression coverage hardening（2026-10-29 bounded closeout）

- 稽核範圍：只補 deterministic `scripts/test-ai-providers.mjs`，鎖定 BUG-060 的 custom native 404 fallback body stripping、proofread／translate exact schema 與 custom native non-404 fail-closed；未修改產品 runtime、未啟動真實 Ollama、未改 OS 網路或發布。
- 測試變更：fallback 第二次 `/v1/chat/completions` request 現逐欄斷言只保留 model／messages、完整 internal metadata 已移除、request 總數固定為 native probe 加一次 fallback；default proofread 直接斷言 operation、root／cues／item required、additionalProperties、ID enum、exact count 與 `text`／`reason` string type，translate 另直接斷言相同 item type／schema；兩者共用 source builder 的欄位契約；custom native HTTP 400／500 與 strict stream failure 各只發出一次 `/api/chat`，不得 fallback。
- 驗證結果：`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs`、完整 `npm run check`、`node scripts/test-project-docs-validator.mjs` 與 `git diff --check` 均 exit 0。這些 assertions 只強化 source contract regression，不擴大為模型品質、live endpoint、Electron UI 或 FR-021 完整驗收。
- 獨立審查／closeout：round1 指出上述 coverage false-negative 風險；round2 報告 `docs/project-management/reviews/2026-10-28-bug-061-regression-coverage-round2.md` 確認既有 fallback／schema／no-fallback coverage，並指出 proofread type 文件精確性 residual；next1 `docs/project-management/reviews/2026-10-29-bug-061-regression-coverage-next1-round1.md` 已確認 direct assertions 與完整 deterministic checks 通過，唯一 finding 為治理同步，已完成 00／06／07／08 closeout。

## 2026-10-28 BUG-060 Ollama translate schema 與 custom loopback routing

- 稽核範圍：承接 1B Seatbelt replay1／replay2 的 `MODEL_RESPONSE_CONTRACT_REJECTED`；確認 custom loopback port 不再繞過 Ollama native request，translate response 以 exact cue schema 約束。未改 Ollama daemon／全域設定／模型檔／OS 網路，不處理 UI、Windows、LM Studio 或發布。
- 根因與修正：acceptance wrapper 使用隨機 loopback port，原 provider 只對 11434 使用 native `/api/chat`；custom port 因而沒有 `num_ctx`／native schema。現在所有 loopback port 使用 native path，translate／proofread 都帶原始 ID／exact count 的 JSON Schema，非 loopback 保留 fallback。
- 程式／focused 驗證：`node --check lib/ai/providers.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs` 通過；regression 覆蓋 default native、custom loopback native、non-loopback fallback、context bound、translate schema、strict stream 與其他 provider boundary。
- 完整與產品驗證：`npm run check` exit 0；最後 source 的 `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-product-offline-replay4.json` status pass，2 suggestions、接受／undo／redo 各 2、雙語保存、timecodes unchanged、source SRT hash 相同、Seatbelt 外連 `EPERM`、預裝／未下載／daemon／port／temporary cleanup 全通過。replay1／replay2 fail evidence 與 replay3 pass evidence 保留，沒有被成功樣本覆寫。
- 界線：目前只證明 macOS arm64、目前 Ollama、預裝 1B、random loopback port 與目前 source；`systemNetworkDisabled=false`，不替代真正全機斷網、Electron UI、取消／續跑、Windows、不同模型／版本或 FR-021 全流程。

## 2026-10-28 BUG-059 Ollama native request context resource bound

- 稽核範圍：承接 FR-021-REPLAY-20261028 的 3B product flow stall；以現有 Ollama loopback logs／受控最小 request 找出 context／KV cache resource overcommit，將固定 `num_ctx=4096` 限定在 Ollama native request。未修改 daemon、全域設定、模型檔、OS 網路、batch size、cue contract 或其他 provider。
- 基準與根因證據：3B 未指定 context 時，Ollama log 記錄 `n_ctx_slot=131072`、KV cache 約 14.3 GiB、預測記憶體約 15.9 GiB、系統記憶體 8.0 GiB／free 約 1.0 GiB；同一最小 `/api/chat` request 60 秒 timeout。相同 request 加 `options.num_ctx=4096` 後實際 provider path 約 1.25 秒完成。
- 程式／focused 驗證：`lib/ai/providers.mjs` 對 Ollama native body 加 `num_ctx=4096`；`scripts/test-ai-providers.mjs` 斷言該欄位及非 Ollama 不帶入；node syntax、provider、Ollama batch stream、optimizer focused tests 通過。
- 產品離線驗收：`docs/project-management/evidence/2026-10-28-ollama-llama3.2-3b-product-offline-replay2.json` status pass；2 suggestions、接受 2、undo／redo 各 2、雙語保存、timecodes unchanged、source SRT preserved／before-after hash 相同；Seatbelt external `EPERM`、預裝模型、未下載、daemon／port／temporary root cleanup 全通過。
- 界線：這只證明目前 macOS arm64、Ollama 0.40.8、預裝 `llama3.2:3b` 與目前 source 在受控 4096 request bound 下完成既有 product probe；不代表所有模型／硬體的效能品質，不替代 Electron UI、取消／續跑、Windows、真正全機斷網或 FR-021 全流程。

## 2026-10-28 FR-021 目前 source 的 Ollama macOS Seatbelt 產品離線驗收重播

- 稽核範圍：以目前工作樹執行既有 `acceptance:ollama:offline` wrapper 與預裝 `llama3.2:3b`，驗證 Seatbelt deny-network／loopback-only、Ollama model preflight、產品兩 cue flow 與 cleanup；另以獨立 loopback product probe 取得 timeout 診斷。未修改產品 source、未下載模型、未改 OS 網路或防火牆。
- 離線 evidence：`docs/project-management/evidence/2026-10-28-ollama-llama3.2-3b-product-offline-replay1.json` 記錄 `status=fail`、`failureStage=product_probe`、`failureCode=MODEL_RESPONSE_CONTRACT_REJECTED`；loopback allowed、external socket `EPERM`、`preinstalledModelFound=true`、`modelDownloadAttempted=false`、daemon／port／temporary root cleanup 全為 true。故 isolation／cleanup 子範圍通過，產品 AI flow 子範圍未通過。
- 診斷 evidence：`docs/project-management/evidence/2026-10-28-ollama-llama3.2-3b-product-live-diagnostic1.json` 只使用 `http://127.0.0.1:11434/v1`，`status=fail`，錯誤為 `實際 Ollama AI 任務等待逾時`（240 秒）；沒有 raw response，不足以把問題歸因為 BUG-058、模型品質或 server runtime。
- 驗證界線：`ollama ps` 唯讀檢查顯示 3B runner 仍載入；未停止既有桌面 Ollama。上述 evidence 是目前本機／目前模型／單次 run，不能代替不同模型／版本、Electron UI、取消／續跑、Windows、真正全機斷網或 FR-021 整體驗收。
- 結案：兩份 immutable fail evidence 已保留；適用 deterministic／docs regression、round1／round2 六面向審查與 `npm run docs:check:final` 均完成。除非取得新的診斷方向，不以重播堆疊成功樣本掩蓋本次 timeout／contract failure；本項結案只代表失敗結果可追溯，不代表 product AI flow 或 FR-021 通過。

## 2026-10-28 BUG-058 Ollama strict stream parser failure abort underlying request

- 稽核範圍：承接 BUG-057 的 pending cancel／底層 response teardown residual；只修改共用 streaming reader 的 request-local abort hook 與 deterministic provider tests，不啟動真實 Ollama、模型下載、UI、封裝或發布。
- 需求／控制：`BUG-058`、`BUG-057`、`BUG-056`、`FR-008`、`FR-010`、`FR-021`、`NFR-005`；strict parser／decoder `AiProviderError` failure 必須先 abort 同一 fetch signal，再沿用 250ms bounded cancel／release；正常 EOF、provider error、non-strict provider 不額外 abort；原始 invalid encoding／invalid JSON、timeout／取消／network error 分類不回歸。
- 程式變更：`readStreamingJson()` 在 failure-only cleanup 捕捉原始 `AiProviderError`，先呼叫 request-local abort callback，再執行既有 bounded cancel／release；`requestAiJson()` 將 timeout controller abort callback 傳入 reader，其他 provider 仍不啟用 strict parser failure path。
- focused 驗證：`scripts/test-ai-providers.mjs` 補正常 EOF 不 abort signal、strict parser failure abort underlying signal、250ms bounded cleanup／release、reader timeout 與 cleanup failure 原始分類保留；既有 Ollama strict encoding／framing、provider error 與 non-strict compatibility tests 保留。
- 完整驗證與獨立審查：focused、完整 `npm run check`、`git diff --check`、round1／round2 六面向獨立審查、`node scripts/test-project-docs-validator.mjs` 與 `npm run docs:check:final` 均已通過；所有結果仍限 deterministic／fixture，不等同真實 Ollama endpoint、模型品質、斷網或 FR-021 完整驗收。
- 遺留風險：abort 只提供 underlying request teardown 的 best-effort signal，不證明 live socket／stream 已物理回收；尚無真實 Ollama raw response、不同模型／版本或 Windows evidence。

## 2026-10-22 BUG-057 Ollama strict reader cancel bounded cleanup

- 稽核範圍：承接 BUG-056 的 cancel promise hanging residual risk；只修改共用 streaming reader 的 failure cleanup timeout 與 deterministic provider tests，不啟動真實 Ollama、模型下載、UI、封裝或發布。
- 需求／控制：`BUG-057`、`BUG-056`、`FR-008`、`FR-010`、`FR-021`、`NFR-005`；failure path 的 `reader.cancel()` 最多等待固定 250ms，逾時後仍 release lock，cancel／timeout／release exception 不得覆蓋原始錯誤；正常 EOF 不啟動 cleanup timer，既有 invalid encoding、timeout／取消、transport 分類與非 strict 行為不回歸。
- 程式變更：`readStreamingJson()` 對 failure-only cancel 使用 cancel promise 與 250ms timeout race；cancel rejection 轉為已處理的 cleanup 結果，timeout 後繼續 release lock，正常完成不建立 timer。
- focused 驗證：`scripts/test-ai-providers.mjs` 補 cancel 永不 settle 的 watchdog、cancel／release 同時失敗與既有正常 EOF／decoder／reader rejection／外部取消 assertions；既有 Ollama strict encoding／framing 與 non-strict compatibility tests 保留。
- 完整驗證與獨立審查：focused、完整 `npm run check`、`git diff --check`、round1／round2 六面向獨立審查、`node scripts/test-project-docs-validator.mjs` 與 `npm run docs:check:final` 均已通過；所有結果仍限 deterministic／fixture，不等同真實 Ollama endpoint、模型品質、斷網或 FR-021 完整驗收。
- 遺留風險：尚無真實 Ollama raw response、不同模型／版本或 Windows evidence；本輪固定 250ms 是 cleanup latency 契約，不證明底層 live stream 在 timeout 後已完成物理 resource teardown。

## 2026-10-22 BUG-056 Ollama strict reader 失敗後釋放與取消

- 稽核範圍：承接 BUG-055 的 reader lifecycle residual risk；只修改共用 streaming reader 的 failure cleanup 與 deterministic provider tests，不啟動真實 Ollama、模型下載、UI、封裝或發布。
- 需求／控制：`BUG-056`、`BUG-055`、`FR-008`、`FR-010`、`FR-021`、`NFR-005`；strict reader 正常 EOF 必須 release lock，decoder failure、reader rejection 或外部取消必須 best-effort cancel 並 release lock，cleanup failure 不得覆蓋原始錯誤；既有 invalid encoding、timeout／取消／transport 分類與非 strict 行為不回歸。
- 程式變更：`readStreamingJson()` 以完成旗標區分正常 EOF 與 failure path；正常完成只 release lock，failure path 先 best-effort `reader.cancel()` 再 release lock，兩者 cleanup exception 均被吞回以保留原始錯誤。
- focused 驗證：`scripts/test-ai-providers.mjs` 補 fake reader lifecycle probe，覆蓋正常 EOF（不 cancel／release）、decoder failure、reader transport rejection（cancel failure 不遮蔽 network error）與外部取消；既有 Ollama strict encoding／framing 與 non-strict compatibility tests 保留。
- 完整驗證與獨立審查：focused、完整 `npm run check`、`git diff --check`、round1／round2 六面向獨立審查、`node scripts/test-project-docs-validator.mjs` 與 `npm run docs:check:final` 均已通過；所有結果仍限 deterministic／fixture，不等同真實 Ollama endpoint、模型品質、斷網或 FR-021 完整驗收。
- 遺留風險：尚無真實 Ollama raw response、不同模型／版本或 Windows evidence；本輪僅證明 response reader lifecycle 的 deterministic contract，不代表 live server／OS stream implementation 的所有行為。

## 2026-10-22 BUG-055 Ollama NDJSON 無效 UTF-8 串流 fail-closed（2026-10-29 bounded closeout）

- 稽核範圍：承接 BUG-054 的 Ollama streaming byte／framing 邊界；只修改共用 streaming transport 的 opt-in strict decoder、Ollama native adapter 旗標與 deterministic provider／batch tests，不啟動真實 Ollama、模型下載、UI、封裝或發布。
- 需求／控制：`BUG-055`、`FR-008`、`FR-010`、`FR-021`、`NFR-005`；Ollama native strict stream 遇到無效 UTF-8 或 EOF 未完成 byte sequence 必須在 parser／repair 前轉為不可重試的 `ollama_stream_invalid_encoding`，缺少 raw-byte reader 時以不可重試的 `ollama_stream_encoding_unavailable` fail-closed；有效跨 chunk UTF-8 必須保留，不得進 repair／retry 或寫 checkpoint；共用 transport 預設非 strict 行為、malformed NDJSON、provider error、timeout／取消不回歸。
- 程式變更：`readStreamingJson()` 僅在 `streamOptions.strictEncoding` 下使用 fatal UTF-8 decoder，並於 EOF flush；decoder failure 建立指定 `invalidEncodingCode` 的 `AiProviderError`，無 `arrayBuffer()` 的 strict response 建立指定 `encodingUnavailableCode`，而 `arrayBuffer()` 讀取的 abort／timeout／transport rejection 交回既有 `requestAiJson()` 分類。Ollama native path 啟用 `strictEncoding=true`／`ollama_stream_invalid_encoding`／`ollama_stream_encoding_unavailable`；其他 provider 維持預設非 strict。
- focused 驗證：`node --check lib/ai/openai-compatible.mjs`、`node --check lib/ai/providers.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs`、`node --check scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`git diff --check` 均 exit 0。測試覆蓋合法跨 chunk UTF-8、invalid byte、truncated final sequence、無 byte reader、fallback abort／timeout／transport rejection、既有 malformed／provider error 與 optimizer 不 repair／不 retry／不 checkpoint。
- 完整驗證與獨立審查：focused、完整 `npm run check`、`git diff --check` 均已通過；round1 六面向獨立審查報告為 `docs/project-management/reviews/2026-10-29-bug-055-ollama-strict-utf8-next1-round1.md`，結論有條件通過，唯一 finding 為 08 治理欄位尚未完成，已由主要代理回填；`npm run docs:check:final` 於回填後執行。所有結果仍限 deterministic／fixture，不等同真實 Ollama endpoint、模型品質、斷網或 FR-021 完整驗收。
- 遺留風險：尚無真實 Ollama raw response、不同模型／版本或 Windows evidence；非 strict provider 仍保留既有 decoder 相容行為，strict response 依 byte-level capability 缺失明確 fail-closed。

## 2026-10-21 BUG-054 Ollama malformed NDJSON 串流 fail-closed

- 稽核範圍：承接 BUG-053 的 Ollama streaming framing 風險；只修改共用 streaming transport 的 opt-in strict parse、Ollama native adapter 啟用旗標與 deterministic provider／batch tests，不啟動真實 Ollama、模型下載、UI、封裝或發布。
- 需求／控制：`BUG-054`、`FR-008`、`FR-010`、`FR-021`、`NFR-005`；Ollama native 任一非空 malformed NDJSON record 必須在 parser／repair 前轉為不可重試的 `ollama_stream_invalid_json`，不得靜默丟棄、降成 `empty_content`、進 repair／retry 或寫 checkpoint；正常 stream、BUG-053 provider error、timeout／取消與其他 provider 行為不回歸。
- 程式變更：`mergeStreamingRecords()`／`readStreamingJson()` 新增 opt-in `streamOptions.strictJson` 與可指定 error code；`requestAiJson()` 將 options 傳入 streaming reader；只有 `optimizeOllamaNative()` 啟用 `strictJson=true` 與 `ollama_stream_invalid_json`，共用 transport 預設仍為非 strict。
- focused 驗證：`node --check lib/ai/openai-compatible.mjs`、`node --check lib/ai/providers.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs`、`node --check scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node --check lib/ai/subtitle-optimizer.mjs`、`node scripts/test-ai-optimizer.mjs` 均 exit 0。測試覆蓋 malformed-only、合法片段前後 malformed、共用 transport 非 strict、正常 NDJSON、provider error、optimizer 不 repair／不 retry／不 checkpoint。
- 完整驗證與獨立審查：開發 focused 已通過；完整 `npm run check`、`git diff --check` 與獨立六面向審查待完成，完成後再寫入本條目結案證據與 final gate。所有結果仍限 deterministic／fixture，不等同真實 Ollama endpoint、模型品質、斷網或 FR-021 完整驗收。
- 遺留風險：真實 Ollama 可能使用不同 framing 或非 JSON transport 形狀；本輪只保護 Ollama native HTTP 200 NDJSON 的非空 malformed record，未驗證所有模型／版本與 Windows。

## 2026-10-21 BUG-053 Ollama NDJSON 串流 provider error fail-closed

- 稽核範圍：承接 BUG-052 後的 Ollama native streaming 邊界；只修改 Ollama adapter 的 HTTP 200 NDJSON `error` 分流與 deterministic provider／batch tests，不啟動真實 Ollama、模型下載、UI、封裝或發布。
- 需求／控制：`BUG-053`、`FR-008`、`FR-010`、`FR-021`、`NFR-005`；單筆或部分 content 後的明確 stream error 必須保留為不可重試的 `ollama_stream_error`，不得誤分類為 `empty_content`、進 JSON repair、重試或寫入 checkpoint；正常多段串流仍須通過。
- 程式變更：`optimizeOllamaNative()` 在 `requestAiJson(..., streamResponse: true)` 回傳後檢查 `error` 欄位，保留 provider detail（最多 500 字）並建立 `AiProviderError`；`retryable=false`，不改共用 parser、endpoint 或 request body。
- focused 驗證：`node --check lib/ai/providers.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs`、`node --check scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node --check lib/ai/subtitle-optimizer.mjs`、`node scripts/test-ai-optimizer.mjs` 均 exit 0。測試覆蓋單筆 error、部分 JSON 後 error、正常 NDJSON、optimizer 不 repair／不 retry／不 checkpoint。
- 完整驗證與獨立審查：focused、完整 `npm run check`、`git diff --check`、round1／round2 六面向獨立審查與 `npm run docs:check:final` 均已通過；所有結果仍限 deterministic／fixture，不等同真實 Ollama endpoint、模型品質、斷網或 FR-021 完整驗收。
- 遺留風險：真實 Ollama 可能使用未涵蓋的 error payload 形狀或在 HTTP／transport 層失敗；本輪只保護原生 NDJSON 明確 `error` 欄位，未驗證所有模型／版本與 Windows。

## 2026-10-21 BUG-052 Ollama 空回應錯誤分類與一次性修復

- 稽核範圍：承接 SYNC-030 留下的 `message.content` 空字串分類缺口；只修改 AI optimizer parser 的錯誤 code／Ollama repair 分流與 deterministic optimizer tests，不啟動真實 Ollama、LM Studio、模型下載、UI、封裝或發布。
- 需求／控制：`BUG-052`、`FR-008`、`FR-010`、`FR-021`、`NFR-005`；空白／缺失內容須為 `empty_content`，Ollama 最多一次 repair，非 Ollama strict failure，repair 結果仍經 cue ID／數量／順序／文字驗證且失敗不得寫 checkpoint。
- 程式變更：`parseCompletionContent()` 在沒有可解析內容時建立 `error.code=empty_content`；`canRepairLocalJson()` 僅對 `provider=ollama` 擴大接受此 code，LM Studio 仍維持既有 compatibility-only 的 `invalid_json`／`missing_cues` repair；repair prompt 明示上一回應可能未回傳內容。
- focused 驗證：`node --check lib/ai/subtitle-optimizer.mjs`、`node --check scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs` 均 exit 0。optimizer test 覆蓋 Ollama 空白／缺失 `message.content`→一次 repair、repair 後仍空白→兩次後明確失敗且無 checkpoint、非 Ollama 空回應→只一次 strict failure。
- 完整驗證與獨立審查：完整 `npm run check`、`git diff --check` 與 round1 六面向獨立審查均已通過其適用範圍；round1 唯一條件為 08 結案欄位與 final gate，已由主要代理補正。所有結果仍限 deterministic／fixture，不等同真實 Ollama 模型品質、斷網或 FR-021 完整驗收。
- 遺留風險：真實 endpoint／模型仍可能產生空回應、malformed JSON 或 cue contract／語言／品質錯誤；本輪只改善分類與一次性 repair 邊界，不保證生成成功。

## 2026-10-21 SYNC-028／BUG-051 GitHub AI 校稿回應修正同步

- 稽核範圍：目前 `0.52.0` 分支與 GitHub `origin/codex/ai-cues-response-repair@056d2ad71d8b3ea982be9ccbceba19b9e98760b3` 的 AI cue JSON parser／測試／功能設計差異；僅整合與本輪需求直接相關的 `d0aeddb`、`3f8df97` 內容與其必要設計／測試脈絡，未帶入遠端舊 `main` 歷史或無關治理變更。既有未追蹤 evidence 未修改；LM Studio 案例僅作 compatibility regression，Ollama 才是 active 本機 provider。
- 程式與測試結果：`node --check lib/ai/subtitle-optimizer.mjs`、`node --check scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-fetch.mjs` 均 exit 0。AI optimizer 回歸涵蓋 root array、`cues` wrapper、text-part、Markdown fence／周邊說明、巢狀 wrapper 負向界線、Ollama active path 的單次 local repair；LM Studio 案例只保留既有 compatibility regression，另驗證 JSON Schema response format 保留與非 local provider strict failure。
- parser 邊界：只有根陣列或明確 `cues` 陣列可成為 cue list；巢狀 wrapper 的無關陣列／巢狀根陣列不被誤收；缺少 `cues` 的本機 provider 最多修復一次；JSON Schema 不被 `json_object` 覆寫。上述測試以 deterministic mock 驗證格式與狀態機，不等同真實 Ollama／LM Studio 模型品質或 FR-021 完整人工流程驗收。
- 完整檢查：本輪 focused tests 後執行完整 `npm run check`，exit 0；包含 19 份治理文件、全套核心 regression、AI provider／optimizer、Ollama offline／UI／stream 與 YouTube publisher／SDK／stream／lifecycle suites。`git diff --check` exit 0。`npm run docs:check:final` 保留至獨立審查結論同步後執行；若文件結案或獨立審查任一失敗，維持未結案並依證據修正／複審。
- 風險界線：本輪未修改 provider 以外的 server／UI／封裝流程，未新增真實模型 endpoint 驗收；parser 對模型回應格式的容錯擴張仍需保留 explicit cue boundary 與巢狀負向回歸。LM Studio deterministic cases 不構成 active support／實機驗收，後續本機開發與驗收聚焦 Ollama。

## 2026-10-20 FR-027 v0.52.0 GitHub Release 已公開：round16 PASS

- GitHub Release [v0.52.0](https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.52.0) 已於 2026-10-20 公開並設為 Latest；annotated tag 指向 source `b6b1efd6b72574f9210af74729d2cb2fd869e42d`。round16 六面向獨立審查判 **PASS**，未發現發布阻擋；原報告 `docs/project-management/reviews/2026-10-20-fr-027-v0520-github-publication-round16.md`。round15 對 b2b942e 的 BLOCK 及本輪同步修正亦見 round15 原報告。
- GitHub API 實際 asset 資料與本機候選 digest／size 相同，七項下載 URL 均 HEAD 200，且回傳 Content-Length 相符；Release body 與 `RELEASE-NOTES-0.52.0.md` 完全一致：

| GitHub asset | 大小（bytes） | SHA-256 |
|---|---:|---|
| [offline-subtitle-factory-0.52.0-macos-arm64.dmg](https://github.com/twyderek/offline-subtitle-factory-app/releases/download/v0.52.0/offline-subtitle-factory-0.52.0-macos-arm64.dmg) | 246877219 | `1e3ebbd5fc3408128ae21b907f868390b3684eb5044af3b819a29ae5a0136142` |
| [offline-subtitle-factory-0.52.0-macos-arm64.zip](https://github.com/twyderek/offline-subtitle-factory-app/releases/download/v0.52.0/offline-subtitle-factory-0.52.0-macos-arm64.zip) | 255845260 | `974e61503e6f6bf91d3714f0c9772e314873787e71d51a38fec91f0e52a1574d` |
| [offline-subtitle-factory-0.52.0-macos-arm64.dmg.blockmap](https://github.com/twyderek/offline-subtitle-factory-app/releases/download/v0.52.0/offline-subtitle-factory-0.52.0-macos-arm64.dmg.blockmap) | 258016 | `d214392c2a982a6d868f266a34dd9d86768a715449c1360d8bb66c21985c5a0f` |
| [offline-subtitle-factory-0.52.0-macos-arm64.zip.blockmap](https://github.com/twyderek/offline-subtitle-factory-app/releases/download/v0.52.0/offline-subtitle-factory-0.52.0-macos-arm64.zip.blockmap) | 266378 | `71b533cb356aa2610021121f1044fe55e39aef98fc81abcad100401371d246d3` |
| [latest-mac.yml](https://github.com/twyderek/offline-subtitle-factory-app/releases/download/v0.52.0/latest-mac.yml) | 570 | `5b89c3bf8e0520d423073b33bb56240278f26a9bbafb827675eb186be686daf0` |
| [SHA256SUMS-macos-arm64.txt](https://github.com/twyderek/offline-subtitle-factory-app/releases/download/v0.52.0/SHA256SUMS-macos-arm64.txt) | 474 | `585212385955567a5afdc0a2e231213f20f92591cabf45b9321d9db09c00c895` |
| [SIGNING-STATUS-macos-arm64.txt](https://github.com/twyderek/offline-subtitle-factory-app/releases/download/v0.52.0/SIGNING-STATUS-macos-arm64.txt) | 367 | `ef3664a2714bac93c6aa945433100c392ca7b587a9820c0a41ba5e20cf0e9f64` |

- 候選 DMG `hdiutil verify` VALID、ZIP `unzip -tq` 無錯、strict deep codesign、app version／arm64 與 bundled runtime 驗證通過；signature 是 ad-hoc，無 Developer ID／公證，Gatekeeper 未驗收。`latest-mac.yml` 兩項大小及 SHA-512 與 candidate bytes 相符；本地 SHA-256 sidecar 四項全數 OK。
- b6b1efd 的 `npm run check` 最終 exit 0（含 19 份治理文件、核心 regression 與 YouTube suites），`npm audit --omit=dev` 0 vulnerabilities，`git diff --check` 及 tracked-source 隱私／credential scan 通過。首次 `npm run check` 與 CPU-heavy ZIP 打包並行時，在 Python child-close cancellation assertion 失敗；打包結束後單獨 `node scripts/test-core.mjs` 及完整 `npm run check` 均通過，且中間沒有來源變更。round16 將首次失敗列為非阻擋的高負載時序風險。
- 同源 Windows run `39382252222` completed/success，artifact `12246485809`／504801579 bytes／API digest `sha256:526b42de4dafc98955781905c5be6f9c4c9a827f685a8882fb382daf94d6248b`。三次相同 500,000-byte ZIP tail range read（總回傳 1,500,000 bytes、unique interval 500,000 bytes）驗證 7-entry central directory、manifest/checksum CRC／size、manifest sidecar SHA 與 73/73 shared app raw hashes。完整 Windows ZIP 未下載，無 whole-archive integrity claim；該 unsigned preview 未上傳。
- UI smoke `googleRequests=false`、12 renderer cases／layout/usability controls 通過；3 秒合成片 `currentTime=0.000444`、`paused=true`，不證明有效播放／完整轉錄。真實 Google OAuth／Keychain／頻道影片與字幕上傳、Windows 實機、Gatekeeper 仍未驗收；`GHSA-hp3w-g68c-fv3c` moderate build-time advisory、round12 唯一限縮 source-archive 個人路徑例外均在公開說明揭露。`npm run docs:check:final` 於本次 Release／assets 核對後執行，結果記入最新 08 closeout。

## 2026-10-20 FR-027 v0.52.0 round15 BLOCK：治理狀態與已完成證據不一致

- round15 審查對象 source `b2b942eb6d941e61f1a5a27e065e51dd8c31e26f`。round14 的個人 Windows user-profile blocker 已修正；round15 確認 source、macOS arm64 candidate、exact-source Windows CI/hash gate 於其聲明範圍通過，但因 `00`／`05`／`06`／`08` 仍標示上述修正及 b2b942e 驗證待完成而判 BLOCK。獨立報告：`docs/project-management/reviews/2026-10-20-fr-027-v0520-github-publication-round15.md`，其餘六面向證據與 P1 請查原報告。
- b2b942e source `npm run check` exit 0（19 份治理文件、完整核心回歸與 YouTube suites）；`npm audit --omit=dev` 0 vulnerabilities。對 tracked files 的 POSIX／Windows user-profile scan 排除 round12 明確授權原件後，僅在 `scripts/test-breeze-asr.mjs`、`scripts/test-ollama-ui-offline.mjs`、`scripts/test-report-optimizations.mjs` 命中通用合成測試 fixture；round15 逐項判斷非機器專屬個資，未發現其他未授權個人路徑。Round12 原件唯一例外依 README／Release notes 持續揭露。
- macOS arm64 候選 `../dist/release-0.52.0-macos-b2b942e-normal/`：DMG 246,876,207 bytes／SHA-256 `d503f44a76b066ead4298eb7c7f63066b79cfb18e271f17a1b6384d379396b22`；ZIP 255,845,260 bytes／SHA-256 `68fc2bb6c8d50ffe19c39a3750083348d4f8df50e80a1b88e42ce336f37b7c2b`。四項 DMG／ZIP／blockmap SHA-256 sidecar、`latest-mac.yml` size／SHA-512、DMG `hdiutil verify`、ZIP `unzip -tq`、strict deep codesign、0.52.0／arm64、packaged runtime verifier 均通過。Candidate 為 ad-hoc signature，無 Developer ID／公證，Gatekeeper 未驗收。
- Packaged UI/layout/usability smoke 通過，`googleRequests=false`，cleanup 成功；3 秒合成影片主 smoke `currentTime=0.000176`、`paused=true`，不證明有效播放／完整轉錄／字幕品質；未驗收真實 Google OAuth／Keychain／頻道授權、影片或字幕上傳。
- exact-source Windows run `39380574427` success，head SHA 與 b2b942e 相同；artifact `12244799752`／`offline-subtitle-factory-0.52.0-windows-x64`／504,801,641 bytes，GitHub API digest `sha256:626b3a708d6eb073c72de1cdaff842dcd80dd53a94be33812bef0ddf3d8ab52c`。單一 authenticated 500,000-byte ZIP tail range 的所選 manifest／checksum entries CRC／size 有效，manifest SHA-256 與 sidecar 相符，73/73 shared app raw hashes 相同。完整 Windows ZIP 未下載，無 whole-archive integrity claim；該 unsigned artifact 是 preview，不是本次公開資產或實機驗收。
- round15 P1 已由本輪建立的新 08 工作項目承接：本文件及 `00`／`05`／`08` 同步實際 round14 修正與 b2b942e gates；source SHA 將因此改變，新 SHA 的完整 source check、macOS candidate、exact-source Windows CI/hash gate 與 round16 尚未完成。`docs:check:final` 按 `workflows/06-BUILD-RELEASE.md`／`07-DOCUMENT-CLOSEOUT.md` 留至發布及資產核對後執行。GitHub 仍無 v0.52.0 tag／Release／assets，Latest 為 v0.51.0。

## 2026-10-20 FR-027 v0.52.0 round14 BLOCK：額外 Windows profile 路徑未授權

- round14 對 source `3312c373f688b425bfb51d5dee8c65bdc53c7954` 的 macOS candidate、exact-source Windows CI／73/73 hashes 及 round13 blockers closure 判定通過，但整體 BLOCK。Tracked-source scan 在 `NEXT-VERSION-FIX-LOG.md:27` 發現一處具名 Windows user-profile 絕對路徑；`git ls-tree` 證明檔案受追蹤，`git archive HEAD` 會將它包含於公開 source archive。該路徑不在需求方對 round12 報告內一處路徑的限縮授權範圍。
- 先前清理將 60 份 project-management 文件的 145 處歷史 home path 及 NEXT-VERSION-FIX-LOG 中一處識別字串列為已去識別；round14 發現原掃描未覆蓋 Windows user-profile pattern，故先前「只剩 round12 例外與合成 fixture」結論不完整。round14 報告與歷史原件保留不修改；round14 所核 `3312c37` candidate provenance 不得沿用作修正後 source 的隱私證據。
- 本輪已在 `NEXT-VERSION-FIX-LOG.md` 以 `<developer-machine-python-install-path>` 取代可識別路徑，並更新 README／Release notes 使 home／Windows user-profile 去識別與唯一 round12 例外的描述一致。新 source SHA 的完整 check、production audit、涵蓋 POSIX／Windows 個人 profile 的 tracked-source scan、macOS arm64 candidate、exact-source Windows CI／manifest sidecar／73-file hash gate、round15 獨立審查均待執行；通過前不得 tag／Release／上傳。
- round14 run `39378546407`／artifact `12243614840` 與 candidate 只作前輪歷史技術證據；artifact 只抽查一個 500,000-byte ZIP tail range，完整 ZIP 未下載。真實 Google／Keychain／影片字幕上傳、有效播放／完整轉錄、Windows 實機／完整 archive integrity、Developer ID／公證／Gatekeeper 仍未驗收。

## 2026-10-20 FR-027 v0.52.0 round13 BLOCK 證據已同步；新來源待驗

- round13 對象 source SHA `21d8b077b0bb25af02de5562e000660f6912bef3`；獨立報告 `docs/project-management/reviews/2026-10-20-fr-027-v0520-github-publication-round13.md` 判整體 BLOCK。技術證據為該 SHA 的 macOS arm64 candidate、exact-source Windows run `39376042653`／artifact `12243556843`、range manifest 73/73 hashes；blockers 是 `00`／`05`／`06`／`08` 未同步其實際結果，以及舊 readiness entry 仍要求發布前 `docs:check:final`。
- source `21d8b07` 上 `npm run check` exit 0、`npm audit --omit=dev` 0 vulnerabilities、`git diff --check` 通過。candidate `../dist/release-0.52.0-macos-21d8b07-normal/` 的 DMG `hdiutil verify` VALID、ZIP `unzip -tq` clean、strict deep codesign、packaged runtime、0.52.0／arm64、`latest-mac.yml` size／SHA-512 與四項 SHA-256 sidecar 通過。DMG 262,456,410 bytes／SHA-256 `7b8249561f805cf18e67e432a8b3a9ccb1d4e6139a5769e2a4ade707c4096018`；ZIP 256,484,567 bytes／`baff4e76a666c8e78d3ab8cd0d9d0fdbd6c3425536fac750e63a9443e4354426`。
- packaged UI/layout/usability smoke exit 0、`googleRequests=false`、process/profile cleanup 成功；3 秒合成影片主 smoke `currentTime=0.000187`、`paused=true`，comparison `0.000283` 秒，均非有效播放／全長轉錄驗收。候選 `PROVENANCE.txt` 記錄所有 macOS checks 與簽章限制。
- exact-source Windows run `39376042653` completed/success，artifact `12243556843`／504,801,519 bytes、未過期。單一 500,000-byte ZIP tail range 中 central directory 7 entries，manifest／checksum entry CRC 與 size 有效，manifest SHA-256 `9bf2044268a32f500806a2340b774acc71410fab4af9cc0c5c631c0044ab45da` 與 artifact checksum sidecar 相符；source／version 正確，73/73 shared app raw hashes 相同、0 mismatch。完整 Windows ZIP 未下載，故不宣稱 whole-archive integrity；unsigned artifact 是內部 preview，不是 Windows 發布 asset。證據：`../dist/release-0.52.0-macos-21d8b07-normal/windows-ci-source-manifest-range-check-39376042653.json`。
- round13 的 `npm run docs:check:final` 實際 exit 1，因當時最新工作項目尚未完成且 round13 綜合判定 BLOCK。其後本工作項目已將 21d8 結果同步至 `00`／`05`／`06`／`08`，並正式取代舊 readiness pre-release final-gate 指令。依通用 `workflows/06-BUILD-RELEASE.md` 與 `workflows/07-DOCUMENT-CLOSEOUT.md`，發布前仍須 source tests、final-source candidate／exact-source CI／hash gate 及無阻擋獨立審查；`docs:check:final` 於發行 asset 核對後執行。此時序仍交 round14 獨立確認。21d8 的證據只作已完成的上一輪；文件修正提交後的新 source SHA 必須重新驗證。真實 Google／Keychain／上傳、有效播放／轉錄、完整 Windows ZIP／實機、Developer ID／公證／Gatekeeper 仍未驗收。

## 2026-10-20 FR-027 v0.52.0 round12 blocker 證據同步與新來源待重驗

- round12 審查對象 source SHA `85203c86112584d54e034257b83ca1e4eb3f924c`；需求方於 2026-10-20 明確指示「照原樣公開報告」，知情接受其獨立原件 `docs/project-management/reviews/2026-10-20-fr-027-v0520-github-publication-round12.md` 含一處本機家目錄絕對路徑，因此該 reviewer 原件將不改寫並納入公開 source；此授權不涵蓋其他本機路徑。綜合判定為 BLOCK；報告確認該來源 macOS arm64 候選、exact-source Windows CI 與 73/73 shared-file hash gate 通過；BLOCK 原因是當時 `00`／`05`／`06`／`08` 未記錄這批結果，round11 報告被 final validator 判 schema 不合格，且當時 readiness 工作紀錄將 `docs:check:final` 列為發布前條件而實際 exit 1。round13 將獨立重審最終 source、候選與 CI，並檢查此已明確授權的公開例外及其揭露。
- `85203c8` macOS 候選目錄：`../dist/release-0.52.0-macos-85203c8-normal/`。`hdiutil verify` 回報 DMG VALID，`unzip -tq` ZIP clean，strict deep codesign、packaged runtime 與版本／arm64 核對通過；`latest-mac.yml` 大小／SHA-512 及四項 SHA-256 sidecar 相符。DMG 262,456,250 bytes／SHA-256 `e692f083ca4e69b445db43173e1756a536c29c9e4c7dab903b8eca9ba27f7ed3`；ZIP 256,484,362 bytes／SHA-256 `780deb834670abf495eca6dee7e74b16b22cc327aec1fadd31a25e366dad30b5`。此為 ad-hoc；無 Developer ID／公證，Gatekeeper 未測。
- exact-source Windows run `39370147881` success，artifact `12240369026`／504,801,173 bytes。HTTP byte-range 只取回 436,117 bytes；manifest SHA-256 `5e7279cef48ad213356668ad124c1deb3d18c784c726089de714a52355df52b1` 與 sidecar 相符，manifest source/version 正確，73/73 shared app raw hashes 相同、0 mismatch。完整 Windows ZIP 未下載，故不宣稱 whole-archive integrity；這是 internal unsigned preview，不是 Windows 發布資產或實機驗收。證據摘要：`../dist/release-0.52.0-macos-85203c8-normal/windows-ci-source-manifest-range-check-39370147881.json`。
- packaged UI/layout/usability smoke exit 0，沒有觀察到 Google requests，cleanup 的 process group/profile 均已移除；主 smoke 對 3 秒合成片記錄 `currentTime=0.000194`、`paused=true`，comparison 為 `0.000623` 秒。這不構成有效播放、全長轉錄、真實 Google OAuth／Keychain／影片或字幕上傳驗收。候選 provenance：`../dist/release-0.52.0-macos-85203c8-normal/PROVENANCE.txt`。
- source `85203c8` 上 `npm run check` exit 0、`npm audit --omit=dev` 0 vulnerabilities、`git diff --check` 通過；round12 對 `npm run docs:check:final` 的實際結果為 exit 1，見上述獨立報告。現行同步 00／05／06／08 的變更會形成新 SHA，因此 85203c8 結果只作上一輪證據；新的最終 SHA 必須重新執行完整 check、macOS arm64 candidate、exact-source Windows CI／manifest hash gate，並交 round13 六面向獨立複審。release-ready 的 pre-release gates 與 post-release 文件結案分開；`docs:check:final` 時序目前依 `workflows/07-DOCUMENT-CLOSEOUT.md` 列為發布後工作，待 round13 獨立確認。真實 Google／Keychain／上傳、有效播放／轉錄、完整 Windows ZIP／實機、Developer ID／公證／Gatekeeper 仍未驗收。

## 2026-10-20 FR-027 v0.52.0 round11 blocker 狀態同步與 1f6b207 exact-source 候選（下一次文件提交後需再驗）

- round11 審查對象為 source SHA `871ce1c02363dafcc13a441464467234613778ab`；該 SHA 的 macOS arm64 candidate 與 Windows exact-source CI run `39364278830` 成功，artifact `12238252981`，73/73 個跨平台共用 app 檔案 raw hashes 相符。round11 報告 `docs/project-management/reviews/2026-10-20-fr-027-v0520-github-publication-round11.md` 判 BLOCK，唯一 P1 為 `00`／`05`／`06`／`08` 未記錄上述成功證據；round10 的 source path 措辭與 smoke provenance finding 已解除。
- 對該 BLOCK 的狀態同步 commit `1f6b2077912c44bd4ceeed7d756bbe83fdbfa33e` 執行 `npm run check` exit 0（19 個治理文件、完整 regression 與四組 YouTube suites），`npm audit --omit=dev` 為 0 vulnerabilities；tracked-source 個人路徑掃描僅命中 `scripts/test-breeze-asr.mjs` 的中性合成 fixture。此 SHA 的 macOS arm64 candidate 位於 `../dist/release-0.52.0-macos-1f6b207-normal/`：DMG `hdiutil verify` VALID、ZIP `unzip -tq` 無錯、strict deep codesign 與 packaged runtime 驗證通過，Info.plist／Mach-O 為 0.52.0／arm64。`latest-mac.yml` 所列 DMG／ZIP 大小及 SHA-512 與檔案 bytes 相符；四項 SHA-256 sidecar 全數 OK。DMG 262,456,289 bytes／SHA-256 `f6b1e8609750b8893490c80a7ecfe27e850f8f1153154a0dd865308de97dadce`；ZIP 256,484,363 bytes／SHA-256 `e9d9f89563701a5ed9a29365de5c31b9a080689ee3509f55b4e2ee8ba6e74270`。
- 該候選 packaged UI/layout/usability smoke exit 0、無 Google requests，cleanup 確認程序及 profile 移除。主 JSON 的 3 秒合成片 `currentTime=0.000315`、`paused=true`；比較 JSON 為 `0.000603` 秒，兩者都不證明有效播放／完整轉錄。exact-source Windows run `39366360693` success，artifact `12239512142`（504,801,128 bytes）；byte-range 只取回 436,072 bytes，manifest／checksum entry CRC 與 size 通過、manifest SHA-256 `1e75780187b5a92693f66d5070683eb13d834b54457ed95c8053c443756ae026` 與 sidecar 相符，73/73 shared app raw hashes 相同，完整 Windows ZIP 未下載。證據：`../dist/release-0.52.0-macos-1f6b207-normal/windows-ci-source-manifest-range-check-39366360693.json`。
- 本次追蹤文件增補會形成另一個 source SHA；上述 `1f6b207` candidate/run 僅作已完成的前一輪證據，最終來源仍須重新跑完整 check、候選、同源 CI／manifest gate，並完成 round12。真實 Google OAuth／Keychain／頻道影片字幕上傳、Developer ID／公證／Gatekeeper、Windows 實機與完整 Windows ZIP 均未驗收。

## 2026-10-20 FR-027 v0.52.0 line-ending 修正候選（歷史候選，未發布）

- 來源：本機 `codex/0.51-anthropic-claude@a8e839f3321ac1ea06525261baa8a2da7fe7637b`；唯一 source delta 是 `.github/workflows/windows-preview.yml`：checkout 前設定 `core.autocrlf=false`、checkout action 使用 `GIT_CONFIG_COUNT` override、checkout 後斷言設定值。此 workflow-only change 尚未由 CI 執行。此前 `1c045e7` run `39342333188` 的 73 個共享檔案 raw hash 只有 6 個相同、67 個 Windows CRLF／macOS LF 不同；這是未通過的舊 gate，不可外推至新 SHA。
- 新候選目錄：`../dist/release-0.52.0-macos-a8e839f-normal/`；Node.js 22.22.3／Electron 43.8.0／electron-builder 26.17.0，macOS arm64。DMG `hdiutil verify` VALID；ZIP `unzip -tq` clean；`codesign --verify --deep --strict` pass；`latest-mac.yml` ZIP size 256,484,010、DMG size 262,455,945 及 SHA-512 均與實體 bytes 相符；SHA-256 sidecar 四項重新計算。與前一候選比對 `Contents/Resources/app` 排除 platform `node_modules` 的 73 個路徑／bytes 全相同；全 `.app` 895 entries 中 3 項不同（Mach-O launcher、runtime `tools/manifest.json` 的 build-generated timestamp、對應 ad-hoc signature resource），不宣稱整個 bundle byte-identical。
- exact `a8e839f` unpacked candidate UI/layout/usability verifier：首輪於 CDP `Fetch.disable` timeout，產生 cleanup evidence，確認 group closed、`forcedCleanup=false`、profile removed；以新 evidence path retry exit 0。renderer fixture 12/12、四 viewport measurement、YouTube modal／鍵盤／錯誤保留、字幕 edit-save-reload 與無 Google requests 通過。evidence family `../dist/release-0.52.0-macos-a8e839f-normal/youtube-ui-smoke-retry1.png*`。其 3 秒合成影片播放 currentTime 僅 0.000525 秒，故不視為有效播放／全長播放／轉錄驗收；未執行真實 Google／Keychain／上傳。
- 新候選 `SHA256SUMS-macos-arm64.txt` 已重建；簽章為 ad-hoc，無 Developer ID／公證，Gatekeeper 未測。Production dependency audit 過去為 0；build-time advisory 與真實 Google 功能缺口依已接受範圍於公開說明揭露。GitHub Latest 仍 v0.51.0，尚無 v0.52.0 tag／Release。
- 發布門檻：round6 六面向獨立複審已完成；同源 Windows CI run `39351138322` success，artifact `12233128155` 的 manifest self-checksum 與 73 個共享檔 raw hashes 通過。範圍證據摘要為 `../dist/release-0.52.0-macos-a8e839f-normal/windows-ci-source-manifest-range-check-39351138322.json`。完整 artifact ZIP 未下載，沒有 whole-archive integrity claim。仍需 round7 獨立複審及 `docs:check:final`；未通過前不建立 tag／Release 或上傳資產。
- round6 獨立發布審查報告 `docs/project-management/reviews/2026-10-20-fr-027-v0.52.0-github-release-round6.md` 判定 **BLOCK**。P1 是此 exact source SHA 尚無 CI run／artifact；報告確認 workflow 設定靜態合理，但無法替代後續 Windows checkout／packaging 的實際 raw-hash 驗證。審查者獨立重跑完整 `npm run check`、YAML parse、diff check 與候選 SHA／ZIP／DMG／codesign 驗證，均通過；`actionlint` 未安裝。GitHub 唯讀狀態：遠端 branch 仍 `1c045e7`、`a8e839f` run list 空、Latest `v0.51.0`、`v0.52.0` tag／Release 不存在。審查代理未 push／tag／Release／upload，且唯一新增檔案為其報告。
- round7 報告 `docs/project-management/reviews/2026-10-20-fr-027-v0.52.0-github-release-round7.md` 獨立重驗 run `39351138322`／artifact `12233128155`，manifest sidecar 與 73/73 raw hashes 通過；完整 ZIP 未下載，whole-archive integrity 不宣稱。round7 因當時最新工作紀錄未 closeout、`docs:check:final` 失敗而作 BLOCK 結論；其報告格式也未提供 checker 要求的固定六個標題／逐字可引用結論句，因此保留原件。候選 readiness 階段後續已由 schema-compliant round8 完成，且該階段 `docs:check:final` 通過；公開發布另立工作紀錄。

## 2026-10-20 FR-027 v0.52.0 round10 blocker remediation（進行中）

- round9 獨立審查 `docs/project-management/reviews/2026-10-20-fr-027-v0520-github-publication-round9.md` 判定 BLOCK：舊 candidate source archive 內 `docs/project-management/` 有 60 份文件共 145 行包含個人 home 絕對路徑；`NEXT-VERSION-FIX-LOG.md` 另有 1 行，故本輪一併納入清理；README／Release notes 未揭露 source archive 內容，且未說明 UI smoke 的合成影片僅前進 0.000525 秒。需求方已選擇移除路徑並重跑 CI／候選驗證／複審，不以風險接受取代清理。
- 60 份治理文件／145 行與 `NEXT-VERSION-FIX-LOG.md` 1 行已將帳號識別的 home prefix 去識別，並保留 `scripts/test-breeze-asr.mjs` 中性合成 fixture。round10 發現三處歷史 review／worklog 描述仍列出易混淆的 home／private temporary path token，工作樹已改為中性文字；round10 亦發現主 smoke JSON `currentTime=0.000484` 與比較 JSON `0.000847` 未在 candidate provenance 區分。round10 審查 BLOCK；此輪變更後須重跑 `npm run check`、確認全 tracked source 的非中性個人路徑清零、提交新 SHA、重建 macOS arm64 candidate、執行 exact-SHA Windows preview CI／73-file manifest gate，更新 candidate provenance，並完成 round11 review。舊 `a8e839f`、`aaee1d9` 候選均不得作為本次發布來源；尚無 tag／Release／上傳。
- round10 獨立報告 `docs/project-management/reviews/2026-10-20-fr-027-v0520-github-publication-round10.md` 的完整結論為 BLOCK：「指定 source 仍有 3 個非中性的歷史 home-directory 引用會進入公開原始碼封存，且清理與 provenance 宣稱不符；先去識別並以新 SHA 重建、重核候選及同源 CI，才可進入 tag／Release 階段。」報告確認 candidate package checks 與 exact-SHA Windows 73/73 shared-file hash gate 通過，但未把 byte-range 抽查擴稱完整 Windows archive integrity。

## 2026-10-19 FR-027 v0.52.0 macOS arm64 GitHub 發行候選

- 發行候選來源當時為 `codex/0.51-anthropic-claude@95176592746b51953d6f7e4f80e7a55a977f9c7f`；branch base `299ff5d4288b9d50e356db8b0a5ae349dcb23ebc` 至當時候選差異為 46 個 tracked 路徑，未提交治理紀錄、歷史 evidence／review 未納入 Release commit。候選 `PROVENANCE.txt` 分別說明 commit diff、electron-builder app allowlist（含 unchanged root `NEXT-VERSION-FIX-LOG.md` 的既有工作站絕對路徑）與 GitHub tag source archive 的完整 tracked tree／本機未提交內容排除範圍。
- 最新 macOS 候選位於工作區外 `dist/release-0.52.0-macos-9517659-normal/`。新增 workflow commit 後首次與其他唯讀檢查併行跑 `npm run check` 時，`test-core` async job wait 失敗；未修改測試或產品程式，單獨重跑 `npm run check` exit 0，包含治理文件、語法、全套 regression 與 `test:youtube` 四套測試。`npm audit --omit=dev` 為 0 vulnerabilities；完整 audit 的 8 個 moderate paths 均屬 `GHSA-hp3w-g68c-fv3c` electron-builder build-time dependency chain，無已列上游修補版，需求方已接受揭露後發布。
- DMG `hdiutil verify` 為 VALID，ZIP `unzip -tq` 無錯誤，`.app` `codesign --verify --deep --strict` 通過；Info.plist version 為 0.52.0、主執行檔為 Mach-O arm64。最終 ZIP 為 256,484,008 bytes，`latest-mac.yml` URL／size／Base64 SHA-512 與檔案 bytes 精確相符；SHA256SUMS 的 DMG、ZIP 與兩個 blockmap 均 `shasum -c` 通過。
- 從唯讀掛載的 DMG app 與 ZIP 解壓 app 分別執行 `scripts/verify-youtube-ui.mjs ... --candidate-native=... --validate-layout --validate-usability`：DMG 與 ZIP fresh-path retry exit 0；隔離 profile、3 秒合成 media 下 review task／字幕保存重載、版面與控制可達均通過，YouTube renderer fixture 各 12/12、`googleRequests=false`。ZIP 首次在 `Page.captureScreenshot` timeout，失敗 evidence 保留；cleanup 記錄 process group 關閉確認、`forcedCleanup=false`、profile 已移除，fresh-path retry 通過。成功封裝的 executable SHA-256 同為 `ba8d8345eafc7f94ffc101b43afe9bbef1b54135ddbb7f6fd34eedc758884618`，main SHA-256 同為 `b5fdf9f8a621332f4cf75ed9220ba40b9af67d4bee5f34c6a03eeb38e87bdb05`。全部截圖／JSON 證據保留於上述候選目錄。
- 此 smoke 不涵蓋全長播放／轉錄、使用者資料、真實 Google OAuth／Keychain／頻道授權與影片字幕上傳；macOS 開發機 smoke 不代表其他 macOS 安裝／Gatekeeper、Developer ID／公證或 Windows 實機驗收。Windows 不在 0.52.0 資產範圍。
- Release round1–round4 獨立審查報告均保留於 `docs/project-management/reviews/2026-10-19-fr-027-v0.52.0-github-release-round<N>.md`；round4 判定 BLOCK，workflow 靜態實作未發現缺陷，exact-source CI artifact／跨平台共享檔案比對尚無。run `39302030556` 因 committed `00-CURRENT-STATUS.md` 版本舊值失敗；docs-only 修正後 run `39308587730` 通過 docs:check／核心 tests，但 `scripts/test-youtube.mjs:93` 在 Windows 的 POSIX mode assertion 預期 0600、實際回傳 438（0666），導致 YouTube suite 失敗、封裝／上傳 skipped。已記 BUG-050；需修正跨平台測試契約、完整回歸、更新 candidate source SHA 並重跑 CI。最新 macOS arm64 build 為 `80a46a2...`；DMG verify、ZIP integrity、codesign、0.52.0/arm64、README source copy 及 app `Resources/app`（排除 node_modules）與前一通過 smoke 候選逐檔相同，但本輪 DMG smoke 首次 `Runtime.evaluate` timeout，cleanup JSON 已保存，fresh-path retry 待執行。B1 README 及 B2 provenance 已於先前候選修正；新 SHA provenance／checksums／UI smoke 尚待更新。`npm run docs:check:final` 與正式發布尚未完成。

### 最新 0.52.0 release candidate：source `1c045e7`（2026-10-20）

- 來源：`codex/0.51-anthropic-claude@1c045e7fff77049ff084126e3dc59e602fc60918`；base `299ff5d4288b9d50e356db8b0a5ae349dcb23ebc` 至 HEAD 為 47 個 tracked paths。與 `80a46a2` 相比只新增 `scripts/test-youtube.mjs` 的 BUG-050 test contract 修正；`package.json` allowlist 不含 scripts，macOS `Contents/Resources/app`（排除 platform `node_modules`）與前候選逐檔相同。README source copy `cmp` 通過。
- 新候選 `dist/release-0.52.0-macos-1c045e7-normal/` 由新 HEAD 建置，Node.js 22.22.3／Electron 43.8.0／electron-builder 26.17.0，macOS arm64。DMG `hdiutil verify` VALID；ZIP `unzip -tq` clean；`codesign --verify --deep --strict` pass；Info.plist 0.52.0、Mach-O arm64。`latest-mac.yml` ZIP size 256,484,009、DMG size 262,455,742 與 Base64 SHA-512 均對應 bytes；四項 SHA-256 sidecar 均 `OK`。ZIP SHA256 `99e65ec1b71509cb82ab27f2f1b6ccce5419f0e2b6f44763c8d0122aad7b8331`；DMG SHA256 `d37637c15827bf3825b787eaa3ee218282ce35e657b66730aaa6dfa907db028a`。
- packaged UI：DMG smoke 首次通過；ZIP 初次 `Runtime.evaluate` timeout、第二次 fresh-path UI smoke timeout，兩次 cleanup 均 group closed／`forcedCleanup=false`／profile removed；第三次從 fresh ZIP extraction 執行通過。DMG／ZIP 成功結果皆 renderer fixture 12/12、no Google requests、版面／控制可達；原始兩份 JSON 分別記錄合成影片 duration 3 秒、`currentTime=0.000723`／`0.000624`、`paused=true`。round5 reviewer 指出原 runner 只斷言 `currentTime > 0` 並據此不認定播放通過。為釐清，主代理暫時將本機驗證腳本等待／斷言收緊至至少 0.2 秒，對同一 build 產出的 `mac-arm64/離線字幕工廠.app` 重測成功：`playback-retest.png.json` 記錄 duration 3 秒、`currentTime=0.211941`、paused=true；renderer fixture 12/12、無 Google requests，cleanup group closed／`forcedCleanup=false`／profile removed。PNG 在暫停後擷取，未驗證全長播放、轉錄、字幕任務完成、真實 OAuth／Keychain／影片字幕上傳或 full transcription。臨時 verifier 修改已還原，release source 仍為 commit `1c045e7`。Evidence 為 `dmg-smoke.png`、`zip-smoke.png`、`zip-smoke-retry1.png`、`zip-smoke-retry2.png`、`playback-retest.png` 各 evidence family；四份原 smoke cleanup 與新 retest cleanup 均確認程序與 profile 清理成功。新候選 app executable SHA-256 `ca4569d7e94d1d7a36ff4f1519dd804cd8684ba5a40a5d31706b52054f2b88a9`，main SHA-256 `b5fdf9f8a621332f4cf75ed9220ba40b9af67d4bee5f34c6a03eeb38e87bdb05`。
- 同 SHA Windows preview run `39342333188` 完整成功，source regression、unsigned preview package、packaged renderer/install lifecycle、archive checksum、manifest 與 artifact upload steps 均通過；Authenticode-signed path 因未配置簽章密鑰而跳過。artifact `offline-subtitle-factory-0.52.0-windows-x64` metadata ID `12229946561`、size 504,802,958 bytes、head SHA `1c045e7fff77049ff084126e3dc59e602fc60918`。為避免下載 505 MB 整包逾時，主代理以 HTTP byte-range 從精確 artifact ZIP 取 central directory、manifest 與 SHA sidecar；manifest SHA-256 `3d528488bd238cca1b5123c1a28bfe44e14aece45694641f488a80159b2749b3` 與其同包 checksum 一致，版本／source SHA 正確，73 個相對路徑集合與 macOS app 完全相同。raw bytes 只有 6/73 相同；其餘 67 個文字檔在 Mac LF→Windows CRLF 正規化後 SHA 全相同，無其餘文字或二進位 mismatch。這不是 byte-identical gate pass；診斷紀錄 `../dist/release-0.52.0-macos-1c045e7-normal/windows-ci-source-manifest-range-check-39342333188.json` 說明完整 archive 未下載及範圍。根因為 Windows checkout 的 line-ending conversion（與 `core.autocrlf` 一致）；已在本機 workflow 加 pre-checkout config、checkout env override 及 post-checkout assertion，等待新 source commit／CI 驗證。round5 BLOCK 的 P1 未解除；無 `v0.52.0` tag／Release。

## 2026-10-19 FR-027 封裝候選驗收工具邊界補強

- 新增 `scripts/youtube-ui-cli.mjs` 將 native target 解析與 candidate bundle preflight 獨立化：重複 source／installed／candidate、混用 target、bare／空值／錯誤 candidate option 均明確拒絕；candidate 必須是非 symlink `.app` 目錄，含一般檔案 `Contents/Resources/app/package.json` 與可執行的 `Contents/MacOS/離線字幕工廠`。檢查發生在建立隔離 profile 或啟動 Electron 之前。
- `scripts/test-youtube-ui-cli.mjs` 測試選項及有效／錯誤 bundle，並以子程序整合驗證重複 target 和一般檔案 `.app` 在 evidence 寫入前 exit 1。測試限 macOS 權限位元判斷在 Windows 不適用時略過；bundle 目標本身是 macOS。
- `scripts/verify-youtube-ui.mjs` 將 `rendererStateFixture` 完整結果寫入 usability JSON。新 replay 指令：`node scripts/verify-youtube-ui.mjs docs/project-management/evidence/2026-10-19-packaged-youtube-ui-v2.png --candidate-native='<candidate.app>' --validate-layout --validate-usability`，exit 0。候選實際啟動、3 秒長合成 MP4 的播放有開始（currentTime 有進展；非全長播放驗收）、字幕保存／重載／還原通過；原生 1100×700 與 22 controls／八 viewport layout 驗證通過。YouTube usability JSON 記錄四尺寸量測、錯誤輪詢後保持，以及 12 個 state cases（`passed=true`、`videoStarts=1`、`realGoogleRequests=false`）；清理 JSON 確認 process group closed／absent、`forcedCleanup=false`、profile removed。
- 負向 focused tests `node scripts/test-youtube-ui-cli.mjs`、`node --check scripts/youtube-ui-cli.mjs && node --check scripts/test-youtube-ui-cli.mjs && node --check scripts/verify-youtube-ui.mjs`、完整 `npm run check`（19 個治理文件、npm test 與 posttest 四份 YouTube suites）及 `git diff --check` 均 exit 0。PNG／JSON／cleanup 為新 v2 路徑；v1 與既有 evidence 保留，未改產品 runtime／已安裝版、未使用真實 Google 或上傳。獨立審查與 final gate 待完成。
- round1 獨立審查發現 `Contents` 中介 symlink 可指向 bundle 外的 package／executable，故此工作尚不可結案；原報告保留於 `docs/project-management/reviews/2026-10-19-fr-027-candidate-validation-tool-hardening-round1.md`。修正後 validator 逐層 `lstat` 拒絕 `Contents`、`Contents/Resources`、`Contents/Resources/app`、`Contents/MacOS` symlink／非目錄，並以 realpath containment 再確認 package 與 executable 在 `.app` 內；新增上述三種指向外部 bundle 目錄的直接與 verifier 子程序 fail-before-evidence 案例。修正後 `node --check scripts/youtube-ui-cli.mjs && node --check scripts/test-youtube-ui-cli.mjs && node scripts/test-youtube-ui-cli.mjs` 及完整 `npm run check` 均 exit 0；round2 與 final gate 待完成。
- 修正後另以唯讀 `validateCandidateApp` 對既有實際 0.51.0 candidate bundle preflight，正確解析包內 app root 與可執行檔，exit 0；未啟動 App，此項不取代前述 smoke evidence。
- round2 獨立複審確認 symlink 外逸修正有效，但發現 `--installed-native=value`／`--source-native=value` 靜默變成無 target，可能回退 source Electron；報告保留於 `docs/project-management/reviews/2026-10-19-fr-027-candidate-validation-tool-hardening-round2.md`。新增 parser 對帶值／拼錯 boolean target 拒絕及 direct／verifier integration cases，覆蓋 `--installed-native=typo`、`--source-native=typo`、`--installed-native-typo`；另直接與 verifier 子程序測試 `Contents`、`Contents/Resources`、`Contents/Resources/app`、`Contents/MacOS` 四層外部 directory symlink 均 fail-closed。子程序以 fixture `TMPDIR` 執行，明確確認 invalid invocation 不建立隔離 user-data profile，也不寫 screenshot evidence。修正後 focused suite、工具 syntax、完整 `npm run check`（19 個治理文件、全套 tests、四份 YouTube posttest suites）均 exit 0。round3 獨立複審與 final gate 待完成。
- round3 獨立複審確認 round1／round2 findings 已解除與 focused tests 通過，但獨立 parser probe 發現 `--instaled-native` 仍回退至預設 source target；報告原件 `docs/project-management/reviews/2026-10-19-fr-027-candidate-validation-tool-hardening-round3.md` 保留。現改用 verifier 選項白名單拒絕未知 `--...`，並新增 `--instaled-native`／`--sorce-native`、未知 option 直接與 subprocess regression；負向子程序以 fixture `TMPDIR` 確認不建立 profile 或 screenshot。修正後 focused suite／syntax 與完整 `npm run check`（19 文件、全套 tests、四份 YouTube posttest suites）均 exit 0；round4 複審與 final gate 待完成。
- `npm run docs:check:final` 首次結案嘗試 exit 1：validator 指出 round4 獨立報告缺少固定 `- 阻擋問題（若有）：` 欄位及「若上述聲明不實，本報告無效。」聲明行。round4 報告原件不修改；08 記錄保留其結果與 validator 缺項，改由 round5 獨立上下文重作完整 schema-compliant 複審。產品／工具程式未因此回復或改動。
- round5 合規報告 `docs/project-management/reviews/2026-10-19-fr-027-candidate-validation-tool-hardening-round5.md` 另發現單破折號未知 option `-x` 仍被靜默忽略。parser 現拒絕任意未知 dash option、額外 positional arguments；verifier 要求 evidence path 先於 flags。新增 `-x` direct／verifier subprocess case，沿用 fixture `TMPDIR` 確認無 profile／screenshot side effect；另測試 option 誤佔 evidence 第一參數時 fail before file/profile。修正後 focused suite、三個工具 syntax 及完整 `npm run check`（19 個治理文件、全套 tests、四份 YouTube posttest suites）均 exit 0；round6 獨立複審與 final gate 待完成。
- round6 獨立六面向複審 `docs/project-management/reviews/2026-10-19-fr-027-candidate-validation-tool-hardening-round6.md` 通過且 schema validator `errors=[]`。Reviewer 自行重跑三個 syntax checks／focused suite、probe known／unknown／positional／evidence-order cases，並唯讀 preflight 實際候選成功；未啟動 App。主代理完整 check 與 `npm run docs:check:final` 結案 gate 通過，細節見最新 08。

## 2026-10-19 FR-027 macOS arm64 unpacked 開發候選驗證

- 封裝指令以隔離輸出目錄 `../dist/test-build-0.51.0-youtube-ui-20261019` 執行 `electron-builder --mac --arm64 --dir --publish never`，exit 0。候選 .app 約 514 MB；既有 runtime manifest 先以 `npm run runtime:verify:mac` 唯讀通過，本次未執行 manifest writer。
- Bundle 驗證：`codesign --verify --deep --strict --verbose=2 '<candidate.app>'` exit 0；`OFFLINE_SUBTITLE_TOOLS_DIR='<candidate.app>/Contents/Resources/tools' node scripts/verify-runtime-package.mjs --target=darwin-arm64` exit 0，包內 FFmpeg／FFprobe／Whisper CLI／Tiny manifest hashes 及本機 runtime smoke 通過。候選版本 0.51.0；主 executable SHA-256 `33b07e6837ee74124304d84fb51cee2683db2da9dd7f991b6f5f997752a8652c`，候選 `public/styles.css` SHA-256 `d01405c728ecc439da868b28974c0accbd6c8da959075154c627b0ed71672f02`，與 source 一致。Builder 依 `identity:null` 未簽 Developer ID，afterPack ad-hoc signature 可驗證；未 notarize。Build log 的 `asar:false` 警告仍存在，本輪不變更封裝格式。
- 原生驗收：`node scripts/verify-youtube-ui.mjs docs/project-management/evidence/2026-10-19-packaged-youtube-ui-v1.png --candidate-native='<candidate.app>' --validate-layout --validate-usability` exit 0。使用 candidate executable、隔離 userData、合成 3 秒 MP4／單 cue；首頁與校閱頁載入，影片播放、譯文編輯→保存→重載→還原→再讀回通過。candidate 的 index／review HTML／CSS／app.js／review.js runtime hashes 均與目前 source 對應；已安裝版僅作唯讀 reference。
- 實際 native window resize 成功：outer 1100×700／content 1100×668；workspace right=1100、viewer.right=612.13、editor.left=624.13／right=1088、video.right=597.13，無水平溢出或影片遮住播放鍵。22 controls 均 scrollIntoView 後位於 viewport、elementFromPoint 命中且 `pageScrollY=0`。另外 viewport 模擬 1400×900、1281×800、1280×800、1241×700、1240×700、1200×700、1100×700、1100×668，各 22 controls 均可達。展開 AI＋長文字 focus 亦保留 header 並可水平容納；該 fixture 未送 AI 請求或保存長文字。
- YouTube packaged UI／本機 mock：1400／1280／1100 寬 modal/footer、按鈕樣式、播放、OAuth 未設定錯誤 1900ms 輪詢後保持、Tab／Escape／Enter／focus return 及 renderer state 12 cases 通過；`googleRequests=false`、影片 start 僅一次。1024 是壓力量測且不在支援斷言內。畫面所見「AI 狀態恢復失敗：找不到 AI 優化任務」來自合成 fixture 沒有 AI task，不是 AI 功能驗收結果。
- 清理：`cleanup.json` 記錄自有 process group `groupClosedConfirmed=true`／`groupAbsentAfterCleanup=true`、`forcedCleanup=false`、profile `profileRemoved=true`。已安裝版本 executable／CSS SHA-256 重查仍為 `73c1628f71286a89cc14d174ed90513117823debf34d88c5a71b88ccb4b57d2e`／`a75c3284e181336c243e7317e945db9d46712ea10c0d7a92cc02192eff0a9bd3`，未安裝或替換候選。
- 回歸：`node --check scripts/verify-youtube-ui.mjs && node --check scripts/compare-installed-ui.mjs`、`npm run check`（含全套核心回歸及 posttest 四份 YouTube suites）、`git diff --check` 均 exit 0；文件 final gate 與獨立審查結論見本輪 08。
- 獨立審查：round1 原件 `docs/project-management/reviews/2026-10-19-fr-027-macos-unpacked-candidate-validation-round1.md` 保留；`validateReviewReport` 回報缺少實際運行判定／綜合結論／完整引用等格式欄位，因此未作 final gate 依據。round2 報告 `docs/project-management/reviews/2026-10-19-fr-027-macos-unpacked-candidate-validation-round2.md` 依六面向複核，`validateReviewReport` errors=[]；結論有條件通過，無本地 smoke 阻擋問題。round2 reviewer 是依本輪 source、bundle、既存 evidence 獨立核對，未重播候選；其檢視與本代理的本地執行結果分別記錄，不混稱為 reviewer 新跑的測試。
- 證據：`docs/project-management/evidence/2026-10-19-packaged-youtube-ui-v1.png.comparison.json`（hash／幾何／布局）、同名前綴 `.json`（YouTube usability）、`.cleanup.json`、`.native-1100x700.png` 與八張 `.layout-<size>.png`。
- 限制：這是 514 MB unpacked `.app` 的本機啟動 smoke，不是 DMG／ZIP 安裝生命週期或乾淨帳號驗收；未驗證 Developer ID／公證／Gatekeeper、Windows、完整轉錄／長片輸出、真實 Google OAuth／Keychain／頻道與上傳。它證明本候選包基本 UI／runtime 可啟動並執行有限任務，不代表 FR-027 或整體產品已可交付。

## 2026-10-19 BUG-049 布局修正驗證

- `node scripts/verify-youtube-ui.mjs docs/project-management/evidence/2026-10-19-review-layout-fix-v10.png --source-native --validate-layout` exit0；真實source Electron、自有profile／合成3秒MP4／單cue，先完成播放及譯文保存重載、還原再讀回。
- window.resizeTo實際生效，量得outer1100×700、content1100×668（未使用emulation前）；native截圖為 `.native-1100x700.png`。workspace right1100，viewer.right612.13／editor.left624.13／editor.right1088，兩panel.bottom656≤668，無水平內容溢出。native22個控制scrollIntoView後rect／elementFromPoint命中且pageScrollY0；這是可達／命中驗證，不表示已點擊所有可能變更資料的按鈕。
- 同一真實Electron頁面另以viewport模擬8案：1400×900、1281×800、1280×800、1241×700、1240×700、1200×700、1100×700、1100×668，workspace／viewer／editor／video邊界與水平scrollWidth斷言、每案22個控制可達均通過。1400保留左右工作區，窄尺寸工具列換行並左右各自捲動，不以hidden裁掉內容。
- AI展開＋textarea填入長字串與450px高度、focus後捲到欄內：expanded=true、horizontalFits=true、hit=true、pageScrollY0；`.expanded-ai-long-subtitle.png`留證。該案不送真實AI請求、不保存此長字串，不當長字幕資料完整性驗收。
- v10 comparison.json保存本輪CSS SHA與layout證據；cleanup.json確認groupAbsent／groupClosed／profileRemoved=true、forcedCleanup=false。PNG為App renderer內容，不包含OS框；OS縮放與新安裝包／Windows未驗收。
- 最後CSS上的YouTube回歸：`verify-youtube-ui.mjs ...2026-10-19-review-layout-youtube-regression-v2.png --validate-usability` exit0，原生dialog鍵盤／錯誤保持／同意與iframe12案通過。完整npm run check（含四份YouTube suites）exit0；新增helper及compare helper node --check、git diff --check exit0。獨立審查與final gate結果見08。
- 獨立審查已另行重跑原生／8 viewport／22控制與stageBurn設定補測，結果及證據歸屬見本輪round1報告與08；非主代理實測的項目不併稱開發驗證。共用comparison JSON的limitations沿用「Native default window only; resizing...not varied」舊字串，但本輪明確layout.nativeResize.applied=true及outer量測證明最小視窗已實際resize；不可用舊共用字串否定實測，亦不把8 viewport擴稱8組原生resize。此為非阻擋工具改善，保留原始證據不覆寫。
- 早期v1–v6因中間寬度內容溢出／影片蓋住playPause的真實斷言失敗保留；v7首次版面通過；v8原生17控制通過，但長文字focus截圖暴露root頁面被捲走（當時未斷言pageScrollY），不當最終通過證據。v9補主grid／側欄捲動與pageScrollY驗證，v10補側欄控制及品牌單行後通過。各輪證據不覆寫；只有v10代表本輪最終布局。

## 2026-10-19 已安裝前端與開發版再次複核

- 使用者補充確認現行版就是/Applications版，且檢核網頁不足以作對照。已追加真正已安裝executable（自己的main/server）與source Electron各自啟動，非Fetch替換：`node scripts/verify-youtube-ui.mjs docs/project-management/evidence/2026-10-19-native-installed-v4.png --installed-native` 與 `...2026-10-19-native-source-v4.png --source-native` 皆exit0。各兩張home／review App內容PNG、comparison.json與cleanup.json；兩版皆播放／譯文編輯保存重載／還原後再次重載讀回成功，未讀取使用者既有profile。
- 原生預設視窗實際量測：installed content1400×817、outer1400×849；source content1400×819、outer1400×851。不同於預設設計1400×900，受可用螢幕／視窗框限制，未獨立歸因2px差異；不是像素精確等同。主配置仍同側欄／左播放器／右編輯器，source主要多YT頂列入口。PNG為實際App renderer內容截圖，不含OS視窗框；不是另製檢核頁。原生resize未完成，三尺寸證據仍只屬前端viewport模擬。
- 識別：installed executable SHA73c1628f71286a89cc14d174ed90513117823debf34d88c5a71b88ccb4b57d2e，source Electron SHA34465676648bf5e5892e8f7791929be7ee01973a5317260f4f741ab7110cfef6；各自main script SHA另見JSON。v4兩份cleanup均groupClosedConfirmed=true、groupAbsentAfterCleanup=true、forcedCleanup=false、profileRemoved=true。使用者原有App程序保持運行。
- native早期v1因Electron無Browser.getWindowForTarget而失敗，未稱resize通過；installed-v2量測完成但SIGTERM收尾timeout exit1，後續確認測試App已退出再清自有fixture profile。新增native detached process group並重用cleanupProcessGroup，v3兩版exit0；v4另依round1建議加入還原後二次重載查證。保留所有舊原件，不把cleanup失敗稱完整成功。

- 基準：唯讀已安裝版本與 source 均為 0.51.0；不以版本字串判定 bytes 一致。index.html SHA 相同，review.html 僅新增 YouTube 入口／module；CSS 主要為 YouTube scoped rules 及頂列 min-width／grid 修正，app.js／review.js 另有先前輪詢／AI 修正，非整套主布局重寫。
- 指令：`node scripts/verify-youtube-ui.mjs docs/project-management/evidence/2026-10-19-installed-comparison-v3.png --compare-installed --validate-usability` exit0；共12張同場home／review截圖，兩份JSON分開保存frontend對照及YT量測。以Fetch攔截讀已安裝public，不啟動已安裝App、使用者profile或真實專案。兩版共用source殼及隔離fixture API，不能當installed runtime驗收。
- 三尺寸為1400×900／1280×800／1100×700，兩版前端同fixture。1280／1400校閱viewer/editor幾何相同；1280入口新增YT使頂列按鈕向左移約137px。首頁HTML／側欄位置相同。不能重現「整套介面差異過大」；使用者對照版本後續已確認，但尚未取得差異最大畫面。
- 新發現BUG-049：1100×700 source editor.right1189、cueList.right1187（畫面寬1100），viewer/editor.bottom771超過height700。已安裝前端同場editor亦right1189，workspace.right1201；source workspace.right1100但children溢出。截圖顯示左video覆蓋右側部分內容、右側控制裁切。非YT頂列獨有，不因BUG-048關閉而判整體版面通過。
- 兩版皆可播3秒MP4（currentTime source0.000389／installed0.000782），編輯譯文→按另存SRT→重載讀回→還原fixture，tasks editSaveReloadRestored=true。這不是轉錄品質、長片輸出或使用者真實專案驗收。
- 後續YT完整程序亦exit0：支援尺寸modal、同意、錯誤保留、鍵盤及iframe12案。技術測試pass與產品整體可用性未通過分開記錄；真實OAuth／YouTube／Keychain／Windows／完整安裝版端到端流程未驗收；上方native追加僅補既有macOS安裝版基本任務。
- `npm run check` exit0（含四份YouTube suites與校閱UI／核心回歸）、兩支診斷工具node --check、git diff --check exit0；本輪未修改public／server／electron產品檔案。
- 初版v1因測試選用不存在的.review-cue-card timeout exit1，已改.review-cue。v2程序exit0但home導航丟失token，首頁出API驗證失敗，只作早期量測；v3保留owned query token且成功載入專案，新增播放及儲存重載。本輪全部原件保留，不將v1／v2稱完整首頁流程驗收。

## 2026-10-19 FR-027 可用性修正驗證

- 指令：`node scripts/verify-youtube-ui.mjs docs/project-management/evidence/2026-10-19-youtube-usability-fixed-v7.png --validate-usability`，exit 0；隔離 source Electron、自有 profile、3秒合成 MP4，播放 currentTime 0.003272。
- 1400×900／1280×800／1100×700：入口 right 1376／1256／1076，footer 操作可見，body 獨立捲動；按鈕 font14px700／radius8 與既有一致。1024 僅壓力案。錯誤在 1900ms 輪詢後保留。
- 真實 CDP Tab×6 不離開 modal，Escape 關閉及焦點回復、Enter 重開通過。Enter 早期失敗源於 CDP 未送 carriage-return text；補齊事件後通過，未因此修改產品快捷鍵。
- iframe 受控 mock 通過同意／欄位保持／清單節點保持／選檔撤銷同意／舊輪詢／取消／字幕重試／完成防重複／IPC錯誤保持／下一操作清除／換頻道／缺SRT／焦點等12案，影片 start 僅一次；非真實 Google。
- fixed-v7 PNG／JSON 僅保存幾何與錯誤量測；完整程序 exit0 另包含後續鍵盤與 mock，不能只憑圖檔認定全程通過。diagnostic-v6 保留為中途量測，當次後續鍵盤測試失敗。
- 四份 YouTube focused suites、review UI regression、完整 `npm run check`（含posttest YouTube）、兩支新增／變更測試腳本語法及 `git diff --check` exit0；獨立審查結果於 08 回填。未驗證真實頻道／Keychain／封裝／Windows、OS縮放與螢幕閱讀器，無封包級 egress 證明。

## 2026-10-16 FR-027 介面一致性與可用性複核

- `node scripts/verify-youtube-ui.mjs docs/project-management/evidence/2026-10-16-youtube-usability-audit-v2.png --usability` exit 0，生成3秒 H264/AAC 媒體，muted 播放 currentTime=0.176316／duration=3，隔離 profile 自動清理；無Google請求。exit 0 代表量測完成，不代表產品可用性通過。
- v2 PNG／同名.png.json 保存1400、1280、1100、1024×800的幾何、按鈕樣式、暫隱藏YT入口的對照與錯誤輪詢。BUG-046／047／048見07；1024低於 minWidth1100，不作支援範圍缺陷證據。v1原件保留。
- 本機保留 v0.51.0 bundle／source `styles.css` SHA-256 均為 `a75c3284e181336c243e7317e945db9d46712ea10c0d7a92cc02192eff0a9bd3`；review.html 僅兩項新增，不把新 modal 的視覺差異描述成整套校閱頁重寫。未確認使用者正在執行的安裝版本。
- 四份 `npm run test:youtube` exit 0，harness `node --check`／git diff --check exit 0；既有技術測試不驗證樣式一致性、fold可發現性或操作錯誤持續性。真實Google、Keychain、安裝版、Windows皆未驗收；不修改產品程式或重播真實頻道操作。
- 標準不帶 --usability 的 Electron smoke 再跑 exit0。無Google授權／上傳判斷來自乾淨profile與呼叫路徑核對，JSON googleRequests=false不是封包監測證明，不宣稱整棵程序完全無外連。尺寸使用renderer viewport模擬，不等同原生視窗／顯示縮放驗收；主要操作在fold下是須捲動問題，不是完全不能點擊／不能關閉。

## 2026-10-16 FR-027 YouTube 私人上傳

- `npm run test:youtube`：使用暫存 job/config、假的 safeStorage 與 Google SDK adapter，真實 loopback OAuth callback 驗證 state、PKCE、拒絕及逾時；覆蓋 private／notifySubscribers=false、影片成功字幕失敗、字幕-only retry 不重傳影片、取消、重啟 interrupted、symlink／traversal、去敏及本機授權移除。假的加密器只驗證儲存呼叫與 0600，不代表真實 OS Keychain 驗收。
- `node scripts/test-youtube-sdk.mjs` exit 0：實際官方 client 搭配本地 transport adapter（無 socket），驗證 videos.insert 與 captions.insert／update 的 multipart serialization、private／兒童內容／notifySubscribers metadata、stream 及 onUploadProgress；避免只測手寫 API stub 而漏掉 SDK 契約。此 suite 同樣納入 test:youtube／posttest。
- round1 B1／B2／B3 修正：`test-youtube-streams.mjs` 四案實際 SDK source fault（影片／字幕 ENOENT 與 mid-read）均受控結束；`test-youtube-lifecycle.mjs` 真實隔離 HTTP lease／DELETE 409、release 後刪除、外部移除不復活／不傳字幕、history 遠端 ID 留存與 source failure partial／重試均 pass。全套 `npm run check` 再次 exit 0（包含四份 YouTube suites）。
- 最新 UI smoke：`node scripts/verify-youtube-ui.mjs docs/project-management/evidence/2026-10-16-youtube-private-upload-ui-v3.png` exit 0；owned profile 的 dynamic DevToolsActivePort、真實 IPC、videoId／captionId、completed＋syncing／partial＋failed、按鈕與 consent 通過。此為本機狀態 fixture，沒有 Google 網路請求；圖片背景仍有合成非影片 fixture 的波形／無 AI task 訊息，不代表媒體／AI 驗收。
- v4 screenshot 分支捲到底部，`2026-10-16-youtube-private-upload-ui-v4.png` 與其 smoke exit 0；主代理視覺確認影片 ID、字幕 ID／syncing、同意與操作按鈕可見。獨立 round2 自行重跑四份 suites、無截圖參數 UI smoke，並唯讀核對 v4 圖片／最後 screenshot-only 差異；沒有新增 runtime 必修。報告原句及 final gate 進度見 08，不冒稱 reviewer 重跑完整 check 或真實外部端點。
- `npm run check` 已通過既有全套 syntax／deterministic／核心回歸；新 suite 以 `posttest` 納入後續 npm test／check。
- `node scripts/verify-youtube-ui.mjs docs/project-management/evidence/2026-10-16-youtube-private-upload-ui.png`：隔離 source Electron profile 下，實測 preload/main IPC、檔案列表、越界拒絕、modal、未同意／未連結按鈕狀態、預填標題與關閉；未發送 Google 請求。首次執行因 Electron binary 未就緒而失敗，後續初始化 binary 後通過。初版 screenshot 背景 review fixture 缺 config.files，後續 `2026-10-16-youtube-private-upload-ui-v2.png` 修正 fixture 並重跑通過，保留初版原件。
- `npm audit --omit=dev --json` exit 0、production 0；完整 audit exit 1：12（8 moderate／4 high），既有 dev toolchain／Electron 警示，不以過去 audit=0 代表目前狀態。本輪 lockfile 沒有升級既有版本。
- 未覆蓋：真實 Google client／OAuth consent／YouTube API quota／影片處理與字幕 serving、真實 safeStorage round-trip、新版安裝包、Windows UI、網路中斷／大檔效能與跨重啟 byte-level 續傳。只能宣稱 source MVP／mock API／本機 UI，不宣稱正式頻道發布已驗收。

## 測試層級

| 層級 | 工具／證據 | 最低適用情境 |
|---|---|---|
| 文件 | `npm run docs:check`、`git diff --check` | 每次變更 |
| 語法 | `node --check` | JavaScript／MJS 變更 |
| 模組／契約 | `test-media-edit`、`test-ai-optimizer`、`test-ai-providers`、`test-review-ui` | 對應功能變更 |
| 核心整合 | `test-core.mjs` | API、檔案、任務、輸出變更 |
| UI 人工 | 瀏覽器／Electron 操作、截圖 | 版面、互動、可存取性變更 |
| 封裝 | runtime verify、`7z t`、封裝清單、codesign | 每次平台打包 |
| 實機 | 安裝、啟動、轉錄、校閱、輸出、解除安裝 | 正式或公開發布 |
| 發布 | Release 資產、digest、checksum、下載 URL | 每次 Release |

治理前置流程另以 `test-project-preflight.mjs` 驗證任務路由，確保一般任務不載入完整歷史，發布與 full 類型仍包含必要治理／授權文件；未知類型必須失敗。

## 2026-10-01 FR-021 macOS packaged Electron UI Seatbelt nested-profile 診斷

- 範圍：只調查 packaged UI offline runner 已記錄的 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`；沒有重跑 packaged app／UI，也沒有更動產品程式或 OS 網路設定。原始 exploratory evidence 與重播 evidence 分別為 `docs/project-management/evidence/2026-10-01-macos-seatbelt-nested-profile-canary.json`、`...-replay2.json`、`...-replay3.json`。
- 可重播 canary：`node scripts/accept-macos-seatbelt-nested-profile-canary.mjs docs/project-management/evidence/2026-10-01-macos-seatbelt-nested-profile-canary-replay3.json` exit 0，2026-10-01T09:10:37.628Z–09:10:37.672Z。完整 profile strings 與 argv 存於 replay3；四案：strict parent／child exit 0；strict parent 拒絕 network-service-shape child exit 71／`Operation not permitted`；只加明示 TCP／UDP 的 parent 仍 exit 71／EPERM；`(allow default)` parent 接受 child exit 0。replay2 保留第三案原先預期過寬而失敗的實驗紀錄，未覆寫。
- 網路副作用：script 不用 network APIs，實際執行只為 `/usr/bin/sandbox-exec` nesting `/usr/bin/true`，未建立 socket；replay3 記錄 `networkConnectionsAttempted=false`、`externalSocketAttempted=false`、`systemNetworkConfigurationChanged=false`、既有 Ollama daemon 未啟停、沒有下載模型、未重跑 packaged UI。Permissive parent 僅用於不連網的 true process policy-load probe，不是可接受的 UI 外連隔離方式。
- 判讀限制／來源：這是精確可重播的 synthetic policy shape，並非 Chromium exact generated profile；不能證明 replay11 失敗的唯一根因或 packaged UI acceptance。2026-09-30 稽核將 replay11 executable SHA-256 `e872f406bfb64ced064cdf8efaf0ae329e0db82e3ac0d92a4b192da3963f80ec` 關聯至 v0.51.0 packaged candidate source commit `53956ccdee6e16e4c0413f09312a419613b27da6`；2026-10-02 只讀 `git show 53956ccdee6e16e4c0413f09312a419613b27da6:package-lock.json` 並解析，確認該 commit 鎖定 Electron 43.3.0。replay11 JSON 本身沒有 source commit 或 build provenance 欄位，故此 SHA→commit 關聯依賴 2026-09-30 候選稽核紀錄，不是可驗證的 binary provenance。官方 Electron release 將 43.3.0 對應至 Chromium 150.0.7871.212；Chromium release tag `150.0.7871.212` 解析至 commit `69bf1c67cb894365d151bd020bb0171fd583633a`，其中 `sandbox/policy/mac/network.sb` blob 為 `58477d8d17902258b3f361d72751a32c034e0645`，列出 network service 的 remote TCP／UDP allowances（lines 61–71）。故 replay3 synthetic child shape 可對齊同版本的官方 policy fragment；目前 executable-hash-matching bundle 的 Framework hash 已量測（見下方），但 replay-time exact Framework hash／identity／provenance 未驗證；動態參數與整份 Chromium generated profile 亦未取得，仍不得主張 exact profile 或 root cause。來源：[Electron v43.3.0](https://releases.electronjs.org/release/v43.3.0)、[Chromium 150.0.7871.212 network.sb](https://chromium.googlesource.com/codesearch/chromium/src/+/refs/tags/150.0.7871.212/sandbox/policy/mac/network.sb)（commit `69bf1c67cb894365d151bd020bb0171fd583633a`）、[Apple NEFilterDataProvider](https://developer.apple.com/documentation/networkextension/nefilterdataprovider)、[Apple network extension setup](https://developer.apple.com/documentation/xcode/configuring-network-extensions)。本輪未建置／啟用 filter，未重跑 app 或修改 OS policy。
- 2026-10-12 static bundle identity check：既有 replay11 JSON executable SHA-256 `e872f406bfb64ced064cdf8efaf0ae329e0db82e3ac0d92a4b192da3963f80ec` 與目前保留 release bundle `../dist/release-0.51.0-macos-53956cc/mac-arm64/離線字幕工廠.app` 中的 executable hash 完全相同；bundle version／identifier 為 `0.51.0`／`com.offline-subtitle-factory.app`。同 bundle 的 `Electron Framework` 版本為 43.3.0、binary SHA-256 `a6763870b706a065d621935435d82ea206747192b3948c8b17b7f5e2930c758a`；app executable 與 framework binary mtime 均為 2026-09-22 15:21:23 CST，`codesign --verify --deep --strict` exit 0。完整輸入與限制見 `docs/project-management/evidence/2026-10-12-fr-021-replay11-electron-framework-identity.json`。replay11 JSON 未記錄 bundle path／framework hash，故目前 bundle 的一致 executable、mtime 與當前簽章驗證不足以證明 replay 當時載入的 exact framework bytes；不代表 exact generated profile、binary provenance 或 root cause 已確定。本檢查未啟動 app、Ollama、socket/network probe 或 OS setting change。
- 開發驗證：主代理新增 replay script 後約 09:15 UTC 完整 `npm run check` exit 0（19 項治理文件、全套 syntax 與 `npm test`，含 Ollama missing-model owned-daemon cleanup）；新增 canary syntax、replay3 JSON parse、`git diff --check` exit 0。Round1 審查者沒有重跑 tests；round2 reviewer 於 09:21:22 UTC 親自 `node --check scripts/accept-macos-seatbelt-nested-profile-canary.mjs` exit 0，但未重跑 tests／canary／app，皆有說明。
- round1／round2 獨立審查：`docs/project-management/reviews/2026-10-01-fr-021-macos-packaged-electron-ui-deny-network-sandbox-boundary-diagnostic-round1.md` 與 `...-round2.md` 均判定有條件通過，範圍限可重播 synthetic Seatbelt 診斷；round2 確認 round1 的可重播 profile／argv、source references 與 fail-closed 陳述已補，並要求維持工作進行中、不以 synthetic pass／完整 check 取代實際 packaged UI egress acceptance。2026-10-02 的追加唯讀比對固定 Chromium source tag／commit，並按候選稽核紀錄將 replay11 hash 對齊 source commit／lockfile；round3 報告 `docs/project-management/reviews/2026-10-12-fr-021-macos-packaged-electron-ui-deny-network-sandbox-boundary-diagnostic-round3.md` 第 37 行判定有條件通過，僅限靜態 source-version／policy fragment 關聯補記，不代表 build provenance、root cause 或 UI acceptance 已證明。round3 尚指出 replay11 JSON 未保存 source commit／provenance。Exact generated profile、replay-time framework identity／provenance 或獲授權 egress control 下的 packaged UI 實測仍缺；`FR-021` offline acceptance 仍受阻。
- 範圍與遺留：未使用 `--no-sandbox`、未停止既有 Ollama、未下載模型、未改 OS network；`systemNetworkDisabled=false`。在本輪範圍內未找到同時保留 Chromium sandbox、外連 fail-closed 又可完成 packaged UI 的方案。任何 OS-level per-app egress control 需先取得明確系統政策變更／rollback 授權；FR-021 packaged UI offline 仍未完成，Windows 暫緩、LM Studio 不驗收。

- Framework hash 措辭釐清：本節較早的「未核驗失敗候選內 Chromium framework hash」及「候選內 framework hash 仍缺」，指未取得可證明 replay11 當時載入之 Framework bytes 的 hash／identity／provenance；不表示目前 executable-hash-matching 保留 bundle 的 Framework 未量測。該目前 bundle 的 SHA-256 已記於本節上方，但不能倒推 replay-time 身分。
- 來源引用措辭釐清：本輪 canary script 與新 evidence 固定使用 Chromium `150.0.7871.212` 的 versioned tag URL，並在 evidence 內記錄 tag 對應 commit／blob；mutable `HEAD` 只保留在既有 replay／exploratory evidence 作為不可改寫的歷史來源欄位，不再作為本輪 evidence source。這只改善可追溯性，不補足 replay11 的 binary provenance、exact generated profile 或 packaged UI acceptance。
- BUG-038 可維運修正：canary script 現要求明確傳入新的 `.json` evidence 路徑；無參數時在檢查 macOS／sandbox executable 或執行任何 case 前以 exit 2 停止，避免先執行 probe 再因既有 replay2 的 exclusive-create 失敗。明確輸出路徑仍保留 `wx` 防覆寫、pinned source reference 與四案 synthetic scope；此修正不代表 packaged UI acceptance。
- 2026-10-14 exact generated profile feasibility audit：唯讀解析 replay11 的 top-level／巢狀欄位與 SHA-256，並核對 `scripts/verify-electron-ollama-ui-offline.mjs`、`scripts/verify-electron-ollama-ui.mjs` 的 sandbox／launch／evidence projection。replay11 只記錄 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`electron_start`、candidate executable hash、outer `profileId`／scope 與 cleanup；未記 serialized generated profile、Chromium child profile text、runtime-generated argv、Framework hash、source commit 或 build provenance。runner source 可見外層 profile 與 synthetic arguments，但未保存 Chromium runtime child profile；既有 static bundle identity 也不能倒推 replay-time bytes。完整非敏感結果與輸入 hash 見 `docs/project-management/evidence/2026-10-14-fr-021-replay11-exact-profile-feasibility-audit.json`。本 audit 未啟動 packaged Electron／Ollama、未建立 network probe、未修改 OS network；結論是 exact profile 在 audited artifacts 中不存在且不可重建，FR-021 packaged UI offline acceptance 仍受阻。
- 2026-10-14 instrumented packaged-run readiness audit：唯讀核對 packaged／offline UI runner、`electron/main.mjs`、package manifest／lockfile 與既有 replay11／static bundle identity。現有 runner 可在記憶體建立 outer Seatbelt／launch argv，child stdout／stderr 只進入最多 16,000 字元暫存並降為固定 `startupDiagnosticCategories`；evidence 保存 executable／review.js hash，但沒有 outer argv、raw／redacted stderr、Framework hash／build provenance 或 runtime-generated child profile。`electron/main.mjs` 保留 renderer sandbox，未見 command-line／argv instrumentation。完整 observations、source hash 與後續授權條件見 `docs/project-management/evidence/2026-10-14-fr-021-instrumented-packaged-run-readiness-audit.json`。這是 readiness partial，不是 packaged UI acceptance；本 audit 未啟動 app／Ollama／canary、未建立 network probe、未改 OS。
- 2026-10-14 runner provenance capture contract：`scripts/verify-electron-ollama-ui.mjs` 將 live evidence 升為 schema v4，固定保存去敏 `launch.command`／`launch.argv`、`outerSandboxProfileApplied`、candidate executable／Framework pre-launch hash，以及 16,000-byte cap 下 child output 的 SHA-256／byte length／fixed categories；raw child output 明確以 `rawChildOutputPersisted=false` 排除。`scripts/verify-electron-ollama-ui-offline.mjs` 只投影白名單、格式驗證後的 `runnerProvenance`，不把 runner-level capture 擴張為 exact profile、replay-time loaded bytes 或 UI acceptance。`test-ollama-ui-offline.mjs` 補 schema／欄位／不洩漏 source-contract assertions；focused test、完整回歸與 syntax／whitespace 驗證通過。本輪未啟動 packaged Electron／Ollama acceptance、未建立 network probe、未改 OS network。
- 2026-10-14 offline wrapper argv redaction boundary：`lib/runner-provenance.mjs` 提供純函式 allowlist re-sanitizer；offline wrapper evidence 升為 schema v5，投影只保留固定去敏 token，並以 `argvRedactionValidated`／`argvDroppedCount` 揭露完整性而不保存被拒絕的 raw item。focused `test-ollama-ui-offline.mjs` 覆蓋正常 redacted argv、private path、secret-shaped value、未知 flag、缺少 argv 與 schema v5；本輪未啟動 packaged Electron／Ollama acceptance、未建立 network probe、未改 OS network。

## 2026-10-01 FR-021 macOS Ollama UI 取消／checkpoint 續跑

- 候選：以 `electron-builder --mac --arm64 --dir --publish never --config.directories.output=<本輪隔離目錄>` 從當前 dirty worktree 建立 v0.51.0 arm64 目錄候選；不是舊 `53956cc` 公開 Release。`codesign --verify --deep --strict` exit 0（ad-hoc，非 Developer ID／公證）；source 與候選 `public/review.js` SHA-256 均 `1801f4e20f99be4d4ac6f3b0a199696c1bf8ee5282fc4367c2875b139dd37b55`。Replay9 schema v3 記錄 executable／review script hash，避免把舊候選與修補後程式混用。
- 正向實機指令：`OSF_OLLAMA_UI_ISOLATED_DAEMON=1 OSF_OLLAMA_UI_SCENARIO=cancel-resume node scripts/verify-electron-ollama-ui.mjs <本輪候選 executable> 9993 120000 docs/project-management/evidence/2026-10-01-ollama-ui-cancel-resume-replay9.json llama3.2:3b`；2026-10-01 02:51 UTC 執行，exit 0、15,879 ms、pass。六段／六批在 1/6 checkpoint 後點取消，確認 cancelled／retryable、取消前後 source subtitle hash 不變、original SRT 不變、取消後恢復按鈕顯示；以 page time-origin 確認重載、checkpoint／Session 不變；UI resume POST 與最終 optimizer result 均 `resumedFromBatch=1`，同 Session 完成六筆建議、全部接受、undo／redo、雙語 `reviewed.srt` 與時間碼不變。Original SRT before／after 均 `5519517bb77f8cb21d6bfbd12f9216701fae7c31dd30a2f300bf86e3e3ccb991`。
- 自有 daemon：只指向預裝 store，context 4096、parallel 1、no-cloud／no-prune；啟動前以 tags 精確確認模型已存在，不呼叫 pull。HOME／TMPDIR、daemon port／process group 獨立；成功 replay 不套用 Seatbelt，`systemNetworkDisabled=false`，不宣稱網路 egress 被 OS 禁止。既有桌面服務 PID 938 保留、不停止；不能用此結果填補 offline packaged UI 缺口。
- 原始失敗保留：replay1 target whitelist reject；replay2 checkpoint window 未確認且 Electron forced cleanup；replay3 renderer timeout 且 forced cleanup；replay4 renderer evaluate expression 開發中錯誤；replay5 首批未取得 checkpoint；replay6–8 專用 daemon 在 15 秒窗口內 tags 未回應（有／無 Seatbelt 均出現）。診斷確認 listener 存在但 tags 暫時逾時，較長 90 秒有界啟動 probe 成功，後續 replay9 pass；不聲稱已定位所有 cold-start 原因，失敗 evidence 均不覆寫。
- 可執行回歸：`test-review-ui.mjs` VM 執行 actual UI functions，stale running／checkpoint=1 修補前 exit 1、修補後 pass；零 checkpoint 保持 resume hidden，HTTP 409 不停止 polling。`test-ollama-ui-offline.mjs` 實際測 selector 的 splash-only／splash-first／remote page／wrong socket port，以及 missing binary、empty model store no-download／自有 daemon cleanup；與既有三案 preflight、managed process regression 並存。Focused UI／provider／offline UI tests、syntax 與 whitespace 通過。完整回歸、預設情境實機、獨立審查與 final gate 詳見最新工作紀錄。
- 限制：合成短句與固定預裝模型只證明控制流程，不代表長中文翻譯品質、使用者原影片、物理斷網、乾淨帳號／安裝或 Release；Windows 暫緩、LM Studio 不驗收，FR-021 整體未結案。
- 最新回歸：helper／runner／UI syntax、focused UI／provider／offline UI 及完整 `npm run check` 全部 exit 0。`OSF_OLLAMA_UI_ISOLATED_DAEMON=1` 不設定 scenario 的預設兩 cue 實機 `2026-10-01-ollama-ui-default-regression-replay1.json` exit 0、pass（9,016 ms），接受／undo／redo／保存、原始 SRT hash／時間碼與所有 cleanup 均通過；此案不是 cancel-resume 或 offline 驗收。
- round1 後再驗證：stale cancelled／failed／completed 不得停止新 generation、runner artifact EACCES 的整體 finally／去敏 evidence、actual helper＋trickle HTTP body deadline 已納入可執行 focused regression。修補後完整 `npm run check` exit 0（2026-10-01 03:08 UTC）。新候選目錄 `dist/acceptance-2026-10-01-cancel-resume-round2` 保留獨立 artifact，review.js source／packaged hash `6bb93f9939415b21261c92a0adacfad0d5a9e304e97a02900770aeac6e8d1cf9`、executable hash `611dc64c2e830c08baa4fc72ddae72429eea6c80c8f610595136a7369096d266`。最新 `2026-10-01-ollama-ui-cancel-resume-replay10.json` exit 0／pass（21,106ms，checkpoint 1/6）、`2026-10-01-ollama-ui-default-regression-replay2.json` exit 0／pass（9,157ms），兩案 original SRT hash／timecodes／app＋daemon cleanup 全通過且未強制 SIGKILL；它們使用新 generation 版 candidate，不改寫 replay9／default1。
- round2 後再驗證：actual cancel restore 的成功／失敗晚到，在新 actual run 已開始後不改控制／訊息／既有 Session，並可正常完成新 Session；stale GET rejection、superseded start rejection 均 ignored，目前 start／poll error 仍可讀。真實 loopback oversized ASCII／UTF-8 body 皆拒絕（byte cap），focused／syntax／whitespace 及最終完整 `npm run check` exit 0（03:25 UTC）。Latest `dist/acceptance-2026-10-01-cancel-resume-round3-final` 為新 build／ad-hoc verify 通過的目錄候選，source／packaged review.js hash `7efbe0d1cca764e015af940323725b1c8b0bc09c46e31a2a2b437375ee79c0d3`。`2026-10-01-ollama-ui-cancel-resume-replay11.json` exit 0／pass（19,714ms，checkpoint1/6）、`2026-10-01-ollama-ui-default-regression-replay3.json` exit 0／pass（10,326ms）；兩案原始 SRT hash／時間碼／所有 cleanup 通過且未強制 SIGKILL，依舊不是 offline 驗收。
- round3 獨立複審：`docs/project-management/reviews/2026-10-01-fr-021-macos-ollama-ui-cancel-resume-round3.md` 無剩餘程式阻擋，結論為有條件通過。Reviewer 自行於 03:27:59 UTC 起完整 `npm run check` exit 0，補充 syntax／whitespace、candidate hash／ad-hoc verify 及兩份新 evidence 只讀核驗通過，未重跑 live AI UI。主代理比對審查前後 SHA-256 確認只新增本報告；原句及條件整合後，03:36 UTC 文件 final gate exit 1（第 2／3／5／6 面向缺固定 `- 證據：`，summary 缺 `- 阻擋問題（若有）：`），whitespace exit 0。當時工作回復進行中；保留原件，由同一 reviewer 另建 round4，不修改 validator，正常 loopback 限定範圍不變。
- round4 格式複審：新報告 `docs/project-management/reviews/2026-10-01-fr-021-macos-ollama-ui-cancel-resume-round4.md` 一般 docs／whitespace exit 0、直接 `validateReviewReport` errors=[]；source／packaged review.js 與 executable 仍對上 final candidate 基準，兩份最終 evidence 雜湊一致。完整 check 承接 round3 已執行結果，不冒稱 round4 重跑；未重新執行 live AI／模型或系統網路變更。主代理比對審查前後 SHA-256 僅新增 round4 報告，既有檔案不變，整合新報告原句及條件後執行 final gate。
- 最終結案檢查：2026-10-01 03:46 UTC `npm run docs:check:final` exit 0（19 個治理文件、版本 0.51.0、最新工作紀錄結案），`git diff --check` exit 0，結果補記後重跑亦通過；round4 條件已履行，報告原件及 03:36 UTC 失敗紀錄保留。只結案本次正常 loopback 取消／續跑與預設 UI 回歸，offline packaged UI／FR-021 整體、Windows／LM Studio／模型品質等限制維持；未發布、未修改 OS 網路或既有 daemon。

## 2026-09-30 FR-021 macOS 26.6.2 Seatbelt packaged Electron UI 版本差異重播

- 候選／環境：本機 macOS 26.6.2 arm64、Node 22.22.3；使用既有 v0.51.0 app bundle，bundle version `0.51.0`、identifier `com.offline-subtitle-factory.app`，來源 candidate commit `53956ccdee6e16e4c0413f09312a419613b27da6`，executable SHA-256 `e872f406bfb64ced064cdf8efaf0ae329e0db82e3ac0d92a4b192da3963f80ec`。本機 Ollama model store 已有 `llama3.2:3b`，不下載模型。
- 呼叫修正：replay10 曾誤將 `.app/Contents/MacOS/離線字幕工廠` executable 傳入 bundle 參數，runner 在 `app_bundle_preflight` 以 `APP_BUNDLE_INVALID` fail-closed；Electron、driver 與 daemon 均未啟動，cleanup 欄位均確認為乾淨。保留原 evidence `docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay10.json`。replay11 改傳 `.app` bundle 目錄，未覆寫 replay10。
- replay11 指令：`npm run acceptance:ollama:ui:offline -- '<app-bundle>' docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay11.json llama3.2:3b`；exit 1、elapsed 6817 ms，stage `electron_start`，failure `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`。Evidence 記錄 Electron `SIGTRAP`、diagnostic categories `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`CHROMIUM_GPU_SANDBOX_UNAVAILABLE`／`OS_PERMISSION_DENIED`、renderer 未載入且 UI flow 無操作。
- round1 後 evidence schema 升至 v3，僅保存格式驗證過的 `macOSProductVersion`／`macOSBuildVersion` 及 enum `candidate.bundleInputKind`，不寫入原始 bundle path。replay12 以 executable path 重現負向 preflight，記錄 macOS `26.6.2`／build `25G83`、`app_executable_path`、`APP_BUNDLE_INVALID`／`app_bundle_preflight`，loopback probe、isolated daemon 及 Electron 均未啟動；cleanup defaults 乾淨。此 evidence 是參數邊界測試，不是 packaged UI acceptance。
- 網路隔離／模型前置：Seatbelt profile `deny-network-loopback-only-v1` 實測 loopback allowed，RFC5737 外連 socket 被 `EPERM` 拒絕；Ollama daemon 與 packaged Electron process tree 均在該 sandbox 中啟動，模型已預裝且 `modelDownloadAttempted=false`。Driver 僅在 host 上連 loopback；`systemNetworkDisabled=false`，不宣稱全機斷網。
- 清理／實機殘留：replay11 記錄 Electron group cleanup-start 時存在、清理後 absent 且 close confirmed、`forcedCleanup=false`；driver／sandbox daemon process groups absent／close confirmed；daemon port closed、userData removed、temporary root removed。完成後 process snapshot 未見 Electron／UI runner 殘留；驗收前已存在的 Ollama daemon 未停止。
- focused／完整驗證：`codesign --verify --deep --strict <app-bundle>` exit 0；runner／test／UI probe 三項 `node --check` 與 `node scripts/test-ollama-ui-offline.mjs` 通過。新增 integration case 實際把 candidate executable 當 bundle 傳入 wrapper，斷言 `APP_BUNDLE_INVALID`／`app_bundle_preflight`、v3 OS/input-kind 欄位格式、path 不外洩，且未啟動 sandbox probe／daemon／Electron；ENOENT managed-child integration 仍通過。主要代理完整 `npm run check`（19 個治理文件與全套測試）及 `git diff --check` 均 exit 0。
- 2026-10-01 round2 後修補：獨立報告 `docs/project-management/reviews/2026-09-30-fr-021-macos-26-6-2-seatbelt-replay-round2.md` 已取得。Classifier 改以 `path.resolve` 統一 `.app/` 與 `.app` 類別；三案 preflight（executable／正常 bundle／尾端 separator bundle）改在 Ollama/model gate 前獨立執行，使用不存在的 binary 與 spawn seams，確認 stage、metadata、path 隱私及無 network probe／daemon／driver／Electron。`OLLAMA_BIN=/nonexistent-round3-preflight node scripts/test-ollama-ui-offline.mjs` exit 0 並明確列出三案 PASS 與 daemon integration SKIP；修補後完整 `npm run check` exit 0，包含三案與原 ENOENT daemon integration。未重播 packaged UI 或覆寫 replay；round3 與文件 final gate 進度詳見工作紀錄。
- 範圍判定：macOS 26.6.2 下與 macOS 25.6 replay8／9 一樣，現有 Seatbelt 外層隔離會阻止 Chromium child sandbox 初始化；本輪為版本差異可行性重播，不是 packaged UI acceptance 通過。未用 `--no-sandbox`、未安裝／啟用第三方 Network Extension、防火牆或修改 Wi-Fi／PF；LM Studio 依需求方決定不驗收、Windows 暫緩、FR-021 整體仍未結案。
- 2026-10-01 最終獨立複審：報告 `docs/project-management/reviews/2026-09-30-fr-021-macos-26-6-2-seatbelt-replay-round3.md` 六面向及可引用結論格式完整；獨立 reviewer 重跑無 Ollama 的三案 preflight、相關 syntax／whitespace，保存具體時間戳與證據，未執行 daemon integration 或 UI。主代理比對 reviewer 前後工作樹 hash，確認本輪 reviewer 僅新增 round3 報告，沒有修改原 evidence／報告／其他檔案。整合最新審查原句、狀態與風險後，`npm run docs:check:final` exit 0（19 個文件、最新紀錄已結案），`git diff --check` exit 0；本輪只結案可行性重播與 runner 修補，未通過 packaged UI acceptance。

## 2026-09-30 FR-021 macOS Seatbelt packaged Electron Ollama UI 隔離可行性查核

- 候選／環境：macOS 25.6 arm64、Node 22.22.3；既有 v0.51.0 macOS arm64 packaged release candidate，來源 commit `53956ccdee6e16e4c0413f09312a419613b27da6`，不是目前 dirty worktree 的 build。Ollama `llama3.2:3b` 在本機 model store 已存在，runner 不呼叫 pull／下載。
- runner：`npm run acceptance:ollama:ui:offline -- '<app-bundle>' <evidence-path> llama3.2:3b`。先在 Seatbelt 確認 loopback HTTP 成功與 RFC5737 外連 socket 回 `EPERM`，再於獨立 HOME 下啟動 Ollama；以同一 deny outbound／inbound／bind、loopback-only policy 啟動 packaged Electron process tree。UI automation driver 在 host 執行，只連線 loopback DevTools／app server；evidence 標明全機未斷網。
- round1 獨立審查：`docs/project-management/reviews/2026-09-30-fr-021-macos-seatbelt-electron-ui-feasibility-round1.md` 判定不通過，指出 DevTools target 未限制 scheme／host／port、startup debug 可輸出 raw lines、Electron process-group cleanup 欄位時點含混。round1 原報告保留；修正包含 `lib/electron-devtools-target.mjs` 的 exact loopback-port guard（遠端／錯誤 port 測試證明不建構 WebSocket）、完全移除 raw-line debug path，以及 `lib/process-group-cleanup.mjs` 對三種 group 分開記錄 cleanup-start／final absence／confirmation／forced escalation。
- focused 驗證：兩支 runner、兩個新 lib modules 與 focused test 的 `node --check`、`node scripts/test-ollama-ui-offline.mjs` 通過；測試實際啟動 POSIX detached child，覆蓋 graceful SIGTERM、SIGKILL、無法確認、無效 group ID，並執行 test-only UI runner ENOENT integration。完整 `npm run check`（19 個治理文件、全套語法及 tests）與 `git diff --check` 均 exit 0。
- 實機結果：packaged v0.51.0 macOS arm64 candidate `53956cc` replay8／replay9 均為 fail、`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`；Chromium network／GPU child sandbox initialization 回報 `Operation not permitted`，Electron `SIGTRAP`，server／renderer／Ollama UI flow 未啟動。replay9 `docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay9.json` 記錄 Electron group cleanup-start 時存在、final probe 確認 absent、未強制 SIGKILL；host driver／daemon group 最終 absent，daemon port、userData、temporary root 已清理。replay7 欄位映射中間結果與 replay1–6 均保留，replay8／9 使用修正後 schema v2。
- 隔離判定：Seatbelt 外層 network deny 可用，但目前 packaged Chromium child sandbox 無法在其內初始化。沒有使用 `--no-sandbox`、沒有修改產品 runtime、Wi-Fi／防火牆，也沒有關閉全機網路；`systemNetworkDisabled=false`。本工作完成的是 fail-closed feasibility 查核，不是 packaged Electron offline UI acceptance 通過；若改採 OS-level per-app egress control，需另立工作並先確認系統變更授權／回復策略。
- round2 獨立審查：`docs/project-management/reviews/2026-09-30-fr-021-macos-seatbelt-electron-ui-feasibility-round2.md` 判定有條件通過；DevTools guard／無 raw-line debug／process-group final probe 三項 round1 缺失已關閉。審查代理自行重跑 focused test、五個 syntax checks 與 `git diff --check`，均通過；依限定未重跑完整 `npm run check` 或本文件 final gate。開發代理於修正後重跑完整 `npm run check`，exit 0；同步審查逐字引用及條件接受狀態後，`npm run docs:check:final` 通過，檢查 19 個文件並確認最新工作紀錄結案。
- 範圍限制：不代表使用者帳號／乾淨安裝、全機實際斷網、UI cancel／checkpoint-resume、模型品質、Windows 實機或 FR-021 全需求完成；LM Studio 依需求方決策不驗收。

## 2026-09-29 報告參考優化：輪詢、快取、安全錯誤與校閱 DOM

- focused 開發驗證：`node --check server.mjs`、`node --check public/app.js`、`node --check public/review.js`、`node --check scripts/test-report-optimizations.mjs`、`node scripts/test-report-optimizations.mjs`、`node scripts/test-review-ui.mjs` 與 `node scripts/test-core.mjs` 均 exit 0。新增測試實際以 production server 驗證無效影片固定錯誤、失敗任務 `message`／`logs` 內部路徑遮罩、輪詢／generation／hidden source contract、任務列表快取失效與校閱動態值轉義。
- 完整開發驗證：最新 `npm run check` exit 0，包含 19 個治理文件、全套 syntax checks、`npm test` 與核心回歸；`git diff --check` exit 0。審查期間曾觀察一次 Whisper 子程序等待逾時及一次階段等待失敗，之後獨立重跑 `node scripts/test-core.mjs` 與完整 `npm run check` 均 exit 0；不把早期失敗覆蓋，保留為測試環境間歇性風險。
- 安全與邊界：`sendJson()` 會遞迴處理 `error`、`message`、`detail`、`reason`、`stderr`、`stdout` 與 `logs`，production 遮罩內部路徑／工具／權限細節；前端輪詢在請求完成後排程、不重疊，任務切換／晚到回應受 generation 保護，頁面 hidden 立即停止 timer、恢復可見重啟，終態與取消後非終態流程維持相容。
- 範圍限制：未做真實瀏覽器／Electron packaged UI、Windows／Linux 實機、乾淨安裝、跨平台 production error matrix 或發布驗收；focused test 不能取代上述人工／實機證據。round1、round2、round3 報告均保留，round4 為本輪最後獨立複審依據。

## 2026-09-23 FR-020／NFR-006 長音訊來源完整性故障注入與 evidence 隱私

- `scripts/verify-whisper-long-media.mjs` evidence v5 保存輸入媒體與可選來源 SRT 的 before／after 串流 SHA-256 及檔案大小；任一 mismatch／after missing 會失敗並列入 `integrityViolations`，無法重算 hash 亦不得誤標為未修改。v4 evidence 保留為歷史執行紀錄。
- `node scripts/test-whisper-long-media-integrity.mjs` 使用隔離小型 fixture 對 input-video 與 source-subtitles 兩類來源分別通過 unchanged、同大小 hash-mismatch、missing-after 共六個情境；測試暫存目錄在 finally 清除。
- `node scripts/test-whisper-long-media-evidence.mjs` 將 transcript-like canary 放入模擬 stderr 與 Error，驗證摘要及安全執行結果的序列化不含 canary。FFprobe、FFmpeg、Whisper 失敗共用固定化 process outcome；evidence 不保存子程序原始 stderr 或原始啟動錯誤訊息。
- `removeTempRootAndVerify` 測試確認刪除後 ENOENT 才算成功，路徑仍存在或 lstat 無法確認都回傳失敗；`recordTempRootCleanup` 測試確保未確認移除會把 evidence status 改為 fail 並給非零退出路徑使用的錯誤碼。
- 2026-09-24 `npm run acceptance:whisper:integrity-fault-injection` v9 使用合成 WAV 與隔離 fake Whisper runtime，七案包括 input media／來源 SRT 修改或刪除四案、自訂 missing-SRT 目錄路徑 canary、含 canary 的來源 SRT basename，以及清理後無法確認的 probe failure。v9 cleanup 案先實際刪除 temp 再合成錯誤，故不證明目錄殘留情境；歷史 evidence 保留於 `docs/project-management/evidence/2026-09-24-whisper-long-media-integrity-fault-injection-v9.json`。
- 2026-09-29 v10 harness 在 probe temp-root 的 `rmSync` 真正刪除前注入 EACCES，不 mock `lstat`；父 harness 從隔離 marker 取得該 root，使用原生 `lstat` 確認目錄實際存在，再清除並確認 ENOENT。v10 七案 evidence 保留此歷史結果：`docs/project-management/evidence/2026-09-29-whisper-long-media-integrity-fault-injection-v10.json`。round5 指出 marker 授權與失效收尾條件後，harness 改用位於 cleanup case 目錄內的預選 temp-root，preload 只攔截 exact resolved path；父 finally 直接移除固定路徑，不依賴 marker。
- v11 harness 在 repo 外獨立 replay 與正式 evidence 路徑各執行七案，均通過；cleanup 案使用原生 `lstat` 確認 root 在父清理前存在、probe exit 1、evidence `status=fail`／`tempRootRemoved=false`／`TEMP_ROOT_CLEANUP_FAILED`，finally 後確認 ENOENT。正式證據：`docs/project-management/evidence/2026-09-29-whisper-long-media-integrity-fault-injection-v11.json`；repo 外 replay 留在一次性暫存目錄。兩項 focused tests、`node --check scripts/accept-whisper-long-media-integrity-fault-injection.mjs`、完整 `npm run check`、`git diff --check` 通過。
- 以短合成 MP4 及 bundled Whisper Tiny 驗證正常 evidence v5 路徑，影片與來源 SRT before／after hash 相同，非空 SRT／JSON、`stderrSummary.contentStored=false` 與 temp cleanup 通過；證據：`docs/project-management/evidence/2026-09-23-whisper-long-media-integrity-short-replay-v5.json`。未重跑 5,416 秒原影片，不讀寫需求方來源媒體。
- round1 報告明載自身不是獨立上下文、未重跑測試，僅作為修正線索。round2 兩項發現已由固定 catch error 與 cleanup fail-closed 修正；round3 有條件通過後，另將來源 SRT basename 固定為非識別標籤，並新增 probe-level cleanup 故障注入。round4 與 round5 均為有條件通過；round5 提出的 marker 條件已由 exact-path 預選 temp-root、repo 外與 repo 內 v11 七案重播及父 finally 清理驗證。round6 報告 `docs/project-management/reviews/2026-09-29-fr-020-long-media-integrity-fault-injection-round6.md` 有條件通過，但 final validator 發現其綜合結論及代理聲明格式不符固定契約；round6 原件未修改。round7 獨立報告 `docs/project-management/reviews/2026-09-29-fr-020-long-media-integrity-fault-injection-round7.md` 重新執行兩個 focused tests、六個相關 MJS syntax checks、repo 外七案、`npm run docs:check` 及 `git diff --check`，均通過，並依 validator 格式列出條件。同步 round7 報告與逐字結論後，`npm run docs:check:final` 通過，確認 19 個文件及最新紀錄結案。開發端完整 `npm run check` 是 v11 修改後的既有結果，非 round7 reviewer 重跑。未重跑原始 5,416 秒影片；此 probe 切片不代表字幕語意／人工校閱、原生 OS 權限、真實 Metal fallback、Windows 實機或 Release 已驗收。
- 範圍：這證明 probe 的檔案前後完整性偵測、evidence 不保存 stderr 原文的測試邊界與短輸入正常執行，不證明字幕語意正確率、人工影音校閱、真實 Metal crash→CPU fallback、Windows 實機、乾淨安裝或 Release。

## 2026-09-23 npm／Node deprecation warning 依賴來源分流

- 依賴來源：`npm explain` 將 `inflight@1.0.6`／`glob@7.2.3`／`rimraf@2.6.3`／`boolean@3.2.0` 追溯至 `electron-builder@26.15.7` 的 `app-builder-lib`、`@electron/asar`、`electron-winstaller` 與 `global-agent` transitive toolchain；`npm ls punycode --all` 為空，專案 manifest／lockfile 也無 `punycode`。
- 安全判定：`npm audit --json` 漏洞總數為 0（info／low／moderate／high／critical 均為 0）；因此這些是上游 dev／optional toolchain deprecation warnings，不是本專案 vulnerability。本輪不加 `overrides`、不重寫 lockfile、不升級 Electron／electron-builder。
- 開發驗證：依賴來源分流、完整 `npm run check`、`git diff --check` 與文件檢查通過；未修改產品、workflow、依賴 manifest、Release 或 Windows 實機範圍。
- 範圍判定：warning 來源已分流但未宣稱已修復；後續僅在 electron-builder／app-builder-lib 上游版本或 warning 風險改變時重新評估。獨立報告：`docs/project-management/reviews/2026-09-23-deprecation-warning-triage-round1.md`。

## 2026-09-23 BUG-032 Windows CRLF source-contract test 修正

- 問題重現：現行 `scripts/test-breeze-asr.mjs` 的 Breeze 函式擷取 regex 在 LF source 可匹配，但將同一份 `public/app.js` 重放為 CRLF 時無法匹配 `}\n\nfunction updateAsrEngineUi` 邊界；本機重現輸出為 `lfMatch=true`、`crlfMatch=false`。產品函式實際存在，故根因是測試換行格式假設。
- 最小修正：測試讀取 `public/app.js` 後將 CRLF 正規化為 LF，再執行既有 source-contract 與 `updateBreezePerformanceNotice` 行為 assertions；新增 LF→CRLF→LF fixture assertion，沒有修改產品 runtime 或公開 v0.51.0 Release。
- 開發驗證：`node scripts/test-breeze-asr.mjs`、完整 `npm run check`、`git diff --check` 均通過；Windows preview run `35804611051`（修正 commit `e8ccee8`）亦成功完成 source／FFmpeg regression、preview package、renderer／install lifecycle、archive／SHA-256 與 artifact upload。獨立 round1／round2 審查報告：`docs/project-management/reviews/2026-09-23-bug-032-windows-crlf-round1.md`、`docs/project-management/reviews/2026-09-23-bug-032-windows-crlf-round2.md`。
- 範圍判定：此輪已解除跨平台自動測試誤判；Windows preview runner 成功不等於 Windows 實機安裝／renderer／轉錄品質驗收，該等項目仍依需求方要求暫緩；不修改公開 v0.51.0 Release。

## 2026-09-23 Windows CI Actions runtime 升級核對

- 變更：`.github/workflows/windows-preview.yml` 將 `actions/checkout@v4`／`actions/setup-node@v4`／`actions/upload-artifact@v4` 升至 `@v5`／`@v5`／`@v6`；Node 22、Windows 2022、測試／封裝條件、artifact path 與 permissions 未變。
- 開發驗證：YAML parse、action ref assertion、完整 `npm run check`、`git diff --check` 通過；Windows preview run `35807444485` 結論 `success`，source／FFmpeg regression、unsigned package、renderer／install lifecycle、archive／SHA-256 與 artifact upload 均成功。run log 未出現三個 Node.js 20 Actions runtime deprecation annotation。
- 殘留警告與工具限制：run log 仍有獨立 Node `punycode` 與 npm transitive package deprecation warnings，本輪不處理；本機沒有 `actionlint`，只以 YAML parser／action ref assertion 替代。這些限制不影響本輪 action major upgrade 的 Windows run success，但不宣稱所有 warning 已清零。
- 範圍判定：本輪只收斂 GitHub Actions runtime warning；Windows 實機安裝／renderer／轉錄品質、真實模型品質、正式簽章／公證與公開 Release 均未驗收或修改。
- 獨立審查：`docs/project-management/reviews/2026-09-23-windows-actions-node24-round1.md` 判定有條件通過；Windows run `35807444485` 已補足其唯一 CI runner 驗收條件。

## 2026-09-22 0.51.0 GitHub Release 發布後核對（macOS arm64；Windows 暫緩）

- 發布結果：`v0.51.0` 已公開且標示 Latest：<https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.51.0>；GitHub API 回報 `draft=false`、`prerelease=false`、9 項資產，annotated tag 解析至 commit `53956ccdee6e16e4c0413f09312a419613b27da6`。
- 開發驗證：發布來源 commit 已完成 `npm ci`、`npm audit`（0 vulnerabilities）、`npm run check`、`git diff --check`；macOS arm64 DMG／ZIP 兩條新實機路徑均完成 renderer／手動字幕／real trim／post-trim／AI review／glossary／8 provider smoke 與 cleanup。發布前候選 evidence：`docs/project-management/evidence/2026-09-22-github-release-candidate-macos.json`。
- 發布資產核對：GitHub API 的 9 項資產名稱／byte size／SHA-256 digest／直接下載 URL 與本機候選一致；正式下載 URL 回讀 DMG `242742979` bytes、ZIP `249963233` bytes、`latest-mac.yml` `566` bytes、SHA256 清單 `474` bytes，四者 hash 均與本地一致。`latest-mac.yml` 的 ZIP／DMG path、size、SHA-512 與發布資產一致；release notes 與本地檔案除 GitHub 自動附加的尾端換行外一致。發布後 evidence：`docs/project-management/evidence/2026-09-22-github-release-post-publish.json`。
- 簽章與限制：DMG／ZIP deep strict codesign 通過；`spctl` exit 3／rejected，符合 ad-hoc、未 Developer ID、未公證限制，不宣稱 Gatekeeper 通過。Windows 未做實機驗收；branch／tag push 觸發的 preview runs `35700305138`、`35700315448` 均因 `test-breeze-asr.mjs` 找不到可測試 Breeze 效能提示更新函式而失敗，不能代替 Windows 驗收。
- 稽核判定：macOS arm64-only GitHub Release 的來源、封裝、實機 smoke、公開資產、metadata、digest 與下載回讀均完成；Windows、正式 Applications／乾淨帳號、真正斷網、真實 AI／模型品質、Developer ID／公證／Gatekeeper 仍是明確遺留風險，不因本次發布擴大宣稱完成。

## 2026-09-22 0.51.0 macOS 實機驗收（Windows 暫緩）

- 本輪依需求方要求只驗收 macOS Apple Silicon，Windows 不執行；使用既有 `../dist/test-build-0.51.0-macos-88da220/` DMG，未重建候選、未修改產品 runtime、未上傳／推送／建立 tag／發布。
- 實際流程：`hdiutil attach -nobrowse -readonly` 掛載 DMG；將 app 複製到隔離 `/private/tmp/<acceptance>/Applications/` 路徑；執行 `codesign --verify --deep --strict`、`spctl --assess --type execute` 與 `scripts/verify-electron-renderer.mjs`；最後 `hdiutil detach -force`，並移除隔離 app。
- 開發驗證：DMG 掛載 exit 0；隔離 app 複製與移除通過；deep strict codesign 通過；renderer smoke exit 0。首頁／Electron bridge／設定、Breeze 首次選擇開啟／取消、手動字幕任務 `completed`／cleaned SRT、real trim `completed`（2.021333 秒）、post-trim subtitle job、AI review assets、glossary round-trip、8 provider marker 與 folder flow 均通過；DMG detach exit 0。
- Gatekeeper：`spctl` exit 3／`rejected`；候選是 ad-hoc、未 Developer ID、未公證，故此結果是預期簽章限制，不是 renderer 啟動失敗，也不宣稱 Gatekeeper 通過。
- 非敏感 evidence：`docs/project-management/evidence/2026-09-22-macos-real-machine-acceptance-rel-047.json`；只保存來源 commit／SHA、狀態、流程摘要與清理結果，不保存 token、API key、完整字幕或使用者資料。
- 範圍判定：本輪證明既有 0.51.0 macOS arm64 DMG 在目前實機可掛載、隔離安裝並完成限定 renderer／字幕／trim／校閱 smoke；不代表目前 dirty worktree 已重建、不代表 Developer ID／公證／Gatekeeper、正式 Applications／乾淨帳號、真正斷網、真實 AI／模型品質或公開 Release 完成。Windows 依需求方決策暫緩。

## 2026-09-22 0.51.0 macOS ZIP／隔離安裝路徑補驗（Windows 暫緩）

- 本輪依需求方要求繼續補驗 macOS，Windows 不執行；使用同一 `../dist/test-build-0.51.0-macos-88da220/` ZIP，未重建候選、未修改產品 runtime、未上傳／推送／建立 tag／發布。
- 實際流程：`unzip -t` integrity、`ditto -x -k` 解壓至隔離暫存、複製 app 至隔離 Applications-like 路徑；執行 `codesign --verify --deep --strict`、`spctl --assess --type execute`、`xattr -l` 與 `scripts/verify-electron-renderer.mjs`；最後移除隔離 app／解壓目錄。
- 開發驗證：ZIP integrity／解壓／隔離複製／cleanup 均通過；deep strict codesign 通過；renderer smoke exit 0。首頁／Electron bridge／設定、Breeze 開啟／取消、手動字幕 `completed`／cleaned SRT、real trim `completed`（2.021333 秒）、post-trim subtitle job、AI review、glossary、8 provider marker 與 folder flow 均通過。
- 安全狀態：`xattr` 執行通過，未發現 `com.apple.quarantine`，但存在 `com.apple.provenance`；`spctl` exit 3／`rejected`，符合 ad-hoc／未 Developer ID／未公證候選的預期限制，不宣稱 Gatekeeper 通過。
- 非敏感 evidence：`docs/project-management/evidence/2026-09-22-macos-zip-acceptance-rel-047.json`；不保存 token、API key、完整字幕或使用者資料。
- 範圍判定：本輪補足同一 macOS 候選 ZIP 路徑的實機解壓／隔離安裝／renderer／字幕／trim／清理 evidence；不代表目前 dirty worktree 已重建、不代表正式 Applications／乾淨帳號、Developer ID／公證／Gatekeeper、真正斷網、真實 AI／模型品質、Windows 或公開 Release 完成。

## 2026-09-22 0.51.0 macOS clean-HEAD 候選重建與 smoke（Windows 暫緩）

- 本輪於隔離 detached worktree 以目前 HEAD `17df9788abf2cf964d52df10b74f9a8fcd7a45d6` 建立新 macOS arm64 directory candidate，輸出為 `../dist/test-build-0.51.0-head-17df978/`；目前 dirty worktree 未提交變更刻意不納入，既有候選未覆寫，Windows 不執行。
- `npm run runtime:manifest:mac`、`npm run runtime:verify:mac` 與 `npx electron-builder --mac --arm64 --dir --publish never --config.directories.output=...` 均 exit 0；Electron `43.3.0`、electron-builder `26.15.7`，packaged `package.json` version `0.51.0`。
- packaged runtime manifest／FFmpeg／FFprobe／Whisper.cpp／Tiny SHA-256 已保存；`OFFLINE_SUBTITLE_TOOLS_DIR=<packaged tools>` 的 runtime verify 通過；`codesign --verify --deep --strict` 通過。`spctl --assess --type execute` rejected，因 ad-hoc／未 Developer ID／未公證，屬預期限制。
- 新候選 `scripts/verify-electron-renderer.mjs` smoke exit 0：首頁／Electron bridge／設定、Breeze 開啟／取消、手動字幕 `completed`／cleaned SRT、real trim `completed`（2.021333 秒）、post-trim subtitle job、AI review／glossary／8 provider、隔離 userData cleanup 均通過。
- 非敏感 evidence：`docs/project-management/evidence/2026-09-22-macos-clean-head-candidate.json`；候選 provenance／簽章說明保存於 `../dist/test-build-0.51.0-head-17df978/PROVENANCE.txt` 與 `SIGNING-STATUS-macos-arm64.txt`。
- 範圍判定：本輪解除既有候選「落後目前 HEAD」的來源追溯問題，但只代表 clean HEAD，不包含 dirty worktree 的未提交變更；不代表 Developer ID／公證／Gatekeeper、正式 Applications／乾淨帳號、真正斷網、真實 AI／模型品質、Windows 或公開 Release 完成。

## 2026-09-22 0.51.0 macOS clean-HEAD DMG／ZIP 封裝與實機驗收（Windows 暫緩）

- 本輪於隔離 detached worktree 以目前 HEAD `17df9788abf2cf964d52df10b74f9a8fcd7a45d6` 執行 `npx electron-builder --mac --arm64 --publish never`，輸出為 `../dist/test-build-0.51.0-head-17df978-packaged/`；dirty worktree 未提交變更刻意不納入，既有候選未覆寫，Windows 不執行。
- 建置與靜態核對：runtime manifest／verify、electron-builder（Electron `43.3.0`／electron-builder `26.15.7`）、packaged version `0.51.0`、DMG `hdiutil verify`、ZIP `unzip -t`、gzip blockmap schema v2、packaged runtime verify、deep strict codesign 與 DMG／ZIP SHA-256 均通過；`publish=never` 未產生 `latest-mac.yml`，未執行發布。
- 封裝實機流程：DMG readonly attach／隔離 mounted app／renderer smoke／detach cleanup 與 ZIP integrity／隔離解壓／Applications-like copy／renderer smoke／cleanup 均通過；兩條路徑均完成首頁／bridge／設定、Breeze 開啟／取消、手動字幕 `completed`／cleaned SRT、real trim `completed`（2.021333 秒）、post-trim subtitle job、AI review／glossary／8 provider smoke。
- 安全狀態：兩條路徑 deep strict codesign 通過；`spctl` 均 exit 3／`rejected`，符合 ad-hoc／未 Developer ID／未公證候選限制，不宣稱 Gatekeeper 通過；ZIP 解壓／隔離安裝未發現 `com.apple.quarantine`。
- 非敏感 evidence：`docs/project-management/evidence/2026-09-22-macos-clean-head-packaged-acceptance.json`；候選 provenance／簽章／SHA 說明保存於 `../dist/test-build-0.51.0-head-17df978-packaged/PROVENANCE.txt`、`SIGNING-STATUS-macos-arm64.txt` 與 `SHA256SUMS-macos-arm64.txt`。
- 範圍判定：本輪證明目前 clean HEAD 的 macOS arm64 DMG／ZIP 可通過容器完整性、隔離實機 renderer／字幕／trim smoke 與清理；不代表 dirty worktree 變更、Developer ID／公證／Gatekeeper、正式 Applications／乾淨帳號、真正斷網、真實 AI／模型品質、Windows 或公開 Release 完成，`releaseReady=false`。

## 2026-09-22 0.51.0 macOS clean-HEAD updater metadata 補齊與核對（Windows 暫緩）

- 本輪不重建既有 clean-HEAD candidate；於 `../dist/test-build-0.51.0-head-17df978-packaged/` 新增本機 QA 用 `latest-mac.yml`，來源 commit `17df9788abf2cf964d52df10b74f9a8fcd7a45d6`，dirty worktree 未提交變更未納入，Windows 不執行。
- 以 Node crypto／檔案 stat 逐項重算：ZIP `249959684` bytes／SHA-512 `9cpksJ2PdeZAIJ90HuaPvT059uhuDsKMRwfNlRqJtP2TEra7AiEPf6z0HjmVwJQ37eKpcHICO4tgjSxZdT3tjA==`；DMG `242720449` bytes／SHA-512 `xY4+XKG39LvbvHNHt/DXEXzbbCwhHtrKTNXspdf0mKTexfeWWzkcgtL/cuQzQJldvzVO8U5KPA2/kOc4yVE4VQ==`；URL、top-level path／SHA-512 與實體檔案一致。
- `shasum -a 256 -c SHA256SUMS-macos-arm64.txt`、DMG `hdiutil verify` 與 ZIP `unzip -t` 重放均通過；上一輪 DMG／ZIP 實機 renderer／字幕／trim smoke evidence 重用，不宣稱本輪重新安裝或重新建置。
- 非敏感 evidence：`docs/project-management/evidence/2026-09-22-macos-clean-head-updater-metadata.json`；候選 `TEST-CANDIDATE-README.md`／`PROVENANCE.txt` 已補充 metadata 是 local QA、非發布資產。
- 範圍判定：`latest-mac.yml` 缺口已在本機 candidate 層級補齊並核對，但 `publish=never`、未上傳／未發布，故不代表公開 updater metadata、Developer ID／公證／Gatekeeper、正式 Applications／乾淨帳號、真正斷網、真實 AI／模型品質、Windows 或公開 Release 完成，`releaseReady=false`。

## 2026-09-22 0.51.0 GitHub Release macOS candidate（Windows 暫緩）

- 發布來源：先將目前已盤點的產品／測試／治理變更提交為 `53956ccdee6e16e4c0413f09312a419613b27da6`，再於乾淨 detached worktree 建置 `../dist/release-0.51.0-macos-53956cc/`；dirty worktree 未提交變更未納入，Windows 不執行。
- 開發驗證：`npm ci`、npm audit（0 vulnerabilities）、`npm run check`、runtime manifest／verify、Electron `43.3.0`、electron-builder `26.15.7`、packaged version `0.51.0`、deep strict codesign 均通過。
- 資產驗證：DMG `242742979` bytes／SHA-256 `2fd5ee33b74c19cf65791f844be645becc3482d2eba2538a38e3343f2e17263d`、ZIP `249963233` bytes／SHA-256 `e5499742edf2660a9e7fafcd7fde7eb5d513fa1e6523ea33bbc30019d507d260`；DMG `hdiutil verify` VALID、ZIP `unzip -t` 無錯、blockmap／SHA256／`latest-mac.yml` URL／path／size／SHA-512 一致。
- 實機驗收：新候選 DMG readonly attach／renderer／手動字幕／real trim `2.021333` 秒／post-trim／AI review／glossary／8 providers／detach cleanup，以及 ZIP 解壓／隔離安裝／同等 smoke／cleanup 均通過；兩條路徑 `spctl` exit 3／rejected，符合 ad-hoc／未 Developer ID／未公證限制，ZIP 未發現 quarantine。
- 非敏感 evidence：`docs/project-management/evidence/2026-09-22-github-release-candidate-macos.json`；候選 `PROVENANCE.txt`／`SIGNING-STATUS-macos-arm64.txt`／`SHA256SUMS-macos-arm64.txt`／`latest-mac.yml`／README 均已保存。
- 發布前判定：macOS-only release scope 已具備發布證據，但尚未 push／tag／建立 GitHub Release；Windows、Developer ID／公證、正式 Applications／乾淨帳號、真正斷網、真實 AI／模型品質仍不在本輪完成範圍。

## 2026-09-22 0.51.0 release-readiness 本機候選核對

- 本輪只讀既有 `../dist/test-build-0.51.0-macos-88da220/` 與 `../dist/test-build-0.51.0-91eca2b/`，未上傳、推送、建立 tag 或修改使用者資料；完整摘要保存於 `docs/project-management/evidence/2026-09-22-release-readiness-audit.json`。
- runtime：`npm run runtime:verify:mac` 與 `npm run runtime:verify` 均通過；兩平台候選 SHA-256 manifest 與 metadata size／SHA-512 核對通過。macOS ZIP `unzip -t`、DMG `hdiutil verify`、解壓後 0.51.0 packaged app、deep strict ad-hoc codesign、credential／超大檔排除通過；Windows unpacked executable 為 PE32+ x86-64，packaged version 0.51.0，未發現 credential 檔。
- 限制：主機沒有 7z，Windows Setup／Portable container test 未執行；沒有 Windows 實機，因此未驗證安裝／解除安裝／renderer／SmartScreen／Authenticode／離線行為。macOS 候選為 ad-hoc、未 Developer ID／公證，乾淨安裝／Gatekeeper 也未驗證。
- 阻擋：macOS／Windows 候選 provenance 分別為 `88da220`／`91eca2b`，目前 HEAD 為 `17df978`，且工作樹有 111 個變更路徑；候選不是目前工作樹的可發布資產。release-readiness 判定為不可發布，需先從乾淨且明確的來源重建並重新驗證。

## 2026-09-21 FR-020／NFR-006 長音訊來源 SRT 完整性證據補強

- `scripts/verify-whisper-long-media.mjs` 的 evidence schema 升為 v3；可接收明確來源 SRT 路徑，未提供時使用輸入影片相鄰的 `.edited.srt`（若存在），只讀計算 basename／大小／before SHA-256／after SHA-256，不保存字幕文字。
- 短音訊與完整影片 replay 均通過；完整 evidence `docs/project-management/evidence/2026-09-21-whisper-long-media-small-srt-integrity.json` 記錄來源 SRT before／after hash 相同、`sourceSrtHashChecked=true`、`originalSrtModified=false`，Whisper exit 0、2,509 segments、非空 SRT／JSON、temp root removed=true。
- 若來源 SRT 在 probe 前後 hash 不一致或檔案消失，程式會以 `SOURCE_SRT_MODIFIED` 失敗並保存非敏感 failure evidence；本輪未修改來源影片或 SRT，也不以來源字幕當作 Whisper 品質 ground truth。
- 範圍判定：本輪只補強原始 SRT 完整性可回溯性；仍不涵蓋字幕語意正確率、人工影音校閱、confidence／no-speech、真實 bundled Metal crash→CPU fallback、跨平台、乾淨安裝或發布。

## 2026-09-21 FR-020 bundled Whisper 長音訊 runtime／輸出基線

- 新增隔離 probe `scripts/verify-whisper-long-media.mjs`，只讀需求方已提供的 `<user-home>/Downloads/20260909.mp4`，以 bundled FFmpeg 抽取 16 kHz mono FLAC，再以 bundled Whisper.cpp Small 執行完整影片；不讀既有 SRT 作為 ground truth，不呼叫外部服務、不執行 LM Studio、不修改原始影片／SRT。
- 受控本機 replay evidence `docs/project-management/evidence/2026-09-21-whisper-long-media-small-redacted.json` 通過：輸入 5,416.349667 秒、Whisper exit 0／signal null、2,509 transcription segments、23,697 Unicode code points、最後 segment 5,407.58 秒；SRT 161,545 bytes、JSON 5,666,118 bytes，temp root 已清理。
- evidence schema v2 只保存 input／runtime／model hash、命令摘要、exit／signal、輸出 hash／大小與統計；`stdoutSummary.contentStored=false`、`fullTranscriptStored=false`，不保存字幕文字。先前 v1 意外保存 stdout 字幕尾端的中間 evidence 已移除。
- 範圍判定：這證明本機 bundled 長音訊執行與非空輸出／清理基線，不是中文辨識或翻譯品質通過；本次 JSON 沒有 segment-level confidence／no-speech probability 欄位，因此不宣稱該品質訊號；`deviceObserved=null`，也沒有真實 bundled Metal crash→CPU fallback 證據。預設 sandbox 的短音訊 SIGSEGV 仍只屬執行環境邊界，不取代本次受控 replay。

## 2026-09-21 BUG-WHISPER-METAL-139 production probe 啟動診斷可觀測性

- `scripts/verify-whisper-real-fallback.mjs` 改以 pipe 收集 server stdout／stderr，evidence schema 升為 v2，記錄 PID、ready phase、最後 exit code／signal 及固定 1600 字元尾端摘要。
- 診斷摘要只保存遮罩後內容：API key／authorization／token／secret／password／credential、Bearer／Basic 值與 `/Users`／暫存目錄路徑均遮罩；不保存完整 log、不讀使用者媒體、不呼叫外部服務。
- 預設 sandbox round2 evidence `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-round2-default.json` 仍在 ready 前 exit 0，但 stderr 尾端明確記錄 `listen EPERM`，job 未建立；這是環境啟動邊界，不是 Metal failure 或 CPU fallback。round1 evidence 保留作為修正前對照。
- 受控本機權限 round2 evidence `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-round2-escalated.json` 仍完成 `completed/ready-review`、`whisperDevice=metal`、`fallbackObserved=false`，輸出與 stale partial 清理通過；只讀 assertions 確認 probe token 未出現在診斷欄位。
- 範圍判定：本輪只改善 acceptance probe 可觀測性，不修改產品 `server.mjs`、fallback policy、bundled runtime／模型，也不把診斷結果升格為真實 bundled Metal crash→CPU fallback 證據。

## 2026-09-21 BUG-WHISPER-METAL-139 bundled production server Metal failure 邊界重播

- 以同一 `scripts/verify-whisper-real-fallback.mjs`、同一 bundled `whisper-cli`／Tiny、同一 1 秒 16 kHz mono 合成 WAV 與 `NODE_ENV=production` server 重播兩次；輸入不讀使用者媒體、不呼叫外部服務，LM Studio 未執行。
- 預設 sandbox evidence `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-default.json`：server 在 ready 前 exit 0，job 未建立；此為執行環境無法完成 loopback server 啟動的失敗證據，不可解讀為 Metal crash 或 fallback 結果。
- 受控本機權限 evidence `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-escalated.json`：production server 完成 `ready-review`，`asrEngine=whisper.cpp`、`whisperDevice=metal`、`fallbackObserved=false`，SRT／JSON／draft 存在且 stale partial／暫存 WAV 清理；沒有觀察到 Metal exit／signal 或 CPU fallback。
- 範圍判定：同一 bundled runtime 在本次受控 server replay 正常走 Metal，預設 sandbox 只重現 server 啟動權限邊界；本輪仍沒有同一次真實 bundled Metal crash→CPU fallback evidence，不修改產品 fallback 策略。

## 2026-09-18 BUG-WHISPER-METAL-139／BUG-026 production-mode bundled CPU retry 取消

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`BUG-026`、`FR-003`、`FR-020`、`FR-022`、`NFR-005`、`NFR-006`。
- macOS arm64 受控權限 `npm run acceptance:whisper:bundled-cpu-cancel -- docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-final.json` exit 0；修正前全新 `/private/tmp/20260918-whisper-bundled-cpu-cancel-repeat.json` 亦 exit 0。`NODE_ENV=production` server 使用本機合成 60 秒靜音 WAV、bundled FFmpeg／Tiny；wrapper 只注入首次 Metal exit 139／partial outputs，CPU retry 實際 spawn bundled `whisper-cli --no-gpu`，ready marker 後 API 取消。正常重播均見 `running/cancelling`→`cancelled`、wrapper SIGTERM、真實 child `signal=SIGTERM`／close、無強制 SIGKILL，精確 `metal`／`cpu` 兩次 invocation。
- 取消前的 partial SRT／JSON、quality metadata 由 probe 明確注入，非 CLI 自行輸出；最終固定 SRT／JSON／draft／quality／暫存 WAV 檔案完全不存在，非 ASR edit plan 保留。evidence 保存 binary／model SHA-256、重播命令、執行前提與範圍標記；較早只檢查非空輸出的 evidence `2026-09-18-whisper-bundled-cpu-cancel.json` 保留未覆寫。
- round1 審查指出 API 不可用時原 probe 只停止 server、無法證明子孫程序關閉；修正為獨立 process group 有界 SIGTERM／必要時 SIGKILL 並確認 group 消失後才刪 temp。受控權限 `npm run acceptance:whisper:bundled-cpu-cancel -- --simulate-cancel-api-loss docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-api-loss-final.json` 預期 exit 1、`status=fail`／`code=PROBE_CANCEL_API_LOSS`，但 `cleanup.expectedFaultSafelyHandled=true`、`groupGone=true`、bundled child `signal=SIGTERM`／close、`tempRootRemoved=true`。可用 `node -e` 讀新 evidence 並斷言上述欄位；先前 EPERM 診斷暫存已在確認無相關 process 後移除。
- 相鄰回歸：新增 process group 收尾後 `npm run acceptance:whisper:hybrid-fallback -- /private/tmp/20260918-whisper-hybrid-after-group-cleanup.json`、舊 `npm run acceptance:whisper:production-fallback -- /private/tmp/20260918-whisper-controlled-after-group-cleanup.json` 均 exit 0；最終腳本 Node 語法、evidence JSON assertions、`git diff --check` 與完整 `npm run check` 均 exit 0。
- 範圍判定：這是受控 Metal failure＋wrapper 轉送訊號後真實 bundled CPU 子程序取消，不是 bundled Metal 自身 crash，也非 server 直接發訊號給 CLI；60 秒靜音並未完整轉錄，不代表長音訊品質／效能、中文語音、Windows 或乾淨安裝。round2 獨立複審通過；LM Studio 依需求方決策未執行。

## 2026-09-18 BUG-WHISPER-METAL-139 production-mode hybrid bundled CPU retry

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`、`NFR-005`、`NFR-006`。
- `npm run acceptance:whisper:hybrid-fallback -- docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback-replay.json` 在 macOS arm64 受控權限 exit 0：`NODE_ENV=production`、localhost 隔離資料、生成 1 秒靜音 WAV、bundled FFmpeg／Tiny；wrapper 首次注入 exit 139／partial SRT／JSON，CPU `--no-gpu` 委派 bundled `whisper-cli`。新 evidence 記錄 binary／model hash、`metal`／`cpu` 兩次 invocation、CPU child exit 0、`completed/ready-review`、`whisperDevice=cpu`、fallback logs、draft／SRT／JSON、stale partial 不存在、暫存 WAV 清理，以及可直接使用新檔名重播的命令和環境前提；原始不含 replay 欄位的 evidence 保留。
- 舊 `npm run acceptance:whisper:production-fallback -- /private/tmp/20260918-whisper-production-fallback-hybrid-recheck.json` exit 0；`node --check scripts/verify-whisper-production-fallback.mjs` 與完整 `npm run check` exit 0。新 hybrid 探針不是預設 `npm test` 的一部分，需具備 bundled runtime 並在 macOS arm64 受控權限重播。
- 範圍判定：首次 Metal failure 是 wrapper 受控注入，不是 bundled Metal 實際 crash；CPU 則為真實 bundled runtime。本證據不關閉同次真實 Metal crash→CPU 門檻，也不代表中文語音品質、長音訊、Windows、乾淨安裝或發布。LM Studio 依需求方決策未執行。
- 獨立審查：round1 指出 JSON 缺 replay 命令；另存新 evidence 修正後，round2 在受控權限重播 hybrid、舊 controlled 與完整 `npm run check`，但報告欄位／聲明未通過治理格式驗證。獨立 round3 以固定格式重新核對未變更的 script／evidence SHA-256、先前實測與本輪治理、語法、差異檢查，六面向通過；合規報告為 `docs/project-management/reviews/2026-09-18-whisper-hybrid-bundled-cpu-round3.md`，前兩輪原文保留。

## 2026-09-18 BUG-WHISPER-METAL-139 Metal→CPU retry 取消交界整合

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`BUG-026`、`FR-003`、`FR-020`、`FR-022`、`NFR-005`、`NFR-006`。
- deterministic 條件：macOS arm64 Whisper.cpp fixture 以 Metal exit 139 觸發 fallback；第二次 `--no-gpu` child 寫出 partial SRT／JSON 並安裝 SIGTERM handler 後才寫 `whisper-cpp-cpu-retry-ready` marker。測試只在 marker 出現後發送取消 API，避免把 child 尚未就緒的時序差異當成產品缺陷。
- 核心斷言：取消前已記錄 `Metal exit 139`／`CPU fallback`；API 取消後狀態先為 `running/cancelling`，child 收到 SIGTERM 並 close 後才成為 `cancelled`，最終 metrics 為 CPU；invocation 精確為 `metal`／`cpu`，沒有第三次 child；`whisper-input.wav`、partial SRT／JSON、quality metadata 與 draft 不存在，`edit-plan.json` 保留且沒有 stale Metal output marker。
- 開發驗證：`node --check`（fixture／core）exit 0；受控權限 `node scripts/test-core.mjs` 連續三次 exit 0，完整 `npm run check` exit 0，`git diff --check` exit 0；摘要保存於 `docs/project-management/evidence/2026-09-18-whisper-retry-cancellation.json`。現有產品 `server.mjs` 無需修改。
- 範圍判定：只證明 deterministic child 已就緒後的 API 取消，不代表真實 bundled runtime 的 Metal crash→CPU retry 取消、同一 Metal close callback 內的不可外部插入窗口、Windows taskkill、長音訊、中文品質、乾淨安裝或發布。LM Studio 依需求方決策未執行。

## 2026-09-18 BUG-WHISPER-METAL-139 CPU fallback 再失敗終止與清理

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`、`NFR-005`、`NFR-006`。
- 修正前重現：fixture 讓 Metal child 先 exit 139 並留下 partial SRT／JSON，CPU `--no-gpu` child 再寫 partial outputs 後 exit 7；受控權限 `node scripts/test-core.mjs` 於 `CPU retry 失敗後不得殘留 partial SRT` 斷言 exit 1，actual 為 `true`。任務已終止且 invocation 為 `metal`／`cpu`，缺口限於終止性 failure 沒有清理 CPU partial outputs。
- 最小修正：`runWhisperCpp` 在進入 fallback 前及不再 retry 的 process failure reject 前，共用既有固定輸出清理 helper；範圍只有 `whisper-cpp-output.srt`／`.json` 與 `quality-metadata.json`，不刪除輸入、使用者字幕或其他工作檔。
- child-process integration：修正後受控權限 `node scripts/test-core.mjs` exit 0；CPU failure 任務為 `failed`、`whisperDevice=cpu`、message 含 `Whisper.cpp exit 7`，既有 logs 保留 `Metal exit 139`／`CPU fallback`；invocation 精確為 `metal`、`cpu`，CPU failure marker 存在，stale partial marker、SRT、JSON 與 draft 均不存在。
- 完整回歸：Node 語法與受控權限 `npm run check` exit 0，涵蓋 fallback policy、三模型、下載、SRT／quality、Breeze、Electron、文件治理、媒體、AI、UI 與核心 API；摘要保存於 `docs/project-management/evidence/2026-09-18-whisper-cpu-retry-failure.json`。
- 範圍判定：本輪是 macOS arm64 deterministic child-process failure integration，不代表真實 bundled server crash→CPU failure、取消與 retry 交界、長音訊、中文品質、其他 macOS 架構、Windows、乾淨安裝或發布已驗收。LM Studio 依需求方決策未執行。

## 2026-09-18 BUG-WHISPER-METAL-139 SIGSEGV signal-aware fallback

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`、`NFR-005`、`NFR-006`。
- 策略矩陣：`node scripts/test-whisper-fallback-policy.mjs` exit 0；macOS arm64 首次 Metal 嘗試對 exit 1、exit 139、`signal=SIGSEGV` fallback，對 exit 0、null 且無 signal、字串 exit、`forceCpu=true`、其他平台／架構不 fallback；log parser 同時覆蓋非零 exit／signal＋CPU marker，拒絕 exit 0 或缺少 CPU marker 的假陽性。
- child-process integration：升級權限 `node scripts/test-core.mjs` exit 0；既有 exit 139 案例與新增真實自我 `SIGSEGV` child 案例均清理 partial SRT／JSON、以 `--no-gpu` 完成 CPU retry 至 `completed`／`ready-review`、`whisperDevice=cpu`，並分別留下 `Metal exit 139`／`Metal signal SIGSEGV` 可觀測 marker。
- production controlled replay：`npm run acceptance:whisper:production-fallback -- /private/tmp/20260918-whisper-production-signal-aware.json` exit 0；受控 wrapper 的 exit 139 fallback、輸出與清理維持通過，仍明確 `bundledRuntimeUsed=false`。
- production bundled replay：`npm run acceptance:whisper:fallback -- /private/tmp/20260918-whisper-real-signal-aware.json` exit 0；新 parser 回報 `metalFailure=false`、`fallbackObserved=false`，任務以 Metal 完成 `ready-review` 並產生 draft／SRT／JSON、清理暫存 WAV。完整摘要保存於 `docs/project-management/evidence/2026-09-18-whisper-signal-aware-fallback.json`。
- 範圍判定：本輪修正 signal／exit 可觀測性與 probe 漏判，不代表真實 bundled server crash→CPU fallback 已重現；中文品質、長音訊、取消中的 retry、CPU retry 失敗、其他 macOS 架構、Windows、乾淨安裝與發布仍未驗收。LM Studio 依需求方決策未執行。

## 2026-09-17 BUG-WHISPER-METAL-139 Metal 139 執行權限邊界重播

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`。
- 對照條件：同一 `tools/whisper-cpp/whisper-cli`／Tiny model、同一 FFmpeg 正規化 1 秒 16 kHz 單聲道靜音 WAV、同一產品 `-osrt -oj -ojf -of -t 2` flags；binary／model SHA-256 與完整非敏感結果保存於 `docs/project-management/evidence/2026-09-17-whisper-metal-permission-boundary.json`。
- sandbox direct replay：Metal exit `SIGSEGV`／等效 139，stderr 為 `ggml_metal_buffer_init` allocation failure，SRT／JSON 均未產生；此結果只代表受 sandbox 限制的執行邊界，不作為產品 runtime failure。
- 升級權限 direct replay：同一 bundled CLI／輸入／flags 在 `require_escalated` local process exit `0`，Metal 產生 SRT／JSON。
- production server replay：`npm run acceptance:whisper:fallback -- /private/tmp/20260917-whisper-real-server-fallback-replay.json` exit `0`；`NODE_ENV=production`、test runners 關閉，任務完成 `ready-review`、`asrEngine=whisper.cpp`、`whisperDevice=metal`，輸出／暫存清理通過，`fallbackObserved=false`。
- 範圍判定：執行邊界差異已解釋先前 direct 139 與 server Metal success 的表面矛盾；仍沒有同一次真實 bundled server run 的 crash→CPU fallback evidence。deterministic production wrapper 仍是 fallback 控制流證據，不冒充 bundled runtime；中文品質、長音訊、取消中的 retry、CPU retry 失敗、跨平台與乾淨安裝仍未驗收，LM Studio 依需求方決策未執行。

## 2026-09-17 BUG-WHISPER-METAL-139 child-process fallback 整合回歸

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`。
- 受控 fixture：macOS arm64 核心測試在 Whisper.cpp runner 首次執行時模擬 Metal allocation failure，回傳 exit `139` 並建立 partial SRT／JSON；server 必須清理後以 `--no-gpu` CPU 重試。
- 核心斷言：fallback 任務完成 `ready-review`，最終 `metrics.whisperDevice=cpu`，fixture 確認首次 139 發生、CPU retry 使用成功輸出，且未觀察到 stale partial output marker。
- 開發驗證：`node --check scripts/fixtures/mock-whisper-cpp-runtime.mjs`、`node --check scripts/test-core.mjs`、`node scripts/test-whisper-fallback-policy.mjs`、`node scripts/test-whisper-quality.mjs` 與受控權限 `node scripts/test-core.mjs` 均 exit 0。
- 範圍判定：這是 child-process／server 控制流 deterministic 整合回歸，不代表目前 bundled Whisper.cpp 的真實 Metal／CPU 對照、長音訊、取消中的 retry、跨平台實機或模型品質已通過；LM Studio 依需求方決策未執行。

## 2026-09-17 BUG-WHISPER-METAL-139 bundled runtime Metal／CPU 對照重驗

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`。
- 測試資產：目前 `tools/whisper-cpp/whisper-cli`（darwin arm64）與 `tools/whisper-models/ggml-tiny.bin`，輸入為生成的 1 秒 16 kHz 單聲道靜音 WAV；binary／model SHA-256 與完整結果保存於 `docs/project-management/evidence/2026-09-17-whisper-bundled-runtime-recheck.json`。
- Metal 實測：產品同等 `-osrt -oj -ojf` flags 預設執行 exit `139`，stderr 出現 `ggml_metal_buffer_init` buffer allocation failure，SRT／JSON 均未產生。
- CPU 實測：相同輸入加 `--no-gpu` exit `0`，SRT／JSON 均產生；JSON 有 1 個 transcription segment，但只含 offsets／timestamps／tokens，沒有 segment-level confidence／no-speech probability。
- 開發驗證：`npm run runtime:verify:mac`、focused fallback／quality 測試、`npm run check`、`git diff --check` 與 `npm run docs:check:final` 均通過；所有暫存 input／output 已清理。
- 範圍判定：本輪證明目前這組 macOS arm64 bundled runtime 的 Metal crash 與 CPU workaround 可重現，不能代表中文語音品質、長音訊、產品 server 真實 CLI fallback、取消競態、跨平台或乾淨安裝驗收；LM Studio 依需求方決策未執行。

## 2026-09-17 BUG-WHISPER-METAL-139 產品 server bundled path acceptance probe

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`。
- 探針與隔離：新增 `scripts/verify-whisper-real-fallback.mjs`／`npm run acceptance:whisper:fallback`；以 `NODE_ENV=production` 啟動 localhost server，沒有設定任何 test runner，使用本機 bundled `whisper-cli`／Tiny 與生成的 1 秒 16 kHz 單聲道靜音 WAV，資料與 cache 置於明確暫存目錄，結束時清理。
- 實際結果：probe exit 0；任務 `completed`／`ready-review`，`asrEngine=whisper.cpp`、`whisperDevice=metal`，draft／`whisper-cpp-output.srt`／`whisper-cpp-output.json` 均產生，`quality-metadata.json` 未產生且 `whisper-input.wav` 已清理。Evidence 為 `docs/project-management/evidence/2026-09-17-whisper-real-server-fallback.json`。
- fallback 邊界：本次 server run 的 status logs 沒有 `Metal exit 139`／`CPU fallback`，所以 `fallbackObserved=false`；probe 只在當次真實 server 觀察到兩個 marker 時才要求 `whisperDevice=cpu`，未把正常 Metal 成功路徑冒充 fallback 通過。另行直接子程序對照仍可收到 bundled CLI `SIGSEGV`，但該事件沒有在本次 server run 重現。
- 範圍判定：本輪完成產品 server 非測試模式 bundled Whisper.cpp 正常 Metal path 與輸出／清理 smoke，並留下可重播的機會式 fallback probe；不代表 server 內 crash→CPU fallback 已由真實 bundled runtime 重現，不代表中文語音品質、長音訊、取消中的 retry、跨平台、乾淨安裝或正式發布驗收；LM Studio 依需求方決策未執行。

## 2026-09-17 BUG-WHISPER-METAL-139 production-mode controlled fallback acceptance

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`。
- 探針與隔離：新增 `scripts/verify-whisper-production-fallback.mjs`／`npm run acceptance:whisper:production-fallback`；在 `NODE_ENV=production` 且 test runner 關閉的 server 中，建立暫時 tools tree，使用 bundled FFmpeg／Tiny model symlink 與明確 deterministic Whisper wrapper，輸入為生成的 1 秒 16 kHz 單聲道靜音 WAV；不呼叫外部服務、不使用 API Key、不讀取使用者媒體。
- 受控 fallback 結果：wrapper 首次非 `--no-gpu` 執行返回 exit `139` 並留下 partial SRT／JSON；server status logs 出現 `Metal exit 139`／`CPU fallback`，清理 partial 後第二次帶 `--no-gpu` 完成，最終 `completed`／`ready-review`、`asrEngine=whisper.cpp`、`whisperDevice=cpu`。
- 輸出與清理：draft／`whisper-cpp-output.srt`／`whisper-cpp-output.json` 均產生，`stalePartialArtifacts=[]`、首次 crash marker 存在、Whisper 暫存 WAV 已清理；非敏感 evidence 為 `docs/project-management/evidence/2026-09-17-whisper-production-fallback.json`，並明確記錄 `bundledRuntimeUsed=false`。
- 範圍判定：本輪證明 production-mode server 在 test runner 關閉時的 child-process exit 139→`--no-gpu` CPU retry、partial 清理與完成控制流；deterministic wrapper 不代表 bundled `whisper-cli` 實機 Metal crash fallback，真實 bundled server fallback、中文語音品質、長音訊、取消中的 retry、跨平台、乾淨安裝或發布仍未驗收；LM Studio 依需求方決策未執行。

## 2026-09-16 REL-047 macOS DMG／ZIP 分發檔啟動驗收

- 關聯需求／工作項目：`REL-047`、`REL-043`、`REL-046`、`FR-009`、`FR-010`、`FR-021`、`NFR-006`。
- 來源檔核對：既有 `../dist/test-build-0.51.0-macos-88da220/` 的 DMG／ZIP SHA-256 與 `SHA256SUMS-macos-arm64.txt` 相符；`hdiutil verify` exit 0 且回報 `VALID`；`unzip -t` exit 0 且回報 compressed data 無錯誤。
- DMG 路徑：以 `hdiutil attach -nobrowse -readonly` 掛載，直接從唯讀 volume 的 `離線字幕工廠.app/Contents/MacOS/離線字幕工廠` 執行既有 `scripts/verify-electron-renderer.mjs`，使用隔離 userData 與 `electron/assets/offline-subtitle-splash.mp4` real trim fixture；exit 0，通過首頁／bridge／設定、Breeze 開啟／取消、手動 SRT、trim／post-trim 任務、AI review asset、glossary、8 provider marker 與 folder flow，最後 `hdiutil detach` exit 0。
- ZIP 路徑：解壓至 `/private/tmp` 隔離暫存目錄，從解壓 app executable 執行相同 renderer／real trim smoke；exit 0，結果同 DMG 路徑，shell `trap` 完成暫存目錄清理。
- 非敏感 evidence：`docs/project-management/evidence/2026-09-16-macos-distribution-live-rel-047.json`，只記錄來源 checksum、app path shape、流程布林／狀態、清理與範圍限制，不保存 token、API Key、完整字幕或使用者資料。
- 範圍判定：本輪證明 DMG／ZIP 分發內容可在 macOS arm64 既有環境啟動並完成 packaged renderer smoke；不證明 Applications 安裝、乾淨帳號、Gatekeeper、Developer ID／公證、Windows、真正斷網、真實 AI API、模型品質或公開 Release。LM Studio 依需求方決策未執行。
- round1 獨立審查：`docs/project-management/reviews/2026-09-16-macos-distribution-rel-047-round1.md` 六面向核對無產品／資產阻擋，判定有條件通過；條件為審查代理未重播 GUI／完整測試，已以主要代理保存的原始 evidence、verifier source contract 與 checksum 靜態核對，並要求結案時維持所有未驗收範圍聲明。

## 2026-09-15 FR-021-031 LM Studio 驗收範圍例外

- 需求方決策：LM Studio 已刪除，本輪不執行其實機模型、UI、取消／續跑或真正斷網驗收；這是驗收範圍例外，不是產品支援移除。
- 追溯同步：例外已記錄於 `docs/project-management/02-REQUIREMENTS-ANALYSIS.md`、`00-CURRENT-STATUS.md`、`03-FUNCTIONAL-DESIGN.md`、`AI-ROADMAP-0.50.md`、`RELEASE-NOTES-0.51.0.md` 與 `08-CHANGE-LOG.md`；`lm-studio` deterministic provider／UI／optimizer tests 保留且未修改。
- 驗證結果：本輪僅需執行文件驗證與 `git diff --check`；既有 BUG-030 的 `npm run check`、Ollama 本機 evidence 與獨立審查仍有效，未將缺少 LM Studio 服務冒充實機通過。
- 剩餘風險：FR-021 原始「兩 provider 各一模型」條件因需求方例外不在本輪執行，但真正斷網與 Ollama 完整人工接受／取消／續跑仍未完成；若需求方恢復 LM Studio，必須新增工作條目並重新驗收。

## 2026-09-29 FR-021 macOS Seatbelt deny-network Ollama product flow

- 關聯需求：`FR-021`、`NFR-001`、`NFR-005`、`NFR-006`。
- 變更：新增 `scripts/probe-ollama-product-offline.mjs`／`npm run acceptance:ollama:offline` 與 provider source-contract checks。wrapper 限 macOS，對 `sandbox-exec` profile 固定 deny 所有 network operations、只放行 localhost；先以 sandbox process 建 HTTP loopback server／client 並嘗試 RFC5737 測試位址，要求 localhost 成功且外連 `EPERM`。profile assertion 未過、模型不存在或 endpoint 被自訂時均 fail-closed。
- 模型／隔離：不使用桌面版既有 Ollama daemon；wrapper 另起受 sandbox 約束的 loopback daemon，將 HOME／暫存資料放在本輪隔離目錄，僅指向既有 model store。依 `OLLAMA_MODEL` 查 `/api/tags` 並要求指定模型精確存在後才啟動 product probe，故不會以缺失模型觸發下載；probe／其 server child 與 Ollama daemon 都套用同一 network profile，未使用 API Key、未呼叫雲端、未修改防火牆／全機網路。修復後分別以預裝 `llama3.2:1b` 與 `llama3.2:3b` 實測。
- 實機指令：`OLLAMA_MODEL=llama3.2:1b npm run acceptance:ollama:offline -- docs/project-management/evidence/2026-09-29-ollama-llama3.2-1b-product-offline-replay7.json`；macOS arm64／Node v22.22.3，exit 0。Evidence 記錄 sandbox egress `EPERM`、loopback allowed、preinstalled model found、AI `completed`、2 suggestions、accepted 2、undo／redo 各 2、review cue 2、時間碼不變、來源 SRT 前後 SHA-256 相同；自有 daemon 已停止、port 關閉、temp root 已移除。
- 重播／品質邊界：初始版本 replay7 的 1B product flow 通過；round1 修復後 1B replay8／replay9 均以 `MODEL_RESPONSE_CONTRACT_REJECTED` 結束，但 evidence 仍確認外連 `EPERM`、獨立 daemon 已啟動並停止、port closed、temp root removed。修復後 3B replay1 通過兩 cue product flow 與完整 cleanup。replay6 的 `OLLAMA_TASK_FAILED` 亦保留；不將單次成功推廣成任一模型的翻譯品質或穩定性保證，evidence 不保存 raw model output。
- 開發驗證：初始 wrapper 的語法、provider contract、完整 `npm run check` 與 `git diff --check` 均通過。round1 修復後曾完成 managed-child focused test、provider contract、完整 `npm run check` 與 `git diff --check`。round2 後 `node --check lib/ai/managed-child-process.mjs`、`node --check scripts/probe-ollama-product-offline.mjs`、`node --check scripts/test-ollama-offline-process.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ollama-offline-process.mjs`（含 macOS wrapper ENOENT integration evidence／cleanup assertions）、`node scripts/test-ai-providers.mjs`、最新完整 `npm run check`（19 個治理文件及全套測試）及 `git diff --check` 均 exit 0。
- 遠端 endpoint 負向邊界：`OLLAMA_MODEL=llama3.2:1b OLLAMA_BASE_URL=https://example.com node scripts/probe-ollama-product-offline.mjs <temporary-output-path>/negative.json` exit 1、`failureCode=CUSTOM_OLLAMA_URL_NOT_ALLOWED`、`daemon.startedInSandbox=false`；僅在 repo 外測試專用暫存目錄寫出負向 evidence 後即清除，未對 `example.com` 發出連線。
- 範圍判定：只證明 macOS arm64 上 sandboxed Ollama API product flow 的限定測試子程序無外部 socket egress；沒有停用系統網路。packaged Electron UI 在該 sandbox 下、使用者 UI 取消／checkpoint 續跑、物理斷網、LM Studio（需求方例外）、Windows 實機、乾淨安裝與 Release 均未涵蓋，FR-021 整體不結案。
- 獨立六面向審查：round1 報告指出 daemon spawn-error 未受控，round2 報告指出 wrapper integration 未直接驗證；兩項均已修正。round3 報告 `docs/project-management/reviews/2026-09-29-fr-021-ollama-macos-seatbelt-network-isolation-round3.md` 對本子範圍有條件通過，確認 wrapper 層 ENOENT 故障注入及 cleanup 證據；工作紀錄已引用報告原句並關閉條件。`npm run docs:check:final` exit 0，通過 19 個治理文件檢查；round1／round2／round3 原件均保留。

## 2026-09-15 FR-021-032 Ollama 本機產品級人工流程驗收

- 關聯需求：`FR-021`、`FR-010`、`NFR-001`、`NFR-005`、`NFR-006`。
- 探針與範圍：新增 `scripts/probe-ollama-product-live.mjs`／`npm run acceptance:ollama:product`；以暫存 `OFFLINE_SUBTITLE_DATA_DIR`、測試 server、假影片與 2 cue 自然字幕執行，Ollama endpoint 僅允許 `http://127.0.0.1:11434/v1` 類 loopback；不使用 API Key、不呼叫雲端、不關閉系統網路、不啟停／下載／刪除模型，LM Studio 依 FR-021-031 例外不執行。
- 修正探針：第二次重跑的 HTTP 400 由探針把 SRT 時碼字串送入雙語 cue API 造成；已改以數值秒數送出並保留原始 `startRaw`／`endRaw`，同時以數值時間比對未變，未改產品 runtime。
- 探針契約：`node --check scripts/probe-ollama-product-live.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs` 與 `git diff --check` 均 exit 0；provider focused test 另確認 probe 使用暫存資料目錄、loopback-only 宣告、未宣稱系統斷網、時間碼／原始 SRT 驗證及 evidence 不覆寫。
- 實機結果：`OLLAMA_MODEL=llama3.2:1b npm run acceptance:ollama:product -- docs/project-management/evidence/2026-09-15-ollama-product-live-recheck-5.json` exit 0；artifact 記錄 Ollama `llama3.2:1b`、`endpointPrivacy=local`、AI `completed`、2 suggestions、0 retries、session accepted 2、undo 2、redo 2、review cue 2、`timecodesUnchanged=true`、`sourceSrtPreserved=true`，且保存前／後 `sourceSrtBeforeSha256`／`sourceSrtAfterSha256` 相同。
- 回應品質邊界：初次抽象字幕 fixture 讓 1B 模型回傳中文，既有語系驗證安全拒絕並保存失敗 artifact；改用不含提示語的自然字幕後完成。這證明 strict validator 仍有效，也表示小模型輸出品質仍須逐段人工確認，不能把任一成功 fixture 推廣成通用模型品質保證。
- 隱私判定：最終 artifact 的 `endpointPrivacy` 為 `local`，`scope.systemNetworkDisabled=false`；本輪只有 loopback 配置，未取得真正斷網證據，故 FR-021 整體不得標示完成。
- round1 修正：獨立審查發現遠端 `OLLAMA_BASE_URL` 未拒絕、SRT 保存前沒有 hash 基準，以及既有 evidence 檢查太晚會跳過暫存清理；探針已改為啟動前 loopback／output guard、保存前後 hash 比對，並以 nested `finally` 確保暫存清理。round1 報告保留於 `docs/project-management/reviews/2026-09-15-ollama-product-live-round1.md`，未覆寫。
- round2 修正：獨立複審確認上述三項已解除，另發現 exists-then-write 競態與 child env 過寬；探針已改用 evidence exclusive `flag: 'wx'`、最小化 server env（清除 AI key，限定 tools／cache／tmp 到暫存目錄）。round2 報告保留於 `docs/project-management/reviews/2026-09-15-ollama-product-live-round2.md`，未覆寫。
- 邊界驗證：`OLLAMA_BASE_URL=https://example.invalid/v1 node scripts/probe-ollama-product-live.mjs /private/tmp/osf-ollama-product-remote-guard-round2.json` exit 1 且未寫 evidence；以既有 output fixture 執行 probe exit 1、未啟動 server／未建立暫存資料。`node --check scripts/probe-ollama-product-live.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs` 與 `git diff --check` 均 exit 0。
- round3 複審：`docs/project-management/reviews/2026-09-15-ollama-product-live-round3.md` 判定通過，無新增阻擋問題；確認 `flag: 'wx'`、最小 child env、loopback guard、保存前／後 hash 與暫存清理均符合本輪範圍。未執行 Electron／瀏覽器 UI 或真正斷網，並已明確揭露。
- round4 獨立複審：`docs/project-management/reviews/2026-09-15-ollama-product-live-round4.md` 依 validator 格式完成六面向複審，判定通過且無阻擋問題；確認 round1／round2 修正、`flag: 'wx'`、最小 child env、loopback guard、保存前／後 hash 與暫存清理均維持有效。測試覆蓋仍只支持 loopback API product path；未執行 Electron／瀏覽器 UI、真正斷網或 LM Studio 實機，故不得宣稱 FR-021 整體完成。

## 2026-09-16 FR-021 packaged renderer UI 範圍補證

- 關聯需求：`FR-021`、`FR-010`、`NFR-001`、`NFR-005`、`NFR-006`。
- 驗收指令：`node scripts/verify-electron-renderer.mjs '../dist/mac-arm64/離線字幕工廠.app/Contents/MacOS/離線字幕工廠' 9987 60000`；環境為 macOS arm64、Node v22.22.3、受控權限、隔離 userData；exit 0。
- 實際結果：首頁 dashboard／navigation／new project／create-and-trim、Electron bridge（含 folder／safe key API）、設定 modal、Breeze 首次選擇開啟／取消、手動 SRT 任務 `completed`、trim 資產、校閱 AI selection／session／secure key／collapsible toolbar、glossary round-trip、8 個 provider ID 與 folder icon flow 均通過；證據保存於 `docs/project-management/evidence/2026-09-16-macos-renderer-smoke-fr-021.json`。
- 隔離與隱私：artifact 記錄 `isolatedUserData=true`、`externalApiKey=false`、`systemNetworkDisabled=false`、`ollamaLiveUiFlow=false`，且未執行 LM Studio；暫存 userData 由既有 verifier 清理。
- 判定邊界：本輪只補共用 packaged renderer／校閱 UI 的實機證據，不證明 Ollama live AI UI 優化、真正斷網、LM Studio 或 FR-021 整體完成；後三者仍依前輪範圍與需求方決策保留為未完成／未執行項目。
- round1 獨立審查：`docs/project-management/reviews/2026-09-16-macos-renderer-smoke-fr-021-round1.md` 判定有條件通過；獨立重播 port 9988 曾於 `verify-electron-renderer.mjs:74` timeout，並指出原驗收未傳入 real trim 媒體。原報告未覆寫。
- round1 後重驗：同一候選 port 9988 renderer smoke exit 0；再以 `electron/assets/offline-subtitle-splash.mp4`、port 9989 傳入第五參數執行 real trim branch，exit 0，`trimStatus=completed`、`trimDuration=2.021333`、`usesTrimmedVideo=true`、`shiftedSubtitle=true`。結果保存於 `docs/project-management/evidence/2026-09-16-macos-renderer-smoke-fr-021-recheck-2.json`；timeout 原始結果保留，尚待同一審查角色 round2。
- round2 獨立複審：`docs/project-management/reviews/2026-09-16-macos-renderer-smoke-fr-021-round2.md` 原文判定通過（僅限 macOS arm64 packaged renderer／校閱 UI／real trim 補證），但格式未滿足治理 validator；原文保留，未作最新結案依據。
- round3 格式合規獨立複審：`docs/project-management/reviews/2026-09-16-macos-renderer-smoke-fr-021-round3.md` 判定通過（僅限 macOS arm64 packaged renderer／校閱 UI／real trim 補證），六面向與具體證據欄位完整，無阻擋問題；確認 timeout 已成功重播、real trim 結果完整，並要求維持 Ollama live UI、真正斷網、LM Studio 與 FR-021 整體未完成的範圍聲明。

## 2026-09-16 FR-021-033 Ollama packaged 校閱頁 live UI

- 關聯需求：`FR-021`、`FR-010`、`NFR-001`、`NFR-005`、`NFR-006`。
- 探針與契約：新增 `scripts/verify-electron-ollama-ui.mjs`／`npm run acceptance:ollama:ui`；以隔離 Electron userData 啟動既有 macOS arm64 packaged app，透過 renderer UI 設定 Ollama loopback、英文輸出與 2 cue 手動任務，實際按下 AI 優化、全部接受、undo／redo 與保存 SRT；source contract 覆蓋 UI 導覽、設定、啟動、接受、歷史、保存、loopback、空 API Key、非斷網宣告及 exclusive evidence create。
- 實機驗收：`node scripts/verify-electron-ollama-ui.mjs '../dist/mac-arm64/離線字幕工廠.app/Contents/MacOS/離線字幕工廠' 10000 30000 'docs/project-management/evidence/2026-09-16-ollama-ui-live-final-2.json' 'llama3.2:1b'` exit 0；artifact 記錄 HTTP create 201／start 202、job completed、review ready、Ollama UI 設定已保存、英文、無 key、local privacy、AI completed、2 suggestions、accepted 2、undo／redo、`reviewed.srt`、2 cue、`timecodesUnchanged=true`。
- 開發驗證：`node --check scripts/verify-electron-ollama-ui.mjs`、`node scripts/test-ai-providers.mjs`、`git diff --check` 與獨立審查執行的 `npm run check` 均 exit 0；失敗重播 artifact 保留，包含純中文 1B 語言／JSON 不穩定及 3B latency／timeout，未修改 strict language validation。
- fixture 與品質邊界：最終 UI probe 使用中英混合短句以完成受控 UI chain；它只證明 packaged UI／AI session／保存鏈路，不能推廣成長中文翻譯品質保證。先前純中文 1B 失敗不被成功 fixture 覆蓋。
- 隱私與範圍：只配置 `http://127.0.0.1:11434/v1`、不使用 API Key／雲端、不下載／啟停／刪除模型；`systemNetworkDisabled=false`，因此不宣稱真正斷網。LM Studio 依需求方已刪除例外未執行，Windows／乾淨安裝／發布亦未涵蓋。
- round1 獨立審查：`docs/project-management/reviews/2026-09-16-ollama-ui-live-round1.md` 六面向判定通過、無阻擋問題；報告格式 validator 通過，並確認遠端 URL／既有 evidence 會於啟動前拒絕、evidence 使用 `flag: 'wx'`、API Key／loopback／非斷網邊界與完整回歸證據均可追溯。
- 判定：本輪只結案 FR-021-033 限定 macOS arm64 packaged Ollama loopback UI flow；FR-021 整體仍未結案。

## 2026-09-15 FR-021-030 Ollama 單句契約重驗

- 關聯需求／缺陷：`FR-021`、`BUG-030`、`NFR-001`、`NFR-005`、`NFR-006`
- 修正前證據：`docs/project-management/evidence/2026-09-15-ollama-llama3.2-1b-provider-recheck.json` 保存 provider raw probe 失敗；HTTP／模型連線正常，但 `llama3.2:1b` 回傳合法未包裝 cue object，未符合 raw `cues` contract。直接重現 optimizer path 亦回報 `AI 回傳缺少 cues 陣列`。
- focused 驗證：`node --check lib/ai/subtitle-optimizer.mjs`、`node --check scripts/test-ai-optimizer.mjs`、`node --check scripts/probe-ollama-live.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-optimizer.mjs` 與 `node scripts/test-ai-providers.mjs` 均 exit 0；deterministic 測試涵蓋未包裝 cue object→一次 repair→wrapper 成功與第二次輸出仍不合格時拒絕。
- 實機驗證：`OLLAMA_MODEL=llama3.2:1b node scripts/probe-ollama-live.mjs docs/project-management/evidence/2026-09-15-ollama-llama3.2-1b-optimizer-recheck.json` exit 0；artifact 記錄 Ollama `0.34.0`、2 個模型、endpoint privacy `local`、capability 200、native single-cue strict contract 通過，以及 optimizer 一 cue `suggestionCount=1`、`totalRetries=0`、`responseShapes=["cue-object","cues-array"]`。
- 隱私與範圍：本輪僅連線 `127.0.0.1:11434`，未使用 API Key、未呼叫雲端、未下載／刪除／啟停模型；LM Studio `127.0.0.1:1234` 未啟動，未宣稱 FR-021 整體或真正斷網驗收完成。

## 2026-09-14 BUG-028 Anthropic 模型清單分頁完整性

- 關聯需求／缺陷：`BUG-028`、`FR-026`、`NFR-005`、`NFR-006`
- 修正前重現：mock 第一頁回傳 `newer-model`、`has_more=true`、`last_id`，第二頁才包含設定的 `test-model`；原 `listAnthropicModels()` 只發出一次 GET，`node scripts/test-ai-providers.mjs` exit 1，錯誤為「第二頁指定模型不得被誤判為不可用」，實際值 `false`。
- focused 驗證：`node --check lib/ai/anthropic.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs` 與 `git diff --check` 均 exit 0。測試確認每頁送出 `limit=1000`、opaque cursor 可安全編碼／還原、第二頁模型可用且完整計數為 2。
- 邊界驗證：`has_more` 缺失、`has_more=true` 但 `last_id` 空白、重複 `last_id` 均明確拒絕；連續 100 頁仍宣告有後頁時由安全上限停止。既有空清單、缺少指定模型、API Key 不入 URL、GET 無生成 body、headers、Messages body 與其他 provider contract 仍通過。
- 完整回歸：`npm run check` exit 0，包含治理文件、Node 語法、Whisper、Breeze、Electron、影片修剪、雙語字幕、品質、AI fetch／optimizer／providers、Ollama streaming、review UI 與核心 API 測試。
- round1 審查修正：審查以 `last_id="  cursor /+?  "` 證明初版 `.trim()` 會改寫 opaque cursor；正式測試擴充為前後空白加特殊字元並先再現重複游標錯誤，adapter 改為只以 trim 結果判斷是否全空白，`seenCursors` 與 `after_id` 均使用原始 string。2026-09-15 08:53（Asia/Taipei）修正後 focused Node 語法、provider contract、opaque cursor exact-forwarding、完整 `npm run check` 與 `git diff --check` 均 exit 0；round2 獨立複審通過。
- 未覆蓋：未使用真實 Anthropic API Key、超過 20 筆的真實帳號模型清單或自訂 proxy；外部速率限制、網路中斷、跨平台封裝後請求與真實服務回應仍待另行驗收。

## 2026-09-15 BUG-029 AI provider profile 秘密欄位隔離

- 關聯需求／缺陷：`BUG-029`、`NFR-002`、`FR-009`、`FR-021`、`FR-026`
- 修正前重現：核心測試在 `/api/ai/settings` payload 的 `profiles.anthropic` 放入 `apiKey`、`authorization` 與 `secret`；原保存流程將秘密字串寫入一般 `settings.json`，`node scripts/test-core.mjs` 於該 assertion exit 1。
- 修正後 focused 驗證：`normalizeAiProfiles()` 只保留 `baseUrl`、`model`、`deployment`、`apiVersion`、`batchSize`、`timeoutSeconds`；核心測試確認秘密不在一般設定檔，`/api/ai/profile` 不回傳秘密且合法 `model` 保留。
- 執行結果：`node --check server.mjs`、`node --check scripts/test-core.mjs`、`node scripts/test-core.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-review-ui.mjs` 與 `git diff --check` 均 exit 0。
- round1／round2 審查：獨立審查先發現 allowlist 常數晚於模組啟動時的 `loadSettings()`，含既有非空 profile 的設定會被 catch 靜默回退預設值；已將常數移至啟動載入前，並把核心測試初始設定改為含非空 Anthropic profile，實際驗證 Base URL、model、batch／timeout 保留且未知欄位不進 runtime。修正後上述 focused 測試與重啟回歸均 exit 0；round2 報告 `docs/project-management/reviews/2026-09-15-ai-profile-secret-isolation-round2.md` 判定通過，無阻擋問題。獨立 sandbox 的核心 listener 受 `EPERM` 限制，採主要代理已完成的完整回歸證據。
- 未覆蓋：本輪未變更既有 secrets 儲存／加密遷移機制，也未對歷史設定檔中已存在的秘密做清理；未執行外部 AI API 或發布驗收。

## 2026-09-16 BUG-031 歷史 AI profile 秘密欄位啟動清理

- 關聯需求／缺陷：`BUG-029`、`BUG-031`、`FR-009`、`FR-021`、`FR-026`、`NFR-002`、`NFR-005`、`NFR-006`。
- 修正前重現：啟動 fixture 在一般 `settings.json` 預置 AI 根層 `apiKey`／Authorization／access token／client secret／credential／password／private key／token／secret，以及 Anthropic profile 秘密與未知 provider；受控權限執行 `node scripts/test-core.mjs` 於磁碟秘密清除斷言 exit 1，證明原流程只清理 runtime、不清理既有檔案。沙盒內首次執行因 local fixture listener `EPERM`，取得受控 loopback 權限後取得上述產品基準失敗。
- 修正內容：`loadSettings()` 以固定 secret-shaped 根層鍵名清單刪除 legacy AI 明文，以既有 profile allowlist 取代 profiles 並移除未知 provider；只在內容改變時，以同目錄、不含秘密的暫存檔原子置換 `settings.json`，完成後清除暫存檔。合法 profile、非敏感未知 AI 根層欄位及獨立 `ai-secrets.json` 不變，歷史明文不自動匯入 secrets。
- focused 驗證：`node --check server.mjs`、`node --check scripts/test-core.mjs`、`node scripts/test-ai-providers.mjs` 與 `git diff --check` 均 exit 0；受控權限 `node scripts/test-core.mjs` exit 0，直接讀回磁碟確認兩組 legacy marker 消失、未知 provider profile 消失、合法 model／batch／timeout 保留、`futureNonSensitiveSetting` 保留、既有獨立 secret 保留且未混入 legacy marker、無 `settings.json.*.tmp` 殘留。
- 完整回歸：`npm run check` exit 0，涵蓋治理文件、Node 語法、Whisper、Breeze、Electron、影片修剪、雙語字幕、品質、AI fetch／optimizer／providers、Ollama streaming、review UI 與核心 API／啟動遷移測試。
- round1／round2 獨立審查：round1 因審查提前停止、未完成程式與文件讀取而有條件通過，沒有提出程式阻擋；保留原報告後，由新的獨立上下文完整核對 `server.mjs`、核心 fixture 與 BUG-031 文件。round2 六面向均通過，確認根層固定 secret-shaped 清理、profile 雙重 allowlist、非法根物件／寫入失敗／暫存清理、未知非敏感根層欄位與既有 secrets 的處理合理，且核心測試實際啟動 server 後直接讀回兩個磁碟檔；報告為 `docs/project-management/reviews/2026-09-16-historical-ai-profile-cleanup-round2.md`，無阻擋問題。
- 失敗邊界：若設定目錄不可寫，migration 不把原始值輸出到 log，runtime 仍使用正規化資料並提示檢查一般設定檔權限；該情境下磁碟殘留仍需修正權限後重啟。本輪未以 Windows 真實檔案鎖定重放 rename 失敗。
- 範圍：不解密／改寫 OS 安全儲存、不掃描備份或其他使用者檔案、不呼叫外部 AI、不使用真實 API Key、不打包或發布。

## 2026-09-14 BUG-027 Anthropic 新模型取樣參數相容性

- 關聯需求／缺陷：`BUG-027`、`FR-026`、`NFR-005`、`NFR-006`
- 修正前重現：在 `scripts/test-ai-providers.mjs` 的 Anthropic optimizer body 加入 `temperature: 0`、`top_p: 0.8`、`top_k: 20` 並斷言不得外送；修正前 exit 1，第一個錯誤為 `Anthropic 不得外送新模型會拒絕的 temperature`，實際值為 `0`。
- focused 驗證：`node --check lib/ai/anthropic.mjs`、`node --check scripts/probe-provider-live.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs` 與 `git diff --check` 均 exit 0；測試確認三個取樣欄位均為 `undefined`，既有 header、max tokens、system／messages、metadata 清理及 response mapping 仍通過。
- 完整回歸：`npm run check` exit 0，包含治理文件、Node 語法、Whisper、Breeze、Electron、影片修剪、雙語字幕、品質、AI fetch／optimizer／providers、Ollama streaming、review UI 與核心 API 測試；round2 通過後 `npm run docs:check:final`、`git diff --check` 與 focused provider contract 亦均 exit 0。
- round1 審查修正：審查指出共用 `probe-provider-live.mjs` 不應移除 `temperature: 0`，否則會改變六種非 Anthropic provider 的既有驗收輸入；已恢復該欄位，改由 Anthropic adapter 局部過濾，並新增 probe source contract 與 `stop_sequences` 保留斷言。
- 未覆蓋：未使用真實 Anthropic API Key 或付費模型，未測 Claude Opus 4.7+、proxy、計費、速率限制與跨平台封裝後外部請求；本輪只驗證 deterministic request contract。

## 2026-08-26 BUG-026 Whisper／FFmpeg 取消生命週期

- 關聯需求／缺陷：`BUG-026`、`FR-003`、`FR-022`、`NFR-005`
- 變更內容：內建 FFmpeg、Python Whisper 與 Whisper.cpp 取消時等待子程序 `close`；Unix 逾時後 `SIGKILL`、Windows 使用 taskkill tree；取消後清理暫存音訊與部分 SRT／JSON／品質 metadata。
- 新增 deterministic 證據：`scripts/fixtures/mock-whisper-cpp-runtime.mjs`、`scripts/fixtures/mock-whisper-python-runtime.mjs`、`scripts/fixtures/mock-ffmpeg-runtime.mjs`；`scripts/test-core.mjs` 覆蓋正常完成、spawn 前取消、取消等待、暫存檔清理、非 ASR 工作檔保留與 stubborn child grace period。
- 已執行：`node --check server.mjs`、三個 fixture 與 `scripts/test-core.mjs` 的 `node --check`、`git diff --check`、`node scripts/test-core.mjs`、`npm run check`。
- 目前結果：上述語法／差異檢查、核心整合測試與完整 `npm run check` 修正後均通過；round2 後補修 FFmpeg 成功前處理音訊保留，round5 格式合規獨立六面向複審為有條件通過；`npm run docs:check:final` 與 `git diff --check` 已通過。
- 未覆蓋：Windows taskkill 實機、真實 Whisper／FFmpeg 長音訊、Apple Metal fallback 與 Breeze 真實 runtime；本輪不宣稱跨平台實機驗收。

## 六面向獨立審查

審查代理必須提供證據並逐項判定：

1. 需求完整性。
2. 邏輯正確性。
3. 邊界情況。
4. 程式碼品質。
5. 測試覆蓋。
6. 實際運行結果。

審查代理只能讀取、執行、驗證，除本輪獨立審查報告外不得修改檔案。報告須存於 `docs/project-management/reviews/`，由審查代理本人產出；工作紀錄只能連結並逐字引用判定，不得由主要代理代寫或轉述。若有問題，主要代理修正；影響原判定時須建立下一輪報告複審，不得覆寫舊報告。

## 需求追溯格式

每次工作在 `08-CHANGE-LOG.md` 至少記錄：需求 ID、修改檔案、測試 ID／指令、結果、審查結論、發布證據。無自動測試時必須寫原因與人工替代證據。

## 0.45.1 已有證據

- 本機與 Windows Actions `npm run check` 通過。
- Windows Server 2022 run `29556747371` 成功產生 Setup／Portable 並通過 archive 驗證。
- Windows EXE SHA 與 GitHub Release digest 一致。
- Portable EXE 清單含離線 HTML、四張圖片與三段 10.048 秒 MP4 內容的 `.osfvideo`。
- macOS DMG／ZIP 已發布；既有發布紀錄包含 DMG 與 codesign 驗證。

## 0.45.1 未覆蓋證據

- Windows 乾淨實機安裝、解除安裝與捷徑。
- Windows 上離線手冊三段動畫的實際播放。
- Authenticode 簽章成功路徑。
- Apple Developer ID 與 notarization。

## 多語言 LLM 開發中驗證

## 0.46 雙語字幕驗證

- `test-bilingual-subtitles.mjs`：驗證單語 SRT 無損轉為雙欄、原文／譯文排列、SRT／VTT 輸出，以及無效時間碼／空文字拒絕。
- `test-review-ui.mjs`：驗證雙語排列控制、ASS 下載入口與原文／譯文欄位。
- 核心 API／保存包需驗證 `bilingual-cues.json`、排列設定、cue 數量與時間碼保護；跨平台 renderer、FFmpeg 實際雙語燒錄仍需於封裝／實機階段補測。
- 目前已完成受控環境核心保存／載入／ASS 整合驗證；未覆蓋項目明確包括 AI 雙語回應 contract、規則／分割合併專門案例、FFmpeg 實際解析／硬燒錄、Electron renderer 與 Windows／macOS 安裝後操作。

- `test-ai-optimizer.mjs`：驗證 BCP 47 基本、variant、extension 標準化，惡意／無效值拒絕、舊設定回退、翻譯 Prompt、一般優化 Prompt，以及模型交換 cue 順序時必須拒絕。
- `test-review-ui.mjs`：驗證常用語言選項、自訂語言欄位、簡體中文選項不存在與送出時共用語言解析函式。
- `test-core.mjs`：驗證自訂 `fr-CA` 可保存並標準化，專用 AI 設定、一般設定及 AI 任務 API 的非法語言值均回覆 400，舊版 AI／介面簡體中文設定在啟動時回退繁中，AI 任務沿用多語設定。
- 本項目完成自動測試與獨立審查前維持「開發中」，不得標示為 0.45.1 已發布功能。

## 發布稽核判定

- **通過**：必要測試及審查完成，無阻擋問題，發布資產與說明一致。
- **有條件通過**：風險已明確揭露並由需求方接受，具替代驗證；條件與授權來源須記錄。
- **不通過**：checksum、資料安全、核心功能、簽章宣稱、需求或資產不一致等阻擋問題未解決。

發布等級工作缺少發布授權記錄時不得判定「通過」；最高只能列為「有條件通過／發布授權待補」。歷史審查或授權缺少獨立證據時只能標示缺口，不得回溯補造。

## 0.45.2 發布候選驗證計畫

- 來源：0.45.2 版本檔、Release notes、內建 0.45.2 手冊與多語言 LLM 差異。
- macOS：runtime manifest／hash、unpacked App、DMG、ZIP、ad-hoc codesign、手冊與 SHA。
- Windows：Windows Server 2022 完整回歸、runtime hash、Setup／Portable archive、手冊、未簽章狀態與 SHA。
- 發布：獨立六面向審查、GitHub 資產名稱／大小／digest／下載核對。
- 未覆蓋：Windows／macOS 乾淨實機安裝與完整操作；風險已由需求方明確接受並須持續揭露。

## 0.45.2 AI 供應商補強驗證

- `test-ai-providers.mjs`：驗證五種 provider definition、Groq models／chat completions、Gemini models 的 `x-goog-api-key` 認證，以及 Gemini OpenAI 相容 chat completions 的 Bearer 認證、請求與回應契約；API Key 不進入 URL。
- `test-core.mjs`：驗證非法 provider 在 settings／profile API 回覆 400；Groq 設定不會回退成 OpenAI-compatible；Groq／Gemini profile 與 runtime／磁碟金鑰隔離；清除一個供應商金鑰不影響另一個。
- `test-review-ui.mjs`：驗證 Groq／Gemini 選項、供應商白名單、Azure 欄位停用與連線前欄位／金鑰提示契約。
- `verify-electron-renderer.mjs`：封裝後 renderer 驗證要求 settings API 同時列出 OpenAI、OpenAI-compatible、Azure、Groq 與 Gemini，避免 source 有選項但安裝包缺 provider definition。
- 2026-07-22 macOS 本機瀏覽器實測：Groq 自動帶入 `https://api.groq.com/openai/v1`；Gemini 自動帶入 `https://generativelanguage.googleapis.com`；兩者清空並停用 Azure 欄位；切回 Azure 後 Deployment／API Version 恢復可用；缺模型時測試連線顯示可採取行動的錯誤且按鈕恢復可用。
- round1 修正後，`ai-provider-settings.mjs` 的可執行測試覆蓋已保存 profile 與未保存 provider／Base URL／model／Azure deployment／API version／API Key；瀏覽器實測修改已保存 Groq profile 的 model 後，測試連線被阻擋、按鈕恢復，server log 確認未送出 `/api/ai/test`。
- round2 修正後，`test-review-ui.mjs` 直接執行可注入連線控制器：七類未保存／缺 key 狀態均斷言 request 0 次；已保存未變更狀態 request 1 次；阻擋、成功、HTTP 錯誤與 fetch 例外後按鈕皆恢復，錯誤訊息可診斷。
- 未覆蓋：未使用真實 Groq／Gemini API Key 呼叫外部服務；Windows／macOS 乾淨實機安裝與啟動仍待 0.45.3。0.45.2 macOS arm64 DMG／ZIP、Windows Setup／Portable 與 updater metadata 已於發布前後核對通過。

## 0.51.0 Anthropic Claude provider 開發驗證

- `test-ai-providers.mjs`：驗證 Anthropic provider registry、預設端點、`/v1/messages` 與 `/v1/models` 路徑、Models API 全分頁與異常游標防護、`x-api-key`／`anthropic-version` 標頭、連線測試只使用 GET models 且不發送生成 body、modelAvailable true／false（含空清單與後頁命中）、system／user 訊息轉換、`max_completion_tokens`→`max_tokens`、OpenAI 專用欄位與內部 cue metadata 清理，以及 Anthropic content blocks 回應正規化。
- `test-core.mjs`：驗證 settings API 列出 Anthropic、profile／runtime key 以 provider ID 隔離、API Key 不進一般設定或 API 回應，非法 provider 仍回覆 400。
- `test-review-ui.mjs`：驗證 Anthropic Claude 選項與既有供應商白名單／連線表單契約。
- 驗證限制：本輪不使用真實 Claude API Key、不測量外部模型品質／計費、不宣稱跨平台封裝或公開 0.51.0 Release 已完成；需另行進行使用者授權的外部 endpoint smoke 與平台候選驗收。

## 0.45.3 設定遷移驗證計畫

- BUG-012：`test-core.mjs` 驗證 `openai-compatible` 搭配 Gemini URL／`gemini-*` 模型時，會回復空 Base URL／空模型，且不影響供應商金鑰隔離。
- 必測：正常 OpenAI-compatible 自訂 endpoint、正常 Gemini profile、舊混用設定、空值、非法 provider、重啟後設定持久化。
- 實機：以既有 0.45.2 使用者設定升級到 0.45.3，確認 UI 不再顯示跨供應商資料。

## 0.47.0 發布閉環核對（2026-07-28）

- 本機核對：`git rev-parse HEAD` 為 `efc6259140640e65f9273284811c365da473bc88`；既有 release round1 報告記錄的 Release／Windows CI 目標為 `7946f7fa8e080f28a65639053f674fa8babcd5fe`，來源尚未一致。
- GitHub Release API 核對（2026-07-28 可取得的回應）：`v0.47.0` target 為 `7946f7f`；公開資產為 `offline-subtitle-factory-0.47.0-macos-arm64.dmg`、`offline-subtitle-factory-0.47.0-macos-arm64.zip`、`RELEASE-SHA256SUMS-0.47.0-macos-arm64.txt`，未見 Windows Release asset。
- Windows 證據：workflow run `30231912997`／artifact `8640388049`、名稱 `offline-subtitle-factory-0.47.0-windows-x64` 與 SHA-256 已記錄於 `RELEASE-NOTES-0.47.0.md`；本輪未能重新下載 artifact，內容逐檔核對與發布後下載核對仍待執行。
- 判定：發布閉環未完成；來源 commit 不一致與 Windows 未公開／未反向核對為阻擋項。未簽章／未公證、Metal exit 139、Electron 與跨平台實機缺口仍為揭露中的條件風險，不得由 CI 成功取代。

## 0.47.1 發布後核對（2026-07-28）

- 來源：annotated tag `v0.47.1` 解析至 commit `0bd3b53be0cd523d7c7beb3078b5b46dad2f81b1`；GitHub Release 已由 draft 正式發布。
- 開發驗證：受控環境外 `npm run check` 通過；`hdiutil verify` 驗證 macOS DMG；`unzip -t` 驗證 macOS ZIP 與 Windows artifact archive；Windows `latest.yml`、Setup／Portable 與 SHA-256 清單一致。
- 發布資產：GitHub Release `v0.47.1` 公開 7 項資產，API 已核對名稱、大小、digest 與直接下載 URL；macOS DMG／ZIP 的 GitHub digest 分別為 `88cc9ce8f76a2b720a74e52780d8c2340acd25cf324895233d41051cbaa35f04`、`1411e242136908a54bd8ad7cc95088e18a383c216004fa3afcbff2e5c0b7fb8e`；Windows Setup／Portable digest 分別為 `323b08300b2724b0dabf9a8e6c5aef7dfed850df7707328412a3794d24f352a9`、`5e1445b67f4a84f5c09d0dd80b854c05146cdc0efa34f1481de6fa46ae48f237`。
- 限制：Windows 未 Authenticode、macOS 未 Developer ID／公證；Metal exit 139、Electron、跨平台安裝後與長音訊實機仍未覆蓋，Release notes 已揭露。
- 独立审查：`docs/project-management/reviews/2026-07-28-0-47-1-release-round2.md`；结论为有条件通过，条件与剩余风险详见该报告及工作纪录。

## FR-022 Whisper 三模型模式驗證（2026-08-04）

- `scripts/test-whisper-models.mjs` 以 deterministic mock runner 覆蓋 `tiny`／`base`／`small` 三個模型：模型白名單與 alias 正規化、模型路徑、whisper.cpp CLI 參數（含 `--no-gpu`）、SRT／JSON 輸出、quality metadata 解析，以及缺檔、too-small、SHA mismatch、manifest-size mismatch 與 UI option presence 拒絕／存在性。
- `npm run runtime:manifest`、`npm run runtime:verify`、`npm run runtime:manifest:mac`、`npm run runtime:verify:mac` 均通過；目前現有 runtime 只包含 tiny，manifest 已支援 optional `files.models` 對 base／small 做 hash 驗證。
- `npm test` 通過，包含核心 API／任務回歸；本輪沒有下載或執行實際 base／small 權重，因此未宣稱三模型實際中文準確率、速度、記憶體或 Windows／macOS 安裝後驗收。
- 未覆蓋：實際 base／small 模型檔、模型匯入 UI、Windows／macOS 乾淨安裝與長音訊實機；這些應於加入相應模型資產前另行驗收。

## BUG-024 Whisper Small 過長字幕 cue 正規化驗證（2026-08-20）

- `scripts/test-whisper-srt.mjs` 覆蓋 Small 長 cue 的標點拆分、最多兩行／正常情況每行最多 20 字元（可見文字）、跨英文 cue／換行的空白保留、原本兩行各 20 字元不重拆、時間碼連續與嚴格遞增、文字無損、超過 40 字元純中文在 1 ms fallback 不新增 ASCII 空格、短時間不足時保留單一 cue，以及未啟用選項時 Tiny／Base 相容行為。
- `lib/whisper-srt.mjs` 是所有 Whisper SRT 寫入路徑共用的純函式清理器；只有模型正規化為 `small` 時啟用 `splitLongCues`，Python Whisper 與 Whisper.cpp 兩條路徑一致，Breeze 不受影響。
- Whisper.cpp Small 發生 cue 拆分時，以同長度陣列的 `null` 項標記無法精確對應的拆分來源；未拆分 cue 仍寫入可取得的 `quality-metadata.json`，校閱頁的 partial attach 會保留這些 engine metrics，拆分 cue 則由既有 `rule-score` 重新評估。
- focused `node --check`／`node scripts/test-whisper-srt.mjs`、完整 `npm run check`、`npm run docs:check`、`npm run docs:check:final` 與獨立 round1／round2／round3 審查均已完成；未宣稱真實 Small runtime 或跨平台實機品質。
- 未覆蓋：真實 Whisper Small 權重、1:46 長音訊、實際閱讀速度／中文斷句品質、macOS／Windows 封裝後模型執行與品質 metadata 對應仍待外部驗收。

## REL-040 0.50.0 Whisper Small 修正版 macOS 測試候選（2026-08-20）

- 最終候選來源：`codex/0.50-whisper-small-long-cues@6beee985f50e2045fb9520630e4fde8d67b61bb7`；輸出為 `../dist/test-build-6beee98/`，版本 `0.50.0`、Electron `43.3.0`、electron-builder `26.15.7`、macOS arm64。沒有建立 tag、推送或公開 Release。
- 首輪 `2c9612e` package 的 renderer smoke 只出現 DevTools browser 而無主視窗；1 秒 process sample 將停滯定位到 Security framework `SecItemCopyMatching`。BUG-025 把不存在 `ai-keys.safe` 的檔案檢查移到 safeStorage 前，`scripts/test-electron-main.mjs` 納入 `npm test`；修正後最終候選的隔離 userData renderer smoke 通過首頁、設定、Breeze model modal、上傳／任務完成、cleaned SRT、AI review、術語 round-trip、七個 provider 與資料夾事件，且無背景程序殘留。
- 來源驗證：`npm run check` 通過，包含 BUG-024 Whisper Small SRT／quality／三模型、BUG-025 Electron 啟動順序、Breeze、治理與核心 API；`runtime:manifest:mac`／`runtime:verify:mac` 通過。
- 封裝內容：Info.plist 與 packaged package 均為 `0.50.0`／arm64；runtime manifest 與來源逐位元一致；App 只含 FFmpeg、Whisper.cpp 與 `ggml-tiny.bin`，沒有 `.pt`、`ggml-base.bin`、`ggml-small.bin`、PFX／P12／PEM／key；封裝內已核對 BUG-024、BUG-025 及 `RELEASE-NOTES-0.50.0.md` marker。
- 最終資產：DMG `285c6782159fa884e0d43a2f8bdad10fdf1468ae5abb90aed5532c1e01b656a3`（242,718,360 bytes）；ZIP `cbff5ce253309c61c4f1cbb8aeabff1227e2f3c85163fd3c44f394214172c850`（249,955,644 bytes）；DMG blockmap `c9d5d8b222d620528992923cfa2c5699b7f2dfc1c1b4aeb64d69b520e20ff6a8`；ZIP blockmap `4689d9f139fb6dbae4207712f4aa7d6b2c65412c7bde8aa55ff197da7498fe6c`。`SHA256SUMS-macos-arm64.txt` 已以 basename／LF 建立並重放全部 OK。
- 封裝驗證：DMG `hdiutil verify` 為 VALID；ZIP `unzip -t` 無錯；`codesign --verify --deep --strict` 通過，簽章為 ad-hoc、TeamIdentifier 未設定；`latest-mac.yml` 的 DMG／ZIP SHA-512 與 size 逐項重算一致。`PROVENANCE.txt`、`SIGNING-STATUS-macos-arm64.txt`、測試候選 README 與去除 API token／暫存路徑的 `mac-renderer-smoke.json` 已附於候選目錄。
- 未覆蓋：真實 Whisper Small 權重／1:46 長音訊、真實 Breeze runtime／checkpoint、既有真實加密 AI 金鑰跨版本 decrypt、乾淨帳號 Gatekeeper、DMG 拖曳安裝後完整操作、Windows 版本與公開 Release；本候選不得宣稱上述項目通過。

## REL-043 0.51.0 Anthropic provider macOS arm64 directory 測試候選（2026-08-27）

- 建置指令：`npm run electron:build:mac:dir`；第一次沙盒執行因 `getaddrinfo ENOTFOUND github.com` 無法取得 Electron 資產，取得受控網路權限後同一指令成功；`runtime:manifest:mac`／`runtime:verify:mac` 通過。
- 候選位置：`../dist/mac-arm64/`，版本 `0.51.0`、Apple Silicon `darwin-arm64`、Electron `43.3.0`、electron-builder `26.15.7`；附 `TEST-CANDIDATE-README.md`、`PROVENANCE.txt`、`SHA256SUMS-macos-arm64.txt` 與 `mac-renderer-smoke.json`。
- 封裝內容核對：packaged `package.json` 為 `0.51.0`，`lib/ai/providers.mjs` 含 Anthropic provider，runtime manifest／FFmpeg／Whisper.cpp／Tiny verify 通過；候選為 ad-hoc／未公證，不含 Base／Small／Breeze checkpoint、Python／PyTorch／patched runtime。
- 受控權限 `node scripts/verify-electron-renderer.mjs <app-executable> 9972 60000` 通過：首頁／Electron bridge／安全金鑰 API、設定 modal、Breeze 首次選擇開啟與關閉、manual SRT job `completed`／cleaned SRT、trim／AI review assets、glossary round-trip 與 provider IDs（含 `anthropic`）。沙盒首次 smoke 只因 GUI／DevTools 權限逾時，無產品錯誤輸出；同一候選受控權限重跑成功。
- 未覆蓋：真實 Anthropic API／模型品質／rate-limit／proxy、真實 Whisper Small／Breeze runtime、1:46 長音訊品質與效能、乾淨帳號安裝、Windows／跨平台實機、正式簽章／公證與公開 Release。

## REL-044 0.51.0 Windows x64 cross-build directory 測試候選（2026-08-27）

- 建置指令：`npm run electron:build:dir`；第一次沙盒執行因 `getaddrinfo ENOTFOUND github.com` 無法取得 Electron 資產，取得受控網路權限後同一指令成功；`runtime:manifest`／`runtime:verify` 通過。
- 候選位置：`../dist/win-unpacked/`，版本 `0.51.0`、`win32-x64`、Electron `43.3.0`、electron-builder `26.15.7`；附 `TEST-CANDIDATE-README.md`、`PROVENANCE.txt` 與 `SHA256SUMS-win32-x64.txt`。
- 靜態封裝核對：主程式、FFmpeg、Whisper.cpp 均為 x86-64 PE；packaged `package.json` 為 `0.51.0`，`lib/ai/providers.mjs` 含 Anthropic provider，runtime manifest target 為 `win32-x64`；四項 SHA-256 重放為 OK，未發現 `.pt`、Base／Small／Breeze checkpoint 或憑證檔案。
- 限制：建置主機為 macOS Apple Silicon，未安裝 Wine，無法在本機啟動 Windows executable；因此未宣稱 Windows renderer、安裝／解除安裝、Authenticode、FFmpeg／Whisper 實機、GPU 或乾淨環境通過。候選僅供複製至 Windows 10／11 x64 進行後續隔離測試。
- 未覆蓋：Windows 實機 packaged renderer／任務 smoke、安裝／解除安裝與捷徑、Authenticode、真實 Anthropic API／模型品質／rate-limit、真實 Whisper／Breeze runtime、長音訊效能、跨平台行為與公開 Release。

## REL-045 0.51.0 Windows unsigned Setup／Portable 測試包（2026-08-27）

- 建置指令：`npm run electron:build:unsigned`；第一次沙盒執行因 `getaddrinfo ENOTFOUND github.com` 無法取得 Electron 資產，取得受控網路權限後同一指令成功，產生 NSIS Setup、Portable 與 Setup blockmap／`latest.yml`。
- 候選位置：`../dist/test-build-0.51.0-91eca2b/`，包含 `offline-subtitle-factory-setup-0.51.0.exe`、`offline-subtitle-factory-portable-0.51.0.exe`、blockmap、`latest.yml`、`TEST-CANDIDATE-README.md`、`PROVENANCE.txt`、`SIGNING-STATUS-windows-x64.txt` 與 `SHA256SUMS-windows-x64.txt`。
- 封裝核對：Setup／Portable 版本命名為 `0.51.0`，兩者為 NSIS PE GUI；`latest.yml` 的 Setup SHA-512／size／version 與實體檔案一致；四項 SHA-256（Setup、blockmap、Portable、metadata）重放為 OK。
- 簽章與實機限制：候選明確標示 unsigned／Authenticode 未獨立驗證；建置主機為 macOS Apple Silicon，沒有 Wine，未執行 Windows Setup／Portable、renderer、安裝／解除安裝、SmartScreen 或實際轉錄。候選只供複製到 Windows 10／11 x64 進行後續隔離測試。
- 未覆蓋：Windows 實機安裝／解除安裝／捷徑、Authenticode／SmartScreen、renderer／任務 smoke、離線行為、真實 Anthropic API／模型品質／rate-limit、Breeze／Whisper runtime、長音訊效能、跨平台行為與公開 Release。

## REL-046 0.51.0 macOS arm64 DMG／ZIP 測試包（2026-08-27）

- 建置指令：`npm run electron:build:mac`；第一次沙盒執行因 `getaddrinfo ENOTFOUND github.com` 無法取得 Electron 資產，取得受控網路權限後同一指令成功，產生 DMG／ZIP 與各自 blockmap／`latest-mac.yml`。
- 候選位置：`../dist/test-build-0.51.0-macos-88da220/`，包含 DMG、ZIP、blockmap、`latest-mac.yml`、`TEST-CANDIDATE-README.md`、`PROVENANCE.txt`、`SIGNING-STATUS-macos-arm64.txt`、`SHA256SUMS-macos-arm64.txt` 與 `mac-renderer-smoke.json`。
- 封裝驗證：DMG `hdiutil verify` 為 VALID；唯讀掛載確認包含 `Applications` 與 `離線字幕工廠.app` 且沒有 Base／Small／Breeze checkpoint 或憑證檔；ZIP `unzip -t` 無錯；`codesign --verify --deep --strict` 通過，`codesign -dv` 顯示 `Signature=adhoc`、`TeamIdentifier=not set`。
- Metadata／完整性：DMG `242,726,077` bytes、ZIP `249,959,846` bytes；`latest-mac.yml` 的兩項 SHA-512／size／0.51.0 version 與實體檔案一致，四項 blockmap／DMG／ZIP／metadata SHA-256 重放為 OK。受控權限 packaged renderer smoke 通過首頁／設定／Breeze modal／manual SRT 完成／cleaned SRT／trim／AI review／glossary round-trip 與 provider IDs（含 `anthropic`）。
- 未覆蓋：Developer ID／公證、DMG 拖曳安裝後 Gatekeeper／乾淨 userData、真實 Anthropic／Breeze／Whisper runtime、1:46 長音訊品質與效能、Windows／跨平台實機與公開 Release。

## DEV-047 0.51.0 Windows preview workflow 版本對齊（2026-08-27）

- `.github/workflows/windows-preview.yml` 已將 workflow name、push branch、tag、Setup／Portable artifact filter、packaged Release notes 與 artifact name 從 0.50.0 對齊至 0.51.0，保留 Node 22、`npm run check`、runtime verify、signed／unsigned 分流、Windows install／renderer／archive／model exclusion gate。
- 靜態驗證：workflow 不再含 `0.50`／`codex/0.50`／`v0.50` marker；`ruby -e 'require "yaml"; YAML.load_file(...)'` 基本解析成功；`git diff --check` 通過。未觸發 GitHub workflow，沒有把 YAML 可解析誤稱為 Windows runner 通過。
- 未覆蓋：GitHub Windows runner、Secrets／Authenticode、Setup／Portable 實機安裝／解除安裝／renderer、artifact 下載／digest、真實模型／runtime／長音訊效能與公開 0.51.0 Release；需另行取得外部 runner 證據。

## FR-023 Whisper 高階模型首次下載驗證（2026-08-06）

- `scripts/test-whisper-model-download.mjs`：驗證 pinned revision／Base／Small metadata、禁止任意模型名稱、manifest merge、下載成功、進度 100%、SHA-256 不符、大小超限、HTTP 503、AbortController 逾時、Windows 既有損壞檔替換與失敗暫存檔清理。
- `scripts/test-whisper-models.mjs`：驗證首頁三模型選項、下載按鈕、首次使用說明與下載 modal 存在；`lib/whisper-models.mjs` 驗證 user cache 優先、封裝模型 fallback 與既有 strict size／SHA 檢查。
- `scripts/test-core.mjs`：驗證 `/api/whisper-models` 回報 Base 固定大小、Small pinned revision URL 與可寫入 whisper-models cache；完整回歸需在受控權限下執行以允許 local fixture listener。
- 下載設計：Electron 將模型快取設於 `userData/whisper-models`，server 以暫存檔下載並原子置換（Windows 既有檔先移至備份並可回復），具 15 分鐘 AbortController 逾時；UI 在首次選擇／提交前確認，並顯示 userData cache 路徑與官方 URL／手動放置說明。
- 未覆蓋：本機尚未實際下載 148 MB Base／488 MB Small；Windows 實機權限、休眠／中斷續傳、乾淨安裝與中文口說品質仍待外部驗收，不得將 deterministic fixture 或檔案 hash 視為模型品質通過。

## FR-024 Breeze ASR 25 實驗性整合驗證（2026-08-10）

- `scripts/test-breeze-asr.mjs`：驗證官方 revision、checkpoint 檔名、3,087,008,569 bytes、SHA-256 與固定 URL；涵蓋缺檔、錯誤大小、mock 正例、runtime `available_models` 探針、CLI 參數、模型檢查不得使用同步檔案 I/O，以及永久等待的 probe 必須在 timeout 後失敗。
- `scripts/test-whisper-models.mjs`／`scripts/test-core.mjs`：驗證首頁 Breeze 選項、下載端點與提交前檢查存在，並由核心 API 驗證固定 metadata、模型狀態與 job 的 `breeze-asr-25` 引擎保存。round1 後新增測試專用 mock runtime，真正經 server job／FFmpeg 音訊前處理產生並清理 SRT；取消案例等 child 收到 SIGTERM、延遲 close 後才從 `running/cancelling` 轉為 `cancelled`，並確認暫存音訊與部分 SRT 不殘留。
- round1／round2 修正：3 GB checkpoint 改以非同步 stream 驗證 SHA，避免單次同步完整讀檔阻塞 event loop；Breeze capability probe 設 15 秒 timeout；轉錄取消等待 child `close`，POSIX 在 3 秒 grace 後升級 SIGKILL，Windows 立即執行並等待 `taskkill /T /F` 完成 process-tree 終止，確認 child 與 Windows tree-kill 都結束後才釋放 job slot。另以忽略 SIGTERM 的 mock child 驗證 grace timeout、SIGKILL、取消狀態與暫存清理。
- 本機瀏覽器驗證：新增專案可選 Breeze ASR 25；選取後 Whisper 專用模型欄位停用，未安裝狀態顯示約 2.88 GB 與提交時確認下載提示。切換不會改變 Whisper.cpp 預設值。
- 完整回歸：`npm run check` 在允許本機 fixture listener 的受控環境通過；`node scripts/test-review-ui.mjs` 與 `git diff --check` 通過。首次沙箱內執行僅因 `listen EPERM` 中止，沙箱外同一指令已完整成功。
- 未覆蓋：本輪未下載真實 checkpoint，也未安裝或執行官方 Python／PyTorch／patched Whisper runtime；未驗證真實繁體中文／中英混用音訊、字幕對齊品質、GPU／CPU 效能、長音訊、取消清理、Windows／macOS 安裝後流程，故不得宣稱 Breeze ASR 已可隨安裝包直接使用或達到正式品質門檻。

## FR-024 Breeze runtime／模型外部驗收探針（2026-08-12）

- `node scripts/test-breeze-asr.mjs`：新增 runtime probe 正常／timeout、Python 路徑解析、模型缺件與 report 聚合斷言，並保留既有固定 revision／大小／SHA／CLI 契約測試。
- `npm run probe:breeze -- --json`：本機只讀執行回報 `python3` 可啟動但 `whisper` module 缺失、Breeze checkpoint 缺失、`ready=false` 與非零狀態；沒有執行 pip、網路下載或字幕任務。
- 探針固定使用 `whisper.available_models()` 能力檢查與同一 Breeze 模型 inspector；timeout 會終止探針 child，不把外部 runtime 失敗寫入設定或任務狀態。
- 未覆蓋：真實 checkpoint、官方 patched Whisper／PyTorch、真實音訊、品質、效能、跨平台安裝與 process-tree 仍須另行外部驗收。

## FR-024 Breeze runtime／模型外部驗收探針修正（2026-08-12）

- round1／round2 獨立審查指出：專用 probe timeout 原先未等待 child close／descendant 清理，且 JSON 原樣輸出絕對路徑與 raw stderr；本輪已改為 POSIX detached process group、Windows `taskkill /T /F`、等待 close，並將 Python／模型路徑改為 basename、診斷輸出改為安全摘要；其後將相同 cleanup 契約補入正式 server 共用的 `lib/process-probe.mjs`。
- `scripts/test-breeze-asr.mjs` 新增 timeout close 等待與敏感標記遮罩斷言；本機 focused test、缺件 probe 與完整 `npm run check` 均通過。
- 未覆蓋：真實 Windows process tree、官方 runtime／checkpoint、音訊品質與跨平台實機仍待外部驗收。

## FR-024 Breeze runtime probe 診斷訊息品質修正（2026-08-13）

- `lib/breeze-runtime-probe.mjs` 的敏感鍵值遮罩改用實際捕獲的鍵名與分隔符，`ImportError: token=... password:... api-key=...` 會輸出可讀的 `ImportError: token=<redacted> password:<redacted> api-key=<redacted>`，不再出現字面 `$1=<redacted>`。
- `scripts/test-breeze-asr.mjs` 新增 ImportError、token、password、api-key 的 deterministic 回歸，確認原始敏感值不會進入 probe 結果；既有任意診斷仍維持 privacy omission。
- round1 獨立複審發現 quoted 且含空白的 credential 值仍可能洩漏尾段 `LEAK_MARKER`；本輪已改為整段處理單／雙引號與 escaped 字元，並新增 quoted whitespace 負向回歸，要求 round2 複審。
- focused `node --check ...` 與 `node scripts/test-breeze-asr.mjs` 通過；完整 `npm run check`、`docs:check:final` 與 round2 獨立複審結果待本輪結案後補記。
- 未覆蓋：真實 Windows process tree、官方 runtime／checkpoint、音訊品質、效能與跨平台安裝後流程仍沿用前輪外部驗收缺口。

## REL-039 Breeze 0.50 效能透明化與首次選擇提醒（2026-08-20）

- `lib/breeze-asr.mjs` 建立唯一定義的 `BREEZE_ASR_PERFORMANCE_REFERENCE`；`server.mjs` 由 `/api/breeze-asr` 回傳，包含單一 MacBook Air M3／8 GB 觀察、1:46 影片約 6 小時（約 `3.4×`）、日期與未保存 profiler／原始音訊範圍。
- `public/index.html`／`public/app.js` 在選取 Breeze 時顯示獨立 `breezePerformanceNotice`，不改變 `Breeze ASR 25` 選項文字、不自動切換效能 preset，也提供切回 Whisper.cpp 的建議；未選取 Breeze 時提示隱藏。
- `scripts/test-breeze-asr.mjs` 驗證固定參考 payload、硬體與範圍文字；`scripts/test-whisper-models.mjs` 驗證獨立提示欄位、0.50.0 版本識別與選項不含 experimental 字樣。
- focused `node --check`、Breeze／Whisper tests、VM fallback／null element 行為、受控權限完整 `npm run check`、`npm run docs:check`、`docs:check:final` 與 `git diff --check` 已通過；round1 的作用域阻擋已由 round2 獨立複審確認解除。
- 未覆蓋：本輪沒有改變或實測 MediaTek patched runtime、3.09 GiB checkpoint、真實長音訊品質／速度／記憶體、Windows／macOS 乾淨安裝或 smoke cleanup；效能參考不可替代外部驗收。

## REL-038 Breeze 0.49.1 正式發布後核對（2026-08-18）

- PR #14 已轉 ready 並合併；merge commit `917ae82886a0dff195009c66ce9438b78675fcc0`，annotated tag `v0.49.1` 指向同一 commit，既有 `v0.49.0` 未移動。
- tag workflow run `32095872065` 成功；artifact `9309963799` 大小 `490,424,761` bytes，GitHub digest `sha256:6551957e320b6f299328bc2b13898134814534585854b1c9d9164096419be04a`；本機分段下載重組後 digest／ZIP／PE／checksum／`latest.yml` 一致，Windows Setup／Portable／blockmap 與 unsigned 狀態可追溯。
- macOS arm64 0.49.1 DMG SHA-256 `8e0afe0065f4ed3e608248dc5b26558a2e5dfb1effe9c3ef93572ceaf2eff0df`（242,718,460 bytes，`hdiutil verify` VALID），ZIP SHA-256 `99837a1de3742e40d752a27a9a58e01db29bd5704de7905a07609ecfc7ebdf64`（256,980,540 bytes，`unzip -t` 通過）；`latest-mac.yml` SHA-512／size 一致。
- GitHub Release `v0.49.1` 已 `isDraft=false`／`isPrerelease=false`，公開 13 項 asset；API 核對所有名稱／大小／digest／`/releases/download/v0.49.1/` URL。metadata、checksum、簽章狀態、blockmap、Release notes 與直接下載 hash 全數一致；四個主資產的 HTTP Content-Length 與 API size 一致。
- Breeze 首次選擇流程與雙平台 renderer smoke 證據已交付；MacBook Air M3／8 GB 的 1:46 影片約 6 小時（約 `3.4×`）列為效能警示，不作跨機型或品質保證。
- round4 獨立發布複審報告：`reviews/2026-08-18-breeze-first-selection-performance-round4.md`；其判定為有條件通過，明列 smoke cleanup 未自然退出及真實 Breeze runtime／checkpoint／品質／效能／乾淨安裝缺口；本次 Release 已在該風險如實揭露下完成。
- 未覆蓋：MediaTek patched Whisper runtime 實際載入、3.09 GiB checkpoint／長音訊／取消恢復／CPU 記憶體效能、Windows／macOS 乾淨實機與 macOS smoke cleanup 自然 exit 仍待後續外部驗收。

## REL-037 Breeze 首次選擇流程與 Mac Air 效能發布依據（2026-08-18）

- UI 將選擇器文字改為一般產品名稱 `Breeze ASR 25`；選取事件立即呼叫既有 `ensureBreezeAsrReady()`，模型缺失時開啟固定官方下載，完成驗證後 runtime 缺失則接續開啟安裝／啟動指引。
- `scripts/test-breeze-asr.mjs` 新增選擇器無「實驗性」字樣、首次選擇設定提示及 readiness flow source assertions；仍保留取消下載不得建立任務、runtime 缺件可切回 Whisper.cpp 的既有契約。
- 發布依據：需求方回報 MacBook Air `Mac15,12`／Apple M3／8 GB／8 cores／macOS `26.5.2`（Build `25F84`）處理 1:46:00 影片約 6 小時（約 `3.4×`）；未保存 profiler／原始音訊／完整 telemetry，不作跨機型或品質驗收。
- 未覆蓋：真實 Breeze checkpoint／patched runtime、長音訊品質、CPU／CUDA 效能、跨平台乾淨安裝與安裝後首次選擇的真實使用者流程仍需外部驗收。

## REL-030 Breeze 0.49.0 第一版發布候選（2026-08-13）

- 來源基線：由 `origin/main=05b275f` 建立 `codex/breeze-first-release`，只移植 Breeze runtime probe／process cleanup／diagnostic redaction 變更並升版至 0.49.0，避免直接發布落後主線 25 個提交的舊開發分支。
- 來源驗證：focused Breeze 語法與測試通過；`npm run check` 完整通過；`npm audit --json` 為 0 項已知弱點、總依賴 286；缺件 `npm run probe:breeze -- --json` 預期以 exit 1 回報 checkpoint missing、`ModuleNotFoundError` 與 `ready:false`，未下載或安裝外部元件。
- macOS arm64：runtime manifest／SHA 驗證、目錄版封裝與 packaged renderer smoke 通過；smoke 覆蓋 Electron bridge、設定、manual SRT 任務完成、trim／review AI 資產、七 provider 與 folder event。首次 smoke 因 sandbox 無法讀取 escalated loopback DevTools 而逾時；相同 build 在同一受控權限範圍重跑通過，確認不是 renderer 缺失。
- macOS 最終候選：從乾淨 commit `0205548` 重建；DMG `hdiutil verify` checksum VALID、ZIP `unzip -t` 無錯、ad-hoc code structure 驗證通過；App bundle 版本 0.49.0、最低 macOS 12，包含 Breeze guide／0.49.0 Release notes／probe library，且沒有大於 1 GiB 檔案或 Breeze checkpoint。最終 renderer smoke 前兩次因 macOS Network Service 重啟造成 target 延後出現而逾時；精確程序診斷確認 server／renderer 隨後正常啟動，關閉診斷程序後以 240 秒期限重跑相同封裝完整通過，未隱藏失敗證據。
- Windows x64：macOS cross-build 已產出 x86-64 unpacked App、NSIS Setup／Portable 與 `latest.yml`；Setup archive 可列出 Breeze guide／probe library／0.49.0 Release notes，未包含 checkpoint；Setup／Portable 皆未 Authenticode。Windows CI workflow 已切換至本分支／`v0.49.0` 與 0.49.0 資產名稱，並新增 Breeze guide／checkpoint 排除關卡。
- 資產完整性：DMG `18fba33da3740ee28fdbb5aba575fe7305c069eb417702fc67db3ee8f54dda30`（242,706,559 bytes）、ZIP `9a4337c352e8c97ebba3de0ad02c86e192474061a2abd71faedca7dd789ce188`（249,942,036 bytes）、Setup `1a63e80bcda6fd433cb0ebba84cff7cb49d37604183ab32dd1341712fda8d8ed`（244,655,017 bytes）、Portable `9353ad38521cd6383e725063f1adbfe05373f2c21f3c95837c71c6553eb97a15`（243,947,755 bytes）。`SHA256SUMS-macos-arm64.txt` 與 `SHA256SUMS-windows-x64.txt` 重放全數 `OK`；`latest.yml`／`latest-mac.yml` 的 size 與 SHA-512 亦和實際檔案一致。
- 原候選待辦已完成：Windows Actions packaged renderer／安裝生命週期、完整獨立發布審查、GitHub PR／tag／Release 與發布後下載反向核對均已收斂，round3 判定通過。
- 獨立發布審查：round1 對四資產 SHA、DMG／ZIP、metadata、版本、封裝內容與風險揭露做快速獨立重驗後，判定「有條件通過（僅限本機候選與建立 PR）；公開 Release 不通過」。Windows Actions／CI artifact、GitHub 閉環與未獲涵蓋授權的真實 Breeze／跨平台實機缺口是公開發布阻擋項，解除後須 round2 複審。
- Windows CI：PR #11 的 push run `31659328605`（來源 `aa1ec41e0856746726774d5f16a48f96b6c103b3`）成功；Setup 安裝後 renderer、silent uninstall、Portable renderer、兩個 NSIS archive、Breeze guide、checkpoint 排除與 unsigned 狀態均通過。artifact `9165654131` 大小 490,411,929 bytes、GitHub SHA-256 `0dccf99939edd1e3dec024f16327e6bcfd3b0674885c1007ff24d5d1f0b15027`；以八段精確 range 下載重組後 digest 完全一致，ZIP `unzip -t` 通過。CI SHA：Portable `4f16f949d8cd3a207ac922574a3b4768d513f8478740d6ae9704c62447f0bff4`（244,674,637 bytes）、Setup `b39d4451d4edc5f80245a540d341f9c7158fd58f75009862c8bfc995936be925`（245,381,891 bytes）；`latest.yml` 版本 0.49.0、Setup size／SHA-512 與實檔一致。
- 最終 tag／Release：PR #11 merge commit 與 `v0.49.0` target 都是 `1f50b85c0599ef85c73f05085d70925d4d6b670a`。tag run `31661442776` 成功，artifact `9166375562` 大小 490,411,920 bytes、digest `5a45c9d04917bbdd3c7d05867e68c42e1d7f5597fe2dc369364b5039e5371418`；分段完整下載重組、ZIP 與 EXE SHA 通過。正式 Windows SHA：Portable `cbec3c244f80d9e922f7139caacbefd00cabf41a2a0cffc5385392950960f981`（244,674,635 bytes）、Setup `0a5cf5cdf3b94ce4a7621fffcbd2174a92e4288a4c0e380d31c98338b34d65a0`（245,381,896 bytes）。
- 發布後核對：GitHub v0.49.0 為 `isDraft=false`／`isPrerelease=false`／Latest，9 項 asset URL 均為 `/releases/download/v0.49.0/`。四個主資產與兩平台 checksum／updater metadata／unsigned 說明已從正式 URL 全量重新下載；兩份 SHA 清單全數 OK、DMG checksum VALID、macOS ZIP 無錯、Windows Setup archive 可讀，Setup／macOS ZIP／DMG 的 updater SHA-512 與 size 均一致。
- 未覆蓋：真實 Breeze checkpoint／官方 runtime／音訊品質、CPU／CUDA 效能、長音訊、Windows process tree、兩平台乾淨安裝後 Breeze 流程與 checkpoint 下載中斷／磁碟不足；不得以候選封裝或 mock 證據取代。

## REL-032 v0.49.0 雙平台測試軟體重建（2026-08-13）

- 來源：`main`／`origin/main` commit `c41d6ad60441687da19ce67bd847256b843b5e69`；產品版本仍為 0.49.0。此來源只比公開 tag target 多 DOC-031 發布後文件同步，測試候選置於 repo 外 `../dist/test-build-c41d6ad/`，未建立 tag／Release 或覆寫既有正式資產。
- 開發與供應鏈：Apple Silicon macOS 26、Node 22.22.3、npm 10.9.8；`npm run check` 完整通過，`npm audit --json` 為 0 項已知弱點／286 dependencies；macOS runtime manifest／verify 通過。
- macOS arm64：隔離重建 DMG／ZIP、App 0.49.0／最低 macOS 12；`hdiutil verify` checksum VALID、`unzip -t` 無錯、deep strict codesign 通過且明列 `Signature=adhoc`／無 Team ID。packaged renderer 前兩次分別因 sandbox DevTools 可見性與 target 延後出現逾時；診斷啟動確認 server／bootstrap 正常後，以 `ELECTRON_ENABLE_LOGGING=1`、60 秒期限重跑同一 App 完整通過 bridge、設定、manual SRT job、trim／review、術語 round-trip、七 provider 與 folder event。DMG SHA-256 `7ddb472d361734d020d176a2d3ad51cbc0adb61d856ee1da60bcb74acc20002d`（242,706,304 bytes）、ZIP `4d45ae1f48a44332276e37174e40188ea33d27ff4358a30cf43f7c8d90c1ae0c`（249,941,976 bytes）；`latest-mac.yml` 兩檔 size／SHA-512 與實檔一致。
- 封裝內容：macOS App 含 `docs/BREEZE-ASR-25.md`、`RELEASE-NOTES-0.49.0.md` 與 Tiny；Small 與 Breeze checkpoint 不存在，且 App 無大於 1 GiB 檔案。這只證明 checkpoint 排除與預設 Tiny 可封裝，不證明外部 Breeze runtime／模型可用。
- Windows x64：GitHub Actions workflow_dispatch run `31663681837` 由 `main@c41d6ad` 在 `windows-2022` 完成固定 runtime、完整 source／真實 FFmpeg 回歸、unsigned Setup／Portable、Setup 安裝後 renderer、silent uninstall、Portable renderer、兩個 NSIS archive／Breeze guide／checkpoint 排除、SHA 與 artifact upload；signed step 因無憑證按設計 skipped。Actions v4 顯示內部 Node 20 相容層被 runner 強制使用 Node 24 的 deprecation annotation，但 job conclusion 為 success。
- Windows artifact：artifact ID `9167179425`、大小 490,411,789 bytes、GitHub SHA-256 `c8d1064a52ade1fd7147fbfad665f342ec9b1aded2323480692113b84c7c8182`；八段精確 range 重組後 digest 相同，ZIP `unzip -t` 無錯。Portable SHA-256 `07a3b07bbbc1ab514f8b17f876baae84a923ae43384e9e8ee9e518d31daa3bd9`（244,674,586 bytes）、Setup `8461defe905aefddd45aa7ebac56c67d76e13c5226a29f621d3fca74aca78edf`（245,381,834 bytes）；`latest.yml` Setup size／SHA-512 一致，簽章狀態為 `UNSIGNED INTERNAL PREVIEW`。
- checksum 邊界：CI 原始 `SHA256SUMS-windows-x64.txt` 為 CRLF，Windows runner 已成功使用且去除 CR 的 macOS 串流重放亦全數 `OK`；本機 extracted 交付另附等值 LF 版 `SHA256SUMS-windows-x64-LF.txt`，原始 CI 清單保留不改寫。
- 未覆蓋：macOS DMG 拖曳安裝後／乾淨帳號 Gatekeeper、Windows 10／11 使用者實機 SmartScreen 與互動安裝、正式簽章／公證、真實 Breeze checkpoint／官方 runtime／品質／效能／長音訊／取消與 process tree；測試包不得宣稱為新的正式版本或替換已發布 v0.49.0。

## SYNC-024 GitHub Windows 修正同步驗證（2026-08-06）

- 遠端核對：`git fetch --prune origin` 後 `origin/main=baed6d7`；Windows Ollama 修正 `4d0bee6` 與本地 HEAD `170e08e` 的指定檔案 diff 為空，故未重複套用。
- 選擇性整合：同步 Azure OpenAI 的 `max_completion_tokens` capability probe、Azure deployment body 清理與 OpenAI-compatible internal chat fields 清理；保留本地 Ollama streaming／timeout／repair 變更。
- focused：`node --check`（model capabilities／OpenAI-compatible／providers）、`node scripts/test-ai-providers.mjs`、`node scripts/test-ai-optimizer.mjs`、`node scripts/test-ollama-batch-stream.mjs` 通過。
- 審查後補強：`scripts/test-ai-providers.mjs` 新增 OpenAI-compatible sanitized body 專項斷言，確認保留 `model` 並移除 operation／language／cue metadata；focused provider test 與完整回歸重跑通過。
- 完整：受控 `npm run check` 通過；兩平台測試包關鍵 AI runtime marker 與工作樹一致，macOS／Windows ZIP `unzip -t` 均通過。
- 未覆蓋：Windows 實機 Ollama／Azure endpoint、真實模型回應、安裝後啟動與跨版本行為；GitHub commit 核對與 contract mock 不取代實機驗收。

## 0.48 本機 LLM 驗證計畫

- `test-ai-providers.mjs`：驗證 Ollama／LM Studio registry、loopback IPv4／IPv6、localhost 子網域拒絕、無 Key 不送 Authorization、遠端本機-provider 名稱仍不得繞過 Key，以及模型能力回應解析。
- `test-review-ui.mjs`：驗證本機 provider 選項、服務掃描、模型清單、能力檢查、隱私狀態與 loopback 無 Key 連線表單。
- `test-core.mjs`：以本機 fake OpenAI-compatible server 分別驗證 Ollama 的無 Key／無雲端同意設定、模型列表、連線、有效與無效模型能力回應、redirect 第二站零請求，以及 LM Studio 的完整 AI 批次、429 重試、無 checkpoint／有 checkpoint 取消時關閉 HTTP 請求、取消後只續跑未完成批次與 cue 契約。
- macOS 預封裝：`runtime:manifest:mac`、`runtime:verify:mac` 與 `electron:build:mac:dir` 已通過；`verify-electron-renderer.mjs` 已在產出的 arm64 App 驗證 Electron bridge、設定 modal、上傳／啟動／完成、review AI 資產、術語 round-trip，以及七個 provider（含 Ollama／LM Studio）。此證據僅涵蓋目前主機的未簽章目錄版，不等同 DMG 安裝後驗收。
- Windows 預封裝：`runtime:manifest`、`runtime:verify` 與 `electron:build:dir` 已成功產出 `dist/win-unpacked` 及 Windows x64 executable；本機為 macOS，未直接啟動 Windows renderer，故不等同 Windows 實機安裝後驗收。
- Windows 發布資產：`electron:build:unsigned` 已建立 x64 Setup 與 Portable；兩者均由 `file` 識別為 PE32 NSIS executable。Setup SHA-256 為 `d05a3f8d4df31048d398839666f34954c523f6928bc2500a1d98a785f7a20955`，Portable SHA-256 為 `3a1ad56e0b6e914151e7f3447966d104c426544245e68e455d5df49eaeddf1f6`；未簽章且未在 Windows 實機安裝／啟動。
- macOS 發布資產：arm64 DMG 可由 `hdiutil imageinfo` 讀取；ZIP 改用 macOS `ditto` 直接由已驗證 App 封裝，`unzip -t` 通過。DMG SHA-256 為 `906559f20242f01f2b51618280b4af65875cd83bd05aef16bc22f3eb10d3562f`，ZIP SHA-256 為 `04de598018929d687887329582488d3fa809abffed2b919a3bd7851325f46bc7`。DMG 唯讀掛載成功；直接從唯讀卷啟動未取得 DevTools target，但複製到專用暫存安裝位置後，`verify-electron-renderer.mjs` 已通過 bridge、設定、上傳／完成、review AI 資產、術語 round-trip 與七個 provider，且暫存目錄已清理。這是本機複製安裝 smoke test，不等同乾淨使用者帳號或正式簽章／公證驗收。
- 實機門檻：Ollama 與 LM Studio 各至少一個模型完成模型探索、能力檢查、字幕建議、人工接受、取消／恢復；移除外網後重跑本機流程。
- Ollama 真實模型證據（2026-07-28）：本機 Ollama 0.32.5 以 `llama3.2:1b` 完成 `/v1/models`、能力檢查與專案 API 的 1 cue `proofread` 優化；任務 `completed`、provider／model 正確、0 retries。首次能力檢查的 `traditionalChinese` 為 false，實際建議將中文句號改成英文句點；round5 重放同類能力 prompt 得到 true，單 cue 直接回應另出現額外缺少 id 的物件，顯示能力／品質結果不穩定。已確認模型可用但品質不能直接接受，需保存完整 prompt／參數／原始 response，並由人工審核／後續提示詞或模型調整。
- 可重放證據：`npm run probe:ollama:live`（底層為 `scripts/probe-ollama-live.mjs`）會保存版本、模型清單、完整 capability／single-cue 請求與原始回應；本輪 artifact 為 `docs/project-management/evidence/2026-07-28-ollama-llama3.2-1b-live.json`。該次 capability 回應使用 `Traditional Chinese` 鍵而非產品要求的 `traditionalChinese`，single-cue 回應使用 `cue`、改動時間碼並附 Markdown／自然語言，正好證明 strict contract 與人工審核仍必要。Probe 另以 `isLoopbackAiUrl`、`aiEndpointPrivacy` 與所有 fetch `redirect: manual` 保護資料邊界；本機 probe exit 0，遠端 `OLLAMA_BASE_URL` 負例在 fetch 前 exit 1。
- Probe 安全矩陣：`http://localhost:11434/v1` 實際 probe 成功；`localhost.example.com` 在 fetch 前拒絕；`[::1]` 通過 loopback 分類但因 Ollama 僅監聽 IPv4 而連線失敗，未被誤判為遠端或送出資料。
- 未覆蓋即不得宣稱：目前沒有證據時，不得將真實 Ollama／LM Studio、Windows 封裝、macOS 安裝版或斷網端到端標示為通過。

## BUG-021 Breeze runtime 安裝指引驗證

- `scripts/test-breeze-asr.mjs` 驗證 guide 具備官方 repo／模型連結、兩平台 `--recurse-submodules`、submodule 安裝路徑、開發版與已安裝 App 啟動命令，以及不在 Breeze repo 內執行 `npm start` 的負向條件。
- `scripts/test-core.mjs` 驗證 `/api/breeze-asr` 與 `model` 內的固定 guide details 一致；`node --check public/app.js` 與 UI source marker 驗證 runtime modal、模型下載 modal 入口及 persistent ASR 欄位入口。
- UI smoke 只驗證隔離本機 server 的 Breeze 缺件狀態、選單與 modal 資產存在；未安裝真實 patched runtime／3 GB checkpoint，不把 mock 或 source marker 當作真實轉錄品質／跨平台驗收。
- 安裝指引命令不由 App 自動執行；供應鏈、git／pip／Python 版本、Windows PowerShell、macOS shell、安裝位置與實機啟動仍需外部驗收。

## BUG-022 Breeze runtime 路徑與首頁健康卡回歸驗證

- `scripts/test-breeze-asr.mjs` 新增 macOS／Linux 標準 `$HOME/Breeze-ASR-25/.venv/bin/python`、Windows `%USERPROFILE%\\Breeze-ASR-25\\.venv\\Scripts\\python.exe` 偵測 fixture；同時驗證 Windows `USERPROFILE` 優先於 `HOME`，以及外部 patched venv 優先一般 bundled Python，避免假缺件。
- `scripts/test-breeze-asr.mjs` 以 source assertion 確認首頁 `refreshHomeHealth` 在 `/api/health` 成功後呼叫 `updateMetrics(tools)`，讓 FFmpeg／ASR／Whisper／GPU 卡片更新。
- focused：`node --check lib/breeze-runtime-probe.mjs`、`server.mjs`、`electron/main.mjs`、`public/app.js` 與 `node scripts/test-breeze-asr.mjs` 通過；完整 `npm run check` 通過（含 docs validator、核心 API 與所有 deterministic 回歸）。
- 未覆蓋即不得宣稱：測試 fixture 不代表本機已安裝 MediaTek patched Whisper；真實 Python／PyTorch／submodule／3 GB checkpoint、Breeze 音訊品質／效能、Windows process tree、雙平台乾淨安裝與自訂路徑仍待外部驗收。

## 0.48.x 穩定化驗證（2026-07-30）

- BUG-012／FR-014：`test-core.mjs` 驗證舊 Gemini URL／模型混入 `openai-compatible` 時，API 回應與持久化 `config/settings.json` 均清空不相容的 Base URL／model，同時保留正確 provider；API Key 不進一般設定檔。
- 本輪新增的持久化斷言只證明同一 server 寫入後的設定檔內容；既有使用者設定檔跨平台啟動／重啟仍待實機驗收，不能以此取代 Windows／macOS 測試。
- `FR-021` 的真實 LM Studio artifact、模型人工接受、取消／checkpoint 續跑與真正斷網閉環仍屬未完成驗收；本輪未使用真實外部供應商金鑰。

## 0.48.x macOS 封裝與本機 LLM 驗證（2026-07-30）

- `npm run runtime:verify:mac` 通過；`verify-electron-renderer.mjs` 對 macOS arm64 目錄版 executable 結束成功。DMG／ZIP SHA-256 與既有清單一致：DMG `334e50b59a70c97314629faad88de1dd22f6680018265c54da5f1703becfbeee`、ZIP `53ca4e3886155e221048d36f103b0933a8d49647f5e509098fcac29f2c652f80`。
- 受控本機連線下 `npm run probe:ollama:live -- docs/project-management/evidence/2026-07-30-ollama-llama3.2-1b-live.json` 通過，完整 raw request／response 保存於版本化 evidence；取得 Ollama 0.32.5、2 個模型與 `llama3.2:1b` capability／single-cue 回應。capability 回應符合 strict JSON；single-cue 回應未滿足 strict JSON／cue contract（含 Markdown／自然語言或時間格式改寫），因此只證明 loopback 可連線，不是模型品質或 FR-021 完整驗收。probe 現在拒絕覆寫已存在的 evidence。
- LM Studio `http://127.0.0.1:1234/v1/models` 於本輪 connection refused；依需求方決定暫緩，不宣稱 LM Studio 真實流程、人工接受、取消／續跑或斷網完成。Windows renderer／安裝驗收亦未在本輪執行。
- 受 sandbox 本機 socket bind 限制曾有一次 `listen EPERM`；以受控權限重跑的 `npm run check` 通過。

## 0.48.x 供應鏈與 CI 風險盤點（2026-07-30）

- `npm audit --json`：總計 14 項（13 high、1 critical），依賴總數 418；lockfile 實際版本為 `electron@33.4.11`、`electron-builder@25.1.8`，延伸出 `app-builder-lib`／`builder-util`／`node-gyp`／`tar`／`cacache`。runtime production dependency 僅 `busboy`，本次未見其 advisory。
- build-only 風險：`tar`、`node-gyp`、`cacache`、`app-builder-lib` 等主要由建置／重建流程引入；可用修正集中到 `electron-builder@26.15.3`，為 major 升級，需另開相容性工作並重跑兩平台封裝。
- runtime 風險：lockfile 的 `electron@33.4.11` 命中多項 advisory，audit 建議至少升至 43.2.0；這會改變 Electron runtime，不能僅以 build-only 風險接受，須另做 renderer／IPC／打包／實機回歸。
- CI：目前 `.github/workflows/windows-preview.yml` 使用 `actions/setup-node@v4`、`node-version: 22`；本輪未發現仍使用 Node 20 的現行 workflow 設定，`00-CURRENT-STATUS.md` 的 Node 20 deprecation 描述應視為待歷史來源核對，不作為目前 workflow 已證實問題。
- 結論：本輪不修改 lockfile、Electron 或 electron-builder；將 major 升級與安全修正列為後續受控變更。`npm audit` 數字不能直接等同已發布應用的 runtime 可利用性，但 Electron advisory 仍是未解決的 runtime 風險。
- Whisper fallback 補充：`lib/whisper-fallback-policy.mjs` 已以 deterministic 矩陣測試覆蓋 macOS arm64、forceCpu、退出碼與邊界值，並由 `server.mjs` 使用；此證據只涵蓋 fallback 觸發條件，不取代實際 child-process、取消／清理與跨平台實機驗收。

## 0.48.1 Electron／builder 升級與發布候選回歸（2026-08-10）

- 升級前完整 audit 為 16 項（15 high、1 critical）；`electron@33.4.11` 與 `electron-builder@25.1.8` 分別升至 `electron@43.3.0`、`electron-builder@26.15.7`，升級後 `npm audit --json` 為 0 項，依賴總數 286。
- Electron 43 的 npm 安裝套件要求 Node.js 22.12.0 以上；專案 `engines.node` 與部署文件已同步提升，Windows workflow 使用 Node 22 的最新可用版本。
- `npm run check` 完整通過，包含 Whisper 三模型／下載取消與暫存清理、SRT sanitizer、Breeze 契約、AI fetch／optimizer／providers、Ollama streaming、review UI 與核心 API。
- round1 後補強下載取消邊界：單元 fixture 先寫入大於 0 bytes 的 `.download` 再 abort；核心 API 以 POST 啟動、GET 確認部分 bytes、DELETE 取消並等待 `.download`／`.previous` 全部清除。測試 hook 只在 `NODE_ENV=test` 與顯式旗標同時成立時啟用；Windows 真實檔案 handle 行為仍須實機驗收。
- 因上述 server 測試 hook 變更，四項候選再次重建；最終 build 已通過 SHA 清單、ZIP／NSIS archive、updater SHA-512、codesign 與兩平台封裝來源 diff。最後一次 DMG `hdiutil verify`／packaged renderer 重跑受系統權限用量上限阻擋；round1 前一 build 的兩項通過證據不能替代最終資產重驗，列為本機候選剩餘條件。
- 2026-08-11 權限恢復後補驗同一最終 build：`hdiutil verify` 回報 DMG checksum `VALID`；隔離 userData 的 packaged renderer smoke 通過 bridge、設定、上傳／完成、review AI 資產、術語 round-trip、七個 provider 與資料夾事件。round2 的本機重驗條件已解除；Windows／Base／Small／真實端點與安裝後實機仍未覆蓋。
- macOS arm64 目錄版在 Electron 43.3.0 下完成打包；隔離 userData 的 packaged renderer smoke 通過 Electron bridge、設定 modal、上傳／轉錄完成、review AI 資產、術語 round-trip、七個 provider 與資料夾開啟事件。
- Windows x64 目錄版、NSIS Setup 與 Portable 已由 macOS cross-build 產出；封裝內 App 版本為 0.48.1、PE 為 x86-64、只內建 Tiny 且包含本版 Release notes。此證據不等同 Windows 10／11 實機啟動、安裝或解除安裝。
- 兩平台 builder 仍警告 `asar:false`；本版維持既有非 ASAR 結構以避免未經回歸的 server／runtime 路徑變更，列為後續封裝強化，不把它描述為已解決。
- 簽章狀態不變：Windows 未 Authenticode，macOS 為 ad-hoc／未公證；引用 `AUTH-2026-07-23-01` 時仍須揭露，且該授權不涵蓋缺少實機驗收、metadata／checksum 不一致或機密洩漏。

## 0.48.x Whisper Metal crash 診斷（2026-07-30）

- bundled `whisper-cli`／tiny model／1 秒 16 kHz silence WAV 的預設 GPU 路徑 exit `139`；stderr 明確顯示 `ggml_metal_buffer_init: error: failed to allocate buffer`，未產生 JSON。
- 同一輸入加 `--no-gpu` exit `0` 並產生 JSON；此為已驗證 workaround，不等同產品已自動 fallback。
- 本輪未修改 runtime；Metal crash 與「成功轉錄但 quality metadata 缺失」維持不同處置，rule-score 不可用於無 cue 的 crash。
- 0.48.x 修正已在 `server.mjs` 將 Metal 非零退出導向 CPU retry；retry 前清理舊 SRT／JSON，CPU 失敗仍回報 failed。`npm run check` 通過；尚未完成長音訊／乾淨安裝實機驗收。

## 0.48.x Ollama single-cue contract 修正（2026-07-30）

- `scripts/probe-ollama-live.mjs` 現在以 native smoke 重放 Ollama adapter 使用的 `/api/chat`，帶入 `stream:false`、temperature 0、production cue schema（cue ID enum）並在 probe 內驗證 `cues`／ID／數量／文字／reason；不再以 `/v1/chat/completions` 代表 native path。
- 受控 probe（持久輸出 `docs/project-management/evidence/2026-07-30-ollama-native-contract-rerun.json`）確認 `llama3.2:1b` 的 native single-cue 回應為合法 `cues` JSON，cue ID／數量保留；模型仍將全形句號改為半形句號，屬品質／人工審核風險，不是 contract 放寬理由。
- capability probe 仍為相容端點的能力觀察；LM Studio、真正斷網與跨平台實機仍未驗收。

## 0.48.0 正式候選與本機封裝清理稽核（2026-07-30）

- 來源：`codex/0.48-local-llm` commit `dc143d24064b50ca4ddf645037d339a73d60baf4`；本機 remote-tracking ref `origin/codex/0.48-local-llm` 與 HEAD 一致。
- 開發驗證：`npm run check` 通過；`npm run docs:check:final` 通過；macOS runtime、DMG／ZIP 與 Windows runtime、Setup／Portable 已建立。macOS ZIP `unzip -t` 通過。
- 目前 SHA-256：macOS DMG `334e50b59a70c97314629faad88de1dd22f6680018265c54da5f1703becfbeee`、macOS ZIP `53ca4e3886155e221048d36f103b0933a8d49647f5e509098fcac29f2c652f80`、Windows Setup `7be0392fca7610647f1b351db182ceccbd509fdd44f79ca3eb089c09c76ebd54`、Windows Portable `b187823c1c4981211cc2b71f8a31676d6f58866589b2bf8fb61c945e75a13ca5`。兩平台 SHA 清單均已涵蓋主要安裝資產；GitHub 發布後 digest 仍待反向核對。
- GitHub 狀態：來源分支推送已由本機 remote-tracking ref 證實；`v0.48.0` Release 由需求方終端上傳中。因本執行環境無法解析 `github.com`，尚未取得公開 Release metadata、資產 digest、下載 URL 與最新 Release 指向的反向證據。
- 清理前 `dist/` 約 10 GB。逐項移除 `archive/`、`releases/`、`build-cache/`、`windows-0.45.0/`，以及根目錄 0.45.0–0.47.1 歷史封裝／blockmap／舊 checksum；刪除命令的目標容量合計輸出約 8.44 GiB，清理後約 1.9 GB。清理前逐檔輸出未保存為獨立檔案，故目前只能以 `docs/project-management/evidence/2026-07-30-dist-cleanup-summary.md` 作操作摘要，不得宣稱該數值仍可獨立重算。
- 清理後檢查：`dist/` 根目錄只保留 0.48.0 DMG／ZIP／Setup／Portable、其 blockmap、`latest.yml`／`latest-mac.yml`、兩平台 SHA、Windows 未簽章說明與 builder metadata；另保留目前的 `mac-arm64/`、`win-unpacked/` 驗證目錄。
- 回復：歷史封裝已永久移除而未送入垃圾桶；可由對應 GitHub Release 重新下載，或從既有 tag 重新建置。來源碼、tag、GitHub Release、使用者任務資料與 bundled runtime 未刪除。

## 0.48.0 GitHub 發布後核對（2026-07-30）

- 發布狀態：`v0.48.0` 已於 `2026-07-30T03:58:52Z` 正式公開，`isDraft=false`、`isPrerelease=false`，`gh release list` 顯示 `Latest`。
- 來源：tag `v0.48.0` 與遠端 `codex/0.48-local-llm` 在發布時均解析至 `4cdb0177d84693a334fac79b96c596e1b416456f`；Release URL 為 `https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.48.0`。
- 資產完整性：GitHub Release 共 9 項 uploaded 資產；macOS DMG `224057671` bytes／`334e50b...beee`、ZIP `229406028` bytes／`53ca4e...2f80`、Windows Setup `216165301` bytes／`7be039...bd54`、Portable `215460201` bytes／`b18782...3ca5`，均與本機 SHA-256 一致。
- metadata：`latest.yml` 380 bytes、`latest-mac.yml` 570 bytes；`SHA256SUMS-windows-x64.txt` 219 bytes，已同時列出 Setup 與 Portable；macOS SHA 與 Windows 未簽章狀態檔均存在。
- 下載 URL：9 項資產皆已由草稿 `untagged-*` URL 切換為 `/releases/download/v0.48.0/<asset>` 正式 URL。
- 既有風險：Windows 未 Authenticode、macOS 未 Developer ID 簽章／公證；小模型翻譯品質與跨平台乾淨實機缺口仍依 Release notes 揭露，不因 GitHub 發布完成而視為消失。
