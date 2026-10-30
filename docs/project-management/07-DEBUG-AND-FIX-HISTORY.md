# 偵錯與修改歷程

### BUG-063：Windows workflow 的 signed-canary gate contract 使用 macOS 硬編碼暫存路徑（2026-10-30；source 已修正，CI 複驗中）

- 現象：GitHub Windows workflow `40993031453` 在 `npm run check` 的 `scripts/test-macos-signed-canary-gate.mjs` 失敗；Windows `os.tmpdir()` 解析為 `D:\\tmp`，測試卻要求 `/tmp/osf-signed-canary-test-output`。
- 根因：測試用固定 POSIX `/tmp` 字串驗證 signed-canary build config 的 isolated output，而該 contract 也會在 Windows runner 執行，造成跨平台測試本身 false failure。
- 修正：改以 Node `os.tmpdir()` 與 `path.join()` 建立並驗證平台原生暫存路徑；保留 absolute path／source tree boundary 的既有 assertions。
- 本地驗證：`node scripts/test-macos-signed-canary-gate.mjs` 與完整 `npm run check` 均 exit 0；待推送後由 Windows runner 重跑相同 workflow，確認後續封裝與安裝驗收沒有下一層問題。
- 界線：本修正只處理 Windows CI contract failure，不代表 Windows 0.52.0 Release asset、Authenticode、實機安裝驗收或 Google／Apple 外部驗收已完成。

### FR-021-MACOS-SIGNED-CANARY-PREREQUISITES-REVALIDATION-20261030-NEXT2-REMEDIATION：formal gate／readiness evidence validator hardening（2026-10-30；待複審）

- next2 round1 `TECH-GATE-N2-01` 發現 formal gate validator 只允許 `ready=false` 且 reasons 非空，真正 prerequisites 就緒時 main 會在 writer 前拒絕合法 ready evidence；另 `TECH-READINESS-N2-02` 指出 readiness timestamp 欄位只存在於 evidence，validator 未固定 schema。
- 修正：gate validator 現驗證 exact top-level／nested safe projection、ISO timestamp／順序、`ready === (reasons.length === 0)`，並以 `evaluateFormalSignedCanaryReadiness()` 核對 source config、required toolchain、identity、credential-derived notarization、reasons 與所有 derived gate fields；gate focused test 新增 authoritative blocked evidence、synthetic ready path、五類 gate projection mismatch、nested source mismatch 與負向 mutation。
- readiness validator 新增 `startedAt`／`completedAt` UTC ISO millisecond／順序檢查；focused test 改以日期優先再序號核對最新 10/30 evidence，並新增 null／malformed／reverse-order cases。四支 syntax、focused tests、完整 `npm run check`、治理 validator 與 `git diff --check` 通過；未修改 immutable evidence、workflow、keychain、candidate 或 remote。
- 待最終獨立複審；不宣稱 signed／notarized candidate、Apple ticket、release 或 FR-021 overall，外部 Environment／identity／credential blocker 維持。

### FR-021-MACOS-SIGNED-CANARY-PREREQUISITES-REVALIDATION-20261030-NEXT2：external boundary／readiness／formal gate current-state revalidation（2026-10-30；external blocker unchanged）

- 以 current HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b` 依序重跑三個 read-only audit：next15 external boundary status `fail`；next7 readiness `blocked-external-signing-identity`；execution7 formal gate `ready=false`。三份 evidence 均 exclusive `0600`，SHA-256 分別為 `7ae2b6b4e1e069bceac479669c57cc07393f59cf904049faf76058620bc9868c`、`11996d29916cbac5dda392cf476e53f37ded8e07e23daff8f1aaf72cde97caaa`、`29710462ca9757750a8d897418c7b3a90d01e180469f69a9261f960b90da0ab9`。
- GitHub Environment／reviewer／secret scope／protected branch 仍缺失；本機 0 valid identity、credential absent；formal gate 仍在 builder 前停止。未修改 remote／keychain／candidate，未觸發 workflow，未執行 signing／notarization／UI／Ollama／network，raw output／secret／identity 未落盤。
- focused／完整 deterministic checks 與治理 validator 通過；本輪只是更新 current external prerequisite observation，不能宣稱 signed／notarized candidate、Apple ticket、release 或 FR-021 overall。`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false`、全機 egress、Windows 與 renderer residual 維持。

### FR-021-MACOS-SIGNED-CANARY-PREREQUISITES-REVALIDATION-20261030-NEXT1：external boundary／readiness／formal gate current-state revalidation（2026-10-30；blocker unchanged）

- 以 current HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b` 重跑三個 read-only audit：next14 external boundary status `fail`；next6 readiness `blocked-external-signing-identity`；execution6 formal gate `ready=false`。三份 evidence 均 exclusive `0600`，SHA-256 分別為 `3f9055efef9e7af3a508c485ac55910a5a787eeefa0e5cd4db9f26f429a0789f`、`15f43ad1722344019cf48e3d2e5b8d0edae280d5283c51ef05f99b3585cc5cfa`、`ae372012947ffecb12f29ce607b7854474804dc78e18011b30bac4a0b5edee39`。
- GitHub Environment／reviewer／secret metadata／protected branch 仍缺失；本機 0 valid identity、credential absent；gate 仍在 builder 前停止。未修改 remote／keychain／candidate，未觸發 workflow，未執行 signing／notarization／UI／Ollama／network，raw output／secret／identity 未落盤。
- 這次 revalidation 證明 10/29 的 blocker 仍是目前真實 state，而非沿用舊 evidence；下一步仍需外部配置／identity／credential state change，不能把 revalidation pass 或 source match 宣稱成 signed candidate。

### FR-021-SIGNED-CANARY-GATE-RECHECK-NEXT5：current-source formal build gate fail-closed recheck（2026-10-29；external identity／credential blocker 保留）

- execution4 的 gate evidence 仍綁定較舊 package／focused-test bytes；本輪以 current source 重跑 `audit-macos-signed-canary-gate.mjs`，保存 execution5 mode `0600`、SHA-256 `5a1bb264b698f78d958d7bd53056c57aae5ed6cf2b4349fd0dd1905f203872e5`。
- formal gate 仍 `ready=false`，reasons 為 `developer-id-application-not-ready`／`notarization-credential-set-not-ready`；source config／toolchain ready、0 valid identity、credential absent。runtime manifest／builder／candidate 與所有 side-effect scope 全 false，未執行 codesign／notarytool／workflow／UI／Ollama／network。
- 這補足 current-source gate provenance，並確認缺少外部 signing prerequisite 時不會 fallback 到 unsigned／ad-hoc builder；不解除 Developer ID／notarization、`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、全機 egress、Windows 或 FR-021 overall blocker。

### FR-021-PREREQ-20261029-READINESS-RECHECK-NEXT5：current-source signed-canary prerequisite recheck（2026-10-29；external identity blocker 保留）

- next3／next4 readiness evidence 仍綁定舊 `c06d15e`；本輪以 current source HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b` 重跑 read-only audit，保存 next5 mode `0600`、SHA-256 `11312386df77c2bee79accf6f07a055693abeef236c15ea8a13d8b3d2dcc1937`。
- source config／toolchain／existing evidence／provenance ready，但 identity probe 為 0 valid identities、無 Developer ID Application；notarization credential absent，故 decision 維持 `blocked-external-signing-identity`。本輪未修改 keychain／candidate、未執行 signing／notarization／workflow／builder／UI／Ollama／network，raw output／identity／secret 未落盤。
- 這修正的是「現行 handoff 是否由最新 readiness evidence 支撐」的 provenance gap，不解除 external signing identity／credential、`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、全機 egress、Windows 或 FR-021 overall blocker。

### FR-021-MACOS-CI-20261029-EXTERNAL-BOUNDARY-RECHECK-NEXT13：signed-canary external boundary current-state recheck（2026-10-29；external prerequisite blocker 保留）

- 以 `gh api --hostname github.com` 唯讀重查 remote branch、`macos-signed-canary` Environment、environment secret metadata、branch protection 與 workflow content；next13 evidence status `fail`、mode `0600`、SHA-256 `c3ffb62230fc4ae5d6de2add79c0cce71dca1c3de9e86d0741cd822308b607ec`。
- remote branch／workflow／local source provenance match；Environment、required reviewer、secret metadata、branch protection 仍 `not-found`，summary `ready=false`。本輪未修改 remote、未觸發 workflow、未讀取 secret value，raw API output／reviewer name／token 未落盤。
- 這只確認外部配置仍未就緒，不能宣稱 signed／notarized candidate、Apple ticket、release 或 FR-021 overall；`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false`、全機 egress、Windows 與受控 runner identity／credential residual 維持。

### FR-021-MACOS-CI-20261029-NOTARY-KEYCHAIN-PROFILE-PROBE-NEXT2：notarytool keychain-profile runtime resolution preflight（2026-10-29；已推送，未執行 Apple workflow）

- 缺口：NEXT1 已將兩個 submit 改為 `--keychain-profile`，但 workflow 只以環境變數 presence 判定 credential route；profile 未預置或不可解析時，錯誤可能延後到 builder／notary submit。
- 目前修正方向：在 builder 前加入固定 `osf-signed-canary` 的 `xcrun notarytool history --keychain-profile ... --output-format json --no-progress` read-only probe；stdout／stderr 丟棄，非 0 exit fail-closed，且 output directory／candidate 尚未建立前即停止。focused gate regression 同時鎖定 ordering、固定 profile、無舊 credential flags 與 probe mutation。
- 實作／驗證：workflow 與 gate test 已完成；round1 F-01 指出 appended `|| true` mutation 可 false-pass，主要代理補上 negative lookahead、explicit operator guard 與 targeted mutation assertion；round2 `docs/project-management/reviews/2026-10-29-fr-021-macos-signed-canary-notary-keychain-profile-probe-next2-round2.md` 確認 F-01 關閉。focused／完整 `npm run check`、YAML／syntax／diff checks 通過；allowlist-only 2-path commit `f16ae8be60fb132bdbb1a128722a244f70f86e6b` 已推送。
- next12 read-only external-boundary evidence status `fail`、mode `0600`、SHA-256 `a0283d10dd4420744aff7fa676d8e9a6a4da7276b10548621544a80dbece6376`；remote branch／workflow／source match，Environment／reviewer／secret metadata／branch protection not-found，`secretValuesRead=false`。本輪治理 closeout 後 final docs gate 通過。
- 界線：本輪不在本機執行 probe、`store-credentials`、workflow、signing、builder、notarization、ticket、stapler、Gatekeeper 或 release；不建立／修改 keychain、Environment、secret、reviewer 或 branch protection。probe 通過也只代表受控 runner 的 profile resolution／history request 可用，不代表 signed／notarized candidate 或 FR-021 overall。

### FR-021-MACOS-CI-20261029-NOTARY-KEYCHAIN-PROFILE-NEXT1：notarytool password argv hardening（2026-10-29；已推送，未執行 Apple workflow）

- residual 根因：signed-canary workflow 原先以 `--apple-id`、`--password`、`--team-id` 將 Apple credential route 傳入 notarytool process argv；這不符合本輪要收斂的 password argv privacy boundary。Apple 官方 notarytool contract 提供 `--keychain-profile` 作為 keychain credential reference。
- 修正：readiness／builder／notary steps 固定注入非秘密 profile label `osf-signed-canary`；兩個 DMG／ZIP submit 均只使用 `--keychain-profile`，gate regression 拒絕舊的 `OSF_APPLE_*`／password／Apple ID／Team ID route；readiness 與 external-boundary projection 改為 keychain-only／無未使用 required secret names。
- round1 獨立審查 `docs/project-management/reviews/2026-10-29-fr-021-macos-signed-canary-notary-keychain-profile-next1-round1.md` 結論為 bounded source／local contract 有條件通過，無 source／test technical finding。focused／完整 checks 通過；commit `ce72b64f8aa2b937e1b589e1b9577835dd691ca8` 已推送，next11 external-boundary `status: fail` 但 remote source／workflow match、Environment／secret metadata／branch protection `not-found`、`secretValuesRead=false`。
- 界線：本項不證明 self-hosted runner keychain profile 存在／可解析、Apple identity、notarytool／store-credentials、實際 workflow、signing／notarization／ticket validity、Gatekeeper、release、packaged UI、Windows、全機 egress 或 FR-021 overall；profile provisioning 待外部受控 runner 配置。

### FR-021-MACOS-CI-20261029-ZIP-COVERAGE-NEXT1：macOS signed-canary ZIP distribution coverage（2026-10-29；已推送，未執行 Apple workflow）

- round1 F-01：workflow 以 `ditto -t -k` 驗證 final ZIP，但目標 macOS 實測不支援該選項；F-02：malformed／non-UTF-8 notary output catch path 丟失 raw digest／bytes；F-03：positional args、submitted archive 0600 與 dual cleanup 的 static mutation guards 不完整。round1 原件保留於 `docs/project-management/reviews/2026-10-29-fr-021-macos-signed-canary-zip-coverage-next1-round1.md`。
- 修正：改用 `/usr/bin/unzip -tqq`；`readNotaryOutput()` 先以 raw `Buffer` 計算 SHA-256／bytes，再以 fatal UTF-8 與 JSON parse fail-closed；補 DMG／ZIP 對稱 wrong-run／mode／malformed／symlink／invalid UTF-8 matrix、完整八個 positional args、0600 與 cleanup mutation guards。round2 原件 `docs/project-management/reviews/2026-10-29-fr-021-macos-signed-canary-zip-coverage-next1-round2.md` 確認 F-01／F-02／F-03 關閉，bounded source／local contract 有條件通過。
- selector／distribution／gate tests、Darwin arm64 audit-main fixture、完整 `npm run check`、YAML parse、docs validator 與 `git diff --check` 通過；source-only commit `3a8f04080d810fae55df6b58b5b1b4991a2632ba` 已推送且 remote SHA 一致。next10 external-boundary status `fail`、mode `0600`、remote branch／workflow present 且 source matches local，Environment／secret metadata／branch protection `not-found`，`secretValuesRead=false`。
- 界線：本項不代表實際 GitHub workflow、Developer ID／codesign、Apple notarization／ticket validity、stapled candidate、Gatekeeper、release、packaged UI、Windows、全機 egress 或 FR-021 overall；notary password argv 與外部 signing identity／Environment／credential 仍保留。

### FR-021-MACOS-CI-20261029-MALFORMED-CANDIDATE-NEXT1：candidate metadata bounded evidence（2026-10-29；已推送，未執行 Apple workflow）

- 根因：signed-canary result audit 在 `CFBundleExecutable` 缺失／非法時，可能把未驗證 plist 值送入 `path.join` 或直接 hash 讀取；helper 缺失時 objects cardinality 也會縮短，導致 validator 在 evidence writer 前拋例外。packaged identity audit 另有 truthy digest gate，不能明確拒絕非 64-hex 值。
- 修正：新增 shared `normalizeBundleExecutableName()`；兩支 audit 使用 nullable hash、固定六個 expected code objects、strict candidate／object metadata readiness 與 packaged `isSha256`／`allVerified`；validator／classifier 保持 malformed candidate `status: fail`，exclusive evidence writer／0600 與 privacy／scope contract 不變。
- round1 review 發現治理 heading `#` bypass 與 packaged truthy digest，round2 確認兩項已關閉；source-only commit `ae599e780fc246910e8e625c142c2af0ac87b412` 已推送。focused fake-darwin probes、完整 `npm run check`、治理 validator、`git diff --check` 與 final docs gate 通過；current-source external-boundary `next9` status `fail`、mode `0600`、remote source／workflow match，Environment／secret metadata／branch protection 仍 `not-found`，未讀取 secret value。
- 界線：本項只處理 bounded malformed／missing candidate evidence，不代表真實 Developer ID／notarization／Gatekeeper／workflow、ZIP coverage、notary password argv、packaged UI、Windows、全機 egress 或 FR-021 overall 完成。

### FR-021-MACOS-CI-20261029-RESULT-CLEANUP-NEXT1：signed-canary result evidence cleanup（2026-10-29；已推送，實際 workflow 未執行）

- round1 發現 workflow 雖然會把 result evidence 複製至 bounded artifact，但 final `always()` cleanup 沒有移除 checkout 內的 `ci-${GITHUB_RUN_ID}-macos-signed-canary-result.json`；同時 focused test 只檢查 filename，存在移除 rm 行仍通過的 false-pass。
- 修正：final cleanup 新增固定 `result_evidence` binding 與 `rm -f -- "$result_evidence"`；focused assertion 改為連續 path／command regex，並以 mutation probe 及 regular file／leaf symlink／directory filesystem probe 固定 fail-closed boundary。round2 獨立複審確認 F-01 已關閉。
- commit `4fdbcc279409690ed39ff922703e328bb49a741b` 已推送；next8 只確認 remote workflow／source presence 與 Environment／secret metadata／branch protection 缺口，未觸發 workflow、builder、signing、notarization 或 release。P2 ZIP／malformed candidate／notary argv 與 FR-021 overall residual 維持。

### FR-021-MACOS-CI-20261029-REMOTE-SOURCE-HANDOFF-NEXT1：source-only remote handoff（2026-10-29；已推送，external execution 未完成）

- round1 發現 16-path staged set 缺少 readiness／packaged-security／single-process／test dependency closure；修正後擴為精確 23 paths，加入既有 required source 與 readiness evidence。round2 再發現 next2 package provenance hash drift 與 protected-ref fail-open；新增 immutable next4 source binding，並在 Apple secret references 前加入 `${{ github.ref_protected }}` fail-closed guard 及 static regression。
- round3 獨立 source review 為有條件通過後，建立並推送 `8dd82fbe71e754616d1c87971670e1e5ad5bf7bc`；remote ref 與 workflow content metadata 精確回讀一致。push 後 next7 read-only audit 確認 workflow 已在 remote，但 Environment／secret metadata／branch protection 仍 not-found，未執行 workflow／builder／signing／notarization。
- round4 固定格式治理複審為有條件通過，`npm run docs:check:final` 已通過。P2 result cleanup、ZIP coverage、malformed-candidate bounded evidence、notary password argv、tracked evidence mode 與 ignored runtime fixture reproducibility 仍是後續風險；不得把本項稱為 signed／notarized candidate、release 或 FR-021 overall 完成。

### FR-021-MACOS-CI-20261029-EXTERNAL-BOUNDARY-AUDIT-NEXT1：remote signed-canary boundary（2026-10-29；local contract 已完成，remote configuration 缺口保留）

- 目的：承接 dormant `.github/workflows/macos-signed-canary.yml` local handoff，分開核驗 remote branch ref、`macos-signed-canary` Environment、environment secret metadata、branch protection 與 workflow content，避免把 local uncommitted workflow 誤稱為已部署 remote workflow。
- 初次 audit next1／next2 的所有 endpoint 皆被記為 command error／404；診斷後確認 audit command 未固定 `--hostname github.com`，且固定 repository owner 另有 typo。兩份 first-run evidence 保留未覆寫；next3 保留 implicit-host 修正後的錯誤 owner observation。
- 修正：`gh api` 固定加 `--hostname github.com`，owner 改為實際 remote `twyderek`；focused test 補 plain `gh: Not Found (HTTP 404)` classifier，並覆蓋 JSON／403／malformed／timeout response。audit 不保存 raw command output，secret projection 只保存 bounded count／presence boolean，不保存 secret name／value 或 reviewer name。
- authoritative next6 `docs/project-management/evidence/2026-10-29-fr-021-macos-signed-canary-external-boundary-next6.json` status `fail`、mode `0600`、SHA-256 `bb21059bb0408f0f6643f81b9e1911df20a06a4563cdd272f62de612e739a40a`：remote branch present／SHA `22f7a09767923973c698fa817c543a1e586495f4`；Environment、environment secret metadata、branch protection 與 workflow content 404；local HEAD `c06d15e95a2f0a0981518c5873003a460e57a5ee` 未匹配 remote branch，local workflow 仍 dirty uncommitted。scope 另明確為 metadata read true、secret value read false；reviewer metadata 必須非空且結構有效，git status subprocess failure 直接 fail-closed。
- 界線：本輪只做 read-only observation，沒有建立或修改 GitHub Environment／reviewer／secret／protection，沒有觸發 workflow、讀 secret 值、signing、notarization、candidate 或 release；因此仍不得宣稱 remote handoff 已部署、signed／notarized candidate、Apple ticket、renderer/offline、全機 egress、Windows、LM Studio 或 FR-021 overall 完成。

### FR-021-MACOS-CI-20261029-DISTRIBUTION-EVIDENCE-NEXT1：artifact selection 與分發證據（source contract，未實跑 Apple workflow）

- round4 handoff residual 中的 nested Helper fixture proof 與 DMG/app distribution evidence 缺口已由獨立 selector、temporary filesystem fixture、exact evidence validator 與 workflow wiring 收斂。selector 不遞迴 `*.app`，只接受 run-scoped `mac-arm64` 直接子項的唯一 app；DMG 只接受 output root 的唯一 arm64 artifact。
- distribution audit 只保存 app executable／DMG SHA-256、由 run-scoped parseable notarytool JSON／DMG hash／run basename／diagnostic digest 綁定的 command success projection、`stapler validate`／`hdiutil verify` summaries、source revision 與 bounded scope；不保存 raw Apple output、ticket details、secret、identity name／hash 或 absolute path。workflow 在 app result audit 前完成 evidence copy／cleanup，保持 clean-worktree provenance。
- 修正後 focused／full checks 與 YAML parse 通過；本機仍沒有 Developer ID identity／credential，workflow、signing、notarization、stapler、hdiutil 與 signed candidate 均未執行。這只結案本地 source／evidence contract，保留 external Environment reviewer／secret scope、實際 Apple acceptance、Seatbelt renderer、全機 egress、Windows、LM Studio 與 FR-021 overall residual。

### FR-021-MACOS-CI-20261029-SIGNED-CANARY-HANDOFF-NEXT1：external signing runner handoff（2026-10-29；未觸發、external identity blocker 保留）

- 目前已有 source-level signed-canary gate 與 post-build audit，但本機 `security find-identity -v -p codesigning` 仍為 0；本輪新增 `.github/workflows/macos-signed-canary.yml`，將 signed／notarized 路徑固定到手動觸發的 Apple Silicon self-hosted runner。
- round1 指出 ready path 可能跳過正式 gate、protected source／environment 不足、persistent `../dist` 可能拾取 stale candidate，以及 action／runner hygiene 缺口；修正後 workflow 無條件執行 `assert-macos-signed-canary-ready.mjs`，只在 gate exit 0 進 builder，並加入 protected current ref／`macos-signed-canary` required-reviewer environment、immutable action SHA、concurrency、run-scoped output override／唯一 artifact 與清理。
- workflow 要求 `self-hosted`／`macOS`／`arm64`／`osf-signed-canary` labels 與預置 Developer ID Application identity；notarization credential 只由 runner 預置的固定 keychain profile `osf-signed-canary` 提供，workflow 不再注入 `OSF_APPLE_*` secrets。readiness／正式 gate 未 ready 時停止，builder 前另須通過 `notarytool history --keychain-profile` probe，且不使用 unsigned／ad-hoc fallback。
- 本輪未觸發 workflow，未修改 keychain、OS network、sandbox、candidate、Release 或 secret；此修正只消除受控外部執行入口的流程缺口，不解除 identity／notarization、Seatbelt renderer、全機 egress、Windows、LM Studio 或 FR-021 overall blocker。

### FR-021-PREREQ-20261029-READINESS-RECHECK-NEXT1：external signing／offline prerequisite current-state recheck（2026-10-29；external identity blocker unchanged）

- 以既有 read-only `scripts/audit-macos-signing-readiness.mjs` 重新核對目前 macOS arm64 source／toolchain／identity／credential state；next1 immutable baseline `docs/project-management/evidence/2026-10-29-fr-021-prerequisite-readiness-recheck-next1.json` status `blocked-external-signing-identity`、mode `0600`、SHA-256 `6f5447d8b0244a27eef0fdbf5b3f58cd17f071c08b7351912ab4c27424ebe8a4`。補上 derived identity／decision consistency fail-closed 與 next2 focused fixture 後，authoritative next2 `docs/project-management/evidence/2026-10-29-fr-021-prerequisite-readiness-recheck-next2.json` status `blocked-external-signing-identity`、mode `0600`、SHA-256 `b7ee6038368f946fd7ead6c7ca11255f88e8e86d87cfc87da4881fe5db4dc031`。
- source HEAD／dirty worktree／script／package／focused-test hash、required toolchain、signed-canary source config 與 existing evidence set 均通過；identity command 成功但 `validIdentityCount=0`、`formalIdentityAvailable=false`，credential presence／notarization 仍 absent。audit 未修改 keychain、candidate、OS network、sandbox policy、Ollama 或 model。
- 唯讀 capability probe 確認 Seatbelt executable、Ollama executable 與預裝 `llama3.2:3b`／`llama3.2:1b` 存在；不重試既知 nested renderer failure，不使用 `--no-sandbox`／`ELECTRON_DISABLE_SANDBOX`，不把工具可用誤稱為 offline UI pass。
- 界線：下一個 signed／hardened canary 需要外部核准的 Developer ID Application identity／entitlements 與完整 notarization credential；`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、true full-egress、Windows、LM Studio 與 FR-021 overall 仍未完成。

### FR-021-REPLAY-20261029-EVIDENCE-PROVENANCE-NEXT1：current-source normal-loopback 3B live evidence provenance hardening（2026-10-29；round1 finding 已修正，round2 有條件通過，治理 closeout 完成）

- F-02 缺口：既有 normal-loopback app-restart evidence 已有 candidate／Framework／review.js hash 與 runner-level argv／child-output projection，但未完整綁定 source revision、dirty worktree、normalized replay invocation、timeout／environment、runner／package bytes 與 replay-time loaded bytes。
- 修正：live verifier schema 升至 v5，新增 `projectReplayProvenance()` 與 `replayProvenance`；source revision 只保存 validated git HEAD、worktree dirty boolean／status digest，source／package／runner bytes 只保存 SHA-256，命令只保存固定 template 與安全參數；`loadedBytesObservation=renderer-ready-file-read` 只表示 renderer-ready 後重新讀取 candidate／review.js／Framework 檔案 bytes，不等同 memory-mapped bytes、runtime loader 或記憶體映射 introspection；缺失或 path／secret／invalid scalar 以 `REPLAY_PROVENANCE_UNAVAILABLE` fail-closed。
- 驗證：focused UI contract／syntax 通過；next1 first-run `docs/project-management/evidence/2026-10-29-fr-021-evidence-provenance-next1.json` status `pass`、mode `0600`、SHA-256 `aa35a2cc9b5e75dcc3886941ec98fc2a011ae0d365cd5b068007e11c39286bfe` 保留未覆寫；修正後 next2 `docs/project-management/evidence/2026-10-29-fr-021-evidence-provenance-next2.json` status `pass`、mode `0600`、SHA-256 `9a159170c0c4dfeac9112dff755fc68f6cd1356445a9396ef49d0fe42d0f19e3`，`sourceProvenanceComplete=true`／`provenanceComplete=true`／`loadedBytesMatchPreLaunch=true`，cancel／checkpoint／app-restart／resume／cleanup 全通過。
- round1 修正：`worktreeDirty` 納入 source complete invariant；pre-launch 與 renderer-ready loaded bytes 分離、重新讀取並要求 hash equality；focused invalid cases 使用完整合法 fixture 逐欄變異，round1 原件保留未覆寫。
- 界線：只補 F-02 evidence provenance；`loadedBytes` 是 renderer-ready 後檔案重讀與 hash equality，不是 runtime memory introspection，dirty status digest 也不保存所有 dirty file contents。`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`，不解除 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` Seatbelt renderer、全機 egress、external signing／notarization、Windows、LM Studio 或 FR-021 overall。

### FR-021-REPLAY-20261029-UI-NORMAL-3B-APP-RESTART-RESUME-NEXT1：current-source packaged UI normal-loopback 3B app-restart／checkpoint／resume replay（2026-10-29；實際通過，round3 獨立複審有條件通過，final docs closeout 已完成）

- 以 current macOS arm64 packaged candidate executable、預裝 `llama3.2:3b`、既有桌面 Ollama 與 normal loopback 實際執行 `cancel-resume-restart`；不套用 Seatbelt、不停止或修改既有 Ollama、不下載模型，故不與 Seatbelt `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` failure 混為一談。
- 第 1 批完成後由 UI cancel，觀察到 cancel POST HTTP 200／accepted／cancelled、cancelled／retryable、checkpoint 1/6；來源字幕／original SRT 不變。第一個 Electron process group／app server port 有界關閉，保留同一 temporary userData／job root。
- 第二次同一 candidate／DevTools port 啟動後，session／checkpoint 還原且 page time-origin 改變；resume 從 batch 1 開始完成 6/6，accept 6、undo／redo、`reviewed.srt` 保存、timecodes invariant 與最終 cleanup 通過。
- next1 first-run evidence `docs/project-management/evidence/2026-10-29-fr-021-ui-normal-3b-app-restart-resume-next1.json` mode 0600、SHA-256 `38814c753308ea094b71f45ef7d99b3a58e298c569a7c7b4d971501923b7152e` 保留未覆寫；round1 發現第二次 app server port 被清成 null，final port cleanup 形成 vacuous pass。修正 `waitForPortClosed` 對無效 port fail-closed、重啟後保存第二次 port、增加 `secondAppServerPortCaptured`／`secondAppServerPortClosed` 與 focused regression 後，next2 `docs/project-management/evidence/2026-10-29-fr-021-ui-normal-3b-app-restart-resume-next2.json` mode 0600、SHA-256 `e95aa0524fdc32684a49c03bc4c22942afe012657d77dedd6c95e66903256f24` 作 authoritative bounded evidence；candidate／review.js／Framework provenance、local privacy、無 API key、bounded child output hash、raw child output／token／absolute path 未落盤。
- 界線：`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`；next2 只完成 3B normal-loopback app-restart UI lifecycle coverage，F-02 source／command provenance 仍待後續改善，不解除 Seatbelt nested Chromium renderer、全機 egress、external signing／notarization、Windows 或 FR-021 overall。

### FR-021-REPLAY-20261029-UI-NORMAL-3B-CANCEL-RESUME-NEXT1：current-source packaged UI normal-loopback 3B cancel／checkpoint／resume replay（2026-10-29；實際通過，獨立審查有條件通過）

- 以 current macOS arm64 packaged candidate executable、預裝 `llama3.2:3b`、normal loopback 與既有桌面 Ollama 實際執行 cancel-resume scenario；未套用 Seatbelt、未停止或修改既有 Ollama、未下載模型，故不與 Seatbelt `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` failure 混為一談。
- 6 cues／6 batches 中第 1 批完成後取得可取消 checkpoint；cancel 後狀態為 cancelled／retryable，保存 1 suggestion，source subtitle／original SRT 不變；reload 後同一 session／checkpoint 還原，resume 從 batch 1 開始並完成剩餘批次，最後 6 suggestions、accept 6、undo／redo、`reviewed.srt` 保存與 timecodes invariant 均通過。
- evidence `docs/project-management/evidence/2026-10-29-fr-021-ui-normal-3b-cancel-resume-next1.json` mode 0600、SHA-256 `397983b2388083c64c161c7f0e3bf340be4c919bde1abcc7da532c661545e31c`；candidate／review.js／Framework provenance、local privacy、無 API key、bounded child output hash、Electron／server／port／temporary cleanup 均保存或核對通過，raw child output／token／absolute path 未落盤。
- 界線：`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`；本項只完成 3B normal-loopback UI lifecycle coverage，不解除 Seatbelt nested Chromium renderer、全機 egress、external signing／notarization、Windows 或 FR-021 overall。
- round1 獨立審查 lifecycle 有條件通過，round2 治理 closeout 複審通過：candidate／Framework／review.js hash、evidence 0600、privacy、cleanup、cancel／checkpoint／reload／same-session resume lifecycle 與 focused／full checks 均核對通過；F-01 已關閉，F-02 source／command／environment provenance 與 F-03 cancel POST HTTP observability 為非阻擋後續改善，不回寫本次 immutable evidence。`npm run docs:check:final` 與 `git diff --check` 均 exit 0。

### BUG-062：normal packaged UI verifier navigation token lost after sanitized home URL（2026-10-29；source 修正，round3 有條件通過，治理 closeout 完成）

- 現象／基準：current macOS arm64 candidate 以 normal-loopback、預裝 `llama3.2:3b` replay；next1／next2 renderer 已啟動並完成 synthetic job setup，但在 `review_navigation` 只看到正常 local review page title、`cueCount=0`，沒有進入 AI flow；Electron／server／port／temporary cleanup 全部通過。兩份 immutable failure evidence 保留未覆寫。
- 根因：`waitForHomeDashboard()` 為避免把 API token 寫入 provenance，只回傳去敏 `location.origin + location.pathname`；後續 `reviewUrl` 又從該去敏 URL 讀取 token，因此 Page.navigate 後 review page 的 API 請求缺少 `X-Offline-Subtitle-Token`，review data 未載入。這是 acceptance runner 的狀態傳遞 bug，不是產品 renderer、Ollama 或模型輸出根因。
- 修正：首頁探針在記憶體額外回傳 token；runner 以 `navigationToken` 只供後續 URL／API navigation 使用，`homeEvidence` 僅保存 local href／title／dashboard boolean。同步將 normal verifier evidence writer 設為 exclusive owner-only `0600`，並在 `scripts/test-ollama-ui-offline.mjs` 固定 token non-persistence／writer mode regression。
- 驗證：focused UI contract、完整 `npm run check`、round3 in-memory mutation probes 與 `git diff --check` 通過；next3 `docs/project-management/evidence/2026-10-29-fr-021-ui-normal-3b-replay-next3.json` status `pass`，完成 home／review／2 cue 3B translation／accept／undo／redo／SRT save／timecode invariant，candidate／Framework provenance 與 privacy／cleanup guard 通過。round3 審查 `docs/project-management/reviews/2026-10-29-bug-062-normal-ui-token-safe-navigation-next1-round3.md` 確認 F-01 home／initial review／restart review source-region mutations 與 F-02 governance consistency 均關閉；本條目治理 closeout 完成。
- 界線：next3 是 normal loopback（`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`），不解除 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` 的 Seatbelt blocker，不代表全機斷網、signed／notarized package、Windows 或 FR-021 overall；next1／next2／next3 evidence 均為 immutable。

### FR-021-REPLAY-20261029-UI-OFFLINE-REPLAY-NEXT1：current-source packaged UI Seatbelt offline replay（renderer blocker 保留）

- 既有 arm64 candidate／預裝 `llama3.2:3b`／Ollama／Seatbelt preflight 通過；next1 與修正後 next2 均在 Electron `electron_start` 失敗，diagnostics 為 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`CHROMIUM_GPU_SANDBOX_UNAVAILABLE`、`OS_PERMISSION_DENIED`、`SIGTRAP`，未進入 home／AI flow。
- 兩次 evidence 均證明 loopback／external `EPERM`、sandboxed daemon／Electron process tree、no-download、無 API key／external provider 與完整 cleanup；next2 為 mode 0600 authoritative evidence，next1 mode 0644 原件保留未覆寫。
- 修正只收斂 evidence privacy：offline wrapper 使用 exclusive `0600` create，focused／full check 通過；不使用 `--no-sandbox`、不改 Seatbelt policy／OS network、不把 failure 擴大為 UI pass。signed identity／notarization、真正全機 egress、Windows 與 FR-021 overall 仍未完成。
- round1 獨立審查判定 bounded failure contract 有條件通過；next2 是 authoritative 0600 evidence，治理 closeout 與 `npm run docs:check:final` 已完成。`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`SIGTRAP`、`systemNetworkDisabled=false`、signed identity／notarization、Windows 與 FR-021 overall 的 residual risk 保留。

### FR-021-DEBUG-20261029-SIGNED-CANARY-POST-AUDIT：signed candidate post-build verification contract（2026-10-29；external identity blocker 保留）

- round1 審查發現 Team ID consistency、entitlements presence、stapler／Gatekeeper generic output、shared build config、candidate metadata privacy、source provenance、schema／negative coverage 共 8 項問題；原報告保留於 `docs/project-management/reviews/2026-10-29-fr-021-signed-canary-post-audit-round1.md`，不覆寫。
- 修正後 contract 改用獨立 `electron-builder.signed-canary.mjs`，由純 classifier 重新比對六個 code object 的 Team ID、要求完整 plist／dict entitlements、Apple output 正向 allowlist、fixed helper counts、source／lockfile／imported-script hashes 與 clean-worktree provenance；base unsigned／development package config 不再被 signed canary 改變。
- round2 指出並已修正 diagnostics／object digest 綁定、signed builder wrapper provenance 與 evidence leaf／cross-field validator；round2 原件保留，round3 待獨立複審。
- round3 指出並已修正 timestamp／platform／arch／interpretation leaf schema、helper completeness、verification status、Apple flag contradiction 與 distinct-diagnostic permutation coverage；round3 原件保留，round4 複審報告另行保存。
- round4 報告 `docs/project-management/reviews/2026-10-29-fr-021-signed-canary-post-audit-round4.md` 只保留兩項 closeout blocker：需以目前 source provenance-consistent 的 gate execution evidence 取代／補充舊 execution3，並完成最新 08 條目 closeout；execution4 已以 0600 immutable record 保存，sourceRevision 與 gate audit script／focused test 一致，待最後複審確認。
- 本輪未執行 future candidate audit、signing、notarization、stapler、spctl、packaged app／UI／AI／Ollama／model／network；gate execution4 仍以 external identity／credential blocker fail-closed 保存。contract pass 不等同 signed／hardened package、Gatekeeper、renderer acceptance 或 FR-021 完成。

### FR-021-DEBUG-20261029-SIGNED-CANARY-BUILD-GATE：formal signed canary 在 builder 前 fail-closed（2026-10-29；external identity blocker 保留）

- 為避免 electron-builder 在缺少正式 identity 時靜默產生 unsigned／ad-hoc 結果，新增 `scripts/assert-macos-signed-canary-ready.mjs` 與 `electron:build:mac:signed-canary`。純 evaluation 嚴格要求 macOS arm64、有效 `dmg／zip／dir` arm64 source target、required toolchain、Developer ID Application identity 與單一 complete notarization credential；不讀／寫 secret、keychain 或 candidate，另以獨立 script 保存去敏 execution evidence。
- 目前 gate 實跑在 builder 前停止，原因為 `developer-id-application-not-ready` 與 `notarization-credential-set-not-ready`；不把 0 identity 當成產品 runtime defect，也不改既有 `electron:build:mac:dir`／`electron:build:mac`。
- focused gate matrix（含 malformed／wrong-arch／missing target）、完整 `npm run check`、治理 validator、0600 execution2 evidence 與 `git diff --check` 通過。後續只有在外部 identity／credential 具備後，才能以新 immutable evidence 另立 signed／hardened packaging canary；effective entitlements、notarization、renderer／UI／AI／Ollama／model／network acceptance 與 FR-021 整體仍未完成。

### FR-021-DEBUG-20261029-SIGNED-CANARY-PREFLIGHT：notarization credential path fail-closed（2026-10-29；external identity blocker 保留）

- 依 electron-builder 26.17.0 `getNotarizeOptions()` 的 precedence，新增 Apple ID／app-specific password／team ID、API key／key ID／issuer、keychain profile 三路 credential classifier；keychain path 只有在 profile 存在時才算 complete，partial／ambiguous 組合不算 ready。
- 只保存環境變數 presence 與分類結果，不讀 secret value、不保存 keychain path／raw output、不呼叫 notarytool。focused test 固定 complete、partial、ambiguous、absent 四類，audit8 `notarizationCredentialReady=false`。
- 本機仍 `validIdentityCount=0`、`formalSigningReady=false`，所以沒有建立 signed candidate 或重播 renderer；effective entitlements、實際 notarization 與 FR-021 仍待外部 identity 後的隔離 canary。audit12 同時要求 credential presence／derived summary／decision／所有 nested leaf schema／有效 arm64 target／generic path exact match，audit11／audit10／audit9／audit8 保留為修正前原件。

### FR-021-DEBUG-20261029-PACKAGING-CONFIG-READINESS：正式 packaging source path 準備完成但 external identity blocker 保留（2026-10-29）

- 唯讀核對 electron-builder 26.17.0 source contract：`identity: null` 會跳過 macOS code signing；省略 identity 才會使用 keychain auto-discovery 或 `CSC_NAME`，無 identity 時則維持 fail-safe skip。故 package config 移除 `identity: null`，並明確設定 `hardenedRuntime: true`／`gatekeeperAssess: true`。
- readiness helper 新增 source config classifier：auto-discovery 可作為 future formal path；explicit-null、explicit ad-hoc `"-"`、空 identity 與 hardened false 不可作為 formal path。focused test 以 deterministic failure injection 覆蓋上述分支。
- audit7 `docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit7.json` 顯示 source config ready、required toolchain／audit script／focused test provenance／privacy 通過，但本機仍 0 valid identity，故保持 `blocked-external-signing-identity`；未執行 signing／notarization、candidate、packaged app／UI／AI／Ollama／model 或 renderer replay。audit6 保留為 round1 finding 前原件。

- round1 F-01／F-02 修正：dirty probe 現納入 untracked state，evidence 以固定 provenance scope 綁定 audit script、package manifest 與 focused test hash；移除 unsupported `/usr/bin/codesign --version`／`/usr/bin/productbuild --version`，保留 executable presence／xcrun lookup 與受支援的 macOS／Node version probes。R-01 仍留給後續 signed canary，必須實際核對 effective entitlements、完整 notarization credential set 與不落盤邊界。

### FR-021-DEBUG-20261029-SIGNING-READINESS-AUDIT：正式 signing／hardened runtime 前置條件收斂（2026-10-29；external identity blocker 保留）

- 前一階段 ad-hoc runtime flag 已形成但 startup probe 仍 `SIGABRT`／無 CDP，因此本階段停止重播 renderer，改做只讀 readiness audit。audit5 顯示 required `codesign`／`xcrun` 可用、`xcrun --find notarytool` 成功，但 `security find-identity -v -p codesigning` 為 0 valid identities，source `identity: null`、hardened／Gatekeeper false。
- round1／round2／round3 審查指出並追蹤 identity probe failure／malformed output、imported evidence／privacy、工具鏈 gate、source provenance、focused coverage、完整 scope allowlist、evidence cardinality 與 top-level scope schema 缺口。主要代理已改為 identity probe fail-closed、required／optional toolchain contract、固定 evidence filename／恰好兩份且不可重複、完整 scope key allowlist／type／digest gate、source／package／git revision provenance、寫檔前 privacy gate，並新增 failure-injection focused regression。
- 修正不修改 keychain、candidate、正式 macOS package config、sandbox、network policy 或發布資產；不執行 signing／notarization／packaged app／UI／AI／Ollama／model。`blocked-external-signing-identity` 是外部能力 blocker，不是 FR-021 pass；取得正式 identity／entitlement 後才另立 signed／hardened canary。

### FR-021-DEBUG-20261029-ADHOC-RUNTIME-CODESIGN-CANARY：ad-hoc runtime flag 未解除 nested Chromium blocker（2026-10-29；blocker 保留）

- 在全新 repo 外副本執行 ad-hoc `codesign --options runtime`，audit2 required-runtime gate 核對 6 個 code object 形成 `0x10002(adhoc,runtime)` 且 deep verify 通過，仍無 Team ID／entitlement；既有 candidate／前一輪 canary 未修改，audit1 保留為 gate 修正前原件。
- 新候選的 `--single-process`／`--no-zygote` bounded startup probes 均無 local page／CDP，child `SIGABRT`／`ELECTRON_EARLY_EXIT`，cleanup 通過。這表示 runtime flag 改變 code-sign identity／failure signal，但未解除 renderer blocker；不使用 `--no-sandbox`、`ELECTRON_DISABLE_SANDBOX` 或放寬 network policy。
- 證據：`docs/project-management/evidence/2026-10-29-fr-021-adhoc-runtime-signing-canary-sign1.json`、`...startup-probe1.json`、`...startup-probe2.json`；未跑完整 UI／AI／Ollama／model，FR-021 仍未完成。

### FR-021-DEBUG-20261029-HARDENED-RUNTIME-PACKAGING-CANARY：CLI hardened-runtime packaging 對照未生效（2026-10-29；blocker 保留）

- 以新 repo 外輸出目錄要求 `mac.hardenedRuntime=true` 建置 macOS arm64 directory candidate；electron-builder 明確因 `identity: null` 跳過 code signing。新 bundle audit 仍為 6 objects deep verify、全 ad-hoc、無 Team ID／entitlement，helper inventory complete；Framework hash 未變。
- 處置：將 CLI request 與 effective identity 分開記錄，因沒有有效 signed／hardened 對照而 fail-closed 停止，不執行 renderer startup probe，不修改 current candidate、正式 package config、Seatbelt 或 network policy。建置 dependency download 已揭露，未啟動 packaged app／UI／Ollama／model。
- 證據：`docs/project-management/evidence/2026-10-29-fr-021-hardened-runtime-packaging-canary-build1.json` 與 `docs/project-management/evidence/2026-10-29-fr-021-hardened-runtime-packaging-canary-audit1.json`；這只收斂 packaging environment limitation，不證明 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` 的唯一根因或解除 FR-021 blocker。
- 後續只讀環境核對 `security find-identity -v -p codesigning` 為 0 valid identities；沒有外部 signing identity／entitlement，不能在本機建立有效 signed／hardened 對照。證據 `docs/project-management/evidence/2026-10-29-fr-021-hardened-runtime-packaging-canary-signing-identity-check1.json` 未保存 raw output／路徑。

### FR-021-DEBUG-20261028-PACKAGED-SECURITY-IDENTITY-AUDIT：packaged helper signing／entitlement audit（2026-10-28；packaging seam，blocker 保留）

- 既有 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`SIGTRAP` startup blocker 在安全 flags 診斷後，先以 read-only audit 檢查 current macOS arm64 bundle 的主 app、Framework 與 4 個 helper。audit3 證明 6 個 code object 都能 deep verify、helper inventory 完整，但全部 ad-hoc、無 Team ID、無 entitlement；source packaging config 同樣未設定 signing identity／hardened runtime。audit1／audit2 保留未覆寫。
- 判定只到 packaging identity gap：這提供正規 signed／hardened candidate 的下一個診斷方向，並未證明唯一 root cause，也沒有修改 runtime、Seatbelt、candidate 或 network policy。不得用 ad-hoc 結果推導 UI pass，更不得以 sandbox disabling 取得假 pass。
- 證據與 scope：`docs/project-management/evidence/2026-10-28-fr-021-packaged-security-identity-audit2.json`；沒有執行 packaged app／UI、Ollama／model 或 network，raw output／絕對路徑未落盤。FR-021 blocker、全機 egress、Windows 與完整驗收仍保留。

### FR-021-DEBUG-20261028-CHROMIUM-NESTED-PROCESS-COMPOSITION：安全 startup flags 與 synthetic profile boundary（2026-10-28；blocker 保留）

- 先以現行 `/usr/bin/sandbox-exec` nested profile canary 固定 profile composition 邊界：restrictive loopback-only parent 拒絕 Chromium-like network-service child shape，僅補 TCP／UDP allowances 仍拒絕；unrestricted parent 才接受。證據只執行 `/usr/bin/true`，不把 synthetic shape 當成 exact Chromium generated profile。
- 再對 current-source macOS arm64 packaged candidate 做 startup-only probe。最新 `--single-process` 與 `--no-zygote` evidence 都沒有 local page、child `SIGTRAP`；較早 no-zygote evidence 曾有 local page，但 DevTools `Runtime.evaluate` timeout，之後仍 `SIGTRAP`，分類含 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`OS_PERMISSION_DENIED`。兩次均沒有 Ollama／model／AI flow，loopback control-plane／external socket scope、process group 與 temporary root cleanup 已確認；較早 probe evidence 原件保留。
- 處置：不將兩個旗標保留於 formal acceptance，不使用 `--no-sandbox`／`ELECTRON_DISABLE_SANDBOX`，不放寬 network deny／Seatbelt。現階段結論是安全 process-composition flags 不足以解除 nested Chromium blocker；需後續取得可操作 renderer 的安全 packaging／Electron／macOS 路徑，否則維持 blocker。
- 證據：`2026-10-28-fr-021-chromium-nested-profile-composition-canary1.json`、`2026-10-28-fr-021-electron-single-process-startup-probe4.json`、`2026-10-28-fr-021-electron-no-zygote-startup-probe3.json`；較早 probe evidence 亦保留。本輪不覆寫既有 replay／review，不以 local page 或 synthetic canary 宣稱 FR-021 完整驗收。

### FR-021-DEBUG-20261028-CHROMIUM-SANDBOX-STARTUP-DIAGNOSTIC：Seatbelt packaged Electron renderer startup diagnosis（2026-10-28；blocker 保留，runner robustness hardening）

- 現象：在 outer Seatbelt deny-network／loopback-only 下，Chromium child sandbox 初始化記錄 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／GPU sandbox／permission diagnostics，Electron 出現 `SIGTRAP`；新 bounded evidence 雖看到 local HTTP page，DevTools renderer 仍無法完成 `Runtime.evaluate`，所以不能把 page target 出現當成 UI 啟動成功。
- 診斷：只做 startup-only、無完整 AI flow 的旗標矩陣；`NetworkServiceInProcess2`、`disable-gpu-sandbox` 與 `disable-gpu` 組合均不足以讓 renderer 可操作。未使用 `--no-sandbox` 或等價 Electron sandbox 關閉方式；測試過程的明確 process groups 已清理並確認沒有殘留。
- 修正：`lib/electron-devtools-target.mjs` 改以 loopback URL／exact-port trusted WebSocket 選取 page，不再依賴尚未穩定的 title；`scripts/verify-electron-ollama-ui.mjs` 加入 bounded `waitForHomeDashboard()` 與穩定 timeout／DevTools failure categories。無效 startup flags 已撤回，避免降低 GPU sandbox 卻仍不能通過 UI。
- 驗證：focused offline UI contract、四支 syntax check 通過；新的 workaround evidence 保留為 immutable fail，沒有重試完整 acceptance。這些變更只改善 runner race／診斷可讀性，不解除 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false`、全機 egress、Windows 或 FR-021 完整驗收。

### FR-021-REPLAY-20261028-EVIDENCE-PROVENANCE-UNICODE-CANDIDATE-ARGV：Unicode candidate executable argv provenance（2026-10-28；deterministic/full pass，無新 live replay）

- 缺口：current-source Seatbelt replay1 的 `runnerProvenance.argvRedactionValidated=false`／`argvDroppedCount=1` 來自 `<candidate-executable:離線字幕工廠>` 未符合既有 ASCII candidate allowlist；raw path／secret 並未落盤，但本地化 candidate identity 不完整。
- 修正：`lib/runner-provenance.mjs` 共用 Unicode-safe basename regex，candidate wrapper 先拒絕 separator／control／oversize，再由 basename boundary 拒絕空值／`.`／`..`；`sanitizeRunnerCommand()` 同步使用相同安全 basename boundary。未改 live spawn、offline replay、Chromium／Seatbelt policy、產品 runtime 或既有 evidence。
- 驗證：focused UI contract、兩支 source syntax、完整 `npm run check` 與 `git diff --check` 通過；deterministic test 覆蓋 localized pass 與 path／dot-name／control／oversize fail-closed。replay1 僅唯讀核對原始 failure／hash／scope／cleanup，沒有重新執行相同 failure。
- 邊界：本修正不 retroactively 修改 replay1 的 `argvRedactionValidated=false`，也不代表 Seatbelt packaged UI offline pass；`systemNetworkDisabled=false`、nested Chromium startup blocker、全機 egress、Windows 與 FR-021 完整驗收仍未完成。

### FR-021-REPLAY-20261028-UI-OFFLINE-CURRENT-SOURCE：current-source packaged UI Seatbelt offline replay（2026-10-28；Electron startup blocker，隔離／cleanup 通過）

- 實際結果：目前 macOS arm64 candidate、預裝 `llama3.2:1b` 執行 `acceptance:ollama:ui:offline`；evidence `2026-10-28-ollama-llama3.2-1b-packaged-ui-offline-current-source-replay1.json` 在 `electron_start` 以 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` fail，Electron `SIGTRAP`，沒有 home／AI flow。
- 已確認非模型／daemon／cleanup 失敗：Seatbelt loopback probe 成功，外連 `EPERM`，隔離 daemon 啟動且 model 預裝／未下載；Electron／driver／daemon process groups、port、temporary root、userData 清理全通過，raw output 不落盤且 leakage scan clean。
- 診斷邊界：startup categories 為 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`CHROMIUM_GPU_SANDBOX_UNAVAILABLE`、`OS_PERMISSION_DENIED`；`systemNetworkDisabled=false`、Electron 確實在 sandbox／繼承 network sandbox。這支持 nested Chromium／OS permission startup blocker，但不把單次 failure 定為唯一 root cause。
- 另發現 provenance argv 的 Unicode candidate executable basename 被 `sanitizeRunnerArgv` 的 ASCII candidate allowlist drop，造成 `argvRedactionValidated=false`；沒有 raw path／secret 洩漏，另列 evidence sanitizer 修正，不修改本次 failure evidence。

### FR-021-REPLAY-20261028-EVIDENCE-PROVENANCE-SHARED-PROJECTION：shared runner provenance contract（2026-10-28；deterministic/full pass，無新 live replay）

- 缺口：live／offline verifier 先前各自組 runner provenance 物件；即使補了 `candidateReviewScriptSha256`，仍可能未來欄位集合或 sanitizer 漂移。
- 修正：新增 `projectRunnerProvenance()` 於 `lib/runner-provenance.mjs`，live／offline 共用同一欄位集合與 SHA／command／argv／diagnostic sanitizer；測試補 key-set parity、missing／boxed hash fail-closed、path／secret exclusion。
- round1 finding／修正：審查發現 helper 的 `argvProjection` object 可 bypass allowlist；已移除該參數，live／offline 改傳 raw argv，由 helper 永遠重新 sanitize，並加入 private path／secret bypass regression。
- 驗證／closeout：修正後 focused offline UI、provider、syntax、完整 `npm run check`、治理 validator 與 `git diff --check` 通過；未啟動新的 live runner、Ollama／Electron replay 或模型；round1／round2 原件保留，2026-10-29 next1 current-source 審查確認治理同步已完成。
- 殘餘風險：shared evidence projection 不取得 exact Chromium generated profile，不解除 Seatbelt nested sandbox、全機 egress、Windows 或 FR-021 完整驗收。

### FR-021-REPLAY-20261028-EVIDENCE-PROVENANCE-SCHEMA-PARITY：offline review.js hash projection（2026-10-28；deterministic pass，無新 live replay）

- 審查缺口：上一輪 command parity review 指出 offline wrapper 的 `runnerProvenance` 尚未包含 live runner 已保存的 `candidateReviewScriptSha256`，因此不能稱為完整 schema parity。
- 修正：`scripts/verify-electron-ollama-ui-offline.mjs` 從 `source.artifact.reviewScriptSha256` 只投影合法 64-hex hash；補 deterministic test 固定 valid hash 保留、非法 path fail-closed 與 source-level contract。未修改產品 runtime、既有 evidence、Ollama／模型或 OS 網路。
- 驗證：syntax、offline UI focused test、provider test、完整 `npm run check` 與 `git diff --check` 通過；既有 replay4 只做唯讀 hash／scope 對照，未執行新 live／offline replay。
- 殘餘風險：這只完成 runner provenance schema 欄位 parity，不取得 exact Chromium generated profile、不解除 nested Chromium sandbox／全機 egress／Windows blocker，也不代表 FR-021 完整驗收。

### FR-021-REPLAY-20261028-EVIDENCE-PROVENANCE-COMMAND-PARITY：Unicode command identity 與 live/offline parity（2026-10-28；replay4 normal pass，offline scope 未完成）

- 審查缺口：上一輪 `runnerProvenance.command=null` 是安全的 ASCII fail-safe，但中文 executable basename 無法在單份 live evidence 中自足追溯；offline wrapper 亦使用獨立 command regex，且缺少直接 non-ASCII boundary assertion。
- 修正：`lib/runner-provenance.mjs` 新增 `sanitizeRunnerCommand()`，只保存不含 path／separator／control、長度 bounded 的 primitive basename；live verifier 與 offline wrapper 共用 helper。新增 deterministic assertions 覆蓋中文 pass、ASCII pass、path／secret／control／empty／oversize／non-primitive fail-closed 與 projection parity；產品 runtime、provider、OS 網路與既有 evidence 均未修改。
- 驗證：`node scripts/test-ollama-ui-offline.mjs`、`node scripts/test-ai-providers.mjs`、完整 `npm run check`、`git diff --check` 通過；packaged replay4 status `pass`，`runnerProvenance.command="離線字幕工廠"`、argv／candidate／Framework identity、bounded child output、6-batch cancel／resume／save／cleanup 全通過。
- 殘餘風險：replay4 仍是 normal loopback（`systemNetworkDisabled=false`、未套用 outer Seatbelt）；本輪不解除 Chromium nested sandbox、per-app／全機 egress、Windows、其他模型／版本、長 prompt 或 FR-021 完整驗收。

### FR-021-REPLAY-20261028-EVIDENCE-PROVENANCE-LIVE-UI：live packaged UI evidence runner provenance（2026-10-28；replay3 normal pass，offline scope 未完成）

- 現象／審查缺口：上一輪 cancel-resume review 指出 live evidence 的 `runnerProvenance` 為 null，candidate 關聯主要依治理文件與既有 parity audit 對照；這降低單份 evidence 的 provenance 自足性，但不構成產品 runtime bug。
- 修正：`scripts/verify-electron-ollama-ui.mjs` import `sanitizeRunnerArgv`，將已去敏的 launch argv、sandbox flags、candidate executable／review.js／Framework hash 與 bounded child-output digest／bytes／diagnostic categories 投影到 `runnerProvenance`；不保存 raw child output、秘密或使用者路徑。`scripts/test-ollama-ui-offline.mjs` 補 VM failure／redaction assertions；產品 runtime、provider contract、既有 evidence 均未修改。
- 驗證：新 `2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay3.json` status `pass`；`argvRedactionValidated=true`、`argvDroppedCount=0`、candidate／Framework hash 可追溯、`rawChildOutputPersisted=false`，6-batch checkpoint cancel／same-session resume／save／cleanup 全通過。完整 `npm run check` 與 focused UI contract 通過。
- 殘餘風險：replay3 仍為 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false` 的 normal loopback；`command=null` 是中文 basename 的 ASCII-safe projection fail-safe，不影響 argv／hash；此修正不解除 Chromium nested sandbox、per-app／全機 egress、Windows 或 FR-021 完整驗收。

### FR-021-REPLAY-20261028-UI-CANCEL-RESUME-NORMAL：packaged Ollama UI cancel／checkpoint resume（2026-10-28；replay2 normal pass，offline scope 未完成）

- 初次現象：以 current-source packaged candidate、預裝 `llama3.2:1b`、6 cues／batchSize 1 執行 cancel-resume；`2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay1.json` 在 `checkpoint_cancel` 觀察到任務先 `failed`，沒有取得可取消 checkpoint；所有 process／port／userData／daemon cleanup 通過。原件保留，未改寫成成功。
- 診斷：原 synthetic fixture 的「Hello，朋友／Thank you，大家」在單 cue batch 下使 1B 模型偶發輸出不符合英文翻譯契約；worktree-only `optimizeSubtitleCues` loopback probe 可重現於後續 cue 的 `翻譯語言與輸出語言 en 不一致`。這是 acceptance fixture 對小模型輸出穩定性的問題，不據此放寬產品 translation validation，也不把失敗歸因為 checkpoint／cleanup bug。
- 修正邊界：`scripts/verify-electron-ollama-ui.mjs` 只將 cancel-resume fixture 換成短中文句，正常 2-cue fixture、產品 runtime、current candidate bundle、provider contract 均不變；未增加 retry 以堆疊成功樣本，未下載模型或修改 OS 網路。
- 重播結果：`2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay2.json` status `pass`；完成 checkpoint cancel `1/6`、persisted suggestion 1、reload 後 session／checkpoint 保持、resume from batch 1 且 same session，之後 6 suggestions、accept／undo／redo／save 與 timecodes／英文翻譯 assertions 全通過。replay2 artifact hash 與前一輪 current candidate 相同。
- 殘餘風險：兩次 run 均為 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false` 的 normal loopback；這只補 packaged UI cancel／resume coverage，不能替代 Seatbelt offline、真正全機斷網、Windows、不同模型／版本或 FR-021 完整驗收。1B 小模型輸出品質仍非本輪 acceptance 的泛化結論。

### FR-021-REPLAY-20261028-UI-NORMAL：current-source packaged Ollama UI normal path（2026-10-28；normal pass，offline scope 未完成）

- 目的：承接 BUG-060／BUG-061，確認最新 dirty source 的 Ollama native routing／exact schema／`num_ctx=4096` 不只存在 source／deterministic tests，也確實被 packaged macOS arm64 candidate 載入；同時把 normal loopback UI pass 與 Seatbelt offline blocker 分開記錄。BUG-061 測試檔仍是 worktree-only，不是 packaged runtime input。
- 結果：`npm run electron:build:mac:dir` 建立 0.52.0 candidate；`llama3.2:1b` normal packaged UI replay status `pass`，2 suggestions、accept 2、undo／redo、reviewed.srt 保存、timecodes unchanged、local privacy／empty key 與 cleanup 均通過；model 未下載、既有服務未修改。
- 根因／邊界：本輪不是修復產品 bug；normal runner 明確未套用外層 Seatbelt（`sandboxedTargetProcessTree=false`、`systemNetworkDisabled=false`）。因此它解除的是「最新 source 是否進入 packaged UI」的不確定性，不解除 nested Chromium sandbox／真正 egress control／FR-021 offline acceptance blocker。
- 後續：保留 `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-normal-replay1.json`、其 `artifact-parity` audit 與既有 Seatbelt fail evidence；不以 normal pass 改寫 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false` 或 full FR-021 未完成狀態。

### BUG-061：BUG-060 provider routing／schema regression coverage 不完整（2026-10-28；已修正，2026-10-29 bounded closeout）

- 現象：BUG-060 round1 已確認 source routing／schema 正確，但指出 custom native 404 fallback 的第二次 body、proofread full schema 與 custom native 非 404 不 fallback 尚未由測試直接固定。
- 修正：`scripts/test-ai-providers.mjs` 新增 fallback body exact model／messages、完整 internal metadata stripping、exact request count、proofread／translate root／cue／item schema assertions，以及 custom native 400／500／strict stream failure fail-closed／無第二次 request assertions；本輪再補 proofread 實際 request body 的 `text.type`／`reason.type` direct assertions；未修改 `lib/ai/providers.mjs` 或其他 runtime。
- 驗證：focused provider／stream／optimizer tests、完整 `npm run check`、治理 validator 與 `git diff --check` 均 exit 0；範圍限 deterministic transport／body contract，不代表 live Ollama、模型品質、UI、Windows、真正全機斷網或 FR-021 完整驗收。
- 審查：round1 報告 `docs/project-management/reviews/2026-10-28-bug-061-regression-coverage-round1.md` 指出 coverage residual；round2 `docs/project-management/reviews/2026-10-28-bug-061-regression-coverage-round2.md` 確認既有 coverage；next1 `docs/project-management/reviews/2026-10-29-bug-061-regression-coverage-next1-round1.md` 確認 direct assertions 與 full deterministic checks 通過，唯一 finding 為治理同步，已完成 closeout。

### BUG-060：Ollama translate native JSON format 與 custom loopback routing（2026-10-28；修正待獨立審查）

- 現象：`llama3.2:1b` 的 Seatbelt product replay1／replay2 在 product probe 以 `MODEL_RESPONSE_CONTRACT_REJECTED` 失敗；隔離／預裝／cleanup 子範圍均通過。直接觀察到 acceptance wrapper 的隨機 loopback port 會觸發 provider 的非 11434 fallback，translate 也只送 generic JSON mode。
- 根因：`optimizeOllamaNative()` 以 port number 判斷 native path，導致同為 loopback 的自建 Ollama daemon 未取得 native `num_ctx`／schema；generic `format: "json"` 亦無法把 cue ID／數量契約交給 constrained decoding。
- 修正：`lib/ai/providers.mjs` 以 loopback hostname 作 native routing 邊界，所有 loopback port 送 `/api/chat`；新增共用 exact cue JSON Schema，translate／proofread 均綁定原始 ID enum、cue count、`text`／`reason`，非 loopback 保留 OpenAI-compatible fallback。`scripts/test-ai-providers.mjs` 補 default／custom loopback／non-loopback routing 與 schema regression。
- 驗證：focused provider tests、完整 `npm run check` 均通過；最後 source 的 1B Seatbelt replay4 完成 2-cue product flow、接受／undo／redo、雙語保存與 hash／cleanup／EPERM assertions。replay1／replay2 immutable fail evidence 與 replay3 pass evidence 保留。
- 剩餘風險：不證明所有 Ollama 版本／模型接受同一 schema，不證明長 prompt／品質泛化；`systemNetworkDisabled=false`，Electron UI、取消／續跑、Windows、真正全機斷網與 FR-021 全部驗收仍未完成。

### BUG-059：Ollama 3B native request context 過大造成 product flow stall（2026-10-28；已修正，round1 獨立審查有條件通過）

- 現象：FR-021-REPLAY-20261028 的目前 source 3B product probe 以 `MODEL_RESPONSE_CONTRACT_REJECTED` 失敗，另一次 3B live product task 240 秒逾時。直接以同一 `llama3.2:3b`、同一最小 `/api/chat` JSON request 重現時，未指定 context 在 60 秒內無回應；只加 `options.num_ctx=4096` 後約 3.97 秒完成。
- 根因：本機 Ollama 0.40.8 daemon 的環境／排程使 3B runner 使用 `n_ctx=131072`；log 記錄 KV cache 約 14.3 GiB、預測 memory 約 15.9 GiB，而主機只有 8.0 GiB／free 約 1.0 GiB，導致 partial offload／resource pressure，未先產生可用 JSON response。這是目前 runtime resource configuration 的近因／根因證據，不把它擴大為模型品質或所有硬體的普遍結論。
- 修正：`lib/ai/providers.mjs` 的 Ollama native `/api/chat` options 固定加入 `num_ctx=4096`；未改 daemon、全域設定、模型檔、batch size、timeout／retry、cue contract 或其他 provider。`scripts/test-ai-providers.mjs` 補 body assertion，確認非 Ollama 不帶該欄位。
- 驗證：provider／Ollama batch stream／optimizer focused tests 通過；實際 `createProvider().optimize()` 3B loopback probe 約 1.25 秒完成；`acceptance:ollama:offline` replay2 通過 2 cue AI、accept 2、undo／redo 各 2、雙語保存、時間碼與來源 SRT hash 不變，以及 Seatbelt／model／cleanup checks。
- 剩餘風險：4096 是目前小記憶體 acceptance 的受控預設，不證明所有模型／硬體／長 prompt 都最佳；需保留 prompt 超長、不同模型／版本、Electron UI、取消／續跑、Windows、全機斷網與 FR-021 完整驗收界線。

### FR-021-REPLAY-20261028：目前 source 的 Ollama 產品離線流程未完成（2026-10-28；隔離／清理通過，產品 AI flow 失敗）

- 現象：`acceptance:ollama:offline` 對預裝 `llama3.2:3b` 在 Seatbelt／model preflight 後進入 product probe，最終以 `MODEL_RESPONSE_CONTRACT_REJECTED` 失敗；evidence `2026-10-28-ollama-llama3.2-3b-product-offline-replay1.json` 保留原件。
- 已確認：loopback probe 成功，外連測試 socket 明確為 `EPERM`；model 已存在、未觸發 pull；隔離 daemon stopped、port closed、temporary root removed 全數通過。這說明驗收 wrapper 的 isolation／cleanup 子範圍沒有在本次 run 失敗。
- 診斷：同一模型另一次 loopback-only product probe 在 240 秒等待上限以 `實際 Ollama AI 任務等待逾時` 失敗（`2026-10-28-ollama-llama3.2-3b-product-live-diagnostic1.json`），沒有保存 raw model response，故目前不能判定是 strict parser、模型輸出契約、模型推理時間或 Ollama runtime 的唯一根因。只讀 `ollama ps` 看到 3B runner 載入，未停止桌面 daemon。
- 處置：本輪不修改 source、不放寬 cue contract、不改 timeout／retry／repair、不下載模型、不覆蓋 fail evidence；先將結果限縮為目前本機／目前 3B／單次 product flow failure，保留 isolation／cleanup 通過證據。
- 後續風險：BUG-058 的 deterministic abort／cancel／release 修正仍有 focused／full regression，但尚未由本次 live failure 證明或否證；FR-021 的 Electron UI、取消／續跑、不同模型／版本、Windows、真正斷網與完整流程仍未驗收。
- 治理結案：round1 判定 product acceptance 不通過；round2 以有條件通過確認失敗結果與非完整驗收界線已如實同步，條件已由主要代理完成 round2 quote／link 與 `npm run docs:check:final`。此結案只關閉本次診斷紀錄，不改變 product AI flow failure 或 FR-021 未完成狀態。

### BUG-058：Ollama strict parser failure 未先 abort underlying request（2026-10-28；已修正，round2 獨立複審有條件通過）

- 現象：BUG-057 的 250ms bounded cleanup 可讓 caller 返回並 release lock，但 strict decoder／NDJSON parser failure 進入 `reader.cancel()` 前未主動 abort 同一個 fetch request；若 cancel promise pending，底層 response teardown 缺少明確的上游停止訊號。
- 根因：`readStreamingJson()` 只持有 reader 與 timeout re-arm callback，沒有接收 request-local abort callback；failure cleanup 因而只能等待／超時 cancel，無法先通知底層 fetch body。
- 修正：`requestAiJson()` 將同一 `timeoutController` 的 abort callback 傳入 `readStreamingJson()`；strict `AiProviderError` failure 在 bounded cancel 前 best-effort abort，接著保留既有 250ms race、`releaseLock()` 與原始錯誤分類。正常 EOF、provider error 與 non-strict path 不額外 abort。
- focused／完整驗證：`scripts/test-ai-providers.mjs` 以 fake reader 覆蓋正常 EOF signal 不 abort、strict invalid UTF-8 failure abort signal、strict invalid-NDJSON `abort → cancel → release` 順序、cancel 永不 settle 後 release、reader timeout／cleanup failure 的 `timeout` 分類；既有 strict encoding／framing、provider error、非 strict compatibility、`npm run check`、`node scripts/test-project-docs-validator.mjs`、`git diff --check`、round1／round2 獨立審查與 `npm run docs:check:final` 均通過。
- 剩餘風險：abort 是 teardown best-effort，不代表 live Ollama／OS stream 已完成物理資源回收；模型品質、斷網、Windows 與 FR-021 仍不在本輪。

### BUG-057：Ollama strict reader cancel 永不 settle 會阻塞 cleanup（2026-10-22；已修正，round2 獨立複審有條件通過）

- 現象：BUG-056 已讓 failure path best-effort cancel 並 release reader lock，但 `await reader.cancel()` 沒有上限；若底層 cancel promise 永不 settle，原始 invalid encoding／transport／取消錯誤不會及時返回，`releaseLock()` 也不會執行。
- 根因：cleanup 把 cancel 的完成與 lock release 串行綁定，未區分「cancel 已拒絕」與「cancel 永久 pending」；前者可捕捉，後者會讓 `finally` 永久等待。
- 修正：`readStreamingJson()` 對 failure-only `reader.cancel()` 加入固定 250ms `Promise.race`；cancel rejection 及 timeout 都不改寫原始錯誤，timeout 後繼續 release lock；正常 EOF 不啟動 cleanup timer。
- focused／完整驗證：`scripts/test-ai-providers.mjs` 以 fake reader 覆蓋 cancel 永不 settle 的 watchdog、固定 250ms cleanup timer、正常 EOF 不建立 timer、reader-path timeout 在 cancel／release failure 下保留 `timeout`、decoder failure、reader rejection 與外部取消；既有 strict encoding／framing、非 strict compatibility、`npm run check`、`node scripts/test-project-docs-validator.mjs`、`git diff --check`、round1／round2 獨立審查與 `npm run docs:check:final` 均通過。
- 剩餘風險：固定 250ms 只保護錯誤返回與 lock release 的 deterministic latency，不代表 live Ollama／OS stream 在 timeout 後已完成所有底層資源 teardown；模型品質、斷網、Windows 與 FR-021 仍不在本輪。

### BUG-056：Ollama strict reader failure 後未明確釋放／取消（2026-10-22；已修正，round2 獨立複審有條件通過）

- 現象：BUG-055 已讓 strict Ollama reader 對 invalid UTF-8、reader rejection 與外部取消保留正確錯誤分類，但原始 `readStreamingJson()` 沒有專門的 `reader.cancel()`／`releaseLock()` cleanup；failure path 的 body lock／串流資源生命週期未被 deterministic probe 證明。
- 根因：reader loop 直接以 `return` 結束，沒有用完成狀態區分正常 EOF 與例外離開，也沒有在 decoder／transport／abort failure 後執行 best-effort cleanup；cleanup 若失敗亦未定義不可遮蔽原始錯誤的邊界。
- 修正：`readStreamingJson()` 使用完成旗標；正常 EOF 僅 release lock，failure／取消／reader rejection 則先 best-effort `await reader.cancel()`，再 always release lock；cancel／release exception 均捕捉，不覆蓋 `ollama_stream_invalid_encoding`、timeout／取消或 `network_error`。
- focused／完整驗證：`scripts/test-ai-providers.mjs` 以 fake reader 覆蓋正常 EOF 不 cancel 但 release、decoder failure cancel／release、reader transport failure 即使 cancel／release 自身失敗仍保留 `network_error`、外部取消 cancel／release；既有 strict encoding／framing、非 strict compatibility、`npm run check`、`node scripts/test-project-docs-validator.mjs`、`git diff --check`、round1／round2 獨立審查與 `npm run docs:check:final` 均通過。
- 剩餘風險：尚無真實 Ollama raw response、不同模型／版本或 Windows evidence；本 deterministic lifecycle 修正不代表模型品質、斷網或 FR-021 整體驗收完成。

### BUG-055：Ollama 無效 UTF-8 被 decoder 替換或 EOF 吞掉（2026-10-22；已修正，2026-10-29 bounded closeout）

- 現象：Ollama native NDJSON strict parse 只檢查 `JSON.parse`；共用 `TextDecoder` 預設會將無效 UTF-8 替換為 `U+FFFD`，且串流結束沒有 flush decoder state，可能讓 invalid byte 或 EOF 未完成 sequence 不被視為 framing failure。
- 根因：streaming byte decode 沒有 provider opt-in 的 fatal UTF-8 policy，也沒有在 EOF 驗證 pending decoder bytes；NDJSON JSON 語法驗證因此無法涵蓋 byte-level corruption。
- 修正：`readStreamingJson()` 新增 opt-in `streamOptions.strictEncoding`；strict path 使用 fatal UTF-8 decoder，逐 chunk 與 EOF flush 失敗時建立不可重試的 `AiProviderError`，使用指定 `invalidEncodingCode`；strict response 沒有 `arrayBuffer()` 時建立指定 `encodingUnavailableCode` 並 fail-closed，不回退 replacement-capable `text()`；`arrayBuffer()` 讀取保持在 decoder try scope 外，abort／timeout／transport rejection 交回既有 request error 分類。Ollama native path 啟用 `ollama_stream_invalid_encoding`／`ollama_stream_encoding_unavailable`，其他 provider 維持既有非 strict decode 行為。
- focused／完整／獨立驗證：`scripts/test-ai-providers.mjs` 覆蓋合法跨 chunk UTF-8、invalid byte、truncated final sequence、無 byte reader 與 fallback abort／timeout／transport rejection；`scripts/test-ollama-batch-stream.mjs` 以 optimizer product path 驗證只呼叫一次、無 repair／retry 且無 checkpoint；既有 malformed NDJSON、provider error、timeout／取消、指定 `node --check`、完整 `npm run check` 與 `git diff --check` 均 exit 0。round1 獨立審查報告為 `docs/project-management/reviews/2026-10-29-bug-055-ollama-strict-utf8-next1-round1.md`，結論有條件通過；唯一 finding 為治理 closeout 欄位，已由主要代理回填 08，未發現 BUG-055 source／test／optimizer blocker。
- 剩餘風險：尚無真實 Ollama raw response、不同模型／版本或 Windows evidence；非 strict provider 保留既有 decoder 相容行為，且本修正不代表模型品質、斷網或 FR-021 整體驗收完成。

### BUG-054：Ollama malformed NDJSON 被靜默丟棄（2026-10-21；已修正，待完整 check 與獨立審查）

- 現象：共用 NDJSON merge 對無法 `JSON.parse` 的非空 line 直接丟棄；Ollama native stream 若只有 malformed line 會落成空內容並可能進 `empty_content` repair，若前後有合法片段則 malformed framing 可能被掩蓋。
- 根因：streaming transport 原先只提供寬鬆 record merge，沒有由 Ollama native path opt-in 的 framing validation；模型 JSON 內容 repair 與 transport NDJSON framing 沒有分界。
- 修正：`mergeStreamingRecords()`／`readStreamingJson()`／`requestAiJson()` 增加 opt-in `streamOptions.strictJson`；Ollama native adapter 啟用 strict mode，非空 malformed line 建立 `AiProviderError`，code 為 `ollama_stream_invalid_json`、`retryable=false`，在 parser／repair 前 fail-closed。其他 provider 維持既有非 strict 行為。
- focused 驗證：`scripts/test-ai-providers.mjs` 覆蓋 malformed-only、合法片段前後 malformed 與共用 transport 非 strict 相容性；`scripts/test-ollama-batch-stream.mjs` 以 optimizer product path 驗證只呼叫一次、無 repair／retry 且無 checkpoint；正常 Ollama streaming、BUG-053 provider error、timeout、optimizer 與 `node --check` 均通過。完整 `npm run check` 與獨立審查尚待執行。
- 剩餘風險：尚無真實 Ollama raw response、不同模型／版本或 Windows evidence；本修正只處理 HTTP 200 NDJSON 明確 malformed record，不代表模型品質、斷網或 FR-021 整體驗收完成。

### BUG-053：Ollama NDJSON 明確 error 被降成空內容（2026-10-21；已修正，round2 獨立複審通過）

- 現象：Ollama 原生 `/api/chat` 以 HTTP 200 回傳 NDJSON `{error: ...}` record 時，transport 仍回傳合併結果；native adapter 只讀 `message.content`，因此 provider error 可能被轉成空內容，optimizer 再誤走 `empty_content` repair。若先有部分 content，錯誤也可能被部分 JSON 掩蓋。
- 根因：共用 streaming record merge 會保留欄位但不負責 provider-specific failure semantics；Ollama adapter 沒有在 parser／repair 前檢查合併結果的 `error` 欄位。
- 修正：`optimizeOllamaNative()` 在讀取 streaming result 後，對非 null／undefined 的明確 `error` 建立固定 `AiProviderError`，code 為 `ollama_stream_error`、`retryable=false`，保留最多 500 字 provider detail；即使已有部分 content，也不得進 JSON parser、repair、retry 或 checkpoint。
- focused／完整驗證：`scripts/test-ai-providers.mjs` 覆蓋單筆 error 與部分 content 後 error；`scripts/test-ollama-batch-stream.mjs` 以 optimizer product path 驗證只呼叫一次、無 repair／retry 且無 checkpoint；正常 Ollama streaming、timeout、optimizer、`npm run check`、`git diff --check`、round1／round2 獨立審查與 `npm run docs:check:final` 均通過。
- 剩餘風險：尚無真實 Ollama raw response、不同模型／版本或 Windows evidence；本修正只處理 HTTP 200 NDJSON 明確 `error`，不代表模型品質、斷網或 FR-021 整體驗收完成。

### BUG-052：Ollama 空白 message.content 被誤分類為 invalid_json（2026-10-21；已修正）

- 現象：Ollama provider 回傳 `message.content` 為空字串、空白字串或缺少欄位時，parser 原先以 `invalid_json` 表示；錯誤訊息無法區分「沒有內容」與「內容不是有效 JSON」。
- 根因：`parseCompletionContent()` 只對 `undefined`／`null` 的空內容建立一般錯誤，空字串會繼續走 candidate extraction，最後落入 `invalid_json`；local repair policy 也沒有專門的空內容 code。
- 修正：所有沒有可解析文字且沒有直接 `cues` 的回應建立 `error.code=empty_content`；只有 `provider=ollama` 可因該 code 觸發一次既有 JSON repair，LM Studio 不新增此 repair 分支，非本機 provider 仍 strict failure。repair 後仍執行完整 cue validation，不接受空結果或寫入完成 checkpoint。
- focused 驗證：optimizer deterministic tests 已覆蓋 Ollama 空白／缺少 `message.content` 的成功 repair、repair 後仍空白的兩次請求／明確錯誤／無 checkpoint，以及非 Ollama 不 repair；`node --check`、optimizer／provider／Ollama stream focused tests、完整 `npm run check` 與 `git diff --check` 均通過。round1 獨立審查另完成空值與 post-repair boundary probe，唯一條件為 08 結案欄位，已由主要代理補正。
- 剩餘風險：尚無真實 Ollama raw response、不同模型／版本或 Windows 實機 evidence；本修正只改善錯誤分類與一次性格式修復，不代表模型品質、斷網或 FR-021 整體驗收完成。

### BUG-051：AI 校稿回應 JSON parser 過度依賴 `cues` wrapper／巢狀 candidate 邊界（2026-10-21；Ollama active path 已修正，LM Studio 僅保留 compatibility regression；待完整 check 與獨立審查）

- 現象／基準：GitHub `origin/codex/ai-cues-response-repair` 的修正指出，AI 校稿回應可能以 root JSON array、text-part、Markdown fence、周邊說明或 wrapper／巢狀 JSON 字串返回；原 parser 只接受有限的 `cues` 形狀，且 local provider 缺少 `cues` 時無法一致進入一次性修復。這會讓合法 cue payload 被錯誤判為 `invalid_json`／缺少 cues，或讓 parser 邊界不明確。
- 根因：回應內容抽取、JSON candidate 掃描、cue list 選擇與 local repair policy 沒有分層；root array 與 nested wrapper 的合法範圍也未被明確區分，response format decision 可能在 repair 時被覆寫。
- 修正：`lib/ai/subtitle-optimizer.mjs` 新增文字／text-part／wrapper candidate 抽取、BOM／fence／balanced JSON 掃描，以及只允許 root array 或明確 `cues` array 的 `findCueArray` 邊界；Ollama active path 與既有 LM Studio compatibility path 對缺少 `cues` 或 JSON 結構錯誤各最多 repair 一次，非 local provider 維持 strict failure，JSON Schema 保留 schema response format。`scripts/test-ai-optimizer.mjs` 增加正負向回歸與失敗 checkpoint 斷言；LM Studio 案例僅是既有相容性 regression，不是目前 active 驗收。
- focused 驗證：`node --check`（optimizer／test）、`node scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-fetch.mjs` 均 exit 0；完整 `npm run check` 亦 exit 0，含 19 份治理文件、核心 regression、AI／Ollama suites 與 YouTube suites。`git diff --check` exit 0。測試通過固定 cue ID／時間碼／差異建議／進度與回應驗證，以及 nested unrelated array、nested root array、non-local strict failure 與 failed repair 不重試等 guardrails。
- 風險與界線：本輪 deterministic mock 只證明 parser contract、repair 次數與 provider 分流，不證明真實 Ollama 模型輸出品質、網路 endpoint、FR-021 完整本機人工流程或發布產物；LM Studio compatibility cases 不構成 active support／實機驗收；`npm run docs:check:final` 與獨立六面向審查完成前不結案。

### BUG-050：YouTube safeStorage 權限測試誤用 Unix mode bits 阻擋 Windows CI（2026-10-20；已修正，待 Windows CI 複驗）

- 現象／基準：Windows exact-source CI run `39308587730` 在 `npm run test:youtube` 的 `scripts/test-youtube.mjs:93` 失敗；`fs.stat(...).mode & 0o777` 實際為 438（`0666`），測試硬編碼預期 384（`0600`）。同一 source SHA `80a46a203dbfca34f26dc7c9545f9d9dac138e93` 的 Windows `docs:check` 與 `npm test` 中其餘 test scripts 均通過；此 failure 發生於 YouTube suite，workflow 後續 package／artifact 步驟 skipped。
- 近因／根因：測試將 POSIX `0600` mode 位元斷言無條件套用到 Windows。Windows `fs.stat().mode` 不提供等價的 POSIX ACL 判斷，`0666` 回報不能直接推論 Windows ACL 是否向其他使用者開放；不能據此將安全功能缺陷或安全通過下結論。產品程式 `lib/youtube/publisher.mjs:68-76` 仍先以 Electron `safeStorage.encryptString` 取得資料，再寫入含 `mode: 0o600` 的臨時檔並原子 rename。
- 修正：commit `1c045e7fff77049ff084126e3dc59e602fc60918` 僅修改 `scripts/test-youtube.mjs`：fake safeStorage 以不透明 fixture token map 供解密 round-trip；所有平台確認檔案是 opaque ciphertext、不包含 secret marker；僅 POSIX platform 精確驗證 `0600`，Windows 不把 `stat().mode` 誤當 POSIX ACL。產品 runtime 未改。
- 本機驗證：`node --check scripts/test-youtube.mjs`、`node scripts/test-youtube.mjs`、`npm run test:youtube` 及完整 `npm run check` 均 exit 0；完整回歸包含四組 YouTube posttest suites。Windows-specific branch 尚未由 Windows runner 執行。修正提交尚未推送，尚無同 SHA CI run／artifact；需獨立複審後推送驗證。

### BUG-049：1100×700校閱工作區子欄溢出／遮擋（2026-10-19；source修正，獨立審查見最新08）

- 本輪修正：workspace可收縮fr欄／窄工具列換行；主grid與sidebar/viewer/stage高度及獨立捲動；viewer rows改max-content，避免影片蓋住下一列播放鍵；長字幕focus不捲走header。
- 本輪驗證：source原生outer1100×700（content1100×668），editor.right1088，22控制可達及hit-test；另8尺寸、AI展開／長文字、root scrollY0通過。最終v10 evidence及06最新條目留證，僅source缺陷修復，不代表真實YT或安裝包驗收。

- 下列為修正前診斷基準，保留原始失敗及歸因界線：

- 重現：`verify-youtube-ui.mjs <新截圖路徑> --compare-installed --validate-usability`；以本機已安裝0.51.0前端與source，同source殼/API fixture與viewport。v3 comparison.json及source／installed-review-1100.png留證。
- 觀察：source editor.right1189、cueList.right1187超出1100；viewer/editor.bottom771超出700，左側video還覆蓋右側部分內容。已安裝前端同場editor.right同為1189，不能描述成YT新增獨有回歸。
- 近因：workspace兩欄最小寬度、viewer/video最小尺寸與可用寬度不相容；頂列grid可收縮不等於children可收縮。未獨立窮盡所有media query與原生resize，根因範圍以當前CSS及量測為限。
- 處置：本輪只診斷，未改產品。建議後續先保留現有外觀，針對窄視窗降低欄位min-width／切換單欄，新增全workspace與關鍵控制可視性驗收；未取得修正要求前不實作。BUG-048只代表頂列修正，BUG-049另列未完成。

## 2026-10-19 BUG-046／047／048 source 修正

- BUG-046：沿用現行 review-button；dialog 改固定 header／footer、獨立捲動 body，主要操作不再位於長表單最下方。支援尺寸、Tab／Escape／焦點／Enter 已由隔離 Electron 驗證。
- BUG-047：錯誤與進度分離，不隨 poll 清除；generation／revision 拒絕過時結果；受控 IPC 與缺 OAuth 錯誤跨 poll 保留。
- BUG-048：兩處 body min-width1180 改1100；main 明確 minmax(0,1fr) column，避免 workspace implicit min-content 撐大頂列。1100寬入口right1076；不能把原始缺陷單獨歸因 YouTube。
- 驗證證據：06 本日條目與 fixed-v7 PNG／JSON。下方2026-10-16「未修正」是歷史診斷，非本日狀態；source修正不代表安裝包或真實Google驗收。

### BUG-046：YouTube modal 介面一致性與主要操作可發現性（2026-10-16；未修正）

- 可用性 audit v2：既有匯出按鈕為 14px／700／8px 圓角，新 modal 為 16px／一般字重／0px 圓角。`youtube-publish.mjs` 未沿用 review-button／既有 dialog 視覺樣式；本機 v0.51.0 bundle 與 source styles.css hash 相同，review.html 僅新增入口／module。
- 1400／1280／1100×800 下 modal clientHeight=678、scrollHeight=1098，初始 primary top=1007.83、關閉 top=1090.83，須捲動才可見。不是按鈕不能點，而是初次使用缺少持續可見的主要操作與關閉入口。
- 建議：沿用既有 modal／button styles，精簡或摺疊開發者設定說明，固定 header／footer；本輪只診斷，產品未改。

### BUG-047：YouTube 操作錯誤被輪詢覆蓋（2026-10-16；未修正）

- 在未匯入 OAuth 的隔離 profile 點連結，main 拒絕且不開瀏覽器／不送 Google；UI 先顯示通用錯誤，1.9 秒後顯示「準備上傳。」。根因為 refresh 無條件覆寫 progress，無獨立保留操作錯誤狀態。
- 證據：`evidence/2026-10-16-youtube-usability-audit-v2.png.json` 的 errorImmediately／errorAfterPolling。建議以固定錯誤分類及持續錯誤狀態呈現，直到下一次使用者操作／實際狀態改變；本輪未修正。

### BUG-048：最小視窗寬度下校閱頂列溢出（2026-10-16；歸因未定／未修正）

- Electron minWidth=1100；audit 在1100下測得YT入口right=1177，超出視窗77px。測試同一DOM暫隱藏YT入口後舊匯出right仍1177，故不能歸因為新增YT按鈕的獨有回歸；1024亦測但低於支援最小寬度，僅壓力證據。
- 建議後續比對同一viewport的正式版實際畫面並修正既有頂列responsive，不把本輪量測誇稱為完整安裝版對照；本輪不修改舊版介面。
- 歸因限制：隱藏YT仍溢出只證明不是YT入口的獨有問題；未同場啟動正式bundle重播，不能斷言使用者現行版本也必然有相同溢出。量測採CDP renderer viewport模擬，非原生BrowserWindow resize／OS縮放驗收。

2026-10-16：本輪 BUG-043／044／045 已由 `reviews/2026-10-16-fr-027-youtube-private-upload-round2.md` 六面向複審確認原阻擋解除，final docs gate 通過；結論限 source MVP 與本地驗證，不代表真實 Google／Keychain／封裝／Windows 驗收。

### BUG-043：FR-027 上傳與專案刪除生命週期未協調（2026-10-16）

- 現象／基準：round1 獨立報告 B1 重現影片回應等待期間移除 job，原 persist 的 recursive mkdir 重建已刪目錄。
- 根因：publisher 屬 Electron main，server deleteJob 僅管理 server 內的工作；跨行程沒有共同 lease，且 persist 具建立根目錄副作用。
- 修正：main 透過具 token 的 API 取得／釋放 server lease，server DELETE active job 回 409；persist 不 mkdir job，config 層發布 history 保留遠端 ID／未知結果。初次紀錄 exclusive-create；強制外部刪除後不續傳字幕、不重建目錄。
- 回歸：`scripts/test-youtube-lifecycle.mjs` 真實隔離 server HTTP 測試 acquire／重複 acquire／錯誤 release／DELETE 409／完成 release 後 DELETE 200；另受控外部刪除確認 root 不復活、字幕呼叫不增加、history 留下 videoId。與完整 `npm run check` 通過；不代表真實 Google 驗收。

### BUG-044：FR-027 SDK multipart 未轉送來源 stream error（2026-10-16）

- 現象／基準：round1 B2 以實際 SDK＋不存在 snapshot 重現 Node unhandled error／exit 1；不是已實測的 Electron crash。
- 根因：官方 multipart 使用 pipe，來源 ReadStream error 不會自動 reject 外層請求；原實作未自行接管來源錯誤。
- 修正：requestWithMedia 先註冊 source error／abort，錯誤時中止請求，等待 source 關閉並有界觀察 transport rejection，去除原始錯誤；已取得影片 ID 保留為 partial，不建立新影片。
- 回歸：`scripts/test-youtube-streams.mjs` 以實際 SDK 本地 transport 測影片／字幕 ENOENT 與 mid-read 四案，確認無未處理事件且 source／transport 關閉；lifecycle suite 驗證 partial／videoId／解鎖／字幕重試。

### BUG-045：FR-027 缺少影片 ID／字幕狀態直接呈現（2026-10-16）

- 基準：round1 B3 指出工作 completed 無法區分 insert 回應 syncing／serving，且沒有直接顯示 videoId。
- 修正／驗證：新增 textContent identifiers，顯示 videoId、captionId、captionStatus；隔離 Electron UI verifier 實測 completed＋syncing 與 partial＋failed，並改用 owned dynamic debugger。v3 screenshot 與本輪獨立複審追蹤於 08。

### BUG-037：deny-network 外層 Seatbelt 阻斷 Chromium 子 profile 載入（2026-10-01；驗收環境相容性）

- 現象與證據：既有 packaged UI offline replay11 在 Electron 啟動階段以 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` 失敗。`scripts/accept-macos-seatbelt-nested-profile-canary.mjs` 將 parent／child profile 與 argv 明列，replay3 四案通過：strict／strict exit 0；strict parent 拒絕 network-service-shape child（71／EPERM）；加明示 TCP／UDP 的窄 parent 仍拒絕（71／EPERM）；`allow default` parent 接受（0）。replay2 窄 parent 預期成功但實際拒絕的原始 fail evidence 保留。
- 根因判定邊界：canary 只執行 `/usr/bin/true`，並非 Chromium exact generated profile。2026-10-02 追加核對以 replay11 executable SHA-256、稽核所記的 v0.51.0 候選 source commit 及該 commit lockfile，將候選版本鏈結至 Electron 43.3.0／Chromium 150.0.7871.212；round3 確認此為依候選稽核紀錄建立的靜態版本關聯，不是 replay11 JSON 內含的 source commit 或可驗證 binary provenance。同版 Chromium `network.sb` 的 remote TCP／UDP policy fragment 與 synthetic child shape 相符。2026-10-12 在保留 bundle 中找到與 replay11 executable SHA 完全相同的主程式，並量得同 bundle Electron Framework 43.3.0 binary SHA-256 `a6763870b706a065d621935435d82ea206747192b3948c8b17b7f5e2930c758a`；因 replay11 未保存 bundle path／framework SHA，這仍非 replay-time framework provenance。未保存整份 generated profile 及動態參數，故 source／policy 關聯與目前 framework hash 都不足以證明唯一根因；不代表 UI acceptance。本條是 acceptance isolation compatibility，不是已確認產品 runtime defect。
- 修正／處置：只新增可重播診斷腳本／證據與 Apple／Electron／Chromium source links；不改產品程式或 OS policy。允許 parent `(allow default)` 的 canary case 僅執行不連網 `/usr/bin/true`，不能用於 packaged UI 外連封鎖驗收；停用 Chromium sandbox 不接受。
- 來源引用邊界：canary script 的 Chromium `network.sb` reference 已固定到 `150.0.7871.212` versioned tag；mutable `HEAD` 只存在於既有歷史 evidence，保留原件但不再作新 evidence source。固定 source reference 不等於 replay-time binary provenance，也不改變 synthetic profile 非 exact generated profile 的判定。
- 驗證與後續：canary `node --check`、replay3、主代理完整 `npm run check` 通過；round2 reviewer 親自執行 canary `node --check`（2026-10-01 09:21:22 UTC，exit 0），未重跑 tests／canary／app。2026-10-02 06:10 UTC 只讀核驗候選 commit lockfile、replay11 failure identity 與 Chromium versioned source；Chromium tag `150.0.7871.212` 固定至 commit `69bf1c67cb894365d151bd020bb0171fd583633a6`，`network.sb` blob SHA-1 `58477d8d17902258b3f361d72751a32c034e0645`。2026-10-12 靜態 bundle identity evidence `docs/project-management/evidence/2026-10-12-fr-021-replay11-electron-framework-identity.json` 記錄目前 executable-hash-matching bundle 內 framework hash、version、mtime 與 codesign 驗證；未證明 replay-time framework identity。round3 獨立報告 `docs/project-management/reviews/2026-10-12-fr-021-macos-packaged-electron-ui-deny-network-sandbox-boundary-diagnostic-round3.md` 第 37 行有條件通過，範圍限靜態版本／policy fragment 關聯，並確認 replay11 JSON 未含 build provenance；round3 未執行 app、canary、Ollama 或 OS network probes。Apple `NEFilterDataProvider`／Xcode docs 將 system content filter 列為需 Network Extensions／Content Filter capability 的途徑；本輪未配置該 capability／filter。source pin 不解除 exact generated profile／實際 egress UI acceptance 阻擋，本輪 static bundle identity 補記已完成。若要真實 UI egress 驗收，須另行取得 per-app egress control 與 rollback 的明確授權；`FR-021` 仍未完成。

### BUG-038：macOS Seatbelt canary 無參數時延後至 evidence write 才失敗（2026-10-14；診斷工具可維運性）

- 現象與證據：canary 未提供輸出路徑時預設使用既有 `2026-10-01-macos-seatbelt-nested-profile-canary-replay2.json`；2026-10-14 基準執行仍先完成 sandbox case，最後因 exclusive-create 回報 `Evidence file already exists; refusing to overwrite.`、exit 2。
- 根因：輸出路徑 fallback 指向歷史 evidence，路徑／檔案存在檢查位於四案執行之後；無參數呼叫沒有先明確拒絕。
- 最小修正：移除歷史 replay2 fallback，要求呼叫者提供新的 `.json` 路徑；在任何 macOS／sandbox／case 檢查或執行前，缺少路徑即固定錯誤訊息並 exit 2。明確路徑仍經 evidence directory／`.json` 檢查，寫入仍採 exclusive-create。
- 防回歸：無參數命令應在不新增 evidence、不中止／啟動任何 sandbox case 前 exit 2；明確新路徑 replay4／後續 replay 維持四案結果、pinned source references 與 scope flags。此項只修診斷工具，不是產品 runtime 或 FR-021 acceptance 修正。

### BUG-039：replay11 未保存 Chromium exact generated profile（2026-10-14；證據完整性／驗收環境）

- 現象與證據：唯讀 audit `docs/project-management/evidence/2026-10-14-fr-021-replay11-exact-profile-feasibility-audit.json` 核對 replay11、offline／packaged UI runner source 與既有 static bundle identity。replay11 有 startup failure／cleanup／candidate executable hash／outer profile ID，但沒有 serialized Chromium child policy、generated child argv、Framework hash、source commit 或 build provenance。
- 判定邊界：runner source 只建立外層 Seatbelt profile 與 synthetic launch argument；既有 replay3／replay4／replay5 的 profile strings 是 `/usr/bin/true` synthetic canary，pinned Chromium `network.sb` 只是來源對照，均不能當作 replay11 的 exact generated profile。目前 hash-matching bundle 的 Framework 測量也不能倒推 replay-time bytes。
- 處置：不修改產品 runtime、Electron、Chromium、OS policy 或既有 evidence；新增非敏感 audit evidence，將「在 audited artifacts 中不存在且不可重建」固定為 FR-021 packaged UI offline acceptance 的 evidence blocker。這不是已確認產品 runtime defect 修正，也不代表唯一 root cause 已確定。
- 防誤判：本 audit 沒有啟動 packaged Electron／Ollama、沒有 network probe、沒有使用 `--no-sandbox`、沒有修改 OS network；後續若要取得 exact profile／replay-time provenance，需另行授權 instrumented packaged run 或等價的保存 trace。

### BUG-040：instrumented packaged-run evidence contract 尚未具備（2026-10-14；驗收工具／證據準備度）

- 現象與證據：`docs/project-management/evidence/2026-10-14-fr-021-instrumented-packaged-run-readiness-audit.json` 唯讀核對兩支 UI runner、`electron/main.mjs`、package metadata 與 replay11。packaged runner 只在記憶體建立 outer sandbox／launch argv，child stdout／stderr 暫存後只轉成固定 diagnostic categories；offline wrapper 也未保存 raw UI runner output。replay11／既有 static identity 沒有 outer argv、Framework hash／build provenance 或 exact generated profile。
- 近因與根因邊界：目前可增加的是 runner-level candidate identity、redacted argv、bounded diagnostics 與 evidence schema；Chromium runtime-generated child profile 不在目前 app-level capture contract 內，不能由現有 source／evidence 推導。這是驗收證據準備度缺口，不是已確認產品 runtime defect。
- 處置：不修改產品 runtime、Electron、runner、Chromium 或 OS policy；新增 readiness audit evidence，列出未來若取得授權所需的 fixed candidate、Framework／build provenance、redacted argv／diagnostics、exact profile or equivalent trace、exclusive evidence、cleanup 與 rollback 條件。
- 防誤判：本輪未啟動 packaged Electron／Ollama、未重跑 canary、未建立 network probe、未使用 `--no-sandbox`、未修改 OS network；readiness `partial` 不代表 packaged UI offline acceptance 或 FR-021 結案。

### BUG-041：acceptance runner 缺少可持久化 outer provenance fingerprint（2026-10-14；驗收工具）

- 現象與證據：BUG-040 readiness audit 顯示 runner 僅在記憶體建立 outer command／argv，保存 executable hash，child stdout／stderr 只降為固定類別，沒有把 runner-level provenance 以 evidence schema 欄位保存。
- 最小修正：live runner evidence 升為 v4，加入去敏 `launch` summary、outer sandbox 套用旗標、candidate Electron Framework pre-launch SHA-256，以及 capped child-output SHA-256／byte length／固定 categories；offline wrapper 加入格式白名單後的 `runnerProvenance` projection。raw child output、secret-shaped env、使用者／暫存路徑均不保存，且不加入 `--no-sandbox`。
- 判定邊界：這只補 runner-level pre-launch／bounded diagnostic trace，不能倒推出 replay-time loaded bytes、Chromium exact generated profile、build provenance、唯一 root cause 或 packaged UI acceptance；既有 replay／evidence 不覆寫。
- 防回歸與驗證：source-contract assertions 覆蓋 schema v4、Framework／diagnostic／sandbox 欄位、raw output exclusion 與 wrapper projection；三支相關 MJS `node --check`、focused offline UI test、完整 `npm run check`、`git diff --check` 與 final docs gate 應全部通過。本輪不啟動 packaged Electron／Ollama acceptance、不建立 network probe、不修改 OS policy。
- round1／round2 複審修正：candidate artifact read failure 不再把 `EACCES` 等底層可變 code 當成 evidence 契約，固定以 `CANDIDATE_ARTIFACT_READ_FAILED` 同時作為 `error.code`／`failureCategory`；VM regression 改驗證固定值，cleanup 與 raw-path 不洩漏邊界維持。

### BUG-042：offline wrapper argv projection 未在保存邊界重新驗證去敏格式（2026-10-14；驗收證據契約）

- 現象與風險：BUG-041 完成後，offline wrapper 對 live runner `launch.argv` 只做字串型別／長度／數量限制；若未來 runner argv 組成改變，使用者／暫存路徑或 secret-shaped value 可能在 projection 邊界重新進入 evidence。
- 最小修正：新增 `lib/runner-provenance.mjs` 純函式 allowlist re-sanitizer，offline evidence schema 升為 v5；只保存固定去敏旗標、受限 debug port、已知環境名稱的 `<redacted>` token 與受限 candidate basename。未知 item、超長 item 與超過 32 項的尾端只增加 `argvDroppedCount`，不保存原值；`argvRedactionValidated` 只有所有輸入都通過且未截斷時為 true。
- 防回歸與界線：focused test 直接驗證合法投影、private path、secret-shaped value、未知 flag、缺少 argv 與不洩漏 raw value；source contract 驗證 schema v5 與欄位存在。這只強化 wrapper 保存邊界，不代表 live runner replay-time argv、exact Chromium generated profile、binary provenance 或 packaged UI acceptance；本輪不啟動 packaged Electron／Ollama／network probe、不修改 OS policy。

### BUG-036：UI acceptance artifact 讀取逃逸清理與 daemon 啟動總期限缺口（2026-10-01）

- 獨立重現：round1 reviewer 的 actual runner VM 在 spawn／temp 後令 artifact read 拋 EACCES，觀察 cleanupCalls=0；local HTTP trickle fixture（20ms 傳一段）令 timeoutMs=50 的 daemon gate 在 259ms 成功，超過總期限。
- 修正：artifact hash 讀取移入主 try/finally，固定 artifact_preflight stage，失敗仍保存去敏 evidence、停止 group、刪除並確認 temp；tags 使用剩餘 startup deadline 的 absolute timer、不因 body 流量延長，成功後再核對期限，body 限 1 MiB。
- 防回歸：`test-ollama-ui-offline.mjs` 在記憶體執行完整 actual runner，斷言 artifact EACCES 仍清理 app／temp、保存 fail 與 stage／code、不保存 path canary；actual helper 搭 local HTTP trickle fixture，斷言 deadline fail closed。原始 round1 報告及所有 replay 不改寫。

### BUG-035：AI 取消後 checkpoint 恢復按鈕可能被舊輪詢回應隱藏（2026-10-01）

- 重現：`node scripts/test-review-ui.mjs` 的實際 UI 函式 VM 回歸先安排 GET in-flight，再完成 cancel POST，最後釋出舊 `running` 回應；修補前 assert `resumeAiOptimize.hidden === false` 失敗（actual true）。這是受控競速重現，不宣稱每次實機取消都會發生。
- 根因：成功取消只呼叫 `setAiRunning(false)`，使舊 poll 在收到 stale running 後退出；原 cancel handler 未重新讀取終態／retryable，因此恢復按鈕可能保留啟動時的 hidden。
- 最小修正：成功取消後以既有 `restoreAiOptimizationStatus({ silent: true })` 確認伺服器 checkpoint／retryable 控制，不依賴舊 poll 終態分支；不修改 server、checkpoint 結構、模型驗證或來源字幕。
- 防回歸：實際執行 `setAiRunning`、poll、restore、cancel 四函式，涵蓋可續跑 checkpoint、零 checkpoint 與 cancel HTTP 拒絕；拒絕取消不停止現有輪詢、不隱藏 cancel。另建立當前 dirty worktree 的隔離 macOS 目錄候選進行真實 Ollama UI 驗收，與舊 `53956cc` candidate 證據分開。
- round1 延伸修正：reviewer 重現成功 resume 後才抵達的 stale cancelled 會停止新 poll；新增 `aiPollingGeneration`，每次 running 狀態切換使旧 token 失效，poll 在等待前後核對 generation，旧終態不得覆寫新任務。持久 VM regression 另測 stale cancelled／failed／completed，確認新 polling／cancel 控制保持 running，並可完成新 Session；既有三案保留。
- round2 延伸修正：restore GET 成功與失敗均核對 generation；superseded cancel 跳過舊訊息。Actual UI regression 在 cancel restore pending 時從真實 `runAiOptimize` 啟動新任務，晚到成功／失敗 restore 不影響控制、訊息及既有 Session，釋出新 poll 後新 Session 正常 completed。另重現 stale GET rejection 並補 guard；對 superseded start rejection 與目前任務 start／poll failure 分別測試，保留現任務錯誤回報。

### BUG-034：Ollama UI acceptance 誤選啟動畫面及缺少 socket validator binding（2026-10-01）

- 現象與證據：`2026-10-01-ollama-ui-cancel-resume-replay1.json` 在 UI flow 前以 `DEVTOOLS_TARGET_URL_REJECTED` 失敗，完整 cleanup 成功；packaged app 的 file:// splash 與首頁均含「字幕」標題，原 runner 先按標題選擇而命中 splash。另程式檢視發現 runner 使用 `isTrustedDevToolsWebSocketUrl` 卻未 import，真正首頁路徑會 ReferenceError 並被啟動重試 catch 吞掉。
- 最小修正：共用 `selectTrustedElectronPageTarget()` 只選取符合既有 `127.0.0.1` HTTP policy 的 app page，再驗證 exact-port loopback WebSocket；file://／remote pages 不會連線，沒有 main page 時繼續有界等待；不放寬 URL 或 socket whitelist。
- 防回歸：實際執行 selector，涵蓋 splash-only、splash 在首頁前、remote page 與錯誤 WebSocket port；保留原 connection-construction 拒絕測試，並以唯一 replay2 重做實機流程。此項為 acceptance tooling 缺陷，不是產品 UI 缺陷。

### BUG-033：Ollama 離線 acceptance daemon spawn error 未進入清理流程（2026-09-29）

- 日期／版本：2026-09-29／0.51.0 開發中。
- 現象與影響：round1 獨立審查指出，sandbox daemon child 的非同步 `error` event 未受控時，Node 可能在 wrapper cleanup／evidence 寫入前終止；屬 acceptance tooling 的啟動失敗邊界，沒有修改或證實產品 Ollama runtime 故障。
- 根因：`spawn()` 回傳後若 executable 啟動失敗，錯誤透過 ChildProcess `error` event 非同步發出；原 wrapper 只等待 `/api/tags`，沒有共用的 spawn／close lifecycle observer。
- 最小修正：新增 `lib/ai/managed-child-process.mjs`，保存 `spawn`、固定化 `error.code` 與 `close` 狀態；`stopManagedChild` 對 spawn failure 等待 close，正常啟動則有界 SIGTERM／SIGKILL 並等待 close。offline acceptance wrapper 使用該 helper，spawn failure 進入既有 failure／evidence／finally cleanup。
- 防回歸與驗證：`scripts/test-ollama-offline-process.mjs` 先使用確定不存在的 executable 驗證 helper 的 `started=false`、`ENOENT`、close 與 cleanup；再在 macOS 且 Seatbelt／Ollama／模型 store 可用時，以僅限 `NODE_ENV=test` 的 spawn-command seam 執行完整 wrapper subprocess，斷言 `SANDBOXED_OLLAMA_SPAWN_FAILED`、`ollama_start`、exit 1、daemon 未啟動與 evidence／port／temp cleanup。focused test、provider source-contract test、三項相關 `node --check`、完整 `npm run check` 與 `git diff --check` 均通過。post-fix 3B sandbox product replay 通過；post-fix 1B replay8／9 因輸出契約失敗，但兩案 sandbox 與完整 cleanup 均確認。
- 剩餘風險：fault injection 使用 test-only missing executable，不模擬真實 sandbox-exec 的 EACCES／Seatbelt policy launch failure；跨平台 runner 無 macOS prerequisites 時會保留 helper regression 並略過 wrapper integration 部分。本項只修 acceptance wrapper，不代表 FR-021 整體、全機斷網、Electron UI、cancel／resume、Windows 實機或模型品質已驗收。

### BUG-032：Windows CRLF 造成 Breeze 效能提示契約測試誤判（2026-09-23）

- 現象：GitHub Windows preview 的 `npm run check` 在 `scripts/test-breeze-asr.mjs:176` 失敗，錯誤為「應存在可測試的 Breeze 效能提示更新函式」；同一來源在 macOS LF checkout 可找到 `updateBreezePerformanceNotice` 並通過。
- 重現基準：`public/app.js` 的函式本身存在；現行 regex 結尾要求 `}\n\nfunction updateAsrEngineUi`。將相同 source 轉為 CRLF 後，`}\r\n\r\nfunction` 無法符合該 regex，造成 `noticeFunction` 為 `undefined`。這是測試讀取格式問題，不是產品函式缺失。
- 根因：source-contract test 直接以 LF-only regex 解析 checkout 的 `public/app.js`；Windows Git checkout 的 CRLF 行尾使函式邊界比對失敗。
- 最小修正：`scripts/test-breeze-asr.mjs` 讀取 `public/app.js` 後先將 CRLF 正規化為 LF，再執行既有函式擷取與 UI 行為 assertions；另以 LF→CRLF→LF fixture assertion 固定跨平台等價性。不改 `public/app.js`、產品 runtime 或 Breeze 行為。
- 開發驗證：現行 regex 的 CRLF 重放明確由 `lfMatch=true` 變為 `crlfMatch=false`；修正後 `node scripts/test-breeze-asr.mjs`、完整 `npm run check` 與 `git diff --check` 均通過。Windows preview run `35804611051` 於修正 commit `e8ccee8` 成功完成 source／FFmpeg regression、preview package、renderer／install lifecycle、archive／SHA-256 與 artifact upload。
- 防回歸：保留 CRLF fixture 重放，並以共用 `extractNoticeFunction` 直接驗證正規化後 CRLF source 可擷取 Breeze 函式；Breeze focused test、完整回歸與 Windows runner 均通過。Windows runner 成功不等同 Windows 實機驗收。
- 剩餘風險：本輪不執行 Windows 實機驗收、不驗證 Breeze 真實 runtime／模型品質；修正只涵蓋 source-contract 測試的換行可攜性。

### FR-020／NFR-006：長音訊來源完整性 probe 缺少輸入影片 hash 與故障注入（2026-09-23）

- 缺口：既有 evidence v3 只保存輸入影片 before hash，來源 SRT 雖有 before／after hash，卻沒有對 hash mismatch 或來源檔消失做故障注入。
- 最小修正：新增串流 snapshot helper；evidence v4 記錄影片與可選來源 SRT before／after SHA-256 及大小，將內容變更／after missing 與 hash check failure 分別列為失敗，保留不寫字幕內容的契約。
- 防回歸：`node scripts/test-whisper-long-media-integrity.mjs` 對 input-video／source-subtitles 各驗證 unchanged、同大小 hash mismatch、missing-after；`npm run acceptance:whisper:integrity-fault-injection` 再於實際 probe 邊界注入影片與 SRT 的修改／消失並核對 failure code、scope flags 與 temp cleanup。短合成 MP4 已重播 bundled probe v4 正常路徑，不重跑原始長片。evidence 分別見 `docs/project-management/evidence/2026-09-23-whisper-long-media-integrity-fault-injection.json`、`docs/project-management/evidence/2026-09-23-whisper-long-media-integrity-short-replay.json`。
- 剩餘風險：before／after hash 仍不能偵測期間發生後又恢復原內容的瞬態改寫；hash 相同也不代表來源字幕／Whisper 文字正確。長音訊語意品質、人工校閱、confidence／no-speech、真實 Metal crash→CPU fallback、Windows 與 Release 不由本項結案。

### FR-020／NFR-006：probe stderr evidence 隱私邊界補強（2026-09-23）

- 觸發觀察：round1 報告指出舊版保存 Whisper stderr tail 原文，缺少測試證明錯誤路徑不會把字幕內容寫入 evidence；報告同時明載其非獨立上下文且未重跑測試，因此僅作為待驗證的邊界觀察，不代表已證實實際 stderr 含字幕。
- 修正：新增 `whisper-long-media-evidence.mjs`，將 stderr 降為行數／診斷行數摘要，將 FFprobe／FFmpeg／Whisper process 啟動失敗及 exit 結果轉成不含原始錯誤文字的固定化 outcome；probe evidence schema 升為 v5，移除 `stderrTail` 欄位及子程序失敗時直接輸出原始 stderr／Whisper error 的路徑。
- 防回歸：`test-whisper-long-media-evidence.mjs` 把 transcript-like canary 放入 stderr 與 Error，驗證摘要及安全結果 JSON 不包含原字串；v5 bundled Tiny replay 與四案 probe-level fault injection 作為正常／失敗路徑驗證。
- 後續處理：round2 發現外層 catch 路徑與 cleanup fail-closed 缺口，已在下節補強固定化錯誤及刪除確認；round3 獨立複審與 final docs gate 仍待完成。

### FR-020／NFR-006：round2 發現自訂路徑洩漏與 cleanup fail-closed 缺口（2026-09-23）

- 獨立發現：round2 報告指出 catch 仍持久化 `error.message`，對 `/Volumes/...` 等自訂來源 SRT 路徑遮罩不完整；另 `tempRootRemoved=false` 未改成失敗狀態。報告把此列為可達風險，未宣稱已端到端重現。
- 修正：probe catch 改寫固定化 `PROBE_FAILED` 訊息，不再序列化 exception message／code；暫存移除後以 `lstat` 確認只有 `ENOENT` 才代表成功，其他狀態均令 evidence fail 並以 `TEMP_ROOT_CLEANUP_FAILED`／`FINALIZATION_FAILED` 回報。
- 防回歸：helper 測試注入 transcript-like custom path、`rmSync` throw、路徑仍存在及 `lstat` 權限錯誤；當時 probe-level harness 為 v8 五案，後續 basename／cleanup probe-level 補強詳見下節。
- 剩餘風險：驗收只能證明模擬 filesystem cleanup 結果與自訂路徑 fixture；不代表所有 OS 檔案系統故障皆可重現，也不涵蓋字幕品質、Windows 實機、真實 Metal fallback 或長片重播。

### FR-020／NFR-006：round3 隱私／cleanup 複審建議補強（2026-09-24）

- round3 結論：有條件通過；round2 兩項程式阻擋已修正。剩餘建議為來源 SRT basename 仍寫入 evidence，且 cleanup helper 未由 probe 子程序端到端 fault-inject。
- 修正：來源 SRT evidence 一律使用固定標籤 `source.srt`，不保存指定 basename；probe acceptance 增加 basename canary 與 Node preload cleanup failure 案。preload 先實際移除合成 temp root，再讓 lstat 回 EACCES，驗證 probe evidence／exit fail closed 且不殘留測試資料。
- 驗證：2026-09-24 v9 七案包含媒體／SRT 四種 integrity failure、自訂路徑 canary、basename canary、cleanup-unverifiable；各案及完整 `npm run check`、`git diff --check` 通過。round4 獨立審查代理未產出報告而停止，最新差異的複審與 final docs gate 尚未完成。
- round4 複審：`docs/project-management/reviews/2026-09-29-fr-020-long-media-integrity-fault-injection-round4.md` 判定有條件通過；條件是舊 preload 先刪除 temp root 再模擬錯誤，尚未驗證實際刪除失敗且目錄殘留的 probe 行為。
- round4 條件補強：harness preload 現在於刪除前讓 `rmSync` 真正拋出 EACCES，保留真實目錄供父 harness 以原生 `lstat` 驗證；確認後才清理並斷言 ENOENT。新 v10 evidence 記錄七案通過，cleanup 案為 evidence fail、`tempRootRemoved=false`、`TEMP_ROOT_CLEANUP_FAILED`、probe exit 1，並確認父 harness 已移除故障注入留下的目錄。兩個 focused tests、完整 `npm run check`、`git diff --check` 通過；新一輪獨立複審待完成。
- round5 複審：`docs/project-management/reviews/2026-09-29-fr-020-long-media-integrity-fault-injection-round5.md` 為有條件通過，指出 marker prefix 判斷不夠精確且 marker 無效／缺失時 harness 不一定能回收 temp root。
- round5 條件補強：移除 marker，將 probe temp-root 預先固定為隔離 cleanup case 的直接子目錄；preload 只攔截 `path.resolve(target) === path.resolve(OSF_CLEANUP_TARGET_ROOT)`，父 finally 直接清除確切目標並核對 ENOENT。v11 repo 外 replay 與持久 evidence replay 都七案通過，實際 root 在父清理前存在，probe failure evidence／exit 1 如預期；兩個 focused tests、完整 `npm run check`、`git diff --check` 通過。round6 原件因 final validator 格式錯誤保留；round7 獨立複審 `docs/project-management/reviews/2026-09-29-fr-020-long-media-integrity-fault-injection-round7.md` 有條件通過，重跑 focused tests、repo 外七案與文件檢查。工作紀錄已加入 round7 原句引用，`npm run docs:check:final` 通過並確認最新紀錄結案。未驗的原片品質、原生 OS 權限、Windows 實機、真實 Metal fallback 與 Release 仍不在本修正範圍。
- 剩餘風險：本輪只驗證受控 Node/macOS temp-root EACCES 注入，不涵蓋所有 OS／檔案系統故障模式；未重跑 5,416 秒原片、Windows 實機、真實 Metal fallback 或 Release。

### FR-020／NFR-006：bundled Whisper 長音訊來源 SRT hash 完整性補強（2026-09-21）

- 缺口：長音訊 evidence 原先以 `originalSrtModified=false` 宣告來源 SRT 未修改，但沒有保存 before／after hash，無法提供完整的檔案完整性比對。
- 最小修正：`verify-whisper-long-media.mjs` 接受明確來源 SRT 路徑，未提供時只在相鄰 `.edited.srt` 存在時採用；schema 升為 v3，保存來源 SRT basename／大小／before／after SHA-256 與檢查旗標，hash 不一致或檔案消失時回報 `SOURCE_SRT_MODIFIED`。
- 實測：短音訊與完整 `<user-home>/Downloads/20260909.mp4` replay 均 exit 0；完整 evidence 記錄來源 SRT before／after 均為 `4d5f5a53bb4eea7f5de5b428caefb38871771655166b12fccc613f3600f16482`、`sourceSrtHashChecked=true`、`originalSrtModified=false`，2,509 segments、非空 SRT／JSON、temp cleanup 通過。
- 剩餘風險：hash 完整性不代表字幕語意品質或 Whisper 與來源 SRT 的正確性；中文音訊品質、人工校閱、confidence／no-speech、真實 Metal crash→CPU fallback、Windows、乾淨安裝與發布仍未驗收。

### FR-020／BUG-WHISPER-METAL-139：bundled Whisper 長音訊 probe 摘要與隱私修正（2026-09-21）

- 現象：首版長音訊 probe 將 bundled Whisper JSON 假設為 `segments` 陣列，實際輸出使用 `transcription`，導致完整成功 replay 被誤判為沒有 segment；同版 evidence 也保存了 stdout 最後一段字幕文字，超出「只保存非敏感摘要」的設計範圍。
- 根因：probe 摘要器未兼容 bundled Whisper.cpp 的 JSON 形狀，且把為診斷保留的 stdout tail 原樣寫入 evidence。
- 最小修正：摘要器同時支援 `segments`／`transcription`，以 offsets／tokens 計算 segment、文字 code point、時間範圍與 token probability 統計；evidence schema 升為 v2，stdout 改保存 line count、timestamped transcript line count 與 `contentStored=false`，不保存字幕文字。
- 重播與驗證：`2026-09-21-whisper-long-media-small-redacted.json` 在 macOS arm64 受控權限完整跑完 5,416.349667 秒影片，exit 0、2,509 segments、非空 SRT／JSON、temp cleanup 通過；原 v1 含字幕尾端的中間 evidence 已移除。Node syntax、14 項 evidence assertions、完整 `npm run check`、`git diff --check`、獨立 round1 審查與 `npm run docs:check:final` 均完成。
- 剩餘風險：這是 runtime／輸出完整性基線，不代表中文品質、人工影音校閱、長音訊效能、confidence／no-speech metadata、真實 Metal crash→CPU fallback、Windows、乾淨安裝或發布驗收；LM Studio 依需求方決策未執行。

### BUG-WHISPER-METAL-139：production probe 啟動失敗診斷可觀測性（2026-09-21）

- 症狀：前輪預設 sandbox 的 bundled production server 在 ready 前 exit 0，原 probe 因 `stdio: ignore` 只留下 exit code，無法從 evidence 判斷 loopback 權限或其他啟動原因。
- 根因／範圍：問題位於 acceptance probe 的子程序輸出收集，不是產品 server fallback；本輪不修改 `server.mjs`、fallback policy、bundled runtime／模型。
- 最小修正：`verify-whisper-real-fallback.mjs` 改收集 child stdout／stderr，保存 PID、ready phase、exit code／signal 與固定長度遮罩尾端；API key／token／secret／Authorization／Bearer／Basic 與使用者／暫存路徑均先遮罩，schema 升為 v2。
- 重播結果：round2 預設 sandbox evidence `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-round2-default.json` 明確記錄 `listen EPERM`、ready=false、job 未建立；受控本機權限 evidence `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-round2-escalated.json` 仍完成 `ready-review`、Metal、無 fallback，且 token／credential／`/tmp/` leakage assertions 通過。round1 evidence 保留作為修正前對照。
- 防回歸／剩餘風險：Node syntax、兩側 replay、evidence assertions 與完整回歸需持續通過；診斷摘要仍不是完整 log，也不會產生真實 bundled Metal crash→CPU fallback 證據。中文品質、長音訊、Windows、乾淨安裝與發布仍未驗收；LM Studio 依需求方決策未執行。

### BUG-WHISPER-METAL-139：bundled production server Metal failure 邊界重播（2026-09-21）

- 現象：需確認前輪受控 wrapper→bundled CPU 取消之外，真實 bundled `whisper-cli` 在同一次 production server 中是否能重現 Metal failure 並自動 fallback。
- 重播條件：同一 macOS arm64 bundled `whisper-cli`／Tiny、同一 1 秒 16 kHz mono 合成 WAV、同一 `scripts/verify-whisper-real-fallback.mjs`；分別以預設 sandbox 與受控本機權限啟動 production server。
- 結果：預設 sandbox server 在 ready 前 exit 0，未建立 job，證據為 `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-default.json`；受控本機權限完成 `ready-review`、`whisperDevice=metal`、`fallbackObserved=false`，證據為 `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-escalated.json`。
- 根因／邊界判定：本次只能確認預設執行環境的 server loopback 啟動邊界與受控權限下 bundled Metal 正常路徑，沒有觀察到真實 bundled Metal exit／signal，因此不能宣稱 crash→CPU fallback；不修改產品程式。
- 剩餘風險：仍需在能穩定重現 bundled Metal crash 的同一 production server 環境取得 CPU fallback evidence；長音訊、中文品質、Windows、乾淨安裝與發布仍未驗收。LM Studio 依需求方決策未執行。

### BUG-WHISPER-METAL-139／BUG-026：production-mode bundled CPU retry 取消補驗

- 日期／版本：2026-09-18／0.51.0 開發中。
- 待驗缺口：deterministic child 已覆蓋 retry 期間取消，上一輪 hybrid 則只驗證真實 bundled CPU 正常完成；尚缺真實 CPU child 已啟動後經產品 API 取消與清理的證據。
- 探針設計：新增 `--cancel-bundled-cpu` 模式，使用 60 秒本機合成 WAV；CPU wrapper 在真實 child spawn 後寫 ready marker，API 取消時轉送 SIGTERM 並記錄 child close／forcedKill。probe 明確注入固定 partial SRT／JSON、quality metadata 與 edit plan 哨兵，以精確檔案不存在／保留斷言驗證清理；未修改 `server.mjs` 或 bundled CLI。
- round1 審查發現：正常取消雖通過，但取消 API 不可用時 probe 只停 server 並刪 temp，未確認 wrapper／CPU child close；這是驗收工具的失敗收尾缺陷，不是已觀察到的產品取消失敗。修正為獨立 process group 有界終止／確認消失後才清 temp；`kill(-pgid, 0)` 受權限邊界回 EPERM 時，以 `/bin/ps` 只讀核對該 PGID，無法確認則保留診斷 temp 並回報 failure。故障注入 `--simulate-cancel-api-loss` 在 CPU spawn 後跳過 API，記錄 `expectedFaultSafelyHandled`。
- 實測與防回歸：正常取消在最新 probe 下仍 `cancelled`，取消中先維持 `running/cancelling`，CPU child `signal=SIGTERM` 且無 forced kill，invocation 僅 `metal`／`cpu`，ASR 哨兵與暫存 WAV 清理、edit plan 保留；新 evidence 為 `docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-final.json`。API loss 注入預期 exit 1，但 wrapper／CPU close、groupGone 與 tempRootRemoved 均為 true，evidence 為 `docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-api-loss-final.json`。前輪 hybrid 完成與舊 controlled probe 在收尾改動後仍通過。
- 剩餘風險：Metal failure 仍由 wrapper 注入，partial 哨兵非真實 CLI 輸出，server 透過 wrapper 而非直接向 CLI 發訊號；真實 bundled Metal crash、長音訊品質／效能、中文語音、Windows、乾淨安裝與發布未驗收。round2 獨立複審通過；LM Studio 依需求方決策未執行。

### BUG-WHISPER-METAL-139：production-mode 受控 Metal failure 後 bundled CPU retry 補驗

- 日期／版本：2026-09-18／0.51.0 開發中。
- 待驗缺口：既有同次 production server fallback 由 deterministic fixture 提供 CPU 輸出；另一 bundled server probe 只觀察到 Metal 正常完成，尚未驗證控制流交給真實 bundled CPU 時是否完成。
- 最小探針：在既有隔離 production acceptance 增加 `--bundled-cpu` 模式；wrapper 只注入首次 Metal exit 139／partial outputs，CPU 分支記錄 invocation、檢查 stale partial、直接 spawn 固定 bundled binary 並記錄其退出結果。沒有修改產品 `server.mjs` 或 bundled CLI。
- 實測：macOS arm64 受控權限 hybrid probe exit 0；同次任務 `metal`／`cpu` 兩次 invocation、CPU binary exit 0、`completed/ready-review`、`whisperDevice=cpu`、draft／SRT／JSON 齊全且無暫存 WAV／stale partial。round1 審查指出原始 evidence 缺少工作紀錄要求的重播命令；保留原檔後重新產生 `docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback-replay.json`，包含 command、working directory 與環境前提。舊 controlled probe 與完整 `npm run check` 亦通過。
- 剩餘風險：首次 failure 並非 bundled Metal 真實崩潰，故同次真實 crash→CPU 門檻仍未完成；短靜音不驗證中文品質、長音訊、取消真實 CPU child、Windows、乾淨安裝或發布。LM Studio 依需求方決策未執行。

## 紀錄格式

每個缺陷記錄：`BUG-ID`、日期／版本、現象、影響、重現、根因、修正、驗證、防回歸、剩餘風險。

## 重要既有缺陷

### BUG-WHISPER-METAL-139：CPU fallback 再失敗殘留 partial outputs

- 日期／版本：2026-09-18／0.51.0 開發中。
- 現象／影響：macOS arm64 首次 Metal failure 進入 `--no-gpu` CPU retry 後，若 CPU child 也非零退出且曾寫入 partial SRT／JSON，任務會正確標記 failed，但固定輸出仍留在 working 目錄；後續診斷或重跑可能誤把失敗產物視為可用輸出。
- 修正前重現：deterministic fixture 依序執行 Metal exit 139、CPU exit 7，兩次都寫入 partial outputs；核心測試確認只有兩次 invocation 且任務已 failed，但 `whisper-cpp-output.srt` 實際仍存在，於清理斷言 exit 1。
- 根因：`runWhisperCpp` 的 Metal→CPU fallback 與取消分支會清理固定輸出，不再 retry 的 process failure 分支直接 reject，沒有套用相同清理契約。
- 修正：fallback 前與終止性 process failure 前共用 `removeWhisperPartialOutputs(workingDir, [outputBase])`；CPU retry 仍只執行一次，失敗 reason 原樣傳至 job message／log，清理只限固定 SRT／JSON 與 quality metadata。
- 驗證／防回歸：核心 child fixture 斷言 final status／stage 為 failed、metrics 為 CPU、message 含 exit 7、Metal fallback marker 保留、invocation 僅 `metal`／`cpu`，且 stale marker、partial SRT／JSON、draft 均不存在；focused core 與完整 `npm run check` 通過。證據為 `docs/project-management/evidence/2026-09-18-whisper-cpu-retry-failure.json`。
- 剩餘風險：尚未以真實 bundled runtime 重現 Metal crash 後 CPU 也失敗；取消與 retry 交界、長音訊、中文品質、其他 macOS 架構、Windows、乾淨安裝與發布仍未驗收。LM Studio 依需求方決策未執行。

### BUG-WHISPER-METAL-139／BUG-026：Metal→CPU retry 取消交界補驗

- 日期／版本：2026-09-18／0.51.0 開發中。
- 待驗風險：既有 BUG-026 已驗證一般 Whisper.cpp child 取消，Metal→CPU retry 後仍缺少 child 已執行時的取消整合證據；可能出現提早標記 cancelled、漏清 partial 輸出或取消後再啟動 child。
- 基準重播：fixture 首次 Metal exit 139，第二次 CPU child 寫 partial SRT／JSON 並安裝 SIGTERM handler 後寫 ready marker；測試等 marker 才透過 API 取消。現有產品程式三次核心重播均通過，未重現上述缺陷，故未修改 `server.mjs`。
- 驗證／防回歸：`scripts/test-core.mjs` 斷言 `running/cancelling`→child close→`cancelled`，精確兩次 invocation、CPU metrics、Metal fallback marker、SIGTERM／close marker、暫存音訊／partial／quality metadata 清理、無 draft 與非 ASR `edit-plan.json` 保留；完整 `npm run check` 通過。證據：`docs/project-management/evidence/2026-09-18-whisper-retry-cancellation.json`。
- 剩餘風險：本輪只補 deterministic CPU child 就緒後取消；真實 bundled runtime、Metal close callback 內不可插入窗口、Windows taskkill、長音訊、中文品質、乾淨安裝與發布未驗收。LM Studio 依需求方決策未執行。

### BUG-031：歷史 AI profile 秘密仍殘留一般設定檔

- 日期／版本：2026-09-16／0.51.0 開發中。
- 現象：BUG-029 已讓新保存路徑以 allowlist 排除 profile 秘密，但啟動載入只在 runtime 正規化；若既有 `settings.json` 已含 AI 根層 `apiKey`／Authorization／token／secret 或 profile 內秘密／未知 provider，磁碟明文不會被清除。
- 影響：API 與 runtime 雖不回傳這些欄位，歷史秘密仍可能留在一般設定檔、備份或支援診斷資料中，違反 NFR-002 的秘密隔離邊界。
- 重現：核心啟動 fixture 預置 AI 根層與 Anthropic profile 秘密；修正前在受控權限執行 `node scripts/test-core.mjs`，於「啟動遷移必須從一般設定檔移除 AI 根層歷史秘密」斷言失敗，實際磁碟字串仍存在。
- 根因：`loadSettings()` 只回傳 `normalizeSettings()` 結果，沒有把已正規化的 profile 或根層秘密清理結果持久化回原設定檔。
- 修正：啟動時建立窄範圍持久化遷移，刪除 AI 根層固定 secret-shaped 鍵名，以既有 profile allowlist 取代歷史 profiles 並移除未知 provider；只在內容改變時以同目錄 sanitized 暫存檔原子置換。非敏感未知 AI 根層欄位、合法 profile 與獨立 `ai-secrets.json` 保留，歷史明文不自動匯入 secrets；寫入失敗只記錄不含秘密內容的權限警告，runtime 仍採正規化值。
- 驗證：核心 fixture 驗證根層多種大小寫／分隔形式秘密、profile 秘密與未知 provider 從磁碟消失，合法 Base URL／model／batch／timeout、非敏感未知根層欄位及既有獨立 secrets 保留，且無 migration temp 殘留；Node 語法、核心整合、provider contract、差異格式與完整 `npm run check` 均通過。round1 因未完成獨立讀取而有條件通過，新的 round2 獨立上下文完成六面向靜態核對後判定通過，無阻擋問題。
- 防回歸：啟動 fixture 直接讀回遷移後 `settings.json` 與 `ai-secrets.json`，不只檢查 API 回應；後續新增合法 profile 欄位時必須同步 allowlist、遷移與測試。
- 剩餘風險：無法寫入一般設定檔時磁碟明文仍會保留，需依不含秘密值的警告修正檔案／目錄權限後重啟；本輪不掃描歷史備份、log、其他使用者目錄或 OS 安全儲存，也不驗證 Windows 真實檔案鎖定情境。

### BUG-WHISPER-METAL-139：SIGSEGV signal fallback 可觀測性缺口

- 日期／版本：2026-09-18／0.51.0 開發中。
- 現象／影響：Node child process 若被 `SIGSEGV` 終止，`close` callback 會收到 `code=null`、`signal=SIGSEGV`；既有 server 只把 code 寫成 `Metal exit null`，真實 acceptance probe 又只辨識 `Metal exit 139`，可能讓實際已發生並成功完成的 signal fallback 被 evidence 誤記為未觀察到。
- 根因：fallback policy 以 `exitCode !== 0` 隱含接受 null／字串等值，server 沒有接收 `close` 的 signal 參數，probe 將產品策略過度收窄成單一 139 marker；policy、日誌與 acceptance 判定不是同一份明確契約。
- 修正：抽出型別嚴格的 process failure contract；明確非零整數 exit 或非空 signal 才算失敗。macOS arm64 首次 Metal 嘗試會清理 partial outputs 並 CPU retry 一次，log 分別寫 `Metal exit <code>` 或 `Metal signal <name>`；exit 0、null 且無 signal、非數字 exit、已在 CPU retry 與其他平台／架構不 fallback。真實 probe 共用 parser，接受任一明確 Metal failure marker＋CPU fallback。
- 驗證：policy／log marker 矩陣 exit 0；核心整合以真實自我 `SIGSEGV` child 取得 `Metal signal SIGSEGV`，清理 partial SRT／JSON 後以 CPU 完成 `ready-review`，既有 exit 139 案例亦通過。production controlled exit 139 replay 與 bundled Metal normal-path replay 均 exit 0；證據為 `docs/project-management/evidence/2026-09-18-whisper-signal-aware-fallback.json`。
- 防回歸：`scripts/test-whisper-fallback-policy.mjs` 固定 exit／signal／invalid value／平台矩陣與 parser 假陽性；`scripts/test-core.mjs` 同時覆蓋 exit 139 與 signal SIGSEGV 的 partial 清理、CPU metrics、可觀測 logs 與最終 draft。
- 剩餘風險：本輪沒有在真實 bundled production server run 重現 crash→CPU fallback，deterministic signal／exit 案例仍不代表 runtime 實機；取消中的 retry、CPU retry 失敗、長音訊、中文品質、其他 macOS 架構、Windows、乾淨安裝與發布仍未驗收。LM Studio 依需求方決策未執行。

### BUG-WHISPER-METAL-139：child-process exit 139 fallback 整合回歸

- 日期／版本：2026-09-17／0.51.0 開發中。
- 現象／影響：既有策略單元測試只驗證 fallback 判斷矩陣，未直接覆蓋 `runWhisperCpp` 的 child 非零退出、partial 輸出清理與 CPU retry，容易讓控制流回歸未被核心 API 測試捕捉。
- 修正：新增 macOS arm64 專用 deterministic runner marker；首次非 `--no-gpu` 執行回傳 exit 139 並寫入 partial SRT／JSON，第二次 `--no-gpu` 執行成功；若 server 未先清理 partial output，fixture 會留下明確 stale marker 使測試失敗。未改真實 Whisper.cpp CLI 或 production fallback 策略。
- 驗證／防回歸：`scripts/test-core.mjs` 建立 fallback 任務並斷言 `ready-review`、`metrics.whisperDevice=cpu`、首次 139 marker、無 stale partial marker 與最終 draft SRT；macOS arm64 受控核心回歸已通過，既有 fallback policy／quality focused 測試亦通過。
- 剩餘風險：fixture 不代表 bundled Whisper.cpp 真實 Metal／CPU 行為；長音訊、取消中的 retry、Windows／其他 macOS 架構、乾淨安裝與模型品質仍未驗收。

### BUG-WHISPER-METAL-139：產品 server 真實 bundled path probe

- 日期／版本：2026-09-17／0.51.0 開發中。
- 現象／影響：直接 bundled CLI 對照可在目前 macOS arm64 收到 Metal allocation failure／`SIGSEGV`，但需要確認 production-mode server 的 child-process 控制流、輸出清理與正常完成狀態。
- 重現／探針：`npm run acceptance:whisper:fallback -- docs/project-management/evidence/2026-09-17-whisper-real-server-fallback.json`；probe 使用隔離 localhost server、非測試環境、本機生成 WAV 與 bundled Tiny，不使用使用者媒體或外部 endpoint。
- 實際結果：server 任務完成 `ready-review`，metrics 為 `whisperDevice=metal`，產生 draft／SRT／JSON 並清除暫存 WAV；status logs 沒有 `Metal exit 139`／`CPU fallback`，故本次沒有重現 crash→CPU fallback。
- 修正／防回歸：新增 production-mode acceptance probe；若當次 status logs 同時出現 `Metal exit 139` 與 `CPU fallback`，probe 會強制斷言最終 `whisperDevice=cpu`、輸出完整與暫存清理，否則只記錄正常 Metal path，不放寬為 fallback 通過。
- 剩餘風險：真正 server 內的 bundled Metal crash→CPU fallback 尚未在同一次實機 run 重現；deterministic fixture 仍是 fallback 控制流的主要回歸證據，長音訊、取消中的 retry、跨平台與乾淨安裝仍待驗收。

### BUG-WHISPER-METAL-139：production-mode controlled fallback acceptance

- 日期／版本：2026-09-17／0.51.0 開發中。
- 現象／影響：真實 bundled server run 未重現 Metal crash，但仍需確認 production-mode（非 `NODE_ENV=test`）不會因 test runner 關閉而跳過 child-process fallback 控制流。
- 重現／探針：`npm run acceptance:whisper:production-fallback -- docs/project-management/evidence/2026-09-17-whisper-production-fallback.json`；隔離 tools tree 的 wrapper 首次注入 exit 139／partial SRT／JSON，第二次只在 `--no-gpu` 下呼叫既有 deterministic fixture，底層 model 使用 bundled Tiny symlink。
- 實際結果：production-mode server status logs 記錄 `Metal exit 139`／`CPU fallback`，最終 metrics 為 `whisperDevice=cpu`，任務完成 `ready-review`，輸出完整、stale partial 清單為空、暫存 WAV 清理；evidence 明確標示 `bundledRuntimeUsed=false`。
- 修正／防回歸：新增獨立 production-mode controlled acceptance，不改 `server.mjs` fallback 策略；若 test runner gating、partial 清理、CPU retry 或輸出驗證回歸，probe 會失敗。既有 `scripts/test-core.mjs` 維持 deterministic server fixture 回歸。
- 剩餘風險：這是 production-mode 控制流證據，不是 bundled `whisper-cli` 實機 Metal crash→CPU fallback；仍需在同一次真實 bundled server run 重現 crash 才能關閉該實機門檻，並另行驗收長音訊、取消中的 retry、CPU retry 失敗、跨平台與乾淨安裝。

### BUG-WHISPER-METAL-139：Metal 139 執行權限邊界釐清

- 日期／版本：2026-09-17／0.51.0 開發中。
- 現象／疑點：前一輪 default sandbox direct bundled CLI 對 FFmpeg 正規化短 WAV 收到 Metal `SIGSEGV`，但 production server bundled path 以 Metal 完成，需區分 runtime 問題與驗證環境限制。
- 重播條件：使用同一 `whisper-cli`／Tiny、同一 1 秒 16 kHz mono silence WAV、同一產品 flags；分別在 default sandbox 與 `require_escalated` local process 執行 direct Metal，並以 `npm run acceptance:whisper:fallback -- /private/tmp/20260917-whisper-real-server-fallback-replay.json` 重播 `NODE_ENV=production` server。
- 根因／環境因素判定：升級權限 direct replay exit `0` 並產生 SRT／JSON，production server replay 亦 exit `0`、`whisperDevice=metal`；因此先前 139 已確認為 sandbox 執行邊界差異，不能歸因為 bundled runtime 在本機正常權限下必然失敗。完整對照保存於 `docs/project-management/evidence/2026-09-17-whisper-metal-permission-boundary.json`。
- 修正／防回歸：不修改產品 fallback 策略；後續 direct runtime／server acceptance 必須記錄執行權限邊界，sandbox crash 只能作環境限制證據，不能要求產品因未在同一權限邊界失敗而觸發 fallback。production-mode deterministic wrapper 與 child-process fixture 仍覆蓋真正 fallback 控制流。
- 本次判定：真實 bundled server crash→CPU fallback 仍未觀察到，故不關閉該實機驗收門檻；已解除「sandbox direct 139 與正常 server Metal success」的診斷矛盾。中文品質、長音訊、取消中的 retry、CPU retry 失敗、跨平台與乾淨安裝仍待驗收，LM Studio 依需求方決策未執行。

### BUG-030：Ollama 合法 JSON 未包裝 cues 陣列

- 日期／版本：2026-09-15／0.51.0 開發中。
- 現象：Ollama `llama3.2:1b` 的 provider raw response 可回傳合法 JSON，但形狀是單一 `{id,text,reason}` cue object，而不是既有 optimizer 要求的 `{"cues":[...]}`；產品流程因此回報「AI 回傳缺少 cues 陣列」。
- 影響：本機小模型即使已產生一個可辨識的字幕建議，仍會在 strict cue validation 前直接失敗，無法完成翻譯／校對批次。
- 重現：`OSF_ACCEPT_EXTERNAL=1 OSF_PROVIDER=ollama OSF_BASE_URL=http://127.0.0.1:11434/v1 OSF_MODEL=llama3.2:1b node scripts/probe-provider-live.mjs --output docs/project-management/evidence/2026-09-15-ollama-llama3.2-1b-provider-recheck.json` 保存 raw provider contract 失敗；以同一本機設定直接呼叫 `optimizeSubtitleCues()`，修正前同樣回報 `AI 回傳缺少 cues 陣列`。
- 根因：`parseCompletionContent()` 對合法 object 會回傳 `parsed.cues`，而 `canRepairOllamaJson()` 只辨識 malformed JSON，沒有把「缺少 wrapper」視為可安全一次修復的本機模型格式偏差。
- 修正：僅對 `provider=ollama` 且錯誤為無效 JSON／缺少 `cues` 陣列時送出一次明確 wrapper repair prompt；修復回應仍必須通過原有 ID、數量、順序、文字長度、語系與內容驗證，非 Ollama provider 不改變。
- 驗證：`node --check lib/ai/subtitle-optimizer.mjs`、`node --check scripts/test-ai-optimizer.mjs`、`node --check scripts/probe-ollama-live.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-providers.mjs` 均 exit 0；實際 Ollama `llama3.2:1b` probe 亦通過 capability、native single-cue 與 optimizer product path，證據為 `docs/project-management/evidence/2026-09-15-ollama-llama3.2-1b-optimizer-recheck.json`。
- 防回歸：新增 deterministic 測試確認未包裝 cue object 只觸發一次 repair，第二次 wrapper response 才可通過；live probe 記錄 `cue-object`→`cues-array` 回應形狀與固定 `LIVE-OPT-1` cue contract。
- 剩餘風險：模型可能在 repair 後仍產生語意、標點或語系品質不足，流程會安全拒絕但不保證生成成功；目前只驗證一個 Ollama 模型，LM Studio、真正斷網、取消／人工接受、跨平台與多批次真實模型仍待另行驗收。

### DEV-027：Anthropic Messages API 與既有 optimizer contract 不同

- 日期／版本：2026-08-26／0.51.0 開發中。
- 現象：Anthropic 使用 `/v1/messages`、`x-api-key`、必要的 `max_tokens` 與 content blocks，不能直接沿用 OpenAI `/chat/completions` 的 body／回應格式；直接共用會造成認證失敗、system prompt 被當成 user，或 optimizer 找不到 `choices[].message.content`。
- 影響：使用者選取 Anthropic 後無法載入模型、測試連線或安全套用字幕建議。
- 根因：供應商傳輸契約與既有 OpenAI-compatible adapter 不同。
- 修正：新增 `lib/ai/anthropic.mjs`，正規化 Base URL、移除 `/v1` 重複路徑、將 system／developer prompt 分離、合併連續 user／assistant 訊息、映射 `max_completion_tokens`→`max_tokens`、剔除 OpenAI 專用欄位，並把 Anthropic text content blocks 正規化為既有 choices contract；provider registry、UI、設定 profile 與金鑰隔離同步加入 `anthropic`。
- 防回歸：`scripts/test-ai-providers.mjs` 驗證 endpoint、headers、body 清理與 response mapping；`scripts/test-core.mjs` 驗證 provider list／profile／runtime key；`scripts/test-review-ui.mjs` 驗證選項與白名單。
- 剩餘風險：未使用真實 Claude API Key；外部模型品質、計費、速率限制、proxy 相容性與平台封裝仍需另行驗收。

### BUG-027：Anthropic 新模型拒絕非預設取樣參數

- 日期／版本：2026-09-14／0.51.0 開發中。
- 現象：共用 optimizer body 可包含 `temperature`、`top_p`、`top_k`，Anthropic adapter 會原樣轉成 `/v1/messages` body；真實 provider probe 亦固定帶入 `temperature: 0`。Anthropic 官方已說明 Claude Opus 4.7 之後對非預設取樣參數回覆 HTTP 400。
- 影響：使用者可成功載入模型清單，但在最新 Claude 模型開始字幕優化時直接遭遇 400；既有 mock 因未模擬參數拒絕而可能假綠。
- 根因：初版 adapter 依舊版 Messages API 支援範圍轉送通用取樣欄位，未把供應商模型相容性變更納入 request allowlist。
- 修正：`lib/ai/anthropic.mjs` 的明確 body allowlist 移除 `temperature`／`top_p`／`top_k`；共用 `scripts/probe-provider-live.mjs` 維持既有 `temperature: 0`，由 Anthropic adapter 局部過濾。model、`max_tokens`、system、messages 與 stop sequences 維持原契約，其他 provider 不變。
- 驗證：新增三個負向 contract assertion；修正前 focused 測試因實際 `temperature: 0` 外送而 exit 1，修正後 `node scripts/test-ai-providers.mjs` 與完整 `npm run check` 均 exit 0。
- 防回歸：即使上游共用 optimizer body 再次帶入任一取樣欄位，Anthropic adapter 測試仍要求最終 request body 的三欄皆為 `undefined`；另斷言 `stop_sequences` 保留及共用 live probe 仍提供 `temperature: 0`，不得依易過時的模型名稱白名單決定是否轉送。
- 剩餘風險：本輪不使用付費 API Key，無法證明特定 Claude 模型、proxy、計費或速率限制的真實端點結果。

### BUG-028：Anthropic 後頁模型被誤判為不可用

- 日期／版本：2026-09-14／0.51.0 開發中。
- 現象：Anthropic Models API 回應 `has_more=true` 且設定模型位於第二頁以後時，連線測試只檢查第一頁，回傳 `modelAvailable=false` 與不完整 `modelCount`。
- 影響：擁有超過單頁數量模型或使用分頁 proxy 的使用者可能無法通過指定模型檢查，即使該模型實際可用。
- 重現：deterministic mock 第一頁只含 `newer-model` 並回傳 `last_id`，第二頁才含 `test-model`；修正前 provider contract 測試實際得到 `false`，未發出第二頁 GET。
- 根因：初版 `listAnthropicModels()` 只取一次 `result.data`，未實作官方 Models API 的 `has_more`／`last_id`／`after_id` cursor pagination。
- 修正：每頁以 `limit=1000` 請求，`has_more=true` 時將 opaque `last_id` 原始字串經 `URLSearchParams` 安全編碼為下一頁 `after_id`，依序合併資料；trim 僅用來拒絕全空白游標，不修改傳遞與去重值；缺失 pagination flag、空白／重複游標或超過 100 頁時明確失敗。
- 驗證：修正前 focused test exit 1；修正後 Node 語法、provider contract、`git diff --check` 與完整 `npm run check` 均 exit 0，涵蓋兩頁成功、游標編碼、空清單、缺模型、異常游標與頁數上限。
- 防回歸：連線測試與 `listModels()` 共用同一分頁函式；不得以第一頁缺少指定 ID 判定不可用，也不得在無法前進的 cursor response 上重複請求。
- 剩餘風險：未以真實 API Key 或超過 20 筆的 Anthropic 帳號模型清單驗證；自訂 proxy、外部速率限制、網路中斷與跨平台封裝後行為仍待外部驗收。

### BUG-029：provider profile 可夾帶秘密欄位寫入一般設定

- 日期／版本：2026-09-15／0.51.0 開發中。
- 現象：`/api/ai/settings` 保存流程原樣合併 payload 的 `profiles`；巢狀 profile 若包含 `apiKey`、`authorization`、`secret` 或其他未知欄位，會被寫入一般 `settings.json`，雖然頂層 API Key 已另存 secrets。
- 影響：provider 金鑰或自訂秘密可能落入一般設定檔，違反 API Key 與秘密不得進入一般設定的安全契約；profile API 也可能回傳不應保存的欄位。
- 重現：核心測試送出 `profiles.anthropic.apiKey`、`authorization` 與 `secret`，修正前 `scripts/test-core.mjs` 以一般設定檔包含秘密字串而失敗。
- 根因：`normalizeAiSettings()` 的 profile 欄位直接保留原物件，`/api/ai/settings` 又以未正規化的 `payload.profiles` 合併保存；初版 allowlist 另因常數宣告晚於模組啟動時的 `loadSettings()`，使含非空 profile 的既有設定觸發 TDZ 後靜默回退預設值。
- 修正：新增 provider profile allowlist，只保存 `baseUrl`、`model`、`deployment`、`apiVersion`、`batchSize` 與 `timeoutSeconds`；只接受支援的 provider 物件，字串與數值欄位各自正規化，保存流程改用正規化後的 profiles；並將 allowlist 常數移至 `loadSettings()` 首次執行前。
- 驗證：核心 API 測試確認巢狀秘密不在 `settings.json`、`/api/ai/profile` 回應或合法 profile，啟動時預置的非空 profile 可保留且未知欄位不進 runtime；`node --check server.mjs`、`node --check scripts/test-core.mjs`、`node scripts/test-core.mjs`、provider contract、review UI 與 `git diff --check` 通過。
- 防回歸：測試持續送出巢狀 API Key、Authorization、secret 及合法模型欄位；allowlist 以 provider ID 過濾未知 profile，避免未來直接合併原始 payload 再次繞過正規化。
- 剩餘風險：本輪未改變既有 secrets 加密／OS 金鑰儲存機制；已存在於使用者設定檔的歷史秘密需由後續設定載入／遷移流程另行清理或驗收，本輪只保證新保存路徑不再寫入。

### BUG-001：portable Python／Whisper 綁定開發機路徑

- 現象：換到其他 Windows 電腦後找不到 Python 或 Whisper。
- 根因：venv 與 launcher 保存開發機絕對路徑。
- 修正：改用 bundled Whisper.cpp；runtime resolver、manifest 與 SHA 驗證取代開發機 venv 依賴。
- 防回歸：`verify-runtime-package.mjs` 與平台 runtime 準備腳本。

### BUG-002：Windows 中文檔名亂碼

- 現象：匯入、任務資料或輸出顯示 mojibake。
- 根因：UTF-8 被誤解為 Latin-1／Windows 編碼處理不一致。
- 修正：統一 UTF-8 路徑與回應處理。
- 防回歸：核心測試包含中文檔名案例。

### BUG-003：FFmpeg ASS filter 的 Windows 磁碟機路徑

- 現象：硬字幕輸出因 `C:` 等路徑字元解析失敗。
- 根因：filter 字串中的 Windows 絕對路徑需特殊跳脫。
- 修正：以輸出工作目錄與相對 `subtitle.ass` 執行。
- 防回歸：硬／軟字幕輸出 API 測試。

### BUG-004：Azure GPT-5 不支援 `max_tokens`

- 現象：連線測試回覆要求改用 `max_completion_tokens`。
- 根因：舊 chat completions 參數套用到 GPT-5 部署。
- 修正：0.45.1 改送 `max_completion_tokens`。
- 防回歸：AI provider contract tests 驗證請求參數。

### BUG-005：GPT-5 不接受 `temperature: 0.1`

- 現象：AI 優化在部分 GPT-5 部署回覆 unsupported value。
- 根因：optimizer 固定傳送 0.1。
- 修正：0.45.1 移除固定 temperature，使用模型預設。
- 防回歸：provider／optimizer 測試確認不再傳送不相容值。

### BUG-006：AI 優化面板佔用字幕清單空間

- 現象：未使用 AI 時仍大幅壓縮右側校閱區。
- 根因：AI 控制區始終展開。
- 修正：預設精簡、可展開／收合、保存偏好；任務開始時自動展開。
- 防回歸：`test-review-ui.mjs` 驗證狀態、記憶與自動展開。

### BUG-007：Windows 手冊 MP4 被最終 NSIS 過濾

- 現象：`win-unpacked` 有 MP4，但最終 EXE 清單缺少動畫。
- 根因：最終封裝流程未保留 `.mp4` 資產。
- 修正：保持 MP4 內容但使用 `.osfvideo` 資源副檔名，HTML 明確宣告 `type="video/mp4"`。
- 防回歸：workflow 檢查三個資源；發布前以 `7za l` 與 `ffprobe` 交叉驗證。

### BUG-008：GitHub 中文 Windows 資產名稱被簡化

- 現象：中文檔名上傳後變成 `0.45.1.exe`／`Setup.0.45.1.exe`，與 checksum、blockmap、`latest.yml` 不一致。
- 根因：GitHub CLI／Release 對上傳檔名進行平台正規化。
- 修正：Release 使用穩定 ASCII 名稱，更新 checksum，驗證後刪除錯誤重複資產。
- 防回歸：部署文件規定使用 ASCII 發布名稱並在上傳後核對實際名稱。

### BUG-009：AI 輸出語言僅支援三個固定選項

- 現象：設定介面只有繁中、簡中與英文；其他語言無法選擇，未支援值會靜默回退繁中。
- 影響：使用者誤以為指定語言已生效，但 LLM 實際收到 `zh-TW`，造成翻譯或校對語言錯誤。
- 根因：前端選項與 `normalizeAiSettings` 都以三值白名單硬編碼，Prompt 沒有共用語言驗證層。
- 修正：新增 `lib/ai/languages.mjs`，統一 BCP 47 驗證與標準化；UI 增加常用語言及自訂標籤；設定與 AI 任務 API 拒絕無效新輸入；Prompt 只採用驗證後值。
- 防回歸：optimizer、review UI 與 core API 測試覆蓋標準化、自訂語言、舊設定回退及注入型字串拒絕。
- 剩餘風險：LLM 是否完全遵循目標語言仍受供應商模型能力影響，必須由使用者逐段確認建議。

### BUG-010：Groq／Gemini 選項會被後端無聲回退

- 日期／版本：2026-07-22／0.45.2 候選修正。
- 現象：前端可選 Groq 或 Google Gemini，但儲存後供應商回到 `openai-compatible`；切換時可能殘留 Azure 欄位，Gemini 優化回應格式也與 optimizer 契約不一致。
- 影響：使用者看到的供應商與實際執行者不同，profile／API Key 可能落入錯誤供應商槽位，Gemini 優化可能在回應驗證階段失敗。
- 重現：對 `/api/ai/settings` 傳入 `provider: "groq"` 或 `"gemini"`，舊版 `normalizeAiSettings` 僅接受 OpenAI、OpenAI-compatible、Azure，因而回退預設值。
- 根因：供應商清單分散在 HTML、server endpoint 與 adapter；新增 UI／adapter 時未同步後端三處白名單，Gemini adapter 又使用原生回應格式而未符合既有 optimizer 的 OpenAI choices 契約。
- 修正：由 provider registry 匯出共同驗證函式；設定、profile、runtime key 與刪除金鑰 API 明確驗證供應商；Groq／Gemini profile 與 secrets 按 ID 隔離；Gemini 優化改用 OpenAI 相容 chat completions；UI 驗證 provider，非 Azure 欄位清空停用，連線前檢查已保存設定與金鑰。
- 驗證：`test-ai-providers.mjs`、`test-review-ui.mjs`、`test-core.mjs` 與 2026-07-22 本機瀏覽器切換實測通過。
- 防回歸：provider definitions、非法 provider 400、跨 provider 金鑰清除隔離與 UI 切換契約均納入 `npm test`。
- 剩餘風險：尚未使用真實 Groq／Gemini 帳號執行外部 smoke test；既有 0.45.2 候選安裝包未包含本修正，須重新建置與驗證。

## 新缺陷處理

發現新問題先在 `08-CHANGE-LOG.md` 記錄，再於本文件新增 `BUG-ID`。修正不得只寫「已解決」，必須包含可重現證據、根因與防回歸測試；若只能 workaround，須說明移除條件。

### BUG-WHISPER-METAL-139 — macOS Metal buffer allocation crash

- 日期／版本：2026-07-30／0.48.0
- 現象：macOS arm64 以 bundled `whisper-cli`、tiny model、1 秒 16 kHz silence WAV 執行 `-oj -ojf`，process exit 139，未產生 JSON。
- 重現：`tools/whisper-cpp/whisper-cli -m tools/whisper-models/ggml-tiny.bin -f /tmp/whisper-metal-smoke.wav -oj -ojf -of /tmp/whisper-metal-smoke`。
- 實際結果：exit `139`；stderr 在 `use gpu = 1` 後出現 `ggml_metal_buffer_init: error: failed to allocate buffer, size = 2.20 MiB`；stdout 為空，JSON 不存在。
- 對照結果：同一 WAV／model 加 `--no-gpu` 執行 exit `0`，產生 `/tmp/whisper-cpu-smoke.json`；CPU stderr 顯示完整 processing／output_json／timings。
- 根因判定：已確認為目前主機 bundled Whisper.cpp Metal buffer allocation 路徑的可重現 runtime failure；尚不能推論所有 macOS／模型／媒體均受影響。
- 修正狀態：0.48.x 穩定化已在 `runWhisperCpp` 加入 Metal 非零退出後的 `--no-gpu` CPU retry；CPU 仍失敗時維持 failed，不把 crash 當成功。
- 防回歸／後續：完整回歸與 CPU 對照證據通過；需在 macOS 實機長音訊與乾淨安裝環境持續驗證 retry 耗時、取消與 quality metadata 清理。
- 剩餘風險：未在乾淨 macOS 使用者環境、Windows 或長音訊驗證；目前產品路徑仍可能在 Metal crash 時失敗。
- 2026-09-17 重驗：目前 bundled `whisper-cli`／Tiny／生成 1 秒靜音 WAV 的預設 Metal 路徑實際 exit 139，stderr 出現 `ggml_metal_buffer_init` allocation failure 且沒有 SRT／JSON；同一輸入加 `--no-gpu` exit 0 並產生 SRT／JSON。CPU JSON 的 transcription segment 只有 offsets／timestamps／tokens，仍沒有 segment-level confidence／no-speech，證據保存於 `docs/project-management/evidence/2026-09-17-whisper-bundled-runtime-recheck.json`。
- 本次判定：已重新確認目前主機 bundled runtime 的 crash／CPU workaround 與 quality metadata 缺失，並未宣稱產品 server 已以真實 CLI 完成自動 fallback；產品 fallback 由前一輪 deterministic child-process fixture 覆蓋，真實長音訊、取消中的 retry 與跨平台實機仍待驗收。
# BUG-012 — OpenAI-compatible 顯示 Gemini 舊設定

- 發現版本：0.45.2（2026-07-22）
- 現象：AI 設定服務類型為 `OpenAI-compatible`，但 Base URL 為 `generativelanguage.googleapis.com/...`、模型為 `gemini-3.5-flash`。
- 根因：舊設定的供應商值與 Gemini 的 Base URL／模型被分開保存；載入時供應商回退為 `openai-compatible`，卻未清除不相容的舊欄位。
- 修正方向：0.45.3 載入設定時辨識 Gemini URL／模型與 OpenAI-compatible 的不一致組合，回復 OpenAI-compatible 預設 Base URL／空模型；不刪除 API Key、不修改 Gemini profile。
- 回歸防護：核心 API 測試加入舊 Gemini／OpenAI-compatible 混用資料遷移案例。
- 未覆蓋：目前尚未完成已存在使用者設定檔的實機升級驗證，需於 0.45.3 實機 smoke test 補齊。

# BUG-013 — 設定語系仍提供不需要的簡體中文選項

- 發現版本：0.45.2（2026-07-23）
- 現象：介面語言與 AI 輸出語言選單均提供簡體中文，與目前產品語系範圍不符。
- 影響：使用者可能選擇不支援的介面語系；既有 `zh-CN` 設定也可能在 UI 中繼續顯示為可用選項。
- 修正方向：移除兩個 UI 選單中的 `zh-CN`；伺服器載入既有 `appLanguage: zh-CN` 時回退 `zh-TW`；保留 AI 自訂 BCP 47 API 的標準化相容性。
- 回歸防護：UI 契約測試確認 `zh-CN`／簡體中文選項不存在，核心測試確認舊介面設定回退繁中。

# BUG-014 — 翻譯模式回傳不相關術語而非翻譯

- 日期／版本：2026-07-30／0.48.0 測試版。
- 現象：選擇翻譯後，AI 建議出現 `E3;平台名稱`，未產生完整翻譯。
- 影響：使用者可能誤接受不相關文字，覆蓋正確譯文。
- 重現：Ollama `llama3.2:1b`、專案術語表含「一三 → E3｜平台名稱」、翻譯中文 cue；既有 optimizer 以 `translatedText` 當輸入並把整份術語表送入每批。
- 根因：翻譯模式在 UI scope 已選原文，但 optimizer 正規化階段再次優先採用既有譯文；不相關術語表污染小模型提示，且翻譯結果缺少長度與目標語言驗證。
- 修正：翻譯模式固定以 `sourceText` 為輸入；傳給模型的 cue 僅保留 `id/text`；每批只帶入原文實際出現的術語；拒絕過短或英文／日文／韓文語系不符結果；新任務先清除舊建議；UI 類型由受控 mode 顯示。
- 驗證：`npm run check` 通過；真實 Ollama 英文兩 cue 測試與封裝 App 內模組同案例通過，建議均為 `mode: translate` 且未含 `E3／平台名稱`。
- 防回歸：`test-ai-optimizer.mjs` 覆蓋既有譯文、無關術語、過短輸出與日文語系不符；`test-review-ui.mjs` 覆蓋舊建議清除與受控模式標示。
- 剩餘風險：`llama3.2:1b` 可完成英文翻譯但語意品質有限；日文實測未遵循目標語言時會安全拒絕，建議使用較大模型並逐段人工確認。

# BUG-015 — Whisper SRT 零長度時間碼造成校閱載入失敗

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：載入校閱時回報「字幕第 703 段時間碼無效」。
- 影響：Whisper.cpp Small 已完成轉錄但無法進入字幕校閱；同一輸出另有第 704、707 段零長度時間碼。
- 重現：讀取本機 job `<user-home>/Library/Application Support/offline-subtitle-factory/jobs/20260805011912-3fca91/working/draft.srt`，第 703 段為 `00:23:53,560 --> 00:23:53,560`，第 704 段相同，第 707 段為 `00:23:54,160 --> 00:23:54,160`；`public/bilingual-subtitles.mjs` 的 `normalizeBilingualCue` 對 `end <= start` 拋出載入錯誤。
- 根因：Whisper.cpp 原始 SRT 可產生開始與結束相同的零長度 cue；`runWhisperCpp` 直接把原始檔複製成 `draft.srt`，未在寫入前套用與校閱解析器一致的嚴格時間碼驗證。
- 修正：新增純函式 SRT 清理器，嚴格解析時間碼、捨棄格式錯誤或 `end <= start` 的 cue、保留有效 cue 並重新編號；Whisper／Whisper.cpp 寫入 `draft.srt` 前套用，既有任務進入校閱資料 API 時也以同一清理器相容載入，全部無效時以可採取行動的錯誤結束；保留原始 Whisper 輸出供診斷。
- 驗證：focused 清理器與實際 job 703／704／707 回歸、`parseSrtBilingual` 載入、完整 `npm run check`、兩平台封裝與 ZIP 完整性、獨立審查及文件結案檢查。
- 防回歸：`scripts/test-whisper-srt.mjs` 覆蓋零長度、逆序、格式錯誤、多行文字、重新編號及全部無效邊界；後續 Whisper 輸出均經同一清理器。
- 剩餘風險：被捨棄 cue 的原文不會進入校閱，可能造成少量內容遺失；需由外部驗收確認長音訊、Windows 實機及清理後中文內容品質，模型本身的幻覺／辨識率不在本缺陷修正範圍。

# BUG-016 — Ollama 多批次 AI 優化逾時

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：使用 Ollama 進行多筆 AI 優化時回報「AI 優化失敗：AI 請求逾時」。
- 影響：已完成的批次仍保存於 checkpoint，但整個 AI 任務在單一批次逾時後變成 failed；使用者需要手動恢復，且容易誤以為所有批次遺失。
- 重現：本機 job `<user-home>/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json`；provider=`ollama`、model=`llama3.2:3b`、55 cues、55 batches、`timeoutSeconds=120`、`maxRetries=1`；第 1／2 批完成後第 3 批逾時，記錄 `progress.completedBatches=2`、`checkpoint.nextBatchIndex=2`、`error=AI 請求逾時`、`retryable=true`。
- 根因初判：Ollama 原生 `/api/chat` 請求使用 `stream:false` 並套用單次絕對 fetch timeout；本機低資源模型對特定 cue 可能超過 timeout，既有批次雖有 checkpoint，但 timeout 錯誤沒有提供更細緻的本機長生成處理與恢復提示。
- 修正：Ollama 原生 `/api/chat` 改用 `stream:true`；新增 NDJSON fragment 組裝，並將 timeout 重設為每片段的 idle timeout；保留 strict JSON／cue 驗證與 checkpoint，timeout 且已有完成批次時明確提示可恢復，不以無限延長 timeout 或靜默接受部分結果取代修正。
- 驗證：`test-ai-providers.mjs`、`test-ai-optimizer.mjs`、`test-ollama-batch-stream.mjs` 與完整 `npm run check` 通過；deterministic 三批次 streaming 在 100ms idle timeout 下完成，timeout checkpoint 續跑只送未完成批次；本機 Ollama `127.0.0.1:11434` 未啟動，真實模型 smoke 待外部驗收。
- 防回歸：provider contract 驗證 `stream:true`／NDJSON；delayed chunk 驗證 idle timer 每片段重設；optimizer 驗證第 3 批 timeout 後 `nextBatchIndex=2` 且續跑不重送前兩批；server 錯誤訊息保留已完成批次數量與恢復指引。
- 剩餘風險：模型本身可能在複雜字幕上生成極慢或卡住；若超過安全上限仍須讓任務可恢復失敗，不能保證所有低資源模型／字幕永不逾時。

# BUG-017 — Ollama 第 3 批重試後仍逾時

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：BUG-016 的 streaming 修正封裝於第 3 批仍顯示「受限或失敗，第 1 次重試，等待 2 秒」，重試後再次回報「AI 優化失敗：AI 請求逾時」。
- 重現：job `<user-home>/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json` 更新至 2026-08-05 11:27；`provider=ollama`、`model=llama3.2:3b`、`completedBatches=2/55`、`activeBatch=3`、`retryAttempt=1`、`retryable=true`、`checkpoint.nextBatchIndex=2`、`error=AI 請求逾時`。本機 Ollama `127.0.0.1:11434` 目前連線拒絕，無法取得同一 cue 的真模型 response。
- 症狀與根因區分：症狀是串流重試仍逾時；已確認原 transport 在 `fetch` 收到 response headers 後沒有重新開始 body idle timeout，若 Ollama 在 headers 後才產生第一個 NDJSON chunk，仍會沿用 request 起始計時器；此外 timeout 重試沿用相同 120 秒上限，沒有為低資源模型增加可控的第二次等待窗口。
- 修正：`requestAiJson` 在 `fetch` 完成後重新 arm timeout；Ollama native request 增加 `num_predict=512`、`keep_alive=10m`，避免無界生成與每批重新載入；optimizer 對 Ollama timeout 的下一次 retry 自動將 timeout 加倍（120→240 秒，最高 600 秒），並把延長值寫入 retry progress；UI 重試訊息顯示本次 timeout 上限；checkpoint／strict cue validation 保持不變。
- 驗證：`test-ai-providers.mjs` 覆蓋 Ollama streaming、chunk idle reset、headers 後延遲第一 chunk、`num_predict`／`keep_alive` contract；`test-ai-optimizer.mjs` 覆蓋 Ollama timeout retry 延長至 240 秒與進度 telemetry、既有 checkpoint resume；`test-ollama-batch-stream.mjs` 三批次 streaming 通過。完整回歸、兩平台封裝與真實 Ollama smoke 待本輪結案補記。
- 防回歸：timeout 重試不得重送已完成批次；若延長窗口仍無任何 response，仍以 retryable failed 保存 checkpoint，不靜默產生 AI 建議。
- 剩餘風險：真實 `llama3.2:3b` 仍未於本環境啟動驗證；若模型在 240／600 秒內完全沒有輸出，任務仍會安全失敗並需恢復；Windows 實機與不同 Ollama 版本的 `keep_alive`／`num_predict` 行為仍待外部驗收。

# BUG-018 — Ollama 回傳內容非有效 JSON

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：Ollama 第 3 批不再 timeout，但回報「AI 優化失敗：AI 回傳內容不是有效 JSON」。
- 重現：job `<user-home>/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json` 於 2026-08-05 12:10 為 `status=failed`、`provider=ollama`、`model=llama3.2:3b`、`completedBatches=2/55`、`nextBatchIndex=2`、`suggestions=2`、`mode=proofread`、`language=ja`；本機 Ollama `127.0.0.1:11434` 連線拒絕，未保存 raw model response。
- 根因判定：`parseCompletionContent` 原先只接受完整 JSON 或單純 code fence，沒有安全處理模型在 JSON 前後附加說明；對真正 malformed／截斷 JSON 也沒有 Ollama 專用一次性 repair，因此 strict parser 直接讓批次失敗。無 raw response 時不能把本次錯誤進一步歸因為 wrapper、截斷或模型 schema 失守其中一項。
- 修正：解析前保留 strict JSON 契約，但可從前後包裝文字中擷取完整 `{...}`／`[...]` JSON 再驗證；Ollama malformed JSON 只觸發一次簡化 repair prompt，第二次仍無效則拒絕，不接受原文或不完整 cue；UI 顯示「正在要求 Ollama 重新輸出 JSON」；既有 checkpoint／cue ID／數量／順序驗證不變。
- 驗證：`test-ai-optimizer.mjs` 覆蓋 wrapper extraction、Ollama proofread malformed→repair、repair 第二次仍 malformed 的拒絕與最多兩次請求；既有 provider／timeout／stream tests 與完整受控權限 `npm run check` 通過；兩平台 ZIP `unzip -t`、source markers／Small manifest 核對通過；真實 Ollama raw response／同一 job 修正後重跑與 Windows 實機仍待外部驗收。
- 防回歸：只對 `provider=ollama` 且 `code=invalid_json` 進行一次 repair；translation 仍使用既有專用 repair；非 Ollama provider 不改變原有 JSON path；修復後仍必須通過 cue strict validation。
- 剩餘風險：本機未啟動真實 Ollama，尚未取得原始 malformed response；若模型回傳內層未跳脫引號、截斷或 valid JSON 但 cue contract 錯誤，repair 仍可能安全失敗；Windows 實機與不同 Ollama 版本仍待外部驗收。

# BUG-019 — Ollama cue 文字長度異常

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：Ollama AI 優化在 cue 344 回報「AI 文字長度異常」；該批未完成，既有 checkpoint 仍可續跑。
- 重現：job `<user-home>/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json`；`provider=ollama`、`model=llama3.2:3b`、`progress.completedBatches=4/55`、`checkpoint.nextBatchIndex=4`、`mode=proofread`、`language=ja`；cue 344 原文為「如果老師選擇Excel的話」，本機未保存 raw model response，Ollama 目前連線拒絕。
- 根因判定：strict validator 對 cue 文字使用 `Math.max(500, original.length * 6)` 上限；本次模型回應已超過安全上限，可能含解說、重複內容或無界生成。因沒有 raw response，不能把具體內容形式宣稱為已證實的單一原因；放寬上限或截斷都會讓錯誤內容進入字幕。
- 修正：抽出一致的 cue 長度上限計算；原始 prompt 明確列出每個 cue 的字元上限並禁止解說／重複／Markdown；Ollama 遇到 length validation failure 只執行一次專用 JSON repair，repair 仍超長即拒絕；UI 顯示「回應文字過長，正在要求 Ollama 重新輸出」；ID／數量／順序／strict validation／checkpoint 保持不變。
- 驗證：`test-ai-optimizer.mjs` 覆蓋 cue 344 過長→一次 repair 成功、第二次仍過長拒絕、`validationRepairReason=length` telemetry，以及非 Ollama provider 仍嚴格拒絕；provider／stream 回歸與完整 `npm run check`、兩平台測試包與 ZIP 完整性待本輪結案補記。
- 防回歸：length repair 不截斷、不套用原文 fallback、不寫入未完成批次；若模型再次超長，保留上一個成功 checkpoint，使用者可從 `nextBatchIndex` 恢復。
- 剩餘風險：真實 Ollama raw response／同一 job 修正後 55 批重跑、Windows 實機與不同 Ollama 版本仍待外部驗收；若模型持續產生超長輸出，仍會安全失敗而非保證成功。

# BUG-020 — AI 優化前端 `Failed to fetch`

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：校閱頁在 AI 優化流程顯示「AI 優化失敗：Failed to fetch」。
- 重現／基準：需求方未提供本次 job ID、renderer console 或 server log；目前可讀取的最近 job `20260805024615-2af944` 已是 `status=completed`、55/55，沒有可將本次錯誤歸因到 Ollama response 的 failed checkpoint。`public/review.js` 原先在啟動／輪詢 `/api/jobs/:id/ai-optimize` 的瀏覽器 fetch 例外直接顯示原生 `Failed to fetch`。
- 根因判定：已確認可見錯誤是 renderer→本機字幕工廠 HTTP API 層的未正規化 fetch 例外；尚不能由目前證據判斷是 App server 暫停／port 變更、Windows 啟動生命週期、網路堆疊或請求回應中斷。Ollama provider 內部錯誤另由 `requestAiJson` 正規化，不與本錯誤混同。
- 修正：新增 `public/ai-fetch.mjs`，將 `Failed to fetch`／`NetworkError`／`Load failed`／`fetch failed` 等本機 API 不可達錯誤轉成包含 API 位址、重啟／重新載入與 checkpoint 恢復指引的可診斷訊息；AI 狀態 GET 失聯時最多重試兩次；啟動 POST 回應遺失時先查詢既有任務狀態，若已在 server 執行則接回輪詢；API 回應非 JSON 時明確標示格式錯誤。未自動重送啟動 POST，避免建立重複 AI 任務。
- 防回歸：`scripts/test-ai-fetch.mjs` 覆蓋 network error 正規化、非 network provider error 不誤判、invalid API response 與 retryable marker；`npm test` 接入測試。保留既有 strict cue validation、Ollama repair／timeout 與 checkpoint。
- 驗證：`node --check public/review.js`、`node --check public/ai-fetch.mjs`、`node --check public/ai-status-recovery.mjs`、`node scripts/test-ai-fetch.mjs`、`node scripts/test-review-ui.mjs`、`node scripts/test-ai-optimizer.mjs`、受控完整 `npm run check`、`git diff --check` 已通過；最新 macOS arm64／Windows x64 ZIP `unzip -t` 通過，SHA-256 分別為 `ebac55d1fc7d40de54e7c113d7da4eec531c4099c52ed0be727f2d4c57da9bb0`／`2ec03b3de2a541e4d3272a4563cdca9d2f00f25b7fa6738954e5db0ee7c9c998`；兩平台 source markers 與 Small manifest 核對一致；round2 獨立複審已完成，真實 renderer／Windows 實機／Ollama smoke 仍為外部驗收條件。
- 剩餘風險：沒有本次實際 renderer console／server log，無法證明單一外部觸發原因；若 server process 已完全停止，前端只能提供重啟與恢復指引；若 POST 已送達但 GET 也不可達，仍需重新載入 App 後以 checkpoint 恢復。Windows 實機與真實 Ollama multi-batch smoke 仍待外部驗收。

# FR-023 — Windows Whisper 高階模型需手動下載

- 日期／版本：2026-08-06／0.48.0 測試版
- 現象：Windows 安裝包選擇 Base／Small 時，若模型檔不存在，只顯示「請安裝或匯入正確模型後再試」，使用者必須自行尋找下載來源與可寫入路徑。
- 根因：三模型選擇已存在，但模型資產不一定隨平台包附帶；Electron server 使用安裝資源目錄作為工具來源，Windows 安裝目錄可能不可寫入，且既有 UI 沒有下載狀態／手動 URL／首次使用前檢查。
- 修正：新增固定 revision 的官方 Whisper.cpp multilingual Base／Small／Tiny download definitions；`server.mjs` 提供模型狀態與下載 API，下載到 `userData/whisper-models`、限制白名單、回報進度、驗證預期大小／SHA-256、失敗清理暫存檔並原子置換；`public/app.js` 在模型選擇與任務提交前顯示確認、進度與官方手動下載說明；`lib/whisper-models.mjs` 支援 user cache 優先、封裝模型 fallback。
- 驗證：`test-whisper-model-download.mjs` 覆蓋成功／HTTP 失敗／大小／SHA／AbortController 逾時／Windows 既有檔替換／暫存清理，並在 `.download` 已寫入部分內容後取消；`test-whisper-models.mjs` 覆蓋模型管理 UI；`test-core.mjs` 覆蓋 `/api/whisper-models` pinned metadata，以及 POST→部分 bytes→DELETE→無 `.download`／`.previous` 的 active API 路徑；完整 `npm run check`、兩平台封裝／source marker 與 docs check 已通過；Windows 實機下載／userData 權限／中文口說品質仍待外部驗收。
- 防回歸：不接受任意 URL／任意檔名；缺模型不可建立或啟動 ASR；下載 response 不符 size／SHA 不寫入正式檔；保留手動下載 URL 與 userData cache 路徑。
- 剩餘風險：尚未在 Windows 實機執行實際 148 MB／488 MB 下載、安裝權限、網路中斷／續跑與中文口說品質驗收；若下載失敗，使用者仍須依官方 URL 手動下載後重新檢查。

# SYNC-024 — GitHub Windows 測試修正同步

- 日期／版本：2026-08-06／0.48.0 測試版
- 現象：需求方表示 Windows 測試問題與修正已更新 GitHub，要求同步至目前專案。
- 核對：`git fetch --prune origin` 後，GitHub Windows Ollama 修正 `4d0bee6` 與本地 HEAD `170e08e` 的指定 runtime diff 為空，沒有重複套用；最新 `origin/main=baed6d7` 另包含 Azure OpenAI request parameter 修正。
- 修正：選擇性整合 Azure capability probe 的 `max_completion_tokens`；Azure deployment 請求移除 optimizer 內部欄位與 model；OpenAI-compatible chat completion 移除內部 operation／language／cue metadata；保留本地 Ollama streaming／timeout／repair 與 Windows 翻譯修正。
- 驗證：provider／optimizer／Ollama streaming focused tests 與完整 `npm run check` 通過；macOS／Windows 測試包三個 AI runtime source marker 與工作樹一致，ZIP 更新後需由外部 Windows 實機確認啟動與真實端點行為。
- 剩餘風險：沒有 Windows 實機或真實 Azure／Ollama endpoint 證據，不能把 GitHub commit 核對、contract mock 或本機 ZIP 同步宣稱為跨平台實機驗收。

# REL-025 — Electron／builder 供應鏈弱點阻擋發布

- 日期／版本：2026-08-10／0.48.1 發布候選
- 現象：發布前完整 `npm audit` 在 Electron 33／electron-builder 25 鎖檔回報 16 項弱點（15 high、1 critical），其中同時包含 runtime 與建置鏈風險，不能只以 production-only audit 為 0 宣稱可發布。
- 根因：專案仍鎖定 `electron@33.4.11`、`electron-builder@25.1.8`；先前供應鏈盤點已辨識需要 major 升級，但當時因相容性與跨平台封裝證據不足而延後。
- 修正：升級至 `electron@43.3.0` 與 `electron-builder@26.15.7`，保留 macOS 12 最低支援線；不升至要求 macOS 13 的 Electron 44。同步把開發／CI Node 引擎下限提高為 22.12.0，避免以不受 Electron 43 工具鏈支援的 Node 20 安裝。下載、renderer verifier 與雙平台打包沿用受控固定流程。
- 驗證：升級後完整 `npm audit --json` 為 0；`npm run check`、macOS arm64 runtime／目錄版、隔離 userData packaged renderer smoke、Windows x64 runtime／目錄版／Setup／Portable 建置均通過。封裝內版本、PE 架構、Tiny-only 模型政策與本版 Release notes 已核對。
- 防回歸：發布驗證保留 dependency tree／audit、兩平台 build、封裝 source marker、updater metadata 與 SHA 核對；未來 Electron major 升級必須重新確認最低 OS 與 packaged renderer。
- 剩餘風險：Windows 10／11 實機啟動／安裝／解除安裝與本版 macOS DMG／ZIP 乾淨安裝仍未完成；`asar:false` 為既有封裝強化債務；Windows 未 Authenticode、macOS 未 Developer ID／公證。

# BUG-021 — Breeze runtime 缺件沒有可操作處理方法

- 日期／版本：2026-08-13／0.49.0
- 現象：選取 Breeze ASR 25 後只顯示「需安裝 patched Whisper runtime」，沒有官方安裝步驟、啟動命令或重新檢查入口。
- 重現：在任務表單選擇 `breeze-asr-25`，API 回報模型有效但 `runtimeReady=false`；原前端只寫入狀態／log 後 return false。
- 根因：runtime 是不隨 App 封裝的外部 Python／patched Whisper；既有前端沒有 guide modal。初版指引又在普通 clone 後直接 pip install 空的 submodule，並在 Breeze repo 內執行本 App 的 `npm start`，無法完成實際安裝／啟動。
- 修正：新增固定非秘密的 guide API 與 runtime modal，提供 `git clone --recurse-submodules`、家目錄 venv、模型／runtime 驗證，以及本專案開發版、macOS `/Applications`、Windows NSIS 預設路徑的啟動命令；模型下載視窗與 ASR 欄位保留 persistent 指引入口；App 不自動執行 shell／pip。
- 驗證：`test-breeze-asr.mjs` 覆蓋 submodule 初始化、平台命令、安裝版啟動路徑與錯誤 cwd 負向條件；`test-core.mjs` 覆蓋 API guide；`npm run check`、UI 缺件 smoke、`npm run docs:check:final` 與 `git diff --check` 待 round2 完成後補記。
- 防回歸：後續若改動 guide，必須同步 `docs/BREEZE-ASR-25.md`、功能設計、測試稽核與本測試；不得把未安裝真實 runtime／checkpoint 的 deterministic 證據描述成模型品質或跨平台實機驗收。
- 剩餘風險：Python／git／pip／網路、第三方 submodule 供應鏈、真實 3 GB checkpoint、Windows PowerShell／macOS shell、安裝後啟動、品質／效能／長音訊／取消與 process tree 仍待外部驗收。

# BUG-022 — Breeze runtime 路徑與首頁健康卡未同步

- 日期／版本：2026-08-13／0.49.0
- 現象：macOS 畫面顯示 Breeze ASR 25 模型已就緒但缺少 patched Whisper runtime；首頁系統效能卡片的 FFmpeg／轉錄引擎／Whisper 狀態仍停留「待檢查」。
- 根因判定：runtime 探針只以通用 bundled Python 與系統命令作回退，未涵蓋使用者家目錄的標準 Breeze venv；Windows 同時存在 `HOME`／`USERPROFILE` 時可能選錯家目錄，且一般 bundled Python 可能遮蔽真正的 patched venv。首頁健康 API 成功後未呼叫既有 `updateMetrics`，因此工具狀態沒有反映最新回應。
- 修正：`resolveBreezePython` 依平台優先解析 macOS／Linux `$HOME`、Windows `USERPROFILE` 的 `Breeze-ASR-25/.venv`，並把外部 patched venv 排在一般 bundled Python 前；`server.mjs`／`electron/main.mjs` 補齊 Unix `bin/python` 工具路徑；`refreshHomeHealth` 在健康 API 成功後同步更新系統工具卡片。
- 驗證：Node syntax、`node scripts/test-breeze-asr.mjs` 與完整 `npm run check` 通過；新增 macOS／Windows 標準 venv 偵測、Windows `USERPROFILE` 優先序、外部 venv 優先 bundled Python 與首頁 `updateMetrics` source assertion。
- 防回歸：明確 `BREEZE_ASR_PYTHON` 仍優先；缺件時不自動執行安裝命令；任何新平台路徑變更須加入平台衝突與 bundled／external 優先序測試。
- 剩餘風險：本機未安裝或未執行真實 MediaTek patched runtime、3 GB checkpoint、長音訊與品質／效能；Windows process tree、macOS／Windows 乾淨安裝與自訂 runtime 路徑仍需外部驗收。

# BUG-023 — Breeze 首次選擇未立即協助設定

- 日期／版本：2026-08-18／0.49.1 修正版候選
- 現象：選取 Breeze 時只更新狀態文字，模型下載與 runtime 指引要等到提交任務才出現；選單文字也把「實驗性／需另裝 runtime」混在產品名稱中。
- 根因：ASR 選擇器 change handler 只查詢狀態並自行分支，沒有共用提交前的 `ensureBreezeAsrReady()` readiness flow；產品名稱與限制說明未分離。
- 修正：選取 Breeze 後立即共用模型／runtime readiness flow；模型缺失開啟固定官方下載對話框，下載完成後接續 runtime guide，取消仍阻止任務建立；選單改為 `Breeze ASR 25`，限制與效能風險移至說明／發布文件。
- 驗證：`scripts/test-breeze-asr.mjs` 新增 UI 文字與首次選擇 source assertions；完整回歸與獨立審查待本輪結案補記。
- 效能依據：需求方 MacBook Air `Mac15,12`／Apple M3／8 GB／8 cores／macOS `26.5.2`（Build `25F84`）處理 1:46:00 影片約需 6 小時（約 `3.4×`）；單一本機觀察，不代表品質或跨平台效能驗收。
- 剩餘風險：模型約 2.88 GiB 且 runtime 不隨包提供；低資源 CPU 可能長時間執行，仍需真實 profiler、長音訊、品質、Windows／macOS 乾淨安裝驗收。

# BUG-025 — macOS 乾淨 profile 首次啟動卡在不必要 Keychain 查詢

- 日期／版本：2026-08-20／0.50.0 macOS 測試候選
- 現象：commit `2c9612e` 的封裝可完成 DMG／ZIP、codesign 與靜態內容核對，但隔離 userData 的 packaged renderer smoke 只啟動 DevTools browser，60 秒內沒有主視窗 target；主程序未啟動 server／renderer。
- 診斷：對停滯主程序執行 1 秒 `sample`，主執行緒持續停在 Security framework 的 `SecItemCopyMatching`／Keychain 解密路徑；乾淨 userData 不含 `config/ai-keys.safe`，但 `readSecureAiKeys()` 原先先呼叫 `safeStorage.isEncryptionAvailable()`，之後才檢查檔案是否存在。
- 根因判定：不存在安全金鑰檔時仍先觸發 OS 安全儲存能力檢查；在自動化／乾淨 profile 環境可能等待 Keychain 互動，阻止 `app.whenReady()` 後續 server 與主視窗流程。
- 修正：`readSecureAiKeys()` 先解析單一 `securePath` 並檢查檔案存在；只有檔案存在時才呼叫 `safeStorage.isEncryptionAvailable()` 與 decrypt。既有金鑰檔的安全儲存語意不變。
- 防回歸：`scripts/test-electron-main.mjs` 驗證檔案存在檢查嚴格位於 safeStorage 能力檢查之前，且解密沿用同一已檢查路徑；測試納入 `npm test`。
- 驗證：focused syntax／新測試、完整 `npm run check` 通過；修正版 packaged renderer smoke 以隔離 userData 實際通過首頁、設定、Breeze 首次選擇 modal、上傳／完成、SRT、AI 校閱與資料夾事件。最終資產須在 Release notes 同步後重建並重新核對。
- 剩餘風險：尚未以既有真實加密 AI 金鑰檔重放跨版本 decrypt／Keychain 權限提示，也不等同乾淨使用者帳號 Gatekeeper 或公證驗收。

# BUG-024 — Whisper Small 輸出過長字幕 cue

- 日期／版本：2026-08-20／0.50.0 開發分支
- 現象：使用 Whisper Small 語言包時，單一 SRT cue 可能包含完整長句或超長單行文字，校閱與播放時可讀性差；原有「過長」品質篩選只標記問題，不會改善輸出。
- 重現：以 deterministic SRT `00:00:10,000 --> 00:00:16,000` 搭配超過 40 個中英文混合字元的長句呼叫 `sanitizeWhisperSrt(input, { splitLongCues: true })`；基準未啟用選項時維持單一長 cue。
- 影響：Small 的原始辨識文字雖未遺失，但超長 cue 需要人工重排；若直接截斷會造成字幕內容損失，若任意拆分又可能產生零長度／重疊時間碼或錯誤品質指標對應。
- 根因判定：Whisper SRT 清理器原先只驗證時間碼與重編號，沒有 Small 專用的顯示長度政策，也沒有在拆分後重新分配時間；品質模組的 `字幕過長` 是篩選訊號，不是輸出修正器。
- 修正：`lib/whisper-srt.mjs` 新增 opt-in `splitLongCues`；Small 輸出最多兩行、每行最多 20 字元，超過 40 字元優先依標點／空白拆成多個連續 cue，再按字數比例分配原始時段；保留完整文字，時間不足時不強拆。`server.mjs` 的 Python Whisper／Whisper.cpp Small 路徑一致啟用，Tiny／Base／Breeze 不變。
- 品質 metadata：Small cue 拆分來源以同長度陣列的 `null` 項標記，避免一個 segment 被誤當成多個新 cue；未拆分 cue 仍保存可取得的 confidence／no-speech 指標，拆分 cue 改由校閱頁既有 rule-score 重新評估。
- 驗證：`node --check lib/whisper-srt.mjs`、`node --check server.mjs`、`node scripts/test-whisper-srt.mjs`、`node scripts/test-whisper-quality.mjs`、`node scripts/test-whisper-models.mjs`、完整 `npm run check`、`npm run docs:check`、`npm run docs:check:final` 與獨立 round1／round2／round3 審查通過；測試覆蓋未啟用相容性、文字無損、正常時最多兩行／每行 20 字元、連續時間碼、零長度防護、超過 40 字元純中文 1 ms fallback 不新增空格與 partial quality metadata 邊界。
- 防回歸：後續不得以截斷、摘要或假的 quality metadata 解決長 cue；若修改字元門檻、拆分邊界或時間分配，必須同步 focused 測試、功能設計、需求／稽核與 Release notes。
- 剩餘風險：尚未以真實 Whisper Small 權重與 1:46 長音訊驗證中文斷句、閱讀速度、模型品質、品質 metadata 及 macOS／Windows 封裝後行為；過短原始 cue 會保留長文字並交由人工校閱。
