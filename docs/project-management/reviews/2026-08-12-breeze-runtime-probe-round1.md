# 獨立審查報告：Breeze runtime／模型外部驗收探針（FR-024）

- 審查對象 commit／版本：分支 codex/breeze-model-planning，HEAD 9cdadc613c11b0fe189ebe0f336ccc9c9e32701f；工作樹含本輪未提交 FR-024 探針變更
- 對應 08-CHANGE-LOG 條目：2026-08-12 — Breeze runtime／模型外部驗收探針（FR-024）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-12 15:38（Asia/Taipei）；由主要代理以獨立子代理上下文啟動，未沿用主要代理對話記憶
- 審查環境：macOS、Node.js v22.22.3；未下載 3 GB checkpoint，未安裝 Python／PyTorch／patched Whisper runtime

## 問題摘要

### P1 — runtime probe timeout 會過早 settle，且不清理 process tree

- lib/breeze-runtime-probe.mjs:27-45 在 timeout 時呼叫 child.kill('SIGKILL')，隨即 finish() 並 resolve；不等待 child close，也沒有確認 kill 成功或清理 descendant process。
- 2026-08-12 15:42:12 的注入式測試以 mock child 讓 close 延遲 1 秒：probe 在約 253 ms 回傳 timedOut:true，回傳時 closeObservedBeforeReturn:false。因此呼叫端收到完成報告時 child 仍可能存在。
- 2026-08-12 15:42:23 的真實 process 測試讓 probe child 啟動一個持續執行的 Node descendant；timeout 後回報 timedOut:true，檢查到 descendantAliveAfterTimeout:true。測試腳本最後才手動 SIGKILL 該 descendant，證明實作本身未完成 process-tree cleanup。
- 同一風險也存在既有 lib/process-probe.mjs:10-24（server 的 Breeze capability path 仍經 server.mjs:923 使用）：timeout 只 kill 直接 child、以 exit/error settle，沒有 close／tree completion 保證。
- 影響：卡住或會孳生子程序的外部 Python／patched runtime 可能在探針已報 timeout、CLI 已退出或 server probe 已回報缺件後繼續耗用 CPU／記憶體；Windows 亦沒有 taskkill /T /F 或等價 process-tree 保證。這不滿足本輪要求的 runtime command timeout／child cleanup。
- 修正要求：timeout 後須採平台適用的 process-tree 終止策略，等待 direct child close 與 tree-kill 完成（或明確失敗）後才 resolve；需測試 stubborn child、descendant 與 kill 失敗／延遲 close，且不得讓後續 probe／server 狀態在 child 尚未結束時假設資源已釋放。

### P2 — JSON 報告未做敏感資訊／路徑最小化

- scripts/probe-breeze-asr.mjs:24-35 直接輸出 python、modelDirectory、model path、以及 runBreezeRuntimeProbe() 收集的 stdout/stderr 尾段（lib/breeze-runtime-probe.mjs:36 最多各 4000 字元）。
- 2026-08-12 15:42:03 以自訂 runtime stderr SECRET_MARKER=do-not-share /Users/example/private 實測，JSON 原樣包含該內容；目前不會把 report 寫入檔案，也沒有 secret/path redaction 或 --json 與人類輸出之差異（scripts/probe-breeze-asr.mjs:34 兩者相同）。
- 探針本身未顯式把 API key 放進 payload，且正式 server 不把結果寫入設定；但 raw external stderr／絕對路徑可洩漏使用者名稱、工作區或 runtime 自行輸出的 token。應在文件中明示輸出可能含敏感診斷資訊，或採路徑遮罩／敏感模式並建立測試。

## 1. 需求完整性

- 判定：部分通過
- 證據：docs/project-management/02-REQUIREMENTS-ANALYSIS.md:40 要求固定 Breeze checkpoint、whisper.available_models() 能力檢查、缺件不得啟動或假成功、Whisper.cpp 維持預設；docs/project-management/03-FUNCTIONAL-DESIGN.md:61-63 要求固定 metadata、外部 runtime 與缺件阻擋。lib/breeze-runtime-probe.mjs:49-61 聚合模型與 runtime 狀態，buildBreezeRuntimeProbeArgs()（lib/breeze-asr.mjs:61-63）確實檢查 available_models()。但 timeout 時未完成 child cleanup，故 runtime probe 的完整驗收契約尚未滿足。
- 固定 revision／檔名／大小／SHA 契約由 scripts/test-breeze-asr.mjs:18-35 覆蓋；CLI 可用 --model-dir、--python、--timeout-ms（scripts/probe-breeze-asr.mjs:16-23），缺件報告以 ready:false 結束非零（2026-08-12 15:39:11 實測 exit 1）。

## 2. 邏輯正確性

- 判定：部分通過
- 通過證據：模型 inspector 使用 fs.promises.stat 與 fs.createReadStream（lib/breeze-asr.mjs:20-58），未使用同步檔案 I/O；collectBreezeRuntimeProbe() 以 model.valid && runtime.ok 聚合 ready（lib/breeze-runtime-probe.mjs:49-61）；未指定 command 有明確失敗結果（lib/breeze-runtime-probe.mjs:22-24）。
- 阻擋證據：timeout 路徑在 lib/breeze-runtime-probe.mjs:38-41 先 kill、再立即 finish；finish 不等待 close。真實 descendant 實測（上述 15:42:23）確認 cleanup 缺口，而非僅靜態推論。
- 正式路徑未被本輪探針變更改動：public/index.html:217-218 仍以 Whisper.cpp 為 selected 建議預設，server.mjs:862-863 未指定引擎仍回退 whisper-cpp／tiny（lib/whisper-models.mjs:29,43）。

## 3. 邊界情況

- 判定：部分通過
- 實測邊界：
  - 缺 Python executable：2026-08-12 15:39 左右以 runBreezeRuntimeProbe({command:'/definitely/not/a/python'}) 得到 ok:false、error: spawn ... ENOENT。
  - timeout：scripts/test-breeze-asr.mjs:64-65 以永久 interval 驗證 timedOut:true；注入延遲 close 與 descendant 測試進一步證明 child 尚未完成時已回傳。
  - runtime module／模型缺件：2026-08-12 15:39:11，npm run probe:breeze -- --json 回報 python3、ModuleNotFoundError: No module named 'whisper'、模型 reason:"missing"、ready:false，exit 1。
  - stderr 輸出：2026-08-12 15:42:03 自訂敏感 marker 原樣進入 JSON，未遮罩。
- 未覆蓋：Windows process-tree、kill 失敗、child close 延遲／永不 close、外部 runtime 產生大量輸出、模型目錄路徑含特殊字元與實際 3 GB hash。P1 的 process-tree／close 缺口使本面向不能判定完整通過。

## 4. 程式碼品質

- 判定：部分通過
- 證據：resolveBreezePython()（lib/breeze-runtime-probe.mjs:7-18）有明確環境變數、工具目錄與平台候選順序；probe 輸出有 stdout/stderr 4000 字元上限，避免無界累積（lib/breeze-runtime-probe.mjs:36）；CLI 未啟動 pip、下載或字幕 job。
- 品質風險：timeout cleanup lifecycle 沒有獨立的 close/tree-kill state machine，且 child.kill() 回傳值與同步 throw 未被處理；與既有 process-probe 重複另一套不完整終止語意。JSON raw stderr／絕對路徑的輸出契約也未在程式或測試中明確標示為可能敏感。

## 5. 測試覆蓋

- 判定：部分通過
- 2026-08-12 15:38:53：node --check lib/breeze-runtime-probe.mjs && node --check scripts/probe-breeze-asr.mjs && node --check scripts/test-breeze-asr.mjs，exit 0。
- 2026-08-12 15:39:02：node scripts/test-breeze-asr.mjs，exit 0；涵蓋固定 metadata、缺檔／錯大小、runtime success／timeout、Python explicit path、report ready:false 與非同步 inspector source assertion。
- 2026-08-12 15:39:11：npm run probe:breeze -- --json，預期缺件 exit 1；沒有下載／安裝外部元件。
- 2026-08-12 15:40:22–15:40:25：sandbox 內 npm run check 因受控環境禁止 0.0.0.0:22092 listener（EPERM）exit 1；2026-08-12 15:40:46–15:40:54 以核准的受控 loopback 權限重跑同一指令，完整回歸 exit 0，包含 Breeze、Whisper、核心 API／取消與既有測試。
- 2026-08-12 15:40:59：git diff --check，exit 0。
- 覆蓋缺口：現有 timeout 單元只斷言 timedOut 與耗時（scripts/test-breeze-asr.mjs:64-65），沒有斷言 child close 已發生、kill 失敗處理或 descendant 已死亡；沒有 JSON redaction／敏感 stderr 測試。P1 修正後須新增這些測試。

## 6. 實際運行結果

- 判定：部分通過
- 2026-08-12 15:39:11 實際 CLI 報告可重播且正確以非零狀態阻擋缺件；python3 可執行，但 whisper module 與 checkpoint 均不存在。這證明缺件診斷，不證明真實 runtime／模型可用。
- 2026-08-12 15:42:12 注入 mock child 實測 timeout 在 close 前返回；2026-08-12 15:42:23 descendant 實測 timeout 後 descendant 仍 alive。這是目前最重要的實際運行失敗證據。
- 未執行真實模型下載、pip、官方 Python／PyTorch／patched Whisper、真實音訊、Windows／macOS 安裝後流程；符合本輪不下載／不安裝範圍，但不得由 deterministic report 宣稱外部驗收通過。

## 綜合判定

- 結論：有條件通過
- 阻擋問題：P1 timeout 後未等待 direct child close，且未清理 descendant process；需修正 runBreezeRuntimeProbe 與 server 使用的 process-probe／共用終止策略，新增 stubborn child、延遲 close、descendant 與 Windows tree-kill 測試，並重跑本報告指定回歸後以 round2 複審。P2 raw JSON stderr／路徑未遮罩需明示或修正，否則仍是安全與隱私剩餘風險。
- 剩餘風險：真實 3,087,008,569-byte checkpoint、官方 patched runtime／PyTorch、台灣華語與中英混用品質、效能／記憶體、長音訊、跨平台安裝與真實 Windows process tree 均未驗證；探針本身不應被當成品質或正式可用證據。
- 可逐字引用完整結論句：**FR-024 Breeze runtime／模型外部驗收探針 round1 判定為有條件通過：固定模型契約、非同步 inspector、whisper.available_models() 能力檢查、缺件非零報告、Whisper.cpp 預設未改變與完整本機回歸均有證據；但 timeout 僅終止直接 child、未等待 close 且未清理 descendant process，實測 timeout 後 descendant 仍存活，另 JSON 原樣輸出外部 stderr／絕對路徑，故在補齊 process-tree／close lifecycle、敏感輸出處理與對應測試並完成 round2 前，不得宣稱 runtime probe 的 child cleanup 或 FR-024 外部驗收完整通過。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
