# 獨立審查報告：FR-020／NFR-006 長音訊輸入媒體完整性 fault injection（round4）

- 審查對象 commit／版本：專案 0.51.0；目前未提交工作樹差異。
- 對應 08-CHANGE-LOG 條目：`2026-09-23 — FR-020／NFR-006 長音訊輸入媒體完整性 fault injection`。
- 審查輪次：round4。
- 審查時間：2026-09-29 09:10（Asia/Taipei）。
- 審查代理啟動時間、上下文來源：本輪以新的獨立上下文執行，未沿用主要開發代理對話；先執行 `npm run project:preflight -- --type=development`，閱讀 preflight 指定核心／路由文件與 round1–round3 中相關 round3 報告。依獨立審查流程，只新增本報告。
- 範圍：只複核 (1) 自訂來源 SRT basename 是否仍會流入 evidence 及遮罩測試，(2) probe 子程序層級 temp-root 清理故障是否能被注入並令 evidence／程序失敗；並核對兩項 focused tests 與 2026-09-24 v9 JSON evidence。未重跑完整 `npm run check`、原始長片或 Windows 實機。

## 1. 需求完整性

- 判定：部分通過（限本輪 probe 隱私及 cleanup fail-closed 範圍）。
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:36,61` 分別列出 FR-020 與 NFR-006；本輪只驗收 FR-020 長媒體 probe 的來源 SRT basename 隱私及 NFR-006 的測試／審查可追溯性，不涵蓋 FR-020 的字幕品質、confidence／no-speech 或人工校閱流程。設計範圍見 `docs/project-management/03-FUNCTIONAL-DESIGN.md:121-123`。
- round3 提出的 basename 缺口已有 probe-level 正常路徑 canary 案例；cleanup 不可確認也已有 probe-level 負向案例，但實際 temp directory 殘留情境尚未在 probe 子程序中注入（詳第 3 節）。

## 2. 邏輯正確性

- 判定：通過（SRT basename 遮罩及 cleanup「無法確認」路徑）。
- 證據：probe 在 evidence 初始化與成功確認來源 SRT 後都固定寫入 `fileName: 'source.srt'`，未序列化自訂 basename（`scripts/verify-whisper-long-media.mjs:122,146-157`）。外層 catch 使用固定 `safeProbeFailure()`，不讀取例外訊息（`:199-200`；`scripts/whisper-long-media-evidence.mjs:19-21`）。
- cleanup helper 在 `rmSync` 後以 `lstatSync` 確認；目錄仍存在或 lstat 無法判讀時回傳 false，`recordTempRootCleanup()` 將 evidence 標為 fail（`scripts/whisper-long-media-evidence.mjs:23-45`）。probe finally 落盤 evidence，且 status 非 pass 或 cleanup 未確認時設 `process.exitCode=1`（`scripts/verify-whisper-long-media.mjs:247-255`）。

## 3. 邊界情況

- 判定：已測 basename／自訂路徑遮罩通過；cleanup 不可確認通過，實際刪除失敗仍未端到端覆蓋。
- 證據：harness 的 missing custom SRT 案斷言自訂目錄 canary 不在最終 evidence（`scripts/accept-whisper-long-media-integrity-fault-injection.mjs:141-170`）；另一案建立含 `PRIVATE_TRANSCRIPT_CANARY` 的既存自訂 SRT，實際啟動 probe，斷言 evidence 標籤為 `source.srt` 且完整序列化內容不含 basename canary（`:173-200`）。2026-09-24 v9 evidence 兩案均為 pass（`docs/project-management/evidence/2026-09-24-whisper-long-media-integrity-fault-injection-v9.json:62-78`）。
- cleanup preload 位於 harness `:62-85`。它攔截 probe temp-root 的 `rmSync`，先呼叫原始 `rmSync` 真正刪除目錄，再拋出合成 EACCES；接著讓該路徑的 `lstatSync` 拋 EACCES。probe 子程序因無法確認 cleanup 而寫出 `TEMP_ROOT_CLEANUP_FAILED`、`tempRootRemoved=false`，並以 exit 1 結束；harness 對上述欄位有斷言（`:203-238`），v9 JSON 記錄一致結果（`:80-86`）。因此這是真正經過 probe 子程序及 evidence 落盤／退出碼的 fault injection，但注入的是「清理後無法確認」，不是 `rmSync` 未刪除且目錄仍存在。目錄仍存在的分支只在 helper focused test 測試（`scripts/test-whisper-long-media-evidence.mjs:26-29`），沒有 probe-level 重播。

## 4. 程式碼品質／隱私

- 判定：通過（限本次檢查的自訂來源 SRT 與 cleanup diagnostics）。
- 證據：自訂路徑錯誤走固定錯誤碼，不保存例外 message；來源 SRT evidence basename 固定為 `source.srt`。cleanup 的錯誤 evidence 只包含固定訊息與錯誤碼；測試 canary 不會出現在序列化結果。未檢查或推廣此判定至其他 evidence 欄位／其他路徑類型。

## 5. 測試覆蓋

- 判定：部分通過。
- 實際執行時間：2026-09-29 09:07–09:09（Asia/Taipei），macOS arm64、Node v22.22.3。
  - `node scripts/test-whisper-long-media-evidence.mjs`：exit 0，輸出 `Whisper evidence 隱私測試通過`；含 basename 無關的 stderr／錯誤 canary、cleanup helper「路徑仍存在／不可確認」及 fail evidence 欄位斷言。
  - `node scripts/test-whisper-long-media-integrity.mjs`：exit 0；input video 與 source subtitles fixture 的 unchanged、hash mismatch、missing-after 均通過。
  - `npm run acceptance:whisper:integrity-fault-injection -- /private/tmp/fr020-round4.iIVObU/replay.json`：exit 0，7 案 pass；包含 custom path／basename canary 與 probe cleanup-unverifiable。replay JSON 在 repo 外暫存目錄產生後已刪除，未覆寫既有證據。
- v9 原始 evidence 為 schema v3，建立時間 `2026-09-24T02:04:31.478Z`，標示 macOS arm64／Node v22.22.3、synthetic Whisper wrapper、不讀原始媒體／SRT，七案結果全 pass（`docs/project-management/evidence/2026-09-24-whisper-long-media-integrity-fault-injection-v9.json:1-12,13-89`）。本輪另行重播相同七案並通過。
- 本輪未執行 `npm run check` 或 `npm run docs:check:final`；不將既有工作紀錄中的主要代理完整回歸結果視為本輪獨立執行。

## 6. 實際運行結果

- 判定：限定 probe 子程序結果通過；清理不可確認造成的 fail evidence／exit 1 已實際重播。
- 證據：本輪 harness 使用合成 WAV、bundled FFprobe／FFmpeg 與 `synthetic-whisper-cli-wrapper`；本輪 replay evidence 記錄 input media／SRT 四種修改或刪除、custom path、basename 及 cleanup-unverifiable 七案全 pass。cleanup 案實際 probe exit 1、evidence `status=fail`、`tempRootRemoved=false`、`TEMP_ROOT_CLEANUP_FAILED`；見本輪 harness `scripts/accept-whisper-long-media-integrity-fault-injection.mjs:203-238` 與已核對的 replay 輸出。
- 原始 5,416 秒長片、Windows 實機、真實 bundled Metal crash／fallback 均未執行，本輪不對其驗收狀態作推論。既有短合成 Tiny 正常 replay 也不是本輪故障注入或長片重播證據。

## 綜合判定

- 結論：**CONDITIONAL PASS（有條件通過）**，限自訂來源 SRT basename 隱私及 probe cleanup「無法確認」fail-closed 路徑。
- 阻擋問題：未發現來源 SRT basename 或自訂路徑 canary 流入本次檢查的 evidence；probe 子程序在 cleanup 無法確認時確實落盤失敗 evidence 並 exit 1。
- 條件／剩餘風險：preload 先成功刪除 temp root，後續才合成 `rmSync` EACCES 與 `lstat` EACCES；故端到端證據證明的是無法確認清理時 fail-closed，不能證明 temp root 實際仍存在／刪除本身失敗時也已在 probe 層級重播。若要把結論擴為實際刪除失敗情境也完成端到端驗收，需增加 probe-level「rmSync 失敗且路徑仍存在」案例，並斷言 evidence fail／`tempRootRemoved=false`／非零 exit。另本輪未驗原始長片、Windows、Metal 或完整回歸。
- 給主要開發代理的具體要求：無須因本輪兩項已驗範圍修改 code；如需宣稱「目錄實際未刪除」已做 probe-level 故障驗收，依上述條件另補案例並交獨立複審。本報告不執行修正。

## 審查代理聲明

- 本審查代理在新的獨立上下文完成本報告。除新增本報告外，僅執行讀取、使用者指定的兩項 focused tests 與 v9 harness，未修改任何其他專案檔案。
- 本輪唯一寫入的 repo 檔案為 `docs/project-management/reviews/2026-09-29-fr-020-long-media-integrity-fault-injection-round4.md`。若上述聲明不實，本報告無效。
