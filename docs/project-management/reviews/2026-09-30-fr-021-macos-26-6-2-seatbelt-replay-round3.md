# 獨立審查報告：FR-021 packaged Electron UI macOS 26.6.2 Seatbelt 可行性重播

- 審查對象 commit／版本：HEAD `299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`，branch `codex/0.51-anthropic-claude`，版本 0.51.0；本輪審查指定 dirty worktree 修補。既有 packaged candidate 來源 `53956ccdee6e16e4c0413f09312a419613b27da6`，不代表目前工作樹的 build。
- 對應 08-CHANGE-LOG 條目：2026-09-30 — FR-021 packaged Electron UI macOS 26.6.2 Seatbelt 可行性重播（`docs/project-management/08-CHANGE-LOG.md:3–31`）。
- 審查輪次：round3。
- 審查代理啟動時間、上下文來源：2026-10-01 10:04:53 +0800 為本輪首次保存的查證時間。依需求方要求延續同一獨立審查角色及審查 session，不宣稱另啟新的 fresh context；沿用的是本人 round2 審查記錄，沒有沿用主要開發代理對話記憶。本輪判斷以重新讀取程式、文件及自行執行結果為準。
- 計畫／執行範圍：重新確認 AGENTS 及 debug preflight，核對 classifier、測試 gate 與文件同步，執行無真實 Ollama 的 focused test／syntax／whitespace，核對舊原件 hash，最後只新建本報告。`npm run project:preflight -- --type=debug` exit 0；路由規範承接本獨立 session 已讀內容，本輪重讀 README、相關核心／audit／最新工作條目及結案分工。未執行全套 suite、packaged app、真實 Ollama 或系統網路變更。
- 證據代號：E10、E11、E12 分別為 `docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay10.json`、`docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay11.json`、`docs/project-management/evidence/2026-09-30-ollama-llama3.2-3b-ui-offline-replay12.json`。R1、R2 分別為 `docs/project-management/reviews/2026-09-30-fr-021-macos-26-6-2-seatbelt-replay-round1.md`、`docs/project-management/reviews/2026-09-30-fr-021-macos-26-6-2-seatbelt-replay-round2.md`；下文代號後數字為原檔行號。

## 1. 需求完整性

- 判定：通過（限本次可行性重播與 runner 修補）。
- 證據：R2:32 指出的 P3-01 是合法 `.app/` 分類為 `other`；R2:41、66 建議拆開負向 preflight 與 Ollama/model gate。現 `scripts/verify-electron-ollama-ui-offline.mjs:82–87` 使用 `path.resolve` 且 regex 同樣檢查正規化後路徑；`scripts/test-ollama-ui-offline.mjs:141–199` 的三案 integration 只依賴 macOS arm64、Seatbelt executable 存在及 candidate。Ollama/model 探測與 daemon integration 在另一區塊（`:201–255`）。兩项修補均符合需求。
- `docs/project-management/00-CURRENT-STATUS.md:34–36`、`06-TEST-AND-PROCESS-AUDIT.md:23、27–28`、`08-CHANGE-LOG.md:26–30` 已同步修補、測試限制及 FR-021 未完成；最新工作條目第 5–6、28 行保留進行中等待本報告及 final gate，與實況一致。本工作不發布（第 31 行），不涉及發布授權。
- Round1 的去敏 OS/version/build 與 input-kind evidence 修補保持：runner `:90–103` 僅接受格式白名單；E12:2、10–14、23–24 是獨立 v3 preflight evidence，E10/E11 仍維持 v2，未回填歷史欄位。

## 2. 邏輯正確性

- 判定：通過。
- 證據：classifier 的 `path.resolve`（runner `:84`）與 main 傳入 `inspectBundle(path.resolve(bundlePathArgument))`（`:418–419`）一致，消除 `.app/` 尾端 separator 在分類與驗證之間的差異；executable regex 亦使用 normalized 路徑（`:86`）。分類只表示輸入形狀，實體 bundle 的 realpath／目錄／metadata 檢查仍在 `inspectBundle`（`:150–167`），沒有把 enum 當成 bundle 合法性的替代驗證。
- 三案測試各自建立 evidence path，直接 spawn 原始 wrapper（test `:155–175`）。Executable 預期 `APP_BUNDLE_INVALID`／`app_bundle_preflight`；正常 `.app` 與 `.app/` 都預期 `app_bundle_directory`，通過 bundle preflight 後在刻意不存在的 binary 回 `OLLAMA_EXECUTABLE_NOT_ACCESSIBLE`／`ollama_binary_preflight`。Runner `:425–428` 的 binary 存在性拒絕早於 profile probe（`:433–434`）、daemon spawn（`:447–452`）及 UI driver（`:461–463`）。
- Child env 提供 testRoot 內確定不存在的 Ollama binary 及兩個 spawn-command seams（test `:147–149、164–170`），不用父環境中的真實 binary。測試斷言 `ui=null`、loopback/external probe false、daemon/Electron started false、driver/daemon cleanup-start false（`:182–188`）。本輪 focused execution 通過上述 assertions，未到真實 daemon 或 UI 啟動路徑。

## 3. 邊界情況

- 判定：通過（指定三案與既有 focused 邊界）。
- 證據：2026-10-01 10:05:22 +0800 執行 `OLLAMA_BIN=/nonexistent-round3-preflight node scripts/test-ollama-ui-offline.mjs`，exit 0，明確輸出三案 bundle preflight integration passed。test `:155–158、173–190` 實際核對：
  - executable 誤作 bundle：exit 1、`APP_BUNDLE_INVALID`、`app_bundle_preflight`、`app_executable_path`。
  - 正常 `.app`：exit 1、`OLLAMA_EXECUTABLE_NOT_ACCESSIBLE`、`ollama_binary_preflight`、`app_bundle_directory`。
  - `.app/`：與正常 `.app` 相同，分類不再為 `other`。R2 的 P3-01 已解除。
- 每案驗證 v3、macOS product/build 格式、UI/probe/daemon/Electron 未啟動及三種 private path（原輸入、resolved 輸入、testRoot）不在 JSON（test `:176–190`）；finally 回收本區塊臨時 evidence（`:194–195`），整體 exit 0 表示回收未拋錯。這些是未建立運行資源的 preflight defaults，不應稱為已啟動 app 的 cleanup 驗收。
- 同一 focused test 執行既有不可信 DevTools target/no-constructor 邊界（`:64–88`）與 POSIX cleanup 的 graceful、forced、unconfirmed、invalid-ID 案例（`:90–138`）。真實 daemon ENOENT integration 明確 SKIP，沒有誤列為已覆蓋。

## 4. 程式碼品質

- 判定：通過。
- 證據：runner `:82–87` 的修補規模小、使用同一 canonical path 邏輯，不新增原始路徑 evidence 欄位或放寬 bundle／network contract。OS 去敏讀取仍具固定命令、timeout、buffer 及格式驗證（`:90–103`）；evidence exclusive create 保留（`:519–524`）。
- test `:155–192` 以 table-driven 三案共享 assertions，案例差異限於 input/kind/code/stage；獨立 gate 與獨立 PASS/SKIP 訊息（`:193–198、211、255`）讓 preflight 與 daemon coverage 可區分。每案 child env 明確限制 binary/seams，且 evidence 專屬於本區塊自建 temporary root，由 finally 清理。
- 所有本輪必要 syntax／whitespace checks exit 0（第 5 節），未發現新的程式阻擋或需修正問題。Gate 仍要求現有 macOS arm64 candidate，這是實機 preflight 的可攜性限制，已在治理文件披露（`08-CHANGE-LOG.md:30`）。

## 5. 測試覆蓋

- 判定：通過（限定 focused 驗證）。
- 證據：2026-10-01 10:05:22 +0800，`OLLAMA_BIN=/nonexistent-round3-preflight node scripts/test-ollama-ui-offline.mjs` exit 0，輸出依序為：`Ollama offline UI bundle preflight integration test passed (3 cases; no Ollama/model required)`、`Ollama offline UI spawn-error integration test skipped: packaged macOS candidate, Seatbelt, Ollama, or preinstalled 3B model unavailable`、`Ollama offline packaged UI contract test passed`。
- 上述結果獨立證明三案在無可用 Ollama binary 時仍執行，R2 的 gate 綁定限制已解除；test `:201–208` 對 nonexistent binary 的 `list` spawn 不會執行真實 Ollama，`installedModelAvailable=false` 導致 daemon gate 不進入。Source contracts（`:18–62`）、DevTools 及 process-group focused tests 均完成。本轮未聲稱 daemon ENOENT integration 成功。
- 同次 10:05:22 +0800 分別執行 `node --check scripts/verify-electron-ollama-ui-offline.mjs`、`node --check scripts/test-ollama-ui-offline.mjs`、`node --check scripts/verify-electron-ollama-ui.mjs`、`git diff --check`，各自 exit 0 且無錯誤輸出。Whitespace check 涵蓋 tracked diff，不表示審查其他 dirty 修改，也不涵蓋尚未 tracked 的報告。
- 開發驗證與本審查分開：需求方及 `08-CHANGE-LOG.md:29`／`06-TEST-AND-PROCESS-AUDIT.md:27` 記載正常環境完整 `npm run check` 通過，包含三案及 daemon ENOENT integration；這是主要代理保存的結果，本輪未重跑完整 suite、`docs:check`、codesign 或真實 daemon。`docs:check:final` 依指定分工留給主要代理整合本報告後執行，不以本輪 focused 或報告格式檢查替代。
- 2026-10-01T02:08:22.396Z，以 `node --input-type=module` 只讀呼叫 `validateReviewReport` 檢查本報告，`errors=[]`、完整可引用結論句長度 220，exit 0；同次 `git diff --check` 無錯誤。本項只是 focused 報告格式檢查，並非文件 final gate。

## 6. 實際運行結果

- 判定：通過（修補及可行性結果可回溯）；packaged UI acceptance 仍未通過。
- 證據：本輪實際執行的是 focused source/child-process tests 與原始 wrapper 的三案 preflight，沒有啟動 packaged app、Seatbelt network probe 或真實 Ollama。實際 UI 運行證據限於已保存 replay：E11:3–5、19–37 保存 2026-09-30T07:59:53.349Z–08:00:00.166Z、6817 ms 的 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED`／`electron_start`，loopback allowed、外連 `EPERM`、預裝模型及無下載；E11:39–85 的 dashboard/UI/job/optimize/accept/history/save 未完成，E11:94–100 記錄 `SIGTRAP` 與 Chromium sandbox diagnostics。
- E11:87–115 記錄 Electron group 曾存在、最終 absent/confirmed、沒有 forced cleanup，以及 driver/daemon/port/userData/temp cleanup。這是舊 replay 的記錄，本輪未重新觀察那些 app 清理。E11:32、118 的 `systemNetworkDisabled=false` 不代表全機斷網。E10:19–39 和 E12:23–42 都是 preflight 拒絕／UI 未啟動；E12 的 v3 metadata 不是一次 v3 正常 bundle UI 重播，也不能回填為 E11 當次 OS 觀察。
- 本輪建立報告前的 SHA-256 核對：E10 `be44e285ef505a1b90ecd5f5fe5a5570dd7c20a02b27bbfe949350e8d45a94c3`；E11 `99eea0f85f9d6bc300b8802f6dae7110c75c1635dc9546d3eedcaf79551fa3f7`；E12 `fb6b58df33dc2e69e16824026f7f6337bc1542a799f8803c500c3f43d667dbff`；R1 `766ca5a32fea17297dda0bee57da5891271da7f4aafd7acdec2d4180cc8239a3`，均與 R2:58 保存的本審查基準一致。R2 原件完整結論與 P3-01 保留（R2:32、63–66），本輪開始的 hash 为 `95820f09b2f8e4f27b07d09ea8fb1a779f57cb604e6b61d1876ebe471a041e22`；作為本輪前後一致性基準，未另宣稱具備 round2 建立前的歷史 hash。
- 2026-10-01T02:08:22.396Z 的只讀結束比對確認上述 E10/E11/E12/R1/R2 五個 hash 全部與本輪開始基準一致，沒有改寫舊原件。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪 round3 獨立審查結論為有條件通過：合法 .app/ 輸入分類及負向 preflight 與 Ollama/model gate 綁定問題已修正，三案無 daemon focused integration、語法與 whitespace 檢查通過；主要代理尚須整合本報告並通過文件 final gate，本工作僅結案可行性重播與 runner 修補，packaged UI acceptance 仍失敗，FR-021 整體未結案。**
- 阻擋問題（若有）：沒有新增程式阻擋；R2 P3-01 與 gate 綁定問題已解除。剩餘工作結案條件是主要代理以本報告原句整合最新工作紀錄、更新審查輪次／狀態／遺留風險，完成 `npm run docs:check:final` 並保存結果。此分工由需求方明示，且符合 `workflows/07-DOCUMENT-CLOSEOUT.md:9–13`；本報告不宣稱 final gate 已完成。
- 剩餘風險：三案仍需 macOS arm64／Seatbelt executable／既有 candidate；daemon integration 另需真實 Ollama／預裝模型，本輪刻意跳過。E10/E11 v2 缺少 OS/build/input-kind 的歷史缺口保留，不能以 E12 或本輪測試補造歷史。Saved UI replay 仍因 Chromium child sandbox 初始化失敗而未到 renderer。全機實際斷網、UI 取消／checkpoint 續跑、模型品質、乾淨安裝、Windows 實機及 FR-021 整體驗收未完成；LM Studio 保持既定例外。
- 給主要開發代理的具體修正要求（若有）：無新增程式修正要求；履行上述文件結案條件，保留 R1/R2/E10/E11/E12 原件，維持「可行性查核／runner 修補完成」與「UI acceptance／FR-021 未完成」的範圍區分。不要把三案 preflight PASS 或本報告有條件通過當成實際 UI 驗收通過。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪唯一持久寫入為本 round3 報告；focused 測試自行建立的必要臨時 evidence 已由其 finally 回收。未覆寫 round1/round2、旧 evidence、程式、測試或治理來源文件。
- 若上述聲明不實，本報告無效。
