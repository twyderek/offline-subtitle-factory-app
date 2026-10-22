# 獨立審查報告：Anthropic 新模型取樣參數相容性（BUG-027）

- 審查對象 commit／版本：`codex/0.51-anthropic-claude@17df9788abf2` 的未提交 BUG-027／FR-026 差異，產品版本 0.51.0。
- 對應 08-CHANGE-LOG 條目：2026-09-14 — Anthropic 新模型取樣參數相容性（BUG-027）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-09-14 15:38 CST（Asia/Taipei）；由主要開發執行緒另開的獨立上下文，只取得需求、限定檔案範圍與既有工作樹提示，未沿用開發代理的判定。
- 審查環境：Darwin 25.6.0 arm64、Node.js v22.22.3。

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:42` 與 `docs/project-management/08-CHANGE-LOG.md:14-15` 要求 Anthropic 最終 body 無條件省略 `temperature`、`top_p`、`top_k`，同時保留 `max_tokens`、system／messages、stop sequences，且其他 provider 行為不變。`lib/ai/anthropic.mjs:57-66` 採明確欄位清單，已滿足 Anthropic 省略要求並保留其餘指定欄位；`scripts/test-ai-providers.mjs:234-263` 亦覆蓋三欄省略、模型、token、system/messages、metadata 過濾與 response mapping。然而 `scripts/probe-provider-live.mjs:61-72` 從所有 provider 共用的 live probe body 移除既有 `temperature: 0`，不符合「其他 provider 行為不變／不修改其他 provider 取樣參數」的明定範圍。
- 外部依據：2026-09-14 實際核對 Anthropic 官方 [Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations) 的 API parameter deprecations；文件指出 Claude Opus 4.7 及後續模型對非預設 `temperature`、`top_p`、`top_k` 回覆 400，建議省略並改用 prompting，故 BUG-027 本身具有效且現行的官方依據。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：2026-09-14 15:38 CST 執行 `node scripts/test-ai-providers.mjs` exit 0；截取到的 Anthropic `/v1/messages` request 具正確 `x-api-key`、`anthropic-version`、model、`max_tokens`、system/messages，三個取樣欄位皆為 `undefined`，回應亦映射至 `choices[0].message.content`。另以 `toAnthropicBody()` 直接輸入 `temperature:0`、`top_p:0.8`、`top_k:20`、`stop_sequences:["END"]`、連續 user 訊息，實際輸出只含 model、`max_tokens`、system、合併後 messages 與 stop sequences，結果符合設計。阻擋點在共用 probe：`git show HEAD:scripts/probe-provider-live.mjs` 顯示原第 71 行為 `temperature: 0`，目前 `scripts/probe-provider-live.mjs:61-72` 已移除；該 body 會直接交給所選 provider，因此修改不只作用於 Anthropic。
- 阻擋問題細節：`lib/ai/openai-compatible.mjs:139-147` 只移除內部 metadata，會保留 caller 提供的取樣欄位；`lib/ai/providers.mjs:134-165` 的 Azure／Gemini 路徑亦會保留該欄位。獨立 mock 實測 openai、openai-compatible、groq、gemini、azure、lm-studio 在 caller 提供 `temperature:0`、`top_p:0.8`、`top_k:20` 時均原樣外送。故從共用 probe 刪除 `temperature:0` 會改變這六種非 Anthropic live acceptance request，與工作條目宣稱的其他 provider 不變相衝突。

## 3. 邊界情況

- 判定：通過
- 證據：2026-09-14 15:38 CST 的直接 `toAnthropicBody()` 測試同時輸入三個不相容欄位、body model、`max_tokens:333`、system、兩個連續 user、assistant 與 `stop_sequences:["END"]`；實際 JSON 為 `{"model":"claude-opus-4-7","max_tokens":333,"system":"sys","messages":[{"role":"user","content":"u1\n\nu2"},{"role":"assistant","content":"a"}],"stop_sequences":["END"]}`，證明三欄不會因值為 0 或其他有限數值而漏出，且相鄰角色合併與 stop sequences 未回歸。`scripts/test-ai-providers.mjs:215-275` 另涵蓋 Anthropic base URL 尾端 `/v1`、模型存在／缺失／空清單、GET 無生成 body 與回應正規化。
- 限制：未使用真實 API Key 測 Claude Opus 4.7+、proxy、速率限制或付費端點；這與工作條目明示的不在範圍一致，不影響 deterministic request contract 的判定。

## 4. 程式碼品質

- 判定：部分通過
- 證據：`lib/ai/anthropic.mjs:57-66` 以明確 allowlist 建構供應商 body，省略規則集中、可讀且不依易過時的 model ID 分支；`node --check lib/ai/anthropic.mjs`、`node --check scripts/probe-provider-live.mjs`、`node --check scripts/test-ai-providers.mjs` 均 exit 0，`git diff --check` 亦 exit 0。惟修改 `scripts/probe-provider-live.mjs` 的共用輸入是多餘且擴張範圍：保留 `temperature:0` 即可由 Anthropic adapter 驗證其確實被濾除，同時維持其他 provider 既有 acceptance request，不需要在通用呼叫端做供應商特例的全域退化。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-09-14 15:38 CST 實際執行三個 `node --check`、`node scripts/test-ai-providers.mjs`、直接 `toAnthropicBody()` 邊界斷言、六種非 Anthropic provider 取樣欄位 mock 斷言及 `git diff --check`，全部 exit 0；之後執行完整 `npm run check` exit 0，包含治理文件、Whisper、Breeze、Electron、字幕、媒體、AI fetch／optimizer／provider、Ollama streaming、review UI 與 core 回歸。新增的 `scripts/test-ai-providers.mjs:241-258` 可防止三個 Anthropic 欄位重新外送。
- 缺口：正式回歸案例未將 `stop_sequences` 放入 Anthropic optimizer input 並斷言保留，也未約束共用 live probe 對非 Anthropic provider 仍提供既有 `temperature:0`；因此完整測試為綠仍未偵測本輪的 probe 行為變更。建議修正 probe 後至少新增來源／body contract 驗證，並把 stop sequences 保留納入同一 Anthropic request assertion。

## 6. 實際運行結果

- 判定：部分通過
- 證據：2026-09-14 15:38 CST 在 Darwin 25.6.0 arm64、Node.js v22.22.3 完整執行 `npm run check`，exit 0，終端最終回報核心回歸測試通過；focused provider 測試與直接 body 邊界測試亦均實際成功。由於本輪依工作範圍未配置真實 Anthropic API Key，沒有對外送出付費請求；官方相容性要求以文件核對、最終 request body mock 與純函式輸出驗證。現有實測足以確認 Anthropic 修正，但 `git show HEAD:scripts/probe-provider-live.mjs` 與目前第 61-72 行的對照已確認非 Anthropic live probe 請求內容發生變更，故不能據綠燈測試宣稱整體成功條件全部完成。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**BUG-027 round1 獨立審查判定不通過：Anthropic adapter 已正確省略 temperature、top_p、top_k，且完整回歸通過，但共用 live probe 同時移除了六種非 Anthropic provider 原有的 temperature:0，違反其他 provider 行為不變的成功條件，須修正後複審。**
- 阻擋問題（若有）：`scripts/probe-provider-live.mjs` 不應全域刪除共用 body 的 `temperature:0`。請恢復該欄位，讓 `lib/ai/anthropic.mjs` 單獨負責 Anthropic 的三欄過濾；如此 live probe 同時能覆蓋 BUG-027 的真實轉接路徑，且不改變其他 provider 既有取樣輸入。修正後須重跑 focused provider 測試、直接／自動的 stop sequences 與 sampling contract、完整 `npm run check`、`git diff --check`，並建立 round2 報告複審。
- 剩餘風險：未以真實 Claude Opus 4.7+ 或付費 API Key 驗證外部端點，proxy、模型品質、計費與速率限制仍未覆蓋；正式自動測試尚未固定 stop sequences 保留及共用 live probe 的跨 provider 輸入契約。
- 給主要開發代理的具體修正要求（若有）：僅回復 `scripts/probe-provider-live.mjs` 的 `temperature:0` 共用 probe 輸入，由 Anthropic adapter 過濾；補上 stop sequences 保留斷言與 probe 非 Anthropic 行為防回歸測試，再依影響執行 round2 獨立複審。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
