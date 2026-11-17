# 獨立審查報告：FR-027 v0.52.0 GitHub 公開發布 round12

- 審查對象 commit／版本：`85203c86112584d54e034257b83ca1e4eb3f924c`／`0.52.0`。
- 分支：`codex/0.51-anthropic-claude`；本機 HEAD 與 `origin` 分支 ref 均指向指定 SHA。
- 候選目錄：`/Users/nycu/Documents/離線字幕工廠/dist/release-0.52.0-macos-85203c8-normal/`。
- 對應 08-CHANGE-LOG 條目：`docs/project-management/08-CHANGE-LOG.md`，2026-10-20「FR-027 v0.52.0 round11 blocker 修正與發布前就緒複核」。
- 審查輪次：round12。
- 審查代理啟動時間、上下文來源：2026-10-20 04:32–04:52 UTC；本次由需求方在獨立審查上下文直接指定 commit、候選、CI 與範圍。round11 僅用來辨識歷史 blocker；以下 Git、GitHub、候選、工作紀錄、授權、揭露與 closeout 判定均由本上下文唯讀重核。
- 範圍：六面向與發布 readiness；未建立 tag／Release、未上傳資產。唯一寫入檔案為本報告。

## 1. 需求完整性

- 判定：通過。
- 證據：發布範圍在 `README.md:5-7`、`RELEASE-NOTES-0.52.0.md:20` 與發布工作紀錄 `08-CHANGE-LOG.md:34-38` 限定為 macOS arm64，明確排除 Windows 0.52.0 資產。需求方 2026-10-19 的發布授權記於 `08-CHANGE-LOG.md:49-53`，涵蓋候選／CI／hash／獨立審查／文件 gate 通過後提交、推送、建立 tag／Release 及公開 macOS arm64 資產；風險接受限定於真實 Google／Keychain／上傳未驗收、build-time advisory、ad-hoc／未公證等揭露項，且不授權略過 gate。`09-STANDING-AUTHORIZATIONS.md:5-14` 的 `AUTH-2026-07-23-01` 有效涵蓋 macOS 未 Developer ID／未公證的公開發布風險。`README.md:15-17,147-153` 與 `RELEASE-NOTES-0.52.0.md:20-25` 對 YouTube 實帳號流程、播放限制、簽章／公證、Windows 範圍、source archive 隱私處理及 advisory 有明確揭露。

## 2. 邏輯正確性

- 判定：通過。
- 證據：`git rev-parse HEAD` 與 `git ls-remote origin refs/heads/codex/0.51-anthropic-claude` 均為 `85203c86112584d54e034257b83ca1e4eb3f924c`（2026-10-20 04:38 UTC 唯讀核對）。候選 `PROVENANCE.txt:3-6` 記錄相同 branch／commit 與 `0.52.0 / macOS arm64`；GitHub Actions run `39370147881` API 回傳 `head_sha` 相同、`conclusion=success`。tracked-source 掃描 `git grep -I -nE '/Users/[^/<[:space:]]+|/private/var/folders/[^/[:space:]]+'` 只有 `scripts/test-breeze-asr.mjs:134` 一處；該行是 `SECRET_MARKER /Users/example/private` 的合成去敏測試 fixture（同檔 `:135-137` 驗證輸出不含 marker／路徑），不是帳號或個人目錄。候選 provenance `PROVENANCE.txt:8` 的掃描摘要與此相符。

## 3. 邊界情況

- 判定：通過。
- 證據：候選 `mac-arm64/離線字幕工廠.app/Contents/Info.plist` 讀得版本 `0.52.0`、最低 macOS `12.0`；`file` 顯示主程式為 Mach-O arm64。`SIGNING-STATUS-macos-arm64.txt:3-8` 記錄 ad-hoc、無 Developer ID／公證且 Gatekeeper 未測；README 與 Release notes 同樣揭露。候選 smoke `youtube-ui-smoke.png.json` 的 `playback` 欄位為 3 秒合成片、`currentTime=0.000194`、`paused=true`；比較 JSON 的 `tasks[0].playback.currentTime=0.000623`。`googleRequests=false`，cleanup JSON 記錄 process group 關閉、`forcedCleanup=false`、profile 已移除。這些證據支持有限的 UI／layout smoke 與清理結果，不支持有效播放、全長轉錄或真實 Google 驗收；`PROVENANCE.txt:20,24` 及發布說明如實限制宣稱。Windows artifact 是 unsigned internal preview，不在發行範圍。

## 4. 程式碼品質

- 判定：通過。
- 證據：`git show --stat HEAD` 顯示 85203c8 只改 `00-CURRENT-STATUS.md`、`05-DEVELOPMENT-AND-DEPLOYMENT.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`08-CHANGE-LOG.md` 四份治理文件（18 行新增、17 行刪除），沒有產品 runtime 或測試程式差異；`git diff --check` exit 0。唯讀掃描未見非合成的 tracked source 個人 home 路徑。治理紀錄是否已反映本次新候選／CI，另在第 6 節判定，不以此處的 docs-only diff 掩蓋其狀態落差。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：本機於 2026-10-20 04:38–04:47 UTC 重驗候選：`shasum -a 256 -c SHA256SUMS-macos-arm64.txt` 四項全數 OK；`hdiutil verify offline-subtitle-factory-0.52.0-macos-arm64.dmg` 回報 checksum VALID；`unzip -tq offline-subtitle-factory-0.52.0-macos-arm64.zip` 無錯；`codesign --verify --deep --strict --verbose=0 mac-arm64/離線字幕工廠.app` exit 0。`latest-mac.yml:1-11` 所列版本、DMG／ZIP 大小及 SHA-512 與候選檔案 bytes 相符；檔案大小分別為 DMG 262,456,250、ZIP 256,484,362 bytes。`PROVENANCE.txt:12-18` 列出的 SHA-256／SHA-512 及 blockmap 大小與本次 sidecar／實體檔核對一致。版本／架構另以 `plutil`／`file` 核對。

  GitHub API 唯讀核對 run `39370147881`：2026-10-20 04:32:49Z 建立、04:36:25Z 完成，`success`，branch 與 head SHA 精確相符。唯一 job 的 source regression、unsigned preview build、packaged renderer/install lifecycle、archive checksum 及 artifact upload 步驟成功；Authenticode-signed build 因無簽章憑證而 skipped，符合本版不發布 Windows 的範圍。artifact `12240369026` 名稱 `offline-subtitle-factory-0.52.0-windows-x64`、大小 `504801173` bytes、未過期。候選 `windows-ci-source-manifest-range-check-39370147881.json` 記錄只取一個 HTTP range、`436117` bytes、ZIP central-directory 7 entries；manifest source/version 正確、73 個檔案、manifest 與 checksum entry CRC／size 有效、manifest SHA-256 與 sidecar 相符、73/73 shared raw hashes 相同、0 mismatch。完整 Windows artifact 未下載，故不宣稱 whole-archive integrity。

  本次亦執行 `npm run docs:check:final`（2026-10-20 04:38–04:47 UTC），exit 1。輸出指出最新 08 entry 尚未標示「完成」；其所引 round11 報告在測試覆蓋／實際運行結果缺具體 `- 證據：` 欄、綜合判定格式、`- 阻擋問題（若有）：` 欄及完整代理聲明不符合 validator；發布授權欄位亦未按最新 entry 的解析格式提供，且授權範圍未被該 entry 的欄位明確解析為涵蓋發布操作及「未公證」風險。這些是實際 closeout gate 失敗，不由候選與 CI 通過抵銷。`scripts/project-docs-validator.mjs:17-32,53-89` 可回溯上述格式及授權檢查；本報告採其固定標題、欄位與聲明格式。round11 原件依獨立審查規則保留，不在本輪改寫。

## 6. 實際運行結果

- 判定：不通過。
- 證據：本次 GitHub 查詢確認 repository `twyderek/offline-subtitle-factory-app` 為 public；Latest Release 為 `v0.51.0`。`git ls-remote` 沒有 `refs/tags/v0.52.0`，GitHub tag ref 與 Release-by-tag API 均回 404；尚無 v0.52.0 Release/assets。

  時序核對：`git show -s --format=fuller HEAD` 記錄 85203c8 commit time 為 2026-10-20 12:32:42 +0800（04:32:42Z）；Windows run 於 04:32:49Z 啟動並以同一 head SHA 成功。候選 DMG／ZIP 的檔案時間為 12:33:12／12:33:32 +0800，候選目錄時間 12:37:06 +0800，均在 commit 後。故候選及 CI 的來源綁定與 post-commit 建置／執行時序足以支持「這些產物／CI 對應 85203c8」；範圍僅是同源候選與 73 個共享 app 檔案比對，不涵蓋完整 Windows ZIP 或 Windows 實機。

  工作紀錄卻尚未隨這些 post-commit 結果收斂：`08-CHANGE-LOG.md:5,16-18` 仍標「進行中」、稱有 4 份待提交文件，並把 1f6b207 的候選／run 寫成最新結果及把新 SHA 的 candidate／CI／round12 寫成待完成；但本機 tracked worktree 已乾淨，HEAD／origin 已是 85203c8，且本次已核實其候選與 run。`00-CURRENT-STATUS.md:5-13`、`05-DEVELOPMENT-AND-DEPLOYMENT.md:6`、`06-TEST-AND-PROCESS-AUDIT.md:3-8` 也仍以 1f6b207 為最新候選／CI，稱後續文件提交後需重建驗證。候選 `PROVENANCE.txt:22,24` 與 CI 已能證明新證據，但不能代替受控工作紀錄與結案狀態。

  final gate 的流程判斷：通用 `workflows/06-BUILD-RELEASE.md:5-17,23-25` 以測試及獨立審查通過為發布輸入，包含上傳後資產核對，並未把 `docs:check:final` 列為每次上傳前的獨立步驟；`workflows/07-DOCUMENT-CLOSEOUT.md:5-13` 以實際部署結果為輸入，將 `docs:check:final` 放在文件結案步驟，因此一般結案 gate 可在發布後執行。但本案最新 readiness 工作紀錄 `08-CHANGE-LOG.md:11,13` 明確把該 readiness 項目 `docs:check:final` 通過列為進入公開發布的前置條件；同文件發布計畫 `:36` 再明訂 round12 與 readiness gate 通過後才建立 tag／Release，並於上傳後另更新紀錄及執行 final gate。這是本案更具體的已記錄順序，因此本次 exit 1 是發布前 blocker；發布後仍須依 07 完成第二階段文件結案與資產核對。

## 綜合判定

- 結論：不通過（BLOCK）。
- 可逐字引用的完整結論句：**本輪 FR-027 v0.52.0 GitHub 公開發布前 round12 審查不通過：85203c8 的 macOS arm64 候選及 exact-source Windows CI／73 個共享檔案 hash gate 通過，來源 SHA 與 post-commit 時序相符，發布授權及已知風險揭露有證據；但本案 readiness 計畫明訂 `docs:check:final` 通過後才可進入 tag／Release，目前該 gate exit 1、最新工作紀錄與 00／05／06 仍未記錄 85203c8 候選／CI 結果且 round11 被引用時不符合 validator schema，因此目前不得建立 `v0.52.0` tag／GitHub Release 或上傳資產，直至 readiness 工作紀錄、最新審查引用與發布授權欄位依規則收斂並使發布前 final gate 通過。**
- 阻擋問題（若有）：
  - P1：發布前 readiness `npm run docs:check:final` exit 1；最新工作紀錄仍進行中，且 validator 報告 round11 review schema 與授權欄位不合規。應保持 round11 原件不變，由後續獲授權的工作紀錄連結本輪合規 round12 報告、記錄逐字完整結論與有效授權欄位，完成 readiness 結案並重跑 gate；不得以本輪報告代替工作紀錄更新或把失敗 gate 當成發布後才處理。
  - P1：`00`／`05`／`06`／`08` 尚未記錄 85203c8 的候選、run `39370147881`、artifact `12240369026` 與 range-manifest 結果，並有「待重建／待驗證」及「4 份尚未提交」的過時敘述。更新受控紀錄後，需確認它們仍描述相同 source SHA／候選／CI；若發布 source SHA 因此改變，依流程重建候選與 exact-source CI/hash gate。
- 剩餘風險：完整 Windows artifact ZIP 未下載，無 whole-archive integrity 或 Windows 實機驗收；真實 Google OAuth／Keychain／頻道授權／影片與字幕上傳未驗收；UI smoke 的合成片沒有有效播放／轉錄證據；ad-hoc、無 Developer ID／公證、Gatekeeper 未測；build-time `GHSA-hp3w-g68c-fv3c` moderate advisory 仍需於公開說明揭露。候選及 Windows preview 不得描述為已公開 Release 資產。
- 給主要開發代理的具體修正要求：依授權更新 08 的 readiness 工作紀錄與受影響的狀態／測試文件，將本輪完整結論逐字引用並連結本報告，按 validator 格式記錄發布授權；保留 round11 原件。完成後重跑 `npm run docs:check:final` 並確認結果為 exit 0、最新工作紀錄為完成且 release source／候選／CI 仍一致。上述條件達成前不得 tag、建立 Release 或上傳資產。依通用 closeout 流程，正式發布及核對資產後仍須更新發布結果並再執行 closeout。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
