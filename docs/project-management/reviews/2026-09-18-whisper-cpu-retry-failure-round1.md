# 獨立審查報告：Whisper CPU fallback 再失敗終止與清理整合（BUG-WHISPER-METAL-139）

- 審查對象 commit／版本：`17df9788abf2cf964d52df10b74f9a8fcd7a45d6` 上的未提交工作樹／`0.51.0`；本報告只審查最新工作條目可辨識的 `server.mjs`、Whisper.cpp fixture、核心整合測試、evidence 與 00／03／06／07／08 文件差異，不評價工作樹其他既有變更。
- 對應 08-CHANGE-LOG 條目：2026-09-18 — Whisper CPU fallback 再失敗終止與清理整合（BUG-WHISPER-METAL-139）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-09-18T10:55:12+08:00（本輪保存的最早獨立驗證時間戳；preflight 實際在此之前完成但未另印 `date`）；本次 Codex 對話為獨立審查上下文，未沿用主要開發代理對話記憶。先執行 `npm run project:preflight -- --type=debug` 並依輸出閱讀固定核心與 debug 路由；`08-CHANGE-LOG.md` 僅讀範本修訂規則、紀錄範本與最新條目。

## 1. 需求完整性
- 判定：通過
- 證據：最新條目 `docs/project-management/08-CHANGE-LOG.md:3-20` 要求 Metal 明確失敗後只做一次 CPU retry、CPU 非零退出後 `failed`、無第三次遞迴、無 draft、清除 partial SRT／JSON並保留 CPU reason 與既有 fallback marker。實作在 `server.mjs:2047-2064` 固定 `outputBase=working/whisper-cpp-output` 並以 `forceCpu` 區分 Metal／CPU，`server.mjs:2174-2184` 在明確 process failure 時先判定是否 fallback，終止性 failure 則先清理再 reject。fixture 在 `scripts/fixtures/mock-whisper-cpp-runtime.mjs:21-24,38-53` 實際建立 Metal 139→CPU `--no-gpu` exit 7、兩階段 partial outputs 與 invocation log；核心案例在 `scripts/test-core.mjs:689-715` 覆蓋 failed wait、failed stage、CPU device、exit 7 reason、既有 Metal fallback marker、精確 `metal`／`cpu` 兩次 invocation、無 stale／partial／draft。evidence `docs/project-management/evidence/2026-09-18-whisper-cpu-retry-failure.json:14-30,49-75` 與上述契約一致。

## 2. 邏輯正確性
- 判定：通過
- 證據：`lib/whisper-fallback-policy.mjs:16-20` 明確要求 `!forceCpu` 才能 fallback；第二次 `runWhisperCpp(..., true)` 因而不可能再次遞迴。`server.mjs:2176-2183` 的 Metal 分支先清理再以 `forceCpu=true` 重入，CPU exit 7 落入同一 failure 區塊但 `shouldRetryWhisperOnCpu` 為 false，隨即在 reject 前再清理。`server.mjs:1518-1529` 將該 reject 寫成 `status='failed'`／`stage='failed'` 並保留 `error.message`；`server.mjs:2066-2077` 在 CPU retry 啟動時把 `metrics.whisperDevice` 更新為 `cpu`。受控權限 focused core 於 2026-09-18T10:57:01+08:00 至 10:57:18+08:00 exit 0，證明上述 child-process 控制流與斷言在目前工作樹實際成立。

## 3. 邊界情況
- 判定：通過
- 證據：清理 helper `server.mjs:1476-1483` 只對傳入的每個 `outputBase` 加 `.srt`／`.json` 後綴，另刪除同一 `workingDir/quality-metadata.json`；本輪呼叫點 `server.mjs:2177,2182` 傳入固定的 `working/whisper-cpp-output`，沒有列舉目錄、glob、輸入媒體、`draft.srt`、匯入字幕或其他工作檔。fixture 的 CPU 路徑在 `scripts/fixtures/mock-whisper-cpp-runtime.mjs:45-53` 先檢查 Metal partial 是否已清除，再寫新的 CPU partial 並 exit 7；核心測試 `scripts/test-core.mjs:706-715` 驗證 invocation 恰為 `metal`、`cpu`，且 stale marker、CPU partial SRT／JSON 與 draft 均不存在。現有測試沒有在此案例預先建立 `quality-metadata.json` 再直接斷言刪除，故該項由窄範圍 helper 的靜態核對支持，列入剩餘風險而不擴張成 bundled runtime、取消競態、長音訊或跨平台結論。

## 4. 程式碼品質
- 判定：通過
- 證據：本輪沿用單一 `removeWhisperPartialOutputs` helper，避免在 fallback、取消與終止性 failure 各自維護不同刪除清單；`server.mjs:1476-1483` 的刪除目標可直接審計，`server.mjs:2174-2184` 的 retry／terminal failure 分支互斥且終止明確。fixture 以 marker 驅動，`scripts/fixtures/mock-whisper-cpp-runtime.mjs:23-24` 用 append-only invocation log 保留實際順序，`scripts/fixtures/mock-whisper-cpp-runtime.mjs:48-53` 讓 CPU failure 在寫出 partial 後以明確 exit 7 結束。2026-09-18T10:55:12+08:00 執行 `node --check server.mjs && node --check scripts/fixtures/mock-whisper-cpp-runtime.mjs && node --check scripts/test-core.mjs` exit 0；本報告完成後另執行 `git diff --check`，結果記錄於第 6 節。

## 5. 測試覆蓋
- 判定：部分通過
- 證據：`scripts/test-core.mjs:143-160` 以 `NODE_ENV=test` 啟動真實 server process，並把 Whisper.cpp runner 指向 child-process fixture；`scripts/test-core.mjs:184-194` 的 `waitForJob(..., ['failed'])` 只有在 API 回傳 `status='failed'` 時才返回，因此 `scripts/test-core.mjs:700-715` 同時覆蓋 final status／stage、CPU metrics、failure reason、fallback marker、兩次 invocation 與輸出清理。2026-09-18T10:55:19+08:00 sandbox 首跑 `node scripts/test-core.mjs` 因測試 listener `0.0.0.0:22084` 回報 `listen EPERM` 而 exit 1，屬環境權限阻擋、未進入產品斷言；取得受控 loopback 權限後於 2026-09-18T10:57:01+08:00 至 10:57:18+08:00 重跑 exit 0。2026-09-18T10:56:06+08:00 至 10:56:21+08:00 以受控權限執行完整 `npm run check` exit 0，輸出包含治理文件、fallback policy、三模型、下載、SRT／quality、Breeze、Electron、媒體、AI、UI 與核心 API 全部通過。部分通過的限制是：修正前 exit 1 基準未在目前已修正工作樹另造臨時副本重播，而是以保存 evidence `docs/project-management/evidence/2026-09-18-whisper-cpu-retry-failure.json:32-37`、fixture 寫檔順序與 `server.mjs` 差異靜態交叉核對；此外 CPU failure 案例未直接建立並斷言 `quality-metadata.json` 清除。

## 6. 實際運行結果
- 判定：通過
- 證據：2026-09-18T10:57:01+08:00 至 10:57:18+08:00 的受控權限 `node scripts/test-core.mjs` exit 0，輸出為「核心回歸測試通過」；由於本輪新增斷言位於同一核心程序 `scripts/test-core.mjs:689-715`，任一 failed status、CPU device、exit reason、fallback marker、invocation 次數或檔案清理不符都會使程序非零退出。2026-09-18T10:56:06+08:00 至 10:56:21+08:00 的受控權限 `npm run check` exit 0，完整輸出明列 `Whisper fallback 策略測試通過`、`Whisper quality metadata 測試通過` 與最終核心回歸通過。文件一致性可回溯至 `docs/project-management/00-CURRENT-STATUS.md:29,111`、`docs/project-management/03-FUNCTIONAL-DESIGN.md:53`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:18-25`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:9-17`、`docs/project-management/08-CHANGE-LOG.md:3-20`；各處均限定為 macOS arm64 deterministic child-process integration，沒有把 evidence 解讀為 bundled runtime、取消競態、長音訊、跨平台、乾淨安裝或發布驗收，並一致記錄 LM Studio 未執行且不在本輪範圍。`npm run docs:check`、報告 validator、`git diff --check` 與預期失敗的 final gate 於報告建立後執行，結果補記於下方綜合判定。

## 綜合判定
- 結論：通過
- 可逐字引用的完整結論句：**本輪「2026-09-18 — Whisper CPU fallback 再失敗終止與清理整合（BUG-WHISPER-METAL-139）」round1 獨立審查結論為通過：在 macOS arm64 deterministic child-process 限定範圍內，Metal exit 139 後僅一次 `--no-gpu` CPU retry、CPU exit 7 後 failed 終止、診斷與既有 fallback marker 保留，以及固定 SRT／JSON／quality metadata 清理均由現行程式、fixture、核心斷言與獨立回歸支持；本判定不代表 bundled runtime、取消競態、長音訊、跨平台、乾淨安裝或發布驗收，LM Studio 未執行且不在本輪範圍。**
- 阻擋問題（若有）：無。
- 剩餘風險：修正前核心 exit 1 的原始 console log 未另存，本輪只能以 evidence `:32-37`、fixture 與差異靜態交叉核對，沒有在已修正工作樹建立臨時舊版副本重播；CPU failure 案例沒有直接預置並斷言 `quality-metadata.json` 清除，該項目前由 helper 的固定刪除清單與完整回歸支持。真實 bundled server 的 Metal crash→CPU exit 7、取消與 retry 競態、長音訊、中文品質、其他 macOS 架構、Windows、乾淨安裝及發布均未驗收；大量其他未提交變更不在本輪判定內。LM Studio 未執行且不在本輪範圍。
- 給主要開發代理的具體修正要求（若有）：無阻擋修正。結案時應只連結本報告並逐字引用上方完整結論句，保留所有範圍限制；可在後續非阻擋補強中讓 CPU failure fixture 預置 `quality-metadata.json` 並增加不存在斷言。
- 報告後門檻結果：待執行 `npm run docs:check`、報告結構 validator、`git diff --check` 與 `npm run docs:check:final`；final gate 預期因最新 08 條目尚未由主要代理標示完成／補入審查欄位而失敗，該治理失敗不視為產品測試失敗。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
