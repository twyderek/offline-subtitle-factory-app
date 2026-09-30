# 獨立審查報告：Breeze runtime 缺件提供可操作安裝指引（BUG-021）

- 審查對象 commit／版本：`codex/021-breeze-runtime-guide` 工作樹（基線 0.49.0；審查時未提交差異）
- 對應 08-CHANGE-LOG 條目：2026-08-13 — Breeze runtime 缺件提供可操作安裝指引（BUG-021）（`docs/project-management/08-CHANGE-LOG.md:5`）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-13T14:06+08:00；由獨立子代理上下文依 debug preflight 啟動，未沿用主要開發代理的評價性結論
- 證據核對時間：2026-08-13T14:06–14:13+08:00

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - BUG-021 的成功條件是 runtime 缺件時提供「可操作安裝指引」，涵蓋官方文件／模型連結、macOS／Linux 與 Windows PowerShell 指令、複製、重新檢查及切回 Whisper.cpp（`docs/project-management/08-CHANGE-LOG.md:11-19`）。工作樹已有相應固定 guide API、模型下載 modal 入口、ASR 欄位 persistent 入口、runtime modal、雙平台頁籤與上述按鈕（`lib/breeze-asr.mjs:24-59`、`public/index.html:229-232,468-530`、`public/app.js:645-760,819-875`）。
  - 但指令不是可完整執行的流程：官方 MediaTek README 的 Whisper CLI 安裝步驟明確先執行 `git submodule update --init --recursive`，官方 repo 的 `third_party/whisper-patch-breeze` 亦是 gitlink（commit `f94c6ba...`）；目前兩平台只做普通 `git clone`（`lib/breeze-asr.mjs:34,47`），乾淨 clone 不會初始化該 submodule，接著的 `pip install third_party/whisper-patch-breeze` 無套件內容可安裝。
  - setup 指令執行完時工作目錄仍是 `Breeze-ASR-25`（`lib/breeze-asr.mjs:35,48`），但 launch 指令直接在同一目錄執行 `npm start`（`lib/breeze-asr.mjs:41,54`）。官方 Breeze repo 沒有 `package.json`，所以此指令不會啟動離線字幕工廠；「安裝版請把 npm start 替換成該 App 的啟動命令」仍要求使用者自行猜測平台啟動方式，尚未達成回報問題所要求的可操作處理方法。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - API 層邏輯本身一致：`server.mjs:1099-1102,3706-3711` 在 catalog 與 model 都回傳同一份固定 guide；`scripts/test-core.mjs:489-498` 驗證 API 200、官方 repo、平台指令與兩層資料一致。
  - UI 的缺件路徑正確進入 modal：Breeze 模型已存在但 runtime 未就緒時，選單 change 與提交前檢查都會呼叫 `openBreezeRuntimeInstallDialog`，且不建立推論任務（`public/app.js:785-816,838-848`）。重新檢查仍呼叫既有只讀 `/api/breeze-asr?refresh=1`，切回 Whisper.cpp 只變更表單與狀態（`public/app.js:727-747`）。
  - 然而 guide 的核心行為是讓使用者能照做；submodule 未初始化和錯誤工作目錄會分別使「安裝」與「啟動 App」失敗，因此固定字串正確傳到 API／UI 不能補救執行流程錯誤，構成阻擋。
  - `recheckRuntime` 本身只能重探 server 啟動時已解析的 `BREEZE_ASR_PYTHON`（`server.mjs:358`）；UI 已提示需要以同一終端重啟 App，沒有宣稱可在現行 process 內熱套用新環境變數，這一點沒有假成功。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - guide 缺失時安全回落成錯誤狀態；clipboard API 不可用時有 textarea fallback，複製失敗會顯示錯誤；runtime 仍缺失時重新啟用 recheck；使用者可關閉或切回 Whisper.cpp（`public/app.js:24-52,663-747`）。
  - 模型尚未下載時新增「先查看 Breeze runtime 安裝指引」入口；模型已有效但 runtime 缺件時，ASR 欄位另保留 persistent「查看 runtime 安裝指引」按鈕，關閉 modal 後仍可再次開啟。兩入口都有 null guard／Breeze 狀態顯示條件，未改 Whisper 模型下載端點或自動執行 pip（`public/app.js:540-571,641,827-875`）。
  - 尚未覆蓋乾淨 clone 的 submodule 空目錄、repo 目錄已存在、`python3.11`／`py -3.11` 不存在、pip／git／網路失敗、路徑含空白、安裝版啟動命令、同時開啟模型下載與 runtime 兩個 `aria-modal`、以及 Windows PowerShell／macOS shell 真實貼上執行。尤其前兩個實際命令鏈錯誤未被測試捕捉。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - guide 集中在 `breezeRuntimeInstallGuideDetails()`，使用固定非秘密值；UI 以 `textContent` 顯示命令，沒有把 API 字串插入 HTML；listener 在正常關閉時清理，產品不執行指令。結構上避免了 shell injection 與 DOM HTML injection。
  - 外部連結由固定 API 值提供；Electron `open-external` handler 會解析 URL 並限制協定（`electron/main.mjs:732-742`）。本輪沒有新增任意前端 URL、任意下載或自動套件安裝。
  - `openExternalUrl` 的 Electron handler 失敗後會 fallback 至 `window.open`，但 Electron 主視窗的 window-open handler 會拒絕非 app origin，結果是安全失敗而非繞過；正常固定 HTTPS URL 由 IPC 開啟。
  - 安裝命令沒有 pin 官方 repo commit／submodule commit，也沒有向使用者揭露 clone/pip 會下載並執行第三方程式碼；雖然使用者需手動複製執行而非 App 自動執行，仍應在 UI 明示供應鏈風險並至少固定或記錄經驗證 revision。

## 5. 測試覆蓋

- 判定：不通過
- 證據：
  - 2026-08-13T14:09+08:00 獨立執行 `node scripts/test-breeze-asr.mjs` 與 `node scripts/test-core.mjs` 均通過；2026-08-13T14:11+08:00 執行 `npm run check` 完整通過，涵蓋語法、Breeze deterministic 契約、API 與全專案回歸；`git diff --check` 無輸出。
  - 現有新測試只斷言 setupCommand 含 `third_party/whisper-patch-breeze`、launchCommand 含 `BREEZE_ASR_PYTHON`，及 UI source 中存在指定 id（`scripts/test-breeze-asr.mjs:26-34,102-111`）；它沒有驗證 `--recurse-submodules`／`git submodule update --init --recursive`，也沒有驗證 launch command 會切至本專案或使用真正安裝版 executable。
  - `scripts/test-core.mjs:489-498` 只驗證 API 傳輸固定字串，不執行命令。完整回歸通過因此只能證明鄰近功能沒有 deterministic regression，不能證明本缺陷的安裝／啟動驗收條件通過。

## 6. 實際運行結果

- 判定：不通過
- 證據：
  - 本輪沒有真實瀏覽器／Electron 點擊 modal、clipboard、外部連結或 platform tab 的運行證據，也沒有 macOS／Windows 乾淨環境按 UI 指令完成 patched Whisper 安裝、設定 `BREEZE_ASR_PYTHON`、啟動本 App並重新檢查的證據。
  - 2026-08-13T14:08+08:00 以 GitHub API 唯讀核對官方 repo：根目錄只有 `.gitmodules`、`LICENSE`、`README.md`、`run.py`、`third_party`，沒有 `package.json`；`.gitmodules` 指向 `https://github.com/Splend1d/whisper-patch-breeze.git`，git tree 顯示 `third_party/whisper-patch-breeze` mode `160000`。這直接證明目前普通 clone + repo 內 `npm start` 不能構成成功路徑。
  - 未下載真實約 3 GB checkpoint，也未安裝官方／patched runtime 或跑真實音訊；本報告不把 focused test、API 200 或 UI source marker 宣稱成真實 Breeze runtime／模型品質驗收。

## 安全／隱私核對

- 判定：部分通過
- 證據：guide 是固定資料，不讀取／回傳 API key、token、password 或 secret；既有 probe 仍使用摘要與本機路徑遮罩。`scripts/test-breeze-asr.mjs:34` 也拒絕 guide 出現秘密欄位名稱。
- App 不會自動執行 clone、pip 或 launch command，下載／執行第三方程式碼需要使用者明確在外部終端貼上，降低了遠端命令執行面。
- 剩餘供應鏈風險是官方 repo 與 submodule 都追蹤未固定的遠端預設分支；修正可操作性時應避免把「能執行」誤寫為「第三方來源已安全驗證」。

## 文件與交付風險

- 判定：不通過（尚未結案）
- 證據：最新 BUG-021 工作紀錄仍為「進行中」，實際修改、開發驗證、獨立審查與部署結果均為待執行（`docs/project-management/08-CHANGE-LOG.md:7-25`）；這符合當前審查進度，但目前不可宣稱結案。
- debug 責任矩陣要求 API/UI 設計同步 `03-FUNCTIONAL-DESIGN.md`、測試同步 `06-TEST-AND-PROCESS-AUDIT.md`、缺陷根因／修正同步 `07-DEBUG-AND-FIX-HISTORY.md`。目前工作差異未包含這三份文件；主要代理須在修正阻擋後補齊事實與剩餘風險，再執行 final docs gate。
- 本輪變更等級為中且沒有 tag／Release／外部測試資產，發布授權不適用；不得修改或宣稱已替換公開 v0.49.0。

## 綜合判定

- 結論：不通過
- 阻擋問題（若有）：
  1. `lib/breeze-asr.mjs:34,47` 的普通 `git clone` 未初始化官方 `third_party/whisper-patch-breeze` submodule，後續 `pip install` 在乾淨 clone 無法依官方契約完成。須改成可重現的 recursive clone 或顯式 `git submodule update --init --recursive`，並新增會檢查此必要步驟的測試。
  2. `lib/breeze-asr.mjs:41,54` 在 Breeze 官方 repo 目錄執行 `npm start`，但該 repo 沒有 `package.json`，所以無法啟動離線字幕工廠。須提供真正可操作且不歧義的開發版與 macOS／Windows 安裝版啟動方法，正確保存 venv Python 絕對路徑並切至本專案／啟動 App，再由測試驗證命令內容。
- 剩餘風險：真實 Breeze checkpoint、patched runtime、音訊品質、CPU／CUDA 效能、長音訊、取消／process tree、Windows PowerShell、macOS shell、雙平台乾淨安裝、第三方 clone/pip 供應鏈與下載失敗均未驗收；UI modal／clipboard／外部連結也尚缺實際 renderer 操作證據。
- 給主要開發代理的具體修正要求（若有）：修正上述兩條命令鏈並補 focused negative assertions；在至少一個隔離暫存 clone（可不安裝大型依賴）驗證 submodule 路徑確實存在，對開發版 launch command 做不執行 App 的 cwd／package.json 前置驗證；同步 BUG-021 設計、測試稽核、偵錯紀錄與工作紀錄。修正影響核心判定，須建立 round2 報告複審，不得覆寫本報告。
- 可逐字引用完整結論句：**「BUG-021 round1 獨立審查不通過：缺件 modal、固定 guide API、複製／重查與切回 Whisper.cpp 的程式邊界基本成立，但目前安裝指令未初始化 MediaTek 官方 patched Whisper submodule，且啟動指令在沒有 `package.json` 的 Breeze repo 執行 `npm start`，無法形成可操作的 runtime 安裝與 App 啟動流程；修正命令鏈、補強測試與治理文件後必須進行 round2 複審，本結論亦不代表真實 Breeze runtime、模型品質、效能或跨平台實機已驗收。」**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
