# 獨立審查報告：FR-021 normal-loopback 3B app-restart resume next1

- 審查對象 commit／版本：`c06d15e95a2f0a0981518c5873003a460e57a5ee`（工作樹有既有變更，未覆蓋）／macOS arm64 current candidate、預裝 `llama3.2:3b`
- 對應 08-CHANGE-LOG 條目：2026-10-29 — `FR-021-REPLAY-20261029-UI-NORMAL-3B-APP-RESTART-RESUME-NEXT1`
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-29；本報告由獨立審查上下文建立，依 `AGENTS.md`、project-management 核心／full route、需求／設計／測試／偵錯紀錄、指定 evidence、runner／server／review.js／cleanup／provenance source 與 git diff 重新判斷，未沿用開發代理的評價性結論。
- 審查方式：未重跑會建立新 live evidence 的 verifier；執行 focused contract、完整 `npm run check`、治理 validator、`npm run docs:check`、`git diff --check`，並唯讀核對 evidence 權限／雜湊／候選 artifact 雜湊／privacy。

## 1. 需求完整性

- 判定：部分通過。
- 證據：工作目標要求 6 cues／6 batches、UI cancel response、checkpoint、保留同一 userData／job root 後關閉第一個 process／port、以同一 candidate／DevTools port 重啟、同一 session／checkpoint resume、accept／undo／redo／save／timecode invariant／cleanup（`docs/project-management/08-CHANGE-LOG.md:8-13`）。功能設計也明定 `cancel-resume-restart` 與 normal-loopback 邊界（`docs/project-management/03-FUNCTIONAL-DESIGN.md:179`）。
- 指定 evidence `.../2026-10-29-fr-021-ui-normal-3b-app-restart-resume-next1.json:2-3,66-74,201-232` 確實涵蓋 cancel、checkpoint、reload、app restart、resume、6/6、接受、歷程與保存結果；`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`、`loopbackOnlyConfiguration=true`、`apiKeySupplied=false`，且明確以 LM Studio scope exception 記錄，沒有把本輪擴稱為 FR-021 overall。
- 缺口不在需求範圍定義，而在最終 server-port cleanup assertion 未真正驗證（詳見第 2、6 節 F-01）。因此本工作項目尚不能稱為完整達成。

## 2. 邏輯正確性

- 判定：不通過。
- 已成立部分：runner 在 renderer 的 `window.fetch` 外層捕獲實際 UI 的 cancel POST，讀取 `response.status` 與去敏 JSON 的 `ok`／`cancelled`（`scripts/verify-electron-ollama-ui.mjs:672-704`）；產品 UI 的 cancel handler 本身也確實以 POST、檢查 HTTP／body 後再恢復狀態（`public/review.js:747-763`），server 對成功取消回 HTTP 200 `{ ok: true, cancelled: true }`（`server.mjs:4625-4635`）。evidence 保存 `200`、`true`、`true`，沒有保存 raw body（evidence `:215-217`）。
- 已成立部分：第一個 launch 先停止 process group、等待 child close、再核對第一個 app server port 關閉；`cleanupProcessGroup` 以 process-group probe、SIGTERM／必要時 SIGKILL 與最終 absent probe 判定關閉（`scripts/verify-electron-ollama-ui.mjs:390-410`；`lib/process-group-cleanup.mjs:42-78`）。重啟前的實際 gate 位於 `scripts/verify-electron-ollama-ui.mjs:806-821`，evidence `:83-91` 顯示第一個 group／port 已關閉且未 forced cleanup。
- 阻擋 finding F-01（P1，技術邏輯／cleanup）：重啟流程在 `scripts/verify-electron-ollama-ui.mjs:822` 將 `appServerPort` 設為 `null`；第二次 `waitForHomeDashboard()` 後只更新 `homeNavigationUrl`（`:824-830`），沒有以第二次 home URL 的 port 更新 `appServerPort`。最終 cleanup 仍呼叫 `waitForPortClosed(appServerPort)`（`:1033-1047`），而 `waitForPortClosed` 對 falsy port 直接回傳 `true`（`:424-426`）。因此 evidence 的 `cleanup.appServerPortClosed=true`（evidence `:81`）只是 `waitForPortClosed(null)` 的 vacuous pass；evidence 同時明確記錄 `appServerPort: null`（`:140`）。第一個 port 的核對成立，但第二個 app server port 的最終關閉沒有被實際核對，違反本工作項目的 final server cleanup 成功條件。
- 同一 candidate／DevTools port 的意圖與主要生命週期成立：`childArgs` 固定使用 `--remote-debugging-port=${port}` 與同一 userData，第二次仍呼叫同一 `launchElectronChild()`（`scripts/verify-electron-ollama-ui.mjs:225-243,276-297,822-825`）；evidence 的 `argv` 為 port 9995、`secondLaunchReady=true`、page time-origin 改變，且 session／checkpoint／resume assertions 均為 true（evidence `:11-35,83-91,223-232`）。但這不能補正 F-01 的第二次 server port cleanup 缺口。

## 3. 邊界情況

- 判定：部分通過。
- 證據：focused contract 實測涵蓋 invalid／remote DevTools target、invalid process-group ID、graceful cleanup、SIGKILL escalation、無法確認關閉、missing daemon／missing model、evidence artifact read failure、byte cap、raw output／path／secret redaction，以及 source contract 的 `cancel-resume-restart` assertions（`scripts/test-ollama-ui-offline.mjs:184-229,267-289,318-362,435-484`）。
- live evidence 顯示 cancel 發生在完成 1/6 batch，checkpoint 1 suggestion、source／original SRT unchanged；reload 與 app restart 後同一 session／checkpoint 可見，resume 從 batch 1 到 6/6，page time-origin 改變（evidence `:201-232`）。
- 未覆蓋或仍有風險：focused test 只以 source assertion 要求存在 `appServerPortClosed`，未捕捉重啟後 port 變數為 `null` 的控制流；本輪 live fixture 僅 6 個極短 synthetic cues、既有桌面 Ollama、macOS arm64。非 loopback、真正斷網、Seatbelt renderer、跨平台、模型品質、app crash during active task 與第二次 server port closure 均不可由本 evidence 推導。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：provenance 透過共用 `projectRunnerProvenance` 做 command／argv、candidate／review.js／Framework SHA-256、bounded child-output digest／bytes、固定 diagnostics 與 raw-output exclusion（`lib/runner-provenance.mjs:36-106`；runner `:304-330,1018-1031`）；DevTools selector 只接受 127.0.0.1、指定 port、`ws:` page target（`lib/electron-devtools-target.mjs:6-47`）。cancel／resume 與 server checkpoint/session contract 也可由 `public/review.js:731-764`、`server.mjs:689-858,4613-4635` 回溯。
- evidence writer 使用 `flag: 'wx'` 與 `mode: 0o600`（`scripts/verify-electron-ollama-ui.mjs:1051-1053`），scope 與 privacy boundary 清楚；這些是良好品質控制。
- 但 F-01 是 state lifecycle 的可維運性缺陷，不只是 evidence 欄位缺少：同一變數在第一輪與第二輪 cleanup 之間被清空，且沒有第二輪 port 的明確欄位／非 null invariant。修正應把第二次 home URL 的 port 寫回專用變數，並讓 final cleanup 對該變數 fail-closed。

## 5. 測試覆蓋

- 判定：部分通過。
- 實際執行（本輪唯讀驗證）：
  - `npm run project:preflight -- --type=full`：exit 0。
  - `node scripts/test-ollama-ui-offline.mjs`：exit 0，focused contract pass。
  - `npm run check`：exit 0；包含 `docs:check`、全套 syntax check、`npm test` 與 YouTube posttest。
  - `node scripts/test-project-docs-validator.mjs`：exit 0。
  - `npm run docs:check`：exit 0。
  - `git diff --check`：exit 0。
  - 唯讀 evidence／artifact audit：evidence mode `600`、evidence SHA-256 `38814c753308ea094b71f45ef7d99b3a58e298c569a7c7b4d971501923b7152e`；candidate、candidate bundle `review.js`、Electron Framework 的實際 SHA-256 分別為 `b3605c...10de4`、`ac25c6...2b04b`、`416b6c...c8cee`，與 evidence `:5-9` 完全一致；candidate bundle `review.js` 與目前 source `public/review.js` SHA-256 也一致；JSON 字串掃描未發現 absolute path、`sk-`／Bearer／private-key marker、raw child output marker。
- 未執行：依使用者指示未重跑會建立新 live evidence 的 verifier；因此本輪實際運行結果依 immutable evidence 與 source／artifact 唯讀核對。focused／full tests 沒有針對「第二次 home port 重新保存、final cleanup 必須以非 null port 驗證」的 regression，這是 F-01 的測試覆蓋缺口。
- `npm run docs:check:final` 本輪實際 exit 1，validator 回報最新工作紀錄缺少「獨立審查是否執行：」「發布授權：」、尚未標示「完成」及獨立審查欄位格式不完整；這是治理 closeout blocker，不能用 `npm run check` 的普通 docs check 取代。

## 6. 實際運行結果

- 判定：不通過（受 F-01 影響；bounded UI flow 本身有 pass evidence）。
- evidence 的 live run 時間為 `2026-10-29T04:47:00.863Z` 至 `04:47:18.545Z`，環境為 darwin／arm64／Node v22.22.3（evidence `:53-59`）。UI home／review／Ollama local settings、空 API key／local privacy、6 suggestions、accept 6、undo／redo、`reviewed.srt`、6 cues、timecodes unchanged 與 English translation 均有結果（`:135-199`）。
- cancel POST 是由 UI flow 實際觸發並由 renderer fetch wrapper 讀取；evidence 的 status 200／accepted／cancelled、checkpoint 1/6、reload／app restart same session／checkpoint、resume batch 1 與 6/6 completion 均可回溯（`:201-232`）。
- cleanup 的第一輪 process group／port、第二次 launch readiness、最終 Electron group／userData／owned daemon cleanup 在 evidence 欄位中大多為 true；但由第 2 節 F-01 證明，最終 `appServerPortClosed=true` 在目前 source 下不是第二次 app server port 的實測結果，因此不能把整份 evidence 的 cleanup pass 當成完整成立。
- scope 判定：這是 `endpointPrivacy=local`、`baseUrl=http://127.0.0.1:11434/v1` 的 normal loopback run；`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`，raw child output 未保存，並明確記錄 LM Studio 未執行。不得將此結果擴稱為 Seatbelt offline、全機 egress、signed／notarized、Windows、LM Studio 或 FR-021 overall。

## 綜合判定

- 結論：不通過。
- 阻擋問題（若有）：
  - **F-01（P1，技術）**：修正重啟後第二次 app server port 未保存／未驗證的 state bug；至少在 `restartedHome` 後保存 `Number(new URL(homeNavigationUrl).port)`，讓 final cleanup 使用第二次 port 並對 null fail-closed，新增 regression 覆蓋 `waitForPortClosed(null)` 不得成為成功證據。不得修改本 immutable evidence；修正後以新 evidence path 重跑 `cancel-resume-restart`，再重算 mode／hash／privacy／cleanup。
  - **F-02（P1，治理 closeout）**：`08-CHANGE-LOG.md:3-20` 仍為「進行中」且缺少本 round1 report 連結／完整逐字 quote／`獨立審查是否執行：是`／`發布授權：不適用` 等 final 欄位；本輪 `npm run docs:check:final` exit 1。主要代理須在不修改本報告的前提下完成 closeout，再重跑 final gate。
- 剩餘風險：即使 F-01／F-02 修正後，本輪仍只支持 macOS arm64 current candidate、預裝 `llama3.2:3b`、既有桌面 Ollama、6 個短 synthetic cues、normal loopback app-restart lifecycle；F-02 evidence provenance 的 source revision／完整 replay command／環境前提仍較弱，Seatbelt nested Chromium renderer blocker、真正全機 egress、signed／notarized package、Windows、LM Studio 與 FR-021 overall 仍未完成。
- 給主要開發代理的具體修正要求：修正並補 test／新 immutable evidence；保留本 round1 原件與既有 evidence；同步 06／07／08 的實際結果與 residual scope；在 08 標示完成、補齊審查與發布授權欄位後執行 `npm run docs:check:final`。在此之前不得把本工作項目標示為無條件完成。
- 可逐字引用的完整結論句：**本輪 `FR-021-REPLAY-20261029-UI-NORMAL-3B-APP-RESTART-RESUME-NEXT1` round1 獨立審查結論為不通過：cancel POST 由 UI 實際捕獲且去敏保存、第一個 Electron process group／app server port 關閉、同一 userData／job root 與同一 candidate／DevTools port 的 session／checkpoint resume、candidate／Framework／review.js hash、0600／exclusive-create、privacy 與 normal-loopback scope 均由 source、immutable evidence 與唯讀驗證支持；但重啟後 runner 將 `appServerPort` 設為 `null` 且未記錄第二次 server port，final `waitForPortClosed(null)` 會直接返回 true，因此最終第二個 app server port cleanup 未實際驗證；加上 `npm run docs:check:final` 仍因最新工作紀錄未結案及缺欄位而失敗，修正、以新 immutable evidence 重跑並完成治理 closeout 前不得結案，也不得擴稱 Seatbelt offline、全機 egress、signed/notarized、Windows、LM Studio 或 FR-021 overall。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案；未修改 source、test、evidence、candidate、Ollama、model store、OS network、治理來源文件或既有 review。
- 本報告唯一寫入目標為本檔案；未重跑會建立新 live evidence 的 verifier。
- 若上述聲明不實，本報告無效。
