# 獨立審查報告：FR-020／NFR-006 長媒體完整性與 v5 evidence 隱私

- 審查對象 commit／版本：變更前基準為 `299ff5d`、專案 `0.51.0`；審查目前尚未提交的工作樹差異。
- 對應 08-CHANGE-LOG 條目：`2026-09-23 — FR-020／NFR-006 長音訊輸入媒體完整性 fault injection`。
- 審查輪次：round2。
- 審查時間：2026-09-23 08:20:57 UTC（16:20:57 Asia/Taipei）。
- 上下文來源：本報告由新的獨立審查上下文完成，未接續主要開發上下文；round1 報告亦明載其非獨立上下文，本輪重新讀取來源與證據。
- 審查範圍：`verify-whisper-long-media.mjs`、integrity／evidence helpers、兩個 focused tests、fault-injection harness、v5/v6 evidence、round1 報告及最新工作紀錄。未重跑完整 `npm run check`。

## 1. 需求完整性

- 判定：部分通過。
- 證據：`docs/project-management/03-FUNCTIONAL-DESIGN.md:121-123` 將 probe 限定為開發驗收工具及來源檔前後完整性檢查。`scripts/verify-whisper-long-media.mjs:140-158,204-245` 對輸入媒體及已選定的來源 SRT 保存 before／after SHA-256、大小與檢查狀態；不一致、消失或 after hash 例外會令 probe status 為 fail。evidence schema v5 的 stdout／stderr 摘要不含原文字段（`:116-129,180-195`）。
- 此處只驗收 FR-020 的長媒體來源完整性 probe 子範圍，不涵蓋 FR-020 的字幕品質、confidence／no-speech、人工影音校閱或產品 ASR 流程。round1 所列隱私缺口已由 v5 部分收斂，但一般錯誤訊息遮罩仍有下述缺口。

## 2. 邏輯正確性

- 判定：部分通過。
- 證據：`scripts/whisper-long-media-integrity.mjs:29-55,58-66` 以串流 SHA-256、位元組數及讀取前後的 device／inode／size／mtime／ctime 建立穩定 snapshot；只有兩側存在、穩定且大小與 hash 相同才視為一致。probe 在 finally 重算媒體及已檢查 SRT，差異／消失被列為明確 violation 並將 status 設為 fail（`verify-whisper-long-media.mjs:204-245`）。
- 清理 fail-closed 尚不完整：`:247-249` 呼叫 `rmSync` 後只記錄 `tempRootRemoved`，未在該值為 false 時強制 `evidence.status='fail'`。若刪除呼叫拋錯，控制流程會中止並使 Node 以非零錯誤結束，但 evidence 不會寫出；此分支缺乏故障注入證據。現有證據只證明一般四案清理成功，不能證明清理失敗時 evidence／狀態必定 fail。
- 前後快照無法發現檢查區間內改寫後又還原成相同內容的瞬態變更；這是本檢查方式的能力界線。

## 3. 邊界情況

- 判定：已測案例通過；重要未測邊界仍在。
- 證據：`scripts/test-whisper-long-media-integrity.mjs:11-34` 對媒體與字幕 fixture 各測 unchanged、同大小 hash mismatch、missing-after；本輪實際執行通過。`scripts/accept-whisper-long-media-integrity-fault-injection.mjs:11-16,43-59,82-113` 定義並斷言四個 probe-level 情境：影片修改／刪除、SRT 修改／刪除；已保存的 v6 evidence 顯示四案 failure code、scope flag 及 probe temp cleanup 均符合預期（`...fault-injection-v6.json:13-60`）。
- 未覆蓋 hash 讀取中途 I/O／權限錯誤、`rmSync` 失敗或清理後路徑仍存在，也沒有針對非標準來源 SRT 路徑做 error privacy 測試。故障注入使用 fake Whisper wrapper；不可解讀為真實 Whisper 故障注入。

## 4. 程式碼品質／隱私

- 判定：不通過（發現 evidence 錯誤路徑可能保留自訂來源路徑）。
- 子程序輸出核對：`runCommand` 將 stdout／stderr 保留在記憶體尾段（最多 4096 bytes；`verify-whisper-long-media.mjs:40-41,55-80`），但 FFprobe／FFmpeg／Whisper 非零 exit、signal 與 spawn error 的 evidence outcome 使用 `safeProcessOutcome`，不包含原始 stderr 或 spawn error（`:160-175,180-195`；`whisper-long-media-evidence.mjs:10-15`）。Whisper stdout／stderr 只寫摘要（`:107-114`；`:188-189`）。正常 FFprobe 成功路徑會解析並保存 `-show_entries` 指定的 metadata，而不是原始 stdout（`:160-162`）。因此，已檢查的子程序失敗分支未發現 raw stdout／stderr 或 child startup error 原文流入 evidence。
- 隱私缺口：外層 catch 仍將 `error.message` 寫進 evidence，只套用有限路徑遮罩（`verify-whisper-long-media.mjs:44-49,199-200`）。遮罩沒有明確處理 `sourceSrtPath`，通用路徑 regex 也不涵蓋例如 `/Volumes/...`。因此使用者以該類路徑指定不存在／不可讀的來源 SRT 時，`:147-149` 的失敗訊息或底層檔案錯誤可能把完整 SRT 路徑寫入 `evidence.error.message`。這是依程式路徑推得的可達風險，本輪未執行該情境重現；它不代表子程序 stderr 本身被保存。
- focused privacy test 只測 helper 對模擬 stderr／Error canary 的序列化（`test-whisper-long-media-evidence.mjs:4-17`），沒有啟動 probe 驗證 FFprobe、FFmpeg、Whisper 各自失敗時的最終 evidence，也未測上述自訂路徑。

## 5. 測試覆蓋

- 判定：部分通過。
- 本輪實際執行（2026-09-23 08:20:57 UTC，macOS arm64、Node v22.22.3）：
  - `node scripts/test-whisper-long-media-integrity.mjs`：exit 0；三種情境在 input-video 與 source-subtitles fixture 上均通過。
  - `node scripts/test-whisper-long-media-evidence.mjs`：exit 0；stderr 與 process failure helper 的 canary 測試通過。
- v6 evidence（`docs/project-management/evidence/2026-09-23-whisper-long-media-integrity-fault-injection-v6.json:3-12,13-60`）記載 macOS arm64、四個 fake-runtime 案例均通過；round2 未重跑 harness。短片 bundled Tiny replay 的 v5 evidence 記錄正常路徑通過（`...short-replay-v5.json:1-16,47-80,92-114`）。
- 最新 `08-CHANGE-LOG.md:19` 與 `06-TEST-AND-PROCESS-AUDIT.md:25` 記載主要代理之後一次完整 `npm run check` 及 `git diff --check` 通過；本輪未重跑，亦未獨立驗證該完整回歸。沒有清理失敗注入或 probe-level 三種子程序錯誤輸出的 canary assertion。

## 6. 實際運行結果

- 判定：短合成輸入正常路徑及 fake-runtime 四案有可追溯證據；長原片 v5 replay、Windows 及真 Metal fallback 未驗收。
- Bundled Tiny 短合成 replay：`docs/project-management/evidence/2026-09-23-whisper-long-media-integrity-short-replay-v5.json:11-45,47-54,64-90,92-114` 記載約 3.587 秒合成 MP4、bundled Whisper Tiny 正常執行、1 個 segment、媒體與來源 SRT 前後 hash 相同、SRT／JSON 非空且 temp root removed。這不是 5,416 秒原片重跑，也不證明實際觀察到 Metal（`deviceObserved=null`，`:64-72`）。
- fake-runtime 四案：v6 evidence `:9-12,13-60` 標示 `synthetic-whisper-cli-wrapper`、四項預期 failure code 與 `tempRootRemoved=true`。實際 harness 將合成 WAV 交由 bundled FFprobe／FFmpeg 處理，Whisper 推論由 fake wrapper 代替；證據只支持 probe 邊界控制流程與一般清理成功。
- 5,416 秒原片：既有 `docs/project-management/evidence/2026-09-21-whisper-long-media-small-redacted.json:11-35,54-75` 記錄 5,416.349667 秒原片及 bundled Small 執行結果，但該 artifact 為 v2、早於本輪 v5，且只有輸入 before hash（`:1-2,11-15`），不能作為本輪 v5 before／after 完整性或隱私錯誤路徑的重播證據。工作紀錄亦明載未重跑原片（`06-TEST-AND-PROCESS-AUDIT.md:24,26`）。
- 沒有 Windows 實機或真實 bundled Metal crash→CPU fallback 的本輪執行證據；它們不在本 probe 的實測範圍。

## 綜合判定

- 結論：不通過。
- 完整結論：**本輪 FR-020／NFR-006 長媒體完整性改動的 before／after SHA-256 判斷、兩項 focused tests、短合成 MP4 bundled Tiny replay 及 fake-runtime 四案有可追溯的有限範圍證據；FFprobe／FFmpeg／Whisper 的子程序失敗摘要未保存原始 stdout／stderr 或 child startup error，但外層 evidence catch 對自訂來源 SRT 路徑的遮罩不完整，且 `tempRootRemoved=false` 未強制失敗，因此隱私與 cleanup fail-closed 驗收尚未通過；本輪未重跑 5,416 秒原片、完整 npm check、Windows 實機或真實 Metal fallback。**
- 阻擋問題：修正或以 probe-level 負向測試封住自訂 SRT／其他錯誤路徑可能保存完整路徑的情況；當 temp root 未移除時須確保 evidence status fail（並明確處理 cleanup throw 時的非零退出／證據缺失）。完成後應只對受影響情境複驗，再由獨立上下文複審。
- 剩餘風險：before／after hash 看不到改寫後還原的瞬態變動；此報告沒有重跑 v6 harness 或完整 `npm run check`；舊 5,416 秒原片 evidence 是 v2，不因 v5 程式更新而改寫或升級；語意正確率、人工影音校閱、Windows、真實 Metal fallback、乾淨安裝與 Release 均未由本輪證明。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、兩項 focused test 與驗證，未修改任何其他專案檔案。
- 本報告由獨立上下文完成；若上述上下文來源或檔案操作聲明不實，本報告無效。
