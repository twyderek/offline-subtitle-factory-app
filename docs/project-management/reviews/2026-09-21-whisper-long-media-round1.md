# 獨立審查報告：bundled Whisper 長音訊 runtime／輸出基線

- 審查對象 commit／版本：`17df978`／`0.51.0`，分支 `codex/0.51-anthropic-claude`
- 對應 08-CHANGE-LOG 條目：2026-09-21 — bundled Whisper 長音訊實機品質基線（`BUG-WHISPER-METAL-139`／`FR-020`）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-09-21 11:32:58 CST（Asia/Taipei）；依 `npm run project:preflight -- --type=full` 路由讀取治理文件、workflow、指定 script 與 evidence，並執行唯讀驗證；未沿用開發代理的評價性摘要。
- 工作樹備註：preflight／`git status --short` 顯示本輪開始前已有多項既有變更；本報告不將其歸因於本輪，也不修改它們。

## 1. 需求完整性

- 判定：通過（僅限本輪明確的 bundled 長音訊 runtime／輸出基線範圍）
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:7-14` 將目標限定為需求方提供的本機影片、bundled FFmpeg／Whisper.cpp Small、執行時間與輸出完整性，並明確排除中文品質、Metal crash→CPU fallback、跨平台、效能門檻與發布；同時要求獨立審查及 `docs:check:final`。
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:36-38` 顯示 FR-020／FR-022 的較大需求仍包含品質指標、缺失指標時的 rule-score 與三模型契約；本報告不把本輪基線擴大解讀為完整 FR-020／FR-022 驗收。
  - `docs/project-management/00-CURRENT-STATUS.md:35-37` 已將本輪定位為執行／輸出完整性基線，並明確記載 LM Studio 未執行與真正斷網、跨平台等缺口。`08-CHANGE-LOG.md:19-20` 也確認本輪不發布，故無發布授權核對要求。
  - 使用者本輪明確授權的唯一持久寫入目標是本報告；本審查未修改 script、evidence、原始媒體、SRT、其他文件或既有報告。

## 2. 邏輯正確性

- 判定：通過（runtime／輸出完整性）；不等同中文音訊品質通過
- 證據：
  - `scripts/verify-whisper-long-media.mjs:84-103` 同時支援 bundled JSON 的 `segments`／`transcription`，從 offsets／timestamps 計算 segment 與時間範圍，並分開計算 confidence、no-speech 與 token probability 欄位。
  - `scripts/verify-whisper-long-media.mjs:143-180` 依序執行 FFprobe、16 kHz mono FLAC 抽取與 Whisper.cpp Small；只在 extraction／inference exit 0、SRT／JSON 非空且 segment 數大於 0 時標示 pass。
  - `docs/project-management/evidence/2026-09-21-whisper-long-media-small-redacted.json:3-5,31-34,46-75,78-87` 記錄 macOS arm64／Node 22.22.3；輸入 5,416.349667 秒、796,758,903 bytes；抽取 exit 0／signal null、180,149,616 bytes；inference exit 0／signal null、430,785 ms；2,509 segments、23,697 Unicode code points、首段 0、末段 5,407.58 秒、21,101 token probabilities；SRT 161,545 bytes、JSON 5,666,118 bytes、temp root removed=true。
  - `inference.requestedGpu=true` 但 `deviceObserved=null`（evidence: `2026-09-21-whisper-long-media-small-redacted.json:54-61`），因此不能宣稱本次長音訊觀察到 Metal。
  - `confidenceFieldCount=0` 與 `noSpeechProbabilityFieldCount=0`（同 evidence: `:68-75`）。這不是品質訊號通過；21,101 個 token probability 也不能替代 segment-level confidence／no-speech 欄位。中文辨識正確率、人工影音校閱與效能門檻均未由本 evidence 驗收。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - evidence schema v2 保存 started／completed／elapsed、平台、輸入 metadata／hash、bundled runtime／model hash、抽取／推論命令摘要、exit／signal、輸出 hash／大小與統計（`scripts/verify-whisper-long-media.mjs:115-127`；evidence: `:1-5,37-75,78-96`）。
  - probe 的摘要解析修正與 v2 隱私目的有 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 及 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:18-23` 可回溯。以新 evidence 路徑形式可重播：`node scripts/verify-whisper-long-media.mjs /Users/nycu/Downloads/20260909.mp4 small <new-evidence-path>`；既有 output path 會由 `scripts/verify-whisper-long-media.mjs:12-14` 拒絕覆寫。
  - `scripts/verify-whisper-long-media.mjs:147-177` 保存抽取／推論的 exit／signal、耗時、音訊 hash、輸出 hash／大小；`184-196` 在 finally 清理暫存並以 exclusive create 寫 evidence。
  - 本審查已對既有 JSON 做 14 項唯讀 assertions，涵蓋 schema、pass、平台／架構、輸入長度、抽取／推論 exit／signal、SRT／JSON 非空、segment 數、temp cleanup、未保存 transcript、缺失 quality 欄位與 scope；結果為 `evidence assertions passed: 14`。
  - 限制：本報告未再跑一次約 7 分鐘的完整長音訊 probe，因既有輸出 evidence 存在且 probe 明確拒絕覆寫，而本輪唯一允許持久寫入為本報告；因此本節的 runtime 實測結果以 2026-09-21 已保存 evidence 為基準，新增驗證是唯讀 assertions／回歸，而非第二份長音訊 replay。
  - 限制：命令中的絕對路徑被遮罩，且只保存輸出 hash／大小，不保存可直接檢閱的 SRT／transcript；這符合隱私範圍，但不能替代重新取得原始媒體、相同 bundled assets 與受控 macOS arm64 執行條件。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - `scripts/verify-whisper-long-media.mjs:37-45,106-112,115-127` 對診斷路徑做遮罩，stdout 只保存 line count／timestamped line count／`contentStored=false`；evidence `:62-67,89-94` 並記錄 `contentStored=false`、`fullTranscriptStored=false`、`externalNetwork=false`、LM Studio explicit scope exception、`originalVideoModified=false`、`originalSrtModified=false`。
  - 本審查讀取的 evidence 原始內容只有 3,043 bytes；唯讀負向檢查未發現 `stdoutTail`、`transcriptText`、`segmentText` 或 `fullTranscript` 原始欄位，未保存字幕文字。這也符合 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:20-23` 與 `08-CHANGE-LOG.md:15-16` 的 v2 說明。
  - 目前影片 SHA-256 重算為 `dc22525eb84ad675259d13e8b87ca2147bc2868364044292ea935c209de04d78`，與 evidence `:11-15` 一致；影片與 `/Users/nycu/Downloads/20260909.mp4.edited.srt` 的目前檔案時間早於 2026-09-21 replay。probe 原始碼只對輸入影片做 stat／hash／讀取，輸出 SRT／JSON 位於 temp root（`1-22,138-141,147-177`），沒有 source SRT 寫入路徑。
  - `scripts/verify-whisper-long-media.mjs:184-189` 在 finally 以 recursive force remove 清理 temp root；evidence `:78-87` 的 `tempRootRemoved=true`，且抽取／推論均為 exit 0、signal null，故本次 exit／signal 與清理欄位彼此合理。
  - 保留限制：evidence 沒有在 probe 前後保存來源 `.edited.srt` 的 SHA-256，`originalSrtModified=false` 是 scope assertion 而非可獨立比對的 before／after hash。因此可確認本 probe code path 未讀寫來源 SRT、目前檔案時間與執行前相符，但不能把它描述成具來源 SRT 前後 hash 的完整不可否認證據。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-09-21（Asia/Taipei，本輪審查）執行 `node --check scripts/verify-whisper-long-media.mjs`，exit 0。
  - 同日執行既有 evidence 的唯讀 14 項 assertions，輸出 `evidence assertions passed: 14`；`shasum -a 256 /Users/nycu/Downloads/20260909.mp4` 與 evidence hash 一致。
  - 同日執行 `npm run check`，exit 0：`docs:check` 通過，所有既有 Whisper／quality／AI／UI／核心 API 回歸測試通過；輸出包含「核心回歸測試通過」。
  - 同日執行 `git diff --check`，exit 0。
  - 同日執行 `npm run docs:check:final`，exit 1；validator 明確指出最新 `08-CHANGE-LOG.md` 工作紀錄尚未標示完成、仍有「待執行」欄位，且「獨立審查是否執行」尚未為是／否。這是文件結案 gate 缺口，不是本輪 runtime evidence 的 pass／fail 反轉。
  - 未執行本輪中文品質人工校閱、confidence／no-speech 品質門檻、真實 Metal crash→CPU fallback、Windows／乾淨安裝或發布測試；它們均在本輪明確不在範圍內，不能由 `npm run check` 的 deterministic／核心回歸代替。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - `docs/project-management/00-CURRENT-STATUS.md:35-44`、`06-TEST-AND-PROCESS-AUDIT.md:18-23` 與 `07-DEBUG-AND-FIX-HISTORY.md:3-9` 對本輪的 runtime／輸出基線、隱私修正、品質未驗收與跨平台／發布風險描述一致；沒有把本輪寫成中文品質或 Metal fallback 通過。
  - `08-CHANGE-LOG.md:3-21` 的本輪條目仍為「狀態：進行中」，`獨立審查是否執行：待執行`、`獨立審查結論：待執行`；這與本報告及已執行的 check 不一致，也是 `docs:check:final` 失敗的直接原因。依使用者限制，本審查不回填該文件。
  - 治理流程要求獨立報告、六面向、可回溯證據與 final gate（`docs/project-management/workflows/04-INDEPENDENT-REVIEW.md:7-12,15-57,87-93`）；本報告具備六面向與聲明，但工作紀錄的結案同步仍待主要代理處理。
  - 剩餘風險：本輪沒有中文音訊品質／人工影音校閱、segment-level confidence／no-speech 欄位、長音訊效能門檻、同一次真實 bundled Metal crash→CPU fallback、外部網路／LM Studio、Windows、乾淨安裝、簽章／公證或發布證據；`00-CURRENT-STATUS.md:36,41-44` 已揭露其中多項。這些均不得由本輪 2,509 segments 或非空輸出推論完成。

## 綜合判定

- 結論：有條件通過。
- 可逐字引用完整結論句：**本輪 bundled Whisper Small 長音訊 runtime／非空輸出基線在 macOS arm64 受控本機 replay 範圍內有條件通過；它證明完整長音訊執行、非空 SRT／JSON、輸出統計與暫存清理，不代表中文音訊品質通過，且本輪未取得 confidence／no-speech 欄位、真實 bundled Metal crash→CPU fallback、外部網路／LM Studio、Windows、乾淨安裝或發布證據；因 08-CHANGE-LOG 最新條目仍為進行中且 `npm run docs:check:final` 失敗，文件結案仍待主要代理完成。**
- 阻擋問題（若有）：
  - 文件結案阻擋：主要代理需在不改寫本報告的前提下，依治理規範回填 `08-CHANGE-LOG.md` 的本輪審查連結／逐字結論與完成欄位，並重新執行 `npm run docs:check:final`；本報告不代為修改。
  - 若目標被擴大為 FR-020／FR-022 的完整品質或發布驗收，缺少中文品質、confidence／no-speech、真實 Metal fallback、Windows／乾淨安裝與發布證據是額外阻擋；對本輪限定的 runtime／輸出基線則屬已揭露的範圍外風險。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

若上述聲明不實，本報告無效。
