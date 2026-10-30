# 獨立審查報告：FR-027 介面一致性與可用性複核

- 審查對象 commit／版本：0.51.0 dirty worktree，HEAD `299ff5d4288b9d50e356db8b0a5ae349dcb23ebc`；不是該 commit 的乾淨建置。驗證工具 SHA-256：`8f63a4d624fdadf8c2a13024db69dfea7c8fd2fda5fc71b7c45b8c548260e5c0`。
- 對應 08-CHANGE-LOG 條目：2026-10-16 — FR-027 介面一致性與可用性複核（第 3–22 行）。
- 審查輪次：round2（僅治理格式複審；round1 原件保留）。
- 本輪複審時間與範圍：2026-10-16T07:43:48Z；沿用 round1 已驗證事實、證據及診斷條件。以下產品／UI 實測均為 round1 歷史結果，本輪未重跑 UI 或產品測試，只修正報告格式並直接呼叫 validateReviewReport。
- 審查代理啟動時間、上下文來源：2026-10-16，獨立查核紀錄 UTC 07:40–07:42；本次使用者交付的獨立審查上下文，未沿用主要開發代理對話記憶。主代理提供的數值視為待查證陳述。
- 審查計畫：讀取 debug preflight 路由與本輪紀錄；靜態查核隔離及外部呼叫路徑；獨立重跑 focused suites／audit；比對 baseline 與 PNG／JSON；依六面向判定，只建立本報告。
- 範圍：診斷，不授權產品修正、真實頻道操作、Keychain 驗收、Ollama 操作、打包或發布。既有 dirty changes 跨越多個工作，不能把全部 git diff 當成本輪產品變更。

## 1. 需求完整性

- 判定：通過（限定診斷範圍）。
- 證據：`08-CHANGE-LOG.md:7–15` 明確要求比較保留 baseline、真實合成媒體與初次使用／錯誤；`06-TEST-AND-PROCESS-AUDIT.md:3–9`、`07-DEBUG-AND-FIX-HISTORY.md:3–18` 記錄實際發現及限制。`03-FUNCTIONAL-DESIGN.md` 的 FR-027 設計是私人影片與字幕 MVP，不能作為已完成真實端到端驗收的證明。
- 本輪回答了 source 開發版哪些差異有據、有哪些可用性障礙，且沒有藉診斷修改產品。使用者實際開啟的版本與頁面未識別，故尚不能宣稱已完整解釋使用者看到的所有差異。

## 2. 邏輯正確性

- 判定：通過（保留證據強度限制）。
- 證據：2026-10-16 UTC 07:40 的獨立 `shasum -a 256`：source 與 `/Users/nycu/Documents/離線字幕工廠/dist/release-0.51.0-macos-53956cc/mac-arm64/離線字幕工廠.app/Contents/Resources/app/public/styles.css` 均為 `a75c3284e181336c243e7317e945db9d46712ea10c0d7a92cc02192eff0a9bd3`。`diff -u` 的 review.html 僅新增 `openYoutubePublish` 與 module script 兩行（diff exit 1 為有差異的預期結果）。這支持「不是整套校閱 HTML/CSS 重寫」，不證明 review.js、所有 runtime 或使用者安裝版完全一致。
- `public/youtube-publish.mjs:5–34` 使用 inline dialog 樣式與沒有 review-button class 的按鈕；獨立量測確認既有按鈕 14px／700／8px 圓角、新按鈕 16px／一般字重／0px 圓角。BUG-046 的局部一致性診斷有據。
- `public/youtube-publish.mjs:78,87–108`：perform catch 寫入操作錯誤，但 1500ms poll 的 refresh 無條件重寫 progress。獨立重現未設定 OAuth 時錯誤先顯示，等待 1900ms 後成為「準備上傳。」；BUG-047 因果鏈有據。1900ms 是觀察等待時間，不是精確的錯誤存續時間。
- 1100 寬下 entry.right=1177，暫隱藏 YT 後舊 export.right 仍為 1177。足以否定「新增 YT 按鈕是整體溢出的唯一原因」；尚未在 baseline runtime 同 viewport 重播，不足以獨立證明公開版本實機必然同樣溢出。BUG-048 的「既有」應以這個限定解讀。

## 3. 邊界情況

- 判定：部分通過（已量測邊界充分支持發現，不代表完整可用性驗收）。
- 證據：獨立 audit 實測 1400／1280／1100／1024×800；前三者 modal clientHeight=678、scrollHeight=1098，上傳 top=1007.828125、關閉 top=1090.828125，初始 scrollTop=0 時位於首屏下方。應描述為需捲動及可發現性問題，不能描述為完全無法點擊或不能關閉。
- `electron/main.mjs:133–134` 的最小視窗為 1100×700；1024 不在支援最小寬度內，700 高未重測。harness 使用 CDP Emulation.setDeviceMetricsOverride，是 renderer viewport 量測，不等同原生 BrowserWindow resize、不同 OS 顯示縮放或實體螢幕驗收。
- 實測未連結／未同意 disabled、traversal 拒絕、completed+syncing／partial+failed fixture、關閉 dialog。未測完整鍵盤／焦點／Esc、螢幕閱讀器、長檔名／長文案、縮放及安裝版；不因此宣稱通過無障礙或所有正常操作。
- `reviewStatus` 的「找不到 AI 優化任務」在既有及重播 JSON 一致，源自沒有 AI task 的 fixture；不是本輪證明真實 AI/Ollama 故障。

## 4. 程式碼品質

- 判定：通過（診斷工具；有非阻擋改善項）。
- 證據：`scripts/verify-youtube-ui.mjs:12–38,65–95,111–183`：自有 mkdtemp profile、自有合成 job、動態 DevToolsActivePort、loopback CDP、exclusive-create evidence、finally SIGTERM 與 profile 清理。沒有產品檔案寫入；暫隱藏入口僅修改測試 renderer DOM。
- 合成檔案確由本機 ffmpeg lavfi color+sine、libx264／AAC、3 秒產生，非使用者影片；audit 增加真實解碼／muted 播放，但 completed／partial 的 videoId／captionId 仍由本機 JSON 注入，非實際發布。
- `lib/youtube/publisher.mjs:60–65,164–173` 在新 profile 無 secretFile 時先返回／拒絕，早於 safeStorage、開啟 OAuth 瀏覽器、getToken、channels.list；harness 未呼叫 configure/start/retry 或點 Studio。`electron/main.mjs:76–94` 乾淨 profile 的 AI key 讀取／migration 也在檔案不存在時先返回。本次沒有操作真實 Google、Keychain 或 Ollama。
- `googleRequests:false` 是 `scripts/verify-youtube-ui.mjs:114` 寫死的敘述，沒有封包監測或程序樹 egress 阻擋。可由上述路徑支持「本次未發起 Google 授權／上傳」，不可宣稱「已證明整棵程序樹完全無外連」。環境由 process.env 繼承，也不是全機離線驗收。
- 非阻擋工具缺口：profile 建立、ffmpeg 與 child spawn 在 try/finally 之前，早期失敗可能遺留暫存；JSON 缺執行時間／source hash／cleanup 結果；只驗證 child 結束，沒有完整後代程序／port 清理證明。成功重播不補足所有失敗清理情境，後續維護工具時可改善，無須本輪越權修改。

## 5. 測試覆蓋

- 判定：通過（診斷所需驗證）；產品可交付覆蓋不通過。
- 證據：2026-10-16 UTC 07:41，獨立執行 `npm run test:youtube` exit 0：publisher PKCE/state/拒絕/逾時/private/partial/retry/cancel/restart/path/redaction；SDK 本地 transport；四組 video/caption source faults；隔離 HTTP lease/delete lifecycle 全通過。靜態核對 suites 使用假 safeStorage、FakeAuth 或本地 SDK adapter，OAuth callback 與 lifecycle HTTP 限自有 loopback；不觸及真實 Google／Keychain。
- 同時獨立執行 `node --check scripts/verify-youtube-ui.mjs` 與 `git diff --check` 均 exit 0。本審查未重跑完整 npm run check，不把主代理以前的完整回歸寫成本次 reviewer 實測。
- audit exit 0 僅表示量測與 smoke assertions 完成；樣式、fold、錯誤保留是記錄結果，並非已設可用性通過門檻的 assertions。mock suites 通過不能推導產品可用性通過。

## 6. 實際運行結果

- 判定：通過（本機 source 診斷重播）；不涵蓋真實外部流程。
- 證據：2026-10-16 UTC 07:41，獨立執行 `node scripts/verify-youtube-ui.mjs /tmp/fr027-independent-usability.A4RtAQ/audit.png --usability` exit 0；工具輸出 audit captured 與 UI smoke passed。合成影片 duration=3、currentTime=0.207512、paused=true。四個 viewport 的尺寸、按鈕樣式、首屏位置、1100 溢出及錯誤覆蓋與 v2 JSON 一致。
- 唯讀目視 `docs/project-management/evidence/2026-10-16-youtube-usability-audit-v2.png`：1280×800 原有藍色校閱頁後方、新 dialog 內原生樣式按鈕、長設定說明與底部操作不可見，與量測相符；單張截圖不呈現全部 viewport，也不直接展示時間序列。
- 原 v2 PNG SHA-256：`dfa788f0275005f1e2451d8a5499268bb723c57c02752134985046420f0cb80c`；JSON：`442e5d460656e5f00a3c224e82e14a021f232f69578ca0b118348f1d26b5070b`。獨立重播 JSON SHA-256：`20d3853391fc1027d03eeb3559b110ed1c97533fc0ad673e3790a25e7cfe7ec6`，存於上述 /tmp 路徑；播放時間差異合理，未覆寫專案 evidence。/tmp 非永久證據，持久依據為本報告的指令／時間／數值與原 v2。

## 綜合判定

- 結論：有條件通過（僅本輪診斷）；產品可交付可用性不通過。
- 可逐字引用的完整結論句：**FR-027 本輪介面一致性與可用性診斷已完成且主要發現經獨立重現，審查有條件通過，但開發版 YouTube 功能尚未達可交付可用性，不得以 audit 或既有 mock 測試通過替代產品驗收。**
- 阻擋問題（若有）：本輪診斷無新增必修產品程式阻擋；產品交付仍受 BUG-046／047 的一致性、操作可發現性與錯誤保留問題、支援寬度下的入口溢出，以及真實 Google／Keychain／安裝版驗收缺口阻擋。本輪不授權修正或接受產品風險。
- 條件：主代理將本報告原句與範圍完整引用至最新工作條目，補實際修改／驗證與本輪 final gate 結果；保留「使用者實際版本未確認」「viewport 模擬」「無網路監測」「baseline 未同場 runtime 比對」等限制，不將 BUG-048 寫成 YT 新引入的整體 toolbar 回歸。
- 診斷完成與治理結案分開：round1 建立時最新 08 仍進行中且結果欄待補；本輪只驗證報告格式，不重新判定最新 08 狀態，final gate 由主要代理整合後收斂。
- 審查結案檢查：2026-10-16 UTC 約 07:42，`npm run docs:check:final` exit 1；實際訊息為最新 08 未標示完成、獨立審查是否執行須為是或否。這是主代理尚未整合本報告的治理待辦，不是產品通過證明；審查代理依唯讀限制未代改 08。
- 剩餘風險：尚不能判定使用者所見差異的完整根因、既有全部功能可用性、真實上傳成功／字幕 serving、跨平台或安裝升級可用性。樣式／首屏診斷有據，不等於一般使用者完成任務的成功率研究。
- 給主要開發代理的具體要求：先完成診斷紀錄與限制揭露；若後續取得修正範圍，另行處理 BUG-046／047／048 並驗證支援尺寸、錯誤保留、鍵盤及實際安裝版；真實 Google／Keychain 驗收須有相應授權。本輪勿修改產品程式。

- 本輪格式驗證：直接呼叫 `scripts/project-docs-validator.mjs` 的 `validateReviewReport` 驗證本 round2；實際結果由本輪工具輸出確認，未以產品測試替代格式驗證。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- round1 重播工具僅在自有系統暫存 profile 與 /tmp 輸出合成資料／截圖／JSON；未操作使用者專案、真實 Google、Keychain 或 Ollama，未打包或發布。
- 若上述聲明不實，本報告無效。
