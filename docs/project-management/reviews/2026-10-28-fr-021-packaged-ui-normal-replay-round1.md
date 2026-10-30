# 獨立審查報告：current-source packaged Ollama UI normal-path replay

- 審查對象 commit／版本：dirty worktree `c06d15e95a2f0a0981518c5873003a460e57a5ee`（branch `codex/0.51-anthropic-claude`）；candidate `../dist/mac-arm64/離線字幕工廠.app`，version `0.52.0`，macOS arm64。
- 對應 08-CHANGE-LOG 條目：2026-10-28 — current-source packaged Ollama UI normal-path replay（`FR-021-REPLAY-20261028-UI-NORMAL`）。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-28T11:49:35+08:00 起；本輪指示、`AGENTS.md`、README、00／02／03／06／07／08、full preflight 列出的治理與 workflow、目前 source、candidate 及指定 evidence。以下結論均以本輪重新讀取／唯讀核對為準，不以既有工作紀錄的評價性敘述取代證據。
- 審查限制：未啟動真實 Ollama／Electron UI，未重跑 replay，未下載／停止模型，未修改 OS network，未發布；只新增本報告。

## 1. 需求完整性

- 判定：部分通過（normal packaged UI 子範圍完整；FR-021 完整需求未完成）。
- 證據：`02-REQUIREMENTS-ANALYSIS.md:37` 將 FR-021 定義為 loopback 本機 LLM、嚴格 cue 契約、不自動下載模型，以及斷網完成本機字幕優化；`02-REQUIREMENTS-ANALYSIS.md:48-60` 又明確記錄 LM Studio 範圍例外與「`systemNetworkDisabled=false` 不代表 FR-021 整體完成」。
- 證據：最新 08 條目 `08-CHANGE-LOG.md:3-19` 明確列出本輪 candidate、normal `acceptance:ollama:ui`、UI flow、hash、cleanup 與不在範圍項目；同一條目仍為「狀態：進行中」(`08-CHANGE-LOG.md:5`)，所以工作尚未具備治理 closeout 條件。
- 證據：00／06／07 的同步條目分別在 `00-CURRENT-STATUS.md:3-7`、`06-TEST-AND-PROCESS-AUDIT.md:3-9`、`07-DEBUG-AND-FIX-HISTORY.md:3-8`，一致標示 normal loopback pass，且明確排除 Seatbelt offline、全機斷網、Windows 與 FR-021 完整驗收。
- 發現：08 的成功條件文字把「candidate 內 BUG-061 test source」與 packaged runtime marker 放在同一句，但實際 candidate 沒有 `Contents/Resources/app/scripts/test-ai-providers.mjs`；`scripts/test-ai-providers.mjs` 是 worktree focused test，並非此 app bundle 的 packaged file。若該文字意指「以目前含 BUG-061 的 source／tests 建置並獨立驗證」，證據足夠；若意指 test source 必須進入 app bundle，則未達成，應在 closeout 時澄清而不可默認。

## 2. 邏輯正確性

- 判定：通過，但只限 normal loopback scope。
- 證據：目前 source `lib/ai/providers.mjs:50-75` 建立 exact cue JSON Schema；`lib/ai/providers.mjs:77-118` 對 loopback Ollama 使用 `/api/chat`、`num_ctx=4096`、strict JSON／UTF-8 stream，custom loopback 僅在 HTTP 404 時 fallback。candidate `providers.mjs` 與目前 source 的 SHA-256 均為 `f402f835ba55c7b776a9280d9b5637fb26fa1af59543901b6b7aef11d74967ed`，`cmp` exit 0。
- 證據：candidate 的靜態 marker 實際包含 `buildOllamaCueResponseFormat`、`/api/chat`、`num_ctx`、`keep_alive`、`strictJson`、`strictEncoding`；candidate `public/review.js` 與 source SHA-256 均為 `ac25c6639a282eb5807c903fd0bded2419a39ce304428efeb137ac4a19a2b04b`。
- 證據：evidence `2026-10-28-ollama-llama3.2-1b-packaged-ui-normal-replay1.json` 的 `ui.settings` 顯示 provider `ollama`、loopback base URL、`llama3.2:1b`、空 API Key、local privacy 與 disabled consent；`ui.optimize` 顯示 completed／2 suggestions；`ui.accept`、`ui.history`、`ui.save` 分別記錄 accept 2、undo／redo、`reviewed.srt` 與 timecodes unchanged。
- 限制：normal runner 未使用外層 network deny policy；evidence 的 `launch.sandboxedTargetProcessTree=false`、`launch.outerSandboxProfileApplied=false`、`scope.systemNetworkDisabled=false` 只支持「未套用離線沙盒的正常 loopback UI flow」，不支持全域或 process-tree egress deny 結論。

## 3. 邊界情況

- 判定：部分通過；本輪指定的安全／清理邊界有證據，功能邊界仍是窄 scope。
- 證據：evidence 的 `scope.loopbackOnlyConfiguration=true`、`apiKeySupplied=false`、`isolatedAcceptanceDaemon=true`，且 `daemon.contextLength=4096`；`daemon.preinstalledModelFound=true`、`daemon.modelDownloadAttempted=false`、`daemon.existingServiceModified=false`，符合「預裝模型、不可自動下載、不修改既有服務」的本輪邊界。
- 證據：evidence 的 `cleanup` 顯示 Electron exited、process group closed／absent、app server port closed、temporary userData removed；owned daemon stopped、process group absent、port closed、temporary root removed，且 `forcedCleanup=false`。
- 未覆蓋：normal scenario 的 `ui.cancelResume=null`，沒有取消／續跑；只有 2 cue、1 batch、1B model、單一 macOS arm64 candidate；沒有以此證明長 prompt、多批次、其他 Ollama 版本／模型、故障／逾時、Windows、Seatbelt packaged UI 或全機斷網。
- 證據：`03-FUNCTIONAL-DESIGN.md:151-159` 把 `num_ctx=4096`、Seatbelt wrapper 與「只隔離驗收子程序、不停用全機網路」分開定義；因此 normal evidence 不能回填這些未覆蓋邊界。

## 4. 程式碼品質

- 判定：通過（source／candidate traceability 良好）；治理 closeout 尚未完成。
- 證據：`lib/ai/providers.mjs:42-118` 將 loopback URL 正規化、schema builder、native request、strict stream options 與 404 fallback 分段處理，且沒有以放寬 parser／validator 取代契約；candidate 與 source 的 `providers.mjs` byte parity 已由本輪 `shasum`／`cmp` 核對。
- 證據：candidate Info.plist 為 `0.52.0`，`lipo -info` 顯示 `arm64`；candidate `Contents/Resources/tools/manifest.json` target 為 `darwin-arm64`，本輪以 `OFFLINE_SUBTITLE_TOOLS_DIR=.../Contents/Resources/tools npm run runtime:verify:mac` 得到 `[runtime] OK: darwin-arm64`。
- 證據：normal runner 在啟動前計算 executable／review.js／Electron Framework hash（`scripts/verify-electron-ollama-ui.mjs:220-243`），evidence 保存的三個 hash 與本輪重算值一致：executable `b3605c589459068f894a70896b8ed843be3832a839fcdd83aa898e9b16210de4`、review.js `ac25c6639a282eb5807c903fd0bded2419a39ce304428efeb137ac4a19a2b04b`、Framework `416b6c8cf74c59188266d3ff7a3fc77b9f68bb52f7328d98b382d132580c8cee`。
- 發現：candidate／evidence identity 沒有保存 packaged `providers.mjs` 的專用 hash，而是依賴 marker／本輪 parity 核對；這不是本次 normal flow 的阻擋，但若要讓未來 evidence 在不存取 candidate 的情況下獨立證明 provider byte identity，應補充明確 artifact hash 欄位。

## 5. 測試覆蓋

- 判定：部分通過；focused／治理／runtime checks 通過，完整 `npm run check` 本輪未執行。
- 證據：本輪於 2026-10-28T11:49:35+08:00 執行 `node --check lib/ai/providers.mjs`、`node --check scripts/verify-electron-ollama-ui.mjs`、`node scripts/test-ai-providers.mjs`，exit 0，輸出「AI provider contract 與術語／Prompt 測試通過」。
- 證據：同一時間執行 `npm run docs:check`，exit 0（19 個治理文件）；`node scripts/test-project-docs-validator.mjs` exit 0；`git diff --check` exit 0。
- 證據：08／06 的既有工作紀錄 `08-CHANGE-LOG.md:17-18`、`06-TEST-AND-PROCESS-AUDIT.md:5-8` 記錄 build、`test-ollama-ui-offline.mjs`、provider focused test 與 normal replay 先前通過；本輪沒有把這些歷史指令重新執行成新的 live replay 證據。
- 限制與理由：本輪未執行 `npm run check`，因目前 macOS 有 `/Applications/Ollama.app/Contents/Resources/ollama`；其 `test-ollama-ui-offline.mjs:416-455` 在存在預裝 3B 模型時會呼叫 offline UI wrapper，而 `scripts/ollama-ui-local-daemon.mjs:66-68` 會 spawn `ollama serve`。在使用者明確要求「不要啟動真實 Ollama」下，不能為取得 full-check 綠燈而執行該路徑。這使本輪不能宣稱完整回歸已由本輪獨立重跑。
- 證據：本輪 `npm run docs:check:final` 於 2026-10-28T11:49:51+08:00 exit 1，明確指出最新 08 缺少「獨立審查是否執行：」、「發布授權：」、完成狀態與可解析的是／否值；這是本報告前的預期 closeout failure，不是產品 runtime failure。

## 6. 實際運行結果

- 判定：部分通過；指定 immutable normal replay evidence 支持 pass，但本輪依限制未重跑實際 UI。
- 證據：既有 normal command `npm run acceptance:ollama:ui -- ../dist/mac-arm64/離線字幕工廠.app/Contents/MacOS/離線字幕工廠 9996 30000 docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-normal-replay1.json llama3.2:1b` 已在 `08-CHANGE-LOG.md:18` 記錄 exit 0；evidence 的 `status=pass`、`elapsedMs=14918`、`scenario=complete`、platform `darwin`／arch `arm64`。
- 證據：evidence 的實際 UI trace 完成 review page load、settings save、AI optimize、2 suggestions、accept 2、undo、redo、`reviewed.srt` save；`source.originalSrtSha256Before` 與 `source.originalSrtSha256After` 相同，`ui.save.timecodesUnchanged=true`，且 model／daemon／cleanup 欄位如上述均通過。
- 證據：candidate build 結果與 `electron:build:mac:dir` exit 0 已在 `08-CHANGE-LOG.md:17`、`00-CURRENT-STATUS.md:5`、`06-TEST-AND-PROCESS-AUDIT.md:6` 同步；本輪直接核對 candidate 存在、0.52.0／arm64、runtime manifest、marker、source parity 與三個 evidence artifact hash。
- 範圍判定：evidence `launch.sandboxedTargetProcessTree=false`、`launch.outerSandboxProfileApplied=false`、`scope.systemNetworkDisabled=false`；因此這是 normal loopback UI pass，不是 Seatbelt offline pass，不是全機斷網證據，也不是 Windows 或 FR-021 完整驗收。normal runner 的 `scope.lmStudio` 亦標示為 explicit scope exception。
- 現場狀態：本輪未啟動 Electron／replay；唯讀 process check 只觀察到原先已存在的桌面 Ollama `serve`，沒有新增 candidate Electron process。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪對 current-source packaged Ollama UI normal-path replay 的獨立六面向審查結論為有條件通過：macOS arm64 candidate、candidate marker/hash、focused provider contract、normal loopback UI settings／optimize／accept／undo／redo／save、preinstalled model／no-download 與 process／port／userData／daemon cleanup 均由現有 evidence 與本輪唯讀核對支持；但其 scope 明確為 `sandboxedTargetProcessTree=false`、`systemNetworkDisabled=false`、`outerSandboxProfileApplied=false` 的 normal loopback run，不能替代 Seatbelt offline 或全機斷網，Windows 與 FR-021 完整驗收仍未完成，且 08 最新條目尚未完成 review citation／closeout final gate，故不得宣稱 FR-021 已完成。**
- 阻擋問題（若有）：無發現 normal loopback UI flow 的 source／candidate／evidence 不一致或 cleanup failure；但不得將本條目標示為無條件完成，直到 08 補上本報告的獨立審查欄位、逐字引用、發布授權欄位（本輪不發布但 final checker 要求）與正確 closeout 狀態，並重新執行 `npm run docs:check:final`。
- Closeout condition：有。治理 closeout 尚未滿足；`npm run docs:check:final` 已在本輪 exit 1。這項條件只關閉本輪 normal replay 的文件審查，不得用來宣稱 Seatbelt offline、全機斷網、Windows 或 FR-021 完整驗收已完成。
- 剩餘風險：未重跑 live UI；未覆蓋 Seatbelt packaged UI 的 nested Chromium sandbox blocker、真正 process-tree／全機 egress control、取消／續跑、長 prompt／多批次、其他模型／版本、Windows 與 FR-021 全流程；candidate 未封裝 BUG-061 test source，且 provider 專用 artifact hash 未寫入 evidence。
- 給主要開發代理的具體修正要求：只在不改寫本報告、不擴大 scope 的前提下，將本報告連結與上述完整結論句逐字寫入最新 08，補齊審查／發布授權欄位並把條目狀態改為與實際 closeout 一致，再執行 `npm run docs:check:final`；若保留「candidate 內 BUG-061 test source」措辭，需提供該檔案在 bundle 內的證據，否則改成「worktree test source」以避免需求語意誤導。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行文件／source／candidate／evidence 讀取與唯讀驗證；未修改任何其他專案檔案。
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪唯一寫入路徑是 `docs/project-management/reviews/2026-10-28-fr-021-packaged-ui-normal-replay-round1.md`；未修改其他檔案。
- 本輪未啟動真實 Ollama／Electron UI，未重跑 replay，未下載／停止模型，未改 OS network，未發布；現有桌面 Ollama process 僅作唯讀觀察，未被本輪操作。
- 若上述聲明不實，本報告無效。
