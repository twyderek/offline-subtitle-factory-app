# 獨立複審報告：Whisper fallback 策略函式化與 deterministic 回歸

- 審查對象 commit／版本：目前工作樹／`0.48.0`；本輪複審針對 round1 的 strict exit-code 語意阻擋、null／字串矩陣與完整 test wiring。
- 對應 08-CHANGE-LOG 條目：2026-07-31 — Whisper fallback 策略函式化與 deterministic 回歸
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-07-31T10:50+08:00；由主要代理再次指派的獨立複審上下文，自行核對修正 diff、策略測試、server 整合與治理檢查。
- 審查需求：`BUG-WHISPER-METAL-139`。

## 1. 需求完整性

- 判定：通過
- 證據：
  - `lib/whisper-fallback-policy.mjs:1` 已改回 strict `exitCode !== 0`，與 round1 前 `server.mjs:1523` 的原始條件一致；`server.mjs:1524-1529` 仍只在 macOS arm64、非 `forceCpu` 且非零／非零語意退出時清理 partial outputs並 CPU retry。
  - `scripts/test-whisper-fallback-policy.mjs:4-10` 新增 `exitCode:null` 與 `'0'` cases，直接鎖定 round1 發現的語意差異；`package.json:17` 將該測試置於 `npm test` 開頭。
  - `docs/project-management/08-CHANGE-LOG.md:60-61` 已記錄 round1 修正與 sandbox 核心 socket 限制，沒有把受阻的單次執行錯寫成完整回歸通過。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - 2026-07-31T10:53+08:00 實際比較純函式與原始 strict predicate：139→true／true、0→false／false、null→true／true、`"0"`→true／true；round1 的 semantic regression 已解除。
  - `forceCpu:true`、非 darwin arm64及正常 exit 0仍不 retry；server 的 abort precheck、`finish(..., false)` 音訊 ownership、partial `.srt`／`.json` 清理、CPU `--no-gpu`參數與成功／失敗處理均未被 predicate 修正改變。
  - 純函式不執行副作用，只接受明確的平台、架構、forceCpu與 exitCode參數，server 整合點單一且可追溯。

## 3. 邊界情況

- 判定：通過
- 證據：
  - 測試矩陣現在涵蓋 Metal 139、CPU force、Windows x64、darwin x64、exit 0、null及字串 `'0'`；null與 `'0'` 特別覆蓋原始 strict comparison的非 number輸入邊界。
  - `server.mjs:1518-1529` 仍先處理 controller abort，再進 policy；因此取消中的 retry不因純函式抽取而改變，外部 signal 導致 null code的 fallback 語意亦與原條件一致。
  - 實際 child process failure、取消 race、輸出清理與跨平台實機仍屬 integration／實機後續風險，工作條目沒有把純函式矩陣擴張宣稱為完整 job-level 驗收。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - 純函式抽取保持最小 API與無副作用；server 只替換 predicate，沒有重複 fallback邏輯或變更 Whisper CLI 參數／輸出解析。
  - `package.json:17` 的 test wiring 在既有治理與功能測試前先執行新矩陣，確保 missing import／策略回歸會阻擋整體測試。
  - 2026-07-31T10:56+08:00 `node --check server.mjs`、`lib/whisper-fallback-policy.mjs`、`scripts/test-whisper-fallback-policy.mjs`與 `git diff --check`均通過。

## 5. 測試覆蓋

- 判定：通過
- 證據：
  - 2026-07-31T10:56+08:00 `node scripts/test-whisper-fallback-policy.mjs`通過，輸出「平台、架構、forceCpu 與退出碼矩陣」。
  - 主要代理提供受控環境的 `npm test`／`npm run check` 通過結果；本次 sandbox 直接執行曾在 `scripts/test-core.mjs` listen `0.0.0.0:22345` 遇 EPERM，但這是環境 socket 權限限制，不是 policy assertion失敗，且 changelog已明確揭露。
  - `npm test` wiring已由 diff與 targeted執行確認；完整回歸仍不取代後續 real child／跨平台 smoke，符合條目遺留風險。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 純函式策略矩陣實際通過，server與測試語法通過，round1 null／字串語意修正可重現。
  - 既有 server integration仍保留 `--no-gpu`、Metal partial output清理、WAV保留與 CPU failure path；本輪未重新執行完整 Whisper child job，也未新增取消 race或跨平台實機證據。
  - 因此實際結果支持「策略 refactor 等價且 deterministic 矩陣已接線」，不支持「所有 child process／平台 fallback 已完成驗收」；後者已在 08 遺留風險揭露。

## 綜合判定

- 結論：通過
- 阻擋問題：無；round1 strict exit-code semantic regression已修正，null／`'0'` cases已加入矩陣，策略測試與 npm test wiring均可追溯。
- 剩餘風險：實際 child failure、取消中的 retry、raw output cleanup、長音訊與 Windows／其他 macOS實機仍需 integration／平台驗收；sandbox socket EPERM不應被誤解為產品回歸失敗。
- 給主要開發代理的具體修正要求：無需本輪額外修正；在 08 條目引用本報告第 67 行逐字結論，保留上述 real child／跨平台遺留風險，並執行 final docs gate。

**本輪「2026-07-31 — Whisper fallback 策略函式化與 deterministic 回歸」round2 獨立複審結論為通過：`shouldRetryWhisperOnCpu` 已回復原 server 的 strict `exitCode !== 0` 語意，`exitCode:null` 與字串 `"0"` 均以新增矩陣測試鎖定，server 的 Metal／forceCpu／abort／CPU retry整合未改變，`package.json` 也將策略測試接入 `npm test`；targeted policy test、語法與差異檢查通過，主要代理提供的受控完整回歸亦通過，sandbox 單次 core listen EPERM已明確分類為環境限制；round1 semantic blocker已解除，未發現新的結案阻擋。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前已確認目標路徑不存在，未覆寫既有審查報告。
- 若上述聲明不實，本報告無效。
