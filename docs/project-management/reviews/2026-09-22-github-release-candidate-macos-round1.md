# 2026-09-22 GitHub release candidate macOS round1

審查範圍：來源 commit `53956ccdee6e16e4c0413f09312a419613b27da6`、`../dist/release-0.51.0-macos-53956cc/`、candidate evidence、`RELEASE-NOTES-0.51.0.md`、release governance 文件，以及本地 Git remote／tag／GitHub Release 狀態。

本輪只執行唯讀檢查、指令執行與驗證；未重建封裝、未重跑完整 `npm run check`、未重跑長時間測試、未執行 Windows、未 push、未 tag、未建立或修改 GitHub Release。

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/evidence/2026-09-22-github-release-candidate-macos.json` 明確記錄 release scope 為 macOS arm64-only、`windowsExecuted=false`、`releasePublishedAtEvidenceCreation=false`、`projectWideReleaseReady=false` 與 `notAReleaseYet=true`；candidate `PROVENANCE.txt` 指向來源 commit `53956ccdee6e16e4c0413f09312a419613b27da6`，且 `dirtyWorktreeChangesIncluded: false`。macOS 候選、Release notes、Windows 暫緩界線與 ad-hoc 風險均有記錄，但 GitHub push／tag／Release 尚未執行，故完整「發佈至 GitHub」需求尚未完成。

## 2. 邏輯正確性

- 判定：通過
- 證據：候選 provenance 的來源 commit 與指定審查 commit 完全一致；來源 commit 的 `package.json`／`package-lock.json` 版本均為 `0.51.0`，candidate packaged app 版本亦為 `0.51.0`。候選 `latest-mac.yml` 的 ZIP／DMG URL、path、size、SHA-512 與實際檔案重算結果一致；`SHA256SUMS-macos-arm64.txt` 的 DMG、ZIP、兩個 blockmap SHA-256 亦與實際檔案一致。DMG `hdiutil verify` 與 ZIP `unzip -t` 均通過，blockmap 可解 gzip 並符合 schema version 2。`npm audit --json --omit=dev` 實際回報 total vulnerabilities `0`，其中 high／critical 均為 `0`。

## 3. 邊界情況

- 判定：部分通過
- 證據：evidence 記錄 DMG 與 ZIP 兩條新實機 smoke 均通過 renderer、manual subtitle、real trim、post-trim、AI review assets、glossary round-trip、8 provider definitions 與清理；DMG readonly attach／detach 及 ZIP extract／isolated copy 均通過。候選 `SIGNING-STATUS-macos-arm64.txt` 與 evidence 同時明確記錄 deep strict codesign 通過，但 `spctl` exit 3／rejected，因為候選是 ad-hoc、無 Developer ID、未 notarized；這是已揭露且預期的限制，不可解讀為 Gatekeeper 通過。Windows 依需求暫緩；正式 Applications／乾淨帳號、真正斷網、真實 AI／模型品質與公開 Release 後下載驗證仍未覆蓋。

## 4. 程式碼品質

- 判定：部分通過
- 證據：本輪候選是從已提交且可追溯的 clean detached source commit 建立，沒有把 dirty worktree 變更混入候選；`TEST-CANDIDATE-README.md`、`PROVENANCE.txt`、簽章狀態、SHA256 清單、updater metadata 與 Release notes 對候選用途及限制的描述一致，且檔名使用穩定 ASCII 命名。這能證明發布包的追溯與治理文件品質，但本輪依指示未重跑完整程式碼品質／回歸檢查，也不對未涵蓋的 Windows 實機與正式簽章品質作擴大保證。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：candidate evidence 記錄 `npmCi=pass`、`npmAudit.total=0`、`npmCheck=pass`、runtime manifest／runtime verify／electron-builder 通過，以及 macOS DMG／ZIP 兩條新實機 smoke 完成；本輪唯讀重算亦確認 archive integrity、SHA-256、SHA-512、latest-mac.yml 欄位與 blockmap 結構一致。依審查限制未重跑完整 `npm run check`、build 或長時間測試；Windows renderer／安裝／解除安裝／實機測試、Developer ID／公證、真正斷網及發布後 GitHub 資產／digest／下載 URL 反向核對未覆蓋。

## 6. 實際運行結果

- 判定：部分通過
- 證據：DMG／ZIP 的 candidate evidence 均記錄 renderer smoke `pass`、manual subtitle `completed` 且 cleaned、real trim `completed`（`2.021333` 秒）、post-trim `completed`、AI／glossary／8 providers 通過並完成清理；DMG／ZIP／blockmap 的實際大小與 SHA-256、`latest-mac.yml` 的 URL／size／SHA-512 重新核對一致；本地 `gh release list` 僅見既有最高 `v0.49.1`，`gh release view v0.51.0` 回報 `release not found`，本地與 origin 均沒有 `v0.51.0` tag，指定來源 branch 也尚未出現在 origin。故 macOS 候選運行證據充分，但尚不能宣稱 GitHub 已發布。

## 綜合判定

- 結論：有條件通過
- 可逐字引用完整結論句：**本輪 macOS arm64 GitHub release candidate 的來源、npm audit、DMG／ZIP／blockmap／SHA／latest-mac.yml 與兩條新實機 smoke 均有足夠證據而有條件通過，但因候選為 ad-hoc／spctl rejected、Windows 依需求暫緩且 GitHub 尚未推送、打 tag 或建立 Release，仍不得視為已發布，下一步需由主要代理執行並完成發布後核對。**
- 阻擋問題（若有）：發布前外部操作尚未完成：來源 commit 尚未由主要代理 push，`v0.51.0` tag 尚未建立／推送，GitHub Release 尚未建立，且發布後 GitHub 資產名稱、大小、digest、直接下載 URL、checksum 與 updater metadata 尚未反向核對；本審查代理不得執行上述操作。另保留 ad-hoc／未 Developer ID／未公證的 `spctl` 限制及 Windows 暫緩狀態。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
