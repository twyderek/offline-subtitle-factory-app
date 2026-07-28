# 獨立審查報告：README 0.47.1 與 main 同步準備

- 審查對象 commit／版本：`01b6e96dca5d4ca67f96453f2c7a049e900d3b9c` 加上目前工作樹的工作紀錄收斂差異／`0.47.1`；Draft PR #7
- 對應 08-CHANGE-LOG 條目：2026-07-28 — README 0.47.1 與 main 同步準備
- 審查輪次：round3（不覆寫 round1／round2）
- 審查代理啟動時間、上下文來源：2026-07-28T10:22:42+08:00；由主要代理啟動的獨立上下文，未沿用開發代理對話記憶；本輪只讀核對並僅建立本報告。

## 1. 需求完整性

- 判定：通過
- 證據：
  - `README.md:3-15` 已將使用者入口更新為 0.47.1 正式公開版本，列出 Release URL、macOS／Windows 資產類型、品質校閱功能、rule-score 邊界及未簽章／未公證／Metal／Electron／跨平台實機缺口。
  - `README.md:81`、`README.md:88` 的 macOS DMG 與 Windows Setup／Portable 名稱和 `RELEASE-NOTES-0.47.1.md:23-25` 一致；`package.json` 實際版本為 `0.47.1`。
  - `README.md:148` 已說明目前收尾分支 `codex/release-v0.47.1` 與合併後使用 `main` 的關係，滿足工作紀錄 `docs/project-management/08-CHANGE-LOG.md:55` 的分支說明成功條件。
  - GitHub connector `_get_pr_info` 於本輪確認 Draft PR #7 已建立，URL `https://github.com/twyderek/offline-subtitle-factory-app/pull/7`、state `open`、draft `true`、merged `false`、base `main`、head `codex/release-v0.47.1`、head SHA `01b6e96dca5d4ca67f96453f2c7a049e900d3b9c`，符合本輪只建立可審查 Draft PR、不自行合併的範圍。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `README.md:5-7` 的已正式發布狀態與 `README.md:90` 的「Windows 正式資產尚未使用程式碼簽章憑證」一致；round1 的正式發布／預覽矛盾已解除。
  - PR #7 body 的 Scope warning 已改為「完整 release-branch difference」並要求以 GitHub current PR metadata 為準，不再保存 round2 指出的過期固定 commit／file 數。
  - `docs/project-management/08-CHANGE-LOG.md:58,61,74` 目前工作樹也改以 GitHub 即時 metadata 為準，只描述 PR 是完整多版本同步，不再把任一瞬間的固定 count 當成持久事實。
  - GitHub connector 本輪顯示 PR 已隨 round2 修正更新為 13 commits／66 files／2703 additions／128 deletions；相較 round2 的 12／65 自然增加，證明移除易過期固定數字可避免再次產生文件矛盾。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - README 涵蓋 macOS DMG／ZIP、Windows Setup／Portable、Windows Unknown Publisher／SmartScreen、macOS Gatekeeper、Metal、Electron、跨平台實機與 AI 資料外傳邊界；內建舊版手冊路徑亦在 `README.md:96` 如實標為「目前內建手冊版本」。
  - PR #7 是 Draft、open、mergeable、尚未合併；README `main` 的實際首頁更新不屬本輪「同步準備＋Draft PR」完成範圍，工作紀錄 `docs/project-management/08-CHANGE-LOG.md:56,73-74` 已明確區分。
  - `_get_commit_combined_status` 對 head `01b6e96...` 回傳空 statuses，`_fetch_commit_workflow_runs` 也未列出 PR-triggered runs；工作紀錄則記載 Windows x64 test and package check pending。由於 connector 並未提供該 pending check 的實際 job，CI 完成狀態仍須在合併前由 GitHub PR checks 頁或 Actions run 再核對。
  - 本輪沒有把 README／Draft PR 文件同步當成 Windows／macOS 實機、Metal 或 Electron runtime 驗收；既有未覆蓋項仍持續揭露。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - commit `01b6e96` 的訊息為 `docs: correct README sync scope`，HEAD、`origin/codex/release-v0.47.1` 與 GitHub PR head SHA 三者一致。
  - 本輪變更集中於 README、治理工作紀錄與獨立審查報告，沒有產品程式碼修改；PR body 也明確警告實際 PR 是多版本完整同步，避免把 66 檔差異誤稱為 README-only patch。
  - 最新工作條目現位於 `docs/project-management/08-CHANGE-LOG.md:47`、所有舊工作條目之前，符合該檔第 3 行「最新項目置頂」規則，round1／round2 的排序阻擋已解除。
  - 工作樹另有既存未追蹤檔 `docs/project-management/reviews/2026-07-23-github-sync-audit-round1.md`；本審查未修改、提交或將其混入本輪證據。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-28T10:22:42+08:00 執行 `npm run docs:check`，結果為「專案治理文件檢查通過：19 個文件，版本 0.47.1」。
  - 同次執行 `git diff --check` 與 `git diff --check origin/codex/release-v0.47.1`，exit 0。
  - 以 GitHub connector `_get_pr_info` 核對 PR state／draft／merged／mergeable／base／head／head SHA／即時 diff 統計；本地以 GitHub 回傳的 base SHA `ddc700e...` 核對 `git rev-list` 為 `0 13`、`git diff --shortstat` 為 `66 files changed, 2703 insertions(+), 128 deletions(-)`，與 GitHub metadata 一致。
  - `npm run docs:check:final` 尚未執行；目前工作條目仍為進行中且待主要代理引用 round3、提交推送並記錄 CI／未合併狀態，因此 final gate 應在上述收尾後執行。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - Draft PR #7 已在 GitHub 實際存在，open、draft、未合併、mergeable，base/head 與目前推送 commit 一致；本輪「建立可審查 Draft PR」已實現。
  - PR `main...codex/release-v0.47.1` 即時差異為 ahead 13、behind 0，顯示 head 完整接續 GitHub main 的 merge-base `ddc700e...`，沒有待先整合的反向分歧。
  - 工作樹中的動態範圍說明與本 round3 報告尚未形成新 commit／push；主要代理須將這些結案證據推送到同一 PR，才能使 GitHub 上的治理紀錄與本輪判定一致。
  - Windows CI 尚待完成，且使用者尚未決定合併；兩者是合併前條件，不是本輪 Draft PR 準備範圍的失敗。`main` 目前仍不得宣稱已同步。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無；round1 的 README 發布狀態矛盾、分支說明與工作條目排序，以及 round2 的固定 PR count 誤載均已解除。
- 條件：
  1. 主要代理須將目前工作紀錄收斂差異與本 round3 報告提交並推送至 Draft PR #7，引用本報告的完整結論句，更新 PR head SHA 後重核 base／head／draft／未合併狀態。
  2. 合併前須等待 Windows x64 test and package check 完成並核對實際 conclusion；若失敗，不得合併，須修正後重新審查。
  3. 完成工作紀錄後執行 `npm run docs:check:final` 與 `git diff --check`。
  4. 本輪有條件通過僅涵蓋「README 0.47.1 同步準備＋Draft PR」；不涵蓋合併。只有使用者確認完整 PR 差異且 PR 實際合併後，才可宣稱 GitHub default branch／專案首頁已同步。
- 剩餘風險：
  - PR 是完整多版本同步而非 README-only patch；GitHub 本輪即時為 13 commits／66 files，但該數字仍會隨結案提交更新，合併時應以 GitHub 即時 metadata 為準。
  - Windows CI 尚未提供完成結論，合併授權／操作也尚未發生。
  - Windows 未 Authenticode、macOS 未 Developer ID 簽章／公證；Metal exit 139、Electron、跨平台安裝後與真實長音訊仍未驗收。
- 給主要開發代理的具體修正要求：依上述四項條件完成文件引用、commit／push、CI 核對與 final gate；除非使用者另行要求並在 CI 成功後確認，維持 PR 為 Draft 且不合併。

- 可逐字引用完整結論句：**本輪 README 0.47.1 與 main 同步準備 round3 獨立審查結論為有條件通過：README 已一致呈現 v0.47.1 正式發布、實際資產、目前 release 分支與未簽章／未公證／Metal／Electron／跨平台實機風險，Draft PR #7 已核對為 open、draft、mergeable、base main、head codex/release-v0.47.1、未合併，且 PR body 與工作紀錄已改用 GitHub 即時 metadata 避免固定 count 過期；條件是將本輪收尾文件推送、Windows x64 check 成功並通過 docs:check:final，而本判定只涵蓋同步準備與 Draft PR，不代表 main 已合併或 GitHub 首頁已完成同步。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
