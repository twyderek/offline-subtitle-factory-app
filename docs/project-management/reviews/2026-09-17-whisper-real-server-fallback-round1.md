# 獨立審查報告：產品 server 真實 Whisper Metal→CPU fallback 驗收

- 審查對象 commit／版本：目前工作樹／0.51.0 開發中；本輪沒有可單獨代表此工作項目的 commit，且工作樹另有既有修改，以下只審查本條目與其 Whisper fallback 相關程式、測試及證據。
- 對應 08-CHANGE-LOG 條目：2026-09-17 — 產品 server 真實 Whisper Metal→CPU fallback 驗收（BUG-WHISPER-METAL-139）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-09-17（Asia/Taipei；本回合以 `npm run project:preflight -- --type=full` 開始，依序讀取治理核心／full 路由及使用者指定文件；可追溯 focused check 時間為 2026-09-17T11:00:02+0800 起）。本報告為獨立審查上下文，未沿用主要開發代理的評價性結論。

## 1. 需求完整性

- 判定：部分通過
- 證據：`08-CHANGE-LOG.md:12-18` 將成功條件拆成正常 Metal path 與「當次觀察到 Metal exit 139／CPU fallback 才追加 CPU 斷言」；同文件 `:13` 明列不宣稱長音訊、取消中的 retry、其他架構、Windows、乾淨安裝與發布。`scripts/verify-whisper-real-fallback.mjs:115-150` 確實限制 macOS arm64、要求 bundled runtime／Tiny 存在並以 `NODE_ENV=production`、無 test runner、localhost server 啟動；`:152-218` 建立／啟動任務、要求 `completed`／`ready-review`、SRT／JSON 與暫存 WAV 清理，且只有 fallback marker 同時出現時才要求最終 CPU。可是 `evidence/2026-09-17-whisper-real-server-fallback.json` 的 `job.fallbackObserved` 是 `false`，所以本輪只完成正常 bundled Metal server smoke，未完成「真實 server crash→CPU fallback」的驗收目標；此外 probe 未讀取校閱品質結果來證實 FR-020 的 `rule-score` fallback，只記錄 `qualityMetadata=false`。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：現有 `server.mjs:2047-2204` 的控制流在 macOS arm64、未 force CPU 時使用 Metal；子程序非零退出時於 `:2174-2181` 清除 `.srt`／`.json`、記錄 `Metal exit ... CPU fallback` 並遞迴以 `forceCpu=true` 重試。`server.mjs:1476-1483` 也會清除 Whisper partial SRT／JSON 與 `quality-metadata.json`；取消分支在 `:2166-2172` 先處理 abort，不會把取消誤當 fallback。`test-core.mjs:644-663` 搭配 deterministic fixture 實際驗證 exit 139、CPU retry、`whisperDevice=cpu`、partial output 清理與 `ready-review`，`node scripts/test-whisper-fallback-policy.mjs` 的平台／架構／forceCpu／退出碼矩陣亦通過。Probe `verify-whisper-real-fallback.mjs:210-218` 對正常 Metal 與觀察到 fallback 分支有正確的互斥判斷，沒有把本次正常完成冒充 fallback；但 `:195-200` 將 `stalePartialOutput` 直接寫成 `false`，沒有實際檢查 partial output 是否殘留，故 evidence 欄位的語意強於實際驗證。

## 3. 邊界情況

- 判定：部分通過
- 證據：已實際覆蓋的邊界包括：probe `:116-121` 的非 macOS arm64／缺 runtime／缺模型／不可執行檔拒絕；`evidence/2026-09-17-whisper-real-server-fallback.json` 的 production、loopback-only、testRunnersDisabled、生成 1 秒 16 kHz mono silence WAV、輸出存在與 `whisper-input.wav` 清理；以及 `test-core.mjs:644-663` 的受控 Metal partial output 清理和 `:773-804` 的 Whisper.cpp 取消／quality metadata 清理。未覆蓋真實 server 的 CPU retry 取消競態、CPU retry 失敗、長音訊、真實語音品質、其他 macOS 架構、Windows、乾淨安裝與使用者媒體；這些也在 `00-CURRENT-STATUS.md:23-26`、`06-TEST-AND-PROCESS-AUDIT.md:33-41` 及 `07-DEBUG-AND-FIX-HISTORY.md:34-36` 如實列為未完成。另有可由 source 直接確認的重播缺口：probe `:17` 隨機選 24000–24999 port，但 server `:4721-4751` 遇占用會改用另一個 port；probe `:59-72` 仍只輪詢原始 `apiBaseUrl`，因此 port 碰撞時可能錯誤逾時。這是本 probe 的實際邊界缺陷，非本次 artifact 已發生的結果。

## 4. 程式碼品質

- 判定：部分通過
- 證據：`verify-whisper-real-fallback.mjs:8-21` 使用明確 app／tools／暫存路徑、拒絕覆寫既有 evidence、記錄 runtime／model SHA-256；`:125-150` 使用最小化 child env、`NODE_ENV=production`、`shell` 預設不開啟；`:225-234` 以 finally 停止 server、寫入 evidence 並清理暫存資料。`package.json:15-22` 正確 wiring `acceptance:whisper:fallback`；`git diff --check` 通過。主要品質問題是 probe 宣告 `stalePartialOutput=false` 卻沒有檢查，且未記錄 server 實際綁定 port；此外 `:229-233` 的清理位於 evidence 寫入之後，若寫檔／mkdir 在 finally 內拋錯，`fs.rmSync(dataDir)` 可能不會執行，失敗路徑的暫存清理因此未被可靠保護。這些不改變已保存 artifact 的本次結果，但降低 probe 作為可重播驗收工具的可信度。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：本審查於 2026-09-17 約 11:00（Asia/Taipei）實際執行 `node --check scripts/verify-whisper-real-fallback.mjs`（exit 0）、`node scripts/test-whisper-fallback-policy.mjs`（exit 0）、`npm run docs:check`（exit 0，19 個治理文件）及 `git diff --check`（exit 0）。同一審查回合執行 `npm run check`（exit 0），包含 Whisper fallback policy／model／download／SRT／quality、治理、AI、UI 與核心回歸；末段輸出為「核心回歸測試通過」。既有 deterministic fallback 覆蓋可由 `test-core.mjs:644-663` 與 `06-TEST-AND-PROCESS-AUDIT.md:18-24` 回溯。既有實機 evidence 的 acceptance probe 於 `2026-09-17T02:48:54.895Z`–`02:48:59.153Z`（Asia/Taipei 10:48:54–10:48:59）exit 0，但只走正常 Metal path。缺口是沒有在本輪 probe 中實際跑到 `fallbackObserved=true` 分支，沒有 probe 的 port-collision／stalePartialOutput 負向測試，也沒有同一次 production server run 的真實 crash→CPU、CPU 失敗、取消中的 retry 或長音訊回歸；完整 `npm run check` 也不能替代這些 real bundled server acceptance。

## 6. 實際運行結果

- 判定：部分通過
- 證據：`evidence/2026-09-17-whisper-real-server-fallback.json` 記錄環境為 darwin／arm64、Node v22.22.3，runtime SHA-256 `6167fe...c7a08`、Tiny SHA-256 `be07e0...1b21`；server 為 `mode=production`、`loopbackOnly=true`、`testRunnersDisabled=true`。任務 `created=true`、`started=true`、`status=completed`、`stage=ready-review`，metrics 為 `asrEngine=whisper.cpp`、`whisperDevice=metal`、`modelName=tiny`，draft／Whisper.cpp SRT／JSON 均為 true，`whisper-input.wav` 已清理，probe status 為 `pass`。但同一 artifact 的 `logMarkers.metalExit139=false`、`cpuFallback=false`、`fallbackObserved=false`；selected logs 只有啟動／轉錄／完成，沒有 fallback marker。因此本次 production-mode server 真實 bundled Metal path smoke 通過，但不代表真實 server fallback 通過。`evidence/2026-09-17-whisper-bundled-runtime-recheck.json` 的 direct CLI 對照另記錄 Metal exit 139／無 SRT／JSON、CPU `--no-gpu` exit 0／有 SRT／JSON；它是獨立 CLI 對照，沒有在本次 server run 內重現。`test-core.mjs:644-663` 則是 deterministic fixture 控制流證據，不能與 direct CLI 或 production server artifact 合併宣稱為同一層級。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪產品 server 真實 bundled Whisper.cpp 驗收有條件通過：production-mode server 的 bundled Metal path smoke 已在 macOS arm64 以生成 1 秒靜音 WAV 完成至 `ready-review` 並產出 SRT／JSON、清理暫存，但 evidence 的 `fallbackObserved=false`，故不可宣稱真實 Metal crash→CPU fallback 已通過；deterministic fixture 僅證明 server child-process 的受控 exit 139→`--no-gpu` CPU retry 與 partial output 清理控制流，direct CLI 對照僅證明同一 bundled runtime 的獨立 Metal exit 139／CPU 成功結果，兩者均不等同於本次產品 server 真實 fallback。**
- 阻擋問題（若有）：
  1. 本次真實 production server run 沒有同時觀察到 `Metal exit 139` 與 `CPU fallback`，因此 BUG-WHISPER-METAL-139 的真實 server crash→CPU fallback 驗收尚未關閉；不得以 deterministic fixture 或 direct CLI 對照替代。
  2. Probe 的隨機 port 沒有讀取 server 在碰撞後選出的實際 port；需改為固定可驗證的綁定／握手或讀取 server 回報的實際 port，否則重播可靠性不足。
  3. Evidence 的 `stalePartialOutput=false` 是固定值，不是檢查結果；需補實際 partial／stale output 斷言，並確認 fallback 分支的輸出有效性與清理。
- 剩餘風險：CPU JSON 缺少 segment-level confidence／no-speech，品質流程只能依設計回到 `rule-score`，本次 probe 未實際讀取 review quality source；1 秒靜音 WAV 不代表中文語音品質、長音訊效能或記憶體行為。取消中的 retry、CPU retry 失敗、其他 macOS 架構、Windows、乾淨安裝、真實使用者媒體與正式發布仍未覆蓋。Evidence 的 `externalNetwork=false` 表示本 probe 未配置外部 endpoint，不是作業系統層級斷網證明；LM Studio 依明確範圍未執行。工作樹含多項非本輪修改，未以單一 commit 鎖定所有變更，後續整合時仍需避免把其他工作項目的結果歸入本輪。
- 給主要開發代理的具體修正要求（若有）：先修正 probe 的實際 port 握手與 stale output 真實斷言／失敗路徑清理，再於同一次 `NODE_ENV=production` bundled server run 取得可回溯的 `Metal exit 139`、`CPU fallback`、最終 `whisperDevice=cpu`、SRT／JSON 完整與暫存清理證據；完成後重新跑受影響測試並以 round2 複審，不得修改或覆寫本 round1 報告。主代理結案時另須把本報告路徑與本結論句逐字回填工作紀錄，並在結案前重新執行 final docs gate。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪未啟動 LM Studio、未呼叫外部服務、未重播會新增 acceptance evidence 的 probe；執行的完整 `npm run check` 僅使用專案 deterministic 測試與其本機暫存／localhost 測試 server。
- 若上述聲明不實，本報告無效。
