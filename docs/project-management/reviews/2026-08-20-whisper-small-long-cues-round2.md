# 獨立審查報告：Whisper Small 過長字幕 cue 分析與修正

- 審查對象 commit／版本：目前工作樹 `codex/0.50-whisper-small-long-cues`／`0.50.0`；本輪尚未建立 commit
- 對應 08-CHANGE-LOG 條目：2026-08-20 — Whisper Small 過長字幕 cue 分析與修正（BUG-024）
- 審查輪次：round2（回應 round1）
- 審查代理啟動時間、上下文來源：2026-08-20（Asia/Taipei）；使用同一獨立審查上下文重新讀取目前程式、round1 報告、BUG-024 文件與 debug／test／review／closeout 路由，未修改 round1 或任何產品文件。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:38` 的 FR-022、`docs/project-management/03-FUNCTIONAL-DESIGN.md:53` 與 BUG-024 工作紀錄要求 Small 長 cue 保留文字、最多兩行、正常情況每行最多 20 字元、必要時按連續時間碼拆分；功能設計已補充極短時間只能保留一個 cue 時允許第二行較長，以避免拆斷英文單字。
  - `server.mjs:1869-1872`、`server.mjs:1998-2001` 仍只對正規化後的 `small` 啟用 `splitLongCues`，Breeze `server.mjs:1746` 與 Tiny／Base 預設呼叫不受影響。
  - `lib/whisper-srt.mjs:35-153` 已修正跨英文 cue／換行的分隔空白、原本兩行各 20 字元不重拆、極短時間維持單一且最多兩行；`lib/whisper-quality.mjs:47-63` 及 `server.mjs:2013-2034` 已加入 `null` partial attach，未拆分 cue 可保留 engine metadata。
  - 但極短時間 fallback 目前以 `texts.join(' ')` 合併所有 chunk，實測會在原本沒有空格的中文標點／詞組間插入可見 ASCII 空格（例如 `字幕， 應該`、`拆分 成`）。這仍違反「保留完整文字」的廣義資料保真要求，且 README／Release notes 仍沒有揭露這個例外。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - round1 的英文問題已修正：2026-08-20 10:32:44 +08:00 以 `This is a very long English sentence that should preserve every word and every space between them when split into subtitles.`、10 秒時間碼重放，`sanitizeWhisperSrt(..., { splitLongCues: true })` 產生 4 個 cue；將 cue 內換行移除並正規化邊界空白後，完整重建結果與原文相等，四個 cue 均為 1–2 行且可見行長為 14–20。
  - round1 的既有可讀 cue 問題已修正：兩行各 20 個中文字、2 秒時間碼重放結果仍為 1 cue、2 行，未被不必要拆分。
  - round1 的極短時間行數問題已修正：1 ms 時間碼重放結果為 1 cue、2 行，`unsplittableLongCueCount=1`；符合目前功能設計「最多兩行，極端時第二行可超過 20」的決策。
  - 仍有一個可重現的資料呈現缺陷：同一 1 ms 中文長句實際輸出為第一行尾端空格，以及第二行內的 `字幕， 應該`、`拆分 成`、`片段， 並且` 等額外空格。根因是 `lib/whisper-srt.mjs:137` 無條件使用 `texts.join(' ')`；英文需保留的分隔空白不應套用到中文／標點邊界。
  - quality partial 邏輯方向正確：`server.mjs:2016-2024` 對 `splitFromSource` 使用 `null`，`attachWhisperQuality` 對 null 保留 cue 並只以實際對應 segment 判定 `engine-metrics`；`server.mjs:2025-2031` 以同長度陣列寫入 null placeholder，避免把原始 segment 時間／confidence 假裝成拆分 cue 指標。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 通過：正常中文長 cue 會拆成連續正時間碼；英文長 cue 的跨 cue／跨行空白可重建；原本兩行各 20 字元不重拆；Tiny／Base 預設不改寫；CJK 連續 100 字元正常拆分後每行最多 20；ASCII 長單字在硬切時仍維持 2 行且不丟字。
  - 通過：1 ms 極短時間只產生一個正長度 cue、最多兩行；不再製造零／負時間碼。
  - 未通過／需修正：1 ms CJK／中英混合長句的 fallback 額外插入空格。這不會造成時間碼錯誤，但會改變中文字幕可見文字與原始語意格式。
  - quality partial unit 邊界通過：`scripts/test-whisper-quality.mjs:24-33` 驗證 null split entry 不阻止未拆分 cue 的 confidence；不一致 ID／時間仍回報 mismatch。尚未以實際 server spawn 產出的 `draft.srt`／`quality-metadata.json` 重放完整檔案。
  - 尚未覆蓋真正 Whisper Small 權重、emoji／組合字元、含 invalid SRT block 且同時拆分的 sourceIndex／quality 對應，以及 Python Whisper 與 Whisper.cpp child process 的真實輸出。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - 正面：`splitLongCues` 仍為明確 opt-in；字元政策、時間切分、`splitFromSource` 標記與 partial metadata attach 均集中且有註解；`attachWhisperQuality` 對 null 只放寬明確的 partial case，不放寬 ID／時間 mismatch。
  - 正面：`normalizeLongCueText` 現在以各 raw line 的可見字元計數，避免把格式換行新增的 separator 算入 40 字元門檻；`splitCueTiming` 以毫秒與剩餘片段保證正時間長度。
  - 剩餘缺陷：極短 fallback 將語言不明的 chunk 一律用 ASCII 空格合併，與功能設計「英文分隔空白保留」的範圍不一致；應按相鄰文字／原始邊界保留必要英文空白，對中文／標點不新增可見空格，或將該例外明確記錄為格式政策。
  - 剩餘維護風險：`server.mjs` 仍以 source regex 斷言 Small routing／partial quality，沒有實際呼叫 `runWhisperCpp` 的 integration fixture；這是測試證據不足，尚非已證明的主流程邏輯錯誤。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-08-20 10:32:29 +08:00 執行 `node --check lib/whisper-srt.mjs`、`node --check lib/whisper-quality.mjs`、`node --check server.mjs`、`node scripts/test-whisper-srt.mjs`、`node scripts/test-whisper-quality.mjs`、`node scripts/test-whisper-models.mjs`、`npm run docs:check`、`git diff --check`，全部 exit 0。
  - 2026-08-20 10:32:44 +08:00 額外執行英文完整重建、兩行各 20 字元、1 ms fallback、CJK／中英長句與 partial quality synthetic assertions；英文／正常 CJK／metadata partial 通過，但 1 ms 中文 fallback 額外空格已由獨立重放確認。
  - 2026-08-20 10:33:59 +08:00 起以受控權限執行 `npm run check`，exit 0；`npm test` 全部通過，包含三模型 mock、SRT、quality metadata、Breeze、核心 API 與取消回歸，最後輸出 `核心回歸測試通過`。此前同一工作樹的一次完整回歸曾因主要代理同步修改中的 source-regex 版本不一致而失敗，已在程式穩定後重新執行並以本次 exit 0 為準。
  - `npm run docs:check:final` 於 2026-08-20 10:34:47 +08:00 exit 1，原因是最新 `08-CHANGE-LOG.md` 仍為「進行中」、含「待執行」，且獨立審查欄位尚未填寫；這是尚未結案的文件門檻。
  - 測試缺口：沒有真正由 server child path 產生 Small split SRT 與 partial quality metadata 的整合測試，也沒有英文／中文 fallback 空格的 assertion；應補上後才可宣稱完整回歸涵蓋本輪資料保真政策。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 2026-08-20 10:32:29 的 focused tests 與 10:32:44 的 Node ESM synthetic replays 證明 sanitizer 可執行，正常中文／英文長 cue 的時間碼、ID、行數與文字重建符合預期；Tiny／Base default 與 Breeze 靜態路由未見回歸。
  - 2026-08-20 10:33:59–10:34 左右的受控權限 `npm run check` exit 0，證明完整 deterministic suite 可通過；沒有將 mock／source marker 擴張為真實 Small runtime、1:46 長音訊、中文斷句品質、效能或跨平台 packaged 驗收。
  - 實際 1 ms 中文 fallback 的輸出仍含多餘 ASCII 空格，因此「正常時段問題已改善」成立，但「所有 Small 長 cue 輸出保留原文字面格式」尚未完全成立。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：
  1. **需在結案前處理中文 fallback 空格**：`lib/whisper-srt.mjs:137` 無條件 `texts.join(' ')`，會把 1 ms CJK／中英長句合併時的 chunk 邊界變成可見 ASCII 空格。請改為依原始語言／邊界保留必要英文空白、中文／標點不新增空格，並補 focused assertion；若產品刻意接受此格式，須同步更新 FR-022、Release notes 與剩餘風險，不能只留在功能設計註解。
  2. **結案證據尚未完成**：更新 BUG-024 最新條目為完成、填寫 round1／round2 連結與逐字結論、移除「待執行」，再重跑 `npm run docs:check:final`。這是治理結案阻擋，不是 core runtime 測試失敗。
- 剩餘風險：真實 Whisper Small 權重／patched runtime、1:46 長音訊、中文及中英斷句品質、閱讀速度、實際 engine confidence／no-speech、quality metadata 與 invalid SRT sourceIndex 的端到端對應、CPU／Metal 效能、取消、Windows／macOS 封裝及乾淨安裝仍未驗收；Small partial metadata 只在 deterministic attach 與 source assertions 驗證。
- 給主要開發代理的具體修正要求（若有）：修正或正式決策 fallback 的 CJK 空格策略，補上中英混合 1 ms assertion；補一條 Small Whisper.cpp mock child path／partial quality metadata integration test（或明確記錄為下一階段未覆蓋）；完成後由同一審查角色建立 round3，並更新 `08-CHANGE-LOG.md`／`docs:check:final`。

**完整結論句：本輪 BUG-024 Whisper Small 過長字幕 cue round2 獨立複審結論為有條件通過：round1 指出的英文空白遺失、原本兩行各 20 字元被重拆、極短時間超過兩行及整體捨棄 quality metadata 均已由 sanitizer／partial attach 修正，focused checks、三模型 mock、quality tests、`npm run docs:check`、`git diff --check` 與受控權限完整 `npm run check` 均 exit 0；但 1 ms 中文 fallback 的 `texts.join(' ')` 仍在中文標點／詞組間新增可見 ASCII 空格，且 `docs:check:final` 尚因 BUG-024 條目進行中而失敗，因此在決定／修正 CJK fallback 空格、補回歸與完成文件結案前，不得將 BUG-024 視為無條件完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
