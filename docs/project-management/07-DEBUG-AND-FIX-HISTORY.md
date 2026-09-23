# 偵錯與修改歷程

### BUG-032：Windows CRLF 造成 Breeze 效能提示契約測試誤判（2026-09-23）

- 現象：GitHub Windows preview 的 `npm run check` 在 `scripts/test-breeze-asr.mjs:176` 失敗，錯誤為「應存在可測試的 Breeze 效能提示更新函式」；同一來源在 macOS LF checkout 可找到 `updateBreezePerformanceNotice` 並通過。
- 重現基準：`public/app.js` 的函式本身存在；現行 regex 結尾要求 `}\n\nfunction updateAsrEngineUi`。將相同 source 轉為 CRLF 後，`}\r\n\r\nfunction` 無法符合該 regex，造成 `noticeFunction` 為 `undefined`。這是測試讀取格式問題，不是產品函式缺失。
- 根因：source-contract test 直接以 LF-only regex 解析 checkout 的 `public/app.js`；Windows Git checkout 的 CRLF 行尾使函式邊界比對失敗。
- 最小修正：`scripts/test-breeze-asr.mjs` 讀取 `public/app.js` 後先將 CRLF 正規化為 LF，再執行既有函式擷取與 UI 行為 assertions；另以 LF→CRLF→LF fixture assertion 固定跨平台等價性。不改 `public/app.js`、產品 runtime 或 Breeze 行為。
- 開發驗證：現行 regex 的 CRLF 重放明確由 `lfMatch=true` 變為 `crlfMatch=false`；修正後 `node scripts/test-breeze-asr.mjs`、完整 `npm run check` 與 `git diff --check` 均通過。Windows preview run `35804611051` 於修正 commit `e8ccee8` 成功完成 source／FFmpeg regression、preview package、renderer／install lifecycle、archive／SHA-256 與 artifact upload。
- 防回歸：保留 CRLF fixture 重放，並以共用 `extractNoticeFunction` 直接驗證正規化後 CRLF source 可擷取 Breeze 函式；Breeze focused test、完整回歸與 Windows runner 均通過。Windows runner 成功不等同 Windows 實機驗收。
- 剩餘風險：本輪不執行 Windows 實機驗收、不驗證 Breeze 真實 runtime／模型品質；修正只涵蓋 source-contract 測試的換行可攜性。

### FR-020／NFR-006：bundled Whisper 長音訊來源 SRT hash 完整性補強（2026-09-21）

- 缺口：長音訊 evidence 原先以 `originalSrtModified=false` 宣告來源 SRT 未修改，但沒有保存 before／after hash，無法提供完整的檔案完整性比對。
- 最小修正：`verify-whisper-long-media.mjs` 接受明確來源 SRT 路徑，未提供時只在相鄰 `.edited.srt` 存在時採用；schema 升為 v3，保存來源 SRT basename／大小／before／after SHA-256 與檢查旗標，hash 不一致或檔案消失時回報 `SOURCE_SRT_MODIFIED`。
- 實測：短音訊與完整 `/Users/nycu/Downloads/20260909.mp4` replay 均 exit 0；完整 evidence 記錄來源 SRT before／after 均為 `4d5f5a53bb4eea7f5de5b428caefb38871771655166b12fccc613f3600f16482`、`sourceSrtHashChecked=true`、`originalSrtModified=false`，2,509 segments、非空 SRT／JSON、temp cleanup 通過。
- 剩餘風險：hash 完整性不代表字幕語意品質或 Whisper 與來源 SRT 的正確性；中文音訊品質、人工校閱、confidence／no-speech、真實 Metal crash→CPU fallback、Windows、乾淨安裝與發布仍未驗收。

### FR-020／BUG-WHISPER-METAL-139：bundled Whisper 長音訊 probe 摘要與隱私修正（2026-09-21）

- 現象：首版長音訊 probe 將 bundled Whisper JSON 假設為 `segments` 陣列，實際輸出使用 `transcription`，導致完整成功 replay 被誤判為沒有 segment；同版 evidence 也保存了 stdout 最後一段字幕文字，超出「只保存非敏感摘要」的設計範圍。
- 根因：probe 摘要器未兼容 bundled Whisper.cpp 的 JSON 形狀，且把為診斷保留的 stdout tail 原樣寫入 evidence。
- 最小修正：摘要器同時支援 `segments`／`transcription`，以 offsets／tokens 計算 segment、文字 code point、時間範圍與 token probability 統計；evidence schema 升為 v2，stdout 改保存 line count、timestamped transcript line count 與 `contentStored=false`，不保存字幕文字。
- 重播與驗證：`2026-09-21-whisper-long-media-small-redacted.json` 在 macOS arm64 受控權限完整跑完 5,416.349667 秒影片，exit 0、2,509 segments、非空 SRT／JSON、temp cleanup 通過；原 v1 含字幕尾端的中間 evidence 已移除。Node syntax、14 項 evidence assertions、完整 `npm run check`、`git diff --check`、獨立 round1 審查與 `npm run docs:check:final` 均完成。
- 剩餘風險：這是 runtime／輸出完整性基線，不代表中文品質、人工影音校閱、長音訊效能、confidence／no-speech metadata、真實 Metal crash→CPU fallback、Windows、乾淨安裝或發布驗收；LM Studio 依需求方決策未執行。

### BUG-WHISPER-METAL-139：production probe 啟動失敗診斷可觀測性（2026-09-21）

- 症狀：前輪預設 sandbox 的 bundled production server 在 ready 前 exit 0，原 probe 因 `stdio: ignore` 只留下 exit code，無法從 evidence 判斷 loopback 權限或其他啟動原因。
- 根因／範圍：問題位於 acceptance probe 的子程序輸出收集，不是產品 server fallback；本輪不修改 `server.mjs`、fallback policy、bundled runtime／模型。
- 最小修正：`verify-whisper-real-fallback.mjs` 改收集 child stdout／stderr，保存 PID、ready phase、exit code／signal 與固定長度遮罩尾端；API key／token／secret／Authorization／Bearer／Basic 與使用者／暫存路徑均先遮罩，schema 升為 v2。
- 重播結果：round2 預設 sandbox evidence `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-round2-default.json` 明確記錄 `listen EPERM`、ready=false、job 未建立；受控本機權限 evidence `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-round2-escalated.json` 仍完成 `ready-review`、Metal、無 fallback，且 token／credential／`/tmp/` leakage assertions 通過。round1 evidence 保留作為修正前對照。
- 防回歸／剩餘風險：Node syntax、兩側 replay、evidence assertions 與完整回歸需持續通過；診斷摘要仍不是完整 log，也不會產生真實 bundled Metal crash→CPU fallback 證據。中文品質、長音訊、Windows、乾淨安裝與發布仍未驗收；LM Studio 依需求方決策未執行。

### BUG-WHISPER-METAL-139：bundled production server Metal failure 邊界重播（2026-09-21）

- 現象：需確認前輪受控 wrapper→bundled CPU 取消之外，真實 bundled `whisper-cli` 在同一次 production server 中是否能重現 Metal failure 並自動 fallback。
- 重播條件：同一 macOS arm64 bundled `whisper-cli`／Tiny、同一 1 秒 16 kHz mono 合成 WAV、同一 `scripts/verify-whisper-real-fallback.mjs`；分別以預設 sandbox 與受控本機權限啟動 production server。
- 結果：預設 sandbox server 在 ready 前 exit 0，未建立 job，證據為 `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-default.json`；受控本機權限完成 `ready-review`、`whisperDevice=metal`、`fallbackObserved=false`，證據為 `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-escalated.json`。
- 根因／邊界判定：本次只能確認預設執行環境的 server loopback 啟動邊界與受控權限下 bundled Metal 正常路徑，沒有觀察到真實 bundled Metal exit／signal，因此不能宣稱 crash→CPU fallback；不修改產品程式。
- 剩餘風險：仍需在能穩定重現 bundled Metal crash 的同一 production server 環境取得 CPU fallback evidence；長音訊、中文品質、Windows、乾淨安裝與發布仍未驗收。LM Studio 依需求方決策未執行。

### BUG-WHISPER-METAL-139／BUG-026：production-mode bundled CPU retry 取消補驗

- 日期／版本：2026-09-18／0.51.0 開發中。
- 待驗缺口：deterministic child 已覆蓋 retry 期間取消，上一輪 hybrid 則只驗證真實 bundled CPU 正常完成；尚缺真實 CPU child 已啟動後經產品 API 取消與清理的證據。
- 探針設計：新增 `--cancel-bundled-cpu` 模式，使用 60 秒本機合成 WAV；CPU wrapper 在真實 child spawn 後寫 ready marker，API 取消時轉送 SIGTERM 並記錄 child close／forcedKill。probe 明確注入固定 partial SRT／JSON、quality metadata 與 edit plan 哨兵，以精確檔案不存在／保留斷言驗證清理；未修改 `server.mjs` 或 bundled CLI。
- round1 審查發現：正常取消雖通過，但取消 API 不可用時 probe 只停 server 並刪 temp，未確認 wrapper／CPU child close；這是驗收工具的失敗收尾缺陷，不是已觀察到的產品取消失敗。修正為獨立 process group 有界終止／確認消失後才清 temp；`kill(-pgid, 0)` 受權限邊界回 EPERM 時，以 `/bin/ps` 只讀核對該 PGID，無法確認則保留診斷 temp 並回報 failure。故障注入 `--simulate-cancel-api-loss` 在 CPU spawn 後跳過 API，記錄 `expectedFaultSafelyHandled`。
- 實測與防回歸：正常取消在最新 probe 下仍 `cancelled`，取消中先維持 `running/cancelling`，CPU child `signal=SIGTERM` 且無 forced kill，invocation 僅 `metal`／`cpu`，ASR 哨兵與暫存 WAV 清理、edit plan 保留；新 evidence 為 `docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-final.json`。API loss 注入預期 exit 1，但 wrapper／CPU close、groupGone 與 tempRootRemoved 均為 true，evidence 為 `docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-api-loss-final.json`。前輪 hybrid 完成與舊 controlled probe 在收尾改動後仍通過。
- 剩餘風險：Metal failure 仍由 wrapper 注入，partial 哨兵非真實 CLI 輸出，server 透過 wrapper 而非直接向 CLI 發訊號；真實 bundled Metal crash、長音訊品質／效能、中文語音、Windows、乾淨安裝與發布未驗收。round2 獨立複審通過；LM Studio 依需求方決策未執行。

### BUG-WHISPER-METAL-139：production-mode 受控 Metal failure 後 bundled CPU retry 補驗

- 日期／版本：2026-09-18／0.51.0 開發中。
- 待驗缺口：既有同次 production server fallback 由 deterministic fixture 提供 CPU 輸出；另一 bundled server probe 只觀察到 Metal 正常完成，尚未驗證控制流交給真實 bundled CPU 時是否完成。
- 最小探針：在既有隔離 production acceptance 增加 `--bundled-cpu` 模式；wrapper 只注入首次 Metal exit 139／partial outputs，CPU 分支記錄 invocation、檢查 stale partial、直接 spawn 固定 bundled binary 並記錄其退出結果。沒有修改產品 `server.mjs` 或 bundled CLI。
- 實測：macOS arm64 受控權限 hybrid probe exit 0；同次任務 `metal`／`cpu` 兩次 invocation、CPU binary exit 0、`completed/ready-review`、`whisperDevice=cpu`、draft／SRT／JSON 齊全且無暫存 WAV／stale partial。round1 審查指出原始 evidence 缺少工作紀錄要求的重播命令；保留原檔後重新產生 `docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback-replay.json`，包含 command、working directory 與環境前提。舊 controlled probe 與完整 `npm run check` 亦通過。
- 剩餘風險：首次 failure 並非 bundled Metal 真實崩潰，故同次真實 crash→CPU 門檻仍未完成；短靜音不驗證中文品質、長音訊、取消真實 CPU child、Windows、乾淨安裝或發布。LM Studio 依需求方決策未執行。

## 紀錄格式

每個缺陷記錄：`BUG-ID`、日期／版本、現象、影響、重現、根因、修正、驗證、防回歸、剩餘風險。

## 重要既有缺陷

### BUG-WHISPER-METAL-139：CPU fallback 再失敗殘留 partial outputs

- 日期／版本：2026-09-18／0.51.0 開發中。
- 現象／影響：macOS arm64 首次 Metal failure 進入 `--no-gpu` CPU retry 後，若 CPU child 也非零退出且曾寫入 partial SRT／JSON，任務會正確標記 failed，但固定輸出仍留在 working 目錄；後續診斷或重跑可能誤把失敗產物視為可用輸出。
- 修正前重現：deterministic fixture 依序執行 Metal exit 139、CPU exit 7，兩次都寫入 partial outputs；核心測試確認只有兩次 invocation 且任務已 failed，但 `whisper-cpp-output.srt` 實際仍存在，於清理斷言 exit 1。
- 根因：`runWhisperCpp` 的 Metal→CPU fallback 與取消分支會清理固定輸出，不再 retry 的 process failure 分支直接 reject，沒有套用相同清理契約。
- 修正：fallback 前與終止性 process failure 前共用 `removeWhisperPartialOutputs(workingDir, [outputBase])`；CPU retry 仍只執行一次，失敗 reason 原樣傳至 job message／log，清理只限固定 SRT／JSON 與 quality metadata。
- 驗證／防回歸：核心 child fixture 斷言 final status／stage 為 failed、metrics 為 CPU、message 含 exit 7、Metal fallback marker 保留、invocation 僅 `metal`／`cpu`，且 stale marker、partial SRT／JSON、draft 均不存在；focused core 與完整 `npm run check` 通過。證據為 `docs/project-management/evidence/2026-09-18-whisper-cpu-retry-failure.json`。
- 剩餘風險：尚未以真實 bundled runtime 重現 Metal crash 後 CPU 也失敗；取消與 retry 交界、長音訊、中文品質、其他 macOS 架構、Windows、乾淨安裝與發布仍未驗收。LM Studio 依需求方決策未執行。

### BUG-WHISPER-METAL-139／BUG-026：Metal→CPU retry 取消交界補驗

- 日期／版本：2026-09-18／0.51.0 開發中。
- 待驗風險：既有 BUG-026 已驗證一般 Whisper.cpp child 取消，Metal→CPU retry 後仍缺少 child 已執行時的取消整合證據；可能出現提早標記 cancelled、漏清 partial 輸出或取消後再啟動 child。
- 基準重播：fixture 首次 Metal exit 139，第二次 CPU child 寫 partial SRT／JSON 並安裝 SIGTERM handler 後寫 ready marker；測試等 marker 才透過 API 取消。現有產品程式三次核心重播均通過，未重現上述缺陷，故未修改 `server.mjs`。
- 驗證／防回歸：`scripts/test-core.mjs` 斷言 `running/cancelling`→child close→`cancelled`，精確兩次 invocation、CPU metrics、Metal fallback marker、SIGTERM／close marker、暫存音訊／partial／quality metadata 清理、無 draft 與非 ASR `edit-plan.json` 保留；完整 `npm run check` 通過。證據：`docs/project-management/evidence/2026-09-18-whisper-retry-cancellation.json`。
- 剩餘風險：本輪只補 deterministic CPU child 就緒後取消；真實 bundled runtime、Metal close callback 內不可插入窗口、Windows taskkill、長音訊、中文品質、乾淨安裝與發布未驗收。LM Studio 依需求方決策未執行。

### BUG-031：歷史 AI profile 秘密仍殘留一般設定檔

- 日期／版本：2026-09-16／0.51.0 開發中。
- 現象：BUG-029 已讓新保存路徑以 allowlist 排除 profile 秘密，但啟動載入只在 runtime 正規化；若既有 `settings.json` 已含 AI 根層 `apiKey`／Authorization／token／secret 或 profile 內秘密／未知 provider，磁碟明文不會被清除。
- 影響：API 與 runtime 雖不回傳這些欄位，歷史秘密仍可能留在一般設定檔、備份或支援診斷資料中，違反 NFR-002 的秘密隔離邊界。
- 重現：核心啟動 fixture 預置 AI 根層與 Anthropic profile 秘密；修正前在受控權限執行 `node scripts/test-core.mjs`，於「啟動遷移必須從一般設定檔移除 AI 根層歷史秘密」斷言失敗，實際磁碟字串仍存在。
- 根因：`loadSettings()` 只回傳 `normalizeSettings()` 結果，沒有把已正規化的 profile 或根層秘密清理結果持久化回原設定檔。
- 修正：啟動時建立窄範圍持久化遷移，刪除 AI 根層固定 secret-shaped 鍵名，以既有 profile allowlist 取代歷史 profiles 並移除未知 provider；只在內容改變時以同目錄 sanitized 暫存檔原子置換。非敏感未知 AI 根層欄位、合法 profile 與獨立 `ai-secrets.json` 保留，歷史明文不自動匯入 secrets；寫入失敗只記錄不含秘密內容的權限警告，runtime 仍採正規化值。
- 驗證：核心 fixture 驗證根層多種大小寫／分隔形式秘密、profile 秘密與未知 provider 從磁碟消失，合法 Base URL／model／batch／timeout、非敏感未知根層欄位及既有獨立 secrets 保留，且無 migration temp 殘留；Node 語法、核心整合、provider contract、差異格式與完整 `npm run check` 均通過。round1 因未完成獨立讀取而有條件通過，新的 round2 獨立上下文完成六面向靜態核對後判定通過，無阻擋問題。
- 防回歸：啟動 fixture 直接讀回遷移後 `settings.json` 與 `ai-secrets.json`，不只檢查 API 回應；後續新增合法 profile 欄位時必須同步 allowlist、遷移與測試。
- 剩餘風險：無法寫入一般設定檔時磁碟明文仍會保留，需依不含秘密值的警告修正檔案／目錄權限後重啟；本輪不掃描歷史備份、log、其他使用者目錄或 OS 安全儲存，也不驗證 Windows 真實檔案鎖定情境。

### BUG-WHISPER-METAL-139：SIGSEGV signal fallback 可觀測性缺口

- 日期／版本：2026-09-18／0.51.0 開發中。
- 現象／影響：Node child process 若被 `SIGSEGV` 終止，`close` callback 會收到 `code=null`、`signal=SIGSEGV`；既有 server 只把 code 寫成 `Metal exit null`，真實 acceptance probe 又只辨識 `Metal exit 139`，可能讓實際已發生並成功完成的 signal fallback 被 evidence 誤記為未觀察到。
- 根因：fallback policy 以 `exitCode !== 0` 隱含接受 null／字串等值，server 沒有接收 `close` 的 signal 參數，probe 將產品策略過度收窄成單一 139 marker；policy、日誌與 acceptance 判定不是同一份明確契約。
- 修正：抽出型別嚴格的 process failure contract；明確非零整數 exit 或非空 signal 才算失敗。macOS arm64 首次 Metal 嘗試會清理 partial outputs 並 CPU retry 一次，log 分別寫 `Metal exit <code>` 或 `Metal signal <name>`；exit 0、null 且無 signal、非數字 exit、已在 CPU retry 與其他平台／架構不 fallback。真實 probe 共用 parser，接受任一明確 Metal failure marker＋CPU fallback。
- 驗證：policy／log marker 矩陣 exit 0；核心整合以真實自我 `SIGSEGV` child 取得 `Metal signal SIGSEGV`，清理 partial SRT／JSON 後以 CPU 完成 `ready-review`，既有 exit 139 案例亦通過。production controlled exit 139 replay 與 bundled Metal normal-path replay 均 exit 0；證據為 `docs/project-management/evidence/2026-09-18-whisper-signal-aware-fallback.json`。
- 防回歸：`scripts/test-whisper-fallback-policy.mjs` 固定 exit／signal／invalid value／平台矩陣與 parser 假陽性；`scripts/test-core.mjs` 同時覆蓋 exit 139 與 signal SIGSEGV 的 partial 清理、CPU metrics、可觀測 logs 與最終 draft。
- 剩餘風險：本輪沒有在真實 bundled production server run 重現 crash→CPU fallback，deterministic signal／exit 案例仍不代表 runtime 實機；取消中的 retry、CPU retry 失敗、長音訊、中文品質、其他 macOS 架構、Windows、乾淨安裝與發布仍未驗收。LM Studio 依需求方決策未執行。

### BUG-WHISPER-METAL-139：child-process exit 139 fallback 整合回歸

- 日期／版本：2026-09-17／0.51.0 開發中。
- 現象／影響：既有策略單元測試只驗證 fallback 判斷矩陣，未直接覆蓋 `runWhisperCpp` 的 child 非零退出、partial 輸出清理與 CPU retry，容易讓控制流回歸未被核心 API 測試捕捉。
- 修正：新增 macOS arm64 專用 deterministic runner marker；首次非 `--no-gpu` 執行回傳 exit 139 並寫入 partial SRT／JSON，第二次 `--no-gpu` 執行成功；若 server 未先清理 partial output，fixture 會留下明確 stale marker 使測試失敗。未改真實 Whisper.cpp CLI 或 production fallback 策略。
- 驗證／防回歸：`scripts/test-core.mjs` 建立 fallback 任務並斷言 `ready-review`、`metrics.whisperDevice=cpu`、首次 139 marker、無 stale partial marker 與最終 draft SRT；macOS arm64 受控核心回歸已通過，既有 fallback policy／quality focused 測試亦通過。
- 剩餘風險：fixture 不代表 bundled Whisper.cpp 真實 Metal／CPU 行為；長音訊、取消中的 retry、Windows／其他 macOS 架構、乾淨安裝與模型品質仍未驗收。

### BUG-WHISPER-METAL-139：產品 server 真實 bundled path probe

- 日期／版本：2026-09-17／0.51.0 開發中。
- 現象／影響：直接 bundled CLI 對照可在目前 macOS arm64 收到 Metal allocation failure／`SIGSEGV`，但需要確認 production-mode server 的 child-process 控制流、輸出清理與正常完成狀態。
- 重現／探針：`npm run acceptance:whisper:fallback -- docs/project-management/evidence/2026-09-17-whisper-real-server-fallback.json`；probe 使用隔離 localhost server、非測試環境、本機生成 WAV 與 bundled Tiny，不使用使用者媒體或外部 endpoint。
- 實際結果：server 任務完成 `ready-review`，metrics 為 `whisperDevice=metal`，產生 draft／SRT／JSON 並清除暫存 WAV；status logs 沒有 `Metal exit 139`／`CPU fallback`，故本次沒有重現 crash→CPU fallback。
- 修正／防回歸：新增 production-mode acceptance probe；若當次 status logs 同時出現 `Metal exit 139` 與 `CPU fallback`，probe 會強制斷言最終 `whisperDevice=cpu`、輸出完整與暫存清理，否則只記錄正常 Metal path，不放寬為 fallback 通過。
- 剩餘風險：真正 server 內的 bundled Metal crash→CPU fallback 尚未在同一次實機 run 重現；deterministic fixture 仍是 fallback 控制流的主要回歸證據，長音訊、取消中的 retry、跨平台與乾淨安裝仍待驗收。

### BUG-WHISPER-METAL-139：production-mode controlled fallback acceptance

- 日期／版本：2026-09-17／0.51.0 開發中。
- 現象／影響：真實 bundled server run 未重現 Metal crash，但仍需確認 production-mode（非 `NODE_ENV=test`）不會因 test runner 關閉而跳過 child-process fallback 控制流。
- 重現／探針：`npm run acceptance:whisper:production-fallback -- docs/project-management/evidence/2026-09-17-whisper-production-fallback.json`；隔離 tools tree 的 wrapper 首次注入 exit 139／partial SRT／JSON，第二次只在 `--no-gpu` 下呼叫既有 deterministic fixture，底層 model 使用 bundled Tiny symlink。
- 實際結果：production-mode server status logs 記錄 `Metal exit 139`／`CPU fallback`，最終 metrics 為 `whisperDevice=cpu`，任務完成 `ready-review`，輸出完整、stale partial 清單為空、暫存 WAV 清理；evidence 明確標示 `bundledRuntimeUsed=false`。
- 修正／防回歸：新增獨立 production-mode controlled acceptance，不改 `server.mjs` fallback 策略；若 test runner gating、partial 清理、CPU retry 或輸出驗證回歸，probe 會失敗。既有 `scripts/test-core.mjs` 維持 deterministic server fixture 回歸。
- 剩餘風險：這是 production-mode 控制流證據，不是 bundled `whisper-cli` 實機 Metal crash→CPU fallback；仍需在同一次真實 bundled server run 重現 crash 才能關閉該實機門檻，並另行驗收長音訊、取消中的 retry、CPU retry 失敗、跨平台與乾淨安裝。

### BUG-WHISPER-METAL-139：Metal 139 執行權限邊界釐清

- 日期／版本：2026-09-17／0.51.0 開發中。
- 現象／疑點：前一輪 default sandbox direct bundled CLI 對 FFmpeg 正規化短 WAV 收到 Metal `SIGSEGV`，但 production server bundled path 以 Metal 完成，需區分 runtime 問題與驗證環境限制。
- 重播條件：使用同一 `whisper-cli`／Tiny、同一 1 秒 16 kHz mono silence WAV、同一產品 flags；分別在 default sandbox 與 `require_escalated` local process 執行 direct Metal，並以 `npm run acceptance:whisper:fallback -- /private/tmp/20260917-whisper-real-server-fallback-replay.json` 重播 `NODE_ENV=production` server。
- 根因／環境因素判定：升級權限 direct replay exit `0` 並產生 SRT／JSON，production server replay 亦 exit `0`、`whisperDevice=metal`；因此先前 139 已確認為 sandbox 執行邊界差異，不能歸因為 bundled runtime 在本機正常權限下必然失敗。完整對照保存於 `docs/project-management/evidence/2026-09-17-whisper-metal-permission-boundary.json`。
- 修正／防回歸：不修改產品 fallback 策略；後續 direct runtime／server acceptance 必須記錄執行權限邊界，sandbox crash 只能作環境限制證據，不能要求產品因未在同一權限邊界失敗而觸發 fallback。production-mode deterministic wrapper 與 child-process fixture 仍覆蓋真正 fallback 控制流。
- 本次判定：真實 bundled server crash→CPU fallback 仍未觀察到，故不關閉該實機驗收門檻；已解除「sandbox direct 139 與正常 server Metal success」的診斷矛盾。中文品質、長音訊、取消中的 retry、CPU retry 失敗、跨平台與乾淨安裝仍待驗收，LM Studio 依需求方決策未執行。

### BUG-030：Ollama 合法 JSON 未包裝 cues 陣列

- 日期／版本：2026-09-15／0.51.0 開發中。
- 現象：Ollama `llama3.2:1b` 的 provider raw response 可回傳合法 JSON，但形狀是單一 `{id,text,reason}` cue object，而不是既有 optimizer 要求的 `{"cues":[...]}`；產品流程因此回報「AI 回傳缺少 cues 陣列」。
- 影響：本機小模型即使已產生一個可辨識的字幕建議，仍會在 strict cue validation 前直接失敗，無法完成翻譯／校對批次。
- 重現：`OSF_ACCEPT_EXTERNAL=1 OSF_PROVIDER=ollama OSF_BASE_URL=http://127.0.0.1:11434/v1 OSF_MODEL=llama3.2:1b node scripts/probe-provider-live.mjs --output docs/project-management/evidence/2026-09-15-ollama-llama3.2-1b-provider-recheck.json` 保存 raw provider contract 失敗；以同一本機設定直接呼叫 `optimizeSubtitleCues()`，修正前同樣回報 `AI 回傳缺少 cues 陣列`。
- 根因：`parseCompletionContent()` 對合法 object 會回傳 `parsed.cues`，而 `canRepairOllamaJson()` 只辨識 malformed JSON，沒有把「缺少 wrapper」視為可安全一次修復的本機模型格式偏差。
- 修正：僅對 `provider=ollama` 且錯誤為無效 JSON／缺少 `cues` 陣列時送出一次明確 wrapper repair prompt；修復回應仍必須通過原有 ID、數量、順序、文字長度、語系與內容驗證，非 Ollama provider 不改變。
- 驗證：`node --check lib/ai/subtitle-optimizer.mjs`、`node --check scripts/test-ai-optimizer.mjs`、`node --check scripts/probe-ollama-live.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-providers.mjs` 均 exit 0；實際 Ollama `llama3.2:1b` probe 亦通過 capability、native single-cue 與 optimizer product path，證據為 `docs/project-management/evidence/2026-09-15-ollama-llama3.2-1b-optimizer-recheck.json`。
- 防回歸：新增 deterministic 測試確認未包裝 cue object 只觸發一次 repair，第二次 wrapper response 才可通過；live probe 記錄 `cue-object`→`cues-array` 回應形狀與固定 `LIVE-OPT-1` cue contract。
- 剩餘風險：模型可能在 repair 後仍產生語意、標點或語系品質不足，流程會安全拒絕但不保證生成成功；目前只驗證一個 Ollama 模型，LM Studio、真正斷網、取消／人工接受、跨平台與多批次真實模型仍待另行驗收。

### DEV-027：Anthropic Messages API 與既有 optimizer contract 不同

- 日期／版本：2026-08-26／0.51.0 開發中。
- 現象：Anthropic 使用 `/v1/messages`、`x-api-key`、必要的 `max_tokens` 與 content blocks，不能直接沿用 OpenAI `/chat/completions` 的 body／回應格式；直接共用會造成認證失敗、system prompt 被當成 user，或 optimizer 找不到 `choices[].message.content`。
- 影響：使用者選取 Anthropic 後無法載入模型、測試連線或安全套用字幕建議。
- 根因：供應商傳輸契約與既有 OpenAI-compatible adapter 不同。
- 修正：新增 `lib/ai/anthropic.mjs`，正規化 Base URL、移除 `/v1` 重複路徑、將 system／developer prompt 分離、合併連續 user／assistant 訊息、映射 `max_completion_tokens`→`max_tokens`、剔除 OpenAI 專用欄位，並把 Anthropic text content blocks 正規化為既有 choices contract；provider registry、UI、設定 profile 與金鑰隔離同步加入 `anthropic`。
- 防回歸：`scripts/test-ai-providers.mjs` 驗證 endpoint、headers、body 清理與 response mapping；`scripts/test-core.mjs` 驗證 provider list／profile／runtime key；`scripts/test-review-ui.mjs` 驗證選項與白名單。
- 剩餘風險：未使用真實 Claude API Key；外部模型品質、計費、速率限制、proxy 相容性與平台封裝仍需另行驗收。

### BUG-027：Anthropic 新模型拒絕非預設取樣參數

- 日期／版本：2026-09-14／0.51.0 開發中。
- 現象：共用 optimizer body 可包含 `temperature`、`top_p`、`top_k`，Anthropic adapter 會原樣轉成 `/v1/messages` body；真實 provider probe 亦固定帶入 `temperature: 0`。Anthropic 官方已說明 Claude Opus 4.7 之後對非預設取樣參數回覆 HTTP 400。
- 影響：使用者可成功載入模型清單，但在最新 Claude 模型開始字幕優化時直接遭遇 400；既有 mock 因未模擬參數拒絕而可能假綠。
- 根因：初版 adapter 依舊版 Messages API 支援範圍轉送通用取樣欄位，未把供應商模型相容性變更納入 request allowlist。
- 修正：`lib/ai/anthropic.mjs` 的明確 body allowlist 移除 `temperature`／`top_p`／`top_k`；共用 `scripts/probe-provider-live.mjs` 維持既有 `temperature: 0`，由 Anthropic adapter 局部過濾。model、`max_tokens`、system、messages 與 stop sequences 維持原契約，其他 provider 不變。
- 驗證：新增三個負向 contract assertion；修正前 focused 測試因實際 `temperature: 0` 外送而 exit 1，修正後 `node scripts/test-ai-providers.mjs` 與完整 `npm run check` 均 exit 0。
- 防回歸：即使上游共用 optimizer body 再次帶入任一取樣欄位，Anthropic adapter 測試仍要求最終 request body 的三欄皆為 `undefined`；另斷言 `stop_sequences` 保留及共用 live probe 仍提供 `temperature: 0`，不得依易過時的模型名稱白名單決定是否轉送。
- 剩餘風險：本輪不使用付費 API Key，無法證明特定 Claude 模型、proxy、計費或速率限制的真實端點結果。

### BUG-028：Anthropic 後頁模型被誤判為不可用

- 日期／版本：2026-09-14／0.51.0 開發中。
- 現象：Anthropic Models API 回應 `has_more=true` 且設定模型位於第二頁以後時，連線測試只檢查第一頁，回傳 `modelAvailable=false` 與不完整 `modelCount`。
- 影響：擁有超過單頁數量模型或使用分頁 proxy 的使用者可能無法通過指定模型檢查，即使該模型實際可用。
- 重現：deterministic mock 第一頁只含 `newer-model` 並回傳 `last_id`，第二頁才含 `test-model`；修正前 provider contract 測試實際得到 `false`，未發出第二頁 GET。
- 根因：初版 `listAnthropicModels()` 只取一次 `result.data`，未實作官方 Models API 的 `has_more`／`last_id`／`after_id` cursor pagination。
- 修正：每頁以 `limit=1000` 請求，`has_more=true` 時將 opaque `last_id` 原始字串經 `URLSearchParams` 安全編碼為下一頁 `after_id`，依序合併資料；trim 僅用來拒絕全空白游標，不修改傳遞與去重值；缺失 pagination flag、空白／重複游標或超過 100 頁時明確失敗。
- 驗證：修正前 focused test exit 1；修正後 Node 語法、provider contract、`git diff --check` 與完整 `npm run check` 均 exit 0，涵蓋兩頁成功、游標編碼、空清單、缺模型、異常游標與頁數上限。
- 防回歸：連線測試與 `listModels()` 共用同一分頁函式；不得以第一頁缺少指定 ID 判定不可用，也不得在無法前進的 cursor response 上重複請求。
- 剩餘風險：未以真實 API Key 或超過 20 筆的 Anthropic 帳號模型清單驗證；自訂 proxy、外部速率限制、網路中斷與跨平台封裝後行為仍待外部驗收。

### BUG-029：provider profile 可夾帶秘密欄位寫入一般設定

- 日期／版本：2026-09-15／0.51.0 開發中。
- 現象：`/api/ai/settings` 保存流程原樣合併 payload 的 `profiles`；巢狀 profile 若包含 `apiKey`、`authorization`、`secret` 或其他未知欄位，會被寫入一般 `settings.json`，雖然頂層 API Key 已另存 secrets。
- 影響：provider 金鑰或自訂秘密可能落入一般設定檔，違反 API Key 與秘密不得進入一般設定的安全契約；profile API 也可能回傳不應保存的欄位。
- 重現：核心測試送出 `profiles.anthropic.apiKey`、`authorization` 與 `secret`，修正前 `scripts/test-core.mjs` 以一般設定檔包含秘密字串而失敗。
- 根因：`normalizeAiSettings()` 的 profile 欄位直接保留原物件，`/api/ai/settings` 又以未正規化的 `payload.profiles` 合併保存；初版 allowlist 另因常數宣告晚於模組啟動時的 `loadSettings()`，使含非空 profile 的既有設定觸發 TDZ 後靜默回退預設值。
- 修正：新增 provider profile allowlist，只保存 `baseUrl`、`model`、`deployment`、`apiVersion`、`batchSize` 與 `timeoutSeconds`；只接受支援的 provider 物件，字串與數值欄位各自正規化，保存流程改用正規化後的 profiles；並將 allowlist 常數移至 `loadSettings()` 首次執行前。
- 驗證：核心 API 測試確認巢狀秘密不在 `settings.json`、`/api/ai/profile` 回應或合法 profile，啟動時預置的非空 profile 可保留且未知欄位不進 runtime；`node --check server.mjs`、`node --check scripts/test-core.mjs`、`node scripts/test-core.mjs`、provider contract、review UI 與 `git diff --check` 通過。
- 防回歸：測試持續送出巢狀 API Key、Authorization、secret 及合法模型欄位；allowlist 以 provider ID 過濾未知 profile，避免未來直接合併原始 payload 再次繞過正規化。
- 剩餘風險：本輪未改變既有 secrets 加密／OS 金鑰儲存機制；已存在於使用者設定檔的歷史秘密需由後續設定載入／遷移流程另行清理或驗收，本輪只保證新保存路徑不再寫入。

### BUG-001：portable Python／Whisper 綁定開發機路徑

- 現象：換到其他 Windows 電腦後找不到 Python 或 Whisper。
- 根因：venv 與 launcher 保存開發機絕對路徑。
- 修正：改用 bundled Whisper.cpp；runtime resolver、manifest 與 SHA 驗證取代開發機 venv 依賴。
- 防回歸：`verify-runtime-package.mjs` 與平台 runtime 準備腳本。

### BUG-002：Windows 中文檔名亂碼

- 現象：匯入、任務資料或輸出顯示 mojibake。
- 根因：UTF-8 被誤解為 Latin-1／Windows 編碼處理不一致。
- 修正：統一 UTF-8 路徑與回應處理。
- 防回歸：核心測試包含中文檔名案例。

### BUG-003：FFmpeg ASS filter 的 Windows 磁碟機路徑

- 現象：硬字幕輸出因 `C:` 等路徑字元解析失敗。
- 根因：filter 字串中的 Windows 絕對路徑需特殊跳脫。
- 修正：以輸出工作目錄與相對 `subtitle.ass` 執行。
- 防回歸：硬／軟字幕輸出 API 測試。

### BUG-004：Azure GPT-5 不支援 `max_tokens`

- 現象：連線測試回覆要求改用 `max_completion_tokens`。
- 根因：舊 chat completions 參數套用到 GPT-5 部署。
- 修正：0.45.1 改送 `max_completion_tokens`。
- 防回歸：AI provider contract tests 驗證請求參數。

### BUG-005：GPT-5 不接受 `temperature: 0.1`

- 現象：AI 優化在部分 GPT-5 部署回覆 unsupported value。
- 根因：optimizer 固定傳送 0.1。
- 修正：0.45.1 移除固定 temperature，使用模型預設。
- 防回歸：provider／optimizer 測試確認不再傳送不相容值。

### BUG-006：AI 優化面板佔用字幕清單空間

- 現象：未使用 AI 時仍大幅壓縮右側校閱區。
- 根因：AI 控制區始終展開。
- 修正：預設精簡、可展開／收合、保存偏好；任務開始時自動展開。
- 防回歸：`test-review-ui.mjs` 驗證狀態、記憶與自動展開。

### BUG-007：Windows 手冊 MP4 被最終 NSIS 過濾

- 現象：`win-unpacked` 有 MP4，但最終 EXE 清單缺少動畫。
- 根因：最終封裝流程未保留 `.mp4` 資產。
- 修正：保持 MP4 內容但使用 `.osfvideo` 資源副檔名，HTML 明確宣告 `type="video/mp4"`。
- 防回歸：workflow 檢查三個資源；發布前以 `7za l` 與 `ffprobe` 交叉驗證。

### BUG-008：GitHub 中文 Windows 資產名稱被簡化

- 現象：中文檔名上傳後變成 `0.45.1.exe`／`Setup.0.45.1.exe`，與 checksum、blockmap、`latest.yml` 不一致。
- 根因：GitHub CLI／Release 對上傳檔名進行平台正規化。
- 修正：Release 使用穩定 ASCII 名稱，更新 checksum，驗證後刪除錯誤重複資產。
- 防回歸：部署文件規定使用 ASCII 發布名稱並在上傳後核對實際名稱。

### BUG-009：AI 輸出語言僅支援三個固定選項

- 現象：設定介面只有繁中、簡中與英文；其他語言無法選擇，未支援值會靜默回退繁中。
- 影響：使用者誤以為指定語言已生效，但 LLM 實際收到 `zh-TW`，造成翻譯或校對語言錯誤。
- 根因：前端選項與 `normalizeAiSettings` 都以三值白名單硬編碼，Prompt 沒有共用語言驗證層。
- 修正：新增 `lib/ai/languages.mjs`，統一 BCP 47 驗證與標準化；UI 增加常用語言及自訂標籤；設定與 AI 任務 API 拒絕無效新輸入；Prompt 只採用驗證後值。
- 防回歸：optimizer、review UI 與 core API 測試覆蓋標準化、自訂語言、舊設定回退及注入型字串拒絕。
- 剩餘風險：LLM 是否完全遵循目標語言仍受供應商模型能力影響，必須由使用者逐段確認建議。

### BUG-010：Groq／Gemini 選項會被後端無聲回退

- 日期／版本：2026-07-22／0.45.2 候選修正。
- 現象：前端可選 Groq 或 Google Gemini，但儲存後供應商回到 `openai-compatible`；切換時可能殘留 Azure 欄位，Gemini 優化回應格式也與 optimizer 契約不一致。
- 影響：使用者看到的供應商與實際執行者不同，profile／API Key 可能落入錯誤供應商槽位，Gemini 優化可能在回應驗證階段失敗。
- 重現：對 `/api/ai/settings` 傳入 `provider: "groq"` 或 `"gemini"`，舊版 `normalizeAiSettings` 僅接受 OpenAI、OpenAI-compatible、Azure，因而回退預設值。
- 根因：供應商清單分散在 HTML、server endpoint 與 adapter；新增 UI／adapter 時未同步後端三處白名單，Gemini adapter 又使用原生回應格式而未符合既有 optimizer 的 OpenAI choices 契約。
- 修正：由 provider registry 匯出共同驗證函式；設定、profile、runtime key 與刪除金鑰 API 明確驗證供應商；Groq／Gemini profile 與 secrets 按 ID 隔離；Gemini 優化改用 OpenAI 相容 chat completions；UI 驗證 provider，非 Azure 欄位清空停用，連線前檢查已保存設定與金鑰。
- 驗證：`test-ai-providers.mjs`、`test-review-ui.mjs`、`test-core.mjs` 與 2026-07-22 本機瀏覽器切換實測通過。
- 防回歸：provider definitions、非法 provider 400、跨 provider 金鑰清除隔離與 UI 切換契約均納入 `npm test`。
- 剩餘風險：尚未使用真實 Groq／Gemini 帳號執行外部 smoke test；既有 0.45.2 候選安裝包未包含本修正，須重新建置與驗證。

## 新缺陷處理

發現新問題先在 `08-CHANGE-LOG.md` 記錄，再於本文件新增 `BUG-ID`。修正不得只寫「已解決」，必須包含可重現證據、根因與防回歸測試；若只能 workaround，須說明移除條件。

### BUG-WHISPER-METAL-139 — macOS Metal buffer allocation crash

- 日期／版本：2026-07-30／0.48.0
- 現象：macOS arm64 以 bundled `whisper-cli`、tiny model、1 秒 16 kHz silence WAV 執行 `-oj -ojf`，process exit 139，未產生 JSON。
- 重現：`tools/whisper-cpp/whisper-cli -m tools/whisper-models/ggml-tiny.bin -f /tmp/whisper-metal-smoke.wav -oj -ojf -of /tmp/whisper-metal-smoke`。
- 實際結果：exit `139`；stderr 在 `use gpu = 1` 後出現 `ggml_metal_buffer_init: error: failed to allocate buffer, size = 2.20 MiB`；stdout 為空，JSON 不存在。
- 對照結果：同一 WAV／model 加 `--no-gpu` 執行 exit `0`，產生 `/tmp/whisper-cpu-smoke.json`；CPU stderr 顯示完整 processing／output_json／timings。
- 根因判定：已確認為目前主機 bundled Whisper.cpp Metal buffer allocation 路徑的可重現 runtime failure；尚不能推論所有 macOS／模型／媒體均受影響。
- 修正狀態：0.48.x 穩定化已在 `runWhisperCpp` 加入 Metal 非零退出後的 `--no-gpu` CPU retry；CPU 仍失敗時維持 failed，不把 crash 當成功。
- 防回歸／後續：完整回歸與 CPU 對照證據通過；需在 macOS 實機長音訊與乾淨安裝環境持續驗證 retry 耗時、取消與 quality metadata 清理。
- 剩餘風險：未在乾淨 macOS 使用者環境、Windows 或長音訊驗證；目前產品路徑仍可能在 Metal crash 時失敗。
- 2026-09-17 重驗：目前 bundled `whisper-cli`／Tiny／生成 1 秒靜音 WAV 的預設 Metal 路徑實際 exit 139，stderr 出現 `ggml_metal_buffer_init` allocation failure 且沒有 SRT／JSON；同一輸入加 `--no-gpu` exit 0 並產生 SRT／JSON。CPU JSON 的 transcription segment 只有 offsets／timestamps／tokens，仍沒有 segment-level confidence／no-speech，證據保存於 `docs/project-management/evidence/2026-09-17-whisper-bundled-runtime-recheck.json`。
- 本次判定：已重新確認目前主機 bundled runtime 的 crash／CPU workaround 與 quality metadata 缺失，並未宣稱產品 server 已以真實 CLI 完成自動 fallback；產品 fallback 由前一輪 deterministic child-process fixture 覆蓋，真實長音訊、取消中的 retry 與跨平台實機仍待驗收。
# BUG-012 — OpenAI-compatible 顯示 Gemini 舊設定

- 發現版本：0.45.2（2026-07-22）
- 現象：AI 設定服務類型為 `OpenAI-compatible`，但 Base URL 為 `generativelanguage.googleapis.com/...`、模型為 `gemini-3.5-flash`。
- 根因：舊設定的供應商值與 Gemini 的 Base URL／模型被分開保存；載入時供應商回退為 `openai-compatible`，卻未清除不相容的舊欄位。
- 修正方向：0.45.3 載入設定時辨識 Gemini URL／模型與 OpenAI-compatible 的不一致組合，回復 OpenAI-compatible 預設 Base URL／空模型；不刪除 API Key、不修改 Gemini profile。
- 回歸防護：核心 API 測試加入舊 Gemini／OpenAI-compatible 混用資料遷移案例。
- 未覆蓋：目前尚未完成已存在使用者設定檔的實機升級驗證，需於 0.45.3 實機 smoke test 補齊。

# BUG-013 — 設定語系仍提供不需要的簡體中文選項

- 發現版本：0.45.2（2026-07-23）
- 現象：介面語言與 AI 輸出語言選單均提供簡體中文，與目前產品語系範圍不符。
- 影響：使用者可能選擇不支援的介面語系；既有 `zh-CN` 設定也可能在 UI 中繼續顯示為可用選項。
- 修正方向：移除兩個 UI 選單中的 `zh-CN`；伺服器載入既有 `appLanguage: zh-CN` 時回退 `zh-TW`；保留 AI 自訂 BCP 47 API 的標準化相容性。
- 回歸防護：UI 契約測試確認 `zh-CN`／簡體中文選項不存在，核心測試確認舊介面設定回退繁中。

# BUG-014 — 翻譯模式回傳不相關術語而非翻譯

- 日期／版本：2026-07-30／0.48.0 測試版。
- 現象：選擇翻譯後，AI 建議出現 `E3;平台名稱`，未產生完整翻譯。
- 影響：使用者可能誤接受不相關文字，覆蓋正確譯文。
- 重現：Ollama `llama3.2:1b`、專案術語表含「一三 → E3｜平台名稱」、翻譯中文 cue；既有 optimizer 以 `translatedText` 當輸入並把整份術語表送入每批。
- 根因：翻譯模式在 UI scope 已選原文，但 optimizer 正規化階段再次優先採用既有譯文；不相關術語表污染小模型提示，且翻譯結果缺少長度與目標語言驗證。
- 修正：翻譯模式固定以 `sourceText` 為輸入；傳給模型的 cue 僅保留 `id/text`；每批只帶入原文實際出現的術語；拒絕過短或英文／日文／韓文語系不符結果；新任務先清除舊建議；UI 類型由受控 mode 顯示。
- 驗證：`npm run check` 通過；真實 Ollama 英文兩 cue 測試與封裝 App 內模組同案例通過，建議均為 `mode: translate` 且未含 `E3／平台名稱`。
- 防回歸：`test-ai-optimizer.mjs` 覆蓋既有譯文、無關術語、過短輸出與日文語系不符；`test-review-ui.mjs` 覆蓋舊建議清除與受控模式標示。
- 剩餘風險：`llama3.2:1b` 可完成英文翻譯但語意品質有限；日文實測未遵循目標語言時會安全拒絕，建議使用較大模型並逐段人工確認。

# BUG-015 — Whisper SRT 零長度時間碼造成校閱載入失敗

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：載入校閱時回報「字幕第 703 段時間碼無效」。
- 影響：Whisper.cpp Small 已完成轉錄但無法進入字幕校閱；同一輸出另有第 704、707 段零長度時間碼。
- 重現：讀取本機 job `/Users/nycu/Library/Application Support/offline-subtitle-factory/jobs/20260805011912-3fca91/working/draft.srt`，第 703 段為 `00:23:53,560 --> 00:23:53,560`，第 704 段相同，第 707 段為 `00:23:54,160 --> 00:23:54,160`；`public/bilingual-subtitles.mjs` 的 `normalizeBilingualCue` 對 `end <= start` 拋出載入錯誤。
- 根因：Whisper.cpp 原始 SRT 可產生開始與結束相同的零長度 cue；`runWhisperCpp` 直接把原始檔複製成 `draft.srt`，未在寫入前套用與校閱解析器一致的嚴格時間碼驗證。
- 修正：新增純函式 SRT 清理器，嚴格解析時間碼、捨棄格式錯誤或 `end <= start` 的 cue、保留有效 cue 並重新編號；Whisper／Whisper.cpp 寫入 `draft.srt` 前套用，既有任務進入校閱資料 API 時也以同一清理器相容載入，全部無效時以可採取行動的錯誤結束；保留原始 Whisper 輸出供診斷。
- 驗證：focused 清理器與實際 job 703／704／707 回歸、`parseSrtBilingual` 載入、完整 `npm run check`、兩平台封裝與 ZIP 完整性、獨立審查及文件結案檢查。
- 防回歸：`scripts/test-whisper-srt.mjs` 覆蓋零長度、逆序、格式錯誤、多行文字、重新編號及全部無效邊界；後續 Whisper 輸出均經同一清理器。
- 剩餘風險：被捨棄 cue 的原文不會進入校閱，可能造成少量內容遺失；需由外部驗收確認長音訊、Windows 實機及清理後中文內容品質，模型本身的幻覺／辨識率不在本缺陷修正範圍。

# BUG-016 — Ollama 多批次 AI 優化逾時

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：使用 Ollama 進行多筆 AI 優化時回報「AI 優化失敗：AI 請求逾時」。
- 影響：已完成的批次仍保存於 checkpoint，但整個 AI 任務在單一批次逾時後變成 failed；使用者需要手動恢復，且容易誤以為所有批次遺失。
- 重現：本機 job `/Users/nycu/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json`；provider=`ollama`、model=`llama3.2:3b`、55 cues、55 batches、`timeoutSeconds=120`、`maxRetries=1`；第 1／2 批完成後第 3 批逾時，記錄 `progress.completedBatches=2`、`checkpoint.nextBatchIndex=2`、`error=AI 請求逾時`、`retryable=true`。
- 根因初判：Ollama 原生 `/api/chat` 請求使用 `stream:false` 並套用單次絕對 fetch timeout；本機低資源模型對特定 cue 可能超過 timeout，既有批次雖有 checkpoint，但 timeout 錯誤沒有提供更細緻的本機長生成處理與恢復提示。
- 修正：Ollama 原生 `/api/chat` 改用 `stream:true`；新增 NDJSON fragment 組裝，並將 timeout 重設為每片段的 idle timeout；保留 strict JSON／cue 驗證與 checkpoint，timeout 且已有完成批次時明確提示可恢復，不以無限延長 timeout 或靜默接受部分結果取代修正。
- 驗證：`test-ai-providers.mjs`、`test-ai-optimizer.mjs`、`test-ollama-batch-stream.mjs` 與完整 `npm run check` 通過；deterministic 三批次 streaming 在 100ms idle timeout 下完成，timeout checkpoint 續跑只送未完成批次；本機 Ollama `127.0.0.1:11434` 未啟動，真實模型 smoke 待外部驗收。
- 防回歸：provider contract 驗證 `stream:true`／NDJSON；delayed chunk 驗證 idle timer 每片段重設；optimizer 驗證第 3 批 timeout 後 `nextBatchIndex=2` 且續跑不重送前兩批；server 錯誤訊息保留已完成批次數量與恢復指引。
- 剩餘風險：模型本身可能在複雜字幕上生成極慢或卡住；若超過安全上限仍須讓任務可恢復失敗，不能保證所有低資源模型／字幕永不逾時。

# BUG-017 — Ollama 第 3 批重試後仍逾時

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：BUG-016 的 streaming 修正封裝於第 3 批仍顯示「受限或失敗，第 1 次重試，等待 2 秒」，重試後再次回報「AI 優化失敗：AI 請求逾時」。
- 重現：job `/Users/nycu/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json` 更新至 2026-08-05 11:27；`provider=ollama`、`model=llama3.2:3b`、`completedBatches=2/55`、`activeBatch=3`、`retryAttempt=1`、`retryable=true`、`checkpoint.nextBatchIndex=2`、`error=AI 請求逾時`。本機 Ollama `127.0.0.1:11434` 目前連線拒絕，無法取得同一 cue 的真模型 response。
- 症狀與根因區分：症狀是串流重試仍逾時；已確認原 transport 在 `fetch` 收到 response headers 後沒有重新開始 body idle timeout，若 Ollama 在 headers 後才產生第一個 NDJSON chunk，仍會沿用 request 起始計時器；此外 timeout 重試沿用相同 120 秒上限，沒有為低資源模型增加可控的第二次等待窗口。
- 修正：`requestAiJson` 在 `fetch` 完成後重新 arm timeout；Ollama native request 增加 `num_predict=512`、`keep_alive=10m`，避免無界生成與每批重新載入；optimizer 對 Ollama timeout 的下一次 retry 自動將 timeout 加倍（120→240 秒，最高 600 秒），並把延長值寫入 retry progress；UI 重試訊息顯示本次 timeout 上限；checkpoint／strict cue validation 保持不變。
- 驗證：`test-ai-providers.mjs` 覆蓋 Ollama streaming、chunk idle reset、headers 後延遲第一 chunk、`num_predict`／`keep_alive` contract；`test-ai-optimizer.mjs` 覆蓋 Ollama timeout retry 延長至 240 秒與進度 telemetry、既有 checkpoint resume；`test-ollama-batch-stream.mjs` 三批次 streaming 通過。完整回歸、兩平台封裝與真實 Ollama smoke 待本輪結案補記。
- 防回歸：timeout 重試不得重送已完成批次；若延長窗口仍無任何 response，仍以 retryable failed 保存 checkpoint，不靜默產生 AI 建議。
- 剩餘風險：真實 `llama3.2:3b` 仍未於本環境啟動驗證；若模型在 240／600 秒內完全沒有輸出，任務仍會安全失敗並需恢復；Windows 實機與不同 Ollama 版本的 `keep_alive`／`num_predict` 行為仍待外部驗收。

# BUG-018 — Ollama 回傳內容非有效 JSON

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：Ollama 第 3 批不再 timeout，但回報「AI 優化失敗：AI 回傳內容不是有效 JSON」。
- 重現：job `/Users/nycu/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json` 於 2026-08-05 12:10 為 `status=failed`、`provider=ollama`、`model=llama3.2:3b`、`completedBatches=2/55`、`nextBatchIndex=2`、`suggestions=2`、`mode=proofread`、`language=ja`；本機 Ollama `127.0.0.1:11434` 連線拒絕，未保存 raw model response。
- 根因判定：`parseCompletionContent` 原先只接受完整 JSON 或單純 code fence，沒有安全處理模型在 JSON 前後附加說明；對真正 malformed／截斷 JSON 也沒有 Ollama 專用一次性 repair，因此 strict parser 直接讓批次失敗。無 raw response 時不能把本次錯誤進一步歸因為 wrapper、截斷或模型 schema 失守其中一項。
- 修正：解析前保留 strict JSON 契約，但可從前後包裝文字中擷取完整 `{...}`／`[...]` JSON 再驗證；Ollama malformed JSON 只觸發一次簡化 repair prompt，第二次仍無效則拒絕，不接受原文或不完整 cue；UI 顯示「正在要求 Ollama 重新輸出 JSON」；既有 checkpoint／cue ID／數量／順序驗證不變。
- 驗證：`test-ai-optimizer.mjs` 覆蓋 wrapper extraction、Ollama proofread malformed→repair、repair 第二次仍 malformed 的拒絕與最多兩次請求；既有 provider／timeout／stream tests 與完整受控權限 `npm run check` 通過；兩平台 ZIP `unzip -t`、source markers／Small manifest 核對通過；真實 Ollama raw response／同一 job 修正後重跑與 Windows 實機仍待外部驗收。
- 防回歸：只對 `provider=ollama` 且 `code=invalid_json` 進行一次 repair；translation 仍使用既有專用 repair；非 Ollama provider 不改變原有 JSON path；修復後仍必須通過 cue strict validation。
- 剩餘風險：本機未啟動真實 Ollama，尚未取得原始 malformed response；若模型回傳內層未跳脫引號、截斷或 valid JSON 但 cue contract 錯誤，repair 仍可能安全失敗；Windows 實機與不同 Ollama 版本仍待外部驗收。

# BUG-019 — Ollama cue 文字長度異常

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：Ollama AI 優化在 cue 344 回報「AI 文字長度異常」；該批未完成，既有 checkpoint 仍可續跑。
- 重現：job `/Users/nycu/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json`；`provider=ollama`、`model=llama3.2:3b`、`progress.completedBatches=4/55`、`checkpoint.nextBatchIndex=4`、`mode=proofread`、`language=ja`；cue 344 原文為「如果老師選擇Excel的話」，本機未保存 raw model response，Ollama 目前連線拒絕。
- 根因判定：strict validator 對 cue 文字使用 `Math.max(500, original.length * 6)` 上限；本次模型回應已超過安全上限，可能含解說、重複內容或無界生成。因沒有 raw response，不能把具體內容形式宣稱為已證實的單一原因；放寬上限或截斷都會讓錯誤內容進入字幕。
- 修正：抽出一致的 cue 長度上限計算；原始 prompt 明確列出每個 cue 的字元上限並禁止解說／重複／Markdown；Ollama 遇到 length validation failure 只執行一次專用 JSON repair，repair 仍超長即拒絕；UI 顯示「回應文字過長，正在要求 Ollama 重新輸出」；ID／數量／順序／strict validation／checkpoint 保持不變。
- 驗證：`test-ai-optimizer.mjs` 覆蓋 cue 344 過長→一次 repair 成功、第二次仍過長拒絕、`validationRepairReason=length` telemetry，以及非 Ollama provider 仍嚴格拒絕；provider／stream 回歸與完整 `npm run check`、兩平台測試包與 ZIP 完整性待本輪結案補記。
- 防回歸：length repair 不截斷、不套用原文 fallback、不寫入未完成批次；若模型再次超長，保留上一個成功 checkpoint，使用者可從 `nextBatchIndex` 恢復。
- 剩餘風險：真實 Ollama raw response／同一 job 修正後 55 批重跑、Windows 實機與不同 Ollama 版本仍待外部驗收；若模型持續產生超長輸出，仍會安全失敗而非保證成功。

# BUG-020 — AI 優化前端 `Failed to fetch`

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：校閱頁在 AI 優化流程顯示「AI 優化失敗：Failed to fetch」。
- 重現／基準：需求方未提供本次 job ID、renderer console 或 server log；目前可讀取的最近 job `20260805024615-2af944` 已是 `status=completed`、55/55，沒有可將本次錯誤歸因到 Ollama response 的 failed checkpoint。`public/review.js` 原先在啟動／輪詢 `/api/jobs/:id/ai-optimize` 的瀏覽器 fetch 例外直接顯示原生 `Failed to fetch`。
- 根因判定：已確認可見錯誤是 renderer→本機字幕工廠 HTTP API 層的未正規化 fetch 例外；尚不能由目前證據判斷是 App server 暫停／port 變更、Windows 啟動生命週期、網路堆疊或請求回應中斷。Ollama provider 內部錯誤另由 `requestAiJson` 正規化，不與本錯誤混同。
- 修正：新增 `public/ai-fetch.mjs`，將 `Failed to fetch`／`NetworkError`／`Load failed`／`fetch failed` 等本機 API 不可達錯誤轉成包含 API 位址、重啟／重新載入與 checkpoint 恢復指引的可診斷訊息；AI 狀態 GET 失聯時最多重試兩次；啟動 POST 回應遺失時先查詢既有任務狀態，若已在 server 執行則接回輪詢；API 回應非 JSON 時明確標示格式錯誤。未自動重送啟動 POST，避免建立重複 AI 任務。
- 防回歸：`scripts/test-ai-fetch.mjs` 覆蓋 network error 正規化、非 network provider error 不誤判、invalid API response 與 retryable marker；`npm test` 接入測試。保留既有 strict cue validation、Ollama repair／timeout 與 checkpoint。
- 驗證：`node --check public/review.js`、`node --check public/ai-fetch.mjs`、`node --check public/ai-status-recovery.mjs`、`node scripts/test-ai-fetch.mjs`、`node scripts/test-review-ui.mjs`、`node scripts/test-ai-optimizer.mjs`、受控完整 `npm run check`、`git diff --check` 已通過；最新 macOS arm64／Windows x64 ZIP `unzip -t` 通過，SHA-256 分別為 `ebac55d1fc7d40de54e7c113d7da4eec531c4099c52ed0be727f2d4c57da9bb0`／`2ec03b3de2a541e4d3272a4563cdca9d2f00f25b7fa6738954e5db0ee7c9c998`；兩平台 source markers 與 Small manifest 核對一致；round2 獨立複審已完成，真實 renderer／Windows 實機／Ollama smoke 仍為外部驗收條件。
- 剩餘風險：沒有本次實際 renderer console／server log，無法證明單一外部觸發原因；若 server process 已完全停止，前端只能提供重啟與恢復指引；若 POST 已送達但 GET 也不可達，仍需重新載入 App 後以 checkpoint 恢復。Windows 實機與真實 Ollama multi-batch smoke 仍待外部驗收。

# FR-023 — Windows Whisper 高階模型需手動下載

- 日期／版本：2026-08-06／0.48.0 測試版
- 現象：Windows 安裝包選擇 Base／Small 時，若模型檔不存在，只顯示「請安裝或匯入正確模型後再試」，使用者必須自行尋找下載來源與可寫入路徑。
- 根因：三模型選擇已存在，但模型資產不一定隨平台包附帶；Electron server 使用安裝資源目錄作為工具來源，Windows 安裝目錄可能不可寫入，且既有 UI 沒有下載狀態／手動 URL／首次使用前檢查。
- 修正：新增固定 revision 的官方 Whisper.cpp multilingual Base／Small／Tiny download definitions；`server.mjs` 提供模型狀態與下載 API，下載到 `userData/whisper-models`、限制白名單、回報進度、驗證預期大小／SHA-256、失敗清理暫存檔並原子置換；`public/app.js` 在模型選擇與任務提交前顯示確認、進度與官方手動下載說明；`lib/whisper-models.mjs` 支援 user cache 優先、封裝模型 fallback。
- 驗證：`test-whisper-model-download.mjs` 覆蓋成功／HTTP 失敗／大小／SHA／AbortController 逾時／Windows 既有檔替換／暫存清理，並在 `.download` 已寫入部分內容後取消；`test-whisper-models.mjs` 覆蓋模型管理 UI；`test-core.mjs` 覆蓋 `/api/whisper-models` pinned metadata，以及 POST→部分 bytes→DELETE→無 `.download`／`.previous` 的 active API 路徑；完整 `npm run check`、兩平台封裝／source marker 與 docs check 已通過；Windows 實機下載／userData 權限／中文口說品質仍待外部驗收。
- 防回歸：不接受任意 URL／任意檔名；缺模型不可建立或啟動 ASR；下載 response 不符 size／SHA 不寫入正式檔；保留手動下載 URL 與 userData cache 路徑。
- 剩餘風險：尚未在 Windows 實機執行實際 148 MB／488 MB 下載、安裝權限、網路中斷／續跑與中文口說品質驗收；若下載失敗，使用者仍須依官方 URL 手動下載後重新檢查。

# SYNC-024 — GitHub Windows 測試修正同步

- 日期／版本：2026-08-06／0.48.0 測試版
- 現象：需求方表示 Windows 測試問題與修正已更新 GitHub，要求同步至目前專案。
- 核對：`git fetch --prune origin` 後，GitHub Windows Ollama 修正 `4d0bee6` 與本地 HEAD `170e08e` 的指定 runtime diff 為空，沒有重複套用；最新 `origin/main=baed6d7` 另包含 Azure OpenAI request parameter 修正。
- 修正：選擇性整合 Azure capability probe 的 `max_completion_tokens`；Azure deployment 請求移除 optimizer 內部欄位與 model；OpenAI-compatible chat completion 移除內部 operation／language／cue metadata；保留本地 Ollama streaming／timeout／repair 與 Windows 翻譯修正。
- 驗證：provider／optimizer／Ollama streaming focused tests 與完整 `npm run check` 通過；macOS／Windows 測試包三個 AI runtime source marker 與工作樹一致，ZIP 更新後需由外部 Windows 實機確認啟動與真實端點行為。
- 剩餘風險：沒有 Windows 實機或真實 Azure／Ollama endpoint 證據，不能把 GitHub commit 核對、contract mock 或本機 ZIP 同步宣稱為跨平台實機驗收。

# REL-025 — Electron／builder 供應鏈弱點阻擋發布

- 日期／版本：2026-08-10／0.48.1 發布候選
- 現象：發布前完整 `npm audit` 在 Electron 33／electron-builder 25 鎖檔回報 16 項弱點（15 high、1 critical），其中同時包含 runtime 與建置鏈風險，不能只以 production-only audit 為 0 宣稱可發布。
- 根因：專案仍鎖定 `electron@33.4.11`、`electron-builder@25.1.8`；先前供應鏈盤點已辨識需要 major 升級，但當時因相容性與跨平台封裝證據不足而延後。
- 修正：升級至 `electron@43.3.0` 與 `electron-builder@26.15.7`，保留 macOS 12 最低支援線；不升至要求 macOS 13 的 Electron 44。同步把開發／CI Node 引擎下限提高為 22.12.0，避免以不受 Electron 43 工具鏈支援的 Node 20 安裝。下載、renderer verifier 與雙平台打包沿用受控固定流程。
- 驗證：升級後完整 `npm audit --json` 為 0；`npm run check`、macOS arm64 runtime／目錄版、隔離 userData packaged renderer smoke、Windows x64 runtime／目錄版／Setup／Portable 建置均通過。封裝內版本、PE 架構、Tiny-only 模型政策與本版 Release notes 已核對。
- 防回歸：發布驗證保留 dependency tree／audit、兩平台 build、封裝 source marker、updater metadata 與 SHA 核對；未來 Electron major 升級必須重新確認最低 OS 與 packaged renderer。
- 剩餘風險：Windows 10／11 實機啟動／安裝／解除安裝與本版 macOS DMG／ZIP 乾淨安裝仍未完成；`asar:false` 為既有封裝強化債務；Windows 未 Authenticode、macOS 未 Developer ID／公證。

# BUG-021 — Breeze runtime 缺件沒有可操作處理方法

- 日期／版本：2026-08-13／0.49.0
- 現象：選取 Breeze ASR 25 後只顯示「需安裝 patched Whisper runtime」，沒有官方安裝步驟、啟動命令或重新檢查入口。
- 重現：在任務表單選擇 `breeze-asr-25`，API 回報模型有效但 `runtimeReady=false`；原前端只寫入狀態／log 後 return false。
- 根因：runtime 是不隨 App 封裝的外部 Python／patched Whisper；既有前端沒有 guide modal。初版指引又在普通 clone 後直接 pip install 空的 submodule，並在 Breeze repo 內執行本 App 的 `npm start`，無法完成實際安裝／啟動。
- 修正：新增固定非秘密的 guide API 與 runtime modal，提供 `git clone --recurse-submodules`、家目錄 venv、模型／runtime 驗證，以及本專案開發版、macOS `/Applications`、Windows NSIS 預設路徑的啟動命令；模型下載視窗與 ASR 欄位保留 persistent 指引入口；App 不自動執行 shell／pip。
- 驗證：`test-breeze-asr.mjs` 覆蓋 submodule 初始化、平台命令、安裝版啟動路徑與錯誤 cwd 負向條件；`test-core.mjs` 覆蓋 API guide；`npm run check`、UI 缺件 smoke、`npm run docs:check:final` 與 `git diff --check` 待 round2 完成後補記。
- 防回歸：後續若改動 guide，必須同步 `docs/BREEZE-ASR-25.md`、功能設計、測試稽核與本測試；不得把未安裝真實 runtime／checkpoint 的 deterministic 證據描述成模型品質或跨平台實機驗收。
- 剩餘風險：Python／git／pip／網路、第三方 submodule 供應鏈、真實 3 GB checkpoint、Windows PowerShell／macOS shell、安裝後啟動、品質／效能／長音訊／取消與 process tree 仍待外部驗收。

# BUG-022 — Breeze runtime 路徑與首頁健康卡未同步

- 日期／版本：2026-08-13／0.49.0
- 現象：macOS 畫面顯示 Breeze ASR 25 模型已就緒但缺少 patched Whisper runtime；首頁系統效能卡片的 FFmpeg／轉錄引擎／Whisper 狀態仍停留「待檢查」。
- 根因判定：runtime 探針只以通用 bundled Python 與系統命令作回退，未涵蓋使用者家目錄的標準 Breeze venv；Windows 同時存在 `HOME`／`USERPROFILE` 時可能選錯家目錄，且一般 bundled Python 可能遮蔽真正的 patched venv。首頁健康 API 成功後未呼叫既有 `updateMetrics`，因此工具狀態沒有反映最新回應。
- 修正：`resolveBreezePython` 依平台優先解析 macOS／Linux `$HOME`、Windows `USERPROFILE` 的 `Breeze-ASR-25/.venv`，並把外部 patched venv 排在一般 bundled Python 前；`server.mjs`／`electron/main.mjs` 補齊 Unix `bin/python` 工具路徑；`refreshHomeHealth` 在健康 API 成功後同步更新系統工具卡片。
- 驗證：Node syntax、`node scripts/test-breeze-asr.mjs` 與完整 `npm run check` 通過；新增 macOS／Windows 標準 venv 偵測、Windows `USERPROFILE` 優先序、外部 venv 優先 bundled Python 與首頁 `updateMetrics` source assertion。
- 防回歸：明確 `BREEZE_ASR_PYTHON` 仍優先；缺件時不自動執行安裝命令；任何新平台路徑變更須加入平台衝突與 bundled／external 優先序測試。
- 剩餘風險：本機未安裝或未執行真實 MediaTek patched runtime、3 GB checkpoint、長音訊與品質／效能；Windows process tree、macOS／Windows 乾淨安裝與自訂 runtime 路徑仍需外部驗收。

# BUG-023 — Breeze 首次選擇未立即協助設定

- 日期／版本：2026-08-18／0.49.1 修正版候選
- 現象：選取 Breeze 時只更新狀態文字，模型下載與 runtime 指引要等到提交任務才出現；選單文字也把「實驗性／需另裝 runtime」混在產品名稱中。
- 根因：ASR 選擇器 change handler 只查詢狀態並自行分支，沒有共用提交前的 `ensureBreezeAsrReady()` readiness flow；產品名稱與限制說明未分離。
- 修正：選取 Breeze 後立即共用模型／runtime readiness flow；模型缺失開啟固定官方下載對話框，下載完成後接續 runtime guide，取消仍阻止任務建立；選單改為 `Breeze ASR 25`，限制與效能風險移至說明／發布文件。
- 驗證：`scripts/test-breeze-asr.mjs` 新增 UI 文字與首次選擇 source assertions；完整回歸與獨立審查待本輪結案補記。
- 效能依據：需求方 MacBook Air `Mac15,12`／Apple M3／8 GB／8 cores／macOS `26.5.2`（Build `25F84`）處理 1:46:00 影片約需 6 小時（約 `3.4×`）；單一本機觀察，不代表品質或跨平台效能驗收。
- 剩餘風險：模型約 2.88 GiB 且 runtime 不隨包提供；低資源 CPU 可能長時間執行，仍需真實 profiler、長音訊、品質、Windows／macOS 乾淨安裝驗收。

# BUG-025 — macOS 乾淨 profile 首次啟動卡在不必要 Keychain 查詢

- 日期／版本：2026-08-20／0.50.0 macOS 測試候選
- 現象：commit `2c9612e` 的封裝可完成 DMG／ZIP、codesign 與靜態內容核對，但隔離 userData 的 packaged renderer smoke 只啟動 DevTools browser，60 秒內沒有主視窗 target；主程序未啟動 server／renderer。
- 診斷：對停滯主程序執行 1 秒 `sample`，主執行緒持續停在 Security framework 的 `SecItemCopyMatching`／Keychain 解密路徑；乾淨 userData 不含 `config/ai-keys.safe`，但 `readSecureAiKeys()` 原先先呼叫 `safeStorage.isEncryptionAvailable()`，之後才檢查檔案是否存在。
- 根因判定：不存在安全金鑰檔時仍先觸發 OS 安全儲存能力檢查；在自動化／乾淨 profile 環境可能等待 Keychain 互動，阻止 `app.whenReady()` 後續 server 與主視窗流程。
- 修正：`readSecureAiKeys()` 先解析單一 `securePath` 並檢查檔案存在；只有檔案存在時才呼叫 `safeStorage.isEncryptionAvailable()` 與 decrypt。既有金鑰檔的安全儲存語意不變。
- 防回歸：`scripts/test-electron-main.mjs` 驗證檔案存在檢查嚴格位於 safeStorage 能力檢查之前，且解密沿用同一已檢查路徑；測試納入 `npm test`。
- 驗證：focused syntax／新測試、完整 `npm run check` 通過；修正版 packaged renderer smoke 以隔離 userData 實際通過首頁、設定、Breeze 首次選擇 modal、上傳／完成、SRT、AI 校閱與資料夾事件。最終資產須在 Release notes 同步後重建並重新核對。
- 剩餘風險：尚未以既有真實加密 AI 金鑰檔重放跨版本 decrypt／Keychain 權限提示，也不等同乾淨使用者帳號 Gatekeeper 或公證驗收。

# BUG-024 — Whisper Small 輸出過長字幕 cue

- 日期／版本：2026-08-20／0.50.0 開發分支
- 現象：使用 Whisper Small 語言包時，單一 SRT cue 可能包含完整長句或超長單行文字，校閱與播放時可讀性差；原有「過長」品質篩選只標記問題，不會改善輸出。
- 重現：以 deterministic SRT `00:00:10,000 --> 00:00:16,000` 搭配超過 40 個中英文混合字元的長句呼叫 `sanitizeWhisperSrt(input, { splitLongCues: true })`；基準未啟用選項時維持單一長 cue。
- 影響：Small 的原始辨識文字雖未遺失，但超長 cue 需要人工重排；若直接截斷會造成字幕內容損失，若任意拆分又可能產生零長度／重疊時間碼或錯誤品質指標對應。
- 根因判定：Whisper SRT 清理器原先只驗證時間碼與重編號，沒有 Small 專用的顯示長度政策，也沒有在拆分後重新分配時間；品質模組的 `字幕過長` 是篩選訊號，不是輸出修正器。
- 修正：`lib/whisper-srt.mjs` 新增 opt-in `splitLongCues`；Small 輸出最多兩行、每行最多 20 字元，超過 40 字元優先依標點／空白拆成多個連續 cue，再按字數比例分配原始時段；保留完整文字，時間不足時不強拆。`server.mjs` 的 Python Whisper／Whisper.cpp Small 路徑一致啟用，Tiny／Base／Breeze 不變。
- 品質 metadata：Small cue 拆分來源以同長度陣列的 `null` 項標記，避免一個 segment 被誤當成多個新 cue；未拆分 cue 仍保存可取得的 confidence／no-speech 指標，拆分 cue 改由校閱頁既有 rule-score 重新評估。
- 驗證：`node --check lib/whisper-srt.mjs`、`node --check server.mjs`、`node scripts/test-whisper-srt.mjs`、`node scripts/test-whisper-quality.mjs`、`node scripts/test-whisper-models.mjs`、完整 `npm run check`、`npm run docs:check`、`npm run docs:check:final` 與獨立 round1／round2／round3 審查通過；測試覆蓋未啟用相容性、文字無損、正常時最多兩行／每行 20 字元、連續時間碼、零長度防護、超過 40 字元純中文 1 ms fallback 不新增空格與 partial quality metadata 邊界。
- 防回歸：後續不得以截斷、摘要或假的 quality metadata 解決長 cue；若修改字元門檻、拆分邊界或時間分配，必須同步 focused 測試、功能設計、需求／稽核與 Release notes。
- 剩餘風險：尚未以真實 Whisper Small 權重與 1:46 長音訊驗證中文斷句、閱讀速度、模型品質、品質 metadata 及 macOS／Windows 封裝後行為；過短原始 cue 會保留長文字並交由人工校閱。
