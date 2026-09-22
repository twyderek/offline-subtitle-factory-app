# 獨立審查報告：bundled Whisper 長音訊來源 SRT 完整性證據補強

- 審查對象 commit／版本：工作樹 `0.51.0`／`codex/0.51-anthropic-claude`；工作樹原有變更保留，未建立新 commit
- 對應 08-CHANGE-LOG 條目：2026-09-21 — bundled Whisper 長音訊來源 SRT 完整性證據補強（FR-020／NFR-006）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-09-21；以本輪指定腳本、evidence、治理文件、preflight 路由文件及現場唯讀指令結果為唯一審查依據，未沿用開發代理的評價性摘要。

## 1. 需求完整性

- 判定：通過
- 證據：本輪目標與不在範圍記載於 `/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/08-CHANGE-LOG.md:3-16`：probe 需保存來源 SRT basename／大小／before SHA-256／after SHA-256，且不保存字幕文字、不以來源 SRT 當作 Whisper 品質 ground truth。`/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/scripts/verify-whisper-long-media.mjs:118-130` 建立 evidence v3 與完整性旗標；`:145-153` 讀取來源 SRT 的 basename／大小／before hash；`:200-208` 於 finally 計算 after hash 並在不一致或檔案消失時標記 `SOURCE_SRT_MODIFIED`。既有 evidence `/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/evidence/2026-09-21-whisper-long-media-small-srt-integrity.json:2-5,36-42,96-104` 符合 schema v3、`checked=true`、`sourceSrtHashChecked=true`、`originalSrtModified=false`、`fullTranscriptStored=false` 與 `status=pass`。本判定只涵蓋本輪明確的來源檔完整性與執行／輸出完整性目標，不擴大為語意品質或正確率驗收。

## 2. 邏輯正確性

- 判定：通過
- 證據：`sha256File()` 僅以 `fs.readFileSync` 計算 hash（`/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/scripts/verify-whisper-long-media.mjs:32-34`）；來源 SRT 路徑只接受明確參數或輸入影片相鄰的 `.edited.srt`（`:13-15`），沒有寫入來源 SRT 的操作。FFprobe／FFmpeg／Whisper 子程序的 `exitCode` 與 `signal` 由 `close` 事件保存（`:57-83`）；輸出 base 位於暫存目錄，來源影片只作 `-i` 輸入（`:156-173`）。SRT hash 不一致或消失會令 status 變為 `fail` 並設定 `SOURCE_SRT_MODIFIED`（`:200-208`）；固定 evidence 不覆寫且 temp root 於 finally 移除（`:210-216`）。唯讀 assertions 於 2026-09-21 執行成功，實際讀取目前來源 SRT／影片並確認 SRT current hash 等於 evidence after hash、影片 current hash 等於 evidence 初始 hash；同一 assertions 亦確認 extraction／inference 均為 exit 0／signal null、SRT／JSON 非空、segment count 大於 0、`tempRootRemoved=true`。

## 3. 邊界情況

- 判定：部分通過
- 證據：程式碼已明確處理既有 output 拒絕覆寫（`/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/scripts/verify-whisper-long-media.mjs:17`）、缺少明確來源 SRT 時的存在性檢查（`:145-146`）、輸入／bundled assets／平台限制（`:135-140`）、FFmpeg／Whisper 非零退出與 signal（`:156-170,172-193`）、timeout 後 SIGTERM／SIGKILL（`:64-67`），以及來源 SRT after hash 不一致／檔案消失（`:200-208`）。本輪既有完整 replay 只直接證明成功路徑；本次審查未執行會寫入 failure evidence 的 hash mismatch、來源 SRT 消失、missing-source-SRT 或 timeout 故障注入，因此這些分支只能由程式碼核對，不能列為本輪已實機重播。另有一個範圍邊界：若沒有來源 SRT 且未傳入明確路徑，probe 可在 `sourceSrtHashChecked=false` 下完成一般長音訊成功，故「來源 SRT 完整性」用途仍依賴本輪輸入確實存在並被檢查；本份 evidence 已確認確實檢查到來源 SRT。

## 4. 程式碼品質

- 判定：通過
- 證據：probe 將輸入、資產、抽取、推論、輸出與 scope 分層保存，並以 `contentStored=false`、`fullTranscriptStored=false` 及路徑遮罩降低 evidence 敏感內容（`/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/scripts/verify-whisper-long-media.mjs:40-48,109-115,118-130`）。輸出檔使用 exclusive create、拒絕既有 evidence 覆寫（`:17,213-219`），暫存目錄在成功與失敗流程均位於 finally 清理（`:197-212`）。`node --check scripts/verify-whisper-long-media.mjs` exit 0；`git diff --check` exit 0。程式碼與 evidence 均未把來源 SRT 文字、完整 transcript 或字幕內容寫入本輪 evidence。剩餘品質注意事項列於「剩餘風險」：影片未採同一 probe 的 before／after hash，且 timeout 只直接終止 child，未建立 process group 收尾契約。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-09-21T04:16:56Z 起以預設 sandbox 執行 `npm run check` 時，所有已執行的治理／語法／回歸測試在 `test-core` 前均通過，但 `test-core` 綁定 `0.0.0.0:22131` 遇 `listen EPERM`，因此該次 exit 1 是執行環境限制。於 2026-09-21T04:17:15Z 以受控本機權限重跑同一 `npm run check`，`docs:check`、所有 npm test 項目、核心回歸與語法檢查均 exit 0；輸出明確包含 Whisper fallback／模型／SRT／quality、治理、review UI 與核心回歸通過。另執行 `node --check scripts/verify-whisper-long-media.mjs`、evidence assertions 與 `git diff --check` 均 exit 0。evidence assertions 逐欄確認 v3 schema、before／after hash、exit／signal、非空 SRT／JSON、segment count、無 transcript 儲存、temp cleanup，並比對目前來源 SRT／影片 hash。限制是本輪沒有把新 v3 的 hash mismatch／消失／缺檔分支加入 `npm test` 或現場 fault injection；`npm run check` 本身也不會重跑長音訊 probe。另執行 `npm run docs:check:final` exit 1，失敗原因是最新 `08-CHANGE-LOG.md` 條目仍為「進行中」、仍有「待執行」欄位且獨立審查欄位尚未填入，屬文件結案缺口而非程式回歸失敗。

## 6. 實際運行結果

- 判定：通過
- 證據：既有實際 replay evidence `/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/evidence/2026-09-21-whisper-long-media-small-srt-integrity.json:3-5,6-14,31-42` 記錄 macOS arm64／Node v22.22.3、影片 duration `5416.349667` 秒、source SRT 115,598 bytes，before／after SHA-256 均為 `4d5f5a53bb4eea7f5de5b428caefb38871771655166b12fccc613f3600f16482`。抽取為 exit 0／signal null，Whisper 為 exit 0／signal null（`:53-74`）；推論 summary 為 2,509 segments、最後 segment `5407.58` 秒、`contentStored=false`（`:75-83`）；SRT `161545` bytes、JSON `5666118` bytes 且 `tempRootRemoved=true`（`:85-94`）。唯讀 assertions 重新解析 evidence、重新計算目前來源 SRT／影片 hash並成功；本輪沒有重跑會另寫 evidence 的 5,416 秒 probe，避免違反「唯一可寫入檔案」限制。這些結果只證明 bundled Whisper 長音訊執行、輸出非空、來源 SRT probe 前後 hash 完整性與暫存清理；不證明字幕語意品質、中文辨識正確率、confidence／no-speech、Whisper 與來源 SRT 的內容比對或任何未執行平台／服務驗收。

## 綜合判定

- 結論：有條件通過
- 可逐字引用完整結論句：**本輪「bundled Whisper 長音訊來源 SRT 完整性證據補強」在 macOS arm64 受控本機 replay／既有 evidence v3 範圍內有條件通過：來源 SRT before／after SHA-256 相同、sourceSrtHashChecked=true、originalSrtModified=false，Whisper／FFmpeg exit code 與 signal、非空 SRT／JSON、segment 統計與 temp cleanup 均有 evidence 且唯讀 assertions／受控權限 npm run check 通過；但 npm run docs:check:final 仍因最新 08-CHANGE-LOG.md 條目為進行中／待執行且尚未填入獨立審查欄位而失敗，且本輪不代表字幕語意品質或 Whisper 正確率、confidence／no-speech、真實 Metal crash→CPU fallback、Windows、乾淨安裝、外部網路、LM Studio 或發布已完成。**
- 阻擋問題（若有）：`npm run docs:check:final` 尚未通過；主要代理仍需依專案治理流程完成最新 `08-CHANGE-LOG.md` 的狀態、獨立審查連結／逐字結論與結案欄位，然後重跑 final docs gate。本審查不代為修改該文件。
- 剩餘風險：來源 SRT 的 hash 完整性不等於字幕語意品質或 Whisper 正確率；本輪 evidence 的 `confidenceFieldCount=0`、`noSpeechProbabilityFieldCount=0`，且 `deviceObserved=null`，不得宣稱 confidence／no-speech 或 Metal crash→CPU fallback。原始影片路徑在 probe 中僅作讀取輸入，現況影片 hash 與 evidence 初始 hash 相同，但 evidence 沒有同一 probe 的影片 before／after hash，因此其完整性證據弱於來源 SRT；本輪未驗證 Windows、乾淨安裝、外部網路、LM Studio 或發布，也未執行來源 SRT mismatch／消失 fault injection。長音訊完整 replay evidence 與本輪 assertions 均不保存字幕文字。

## 審查代理聲明
本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
