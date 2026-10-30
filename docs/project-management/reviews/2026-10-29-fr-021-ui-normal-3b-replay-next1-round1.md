# 獨立審查報告：FR-021 current-source packaged UI normal-loopback 3B replay next stage

- 審查對象 commit／版本：工作樹 `codex/0.51-anthropic-claude`、版本 `0.52.0`；目前為 dirty worktree，本報告只審查指定範圍。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — current-source packaged UI normal-loopback 3B replay next stage（`FR-021-REPLAY-20261029-UI-NORMAL-3B-NEXT1`）。
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-29；獨立審查 session，未沿用主要開發代理對話記憶；`date -Iseconds` 複核時間為 `2026-10-29T12:31:14+08:00`。

## 1. 需求完整性

- 判定：通過（限 macOS arm64 current packaged candidate、預裝 `llama3.2:3b`、normal loopback packaged UI replay 範圍）。
- 證據：`08-CHANGE-LOG.md:3-20` 明定 candidate、3B model、normal loopback 與不在範圍事項；`00-CURRENT-STATUS.md:3-9` 與 `06-TEST-AND-PROCESS-AUDIT.md:3-10` 對 next1／next2／next3、BUG-062、0600 writer、UI flow 與 residual boundary 的描述一致。next3 evidence `...next3.json:52-68` 為 `darwin`／`arm64`、`llama3.2:3b`、loopback、無 API key；本機 `ollama list`（唯讀）實際列出 `llama3.2:3b`。文件沒有將結果宣稱為 Seatbelt offline、全機斷網、signed/notarized package、Windows 或 FR-021 overall。

## 2. 邏輯正確性

- 判定：通過。
- 證據：`scripts/verify-electron-ollama-ui.mjs:209-218` 的首頁探針只在記憶體回傳 `apiToken`；`491-504` 將 token 取入 `navigationToken`，另建不含 token 的 `homeEvidence`；`567-585` 僅以該記憶體 token 建立 review navigation，並把 `href`／`title`／`cueCount` 以去敏欄位保存。`958` 使用 `flag: 'wx', mode: 0o600` 寫 evidence；`scripts/test-ollama-ui-offline.mjs:305-338` 固定檢查 exclusive 0600、token non-persistence 與 review navigation contract。這與 BUG-062 的根因／修正描述（`07-DEBUG-AND-FIX-HISTORY.md:3-9`）相符。
- 證據：next1／next2 evidence 均為 `status: fail`、`error.stage: review_navigation`，沒有 post-navigation UI flow；next2 保存去敏 local review `href`、title、`cueCount: "0"`（`...next1.json:70-155`、`...next2.json:70-160`）。next3 的通過條件由 runner 實際強制：home/review（`500-585`）、Ollama settings/privacy（`588-643`）、AI task（`646-683`、`782-812`）、accept（`822-837`）、undo/redo（`839-856`）、save/timecodes/original SRT invariant（`858-889`）。

## 3. 邊界情況

- 判定：通過（已驗證本輪要求的 bounded failure／privacy／cleanup 邊界；不外推未測範圍）。
- 證據：next1／next2 都記錄 `systemNetworkDisabled: false`、`sandboxedTargetProcessTree: false`、`loopbackOnlyConfiguration: true`、`apiKeySupplied: false`，且 Electron process group、server port、userData 與 owned daemon cleanup 全部通過（`...next1.json:62-85`、`...next2.json:62-85`）。next3 同樣明確記錄 normal loopback scope（`...next3.json:62-85`），所以不會把正常 loopback 結果誤稱為 Seatbelt offline 或全機斷網。
- 證據：三份 evidence 均為 JSON 可解析、目前檔案 mode `0600`；唯讀結構化 assertion 檢查了 failure status/stage、next3 flow/privacy/cleanup、無 token-like persisted value、無 `/Users/`／temporary absolute path、raw child output 未保存與 SHA-256 一致，結果為 `structured evidence assertions passed`。normal runner 對 child output 只保存 bounded hash／bytes（`verify-electron-ollama-ui.mjs:268-279`、`923-936`），不保存 raw output。

## 4. 程式碼品質

- 判定：通過。
- 證據：candidate executable、review script、Electron Framework 在 child spawn 前計算 hash（`verify-electron-ollama-ui.mjs:242-260`）；launch argv 經 `projectRunnerProvenance` 投影（`288-314`）；failure category 與 startup diagnostics 使用固定 allowlist（`418-449`）；cleanup 失敗會將 evidence 改為 fail（`939-955`）。source regression 同時檢查禁止 `--no-sandbox`、raw child logs、raw startup output 與 raw exception persistence（`test-ollama-ui-offline.mjs:330-345`）。
- 證據：`git diff --check` exit 0；沒有為了通過本輪 replay 引入 sandbox disabling flag、修改 OS network、修改 Ollama/model store 或覆寫 immutable evidence。

## 5. 測試覆蓋

- 判定：通過（對本工作項目與其治理 closeout 前置驗證而言）。
- 證據：`npm run project:preflight -- --type=governance` exit 0；`node --check scripts/verify-electron-ollama-ui.mjs` exit 0；`node scripts/test-ollama-ui-offline.mjs` 於 `2026-10-29T12:31:19+08:00` 至 `12:31:21+08:00` 完成，通過 missing-model/no-download、bundle preflight 三案例、0600/token/privacy source contract；`npm run check` exit 0，包含 `docs:check`、所有 syntax checks、完整 npm test 與 YouTube posttest；`git diff --check` exit 0。未重播 live verifier，因該指令會建立新的 evidence，而本輪唯一允許寫入的是本報告；既有 next1／next2／next3 live evidence 已以 hash、權限與結構化 assertion 獨立核對。
- 證據：`npm run docs:check:final` 目前 exit 1，錯誤為最新 08 條目缺少「獨立審查是否執行：」「發布授權：」、尚未標示「完成」且獨立審查欄位未為是／否；這是治理 closeout blocker，不是 runner／UI／AI replay 的測試失敗。

## 6. 實際運行結果

- 判定：通過（限本輪宣告界線）。
- 證據：candidate `../dist/mac-arm64/離線字幕工廠.app` main executable 與 Electron Framework 的 `file` 結果均為 arm64；Info.plist 為 `0.52.0`；重算 SHA-256 與 next3 evidence 相符：candidate `b3605c...10de4`、Framework `416b6c...c8cee`、next3 evidence `b275d0...ae77`。三份 evidence 實際 `stat` 均為 `-rw-------`／`600`。
- 證據：next3 evidence `...next3.json:105-170` 實際保存 home dashboard、review ready、Ollama settings saved、provider `ollama`、model `llama3.2:3b`、英文輸出、API key empty／no saved value／local privacy、2 suggestions completed、accept 2、undo／redo、`reviewed.srt`、2 cues、timecodes unchanged、English translation；`...next3.json:71-85` 與 `87-103` 保存 Electron／server／temporary cleanup 及 original SRT unchanged。這是成功的 normal loopback packaged UI replay，沒有保存 token。
- 證據：next1／next2 的 immutable bounded failure boundary 如實保留 `status: fail`、`stage: review_navigation`、無 settings／AI／accept／history／save pass；next2 additionally 保存去敏 `href`／title／`cueCount: "0"`（`...next2.json:103-160`）。它們沒有被回寫成成功 evidence。

## 綜合判定

- 判定：有條件通過。
- 證據：指定 replay scope 的六面向檢查均有可回溯 source／evidence／command 證據；BUG-062 token navigation 只在記憶體傳遞、evidence 不保存 token；normal evidence writer 是 exclusive owner-only 0600；next1／next2 failure boundary 與 next3 完整 UI／AI／save／cleanup 結果一致。阻擋項是 `npm run docs:check:final` 仍因 `08-CHANGE-LOG.md:3-20` 的最新條目為「進行中」且缺少審查／發布授權欄位而失敗。
- 阻擋問題（若有）：F-01（治理 closeout，P1）：主要代理須在不修改本報告的前提下完成 08 最新條目結案欄位、連結本報告並逐字引用本結論，明確記錄獨立審查為是、發布授權不適用，再重跑 `npm run docs:check:final`。在此之前不可宣稱本工作項目治理結案。
- 剩餘風險：本結論只證明 macOS arm64 current packaged candidate、當時已安裝／可用的 `llama3.2:3b`、normal loopback packaged UI replay；不證明 Seatbelt offline、全機網路斷線、signed/notarized package、Windows 或 FR-021 overall，也不解除既有 nested Chromium Seatbelt blocker。normal evidence 為既有桌面 Ollama scope，未宣稱 isolated daemon／network sandbox。
- 給主要開發代理的具體修正要求（若有）：只處理 F-01 治理 closeout；不要覆寫 next1／next2／next3 或本 round1 報告。完成後重跑 `npm run docs:check:final`，並保留上述 scope／residual risk 原文邊界。
- 結論：有條件通過。
- 可逐字引用的完整結論句：本輪 `FR-021-REPLAY-20261029-UI-NORMAL-3B-NEXT1` round1 有條件通過：在 macOS arm64 current packaged candidate、已安裝 `llama3.2:3b`、normal loopback scope 內，BUG-062 token 只在記憶體導覽、evidence 不保存 token、writer 使用 exclusive owner-only 0600、next1／next2 failure boundary 與 next3 home／review／Ollama AI／accept／undo-redo／save／timecodes／cleanup／privacy 證據均如實成立；但 08-CHANGE-LOG 最新條目仍為「進行中」且尚未完成獨立審查欄位與 final docs closeout，因此不得將本輪擴稱為 Seatbelt offline、全機斷網、signed/notarized package、Windows 或 FR-021 overall。

## 審查代理聲明

- 判定：通過。
- 證據：本審查代理除建立本報告外，僅執行讀取、唯讀指令、syntax／focused／完整回歸驗證與 evidence hash／權限／結構化核對；未修改程式碼、測試、evidence、candidate、Ollama、model store、OS network、治理來源文件或既有審查報告。
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
