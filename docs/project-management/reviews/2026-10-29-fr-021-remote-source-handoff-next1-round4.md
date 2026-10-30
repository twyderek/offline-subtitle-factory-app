# 獨立審查報告：FR-021 remote source handoff next1 round4

- 審查對象 commit／版本：`8dd82fbe71e754616d1c87971670e1e5ad5bf7bc`
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 macOS signed-canary remote source handoff next stage（`FR-021-MACOS-CI-20261029-REMOTE-SOURCE-HANDOFF-NEXT1`）
- 審查輪次：round4
- 審查代理啟動時間、上下文來源：2026-10-29（Asia/Taipei）；獨立唯讀上下文，讀取 governance preflight 指定文件、目前 08 條目、round1／round2／round3 reports，並重新核對 commit、remote ref、remote workflow metadata、source/provenance、focused／full verification 與外部邊界。
- 審查限制：只審查已提交且已推送的 source-only handoff commit 與目前 08 對應條目；未修改 source、evidence、08、其他 review 或 index，未 stage／commit／push、觸發 workflow、建立 GitHub resource、sign、notarize 或建立 candidate。

## 1. 需求完整性

- 判定：通過
- 證據：`git show --stat` 顯示 commit `8dd82fbe…` 只含 23 paths；`git ls-remote origin refs/heads/codex/0.51-anthropic-claude` 精確回傳同一 SHA，且目前 08 條目第 9–11 行的 allowlist、source-only 與不執行 workflow／release 邊界均與交付範圍一致。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：remote workflow metadata 回傳 path、blob SHA `1d6489e9057c499eb7330b810c75832fc6fe16cd`、size `9112`，與 commit tree 一致；workflow 第 29–41 行先驗證 protected ref，第 62–64 行才引用 Apple secrets，第 73–89 行 gate fail-closed 且第 103–108 行才進 builder；next4 evidence 的 audit／package／focused-test 三個 SHA 與 commit bytes 逐一相等，round1／round2 的 dependency closure 與兩個 P1 已關閉，但 P2 contract residual 仍限制本結論為有條件通過。

## 3. 邊界情況

- 判定：部分通過
- 證據：readiness、gate、result、distribution、external-boundary 五個 focused contract 均實際 exit 0，涵蓋 identity／credential／malformed／artifact cardinality／privacy／remote response negative matrix；但 commit 仍保留 result cleanup、ZIP coverage、malformed candidate evidence 與 notary password argv 等 P2 邊界，分別可由 round3 report 第 30–34 行及 commit workflow／package source 重驗。

## 4. 程式碼品質

- 判定：部分通過
- 證據：`git diff 8dd82fbe^ 8dd82fbe --check`、所有 handoff source `node --check` 與 YAML parse 均 exit 0；23-path commit 未混入目前 dirty worktree 的其他 tracked／untracked 變更，且 round3 已核對 next4 source provenance；三份 tracked evidence 在 commit tree 為 mode `100644`、工作樹曾為 `0600`，因此 tracked evidence mode 與 ignored fixture reproducibility 仍是明確 residual。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：本輪重新執行 `node scripts/test-macos-signing-readiness.mjs`、四個 signed-canary focused tests、全部 handoff source syntax、Ruby YAML parse、commit diff check，均 exit 0；目前工作樹的 `npm run check` 亦實際 exit 0，但該 full check 使用既有 dirty worktree／ignored `tools/whisper-cpp` 與 `tools/whisper-models` runtime fixtures，不能改寫成 clean remote checkout 或 workflow run 證據。

## 6. 實際運行結果

- 判定：部分通過
- 證據：`gh api` 唯讀讀回 remote commit `8dd82fbe…` 與 workflow content metadata，`security find-identity -v -p codesigning` 回報 `0 valid identities found`，Environment／environment secrets／branch protection API 均未取得可用設定；本輪未觸發 workflow、builder、signing、notarization、stapler、candidate 或 release，current 08 第 5 行仍是「進行中」，故本報告只支持 source-only handoff 進入治理 closeout。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 FR-021 remote source handoff round4 確認 `8dd82fbe71e754616d1c87971670e1e5ad5bf7bc` 已推送且 remote ref 與 workflow metadata 可回溯，round1／round2 blocker 已由 source／provenance fixes 關閉，技術 source-only handoff 已可追溯且可接受進入治理 closeout；本結論不是 release、CI、signing pass，也不代表 workflow run、signed/notarized candidate、release 或 FR-021 overall。**
- 阻擋問題（若有）：無。
- 剩餘風險：P2 result cleanup、ZIP coverage、malformed candidate evidence、notary password argv、tracked evidence mode、ignored runtime fixture reproducibility、remote Environment/secrets/protected branch/Apple identity 尚未完成；不得宣稱 workflow run、signed/notarized candidate、release 或 FR-021 overall。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
