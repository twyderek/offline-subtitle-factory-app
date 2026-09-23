# 功能測試與流程稽核

## 測試層級

| 層級 | 工具／證據 | 最低適用情境 |
|---|---|---|
| 文件 | `npm run docs:check`、`git diff --check` | 每次變更 |
| 語法 | `node --check` | JavaScript／MJS 變更 |
| 模組／契約 | `test-media-edit`、`test-ai-optimizer`、`test-ai-providers`、`test-review-ui` | 對應功能變更 |
| 核心整合 | `test-core.mjs` | API、檔案、任務、輸出變更 |
| UI 人工 | 瀏覽器／Electron 操作、截圖 | 版面、互動、可存取性變更 |
| 封裝 | runtime verify、`7z t`、封裝清單、codesign | 每次平台打包 |
| 實機 | 安裝、啟動、轉錄、校閱、輸出、解除安裝 | 正式或公開發布 |
| 發布 | Release 資產、digest、checksum、下載 URL | 每次 Release |

治理前置流程另以 `test-project-preflight.mjs` 驗證任務路由，確保一般任務不載入完整歷史，發布與 full 類型仍包含必要治理／授權文件；未知類型必須失敗。

## 2026-09-23 npm／Node deprecation warning 依賴來源分流

- 依賴來源：`npm explain` 將 `inflight@1.0.6`／`glob@7.2.3`／`rimraf@2.6.3`／`boolean@3.2.0` 追溯至 `electron-builder@26.15.7` 的 `app-builder-lib`、`@electron/asar`、`electron-winstaller` 與 `global-agent` transitive toolchain；`npm ls punycode --all` 為空，專案 manifest／lockfile 也無 `punycode`。
- 安全判定：`npm audit --json` 漏洞總數為 0（info／low／moderate／high／critical 均為 0）；因此這些是上游 dev／optional toolchain deprecation warnings，不是本專案 vulnerability。本輪不加 `overrides`、不重寫 lockfile、不升級 Electron／electron-builder。
- 開發驗證：依賴來源分流、完整 `npm run check`、`git diff --check` 與文件檢查通過；未修改產品、workflow、依賴 manifest、Release 或 Windows 實機範圍。
- 範圍判定：warning 來源已分流但未宣稱已修復；後續僅在 electron-builder／app-builder-lib 上游版本或 warning 風險改變時重新評估。獨立報告：`docs/project-management/reviews/2026-09-23-deprecation-warning-triage-round1.md`。

## 2026-09-23 BUG-032 Windows CRLF source-contract test 修正

- 問題重現：現行 `scripts/test-breeze-asr.mjs` 的 Breeze 函式擷取 regex 在 LF source 可匹配，但將同一份 `public/app.js` 重放為 CRLF 時無法匹配 `}\n\nfunction updateAsrEngineUi` 邊界；本機重現輸出為 `lfMatch=true`、`crlfMatch=false`。產品函式實際存在，故根因是測試換行格式假設。
- 最小修正：測試讀取 `public/app.js` 後將 CRLF 正規化為 LF，再執行既有 source-contract 與 `updateBreezePerformanceNotice` 行為 assertions；新增 LF→CRLF→LF fixture assertion，沒有修改產品 runtime 或公開 v0.51.0 Release。
- 開發驗證：`node scripts/test-breeze-asr.mjs`、完整 `npm run check`、`git diff --check` 均通過；Windows preview run `35804611051`（修正 commit `e8ccee8`）亦成功完成 source／FFmpeg regression、preview package、renderer／install lifecycle、archive／SHA-256 與 artifact upload。獨立 round1／round2 審查報告：`docs/project-management/reviews/2026-09-23-bug-032-windows-crlf-round1.md`、`docs/project-management/reviews/2026-09-23-bug-032-windows-crlf-round2.md`。
- 範圍判定：此輪已解除跨平台自動測試誤判；Windows preview runner 成功不等於 Windows 實機安裝／renderer／轉錄品質驗收，該等項目仍依需求方要求暫緩；不修改公開 v0.51.0 Release。

## 2026-09-23 Windows CI Actions runtime 升級核對

- 變更：`.github/workflows/windows-preview.yml` 將 `actions/checkout@v4`／`actions/setup-node@v4`／`actions/upload-artifact@v4` 升至 `@v5`／`@v5`／`@v6`；Node 22、Windows 2022、測試／封裝條件、artifact path 與 permissions 未變。
- 開發驗證：YAML parse、action ref assertion、完整 `npm run check`、`git diff --check` 通過；Windows preview run `35807444485` 結論 `success`，source／FFmpeg regression、unsigned package、renderer／install lifecycle、archive／SHA-256 與 artifact upload 均成功。run log 未出現三個 Node.js 20 Actions runtime deprecation annotation。
- 殘留警告與工具限制：run log 仍有獨立 Node `punycode` 與 npm transitive package deprecation warnings，本輪不處理；本機沒有 `actionlint`，只以 YAML parser／action ref assertion 替代。這些限制不影響本輪 action major upgrade 的 Windows run success，但不宣稱所有 warning 已清零。
- 範圍判定：本輪只收斂 GitHub Actions runtime warning；Windows 實機安裝／renderer／轉錄品質、真實模型品質、正式簽章／公證與公開 Release 均未驗收或修改。
- 獨立審查：`docs/project-management/reviews/2026-09-23-windows-actions-node24-round1.md` 判定有條件通過；Windows run `35807444485` 已補足其唯一 CI runner 驗收條件。

## 2026-09-22 0.51.0 GitHub Release 發布後核對（macOS arm64；Windows 暫緩）

- 發布結果：`v0.51.0` 已公開且標示 Latest：<https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.51.0>；GitHub API 回報 `draft=false`、`prerelease=false`、9 項資產，annotated tag 解析至 commit `53956ccdee6e16e4c0413f09312a419613b27da6`。
- 開發驗證：發布來源 commit 已完成 `npm ci`、`npm audit`（0 vulnerabilities）、`npm run check`、`git diff --check`；macOS arm64 DMG／ZIP 兩條新實機路徑均完成 renderer／手動字幕／real trim／post-trim／AI review／glossary／8 provider smoke 與 cleanup。發布前候選 evidence：`docs/project-management/evidence/2026-09-22-github-release-candidate-macos.json`。
- 發布資產核對：GitHub API 的 9 項資產名稱／byte size／SHA-256 digest／直接下載 URL 與本機候選一致；正式下載 URL 回讀 DMG `242742979` bytes、ZIP `249963233` bytes、`latest-mac.yml` `566` bytes、SHA256 清單 `474` bytes，四者 hash 均與本地一致。`latest-mac.yml` 的 ZIP／DMG path、size、SHA-512 與發布資產一致；release notes 與本地檔案除 GitHub 自動附加的尾端換行外一致。發布後 evidence：`docs/project-management/evidence/2026-09-22-github-release-post-publish.json`。
- 簽章與限制：DMG／ZIP deep strict codesign 通過；`spctl` exit 3／rejected，符合 ad-hoc、未 Developer ID、未公證限制，不宣稱 Gatekeeper 通過。Windows 未做實機驗收；branch／tag push 觸發的 preview runs `35700305138`、`35700315448` 均因 `test-breeze-asr.mjs` 找不到可測試 Breeze 效能提示更新函式而失敗，不能代替 Windows 驗收。
- 稽核判定：macOS arm64-only GitHub Release 的來源、封裝、實機 smoke、公開資產、metadata、digest 與下載回讀均完成；Windows、正式 Applications／乾淨帳號、真正斷網、真實 AI／模型品質、Developer ID／公證／Gatekeeper 仍是明確遺留風險，不因本次發布擴大宣稱完成。

## 2026-09-22 0.51.0 macOS 實機驗收（Windows 暫緩）

- 本輪依需求方要求只驗收 macOS Apple Silicon，Windows 不執行；使用既有 `../dist/test-build-0.51.0-macos-88da220/` DMG，未重建候選、未修改產品 runtime、未上傳／推送／建立 tag／發布。
- 實際流程：`hdiutil attach -nobrowse -readonly` 掛載 DMG；將 app 複製到隔離 `/private/tmp/<acceptance>/Applications/` 路徑；執行 `codesign --verify --deep --strict`、`spctl --assess --type execute` 與 `scripts/verify-electron-renderer.mjs`；最後 `hdiutil detach -force`，並移除隔離 app。
- 開發驗證：DMG 掛載 exit 0；隔離 app 複製與移除通過；deep strict codesign 通過；renderer smoke exit 0。首頁／Electron bridge／設定、Breeze 首次選擇開啟／取消、手動字幕任務 `completed`／cleaned SRT、real trim `completed`（2.021333 秒）、post-trim subtitle job、AI review assets、glossary round-trip、8 provider marker 與 folder flow 均通過；DMG detach exit 0。
- Gatekeeper：`spctl` exit 3／`rejected`；候選是 ad-hoc、未 Developer ID、未公證，故此結果是預期簽章限制，不是 renderer 啟動失敗，也不宣稱 Gatekeeper 通過。
- 非敏感 evidence：`docs/project-management/evidence/2026-09-22-macos-real-machine-acceptance-rel-047.json`；只保存來源 commit／SHA、狀態、流程摘要與清理結果，不保存 token、API key、完整字幕或使用者資料。
- 範圍判定：本輪證明既有 0.51.0 macOS arm64 DMG 在目前實機可掛載、隔離安裝並完成限定 renderer／字幕／trim／校閱 smoke；不代表目前 dirty worktree 已重建、不代表 Developer ID／公證／Gatekeeper、正式 Applications／乾淨帳號、真正斷網、真實 AI／模型品質或公開 Release 完成。Windows 依需求方決策暫緩。

## 2026-09-22 0.51.0 macOS ZIP／隔離安裝路徑補驗（Windows 暫緩）

- 本輪依需求方要求繼續補驗 macOS，Windows 不執行；使用同一 `../dist/test-build-0.51.0-macos-88da220/` ZIP，未重建候選、未修改產品 runtime、未上傳／推送／建立 tag／發布。
- 實際流程：`unzip -t` integrity、`ditto -x -k` 解壓至隔離暫存、複製 app 至隔離 Applications-like 路徑；執行 `codesign --verify --deep --strict`、`spctl --assess --type execute`、`xattr -l` 與 `scripts/verify-electron-renderer.mjs`；最後移除隔離 app／解壓目錄。
- 開發驗證：ZIP integrity／解壓／隔離複製／cleanup 均通過；deep strict codesign 通過；renderer smoke exit 0。首頁／Electron bridge／設定、Breeze 開啟／取消、手動字幕 `completed`／cleaned SRT、real trim `completed`（2.021333 秒）、post-trim subtitle job、AI review、glossary、8 provider marker 與 folder flow 均通過。
- 安全狀態：`xattr` 執行通過，未發現 `com.apple.quarantine`，但存在 `com.apple.provenance`；`spctl` exit 3／`rejected`，符合 ad-hoc／未 Developer ID／未公證候選的預期限制，不宣稱 Gatekeeper 通過。
- 非敏感 evidence：`docs/project-management/evidence/2026-09-22-macos-zip-acceptance-rel-047.json`；不保存 token、API key、完整字幕或使用者資料。
- 範圍判定：本輪補足同一 macOS 候選 ZIP 路徑的實機解壓／隔離安裝／renderer／字幕／trim／清理 evidence；不代表目前 dirty worktree 已重建、不代表正式 Applications／乾淨帳號、Developer ID／公證／Gatekeeper、真正斷網、真實 AI／模型品質、Windows 或公開 Release 完成。

## 2026-09-22 0.51.0 macOS clean-HEAD 候選重建與 smoke（Windows 暫緩）

- 本輪於隔離 detached worktree 以目前 HEAD `17df9788abf2cf964d52df10b74f9a8fcd7a45d6` 建立新 macOS arm64 directory candidate，輸出為 `../dist/test-build-0.51.0-head-17df978/`；目前 dirty worktree 未提交變更刻意不納入，既有候選未覆寫，Windows 不執行。
- `npm run runtime:manifest:mac`、`npm run runtime:verify:mac` 與 `npx electron-builder --mac --arm64 --dir --publish never --config.directories.output=...` 均 exit 0；Electron `43.3.0`、electron-builder `26.15.7`，packaged `package.json` version `0.51.0`。
- packaged runtime manifest／FFmpeg／FFprobe／Whisper.cpp／Tiny SHA-256 已保存；`OFFLINE_SUBTITLE_TOOLS_DIR=<packaged tools>` 的 runtime verify 通過；`codesign --verify --deep --strict` 通過。`spctl --assess --type execute` rejected，因 ad-hoc／未 Developer ID／未公證，屬預期限制。
- 新候選 `scripts/verify-electron-renderer.mjs` smoke exit 0：首頁／Electron bridge／設定、Breeze 開啟／取消、手動字幕 `completed`／cleaned SRT、real trim `completed`（2.021333 秒）、post-trim subtitle job、AI review／glossary／8 provider、隔離 userData cleanup 均通過。
- 非敏感 evidence：`docs/project-management/evidence/2026-09-22-macos-clean-head-candidate.json`；候選 provenance／簽章說明保存於 `../dist/test-build-0.51.0-head-17df978/PROVENANCE.txt` 與 `SIGNING-STATUS-macos-arm64.txt`。
- 範圍判定：本輪解除既有候選「落後目前 HEAD」的來源追溯問題，但只代表 clean HEAD，不包含 dirty worktree 的未提交變更；不代表 Developer ID／公證／Gatekeeper、正式 Applications／乾淨帳號、真正斷網、真實 AI／模型品質、Windows 或公開 Release 完成。

## 2026-09-22 0.51.0 macOS clean-HEAD DMG／ZIP 封裝與實機驗收（Windows 暫緩）

- 本輪於隔離 detached worktree 以目前 HEAD `17df9788abf2cf964d52df10b74f9a8fcd7a45d6` 執行 `npx electron-builder --mac --arm64 --publish never`，輸出為 `../dist/test-build-0.51.0-head-17df978-packaged/`；dirty worktree 未提交變更刻意不納入，既有候選未覆寫，Windows 不執行。
- 建置與靜態核對：runtime manifest／verify、electron-builder（Electron `43.3.0`／electron-builder `26.15.7`）、packaged version `0.51.0`、DMG `hdiutil verify`、ZIP `unzip -t`、gzip blockmap schema v2、packaged runtime verify、deep strict codesign 與 DMG／ZIP SHA-256 均通過；`publish=never` 未產生 `latest-mac.yml`，未執行發布。
- 封裝實機流程：DMG readonly attach／隔離 mounted app／renderer smoke／detach cleanup 與 ZIP integrity／隔離解壓／Applications-like copy／renderer smoke／cleanup 均通過；兩條路徑均完成首頁／bridge／設定、Breeze 開啟／取消、手動字幕 `completed`／cleaned SRT、real trim `completed`（2.021333 秒）、post-trim subtitle job、AI review／glossary／8 provider smoke。
- 安全狀態：兩條路徑 deep strict codesign 通過；`spctl` 均 exit 3／`rejected`，符合 ad-hoc／未 Developer ID／未公證候選限制，不宣稱 Gatekeeper 通過；ZIP 解壓／隔離安裝未發現 `com.apple.quarantine`。
- 非敏感 evidence：`docs/project-management/evidence/2026-09-22-macos-clean-head-packaged-acceptance.json`；候選 provenance／簽章／SHA 說明保存於 `../dist/test-build-0.51.0-head-17df978-packaged/PROVENANCE.txt`、`SIGNING-STATUS-macos-arm64.txt` 與 `SHA256SUMS-macos-arm64.txt`。
- 範圍判定：本輪證明目前 clean HEAD 的 macOS arm64 DMG／ZIP 可通過容器完整性、隔離實機 renderer／字幕／trim smoke 與清理；不代表 dirty worktree 變更、Developer ID／公證／Gatekeeper、正式 Applications／乾淨帳號、真正斷網、真實 AI／模型品質、Windows 或公開 Release 完成，`releaseReady=false`。

## 2026-09-22 0.51.0 macOS clean-HEAD updater metadata 補齊與核對（Windows 暫緩）

- 本輪不重建既有 clean-HEAD candidate；於 `../dist/test-build-0.51.0-head-17df978-packaged/` 新增本機 QA 用 `latest-mac.yml`，來源 commit `17df9788abf2cf964d52df10b74f9a8fcd7a45d6`，dirty worktree 未提交變更未納入，Windows 不執行。
- 以 Node crypto／檔案 stat 逐項重算：ZIP `249959684` bytes／SHA-512 `9cpksJ2PdeZAIJ90HuaPvT059uhuDsKMRwfNlRqJtP2TEra7AiEPf6z0HjmVwJQ37eKpcHICO4tgjSxZdT3tjA==`；DMG `242720449` bytes／SHA-512 `xY4+XKG39LvbvHNHt/DXEXzbbCwhHtrKTNXspdf0mKTexfeWWzkcgtL/cuQzQJldvzVO8U5KPA2/kOc4yVE4VQ==`；URL、top-level path／SHA-512 與實體檔案一致。
- `shasum -a 256 -c SHA256SUMS-macos-arm64.txt`、DMG `hdiutil verify` 與 ZIP `unzip -t` 重放均通過；上一輪 DMG／ZIP 實機 renderer／字幕／trim smoke evidence 重用，不宣稱本輪重新安裝或重新建置。
- 非敏感 evidence：`docs/project-management/evidence/2026-09-22-macos-clean-head-updater-metadata.json`；候選 `TEST-CANDIDATE-README.md`／`PROVENANCE.txt` 已補充 metadata 是 local QA、非發布資產。
- 範圍判定：`latest-mac.yml` 缺口已在本機 candidate 層級補齊並核對，但 `publish=never`、未上傳／未發布，故不代表公開 updater metadata、Developer ID／公證／Gatekeeper、正式 Applications／乾淨帳號、真正斷網、真實 AI／模型品質、Windows 或公開 Release 完成，`releaseReady=false`。

## 2026-09-22 0.51.0 GitHub Release macOS candidate（Windows 暫緩）

- 發布來源：先將目前已盤點的產品／測試／治理變更提交為 `53956ccdee6e16e4c0413f09312a419613b27da6`，再於乾淨 detached worktree 建置 `../dist/release-0.51.0-macos-53956cc/`；dirty worktree 未提交變更未納入，Windows 不執行。
- 開發驗證：`npm ci`、npm audit（0 vulnerabilities）、`npm run check`、runtime manifest／verify、Electron `43.3.0`、electron-builder `26.15.7`、packaged version `0.51.0`、deep strict codesign 均通過。
- 資產驗證：DMG `242742979` bytes／SHA-256 `2fd5ee33b74c19cf65791f844be645becc3482d2eba2538a38e3343f2e17263d`、ZIP `249963233` bytes／SHA-256 `e5499742edf2660a9e7fafcd7fde7eb5d513fa1e6523ea33bbc30019d507d260`；DMG `hdiutil verify` VALID、ZIP `unzip -t` 無錯、blockmap／SHA256／`latest-mac.yml` URL／path／size／SHA-512 一致。
- 實機驗收：新候選 DMG readonly attach／renderer／手動字幕／real trim `2.021333` 秒／post-trim／AI review／glossary／8 providers／detach cleanup，以及 ZIP 解壓／隔離安裝／同等 smoke／cleanup 均通過；兩條路徑 `spctl` exit 3／rejected，符合 ad-hoc／未 Developer ID／未公證限制，ZIP 未發現 quarantine。
- 非敏感 evidence：`docs/project-management/evidence/2026-09-22-github-release-candidate-macos.json`；候選 `PROVENANCE.txt`／`SIGNING-STATUS-macos-arm64.txt`／`SHA256SUMS-macos-arm64.txt`／`latest-mac.yml`／README 均已保存。
- 發布前判定：macOS-only release scope 已具備發布證據，但尚未 push／tag／建立 GitHub Release；Windows、Developer ID／公證、正式 Applications／乾淨帳號、真正斷網、真實 AI／模型品質仍不在本輪完成範圍。

## 2026-09-22 0.51.0 release-readiness 本機候選核對

- 本輪只讀既有 `../dist/test-build-0.51.0-macos-88da220/` 與 `../dist/test-build-0.51.0-91eca2b/`，未上傳、推送、建立 tag 或修改使用者資料；完整摘要保存於 `docs/project-management/evidence/2026-09-22-release-readiness-audit.json`。
- runtime：`npm run runtime:verify:mac` 與 `npm run runtime:verify` 均通過；兩平台候選 SHA-256 manifest 與 metadata size／SHA-512 核對通過。macOS ZIP `unzip -t`、DMG `hdiutil verify`、解壓後 0.51.0 packaged app、deep strict ad-hoc codesign、credential／超大檔排除通過；Windows unpacked executable 為 PE32+ x86-64，packaged version 0.51.0，未發現 credential 檔。
- 限制：主機沒有 7z，Windows Setup／Portable container test 未執行；沒有 Windows 實機，因此未驗證安裝／解除安裝／renderer／SmartScreen／Authenticode／離線行為。macOS 候選為 ad-hoc、未 Developer ID／公證，乾淨安裝／Gatekeeper 也未驗證。
- 阻擋：macOS／Windows 候選 provenance 分別為 `88da220`／`91eca2b`，目前 HEAD 為 `17df978`，且工作樹有 111 個變更路徑；候選不是目前工作樹的可發布資產。release-readiness 判定為不可發布，需先從乾淨且明確的來源重建並重新驗證。

## 2026-09-21 FR-020／NFR-006 長音訊來源 SRT 完整性證據補強

- `scripts/verify-whisper-long-media.mjs` 的 evidence schema 升為 v3；可接收明確來源 SRT 路徑，未提供時使用輸入影片相鄰的 `.edited.srt`（若存在），只讀計算 basename／大小／before SHA-256／after SHA-256，不保存字幕文字。
- 短音訊與完整影片 replay 均通過；完整 evidence `docs/project-management/evidence/2026-09-21-whisper-long-media-small-srt-integrity.json` 記錄來源 SRT before／after hash 相同、`sourceSrtHashChecked=true`、`originalSrtModified=false`，Whisper exit 0、2,509 segments、非空 SRT／JSON、temp root removed=true。
- 若來源 SRT 在 probe 前後 hash 不一致或檔案消失，程式會以 `SOURCE_SRT_MODIFIED` 失敗並保存非敏感 failure evidence；本輪未修改來源影片或 SRT，也不以來源字幕當作 Whisper 品質 ground truth。
- 範圍判定：本輪只補強原始 SRT 完整性可回溯性；仍不涵蓋字幕語意正確率、人工影音校閱、confidence／no-speech、真實 bundled Metal crash→CPU fallback、跨平台、乾淨安裝或發布。

## 2026-09-21 FR-020 bundled Whisper 長音訊 runtime／輸出基線

- 新增隔離 probe `scripts/verify-whisper-long-media.mjs`，只讀需求方已提供的 `/Users/nycu/Downloads/20260909.mp4`，以 bundled FFmpeg 抽取 16 kHz mono FLAC，再以 bundled Whisper.cpp Small 執行完整影片；不讀既有 SRT 作為 ground truth，不呼叫外部服務、不執行 LM Studio、不修改原始影片／SRT。
- 受控本機 replay evidence `docs/project-management/evidence/2026-09-21-whisper-long-media-small-redacted.json` 通過：輸入 5,416.349667 秒、Whisper exit 0／signal null、2,509 transcription segments、23,697 Unicode code points、最後 segment 5,407.58 秒；SRT 161,545 bytes、JSON 5,666,118 bytes，temp root 已清理。
- evidence schema v2 只保存 input／runtime／model hash、命令摘要、exit／signal、輸出 hash／大小與統計；`stdoutSummary.contentStored=false`、`fullTranscriptStored=false`，不保存字幕文字。先前 v1 意外保存 stdout 字幕尾端的中間 evidence 已移除。
- 範圍判定：這證明本機 bundled 長音訊執行與非空輸出／清理基線，不是中文辨識或翻譯品質通過；本次 JSON 沒有 segment-level confidence／no-speech probability 欄位，因此不宣稱該品質訊號；`deviceObserved=null`，也沒有真實 bundled Metal crash→CPU fallback 證據。預設 sandbox 的短音訊 SIGSEGV 仍只屬執行環境邊界，不取代本次受控 replay。

## 2026-09-21 BUG-WHISPER-METAL-139 production probe 啟動診斷可觀測性

- `scripts/verify-whisper-real-fallback.mjs` 改以 pipe 收集 server stdout／stderr，evidence schema 升為 v2，記錄 PID、ready phase、最後 exit code／signal 及固定 1600 字元尾端摘要。
- 診斷摘要只保存遮罩後內容：API key／authorization／token／secret／password／credential、Bearer／Basic 值與 `/Users`／暫存目錄路徑均遮罩；不保存完整 log、不讀使用者媒體、不呼叫外部服務。
- 預設 sandbox round2 evidence `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-round2-default.json` 仍在 ready 前 exit 0，但 stderr 尾端明確記錄 `listen EPERM`，job 未建立；這是環境啟動邊界，不是 Metal failure 或 CPU fallback。round1 evidence 保留作為修正前對照。
- 受控本機權限 round2 evidence `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-diagnostics-round2-escalated.json` 仍完成 `completed/ready-review`、`whisperDevice=metal`、`fallbackObserved=false`，輸出與 stale partial 清理通過；只讀 assertions 確認 probe token 未出現在診斷欄位。
- 範圍判定：本輪只改善 acceptance probe 可觀測性，不修改產品 `server.mjs`、fallback policy、bundled runtime／模型，也不把診斷結果升格為真實 bundled Metal crash→CPU fallback 證據。

## 2026-09-21 BUG-WHISPER-METAL-139 bundled production server Metal failure 邊界重播

- 以同一 `scripts/verify-whisper-real-fallback.mjs`、同一 bundled `whisper-cli`／Tiny、同一 1 秒 16 kHz mono 合成 WAV 與 `NODE_ENV=production` server 重播兩次；輸入不讀使用者媒體、不呼叫外部服務，LM Studio 未執行。
- 預設 sandbox evidence `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-default.json`：server 在 ready 前 exit 0，job 未建立；此為執行環境無法完成 loopback server 啟動的失敗證據，不可解讀為 Metal crash 或 fallback 結果。
- 受控本機權限 evidence `docs/project-management/evidence/2026-09-21-whisper-real-server-fallback-escalated.json`：production server 完成 `ready-review`，`asrEngine=whisper.cpp`、`whisperDevice=metal`、`fallbackObserved=false`，SRT／JSON／draft 存在且 stale partial／暫存 WAV 清理；沒有觀察到 Metal exit／signal 或 CPU fallback。
- 範圍判定：同一 bundled runtime 在本次受控 server replay 正常走 Metal，預設 sandbox 只重現 server 啟動權限邊界；本輪仍沒有同一次真實 bundled Metal crash→CPU fallback evidence，不修改產品 fallback 策略。

## 2026-09-18 BUG-WHISPER-METAL-139／BUG-026 production-mode bundled CPU retry 取消

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`BUG-026`、`FR-003`、`FR-020`、`FR-022`、`NFR-005`、`NFR-006`。
- macOS arm64 受控權限 `npm run acceptance:whisper:bundled-cpu-cancel -- docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-final.json` exit 0；修正前全新 `/private/tmp/20260918-whisper-bundled-cpu-cancel-repeat.json` 亦 exit 0。`NODE_ENV=production` server 使用本機合成 60 秒靜音 WAV、bundled FFmpeg／Tiny；wrapper 只注入首次 Metal exit 139／partial outputs，CPU retry 實際 spawn bundled `whisper-cli --no-gpu`，ready marker 後 API 取消。正常重播均見 `running/cancelling`→`cancelled`、wrapper SIGTERM、真實 child `signal=SIGTERM`／close、無強制 SIGKILL，精確 `metal`／`cpu` 兩次 invocation。
- 取消前的 partial SRT／JSON、quality metadata 由 probe 明確注入，非 CLI 自行輸出；最終固定 SRT／JSON／draft／quality／暫存 WAV 檔案完全不存在，非 ASR edit plan 保留。evidence 保存 binary／model SHA-256、重播命令、執行前提與範圍標記；較早只檢查非空輸出的 evidence `2026-09-18-whisper-bundled-cpu-cancel.json` 保留未覆寫。
- round1 審查指出 API 不可用時原 probe 只停止 server、無法證明子孫程序關閉；修正為獨立 process group 有界 SIGTERM／必要時 SIGKILL 並確認 group 消失後才刪 temp。受控權限 `npm run acceptance:whisper:bundled-cpu-cancel -- --simulate-cancel-api-loss docs/project-management/evidence/2026-09-18-whisper-bundled-cpu-cancel-api-loss-final.json` 預期 exit 1、`status=fail`／`code=PROBE_CANCEL_API_LOSS`，但 `cleanup.expectedFaultSafelyHandled=true`、`groupGone=true`、bundled child `signal=SIGTERM`／close、`tempRootRemoved=true`。可用 `node -e` 讀新 evidence 並斷言上述欄位；先前 EPERM 診斷暫存已在確認無相關 process 後移除。
- 相鄰回歸：新增 process group 收尾後 `npm run acceptance:whisper:hybrid-fallback -- /private/tmp/20260918-whisper-hybrid-after-group-cleanup.json`、舊 `npm run acceptance:whisper:production-fallback -- /private/tmp/20260918-whisper-controlled-after-group-cleanup.json` 均 exit 0；最終腳本 Node 語法、evidence JSON assertions、`git diff --check` 與完整 `npm run check` 均 exit 0。
- 範圍判定：這是受控 Metal failure＋wrapper 轉送訊號後真實 bundled CPU 子程序取消，不是 bundled Metal 自身 crash，也非 server 直接發訊號給 CLI；60 秒靜音並未完整轉錄，不代表長音訊品質／效能、中文語音、Windows 或乾淨安裝。round2 獨立複審通過；LM Studio 依需求方決策未執行。

## 2026-09-18 BUG-WHISPER-METAL-139 production-mode hybrid bundled CPU retry

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`、`NFR-005`、`NFR-006`。
- `npm run acceptance:whisper:hybrid-fallback -- docs/project-management/evidence/2026-09-18-whisper-hybrid-fallback-replay.json` 在 macOS arm64 受控權限 exit 0：`NODE_ENV=production`、localhost 隔離資料、生成 1 秒靜音 WAV、bundled FFmpeg／Tiny；wrapper 首次注入 exit 139／partial SRT／JSON，CPU `--no-gpu` 委派 bundled `whisper-cli`。新 evidence 記錄 binary／model hash、`metal`／`cpu` 兩次 invocation、CPU child exit 0、`completed/ready-review`、`whisperDevice=cpu`、fallback logs、draft／SRT／JSON、stale partial 不存在、暫存 WAV 清理，以及可直接使用新檔名重播的命令和環境前提；原始不含 replay 欄位的 evidence 保留。
- 舊 `npm run acceptance:whisper:production-fallback -- /private/tmp/20260918-whisper-production-fallback-hybrid-recheck.json` exit 0；`node --check scripts/verify-whisper-production-fallback.mjs` 與完整 `npm run check` exit 0。新 hybrid 探針不是預設 `npm test` 的一部分，需具備 bundled runtime 並在 macOS arm64 受控權限重播。
- 範圍判定：首次 Metal failure 是 wrapper 受控注入，不是 bundled Metal 實際 crash；CPU 則為真實 bundled runtime。本證據不關閉同次真實 Metal crash→CPU 門檻，也不代表中文語音品質、長音訊、Windows、乾淨安裝或發布。LM Studio 依需求方決策未執行。
- 獨立審查：round1 指出 JSON 缺 replay 命令；另存新 evidence 修正後，round2 在受控權限重播 hybrid、舊 controlled 與完整 `npm run check`，但報告欄位／聲明未通過治理格式驗證。獨立 round3 以固定格式重新核對未變更的 script／evidence SHA-256、先前實測與本輪治理、語法、差異檢查，六面向通過；合規報告為 `docs/project-management/reviews/2026-09-18-whisper-hybrid-bundled-cpu-round3.md`，前兩輪原文保留。

## 2026-09-18 BUG-WHISPER-METAL-139 Metal→CPU retry 取消交界整合

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`BUG-026`、`FR-003`、`FR-020`、`FR-022`、`NFR-005`、`NFR-006`。
- deterministic 條件：macOS arm64 Whisper.cpp fixture 以 Metal exit 139 觸發 fallback；第二次 `--no-gpu` child 寫出 partial SRT／JSON 並安裝 SIGTERM handler 後才寫 `whisper-cpp-cpu-retry-ready` marker。測試只在 marker 出現後發送取消 API，避免把 child 尚未就緒的時序差異當成產品缺陷。
- 核心斷言：取消前已記錄 `Metal exit 139`／`CPU fallback`；API 取消後狀態先為 `running/cancelling`，child 收到 SIGTERM 並 close 後才成為 `cancelled`，最終 metrics 為 CPU；invocation 精確為 `metal`／`cpu`，沒有第三次 child；`whisper-input.wav`、partial SRT／JSON、quality metadata 與 draft 不存在，`edit-plan.json` 保留且沒有 stale Metal output marker。
- 開發驗證：`node --check`（fixture／core）exit 0；受控權限 `node scripts/test-core.mjs` 連續三次 exit 0，完整 `npm run check` exit 0，`git diff --check` exit 0；摘要保存於 `docs/project-management/evidence/2026-09-18-whisper-retry-cancellation.json`。現有產品 `server.mjs` 無需修改。
- 範圍判定：只證明 deterministic child 已就緒後的 API 取消，不代表真實 bundled runtime 的 Metal crash→CPU retry 取消、同一 Metal close callback 內的不可外部插入窗口、Windows taskkill、長音訊、中文品質、乾淨安裝或發布。LM Studio 依需求方決策未執行。

## 2026-09-18 BUG-WHISPER-METAL-139 CPU fallback 再失敗終止與清理

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`、`NFR-005`、`NFR-006`。
- 修正前重現：fixture 讓 Metal child 先 exit 139 並留下 partial SRT／JSON，CPU `--no-gpu` child 再寫 partial outputs 後 exit 7；受控權限 `node scripts/test-core.mjs` 於 `CPU retry 失敗後不得殘留 partial SRT` 斷言 exit 1，actual 為 `true`。任務已終止且 invocation 為 `metal`／`cpu`，缺口限於終止性 failure 沒有清理 CPU partial outputs。
- 最小修正：`runWhisperCpp` 在進入 fallback 前及不再 retry 的 process failure reject 前，共用既有固定輸出清理 helper；範圍只有 `whisper-cpp-output.srt`／`.json` 與 `quality-metadata.json`，不刪除輸入、使用者字幕或其他工作檔。
- child-process integration：修正後受控權限 `node scripts/test-core.mjs` exit 0；CPU failure 任務為 `failed`、`whisperDevice=cpu`、message 含 `Whisper.cpp exit 7`，既有 logs 保留 `Metal exit 139`／`CPU fallback`；invocation 精確為 `metal`、`cpu`，CPU failure marker 存在，stale partial marker、SRT、JSON 與 draft 均不存在。
- 完整回歸：Node 語法與受控權限 `npm run check` exit 0，涵蓋 fallback policy、三模型、下載、SRT／quality、Breeze、Electron、文件治理、媒體、AI、UI 與核心 API；摘要保存於 `docs/project-management/evidence/2026-09-18-whisper-cpu-retry-failure.json`。
- 範圍判定：本輪是 macOS arm64 deterministic child-process failure integration，不代表真實 bundled server crash→CPU failure、取消與 retry 交界、長音訊、中文品質、其他 macOS 架構、Windows、乾淨安裝或發布已驗收。LM Studio 依需求方決策未執行。

## 2026-09-18 BUG-WHISPER-METAL-139 SIGSEGV signal-aware fallback

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`、`NFR-005`、`NFR-006`。
- 策略矩陣：`node scripts/test-whisper-fallback-policy.mjs` exit 0；macOS arm64 首次 Metal 嘗試對 exit 1、exit 139、`signal=SIGSEGV` fallback，對 exit 0、null 且無 signal、字串 exit、`forceCpu=true`、其他平台／架構不 fallback；log parser 同時覆蓋非零 exit／signal＋CPU marker，拒絕 exit 0 或缺少 CPU marker 的假陽性。
- child-process integration：升級權限 `node scripts/test-core.mjs` exit 0；既有 exit 139 案例與新增真實自我 `SIGSEGV` child 案例均清理 partial SRT／JSON、以 `--no-gpu` 完成 CPU retry 至 `completed`／`ready-review`、`whisperDevice=cpu`，並分別留下 `Metal exit 139`／`Metal signal SIGSEGV` 可觀測 marker。
- production controlled replay：`npm run acceptance:whisper:production-fallback -- /private/tmp/20260918-whisper-production-signal-aware.json` exit 0；受控 wrapper 的 exit 139 fallback、輸出與清理維持通過，仍明確 `bundledRuntimeUsed=false`。
- production bundled replay：`npm run acceptance:whisper:fallback -- /private/tmp/20260918-whisper-real-signal-aware.json` exit 0；新 parser 回報 `metalFailure=false`、`fallbackObserved=false`，任務以 Metal 完成 `ready-review` 並產生 draft／SRT／JSON、清理暫存 WAV。完整摘要保存於 `docs/project-management/evidence/2026-09-18-whisper-signal-aware-fallback.json`。
- 範圍判定：本輪修正 signal／exit 可觀測性與 probe 漏判，不代表真實 bundled server crash→CPU fallback 已重現；中文品質、長音訊、取消中的 retry、CPU retry 失敗、其他 macOS 架構、Windows、乾淨安裝與發布仍未驗收。LM Studio 依需求方決策未執行。

## 2026-09-17 BUG-WHISPER-METAL-139 Metal 139 執行權限邊界重播

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`。
- 對照條件：同一 `tools/whisper-cpp/whisper-cli`／Tiny model、同一 FFmpeg 正規化 1 秒 16 kHz 單聲道靜音 WAV、同一產品 `-osrt -oj -ojf -of -t 2` flags；binary／model SHA-256 與完整非敏感結果保存於 `docs/project-management/evidence/2026-09-17-whisper-metal-permission-boundary.json`。
- sandbox direct replay：Metal exit `SIGSEGV`／等效 139，stderr 為 `ggml_metal_buffer_init` allocation failure，SRT／JSON 均未產生；此結果只代表受 sandbox 限制的執行邊界，不作為產品 runtime failure。
- 升級權限 direct replay：同一 bundled CLI／輸入／flags 在 `require_escalated` local process exit `0`，Metal 產生 SRT／JSON。
- production server replay：`npm run acceptance:whisper:fallback -- /private/tmp/20260917-whisper-real-server-fallback-replay.json` exit `0`；`NODE_ENV=production`、test runners 關閉，任務完成 `ready-review`、`asrEngine=whisper.cpp`、`whisperDevice=metal`，輸出／暫存清理通過，`fallbackObserved=false`。
- 範圍判定：執行邊界差異已解釋先前 direct 139 與 server Metal success 的表面矛盾；仍沒有同一次真實 bundled server run 的 crash→CPU fallback evidence。deterministic production wrapper 仍是 fallback 控制流證據，不冒充 bundled runtime；中文品質、長音訊、取消中的 retry、CPU retry 失敗、跨平台與乾淨安裝仍未驗收，LM Studio 依需求方決策未執行。

## 2026-09-17 BUG-WHISPER-METAL-139 child-process fallback 整合回歸

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`。
- 受控 fixture：macOS arm64 核心測試在 Whisper.cpp runner 首次執行時模擬 Metal allocation failure，回傳 exit `139` 並建立 partial SRT／JSON；server 必須清理後以 `--no-gpu` CPU 重試。
- 核心斷言：fallback 任務完成 `ready-review`，最終 `metrics.whisperDevice=cpu`，fixture 確認首次 139 發生、CPU retry 使用成功輸出，且未觀察到 stale partial output marker。
- 開發驗證：`node --check scripts/fixtures/mock-whisper-cpp-runtime.mjs`、`node --check scripts/test-core.mjs`、`node scripts/test-whisper-fallback-policy.mjs`、`node scripts/test-whisper-quality.mjs` 與受控權限 `node scripts/test-core.mjs` 均 exit 0。
- 範圍判定：這是 child-process／server 控制流 deterministic 整合回歸，不代表目前 bundled Whisper.cpp 的真實 Metal／CPU 對照、長音訊、取消中的 retry、跨平台實機或模型品質已通過；LM Studio 依需求方決策未執行。

## 2026-09-17 BUG-WHISPER-METAL-139 bundled runtime Metal／CPU 對照重驗

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`。
- 測試資產：目前 `tools/whisper-cpp/whisper-cli`（darwin arm64）與 `tools/whisper-models/ggml-tiny.bin`，輸入為生成的 1 秒 16 kHz 單聲道靜音 WAV；binary／model SHA-256 與完整結果保存於 `docs/project-management/evidence/2026-09-17-whisper-bundled-runtime-recheck.json`。
- Metal 實測：產品同等 `-osrt -oj -ojf` flags 預設執行 exit `139`，stderr 出現 `ggml_metal_buffer_init` buffer allocation failure，SRT／JSON 均未產生。
- CPU 實測：相同輸入加 `--no-gpu` exit `0`，SRT／JSON 均產生；JSON 有 1 個 transcription segment，但只含 offsets／timestamps／tokens，沒有 segment-level confidence／no-speech probability。
- 開發驗證：`npm run runtime:verify:mac`、focused fallback／quality 測試、`npm run check`、`git diff --check` 與 `npm run docs:check:final` 均通過；所有暫存 input／output 已清理。
- 範圍判定：本輪證明目前這組 macOS arm64 bundled runtime 的 Metal crash 與 CPU workaround 可重現，不能代表中文語音品質、長音訊、產品 server 真實 CLI fallback、取消競態、跨平台或乾淨安裝驗收；LM Studio 依需求方決策未執行。

## 2026-09-17 BUG-WHISPER-METAL-139 產品 server bundled path acceptance probe

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`。
- 探針與隔離：新增 `scripts/verify-whisper-real-fallback.mjs`／`npm run acceptance:whisper:fallback`；以 `NODE_ENV=production` 啟動 localhost server，沒有設定任何 test runner，使用本機 bundled `whisper-cli`／Tiny 與生成的 1 秒 16 kHz 單聲道靜音 WAV，資料與 cache 置於明確暫存目錄，結束時清理。
- 實際結果：probe exit 0；任務 `completed`／`ready-review`，`asrEngine=whisper.cpp`、`whisperDevice=metal`，draft／`whisper-cpp-output.srt`／`whisper-cpp-output.json` 均產生，`quality-metadata.json` 未產生且 `whisper-input.wav` 已清理。Evidence 為 `docs/project-management/evidence/2026-09-17-whisper-real-server-fallback.json`。
- fallback 邊界：本次 server run 的 status logs 沒有 `Metal exit 139`／`CPU fallback`，所以 `fallbackObserved=false`；probe 只在當次真實 server 觀察到兩個 marker 時才要求 `whisperDevice=cpu`，未把正常 Metal 成功路徑冒充 fallback 通過。另行直接子程序對照仍可收到 bundled CLI `SIGSEGV`，但該事件沒有在本次 server run 重現。
- 範圍判定：本輪完成產品 server 非測試模式 bundled Whisper.cpp 正常 Metal path 與輸出／清理 smoke，並留下可重播的機會式 fallback probe；不代表 server 內 crash→CPU fallback 已由真實 bundled runtime 重現，不代表中文語音品質、長音訊、取消中的 retry、跨平台、乾淨安裝或正式發布驗收；LM Studio 依需求方決策未執行。

## 2026-09-17 BUG-WHISPER-METAL-139 production-mode controlled fallback acceptance

- 關聯需求／工作項目：`BUG-WHISPER-METAL-139`、`FR-003`、`FR-020`、`FR-022`。
- 探針與隔離：新增 `scripts/verify-whisper-production-fallback.mjs`／`npm run acceptance:whisper:production-fallback`；在 `NODE_ENV=production` 且 test runner 關閉的 server 中，建立暫時 tools tree，使用 bundled FFmpeg／Tiny model symlink 與明確 deterministic Whisper wrapper，輸入為生成的 1 秒 16 kHz 單聲道靜音 WAV；不呼叫外部服務、不使用 API Key、不讀取使用者媒體。
- 受控 fallback 結果：wrapper 首次非 `--no-gpu` 執行返回 exit `139` 並留下 partial SRT／JSON；server status logs 出現 `Metal exit 139`／`CPU fallback`，清理 partial 後第二次帶 `--no-gpu` 完成，最終 `completed`／`ready-review`、`asrEngine=whisper.cpp`、`whisperDevice=cpu`。
- 輸出與清理：draft／`whisper-cpp-output.srt`／`whisper-cpp-output.json` 均產生，`stalePartialArtifacts=[]`、首次 crash marker 存在、Whisper 暫存 WAV 已清理；非敏感 evidence 為 `docs/project-management/evidence/2026-09-17-whisper-production-fallback.json`，並明確記錄 `bundledRuntimeUsed=false`。
- 範圍判定：本輪證明 production-mode server 在 test runner 關閉時的 child-process exit 139→`--no-gpu` CPU retry、partial 清理與完成控制流；deterministic wrapper 不代表 bundled `whisper-cli` 實機 Metal crash fallback，真實 bundled server fallback、中文語音品質、長音訊、取消中的 retry、跨平台、乾淨安裝或發布仍未驗收；LM Studio 依需求方決策未執行。

## 2026-09-16 REL-047 macOS DMG／ZIP 分發檔啟動驗收

- 關聯需求／工作項目：`REL-047`、`REL-043`、`REL-046`、`FR-009`、`FR-010`、`FR-021`、`NFR-006`。
- 來源檔核對：既有 `../dist/test-build-0.51.0-macos-88da220/` 的 DMG／ZIP SHA-256 與 `SHA256SUMS-macos-arm64.txt` 相符；`hdiutil verify` exit 0 且回報 `VALID`；`unzip -t` exit 0 且回報 compressed data 無錯誤。
- DMG 路徑：以 `hdiutil attach -nobrowse -readonly` 掛載，直接從唯讀 volume 的 `離線字幕工廠.app/Contents/MacOS/離線字幕工廠` 執行既有 `scripts/verify-electron-renderer.mjs`，使用隔離 userData 與 `electron/assets/offline-subtitle-splash.mp4` real trim fixture；exit 0，通過首頁／bridge／設定、Breeze 開啟／取消、手動 SRT、trim／post-trim 任務、AI review asset、glossary、8 provider marker 與 folder flow，最後 `hdiutil detach` exit 0。
- ZIP 路徑：解壓至 `/private/tmp` 隔離暫存目錄，從解壓 app executable 執行相同 renderer／real trim smoke；exit 0，結果同 DMG 路徑，shell `trap` 完成暫存目錄清理。
- 非敏感 evidence：`docs/project-management/evidence/2026-09-16-macos-distribution-live-rel-047.json`，只記錄來源 checksum、app path shape、流程布林／狀態、清理與範圍限制，不保存 token、API Key、完整字幕或使用者資料。
- 範圍判定：本輪證明 DMG／ZIP 分發內容可在 macOS arm64 既有環境啟動並完成 packaged renderer smoke；不證明 Applications 安裝、乾淨帳號、Gatekeeper、Developer ID／公證、Windows、真正斷網、真實 AI API、模型品質或公開 Release。LM Studio 依需求方決策未執行。
- round1 獨立審查：`docs/project-management/reviews/2026-09-16-macos-distribution-rel-047-round1.md` 六面向核對無產品／資產阻擋，判定有條件通過；條件為審查代理未重播 GUI／完整測試，已以主要代理保存的原始 evidence、verifier source contract 與 checksum 靜態核對，並要求結案時維持所有未驗收範圍聲明。

## 2026-09-15 FR-021-031 LM Studio 驗收範圍例外

- 需求方決策：LM Studio 已刪除，本輪不執行其實機模型、UI、取消／續跑或真正斷網驗收；這是驗收範圍例外，不是產品支援移除。
- 追溯同步：例外已記錄於 `docs/project-management/02-REQUIREMENTS-ANALYSIS.md`、`00-CURRENT-STATUS.md`、`03-FUNCTIONAL-DESIGN.md`、`AI-ROADMAP-0.50.md`、`RELEASE-NOTES-0.51.0.md` 與 `08-CHANGE-LOG.md`；`lm-studio` deterministic provider／UI／optimizer tests 保留且未修改。
- 驗證結果：本輪僅需執行文件驗證與 `git diff --check`；既有 BUG-030 的 `npm run check`、Ollama 本機 evidence 與獨立審查仍有效，未將缺少 LM Studio 服務冒充實機通過。
- 剩餘風險：FR-021 原始「兩 provider 各一模型」條件因需求方例外不在本輪執行，但真正斷網與 Ollama 完整人工接受／取消／續跑仍未完成；若需求方恢復 LM Studio，必須新增工作條目並重新驗收。

## 2026-09-15 FR-021-032 Ollama 本機產品級人工流程驗收

- 關聯需求：`FR-021`、`FR-010`、`NFR-001`、`NFR-005`、`NFR-006`。
- 探針與範圍：新增 `scripts/probe-ollama-product-live.mjs`／`npm run acceptance:ollama:product`；以暫存 `OFFLINE_SUBTITLE_DATA_DIR`、測試 server、假影片與 2 cue 自然字幕執行，Ollama endpoint 僅允許 `http://127.0.0.1:11434/v1` 類 loopback；不使用 API Key、不呼叫雲端、不關閉系統網路、不啟停／下載／刪除模型，LM Studio 依 FR-021-031 例外不執行。
- 修正探針：第二次重跑的 HTTP 400 由探針把 SRT 時碼字串送入雙語 cue API 造成；已改以數值秒數送出並保留原始 `startRaw`／`endRaw`，同時以數值時間比對未變，未改產品 runtime。
- 探針契約：`node --check scripts/probe-ollama-product-live.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs` 與 `git diff --check` 均 exit 0；provider focused test 另確認 probe 使用暫存資料目錄、loopback-only 宣告、未宣稱系統斷網、時間碼／原始 SRT 驗證及 evidence 不覆寫。
- 實機結果：`OLLAMA_MODEL=llama3.2:1b npm run acceptance:ollama:product -- docs/project-management/evidence/2026-09-15-ollama-product-live-recheck-5.json` exit 0；artifact 記錄 Ollama `llama3.2:1b`、`endpointPrivacy=local`、AI `completed`、2 suggestions、0 retries、session accepted 2、undo 2、redo 2、review cue 2、`timecodesUnchanged=true`、`sourceSrtPreserved=true`，且保存前／後 `sourceSrtBeforeSha256`／`sourceSrtAfterSha256` 相同。
- 回應品質邊界：初次抽象字幕 fixture 讓 1B 模型回傳中文，既有語系驗證安全拒絕並保存失敗 artifact；改用不含提示語的自然字幕後完成。這證明 strict validator 仍有效，也表示小模型輸出品質仍須逐段人工確認，不能把任一成功 fixture 推廣成通用模型品質保證。
- 隱私判定：最終 artifact 的 `endpointPrivacy` 為 `local`，`scope.systemNetworkDisabled=false`；本輪只有 loopback 配置，未取得真正斷網證據，故 FR-021 整體不得標示完成。
- round1 修正：獨立審查發現遠端 `OLLAMA_BASE_URL` 未拒絕、SRT 保存前沒有 hash 基準，以及既有 evidence 檢查太晚會跳過暫存清理；探針已改為啟動前 loopback／output guard、保存前後 hash 比對，並以 nested `finally` 確保暫存清理。round1 報告保留於 `docs/project-management/reviews/2026-09-15-ollama-product-live-round1.md`，未覆寫。
- round2 修正：獨立複審確認上述三項已解除，另發現 exists-then-write 競態與 child env 過寬；探針已改用 evidence exclusive `flag: 'wx'`、最小化 server env（清除 AI key，限定 tools／cache／tmp 到暫存目錄）。round2 報告保留於 `docs/project-management/reviews/2026-09-15-ollama-product-live-round2.md`，未覆寫。
- 邊界驗證：`OLLAMA_BASE_URL=https://example.invalid/v1 node scripts/probe-ollama-product-live.mjs /private/tmp/osf-ollama-product-remote-guard-round2.json` exit 1 且未寫 evidence；以既有 output fixture 執行 probe exit 1、未啟動 server／未建立暫存資料。`node --check scripts/probe-ollama-product-live.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs` 與 `git diff --check` 均 exit 0。
- round3 複審：`docs/project-management/reviews/2026-09-15-ollama-product-live-round3.md` 判定通過，無新增阻擋問題；確認 `flag: 'wx'`、最小 child env、loopback guard、保存前／後 hash 與暫存清理均符合本輪範圍。未執行 Electron／瀏覽器 UI 或真正斷網，並已明確揭露。
- round4 獨立複審：`docs/project-management/reviews/2026-09-15-ollama-product-live-round4.md` 依 validator 格式完成六面向複審，判定通過且無阻擋問題；確認 round1／round2 修正、`flag: 'wx'`、最小 child env、loopback guard、保存前／後 hash 與暫存清理均維持有效。測試覆蓋仍只支持 loopback API product path；未執行 Electron／瀏覽器 UI、真正斷網或 LM Studio 實機，故不得宣稱 FR-021 整體完成。

## 2026-09-16 FR-021 packaged renderer UI 範圍補證

- 關聯需求：`FR-021`、`FR-010`、`NFR-001`、`NFR-005`、`NFR-006`。
- 驗收指令：`node scripts/verify-electron-renderer.mjs '../dist/mac-arm64/離線字幕工廠.app/Contents/MacOS/離線字幕工廠' 9987 60000`；環境為 macOS arm64、Node v22.22.3、受控權限、隔離 userData；exit 0。
- 實際結果：首頁 dashboard／navigation／new project／create-and-trim、Electron bridge（含 folder／safe key API）、設定 modal、Breeze 首次選擇開啟／取消、手動 SRT 任務 `completed`、trim 資產、校閱 AI selection／session／secure key／collapsible toolbar、glossary round-trip、8 個 provider ID 與 folder icon flow 均通過；證據保存於 `docs/project-management/evidence/2026-09-16-macos-renderer-smoke-fr-021.json`。
- 隔離與隱私：artifact 記錄 `isolatedUserData=true`、`externalApiKey=false`、`systemNetworkDisabled=false`、`ollamaLiveUiFlow=false`，且未執行 LM Studio；暫存 userData 由既有 verifier 清理。
- 判定邊界：本輪只補共用 packaged renderer／校閱 UI 的實機證據，不證明 Ollama live AI UI 優化、真正斷網、LM Studio 或 FR-021 整體完成；後三者仍依前輪範圍與需求方決策保留為未完成／未執行項目。
- round1 獨立審查：`docs/project-management/reviews/2026-09-16-macos-renderer-smoke-fr-021-round1.md` 判定有條件通過；獨立重播 port 9988 曾於 `verify-electron-renderer.mjs:74` timeout，並指出原驗收未傳入 real trim 媒體。原報告未覆寫。
- round1 後重驗：同一候選 port 9988 renderer smoke exit 0；再以 `electron/assets/offline-subtitle-splash.mp4`、port 9989 傳入第五參數執行 real trim branch，exit 0，`trimStatus=completed`、`trimDuration=2.021333`、`usesTrimmedVideo=true`、`shiftedSubtitle=true`。結果保存於 `docs/project-management/evidence/2026-09-16-macos-renderer-smoke-fr-021-recheck-2.json`；timeout 原始結果保留，尚待同一審查角色 round2。
- round2 獨立複審：`docs/project-management/reviews/2026-09-16-macos-renderer-smoke-fr-021-round2.md` 原文判定通過（僅限 macOS arm64 packaged renderer／校閱 UI／real trim 補證），但格式未滿足治理 validator；原文保留，未作最新結案依據。
- round3 格式合規獨立複審：`docs/project-management/reviews/2026-09-16-macos-renderer-smoke-fr-021-round3.md` 判定通過（僅限 macOS arm64 packaged renderer／校閱 UI／real trim 補證），六面向與具體證據欄位完整，無阻擋問題；確認 timeout 已成功重播、real trim 結果完整，並要求維持 Ollama live UI、真正斷網、LM Studio 與 FR-021 整體未完成的範圍聲明。

## 2026-09-16 FR-021-033 Ollama packaged 校閱頁 live UI

- 關聯需求：`FR-021`、`FR-010`、`NFR-001`、`NFR-005`、`NFR-006`。
- 探針與契約：新增 `scripts/verify-electron-ollama-ui.mjs`／`npm run acceptance:ollama:ui`；以隔離 Electron userData 啟動既有 macOS arm64 packaged app，透過 renderer UI 設定 Ollama loopback、英文輸出與 2 cue 手動任務，實際按下 AI 優化、全部接受、undo／redo 與保存 SRT；source contract 覆蓋 UI 導覽、設定、啟動、接受、歷史、保存、loopback、空 API Key、非斷網宣告及 exclusive evidence create。
- 實機驗收：`node scripts/verify-electron-ollama-ui.mjs '../dist/mac-arm64/離線字幕工廠.app/Contents/MacOS/離線字幕工廠' 10000 30000 'docs/project-management/evidence/2026-09-16-ollama-ui-live-final-2.json' 'llama3.2:1b'` exit 0；artifact 記錄 HTTP create 201／start 202、job completed、review ready、Ollama UI 設定已保存、英文、無 key、local privacy、AI completed、2 suggestions、accepted 2、undo／redo、`reviewed.srt`、2 cue、`timecodesUnchanged=true`。
- 開發驗證：`node --check scripts/verify-electron-ollama-ui.mjs`、`node scripts/test-ai-providers.mjs`、`git diff --check` 與獨立審查執行的 `npm run check` 均 exit 0；失敗重播 artifact 保留，包含純中文 1B 語言／JSON 不穩定及 3B latency／timeout，未修改 strict language validation。
- fixture 與品質邊界：最終 UI probe 使用中英混合短句以完成受控 UI chain；它只證明 packaged UI／AI session／保存鏈路，不能推廣成長中文翻譯品質保證。先前純中文 1B 失敗不被成功 fixture 覆蓋。
- 隱私與範圍：只配置 `http://127.0.0.1:11434/v1`、不使用 API Key／雲端、不下載／啟停／刪除模型；`systemNetworkDisabled=false`，因此不宣稱真正斷網。LM Studio 依需求方已刪除例外未執行，Windows／乾淨安裝／發布亦未涵蓋。
- round1 獨立審查：`docs/project-management/reviews/2026-09-16-ollama-ui-live-round1.md` 六面向判定通過、無阻擋問題；報告格式 validator 通過，並確認遠端 URL／既有 evidence 會於啟動前拒絕、evidence 使用 `flag: 'wx'`、API Key／loopback／非斷網邊界與完整回歸證據均可追溯。
- 判定：本輪只結案 FR-021-033 限定 macOS arm64 packaged Ollama loopback UI flow；FR-021 整體仍未結案。

## 2026-09-15 FR-021-030 Ollama 單句契約重驗

- 關聯需求／缺陷：`FR-021`、`BUG-030`、`NFR-001`、`NFR-005`、`NFR-006`
- 修正前證據：`docs/project-management/evidence/2026-09-15-ollama-llama3.2-1b-provider-recheck.json` 保存 provider raw probe 失敗；HTTP／模型連線正常，但 `llama3.2:1b` 回傳合法未包裝 cue object，未符合 raw `cues` contract。直接重現 optimizer path 亦回報 `AI 回傳缺少 cues 陣列`。
- focused 驗證：`node --check lib/ai/subtitle-optimizer.mjs`、`node --check scripts/test-ai-optimizer.mjs`、`node --check scripts/probe-ollama-live.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-optimizer.mjs` 與 `node scripts/test-ai-providers.mjs` 均 exit 0；deterministic 測試涵蓋未包裝 cue object→一次 repair→wrapper 成功與第二次輸出仍不合格時拒絕。
- 實機驗證：`OLLAMA_MODEL=llama3.2:1b node scripts/probe-ollama-live.mjs docs/project-management/evidence/2026-09-15-ollama-llama3.2-1b-optimizer-recheck.json` exit 0；artifact 記錄 Ollama `0.34.0`、2 個模型、endpoint privacy `local`、capability 200、native single-cue strict contract 通過，以及 optimizer 一 cue `suggestionCount=1`、`totalRetries=0`、`responseShapes=["cue-object","cues-array"]`。
- 隱私與範圍：本輪僅連線 `127.0.0.1:11434`，未使用 API Key、未呼叫雲端、未下載／刪除／啟停模型；LM Studio `127.0.0.1:1234` 未啟動，未宣稱 FR-021 整體或真正斷網驗收完成。

## 2026-09-14 BUG-028 Anthropic 模型清單分頁完整性

- 關聯需求／缺陷：`BUG-028`、`FR-026`、`NFR-005`、`NFR-006`
- 修正前重現：mock 第一頁回傳 `newer-model`、`has_more=true`、`last_id`，第二頁才包含設定的 `test-model`；原 `listAnthropicModels()` 只發出一次 GET，`node scripts/test-ai-providers.mjs` exit 1，錯誤為「第二頁指定模型不得被誤判為不可用」，實際值 `false`。
- focused 驗證：`node --check lib/ai/anthropic.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs` 與 `git diff --check` 均 exit 0。測試確認每頁送出 `limit=1000`、opaque cursor 可安全編碼／還原、第二頁模型可用且完整計數為 2。
- 邊界驗證：`has_more` 缺失、`has_more=true` 但 `last_id` 空白、重複 `last_id` 均明確拒絕；連續 100 頁仍宣告有後頁時由安全上限停止。既有空清單、缺少指定模型、API Key 不入 URL、GET 無生成 body、headers、Messages body 與其他 provider contract 仍通過。
- 完整回歸：`npm run check` exit 0，包含治理文件、Node 語法、Whisper、Breeze、Electron、影片修剪、雙語字幕、品質、AI fetch／optimizer／providers、Ollama streaming、review UI 與核心 API 測試。
- round1 審查修正：審查以 `last_id="  cursor /+?  "` 證明初版 `.trim()` 會改寫 opaque cursor；正式測試擴充為前後空白加特殊字元並先再現重複游標錯誤，adapter 改為只以 trim 結果判斷是否全空白，`seenCursors` 與 `after_id` 均使用原始 string。2026-09-15 08:53（Asia/Taipei）修正後 focused Node 語法、provider contract、opaque cursor exact-forwarding、完整 `npm run check` 與 `git diff --check` 均 exit 0；round2 獨立複審通過。
- 未覆蓋：未使用真實 Anthropic API Key、超過 20 筆的真實帳號模型清單或自訂 proxy；外部速率限制、網路中斷、跨平台封裝後請求與真實服務回應仍待另行驗收。

## 2026-09-15 BUG-029 AI provider profile 秘密欄位隔離

- 關聯需求／缺陷：`BUG-029`、`NFR-002`、`FR-009`、`FR-021`、`FR-026`
- 修正前重現：核心測試在 `/api/ai/settings` payload 的 `profiles.anthropic` 放入 `apiKey`、`authorization` 與 `secret`；原保存流程將秘密字串寫入一般 `settings.json`，`node scripts/test-core.mjs` 於該 assertion exit 1。
- 修正後 focused 驗證：`normalizeAiProfiles()` 只保留 `baseUrl`、`model`、`deployment`、`apiVersion`、`batchSize`、`timeoutSeconds`；核心測試確認秘密不在一般設定檔，`/api/ai/profile` 不回傳秘密且合法 `model` 保留。
- 執行結果：`node --check server.mjs`、`node --check scripts/test-core.mjs`、`node scripts/test-core.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-review-ui.mjs` 與 `git diff --check` 均 exit 0。
- round1／round2 審查：獨立審查先發現 allowlist 常數晚於模組啟動時的 `loadSettings()`，含既有非空 profile 的設定會被 catch 靜默回退預設值；已將常數移至啟動載入前，並把核心測試初始設定改為含非空 Anthropic profile，實際驗證 Base URL、model、batch／timeout 保留且未知欄位不進 runtime。修正後上述 focused 測試與重啟回歸均 exit 0；round2 報告 `docs/project-management/reviews/2026-09-15-ai-profile-secret-isolation-round2.md` 判定通過，無阻擋問題。獨立 sandbox 的核心 listener 受 `EPERM` 限制，採主要代理已完成的完整回歸證據。
- 未覆蓋：本輪未變更既有 secrets 儲存／加密遷移機制，也未對歷史設定檔中已存在的秘密做清理；未執行外部 AI API 或發布驗收。

## 2026-09-16 BUG-031 歷史 AI profile 秘密欄位啟動清理

- 關聯需求／缺陷：`BUG-029`、`BUG-031`、`FR-009`、`FR-021`、`FR-026`、`NFR-002`、`NFR-005`、`NFR-006`。
- 修正前重現：啟動 fixture 在一般 `settings.json` 預置 AI 根層 `apiKey`／Authorization／access token／client secret／credential／password／private key／token／secret，以及 Anthropic profile 秘密與未知 provider；受控權限執行 `node scripts/test-core.mjs` 於磁碟秘密清除斷言 exit 1，證明原流程只清理 runtime、不清理既有檔案。沙盒內首次執行因 local fixture listener `EPERM`，取得受控 loopback 權限後取得上述產品基準失敗。
- 修正內容：`loadSettings()` 以固定 secret-shaped 根層鍵名清單刪除 legacy AI 明文，以既有 profile allowlist 取代 profiles 並移除未知 provider；只在內容改變時，以同目錄、不含秘密的暫存檔原子置換 `settings.json`，完成後清除暫存檔。合法 profile、非敏感未知 AI 根層欄位及獨立 `ai-secrets.json` 不變，歷史明文不自動匯入 secrets。
- focused 驗證：`node --check server.mjs`、`node --check scripts/test-core.mjs`、`node scripts/test-ai-providers.mjs` 與 `git diff --check` 均 exit 0；受控權限 `node scripts/test-core.mjs` exit 0，直接讀回磁碟確認兩組 legacy marker 消失、未知 provider profile 消失、合法 model／batch／timeout 保留、`futureNonSensitiveSetting` 保留、既有獨立 secret 保留且未混入 legacy marker、無 `settings.json.*.tmp` 殘留。
- 完整回歸：`npm run check` exit 0，涵蓋治理文件、Node 語法、Whisper、Breeze、Electron、影片修剪、雙語字幕、品質、AI fetch／optimizer／providers、Ollama streaming、review UI 與核心 API／啟動遷移測試。
- round1／round2 獨立審查：round1 因審查提前停止、未完成程式與文件讀取而有條件通過，沒有提出程式阻擋；保留原報告後，由新的獨立上下文完整核對 `server.mjs`、核心 fixture 與 BUG-031 文件。round2 六面向均通過，確認根層固定 secret-shaped 清理、profile 雙重 allowlist、非法根物件／寫入失敗／暫存清理、未知非敏感根層欄位與既有 secrets 的處理合理，且核心測試實際啟動 server 後直接讀回兩個磁碟檔；報告為 `docs/project-management/reviews/2026-09-16-historical-ai-profile-cleanup-round2.md`，無阻擋問題。
- 失敗邊界：若設定目錄不可寫，migration 不把原始值輸出到 log，runtime 仍使用正規化資料並提示檢查一般設定檔權限；該情境下磁碟殘留仍需修正權限後重啟。本輪未以 Windows 真實檔案鎖定重放 rename 失敗。
- 範圍：不解密／改寫 OS 安全儲存、不掃描備份或其他使用者檔案、不呼叫外部 AI、不使用真實 API Key、不打包或發布。

## 2026-09-14 BUG-027 Anthropic 新模型取樣參數相容性

- 關聯需求／缺陷：`BUG-027`、`FR-026`、`NFR-005`、`NFR-006`
- 修正前重現：在 `scripts/test-ai-providers.mjs` 的 Anthropic optimizer body 加入 `temperature: 0`、`top_p: 0.8`、`top_k: 20` 並斷言不得外送；修正前 exit 1，第一個錯誤為 `Anthropic 不得外送新模型會拒絕的 temperature`，實際值為 `0`。
- focused 驗證：`node --check lib/ai/anthropic.mjs`、`node --check scripts/probe-provider-live.mjs`、`node --check scripts/test-ai-providers.mjs`、`node scripts/test-ai-providers.mjs` 與 `git diff --check` 均 exit 0；測試確認三個取樣欄位均為 `undefined`，既有 header、max tokens、system／messages、metadata 清理及 response mapping 仍通過。
- 完整回歸：`npm run check` exit 0，包含治理文件、Node 語法、Whisper、Breeze、Electron、影片修剪、雙語字幕、品質、AI fetch／optimizer／providers、Ollama streaming、review UI 與核心 API 測試；round2 通過後 `npm run docs:check:final`、`git diff --check` 與 focused provider contract 亦均 exit 0。
- round1 審查修正：審查指出共用 `probe-provider-live.mjs` 不應移除 `temperature: 0`，否則會改變六種非 Anthropic provider 的既有驗收輸入；已恢復該欄位，改由 Anthropic adapter 局部過濾，並新增 probe source contract 與 `stop_sequences` 保留斷言。
- 未覆蓋：未使用真實 Anthropic API Key 或付費模型，未測 Claude Opus 4.7+、proxy、計費、速率限制與跨平台封裝後外部請求；本輪只驗證 deterministic request contract。

## 2026-08-26 BUG-026 Whisper／FFmpeg 取消生命週期

- 關聯需求／缺陷：`BUG-026`、`FR-003`、`FR-022`、`NFR-005`
- 變更內容：內建 FFmpeg、Python Whisper 與 Whisper.cpp 取消時等待子程序 `close`；Unix 逾時後 `SIGKILL`、Windows 使用 taskkill tree；取消後清理暫存音訊與部分 SRT／JSON／品質 metadata。
- 新增 deterministic 證據：`scripts/fixtures/mock-whisper-cpp-runtime.mjs`、`scripts/fixtures/mock-whisper-python-runtime.mjs`、`scripts/fixtures/mock-ffmpeg-runtime.mjs`；`scripts/test-core.mjs` 覆蓋正常完成、spawn 前取消、取消等待、暫存檔清理、非 ASR 工作檔保留與 stubborn child grace period。
- 已執行：`node --check server.mjs`、三個 fixture 與 `scripts/test-core.mjs` 的 `node --check`、`git diff --check`、`node scripts/test-core.mjs`、`npm run check`。
- 目前結果：上述語法／差異檢查、核心整合測試與完整 `npm run check` 修正後均通過；round2 後補修 FFmpeg 成功前處理音訊保留，round5 格式合規獨立六面向複審為有條件通過；`npm run docs:check:final` 與 `git diff --check` 已通過。
- 未覆蓋：Windows taskkill 實機、真實 Whisper／FFmpeg 長音訊、Apple Metal fallback 與 Breeze 真實 runtime；本輪不宣稱跨平台實機驗收。

## 六面向獨立審查

審查代理必須提供證據並逐項判定：

1. 需求完整性。
2. 邏輯正確性。
3. 邊界情況。
4. 程式碼品質。
5. 測試覆蓋。
6. 實際運行結果。

審查代理只能讀取、執行、驗證，除本輪獨立審查報告外不得修改檔案。報告須存於 `docs/project-management/reviews/`，由審查代理本人產出；工作紀錄只能連結並逐字引用判定，不得由主要代理代寫或轉述。若有問題，主要代理修正；影響原判定時須建立下一輪報告複審，不得覆寫舊報告。

## 需求追溯格式

每次工作在 `08-CHANGE-LOG.md` 至少記錄：需求 ID、修改檔案、測試 ID／指令、結果、審查結論、發布證據。無自動測試時必須寫原因與人工替代證據。

## 0.45.1 已有證據

- 本機與 Windows Actions `npm run check` 通過。
- Windows Server 2022 run `29556747371` 成功產生 Setup／Portable 並通過 archive 驗證。
- Windows EXE SHA 與 GitHub Release digest 一致。
- Portable EXE 清單含離線 HTML、四張圖片與三段 10.048 秒 MP4 內容的 `.osfvideo`。
- macOS DMG／ZIP 已發布；既有發布紀錄包含 DMG 與 codesign 驗證。

## 0.45.1 未覆蓋證據

- Windows 乾淨實機安裝、解除安裝與捷徑。
- Windows 上離線手冊三段動畫的實際播放。
- Authenticode 簽章成功路徑。
- Apple Developer ID 與 notarization。

## 多語言 LLM 開發中驗證

## 0.46 雙語字幕驗證

- `test-bilingual-subtitles.mjs`：驗證單語 SRT 無損轉為雙欄、原文／譯文排列、SRT／VTT 輸出，以及無效時間碼／空文字拒絕。
- `test-review-ui.mjs`：驗證雙語排列控制、ASS 下載入口與原文／譯文欄位。
- 核心 API／保存包需驗證 `bilingual-cues.json`、排列設定、cue 數量與時間碼保護；跨平台 renderer、FFmpeg 實際雙語燒錄仍需於封裝／實機階段補測。
- 目前已完成受控環境核心保存／載入／ASS 整合驗證；未覆蓋項目明確包括 AI 雙語回應 contract、規則／分割合併專門案例、FFmpeg 實際解析／硬燒錄、Electron renderer 與 Windows／macOS 安裝後操作。

- `test-ai-optimizer.mjs`：驗證 BCP 47 基本、variant、extension 標準化，惡意／無效值拒絕、舊設定回退、翻譯 Prompt、一般優化 Prompt，以及模型交換 cue 順序時必須拒絕。
- `test-review-ui.mjs`：驗證常用語言選項、自訂語言欄位、簡體中文選項不存在與送出時共用語言解析函式。
- `test-core.mjs`：驗證自訂 `fr-CA` 可保存並標準化，專用 AI 設定、一般設定及 AI 任務 API 的非法語言值均回覆 400，舊版 AI／介面簡體中文設定在啟動時回退繁中，AI 任務沿用多語設定。
- 本項目完成自動測試與獨立審查前維持「開發中」，不得標示為 0.45.1 已發布功能。

## 發布稽核判定

- **通過**：必要測試及審查完成，無阻擋問題，發布資產與說明一致。
- **有條件通過**：風險已明確揭露並由需求方接受，具替代驗證；條件與授權來源須記錄。
- **不通過**：checksum、資料安全、核心功能、簽章宣稱、需求或資產不一致等阻擋問題未解決。

發布等級工作缺少發布授權記錄時不得判定「通過」；最高只能列為「有條件通過／發布授權待補」。歷史審查或授權缺少獨立證據時只能標示缺口，不得回溯補造。

## 0.45.2 發布候選驗證計畫

- 來源：0.45.2 版本檔、Release notes、內建 0.45.2 手冊與多語言 LLM 差異。
- macOS：runtime manifest／hash、unpacked App、DMG、ZIP、ad-hoc codesign、手冊與 SHA。
- Windows：Windows Server 2022 完整回歸、runtime hash、Setup／Portable archive、手冊、未簽章狀態與 SHA。
- 發布：獨立六面向審查、GitHub 資產名稱／大小／digest／下載核對。
- 未覆蓋：Windows／macOS 乾淨實機安裝與完整操作；風險已由需求方明確接受並須持續揭露。

## 0.45.2 AI 供應商補強驗證

- `test-ai-providers.mjs`：驗證五種 provider definition、Groq models／chat completions、Gemini models 的 `x-goog-api-key` 認證，以及 Gemini OpenAI 相容 chat completions 的 Bearer 認證、請求與回應契約；API Key 不進入 URL。
- `test-core.mjs`：驗證非法 provider 在 settings／profile API 回覆 400；Groq 設定不會回退成 OpenAI-compatible；Groq／Gemini profile 與 runtime／磁碟金鑰隔離；清除一個供應商金鑰不影響另一個。
- `test-review-ui.mjs`：驗證 Groq／Gemini 選項、供應商白名單、Azure 欄位停用與連線前欄位／金鑰提示契約。
- `verify-electron-renderer.mjs`：封裝後 renderer 驗證要求 settings API 同時列出 OpenAI、OpenAI-compatible、Azure、Groq 與 Gemini，避免 source 有選項但安裝包缺 provider definition。
- 2026-07-22 macOS 本機瀏覽器實測：Groq 自動帶入 `https://api.groq.com/openai/v1`；Gemini 自動帶入 `https://generativelanguage.googleapis.com`；兩者清空並停用 Azure 欄位；切回 Azure 後 Deployment／API Version 恢復可用；缺模型時測試連線顯示可採取行動的錯誤且按鈕恢復可用。
- round1 修正後，`ai-provider-settings.mjs` 的可執行測試覆蓋已保存 profile 與未保存 provider／Base URL／model／Azure deployment／API version／API Key；瀏覽器實測修改已保存 Groq profile 的 model 後，測試連線被阻擋、按鈕恢復，server log 確認未送出 `/api/ai/test`。
- round2 修正後，`test-review-ui.mjs` 直接執行可注入連線控制器：七類未保存／缺 key 狀態均斷言 request 0 次；已保存未變更狀態 request 1 次；阻擋、成功、HTTP 錯誤與 fetch 例外後按鈕皆恢復，錯誤訊息可診斷。
- 未覆蓋：未使用真實 Groq／Gemini API Key 呼叫外部服務；Windows／macOS 乾淨實機安裝與啟動仍待 0.45.3。0.45.2 macOS arm64 DMG／ZIP、Windows Setup／Portable 與 updater metadata 已於發布前後核對通過。

## 0.51.0 Anthropic Claude provider 開發驗證

- `test-ai-providers.mjs`：驗證 Anthropic provider registry、預設端點、`/v1/messages` 與 `/v1/models` 路徑、Models API 全分頁與異常游標防護、`x-api-key`／`anthropic-version` 標頭、連線測試只使用 GET models 且不發送生成 body、modelAvailable true／false（含空清單與後頁命中）、system／user 訊息轉換、`max_completion_tokens`→`max_tokens`、OpenAI 專用欄位與內部 cue metadata 清理，以及 Anthropic content blocks 回應正規化。
- `test-core.mjs`：驗證 settings API 列出 Anthropic、profile／runtime key 以 provider ID 隔離、API Key 不進一般設定或 API 回應，非法 provider 仍回覆 400。
- `test-review-ui.mjs`：驗證 Anthropic Claude 選項與既有供應商白名單／連線表單契約。
- 驗證限制：本輪不使用真實 Claude API Key、不測量外部模型品質／計費、不宣稱跨平台封裝或公開 0.51.0 Release 已完成；需另行進行使用者授權的外部 endpoint smoke 與平台候選驗收。

## 0.45.3 設定遷移驗證計畫

- BUG-012：`test-core.mjs` 驗證 `openai-compatible` 搭配 Gemini URL／`gemini-*` 模型時，會回復空 Base URL／空模型，且不影響供應商金鑰隔離。
- 必測：正常 OpenAI-compatible 自訂 endpoint、正常 Gemini profile、舊混用設定、空值、非法 provider、重啟後設定持久化。
- 實機：以既有 0.45.2 使用者設定升級到 0.45.3，確認 UI 不再顯示跨供應商資料。

## 0.47.0 發布閉環核對（2026-07-28）

- 本機核對：`git rev-parse HEAD` 為 `efc6259140640e65f9273284811c365da473bc88`；既有 release round1 報告記錄的 Release／Windows CI 目標為 `7946f7fa8e080f28a65639053f674fa8babcd5fe`，來源尚未一致。
- GitHub Release API 核對（2026-07-28 可取得的回應）：`v0.47.0` target 為 `7946f7f`；公開資產為 `offline-subtitle-factory-0.47.0-macos-arm64.dmg`、`offline-subtitle-factory-0.47.0-macos-arm64.zip`、`RELEASE-SHA256SUMS-0.47.0-macos-arm64.txt`，未見 Windows Release asset。
- Windows 證據：workflow run `30231912997`／artifact `8640388049`、名稱 `offline-subtitle-factory-0.47.0-windows-x64` 與 SHA-256 已記錄於 `RELEASE-NOTES-0.47.0.md`；本輪未能重新下載 artifact，內容逐檔核對與發布後下載核對仍待執行。
- 判定：發布閉環未完成；來源 commit 不一致與 Windows 未公開／未反向核對為阻擋項。未簽章／未公證、Metal exit 139、Electron 與跨平台實機缺口仍為揭露中的條件風險，不得由 CI 成功取代。

## 0.47.1 發布後核對（2026-07-28）

- 來源：annotated tag `v0.47.1` 解析至 commit `0bd3b53be0cd523d7c7beb3078b5b46dad2f81b1`；GitHub Release 已由 draft 正式發布。
- 開發驗證：受控環境外 `npm run check` 通過；`hdiutil verify` 驗證 macOS DMG；`unzip -t` 驗證 macOS ZIP 與 Windows artifact archive；Windows `latest.yml`、Setup／Portable 與 SHA-256 清單一致。
- 發布資產：GitHub Release `v0.47.1` 公開 7 項資產，API 已核對名稱、大小、digest 與直接下載 URL；macOS DMG／ZIP 的 GitHub digest 分別為 `88cc9ce8f76a2b720a74e52780d8c2340acd25cf324895233d41051cbaa35f04`、`1411e242136908a54bd8ad7cc95088e18a383c216004fa3afcbff2e5c0b7fb8e`；Windows Setup／Portable digest 分別為 `323b08300b2724b0dabf9a8e6c5aef7dfed850df7707328412a3794d24f352a9`、`5e1445b67f4a84f5c09d0dd80b854c05146cdc0efa34f1481de6fa46ae48f237`。
- 限制：Windows 未 Authenticode、macOS 未 Developer ID／公證；Metal exit 139、Electron、跨平台安裝後與長音訊實機仍未覆蓋，Release notes 已揭露。
- 独立审查：`docs/project-management/reviews/2026-07-28-0-47-1-release-round2.md`；结论为有条件通过，条件与剩余风险详见该报告及工作纪录。

## FR-022 Whisper 三模型模式驗證（2026-08-04）

- `scripts/test-whisper-models.mjs` 以 deterministic mock runner 覆蓋 `tiny`／`base`／`small` 三個模型：模型白名單與 alias 正規化、模型路徑、whisper.cpp CLI 參數（含 `--no-gpu`）、SRT／JSON 輸出、quality metadata 解析，以及缺檔、too-small、SHA mismatch、manifest-size mismatch 與 UI option presence 拒絕／存在性。
- `npm run runtime:manifest`、`npm run runtime:verify`、`npm run runtime:manifest:mac`、`npm run runtime:verify:mac` 均通過；目前現有 runtime 只包含 tiny，manifest 已支援 optional `files.models` 對 base／small 做 hash 驗證。
- `npm test` 通過，包含核心 API／任務回歸；本輪沒有下載或執行實際 base／small 權重，因此未宣稱三模型實際中文準確率、速度、記憶體或 Windows／macOS 安裝後驗收。
- 未覆蓋：實際 base／small 模型檔、模型匯入 UI、Windows／macOS 乾淨安裝與長音訊實機；這些應於加入相應模型資產前另行驗收。

## BUG-024 Whisper Small 過長字幕 cue 正規化驗證（2026-08-20）

- `scripts/test-whisper-srt.mjs` 覆蓋 Small 長 cue 的標點拆分、最多兩行／正常情況每行最多 20 字元（可見文字）、跨英文 cue／換行的空白保留、原本兩行各 20 字元不重拆、時間碼連續與嚴格遞增、文字無損、超過 40 字元純中文在 1 ms fallback 不新增 ASCII 空格、短時間不足時保留單一 cue，以及未啟用選項時 Tiny／Base 相容行為。
- `lib/whisper-srt.mjs` 是所有 Whisper SRT 寫入路徑共用的純函式清理器；只有模型正規化為 `small` 時啟用 `splitLongCues`，Python Whisper 與 Whisper.cpp 兩條路徑一致，Breeze 不受影響。
- Whisper.cpp Small 發生 cue 拆分時，以同長度陣列的 `null` 項標記無法精確對應的拆分來源；未拆分 cue 仍寫入可取得的 `quality-metadata.json`，校閱頁的 partial attach 會保留這些 engine metrics，拆分 cue 則由既有 `rule-score` 重新評估。
- focused `node --check`／`node scripts/test-whisper-srt.mjs`、完整 `npm run check`、`npm run docs:check`、`npm run docs:check:final` 與獨立 round1／round2／round3 審查均已完成；未宣稱真實 Small runtime 或跨平台實機品質。
- 未覆蓋：真實 Whisper Small 權重、1:46 長音訊、實際閱讀速度／中文斷句品質、macOS／Windows 封裝後模型執行與品質 metadata 對應仍待外部驗收。

## REL-040 0.50.0 Whisper Small 修正版 macOS 測試候選（2026-08-20）

- 最終候選來源：`codex/0.50-whisper-small-long-cues@6beee985f50e2045fb9520630e4fde8d67b61bb7`；輸出為 `../dist/test-build-6beee98/`，版本 `0.50.0`、Electron `43.3.0`、electron-builder `26.15.7`、macOS arm64。沒有建立 tag、推送或公開 Release。
- 首輪 `2c9612e` package 的 renderer smoke 只出現 DevTools browser 而無主視窗；1 秒 process sample 將停滯定位到 Security framework `SecItemCopyMatching`。BUG-025 把不存在 `ai-keys.safe` 的檔案檢查移到 safeStorage 前，`scripts/test-electron-main.mjs` 納入 `npm test`；修正後最終候選的隔離 userData renderer smoke 通過首頁、設定、Breeze model modal、上傳／任務完成、cleaned SRT、AI review、術語 round-trip、七個 provider 與資料夾事件，且無背景程序殘留。
- 來源驗證：`npm run check` 通過，包含 BUG-024 Whisper Small SRT／quality／三模型、BUG-025 Electron 啟動順序、Breeze、治理與核心 API；`runtime:manifest:mac`／`runtime:verify:mac` 通過。
- 封裝內容：Info.plist 與 packaged package 均為 `0.50.0`／arm64；runtime manifest 與來源逐位元一致；App 只含 FFmpeg、Whisper.cpp 與 `ggml-tiny.bin`，沒有 `.pt`、`ggml-base.bin`、`ggml-small.bin`、PFX／P12／PEM／key；封裝內已核對 BUG-024、BUG-025 及 `RELEASE-NOTES-0.50.0.md` marker。
- 最終資產：DMG `285c6782159fa884e0d43a2f8bdad10fdf1468ae5abb90aed5532c1e01b656a3`（242,718,360 bytes）；ZIP `cbff5ce253309c61c4f1cbb8aeabff1227e2f3c85163fd3c44f394214172c850`（249,955,644 bytes）；DMG blockmap `c9d5d8b222d620528992923cfa2c5699b7f2dfc1c1b4aeb64d69b520e20ff6a8`；ZIP blockmap `4689d9f139fb6dbae4207712f4aa7d6b2c65412c7bde8aa55ff197da7498fe6c`。`SHA256SUMS-macos-arm64.txt` 已以 basename／LF 建立並重放全部 OK。
- 封裝驗證：DMG `hdiutil verify` 為 VALID；ZIP `unzip -t` 無錯；`codesign --verify --deep --strict` 通過，簽章為 ad-hoc、TeamIdentifier 未設定；`latest-mac.yml` 的 DMG／ZIP SHA-512 與 size 逐項重算一致。`PROVENANCE.txt`、`SIGNING-STATUS-macos-arm64.txt`、測試候選 README 與去除 API token／暫存路徑的 `mac-renderer-smoke.json` 已附於候選目錄。
- 未覆蓋：真實 Whisper Small 權重／1:46 長音訊、真實 Breeze runtime／checkpoint、既有真實加密 AI 金鑰跨版本 decrypt、乾淨帳號 Gatekeeper、DMG 拖曳安裝後完整操作、Windows 版本與公開 Release；本候選不得宣稱上述項目通過。

## REL-043 0.51.0 Anthropic provider macOS arm64 directory 測試候選（2026-08-27）

- 建置指令：`npm run electron:build:mac:dir`；第一次沙盒執行因 `getaddrinfo ENOTFOUND github.com` 無法取得 Electron 資產，取得受控網路權限後同一指令成功；`runtime:manifest:mac`／`runtime:verify:mac` 通過。
- 候選位置：`../dist/mac-arm64/`，版本 `0.51.0`、Apple Silicon `darwin-arm64`、Electron `43.3.0`、electron-builder `26.15.7`；附 `TEST-CANDIDATE-README.md`、`PROVENANCE.txt`、`SHA256SUMS-macos-arm64.txt` 與 `mac-renderer-smoke.json`。
- 封裝內容核對：packaged `package.json` 為 `0.51.0`，`lib/ai/providers.mjs` 含 Anthropic provider，runtime manifest／FFmpeg／Whisper.cpp／Tiny verify 通過；候選為 ad-hoc／未公證，不含 Base／Small／Breeze checkpoint、Python／PyTorch／patched runtime。
- 受控權限 `node scripts/verify-electron-renderer.mjs <app-executable> 9972 60000` 通過：首頁／Electron bridge／安全金鑰 API、設定 modal、Breeze 首次選擇開啟與關閉、manual SRT job `completed`／cleaned SRT、trim／AI review assets、glossary round-trip 與 provider IDs（含 `anthropic`）。沙盒首次 smoke 只因 GUI／DevTools 權限逾時，無產品錯誤輸出；同一候選受控權限重跑成功。
- 未覆蓋：真實 Anthropic API／模型品質／rate-limit／proxy、真實 Whisper Small／Breeze runtime、1:46 長音訊品質與效能、乾淨帳號安裝、Windows／跨平台實機、正式簽章／公證與公開 Release。

## REL-044 0.51.0 Windows x64 cross-build directory 測試候選（2026-08-27）

- 建置指令：`npm run electron:build:dir`；第一次沙盒執行因 `getaddrinfo ENOTFOUND github.com` 無法取得 Electron 資產，取得受控網路權限後同一指令成功；`runtime:manifest`／`runtime:verify` 通過。
- 候選位置：`../dist/win-unpacked/`，版本 `0.51.0`、`win32-x64`、Electron `43.3.0`、electron-builder `26.15.7`；附 `TEST-CANDIDATE-README.md`、`PROVENANCE.txt` 與 `SHA256SUMS-win32-x64.txt`。
- 靜態封裝核對：主程式、FFmpeg、Whisper.cpp 均為 x86-64 PE；packaged `package.json` 為 `0.51.0`，`lib/ai/providers.mjs` 含 Anthropic provider，runtime manifest target 為 `win32-x64`；四項 SHA-256 重放為 OK，未發現 `.pt`、Base／Small／Breeze checkpoint 或憑證檔案。
- 限制：建置主機為 macOS Apple Silicon，未安裝 Wine，無法在本機啟動 Windows executable；因此未宣稱 Windows renderer、安裝／解除安裝、Authenticode、FFmpeg／Whisper 實機、GPU 或乾淨環境通過。候選僅供複製至 Windows 10／11 x64 進行後續隔離測試。
- 未覆蓋：Windows 實機 packaged renderer／任務 smoke、安裝／解除安裝與捷徑、Authenticode、真實 Anthropic API／模型品質／rate-limit、真實 Whisper／Breeze runtime、長音訊效能、跨平台行為與公開 Release。

## REL-045 0.51.0 Windows unsigned Setup／Portable 測試包（2026-08-27）

- 建置指令：`npm run electron:build:unsigned`；第一次沙盒執行因 `getaddrinfo ENOTFOUND github.com` 無法取得 Electron 資產，取得受控網路權限後同一指令成功，產生 NSIS Setup、Portable 與 Setup blockmap／`latest.yml`。
- 候選位置：`../dist/test-build-0.51.0-91eca2b/`，包含 `offline-subtitle-factory-setup-0.51.0.exe`、`offline-subtitle-factory-portable-0.51.0.exe`、blockmap、`latest.yml`、`TEST-CANDIDATE-README.md`、`PROVENANCE.txt`、`SIGNING-STATUS-windows-x64.txt` 與 `SHA256SUMS-windows-x64.txt`。
- 封裝核對：Setup／Portable 版本命名為 `0.51.0`，兩者為 NSIS PE GUI；`latest.yml` 的 Setup SHA-512／size／version 與實體檔案一致；四項 SHA-256（Setup、blockmap、Portable、metadata）重放為 OK。
- 簽章與實機限制：候選明確標示 unsigned／Authenticode 未獨立驗證；建置主機為 macOS Apple Silicon，沒有 Wine，未執行 Windows Setup／Portable、renderer、安裝／解除安裝、SmartScreen 或實際轉錄。候選只供複製到 Windows 10／11 x64 進行後續隔離測試。
- 未覆蓋：Windows 實機安裝／解除安裝／捷徑、Authenticode／SmartScreen、renderer／任務 smoke、離線行為、真實 Anthropic API／模型品質／rate-limit、Breeze／Whisper runtime、長音訊效能、跨平台行為與公開 Release。

## REL-046 0.51.0 macOS arm64 DMG／ZIP 測試包（2026-08-27）

- 建置指令：`npm run electron:build:mac`；第一次沙盒執行因 `getaddrinfo ENOTFOUND github.com` 無法取得 Electron 資產，取得受控網路權限後同一指令成功，產生 DMG／ZIP 與各自 blockmap／`latest-mac.yml`。
- 候選位置：`../dist/test-build-0.51.0-macos-88da220/`，包含 DMG、ZIP、blockmap、`latest-mac.yml`、`TEST-CANDIDATE-README.md`、`PROVENANCE.txt`、`SIGNING-STATUS-macos-arm64.txt`、`SHA256SUMS-macos-arm64.txt` 與 `mac-renderer-smoke.json`。
- 封裝驗證：DMG `hdiutil verify` 為 VALID；唯讀掛載確認包含 `Applications` 與 `離線字幕工廠.app` 且沒有 Base／Small／Breeze checkpoint 或憑證檔；ZIP `unzip -t` 無錯；`codesign --verify --deep --strict` 通過，`codesign -dv` 顯示 `Signature=adhoc`、`TeamIdentifier=not set`。
- Metadata／完整性：DMG `242,726,077` bytes、ZIP `249,959,846` bytes；`latest-mac.yml` 的兩項 SHA-512／size／0.51.0 version 與實體檔案一致，四項 blockmap／DMG／ZIP／metadata SHA-256 重放為 OK。受控權限 packaged renderer smoke 通過首頁／設定／Breeze modal／manual SRT 完成／cleaned SRT／trim／AI review／glossary round-trip 與 provider IDs（含 `anthropic`）。
- 未覆蓋：Developer ID／公證、DMG 拖曳安裝後 Gatekeeper／乾淨 userData、真實 Anthropic／Breeze／Whisper runtime、1:46 長音訊品質與效能、Windows／跨平台實機與公開 Release。

## DEV-047 0.51.0 Windows preview workflow 版本對齊（2026-08-27）

- `.github/workflows/windows-preview.yml` 已將 workflow name、push branch、tag、Setup／Portable artifact filter、packaged Release notes 與 artifact name 從 0.50.0 對齊至 0.51.0，保留 Node 22、`npm run check`、runtime verify、signed／unsigned 分流、Windows install／renderer／archive／model exclusion gate。
- 靜態驗證：workflow 不再含 `0.50`／`codex/0.50`／`v0.50` marker；`ruby -e 'require "yaml"; YAML.load_file(...)'` 基本解析成功；`git diff --check` 通過。未觸發 GitHub workflow，沒有把 YAML 可解析誤稱為 Windows runner 通過。
- 未覆蓋：GitHub Windows runner、Secrets／Authenticode、Setup／Portable 實機安裝／解除安裝／renderer、artifact 下載／digest、真實模型／runtime／長音訊效能與公開 0.51.0 Release；需另行取得外部 runner 證據。

## FR-023 Whisper 高階模型首次下載驗證（2026-08-06）

- `scripts/test-whisper-model-download.mjs`：驗證 pinned revision／Base／Small metadata、禁止任意模型名稱、manifest merge、下載成功、進度 100%、SHA-256 不符、大小超限、HTTP 503、AbortController 逾時、Windows 既有損壞檔替換與失敗暫存檔清理。
- `scripts/test-whisper-models.mjs`：驗證首頁三模型選項、下載按鈕、首次使用說明與下載 modal 存在；`lib/whisper-models.mjs` 驗證 user cache 優先、封裝模型 fallback 與既有 strict size／SHA 檢查。
- `scripts/test-core.mjs`：驗證 `/api/whisper-models` 回報 Base 固定大小、Small pinned revision URL 與可寫入 whisper-models cache；完整回歸需在受控權限下執行以允許 local fixture listener。
- 下載設計：Electron 將模型快取設於 `userData/whisper-models`，server 以暫存檔下載並原子置換（Windows 既有檔先移至備份並可回復），具 15 分鐘 AbortController 逾時；UI 在首次選擇／提交前確認，並顯示 userData cache 路徑與官方 URL／手動放置說明。
- 未覆蓋：本機尚未實際下載 148 MB Base／488 MB Small；Windows 實機權限、休眠／中斷續傳、乾淨安裝與中文口說品質仍待外部驗收，不得將 deterministic fixture 或檔案 hash 視為模型品質通過。

## FR-024 Breeze ASR 25 實驗性整合驗證（2026-08-10）

- `scripts/test-breeze-asr.mjs`：驗證官方 revision、checkpoint 檔名、3,087,008,569 bytes、SHA-256 與固定 URL；涵蓋缺檔、錯誤大小、mock 正例、runtime `available_models` 探針、CLI 參數、模型檢查不得使用同步檔案 I/O，以及永久等待的 probe 必須在 timeout 後失敗。
- `scripts/test-whisper-models.mjs`／`scripts/test-core.mjs`：驗證首頁 Breeze 選項、下載端點與提交前檢查存在，並由核心 API 驗證固定 metadata、模型狀態與 job 的 `breeze-asr-25` 引擎保存。round1 後新增測試專用 mock runtime，真正經 server job／FFmpeg 音訊前處理產生並清理 SRT；取消案例等 child 收到 SIGTERM、延遲 close 後才從 `running/cancelling` 轉為 `cancelled`，並確認暫存音訊與部分 SRT 不殘留。
- round1／round2 修正：3 GB checkpoint 改以非同步 stream 驗證 SHA，避免單次同步完整讀檔阻塞 event loop；Breeze capability probe 設 15 秒 timeout；轉錄取消等待 child `close`，POSIX 在 3 秒 grace 後升級 SIGKILL，Windows 立即執行並等待 `taskkill /T /F` 完成 process-tree 終止，確認 child 與 Windows tree-kill 都結束後才釋放 job slot。另以忽略 SIGTERM 的 mock child 驗證 grace timeout、SIGKILL、取消狀態與暫存清理。
- 本機瀏覽器驗證：新增專案可選 Breeze ASR 25；選取後 Whisper 專用模型欄位停用，未安裝狀態顯示約 2.88 GB 與提交時確認下載提示。切換不會改變 Whisper.cpp 預設值。
- 完整回歸：`npm run check` 在允許本機 fixture listener 的受控環境通過；`node scripts/test-review-ui.mjs` 與 `git diff --check` 通過。首次沙箱內執行僅因 `listen EPERM` 中止，沙箱外同一指令已完整成功。
- 未覆蓋：本輪未下載真實 checkpoint，也未安裝或執行官方 Python／PyTorch／patched Whisper runtime；未驗證真實繁體中文／中英混用音訊、字幕對齊品質、GPU／CPU 效能、長音訊、取消清理、Windows／macOS 安裝後流程，故不得宣稱 Breeze ASR 已可隨安裝包直接使用或達到正式品質門檻。

## FR-024 Breeze runtime／模型外部驗收探針（2026-08-12）

- `node scripts/test-breeze-asr.mjs`：新增 runtime probe 正常／timeout、Python 路徑解析、模型缺件與 report 聚合斷言，並保留既有固定 revision／大小／SHA／CLI 契約測試。
- `npm run probe:breeze -- --json`：本機只讀執行回報 `python3` 可啟動但 `whisper` module 缺失、Breeze checkpoint 缺失、`ready=false` 與非零狀態；沒有執行 pip、網路下載或字幕任務。
- 探針固定使用 `whisper.available_models()` 能力檢查與同一 Breeze 模型 inspector；timeout 會終止探針 child，不把外部 runtime 失敗寫入設定或任務狀態。
- 未覆蓋：真實 checkpoint、官方 patched Whisper／PyTorch、真實音訊、品質、效能、跨平台安裝與 process-tree 仍須另行外部驗收。

## FR-024 Breeze runtime／模型外部驗收探針修正（2026-08-12）

- round1／round2 獨立審查指出：專用 probe timeout 原先未等待 child close／descendant 清理，且 JSON 原樣輸出絕對路徑與 raw stderr；本輪已改為 POSIX detached process group、Windows `taskkill /T /F`、等待 close，並將 Python／模型路徑改為 basename、診斷輸出改為安全摘要；其後將相同 cleanup 契約補入正式 server 共用的 `lib/process-probe.mjs`。
- `scripts/test-breeze-asr.mjs` 新增 timeout close 等待與敏感標記遮罩斷言；本機 focused test、缺件 probe 與完整 `npm run check` 均通過。
- 未覆蓋：真實 Windows process tree、官方 runtime／checkpoint、音訊品質與跨平台實機仍待外部驗收。

## FR-024 Breeze runtime probe 診斷訊息品質修正（2026-08-13）

- `lib/breeze-runtime-probe.mjs` 的敏感鍵值遮罩改用實際捕獲的鍵名與分隔符，`ImportError: token=... password:... api-key=...` 會輸出可讀的 `ImportError: token=<redacted> password:<redacted> api-key=<redacted>`，不再出現字面 `$1=<redacted>`。
- `scripts/test-breeze-asr.mjs` 新增 ImportError、token、password、api-key 的 deterministic 回歸，確認原始敏感值不會進入 probe 結果；既有任意診斷仍維持 privacy omission。
- round1 獨立複審發現 quoted 且含空白的 credential 值仍可能洩漏尾段 `LEAK_MARKER`；本輪已改為整段處理單／雙引號與 escaped 字元，並新增 quoted whitespace 負向回歸，要求 round2 複審。
- focused `node --check ...` 與 `node scripts/test-breeze-asr.mjs` 通過；完整 `npm run check`、`docs:check:final` 與 round2 獨立複審結果待本輪結案後補記。
- 未覆蓋：真實 Windows process tree、官方 runtime／checkpoint、音訊品質、效能與跨平台安裝後流程仍沿用前輪外部驗收缺口。

## REL-039 Breeze 0.50 效能透明化與首次選擇提醒（2026-08-20）

- `lib/breeze-asr.mjs` 建立唯一定義的 `BREEZE_ASR_PERFORMANCE_REFERENCE`；`server.mjs` 由 `/api/breeze-asr` 回傳，包含單一 MacBook Air M3／8 GB 觀察、1:46 影片約 6 小時（約 `3.4×`）、日期與未保存 profiler／原始音訊範圍。
- `public/index.html`／`public/app.js` 在選取 Breeze 時顯示獨立 `breezePerformanceNotice`，不改變 `Breeze ASR 25` 選項文字、不自動切換效能 preset，也提供切回 Whisper.cpp 的建議；未選取 Breeze 時提示隱藏。
- `scripts/test-breeze-asr.mjs` 驗證固定參考 payload、硬體與範圍文字；`scripts/test-whisper-models.mjs` 驗證獨立提示欄位、0.50.0 版本識別與選項不含 experimental 字樣。
- focused `node --check`、Breeze／Whisper tests、VM fallback／null element 行為、受控權限完整 `npm run check`、`npm run docs:check`、`docs:check:final` 與 `git diff --check` 已通過；round1 的作用域阻擋已由 round2 獨立複審確認解除。
- 未覆蓋：本輪沒有改變或實測 MediaTek patched runtime、3.09 GiB checkpoint、真實長音訊品質／速度／記憶體、Windows／macOS 乾淨安裝或 smoke cleanup；效能參考不可替代外部驗收。

## REL-038 Breeze 0.49.1 正式發布後核對（2026-08-18）

- PR #14 已轉 ready 並合併；merge commit `917ae82886a0dff195009c66ce9438b78675fcc0`，annotated tag `v0.49.1` 指向同一 commit，既有 `v0.49.0` 未移動。
- tag workflow run `32095872065` 成功；artifact `9309963799` 大小 `490,424,761` bytes，GitHub digest `sha256:6551957e320b6f299328bc2b13898134814534585854b1c9d9164096419be04a`；本機分段下載重組後 digest／ZIP／PE／checksum／`latest.yml` 一致，Windows Setup／Portable／blockmap 與 unsigned 狀態可追溯。
- macOS arm64 0.49.1 DMG SHA-256 `8e0afe0065f4ed3e608248dc5b26558a2e5dfb1effe9c3ef93572ceaf2eff0df`（242,718,460 bytes，`hdiutil verify` VALID），ZIP SHA-256 `99837a1de3742e40d752a27a9a58e01db29bd5704de7905a07609ecfc7ebdf64`（256,980,540 bytes，`unzip -t` 通過）；`latest-mac.yml` SHA-512／size 一致。
- GitHub Release `v0.49.1` 已 `isDraft=false`／`isPrerelease=false`，公開 13 項 asset；API 核對所有名稱／大小／digest／`/releases/download/v0.49.1/` URL。metadata、checksum、簽章狀態、blockmap、Release notes 與直接下載 hash 全數一致；四個主資產的 HTTP Content-Length 與 API size 一致。
- Breeze 首次選擇流程與雙平台 renderer smoke 證據已交付；MacBook Air M3／8 GB 的 1:46 影片約 6 小時（約 `3.4×`）列為效能警示，不作跨機型或品質保證。
- round4 獨立發布複審報告：`reviews/2026-08-18-breeze-first-selection-performance-round4.md`；其判定為有條件通過，明列 smoke cleanup 未自然退出及真實 Breeze runtime／checkpoint／品質／效能／乾淨安裝缺口；本次 Release 已在該風險如實揭露下完成。
- 未覆蓋：MediaTek patched Whisper runtime 實際載入、3.09 GiB checkpoint／長音訊／取消恢復／CPU 記憶體效能、Windows／macOS 乾淨實機與 macOS smoke cleanup 自然 exit 仍待後續外部驗收。

## REL-037 Breeze 首次選擇流程與 Mac Air 效能發布依據（2026-08-18）

- UI 將選擇器文字改為一般產品名稱 `Breeze ASR 25`；選取事件立即呼叫既有 `ensureBreezeAsrReady()`，模型缺失時開啟固定官方下載，完成驗證後 runtime 缺失則接續開啟安裝／啟動指引。
- `scripts/test-breeze-asr.mjs` 新增選擇器無「實驗性」字樣、首次選擇設定提示及 readiness flow source assertions；仍保留取消下載不得建立任務、runtime 缺件可切回 Whisper.cpp 的既有契約。
- 發布依據：需求方回報 MacBook Air `Mac15,12`／Apple M3／8 GB／8 cores／macOS `26.5.2`（Build `25F84`）處理 1:46:00 影片約 6 小時（約 `3.4×`）；未保存 profiler／原始音訊／完整 telemetry，不作跨機型或品質驗收。
- 未覆蓋：真實 Breeze checkpoint／patched runtime、長音訊品質、CPU／CUDA 效能、跨平台乾淨安裝與安裝後首次選擇的真實使用者流程仍需外部驗收。

## REL-030 Breeze 0.49.0 第一版發布候選（2026-08-13）

- 來源基線：由 `origin/main=05b275f` 建立 `codex/breeze-first-release`，只移植 Breeze runtime probe／process cleanup／diagnostic redaction 變更並升版至 0.49.0，避免直接發布落後主線 25 個提交的舊開發分支。
- 來源驗證：focused Breeze 語法與測試通過；`npm run check` 完整通過；`npm audit --json` 為 0 項已知弱點、總依賴 286；缺件 `npm run probe:breeze -- --json` 預期以 exit 1 回報 checkpoint missing、`ModuleNotFoundError` 與 `ready:false`，未下載或安裝外部元件。
- macOS arm64：runtime manifest／SHA 驗證、目錄版封裝與 packaged renderer smoke 通過；smoke 覆蓋 Electron bridge、設定、manual SRT 任務完成、trim／review AI 資產、七 provider 與 folder event。首次 smoke 因 sandbox 無法讀取 escalated loopback DevTools 而逾時；相同 build 在同一受控權限範圍重跑通過，確認不是 renderer 缺失。
- macOS 最終候選：從乾淨 commit `0205548` 重建；DMG `hdiutil verify` checksum VALID、ZIP `unzip -t` 無錯、ad-hoc code structure 驗證通過；App bundle 版本 0.49.0、最低 macOS 12，包含 Breeze guide／0.49.0 Release notes／probe library，且沒有大於 1 GiB 檔案或 Breeze checkpoint。最終 renderer smoke 前兩次因 macOS Network Service 重啟造成 target 延後出現而逾時；精確程序診斷確認 server／renderer 隨後正常啟動，關閉診斷程序後以 240 秒期限重跑相同封裝完整通過，未隱藏失敗證據。
- Windows x64：macOS cross-build 已產出 x86-64 unpacked App、NSIS Setup／Portable 與 `latest.yml`；Setup archive 可列出 Breeze guide／probe library／0.49.0 Release notes，未包含 checkpoint；Setup／Portable 皆未 Authenticode。Windows CI workflow 已切換至本分支／`v0.49.0` 與 0.49.0 資產名稱，並新增 Breeze guide／checkpoint 排除關卡。
- 資產完整性：DMG `18fba33da3740ee28fdbb5aba575fe7305c069eb417702fc67db3ee8f54dda30`（242,706,559 bytes）、ZIP `9a4337c352e8c97ebba3de0ad02c86e192474061a2abd71faedca7dd789ce188`（249,942,036 bytes）、Setup `1a63e80bcda6fd433cb0ebba84cff7cb49d37604183ab32dd1341712fda8d8ed`（244,655,017 bytes）、Portable `9353ad38521cd6383e725063f1adbfe05373f2c21f3c95837c71c6553eb97a15`（243,947,755 bytes）。`SHA256SUMS-macos-arm64.txt` 與 `SHA256SUMS-windows-x64.txt` 重放全數 `OK`；`latest.yml`／`latest-mac.yml` 的 size 與 SHA-512 亦和實際檔案一致。
- 原候選待辦已完成：Windows Actions packaged renderer／安裝生命週期、完整獨立發布審查、GitHub PR／tag／Release 與發布後下載反向核對均已收斂，round3 判定通過。
- 獨立發布審查：round1 對四資產 SHA、DMG／ZIP、metadata、版本、封裝內容與風險揭露做快速獨立重驗後，判定「有條件通過（僅限本機候選與建立 PR）；公開 Release 不通過」。Windows Actions／CI artifact、GitHub 閉環與未獲涵蓋授權的真實 Breeze／跨平台實機缺口是公開發布阻擋項，解除後須 round2 複審。
- Windows CI：PR #11 的 push run `31659328605`（來源 `aa1ec41e0856746726774d5f16a48f96b6c103b3`）成功；Setup 安裝後 renderer、silent uninstall、Portable renderer、兩個 NSIS archive、Breeze guide、checkpoint 排除與 unsigned 狀態均通過。artifact `9165654131` 大小 490,411,929 bytes、GitHub SHA-256 `0dccf99939edd1e3dec024f16327e6bcfd3b0674885c1007ff24d5d1f0b15027`；以八段精確 range 下載重組後 digest 完全一致，ZIP `unzip -t` 通過。CI SHA：Portable `4f16f949d8cd3a207ac922574a3b4768d513f8478740d6ae9704c62447f0bff4`（244,674,637 bytes）、Setup `b39d4451d4edc5f80245a540d341f9c7158fd58f75009862c8bfc995936be925`（245,381,891 bytes）；`latest.yml` 版本 0.49.0、Setup size／SHA-512 與實檔一致。
- 最終 tag／Release：PR #11 merge commit 與 `v0.49.0` target 都是 `1f50b85c0599ef85c73f05085d70925d4d6b670a`。tag run `31661442776` 成功，artifact `9166375562` 大小 490,411,920 bytes、digest `5a45c9d04917bbdd3c7d05867e68c42e1d7f5597fe2dc369364b5039e5371418`；分段完整下載重組、ZIP 與 EXE SHA 通過。正式 Windows SHA：Portable `cbec3c244f80d9e922f7139caacbefd00cabf41a2a0cffc5385392950960f981`（244,674,635 bytes）、Setup `0a5cf5cdf3b94ce4a7621fffcbd2174a92e4288a4c0e380d31c98338b34d65a0`（245,381,896 bytes）。
- 發布後核對：GitHub v0.49.0 為 `isDraft=false`／`isPrerelease=false`／Latest，9 項 asset URL 均為 `/releases/download/v0.49.0/`。四個主資產與兩平台 checksum／updater metadata／unsigned 說明已從正式 URL 全量重新下載；兩份 SHA 清單全數 OK、DMG checksum VALID、macOS ZIP 無錯、Windows Setup archive 可讀，Setup／macOS ZIP／DMG 的 updater SHA-512 與 size 均一致。
- 未覆蓋：真實 Breeze checkpoint／官方 runtime／音訊品質、CPU／CUDA 效能、長音訊、Windows process tree、兩平台乾淨安裝後 Breeze 流程與 checkpoint 下載中斷／磁碟不足；不得以候選封裝或 mock 證據取代。

## REL-032 v0.49.0 雙平台測試軟體重建（2026-08-13）

- 來源：`main`／`origin/main` commit `c41d6ad60441687da19ce67bd847256b843b5e69`；產品版本仍為 0.49.0。此來源只比公開 tag target 多 DOC-031 發布後文件同步，測試候選置於 repo 外 `../dist/test-build-c41d6ad/`，未建立 tag／Release 或覆寫既有正式資產。
- 開發與供應鏈：Apple Silicon macOS 26、Node 22.22.3、npm 10.9.8；`npm run check` 完整通過，`npm audit --json` 為 0 項已知弱點／286 dependencies；macOS runtime manifest／verify 通過。
- macOS arm64：隔離重建 DMG／ZIP、App 0.49.0／最低 macOS 12；`hdiutil verify` checksum VALID、`unzip -t` 無錯、deep strict codesign 通過且明列 `Signature=adhoc`／無 Team ID。packaged renderer 前兩次分別因 sandbox DevTools 可見性與 target 延後出現逾時；診斷啟動確認 server／bootstrap 正常後，以 `ELECTRON_ENABLE_LOGGING=1`、60 秒期限重跑同一 App 完整通過 bridge、設定、manual SRT job、trim／review、術語 round-trip、七 provider 與 folder event。DMG SHA-256 `7ddb472d361734d020d176a2d3ad51cbc0adb61d856ee1da60bcb74acc20002d`（242,706,304 bytes）、ZIP `4d45ae1f48a44332276e37174e40188ea33d27ff4358a30cf43f7c8d90c1ae0c`（249,941,976 bytes）；`latest-mac.yml` 兩檔 size／SHA-512 與實檔一致。
- 封裝內容：macOS App 含 `docs/BREEZE-ASR-25.md`、`RELEASE-NOTES-0.49.0.md` 與 Tiny；Small 與 Breeze checkpoint 不存在，且 App 無大於 1 GiB 檔案。這只證明 checkpoint 排除與預設 Tiny 可封裝，不證明外部 Breeze runtime／模型可用。
- Windows x64：GitHub Actions workflow_dispatch run `31663681837` 由 `main@c41d6ad` 在 `windows-2022` 完成固定 runtime、完整 source／真實 FFmpeg 回歸、unsigned Setup／Portable、Setup 安裝後 renderer、silent uninstall、Portable renderer、兩個 NSIS archive／Breeze guide／checkpoint 排除、SHA 與 artifact upload；signed step 因無憑證按設計 skipped。Actions v4 顯示內部 Node 20 相容層被 runner 強制使用 Node 24 的 deprecation annotation，但 job conclusion 為 success。
- Windows artifact：artifact ID `9167179425`、大小 490,411,789 bytes、GitHub SHA-256 `c8d1064a52ade1fd7147fbfad665f342ec9b1aded2323480692113b84c7c8182`；八段精確 range 重組後 digest 相同，ZIP `unzip -t` 無錯。Portable SHA-256 `07a3b07bbbc1ab514f8b17f876baae84a923ae43384e9e8ee9e518d31daa3bd9`（244,674,586 bytes）、Setup `8461defe905aefddd45aa7ebac56c67d76e13c5226a29f621d3fca74aca78edf`（245,381,834 bytes）；`latest.yml` Setup size／SHA-512 一致，簽章狀態為 `UNSIGNED INTERNAL PREVIEW`。
- checksum 邊界：CI 原始 `SHA256SUMS-windows-x64.txt` 為 CRLF，Windows runner 已成功使用且去除 CR 的 macOS 串流重放亦全數 `OK`；本機 extracted 交付另附等值 LF 版 `SHA256SUMS-windows-x64-LF.txt`，原始 CI 清單保留不改寫。
- 未覆蓋：macOS DMG 拖曳安裝後／乾淨帳號 Gatekeeper、Windows 10／11 使用者實機 SmartScreen 與互動安裝、正式簽章／公證、真實 Breeze checkpoint／官方 runtime／品質／效能／長音訊／取消與 process tree；測試包不得宣稱為新的正式版本或替換已發布 v0.49.0。

## SYNC-024 GitHub Windows 修正同步驗證（2026-08-06）

- 遠端核對：`git fetch --prune origin` 後 `origin/main=baed6d7`；Windows Ollama 修正 `4d0bee6` 與本地 HEAD `170e08e` 的指定檔案 diff 為空，故未重複套用。
- 選擇性整合：同步 Azure OpenAI 的 `max_completion_tokens` capability probe、Azure deployment body 清理與 OpenAI-compatible internal chat fields 清理；保留本地 Ollama streaming／timeout／repair 變更。
- focused：`node --check`（model capabilities／OpenAI-compatible／providers）、`node scripts/test-ai-providers.mjs`、`node scripts/test-ai-optimizer.mjs`、`node scripts/test-ollama-batch-stream.mjs` 通過。
- 審查後補強：`scripts/test-ai-providers.mjs` 新增 OpenAI-compatible sanitized body 專項斷言，確認保留 `model` 並移除 operation／language／cue metadata；focused provider test 與完整回歸重跑通過。
- 完整：受控 `npm run check` 通過；兩平台測試包關鍵 AI runtime marker 與工作樹一致，macOS／Windows ZIP `unzip -t` 均通過。
- 未覆蓋：Windows 實機 Ollama／Azure endpoint、真實模型回應、安裝後啟動與跨版本行為；GitHub commit 核對與 contract mock 不取代實機驗收。

## 0.48 本機 LLM 驗證計畫

- `test-ai-providers.mjs`：驗證 Ollama／LM Studio registry、loopback IPv4／IPv6、localhost 子網域拒絕、無 Key 不送 Authorization、遠端本機-provider 名稱仍不得繞過 Key，以及模型能力回應解析。
- `test-review-ui.mjs`：驗證本機 provider 選項、服務掃描、模型清單、能力檢查、隱私狀態與 loopback 無 Key 連線表單。
- `test-core.mjs`：以本機 fake OpenAI-compatible server 分別驗證 Ollama 的無 Key／無雲端同意設定、模型列表、連線、有效與無效模型能力回應、redirect 第二站零請求，以及 LM Studio 的完整 AI 批次、429 重試、無 checkpoint／有 checkpoint 取消時關閉 HTTP 請求、取消後只續跑未完成批次與 cue 契約。
- macOS 預封裝：`runtime:manifest:mac`、`runtime:verify:mac` 與 `electron:build:mac:dir` 已通過；`verify-electron-renderer.mjs` 已在產出的 arm64 App 驗證 Electron bridge、設定 modal、上傳／啟動／完成、review AI 資產、術語 round-trip，以及七個 provider（含 Ollama／LM Studio）。此證據僅涵蓋目前主機的未簽章目錄版，不等同 DMG 安裝後驗收。
- Windows 預封裝：`runtime:manifest`、`runtime:verify` 與 `electron:build:dir` 已成功產出 `dist/win-unpacked` 及 Windows x64 executable；本機為 macOS，未直接啟動 Windows renderer，故不等同 Windows 實機安裝後驗收。
- Windows 發布資產：`electron:build:unsigned` 已建立 x64 Setup 與 Portable；兩者均由 `file` 識別為 PE32 NSIS executable。Setup SHA-256 為 `d05a3f8d4df31048d398839666f34954c523f6928bc2500a1d98a785f7a20955`，Portable SHA-256 為 `3a1ad56e0b6e914151e7f3447966d104c426544245e68e455d5df49eaeddf1f6`；未簽章且未在 Windows 實機安裝／啟動。
- macOS 發布資產：arm64 DMG 可由 `hdiutil imageinfo` 讀取；ZIP 改用 macOS `ditto` 直接由已驗證 App 封裝，`unzip -t` 通過。DMG SHA-256 為 `906559f20242f01f2b51618280b4af65875cd83bd05aef16bc22f3eb10d3562f`，ZIP SHA-256 為 `04de598018929d687887329582488d3fa809abffed2b919a3bd7851325f46bc7`。DMG 唯讀掛載成功；直接從唯讀卷啟動未取得 DevTools target，但複製到專用暫存安裝位置後，`verify-electron-renderer.mjs` 已通過 bridge、設定、上傳／完成、review AI 資產、術語 round-trip 與七個 provider，且暫存目錄已清理。這是本機複製安裝 smoke test，不等同乾淨使用者帳號或正式簽章／公證驗收。
- 實機門檻：Ollama 與 LM Studio 各至少一個模型完成模型探索、能力檢查、字幕建議、人工接受、取消／恢復；移除外網後重跑本機流程。
- Ollama 真實模型證據（2026-07-28）：本機 Ollama 0.32.5 以 `llama3.2:1b` 完成 `/v1/models`、能力檢查與專案 API 的 1 cue `proofread` 優化；任務 `completed`、provider／model 正確、0 retries。首次能力檢查的 `traditionalChinese` 為 false，實際建議將中文句號改成英文句點；round5 重放同類能力 prompt 得到 true，單 cue 直接回應另出現額外缺少 id 的物件，顯示能力／品質結果不穩定。已確認模型可用但品質不能直接接受，需保存完整 prompt／參數／原始 response，並由人工審核／後續提示詞或模型調整。
- 可重放證據：`npm run probe:ollama:live`（底層為 `scripts/probe-ollama-live.mjs`）會保存版本、模型清單、完整 capability／single-cue 請求與原始回應；本輪 artifact 為 `docs/project-management/evidence/2026-07-28-ollama-llama3.2-1b-live.json`。該次 capability 回應使用 `Traditional Chinese` 鍵而非產品要求的 `traditionalChinese`，single-cue 回應使用 `cue`、改動時間碼並附 Markdown／自然語言，正好證明 strict contract 與人工審核仍必要。Probe 另以 `isLoopbackAiUrl`、`aiEndpointPrivacy` 與所有 fetch `redirect: manual` 保護資料邊界；本機 probe exit 0，遠端 `OLLAMA_BASE_URL` 負例在 fetch 前 exit 1。
- Probe 安全矩陣：`http://localhost:11434/v1` 實際 probe 成功；`localhost.example.com` 在 fetch 前拒絕；`[::1]` 通過 loopback 分類但因 Ollama 僅監聽 IPv4 而連線失敗，未被誤判為遠端或送出資料。
- 未覆蓋即不得宣稱：目前沒有證據時，不得將真實 Ollama／LM Studio、Windows 封裝、macOS 安裝版或斷網端到端標示為通過。

## BUG-021 Breeze runtime 安裝指引驗證

- `scripts/test-breeze-asr.mjs` 驗證 guide 具備官方 repo／模型連結、兩平台 `--recurse-submodules`、submodule 安裝路徑、開發版與已安裝 App 啟動命令，以及不在 Breeze repo 內執行 `npm start` 的負向條件。
- `scripts/test-core.mjs` 驗證 `/api/breeze-asr` 與 `model` 內的固定 guide details 一致；`node --check public/app.js` 與 UI source marker 驗證 runtime modal、模型下載 modal 入口及 persistent ASR 欄位入口。
- UI smoke 只驗證隔離本機 server 的 Breeze 缺件狀態、選單與 modal 資產存在；未安裝真實 patched runtime／3 GB checkpoint，不把 mock 或 source marker 當作真實轉錄品質／跨平台驗收。
- 安裝指引命令不由 App 自動執行；供應鏈、git／pip／Python 版本、Windows PowerShell、macOS shell、安裝位置與實機啟動仍需外部驗收。

## BUG-022 Breeze runtime 路徑與首頁健康卡回歸驗證

- `scripts/test-breeze-asr.mjs` 新增 macOS／Linux 標準 `$HOME/Breeze-ASR-25/.venv/bin/python`、Windows `%USERPROFILE%\\Breeze-ASR-25\\.venv\\Scripts\\python.exe` 偵測 fixture；同時驗證 Windows `USERPROFILE` 優先於 `HOME`，以及外部 patched venv 優先一般 bundled Python，避免假缺件。
- `scripts/test-breeze-asr.mjs` 以 source assertion 確認首頁 `refreshHomeHealth` 在 `/api/health` 成功後呼叫 `updateMetrics(tools)`，讓 FFmpeg／ASR／Whisper／GPU 卡片更新。
- focused：`node --check lib/breeze-runtime-probe.mjs`、`server.mjs`、`electron/main.mjs`、`public/app.js` 與 `node scripts/test-breeze-asr.mjs` 通過；完整 `npm run check` 通過（含 docs validator、核心 API 與所有 deterministic 回歸）。
- 未覆蓋即不得宣稱：測試 fixture 不代表本機已安裝 MediaTek patched Whisper；真實 Python／PyTorch／submodule／3 GB checkpoint、Breeze 音訊品質／效能、Windows process tree、雙平台乾淨安裝與自訂路徑仍待外部驗收。

## 0.48.x 穩定化驗證（2026-07-30）

- BUG-012／FR-014：`test-core.mjs` 驗證舊 Gemini URL／模型混入 `openai-compatible` 時，API 回應與持久化 `config/settings.json` 均清空不相容的 Base URL／model，同時保留正確 provider；API Key 不進一般設定檔。
- 本輪新增的持久化斷言只證明同一 server 寫入後的設定檔內容；既有使用者設定檔跨平台啟動／重啟仍待實機驗收，不能以此取代 Windows／macOS 測試。
- `FR-021` 的真實 LM Studio artifact、模型人工接受、取消／checkpoint 續跑與真正斷網閉環仍屬未完成驗收；本輪未使用真實外部供應商金鑰。

## 0.48.x macOS 封裝與本機 LLM 驗證（2026-07-30）

- `npm run runtime:verify:mac` 通過；`verify-electron-renderer.mjs` 對 macOS arm64 目錄版 executable 結束成功。DMG／ZIP SHA-256 與既有清單一致：DMG `334e50b59a70c97314629faad88de1dd22f6680018265c54da5f1703becfbeee`、ZIP `53ca4e3886155e221048d36f103b0933a8d49647f5e509098fcac29f2c652f80`。
- 受控本機連線下 `npm run probe:ollama:live -- docs/project-management/evidence/2026-07-30-ollama-llama3.2-1b-live.json` 通過，完整 raw request／response 保存於版本化 evidence；取得 Ollama 0.32.5、2 個模型與 `llama3.2:1b` capability／single-cue 回應。capability 回應符合 strict JSON；single-cue 回應未滿足 strict JSON／cue contract（含 Markdown／自然語言或時間格式改寫），因此只證明 loopback 可連線，不是模型品質或 FR-021 完整驗收。probe 現在拒絕覆寫已存在的 evidence。
- LM Studio `http://127.0.0.1:1234/v1/models` 於本輪 connection refused；依需求方決定暫緩，不宣稱 LM Studio 真實流程、人工接受、取消／續跑或斷網完成。Windows renderer／安裝驗收亦未在本輪執行。
- 受 sandbox 本機 socket bind 限制曾有一次 `listen EPERM`；以受控權限重跑的 `npm run check` 通過。

## 0.48.x 供應鏈與 CI 風險盤點（2026-07-30）

- `npm audit --json`：總計 14 項（13 high、1 critical），依賴總數 418；lockfile 實際版本為 `electron@33.4.11`、`electron-builder@25.1.8`，延伸出 `app-builder-lib`／`builder-util`／`node-gyp`／`tar`／`cacache`。runtime production dependency 僅 `busboy`，本次未見其 advisory。
- build-only 風險：`tar`、`node-gyp`、`cacache`、`app-builder-lib` 等主要由建置／重建流程引入；可用修正集中到 `electron-builder@26.15.3`，為 major 升級，需另開相容性工作並重跑兩平台封裝。
- runtime 風險：lockfile 的 `electron@33.4.11` 命中多項 advisory，audit 建議至少升至 43.2.0；這會改變 Electron runtime，不能僅以 build-only 風險接受，須另做 renderer／IPC／打包／實機回歸。
- CI：目前 `.github/workflows/windows-preview.yml` 使用 `actions/setup-node@v4`、`node-version: 22`；本輪未發現仍使用 Node 20 的現行 workflow 設定，`00-CURRENT-STATUS.md` 的 Node 20 deprecation 描述應視為待歷史來源核對，不作為目前 workflow 已證實問題。
- 結論：本輪不修改 lockfile、Electron 或 electron-builder；將 major 升級與安全修正列為後續受控變更。`npm audit` 數字不能直接等同已發布應用的 runtime 可利用性，但 Electron advisory 仍是未解決的 runtime 風險。
- Whisper fallback 補充：`lib/whisper-fallback-policy.mjs` 已以 deterministic 矩陣測試覆蓋 macOS arm64、forceCpu、退出碼與邊界值，並由 `server.mjs` 使用；此證據只涵蓋 fallback 觸發條件，不取代實際 child-process、取消／清理與跨平台實機驗收。

## 0.48.1 Electron／builder 升級與發布候選回歸（2026-08-10）

- 升級前完整 audit 為 16 項（15 high、1 critical）；`electron@33.4.11` 與 `electron-builder@25.1.8` 分別升至 `electron@43.3.0`、`electron-builder@26.15.7`，升級後 `npm audit --json` 為 0 項，依賴總數 286。
- Electron 43 的 npm 安裝套件要求 Node.js 22.12.0 以上；專案 `engines.node` 與部署文件已同步提升，Windows workflow 使用 Node 22 的最新可用版本。
- `npm run check` 完整通過，包含 Whisper 三模型／下載取消與暫存清理、SRT sanitizer、Breeze 契約、AI fetch／optimizer／providers、Ollama streaming、review UI 與核心 API。
- round1 後補強下載取消邊界：單元 fixture 先寫入大於 0 bytes 的 `.download` 再 abort；核心 API 以 POST 啟動、GET 確認部分 bytes、DELETE 取消並等待 `.download`／`.previous` 全部清除。測試 hook 只在 `NODE_ENV=test` 與顯式旗標同時成立時啟用；Windows 真實檔案 handle 行為仍須實機驗收。
- 因上述 server 測試 hook 變更，四項候選再次重建；最終 build 已通過 SHA 清單、ZIP／NSIS archive、updater SHA-512、codesign 與兩平台封裝來源 diff。最後一次 DMG `hdiutil verify`／packaged renderer 重跑受系統權限用量上限阻擋；round1 前一 build 的兩項通過證據不能替代最終資產重驗，列為本機候選剩餘條件。
- 2026-08-11 權限恢復後補驗同一最終 build：`hdiutil verify` 回報 DMG checksum `VALID`；隔離 userData 的 packaged renderer smoke 通過 bridge、設定、上傳／完成、review AI 資產、術語 round-trip、七個 provider 與資料夾事件。round2 的本機重驗條件已解除；Windows／Base／Small／真實端點與安裝後實機仍未覆蓋。
- macOS arm64 目錄版在 Electron 43.3.0 下完成打包；隔離 userData 的 packaged renderer smoke 通過 Electron bridge、設定 modal、上傳／轉錄完成、review AI 資產、術語 round-trip、七個 provider 與資料夾開啟事件。
- Windows x64 目錄版、NSIS Setup 與 Portable 已由 macOS cross-build 產出；封裝內 App 版本為 0.48.1、PE 為 x86-64、只內建 Tiny 且包含本版 Release notes。此證據不等同 Windows 10／11 實機啟動、安裝或解除安裝。
- 兩平台 builder 仍警告 `asar:false`；本版維持既有非 ASAR 結構以避免未經回歸的 server／runtime 路徑變更，列為後續封裝強化，不把它描述為已解決。
- 簽章狀態不變：Windows 未 Authenticode，macOS 為 ad-hoc／未公證；引用 `AUTH-2026-07-23-01` 時仍須揭露，且該授權不涵蓋缺少實機驗收、metadata／checksum 不一致或機密洩漏。

## 0.48.x Whisper Metal crash 診斷（2026-07-30）

- bundled `whisper-cli`／tiny model／1 秒 16 kHz silence WAV 的預設 GPU 路徑 exit `139`；stderr 明確顯示 `ggml_metal_buffer_init: error: failed to allocate buffer`，未產生 JSON。
- 同一輸入加 `--no-gpu` exit `0` 並產生 JSON；此為已驗證 workaround，不等同產品已自動 fallback。
- 本輪未修改 runtime；Metal crash 與「成功轉錄但 quality metadata 缺失」維持不同處置，rule-score 不可用於無 cue 的 crash。
- 0.48.x 修正已在 `server.mjs` 將 Metal 非零退出導向 CPU retry；retry 前清理舊 SRT／JSON，CPU 失敗仍回報 failed。`npm run check` 通過；尚未完成長音訊／乾淨安裝實機驗收。

## 0.48.x Ollama single-cue contract 修正（2026-07-30）

- `scripts/probe-ollama-live.mjs` 現在以 native smoke 重放 Ollama adapter 使用的 `/api/chat`，帶入 `stream:false`、temperature 0、production cue schema（cue ID enum）並在 probe 內驗證 `cues`／ID／數量／文字／reason；不再以 `/v1/chat/completions` 代表 native path。
- 受控 probe（持久輸出 `docs/project-management/evidence/2026-07-30-ollama-native-contract-rerun.json`）確認 `llama3.2:1b` 的 native single-cue 回應為合法 `cues` JSON，cue ID／數量保留；模型仍將全形句號改為半形句號，屬品質／人工審核風險，不是 contract 放寬理由。
- capability probe 仍為相容端點的能力觀察；LM Studio、真正斷網與跨平台實機仍未驗收。

## 0.48.0 正式候選與本機封裝清理稽核（2026-07-30）

- 來源：`codex/0.48-local-llm` commit `dc143d24064b50ca4ddf645037d339a73d60baf4`；本機 remote-tracking ref `origin/codex/0.48-local-llm` 與 HEAD 一致。
- 開發驗證：`npm run check` 通過；`npm run docs:check:final` 通過；macOS runtime、DMG／ZIP 與 Windows runtime、Setup／Portable 已建立。macOS ZIP `unzip -t` 通過。
- 目前 SHA-256：macOS DMG `334e50b59a70c97314629faad88de1dd22f6680018265c54da5f1703becfbeee`、macOS ZIP `53ca4e3886155e221048d36f103b0933a8d49647f5e509098fcac29f2c652f80`、Windows Setup `7be0392fca7610647f1b351db182ceccbd509fdd44f79ca3eb089c09c76ebd54`、Windows Portable `b187823c1c4981211cc2b71f8a31676d6f58866589b2bf8fb61c945e75a13ca5`。兩平台 SHA 清單均已涵蓋主要安裝資產；GitHub 發布後 digest 仍待反向核對。
- GitHub 狀態：來源分支推送已由本機 remote-tracking ref 證實；`v0.48.0` Release 由需求方終端上傳中。因本執行環境無法解析 `github.com`，尚未取得公開 Release metadata、資產 digest、下載 URL 與最新 Release 指向的反向證據。
- 清理前 `dist/` 約 10 GB。逐項移除 `archive/`、`releases/`、`build-cache/`、`windows-0.45.0/`，以及根目錄 0.45.0–0.47.1 歷史封裝／blockmap／舊 checksum；刪除命令的目標容量合計輸出約 8.44 GiB，清理後約 1.9 GB。清理前逐檔輸出未保存為獨立檔案，故目前只能以 `docs/project-management/evidence/2026-07-30-dist-cleanup-summary.md` 作操作摘要，不得宣稱該數值仍可獨立重算。
- 清理後檢查：`dist/` 根目錄只保留 0.48.0 DMG／ZIP／Setup／Portable、其 blockmap、`latest.yml`／`latest-mac.yml`、兩平台 SHA、Windows 未簽章說明與 builder metadata；另保留目前的 `mac-arm64/`、`win-unpacked/` 驗證目錄。
- 回復：歷史封裝已永久移除而未送入垃圾桶；可由對應 GitHub Release 重新下載，或從既有 tag 重新建置。來源碼、tag、GitHub Release、使用者任務資料與 bundled runtime 未刪除。

## 0.48.0 GitHub 發布後核對（2026-07-30）

- 發布狀態：`v0.48.0` 已於 `2026-07-30T03:58:52Z` 正式公開，`isDraft=false`、`isPrerelease=false`，`gh release list` 顯示 `Latest`。
- 來源：tag `v0.48.0` 與遠端 `codex/0.48-local-llm` 在發布時均解析至 `4cdb0177d84693a334fac79b96c596e1b416456f`；Release URL 為 `https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.48.0`。
- 資產完整性：GitHub Release 共 9 項 uploaded 資產；macOS DMG `224057671` bytes／`334e50b...beee`、ZIP `229406028` bytes／`53ca4e...2f80`、Windows Setup `216165301` bytes／`7be039...bd54`、Portable `215460201` bytes／`b18782...3ca5`，均與本機 SHA-256 一致。
- metadata：`latest.yml` 380 bytes、`latest-mac.yml` 570 bytes；`SHA256SUMS-windows-x64.txt` 219 bytes，已同時列出 Setup 與 Portable；macOS SHA 與 Windows 未簽章狀態檔均存在。
- 下載 URL：9 項資產皆已由草稿 `untagged-*` URL 切換為 `/releases/download/v0.48.0/<asset>` 正式 URL。
- 既有風險：Windows 未 Authenticode、macOS 未 Developer ID 簽章／公證；小模型翻譯品質與跨平台乾淨實機缺口仍依 Release notes 揭露，不因 GitHub 發布完成而視為消失。
