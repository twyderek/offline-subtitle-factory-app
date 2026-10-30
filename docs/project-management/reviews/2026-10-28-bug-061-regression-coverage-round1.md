# 獨立審查報告：BUG-061 BUG-060 regression coverage hardening

- 審查對象 commit／版本：目前 worktree、專案版本 `0.52.0`；本輪沒有指定 commit，審查包含目前未提交 source／test／治理差異。
- 對應 08-CHANGE-LOG 條目：2026-10-28 — BUG-060 Ollama routing／schema regression coverage hardening（BUG-061）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-28（Asia/Taipei）；獨立只讀上下文，先執行 `npm run project:preflight -- --type=debug`，讀取 `AGENTS.md`、`docs/project-management/README.md`、`00-CURRENT-STATUS.md`、`03-FUNCTIONAL-DESIGN.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、`08-CHANGE-LOG.md` 最新條目、`workflows/03`／`04`／`05`／`07`、BUG-060 round1 與目前 source／test；未重讀無關歷史 changelog。
- 審查限制：只審查 BUG-061 新增的 `scripts/test-ai-providers.mjs` regression coverage 與同步的 `06`／`07`／`08`；未啟動真實 Ollama、未下載／停止模型、未修改 OS 網路／防火牆、未啟動 Electron UI、未修改產品 source 或任何既有檔案。

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-20`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-10` 與 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-8` 一致記錄本輪 scope 為 fallback body stripping、proofread／translate schema 與 custom native non-404 fail-closed regression；也明確記錄未修改 runtime、不啟動真實模型與不擴大為 live／UI／Windows／FR-021 全驗收。`lib/ai/providers.mjs:42-131` 的目前內容與 BUG-060 round1 對 `isLoopbackAiUrl`、native schema、404 fallback、`num_ctx=4096` 的 source 證據一致；本輪 `git diff -- lib/ai/providers.mjs` 顯示的是先前 BUG-059／BUG-060 的 source 差異，未見 BUG-061 專屬 hunk。因目前 worktree 沒有本輪 commit／patch 邊界，這能證明目前沒有可辨識的 BUG-061 source 修改，但不能對未提交 worktree 提供逐次操作的密碼學 provenance。
- 證據：`scripts/test-ai-providers.mjs:140-173` 確實建立 custom native 404 與 400 mock；`scripts/test-ai-providers.mjs:122-132` 確實斷言一組完整 native cue schema；`scripts/test-ai-providers.mjs:190-196` 確實斷言 translate 的部分 schema／prompt 行為。然而成功條件宣稱的「proofread／translate schema 的 required／additionalProperties／ID enum／exact count」尚未由兩個明確 operation 各自完整斷言，且 fallback stripping 的輸入沒有帶齊所有 internal metadata，因此需求覆蓋尚未完整。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：`lib/ai/providers.mjs:77-119` 只對 loopback 走 native `/api/chat`，custom port 的 native request 只有 `error.status === 404` 才呼叫 `createChatCompletion(config, body, signal)`；`lib/ai/openai-compatible.mjs:221-229` 的 `stripInternalChatFields` 會移除 `operation`、`output_language`、`subtitle_cue_count`、`subtitle_cue_ids`。因此目前 source 的 route／fallback 控制流與 BUG-060 需求一致，且本輪沒有修改 source。
- 證據：`scripts/test-ai-providers.mjs:142-153` 的 404 fixture 會先記錄 `/api/chat`、再回傳 `/v1/chat/completions`，所以能有效驗證 native-first 與 404 fallback endpoint；`scripts/test-ai-providers.mjs:159-173` 的 400 fixture 只回 native failure，並斷言 `status=400`、`code=bad_request` 及 request count 1，能有效防止目前實作路徑的第二次 fallback。
- 非阻擋 residual：404 case 沒有斷言 `fallbackRequests.length === 2`，也沒有斷言 fallback body 應保留的 `model`／`messages`；若實作多發第三次 request，或送出一個空但可由 mock response 使測試成功的 body，現有 assertions 仍可能通過。404 case 的輸入只帶 `operation`，沒有帶 `output_language`、`subtitle_cue_count`、`subtitle_cue_ids`；因此這四個 internal field 的 stripping assertion 中，後三者是對「本來不存在」的欄位斷言，不能證明實際移除。
- 非阻擋 residual：`scripts/test-ai-providers.mjs:112-132` 的 full schema call 沒有傳入 `operation: 'proofread'`；它驗證的是目前 shared builder 的 non-translate/default path，而不是明確 proofread request。`scripts/test-ai-providers.mjs:180-196` 的 translate call 只檢查 `format.type`、ID enum、min/max 與 `think`／prompt，沒有在 translate request 上重複檢查 root／item 的 `required`、`additionalProperties` 與 `text`／`reason` type。這些不是目前 source 已被證明錯誤，但在 mode-specific schema 分支回歸時會形成 false-negative coverage。

## 3. 邊界情況

- 判定：部分通過
- 證據：目前 tests 覆蓋 default `11434` native、custom loopback `24567` native、custom loopback `24568` native 404 fallback、non-loopback remote fallback，以及 custom loopback `24569` HTTP 400 no-fallback（`scripts/test-ai-providers.mjs:112-179`）。400 的 fixture 會對任何第二次 request 仍回 400，配合 `non404Requests.length === 1`，不是只檢查第一個錯誤後就放行。
- 證據：fallback body loop（`scripts/test-ai-providers.mjs:154-157`）會拒絕 `operation`、`output_language`、cue metadata、native `format`／`options`／`keep_alive`／`think`；它能抓到錯把已組裝 native body 傳給 compatibility fallback 的主要錯誤，但因輸入欄位不完整與缺少 expected body／exact request count，仍有上述 false-positive 路徑。
- 非阻擋 residual：成功條件寫的是 custom native `400／500` 或 strict failure 均不得 fallback，但本輪直接 test 只有 400（`:158-173`），沒有 500 fixture，也沒有一個 custom native strict parser／stream failure fixture 驗證其 status 缺失時不 fallback。現有 strict stream tests（`:197` 起）驗證 native parser behavior，但不能單獨證明 custom-port fallback gate 對 strict failure 的 request count。
- 非阻擋 residual：proofread mode 沒有明確 `operation: 'proofread'` native request；translate mode 沒有完整 schema assertion。這是 regression coverage 缺口，不是 live model compatibility 證據。

## 4. 程式碼品質

- 判定：通過（附 coverage 可維護性建議）
- 證據：BUG-061 的 test 差異集中在 `scripts/test-ai-providers.mjs:70-73`、`:120-196`，沒有將測試邏輯散落到產品 runtime；404／non-404 fixtures 都在 `try/finally` 恢復 `globalThis.fetch`（`:147-171`），避免污染後續 deterministic suites。assertion 訊息清楚標示 native／fallback／schema 邊界。
- 證據：`lib/ai/providers.mjs:52-75` 目前以共用 `buildOllamaCueResponseFormat()` 保持 translate／proofread schema source 單一來源；BUG-061 沒有重複實作或放寬 source contract。`git diff --check` exit 0，未見 whitespace error；未發現秘密、模型檔、OS 設定或發布資產變更。
- 建議：為避免日後 shared builder 改成 mode-specific branch 後測試仍誤綠，應用一個明確 proofread body 與一個明確 translate body，各自使用同一個 schema assertion helper 或逐欄斷言；fallback case 應建立含完整 internal fields 的 body 並斷言保留欄位與 exactly-two requests。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：本輪實際執行 `node --check scripts/test-ai-providers.mjs`，exit 0；`node scripts/test-ai-providers.mjs`，exit 0，輸出 `AI provider contract 與術語／Prompt 測試通過`。
- 證據：本輪實際執行 `npm run check`，exit 0。輸出包含 `docs:check`（19 個治理文件）、`test-ai-providers`、`test-ai-optimizer`、`test-ollama-offline-process`、`test-ollama-ui-offline`、`test-ollama-batch-stream`、核心與 YouTube suites 全部通過；Ollama 相關測試輸出為 managed-child spawn-error fixture、local UI daemon missing-model fixture（明示 no download）、offline UI bundle fixture 與 stream fixture，沒有啟動真實 Ollama acceptance。
- 證據：本輪實際執行 `node scripts/test-project-docs-validator.mjs`，exit 0；輸出 `治理文件驗證器測試通過：保留字、報告結構、多輪結論、跳過授權、欄位錯置與逐項發布風險`。本輪實際執行 `git diff --check`，exit 0。
- 證據：`npm run docs:check:final` 於本輪 2026-10-28（Asia/Taipei）實際 exit 1，輸出為最新工作紀錄缺少「發布授權」、尚未標示「完成」、且「獨立審查是否執行」不是是／否。這與目前 `08-CHANGE-LOG.md:5,19` 的 `進行中`／`待本輪獨立上下文完成` 一致；因此完整 deterministic check 通過，不等於 BUG-061 governance closeout 已完成。
- 覆蓋判定：現有 green tests 足以證明新增 fixture 在目前 source 下執行成功；上述未覆蓋的逐欄 stripping、兩個 operation 的 full schema、500／strict non-fallback 邊界是非阻擋 residual，不能把 `npm run check` 的綠燈解讀成它們已被完整固定。

## 6. 實際運行結果

- 判定：部分通過
- 證據：實際 deterministic execution 的 `fetch` 全部由 test-local mock／ReadableStream／local fixture 提供；未呼叫 `npm run acceptance:ollama:offline`、`npm run acceptance:ollama:product` 或 `npm run acceptance:ollama:ui`，未下載／停止模型，也未修改 OS 網路。`npm run check` 的 Ollama 相關 output 明確記錄 `no download`／`no Ollama/model required` 的 fixture scope。
- 證據：目前 source 的實際 native/fallback control flow 可由 `lib/ai/providers.mjs:77-131` 與 `lib/ai/openai-compatible.mjs:192-229` 回溯；test output 證明 404 路由與 400 單 request assertion 實際執行，而不是只讀文件宣稱。BUG-060 round1 `docs/project-management/reviews/2026-10-28-ollama-native-schema-custom-port-round1.md:43-48` 的既有 deterministic／1B replay evidence 亦保留未修改。
- 限制：本輪沒有 live Ollama request、沒有模型回應品質或 JSON Schema runtime compatibility 的新證據；因此本節只能判定 deterministic mock execution，不能把結果延伸為 live Ollama、Electron UI、Windows、真正全機斷網或 FR-021 完整驗收。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 BUG-061 獨立審查結論為有條件通過：BUG-060 source 在本輪範圍內未見被修改，deterministic `npm run check`、`node scripts/test-project-docs-validator.mjs` 與 `git diff --check` 均通過，custom native 404 的雙 request route、400 non-404 單 request fail-closed 與部分 fallback／schema assertions 可運作；但 fallback body 測試未以含完整 internal metadata 的輸入驗證 stripping、未斷言 fallback request 總數與保留的 model/messages，native proofread 未明確傳入 `operation: 'proofread'`，translate 未重複斷言 root／item 的 required 與 additionalProperties，且 non-404 只覆蓋 400、未覆蓋 500，另 `npm run docs:check:final` 目前因 BUG-061 08 尚未完成／缺少審查欄位而 exit 1，故需由主要代理補強上述 deterministic assertions 並完成 08 closeout 後，才能宣稱 BUG-061 完成；本結論不等於 live Ollama、Electron UI、Windows、真正全機斷網或 FR-021 完整驗收。**
- 阻擋問題（若有）：無。BUG-061 source／runtime 沒有本輪阻擋問題；上述 coverage findings 與 `npm run docs:check:final` 尚未完成的 08 governance sync 均列為非阻擋 residual／closeout condition。
- 剩餘風險（均為非阻擋）：本輪只驗證 deterministic provider mock／local fixture；不證明任何 Ollama 版本、模型、長 prompt 或真實模型輸出接受 JSON Schema，不證明 live daemon、Electron UI、取消／續跑、Windows、真正全機斷網或 FR-021 完整驗收。BUG-060 的既有 live／Seatbelt replay evidence 邊界與失敗原件仍須依原報告理解，不得由本輪 test green 改寫。另建議後續補上 404 完整 metadata／exact request count／保留欄位、明確 proofread 與 translate full schema、custom 500／strict failure no-fallback assertions，並完成 08 final gate。
- 給主要開發代理的具體修正要求（若有）：本輪無阻擋性修正要求；若要消除上述非阻擋 residual，建議只在主要代理工作樹中補強 deterministic tests，完成後重跑 focused test、`npm run check`、validator、`git diff --check` 與 `npm run docs:check:final`；不得修改本報告原件，亦不得啟動真實 Ollama 或擴大驗收宣稱。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪未啟動真實 Ollama、未下載／停止模型、未修改 OS 網路／防火牆、未啟動 Electron UI；本報告唯一寫入路徑為 `docs/project-management/reviews/2026-10-28-bug-061-regression-coverage-round1.md`。
- 若上述聲明不實，本報告無效。
