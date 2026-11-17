# Windows CI Actions Node.js 20 deprecation warning 收斂 round1

審查範圍：最新工作樹 diff、`AGENTS.md`、`.github/workflows/windows-preview.yml`、`docs/project-management/08-CHANGE-LOG.md` 最新工作條目，以及必要測試／治理檢查。

本輪只執行讀取、YAML／syntax／focused／diff／文件驗證；未修改產品 runtime、npm dependencies、公開 v0.51.0 Release 或 Windows 實機範圍，未推送、未建立 tag／Release。`actionlint` 在本機不可用；Windows runner 尚未以本輪 workflow commit 重跑，因此不宣稱 warning 已消失、CI 已恢復或 Windows 實機完成。

## Findings

- F-001｜嚴重度：中（發布／CI 證據缺口，非 workflow diff 實作阻擋）｜位置：`.github/workflows/windows-preview.yml:22,25,128`、`docs/project-management/08-CHANGE-LOG.md:6,15`。本輪 action major 版本更新尚未由 Windows runner 執行，故無法確認 Node.js 20 deprecation annotation 是否已消失，也無法確認 upload-artifact v6 與完整 Windows job 仍成功。
- F-002｜嚴重度：低（工具可用性限制，非 workflow 實作阻擋）｜位置：`.github/workflows/windows-preview.yml`。本機沒有 `actionlint`；已改用 `js-yaml` 解析 workflow、明確斷言三個 action ref、Node 22、job 結構及 `git diff --check`。此替代檢查不能完全取代 actionlint 的 GitHub Actions 語意 lint。
- 阻擋問題總結：未發現本輪 workflow diff 的產品、Release 或範圍外變更阻擋；F-001 是尚未取得本輪 Windows runner 結果的驗收缺口，F-002 是靜態 lint 工具缺口。Windows 實機安裝／renderer／轉錄品質不在本輪範圍。

## 1. 需求完整性

- 判定：部分通過
- 證據：最新 diff 只修改 `.github/workflows/windows-preview.yml` 的三個 action major：`actions/checkout@v4`→`@v5`、`actions/setup-node@v4`→`@v5`、`actions/upload-artifact@v4`→`@v6`；Node version 維持 22，workflow job、build、artifact path、permissions 與 Windows 實機範圍均未改。最新 `08-CHANGE-LOG.md` 將目標定義為收斂 Node.js 20 deprecation annotation，並明確排除產品、npm dependencies、公開 Release 與 Windows 實機；但成功條件中的 Windows preview runner 重跑尚未完成。

## 2. 邏輯正確性

- 判定：通過
- 證據：`js-yaml` 成功解析 `.github/workflows/windows-preview.yml`；唯讀 action assertion 結果為 `actions/checkout@v5`、`actions/setup-node@v5`、`actions/upload-artifact@v6`，唯一 job 為 `windows-x64`，Node version 為 `22`。`git diff --unified=0` 顯示只有三組 `uses:` 版本替換，沒有改動測試命令、打包條件、artifact 名稱／路徑或 runner `windows-2022`。v5／v6 版本選擇與本輪「從舊 Node 20 action runtime annotation 移向新 action runtime」目標一致，但是否實際消除 annotation 仍須 runner 證據。

## 3. 邊界情況

- 判定：部分通過
- 證據：workflow 仍保留 `workflow_dispatch`、branch／tag triggers、unsigned fallback、簽章條件、renderer／install lifecycle、archive／SHA 與 14 天 artifact retention；本輪沒有觸碰這些行為。已明確保留 actionlint 不可用、Windows runner 未重跑、Windows 實機未驗收、Authenticode／真實品質與公開 Release 不受本輪影響等限制。action major upgrade 可能影響 runner runtime、artifact upload 行為或 annotation 顯示，這些只能由本輪 commit 的 Actions run 覆蓋，尚未取得。

## 4. 程式碼品質

- 判定：通過
- 證據：本輪 workflow 變更最小且一致，三個相關官方 action 版本同步升級，Node 22 與既有 job 邏輯保持不變；`git diff --name-only` 僅包含 `.github/workflows/windows-preview.yml` 與最新 `08-CHANGE-LOG.md`，沒有產品程式、Release notes、封裝、依賴或 Windows 資產變更。`git diff --check` 通過，未發現 whitespace／patch 結構問題。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：本輪實際執行命令與結果如下：
  - `npm run project:preflight -- --type=development`：通過，確認版本 0.51.0、branch 與 dirty worktree，並列出 development 路由。
  - `js-yaml` workflow parse／action version assertion：通過，`yamlParsed=true`、三個 action ref 正確、Node version 22、`windows-x64` job 存在。
  - `node scripts/test-breeze-asr.mjs`：通過，Breeze focused test 輸出通過訊息。
  - `node --check scripts/test-breeze-asr.mjs`、`node --check scripts/project-preflight.mjs`：均通過。
  - `npm run docs:check`：通過，治理文件 19 個、版本 0.51.0。
  - `git diff --check`：通過。
  - `actionlint .github/workflows/windows-preview.yml`：未執行成功，因本機 `actionlint` 不可用。
  - `npm run docs:check:final`：失敗；最新 `08-CHANGE-LOG.md` 仍為「進行中」，且尚未掛載本報告與逐字引用。
  - 未執行：完整 `npm run check`、build、Windows Actions runner 重跑、Windows 實機驗收與長時間測試。

## 6. 實際運行結果

- 判定：部分通過
- 證據：本機 YAML／action ref／syntax／focused／文件／diff 檢查均通過，且 workflow diff 沒有產品或 Release 範圍外變更；但本輪 commit 尚未觸發或重跑 Windows Actions，沒有新的 `conclusion`、Node runtime annotation 或 artifact upload 結果可供核對。最新工作條目記錄此前 Windows run `35804611051`／`35805107676` 成功但仍出現舊 v4 action 的 Node.js 20 deprecation annotation；那是更新前的 runner 證據，不能用來證明本輪 v5／v6 修正已消除 warning。Windows 實機驗收仍未執行。

## 綜合判定

- 結論：有條件通過
- 可逐字引用完整結論句：**本輪 Windows Actions Node.js 20 deprecation warning 收斂的 workflow diff 僅將 checkout／setup-node 升至 v5、upload-artifact 升至 v6，YAML、action 版本斷言、focused test、syntax、文件與 diff 檢查均通過，未發現產品／Release／Windows 實機範圍外變更；但 actionlint 不可用且 Windows runner 尚未以本輪 commit 重跑，因此不能宣稱 Node.js 20 warning 已消失、CI 已驗證或 Windows 實機完成。**
- 阻擋問題（若有）：無本輪 workflow 靜態實作阻擋；主要待辦是由主要代理推送本輪 workflow commit、重跑 Windows preview、核對 Node.js deprecation annotations／job conclusion／artifact upload，並完成治理 final gate。在取得該 runner 證據前，不得宣稱 warning 已消失或 Windows CI／實機完成。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
