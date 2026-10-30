# 獨立審查報告：FR-021 macOS Ollama UI 取消與 checkpoint 續跑驗收 round4

- 審查對象 commit／版本：`299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`／0.51.0 dirty worktree 的既有 round3-final 基準及本次文件整合／失敗紀錄，非公開 `53956cc` Release。
- 對應 08-CHANGE-LOG 條目：2026-10-01 — FR-021 macOS Ollama UI 取消與 checkpoint 續跑驗收（`docs/project-management/08-CHANGE-LOG.md:3–46`）。
- 審查輪次：round4；延續本輪獨立審查角色，另建新報告，round1／2／3 原件保留。
- 啟動時間／上下文來源：`2026-10-01T03:38:15Z`，使用者交接的 03:36 UTC final gate 格式失敗與無程式變更聲明；自行讀取 validator、文件、source／candidate 與 immutable evidence。時間均為 UTC，台灣时间加八小時。
- 審查計畫：核對 validator 固定格式 → 文件整合／失敗紀錄 → source／candidate／evidence 不變 → 一般 docs／whitespace → 建立本報告並直接 import validator 驗證。唯一專案寫入為本報告；未改 validator 或既有報告。
- 本輪範圍：00／06／08 的報告整合及失敗揭露、報告欄位格式、既有基準只讀核驗。沒有重新執行完整 check、focused、live AI UI、模型啟動／下載、既有 daemon 停止、系統網路變更或發布。
- 證據分層：round3 的完整回歸是本審查角色於 `03:27:59Z` 起既已實際執行的歷史結果；round4 新執行的是 `03:38–03:43 UTC` 只讀、文件與格式檢查，不能把前者標為本輪重跑。
- 引用慣例：治理檔名、`reviews/`、`evidence/` 相對 `docs/project-management/`；程式檔相對 repo。

## 1. 需求完整性

- 判定：通過（本次文件格式及既有正常 loopback 子範圍）。
- 證據：`scripts/project-docs-validator.mjs:12–33` 要求六面向各有有效 `- 判定：`、至少十二字的 `- 證據：`，summary 有結論、至少二十字完整引用句及精確 `- 阻擋問題（若有）：`，並包含兩句聲明。本報告逐項使用上述固定欄位；沒有放寬 validator。`08-CHANGE-LOG.md:40–46`、`00-CURRENT-STATUS.md:17`、`06-TEST-AND-PROCESS-AUDIT.md:29` 如實記錄原句整合、03:36 UTC final gate exit1、保留 round3 及回復進行中。`2026-10-01T03:38:24Z` 的 `npm run docs:check` exit0、19 文件；並未將一般檢查當成 final gate。
- 本輪條件僅為主代理整合本報告並執行 final gate；不新增平台、provider、模型品質或斷網驗收要求。

## 2. 邏輯正確性

- 判定：通過（承接已核驗程式基準；本輪不重跑程式測試）。
- 證據：`2026-10-01T03:39:25.171Z` 的 Node fs／crypto 只讀重算 source／packaged review.js 均為 `7efbe0d1cca764e015af940323725b1c8b0bc09c46e31a2a2b437375ee79c0d3`，對上 round3 已驗證基準。再讀 `public/review.js:692–723,743–756`，restore 成功／失敗 generation guard、superseded cancel 訊息隔離仍在。round3 報告第 2 節（`:20–26`）記錄 actual restore-in-flight 成功／失敗、舊 poll 終態／rejection、superseded start 及 current failure 已實際通過，其完整 check 於 `03:27:59Z` 執行。沒有新的 UI source hash 差異，不把文件 gate 失敗誤判為程式回歸。
- round3 的 P2-01（含 restore 延伸）解除判定維持；本輪未重新製造或宣稱重跑該 VM 場景。

## 3. 邊界情況

- 判定：通過（格式邊界及既有受控案例基準）。
- 證據：`03:39:25.171Z` 以 `import { validateReviewReport } from './scripts/project-docs-validator.mjs'` 直接檢查 round3，取得五項 errors：第 2／3／5／6 面向缺固定證據欄位、summary 缺阻擋問題欄位，與 00／06／08 的失敗紀錄一致。這是 validator 的明確字串契約，不是證據內容消失；round3 原件未修改。round4 另建檔滿足該契約，建檔後再用相同函式檢查。
- 程式邊界證據：再讀 `scripts/ollama-ui-local-daemon.mjs:27–41`，Buffer.byteLength／1 MiB cap／absolute timer 仍在；round3 報告第 3 節（`:28–35`）保存 whole-runner artifact EACCES cleanup／canary、actual helper trickle deadline、真實 HTTP ASCII／UTF-8 oversized、missing binary／empty-store cleanup 的實測與時間。round3 `03:27:59Z` 完整回歸已執行這些持久案例並 exit0，round4 未重跑。P2-02／P2-03／P3-01 的解除判定維持。

## 4. 程式碼品質

- 判定：通過（本輪文件／報告格式品質）。
- 證據：`scripts/project-docs-validator.mjs:19–32` 的精確欄位規則直接用於本報告；validator 不在 `git status --short -- <三份治理文件> scripts/project-docs-validator.mjs` 的變更輸出中。`03:39:25Z` 保存 validator SHA-256 `38409f4025111451d2463dc7f2c7977fae5d35551fe90591072a59c51c6d2a6e` 及 round3 原件 SHA-256 `b696f5ca202f863e0a034827fbdd1950a0c6ee80d3ad670a2c3b98f9b10789a1`，作為本輪前後保留核對基準。`git diff --check` 於 `03:38:24Z` exit0。
- Round3 的自訂格式檢查沒有呼叫實際 validator，故漏掉固定欄位；本輪採直接 validator 檢查修正審查方法，保留錯誤原件及失敗紀錄。未改寫程式、原始證據或歷史審查推理。

## 5. 測試覆蓋

- 判定：通過（本轮要求的文件與格式驗證）。
- 證據：本輪 `npm run project:preflight -- --type=debug`（`03:38:15Z`）exit0；`npm run docs:check`、`git diff --check`（`03:38:24Z`）exit0。建檔後於 `2026-10-01T03:43:42.143Z` 直接 import `validateReviewReport`，傳入本報告 UTF-8 內容及 repo-relative 報告路徑，斷言 errors.length===0，再核對回傳 quote 與本報告原句，結果 errors=[]、exit0；同次 `git diff --check` exit0，round3 與 validator 雜湊核對不變。這是報告格式檢查，沒有呼叫 `validateLatestEntry`，也不是 `docs:check:final`。
- 前輪執行來源：round3 報告 `:45–52` 記錄本審查角色 `2026-10-01T03:27:59Z` 起完整 `npm run check` exit0、補充 syntax／whitespace。主代理 `08-CHANGE-LOG.md:39` 另記 03:25 UTC 開發驗證，`:45` 記 round3 獨立驗證；兩者與本輪只讀／文件檢查明確區分。
- 沒有重跑完整 check／live AI，也未宣稱本輪 final gate 已成功。原 03:36 UTC final gate exit1 為主要代理紀錄；本輪直接重現的是 report validator 的五項格式錯誤。

## 6. 實際運行結果

- 判定：通過（兩份最終 immutable evidence 與候選只讀核驗）。
- 證據：`03:39:25.171Z` 的 Node fs／crypto／assert 只讀指令重新核對 final candidate。source／packaged review.js hash 同為 `7efbe0d1cca764e015af940323725b1c8b0bc09c46e31a2a2b437375ee79c0d3`；executable `75e6c676265dfbc6c980458f56435505dae532eec05dc9f04a7acd29326454ac`，均與 round3 報告 `:57` 及兩份 evidence `:4–6` 一致。候選為 `/Users/nycu/Documents/離線字幕工廠/dist/acceptance-2026-10-01-cancel-resume-round3-final/mac-arm64/離線字幕工廠.app`。
- `evidence/2026-10-01-ollama-ui-cancel-resume-replay11.json` 全檔 SHA-256 `30a8408330022bdfc7721da48a1336951de73247d7c5cf38754648ec7d8491d5`；`evidence/2026-10-01-ollama-ui-default-regression-replay3.json` 全檔 SHA-256 `dfb25fe612c592d0d6b791badcc6656089356cc2c230ca1b365583184eaabea4`。本輪比對 round3 工具上下文已保存的 immutable hash 清單，round1／2 與全部十四份本日 Ollama UI evidence 均未變；另保存 round3 原件以核對本輪不改寫。
- 同次重新解析及 assert：replay11 `:8–10,29–58,87–91,159–181` 保持 pass／19,714ms／checkpoint1/6／同 Session／resume起點1／來源 hash 相等；default3 `:8–10,29–58,73–75,109–143` 保持 pass／10,326ms／cancelResume=null。兩案 timecodesUnchanged、app／process-group／port／userData／owned daemon／root cleanup 必要旗標全 true、forcedCleanup=false。JSON `:21–27,46–51` 的 systemNetworkDisabled=false、Electron／成功 daemon 不套 Seatbelt 仍維持。
- 實機操作是主代理原先執行；round3 與本輪都只讀核验 evidence，沒有重跑 live AI。既有 ad-hoc 簽章驗證承接 round3 `:58` 的 `03:29:04Z` 結果，本輪未再執行；不宣稱 Developer ID／公證、Gatekeeper 或離線 packaged UI 通過。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪 round4 獨立審查結論為有條件通過：報告已補齊既有 validator 要求的固定欄位，前輪程式阻擋解除判定維持，source、最終候選與兩份實機證據雜湊核驗一致；主要代理尚須整合本報告並通過文件 final gate，正常 loopback 子範圍仍不代表 FR-021 整體完成。**
- 阻擋問題（若有）：無剩餘程式阻擋；round3 的固定欄位缺漏由本輪新報告處理，原件不改寫。final gate 尚未重新通過，不得宣稱本工作已正式結案。
- 條件：僅主要代理連結並逐字引用本報告、同步最新工作條目及最後驗證／風險，執行且保存 `npm run docs:check:final` 結果；本輪 report validator pass 不能代替此條件。
- 剩餘風險：正常 loopback macOS／合成短字幕控制流程限制不變；offline packaged UI 仍失敗、FR-021 整體未完成。Windows 暫緩、LM Studio 排除；物理斷網／長中文品質／乾淨安裝／發布不由本輪或既有兩份正向 evidence 證明。沒有新增擴大驗收條件。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
