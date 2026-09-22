# 獨立複審報告：Whisper production probe 啟動失敗診斷可觀測性

- 審查對象 commit／版本：`17df978`、`codex/0.51-anthropic-claude`、0.51.0 開發中；本複審只檢查 BUG-WHISPER-METAL-139 本輪 probe-only observability 修正、round2 evidence 與指定治理文件。
- 對應 08-CHANGE-LOG 條目：2026-09-21 — Whisper production probe 啟動失敗診斷可觀測性（BUG-WHISPER-METAL-139）。
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-09-21（Asia/Taipei）獨立複審上下文；先讀取 `docs/project-management/reviews/2026-09-21-whisper-probe-diagnostics-round1.md`，再讀取本輪指定 source、test、round2 evidence、目前狀態、測試稽核、偵錯歷程、change log、獨立審查流程與治理 validator；未沿用主要開發代理的評價性結論。
- round1 三項阻擋對照：quoted／含空白 credential 遮罩；`/tmp/` 遮罩與 probe token guard／負向測試；`08-CHANGE-LOG.md` 結案欄位。

## 1. 需求完整性

- 判定：通過
- 證據：本輪工作條目仍將範圍限定為 production acceptance probe 的啟動診斷，不修改 `server.mjs`、fallback policy、bundled runtime／模型，不讀使用者媒體、不呼叫外部服務、不執行 LM Studio、不發布（`docs/project-management/08-CHANGE-LOG.md:9-16`）。`scripts/verify-whisper-real-fallback.mjs:128-158` 的 v2 evidence 結構具備 production／loopback／test runner scope、PID、ready phase、exit code／signal、stdout／stderr tail；round2 evidence 與 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:18-24`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 均維持 probe-only observability 定位。
- 證據：round1 所列前兩項安全阻擋已在 `lib/whisper-probe-diagnostics.mjs:7-17` 與 `scripts/test-whisper-fallback-policy.mjs:43-58` 具體補齊；round2 default／escalated evidence 也保留了預設啟動失敗與受控正常路徑的分界。
- 證據：`08-CHANGE-LOG.md:3-24` 仍為「狀態：進行中」，且仍記載待完成 round2 複審與 `docs:check:final`，尚未連結本報告或填入本輪結案判定；因此需求與技術範圍完整，但文件結案條件尚未完成。

## 2. 邏輯正確性

- 判定：通過
- 證據：`lib/whisper-probe-diagnostics.mjs:7-17` 先處理明確 sensitive values，再以整段值模式遮罩 `api_key`／`authorization`／`token`／`secret`／`password`／`credential`，可涵蓋 quoted、escaped 與含空白值；另處理 Bearer／Basic、`/Users/`、`/private/tmp/`、`/tmp/` 與 `/var/folders/`，最後才限制 1600 字元尾端。
- 證據：`scripts/verify-whisper-real-fallback.mjs:190-205` 以 pipe 收集 child stdout／stderr，`:80-99` 在 ready 前辨識 child exit，`:287-298` 在停止 child 後先檢查原始輸出是否含 generated probe token，再保存遮罩後 tail；token guard 失敗會將 evidence 設為 fail，不會把洩漏結果當成通過。
- 證據：`scripts/verify-whisper-real-fallback.mjs:68-77` 從隔離 data directory 的 `offline-subtitle-port.tmp` 讀取實際 port，沒有把固定 requested port 誤當成 server 已 ready 的證據；`:301-307` 以 exclusive create 寫 evidence 並在 nested `finally` 清理暫存。

## 3. 邊界情況

- 判定：通過
- 證據：`scripts/test-whisper-fallback-policy.mjs:43-55` 的 deterministic samples 覆蓋 `authorization: "SECRET VALUE"`、`token=SECRET VALUE`、Bearer／Basic 含空白值、`/tmp/` 與 `/private/tmp/` 路徑，並負向斷言敏感值與 `/tmp/` 不存在；`:56-58` 另負向斷言 generated probe token 不會出現在 sanitized output，且 tail 不超過 1600 字元。
- 證據：`2026-09-21-whisper-real-server-fallback-diagnostics-round2-default.json:25-62` 記錄 production／loopback server 在 ready 前 exit 0、`ready=false`、job 未建立，stderr tail 明確包含 `listen EPERM`；`...round2-escalated.json:25-84` 記錄受控權限的正常 server／job 邊界，兩份 evidence 的 `probeTokenDetected` 均為 `false`。
- 證據：round2 evidence 的診斷欄位只保留固定 tail；其中沒有真實 bundled Metal crash、CPU retry 或使用者媒體內容的證據，符合本輪不擴張範圍的要求。

## 4. 程式碼品質

- 判定：通過
- 證據：遮罩邏輯已抽至 `lib/whisper-probe-diagnostics.mjs`，由 `scripts/verify-whisper-real-fallback.mjs:7-8` 與 `scripts/test-whisper-fallback-policy.mjs:8` 共用；這使 round1 發現的 edge cases 可在 focused test 中重複驗證，並避免把 sanitizer 留在 probe 內成為未測試的內嵌 regex。
- 證據：probe 仍採有限大小的 output buffer（`scripts/verify-whisper-real-fallback.mjs:38-40`）、不保存完整 logs（`:248-254`）、最小 child environment（`:170-189`）、isolated data directory 與 cleanup（`:287-307`），且未修改產品 server、fallback policy 或 bundled runtime。
- 證據：round2 修改的可維護性邊界是明確的：diagnostic sanitizer、probe orchestration、policy test 與 evidence schema 各自分工；evidence 仍以新檔 exclusive create 保存，不覆寫 round1 對照。

## 5. 測試覆蓋

- 判定：通過
- 證據：`scripts/test-whisper-fallback-policy.mjs:43-58` 已加入 round1 所缺的 quoted／含空白 credential、Bearer／Basic、`/tmp/` 與 probe token 負向測試；round2 工作紀錄與 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:18-24` 記載 focused assertions、兩側 replay 與完整回歸的驗證範圍。
- 證據：`docs/project-management/08-CHANGE-LOG.md:17-19` 記錄 round2 default／escalated evidence、v2 欄位、token／credential／`/tmp/` leakage assertions 與修正計畫；本複審未把 round1 的缺口誤當成目前 test coverage。
- 證據：治理 validator `scripts/check-project-docs.mjs:1-91` 具備 latest entry、review reference 與 final closeout 檢查；但目前最新 change-log entry 尚未完成 round2 報告連結與 final closeout，這是文件結案條件，不是本輪 sanitizer／probe 測試覆蓋缺口。

## 6. 實際運行結果

- 判定：通過
- 證據：round2 default evidence `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-round2-default.json:31-61` 實際記錄 PID、`ready=false`、`preReadyExitCode=0`、stderr `listen EPERM`、job `created=false`、status=`fail`；這使啟動失敗具有可診斷的非敏感 stderr，而不再只有 exit code。
- 證據：round2 escalated evidence `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-round2-escalated.json:31-84` 實際記錄 server ready、job `completed`／`ready-review`、`asrEngine=whisper.cpp`、`whisperDevice=metal`、`fallbackObserved=false`、draft／SRT／JSON 存在、stale partial 為空，且 `probeTokenDetected=false`。
- 證據：本輪結論的運行範圍明確是 probe-only observability：default stderr 是 `listen EPERM`；elevated 是 `completed/ready-review`、Metal、無 fallback；round2 沒有真實 bundled Metal crash→CPU fallback 證據。不能把受控正常 Metal replay、deterministic fixture 或 direct CLI 對照升格為真實 fallback 驗收。

## 綜合判定

- 結論：有條件通過
- 可逐字引用完整結論句：**本輪 BUG-WHISPER-METAL-139 round2 獨立複審在 probe-only observability 範圍內有條件通過：quoted／escaped／含空白 credential、Bearer／Basic、`/tmp/` 遮罩與 generated probe token guard／負向測試已由可測試 sanitizer 與 deterministic assertions 補齊；default stderr 可見 `listen EPERM` 且 job 未建立，elevated replay 完成 `completed/ready-review`、`whisperDevice=metal`、無 fallback；本輪沒有真實 bundled Metal crash→CPU fallback 證據。唯一未完成條件是 `08-CHANGE-LOG.md` 仍為進行中，主要代理須掛上本報告、填妥 round2 結案欄位並執行 `npm run docs:check:final`。**
- 阻擋問題（若有）：
  1. 文件／治理結案尚未完成：`docs/project-management/08-CHANGE-LOG.md:3-24` 尚未連結本 round2 報告、尚未以本報告逐字引用 round2 結論，狀態仍為「進行中」，且仍列出待完成 round2 與 final docs check。這是合併前唯一剩餘條件；本複審代理依授權不修改 08。
- 剩餘風險：本輪只證明 acceptance probe 的啟動診斷與遮罩可觀測性，以及受控權限下 bundled Metal 正常 path；不證明真實 bundled Metal crash→CPU fallback、中文語音品質、長音訊、取消中的 retry、CPU retry 再失敗、其他 macOS 架構、Windows、乾淨安裝、正式發布或 LM Studio。`externalNetwork=false` 是 probe scope，不是作業系統層級斷網證明。
- 給主要開發代理的具體修正要求（若有）：只需在不修改本報告、round1、evidence 或產品程式的前提下，更新 `08-CHANGE-LOG.md` 的 round2 報告連結、逐字引用、結案判定與遺留風險，並執行 `npm run docs:check:final`；完成後本輪技術阻擋不需再改動。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
