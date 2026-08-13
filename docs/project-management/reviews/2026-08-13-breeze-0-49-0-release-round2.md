# 獨立審查報告：Breeze 0.49.0 第一版發布候選（REL-030）

- 審查對象 commit／版本：PR #11 head `aa1ec41e0856746726774d5f16a48f96b6c103b3`／`0.49.0`；macOS 候選資產來源 `0205548e2a4d644cfb1d91e9d631eb19662eb0b8`；Windows CI 候選資產來源 `aa1ec41e0856746726774d5f16a48f96b6c103b3`。
- 對應 08-CHANGE-LOG 條目：2026-08-13 — Breeze ASR 25 第一版發布推進（REL-030）
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-08-13 10:27 CST；獨立子代理上下文，只接收複審範圍、round1 報告位置與待核對的外部證據索引，未沿用主要開發代理對話記憶或其評價性結論。
- 審查環境：macOS arm64、分支 `codex/breeze-first-release`；本輪只做唯讀 Git／GitHub／artifact／文件驗證，不重建二進位。

## 1. 需求完整性

- 判定：通過（公開發布前仍有兩項文字資產條件）
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:38-45` 記錄需求提出者／產品負責人於 2026-08-13 明確同意公開推送，並接受 Breeze 維持 experimental，以及未完成真實 checkpoint／官方 runtime、品質效能、長音訊、Windows process tree、兩平台乾淨安裝／下載失敗驗收的公開發布風險；授權涵蓋 PR、合併、tag 與公開 0.49.0 Release，但禁止把缺口寫成已驗收。
  - `docs/project-management/09-STANDING-AUTHORIZATIONS.md:3-14` 的 `AUTH-2026-07-23-01` 仍有效，涵蓋 Windows 未 Authenticode 與 macOS 未 Developer ID 簽章／公證；本次具體實機缺口另由上述 REL-030 授權接受，沒有誤用常設授權擴張風險範圍。
  - `RELEASE-NOTES-0.49.0.md:5-17,28-38` 明載 Whisper.cpp 維持預設、Breeze checkpoint／Python／PyTorch／patched runtime 不入包、Windows 未簽章與 macOS 未公證，以及所有被接受但未完成的真實品質／效能／安裝邊界；`docs/project-management/00-CURRENT-STATUS.md:4-15` 仍把 0.49.0 描述為候選而非已發布。
  - 2026-08-13 10:27 CST 執行 `gh pr view 11 --json ...`：PR #11 為公開 repo 的 OPEN draft，head `aa1ec41`、base `main`、`MERGEABLE`／`CLEAN`；因此 round1 的「分支／PR 不存在」阻擋已解除。
  - PR body 的「Release gates still required」仍把 Windows Actions 列為待辦；在轉 ready 前應更新為 run `31659328605` 已通過、round2 結論與尚待發布後核對，避免 PR 說明落後實況。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - 2026-08-13 10:27 CST 執行 `git diff --name-status 0205548..HEAD`，只有 `00-CURRENT-STATUS.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`08-CHANGE-LOG.md` 與 round1 報告；沒有產品程式、版本、dependency、workflow 或封裝輸入變更。因此 macOS 資產來自 `0205548`、Windows 資產來自 `aa1ec41`、最終 tag 指向再加入治理／審查文件的 merge commit，在明確揭露 provenance 的前提下邏輯一致，不需把舊資產誤稱為由最終治理 commit 直接重建。
  - 2026-08-13 10:27 CST 的 PR metadata 顯示 head OID 與 Windows run head SHA 都是 `aa1ec41e0856746726774d5f16a48f96b6c103b3`；run `31659328605` 為 push event、workflow 名稱 `Build Windows 0.49.0`、結論 success。
  - Windows Actions 2026-08-13 01:58:06–02:00:49 UTC 日誌顯示 Node 22.23.2、`npm run check`、Breeze 契約／probe test、runtime verify、unsigned NSIS build、Setup installed renderer、silent uninstall、Portable renderer、兩個 archive test、Breeze guide 存在與 checkpoint 排除均完成，沒有只由 job 綠燈推論內部步驟。
  - Setup 與 Portable renderer 實際完成 health/settings、create 201、start 202、job `completed`、cleaned SRT、trim/review assets、glossary round-trip 與七 provider；日誌最後為 `Windows Setup, Portable, and uninstall smoke passed.`。

## 3. 邊界情況

- 判定：部分通過（剩餘項目已獲具體風險接受且如實揭露）
- 證據：
  - Windows CI 實測的發布邊界包括：無簽章 secret 時走 unsigned build、Setup 隔離路徑靜默安裝、安裝後 renderer、解除安裝 executable 移除、Portable renderer、NSIS Setup／Portable archive、Breeze guide 必須存在、Small 與 Breeze checkpoint 必須不入包；run `31659328605` 對應步驟 7 skipped、8–11 success。
  - `/private/tmp/osf-049-ci-extracted` 中只有 Setup、Portable、blockmap、`latest.yml`、SHA 清單與 unsigned 聲明；CI log 對 unpacked app 的明確 checkpoint 路徑做不存在斷言，故不是只靠壓縮檔大小猜測未入包。
  - 未實測的真實 3 GB checkpoint、官方 patched runtime、下載中斷／磁碟不足、台灣華語／中英混用品質、長音訊、CPU／CUDA 效能與記憶體、Breeze timeout 觸發的 Windows `taskkill /T /F` process tree、兩平台乾淨安裝後 Breeze 流程仍存在；`RELEASE-NOTES-0.49.0.md:34-38`、`docs/project-management/00-CURRENT-STATUS.md:12-14` 與 REL-030 授權一致，故列為已接受的 experimental 剩餘風險，不再是本次發布阻擋。
  - 此接受不構成「已驗收」：若 Release 描述刪除限制、把 Breeze 改為預設，或宣稱真實品質／跨平台流程已通過，本報告立即失效。

## 4. 程式碼品質

- 判定：通過（候選差異與來源可追溯範圍）
- 證據：
  - 2026-08-13 10:27 CST 執行 `git rev-parse`：本機 HEAD 與 `origin/codex/breeze-first-release` 均為 `aa1ec41`，`origin/main` 為 `05b275f`；PR metadata 亦回報同一 head/base，沒有審查錯分支。
  - `git status --short --branch` 只顯示主要代理尚未提交的三份治理文件；本代理逐份檢查 diff，內容只更新 GitHub 認證、PR／CI artifact 與風險接受實況，未夾帶程式變更。本報告以外不修改它們。
  - `.github/workflows/windows-preview.yml:1-18,24-38,47-62,64-134` 固定 0.49.0 branch／tag、Node 22、完整 check、unsigned fallback、Setup／Portable install smoke、archive、文件與 checkpoint exclusion、SHA／簽章狀態及 artifact upload；實際 run 與靜態流程一致。
  - 2026-08-13 10:28 CST 執行 `git diff --check` 無輸出；PR 為 CLEAN／MERGEABLE。PR 轉 ready 前只要提交本輪治理 diff 與 round2 報告、確認新增差異仍僅為文件，即可合併，不要求因審查文件本身重建產品資產。

## 5. 測試覆蓋

- 判定：通過（experimental 未驗收面向以授權與揭露收斂）
- 證據：
  - Windows run `31659328605` 於 2026-08-13 01:57:29–02:01:16 UTC 完成；job `94320623884` 所有必要步驟 success，`npm ci` 顯示 286 packages、0 vulnerabilities，`npm run check` 與 Breeze focused test 通過。
  - round1 已獨立核對 macOS DMG checksum、ZIP、packaged renderer、版本、簽章狀態與 updater metadata。本輪 2026-08-13 10:29 CST 再計算本機 DMG `18fba33da3740ee28fdbb5aba575fe7305c069eb417702fc67db3ee8f54dda30`（242,706,559 bytes）及 ZIP `9a4337c352e8c97ebba3de0ad02c86e192474061a2abd71faedca7dd789ce188`（249,942,036 bytes），並重放 `SHA256SUMS-macos-arm64.txt`，兩項均 `OK`。
  - 2026-08-13 10:28 CST 對完整下載 `/private/tmp/osf-049-windows-ci-artifact-complete.zip` 計算 SHA-256，為 `0dccf99939edd1e3dec024f16327e6bcfd3b0674885c1007ff24d5d1f0b15027`、大小 490,411,929 bytes，與 GitHub artifact API／Actions upload log 完全一致；`unzip -t` 回報無錯。
  - 獨立以 Node 解析 CI 清單並計算實檔：Portable `4f16f949d8cd3a207ac922574a3b4768d513f8478740d6ae9704c62447f0bff4`／244,674,637 bytes、Setup `b39d4451d4edc5f80245a540d341f9c7158fd58f75009862c8bfc995936be925`／245,381,891 bytes，均 match；Setup SHA-512 `3Rf12yS5QIl8GA6KHaZ3TRyArXPKCgf37qdZXFMpOvq+AgwP8Ud7RsKE91dg/14EVeKv13YwJxQEn18cInQ3Rw==` 與 `latest.yml` 兩處值及 size 一致。
  - CI 的 `SHA256SUMS-windows-x64.txt` 使用 CRLF；macOS `shasum -c` 將檔名尾端 `\r` 視為字元而報兩檔無法開啟，雖然獨立解析證明 hash 正確，公開 Release 前仍須產生內容相同的 LF 版並在下載資產同目錄重放成功。

## 6. 實際運行結果

- 判定：通過（正式 Release 尚未建立，需發布後 round3）
- 證據：
  - Windows Server 2022 runner 實際安裝 Setup 至隔離 temp directory，啟動已安裝 executable 完成 renderer／manual SRT job，隨後靜默解除並檢查 executable 移除，再啟動 Portable 完成同等 smoke；不是 macOS cross-build 或 mock 取代 Windows executable 啟動。
  - Actions archive test 對 Portable（244,674,637 bytes）與 Setup（245,381,891 bytes）均回報 NSIS-3 Unicode、`Everything is Ok`；artifact API 回報 ID `9165654131`、未過期、來源 SHA `aa1ec41`、digest 與本機完整下載一致。
  - CI `SIGNING-STATUS-windows-x64.txt` 的 unsigned 事實與 Windows Authenticode 檢查、Release notes 及授權一致；但文字為 `UNSIGNED INTERNAL PREVIEW`，公開 Release 不應直接上傳此誤導標籤。發布前須改成 `UNSIGNED RELEASE` 或使用詳細公開版，列出兩個 CI EXE、source candidate `aa1ec41`、最終 `v0.49.0` tag target 與 SmartScreen／SHA 提醒。
  - 2026-08-13 10:29 CST 經 GitHub API 查詢 `refs/tags/v0.49.0` 得 404，確認 tag／Release 尚未提前建立；因此目前只能判定發布前門檻，GitHub 正式 asset digest／URL／下載驗證必須在發布後 round3 完成。

## 綜合判定

- 結論：有條件通過（可將 PR #11 轉 ready 並合併；完成兩項文字資產修正與 provenance 固定後可建立 tag／公開 Release；發布後 round3 為強制門檻）
- round1 阻擋解除情況：
  1. GitHub 認證、公開 branch 與 PR 已存在，PR CLEAN／MERGEABLE：解除。
  2. Windows real runner、Setup／Portable renderer、安裝解除、archive／內容／checkpoint exclusion：run `31659328605` 通過，解除。
  3. CI artifact digest、完整下載、ZIP、EXE SHA、updater SHA-512／size：獨立交叉驗證一致，解除。
  4. 真實 Breeze／效能／長音訊／Windows process tree／乾淨安裝／下載失敗缺口：需求方已逐項明確接受以 experimental 公開，Release notes／狀態如實揭露，解除為發布阻擋但保留為剩餘風險。
  5. 資產與最終 tag commit 不同：`0205548..aa1ec41` 及目前待提交差異均為治理／審查文件，產品 payload 未變；只要 Release 明列 macOS source `0205548`、Windows source `aa1ec41`、tag target 為最終 merge commit，此關係可接受。
- 發布前條件：
  1. 提交的剩餘差異只能是三份既有治理更新、本 round2 報告與相應 PR 說明；若出現任何產品／workflow／package 變更，須重跑受影響測試與複審。
  2. 更新 PR body 已完成的 Windows gate 與 round2 結論，再轉 ready；合併時再次確認 PR CLEAN、必要 checks success。
  3. 以 CI 兩個已核對 SHA 產生 LF 版 `SHA256SUMS-windows-x64.txt` 並重放成功；公開簽章說明不得使用 `UNSIGNED INTERNAL PREVIEW`，須改成準確的公開 Release 語句與 Windows source `aa1ec41`。
  4. `v0.49.0` tag 應固定至最終合併 commit；公開 Release 必須上傳 macOS `0205548` 候選、Windows `aa1ec41` CI 候選及各自匹配的 updater metadata／checksum／簽章說明，不得混用本機 cross-build Windows EXE。
- 發布後強制條件：建立 Release 後立即驗證 tag 解析 SHA、Latest 狀態、每項 asset 名稱／大小／GitHub digest／直接下載 URL；重新下載 DMG、ZIP、Setup、Portable、metadata 與 checksum，重放 SHA／archive／updater metadata，並建立 round3 獨立發布後審查。若任一不一致，停止完成宣告並修正 Release。
- 剩餘風險：Breeze 的真實 runtime／checkpoint、音訊品質、長音訊、CPU／CUDA、Windows process tree、兩平台乾淨安裝與下載失敗仍未驗收；Windows unsigned／SmartScreen、macOS ad-hoc／未公證仍存在。這些風險已由需求方接受且必須持續揭露，Whisper.cpp 必須保持預設／回退選項。
- 給主要開發代理的具體修正要求：依上述四項發布前條件更新 PR／文字資產並發布；不得修改本報告。發布後提供 GitHub 實際 tag／Release／asset 證據給 round3 審查。

**REL-030 Breeze 0.49.0 round2 獨立複審結論為有條件通過：GitHub 公開分支與 draft PR #11、Windows run `31659328605` 的來源回歸、Setup／Portable 真實 renderer 與安裝解除、artifact `9165654131` 的完整下載 digest、EXE SHA-256 及 updater SHA-512／size 均已獨立核對一致，且需求方已明確接受仍未完成的真實 Breeze／效能／長音訊／Windows process tree／雙平台乾淨安裝與下載失敗風險，因此可將 PR 轉 ready 並合併；在把 Windows checksum 清單正規化為可跨平台重放的 LF 版本、把 `UNSIGNED INTERNAL PREVIEW` 改為準確的公開未簽章說明、明列 macOS `0205548`／Windows `aa1ec41`／最終 tag target 三者 provenance 後，可建立 `v0.49.0` tag 與公開 Release，但發布後必須立即核對 GitHub 實際 asset digest／URL／下載內容並以 round3 結案，任何不一致都不得宣稱發布完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
