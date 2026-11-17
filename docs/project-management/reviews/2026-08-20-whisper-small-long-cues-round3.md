# 獨立審查報告：Whisper Small 過長字幕 cue 分析與修正

- 審查對象 commit／版本：目前工作樹 `codex/0.50-whisper-small-long-cues`／`0.50.0`；本輪尚未建立 commit
- 對應 08-CHANGE-LOG 條目：2026-08-20 — Whisper Small 過長字幕 cue 分析與修正（BUG-024）
- 審查輪次：round3（回應 round2）
- 審查代理啟動時間、上下文來源：2026-08-20（Asia/Taipei）；使用同一獨立審查上下文重讀目前程式、round1／round2 報告與 debug／test／review／closeout 路由；除本報告外未修改任何檔案。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:38` 的 FR-022、`docs/project-management/03-FUNCTIONAL-DESIGN.md:53` 與 BUG-024 修正記錄已涵蓋 Small 專用 opt-in、保留文字、連續時間碼拆分、極短時段單一 cue、partial quality metadata，以及 Tiny／Base／Breeze 相容性。
  - `server.mjs:1869-1872`、`server.mjs:1998-2001` 只在正規化模型名為 `small` 時啟用政策；Breeze `server.mjs:1746` 未啟用，符合範圍界線。
  - round2 指出的中文 fallback 空格已修正為 `lib/whisper-srt.mjs:137` 的 `texts.join('').replace(/\n/gu, '')`；`scripts/test-whisper-srt.mjs:68-80` 新增中文 fallback 不插入 ASCII 空格與文字重建斷言。
  - 仍有文件一致性待補：FR-022、README、Release notes 與 `docs/WHISPER-MODEL-DOWNLOAD.md` 的一般說法是每行最多 20 字元；功能設計另允許極短時段第二行超過 20 字元。此例外應同步到使用者可見文件，否則不能以完整發布文件結案。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - 2026-08-20 10:37:55 +08:00 以長英文句與 10 秒時間碼重放，4 個 cue 的換行／cue 邊界經重建後與原文相等，未再出現 round1 的 `longEnglish`、`preserveevery` 等空白遺失。
  - 同次重放以兩行各 20 個中文字、2 秒時間碼輸入，結果仍為單一兩行 cue；不再把格式換行計入 40 字元門檻。
  - 同次重放以超長純中文字串（60 字元）及 1 ms 時間碼輸入，結果為單一正長度 cue、恰兩行、無 ASCII 空格，去除格式換行後與原文完全相等；`unsplittableLongCueCount=1`、`splitCueCount=0`，符合不製造零長度與不偽造拆分時間碼。
  - 同次 synthetic quality attach 以一個被拆分來源與一個未拆分 cue 驗證：結果 `matched=true`、`reason=engine-metrics`，拆分 cue 的 confidence 為 null、未拆分 cue 保留 `0.9`；沒有把一個原始 segment 的指標複製到新 cue。
  - `lib/whisper-quality.mjs:47-63` 仍對非 null segment 嚴格檢查 ID／時間與品質欄位；`server.mjs:2016-2031` 以同長度 null placeholder 保存 partial 對應，邏輯未見新的阻擋錯誤。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 已通過：英文跨 cue／跨行空白、中文 60 字元 1 ms fallback、原本兩行各 20 字元、正常中文長 cue、CJK 長句、ASCII 長單字、Tiny／Base 未啟用政策、Small partial quality attach、Breeze 不受影響的靜態路由。
  - `scripts/test-whisper-srt.mjs:68-80` 的新增純中文 fixture 本身只有 34 個字元，會走單一 chunk 的換行路徑，不會實際進入 `durationMilliseconds < texts.length` 的 `texts.join('')` fallback；因此其測試標的不足，雖然獨立的 60 字元人工重放已驗證真正 fallback 行為。
  - 尚未覆蓋：emoji／組合字元的字元寬度、含 invalid SRT block 且同時拆分的 sourceIndex／quality 對應、實際 Whisper Small 權重產出的異常 segment 數量、Python Whisper／Whisper.cpp child process 的真實 Small output。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - `lib/whisper-srt.mjs` 集中字元政策、標點／空白邊界、時間分配、`splitFromSource` 與統計欄位；`splitLongCues` 明確 opt-in，對既有 Tiny／Base／Breeze 呼叫維持相容。
  - round2 的無條件 `texts.join(' ')` 已移除；極短 CJK fallback 不會新增空格，英文正常拆分仍保留必要格式分隔。時間切分以毫秒及剩餘片段保護正長度。
  - `attachWhisperQuality` 的 null partial 語意有註解且未放寬非 null 的嚴格 ID／時間檢查；server 寫入 null placeholder 可讓 review-data 保留未拆分 engine metrics，拆分 cue 回到 rule-score。
  - 維護性缺口是品質 partial 與 `runWhisperCpp` 目前主要靠 source regex／unit synthetic evidence，尚未有直接 child-process integration fixture；這不構成已證明的邏輯失敗，但應列為下一階段測試工作。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-08-20 10:37:19 +08:00 執行 `node --check lib/whisper-srt.mjs`、`node --check lib/whisper-quality.mjs`、`node --check server.mjs`、`node scripts/test-whisper-srt.mjs`、`node scripts/test-whisper-quality.mjs`、`node scripts/test-whisper-models.mjs`、`npm run docs:check`、`git diff --check`，全部 exit 0；focused 輸出包含 `Whisper SRT sanitizer tests passed.`、quality metadata 通過、三模型 mock 通過及文件檢查通過。
  - 2026-08-20 10:37:28 +08:00 起以受控權限執行 `npm run check`，exit 0；所有 npm test、三模型 mock、SRT／quality、Breeze、核心 API／取消回歸均通過，最後輸出 `核心回歸測試通過`。
  - 2026-08-20 10:37:55 +08:00 另執行英文重建、純 CJK 60 字元極短 fallback 與 partial quality synthetic assertions；均通過。
  - 2026-08-20 10:37:43 +08:00 執行 `npm run docs:check:final`，exit 1；明確原因為最新 `08-CHANGE-LOG.md` 仍「進行中」、含「待執行」，且「獨立審查是否執行」尚未填寫。這是文件結案前置條件，不是產品回歸失敗。
  - 測試仍未覆蓋真實 Small 權重、長音訊、封裝後 renderer／Windows／macOS，且新增純中文 fixture 應改為超過 40 字元以真正覆蓋 fallback 分支。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - focused ESM 重放證明正常 Small 長 cue 的文字、時間碼、ID、行數與中文極短 fallback 行為可執行；Tiny／Base／Breeze 的選項與路由 deterministic assertions 未受破壞。
  - 受控權限 `npm run check` exit 0，證明本輪 deterministic regression suite 可完成；沒有將 mock runner、source regex 或 synthetic quality attach 擴張為真實 Small 模型品質、中文斷句、效能、取消、runtime 或跨平台 packaged 驗收。
  - `docs:check:final` 尚未通過，因 BUG-024 工作紀錄尚未結案；因此目前不能交付為已完成的 0.50 發布文件集合。

## 綜合判定

- 結論：有條件通過
- 條件是否已被需求方接受：否（文件結案與純中文 fallback focused fixture 尚待完成）
- 阻擋問題（若有）：
  1. **文件結案阻擋**：更新 `08-CHANGE-LOG.md` 的 BUG-024 為完成，填入實際修改、開發驗證、round1／round2／round3 報告連結與逐字結論，將獨立審查欄位填為是，並同步極短 fallback 的「第二行可超過 20 字元」例外至 README／Release notes／模型下載說明，再重跑 `npm run docs:check:final`。
  2. **測試強化要求**：將 `scripts/test-whisper-srt.mjs:68-80` 的純中文 fixture 延長至超過 40 字元，確實進入 `durationMilliseconds < texts.length` 的 fallback；目前人工 60 字元重放已通過，但 focused test 尚未精準覆蓋該分支。
- 剩餘風險：真實 Whisper Small 權重／patched runtime、1:46 長音訊、中文／中英斷句品質、閱讀速度、實際 confidence／no-speech、invalid SRT sourceIndex 與 quality metadata 端到端對應、CPU／Metal 效能、取消、Windows／macOS 封裝與乾淨安裝仍未驗收；這些風險不應被本輪 deterministic tests 解讀為已完成。
- 給主要開發代理的具體修正要求（若有）：完成上述文件結案與純中文 fallback focused fixture；如要宣稱 Small quality partial 已於產品路徑驗收，另補 Whisper.cpp mock child-process／draft SRT／quality-metadata integration fixture；完成後即可視為本輪程式碼有條件通過，仍需依發布授權流程處理 0.50 外部實機風險。

- 可逐字引用完整結論句：**本輪 BUG-024 Whisper Small 過長字幕 cue round3 獨立複審結論為有條件通過：round2 的中文 fallback 額外 ASCII 空格已移除，英文空白、兩行各 20 字元不重拆、極短時段最多兩行、partial quality metadata、Tiny／Base／Breeze 相容性均經 focused 重放確認，`node --check`、SRT／quality／三模型測試、`npm run docs:check`、`git diff --check` 與受控權限完整 `npm run check` 全部 exit 0；但 `docs:check:final` 仍因 BUG-024 工作紀錄尚未結案而失敗，純中文 focused fixture 尚未真正進入超短 fallback 分支，且真實 Small runtime／長音訊／跨平台實機仍未驗收，因此完成文件結案與 fallback focused 補強前，不得宣稱 0.50.0 已完成公開發布。**
**完整結論句：本輪 BUG-024 Whisper Small 過長字幕 cue round3 獨立複審結論為有條件通過：round2 的中文 fallback 額外 ASCII 空格已移除，英文空白、兩行各 20 字元不重拆、極短時段最多兩行、partial quality metadata、Tiny／Base／Breeze 相容性均經 focused 重放確認，`node --check`、SRT／quality／三模型測試、`npm run docs:check`、`git diff --check` 與受控權限完整 `npm run check` 全部 exit 0；但 `docs:check:final` 仍因 BUG-024 工作紀錄尚未結案而失敗，純中文 focused fixture 尚未真正進入超短 fallback 分支，且真實 Small runtime／長音訊／跨平台實機仍未驗收，因此完成文件結案與 fallback focused 補強前，不得宣稱 0.50.0 已完成公開發布。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
