# 獨立審查報告：production-mode Whisper 受控 Metal 失敗與 bundled CPU retry 整合（BUG-WHISPER-METAL-139）

- 審查對象 commit／版本：`codex/0.51-anthropic-claude`、`HEAD=17df9788abf2cf964d52df10b74f9a8fcd7a45d6`、0.51.0 開發工作樹；本輪檔案尚未全數提交，2026-09-18 12:23 +0800 的 SHA-256 為 `scripts/verify-whisper-production-fallback.mjs`：`dcdc543f679a0b15e5c1bd494a4863c23ead02450253e9a16c39177f3431514e`、新 evidence：`089a50ff7636c3cb72225750ec4c847f2b587bf6fef9c53634ab5871b905c8af`。
- 對應 08-CHANGE-LOG 條目：2026-09-18 — production-mode Whisper 受控 Metal 失敗與 bundled CPU retry 整合（BUG-WHISPER-METAL-139），`docs/project-management/08-CHANGE-LOG.md:3-22`。
- 審查輪次：round2；round1 報告為 `docs/project-management/reviews/2026-09-18-whisper-hybrid-bundled-cpu-round1.md`，本輪未修改該檔。
- 審查代理啟動時間、上下文來源：2026-09-18 12:23 +0800；本輪依需求方複審指示、重新執行的 debug preflight、路由文件、當前程式與獨立重播作判斷，未依主要開發代理的評價性結論代替查證。

## 1. 需求完整性

- 判定：通過（本輪限定範圍）。
- 證據：`docs/project-management/08-CHANGE-LOG.md:11` 要求 evidence 同時區分受控 Metal／真實 bundled CPU 並記錄 runtime／model hash 與可重播命令。探針新增 hybrid 專屬 `replay` 物件，包含 `workingDirectory`、`command`、`prerequisites`、fresh-path `outputPolicy`（`scripts/verify-whisper-production-fallback.mjs:142-147`）；新檔 `docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback-replay.json:11-21,30-39,47-87` 具備上述欄位、兩次 invocation、CPU exit 0、任務／輸出／清理結果。`package.json:22` 的 alias 與 JSON `replay.command` 對應，`command -v uuidgen` 於 2026-09-18 12:23 +0800 回傳 `/usr/bin/uuidgen`。舊檔 `docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback.json` 的 SHA-256 仍為 round1 所記 `f302330535e8bf3cae1fb9fee26b779d2cda90a1ef3d7070fad9412b59e882fd`，未覆寫。
- 文件一致性：最新 evidence 路徑與受控 Metal／真實 CPU 邊界分別見 `docs/project-management/00-CURRENT-STATUS.md:31`、`03-FUNCTIONAL-DESIGN.md:57`、`06-TEST-AND-PROCESS-AUDIT.md:21-23`、`07-DEBUG-AND-FIX-HISTORY.md:8-9`、`08-CHANGE-LOG.md:11-17`；原始 evidence 保留的說明也一致。

## 2. 邏輯正確性

- 判定：通過。
- 證據：`replay.workingDirectory` 由 `appDir` 填入，命令呼叫 `acceptance:whisper:hybrid-fallback` 並使用 `/private/tmp` 的 `uuidgen` 新檔名（`scripts/verify-whisper-production-fallback.mjs:8,142-147`；`package.json:22`）；探針在任何暫存目錄建立前拒絕既有 evidence，落盤再用 exclusive `flag:'wx'`（`scripts/verify-whisper-production-fallback.mjs:15-18,345-351`）。`NODE_ENV=production` 且 test runner 關閉的 server 使用隔離 tools／data 目錄（`:232-256`）；wrapper 非 `--no-gpu` 分支注入 exit 139／partial SRT／JSON，CPU 分支將相同 args 交給 bundled binary 並記錄 child 結果（`:181-207`）；成功門檻要求精確 `['metal','cpu']`、CPU exit 0、`ready-review`、CPU metrics、輸出與清理（`:319-334`）。新增 metadata 未改產品 `server.mjs` 的 fallback 判斷。

## 3. 邊界情況

- 判定：通過（已測邊界）。
- 證據：2026-09-18 約 12:25 +0800，以已存在的 `/private/tmp/osf-review-20260918-hybrid-round2-a.json` 呼叫 `node scripts/verify-whisper-production-fallback.mjs --bundled-cpu <該路徑>`，exit 1 並明確拒絕覆寫（`scripts/verify-whisper-production-fallback.mjs:16`），先前成功輸出仍可讀。新路徑獨立 hybrid 重播則 exit 0，`/private/tmp/osf-review-20260918-hybrid-round2-a.json:63-79` 記錄無 stale partial／暫存 WAV 與 bundled CPU exit 0。非 hybrid 舊模式獨立重播的 `/private/tmp/osf-review-20260918-controlled-round2-a.json:11-30,38-69` 仍標示 deterministic CPU、`bundledRuntimeUsed=false`、`replay=null`，沒有誤標真實 CPU。
- 範圍界線：新 evidence `docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback-replay.json:20-21` 明確是 wrapper 注入 Metal exit 139、`bundledMetalCrashObserved=false`；不將受控注入視為 bundled Metal 自身崩潰。

## 4. 程式碼品質

- 判定：通過（本輪修正）；round1 非阻擋的診斷限制仍在。
- 證據：新增 replay 欄位集中於 evidence 初始化處且只在 hybrid 模式填入，避免改寫舊模式語意（`scripts/verify-whisper-production-fallback.mjs:123-152`）；產物使用 exclusive create 與專用暫存目錄清理（`:341-353`）。`replay.command` 與專案 alias 一致，並把本機 CLI／模型／FFmpeg、macOS arm64、子程序與 `127.0.0.1` 權限列為前提（`:143-146`）。server stdout／stderr 仍使用 `ignore`（`:252-256`），因此預設 sandbox 啟動失敗時的根因診斷仍有限；此點在 round1 已列為建議，不影響本輪成功證據或 replay 缺口解除。

## 5. 測試覆蓋

- 判定：通過（本輪 acceptance 與回歸範圍）。
- 證據：2026-09-18 12:23 +0800，獨立 `node --input-type=module -e` JSON assertions 對 `replay.command`、工作目錄、fresh-path policy、受控 Metal、`['metal','cpu']`、CPU exit 0、狀態／清理逐項核對，輸出 `replay JSON assertions passed`、exit 0；12:24:06–12:24:11 +0800，受控權限 `npm run acceptance:whisper:hybrid-fallback -- /private/tmp/osf-review-20260918-hybrid-round2-a.json` exit 0／`status=pass`；12:24:27–12:24:28 +0800，受控權限 `npm run acceptance:whisper:production-fallback -- /private/tmp/osf-review-20260918-controlled-round2-a.json` exit 0／`status=pass`。12:24:33–12:24:49 +0800，受控權限 `npm run check` exit 0，涵蓋 `docs:check`、Node 語法、Whisper policy、核心 API 及完整專案測試；約 12:25 +0800，`node --check scripts/verify-whisper-production-fallback.mjs` 與 `git diff --check` 均 exit 0。hybrid 實機探針未納入預設 `npm test`，`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:22` 已明確要求另行重播。

## 6. 實際運行結果

- 判定：通過（macOS arm64、受控權限、生成 1 秒靜音 WAV）。
- 證據：新專案 evidence `docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback-replay.json:30-87` 與獨立 `/private/tmp/osf-review-20260918-hybrid-round2-a.json:30-87` 均記錄可重播命令、`production` server、`completed/ready-review`、`whisperDevice=cpu`、Metal exit／CPU fallback marker、精確 Metal→CPU 兩次 invocation、bundled CPU `exitCode=0`、draft／SRT／JSON 存在且無 stale partial／暫存 WAV。2026-09-18 12:25 +0800 `shasum -a 256 tools/whisper-cpp/whisper-cli tools/whisper-models/ggml-tiny.bin` 結果分別為 `6167fe4817a85cb011cbb58abf53f80a9e9488be26b99348e9ff6f655edc7a08`、`be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21`，與新舊兩次成功 evidence 的 runtime／Tiny hash 一致。

## 綜合判定

- 結論：通過。
- 完整單句綜合結論：本輪「2026-09-18 — production-mode Whisper 受控 Metal 失敗與 bundled CPU retry 整合（BUG-WHISPER-METAL-139）」round2 獨立複審結論為通過：新檔 evidence 已以正確工作目錄、可重播 npm 命令、macOS arm64／本機權限前提與 fresh-path 政策補齊 round1 缺口，原始 evidence 未覆寫，00／03／06／07／08 引用一致，獨立 hybrid 與舊模式重播及完整回歸均通過，且此結論只證明 wrapper 注入 Metal exit 139 後真實 bundled CPU 在同次 production server 任務中完成，不代表 bundled Metal 自身 crash→CPU、長音訊、中文品質、真實 CPU child 取消、Windows、乾淨安裝或發布已驗收。
- 阻擋問題（若有）：無。
- 剩餘風險：實際 Metal 崩潰仍未在同次 bundled server run 重現；本輪輸入僅為短靜音，真實 CPU child 取消、長音訊、中文語音品質及跨平台／封裝驗收不在此證據範圍；server 啟動失敗時 stderr 被丟棄的診斷限制仍在。
- 給主要開發代理的具體修正要求（若有）：無產品／evidence 修正要求；依治理流程在 08 條目連結本 round2 報告並逐字引用上述完整結論句、補齊結案欄位後，由主要代理執行 `npm run docs:check:final`，不得修改 round1／round2 報告原文。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案；本輪獨立重播 evidence 僅建立在 `/private/tmp`。
- 若上述聲明不實，本報告無效。
