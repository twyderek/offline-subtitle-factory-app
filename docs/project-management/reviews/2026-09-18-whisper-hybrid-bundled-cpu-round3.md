# 獨立審查報告：production-mode Whisper 受控 Metal 失敗與 bundled CPU retry 整合（BUG-WHISPER-METAL-139）

- 審查對象 commit／版本：`codex/0.51-anthropic-claude`、`HEAD=17df9788abf2cf964d52df10b74f9a8fcd7a45d6`、0.51.0 開發工作樹；2026-09-18 13:46 +0800 的 `scripts/verify-whisper-production-fallback.mjs` SHA-256 為 `dcdc543f679a0b15e5c1bd494a4863c23ead02450253e9a16c39177f3431514e`，新 evidence SHA-256 為 `089a50ff7636c3cb72225750ec4c847f2b587bf6fef9c53634ab5871b905c8af`，兩者與 round2 核對時一致。
- 對應 08-CHANGE-LOG 條目：2026-09-18 — production-mode Whisper 受控 Metal 失敗與 bundled CPU retry 整合（BUG-WHISPER-METAL-139），`docs/project-management/08-CHANGE-LOG.md:3-24`。
- 審查輪次：round3；round1／round2 報告均保留原文，round2 的治理格式錯誤由新檔案補做合規複審。
- 審查代理啟動時間、上下文來源：2026-09-18 13:46 +0800；本輪重新執行 debug preflight、讀取當前路由文件與 validator，並以檔案內容、SHA-256、先前獨立實測產物及本輪只讀檢查判斷，未依主要開發代理的評價性摘要判定。

## 1. 需求完整性

- 判定：通過。
- 證據：`docs/project-management/08-CHANGE-LOG.md:12` 要求受控 Metal exit 139 後由真實 bundled CPU retry、清理並留下 runtime／Tiny hash 與可重播命令；`scripts/verify-whisper-production-fallback.mjs:142-147` 在 hybrid 模式加入 `workingDirectory`、npm `command`、macOS arm64／本機權限 `prerequisites` 及 fresh-path `outputPolicy`，新 evidence `docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback-replay.json:11-21,30-39,47-87` 具備這些資料與任務結果。原始 evidence 的 SHA-256 仍為 `f302330535e8bf3cae1fb9fee26b779d2cda90a1ef3d7070fad9412b59e882fd`，未被覆寫；`00-CURRENT-STATUS.md:31`、`03-FUNCTIONAL-DESIGN.md:57`、`06-TEST-AND-PROCESS-AUDIT.md:21-24`、`07-DEBUG-AND-FIX-HISTORY.md:8-9` 和 `08-CHANGE-LOG.md:12-24` 均引用或描述新證據，並限定 Metal 為 wrapper 注入。

## 2. 邏輯正確性

- 判定：通過。
- 證據：hybrid wrapper 首次非 `--no-gpu` 分支寫入 partial SRT／JSON 並 exit 139，CPU 分支檢查 stale output 後以 `shell:false` 將原參數交給 bundled `whisper-cli`（`scripts/verify-whisper-production-fallback.mjs:181-207`）；產品 server 使用 `NODE_ENV=production`、隔離資料／工具路徑（`:232-256`），成功斷言要求 `completed/ready-review`、CPU metrics、精確 `['metal','cpu']`、bundled child exit 0、輸出與清理（`:319-334`）。JSON 的 replay 命令對應 `package.json:22` alias，工作目錄對應 `appDir`（`:8,142-147`）；2026-09-18 13:48 +0800 `command -v uuidgen` 可在本機解析為 `/usr/bin/uuidgen`，命令使用的新檔名可執行。

## 3. 邊界情況

- 判定：通過（已測邊界）。
- 證據：`scripts/verify-whisper-production-fallback.mjs:15-18,345-351` 在啟動前拒絕既有 evidence，最終以 `flag:'wx'` 建立產物；round2 獨立以已存在的 `/private/tmp/osf-review-20260918-hybrid-round2-a.json` 重試時 exit 1、明確拒絕覆寫，該檔在本輪 13:47 +0800 仍存在且 SHA-256 為 `551d342f1aaff719d4acc9dc376d1009393f3670e282a09fed14353b6c3e74cc`。舊 controlled 模式的 `/private/tmp/osf-review-20260918-controlled-round2-a.json:11-30` 保持 `bundledRuntimeUsed=false`、`replay=null`。新 evidence `docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback-replay.json:20-21` 明示 `wrapperCreatesMetalExit139=true` 且 `bundledMetalCrashObserved=false`。

## 4. 程式碼品質

- 判定：通過（本輪修正範圍）。
- 證據：`replay` 僅在 hybrid 模式填入，舊模式保留原有 schema 與 deterministic CPU 標記（`scripts/verify-whisper-production-fallback.mjs:123-152`；`/private/tmp/osf-review-20260918-controlled-round2-a.json:1-30`）；`replay.command` 與 `workingDirectory` 提供可直接使用的新檔名流程，`prerequisites` 揭露必要執行權限（`docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback-replay.json:30-39`）。round1 已指出的 server stdout／stderr `ignore`（`scripts/verify-whisper-production-fallback.mjs:252-256`）仍降低啟動失敗診斷能力，但未造成此次成功證據或重播欄位失真。

## 5. 測試覆蓋

- 判定：通過（本輪範圍）。
- 證據：round2 獨立於 2026-09-18 12:24 +0800 執行 `npm run acceptance:whisper:hybrid-fallback -- /private/tmp/osf-review-20260918-hybrid-round2-a.json`、舊 `npm run acceptance:whisper:production-fallback -- /private/tmp/osf-review-20260918-controlled-round2-a.json` 與完整 `npm run check`，均 exit 0；本輪 13:46–13:47 +0800 確認探針與新 evidence SHA-256 未變，並獨立執行 `npm run docs:check`、`node scripts/test-project-docs-validator.mjs`、`node --check scripts/verify-whisper-production-fallback.mjs`、`git diff --check`，均 exit 0。`node --input-type=module -e` 直接呼叫 `validateReviewReport` 於 13:46 +0800 對 round2 回報「缺少可逐字引用的完整結論句」及「審查代理聲明不完整」，此 round3 使用驗證器接受的固定欄位與完全相同聲明；hybrid 實機探針不在預設 `npm test`，`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:22` 已揭露須另外重播。

## 6. 實際運行結果

- 判定：通過（macOS arm64 受控權限、1 秒生成靜音 WAV）。
- 證據：新專案 evidence `docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback-replay.json:40-87` 與 round2 獨立實測 `/private/tmp/osf-review-20260918-hybrid-round2-a.json:40-87` 均記錄 production server、`completed/ready-review`、`whisperDevice=cpu`、Metal exit／CPU fallback marker、精確 `metal`→`cpu` 兩次 invocation、CPU `exitCode=0`、draft／SRT／JSON 齊全且無 stale partial／暫存 WAV。2026-09-18 13:47 +0800 的 `shasum -a 256 tools/whisper-cpp/whisper-cli tools/whisper-models/ggml-tiny.bin` 分別回報 `6167fe4817a85cb011cbb58abf53f80a9e9488be26b99348e9ff6f655edc7a08` 與 `be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21`，與兩份 evidence 相符；本輪未重跑未變更的實機探針，以上實測時間為 round2 並以相同檔案 hash 核對現況。

## 綜合判定

- 結論：通過。
- 可逐字引用完整結論句：**本輪「2026-09-18 — production-mode Whisper 受控 Metal 失敗與 bundled CPU retry 整合（BUG-WHISPER-METAL-139）」round3 獨立審查結論為通過：新 evidence 的可重播命令、工作目錄、執行前提與新檔名政策已補齊 round1 缺口，原始 evidence 保留，00／03／06／07／08 與目前證據一致，先前獨立 hybrid／舊模式實測及本輪治理與語法檢查通過；此判定只涵蓋 wrapper 注入 Metal exit 139 後由真實 bundled CPU 在同次 production server 任務完成，不代表 bundled Metal 自身 crash→CPU、中文品質、長音訊、真實 CPU child 取消、Windows、乾淨安裝或發布已驗收。**
- 阻擋問題（若有）：無。
- 剩餘風險：尚無同次真實 bundled Metal 自身崩潰後的 CPU fallback 證據；短靜音不驗證中文語音品質、長音訊、真實 bundled CPU 取消、跨平台或封裝；server 啟動失敗時 stderr 未保存，診斷有限。
- 給主要開發代理的具體修正要求（若有）：無產品或 evidence 修正要求；請在 08 條目連結此 round3 報告並逐字引用上句，完成工作紀錄後由主要代理執行 `npm run docs:check:final`。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
