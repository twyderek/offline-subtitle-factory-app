# 獨立審查報告：已安裝版與開發版介面再次複核

- 審查對象 commit／版本：codex/0.51-anthropic-claude dirty worktree；已安裝 /Applications/離線字幕工廠.app 與 source 版本皆 0.51.0，bytes 不同。
- 對應 08-CHANGE-LOG 條目：2026-10-19 — 已安裝版與開發版介面再次複核。
- 審查輪次：round2；保留 round1 原件。
- 審查代理啟動時間、上下文來源：2026-10-19 01:57 UTC 前開始，獨立審查上下文；承接本人 round1，依使用者新增 native 範圍、debug preflight、已讀核心與必要路由、目前腳本及 v4 原始證據複核，未沿用開發代理對話記憶。
- 可執行計畫：核對 native 分支與隔離／清理；讀四張實際 App 圖片及兩組 JSON；重算 executable／main／public hashes 與 PNG 尺寸；檢查 round1 缺口；建立唯一 round2 報告並執行格式驗證。以上已完成。

## 1. 需求完整性

- 判定：通過
- 證據：使用者確認現行軟體為 /Applications 版，08-CHANGE-LOG.md 最新條目「需求方補充與計畫調整」新增實際 executable 與 source 各自隔離啟動；06-TEST-AND-PROCESS-AUDIT.md 本日再次複核條目列 native-installed-v4／native-source-v4 指令。scripts/verify-youtube-ui.mjs:16–40 選擇真正已安裝 executable 或 source Electron，分別使用新 profile；native 分支直接執行 home／review 基本任務，不要求安裝版不存在的 YouTube UI。round1 的原生 runtime 對照缺口，在「預設視窗、合成資料、基本任務」限定範圍已有實際 App 證據補足；完整產品驗收不在此判定內。

## 2. 邏輯正確性

- 判定：通過
- 證據：scripts/compare-installed-ui.mjs 的 nativeVersion 條件不安裝 Fetch 攔截、不執行 Emulation.setDeviceMetricsOverride，只導航實際 App 的 home／review；runner 使用該 App 自有 DevToolsActivePort 選擇 renderer。electron/main.mjs:129–150、662–680 顯示自己的 BrowserWindow、preload 與 userData jobs／config server；installed main 的對應 createWindow／server 路徑獨立於 source。v4 JSON mode 分別為 native-installed-app／native-source-app，並非前端替換模式。2026-10-19 01:57 UTC 後獨立 SHA-256 核對兩版 executable、mainScriptHash 與五組 public hashes 均符合現有實體檔案。此為靜態身分核對及 runner 路徑佐證，不是完整 build provenance 或 runtime 所有載入 bytes 證明。

## 3. 邊界情況

- 判定：部分通過
- 證據：v4 原始 JSON installed home／review content=1400×817、outer=1400×849；source content=1400×819、outer=1400×851。PNG IHDR 分別為 2800×1634／2800×1638，符合內容尺寸的 2 倍像素，不包含 OS 視窗框。requestedWindow=1400×900 是預設設計值，native 分支未透過 CDP 請求此尺寸，不能稱實際內容尺寸或 resize 驗收。06 所載「outer皆1400×849」與 source v4 JSON 不符，應由主代理更正為 1400×851；不影響主配置診斷，但不能引用錯誤的等尺寸敘述。1100×700 BUG-049 仍由前輪 viewport 證據支持，未修正，也未由 native 預設視窗重測解除。原生 resize／OS 縮放未覆蓋。

## 4. 程式碼品質

- 判定：通過
- 證據：runner native 以 detached 自有 child.pid 建立及清理程序群組；lib/process-group-cleanup.mjs:1–86 以群組探測、SIGTERM、有界等待、必要時 SIGKILL 與最終不存在判定收尾。runner finally 要求 groupClosedConfirmed 才刪除新建 profile，並以 wx 新建 cleanup.json；不以使用者 PID 作清理目標。helper 的 editAndSave(original) 後新增導航及原值 until 查證，round1 指出的還原驗證缺口已補；compare-installed 單獨旗標也納入真實合成 MP4 生成條件。兩支工具 node --check 本代理執行 exit 0。保留非阻擋改善：helper 頂部「never launches installed app」註解已不適用 native 模式；早期 setup 仍在 try 前，異常時暫存清理不完整；旗標互斥未驗證，測試應使用本輪明確指令。這些不推翻已核對的成功路徑。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：主代理提供 node scripts/verify-youtube-ui.mjs docs/project-management/evidence/2026-10-19-native-installed-v4.png --installed-native 與對應 native-source-v4.png --source-native 均 exit 0；另最新完整 npm run check、syntax／diff exit 0 為主代理驗證，本代理未重跑，不冒稱本人實測。本人於 2026-10-19 01:57 UTC 後執行 SHA／JSON／PNG invariant 檢查 exit 0，檢查四張圖片、兩組 comparison／cleanup JSON 並完成 syntax exit 0。兩份 cleanup 的 groupClosedConfirmed、groupAbsentAfterCleanup、profileRemoved 均 true，forcedCleanup 均 false。此為保存清理結果與實作契約核對，未另行還原歷史程序群組；未以比較 JSON 單獨推定程序 exit 0。本代理沒有再啟動 Electron，避免與主代理驗證並行；final gate 留主代理整合後執行。

## 6. 實際運行結果

- 判定：部分通過
- 證據：已目視 evidence/2026-10-19-native-installed-v4.png.installed-home-1400.png、installed-review-1400.png，以及 source-v4 對應兩張圖；皆為實際 App renderer，首頁有合成專案，校閱頁為側欄、左播放器、右編輯器，source 新增 YouTube 頂列入口，兩版原生皆可見載入 SRT／規則等入口。不能把前輪前端替換模式圖片當成本輪 native 圖片。兩份 v4 comparison.json 記錄播放 duration=3，installed currentTime=0.000487、source=0.000391，tasks.editSaveReloadRestored=true；現有程式在編輯保存重載與原文還原後再重載均檢查 textarea 值，支持原生基本任務成功。這是合成短片、單 cue、程式驅動操作，未測轉錄、完整影音輸出或一般使用者任務成功率。v1 不支援 Browser.getWindowForTarget、installed-v2 收尾 timeout 的失敗依主代理紀錄保留，不當作完整成功；v3／v4 成功及 cleanup 不抹除歷史失敗。主代理回報原 App PID1969 仍運行，本代理未操作該程序。

## 綜合判定

- 結論：通過
- 可逐字引用的完整結論句：**本輪 round2 獨立複審通過僅表示診斷證據完成：已安裝 App 與 source 各自原生預設視窗的首頁、校閱、合成影片播放、譯文保存重載及還原後重載已有可追溯證據，身分雜湊與清理紀錄核對通過；實際內容尺寸不同、原生 resize 未驗證且 BUG-049 仍未修正，因此不代表產品整體可用性通過或可交付。**
- 阻擋問題（若有）：本輪限定 native 基本任務診斷無新增必修程式阻擋；BUG-049 仍阻擋整體可用性通過，完整產品驗收缺口保留。文件結案前須更正 06 的 source outer 高度，並整合 round2、完成 final gate；本代理不修改治理來源文件。
- 剩餘風險：兩版預設視窗高度不完全一致，不能稱像素精確對照；未驗證原生三尺寸、OS 縮放、使用者既有 profile、真實 Google／Keychain／上傳、完整轉錄／匯出、新開發版安裝包或 Windows。沒有封包級外連監測。native 路徑繞過 YouTube 測試，不代表本次 native 重新通過 YouTube 全套案例；前輪 source 測試仍屬不同範圍。首頁標籤仍可見 0.50.0 文案，不可替代 package／executable 身分。主代理最新完整 check 結果與本代理證據核驗分開歸屬。
- 給主要開發代理的具體修正要求（若有）：更正 06「outer皆1400×849」為 installed 1400×849、source 1400×851，採 v4 原始值；整合 00／06／08 時區分實際 App 預設視窗與前輪三尺寸 viewport，標明原生基本任務完成而非完整產品 pass，保留早期失敗與 round1 原件。引用本報告完整結論句後完成 docs:check:final；不因診斷通過關閉 BUG-049，不要求本輪修改產品。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪未啟動 installed／source Electron，未接觸使用者 profile、Google／Keychain，未打包、提交、推送或修改主代理 08；round1 與歷史 evidence 均保留。
- 若上述聲明不實，本報告無效。
- 簽署：Codex 獨立六面向審查代理，2026-10-19。
