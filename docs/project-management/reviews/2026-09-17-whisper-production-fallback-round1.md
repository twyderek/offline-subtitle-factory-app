# 獨立審查報告：production-mode Whisper child-process fallback 控制流驗收

- 審查對象 commit／版本：`17df9788abf2cf964d52df10b74f9a8fcd7a45d6`／0.51.0 開發中
- 對應 08-CHANGE-LOG 條目：2026-09-17 — production-mode Whisper child-process fallback 控制流驗收（BUG-WHISPER-METAL-139）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-09-17（Asia/Taipei；本輪為獨立上下文，未沿用主要開發代理對話記憶；首個留存驗證指令時間戳為 2026-09-17T12:04:18+08:00）

## 1. 需求完整性

- 判定：部分通過（本輪限定的 production-mode controlled fallback 目標通過）。
- 證據：最新工作條目明列 `NODE_ENV=production`、無 test runner、首次 exit 139／partial SRT／JSON、Metal／CPU logs、partial 清理、`--no-gpu` retry、`ready-review`、CPU metrics、SRT／JSON 與暫存 WAV 清理為成功條件（`docs/project-management/08-CHANGE-LOG.md:3-21`）。目前狀態及測試稽核同樣把本輪定義為 deterministic wrapper 的 production 控制流，並明確寫出 `bundledRuntimeUsed=false`、不代表 bundled `whisper-cli` 實機 fallback（`docs/project-management/00-CURRENT-STATUS.md:23-28,108`；`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:43-49`）。
- FR-003／FR-022／NFR-005 的需求邊界可追溯：離線 Whisper.cpp、SRT／JSON、部分完成與 fallback 契約分別記錄於 `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:19,38,58-61`，功能設計也限定三模型共用 SRT／JSON、取消與 Metal→CPU fallback（`docs/project-management/03-FUNCTIONAL-DESIGN.md:45-51,109-111`）。
- 缺口不在本輪 controlled acceptance 的條件，而在更廣的實機門檻：產品 server 的 bundled run 證據是 `fallbackObserved=false`（`docs/project-management/evidence/2026-09-17-whisper-real-server-fallback.json:32-68`），不可據此關閉 bundled crash→CPU fallback。

## 2. 邏輯正確性

- 判定：通過。
- 證據：server 只在 `NODE_ENV === 'test'` 時讀取 Whisper test runner；production mode 不會啟用該注入路徑（`server.mjs:46-55`）。Whisper.cpp 在 macOS arm64 且未 force CPU 時使用 Metal，child process 使用 `shell:false`；退出非零時由 `shouldRetryWhisperOnCpu` 判斷，刪除 `.srt`／`.json`，記錄 `Metal exit <code>` 與 `CPU fallback`，再以 `forceCpu=true`遞迴 retry（`server.mjs:2047-2105,2166-2184`；`lib/whisper-fallback-policy.mjs:1-3`）。
- `buildWhisperCppArgs` 明確加入 `-osrt`、`-oj`、`-ojf`、輸出 base 與 threads，只有 force CPU 時加入 `--no-gpu`（`lib/whisper-models.mjs:103-115`）。成功路徑會驗證 SRT、清理／解析 JSON，並將 draft 寫入；job 最終只在有效 draft 存在後進入 `completed`／`ready-review`（`server.mjs:2186-2229,1676-1725`）。
- wrapper 的一次性控制與 fixture 的 partial 行為互相吻合：wrapper 僅在非 `--no-gpu` 且 crash marker 不存在時建立 marker（`scripts/verify-whisper-production-fallback.mjs:151-168`）；fixture 看到 marker 時寫 partial SRT／JSON、記錄首次 marker 並 exit 139，帶 `--no-gpu` 才走成功輸出（`scripts/fixtures/mock-whisper-cpp-runtime.mjs:17-45`）。

## 3. 邊界情況

- 判定：部分通過
- 證據：已實際覆蓋的邊界：production verifier 會拒絕 Windows 路徑、缺 fixture／FFmpeg／Tiny、會建立隔離 tools tree，使用生成的 1 秒 16 kHz mono silence WAV，並固定 `NODE_ENV=production`、暫存資料目錄與空 AI secrets（`scripts/verify-whisper-production-fallback.mjs:139-200`）。它會重新讀取 server 實際 port file，避免 requested port 與實際 port 不一致（同檔 `:57-67,75-88`）。
- partial 清理的防回歸是具體的：server retry 前刪除 output base 的 SRT／JSON（`server.mjs:2174-2180`）；fixture 若 CPU retry 仍看到任一 partial output，會建立 `whisper-cpp-stale-partial-output`（`scripts/fixtures/mock-whisper-cpp-runtime.mjs:27-29`）；verifier 掃描該 marker 與 `.partial`／`.tmp`／`.download` 命名並要求清單為空（`scripts/verify-whisper-production-fallback.mjs:218-262`）。既有核心測試另覆蓋取消後的音訊、SRT、JSON 與 quality metadata 清理（`scripts/test-core.mjs:794-804`）。
- 未由本輪 production evidence 覆蓋：CPU retry 再次失敗時的 partial cleanup、取消恰發生於 retry 交界、timeout／process-tree、其他架構／Windows、port collision，以及 evidence write／cleanup failure 的動態重播。`runWhisperCpp` 的取消邏輯存在，但現有 production verifier 只驗證成功 retry；這些仍應列為後續風險，不可由本次 pass 推廣。
- port file 與暫存清理設計合理但觀測不完整：server 將 `offline-subtitle-port.tmp` 寫入 `TEMP`，probe 從同一隔離 data dir 讀取；最終 nested `finally` 移除整個 temp root（`server.mjs:4742-4753`；`scripts/verify-whisper-production-fallback.mjs:271-283`）。evidence 沒有單獨保存 `portFileCreated`／`portFileCleaned` 斷言，且 stale 掃描只針對已知 partial 命名，屬證據完整性風險而非本次成功路徑的失敗。

## 4. 程式碼品質

- 判定：通過（保留小幅可觀測性風險）。
- 證據：probe 使用唯一暫存 root、loopback API、明確 child environment、不繼承 test runner 語意、生成非使用者音訊，並以 `requireOk` 將每個驗收條件轉成失敗；`stopProcess` 有 SIGTERM／SIGKILL 上限（`scripts/verify-whisper-production-fallback.mjs:14-32,173-200`）。
- evidence 先在啟動前拒絕既有輸出，寫入時再次檢查並使用 `flag: 'wx'`，而且 write failure 仍經 nested `finally` 清理 temp root（`scripts/verify-whisper-production-fallback.mjs:11-12,264-283`）。這符合 exclusive evidence、不得覆寫既有證據及不把失敗寫成 pass 的要求。
- server 的 fallback 產品邏輯未被本輪 probe 改寫；production verifier 只替換隔離 tools tree 的 Whisper executable wrapper，bundled FFmpeg／Tiny model 以 symlink 提供，證據也保留其 controlled fixture 類型與 `bundledRuntimeUsed=false`（`scripts/verify-whisper-production-fallback.mjs:118-135,146-170`）。
- 可改善處：artifact 的 metrics 只保存 `asrEngine`、`whisperDevice`、`modelName`，未保存 server 已設定的 `cpuThreads`（`scripts/verify-whisper-production-fallback.mjs:231-237` 對照 `server.mjs:2057-2077`）；port file 與 temp root 清理亦只有程式保證、沒有獨立欄位。這不改變 `whisperDevice=cpu` 的本輪判定，但降低日後追溯精度。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：實際執行（2026-09-17T12:04:18+08:00）：`node --check scripts/verify-whisper-production-fallback.mjs`、`node --check scripts/fixtures/mock-whisper-cpp-runtime.mjs`、`node --check server.mjs`、`node scripts/test-whisper-fallback-policy.mjs`、`node scripts/test-whisper-quality.mjs` 與 `git diff --check` 均 exit 0；focused fallback 輸出確認平台／架構／forceCpu／退出碼矩陣，quality 輸出確認 JSON 解析、時間對應與缺失回落。
- `scripts/test-whisper-models.mjs:53-70` 覆蓋 `--no-gpu`、model／audio／output args、SRT／JSON；`scripts/test-core.mjs:644-663` 覆蓋 macOS arm64 server fixture 的首次 139 marker、CPU metrics、`ready-review`、draft 與 stale partial 反證；`scripts/test-whisper-fallback-policy.mjs:4-10` 覆蓋平台、架構、forceCpu 與退出碼邊界。既有主要代理工作紀錄也記載 production probe exit 0、完整 `npm run check` 與 `docs:check` 通過（`docs/project-management/08-CHANGE-LOG.md:14-15`）。
- 本輪獨立執行 `npm run check` 未完成：`docs:check` 與前段 tests 均通過，`test-core.mjs` 在建立其 `0.0.0.0:22779` local listener 時收到 sandbox `EPERM`，故該次 command exit 1；這是本審查環境權限限制，不是產品 assertion 失敗。另未見專門鎖定 production verifier source contract 的自動測試，production pass 主要由保存 evidence、source review 與主要代理已記錄的 probe 結果支持。

## 6. 實際運行結果

- 判定：部分通過
- 證據：production controlled acceptance 的保存 evidence 於 `2026-09-17T03:16:37.709Z`（Asia/Taipei 11:16:37）啟動，完成於 03:16:39Z，`status=pass`；server 為 production、loopback、`testRunnersDisabled=true`，requested／actual port 均為 24849（`docs/project-management/evidence/2026-09-17-whisper-production-fallback.json:1-5,26-31,59-65`）。
- 實際 job 為 `completed`／`ready-review`，metrics 為 `asrEngine=whisper.cpp`、`whisperDevice=cpu`、`modelName=tiny`；logs 同時有 `metalExit139=true`、`cpuFallback=true`、首次 crash marker；draft SRT、Whisper.cpp SRT／JSON 均存在，stale partial 清單為空，Whisper input 已清理（同 evidence `:33-57`）。
- evidence 明確寫 `controlledRuntime.type=deterministic-whisper-cpp-wrapper`、`bundledRuntimeUsed=false`，輸入是生成 silence WAV、未讀使用者媒體，external network=false，LM Studio 是明確 scope exception（同 evidence `:11-24,59-64`）。因此它是有效的 production-mode child-process 控制流證據，但不是 bundled `whisper-cli` 實機結果。
- 交叉核對的 bundled 實機證據顯示：直接 bundled CLI 在相同 macOS arm64 host 的 Metal 路徑 exit 139 且無 SRT／JSON，`--no-gpu` 路徑 exit 0 並產出 SRT／JSON（`docs/project-management/evidence/2026-09-17-whisper-bundled-runtime-recheck.json:24-48`）；然而同一產品 server run 是 `whisperDevice=metal`、`metalExit139=false`、`cpuFallback=false`（`docs/project-management/evidence/2026-09-17-whisper-real-server-fallback.json:25-61`）。兩者不可合併或互相冒充。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪 production-mode Whisper child-process fallback 控制流 round1 獨立審查有條件通過：在 `NODE_ENV=production` 且 test runner 關閉的限定 deterministic wrapper 驗收中，首次受控 exit 139／partial SRT／JSON、Metal／CPU fallback logs、partial 清理、`--no-gpu` CPU retry、`whisperDevice=cpu`、`ready-review`、SRT／JSON 與暫存 WAV 清理均有 evidence 支持；但此結論不代表 bundled `whisper-cli` 真實 crash→CPU fallback 已完成，該實機門檻仍未驗收。**
- 阻擋問題（若有）：目前沒有在同一次 production server run 取得 bundled `whisper-cli` exit 139 後自動 CPU fallback 的 evidence；`2026-09-17-whisper-real-server-fallback.json` 明確為 `fallbackObserved=false`。若需求是關閉真實 bundled server fallback，此項仍是阻擋，不能以本報告的 controlled pass 解除。
- 審查條件／剩餘風險：本審查環境的完整 `npm run check` 因 sandbox `EPERM` 未能獨立完成，主要代理既有完整回歸紀錄僅作交叉證據；CPU retry 失敗、retry 取消／timeout、port collision／port file 清理欄位、其他 macOS 架構、Windows、長音訊、中文品質、quality metadata、乾淨安裝與發布仍未驗收。LM Studio 依明確 scope exception 未執行。
- 給主要開發代理的具體修正要求：本輪 controlled flow 不要求立即修改產品程式；結案真實 runtime 門檻前，應在同一次 production server run 重現 bundled Metal exit 139 並保存 CPU fallback evidence。若要提高證據可追溯性，後續 probe 應記錄 `cpuThreads`、port file 與 temp-root cleanup 狀態，並補 CPU retry failure／取消競態的 production-mode deterministic coverage。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
