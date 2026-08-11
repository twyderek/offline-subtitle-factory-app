# 獨立審查報告：0.48.x 穩定化：供應鏈與 CI 風險盤點

- 審查對象 commit／版本：目前工作樹／`0.48.0`；本輪差異僅為 `00-CURRENT-STATUS.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`08-CHANGE-LOG.md` 的供應鏈與 CI 盤點。
- 對應 08-CHANGE-LOG 條目：2026-07-30 — 0.48.x 穩定化：供應鏈與 CI 風險盤點
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-30T15:57+08:00；由主要代理啟動的獨立審查上下文，自行執行 governance preflight、完整／production-only npm audit、dependency tree、lockfile、workflow 與受控回歸核對。
- 審查需求：`NFR-002`、`NFR-006`、`NFR-008`。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:142-146` 已區分 electron-builder 建置鏈、Electron runtime 與 CI workflow 靜態現況，沒有把 audit 總數直接等同已發布應用可利用性。
  - `docs/project-management/08-CHANGE-LOG.md:55-61` 設定成功條件、不在範圍、依賴升級風險與驗證計畫；未擅自修改 package／lockfile／workflow 或發布。
  - 但 `docs/project-management/00-CURRENT-STATUS.md:37` 仍寫 runtime／build-only「尚待區分」，與第 39 行及 06 已完成的分類矛盾，需移除或改為已分類但未修復。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - 2026-07-30T15:58+08:00 執行 `npm audit --json`，結果為 14 packages：13 high、1 critical、總依賴 418；critical 來自 `tar`，direct high 包含 Electron 與 electron-builder，與文件總數及主要路徑一致。
  - 受控執行 `npm audit --omit=dev --json` 結果為 0 vulnerabilities；`package.json:34-37` 顯示直接 production dependency 只有 `busboy`，`npm ls --omit=dev --all` 顯示其唯一 transitive dependency 為 `streamsearch`。因此「npm production tree 本次無 advisory」有直接證據。
  - Electron 雖列為 devDependency，卻是封裝應用 runtime；文件正確沒有把它歸為 build-only。electron-builder、app-builder-lib、node-gyp、tar、cacache 等則由建置／重建鏈引入。
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:144` 寫 `electron@33.0.0`，但 lockfile／`npm ls` 的實際版本是 33.4.11，宣告範圍才是 `^33.0.0`；應改為「locked 33.4.11（declared `^33.0.0`）」。

## 3. 邊界情況

- 判定：通過
- 證據：
  - 完整 audit 與 `--omit=dev` audit 分開執行，避免把 npm 的 dev classification直接誤當封裝 runtime classification；Electron 被額外辨識為實際 runtime。
  - audit 對 Electron 建議 43.2.0、對 electron-builder 建議 26.15.3，兩者均標為 semver major；文件要求另做 renderer／IPC／雙平台封裝與實機回歸後才升級，延後決策有相容性證據而非忽略 advisory。
  - `app-builder-lib` 的 AppImage advisory、builder-util-runtime token redirect advisory等並非全部對目前 Windows／macOS target 可達；文件保守保留供應鏈風險而未宣稱每項皆可利用，處理合理。

## 4. 程式碼品質

- 判定：通過（本輪為治理文件品質）
- 證據：
  - `git diff --name-only -- package.json package-lock.json .github/workflows` 無輸出，確認依賴宣告、lockfile 與 workflow 均未變更。
  - 三份文件將目前數字、路徑、升級版本、驗證範圍與剩餘風險集中記錄，沒有混入未授權實作。
  - `git diff --check` 通過。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-30T16:20+08:00 本審查以受控權限執行 `npm run check`，exit 0；治理、語法、資料層、AI provider／optimizer、UI 與核心回歸全部通過。
  - `docs/project-management/08-CHANGE-LOG.md:61` 仍把 `npm run check` 寫為待執行，與需求提供證據及本審查獨立重跑結果不一致；應同步為已通過，只保留 round1 後才可執行的 final docs check 為待執行。
  - 本輪沒有升級依賴，故不需要重新建置雙平台資產；文件正確將此要求留給後續 major upgrade 工作。

## 6. 實際運行結果

- 判定：通過
- 證據：
  - `.github/workflows/windows-preview.yml:22-31` 實際使用 `actions/checkout@v4`、`actions/setup-node@v4`、`node-version: 22` 與 `npm ci`；現行 YAML 沒有 Node 20 設定。
  - 文件沒有以 `node-version: 22` 推論 action 自身 runtime 一定不存在 Node 20 warning，而是把歷史 deprecation 警告保留為待查 CI log，結論邊界誠實。
  - lockfile 實際版本為 Electron 33.4.11、electron-builder 25.1.8；完整 audit 修復需要 major 升級，維持現狀並另開受控相容性工作是有證據的暫緩決策，但風險尚未解除。

## 綜合判定

- 結論：有條件通過
- 阻擋問題：
  1. 更新 `docs/project-management/00-CURRENT-STATUS.md:37`，不得在已完成 runtime／build-only 分類後仍寫「尚待區分」。
  2. 將 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:144` 的 Electron 版本改為 locked 33.4.11（declared `^33.0.0`），避免把宣告下限誤作實際 audit 版本。
  3. 將 `docs/project-management/08-CHANGE-LOG.md:61` 同步為受控 `npm run check` 已通過；`git diff --check` 本審查亦已確認通過，final docs check 可留待 round2 結案後執行。
- 剩餘風險：
  - Electron runtime advisory 與 electron-builder／tar 建置鏈風險尚未修復；需另開 major upgrade，完成 renderer、IPC、雙平台封裝與實機回歸。
  - `npm audit --omit=dev` 為 0 不代表已封裝 Electron runtime 安全，因 Electron 被宣告為 devDependency但實際成為應用 runtime。
  - workflow YAML 只證明 job 使用 Node 22，不能取代 GitHub Actions action-runtime warning 的歷史／近期 run log 核對。
  - 後續受控升級應明列 owner、目標版本／時程、雙平台驗收與無法立即修復時的補救措施。
- 給主要開發代理的具體修正要求：依三項阻擋修正文句與最終測試狀態，不修改依賴或 workflow；建立 round2 最小複審。

**本輪「2026-07-30 — 0.48.x 穩定化：供應鏈與 CI 風險盤點」round1 獨立審查結論為有條件通過：完整 `npm audit --json` 的 13 high／1 critical、production-only audit 0、直接 production dependency `busboy`、Electron 33 runtime 與 electron-builder 25／tar 建置鏈分界，以及 workflow 的 `actions/setup-node@v4`／Node 22 均有 dependency tree、lockfile與 YAML 證據；Electron 43.2.0 與 electron-builder 26.15.3 都是需雙平台回歸的 major 升級，故本輪不改 package／lockfile／workflow 的決策具合理依據，文件亦未把 audit 數字誤稱全部可利用；但 00 仍保留「尚待區分」舊句、06 把 locked Electron 33.4.11 誤寫為 33.0.0、08 仍把已通過的受控 `npm run check` 寫成待執行，修正三處治理不一致後方可結案。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前已確認目標路徑不存在，未覆寫既有審查報告。
- 若上述聲明不實，本報告無效。
