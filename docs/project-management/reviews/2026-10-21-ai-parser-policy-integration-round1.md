# 獨立審查報告：SYNC-030 AI parser 未提交變更整理與 LM Studio policy integration

- 審查對象 commit／版本：目前 worktree；`HEAD` 為 `72019ca7b2553a07f6bc9d872318b43a7d240c3b`，專案版本 `0.52.0`；另核對遠端 `origin/codex/0.51-anthropic-claude@22f7a09767923973c698fa817c543a1e586495f4`。本輪沒有建立或合併 commit。
- 對應 08-CHANGE-LOG 條目：`2026-10-21 — AI parser 未提交變更整理與 LM Studio 政策整合（SYNC-030）`
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-21（Asia/Taipei）；獨立審查上下文，重新讀取 repo `AGENTS.md`、`npm run project:preflight -- --type=full` 列出的固定核心與完整任務路由。preflight 於 `2026-10-21T03:48:17Z` exit 0；未沿用主要代理的品質評價。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:3-24` 明確記錄 SYNC-030 的範圍、來源 `72019ca`／`22f7a09`、不覆蓋 dirty evidence／reviews、LM Studio compatibility-only、Ollama active、parser 邊界與驗證計畫；但同段目前仍為「進行中」，`實際修改`、`開發驗證結果`、`獨立審查是否執行` 與 `獨立審查結論` 仍是「待執行」。
  - `docs/project-management/00-CURRENT-STATUS.md:3-7`、`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:52-54`、`docs/project-management/03-FUNCTIONAL-DESIGN.md:153` 一致宣告 LM Studio 已終止開發，不是 active support／驗收／bug triage／下載／同步／新功能目標；既有 code、deterministic tests 與歷史僅保留相容性／追溯；Ollama 仍是 active 本機 provider。
  - `docs/project-management/03-FUNCTIONAL-DESIGN.md:137` 與 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 對 parser 的 root array、explicit `cues`、text-part、wrapper、negative array、Ollama 一次性 repair、非本機 strict failure、Schema 保留與 checkpoint 邊界均有對應設計／稽核敘述。
  - 遠端 policy commit 的檔案清單由 `git diff-tree --no-commit-id --name-status -r 22f7a09767923973c698fa817c543a1e586495f4` 核對為 `00`、`02`、`03`、`08` 與兩份 LM Studio review。以 `diff -q <(git show 22f7a09:<file>) <file>` 核對，`00`、`02`、`2026-10-21-lm-studio-policy-round1.md`、`2026-10-21-lm-studio-policy-round2.md` 完全一致；`03` 僅多出本機 parser 設計段落，`08` 保留 SYNC-030／既有 SYNC-028 overlay。沒有發現遠端政策被本機 parser 變更覆蓋。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `lib/ai/subtitle-optimizer.mjs:99-185` 將字串、text-part、wrapper 欄位、BOM、Markdown fence、周邊文字與 balanced JSON candidate 分層抽取；`lib/ai/subtitle-optimizer.mjs:187-213` 只在允許 root array 的位置接受根陣列，wrapper 內跳過直接陣列，只接受明確 `cues` 或再往已列出的 wrapper 字串／物件尋找 candidate。
  - `lib/ai/subtitle-optimizer.mjs:215-241` 對字串 root array 與 explicit `cues` 進行解析；合法 JSON 但沒有 cues 會產生 `missing_cues`，非 JSON 產生 `invalid_json`。`lib/ai/subtitle-optimizer.mjs:243-280` 仍嚴格驗證數量、ID、順序、非空文字與長度，並只從 source cue 的 `start`／`end` 寫入 suggestion（`lib/ai/subtitle-optimizer.mjs:485-490`），未接受模型回傳的時間碼。
  - `lib/ai/subtitle-optimizer.mjs:79-85` 以 JSON Schema 優先於一般 `json_object`；repair body 使用 `...body` 保留原 `response_format`（`lib/ai/subtitle-optimizer.mjs:350-367`）。測試 `scripts/test-ai-optimizer.mjs:93-139` 實際斷言 Schema、一般 JSON mode 與停用 response format 三種結果。
  - `lib/ai/subtitle-optimizer.mjs:334-367`／`459-483` 將 JSON 結構 repair 限定於 `ollama`／`lm-studio`，每一批只在一次 validation catch 中送出一個 repair；Ollama 的長文字 repair 另由 `345-347`／`463-467` 限定，非本機 provider 不進入 local repair。
  - 未修改的 provider registry 仍在 `lib/ai/providers.mjs:5-25` 保留 `ollama` 與 `lm-studio` 的清楚分列，且 `lib/ai/providers.mjs:111-119` 使用 Ollama native adapter、LM Studio compatibility adapter；這符合「LM Studio 保留相容性、Ollama active」而非刪除或誤停用本機 provider。

## 3. 邊界情況

- 判定：通過（deterministic parser／provider contract 範圍）
- 證據：
  - root JSON array：`scripts/test-ai-optimizer.mjs:41-46`；explicit `cues` wrapper 與 Markdown fence／周邊說明：`48-60`。
  - text-part array：`scripts/test-ai-optimizer.mjs:62-70`；wrapper object、wrapper JSON string、巢狀 fenced string：`72-91`。
  - JSON Schema 保留與一般／停用 response format：`scripts/test-ai-optimizer.mjs:93-139`。
  - cue 數量與順序負向案例：`scripts/test-ai-optimizer.mjs:389-395`；Ollama／LM Studio 的 nested unrelated array 與 nested root array 不能直接變成 cues 且最多一次 repair：`419-448`。
  - 非本機 provider 對 fenced nested root array 與缺少 cues 維持 strict failure、請求次數各為 1：`scripts/test-ai-optimizer.mjs:451-479`。
  - failed JSON repair 不寫入 checkpoint、總請求最多兩次：`scripts/test-ai-optimizer.mjs:481-497`；failed length repair 亦不寫入完成 checkpoint：`312-329`。
  - 本輪未覆蓋真實 Ollama／LM Studio endpoint、真實模型輸出品質、FR-021 完整 UI／取消續跑／斷網流程、封裝產物與發布；這些限制也由 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:8-9` 明確揭露，未被 deterministic tests 冒充完成。另以 inline probe 實測空字串 `message.content` 會回報 `invalid_json`，缺少／null content 才回報「AI 未回傳字幕內容」；此分類差異未被現有回歸固定，屬低風險未覆蓋邊界。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - `git diff --stat` 顯示本輪 tracked diff 為 8 個檔案：6 份治理／稽核文件、`lib/ai/subtitle-optimizer.mjs`、`scripts/test-ai-optimizer.mjs`；沒有 `server.mjs`、`electron/`、`public/`、`package.json` 或 `package-lock.json` 的變更。
  - `git diff --name-only -- docs/project-management/evidence docs/project-management/reviews` 無輸出；未覆寫既有 evidence 或 review 原件。LM Studio policy 的兩份既有遠端 review 內容與 `22f7a09` 完全一致，並未改寫。
  - parser 將 candidate extraction、cue selection、validation、repair policy 與 response format decision 分開，且 repair 明確保留原 request body；沒有以截斷文字、放寬 ID／順序或 fallback 原文的方式掩蓋非 local failure。
  - `git diff --check` 於 `2026-10-21T03:46:56Z` exit 0；所有 focused syntax checks 亦 exit 0。

## 5. 測試覆蓋

- 判定：通過（本輪 deterministic／mock 與完整回歸範圍）
- 證據：
  - `2026-10-21T03:46:28Z–03:46:30Z`：`node --check lib/ai/subtitle-optimizer.mjs`、`node --check scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-optimizer.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-ollama-batch-stream.mjs`、`node scripts/test-ai-fetch.mjs`，全部 exit 0；輸出分別確認 optimizer、provider contract、Ollama streaming 與 fetch diagnostics 通過。
  - `2026-10-21T03:46:31Z–03:46:52Z`：`npm run check` exit 0；包含 `npm run docs:check`（19 份治理文件）、全部核心 regression、AI optimizer／provider、Ollama offline／UI／stream、YouTube suites，且沒有執行 live provider probe。
  - `npm run docs:check` 於 `2026-10-21T03:46:56Z` exit 0，`git diff --check` 同一時間 exit 0。
  - `npm run docs:check:final` 於 `2026-10-21T03:46:56Z` **exit 1**，實際回報最新 SYNC-030 尚未標示「完成」、仍有「待執行」欄位，且「獨立審查是否執行」尚未為是／否；此失敗被保留，沒有冒充 final gate 通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 實際執行的 focused 與 full commands 都是 deterministic／fixture tests；沒有執行 `probe:ollama:live`、`acceptance:ollama:*`、LM Studio endpoint、模型下載、發布或外部寫入，符合本輪明確限制。完整 check 的 Ollama tests 只使用 test fixture／mock；輸出明確記錄「no download」與清理通過。
  - `2026-10-21T03:47:54Z` post-test 核對：worktree 仍只有既存 8 個 tracked dirty 檔案加既有 `docs/project-management/evidence/`／`reviews/` 未追蹤內容；建立本報告前未追蹤 evidence／reviews 共 309 個，沒有 evidence／review 以外的未追蹤檔案；指定本報告路徑當時尚不存在。`/tmp` 下 `osf-*`、`offline-subtitle-*`、`subtitle-factory-*` test roots 均無殘留。
  - `lib/ai/providers.mjs:111-119` 與 `scripts/test-ai-providers.mjs:105-121` 實際保留並驗證 Ollama active native endpoint contract；`scripts/test-ai-providers.mjs:48` 仍驗證 LM Studio 僅作 provider registry／contract compatibility case，沒有把它標為新的實機驗收。
  - `git merge-base --is-ancestor 22f7a09 HEAD` 回傳 false，`git merge-base --is-ancestor HEAD 22f7a09` 回傳 false；因此 policy 是已整合到目前 worktree 的未提交內容，而不是已形成可宣稱已合併的 commit。這符合本輪禁止 stage／commit／push 的限制，但主要代理結案時仍須把 SYNC-030 的實際狀態與本報告連結補回 `08-CHANGE-LOG.md`。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 SYNC-030 獨立審查結論為有條件通過：AI parser 的 candidate 邊界、Ollama 一次性 repair、非本機 strict failure、JSON Schema 保留、failed checkpoint 與 LM Studio compatibility policy 均已由目前 worktree 與 deterministic/full checks 證實，遠端 `22f7a09` 政策亦以不覆蓋方式保留；但 SYNC-030 最新工作條目仍為「進行中」，`npm run docs:check:final` 因未結案欄位與未標示獨立審查而 exit 1，待主要代理完成報告連結／欄位整合後方可結案。**
- 阻擋問題（若有）：
  1. 主要代理須更新 `docs/project-management/08-CHANGE-LOG.md:18-24` 的 SYNC-030 實際修改、開發驗證結果、獨立審查欄位、完整報告連結／逐字引用、部署結果與遺留風險，移除不再正確的「待執行／待驗證」；不得修改本報告或既有 review 原件。
  2. 完成上述文件 closeout 後重跑 `npm run docs:check:final`；在其 exit 0 前不得宣稱 SYNC-030 已結案。
- 剩餘風險：
  - deterministic mock 只證明 parser contract、repair 次數、provider 分流與 checkpoint 行為，不證明真實 Ollama 模型品質、LM Studio 服務、網路 endpoint、完整 FR-021 UI／斷網／取消續跑或發布產物。
  - 空字串 response 目前分類為 `invalid_json` 而非「未回傳字幕內容」，未被回歸固定；若產品需要區分空回應與 malformed JSON，應另立小範圍修正與測試。
  - policy commit 尚未成為 HEAD 的祖先；本輪只確認其內容在 dirty worktree 以不覆蓋方式存在，未替主要代理作 commit／stage／push。
- 給主要開發代理的具體修正要求（若有）：依上列 closeout blocker 更新 SYNC-030，連結本報告並逐字引用本報告的完整結論句；保留「LM Studio compatibility/history only、Ollama active、無 live endpoint／模型下載」界線；完成後重跑 `npm run docs:check:final`。不需要因本輪 deterministic parser／provider 結果而啟動真實 LM Studio／Ollama endpoint。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案；未修改既有 review／evidence、未 stage／commit／push。
- 若上述聲明不實，本報告無效。
