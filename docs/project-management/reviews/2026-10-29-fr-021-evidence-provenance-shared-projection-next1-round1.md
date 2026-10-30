# 獨立審查報告：FR-021 shared runner provenance projection round2 governance closeout

- 審查對象 commit／版本：目前工作樹、版本 `0.52.0`、HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b`、分支 `codex/0.51-anthropic-claude`；工作樹另有既有 dirty source／evidence／review，未將其視為本輪變更。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — FR-021 shared runner provenance projection round2 governance closeout（`FR-021-EVIDENCE-PROVENANCE-SHARED-PROJECTION-NEXT1-REVIEW`）。
- 審查輪次：next1 round1（針對既有 2026-10-28 round2 結果的 current-source／治理 closeout 審查，不覆寫既有 round1／round2 報告）。
- 審查代理啟動時間、上下文來源：2026-10-29T16:22:14+08:00（Asia/Taipei）；已重新讀取 `AGENTS.md`、專案管理 README、full preflight 所列固定核心／任務路由、指定 workflows、既有 round2 報告與目前 source／tests／治理文件；未把歷史報告當成唯一證據。
- 審查限制：不啟動 live runner、network、Ollama／Electron replay、模型操作、Seatbelt offline、全機 egress、Windows 或 signed／notarized release workflow；不修改 source、test、evidence、candidate、00／06／07／08 或既有 review，不 stage／commit／push。
- 本輪範圍聲明：只審查 `projectRunnerProvenance()` 的 raw-argv ownership、live／offline wiring、key-set／hash／path／secret boundaries、deterministic/local regression 與 08／00／06／07 current consistency；不將本輪擴大成 FR-021 overall acceptance。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - 最新 08 條目 `docs/project-management/08-CHANGE-LOG.md:8-14` 已正確界定本輪目標為 caller-supplied projection bypass、live／offline raw argv、key-set／hash／path／secret regression 與治理 final gate，並明確排除 live runner、network、Ollama／Electron、Seatbelt offline、全機 egress、Windows、signed／notarized package、release 與 FR-021 overall。
  - 目前 source 已符合技術需求；但 08:5 仍為「進行中」，而 `npm run docs:check:final` 於 2026-10-29T16:22:14+08:00 exit 1，回報缺少「獨立審查是否執行：」、缺少「發布授權：」、最新工作紀錄未標示「完成」。
  - current governance consistency 尚未完成：`00-CURRENT-STATUS.md:193-198`、`06-TEST-AND-PROCESS-AUDIT.md:187-192`、`07-DEBUG-AND-FIX-HISTORY.md:193-199` 仍寫 round2「待完成／尚待完成／待 round2」，沒有反映既有 round2 report 與本輪 current-source closeout 審查。故技術需求完整，但本輪「治理 closeout」成功條件尚未滿足。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `lib/runner-provenance.mjs:87-123` 的 `projectRunnerProvenance()` 參數沒有 `argvProjection`；`lib/runner-provenance.mjs:103` 對 caller 傳入的 `argv` 無條件重新呼叫 `sanitizeRunnerArgv()`，輸出欄位由同一 helper 建立。
  - live wiring `scripts/verify-electron-ollama-ui.mjs:387-402` 只傳 `argv: launchSummary.argv`；offline wiring `scripts/verify-electron-ollama-ui-offline.mjs:380-395` 只傳 `argv: source?.launch?.argv`。目前 production source 的 `argvProjection` 搜尋無結果；故沒有 caller-supplied projection object 的正式 bypass path。
  - `scripts/test-ollama-ui-offline.mjs:179-189` 以 caller-supplied `argvProjection` 夾帶 private path／secret，斷言輸出 argv 為空且序列化結果不含 path／secret；本輪另以 direct helper probe 傳入同樣 adversarial raw argv，實際得到只保留 `--remote-debugging-port=9990`、`argvDroppedCount=2`、invalid hash／path 均為 `null`。
  - shared output key set 由 `scripts/test-ollama-ui-offline.mjs:153-156` 直接以 `Object.keys()` 比對；live／offline 都呼叫同一 helper，沒有第二套欄位投影邏輯。

## 3. 邊界情況

- 判定：通過
- 證據：
  - `lib/runner-provenance.mjs:25-55` 只接受固定旗標、1024–65535 debug port、固定 redacted env names、basename-only candidate token，並限制 32 項 argv；missing／non-array、未知 flag、private path、secret-shaped value、超長與 truncation 都 fail-closed。
  - `scripts/test-ollama-ui-offline.mjs:40-102` 實際覆蓋合法 Unicode candidate、path／dot-name／control／oversize candidate、private path、secret、missing argv 與 33 項 truncation；`scripts/test-ollama-ui-offline.mjs:104-112` 覆蓋 command 的 path／separator／control／empty／oversize／boxed boundary。
  - `lib/runner-provenance.mjs:65-67,112-123` 對 executable／review.js／Framework／child-output hash 僅接受 64-hex primitive string；`scripts/test-ollama-ui-offline.mjs:170-178` 覆蓋 invalid path、boxed hash 與 missing review.js hash。`candidateFrameworkRelativePath` 僅接受固定常數（`lib/runner-provenance.mjs:116-117`），不保存 caller path。
  - `scripts/test-ollama-ui-offline.mjs:157-169` 實際確認 wrapper projection 不保存 private argv、secret 或 token canary；因此本輪 observed boundary 是 deterministic/local evidence contract，不是 runtime process memory 或 OS-level egress proof。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - sanitizer ownership 集中在 `lib/runner-provenance.mjs:41-55,87-123`；caller 不能提供已投影的 argv／count，降低 live／offline drift 與保存邊界重入風險。
  - live／offline 的欄位 mapping 分別位於 `scripts/verify-electron-ollama-ui.mjs:387-402` 與 `scripts/verify-electron-ollama-ui-offline.mjs:380-395`，仍保留 candidate executable／review.js／Framework hash、diagnostic categories、bounded child-output 與 raw-output flag。
  - 四個指定 source/test 檔案 `node --check` 均 exit 0；`git diff --check` exit 0。current worktree 雖有其他既有 dirty source／documentation／evidence，沒有在本輪被修改或納入本項 source quality 判定。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 本輪獨立實際執行（2026-10-29T16:22:14+08:00）：`node --check lib/runner-provenance.mjs`、`node --check scripts/verify-electron-ollama-ui.mjs`、`node --check scripts/verify-electron-ollama-ui-offline.mjs`、`node --check scripts/test-ollama-ui-offline.mjs`、`node scripts/test-ollama-ui-offline.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-project-docs-validator.mjs`、`git diff --check` 均 exit 0。
  - `node scripts/test-ollama-ui-offline.mjs` 的實際輸出包含 local UI daemon missing-model integration passed、offline UI bundle preflight integration passed（3 cases；no Ollama/model required）與 offline packaged UI contract test passed；未啟動真實 Ollama／Electron。
  - current 08／06／07 既有開發紀錄宣稱完整 `npm run check` exit 0；依本輪限制未重跑完整 check，故將其列為主要代理開發證據，不冒稱為本輪獨立完整回歸結果。
  - `npm run docs:check:final` 本輪實際 exit 1，失敗項目是最新 08 的治理欄位／完成狀態，不是 source／focused regression failure。故 deterministic test coverage 通過，但治理 final gate 覆蓋尚未通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 本輪實際運行結果支持 deterministic/local evidence contract：shared key-set parity、hash fail-closed、raw-argv re-sanitize、path／secret／token exclusion、syntax、provider regression 與治理 validator 均通過。
  - 本輪依明確範圍未啟動 live runner、network、Ollama／Electron replay 或模型操作；因此沒有新的 live runtime evidence。既有 normal-loopback evidence 的限制仍由 `06-TEST-AND-PROCESS-AUDIT.md:192` 與 `07-DEBUG-AND-FIX-HISTORY.md:199` 保留：不代表 Seatbelt offline、全機 egress、Windows 或 FR-021 overall。
  - Seatbelt offline 與全機 egress 是不同證據層；本輪也未證明 exact Chromium generated profile、runtime loaded bytes、Windows 行為、live Ollama／Electron 或 signed/notarized release。這些未執行項不構成本輪 shared projection source failure，但必須留在 residual risk。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：
  1. 治理 closeout 尚未完成：`08-CHANGE-LOG.md:3-14` 仍為「進行中」且缺少 final gate 要求的「獨立審查是否執行：」與「發布授權：」；本輪 `npm run docs:check:final` exit 1。
  2. current `00／06／07` 尚未同步本輪 current-source closeout：`00:197`、`06:191`、`07:198` 仍把 round2 寫成待完成，與既有 round2 report 及本輪實測結果不一致。
- 剩餘風險：本結論只涵蓋 deterministic/local shared runner provenance projection／schema parity。沒有 Seatbelt packaged UI pass、真正全機 egress isolation、Windows evidence、live Ollama／Electron replay、模型品質或版本泛化、signed/notarized candidate／release evidence，也不代表 FR-021 overall acceptance；既有 normal-loopback `systemNetworkDisabled=false` scope 維持。
- 給主要開發代理的具體修正要求（若有）：
  1. 保留本報告、既有 round1／round2 review、evidence 與 source 原件；不要以新 closeout 文字覆寫歷史報告。
  2. 在允許的治理文件範圍內同步 `00-CURRENT-STATUS.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md` 與最新 `08-CHANGE-LOG.md`：連結本報告、逐字引用本報告完整結論句、記錄本輪實際 deterministic checks、明確標示不在範圍的 runtime／platform evidence，並將本條目補為「完成」、加入「獨立審查是否執行：是」與「發布授權：不適用」。
  3. 文件同步後重新執行 `npm run docs:check:final`，只有 exit 0 才能解除本輪治理 closeout condition；不得因 deterministic contract 通過而宣稱 Seatbelt offline、全機斷網、Windows、signed/notarized release 或 FR-021 overall 完成。
- 可逐字引用的完整結論句：**本輪 FR-021 shared runner provenance projection round2 governance closeout 獨立審查結論為有條件通過：目前 `projectRunnerProvenance()` 已拒絕 caller-supplied `argvProjection` bypass，live／offline 只傳入 raw argv 並由 shared helper 重新套用 `sanitizeRunnerArgv()`，key-set／hash／path／secret regression、指定 syntax、offline UI／provider／治理 validator 與 `git diff --check` 均由本輪 deterministic/local checks 通過；但最新 08 條目仍為「進行中」、`npm run docs:check:final` exit 1，且 00／06／07 尚未同步 round2 closeout，因此本結論只限 shared runner provenance projection／schema parity，不代表 Seatbelt offline、全機 egress、Windows、live Ollama／Electron、signed/notarized release 或 FR-021 overall acceptance。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證；未修改 source、test、evidence、candidate、00／06／07／08 或既有 review，未 stage／commit／push。
- 本報告是本輪唯一新增寫入檔案；若上述聲明不實，本報告無效。
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本審查代理只寫入本報告 `docs/project-management/reviews/2026-10-29-fr-021-evidence-provenance-shared-projection-next1-round1.md`；除建立本報告外，僅執行讀取、指令執行與驗證，沒有修改任何其他檔案。
- 本報告限制於 deterministic/local contract，不代表真實 Ollama、offline/full egress、release 或 FR-021 overall acceptance。
