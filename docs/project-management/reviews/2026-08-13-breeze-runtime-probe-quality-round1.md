# 獨立審查報告：Breeze runtime probe 診斷訊息品質修正（FR-024）

- 審查對象 commit／版本：`eb54cb4`（`codex/breeze-model-planning`，含未提交工作樹差異）／0.48.1。
- 對應 08-CHANGE-LOG 條目：2026-08-13 — Breeze runtime probe 診斷訊息品質修正（FR-024）（`docs/project-management/08-CHANGE-LOG.md:16-36`）。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-08-13 07:24 CST（Asia/Taipei）；由主要代理另行啟動的獨立上下文，未沿用開發代理對話記憶。

## 1. 需求完整性

- 判定：部分通過。
- 證據：FR-024 規定外部 runtime 應以 `whisper.available_models()` 檢驗 Breeze 能力、缺件不得假成功（`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:40`）；本輪未改變該 probe command，既有契約仍在 `scripts/test-breeze-asr.mjs:36` 斷言。NFR-002 要求 API Key／憑證不得進一般設定、回應、repo 或日誌（`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:47`）。
- 證據：工作紀錄目標是「敏感鍵值以可讀且不洩漏值的固定遮罩輸出」（`docs/project-management/08-CHANGE-LOG.md:25`）；實作以捕獲的 key 與分隔符替代值（`lib/breeze-runtime-probe.mjs:7-10`），對一般單字值符合。但引號內帶空白的 secret 尾段會進入回應，見第 3 節實測；因此 NFR-002 未完整滿足。

## 2. 邏輯正確性

- 判定：部分通過。
- 證據：新 replacement pattern 使用三個捕獲群組，將 `$1$2` 回填為實際 key 與 `=`／`:` 分隔符（`lib/breeze-runtime-probe.mjs:10`），可修正前版將 `$1` 當成字面文字的問題。focused regression 的預期與實際皆為 `ImportError: token=<redacted> password:<redacted> api-key=<redacted>`（`scripts/test-breeze-asr.mjs:78-84`）；2026-08-13 07:25:19 CST 執行 `node scripts/test-breeze-asr.mjs` 通過。
- 證據：診斷會先呼叫 `redactProbeText` 再萃取 ImportError，並保留最多 240 字元（`lib/breeze-runtime-probe.mjs:13-19`）。這個流程本身正確地套用遮罩，但正則值段 `[^\s,;]+`（非空白、逗號、分號）在空白處結束；未遮罩的引號內容因此仍由 ImportError 摘要回傳。

## 3. 邊界情況

- 判定：不通過。
- 證據：已通過的 deterministic 邊界是三種 key（`token`、`password`、`api-key`）及 `=`／`:` 分隔符、無空白的值；測試只驗證這一組輸入（`scripts/test-breeze-asr.mjs:78-84`），未涵蓋引號、空白或多字 token 值。
- 實際測試：2026-08-13 07:25:24 CST，在專案根目錄執行：

  ```sh
  node --input-type=module -e 'import { runBreezeRuntimeProbe } from "./lib/breeze-runtime-probe.mjs"; const result = await runBreezeRuntimeProbe({ command: process.execPath, probeArgs: ["-e", "console.error(\\"ImportError: token=\\\\\\"secret LEAK_MARKER\\\\\\"\\")"], timeoutMs: 1000 }); console.log(JSON.stringify(result));'
  ```

  實際輸出 `{"ok":true,"code":0,"timedOut":false,"stdout":"","stderr":"ImportError: token=<redacted> LEAK_MARKER\\\"","elapsedMs":26}`。原始敏感值後半的 `LEAK_MARKER` 出現在 `stderr` 回應，證明空白分隔的引號值未完全遮罩。此為 NFR-002 阻擋問題。
- 證據：原有任意診斷的 privacy omission 仍由 `SECRET_MARKER`／本機路徑案例測試（`scripts/test-breeze-asr.mjs:74-77`）且 `summarizeProbeText` 對非 ModuleNotFoundError／ImportError 回傳固定 omission（`lib/breeze-runtime-probe.mjs:15-19`）；該 fallback 不涵蓋本次 ImportError 分支。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：差異極小、無無關程式變動；`git diff --check` 於 2026-08-13 07:26:08 CST 通過，且改動保留原有 chainable pure helper 結構（`lib/breeze-runtime-probe.mjs:7-20`）。文件也說明了字面 `$1=<redacted>` 問題與預期輸出（`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:149-154`）。
- 證據：安全遮罩使用「遇空白即停止」的否定字元類別，與可包含空白的 quoted runtime diagnostic 不相容；而 ImportError 特別分支會回傳 redacted text，故品質不足以支撐「敏感值不得進回應」的安全契約。應採用能完整處理 quoted／escaped value 的解析或在 ImportError 分支採更保守的 key-value 區段省略策略，並納入負向測試。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據（實際指令與時間戳）：
  - 2026-08-13 07:25:19 CST：`node --check lib/breeze-runtime-probe.mjs`、`node --check scripts/test-breeze-asr.mjs`、`node scripts/test-breeze-asr.mjs` 全部通過；focused test 覆蓋固定模型契約、runtime timeout、路徑 omission 與新增的無空白 ImportError key-value case（`scripts/test-breeze-asr.mjs:18-87`）。
  - 2026-08-13 07:25:30 CST：沙箱內 `npm run check` 通過 `docs:check` 及除 `scripts/test-core.mjs` 外的所有列出測試，但 core fixture listener 在 `0.0.0.0:22838` 失敗，錯誤為 `listen EPERM`；屬 sandbox 網路限制。
  - 2026-08-13 07:25:43 CST：經授權在沙箱外重跑同一 `npm run check`，完整通過，含 `scripts/test-breeze-asr.mjs` 與核心 API 回歸。
- 證據：完整回歸未捕獲此問題，因沒有 quoted whitespace credential 的負向案例。2026-08-13 07:25:24 CST 的獨立實測重現洩漏（第 3 節）證明測試覆蓋仍不足。

## 6. 實際運行結果

- 判定：部分通過。
- 證據：2026-08-13 07:25:59 CST 執行 `npm run probe:breeze -- --json`。實際狀態為 `python3` 可啟動、`ModuleNotFoundError: No module named whisper`、模型 `missing`、`ready: false`；符合 FR-024 缺 external runtime／checkpoint 不得假成功的要求，且本次未下載模型或安裝 runtime。probe command 只讀取並輸出 report（`scripts/probe-breeze-asr.mjs:16-35`），report 將 Python 和模型路徑縮為 basename（`lib/breeze-runtime-probe.mjs:74-86`）。
- 證據：2026-08-13 07:26:08 CST 執行 `npm run docs:check:final` 如預期未通過，原因為最新工作紀錄仍是「進行中」且有「待執行」欄位（`docs/project-management/08-CHANGE-LOG.md:18,30-33`）；這是尚未結案的流程狀態，不是本次程式驗證失敗。相同時間 `git diff --check` 通過。

## 綜合判定

- 結論：不通過。
- 阻擋問題（若有）：**FR-024 Breeze runtime probe 診斷訊息品質修正 round1 獨立審查判定為不通過：雖然無空白值的 `token`／`password`／`api-key` 已改為保留實際鍵名與分隔符的 `<redacted>`，但 2026-08-13 07:25:24 CST 的獨立實測證實，引號內含空白的 token 值仍將其尾段 `LEAK_MARKER` 寫入 probe `stderr` 回應，違反 NFR-002「API Key 與簽章憑證不得進一般設定、回應、repo 或日誌」；在修正此洩漏、補齊負向回歸並完成複審前，不得結案或宣稱本輪敏感鍵值遮罩已完成。**
- 剩餘風險：除上述阻擋項外，真實 3 GB checkpoint、官方 patched Whisper／PyTorch runtime、真實音訊品質、效能、長音訊、Windows process tree 與跨平台安裝後流程，仍未驗證（`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:153-154`）。本輪未下載或安裝上述元件。
- 給主要開發代理的具體修正要求（若有）：
  1. 修正 `redactProbeText`，使單／雙引號包住且可包含空白的敏感 key-value 整段都不會通過 `summarizeProbeText` 的 ImportError 回應；同時保持既有 key 名與原分隔符的可讀輸出。
  2. 在 `scripts/test-breeze-asr.mjs` 加入本報告第 3 節的 quoted whitespace token 回歸，斷言完整原值及其可識別片段皆不在 `stderr`；並酌情加入 escaped quote、newline／多個 key-value 的邊界。
  3. 重跑 focused test、完整 `npm run check`、`git diff --check`；更新工作紀錄後執行 `npm run docs:check:final`，再建立 round2 獨立複審報告，不得修改本 round1。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
