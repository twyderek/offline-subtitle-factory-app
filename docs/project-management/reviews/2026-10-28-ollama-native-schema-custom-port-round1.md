# 獨立審查報告：BUG-060 Ollama native schema 與 custom port routing

- 審查對象 commit／版本：目前 worktree、專案版本 `0.52.0`；本輪沒有指定 commit，審查包含目前未提交 source／test／治理差異。
- 對應 08-CHANGE-LOG 條目：2026-10-28 — Ollama translate native JSON format 未固定 cues schema（BUG-060）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-28（Asia/Taipei）；獨立只讀上下文，重新執行 `npm run project:preflight -- --type=debug`，讀取 `AGENTS.md`、`docs/project-management/README.md`、`00`、`02`、`03`、`06`、`07`、`08` 與獨立審查／測試／結案流程；未沿用主要代理的結論作為證據。
- 審查限制：未啟動第二次真實 Ollama、未下載／停止模型、未修改 OS 網路／防火牆、未啟動 Electron UI；只執行 deterministic source／test／治理檢查並讀取既有 evidence。

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37,48-60` 將 FR-021 的本機／非 loopback 隱私邊界、LM Studio 範圍例外與 BUG-060 的 1B random-loopback product replay 分開記錄；`docs/project-management/03-FUNCTIONAL-DESIGN.md:145-153` 明定 loopback hostname 精確判定、Ollama native schema／`num_ctx=4096` 與非 loopback fallback。`docs/project-management/08-CHANGE-LOG.md:11-18` 的最新 BUG-060 目標、custom native 404 fallback、replay4 成功條件與不在範圍事項和 source／evidence 一致。BUG-060 產品修正範圍已覆蓋；但 FR-021 的完整需求仍明確未完成，故不能把本輪判定升格為 FR-021 通過。

## 2. 邏輯正確性

- 判定：通過
- 證據：`lib/ai/providers.mjs:77-79` 以 `isLoopbackAiUrl()` 作為路由邊界；所有 loopback Ollama URL（包含自訂 port）先建立 native `/api/chat` request（`:88-111`）。`lib/ai/providers.mjs:52-75` 的共用 builder 對 translate／proofread 都建立 root object、固定 `cues` array、`minItems=maxItems`、原始 ID `enum`、item 的 `id`／`text`／`reason` required 與 `additionalProperties:false`；`:99` 固定 native `options.num_ctx=4096`，translate 另以 `think:false`（`:97`）。`lib/ai/providers.mjs:112-118` 僅在明確自訂 port 且 native HTTP status 為 404 時呼叫既有 `createChatCompletion()`；`lib/ai/openai-compatible.mjs:192-199` 保留 HTTP status 於 `AiProviderError`，所以 fallback 條件可回溯且不會把 400／500／stream/parser failure 誤當成 404。非 loopback 於 `providers.mjs:79` 直接使用 OpenAI-compatible path；`openai-compatible.mjs:228-229` 會移除 internal cue metadata。這與 08 所要求的「custom native 404 才 fallback」一致。

## 3. 邊界情況

- 判定：部分通過
- 證據：`scripts/test-ai-providers.mjs:112-151` 實際覆蓋 default `11434` native、random/custom loopback native、custom loopback native 404 後第二次 `/v1/chat/completions`、非 loopback fallback 與 `num_ctx` 邊界；`:152-168` 覆蓋 translate 的 schema、原始 ID、exact count、`think:false` 與 prompt；`:169-190` 及後續 provider tests 保留 strict NDJSON／UTF-8／stream error／cleanup regression；`:464-465` 覆蓋 IPv6 loopback 與 `localhost` 子網域拒絕。source 亦保留 custom 404 以外錯誤不 fallback 的控制流。尚未由測試直接斷言 fallback 第二次 request 的 body 已移除所有 internal fields／native options，也未以獨立 assertion 完整列出 proofread schema 的 required／additionalProperties，並未覆蓋 URL 明確指定標準 port 的特殊正規化；這是 regression coverage residual，不是目前 source 已被證明錯誤。

## 4. 程式碼品質

- 判定：通過
- 證據：`buildOllamaCueResponseFormat()`（`lib/ai/providers.mjs:52-75`）消除 translate／proofread 的 schema duplication；native request 以區域 `nativeRequest`（`:88-111`）集中保存 endpoint、stream、context 與 strict stream policy；fallback 僅在窄條件觸發，未修改其他 provider adapter。`createChatCompletion()`（`lib/ai/openai-compatible.mjs:221-229`）維持既有 internal-field stripping；source／test syntax 與 `git diff --check` 均通過，未見秘密、路徑或不必要的 OS／daemon 變更。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-10-28 本輪實際執行 `npm run check`，exit 0；輸出包含 `node scripts/test-ai-providers.mjs`、`node scripts/test-ai-optimizer.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-core.mjs` 與 YouTube／核心 regression 全部通過。`test-core` 使用 custom loopback fake，原先會因 native `/api/chat` 404 失敗，現由新增 fallback regression 後完整 check 通過；本輪另執行 `node scripts/test-project-docs-validator.mjs` 與 `git diff --check`，均 exit 0。測試證明 deterministic routing、schema、context、stream lifecycle 與鄰近 provider contract；但上節列出的 fallback body 與 proofread full-schema assertions仍屬可補強項，不能把 deterministic check 擴大為所有 Ollama 版本／模型相容性。

## 6. 實際運行結果

- 判定：部分通過
- 證據：既有 immutable `docs/project-management/evidence/2026-10-28-ollama-llama3.2-1b-product-offline-replay1.json:11-45` 與 `...replay2.json:11-45` 均為 `status=fail`、`failureStage=product_probe`、`failureCode=MODEL_RESPONSE_CONTRACT_REJECTED`，但各自的 Seatbelt loopback／外連 `EPERM`、預裝且未下載、daemon／port／temporary cleanup 均通過，原件未被覆寫。`...replay3.json:11-68` 為 pass，2 suggestions、accepted／undo／redo 各 2、雙語 review、時間碼與 source SRT hash 不變，並通過 isolation／cleanup；`...replay4.json:11-68` 是最後 source（含 custom native 404 fallback）重播，同樣 pass，故 replay3 pass 與 replay4 latest pass 均保留且需分開理解。`2026-10-28-ollama-llama3.2-1b-product-live-diagnostic1.json:11-41` 亦為 default loopback 1B product flow pass，但只保存 loopback-only scope、沒有 Seatbelt／daemon／cleanup 欄位。`2026-10-28-ollama-llama3.2-3b-product-offline-replay2.json:11-68` 為 3B pass，具備同樣 product／isolation／cleanup assertions。所有 offline evidence 均標示 `systemNetworkDisabled=false`；因此這些結果只證明目前 macOS arm64、目前 Ollama／預裝模型與受控子程序，不是 Electron UI、Windows、真正全機斷網、取消／續跑或 FR-021 全部驗收。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 BUG-060 獨立審查結論為有條件通過：Ollama loopback custom-port native routing、custom native 404 fallback、translate／proofread exact cue JSON Schema 與 num_ctx=4096 已由 source、provider regression、完整 deterministic check 及 1B replay3／replay4 product evidence 核對；但完整 FR-021 仍未驗收，且 08-CHANGE-LOG.md 尚未完成本輪審查引用與 final gate，故不得宣稱無條件結案或 FR-021 完成。**
- 阻擋問題（若有）：BUG-060 的 `docs/project-management/08-CHANGE-LOG.md:5` 目前仍為「進行中」，尚未有本報告路徑、逐字判定引用、獨立審查欄位與結案／發布不適用欄位；本輪實際 `npm run docs:check:final` exit 1，回報最新工作紀錄缺少「發布授權」、尚未標示完成且缺少可解析審查引用。這是治理 closeout blocker，不是已證明的 runtime/source blocker。
- 剩餘風險：未直接測試所有 Ollama 版本／模型對 JSON Schema 的支援、長 prompt／context fit 或模型品質；custom 404 fallback 的 body boundary 與 proofread full-schema regression 可再加強；目前 evidence 僅覆蓋 macOS arm64、Seatbelt 受控子程序與 `systemNetworkDisabled=false`，不涵蓋 Electron UI、取消／續跑、Windows、真正全機斷網或 FR-021 全部驗收。replay1／replay2 fail 原件仍是歷史事實，不得以 replay3／replay4／3B pass 覆寫或宣稱失敗已普遍消失。
- 給主要開發代理的具體修正要求（若有）：在不修改本報告原件的前提下，將本報告路徑與上方完整結論句逐字同步至 BUG-060 的 08 條目，標示審查已執行、發布不適用、完成實際 closeout 並重跑 `npm run docs:check:final`；若要消除測試覆蓋 residual，再新增 fallback body／proofread full-schema／非 404 不 fallback assertions 後執行受影響 regression。不得把 replay4、3B replay2 或本報告改寫成 FR-021 完整驗收。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
