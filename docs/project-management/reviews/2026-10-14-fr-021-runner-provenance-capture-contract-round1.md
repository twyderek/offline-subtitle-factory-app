# 獨立審查報告：FR-021 runner provenance capture contract

- 審查對象 commit／版本：`299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`／0.51.0 dirty worktree；只審查本輪指定檔案與其目前差異，未把其他 dirty worktree 修改納入判定。
- 對應 08-CHANGE-LOG 條目：2026-10-14 — FR-021 runner provenance capture contract（目前狀態：進行中）。
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-14T15:32:39+08:00；獨立上下文，未沿用主要開發代理對話記憶。已先執行 `npm run project:preflight -- --type=full`，並讀取其列出的固定核心、full 路由文件、最新 08 條目與本輪指定來源。
- 審查限制：未啟動 packaged Electron、Ollama、canary、network probe；未使用 `--no-sandbox`；未修改 OS／Seatbelt／PF／防火牆或任何非本報告檔案。

## 審查範圍與基準

- 程式範圍：`scripts/verify-electron-ollama-ui.mjs`、`scripts/verify-electron-ollama-ui-offline.mjs`、`scripts/test-ollama-ui-offline.mjs`。
- 文件範圍：`docs/project-management/03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、`00-CURRENT-STATUS.md`，以及 `08-CHANGE-LOG.md` 最新條目。
- 契約基準：schema v4 應保存去敏 launch command／argv、outer sandbox 套用旗標、candidate executable／Electron Framework 的 pre-launch SHA-256、bounded child-output SHA-256／byte length 與固定 diagnostic categories；不得保存 raw child output、secret-shaped env、使用者／暫存路徑，也不得把此 runner-level trace 宣稱為 replay-time loaded bytes、exact Chromium generated profile、build provenance 或 packaged UI acceptance（`03-FUNCTIONAL-DESIGN.md:105`、`07-DEBUG-AND-FIX-HISTORY.md:32-37`）。

## 1. 需求完整性

- 證據：live runner 已升為 `offline-subtitle-factory.ollama-ui-live-acceptance.v4`（`scripts/verify-electron-ollama-ui.mjs:253-270`），並建立去敏 launch summary（`60-76`）、Framework best-effort pre-spawn read（`217-225`）及 Buffer bounded diagnostics（`233-240`、`857-862`）。source-contract test 已以 `indexOf` 驗證 Framework read 發生於 `spawn` 前（`scripts/test-ollama-ui-offline.mjs:172-177`）。offline wrapper 有 `runnerProvenance` 白名單投影（`scripts/verify-electron-ollama-ui-offline.mjs:379-395`）。但 live runner 的 executable hash 仍在 child 已建立後才讀取（`scripts/verify-electron-ollama-ui.mjs:226`、`435-438`），而 wrapper 沒有把 live `source.diagnostics.startupDiagnosticCategories` 投影到 `runnerProvenance`；其同名 categories 只從 `source.error` 讀取（`scripts/verify-electron-ollama-ui-offline.mjs:376-378`）。
- 判定：不通過。Framework 與 byte cap 需求已覆蓋，但「candidate executable pre-launch identity」與「wrapper 保存固定 diagnostic categories」仍未完整滿足 schema v4 契約。

## 2. 邏輯正確性

- 證據：child output 以 Buffer 接收，使用 `Buffer.concat` 並以 `childOutputBuffer.length` 截斷至 16,000 bytes（`scripts/verify-electron-ollama-ui.mjs:233-240`）；final evidence 保存 SHA-256、byte length、cap 與 `rawChildOutputPersisted: false`（`857-862`）。Framework path／hash 已在 `spawn` 前 best-effort 計算（`217-225`），此點與目前 source-contract assertion 一致。相對地，`candidateExecutableSha256` 的 live runner 值在 `spawn`（`226`）及可能的 renderer／UI 等待之後才由 `fs.readFileSync` 計算（`435-440`），不能保證是實際啟動 bytes 的 pre-launch identity；offline wrapper 只對該值做格式投影（`386`），沒有修正時序。
- 判定：不通過。bounded capture 邏輯正確；Framework capture 邏輯正確；executable provenance 的時序仍使 schema 欄位語義不成立，且 wrapper 的 categories 投影會在成功／非-error trace 中遺失 fixed diagnostics。

## 3. 邊界情況

- 證據：目前 source-contract 覆蓋 Framework read-before-spawn、16,000-byte cap、raw output exclusion、`--no-sandbox` exclusion 與部分 preflight／cleanup assertions（`scripts/test-ollama-ui-offline.mjs:156-184`）。live runner 對 spawn failure、early exit、timeout、sandbox diagnostic category 與 cleanup failure 有固定化分支（`scripts/verify-electron-ollama-ui.mjs:357-384`、`837-875`）。但沒有對 executable hash read-before-spawn 的 assertion；也沒有實際建立一份 synthetic live evidence 後驗證 wrapper 會保留 `diagnostics.startupDiagnosticCategories`。此外，wrapper 的 argv projection 只限制字串型別、長度與數量（`scripts/verify-electron-ollama-ui-offline.mjs:381-383`），沒有再次驗證 path／secret redaction。
- 判定：部分通過。已覆蓋主要 fail-closed／隱私邊界，但本輪核心 provenance 時序與 wrapper diagnostics loss 的邊界缺少可執行防回歸測試。

## 4. 程式碼品質

- 證據：變更採局部 helper（`sha256File`、`redactLaunchArgument`、`safeStartupDiagnosticCategories`、`projectUiEvidence`），並以 exclusive-create 保存 evidence；raw output 只在記憶體 bounded buffer 中存在，沒有寫入 raw log。Framework read 的例外被明確降為 best-effort，不阻斷 cleanup（`217-225`）。主要品質問題是欄位語義與實際 capture timing 不一致，以及 wrapper 的 allowlist 是結構／格式白名單而非完整的去敏驗證；此外 diagnostic categories 來源分散在 live `diagnostics` 與 wrapper `error` projection，造成 schema 不一致。
- 判定：部分通過。程式結構與限制表達清楚，但 provenance 欄位的時序契約與 projection 邊界尚未收斂。

## 5. 測試覆蓋

- 證據：本輪實際執行 `node --check scripts/verify-electron-ollama-ui.mjs`、`node --check scripts/verify-electron-ollama-ui-offline.mjs`、`node --check scripts/test-ollama-ui-offline.mjs`，均 exit 0；實際執行 scoped `git diff --check`，exit 0；實際執行 `npm run docs:check`，exit 0（19 個治理文件）。已讀取 `package.json`，確認 `npm run check` 會執行 `npm test`，而 `npm test` 包含 `node scripts/test-ollama-ui-offline.mjs`。
- 證據：本輪未執行 `node scripts/test-ollama-ui-offline.mjs`、`npm run check`、任何 live acceptance、Ollama、canary 或 network probe；原因是該 focused test 在 macOS／候選／Ollama 條件具備時會啟動本機 daemon／wrapper integration（`scripts/test-ollama-ui-offline.mjs:114-130`、`263-372`），與本輪明確禁止啟動 packaged Electron／Ollama／network probe 的限制衝突。工作紀錄中「focused test／完整回歸通過」是主要代理既有紀錄，非本輪 reviewer 實際重跑結果。
- 判定：部分通過。靜態 syntax／文件／whitespace 檢查通過，source-contract 內容可追溯；但未執行 focused／完整回歸，且現有 source-contract 未覆蓋 executable pre-spawn 順序與 wrapper fixed-category preservation。

## 6. 實際運行結果

- 證據：本輪實際運行只有 `project:preflight -- --type=full`、三支 `node --check`、scoped `git diff --check` 與 `npm run docs:check`；結果分別為 preflight 完成、syntax exit 0、diff check exit 0、docs check exit 0。沒有 packaged Electron／Ollama／canary／network／OS policy 的實機結果，因此沒有可用來宣稱 UI acceptance 或 FR-021 完成的 runtime evidence。
- 證據：靜態核對確認 Framework best-effort read 位於 spawn 前，Buffer cap 為真實 byte cap；同時確認 executable hash 的 live capture 位於 spawn 後，以及 offline wrapper 未投影 `source.diagnostics.startupDiagnosticCategories`。
- 判定：部分通過。靜態檢查結果可重現，但本輪受限制而沒有實際 runner／wrapper execution；FR-021 packaged UI acceptance、replay-time loaded bytes、exact Chromium generated profile 與 build provenance 均未被本輪驗證。

## 綜合判定

- 可逐字引用的完整結論句：**本輪獨立審查結論為不通過：Buffer 16,000-byte child-output capture 與 Electron Framework pre-launch best-effort capture 已可由 source 追溯，但 live runner 的 candidate executable SHA-256 仍在 child spawn 後才計算，offline wrapper 也未保存 live diagnostics 的固定 categories，因此 schema v4 的 runner provenance capture contract 尚未完整成立；本輪未執行 packaged UI／Ollama／canary／network acceptance，亦不代表 replay-time loaded bytes、exact Chromium generated profile、build provenance 或 FR-021 完成。**
- 阻擋問題（若有）：
  1. `scripts/verify-electron-ollama-ui.mjs:226` 先 spawn，`435-438` 才計算 executable／review script hash；至少 executable hash 不符合文件所宣稱的 pre-launch candidate identity，且可能與實際啟動 bytes 不一致。應將 executable hash 的 best-effort capture 移到 spawn 前，並補 source-contract 的順序 assertion；若讀取失敗，需保留固定化的 unavailable 狀態而非造成語義不明。
  2. `scripts/verify-electron-ollama-ui-offline.mjs:376-394` 未將 `source.diagnostics.startupDiagnosticCategories` 投影至 offline evidence 的 runner provenance；目前只從 `source.error` 取得 categories，會丟失成功或非-error trace 的 fixed diagnostic categories。應明確保存白名單 categories 並補 synthetic projection assertion。
- 非阻擋剩餘風險：wrapper 的 argv projection 目前只做型別／長度／數量限制，未在 projection 邊界再次證明每個字串已去敏；若未來 live runner argv 組成改變，使用者／暫存路徑或 secret-shaped value 可能重新進入 evidence。這不改變本輪兩項阻擋結論。
- 不得擴大宣稱：本輪僅審查 runner-level source contract；不得將 schema v4、static checks、synthetic／existing evidence 或任何 audit pass 改寫為 packaged UI acceptance、replay-time loaded bytes、exact Chromium generated profile、build provenance、唯一 root cause 或 FR-021 完成。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案、既有 evidence、治理文件或既有 review。
- 本報告中的實際執行與未執行項目均按本輪 reviewer session 記錄；若上述聲明不實，本報告無效。
