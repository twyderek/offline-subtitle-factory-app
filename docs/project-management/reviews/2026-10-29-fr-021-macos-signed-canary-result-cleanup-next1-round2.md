# 獨立審查報告：FR-021 signed-canary result evidence cleanup hardening

- 審查對象：index 相對於 `HEAD 8dd82fbe71e754616d1c87971670e1e5ad5bf7bc` 的 staged diff；staged workflow blob `d659beb29946bd83e3a976b93d4a00295b83b50c`、staged focused-test blob `80809b0cee90d220143aaf0a7531836ab8e8821b`。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS signed-canary result evidence cleanup hardening（`FR-021-MACOS-CI-20261029-RESULT-CLEANUP-NEXT1`）。
- 審查輪次：round2。
- 審查代理啟動時間、上下文來源：2026-10-29T15:08:16+0800；獨立唯讀審查上下文，先讀 `AGENTS.md`、`npm run project:preflight -- --type=full` 列出的固定核心／路由文件、最新 08 條目及 round1 report；未沿用主要開發代理的評價性結論。
- 審查範圍：只審查目前 index 的 `.github/workflows/macos-signed-canary.yml` 與 `scripts/test-macos-signed-canary-gate.mjs` staged diff；其他 dirty tracked／untracked changes 不屬於本次交付。
- 驗證環境：Node.js `v22.22.3`、Ruby `2.6.10`、Apple Silicon macOS；本輪未觸發 GitHub workflow 或建立／修改任何外部 resource。

## 1. 需求完整性

- 判定：通過
- 證據：
  - `git rev-parse HEAD` 為 `8dd82fbe71e754616d1c87971670e1e5ad5bf7bc`；`git diff --cached --name-status` 精確只有 `.github/workflows/macos-signed-canary.yml` 與 `scripts/test-macos-signed-canary-gate.mjs`，`git diff --cached --stat` 為 2 files changed、6 insertions；兩個目標檔案沒有 unstaged overlay。
  - `git diff --cached --check` exit 0；這符合最新 08 條目 `docs/project-management/08-CHANGE-LOG.md:3-16` 的 result evidence cleanup、run ID binding、focused assertion、full checks 與排除其他 dirty changes 的工作界線。
  - workflow `:211-225` 的 final `if: always()` cleanup 新增固定 `result_evidence` binding；focused test `scripts/test-macos-signed-canary-gate.mjs:156-159` 以連續 regex 綁定固定 path、`cleanup_status=0` 與實際 `rm -f -- "$result_evidence"`。round1 report 的 F-01（其 `:69`）因此已由 staged source 修正。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `.github/workflows/macos-signed-canary.yml:193-200` 以 `docs/project-management/evidence/ci-${GITHUB_RUN_ID}-macos-signed-canary-result.json` 產生並複製 signed-canary result evidence；` :211-219` 的 final cleanup 使用同一 run-scoped path，且在 upload step `:202-209` 之後執行，因此 artifact copy 先於 repository cleanup。
  - `:212` 的 `if: always()` 使 cleanup 在前序步驟失敗時仍可執行；`:218-225` 以 `cleanup_status` 累積 result evidence、notary JSON／stderr 與受保護 output directory cleanup 的失敗，最後以非零狀態回傳，不把 cleanup failure 靜默成成功。
  - result evidence 使用 `rm -f --`，沒有對該 leaf path 使用 `rm -rf`；既有 `rm -rf` 只位於 `expected` 等於 run-scoped output directory 且為 directory 的條件分支 `:222-223`。
  - 以目前 workflow bytes 執行 authoritative regex probe 得到 `{"authoritativeMatch":true,"mutationMatchAfterRmRemoval":false,"mutatedHasRm":false}`；將實際 rm 行替換為 `echo cleanup omitted` 後 assertion fail，已直接關閉 round1 F-01 的 false-pass。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 使用與 workflow 相同的 `rm -f -- <fixed result path>` 在隔離暫存 filesystem 實測：regular file 結果 status 0 且被移除；leaf symlink 結果 status 0、link 被移除且 target 保留；result path 為 directory 時 status 1 且 directory 保留。這符合 leaf symlink 不追刪 target、directory 不被遞迴刪除及 fail-closed cleanup status 的預期。
  - `result_evidence` 以雙引號傳入命令，固定 basename 使用 `GITHUB_RUN_ID`，沒有 wildcard、遞迴 locator 或 caller-supplied path；focused test 同時保留 `assert.doesNotMatch(workflow, /find ... -name '*.app'/)` 的非遞迴 artifact boundary。
  - 本輪沒有觸發 self-hosted GitHub runner，未實測 runner 上的權限拒絕、parent directory symlink／parent-path manipulation、實際 checkout filesystem 或 workflow step failure ordering；因此這些是 source／隔離 fixture 已覆蓋的邊界，不是實際 CI filesystem evidence。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - staged diff 只有 workflow 2 行與 focused test 4 行，沒有重排 workflow、修改其他 source、治理文件、evidence 或 review；allowlist 與 `git diff --cached --check` 均通過。
  - cleanup 變更沿用既有 `cleanup_status`、`if ! ...; then ...; fi` 與 final `exit` pattern；`set -euo pipefail`、固定命名、shell quoting 與 `--` 參數分隔均保留。
  - test assertion 現在是連續且可變異驗證的 path-to-command contract，不再只搜尋 result filename；與 workflow 中的 fixed run-scoped result path 及 final `always()` step 相符。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - `npm run project:preflight -- --type=full` exit 0；`git diff --cached --check` exit 0；staged focused script 以 `git show :'scripts/test-macos-signed-canary-gate.mjs' | node --check --input-type=module` exit 0；staged workflow 以 Ruby `Psych` parse 成功（`jobs=signed-canary`）。
  - `node scripts/test-macos-signed-canary-gate.mjs` exit 0，輸出 `macOS signed canary gate contract passed: identity, toolchain, source config and notarization fail-closed matrix`。
  - `npm run check` exit 0；輸出確認 docs check、全 repository syntax、完整 npm test、signed-canary gate／result／distribution／external-boundary suites 與 posttest YouTube suites 均通過。
  - 本輪獨立 mutation probe 確認實際 rm 行移除後 regex 不再匹配；隔離暫存 filesystem probe 也實測 regular file、leaf symlink 與 directory boundary。
  - focused test 本身沒有新增可執行的 symlink／directory／permission fixture，也沒有 workflow-run integration test；目前覆蓋仍以 source contract、deterministic tests 與本輪隔離 probe 為主，因此不能將上述結果擴寫成 self-hosted runner 行為已驗證。
  - `npm run docs:check:final` exit 1，原因是最新 08 條目仍為「進行中」且缺少「獨立審查是否執行：」／「發布授權：」欄位；本審查依使用者限制不修改 08。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 實際完成 full preflight、index allowlist／target parity、cached diff check、staged syntax、staged YAML parse、focused gate test、mutation probe、filesystem boundary probe 與 `npm run check`；結果均如上為成功。
  - 本輪未執行 GitHub workflow、builder、candidate、`codesign`、`notarytool`、`stapler`、`hdiutil`、Gatekeeper、signing、notarization、release 或 GitHub Environment／secret／branch-protection write；亦未 stage、commit、push 或建立 GitHub resource。這符合 08 條目的明確排除範圍。
  - `npm run docs:check:final` 的實際輸出為四項治理缺失：最新工作紀錄缺少獨立審查欄位、缺少發布授權欄位、尚未標示完成，且審查欄位未為是／否。故 source-level validation 通過，但本輪不能宣稱治理 final closeout 已完成。
  - 發布邊界維持為 source cleanup contract review；沒有實際 CI run、Apple identity／credential 使用、signed／notarized candidate、release asset 或 FR-021 overall evidence。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪確認 staged cleanup source contract、fail-closed shell boundary、mutation regression 與 local full checks 均通過，但治理 final gate 仍因 08 工作條目未結案而失敗，因此僅有條件通過，不代表 workflow run、signing、notarization、release 或 FR-021 overall。**
- 阻擋問題（若有）：F-02（治理 closeout）：`npm run docs:check:final` exit 1；需由主要代理依限制完成最新 08 條目的治理欄位與完成狀態後重跑 final gate。F-01（focused assertion 未綁定實際 rm）已由本輪 staged source 與 mutation probe 關閉。
- 剩餘風險：不能把 cleanup source contract 說成實際 workflow run、signing、notarization、release 或 FR-021 overall；self-hosted runner 的 parent-path／權限／實際 step ordering、GitHub Environment／required reviewer／secret scope、Apple identity／credential、signed candidate、notarization、Gatekeeper 與外部 release 結果仍未驗證。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
