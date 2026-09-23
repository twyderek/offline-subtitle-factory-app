# 目前專案狀態

> 最後查證日期：2026-09-23
> 現行版本：0.51.0
> 現行公開版本：0.51.0（GitHub Latest；macOS arm64-only）
> 發布 tag／commit：`v0.51.0` → `53956ccdee6e16e4c0413f09312a419613b27da6`
> 主分支：`main`

## 0.51.0 GitHub 正式發布（macOS arm64；Windows 暫緩）

- `v0.51.0` 已於 2026-09-22 公開為 GitHub Latest：<https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.51.0>；annotated tag 解析至來源 commit `53956ccdee6e16e4c0413f09312a419613b27da6`，發布來源為 `codex/0.51-anthropic-claude`。
- 公開 Release 包含 9 項 macOS arm64 資產：DMG／ZIP、兩個 blockmap、`latest-mac.yml`、SHA256 清單、簽章狀態、provenance 與候選說明。GitHub API 的名稱／大小／SHA-256 digest／直接下載 URL 與本機候選一致；DMG／ZIP／`latest-mac.yml`／SHA256 清單再由正式下載 URL 回讀並完成 hash／byte 比對。完整證據：`docs/project-management/evidence/2026-09-22-github-release-post-publish.json`。
- macOS Apple Silicon 兩條發布候選路徑均已通過實機 renderer、手動字幕、real trim／post-trim、AI review、glossary round-trip、8 providers 與清理；候選為 ad-hoc，`codesign --verify --deep --strict` 通過，但 `spctl` exit 3／rejected，未使用 Developer ID／公證，故不宣稱 Gatekeeper 通過。
- 開發驗證已完成：來源 commit 53956cc 的 `npm ci`、`npm audit=0`、`npm run check`、`git diff --check`、封裝／容器／metadata／SHA 驗證均通過；發布前 round1 與發布後 round2 獨立審查均只在 macOS arm64 release scope 內判定有條件通過。
- Windows 依需求方要求未做 macOS 主機上的實機驗收；branch／tag push 觸發的 Windows preview run `35700305138`、`35700315448` 與後續 `35714599428` 均因 `test-breeze-asr.mjs` 找不到可測試的 Breeze 效能提示更新函式而失敗。這不是 Windows 實機驗收，Windows 仍是未完成項目。
- 2026-09-23 已完成 BUG-032 的最小測試修正：`scripts/test-breeze-asr.mjs` 讀取 `public/app.js` 後正規化 CRLF／LF，並保留 CRLF fixture assertion；focused Breeze test 與完整 `npm run check` 通過。修正尚待提交後由 Windows preview runner 重跑，Windows 實機驗收仍暫緩，未修改 v0.51.0 Release。
- 其他未完成風險：正式 Applications／乾淨帳號、真正斷網、真實 AI／模型品質、Developer ID／公證／Gatekeeper，以及 Windows 安裝／renderer／實機品質；不以本次 macOS-only Release 擴大宣稱上述項目完成。

## 0.51.0 Anthropic Claude provider（已發布；後續品質驗證仍追蹤）

- 開發分支：`codex/0.51-anthropic-claude`，來源為已完成 BUG-026 可靠性修正的 `codex/0.50-whisper-small-long-cues@9c9a5d5`。
- 新增 Anthropic Claude Messages API adapter：模型清單與連線測試使用 `/v1/models`（不發送生成測試），優化使用 `/v1/messages`，以 `x-api-key`／`anthropic-version` 認證，並將 system prompt、`max_tokens` 與 content blocks 轉接至既有 AI optimizer contract。
- 設定、profile、runtime key 與磁碟 secret 以 `anthropic` provider ID 隔離；字幕內部 cue metadata、OpenAI `response_format` 與 API Key 不會外送或回傳至設定畫面。
- BUG-029 已完成：provider profile 只保存明確 allowlist 的連線／模型／批次／逾時欄位；巢狀 API Key、Authorization、token、secret 與未知欄位不會寫入一般 `settings.json`，且含既有非空 profile 的啟動回歸已通過；round2 獨立複審通過。BUG-031 再補既有設定啟動清理：AI 根層 legacy secret-shaped 欄位與 profile 非 allowlist／未知 provider 會從一般設定檔移除，合法 profile、非敏感未知 AI 根層欄位與獨立 secrets 保留；不把歷史明文自動匯入 secrets。外部 API 與跨平台發布仍另行追蹤。
- BUG-027 已修正：依 Anthropic 2026-09-14 官方相容性文件，Claude Opus 4.7 之後會拒絕非預設 `temperature`／`top_p`／`top_k`；adapter 已統一省略這些取樣參數，且 round2 獨立複審與完整回歸通過。
- BUG-028 已完成：Anthropic `/v1/models` 依官方 `has_more`／`last_id`／`after_id` 契約讀取所有頁面，保留 opaque cursor 原值，避免後頁模型被連線測試誤判不可用；異常游標與 100 頁安全上限已有 deterministic 覆蓋，round2 獨立複審與完整回歸通過。
- BUG-030 已修正並完成 Ollama 本機單模型重驗：`llama3.2:1b` 的 raw response 曾回傳合法但未包裝 `cues` 的 cue object，optimizer 現在只對此 Ollama 結構偏差進行一次 repair，仍強制執行 cue contract；2026-09-15 artifact 已驗證 Ollama 0.34.0 的 capability、native single-cue 與 optimizer product path 通過（`cue-object`→`cues-array`、0 retries）。
- FR-021-032 Ollama loopback API product path 已完成開發驗證與 round4 獨立複審：`2026-09-15-ollama-product-live-recheck-5.json` 實際完成 2 cue AI translation、session、2 筆接受、undo／redo 各 2 筆、雙語校閱保存；時間碼未變且原始 SRT 保存前後 SHA-256 相同。探針現於啟動前拒絕遠端 URL／既有 evidence，使用 exclusive evidence create、最小 child env，並以暫存資料與 `127.0.0.1` 執行；`systemNetworkDisabled=false`，所以不宣稱真正斷網完成，FR-021 整體仍未結案。
- 2026-09-16 packaged renderer smoke 已在隔離 userData 的 0.51.0 macOS arm64 目錄版通過：`2026-09-16-macos-renderer-smoke-fr-021.json` 記錄首頁／Electron bridge／設定、Breeze 首次選擇取消、手動 SRT 任務、校閱 AI 資產與 8 個 provider ID；另以 `2026-09-16-ollama-ui-live-final-2.json` 完成 Ollama loopback packaged 校閱頁 live UI 流程，兩段字幕設定英文、取得 2 筆建議、全部接受、undo／redo、保存 `reviewed.srt` 且時間碼未變。
- 上述 Ollama UI artifact 僅記錄 `127.0.0.1` local endpoint、無 API Key、`systemNetworkDisabled=false`；fixture 是 UI chain 用的中英混合短句，不代表長中文模型翻譯品質。純中文 `llama3.2:1b` 輸出不穩定、`llama3.2:3b` 重播曾逾時的失敗證據均保留；strict language validation 未放寬。
- packaged renderer／Ollama UI 的 round1 獨立審查均通過限定範圍、無阻擋問題；仍不代表真正斷網、LM Studio、Windows／乾淨安裝或 FR-021 整體完成。
- REL-047 已從既有 0.51.0 macOS arm64 DMG 唯讀掛載、ZIP 隔離解壓後各自啟動 packaged app；兩條路徑均通過 renderer／手動字幕／trim／AI review smoke，DMG 已卸載、ZIP 暫存已清理。這不代表 Applications／乾淨帳號／Gatekeeper／Developer ID 公證或公開 Release 驗收。
- BUG-WHISPER-METAL-139 已補 macOS arm64 核心 child-process 整合 fixture：受控 runner 首次以 Metal exit 139 留下 partial SRT／JSON，server 觸發 `--no-gpu` CPU retry，清理 partial outputs 後完成 `ready-review`；真實 bundled runtime、長音訊、取消中的 retry 與跨平台實機仍待驗收。
- 2026-09-17 釐清 bundled `whisper-cli` 的 Metal 139 執行邊界：同一 bundled CLI／Tiny、FFmpeg 正規化的 1 秒靜音 WAV 與產品 flags，在 default sandbox direct replay 會 exit 139 且無 SRT／JSON；改以升級權限執行則 Metal exit 0 並產生 SRT／JSON，故 sandbox 139 不可當成產品 runtime failure。CPU JSON 仍只有 offsets／timestamps／tokens，沒有 segment-level confidence／no-speech，故品質頁仍以 rule-score fallback 為準。原始對照證據：`docs/project-management/evidence/2026-09-17-whisper-bundled-runtime-recheck.json`；權限邊界證據：`docs/project-management/evidence/2026-09-17-whisper-metal-permission-boundary.json`。
- 2026-09-17 新增非測試模式產品 server 的 bundled Whisper.cpp acceptance probe；以本機生成 1 秒靜音 WAV 完成 `ready-review`，`asrEngine=whisper.cpp`、`whisperDevice=metal`，產生 draft／SRT／JSON 且清理暫存 WAV。此輪 server 執行未觸發 Metal exit 139，因此 `fallbackObserved=false`；probe 只有在當次觀察到 Metal crash 時才會把 CPU fallback 作為通過條件，不宣稱真實 server fallback 已完成。證據：`docs/project-management/evidence/2026-09-17-whisper-real-server-fallback.json`。
- 2026-09-17 另以隔離 deterministic wrapper 在 `NODE_ENV=production`、test runner 關閉的 server 中完成 child-process fallback 控制流：首次受控 exit 139／partial SRT／JSON 後，server 清理並以 `--no-gpu` 完成 CPU 任務至 `ready-review`，logs／metrics／輸出／暫存清理均通過。證據：`docs/project-management/evidence/2026-09-17-whisper-production-fallback.json`；此證據明確不是 bundled `whisper-cli` 實機 fallback。
- 2026-09-17 權限邊界重播後，升級權限下的非測試模式產品 server bundled path 仍以 Metal 完成 `ready-review`、產生 SRT／JSON 並清理暫存 WAV，`fallbackObserved=false`；因此目前沒有同一次真實 bundled server run 的 Metal crash→CPU fallback 證據，不修改既有 fallback 策略。證據：`docs/project-management/evidence/2026-09-17-whisper-metal-permission-boundary.json`。
- 2026-09-18 已修正 SIGSEGV signal fallback 可觀測性：Node child 的非零整數 exit 與 termination signal 現有明確契約，server logs 分別記錄 `Metal exit <code>`／`Metal signal <name>`，真實 probe 同時辨識兩者。核心整合的 exit 139 與真實自我 `SIGSEGV` fixture 均清理 partial outputs、完成 CPU retry 至 `ready-review`；production controlled replay 通過，bundled replay 仍正常走 Metal、`fallbackObserved=false`。證據：`docs/project-management/evidence/2026-09-18-whisper-signal-aware-fallback.json`。
- 2026-09-18 已補 CPU fallback 再失敗的 child-process integration：deterministic runner 首次 Metal exit 139、第二次 `--no-gpu` exit 7 並寫入 partial SRT／JSON；server 現會終止為 `failed`、只保留兩次 invocation、保存 CPU exit reason，並刪除固定 partial outputs／quality metadata，不產生 draft。修正前／後證據：`docs/project-management/evidence/2026-09-18-whisper-cpu-retry-failure.json`。
- 2026-09-18 補驗 Metal→CPU retry 中的取消：deterministic CPU child 寫出 partial SRT／JSON 並安裝 SIGTERM handler 後，由 API 取消；三次核心重播均先見 `running/cancelling`、child close 後 `cancelled`，僅 `metal`／`cpu` 兩次 invocation，暫存音訊、partial outputs／quality metadata 已清理，非 ASR 工作檔保留。證據：`docs/project-management/evidence/2026-09-18-whisper-retry-cancellation.json`；真實 bundled runtime 與不可外部插入的同一 callback 內窗口仍未驗收。
- 2026-09-18 已補 production-mode hybrid acceptance：隔離 wrapper 僅控制首次 Metal child exit 139 並留下 partial SRT／JSON；同一產品 server 清理後只 retry 一次 `--no-gpu`，CPU child 實際執行 bundled `whisper-cli`／Tiny，完成 `ready-review` 且無 stale partial／暫存 WAV。最新證據：`docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback-replay.json`，包含 binary／model SHA-256、精確兩次 invocation、CPU exit 0 與可重播命令；原始不含重播欄位的 evidence 保留未覆寫。本輪沒有觀察 bundled Metal 自身崩潰，不可當作同次真實 Metal crash→CPU fallback 實機驗收。
- 2026-09-18 再補 hybrid bundled CPU 執行中的取消：60 秒本機合成靜音 WAV 讓真實 bundled CPU child spawn 後由 API 取消；任務先為 `running/cancelling`，wrapper 轉送 SIGTERM，真實 CPU child 以 `SIGTERM` close，任務終為 `cancelled`。固定 SRT／JSON／quality 哨兵由 probe 注入後已清理，draft／暫存 WAV 不存在、edit plan 保留，精確 `metal`／`cpu` 兩次 invocation。round1 審查指出 probe 失敗時只停 server 無法確認子孫程序；現改用隔離 process group 有界終止、確認整組消失後才清暫存。round2 獨立複審通過。最新正常 evidence：`docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-final.json`；API 不可用故障注入 evidence：`docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-api-loss-final.json`（預期 probe exit 1，但 cleanup `expectedFaultSafelyHandled=true`）。先前 evidence 保留。此證據不代表 bundled Metal 自身崩潰、CLI 真實 partial 輸出或跨平台取消已驗收。
- 2026-09-21 以同一 production server probe、同一 bundled `whisper-cli`／Tiny 與 1 秒合成 WAV 重播真實 bundled Metal 路徑：預設 sandbox 在 server ready 前 exit 0，未建立任務；受控本機權限則任務完成 `ready-review`、`whisperDevice=metal`、`fallbackObserved=false`，輸出與暫存清理通過。兩份 evidence 明確只證明執行權限邊界與正常 Metal 路徑，仍沒有同一次真實 bundled Metal crash→CPU fallback 證據：`docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-default.json`、`docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-escalated.json`。
- 2026-09-21 已補強 bundled production probe 的啟動診斷：v2 evidence 記錄 server PID、ready phase、exit code／signal 及固定長度、遮罩後的 stdout／stderr 尾端；round1 發現後已補 quoted／含空白 credential、`/tmp/` 遮罩與 probe token guard／負向測試。預設 sandbox round2 重播可見 `listen EPERM`，受控權限正常 Metal replay 仍通過且 probe token 未外洩。round2 evidence：`docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-round2-default.json`、`docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-round2-escalated.json`；round1 evidence 保留作為修正前對照。
- 2026-09-21 已以需求方本機 `/Users/nycu/Downloads/20260909.mp4` 完成 bundled Whisper Small 長音訊 runtime／輸出基線：影片約 5,416.35 秒，受控本機 replay exit 0、產生非空 SRT／JSON，2,509 segments，暫存已清理；證據為 `docs/project-management/evidence/2026-09-21-whisper-long-media-small-redacted.json`。本輪只驗證執行與輸出完整性，不宣稱中文辨識品質、confidence／no-speech metadata、長音訊效能門檻或真實 Metal crash→CPU fallback；evidence v2 不保存字幕文字，原始影片／SRT 未修改。
- 2026-09-21 再補長音訊來源 SRT 完整性證據：`docs/project-management/evidence/2026-09-21-whisper-long-media-small-srt-integrity.json` 使用 evidence v3 保存來源 `20260909.mp4.edited.srt` 的 before／after SHA-256，兩者均為 `4d5f5a53bb4eea7f5de5b428caefb38871771655166b12fccc613f3600f16482`，`sourceSrtHashChecked=true`、`originalSrtModified=false`。這仍只證明 probe 前後來源檔未變更，不代表字幕內容品質或 Whisper 與來源 SRT 的正確性比對。
- 上述來源 SRT hash 補強已由獨立 round1 審查有條件通過：`docs/project-management/reviews/2026-09-21-whisper-long-media-srt-integrity-round1.md`；文件結案 gate 已完成。尚未做 hash mismatch／來源檔消失 fault injection，也未保存同一 probe 的影片 before／after hash，兩項限制維持揭露。
- 需求方已告知 LM Studio 刪除，本輪不執行其實機驗收；真正斷網、LM Studio 例外以外的 FR-021 完整條件與跨平台實機仍未完成。
- FR-021-031 範圍決策：LM Studio 實機驗收因本機服務已刪除而取消，不移除 `lm-studio` provider 或既有 deterministic tests；後續只在取得明確網路隔離方法與授權後處理 Ollama 真正斷網／完整人工流程，不把此例外誤標為 FR-021 通過。
- 已補 deterministic provider／核心 API／review UI 測試與治理文件；不使用真實 Claude API Key，外部 endpoint、模型品質、計費與跨平台封裝仍待另行驗收。
- 已建立 macOS arm64 本機隔離 directory 測試候選：`../dist/mac-arm64/`；受控權限 packaged renderer smoke 通過首頁、設定、Breeze 首次選擇 modal、manual SRT 任務完成、trim／AI review 資產與 Anthropic provider marker。候選為 ad-hoc／未公證，未使用真實 Anthropic API Key。
- 已建立 macOS arm64 DMG／ZIP 測試包：`../dist/test-build-0.51.0-macos-88da220/`；`hdiutil verify`、唯讀掛載內容、`unzip -t`、ad-hoc deep codesign、renderer smoke、blockmap／`latest-mac.yml` SHA-512／size 與 SHA-256 均通過，仍未公證或完成乾淨安裝驗收。
- 已建立 Windows x64 cross-build directory 測試候選：`../dist/win-unpacked/`；runtime／PE／SHA-256／Anthropic marker 靜態核對通過，但目前 macOS 主機沒有 Wine，尚未做 Windows renderer、安裝／解除安裝或實機轉錄 smoke，候選不代表 Windows 實機驗收。
- 已建立 Windows x64 unsigned Setup／Portable 測試包：`../dist/test-build-0.51.0-91eca2b/`；Setup／Portable／blockmap／`latest.yml` 與 SHA-256／SHA-512 metadata 已核對，仍未在 Windows 實機安裝或驗證 Authenticode，僅供隔離測試。
- `.github/workflows/windows-preview.yml` 已對齊 0.51.0 並由 branch／tag push 觸發；既有 run `35700305138`、`35700315448`、`35714599428` 均在 `test-breeze-asr.mjs` 的 Breeze 效能提示更新函式 assertion 失敗，不能視為 Windows 實機驗收。BUG-032 的 CRLF 修正已在本機完整回歸通過，需由後續 branch push 重跑確認；Windows scope 仍暫緩。
- 0.51.0 已建立 tag 與 GitHub Release，公開 Latest 已更新為 `v0.51.0`；本機與遠端資產驗證不代表真實 Anthropic／Breeze／Whisper 品質、長音訊效能、Windows 或乾淨安裝驗收。
- 2026-09-22 release-readiness audit 已核對既有 macOS／Windows 0.51.0 測試候選：runtime manifest、checksum、macOS ZIP／DMG 容器、latest metadata、macOS ad-hoc codesign 與 packaged version 通過；Windows unpacked PE32+／version 與 metadata 通過。候選 provenance 為 mac `88da220`、Windows `91eca2b`，目前 HEAD 為 `17df978` 且工作樹仍有 111 個變更路徑，因此候選不可代表目前工作樹、不可發布。證據：`docs/project-management/evidence/2026-09-22-release-readiness-audit.json`。Windows 真機／7z archive test、macOS 乾淨安裝／Gatekeeper／Developer ID／公證、CI artifact 與 GitHub upload 後核對仍未完成。
- 2026-09-22 依需求方要求先完成 macOS 實機驗收（Windows 暫緩）：既有 DMG 在目前 macOS arm64 實機唯讀掛載，複製至隔離 Applications-like 路徑後，deep strict codesign、packaged renderer、Breeze 開啟／取消、手動字幕完成、real trim／post-trim、AI review／glossary／8 provider 與 cleanup 均通過；DMG force detach 與隔離 app 移除通過。`spctl` 因候選為 ad-hoc／未 Developer ID／未公證而拒絕，已按預期記錄，不視為啟動失敗。證據：`docs/project-management/evidence/2026-09-22-macos-real-machine-acceptance-rel-047.json`。本候選來源仍為 `88da220`，落後目前 HEAD，故本結果是候選實機驗收，不解除 release provenance／正式簽章／公證／乾淨帳號與發布 gate。
- 2026-09-22 續補同一候選 ZIP 實機路徑（Windows 暫緩）：ZIP integrity／隔離解壓／Applications-like copy、deep strict codesign、packaged renderer、手動字幕、real trim／post-trim、AI review／glossary／8 provider、xattr 核對與 cleanup 均通過；`com.apple.quarantine` 未存在，`com.apple.provenance` 存在；`spctl` 仍因 ad-hoc／未 Developer ID／未公證而 rejected。證據：`docs/project-management/evidence/2026-09-22-macos-zip-acceptance-rel-047.json`。這仍是舊 provenance 候選的 macOS 實機補驗，不解除目前 HEAD／dirty worktree、正式簽章／公證、乾淨帳號或 release gate。
- 2026-09-22 為解除舊候選 provenance 落後問題，於隔離 clean detached worktree 以目前 HEAD `17df9788abf2cf964d52df10b74f9a8fcd7a45d6` 建立新 macOS arm64 directory candidate：runtime manifest／verify、electron-builder、packaged version 0.51.0、deep strict ad-hoc codesign、runtime hash 與 renderer／manual subtitle／real trim／post-trim／AI review smoke 均通過。證據：`docs/project-management/evidence/2026-09-22-macos-clean-head-candidate.json`；候選位置：`../dist/test-build-0.51.0-head-17df978/`。此候選刻意不包含目前 dirty worktree 未提交變更，且 `spctl` 仍因 ad-hoc／未公證而 rejected，因此仍不可視為公開 Release。
- 2026-09-22 續以同一 clean HEAD `17df9788abf2cf964d52df10b74f9a8fcd7a45d6` 在隔離 detached worktree 封裝 macOS arm64 DMG／ZIP：DMG `hdiutil verify`、ZIP `unzip -t`、gzip blockmap、packaged runtime verify、version 0.51.0、deep strict codesign 與 DMG／ZIP 隔離實機 renderer／手動字幕／real trim／post-trim／AI asset smoke 均通過；兩條路徑 `spctl` exit 3／rejected 屬 ad-hoc／未 Developer ID／未公證預期限制，ZIP 未發現 `com.apple.quarantine`。證據：`docs/project-management/evidence/2026-09-22-macos-clean-head-packaged-acceptance.json`；候選位置：`../dist/test-build-0.51.0-head-17df978-packaged/`。dirty worktree 未提交變更未納入，Windows 依需求方要求暫緩，仍不可視為公開 Release。
- 2026-09-22 另補同一 clean-HEAD candidate 的本機 `latest-mac.yml`：以實體 DMG／ZIP bytes 獨立重算 URL／path／size／SHA-512，兩項 metadata 與 top-level updater path/hash 均一致，並重放 SHA256、DMG `hdiutil verify`、ZIP `unzip -t`。證據：`docs/project-management/evidence/2026-09-22-macos-clean-head-updater-metadata.json`；此 metadata 僅供 local QA，未上傳、未發布，`releaseReady=false` 維持。
- 2026-09-22 已以發布 commit `53956ccdee6e16e4c0413f09312a419613b27da6` 重建 macOS arm64 GitHub release candidate：`npm ci`／npm audit 0 vulnerabilities、完整 `npm run check`、runtime／version／deep strict codesign、DMG／ZIP integrity、`latest-mac.yml` URL／path／size／SHA-512、DMG／ZIP 兩條實機 renderer／字幕／trim／AI smoke 均通過。證據：`docs/project-management/evidence/2026-09-22-github-release-candidate-macos.json`；候選位置：`../dist/release-0.51.0-macos-53956cc/`。本輪 Release scope 僅 macOS arm64，Windows 依需求方要求暫緩；尚未上傳或建立 GitHub Release。

## 0.50.0 Breeze 效能透明化與首次選擇提醒（開發中）

- 開發分支：`codex/0.50-whisper-small-long-cues`（由 `codex/0.50-breeze-hardening` 延伸）；來源基準為公開 `v0.49.1` 的 `main@7829876`。
- `/api/breeze-asr` 將提供固定 `performanceReference`，首頁任務表單在選取 Breeze 時於產品名稱外顯示低資源效能提醒與 Whisper.cpp 回退建議。
- 此提醒只重述需求方提供的單一 MacBook Air M3／8 GB 觀察：1:46 影片約 6 小時（約 `3.4×`）；不代表跨機型保證、真實模型品質或已改善推論速度。
- 0.50.0 尚未建立 tag 或 GitHub Release；公開 Latest 仍為 `v0.49.1`。本機已由 `codex/0.50-whisper-small-long-cues@6beee98` 產生 macOS arm64 隔離測試候選，位置為 `../dist/test-build-6beee98/`，不屬公開發布資產。
- BUG-024 已完成本輪 deterministic 開發切片：Whisper Small 長 cue 保留完整文字，依標點／空白拆分並在正常時間下控制每行最多 20 字元；極短時間 fallback 的第二行可能較長，完整真實模型／長音訊品質仍待外部驗收，且尚未列為公開發布功能。
- BUG-025 已修正乾淨 profile 首次啟動的不必要 Keychain 查詢；最終 packaged renderer 以隔離 userData 通過主視窗、Breeze 首次選擇 modal、上傳／完成與 AI 校閱 smoke。既有真實加密 AI 金鑰跨版本解密、乾淨帳號 Gatekeeper 與公證仍未驗收。

## 0.49.0 Breeze 第一版正式發布

## 0.49.1 Breeze 首次設定流程正式發布

- PR #14 已合併至 `main`，annotated tag `v0.49.1` 指向 merge commit `917ae82886a0dff195009c66ce9438b78675fcc0`；GitHub Release 已公開並標示 Latest，既有 `v0.49.0` 保留為歷史版本。
- 首次選取 Breeze 會立即開啟模型下載／runtime 設定協助；選單不再把 experimental 說明混入產品名稱，文件與 Release notes 仍保留真實 runtime／品質／效能限制。
- 需求方 MacBook Air `Mac15,12`／Apple M3／8 GB／8 cores／macOS `26.5.2` 回報 1:46:00 影片約需 6 小時（約 `3.4×`），列為 0.49.1 發布依據與低資源效能警示，非跨機型驗收。
- tag workflow run `32095872065` 成功；Windows artifact `9309963799`（490,424,761 bytes，digest `sha256:6551957e320b6f299328bc2b13898134814534585854b1c9d9164096419be04a`）已下載重組並通過 ZIP／PE／checksum／`latest.yml` 核對。公開 Release 13 項 asset 的名稱、大小、digest、`/releases/download/v0.49.1/` URL 均已從 GitHub API 反向核對；metadata／blockmap／notes 直接下載 hash 與本機一致，四個主資產 Content-Length 與 API size 一致。
- 公開 Release：<https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.49.1>

- `codex/breeze-first-release` 由最新 `origin/main=05b275f` 建立，保留 0.48.1 已合併的 Windows CI、模型完整性、外部驗收與發布收尾修正；沒有直接發布落後 25 個提交的舊 Breeze 開發分支。
- FR-024 的 Breeze runtime／模型只讀探針與診斷遮罩已移植；`npm run probe:breeze -- --json` 會檢查固定 checkpoint 契約與 `whisper.available_models()` 能力，缺件時非零結束且不下載、不安裝或啟動任務。
- Breeze ASR 25 仍為實驗性選用功能；Whisper.cpp Tiny／Base／Small 維持預設。約 2.88 GiB checkpoint、Python、PyTorch 與 patched Whisper runtime 不納入安裝包。
- Breeze 首次選擇已改為立即開啟模型下載／runtime 設定協助；需求方 MacBook Air `Mac15,12`／Apple M3／8 GB／8 cores／macOS `26.5.2` 回報 1:46:00 影片約需 6 小時（約 `3.4×`），列為發布依據與低資源效能風險，非跨機型驗收。
- 0.49.0 已由 PR #11 合併至 `main`，annotated tag `v0.49.0` 解析至 merge commit `1f50b85c0599ef85c73f05085d70925d4d6b670a`；GitHub Release 保留為歷史版本，共 9 項資產。
- tag workflow run `31661442776` 完整通過，Windows artifact `9166375562` 來源為最終 tag commit；Setup／Portable、renderer、安裝解除、archive、checkpoint 排除與 updater metadata 已通過。公開 Release 的四個主資產、checksum、metadata 與簽章說明已從正式 URL 重新下載並反向核對；round3 獨立發布後審查已通過。
- GitHub CLI 已於 2026-08-13 重新登入 `twyderek`；公開 repo、PR #11、tag 與 Release 已完成。

## 0.48.1 正式發布狀態

- FR-022 已在目前工作樹加入 Whisper `tiny`／`base`／`small` 三模式選擇、模型檔案／manifest SHA 驗證與缺檔錯誤處理。
- FR-023 已加入 Base／Small 首次使用下載確認、固定官方 revision、userData 模型快取、進度與大小／SHA-256 驗證；下載失敗可依官方 URL 手動匯入。
- SYNC-024 已從 GitHub 核對 Windows Ollama 修正（遠端 `4d0bee6` 與本地 HEAD `170e08e` 完全一致），並同步最新 Azure OpenAI request parameter 修正 `baed6d7` 至目前工作樹與本機測試包。
- REL-025／REL-028 已收斂成 `v0.48.1` 正式交付：PR #8 已合併至 `main`，Release notes 已建立，公開封裝只內建 Tiny，Base／Small 使用首次下載；下載取消會停止背景請求並清除暫存檔。Electron 已升級至 43.3.0、electron-builder 升級至 26.15.7，完整 `npm audit` 為 0；兩平台封裝、四項資產 SHA-256、updater SHA-512、partial-body 取消與 active DELETE API 已通過核對。
- FR-024 的 Breeze ASR 25 實驗性流程已由後續 v0.49.0 正式發布；0.48.1 的公開資產與 tag 保留為歷史版本。
- 三模式 deterministic mock runner、模型下載 fixture 與核心 API 回歸已通過；Base／Small 中文準確率、速度、記憶體、Windows 10／11 實機安裝後驗收與真實 provider endpoint 仍是公開揭露的外部風險。
- `v0.48.1` Release 已公開，包含 macOS arm64 DMG／ZIP、Windows Setup／Portable、兩平台 updater metadata、SHA-256 與 Windows 未簽章狀態。

## 已完成成果

- Windows 10／11 x64：NSIS Setup 與 Portable 已建置並發布。
- Apple Silicon macOS 12+：DMG 與 ZIP 已發布。
- GitHub Release：<https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.49.1>
- 線上完整操作說明：<https://offline-subtitle-factory-0451-guide.derek62101.chatgpt.site>
- Windows 安裝包內含 `resources/docs/0.45.2/USER-GUIDE.html`、圖文資產與三段操作動畫。
- 0.45.1 已修正 Azure OpenAI GPT-5 的 `max_completion_tokens` 與 `temperature` 相容性，並加入可收合 AI 優化面板。

## 0.45.2 已發布成果

- 工作樹已完成多語言 LLM 字幕優化：12 個常用目標語言、自訂 BCP 47 標籤、前後端標準化、非法 API 值拒絕、舊設定回退與目標語言 Prompt。
- cue ID、數量、順序與時間碼保護已補強；交換順序的模型回應會被拒絕。
- 0.45.2 工作樹已補齊 Groq／Google Gemini 供應商識別、請求契約、profile／金鑰隔離、設定介面切換與未保存欄位連線防護；完整自動測試、本機瀏覽器實測及獨立審查通過。
- 自動測試、雙平台 CI／封裝與獨立審查已通過；v0.45.2 已公開發布。
- 目前工作樹新增語系選項調整：設定與 AI 輸出選單移除簡體中文；既有 `zh-CN` 介面設定載入時回退繁體中文，待本輪測試與獨立審查完成後納入下一個修正版。

## 歷史 0.45.2 發布資產狀態

- v0.45.2 為歷史公開 Release；目前公開版本已更新為 v0.49.0。
- v0.45.2 Windows 發布資產來自 CI run `29886823270`：`offline-subtitle-factory-setup-0.45.2.exe`、`offline-subtitle-factory-portable-0.45.2.exe`、`latest.yml` 與 SHA 已核對。
- v0.45.2 macOS arm64 發布資產為 ASCII DMG／ZIP；`latest-mac.yml` URL／path／size 與實際資產一致，DMG `hdiutil verify`、ZIP `unzip -t` 通過。

## 已知風險與未覆蓋項目

- Windows v0.45.2 候選資產未使用 Authenticode 簽章，可能顯示 Unknown Publisher／SmartScreen；使用者須核對 SHA-256。
- macOS v0.45.2 候選資產為 ad-hoc 簽章，未使用 Apple Developer ID 簽章或公證。
- Windows 尚缺乾淨實機的安裝、解除安裝、捷徑與離線手冊動畫播放 smoke test。
- 0.48.1 候選已將 Electron 33.4.11／electron-builder 25.1.8 升至 Electron 43.3.0／electron-builder 26.15.7；2026-08-10 完整 `npm audit --json` 為 0，舊 runtime／build-only advisory 已解除。
- 依 2026-07-30 工作樹盤點，現行 Windows workflow 已使用 `actions/setup-node@v4`、Node 22；先前 Node 20 deprecation 描述尚待歷史 CI 證據核對，不視為目前 workflow 已證實問題。
- Electron major 升級已通過完整自動回歸、macOS arm64 目錄版打包與 packaged renderer smoke、Windows x64 目錄版／Setup／Portable 建置；Windows renderer、乾淨安裝與 macOS DMG／ZIP 安裝後實機仍未由本輪證據覆蓋。
- 真實 LLM 是否完全遵循所選語言仍受模型能力影響，AI 建議必須逐段確認；多語言版本已完成 macOS 候選重建，但尚未完成跨平台乾淨實機驗證。
- Groq／Gemini 目前僅以 contract mock 與本機 UI 驗證，尚未用真實供應商金鑰做外部 smoke test。
- BUG-012：OpenAI-compatible 搭配舊 Gemini URL／模型的安全遷移已由 `server.mjs` 與 `scripts/test-core.mjs` 覆蓋，包含設定檔保存後的正規化值；既有使用者設定檔的跨平台啟動／重啟實機升級仍待驗收，不提前宣稱完整關閉。
- BUG-WHISPER-METAL-139：Metal 明確非零 exit／termination signal→CPU fallback 的觸發策略已抽出並由平台／架構／forceCpu／退出碼／signal 矩陣及 macOS arm64 child-process 整合 fixture deterministic 覆蓋；CPU retry 再失敗已驗證 failed 終止與 partial 清理，CPU child 就緒後的取消也已驗證 close 後 cancelled 與清理。先前 default sandbox direct replay 的 Metal exit 139 已由升級權限 direct replay 證明是執行邊界差異，產品 server 的 production-mode bundled path 亦完成正常 Metal smoke，另以不冒充 bundled runtime 的 deterministic wrapper 完成 production-mode fallback 控制流驗收；真實 bundled server crash→CPU fallback／取消、同一 callback 內窗口、長音訊與跨平台實機仍待驗收。
- FR-023：Windows userData 模型快取與固定來源下載已完成本機 API／fixture／封裝驗證；尚缺 Windows 實機的安裝權限、外網下載中斷／重試與中文口說品質驗收。
- SYNC-024：GitHub Windows 修正已確認不需重複套用；Azure OpenAI body 清理／capability token 修正已通過 provider contract 與完整回歸，Windows Ollama／Azure 實機仍待驗收。
- FR-024：deterministic 模型契約、API、CLI 參數、前端選擇器與完整回歸已通過；尚未下載真實 3 GB checkpoint、安裝官方 Python／PyTorch／patched Whisper runtime，亦未做兩平台真實音訊品質、效能、取消或長音訊驗收。

## 有效常設授權

- `AUTH-2026-07-23-01`：需求提出者／產品負責人已統一同意 Windows Authenticode 未簽章、macOS 未經 Apple Developer ID 簽章／公證狀態下對外發布。每次發布仍須引用授權 ID、揭露風險並完成測試、審查、SHA 與資產核對；未實機測試及其他風險不在此授權範圍。詳見 `09-STANDING-AUTHORIZATIONS.md`。

## 0.48.0 正式發布狀態

1. `FR-021`：新增 Ollama／LM Studio 本機 provider、固定常見端點探測與模型清單。
2. 只有精確 loopback hostname 才免 API Key 與雲端資料傳送同意；遠端端點維持既有安全門檻。
3. 本機 provider 使用較小批次，沿用 cue ID／數量／順序／時間碼保護與人工接受流程。
4. 提供本機／雲端隱私標示及模型 JSON、繁體中文、context 能力檢查；不自動下載模型。
5. 自動回歸已分別覆蓋 Ollama 的模型探索／能力／redirect 防護，以及 LM Studio 的完整優化、重試、取消、checkpoint／續跑；已修正「已有 checkpoint 的取消任務被誤標不可續跑」問題；macOS arm64 未簽章目錄版已完成 runtime、打包與 Electron renderer 預封裝驗證。
6. macOS arm64 目錄版、DMG、ZIP 與 Windows x64 未簽章目錄版／Setup／Portable 均已產出並完成 runtime／資產驗證；Windows renderer 仍待 Windows 實機啟動，macOS DMG／ZIP 安裝後仍待驗收。
7. Ollama 已完成 `llama3.2:1b` 真實模型的模型列表、能力檢查與字幕優化；另以 `llama3.2:3b` 驗證日文翻譯與模型解說文字清理。小模型輸出品質仍需逐段人工確認。
8. GitHub `v0.48.0` 已於 2026-07-30T03:58:52Z 正式公開並標示 Latest，tag 解析至 `4cdb0177d84693a334fac79b96c596e1b416456f`。Release 共 9 項資產：macOS DMG／ZIP、Windows Setup／Portable、`latest.yml`／`latest-mac.yml`、兩平台 SHA 與 Windows 未簽章說明；名稱、大小、GitHub digest 與正式下載 URL 均已反向核對。
9. 2026-07-30 的受控 probe 曾取得 Ollama 0.32.5、2 個模型，但 single-cue 未符合 strict JSON／cue contract；此為歷史失敗證據。2026-09-15 已以 Ollama 0.34.0／`llama3.2:1b` 重驗並完成 optimizer product path；LM Studio 實機驗收依需求方決策取消，仍因真正斷網與完整人工流程未完成，不把 `FR-021` 整體標為完成。

## 本機封裝儲存空間整理（2026-07-30）

- 已移除 `dist/` 中 0.21–0.47.1 的歷史 Release 複本、Google Drive 分片、舊 Windows/macOS 封裝與舊建置快取；這些版本的公開／歷史證據仍保留於 GitHub Release、tag 與專案治理文件。
- 保留 0.48.0 正式候選的 macOS DMG／ZIP、Windows Setup／Portable、blockmap、`latest.yml`／`latest-mac.yml`、SHA、簽章狀態，以及 `mac-arm64`／`win-unpacked` 驗證目錄。
- `dist/` 由約 10 GB 降至約 1.9 GB；刪除命令的目標容量合計輸出約 8.44 GiB。清理前逐檔輸出未保存成獨立證據，因此該數值只能作為操作摘要，不能由目前檔案重新計算。被刪除的封裝不在垃圾桶內，若需重取須由 GitHub Release 下載或重新建置。

## 0.46.0 已公開發布

0.46.0 已於 2026-07-23 建立公開 Release：https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.46.0。macOS arm64 DMG／ZIP 與 SHA-256 已上傳並核對 GitHub digest；Windows x64 由 CI run `29978500348` 完成真實 FFmpeg、EXE archive、手冊檔與 SHA-256 驗證，產出 unsigned artifact（保留 14 天），但未附 Authenticode 簽章。未核對一致性的 macOS updater metadata／blockmap 未上傳。

## 0.47.1 修正版已公開發布

- 已加入品質風險評估與校閱頁篩選：低 confidence／高 no-speech、過長、閱讀速度過快、重複文字與疑似專有名詞。
- 引擎品質指標缺失時只保存 `rule-score` 來源與規則結果，不偽造 confidence；已接入 Whisper.cpp JSON quality metadata 的容錯解析與 cue 對應通道，但本機內建 runtime smoke 發生 exit 139，尚未完成跨平台實際欄位映射與實機驗收。
- 0.47 rule-score fallback、quality metadata 安全回落、stale metadata 防護與 strict cue ID／時間／數量驗證已完成條件複審。
- GitHub `v0.47.0` Release 已保留為歷史發布，target commit 為 `7946f7f`；本版未移動或覆蓋該 tag。
- GitHub `v0.47.1` 已公開發布，annotated tag `v0.47.1` 解析至修正版 commit `0bd3b53`；Release 已包含 macOS arm64 DMG／ZIP、Windows Setup／Portable、`latest.yml`、Windows SHA-256 與簽章狀態說明。
- 发布后 GitHub API 已核对 7 项公开资产的名称、大小、SHA-256 digest 与直接下载 URL；本地 macOS DMG／ZIP 与 Windows artifact 内容及清单 SHA 已核对一致。
- 0.47.0 的 rule-score fallback、quality metadata 安全回落、stale metadata 防護與 strict cue ID／時間／數量驗證延續至本版；Metal exit 139、未簽章／未公證與跨平台實機缺口仍須如實揭露。
- 发布后仍须持续揭露 Windows 未 Authenticode、macOS 未 Developer ID／公证、Metal exit 139、Electron 与跨平台实机缺口；本版发布独立审查结果记录于工作纪錄与 reviews。
