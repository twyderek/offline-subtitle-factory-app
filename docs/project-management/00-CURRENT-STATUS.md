# 目前專案狀態

## 2026-10-30 FR-021 signed-canary prerequisite revalidation review findings remediation

- next2 round1 的 formal gate ready-path／derived-projection validator finding 已修正：`scripts/audit-macos-signed-canary-gate.mjs` 現以同一 evaluator 核對 source config、required toolchain、identity、credential-derived notarization 與 ready／blocked reasons；focused test 固定 authoritative blocked evidence、synthetic ready path、每一類 derived mismatch 與負向 mutation。
- readiness validator／test 已補 `startedAt`／`completedAt` 的型別、UTC ISO millisecond format、completed-not-before-started gate 與 date-first evidence selector；既有 immutable evidence 未覆寫。
- 四支 syntax、focused gate／readiness tests、治理 validator、完整 `npm run check` 與 `git diff --check` 通過；本項仍不代表 signed／notarized candidate 或 FR-021 overall，待最終複審與 final docs gate。

## 2026-10-30 FR-021 macOS signed-canary external prerequisites revalidation next stage 2

- `next15` external boundary、`next7` signing readiness 與 `execution7` formal gate 均以 current HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b` 重新保存並採 `0600`；三份 SHA-256 分別為 `7ae2b6b4e1e069bceac479669c57cc07393f59cf904049faf76058620bc9868c`、`11996d29916cbac5dda392cf476e53f37ded8e07e23daff8f1aaf72cde97caaa`、`29710462ca9757750a8d897418c7b3a90d01e180469f69a9261f960b90da0ab9`。
- remote workflow／source match 維持，但 Environment／required reviewer／secret scope／protected branch 仍未就緒；本機 signing readiness 仍為 0 valid Developer ID、credential absent；formal gate 仍在 runtime manifest／builder 前 fail-closed。
- 本輪只做 read-only revalidation；未修改 remote／keychain／candidate，未觸發 workflow，未執行 builder／codesign／notarytool／stapler／Gatekeeper／packaged app／UI／Ollama／model／network。focused／完整 `npm run check`、治理 validator 與 `git diff --check` 通過；三份 evidence 不代表 signed／notarized candidate 或 FR-021 overall acceptance。

## 2026-10-30 FR-021 macOS signed-canary external prerequisites revalidation next stage

- 10/30 current-source 三份 immutable evidence 均綁定 local HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b` 且 mode `0600`：external boundary `next14` status `fail`、SHA-256 `3f9055efef9e7af3a508c485ac55910a5a787eeefa0e5cd4db9f26f429a0789f`；signing readiness `next6` status `blocked-external-signing-identity`、SHA-256 `15f43ad1722344019cf48e3d2e5b8d0edae280d5283c51ef05f99b3585cc5cfa`；formal gate `execution6` ready `false`、SHA-256 `ae372012947ffecb12f29ce607b7854474804dc78e18011b30bac4a0b5edee39`。
- external boundary 仍為 `environment-not-configured`、`environment-required-reviewer-not-confirmed`、`environment-secret-scope-not-confirmed`、`branch-not-protected`；remote workflow present 且 source matches local HEAD。local readiness 仍為 `validIdentityCount=0`、`formalSigningReady=false`、credential `absent`；formal gate 仍只有 `developer-id-application-not-ready`／`notarization-credential-set-not-ready`。
- scope：external audit 僅查詢 remote API，`remoteStateModified=false`、`workflowTriggered=false`、`secretValuesRead=false`；readiness／gate 未修改 keychain／candidate，未 signing／notarization，runtime manifest／builder／candidate 全未啟動，未保存 raw output／identity／secret。
- 解讀：10/30 revalidation 證明 blocker 未解除，且目前 source 的 provenance／fail-closed contract 仍有效；尚不能進入真實 signed workflow。既有 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false`、全機 egress、Windows 與 FR-021 overall residual 維持未完成。

## 2026-10-29 FR-021 macOS signed-canary current-source formal build gate recheck next stage

- authoritative current-source formal gate evidence `docs/project-management/evidence/2026-10-29-fr-021-signed-canary-gate-execution5.json` mode `0600`、SHA-256 `5a1bb264b698f78d958d7bd53056c57aae5ed6cf2b4349fd0dd1905f203872e5`；gate script／package／focused-test provenance 綁定目前 source，並以 `ready=false` fail-closed。
- gate reasons 為 `developer-id-application-not-ready` 與 `notarization-credential-set-not-ready`；source config／required toolchain ready，但 identity probe 為 0 valid identities、Developer ID Application 不存在，credential status `absent`。
- `runtimeManifestStarted=false`、`builderStarted=false`、`candidateCreated=false`，全 scope flags false；未執行 codesign／notarytool／stapler／Gatekeeper、workflow、packaged app／UI、Ollama／model 或 network isolation，未保存 raw output／identity／secret。
- 解讀：execution5 只證明現行 source 的正式 gate 仍能在 builder 前阻擋 external signing prerequisite，不代表 signed／hardened candidate、Apple ticket、release 或 FR-021 overall。既有 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false`、全機 egress、Windows 與 FR-021 overall residual 維持未完成。

## 2026-10-29 FR-021 macOS signed-canary current-source signing readiness recheck next stage

- authoritative current-source readiness evidence `docs/project-management/evidence/2026-10-29-fr-021-prerequisite-readiness-recheck-next5.json` status `blocked-external-signing-identity`、mode `0600`、SHA-256 `11312386df77c2bee79accf6f07a055693abeef236c15ea8a13d8b3d2dcc1937`；source provenance 綁定 local HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b`、目前 audit script／package／focused test hashes，working tree dirty 如實記錄。
- current source／package config／required toolchain／existing evidence／provenance 均 ready，但 `security find-identity` probe 成功且 `validIdentityCount=0`、`formalIdentityAvailable=false`、Developer ID Application 不存在；Apple ID／API key／keychain profile credential set 均 absent，`formalSigningReady=false`。
- scope 全部維持 false：未修改 candidate／keychain、未 signing／notarization、未執行 packaged app／UI／Ollama／model、未建立 network connection，raw output／absolute path／identity name／hash／secret 未落盤。
- 解讀：next5 只更新目前 source 的 signing prerequisite，證明 handoff source 已與 readiness provenance 對齊但仍不能進入 signed／hardened builder；下一步仍需外部受控 signing environment 提供核准的 Developer ID Application identity／entitlements 與完整 notarization credential。`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false`、全機 egress、Windows 與 FR-021 overall residual 維持未完成。

## 2026-10-29 FR-021 macOS signed-canary external boundary recheck next stage

- authoritative `next13` external-boundary evidence `docs/project-management/evidence/2026-10-29-fr-021-macos-signed-canary-external-boundary-next13.json` status `fail`、mode `0600`、SHA-256 `c3ffb62230fc4ae5d6de2add79c0cce71dca1c3de9e86d0741cd822308b607ec`；remote branch SHA `f16ae8be60fb132bdbb1a128722a244f70f86e6b`、workflow content SHA `310f549149b12ead95d569e941415664f87545a0` 與 local HEAD／source provenance 一致。
- 本次唯讀查詢仍確認 `macos-signed-canary` Environment、required reviewer projection、environment secret metadata 與 branch protection 均 `not-found`；summary reasons 為 `environment-not-configured`、`environment-required-reviewer-not-confirmed`、`environment-secret-scope-not-confirmed`、`branch-not-protected`，因此 `ready=false`，不能進入 signed-canary handoff。
- scope 明確為 `remoteApiQueried=true`、`remoteStateModified=false`、`workflowTriggered=false`、`secretMetadataRead=true`、`secretValuesRead=false`；未保存 raw API output、secret value、reviewer name、token，未執行 builder／codesign／notarytool／stapler／Gatekeeper 或 workflow。
- 解讀：本輪只是確認外部狀態沒有變化，並保留可重現的 bounded fail evidence；後續仍需外部管理者配置並核驗 Environment／審核者／秘密範圍／protected branch，以及受控 runner 的 Apple identity／keychain profile／notarization，才可另立 workflow run。既有 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false`、全機 egress、Windows 與 FR-021 overall residual 維持未完成。

## 2026-10-29 FR-021 recent governance status consistency synchronization

- 已將最近 `FR-021 Chromium nested sandbox process-composition` 與 `shared runner provenance projection` 摘要中殘留的「待 round2／final gate」文字，對齊 `08-CHANGE-LOG.md` 與 `07-DEBUG-AND-FIX-HISTORY.md` 已完成的 round2／治理 closeout；原始 evidence／review 均保留，未回溯改寫審查結論。
- 這只是治理狀態一致性修正，不新增 runtime evidence；`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false`、Developer ID／notarization external boundary、全機 egress、Windows 與 FR-021 overall residual 維持未完成。

## 2026-10-29 FR-021 shared runner provenance projection round2 governance closeout

- 目前 `projectRunnerProvenance()` 不接受 caller-supplied `argvProjection`，live／offline verifier 均傳 raw argv 並由 shared helper 重新套用 `sanitizeRunnerArgv()`；key-set parity、hash／path／secret boundary 與 bypass regression 均通過。
- 指定 syntax、offline UI／provider tests、治理 validator、完整 `npm run check`、`git diff --check` 與 next1 六面向獨立審查均通過；報告 `docs/project-management/reviews/2026-10-29-fr-021-evidence-provenance-shared-projection-next1-round1.md` 的唯一 finding 是 round2 governance sync，已回填 00／06／07／08。
- 本項只結案 shared runner provenance projection／schema parity 的 deterministic/local contract；沒有新增 live runner／network／Ollama／Electron replay，不代表 Seatbelt offline、全機 egress、Windows、signed／notarized release 或 FR-021 overall acceptance。

## 2026-10-29 BUG-061 provider regression coverage precision bounded closeout

- `scripts/test-ai-providers.mjs` 現以實際 Ollama native proofread request body 直接斷言 `text.type`／`reason.type` 為 string；既有 custom native 404 fallback body stripping／exact two requests、400／500／strict failure no-fallback、translate schema 與其他 provider regression 均保持通過。
- focused tests、完整 `npm run check`、治理 validator、`git diff --check` 與 next1 六面向獨立審查均通過；報告 `docs/project-management/reviews/2026-10-29-bug-061-regression-coverage-next1-round1.md` 的唯一 finding 是治理同步，已回填 06／07／08。
- 本項只結案 test-only deterministic provider regression precision；不代表 BUG-060 runtime source 已重新結案、live Ollama／model quality、Electron UI、Windows、offline／full egress、release 或 FR-021 overall acceptance。其他 dirty source／evidence 保留原狀。

## 2026-10-29 BUG-055 Ollama strict UTF-8 NDJSON stream fail-closed bounded closeout

- Ollama native strict reader 現以 fatal UTF-8 decoder、EOF flush 與 no-byte-reader fail-closed contract 阻擋 invalid byte／truncated final sequence；reader failure cleanup、abort／timeout／transport 分類與 optimizer 不 repair／不 retry／不 checkpoint 均有 deterministic regression。
- BUG-055 focused tests、完整 `npm run check`、`git diff --check` 與 round1 六面向獨立審查已通過；round1 唯一 finding 是 08 closeout 欄位，已回填並保留報告 `docs/project-management/reviews/2026-10-29-bug-055-ollama-strict-utf8-next1-round1.md`。本輪不納入同一 dirty worktree 的 BUG-060／BUG-061 routing／schema。
- 本項只結案 current dirty source 的 deterministic／local UTF-8 stream contract；不代表真實 Ollama raw response、模型／版本、Windows、offline／full egress、packaged UI、簽署／公證、release 或 FR-021 overall acceptance。其他 dirty source 保留原狀。

## 2026-10-29 FR-021 macOS signed-canary notarytool keychain-profile runtime resolution preflight

- signed-canary workflow 現在在建立 run-scoped output directory／進入 builder 前，以固定非秘密 `APPLE_KEYCHAIN_PROFILE: osf-signed-canary` 執行 `xcrun notarytool history --keychain-profile "$APPLE_KEYCHAIN_PROFILE" --output-format json --no-progress`；stdout／stderr 丟棄，probe 非 0 即 fail-closed，沒有 unsigned／ad-hoc fallback。兩個實際 submit 仍只使用 `--keychain-profile`。
- round1 發現 focused mutation 可在 probe 後附加 `|| true` 而 false-pass；round2 確認 negative lookahead、explicit `|| true` guard 與 targeted mutation assertion 已關閉 F-01。focused／完整 `npm run check`、YAML／syntax／diff checks 均通過。
- allowlist-only source commit `f16ae8be60fb132bdbb1a128722a244f70f86e6b` 已推送，local／remote branch SHA 精確一致；next12 external-boundary evidence `docs/project-management/evidence/2026-10-29-fr-021-macos-signed-canary-external-boundary-next12.json` status `fail`、mode `0600`、SHA-256 `a0283d10dd4420744aff7fa676d8e9a6a4da7276b10548621544a80dbece6376`，remote workflow／source match，Environment／reviewer／secret metadata／branch protection 仍缺失，`secretValuesRead=false`。
- 本輪只完成 builder 前 profile-resolution source／local contract；不代表 self-hosted runner 實際 profile provisioning／resolution、notarytool、workflow、Apple identity、signing／notarization／ticket、Gatekeeper、release 或 FR-021 overall；不在本機執行 probe。

## 2026-10-29 FR-021 macOS signed-canary notarytool keychain-profile argv hardening

- signed-canary readiness／builder／dual notary workflow steps 現固定使用 runner keychain profile label `osf-signed-canary`；兩個 `xcrun notarytool submit` 只使用 `--keychain-profile`，不再將 Apple ID、Team ID 或 app-specific password 注入 workflow 或 process argv。readiness summarizer 與 keychain-only route focused regression 已同步，external-boundary 不再要求未使用的 Apple credential secret names。
- round1 獨立審查結論為 bounded source／local contract 有條件通過，未發現 source／test technical finding；完整 `npm run check`、focused gate／readiness／external-boundary tests、syntax、YAML parse 與 `git diff --check` 通過。source-only commit `ce72b64f8aa2b937e1b589e1b9577835dd691ca8` 已推送，local／remote branch SHA 精確一致。
- push 後 external-boundary `next11` status `fail`、mode `0600`、SHA-256 `d6364070c4cb9ee87f91b8c3a2c99018f97c4d30526cfa39cfd8d4a8b1813f4c`；remote branch／workflow present 且 source matches local，Environment／required reviewer／secret metadata／branch protection 仍 `not-found`，`secretValuesRead=false`。
- 本輪只完成 argv／credential-route source hardening，不代表 self-hosted runner 實際 keychain profile provisioning／resolution、Apple identity、notarytool、workflow run、notarization／ticket validity、stapler、Gatekeeper、release 或 FR-021 overall；keychain profile 仍待外部受控 runner 配置與實跑驗證。

## 2026-10-29 FR-021 macOS signed-canary ZIP target coverage hardening

- signed-canary selector 現唯一選出 `mac-arm64` 直接子項主 `.app`、output root 單一 DMG 與單一 ZIP；workflow 分別保留送審前 DMG／ZIP、對兩者取得 run-scoped Accepted notary projection、staple app／DMG，並以 stapled app 重建 final ZIP。distribution audit 綁定 submitted／final DMG／ZIP digest、embedded app executable digest、dual notary、stapler／hdiutil／ZIP integrity 與 0600 bounded evidence，cardinality／notary／repack／archive mismatch 均 fail-closed。
- round1 獨立審查發現 `ditto -t -k` 不受目標 macOS 支援、malformed／non-UTF-8 notary output 未保留 raw digest／bytes、workflow positional／0600／cleanup mutation guard 不足；已改用 `/usr/bin/unzip -tqq`、raw `Buffer` + fatal UTF-8 provenance、對稱 negative matrix 與完整 positional／mode／cleanup guards。round2 獨立複審確認 F-01／F-02／F-03 全部關閉，bounded source／local contract 有條件通過。
- focused selector／gate／distribution tests、Darwin arm64 audit-main fixture、指定 syntax、YAML parse、`git diff --check`、完整 `npm run check` 與治理 validator 均通過。source-only commit `3a8f04080d810fae55df6b58b5b1b4991a2632ba` 已推送，local／remote branch SHA 精確一致；push 後 external-boundary `next10` status `fail`、mode `0600`、SHA-256 `c046a1a2f295c4960ce18020391ed778aa0e92c107f50c9daaca90052d41b16a`，remote branch／workflow present 且 source matches local，Environment／secret metadata／branch protection 仍 `not-found`，`secretValuesRead=false`。
- 本輪不代表實際 GitHub workflow run、Developer ID／codesign、Apple notarization／ticket validity、stapled candidate、Gatekeeper、release、packaged UI、Windows、全機 egress 或 FR-021 overall；notary password argv 與外部 Environment／identity／credential 仍是後續 residual。

## 2026-10-29 FR-021 macOS candidate malformed-metadata bounded evidence hardening

- `normalizeBundleExecutableName()`、nullable binary hash、固定 6-object evidence cardinality 與 strict 64-hex digest gate 已修正兩支 read-only macOS signed-canary／packaged-identity audit；malformed／missing `CFBundleExecutable` 現在留下 0600 `status: fail` evidence，而非在 writer 前因 path/hash exception 中止。
- focused test 以 fake-darwin 子程序實際驗證兩支 audit 的 malformed `.app` bounded fail evidence、`candidate-metadata-not-ready`、null digest、固定 objects 與 0600；`npm run check`、治理 validator、`git diff --check` 與 round2 獨立複審均通過。source-only 4-path commit `ae599e780fc246910e8e625c142c2af0ac87b412` 已推送並完成 remote SHA read-back；current-source external-boundary `next9` status `fail`、mode `0600`，remote source／workflow match，Environment／secret metadata／branch protection 仍缺失，`secretValuesRead=false`。
- 本項只結案 malformed candidate evidence contract；round2 為有條件通過並已完成治理 closeout，不代表真實 workflow run、Developer ID／notarization、Gatekeeper、packaged UI、Windows、全機 egress 或 FR-021 overall。ZIP coverage、notary password argv、tracked evidence mode 與 external signing／Environment residual 維持。

## 2026-10-29 FR-021 macOS signed-canary remote source handoff closeout

- 精確 23-path source-only handoff 已建立 commit `8dd82fbe71e754616d1c87971670e1e5ad5bf7bc`（`feat: publish macOS signed-canary handoff`），並 fast-forward 推送至 `refs/heads/codex/0.51-anthropic-claude`；`git ls-remote` 回讀同一 SHA，remote workflow content 已存在（blob SHA `1d6489e9057c499eb7330b810c75832fc6fe16cd`、size `9112`）。dirty AI／Ollama／UI／其他 evidence／reviews 未納入該 commit。
- authoritative readiness `next4` 綁定本輪 audit script／package／focused test bytes，status 仍為 `blocked-external-signing-identity`；push 後 read-only external-boundary `next7` status `fail`、mode `0600`、SHA-256 `6a343e7ce595f197c544ed6137c4298cee492615cefe0d692af11fe22b59b60b`，remote branch／workflow present 且 source matches local HEAD，但 Environment、environment secret metadata、branch protection 均 `not-found`，`secretValuesRead=false`，未修改 remote／讀取 secret value／觸發 workflow。
- round4 獨立治理複審為有條件通過，source-only handoff 可追溯並完成治理 closeout；仍不得宣稱 workflow run、Developer ID identity／credential、signed／notarized candidate、release、Seatbelt renderer、全機 egress、Windows 或 FR-021 overall。P2 result cleanup、ZIP coverage、malformed-candidate evidence、notary password argv、tracked evidence mode 與 ignored runtime fixture reproducibility 保留。

## 2026-10-29 FR-021 macOS signed-canary result evidence cleanup hardening

- workflow final `always()` cleanup 現以 run ID 綁定並移除 checkout 內 `docs/project-management/evidence/ci-${GITHUB_RUN_ID}-macos-signed-canary-result.json`；focused gate test 以 mutation regression 綁定實際 `rm -f -- "$result_evidence"`，並以隔離 filesystem probe 核對 regular file、leaf symlink 與 directory boundary。
- source-only cleanup commit `4fdbcc279409690ed39ff922703e328bb49a741b` 已推送至 `codex/0.51-anthropic-claude`，remote SHA／workflow metadata 一致。push 後 next8 external audit 仍為 `fail`，但 remote workflow／source match 已確認；Environment、secret metadata、branch protection 尚未設定，未觸發 workflow 或讀取 secret value。
- round2 獨立複審有條件通過；此項只完成 source cleanup contract，不代表 self-hosted workflow run、Apple signing／notarization、signed candidate、release 或 FR-021 overall。

## 2026-10-29 FR-021 macOS signed-canary external boundary audit next stage

- 新增 `scripts/audit-macos-signed-canary-external-boundary.mjs` 與 `scripts/test-macos-signed-canary-external-boundary.mjs`：audit 只以固定 `gh api --hostname github.com` 唯讀查詢 remote branch ref、`macos-signed-canary` Environment、environment secret metadata、branch protection 與 workflow content presence；不保存 raw API output、secret value、reviewer name 或 token。
- authoritative `docs/project-management/evidence/2026-10-29-fr-021-macos-signed-canary-external-boundary-next6.json` status `fail`、mode `0600`、SHA-256 `bb21059bb0408f0f6643f81b9e1911df20a06a4563cdd272f62de612e739a40a`：remote branch 存在於 SHA `22f7a09767923973c698fa817c543a1e586495f4`，但 Environment、environment secret metadata、branch protection 與 workflow content 均為 404，local HEAD `c06d15e95a2f0a0981518c5873003a460e57a5ee` 尚未在 remote branch，且 local workflow 仍是 dirty uncommitted source；scope 正確區分 `secretMetadataRead=true` 與 `secretValuesRead=false`。required reviewer projection 已要求非空且結構有效 metadata，git status failure 已 fail-closed。
- next1／next2／next3 first-run evidence 保留未覆寫；其中 next1／next2 捕捉 `gh` 未固定 host、next3 捕捉 audit owner typo，均已由 focused response regression／`--hostname github.com`／`twyderek` 修正後以 next4 重跑。此輪只完成 remote boundary observation，不建立 Environment／reviewer／secret／protection、不觸發 workflow、不解除 Developer ID／notarization、Seatbelt renderer、全機 egress、Windows、LM Studio 或 FR-021 overall residual。

## 2026-10-29 FR-021 signed-canary distribution evidence hardening next stage

- signed-canary workflow 現改用 `scripts/select-macos-signed-canary-artifacts.mjs` 與 `lib/macos-signed-canary-artifact-selection.mjs` 選取 run-scoped output：只接受 `mac-arm64` 直接子項的單一主 `.app` 與 output root 的單一 `*-macos-arm64.dmg`，主 app 內 nested Helper.app 不會被計入；focused fixture 實際建立 nested Helper.app 並覆蓋 missing／duplicate cardinality fail-closed。
- workflow 的 notarytool success 只投影為固定 run-scoped JSON output 的 0600、parseable command result；audit 以 run ID、output basename、DMG SHA-256 與 output digest/status 綁定，不把 caller-supplied success tuple 當作信任根。`scripts/audit-macos-signed-canary-distribution.mjs` 另外保存 app executable／DMG SHA-256、DMG `stapler validate` 與 `hdiutil verify` command summaries、source provenance、scope 與 privacy schema。distribution evidence 先複製至 bounded CI artifact，再移除 repository 工作樹中的暫存 evidence，之後才執行既有 app result audit。
- 本輪 focused distribution schema／privacy／scope／cross-field negative matrix、完整 `npm run check`、workflow YAML parse、相關 syntax 與 `git diff --check` 已通過；workflow 仍未觸發，沒有實際 signing／notarization／stapler／hdiutil、Developer ID identity 或 signed candidate。notarytool projection 不等同 Apple ticket validity，FR-021 overall、Seatbelt renderer、全機 egress、Windows 與 LM Studio residual 維持。

## 2026-10-29 FR-021 macOS signed-canary CI handoff next stage

- 新增只由 `workflow_dispatch` 觸發的 `.github/workflows/macos-signed-canary.yml`；它限定 `self-hosted`／`macOS`／`arm64`／`osf-signed-canary` runner，要求 runner 事先具備 Developer ID Application identity，並以固定非秘密 `APPLE_KEYCHAIN_PROFILE: osf-signed-canary` 供 readiness／builder／notary steps 使用；builder 前另以 `notarytool history --keychain-profile` 做 read-only profile resolution probe。workflow 未在本輪觸發，也不匯入或建立 keychain identity。
- handoff 順序固定為 source checks → 去敏 readiness evidence → 正式 `assert-macos-signed-canary-ready.mjs` gate → builder → notarytool → stapler → post-build result audit；readiness 不能取代正式 gate，gate 未 ready 時只保存 bounded artifact 並停止，且不存在 unsigned／ad-hoc fallback。workflow 另要求 protected current ref、`macos-signed-canary` environment reviewers、immutable action SHA、concurrency 與 run-scoped output directory，避免 persistent runner stale candidate。
- 目前本機仍 `security find-identity -v -p codesigning` 為 0 valid identities、notarization credential absent；因此本輪只完成外部環境交接 contract，不宣稱 workflow、signed／hardened candidate、notarization、Gatekeeper、renderer、offline、Windows 或 FR-021 overall 已通過。

## 2026-10-29 FR-021 external prerequisite readiness recheck next stage

- 重新執行既有 read-only macOS signing readiness audit；next1 first-run `docs/project-management/evidence/2026-10-29-fr-021-prerequisite-readiness-recheck-next1.json` status `blocked-external-signing-identity`、mode `0600`、SHA-256 `6f5447d8b0244a27eef0fdbf5b3f58cd17f071c08b7351912ab4c27424ebe8a4` 保留為 immutable baseline。修正 derived-field consistency 與 focused fixture 後，authoritative next2 `docs/project-management/evidence/2026-10-29-fr-021-prerequisite-readiness-recheck-next2.json` status `blocked-external-signing-identity`、mode `0600`、SHA-256 `b7ee6038368f946fd7ead6c7ca11255f88e8e86d87cfc87da4881fe5db4dc031`；source HEAD `c06d15e95a2f0a0981518c5873003a460e57a5ee`、working tree dirty、source／package／focused-test provenance 與 existing evidence gate 均通過。
- 目前 required `codesign`／`xcrun`／`notarytool` toolchain 與 source config 均 ready，但 identity query 成功且 `validIdentityCount=0`、`formalIdentityAvailable=false`；11 個 credential presence flags 全 false、notarization status `absent`、`notarizationCredentialReady=false`。沒有執行 signing／notarization／keychain／candidate／packaged app／UI／Ollama／model／network。
- 同步唯讀 capability probe 仍確認 `/usr/bin/sandbox-exec` 可用、`ollama` 可執行且 `llama3.2:3b`／`llama3.2:1b` 已預裝；這只表示可進行既有 bounded local probes，不解除 nested Chromium renderer 或 true full-egress requirement。
- 下一個 signed／hardened 階段需外部提供核准的 Developer ID Application identity／entitlements 與完整 notarization credential；本次 readiness recheck 不宣稱 signed package、renderer acceptance、Seatbelt offline UI、全機 egress 或 FR-021 overall 完成。

## 2026-10-29 FR-021 current-source normal-loopback 3B live evidence provenance hardening next stage

- 新增 `scripts/verify-electron-ollama-ui.mjs` 的 live evidence schema v5／`replayProvenance`，以 `git HEAD`、dirty worktree status digest、runner／shared provenance／package manifest hash、normalized invocation、runtime environment 與 renderer-ready 後重新讀取並 hash 的 loaded candidate／review.js／Framework bytes 綁定一次 replay；`loadedBytesObservation=renderer-ready-file-read` 只代表重新讀取檔案 bytes，要求與 pre-launch hashes 相等，不等同 memory-mapped bytes、runtime loader 或記憶體映射 introspection。source path、完整 raw command、secret、token 與 raw child output 不落盤，缺欄位以 `REPLAY_PROVENANCE_UNAVAILABLE` fail-closed。
- next1 first-run evidence `docs/project-management/evidence/2026-10-29-fr-021-evidence-provenance-next1.json` status `pass`、mode `0600`、SHA-256 `aa35a2cc9b5e75dcc3886941ec98fc2a011ae0d365cd5b068007e11c39286bfe` 保留作 immutable finding；round1 指出 `worktreeDirty` invariant、replay-time bytes 語意與 invalid fixture 覆蓋不足。修正後 authoritative next2 `docs/project-management/evidence/2026-10-29-fr-021-evidence-provenance-next2.json` status `pass`、mode `0600`、SHA-256 `9a159170c0c4dfeac9112dff755fc68f6cd1356445a9396ef49d0fe42d0f19e3`；`sourceProvenanceComplete=true`／`provenanceComplete=true`，source HEAD `c06d15e95a2f0a0981518c5873003a460e57a5ee`、worktree dirty digest、runner／package bytes、normalized invocation、environment、pre-launch／renderer-ready loaded hashes 與 equality 均保存。
- 同一 run 仍實際通過 cancel POST HTTP 200／accepted／cancelled、checkpoint 1/6、第一／第二次 Electron process group／app server port cleanup、同一 userData／session／checkpoint app restart、resume 1 至 6/6、accept／undo／redo／SRT／timecode invariant 與 cleanup；scope 仍為 normal loopback，`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`。
- 本階段只補 F-02 evidence provenance；`loadedBytes` 是 renderer-ready 後的檔案重讀觀測，不是 runtime memory introspection，也不保存 dirty files 全文。round2 獨立複審為有條件通過，治理 closeout 已同步至 08；不宣稱 Seatbelt offline、全機 egress、signed／notarized package、Windows、LM Studio 或 FR-021 overall；既有 next1／next2 app-restart evidence 與 review 原件保留未覆寫。

## 2026-10-29 FR-021 current-source packaged UI normal-loopback 3B app-restart resume replay next stage

- next1 first-run `docs/project-management/evidence/2026-10-29-fr-021-ui-normal-3b-app-restart-resume-next1.json` 曾通過 bounded UI／resume，但 round1 發現第二次 app server port 未實際保存／驗證，故保留為 immutable first-run。修正後 authoritative next2 `docs/project-management/evidence/2026-10-29-fr-021-ui-normal-3b-app-restart-resume-next2.json` status `pass`、mode `0600`、SHA-256 `e95aa0524fdc32684a49c03bc4c22942afe012657d77dedd6c95e66903256f24`：第 1 批完成後 cancel，cancel POST HTTP 200／accepted／cancelled，checkpoint 1/6 persisted。
- 第一個 Electron process group 與 app server port 已確認關閉；同一 temporary userData／job root 保留給第二次啟動，第二次 packaged UI 讀回同一 session／checkpoint，第二次 app server port 已捕獲且最終關閉，page time-origin 改變，resume 從 batch 1 至 6/6 完成；accept 6、undo／redo、`reviewed.srt`、timecodes／original SRT invariant 與最終 cleanup 均通過。
- scope 仍明確為 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`、`loopbackOnlyConfiguration=true`、`apiKeySupplied=false`；只補 3B normal-loopback app-restart lifecycle，不宣稱 Seatbelt offline、全機 egress、signed／notarized package、Windows 或 FR-021 overall。F-03 cancel POST observability 已由本 evidence 補強，F-02 source／command provenance 仍保留為後續改善。
- focused contract、完整 `npm run check`、治理 validator、`git diff --check` 與 next2 replay 均通過；round1 已指出並修正第二次 port cleanup blocker，round2／round3 獨立複審與 `npm run docs:check:final` final docs closeout 均完成。external Developer ID／notarization 與 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` Seatbelt blocker 保留。

## 2026-10-29 FR-021 current-source packaged UI normal-loopback 3B cancel-resume replay next stage

- 使用同一 macOS arm64 current candidate、預裝 `llama3.2:3b` 執行 normal-loopback packaged UI cancel／checkpoint／resume replay。evidence `docs/project-management/evidence/2026-10-29-fr-021-ui-normal-3b-cancel-resume-next1.json` status `pass`：6 cues／6 batches，第 1 批完成後實際取消，checkpoint 持久化 1 suggestion，reload 後 same session／checkpoint 還原，從 batch 1 resume 至 6/6 完成。
- UI lifecycle 實測通過 home／review、Ollama local settings、API key empty／local privacy、accept 6、undo／redo、`reviewed.srt` 6 cues、timecodes／original SRT unchanged；Electron／server／port／temporary userData／既有 Ollama scope cleanup 全部通過，raw child output 未保存。
- scope 明確為 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`、`loopbackOnlyConfiguration=true`、`apiKeySupplied=false`；只補 3B normal-loopback lifecycle，不宣稱 Seatbelt offline、全機 egress、signed／notarized package、Windows 或 FR-021 overall。evidence mode 0600、SHA-256 `397983b2388083c64c161c7f0e3bf340be4c919bde1abcc7da532c661545e31c`。
- focused／完整驗證、治理 validator、`git diff --check`、round1 lifecycle 審查與 round2 closeout 複審已通過；F-02 evidence provenance 與 F-03 cancel POST observability 保留為非阻擋改善建議，external Developer ID／notarization 與 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` Seatbelt blocker 保留。

## 2026-10-29 FR-021 current-source packaged UI normal-loopback 3B replay next stage

- 以既有 macOS arm64 current candidate executable、預裝 `llama3.2:3b` 執行 normal-loopback packaged UI replay。next1／next2 先在校閱頁導覽階段失敗，renderer 已啟動且 cleanup 通過；diagnostic 收斂為 reviewer navigation 的去敏 `cueCount=0`。
- 根因是 acceptance runner 將含 API token 的首頁 URL 去敏後仍從去敏 URL 取 token，導致後續 review navigation 的 `/api` 請求缺少 token；這是 runner bug，不是產品 UI／Ollama／3B model failure。修正後 token 只在記憶體傳遞，evidence 只保存 local URL／title／status，不保存 token。
- 同步將 normal verifier evidence writer 改為 exclusive owner-only `0600`，並加入 source regression。next3 `docs/project-management/evidence/2026-10-29-fr-021-ui-normal-3b-replay-next3.json` status `pass`：home／review、Ollama settings、2 cue AI translate、accept 2、undo／redo、`reviewed.srt`、timecodes unchanged、English translation 與 Electron／server／port／temporary cleanup 全通過；`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、API key false。
- next3 candidate executable SHA-256 `b3605c589459068f894a70896b8ed843be3832a839fcdd83aa898e9b16210de4`，Framework SHA-256 `416b6c8cf74c59188266d3ff7a3fc77b9f68bb52f7328d98b382d132580c8cee`；evidence mode 0600、SHA-256 `b275d0e03f2c503df5eb6591d0059a1bee93aa8769ce17f5aad0aef0e9b0ae77`，privacy scan 未見 token／absolute path／raw child output。
- focused UI contract、完整 `npm run check`、round1／round2／round3 獨立複審與 `git diff --check` 已通過；round3 報告確認 F-01 home-probe source-region false-pass 與 F-02 canonical governance mismatch 均已關閉，本條目已完成治理 closeout。這只證明 macOS arm64／current candidate／3B／normal loopback，不解除 Seatbelt nested Chromium blocker、全機 egress、signed／notarized package、Windows 或 FR-021 overall。

## 2026-10-29 FR-021 current-source packaged UI Seatbelt offline replay next stage

- 以既有 macOS arm64 candidate `../dist/mac-arm64/離線字幕工廠.app`、預裝 `llama3.2:3b`、Ollama 與 `/usr/bin/sandbox-exec` 執行 bounded current-source packaged UI offline replay。next1／next2 均在 `electron_start` 以 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`SIGTRAP` 失敗，未進入 home／AI flow；不能宣稱 UI offline pass。
- Seatbelt evidence 顯示 loopback allowed、external socket `EPERM`、daemon／Electron process tree 繼承 sandbox、`modelDownloadAttempted=false`、API key／external provider false；daemon／UI process group、port、temporary root cleanup 均確認通過，`systemNetworkDisabled=false`。
- next1 原件 `docs/project-management/evidence/2026-10-29-fr-021-ui-offline-replay-next1.json` 保留作歷史 first-run（mode 0644）；修正 wrapper exclusive create 後，authoritative next2 `docs/project-management/evidence/2026-10-29-fr-021-ui-offline-replay-next2.json` mode 0600，SHA-256 `63c9ece60a2b6ce5c5021293a556332cc695eecbbf8eb863be210ae3ddd793c8`。這只收斂 current-source renderer／Seatbelt blocker，不解除 signed identity、全機 egress、Windows 或 FR-021 overall。
- round1 獨立審查確認 bounded failure contract 有條件通過；`npm run check`、focused contract、治理 validator、`git diff --check` 與 `npm run docs:check:final` 均通過。這只結案 failure evidence／0600 hardening／cleanup scope，不代表 packaged UI pass、全機斷網、signed package、Windows 或 FR-021 overall。

## 2026-10-29 FR-021 signed canary post-build verification contract

- 新增 `lib/macos-signed-canary-verification.mjs`、`scripts/audit-macos-signed-canary-result.mjs`、`scripts/test-macos-signed-canary-result.mjs` 與 `audit:mac:signed-canary`。post-build audit 只在 future signed candidate 上唯讀檢查主 app、Electron Framework、四個固定 helper 的 Developer ID Application／Team ID 一致性／runtime flag／完整 entitlements plist、stapler validate 與 Gatekeeper notarized acceptance；未知、空白、矛盾或非 allowlisted Apple output 一律 fail-closed。
- signed canary 現使用獨立 `electron-builder.signed-canary.mjs`：它從既有 build config 複製資源／target，再只對 signed canary 省略 explicit identity 以使用 auto-discovery，並開啟 hardened runtime 與 Gatekeeper assess；既有 `electron:build:mac:dir`／`electron:build:mac` 仍保留 `identity: null`、hardened／Gatekeeper false 的 development／unsigned semantics。
- 本輪沒有 signed candidate 可供 audit，因外部 identity 仍為 0；沒有執行 codesign／stapler／spctl、builder、notarization、packaged app、UI／AI／Ollama／model／network。最新 gate execution4 `docs/project-management/evidence/2026-10-29-fr-021-signed-canary-gate-execution4.json` mode 0600，gate／focused-test SHA-256 與目前 source 一致，builder／candidate／scope flags 全 false。post-build contract 的 dirty worktree／未具備 candidate 只會 fail-closed，不代表 signing、notarization、Gatekeeper、renderer 或 FR-021 完成。

## 2026-10-29 FR-021 signed canary build gate

- 新增獨立 `npm run electron:build:mac:signed-canary`，在任何 runtime manifest 或 electron-builder 動作前唯讀核對 macOS arm64、auto-discovery／hardened／Gatekeeper source config、有效 `dmg／zip／dir` arm64 targets、required `codesign`／`xcrun`／`notarytool`、Developer ID Application identity 與單一 complete notarization credential set；只輸出去敏 boolean／分類／阻擋原因，不保存 secret、identity name／hash、raw output、絕對路徑或 keychain 內容。
- 目前實際 gate 結果為非零停止：`developer-id-application-not-ready`、`notarization-credential-set-not-ready`；`sourceConfigReady=true`、required toolchain ready，但 `validIdentityCount=0`／`formalIdentityAvailable=false`、credential status `absent`。本次未進入 runtime manifest 或 electron-builder，未建立 candidate；去敏 gate evidence `docs/project-management/evidence/2026-10-29-fr-021-signed-canary-gate-execution2.json` mode 0600 且 execution／scope flags 全 false。
- `electron:build:mac:dir`／`electron:build:mac` 既有 unsigned／development semantics 未變；新 gate 只保護 future formal signed canary。這不代表 signing、effective entitlements、notarization、renderer／UI／AI／Ollama／model／network acceptance 或 FR-021 完成。

## 2026-10-29 FR-021 signed canary／notarization prerequisite preflight

- audit12 `docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit12.json` 延續去敏 notarization credential matrix：Apple ID／app-specific password／team ID、App Store Connect API key 三件組與 keychain profile 均為 absent；`notarizationCredentialReady=false`。credential presence、notarization summary、decision 關聯、所有 nested leaf schema、有效 arm64 mac target 與 generic POSIX／Windows path leakage 均 exact fail-closed；只保存 presence／完整性布林，未讀取或保存 secret、raw output、絕對路徑或檔案內容。audit11／audit10／audit9／audit8 保留為前輪 immutable 原件。
- source config 仍為 auto-discovery、hardened／Gatekeeper true，required toolchain／existing evidence／audit script／focused test／git provenance／privacy 均通過；本機 `validIdentityCount=0`，所以 status 仍為 `blocked-external-signing-identity`、`formalSigningReady=false`。
- 本輪未執行 signing／notarization／packaging／keychain／candidate／packaged app／renderer／UI／AI／Ollama／model／network；取得外部 Developer ID identity 後，須先通過 credential preflight，再另立隔離 signed canary 並實測 effective entitlements。

## 2026-10-29 FR-021 formal packaging source configuration readiness（歷史 preflight）

- 前一輪曾以 source package config 直接準備 auto-discovery／hardened／Gatekeeper；本輪已將該 formal path 收斂至獨立 `electron-builder.signed-canary.mjs`，恢復既有 `build.mac` 的 development／unsigned boundary。歷史 audit7 保留為當時 immutable record，不代表目前 base build config。
- readiness audit7 `docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit7.json` 驗證 source config 為 `identityConfiguration=auto-discovery`、hardened／Gatekeeper true、`sourceConfigReady=true`；required toolchain、既有 immutable evidence、source／package／focused-test／git provenance 與 privacy scope 均通過。audit6 保留為 round1 finding 前的 immutable record。
- 本機 identity probe 仍為 `0 valid identities found`、`formalIdentityAvailable=false`，所以 decision 仍為 `blocked-external-signing-identity`，`formalSigningReady=false`。本輪未建立 signed／hardened candidate、未執行 signing／notarization／packaged app／UI／AI／Ollama／model；取得外部 Developer ID Application identity／entitlement 後才可另立隔離 canary。

## 2026-10-29 FR-021 formal signing／hardened-runtime readiness audit

- readiness audit5 `docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit5.json` 以去敏、exclusive、source-revision-bound evidence 記錄：macOS arm64 工具鏈 required `codesign`／`xcrun` 可用，`xcrun --find codesign`／`notarytool` 成功，但 `/usr/bin/security find-identity -v -p codesigning` 為 `0 valid identities found`，`formalIdentityAvailable=false`。audit1／audit2／audit3／audit4 保留為 immutable parser／gate 修正前原件，audit5 為目前 authoritative readiness evidence。
- 現行 source macOS config 仍為 `identity: null`、`hardenedRuntime: false`、`gatekeeperAssess: false`、無 entitlements；本輪不修改正式 package config，不建立／匯入 identity、不改 keychain、不 signing／notarization、不執行 candidate／UI／AI／Ollama／model。
- readiness script 在寫檔前以 executable gate 驗證 identity probe、required／optional toolchain contract、恰好兩份固定 existing evidence、完整 scope key allowlist／type、source／package／git provenance、credential presence 與 path／raw output／secret leakage；focused regression 覆蓋 command failure、malformed output、toolchain failure、空／單／重複 evidence、污染 evidence、unknown scope key、型別錯誤與 privacy fail-closed。
- 結論：`blocked-external-signing-identity` 是外部 packaging prerequisite，不是 renderer diagnosis 或 FR-021 pass。下一步需取得核准的 Developer ID Application identity／entitlements，才另立隔離 signed／hardened packaging canary；在此之前不重播同一 ad-hoc runtime probe。

## 2026-10-29 FR-021 ad-hoc runtime code-sign canary

- 從前一輪 repo 外 canary 建立全新副本，只在新 candidate 上執行 `codesign --force --deep --sign - --options runtime --timestamp=none`；audit2 的 required-runtime gate 顯示主 app、Framework 與 4 個 helper 共 6 個 object 均為 `0x10002(adhoc,runtime)`、deep verify 通過，仍無 Team ID／entitlement。signing operation evidence 為 `docs/project-management/evidence/2026-10-29-fr-021-adhoc-runtime-signing-canary-sign1.json`，authoritative audit 為 `docs/project-management/evidence/2026-10-29-fr-021-adhoc-runtime-signing-canary-audit2.json`；audit1 保留為 gate 修正前 baseline，既有 candidate 未修改。
- 對新 runtime-flag candidate 執行兩次 bounded startup-only probe：`--single-process` 與 `--no-zygote` 均無 local page／CDP，child `SIGABRT`，但 process group／temporary cleanup 均通過；證據為 `docs/project-management/evidence/2026-10-29-fr-021-adhoc-runtime-signing-canary-startup-probe1.json` 與 `...startup-probe2.json`。未跑完整 UI／AI／Ollama／model，`systemNetworkDisabled=false`。
- 結論：runtime CodeDirectory flag 的確可在隔離 ad-hoc bundle 上形成，但不能解除 nested Chromium renderer blocker；不把 ad-hoc runtime flag 當正式簽章或 acceptance workaround，FR-021 仍未完成。

## 2026-10-29 FR-021 isolated hardened-runtime packaging canary

- 以 repo 外 `../dist/fr-021-hardened-runtime-canary` 執行 `electron-builder 26.17.0 --mac --arm64 --dir --publish never`，CLI 要求 `mac.hardenedRuntime=true`；builder 明確回報因 `identity` 為 `null` 而跳過 macOS code signing。新 candidate 未執行、未修改既有 `../dist/mac-arm64/離線字幕工廠.app`，未啟動 UI／Ollama／model。
- 新 candidate 的 audit `docs/project-management/evidence/2026-10-29-fr-021-hardened-runtime-packaging-canary-audit1.json` 顯示 6 個 code object 全部 deep verify，但仍全為 ad-hoc、無 Team ID、無 entitlement，helper inventory complete；Electron Framework hash 與 current candidate 相同。建置／解讀記錄在 `docs/project-management/evidence/2026-10-29-fr-021-hardened-runtime-packaging-canary-build1.json`。
- 因 CLI hardened request 沒有形成有效 security identity 對照，本階段依 fail-closed 計畫停止，不做 renderer startup replay；建置過程曾下載 Electron dependency，已在 scope evidence 揭露。這沒有證明或解除 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`，也不代表 UI offline、全機 egress、Windows 或 FR-021 完整驗收。
- 後續只讀 `security find-identity -v -p codesigning` 回報 `0 valid identities found`，已保存於 `docs/project-management/evidence/2026-10-29-fr-021-hardened-runtime-packaging-canary-signing-identity-check1.json`；因此下一個 signed／hardened 對照需要外部 signing identity／entitlement 能力。

## 2026-10-28 FR-021 packaged Electron helper signing／entitlement audit

- 對目前 `../dist/mac-arm64/離線字幕工廠.app` 的 read-only audit3 已完成：主 app、Electron Framework 與 4 個 packaged helper 共 6 個 code object 均通過 `codesign --verify --deep --strict`，但全部是 ad-hoc、沒有 Team ID、沒有 entitlement；candidate version／bundle ID／main executable 與 Framework SHA-256，以及完整 helper inventory 已保存於 `docs/project-management/evidence/2026-10-28-fr-021-packaged-security-identity-audit3.json`。audit2 保留為 round1 前的 immutable baseline。
- 目前 source packaging config 為 `identity: null`、`hardenedRuntime: false`、`gatekeeperAssess: false`。這指出可另立正規 signed／hardened packaging canary 的 follow-up seam，但不能單獨證明 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` 的唯一根因，也不能把 ad-hoc metadata 當成 sandbox workaround 或 UI acceptance。
- 本 audit 沒有修改 candidate、沒有執行 packaged app／UI、沒有建立 network connection、沒有啟停既有 Ollama、沒有下載模型；raw command output 與絕對路徑未落盤。FR-021 仍受 nested Chromium renderer blocker 影響，正式 UI offline、全機 egress、Windows 與完整驗收未完成。

## 2026-10-28 FR-021 Chromium nested sandbox process-composition next-stage diagnostic

- 現行 Seatbelt loopback-only boundary 的 nested profile canary 已重現：`loopbackOnly` parent 拒絕 synthetic Chromium network-service permission shape；只加 explicit TCP／UDP 權限仍拒絕；`allow default` parent 才接受。證據 `docs/project-management/evidence/2026-10-28-fr-021-chromium-nested-profile-composition-canary1.json` 為 pass，但只執行 `/usr/bin/true`，child profile 不是 Chromium exact generated profile，不能單獨定 root cause。
- packaged current candidate 的 startup-only probes 均未通過可操作 renderer：最新 `--single-process` probe4 與 `--no-zygote` probe3 都沒有發布 local page、沒有 CDP response，child `SIGTRAP`；較早 no-zygote probe2 曾發布 local page 但 `Runtime.evaluate` timeout，隨後仍 `SIGTRAP`，diagnostics 含 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`OS_PERMISSION_DENIED`。最新證據為 `2026-10-28-fr-021-electron-single-process-startup-probe4.json` 與 `2026-10-28-fr-021-electron-no-zygote-startup-probe3.json`；所有較早 probe 原件保留。
- 兩種 probe 都使用 bounded timeout、outer loopback-only Seatbelt、獨立 userData／process group；process group closed、temporary root removed，未啟動 Ollama、未下載模型、未跑 UI／AI flow。未使用 `--no-sandbox`、`ELECTRON_DISABLE_SANDBOX` 或等價 sandbox 關閉方式。
- 本階段收斂為安全 startup flags 不能解除目前 packaged Chromium blocker；不新增 formal acceptance argv、不修改 Seatbelt network policy。round1／round2 獨立審查、治理 validator、完整 checks 與 `npm run docs:check:final` 已完成；`systemNetworkDisabled=false`、全機 egress、Windows 與 FR-021 完整驗收仍未完成。本段為歷史診斷摘要，不代表 blocker 已解除。

## 2026-10-28 FR-021 Chromium nested sandbox startup diagnosis

- bounded diagnostic replay `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-offline-chromium-workaround-replay1.json` 仍為 immutable `fail`／`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`；雖然 `runnerProvenance` 已正確保存當時測試的固定旗標、`argvRedactionValidated=true`／`argvDroppedCount=0`，local UI page 出現不等於 renderer 可用，正式 packaged UI 仍未進入 home／AI flow。
- 只在 bounded startup-only 診斷中比較 `NetworkServiceInProcess2`、`disable-gpu-sandbox` 與 `disable-gpu` 組合：loopback HTTP page 可建立，但 DevTools `Runtime.evaluate` 仍無回應，不能作為可接受的 UI workaround；未使用 `--no-sandbox` 或等價的 Electron sandbox 關閉方式。該兩個旗標已自目前 acceptance source 撤回，避免無效且放寬 GPU sandbox 的行為留在驗收路徑。
- source 只保留安全的啟動邊界修正：`lib/electron-devtools-target.mjs` 不再依賴 transient page title 選取受信任的 loopback page；`scripts/verify-electron-ollama-ui.mjs` 對 home dashboard 做 bounded DOM-ready wait，並將 DevTools／home timeout 與 persistent startup diagnostics 分開分類。這些修正不宣稱解除 nested Chromium blocker。
- focused UI contract／四支 source syntax check、完整 `npm run check`、兩輪獨立審查、治理 validator、immutable evidence guard、`git diff --check` 與 `npm run docs:check:final` 均已通過；本輪尚未重跑完整 UI replay，保留新 failure evidence，不覆寫歷史 replay。`systemNetworkDisabled=false`、真正全機 egress、Windows 與 FR-021 完整驗收仍未完成。

## 2026-10-28 FR-021 Unicode candidate executable argv provenance

- `lib/runner-provenance.mjs` 現以共同 Unicode-safe basename boundary 投影 candidate executable argv：允許安全的本地化 basename（例如 `<candidate-executable:離線字幕工廠>`），仍拒絕 `/`／`\\`、控制字元、`.`／`..`、空值與超過 128 個字元的值；command 與 candidate wrapper 不保存 raw path 或 secret-shaped token。
- `scripts/test-ollama-ui-offline.mjs` 新增 localized candidate pass、path／dot-name／control／oversize fail-closed assertions；focused UI contract、syntax、完整 `npm run check` 與 `git diff --check` 均通過。這是 evidence-only sanitizer contract，不修改產品 runtime、OS network、既有 evidence 或 candidate。
- replay1 `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-offline-current-source-replay1.json` 只做唯讀 scope／hash／cleanup assertion，status `fail`、`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`systemNetworkDisabled=false` 與原始 `argvDroppedCount=1` 均保留未改寫；本輪不重播相同 Seatbelt failure。
- 本修正不把歷史 `argvRedactionValidated=false` retroactively 改成 pass，也不解除 nested Chromium blocker、全機 egress、Windows 或 FR-021 完整驗收；後續新 replay 若需要，必須產生新的 exclusive evidence path。

## 2026-10-28 FR-021 current-source packaged Ollama UI Seatbelt offline replay

- 以目前 `../dist/mac-arm64/離線字幕工廠.app`、預裝 `llama3.2:1b` 與 exclusive evidence path 執行 `acceptance:ollama:ui:offline`；evidence `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-offline-current-source-replay1.json` status `fail`、failureCode `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、stage `electron_start`，Electron `SIGTRAP`，UI 未進入 home／AI flow。
- offline isolation 子範圍實際通過：macOS Seatbelt profile loopback probe 成功、外連測試 socket `EPERM`、daemon 在 sandbox 啟動、model 已預裝且未下載；Electron／driver／daemon process groups、daemon port、temporary root、app port／userData cleanup 全通過，raw child output 未落盤，leakage scan 通過。
- replay1 的 scope 明確為 `systemNetworkDisabled=false`、`electronAppStartedInSandbox=true`、`networkSandboxInheritedByElectronAndServer=true`；failure diagnostics 為 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`CHROMIUM_GPU_SANDBOX_UNAVAILABLE`、`OS_PERMISSION_DENIED`。runner provenance 的 `argvRedactionValidated=false` 是 Unicode candidate executable basename 尚未被既有 ASCII candidate allowlist 接受，沒有保存 raw path；這是後續 evidence sanitizer 修正項，不改寫本次 offline blocker 結果。
- 這份 immutable failure 不代表模型／provider／cleanup failure，也不能宣稱 Seatbelt packaged UI offline 通過；目前仍沒有真正全機斷網、Windows 或 FR-021 完整驗收。

## 2026-10-28 FR-021 shared runner provenance projection contract

- `lib/runner-provenance.mjs` 新增 `projectRunnerProvenance()`，集中 command／argv／sandbox flag／candidate executable／review.js／Framework hash／bounded child-output／diagnostic category 的安全投影；live verifier 與 offline wrapper 均直接呼叫同一 helper，避免欄位集合漂移。
- `scripts/test-ollama-ui-offline.mjs` 新增 shared key-set parity、missing／boxed hash fail-closed、invalid path／secret exclusion 與 shared-helper source assertions；完整 `npm run check` 通過。既有 replay4 只作唯讀對照，未重播或覆寫。
- round1 審查發現 shared helper 可由 caller supplied `argvProjection` 繞過 argv allowlist；已移除該輸入邊界，helper 現永遠從 raw argv 重新 sanitize，並新增 path／secret bypass regression；修正後 focused／完整 checks 通過，round1 原件保留，round2 複審與治理 closeout 已完成。
- 本輪仍僅是 evidence contract hardening：無新 Seatbelt packaged UI runtime evidence，`systemNetworkDisabled=false`、nested Chromium blocker、真正全機 egress、Windows 與 FR-021 完整驗收仍未完成。

## 2026-10-28 FR-021 runner provenance review.js hash schema parity

- offline `projectUiEvidence()` 現從 source artifact 的合法 64-hex `reviewScriptSha256` 投影 `runnerProvenance.candidateReviewScriptSha256`；非法／缺失值 fail-closed 為 `null`。這補齊上一輪審查指出的 live／offline runner provenance schema 欄位差異，未修改產品 runtime、provider、UI、Ollama daemon 或 OS 網路。
- `scripts/test-ollama-ui-offline.mjs` 補有效 executable／review.js／Framework hash 保存、非法 review.js path 不保存與 source contract assertion；完整 `npm run check` 已通過。既有 replay4 只作唯讀 evidence source，未重播、未覆寫。
- 本輪仍不是新的 offline acceptance：`systemNetworkDisabled=false`、Seatbelt packaged UI nested Chromium blocker、真正全機 egress、Windows 與 FR-021 完整驗收仍未完成。

## 2026-10-28 FR-021 runner provenance Unicode command identity and live/offline parity

- `lib/runner-provenance.mjs` 新增 basename-only `sanitizeRunnerCommand()`：保留安全 Unicode executable basename（本輪實際為 `離線字幕工廠`），拒絕空值、`.`／`..`、絕對／相對 path、separator、控制字元、非 primitive 與超過 128 字元值；不保存原始路徑或 secret。live verifier 與 offline wrapper 共用同一 helper，`scripts/test-ollama-ui-offline.mjs` 補 Unicode／path／secret boundary 與 projection parity assertions。
- 新 replay `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay4.json` status `pass`：`runnerProvenance.command="離線字幕工廠"`、argv redaction validated、candidate／review.js／Electron Framework hash、bounded child-output digest／bytes、6 cues／6 batches cancel checkpoint 1/6、same-session resume、6 suggestions／accept／save、timecodes／English translation 與 Electron／daemon／port／userData cleanup 全通過；既有 replay1／replay2／replay3 未覆寫。
- focused／完整 deterministic checks 與 `npm run check` 通過；本輪仍是 normal loopback，`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`、API Key 未提供。這只完成 provenance parity closeout，不解除 Seatbelt packaged UI offline、真正全機斷網、Windows 或 FR-021 完整驗收。

## 2026-10-28 FR-021 packaged Ollama UI live evidence runner provenance hardening

- `scripts/verify-electron-ollama-ui.mjs` 已沿用 `lib/runner-provenance.mjs` 的白名單投影，在 live evidence 新增 `runnerProvenance`；只保存去敏 argv、sandbox flags、candidate executable／review.js／Electron Framework hash、bounded child-output SHA-256／bytes／diagnostic categories，不保存 raw child output、secret-shaped env 或使用者路徑。`scripts/test-ollama-ui-offline.mjs` 的 VM failure／projection regression 亦已補上。
- 使用同一 current-source macOS arm64 candidate 執行新 replay3：`docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay3.json` status `pass`，`runnerProvenance.argvRedactionValidated=true`、`argvDroppedCount=0`，candidate／Framework hash 與既有 candidate 一致，`rawChildOutputPersisted=false`；6 cues／6 batches、checkpoint 1/6 cancel、同 session resume、save／cleanup 全通過。
- 本輪仍是 normal loopback：`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`、API Key 未提供。這是 evidence provenance hardening，不解除 Seatbelt packaged UI offline、真正全機斷網、Windows 或 FR-021 完整驗收。

## 2026-10-28 FR-021 current-source packaged Ollama UI cancel/resume normal-path replay

- 使用同一 current-source macOS arm64 directory candidate（executable SHA-256 `b3605c589459068f894a70896b8ed843be3832a839fcdd83aa898e9b16210de4`、Electron Framework SHA-256 `416b6c8cf74c59188266d3ff7a3fc77b9f68bb52f7328d98b382d132580c8cee`）執行 packaged UI cancel-resume scenario。第一份 immutable evidence `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay1.json` 在原 6-cue synthetic fixture 的 `checkpoint_cancel` 階段因 1B 模型先回傳不符合翻譯契約而 fail；Electron／daemon／port／userData cleanup 全通過，未以失敗樣本宣稱 pass。
- 為隔離取消／checkpoint 續跑本身，`scripts/verify-electron-ollama-ui.mjs` 僅將 cancel-resume worktree-only fixture 改為可由預裝 1B 穩定處理的短句；未修改產品 runtime，既有 normal replay fixture 與 packaged artifact 不變。replay2 `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay2.json` status `pass`：6 cues／6 batches、checkpoint 1/6 cancel、同 session reload／resume、6 suggestions、accept 6、undo／redo、reviewed.srt 6 cues、timecodes unchanged、英文翻譯及 cleanup 全通過，模型預裝且未下載。
- 兩份 evidence 都明確是 normal loopback：`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`、API Key 未提供；本輪只補 packaged UI cancel／checkpoint resume coverage，不能替代 Seatbelt packaged UI offline、真正全機斷網、Windows 或 FR-021 完整驗收。

## 2026-10-28 FR-021 current-source packaged Ollama UI normal-path replay

- 以目前 dirty source 執行 `npm run electron:build:mac:dir`，建立／更新 repo 外 `../dist/mac-arm64/離線字幕工廠.app`；candidate version `0.52.0`，已靜態核對 packaged `lib/ai/providers.mjs` 含 loopback native routing、exact cue schema、`num_ctx=4096` 與 strict stream markers，且與 worktree source byte-for-byte 相同。candidate executable SHA-256 為 `b3605c589459068f894a70896b8ed843be3832a839fcdd83aa898e9b16210de4`，Electron Framework SHA-256 為 `416b6c8cf74c59188266d3ff7a3fc77b9f68bb52f7328d98b382d132580c8cee`；parity audit 見 `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-normal-replay1-artifact-parity.json`。
- 以預裝 `llama3.2:1b`、獨立本機 Ollama daemon、目前 candidate 執行 `acceptance:ollama:ui`；`docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-normal-replay1.json` status `pass`，2 suggestions、accept 2、undo／redo 通過、reviewed.srt 保存、時間碼不變、API Key 空值／local privacy 通過，daemon／Electron process group／app port／temporary userData cleanup 全通過，模型未下載且既有服務未修改。
- 這是 normal loopback packaged UI 子範圍；evidence 明確記錄 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`，不能替代目前仍受 Chromium nested sandbox blocker 影響的 Seatbelt packaged UI offline acceptance，也不代表 FR-021 完整通過。

## 2026-10-28 BUG-060 Ollama translate schema 與 custom loopback native routing

- `llama3.2:1b` 的 Seatbelt replay1／replay2 曾在 product probe 以 `MODEL_RESPONSE_CONTRACT_REJECTED` 失敗；根因收斂為 acceptance wrapper 使用隨機 loopback port，而 Ollama provider 原先只在 11434 走 native `/api/chat`，custom port 退回 OpenAI-compatible path，且 translate native request 只帶 generic `format: "json"`。
- `lib/ai/providers.mjs` 現對所有 loopback Ollama port 使用 native `/api/chat`，translate／proofread 均帶 request-local exact cue JSON Schema，並固定 `num_ctx=4096`；非 loopback Ollama 保留 OpenAI-compatible fallback。`scripts/test-ai-providers.mjs` 已補 default／custom loopback／non-loopback body boundary。
- 最後 source 修正後 `llama3.2:1b` Seatbelt product replay4 已通過：2 suggestions、接受／undo／redo 各 2、雙語保存、時間碼與來源 SRT hash 不變；loopback allow、外連 `EPERM`、預裝且未下載、daemon／port／temporary cleanup 均通過。原 replay1／replay2 fail evidence 與 replay3／3B evidence 均保留未覆寫。
- 這只證明目前 macOS arm64、目前 Ollama／預裝 1B、Seatbelt 子程序與目前 source；`systemNetworkDisabled=false`，不等同 Electron UI、取消／續跑、Windows、真正全機斷網或 FR-021 全部驗收。

## 2026-10-28 BUG-059 Ollama 3B context resource bound

- 根因已由目前 Ollama logs 與受控 loopback probe 收斂：未指定 request context 時，3B runner 在 8 GiB macOS arm64 上採 `n_ctx=131072`，KV cache 約 14.3 GiB、預測記憶體約 15.9 GiB；同一最小 request 在 60 秒內無回應。只加入 request-level `num_ctx=4096` 後，實際 `createProvider().optimize()` 3B probe 約 1.25 秒完成。
- `lib/ai/providers.mjs` 現固定 Ollama native request `options.num_ctx=4096`；provider focused test 已斷言 Ollama body 與其他 provider 邊界。未改 Ollama daemon／全域設定、模型檔、batch size 或其他 provider。
- 目前 source 的 3B macOS Seatbelt 產品離線重播 `docs/project-management/evidence/2026-10-28-ollama-llama3.2-3b-product-offline-replay2.json` 已通過：2 suggestions、接受 2、undo／redo 各 2、雙語保存、時間碼不變、來源 SRT hash 不變；Seatbelt 外連 `EPERM`、預裝模型、未下載及 daemon／port／temporary root cleanup 均通過。這解除前一輪 product AI flow 的 context/resource blocker，但不等同 FR-021 全部驗收。

## 2026-10-28 FR-021 目前 source 的 Ollama 產品離線驗收重播

- 以目前 dirty worktree 執行 `npm run acceptance:ollama:offline`、預裝 `llama3.2:3b`，新 evidence `docs/project-management/evidence/2026-10-28-ollama-llama3.2-3b-product-offline-replay1.json`。Seatbelt loopback probe 通過，外連測試 socket 回 `EPERM`，模型確實預裝且未下載；產品 probe 在 `product_probe` 階段因 `MODEL_RESPONSE_CONTRACT_REJECTED` 失敗。daemon、port、隔離 temporary root cleanup 全部通過，`systemNetworkDisabled=false`。
- 為取得診斷摘要，另執行只使用 loopback 的 `acceptance:ollama:product` 3B probe，evidence `docs/project-management/evidence/2026-10-28-ollama-llama3.2-3b-product-live-diagnostic1.json`；該次在 240 秒 product task wait 上限逾時，沒有 raw model response 可供歸因。只讀 `ollama ps` 顯示 3B runner 仍載入（約 75% CPU／25% GPU），不能據此判定產品 root cause，也未停止桌面 Ollama。
- 本輪尚未修改產品 source、未下載模型、未改 OS／全機網路／防火牆、未啟動 Electron UI、未驗收取消／續跑／Windows／LM Studio，也不把單次 live run 宣稱為 FR-021 完整通過。round1／round2 六面向審查與 `npm run docs:check:final` 已完成；本次只結案失敗結果的 evidence／治理文件，FR-021 product acceptance 仍未完成。

## 2026-10-21 AI provider 支援政策更新

- LM Studio 已終止開發，今後不是本專案的 active support、驗收、bug triage、下載／同步或新功能目標。後續同步 repo、下載使用或進行開發時，可忽略 `lm-studio` provider、端點、模型、UI、取消／續跑與斷網驗收；除非需求方另行明確重新啟用。
- 既有 `lm-studio` registry／runtime code、deterministic tests 與歷史紀錄暫予保留，僅作相容性／歷史追溯，不代表目前仍承諾支援，也不應阻擋 Ollama 或其他 active provider 的工作。若要移除既有殘留，另立明確的 removal change，不在本政策同步中處理。
- Ollama 仍是目前 active 的本機 provider 目標。

> 最後查證日期：2026-10-21

> 現行版本：0.52.0（已發布；macOS arm64-only）
> 現行公開版本：0.52.0（GitHub Latest）
> 發布狀態：GitHub Release [`v0.52.0`](https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.52.0) 已公開，annotated tag 指向 source `b6b1efd6b72574f9210af74729d2cb2fd869e42d`。round16 六面向獨立審查 PASS；七項 macOS arm64 assets 的名稱、大小、GitHub SHA-256 digest 與下載 URL 已核對，Release notes 與本地 `RELEASE-NOTES-0.52.0.md` 一致。最新 Windows exact-source workflow run `41013639786`（HEAD `539d880`）已成功產生 unsigned preview artifact `offline-subtitle-factory-0.52.0-windows-x64`（artifact `12958791997`，504,815,503 bytes，API digest `sha256:01f57853d4f585907e5589d15727c2068d0ecc82d9b1a76dd54e048fc40e4a3d`），但未上傳至公開 Release。round14 的 Windows user-profile 路徑 blocker 已匿名化，round15 的狀態文件同步 blocker 已解除，詳見 `06-TEST-AND-PROCESS-AUDIT.md` 最新條目與 round15／round16 獨立報告。真實播放／完整轉錄、Google／Keychain／上傳、Windows Authenticode／實機與 macOS Developer ID／公證／Gatekeeper 仍未驗收；`GHSA-hp3w-g68c-fv3c` build-time advisory 依 Release notes 揭露。
> 發布 tag／commit：`v0.52.0` → `b6b1efd6b72574f9210af74729d2cb2fd869e42d`
> 主分支：`main`

## 2026-10-20 0.52.0 發布狀態

round9／round10 指出的 source archive 個人路徑與 smoke provenance 問題已依範圍處理；round14 發現的額外 Windows user-profile 路徑已匿名化，round12 審查報告內唯一個人絕對候選路徑則依需求方 2026-10-20 限縮核准原樣公開，並已在 README／Release notes 揭露。round15 曾對 b2b942e 判 BLOCK，要求同步實際證據；該狀態同步形成 b6b1efd，round16 對 b6b1efd 的 macOS arm64 候選、同源 Windows CI/hash、治理文件與風險揭露判定 PASS。2026-10-20 已公開 GitHub Release v0.52.0，tag 指向 b6b1efd；七項 macOS arm64 assets 的 GitHub digest／size／URL 與本機候選核對一致，完整結果見 06 最新條目與 [Release](https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.52.0)。使用者已接受的 Google／Keychain／頻道上傳未實帳號驗收、`GHSA-hp3w-g68c-fv3c` build-time advisory、ad-hoc／未公證風險仍須持續揭露；UI smoke 未證明有效播放／完整轉錄，Windows preview 未作公開資產。

使用者已明確接受並要求於 Release notes 揭露兩項獨立風險後發布 MVP：真實 Google OAuth／Keychain／頻道影片與字幕上傳尚未實帳號端到端驗收；完整 dependency audit 有 8 個 moderate paths（`GHSA-hp3w-g68c-fv3c`，位於 electron-builder build-time chain；production audit 為 0，公告目前無上游修補版）。Release notes 也標明本版僅 macOS arm64、ad-hoc／未 Developer ID／未公證；Windows 不屬本次發行範圍。以上接受不豁免來源、checksum、機密、審查或其他發版門檻。

## 2026-10-19 FR-027 macOS 封裝開發候選

已由目前工作樹產生 0.51.0 macOS arm64 unpacked `.app` 測試候選，並以該 bundle 自己的 Electron／main／server 和隔離 profile 完成首頁／校閱基本任務、YouTube 本機 mock、實際 1100×700 縮窗及八種 viewport 的 22 控制可達檢查。候選 CSS 與目前 source 完全相同；實際已安裝 `/Applications` 版未替換。round2 獨立六面向審查有條件通過，無本地 smoke 阻擋問題；結論只適用於 unpacked 本機測試。候選目錄與證據見 06 最新條目。這不是 DMG／ZIP 安裝後、真實 Google／Keychain／上傳、Windows 或正式發布驗收；Developer ID／公證亦未驗證。

候選驗收工具邊界補強的 round6 獨立複審已通過；未知 dash option、額外 positional 與錯置 evidence 順序均 fail-closed，完整回歸及 `npm run docs:check:final` 結案檢查通過。round4 報告 schema 缺欄造成的首次 final gate 失敗及原件均保留。這不改變候選 smoke 的驗收範圍或真實 YouTube／安裝後驗收狀態。

## 2026-10-19 YouTube source UI 修正

BUG-049後續修正：保留現行深藍側欄／左右校閱配置，source原生視窗1100×700已驗證（內容1100×668），工作區無橫向溢出／影片遮住控制；窄工具列換行、側欄及兩區獨立捲動，22控制可達。最終v10及8尺寸／AI展開長文字證據見06最新條目，獨立六面向審查已通過，結案結果見最新08。不代表整個YouTube流程或新安裝包可交付。

> 以下「再次複核」為本輪修正前的歷史判定，BUG-049當時尚未修正。

再次複核補記：使用者已確認本機 `已安裝版本` 0.51.0為現行軟體。前端資源同場對照，在1280／1400寬的首頁與校閱主布局一致；不能重現整套介面大改。1100×700仍有工作區超出／遮擋（BUG-049；未修正），與已修正頂列BUG-048分開；整體開發版不能據此宣稱完整可用性通過。使用者補充檢核網頁不足以比對後，另補實際installed executable與source Electron各自隔離profile的原生預設視窗內容截圖及基本任務，與三尺寸前端模擬分開，證據見06最新對照條目。

BUG-046／047／048 已有 source 修正與隔離 Electron 驗證：沿用既有按鈕樣式、固定 header/footer、內容獨立捲動、錯誤跨輪詢保留，以及 1100×700 頂列入口不溢出。證據見 06 本日條目與 fixed-v7 PNG／JSON；不代表真實 Google／Keychain、安裝包、Windows 或一般使用者任務驗收。歷史 2026-10-16 未修正判定保留為當時基準。

## 2026-10-16 YouTube 私人上傳開發版（FR-027）

> 以下為 2026-10-16 歷史診斷；介面缺陷已於 2026-10-19 取得 source 修正與獨立審查，見上節及最新 08。真實 Google 端到端驗收仍未完成。

- **可用性複核更新**：使用真實合成 MP4／隔離 source Electron，已確認新 modal 樣式不一致、主要操作須捲動、OAuth 錯誤被輪詢覆蓋；追蹤 BUG-046／047。minWidth1100的頂列溢出（BUG-048）在隱藏YT入口後亦存在，不能歸因為YT入口的獨有回歸；正式bundle同尺寸runtime未重播，使用者實際版本未識別。技術 mock／IPC 通過不能代表一般使用者可交付；目前 YouTube 功能仍需介面修正與真實Google端到端驗收。本輪依需求僅診斷，未修改產品程式。

- 新增 Electron 校閱頁 YouTube 私人 MP4＋SRT 上傳、Desktop OAuth／PKCE／state、safeStorage、頻道顯示、外送同意、進度／取消與字幕重試。官方 `@googleapis/youtube@40.0.1`／`google-auth-library@11.3.1`；已完成 deterministic publisher tests、既有完整回歸及隔離 source Electron UI smoke。
- 此為開發版 MVP：未使用真實 Google client／頻道上傳、未驗收安裝包／Windows，不支援 app 內公開／排程或 byte-level 續傳；不改公開 v0.51.0 資產。獨立審查與 final gate 以最新工作紀錄為準。
- round1 B1／B2／B3 已以 server/main lease、無 job mkdir 的 persist／config history、來源串流 helper 與 ID／captionStatus UI 修正。round2 有條件通過，無新增程式阻擋；條件為整合報告與 final gate、不得擴大真實驗收宣稱。最新 source UI v4 及四份 YouTube suites／完整 check 通過，實際 final gate 結果記於 08。
- 本輪 production dependency audit 為 0；整體 npm audit 12（8 moderate／4 high），均位於既有開發依賴樹，既有鎖定版本未升級，後續另行評估 Electron／builder 修補與封裝回歸。

## 2026-10-01 macOS Seatbelt packaged UI 隔離邊界診斷

- 可重播腳本 `scripts/accept-macos-seatbelt-nested-profile-canary.mjs` 及 replay3 保存完整合成 parent／child profile 與 argv；四案顯示 strict+strict exit 0、strict parent 拒絕 child network-service shape（71／EPERM）、僅加明示 TCP／UDP 的 parent 仍拒絕（71／EPERM）、`allow default` parent 接受（0）。replay2 的預期過寬窄 parent 失敗 evidence 保留；每案只執行 `/usr/bin/true`，無 socket 呼叫。
- replay11 執行檔 SHA-256 與 2026-09-30 稽核所記的 v0.51.0 候選 source commit `53956ccdee6e16e4c0413f09312a419613b27da6` 有稽核紀錄關聯；該 commit 的 `package-lock.json` 鎖定 Electron 43.3.0，官方 Electron release 對應 Chromium 150.0.7871.212。此 Chromium tag 固定至 commit `69bf1c67cb894365d151bd020bb0171fd583633a`，`sandbox/policy/mac/network.sb` blob 為 `58477d8d17902258b3f361d72751a32c034e0645`，其中明列 network service 的 remote TCP／UDP allowance。這使 replay3 的合成 network-service shape 可對齊候選版本的官方 source；但 replay11 JSON 本身未記 source commit 或可驗證 build provenance，稽核關聯不是 binary provenance 證明。2026-10-12 在保留的 `dist/release-0.51.0-macos-53956cc/mac-arm64/離線字幕工廠.app` 中核對到 executable SHA 與 replay11 完全相同；同 bundle 的 Electron Framework 43.3.0 SHA-256 為 `a6763870b706a065d621935435d82ea206747192b3948c8b17b7f5e2930c758a`，程式碼簽章驗證通過。此 framework hash 是目前保留 bundle 的靜態測量，replay11 未記 bundle path／framework hash，故不能證明 replay 當時載入的 framework bytes；Chromium exact generated profile 仍未取得，不能認定唯一根因。
- Apple 對 Content Filter 的官方資料指出需要 Network Extensions／Content Filter capability。任何 per-app／OS egress control 評估仍未獲授權，也未配置。
- 本輪 canary script 與新 evidence 使用 versioned Chromium tag URL；mutable `HEAD` 僅作歷史／背景參考，不作 evidence source。既有 replay2／replay3 與 exploratory evidence 保留其原始 `HEAD` URL，不覆寫歷史原件。
- canary 現要求呼叫者明確提供新的 `.json` evidence 路徑；缺少路徑時會在任何 Seatbelt probe 前 fail-closed，避免誤執行後才因既有 replay2 的 exclusive-create 失敗。既有 replay evidence 與 pinned source contract 不變。
- 2026-10-14 exact-profile feasibility audit（`docs/project-management/evidence/2026-10-14-fr-021-replay11-exact-profile-feasibility-audit.json`）唯讀核對 replay11、offline／packaged UI runner source 與既有 static bundle identity：replay11 沒有 serialized Chromium child policy、generated child argv、replay-time Framework hash、source commit 或 build provenance；runner 只保存外層 Seatbelt／synthetic launch shape，沒有 capture Chromium runtime 生成的 child profile。因此 exact generated profile 既未保存，也無法由本次列出的原件重建；本 audit 未啟動 packaged Electron／Ollama、未探測網路、未改 OS。這進一步固定 FR-021 packaged UI offline acceptance 的 evidence blocker，不代表 root cause 已確定。
- 2026-10-14 instrumented packaged-run readiness audit（`docs/project-management/evidence/2026-10-14-fr-021-instrumented-packaged-run-readiness-audit.json`）確認目前 contract 僅部分具備：runner 在記憶體建立 outer sandbox／launch argv，UI verifier 暫存 child stdout／stderr 並降為固定 diagnostic categories，且保存 executable hash；但沒有把 outer argv、raw／可重現 redacted stderr、Framework hash／build provenance 或 Chromium runtime generated child profile 寫入 evidence。若要補 exact profile 或等價 trace，需另行取得明確 instrumented packaged run 授權、固定 candidate、保存／回復／清理契約；本 audit 未啟動 app、Ollama、canary 或 network。
- 2026-10-14 runner provenance capture contract 已補入 source：live runner／offline wrapper evidence schema 升為 v4，保存去敏 outer command／argv、outer sandbox 套用旗標、candidate executable／Electron Framework pre-launch SHA-256、bounded child-output SHA-256／byte length 與固定 diagnostic categories；raw child output、secret-shaped env、使用者／暫存路徑不保存，wrapper 只投影白名單欄位。這改善未來 instrumented run 的 runner-level 可追溯性，但不補 replay-time loaded bytes、exact Chromium generated profile、build provenance 或 packaged UI acceptance；本輪未啟動 app／Ollama／canary、未建立 network probe、未改 OS。
- 2026-10-14 offline wrapper argv redaction boundary 已補入 source：offline evidence schema 升為 v5，`runnerProvenance.argv` 在保存邊界再次套用固定 allowlist，只保留去敏旗標、受限 debug port、固定環境名稱的 `<redacted>` token 與受限 candidate basename；未知／路徑／secret-shaped item 只反映 `argvDroppedCount`，不保存原值，並以 `argvRedactionValidated` 揭露是否完整通過。這只強化 evidence projection，不補 replay-time provenance、exact Chromium generated profile 或 packaged UI acceptance；本輪未啟動 app／Ollama／canary、未建立 network probe、未改 OS。
- 在保留 Chromium sandbox、禁止外連、且不改 OS 網路設定的目前範圍內，尚未找到可讓相同 packaged Electron UI 啟動的 task-local 路徑。放寬外層 Seatbelt 不符合整棵程序樹 fail-closed 條件；不使用 `--no-sandbox`。
- round1／round2 報告限 synthetic 診斷，round3 另以有條件通過判定靜態 source-version／policy fragment 關聯補記；不代表 binary provenance 已證明或 root cause 已確定。已量測目前 executable-hash-matching bundle 內的 framework hash，但 replay-time exact framework identity 與 Chromium generated profile 未證明；經核准 egress control 下的 packaged UI 驗收仍缺，故本輪 static bundle identity 補記已完成，FR-021 offline UI 未通過。未改 Wi-Fi／PF／防火牆／Network Extension；Windows 暫緩、LM Studio 不驗收。

## 2026-10-01 macOS Ollama UI 取消／checkpoint 續跑

- `FR-021` 新增限定實機證據：當前 dirty worktree 的隔離 v0.51.0 macOS arm64 目錄候選（不是公開 `53956cc` Release）以六段合成字幕／batchSize 1 完成 checkpoint 1/6 後 UI 取消、重載、同一 Session 從第 2 批續跑、六筆建議接受、undo／redo 與雙語 SRT 保存。`2026-10-01-ollama-ui-cancel-resume-replay9.json` 為 pass，原始 SRT before／after hash 相同、時間碼不變、Electron 與自建 Ollama／port／暫存全部清理，未強制 SIGKILL。獨立審查與文件結案進度見最新工作紀錄。
- 修正 `BUG-034`（驗收工具誤選 splash／未 import socket validator）與 `BUG-035`（成功取消後 stale running 輪詢使恢復按鈕維持隱藏）。後者由 actual UI function VM 受控競速重現與回歸驗證，不把它冒稱為每次實機都發生。
- 本機既有 Ollama 3B daemon 回報 131,072 context／約 18 GB 載入大小，而本機為 8 GB；首批無 checkpoint 的失敗與啟動失敗 replay1–8 均保留。成功 replay9 使用驗收自有獨立 loopback daemon、預裝 `llama3.2:3b`、context 4096、no-cloud／no-prune，並未更改或停止既有桌面服務、未下載模型。
- 此次 `systemNetworkDisabled=false`，Electron 與成功 replay 的自建 daemon 不套用 Seatbelt；只完成正常 loopback UI 取消／續跑子範圍，不能替代前輪失敗的 packaged UI 斷網驗收。Windows 暫緩、LM Studio 依需求方決策不驗收；`FR-021` 整體仍未結案，未發布新版本。
- round1 發現的快速續跑舊終態、artifact failure cleanup、tags trickle deadline 三項已修補（`BUG-035` 延伸、`BUG-036`）。新的 round2 隔離候選 source／packaged review.js SHA-256 `6bb93f9939415b21261c92a0adacfad0d5a9e304e97a02900770aeac6e8d1cf9`；最新 cancel-resume replay10 與預設 regression replay2 均 pass、原 SRT／時間碼不變且全部清理，round1 與舊 evidence 保留；複審與 final gate 進度以最新工作紀錄為準。
- round2 延伸 restore-in-flight 阻擋與 UTF-8 byte cap 建議已修正；generation 隔離包含 restore／取消訊息／stale request failure，current task failure 仍正常顯示。Latest round3-final 目錄候選 review.js hash `7efbe0d1cca764e015af940323725b1c8b0bc09c46e31a2a2b437375ee79c0d3` 與 source 一致，cancel-resume replay11／default regression replay3 均實機 pass（19,714ms／10,326ms），SRT／時間碼／所有 cleanup 通過；round3 獨立複審與文件結案詳見工作紀錄。
- round3 獨立複審為有條件通過，無剩餘程式阻擋；reviewer 自行完整回歸及 candidate／evidence 核驗通過。原句與條件整合後，03:36 UTC 文件 final gate exit 1（固定證據／阻擋欄位格式不符），當時條目回復進行中；原報告保留，以 round4 處理。FR-021 整體狀態及 offline 缺口不變。
- round4 新報告通過直接 validator 格式檢查，維持程式阻擋解除與 immutable candidate／evidence 一致判定；完整原句及條件已整合。03:46 UTC `npm run docs:check:final` exit 0（19 個文件、最新紀錄已結案），whitespace exit 0，最新工作條目僅就正常 loopback 子範圍結案。Round3 失敗紀錄與所有報告原件保留，無發布、不擴大 FR-021 範圍。

## 0.51.0 GitHub 正式發布（macOS arm64；Windows 暫緩）

- `v0.51.0` 已於 2026-09-22 公開為 GitHub Latest：<https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.51.0>；annotated tag 解析至來源 commit `53956ccdee6e16e4c0413f09312a419613b27da6`，發布來源為 `codex/0.51-anthropic-claude`。
- 公開 Release 包含 9 項 macOS arm64 資產：DMG／ZIP、兩個 blockmap、`latest-mac.yml`、SHA256 清單、簽章狀態、provenance 與候選說明。GitHub API 的名稱／大小／SHA-256 digest／直接下載 URL 與本機候選一致；DMG／ZIP／`latest-mac.yml`／SHA256 清單再由正式下載 URL 回讀並完成 hash／byte 比對。完整證據：`docs/project-management/evidence/2026-09-22-github-release-post-publish.json`。
- macOS Apple Silicon 兩條發布候選路徑均已通過實機 renderer、手動字幕、real trim／post-trim、AI review、glossary round-trip、8 providers 與清理；候選為 ad-hoc，`codesign --verify --deep --strict` 通過，但 `spctl` exit 3／rejected，未使用 Developer ID／公證，故不宣稱 Gatekeeper 通過。
- 開發驗證已完成：來源 commit 53956cc 的 `npm ci`、`npm audit=0`、`npm run check`、`git diff --check`、封裝／容器／metadata／SHA 驗證均通過；發布前 round1 與發布後 round2 獨立審查均只在 macOS arm64 release scope 內判定有條件通過。
- Windows 依需求方要求未做 macOS 主機上的實機驗收；branch／tag push 觸發的 Windows preview run `35700305138`、`35700315448` 與後續 `35714599428` 均因 `test-breeze-asr.mjs` 找不到可測試的 Breeze 效能提示更新函式而失敗。這不是 Windows 實機驗收，Windows 仍是未完成項目。
- 2026-09-23 已完成 BUG-032 的最小測試修正：`scripts/test-breeze-asr.mjs` 讀取 `public/app.js` 後正規化 CRLF／LF，並以共用 matcher 直接驗證正規化後 CRLF fixture；focused Breeze test、完整 `npm run check` 與 Windows preview run `35804611051` 均通過。Windows runner 成功不等於 Windows 實機驗收，該驗收仍暫緩，未修改 v0.51.0 Release。
- 2026-09-23 已將 Windows preview workflow 的 `actions/checkout`／`setup-node` 升至 v5、`upload-artifact` 升至 v6；run `35807444485` 成功完成 source／FFmpeg regression、preview package、renderer／install lifecycle、archive／SHA-256 與 artifact upload，且未再出現三個 Node.js 20 Actions runtime deprecation annotation。獨立的 `punycode`／npm transitive package warnings 不在本輪範圍；Windows 實機仍暫緩。
- 2026-09-23 依賴 warning triage 已完成：`inflight`／`glob`／`rimraf`／`boolean` 均由 electron-builder 26.15.7 的 dev／optional transitive toolchain 引入，`punycode` 不在專案依賴樹，`npm audit` 為 0；未使用 overrides 或升級 lockfile，避免未驗證的打包工具鏈變更。這些仍是上游維護 warning，不宣稱已消失。
- 其他未完成風險：正式 Applications／乾淨帳號、真正斷網、真實 AI／模型品質、Developer ID／公證／Gatekeeper，以及 Windows 安裝／renderer／實機品質；不以本次 macOS-only Release 擴大宣稱上述項目完成。

## 0.51.0 Anthropic Claude provider（已發布；後續品質驗證仍追蹤）

- 開發分支：`codex/0.51-anthropic-claude`，來源為已完成 BUG-026 可靠性修正的 `codex/0.50-whisper-small-long-cues@9c9a5d5`。
- 新增 Anthropic Claude Messages API adapter：模型清單與連線測試使用 `/v1/models`（不發送生成測試），優化使用 `/v1/messages`，以 `x-api-key`／`anthropic-version` 認證，並將 system prompt、`max_tokens` 與 content blocks 轉接至既有 AI optimizer contract。
- 設定、profile、runtime key 與磁碟 secret 以 `anthropic` provider ID 隔離；字幕內部 cue metadata、OpenAI `response_format` 與 API Key 不會外送或回傳至設定畫面。
- BUG-029 已完成：provider profile 只保存明確 allowlist 的連線／模型／批次／逾時欄位；巢狀 API Key、Authorization、token、secret 與未知欄位不會寫入一般 `settings.json`，且含既有非空 profile 的啟動回歸已通過；round2 獨立複審通過。BUG-031 再補既有設定啟動清理：AI 根層 legacy secret-shaped 欄位與 profile 非 allowlist／未知 provider 會從一般設定檔移除，合法 profile、非敏感未知 AI 根層欄位與獨立 secrets 保留；不把歷史明文自動匯入 secrets。外部 API 與跨平台發布仍另行追蹤。
- BUG-027 已修正：依 Anthropic 2026-09-14 官方相容性文件，Claude Opus 4.7 之後會拒絕非預設 `temperature`／`top_p`／`top_k`；adapter 已統一省略這些取樣參數，且 round2 獨立複審與完整回歸通過。
- BUG-028 已完成：Anthropic `/v1/models` 依官方 `has_more`／`last_id`／`after_id` 契約讀取所有頁面，保留 opaque cursor 原值，避免後頁模型被連線測試誤判不可用；異常游標與 100 頁安全上限已有 deterministic 覆蓋，round2 獨立複審與完整回歸通過。
- BUG-030 已修正並完成 Ollama 本機單模型重驗：`llama3.2:1b` 的 raw response 曾回傳合法但未包裝 `cues` 的 cue object，optimizer 現在只對此 Ollama 結構偏差進行一次 repair，仍強制執行 cue contract；2026-09-15 artifact 已驗證 Ollama 0.34.0 的 capability、native single-cue 與 optimizer product path 通過（`cue-object`→`cues-array`、0 retries）。
- FR-021-032 Ollama loopback API product path 已完成開發驗證與 round4 獨立複審：`2026-09-15-ollama-product-live-recheck-5.json` 實際完成 2 cue AI translation、session、2 筆接受、undo／redo 各 2 筆、雙語校閱保存；時間碼未變且原始 SRT 保存前後 SHA-256 相同。探針現於啟動前拒絕遠端 URL／既有 evidence，使用 exclusive evidence create、最小 child env，並以暫存資料與 `127.0.0.1` 執行；`systemNetworkDisabled=false`，所以不宣稱真正斷網完成，FR-021 整體仍未結案。
- 2026-09-29 新增 macOS Seatbelt 離線 Ollama acceptance wrapper，將獨立 Ollama daemon、product probe 與其 server 子程序置於 deny-network／loopback-only profile；先在 sandbox 內驗證 loopback 成功、RFC5737 測試 socket 回 `EPERM`，再確認 `llama3.2:1b` 已在本機後執行。成功 evidence `docs/project-management/evidence/2026-09-29-ollama-llama3.2-1b-product-offline-replay7.json` 記錄 2 cue AI completed、接受／undo／redo 各 2、雙語保存、時間碼不變、來源 SRT hash 不變，daemon／port／暫存目錄均已清理；沒有關閉全機網路或修改防火牆，`systemNetworkDisabled=false`。此前一次隔離產品流程回報 `OLLAMA_TASK_FAILED`（`...replay6.json`），後續重播成功，故仍保留小模型輸出不穩定風險。
- round1／round2 審查問題已由 managed-child helper、ENOENT regression 與 wrapper 層 test-only spawn integration fault injection 處理；round3 報告 `docs/project-management/reviews/2026-09-29-fr-021-ollama-macos-seatbelt-network-isolation-round3.md` 對 acceptance 子範圍有條件通過，其結案條件（工作紀錄同步與 final gate）已履行，`npm run docs:check:final` 通過。修復後 1B replay8／9 仍因模型輸出契約拒絕而失敗，但 Seatbelt `EPERM`、daemon stop、port close 與 temp cleanup 均通過；同一 post-fix 3B replay `docs/project-management/evidence/2026-09-29-ollama-llama3.2-3b-product-offline-replay1.json` 完成兩 cue product flow 且 cleanup 全通過。
- 2026-09-30 packaged Electron offline UI feasibility runner 已完成 fail-closed 修正：DevTools WebSocket 僅可連本輪指定的 `127.0.0.1` port，移除原始啟動行輸出，並分別記錄 Electron、host automation driver 與 Ollama daemon process group 的清理前狀態及清理後確認。macOS arm64 replay9 evidence `docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay9.json` 再現 Chromium child sandbox `Operation not permitted`／Electron `SIGTRAP`，renderer 未啟動、UI flow 未執行；Electron group 清理後確認消失，daemon／port／userData／temporary root 清理通過。round1 不通過項目已修正；round2 獨立審查有條件通過（報告 `docs/project-management/reviews/2026-09-30-fr-021-macos-seatbelt-electron-ui-feasibility-round2.md`），完整開發檢查及 `npm run docs:check:final` 通過。此工作只結案為可行性查核，FR-021 UI acceptance 仍未完成；未使用 `--no-sandbox`，未改系統網路設定。
- 2026-09-30 以目前 macOS 26.6.2 arm64 實機重播既有 v0.51.0 `53956cc` candidate：replay10 因初次誤傳 executable 而被 app-bundle preflight 拒絕，未啟動子程序且清理確認通過；正確傳入 `.app` bundle 的 replay11 再現 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`SIGTRAP`，renderer／UI 未啟動。replay11 先確認 loopback allow、外連測試 socket 為 `EPERM`、預裝 `llama3.2:3b` 存在且未下載；Electron process group、隔離 daemon、port、userData 與 temp root 均清理確認，未使用 `--no-sandbox`、未改系統網路設定。Evidence：`docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay10.json`、`...replay11.json`。此版本差異重播仍只屬可行性失敗證據，不是 UI acceptance 通過，FR-021 未結案。
- round1 後依獨立審查補強 acceptance evidence schema v3：`replay12` 以負向 executable-path 輸入保存去敏的 macOS 26.6.2／build `25G83` 與 `app_executable_path` 類別，並確認於 app-bundle preflight fail-closed、無 Seatbelt probe／Ollama／Electron 啟動；既有 replay10／11 v2 evidence 保持原樣。2026-10-01 依 round2 的 P3-01 修正 `.app/` 分類並拆開負向 preflight 與 Ollama/model gate；三案直接 CLI regression 在不存在的 Ollama binary 環境仍全部通過，完整 `npm run check` 通過。round3 獨立報告 `docs/project-management/reviews/2026-09-30-fr-021-macos-26-6-2-seatbelt-replay-round3.md` 已取得，整合後 `npm run docs:check:final` 通過，本次可行性重播與 runner 修補結案。UI 實機驗收仍失敗、FR-021 整體仍未結案。
- 此證據涵蓋本機 API product flow 在 macOS Seatbelt 下使用預裝 Ollama；packaged Electron UI 在同條件下未能啟動，取消／checkpoint 續跑未驗收，亦非全機實際斷網測試。LM Studio 依需求方決策不驗收、Windows 實機暫緩；FR-021 整體仍未結案。既有 2026-09-16 packaged Ollama UI live flow 僅為 loopback 設定、`systemNetworkDisabled=false`，不能替代本次失敗的離線 UI 驗收。
- 2026-09-16 packaged renderer smoke 已在隔離 userData 的 0.51.0 macOS arm64 目錄版通過：`2026-09-16-macos-renderer-smoke-fr-021.json` 記錄首頁／Electron bridge／設定、Breeze 首次選擇取消、手動 SRT 任務、校閱 AI 資產與 8 個 provider ID；另以 `2026-09-16-ollama-ui-live-final-2.json` 完成 Ollama loopback packaged 校閱頁 live UI 流程，兩段字幕設定英文、取得 2 筆建議、全部接受、undo／redo、保存 `reviewed.srt` 且時間碼未變。
- 上述 Ollama UI artifact 僅記錄 `127.0.0.1` local endpoint、無 API Key、`systemNetworkDisabled=false`；fixture 是 UI chain 用的中英混合短句，不代表長中文模型翻譯品質。純中文 `llama3.2:1b` 輸出不穩定、`llama3.2:3b` 重播曾逾時的失敗證據均保留；strict language validation 未放寬。
- packaged renderer／Ollama UI 的 round1 獨立審查均通過限定範圍、無阻擋問題；仍不代表真正斷網、LM Studio、Windows／乾淨安裝或 FR-021 整體完成。
- REL-047 已從既有 0.51.0 macOS arm64 DMG 唯讀掛載、ZIP 隔離解壓後各自啟動 packaged app；兩條路徑均通過 renderer／手動字幕／trim／AI review smoke，DMG 已卸載、ZIP 暫存已清理。這不代表 Applications／乾淨帳號／Gatekeeper／Developer ID 公證或公開 Release 驗收。
- BUG-WHISPER-METAL-139 已補 macOS arm64 核心 child-process 整合 fixture：受控 runner 首次以 Metal exit 139 留下 partial SRT／JSON，server 觸發 `--no-gpu` CPU retry，清理 partial outputs 後完成 `ready-review`；真實 bundled runtime、長音訊、取消中的 retry 與跨平台實機仍待驗收。
- 2026-09-17 釐清 bundled `whisper-cli` 的 Metal 139 執行邊界：同一 bundled CLI／Tiny、FFmpeg 正規化的 1 秒靜音 WAV 與產品 flags，在 default sandbox direct replay 會 exit 139 且無 SRT／JSON；改以升級權限執行則 Metal exit 0 並產生 SRT／JSON，故 sandbox 139 不可當成產品 runtime failure。CPU JSON 仍只有 offsets／timestamps／tokens，沒有 segment-level confidence／no-speech，故品質頁仍以 rule-score fallback 為準。原始對照證據：`docs/project-management/evidence/2026-09-17-whisper-bundled-runtime-recheck.json`；權限邊界證據：`docs/project-management/evidence/2026-09-17-whisper-metal-permission-boundary.json`。
- 2026-09-17 新增非測試模式產品 server 的 bundled Whisper.cpp acceptance probe；以本機生成 1 秒靜音 WAV 完成 `ready-review`，`asrEngine=whisper.cpp`、`whisperDevice=metal`，產生 draft／SRT／JSON 且清理暫存 WAV。此輪 server 執行未觸發 Metal exit 139，因此 `fallbackObserved=false`；probe 只有在當次觀察到 Metal crash 時才會把 CPU fallback 作為通過條件，不宣稱真實 server fallback 已完成。證據：`docs/project-management/evidence/2026-09-17-whisper-real-server-fallback.json`。
- 2026-09-17 另以隔離 deterministic wrapper 在 `NODE_ENV=production`、test runner 關閉的 server 中完成 child-process fallback 控制流：首次受控 exit 139／partial SRT／JSON 後，server 清理並以 `--no-gpu` 完成 CPU 任務至 `ready-review`，logs／metrics／輸出／暫存清理均通過。證據：`docs/project-management/evidence/2026-09-17-whisper-production-fallback.json`；此證據明確不是 bundled `whisper-cli` 實機 fallback。
- 2026-09-17 權限邊界重播後，升級權限下的非測試模式產品 server bundled path 仍以 Metal 完成 `ready-review`、產生 SRT／JSON 並清理暫存 WAV，`fallbackObserved=false`；因此目前沒有同一次真實 bundled server run 的 Metal crash→CPU fallback 證據，不修改既有 fallback 策略。證據：`docs/project-management/evidence/2026-09-17-whisper-metal-permission-boundary.json`。
- 2026-09-18 已修正 SIGSEGV signal fallback 可觀測性：Node child 的非零整數 exit 與 termination signal 現有明確契約，server logs 分別記錄 `Metal exit <code>`／`Metal signal <name>`，真實 probe 同時辨識兩者。核心整合的 exit 139 與真實自我 `SIGSEGV` fixture 均清理 partial outputs、完成 CPU retry 至 `ready-review`；production controlled replay 通過，bundled replay 仍正常走 Metal、`fallbackObserved=false`。證據：`docs/project-management/evidence/2026-09-18-whisper-signal-aware-fallback.json`。
- 2026-09-18 已補 CPU fallback 再失敗的 child-process integration：deterministic runner 首次 Metal exit 139、第二次 `--no-gpu` exit 7 並寫入 partial SRT／JSON；server 現會終止為 `failed`、只保留兩次 invocation、保存 CPU exit reason，並刪除固定 partial outputs／quality metadata，不產生 draft。修正前／後證據：`docs/project-management/evidence/2026-09-18-whisper-cpu-retry-failure.json`。
- 2026-09-18 補驗 Metal→CPU retry 中的取消：deterministic CPU child 寫出 partial SRT／JSON 並安裝 SIGTERM handler 後，由 API 取消；三次核心重播均先見 `running/cancelling`、child close 後 `cancelled`，僅 `metal`／`cpu` 兩次 invocation，暫存音訊、partial outputs／quality metadata 已清理，非 ASR 工作檔保留。證據：`docs/project-management/evidence/2026-09-18-whisper-retry-cancellation.json`；真實 bundled runtime 與不可外部插入的同一 callback 內窗口仍未驗收。
- 2026-09-18 已補 production-mode hybrid acceptance：隔離 wrapper 僅控制首次 Metal child exit 139 並留下 partial SRT／JSON；同一產品 server 清理後只 retry 一次 `--no-gpu`，CPU child 實際執行 bundled `whisper-cli`／Tiny，完成 `ready-review` 且無 stale partial／暫存 WAV。最新證據：`docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback-replay.json`，包含 binary／model SHA-256、精確兩次 invocation、CPU exit 0 與可重播命令；原始不含重播欄位的 evidence 保留未覆寫。本輪沒有觀察 bundled Metal 自身崩潰，不可當作同次真實 Metal crash→CPU fallback 實機驗收。
- 2026-09-18 再補 hybrid bundled CPU 執行中的取消：60 秒本機合成靜音 WAV 讓真實 bundled CPU child spawn 後由 API 取消；任務先為 `running/cancelling`，wrapper 轉送 SIGTERM，真實 CPU child 以 `SIGTERM` close，任務終為 `cancelled`。固定 SRT／JSON／quality 哨兵由 probe 注入後已清理，draft／暫存 WAV 不存在、edit plan 保留，精確 `metal`／`cpu` 兩次 invocation。round1 審查指出 probe 失敗時只停 server 無法確認子孫程序；現改用隔離 process group 有界終止、確認整組消失後才清暫存。round2 獨立複審通過。最新正常 evidence：`docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-final.json`；API 不可用故障注入 evidence：`docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-api-loss-final.json`（預期 probe exit 1，但 cleanup `expectedFaultSafelyHandled=true`）。先前 evidence 保留。此證據不代表 bundled Metal 自身崩潰、CLI 真實 partial 輸出或跨平台取消已驗收。
- 2026-09-21 以同一 production server probe、同一 bundled `whisper-cli`／Tiny 與 1 秒合成 WAV 重播真實 bundled Metal 路徑：預設 sandbox 在 server ready 前 exit 0，未建立任務；受控本機權限則任務完成 `ready-review`、`whisperDevice=metal`、`fallbackObserved=false`，輸出與暫存清理通過。兩份 evidence 明確只證明執行權限邊界與正常 Metal 路徑，仍沒有同一次真實 bundled Metal crash→CPU fallback 證據：`docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-default.json`、`docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-escalated.json`。
- 2026-09-21 已補強 bundled production probe 的啟動診斷：v2 evidence 記錄 server PID、ready phase、exit code／signal 及固定長度、遮罩後的 stdout／stderr 尾端；round1 發現後已補 quoted／含空白 credential、`/tmp/` 遮罩與 probe token guard／負向測試。預設 sandbox round2 重播可見 `listen EPERM`，受控權限正常 Metal replay 仍通過且 probe token 未外洩。round2 evidence：`docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-round2-default.json`、`docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-round2-escalated.json`；round1 evidence 保留作為修正前對照。
- 2026-09-21 已以需求方本機 `<user-home>/Downloads/20260909.mp4` 完成 bundled Whisper Small 長音訊 runtime／輸出基線：影片約 5,416.35 秒，受控本機 replay exit 0、產生非空 SRT／JSON，2,509 segments，暫存已清理；證據為 `docs/project-management/evidence/2026-09-21-whisper-long-media-small-redacted.json`。本輪只驗證執行與輸出完整性，不宣稱中文辨識品質、confidence／no-speech metadata、長音訊效能門檻或真實 Metal crash→CPU fallback；evidence v2 不保存字幕文字，原始影片／SRT 未修改。
- 2026-09-23–29 長音訊完整性 probe evidence v5 保存輸入影片與可選來源 SRT 的前後 SHA-256／大小，stderr 及外層錯誤只存固定摘要；來源 SRT basename 固定為 `source.srt`。v9（2026-09-24）及 v10（2026-09-29）保留為歷史測試證據。round4 報告 `docs/project-management/reviews/2026-09-29-fr-020-long-media-integrity-fault-injection-round4.md` 指出 v9 未證明實際刪除失敗時目錄仍殘留；v10 已端到端覆蓋。round5 報告 `docs/project-management/reviews/2026-09-29-fr-020-long-media-integrity-fault-injection-round5.md` 為有條件通過，指出 marker 前綴授權及 marker 遺失時清理風險，並要求獨立重跑；目前 harness 已移除 marker，改用隔離 case 內預先指定的 temp root，preload 僅比對 exact resolved path，父 finally 直接清理固定路徑。repo 外 replay 與 v11 七案均通過；cleanup evidence 為 fail／`tempRootRemoved=false`／`TEMP_ROOT_CLEANUP_FAILED`、probe exit 1，目錄在父清理前確實存在且 finally 後為 ENOENT。round6 原件因 final validator 格式錯誤保留未改；round7 報告 `docs/project-management/reviews/2026-09-29-fr-020-long-media-integrity-fault-injection-round7.md` 有條件通過，獨立重跑兩項 focused tests、六個 syntax checks 及 repo 外七案，並驗證治理文件。同步 round7 原句後，`npm run docs:check:final` 通過，檢查 19 個文件並確認最新紀錄結案。開發端完整 `npm run check` 是 v11 變更後的既有驗證，非 round7 reviewer 重跑。此 probe 切片不等同長片品質或 FR-020 全需求驗收；未重跑原始長片。
- 長音訊來源完整性證據只表示檔案在 probe 前後未被偵測到變更，不代表字幕語意品質、Whisper 與來源 SRT 正確性比較或人工影音校閱；長片品質、confidence／no-speech、真實 Metal crash→CPU fallback 與跨平台實機仍未完成。
- 需求方已告知 LM Studio 刪除，本輪不執行其實機驗收；真正斷網、LM Studio 例外以外的 FR-021 完整條件與跨平台實機仍未完成。
- FR-021-031 範圍決策：LM Studio 實機驗收因本機服務已刪除而取消，不移除 `lm-studio` provider 或既有 deterministic tests；後續只在取得明確網路隔離方法與授權後處理 Ollama 真正斷網／完整人工流程，不把此例外誤標為 FR-021 通過。
- 已補 deterministic provider／核心 API／review UI 測試與治理文件；不使用真實 Claude API Key，外部 endpoint、模型品質、計費與跨平台封裝仍待另行驗收。
- 已建立 macOS arm64 本機隔離 directory 測試候選：`../dist/mac-arm64/`；受控權限 packaged renderer smoke 通過首頁、設定、Breeze 首次選擇 modal、manual SRT 任務完成、trim／AI review 資產與 Anthropic provider marker。候選為 ad-hoc／未公證，未使用真實 Anthropic API Key。
- 已建立 macOS arm64 DMG／ZIP 測試包：`../dist/test-build-0.51.0-macos-88da220/`；`hdiutil verify`、唯讀掛載內容、`unzip -t`、ad-hoc deep codesign、renderer smoke、blockmap／`latest-mac.yml` SHA-512／size 與 SHA-256 均通過，仍未公證或完成乾淨安裝驗收。
- 已建立 Windows x64 cross-build directory 測試候選：`../dist/win-unpacked/`；runtime／PE／SHA-256／Anthropic marker 靜態核對通過，但目前 macOS 主機沒有 Wine，尚未做 Windows renderer、安裝／解除安裝或實機轉錄 smoke，候選不代表 Windows 實機驗收。
- 已建立 Windows x64 unsigned Setup／Portable 測試包：`../dist/test-build-0.51.0-91eca2b/`；Setup／Portable／blockmap／`latest.yml` 與 SHA-256／SHA-512 metadata 已核對，仍未在 Windows 實機安裝或驗證 Authenticode，僅供隔離測試。
- `.github/workflows/windows-preview.yml` 已對齊 0.51.0 並由 branch／tag push 觸發；既有 run `35700305138`、`35700315448`、`35714599428` 在 `test-breeze-asr.mjs` 的 Breeze assertion 失敗，修正後 runs `35804611051`、`35805107676` 與 workflow action upgrade run `35807444485` 均成功；後者並未再出現三個 Node.js 20 Actions runtime annotation。這不能視為 Windows 實機驗收，Windows scope 仍暫緩。
- 0.51.0 已建立 tag 與 GitHub Release，公開 Latest 已更新為 `v0.51.0`；本機與遠端資產驗證不代表真實 Anthropic／Breeze／Whisper 品質、長音訊效能、Windows 或乾淨安裝驗收。
- 2026-09-22 release-readiness audit 已核對既有 macOS／Windows 0.51.0 測試候選：runtime manifest、checksum、macOS ZIP／DMG 容器、latest metadata、macOS ad-hoc codesign 與 packaged version 通過；Windows unpacked PE32+／version 與 metadata 通過。候選 provenance 為 mac `88da220`、Windows `91eca2b`，目前 HEAD 為 `17df978` 且工作樹仍有 111 個變更路徑，因此候選不可代表目前工作樹、不可發布。證據：`docs/project-management/evidence/2026-09-22-release-readiness-audit.json`。Windows 真機／7z archive test、macOS 乾淨安裝／Gatekeeper／Developer ID／公證、CI artifact 與 GitHub upload 後核對仍未完成。
- 2026-09-22 依需求方要求先完成 macOS 實機驗收（Windows 暫緩）：既有 DMG 在目前 macOS arm64 實機唯讀掛載，複製至隔離 Applications-like 路徑後，deep strict codesign、packaged renderer、Breeze 開啟／取消、手動字幕完成、real trim／post-trim、AI review／glossary／8 provider 與 cleanup 均通過；DMG force detach 與隔離 app 移除通過。`spctl` 因候選為 ad-hoc／未 Developer ID／未公證而拒絕，已按預期記錄，不視為啟動失敗。證據：`docs/project-management/evidence/2026-09-22-macos-real-machine-acceptance-rel-047.json`。本候選來源仍為 `88da220`，落後目前 HEAD，故本結果是候選實機驗收，不解除 release provenance／正式簽章／公證／乾淨帳號與發布 gate。
- 2026-09-22 續補同一候選 ZIP 實機路徑（Windows 暫緩）：ZIP integrity／隔離解壓／Applications-like copy、deep strict codesign、packaged renderer、手動字幕、real trim／post-trim、AI review／glossary／8 provider、xattr 核對與 cleanup 均通過；`com.apple.quarantine` 未存在，`com.apple.provenance` 存在；`spctl` 仍因 ad-hoc／未 Developer ID／未公證而 rejected。證據：`docs/project-management/evidence/2026-09-22-macos-zip-acceptance-rel-047.json`。這仍是舊 provenance 候選的 macOS 實機補驗，不解除目前 HEAD／dirty worktree、正式簽章／公證、乾淨帳號或 release gate。
- 2026-09-22 為解除舊候選 provenance 落後問題，於隔離 clean detached worktree 以目前 HEAD `17df9788abf2cf964d52df10b74f9a8fcd7a45d6` 建立新 macOS arm64 directory candidate：runtime manifest／verify、electron-builder、packaged version 0.51.0、deep strict ad-hoc codesign、runtime hash 與 renderer／manual subtitle／real trim／post-trim／AI review smoke 均通過。證據：`docs/project-management/evidence/2026-09-22-macos-clean-head-candidate.json`；候選位置：`../dist/test-build-0.51.0-head-17df978/`。此候選刻意不包含目前 dirty worktree 未提交變更，且 `spctl` 仍因 ad-hoc／未公證而 rejected，因此仍不可視為公開 Release。
- 2026-09-22 續以同一 clean HEAD `17df9788abf2cf964d52df10b74f9a8fcd7a45d6` 在隔離 detached worktree 封裝 macOS arm64 DMG／ZIP：DMG `hdiutil verify`、ZIP `unzip -t`、gzip blockmap、packaged runtime verify、version 0.51.0、deep strict codesign 與 DMG／ZIP 隔離實機 renderer／手動字幕／real trim／post-trim／AI asset smoke 均通過；兩條路徑 `spctl` exit 3／rejected 屬 ad-hoc／未 Developer ID／未公證預期限制，ZIP 未發現 `com.apple.quarantine`。證據：`docs/project-management/evidence/2026-09-22-macos-clean-head-packaged-acceptance.json`；候選位置：`../dist/test-build-0.51.0-head-17df978-packaged/`。dirty worktree 未提交變更未納入，Windows 依需求方要求暫緩，仍不可視為公開 Release。
- 2026-09-22 另補同一 clean-HEAD candidate 的本機 `latest-mac.yml`：以實體 DMG／ZIP bytes 獨立重算 URL／path／size／SHA-512，兩項 metadata 與 top-level updater path/hash 均一致，並重放 SHA256、DMG `hdiutil verify`、ZIP `unzip -t`。證據：`docs/project-management/evidence/2026-09-22-macos-clean-head-updater-metadata.json`；此 metadata 僅供 local QA，未上傳、未發布，`releaseReady=false` 維持。
- 2026-09-22 已以發布 commit `53956ccdee6e16e4c0413f09312a419613b27da6` 重建 macOS arm64 GitHub release candidate：`npm ci`／npm audit 0 vulnerabilities、完整 `npm run check`、runtime／version／deep strict codesign、DMG／ZIP integrity、`latest-mac.yml` URL／path／size／SHA-512、DMG／ZIP 兩條實機 renderer／字幕／trim／AI smoke 均通過。證據：`docs/project-management/evidence/2026-09-22-github-release-candidate-macos.json`；候選位置：`../dist/release-0.51.0-macos-53956cc/`。本輪 Release scope 僅 macOS arm64，Windows 依需求方要求暫緩；尚未上傳或建立 GitHub Release。

## 0.50.0 Breeze 效能透明化與首次選擇提醒（開發中）

- 開發分支：`codex/0.50-whisper-small-long-cues`（由 `codex/0.50-breeze-hardening` 延伸）；來源基準為公開 `v0.49.1` 的 `main@7829876`。
- `/api/breeze-asr` 將提供固定 `performanceReference`，首頁任務表單在選取 Breeze 時於產品名稱外顯示低資源效能提醒與 Whisper.cpp 回退建議。
- 此提醒只重述需求方提供的單一 MacBook Air M3／8 GB 觀察：1:46 影片約 6 小時（約 `3.4×`）；不代表跨機型保證、真實模型品質或已改善推論速度。
- 0.50.0 尚未建立 tag 或 GitHub Release；公開 Latest 仍為 `v0.49.1`。本機已由 `codex/0.50-whisper-small-long-cues@6beee98` 產生 macOS arm64 隔離測試候選，位置為 `../dist/test-build-6beee98/`，不屬公開發布資產。
- BUG-024 已完成本輪 deterministic 開發切片：Whisper Small 長 cue 保留完整文字，依標點／空白拆分並在正常時間下控制每行最多 20 字元；極短時間 fallback 的第二行可能較長，完整真實模型／長音訊品質仍待外部驗收，且尚未列為公開發布功能。
- BUG-025 已修正乾淨 profile 首次啟動的不必要 Keychain 查詢；最終 packaged renderer 以隔離 userData 通過主視窗、Breeze 首次選擇 modal、上傳／完成與 AI 校閱 smoke。既有真實加密 AI 金鑰跨版本解密、乾淨帳號 Gatekeeper 與公證仍未驗收。

## 0.49.0 Breeze 第一版正式發布

## 0.49.1 Breeze 首次設定流程正式發布

- PR #14 已合併至 `main`，annotated tag `v0.49.1` 指向 merge commit `917ae82886a0dff195009c66ce9438b78675fcc0`；GitHub Release 已公開並標示 Latest，既有 `v0.49.0` 保留為歷史版本。
- 首次選取 Breeze 會立即開啟模型下載／runtime 設定協助；選單不再把 experimental 說明混入產品名稱，文件與 Release notes 仍保留真實 runtime／品質／效能限制。
- 需求方 MacBook Air `Mac15,12`／Apple M3／8 GB／8 cores／macOS `26.5.2` 回報 1:46:00 影片約需 6 小時（約 `3.4×`），列為 0.49.1 發布依據與低資源效能警示，非跨機型驗收。
- tag workflow run `32095872065` 成功；Windows artifact `9309963799`（490,424,761 bytes，digest `sha256:6551957e320b6f299328bc2b13898134814534585854b1c9d9164096419be04a`）已下載重組並通過 ZIP／PE／checksum／`latest.yml` 核對。公開 Release 13 項 asset 的名稱、大小、digest、`/releases/download/v0.49.1/` URL 均已從 GitHub API 反向核對；metadata／blockmap／notes 直接下載 hash 與本機一致，四個主資產 Content-Length 與 API size 一致。
- 公開 Release：<https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.49.1>

- `codex/breeze-first-release` 由最新 `origin/main=05b275f` 建立，保留 0.48.1 已合併的 Windows CI、模型完整性、外部驗收與發布收尾修正；沒有直接發布落後 25 個提交的舊 Breeze 開發分支。
- FR-024 的 Breeze runtime／模型只讀探針與診斷遮罩已移植；`npm run probe:breeze -- --json` 會檢查固定 checkpoint 契約與 `whisper.available_models()` 能力，缺件時非零結束且不下載、不安裝或啟動任務。
- Breeze ASR 25 仍為實驗性選用功能；Whisper.cpp Tiny／Base／Small 維持預設。約 2.88 GiB checkpoint、Python、PyTorch 與 patched Whisper runtime 不納入安裝包。
- Breeze 首次選擇已改為立即開啟模型下載／runtime 設定協助；需求方 MacBook Air `Mac15,12`／Apple M3／8 GB／8 cores／macOS `26.5.2` 回報 1:46:00 影片約需 6 小時（約 `3.4×`），列為發布依據與低資源效能風險，非跨機型驗收。
- 0.49.0 已由 PR #11 合併至 `main`，annotated tag `v0.49.0` 解析至 merge commit `1f50b85c0599ef85c73f05085d70925d4d6b670a`；GitHub Release 保留為歷史版本，共 9 項資產。
- tag workflow run `31661442776` 完整通過，Windows artifact `9166375562` 來源為最終 tag commit；Setup／Portable、renderer、安裝解除、archive、checkpoint 排除與 updater metadata 已通過。公開 Release 的四個主資產、checksum、metadata 與簽章說明已從正式 URL 重新下載並反向核對；round3 獨立發布後審查已通過。
- GitHub CLI 已於 2026-08-13 重新登入 `twyderek`；公開 repo、PR #11、tag 與 Release 已完成。

## 0.48.1 正式發布狀態

- FR-022 已在目前工作樹加入 Whisper `tiny`／`base`／`small` 三模式選擇、模型檔案／manifest SHA 驗證與缺檔錯誤處理。
- FR-023 已加入 Base／Small 首次使用下載確認、固定官方 revision、userData 模型快取、進度與大小／SHA-256 驗證；下載失敗可依官方 URL 手動匯入。
- SYNC-024 已從 GitHub 核對 Windows Ollama 修正（遠端 `4d0bee6` 與本地 HEAD `170e08e` 完全一致），並同步最新 Azure OpenAI request parameter 修正 `baed6d7` 至目前工作樹與本機測試包。
- REL-025／REL-028 已收斂成 `v0.48.1` 正式交付：PR #8 已合併至 `main`，Release notes 已建立，公開封裝只內建 Tiny，Base／Small 使用首次下載；下載取消會停止背景請求並清除暫存檔。Electron 已升級至 43.3.0、electron-builder 升級至 26.15.7，完整 `npm audit` 為 0；兩平台封裝、四項資產 SHA-256、updater SHA-512、partial-body 取消與 active DELETE API 已通過核對。
- FR-024 的 Breeze ASR 25 實驗性流程已由後續 v0.49.0 正式發布；0.48.1 的公開資產與 tag 保留為歷史版本。
- 三模式 deterministic mock runner、模型下載 fixture 與核心 API 回歸已通過；Base／Small 中文準確率、速度、記憶體、Windows 10／11 實機安裝後驗收與真實 provider endpoint 仍是公開揭露的外部風險。
- `v0.48.1` Release 已公開，包含 macOS arm64 DMG／ZIP、Windows Setup／Portable、兩平台 updater metadata、SHA-256 與 Windows 未簽章狀態。

## 已完成成果

- Windows 10／11 x64：NSIS Setup 與 Portable 已建置並發布。
- Apple Silicon macOS 12+：DMG 與 ZIP 已發布。
- GitHub Release：<https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.49.1>
- 線上完整操作說明：<https://offline-subtitle-factory-0451-guide.derek62101.chatgpt.site>
- Windows 安裝包內含 `resources/docs/0.45.2/USER-GUIDE.html`、圖文資產與三段操作動畫。
- 0.45.1 已修正 Azure OpenAI GPT-5 的 `max_completion_tokens` 與 `temperature` 相容性，並加入可收合 AI 優化面板。

## 0.45.2 已發布成果

- 工作樹已完成多語言 LLM 字幕優化：12 個常用目標語言、自訂 BCP 47 標籤、前後端標準化、非法 API 值拒絕、舊設定回退與目標語言 Prompt。
- cue ID、數量、順序與時間碼保護已補強；交換順序的模型回應會被拒絕。
- 0.45.2 工作樹已補齊 Groq／Google Gemini 供應商識別、請求契約、profile／金鑰隔離、設定介面切換與未保存欄位連線防護；完整自動測試、本機瀏覽器實測及獨立審查通過。
- 自動測試、雙平台 CI／封裝與獨立審查已通過；v0.45.2 已公開發布。
- 目前工作樹新增語系選項調整：設定與 AI 輸出選單移除簡體中文；既有 `zh-CN` 介面設定載入時回退繁體中文，待本輪測試與獨立審查完成後納入下一個修正版。

## 歷史 0.45.2 發布資產狀態

- v0.45.2 為歷史公開 Release；目前公開版本已更新為 v0.49.0。
- v0.45.2 Windows 發布資產來自 CI run `29886823270`：`offline-subtitle-factory-setup-0.45.2.exe`、`offline-subtitle-factory-portable-0.45.2.exe`、`latest.yml` 與 SHA 已核對。
- v0.45.2 macOS arm64 發布資產為 ASCII DMG／ZIP；`latest-mac.yml` URL／path／size 與實際資產一致，DMG `hdiutil verify`、ZIP `unzip -t` 通過。

## 已知風險與未覆蓋項目

- Windows v0.45.2 候選資產未使用 Authenticode 簽章，可能顯示 Unknown Publisher／SmartScreen；使用者須核對 SHA-256。
- macOS v0.45.2 候選資產為 ad-hoc 簽章，未使用 Apple Developer ID 簽章或公證。
- Windows 尚缺乾淨實機的安裝、解除安裝、捷徑與離線手冊動畫播放 smoke test。
- 0.48.1 候選已將 Electron 33.4.11／electron-builder 25.1.8 升至 Electron 43.3.0／electron-builder 26.15.7；2026-08-10 完整 `npm audit --json` 為 0，舊 runtime／build-only advisory 已解除。
- 依 2026-07-30 工作樹盤點，現行 Windows workflow 已使用 `actions/setup-node@v4`、Node 22；先前 Node 20 deprecation 描述尚待歷史 CI 證據核對，不視為目前 workflow 已證實問題。
- Electron major 升級已通過完整自動回歸、macOS arm64 目錄版打包與 packaged renderer smoke、Windows x64 目錄版／Setup／Portable 建置；Windows renderer、乾淨安裝與 macOS DMG／ZIP 安裝後實機仍未由本輪證據覆蓋。
- 真實 LLM 是否完全遵循所選語言仍受模型能力影響，AI 建議必須逐段確認；多語言版本已完成 macOS 候選重建，但尚未完成跨平台乾淨實機驗證。
- Groq／Gemini 目前僅以 contract mock 與本機 UI 驗證，尚未用真實供應商金鑰做外部 smoke test。
- BUG-012：OpenAI-compatible 搭配舊 Gemini URL／模型的安全遷移已由 `server.mjs` 與 `scripts/test-core.mjs` 覆蓋，包含設定檔保存後的正規化值；既有使用者設定檔的跨平台啟動／重啟實機升級仍待驗收，不提前宣稱完整關閉。
- BUG-WHISPER-METAL-139：Metal 明確非零 exit／termination signal→CPU fallback 的觸發策略已抽出並由平台／架構／forceCpu／退出碼／signal 矩陣及 macOS arm64 child-process 整合 fixture deterministic 覆蓋；CPU retry 再失敗已驗證 failed 終止與 partial 清理，CPU child 就緒後的取消也已驗證 close 後 cancelled 與清理。先前 default sandbox direct replay 的 Metal exit 139 已由升級權限 direct replay 證明是執行邊界差異，產品 server 的 production-mode bundled path 亦完成正常 Metal smoke，另以不冒充 bundled runtime 的 deterministic wrapper 完成 production-mode fallback 控制流驗收；真實 bundled server crash→CPU fallback／取消、同一 callback 內窗口、長音訊與跨平台實機仍待驗收。
- FR-023：Windows userData 模型快取與固定來源下載已完成本機 API／fixture／封裝驗證；尚缺 Windows 實機的安裝權限、外網下載中斷／重試與中文口說品質驗收。
- SYNC-024：GitHub Windows 修正已確認不需重複套用；Azure OpenAI body 清理／capability token 修正已通過 provider contract 與完整回歸，Windows Ollama／Azure 實機仍待驗收。
- FR-024：deterministic 模型契約、API、CLI 參數、前端選擇器與完整回歸已通過；尚未下載真實 3 GB checkpoint、安裝官方 Python／PyTorch／patched Whisper runtime，亦未做兩平台真實音訊品質、效能、取消或長音訊驗收。

## 有效常設授權

- `AUTH-2026-07-23-01`：需求提出者／產品負責人已統一同意 Windows Authenticode 未簽章、macOS 未經 Apple Developer ID 簽章／公證狀態下對外發布。每次發布仍須引用授權 ID、揭露風險並完成測試、審查、SHA 與資產核對；未實機測試及其他風險不在此授權範圍。詳見 `09-STANDING-AUTHORIZATIONS.md`。

## 0.48.0 正式發布狀態

1. `FR-021`：新增 Ollama／LM Studio 本機 provider、固定常見端點探測與模型清單。
2. 只有精確 loopback hostname 才免 API Key 與雲端資料傳送同意；遠端端點維持既有安全門檻。
3. 本機 provider 使用較小批次，沿用 cue ID／數量／順序／時間碼保護與人工接受流程。
4. 提供本機／雲端隱私標示及模型 JSON、繁體中文、context 能力檢查；不自動下載模型。
5. 自動回歸已分別覆蓋 Ollama 的模型探索／能力／redirect 防護，以及 LM Studio 的完整優化、重試、取消、checkpoint／續跑；已修正「已有 checkpoint 的取消任務被誤標不可續跑」問題；macOS arm64 未簽章目錄版已完成 runtime、打包與 Electron renderer 預封裝驗證。
6. macOS arm64 目錄版、DMG、ZIP 與 Windows x64 未簽章目錄版／Setup／Portable 均已產出並完成 runtime／資產驗證；Windows renderer 仍待 Windows 實機啟動，macOS DMG／ZIP 安裝後仍待驗收。
7. Ollama 已完成 `llama3.2:1b` 真實模型的模型列表、能力檢查與字幕優化；另以 `llama3.2:3b` 驗證日文翻譯與模型解說文字清理。小模型輸出品質仍需逐段人工確認。
8. GitHub `v0.48.0` 已於 2026-07-30T03:58:52Z 正式公開並標示 Latest，tag 解析至 `4cdb0177d84693a334fac79b96c596e1b416456f`。Release 共 9 項資產：macOS DMG／ZIP、Windows Setup／Portable、`latest.yml`／`latest-mac.yml`、兩平台 SHA 與 Windows 未簽章說明；名稱、大小、GitHub digest 與正式下載 URL 均已反向核對。
9. 2026-07-30 的受控 probe 曾取得 Ollama 0.32.5、2 個模型，但 single-cue 未符合 strict JSON／cue contract；此為歷史失敗證據。2026-09-15 已以 Ollama 0.34.0／`llama3.2:1b` 重驗並完成 optimizer product path；LM Studio 實機驗收依需求方決策取消，仍因真正斷網與完整人工流程未完成，不把 `FR-021` 整體標為完成。

## 本機封裝儲存空間整理（2026-07-30）

- 已移除 `dist/` 中 0.21–0.47.1 的歷史 Release 複本、Google Drive 分片、舊 Windows/macOS 封裝與舊建置快取；這些版本的公開／歷史證據仍保留於 GitHub Release、tag 與專案治理文件。
- 保留 0.48.0 正式候選的 macOS DMG／ZIP、Windows Setup／Portable、blockmap、`latest.yml`／`latest-mac.yml`、SHA、簽章狀態，以及 `mac-arm64`／`win-unpacked` 驗證目錄。
- `dist/` 由約 10 GB 降至約 1.9 GB；刪除命令的目標容量合計輸出約 8.44 GiB。清理前逐檔輸出未保存成獨立證據，因此該數值只能作為操作摘要，不能由目前檔案重新計算。被刪除的封裝不在垃圾桶內，若需重取須由 GitHub Release 下載或重新建置。

## 0.46.0 已公開發布

0.46.0 已於 2026-07-23 建立公開 Release：https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.46.0。macOS arm64 DMG／ZIP 與 SHA-256 已上傳並核對 GitHub digest；Windows x64 由 CI run `29978500348` 完成真實 FFmpeg、EXE archive、手冊檔與 SHA-256 驗證，產出 unsigned artifact（保留 14 天），但未附 Authenticode 簽章。未核對一致性的 macOS updater metadata／blockmap 未上傳。

## 0.47.1 修正版已公開發布

- 已加入品質風險評估與校閱頁篩選：低 confidence／高 no-speech、過長、閱讀速度過快、重複文字與疑似專有名詞。
- 引擎品質指標缺失時只保存 `rule-score` 來源與規則結果，不偽造 confidence；已接入 Whisper.cpp JSON quality metadata 的容錯解析與 cue 對應通道，但本機內建 runtime smoke 發生 exit 139，尚未完成跨平台實際欄位映射與實機驗收。
- 0.47 rule-score fallback、quality metadata 安全回落、stale metadata 防護與 strict cue ID／時間／數量驗證已完成條件複審。
- GitHub `v0.47.0` Release 已保留為歷史發布，target commit 為 `7946f7f`；本版未移動或覆蓋該 tag。
- GitHub `v0.47.1` 已公開發布，annotated tag `v0.47.1` 解析至修正版 commit `0bd3b53`；Release 已包含 macOS arm64 DMG／ZIP、Windows Setup／Portable、`latest.yml`、Windows SHA-256 與簽章狀態說明。
- 发布后 GitHub API 已核对 7 项公开资产的名称、大小、SHA-256 digest 与直接下载 URL；本地 macOS DMG／ZIP 与 Windows artifact 内容及清单 SHA 已核对一致。
- 0.47.0 的 rule-score fallback、quality metadata 安全回落、stale metadata 防護與 strict cue ID／時間／數量驗證延續至本版；Metal exit 139、未簽章／未公證與跨平台實機缺口仍須如實揭露。
- 发布后仍须持续揭露 Windows 未 Authenticode、macOS 未 Developer ID／公证、Metal exit 139、Electron 与跨平台实机缺口；本版发布独立审查结果记录于工作纪錄与 reviews。
