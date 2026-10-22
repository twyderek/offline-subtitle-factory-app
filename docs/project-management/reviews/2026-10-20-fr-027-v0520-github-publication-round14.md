# 獨立審查報告：FR-027 v0.52.0 GitHub 公開發布 round14

- 審查對象 commit／版本：`3312c373f688b425bfb51d5dee8c65bdc53c7954`／`0.52.0`。
- 分支：`codex/0.51-anthropic-claude`；本地 HEAD 與 `origin/codex/0.51-anthropic-claude` 均指向該 SHA；其父 commit 為 `21d8b077b0bb25af02de5562e000660f6912bef3`。
- 候選證據：`../dist/release-0.52.0-macos-3312c37-normal/`。
- 對應 08-CHANGE-LOG 條目：2026-10-20「FR-027 v0.52.0 round13 blocker 修正與 final-source 複審」。
- 審查輪次：round14。
- 審查代理啟動時間、上下文來源：2026-10-20 UTC；本輪由需求方在獨立審查上下文指定來源 SHA、候選、CI run/artifact 與唯讀範圍。Git、候選、GitHub、受控文件與既有 round12／round13 報告均由本上下文查核。
- 範圍：發布 readiness 六面向審查；沒有建立 tag／Release、沒有上傳資產。唯一寫入為本報告。

## 1. 需求完整性（需求與發布範圍）

- 判定：通過。
- 證據：`README.md`、`RELEASE-NOTES-0.52.0.md` 及最新 08 工作條目均將本次資產限定為 macOS arm64，明確排除 Windows preview。08 記錄需求方已核准提交／推送 source、建立 v0.52.0 Release 並發布 macOS arm64 資產，但不授權跳過測試、審查、hash 或 source consistency gate。
- `09-STANDING-AUTHORIZATIONS.md` 的 `AUTH-2026-07-23-01` 僅涵蓋未 Developer ID 簽章／未公證風險；本次 08 記錄另載 2026-10-20 的限縮授權，只允許 round12 報告原樣保留其一處路徑。該例外不擴及其他 tracked path。
- 本次核對的版本、平台與風險揭露符合已核准範圍；第 3 節列出的額外路徑不在授權範圍，並阻擋發布。

## 2. 邏輯正確性（架構與 runtime 邊界）

- 判定：通過。
- 證據：`git diff-tree --no-commit-id --name-status -r HEAD` 僅列出 `00-CURRENT-STATUS.md`、`05-DEVELOPMENT-AND-DEPLOYMENT.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`08-CHANGE-LOG.md` 與新增的 round13 review；沒有產品 runtime 或測試程式變更。`git ls-remote` 確認遠端工作分支與 HEAD 相同。
- 以候選 DMG 唯讀掛載內容執行 `npm run runtime:verify:mac`，exit 0；驗證 runtime manifest、FFmpeg、FFprobe、Whisper CLI 及 tiny model 的格式／hash，並執行三個 bundled binary 的基本 smoke。`Info.plist` 顯示 0.52.0、最低 macOS 12.0；主 executable 為 Mach-O 64-bit arm64。這只確認封裝 runtime 邊界，不代表一般使用者完整任務或轉錄品質驗收。

## 3. 邊界情況（安全、隱私與機密）

- 判定：不通過。
- 證據：對 HEAD 執行 tracked-source 個人路徑掃描，排除經明確授權的 round12 報告後，仍命中 `NEXT-VERSION-FIX-LOG.md:27` 一處含具名 Windows 使用者 profile 的絕對路徑。`git ls-tree` 確認該檔案受追蹤；`git archive HEAD | tar -tf -` 確認它會進入 source archive。其餘命中均為測試中的合成去敏 path fixture，非本次發現的個人路徑。
- 這處額外路徑不在 round12 的限縮公開授權內。`README.md:17` 與 `RELEASE-NOTES-0.52.0.md:23` 將 round12 描述為唯一例外，並稱歷史 home path 已匿名化；目前 source 內容與此揭露不符。候選 `PROVENANCE.txt` 也記錄 `NEXT-VERSION-FIX-LOG.md` 有一處 path，但其後「排除 round12 後只剩 synthetic fixture」的掃描結論漏掉了上述 Windows path，不能作為隱私 gate 通過證據。
- 常見 GitHub／Google／OpenAI／Slack token 與 PEM 私鑰格式的 redacted pattern scan 沒有命中；這不抵銷已確認的個人路徑外洩，也不等於全域秘密掃描。
- 阻擋要求：先匿名化該 tracked path，修正 source archive 隱私揭露與 provenance，形成新 source SHA，並重跑該 SHA 的完整 source check、macOS 候選、exact-source Windows CI/hash gate 及獨立複審。完成前不得公開。

## 4. 程式碼品質（文件治理與 round13 blocker closure）

- 判定：通過。
- 證據：round13 報告對 `21d8b07` 的 BLOCK 原因是受控紀錄落後與 `docs:check:final` 發布前／發布後時序互相衝突。現行 `00`／`05`／`06`／`08` 已同步 21d8 證據；08 將 round11 readiness 的發布前 final-gate 條件明確標記為歷史建議，依 `workflows/06-BUILD-RELEASE.md` 與 `workflows/07-DOCUMENT-CLOSEOUT.md` 取代。發布前 gate 為完整測試、最終來源候選／同源 CI/hash gate 與獨立審查；`docs:check:final` 在實際發布及資產核對後執行。
- 最新 08 工作項目、00 狀態與 05／06 記錄是建立 `3312c37` 時的狀態快照，列明新 SHA 的 post-commit 證據待本輪審查。該 SHA 的實際結果現由本報告及相鄰候選 evidence 具體列出；這不恢復 round13 的舊 pre-release final-gate 要求。依指定流程，本輪未在發布前執行 `npm run docs:check:final`；該結案 gate 留待發布及 asset 核對後執行。
- round12 與 round13 原報告未修改；round12 僅依原有限授權保留，沒有把該授權延伸至第 3 節路徑。

## 5. 測試覆蓋（候選與 CI 證據）

- 判定：通過，限於所列證據範圍。
- macOS 資產獨立核對：`shasum -a 256 -c SHA256SUMS-macos-arm64.txt` 四項全數 OK；DMG 246,876,511 bytes、SHA-256 `ea183f090caebccf1eea77760b8e62fafe938cb166ef2fb7d4475b0f9a2ff2ec`；ZIP 255,845,253 bytes、SHA-256 `d7a9f0904569b42789fcd2262662ce7ffd3204c14884ebd48642fc023018d087`。`latest-mac.yml` 的 DMG／ZIP size 與 SHA-512 均經重新計算相符；兩個 blockmap 為 257,998／266,406 bytes，亦通過 sidecar。`hdiutil verify` 回報 DMG checksum VALID；`unzip -tq` 無錯。對 DMG 內 app 執行 `codesign --verify --deep --strict` exit 0；`SIGNING-STATUS-macos-arm64.txt` 如實標示 ad-hoc、無 Developer ID／公證，Gatekeeper 未測。
- exact-source GitHub Actions：[run 39378546407](https://github.com/twyderek/offline-subtitle-factory-app/actions/runs/39378546407) API 回報 `completed/success`、head SHA 為 `3312c373f688b425bfb51d5dee8c65bdc53c7954`。job 的 source／real FFmpeg regression、unsigned preview package、renderer/install lifecycle、archive checksum 與 artifact upload 步驟成功；有簽章的 Windows build 因無憑證而 skipped。artifact `12243614840`，名稱 `offline-subtitle-factory-0.52.0-windows-x64`，大小 504,801,534 bytes，未過期。
- GitHub API 的 artifact `digest` 欄為 `sha256:35e158dc220c47eca04c5c80ba8eb1aec6d1b63cb26e0c669be20345bbef60e0`。這是 API 回報值，沒有把它當成本審查獨立計算的完整 archive SHA-256。`windows-ci-source-manifest-range-check-39378546407.json` 記錄只讀取一次 ZIP 尾端 500,000-byte range；其中 7-entry central directory、manifest／checksum entry CRC 與 uncompressed size、manifest SHA-256 對 sidecar、73/73 shared-file raw hash 比對均記錄通過。完整 Windows artifact 未下載，因此不宣稱全 ZIP 完整性；Windows artifact 是 unsigned preview，不是本次 Windows 發行資產或實機驗收。
- UI evidence `youtube-ui-smoke.png.json` 記錄 candidate Electron usability audit、layout／mock 互動、`googleRequests=false`、3 秒 synthetic clip `currentTime=0.000379` 且 `paused=true`；comparison 為 `0.000478` 秒。cleanup evidence 記錄 process group 關閉且 profile 移除。此 scope 不證明有效播放／轉錄；沒有真實 Google OAuth、Keychain、頻道／影片／字幕上傳或 Windows real-machine 驗證。

## 6. 實際運行結果（發布 readiness 與剩餘風險）

- 判定：不通過（BLOCK）。
- GitHub API 的 `releases/tags/v0.52.0` 回傳 HTTP 404；Latest 仍為 `v0.51.0`。`git ls-remote --refs origin refs/tags/v0.52.0` 無輸出，故目前沒有 v0.52.0 tag／Release／公開 assets。候選與 run/artifact 僅為發布前證據。
- 已接受並在 README／Release notes 揭露的剩餘風險包括：真實 Google OAuth／Keychain／頻道授權及影片／字幕上傳未驗收；合成 clip 未展示有效播放；macOS ad-hoc、未 Developer ID／公證且 Gatekeeper 未測；Windows 完整 archive／實機未驗收；完整 dependency audit 的 8 個 moderate paths（`GHSA-hp3w-g68c-fv3c`，build-time chain；production audit 記錄為 0）。這些不視為已解決，也不是本輪新增的主要阻擋。
- 主要阻擋是第 3 節已核實、未獲授權的 tracked Windows 使用者路徑及其與公開隱私聲明的衝突。修正會改變 source SHA，故現有 3312c37 候選與 run/artifact 不能作為修正後 source 的 release gate 證據。

## 綜合判定

- 結論：**BLOCK**。
- 阻擋問題：在建立 `v0.52.0` tag／Release 或上傳資產前，去識別 `NEXT-VERSION-FIX-LOG.md:27` 的額外 tracked personal path，更新 source archive privacy disclosure／provenance，以新 SHA 重跑完整 source check、macOS candidate、exact-source Windows CI／hash gate，並完成下一輪獨立複審。不得沿用本輪 3312c37 evidence 代表修改後的 source。
- 剩餘風險：見第 5、6 節；已核准揭露的功能／平台限制仍未驗收。
- 給主要開發代理的具體修正要求：僅處理上述 source privacy blocker；保留 round12／round13 原件。新 source 與候選、CI/hash gate 完全一致且複審解除阻擋前，不得公開發布。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
