# 獨立審查報告：FR-027 封裝候選驗收工具邊界補強

- 審查對象 commit／版本：`HEAD 299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`、`package.json` 版本 `0.51.0`；本輪審查的是含未提交變更的目前工作樹，不表示該 commit 包含這些變更。
- 對應 08-CHANGE-LOG 條目：2026-10-19 — FR-027 封裝候選驗收工具邊界補強。
- 審查輪次：round2。
- 審查代理啟動時間、上下文來源：2026-10-19 14:08 CST；本輪獨立複審上下文，自行重讀 `AGENTS.md`、governance preflight 指定文件、最新 08／06 條目、round1 報告、工具程式、負向測試、v2 evidence 與目前工作樹；未沿用主要代理對修正的評價性結論。
- 審查需求：FR-027、NFR-006、NFR-007；範圍限驗收 CLI／fixture evidence 與測試，不代表產品端真實上傳驗收。
- 執行範圍：唯讀檢查、focused suite、parser probe、既有候選 `validateCandidateApp` 唯讀 preflight；未啟動 candidate／已安裝 App，未使用真實 Google、Keychain、帳號或上傳。

## 1. 需求完整性

- 判定：部分通過。
- 證據：`docs/project-management/08-CHANGE-LOG.md:11-17` 要求 native target 重複／混用／缺值輸入拒絕、candidate bundle 結構驗證、錯誤時在建立 profile／啟動 Electron 前失敗，以及 renderer fixture 12 案結果持久化。round1 指出的中介目錄 symlink 外逸已由逐層目錄檢查、package／executable realpath containment 及三種負向案例處理（`scripts/youtube-ui-cli.mjs:56-83`、`scripts/test-youtube-ui-cli.mjs:39-95`）。但 parser 對 `--installed-native=<value>` 與 `--source-native=<value>` 未拒絕；本人於 2026-10-19 14:07 CST 直接呼叫 `parseNativeTarget`，兩者都回傳 `{nativeVersion:null,candidateAppPath:null}`。其中 `--installed-native=typo` 會令 verifier 選到預設 source Electron（`scripts/verify-youtube-ui.mjs:41-46`），未滿足錯誤 target fail-closed 的目標。v2 evidence 的 12 案持久化符合記錄，但產生時間早於 symlink 修正，不能代表修正後 UI replay。

## 2. 邏輯正確性

- 判定：部分通過。
- 證據：`scripts/youtube-ui-cli.mjs:60-83` 逐層以 `lstat` 要求 `.app/Contents`、`Contents/Resources`、`Contents/Resources/app`、`Contents/MacOS` 為實體目錄；package 與 executable 須為一般檔案，並以 `realpath`／`path.relative` 限制在 bundle 根目錄內。round1 所述 `Contents` 外連結因這些檢查會在 validator 中拒絕。verifier 在 `scripts/verify-youtube-ui.mjs:17-23` 解析並驗證 target，之後才建立暫存 profile（`:23-40`）及 spawn Electron（`:41-47`）；目前 symlink case 因 validator 拋出指定結構錯誤，會在三項副作用之前退出。相對地，`parseNativeTarget` 只以完整字串計數 source／installed flag（`scripts/youtube-ui-cli.mjs:5-7`），沒有拒絕它們帶 `=value` 的形式；focused suite 也未涵蓋這兩種變體（`scripts/test-youtube-ui-cli.mjs:13-22`）。

## 3. 邊界情況

- 判定：部分通過。
- 證據：focused suite 建立外部 bundle fixture，分別讓 `Contents`、`Contents/Resources`、`Contents/MacOS` 指向外部目錄；直接 validator 在 `scripts/test-youtube-ui-cli.mjs:73-79` 拒絕，verifier 子程序在 `:81-95` 要求 exit 1、匹配 symlink 結構錯誤且 screenshot／evidence 不存在。這些測試涵蓋 round1 的外逸路徑；程式亦對 `Contents/Resources/app` 執行相同目錄檢查（`youtube-ui-cli.mjs:60-63`），但目前沒有該第四個目錄的獨立 symlink fixture。子程序測試直接檢查錯誤、exit status 與 evidence 不存在；profile 未建立及 candidate executable 未啟動，另由現行驗證順序（`verify-youtube-ui.mjs:17-23,41-47`）確認，測試沒有額外以 profile 計數或 executable spawn marker 作執行期斷言。parser 的 `--installed-native=typo`／`--source-native=typo` 變體為未覆蓋且可重現的邊界缺陷。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：target parser／bundle validator 集中在 `scripts/youtube-ui-cli.mjs`，而 verifier 在任何 profile 建立前執行它們，責任邊界清楚。逐層 `lstat` 與 realpath containment 修正了 round1 可實測的越界解析。parser 對 candidate 類旗標會檢查 `--candidate-native` 格式（`:7-13`），但 source／installed boolean flags 沒有相同的 malformed-argument 防護；這個不對稱使格式錯誤的 installed target 靜默落到 source runtime，需修正後才能保證 selector 行為可預期。工具變更未涉及產品 runtime。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：本人於 2026-10-19 14:07:13 CST 執行 `node scripts/test-youtube-ui-cli.mjs`，exit 0，輸出 `YouTube UI CLI target and candidate bundle boundary tests passed.`。該 suite 已納入 `npm test`（`package.json:31`），但沒有測試 `--installed-native=<value>`／`--source-native=<value>` 應報錯，也沒有直接 profile／spawn sentinel 斷言。v2 JSON 已保存 `rendererStateFixture.passed=true`、12 個 case names、`videoStarts=1`、`realGoogleRequests=false`（`docs/project-management/evidence/2026-10-19-packaged-youtube-ui-v2.png.json:221-239`）；fixture source 回傳同一完整 12-case 清單（`scripts/youtube-ui-state-fixture.mjs:117-119`）。依 08／06 最新記錄，symlink 修正後 `node --check`、focused suite 與完整 `npm run check` 均由主要代理記錄為 exit 0（`08-CHANGE-LOG.md:17`、`06-TEST-AND-PROCESS-AUDIT.md:9-10`）；本審查沒有重跑完整 `npm run check`，該結果不記為 reviewer 執行。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：本人於 2026-10-19 14:08:20 CST 對既有實際候選 `/Users/nycu/Documents/離線字幕工廠/dist/test-build-0.51.0-youtube-ui-20261019/mac-arm64/離線字幕工廠.app` 執行唯讀 `validateCandidateApp` preflight，exit 0，回傳 bundle 內 `Contents/Resources/app` 與 `Contents/MacOS/離線字幕工廠` 路徑；沒有啟動 App（主要代理同項更新記於 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:10`、`docs/project-management/08-CHANGE-LOG.md:17`）。這與較早的 v2 candidate UI replay 分開：v2 usability／comparison／cleanup JSON 修改時間為 2026-10-19 13:59:49–13:59:58 CST，記錄 0.51.0 candidate、播放曾開始、保存／重載／還原任務、12-case fixture，以及 process group 關閉與 profile 移除（`2026-10-19-packaged-youtube-ui-v2.png.comparison.json:187-205`、`.json:214-239`、`.cleanup.json:2-6`）。最新 06／08 工作記錄明確限定 v2 的 3 秒合成影片只證明 playback 曾開始、不是全長播放驗收（`06-TEST-AND-PROCESS-AUDIT.md:7`、`08-CHANGE-LOG.md:17`）；JSON 的 `currentTime=0.000458`（usability JSON `:214-217`）亦相符。該 replay 早於 symlink 修正且本輪未重播。修正後 preflight 只證明目前 validator 接受該既有 bundle 的結構，不是新 UI replay 或 app 啟動驗證。完整 `npm run check` exit 0 是 08／06 記載的主要代理結果（`08-CHANGE-LOG.md:17`、`06-TEST-AND-PROCESS-AUDIT.md:9`），本人未重跑。未執行真實 Google／Keychain／帳號／上傳，亦未進行 DMG／ZIP 安裝或 Windows 驗收。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪 FR-027 封裝候選驗收工具邊界補強 round2 複審不通過：round1 發現的中介目錄 symlink 越界已由逐層 lstat、realpath containment 與三組 direct／verifier 負向測試解除，修正後 focused suite 與既有候選唯讀 preflight 通過；但 `--installed-native=<value>`／`--source-native=<value>` 仍被靜默忽略，且 `--installed-native=typo` 會使 verifier 回退啟動 source Electron，違反錯誤 target fail-closed 要求，故修正旗標解析並加入回歸測試前不得結案；此判定不代表 FR-027 真實 Google／Keychain 上傳已驗收。**
- 阻擋問題（若有）：錯誤的 boolean target assignment 沒有被拒絕。於 2026-10-19 14:07 CST 的 parser probe 中，`--installed-native=typo` 與 `--source-native=typo` 均解析成無 target；verifier 對無 target 使用 source Electron（`scripts/verify-youtube-ui.mjs:41-46`）。這可能令原本要求 installed runtime 的命令啟動 source runtime，且沒有 fail-closed 錯誤。
- 剩餘風險：新增 direct／verifier symlink 測試已解決 round1 阻擋，但 app-root (`Contents/Resources/app`) symlink 尚無獨立 fixture；測試未以 profile／spawn sentinel 直接觀察無副作用，現行 source 順序則確認驗證失敗早於兩者。v2 UI replay 是 symlink 修正前證據，本輪未重播；修正後的實際 bundle preflight 是唯讀結構檢查，不代表 UI replay。完整 `npm run check` 引自主要代理 08／06 記錄，reviewer 未重跑。真實 Google／Keychain／帳號／上傳、安裝後與 Windows 驗收仍不在本工作範圍；08 最新條目仍為進行中，final gate 尚待完成。
- 給主要開發代理的具體修正要求（若有）：在 `parseNativeTarget` 明確拒絕 `--installed-native=` 與 `--source-native=` 形式（包括空值與非空值），並於 `scripts/test-youtube-ui-cli.mjs` 加入 parser 負向回歸，確認錯誤不會靜默回退至 source target。建議另補 app-root symlink fixture，並讓 verifier 子程序測試直接確認 profile 未建立、candidate executable 未執行，以固定 fail-before-side-effect 契約；完成後重跑 focused suite、完整回歸及文件 final gate，再依新證據複審。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
