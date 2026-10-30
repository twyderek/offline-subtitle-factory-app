# 獨立審查報告：BUG-061 provider regression coverage precision and governance closeout

- 審查對象 commit／版本：目前 dirty worktree；HEAD `f16ae8be60fb132bdbb1a128722a244f70f86e6b`、專案版本 `0.52.0`、Node.js `v22.22.3`。
- 對應 08-CHANGE-LOG 條目：2026-10-29 — BUG-061 provider regression coverage precision and round2 closeout（`BUG-061-REGRESSION-COVERAGE-NEXT1-REVIEW`）。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-29 16:16（Asia/Taipei）；先執行 `npm run project:preflight -- --type=full`，讀取 `AGENTS.md`、`docs/project-management/README.md`、01／02／03／06／07／09、development／test／independent-review／debug／closeout workflows、最新 08 條目與既有 round2 報告；本報告重新檢查目前 worktree，不把 round2 結果當作唯一證據。
- 審查限制：只讀取、執行與驗證；未修改 source、test、evidence、candidate、00／06／07／08 或既有 review，未 stage／commit／push。`lib/ai/providers.mjs` 的 dirty BUG-060 routing／schema 只作為 contract 來源核對，不算作本輪產品差異；本輪 scope 限 `scripts/test-ai-providers.mjs` 的 deterministic proofread assertion precision 與治理 closeout。

## 1. 需求完整性

- 判定：通過（限 test-only deterministic scope；治理 closeout 尚未完成）。
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-14` 將本輪唯一預定產品差異限定為 Ollama proofread schema 的 direct assertions，並明確排除 BUG-060 runtime、live Ollama／model、UI／Electron、Windows、offline／full egress、release 與 FR-021 overall。`scripts/test-ai-providers.mjs:112-134` 以 `operation: 'proofread'`、兩個 cue ID 與 deterministic request fixture 驗證 native proofread schema，直接斷言 `text.type === 'string'` 與 `reason.type === 'string'`。`scripts/test-ai-providers.mjs:235-245` 仍直接驗證 translate 的同一 item type、required、additionalProperties、ID enum 與 exact count。
- 證據：既有 BUG-061 coverage 亦仍在目前測試中可見：`scripts/test-ai-providers.mjs:142-170` 驗證 native 404 後 exactly two requests、fallback 的 exact `model`／`messages` 與 internal／native 欄位剝除；`:171-218` 驗證 custom native 400／500／strict stream failure 不 fallback 且只發一次 native request。未將這些 deterministic assertions 擴大解讀為 live product acceptance。
- 證據：目前 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:231-236` 與 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:237-242` 仍是 2026-10-28 BUG-061 round1／round2 pending wording，尚未形成 2026-10-29 next1 的 closeout 記錄；這是治理同步缺口，不是本輪 test scope 遺漏。

## 2. 邏輯正確性

- 判定：通過。
- 證據：BUG-060 contract source `lib/ai/providers.mjs:52-75` 的 shared builder 明確產生 root object、`cues` array、item `required: ['id', 'text', 'reason']`、`additionalProperties: false`、ID enum 與 `text`／`reason` string types；目前 proofread test 直接讀取實際 native request body 的對應欄位，而非只斷言 builder 原始碼文字存在。
- 證據：`lib/ai/providers.mjs:77-119` 保持 loopback Ollama native `/api/chat`、custom loopback 只在 HTTP 404 時 fallback、其他 status／strict parser failure 直接拋錯。測試的 fake transport 以實際 `createProvider(...).optimize()` 觸發此路由，故新增 type assertions 與既有 routing contract 連接在同一 request body 上。
- 證據：本輪未以測試重寫或複製 schema builder；`git diff --check` 通過。工作樹雖包含 dirty `lib/ai/providers.mjs`（BUG-060 來源差異），但本輪只將其視為 contract reference，未把該 source delta 宣稱為 next1 完成內容。

## 3. 邊界情況

- 判定：通過（限 deterministic transport／body contract）。
- 證據：實際測試案例涵蓋 default loopback `127.0.0.1:11434` native proofread、custom loopback `24567` native schema、`24568` native 404 fallback、`24569` HTTP 400 no-fallback、`24570` HTTP 500 no-fallback、`24571` HTTP 200 strict NDJSON `not-json` no-fallback，以及非 loopback `https://ollama.example.test/v1` 的 compatibility fallback（`scripts/test-ai-providers.mjs:112-224`）。
- 證據：proofread direct type assertions 位於實際 `ollamaNativeBody.format.properties.cues.items.properties`，不是只檢查 shared builder 或 translate body；translate 另以 `ollamaTranslateBody` 驗證 type、required、additionalProperties、ID enum、min／max items（`:233-245`）。
- 剩餘邊界：未測試真實 Ollama daemon 的其他版本／模型、模型品質、長 prompt、live network failure、Electron／UI、Windows 或真正 offline／full egress；這些明確不屬 BUG-061 next1 deterministic scope。

## 4. 程式碼品質

- 判定：通過。
- 證據：本輪新增的 proofread assertions 集中於 `scripts/test-ai-providers.mjs:133-134`，使用清楚的欄位名稱與 failure message，沒有把 regression-only code 寫入產品 runtime。既有 fake `globalThis.fetch` fixture 以 `try/finally` 恢復（`:147-160`、`:172-184`、`:188-200`、`:204-216`）。
- 證據：assertions 同時檢查 request body 的實際 schema shape 與必要欄位，沒有 secrets、model files、OS network、candidate 或 release mutation。`git diff --check` 於 2026-10-29 16:16:18 +08:00 exit 0。
- 證據：目前 dirty worktree 有大量既有 source／治理／evidence／review 變更；本審查未清理、覆寫或把 unrelated dirty work 視為本輪完成。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：2026-10-29 16:16:18 +08:00 獨立執行 `node --check scripts/test-ai-providers.mjs`，exit 0；`node scripts/test-ai-providers.mjs`，exit 0，輸出 `AI provider contract 與術語／Prompt 測試通過`；`node scripts/test-project-docs-validator.mjs`，exit 0；`git diff --check`，exit 0。
- 證據：獨立執行 `npm run check`，exit 0。輸出確認 `docs:check`、全套 npm tests、AI provider／optimizer、Ollama managed-child／offline UI／stream fixtures、核心 regression 與 YouTube suites 均通過；測試未啟動真實 Ollama acceptance。
- 證據：獨立執行 `npm run docs:check:final`，2026-10-29 16:16:49 +08:00 exit 1，明確回報最新工作紀錄缺少「獨立審查是否執行：」、缺少「發布授權：」、尚未標示「完成」，且獨立審查欄位不是是／否。這是本輪治理 closeout 的實際阻擋證據。

## 6. 實際運行結果

- 判定：部分通過；deterministic mock／fixture 實際運行通過，live／product scope 未執行。
- 證據：本輪實際執行了指定 syntax、provider regression、治理 validator、完整 `npm run check` 與 `git diff --check`；proofread type assertions 是在 fake fetch transport 產生的實際 Ollama native request body 上執行，不是靜態字串檢查。完整 regression 的 provider output 與各 suite 均為 exit 0。
- 證據：未呼叫真實 Ollama endpoint，未下載／停止／變更模型或 daemon，未啟動 Electron UI，未修改 OS network／firewall，未執行 Windows、offline／full egress、signing／notarization、release 或其他外部寫入。因此本輪不能替 BUG-060 source runtime、live Ollama／model quality、UI／Electron、Windows、offline／full egress、release 或 FR-021 overall 背書。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用的完整結論句：**本輪 BUG-061 next1 round1 獨立審查結論為有條件通過：`scripts/test-ai-providers.mjs:112-134` 已直接固定 Ollama proofread schema 的 `text.type` 與 `reason.type`，custom native 404 fallback 的 body stripping／exact two requests、custom native 400／500／strict failure no-fallback、translate schema 與其他 deterministic provider regression 均由本輪獨立重跑的 focused／full checks 通過；但治理 closeout 尚未完成，最新 08 條目仍為「進行中」、06／07 尚未同步本輪 closeout，且 `npm run docs:check:final` 因缺少「獨立審查是否執行：」、`發布授權：`與「完成」狀態而 exit 1；本結論僅適用 test-only deterministic scope，不代表 BUG-060 source 完成、live Ollama／model quality、Electron UI、Windows、offline／full egress、release 或 FR-021 overall acceptance。**
- 阻擋問題（若有）：有治理阻擋，無 BUG-061 deterministic runtime／test blocker。主要開發代理須完成最新 08 條目的 `狀態：完成`、`獨立審查是否執行：是`、本報告路徑與上述完整結論句引用、`發布授權：不適用` 及實際遺留風險欄位；並依責任矩陣同步 00／06／07 的本輪 closeout，最後重跑 `npm run docs:check:final`。審查代理不會代為修改這些檔案。
- 剩餘風險：目前證據只涵蓋 deterministic mock／fixture。Ollama 版本／模型 schema 接受度、模型品質、長 prompt／長字幕、live daemon、Electron UI、取消／續跑、Windows、真正 offline／full egress、signed／notarized release 與 FR-021 overall 仍未驗收。dirty `lib/ai/providers.mjs` 的 BUG-060 runtime routing／schema 仍應獨立視為其自身工作，不可因本輪 test green 而結案。
- 給主要開發代理的具體修正要求（若有）：只處理上述治理 closeout 欄位與 00／06／07 同步，重跑 final docs gate；不要把本輪 deterministic result 改寫成 live Ollama、model quality、UI／Windows、offline／full egress、release 或 FR-021 overall proof，也不要把 BUG-060 source dirty diff 算入本輪產品差異。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪唯一寫入路徑為 `docs/project-management/reviews/2026-10-29-bug-061-regression-coverage-next1-round1.md`；未修改 source、test、evidence、candidate、00／06／07／08 或既有 review，未 stage／commit／push。
- 本輪未啟動真實 Ollama、未下載／停止模型、未啟動 Electron UI、未修改 OS network／firewall、未執行 Windows／offline／full egress／signing／notarization／release 或外部服務寫入。
- 若上述聲明不實，本報告無效。
