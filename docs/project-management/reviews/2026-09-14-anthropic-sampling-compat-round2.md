# 獨立複審報告：Anthropic 新模型取樣參數相容性（BUG-027）

- 審查對象 commit／版本：`codex/0.51-anthropic-claude@17df9788abf2` 的未提交 BUG-027／FR-026 round1 修正差異，產品版本 0.51.0。
- 對應 08-CHANGE-LOG 條目：2026-09-14 — Anthropic 新模型取樣參數相容性（BUG-027）
- 前輪報告：`docs/project-management/reviews/2026-09-14-anthropic-sampling-compat-round1.md`
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-09-14 15:54 CST（Asia/Taipei）；由主要開發執行緒再次委派的獨立複審上下文，只讀檢查目前差異與 round1 報告，未採用主要代理的預設結論。
- 審查環境：Darwin 25.6.0 arm64、Node.js v22.22.3。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:42` 與 `docs/project-management/08-CHANGE-LOG.md:14-15` 要求 Anthropic 最終 body 無條件省略 `temperature`、`top_p`、`top_k`，保留 model、`max_tokens`、system/messages、stop sequences、認證及 response mapping，且其他 provider 行為不變。`lib/ai/anthropic.mjs:57-66` 只輸出 Anthropic 支援欄位；`scripts/test-ai-providers.mjs:235-266` 對三欄省略與其餘契約均有斷言。round1 阻擋項已關閉：`scripts/probe-provider-live.mjs:61-73` 已恢復共用 `temperature:0`，且 `git diff --exit-code -- scripts/probe-provider-live.mjs` 於本輪 exit 0，證明該檔與基準版本一致。

## 2. 邏輯正確性

- 判定：通過
- 證據：2026-09-14 15:54 CST 執行 `node scripts/test-ai-providers.mjs` exit 0；實際 Anthropic mock request 具 `/v1/messages`、`x-api-key`、`anthropic-version`、model、`max_tokens`、system/messages 與 `stop_sequences:["END"]`，而 `temperature`、`top_p`、`top_k`、OpenAI 專用欄位及內部 metadata 皆未出現在最終 body，回應仍正規化至 `choices[0].message.content`。另以 `toAnthropicBody()` 直接輸入三個取樣欄位、`max_tokens:333`、連續 user、assistant 與 stop sequence，結果精確符合預期；未發現依 model ID 分支或不支援欄位漏出。
- round1 修正核對：共用 probe 的 `temperature:0` 會進入所選 provider 的 optimizer，但 Anthropic 在 `lib/ai/anthropic.mjs:57-66` 局部過濾；非 Anthropic adapter 未被本輪修改。獨立 mock 實測 openai、openai-compatible、groq、gemini、azure、lm-studio 在收到 `temperature:0`、`top_p:0.8`、`top_k:20` 時仍原樣外送，六種行為均通過。

## 3. 邊界情況

- 判定：通過
- 證據：直接 body 測試同時涵蓋零值 `temperature:0`、有限小數 `top_p:0.8`、整數 `top_k:20`、body model 覆蓋 config model、`max_tokens:333`、system、兩個連續 user、assistant 及 `stop_sequences:["END"]`；輸出保留 model、token、system、合併後 messages、stop sequence，且完全無三個取樣欄位。`scripts/test-ai-providers.mjs:215-278` 另涵蓋尾端 `/v1` base URL、模型存在／缺失／空清單、GET 無生成 body、認證 header 與 response mapping；本輪均實際通過。
- 外部界線：未使用真實 Claude API Key、Claude Opus 4.7+、proxy、付費、速率限制或封裝後端點；此限制已列於 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:26` 與工作範圍，屬已揭露的外部驗收風險，不是本輪 deterministic contract 阻擋項。

## 4. 程式碼品質

- 判定：通過
- 證據：Anthropic body 轉換維持集中式明確 allowlist（`lib/ai/anthropic.mjs:57-66`），修正僅刪除三個不相容欄位，不新增模型名稱判斷；`git diff --name-only -- lib/ai` 僅列出 `lib/ai/anthropic.mjs`。round1 後共用 live probe 已完整回復基準，避免供應商特例污染通用 caller。`node --check lib/ai/anthropic.mjs`、`node --check scripts/probe-provider-live.mjs`、`node --check scripts/test-ai-providers.mjs` 與 `git diff --check` 全部 exit 0。

## 5. 測試覆蓋

- 判定：通過
- 證據：`scripts/test-ai-providers.mjs:242-266` 正式覆蓋三個不相容欄位不得外送、`stop_sequences` 必須保留、system/messages、token、metadata 與 response mapping；第 280-281 行讀取共用 live probe source 並固定 `temperature:0` 契約。2026-09-14 15:54 CST 實際執行 focused provider 測試、直接 Anthropic 邊界斷言、六種非 Anthropic provider 取樣欄位矩陣、probe 與 HEAD 零差異檢查及 `git diff --check`，全部 exit 0。其後完整 `npm run check` exit 0，涵蓋治理、Whisper、Breeze、Electron、字幕、媒體、AI fetch／optimizer／provider、Ollama streaming、review UI 與 core 回歸。

## 6. 實際運行結果

- 判定：通過
- 證據：2026-09-14 15:54 CST 在 Darwin 25.6.0 arm64、Node.js v22.22.3 執行 `npm run check`，exit 0，最終回報核心 API token、Origin、Whisper 清理、串流上傳、任務、聲波、修剪、字幕重算、還原、分頁與取消狀態全部通過。focused 指令另回報 `AI provider contract 與術語／Prompt 測試通過`、`Anthropic edge contract pass`，以及六種非 Anthropic provider `sampling fields preserved`。未執行真實付費端點符合本輪明定範圍；in-scope request contract 已有可重現的實際執行證據。

## 綜合判定

- 結論：通過
- 可逐字引用的完整結論句：**BUG-027 round2 獨立複審判定通過：round1 的共用 live probe 回歸已關閉，Anthropic 最終請求會省略 temperature、top_p、top_k 並保留 stop_sequences 與既有契約，六種非 Anthropic provider 行為及完整回歸均實測通過，無阻擋問題。**
- 阻擋問題（若有）：無；round1 要求恢復 `scripts/probe-provider-live.mjs` 的 `temperature:0`、補 `stop_sequences` 與 probe source contract，三項均已完成並由本輪重跑驗證。
- 剩餘風險：未使用真實 Anthropic API Key 或 Claude Opus 4.7+，因此外部 endpoint、proxy、模型品質、計費、速率限制及跨平台封裝後行為仍待另行授權驗收；本輪結論限 deterministic request／response contract 與現有自動回歸。
- 給主要開發代理的具體修正要求（若有）：無。可依文件結案流程逐字引用本報告結論、同步最新工作條目並執行 `npm run docs:check:final`。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
