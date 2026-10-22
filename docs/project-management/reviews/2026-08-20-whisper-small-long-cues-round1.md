# 獨立審查報告：Whisper Small 過長字幕 cue 分析與修正

- 審查對象 commit／版本：目前工作樹 `codex/0.50-whisper-small-long-cues`／`0.50.0`；本輪尚未建立 commit
- 對應 08-CHANGE-LOG 條目：2026-08-20 — Whisper Small 過長字幕 cue 分析與修正（BUG-024）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-20（Asia/Taipei）；由獨立上下文依 debug 路由閱讀 `AGENTS.md`、專案管理入口、目前狀態、需求、功能設計、測試稽核、偵錯／驗證／獨立審查／結案流程與 BUG-024 變更；本報告僅以目前工作樹與重新執行的指令為證據，未沿用主要開發代理的評價性結論。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:38` 的 FR-022 已把 Small 長 cue 的驗收條件寫成保留文字、最多兩行、每行最多 20 字元，必要時以連續時間碼拆分；`docs/project-management/03-FUNCTIONAL-DESIGN.md:53`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:265-269` 也記錄了模型範圍、時間分配與不截斷原則。
  - `server.mjs:1869-1872` 與 `server.mjs:1998-2001` 對 Python Whisper／Whisper.cpp 以正規化模型名稱只在 `small` 啟用 `splitLongCues`；Breeze 路徑仍在 `server.mjs:1746` 使用預設 sanitizer，Tiny／Base 的既有預設呼叫未改變。
  - `lib/whisper-srt.mjs:148-219` 已集中處理換行、cue 拆分、時間分配、重新編號與統計；`scripts/test-whisper-srt.mjs:26-65` 已覆蓋一個中文混合長句、預設未啟用相容性、連續時間碼與過短時段。
  - 但實測發現 ASCII 英文在分段／換行時會移除字詞之間的空格（見第 2、3 節），而極短時段 fallback 會產生超過兩行的單一 cue；因此「保留完整文字」及「最多兩行」的需求尚未在所有邊界成立。另 FR-020／FR-022 要求保存可取得的 quality metadata；目前 Small 任一 cue 拆分即跳過整個檔案的 `quality-metadata.json`（`server.mjs:2013-2027`），未證明未拆分 cue 的可用指標仍被保存。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - `lib/whisper-srt.mjs:15-17,35-55,58-77` 先以 `collapseWhisperText` 將空白壓成一格，並在遇到空白邊界時以 `.trim()` 移除切點。於 2026-08-20 10:12:24 +08:00 執行 deterministic 輸入：
    `This is a very long English sentence that should preserve every word and every space between them when split into subtitles.`，`00:00:00,000 --> 00:00:10,000`。
    `sanitizeWhisperSrt(..., { splitLongCues: true })` 產生 4 個 cue，其中第一個結尾為 `English sentence`、下一個開頭為 `that should preserve`；把各 cue 的換行移除後得到 `longEnglish`、`preserveevery`、`betweenthem` 等相鄰字詞，與原始文字不相等。現有測試只以 `replace(/\s+/gu, '')` 比對（`scripts/test-whisper-srt.mjs:47-50`），因此未捕捉此資料保真問題。
  - `splitCueTiming` 的過短分支（`lib/whisper-srt.mjs:102-110`）在文字已被切成多個兩行 chunk 後以 `texts.join('\n')` 合併成一個 cue；對同一長句、`00:00:01,000 --> 00:00:01,001` 的實測於 10:12 產生 5 行文字。這與 `FR-022`／`03-FUNCTIONAL-DESIGN.md:53` 宣稱的最多兩行不一致，且現有測試只斷言 cue 數量與正時間長度（`scripts/test-whisper-srt.mjs:53-56`）。
  - 另以兩行各 20 個中文字、10 秒時間碼重放，`collapseWhisperText` 在兩行間插入的空格使可見字元被判為 41，結果被不必要拆成兩個 cue（原本已符合兩行／20 字元政策）。這是對既有 Small SRT 版面與 cue 數量的可避免變更。
  - `server.mjs:2013-2027` 在任一 Small cue 拆分時整體不寫入 `quality-metadata.json`，雖可避免把一段 confidence 假裝成多段，但也丟棄其他未拆分 segment 的可用引擎指標；這與 `FR-020` 的「保存可取得」及 FR-022 的三模型 JSON metadata 契約存在未解決衝突。

## 3. 邊界情況

- 判定：不通過
- 證據：
  - 通過案例：2026-08-20 10:12 以長中文混合句呼叫 `node scripts/test-whisper-srt.mjs`，現有測試通過；人工重放確認 6 秒 cue 被拆成嚴格連續、正長度時間段，ID 重新連續，Tiny／Base 預設 `splitLongCues:false` 保持一個原始長 cue。
  - 失敗案例一（ASCII 空白）：同一時間重放長英文句，4 個 cue 的文本在 cue 邊界與換行處移除字詞間隔；只有「忽略所有空白」的弱比對仍通過，不能視為完整文字保留。
  - 失敗案例二（兩行既有可讀 cue）：兩行各 20 個中文字的輸入被視為長度 41 並拆成 2 個 cue，顯示長度計數把格式換行新增的 separator 算入政策門檻。
  - 失敗案例三（過短時間）：1 ms 長句輸入回傳單一 cue，但輸出共有 5 行；雖無零／負時間碼，卻未滿足最多兩行。`durationMilliseconds < texts.length` 只保護時間碼，不保護顯示契約。
  - 其他已驗證邊界：`node --check lib/whisper-srt.mjs`、`node --check server.mjs` 通過；Tiny／Base 未啟用時原始長文字與 cue 數量不變；Breeze 路徑仍未傳入 Small 選項，靜態相容性成立。未驗證真正 Whisper Small 輸出的空白、標點、emoji／組合字元及模型 segment 與 SRT 的異常數量對應。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - 正面：`lib/whisper-srt.mjs` 將字元上限、標點偏好、換行、時間切分與統計集中成純函式；`splitLongCues` 明確 opt-in，降低 Tiny／Base／Breeze 回歸範圍；時間切分以毫秒計算並以 `Math.max(1, ...)`／剩餘片段保護正長度。
  - 缺陷：空白正規化與 `.trim()` 同時處理排版空白和英文語義空格，造成輸出文字無法逐字重建；`texts.join('\n')` 的不可拆分 fallback 可能產生 3–5 行，與同一模組宣告的顯示政策矛盾。
  - 缺陷：完整 Small 檔案停用 quality metadata 是保守但粗粒度的 workaround，沒有明確資料契約說明如何保留未受拆分 segment 的有效 confidence／no-speech；也沒有程式測試證明 `quality-metadata.json` 清理與回落 rule-score 不會留下 stale 或誤套用。
  - 需修正後再審：明確定義跨 cue／跨行的空白保留策略，將格式換行從可見字元門檻排除，為過短時間的「最多兩行」與「不製造零長度」衝突做可驗收的決策；並補充 quality metadata 的部分對應或明文接受完整回落的需求／文件變更。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-08-20 10:12 前後執行 `node --check lib/whisper-srt.mjs && node --check server.mjs && node scripts/test-whisper-srt.mjs && npm run docs:check && git diff --check`，全部 exit 0；輸出為 `Whisper SRT sanitizer tests passed.`、`專案治理文件檢查通過：19 個文件，版本 0.50.0`。
  - 2026-08-20 10:12（+08:00，本輪 session）執行 `npm run check`，完整 `npm test`（含 Whisper fallback／三模型 mock／下載／SRT／Breeze／核心 API／品質／UI 等）exit 0；核心回歸輸出 `核心回歸測試通過`。此結果證明既有 deterministic suite 未被破壞，不證明新增過長文字契約完整。
  - 2026-08-20 10:12:24 +08:00 額外執行上述 ASCII、兩行各 20 字元與 1 ms 過短時間案例，均實際暴露 focused 測試未涵蓋的問題。
  - `npm run docs:check:final` 於 2026-08-20 10:14:54 +08:00 exit 1，明確回報最新工作紀錄仍為「進行中」、含「待執行」、且「獨立審查是否執行」未填；這是目前尚未結案的文件門檻，不是產品測試通過證據。未執行真實 Small 權重、伺服器 spawn 路徑／封裝後 renderer 或 Windows／macOS 實機。
  - 需補測：逐字保留（至少英文／中英混合，定義換行與 cue 邊界的重建規則）、原本已符合兩行政策的輸入、時間恰好等於片段數與 1 ms、完整 Small `draft.srt`／quality metadata 行為，以及 Python Whisper／Whisper.cpp 兩路徑的模型 routing smoke。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 2026-08-20 10:12 以 Node ESM 直接載入 `lib/whisper-srt.mjs` 並重放 deterministic SRT；中文長句的正常時段可產生連續正時間碼，Tiny／Base 預設相容，顯示修正函式本身可執行。
  - 2026-08-20 10:12 的同一實際操作證明英文空格被移除、兩行可讀 cue 被多拆、1 ms fallback 產生超過兩行；因此不能只以 focused happy path 報告「過長問題已排除」。
  - `npm run check` exit 0 與 `npm run docs:check` exit 0，但未啟動實際 Whisper Small model／runtime、未產生真实長音訊 `draft.srt`、未執行 Whisper.cpp Small quality metadata、未建置 Electron／Windows／macOS 安裝包，故不代表實機模型品質、閱讀速度、性能或跨平台執行通過。

## 綜合判定

- 結論：不通過
- 阻擋問題（若有）：
  1. **文字保真阻擋**：`collapseWhisperText`／`.trim()` 在 Small 長 cue 拆分與換行時會刪除英文字詞間的空格；需保留語義空格，或明確定義並測試跨 cue／跨行的可重建規則，不能以「移除全部空白後相等」代替「保留完整文字」。
  2. **顯示上限阻擋**：過短時間 fallback 的單一 cue 實際可有 5 行，與 FR-022／功能設計的最多兩行互相矛盾；需修正 fallback 或更新並獲核准的驗收條件，且補上邊界測試。
  3. **品質指標契約阻擋／需決策**：任一 Small cue 拆分即捨棄整份 `quality-metadata.json`，未滿足「保存可取得」的 FR-020／三模型 JSON 契約，且沒有未拆分 cue 的部分保留測試；需實作可驗證的部分對應，或先明確更新需求與風險界線後再判定通過。
  4. **回歸覆蓋阻擋**：需新增上述三種邊界及至少一條 server／Whisper.cpp Small 實際輸出 smoke，否則現有 focused／完整回歸無法捕捉本輪核心缺陷。
- 剩餘風險：真實 Whisper Small 權重與 1:46 長音訊的中文／中英斷句、閱讀速度、實際 confidence／no-speech 對應、模型 runtime、CPU／Metal 效能、取消、Windows／macOS 封裝與乾淨安裝仍未驗收；Tiny／Base／Breeze 只完成靜態／deterministic 相容檢查；過短來源 cue 的產品策略仍未決定。
- 給主要開發代理的具體修正要求（若有）：先修正空白保真與 fallback 行數政策，補強 `scripts/test-whisper-srt.mjs` 的逐字／格式邊界測試；明確處理或記錄 quality metadata 的部分對應；補上 Small routing／draft SRT／metadata smoke；完成修正後請同一審查角色建立 `round2`，不得覆寫本報告。

**完整結論句：本輪 BUG-024 Whisper Small 過長字幕 cue 獨立複審結論為不通過：Small 專用 sanitizer、模型路由、正常時段的連續時間碼與 Tiny／Base／Breeze 的預設相容性已具備，focused `node --check`／SRT 測試、`npm run docs:check`、`git diff --check` 與完整 `npm run check` 均 exit 0；但實測發現拆分／換行會刪除英文字詞間空格，過短時段 fallback 可產生超過兩行，任一 Small cue 拆分又整體捨棄可取得的 quality metadata，且現有測試未涵蓋這些邊界，因此在修正文字保真、行數與 metadata 契約並完成回歸及 round2 前，不得判定 BUG-024 或 0.50.0 開發完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
