# 獨立審查報告：接入 Whisper.cpp 品質 metadata 通道

- 審查對象 commit／版本：工作樹目前 0.47 開發中變更；`package.json` 版本 0.46.0，分支 `codex/release-v0.46.0`
- 對應 08-CHANGE-LOG 條目：2026-07-27 — 接入 Whisper.cpp 品質 metadata 通道
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-07-27 09:42 CST（Asia/Taipei）；本輪依 `npm run project:preflight -- --type=full` 重新讀取專案規範與任務路由，未沿用主要開發代理的評價性摘要。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `server.mjs:1284-1286` 的 Python fallback 現在未引用 `outputBase`；round1 指出的未定義作用域問題已從目前工作樹移除。
  - `server.mjs:3520-3547` 現在在已有 `review-output/bilingual-cues.json` 時仍讀取並嘗試合併 `working/quality-metadata.json`。`scripts/test-core.mjs:418-422` 已建立「既有雙語 cue 無品質欄位、working metadata 有品質欄位」fixture，`npm run check` 實際通過。
  - `scripts/check-project-docs.mjs:59-62` 已由檔案順序改為依最大日期選取最新日期，再取該日期最後一筆；本輪 `npm run docs:check:final` 實際回報的是 2026-07-27 最新 metadata 條目仍為「進行中／待執行」，不是較早的完成條目，證明選取邏輯已命中本輪。
  - 但 `docs/project-management/08-CHANGE-LOG.md:102-120` 的本輪條目仍未完成，且 real runtime 仍未產出 segment-level engine quality；因此 FR-020／本輪「可取得品質 metadata 並安全對應」的完整成功條件尚未達成。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - `server.mjs:1284-1285` 只在進入 `runWhisper` 時清除舊 `quality-metadata.json`；但 `server.mjs:1213-1215` 在已有有效 SRT 時會直接複製 SRT、跳過 `runWhisper`。2026-07-27 本輪以隔離資料目錄啟動 API server，建立含有效既有 SRT 的任務，預先寫入 stale metadata，再呼叫 `/start`；任務完成後輸出為 `finalStatus: "completed"`、`qualityMetadataExists: true`。因此 stale metadata 在「已有 SRT、未進入 Whisper」的重跑路徑仍會保留。
  - `lib/whisper-quality.mjs:46-53` 的 `attachWhisperQuality` 只檢查 count 與 start/end tolerance，未檢查 cue ID。2026-07-27 執行 `attachWhisperQuality([{id:1,start:0,end:1}], [{id:99,start:0,end:1,confidence:0.2}])`，實際回傳 `matched: true`，錯誤 ID 仍被合併。
  - `lib/whisper-quality.mjs:36-43` 會先把無法解析時間或倒序的 segment filter 掉，再交給 `attachWhisperQuality` 做數量比對。2026-07-27 執行含一個有效 segment 與一個壞 timestamp segment 的 `segments` fixture，parser 只回傳一段，接著對一個 cue 回傳 `matched: true`；原始 JSON 的 segment 數量不一致被掩蓋。
  - 同一 parser 對常見的 `segments[].start`／`segments[].end` 形狀沒有讀取支援；2026-07-27 執行 `parseWhisperQualityJson({segments:[{start:0,end:1,confidence:0.2}]})` 實際回傳空陣列。現有測試只覆蓋 `timestamps.from/to`，不足以證明 schema-tolerant parser 的完整性。

## 3. 邊界情況

- 判定：不通過
- 證據：
  - 已通過的邊界：`scripts/test-whisper-quality.mjs` 實際覆蓋空 `transcription` 回退 `segments`、字串 timestamps、confidence 超出 `[0,1]`、null confidence、時間不一致與 count mismatch；指令輸出為「Whisper quality metadata 測試通過：JSON 解析、時間對應、缺失與不一致回落」。
  - 未通過的邊界：壞 segment 被 filter 後仍可匹配、cue ID 不一致仍可匹配、`segments[].start/end` 不可解析，以及已有有效 SRT 時 stale metadata 未清除；上述均由本輪實際命令或隔離 API fixture 重現。
  - quality 值本身沒有被偽造：`lib/whisper-quality.mjs:9-12` 對 confidence／no-speech 做有限值與 `[0,1]` 驗證；這項規則正確，但不能抵銷 segment 對應與 stale 資料邊界缺口。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - `lib/whisper-quality.mjs` 已將 JSON 解析與 cue attach 抽成可測試模組，Python fallback 不再重複引用錯誤的 `outputBase`，且 `server.mjs:1396-1431` 的 output base 作用域位於 Whisper.cpp 函式內，這些修正改善了 round1 的作用域問題。
  - `server.mjs:1487-1492` 對 JSON 讀取、解析與 attach 使用空 catch；這能保留 SRT 完成，但會隱藏 metadata 失敗原因，也沒有清楚記錄「未產出 engine quality」與「格式不相容」的區別。
  - `server.mjs:1284-1285` 的 stale 清除位置與 `runJob` 的既有 SRT 分支不一致，表示資料生命週期規則沒有集中在每次轉錄／重跑入口；這是目前仍會造成錯誤品質資料沿用的設計缺口。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-27 CST 執行 `node scripts/test-whisper-quality.mjs`：通過。
  - 2026-07-27 CST 執行 `npm run check`：通過；包含 `docs:check`、JavaScript syntax、完整 `npm test`、核心 API fixture、字幕品質與 Whisper quality parser 測試。
  - 2026-07-27 CST 執行 `git diff --check`：通過。
  - 2026-07-27 CST 執行 `npm run docs:check:final`：正確失敗，明確回報「最新工作紀錄尚未標示為完成」、「最新工作紀錄仍有欄位為待執行」、「獨立審查是否執行必須為是或否」；不能把本輪 final gate 當成通過證據。
  - 已有核心 fixture 能驗證 quality metadata 合併，但沒有覆蓋：已有有效 SRT 重跑時 stale metadata 清除、cue ID 不一致、原始 segment 數量與過濾後數量不同、Python fallback 成功路徑、Whisper.cpp 子行程參數與 server-level metadata attach 的完整 fixture。

## 6. 實際運行結果

- 判定：不通過
- 證據：
  - 2026-07-27 CST 執行 `tools/whisper-cpp/whisper-cli --help 2>&1 | rg -- '--output-json|--output-json-full|-oj|-ojf'`：實際顯示 `-oj --output-json` 與 `-ojf --output-json-full`。
  - 2026-07-27 CST 以內建 `ggml-tiny.bin` 和 1 秒 WAV 執行預設 Apple Silicon Metal：process exit code `139`，輸出 `ggml_metal_buffer_init: error: failed to allocate buffer, size = 2.20 MiB`，未產生 JSON。此 exit 139 是可重現的真實 runtime 結果，工作紀錄對它的揭露是正確的。
  - 同日以 `-ng -t 1` CPU workaround 執行成功，process exit code `0`，產生 `cpu.srt` 與 `cpu.json`。實際 JSON 的 `transcription[0]` 包含 `timestamps`、`offsets`、`text` 與 token `p`，沒有 segment-level `confidence` 或 `no_speech_prob`；`parseWhisperQualityJson` 因而只回傳 start/end，沒有可保存的 engine quality 欄位。
  - 因此 `-oj`／`-ojf` 通道、CPU workaround 與風險揭露已實測，但不能以 parser 正例或 token probability 自行推導 segment confidence，也不能宣稱實際 Whisper.cpp quality metadata 已接入。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪 2026-07-27「接入 Whisper.cpp 品質 metadata 通道」round2 獨立複審結論為不通過：Python Whisper fallback 的未定義 `outputBase` 引用已移除，既有 `bilingual-cues.json` 時 quality metadata 合併與核心 API fixture、`docs:check:final` 依日期選取最新工作條目、CLI `-oj`／`-ojf` 與 Metal exit 139 風險揭露均已確認；但已有有效 SRT 的重跑路徑仍會保留 stale `quality-metadata.json`，quality attach 未驗證 cue ID，parser 會先過濾無效 segment 而可能掩蓋原始數量不一致，且真實 Whisper.cpp JSON 仍只有 token `p`、沒有 segment-level `confidence`／`no_speech_prob`，因此不能宣稱 0.47 完整驗收或發布核准。**
- 阻擋問題（若有）：
  1. 修正每次 `/start`／重跑入口的 stale metadata 清除，包含已有有效 SRT、跳過 Whisper 的路徑；並補 API regression fixture，確認舊 metadata 不會被 `review-data` 套用到新／既有字幕。
  2. 讓 quality attach 依 count、時間範圍與 cue ID 嚴格匹配；不得只靠陣列位置與時間。
  3. parser 必須保留原始 segment 數量與位置，遇到壞 segment、空 segment、倒序或缺 timestamp 時整批回落，不得 filter 後以較短陣列成功匹配；補 `segments[].start/end`、`timestamps`、`offsets` 與 range 負例測試。
  4. 取得具有明示 segment-level `confidence`／`no_speech_prob` 的 Whisper.cpp runtime／輸出契約並實測映射；在目前真實 JSON 只有 token `p` 的情況下，維持 rule-score fallback，不得宣稱 engine quality 已完成。
- 剩餘風險：
  - 預設 Metal runtime 在本機仍可重現 exit 139；CPU workaround 可完成轉錄，但不提供 segment-level quality 欄位。
  - Python fallback 雖已移除未定義 `outputBase`，本輪仍沒有成功執行該 fallback 路徑的專門 regression test。
  - Windows、macOS 安裝後、Electron renderer、跨平台真實 Whisper runtime 與封裝後欄位映射仍未驗收。
  - `server.mjs:1487-1492` 的空 catch 可能讓 metadata 解析失敗缺乏可診斷紀錄。
- 給主要開發代理的具體修正要求：依上述四項阻擋逐項補最小修正與正式測試；保持本 round2 報告不被覆寫，完成後建立 round3 新報告。修正完成前不得把 08-CHANGE-LOG 本輪條目改為「完成」、不得宣稱 0.47 完整驗收，也不得發布。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪執行的隔離 server fixture 與 Whisper smoke 暫存於 `/private/tmp`，已於測試結束清理；專案工作樹除本報告外未由本審查代理寫入。
- 若上述聲明不實，本報告無效。
