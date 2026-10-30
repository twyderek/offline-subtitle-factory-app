# 獨立審查報告：Unicode candidate executable argv provenance

- 審查對象 commit／版本：dirty working tree；專案版本 `0.52.0`，本輪未建立新 commit。
- 對應 08-CHANGE-LOG 條目：2026-10-28 — Unicode candidate executable argv provenance（`FR-021-REPLAY-20261028-EVIDENCE-PROVENANCE-UNICODE-CANDIDATE-ARGV`）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-28 13:10–13:12（Asia/Taipei）；以 repo 現況、指定 source／tests／治理文件及 immutable replay1 evidence 為判定依據，未執行 live runner、network probe、Ollama model 或 packaged Electron UI acceptance。

## Summary

- 結論：有條件通過。Unicode-safe candidate basename contract、fail-closed 邊界、deterministic regression 與 00／03／06／07／08 文件同步均符合本輪範圍；條件是結論只限 evidence provenance，不得擴大為 packaged UI offline 或 FR-021 完整驗收。
- 阻擋問題（若有）：無本輪程式或文件同步阻擋；唯一保留條件是本輪明確未重跑 live acceptance，且 immutable replay1 的既有 failure／scope 必須維持原樣。
- 本輪條件是否已被需求方接受：是
- 可逐字引用的完整結論句：**本輪 FR-021 Unicode candidate executable argv provenance round1 有條件通過：Unicode-safe candidate basename 與 fail-closed path／separator／control／dot-name／oversize contract、deterministic regression 及 00／03／06／07／08 文件同步均通過；本輪未且不得 retroactively 修改 replay1，replay1 仍為 systemNetworkDisabled=false、CHROMIUM_CHILD_SANDBOX_INIT_FAILED／SIGTRAP 的 Seatbelt packaged UI blocker，FR-021 仍未完整驗收。**

## 1. 需求完整性

- 判定：通過
- 證據：`08-CHANGE-LOG.md:3-21` 明確限定本輪為 evidence argv sanitizer／deterministic tests，要求接受安全 Unicode candidate basename、拒絕 path／separator／control／dot names／oversize，且不改寫 replay1；`lib/runner-provenance.mjs:11-18,30-31` 實作 candidate wrapper 與 shared basename boundary；`scripts/test-ollama-ui-offline.mjs:56-78` 覆蓋 localized pass 與 unsafe fail-closed。`00-CURRENT-STATUS.md:3-8`、`03-FUNCTIONAL-DESIGN.md:131-133`、`06-TEST-AND-PROCESS-AUDIT.md:3-8`、`07-DEBUG-AND-FIX-HISTORY.md:3-8` 均同步同一 scope 與限制。

## 2. 邏輯正確性

- 判定：通過
- 證據：`SAFE_BASENAME`（`lib/runner-provenance.mjs:11-13`）以 Unicode regex 排除 `/`、`\\`、U+0000–U+001F、DEL、空值、`.`／`..` 與超過 128 個 Unicode code points；`SAFE_CANDIDATE_EXECUTABLE`（同檔 `:18`）先限制 candidate wrapper 的 separator／control／長度，再由 `:30-31` 套 basename boundary。`sanitizeRunnerArgv()`（`:36-50`）只保存 allowlist token，drop 時只保留 count，不保存原值。`sanitizeRunnerCommand()`（`:53-58`）同樣拒絕 path／control／dot name／oversize，且不引入 spawn 或 runtime network 行為。
- 證據：獨立 deterministic probe 實測 `<candidate-executable:離線字幕工廠>` pass；`/home/private/x`、`\\home\\private\\x`、`.`、`..`、含 newline、129 個 ASCII 字元均 drop；128 個 emoji 通過、129 個 emoji drop。結果與 source contract 一致。

## 3. 邊界情況

- 判定：通過
- 證據：repo regression（`scripts/test-ollama-ui-offline.mjs:68-78`）實測 slash path、dot name、newline control、129 字元 oversize，並確認 `argvRedactionValidated=false`、原始 path 不出現在投影；獨立 probe 補足 backslash separator 與 exact 128／129 Unicode code-point boundary。`SAFE_CANDIDATE_BASENAME.test(candidateMatch[1])` 使 wrapper 形式的 `.`／`..` 不能因外層 regex 匹配而放行。
- 證據：`scripts/test-ollama-ui-offline.mjs:80-105` 另驗證 secret-shaped raw argv、private path、非法 command、boxed command 的 fail-closed；`JSON.stringify()` 投影不包含 `/home/private` 或 `sk-live-secret`。

## 4. 程式碼品質

- 判定：通過
- 證據：candidate 與 command 共用 `SAFE_BASENAME`，避免兩份 Unicode boundary 漂移；修改集中於 `lib/runner-provenance.mjs:11-18` 與 focused test，未改產品 runtime、live spawn、Seatbelt policy、Ollama、既有 evidence 或發布資產。`git diff --check` exit 0；source syntax check exit 0。
- 證據：`03-FUNCTIONAL-DESIGN.md:131-133` 將 allowlist、保存邊界與「不等於 UI acceptance」的語意寫清楚；文件沒有把 Unicode sanitizer 修正描述成網路隔離或產品驗收。

## 5. 測試覆蓋

- 判定：通過
- 證據：2026-10-28 13:10–13:12（Asia/Taipei）執行 `node --check lib/runner-provenance.mjs`、`node --check scripts/test-ollama-ui-offline.mjs`、`node scripts/test-ollama-ui-offline.mjs`，均 exit 0，輸出包含 `Ollama offline packaged UI contract test passed`。
- 證據：同一審查回合執行 `npm run check` exit 0（含治理檢查、所有 deterministic suites、syntax checks 與 YouTube no-network tests）、`npm run docs:check` exit 0（19 個治理文件）、`node scripts/test-project-docs-validator.mjs` exit 0、`git diff --check` exit 0。未執行任何 live acceptance、network probe、Ollama model 或 packaged Electron UI replay。

## 6. 實際運行結果

- 判定：部分通過
- 證據：immutable replay1 `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-packaged-ui-offline-current-source-replay1.json:22-35,100-140,156-162` 唯讀核對為 `status=fail`、`failureCode=CHROMIUM_CHILD_SANDBOX_INIT_FAILED`、`failureStage=electron_start`、Electron `SIGTRAP`；Seatbelt loopback／external `EPERM`、`systemNetworkDisabled=false`、candidate／review.js／Framework hashes、raw output exclusion 與 cleanup 欄位均原樣存在。文件 SHA-256 為 `fdd8d2ff0e5b4fceae00d73494985d01b351370ffbad01615acbb47214ddd808`。
- 證據：本輪明確不會 retroactively 修改 replay1，也沒有重新執行同一 offline failure。`systemNetworkDisabled=false`、nested Chromium／Seatbelt UI blocker 與 FR-021 incomplete scope 均未被擴大宣稱；因此本節只對 deterministic evidence contract 通過，不能對 packaged UI offline runtime pass 下結論。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無本輪程式或文件同步阻擋；唯一保留條件是本輪明確未重跑 live acceptance，且 immutable replay1 的既有 failure／scope 必須維持原樣。
- 可逐字引用的完整結論句：**本輪 FR-021 Unicode candidate executable argv provenance round1 有條件通過：Unicode-safe candidate basename 與 fail-closed path／separator／control／dot-name／oversize contract、deterministic regression 及 00／03／06／07／08 文件同步均通過；本輪未且不得 retroactively 修改 replay1，replay1 仍為 systemNetworkDisabled=false、CHROMIUM_CHILD_SANDBOX_INIT_FAILED／SIGTRAP 的 Seatbelt packaged UI blocker，FR-021 仍未完整驗收。**

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
