# 獨立審查報告：FR-021 remote source handoff next1

- 審查對象：目前 index 的精確 23-path allowlist staged tree；基準 `HEAD`／remote branch ref 均為 `c06d15e95a2f0a0981518c5873003a460e57a5ee`，package version `0.52.0`。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS signed-canary remote source handoff next stage（`FR-021-MACOS-CI-20261029-REMOTE-SOURCE-HANDOFF-NEXT1`）。
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-10-29T14:47+08:00 至 14:54+08:00（Asia/Taipei）；獨立審查上下文，先讀 `AGENTS.md`、`docs/project-management/README.md`、`project:preflight --type=full` 列出的固定核心／治理／路由文件、`08-CHANGE-LOG.md` 範本與最新條目，以及 round1／round2 report；未把主要工作代理對結果的評價當作證據。
- 審查限制：只審查 index staged tree；dirty worktree 的其他 tracked／untracked path 不列入交付。除建立本報告外只執行讀取、靜態檢查與測試，未修改其他檔案，未 stage、commit、push、建立 GitHub 資源或觸發 workflow。

## 1. Allowlist purity

- 判定：通過。
- `git diff --cached --name-only` 精確為 23 paths，與本輪 allowlist 一致：workflow、signed-canary builder/config／library、signed-canary readiness／gate／result／distribution／external-boundary source and tests、`package.json`，以及兩份既有 packaged-security／adhoc-runtime evidence 與 authoritative next4 readiness evidence；沒有 dirty AI／Ollama／UI／其他 evidence／review path 混入。
- `git diff --cached --check`：exit 0。
- `git ls-files --stage` 顯示三份 staged evidence 在 index 為 mode `100644`；目前 working tree permissions 為 `0600`。內容 privacy scan 未見 secret value、token、absolute path 或 private-key marker，因此這是 checkout 後檔案權限的 residual，不構成本輪 source-only path purity blocker。

## 2. Dependency closure

- 判定：通過。
- 以 index bytes 解析 staged `.mjs` 的相對 imports、`package.json` 的 `check`／`test` references 與 workflow script references，共 92 個 unique references，全部可由 index 或 `HEAD` tracked tree 解析；missing references：0。
- `package.json` 的新增 check/test references 已納入本輪 closure，包括 `scripts/audit-macos-signing-readiness.mjs`、`scripts/test-macos-signing-readiness.mjs`、`scripts/audit-macos-packaged-security-identity.mjs`、`scripts/probe-electron-single-process.mjs` 與 signed-canary tests；round1 的 16-path closure blocker 已關閉。
- next4 readiness evidence 的 `existingEvidence` 僅引用 `2026-10-28-fr-021-packaged-security-identity-audit3.json` 與 `2026-10-29-fr-021-adhoc-runtime-signing-canary-audit2.json`，兩者均在 index；未依賴未 staged 的 next1／next2／next3 intermediate evidence。
- 沒有修改 `package-lock.json`；本輪只是 package scripts／source contract 變更，沒有發現需要 lockfile 更新的 dependency change。

## 3. Workflow／source contract

- 判定：條件通過；round2 P1 已關閉，仍保留 round2 P2 operational residual。
- protected-ref 修正已成立：`.github/workflows/macos-signed-canary.yml:29-41` 是先於所有 Apple secret references 的第一個 trust-boundary step，使用 `env.OSF_GITHUB_REF_PROTECTED: ${{ github.ref_protected }}`（line 32），並以 `test "${OSF_GITHUB_REF_PROTECTED:-false}" = "true"`（line 37）fail-closed。Apple secret 第一次出現於 lines 62-64；另兩個 secret steps 在 lines 105-107、125-127，均位於 protected-ref check 之後。`false`／unset shell simulation exit 1，`true` exit 0。
- `scripts/test-macos-signed-canary-gate.mjs:150-151` 對上述 env injection 與 fail-closed assertion 有 static assertions；workflow YAML parse 通過。`workflow_dispatch`、固定 ref、Apple Silicon self-hosted labels、Environment declaration、immutable action SHA、concurrency、clean checkout、readiness 後無條件 formal gate、gate exit 0 才 builder、run-scoped out-of-tree output 與 direct-child app／DMG selector 均可由目前 staged source 查核。
- P1 closure：round2 F-01 的 authoritative evidence drift 已由 next4 source binding 修正，round2 F-02 的 protected-ref fail-open 已由上述 step 與 focused static assertions 修正。這兩項不再阻擋本輪 source-only handoff。
- 仍存在但屬 P2、不是本輪精確 source-only commit 的 P1 blocker：
  - `.github/workflows/macos-signed-canary.yml:197-200` 產生並複製 signed-canary result evidence 後，final cleanup（lines 211-223）未移除該 checkout 內的 result file；self-hosted runner 可能殘留 bounded evidence。
  - `package.json:172-185` 的 signed-canary mac target 仍包含 arm64 ZIP，但 workflow selector／notary／distribution evidence 只處理 app 與 DMG；需另行限縮 target 或補 ZIP verification，才可宣稱完整 target coverage。
  - `scripts/audit-macos-signed-canary-result.mjs:272-312` 與 `scripts/audit-macos-packaged-security-identity.mjs:117-139` 對 malformed／missing `CFBundleExecutable` 仍可能在 writer 前 throw，尚未產出 bounded `status: fail` evidence。
  - `.github/workflows/macos-signed-canary.yml:147-152` 將 app-specific password 傳入 `notarytool` process argv；GitHub log masking 不等於 self-hosted process-table／diagnostic isolation。

## 4. Tests／provenance／reproducibility

- 判定：通過；完整 check 的 binary-fixture 限制列為 residual。
- authoritative staged evidence：`docs/project-management/evidence/2026-10-29-fr-021-prerequisite-readiness-recheck-next4.json:20-28` 的三個 source hashes 與 `git show :path` bytes 逐一相等：
  - `sourceRevision.sourceScriptSha256`（`scripts/audit-macos-signing-readiness.mjs`）：`7803b418fe5962dbc5e79d742599522eb30ab94ad0f8503360ff4de739083277`，match=true。
  - `sourceRevision.packageJsonSha256`（`package.json`）：`d93d656587e8d2f0252b3be79531a02adb68fa5d5664ea9beea221e227992454`，match=true。
  - `sourceRevision.focusedTestSha256`（`scripts/test-macos-signing-readiness.mjs`）：`8a432ac78fa7c97acbf8e3da2e6f6402b01f81e8cfc2e40c7b657ab006783295`，match=true。
- `scripts/test-macos-signing-readiness.mjs:16-19` 以數字序嚴格選取最高 `next<N>.json`；目前工作樹有 next1／next2／next3／next4，故選取 next4。clean staged tree 只帶入 next4，沒有 intermediate evidence 依賴。next4 status 為 `blocked-external-signing-identity`，`validIdentityCount=0`、`notarizationCredentialReady=false`、`formalSigningReady=false`，沒有被錯誤投影為 readiness pass。
- 2026-10-29 執行結果：所有 staged `.mjs` `node --check` 通過；Ruby YAML parse 通過；`node scripts/test-macos-signing-readiness.mjs`、`test-macos-signed-canary-gate.mjs`、`test-macos-signed-canary-result.mjs`、`test-macos-signed-canary-distribution.mjs`、`test-macos-signed-canary-external-boundary.mjs` 全部 exit 0；`npm run check` exit 0；`git diff --cached --check` exit 0。
- `npm run check` 是主 worktree 驗證，不可改寫成純 remote checkout 自足：本機使用 `.gitignore` 明確忽略的 `tools/whisper-cpp/` 與 `tools/whisper-models/` runtime fixture。這些 binary／model fixture 不在 23-path handoff，也不要求加入 commit；因此 clean staged-tree full check 的 reproducibility residual 仍須保留。
- 本輪未執行 commit、push、workflow、builder、codesign、notarytool、stapler、hdiutil、Gatekeeper 或 Apple runner；測試通過只證明 source／deterministic contract，不證明 signed candidate 或 remote execution。

## 5. Privacy／secret safety

- 判定：條件通過。
- 三份 staged evidence 與 `package.json` 的 index-byte JSON／privacy scan 均未發現 absolute path、token、`sk-`、private-key marker 或 secret value；readiness／gate／distribution／result contracts 只保存布林值、分類、digest、bytes、固定 metadata 與 scope flags。`next4` 的 scope 亦全為安全 false projection。
- workflow 的 Apple secret references 只出現在 protected-ref check 之後的 readiness／builder／notary steps；readiness evidence 只保存 credential presence boolean，不保存 credential value。這與 round2 P1 的 trust-boundary 要求一致。
- evidence working tree mode 為 `0600`，但 index mode 為 `100644`；由 checkout 取得的 tracked mode 不能依賴 local `chmod`。目前內容沒有 secret，故列為 privacy hardening residual，不單獨阻擋 source-only commit。
- round2 F-06 的 notary password process argv exposure 仍未修正；在實際 workflow dispatch 前應改用受保護 keychain profile／等價不經 argv 的 credential path，或由治理明確接受該受控 runner residual。這會阻擋安全的 workflow completion claim，但不是本輪 23-path source closure 的 P1 blocker。

## 6. Governance／release boundary

- 判定：條件通過；source-only handoff 與 release／external execution 邊界有清楚區分。
- 這不是 release、candidate、asset 或 GitHub write；`AUTH-2026-07-23-01` 不適用，且本輪沒有觸發 workflow／signing／notarization，沒有建立 GitHub Environment、reviewer、secret、branch protection 或其他 GitHub resource。remote `refs/heads/codex/0.51-anthropic-claude` 仍為 base `c06d15e95a2f0a0981518c5873003a460e57a5ee`，不能宣稱 staged source 已部署或 workflow 已可執行。
- staged readiness evidence 明確保留 external blocker：沒有 Developer ID identity／notarization credential；這只能結論為 source contract handoff readiness，不能宣稱 signed／hardened candidate、Apple ticket、Gatekeeper、renderer、offline、全機 egress、Windows 或 FR-021 overall 完成。
- `npm run docs:check` exit 0；但在目前 dirty worktree 執行 `npm run docs:check:final` exit 1，原因是 `08-CHANGE-LOG.md` 最新條目仍為「進行中」，且尚未填入「獨立審查是否執行：」／「發布授權：」欄位。這是本輪 report-only／不修改 08 限制下的治理 closeout blocker；因 08 不在本輪 23-path staged tree，不能把它誤列成 allowlist 或 source dependency failure。
- external boundary 的 Environment required reviewers、environment-scoped secrets、protected branch 實際遠端設定、Apple runner／identity／credential 與實際 workflow run 仍待外部核驗；它們阻擋後續 workflow／release execution，不阻擋建立本地精確 23-path source-only commit。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案；未 stage、commit、push、建立 GitHub 資源或觸發 workflow。

若上述聲明不實，本報告無效。

## 最終結論

- 結論：**條件通過**。
- round1 dependency-closure blocker 與 round2 兩個 P1（next4 package／source／focused-test hash provenance、protected-ref fail-closed）均已關閉；目前沒有仍阻擋精確 23-path allowlist source-only commit 的 P1 finding。
- source-only commit：**可以進入**，但僅限目前 index 的 23 paths；本輪未建立 commit，也不代表可 push、可觸發 workflow、已有 external Environment／secrets／protected branch、已有 Apple identity／credential、已有 signed／notarized candidate 或可發布。
- 進入 push／workflow／治理結案前，仍須處理或明確接受上述 P2 result cleanup、ZIP coverage、malformed-candidate bounded evidence、notary argv exposure、tracked evidence mode、ignored runtime fixture reproducibility，以及 08 closeout／`npm run docs:check:final` failure。
