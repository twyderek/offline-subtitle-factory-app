# 獨立審查報告：FR-027 封裝候選驗收工具邊界補強

- 審查對象 commit／版本：`HEAD 299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`、`package.json` 版本 `0.51.0`；目標 CLI 與測試檔在目前工作樹為未追蹤檔案，審查對象是目前工作樹內容。
- 對應 08-CHANGE-LOG 條目：2026-10-19 — FR-027 封裝候選驗收工具邊界補強。
- 審查輪次：round4。
- 審查代理啟動時間、上下文來源：2026-10-19 14:26–14:42 CST；本輪獨立複審上下文，依 development preflight 重讀核心及 development／test／review／closeout 路由文件、最新 08／06、round1–round3 報告、parser／validator／tests、package registration 與 v2 evidence。
- 審查需求：FR-027、NFR-006；範圍限候選驗收 CLI、candidate bundle preflight 與其測試邊界。
- 執行限制：未啟動 candidate 或已安裝 App，未使用 Google、Keychain、帳號或上傳；僅執行讀取、CLI 測試／probe 與唯讀 candidate preflight。

## 1. 需求完整性

- 判定：通過。
- 證據：`docs/project-management/08-CHANGE-LOG.md:11-17` 將本工作定為拒絕重複、混用、帶值、拼錯及缺值的 native target，並要求 candidate 結構檢查在建立 profile／啟動 Electron 前完成。`scripts/youtube-ui-cli.mjs:4-35` 對 target 選項作解析及明確白名單拒絕；`scripts/test-youtube-ui-cli.mjs:10-29` 覆蓋正常選項、重複／混用／帶值、近似拼字及未知選項。FR-027 真實 Google／Keychain／上傳是產品需求（`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:44-46`），不在本輪 CLI 邊界驗收範圍。

## 2. 邏輯正確性

- 判定：通過。
- 證據：`scripts/youtube-ui-cli.mjs:19-35` 僅接受 verifier 支援的 `--installed-native`、`--source-native`、`--candidate-native=<...>`、`--validate-usability`、`--usability`、`--compare-installed`、`--validate-layout`；其他 `--...` 會拋出 `Unknown command-line option.`。`scripts/youtube-ui-cli.mjs:61-93` 以 `lstat` 檢查 bundle 與必要中介目錄、確認 package／executable 為一般檔案、以 realpath 限制在 bundle 內並檢查 executable 權限。`scripts/verify-youtube-ui.mjs:17-23,41-47` 顯示 target 解析與 candidate 驗證先於 profile 建立及 app spawn。

## 3. 邊界情況

- 判定：通過。
- 證據：本人於 2026-10-19 14:26 CST 直接 probe `parseNativeTarget` 共 18 組，全部符合預期：有效 source／installed／candidate 與四個已知 verifier flags 接受；重複 target、source／installed 或 candidate／source 混用、boolean 帶值、candidate 空值／bare flag、`--instaled-native`、`--sorce-native`、`--not-a-supported-option` 及已知 flag 帶值均拒絕。測試亦以四層中介目錄 symlink fixture 驗證拒絕（`scripts/test-youtube-ui-cli.mjs:46-91`）。verifier 子程序案例包含兩種拼錯 target，透過 fixture `TMPDIR` 驗證 exit 1、無 screenshot 且沒有新增 `youtube-ui-smoke-*` profile（同檔 `:94-115`）；`--instaled-native`／`--sorce-native` 走未知 option 拒絕分支，直接 parser 測試另包含通用 `--unrecognized-option`（`:24-26`）。

## 4. 程式碼品質

- 判定：通過。
- 證據：target parser 與 candidate validator 集中於 `scripts/youtube-ui-cli.mjs`，驗證責任清楚；supported option allowlist 與 candidate 結構檢查分別在同檔 `:19-23`、`:61-93`。負向測試以 `try/finally` 清除自有暫存 fixture（`scripts/test-youtube-ui-cli.mjs:117-119`）。未發現本輪範圍內的新邏輯缺陷。

## 5. 測試覆蓋

- 判定：通過。
- 證據：本人於 2026-10-19 14:26 CST 執行 `node --check scripts/youtube-ui-cli.mjs && node --check scripts/test-youtube-ui-cli.mjs && node scripts/test-youtube-ui-cli.mjs`，exit 0，輸出 `YouTube UI CLI target and candidate bundle boundary tests passed.`。同時完成前節 18 組直接 parser probes，均通過。focused suite 已列入 `package.json:31` 的 `npm test`，而 `npm run check` 執行 `npm test`（`package.json:32`）。完整 `npm run check` 與 `git diff --check` 本人未重跑；最新主代理結果記於 `docs/project-management/08-CHANGE-LOG.md:17`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:12`，兩者均記錄 exit 0，這是引用主代理結果而非 reviewer 執行結果。`npm run docs:check:final` 亦未由本人執行，最新 08 仍列 final gate 待完成（`:17,29`）。

## 6. 實際運行結果

- 判定：通過。
- 證據：本人於 2026-10-19 14:26 CST 唯讀呼叫 `validateCandidateApp("/Users/nycu/Documents/離線字幕工廠/dist/test-build-0.51.0-youtube-ui-20261019/mac-arm64/離線字幕工廠.app")`，exit 0，回傳 bundle 內 `Contents/Resources/app` 與 `Contents/MacOS/離線字幕工廠`；未啟動 App。既有 v2 evidence 時間為 2026-10-19 13:59:49–13:59:58 CST，早於 round1 在 14:02:37 CST 發現 symlink 外逸（round1 報告 `:18`；檔案 mtime 可由 evidence 與 round1 報告確認），故僅是 symlink 修正前的 UI smoke evidence，並非本輪 UI replay。v2 記錄 12 個 renderer state cases 通過且 `realGoogleRequests=false`（`2026-10-19-packaged-youtube-ui-v2.png.json:221-239`）；3 秒媒體記錄 `currentTime=0.000458`、`paused=true`（同檔 `:214-218`），只支持曾開始播放，不是全長播放驗收。清理 evidence 記錄 process group 關閉、未強制清理、profile 已移除（`.cleanup.json:2-6`）。

## 綜合判定

- 結論：通過
- 可逐字引用的完整結論句：**本輪 FR-027 封裝候選驗收工具邊界補強 round4 獨立複審結論為通過：round1 的 bundle 外 symlink 外逸、round2 的 `--installed-native=<value>`／`--source-native=<value>` 靜默忽略，以及 round3 的 `--instaled-native` 靜默回退，均已由目前逐層 candidate 結構驗證、明確 option allowlist、focused direct／subprocess 測試及本輪 parser probes 排除；本輪 focused suite exit 0，唯讀實際 candidate preflight 成功，未發現新的阻擋問題；完整 `npm run check` 與 `git diff --check` 僅引用主代理最新紀錄，本 reviewer 未重跑，candidate v2 UI replay 為 symlink 修正前的較早 evidence，3 秒媒體僅記錄播放曾開始而非全長播放或本輪 UI replay；本結論僅適用於候選驗收工具邊界，不代表 FR-027 真實 Google／Keychain／帳號／上傳或安裝後驗收完成。**
- 阻擋問題：無。
- 剩餘風險：完整 `npm run check`、`git diff --check` 及 `npm run docs:check:final` 未由 reviewer 重跑；前兩項 exit 0 是主代理於最新 08／06 的紀錄，final gate 仍待主代理完成。v2 UI replay 早於 symlink 修正且非全長 playback；本輪未啟動 UI。真實 Google／Keychain／帳號／上傳、DMG／ZIP 安裝後與 Windows 驗收仍不在本輪範圍。
- 給主要開發代理的具體修正要求：無新增程式修正要求；結案前依既定 closeout 流程完成 `npm run docs:check:final` 並更新工作紀錄。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
