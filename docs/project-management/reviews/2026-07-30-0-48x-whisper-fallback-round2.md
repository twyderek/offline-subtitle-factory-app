# 獨立複審報告：0.48.x 穩定化：Whisper Metal CPU fallback

- 審查對象 commit／版本：目前工作樹／`0.48.0`；複審範圍限 round1 兩項阻擋的修正：Metal fallback stderr 紀錄，以及 deterministic runner injection 未完成時的成功條件／驗證結果揭露。
- 對應 08-CHANGE-LOG 條目：2026-07-30 — 0.48.x 穩定化：Whisper Metal CPU fallback
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-07-30T17:35+08:00；由主要代理再次指派的獨立複審上下文，自行執行 debug preflight、核對 round1 報告、修正後 runtime／工作條目、測試差異及最小驗證。
- 審查需求：`FR-003`、`FR-020`、`NFR-005`、`NFR-006`、`BUG-WHISPER-METAL-139`。

## 1. 需求完整性

- 判定：通過
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:55` 現已把本輪證據範圍明定為控制流檢查與實際 CLI GPU／CPU 對照，並逐字標示「尚不宣稱已具備 deterministic runner injection 測試」；不再以一般 `npm run check` 冒充可控的 fallback orchestration 測試。
  - `docs/project-management/08-CHANGE-LOG.md:60-61` 分別記錄實際 runtime 修改與已完成／未完成驗證：stderr 尾段已保存，取消、音訊 ownership、CPU failure與 stale metadata為控制流檢查；長音訊、retry 中取消、乾淨安裝、Windows與 deterministic injection仍明列未完成。
  - 原始驗證計畫 `docs/project-management/08-CHANGE-LOG.md:59` 仍保留曾計畫新增邊界測試，但同條目的成功條件與實際結果已清楚記錄本輪未完成此項，沒有產生「測試已存在」的錯誤完成宣稱。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `server.mjs:1528` 現在把 `Metal exit ${code}` 與 `sanitizeLog(stderr).slice(-500)` 一起交給 `updateJob`；exit code與最接近 failure 的 stderr 尾段均有確定性紀錄，不再依賴 1.2 秒節流的進度 log是否剛好捕捉 allocation error。
  - `server.mjs:796-806` 的 `sanitizeLog` 移除 CR／ANSI／替代字元、正規化空白、排除純分隔符行並限制 500 字元；`server.mjs:788-792` 的 `updateJob` 又統一對 event log套用 sanitizer及 120 筆上限後才寫入 job status。
  - round1 已確認的 runtime 控制流未被本次 log 修正改變：`server.mjs:1518-1529` 仍先檢查 abort，再於 Metal 非零時清理舊 output、保留音訊並單次 CPU retry；CPU 非零仍由 `server.mjs:1531-1533` reject。

## 3. 邊界情況

- 判定：通過
- 證據：
  - 空 stderr 時 `sanitizeLog` 回傳空字串，event 仍保留 Metal exit code與 fallback 動作；長 stderr 先由收集端 `server.mjs:1510` 限制為最後 4000 字元，再由 event限制為 sanitized 500 字元，不會無界增長 job status。
  - stderr 包含 ANSI、CR或 whisper 進度分隔行時會由共用 sanitizer 正規化；本次沒有另開未受控制的 raw log檔，也沒有改變音訊、SRT、JSON或 quality metadata的清理目標。
  - `docs/project-management/08-CHANGE-LOG.md:61` 保留 deterministic retry／取消實測缺口，因此靜態 abort邊界沒有被誤寫成已實際注入 race測試。這解除 round1「兩次 CLI smoke被當成 orchestration測試」的證據誇張問題，但該測試缺口仍列於剩餘風險。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - Metal fallback 與 CPU failure現在共用相同的 `sanitizeLog(stderr).slice(-500)` 診斷模式（`server.mjs:1528,1532`），沒有新增第二套 sanitizer或改變錯誤處理架構。
  - 修正只增加 fallback event的診斷尾段，沒有改動 `settled`、abort listener、音訊 ownership或遞迴停止條件，影響面小且容易回復。
  - 2026-07-30T19:00+08:00 本複審執行 `node --check server.mjs` 與 `git diff --check`，均 exit 0。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 主要代理提供修正後 `npm run check` 通過；本複審另執行 `npm run docs:check`，輸出「專案治理文件檢查通過：19 個文件，版本 0.48.0」，並重跑語法與 diff格式檢查通過。
  - `scripts/test-core.mjs` 目前工作樹差異只屬既有 Gemini設定遷移斷言，沒有 Whisper runner injection；專案搜尋亦未發現本輪新增的 Metal fail→CPU success／CPU fail／retry cancel fixture。文件現在準確承認此限制，因此它是已揭露的覆蓋風險，不再是錯誤驗證宣稱。
  - bundled CLI／tiny model／同一短 WAV 的 Metal exit 139與 `--no-gpu` exit 0仍由 round1前置診斷報告提供底層正反證據；完整回歸支持未破壞既有功能，但仍不等同可控 orchestration防回歸。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - `docs/project-management/reviews/2026-07-30-0-48x-whisper-metal-round1.md` 保存相同 binary／model／WAV 的 GPU exit 139／allocation stderr／無 JSON與 CPU `--no-gpu` exit 0／有效 JSON對照，證明 fallback選用的底層 CPU命令可運行。
  - 修正後 `docs/project-management/08-CHANGE-LOG.md:55,61` 沒有宣稱已保存完整產品 job的自动 fallback事件序列，並明列 retry取消、長音訊、乾淨 macOS安裝與 Windows未驗收；實際運行證據的界線與現況相符。
  - 本複審未另行製造產品 job或修改 runtime fixture；依 round2最小複審範圍，只確認新增 diagnostic event、既有控制流、前輪 CLI evidence與修正後治理敘述彼此一致。

## 綜合判定

- 結論：通過
- 阻擋問題：無；round1 的 stderr 確定性紀錄已由 sanitized 500 字元尾段解除，deterministic runner injection則由成功條件與實際驗證結果明確收斂為未完成／不宣稱項，不再以一般回歸或兩次獨立 CLI smoke代替。
- 剩餘風險：
  - 尚無一般 `npm run check` 可執行的 deterministic Metal fail→CPU success、CPU 再失敗與 retry 中取消測試；未來改動仍可能使音訊 ownership、cleanup或 job state回歸。
  - stderr sanitizer的目的為日誌正規化與長度限制，不是秘密偵測器；Whisper stderr若未來開始輸出敏感內容，仍需另做 redaction policy。
  - CPU retry的長音訊耗時、取消延遲、資源壓力、乾淨 macOS安裝及 Windows非回歸仍未實測。
- 給主要開發代理的具體修正要求：無阻擋修正；結案時在 08 逐字引用本報告綜合判定，保留 deterministic runner injection、長音訊、取消與跨平台未驗收風險，並依流程執行 `npm run docs:check:final` 與 `git diff --check`。

**本輪「2026-07-30 — 0.48.x 穩定化：Whisper Metal CPU fallback」round2 獨立複審結論為通過：fallback event已確定保存 Metal exit code及經共用 sanitizer正規化、限制為500字元的 stderr尾段，round1的診斷紀錄阻擋已解除；08工作條目也已將證據界線收斂為控制流檢查與實際CLI GPU exit 139／CPU `--no-gpu` exit 0對照，明確不宣稱具備deterministic runner injection，並保留retry取消、長音訊、乾淨macOS安裝與Windows未驗收限制，因此兩次獨立CLI smoke不再被錯寫成產品orchestration測試；既有未取消Metal非零才retry、retry保留working WAV、CPU failure落到failed、ASR入口清除quality metadata的控制流未被log修正改變，修正後完整回歸由主要代理回報通過，本複審的語法、治理文件與diff格式檢查亦通過，round1兩項阻擋均已解除，未發現新的結案阻擋。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前已確認目標路徑不存在，未覆寫既有審查報告。
- 若上述聲明不實，本報告無效。
