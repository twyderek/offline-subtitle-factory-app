# 獨立審查報告：FR-021 packaged Electron UI macOS 26.6.2 Seatbelt 可行性重播

- 審查對象 commit／版本：HEAD `299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`，branch `codex/0.51-anthropic-claude`，現行版本 0.51.0；審查的是尚未提交的指定工作樹內容。既有 packaged candidate 來源為 `53956ccdee6e16e4c0413f09312a419613b27da6`，不代表目前 dirty worktree 的 build。
- 對應 08-CHANGE-LOG 條目：2026-09-30 — FR-021 packaged Electron UI macOS 26.6.2 Seatbelt 可行性重播（`docs/project-management/08-CHANGE-LOG.md:3–22`）。
- 審查輪次：round2。
- 審查代理啟動時間、上下文來源：本輪於 2026-10-01 Asia/Taipei 執行；首筆保存的本輪時間戳為 09:51:25 +0800，首次工具啟動秒數未另保存。使用本審查對話的獨立 fresh context，未沿用主要開發代理的對話記憶；上下文來源為需求方任務、儲存庫规范、原 round1 報告與指定程式／evidence。
- 執行計畫與限制：先讀 AGENTS、執行 debug preflight 及讀取路由，再核對 round1 要求、runner／test／保存 evidence，執行 focused 與負向 CLI 驗證，最後只建立本報告。未啟動 packaged app、真實 Ollama、Seatbelt network probe，未修改系統網路；必要 CLI 測試 evidence 位於獨立暫存目錄並已於 finally 清除。
- 治理路由：`npm run project:preflight -- --type=debug` exit 0；已讀其固定核心、debug 路由及 `workflows/04-INDEPENDENT-REVIEW.md`，歷史只讀相關片段與工作紀錄範本。報告格式另依 `scripts/project-docs-validator.mjs:12–33` 加入完整可引用結論句。
- 證據縮寫（下文行號均指本輪讀取的原檔）：E10 = `docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay10.json`；E11 = 同目錄 `2026-09-30-ollama-llama3.2-3b-ui-offline-replay11.json`；E12 = 同目錄 `2026-09-30-ollama-llama3.2-3b-ui-offline-replay12.json`。R1 = `docs/project-management/reviews/2026-09-30-fr-021-macos-26-6-2-seatbelt-replay-round1.md`。

## 1. 需求完整性

- 判定：通過（限可行性重播與 round1 修補範圍）。
- 證據：R1:17、22、41–42 要求新增 executable-path misuse 負向回歸、未來 evidence 保存去敏 OS version/build 與 bundle input kind，且不得回填舊 evidence。`scripts/verify-electron-ollama-ui-offline.mjs:33–39` 定義 v3、OS 欄位及輸入種類；`:82–103` 將輸入種類限制為 enum、OS 值限制為數字版本／英數 build；`:403–419` 在 bundle preflight 前取得當次 OS 身分。`scripts/test-ollama-ui-offline.mjs:159–190` 已新增真正呼叫 wrapper 的 executable-path 負向案例，核對錯誤碼、stage、OS 格式、類別與未啟動隔離流程。E12:2–24 保存 v3、`26.6.2`、`25G83`、`app_executable_path` 與 `APP_BUNDLE_INVALID`。
- `docs/project-management/08-CHANGE-LOG.md:12–20`、`00-CURRENT-STATUS.md:34–36`、`06-TEST-AND-PROCESS-AUDIT.md:20–27` 明確維持可行性查核、UI acceptance 失敗及 FR-021 未結案的範圍；不宣稱取消／checkpoint-resume、全機斷網或 Windows 已验收。工作紀錄仍為進行中（第 5–6、21 行），等待本輪報告整合與 final gate，屬如實揭露，非假結案。
- E10/E11 仍是 v2，環境只有 platform/arch/node、candidate 無 bundleInputKind（E10:2、6–16；E11:2、6–16）；缺少 OS/build 的歷史證據缺口仍保留。E12 是新一次負向 preflight，不能把其 OS 欄位移植為 E11 當次 UI 啟動的 JSON 證據。

## 2. 邏輯正確性

- 判定：通過（核心負向拒絕與去敏流程）；輸入種類另有一項非阻擋邊界問題，見第 3 節。
- 證據：`scripts/verify-electron-ollama-ui-offline.mjs:150–167` 先 realpath，再要求實體 `.app` 目錄、identifier、package/bundle version 及 executable。main 的 `app_bundle_preflight`（`:418–423`）早於 `ollama_binary_preflight`（`:425–431`）、profile probe（`:433–434`）、daemon spawn（`:447–452`）與 UI driver（`:461–463`），因此傳入 executable 會在啟動前拒絕。
- 2026-10-01T01:55:15.082Z–01:55:15.260Z 的直接 CLI subprocess 驗證，使用現有 candidate executable、`OLLAMA_BIN=/nonexistent-round2-review-ollama` 及兩個 nonexistent test-only spawn seams，實際 wrapper exit 1，取得 `APP_BUNDLE_INVALID`／`app_bundle_preflight`、v3、`app_executable_path`、macOS `26.6.2`／build `25G83`（另以 `/usr/bin/sw_vers` 比對相等）。`ui=null`、loopback/external probe flags、daemon/Electron started flags 均 false；driver/daemon cleanup-start 均 false，所有關閉／port／temp cleanup flags 均 true；candidate 路徑及測試暫存路徑未出現在 JSON。此處 cleanup 為未曾建立資源的 defaults，不冒稱實際啟動後清理。
- OS 輸出僅經兩條固定 `sw_vers` 命令讀取；錯誤／非零 status／格式錯誤回 null，main 以 `MACOS_IDENTITY_UNAVAILABLE` fail-closed（`:90–103`、`:405–409`）。Evidence 寫入仍使用 `flag: 'wx'`（`:519–524`），不覆寫現有目標。E12:25–55 的未啟動及 cleanup defaults 與本輪 CLI 結果一致。

## 3. 邊界情況

- 判定：部分通過。
- 證據：直接 CLI 三案於 2026-10-01T01:55:15.082Z–01:55:15.260Z 執行，均符合預期 fail-closed，父驗證程序 exit 0，finally 確認暫存目錄不存在：
  - candidate executable：`APP_BUNDLE_INVALID`／`app_bundle_preflight`、`app_executable_path`、elapsed 11 ms，沒有 Seatbelt/Ollama/Electron 啟動。
  - 正常 `.app` 目錄：bundle metadata/version/hash 檢查完成，在刻意不存在的 Ollama binary 處回 `OLLAMA_EXECUTABLE_NOT_ACCESSIBLE`／`ollama_binary_preflight`、`app_bundle_directory`、elapsed 23 ms，沒有進入 network probe 或 daemon。
  - 同一 `.app/` 目錄（尾端 `/`）：同樣通過 bundle 檢查並在 missing Ollama 處拒絕，elapsed 20 ms；但 `bundleInputKind=other`。
- 非阻擋問題 P3-01：`scripts/verify-electron-ollama-ui-offline.mjs:84–87` 的 `path.normalize()` 保留尾端 separator，故 `endsWith('.app')` 為 false；`:419` 的 `path.resolve()` 則會移除尾端 separator，讓實際 bundle 驗證通過。同一合法目錄因呼叫形狀被標為 `other`，降低新增 evidence 欄位的精確度。此問題不影響 executable-path 拒絕、不擴大網路權限、不使 acceptance 假成功；建議後續以一致的路徑正規化固定分類，補 `.app/` 回歸。本轮不修改程式。
- 2026-10-01T01:54:35.390Z 的暫時 VM 診斷另確認 missing/bundle/executable/other 四類輸入，以及六組 OS identity 案例：正常三段／兩段版本通過，混入路徑／換行、非法 product/build、非零 exit、ETIMEDOUT 各相應欄位回 null。此為附加 in-memory 驗證，不是 CLI 完整整合或 UI 實機證據。先前 01:53:37.251Z 的探索性斷言將 `.app/` 預期為 `app_bundle_directory` 而失敗，發現的分類差異已由上述原始 CLI 確認；未以 VM 結果取代 CLI。
- Focused test 實際執行 POSIX child cleanup 的 graceful SIGTERM、forced SIGKILL、無法確認及 invalid group ID 案例（`scripts/test-ollama-ui-offline.mjs:90–138`）；保存的 E11:25–37、87–115 支持既有 loopback/EPERM、無下載及程序清理，這些實機情況本輪未重跑。

## 4. 程式碼品質

- 判定：通過（指定 runner/test 的本輪修補）；P3-01 為低風險可改善項。
- 證據：`scripts/verify-electron-ollama-ui-offline.mjs:82–103` 用固定分類值與簡單格式白名單避免把 OS 原始輸出或 bundle 絕對路徑寫入新欄位；`:38–39` 的欄位 defaults 與 E12 preflight failure 相容。新的 OS subprocess 有 5 秒 timeout、1024-byte buffer 和最小 env（`:92–95`），未提供任意命令字串執行。Spawn seam 只在 `NODE_ENV=test` 生效（`:21–28`）。
- `scripts/test-ollama-ui-offline.mjs:159–190` 的負向案例對 exit/stage/schema/input-kind/OS/no-start/path privacy 做具體 assertions；`:226–227` 以 finally 回收該測試自建暫存。runner 保持固定化 failure code（`:467–472`）與 exclusive evidence create（`:519–524`）。本次三項 `node --check` 和 `git diff --check` 通過，見第 5 節。
- 測試組織的限制：新增負向案例放在與真實 Ollama ENOENT 案相同的 prerequisites gate 中（test `:141–152`），即使負向 bundle preflight 不需要 Ollama/model，也會因其不可用而被跳過。這是覆蓋可攜性限制；可考慮後續把這一負向 case 移到僅需 macOS/candidate 的獨立區塊，避免只執行契約測試卻误讀為 integration 全部跑完。

## 5. 測試覆蓋

- 判定：通過（限定驗證）；未執行全套回歸或真實 daemon integration。
- 證據：2026-10-01 09:52:21 +0800 執行 `OLLAMA_BIN=/nonexistent-round2-review-ollama node scripts/test-ollama-ui-offline.mjs`，exit 0，輸出 `Ollama offline UI spawn-error integration test skipped: packaged macOS candidate, Seatbelt, Ollama, or preinstalled 3B model unavailable` 與 `Ollama offline packaged UI contract test passed`。因此本次 runner source contracts、DevTools trust/no-constructor tests 及 POSIX process-group cases 通過，gate 內 executable/ENOENT integrations 沒有由該命令執行；不能以總體 passed 訊息宣稱 daemon integration 通過。測試 `:147–149` 會執行真實 `ollama list`，`:192–224` 的 ENOENT 案會啟動隔離 daemon，故本輪刻意提供 nonexistent binary 避免違反限制。
- 2026-10-01T01:55:15.082Z–01:55:15.260Z，另以 Node stdin focused 驗證父程序直接 `spawnSync` 原始 CLI：`node scripts/verify-electron-ollama-ui-offline.mjs <candidate-executable> <temporary-evidence> llama3.2:3b`。env 包含 `NODE_ENV=test`、nonexistent `OLLAMA_BIN`／daemon-command／UI-runner-command。已逐一檢查與 source test `:177–190` 相同的核心預期，另檢查 driver 未啟動、cleanup flags、`ui=null`、本機 `sw_vers` 值相等與完整路徑不外洩；全部 PASS。補充兩種 bundle 形狀的原始 CLI 邊界驗證見第 3 節。暫存 evidence 在 finally 清除、確認不存在，未建立新版持久 replay。
- 2026-10-01 09:52:21 與 09:55:15 +0800：`node --check scripts/verify-electron-ollama-ui-offline.mjs`、`node --check scripts/test-ollama-ui-offline.mjs`、`node --check scripts/verify-electron-ollama-ui.mjs` 及 `git diff --check` 均無錯誤輸出，命令批次 exit 0。`git diff --check` 檢查 tracked dirty diff 的 whitespace，不表示審查其他 dirty 程式，也不涵蓋尚未 tracked 的報告。
- 開發驗證與獨立驗證分開：`08-CHANGE-LOG.md:20–21` 與 `06-TEST-AND-PROCESS-AUDIT.md:26` 記載主要代理完整 `npm run check`／codesign 已通過；本輪沒有自行重跑或認證這些完整結果。依需求方限制未執行 `npm run check`、`npm run docs:check:final`、packaged UI 或真實 Ollama integration。Final gate 留給主要代理在整合本報告後執行。
- 2026-10-01T01:58:33.957Z，以 `node --input-type=module` 只讀匯入 `validateReviewReport` 驗證本報告，`errors=[]`、完整結論句長度 195，父程序 exit 0；此為報告格式 focused 檢查，並非 `docs:check:final`。同時比對 E10/E11/E12/R1 SHA-256 全部 PASS；09:58:33 +0800 的 `git diff --check` 再次無錯誤。

## 6. 實際運行結果

- 判定：通過（可行性失敗有可回溯證據）；packaged UI acceptance 未通過。
- 證據：本輪實際執行只有 focused 測試及 preflight CLI；實際 UI 啟動／Seatbelt/Ollama 運行證據限於已保存 replay。E10:3–5、19–39 記錄 2026-09-30T07:59:10.245Z 的 preflight 拒絕，未進 UI。E11:3–5、19–37 記錄 2026-09-30T07:59:53.349Z–08:00:00.166Z、6817 ms、`CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`electron_start`、loopback allowed、外連 socket `EPERM`、预裝模型存在且無下載。
- E11:39–85 的 `homeDashboardLoaded=false`、job/cues/suggestions/accept 為 0、undo/redo/save 為 false，與 E11:94–100 的 `SIGTRAP`／Chromium child-sandbox diagnostic 一致；沒有成功 UI 操作、字幕保存或 UI 品質證據。E11:87–115 記錄 Electron group 清理前存在、最終 absent/confirmed、沒有 forced cleanup，以及 driver/daemon/port/userData/temp cleanup 成功。E11:32、118 的 `systemNetworkDisabled=false` 明確不是全機断網。
- E12:3–5、10–24、28–55 是 2026-09-30T08:28:18.910Z–08:28:18.924Z 的新 v3 負向 preflight，不能當作 v3 正常 bundle 啟動／UI 重播；當次 UI 為 null。E10/E11 缺少 OS/build/input-kind 的歷史缺口仍存在，其 macOS 26.6.2／bundle 呼叫形狀只由 `06-TEST-AND-PROCESS-AUDIT.md:20–22` 與工作紀錄文字支持。本輪 OS 讀值相同也不能倒推為 E11 當次 raw observation。
- 本輪建立報告前讀取的 SHA-256 基準與 2026-10-01T01:58:33.957Z 的結束比對一致：E10 `be44e285ef505a1b90ecd5f5fe5a5570dd7c20a02b27bbfe949350e8d45a94c3`；E11 `99eea0f85f9d6bc300b8802f6dae7110c75c1635dc9546d3eedcaf79551fa3f7`；E12 `fb6b58df33dc2e69e16824026f7f6337bc1542a799f8803c500c3f43d667dbff`；R1 `766ca5a32fea17297dda0bee57da5891271da7f4aafd7acdec2d4180cc8239a3`。這證明本輪未改動上述原件；未取得 round1 前的 byte/hash 基準，不能聲稱獨立證明其全部歷史從未被改寫。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪 round2 獨立審查結論為有條件通過：executable-path 負向 CLI、去敏 macOS version/build 與 v3 input-kind evidence 已核驗，尚須主要代理整合報告並通過文件 final gate；合法 .app/ 輸入分類為 other 的非阻擋問題保留，packaged UI acceptance 仍失敗，FR-021 整體未結案。**
- 阻擋問題（若有）：沒有新增核心程式阻擋；工作項目結案仍須主要代理整合本報告、逐字引用上句、同步最新工作條目的狀態／驗證／遺留風險，並執行 `npm run docs:check:final` 通過。此條件依 `workflows/07-DOCUMENT-CLOSEOUT.md:9–13` 與本輪需求方分工，不由審查代理代做；目前不能宣稱已完成 final gate。
- 剩餘風險：P3-01 的合法 trailing-slash bundle 輸入分類不精確；負向 integration 的 source prerequisites gate 與真實 daemon 案綁定，無 Ollama/model 時會跳過；E10/E11 v2 的 OS/build/input-kind 缺口保留；本輪未跑真實 daemon ENOENT integration、全套回歸或 UI；已有 replay 顯示外層 Seatbelt 下 Chromium child sandbox 初始化失敗。全機斷網、UI 取消／checkpoint 續跑、模型品質、Windows／乾淨安裝與 FR-021 整體验收不在本輪完成範圍；LM Studio 保持原有範圍例外。
- 給主要開發代理的具體修正要求（若有）：完成上列文件結案條件；保留 E10/E11/E12 與 R1 原件，不回填歷史 OS 或輸入種類。P3-01 可追蹤為後續低風險修補，統一 classifier 與 inspectBundle 的路徑正規化並補 `.app/` 測試；若本工作選擇即時修正，重跑受影響 focused 邊界測試並視結論影響複審。可另拆負向 preflight 的 prerequisites gate。不得把此報告或新 v3 preflight evidence 稱為 packaged UI acceptance 通過。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 唯一持久寫入為本 round2 報告；需求方允許的必要測試暫存 evidence 已清理。沒有改寫程式、測試、治理來源文件、舊 evidence 或舊報告。
- 若上述聲明不實，本報告無效。
