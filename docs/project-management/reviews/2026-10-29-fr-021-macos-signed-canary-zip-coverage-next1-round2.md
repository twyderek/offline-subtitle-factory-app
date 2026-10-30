# 獨立審查報告：FR-021 macOS signed-canary ZIP coverage next1 round2

- 審查對象：目前工作樹本輪指定變更 `lib/macos-signed-canary-artifact-selection.mjs`、`scripts/test-macos-signed-canary-gate.mjs`、`scripts/audit-macos-signed-canary-distribution.mjs`、`scripts/test-macos-signed-canary-distribution.mjs`、`.github/workflows/macos-signed-canary.yml` 與 `docs/project-management/08-CHANGE-LOG.md` 最新條目；對照 round1 原件 `docs/project-management/reviews/2026-10-29-fr-021-macos-signed-canary-zip-coverage-next1-round1.md`。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS signed-canary ZIP target coverage hardening（`FR-021-MACOS-CI-20261029-ZIP-COVERAGE-NEXT1`）。
- 審查輪次：round2。
- 審查代理啟動時間、上下文來源：2026-10-29（Asia/Taipei）；獨立唯讀複審上下文，重新執行 `npm run project:preflight -- --type=full`，讀取指定核心／路由文件、目前 08 條目、round1 report 與目前 source／test；未沿用主要開發代理的評價性結論。
- 審查限制：只新增本報告；未修改 source、test、evidence、candidate、08 或既有 review，未 stage／commit／push，未觸發 workflow、builder、codesign、notarytool、stapler、spctl、signing、notarization、release 或外部 GitHub resource。
- 驗證環境：Node.js `v22.22.3`、Apple Silicon macOS（`darwin`／`arm64`）；目前工作樹保留既有 unrelated dirty changes。

## 1. 需求完整性

- 判定：通過。
- 證據：`package.json:172-185`、workflow `:166-232`、audit `:102-121、216-271` 與 Darwin arm64 integration test `scripts/test-macos-signed-canary-distribution.mjs:143-201` 共同覆蓋 target、dual submitted inputs、raw notary projection、schema cross-field 與 bounded 0600 evidence；focused／full local checks 均 exit 0。
- round1 F-01 已關閉：`.github/workflows/macos-signed-canary.yml:197-204` 現使用 `/usr/bin/unzip -tqq "$OSF_SIGNED_CANARY_ZIP"`，不再包含 `ditto -t -k`；`scripts/test-macos-signed-canary-gate.mjs:154-156` 同時要求 supported command 且 `assert.doesNotMatch(workflow, /ditto -t -k/)`。
- round1 F-02 已關閉：`scripts/audit-macos-signed-canary-distribution.mjs:102-121` 先以 raw `Buffer` 計算 hash／bytes，再以 `TextDecoder('utf-8', { fatal: true })` 解碼；malformed JSON 與 invalid UTF-8 均保留 raw digest／size 並回傳 invalid。`isSha256(archiveSha256)` 與 exact equality 仍綁定 notary output 到 submitted DMG／ZIP digest。
- round1 F-03 已關閉：workflow audit invocation `:224-232` 的八個 positional arguments 為 `DMG, app, final ZIP, submitted DMG, submitted ZIP, evidence, notary DMG output, notary ZIP output`；gate test `:184-194` 固定完整 order，並以 mutation removal probes 固定 submitted mode 與 cleanup command。
- `package.json:172-185` 的 `dmg`／`zip` target、selector 唯一 cardinality、dual notary、stapled app／DMG、final ZIP repack、evidence schema 與 Darwin arm64 audit-main integration probe 均與 `08-CHANGE-LOG.md:3-14` 的成功條件一致。未宣稱外部 workflow、Apple signing／notarization 或 FR-021 overall。

## 2. 邏輯正確性

- 判定：通過。
- 證據：`2026-10-29T07:34:32Z` 實際 shell fixture 回報 `dittoCreateStatus:0`／`unzipIntegrityStatus:0`；`scripts/test-macos-signed-canary-distribution.mjs:254-291` 實測 raw malformed／invalid UTF-8 preservation；gate test `:184-205` 驗證 exact positional、0600 與 cleanup mutations；cleanup probe `2026-10-29T07:34:09Z` 於 directory boundary 以 `exitStatus:1` fail-closed。
- ZIP integrity：實際在目前 macOS arm64 以最小 Unicode `.app` 執行 `ditto -c -k --sequesterRsrc --keepParent` 後執行 `/usr/bin/unzip -tqq`；於 `2026-10-29T07:34:32Z` 結果為 `dittoCreateStatus:0`、`unzipIntegrityStatus:0`、stderr empty。這直接支持 workflow replacement，而非只依 YAML regex。
- Raw notary provenance：`readNotaryOutput():102-115` 對 malformed ASCII JSON 保留 raw `diagnosticSha256`／`diagnosticBytes`；`:104-109` 對 invalid UTF-8 以 fatal decoder fail-closed，同樣保留 raw digest／bytes。`scripts/test-macos-signed-canary-distribution.mjs:254-291` 分別實測 DMG malformed、ZIP malformed 與 ZIP invalid UTF-8 的 hash／bytes equality。
- Positional／mode binding：workflow `:166-189` 對 submitted DMG／ZIP 執行 `cp` 後 `chmod 600`，對兩組 notary JSON／stderr 亦執行 0600；audit `:293-300` 只接受 exact run-scoped regular file、0600 submitted paths，`readNotaryOutput():87-100` 只接受 exact run-scoped regular file、0600 output paths。
- Cleanup：notary failure trap `:139-151`、distribution EXIT trap `:211-222` 與 final `if: always()` cleanup `:259-277` 均逐項處理 evidence、dual JSON／stderr、submitted DMG／ZIP 與 output directory，清理失敗會累積非零狀態。隔離 shell probe 於 `2026-10-29T07:34:09Z` 以 directory boundary 取代 cleanup leaf，結果 `exitStatus:1`，確認 cleanup failure 不會被吞掉。
- Schema／cross-field：`validateEvidence():216-271` 維持 exact top-level／candidate／diagnostic／ZIP archive／summary／scope schema；candidateReady、notary leaves、embedded executable digest、summary reasons 與 overall status 均由 cross-field recomputation 綁定。round1 的 null archive digest probe 現由 strict 64-hex gate 拒絕。

## 3. 邊界情況

- 判定：通過。
- 證據：`scripts/test-macos-signed-canary-gate.mjs:212-239` 覆蓋 selector missing／duplicate boundaries；`scripts/test-macos-signed-canary-distribution.mjs:121-141、220-291` 覆蓋 ZIP integrity／member、submitted mode／symlink，以及 ZIP／DMG 對稱 notary negative matrix；Darwin arm64 integration probe `:143-201` 實際經過 audit `main()`。
- selector 邊界：`scripts/test-macos-signed-canary-gate.mjs:212-239` 實際建立 nested Helper.app，覆蓋 missing／duplicate main app、DMG、ZIP；selector 只接受 `mac-arm64` 直接子項主 app 與 output root 唯一 DMG／ZIP。
- ZIP archive 邊界：`scripts/test-macos-signed-canary-distribution.mjs:121-141` 實際建立 Unicode app／ZIP，覆蓋 valid integrity、embedded digest mismatch 與 missing member；`inspectZipArchive():161-213` 以 listing、`unzip -tqq` 與 embedded executable extraction 綁定 final ZIP。
- 對稱 notary negative matrix：目前 ZIP branch 實際覆蓋 valid、wrong-run basename、0600 mode mismatch、malformed JSON、symlink、invalid UTF-8（`scripts/test-macos-signed-canary-distribution.mjs:244-291`）；DMG branch 覆蓋 digest mismatch、null digest、forged／outside-temp／wrong-run、lowercase status、malformed JSON 與 symlink。共用 `readNotaryOutput()` 的 archive-label path contract 與 strict digest contract 因此同時受兩個 label 驗證。
- submitted archive 邊界：`isBoundSubmittedDmg()`／`isBoundSubmittedZip()` 與 tests `:220-239` 覆蓋 regular-file、0600、symlink rejection；Darwin arm64 子程序 integration probe `:143-201` 實際經過 audit `main()`，確認 submitted DMG／ZIP digest、dual notary valid leaves、ZIP archive valid leaf 與 0600 bounded fail evidence 同時成立。
- 明確界線：這些 deterministic／fake fixtures 不驗證 final ZIP 內 Apple ticket 的獨立 stapler validity，也不驗證 Apple notary ticket authenticity；僅驗證本輪 source contract。

## 4. 程式碼品質

- 判定：通過。
- 證據：selector 維持小型純模組；distribution audit 將 raw notary parsing、run-scoped input binding、ZIP inspection、schema／summary 與 exclusive `wx`／0600 writer（`scripts/audit-macos-signed-canary-distribution.mjs:371-374`）分離。raw command output、absolute paths、identity、secrets 不落盤，scope projection 維持全 false。
- 證據：workflow 以固定 run ID／runner temp path 命名所有 intermediate；原始 DMG／ZIP 與 final ZIP 分開以 digest 欄位呈現，notary output 不以 caller-supplied marker 取代 parseable `Accepted` projection；repack 與 distribution audit 順序清楚。
- 證據：gate test 的 supported command assertion、`ditto -t` negative assertion、完整 positional regex、0600 regex、逐項 cleanup regex 與 mutation removal assertions（`scripts/test-macos-signed-canary-gate.mjs:144-211`）使 round1 的 static false-pass 缺口關閉。
- `git diff --check` exit 0；本報告沒有修改其他指定檔案或既有審查原件。

## 5. 測試覆蓋

- 判定：通過。
- 證據：`npm run project:preflight -- --type=full`、focused tests、syntax／YAML／diff checks 於 `2026-10-29T07:33:35Z` 均 exit 0；完整 `npm run check` exit 0，`node scripts/test-project-docs-validator.mjs` 通過。`npm run docs:check:final` 於 `2026-10-29T07:34:15Z` 的 exit 1 僅因 08 closeout fields／state 尚待完成，且本輪未修改 08。
- 指令與結果：`npm run project:preflight -- --type=full` exit 0；`node scripts/test-macos-signed-canary-gate.mjs`、`node scripts/test-macos-signed-canary-distribution.mjs`、四個指定 source／test `node --check`、Ruby YAML parse 與 `git diff --check` 於 `2026-10-29T07:33:35Z` 均 exit 0。
- 指令與結果：完整 `npm run check` exit 0；包含全專案 syntax、`npm test`、project docs validator、macOS gate／distribution contract tests 與 posttest YouTube regression。輸出包含 `macOS signed canary distribution evidence contract passed: app/DMG/ZIP digests, dual notary projection, stapler/archive fail-closed schema and privacy matrix`。
- focused coverage：raw malformed／invalid UTF-8 digest，DMG／ZIP run／mode／symlink boundaries，submitted DMG／ZIP 0600，audit positional mutation，`ditto -t` mutation，dual cleanup mutation 與 Darwin arm64 audit-main integration 均有直接 source/test evidence。
- 治理：`node scripts/test-project-docs-validator.mjs` 隨完整 check 通過；但 `npm run docs:check:final` 於 `2026-10-29T07:34:15Z` 仍因最新 08 條目尚未補「獨立審查是否執行：」「發布授權：」且狀態仍為「進行中」而 exit 1。這是主要代理尚待完成的 closeout，不是本輪 source／test finding；本報告未修改 08。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：本機實際為 `darwin`／`arm64`；distribution test 子程序確實啟動 audit `main()`、寫入並讀回 0600 schema-valid `status: fail` evidence，dual notary／submitted DMG／submitted ZIP／ZIP archive leaves 的 bounded projection 均可觀察；fake stapler／hdiutil 失敗保持 fail-closed。
- 證據：獨立 macOS shell fixture 實際執行 `/usr/bin/unzip -tqq` 成功；獨立 cleanup directory-boundary probe 實際以非零退出；這兩項不是只讀 source string。
- 未執行／不宣稱：沒有 GitHub Actions workflow run、Apple Developer ID identity／credential、codesign、real `notarytool`、real `stapler`／`hdiutil`、Gatekeeper、signed／notarized candidate、release、外部 Environment／secret／branch protection 或 FR-021 overall evidence。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-CI-20261029-ZIP-COVERAGE-NEXT1` round2 獨立複審結論為 bounded source／local contract 有條件通過且 round1 F-01／F-02／F-03 均已關閉：workflow 已改用並實測可執行的 `/usr/bin/unzip -tqq`，不再含 `ditto -t`；`readNotaryOutput()` 以 raw Buffer 保留 malformed／invalid UTF-8 output 的 digest／bytes 並對 Accepted digest strict fail-closed；DMG／ZIP positional order、submitted 0600、dual notary binding、ZIP negative matrix、cleanup 與 mutation guards 均由目前 source／focused／full checks 支持；但本輪仍不代表 GitHub workflow run、Developer ID signing、Apple notarization／ticket validity、release 或 FR-021 overall，且主要代理必須把本報告與本句回填 08 後重跑 `npm run docs:check:final`。**
- Findings：本輪無新增技術 finding；round1 F-01／F-02／F-03 已關閉。
- 阻擋問題（若有）：目前無 source／test blocker；治理 closeout 尚待主要代理將 round2 report 與逐字結論同步至 08，並通過 final docs gate。
- 剩餘風險：未執行真實 self-hosted workflow、Apple identity／credential、codesign、notarytool、stapler、hdiutil、Gatekeeper 或 release；GitHub Environment reviewer／secret scope／protected branch、notary password argv、Apple ticket authenticity、renderer／全機 egress、Windows 與 FR-021 overall 仍不由本輪關閉。
- 給主要開發代理的具體修正要求：不需新增 source 修正；請只完成 08 的 round2 review linkage、逐字引用、獨立審查／發布授權／狀態 closeout，重跑 `npm run docs:check:final`，並維持本報告與 round1 原件不可覆寫。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
