# 獨立 closeout 複審報告：FR-021 signed-canary distribution evidence hardening next stage

- 審查對象：目前 working tree 最新內容；對照前一輪原件 `docs/project-management/reviews/2026-10-29-fr-021-distribution-evidence-next1-round1.md` 與 `docs/project-management/reviews/2026-10-29-fr-021-distribution-evidence-next1-round2.md`。
- 對應 08-CHANGE-LOG 條目：`FR-021-MACOS-CI-20261029-DISTRIBUTION-EVIDENCE-NEXT1`。
- 審查輪次：round3 closeout；本報告由獨立唯讀複審上下文建立。既有 dirty worktree、evidence 與前兩輪 report 均保留。
- 審查範圍：`.github/workflows/macos-signed-canary.yml`、`lib/macos-signed-canary-artifact-selection.mjs`、`scripts/select-macos-signed-canary-artifacts.mjs`、`scripts/audit-macos-signed-canary-distribution.mjs`、`scripts/test-macos-signed-canary-gate.mjs`、`scripts/test-macos-signed-canary-distribution.mjs`、`package.json`、治理文件 00／05／06／07／08。
- 限制：未執行 GitHub workflow、Apple signing／notarization、`stapler`、`hdiutil`、`spctl`、keychain、packaged app 或外部 network；除本報告外未修改任何檔案。

## Findings

findings none（本輪無 blocker）。round1 的 plain notary marker／candidate cross-field 問題與 round2 的 run identity／runner-temp／digest／cleanup 問題，均以目前 source、focused fixtures 與 workflow static contract 關閉。治理文件仍刻意將本條目標示為進行中，待主要代理把本報告與完整結論句回填 08 並重跑 final docs gate；這是尚待執行的治理 closeout，不是目前 bounded source/local contract 的技術 blocker。

## 1. 需求完整性

- 判定：部分通過
- 證據：artifact selector 只讀 `mac-arm64` 的直接子項主 `.app` 與 output root 的唯一 `*-macos-arm64.dmg`（`lib/macos-signed-canary-artifact-selection.mjs:12-34`），不會把 nested Helper.app 計入；gate test 以 temporary filesystem fixture 實際建立 nested Helper.app 並覆蓋 duplicate app／DMG cardinality（`scripts/test-macos-signed-canary-gate.mjs:155-172`）。distribution audit 只保存 app／DMG digest、command summary、source revision、scope 與 privacy projection，不宣稱 Apple ticket validity 或 FR-021 overall acceptance。

## 2. 邏輯正確性

- 判定：通過
- 證據：`readNotaryOutput()` 在 `scripts/audit-macos-signed-canary-distribution.mjs:78-103` 強制數字 `GITHUB_RUN_ID`、絕對 `RUNNER_TEMP`、固定 resolved output path、`lstat().isFile()`、0600、JSON parse、canonical `Accepted` 與 `sha256 === dmgSha256`；missing／wrong-run／outside-temp／symlink／lowercase／malformed／no-run-id 均回傳 invalid。candidate metadata／executable digest cross-field、timestamp ordering、environment／interpretation leaf type、stapler／archive status consistency 與 summary readiness 仍維持 fail-closed（同檔 `:113-145`）。workflow notary failure-only EXIT trap、distribution EXIT trap 與最後 `if: always()` cleanup 均逐一嘗試清除 JSON／stderr，即使前一個清理動作或 output directory cleanup 失敗也繼續；distribution evidence copy／cleanup 在 app result audit 前完成（`.github/workflows/macos-signed-canary.yml:119-220`）。

## 3. 邊界情況

- 判定：通過
- 證據：distribution test 的 fixture 覆蓋 valid output、DMG digest mismatch、外部同 basename、wrong-run、symlink、canonical／lowercase status、malformed JSON、raw digest／bytes、no-run-id、environment／interpretation leaf types，以及 writer 0600／EEXIST（`scripts/test-macos-signed-canary-distribution.mjs:99-143`）；gate fixture 覆蓋 nested Helper.app、duplicate app／DMG 與 workflow cleanup static contract（`scripts/test-macos-signed-canary-gate.mjs:144-172`）。未執行 Apple command，因此實際 notarization／stapler／hdiutil result 仍明確排除於本輪。

## 4. 程式碼品質

- 判定：通過
- 證據：selector 已拆成共用純模組；production parser 拒絕非數字 run ID、相對 runner temp、非固定 output、symlink 與非 regular file，並要求 0600；distribution evidence writer 使用 exclusive `wx`／0600（`scripts/audit-macos-signed-canary-distribution.mjs:221-224`）。validator 使用 exact schema、leaf types、cross-field summary recomputation、all-false scope 與 privacy leakage guard；workflow 以 bounded runner-temp artifact 與 exact run-scoped cleanup 維持 clean-worktree provenance。

## 5. 測試覆蓋

- 判定：通過
- 證據：`npm run project:preflight -- --type=full` exit 0；`node scripts/test-macos-signed-canary-gate.mjs` exit 0；`node scripts/test-macos-signed-canary-distribution.mjs` exit 0；相關 `node --check` exit 0；`npm run check` exit 0，包含完整 syntax、治理與 npm test 回歸；`npm run docs:check` exit 0；Ruby YAML parse exit 0；`git diff --check` exit 0。workflow static probe 確認 notary failure trap、distribution EXIT trap、兩組 JSON／stderr cleanup、最後 `if: always()`、distribution-before-app-audit 與 copy-before-exit 全部存在；沒有執行 Apple／GitHub 外部動作。

## 6. 實際運行結果

- 判定：部分通過
- 證據：本輪 source／local deterministic checks 均支持 bounded contract；但未執行 GitHub workflow、Apple signing／notarization、stapler、hdiutil、spctl、keychain、packaged app 或外部 network，因此不能把本輪結果擴稱為實際 signed／notarized candidate、Apple ticket validity 或 FR-021 overall acceptance。`npm run docs:check:final` 在本報告建立前因 08 最新條目尚未補本輪 closeout 欄位而 exit 1；主要代理仍須回填 08 後重跑 final gate。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：目前無技術 blocker；治理 closeout 尚待主要代理將本報告與完整結論句同步至 08，並重跑 `npm run docs:check:final`。
- 剩餘風險：GitHub Environment reviewer／secret scope、Developer ID identity／credential、Apple ticket validity、實際 workflow、signed／notarized candidate、Seatbelt renderer、全機 egress、Windows、LM Studio 與 FR-021 overall 仍未由本輪驗證。
- 可逐字引用的完整結論句：**本輪 `FR-021-MACOS-CI-20261029-DISTRIBUTION-EVIDENCE-NEXT1` round3 closeout 獨立複審結論為 bounded source/local contract 有條件通過且 findings none：round1 的 plain notary marker 與 candidate metadata／digest cross-field 問題、round2 的非數字／缺少 `GITHUB_RUN_ID`、相對或外部 `RUNNER_TEMP`、wrong-run／symlink、canonical `Accepted`、raw file-content digest／bytes 與 notary／stapler／verify／distribution failure cleanup 問題，均已由 production parser、workflow traps、最後 `if: always()`、distribution copy-before-app-audit 順序與 focused regression 收斂；selector／nested Helper.app fixture、cardinality fail-closed、exclusive 0600／EEXIST writer、schema leaf types、privacy／scope、YAML／完整回歸與 bounded 文件界線均成立；目前仍不得宣稱 GitHub Environment reviewer／secret scope、Developer ID identity／credential、signed／notarized candidate、Apple ticket validity、實際 workflow、Seatbelt renderer、全機 egress、Windows、LM Studio 或 FR-021 overall 已完成，且主代理必須把本報告與本句回填 08 後重跑 `npm run docs:check:final`。**
- 給主要開發代理的具體修正要求（若有）：只需完成 08 治理 closeout 欄位同步、引用本報告與完整 quote，然後重跑 `npm run docs:check:final`；不得因此擴大為未執行的 Apple／GitHub runtime acceptance。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
