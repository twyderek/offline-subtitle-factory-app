# 獨立審查報告：FR-021 offline wrapper argv redaction boundary

- 審查對象 commit／版本：工作樹基準 `299ff5d`、分支 `codex/0.51-anthropic-claude`、package version `0.51.0`；本輪輸入為目前 dirty worktree 的指定 FR-021 變更。
- 對應 08-CHANGE-LOG 條目：2026-10-14 — FR-021 offline wrapper argv redaction boundary（`docs/project-management/08-CHANGE-LOG.md:3-16`；目前狀態仍為「進行中」，尚待主要代理整合本報告）。
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-10-14T08:18:36Z；獨立上下文；重新讀取 preflight 列出的固定核心、full 路由文件、最新 08 條目與 round1 原件，未沿用主要代理對結果的評價性摘要。

## 範圍與證據

- 本輪只審查 round1 條件相關的 `lib/runner-provenance.mjs`、`scripts/verify-electron-ollama-ui-offline.mjs`、`scripts/test-ollama-ui-offline.mjs`、相關 `package.json` check/test wiring，以及同步的 `00-CURRENT-STATUS.md`、`03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、`08-CHANGE-LOG.md` 文字。工作樹其他既有修改／未追蹤檔案不納入判定，未清理或覆寫。
- 先確認 `08-CHANGE-LOG.md:3-5`：最新條目仍為「進行中」，因此本輪只產生獨立報告，不代替主要代理整合工作紀錄，也不宣稱 final gate 已通過。
- round1 唯一條件是實際穿過 offline wrapper `projectUiEvidence` 的 deterministic projection regression。現行 `scripts/test-ollama-ui-offline.mjs:71-104` 已以 VM 擷取並執行目前 wrapper projection，送入 private path、raw secret、unknown token、合法 token、35 項 argv，直接斷言最終 `runnerProvenance.argv`、`argvDroppedCount`、`argvInputCount`、`argvRedactionValidated` 與 raw-value exclusion。
- 本輪獨立以只讀 `node --input-type=module -e '...'` VM probe 再執行同一 `projectUiEvidence` 函式：混合 35 項輸入得到 `input=35,dropped=3,validated=false`；全數安全 33 項得到 `argv.length=32,dropped=1,input=33,validated=false`；合法 `PATH=<redacted>`／candidate basename／1024 port 得到 `input=3,dropped=0,validated=true`；缺少 argv 得到 `input=null,dropped=0,validated=false`。probe 同時斷言 `sk-live-secret` 與 `/Users/private` 不在最終 projection JSON。
- 獨立執行：`node --check lib/runner-provenance.mjs`、`node --check scripts/verify-electron-ollama-ui-offline.mjs`、`node --check scripts/test-ollama-ui-offline.mjs`、`npm run docs:check`（19 個治理文件，exit 0）及 `git diff --check`（exit 0）。
- 依本輪明確限制，未執行 packaged Electron、Ollama acceptance、network probe、Seatbelt／canary、OS policy、`--no-sandbox` 或任何外部驗收。工作樹有 `/Applications/Ollama.app/Contents/Resources/ollama` 與 packaged candidate；完整 focused script 若直接執行會進入其 optional local Ollama missing-model branch，故本輪以不啟動該分支的 deterministic VM seam 驗證 round1 條件。主要代理已另行回報 focused test、`npm run check` 與 `git diff --check` 重跑結果；本報告不把該回報冒稱為本輪獨立重跑的 packaged／Ollama acceptance。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:7-16` 將本輪成功條件限定為 offline evidence projection 保存前的 argv allowlist、固定 dropped count／validation metadata 與 path／secret regression，並明確排除 packaged UI、replay-time provenance、exact Chromium profile、Ollama／network／OS 操作。`00-CURRENT-STATUS.md:19-21`、`03-FUNCTIONAL-DESIGN.md:105-107`、`06-TEST-AND-PROCESS-AUDIT.md:34-35`、`07-DEBUG-AND-FIX-HISTORY.md:40-44` 同步保留 schema v5 與 runner-level 邊界。
- 證據：本輪新增測試不只重測 `sanitizeRunnerArgv`，而是從 wrapper source 擷取並執行 `projectUiEvidence`，直接驗證最終 evidence projection；因此已對應並關閉 round1 指出的需求驗證缺口。

## 2. 邏輯正確性

- 判定：通過
- 證據：`lib/runner-provenance.mjs:16-47` 只允許固定旗標、sandbox／temporary token、1024–65535 debug port、已知環境名稱的精確 `<redacted>` token、受限 candidate basename；非陣列／缺少 argv fail-closed，拒絕項目與超過 32 項尾端只增加 metadata，不保存原值。
- 證據：`scripts/verify-electron-ollama-ui-offline.mjs:320-327,381-400` 在 wrapper 保存邊界重新呼叫 `sanitizeRunnerArgv(source?.launch?.argv)`，並只將 sanitizer 結果投影至 `runnerProvenance`。獨立 VM probe 證明此 wiring 對混合輸入、真正安全截斷輸入、合法輸入與缺少輸入均產生預期 metadata。
- 證據：`argvRedactionValidated` 只有非空、所有輸入通過且未截斷才為 true；混合輸入的 3 個 unsafe item 與全安全 33 項的截斷各自被反映為 false，未把「仍有 evidence」誤標成「完整驗證」。

## 3. 邊界情況

- 判定：通過
- 證據：實際 wrapper projection regression 覆蓋 private path、`SUBTITLE_AI_API_KEY=sk-live-secret`、unknown `--custom-flag=/private/tmp/user-data`、合法 redacted／candidate／port token、缺少 argv、混合 35 項輸入，以及同一 wrapper projection 中全數安全 33 項截斷。獨立 VM 結果分別為 `35/3/false`、`33/1/false`、`3/0/true`、`null/0/false`（欄位順序為 input/dropped/validated）。
- 證據：`scripts/test-ollama-ui-offline.mjs:93-104` 直接斷言最終 `runnerProvenance`，並確認 raw secret 與 private path 不在最終 JSON；不是只測 helper return value。`lib/runner-provenance.mjs:37-45` 也保留 512-byte item cap 與 32-item output cap。
- 剩餘邊界：candidate basename 是結構 allowlist，不是語意 secret detector；若未來上游把 secret-shaped 值錯誤包成合法 candidate token，仍屬上游 contract misuse 風險，未被本輪需求要求的 basename 結構契約覆蓋。

## 4. 程式碼品質

- 判定：通過
- 證據：`lib/runner-provenance.mjs:1-47` 是無副作用、具名且可重用的純函式；wrapper 只在保存 projection 邊界使用它，不保存 rejected raw argv。allowlist、port range、item／argv 上限與 completeness metadata 均可回溯。
- 證據：`scripts/test-ollama-ui-offline.mjs:71-77` 以明確的 wrapper function seam 做 VM regression，沒有修改 runner spawn 行為，也沒有引入 packaged runtime 或外部 endpoint；三支相關 MJS syntax check 與 `git diff --check` 通過。

## 5. 測試覆蓋

- 判定：通過（限本輪 runner-level projection scope）
- 證據：focused test source 現在覆蓋純 sanitizer 的正向／拒絕／缺少／截斷，加上實際 wrapper `projectUiEvidence` 的 final evidence regression；獨立 VM probe 於 2026-10-14T08:18:36Z 附近重跑上述四組 projection，全部 assertion 通過。`package.json` 的 `test`／`check` wiring 仍包含 focused offline UI test 與 `lib/runner-provenance.mjs`／offline wrapper syntax check。
- 證據：本輪獨立執行 syntax、`npm run docs:check` 與 `git diff --check` 均 exit 0；依使用者限制未直接執行會進入本機 Ollama optional branch 的整支 focused script，也未執行 `npm run check`，因此不把未執行的 packaged／Ollama／network acceptance 證據寫成獨立結果。主要代理已回報該 focused test、`npm run check` 與 `git diff --check` 重跑通過，作為開發驗證背景，不取代本輪 deterministic projection 證據。

## 6. 實際運行結果

- 判定：通過（限 runner-level projection scope）
- 證據：獨立 VM probe 實際執行 wrapper 的 `projectUiEvidence`，未只解析 source regex；輸出為 `{"mixed":{"input":35,"dropped":3,"validated":false},"truncated":{"input":33,"dropped":1,"validated":false},"valid":{"input":3,"dropped":0,"validated":true},"missing":{"input":null,"dropped":0,"validated":false}}`。同一 command 後續 syntax、docs 與 whitespace 檢查亦全部 exit 0。
- 證據：本輪沒有 packaged Electron／Ollama／acceptance、network probe、canary、OS policy 或 `--no-sandbox` 實際運行結果；因此本項「通過」只代表 evidence projection 的 deterministic runner-level 行為，不代表 packaged UI acceptance、replay-time loaded bytes、exact Chromium generated profile、binary provenance、OS-level egress proof 或 FR-021 整體完成。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無本輪 FR-021 argv redaction source／test 阻擋；round1 唯一條件已關閉。最新 08 條目仍為「進行中」而未整合本報告，屬主要代理的治理收尾事項，不是本輪程式或驗證阻擋。
- 可逐字引用的完整結論句：**本輪 round2 獨立複審結論為有條件通過：round1 指出的 offline wrapper 保存邊界缺口已關閉，實際 `projectUiEvidence` deterministic regression 已對 private path、raw secret、unknown token、合法 token、35 項輸入、>32 安全 argv 截斷、缺少 argv 與最終 evidence metadata 完成驗證；本輪結論僅適用於 runner-level schema v5 projection，不代表 packaged UI acceptance、Ollama acceptance、network／OS policy 驗收、replay-time provenance、exact Chromium generated profile 或 FR-021 整體完成。**
- round1 條件是否已關閉：是。理由：round1 要求「以 `source.launch.argv` 進入實際 `projectUiEvidence` projection，直接斷言最終 `runnerProvenance` 欄位與 raw-value exclusion」；現行 focused test 已如此實作，且本輪獨立 VM probe 另補驗全數安全 33 項在實際 wrapper 中的 32 項截斷。
- 剩餘風險：candidate basename 仍只有結構性去敏；replay-time argv、exact Chromium generated profile、Framework／build provenance、packaged UI flow、Ollama 真實模型與 OS-level egress 仍未驗證。`08-CHANGE-LOG.md` 尚未整合本報告，故 final gate 仍待主要代理更新後執行；本報告不代替該 gate。
- 給主要開發代理的具體修正要求（若有）：將本報告路徑與上述完整結論句逐字整合至最新 08 條目，補記 round1 條件已關閉、條件接受與 runner-level／packaged UI 界線，再執行 `npm run docs:check:final`；不得修改 round1 原件或把本報告擴張為 packaged UI acceptance。
- 條件是否已被需求方接受：是，就本輪明確要求的範圍界線（不啟動 packaged UI、Ollama acceptance、network probe、canary、OS policy、`--no-sandbox`）而言，需求方已明確指示並接受；round1 唯一程式／測試條件則已由本輪證據關閉，不以「接受風險」取代驗證。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
