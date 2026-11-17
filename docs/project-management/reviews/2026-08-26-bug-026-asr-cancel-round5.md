# 獨立複審報告：BUG-026 Whisper／FFmpeg 取消生命週期格式合規

- 審查對象 commit／版本：`aa37d156b302e32d0d84ac1b775e6c9b600745cf`、目前工作樹未提交差異、版本 `0.50.0`
- 對應 08-CHANGE-LOG 條目：2026-08-26 — Whisper／FFmpeg 取消後子程序與部分輸出清理（BUG-026）
- 審查輪次：round5
- 審查代理啟動時間、上下文來源：2026-08-26 11:24（Asia/Taipei）；重新讀取 `AGENTS.md`、full preflight 指定治理文件、BUG-026 round1–round4、目前 source／tests／fixtures／docs 與 validator；僅以目前檔案與本輪指令結果判定。

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:9-18` 將 BUG-026 成功條件定義為 FFmpeg、Python Whisper、Whisper.cpp 取消時等待 child `close`，Unix 先 SIGTERM、3 秒後 SIGKILL，Windows 使用 taskkill tree，並清理暫存音訊與部分 ASR 輸出。`docs/project-management/03-FUNCTIONAL-DESIGN.md:47-51` 保留 FR-022 的取消／fallback 契約；`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:18-25` 列出 deterministic 證據與未覆蓋項目。round1 的 Python spawn 前音訊清理、ASR allowlist 與 round2 的 FFmpeg 成功保留音訊修正均仍存在於目前 source／測試，但 Windows 實機、真實 runtime 與長音訊不在本輪證據內。

## 2. 邏輯正確性

- 判定：通過
- 證據：`server.mjs:1374-1387` 以取消音訊清理 guard 與明確 output basename／`quality-metadata.json` allowlist 清理，避免掃描刪除非 ASR 工作檔。`server.mjs:1782-1827` 在 Python Whisper spawn 前各取消檢查均清理音訊；`server.mjs:1863-1919` 等待 child `close` 後才完成取消與 partial cleanup。`server.mjs:2016-2042`、`2158-2207` 分別保留 Whisper.cpp／FFmpeg 的取消終止與成功／取消音訊清理分支；POSIX 使用 SIGTERM 後 3 秒 SIGKILL，Windows source 分支使用 `taskkill /pid ... /T /F`。

## 3. 邊界情況

- 判定：部分通過
- 證據：`scripts/test-core.mjs:554-569` 實際覆蓋 Python spawn 前取消、child 未啟動與 `whisper-input.wav` 清理；`:571-619` 覆蓋 Python／FFmpeg child 尚未 close 時維持 cancelling、close 後 cancelled 與取消音訊／partial 輸出清理；`:647-681` 覆蓋 Whisper.cpp partial SRT／JSON／quality cleanup 及 `edit-plan.json`、`trim-status.json`、`waveform-512.json` 保留；`:683-723` 覆蓋 macOS／POSIX stubborn child 的約 3 秒 grace。`06-TEST-AND-PROCESS-AUDIT.md:25` 明確揭露 Windows taskkill 實機、真實 Whisper／FFmpeg 長音訊、Apple Metal fallback 與 Breeze runtime 未覆蓋；Python／FFmpeg 各自 stubborn、Unix descendant process group 與跨平台 process tree 也沒有本輪實機證據。

## 4. 程式碼品質

- 判定：部分通過
- 證據：`removeWhisperPartialOutputs` 已集中清理規則並由各 engine 傳入 basename（`server.mjs:1380-1387,1904-1919,2060-2075`）；child 使用 `shell:false`，並以 `settled` guard、取消 timer、close 等待與 Windows tree-kill 控制生命週期（`server.mjs:1847-1869,2001-2042,2158-2187`）。FFmpeg `finish` 以 `cleanupAudio = false` 預設並只在取消／錯誤分支清理，降低成功路徑誤刪音訊風險（`server.mjs:2164-2207`）。三處取消狀態機仍有重複結構，且 descendant process group 與真實 runtime 行為未由本輪執行證明。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-08-26 11:24（Asia/Taipei）執行 `node --check server.mjs`、`node --check scripts/test-core.mjs`、三個 deterministic fixture 的 `node --check` 與 `git diff --check`，全部 exit 0。sandbox 內第一次 `node scripts/test-core.mjs` 因 `listen EPERM` 無法開啟暫時 listener；取得本機 listener 權限後重跑，輸出為「核心回歸測試通過」且 exit 0。`npm run check` exit 0，包含 `docs:check`、所有 npm test、語法檢查與核心回歸。測試已覆蓋 deterministic 正常完成、spawn 前取消、close 後取消、allowlist 清理、非 ASR 檔保留與 Whisper.cpp stubborn；沒有 Windows 實機 taskkill、Python／FFmpeg 各自 stubborn、真實 runtime／長音訊或完整 engine×boundary 笛卡兒積。

## 6. 實際運行結果

- 判定：部分通過
- 證據：本機環境為 macOS、Node.js `v22.22.3`。`node scripts/test-core.mjs` 在受控本機 listener 權限下實際 exit 0；`npm run check` 實際 exit 0；`npm run docs:check:final` 實際 exit 1，唯一錯誤為既有 `docs/project-management/reviews/2026-08-26-bug-026-asr-cancel-round4.md` 的「需求完整性」與「測試覆蓋」section 使用 validator 不接受的 `有條件通過` 判定。由於本輪只允許新增 round5，沒有修改 round4、工作紀錄或其他既有檔案。實際執行的是 deterministic mock／本機 API 回歸，不是真實 Whisper.cpp、Python Whisper、FFmpeg 長音訊、Windows 或 Breeze runtime。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**BUG-026 round5 最終格式合規複審結論為有條件通過：deterministic 產品範圍內的 Python spawn 前音訊清理、ASR basename allowlist、FFmpeg 成功保留音訊、三路徑取消等待 child close、部分輸出清理與既有回歸均已由目前 source、測試與本輪實際指令重新驗證，沒有新的產品阻擋問題；但既有 round4 報告的兩個 section 判定仍不符合 validator 格式，且 Windows taskkill／process tree、Unix descendant、Python／FFmpeg stubborn、真實 Whisper／FFmpeg 長音訊、Apple Metal fallback、Breeze runtime 與跨平台實機仍未驗證，因此不得宣稱跨平台或真實 runtime 完整驗收。**
- 阻擋問題（若有）：deterministic 產品行為範圍內無阻擋問題。治理 `npm run docs:check:final` 仍因既有 round4 報告格式失敗；本輪不得修改既有報告，故僅如實記錄，不將其誤寫為通過。
- 剩餘風險：Windows `taskkill /T /F` 真實 process tree 與 child-close 競態、Windows 實機安裝後取消、Unix descendant process group、Python／FFmpeg stubborn grace、真實 Whisper／FFmpeg 長音訊、Apple Metal fallback、Breeze runtime、跨平台字幕品質／效能均未實測；deterministic fixture 不等同真實 runtime 或跨平台實機驗收。sandbox listener `EPERM` 是執行環境限制，受控權限重跑已通過。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
