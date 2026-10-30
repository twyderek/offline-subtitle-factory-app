# 獨立審查報告：FR-021 macOS signed-canary notarytool keychain-profile probe next2 round1

- 審查對象 commit／版本：`HEAD ce72b64f8aa2b937e1b589e1b9577835dd691ca8` 加目前 dirty worktree；只審查本輪指定的 workflow、gate test、03／05／06／07 與最新 08 條目相關變更，其他 dirty tracked／untracked changes 排除。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS signed-canary notarytool keychain-profile runtime resolution preflight（`FR-021-MACOS-CI-20261029-NOTARY-KEYCHAIN-PROFILE-PROBE-NEXT2`）。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-29T15:43+08:00 起；獨立唯讀上下文，重新執行 `npm run project:preflight -- --type=full`，讀取 `AGENTS.md`、固定核心、full route、最新 08 條目與指定目前 source／test；未沿用主要代理的評價性結論。
- 審查限制：只新增本報告；未修改其他檔案，未 stage／commit／push，未執行實際 `notarytool` probe、workflow、builder、codesign、signing、notarization、`store-credentials`、keychain、stapler、hdiutil、Gatekeeper、release 或 GitHub write。
- 驗證環境：Node.js `v22.22.3`、Darwin／arm64；目前工作樹保留大量與本輪無關的 dirty changes。

## 1. 需求完整性

- 判定：通過。
- 證據：最新 08 條目 `docs/project-management/08-CHANGE-LOG.md:3-14` 明確要求固定 `osf-signed-canary`、builder／output directory 前執行 `xcrun notarytool history --keychain-profile "$APPLE_KEYCHAIN_PROFILE" --output-format json --no-progress`、stdout／stderr 丟棄、非 0 fail-closed、無舊 credential flags，並明確排除本機 runtime probe。
- workflow `:89-100` 建立固定 profile probe；` :102-117` 顯示 output directory 與 builder 均在 probe 之後。`scripts/test-macos-signed-canary-gate.mjs:167-207` 對固定 profile injection、probe command、history／submit 區分、兩個 submit profile flags 與舊 flags absence 建立 regression assertions。
- 文件同步一致：`docs/project-management/03-FUNCTIONAL-DESIGN.md:3-7` 定義 probe 的 fail-closed／不保存 response 邊界；`docs/project-management/05-DEVELOPMENT-AND-DEPLOYMENT.md:72-78` 定義 handoff route 與 builder 前 probe；`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-7` 與 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-7` 均描述相同排序、固定 profile、輸出丟棄與未執行 runtime 邊界。
- 需求範圍只支持 bounded source／local contract；不把文件中的預期 runner behavior 當成已完成的 Apple credential 或 workflow runtime 驗收。

## 2. 邏輯正確性

- 判定：通過（限目前 source contract）。
- 證據：`.github/workflows/macos-signed-canary.yml:89-100` 以 step-level `env` 固定 `APPLE_KEYCHAIN_PROFILE: osf-signed-canary`，`set -euo pipefail` 後執行 exact `history` command，並以 `>/dev/null 2>/dev/null` 丟棄 stdout／stderr。probe 是該 step 的失敗結果，沒有後續成功命令可吞掉其 exit status；因此目前 source 對非 0 probe exit 會停止 workflow。
- `:102-117` 顯示 `mkdir "$output_dir"` 與 `npm run electron:build:mac:signed-canary` 均位於 probe 後，probe 失敗時不會建立 run-scoped output directory 或進入 builder。`:178-189` 的 DMG／ZIP submit 仍各自使用 `--keychain-profile "$APPLE_KEYCHAIN_PROFILE"`，沒有 password／Apple ID／Team ID flags。
- focused test `scripts/test-macos-signed-canary-gate.mjs:170-187` 的 exact regex 會拒絕移除 `--keychain-profile` 或將 `history` 改為 `submit`；`:201-208` 另驗證 probe ordering、dual submit binding 與舊 flags absence。獨立 legacy scan 只在 07／08 的歷史說明與 negative assertions 看到舊 flag 字串，目標 workflow 沒有舊 route。
- 這一節只證明 source／static shell semantics；profile 是否真的存在、能否被 `xcrun` 解析、Apple service request 是否成功仍未由本輪執行。

## 3. 邊界情況

- 判定：部分通過。
- 證據：focused gate test `scripts/test-macos-signed-canary-gate.mjs:167-187` 覆蓋固定 profile count、stdout／stderr redirection、history／submit distinction、移除 profile flag 與 credential flag mutation；`:201-208` 覆蓋 probe 相對 output directory／builder 的排序。`npm run check` 的 deterministic suites 亦通過 signed-canary gate／result／distribution／external-boundary contract。
- 目前 source 的 `set -euo pipefail`、固定 profile equality 與 output directory 後置順序可形成 fail-closed boundary；沒有 unsigned／ad-hoc fallback。文件也在 `03:3-7`、`05:74`、`06:5-7`、`07:5-7` 保留相同邊界。
- 但獨立記憶體 mutation probe（2026-10-29T15:49:26+08:00）將 probe redirection 後附加 `|| true`；現有 gate test 所涵蓋的 exact command、固定 profile、history／submit、舊 flags 與 ordering assertions 仍全部匹配，輸出 `currentAssertionsStillMatch=true`。因此測試目前不能偵測會把非 0 probe 變成 fail-open 的 `|| true` mutation；這是 P2 測試覆蓋缺口，不是目前 workflow source 已含 `|| true`。
- 本輪明確未執行 absent／invalid keychain profile、notarytool non-zero exit、runner filesystem 或 GitHub Actions failure-path replay；這些仍是受控 runner 的未覆蓋 runtime 邊界。

## 4. 程式碼品質

- 判定：通過。
- 證據：workflow 新增區段只有 13 行，命名清楚，profile 以 step `env` 注入，未把 credential material、Apple response 或 raw diagnostics 寫入 checkout、artifact 或 log；`docs/project-management/03-FUNCTIONAL-DESIGN.md:3-7` 與 `05-DEVELOPMENT-AND-DEPLOYMENT.md:74-76` 對 privacy／cleanup boundary 的描述與 source 一致。
- `scripts/test-macos-signed-canary-gate.mjs:170-187` 使用 probe step slice 加 normalized multiline assertion，對 command ordering 與 history／submit 角色做了具體檢查；`git diff --check` 也沒有 whitespace error。
- 變更未擴大到其他 runtime、secret、keychain、Environment、branch protection 或 release 操作；本報告以外沒有由本審查代理修改檔案。唯一品質建議是補上 fail-open operator mutation guard，使測試與 06 文件所稱 mutation coverage 對齊。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：`npm run project:preflight -- --type=full` exit 0；`node --check scripts/test-macos-signed-canary-gate.mjs`、`node scripts/test-macos-signed-canary-gate.mjs`、Ruby YAML parse、指定範圍 `git diff --check` 於 2026-10-29T15:48:26+08:00 均 exit 0。focused output 為 `macOS signed canary gate contract passed: identity, toolchain, source config and notarization fail-closed matrix`，YAML output 為 `YAML OK`。
- 完整 `npm run check` 於 2026-10-29T15:48:28+08:00 啟動並 exit 0；輸出包含治理 docs check、Node syntax、signed-canary readiness／gate／result／distribution／external-boundary tests、核心 regression 與 YouTube suites 通過。這是 local deterministic／fixture coverage，不是 Apple runner runtime proof。
- `npm run docs:check:final` 於 2026-10-29T15:48:56+08:00 exit 1，具體原因是最新 08 條目仍為「進行中」、缺少「獨立審查是否執行：」與「發布授權：」欄位，且 validator 要求獨立審查欄位為是或否；本報告不修改 08。
- P2 覆蓋缺口由上述 `|| true` in-memory mutation 重現：現有 focused regression 能固定命令字串，但不能固定 probe failure handling。主要代理應補 `set -euo pipefail`／禁止 `|| true` 等可回溯的 source assertion 或等價安全 fixture，並重跑 focused／full checks。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：本輪實際執行 preflight、指定 Node syntax、gate focused test、YAML parse、完整 `npm run check`、`git diff --check` 與 docs final gate；source／local results 如第 5 節所列，沒有執行會呼叫 Apple toolchain 的 workflow step。
- 未執行／不宣稱：沒有執行 `xcrun notarytool history`，沒有 GitHub Actions run、self-hosted runner profile provisioning／resolution、Apple identity、builder、codesign、signing、notarization、ticket validity、stapler、Gatekeeper、release 或 remote write。因而本輪不宣稱 signed／notarized candidate、profile runtime evidence、release 或 FR-021 overall acceptance。
- 目前可交付的結論僅是 source／local contract：probe 的固定命令、輸出丟棄、builder-before-output-dir ordering、舊 credential route absence 與 deterministic tests 成立；實際 runner 的 `osf-signed-canary` profile 是否可解析仍待外部受控 runner 執行。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-CI-20261029-NOTARY-KEYCHAIN-PROFILE-PROBE-NEXT2` round1 獨立審查結論為 bounded source／local contract 有條件通過：目前 workflow 已在 output directory／builder 前以固定 `osf-signed-canary` 執行 read-only `xcrun notarytool history --keychain-profile "$APPLE_KEYCHAIN_PROFILE" --output-format json --no-progress`，stdout／stderr 丟棄，非 0 會由目前 shell step fail-closed，兩個 submit 仍只使用 `--keychain-profile` 且無 password／Apple ID／Team ID argv，focused／full／YAML／syntax／diff checks 通過；但本輪未驗證 self-hosted runner 的實際 keychain profile provisioning／resolution、notarytool、workflow、signing 或 notarization，focused mutation regression 仍可接受附加 `|| true` 的 fail-open probe 變體，且主要代理仍須完成 08 closeout 後重跑 `npm run docs:check:final`，因此不宣稱 signed／notarized candidate、release 或 FR-021 overall。**
- 阻擋問題（若有）：
  - F-01（P2，測試覆蓋）：`scripts/test-macos-signed-canary-gate.mjs:170-187` 的目前 assertions 對 probe command 仍可在 appended `|| true` mutation 下通過；請補 fail-closed operator guard／fixture，重跑 focused 與完整 checks。
  - F-02（治理 closeout）：`npm run docs:check:final` 目前因 `docs/project-management/08-CHANGE-LOG.md:3-5` 仍為「進行中」且缺少必要審查／發布授權欄位而 exit 1；主要代理須在 08 回填本報告的逐字結論、欄位與剩餘風險後重跑 final gate。本審查代理不修改 08。
- 剩餘風險：受控 self-hosted macOS arm64 runner 是否預置並可解析 `osf-signed-canary`、profile 綁定的 credential 是否有效、Apple identity／ticket／stapler／Gatekeeper、GitHub Environment／reviewer／protected ref 與實際 workflow 全部未驗證；本輪也不涵蓋 packaged UI、Windows、LM Studio 或 FR-021 overall。
- 給主要開發代理的具體修正要求：補足 F-01 的 fail-closed mutation regression；完成 08 的 review／發布授權／狀態 closeout 並重跑 final docs gate；之後若取得受控 runner，另以 workflow runtime 驗證 profile resolution，維持不保存 Apple credential argv 與不宣稱未執行結果的界線。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
