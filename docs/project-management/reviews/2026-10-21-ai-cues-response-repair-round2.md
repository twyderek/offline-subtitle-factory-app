# 獨立複核報告：SYNC-028／BUG-051 AI 校稿回應 parser 修正

- 審查對象版本：目前 worktree `0.52.0`、HEAD `72019ca`；對照 GitHub `origin/codex/ai-cues-response-repair@056d2ad71d8b3ea982be9ccbceba19b9e98760b3`
- 對應 08-CHANGE-LOG 條目：2026-10-21 — GitHub AI 校稿回應修正同步與現行版本整合（SYNC-028）
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-10-21 10:00 CST；本輪重新讀取 `AGENTS.md`、project-management 核心與 workflow、最新 08 條目、round1 報告、03／06／07、parser、測試與目前 worktree 差異；本結論以本輪重新執行的證據為準，不沿用 round1 結論。
- 審查限制：除建立本報告外只執行讀取、指令與驗證；既有 dirty tree 保留，未修改程式、測試、治理來源文件、round1 報告、evidence 或發布資產。

## 1. 需求完整性

- 判定：通過
- 證據：最新 `08-CHANGE-LOG.md:3-26` 明列 `SYNC-028`、`BUG-051`、`FR-008`、`FR-010`、`FR-021`、root array／explicit `cues`、nested wrapper 負向界線、Ollama／LM Studio 一次 repair、非 local strict failure、JSON Schema 保留、測試範圍、dirty tree 保護，以及「發布授權：不適用」「部署／發布結果：不適用」與遺留風險欄位。`03-FUNCTIONAL-DESIGN.md:137-151`、`06-TEST-AND-PROCESS-AUDIT.md:3-9`、`07-DEBUG-AND-FIX-HISTORY.md:3-9` 與目前實作／測試內容一致。round1 指出的欄位缺漏已在 08 條目補齊；目前仍為「進行中」是等待本報告回填後的結案狀態，屬後續文件 closeout，不是本輪程式需求缺口。

## 2. 邏輯正確性

- 判定：通過
- 證據：`lib/ai/subtitle-optimizer.mjs:130-184` 以 balanced JSON candidate scanner 處理物件／陣列，並在 JSON string 內正確跳過 escaped quote 與括號；`:187-241` 只讓最外層字串的 root array 通過，wrapper 遞迴一律以 `allowRootArray=false`，明確 `cues` array 才可成為 cue list。`:334-366,454-472` 將 JSON／缺少 cues 的格式修復限定於 Ollama 與 LM Studio，repair body 以原 body spread 保留 response format，修復後仍重新走 strict `validateBatch`；非 local provider 不進該分支。`:485-490` 只在驗證成功後寫 checkpoint。

## 3. 邊界情況

- 判定：通過
- 證據：本輪以不落盤的 Node inline matrix 實測並通過：直接 root JSON array、含 Markdown fence／前後說明的 root array、明確 `cues` object 均成功；`response`、`output`、`result`、`data`、`content`、`message` 六種 wrapper 內的 explicit `cues` 均成功；同六種 wrapper 內的 serialized root array 均拒絕；text-part array 內的 root array 亦拒絕。另以 Ollama mock 驗證初次 unrelated nested array 後只 repair 一次並成功，openai-compatible mock 驗證 nested root array 只呼叫一次並 strict failure。上述 matrix 輸出：`independent parser boundary matrix passed: root/explicit/fence/wrappers/text-part/local-repair/non-local-strict`。

## 4. 程式碼品質

- 判定：通過
- 證據：parser 抽取、candidate 掃描、cue selection、validation 與 provider repair policy 分層於 `lib/ai/subtitle-optimizer.mjs:99-280,334-493`；`JSON_WRAPPER_FIELDS` 集中定義 wrapper，seen sets 防止物件／字串循環，錯誤 code 與 provider 分流清楚。`providers.mjs:5-14` 對 LM Studio 宣告 `structuredOutput: 'json-schema'`，`openai-compatible.mjs:139-147` 只移除 internal fields 且保留 `response_format`；未見本輪差異觸及 server、UI、封裝、package 或 Release。`git diff --name-status HEAD` 仍只有本輪六個預期 tracked paths，既有未追蹤 evidence 未被改寫。

## 5. 測試覆蓋

- 判定：通過
- 證據：2026-10-21 10:00 CST 前後重新執行並通過：`node --check lib/ai/subtitle-optimizer.mjs`、`node --check scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-fetch.mjs`、完整 `npm run check`、`git diff --check`、`npm audit --omit=dev`。`npm run check` 通過 19 份治理文件、完整核心 regression、AI／Ollama、offline／UI／stream 與 YouTube suites；audit 輸出 `found 0 vulnerabilities`。`scripts/test-ai-optimizer.mjs:41-139,397-497` 明確覆蓋 root／fence／text-part／nested explicit cues、六種 wrapper 負向案例、Ollama／LM Studio 單次 repair、非 local strict failure、Schema repair 保留與 failure checkpoint 不寫入。

## 6. 實際運行結果

- 判定：通過
- 證據：本輪先執行 `npm run project:preflight -- --type=full`，確認固定核心、路由文件與 dirty tree；再依序完成 focused checks、完整 `npm run check`、inline parser boundary matrix、`git diff --check` 與 `npm audit --omit=dev`，全部 exit 0。`npm run docs:check:final` 亦實際執行，但目前仍回報最新 08 條目為「進行中」、round1 舊報告不符合現行固定 heading／結論 validator、且 08 尚未引用本 round2；這是本報告建立後由主要代理完成的文件 closeout 動作，不是 parser、測試、隱私、發布或回歸阻擋。發布／部署本輪不適用：沒有建立、推送或修改 tag、Release、PR、封裝或新公開資產。

## 綜合判定

- 結論：通過
- 可逐字引用的完整結論句：**本輪 round2 複核確認 SYNC-028／BUG-051 的 AI cue response parser 邊界、explicit cues、nested wrapper 負向案例、Ollama／LM Studio 一次性 local repair、非 local strict failure、JSON Schema 保留、測試、dirty tree 保護與發布／安全界線均通過，未發現產品、回歸、隱私或發布阻擋。**
- 阻擋問題（若有）：無。
- Findings severity：無 P0／P1／P2 產品或發布阻擋；文件 closeout 尚須由主要代理將本報告連結至最新 08 條目、逐字引用上述結論並標示條目完成後，再重跑 `npm run docs:check:final`。該後續是結案流程必要動作，但在本 round2 審查範圍內不構成程式或發布 blocker。
- round1 條件狀態：round1 指出的 08 欄位缺漏已由目前條目補齊；本輪重新檢查未發現其所涉程式／測試／dirty tree／安全問題復發。round1 報告本身採用舊 heading 格式，故 validator 仍會報格式錯誤；本報告已依現行 validator 要求使用六個固定 heading，不能把該格式缺口誤判成產品邏輯缺陷。
- 剩餘風險：deterministic mock 不等同真實 Ollama／LM Studio 模型品質、endpoint、取消／續跑或 FR-021 完整本機人工驗收；若未來修改 parser 或 provider contract，仍須重跑 focused／full checks。非發布本輪不授權任何打包、推送、共享或 Release 操作。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
