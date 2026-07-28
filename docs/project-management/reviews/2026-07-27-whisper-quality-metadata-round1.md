# 獨立審查報告：接入 Whisper.cpp 品質 metadata 通道

- 審查對象 commit／版本：HEAD `8d042d3`（`codex/release-v0.46.0`）加上目前未提交工作樹
- 對應 08-CHANGE-LOG 條目：2026-07-27 — 接入 Whisper.cpp 品質 metadata 通道
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-27（Asia/Taipei）；依 `npm run project:preflight -- --type=full` 取得治理上下文，使用獨立審查上下文，未沿用主要開發代理的評價；除本報告外未修改其他專案檔案

## 1. 需求完整性

- 判定：不通過
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:36` 的 FR-020 要求保存「可取得的 confidence／no-speech 指標」，缺失時才使用可重現的 rule-score；`docs/project-management/08-CHANGE-LOG.md:102-115` 將本輪成功條件定為輸出、解析並依時間／順序對應 JSON full output。`server.mjs:1430-1438` 確實加入 `-oj`／`-ojf`，但實際 Apple Silicon JSON smoke 的 `transcription[0]` 只有 `timestamps`、`offsets`、`text` 與 `tokens[].p`，沒有 segment-level `confidence` 或 `no_speech_prob`；`parseWhisperQualityJson` 實測結果為 `[{'index':0,'start':0,'end':1.8}]`，因此目前內建 runtime 沒有產生可保存的 engine quality metadata。
- 證據：`docs/project-management/03-FUNCTIONAL-DESIGN.md:67` 宣稱只有「成功對應且包含有效 engine 欄位」才保存 `working/quality-metadata.json`；這個保護條件本身合理，但本機實際 JSON 只會走 `no-quality-fields`，沒有完成需求宣稱的引擎指標接入。工作紀錄 `docs/project-management/08-CHANGE-LOG.md:115` 已揭露 exit 139，但該揭露不能替代成功路徑與欄位映射驗收。

## 2. 邏輯正確性

- 判定：不通過
- 證據：`server.mjs:1385` 的 Python Whisper fallback 使用 `path.basename(outputBase)`，但 `outputBase` 只在 `runWhisperCpp` 的區域範圍 `server.mjs:1403` 宣告。當 Python Whisper 路徑成功產生 SRT 時，這行會拋出 `ReferenceError: outputBase is not defined`；目前沒有測試或共用 helper 防止該回歸。這是本輪新增 metadata 掃描造成的 fallback 執行時阻擋。
- 證據：`server.mjs:3540-3545` 只有在 `bilingual-cues.json` 不存在時才把 `working/quality-metadata.json` 合併到 `bilingualCues`。我建立了含既有 `bilingual-cues.json`（無品質欄位）及 `working/quality-metadata.json`（confidence `0.2`、no-speech `0.8`）的隔離 fixture，實際呼叫 `GET /api/jobs/fixture-job/review-data` 後，回應的 cue 仍沒有 `confidence` 或 `noSpeechProbability`。這違反 review-data 應能載入品質欄位的資料流要求；現有核心測試反而先保存含品質欄位的 bilingual cue，因此繞過了這個缺陷。
- 證據：`server.mjs:1495-1499` 的 Whisper.cpp fallback 對 JSON 缺失、格式錯誤、欄位不相容與對應失敗全部靜默吞掉，且沒有清除可能存在的舊 `quality-metadata.json`。`startJob` 可直接再次執行已存在任務而不清理 working 目錄；因此新一輪 metadata 失敗時，舊品質資料可能被 review-data 誤套到新字幕。`retryJob` 會清理 working 目錄，但不能涵蓋所有重新啟動路徑。
- 證據：`lib/whisper-quality.mjs:28-35` 以 `transcription` 存在即優先，空的 `transcription` 不會回退到同時存在的 `segments`；解析失敗的 segment 會先被 filter 掉，再用剩餘陣列與 SRT 依位置配對。這使「原始 segment 數量」的保護不完整，可能在 schema 混雜或部分壞資料時失去原始位置資訊。`readTime` 也只接受數字 offset；若只有 Whisper JSON 的字串 timestamp 而沒有 offset，會被視為無法對應。

## 3. 邊界情況

- 判定：部分通過
- 證據：2026-07-27 執行 `node scripts/test-whisper-quality.mjs` 通過，涵蓋一個 `transcription`＋numeric `offsets`＋`no_speech_prob` 正例、時間不一致、數量不一致及 `confidence: null`。這證明基本 parser／strict timing path 可運作。
- 覆蓋缺口：`scripts/test-whisper-quality.mjs:4-12` 沒有 `segments` schema、空 `transcription` 回退、只有字串 timestamps、混合有效／無效 segment、重複／倒序 segment、confidence／probability 超出 `[0,1]`、server malformed JSON fallback、舊 metadata 清除或 review-data 已存在 bilingual 檔案的情境。
- 實際 runtime：以工作紀錄相同的內建 tiny runtime 路徑執行 `./tools/whisper-cpp/whisper-cli -m ./tools/whisper-models/ggml-tiny.bin -f /tmp/offline-subtitle-whisper-smoke.wav -l zh -osrt -oj -ojf -of /tmp/offline-subtitle-whisper-exact -t 8`，於 2026-07-27（Asia/Taipei）得到 exit code `139`，stderr 為 `ggml_metal_buffer_init: error: failed to allocate buffer, size = 2.20 MiB`，沒有 JSON。以 `-ng -t 1` 重跑則 exit code `0` 並產生 JSON，但該 JSON 仍沒有 segment-level quality 欄位；這確認 exit 139 揭露是真實且參數／Metal 路徑相關，而不是 parser 負例。

## 4. 程式碼品質

- 判定：不通過
- 證據：`runWhisper` 與 `runWhisperCpp` 各自複製 JSON 解析、SRT 解析、quality attach 與 metadata 寫入流程（`server.mjs:1385-1391`、`1495-1499`），且其中一份引用了錯誤作用域的 `outputBase`。應抽出一個接收 output base／SRT path 的共用 helper，避免兩條 ASR 路徑語意漂移。
- 證據：`lib/whisper-quality.mjs:1-46` 的 parser 具備有限值判斷與時間容許誤差，但沒有欄位範圍契約、schema 版本／來源資訊或保留原始 segment index 的安全對應；`server.mjs` 的空 catch 也沒有把「JSON 缺失」「無 quality 欄位」「格式錯誤」「時間／數量 mismatch」寫入 job log，降低可診斷性。
- 證據：`docs/project-management/08-CHANGE-LOG.md:102-117` 將條目放在兩個已完成的 2026-07-27 條目之後，狀態仍為「進行中／待執行」。`npm run docs:check:final` 仍回報通過，是因 `scripts/check-project-docs.mjs:60-61` 取 `entries[0]`，實際檢查的是較早的 line 47 工作條目，而不是 line 102 的本輪條目；這是結案 gate 的可追溯性缺陷，不能當成目前工作已完成的證據。

## 5. 測試覆蓋

- 判定：不通過
- 證據：2026-07-27（Asia/Taipei）執行 `npm run check`，治理文件、語法、既有回歸、`test-whisper-quality.mjs` 與核心 API 測試均 exit `0`；同日執行 `git diff --check` 亦通過。這證明現有自動化門檻可通過，但不是本輪 server／runtime integration 已覆蓋的證據。
- 證據：`scripts/test-core.mjs:400-417` 的品質保存／重載 fixture 直接把品質欄位送入 `save-review-package`，再由 `bilingual-cues.json` 原樣載回；它沒有預先建立 `working/quality-metadata.json`，也沒有驗證「沒有品質欄位的既有 bilingual cue 會由 engine metadata 補上」，所以未捕捉 `server.mjs:3541` 的條件錯誤。
- 覆蓋缺口：沒有斷言 Whisper.cpp 子行程收到 `-oj`／`-ojf`、沒有真實 JSON fixture 的 server attach、沒有 Python fallback 成功路徑、沒有 exit 139 時 job 狀態／錯誤訊息的整合測試、沒有 stale metadata 防護測試，也沒有 Windows `whisper-cli.exe` 或 Electron renderer 實測。

## 6. 實際運行結果

- 判定：部分通過，但不足以解除本輪阻擋
- 證據：2026-07-27（Asia/Taipei）執行 `./tools/whisper-cpp/whisper-cli --help`，help 明確列出 `-oj, --output-json` 與 `-ojf, --output-json-full`；因此短旗標在目前內建 CLI 可用。同日的 exact runtime command exit `139` 且未產出 JSON；`-ng -t 1` workaround 可產出 JSON，但 parser 實測只得到一個有時間、沒有 quality 欄位的 segment。
- 證據：2026-07-27（Asia/Taipei）以升級權限在 loopback 啟動隔離 server，呼叫 `curl -sS -H 'X-Offline-Subtitle-Token: fixture-token' http://127.0.0.1:19876/api/jobs/fixture-job/review-data`；回應成功但 bilingual cue 未包含 fixture 中應合併的 `confidence: 0.2`／`noSpeechProbability: 0.8`。這是實際 API 行為，不是單純靜態推論。
- 證據：未取得 Windows／macOS 安裝後、Electron renderer 或跨平台實機欄位映射證據；本輪工作紀錄已揭露 runtime exit 139，但沒有自動化或 server-level regression 保證該失敗會被保留為可診斷的 failed／fallback 狀態。

## 綜合判定

- 結論：不通過
- 完整逐字結論句：**本輪 2026-07-27「接入 Whisper.cpp 品質 metadata 通道」獨立審查結論為不通過：目前 Apple Silicon 內建 Whisper.cpp 的真實 JSON 沒有 segment-level confidence／no-speech 欄位，Python Whisper fallback 引用未定義的 `outputBase` 並存在執行時錯誤，既有 `bilingual-cues.json` 時 `review-data` 會跳過 `quality-metadata.json` 合併，且缺少 server／runtime／保存重載整合測試；雖 `-oj`／`-ojf` help、基本 parser 測試、完整 `npm run check` 與 exit 139 風險揭露均已確認，仍不能判定本輪 metadata 通道已安全完成，也不得宣稱 0.47 完整驗收或發布核准。**
- 阻擋問題：
  1. `server.mjs:1385` 的 Python fallback `outputBase` 未定義；任何成功進入該路徑的轉錄都可能在產出 SRT 後因 ReferenceError 失敗。
  2. `server.mjs:3541` 將品質合併錯誤地限制在不存在 `bilingual-cues.json` 的情況；既有 review package／重啟情境會遺失或無法補回 engine quality。
  3. 目前真實內建 Whisper.cpp 的 JSON 只有 token probability `p`，沒有本輪要求的 segment-level confidence／no-speech；exit 139 的 default Metal 路徑也仍未解決。不能以 parser 正例代替實際 engine metadata 證據。
  4. `npm run docs:check:final` 未檢查本輪 line 102 條目，卻回報「最新紀錄已結案」；治理 gate 對本輪狀態失真，不能作為結案依據。
- 剩餘風險：
  - schema-tolerant parser 對空陣列、只有 timestamps、部分壞 segment、欄位超界與 mixed schema 的保護未被證明；filter 後再按位置配對可能造成錯誤資料被誤對應。
  - malformed／missing metadata 的空 catch 與 stale `quality-metadata.json` 可能讓診斷資訊消失，或在重新執行時沿用上一輪品質資料。
  - Windows `whisper-cli.exe`、Electron、Windows／macOS 安裝後流程、實際工作重啟與 review UI 端到端品質篩選均未驗證。
  - 若產品決定把 token `p` 當成 confidence，必須另訂明確語意與範圍契約；目前不能無聲推導，否則會違反「不偽造 confidence」的需求。
- 給主要開發代理的具體修正要求：
  1. 修正 Python fallback 的 `outputBase` 作用域，將兩條 ASR 路徑的 JSON／SRT／quality attach 流程抽成共用 helper；新增可成功執行 Python path 的 regression test。
  2. 讓 `review-data` 在已有 `bilingual-cues.json` 時仍以嚴格 count／time／ID 規則合併 `quality-metadata.json`，保留使用者文字與編輯資料；補「既有 package 無 quality、working 有 quality」的 API 保存／重載測試。
  3. 以目前內建 runtime 的真實 JSON fixture 補 schema 測試，明確記錄 token `p` 是否可被採用；若不能，應把本輪狀態維持為 rule-score fallback，不能宣稱 engine quality metadata 已接入。若要支援 confidence／no-speech，需取得有明示欄位的 runtime／輸出契約並實測映射。
  4. 補 parser 的 `segments`／空 `transcription`／timestamp-only／mixed invalid segment／超界值測試，以及 server malformed JSON、count／time mismatch、stale metadata 清除與無 quality 欄位回落測試。
  5. 補實際子行程參數斷言與 runtime smoke：記錄 default Metal exit 139、驗證失敗時 job 狀態與診斷 log，另驗證可接受的 CPU workaround；再補 Windows binary 與 Electron／跨平台實機證據。
  6. 修正 `docs:check:final` 的最新條目選取，或將本輪條目置於真正最新位置；重新執行 final gate，確保它檢查 line 102 的 `進行中／待執行` 狀態，而不是舊的已完成條目。
  7. 上述修正後建立 round2 新報告，不覆寫本報告；在未解除阻擋前不得將本輪改記為通過或發布核准。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證；未修改任何其他專案檔案或既有審查報告。驗證期間建立的 WAV／fixture 僅位於 `/tmp`，未寫入專案工作樹。
- 若上述聲明不實，本報告無效。
