# 獨立審查報告：FR-027 封裝候選驗收工具邊界補強

- 審查對象 commit／版本：`HEAD 299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`、`package.json` 版本 `0.51.0`；審查目前含未提交變更的工作樹，不表示這些變更已包含於該 commit。
- 對應 08-CHANGE-LOG 條目：2026-10-19 — FR-027 封裝候選驗收工具邊界補強。
- 審查輪次：round6。
- 審查代理啟動時間、上下文來源：2026-10-19 約 14:54–14:56 CST；本輪獨立複審上下文，依 development preflight 重讀專案規則、最新 08／06、round1–round5 原報告、需求／設計路由文件及目前 parser／verifier／tests；round4 final-gate schema failure 與 round5 完整報告均已讀取，未修改任何既有報告。
- 審查需求：`FR-027`、`NFR-006`；範圍限候選驗收 CLI option parsing、candidate bundle 唯讀 preflight、verifier evidence／flag 順序及其負向測試。
- 執行限制：未啟動 source、candidate 或已安裝 App；未使用 Google、Keychain、帳號或上傳；實際 candidate 僅呼叫唯讀 `validateCandidateApp`；測試暫存 fixture 均由測試清除。

## 1. 需求完整性

- 判定：通過。
- 證據：工作條目要求拒絕重複、混用、帶值／拼錯／缺值的 native target，並在 profile／Electron 啟動前驗證 candidate（`docs/project-management/08-CHANGE-LOG.md:11-16`）。目前 parser 對未知 dash option fail-closed 並拒絕額外 positional argument（`scripts/youtube-ui-cli.mjs:19-25`）；direct tests 覆蓋 `-x`、`--instaled-native`、`--sorce-native`、未知 long option 與 positional argument（`scripts/test-youtube-ui-cli.mjs:24-29`）。verifier 將 evidence path 放在 flags 前，並在建立 profile 前解析及驗證 candidate（`scripts/verify-youtube-ui.mjs:15-24`）。FR-027 真實 Google／Keychain／帳號／上傳仍屬本輪外的產品驗收範圍（`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:44-46`）。

## 2. 邏輯正確性

- 判定：通過。
- 證據：parser 以明確 supported-flags 集合接受已知旗標，拒絕任何其他以 `-` 起始的參數，並拒絕非旗標 positional arguments（`scripts/youtube-ui-cli.mjs:19-25`）；`--candidate-native=<path>` 另檢查格式與空值（同檔 `:7-17,29-32`）。verifier 先拒絕被放在 evidence 位置的 flag，再解析 `process.argv.slice(3)`、唯讀驗證 candidate，之後才建立隔離 profile（`scripts/verify-youtube-ui.mjs:15-24`）。candidate bundle 對根目錄、`Contents`、`Resources`、`app`、`MacOS` 逐層拒絕 symlink／非目錄，並檢查 package／executable 的實體檔案、realpath containment 與執行權限（`scripts/youtube-ui-cli.mjs:46-93`）。

## 3. 邊界情況

- 判定：通過。
- 證據：本人於 2026-10-19 14:56 CST 直接 probe 四個 verifier known flags，均被接受；`-x`、雙破折號 typo `--instaled-native` 與額外 positional argument 均被拒絕。focused suite 另直接覆蓋 installed／source target、candidate path、boolean `=value`、round3 typo、未知選項及 positional 輸入（`scripts/test-youtube-ui-cli.mjs:10-31`）。verifier 子程序測試以 fixture `TMPDIR` 覆蓋 `-x` 並斷言 exit 1、無 screenshot、profile 數量不變（同檔 `:97-118`）。最新新增的 option-first evidence integration case 位於 `:120-128`：以 `--source-native` 佔據 `process.argv[2]`，斷言 exit 1、錯誤為 evidence path 須先於 flags、未建立同名 `--source-native` screenshot，且未新增 `youtube-ui-smoke-*` profile。本人另外 probe 正確 evidence-first 順序搭配不存在的 candidate，驗證 candidate preflight 以 exit 1 結束且 evidence／profile 均未建立。round1–round3 的既存 symlink、boolean `=value`、`--instaled-native` regression 仍在目前測試中（同檔 `:21-27,90-107`）。

## 4. 程式碼品質

- 判定：通過。
- 證據：target parsing 與 candidate validation 集中於 `scripts/youtube-ui-cli.mjs`，verifier 的 evidence 順序檢查及 profile 建立次序清楚（`scripts/verify-youtube-ui.mjs:15-24`）。option 支援採白名單，未知短／長 dash option 不會靜默回落到預設 source target；錯誤路徑由固定錯誤訊息 fail-closed（`scripts/youtube-ui-cli.mjs:19-25`）。focused test 使用自有 fixture root，並在 `finally` 清除（`scripts/test-youtube-ui-cli.mjs:33,129-130`）。round5 的 `-x` finding 已在目前 parser 與 direct／subprocess tests 中處理；未發現新的工具邊界 blocker。

## 5. 測試覆蓋

- 判定：通過。
- 證據：本人於 2026-10-19 14:56:06–14:56:07 CST 執行指定命令 `node --check scripts/youtube-ui-cli.mjs && node --check scripts/test-youtube-ui-cli.mjs && node --check scripts/verify-youtube-ui.mjs && node scripts/test-youtube-ui-cli.mjs`，exit 0，輸出 `YouTube UI CLI target and candidate bundle boundary tests passed.`。同日 14:56:19 CST 的直接 parser／verifier probes 亦 exit 0，涵蓋 known flags、`-x`、`--instaled-native`、額外 positional、option-first 拒絕及 evidence-first 次序。完整 `npm run check`、`npm run docs:check` 與 `git diff --check` exit 0 是主代理最新紀錄，不是 reviewer 重跑結果：08 記錄於 `docs/project-management/08-CHANGE-LOG.md:17`，06 同時記錄 round5 後新增 `-x`／option-first 子程序測試與完整回歸結果於 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:14`。`npm run docs:check:final` 仍待主代理結案前執行（08 `:36`）；round4 曾因報告缺固定 schema 欄位而 final gate exit 1，原件保留（08 `:31-32`、06 `:13`）。

## 6. 實際運行結果

- 判定：通過。
- 證據：本人於 2026-10-19 14:56:19 CST 唯讀呼叫 `validateCandidateApp("/Users/nycu/Documents/離線字幕工廠/dist/test-build-0.51.0-youtube-ui-20261019/mac-arm64/離線字幕工廠.app")`，exit 0，回傳 candidate 內 `Contents/Resources/app` 與 `Contents/MacOS/離線字幕工廠` 路徑；未啟動 candidate 或已安裝 App。option-first 子程序輸入在 verifier evidence-path guard 失敗，正確 evidence-first 加 invalid candidate 則在 bundle preflight 失敗；兩者均未建立 screenshot 或 profile。既有 candidate v2 UI replay 早於 symlink 修正，只記錄 3 秒合成影片播放曾開始，不是全長播放或本輪 UI replay（`docs/project-management/08-CHANGE-LOG.md:17`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:7,9`）。本輪未進行真實 Google／Keychain／帳號／上傳、安裝後、Windows、Developer ID 或 notarization 驗收。

## 綜合判定

- 結論：通過
- 可逐字引用的完整結論句：**本輪 FR-027 封裝候選驗收工具邊界補強 round6 獨立複審結論為通過：round1 的 bundle 外 symlink、round2 的 boolean `=value`、round3 的 `--instaled-native` 及 round5 的未知單破折號 `-x` 靜默忽略問題，均已由目前 parser／candidate guard 與 direct／verifier subprocess regression 覆蓋；本輪指定 syntax 與 focused suite、known／unknown／positional／evidence-order probes 及實際 candidate 唯讀 preflight 均通過，且新增的 option-first evidence 子程序案例確認 exit 1、未寫同名 screenshot、未建 profile；完整 `npm run check`、`npm run docs:check` 與 `git diff --check` 僅為主代理最新 08／06 記錄，本 reviewer 未重跑，`npm run docs:check:final` 仍待主代理結案前完成；candidate v2 UI replay 早於 symlink 修正且只證明播放曾開始，本結論僅適用於驗收工具邊界，不代表 FR-027 真實 Google／Keychain／帳號／上傳或安裝後驗收完成。**
- 阻擋問題（若有）：無，限本輪候選驗收工具邊界。
- 剩餘風險：`npm run docs:check:final` 尚未執行；`npm run check`、`npm run docs:check`、`git diff --check` 的 exit 0 僅引用主代理最新紀錄。candidate v2 UI replay 早於 symlink 修正，且只證明播放曾開始，並非全長播放或本輪 replay。真實 Google／Keychain／帳號／頻道上傳、DMG／ZIP 安裝後、Developer ID／公證與 Windows 驗收均未涵蓋；round4 schema failure 原件保留且未被本輪覆寫。
- 給主要開發代理的具體修正要求（若有）：無新增程式修正要求；結案前由主代理依流程完成 `npm run docs:check:final` 並更新工作紀錄。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
