# 獨立審查報告：FR-021 shared runner provenance projection contract argvProjection bypass 複審

- 審查對象 commit／版本：目前工作樹、專案版本 `0.52.0`、分支 `codex/0.51-anthropic-claude`；本輪只複審 round1 指出的 `argvProjection` bypass 修正及其影響，沒有指定 commit。
- 對應 08-CHANGE-LOG 條目：2026-10-28 — shared runner provenance projection contract（`FR-021-REPLAY-20261028-EVIDENCE-PROVENANCE-SHARED-PROJECTION`）。
- 審查輪次：round2（不覆寫 round1）
- round1 依據：`docs/project-management/reviews/2026-10-28-fr-021-evidence-provenance-shared-projection-round1.md:68-80` 指出的 helper-level `argvProjection` bypass、bypass regression、非 live checks 與治理 closeout 條件。
- 審查代理啟動時間、上下文來源：2026-10-28T12:40:40+08:00（Asia/Taipei）；依 governance preflight 所列固定核心／任務路由重新讀取目前工作樹、round1、helper、live／offline wiring、tests、00／06／07／08 與既有 replay4 scope，未以 round1 以外的開發評價替代目前 source／指令證據。
- 審查限制：本輪禁止 live runner、network、Ollama／Electron replay 與模型操作；round1 報告與既有 replay4 僅讀取、不覆寫。
- 本輪範圍聲明：只審查 shared runner provenance projection／schema parity 的 `argvProjection` bypass 修正、live／offline raw-argv wiring、bypass regression、完整 checks 的可追溯紀錄與本輪治理 scope；不能宣稱 Seatbelt offline、全機斷網、Windows 或 FR-021 完整驗收。

## 1. 需求完整性

- 判定：通過
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:3-24` 已記錄 round1 finding、修正內容與複審計畫：移除 `projectRunnerProvenance()` 的 `argvProjection` 入口，live／offline 只傳 raw argv，helper 永遠重新呼叫 `sanitizeRunnerArgv()`，並新增 path／secret bypass regression；條目仍明確把 Seatbelt、全機 egress、Windows、LM Studio、發布與 FR-021 完整驗收列為不在範圍。
  - `docs/project-management/00-CURRENT-STATUS.md:3-8`、`06-TEST-AND-PROCESS-AUDIT.md:3-8`、`07-DEBUG-AND-FIX-HISTORY.md:3-9` 均把 round1 finding、raw-argv 修正、bypass regression、完整 check 紀錄與「無新 live replay」同步記錄；未將本輪修正誇大為 offline runtime acceptance。
  - `docs/project-management/03-FUNCTIONAL-DESIGN.md:131-133` 的 provenance contract 只要求 runner-level 去敏／bounded evidence，不等於 loaded bytes、exact Chromium profile 或 UI／全機斷網驗收；本輪修正正好收斂保存邊界，且沒有改變更大需求範圍。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `lib/runner-provenance.mjs:69-85` 的 `projectRunnerProvenance()` 現在只解構 `argv`，不再取用或判斷 `argvProjection`；第 85 行永遠執行 `const safeArgvProjection = sanitizeRunnerArgv(argv)`。因此 caller 即使附帶同名未知 property，也不能直接把未驗證的 argv／counts 帶入輸出。
  - live wiring `scripts/verify-electron-ollama-ui.mjs:12,282-289` 只傳 `argv: launchSummary.argv`；offline wiring `scripts/verify-electron-ollama-ui-offline.mjs:10,380-387` 只傳 `argv: source?.launch?.argv`。兩條路徑均把 raw input 交回 shared helper，未留下上一輪的 pre-sanitized object bypass。
  - `scripts/test-ollama-ui-offline.mjs:141-151` 以 caller-supplied `argvProjection` 夾帶 private path／secret 的 bypass attempt，斷言輸出 `argv=[]` 且序列化 evidence 不含 path／secret；這直接覆蓋 round1 的失敗模式。
  - 本輪 static probe（2026-10-28T12:40:40+08:00）以 raw argv `['/home/private/runner', 'SUBTITLE_AI_API_KEY=sk-live-secret']` 呼叫 helper，輸出 `bypassArgvLength=0`、`bypassValidation=false`、`bypassContainsPrivate=false`、`bypassContainsSecret=false`；同時 missing raw argv 也得到空 argv／false validation。結果支持 bypass 已關閉。

## 3. 邊界情況

- 判定：通過
- 證據：
  - 既有 `scripts/test-ollama-ui-offline.mjs:56-71` 仍覆蓋 private path、secret-shaped token、missing argv 與 33 項 truncation；` :141-151` 新增的 malformed caller projection 同時驗證 path／secret 不會被保存。
  - `lib/runner-provenance.mjs:35-49` 的 raw argv sanitizer 只允許固定旗標、受限 debug port、固定 redacted env token 與候選 basename，並限制單項／總數；`projectRunnerProvenance()` 現在無第二條 object projection input path。
  - `scripts/test-ollama-ui-offline.mjs:125,137-140` 的 key-set、boxed hash、missing hash assertions 仍存在；本次修正沒有刪除既有 hash／command／secret boundary coverage。
  - `rg` 靜態檢查（2026-10-28T12:40:40+08:00）在 `lib/runner-provenance.mjs`、live verifier、offline verifier 中找不到 `argvProjection`；唯一保留位置是測試中的故意 bypass fixture，符合 regression 需求。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - 修正後的 API 形狀更單一：`projectRunnerProvenance()` 只接收 raw argv，sanitization ownership 集中在 `lib/runner-provenance.mjs:69-105`；live／offline 不再各自建立或傳遞 projection object。
  - `scripts/verify-electron-ollama-ui.mjs:282-298` 與 `scripts/verify-electron-ollama-ui-offline.mjs:380-396` 的欄位 mapping 仍相同，沒有因移除 bypass 而遺失 candidate executable／review.js／Framework hash、diagnostic categories、bounded child-output 或 raw flag。
  - 變更只觸及本輪指定的 evidence helper、兩個 verifier wiring、focused regression 與治理記錄；`00:8`、`06:8`、`07:9` 均記錄無新 live replay及未解除 offline／全機／Windows／FR-021 限制。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 本輪實際執行且未涉及 live／Ollama／Electron／模型的指令（2026-10-28T12:40:40+08:00）：
    - `npm run project:preflight -- --type=governance`：exit 0。
    - `node --check lib/runner-provenance.mjs`、`node --check scripts/verify-electron-ollama-ui.mjs`、`node --check scripts/verify-electron-ollama-ui-offline.mjs`、`node --check scripts/test-ollama-ui-offline.mjs`：全部 exit 0。
    - `node scripts/test-project-docs-validator.mjs`：exit 0。
    - `npm run docs:check`：exit 0，19 個治理文件通過。
    - `git diff --check`：exit 0。
    - raw-argv bypass static probe：exit 0，path／secret 均未保存。
  - `00-CURRENT-STATUS.md:7`、`06-TEST-AND-PROCESS-AUDIT.md:7`、`07-DEBUG-AND-FIX-HISTORY.md:8`、`08-CHANGE-LOG.md:22` 都記錄修正後 focused／完整 `npm run check` exit 0；這是目前工作紀錄中的開發驗證證據。
  - 本輪未重新執行 `node scripts/test-ollama-ui-offline.mjs` 或 `npm run check`，因使用者明確禁止 Ollama／Electron replay、模型操作與 live runner，而完整 test chain 會觸及 Ollama-related test path；因此本面向不能把治理紀錄誤稱成本輪獨立重跑結果。
  - bypass regression source assertion 已直接針對 round1 failure mode；未見本輪修正造成其他 shared projection key-set regression 的證據，但完整回歸仍以既有紀錄為主。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 本輪實際執行的 helper static probe、syntax checks、治理 validator、一般 `docs:check` 與 `git diff --check` 均通過；未啟動任何 runner、Ollama、Electron 或模型。
  - 既有 replay4 僅作範圍背景，未重播：其正常 loopback scope 仍由 `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay4.json` 及 `00-CURRENT-STATUS.md:19-20` 記錄，`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`；本輪修正沒有新增 runtime evidence，也沒有把它升格成 Seatbelt offline。
  - `npm run docs:check:final` 於 2026-10-28T12:40:40+08:00 exit 1，原因是最新 08 條目仍為「進行中」且尚未含 round2 的「獨立審查是否執行：」與「發布授權：」欄位；這是治理 closeout 尚未完成，不是 bypass regression failure。
  - 因禁止 live／replay，本面向只能確認修正後 deterministic／source 行為與既有 scope 紀錄，不能提供新的實際 Electron／Ollama runtime 結果。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：
  1. `argvProjection` bypass 的 code-level 阻擋已解除：helper 僅接收 raw argv 並重新 sanitize，live／offline 也只傳 raw argv，bypass regression 與 static probe 均通過。
  2. 治理 closeout 尚未完成：`08-CHANGE-LOG.md:3-24` 仍為「進行中」，本輪 `npm run docs:check:final` exit 1；需由主要代理在不修改本報告／round1 的前提下補齊 round2 引用與必要 closeout 欄位後再結案。
- 本輪條件是否已被需求方接受：是
- 剩餘風險：本報告只限 shared runner provenance projection/schema parity 的 bypass 修正及其影響；沒有新的 Seatbelt packaged UI runtime evidence，`systemNetworkDisabled=false` 的既有 normal loopback、全機 egress、Windows、其他模型／版本與完整 FR-021 acceptance 仍未完成。
- 給主要開發代理的具體修正要求：
  1. 保留本報告與 round1 原件不變，將本報告的逐字結論引用、round2 審查欄位與現有 scope／風險同步至 08 後，再執行 `npm run docs:check:final`。
  2. 不得因 bypass 修正通過而宣稱 Seatbelt offline、全機斷網、Windows 或 FR-021 完整驗收；若未來再改變 shared projection contract，須另開新工作／新審查輪次。
- 可逐字引用的完整結論句：**本輪 FR-021 shared runner provenance projection contract round2 複審結論為有條件通過：round1 指出的 `argvProjection` bypass 已由 `projectRunnerProvenance()` 移除 projection-object 入口並改為對 raw argv 永遠重新套用 `sanitizeRunnerArgv()`，live／offline wiring、path／secret bypass regression、source／syntax／治理驗證與既有完整 check 紀錄均支持本項修正；但本輪未執行 live runner、network、Ollama／Electron replay 或模型操作，且最新 08 尚未完成 round2 closeout、`npm run docs:check:final` exit 1，因此本結論只限 shared runner provenance projection/schema parity，不得宣稱 Seatbelt offline、全機斷網、Windows 或 FR-021 完整驗收。**

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
