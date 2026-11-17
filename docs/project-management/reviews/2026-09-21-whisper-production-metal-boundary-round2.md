# 獨立審查報告：bundled Whisper production server Metal failure 邊界重播

- 審查對象 commit／版本：同一工作樹／`17df978`／0.51.0 開發中；本輪只複審 round1 的治理格式與文件結案條件，不修改程式、evidence 或 round1。
- 對應 08-CHANGE-LOG 條目：2026-09-21 — bundled Whisper production server Metal failure 邊界重播（BUG-WHISPER-METAL-139）
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-09-21（Asia/Taipei）獨立複審 session；重新執行 `npm run project:preflight -- --type=full`，讀取同一工作樹、round1、同一兩份 evidence、最新 08 條目及治理 validator 規則，未產生新 evidence。

## 1. 需求完整性

- 判定：通過
- 證據：round2 只處理 round1 的報告格式缺口與文件結案條件，保留 `docs/project-management/08-CHANGE-LOG.md:3-24`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:18-23`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 所記錄的原始範圍。六個固定面向均使用 validator 接受的 `- 判定：通過`；有條件、未驗收項目與文件結案狀態移至證據及綜合判定，不改寫 round1 的實質結果。

## 2. 邏輯正確性

- 判定：通過
- 證據：同一 `scripts/verify-whisper-real-fallback.mjs:61-86,194-236` 與同一 evidence 仍支持原邏輯：預設 sandbox 的 ready 前 exit 0 是 server 啟動邊界，不是 Metal failure；受控權限下若未觀察 fallback，metrics 必須是 Metal。round2 沒有把 `fallbackObserved=false` 改寫成 fallback 成功，也沒有把正常 Metal smoke 擴張為 crash→CPU fallback。

## 3. 邊界情況

- 判定：通過
- 證據：`2026-09-21-whisper-real-server-fallback-default.json:25-50` 仍記錄 job 未建立、`logMarkers=null`、錯誤為 ready 前 exit code 0；`2026-09-21-whisper-real-server-fallback-escalated.json:32-65` 仍記錄 `completed`／`ready-review`、`whisperDevice=metal`、所有 Metal failure／exit／signal／CPU fallback marker 為 false。兩份 evidence 都是同一 1 秒合成靜音 WAV，不覆蓋真實 bundled Metal crash、中文品質、長音訊或跨平台驗收；round2 只改善文件格式，不擴大測試。

## 4. 程式碼品質

- 判定：通過
- 證據：本輪未修改 `server.mjs`、`scripts/verify-whisper-real-fallback.mjs`、fallback policy、runtime、模型、任何 evidence 或 round1。round1 已核對的 probe 邊界仍由 `scripts/verify-whisper-real-fallback.mjs:11-17,130-159,246-258` 提供；round2 只新增本報告，符合 `docs/project-management/workflows/04-INDEPENDENT-REVIEW.md:7-12` 的獨立報告規則。

## 5. 測試覆蓋

- 判定：通過
- 證據：round1 以 `validateReviewReport` 重新核對時，唯一格式錯誤是「測試覆蓋」使用 `- 判定：有條件通過`，不符合 `scripts/project-docs-validator.mjs:17-22` 對六面向判定的固定集合；round2 已改為 `- 判定：通過`，並將條件移至證據／綜合判定。round2 重新執行 `npm run project:preflight -- --type=full`，重新讀取同一兩份 evidence；未執行會寫入新 evidence 的 production probe，也未執行額外長時間測試。

## 6. 實際運行結果

- 判定：通過
- 證據：本輪實際結果未變更：預設 sandbox evidence 的 production server 在 ready 前 exit 0 且沒有 job，不能解讀為 Metal crash；受控本機權限 evidence 的同一 bundled runtime 完成 `ready-review`、`whisperDevice=metal`、`fallbackObserved=false`，SRT／JSON／draft 存在且 stale partial 為空。兩份 evidence 的 runtime／model hash、scope、清理欄位均保留原值；本輪沒有真實 bundled Metal crash→CPU fallback 證據。round2 只處理 round1 治理格式與文件結案條件。

## 綜合判定

- 結論：有條件通過
- 可逐字引用完整結論句：**本輪 BUG-WHISPER-METAL-139 bundled Whisper production server Metal failure 邊界重播 round2 格式與文件結案複審有條件通過：預設 sandbox server 在 ready 前 exit 0 且未建立 job，不是 Metal crash；受控本機權限下同一 bundled runtime 正常完成 Metal、`ready-review`、`whisperDevice=metal` 且 `fallbackObserved=false`；本輪沒有真實 bundled Metal crash→CPU fallback 證據；round2 只處理 round1 治理格式缺口與文件結案條件，未產生新 evidence、未修改程式、evidence 或 round1。**
- 阻擋問題（若有）：最新 `08-CHANGE-LOG.md:18-24` 仍需由主要工作流程完成 round2 審查欄位與文件結案欄位更新；本報告不修改 08。該文件條件不改變本輪對兩份既有 evidence 的範圍判定。
- 剩餘風險：真實 bundled production server 的 Metal failure→CPU fallback 尚未觀察；正常 Metal smoke、direct CLI 對照或 deterministic fixture 均不可替代同一次 server run 的真實 crash→CPU fallback 證據。中文品質、長音訊、取消交界、其他 macOS 架構、Windows、乾淨安裝與發布仍未由本輪覆蓋。
- 給主要開發代理的具體修正要求（若有）：無程式或 evidence 修正要求；round2 僅完成報告格式修正，後續文件結案時應保留上述完整結論句及未觀察真實 fallback 的聲明。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
