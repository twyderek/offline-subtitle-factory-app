# 獨立審查報告：FR-027 YouTube 私人影片與字幕上傳 MVP

- 審查對象 commit／版本：0.51.0，HEAD `299ff5d4288b9d50e356db8b0a5ae349dcb23ebc` 上的未提交工作樹；不是該 HEAD 已包含此功能。
- 對應 08-CHANGE-LOG 條目：2026-10-16 — FR-027 YouTube 私人影片與字幕上傳。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-10-16，獨立 Codex 審查上下文；來自需求方指派、補充邊界與現場檔案，未沿用開發代理對話記憶。實測時間窗約 07:07–07:14 UTC。
- 審查計畫：讀取 development preflight 核心／路由及最新 FR-027；檢視指定差異、實測 SDK／UI／故障邊界；建立本報告。未執行真實 Google 授權／上傳、Ollama、封裝或 OS 修改。
- 範圍：指定 publisher、renderer、兩支原始測試／驗證腳本、Electron IPC／preload／review HTML、package／lock、README／第三方聲明與 FR-027 治理內容；追加納入 `scripts/test-youtube-sdk.mjs`。既有 server deleteJob 僅作相關邊界查證。
- runtime 識別：`lib/youtube/publisher.mjs` SHA-256 `2df4839ad0ecccde25de13caaff7777da79947307ee0328aeb701b5a233012f4`；`public/youtube-publish.mjs` SHA-256 `62e3ca0d170569d91b558844ec0f5fc5a2be43ebb50c331ee424727724d26302`。治理與 package 在審查期間由主代理同步，因此不以先前 package hash 固定最終內容。

## 1. 需求完整性
- 判定：部分通過
- 證據：`02-REQUIREMENTS-ANALYSIS.md:44–46`、`03-FUNCTIONAL-DESIGN.md:5–9` 定義 Desktop OAuth、明確同意、private、頻道核對、防重複與狀態顯示。`lib/youtube/publisher.mjs:151–197` 實作 ephemeral 127.0.0.1 listener、state、S256 PKCE、系統瀏覽器與逾時；`:66–85` 使用 safeStorage、0600 與原子置換；`:235–245` 檢查同意、既有紀錄及原頻道，`:283–284` 再向 API 核對頻道，`:301–304` 固定 private／notifySubscribers=false。字幕重試只進字幕路徑，未重新呼叫 videos.insert。
- 缺口 B3：`public/youtube-publish.mjs:77–80` 僅顯示工作 state、百分比、message 與通用 Studio 連結；未直接顯示 `record.videoId` 或 `record.captionStatus`，不符合 FR-027 的「顯示影片 ID、字幕狀態」。例如 captionStatus=syncing 與 serving 都只顯示 completed 與相同訊息。要求的是本機已知 insert 回應狀態，不要求新增真實端點輪詢或 serving 驗收。
- 真實 Google、Keychain、安裝包、Windows 未驗收已在 README／00／06 明確揭露，屬本輪既定範圍限制，不據此追加產品阻擋。

## 2. 邏輯正確性
- 判定：不通過
- 證據：2026-10-16 07:11 UTC 的受控刪除競速測試重現 B1。`server.mjs:3083–3106` 的 deleteJob 只取消 server 管理的轉錄／trim／burn，沒有協調 main publisher；`publisher.mjs:90` 在工作中直接回傳快取 root，`:21–26` 的 atomicJson 會 recursive mkdir，`:129–131`、`:308–310` 及 `:336` 在刪除後仍能寫入。
- B1（P1，阻擋）：上傳期間刪除 job，publisher 隨後重建已刪除的專案根目錄並繼續流程。測試以假 auth／假 API 建立暫存 job，在 videos.insert 消耗影片後掛起，刪除 job，再釋放影片回應；輸出 `jobExistsAfterDelete false`、`jobRecreated true`、`remaining [ 'youtube-publish.json' ]`。這是 publisher 層對應 deleteJob 的 rm 行為重播，未呼叫實際 HTTP delete endpoint，也沒有外部上傳。測試字幕 adapter 未消耗媒體，故其 completed 輸出不作字幕成功證據；目錄重建已在字幕前保存 videoId 時發生，不依賴該假成功。
- 具體修正：由 main／server 建立可原子協調的同一 job 生命週期契約；刪除應先拒絕 active publish（409／清楚 UI），或 cancel 並等待 publisher 完成清理後才刪除。還須讓 publisher 的 persist 拒絕已刪除／已換代的 job，不可 recursive mkdir 復活根目錄；不要只在網路前 existsSync 一次。若刪除允許在遠端結果未知時完成，須另定不會遺失 videoId／未知結果的紀錄保存位置或明確阻止該刪除。補 source integration 與受控 async 回歸，確認刪除後沒有重建、沒有後續字幕請求、沒有失去防重複語意。
- SDK 使用核對：實際安裝 `@googleapis/youtube@40.0.1`／`google-auth-library@11.3.1`；新增 serialization test 自行執行通過，涵蓋 videos.insert 與 captions.insert／update 的 multipart、private metadata、notifySubscribers=false 和 progress。官方 [captions.insert](https://developers.google.com/youtube/data/reference/rest/v3/captions/insert) 與 [captions.update](https://developers.google.com/youtube/data/reference/rest/v3/captions/update) 支持目前 scope／媒體／update draft 欄位契約；這是文件與本地 adapter 證據，不是真實 API 驗收。

## 3. 邊界情況
- 判定：不通過
- 證據：既有 focused suite 自行驗證通過 state 錯誤、拒絕、逾時、未同意、非法語言／標題／madeForKids、traversal、symlink、錯頻道、取消、字幕部分成功、重啟 interrupted 與不可重傳影片。額外 B1 刪除測試在目錄復活後亦出現 `Unhandled 'error' event`／ENOENT，子程序 exit 1。
- B2（P1，阻擋）：`publisher.mjs:299`、`:318` 建立的 ReadStream 沒有 error handler／與請求失敗連動；installed `node_modules/googleapis-common/build/src/apirequest.js:155–183` 只用 `part.body.pipe(pStream).pipe(rStream)`，不會把來源 error 自動變成外層 await rejection。因此 snapshot 在開啟前被刪除、開啟失敗或讀取 I/O error 時，可冒出未處理事件，而不是進入 publisher catch／去敏終態；在 Electron main process 有程序中止及原始檔案路徑出現在 diagnostic 的風險。
- 獨立 SDK 最小重現：07:12 UTC 執行 `node --input-type=module` stdin，使用實際 SDK、只消耗 multipart 的假 auth request，沒有 socket：

```js
import fs from 'node:fs';
import { youtube } from '@googleapis/youtube';
const api = youtube({ version: 'v3', auth: { request: async options => {
  for await (const chunk of options.data) {}
  return { data: { id: 'fake' } };
} } });
try {
  await api.captions.insert({ part: ['snippet'],
    requestBody: { snippet: { videoId: 'fake', language: 'en', name: 'test' } },
    media: { mimeType: 'application/octet-stream',
      body: fs.createReadStream('/nonexistent-fr027-review-snapshot.srt') }
  }, { retry: false });
} catch (error) { console.log('caught-by-await', error.code); }
```

- 實際結果：沒有輸出 caught-by-await；Node v22.22.3 印出 `Unhandled 'error' event`、ENOENT、ReadStream stack，exit 1。這驗證來源串流錯誤未被 SDK Promise 接住；未宣稱已實測 Electron crash。
- 具體修正：在交付 SDK 前對影片與字幕 source 註冊錯誤處理，將來源錯誤傳遞至有界的工作 Promise／AbortController，確保請求與來源都結束、listener 移除、terminal persist 與 operation 解鎖；只加空 error handler 會留下卡住的 multipart，並不足夠。以子程序回歸測試 ENOENT／中途讀取錯誤，要求無 unhandled event／raw error、沒有假 completed、鎖定可恢復，既有 videoId 保留且不重傳影片。B1 修復不能取代一般 I/O failure 防護。

## 4. 程式碼品質
- 判定：部分通過
- 證據：main IPC 在 `electron/main.mjs:21–27` 核對 mainWindow、主 frame 與 loopback origin；原生 picker 限定匯入 JSON，renderer 不提供任意 URL／絕對路徑。publisher 對 job ID／basename／realpath 驗證，憑證不進 renderer；通用 SDK 錯誤被去敏。防重複採未知結果不重新建影片的保守策略，符合 MVP 範圍。
- 問題集中於跨 main／server 的 job 所有權與 stream／Promise 錯誤邊界，見 B1／B2。IPC 將所有錯誤統一成一則長訊息，會遮蔽安全儲存不可用、逾時等可操作原因；建議回傳受控 error code／固定安全文案，不回傳原始 SDK error。
- 非阻擋建議：`scripts/verify-youtube-ui.mjs` 固定 CDP port 19437，選到任何符合 loopback page 的 target，未驗證它屬於本輪 child；port 已被其他 Electron 使用時可能操作錯誤 profile／誤報結果。應改用動態 port 並核對 owned child endpoint，或啟動前 fail-closed 檢查占用；本輪重跑成功不代表已驗證此競速。
- lockfile 與 HEAD 同名既有 package 版本比對輸出 `existingDependencyVersionChanges []`，未觀察到既有版本升級；第三方聲明有新增 Google client 的 Apache-2.0 來源。

## 5. 測試覆蓋
- 判定：部分通過
- 證據：審查端於 2026-10-16 07:10–07:14 UTC 自行執行：
  - `npm run project:preflight -- --type=development` exit 0，確認 dirty worktree 並遵循路由。
  - `npm run test:youtube` 原 suite exit 0；07:14 UTC 納入新 `scripts/test-youtube-sdk.mjs` 後再次 exit 0，兩份 suite 均印 passed。
  - `node --check scripts/verify-youtube-ui.mjs` exit 0。
  - `node scripts/test-electron-main.mjs`、`node scripts/test-review-ui.mjs` exit 0。
  - `npm audit --omit=dev --json` exit 0，vulnerabilities.total=0。本輪未重跑完整 audit；全量 12 為需求方／開發端證據，不冒稱審查端實測。
  - 額外刪除競速測試與 SDK source-stream failure 重現均得到上述阻擋輸出；測試 fixture／profile 皆限自有暫存位置並清理。
  - `git diff --check` 無輸出；`npm run docs:check:final` 執行失敗，指出最新條目尚未完成與獨立審查欄位未整合，符合本輪仍在審查的現況，不可當作 final gate 已通過。
- 未重跑完整 `npm run check`：其既有 suite 包含 Ollama 受控 daemon 測試，需求方明確禁止本審查啟動 Ollama；完整回歸通過僅記為主代理提供證據。新 SDK test 是序列化測試，尚未覆蓋 source read error、刪除競速、publisher captions.list 命中後的 update 分支、token rotation／加密不可用或 UI 成功／partial 狀態呈現。B1／B2／B3 修正後需補對應 focused regression 並建立 round2。

## 6. 實際運行結果
- 判定：部分通過
- 證據：07:11 UTC 自行執行 `node scripts/verify-youtube-ui.mjs`（未提供 screenshot 參數），exit 0；隔離 source Electron 真實 preload／main IPC、檔案列表、非法 job ID、modal 開關、預填標題、未連結／未同意按鈕狀態通過。本次未新建截圖；腳本固定成功文案雖提到 screenshot，不代表無參數重跑有保存圖片。
- 另唯讀檢視 `docs/project-management/evidence/2026-10-16-youtube-private-upload-ui-v2.png`：可見私人影片說明、OAuth 匯入、已保存字幕／MP4 與表單。背景 fixture 有 AI 狀態恢復／無效影片波形訊息，不把它當作媒體播放或完整上傳成功證據。
- 本輪受控 Node 邊界測試證實 B1／B2；真實 Google OAuth、Google request、遠端 processing／serving、Keychain round-trip、安裝包與 Windows 均未操作／未驗收。以上限制不要求在本輪擴大驗收。

## 綜合判定
- 結論：不通過
- 可逐字引用的完整結論句：**本輪 round1 獨立審查結論為不通過：FR-027 的私人上傳、OAuth 與本地 SDK／Electron UI 基線已具驗證證據，但專案刪除競速會重建已刪目錄、來源串流讀取錯誤未受控，以及影片 ID／字幕狀態未直接顯示三項阻擋尚未修正；本輪沒有真實 Google、Keychain、封裝或 Windows 驗收證據。**
- 阻擋問題（若有）：B1（P1）刪除 job 與 active publisher 未協調、persist 復活目錄；B2（P1）影片／字幕來源 stream error 可成為未處理事件；B3（P2）FR-027 影片 ID／字幕狀態呈現缺漏。
- 剩餘風險：真實 Google／Keychain／封裝／Windows 依既定範圍保留；caption syncing 不等於 serving、未知影片結果只能 Studio 人工核對、跨重啟 byte-level 續傳不支援。CDP ownership、受控錯誤分類及其餘測試缺口如前述；本輪不要求外部頻道驗收。
- 給主要開發代理的具體修正要求：優先修 B1 共同生命週期與 B2 source-error 傳遞／清理，再補 B3 的 textContent 呈現與 UI regression。保留本 round1 原件；將修正與驗證寫入既有工作條目，建立 round2 複審，最後由主代理整合引用並重跑 final gate。本審查不修改產品程式或治理來源。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
- 簽署：Codex 獨立上下文審查代理，2026-10-16。
