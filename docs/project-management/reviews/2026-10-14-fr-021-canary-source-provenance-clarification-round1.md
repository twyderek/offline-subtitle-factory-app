# 獨立審查報告：FR-021 canary source reference provenance wording clarification

- 審查日期：2026-10-14（審查批次時間戳：2026-10-14T03:51:42Z）
- 審查範圍：本輪 `scripts/accept-macos-seatbelt-nested-profile-canary.mjs`、`docs/project-management/evidence/2026-10-14-fr-021-macos-seatbelt-nested-profile-canary-replay4.json`、`00-CURRENT-STATUS.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、`08-CHANGE-LOG.md` 最新條目；並直接核對既有 replay2／replay3、replay11、2026-10-12 static identity evidence、round3／round5／round6 報告。
- 審查對象版本：工作樹專案版本 0.51.0、分支 `codex/0.51-anthropic-claude`；工作樹已有其他 dirty changes，本報告只判定上述範圍，不把不相關變更納入本輪結論。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-14 UTC；獨立唯讀審查上下文，先讀 `AGENTS.md`，執行 `npm run project:preflight -- --type=debug`，再讀取 preflight 列出的固定核心、debug 路由及直接相關 replay／round6 原件，未沿用主要代理的評價性摘要。
- 審查限制：未啟動 packaged Electron、Ollama 或任何 network probe；未執行 canary replay（避免審查期間新增 evidence）；未修改 OS network policy、Wi-Fi、PF、防火牆或 Network Extension；未使用 `--no-sandbox`。除建立本報告外未寫入其他專案檔案。

## 1. 需求完整性

- 判定：通過（限本輪 source-reference provenance wording clarification；FR-021 整體不通過／未結案）。
- 證據：
  - 最新 `08-CHANGE-LOG.md:3-19` 將目標限定為區分 mutable `HEAD` 與固定 tag／commit／blob，並明確寫出不得宣稱 exact generated profile、replay-time binary provenance 或 FR-021 packaged UI offline acceptance。
  - `00-CURRENT-STATUS.md:9-16`、`06-TEST-AND-PROCESS-AUDIT.md:18-30`、`07-DEBUG-AND-FIX-HISTORY.md:3-9` 均把本輪限定在 synthetic Seatbelt profile-composition／文件追溯，不把 source pin 說成 UI 驗收或 binary provenance。
  - 新 evidence `...replay4.json:13-18,99-115` 以 `packagedCandidateExecuted=false`、`purpose`、`packagedElectronRerun=false`、`uiFlowRun=false` 及 `status=pass` 清楚區分「canary pass」與「packaged UI pass」。

## 2. 邏輯正確性

- 判定：通過（限 synthetic canary 行為與來源引用邊界）。
- 證據：
  - script `scripts/accept-macos-seatbelt-nested-profile-canary.mjs:57-93` 固定四個 case：相同 restrictive parent／child 成功、restrictive parent 拒絕 network-service shape、僅加 TCP／UDP 的 narrow parent 仍拒絕、unrestricted parent 接受；pass 條件與 evidence 的四案結果一致。
  - 新 evidence `:41-97` 四案均 `pass=true`，結果為 `0`、`71 + Operation not permitted`、`71 + Operation not permitted`、`0`；與既有 replay3 的 profiles、case 名稱及 case result 靜態比較均相同。
  - source reference 已由 script `:138-145` 與 evidence `:108-115` 固定到 Chromium `150.0.7871.212` tag URL，並記錄 tag 對應 commit `69bf1c67cb894365d151bd020bb0171fd583633a6` 及 `network.sb` blob `58477d8d17902258b3f361d72751a32c034e0645`。
  - `sourceReferencePolicy` 是可讀且與文件一致的限制文字：mutable `HEAD` 不作 evidence source，固定 source 只提供 policy fragment 參考。

## 3. 邊界情況

- 判定：通過（限本輪靜態／既有 evidence 邊界；未涵蓋 packaged UI egress acceptance）。
- 證據：
  - script `:10-11,29-39` 只使用 `/usr/bin/sandbox-exec`、巢狀 profile 與 `/usr/bin/true`；`invocation` `:113-120` 記錄 harness 不使用 network API、未建立 network connection、未嘗試 external socket。
  - evidence `:19-39,99-105` 記錄 `networkConnectionsAttempted=false`、`externalSocketAttempted=false`、`systemNetworkDisabled=false`、`systemNetworkConfigurationChanged=false`、`packagedElectronRerun=false`、`uiFlowRun=false`，且 `chromiumNetworkServiceShapeIsExactGeneratedProfile=false`。
  - `interpretation` `:107` 說明 `(allow default)` 僅是未連網 `/usr/bin/true` 的 policy-load probe，不是可接受的 UI 外連隔離方案；同時明確否定唯一 root cause 與 UI/offline acceptance 推論。
  - 既有 replay2／replay3／exploratory evidence 的 mutable Chromium `HEAD` URL 未被覆寫；`00-CURRENT-STATUS.md:14`、`06-TEST-AND-PROCESS-AUDIT.md:30`、`07-DEBUG-AND-FIX-HISTORY.md:8` 將其明確限定為保留的歷史／背景來源欄位，而非本輪 evidence source。round6 原件仍保留其當時發現，不被改寫。

## 4. 程式碼品質

- 判定：部分通過（無本輪證據阻擋；有一項非阻擋的可維運風險）。
- 證據：
  - script 使用固定絕對執行檔、明列 argv、固定 case profile、`spawnSync` timeout／maxBuffer，並以 `writeFileSync(..., { flag: 'wx' })` `:148-153` 拒絕覆寫既有 evidence；路徑檢查 `:47-55` 限制輸出在 evidence 目錄且為 `.json`。
  - `node --check scripts/accept-macos-seatbelt-nested-profile-canary.mjs` 於 2026-10-14T03:51:42Z exit 0；新 script 與新 JSON 的尾端空白掃描無命中；`git diff --check` exit 0。
  - 非阻擋風險：script `:12` 的無參數預設輸出仍是既有 `2026-10-01-macos-seatbelt-nested-profile-canary-replay2.json`。因該檔案已存在且 `:149` 使用 exclusive-create，macOS 無參數重跑會先執行 canary、再以 EEXIST exit 2，而不會自動產生本輪 replay4。當前 replay4 已由明確輸出路徑保存，故不否定本輪 evidence；後續重播應明確傳入新 evidence 路徑，或由主要代理另立小型可維運修正。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - `npm run project:preflight -- --type=debug` 於 2026-10-14T03:51:42Z exit 0，列出並據此讀取 `AGENTS.md`、project README、00、03、06、07、08 及 workflows 03／04／05／07。
  - `node --check scripts/accept-macos-seatbelt-nested-profile-canary.mjs` exit 0。
  - `node -e` 解析新 replay4 JSON exit 0；靜態 invariant 檢查確認 `schema` 正確、`status=pass`、四案全 pass、pinned tag URL 存在、sourceReferences 不含 mutable `HEAD` URL、exact generated profile／packagedElectronRerun／uiFlowRun／networkConnectionsAttempted／externalSocketAttempted 均為否。
  - replay3／replay4 靜態比較 exit 0：`sameProfiles=true`、`sameCaseNames=true`、`sameCaseResults=true`，replay4 source refs 為 pinned tag／Electron／Apple reference。
  - provenance wording `rg` 檢查 exit 0：新 script／replay4 只使用 pinned tag reference；00／06／07／08 對既有 `HEAD` 明示歷史／背景邊界，並含 exact profile、binary provenance、packaged UI offline acceptance 的否定限制。
  - 新增範圍檔案的尾端空白掃描 exit 1（無命中，代表檢查通過）；`git diff --check` exit 0。
  - `npm run docs:check` 於 2026-10-14T03:51:42Z exit 0，輸出「專案治理文件檢查通過：19 個文件，版本 0.51.0」。本輪未執行 `npm run check`、`npm run docs:check:final`、canary replay、packaged Electron、Ollama 或 network probe；因此不把保存的開發代理 replay4 結果冒稱為本審查重新實測。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 新 evidence `:108-115` 有 versioned tag URL、tag version、commit SHA、blob SHA-1，並且 `:114` 明確宣告 mutable `HEAD` 不作 evidence source。
  - `00-CURRENT-STATUS.md:14`、`06-TEST-AND-PROCESS-AUDIT.md:30`、`07-DEBUG-AND-FIX-HISTORY.md:8-9` 共同說明舊 replay／exploratory `HEAD` 只作不可改寫的歷史／背景參考；`08-CHANGE-LOG.md:7,11,17-19` 將本輪成功條件、固定來源及未完成限制寫入最新條目。
  - round6 `:29,45-47` 的舊結論指出當時 mutable `HEAD` 尚未完全對齊；本輪未修改 round6 原件，而是以新 script／replay4／治理文件完成來源文字校正，符合「不覆寫既有報告」的治理要求。
- 條件：後續由主要代理在不修改本報告及既有 replay／round6 原件的前提下，把本報告路徑及下方逐字結論同步到最新 `08-CHANGE-LOG.md`，再依治理流程執行 final gate。這是本輪工作條目的治理收尾條件，不是要求放寬安全邊界或補做未授權的 packaged UI／OS network 驗收。

## Blockers、條件與剩餘風險

- 本輪 clarification 子範圍：沒有發現會使 replay4 provenance wording 失效的 blocker。
- 整體 FR-021 blocker：packaged Electron UI offline acceptance 仍未完成；既有 replay11 是 `electron_start`／`CHROMIUM_CHILD_SANDBOX_INIT_FAILED` 失敗證據，synthetic replay4 不是 UI pass。
- 尚未證明：replay-time binary provenance、replay-time Framework identity、Chromium exact generated profile、唯一 root cause、OS-level／per-app egress control 及完整 packaged UI offline flow。`systemNetworkDisabled=false`，本輪沒有授權或配置 OS-level egress control。
- 歷史 evidence 風險：既有 replay2／replay3／exploratory JSON 仍保留 mutable `HEAD` URL；它們不能單獨被重新解讀為本輪 pinned source evidence。治理文件已標示為歷史／背景，且本輪未覆寫原件。
- 可維運風險：無參數執行 script 仍預設指向既有 replay2，後續必須傳入新 `.json` 路徑以符合 exclusive-create；這不影響已保存 replay4 的內容正確性。
- 審查測試限制：本審查沒有重跑 canary、Electron、Ollama、network probe 或 OS policy；因此只對靜態 source pin、evidence consistency、scope wording 與文件追溯性下結論。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪獨立審查結論為有條件通過：canary source-reference wording 與 replay4 evidence 已將 Chromium mutable `HEAD` 限定為既有歷史／背景參考，改用 pinned `150.0.7871.212` tag URL 並記錄 tag 對應 commit `69bf1c67cb894365d151bd020bb0171fd583633a6` 與 `network.sb` blob `58477d8d17902258b3f361d72751a32c034e0645`，且 synthetic profile-composition 的範圍與限制可追溯；但本輪只完成來源引用與合成 canary 的邊界澄清，不代表 packaged UI offline acceptance、replay-time binary provenance、exact generated profile 或 FR-021 整體 acceptance 已完成。**
- 阻擋問題（若有）：FR-021 packaged UI offline acceptance 仍是整體需求阻擋；本輪治理條件是主要代理需整合本報告逐字結論至最新 08 條目並另行通過 final gate。無需因本輪 wording clarification 修改既有 evidence／round6 原件。
- 給主要開發代理的具體後續要求：保留舊 `HEAD` evidence／報告；本輪及後續新 evidence 只使用 pinned source reference；整合本報告後再執行 `npm run docs:check:final`。若要改善無參數 script 的 replay ergonomics，另開明確小變更，不把該非阻擋風險混同為 provenance 或 UI acceptance 證據。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 工作樹中在本輪開始前已存在的其他 dirty changes 均予以保留。
- 本輪審查唯一新增檔案為完整路徑：`/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/reviews/2026-10-14-fr-021-canary-source-provenance-clarification-round1.md`。未新增、覆寫或刪除任何既有 evidence、既有報告、script、治理文件或其他專案檔案。
- 本輪未啟動 packaged Electron、Ollama 或任何 network probe，未更改 OS network policy、Wi-Fi、PF、防火牆或 Network Extension。
- 若上述聲明不實，本報告無效。
