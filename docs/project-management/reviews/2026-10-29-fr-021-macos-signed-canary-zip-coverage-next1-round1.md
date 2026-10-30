# 獨立審查報告：FR-021 macOS signed-canary ZIP coverage next1 round1

- 審查對象：目前工作樹本輪指定變更 `lib/macos-signed-canary-artifact-selection.mjs`、`scripts/test-macos-signed-canary-gate.mjs`、`scripts/audit-macos-signed-canary-distribution.mjs`、`scripts/test-macos-signed-canary-distribution.mjs`、`.github/workflows/macos-signed-canary.yml` 與 `docs/project-management/08-CHANGE-LOG.md` 最新條目；其他 dirty tracked／untracked changes 不屬於本輪交付。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS signed-canary ZIP target coverage hardening（`FR-021-MACOS-CI-20261029-ZIP-COVERAGE-NEXT1`）。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-29（Asia/Taipei）；獨立唯讀審查上下文，讀取 `AGENTS.md`、`npm run project:preflight -- --type=full` 指定核心／路由文件、目前 08 條目與本輪指定 source／test；未沿用主要開發代理的評價性結論。
- 審查限制：只建立／更新本報告；未修改 source、test、evidence、candidate、08 或其他 review，未 stage／commit／push，未觸發 workflow、builder、codesign、notarytool、stapler、spctl、signing、notarization、release 或外部 GitHub resource。
- 驗證環境：Node.js `v22.22.3`、Apple Silicon macOS（`darwin`／`arm64`）；目前工作樹保留既有 unrelated dirty changes。

## 1. 需求完整性

- 判定：部分通過。
- 證據：`package.json:172-185` 宣告 macOS arm64 `dmg` 與 `zip` targets；`electron-builder.signed-canary.mjs:6-8` 將 signed-canary build config 套用至該 manifest。`lib/macos-signed-canary-artifact-selection.mjs:12-40` 唯一選出 `mac-arm64` 直接子項主 `.app`、output root 的單一 DMG 與單一 ZIP，並對三者各自做 cardinality fail-closed。
- 證據：`.github/workflows/macos-signed-canary.yml:110-123` 將三個 selected artifact 路徑寫入環境；`:125-195` 以 submitted DMG／submitted ZIP 保留原始 notary inputs，分別提交 DMG／ZIP，取得 dual JSON，staple app／DMG，刪除並以 stapled app 重建 final ZIP；`:206-239` 以 positional order `DMG, app, final ZIP, submitted DMG, submitted ZIP, evidence, notary DMG, notary ZIP` 呼叫 audit；`:259-277` 清除 run-scoped result、dual notary outputs、submitted DMG／ZIP 與 output directory。
- 證據：`scripts/audit-macos-signed-canary-distribution.mjs:204-260` 的 schema 具備 dual notary leaves、app／DMG command leaves、final ZIP archive leaf、candidate 的 final／submitted DMG／ZIP digest 與 embedded app executable digest，並以 summary cross-field recomputation 維持整體 fail-closed。`readNotaryOutput():104-109` 現已要求 archive digest 為 strict 64-hex 且與 notary JSON 相等；目前先前的 null-digest 虛假 valid 問題已關閉。
- 證據：`scripts/test-macos-signed-canary-distribution.mjs:143-201` 在目前 Darwin arm64 實際以子程序啟動 audit `main()`；fixture 建立 Unicode `.app`、DMG placeholder、submitted DMG／ZIP 與 dual 0600 notary JSON。audit 寫出 schema-valid、0600、`status: fail` bounded evidence；dual notary leaves、submitted DMG digest 與 `zipArchive` 為 valid，預期 fake stapler／hdiutil leaves 失敗。
- 未完整滿足：F-01（P1）使 workflow 的 final ZIP integrity step 在真實 macOS 上必然失敗；F-02／F-03（P2）分別是 notary raw provenance 與 workflow static/mutation guard 覆蓋缺口。因此目前不能接受本條目宣告的完整 ZIP workflow coverage。

## 2. 邏輯正確性

- 判定：不通過。
- F-01（P1，workflow final ZIP integrity command 無效）：`.github/workflows/macos-signed-canary.yml:197-204` 使用 `ditto -t -k "$OSF_SIGNED_CANARY_ZIP"`。本機同一 Apple Silicon macOS 以最小 `.app` 執行與 workflow 相同的 `ditto -c -k --sequesterRsrc --keepParent` 建檔後，於 `2026-10-29T07:27:29Z` 實測 `createStatus:0`、`verifyStatus:1`，stderr 為 `ditto: invalid option -- t`；相同 fixture 使用 `/usr/bin/unzip -tqq` 的完整性檢查為 exit `0`。因此真正 workflow 會在 repack 後、distribution audit 前停止；`scripts/test-macos-signed-canary-gate.mjs:154-170` 目前以 regex 把這個無效 `ditto -t` 固定成通過，形成 static guard false-pass。
- F-02（P2，malformed／non-UTF-8 notary output 的 raw provenance 遺失）：`scripts/audit-macos-signed-canary-distribution.mjs:101-112` 先以 `fs.readFileSync(..., 'utf8')` 解碼，再計算 `diagnosticSha256`／`diagnosticBytes`；若 JSON parse 或 decode 失敗，catch 直接回傳 `sha256('')` 與 `diagnosticBytes:0`。因此 invalid DMG／ZIP notary output 不是以該檔案的 bounded raw bytes digest／size 被投影，無法完整滿足本輪要求的 output hash provenance。正常 ASCII／UTF-8 Accepted JSON 的 digest、exact run-scoped path 與 0600 mode binding 目前成立。
- F-03（P2，workflow positional／0600／cleanup mutation guards 不完整）：目前 production workflow 的 positional invocation、`cp`／`chmod 600`、dual raw-output cleanup 與 final cleanup source 均存在（`.github/workflows/macos-signed-canary.yml:133-189、211-239、259-277`），但 `scripts/test-macos-signed-canary-gate.mjs:144-183` 只以零散 regex 驗證變數名稱、`cp`、repack 與 cleanup path。它沒有固定完整 multiline audit positional order，沒有直接固定 submitted DMG／submitted ZIP 的 `chmod 600`，也沒有固定新添 raw artifact cleanup 的 `if ! rm ...; then cleanup_status=1; fi`。移除上述任一命令仍可能讓目前 static test 通過；這是 mutation／regression guard 缺口，不是本次讀取到的 production source 已缺少該命令。
- 已確認的正確部分：`readNotaryOutput():86-113` 對 DMG／ZIP 共用 exact run ID、`RUNNER_TEMP`、basename、regular-file、0600、canonical `Accepted` 與 submitted archive digest binding；`isBoundSubmittedDmg()`／`isBoundSubmittedZip():124-147` 對 submitted inputs 綁定 run-scoped basename、regular-file 與 0600。`inspectZipArchive():149-201` 實際用 `unzip -tqq`、listing、member extraction 與 SHA-256 將 final ZIP embedded executable 綁到 stapled app executable digest；`validateEvidence():225-256` 會拒絕 ZIP integrity／embedded digest／summary mismatch。

## 3. 邊界情況

- 判定：部分通過。
- 證據：`scripts/test-macos-signed-canary-gate.mjs:184-211` 實際建立 nested Helper.app，並覆蓋 missing／duplicate main app、missing／duplicate DMG、missing／duplicate ZIP；selector 只讀 `mac-arm64` 直接子項，因此 nested Helper.app 不會被計入。
- 證據：`scripts/test-macos-signed-canary-distribution.mjs:121-141` 建立 Unicode app 與 ZIP，實測 valid archive、錯誤 embedded digest、missing member；`:204-273` 覆蓋 writer 0600／EEXIST、submitted DMG／ZIP mode／symlink，以及 DMG notary mismatch／wrong-run／外部 path／malformed／lowercase status／symlink。Darwin arm64 子程序 probe 另實測 dual notary 0600、submitted DMG／ZIP、audit bounded fail evidence 與 schema validation。
- 邊界缺口：ZIP-specific notary negative matrix 沒有像 DMG 一樣直接覆蓋 ZIP wrong-run、outside-temp、mode mismatch、malformed JSON 與 symlink；目前主要依賴共用 helper 與一個 valid ZIP output assertion。F-02 的 malformed raw digest 與 F-03 的 positional／mode／cleanup mutation 也尚無 regression assertion。
- 邊界界線：final ZIP 的 source contract 目前以 final archive integrity 加 embedded app executable digest binding 為驗收；這不等同 final ZIP 內 Apple ticket 的獨立 stapler validation，也不等同 Apple notary ticket validity。此限制與 `08-CHANGE-LOG.md:10-11` 的未宣稱界線一致。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：artifact selector 維持小型純模組；distribution audit 將 notary、ZIP inspection、schema、summary 與 writer 分離，使用 exclusive `wx`／0600 evidence writer（`scripts/audit-macos-signed-canary-distribution.mjs:371-374`），不把 raw notary JSON、absolute paths、identity 或 secrets 寫入 evidence；scope 全部為 false（`:347-363`）。
- 證據：workflow 的 notary failure trap、distribution EXIT cleanup 與最後 `if: always()` cleanup 都逐一處理 DMG／ZIP JSON、stderr、submitted DMG／ZIP 與 checkout evidence；repack 使用 `rm -f` 後 `ditto -c -k --sequesterRsrc --keepParent`，順序符合「原始 DMG／ZIP 送 notary、staple app／DMG、final ZIP repack」。目前 production cleanup source 沒有讀到遺漏 submitted DMG 的項目。
- 品質問題：F-01 顯示 workflow static guard 只驗證字串存在，沒有驗證命令在目標 macOS 上可執行；F-02 使 invalid notary path 的 bounded provenance 與 valid path 不對稱；F-03 使重要 positional／mode／cleanup invariant 依賴未完成的字串 guard。
- `git diff --check` exit 0；本報告沒有修改其他指定檔案或既有審查原件。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：`npm run project:preflight -- --type=full` exit 0；`node scripts/test-macos-signed-canary-gate.mjs` 與 `node scripts/test-macos-signed-canary-distribution.mjs` 於 `2026-10-29T07:29:11Z` exit 0；後者在目前 Darwin arm64 觸發本輪新增子程序 integration probe。五個指定 source／test 的 `node --check`、Ruby YAML parse 與 `git diff --check` 於本輪均 exit 0。
- 證據：`npm run check` 於本輪 exit 0，包含 `npm test`、project docs validator 與 distribution／gate tests；輸出包含 `macOS signed canary distribution evidence contract passed: app/DMG/ZIP digests, dual notary projection, stapler/archive fail-closed schema and privacy matrix`。這些是 local source contract／fake fixture checks，不是 workflow runtime evidence。
- 證據：獨立 shell probe 實際重現 `ditto -t` exit 1；獨立 probe 確認 current `readNotaryOutput(..., null, 'dmg')` 已回傳 false（本輪 test line 246 也固定該邊界）。目前未有 raw malformed-output digest regression，也未有完整 workflow invocation／cleanup mutation regression。
- 治理：`08-CHANGE-LOG.md:3-14` 的最新條目使用 canonical `##`、正確需求 ID、範圍、成功條件、計畫與驗證計畫，並仍標示「進行中」。`npm run docs:check:final` 仍須待主要代理回填 round1 結果、獨立審查／發布授權欄位並結案後再執行；本輪不修改 08。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：本機確實是 `darwin`／`arm64`；新增 distribution test 的子程序確實啟動 audit `main()`、產生並讀回 0600 evidence，證明 dual notary projection、submitted DMG／ZIP digest、ZIP integrity／embedded digest 與 bounded fail schema 在 fake fixture 上能運作。fake stapler／hdiutil 失敗被正確投影為 fail，而不是偽造 pass。
- 重要反證：同一目標 macOS 實測 workflow 使用的 `ditto -t -k` 無效，所以本輪不能把「focused static／integration test passed」解釋為 final ZIP integrity step 可在 workflow 執行。
- 未執行／不宣稱：沒有 GitHub Actions workflow run、Apple Developer ID identity／credential、codesign、notarytool、stapler、hdiutil、Gatekeeper、signed／notarized candidate、release、外部 Environment／secret／branch protection 或 FR-021 overall evidence；本報告只評估 source contract 與 local fake fixtures。

## 綜合判定

- 結論：不通過。
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-CI-20261029-ZIP-COVERAGE-NEXT1` round1 不通過：selector、workflow positional DMG／ZIP handoff、submitted DMG／ZIP 0600 path-mode guard、dual notary digest binding、stapled app／DMG sequencing、final ZIP archive／embedded executable digest schema，以及 Darwin arm64 audit-main integration probe 已部分成立；但 workflow 在 `.github/workflows/macos-signed-canary.yml:204` 使用目標 macOS 不支援的 `ditto -t`，獨立實測為 exit 1，形成 P1 blocker；另有 malformed／non-UTF-8 notary output raw hash／bytes 遺失（F-02）與 positional／0600／cleanup mutation guard 不完整（F-03）兩項 P2，故不得宣稱 ZIP workflow coverage、workflow run、Apple signing、notarization、release 或 FR-021 overall 完成。**
- Findings：F-01（P1，`ditto -t` 使 workflow final ZIP integrity step 必然失敗且 static guard false-pass）；F-02（P2，malformed／non-UTF-8 notary output 未保留 bounded raw hash／bytes provenance）；F-03（P2，workflow positional／submitted mode／raw cleanup 的 static mutation guards 不完整）。先前的 null archive digest finding 已由 current `isSha256(archiveSha256)` 與 test matrix 關閉。
- 阻擋問題（若有）：F-01；F-02／F-03 應在 round2 前修正，才可將 dual output provenance／workflow guards 宣稱為完整。
- 給主要開發代理的具體修正要求：
  1. 將 workflow final ZIP integrity check 改為目標 macOS 實際支援的 bounded check（例如 `/usr/bin/unzip -tqq`，或明確的 `ditto -x -k` isolated extraction），同步修改 `scripts/test-macos-signed-canary-gate.mjs` static／mutation guard，並以實際 shell fixture regression 防止再次固定無效選項。
  2. 先讀取 notary output raw `Buffer` 計算 digest／bytes，再以 UTF-8 projection 做 JSON parse；malformed／decode failure 仍回傳該 bounded raw digest／bytes，而不是空摘要；補 DMG／ZIP 對稱的 malformed／wrong-run／mode／symlink matrix。
  3. 以完整 multiline source assertion 或可執行 shell fixture 固定 audit 八個 positional args 的順序，固定 submitted DMG／ZIP 與 notary output 的 `chmod 600`，並固定 dual raw artifact cleanup 的 `rm`／cleanup-status fail-closed contract；mutation 移除任一行時必須失敗。
  4. 修正後建立 round2，不覆寫本報告；由主要代理回填 08 的 round1 連結、逐字結論、獨立審查／發布授權欄位與結案狀態，再執行 `npm run docs:check:final`。
- 剩餘風險：即使上述 findings 修正，local fake fixtures 仍不證明 Apple ticket validity、真實 stapled ZIP／DMG、Developer ID signing、notarization、Gatekeeper、GitHub Environment reviewer／secret scope、protected branch、實際 workflow、release、renderer、全機 egress、Windows 或 FR-021 overall；notary password argv 與外部 signing identity 仍依 08 明示為後續 residual。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
