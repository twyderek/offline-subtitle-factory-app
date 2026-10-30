# 獨立審查報告：FR-021 macOS Ollama UI 取消與 checkpoint 續跑驗收 round2

- 審查對象 commit／版本：`299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`／0.51.0 dirty worktree 的 round2 修補基準，非公開 `53956cc` candidate。
- 對應 08-CHANGE-LOG 條目：2026-10-01 — FR-021 macOS Ollama UI 取消與 checkpoint 續跑驗收（`docs/project-management/08-CHANGE-LOG.md:3–32`）。
- 審查輪次：round2；承接本審查角色自行建立的 round1 原件，不沿用主要開發代理對話記憶。
- 啟動時間／上下文來源：`2026-10-01T03:12:13Z`，使用者提供最新差異、candidate、evidence 路徑及前輪阻擋；自行讀取最新程式、文件與原始 evidence。時間均為 UTC，台灣時間加八小時。
- 執行前：重新執行 `npm run project:preflight -- --type=debug`，exit 0；沿用已完整讀取的 AGENTS／治理入口／獨立審查／驗證／偵錯／結案規則，重新讀取 00／03／06／07／08 的本輪內容。
- 審查計畫：三項阻擋逐項核對 → actual-function／whole-runner／actual-helper focused regression → 語法及文件非破壞檢查 → 新 candidate hash 與兩份 evidence → 六面向判定。已完成。
- 基準凍結：本文行號指向 `03:12–03:14 UTC` 已查核的 round2 source；UI SHA-256 為 `6bb93f9939415b21261c92a0adacfad0d5a9e304e97a02900770aeac6e8d1cf9`。後續修正不納入本報告，應另開 round3；未改寫 round1 或任何 evidence。
- 範圍限制：不重跑 live AI UI，不下載模型、不改既有 daemon／系統網路、不發布；只核對已授權的三項修補、直接受影響測試／治理及兩份新實機 evidence。temp／測試自有 daemon 運行產物按使用者允許的 focused 流程清理。
- 路徑慣例：本文未加目錄的治理檔名均位於 `docs/project-management/`；`evidence/`、`reviews/` 也相對該目錄。程式檔路徑相對 repo。

## 1. 需求完整性

- 判定：部分通過。
- 證據：`08-CHANGE-LOG.md:27–32` 的修補計畫與結果對應前輪三項阻擋；`03-FUNCTIONAL-DESIGN.md:95–101` 保存 generation、artifact lifecycle、absolute deadline 設計；`00-CURRENT-STATUS.md:14–15`、`06-TEST-AND-PROCESS-AUDIT.md:25–27` 正確保留正常 loopback、offline packaged UI 仍失敗、FR-021 未整體結案、Windows 暫緩／LM Studio 排除。
- P2-02／P2-03 原始缺口已修正；P2-01 的「舊 poll 終態在 resume 之後抵達」已修正並測到新 Session 完成，但 round1 第 2 節同項要求的「restore 在途後新啟動」仍未覆蓋，actual-function 重現依然會停止新任務 UI polling。詳見第 2 節。
- `2026-10-01T03:13:08Z` 開始的三組 focused 全通過；`03:13:10.114Z` 為剩餘 restore 窗口的受控重現；並未將新正向實機流程誤當成所有競速邊界通過。

## 2. 邏輯正確性

- 判定：不通過。
- P2-01 已修部分：`public/review.js:559–565` 遞增 generation；`:648–655` 在 timer 完成及 status GET 完成後核對 active generation。`scripts/test-review-ui.mjs:206–243` 執行 actual 五函式，將 stale cancelled／failed／completed 安排在 resume 成功後抵達，確認新 polling／cancel 控制未被覆蓋，並完成 `resumed-session`。本審查獨立執行 `node scripts/test-review-ui.mjs`（`03:13:08Z`），exit 0。
- **P2-01 延伸未解除（阻擋）：restore GET 不受 generation 保護。** `public/review.js:726–734` 的成功 cancel 先 `setAiRunning(false)`，立即使 run 按鈕可用，再等待 restore；`restoreAiOptimizationStatus():678–700` 在 GET 返回後未比對原 generation，直接 `setAiRunning(false)`／改控制或 Session。使用者可在 restore 尚未返回時點 run，新的 start POST 已成功且 polling 已啟動；舊 restore cancelled 才抵達，仍會把新任務改為已取消。
- 受控 actual 五函式 VM 重現（含 actual `runAiOptimize`）：cancel POST 成功 → restore GET 暫停 → 確認 run 按鈕 enabled → start POST 成功 → 釋出舊 restore cancelled。`2026-10-01T03:13:10.114Z` 輸出：before `{polling:true,generation:2,cancelHidden:false}`；after `{polling:false,generation:3,cancelHidden:true,resumeHidden:false}`，狀態訊息為「AI 優化已取消，原字幕未變更」。新 poll 的 timer 醒來會因 guard 退出。這是 memory fixture 重現，不宣稱 replay10 實機發生；附錄可重播，未連網、未啟動模型或 app。
- 修正要求：restore 在讀取前捕捉 token，回應／錯誤返回後確認仍屬該生命週期，過期結果不得修改 running／Session／suggestions／訊息；cancel handler 在 await restore 返回後也須避免覆蓋新任務訊息。可採等效的操作隔離，但必須涵蓋 run 按鈕於 restore 在途時已可點擊的實際狀態。補 actual restore-in-flight＋new run／resume 回歸；不需要擴大至新的 provider／平台／斷網驗收。

## 3. 邊界情況

- 判定：部分通過。
- **P2-02 已解除：** `scripts/verify-electron-ollama-ui.mjs:211` 僅初始化空 artifact；`:376–379` 讀取移入主 try，stage 為 artifact_preflight，catch／finally（`:784–824`）固定化 error 並清理 group／temp／evidence。`scripts/test-ollama-ui-offline.mjs:30–69` 執行 whole actual runner（只剝 imports），注入 EACCES，斷言 cleanupCalls=1、temp removals=1、status=fail、stage=artifact_preflight、code=EACCES、userDataRemoved=true，path canary 不進 evidence。本審查獨立 focused 執行通過（`03:13:08Z` 起，最終 exit 0）；未僅驗 regex。
- **P2-03 啟動期限已解除：** `scripts/ollama-ui-local-daemon.mjs:17–38` 使用不因流量重置的 absolute timer；`:76` 限制每次讀取為 startup 剩餘時間與 1 秒之較小值；`:84` 成功後重新檢查總期限；`:89` poll wait capped 剩餘時間。`scripts/test-ollama-ui-offline.mjs:71–98` 使用 actual helper source＋真實 loopback HTTP，每 10ms trickle、250ms 後合法 tags，timeoutMs=50 時須回 `LOCAL_DAEMON_START_TIMEOUT`／modelFound=false。此持久 regression 已獨立跑過，fixture finally 關閉；不啟動 live AI UI。
- missing binary／null handle／真正 empty-store daemon/no-download/cleanup 既有實測仍通過（`scripts/test-ollama-ui-offline.mjs:100–120`）；env／exact-model／owned cleanup 未擴權（helper `:51–65,85–87,99–121`）。
- **P3-01（非阻擋）：宣稱 1 MiB 的 cap 實際計算 UTF-16 字元數。** helper `:26–29` 將 Buffer 轉字串後用 `body.length` 比較，非 bytes。獨立 actual `readTags`＋loopback fixture（`node --input-type=module` stdin，`03:14:05.914Z／03:14:05.922Z`）結果：ASCII JSON 1,100,026 bytes 被 `TAGS_RESPONSE_TOO_LARGE` 拒絕；含 400,000 個中文字的 JSON 1,200,026 bytes、400,026 code units 仍接受 HTTP 200。這是 cap 單位與 `03-FUNCTIONAL-DESIGN.md:101`／`BUG-036:6` 文字不一致，並不重現 deadline 失效或無限 body；字串上限仍存在。
- 建議：累加每個 chunk 的實際 byte length，再 decode／parse，補多位元組輸入 cap 測試；或明確改寫限制單位及可接受 byte 上界。此項可隨上述 UI 修正一併處理，不列為獨立結案阻擋。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：generation guard、artifact 主 finally、tags absolute timer 各自集中於原模組，未修改 server checkpoint／Session 格式。helper 保持 context 4096、parallel 1、no-cloud／no-prune、隔離 HOME／TMPDIR、exact preinstalled model 與 owned process-group／port／root cleanup（`scripts/ollama-ui-local-daemon.mjs:43–65,85–87,99–121`）。新 regression 以 actual code 執行，未以複製替代實作或放寬 socket／network whitelist。
- 隱私：whole-runner EACCES canary assertion（`scripts/test-ollama-ui-offline.mjs:47,69`）通過；runner catch 仍不持久化 error.message／raw logs（`scripts/verify-electron-ollama-ui.mjs:784–794`），exclusive evidence create 保留（`:818`）。新兩份 evidence 只讀檢視未見 raw subtitle body、API token query、API Key 或本機 candidate/store 絕對路徑；fixture 的 synthetic URL／Session 摘要仍限定測試資料。
- 缺口：generation 目前只保護 poll 回應，未保護 restore 及 cancel 的續行，故 P2-01 尚未完整；body cap 單位偏差為 P3-01。
- 語法／whitespace 證據：六檔 `node --check` 各 exit 0、`git diff --check` exit 0（`2026-10-01T03:14:06.076Z` 同次檢查）。

## 5. 測試覆蓋

- 判定：部分通過。
- 獨立驗證：`2026-10-01T03:13:08Z` 起依序執行 `node scripts/test-review-ui.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-ui-offline.mjs`，命令 session 最終 exit 0。輸出含 UI、provider、empty-model integration、三案無模型 bundle preflight、offline contract passed，無 prerequisite skip；whole-runner EACCES 與 actual-helper trickle 位於同一 focused test 前段並正常執行。
- `03:14:06.076Z`：`node --check` 逐一驗證 public/review.js、test-review-ui、verify-electron-ollama-ui、ollama-ui-local-daemon、test-ollama-ui-offline、electron-devtools-target，六檔 exit 0；一般 `npm run docs:check` exit 0（19 文件），`git diff --check` exit 0。
- 開發驗證：`06-TEST-AND-PROCESS-AUDIT.md:27`、`08-CHANGE-LOG.md:32` 記錄主要代理 03:08 UTC 完整 `npm run check` exit 0；使用者交接時稱 capped sleep 一行後第二次完整 check 正在跑。本審查未重新執行完整 check、未取得該第二次原始結果，不把它宣稱為自行驗證或已完成。新語法與 focused 已包含讀到的 capped sleep 程式。
- 尚缺：持久 test 沒有 restore 在途後 new run 的 actual-function 案，故全綠未排除剩餘 P2-01；trickle test 目前斷言最終 timeout，但不單獨量測應在 250ms 完成之前返回，後續可補寬鬆 elapsed bound；多位元組 byte cap 未覆蓋。
- final gate 尚未執行，最新條目「進行中」符合實況；由主代理修正、後續複審及報告整合後執行。

## 6. 實際運行結果

- 判定：限定新 evidence 通過；不代表剩餘競速通過。
- 本輪只讀新實機 evidence，不重跑 live AI UI。`2026-10-01T03:13:38.897Z` 的 Node fs／crypto 指令獨立重算 source／packaged review.js 均 `6bb93f9939415b21261c92a0adacfad0d5a9e304e97a02900770aeac6e8d1cf9`，candidate executable `611dc64c2e830c08baa4fc72ddae72429eea6c80c8f610595136a7369096d266`；對上兩份 evidence 的 `:4–6`。候選：`/Users/nycu/Documents/離線字幕工廠/dist/acceptance-2026-10-01-cancel-resume-round2/mac-arm64/離線字幕工廠.app`。
- `evidence/2026-10-01-ollama-ui-cancel-resume-replay10.json:8–10,29–58,87–91,124–181`：03:08:58.203Z 至 03:09:19.309Z、21,106ms、pass；checkpoint 1/6、persisted suggestion=1、cancel 控制／reload／同 Session、resume 起點 1、六建議／接受／undo／redo／保存，原 SRT hash／時間碼不變，app＋owned daemon 全清理且 forcedCleanup=false。
- `evidence/2026-10-01-ollama-ui-default-regression-replay2.json:8–10,29–58,73–75,109–143`：03:10:03.867Z 至 03:10:13.026Z、9,157ms、pass；兩 cue 完成／接受／undo／redo／保存，cancelResume=null，原 SRT／時間碼不變及全部清理，未強制終止。
- 兩案 `:21–27,46–51` 明載 systemNetworkDisabled=false、Electron／成功 daemon 不套 Seatbelt、無下載／未更改既有服務。這些限定結果與五份治理文件的新內容一致；不解除 offline UI 失敗、模型品質、Windows 或 FR-021 全需求。
- exit 0 為主要代理紀錄／使用者交接證據，非 JSON 自身可證明的 subprocess exit；本審查核驗的是 JSON invariants、時間與 candidate hash。已清除的 checkpoint／SRT 不重新建立，連同 runner 實際讀檔／assert 解讀。沒有覆寫任何新舊 evidence。

## 綜合判定

- 結論：不通過。
- 可逐字引用的完整結論句：**本輪 round2 獨立複審結論為不通過：artifact 讀取失敗清理與 daemon 啟動期限兩項阻擋已解除，舊 poll 終態亦已隔離，但晚到的取消狀態還原仍會停止新任務；兩份新實機證據與候選雜湊一致，尚須修正該競速並複審，FR-021 整體仍未完成。**
- 阻擋：P2-01 的 restore-in-flight 延伸窗口，位置、受控結果及修正要求見第 2 節；原 stale-poll-after-resume 案、P2-02、P2-03 的啟動 deadline 案均不再列為未修正阻擋。
- 非阻擋：P3-01 byte cap 單位不符；建議採 byte 計數並補 UTF-8 fixture。主要代理處理結果應寫回工作條目，勿改本報告。
- 具體下一步：修正 restore／cancel 後續 UI 更新的生命週期隔離，補 actual 新任務正常完成及原 Session 不被覆蓋的回歸；重跑受影響 focused／syntax，依修正影響更新隔離候選／唯一 evidence，取得 round3 報告後整合、執行 final gate。此要求仍限既有 macOS loopback 取消狀態工作，不要求新的離線、Windows、LM Studio 或品質驗收。
- 剩餘風險：正常 loopback／短合成字幕不代表 offline UI、物理斷網、長中文品質、乾淨安裝或發布完成；Windows 暫緩、LM Studio 排除。最終完整 check／final gate 結果須由主代理保存並與當時基準對齊。

## 附錄：restore 在途後 new run 的無寫入重播

在 repo 執行。讀取 actual 五函式，所有 UI／POST／GET／timer 在記憶體控制；不連網、不啟動 app，也不寫入檔案。新 poll timer 故意不釋出以檢查晚到 restore 的覆寫。

```bash
node --input-type=module <<'JS'
import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/review.js','utf8');
const names=['setAiRunning','pollAiOptimization','restoreAiOptimizationStatus','cancelAiOptimize','runAiOptimize'];
const extract=n=>s.match(new RegExp(`(?:async )?function ${n}\\([^]*?\\n\\}`))[0];
const controls={runAiOptimize:{disabled:true},cancelAiOptimize:{hidden:false},resumeAiOptimize:{hidden:true},
  aiPromptMode:{value:'translate'},aiPreserveTiming:{checked:true},aiScope:{value:'all'},aiInstructions:{value:''}};
let releaseRestore; const timers=[];
const c=vm.createContext({state:{aiPolling:true,aiPollingGeneration:0,aiSuggestions:new Map()},jobId:'synthetic',API_BASE:'',
  document:{getElementById:id=>controls[id]},setTimeout:f=>{timers.push(f)},setAiProgress:()=>{},statusMessage:()=>{},
  setAiToolbarCollapsed:()=>{},aiRequestCues:()=>[{id:1,text:'fixture'}],getAiLanguage:()=> 'en',
  renderCueList:()=>{},updateAiSuggestionActions:()=>{},isNetworkFetchFailure:()=>false,
  fetch:async()=>({ok:true,json:async()=>({ok:true})}),requestAiApi:async()=>({ok:true}),
  requestAiStatusWithRetry:()=>new Promise(r=>releaseRestore=r)});
vm.runInContext(names.map(extract).join('\n'),c);
const cancelling=c.cancelAiOptimize(); await new Promise(setImmediate);
assert.equal(controls.runAiOptimize.disabled,false);
c.runAiOptimize(); await new Promise(setImmediate); assert.equal(c.state.aiPolling,true);
releaseRestore({status:'cancelled',retryable:true}); await cancelling;
assert.equal(c.state.aiPolling,false);
console.log({polling:c.state.aiPolling,generation:c.state.aiPollingGeneration,cancelHidden:controls.cancelAiOptimize.hidden});
JS
```

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
