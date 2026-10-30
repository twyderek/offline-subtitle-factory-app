# 獨立審查報告：FR-021 current-source packaged UI Seatbelt offline replay next stage

- 審查對象 commit／版本：worktree `codex/0.51-anthropic-claude`、package version `0.52.0`；本輪以目前工作樹與 2026-10-29 evidence 為準，未以 commit clean state 取代現況。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — current-source packaged UI Seatbelt offline replay next stage（`FR-021-REPLAY-20261029-UI-OFFLINE-REPLAY-NEXT1`）。
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-29 12:22 +0800；本報告在獨立審查上下文建立，僅讀取目前 source／evidence／治理文件並執行唯讀驗證。

## 1. 需求完整性

- 判定：部分通過
- 證據：工作條目與 `docs/project-management/00-CURRENT-STATUS.md:3-7`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-7`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-7` 一致記錄 bounded macOS arm64 Seatbelt replay 的實際結果：next1／next2 均在 `electron_start` 以 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`SIGTRAP` 結束，未進入 home／AI flow；文件也明確把 next1 的 0644 原件降級為歷史 first-run，將 next2 0600 作為 authoritative record。技術需求與範圍有被完整記錄，但最新 `docs/project-management/08-CHANGE-LOG.md:3-18` 仍為「進行中」，尚未加入本輪報告路徑、逐字結論、條件接受、`獨立審查是否執行：`、`發布授權：` 等 final closeout 欄位。

## 2. 邏輯正確性

- 判定：通過
- 證據：`docs/project-management/evidence/2026-10-29-fr-021-ui-offline-replay-next1.json:20-35,37-40,90-104,143-163` 與 next2 對應欄位顯示 provider 為 Ollama、model 為 `llama3.2:3b`、status 為 `fail`、failure stage 為 `electron_start`、failure code 為 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`；Seatbelt loopback allowed、external socket `EPERM`、daemon／Electron process tree sandbox inheritance、preinstalled model 與 `modelDownloadAttempted=false` 均有實際欄位。`scripts/verify-electron-ollama-ui-offline.mjs:300-307` 對 nested Chromium sandbox diagnostic 以固定 failure boundary fail-closed；`ui.homeDashboardLoaded=false`、job／save 未產生成功結果，沒有把啟動失敗誤標成 packaged UI pass。

## 3. 邊界情況

- 判定：通過
- 證據：兩份 evidence 的 `scope` 均為 `systemNetworkDisabled=false`、`apiKeySupplied=false`、`externalProviderUsed=false`、LM Studio 未執行、Windows deferred（next1 `:157-163`、next2 同欄位）；`isolation.externalSocketError="EPERM"` 且 `loopbackAllowed=true`，因此清楚區分受控 loopback／Seatbelt deny 與全機斷網。兩份 evidence 的 `cleanup` 均確認 UI runner／daemon stopped、process group absent／closed、daemon port closed、temporary root removed；next2 的 `mode=0600` 及 SHA-256 `63c9ece60a2b6ce5c5021293a556332cc695eecbbf8eb863be210ae3ddd793c8` 由唯讀 `stat`／`shasum` 重算一致。next1 的 `mode=0644` 是已揭露且未被冒充 authoritative privacy record 的歷史原件，不應被當成 next2 的替代品。

## 4. 程式碼品質

- 判定：通過
- 證據：`scripts/verify-electron-ollama-ui-offline.mjs:536-540` 使用 `flag: 'wx'` 與 `mode: 0o600`，同時保留既有 evidence 不覆寫的 exclusive-create 語意；`scripts/test-ollama-ui-offline.mjs:305-307` 對 `wx`／0600／system-network boundary 有 focused source regression。wrapper 的 runner provenance 透過 shared `projectRunnerProvenance` 投影，evidence 只保存固定分類、digest／bytes 與去敏 argv，next1／next2 也沒有保存 candidate 絕對路徑或 raw child output（`rawChildOutputPersisted=false`）。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：本輪唯讀執行 `npm run check`，exit 0，包含治理檢查、全套 syntax check、`npm test`、offline UI contract、macOS signing／canary deterministic tests 與 YouTube posttest；另執行 `node scripts/test-ollama-ui-offline.mjs`（exit 0，輸出 `Ollama offline packaged UI contract test passed`）、`node scripts/test-project-docs-validator.mjs`（exit 0）及 `git diff --check`（exit 0）。focused test 主要以 source assertions／fixture 驗證 0600 hardening 與 failure/privacy boundary，沒有另以 synthetic temporary evidence file 直接重測 `wx` 失敗與實際 POSIX mode；但 next2 現存 evidence 的唯讀 `stat` 已補足本次 authoritative runtime mode 證據，故此為非阻擋的 coverage residual。

## 6. 實際運行結果

- 判定：部分通過
- 證據：唯讀讀取的 next1／next2 是既有 macOS arm64 current packaged candidate replay 的實際結果；兩次均在 `electron_start` 以 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`SIGTRAP` fail-closed，`homeDashboardLoaded=false`，沒有 packaged UI／AI flow pass。next1 SHA-256 為 `be18b9b62145ab71307cf56d55f83c8c9503ce231888ec34e5aa3d2f65318f05`、mode 0644；next2 SHA-256 為 `63c9ece60a2b6ce5c5021293a556332cc695eecbbf8eb863be210ae3ddd793c8`、mode 0600；兩份內容除 timestamp／elapsed、DevTools port 與 bounded child-output digest 外，failure／scope／cleanup 語意一致。依本輪明確限制，審查期間沒有重跑 replay、啟動 packaged app、執行 builder／signing／notarization 或修改 OS network；`npm run docs:check:final` 只讀執行但 exit 1，輸出缺少 `獨立審查是否執行：`、`發布授權：` 且最新工作紀錄仍未標示「完成」。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 `FR-021-REPLAY-20261029-UI-OFFLINE-REPLAY-NEXT1` round1 bounded failure contract 有條件通過：next2 以 exclusive owner-only 0600 evidence、可核對 SHA-256、Seatbelt loopback／external EPERM、preinstalled model／no-download、privacy／cleanup／scope 與 CHROMIUM_CHILD_SANDBOX_INIT_FAILED failure boundary 如實成立，focused／full deterministic checks、docs validator 與 git diff check 均通過；但 08 最新條目仍為「進行中」且缺少 round1 報告引用、獨立審查是否執行與發布授權欄位，致 npm run docs:check:final 失敗，故不得宣稱 packaged UI pass、全機斷網、signed package、Windows 或 FR-021 overall 完成，主要代理須完成治理 closeout 後才能結案。**
- 阻擋問題（若有）：F-01（治理 closeout）：主要代理須在 `docs/project-management/08-CHANGE-LOG.md` 最新條目補入本報告路徑、完整逐字引用本報告的結論句、條件接受／範圍、`獨立審查是否執行：是`、`發布授權：不適用` 與遺留風險，將狀態改為「完成」，再重跑 `npm run docs:check:final`；在此之前不得宣稱本 work item 已完成。
- 剩餘風險：next2 只證明 macOS arm64、既有 candidate、`llama3.2:3b`、Seatbelt loopback-only 的 bounded failure；不證明 packaged UI pass、renderer 可用、全機斷網、signed／hardened package、effective entitlements、notarization、Windows、LM Studio 或 FR-021 overall。外部 signing identity／credential blocker 與 `systemNetworkDisabled=false` 仍須保留。
- 給主要開發代理的具體修正要求（若有）：不修改 next1／next2 evidence 或本報告；只補 08 的 round1 review path／逐字引用／condition acceptance／發布授權與 final closeout 欄位，完成後執行 `npm run docs:check:final`，並將開發驗證、獨立審查結論與剩餘風險分開交付。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
