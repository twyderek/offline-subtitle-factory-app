# 獨立審查報告：production-mode Whisper 受控 Metal 失敗與 bundled CPU retry 整合（BUG-WHISPER-METAL-139）

- 審查對象 commit／版本：`codex/0.51-anthropic-claude`，`HEAD=17df9788abf2cf964d52df10b74f9a8fcd7a45d6`，0.51.0 開發中；本輪腳本與 evidence 尚在 dirty worktree，故 commit 不是完整快照。審查時 SHA-256：`scripts/verify-whisper-production-fallback.mjs` 為 `15e1aaa8d09c342071714e907c44038bcf50a97ee5eb2cf255d2f60619886145`，`package.json` 為 `8ad8ad0fdd7cb217b250fe313abf7487a429bd7e065b593a3364a1209ee2a526`，本輪 evidence 為 `f302330535e8bf3cae1fb9fee26b779d2cda90a1ef3d7070fad9412b59e882fd`（2026-09-18 12:18:59 +0800）。
- 對應 08-CHANGE-LOG 條目：2026-09-18 — production-mode Whisper 受控 Metal 失敗與 bundled CPU retry 整合（BUG-WHISPER-METAL-139），`docs/project-management/08-CHANGE-LOG.md:3-22`。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-09-18 12:16 +0800；本審查使用獨立任務上下文，未沿用主要開發代理對話記憶，依需求方指定範圍、`npm run project:preflight -- --type=debug` 輸出、其路由文件及本輪實際程式／evidence 重新核對。

## 1. 需求完整性

- 判定：部分通過。
- 證據：`docs/project-management/08-CHANGE-LOG.md:11` 要求 production server 中首次受控 Metal exit 139／partial outputs、單次 `--no-gpu` 真實 bundled CPU retry、完成狀態／清理，且 evidence 記錄 binary／model hash 與「可重播命令」。`scripts/verify-whisper-production-fallback.mjs:165-201,246-325` 與 `package.json:21-22` 實現模式及 alias；`docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback.json:11-21,37-70` 記錄受控 Metal、真實 CPU、兩次 invocation、CPU exit 0、輸出與清理，binary／Tiny SHA-256 也與 2026-09-18 12:16 +0800 `shasum -a 256 tools/whisper-cpp/whisper-cli tools/whisper-models/ggml-tiny.bin` 一致。惟該 JSON 全檔 `:1-78` 沒有執行命令或其 replay 欄位；命令另見 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:21`，尚未滿足 08 條目對 evidence 本身的可重播性敘述。
- 範圍核對：`docs/project-management/03-FUNCTIONAL-DESIGN.md:57`、`00-CURRENT-STATUS.md:31` 及 JSON `:20-21` 都明示 Metal 失敗由 wrapper 注入，未將本輪誤標為 bundled Metal 自身 crash→CPU 實機驗收。

## 2. 邏輯正確性

- 判定：通過（本輪限定範圍）。
- 證據：hybrid wrapper 在非 `--no-gpu` 分支寫 partial SRT／JSON 與 marker 並 exit 139，在 CPU 分支先檢查固定輸出是否殘留，再以 `spawn(bundledRuntimePath, args, { shell: false })` 轉交原參數、記錄 child exit／signal（`scripts/verify-whisper-production-fallback.mjs:175-201`）；產品 server 原控制流以 `buildWhisperCppArgs` 建參數，在 macOS arm64 首次 Metal failure 清除 partial、記錄 fallback 並以 `forceCpu=true` 遞迴一次（`server.mjs:2061-2065,2087-2105,2166-2183`）。探針要求狀態為 `completed/ready-review`、CPU metrics、logs marker、輸出／清理、精確 `['metal','cpu']` 與 child exit 0（`scripts/verify-whisper-production-fallback.mjs:313-325`）。獨立重播 `/private/tmp/osf-review-20260918-hybrid-round1-b.json:37-77` 符合以上斷言。

## 3. 邊界情況

- 判定：通過（已測邊界與明示範圍）。
- 證據：2026-09-18 約 12:18 +0800，以既有 `/private/tmp/osf-review-20260918-hybrid-round1-b.json` 再呼叫 `node scripts/verify-whisper-production-fallback.mjs --bundled-cpu <同一路徑>`，exit 1、在啟動前拒絕覆寫（`scripts/verify-whisper-production-fallback.mjs:12-18`）；加 `--bad` 的呼叫 exit 1 且未建立 `/private/tmp/osf-review-20260918-invalid-round1-a.json`（`:13`）；獨立 hybrid 成功結果 `invocations=['metal','cpu']`、`stalePartialArtifacts=[]`、`whisperInputCleaned=true`（`/private/tmp/osf-review-20260918-hybrid-round1-b.json:53-69`）。預設 sandbox 的首次重播 `/private/tmp/osf-review-20260918-hybrid-round1-a.json` 於 2026-09-18 12:16:53 +0800 在 server ready 前 exit 0、probe exit 1；同機受控權限重播通過，故這個失敗僅作執行權限邊界記錄，不當成產品 Metal crash。

## 4. 程式碼品質

- 判定：部分通過；無已證實的產品控制流阻擋缺陷。
- 證據：模式解析與 evidence schema 集中於 `scripts/verify-whisper-production-fallback.mjs:11-16,123-145`，wrapper 使用 `shell:false`，evidence 以 `flag:'wx'` 建立並於 `finally` 清理專用暫存目錄（`:191,335-347`），舊模式可獨立重播。診斷限制是 server 以 `stdio:['ignore','ignore','ignore']` 啟動（`:246-250`），所以本次預設 sandbox server 在 ready 前離開時，probe 只回報「exit code 0」（`:80-93`；`/private/tmp/osf-review-20260918-hybrid-round1-a.json`），無法從 artifact 判斷底層原因；建議在失敗 evidence 中保存有界、去敏的 server stderr 摘要，避免日後權限或 runtime 啟動故障難以定位。

## 5. 測試覆蓋

- 判定：通過（本輪 acceptance 範圍）。
- 證據：2026-09-18 12:17:11–12:17:17 +0800，受控權限 `npm run acceptance:whisper:hybrid-fallback -- /private/tmp/osf-review-20260918-hybrid-round1-b.json` exit 0／`status=pass`；12:17:42–12:17:44 +0800，受控權限 `npm run acceptance:whisper:production-fallback -- /private/tmp/osf-review-20260918-controlled-round1-a.json` exit 0／`status=pass`，其 JSON `:11-21` 仍標記 deterministic CPU、`bundledRuntimeUsed=false`。2026-09-18 約 12:17–12:18 +0800，`node --check scripts/verify-whisper-production-fallback.mjs`、`git diff --check`、受控權限 `npm run check` 均 exit 0；後者包含 docs check、Whisper fallback policy、核心 API 與其餘專案回歸。`package.json:30-31` 的預設 `npm test`／`npm run check` 不含 hybrid 實機探針，`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:22` 已如實揭露須另行手動重播。

## 6. 實際運行結果

- 判定：通過（受控權限、macOS arm64、生成 1 秒靜音 WAV）。
- 證據：獨立 hybrid 重播於 `/private/tmp/osf-review-20260918-hybrid-round1-b.json:1-77` 記錄 Node v22.22.3、`NODE_ENV=production`、`testRunnersDisabled=true`、`completed/ready-review`、`whisperDevice=cpu`、Metal exit／CPU fallback marker、兩次 invocation、bundled CPU `exitCode=0`、draft／SRT／JSON 存在、stale partial 與暫存 WAV 不存在。此重播 runtime／Tiny SHA-256 分別為 `6167fe4817a85cb011cbb58abf53f80a9e9488be26b99348e9ff6f655edc7a08`、`be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21`，與本輪專案 evidence `docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback.json:16-21` 相同；這證實受控 Metal failure 後真實 bundled CPU 能完成同次 server 任務，未觀察 bundled Metal 自身失敗。

## 綜合判定

- 結論：有條件通過。
- 完整單句綜合結論：本輪「2026-09-18 — production-mode Whisper 受控 Metal 失敗與 bundled CPU retry 整合（BUG-WHISPER-METAL-139）」round1 獨立審查有條件通過：macOS arm64 受控權限下的獨立重播證實 production server 在 wrapper 注入 Metal exit 139／partial outputs 後，只進行一次 `--no-gpu` retry 並由真實 bundled `whisper-cli`／Tiny 完成 `ready-review`、輸出及清理，舊模式與完整回歸也通過，但本輪 JSON evidence 尚缺 08 條目明定的可重播命令，補齊前不得稱需求證據完整，且本結論不代表 bundled Metal 自身 crash→CPU、長音訊、中文品質、真實 CPU child 取消、Windows、乾淨安裝或發布已驗收。
- 阻擋問題（若有）：無產品執行阻擋；證據結案條件為本輪 JSON 缺少可重播命令（`docs/project-management/08-CHANGE-LOG.md:11` 對 `docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback.json:1-78`）。
- 剩餘風險：首次 Metal 失敗是 wrapper 控制，CPU 使用真實 bundled runtime；短靜音不驗證中文語音品質／長音訊，未測真實 bundled CPU 取消、Windows、乾淨安裝或發布；預設 sandbox 的 server ready 前失敗與受控權限成功有環境差異，現行 probe 對前者缺少 stderr 診斷。
- 給主要開發代理的具體修正要求（若有）：使探針在新檔名 evidence 中輸出可直接重播的 npm 命令及 macOS arm64／受控權限前提，核對後更新 00／03／06／07／08 的引用與結案狀態；另建議為 server 啟動失敗保存有界、去敏的診斷摘要，並視上述證據變動範圍安排 round2 複審，不得改寫本報告。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案；測試 evidence 僅寫入 `/private/tmp` 新檔名。
- 若上述聲明不實，本報告無效。
