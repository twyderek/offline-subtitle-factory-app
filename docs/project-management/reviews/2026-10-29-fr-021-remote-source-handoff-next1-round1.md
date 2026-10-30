# 獨立審查報告：FR-021 remote source handoff next stage

- 審查對象：目前 git index staged allowlist（`.github/workflows/macos-signed-canary.yml`、`electron-builder.signed-canary.mjs`、`lib/macos-signed-canary-*.mjs`、`scripts/*macos-signed-canary*.mjs`、`package.json`）。
- 審查輪次：round1
- 審查代理上下文：獨立唯讀審查上下文；重新執行 preflight、staged path／dependency closure、YAML／syntax、focused tests、完整 `npm run check`、`git diff --cached --check` 與 remote ref／push dry-run 核驗。
- 唯讀限制：未執行 GitHub write、commit、push、workflow、signing 或 notarization；除建立本報告外未修改 source、evidence 或其他專案檔案。

## 1. 需求完整性

- 判定：不通過
- 證據：

  - `npm run project:preflight -- --type=full` exit 0；目前 index staged path 共 16 個，均符合指定 allowlist：workflow、`electron-builder.signed-canary.mjs`、`lib/macos-signed-canary-*.mjs`、signed-canary scripts、tests 與 `package.json`；唯讀 path-set assertion 回報 `all staged allowed: true`，未發現 unrelated staged path。
  - staged dependency closure 不完整：`scripts/assert-macos-signed-canary-ready.mjs:5-12`、`scripts/audit-macos-signed-canary-result.mjs:7-8` 與 `scripts/test-macos-signed-canary-gate.mjs:6-9` 直接 import `scripts/audit-macos-signing-readiness.mjs`，但該檔案目前為 `??`、不在 index staged allowlist，且 remote ref `c06d15e95a2f0a0981518c5873003a460e57a5ee` 不含該 path。
  - workflow `:56-70` 直接執行 `node scripts/audit-macos-signing-readiness.mjs`；因此即使 allowlist path-set 本身乾淨，推送該 allowlist 後 workflow source 仍缺少其必要 runtime dependency。
  - `package.json:31-32` 的 staged `test`／`check` 另引用目前未 staged 且 remote ref 不存在的 `scripts/test-macos-signing-readiness.mjs`、`scripts/audit-macos-packaged-security-identity.mjs` 與 `scripts/probe-electron-single-process.mjs`；目前 dirty worktree 存在這些檔案，不能代替 staged handoff closure。

## 2. 邏輯正確性

- 判定：不通過
- 證據：

  - workflow source contract 的 bounded static assertions 成立：`workflow_dispatch`、exact `refs/heads/codex/0.51-anthropic-claude`、`self-hosted`／`macOS`／`arm64`／`osf-signed-canary` runner、`macos-signed-canary` environment、immutable action SHA、ref-scoped concurrency、clean checkout、formal readiness gate-before-builder、run-scoped output、artifact selection 與 cleanup 均存在；`scripts/test-macos-signed-canary-gate.mjs` exit 0。
  - builder config 的 staged import closure 對 `lib/macos-signed-canary-build-config.mjs` 成立，package 的 signed-canary commands 也已加入；但 signed-canary readiness flow 的 required module 不在 handoff，故上述 source contract 不能在 remote clean checkout 中完成其實際呼叫鏈。
  - 這是 handoff correctness 的 fail-closed 阻擋，不是把 remote Environment、secrets、protected branch 或 Apple runtime 結果誤當作 source contract；那些外部／實際執行項目本輪未宣稱完成。

## 3. 邊界情況

- 判定：不通過
- 證據：

  - YAML parser 通過（Ruby YAML load exit 0）；staged `.mjs` 全部 `node --check` 通過；`git diff --cached --check` 通過。
  - 四個 current focused tests 均實際 exit 0：`test-macos-signed-canary-gate.mjs`、`test-macos-signed-canary-result.mjs`、`test-macos-signed-canary-distribution.mjs`、`test-macos-signed-canary-external-boundary.mjs`。
  - focused tests 使用目前 working tree 的未 staged readiness scripts，因此只證明 dirty worktree fixture 下的 bounded matrix；沒有證明只套用 index staged allowlist 到 remote clean ref 後，missing-module、missing-script 與 package check/test 邊界仍可通過。
  - remote tree 唯讀列舉顯示目前 branch 沒有 `.github/workflows/macos-signed-canary.yml`、`electron-builder.signed-canary.mjs`、canary lib/scripts 或 readiness dependencies；這不是 workflow runtime failure，而是 handoff scope 尚未進入任何 remote commit。

## 4. 程式碼品質

- 判定：不通過
- 證據：

  - staged source syntax、JSON parse、YAML parse、`git diff --cached --check` 均通過；allowlist assertion 也確認沒有 unrelated staged path 混入。
  - 但 source handoff 的可重現性不成立：目前 green `npm run check` 依賴 working tree 中的未 staged／untracked 檔案；同一 package script 在 remote ref 上會遇到未存在的 readiness／probe/test paths，不能視為 staged source-only quality gate。
  - `scripts/audit-macos-signed-canary-result.mjs`、formal gate test 與 workflow 對同一 readiness module 的直接依賴沒有被 allowlist／remote source closure 明確帶入；這是可定位、可修正的 P1 handoff completeness finding。

## 5. 測試覆蓋

- 判定：不通過
- 證據：

  - `npm run check` 在目前 dirty worktree 實際 exit 0，並包含 docs check、全部 staged canary focused tests、既有 regression tests 與 `npm test`；輸出明確包含 gate、result、distribution、external-boundary focused tests passed。
  - 但該結果不是 staged-only／remote-clean verification：`package.json:31-32` 所執行的 `node --check scripts/audit-macos-signing-readiness.mjs`、`node --check scripts/audit-macos-packaged-security-identity.mjs`、`node --check scripts/probe-electron-single-process.mjs` 與 `node scripts/test-macos-signing-readiness.mjs` 均由目前 working tree 提供，其中至少四個不在 staged allowlist，且 remote ref 缺失。
  - 因此 current tests 可作為 local dirty-tree evidence，但不足以證明本輪指定 staged path set 可獨立通過 full check；dependency closure 修正後需在 clean staged／remote-equivalent source 上重跑 syntax、focused 與 full checks。

## 6. 實際運行結果

- 判定：不通過
- 證據：

  - `git rev-parse HEAD` 與 `git ls-remote origin refs/heads/codex/0.51-anthropic-claude` 均為 `c06d15e95a2f0a0981518c5873003a460e57a5ee`；remote branch 目前與 local committed HEAD 一致，但 remote tree 尚無本輪 canary handoff paths。
  - `git push --dry-run origin HEAD:refs/heads/codex/0.51-anthropic-claude` exit 0 並回報 `Everything up-to-date`；因 16 個 staged changes 尚未進入 commit，這個 dry-run 的 remote push scope 為零，不能證明 staged handoff 已可推送或已部署。
  - 本輪未執行 commit、push、GitHub write、workflow run、`electron-builder`、signing、notarization、stapler、Gatekeeper 或實際 Apple runner；未取得 remote Environment、secrets、protected branch 或 workflow-run evidence。
  - source-only handoff 的必要條件仍缺 dependency closure，因此本輪不得以 local full-check green 或 remote dry-run green 宣稱 handoff 完成。

## 綜合判定

- 結論：不通過
- 阻擋問題（若有）：
  - 必須把 `scripts/audit-macos-signing-readiness.mjs` 及 package `check`／`test` 所需且 remote 缺失的相關 source/test dependencies 納入明確 handoff scope，或調整 staged package／workflow 使 closure 完整；修正前不得 commit／push 本輪 source handoff。
  - 修正後須在不依賴目前 dirty worktree 的條件下重跑 YAML、全部 staged syntax、四個 focused tests、full `npm run check`、staged diff check 與 remote push-scope dry-run。
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-CI-20261029-REMOTE-SOURCE-HANDOFF-NEXT1` round1 獨立審查結論為不通過：目前 index staged allowlist 共 16 個 paths，未發現 unrelated staged path，workflow YAML、staged source syntax、四個 focused tests、目前 dirty worktree 的 `npm run check` 與 remote ref 唯讀核驗均通過；但 staged dependency closure 不完整，workflow、`assert-macos-signed-canary-ready.mjs`、`audit-macos-signed-canary-result.mjs` 與 `test-macos-signed-canary-gate.mjs` 依賴未 staged 且 remote ref 不存在的 `scripts/audit-macos-signing-readiness.mjs`，package `check`／`test` 亦引用其他未納入 allowlist 的 readiness／probe/test paths，故目前 green checks 不能證明可推送 source-only handoff；remote branch 目前與 local committed HEAD 同為 `c06d15e95a2f0a0981518c5873003a460e57a5ee`、`git push --dry-run` 為 `Everything up-to-date` 且 staged changes 尚未進入任何 commit／push；本輪不宣稱 remote Environment、secrets、protected branch、workflow run、signing、notarization 或 FR-021 overall 完成。**
- 本輪範圍限制：即使後續修正並通過 source-only handoff，也只能宣稱 allowlisted source／dependency closure／local deterministic validation 與可推送範圍成立；不得擴稱 remote Environment、secrets、protected branch、workflow run、signing、notarization 或 FR-021 overall 完成。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
