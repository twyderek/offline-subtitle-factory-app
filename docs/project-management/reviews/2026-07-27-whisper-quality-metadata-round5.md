# 獨立審查報告：Whisper quality metadata round5

- 審查對象 commit／版本：目前工作樹（無單一待審 commit）；初始驗證時版本為 `0.46.0`，本報告建立後工作樹出現並行的 0.47.0 發布準備變更，最新 preflight 顯示版本 `0.47.0`、分支 `codex/release-v0.46.0`，工作樹仍含既有變更
- 對應 08-CHANGE-LOG 條目：2026-07-27 — 修正 Whisper quality metadata round3 阻擋
- 審查輪次：round5
- 審查代理啟動時間、上下文來源：2026-07-27（Asia/Taipei）；本報告依指定範圍重新讀取 release 路由文件、目前工作樹、程式碼、測試與 runtime 證據，未將主要開發代理的評價當作驗證結果

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - round4 要求的缺少 segment ID 拒絕已落實：`lib/whisper-quality.mjs:47-56` 要求 `segment.id` 存在且等於 cue ID；`scripts/test-whisper-quality.mjs:15-16` 正式斷言錯誤 ID 與缺少 ID 均不得 matched。
  - round4 要求的既有 SRT `/start` stale regression 已正式加入核心測試：`scripts/test-core.mjs:300-301` 先建立 `working/quality-metadata.json`，`scripts/test-core.mjs:390-394` 啟動既有 SRT 任務並斷言完成後 stale 檔案不存在。
  - 0.47 的引擎品質完整條件仍未滿足。`docs/project-management/00-CURRENT-STATUS.md:58-61` 與 `docs/project-management/08-CHANGE-LOG.md:138` 均保留「缺少 engine quality 時使用 rule-score、不偽造 confidence」及 runtime 缺口揭露；這符合不偽造要求，但不等於 engine metadata 已完成。
  - 目前 `docs/project-management/08-CHANGE-LOG.md:121-138` 的最新 0.47 阻擋修正條目仍為「進行中」，故文件結案條件尚未完成。

## 2. 邏輯正確性

- 判定：通過（就 round4 兩項阻擋而言）
- 證據：
  - `attachWhisperQuality` 在 `lib/whisper-quality.mjs:52` 對缺少 `id` 直接回落；實際 probe 執行結果為 `{"cues":[{"id":1,"start":0,"end":1}],"matched":false,"reason":"timing-mismatch"}`，因此不會只靠時間保存品質欄位。
  - `runJob` 在 `server.mjs:1196-1199`、`runWhisper` 在 `server.mjs:1285-1286` 清除 `quality-metadata.json`；這涵蓋有效既有 SRT 跳過 ASR 的 `/start` 路徑。
  - `review-data` 的品質合併仍經 `attachWhisperQuality`（`server.mjs:3532-3538`），所以 stale 或缺 ID 資料不會被無條件套用。

## 3. 邊界情況

- 判定：通過（round4 指定邊界）；部分通過（真實引擎欄位）
- 證據：
  - `scripts/test-whisper-quality.mjs:10-20` 覆蓋 count mismatch、null／超界 quality、空 transcription 回退 `segments`、字串 timestamp、錯誤 ID、缺少 ID 與標準 `segments[].start/end`。
  - `scripts/test-core.mjs:300-301,390-394` 覆蓋既有有效 SRT、先存在 stale quality metadata、`/start` 完成後檔案清除。
  - 實際 Whisper.cpp smoke 使用內建 `ggml-tiny.bin` 與 1 秒靜音 WAV：CPU `-ng -t 1` exit `0`，產生 SRT／JSON；預設 Metal 路徑 exit `139`。CPU JSON 的 segment keys 為 `timestamps, offsets, text, tokens`，quality keys 為空，沒有 segment-level `confidence`／`no_speech_prob`。

## 4. 程式碼品質

- 判定：通過（本輪範圍）
- 證據：
  - parser、attach 與 server 清除／合併責任可由 `lib/whisper-quality.mjs:36-57`、`server.mjs:1196-1223`、`server.mjs:1487-1493`、`server.mjs:3532-3538` 追溯。
  - 解析失敗仍保留 SRT，不把 token probability `p` 推導為 confidence；目前文件亦明確要求缺失時只走 rule-score。
  - 已知限制仍存在：`server.mjs:1493` 對不相容 metadata 使用空 catch，診斷資訊未形成可觀測事件；此為剩餘風險，不改寫成成功證據。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-27 10:07:26+08:00 執行 `node scripts/test-whisper-quality.mjs`，輸出「Whisper quality metadata 測試通過」，exit `0`。
  - 2026-07-27 10:06:31–10:06:34+08:00 以允許 loopback 的環境執行 `npm run check`，文件檢查、語法、parser、UI、核心回歸全部通過，exit `0`；並行發布準備變更後，2026-07-27 10:09:47–10:09:51+08:00 以 0.47.0 工作樹重跑同一完整 check，仍 exit `0`。
  - 2026-07-27 10:07:42–10:07:43+08:00 直接執行 `node scripts/test-core.mjs`；受限環境前次因 loopback `EPERM` 失敗，取得允許後本次重跑通過，輸出「核心回歸測試通過」，exit `0`。這次核心測試正式執行了既有 SRT／stale metadata `/start` 斷言。
  - 2026-07-27 10:07:26+08:00 執行 `git diff --check`，exit `0`。
  - 2026-07-27 10:06:38+08:00 執行 `npm run docs:check:final`，exit `1`；補入本報告完整結論句後，2026-07-27 10:08:51+08:00 重新執行仍 exit `1`。目前最新 `0.47.0 條件發布` 條目仍為「進行中」，且缺少正式獨立審查／發布授權欄位，因此不能把 final gate 寫成通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - `./tools/whisper-cpp/whisper-cli --help` 實際顯示支援 `-oj/--output-json` 與 `-ojf/--output-json-full`。
  - 實際 CPU smoke 產生 JSON，但 segment quality 欄位不存在；因此只支持「缺少 engine quality 時使用 rule-score」的 fallback，不支持 engine metadata 已完成的宣稱。
  - 2026-07-27 10:07:26–10:07:27+08:00 實際 Whisper.cpp smoke 使用內建 `ggml-tiny.bin` 與 1 秒靜音 WAV：CPU `-ng -t 1` exit `0`，產生 SRT／JSON；預設路徑 exit `139` 且沒有 JSON。CPU JSON 的 segment keys 為 `timestamps, offsets, text, tokens`，quality keys 為空，沒有 segment-level `confidence`／`no_speech_prob`。round4 報告 `docs/project-management/reviews/2026-07-27-whisper-quality-metadata-round4.md:59-61` 已記錄相同結果，`00-CURRENT-STATUS.md:60-61` 亦持續揭露 exit 139、跨平台欄位映射與實機未驗收。
  - 最新 `npm run project:preflight -- --type=release` 顯示版本為 `0.47.0`、分支仍為 `codex/release-v0.46.0`，且工作樹有既有變更；已存在 `RELEASE-NOTES-0.47.0.md`，但目前仍沒有可核對的 0.47 安裝資產、SHA／digest、下載結果或發布後資產證據。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 2026-07-27「Whisper quality metadata round5」獨立複審結論為有條件通過：缺少 segment ID 時已拒絕對應，既有 SRT `/start` 的 stale quality metadata 已由正式核心回歸驗證清除；完整 `npm run check`、parser、核心測試與實際 CPU Whisper smoke 均已確認，但真實 Whisper.cpp JSON 沒有 segment-level `confidence`／`no_speech_prob`、預設 Metal 路徑仍 exit 139，且 `docs:check:final` 尚未因工作紀錄未結案而通過。因此 0.47 只能以 rule-score fallback 條件完成並進入後續發布審查準備，不得宣稱 engine metadata 已完成或視為本輪發布核准。**
- 判定範圍：0.47 的 rule-score fallback、品質 metadata 安全回落、round4 兩項阻擋可視為條件完成，並可進入後續發布審查；這不是 0.47 發布核准，也不是 engine metadata 完成判定。
- 阻擋問題（若有）：
  1. `docs:check:final` 目前失敗；主要開發代理須在不改寫本報告的前提下結案 08-CHANGE-LOG 最新條目、連結本 round5 報告並逐字引用本報告結論，再重跑 final gate。
  2. 當前 `0.47.0 條件發布` 工作紀錄仍為進行中，且 `docs:check:final` 報告缺少獨立審查／發布授權的結構化欄位；發布審查仍須核對打包資產、來源 SHA、checksum／digest、下載結果與具體發布授權，不能直接發布。
- 剩餘風險：
  - 真實 Whisper.cpp JSON 沒有 segment-level `confidence`／`no_speech_prob`；只能交付 rule-score fallback，不得將其寫成 engine metadata 已接入或完成。
  - 預設 Metal runtime 本輪 exit 139；CPU workaround 可完成 smoke，但 Windows／macOS 封裝後、Electron renderer、跨平台實機、Python fallback 成功路徑與真實長音訊轉錄仍未驗收。
  - `server.mjs:1493` 的 metadata 解析失敗採空 catch，診斷可觀測性仍不足。
- 給主要開發代理的具體修正要求：先完成文件結案與 final gate；在發布審查中保留「engine quality 未提供、rule-score fallback」及 Metal exit 139 的明確說明，並完成版本／資產／SHA／授權核對後，才可判定是否發布。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告未將 rule-score fallback 寫成 engine metadata 完成；真實 Whisper JSON 缺少 quality 欄位與 Metal exit 139 均以實際執行結果及既有文件證據揭露。
- 若上述聲明不實，本報告無效。
