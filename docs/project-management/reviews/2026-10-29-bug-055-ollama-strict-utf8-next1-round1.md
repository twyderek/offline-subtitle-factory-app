# 獨立審查報告：BUG-055 Ollama strict UTF-8 NDJSON stream fail-closed closeout

- 審查對象：目前 dirty worktree、`offline-subtitle-factory@0.52.0`、branch `codex/0.51-anthropic-claude`；不把未提交差異視為已提交版本。
- 對應 08-CHANGE-LOG 條目：`docs/project-management/08-CHANGE-LOG.md:3-14` 的 `BUG-055-OLLAMA-STRICT-UTF8-NEXT1-REVIEW`。
- 審查輪次：round1。
- 審查代理啟動／證據時間：2026-10-29（Asia/Taipei）；focused 驗證自 `2026-10-29T16:09:20+08:00` 起執行。
- 本輪為獨立上下文；只審查 BUG-055 allowlist 與直接相關的 optimizer contract。BUG-060／BUG-061 routing／schema 變更、其他 dirty source、evidence、candidate 與既有 review 均不作本輪結案對象。

## 審查範圍

- allowlist source：`lib/ai/openai-compatible.mjs`、`lib/ai/providers.mjs`。
- allowlist tests：`scripts/test-ai-providers.mjs`、`scripts/test-ollama-batch-stream.mjs`。
- 直接相關 contract：`lib/ai/subtitle-optimizer.mjs` 的 strict stream failure 不 repair、不 retry、不 checkpoint。
- 治理依據：`AGENTS.md`、`docs/project-management/README.md`、`01-PROJECT-GOVERNANCE.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`09-STANDING-AUTHORIZATIONS.md`、測試／獨立審查／文件結案 workflows，以及 BUG-055 對應的 `03`／`06`／`07`／`08` 條目。
- 未執行或未宣稱：真實 Ollama daemon／raw response、其他模型／版本、Windows、offline／full egress、packaged UI、簽署／公證、release 或 FR-021 overall acceptance。

## 1. 需求完整性

- 判定：通過（就 BUG-055 allowlist 與 deterministic/local contract）。
- 證據：
  - `lib/ai/openai-compatible.mjs:76-91` 對 strict response 在沒有 stream reader 時只接受 `arrayBuffer()`；缺少 byte reader 時建立 `encodingUnavailableError()`，不回退 replacement-capable `text()`；`arrayBuffer()` 讀取後才在 `:84-91` 以 fatal UTF-8 decoder 解碼。
  - `lib/ai/openai-compatible.mjs:93-123` 的 reader path 使用 fatal decoder，逐 chunk 解碼並在 EOF 以 `decoder.decode()` flush；只有完成 decode 後才呼叫 `mergeStreamingRecords()`。invalid byte 與 truncated final sequence 因而在 NDJSON parser／optimizer repair 前 fail-closed。
  - `lib/ai/providers.mjs:77-110` 只在 Ollama native request wiring `strictEncoding: true`、`ollama_stream_invalid_encoding` 與 `ollama_stream_encoding_unavailable`；本輪不把同檔案的 BUG-060／BUG-061 routing／schema 變更當成 BUG-055 結案證據。
  - `docs/project-management/03-FUNCTIONAL-DESIGN.md:217-223`、`06-TEST-AND-PROCESS-AUDIT.md:289-296`、`07-DEBUG-AND-FIX-HISTORY.md:293-299` 與 08 條目 `:10-14` 對 invalid UTF-8、EOF flush、no-byte-reader、既有分類與 optimizer 邊界的需求描述一致。

## 2. 邏輯正確性

- 判定：通過；仍限 deterministic reader／fetch fixture，不能推論 live socket 已物理回收。
- 證據：
  - `lib/ai/openai-compatible.mjs:124-148` 在 reader failure 先保留原始錯誤，對 `AiProviderError` best-effort abort underlying request，再以固定 `250ms` cleanup race 等待 `reader.cancel()`，最後 always `releaseLock()`；cleanup exception 不覆蓋原始分類。
  - `scripts/test-ai-providers.mjs:318-358` 實測正常 EOF 不 cancel 但 release、decoder failure cancel／release、reader transport failure 保留 `network_error`；`:359-415` 實測 cancel 永不 settle 時仍 bounded return、abort／cancel／release 順序與原始 strict parser error 保留。
  - `scripts/test-ai-providers.mjs:459-507` 實測 strict no-byte-reader 為 `ollama_stream_encoding_unavailable`、external abort 保留取消 reason、fallback timeout 為 `timeout`／可重試、transport rejection 為 `network_error`／可重試。這確認 round1 歷史 B1／B2 在目前 source 仍未回歸。
  - `scripts/test-ai-providers.mjs:282-295` 與 `scripts/test-ollama-batch-stream.mjs:87-112` 實測 invalid byte／truncated EOF 的不可重試錯誤與 bounded cleanup；沒有證據顯示 strict decode failure 會被轉成 timeout、network error 或 replacement text。

## 3. 邊界情況

- 判定：通過（本輪 deterministic boundary cases 已覆蓋）。
- 證據：
  - `scripts/test-ai-providers.mjs:247-295` 實測正常 NDJSON、malformed NDJSON、合法跨 chunk UTF-8、invalid byte 與 truncated EOF；`:296-358` 實測正常 EOF、decoder failure 與 reader transport failure 的 lifecycle 邊界。
  - `scripts/test-ai-providers.mjs:459-507` 實測 strict no-byte-reader、external abort、fallback timeout／transport rejection 與 non-strict replacement-capable compatibility；`scripts/test-ollama-batch-stream.mjs:87-112` 實測 optimizer invalid UTF-8 不 retry／不 checkpoint。
  - 直接 translate-mode product-path probe 於 `2026-10-29T16:10:13+08:00` 實測 invalid UTF-8 只呼叫一次（`calls=1`）且沒有 checkpoint（`checkpoints=0`）。本輪未將 fixture 結果擴大為 real Ollama、跨模型／版本、Windows 或 FR-021 acceptance。

## 4. 程式碼品質

- 判定：通過（就本輪 local/deterministic boundary）。
- 證據：
  - strict decoder failure 只建立固定錯誤文字與 code（`lib/ai/openai-compatible.mjs:62-73`），不把 raw bytes、字幕內容或 API key 寫入 error；strict fallback 也在 parser 前直接拒絕不可驗證的 response shape。
  - `requestAiJson()` 的既有 request signal／redirect／API key boundary 未被 BUG-055 strict option 放寬；`lib/ai/providers.mjs:104-110` 僅增加 native Ollama stream options，不保存 response bytes。
  - focused tests 使用本機 fixture／fake reader，且 `scripts/test-ai-providers.mjs:469-474` 明確保留非 strict provider 的既有相容行為，不把 strict policy 無意擴散至其他 provider。
  - 本輪沒有實際外連、模型下載、OS 網路設定、UI、封裝或 release 操作；因此不把 local fixture 結果擴大成 offline／full egress security evidence。

### 可維護性與文件一致性

- 判定：有條件通過；source／test／設計文字一致，但本輪治理 closeout 尚未完成。
- 證據：
  - strict policy 以 `streamOptions.strictEncoding` opt-in 傳遞，錯誤碼由 provider wiring 明確注入；這使共用 transport 的非 strict 相容路徑與 Ollama strict path 的責任邊界可讀且可測。
  - `03-FUNCTIONAL-DESIGN.md:221`、BUG-055 的 `06:291-296`、`07:295-299` 與 08 條目 `:10-14` 對 fatal decode、EOF flush、no-byte-reader、既有錯誤分類與 optimizer contract 的描述互相一致。
  - 目前 `docs/project-management/08-CHANGE-LOG.md:3-5` 仍將本輪標為「進行中」，且尚未填入 `獨立審查是否執行：` 與 `發布授權：`；`npm run docs:check:final` 已實際以四項錯誤拒絕結案。這是本輪唯一已確認的 closeout finding，需由主要代理回填本報告連結／逐字結論、狀態與必要欄位後重跑 final gate。
  - 這項治理 finding 不代表 BUG-055 source regression，也不替 BUG-060／BUG-061 routing／schema 變更建立完成證據。

## 5. 測試覆蓋

- 判定：通過（測試有效覆蓋本輪 deterministic contract）；治理 final gate 另見「可維護性與文件一致性」。
- 證據：
  - `2026-10-29T16:09:20+08:00` 執行五個 allowlist source／test `node --check`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-optimizer.mjs` 與 `git diff --check`，全部 exit 0；輸出包含 provider contract、Ollama multi-batch 與 optimizer tests passed。
  - `scripts/test-ai-providers.mjs:247-295` 覆蓋正常 NDJSON、malformed NDJSON、合法跨 chunk UTF-8、invalid byte、truncated EOF、provider error；`:459-507` 覆蓋 strict fallback capability／abort／timeout／transport 分類與 non-strict compatibility。
  - `scripts/test-ollama-batch-stream.mjs:40-112` 以 optimizer product path 驗證 provider error、malformed NDJSON 與 invalid UTF-8 各只呼叫一次且 checkpoint 次數為 0；`:114-139` 同時保留 timeout 的可重試正向案例。
  - `lib/ai/subtitle-optimizer.mjs:317-335` 只有 `error.retryable` 才 retry；` :343-349` 的 local repair 條件不包含 strict encoding／framing codes；成功 checkpoint 只在 `:491-497` validation 後執行。另於 `2026-10-29T16:10:13+08:00` 以 translate mode 的直接 product-path probe 實測 `ollama_stream_invalid_encoding`、`calls=1`、`checkpoints=0`。
  - `2026-10-29T16:09:24+08:00` 開始執行完整 `npm run check`，exit 0；包含治理 check、全套 syntax、`npm test`、AI provider／optimizer、Ollama offline／UI／stream 與其他既有 suites。完整 check 的成功不被解讀為 BUG-060／BUG-061 closeout。
  - `npm run docs:check:final` 於 `2026-10-29T16:09:48+08:00` exit 1；失敗項目是最新 08 工作條目的治理欄位／狀態，不是本輪 source 或 focused regression failure。

## 6. 實際運行結果

- 判定：通過（就範圍控制）；有條件限制來自治理 closeout，不是發布核准。
- 證據：
  - 本輪只以 BUG-055 allowlist 做 source／test／optimizer 審查；`git status --short` 顯示工作樹另有大量既有治理、source、evidence 與 review dirty entries，均未被本審查修改或視為 BUG-055 結案證據。
  - 沒有 stage、commit、push、candidate、release 或外部服務寫入；`09-STANDING-AUTHORIZATIONS.md` 的發布授權因此不適用於本輪。
  - 08 條目明確排除真實 Ollama、模型／版本、Windows、offline／full egress、packaged UI、簽署／公證、release 與 FR-021 overall acceptance；本報告維持相同限制。
  - residual risk：沒有 real Ollama raw response、跨模型／版本或 Windows evidence；250ms bounded cleanup 只保護 caller return／reader lock release latency，不證明 live Ollama／OS stream 已完成所有物理 teardown。

## 綜合判定

- 結論：有條件通過。
- 阻擋問題（若有）：
  - F-01（治理 closeout blocker）：`npm run docs:check:final` 於 `2026-10-29T16:09:48+08:00` exit 1，因最新 08 條目仍為「進行中」且缺少 `獨立審查是否執行：`、`發布授權：` 等必要欄位。主要代理須只在既有 08 closeout 流程中補齊本報告鏈結與逐字結論、完成狀態／欄位，再重跑 final gate；在此之前不得宣稱本輪無條件完成。
  - 本輪沒有新增 BUG-055 source／test／optimizer product blocker；BUG-060／BUG-061 routing／schema 不在本輪結案。
- 剩餘風險：本結論只適用 current dirty source 的 deterministic／fixture／local contract；不代表真實 Ollama、offline/full egress、release 或 FR-021 overall acceptance，也不代表其他 dirty work 的完成狀態。
- 可逐字引用的完整結論句：**本輪 BUG-055 next1 round1 獨立審查結論為有條件通過：目前 Ollama strict UTF-8 reader 已以 fatal decode 與 EOF flush 在 parser／repair 前對 invalid byte、truncated final sequence 與無 raw-byte reader fail-closed，fallback abort／timeout／transport 分類、reader cleanup、optimizer 不 repair／不 retry／不 checkpoint、focused／full deterministic checks 均通過，未發現 BUG-055 source blocker；但最新 08 工作條目仍為「進行中」且 `npm run docs:check:final` 因缺少獨立審查／發布授權欄位而失敗，主要代理完成治理 closeout 前不得宣稱無條件完成；本結論不代表真實 Ollama、offline/full egress、release 或 FR-021 overall acceptance，亦不結案 BUG-060／BUG-061。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告唯一寫入路徑是 `docs/project-management/reviews/2026-10-29-bug-055-ollama-strict-utf8-next1-round1.md`；本輪僅執行讀取、`node --check`、focused／full tests、diff check 與治理檢查。
- 本審查代理沒有 stage、commit 或 push；沒有修改 source、test、evidence、candidate、`00`／`06`／`07`／`08` 或既有 review。
- 本報告限制於 deterministic/local contract，不代表真實 Ollama、offline/full egress、release 或 FR-021 overall acceptance。
- 若上述聲明不實，本報告無效。
