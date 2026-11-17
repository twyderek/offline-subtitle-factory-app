# 獨立審查報告：BUG-WHISPER-METAL-139 child-process fallback 整合回歸

- 審查對象 commit／版本：工作樹 `0.51.0`（分支 `codex/0.51-anthropic-claude`，未提交工作樹）
- 對應 08-CHANGE-LOG 條目：2026-09-17 — Whisper Metal exit 139 child-process fallback 整合回歸補強（BUG-WHISPER-METAL-139）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-09-17；本輪獨立審查上下文，僅核對指定 fixture、`scripts/test-core.mjs`、既有 `server.mjs` fallback、`lib/whisper-fallback-policy.mjs` 及本輪治理文件。

## 1. 需求完整性

- 判定：通過
- 證據：`scripts/test-core.mjs:644-664` 僅在 macOS arm64 執行受控 Metal exit 139 fixture，驗證 CPU retry、`ready-review`、`whisperDevice=cpu` 與 partial-output 清理；`08-CHANGE-LOG.md:6,12-13` 明確排除真實 runtime 與跨平台驗收。

## 2. 邏輯正確性

- 判定：通過
- 證據：`server.mjs:2174-2181` 對 macOS arm64 非零退出清除 `.srt/.json` 後以 `forceCpu=true` 重試；`mock-whisper-cpp-runtime.mjs:20-34` 首次回傳 139、第二次 `--no-gpu` 產生成功輸出，核心整合斷言通過。

## 3. 邊界情況

- 判定：通過
- 證據：fixture 覆蓋缺少音訊（`mock-whisper-cpp-runtime.mjs:12-15`）、partial SRT／JSON、stale partial marker（`:27-28`）；策略矩陣由 `lib/whisper-fallback-policy.mjs:1-2` 覆蓋，取消、長音訊及跨平台實機仍明列未驗收。

## 4. 程式碼品質

- 判定：通過
- 證據：測試 runner 使用同步寫入、明確 marker 與固定輸出契約；server 使用 `shell:false`（`server.mjs:2095-2104`）及單次 guarded retry（`:2175-2181`），變更集中於 fixture／核心回歸，未改 production policy。

## 5. 測試覆蓋

- 判定：通過
- 證據：2026-09-17T07:56:35+08:00 focused syntax／fallback policy／quality 測試 exit 0；2026-09-17T07:56:56+08:00 `node scripts/test-core.mjs` exit 0；核心斷言涵蓋首次 139、CPU device、ready-review 與 stale output。

## 6. 實際運行結果

- 判定：通過
- 證據：2026-09-17T07:57:18+08:00 受控權限 `npm run check` exit 0，包含治理檢查、語法檢查、focused tests 與 `test-core.mjs`；`06-TEST-AND-PROCESS-AUDIT.md:18-23`、`07-DEBUG-AND-FIX-HISTORY.md:21-27` 與實測結果一致，未將 fixture 誤宣稱為真實 Whisper runtime。

## 綜合判定

- 結論：通過
- 可逐字引用的完整結論句：**本輪 BUG-WHISPER-METAL-139 child-process fallback 整合回歸審查通過（限定 macOS arm64 deterministic fixture 範圍）：六面向均無阻擋問題，核心測試實際證明首次 exit 139 後清除 partial SRT／JSON、以 --no-gpu 完成 CPU retry 並進入 ready-review；本結論不代表真實 bundled Whisper.cpp、長音訊、取消競態、Windows／其他架構或模型品質驗收。**
- 阻擋問題（若有）：無
- 剩餘風險：真實 bundled Metal／CPU runtime、長音訊效能與品質、取消時序、Windows／其他 macOS 架構及乾淨安裝仍待另行驗收；主要代理結案時須將 `08-CHANGE-LOG.md:17-20` 的待執行欄位更新為實際結果並連結本報告。
- 給主要開發代理的具體修正要求（若有）：無功能修正要求；結案時僅需完成工作紀錄與審查連結收尾，不得擴大本輪驗收聲明。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
