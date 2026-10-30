# 獨立審查報告：FR-021 macOS Ollama UI 取消與 checkpoint 續跑驗收 round3

- 審查對象 commit／版本：HEAD `299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`／0.51.0 dirty worktree 的 round3-final 基準，非公開 `53956cc` Release。
- 對應 08-CHANGE-LOG 條目：2026-10-01 — FR-021 macOS Ollama UI 取消與 checkpoint 續跑驗收（`docs/project-management/08-CHANGE-LOG.md:3–38`）。
- 審查輪次：round3；本審查角色建立前兩輪原件後，依新差異重新複審，未沿用主要代理開發對話記憶。
- 啟動時間／上下文來源：`2026-10-01T03:27:24Z`，使用者交接的修正範圍、candidate、immutable evidence 與執行限制；自行查核原始程式、持久測試及證據。時間均為 UTC，台灣時間加八小時。
- 執行前：`npm run project:preflight -- --type=debug` exit 0；依既有已讀 AGENTS／治理入口／獨立審查／驗證／偵錯／結案規則，重讀本輪 00／03／06／07／08 內容。未新增工作條目。
- 審查計畫與完成範圍：核對 restore／cancel／相鄰錯誤 ownership → actual-function／runner／helper 持久回歸 → 完整 check／補充 syntax → candidate hash／簽章／兩份新 evidence → 六面向報告。以上均已完成。
- 基準：本報告行號指向 `03:27–03:29 UTC` 查核的 source；review.js SHA-256 `7efbe0d1cca764e015af940323725b1c8b0bc09c46e31a2a2b437375ee79c0d3`。不對後續變更或工作樹其他歷史修改作擴大背書。
- 限制：不重跑 live AI UI、不下載模型、不停止既有 daemon、不改系統網路或發布。測試執行所建立的專用 temp／owned daemon 依使用者授權驗證及清理。唯一專案寫入為本報告。
- 引用慣例：治理檔名、`evidence/`、`reviews/` 均相對 `docs/project-management/`；程式檔路徑相對 repo。

## 1. 需求完整性

- 判定：通過（本輪限定修補／正常 loopback macOS 子範圍）。
- 證據：`08-CHANGE-LOG.md:33–38`、`03-FUNCTIONAL-DESIGN.md:95–103`、`07-DEBUG-AND-FIX-HISTORY.md:3–16` 覆蓋 round2 的 restore-in-flight、superseded cancel 訊息、相鄰 request rejection 與 UTF-8 cap。`00-CURRENT-STATUS.md:14–16`、`06-TEST-AND-PROCESS-AUDIT.md:25–28` 保留 offline UI 失敗、FR-021 未整体結案、Windows 暫緩及 LM Studio 排除；未把正常 loopback 子範圍擴張為完整離線驗收。
- `2026-10-01T03:27:59Z` 起獨立完整 `npm run check`，最終 exit 0，實際執行下述 UI／runner／helper 回歸；本輪要求已有程式、可執行測試與對應治理紀錄。
- 文件整合／final gate 仍由主要代理完成；最新條目狀態「進行中」與目前實況一致。

## 2. 邏輯正確性

- 判定：通過。
- **P2-01 restore-in-flight 延伸阻擋解除：** `public/review.js:692–723` 在讀取前捕捉 generation，成功與 catch 均核對 token，過期 restore 返回 null，不改控制／Session／建議／訊息；`:748–756` 的 cancel 續行識別 superseded restore 並跳過舊取消訊息。仍屬本次取消且 restore 為 cancelled 時，正常取消訊息維持。
- actual regression：`scripts/test-review-ui.mjs:247–291` 執行 actual cancel、restore、run、poll、setAiRunning；舊 restore pending 後從 actual run 開始新任務，分別釋出成功 cancelled 或 rejection，斷言新 running controls 保留、original-session 未被改寫、訊息仍是 NEW_TASK_STATUS，釋出新 poll 後完成 new-session。已隨独立完整 check 執行通過（`03:27:59Z` 起，exit 0）。這直接對應本審查 round2 已重現的順序，不是 source regex。
- 相鄰錯誤：poll 的 rejected GET 在 `public/review.js:663–669` 先核對 active；start POST 在 `:635`、catch ownership `:639–641` 不讓被取代的 start 更新新任務。`scripts/test-review-ui.mjs:206–244,293–334` 實際執行 stale cancelled／failed／completed／network-error、superseded-start、current-start-failure、current-poll-failure。舊回應不覆蓋新 Session，現任務失敗仍有 FIXTURE_ERROR 訊息及恢復可操作控制，未因 guard 全面吞掉有效錯誤。
- generation 與 terminal failure 的 `generation+1` ownership 例外限於本次 poll 已將自身設為非 running 的情況；上述 current-poll-failure regression 已覆蓋這個分支。未發現本次差異新的邏輯阻擋。

## 3. 邊界情況

- 判定：通過（已測之受控邊界）。
- **P3-01 已解除：** `scripts/ollama-ui-local-daemon.mjs:27–32` 對原始 chunk 累計 `Buffer.byteLength`，超過 1 MiB 才 destroy，未再使用 UTF-16 字元數。`scripts/test-ollama-ui-offline.mjs:98–101` 的真實 loopback HTTP 分別送 1,100,000 ASCII 字元與 400,000 個多位元組字元的 JSON，先確認 bytes 超限，再要求 actual readTags 拒絕 `TAGS_RESPONSE_TOO_LARGE`。兩案已隨独立完整 check 通過，前輪接受超限 UTF-8 的結果不再出現。
- **P2-03 先前解除項保留：** helper `:40,74–94` 保持 absolute timer、每次 GET 限剩餘 deadline、成功後再核對期限、poll wait capped 剩餘時間。actual helper＋10ms trickle／250ms 合法 tags 的持久 fixture（`scripts/test-ollama-ui-offline.mjs:73–97`）仍要求 timeoutMs=50 時 fail closed，已執行通過。
- **P2-02 先前解除項保留：** artifact read 位於 runner 主 try（`scripts/verify-electron-ollama-ui.mjs:376–379`）；whole actual runner EACCES regression（`scripts/test-ollama-ui-offline.mjs:30–69`）確認 group cleanupCalls=1、temp removals=1、fail／artifact_preflight／EACCES、userDataRemoved=true，PRIVATE_ARTIFACT_PATH_CANARY 不入 evidence。已執行通過，catch／finally 路徑仍在（runner `:784–824`）。
- missing binary／null handle、empty-store exact-model no-download／owned cleanup（test `:107–127`）實際跑過，無 prerequisite skip；自有 process-group／port／root cleanup 與 no-cloud／no-prune 策略未擴權。
- 時間證據：上述全部持久案例由 `2026-10-01T03:27:59Z` 的 `npm run check` 執行，`03:28:35Z` 查核時已取得全部核心通過及最終 exit 0。受控 filesystem／VM seam 不宣稱涵蓋所有原生 OS 故障。

## 4. 程式碼品質

- 判定：通過。
- 證據：狀態 ownership 集中於既有 UI 模組，未改 server checkpoint／Session 格式；guard 對成功與失敗均生效，並保留現任務錯誤回報（`public/review.js:618–652,656–723,743–759`）。helper 的 byte cap／deadline 沿用原 request 與清理流程，無新增外部端點或系統權限（`scripts/ollama-ui-local-daemon.mjs:18–42,54–67,74–97`）。
- 隱私／資源策略：固定 HOME／TMPDIR、context4096、parallel1、no-cloud／no-prune、exact preinstalled model、owned process-group／port／root cleanup 仍保留；runner fixed-category catch 及 exclusive-create evidence 未刪除（runner `:784–824`）。whole-runner path canary 測試通過；新兩份 evidence 不含 raw subtitle body、API Key、token query 或候選／store 個人絕對路徑。
- 語法／格式：完整 check 已通過其所有 syntax；另 `node --check scripts/ollama-ui-local-daemon.mjs`、`node --check scripts/test-review-ui.mjs` 與 `git diff --check` 無錯誤，`2026-10-01T03:28:35Z` 同次補充檢查 exit 0。
- 未發現本輪需主要代理修正的程式碼品質問題。

## 5. 測試覆蓋

- 判定：通過（本輪差異及前輪發現）。
- **開發驗證：** `08-CHANGE-LOG.md:38`、`06-TEST-AND-PROCESS-AUDIT.md:28` 記錄主代理 03:25 UTC 最終完整 check、focused／syntax／whitespace、build／ad-hoc verify 通過。本審查另取得自己的完整回歸結果，未只轉述開發聲明。
- **獨立驗證：** `2026-10-01T03:27:59Z` 執行 `npm run check`，最終 exit 0。stdout 包含 19 個文件檢查通過、AI provider、actual UI、whole-runner／helper offline focused、missing-model owned cleanup、bundle preflight、Ollama streaming 與全部核心回歸通過。當中 core 涵蓋 API token／Origin、部分下載取消、串流上傳、任務、真實合成聲波、修剪、字幕重算、還原、分頁及取消狀態；這不擴大本審查對工作樹無關歷史差異的背書。
- 舊終態與 rejected GET、restore 成功／失敗晚到、新 actual run 正常完成、superseded start rejection／現任務 start／poll failure、ASCII／UTF-8 byte cap、artifact EACCES、absolute tags deadline 均有持久 actual-code 案例，已執行；前兩輪實際重現的阻擋有相對應防回歸。
- 補充 helper／test syntax 與 whitespace 通過（`03:28:35Z`）。未重跑 live AI UI 或模型品質測試；其實機證據採第 6 節只讀核驗。
- `npm run docs:check:final` 尚未執行。本審查不代替主要代理整合工作條目，也不預告該 gate 已通過。

## 6. 實際運行結果

- 判定：通過（新候選／正常 loopback 原始 evidence 的限定结果）。
- 候選：`/Users/nycu/Documents/離線字幕工廠/dist/acceptance-2026-10-01-cancel-resume-round3-final/mac-arm64/離線字幕工廠.app`。`2026-10-01T03:28:35.396Z` 以 Node fs／crypto 只讀獨立重算 source／packaged review.js，兩者均為 `7efbe0d1cca764e015af940323725b1c8b0bc09c46e31a2a2b437375ee79c0d3`；executable 為 `75e6c676265dfbc6c980458f56435505dae532eec05dc9f04a7acd29326454ac`，對上兩份 evidence `:4–6`。
- `codesign --verify --deep --strict '<上述 candidate>'` 於 `2026-10-01T03:29:04Z` 同次只讀查核無錯誤；這確認既有 ad-hoc candidate 驗證，不代表 Developer ID／公證或 Gatekeeper 驗收。
- `evidence/2026-10-01-ollama-ui-cancel-resume-replay11.json:8–10,29–58,87–91,124–181`：03:23:36.828Z 至 03:23:56.542Z、19,714ms、pass；checkpoint1/6、persisted suggestion1、取消後控制、reload、同 Session、resume起點1、六建議／接受／undo／redo／另存，original SRT SHA-256 before／after 相同、時間碼不變，app＋owned daemon 全清理且無 forced cleanup。
- `evidence/2026-10-01-ollama-ui-default-regression-replay3.json:8–10,29–58,73–75,109–143`：03:24:39.580Z 至 03:24:49.909Z、10,326ms、pass；兩 cue 完成／接受／undo／redo／保存、cancelResume=null、source hash／時間碼不變、全部 cleanup 通過，無強制終止。
- 同一只讀 Node 指令實際斷言 candidate identity、status=pass、original SRT hashes 相等、timecodesUnchanged、app／group／port／userData／daemon／root cleanup 全部必要旗標為 true 且 forcedCleanup=false。兩案 `scope.systemNetworkDisabled=false`、Electron 不套 Seatbelt、成功 daemon 不套 Seatbelt，無個人 path／token query，與文件範圍一致。
- 本審查沒有重跑 live AI UI；exit0 來自主代理紀錄／交接，JSON 核驗不冒稱獨立 subprocess exit。已清理的 checkpoint／SRT 依不可變 evidence 與 runner 實際讀檔／assert 解讀，不重新生成。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪 round3 獨立複審結論為有條件通過：取消狀態還原競速與 UTF-8 位元組上限均已修正，前輪三項阻擋全部解除，獨立完整回歸及新候選實機證據雜湊核驗通過；主要代理尚須整合本報告並通過文件 final gate，正常 loopback 子範圍不代表 FR-021 整體完成。**
- 阻擋問題：無剩餘程式阻擋；P2-01（含 restore-in-flight 延伸）、P2-02、P2-03 均解除；P3-01 也已處理。未要求本輪未授權的平台／provider／網路驗收。
- 條件：主要代理依不可改寫報告規則，連結並逐字引用本結論，更新本工作條目及最後驗證／剩餘風險，執行且保存 `npm run docs:check:final` 結果。該 gate 本輪尚未執行，不能宣稱工作已正式結案。
- 具體修正要求：無額外程式修正；若後續 source 或驗收策略變更，應依影響再驗證，不改寫本輪判定／前輪原件。
- 剩餘風險：本輪只涵蓋正常 loopback macOS 合成短字幕 UI 控制流程；offline packaged UI 仍失敗、物理斷網／長中文品質／乾淨安裝／Release 不在成功證據範圍。Windows 暫緩、LM Studio 排除、FR-021 整體未結案。final gate 與本工作條目結案仍由主要代理負責。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
