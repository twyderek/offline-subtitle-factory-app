# 獨立審查報告：FR-027 YouTube 私人影片與字幕上傳 MVP 複審

- 審查對象 commit／版本：0.51.0，HEAD `299ff5d4288b9d50e356db8b0a5ae349dcb23ebc` 上的未提交工作樹；不代表公開版本具有本功能。
- 對應 08-CHANGE-LOG 條目：2026-10-16 — FR-027 YouTube 私人影片與字幕上傳。
- 審查輪次：round2。
- 審查代理啟動時間、上下文來源：2026-10-16 約 07:24 UTC；沿用獨立審查角色的 round1 上下文，未沿用主要開發代理對話記憶。依需求方本輪修正清單、現場 source／測試及原 round1 複驗，實測與證據核對約 07:25–07:28 UTC。
- 審查計畫：development preflight、核對原 B1／B2／B3 及相鄰新增邊界、自行執行四份 YouTube suites 與隔離 Electron UI、建立本報告。沿用本審查上下文已讀取的 AGENTS／治理入口／development workflows，本輪重讀最新 FR-027 工作條目與設計／稽核／缺陷更新。
- 唯一專案寫入為本報告；不修改 round1、產品程式、測試、治理來源或既有 evidence。測試使用自有暫存 job／profile 並清理。
- 核對 source SHA-256：publisher `a3060d6a3c3161b22e747ccd605bec455bdff552c9d6bb832c64ce64de301136`；media-stream `860eb97cd7c5e7f033d8cefd3a474a1aaa06a5fdc4fc6305510677be78a87b88`；renderer `d2329b4623b73b472fe7a593217fd13c139e562907ad5dba6b04aac142608057`；main `b5fdf9f8a621332f4cf75ed9220ba40b9af67d4bee5f34c6a03eeb38e87bdb05`；server `92043c45355d6268d19a229cefcbd5321ed3fb45574a626e0c5d77311624580e`。以上檔案路徑分別為 `lib/youtube/publisher.mjs`、`lib/youtube/media-stream.mjs`、`public/youtube-publish.mjs`、`electron/main.mjs`、`server.mjs`。

## 1. 需求完整性
- 判定：通過
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:44–46` 的 FR-027 私人上傳 MVP 要求維持；`03-FUNCTIONAL-DESIGN.md:28–34` 補入 lease、獨立 history 與 source-error contract；`07-DEBUG-AND-FIX-HISTORY.md:3–20` 分別追蹤 BUG-043／044／045。未擴大至真實 Google、Keychain、封裝或 Windows 驗收。
- B3 已解除：`public/youtube-publish.mjs:32,79–80` 新增 aria-live identifiers，使用 textContent 直接呈現 videoId／captionId／captionStatus；自行 UI 重跑驗證 completed＋syncing、partial＋failed。本地已知字幕狀態可辨識，沒有把 syncing 冒稱為 serving。
- 原先 Desktop OAuth／state／PKCE、safeStorage、明確同意、頻道核對、固定 private 與 caption-only retry 基線由本輪重新執行的 publisher／SDK tests 持續驗證；沒有新增 public／schedule 或 byte-level 續傳的宣稱。

## 2. 邏輯正確性
- 判定：通過
- 證據：B1 已解除。`electron/main.mjs:33–46` 以本機 API token 取得／釋放 lease；`server.mjs:4299–4309` 以 canonical root 與 expectedRoot 核對、拒絕重複 lease，`server.mjs:3091–3095` 在刪除前拒絕 active publish，HTTP 409。release route `:4272–4285` 不依賴 job 仍存在，且須匹配不可預測 leaseId 與 jobId，能在外部移除後釋放。
- `publisher.mjs:289–301` 在 lease 內重讀 durable state，初次工作 `:139` 以 wx exclusive-create 防止覆蓋既有紀錄；`:22–27` atomicJson 不再 mkdir job。`:132–144` 先保存 config history，再驗證 root／寫入 job；遠端影片 ID 的 persist 失敗會離開正常流程，阻止後續字幕請求。finally 先完成本地清理，再 release，operation 最終解鎖。
- 07:25 UTC 自行執行 `npm run test:youtube`，lifecycle suite 使用真實隔離 server HTTP，驗證 active DELETE=409、duplicate acquire=409、wrong release=409、正常完成後 release／DELETE=200；另在影片回應等待點強制移除 root，確認不重建、不增加 captionCalls、config history 有 partial 與 videoId、busy=false。這些是本地 fixture 與假 Google API，不是實際外部上傳。
- History 只保存本地發布摘要，不保存 OAuth／原始請求或素材內容；不會因移除 OAuth 清掉防重複資訊。lease 回應遺失的 fail-closed／重啟後 Studio 核對限制，README 第 13 行及設計第 30 行已揭露。

## 3. 邊界情況
- 判定：通過
- 證據：B2 已解除。`lib/youtube/media-stream.mjs:6–45` 在交付 SDK 前註冊 source error／AbortSignal，來源錯誤轉為固定 `YOUTUBE_SOURCE_READ_FAILED`，中止 controller，以 fault race 結束等待、銷毀／等待 source 關閉、移除 listener，並對不配合 abort 的 SDK Promise 作最多約 2 秒觀察。`publisher.mjs:324–329,341–358` 使用 helper 並區分來源失敗與使用者取消；有 videoId 的來源失敗為 partial。
- 自行執行 `scripts/test-youtube-streams.mjs`（包含於 test:youtube）：實際已安裝 Google SDK、本地 multipart adapter、影片／字幕各 ENOENT 與 mid-read 四案皆受控 reject，source.destroyed=true、transportClosed=true，子 Node 程序 exit 0，沒有 round1 的未處理事件。
- lifecycle suite 另實測字幕來源失敗保留 videoId、訊息不含 canary 路徑、busy 解鎖，修復來源後 caption-only retry 完成；原 publisher suite 持續測取消、拒絕／逾時、錯頻道、symlink／traversal、重啟 interrupted 與禁止重傳影片。
- 07:26 UTC reviewer 額外以 stdin 執行 helper 邊界斷言：預先 aborted 不呼叫 request；SDK 直接 rejection 後 source 銷毀且 error listener 清除；使用 PassThrough 與永不 settle 的假 SDK，下一個 event-loop turn cancel 後約 2002ms reject、source 銷毀、listener 清除，均 exit 0。此案驗證有界觀察；不宣稱永不配合 abort 的任意實作已被強制終止，也未開外部 socket。

## 4. 程式碼品質
- 判定：通過
- 證據：source lifecycle 抽成獨立 helper，publisher 不再直接把未管理 ReadStream 交給 SDK。main／server 的 lease 使用既有本機認證，沒有擴張 renderer 至任意路徑／URL。canonical-root 比對與 release 不依賴目前 projectFolder，避免設定切換後釋放錯誤；history 使用 root SHA-256 檔名，紀錄本身不寫 root 字串。
- round1 固定 CDP port 建議已處理：`scripts/verify-youtube-ui.mjs:26–28,62–68` 以新 profile、remote-debugging-port=0 及該 profile 的 DevToolsActivePort 發現 endpoint，避免原固定 19437 選到別的 app；本輪實際 smoke 使用此路徑成功。
- `node --check server.mjs`、`node --check electron/main.mjs`、`git diff --check` 均通過；YouTube suite 內 publisher／renderer syntax 亦通過。既有大量其他工作樹差異未修改、未作本輪全面重新審查。
- 非阻擋後續建議：保留通用 IPC 去敏邊界，但可另以固定 error code 區分 lease／OAuth／儲存失敗，提高使用者操作指引品質。沒有必要為此擴大本輪修正範圍。

## 5. 測試覆蓋
- 判定：通過
- 證據：2026-10-16 07:25–07:27 UTC 自行執行下列限定範圍驗證：
  - `npm run project:preflight -- --type=development` exit 0。
  - `npm run test:youtube` exit 0，含 publisher、SDK serialization、source streams、真實隔離 server lifecycle 四份 suites，四份均印 passed。SDK suite 驗證 videos.insert／captions.insert／captions.update multipart、private metadata、notifySubscribers=false 與 onUploadProgress，不使用 Google endpoint。
  - `node scripts/verify-youtube-ui.mjs` exit 0，終端明示 `screenshot=false`／`No Google requests`。
  - reviewer helper stdin 三案 exit 0，非配合 adapter 的取消等待約 2002ms。
  - `node scripts/test-electron-main.mjs` exit 0，乾淨 profile 不觸發 Keychain 基線通過；不等於真實加密 round-trip。
  - `npm run docs:check` exit 0，19 個治理文件；`git diff --check` 無輸出，兩個新增邊界相關 runtime syntax checks exit 0。
- 依需求方限制未重跑含 Ollama 的完整舊 suite，沒有啟動 Ollama；`npm run check` 全套 exit 0 僅記為主代理提供證據，非審查端自行重跑。就本輪三項修正而言，獨立 focused 覆蓋足以解除原阻擋。
- `npm run docs:check:final` 在本報告建立前執行 exit 1，原因為最新條目仍進行中、當時最新已連結報告仍是 round1 不通過。此為尚待主代理整合的結案關卡；不得宣稱 final gate 已完成。

## 6. 實際運行結果
- 判定：通過
- 證據：自行 source Electron smoke 使用隔離 profile、真實 preload／main IPC、實際檔案清單與 traversal 拒絕；modal、未連結／未同意狀態、識別欄位、Studio link、completed＋syncing／partial＋failed 的本機 fixture 均通過。它沒有取得 OAuth token 或發送 Google 請求。
- 唯讀檢視開發端 v3 截圖時確認狀態列位於 scroll 以下；需求方最後只調整 verifier 的截圖分支，在 `scripts/verify-youtube-ui.mjs:109–112` 拍攝前捲到底部，runtime 未改。07:28 UTC 自行檢視 `docs/project-management/evidence/2026-10-16-youtube-private-upload-ui-v4.png`，能直接看見 `影片 ID：ui-video-1`、`字幕狀態：syncing`、`字幕 ID：ui-caption-1`、未勾選同意、操作按鈕與 Studio link。
- v4 screenshot 與拍攝分支由唯讀 source／圖片核對；審查端未另執行帶 screenshot 參數的重播、沒有新增 evidence，v4 smoke exit 0 為開發端證據。本輪自行 smoke 不帶參數，與最後修改的 screenshot-only 分支相互補充。
- 實測結論只適用於 source MVP、本地 adapter／HTTP 與 Electron UI fixture；背景合成無效影片的波形／AI task 訊息不作媒體或 AI 成功證據。沒有真實 Google、Keychain、安裝包、Windows 或遠端 processing／serving 驗收證據。

## 綜合判定
- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 round2 獨立複審結論為有條件通過：round1 的 B1 專案刪除競速、B2 來源串流錯誤及 B3 影片 ID／字幕狀態呈現三項阻擋已由獨立 focused 測試與 source Electron UI 驗證解除，未發現新增程式阻擋；主代理仍須整合本報告並通過 final gate，且不得將本輪證據擴稱為真實 Google、Keychain、封裝或 Windows 驗收。**
- 阻擋問題（若有）：本輪範圍內沒有剩餘程式阻擋。結案流程尚須主代理更新 08 的 round2 連結／逐字結論、完成狀態及實際驗證，並重跑 `npm run docs:check:final`；審查端沒有修改該來源文件或替其宣告 final pass。
- 剩餘風險：真實 Google／Keychain／封裝／Windows 未驗收；syncing 不等於 serving；未知影片結果仍須 Studio 人工核對；lease 取得／釋放回應遺失可能殘留鎖定，需重啟恢復；不支援跨重啟 byte-level 續傳。config history 保留摘要不等於還原已刪專案／snapshot，雙儲存位置也不構成跨檔交易；一般磁碟故障及外部同路徑替換的完整故障矩陣未驗收。以上不改寫為本輪已測通過。
- 給主要開發代理的具體修正要求（若有）：無新增 runtime 必修；整合本報告、保留 round1 與全部歷史 evidence，完成 final gate 並如實保留上述範圍。若後續改變 runtime，依影響補驗與另輪複審。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
- 簽署：Codex 獨立上下文審查代理，2026-10-16。
