# 獨立審查報告：Whisper production probe 啟動失敗診斷可觀測性

- 審查對象 commit／版本：`17df978`、`codex/0.51-anthropic-claude`、0.51.0 開發中；目前工作樹另有既有未提交變更，本報告只審查 BUG-WHISPER-METAL-139 本輪 probe、指定 evidence 與治理文件。
- 對應 08-CHANGE-LOG 條目：2026-09-21 — Whisper production probe 啟動失敗診斷可觀測性（BUG-WHISPER-METAL-139），`docs/project-management/08-CHANGE-LOG.md:3-22`。
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-09-21（Asia/Taipei）獨立 review session；先執行 `npm run project:preflight -- --type=governance`，重新讀取指定 source、兩份 v2 evidence、治理核心／路由文件與 validator，未沿用主要開發代理的評價性結論。
- 六面向對照：1 需求完整性／功能正確性；2 邏輯正確性／錯誤處理；3 邊界情況／範圍與相容性；4 程式碼品質／可維護性與安全；5 測試覆蓋／證據充分性；6 實際運行結果／文件治理。

## 1. 需求完整性

- 判定：部分通過
- 證據：本輪工作條目把範圍限定為 acceptance probe 的啟動診斷，不修改 `server.mjs`、fallback policy、bundled runtime／模型、不讀使用者媒體、不呼叫外部服務（`docs/project-management/08-CHANGE-LOG.md:9-15`）。`scripts/verify-whisper-real-fallback.mjs:136-165` 的 v2 evidence schema 具備 production、loopback-only、test runners disabled、PID、ready phase、exit code／signal、stdout／stderr tail 欄位；`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:18-24`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 也正確記錄本輪是 probe-only observability。
- 證據：功能性成功條件在兩份 evidence 中達成：預設 sandbox 的 stderr 可見 `listen EPERM` 且 job 未建立（`docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-default.json:25-61`）；受控 replay 為 `completed`／`ready-review`、`whisperDevice=metal`、`fallbackObserved=false`（同目錄 `...-escalated.json:25-83`）。但工作條目宣稱 API key／token／credential 與暫存路徑均遮罩，source 的 redaction edge 尚未完整滿足這項安全性需求，故本面向不能無條件通過。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：`scripts/verify-whisper-real-fallback.mjs:88-107` 在 server ready 前檢查 child exit，並將 `ready=false` 與 pre-ready exit 寫入 evidence；`:197-212` 以 pipe 收集 stdout／stderr 與 exit event；`:294-308` 在停止 child 後保存遮罩尾端、使用 exclusive create 寫 evidence，最後清除隔離 data directory。這些控制流能正確區分「server 未 ready」與「任務已完成」。
- 證據：`sanitizeDiagnosticOutput()`（`scripts/verify-whisper-real-fallback.mjs:42-48`）確實以 1600 字元上限保存尾端，並處理無空白 key-value、Bearer／Basic 及部分 macOS 路徑；但其 `[^\s,;]+` 值段遇到含空白或引號的 credential 會提前停止。2026-09-21 的獨立 Node edge 驗證實際得到：`authorization: "SECRET VALUE"` → `authorization: <redacted> VALUE"`、`token=SECRET VALUE` → `token=<redacted> VALUE`、`Bearer SECRET VALUE` → `Bearer <redacted> VALUE`。因此目前 evidence 沒洩漏，不等於 probe 對未來 server stderr 的敏感值已安全遮罩。

## 3. 邊界情況

- 判定：部分通過
- 證據：目前 evidence assertions 已實際確認 v2 schema、production／loopback scope、PID、1600 字元尾端上限、預設 `listen EPERM`／ready=false／job 未建立、受控 `completed`／`ready-review`／Metal／無 fallback、輸出存在、stale partial 為空及兩側 runtime／model hash 一致。這覆蓋了本輪要求的預設啟動失敗與受控正常路徑邊界。
- 證據：未覆蓋且會影響安全邊界的輸入包括 quoted／escaped／含空白 credential、裸 token、`/tmp/` 路徑、長 stderr 在切尾前的敏感值位置，以及 server 以非標準格式輸出 secrets 的情境。source 只遮罩 `/Users/`、`/private/tmp/`、`/var/folders/`（`:46`），沒有 `/tmp/`；也沒有在寫 evidence 前以 `requireOk` 明確斷言 generated probe token 不在兩個 diagnostic tail。故不能把目前兩份無洩漏 evidence 擴張為完整 redaction boundary。
- 證據：本輪明確沒有真實 bundled Metal crash→CPU fallback 證據；受控 evidence 的 `metalFailure`／`metalExit`／`metalSignal`／`cpuFallback`／`fallbackObserved` 均為 false（`...-escalated.json:53-76`）。這是本輪範圍限制，不應被誤判成 probe 診斷功能失敗或 fallback 已完成。

## 4. 程式碼品質

- 判定：部分通過
- 證據：變更集中在 probe，使用明確 `server.process` evidence 結構、有限記憶體尾端 buffer（`:28,38-48`）、`stdio` pipe（`:197-204`）、ready 前退出欄位（`:150-160,205-212`）與 finally cleanup（`:294-307`）；未改動產品 server、fallback policy 或 bundled runtime，符合最小範圍與可回復性要求。
- 證據：redaction 是未抽出、未單元測試的內嵌 regex，且對 quoted／whitespace credential 與 `/tmp/` 的處理不完整；generated token 也未在 source 中做負向斷言。這不是目前正常 replay 的功能失敗，但對「診斷資料可安全保存」的維護契約形成可回歸的安全債務。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-09-21 期間獨立執行 `node --check scripts/verify-whisper-real-fallback.mjs`（exit 0）、`node scripts/test-whisper-fallback-policy.mjs`（通過 platform／architecture／forceCpu／non-zero exit／signal／log marker matrix）、`node scripts/test-project-docs-validator.mjs`（通過）、`npm run docs:check`（19 個文件通過）、`git diff --check`（exit 0）及完整 `npm run check`（治理、Node syntax、Whisper、Breeze、Electron、AI、UI、core 回歸均通過）。
- 證據：另以只讀 Node assertions 重新讀取兩份 v2 evidence，確認 default EPERM boundary、escalated ready-review Metal/no-fallback、tail bounds、目前 evidence redaction 與 asset hashes，結果為 `evidence assertions passed`。然而 `npm test`／`npm run check` 沒有執行這支新 probe 的 sanitizer source contract，也沒有 quoted／whitespace／`/tmp/` 負向測試；本輪獨立 edge 驗證已重現值尾段洩漏，故測試／證據尚不足以支撐安全性宣稱。
- 證據：`npm run docs:check:final` 於 2026-09-21 10:07 +0800 失敗，validator 回報最新 `08-CHANGE-LOG.md` 仍有「待執行」且「獨立審查是否執行」不是「是／否」。依使用者指示，本報告不修改 08；這是文件結案尚未完成的治理阻擋，不是把 `listen EPERM` 誤判成產品失敗。

## 6. 實際運行結果

- 判定：部分通過
- 證據：`docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-default.json:31-61` 的實際 default replay 記錄 PID `17443`、`ready=false`、`preReadyExitCode=0`，stderr 尾端包含 `listen EPERM: operation not permitted 127.0.0.1:24532`，job `created=false`，status=`fail`；這使前輪「只有 exit code、無法診斷」的問題可觀測化。
- 證據：`docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-escalated.json:31-83` 的受控 replay 記錄 PID `17471`、ready、job `completed`／`ready-review`、`asrEngine=whisper.cpp`、`whisperDevice=metal`、`fallbackObserved=false`，draft／SRT／JSON 存在且 stale partial 為空；stderr 無內容，stdout 只含本機 API lifecycle。現有 evidence 的 diagnostic 欄位未出現 probe token，且 scope 標示不呼叫外部網路、不執行 LM Studio。
- 證據：本面向的明確範圍結論是：這是 probe-only observability；預設 sandbox 的 stderr 應可見 `listen EPERM`；受控重播是 completed/ready-review、whisperDevice=metal、fallbackObserved=false；沒有真實 Metal crash→CPU fallback 證據。實際 replay 沒有超出這些宣稱，但文件尚未完成本輪獨立審查欄位回填。

## 綜合判定

- 結論：不通過
- 可逐字引用完整結論句：**本輪 BUG-WHISPER-METAL-139 是 probe-only observability：預設 sandbox 的 stderr 已可見 `listen EPERM`，受控重播已完成 `completed/ready-review`、`whisperDevice=metal`、`fallbackObserved=false`，且沒有真實 Metal crash→CPU fallback 證據；但目前 sanitizer 對含空白／引號 credential 與 `/tmp/` 路徑的遮罩不完整，缺少相應負向自動測試，且 08-CHANGE-LOG 尚未完成審查結案欄位，因此在修正安全遮罩、補足測試並完成文件結案前，本輪診斷可觀測性不得判定為通過。**
- 阻擋問題（若有）：
  1. `scripts/verify-whisper-real-fallback.mjs:42-48` 的 redaction 對 quoted／whitespace credential 實際會保留值尾段，違反 `NFR-002`「API Key 與簽章憑證不得進入一般設定、回應、repo 或日誌」的安全邊界；`:46` 亦未涵蓋 `/tmp/`，且 source 沒有 generated probe token 的負向斷言。
  2. 必須新增 deterministic sanitizer contract／負向測試，至少涵蓋 quoted／escaped／含空白 token、Authorization、Bearer／Basic、`/tmp/` 與 probe token，並重播兩側 acceptance probe。
  3. 主要工作流程須在不修改本報告的前提下更新 `08-CHANGE-LOG.md` 的獨立審查、判定與遺留風險欄位，再重新執行 `npm run docs:check:final`。
- 剩餘風險：即使上述 redaction 修正後，本輪仍只證明 production probe 的啟動診斷與正常 bundled Metal path；不證明真實 bundled Metal crash→CPU fallback、中文品質、長音訊、取消中的 retry、其他 macOS 架構、Windows、乾淨安裝、發布或 LM Studio。`externalNetwork=false` 是 probe scope，不是作業系統層級斷網證明。
- 給主要開發代理的具體修正要求（若有）：修正 sanitizer 以整段處理 quoted／escaped／含空白 credential，擴大暫存路徑遮罩或採保守 omission；在 probe 或 focused test 中負向斷言原始 credential、其可識別片段與 generated token 不出現在 stdout／stderr tail；重跑 syntax、focused／完整回歸、兩側 replay、`git diff --check` 與 `npm run docs:check:final`，再建立下一輪獨立複審，不修改本 round1 報告。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
