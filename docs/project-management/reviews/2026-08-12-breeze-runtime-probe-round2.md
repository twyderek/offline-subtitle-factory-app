# 獨立複審報告：Breeze runtime／模型外部驗收探針（FR-024）

- 審查對象 commit／版本：分支 `codex/breeze-model-planning`；HEAD `9cdadc613c11b0fe189ebe0f336ccc9c9e32701f`；工作樹含本輪未提交 FR-024 變更與 round1 報告
- 對應 08-CHANGE-LOG 條目：`2026-08-12 — Breeze runtime／模型外部驗收探針（FR-024）`
- 前輪報告：`docs/project-management/reviews/2026-08-12-breeze-runtime-probe-round1.md`
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-08-12 15:58（Asia/Taipei）；由主要代理以獨立子代理上下文重新啟動，未沿用主要代理對話記憶
- 審查環境：macOS、Node.js `v22.22.3`；未下載 3 GB checkpoint，未安裝 Python／PyTorch／patched Whisper runtime

## Round1 條件複審摘要

- 專用 CLI probe 的 round1 P1 已解除：timeout 現在在 POSIX 以 detached child process group 的負 PID 發送 SIGKILL，在 Windows 啟動 `taskkill /T /F`，並等待 child `close` 後才 resolve（`lib/breeze-runtime-probe.mjs:35-71`）。
- round1 P2 已解除（就報告輸出而言）：Python／模型目錄／模型檔案只輸出 basename（`lib/breeze-runtime-probe.mjs:74-86`）；stdout、stderr、error 經安全摘要，非 ImportError／ModuleNotFoundError 的診斷改為 privacy omission（`lib/breeze-runtime-probe.mjs:7-20,48-52`）。
- 仍有一項未解除的 P1 範圍問題：正式 server 的 Breeze capability path 仍使用 `lib/process-probe.mjs:5-24`，而 `server.mjs:908-924` 呼叫它；該 helper timeout 仍只 kill 直接 child、立即 resolve，且未 detached／process-tree cleanup。故整個 FR-024 runtime command 路徑不能宣稱 round1 P1 已完全關閉。

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:40` 與 `docs/project-management/03-FUNCTIONAL-DESIGN.md:61-63` 要求固定模型契約、`whisper.available_models()` 能力檢查、缺件阻擋、Whisper.cpp 預設及外部 runtime 不隨包提供。專用 `runBreezeRuntimeProbe` 已提供 timeout／cleanup／報告聚合；`buildBreezeRuntimeProbeArgs()`（`lib/breeze-asr.mjs:61-63`）仍檢查模型能力。
- round1 P1 的 CLI 分支已有可重播證據，但 server 啟動／健康檢查實際仍走 `probeCommand`（`server.mjs:919-924`），所以正式 runtime capability 行為未完整套用同一 cleanup 契約。這是需求完整性剩餘條件，不是模型品質缺口。
- Whisper.cpp 預設未變：`public/index.html:217-218` 仍選取內建 Whisper.cpp，`server.mjs:862-863` 未指定引擎時回退 `whisper-cpp`，`lib/whisper-models.mjs:29,43` 預設模型仍為 `tiny`。

## 2. 邏輯正確性

- 判定：部分通過
- 已修正證據：`lib/breeze-runtime-probe.mjs:42` 以 POSIX `detached:true` 建立 process group；timeout 分支（:54-66）使用 POSIX `process.kill(-child.pid, 'SIGKILL')`，Windows 使用 `taskkill /pid <pid> /T /F`，並將 resolve 綁在 child `close`（:65-70）。`collectBreezeRuntimeProbe` 將 `ready` 聚合為模型 valid 且 runtime ok（:74-86）。
- 2026-08-12 15:59:09–15:59:10 的真實 process 測試讓 probe child 啟動持續執行 descendant；timeout 後結果為 `timedOut:true`、`descendantAliveAfterTimeout:false`，證明專用 POSIX group kill 有效。
- 2026-08-12 15:59:19–15:59:21 的注入 mock child 測試讓 `close` 在 kill 後延遲約 700 ms；probe 約 960 ms 才回傳 `timedOut:true`，證明不再於 close 前 settle。
- 未解除證據：`lib/process-probe.mjs:18-21` timeout 仍 `child.kill('SIGKILL'); finish(false)`；2026-08-12 16:00:20–16:00:22 以同樣 descendant fixture 實測 `probeCommand` 回傳 false 但 `descendantAliveAfterTimeout:true`。server 使用此 helper，故正式 capability probe 仍有 process-tree 泄漏風險。

## 3. 邊界情況

- 判定：部分通過
- 已覆蓋與實測：
  - 2026-08-12 15:58:57–15:58:58：`npm run probe:breeze -- --json` 以預期 exit 1 回報 `python3`、`ModuleNotFoundError: No module named whisper`、模型 `reason:"missing"`、`ready:false`；輸出 Python／model directory／model path 均為 basename。
  - 2026-08-12 15:59:09：POSIX process group descendant cleanup 成功。
  - 2026-08-12 15:59:19：延遲 close 需等 close 後才完成。
  - 2026-08-12 15:59:30–15:59:31：自訂 `/Users/example/.venv/bin/python` 與 `/Users/example/private/breeze-cache` 聚合結果只輸出 `python`／`breeze-cache`；不存在 executable 的 error 亦為 `runtime probe returned diagnostic output (omitted for privacy)`。
  - 同一實測以 stderr `SECRET_MARKER /Users/example/private token=abc password=xyz` 執行，輸出為 `runtime probe returned diagnostic output (omitted for privacy)`；marker、路徑與 token 未進報告。
- 未覆蓋／未解除：Windows 真實 `taskkill /T /F`／descendant、taskkill 失敗或延遲、server `probeCommand` process-tree、真實 3 GB hash、官方 runtime、磁碟不足與 runtime 大量輸出。另 `ImportError` 摘要的 secret replacement 目前可能出現字面 `$1=<redacted>`（不洩漏值但訊息品質不佳），未構成 round1 P2 的敏感洩漏。

## 4. 程式碼品質

- 判定：部分通過
- 證據：`redactProbeText／summarizeProbeText`（`lib/breeze-runtime-probe.mjs:7-20`）限制 stderr／stdout／error 為固定安全摘要；`collectBreezeRuntimeProbe`（:74-86）以 `path.basename` 移除絕對路徑；timeout 有 POSIX／Windows 分支與 `close` lifecycle。
- 品質剩餘問題：server 仍維護另一套未清理的 `process-probe` 終止語意，造成 CLI 與正式健康檢查的可靠性不一致；建議共用同一個可測試的 process-tree helper。ImportError replacement 應改用實際捕獲群組或固定 `<redacted>`，避免輸出 `$1` 文字。

## 5. 測試覆蓋

- 判定：部分通過
- 2026-08-12 15:58:49–15:58:51：`node --check lib/breeze-runtime-probe.mjs && node --check scripts/probe-breeze-asr.mjs && node --check scripts/test-breeze-asr.mjs` exit 0；`node scripts/test-breeze-asr.mjs` exit 0。測試含 timeout elapsed、basename、redaction marker 與既有模型／CLI 契約。
- 2026-08-12 15:58:57–15:58:58：`npm run probe:breeze -- --json` 預期缺件 exit 1，未下載／安裝外部元件。
- 2026-08-12 16:00:28–16:00:38：sandbox 內 `npm run check` 因受控環境禁止 `0.0.0.0:22661` listener（EPERM）exit 1；2026-08-12 16:00:59–16:01:22 以核准 loopback 權限重跑同一指令，完整回歸 exit 0。
- 2026-08-12 16:01:27–16:01:28：`git diff --check` exit 0，分支仍為 `codex/breeze-model-planning`。
- 覆蓋缺口：新增測試驗證專用 `runBreezeRuntimeProbe`，但沒有驗證 server 實際使用的 `probeCommand` child cleanup；沒有 Windows 實機 process-tree、模型／runtime／音訊品質或效能測試。因此不能將 full FR-024 外部驗收標示為無條件通過。

## 6. 實際運行結果

- 判定：部分通過
- 專用 CLI probe 的 timeout、close wait、POSIX descendant cleanup 與 privacy summary 均有實際執行證據；缺件 CLI 以非零狀態結束且不啟動字幕任務。
- server helper 的相同 descendant 實測仍顯示 `descendantAliveAfterTimeout:true`，因此正式 server 的 capability probe 仍可能在 timeout 後留下外部子程序。
- 沒有下載真實 checkpoint、安裝官方 Python／PyTorch／patched Whisper、執行真實音訊、Windows／macOS 安裝後流程；這些仍是本輪明確剩餘風險。

## 綜合判定

- 結論：有條件通過
- 阻擋問題：round1 P1 在新增的 `runBreezeRuntimeProbe` CLI 路徑已解除，但 server 仍使用未修正的 `lib/process-probe.mjs`；須將 capability probe 改用相同 process-group／Windows tree-kill／close-wait 契約，補上 helper 的 descendant／延遲 close 測試，再進行下一輪複審。P2 的絕對路徑與 raw diagnostic 洩漏已解除；ImportError `$1` 顯示問題建議修正但不是敏感資訊阻擋。
- 剩餘風險：真實 Windows process tree、3,087,008,569-byte checkpoint、官方 patched runtime／PyTorch、台灣華語／中英混用品質、字幕對齊、CPU／CUDA 效能／記憶體、長音訊、磁碟空間與兩平台安裝後流程均未驗證；deterministic probe／mock 不可取代外部驗收。
- 可逐字引用完整結論句：**FR-024 Breeze runtime／模型外部驗收探針 round2 判定為有條件通過：新增的 `runBreezeRuntimeProbe` 已以 POSIX process-group／Windows tree-kill、child close 等待與安全 basename／診斷摘要解除 round1 CLI probe 的兩項主要缺口，且 focused／完整回歸均通過；但正式 server 的 Breeze capability path 仍使用未修正的 `lib/process-probe.mjs`，實測 timeout 後 descendant 仍存活，因此在共用相同 process-tree cleanup 契約、補齊 helper 測試並完成下一輪複審前，不得宣稱 FR-024 runtime probe 或真實外部驗收完整通過。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
