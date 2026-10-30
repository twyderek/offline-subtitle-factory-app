# 獨立審查報告：FR-021 macOS Ollama UI 取消與 checkpoint 續跑驗收

- 審查對象 commit／版本：HEAD `299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`／0.51.0 的 dirty worktree；不是公開 `53956cc` candidate。
- 對應 08-CHANGE-LOG 條目：2026-10-01 — FR-021 macOS Ollama UI 取消與 checkpoint 續跑驗收（`docs/project-management/08-CHANGE-LOG.md:3–25`）。
- 審查輪次：round1。
- 審查代理：Codex，本次獨立審查上下文；只接收任務範圍、原始證據位置及限制，未沿用主要開發代理對話記憶。執行前已讀 AGENTS、debug preflight 路由、獨立審查流程及工作條目範本；未新增工作條目。
- 審查時間：2026-10-01 UTC；第一個顯式時間查核為 `02:57:07Z`，重現／驗證至 `03:00:56Z`，隨後建立本報告。台灣時間為 UTC+8。
- 基準凍結：本 round1 僅判定上述截止時間已查核的修補前程式與當時證據；檔案行號指向該基準。主要代理後續修補、新測試、封裝或實機結果均不納入本報告，另由新的 round2 複審；本報告不追查後續變更，也不回溯改寫本輪判定。報告格式已於 `2026-10-01T03:04:10.302Z` 驗證六面向、引用欄位及末段聲明完整。
- 可執行審查計畫：核對限定需求與差異 → focused／syntax 驗證 → 核對十份 evidence 與 candidate hash → 執行 actual-function 競速與 helper 故障路徑驗證 → 建立六面向報告。所有本輪驗證完成；修正及 final gate 留由主要代理執行。
- 範圍：使用者指定的六個程式／測試檔案與五份治理文件本輪新增內容；既有 `package.json`、`server.mjs`、`public/app.js` 與其他歷史修改不作本輪品質背書。共用 managed-child／process-group helper 僅作本輪呼叫契約查核。
- 驗證限制：未重跑 live AI UI、模型下載、系統網路設定、既有 Ollama 停止或發布。focused test 的專用 temp／自有 daemon 運行產物依使用者授權建立及清理，無其他專案檔案寫入。

## 1. 需求完整性

- 判定：部分通過。
- 證據：`08-CHANGE-LOG.md:12–16` 明定 checkpoint 後取消、原字幕不變、重載與同 Session 續跑，以及完整自有程序清理。`03-FUNCTIONAL-DESIGN.md:95–97`、`00-CURRENT-STATUS.md:9–14`、`06-TEST-AND-PROCESS-AUDIT.md:18–26` 正確區分正常 loopback、離線 packaged UI 失敗及 FR-021 整體未結案。
- 正向限定結果：`evidence/2026-10-01-ollama-ui-cancel-resume-replay9.json:159–181` 記錄 checkpoint 1/6、恢復按鈕、reload、persisted checkpoint、同 Session 與起點 1；`:87–91` 保存 original SRT before／after 相等，`:138–157` 保存接受／undo／redo／另存結果。這些符合本輪正常 loopback UI 目標。
- 未完整符合：P2-01 的快速續跑競速及 P2-02／P2-03 的失敗收尾／啟動 deadline 缺口，不符合穩定恢復與所有錯誤路徑有界清理要求。現有正向 replay 不能排除此類邊界。
- 時間／指令證據：`2026-10-01T02:57:20Z` 開始獨立 focused；`02:58:32.490Z`、`02:59:24.187Z`、`02:59:24.487Z` 為下列三案實際重現時間。

## 2. 邏輯正確性

- 判定：不通過。
- 通過部分：`public/review.js:720–733` 在 cancel POST 成功後呼叫 restore；`scripts/test-review-ui.mjs:152–204` 執行 actual UI functions，並非只檢查 source regex。獨立重跑原三案通過；`lib/electron-devtools-target.mjs:38–46` 先排除 splash，再沿用 exact-port socket 白名單；實際 selector 測試見 `scripts/test-ollama-ui-offline.mjs:18–24`。
- **P2-01（阻擋）：舊 cancelled 回應可關閉成功續跑的新 UI polling。** `public/review.js:646–667` 在 awaited GET 返回後未核對 generation／任務生命週期，直接 `setAiRunning(false)`；新增 restore 在 `:682–694` 提前恢復按鈕，`resumeAiOptimize():704–712` 隨即可開始新 polling。重現順序為：舊 poll GET 在途 → cancel 成功且 restore cancelled/retryable → resume POST 成功、polling=true → 舊 GET 才返回 cancelled。actual 五函式 VM 結果由 `{polling:true,cancelHidden:false}` 變為 `{polling:false,cancelHidden:true,resumeHidden:false}`，讀取次數 2；會將正在續跑的任務顯示成已取消，並可停止新迴圈後續追蹤。這是受控重現，未宣稱已在 replay9 發生。指令 `node --input-type=module` stdin actual-function VM，`2026-10-01T02:58:32.490Z`；附錄 A 可重播。
- 修正要求：為 poll／restore／cancel／resume 的狀態套用可辨識的 generation 或等效失效機制；所有 await 返回後先確認仍屬本次生命週期，再更新控制、suggestions、Session 或狀態訊息。不能只補一個 `state.aiPolling` 判斷，因為 resume 後它已重新為 true。補舊 cancelled／failed／completed 晚到與 restore 在途後新啟動的測試。

## 3. 邊界情況

- 判定：不通過。
- 實測通過：focused test 的 missing binary（無程序／root）、null handle、真正空 model store 的 `MODEL_NOT_PREINSTALLED`、no-download 與 process／port／root cleanup（`scripts/test-ollama-ui-offline.mjs:26–47`）；原三案 bundle preflight 與原有 UI-runner ENOENT integration 亦跑過，focused process exit 0。
- 額外十案：以 actual helper source 在 VM 執行 success、near-model（錯誤後綴不得命中 exact model）、spawn-error、零 deadline timeout、non-directory、rm-failure、lstat-EACCES、root-remains、group-unconfirmed、port-open。環境未繼承 secret canary；4096／no-cloud／no-prune 正確；清理不能確認時相應旗標為 false，私有錯誤 canary 未進入摘要。指令 `node --input-type=module` stdin helper VM fault matrix，`2026-10-01T03:00:09.955Z`，exit 0。這些是受控 seam 驗證，不宣稱原生 OS 故障均已實測。
- **P2-02（阻擋）：新增 artifact hash 例外繞過已啟動程序的 finally。** `scripts/verify-electron-ollama-ui.mjs:173–200` 已建立 userData 並 spawn Electron，但 `:208–216` 的 executable／packaged review.js `readFileSync` 位於主 `try`（`:382`）之前。檔案不可讀、I/O 錯誤或存在性檢查後消失時，會直接拒絕 top-level 執行，略過 `:797–826` 的停程序、刪 temp、evidence 寫入及去敏收尾。actual 整份 runner 的 VM fault injection（只剝離 imports，替身 fs／spawn，未啟動 app）注入 EACCES，輸出 `spawned=1,tempCreated=1,cleanupCalls=0,caught=EACCES`，`2026-10-01T02:59:24.187Z`。此問題由本輪新增 artifact 讀取直接觸發。
- 修正要求：所有可能拋例外的 artifact／preflight 動作在任何程序或 temp 建立之前完成，或將資源生命週期自最早配置起納入同一 try/finally；保留 fixed-category error evidence，新增 read-error／exists-read race 的實際 runner 故障測試。
- **P2-03（阻擋）：daemon 啟動 deadline 不涵蓋單次 tags 請求。** `scripts/ollama-ui-local-daemon.mjs:17–30` 只有 socket inactivity timeout，`:62–79` 在 `await readTags()` 外檢查 deadline，成功時不再核對時間。用實際 HTTP loopback fixture 每 20ms 傳空白、250ms 後送合法 tags，呼叫 actual helper `timeoutMs=50`，結果 259ms 後仍 `failureCode=null,preinstalledModelFound=true`。指令 `node --input-type=module` stdin helper／loopback trickle fixture，`2026-10-01T02:59:24.487Z`。fixture 已關閉，無真實 daemon／檔案寫入。若回應一直傳資料且不 end，依此控制流會一直等待，啟動 finally 無法及時進入；无限等待是由已重現的 deadline 越界推導，未實際無限等待。
- 修正要求：以絕對剩餘 deadline 限制每次 request，逾時 destroy／abort，清 timer／listener；控制 tags response 大小，並在成功返回前再檢查 deadline。補持續 trickle／不 end、malformed JSON、HTTP 非 200 與啟動逾時後 owned cleanup 回歸。

## 4. 程式碼品質

- 判定：部分通過。
- 正面證據：selector 共用且不放寬 socket policy（`lib/electron-devtools-target.mjs:6–46`）；daemon env 明列最小欄位、隔離 HOME／TMPDIR、context 4096、parallel 1、no-cloud／no-prune（`scripts/ollama-ui-local-daemon.mjs:42–55`）；tags 以完整 model 名称匹配且沒有 pull（`:74–77`）；清理只取 handle 的 owned PID／root／port（`:89–111`）。runner 使用 exclusive-create（`scripts/verify-electron-ollama-ui.mjs:818–826`），catch 保存固定 stage／category，原始 child log 僅用於分類（`:313–340,786–796`）。
- 隱私結果：獨立讀取十份 evidence，沒有 raw child stderr、字幕 body、API Key 或 supplied absolute candidate／model-store 路徑；保留的 synthetic job URL／Session 摘要是測試識別資料。十案 VM canary 未洩漏到 helper failure 摘要。成功與失敗 runner 的固定 trace 欄位已逐一檢視；不以 source regex 當成唯一證據。
- 缺口：P2-02 的例外不經固定 catch，會讓 runtime 印出原始檔案讀取錯誤，存在帶出本機路徑的風險；此風險是 control-flow 推導，未以真實使用者敏感路徑做故障測試。P2-01 缺乏請求世代隔離，P2-03 混用 inactivity 與總 deadline。修正後須複審。
- 指令／時間：六檔獨立 `node --check <file>` 逐一 exit 0，`2026-10-01T03:00:29.467Z`；同次 `git diff --check` exit 0。

## 5. 測試覆蓋

- 判定：部分通過。
- 開發驗證：主要代理在 `08-CHANGE-LOG.md:22–24` 記載隔離 build／codesign、完整 `npm run check` exit 0 與實機兩正向 replay。完整 check 的原始 console／時間戳未作為本輪獨立運行證據提供，本審查不冒稱自行重跑完整 check。
- 獨立驗證：`2026-10-01T02:57:20Z` 起依序執行 `node scripts/test-review-ui.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-ui-offline.mjs`，三組通過，命令 session 最終 exit 0。offline focused 輸出包括 missing-model daemon integration、三案無模型 bundle preflight 及最終 contract passed；符合本機 prerequisites 的原有 spawn-error integration 亦未 skip。六個指定檔案 syntax、`git diff --check` exit 0（`03:00:29.467Z`）。`npm run docs:check` exit 0、19 個文件（`03:00:09Z` 同次驗證）。
- 缺口：`scripts/test-review-ui.mjs:193` 固定只回傳舊 running，未涵蓋本輪重現的舊終態晚到／快速續跑；缺少 artifact read failure 的完整生命週期測試及 tags trickle 的總 deadline 測試。現有 tests 全綠不能作為這三項邊界已通過的結論。
- 初次診斷 VM 在 `02:58:12Z` 因未排空跨 context microtask 而先於 resume 完成斷言，該失敗只屬 harness timing；改以 `setImmediate` 排空後，`02:58:32.490Z` 重現確認 P2-01。未修改專案測試檔。
- `docs:check:final` 本輪尚未執行，與最新條目「進行中」一致；須由主要代理修正、複審並整合後執行。

## 6. 實際運行結果

- 判定：限定證據通過；錯誤／競速邊界不通過。
- 本輪沒有重跑 live AI UI。已獨立解析十份 evidence，核對 success／failure、時間、scope、cleanup、checkpoint、Session 與 hash。
- replay9：`evidence/2026-10-01-ollama-ui-cancel-resume-replay9.json:8–10` 為 `02:51:21.779Z–02:51:37.657Z`、15,879ms、pass；`:30–58` 確認 Electron group／port／userData／owned daemon 清理且沒有 forced cleanup；`:159–181` 確認取消／reload／resume 各 invariant。`:21–27,46–51` 明載 systemNetworkDisabled=false、Electron 不套 Seatbelt、daemon 不套 Seatbelt、no download。
- 預設 regression：`evidence/2026-10-01-ollama-ui-default-regression-replay1.json:8–10,29–58,73–75,109–143` 為 `02:52:15.449Z–02:52:24.465Z`、9,016ms、pass，兩 cue 完成／接受／undo／redo／保存，原始 SRT hash 相等，cancelResume=null，清理通過且未強制終止。
- replay1–8 全保留 fail：1 target reject；2 checkpoint 不成立且 forced cleanup；3 renderer timeout 且 forced cleanup；4 ai_start assertion failure；5 checkpoint timeout；6–8 local daemon timeout。舊 v3 原件並非每份均有 artifact／stage 欄位，不回填，也不以後來 runner 假定舊 evidence 的缺失欄位。replay4 的 JSON 本身不足以單獨證實「expression 開發錯誤」根因，該說明僅屬開發紀錄（`06-TEST-AND-PROCESS-AUDIT.md:23`）。
- candidate hash：`2026-10-01T02:57` 的 `node --input-type=module` fs／crypto 只讀重新計算，source 及 `/Users/nycu/Documents/離線字幕工廠/dist/acceptance-2026-10-01-cancel-resume/mac-arm64/離線字幕工廠.app/Contents/Resources/app/public/review.js` 同為 `1801f4e20f99be4d4ac6f3b0a199696c1bf8ee5282fc4367c2875b139dd37b55`；候選 executable 為 `e2c0d9054cad3cf0cbc4d10877889425055324ee0b4a447b813c2bc92d9e7a4d`，均對上兩份正向 evidence `:4–6`。這只驗證指定 artifact 身分，不代表整個 dirty tree 或公開版本皆已審查。
- 原件記錄的 exit 0 來自開發紀錄；本審查核驗 JSON pass／invariant 與 hashes，未從 JSON 臆測原 subprocess exit。原件已清理的 checkpoint／reviewed.srt 無法重新讀取，保存的布林與 hash 須連同 runner 實際讀檔／assert 程式（`scripts/verify-electron-ollama-ui.mjs:619–697,736–770`）解讀。

## 綜合判定

- 結論：不通過。
- 可逐字引用的完整結論句：**本輪獨立審查結論為不通過：兩份正常 loopback 實機證據與候選雜湊一致，但取消後快速續跑仍受舊終態回應干擾，artifact 讀取失敗會略過清理，daemon 啟動期限亦未涵蓋持續回應；三項阻擋修正並複審後才能結案，FR-021 整體仍未完成。**
- 阻擋問題：P2-01、P2-02、P2-03，具體位置／重現／修正要求見第 2、3 節。三項均未由本審查代理修正。
- 給主要代理的要求：修正上述三項，將可執行受控案例納入 focused regression；重跑受影響 focused／syntax／適當完整回歸，依差異影響決定是否需新 candidate／新正向 evidence；使用新的 round2 報告複審，不修改本報告或 replay1–9／default 原件。整合逐字引用後執行 final gate。
- 剩餘風險：正常 loopback 兩案不等於斷網、packaged UI offline 仍失敗；合成中英短句不等於長中文品質、乾淨安裝、使用者影片或發布驗收。Windows 暫緩、LM Studio 排除；既有 daemon 高 context／cold-start 根因仍非本輪全面診斷範圍。undo／redo replay 主要證明 UI 操作及狀態訊息，未保存逐 cue 撤銷前後內容或變更計數的独立快照，勿擴大為所有資料恢復細節已驗證。

## 附錄 A：P2-01 的無檔案寫入重播

在 repo 執行下列指令。它讀取 actual 五函式，在 VM 控制 GET／POST 與 timers，不連模型、不啟動 app；最後故意不釋出新 poll 的 VM timer，使測試只檢查舊回應造成的控制覆寫。

```bash
node --input-type=module <<'JS'
import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict';
const src = fs.readFileSync('public/review.js', 'utf8');
const names = ['setAiRunning', 'pollAiOptimization', 'restoreAiOptimizationStatus', 'cancelAiOptimize', 'resumeAiOptimize'];
const extract = n => src.match(new RegExp(`(?:async )?function ${n}\\([^]*?\\n\\}`))[0];
const controls = {runAiOptimize:{disabled:true},cancelAiOptimize:{hidden:false},resumeAiOptimize:{hidden:true,disabled:false}};
let releaseOld, reads = 0; const timers = [];
const c = vm.createContext({state:{aiPolling:true},jobId:'synthetic',API_BASE:'',
  document:{getElementById:id=>controls[id]},setTimeout:f=>{timers.push(f)},
  setAiProgress:()=>{},statusMessage:()=>{},setAiToolbarCollapsed:()=>{},
  requestAiApi:async()=>({ok:true,resumedFromBatch:1}),
  fetch:async()=>({ok:true,json:async()=>({ok:true})}),
  requestAiStatusWithRetry:()=>{reads++; if(reads===1)return new Promise(r=>releaseOld=r);
    return Promise.resolve({status:'cancelled',retryable:true,progress:{completedBatches:1}});}});
vm.runInContext(names.map(extract).join('\n'),c);
const oldPoll=c.pollAiOptimization(); timers.shift()(); await new Promise(setImmediate);
await c.cancelAiOptimize(); c.resumeAiOptimize(); await new Promise(setImmediate);
assert.equal(c.state.aiPolling,true);
releaseOld({status:'cancelled',retryable:true,progress:{completedBatches:1}}); await oldPoll;
assert.equal(c.state.aiPolling,false); assert.equal(controls.cancelAiOptimize.hidden,true);
console.log({reads,polling:c.state.aiPolling,cancelHidden:controls.cancelAiOptimize.hidden});
JS
```

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
