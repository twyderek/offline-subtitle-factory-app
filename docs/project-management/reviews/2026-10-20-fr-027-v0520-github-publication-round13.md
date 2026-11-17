# 獨立審查報告：FR-027 v0.52.0 GitHub 公開發布 round13

- 審查對象 commit／版本：`21d8b077b0bb25af02de5562e000660f6912bef3`／`0.52.0`。
- 分支：`codex/0.51-anthropic-claude`；本機 `HEAD` 與遠端同名分支均指向上述 commit。
- 候選目錄：`../dist/release-0.52.0-macos-21d8b07-normal/`。
- 對應 08-CHANGE-LOG 條目：`docs/project-management/08-CHANGE-LOG.md`，2026-10-20「FR-027 v0.52.0 round12 blocker 修正與最終來源複核」。
- 審查輪次：round13。
- 審查代理啟動時間、上下文來源：2026-10-20 UTC；由需求方直接在本獨立上下文指定來源、候選、CI run 與審查範圍。精確啟動秒數未保留於命令紀錄；完成狀態核對時間為 `2026-10-20T05:56:12Z`。round12 僅作為待核歷史 blocker 記錄；來源、候選、CI、文件與 GitHub 狀態均重新讀取或查證，未沿用其結論。
- 範圍：唯讀六面向發布前審查；沒有建立 tag／Release、上傳資產或推送內容。除建立本報告外，未寫入其他檔案。

## 1. 需求完整性

- 判定：通過。
- 證據：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:44-46` 將 FR-027 定義為明確同意後的 YouTube 私人影片／字幕上傳 MVP，並明列不含公開／排程、跨重啟位元組續傳、多頻道及縮圖；真實 Google／封裝驗收另追蹤。發布授權記於 `docs/project-management/08-CHANGE-LOG.md:22-27`，範圍是 macOS arm64 資產，涵蓋提交／推送、tag／Release 與已列資產，接受需揭露的 Google／Keychain、advisory 及簽章風險，並明確排除 Windows preview 與略過測試／審查／hash gate。`docs/project-management/09-STANDING-AUTHORIZATIONS.md:5-14` 的 `AUTH-2026-07-23-01` 支持未 Developer ID／未公證發布，但不豁免其他 gate。
- 隱私公開例外僅限 round12 報告：`git grep` 對目標 commit 的追蹤檔掃描確認該報告 `:5` 有一處具體候選目錄個人絕對路徑，另有一個中性合成測試 fixture；沒有發現第二個具體個人 home 路徑。`README.md:17` 與 `RELEASE-NOTES-0.52.0.md:23` 都揭露單一報告例外及其限縮範圍；需求方的原樣公開核准記於 `08-CHANGE-LOG.md:27`。本報告不重複該路徑。
- `README.md:5-17`、`RELEASE-NOTES-0.52.0.md:20-25` 如實限定 macOS arm64、排除 Windows 發行資產，揭露真實 OAuth／Keychain／頻道／影片字幕上傳未驗收、UI smoke 未證明有效播放／完整轉錄、ad-hoc／未公證及 `GHSA-hp3w-g68c-fv3c` moderate build-time advisory（production audit 0）。

## 2. 邏輯正確性

- 判定：部分通過。
- 證據：`git rev-parse HEAD`、遠端 branch ref 與候選 `PROVENANCE.txt:1-3` 均對應 `21d8b077b0bb25af02de5562e000660f6912bef3`；GitHub Actions run `39376042653` API 的 `head_sha` 亦完全相同。候選 DMG／ZIP 修改時間分別為 `2026-10-20T13:39:47+0800`、`13:40:05+0800`，在來源 commit `13:39:02+0800` 之後；run 於 `05:39:16Z` 啟動、`05:43:11Z` 完成。這支持候選及 Windows CI 的來源與時序一致。
- 靜態檢視 `lib/youtube/publisher.mjs:30-41,58-87,90-103,164-210,249-280,303-377`：要求使用者同意、用 safeStorage 保存憑證、採 loopback／state／PKCE OAuth、限制專案與本機檔案邊界、固定私人影片、保存字幕 snapshot、禁止重複影片上傳並只提供字幕重試；`electron/main.mjs:21-27,69-72` 限制 IPC 呼叫來源且不把 SDK 原始錯誤回傳 renderer；`server.mjs:4299-4308` 以 lease 協調上傳與刪除。此次目標 commit 的差異是文件／報告，未改產品 runtime。
- 整體流程證據仍部分通過：候選及 run 精確對應新來源，但 `00`／`05`／`06`／`08` 尚未把這些結果同步成目前受控狀態（詳見第 6 節），且真實 Google 與 Keychain 行為未驗證，不能由 mock 推論實帳號流程正確。

## 3. 邊界情況

- 判定：部分通過。
- 證據：`scripts/test-youtube.mjs:96-169` 覆蓋缺同意／無效語言／非法標題／兒童內容欄位、OAuth 拒絕／逾時／錯誤 state、路徑穿越與 symlink、字幕部分成功與僅字幕重試、取消、重啟中斷、頻道不符、阻止重複影片上傳、敏感值不回傳及 disconnect；`public/youtube-publish.mjs:98-142,143-203` 對舊輪詢、檢視關閉／重開、影片清單改變、同意重置、活動中控制及取消／字幕重試設有狀態處理。精確來源 run `39376042653` 的 `npm run check` 步驟成功。
- 候選 UI smoke `youtube-ui-smoke.png.json` 顯示 renderer fixture 通過 12 案、`googleRequests=false`、cleanup 的 process group/profile 已移除且未強制清理；3 秒合成影片 `currentTime=0.000187`、`paused=true`。`youtube-ui-smoke.png.comparison.json` 記錄 `currentTime=0.000283`。這些數值不構成有效播放、全長轉錄或外部上傳邊界驗收；此限制已在 README／Release notes 揭露。真實 OAuth／Keychain／遠端未知結果仍未覆蓋。

## 4. 程式碼品質

- 判定：通過。
- 證據：`git show --stat HEAD` 顯示本目標 commit 只包含 README、Release notes、`00`／`05`／`06`／`08` 與 round12 review 文件差異，沒有產品程式碼差異。對現有 FR-027 核心程式作唯讀檢視，憑證留在 main process、輸入及檔案路徑有驗證、token／原始 SDK 錯誤不回傳 UI、影片與字幕上傳紀錄採部分成功／取消／中斷狀態，媒體 stream 錯誤由 `lib/youtube/media-stream.mjs:4-39` 明確傳遞及清理。候選 packaged UI／runtime 對應版本與來源，未發現本輪文件差異改變產品行為的跡象。
- `git diff --check HEAD^ HEAD` 無 whitespace error。此判定是對目標來源及既有實作的靜態檢視，不代表真實 Google 整合測試。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：GitHub Actions run `39376042653`，job「Windows x64 test and package」，`2026-10-20T05:39:18Z` 至 `05:43:11Z` 成功；step「Run source and real FFmpeg regression tests」執行 `npm run check` 並成功。目標 commit 的 `package.json` `check` script 包含 `docs:check`、語法檢查及 `npm test`；`test` 包括核心回歸，`posttest` 執行四套 YouTube suites。簽章 Windows build 因沒有憑證而 skipped，unsigned internal preview 建置、packaged renderer/install lifecycle、archive/hash 與 artifact upload steps 成功。
- 在 `../dist/release-0.52.0-macos-21d8b07-normal/` 重新核對：`shasum -a 256 -c SHA256SUMS-macos-arm64.txt` 四項均 OK；DMG `hdiutil verify` 為 `VALID`；ZIP `unzip -tq` 無錯；`codesign --verify --deep --strict` exit 0。DMG 為 262,456,410 bytes、SHA-256 `7b8249561f805cf18e67e432a8b3a9ccb1d4e6139a5769e2a4ade707c4096018`；ZIP 為 256,484,567 bytes、SHA-256 `baff4e76a666c8e78d3ab8cd0d9d0fdbd6c3425536fac750e63a9443e4354426`。兩個 blockmap 分別為 275,319 bytes／`cbfb1c115d007d89ee277927995b0d68bb7b289685d1011bef42d578ed9f8019` 與 268,304 bytes／`3523e58e9ea5991f7b122b80c4402e70f950086f584a0ef837b28a45a566ccd6`；`latest-mac.yml` 的名稱、大小、SHA-512 與檔案相符。候選 `PROVENANCE.txt` 記錄 app 版本 `0.52.0`、arm64 Mach-O、runtime manifest 驗證通過及 ad-hoc signing。
- Windows run `39376042653` 的 artifact `12243556843` 為 `offline-subtitle-factory-0.52.0-windows-x64`，504,801,519 bytes，未過期。`windows-ci-source-manifest-range-check-39376042653.json` 記錄單一 500,000-byte ZIP 尾端 range、7 個 central-directory entries、manifest／checksum entry CRC 與 size 有效、manifest SHA-256 `9bf2044268a32f500806a2340b774acc71410fab4af9cc0c5c631c0044ab45da` 符合 artifact sidecar、73/73 共用 app 檔案 raw hashes 相同、0 mismatch。完整 Windows ZIP 未下載；此證據不支持 whole-archive integrity 或 Windows 實機驗收，也不把 unsigned preview 當成本次 Windows 發行資產。
- 本輪唯讀執行 `npm run project:preflight -- --type=release` 正常列出 release 路由；另執行 `npm run docs:check:final` 得 exit 1：`08-CHANGE-LOG.md` 最新工作紀錄未標為完成，且最新獨立審查為不通過。此為文件結案 gate 的實際失敗輸出，不等同產品回歸失敗。這兩項尚未完成與目前工作紀錄及流程順序不一致有關，見第 6 節。

## 6. 實際運行結果

- 判定：不通過。
- 證據：GitHub 唯讀 API 回報 run `39376042653` 為 `completed/success`，exact head SHA 為 `21d8b077b0bb25af02de5562e000660f6912bef3`；artifact `12243556843` 上傳成功。GitHub `releases/tags/v0.52.0` API 回傳 404，`releases/latest` 仍為 `v0.51.0`（`2026-09-22T09:01:17Z`）；`git ls-remote` 未列出 `refs/tags/v0.52.0`。因此尚無 v0.52.0 tag、Release 或公開 assets。README 的 v0.52.0 Release 連結目前尚未解析為已發布資產；`RELEASE-NOTES-0.52.0.md:29` 有提醒若頁面尚未出現該 tag，不要把開發候選當正式安裝包。
- **P1 — round12 BLOCK 尚未妥善關閉，受控紀錄落後精確來源。** `08-CHANGE-LOG.md:16-17,28-29` 仍寫 HEAD／origin 為舊 SHA、將新 SHA 的完整 check／候選／CI/hash gate 列為待執行，並明記 round12 BLOCK 尚未解除；實際 HEAD、macOS candidate 與 run／artifact 已是本報告目標 SHA。`00-CURRENT-STATUS.md:5-15`、`05-DEVELOPMENT-AND-DEPLOYMENT.md:6`、`06-TEST-AND-PROCESS-AUDIT.md:3-9` 仍以 `85203c8` 證據為最新並稱更新後 source 尚待重驗。這些受控文件沒有記錄本輪候選 hash、run `39376042653`、artifact `12243556843` 與 range 結果，故不能把實際證據當作已同步完成。`08-CHANGE-LOG.md:16` 的實際 HEAD 敘述亦與當前 branch ref 不符。
- **P1 — `docs:check:final` 時序文件仍互相矛盾。** 通用發布流程 `workflows/06-BUILD-RELEASE.md:9-21` 包含發布後資產核對，文件結案流程 `workflows/07-DOCUMENT-CLOSEOUT.md:5-13` 以部署結果為輸入並在結案步驟執行 final gate；因此 round12 最新工作項目 `08-CHANGE-LOG.md:11,13` 所寫「round13 通過後發布、核對 assets 後執行 final gate」符合一般 workflow。但同一 changelog 的前一 readiness 項目 `:39,41` 仍明文要求「round12 無阻擋且本就緒項目 `docs:check:final` 通過後」才可進入公開發布，並未記錄該前置條件已被正式取代。故整體受控工作流程仍同時指示發布前與發布後兩種時序。當前 final gate 實測 exit 1，未完成的 round12 BLOCK 與最新工作項目狀態仍在；不能視為已結案或自行忽略舊前置條件。
- README／Release notes 已完整揭露已核准的 macOS arm64 範圍與限制：真實 Google OAuth、Keychain、頻道授權、影片／字幕上傳未驗收；UI smoke 未證明有效播放／轉錄；`GHSA-hp3w-g68c-fv3c` moderate build-time advisory、production audit 0；ad-hoc、未 Developer ID／公證及 Gatekeeper 未測；Windows preview unsigned、僅抽取 byte range 且不屬本次發行資產。GitHub API 與 candidate `SIGNING-STATUS-macos-arm64.txt` 均未顯示這些風險已被錯誤宣稱為通過。

## 綜合判定

- 結論：不通過（BLOCK）。
- 可逐字引用的完整結論句：**本輪 FR-027 v0.52.0 GitHub 公開發布前 round13 審查不通過：指定來源 `21d8b077b0bb25af02de5562e000660f6912bef3` 的 macOS arm64 候選 checksum／封裝／簽章檢查通過，exact-source Windows Actions run `39376042653` 與 artifact `12243556843` 成功，range evidence 的 73/73 shared-file hashes 相符，已核准的 macOS-only 發布範圍與已知風險亦有揭露；但 `00`／`05`／`06`／`08` 仍把 `85203c8` 或更早 SHA 寫成最新證據並稱最終 SHA gate 待執行，round12 BLOCK 尚未被受控紀錄解除，且 round11 readiness 項目仍要求發布前通過 `docs:check:final`，與新項目及通用 closeout workflow 所定發布後執行的順序相衝突；本輪 `docs:check:final` 實測 exit 1，故在受控文件同步、final-gate 時序明確收斂並完成要求的結案／審查門檻前，不得建立 `v0.52.0` tag／GitHub Release 或上傳資產。**
- 阻擋問題（若有）：
  - P1：同步 `00`／`05`／`06`／`08` 至 exact source `21d8b077b0bb25af02de5562e000660f6912bef3`、candidate checksums／provenance、run `39376042653`、artifact `12243556843` 與 range evidence；將最新工作紀錄中的舊 SHA／待執行狀態修正為可回溯的實況。不得用舊 SHA 的候選證據代表新 SHA。
  - P1：明確修訂或取代 `08-CHANGE-LOG.md:39,41` 的發布前 final-gate 條件，並使之與 `workflows/06-BUILD-RELEASE.md`、`workflows/07-DOCUMENT-CLOSEOUT.md` 及 round12 修正項目一致；保留 round12 原件，不以改寫其內容處理。
  - 在上述事項收斂前，`npm run docs:check:final` 的 exit 1 與 round12 BLOCK 均不得標記為已解除，也不得公開發布。
- 剩餘風險：真實 Google OAuth／Keychain／頻道／影片／字幕上傳、有效播放／完整轉錄、完整 Windows ZIP 與 Windows 實機、Developer ID／公證／Gatekeeper 仍未驗收。這些已在核准範圍內並於 README／Release notes 揭露，不是本輪新發現的測試失敗；Windows artifact 僅 unsigned preview、byte-range/manifest 交叉檢查，不是 Windows 發行資產。
- 給主要開發代理的具體修正要求：先依發布授權更新受控狀態與工作紀錄，使來源 SHA、實際 macOS 候選、Windows CI 證據及授權一致；明確處理前一 readiness 記錄留下的 pre-release final-gate 條件。保留 round12 報告原件及其單一已授權公開例外，並確認 README／Release notes 的限縮揭露不擴大。完成後依既定發布流程重審；本報告結論前不得建立 tag／Release／assets。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
