# 獨立審查報告：production-mode Whisper bundled CPU retry 取消補驗

- 審查對象 commit／版本：`17df9788abf2cf964d52df10b74f9a8fcd7a45d6` 的 0.51.0 未提交工作樹；round1 指出的 probe cleanup 修正位於目前 `scripts/verify-whisper-production-fallback.mjs`。
- 對應 08-CHANGE-LOG 條目：2026-09-18 — production-mode Whisper bundled CPU retry 取消補驗（BUG-WHISPER-METAL-139／BUG-026），`docs/project-management/08-CHANGE-LOG.md:3-23`。
- 審查輪次：round2。
- 審查代理啟動時間、上下文來源：2026-09-18（Asia/Taipei）；在獨立審查上下文讀取 `AGENTS.md`、`docs/project-management/README.md`、preflight 列出的 full 核心／路由文件、目前工作紀錄、腳本、兩份 final evidence 與 round1 報告；未沿用開發代理對話記憶。

## 1. 需求完整性
- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:11-16` 要求 production server 中受控 Metal 139 後由真實 bundled `whisper-cli --no-gpu` CPU retry，CPU child spawn 後經 API 取消，依序觀察 `running/cancelling`→`cancelled`，清理 ASR partial／quality／WAV 並保留非 ASR edit plan；同條目亦要求 probe 中斷時先取消／等待 child close、再停止 server。正常 final evidence `docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-final.json` 的 `status=pass`、`invocations=["metal","cpu"]`、取消生命週期、清理與保留欄位均符合。round1 所指出的失敗收尾缺口已由目前腳本 `scripts/verify-whisper-production-fallback.mjs:122-165,463-519` 補為獨立 process group 的 SIGTERM、有界等待、必要 SIGKILL、group 消失確認後才移除暫存；API-loss final evidence `docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-api-loss-final.json` 以預期 `status=fail` 記錄 `PROBE_CANCEL_API_LOSS`，同時 `expectedFaultSafelyHandled=true`。

## 2. 邏輯正確性
- 判定：通過
- 證據：`scripts/verify-whisper-production-fallback.mjs:320-325` 以 `detached: true` 建立 production server process group；`:350-379` 僅在 bundled CPU ready 且仍為 `running/cpu` 後注入 partial、呼叫取消並驗證 `running/cancelling`；`:255-275` 的 wrapper 轉送 SIGTERM、等待真實 bundled child `close` 後寫入結果與 close marker；`:136-165` 的 `stopIsolatedProcessGroup` 以負 PGID 終止整組程序，2.5 秒後才可升級 SIGKILL，並以 `groupGone` 作為刪除暫存前提。正常獨立重播（2026-09-18T07:59:50.172Z–07:59:52.404Z）得到 child `signal=SIGTERM`、`forcedKill=false`、`groupGone=true`；API-loss 重播（2026-09-18T08:00:05.116Z–08:00:06.757Z）未呼叫取消 API，但同樣得到 wrapper／child close、`groupGone=true` 與暫存移除。這清楚區分正常產品取消成功與故障注入的安全收尾，不把故障注入的 probe `fail` 誤判成產品取消成功。

## 3. 邊界情況
- 判定：通過
- 證據：本輪實際重播四條路徑：正常 bundled CPU 取消 `npm run acceptance:whisper:bundled-cpu-cancel -- /private/tmp/osf-review-round2-normal-20260918.json` exit 0；`--simulate-cancel-api-loss` exit 1 且 error code 為 `PROBE_CANCEL_API_LOSS`；舊 hybrid bundled CPU completion `npm run acceptance:whisper:hybrid-fallback -- /private/tmp/osf-review-round2-hybrid-20260918.json` exit 0；舊 controlled production fallback `npm run acceptance:whisper:production-fallback -- /private/tmp/osf-review-round2-controlled-20260918.json` exit 0。API-loss evidence 明確記錄 `fallbackApiCleanup.outcome=unavailable-by-probe-injection`、`wrapperSigtermMarker=true`、`bundledCpuClosedMarker=true`、`bundledCpuResult.signal=SIGTERM`、`tempRootRemoved=true`、`expectedFaultSafelyHandled=true`；因此 round1 的「未證實 child 關閉」邊界已被直接覆蓋。失敗注入仍保持 probe exit 1，符合故障驗證語意。

## 4. 程式碼品質
- 判定：通過
- 證據：`scripts/verify-whisper-production-fallback.mjs:11-20` 保留模式互斥與 exclusive evidence 寫入；`:122-165` 將程序群組收尾封裝為可檢查結果；`:480-513` 在讀取 child 結果後才形成 cleanup evidence，只有 `groupGone` 才移除 temp，無法確認時保留診斷路徑並讓 evidence／exit 狀態失敗。`docs/project-management/03-FUNCTIONAL-DESIGN.md:59`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-10` 與兩份 final evidence 均明確說明 wrapper 注入 Metal failure、partial 是 probe 注入，沒有把它們誤稱為 bundled Metal 真實 crash 或 CLI 自行產物。`node --check scripts/verify-whisper-production-fallback.mjs` 與 `git diff --check` 於本輪通過；未發現 round1 所指的空泛 cleanup 或無法診斷的 temp 刪除路徑。

## 5. 測試覆蓋
- 判定：通過
- 證據：本輪於 2026-09-18 Asia/Taipei 實際執行 `node --check scripts/verify-whisper-production-fallback.mjs`、兩次 bundled CPU cancel acceptance、hybrid acceptance、controlled production acceptance、`npm run check` 與 `git diff --check`。正常取消與兩個舊模式均 exit 0；API-loss 故障注入按預期 exit 1，且 cleanup evidence 安全收尾欄位全為真。`npm run check` 包含 `docs:check`、JavaScript syntax、Whisper policy／model／download／SRT、治理 validator、AI provider／optimizer、review UI 與核心 API 回歸，最後輸出「核心回歸測試通過」。兩份 repo final evidence 也以 `jq`／Node 直接檢查正常取消的終態、兩次 invocation、SIGTERM／close／清理，以及 API-loss 的預期錯誤與安全收尾。`npm run docs:check:final` 退出 1 的唯一原因是目前 `08-CHANGE-LOG.md:5,19-20` 尚未由主要代理完成結案欄位；本輪未修改該檔案，這是文件收尾狀態，不是本輪 acceptance 行為失敗。

## 6. 實際運行結果
- 判定：通過
- 證據：受控權限下的正常重播 `/private/tmp/osf-review-round2-normal-20260918.json` 在 macOS arm64／Node v22.22.3／production server／loopback-only 條件下記錄：`status=pass`、job `cancelled/cancelled`、metrics `whisper.cpp/cpu/tiny`、logs 含 Metal 139／CPU fallback、invocations 精確為 `metal,cpu`、取消前 `running/transcribing`、取消後 `running/cancelling`、CPU child `SIGTERM` close 且無 forced kill；draft、partial SRT／JSON、quality metadata 與 WAV 均清除，edit plan 保留。受控 API-loss 重播 `/private/tmp/osf-review-round2-api-loss-20260918.json` 記錄預期 `status=fail`／`PROBE_CANCEL_API_LOSS`，但 wrapper／bundled CPU close marker、child `SIGTERM`、process group 消失與暫存移除均成立，故障安全收尾成立。repo 內兩份 final evidence `2026-09-18-whisper-bundled-cpu-cancel-final.json` 與 `2026-09-18-whisper-bundled-cpu-cancel-api-loss-final.json` 與上述獨立重播一致。這些結果只驗證 wrapper 控制的首次 Metal failure、真實 bundled CPU child 取消與 probe 收尾，不宣稱 bundled Metal 自身 crash、真實 CLI partial 輸出、中文品質、長音訊、Windows、乾淨安裝或發布已完成。

## 綜合判定
- 結論：通過
- 可逐字引用完整結論句：**本輪「2026-09-18 — production-mode Whisper bundled CPU retry 取消補驗（BUG-WHISPER-METAL-139／BUG-026）」round2 獨立複審結論為通過：round1 指出的取消 API 失敗收尾缺口已由獨立 process group、有界 SIGTERM／必要 SIGKILL、group 消失確認後刪除暫存與 cleanup evidence 修正；正常 bundled CPU 取消已獨立重播通過 running/cancelling→cancelled、精確兩次 metal/cpu invocation、真實 child SIGTERM／close、ASR partial／quality／WAV 清理與非 ASR edit plan 保留，API-loss 故障注入則按預期以 PROBE_CANCEL_API_LOSS fail 結束但已證實 wrapper／CPU child 關閉、process group 消失與暫存安全移除，另兩個舊 fallback 模式及完整 npm run check 均通過；本結論仍限於 macOS arm64、本機合成 60 秒音訊與 wrapper 控制的 acceptance 範圍，不代表 bundled Metal 自身 crash、真實 CLI partial、中文品質、長音訊、Windows、乾淨安裝或發布已驗收。**
- 阻擋問題（若有）：無。本輪不得修改 `08-CHANGE-LOG.md`，故 `npm run docs:check:final` 仍待主要代理將最新條目標示完成、填入 round2 報告連結與逐字引用；這是後續文件結案條件，不是本輪已發現的產品或 acceptance cleanup 阻擋。
- 剩餘風險：首次 Metal exit 139 與 partial 檔案仍由 wrapper 控制；probe partial 不是 bundled CLI 自行產物，server 仍透過 wrapper 轉送訊號；未驗證真實 bundled Metal crash→CPU、長音訊／中文品質、Windows process tree、乾淨安裝或發布。
- 給主要開發代理的具體修正要求（若有）：將本報告路徑與上述完整結論句逐字連結至 `08-CHANGE-LOG.md` 最新條目，將條目完成狀態與獨立審查欄位補齊後，重跑 `npm run docs:check:final`；不得修改本 round1 或本 round2 報告。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
