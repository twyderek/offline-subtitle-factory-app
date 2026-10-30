# 獨立審查報告：FR-021 macOS signed-canary notarytool keychain-profile argv hardening next1 round1

- 審查對象：目前工作樹本輪指定變更 `.github/workflows/macos-signed-canary.yml`、`scripts/test-macos-signed-canary-gate.mjs`、`scripts/test-macos-signing-readiness.mjs`、`scripts/audit-macos-signed-canary-external-boundary.mjs`、`scripts/test-macos-signed-canary-external-boundary.mjs` 與 `docs/project-management/08-CHANGE-LOG.md` 最新條目。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS signed-canary notarytool keychain-profile argv hardening（`FR-021-MACOS-CI-20261029-NOTARY-KEYCHAIN-PROFILE-NEXT1`）。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-29（Asia/Taipei）；獨立唯讀上下文，重新執行 `npm run project:preflight -- --type=full`，讀取固定核心／full route、最新 08 條目與目前指定 source／test；未沿用主要代理的評價性結論。
- 審查限制：只新增本報告；未修改 source、evidence、08 或既有 review，未 stage／commit／push，未執行 workflow、builder、codesign、`notarytool`、`store-credentials`、stapler、hdiutil、Gatekeeper、signing、notarization、release 或 GitHub remote write。
- 驗證環境：Node.js `v22.22.3`、Apple Silicon macOS（`Darwin`／`arm64`）；目前工作樹保留大量既有 unrelated dirty changes。

## 1. 需求完整性

- 判定：通過。
- 判定範圍：僅限 bounded source／local contract；不擴大為 workflow runtime、Apple credential 或 FR-021 overall acceptance。
- 證據：最新 08 條目 `:3-14` 要求固定 `osf-signed-canary` profile、兩個 notary submit 使用 `--keychain-profile`、不含 password／Apple ID／Team ID argv，並要求 readiness／external-boundary 一致；目前 workflow `:59-104、:121-176`、gate test `:66-78、:167-188`、readiness test `:64-87` 與 external-boundary diff `:13、:36-53` 均對應覆蓋。
- workflow 的 readiness、builder、notary steps 均使用 `APPLE_KEYCHAIN_PROFILE: osf-signed-canary`；notary DMG／ZIP submit 均使用 `--keychain-profile "$APPLE_KEYCHAIN_PROFILE"`，目前檔案沒有 `OSF_APPLE_ID`、`OSF_APPLE_APP_SPECIFIC_PASSWORD`、`OSF_APPLE_TEAM_ID` 或 `--password`／`--apple-id`／`--team-id` 路由。
- readiness contract 同時保留 Apple ID complete set、API key complete set 與 keychain-profile complete set 的互斥判定；`APPLE_KEYCHAIN_PROFILE` 為完整 route 時 `summarizeNotarizationCredentialState()` 回傳 `complete`／`ready: true`，未把舊 Apple credential argv 重新帶回 workflow。
- external-boundary audit 將 `requiredSecretNames` 改為空集合，與實際不使用 GitHub Apple credential secrets 的 workflow 一致；這只表示不再要求未使用的 Environment secret metadata，不表示 runner keychain profile 已存在或可用。

## 2. 邏輯正確性

- 判定：通過。
- 判定範圍：僅限 argv／readiness／projection 邏輯；實際 keychain provisioning 保留為外部 residual。
- 證據：workflow `:123-127` 在 notary step 執行 `test "${APPLE_KEYCHAIN_PROFILE:-}" = "osf-signed-canary"`；`:165-176` 的兩個 `xcrun notarytool submit` 只傳入 input、`--wait`、JSON output、`--keychain-profile`。gate test `:167-188` 驗證三個固定 profile injection、兩個 notary flags 與 credential argv absence。
- password、Apple ID、Team ID 不會由 workflow shell 直接拼入 notarytool argv；profile label 是固定非秘密字串，未使用 `--password`、`--apple-id` 或 `--team-id`。`set -euo pipefail` 與固定 profile runtime assertion 使 profile 缺失／改值時在 notary step fail-closed。
- readiness consistency 正確：`audit-macos-signing-readiness.mjs:52-64、454-488` 將 profile presence 納入 exact credential schema，`assert-macos-signed-canary-ready.mjs:101-127` 重新計算並比對 notarization projection；gate test 以 keychain-only route `:66-78` 實測 readiness／consistency 均為 true。
- external-boundary `:127-145、182-203` 只投影 bounded secret count／required-name boolean；`scope` `:227-242` 保持 remote read-only、secret values／raw output／reviewer names 全 false，沒有把 profile label 或 secret value寫入 evidence。
- 這些判定只驗證 argv／projection contract；readiness 的 profile presence 是環境變數布林值，不會驗證 keychain profile 真實存在、profile 對應 credential、notarytool 可成功解析 profile 或 Apple ticket validity。此限制與最新 08 `:11` 的不在範圍聲明一致，不構成 source finding，但必須保留為外部條件。

## 3. 邊界情況

- 判定：通過。
- 判定範圍：涵蓋 deterministic fixtures／static mutation guards；不等同真實 notarytool 或 runner credential runtime proof。
- 證據：gate test `:82-148` 覆蓋 absent／partial／ambiguous credential sets、invalid identity／toolchain、platform／arch、derived consistency 與 whitespace credential；`:167-188` 覆蓋固定 profile count、Apple credential argv absence、notary flag count 與固定 profile assertion。
- workflow mutation guards `scripts/test-macos-signed-canary-gate.mjs:209-230` 維持 positional、submitted 0600、dual output、cleanup、repack 與 existing ZIP guards；本輪 profile mutation 會由 exact label count、notary-step fixed-value assertion 或兩個 flag count 攔截。
- readiness test `scripts/test-macos-signing-readiness.mjs:77-96、158-204` 覆蓋 keychain-only complete、keychain partial／ambiguous、credential schema unknown／missing、derived notarization mismatch、scope／privacy、toolchain 與 identity negative cases。
- external-boundary test `scripts/test-macos-signed-canary-external-boundary.mjs:36-53、66-105` 覆蓋 zero-secret metadata、Environment／reviewer／remote missing、malformed secret response、scope fail-closed、branch mismatch、privacy leakage 與 exclusive 0600 writer；不會把 invalid secret metadata 當成 ready。
- 未執行真實 notarytool、keychain profile resolution、runner provisioning、workflow run 或 Apple service；因此不把 fake／static mutation matrix 宣稱為 runtime credential proof。

## 4. 程式碼品質

- 判定：通過。
- 證據：workflow 只將非秘密 profile label 經 step `env` 傳給 readiness／builder／notary；未將 Apple password、Apple ID、Team ID 或 API key 放入 argv。external-boundary evidence 只保存 secret count／bounded booleans，test `:47-53` 確認 reviewer name 與 `OSF_APPLE_ID` 不落盤。
- `audit-macos-signed-canary-external-boundary.mjs:316-319` 以 exclusive `wx`、0600 writer 保存 evidence；`:309-312` 對 scope、interpretation 與 absolute path／token／private-key leakage fail-closed。required secret set 為空不會讀取或保存 secret value。
- 變更保持小範圍：workflow credential route、readiness focused contract、external-boundary required-secret projection 與 corresponding tests；沒有藉本輪修改放寬 branch protection、Environment、remote state、signing 或 network scope。
- `git diff --check` 通過；本報告以外沒有由本審查代理寫入檔案。

## 5. 測試覆蓋

- 判定：部分通過。
- 判定範圍：focused／syntax／YAML／治理 checks 通過；完整 `npm run check` 未由本輪重跑。
- 證據：`node scripts/test-macos-signed-canary-gate.mjs`、`node scripts/test-macos-signing-readiness.mjs`、`node scripts/test-macos-signed-canary-external-boundary.mjs` 均 exit 0；四個指定 JavaScript `node --check`、Ruby YAML parse、`git diff --check`、`node scripts/test-project-docs-validator.mjs` 與 `npm run docs:check` 均 exit 0。
- focused test output 分別確認 signed-canary gate contract、readiness identity／toolchain／notarization fail-closed matrix，以及 external-boundary bounded GitHub projection／secret redaction／exclusive evidence writer。
- `npm run docs:check:final` 於本輪 exit 1，具體原因是最新 08 條目缺少「獨立審查是否執行：」與「發布授權：」，且狀態仍為「進行中」；這是本輪禁止修改 08 的治理 closeout residual，不是 source／test finding。
- 本輪未執行完整 `npm run check`、任何會寫入 evidence 的 audit main 或 workflow；因此測試結論限定為目前 focused／syntax／YAML／治理 checks，不能替代 full regression 或 Apple runtime validation。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：本機唯讀執行 `node scripts/assert-macos-signed-canary-ready.mjs` 於 `2026-10-29T07:41:31Z` exit 1，安全摘要為 `sourceConfigReady:true`、`requiredToolchainReady:true`、`identityProbeReady:true`，但 `formalIdentityAvailable:false`、`notarizationStatus:"absent"`、`notarizationCredentialReady:false`，reasons 為 `developer-id-application-not-ready` 與 `notarization-credential-set-not-ready`；gate 沒有把本機狀態誤判為 ready。
- 未執行／不宣稱：沒有 GitHub Actions workflow run、self-hosted runner keychain profile provisioning／resolution、`security` profile validation、`notarytool`、`store-credentials`、codesign、builder、Apple notarization／ticket validity、stapler、Gatekeeper、release、Environment／secret／branch-protection write 或 FR-021 overall acceptance。
- 外部 residual：要完成 runtime boundary，外部需在受控 self-hosted macOS arm64 runner 預置並驗證 `osf-signed-canary` notarytool keychain profile，且其 profile 需可供兩個 submit 實際解析；本輪 source contract 不足以證明該 provisioning。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-CI-20261029-NOTARY-KEYCHAIN-PROFILE-NEXT1` round1 獨立審查結論為 bounded source／local contract 有條件通過：目前 workflow 的 readiness／builder／dual notary route 固定使用 `osf-signed-canary`，兩個 `notarytool submit` 均只使用 `--keychain-profile` 且沒有 password／Apple ID／Team ID argv；readiness summarizer、gate regression 與 external-boundary projection 已與該 route 一致，focused／syntax／YAML／治理 checks 通過；但本輪未驗證 self-hosted runner 實際 keychain profile provisioning／resolution、Apple identity、notarytool、workflow run 或 Apple notarization，因此不宣稱 signed／notarized candidate、release 或 FR-021 overall，且主要代理仍須完成 08 closeout 後重跑 `npm run docs:check:final`。**
- Findings：本輪未發現未處理的 source／test 技術 finding；profile 真實存在／可用性是最新 08 明示的不在範圍外部 residual，而非本輪可由 source contract 關閉的事項。
- 阻擋問題（若有）：目前無 source／test 技術阻擋；但最新 08 尚為「進行中」且缺少獨立審查／發布授權欄位，故 final docs gate 目前失敗；本報告不修改 08。
- 剩餘風險：self-hosted runner 的 keychain profile 是否已建立、profile 是否綁定正確 notarization credential、notarytool submit 是否實際成功、Apple ticket／staple／Gatekeeper 是否有效、GitHub Environment／reviewer／branch protection 與 FR-021 overall 均未由本輪證明。
- 給主要開發代理的具體後續：完成 08 的本報告 linkage／審查欄位／狀態 closeout，重跑 final docs gate；取得外部 runner provisioning 後，另以受控 workflow run 驗證 profile resolution 與 dual notary success，維持不保存 password／Apple credential argv 的要求。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
