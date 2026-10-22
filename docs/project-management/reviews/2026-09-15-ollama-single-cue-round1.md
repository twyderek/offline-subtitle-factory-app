# 獨立審查報告：Ollama 本機模型 single-cue 契約重驗（FR-021-030）

- 審查對象 commit／版本：`17df9788abf2` 基準上的未提交 BUG-030／FR-021 工作樹差異；版本 `0.51.0` 開發中。
- 對應 08-CHANGE-LOG 條目：2026-09-15 — Ollama 本機模型 single-cue 契約重驗（FR-021-030）。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-09-15T12:14:53+08:00；獨立上下文，未沿用開發代理對話記憶。

## 1. 需求完整性

- 判定：通過。
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md` 的 FR-021 要求本機 Ollama 採較小批次與嚴格 cue 契約，且不以本輪結果宣稱 LM Studio／斷網整體完成；`08-CHANGE-LOG.md` 最新條目把範圍限定為 loopback Ollama single-cue 重驗。`lib/ai/subtitle-optimizer.mjs:205-208` 只對 `provider=ollama` 的無效 JSON 或缺少 `cues` 陣列啟用 repair，`lib/ai/subtitle-optimizer.mjs:113-136` 保留段落數、ID、順序、文字長度與翻譯語系檢查；`docs/project-management/03-FUNCTIONAL-DESIGN.md:91`、`07-DEBUG-AND-FIX-HISTORY.md:9-20` 與 `RELEASE-NOTES-0.51.0.md:12` 已同步此範圍與遺留限制。

## 2. 邏輯正確性

- 判定：通過。
- 證據：`parseCompletionContent()` 對合法但未包裝的 cue object 回傳 `undefined`，隨後由 `validateBatch()` 在 `lib/ai/subtitle-optimizer.mjs:105-115` 明確丟出「AI 回傳缺少 cues 陣列」；新條件在 `:205-208` 精準接住該錯誤，並在 `:333-337` 只發出一個 wrapper repair 後立刻重跑完整 validation，沒有接受原始未包裝物件或降低其他 provider 的門檻。`scripts/test-ai-optimizer.mjs:160-176` 實測第一次單 cue object、第二次 `{"cues":[...]}`，斷言恰為兩次請求且僅 wrapper 結果形成建議。

## 3. 邊界情況

- 判定：通過。
- 證據：`scripts/test-ai-optimizer.mjs:177-190` 實測 repair 第二次仍為 malformed JSON 時拒絕，且最多兩次請求；同檔 `:191-205` 延續涵蓋過長文字的獨立 repair。`lib/ai/subtitle-optimizer.mjs:113-136` 對空／非陣列、數量不符、重複或未知 ID、順序錯誤、空白或過長文字、翻譯過短與語系不符仍會拒絕。Ollama probe 也在 `scripts/probe-ollama-live.mjs:71-102` 檢查 provider test 與模型可用性，並在 `:125-127` 拒絕覆寫既有 evidence。未覆蓋的真實模型邊界已如實保留：多批次、取消、人工接受、LM Studio 與真正斷網（`07-DEBUG-AND-FIX-HISTORY.md:20`）。

## 4. 程式碼品質

- 判定：通過。
- 證據：修改集中於既有的 Ollama repair 判斷與 repair prompt（`lib/ai/subtitle-optimizer.mjs:205-231`），沒有新增跨 provider 特例、隱性回退或資料寫入。`scripts/probe-ollama-live.mjs:58-103` 以獨立 `responseShape()`／`runOptimizerAcceptance()` 封裝 live evidence，固定 `LIVE-OPT-1`、`batchSize: 1` 與 loopback 端點；`scripts/test-ai-providers.mjs:325-329` 亦防止 live probe 日後移除 product-path 呼叫或固定 cue contract。`node --check lib/ai/subtitle-optimizer.mjs`、`node --check scripts/test-ai-optimizer.mjs`、`node --check scripts/probe-ollama-live.mjs`、`node --check scripts/test-ai-providers.mjs` 均於 2026-09-15 審查時 exit 0。

## 5. 測試覆蓋

- 判定：通過。
- 證據：2026-09-15 審查中實際執行 `node scripts/test-ai-optimizer.mjs` 與 `node scripts/test-ai-providers.mjs`，分別輸出「AI 字幕優化測試通過：固定 cue ID、時間碼、差異建議、進度與回應驗證」與「AI provider contract 與術語／Prompt 測試通過」。另實際執行 `npm run check`，exit 0，涵蓋文件、Node 語法、媒體、雙語字幕、AI fetch／optimizer／provider、Ollama streaming、review UI 與核心 API 回歸；`git diff --check` 亦 exit 0。新增測試已直接覆蓋本缺陷的成功 repair 路徑與 repair 後 malformed 拒絕，且完整回歸未顯示其他 provider 行為退化。

## 6. 實際運行結果

- 判定：通過。
- 證據：審查代理以唯讀 JSON contract 檢查實際 artifact `docs/project-management/evidence/2026-09-15-ollama-llama3.2-1b-optimizer-recheck.json`，結果為通過；該檔 `:1-18` 記錄 loopback endpoint `http://127.0.0.1:11434/v1`、privacy `local`、Ollama `0.34.0` 與 `llama3.2:1b`，`:153-175` 記錄 native single-cue `valid=true`、provider modelAvailable、`suggestionCount=1`、`totalRetries=0` 與實際回應形狀 `cue-object` 後 `cues-array`。artifact 不含 API Key 或雲端 endpoint。`npm run docs:check:final` 在審查時預期失敗，唯一原因是最新工作紀錄仍標示待審查／未結案；主代理把本報告路徑與本節的完整結論句寫回工作紀錄、標示完成後必須重跑該結案檢查。

## 綜合判定

- 結論：通過
- 可逐字引用的完整結論句：**本輪 BUG-030／FR-021 Ollama 單句契約重驗獨立審查結論為通過：Ollama `llama3.2:1b` 的合法未包裝 cue object 只會觸發一次明確 wrapper repair，修復結果仍須通過既有 cue ID、數量、順序、文字長度與翻譯語系的嚴格驗證；新增 deterministic 回歸、完整 `npm run check`、差異格式檢查與本機 Ollama 0.34.0 實機 artifact 均通過，且未放寬其他 provider、未使用 API Key 或雲端服務；LM Studio、真正斷網、多批次、取消、人工接受與跨平台模型品質驗收仍是已揭露的後續風險，不得據此宣稱 FR-021 整體完成。**
- 阻擋問題（若有）：無；`npm run docs:check:final` 尚待主要代理依本報告完成 08-CHANGE-LOG 結案欄位後重跑，屬本審查交付後的必要文件收尾，非產品阻擋。
- 剩餘風險：本輪只實測 Ollama `llama3.2:1b` 的一個單句翻譯；repair 後仍可能因模型品質而被嚴格驗證拒絕，且尚未覆蓋 LM Studio、真正斷網、多批次、取消、人工接受與跨平台實機。`totalRetries=0` 表示沒有傳輸層 retry，responseShapes 證明曾發生一次 validation repair，兩者不可混為同一指標。
- 給主要開發代理的具體修正要求（若有）：無產品修正要求；請在 `08-CHANGE-LOG.md` 只連結本報告並逐字引用上述完整結論句，標示工作完成後執行 `npm run docs:check:final`。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
