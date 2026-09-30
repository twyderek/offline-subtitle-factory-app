# 獨立審查報告：Breeze 0.49.0 第一版發布後核對（REL-030）

- 審查對象 commit／版本：PR #11 merge commit、annotated tag `v0.49.0` dereference target 與 Windows tag workflow source 均為 `1f50b85c0599ef85c73f05085d70925d4d6b670a`／`0.49.0`；macOS 資產來源 `0205548e2a4d644cfb1d91e9d631eb19662eb0b8`。
- 對應 08-CHANGE-LOG 條目：2026-08-13 — Breeze ASR 25 第一版發布推進（REL-030）
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-08-13 10:53 CST；獨立子代理上下文，只接收發布後待核對範圍、外部證據索引及 round1／round2 報告位置，未沿用主要開發代理對話記憶或其評價性結論。
- 審查環境：macOS arm64；唯讀核對 Git／GitHub API、Actions、正式下載資產與既有治理差異。除本報告外未修改其他檔案。

## 1. 需求完整性

- 判定：通過
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:42-48` 記錄需求方／產品負責人明確授權公開推送、PR、合併、tag 與 0.49.0 Release，並逐項接受 experimental Breeze 尚未完成真實 checkpoint／官方 runtime、品質效能、長音訊、Windows process tree、兩平台乾淨安裝／下載失敗驗收的公開發布風險；Windows 未 Authenticode 與 macOS 未 Developer ID／公證另引用 `AUTH-2026-07-23-01`。授權同時禁止把缺口描述為已驗收。
  - 2026-08-13 10:53–10:55 CST 執行 `gh pr view 11`、GitHub Releases／Git refs API：PR #11 為 `MERGED`、merge commit `1f50b85c...b670a`；`refs/tags/v0.49.0` 指向 annotated tag object `5ad9ddb3...238dd`，其 dereference object 為相同 merge commit。`/releases/latest` 回報 Release ID `369638000`、`draft:false`、`prerelease:false`、發布時間 `2026-08-13T02:48:41Z`、9 項 assets 與正式 URL `https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.49.0`。
  - Release 公開說明逐字維持 Whisper.cpp 為預設、Breeze 為實驗性選項，並揭露外部 runtime／checkpoint、不簽章／不公證與所有未驗收面向；與 `RELEASE-NOTES-0.49.0.md:5-17,28-38` 一致，沒有把已接受風險誤寫為通過。
  - 9 項 GitHub asset metadata 與 `/private/tmp/osf-049-release-redownload` 正式下載實檔逐項一致：

    | 資產 | bytes | GitHub／本機 SHA-256 | 正式下載 URL |
    |---|---:|---|---|
    | `latest-mac.yml` | 570 | `3ddc26ef622b3872d54a43f693c8180271f0639e57709579bd8edd5e7b6ed6f2` | `https://github.com/twyderek/offline-subtitle-factory-app/releases/download/v0.49.0/latest-mac.yml` |
    | `latest.yml` | 380 | `99915cb0fedc57699c23ba7955952b2686cafde0d6ce0b51c7304c8b79d6d9c7` | `https://github.com/twyderek/offline-subtitle-factory-app/releases/download/v0.49.0/latest.yml` |
    | `offline-subtitle-factory-0.49.0-macos-arm64.dmg` | 242,706,559 | `18fba33da3740ee28fdbb5aba575fe7305c069eb417702fc67db3ee8f54dda30` | `https://github.com/twyderek/offline-subtitle-factory-app/releases/download/v0.49.0/offline-subtitle-factory-0.49.0-macos-arm64.dmg` |
    | `offline-subtitle-factory-0.49.0-macos-arm64.zip` | 249,942,036 | `9a4337c352e8c97ebba3de0ad02c86e192474061a2abd71faedca7dd789ce188` | `https://github.com/twyderek/offline-subtitle-factory-app/releases/download/v0.49.0/offline-subtitle-factory-0.49.0-macos-arm64.zip` |
    | `offline-subtitle-factory-portable-0.49.0.exe` | 244,674,635 | `cbec3c244f80d9e922f7139caacbefd00cabf41a2a0cffc5385392950960f981` | `https://github.com/twyderek/offline-subtitle-factory-app/releases/download/v0.49.0/offline-subtitle-factory-portable-0.49.0.exe` |
    | `offline-subtitle-factory-setup-0.49.0.exe` | 245,381,896 | `0a5cf5cdf3b94ce4a7621fffcbd2174a92e4288a4c0e380d31c98338b34d65a0` | `https://github.com/twyderek/offline-subtitle-factory-app/releases/download/v0.49.0/offline-subtitle-factory-setup-0.49.0.exe` |
    | `SHA256SUMS-macos-arm64.txt` | 228 | `11d7f350f07c114e2cf4f65e2a3b0b41e841bce203452da0689c49c15164884e` | `https://github.com/twyderek/offline-subtitle-factory-app/releases/download/v0.49.0/SHA256SUMS-macos-arm64.txt` |
    | `SHA256SUMS-windows-x64.txt` | 219 | `41c3cf3050c42627cf279f4d62c982c391fa8dc4e17380e3a5a7b5a527754efc` | `https://github.com/twyderek/offline-subtitle-factory-app/releases/download/v0.49.0/SHA256SUMS-windows-x64.txt` |
    | `SIGNING-STATUS-windows-x64.txt` | 599 | `5c09b6ecc5cf73c6e427e558f56ab13e675ef85f2f14d57afd808189eab57513` | `https://github.com/twyderek/offline-subtitle-factory-app/releases/download/v0.49.0/SIGNING-STATUS-windows-x64.txt` |

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - 2026-08-13 10:53 CST 執行本機 `git rev-parse v0.49.0` 得 annotated tag object `5ad9ddb3...238dd`，`git rev-parse 'v0.49.0^{}'` 得 `1f50b85c...b670a`；GitHub refs／tag APIs 回報完全相同關係，排除只比對 tag 名稱而未 dereference 的錯誤。
  - `gh run view 31661442776` 回報 workflow `Build Windows 0.49.0`、event `push`、head branch `v0.49.0`、head SHA `1f50b85c...b670a`、job `Windows x64 test and package` 結論 `success`。artifact API 回報 ID `9166375562`、490,411,920 bytes、digest `sha256:5a45c9d04917bbdd3c7d05867e68c42e1d7f5597fe2dc369364b5039e5371418`，workflow source 亦為最終 tag commit。
  - 2026-08-13 10:56 CST 對 `/private/tmp/osf-049-tag-windows-artifact.zip` 計算 SHA-256，結果與 artifact API digest 完全一致；正式下載的 Setup、Portable、`latest.yml` 與 LF 公開 checksum 清單分別以 `cmp` 和 tag artifact 內容核對，四項均 byte-for-byte 相同。
  - `git diff --name-status aa1ec41..1f50b85c` 只含三份治理文件與 round2 報告；`git diff --name-status 0205548..1f50b85c` 也只再增加 round1 報告。從 macOS 建置來源及 PR Windows 候選至 tag 沒有產品、dependency、版本或封裝輸入變更；tag workflow 又從最終 commit 重建 Windows，provenance 關係成立。
  - tag commit 的 `package.json:3` 為 `0.49.0`。公開 `SIGNING-STATUS-windows-x64.txt` 使用準確的 `UNSIGNED RELEASE`，明列 tag target、Windows tag run／artifact 與 macOS `0205548` 來源，不再沿用 round2 指出的 `INTERNAL PREVIEW` 誤導字樣。

## 3. 邊界情況

- 判定：部分通過（未覆蓋項目已獲具體接受並持續揭露，不構成本次發布阻擋）
- 證據：
  - 2026-08-13 10:55 CST 在正式下載目錄執行兩份 `shasum -a 256 -c`，DMG、ZIP、Setup、Portable 四項全數 `OK`；Windows checksum 是 LF ASCII，可在 macOS 直接重放，round2 的 CRLF 可攜性條件已解除。
  - 2026-08-13 10:55–10:57 CST 執行 `hdiutil verify`，DMG checksum `VALID`；`unzip -t` 對 macOS ZIP 回報 `No errors detected`；electron-builder cache 的 7-Zip 24.09 對正式 Setup 與 Portable 均辨識為 `NSIS-3 Unicode` 且回報 `Everything is Ok`。
  - tag workflow 的 archive／內容關卡已確認 Breeze guide 存在、checkpoint 不入包；正式 Windows EXE 與 tag artifact byte-for-byte 相同。macOS 正式 SHA 與 round1 已驗證候選相同，ZIP 列表包含 `docs/BREEZE-ASR-25.md`、`lib/breeze-runtime-probe.mjs`、`RELEASE-NOTES-0.49.0.md`，沒有把約 3 GB checkpoint 當成內建功能。
  - 未實測邊界仍為真實 3 GB checkpoint、官方 patched runtime、checkpoint 下載中斷／磁碟不足、台灣華語／中英混用品質與對齊、長音訊、CPU／CUDA 效能與記憶體、Windows timeout `taskkill /T /F` process tree，以及兩平台乾淨安裝後 Breeze 流程。這些只列為需求方已接受的 experimental 剩餘風險；本報告不把它們判定為通過。

## 4. 程式碼品質

- 判定：通過（0.49.0 發布差異與 provenance 範圍）
- 證據：
  - PR #11 base `05b275f`、head `05f2a483`、merge commit `1f50b85c`，已於 `2026-08-13T02:37:41Z` 合併；GitHub、tag 與 Actions source 可由 commit OID 完整回溯，沒有使用落後主線的舊 Breeze 分支直接發布。
  - round1／round2 已核對 probe、process cleanup、redaction、版本、workflow 與封裝來源；本輪 `git diff --check` 無輸出。`aa1ec41..1f50b85c` 僅治理／審查證據，故不需因審查文件本身重新建置產品 payload。
  - 審查開始時 `git status --short --branch` 只顯示主要代理既有的 `00-CURRENT-STATUS.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`08-CHANGE-LOG.md` 三項未提交治理更新；本代理未修改它們。其內容與外部實況一致，但主代理結案時應把 `00-CURRENT-STATUS.md:9` 的「發布候選」、`08-CHANGE-LOG.md:18-19,48` 及測試稽核歷史「尚待」文字同步為 round3 後狀態，避免完成態仍保留未來式；這是治理收尾，不影響已公開資產完整性。
  - annotated tag 本身未做 Git cryptographic signature（GitHub tag API `verification.verified:false`, reason `unsigned`）；專案規則未將 signed Git tag 設為本版門檻，因此不是阻擋，但仍是供應鏈剩餘風險。

## 5. 測試覆蓋

- 判定：通過（本版聲明範圍；experimental 未驗收面向不納入通過聲明）
- 證據：
  - round1／round2 已核對 focused Breeze、完整 `npm run check`、0 項 npm audit、macOS packaged renderer、DMG／ZIP、Windows real runner Setup／Portable renderer 與安裝解除。最終 tag run `31661442776` 於 2026-08-13 02:38:33–02:42:11 UTC 完成，source／FFmpeg regression、unsigned NSIS build、Setup／Portable renderer、安裝解除、archive／內容與 artifact upload 必要步驟全部 success；Authenticode step 因無憑證按設計 skipped。
  - 本輪獨立重驗所有 9 項正式下載 SHA-256 與 GitHub digest／size；兩平台 checksum 清單全數通過，tag artifact ZIP digest 與 API 一致，Windows 正式 EXE／metadata／checksum 與 tag artifact byte-for-byte 一致。
  - 獨立計算 updater SHA-512：Setup `Ko6CP6wvT9vF8Fgtuzn7yFN/omi+lhqzdyP1QRxtDZT8+zjxvdnWlAndjT9o3ygWJPaOuwNd0ehA10EBrojWtg==`／245,381,896 bytes；macOS ZIP `xrGhbTi9MgGvXkFqmNi/JLMK69cj2l8kQCqsve6d7Y1eUEIFDlfCa7pz28IsDijBeg4+o1Aq5W7aa/luIn0Knw==`／249,942,036 bytes；DMG `ga9+XcFrNXMsOkkLZZLlrMdkhcuuMH3OkFWOQRXRrDzLpo/zjRlVCCu1E0ETUGyOCMay9taBESUyV0anKWf/TA==`／242,706,559 bytes，均與 `latest.yml`／`latest-mac.yml` 完全一致。
  - 不把 deterministic／缺件 probe、macOS cross-build 或 Windows packaging smoke 擴張成真實 Breeze 音訊品質、效能、長音訊或完整跨平台外部 runtime 驗收。

## 6. 實際運行結果

- 判定：通過（公開 Release 與正式下載資產運行／完整性範圍）
- 證據：
  - GitHub `/releases/latest` 實際回傳 v0.49.0；Release 是 public、非 draft、非 prerelease、9 assets，發布時間為 `2026-08-13T02:48:41Z`。所有 asset API state 均為 `uploaded`，且各自具有 `/releases/download/v0.49.0/<filename>` 正式 URL 與 GitHub SHA-256 digest。
  - `/private/tmp/osf-049-release-redownload` 含全部 9 項正式下載；本輪不是只驗證上傳前候選。2026-08-13 10:55 CST 對 Windows checksum 與 Setup URL 執行 `curl -sSIL`，均由 GitHub `302` 轉至 release-assets 並取得 `HTTP/2 200`；Setup 回應 `content-length: 245381896`，checksum 回應 `content-length: 219`，和 API／本機一致。
  - 公開 macOS DMG／ZIP 及 Windows Setup／Portable 已通過實際 archive 完整性重驗；Windows Setup／Portable 又與最終 tag Windows runner 通過 renderer、安裝解除與 archive 測試的 artifact 完全相同。因此 round2 要求的「最終 tag source → CI artifact → 正式 Release → 正式 URL 重下載」閉環成立。
  - `SIGNING-STATUS-windows-x64.txt` 與 Release 說明如實揭露 Windows 未 Authenticode、Unknown Publisher／SmartScreen 與 SHA 核對建議；Release 說明亦揭露 macOS 未 Developer ID／公證。這些狀態有 `AUTH-2026-07-23-01`，但本報告不將未簽章／未公證描述成已消除。

## 綜合判定

- 結論：通過
- 阻擋問題：無。round2 的 LF checksum、公開 `UNSIGNED RELEASE` 文字、三方 provenance、最終 tag Windows workflow、正式 Release digest／URL 與發布後全量下載核對均已解除並獨立重驗。
- 阻擋問題（若有）：無。
- 剩餘風險：Breeze 真實 checkpoint／官方 runtime、台灣華語與中英混用品質／對齊、長音訊、CPU／CUDA 效能與記憶體、Windows process tree、兩平台乾淨安裝後 Breeze、checkpoint 下載中斷／磁碟不足仍未驗收；Windows unsigned／SmartScreen、macOS ad-hoc／未公證與 unsigned Git tag 仍存在。需求方已接受前述 experimental 與平台簽章風險，Release 必須持續保留揭露，且 Whisper.cpp 必須保持預設／回退選項。
- 給主要開發代理的具體修正要求：無發布阻擋修正。治理結案時連結本 round3 報告並逐字引用下方判定句，將 REL-030 狀態／結案判定、`00-CURRENT-STATUS.md` 小節標題及尚存的「round2 後仍須」未來式同步為已完成實況，再執行 `npm run docs:check:final`；不得修改本報告。

- 可逐字引用完整結論句：**REL-030 Breeze 0.49.0 round3 獨立發布後審查結論為通過：PR #11 已合併，annotated tag `v0.49.0` 與最終 Windows tag run 均解析至 commit `1f50b85c0599ef85c73f05085d70925d4d6b670a`，公開 Latest Release 的 9 項資產名稱、大小、GitHub SHA-256 digest 與正式 URL 均和全量重新下載實檔一致，兩平台 checksum、DMG、macOS ZIP、Windows Setup／Portable archive、updater SHA-512／size、`UNSIGNED RELEASE` 與來源 provenance 亦全部通過；真實 Breeze checkpoint／官方 runtime、音訊品質與效能、長音訊、Windows process tree、雙平台乾淨安裝及下載失敗仍只是需求方已接受且 Release 持續揭露的 experimental 剩餘風險，不得宣稱已驗收。**

**REL-030 Breeze 0.49.0 round3 獨立發布後審查結論為通過：PR #11 已合併，annotated tag `v0.49.0` 與最終 Windows tag run 均解析至 commit `1f50b85c0599ef85c73f05085d70925d4d6b670a`，公開 Latest Release 的 9 項資產名稱、大小、GitHub SHA-256 digest 與正式 URL 均和全量重新下載實檔一致，兩平台 checksum、DMG、macOS ZIP、Windows Setup／Portable archive、updater SHA-512／size、`UNSIGNED RELEASE` 與來源 provenance 亦全部通過；真實 Breeze checkpoint／官方 runtime、音訊品質與效能、長音訊、Windows process tree、雙平台乾淨安裝及下載失敗仍只是需求方已接受且 Release 持續揭露的 experimental 剩餘風險，不得宣稱已驗收。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
