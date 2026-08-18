# 偵錯與修改歷程

## 紀錄格式

每個缺陷記錄：`BUG-ID`、日期／版本、現象、影響、重現、根因、修正、驗證、防回歸、剩餘風險。

## 重要既有缺陷

### BUG-001：portable Python／Whisper 綁定開發機路徑

- 現象：換到其他 Windows 電腦後找不到 Python 或 Whisper。
- 根因：venv 與 launcher 保存開發機絕對路徑。
- 修正：改用 bundled Whisper.cpp；runtime resolver、manifest 與 SHA 驗證取代開發機 venv 依賴。
- 防回歸：`verify-runtime-package.mjs` 與平台 runtime 準備腳本。

### BUG-002：Windows 中文檔名亂碼

- 現象：匯入、任務資料或輸出顯示 mojibake。
- 根因：UTF-8 被誤解為 Latin-1／Windows 編碼處理不一致。
- 修正：統一 UTF-8 路徑與回應處理。
- 防回歸：核心測試包含中文檔名案例。

### BUG-003：FFmpeg ASS filter 的 Windows 磁碟機路徑

- 現象：硬字幕輸出因 `C:` 等路徑字元解析失敗。
- 根因：filter 字串中的 Windows 絕對路徑需特殊跳脫。
- 修正：以輸出工作目錄與相對 `subtitle.ass` 執行。
- 防回歸：硬／軟字幕輸出 API 測試。

### BUG-004：Azure GPT-5 不支援 `max_tokens`

- 現象：連線測試回覆要求改用 `max_completion_tokens`。
- 根因：舊 chat completions 參數套用到 GPT-5 部署。
- 修正：0.45.1 改送 `max_completion_tokens`。
- 防回歸：AI provider contract tests 驗證請求參數。

### BUG-005：GPT-5 不接受 `temperature: 0.1`

- 現象：AI 優化在部分 GPT-5 部署回覆 unsupported value。
- 根因：optimizer 固定傳送 0.1。
- 修正：0.45.1 移除固定 temperature，使用模型預設。
- 防回歸：provider／optimizer 測試確認不再傳送不相容值。

### BUG-006：AI 優化面板佔用字幕清單空間

- 現象：未使用 AI 時仍大幅壓縮右側校閱區。
- 根因：AI 控制區始終展開。
- 修正：預設精簡、可展開／收合、保存偏好；任務開始時自動展開。
- 防回歸：`test-review-ui.mjs` 驗證狀態、記憶與自動展開。

### BUG-007：Windows 手冊 MP4 被最終 NSIS 過濾

- 現象：`win-unpacked` 有 MP4，但最終 EXE 清單缺少動畫。
- 根因：最終封裝流程未保留 `.mp4` 資產。
- 修正：保持 MP4 內容但使用 `.osfvideo` 資源副檔名，HTML 明確宣告 `type="video/mp4"`。
- 防回歸：workflow 檢查三個資源；發布前以 `7za l` 與 `ffprobe` 交叉驗證。

### BUG-008：GitHub 中文 Windows 資產名稱被簡化

- 現象：中文檔名上傳後變成 `0.45.1.exe`／`Setup.0.45.1.exe`，與 checksum、blockmap、`latest.yml` 不一致。
- 根因：GitHub CLI／Release 對上傳檔名進行平台正規化。
- 修正：Release 使用穩定 ASCII 名稱，更新 checksum，驗證後刪除錯誤重複資產。
- 防回歸：部署文件規定使用 ASCII 發布名稱並在上傳後核對實際名稱。

### BUG-009：AI 輸出語言僅支援三個固定選項

- 現象：設定介面只有繁中、簡中與英文；其他語言無法選擇，未支援值會靜默回退繁中。
- 影響：使用者誤以為指定語言已生效，但 LLM 實際收到 `zh-TW`，造成翻譯或校對語言錯誤。
- 根因：前端選項與 `normalizeAiSettings` 都以三值白名單硬編碼，Prompt 沒有共用語言驗證層。
- 修正：新增 `lib/ai/languages.mjs`，統一 BCP 47 驗證與標準化；UI 增加常用語言及自訂標籤；設定與 AI 任務 API 拒絕無效新輸入；Prompt 只採用驗證後值。
- 防回歸：optimizer、review UI 與 core API 測試覆蓋標準化、自訂語言、舊設定回退及注入型字串拒絕。
- 剩餘風險：LLM 是否完全遵循目標語言仍受供應商模型能力影響，必須由使用者逐段確認建議。

### BUG-010：Groq／Gemini 選項會被後端無聲回退

- 日期／版本：2026-07-22／0.45.2 候選修正。
- 現象：前端可選 Groq 或 Google Gemini，但儲存後供應商回到 `openai-compatible`；切換時可能殘留 Azure 欄位，Gemini 優化回應格式也與 optimizer 契約不一致。
- 影響：使用者看到的供應商與實際執行者不同，profile／API Key 可能落入錯誤供應商槽位，Gemini 優化可能在回應驗證階段失敗。
- 重現：對 `/api/ai/settings` 傳入 `provider: "groq"` 或 `"gemini"`，舊版 `normalizeAiSettings` 僅接受 OpenAI、OpenAI-compatible、Azure，因而回退預設值。
- 根因：供應商清單分散在 HTML、server endpoint 與 adapter；新增 UI／adapter 時未同步後端三處白名單，Gemini adapter 又使用原生回應格式而未符合既有 optimizer 的 OpenAI choices 契約。
- 修正：由 provider registry 匯出共同驗證函式；設定、profile、runtime key 與刪除金鑰 API 明確驗證供應商；Groq／Gemini profile 與 secrets 按 ID 隔離；Gemini 優化改用 OpenAI 相容 chat completions；UI 驗證 provider，非 Azure 欄位清空停用，連線前檢查已保存設定與金鑰。
- 驗證：`test-ai-providers.mjs`、`test-review-ui.mjs`、`test-core.mjs` 與 2026-07-22 本機瀏覽器切換實測通過。
- 防回歸：provider definitions、非法 provider 400、跨 provider 金鑰清除隔離與 UI 切換契約均納入 `npm test`。
- 剩餘風險：尚未使用真實 Groq／Gemini 帳號執行外部 smoke test；既有 0.45.2 候選安裝包未包含本修正，須重新建置與驗證。

## 新缺陷處理

發現新問題先在 `08-CHANGE-LOG.md` 記錄，再於本文件新增 `BUG-ID`。修正不得只寫「已解決」，必須包含可重現證據、根因與防回歸測試；若只能 workaround，須說明移除條件。

### BUG-WHISPER-METAL-139 — macOS Metal buffer allocation crash

- 日期／版本：2026-07-30／0.48.0
- 現象：macOS arm64 以 bundled `whisper-cli`、tiny model、1 秒 16 kHz silence WAV 執行 `-oj -ojf`，process exit 139，未產生 JSON。
- 重現：`tools/whisper-cpp/whisper-cli -m tools/whisper-models/ggml-tiny.bin -f /tmp/whisper-metal-smoke.wav -oj -ojf -of /tmp/whisper-metal-smoke`。
- 實際結果：exit `139`；stderr 在 `use gpu = 1` 後出現 `ggml_metal_buffer_init: error: failed to allocate buffer, size = 2.20 MiB`；stdout 為空，JSON 不存在。
- 對照結果：同一 WAV／model 加 `--no-gpu` 執行 exit `0`，產生 `/tmp/whisper-cpu-smoke.json`；CPU stderr 顯示完整 processing／output_json／timings。
- 根因判定：已確認為目前主機 bundled Whisper.cpp Metal buffer allocation 路徑的可重現 runtime failure；尚不能推論所有 macOS／模型／媒體均受影響。
- 修正狀態：0.48.x 穩定化已在 `runWhisperCpp` 加入 Metal 非零退出後的 `--no-gpu` CPU retry；CPU 仍失敗時維持 failed，不把 crash 當成功。
- 防回歸／後續：完整回歸與 CPU 對照證據通過；需在 macOS 實機長音訊與乾淨安裝環境持續驗證 retry 耗時、取消與 quality metadata 清理。
- 剩餘風險：未在乾淨 macOS 使用者環境、Windows 或長音訊驗證；目前產品路徑仍可能在 Metal crash 時失敗。
# BUG-012 — OpenAI-compatible 顯示 Gemini 舊設定

- 發現版本：0.45.2（2026-07-22）
- 現象：AI 設定服務類型為 `OpenAI-compatible`，但 Base URL 為 `generativelanguage.googleapis.com/...`、模型為 `gemini-3.5-flash`。
- 根因：舊設定的供應商值與 Gemini 的 Base URL／模型被分開保存；載入時供應商回退為 `openai-compatible`，卻未清除不相容的舊欄位。
- 修正方向：0.45.3 載入設定時辨識 Gemini URL／模型與 OpenAI-compatible 的不一致組合，回復 OpenAI-compatible 預設 Base URL／空模型；不刪除 API Key、不修改 Gemini profile。
- 回歸防護：核心 API 測試加入舊 Gemini／OpenAI-compatible 混用資料遷移案例。
- 未覆蓋：目前尚未完成已存在使用者設定檔的實機升級驗證，需於 0.45.3 實機 smoke test 補齊。

# BUG-013 — 設定語系仍提供不需要的簡體中文選項

- 發現版本：0.45.2（2026-07-23）
- 現象：介面語言與 AI 輸出語言選單均提供簡體中文，與目前產品語系範圍不符。
- 影響：使用者可能選擇不支援的介面語系；既有 `zh-CN` 設定也可能在 UI 中繼續顯示為可用選項。
- 修正方向：移除兩個 UI 選單中的 `zh-CN`；伺服器載入既有 `appLanguage: zh-CN` 時回退 `zh-TW`；保留 AI 自訂 BCP 47 API 的標準化相容性。
- 回歸防護：UI 契約測試確認 `zh-CN`／簡體中文選項不存在，核心測試確認舊介面設定回退繁中。

# BUG-014 — 翻譯模式回傳不相關術語而非翻譯

- 日期／版本：2026-07-30／0.48.0 測試版。
- 現象：選擇翻譯後，AI 建議出現 `E3;平台名稱`，未產生完整翻譯。
- 影響：使用者可能誤接受不相關文字，覆蓋正確譯文。
- 重現：Ollama `llama3.2:1b`、專案術語表含「一三 → E3｜平台名稱」、翻譯中文 cue；既有 optimizer 以 `translatedText` 當輸入並把整份術語表送入每批。
- 根因：翻譯模式在 UI scope 已選原文，但 optimizer 正規化階段再次優先採用既有譯文；不相關術語表污染小模型提示，且翻譯結果缺少長度與目標語言驗證。
- 修正：翻譯模式固定以 `sourceText` 為輸入；傳給模型的 cue 僅保留 `id/text`；每批只帶入原文實際出現的術語；拒絕過短或英文／日文／韓文語系不符結果；新任務先清除舊建議；UI 類型由受控 mode 顯示。
- 驗證：`npm run check` 通過；真實 Ollama 英文兩 cue 測試與封裝 App 內模組同案例通過，建議均為 `mode: translate` 且未含 `E3／平台名稱`。
- 防回歸：`test-ai-optimizer.mjs` 覆蓋既有譯文、無關術語、過短輸出與日文語系不符；`test-review-ui.mjs` 覆蓋舊建議清除與受控模式標示。
- 剩餘風險：`llama3.2:1b` 可完成英文翻譯但語意品質有限；日文實測未遵循目標語言時會安全拒絕，建議使用較大模型並逐段人工確認。

# BUG-015 — Whisper SRT 零長度時間碼造成校閱載入失敗

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：載入校閱時回報「字幕第 703 段時間碼無效」。
- 影響：Whisper.cpp Small 已完成轉錄但無法進入字幕校閱；同一輸出另有第 704、707 段零長度時間碼。
- 重現：讀取本機 job `/Users/nycu/Library/Application Support/offline-subtitle-factory/jobs/20260805011912-3fca91/working/draft.srt`，第 703 段為 `00:23:53,560 --> 00:23:53,560`，第 704 段相同，第 707 段為 `00:23:54,160 --> 00:23:54,160`；`public/bilingual-subtitles.mjs` 的 `normalizeBilingualCue` 對 `end <= start` 拋出載入錯誤。
- 根因：Whisper.cpp 原始 SRT 可產生開始與結束相同的零長度 cue；`runWhisperCpp` 直接把原始檔複製成 `draft.srt`，未在寫入前套用與校閱解析器一致的嚴格時間碼驗證。
- 修正：新增純函式 SRT 清理器，嚴格解析時間碼、捨棄格式錯誤或 `end <= start` 的 cue、保留有效 cue 並重新編號；Whisper／Whisper.cpp 寫入 `draft.srt` 前套用，既有任務進入校閱資料 API 時也以同一清理器相容載入，全部無效時以可採取行動的錯誤結束；保留原始 Whisper 輸出供診斷。
- 驗證：focused 清理器與實際 job 703／704／707 回歸、`parseSrtBilingual` 載入、完整 `npm run check`、兩平台封裝與 ZIP 完整性、獨立審查及文件結案檢查。
- 防回歸：`scripts/test-whisper-srt.mjs` 覆蓋零長度、逆序、格式錯誤、多行文字、重新編號及全部無效邊界；後續 Whisper 輸出均經同一清理器。
- 剩餘風險：被捨棄 cue 的原文不會進入校閱，可能造成少量內容遺失；需由外部驗收確認長音訊、Windows 實機及清理後中文內容品質，模型本身的幻覺／辨識率不在本缺陷修正範圍。

# BUG-016 — Ollama 多批次 AI 優化逾時

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：使用 Ollama 進行多筆 AI 優化時回報「AI 優化失敗：AI 請求逾時」。
- 影響：已完成的批次仍保存於 checkpoint，但整個 AI 任務在單一批次逾時後變成 failed；使用者需要手動恢復，且容易誤以為所有批次遺失。
- 重現：本機 job `/Users/nycu/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json`；provider=`ollama`、model=`llama3.2:3b`、55 cues、55 batches、`timeoutSeconds=120`、`maxRetries=1`；第 1／2 批完成後第 3 批逾時，記錄 `progress.completedBatches=2`、`checkpoint.nextBatchIndex=2`、`error=AI 請求逾時`、`retryable=true`。
- 根因初判：Ollama 原生 `/api/chat` 請求使用 `stream:false` 並套用單次絕對 fetch timeout；本機低資源模型對特定 cue 可能超過 timeout，既有批次雖有 checkpoint，但 timeout 錯誤沒有提供更細緻的本機長生成處理與恢復提示。
- 修正：Ollama 原生 `/api/chat` 改用 `stream:true`；新增 NDJSON fragment 組裝，並將 timeout 重設為每片段的 idle timeout；保留 strict JSON／cue 驗證與 checkpoint，timeout 且已有完成批次時明確提示可恢復，不以無限延長 timeout 或靜默接受部分結果取代修正。
- 驗證：`test-ai-providers.mjs`、`test-ai-optimizer.mjs`、`test-ollama-batch-stream.mjs` 與完整 `npm run check` 通過；deterministic 三批次 streaming 在 100ms idle timeout 下完成，timeout checkpoint 續跑只送未完成批次；本機 Ollama `127.0.0.1:11434` 未啟動，真實模型 smoke 待外部驗收。
- 防回歸：provider contract 驗證 `stream:true`／NDJSON；delayed chunk 驗證 idle timer 每片段重設；optimizer 驗證第 3 批 timeout 後 `nextBatchIndex=2` 且續跑不重送前兩批；server 錯誤訊息保留已完成批次數量與恢復指引。
- 剩餘風險：模型本身可能在複雜字幕上生成極慢或卡住；若超過安全上限仍須讓任務可恢復失敗，不能保證所有低資源模型／字幕永不逾時。

# BUG-017 — Ollama 第 3 批重試後仍逾時

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：BUG-016 的 streaming 修正封裝於第 3 批仍顯示「受限或失敗，第 1 次重試，等待 2 秒」，重試後再次回報「AI 優化失敗：AI 請求逾時」。
- 重現：job `/Users/nycu/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json` 更新至 2026-08-05 11:27；`provider=ollama`、`model=llama3.2:3b`、`completedBatches=2/55`、`activeBatch=3`、`retryAttempt=1`、`retryable=true`、`checkpoint.nextBatchIndex=2`、`error=AI 請求逾時`。本機 Ollama `127.0.0.1:11434` 目前連線拒絕，無法取得同一 cue 的真模型 response。
- 症狀與根因區分：症狀是串流重試仍逾時；已確認原 transport 在 `fetch` 收到 response headers 後沒有重新開始 body idle timeout，若 Ollama 在 headers 後才產生第一個 NDJSON chunk，仍會沿用 request 起始計時器；此外 timeout 重試沿用相同 120 秒上限，沒有為低資源模型增加可控的第二次等待窗口。
- 修正：`requestAiJson` 在 `fetch` 完成後重新 arm timeout；Ollama native request 增加 `num_predict=512`、`keep_alive=10m`，避免無界生成與每批重新載入；optimizer 對 Ollama timeout 的下一次 retry 自動將 timeout 加倍（120→240 秒，最高 600 秒），並把延長值寫入 retry progress；UI 重試訊息顯示本次 timeout 上限；checkpoint／strict cue validation 保持不變。
- 驗證：`test-ai-providers.mjs` 覆蓋 Ollama streaming、chunk idle reset、headers 後延遲第一 chunk、`num_predict`／`keep_alive` contract；`test-ai-optimizer.mjs` 覆蓋 Ollama timeout retry 延長至 240 秒與進度 telemetry、既有 checkpoint resume；`test-ollama-batch-stream.mjs` 三批次 streaming 通過。完整回歸、兩平台封裝與真實 Ollama smoke 待本輪結案補記。
- 防回歸：timeout 重試不得重送已完成批次；若延長窗口仍無任何 response，仍以 retryable failed 保存 checkpoint，不靜默產生 AI 建議。
- 剩餘風險：真實 `llama3.2:3b` 仍未於本環境啟動驗證；若模型在 240／600 秒內完全沒有輸出，任務仍會安全失敗並需恢復；Windows 實機與不同 Ollama 版本的 `keep_alive`／`num_predict` 行為仍待外部驗收。

# BUG-018 — Ollama 回傳內容非有效 JSON

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：Ollama 第 3 批不再 timeout，但回報「AI 優化失敗：AI 回傳內容不是有效 JSON」。
- 重現：job `/Users/nycu/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json` 於 2026-08-05 12:10 為 `status=failed`、`provider=ollama`、`model=llama3.2:3b`、`completedBatches=2/55`、`nextBatchIndex=2`、`suggestions=2`、`mode=proofread`、`language=ja`；本機 Ollama `127.0.0.1:11434` 連線拒絕，未保存 raw model response。
- 根因判定：`parseCompletionContent` 原先只接受完整 JSON 或單純 code fence，沒有安全處理模型在 JSON 前後附加說明；對真正 malformed／截斷 JSON 也沒有 Ollama 專用一次性 repair，因此 strict parser 直接讓批次失敗。無 raw response 時不能把本次錯誤進一步歸因為 wrapper、截斷或模型 schema 失守其中一項。
- 修正：解析前保留 strict JSON 契約，但可從前後包裝文字中擷取完整 `{...}`／`[...]` JSON 再驗證；Ollama malformed JSON 只觸發一次簡化 repair prompt，第二次仍無效則拒絕，不接受原文或不完整 cue；UI 顯示「正在要求 Ollama 重新輸出 JSON」；既有 checkpoint／cue ID／數量／順序驗證不變。
- 驗證：`test-ai-optimizer.mjs` 覆蓋 wrapper extraction、Ollama proofread malformed→repair、repair 第二次仍 malformed 的拒絕與最多兩次請求；既有 provider／timeout／stream tests 與完整受控權限 `npm run check` 通過；兩平台 ZIP `unzip -t`、source markers／Small manifest 核對通過；真實 Ollama raw response／同一 job 修正後重跑與 Windows 實機仍待外部驗收。
- 防回歸：只對 `provider=ollama` 且 `code=invalid_json` 進行一次 repair；translation 仍使用既有專用 repair；非 Ollama provider 不改變原有 JSON path；修復後仍必須通過 cue strict validation。
- 剩餘風險：本機未啟動真實 Ollama，尚未取得原始 malformed response；若模型回傳內層未跳脫引號、截斷或 valid JSON 但 cue contract 錯誤，repair 仍可能安全失敗；Windows 實機與不同 Ollama 版本仍待外部驗收。

# BUG-019 — Ollama cue 文字長度異常

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：Ollama AI 優化在 cue 344 回報「AI 文字長度異常」；該批未完成，既有 checkpoint 仍可續跑。
- 重現：job `/Users/nycu/Library/Application Support/offline-subtitle-factory/jobs/20260805024615-2af944/ai-output/checkpoint.json`；`provider=ollama`、`model=llama3.2:3b`、`progress.completedBatches=4/55`、`checkpoint.nextBatchIndex=4`、`mode=proofread`、`language=ja`；cue 344 原文為「如果老師選擇Excel的話」，本機未保存 raw model response，Ollama 目前連線拒絕。
- 根因判定：strict validator 對 cue 文字使用 `Math.max(500, original.length * 6)` 上限；本次模型回應已超過安全上限，可能含解說、重複內容或無界生成。因沒有 raw response，不能把具體內容形式宣稱為已證實的單一原因；放寬上限或截斷都會讓錯誤內容進入字幕。
- 修正：抽出一致的 cue 長度上限計算；原始 prompt 明確列出每個 cue 的字元上限並禁止解說／重複／Markdown；Ollama 遇到 length validation failure 只執行一次專用 JSON repair，repair 仍超長即拒絕；UI 顯示「回應文字過長，正在要求 Ollama 重新輸出」；ID／數量／順序／strict validation／checkpoint 保持不變。
- 驗證：`test-ai-optimizer.mjs` 覆蓋 cue 344 過長→一次 repair 成功、第二次仍過長拒絕、`validationRepairReason=length` telemetry，以及非 Ollama provider 仍嚴格拒絕；provider／stream 回歸與完整 `npm run check`、兩平台測試包與 ZIP 完整性待本輪結案補記。
- 防回歸：length repair 不截斷、不套用原文 fallback、不寫入未完成批次；若模型再次超長，保留上一個成功 checkpoint，使用者可從 `nextBatchIndex` 恢復。
- 剩餘風險：真實 Ollama raw response／同一 job 修正後 55 批重跑、Windows 實機與不同 Ollama 版本仍待外部驗收；若模型持續產生超長輸出，仍會安全失敗而非保證成功。

# BUG-020 — AI 優化前端 `Failed to fetch`

- 日期／版本：2026-08-05／0.48.0 測試版
- 現象：校閱頁在 AI 優化流程顯示「AI 優化失敗：Failed to fetch」。
- 重現／基準：需求方未提供本次 job ID、renderer console 或 server log；目前可讀取的最近 job `20260805024615-2af944` 已是 `status=completed`、55/55，沒有可將本次錯誤歸因到 Ollama response 的 failed checkpoint。`public/review.js` 原先在啟動／輪詢 `/api/jobs/:id/ai-optimize` 的瀏覽器 fetch 例外直接顯示原生 `Failed to fetch`。
- 根因判定：已確認可見錯誤是 renderer→本機字幕工廠 HTTP API 層的未正規化 fetch 例外；尚不能由目前證據判斷是 App server 暫停／port 變更、Windows 啟動生命週期、網路堆疊或請求回應中斷。Ollama provider 內部錯誤另由 `requestAiJson` 正規化，不與本錯誤混同。
- 修正：新增 `public/ai-fetch.mjs`，將 `Failed to fetch`／`NetworkError`／`Load failed`／`fetch failed` 等本機 API 不可達錯誤轉成包含 API 位址、重啟／重新載入與 checkpoint 恢復指引的可診斷訊息；AI 狀態 GET 失聯時最多重試兩次；啟動 POST 回應遺失時先查詢既有任務狀態，若已在 server 執行則接回輪詢；API 回應非 JSON 時明確標示格式錯誤。未自動重送啟動 POST，避免建立重複 AI 任務。
- 防回歸：`scripts/test-ai-fetch.mjs` 覆蓋 network error 正規化、非 network provider error 不誤判、invalid API response 與 retryable marker；`npm test` 接入測試。保留既有 strict cue validation、Ollama repair／timeout 與 checkpoint。
- 驗證：`node --check public/review.js`、`node --check public/ai-fetch.mjs`、`node --check public/ai-status-recovery.mjs`、`node scripts/test-ai-fetch.mjs`、`node scripts/test-review-ui.mjs`、`node scripts/test-ai-optimizer.mjs`、受控完整 `npm run check`、`git diff --check` 已通過；最新 macOS arm64／Windows x64 ZIP `unzip -t` 通過，SHA-256 分別為 `ebac55d1fc7d40de54e7c113d7da4eec531c4099c52ed0be727f2d4c57da9bb0`／`2ec03b3de2a541e4d3272a4563cdca9d2f00f25b7fa6738954e5db0ee7c9c998`；兩平台 source markers 與 Small manifest 核對一致；round2 獨立複審已完成，真實 renderer／Windows 實機／Ollama smoke 仍為外部驗收條件。
- 剩餘風險：沒有本次實際 renderer console／server log，無法證明單一外部觸發原因；若 server process 已完全停止，前端只能提供重啟與恢復指引；若 POST 已送達但 GET 也不可達，仍需重新載入 App 後以 checkpoint 恢復。Windows 實機與真實 Ollama multi-batch smoke 仍待外部驗收。

# FR-023 — Windows Whisper 高階模型需手動下載

- 日期／版本：2026-08-06／0.48.0 測試版
- 現象：Windows 安裝包選擇 Base／Small 時，若模型檔不存在，只顯示「請安裝或匯入正確模型後再試」，使用者必須自行尋找下載來源與可寫入路徑。
- 根因：三模型選擇已存在，但模型資產不一定隨平台包附帶；Electron server 使用安裝資源目錄作為工具來源，Windows 安裝目錄可能不可寫入，且既有 UI 沒有下載狀態／手動 URL／首次使用前檢查。
- 修正：新增固定 revision 的官方 Whisper.cpp multilingual Base／Small／Tiny download definitions；`server.mjs` 提供模型狀態與下載 API，下載到 `userData/whisper-models`、限制白名單、回報進度、驗證預期大小／SHA-256、失敗清理暫存檔並原子置換；`public/app.js` 在模型選擇與任務提交前顯示確認、進度與官方手動下載說明；`lib/whisper-models.mjs` 支援 user cache 優先、封裝模型 fallback。
- 驗證：`test-whisper-model-download.mjs` 覆蓋成功／HTTP 失敗／大小／SHA／AbortController 逾時／Windows 既有檔替換／暫存清理，並在 `.download` 已寫入部分內容後取消；`test-whisper-models.mjs` 覆蓋模型管理 UI；`test-core.mjs` 覆蓋 `/api/whisper-models` pinned metadata，以及 POST→部分 bytes→DELETE→無 `.download`／`.previous` 的 active API 路徑；完整 `npm run check`、兩平台封裝／source marker 與 docs check 已通過；Windows 實機下載／userData 權限／中文口說品質仍待外部驗收。
- 防回歸：不接受任意 URL／任意檔名；缺模型不可建立或啟動 ASR；下載 response 不符 size／SHA 不寫入正式檔；保留手動下載 URL 與 userData cache 路徑。
- 剩餘風險：尚未在 Windows 實機執行實際 148 MB／488 MB 下載、安裝權限、網路中斷／續跑與中文口說品質驗收；若下載失敗，使用者仍須依官方 URL 手動下載後重新檢查。

# SYNC-024 — GitHub Windows 測試修正同步

- 日期／版本：2026-08-06／0.48.0 測試版
- 現象：需求方表示 Windows 測試問題與修正已更新 GitHub，要求同步至目前專案。
- 核對：`git fetch --prune origin` 後，GitHub Windows Ollama 修正 `4d0bee6` 與本地 HEAD `170e08e` 的指定 runtime diff 為空，沒有重複套用；最新 `origin/main=baed6d7` 另包含 Azure OpenAI request parameter 修正。
- 修正：選擇性整合 Azure capability probe 的 `max_completion_tokens`；Azure deployment 請求移除 optimizer 內部欄位與 model；OpenAI-compatible chat completion 移除內部 operation／language／cue metadata；保留本地 Ollama streaming／timeout／repair 與 Windows 翻譯修正。
- 驗證：provider／optimizer／Ollama streaming focused tests 與完整 `npm run check` 通過；macOS／Windows 測試包三個 AI runtime source marker 與工作樹一致，ZIP 更新後需由外部 Windows 實機確認啟動與真實端點行為。
- 剩餘風險：沒有 Windows 實機或真實 Azure／Ollama endpoint 證據，不能把 GitHub commit 核對、contract mock 或本機 ZIP 同步宣稱為跨平台實機驗收。

# REL-025 — Electron／builder 供應鏈弱點阻擋發布

- 日期／版本：2026-08-10／0.48.1 發布候選
- 現象：發布前完整 `npm audit` 在 Electron 33／electron-builder 25 鎖檔回報 16 項弱點（15 high、1 critical），其中同時包含 runtime 與建置鏈風險，不能只以 production-only audit 為 0 宣稱可發布。
- 根因：專案仍鎖定 `electron@33.4.11`、`electron-builder@25.1.8`；先前供應鏈盤點已辨識需要 major 升級，但當時因相容性與跨平台封裝證據不足而延後。
- 修正：升級至 `electron@43.3.0` 與 `electron-builder@26.15.7`，保留 macOS 12 最低支援線；不升至要求 macOS 13 的 Electron 44。同步把開發／CI Node 引擎下限提高為 22.12.0，避免以不受 Electron 43 工具鏈支援的 Node 20 安裝。下載、renderer verifier 與雙平台打包沿用受控固定流程。
- 驗證：升級後完整 `npm audit --json` 為 0；`npm run check`、macOS arm64 runtime／目錄版、隔離 userData packaged renderer smoke、Windows x64 runtime／目錄版／Setup／Portable 建置均通過。封裝內版本、PE 架構、Tiny-only 模型政策與本版 Release notes 已核對。
- 防回歸：發布驗證保留 dependency tree／audit、兩平台 build、封裝 source marker、updater metadata 與 SHA 核對；未來 Electron major 升級必須重新確認最低 OS 與 packaged renderer。
- 剩餘風險：Windows 10／11 實機啟動／安裝／解除安裝與本版 macOS DMG／ZIP 乾淨安裝仍未完成；`asar:false` 為既有封裝強化債務；Windows 未 Authenticode、macOS 未 Developer ID／公證。

# BUG-021 — Breeze runtime 缺件沒有可操作處理方法

- 日期／版本：2026-08-13／0.49.0
- 現象：選取 Breeze ASR 25 後只顯示「需安裝 patched Whisper runtime」，沒有官方安裝步驟、啟動命令或重新檢查入口。
- 重現：在任務表單選擇 `breeze-asr-25`，API 回報模型有效但 `runtimeReady=false`；原前端只寫入狀態／log 後 return false。
- 根因：runtime 是不隨 App 封裝的外部 Python／patched Whisper；既有前端沒有 guide modal。初版指引又在普通 clone 後直接 pip install 空的 submodule，並在 Breeze repo 內執行本 App 的 `npm start`，無法完成實際安裝／啟動。
- 修正：新增固定非秘密的 guide API 與 runtime modal，提供 `git clone --recurse-submodules`、家目錄 venv、模型／runtime 驗證，以及本專案開發版、macOS `/Applications`、Windows NSIS 預設路徑的啟動命令；模型下載視窗與 ASR 欄位保留 persistent 指引入口；App 不自動執行 shell／pip。
- 驗證：`test-breeze-asr.mjs` 覆蓋 submodule 初始化、平台命令、安裝版啟動路徑與錯誤 cwd 負向條件；`test-core.mjs` 覆蓋 API guide；`npm run check`、UI 缺件 smoke、`npm run docs:check:final` 與 `git diff --check` 待 round2 完成後補記。
- 防回歸：後續若改動 guide，必須同步 `docs/BREEZE-ASR-25.md`、功能設計、測試稽核與本測試；不得把未安裝真實 runtime／checkpoint 的 deterministic 證據描述成模型品質或跨平台實機驗收。
- 剩餘風險：Python／git／pip／網路、第三方 submodule 供應鏈、真實 3 GB checkpoint、Windows PowerShell／macOS shell、安裝後啟動、品質／效能／長音訊／取消與 process tree 仍待外部驗收。

# BUG-022 — Breeze runtime 路徑與首頁健康卡未同步

- 日期／版本：2026-08-13／0.49.0
- 現象：macOS 畫面顯示 Breeze ASR 25 模型已就緒但缺少 patched Whisper runtime；首頁系統效能卡片的 FFmpeg／轉錄引擎／Whisper 狀態仍停留「待檢查」。
- 根因判定：runtime 探針只以通用 bundled Python 與系統命令作回退，未涵蓋使用者家目錄的標準 Breeze venv；Windows 同時存在 `HOME`／`USERPROFILE` 時可能選錯家目錄，且一般 bundled Python 可能遮蔽真正的 patched venv。首頁健康 API 成功後未呼叫既有 `updateMetrics`，因此工具狀態沒有反映最新回應。
- 修正：`resolveBreezePython` 依平台優先解析 macOS／Linux `$HOME`、Windows `USERPROFILE` 的 `Breeze-ASR-25/.venv`，並把外部 patched venv 排在一般 bundled Python 前；`server.mjs`／`electron/main.mjs` 補齊 Unix `bin/python` 工具路徑；`refreshHomeHealth` 在健康 API 成功後同步更新系統工具卡片。
- 驗證：Node syntax、`node scripts/test-breeze-asr.mjs` 與完整 `npm run check` 通過；新增 macOS／Windows 標準 venv 偵測、Windows `USERPROFILE` 優先序、外部 venv 優先 bundled Python 與首頁 `updateMetrics` source assertion。
- 防回歸：明確 `BREEZE_ASR_PYTHON` 仍優先；缺件時不自動執行安裝命令；任何新平台路徑變更須加入平台衝突與 bundled／external 優先序測試。
- 剩餘風險：本機未安裝或未執行真實 MediaTek patched runtime、3 GB checkpoint、長音訊與品質／效能；Windows process tree、macOS／Windows 乾淨安裝與自訂 runtime 路徑仍需外部驗收。

# BUG-023 — Breeze 首次選擇未立即協助設定

- 日期／版本：2026-08-18／0.49.1 修正版候選
- 現象：選取 Breeze 時只更新狀態文字，模型下載與 runtime 指引要等到提交任務才出現；選單文字也把「實驗性／需另裝 runtime」混在產品名稱中。
- 根因：ASR 選擇器 change handler 只查詢狀態並自行分支，沒有共用提交前的 `ensureBreezeAsrReady()` readiness flow；產品名稱與限制說明未分離。
- 修正：選取 Breeze 後立即共用模型／runtime readiness flow；模型缺失開啟固定官方下載對話框，下載完成後接續 runtime guide，取消仍阻止任務建立；選單改為 `Breeze ASR 25`，限制與效能風險移至說明／發布文件。
- 驗證：`scripts/test-breeze-asr.mjs` 新增 UI 文字與首次選擇 source assertions；完整回歸與獨立審查待本輪結案補記。
- 效能依據：需求方 MacBook Air `Mac15,12`／Apple M3／8 GB／8 cores／macOS `26.5.2`（Build `25F84`）處理 1:46:00 影片約需 6 小時（約 `3.4×`）；單一本機觀察，不代表品質或跨平台效能驗收。
- 剩餘風險：模型約 2.88 GiB 且 runtime 不隨包提供；低資源 CPU 可能長時間執行，仍需真實 profiler、長音訊、品質、Windows／macOS 乾淨安裝驗收。
