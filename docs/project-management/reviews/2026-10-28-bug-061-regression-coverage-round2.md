# 獨立複審報告：BUG-061 BUG-060 regression coverage hardening

- 審查對象 commit／版本：目前最新 worktree、專案版本 `0.52.0`；本輪沒有指定 commit，審查包含目前未提交 source／test／治理差異。
- 對應 08-CHANGE-LOG 條目：2026-10-28 — BUG-060 Ollama routing／schema regression coverage hardening（BUG-061）
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-10-28（Asia/Taipei）；重新由目前 worktree 啟動的獨立只讀上下文，先執行 `npm run project:preflight -- --type=full`，重新讀取 `AGENTS.md`、`docs/project-management/README.md`、固定核心與 full 路由文件、BUG-061 最新 `06`／`07`／`08`、round1 報告及目前 `scripts/test-ai-providers.mjs`；未沿用 round1 的測試結果作為本輪證據。
- 審查限制：只能讀取、執行 deterministic 驗證並建立本報告；未啟動真實 Ollama、未下載／停止模型、未修改 OS 網路／防火牆、未啟動 Electron UI、未執行任何 OS 網路或發布操作。

## 1. 需求完整性

- 判定：通過（仍有治理 closeout 條件）。
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-19`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-8`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-8` 已同步記錄 BUG-061 scope、修正內容、deterministic 驗證與範圍限制。`08` 目前仍標示「進行中」，這是待本輪報告引用的 closeout 狀態，不是 scope 遺漏。
- `scripts/test-ai-providers.mjs:148-168` 的 custom native 404 fixture 會傳入完整 `operation`、`output_language`、`subtitle_cue_count`、`subtitle_cue_ids`，並斷言 fallback request 保留 exact `model`／`messages`、只剩兩個 top-level keys、完整移除四項 internal metadata 及 native `format`／`options`／`keep_alive`／`think`；`:159` 明確斷言總 request 數為 2。
- `scripts/test-ai-providers.mjs:112-132` 已明確傳入 `operation: 'proofread'`，並斷言 native proofread request 的 root／cues／item schema 結構、ID enum 與 exact count；`:232-244` 對明確 translate request 斷言 root／cues／item 的 `required`、`additionalProperties`、`text`／`reason` `type`、ID enum 與 exact count。
- `scripts/test-ai-providers.mjs:185-200` 覆蓋 custom native HTTP 500 no-fallback；`:201-216` 以 port `24571` 的 strict NDJSON `not-json` fixture 覆蓋 native failure no-fallback，兩者均斷言只發出一次 `/api/chat` request。這些是本輪實際執行的 round2 fixtures。
- 文件精確性 residual：`06-TEST-AND-PROCESS-AUDIT.md:6` 將 `text`／`reason` type 描述為 proofread 與 translate 都有直接 assertion；目前程式碼的明確 `text`／`reason` type assertions 位於 translate 區段 `scripts/test-ai-providers.mjs:239-240`，proofread 區段則由 shared builder source `lib/ai/providers.mjs:63-70` 提供相同 schema，但未逐欄重複 assertion。這不影響本輪使用者指定的「明確 proofread operation」與「translate full schema」條件，但若要讓文件逐字等同測試證據，應由主要代理後續補 assertion 或收窄文件措辭。

## 2. 邏輯正確性

- 判定：通過。
- 證據：`lib/ai/providers.mjs:77-119` 仍只在 loopback Ollama 走 native `/api/chat`，custom loopback 只有 native error status 為 404 才呼叫 `createChatCompletion(config, body, signal)`；其他 status／strict parser failure 直接拋出。BUG-061 的 `git diff` 未修改產品 runtime。
- `lib/ai/openai-compatible.mjs:221-229` 的 `stripInternalChatFields` 移除 `operation`、`output_language`、`subtitle_cue_count`、`subtitle_cue_ids`；round2 fixture 以四個欄位實際輸入並檢查 fallback body，因此不是對缺失欄位作假陽性 assertion。
- 404 mock 的 response sequence 是 native 404 後 compatibility 200（`scripts/test-ai-providers.mjs:142-146`），且 `:159-165` 同時驗證 endpoint、exact request count、model 與 messages；因此能區分 native-first、一次 fallback 與 request body preservation。
- HTTP 400／500 與 strict failure fixture 都只回 native failure，分別由 `:169-184`、`:185-200`、`:201-216` 驗證原始錯誤分類／status、native endpoint 與單 request；沒有以 fallback 成功 response 掩蓋錯誤。

## 3. 邊界情況

- 判定：通過（限 deterministic transport／body scope）。
- 證據：`scripts/test-ai-providers.mjs:112-220` 實際覆蓋 default `11434`、custom `24567`／`24568`／`24569`／`24570`／`24571`、非 loopback fallback，以及 `24571` HTTP 200 `application/x-ndjson` 的 `not-json` strict failure；`:159`、`:215-216` 分別固定 404 exact two requests 與 strict failure no-fallback。
- 實際涵蓋的 endpoint／port 邊界：default loopback `11434` native、custom loopback `24567` native、`24568` native 404 fallback、`24569` HTTP 400 no-fallback、`24570` HTTP 500 no-fallback、`24571` strict NDJSON failure no-fallback，以及非 loopback `https://ollama.example.test/v1` compatibility fallback（`scripts/test-ai-providers.mjs:112-220`）。
- `24571` 的 fixture 是 HTTP 200 `application/x-ndjson` 但內容為 `not-json\n`（`:201-210`），預期錯誤為不可重試 `ollama_stream_invalid_json`，並以 `:215-216` 斷言沒有第二次 request；這直接覆蓋本輪要求的 custom native strict NDJSON failure。
- fallback case 同時覆蓋完整 internal metadata、native-only fields、兩個 messages 與 exact two-request sequence；non-404 cases 覆蓋 400／500／status 缺失的 strict parser failure。未發現本輪指定 deterministic boundary 遺漏。
- 剩餘外部邊界：沒有測試真實 daemon 的其他 Ollama 版本／模型、長 prompt／實際 schema 相容性、網路斷線或 Electron／Windows runtime；這些不屬 BUG-061 round2 deterministic scope。

## 4. 程式碼品質

- 判定：通過（附文件精確性 residual）。
- 證據：BUG-061 test 差異集中於 `scripts/test-ai-providers.mjs:70-73`、`:112-220`、`:232-246`，沒有把 regression-only logic 寫入產品 runtime；mock `globalThis.fetch` 在各 custom fixture 的 `try/finally` 中恢復（`:147-157`、`:174-182`、`:190-198`、`:206-214`）。
- Assertion 訊息清楚區分 native endpoint、fallback endpoint、request count、body stripping、schema 與 no-fallback error semantics；沒有發現 secrets、模型檔、OS 設定或發布資產變更。
- 目前 shared schema builder 仍集中於 `lib/ai/providers.mjs:52-75`，BUG-061 沒有重複實作 schema 或放寬 runtime contract。`git diff --check` exit 0，未發現 whitespace error。

## 5. 測試覆蓋

- 判定：通過（deterministic test coverage）；治理 final gate 仍未完成。
- 證據：`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs`、`npm run check`、`node scripts/test-project-docs-validator.mjs` 與 `git diff --check` 均已執行；focused test exit 0、完整 `npm run check` exit 0、validator exit 0。
- 實際執行結果（2026-10-28，Asia/Taipei）：
  - `node --check scripts/test-ai-providers.mjs`：exit 0。
  - `node scripts/test-ai-providers.mjs`：exit 0；輸出 `AI provider contract 與術語／Prompt 測試通過`。
  - `npm run check`：exit 0；`docs:check`、所有 npm test suites、Ollama managed-child／local UI fixture／offline UI bundle／stream fixture、核心與 YouTube suites 均通過；未啟動真實 Ollama acceptance。
  - `node scripts/test-project-docs-validator.mjs`：exit 0；輸出治理文件驗證器測試通過。
  - `git diff --check`：exit 0。
  - `npm run docs:check:final`：exit 1；輸出指出最新工作紀錄缺少「發布授權：」、尚未標示「完成」、以及已執行獨立審查但缺少可解析審查檔案與逐字引用。這是因 round2 報告在本次審查執行前尚未存在，且本審查代理不得修改 `08-CHANGE-LOG.md`。
- round2 focused execution 實際涵蓋 port `24571` strict NDJSON failure fixture，以及 404 exact count／body preservation、400／500 no-fallback 與 proofread／translate schema assertions；未把 round1 的報告描述當作通過證據。
- 2026-10-28T11:36:50+08:00 的 validator／`git diff --check` 執行時間戳已由本輪 shell 輸出記錄；報告建立時間為 2026-10-28T11:37:17+08:00。

## 6. 實際運行結果

- 判定：部分通過；deterministic scope 實際通過，live／product scope 未執行。
- 證據：本輪實際使用 test-local `globalThis.fetch`／`Response`／`ReadableStream` 與 fake transport；`scripts/test-ai-providers.mjs:201-216` 執行 port `24571` strict NDJSON failure 並斷言只有一次 `/api/chat` request，未呼叫真實 Ollama、Electron UI 或 OS 網路。
- 實際執行的 provider test 使用 test-local `globalThis.fetch`、`Response`、`ReadableStream` 與 fake transport；`npm run check` 的 Ollama 相關 suite 也使用 managed-child／missing-model／offline bundle／stream fixtures。輸出明確顯示 no download／no Ollama model required 的測試界線。
- 本輪沒有呼叫 `npm run acceptance:ollama:offline`、`npm run acceptance:ollama:product` 或 `npm run acceptance:ollama:ui`，沒有真實 model request、沒有模型品質證據、沒有下載／停止模型、沒有 Electron UI 操作、沒有 OS 網路／防火牆變更。
- round2 實際可證明的是目前 source 下的 deterministic routing／body／schema／fail-closed contract；不能由 test green 推導 live Ollama endpoint 的 schema 接受度、模型輸出品質或封裝後行為。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪 BUG-061 round2 獨立複審結論為有條件通過：目前 worktree 的 custom native 404 fallback 已實際固定為 exactly two requests，fallback 保留 model/messages 並移除 operation、output_language、subtitle_cue_count、subtitle_cue_ids，明確 proofread operation、translate full schema 的 required／additionalProperties／type、custom 500 no-fallback 與 port 24571 strict NDJSON failure no-fallback fixture 均由 deterministic provider tests 通過；06／07／08 已同步記錄 BUG-061 scope，但 `npm run docs:check:final` 仍因最新 08 尚未標示完成、缺少可解析的 round2 審查引用及缺少發布授權欄位而 exit 1，故本輪仍有治理 closeout 條件；本結論僅適用於 deterministic mock／fixture scope，不延伸為 live Ollama、Electron UI、Windows、全機斷網或 FR-021 完整驗收。**
- 阻擋問題（若有）：沒有 BUG-061 runtime／deterministic test blocker；有一項治理 closeout condition：主要代理須在 `08-CHANGE-LOG.md` 完成 round2 報告連結與逐字引用、補齊 final-gate 必要欄位並將最新工作標示為完成，之後重跑 `npm run docs:check:final`。
- 剩餘風險：proofread 的 `text`／`reason` type 尚未在 test 中以另一個明確 proofread body 逐欄重複 assertion，雖然 shared builder source 已提供該 type；`06` 對此的文字目前略超過直接 test evidence。更廣泛的 Ollama 版本／模型、長 prompt、live daemon、模型品質、Electron UI、取消／續跑、Windows、全機斷網與 FR-021 完整驗收仍未涵蓋。
- 給主要開發代理的具體修正要求（若有）：只需在主要代理上下文完成 `08-CHANGE-LOG.md` 的 round2 closeout／逐字引用／`發布授權：不適用` 欄位，重跑 `npm run docs:check:final`；若要消除文件精確性 residual，補 proofread `text`／`reason` type assertions 或收窄 `06` 的描述。不得修改本報告原件或將 deterministic 結果擴大為 live／FR-021 完整通過。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪唯一寫入路徑為 `docs/project-management/reviews/2026-10-28-bug-061-regression-coverage-round2.md`；round1 原件、source、tests、06／07／08、evidence 與其他既有 dirty worktree 均未修改。
- 本輪未啟動真實 Ollama、未下載／停止模型、未修改 OS 網路／防火牆、未啟動 Electron UI、未執行發布或網路操作。
- 若上述聲明不實，本報告無效。
