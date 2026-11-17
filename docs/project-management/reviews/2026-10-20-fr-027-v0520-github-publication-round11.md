# 獨立審查報告：FR-027 v0.52.0 GitHub 公開發布 round11

- 審查對象 commit／版本：`871ce1c02363dafcc13a441464467234613778ab`／`0.52.0`。
- 分支：`codex/0.51-anthropic-claude`；本機與 `origin` 均指向指定 SHA。
- 候選目錄：`../dist/release-0.52.0-macos-871ce1c-normal/`（以下稱 `<candidate-dir>`）。
- 對應 08-CHANGE-LOG 條目：`docs/project-management/08-CHANGE-LOG.md`，2026-10-20 FR-027 v0.52.0 GitHub 公開發布（macOS arm64）。
- 審查輪次：round11。
- 審查時間、上下文：2026-10-20 03:43 UTC（Asia/Taipei 11:43）；獨立上下文依 release preflight、指定 source、候選、CI／manifest 證據及唯讀 GitHub 查詢執行。
- 範圍：六面向發布前審查。未建立 tag／Release，未上傳 GitHub Release assets；本專案內唯一新增檔案為本報告。

## 1. 需求完整性

- 判定：通過。
- 面向：需求／範圍與授權。
- 證據：`README.md:5-7`、`RELEASE-NOTES-0.52.0.md:20` 將發行範圍限定為 macOS Apple Silicon arm64，並明確排除 Windows 0.52.0 資產；`08-CHANGE-LOG.md:11-14` 同樣規定不得發布 Windows preview artifact。CI 的 Windows 產物是內部 preview artifact，不是本版發行資產。
- 授權：`08-CHANGE-LOG.md:24-28` 記錄產品負責人於 2026-10-19 核准在候選、CI、hash、獨立審查及文件門檻通過後發布 macOS arm64，並接受真實 Google／Keychain／頻道影片與字幕上傳未驗收、moderate build-time advisory、ad-hoc／未公證等已揭露風險；授權明確排除跳過 gate、Windows 發行資產及機密洩漏。`09-STANDING-AUTHORIZATIONS.md` 的 `AUTH-2026-07-23-01` 另涵蓋未公證／未簽章風險，未被擴張為一般發布授權。

## 2. 邏輯正確性

- 判定：通過。
- 面向：安全／隱私與 round10 修正。
- 證據：對 exact SHA 的 tracked tree 執行個人 home 與系統暫存位置掃描，只命中 `scripts/test-breeze-asr.mjs:134` 的合成測試 fixture，沒有非中性的帳號識別路徑。Round10 指出的三處歷史描述已改為中性文字：`docs/project-management/08-CHANGE-LOG.md:568`、`docs/project-management/reviews/2026-09-21-whisper-probe-diagnostics-round1.md:25`、`docs/project-management/reviews/2026-09-21-whisper-probe-diagnostics-round2.md:19`。
- 公開揭露：`README.md:17` 與 `RELEASE-NOTES-0.52.0.md:22-25` 說明 source archive 會包含追蹤中的歷史治理文件、個人 home 前綴已匿名化為 `<user-home>`，且 packaged UI smoke 不證明有效播放／完整轉錄／Google 上傳。Exact-source scan 與候選 `PROVENANCE.txt:8` 的隱私摘要相符。未發現本面向阻擋。

## 3. 邊界情況

- 判定：通過。
- 面向：相容性／平台宣稱與已知限制。
- 證據：候選 `mac-arm64/離線字幕工廠.app/Contents/Info.plist` 顯示版本 `0.52.0`、最低 macOS `12.0`；主執行檔為 Mach-O arm64。這支持所宣稱的 macOS arm64 候選身分，但不代表在所有受支援 macOS 版本實機驗收。
- `<candidate-dir>/SIGNING-STATUS-macos-arm64.txt:3-8` 記錄 ad-hoc 簽章、無 Developer ID／公證、Gatekeeper 未測；README／Release notes 有相同揭露。Windows artifact 為 unsigned internal preview，沒有 Windows 實機驗收或本版 Windows 發行資產宣稱。

## 4. 程式碼品質

- 判定：通過。
- 面向：程式碼／變更品質。
- 證據：`git show --stat HEAD` 顯示本 source commit 只改 6 份治理文件，17 行新增、14 行刪除；沒有產品 runtime 或測試程式變更。三處歷史文字修正保留原本的遮罩／驗收限制描述，僅去除易與個人目錄混淆的路徑 token。

## 5. 測試覆蓋

- 判定：通過，範圍限制依下列記錄保留。
- 面向：測試／證據／來源追溯。
- macOS 候選：本審查重跑 `shasum -a 256 -c SHA256SUMS-macos-arm64.txt`，四項全數 OK；`unzip -tq` 無錯；`hdiutil verify` 為 VALID；`codesign --verify --deep --strict` 成功。Info.plist／`file` 核對為版本 0.52.0、最低 macOS 12.0、arm64。重新計算 `latest-mac.yml` 所列 ZIP／DMG 大小與 SHA-512，兩項均相符。候選主 smoke JSON `youtube-ui-smoke.png.json:214-217` 記錄 3 秒合成片 `currentTime=0.000180`、`paused=true`；獨立比較檔 `youtube-ui-smoke.png.comparison.json:187-194` 記錄 `currentTime=0.001002`。`PROVENANCE.txt:20` 清楚區分兩份量測；兩者都不是有效播放證據，也不代表完整轉錄或真實 Google 驗收。
- exact-source Windows CI：唯讀 GitHub API 核對 run `39364278830` 成功、head SHA 精確為指定 SHA；artifact `12238252981`、名稱 `offline-subtitle-factory-0.52.0-windows-x64`、大小 `504801138` bytes。run job 的 `npm run check`、unsigned preview build、renderer/install lifecycle、archive checksum 及 artifact upload steps 均成功；簽章建置依未提供憑證條件略過。
- Manifest range gate：本審查以 authenticated artifact redirect 另取 `HTTP 206 bytes 504365056-504801137/504801138`，共 `436082` bytes；只讀 ZIP directory、manifest 與 checksum entries，未下載完整 archive。ZIP 有 7 entries；manifest entry CRC／size 有效，SHA-256 `21bb37e2003ac9ad9dcdb80643189579391983aa9347f562f54ad911060e314c` 與 artifact sidecar 相符；manifest source／version 正確，路徑集合及原始 SHA-256 與 macOS `Contents/Resources/app`（排除 platform-specific `node_modules`）為 73/73 相符、0 mismatch。這是 shared-file exact-byte gate；不構成 whole-archive integrity、Windows 發行資產或 Windows 實機驗收。摘要亦保存於 `<candidate-dir>/windows-ci-source-manifest-range-check-39364278830.json:4-32`。
- 相依風險：審查時執行 `npm audit --omit=dev` 為 0 vulnerabilities；完整 `npm audit` 為 8 moderate paths，均沿 `GHSA-hp3w-g68c-fv3c`／`sprintf-js` build-time dependency chain。GitHub Advisory API（2026-10-20）仍無 first patched version。此狀態與 Release notes `:25` 及已記錄授權相符。
- 未覆蓋：本審查未重跑 macOS 完整 `npm run check` 或 UI smoke；UI 結論限於檢視候選保存的 JSON／截圖與本次封裝檢查。真實 Google OAuth、Keychain、頻道授權、影片／字幕上傳及完整 Windows artifact ZIP 均未驗收。

## 6. 實際運行結果

- 判定：不通過（發布準備阻擋）。
- 面向：發布／readiness。
- 外部狀態：截至 2026-10-20 03:32 UTC，本機與遠端均無 `v0.52.0` tag；GitHub `releases/tags/v0.52.0` 回應 404，release list 沒有 0.52.0。沒有 GitHub Release assets 上傳。Actions 的 Windows preview artifact 是上述內部 CI 證據，非 Release asset。GitHub Latest 仍為 v0.51.0。
- **P1 — tracked 發布狀態未與已完成證據同步。** `00-CURRENT-STATUS.md:5-13` 仍稱新 source SHA、candidate、exact-SHA CI 待完成；`05-DEVELOPMENT-AND-DEPLOYMENT.md:6` 仍稱修正未提交、需重建候選／CI；`06-TEST-AND-PROCESS-AUDIT.md:13,28-34` 仍停在舊來源與待完成狀態；`08-CHANGE-LOG.md:16-18,29-30` 仍稱本輪修改未提交／推送、檢查與新 SHA gate 未完成。這些內容與目前 HEAD／origin `871ce1c…`、本候選及成功 run `39364278830` 相矛盾。`08-CHANGE-LOG.md:5` 仍為進行中，亦尚未記錄本輪結論與最終 closeout；本審查未執行 `npm run docs:check:final`。依 release／document-closeout 規則，應先將治理狀態更新為可核對的實況並完成 final gate；若更新改變 release source SHA，須確保候選與 CI 仍指向最終發布來源。
- 不在本審查範圍：依使用者限制，本審查未修改上述文件，也未建立 tag／Release 或上傳資產。

## 綜合判定

- 結論：**不通過（BLOCK）**。
- 可逐字引用的完整結論句：**本輪 0.52.0 GitHub 公開發布前 round11 審查不通過：round10 的隱私措辭與 smoke provenance 問題已解除，指定 SHA 的 macOS 候選及 exact-source Windows 73/73 shared-file gate 亦通過；但 tracked 發布狀態仍記載舊 SHA 與待完成的候選／CI 工作，文件 closeout 尚未完成，故先同步治理紀錄、完成 `docs:check:final` 並確認最終 tag source 與候選／CI 一致，再進入 tag／Release／上傳階段。**
- 阻擋問題：P1 為第 6 節的治理狀態與實際來源／候選／CI 不一致及 final closeout 未完成。
- 已解除的 round10 findings：exact-source tracked scan 未發現非中性個人 home 路徑；三處歷史描述已中性化；候選 provenance 分列 primary `0.000180 sec` 與 comparison `0.001002 sec`，並否認有效播放；同源 CI／manifest 73/73 shared raw hashes 相符，限 byte ranges，未宣稱完整 archive。
- 剩餘已揭露風險：真實 Google／Keychain／頻道／影片／字幕流程未驗收；GHSA moderate build-time advisory（production audit 0）；ad-hoc、未 Developer ID／公證且 Gatekeeper 未測；有效播放／完整轉錄未驗收；Windows 僅內部 preview，完整 ZIP 與 Windows 實機未驗收。
- 修正要求：更新 `00`／`05`／`06`／`08` 的 0.52.0 狀態、來源 SHA、候選與 CI 結果，記錄本報告與逐字判定，執行 final closeout gate，並確保待發布 tag 指向已核對來源。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、唯讀 API 查詢與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
