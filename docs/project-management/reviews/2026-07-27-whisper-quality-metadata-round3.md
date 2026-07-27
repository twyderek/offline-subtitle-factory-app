# 獨立審查報告：接入 Whisper.cpp 品質 metadata 通道

- 審查對象 commit／版本：工作樹 `8d042d3b2e0b63957020d391f3758b59db3e9407`；`package.json` 版本 `0.46.0`；分支 `codex/release-v0.46.0`；工作樹含既有未提交變更
- 對應 08-CHANGE-LOG 條目：2026-07-27 — 接入 Whisper.cpp 品質 metadata 通道
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-07-27 09:51 CST（Asia/Taipei）；本輪依 `npm run project:preflight -- --type=full` 重新讀取專案規範、目前狀態、0.47 工作條目與 round2 報告，未沿用主要開發代理的評價性摘要。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - round2 指定的 Python fallback 作用域問題已修正：`server.mjs:1333-1343` 的 Python fallback 使用 `workingDir` 產出 SRT，未引用未定義的 `outputBase`；`server.mjs:1396-1430` 的 `outputBase` 只存在於 Whisper.cpp 函式內。
  - 既有雙語校稿包合併 quality 已實作於 `server.mjs:3531-3537`；`scripts/test-core.mjs:418-422` 的 fixture 以既有 `bilingual-cues.json` 加上 `working/quality-metadata.json` 驗證 confidence／no-speech 合併。
  - `scripts/check-project-docs.mjs:59-62` 依最大日期選取最新日期的最後一筆工作條目。本輪 `npm run docs:check:final` 實際拒絕目前最新的 `2026-07-27 — 接入 Whisper.cpp 品質 metadata 通道`，回報「尚未標示為完成」「仍有欄位為待執行」「獨立審查是否執行必須為是或否」，證明未誤選較早完成條目。
  - parser 對 `timestamps.from/to` 與 `offsets.from/to` 的 timestamp-only segment 會保留並解析；`parseWhisperQualityJson` 以 `map` 保留輸入 segment 數量，不會把壞 segment 過濾掉。confidence／no-speech 只接受有限值與 `[0,1]`。
  - round2 的完整成功條件尚未達成：stale metadata 在既有有效 SRT、跳過 Whisper 的 `/start` 路徑仍會沿用；parser 未保留 segment ID，也未支援常見 `segments[].start/end`；因此無法宣稱 cue ID 嚴格驗證與完整 schema-tolerant 對應已完成。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - stale metadata 仍有明確生命週期缺口。`server.mjs:1284-1285` 只在 `runWhisper` 開始時清除；`server.mjs:1213-1215` 遇到有效既有 SRT 直接複製並略過 `runWhisper`。本輪以隔離 `/private/tmp` 資料目錄啟動 server，建立有效既有 SRT 任務、預先寫入 stale `quality-metadata.json`，呼叫 `/start` 後任務為 `completed`，但實際輸出 `qualityMetadataExists: true`。
  - cue ID 並未做到端到端嚴格驗證。`attachWhisperQuality` 的 `server.mjs` 對應模組第 46-55 行只在 `segment.id !== undefined` 時比較 ID；`parseWhisperQualityJson` 第 36-43 行沒有把輸入 segment 的 `id` 複製到結果。獨立探針以 `{id:99,timestamps:{from:'00:00:01,000',to:'00:00:02,000'}}` 解析後，結果沒有 `id`，再與 cue `{id:1,start:1,end:2}` attach 實際回傳 `matched: true`。
  - `segments[].start/end` 目前不被 `readTime` 讀取；獨立探針回傳 `{start:null,end:null}`。round2 要求的該 schema 形狀尚未完成，因此「timestamp-only」目前只涵蓋 Whisper.cpp 現有 `timestamps`／`offsets` 形狀，不能泛稱所有 timestamp-only 變體均支援。
  - 既有雙語 package 的 quality 合併邏輯本身可運作，但它依賴 quality segment 已通過 ID／時間對應；上列 ID 缺口仍可能讓錯誤 metadata 被合併。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 通過的 parser 邊界：`node scripts/test-whisper-quality.mjs` 通過；目前測試涵蓋空 `transcription` 回退 `segments`、字串 timestamp、null／超界 confidence、時間不一致與 count mismatch。
  - 本輪獨立探針確認壞 segment 不會被刪除：兩個輸入 segment（第二段 timestamp 不可解析）仍產出兩個結果，第二段為 `start:null`；這項 round2 修正成立，且 attach 會因時間無效回落。
  - 本輪獨立探針確認 timestamp-only `timestamps.from/to` 會解析為 `1` 到 `2.5` 秒，confidence `0.4` 保留；超出範圍的 `confidence:1.2` 與 `no_speech_prob:-0.1` 均未保存。
  - 未通過的邊界：解析含 `id:99` 的合法 timestamp segment 後 ID 被丟失，錯誤 cue ID 可因時間相同而 `matched:true`；含 `start/end` 的 segment 不能解析；有效既有 SRT 重跑後 stale metadata 仍存在。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - `lib/whisper-quality.mjs` 已將 parser／attach 拆成可單元測試的純函式，品質值驗證集中於 `finite`／`probability`，並以 count、時間範圍與容許誤差保護 SRT 不被阻斷。
  - `server.mjs:1487-1493` 對 JSON 讀取、解析與 attach 採容錯處理，engine metadata 不可用時仍完成 SRT；這符合 rule-score fallback 的安全方向。
  - 但 `server.mjs:1487-1492` 的空 catch 沒有保存可診斷的 metadata 失敗原因；更重要的是 stale 清除責任沒有放在所有 `/start` 入口共同涵蓋的位置，且 parser 丟失 ID 使宣稱的嚴格對應與實際行為不一致。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-27 09:xx CST 執行 `node scripts/test-whisper-quality.mjs`、`node scripts/test-bilingual-subtitles.mjs`：均通過。
  - 2026-07-27 本輪以受限環境外執行 `npm run check`：通過；包含治理文件、JavaScript syntax、所有 parser／品質測試、核心 API、既有雙語 package quality 合併 fixture。受限 sandbox 直接執行時核心 API 因 loopback `listen EPERM` 中止，不能把該次失敗誤記為產品回歸失敗。
  - 2026-07-27 09:51 CST 執行 `git diff --check`、`node --check server.mjs`、`node --check lib/whisper-quality.mjs`、`node --check scripts/test-whisper-quality.mjs`：通過。
  - `npm run docs:check:final` 實際命中最新 0.47 條目並正確失敗；在最新條目尚未完成且報告尚未建立前，這是預期的結案阻擋，不是通過證據。
  - round2 要求的 stale API regression、parser `start/end` 正例／負例、parser ID 保留／錯配負例與 Python fallback 成功路徑專門測試仍缺。現有 parser 測試中的手動 `qualitySegments` ID 負例只能證明 attach 在「ID 已存在」時會拒絕，不能證明 JSON parser 到 server 的端到端 ID 嚴格性。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - `tools/whisper-cpp/whisper-cli --help` 實際顯示 `-oj --output-json` 與 `-ojf --output-json-full`。
  - 2026-07-27 09:50 CST 使用內建 `ggml-tiny.bin` 與 1 秒 WAV 做實際 smoke：本次環境 Metal 與 `-ng -t 1` CPU 路徑均 exit `0`，各產生 SRT／JSON；因此 round2 曾記錄的 Metal exit 139 在本次執行未重現，仍不可視為跨平台或封裝後 runtime 驗收。
  - 本次實際 JSON 的 `transcription[0]` 有 `timestamps`、`offsets`、`text` 與 token `p`，沒有 segment-level `confidence` 或 `no_speech_prob`；解析結果為 1 個 segment、`engineFields:0`，attach 結果為 `reason:"no-quality-fields"`。因此目前可交付的是「品質欄位缺失時不偽造，繼續使用 rule-score」；不可交付的是「Whisper.cpp 已取得並保存 engine quality」。
  - Python fallback 的目前程式碼沒有未定義 `outputBase`，且語法／完整回歸通過；但本輪沒有成功執行 Python fallback 的專門 runtime fixture，故只確認靜態作用域與未回歸，不能宣稱 fallback 實機路徑已驗收。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪 2026-07-27「接入 Whisper.cpp 品質 metadata 通道」round3 獨立複審結論為不通過：rule-score fallback 的缺失指標不偽造、品質範圍驗證、timestamp-only（`timestamps`／`offsets`）解析、壞 segment 原始數量保留、既有 bilingual package 合併 quality、Python fallback 未定義 `outputBase` 修正、核心／parser 回歸與 `docs:check:final` 最新 0.47 條目選取均已確認；但 `/start` 遇既有有效 SRT 時仍保留 stale metadata，parser 丟失 segment ID 並未支援 `segments[].start/end`，導致 cue ID 嚴格驗證與完整對應契約未達成；真實 Whisper.cpp JSON 本次雖成功產生，仍沒有 segment-level `confidence`／`no_speech_prob`，所以目前只能交付 rule-score fallback，不能進入 0.47 發布審查或宣稱 engine quality 已完成。**
- 阻擋問題（若有）：
  1. 將 stale `quality-metadata.json` 清除放到每次 `/start` 排程前或 `runJob` 的共同入口，並補一個有效既有 SRT + stale metadata 的核心 API regression，確認完成後檔案不存在且 `review-data` 不會套用舊品質資料。
  2. parser 保留並傳遞 segment ID；對 count、ID、時間範圍做同批嚴格匹配。補上 `segments[].start/end`（或明確拒絕並以完整回落處理）的測試，避免不同 JSON schema 被誤當成可對應。
  3. 保持真實 runtime 沒有 segment-level engine quality 的如實限制；若要宣稱 engine quality 完成，必須取得實際含明示 segment-level `confidence`／`no_speech_prob` 的 runtime 輸出並完成映射測試，不得以 token `p` 推導。
- 剩餘風險：
  - 本次 Metal smoke 成功不代表 Windows／macOS 封裝後、Electron renderer 或其他 Whisper runtime 版本均成功；round2 的 exit 139 歷史風險仍應保留為平台／環境風險，直到跨平台實機驗證。
  - Python fallback 沒有專門成功路徑測試；server metadata 解析失敗的空 catch 也降低診斷能力。
  - `package.json` 仍為 `0.46.0`，本條 0.47 工作紀錄仍為「進行中」；本輪沒有發布授權、打包、資產或 SHA 證據。
- 給主要開發代理的具體修正要求：先處理阻擋問題 1／2 並建立下一輪獨立複審；將 0.47 的可交付範圍明確記為 rule-score fallback，engine quality 標為未取得 runtime 欄位。完成後才可重新評估是否進入發布審查；發布審查仍需另行執行版本、封裝、跨平台、SHA、Release 授權與資產核對。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪隔離 server fixture、WAV、Whisper JSON／SRT 與 log 均位於 `/private/tmp`；未將測試資料寫入專案工作樹。
- 若上述聲明不實，本報告無效。
