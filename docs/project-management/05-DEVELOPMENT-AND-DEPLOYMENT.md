# 軟體開發與部署

## 2026-10-30 FR-021 signed-canary prerequisite revalidation review findings remediation

- formal gate evidence validator 現同時接受合法 ready／blocked pre-builder evidence，並以同一 evaluator 拒絕 source config、toolchain、identity、notarization、reasons 或 ready relation 的矛盾 projection；focused test 覆蓋兩條結果路徑、各類 derived mismatch 與 exclusive fail-closed writer boundary。
- readiness evidence validator／focused test 現固定 timestamp 型別、UTC ISO millisecond format、時間順序與 date-first authoritative selector；本輪未修改既有 immutable evidence、workflow、keychain、candidate 或 remote。
- remediation focused／full deterministic checks 通過，仍須最終獨立複審與治理 final gate；不代表 signed／notarized candidate、workflow run 或 FR-021 overall。

## 2026-10-30 FR-021 macOS signed-canary external prerequisites revalidation next stage 2

- `next15` external boundary、`next7` signing readiness 與 `execution7` formal gate 均以 current HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b` 重新保存並採 `0600`；SHA-256 分別為 `7ae2b6b4e1e069bceac479669c57cc07393f59cf904049faf76058620bc9868c`、`11996d29916cbac5dda392cf476e53f37ded8e07e23daff8f1aaf72cde97caaa`、`29710462ca9757750a8d897418c7b3a90d01e180469f69a9261f960b90da0ab9`。
- GitHub Environment／required reviewer／secret metadata／protected branch 仍未就緒；本機 0 valid Developer ID identity、credential absent，formal gate 仍在 runtime manifest／builder 前停止。workflow content 與 source match 不等同 workflow run 或 signed candidate。
- 本輪未修改 remote／keychain／candidate，未觸發 workflow，未執行 builder／codesign／notarytool／stapler／Gatekeeper／packaged app／UI／Ollama／model／network；三份 evidence 只反映 current prerequisite state。

## 2026-10-30 FR-021 macOS signed-canary external prerequisites revalidation next stage

- 10/30 `next14` external boundary、`next6` signing readiness 與 `execution6` formal gate 均以 current HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b` 重新保存並採 `0600`；三份 SHA-256 分別為 `3f9055efef9e7af3a508c485ac55910a5a787eeefa0e5cd4db9f26f429a0789f`、`15f43ad1722344019cf48e3d2e5b8d0edae280d5283c51ef05f99b3585cc5cfa`、`ae372012947ffecb12f29ce607b7854474804dc78e18011b30bac4a0b5edee39`。
- GitHub Environment／required reviewer／secret metadata／protected branch 仍未就緒；本機 0 valid Developer ID identity、credential absent，formal gate 仍在 runtime manifest／builder 前停止。workflow content 與 source match 不等同 workflow run 或 signed candidate。
- 本輪未修改 remote／keychain／candidate，未觸發 workflow，未執行 builder／codesign／notarytool／stapler／Gatekeeper／packaged app／UI／Ollama／model／network；三份 evidence 只反映 current prerequisite state。

## 2026-10-29 FR-021 macOS signed-canary current-source formal build gate recheck next stage

- execution5 `docs/project-management/evidence/2026-10-29-fr-021-signed-canary-gate-execution5.json` 以 current source 的 gate／package／focused-test provenance 保存 mode `0600`、SHA-256 `5a1bb264b698f78d958d7bd53056c57aae5ed6cf2b4349fd0dd1905f203872e5`。formal evaluation `ready=false`，reasons 為 Developer ID Application identity 與 notarization credential set 未就緒。
- source config／required toolchain ready，identity probe 成功但 `validIdentityCount=0`、`formalIdentityAvailable=false`，notarization status `absent`；execution 在 runtime manifest／builder 前停止，未建立 candidate。
- 本輪只保存去敏 read-only gate evidence；未執行 builder／runtime manifest／codesign／notarytool／stapler／Gatekeeper、workflow、packaged app／UI、Ollama／model 或 network。execution5 不代表 signed／notarized candidate 或 release。

## 2026-10-29 FR-021 macOS signed-canary current-source signing readiness recheck next stage

- current-source readiness `next5` evidence `docs/project-management/evidence/2026-10-29-fr-021-prerequisite-readiness-recheck-next5.json` 綁定 local HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b` 與目前 audit script／package／focused test hashes；status `blocked-external-signing-identity`、mode `0600`、SHA-256 `11312386df77c2bee79accf6f07a055693abeef236c15ea8a13d8b3d2dcc1937`。
- source config／required Apple toolchain／existing evidence／provenance ready，但 identity probe 成功且 `validIdentityCount=0`、`formalIdentityAvailable=false`；notarization credential 三種 route 均 absent。正式 signed-canary gate 因 external identity／credential 缺口保持 fail-closed，未進入 builder。
- 本次只讀核對未修改 keychain／candidate／remote／workflow，未執行 signing／notarization／packaged app／UI／Ollama／model 或 network；next5 不代表 signed／hardened candidate、Apple ticket、Gatekeeper、release 或 FR-021 overall。

## 2026-10-29 FR-021 macOS signed-canary notarytool keychain-profile runtime resolution preflight

- workflow 在 `Prepare isolated signed-canary output`／`electron:build:mac:signed-canary` 前執行固定 profile 的 read-only `notarytool history` probe；stdout／stderr 不保存，非 0 由 `set -euo pipefail` fail-closed，避免未解析的 runner profile 進入 builder。source commit `f16ae8be60fb132bdbb1a128722a244f70f86e6b` 已推送，round2 review 確認 F-01 mutation guard 已關閉。
- probe 只增加受控 runner 的 profile resolution gate，不建立／修改 keychain、Environment、secret 或 branch protection；本機未執行 probe、workflow、builder、signing 或 notarization。next12 external-boundary 仍為 `fail`，只代表 remote configuration gap，未讀取 secret value。

## 2026-10-29 FR-021 macOS signed-canary notarytool keychain-profile argv hardening

- workflow readiness／builder／notary steps 只注入固定 `APPLE_KEYCHAIN_PROFILE: osf-signed-canary`；DMG／ZIP notary submit 使用 `--keychain-profile`，不使用 `--password`、`--apple-id`、`--team-id` 或 `OSF_APPLE_*` secret。Apple credential 由受控 self-hosted runner 的 notarytool keychain profile 提供，profile provisioning 不在本機 source workflow 執行。
- readiness gate 將 keychain-only profile presence 視為唯一 credential route 的 bounded contract；external-boundary audit 不再要求未使用的 Apple secret names，但仍唯讀記錄 Environment／secret metadata endpoint 是否存在。source-only commit `ce72b64f8aa2b937e1b589e1b9577835dd691ca8` 已推送，未執行 workflow、`store-credentials`、builder 或 Apple toolchain。

## 2026-10-29 FR-021 macOS signed-canary ZIP target coverage hardening

- signed-canary workflow 先以 selector 唯一選出 app／DMG／ZIP；notary step 以 run ID 綁定並以 0600 保存送審前 DMG／ZIP 與兩組 notary JSON／stderr，分別送 DMG／ZIP，staple app／DMG 後刪除並以 `ditto -c -k --sequesterRsrc --keepParent` 重建 final ZIP。
- post-build verification 使用 `xcrun stapler validate`、`hdiutil verify` 與 `/usr/bin/unzip -tqq`；distribution audit 以八個固定 positional args 寫 bounded evidence，再由 `always()` cleanup 移除 checkout evidence、notary outputs、submitted archives 與 run-scoped output。ZIP 不直接 staple，送審 ZIP 與 final ZIP 維持不同 provenance。
- 本輪 source-only commit `3a8f04080d810fae55df6b58b5b1b4991a2632ba` 已推送至 `codex/0.51-anthropic-claude`；round2 bounded contract review 有條件通過。未執行 workflow／builder／codesign／notarytool／stapler／hdiutil，未修改 GitHub Environment、secret、reviewer 或 branch protection。

## 2026-10-29 FR-021 macOS malformed candidate evidence contract

- `CFBundleExecutable` 缺失／非法或 binary 不可讀時，兩支 read-only macOS audit 會使用 bounded null hash、固定主 app／Framework／四 helper object shape 與 strict 64-hex readiness gate，透過 exclusive 0600 writer 產生 `status: fail` evidence；不把 malformed candidate 送進 signing、notarization 或 packaged execution。
- source-only commit `ae599e780fc246910e8e625c142c2af0ac87b412` 已推送；round2 獨立審查有條件通過，`npm run check`／focused fake-darwin probes／治理 final gate 已完成。這不代表 Apple runner、Developer ID identity／credential、workflow run、signed／notarized candidate 或 release。

## 支援環境

- Node.js 22.12.0 以上；CI 目前使用 Node.js 22。Electron 43 的安裝工具鏈不再支援 Node 20。
- 0.51.0 公開版使用 Electron 43.3.0／electron-builder 26.15.7。0.52.0 使用 Electron 43.8.0／electron-builder 26.17.0，source tag `v0.52.0` 指向 `b6b1efd6b72574f9210af74729d2cb2fd869e42d`，已於 2026-10-20 發布為 GitHub Latest，範圍限定 macOS arm64。round16 獨立審查 PASS；DMG／ZIP、兩個 blockmaps、`latest-mac.yml`、SHA-256 sidecar、signing status 共七項 asset 的名稱／大小／digest／下載 URL 與候選核對相符。Windows exact-source preview run `39382252222`／artifact `12246485809` 的 manifest／73 shared hashes 通過其聲明範圍，但完整 archive 未下載、不是本次發行 asset。UI 合成影片沒有有效播放／完整轉錄證明；真實 Google／Keychain／上傳未驗收。ad-hoc／未公證與 `GHSA-hp3w-g68c-fv3c` build-time advisory 依 Release notes 揭露。發布後狀態與資產詳見 `00-CURRENT-STATUS.md`／`06-TEST-AND-PROCESS-AUDIT.md`；不得覆寫既有 tag／Release。
- 0.50.0 開發分支目前只變更 Breeze 效能參考 payload、選取後提醒與版本識別；尚未建立 tag／Release。若進入發布流程，需以 `v0.50.0` 重新建置並重新核對雙平台資產。
- Windows 10/11 x64；封裝由 `windows-2022` runner 執行。
- Apple Silicon macOS 12 以上。

## 每次開發前

```bash
npm run project:preflight -- --type=development
git status --short
```

完成必讀並在 `08-CHANGE-LOG.md` 建立工作項目後，才可修改。安裝依賴使用 `npm ci`；不得將 token、API Key、PFX 或密碼寫入檔案。

## 本機驗證

```bash
npm run docs:check
npm run check
```

`npm run check` 應包含文件完整性、語法、媒體編輯、AI optimizer、provider、校閱 UI 與核心 API 回歸。需要本機 port 的測試若受 sandbox 限制，須明確取得授權後重跑。

## Windows runtime 與打包

```powershell
npm ci
Set-ExecutionPolicy -Scope Process Bypass
./scripts/prepare-windows-runtime.ps1
npm run check
npm run electron:build       # 需要有效簽章設定
npm run electron:build:unsigned  # 僅供已明確接受風險的未簽章版本
```

- runtime 固定版本並比對 SHA；不得依賴開發機 venv 或系統 PATH。
- 正式可信發布應配置 `WINDOWS_CODESIGN_PFX_BASE64` 與 `WINDOWS_CODESIGN_PASSWORD`。
- 未簽章發布必須在 Release notes、狀態檔與交付說明標示 Unknown Publisher／SmartScreen，並附 SHA。
- Setup、Portable、blockmap、`latest.yml` 的檔名必須彼此一致；上傳後需重新核對 GitHub 實際資產名稱。
- Breeze checkpoint、Python／PyTorch／patched Whisper runtime 不納入 Windows runtime 或安裝包；封裝必須包含 `docs/BREEZE-ASR-25.md` 與 0.49.1 Release notes，並維持 Whisper.cpp Tiny 為預設可用路徑。

## macOS 打包

2026-10-29 新增獨立 `electron:build:mac:signed-canary`：先執行 `scripts/assert-macos-signed-canary-ready.mjs`，只有 macOS arm64、source `hardenedRuntime／gatekeeperAssess` 與有效 `dmg／zip／dir` arm64 targets、required `codesign`／`xcrun`／`notarytool`、Developer ID Application identity 與單一 complete notarization credential set 全部成立，才會進入 runtime manifest／verify 與 `electron-builder --mac --arm64 --publish never`。gate 只保存去敏 summary；目前實際結果為 `SIGNED_CANARY_GATE_BLOCKED`，未進入 builder，execution2 evidence 已保存。既有 `electron:build:mac:dir`／`electron:build:mac` 不變。

2026-10-29 signed canary／notarization prerequisite preflight 已完成：正式設定移至獨立 `electron-builder.signed-canary.mjs`，由它在 signed canary 內使用 auto-discovery、`hardenedRuntime: true`、`gatekeeperAssess: true`；base `build.mac` 仍保留 `identity: null`、hardened／Gatekeeper false 的 development／unsigned boundary。audit12 `docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit12.json` 完整核對 Apple ID、API key、keychain profile 三種 credential path；credential presence／derived summary／decision／所有 nested leaf／有效 arm64 target／generic path privacy schema 均 exact fail-closed。當前 status 為 `absent`／`notarizationCredentialReady=false`，且本機 `0 valid identities found`、decision 為 `blocked-external-signing-identity`；未建立 signed／hardened candidate，未執行 signing／notarization。audit11／audit10／audit9／audit8 保留為前輪 immutable records。

2026-10-29 post-build verification contract 已與 base build path 分離：取得外部 identity／credential 後，先執行 `electron:build:mac:signed-canary`，再以 `npm run audit:mac:signed-canary -- <candidate.app> <exclusive-evidence.json>` 產生 0600 immutable result；目前不執行此 audit。config split 後的 gate execution4 已保存，sourceRevision 以 gate audit script／gate focused test 的 SHA-256 綁定目前 source，仍在 builder 前以 `developer-id-application-not-ready`／`notarization-credential-set-not-ready` 停止。

### macOS signed-canary CI handoff

`.github/workflows/macos-signed-canary.yml` 是只由 `workflow_dispatch` 觸發的 dormant handoff，不會在 push／tag 時自動執行；目前只接受 `refs/heads/codex/0.51-anthropic-claude`，該 branch 必須由 repository 管理者設為 protected branch。job 使用 GitHub Environment `macos-signed-canary`，該 environment 必須設定 required reviewers，且只接受 labels `self-hosted`、`macOS`、`arm64`、`osf-signed-canary` 的 Apple Silicon runner；runner 必須事先由發布環境管理者安裝 Developer ID Application identity，且 `security find-identity -v -p codesigning` 可讀到有效 identity。workflow 不匯入或建立 keychain identity。

workflow 不再使用 `OSF_APPLE_*` environment secrets；readiness／正式 gate／builder／notarytool steps 只注入固定非秘密 `APPLE_KEYCHAIN_PROFILE: osf-signed-canary`。Environment required reviewers 與 protected ref 仍是 source／runner trust boundary，profile credential 不得寫入 repository、artifact 或 log。readiness 只產生 evidence，之後無論 readiness 結果如何都必須再執行 `assert-macos-signed-canary-ready.mjs` 正式 gate；gate exit 0 後，builder 前另執行 `xcrun notarytool history --keychain-profile "$APPLE_KEYCHAIN_PROFILE" --output-format json --no-progress`，probe 非 0 即停止且不建立 candidate。只有 profile probe 與 formal gate 都成功才進 runtime manifest／builder，任何 gate／probe 未 ready 時都不 fallback 到 unsigned／ad-hoc builder。

gate ready 後，workflow 在每次 run 的 `$RUNNER_TEMP/osf-signed-canary-dist-$GITHUB_RUN_ID` 建立空的 output directory，signed builder 透過 `OSF_SIGNED_CANARY_OUTPUT_DIR` 使用該目錄；artifact selector 只接受 `mac-arm64` 直接子項的單一主 app 與 output root 的單一 arm64 DMG，避免 nested Helper.app 或 persistent runner stale candidate 被誤選。notarytool 成功輸出固定 basename 的 run-scoped JSON 與暫存 stderr（均 0600），distribution audit 以 output JSON 的 parseable Accepted status、DMG hash、run ID basename 與 diagnostic digest 作 success projection；不接受 caller-supplied marker。DMG `stapler validate`／`hdiutil verify` 與 app executable／DMG digest 由 distribution audit 投影到 bounded evidence，先複製至 CI artifact 再移除 repository 暫存檔與 raw notary output，之後才執行 app result audit。完成後清理 run-scoped directory；Actions 使用 immutable commit SHA，並設置 `concurrency` 防止同一 ref 並行 signed run。

這條 workflow 只提供外部環境的可交接路徑；目前未觸發、未驗證 runner／identity／credential／notarization，也不改變目前 `0 valid identities found`、未建立 signed candidate、Seatbelt renderer、全機 egress、Windows、LM Studio 或 FR-021 overall 的阻擋狀態。

2026-10-29 external boundary audit 已以固定 `gh api --hostname github.com` 做 read-only 核驗，結果保存於 `docs/project-management/evidence/2026-10-29-fr-021-macos-signed-canary-external-boundary-next6.json`（status `fail`、mode `0600`、SHA-256 `bb21059bb0408f0f6643f81b9e1911df20a06a4563cdd272f62de612e739a40a`）。remote branch ref 存在於 `22f7a09767923973c698fa817c543a1e586495f4`，但 `macos-signed-canary` Environment、environment secret metadata、branch protection 與 workflow content endpoint 均回傳 404；local workflow 尚未部署到 remote，local HEAD 也與 remote branch 不同。scope 明確區分 secret metadata query 與未讀 secret value；required reviewer metadata 與 local git status 均採 fail-closed。這是 remote configuration gap 的觀測，不是建立或修改設定的授權；本輪未讀 secret 值、未觸發 workflow、未寫入 GitHub。

2026-10-29 source-only handoff 已完成：commit `8dd82fbe71e754616d1c87971670e1e5ad5bf7bc` 已推送且 remote ref／workflow content 唯讀回讀一致；workflow 在 Apple secret references 前以 `${{ github.ref_protected }}` fail-closed 驗證 protected ref，readiness evidence `next4` 綁定本輪 source hashes。push 後 `next7` external-boundary audit 仍為 `fail`，但已確認 remote workflow present／source matches，Environment、environment secret metadata 與 branch protection 尚未設定；未觸發 workflow、builder、signing、notarization 或 release。round4 只支持 source-only handoff，不支持 signed／notarized candidate 或 FR-021 overall。

2026-10-29 result evidence cleanup hardening 已完成：workflow final `always()` cleanup 以 `ci-${GITHUB_RUN_ID}-macos-signed-canary-result.json` 固定 path 綁定實際 `rm -f -- "$result_evidence"`，focused test 的 mutation regression 會在 rm 行移除時失敗；commit `4fdbcc279409690ed39ff922703e328bb49a741b` 已推送。這只改善 self-hosted checkout hygiene contract，未執行 workflow／signing／notarization，next8 external configuration gap 維持。

audit5 `docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit5.json` 是 source config preparation 前的 immutable readiness record，當時記錄 `identity: null`、`hardenedRuntime: false`、`gatekeeperAssess: false`；不得以該歷史狀態覆蓋 audit6 的 current source conclusion。

```bash
npm ci
npm run check
npm run electron:build:mac:dir
npm run electron:build:mac
```

- 目前為 ad-hoc 簽章、未公證；不得描述為 Apple Developer ID 正式公證版本。
- 2026-10-28 read-only identity audit3 對目前 arm64 candidate 核對出主 app、Electron Framework 與 4 個 helper 均 `codesign --verify --deep --strict` 通過，helper inventory 完整，但全部為 ad-hoc、沒有 Team ID／entitlement；該 candidate 的 historical source config 為 `identity: null`、`hardenedRuntime: false`、`gatekeeperAssess: false`。詳見 `docs/project-management/evidence/2026-10-28-fr-021-packaged-security-identity-audit3.json`；audit2 baseline 保留未覆寫。這是 packaging follow-up 證據，不是 nested Chromium 根因或 UI acceptance。
- 若要驗證 signed／hardened packaging 是否改善 renderer startup，必須另建隔離 candidate、使用新的 immutable evidence 與同一安全 startup／cleanup gate；不可修改既有發布 candidate，也不可用關閉 sandbox 的旗標替代。
- 2026-10-29 CLI-only `mac.hardenedRuntime=true` canary 未形成有效對照：electron-builder 因 `identity: null` 跳過 code signing，新 bundle 仍為 ad-hoc／無 Team ID／無 entitlement；未執行新 candidate。建置曾下載 Electron dependency，詳見 `docs/project-management/evidence/2026-10-29-fr-021-hardened-runtime-packaging-canary-build1.json`。
- 只讀 `security find-identity -v -p codesigning` 回報 0 valid identities found；沒有本機 signing identity 時，不得把 CLI hardened-runtime override 描述成有效 signed／hardened package。
- 隔離 ad-hoc diagnostic 以 `codesign --options runtime` 產生 `0x10002(adhoc,runtime)`，audit2 的 required-runtime gate 與 deep verify 均通過，但無 Team ID／entitlement；兩個 bounded startup probe 均 `SIGABRT`／無 CDP，不能取代正式 signed／hardened package 或 UI acceptance。詳見 `docs/project-management/evidence/2026-10-29-fr-021-adhoc-runtime-signing-canary-audit2.json` 與 signing operation evidence。
- 發布前驗證 `.app`、DMG、ZIP、bundled runtime 與 SHA。
- Electron 43 是目前維持 macOS 12 最低版本的升級線；後續若升至 Electron 44 以上，須先把最低支援版本重新評估為 macOS 13 以上。
- Breeze checkpoint、Python／PyTorch／patched Whisper runtime 不納入 App bundle；封裝內容檢查須確認沒有意外帶入開發機 venv、模型快取或約 3 GB checkpoint。

## GitHub 發布清單

1. 執行 `npm run project:preflight -- --type=release`；確認工作樹、版本號、分支、commit 與 Release tag 關係已記錄。
2. CI build 與必要測試成功；來源 SHA 與 artifact 可追溯。
3. 下載 artifact，核對 runner checksum；展開或列出封裝內容。
4. 更新 Release notes：功能、修正、手冊、簽章狀態、已知風險。
5. 上傳穩定 ASCII 檔名的資產，避免平台改名造成 checksum／updater 不一致。
6. 發布後核對名稱、大小、GitHub digest、直接下載 URL、checksum 內容與 `latest.yml`。
7. 更新 `00-CURRENT-STATUS.md`、`04-DEVELOPMENT-HISTORY.md`、`06-TEST-AND-PROCESS-AUDIT.md` 與 `08-CHANGE-LOG.md`。

## 常設簽章風險授權

- `AUTH-2026-07-23-01` 已同意 Windows Authenticode 未簽章及 macOS 未經 Apple Developer ID 簽章／公證狀態下公開發布。
- 每次適用發布須在工作紀錄引用該 ID，並持續揭露 Windows Unknown Publisher／SmartScreen 與 macOS Gatekeeper 風險。
- 此授權不涵蓋未實機測試、checksum／資產不一致、未驗證 updater metadata、機密洩漏或測試／審查失敗；完整範圍見 `09-STANDING-AUTHORIZATIONS.md`。

## 0.45.2 候選發布

- 版本：`0.45.2`；候選 tag：`v0.45.2`。
- Windows workflow：`Build Windows 0.45.2`，輸出 `offline-subtitle-factory-0.45.2-windows-x64`。
- macOS 與 Windows 均內建 `resources/docs/0.45.2/USER-GUIDE.html` 及圖文／動畫資產。
- 本次授權接受 Windows 未簽章、macOS 未公證及未完成跨平台乾淨實機測試；仍須在 Release notes 與最終狀態持續揭露。

## 回復策略

- 程式缺陷：停止新增下載導流，保留 Release 證據，發布修正版而非靜默覆蓋不可追溯內容。
- 資產命名／說明錯誤：先上傳正確資產並驗證，再刪除明確的錯誤重複項。
- checksum 不一致：視為阻擋；不得要求使用者忽略。
