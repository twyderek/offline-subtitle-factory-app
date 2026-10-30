# 獨立審查報告：FR-020 長音訊來源完整性故障注入

- 審查對象 commit／版本：工作紀錄所載基準為 `299ff5d`、專案 `0.51.0`；本次審查的是其後尚未提交的工作樹差異。
- 對應 08-CHANGE-LOG 條目：2026-09-23 — FR-020／NFR-006 長音訊輸入媒體完整性 fault injection。
- 審查輪次：round1。
- 審查時間：2026-09-23 約 13:23–15:25（Asia/Taipei，UTC+8；15:25:02 為本次記錄的時鐘時間）。
- 上下文來源：本報告在目前對話上下文中完成；未取得另一個獨立審查上下文，也不能確認未沿用先前開發對話記憶。故本報告不宣稱已滿足 NFR-006 的獨立上下文要求。差異與 evidence 由本上下文直接讀取。

## 1. 需求完整性

- 判定：部分通過。
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:36,60-61` 將 FR-020 定義為低可信片段工作流，NFR-005 要求失敗／部分完成可辨識且不覆蓋原始資料，NFR-006 要求追溯、自動測試、文件檢查及獨立審查。此次 probe 改善的是長音訊來源檔完整性檢查，與 NFR-005／NFR-006 有直接關聯；它本身不驗證 FR-020 的 confidence／no-speech、風險分數、篩選或批次選取功能。
- `docs/project-management/03-FUNCTIONAL-DESIGN.md:121-123` 明確把 probe 定位為開發驗收工具而非產品 ASR runtime，並限制其結論為檔案前後完整性。`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:20-24` 亦列明語意正確率、人工校閱、真實 Metal fallback、Windows、乾淨安裝及 Release 不在本次證明範圍。
- `docs/project-management/00-CURRENT-STATUS.md:48-49` 記錄本次 v4 probe 與其狹義完整性限制；`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:13-18` 記錄原缺口、修正、故障注入及瞬態改寫等剩餘風險。獨立上下文條件依 `docs/project-management/workflows/04-INDEPENDENT-REVIEW.md`「審查證據獨立化規則」及報告格式判斷。
- 因此，本報告只對長音訊 probe 的完整性子範圍下結論，不將其擴張為 FR-020 整體驗收。

## 2. 邏輯正確性

- 判定：通過（限本次實作與已檢查路徑）。
- 證據：`scripts/whisper-long-media-integrity.mjs:29-55` 串流計算 SHA-256，並以讀取位元組數及讀取前後的 device、inode、size、mtime、ctime 判斷 snapshot 穩定性；`:58-66` 僅在兩側存在、穩定、大小與摘要相同時判定完整性一致。
- `scripts/verify-whisper-long-media.mjs:145-163` 在處理前取得影片及可選來源 SRT baseline；`:209-251` 在 finally 中取得 after snapshot，將內容不一致／檔案消失列為 `INPUT_MEDIA_MODIFIED` 或 `SOURCE_SRT_MODIFIED`，hash 檢查丟錯則列為明確 check failure，並強制 evidence status 為 fail；`:261-262` 對失敗 probe 設定非零結束碼。輸出以 `wx` 建立，拒絕覆寫既有 evidence（`:255-262`）。
- 未發現會把已檢查的 mismatch 或 missing-after 誤判為 unchanged 的路徑。前後 hash 無法發現檢查區間內改寫後又還原為原內容的瞬態變更；本工具亦不證明來源 SRT 是 ground truth。

## 3. 邊界情況

- 判定：已列測邊界通過；其餘邊界未驗證。
- 證據：`scripts/test-whisper-long-media-integrity.mjs:11-34` 對影片與來源字幕 fixture 各測 unchanged、同大小內容改寫造成 hash mismatch、missing-after，共六個情境，並於 `:35-37` 清除 fixture 暫存目錄。
- `scripts/accept-whisper-long-media-integrity-fault-injection.mjs:11-16` 定義四個 probe-level 情境；`:43-59` 建立 fake Whisper CLI，在執行時修改或刪除合成影片／SRT；`:82-113` 斷言 probe exit 1、對應 violation/error code、scope flag 與 probe temp cleanup。
- 原始影片／SRT before 缺失、讀取中途不穩定、權限／I/O 錯誤、路徑替換競態，以及變更後在 after snapshot 前還原等情況，沒有在這兩個測試中實際注入。不可將四個 fake-runtime 案例解讀為真實 Whisper runtime 故障測試。

## 4. 程式碼品質

- 判定：部分通過。
- 證據：helper 將 snapshot 與比較集中在 `scripts/whisper-long-media-integrity.mjs`；probe 透過 `integrityViolations` 保留機器可讀失敗原因，並用臨時目錄隔離音訊與 Whisper 輸出（`scripts/verify-whisper-long-media.mjs:24-27,209-263`）。evidence 保存檔案大小／hash 與輸出摘要，不保存完整 stdout 字幕行（`:112-119,193-199`）。新增 acceptance 命令及 unit test 已納入 `package.json:24,27`。
- 注意：probe 會把 stderr 最後最多 4096 bytes 原樣放入 evidence，僅遮罩路徑（`scripts/verify-whisper-long-media.mjs:39-48,185-195`）。本次 Tiny evidence 的 stderr tail 是診斷訊息，但尚無測試證明所有 runtime／錯誤路徑都不會把字幕文字寫入 stderr；「不保存字幕文字」的保證宜視為目前證據支持、但未由此路徑完全證明。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：`package.json:24,27-28` 將 fault-injection acceptance 命令及 integrity unit test 納入 npm scripts。`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:21-23` 與 `docs/project-management/08-CHANGE-LOG.md:18` 記錄 `node scripts/test-whisper-long-media-integrity.mjs`、`npm run acceptance:whisper:integrity-fault-injection`、新增／修改 MJS syntax、完整 `npm run check` 及 `git diff --check` 均已通過；本次依需求沒有重跑 npm 全套或上述測試。
- fault evidence `docs/project-management/evidence/2026-09-23-whisper-long-media-integrity-fault-injection.json:1-64` 記錄四案皆為預期 exit 1、對應 violation code、modified flag true、`tempRootRemoved=true`；建立時間為 `2026-09-23T04:05:28.100Z`（12:05:28.100 CST）。這是合成輸入加 `synthetic-whisper-cli-wrapper` 的測試 evidence，不能代表 bundled Whisper 的故障注入。
- 本次可讀到工作紀錄及 artifact 摘要，但沒有獨立保存完整 unit／npm check console transcript 與各命令執行時間；此處的完整回歸通過結論引用既有工作紀錄，未由本審查重現。`npm run docs:check:final` 未執行；工作紀錄目前仍標示進行中且 final gate 暫緩（`docs/project-management/08-CHANGE-LOG.md:5,19`）。

## 6. 實際運行結果

- 判定：短輸入 bundled Tiny 正常路徑通過；fake runtime 故障路徑按預期被拒絕。未驗證長片重播或真實 runtime 故障。
- bundled Tiny 正常路徑：`docs/project-management/evidence/2026-09-23-whisper-long-media-integrity-short-replay.json:1-10` 記錄 macOS arm64／Node v22.22.3；`:11-45` 記錄 36,477-byte 合成 MP4 與來源 SRT 的 before／after 大小和 SHA-256 相同；`:47-85` 記錄 bundled `whisper-cli`／Tiny 資產 hash、FFmpeg exit 0、Whisper exit 0、1 個 JSON segment。`:88-109` 記錄非空 SRT／JSON、temp root 已移除、兩項完整性檢查通過及 status `pass`。此短片約 3.505 秒、不是需求方長片；`deviceObserved=null`，故不宣稱觀察到 Metal。
- fake runtime 故障注入：四種 mismatch／missing-after 案例由 acceptance harness 的合成 Whisper wrapper 觸發；evidence 證明 probe 在指定邊界輸出預期失敗碼並清理自己的 temp root。wrapper 直接寫入合成 SRT／JSON，不執行 bundled Whisper 推論，所以這是 probe 控制流程驗證，不是 Whisper runtime 的真實故障或辨識品質測試。
- `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:23-24` 記錄沒有重跑 5,416 秒原始影片，且明確保留語意品質、人工影音校閱、真實 Metal crash→CPU fallback、Windows、乾淨安裝及 Release 等未驗收範圍。

## 綜合判定

- 結論：有條件通過（僅限 macOS arm64 長音訊 probe 的 v4 檔案前後完整性偵測、短合成輸入正常執行及 fake-runtime 故障注入證據）。
- 阻擋問題：本報告是在目前對話上下文撰寫，未能確認審查上下文獨立；因此不得用來宣稱 NFR-006 的獨立審查要求已完整滿足。另 `08-CHANGE-LOG.md` 最新條目仍為進行中，且 `docs:check:final` 尚未執行，文件結案仍未驗證。
- 剩餘風險：FR-020 低可信片段功能未由本 probe 驗收；沒有重跑長片、跨平台／乾淨安裝或 Release 測試；未覆蓋不穩定讀取、I/O 故障與瞬態改寫後還原；stderr tail 對字幕內容的排除未被完整測試。
- 給主要開發代理的具體修正要求：本次差異中未確認需立即修正的完整性判斷錯誤。若要將本工作計入 NFR-006 完成，須另由獨立上下文審查此差異，並在允許範圍內完成 changelog／final docs gate；另宜補測或限制 stderr evidence，確立不保存 transcript 的契約。此報告不授權修改其他檔案。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 上述聲明僅涵蓋本次實際檔案操作；本報告未能證明審查上下文獨立。若把本報告當作已由獨立上下文簽署，該解讀不成立。
