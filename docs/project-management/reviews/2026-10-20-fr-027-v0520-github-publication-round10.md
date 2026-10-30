# 獨立審查報告：FR-027 v0.52.0 GitHub 公開發布 round10

- 審查對象 commit／版本：`aaee1d9f1996eea3b84723a42f47d3a9adaaf9e2`／`0.52.0`。
- 分支：`codex/0.51-anthropic-claude`；審查時本機與遠端分支均指向指定 SHA。
- 候選目錄：`<candidate-dir>`（工作區相對位置：`../dist/release-0.52.0-macos-aaee1d9-normal/`）。
- 對應 08-CHANGE-LOG 條目：2026-10-20 — FR-027 v0.52.0 GitHub 公開發布（macOS arm64），`docs/project-management/08-CHANGE-LOG.md:3-28`。
- 審查輪次：round10。
- 審查時間、上下文：2026-10-20（Asia/Taipei）；由獨立審查上下文依本次要求、release workflow、指定 commit、候選證據與唯讀 GitHub 查詢執行。唯一檔案寫入為本報告。
- 審查範圍：發布前六面向審查；確認指定 source、README／Release notes、候選 macOS arm64 資產、Windows preview CI 證據、風險授權及 tag／Release 狀態。未建立 tag／Release、未上傳資產。

## 1. 需求完整性
- 判定：部分通過。
- 證據：`README.md:5-7` 與 `RELEASE-NOTES-0.52.0.md:20,29` 將本版範圍限定為 macOS Apple Silicon arm64，明確說明不提供 Windows 0.52.0 資產；08 工作紀錄 `:11-14` 亦將 Windows preview artifact 排除於發布範圍。未發現將 Windows 發行資產列入計畫的證據。
- 證據：`README.md:17`、`RELEASE-NOTES-0.52.0.md:23` 說明原始碼封存包含治理紀錄並稱個人 home prefix 已匿名化。這項完整性宣稱與下節的 exact-source scan 不符，構成發布阻擋。
- 授權：`docs/project-management/08-CHANGE-LOG.md:22-28` 記載產品負責人核准在候選、CI、hash、獨立審查與文件結案門檻通過後，發布 macOS arm64 資產；明確接受真實 Google／Keychain／頻道上傳未驗收、moderate build-time advisory、ad-hoc／未公證等風險。該授權不涵蓋機密洩漏或略過 gate。

## 2. 邏輯正確性
- 判定：不通過（P1）。
- 證據：對指定 commit 的 tracked source 執行唯讀 macOS home-directory prefix scan，共找到 4 個匹配位置；其中 3 個不是中性合成測試路徑：`docs/project-management/08-CHANGE-LOG.md:566`、`docs/project-management/reviews/2026-09-21-whisper-probe-diagnostics-round1.md:25`、`docs/project-management/reviews/2026-09-21-whisper-probe-diagnostics-round2.md:19`。其中一筆工作紀錄本身稱其為個人路徑。另有 1 個中性合成 fixture 位於 `scripts/test-breeze-asr.mjs:134`。
- 證據：候選 `<candidate-dir>/PROVENANCE.txt:8` 稱 tracked-source scan 僅剩測試 fixture；exact-source scan 顯示仍有上述 3 個歷史文件位置。`08-CHANGE-LOG.md:17` 的「無剩餘 personal home prefix」記錄也與目前指定 commit 不一致。GitHub source archive 會包含 tracked tree，因此這些位置會進入公開封存。
- 結論：目前沒有產品負責人對這 3 個殘留位置的明確風險接受。需先去識別並以新 source SHA 重做候選與同源檢查；不能以已核准的 Google、dependency 或簽章風險替代這項隱私核對。
- 已接受風險的揭露本身足夠明確：`RELEASE-NOTES-0.52.0.md:21-25` 說明真實 Google OAuth／Keychain／上傳未驗收、`GHSA-hp3w-g68c-fv3c` moderate build-time advisory 與 production audit 0，以及簽章／公證狀態。這些揭露不解除 P1。

## 3. 邊界情況
- 判定：部分通過。
- 相容性與平台宣稱：候選 `Info.plist` 版本為 0.52.0、最低系統版本為 12.0；`file`／`lipo -archs` 確認主執行檔為 arm64。這支持 macOS arm64 候選身分，不等同在所有受支援 macOS 版本實機驗收。
- Windows 範圍：CI 產物是內部 unsigned preview，不是 Windows 發行資產；Windows 不在本版資產計畫中。共享 source/app 檔案的 hash 核對不構成 Windows 實機或全平台相容性測試。
- 簽章邊界：候選使用 ad-hoc signature，未使用 Developer ID、未公證；Gatekeeper 未測。README／Release notes 有如實揭露，且落在既有授權明示範圍內。

## 4. 程式碼品質
- 判定：部分通過。
- 證據：`git diff aaee1d9^ aaee1d9` 僅涉及 `README.md`、`RELEASE-NOTES-0.52.0.md`、`docs/project-management/08-CHANGE-LOG.md` 三份文件，共 4 行新增／刪除，沒有產品 runtime 變更。把舊的「不到 1 毫秒」改成「未展示有效播放進度」可避免因量測值略高於 1 毫秒而低報；候選本身仍沒有有效播放證據。
- 限制：公開文件的路徑匿名化宣稱及候選 provenance 的 scan 摘要不符合 exact source 現況（見第 2 節），因此文件品質尚未達發布門檻。

## 5. 測試覆蓋
- 判定：部分通過。
- exact-SHA CI：GitHub run `39360760582` 為 success，head SHA 精確等於候選 SHA；artifact `12236898325`、名稱 `offline-subtitle-factory-0.52.0-windows-x64`、大小 504,801,182 bytes。run 的 source／FFmpeg regression、unsigned preview build、renderer/install lifecycle 與 archive checksum steps 均成功；簽章建置步驟因未提供簽章密鑰而跳過。可回查：[Windows CI run 39360760582](https://github.com/twyderek/offline-subtitle-factory-app/actions/runs/39360760582)。
- Windows range evidence：`<candidate-dir>/windows-ci-source-manifest-range-check-39360760582.json` 記錄 manifest checksum sidecar 相符、manifest source SHA 正確、73/73 shared path raw hashes 相符、0 mismatch。僅取回 436,126 bytes 的 ZIP byte ranges；`completeArtifactArchiveDownloaded=false`、`fullArtifactIntegrityClaim=false`。因此不宣稱完整 Windows ZIP integrity，也不把此 artifact 當 Windows 發行包。
- macOS candidate：獨立重跑 SHA-256 sidecar（DMG、ZIP、兩個 blockmap，4/4 OK）、`unzip -tq`（無錯誤）、`hdiutil verify`（VALID）、`codesign --verify --deep --strict`（成功）、runtime verifier（`[runtime] OK: darwin-arm64`）。另以實體檔重算 `latest-mac.yml` 所列 DMG／ZIP 大小與 SHA-512，均相符；bundle 版本及 arm64 架構相符。
- UI smoke：`<candidate-dir>/youtube-ui-smoke.png.json` 顯示 12 個 renderer fixture cases 通過、4 個 viewport 測量、`googleRequests=false`。3 秒合成影片記錄 `currentTime=0.000484`、`paused=true`。畫面只佐證 UI／互動，不構成有效播放、完整轉錄或真實 Google 驗收。
- P2 證據差異：候選 `PROVENANCE.txt:20` 記錄同一 smoke 的 `currentTime=0.000847`，與 smoke JSON 的 `0.000484` 不同。兩數都不足以證明有效播放，Release notes 的保守說法仍成立；重建候選時應讓 provenance 數值與原始 JSON 一致。
- 測試範圍限制：本審查未在 macOS 重跑 `npm run check`；08 工作紀錄 `:17` 記有先前候選完整 check exit 0，而 exact-SHA Windows CI 的 regression job 本輪成功。指定 SHA 相對其 parent 僅有文件變更。真實 Google client／Keychain／頻道授權／影片與字幕上傳未測。

## 6. 實際運行結果
- 判定：不通過（P1 隱私殘留尚未解除）。
- 發布就緒狀態：本機與遠端均沒有 `v0.52.0` tag；GitHub tag release API 對 `v0.52.0` 回應 404。Windows range JSON 的 `releaseTagOrReleaseCreated` 亦為 false。尚無資產上傳。
- 發布範圍：僅 macOS arm64 DMG／ZIP、blockmaps、updater metadata 與 checksum/status sidecars；不規劃 Windows 發行資產。候選檔案的格式、簽章與 metadata 檢查通過，但在 P1 未清除、P2 provenance 值未對齊前，不建議進入 tag／Release 建立階段。
- 尚待處理：去識別 3 個 tracked 歷史文件中的殘留並修正完整清理宣稱；以新 exact source SHA 重新產生／核對 macOS candidate 與同源 CI；校正候選 provenance 的播放量測值；新 SHA 由獨立審查複審後，再依既有授權評估發布。

## 綜合判定
- 結論：不通過（BLOCK）。
- 可逐字引用的完整結論句：**本輪 0.52.0 GitHub 公開發布前審查不通過：指定 source 仍有 3 個非中性的歷史 home-directory 引用會進入公開原始碼封存，且清理與 provenance 宣稱不符；先去識別並以新 SHA 重建、重核候選及同源 CI，才可進入 tag／Release 階段。**
- 阻擋問題：**P1 — source archive 隱私殘留。** 殘留位置見第 2 節；需清除後再審。
- 次要發現：**P2 — smoke 量測值不一致。** 候選 provenance 與 JSON 相差 0.000363 秒；兩者均不能證明有效播放，應在更新候選證據時校正。
- 已接受且仍需揭露的剩餘風險：真實 Google／Keychain／頻道／影片／字幕流程未實帳號驗收；`GHSA-hp3w-g68c-fv3c` moderate build-time advisory（production audit 0）；ad-hoc、無 Developer ID／公證且 Gatekeeper 未測；有效播放／完整轉錄未驗收；Windows artifact 未下載完整 ZIP，沒有 whole-archive integrity claim，也沒有 Windows 實機驗收。
- 給主要代理的要求：只處理上述殘留與量測 provenance；新 SHA 完成 candidate／CI／hash gate 後另開 round11 複審。本報告不授權跳過 gate、建立 tag／Release 或上傳資產。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、唯讀查詢與候選驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
