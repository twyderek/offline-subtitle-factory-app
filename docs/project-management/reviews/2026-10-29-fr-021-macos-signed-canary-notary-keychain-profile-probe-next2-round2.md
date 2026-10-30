# 獨立審查報告：FR-021 macOS signed-canary notarytool keychain-profile probe next2 round2

- 審查對象 commit／版本：`HEAD ce72b64f8aa2b937e1b589e1b9577835dd691ca8` 加目前 dirty worktree；只審查本輪指定的 workflow、gate test、03／05／06／07 與最新 08 條目相關變更，其他 dirty tracked／untracked changes 排除。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS signed-canary notarytool keychain-profile runtime resolution preflight（`FR-021-MACOS-CI-20261029-NOTARY-KEYCHAIN-PROFILE-PROBE-NEXT2`）。
- 審查輪次：round2。
- 審查代理啟動時間、上下文來源：2026-10-29T15:50+08:00 起；新的獨立唯讀上下文，重新讀取 `AGENTS.md`、`npm run project:preflight -- --type=full` 所列固定核心／full route 與獨立審查格式，並重新檢查目前指定 source／test；未沿用 round1 的未修正前結論。
- 審查限制：只新增本報告；未修改 source、tests、08、evidence 或既有報告，未 stage／commit／push，未執行實際 `notarytool` probe、workflow、builder、codesign、signing、notarization、`store-credentials`、keychain、stapler、hdiutil、Gatekeeper、release 或 GitHub write。
- 驗證環境：Node.js `v22.22.3`、Darwin／arm64；目前工作樹保留大量與本輪無關的 dirty changes。

## 1. 需求完整性

- 判定：通過。
- 證據：最新 08 條目 `docs/project-management/08-CHANGE-LOG.md:3-14` 仍要求固定 `osf-signed-canary`、output directory／builder 前執行 `xcrun notarytool history --keychain-profile "$APPLE_KEYCHAIN_PROFILE" --output-format json --no-progress`、stdout／stderr 丟棄、非 0 fail-closed，並明確排除本機 runtime probe。
- `.github/workflows/macos-signed-canary.yml:89-100` 具備固定 profile probe；`:102-117` 將 output directory 與 builder 放在 probe 之後。`scripts/test-macos-signed-canary-gate.mjs:167-213` 對固定 profile injection、exact history command、history／submit distinction、兩個 submit profile flags、ordering 與舊 flags absence 建立 regression assertions。
- 文件一致性仍成立：`docs/project-management/03-FUNCTIONAL-DESIGN.md:3-7`、`docs/project-management/05-DEVELOPMENT-AND-DEPLOYMENT.md:72-78`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-7` 與 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-7` 均描述相同的固定 profile、builder 前排序、輸出丟棄、fail-closed 與未執行 runtime 範圍。
- round1 F-01 的修正範圍符合需求：test regex 在 `scripts/test-macos-signed-canary-gate.mjs:176` 加入拒絕 appended `||` 的 negative lookahead，`:180-181` 明確拒絕 `|| true`，`:190-192` 對 `2>/dev/null || true` mutation 要求 assertion 失敗。

## 2. 邏輯正確性

- 判定：通過（限目前 source contract）。
- 證據：workflow `:89-100` 以 step-level `env` 固定 `APPLE_KEYCHAIN_PROFILE: osf-signed-canary`，使用 `set -euo pipefail` 執行 exact `history` command，並以 `>/dev/null 2>/dev/null` 丟棄 stdout／stderr。非 0 probe exit 會使該 step fail，沒有後續成功命令吞掉狀態。
- `:102-117` 證明 `mkdir "$output_dir"` 與 `npm run electron:build:mac:signed-canary` 均在 probe 後；probe 失敗時目前 source 不會建立 output directory 或進入 builder。`:178-189` 的 DMG／ZIP submit 仍各自使用 `--keychain-profile "$APPLE_KEYCHAIN_PROFILE"`，沒有 password／Apple ID／Team ID flags。
- F-01 獨立 in-memory mutation probe 於 2026-10-29T15:51:21+08:00 將 `2>/dev/null` 改為 `2>/dev/null || true`，輸出 `contractRejectsMutation=true`、`explicitGuardRejectsMutation=true`、`currentProbeNoFailOpenOperator=true`；因此 round1 的 false-pass 已關閉。
- 目前 source／test 沒有把 profile label、Apple response、credential material 或 raw probe diagnostics 寫入 repository、artifact 或 log；實際 profile provisioning／resolution 仍不是本機 source contract 可證明的事項。

## 3. 邊界情況

- 判定：通過（deterministic／static scope）。
- 證據：`scripts/test-macos-signed-canary-gate.mjs:167-193` 覆蓋四個固定 profile injections、exact redirections、history／submit mutation、移除 profile flag、舊 credential flags、`set -euo pipefail`、`|| true` absence 與附加 `|| true` mutation；`:207-213` 覆蓋 probe 相對 output directory／builder 的排序與 dual submit binding。
- 2026-10-29T15:51:21+08:00 的獨立 mutation probe 確認正常 probe 通過、附加 `|| true` 的變體會被 regex 與 explicit assertion 同時拒絕；這直接關閉 round1 F-01，而非只依賴 focused test 的成功輸出。
- 完整 `npm run check` 亦通過 signed-canary readiness／gate／result／distribution／external-boundary deterministic suites；這些 fixtures 覆蓋 source／schema／privacy／fail-closed matrix，但不會啟動受控 runner 的真實 notarytool。
- 未執行 absent／invalid keychain profile、notarytool non-zero exit、GitHub Actions failure-path、runner filesystem 或 Apple service replay；這些仍是明確保留的 runtime residual，不是 round1 F-01。

## 4. 程式碼品質

- 判定：通過。
- 證據：F-01 修正保持局部，僅強化 `scripts/test-macos-signed-canary-gate.mjs:176-192` 的 regex／operator guards 與 mutation assertion，沒有改變 workflow 行為、credential route、keychain、Environment 或 release scope。
- negative lookahead、explicit `|| true` assertion 與 targeted mutation assertion 互相補強；`git diff --check` 通過，沒有 whitespace error。workflow 的固定 profile step 仍保持清楚的 shell boundary，沒有將秘密值放入 argv。
- `docs/project-management/03-FUNCTIONAL-DESIGN.md:3-7`、`05:74`、`06:5-7`、`07:5-7` 對目前 source behavior 與未執行 runtime 的描述沒有因 F-01 修正而失配。
- 本 round2 審查代理只新增本報告，未修改 round1 報告或其他專案檔案。

## 5. 測試覆蓋

- 判定：通過（source／local validation）；治理 final gate 另列為 closeout condition。
- 證據：`npm run project:preflight -- --type=full` exit 0；`node --check scripts/test-macos-signed-canary-gate.mjs`、`node scripts/test-macos-signed-canary-gate.mjs`、Ruby YAML parse、指定範圍 `git diff --check` 於 2026-10-29T15:50:53+08:00 均 exit 0。focused output 為 `macOS signed canary gate contract passed: identity, toolchain, source config and notarization fail-closed matrix`，YAML output 為 `YAML OK`。
- 完整 `npm run check` 於 2026-10-29T15:50:55+08:00 啟動並 exit 0；輸出包含治理 docs check、全 repository Node syntax、signed-canary readiness／gate／result／distribution／external-boundary tests、核心 regression 與 YouTube suites 通過。
- 獨立 in-memory mutation probe 於 2026-10-29T15:51:21+08:00 驗證 appended `|| true` 被拒絕，round1 F-01 已由目前 test source 與獨立 probe 關閉。
- `npm run docs:check:final` 於 2026-10-29T15:51:24+08:00 exit 1，原因仍只有最新 08 條目缺少「獨立審查是否執行：」／「發布授權：」欄位、狀態仍為「進行中」及該欄位非是／否；此是治理 closeout condition，不是 source／test finding，也不改變 F-01 判定。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：本輪實際完成 full preflight、指定 Node syntax、gate focused test、YAML parse、完整 `npm run check`、`git diff --check` 與 in-memory mutation probe；所有 source／local checks 均通過。`npm run docs:check:final` 的結果與原因如第 5 節所列，僅屬 08 closeout 狀態。
- 未執行／不宣稱：沒有執行 `xcrun notarytool history`，沒有 GitHub Actions workflow run、self-hosted runner profile provisioning／resolution、Apple identity、builder、codesign、signing、notarization、ticket validity、stapler、Gatekeeper、release 或 remote write。
- 因此本輪只確認 source／local contract：固定 profile、exact read-only history command、stdout／stderr 丟棄、fail-closed operator guard、builder-before-output-dir ordering、舊 credential route absence 與 deterministic regression；不宣稱 signed／notarized candidate、profile runtime evidence、release 或 FR-021 overall acceptance。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-CI-20261029-NOTARY-KEYCHAIN-PROFILE-PROBE-NEXT2` round2 獨立複審結論為 bounded source／local contract 有條件通過：round1 F-01 已關閉，`scripts/test-macos-signed-canary-gate.mjs` 現以 negative lookahead、explicit `|| true` guard 與 `2>/dev/null || true` mutation assertion 拒絕 fail-open probe 變體，workflow 仍在 output directory／builder 前以固定 `osf-signed-canary` 執行 read-only `xcrun notarytool history --keychain-profile "$APPLE_KEYCHAIN_PROFILE" --output-format json --no-progress`、丟棄 stdout／stderr，兩個 submit 仍只使用 `--keychain-profile` 且無 password／Apple ID／Team ID argv；focused／full／YAML／syntax／diff checks 通過，但本輪未驗證 self-hosted runner 的實際 keychain profile provisioning／resolution、notarytool、workflow、signing 或 notarization，且主要代理仍須完成 08 closeout 後重跑 `npm run docs:check:final`，因此不宣稱 signed／notarized candidate、release 或 FR-021 overall。**
- 阻擋問題（若有）：無 source／test 技術阻擋；round1 F-01 已關閉。唯一未解除項目是治理 closeout condition：最新 08 條目仍為「進行中」且 `npm run docs:check:final` 尚未通過，主要代理須回填本 round2 報告與必要欄位後重跑 final gate；此不屬 source finding。
- 剩餘風險：受控 self-hosted macOS arm64 runner 是否預置並可解析 `osf-signed-canary`、profile 綁定 credential 是否有效、Apple identity／ticket／stapler／Gatekeeper、GitHub Environment／reviewer／protected ref 與實際 workflow 全部未驗證；本輪也不涵蓋 packaged UI、Windows、LM Studio 或 FR-021 overall。
- 給主要開發代理的具體修正要求：將本報告與完整結論句回填 08，補齊獨立審查／發布授權／完成狀態欄位並重跑 `npm run docs:check:final`；若後續取得受控 runner，再另行執行 runtime validation，維持不保存 Apple credential argv 與不宣稱未執行結果的界線。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
