# 獨立審查報告：FR-021 normal-loopback 3B app-restart resume next1 round2

- 審查對象：`FR-021-REPLAY-20261029-UI-NORMAL-3B-APP-RESTART-RESUME-NEXT1`；current `HEAD` `c06d15e95a2f0a0981518c5873003a460e57a5ee`，工作樹保留既有變更，未覆蓋。
- 審查輪次：round2；本輪只複審 round1 F-01 技術 blocker，以及目前 source、next1／next2 immutable evidence、test 與治理狀態。
- 依據：`AGENTS.md`、`docs/project-management/README.md`、`docs/project-management/00-CURRENT-STATUS.md`、`03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、`08-CHANGE-LOG.md`、round1 報告、`scripts/verify-electron-ollama-ui.mjs`、`scripts/test-ollama-ui-offline.mjs`、`server.mjs`、`public/review.js`、process-group cleanup／runner provenance modules、git diff 與 next1／next2 evidence。
- 審查方式：未重跑會建立新 live evidence 的 verifier；執行 deterministic focused／完整檢查、治理 validator、一般 docs check、`git diff --check`，並唯讀核對 evidence 權限／SHA-256／source artifact hash／privacy／scope／cleanup。

## 1. 需求完整性

- 判定：技術需求有條件通過；治理 closeout 尚未完成。
- round1 F-01 要求是：重啟後不能把 `appServerPort` 清成 `null` 後以 vacuous pass 宣稱 cleanup，必須保存第二次 app server port、對無效 port fail-closed、以新 immutable evidence 重跑並補 regression。現行 source 已逐項具備：`waitForPortClosed()` 對非整數／範圍外 port 返回 `false`（`scripts/verify-electron-ollama-ui.mjs:426-433`）；第二次 `waitForHomeDashboard()` 後從 home URL 保存 `appServerPort`、寫入並要求 `secondAppServerPortCaptured`（`:824-833`）；final cleanup 將實際第二次 port 的結果寫入 `secondAppServerPortClosed`（`:1045-1046`）。
- next1 first-run 仍保留 immutable，SHA-256 `38814c753308ea094b71f45ef7d99b3a58e298c569a7c7b4d971501923b7152e`；它記錄了 round1 找到的缺陷，不應作本輪 closeout 的 authoritative evidence。next2 是修正後 authoritative bounded evidence：`status=pass`、mode `0600`、SHA-256 `e95aa0524fdc32684a49c03bc4c22942afe012657d77dedd6c95e66903256f24`。
- 需求範圍仍只支持 macOS arm64 current packaged candidate、預裝 `llama3.2:3b`、normal loopback 的 cancel／checkpoint／app-restart／resume lifecycle；不支持 FR-021 overall 或其他未執行平台／安全邊界。

## 2. 邏輯正確性

- 判定：round1 F-01 已解除；next2 的 bounded lifecycle 邏輯可由 source 與 evidence 互相支持。
- cancel POST 的確由 UI 實際發出並被 runner 捕獲：`public/review.js:747-763` 以 POST `/cancel-ai-optimize` 解析 JSON 並檢查 HTTP／body；`scripts/verify-electron-ollama-ui.mjs:672-704` 在 renderer 的 `window.fetch` wrapper 讀取實際 `response.status`、`response.ok` 與去敏 `ok`／`cancelled`，後續 `:722-787` 將數字／布林值寫入 `cancelResume` 並要求 HTTP 200、accepted、cancelled；`server.mjs:4625-4635` 對成功取消回傳 HTTP 200 `{ ok: true, cancelled: true }`。next2 `cancelResume` 保存 `cancelRequestHttpStatus=200`、accepted／cancelled true，沒有保存 raw response body、token 或 raw output。
- 第一個 launch 的 process group 先經 `stopChild()`／process-group cleanup，再以第一個 port 執行 `waitForPortClosed()`；next2 的 `firstElectronExited`、`firstProcessGroupAbsentAfterCleanup`、`firstProcessGroupClosedConfirmed`、`firstAppServerPortClosed` 均 true，forced cleanup false。`userDataPreservedBetweenLaunches=true` 對應同一 userData／job root 在第一、第二次啟動間保留，而不是把 persistence 測試成新資料夾。
- 第二次仍使用相同的 candidate／DevTools port 與保存的 userData：child args 固定 `--remote-debugging-port=${port}`／`--user-data-dir=${userDataDir}`（`scripts/verify-electron-ollama-ui.mjs:225-243`），第二次再次呼叫同一 `launchElectronChild()`（`:276-297,824-827`）。next2 的 `secondLaunchReady=true`、`secondAppServerPortCaptured=true`、`secondAppServerPortClosed=true`，home port 記錄為 `8791`。
- 第二次頁面以不同 `pageTimeOrigin` 證明新 renderer；同一 session／checkpoint 被讀回，`resumeStartsAtCheckpoint=true`、`resumedFromBatch=1`，再完成 6/6。這是對「真的重啟並恢復」的交叉核對，不只依賴 child process 再 spawn。

## 3. 邊界情況

- 判定：本輪指定 blocker 的負向邊界已補足；產品與平台範圍仍受限。
- focused source regression 現在直接固定 `secondAppServerPortCaptured`、`secondAppServerPortClosed`、`if (!Number.isInteger(targetPort) ... return false`，並保留 cancel response、第一個 process group、userData persistence 與新 renderer assertions（`scripts/test-ollama-ui-offline.mjs:318-326`）。這可防止 round1 的 `null` vacuous pass 回歸。
- next2 的 cancel 發生在 1/6 batch，checkpoint 保存 1 suggestion；reload 與第二次 app restart 均維持同一 session／checkpoint，resume 從 batch 1 至 6/6。accept 6、undo／redo、save `reviewed.srt`、6 cues 與 timecodes／original SRT invariant 也在 evidence 中具體記錄。
- 仍未由本 evidence 證明：真正全機斷網、Seatbelt renderer sandbox、非 loopback egress、跨平台／Windows、signed／notarized package、LM Studio、模型品質或 active task 中任意 crash recovery；本輪 synthetic fixture 為 6 個短 cues。這些不是 F-01 修正的可推論延伸。

## 4. 程式碼品質

- 判定：修正清楚且 fail-closed；provenance 仍是不完整但已揭露的剩餘風險。
- `waitForPortClosed()` 現在先驗證整數與 `1024..65535`，任何缺失／無效 port 都不能生成成功 cleanup 結果。第二次 port 有明確 capture invariant，final cleanup 使用同一 live state 並把結果寫入專用 evidence 欄位，修正了 round1 指出的 lifecycle state bug，而不是只補一個靜態欄位。
- evidence writer 使用 exclusive `flag: 'wx'` 與 owner-only `mode: 0o600`（`scripts/verify-electron-ollama-ui.mjs:1057-1063`）。process-group cleanup 以 group probe、必要的 graceful／forced path 與最終 absent confirmation 判定結束（`lib/process-group-cleanup.mjs:42-78`）。
- next2 的 artifact provenance 與目前檔案核對一致：candidate executable SHA-256 `b3605c589459068f894a70896b8ed843be3832a839fcdd83aa898e9b16210de4`；packaged `review.js` SHA-256 `ac25c6639a282eb5807c903fd0bded2419a39ce304428efeb137ac4a19a2b04b`；Electron Framework SHA-256 `416b6c8cf74c59188266d3ff7a3fc77b9f68bb52f7328d98b382d132580c8cee`。runner provenance 另保存去敏 argv、bounded child-output digest／bytes；`rawChildOutput=false`。
- F-02 provenance 尚未解除：evidence 仍未完整綁定 source revision、完整 replay command、timeout／環境前提、build provenance 或 replay-time loaded bytes。這是應保留的非阻擋 residual risk／後續改善條件，不應被寫成 source／candidate／Framework／review.js hash 已涵蓋的完整可重現性。

## 5. 測試覆蓋

- 判定：F-01 regression 與 current bounded replay evidence 覆蓋成立；治理 final gate 未通過。
- 本輪唯讀執行結果：
  - `npm run project:preflight -- --type=full`：exit 0。
  - `node scripts/test-ollama-ui-offline.mjs`：exit 0，focused UI contract／source regression pass。
  - `npm run check`：exit 0，包含核心回歸與 YouTube posttest。
  - `node scripts/test-project-docs-validator.mjs`：exit 0。
  - `npm run docs:check`：exit 0，19 個文件。
  - `git diff --check`：exit 0。
- 依使用者指示未重跑會建立 live evidence 的 `scripts/verify-electron-ollama-ui.mjs` verifier；因此本輪對 live flow 的判斷依 next2 immutable evidence 與目前 source／artifact 唯讀核對，沒有把 deterministic focused test 誤稱為新 live replay。
- `npm run docs:check:final` 本輪 exit 1，明確回報 current 08 最新工作紀錄缺少「獨立審查是否執行：」「發布授權：」、尚未標示「完成」，且獨立審查欄位未具合法值。一般 `npm run check`／`docs:check` 通過不能取代 final governance gate。

## 6. 實際運行結果

- 判定：bounded technical result 有條件通過；round1 F-01 不再是 blocker，治理 closeout 仍阻擋無條件結案。
- next2 live run 的時間為 `2026-10-29T04:52:49.743Z` 至 `2026-10-29T04:53:04.710Z`，darwin／arm64／Node v22.22.3。Evidence status 為 `pass`，next2 mode `0600` 且 SHA-256 與上列 exact value 一致。
- next2 cleanup 逐項為 true：第一個 Electron exited／group absent／group closed／first port closed；第二次 port captured／closed；final Electron／server／owned daemon／temporary userData cleanup 通過，forced cleanup false。這次 `secondAppServerPortClosed=true` 不再是 `waitForPortClosed(null)` 的成功結果，因為目前 source 對 null／無效 port fail-closed 且 evidence 先要求第二次 port captured。
- next2 scope flags 為 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`、`loopbackOnlyConfiguration=true`、`apiKeySupplied=false`；LM Studio 明確為未執行的 scope exception。不得將此結果擴稱 Seatbelt offline、全機 egress、signed／notarized、Windows、LM Studio 或 FR-021 overall。
- governance 狀態存在明確的 closeout gap：`00-CURRENT-STATUS.md` 與 `06-TEST-AND-PROCESS-AUDIT.md` 的 current item 仍寫複審／final docs gate 待完成，`08-CHANGE-LOG.md:3-25` 仍是「進行中」且尚無本 round2 report、完整 quote、`獨立審查是否執行：是`、`發布授權：不適用` 與完成狀態。`07-DEBUG-AND-FIX-HISTORY.md` 已描述 F-01 修正，但不能單獨取代 08 的治理 closeout。

## 綜合判定

- 結論：有條件通過（bounded technical re-review）；不作無條件治理結案。
- F-01 狀態：**已解除**。修正 source、focused regression、next2 immutable evidence 與唯讀 audit 共同證明第二次 app server port 會被保存、capture 必須成功、final close 必須以該 port 實際核對，且無效 port fail-closed。
- next2 authoritative 狀態：**是**。next1 僅是保留的 immutable first-run／round1 finding；next2 才是修正後的 authoritative bounded evidence，不能覆寫 next1，也不能把 next1 的舊 `appServerPort` 缺口重新算成 current pass。
- F-02 provenance 狀態：**尚未解除，但降為非阻擋剩餘風險／後續改善條件**。目前 evidence 的 candidate／Framework／review.js hash、bounded child output 與 command argv provenance 有效，但尚不足以宣稱完整 source／build／環境可重現性。
- 治理 closeout 狀態：**仍是阻擋條件**。current 08 條目仍為「進行中」，`npm run docs:check:final` exit 1；主要代理仍須在不修改本報告與既有 evidence 的前提下，補上本 round2 report 引用、完整粗體 quote、條件接受、`獨立審查是否執行：是`、`發布授權：不適用`、遺留風險並將該條目標示為符合其 bounded scope 的完成狀態，再重跑 final gate。

- 阻擋問題（若有）：
  - **GOV-01（P1，治理 closeout）**：不是新的技術 finding；是 08 最新工作條目尚未完成 round2 report／quote／independent-review／release-authorization／完成狀態欄位，導致 `npm run docs:check:final` exit 1。完成前不得宣稱本工作項目已治理結案。
  - **F-01（round1 技術 blocker）**：無，已解除；不得再以 next1 的舊 null-port 行為作為目前 blocker。
  - **F-02（provenance）**：無新增 P1 技術 blocker；仍列為非阻擋 residual risk／後續改善條件，且不得被擴大解讀為完整 provenance。

- 可逐字引用的完整結論句：**本輪 `FR-021-REPLAY-20261029-UI-NORMAL-3B-APP-RESTART-RESUME-NEXT1` round2 獨立複審結論為 bounded technical result 有條件通過：round1 F-01 的第二次 app server port cleanup 技術 blocker 已由 invalid-port fail-closed、第二次 port capture／close assertions、focused source regression 與 authoritative next2 immutable evidence 解除；next1 保留為不可覆寫的 first-run finding，next2 的 cancel POST HTTP 200／accepted／cancelled、第一個 process group／port 關閉、同一 userData／job root 保留、同一 candidate／DevTools port 重啟、同一 session／checkpoint 恢復、從 batch 1 至 6/6 resume、0600／exclusive-create、candidate／Framework／review.js hash、privacy、raw-output exclusion 與 cleanup 均由 source、evidence 與唯讀驗證支持；F-02 source／command／environment provenance 仍是非阻擋剩餘風險／後續改善條件，而 08 最新工作條目仍為「進行中」並使 `npm run docs:check:final` exit 1，故治理 closeout 仍是條件與 blocker；本輪只支持 macOS arm64 current candidate／預裝 `llama3.2:3b`／normal-loopback app-restart lifecycle，不得擴稱 Seatbelt offline、全機 egress、signed／notarized、Windows、LM Studio 或 FR-021 overall。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、唯讀 shell 指令與驗證；未修改 source、test、evidence、candidate、Ollama、model store、OS network、治理來源文件或既有 review 原件。
- 本輪未重跑會建立新 live evidence 的 verifier；next1 與 next2 均保留未覆寫。唯一寫入目標為本檔案：`docs/project-management/reviews/2026-10-29-fr-021-ui-normal-3b-app-restart-resume-next1-round2.md`。
- 本聲明與上述驗證若不實，本報告無效。
