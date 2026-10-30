# 獨立審查報告：FR-021 offline wrapper argv redaction boundary

- 審查對象 commit／版本：工作樹基準 `299ff5d`、分支 `codex/0.51-anthropic-claude`、package version `0.51.0`；本輪輸入為目前 dirty worktree 的指定 FR-021 變更。
- 對應 08-CHANGE-LOG 條目：2026-10-14 — FR-021 offline wrapper argv redaction boundary（`docs/project-management/08-CHANGE-LOG.md:3-16`）。
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-14T08:15:42Z；獨立上下文；先確認指定 review 檔不存在，再執行 `npm run project:preflight -- --type=full`，依 preflight 讀取固定核心、full 路由與最新工作條目，未沿用主要代理對本輪結果的評價。

## 範圍與證據

- 本輪只審查 `lib/runner-provenance.mjs`、`scripts/verify-electron-ollama-ui-offline.mjs`、`scripts/test-ollama-ui-offline.mjs`、`package.json` 的相關 check，以及同步的 `00-CURRENT-STATUS.md`、`03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、`08-CHANGE-LOG.md` 文字。
- 初始唯讀檢查確認 `docs/project-management/reviews/2026-10-14-fr-021-offline-wrapper-argv-redaction-boundary-round1.md` 不存在；本報告是唯一新增檔案。工作樹另有與本輪無關的既有修改／未追蹤檔案，未納入本輪判定，亦未清理或覆寫。
- 本輪未啟動 packaged Electron、Ollama acceptance、network probe、Seatbelt／canary 或任何 OS policy；沒有將 runner-level contract、source-contract 或既有 evidence 當作 packaged UI acceptance。
- 可回溯證據包括：`npm run project:preflight -- --type=full` exit 0；`node --check lib/runner-provenance.mjs`、`node --check scripts/verify-electron-ollama-ui-offline.mjs`、`node --check scripts/test-ollama-ui-offline.mjs` 均 exit 0；`npm run docs:check` exit 0（19 個治理文件，版本 0.51.0）；`git diff --check` exit 0；`npm run docs:check:final` 本輪 exit 1，原因是最新工作紀錄仍為進行中且尚未整合本報告所需的審查／發布欄位。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:7-16` 將目標限定為 offline evidence projection 保存前的 argv allowlist、固定 dropped count／validation metadata 與 path／secret regression，並明確排除 packaged UI、replay-time provenance、exact Chromium profile、Ollama／network／OS 操作。`docs/project-management/00-CURRENT-STATUS.md:16-21`、`03-FUNCTIONAL-DESIGN.md:105-107`、`06-TEST-AND-PROCESS-AUDIT.md:32-35`、`07-DEBUG-AND-FIX-HISTORY.md:40-44` 均同步保留 schema v5、保存邊界與「不等於 packaged UI acceptance」界線。
- 證據：`package.json:20,29-30` 保留 offline wrapper script、focused test 與 `lib/runner-provenance.mjs`／offline runner 的 syntax check；目前 static source 也固定 `offline-subtitle-factory.ollama-ui-offline-acceptance.v5`（`scripts/verify-electron-ollama-ui-offline.mjs:34-35`）。

## 2. 邏輯正確性

- 判定：通過
- 證據：`lib/runner-provenance.mjs:16-30` 的 allowlist 只接受固定旗標、固定 sandbox／temporary tokens、1024–65535 的 debug port、七個已知環境名稱搭配精確 `<redacted>`，以及不含 slash／backslash 的受限 candidate basename；原始 `KEY=secret`、路徑、未知 flag、非法 port 與不符合格式值不會通過。`lib/runner-provenance.mjs:32-47` 對非陣列／缺少 argv fail-closed，對 rejected item 與超過 32 項的尾端只增加 `argvDroppedCount`，不把原值放入輸出，且只有非空、全數通過且未截斷才令 `argvRedactionValidated=true`。
- 證據：offline wrapper 在 `scripts/verify-electron-ollama-ui-offline.mjs:320-327` 以 `sanitizeRunnerArgv(source?.launch?.argv)` 重新投影，並在 `:381-400` 只保存 sanitizer 的 argv、validation、count 與其他固定格式欄位；`source.launch.command` 亦以無路徑 regex 投影。`scripts/verify-electron-ollama-ui.mjs:60-76` 的 live runner 仍先做原始 launch summary，故 v5 是保存邊界的第二次檢查，而非宣稱 live runner 本身已保存完整安全 argv。
- 證據：候選 basename 的結構限制確實排除檔案路徑字元；但它是結構 allowlist，不是語意 secret detector。若未來上游錯誤地把 secret-shaped 字串包成合法 `<candidate-executable:...>` token，該 basename 仍可能被保存；目前 live runner 的該 token 來源是候選 executable basename，不是環境值。此項列為剩餘風險，不改寫目前需求所指定的 candidate-basename contract。

## 3. 邊界情況

- 判定：部分通過
- 證據：`scripts/test-ollama-ui-offline.mjs:31-69` 實際固定測試合法 redacted argv、private path、`SUBTITLE_AI_API_KEY=sk-live-secret`、未知 flag、`null` argv 與 33 項截斷；斷言 dropped count、輸出 argv、raw secret／path 不存在，以及缺少／截斷時 validation 為 false。本輪另以唯讀 `node --input-type=module -e` probe 測過 `undefined`／`null`／空陣列、1023／1024／65535／65536 port 與含 slash 的 candidate token，結果符合上述 fail-closed 行為。
- 證據：`argvInputCount` 對缺少／非陣列為 `null`、空陣列為 `0`，拒絕項目不回填原值；超過 32 項時保留前 32 個安全 token 並將尾端計入 dropped count。這使缺少 argv 與截斷 argv 都不會被誤標為完整通過。
- 證據：現有 focused test 沒有把含 unsafe `source.launch.argv` 的實際物件送進 offline wrapper 的 `projectUiEvidence`，再檢查最終 evidence JSON；它直接測純函式並以 source regex 驗證欄位存在。因此 projection wiring 的實際保存邊界尚缺一個 deterministic integration assertion。

## 4. 程式碼品質

- 判定：通過
- 證據：`lib/runner-provenance.mjs:1-47` 是無副作用、可重用且具名的純函式；wrapper 只在保存 projection 時呼叫它，沒有保存 rejected raw argv。固定 regex、token、port range、32 項上限與 metadata 命名均可直接回溯，且 wrapper／live runner 的責任邊界在 `03-FUNCTIONAL-DESIGN.md:105-107` 明文記錄。
- 證據：三個指定 MJS syntax check 均通過；package manifest 的 offline acceptance、focused test 與相關 syntax checks 均存在並由 `node -e` 解析確認。`package.json` 的 test／check 長行有既有格式瑕疵，但不影響 JSON 解析或本輪 FR-021 check 的有效性，列為非阻擋維護事項。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：已有測試覆蓋純 sanitizer 的正向、path／secret／unknown rejection、missing argv 與 truncation（`scripts/test-ollama-ui-offline.mjs:31-69`），並以 source-contract assertions 覆蓋 schema v5、`runnerProvenance`、`argvRedactionValidated`、`argvDroppedCount` 與 package scripts（`:191,223-232`）。這足以支持 allowlist 純函式本身的回歸，但不等於 wrapper projection 的端到端保存回歸。
- 證據：本輪未執行 `node scripts/test-ollama-ui-offline.mjs` 或 `npm run check`。目前環境的測試腳本在存在 `/Applications/Ollama.app/Contents/Resources/ollama` 時，會進入 `scripts/test-ollama-ui-offline.mjs:156-172` 的 real Ollama missing-model integration；另有 packaged candidate／model gate 分支（`:311-425`）。依使用者明確限制，本輪不啟動 Ollama acceptance、packaged UI 或 network probe，故不能把既有工作紀錄中的 focused／full exit 0 當成 reviewer 本輪重跑。
- 阻擋問題：若要把本輪由有條件通過提升為無條件通過，主要代理需新增並執行不啟動 packaged UI／Ollama／network 的 deterministic wrapper-boundary regression：以含 private path、raw secret、unknown token、missing argv、合法 token 與 >32 truncation 的 `source.launch.argv` 進入實際 `projectUiEvidence` projection，直接斷言最終 `runnerProvenance.argv`、`argvDroppedCount`、`argvInputCount`、`argvRedactionValidated` 與 raw-value exclusion。可用純 helper／VM seam，但測試必須證明實際 wrapper wiring，而非只再測一次 sanitizer。

## 6. 實際運行結果

- 判定：部分通過
- 證據：本輪實際成功執行 `npm run project:preflight -- --type=full`、三個指定 `node --check`、`npm run docs:check`、`git diff --check`，以及只讀 sanitizer boundary probe；probe 輸出顯示 unsafe path／secret／非法 port／非法 candidate 被丟棄，33 項安全 argv 保留 32 項且 `argvRedactionValidated=false`。時間戳：2026-10-14T08:15:42Z 附近完成本輪命令核對。
- 證據：`npm run docs:check` 輸出「專案治理文件檢查通過：19 個文件，版本 0.51.0」。`npm run docs:check:final` 實際 exit 1，輸出為最新工作紀錄缺少「獨立審查是否執行」與「發布授權」、最新紀錄尚未標示完成，及獨立審查欄位未為是／否；這是主要代理尚未整合本報告的治理收尾狀態，不是本輪把 source 判定為失敗。
- 證據：本輪沒有 packaged Electron／Ollama／acceptance、network probe、canary、OS policy 或 `--no-sandbox` 實際運行結果；因此本報告不宣稱 packaged UI acceptance、replay-time loaded bytes、exact Chromium generated profile、OS-level egress proof 或 FR-021 整體完成。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪獨立審查結論為有條件通過：FR-021 offline wrapper 的 argv allowlist、缺少／拒絕／截斷語意、schema v5 投影與 package check 已通過 source、靜態契約及純函式邊界驗證；但現有 focused test 尚未實際穿過 `projectUiEvidence` 保存邊界驗證 raw path／secret／unknown argv 不會進入最終 evidence，且本輪未執行 packaged UI／Ollama／network／OS 實機驗收，因此不得將本輪結果宣稱為 packaged UI acceptance 或 FR-021 整體完成。**
- 阻擋問題（若有）：一項驗證阻擋：缺少 actual offline-wrapper projection 的 deterministic regression，無法僅依目前 direct sanitizer tests 證明 wrapper wiring 在未來變更下仍守住保存邊界。沒有發現目前 allowlist source 本身會直接保存一般路徑或 `KEY=secret` raw value。
- 剩餘風險：candidate basename 允許的安全字元集合沒有語意 secret detector；若上游錯誤包裝 secret-shaped 值為 candidate token，仍可能通過結構檢查。另有 replay-time argv、exact Chromium generated profile、binary／Framework runtime provenance、packaged UI flow、Ollama 真實模型與 OS-level egress 未被本輪驗證。
- 給主要開發代理的具體修正要求：補上上述 wrapper-boundary deterministic regression，執行該 focused test 與允許的 syntax／docs／diff checks；整合時把本報告以新 round1 路徑連結至 `08-CHANGE-LOG.md`，逐字引用本報告結論句，補齊「條件是否已被需求方接受」與 final-gate 欄位。除非新增測試通過且需求方接受此條件，維持有條件通過；不得以既有 runner-level schema v4、static bundle identity 或未執行的 acceptance 當作本輪 v5 packaged UI 通過。
- 條件是否已被需求方接受：對「本輪不執行 packaged UI／Ollama／network probe／OS policy」的範圍界線：是，使用者在本輪明確要求保留此限制。對「尚缺 wrapper-boundary deterministic regression」的修正條件：尚未有明確接受紀錄，應由需求方／主要代理在整合時補記；故本報告不升級為無條件通過。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
