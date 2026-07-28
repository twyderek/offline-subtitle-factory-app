# 獨立審查報告：修正 Whisper quality metadata round3 阻擋

- 審查對象 commit／版本：目前工作樹；`package.json` 版本 `0.46.0`；分支 `codex/release-v0.46.0`；工作樹含既有未提交變更
- 對應 08-CHANGE-LOG 條目：2026-07-27 — 修正 Whisper quality metadata round3 阻擋
- 審查輪次：round4
- 審查代理啟動時間、上下文來源：2026-07-27 09:58 CST（Asia/Taipei）；本輪依 `npm run project:preflight -- --type=full` 重新讀取治理規範、目前狀態、最新工作條目與獨立審查流程，未沿用主要開發代理的評價性摘要。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `server.mjs:1196-1199` 在 `runJob` 取得工作目錄後清除 `working/quality-metadata.json`，位置早於有效既有 SRT 判斷（`server.mjs:1210-1217`），因此包含跳過 Whisper 的既有 SRT `/start` 路徑。
  - `server.mjs:1285-1287` 在 `runWhisper` 開始時再次清除同一檔案；`server.mjs:1221-1222` 顯示所有由 `runJob` 進入 Whisper 的路徑均經過該清除邏輯。
  - `lib/whisper-quality.mjs:37-44` 現在保留輸入 segment 的 `id`；`readTime`（第 26-34 行）支援 `timestamps`、`offsets`，以及透過 `start`／`end` fallback 的標準 `segments[].start/end` 形狀。
  - `attachWhisperQuality`（`lib/whisper-quality.mjs:47-56`）已做 count、有效時間範圍、時間容許誤差與「若有 ID 則比對 ID」驗證；但缺少 ID 的 segment 仍可通過，故尚未達成嚴格 ID 驗證的完整要求。
  - 需求方要求同時保留真實 Whisper JSON 無 segment-level quality、Metal exit 139／SIGSEGV 與跨平台 runtime 風險；本輪實測與報告均保留這些限制，沒有把 rule-score fallback 宣稱為 engine quality。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - 2026-07-27 本輪以隔離資料目錄執行有效既有 SRT + stale metadata localhost probe：`POST /api/jobs/{id}/start` 回 `202`，任務進入 `completed`／`ready-review`，且 `staleExists:false`。這證明目前有效既有 SRT 路徑不再沿用舊 quality metadata。
  - `attachWhisperQuality` 的 count 檢查（第 48 行）會拒絕數量不一致；時間無效、結束早於開始或超出容許誤差會在第 51-56 行回落；錯誤的已提供 ID 會在第 52 行拒絕。
  - 本輪直接執行 parser probe：輸入 `{id:99,start:1,end:2}` 對 cue `{id:1,start:1,end:2}` 得到 `matched:false`；輸入沒有 `id` 的同時間 segment 則得到 `matched:true` 並保留 confidence。後者表示目前仍可在缺少 ID 時只靠時間成功對應，與「嚴格 ID 驗證」不一致。
  - `segments[].start/end` probe 得到 `id:1,start:0,end:1,confidence:0.4`，標準 schema 的時間與品質欄位可正確解析。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - `node scripts/test-whisper-quality.mjs` 通過，涵蓋空 `transcription` 回退 `segments`、字串 timestamp、null／超界 confidence、壞 quality 不刪 segment、count mismatch、時間 mismatch、ID mismatch、`segments[].start/end` 正例與既有雙語 cue 保留。
  - `readQuality`（`lib/whisper-quality.mjs:14-23`）只保存有限且位於 `[0,1]` 的 confidence／no-speech 值；本輪完整測試與既有負例均通過。
  - 有效既有 SRT stale probe 通過，證明跳過 `runWhisper` 的主要 round3 邊界已修正。
  - 缺少 segment ID 的邊界仍未被拒絕；目前沒有測試要求「每一個 quality segment 必須具備可驗證 ID」，因此嚴格 ID 契約仍有漏洞。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - parser／attach 已集中於 `lib/whisper-quality.mjs` 的純函式，server 只在 `runWhisperCpp` 成功產生 SRT 後嘗試讀 JSON 與套用 quality（`server.mjs:1487-1493`）；metadata 失敗不阻斷 SRT 完成，符合 rule-score fallback 的安全方向。
  - stale 清除在 `runJob` 的共同工作流程與 `runWhisper` 內均有明確位置，邏輯責任可追溯。
  - 目前 ID 驗證採「有 ID 才比較」的可選語意，沒有顯式表示缺少 ID 時應拒絕；若產品契約要求嚴格 cue identity，應改為缺少 ID 即回落並補測試。此問題不是格式容錯，而是資料對應安全邊界。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-27 本輪執行 `npm run check`：通過。輸出確認治理文件、JavaScript syntax、所有既有 parser／字幕品質／AI／UI 測試，以及核心 API 回歸均通過。
  - 2026-07-27 本輪執行 `node scripts/test-whisper-quality.mjs`：通過。
  - 2026-07-27 本輪執行 `node --check server.mjs && node --check lib/whisper-quality.mjs && node --check scripts/test-whisper-quality.mjs`：通過。
  - 2026-07-27 本輪執行 `git diff --check`：通過。
  - 2026-07-27 本輪執行 `npm run docs:check:final`：按預期失敗，明確指出最新工作條目尚未標示「完成」、仍有「待執行」欄位，且獨立審查欄位尚未填入是／否；這證明 final gate 命中最新條目，而不是誤檢查舊條目。
  - 目前沒有核心自動回歸覆蓋「有效既有 SRT + stale metadata + `/start` 後檔案不存在」，也沒有 parser 測試覆蓋「缺少 ID 必須拒絕」；本輪 probe 補充了實際證據，但不能替代正式回歸測試。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - `tools/whisper-cpp/whisper-cli --help` 顯示 `-oj/--output-json` 與 `-ojf/--output-json-full`。
  - 2026-07-27 本輪使用內建 `ggml-tiny.bin` 與 1 秒靜音 WAV 實際執行 Whisper.cpp：CPU `-ng -t 1` 回傳 code `0`，產生 SRT／JSON；預設路徑回傳 `SIGSEGV`，但仍留下 SRT／JSON。兩種 JSON 的 segment keys 均為 `timestamps`、`offsets`、`text`、`tokens`，quality key 檢查為空，沒有 segment-level `confidence`／`no_speech_prob`。
  - 因此 rule-score fallback 的「缺少 engine quality 時不偽造」已由實際 runtime 輸出支持；Metal／平台 runtime 仍不可視為穩定通過，且 Windows／macOS 封裝後、Electron renderer 與跨平台實機仍未驗收。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪 2026-07-27「修正 Whisper quality metadata round3 阻擋」round4 獨立複審結論為不通過：runJob/runWhisper 的 stale metadata 清除、parser 的 segment ID 保留、count／時間驗證與 `segments[].start/end` 支援、parser／完整 `npm run check` 與 `docs:check:final` 最新條目阻擋均已確認；但缺少 segment ID 的輸入仍可只靠時間成功對應，未達成嚴格 ID 驗證，且缺少有效既有 SRT stale metadata 的正式核心回歸測試，因此 0.47 rule-score fallback 可描述為可運作的條件交付，但本工作項目尚不可結案，也不可進入發布審查。真實 Whisper.cpp JSON 仍沒有 segment-level `confidence`／`no_speech_prob`，預設 Metal 路徑本輪重現 SIGSEGV（歷史 exit 139），跨平台 runtime 風險必須持續揭露。**
- 阻擋問題（若有）：
  1. 明確決定並實作嚴格 ID 契約：quality segment 缺少 ID 時應回落，不得僅以時間成功對應；補 parser／attach 負例，並確認錯誤／缺失 ID、count、時間 mismatch 都不寫入 quality metadata。
  2. 將有效既有 SRT + stale metadata `/start` probe 固化為核心 API regression，驗證任務完成後檔案不存在且 `review-data` 不會套用舊品質資料。
  3. 若要宣稱 engine quality 完成，需取得真實 runtime 明示的 segment-level `confidence`／`no_speech_prob` 並完成端到端映射；不得從 token `p` 推導。此項不阻擋 rule-score fallback 條件交付，但阻擋完整 engine-quality 驗收。
- 剩餘風險：
  - 內建 runtime 的 CPU workaround 可完成 smoke，但預設 Metal 路徑本輪 SIGSEGV；Windows／macOS 封裝後、Electron renderer、跨平台實機、Python fallback 成功路徑與真實長音訊轉錄仍未驗收。
  - `server.mjs:1493` 對 metadata 解析採空 catch，解析失敗原因不會保存為可診斷事件。
  - `package.json` 仍為 `0.46.0`；本輪沒有版本升級、打包、發布授權、安裝資產或 SHA 證據。
- 給主要開發代理的具體修正要求（若有）：先補嚴格 ID 缺失回落與正式 stale regression，建立下一輪獨立複審；在此之前只能將 rule-score fallback 標示為條件交付，不能進入 0.47 發布審查。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪 localhost probe、WAV、Whisper JSON／SRT 與 log 均位於 `/private/tmp`；未將測試資料寫入專案工作樹。
- 若上述聲明不實，本報告無效。
