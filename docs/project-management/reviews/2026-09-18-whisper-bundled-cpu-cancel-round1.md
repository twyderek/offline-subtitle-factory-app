# 獨立審查報告：production-mode Whisper bundled CPU retry 取消補驗

- 審查對象 commit／版本：`17df9788abf2cf964d52df10b74f9a8fcd7a45d6` 的 0.51.0 未提交工作樹；`scripts/verify-whisper-production-fallback.mjs` SHA-256 `a5b3f2df36ede7afd48aee51b2920fc2df9f6b883c789bb3366e1890de739d03`，指定 evidence SHA-256 `769003d0e77812cefcc6a1fa91064cf4dcadbbeed093b01c256538fb1af14c45`。
- 對應 08-CHANGE-LOG 條目：2026-09-18 — production-mode Whisper bundled CPU retry 取消補驗（BUG-WHISPER-METAL-139／BUG-026），`docs/project-management/08-CHANGE-LOG.md:3`。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-09-18 約 14:00 CST；由需求方直接指定此條目與審查範圍，在獨立審查上下文讀取 `AGENTS.md`、執行 `npm run project:preflight -- --type=debug` 並讀取所列路由文件；未沿用開發代理的對話記憶。

## 1. 需求完整性
- 判定：部分通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:10-18` 要求真實 bundled CPU child spawn 後 API 取消、先 `running/cancelling` 再 `cancelled`、兩次 invocation、清理與保留；`package.json:23` 的 alias 指向 `--cancel-bundled-cpu`。`scripts/verify-whisper-production-fallback.mjs:315-339,379-408` 對正常路徑逐項斷言，指定 evidence `docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-verified.json:47-102` 與獨立重播一致。但 `08-CHANGE-LOG.md:12` 同時要求 probe 中斷時先要求取消並等待 child close；`scripts/verify-whisper-production-fallback.mjs:423-438` 在 API 取消／等待失敗時直接停止 server、刪除暫存樹，沒有 wrapper／真實 CPU child 的獨立關閉確認，故失敗清理契約未完整滿足。

## 2. 邏輯正確性
- 判定：部分通過
- 證據：`scripts/verify-whisper-production-fallback.mjs:186-241` 的 wrapper 首次寫受控 Metal 139，CPU 分支以原參數 spawn 固定 bundled binary；收到 wrapper `SIGTERM` 時轉送給 child，child `close` 後寫 signal／exit／forcedKill 結果，並延後 wrapper exit。`server.mjs:1551-1577,2120-2138,2166-2183` 對應 API 的 cancelling 狀態、SIGTERM 與 wrapper close 後的清理／終態。獨立取消重播 `2026-09-18T06:04:08.958Z`（`/private/tmp/osf-review-bundled-cpu-cancel-20260918-1405-b.json:47-102`）顯示 CPU `signal=SIGTERM`、`forcedKill=false`、兩次 invocation 與 `cancelled`。缺口在 probe 的 `finally`：取消 API 或 `waitForJob` 失敗被空 `catch` 略過，`stopProcess` 只對 server PID 發訊號（同檔 `:121-134`），不能由此保證其子孫程序已關閉。

## 3. 邊界情況
- 判定：部分通過
- 證據：既有 evidence 路徑重用於 2026-09-18 約 14:09 CST 被 `scripts/verify-whisper-production-fallback.mjs:19` 拒絕，退出碼 1；該 JSON 的 SHA-256 前後同為 `924796a0272cb09cc4521acf7a961990578fc32fe9a3705ca6d26c04e595cae2`。全新 `/private/tmp` 中的寫入故障注入（`2026-09-18T06:06:56.407Z`）於 CPU spawn 後回報 `fail`，隔離根目錄消失、唯一暫存路徑未見存活程序。再注入 probe 端 API 不可用（`2026-09-18T06:08:09.558Z`）也回報 `fail`、隔離根目錄消失且檢查時未見該路徑程序；但失敗 evidence 的 `job.status=null`、沒有 wrapper／child close 或終態記錄，這次未觀察到殘留程序不能證明一般 API 不可用／child 卡住時仍安全。預設沙箱的取消重播於 `2026-09-18T06:03:53.567Z` 在 server ready 前退出，未進入 ASR，已與受控權限結果分開看待。

## 4. 程式碼品質
- 判定：部分通過
- 證據：`scripts/verify-whisper-production-fallback.mjs:11-19` 的模式互斥與 exclusive evidence 寫入、`:136-165` 的受控／真實來源標籤、`:322-336` 的 `partialArtifactsSource=probe-injected-after-bundled-cpu-spawn` 均清楚；`docs/project-management/00-CURRENT-STATUS.md:32`、`03-FUNCTIONAL-DESIGN.md:59`、`06-TEST-AND-PROCESS-AUDIT.md:18-24`、`07-DEBUG-AND-FIX-HISTORY.md:3-9` 與 JSON 沒有把 probe 注入 partial 或受控 Metal 139 誤稱真實 CLI 產物。`scripts/verify-whisper-production-fallback.mjs:423-438` 的空 catch 使清理失敗不可診斷，失敗 evidence 也未記錄取消 API 結果、job 終態、wrapper／child close；`stopProcess` 不管理子程序樹，是本輪主要品質缺口。

## 5. 測試覆蓋
- 判定：部分通過
- 證據：2026-09-18 約 14:03-14:06 CST 獨立執行 `node --check scripts/verify-whisper-production-fallback.mjs`、受控權限 `npm run acceptance:whisper:bundled-cpu-cancel -- /private/tmp/osf-review-bundled-cpu-cancel-20260918-1405-b.json`、`npm run acceptance:whisper:hybrid-fallback -- /private/tmp/osf-review-hybrid-20260918-1405-a.json`、`npm run acceptance:whisper:production-fallback -- /private/tmp/osf-review-controlled-20260918-1405-a.json`、`npm run check`、`git diff --check`，均退出碼 0；`npm run check` 包含治理、語法、Whisper policy 與核心 API 回歸。hybrid `2026-09-18T06:04:42.277Z` 為 `completed/ready-review`、CPU exit 0；controlled `2026-09-18T06:04:57.453Z` 也為 `completed/ready-review`。兩次失敗注入在 `/private/tmp` 臨時執行，沒有形成專案內可重跑的 API 不可用／子程序關閉斷言；`npm run check` 本身亦未呼叫新增 acceptance alias。

## 6. 實際運行結果
- 判定：部分通過
- 證據：指定 evidence `docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-verified.json:11-21,47-109` 的 bundled binary／Tiny SHA-256 與本機 `shasum -a 256` 相同；獨立取消重播 `2026-09-18T06:04:08.958Z` 退出碼 0，記錄 `running/transcribing` → `running/cancelling` → `cancelled/cancelled`、wrapper SIGTERM marker、child `close` marker 與 `signal=SIGTERM`、無 forced kill、精確 `metal,cpu`、固定 SRT／JSON／draft／quality／WAV 不存在且 edit plan 保留。60 秒靜音在取消時未完成推論，不能用來評定品質。故障注入 evidence `/private/tmp/osf-review-bundled-cpu-cancel-injected-failure-20260918.json` 與 `/private/tmp/osf-review-bundled-cpu-cancel-api-loss-20260918.json` 均為預期 `fail`，暫存根目錄已刪；後者沒有終態與 child close 證據。預設沙箱 server ready 前退出的結果只顯示該執行邊界未能測到產品流程，不等同產品失敗。

## 綜合判定
- 結論：不通過
- 可逐字引用完整結論句：**本輪「2026-09-18 — production-mode Whisper bundled CPU retry 取消補驗（BUG-WHISPER-METAL-139／BUG-026）」round1 獨立審查結論為不通過：受控權限下真實 bundled CPU child 的 SIGTERM、close、取消終態、固定輸出清理與 hybrid／controlled 回歸均已獨立重播通過，且 Metal 失敗及 partial 輸出來源標示正確；但 probe 在取消 API 或等待終態失敗時只停止 server 並刪除暫存樹，未保證或記錄 wrapper 與真實 CPU child 關閉，與本輪中斷清理要求不符，須補強後以新一輪報告複審。**
- 阻擋問題（若有）：`scripts/verify-whisper-production-fallback.mjs:423-438` 的失敗清理只嘗試 API 取消；失敗後 `stopProcess` 只處理 server，沒有可查證的 wrapper／CLI 終止與等待。API 不可用的受控故障注入未觀察到殘留程序，但亦未取得 child close／終態證據，不能據此結案這項清理保證。
- 剩餘風險：同次真實 bundled Metal 自身 crash→CPU、真實 CLI partial 輸出、中文語音品質、完整 60 秒推論、Windows、乾淨安裝與發布均不在此次驗收；`08-CHANGE-LOG.md:5,19-21` 仍標示進行中／待執行，結案檢查應由主要代理在修正與新一輪審查後處理。
- 給主要開發代理的具體修正要求（若有）：在 probe 端追蹤 wrapper／CPU 子程序或建立可安全回收的獨立 process group；當取消 API 失敗或等待逾時時，先有界終止並確認 wrapper 與真實 CPU child 已關閉，再移除暫存資料。失敗 evidence 記錄各步清理結果與未關閉程序狀態，增加可重跑的故障注入驗證；修正後保留本 round1 原文，以 round2 複審正常取消、API 失敗與兩個舊模式。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
