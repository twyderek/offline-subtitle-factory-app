# 獨立審查報告：FR-027 封裝候選驗收工具邊界補強

- 審查對象 commit／版本：`HEAD 299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`、`package.json` 版本 `0.51.0`；審查目前含未提交變更的工作樹，不表示這些變更已包含於該 commit。
- 對應 08-CHANGE-LOG 條目：2026-10-19 — FR-027 封裝候選驗收工具邊界補強。
- 審查輪次：round5。
- 審查代理啟動時間、上下文來源：2026-10-19 14:49–14:51 CST；本輪新啟動的獨立審查上下文，依專案治理文件、最新 08／06、round1–round4 原報告、目前程式／測試／evidence 與本輪指令輸出自行核查。
- 審查需求：`FR-027`、`NFR-006`；範圍限驗收 CLI option allowlist、候選 bundle 結構 guard、錯誤副作用邊界及 12 案 fixture JSON 持久化。
- 執行限制：未啟動 source、candidate 或已安裝 App；未使用 Google、Keychain、帳號或上傳；對實際 candidate 僅作唯讀 preflight，額外 symlink fixture 建於系統暫存目錄並於指令結束清除。

## 1. 需求完整性

- 判定：部分通過。
- 證據：工作紀錄列明 native target 重複／混用／帶值／拼錯／缺值須拒絕，錯誤須在建立 profile 或啟動 Electron 前退出，並將 renderer fixture 12 案結果保存於 usability JSON（`docs/project-management/08-CHANGE-LOG.md:11-17`）。目前明確支援的 source、installed、candidate target 與 verifier flags 均可解析，雙破折號拼錯及未知 option 會拒絕；但本輪直接 probe `parseNativeTarget(["-x"])` 得到 `{ nativeVersion: null, candidateAppPath: null }`，未知單破折號 option 被靜默忽略，不符合未知 option 一律 fail-closed 的工作目標。FR-027 真實 Google／Keychain／上傳驗收不在本輪範圍（`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:44-46`）。

## 2. 邏輯正確性

- 判定：部分通過。
- 證據：`scripts/youtube-ui-cli.mjs:19-24` 以明確集合拒絕未知選項，但條件只檢查 `arg.startsWith('--')`；因此 `-x` 通過解析並落入無 target 預設值。依 `scripts/verify-youtube-ui.mjs:15-23,41-47`，解析後無 target 會先建立暫存 profile，接著選擇 source Electron；本輪沒有啟動 App，這項後續行為是由控制流判讀，未作動態啟動驗證。其餘 parser 行為符合預期：完整 `--source-native`／`--installed-native`／`--candidate-native=<path>` 可用，重複／混用 target、boolean 帶值、candidate 空值、`--instaled-native`、`--sorce-native`、`--unknown-option` 及已知 boolean flag 帶值均拒絕。

## 3. 邊界情況

- 判定：部分通過。
- 證據：本輪 probes 覆蓋正常 source／installed／candidate target、全部四個 verifier 支援 flags、重複與混用 target、`--installed-native=value`、空 candidate 值、兩個指定拼錯旗標、一般未知 long option、已知 flag 帶值及 `-x`；除 `-x` 外，以上負向情況均拒絕。`node scripts/test-youtube-ui-cli.mjs` 亦直接／子程序驗證 `Contents`、`Contents/Resources`、`Contents/Resources/app`、`Contents/MacOS` 四層 symlink 失敗。額外暫存 fixture 探測確認 `.app` 根 symlink、`package.json` symlink、主 executable symlink 均拒絕。程式逐層 `lstat` 目錄及檔案，並對 package／executable 執行 realpath containment（`scripts/youtube-ui-cli.mjs:46-93`）；本輪 file symlink 由較早的 `lstat` 規則拒絕，沒有直接觸發 realpath 外逸分支。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：CLI parser 與 candidate validator 分離於 `scripts/youtube-ui-cli.mjs`；candidate 根目錄、四個內部目錄、package、executable 型態／權限及 realpath containment 均有明確檢查（`scripts/youtube-ui-cli.mjs:38-93`）。verifier 在建立 profile 前執行 parser 與 candidate validation（`scripts/verify-youtube-ui.mjs:15-23`）。但 option allowlist 僅涵蓋以 `--` 開始的未知參數，留下 `-x` 這類單破折號參數靜默通過的缺口；目前不應以「未知 option 已全部拒絕」結案。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：本人於 2026-10-19 約 14:49 CST 執行 `node --check scripts/youtube-ui-cli.mjs && node --check scripts/test-youtube-ui-cli.mjs && node scripts/test-youtube-ui-cli.mjs`，exit 0，輸出 `YouTube UI CLI target and candidate bundle boundary tests passed.`。focused suite 對無效 double-dash option／target／bundle 的 verifier 子程序案例檢查 exit 1、screenshot evidence 不存在及 `youtube-ui-smoke-*` profile 數量未增加（`scripts/test-youtube-ui-cli.mjs:94-115`）；測試未含 `-x`。主代理最後完整 `npm run check` exit 0 是 08／06 紀錄（`docs/project-management/08-CHANGE-LOG.md:17`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:8-13`），本人未重跑，不列為本輪執行結果。`npm run docs:check:final` 本輪尚未重跑。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：本人對既有 candidate `/Users/nycu/Documents/離線字幕工廠/dist/test-build-0.51.0-youtube-ui-20261019/mac-arm64/離線字幕工廠.app` 執行唯讀 `validateCandidateApp` preflight，exit 0，回傳 bundle 內 `Contents/Resources/app` 與 `Contents/MacOS/離線字幕工廠`；未啟動該 candidate 或已安裝 App。既有 `docs/project-management/evidence/2026-10-19-packaged-youtube-ui-v2.png.json:221-239` 保存 `rendererStateFixture.passed=true`、完整 12 個 case、`videoStarts=1`、`realGoogleRequests=false`。但該 v2 evidence 早於 round1 symlink 修正；同一 JSON 的 `playback.duration=3`、`currentTime=0.000458`、`paused=true`（`:214-218`）只證明播放曾開始，不證明全長播放，也不是本輪 replay。主代理紀錄的完整 `npm run check` exit 0 未由本人重跑；`npm run docs:check:final` 尚未重跑。沒有真實 Google／Keychain／帳號／上傳或安裝後驗收。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪 FR-027 封裝候選驗收工具邊界補強 round5 獨立複審結論為不通過：round1–round3 的 bundle symlink 外逸、帶值 native flag 及雙破折號拼錯／未知 option 問題，在目前逐層 `lstat`／realpath guard、focused／subprocess tests 與本輪唯讀 candidate preflight 下均未重現，12 案 fixture JSON 亦持久化；但 `-x` 這類未知單破折號 option 仍被 `parseNativeTarget` 靜默接受為預設 source target，verifier 後續依現行控制流會建立 profile 並選擇 source Electron，故未知 option 尚未全數 fail-closed，須修正 parser 並補上不建立 profile／evidence 的回歸後再複審；本輪未重跑完整 `npm run check` 或 `npm run docs:check:final`，後者仍待完成；既有 candidate v2 UI evidence 早於 symlink 修正且只證明播放開始，不代表全長播放或本輪 replay；本結論僅限候選驗收工具邊界，不代表 FR-027 真實 Google／Keychain／帳號／上傳或安裝後驗收完成。**
- 阻擋問題（若有）：`parseNativeTarget(["-x"])` 未拋錯，回傳 `{ nativeVersion: null, candidateAppPath: null }`。`-x` 不在支援清單卻未被拒絕，依 verifier 現行控制流會選 source Electron 並先建立 profile，違反未知 option fail-closed 及錯誤輸入無副作用要求。該 profile／App 後續結果未動態執行確認，因本輪未啟動 App。
- 剩餘風險：本輪未重跑完整 `npm run check`；exit 0 僅為主代理 08／06 紀錄。`npm run docs:check:final` 尚未重跑。v2 candidate UI／fixture evidence 早於 symlink 修正，且播放只有 3 秒合成影片的開始進度，不能證明全長播放或本輪 UI replay。真實 Google／Keychain／帳號／上傳、DMG／ZIP 安裝後、Developer ID／公證及 Windows 驗收均未覆蓋。
- 給主要開發代理的具體修正要求（若有）：讓 parser 對所有以單／雙破折號開頭、但不符合明確支援 option 或 `--candidate-native=<path>` 格式的參數 fail closed；新增 `-x` 及其他未知單破折號 option 的 direct parser regression，並用不會啟動真實 Electron 的測試 seam 驗證 verifier 在 profile／evidence 建立前退出。修正後重跑指定 focused suite、必要的完整回歸與 `npm run docs:check:final`，再由新一輪獨立報告複審。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
