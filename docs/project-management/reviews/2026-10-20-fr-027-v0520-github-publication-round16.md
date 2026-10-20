# 獨立最終發布審查報告：FR-027 v0.52.0 GitHub 公開發布 round16

- 審查對象 commit／版本：`b6b1efd6b72574f9210af74729d2cb2fd869e42d`／`0.52.0`。
- 分支：`codex/0.51-anthropic-claude`；本地 HEAD 與指定 SHA 相同。
- macOS 候選：`../dist/release-0.52.0-macos-b6b1efd-normal/`。
- Windows preview：run `39382252222`；artifact `12246485809`。
- 對應工作紀錄：`docs/project-management/08-CHANGE-LOG.md`，2026-10-20「FR-027 v0.52.0 round15 發布狀態同步與 final-source 複審」。
- 審查輪次與時間：round16；2026-10-20 07:16 UTC。此為替代獨立審查上下文；前一 round16 審查未留下報告。本報告依指定 SHA、受控文件、候選證據及 GitHub 唯讀狀態完成。
- 範圍：決定指定 v0.52.0 候選是否具備發布條件。本輪未建立 tag／Release，未推送或上傳資產。

## 綜合判定

- 結論：通過
- 可逐字引用的完整結論句：**PASS — 可依已核准範圍發布此 b6b1efd macOS arm64 候選。**
- 阻擋問題（若有）：無
- 限定範圍：只適用於來源 SHA `b6b1efd6b72574f9210af74729d2cb2fd869e42d` 對應的 macOS arm64 候選及已核准的 7 項 macOS 資產；Windows artifact 僅為內部 preview，不是發行資產。任何納入新來源變更的提交都會改變 SHA，須重新完成相符的來源、候選、CI/hash 與審查 gates。
- 剩餘風險：完整 Windows ZIP 與 Windows 實機未驗收；合成影片沒有有效播放／完整轉錄證據；真實 Google OAuth、Keychain、頻道授權與影片／字幕上傳未驗收；macOS 僅 ad-hoc 簽章、無 Developer ID／公證且 Gatekeeper 未測；`GHSA-hp3w-g68c-fv3c` 為已揭露的 moderate build-time advisory（production audit 為 0）。這些風險已在 README／Release notes 揭露並由既有授權接受，不構成本輪阻擋。

## 1. 需求完整性

- 判定：通過
- 證據：b6 同步 round15 P1 所要求的 b2b942e 驗證事實；隱私掃描僅命中三個已列明的合成 fixture。
- round15 的 P1 是受控狀態文件未記錄 b2b942e 已完成的檢查與候選／CI 證據。b6 提交將該 SHA 的事實、round15 BLOCK 與新 SHA 重驗要求同步至 `00-CURRENT-STATUS.md`、`05-DEVELOPMENT-AND-DEPLOYMENT.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`08-CHANGE-LOG.md`；`git diff --name-status b2b942e..b6b1efd` 顯示本提交僅含這些治理文件及新增 round15 報告，沒有產品程式碼變更。指定 b6 的後續驗證由候選與 CI 外部證據精確綁定。
- round15 P2 的 provenance 範圍措辭已修正。候選 `PROVENANCE.txt` 明列三個通用合成測試 fixture；本輪對 b6 tracked source 的個人路徑掃描排除已明確授權的 round12 報告後，只命中 `scripts/test-breeze-asr.mjs`、`scripts/test-ollama-ui-offline.mjs`、`scripts/test-report-optimizations.mjs`，與 provenance 列表一致。唯一授權例外及其限縮範圍見 README／Release notes；round15 原報告中的 P1／P2 要求已逐項處理。
- README 說明 YouTube 是需使用者明確同意的影音外送例外；Release notes 限定本次只發 macOS arm64，且未把 mock 或候選 smoke 宣稱為真實帳號驗收（README 第 5–15 行；Release notes 第 20–25 行）。

## 2. 邏輯正確性

- 判定：通過
- 證據：候選來源 SHA 與指定 b6 相同，app 為 0.52.0 arm64，runtime manifest 與 metadata 驗證相符。
- 候選 `PROVENANCE.txt` 記錄來源 SHA、分支、版本、建置命令及 macOS arm64；均與指定 b6 相符。候選目錄的 `SHA256SUMS-macos-arm64.txt` 四項檢查全數通過；DMG 為 246,877,219 bytes、ZIP 為 255,845,260 bytes。`latest-mac.yml` 的兩項 size 與 SHA-512 均由候選實際 bytes 重算相符。
- 本輪實測（2026-10-20 UTC）：`shasum -c SHA256SUMS-macos-arm64.txt` 全數 OK；`hdiutil verify` 回報 checksum VALID；`unzip -tq` 無錯；`codesign --verify --deep --strict` 成功。app bundle version 為 0.52.0，主 executable 為 Mach-O arm64；簽章 identity 為 ad-hoc、無 Team ID，與揭露一致。
- `PROVENANCE.txt` 另記錄 packaged runtime manifest、FFmpeg、FFprobe、Whisper CLI 與 tiny model 驗證通過。這支持指定候選封裝完整性，不代表乾淨機安裝或 Gatekeeper 驗收。

## 3. 邊界情況

- 判定：通過
- 證據：smoke 記錄 currentTime=0.000444 且 paused=true；報告與 Release notes 均未將其稱為有效播放。
- 候選 UI evidence 記錄四種視窗尺寸、OAuth 未設定錯誤在 polling 後保留、renderer fixture 12 個狀態案例通過、未觀察到 Google request，且 cleanup 確認 process group 關閉及 profile 移除。3 秒合成影片實測 `currentTime=0.000444`、`paused=true`；這只證明該 smoke 沒有有效播放進度，不證明有效播放、全長轉錄或字幕品質。畫面與 Release notes 對此範圍的描述一致。
- Windows range JSON 記錄三次相同 500,000-byte ZIP tail range 讀取，檢查 7 個 central-directory entries；manifest／checksum CRC 與大小、manifest sidecar SHA-256 均相符，manifest source/version 正確，73 個共享 app paths 的 raw SHA-256 為 73/73、0 mismatch。完整 Windows archive 未下載，故不作 whole-archive integrity 或 Windows 實機宣稱。

## 4. 程式碼品質

- 判定：通過
- 證據：b6 相對 b2b 的差異僅為治理文件與 round15 報告，沒有產品 runtime 或測試程式碼變更。
- b6 相對 b2b 的變更限於治理文件與 round15 報告；產品 runtime／測試程式碼未在該提交變更。round15 的 P1 文件同步已完成，P2 provenance fixture 範圍現與實際 tracked-source scan 一致；round15 原件保留未改。
- `08-CHANGE-LOG.md` 記錄需求方 2026-10-19 對 v0.52.0 macOS arm64 發布的明確核准及風險範圍；`AUTH-2026-07-23-01` 有效涵蓋未簽章／未公證發布，並要求持續揭露及完成 checksum／資產核對。這些授權不涵蓋略過測試、審查或來源一致性。本輪寫報告未執行發布操作。
- `workflows/06-BUILD-RELEASE.md` 與 `workflows/07-DOCUMENT-CLOSEOUT.md` 將 `npm run docs:check:final` 放在正式發布與資產核對後；本輪尚未發布，因此此結案命令尚未執行，非發布前 blocker。

## 5. 測試覆蓋

- 判定：通過
- 證據：首次 npm run check 在高 CPU 負載下失敗；隔離 core test 與未改 source 的完整重跑均通過。
- 候選 `PROVENANCE.txt` 記錄 b6 的 `npm run check` 首次在 `scripts/test-core.mjs:808` 的 Python child-close cancellation assertion 失敗，當時 macOS ZIP 封裝 CPU 負載很高；封裝結束後，獨立 `node scripts/test-core.mjs` 與完整 `npm run check` 均通過，期間沒有來源變更。這足以確認最終測試結果通過；首次失敗仍顯示取消測試在高負載下可能有時序敏感性，列為非阻擋殘餘風險。
- b6 provenance 記錄 `npm audit --omit=dev` 為 0 vulnerabilities、`git diff --check` 與 tracked-source 隱私掃描通過。Windows run 的 source／FFmpeg regression、renderer/install lifecycle、archive checksum 與 artifact upload steps 均成功；Authenticode 簽章步驟因無憑證而 skipped，與本次 Windows preview 定位及簽章揭露一致。

## 6. 實際運行結果

- 判定：通過
- 證據：run 39382252222 對 b6 成功；artifact manifest/self-checksum 與 73 個共享 app 檔案 hash 全數相符。
- GitHub run `39382252222` 為 `completed/success`，event 為 push，branch 與 head SHA 分別是 `codex/0.51-anthropic-claude` 及指定 b6。Windows job 的 source／FFmpeg regression、unsigned preview、renderer/install lifecycle、archive checksum 與 upload 步驟成功；signed package 步驟 skipped。Artifact `12246485809` 名稱 `offline-subtitle-factory-0.52.0-windows-x64`、大小 504,801,579 bytes、API digest `sha256:526b42de4dafc98955781905c5be6f9c4c9a827f685a8882fb382daf94d6248b`，未過期。GitHub Actions run／artifact API 於 2026-10-20 UTC 唯讀核對結果與候選 range JSON 一致。
- macOS 候選封裝與實測結果見第 2 節；其 provenance 明確記錄 `--publish never`。GitHub Release-by-tag 與 tag-ref API 對 `v0.52.0` 均回 404，Release list 的 Latest 仍為 `v0.51.0`；符合本輪未發布的狀態。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪未建立 tag／Release，未推送或上傳資產。
- 若上述聲明不實，本報告無效。
