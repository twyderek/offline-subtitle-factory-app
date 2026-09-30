# 獨立複審報告：Breeze runtime／模型外部驗收探針（FR-024）

- 審查對象 commit／版本：分支 codex/breeze-model-planning；HEAD 9cdadc613c11b0fe189ebe0f336ccc9c9e32701f；工作樹含本輪未提交 FR-024 變更與前兩輪報告
- 對應 08-CHANGE-LOG 條目：2026-08-12 — Breeze runtime／模型外部驗收探針（FR-024）
- 前輪報告：docs/project-management/reviews/2026-08-12-breeze-runtime-probe-round2.md
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-08-12 16:06（Asia/Taipei）；由主要代理以獨立子代理上下文重新啟動，未沿用主要代理對話記憶
- 審查環境：macOS、Node.js v22.22.3；未下載 3 GB checkpoint，未安裝 Python／PyTorch／patched Whisper runtime

## Round2 條件複審

- round2 唯一阻擋已解除：lib/process-probe.mjs:10 現以 POSIX detached process group 啟動；timeout（:19-29）對負 PID 發送 SIGKILL，Windows 使用 taskkill /T /F；child close（:30）後才回傳。
- 2026-08-12 16:06:35–16:06:36 實際 descendant 測試以 probeCommand 啟動持續執行子孫程序，結果為 result:false、elapsed:324 ms、descendantAliveAfterTimeout:false。正式 server 的 getBasicToolsStatus（server.mjs:918-924）使用此共用 helper，因此 round2 指出的 server path cleanup 條件已解除。
- 專用 lib/breeze-runtime-probe.mjs 仍保有相同 POSIX／Windows／close-wait 契約（:42,54-70）；兩條 runtime probe path 的終止語意已一致。

## 1. 需求完整性

- 判定：通過（限 experimental/deterministic 整合）
- 證據：FR-024 需求（docs/project-management/02-REQUIREMENTS-ANALYSIS.md:40）及設計（docs/project-management/03-FUNCTIONAL-DESIGN.md:61-63）要求固定模型契約、whisper.available_models() 能力檢查、缺件阻擋及 Whisper.cpp 預設。專用 probe 與 server 共用 probe 均有 timeout、process cleanup 與 close-wait；buildBreezeRuntimeProbeArgs（lib/breeze-asr.mjs:61-63）仍檢查 breeze-asr-25。
- 缺件 CLI 仍以非零狀態結束；Whisper.cpp 預設未變（public/index.html:217-218、server.mjs:862-863、lib/whisper-models.mjs:29,43）。本輪不把真實 runtime／模型品質當作完成條件。

## 2. 邏輯正確性

- 判定：通過（本機可執行範圍）
- lib/process-probe.mjs:19-30 將 timeout 狀態保留至 child close，避免 timeout 後立即 resolve；POSIX 負 PID kill 可終止 process group，Windows 分支呼叫 taskkill /T /F 並以 child close 作為完成訊號。
- lib/breeze-runtime-probe.mjs:54-70 同樣在 timeout 後等待 child close；collectBreezeRuntimeProbe（:74-86）以模型 valid 與 runtime ok 聚合 ready，並輸出 basename／安全摘要。
- 2026-08-12 16:06:35 descendant 實測證明正式共用 helper 的 child 與 descendant 都已終止；不存在 round2 的 server helper cleanup 缺口。

## 3. 邊界情況

- 判定：部分通過
- 2026-08-12 16:06:19–16:06:22：node --check（process-probe、runtime probe、test-breeze）與 node scripts/test-breeze-asr.mjs 均 exit 0；focused 測試含共用 probe timeout elapsed >= 200 ms、專用 timeout close-wait、redaction marker、basename 與模型契約。
- 2026-08-12 16:06:35：正式 probeCommand descendant timeout 測試結果 descendantAliveAfterTimeout:false。
- 2026-08-12 16:06:44–16:06:46：npm run probe:breeze -- --json 預期 exit 1，回報 python3、ModuleNotFoundError: No module named whisper、模型 reason missing、ready false；輸出為 basename 且未啟動任務。
- 未覆蓋：Windows 真實 taskkill /T /F 與 process tree、kill 失敗／延遲、真實 3 GB hash、官方 runtime／PyTorch、真實音訊、磁碟不足、長音訊與跨平台安裝。這些是明確剩餘風險，不是 deterministic cleanup 失敗。

## 4. 程式碼品質

- 判定：通過（本機可執行範圍）
- 兩個 helper 均有明確 timeout state、平台分支及 close lifecycle；server 不再使用 round2 指出的舊立即 settle 行為。專用 report 仍以 basename 與安全摘要降低絕對路徑／raw stderr 洩漏。
- 保留的小品質事項：ImportError 摘要的 redactProbeText replacement 可能顯示字面 $1=<redacted>；不洩漏敏感值，但可在後續清理訊息品質。此事項不阻擋本輪結論。

## 5. 測試覆蓋

- 判定：通過（deterministic／本機可執行範圍）
- 2026-08-12 16:06:19–16:06:22：node --check 與 node scripts/test-breeze-asr.mjs exit 0。
- 2026-08-12 16:06:35–16:06:36：共用 probeCommand descendant cleanup 實測通過。
- 2026-08-12 16:06:44–16:06:46：probe:breeze 缺件非零報告實測；未下載或安裝任何外部元件。
- 2026-08-12 16:06:55–16:07:02：sandbox npm run check 因受控環境禁止 0.0.0.0:22643 listener（EPERM）exit 1；2026-08-12 16:07:12–16:07:30 以核准 loopback 權限重跑，完整 npm run check exit 0。
- 2026-08-12 16:07:39–16:07:41：git diff --check exit 0，分支仍為 codex/breeze-model-planning。
- 未覆蓋 Windows 實機與真實 runtime／模型／音訊品質；不得把完整回歸或 mock 證據擴張為這些外部驗收。

## 6. 實際運行結果

- 判定：部分通過
- 正式 server 所用 probeCommand 已實際驗證 timeout 後 child／descendant 均不存活；專用 CLI probe 仍通過缺件非零與安全報告驗證。
- 完整 npm run check 在核准 loopback 環境 exit 0，包含 Breeze、Whisper、核心 API／取消與既有回歸。
- 沒有真實 checkpoint、官方 patched runtime／PyTorch、Windows／macOS 安裝後流程或真實台灣華語／中英混用品質證據；Breeze 仍只能標示實驗性。

## 綜合判定

- 結論：通過（限 FR-024 experimental/deterministic runtime-probe 整合範圍）
- 阻擋問題：無；round2 的正式 server 共用 helper descendant cleanup／close-wait 條件已解除。
- 剩餘風險：真實 Windows taskkill／process tree、3,087,008,569-byte checkpoint、官方 Python／PyTorch／patched Whisper、台灣華語／中英混用品質、字幕對齊、CPU／CUDA 效能／記憶體、長音訊、磁碟空間與兩平台安裝後流程均未驗證；deterministic probe 不可取代外部品質驗收。
- 可逐字引用完整結論句：**FR-024 Breeze runtime／模型外部驗收探針 round3 獨立複審判定為通過，且僅限本輪 experimental/deterministic runtime-probe 整合範圍：專用 probe 與正式 server 共用的 probeCommand 均已採 process-group／Windows tree-kill、child close 等待與缺件非零契約，2026-08-12 descendant 實測確認 timeout 後 child 與子孫程序均已終止，focused／完整回歸亦通過；但真實 Windows process tree、checkpoint、官方 runtime、音訊品質、效能與安裝後流程仍未驗證，Breeze 不得因此被描述為正式品質或跨平台外部驗收已完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
