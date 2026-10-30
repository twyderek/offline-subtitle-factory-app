# 獨立審查報告：FR-021 signed-canary result evidence cleanup hardening

- 審查對象：index 相對於 `HEAD 8dd82fbe71e754616d1c87971670e1e5ad5bf7bc` 的 staged diff；staged workflow blob `d659beb29946bd83e3a976b93d4a00295b83b50c`、staged focused-test blob `01394acefae16dca3e23561c23c9f6a34b78f41d`。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS signed-canary result evidence cleanup hardening（`FR-021-MACOS-CI-20261029-RESULT-CLEANUP-NEXT1`）。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-29T15:04:00+0800；獨立唯讀審查上下文，先讀 `AGENTS.md`、`npm run project:preflight -- --type=full` 列出的固定核心／路由文件、最新 08 條目及上一階段 round4 report；未沿用主要開發代理的評價性結論。
- 審查範圍：只審查目前 index 的 `.github/workflows/macos-signed-canary.yml` 與 `scripts/test-macos-signed-canary-gate.mjs` staged diff；其他 dirty tracked／untracked changes 不屬於本次交付。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `git diff --cached --name-status` 僅列出兩個指定 paths，`git diff --cached --stat` 為 2 files changed、3 insertions；`git diff --cached --check` exit 0。`git status --short` 顯示另有既有 dirty changes，但本輪沒有把它們納入 staged diff 或交付。
  - 最新 08 條目 `docs/project-management/08-CHANGE-LOG.md:3-16` 將 scope 限定為 final `always()` cleanup、run ID 綁定 result evidence、focused contract test、source／focused／完整 check／YAML／diff check，並明確排除 workflow、builder、signing、notarization、GitHub writes 與其他 dirty changes；目前 staged diff 與此界線一致。
  - 上一階段 round4 report `docs/project-management/reviews/2026-10-29-fr-021-macos-ci-signed-canary-handoff-next1-round4.md:37,47,77-79` 將 checkout result evidence cleanup 保留為 residual；本輪 workflow 已補上該固定 result path 的 cleanup。
  - 但成功條件要求 focused test「固定 cleanup invariant」；新增 assertion 只驗證 cleanup 區段含有檔名文字（`scripts/test-macos-signed-canary-gate.mjs:152-156`），未把該 path 綁定到實際 `rm -f -- "$result_evidence"` 動作，因此需求完整性暫列部分通過。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - workflow result audit 在 `.github/workflows/macos-signed-canary.yml:193-200` 寫入並複製 `docs/project-management/evidence/ci-${GITHUB_RUN_ID}-macos-signed-canary-result.json`；final cleanup 在 `:211-225` 宣告 `if: always()`，以同一 run-scoped basename 綁定 `result_evidence`，再執行 `rm -f -- "$result_evidence"`。
  - cleanup 使用 `cleanup_status` 累積刪除失敗，最後 `exit "$cleanup_status"`；既有 notary JSON／stderr 與 exact expected output directory cleanup 仍保留，未因本輪 2 行新增而改變其他 cleanup semantics。
  - 以 staged workflow bytes 執行的 invariant probe exit 0，輸出 `{"writePathCount":2,"finalAlways":true,"finalRm":true,"fixedBinding":true}`，確認寫入與 final cleanup 的固定 path、`always()` 及實際 rm binding 均存在。
  - staged workflow 以 Ruby `Psych` YAML parser 解析成功，`signed-canary` 含 16 steps；staged focused script `node --check` exit 0。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - path 使用固定字串 `docs/project-management/evidence/ci-${GITHUB_RUN_ID}-macos-signed-canary-result.json`，沒有 wildcard、使用者輸入或遞迴刪除；`rm -f --` 只針對 leaf path，leaf symlink 會被解除連結而不追著 target 刪除；若該 leaf 實際是 directory，`rm -f` 會失敗並由 `cleanup_status=1` fail-closed，不會改用 `rm -rf`。
  - final step 的 cleanup path 與 result audit path 由上項 staged invariant probe 逐字比對；`GITHUB_RUN_ID` 也與既有 workflow 的 run-scoped output／notary naming convention 一致。
  - 本輪未觸發 GitHub workflow，未在 self-hosted runner 實際重播 absent file、regular file、leaf symlink、directory、權限拒絕或 parent-path manipulation；因此上述是 source-level path／shell boundary 判定，不是實際 runner filesystem evidence。
  - focused test 沒有對 symlink／directory 或「rm 行被移除但 path 文字仍存在」建立 executable fixture；後者已由 mutation probe 重現為 assertion false-pass，列入 F-01。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - staged diff 只新增清楚命名的 `result_evidence` binding 與一行 fail-closed cleanup，未重排 workflow、未混入其他 source 或治理檔案；`git diff --cached --check` exit 0。
  - 新邏輯沿用同一 cleanup step 的 `cleanup_status` pattern（`.github/workflows/macos-signed-canary.yml:218-225`），與既有 notary evidence cleanup 風格一致；`set -euo pipefail`、`if ! ...; then ...` 與 final exit 保留可診斷失敗結果。
  - focused test 的 assertion 位置位於既有 cleanup contract 區段，且不會執行 workflow、寫入 GitHub 或觸發 Apple toolchain；不過 assertion 精度不足屬測試品質問題，於第 5 節及 F-01 保留。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - `npm run project:preflight -- --type=full` exit 0。
  - `git diff --cached --check` exit 0；staged script `git show :'scripts/test-macos-signed-canary-gate.mjs' | node --check --input-type=module` exit 0；staged workflow 由 Ruby YAML parser 解析成功，輸出 `staged YAML parsed: signed-canary steps=16`。
  - `node scripts/test-macos-signed-canary-gate.mjs` exit 0，輸出 `macOS signed canary gate contract passed: identity, toolchain, source config and notarization fail-closed matrix`。
  - `npm run check` exit 0；治理 docs check、全 repository Node syntax、完整 npm test、signed-canary gate／result／distribution／external-boundary tests、Ollama／UI／YouTube regression 均在輸出中通過。
  - 可重現的 mutation probe 將 cleanup 區段的精確行 `if ! rm -f -- "$result_evidence"; then cleanup_status=1; fi` 替換為 `echo cleanup omitted`；新增 assertion 的 filename regex 仍為 true。probe 輸出 `{"exactLinePresent":true,"filenameAssertionAfterRmRemoval":true,"mutatedHasRm":false}`。因此 F-01（P2）：focused test 目前能鎖定 path 字串存在，但不能鎖定該 path 確實交給刪除命令。
  - `npm run docs:check:final` exit 1，原因是最新 08 條目 `:3-16` 仍為「進行中」且尚未寫入「獨立審查是否執行：」與「發布授權：」欄位；此為本輪 reviewer 不得修改 08 的治理 closeout 條件。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 本輪實際完成 preflight、staged path allowlist、cached diff check、staged Node syntax、staged YAML parse、focused gate test、完整 `npm run check` 與 mutation probe；除第一次 Node YAML parser 因本機缺少 `yaml` package 而 exit 1 外，改用本機 Ruby `Psych` parser 的 YAML 驗證 exit 0。第一次工具缺件沒有被當成 YAML 失敗證據。
  - 本輪沒有執行 GitHub workflow、builder、candidate、`codesign`、`notarytool`、`stapler`、`hdiutil`、Gatekeeper、Environment／secret／branch-protection writes、signing、notarization 或 release 操作；這符合 08 條目的明確排除範圍。
  - `HEAD` 為 `8dd82fbe71e754616d1c87971670e1e5ad5bf7bc`，branch 為 `codex/0.51-anthropic-claude`；沒有 stage、commit、push、workflow trigger 或 GitHub resource 建立／修改。其他 dirty changes 保留，未作為本輪交付。
  - 治理／發布邊界：本輪只支持 local source cleanup contract 與 deterministic checks；`docs:check:final` 尚未通過且 F-01 尚未修正，因此不能作為 allowlist-only commit／release readiness 的無條件通過，也不能把 source contract 擴寫成任何外部執行結果。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 FR-021 signed-canary result evidence cleanup round1 確認 staged source 的固定 run-scoped cleanup、shell fail-closed 邏輯與 local validation 均成立，但 focused test 尚未精確鎖定實際刪除命令，且 final docs gate 尚未完成，因此僅有條件通過，不代表 workflow run、signing、notarization 或 release。**
- 阻擋問題（若有）：
  - F-01（P2，測試精度）：`scripts/test-macos-signed-canary-gate.mjs:156` 只匹配 result basename；移除實際 `rm` 行仍可通過。主要代理應將 assertion 綁定至固定 path 的實際 rm command，並重跑 focused／完整 checks。
  - F-02（治理 closeout）：`npm run docs:check:final` exit 1，最新 08 條目尚未標示完成且缺少獨立審查／發布授權欄位；本審查代理依限制不修改 08，需由主要代理依本報告完成治理回填後重跑 final gate。
- 剩餘風險：本報告只證明 source contract、staged diff 與 local deterministic validation；不能把它說成實際 workflow run、Apple Developer ID signing、notarization、stapler／Gatekeeper、signed candidate、release 或 FR-021 overall acceptance。實際 self-hosted runner filesystem／symlink／權限故障、GitHub Environment／secret／protected ref、Apple identity／credential 與所有外部執行結果仍未驗證。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
