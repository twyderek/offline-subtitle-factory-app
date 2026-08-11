# 獨立審查報告：0.48.x 穩定化：Ollama single-cue contract 修正

- 審查對象 commit／版本：目前工作樹／`0.48.0`；本輪差異為 `scripts/probe-ollama-live.mjs` 的 native single-cue probe，以及 `06-TEST-AND-PROCESS-AUDIT.md`／`08-CHANGE-LOG.md` 對應紀錄。
- 對應 08-CHANGE-LOG 條目：2026-07-30 — 0.48.x 穩定化：Ollama single-cue contract 修正
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-30T15:47+08:00；由主要代理啟動的獨立審查上下文，自行執行 development preflight、檢查本輪差異、生產 provider／optimizer、相關回歸及 `/tmp/ollama-contract-rerun.json` raw evidence。
- 審查需求：`FR-021`、`NFR-005`、`NFR-006`。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:55-61` 要求不放寬 cue ID／數量／順序／時間碼驗證，並把合法 JSON 與模型品質分開；`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:142-144` 也只將本輪定位為 Ollama native contract 證據，不宣稱 LM Studio、斷網或跨平台完成。
  - 生產 `lib/ai/subtitle-optimizer.mjs:91-124,188-225` 仍由 `validateBatch` 檢查 cues array、段落數、ID、重複 ID、順序及文字長度，再把建議綁回原 cue 的 start／end；本輪沒有修改或繞過該路徑。
  - 但目前 live probe 只直接呼叫 native endpoint 並保存 raw response，沒有把 response 送入生產 optimizer 的 parser／validator；因此它能支持 native structured-output 成功，尚不能單獨證明產品端完整 ID／順序／時間碼 contract 已走完。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - `/tmp/ollama-contract-rerun.json:71-143` 顯示 single-cue 實際送往 `http://127.0.0.1:11434/api/chat`，使用 `stream:false`、temperature 0、object schema，HTTP 200 response 的 `message.content` 可解析為單一 `cues` array，ID 為 1。
  - 2026-07-30T15:49+08:00 本審查以 Node 解析 raw content並斷言 endpoint、count、ID；結果通過，且可重現原文 `這是一個測試字幕。` 被改為 `這是一個測試字幕.`。
  - probe schema `scripts/probe-ollama-live.mjs:25` 將 `id` 定義為任意 `integer`，但生產 adapter `lib/ai/providers.mjs:59-77` 使用 `id: { enum: body.subtitle_cue_ids }`；probe 因而沒有重放生產端在 schema 層拒絕錯誤 ID 的約束。
  - probe messages `scripts/probe-ollama-live.mjs:24` 也不是生產 optimizer 的 messages：生產 system prompt 位於 `lib/ai/subtitle-optimizer.mjs:197-205`，包含模式、語言、全形標點、禁止佔位文字等規則，且 user payload 只有 `{id,text}`；probe 使用簡化 prompt 並額外放入 start／end。故目前「重放生產 adapter」的敘述過強。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - `scripts/test-ai-optimizer.mjs:125-131` 覆蓋段落數不足與 cue 順序交換拒絕；`lib/ai/subtitle-optimizer.mjs:97-101` 亦明確拒絕未知、重複及順序錯誤 ID。這些既有 strict 邊界未因本輪 probe 變更退步。
  - `scripts/test-ai-providers.mjs:50-59` 驗證標準 Ollama 端點使用 `/api/chat`、`stream:false`、temperature 0 及依 cue count 設定 minItems／maxItems。
  - 現有 provider 測試未斷言生產 native schema 的 ID enum；本輪 probe 也沒有負例驗證錯誤 ID、額外 cue、缺 reason、Markdown 或 malformed JSON 仍被產品 validator 拒絕。
  - probe 對所有 loopback Ollama URL 都改走 native `/api/chat`；生產 `lib/ai/providers.mjs:47-50` 則只在標準 11434 port 使用 native path，其他 port 回退 OpenAI-compatible。預設 11434 本輪 evidence 一致，但自訂 port 行為並非等價重放。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - `scripts/probe-ollama-live.mjs:19-27,31-41` 的 native request 結構清楚，保留 manual redirect、精確 loopback 限制、raw response 與既有防覆寫行為；沒有修改發布資產或產品 adapter。
  - probe 重新手寫一份 schema 與 messages，已與生產 schema／prompt 發生實質漂移。若目的是 production parity，應由共用 builder／adapter 產生 request，或至少以共享 fixture 逐欄比對，避免日後再次出現 probe 與產品不一致。
  - 2026-07-30T15:50:48+08:00 執行 `node --check scripts/probe-ollama-live.mjs` 與 `git diff --check`，均 exit 0。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-30T15:50:48+08:00 本審查執行 `node scripts/test-ai-providers.mjs` 與 `node scripts/test-ai-optimizer.mjs`，均 exit 0；provider native transport/schema count 與 optimizer 的固定 ID、時間碼綁定、段落數／順序拒絕均維持通過。
  - `docs/project-management/08-CHANGE-LOG.md:61` 記錄主要代理的受控 `npm run check` 通過；本輪針對性重跑支持「未放寬 production strict contract」。
  - 缺少 probe-to-production parity 測試：沒有比對 schema ID enum、實際 system/user messages，也沒有將 live response 餵入生產 optimizer 驗證。這正是本輪聲稱「重放生產 adapter」時最需要的覆蓋。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - `/tmp/ollama-contract-rerun.json:2-23,71-143` 是 Ollama 0.32.5／`llama3.2:1b` 的真實 loopback raw response；native schema 確實讓這次 single-cue 產生合法 cues JSON，數量 1、ID 1。
  - 模型把中文全形句號改為英文半形句號。`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:143` 與 `docs/project-management/08-CHANGE-LOG.md:61` 均明確標為品質／人工審核風險，沒有藉此放寬 contract 或宣稱自動接受，風險揭露誠實。
  - `/tmp/ollama-contract-rerun.json` 是暫存檔，並非專案內持久版本化 evidence；結案後無法保證仍存在。對 `NFR-006` 的可回溯性，應保存到 `docs/project-management/evidence/` 的唯一新檔名並由 audit／changelog 引用。

## 綜合判定

- 結論：有條件通過
- 阻擋問題：
  1. 讓 single-cue probe 真正對齊生產 request contract：至少使用與 `lib/ai/providers.mjs:59-77` 相同的 cue ID enum、與 `lib/ai/subtitle-optimizer.mjs:197-205` 相同的 messages／`{id,text}` payload，並將 response 經共用 parser／validator 或等價斷言檢查 ID、數量與順序。更佳作法是抽出共用 request/schema builder，避免再次漂移；若不調整，文件只能稱「native transport/schema smoke」，不得稱重放生產 adapter。
  2. 將 `/tmp/ollama-contract-rerun.json` 保存為 `docs/project-management/evidence/` 下不可覆寫、日期與用途明確的新 raw artifact，並更新 06 audit／08 changelog 引用，確保 `NFR-006` 可持久回溯。
- 剩餘風險：
  - 真實 1B 模型仍會改寫全形標點；合法 contract 不代表建議品質可自動接受。
  - capability 本輪仍走 OpenAI-compatible endpoint；自訂非 11434 port 的 Ollama production fallback 與 probe native path 不一致。
  - LM Studio、真正斷網、產品 UI 人工接受／取消／續跑及跨平台實機仍未完成。
- 給主要開發代理的具體修正要求：依兩項阻擋收斂 probe／文件與持久 evidence；保留目前 production optimizer strict validation 與全形句號品質警示，修正後建立 round2 複審。

**本輪「2026-07-30 — 0.48.x 穩定化：Ollama single-cue contract 修正」round1 獨立審查結論為有條件通過：生產 `subtitle-optimizer` 的 cues array、數量、ID、重複 ID、順序與時間碼綁定驗證未被修改，provider／optimizer 針對性回歸與語法檢查通過，Ollama 0.32.5／`llama3.2:1b` 的 native `/api/chat` raw response 也確為合法單一 cues JSON，文件並誠實把全形句號改半形列為人工品質風險；但 probe 的 ID schema 是任意 integer、messages 與 payload 也不同於生產 optimizer，且未將回應走過共用 strict validator，因此尚不能稱為重放生產 adapter，暫存於 `/tmp` 的 raw evidence 亦不具持久可回溯性；對齊共用 request／validator並保存版本化 raw artifact 後方可結案。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前已確認目標路徑不存在，未覆寫既有審查報告。
- 若上述聲明不實，本報告無效。
