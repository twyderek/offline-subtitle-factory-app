# 獨立最終發布審查報告：FR-027 v0.52.0 GitHub 公開發布 round15

- 審查對象 commit／版本：`b2b942eb6d941e61f1a5a27e065e51dd8c31e26f`／`0.52.0`。
- 分支：`codex/0.51-anthropic-claude`；審查時 HEAD 與指定 SHA 相同，tracked working tree 無差異。
- macOS 候選：`../dist/release-0.52.0-macos-b2b942e-normal/`。
- Windows preview：[run 39380574427](https://github.com/twyderek/offline-subtitle-factory-app/actions/runs/39380574427)，artifact `12244799752`。
- 對應工作紀錄：`docs/project-management/08-CHANGE-LOG.md`，2026-10-20「FR-027 v0.52.0 round14 隱私 blocker 修正與 final-source 複審」。
- 審查輪次與時間：round15；2026-10-20 UTC；本報告由獨立審查上下文依需求方指定 SHA、候選、CI run/artifact 及唯讀範圍完成。
- 範圍：檢查來源隱私、候選完整性、Windows preview、UI 宣稱、安全揭露、治理與發行狀態。未建立 tag／Release、未上傳資產。唯一寫入為本報告。

## 綜合判定

- 結論：**BLOCK**。
- 技術 gate：本報告查核的 b2b942e macOS 候選與 exact-source Windows preview 證據通過其聲明範圍；round14 所指的額外個人路徑已在來源中去識別，掃描未發現其他未授權個人路徑。
- 發布阻擋：受控狀態與測試文件仍描述 round14 的 blocker 尚未修正，並稱 b2b942e source check、候選及 Windows CI 尚未執行。此狀態與本輪實際證據互相矛盾；發布前須同步紀錄。若同步造成新 source SHA，該 SHA 必須重新取得相符的來源、候選、CI/hash 及獨立審查證據。
- 另有一項非個資洩漏的 provenance 掃描措辭落差，詳見第 1 節；它不改變個人路徑掃描結果，但應在再次引用該 provenance 時更正範圍說明。

## 1. 來源／隱私與範圍

- 判定：**通過；provenance 掃描範圍說明有一項非阻擋落差。**
- `git rev-parse HEAD` 與分支查核符合指定 SHA／branch。`git diff-tree` 顯示 b2b942e 僅變更 `NEXT-VERSION-FIX-LOG.md`、README、0.52.0 release notes、`00`／`05`／`06`／`08` 管理文件及新增的 round14 報告；沒有產品 runtime 或測試程式碼變更。
- `NEXT-VERSION-FIX-LOG.md:27` 已以中性佔位符取代 round14 發現的 Windows user-profile 範例。README `:17` 與 `RELEASE-NOTES-0.52.0.md:23` 說明歷史 home／Windows user-profile 路徑已去識別，並將未修改的 round12 審查原件列為需求方明確接受的唯一個人路徑例外。round12 原件不在 b2b942e 變更檔案清單內。
- 對 HEAD tracked files 執行 POSIX／Windows user-profile pattern scan，排除 round12 明確授權原件後，命中只在三個測試檔：`scripts/test-breeze-asr.mjs:134`、`scripts/test-ollama-ui-offline.mjs:56,64,84,104`、`scripts/test-report-optimizations.mjs:83-84`。逐項檢視顯示這些是路徑遮罩測試輸入與斷言，使用通用合成值，並非機器專屬路徑。包含授權原件的掃描結果只多出該原件；沒有發現其他個人路徑。
- `PROVENANCE.txt:9` 說明掃描排除 round12 原件及 `test-breeze-asr.mjs` 的合成 fixture，並稱無其他命中。上述獨立掃描也命中 `test-ollama-ui-offline.mjs` 與 `test-report-optimizations.mjs` 的通用合成 fixture。這兩處沒有個資，但 provenance 對掃描命中／排除範圍的敘述不完整。建議更正 provenance 或在後續使用時明確列出三個合成測試位置；此項不構成額外個人資料外洩。
- 發布範圍在 README／release notes 限定為 macOS arm64；Windows preview 不列為公開發行資產。

## 2. 建置／產物來源與完整性

- 判定：**通過。**
- `PROVENANCE.txt:1-7` 記載版本、分支、source SHA、build command 與 arm64 候選；與指定 HEAD 相符。
- 候選 DMG `246,876,207` bytes，SHA-256 `d503f44a76b066ead4298eb7c7f63066b79cfb18e271f17a1b6384d379396b22`；ZIP `255,845,260` bytes，SHA-256 `68fc2bb6c8d50ffe19c39a3750083348d4f8df50e80a1b88e42ce336f37b7c2b`。DMG／ZIP 及兩個 blockmap 的 SHA-256 sidecar 四項全數核對成功；兩個 blockmap 大小分別為 `258,052`／`266,366` bytes。
- `latest-mac.yml` 的 DMG／ZIP size 與 SHA-512 由實際 bytes 重新計算後相符。`hdiutil verify` 回報 DMG checksum VALID；`unzip -tq` 無錯；對 unpacked app 執行 `codesign --verify --deep --strict` 成功。
- `Info.plist` 版本為 `0.52.0`，主 executable 為 Mach-O arm64。以候選 app 內的 tools 執行 `scripts/verify-runtime-package.mjs --target=darwin-arm64` exit 0，runtime manifest、FFmpeg、FFprobe、Whisper CLI 與 tiny model 驗證通過。
- 以上驗證支持 macOS 候選封裝與列出的 checksum；不等同乾淨機安裝或 Gatekeeper 驗收。

## 3. CI／Windows preview 證據

- 判定：**通過，限 manifest/hash gate 與 workflow 所列 preview 工作。**
- GitHub run API 回報 `completed/success`，push event head SHA 為 `b2b942eb6d941e61f1a5a27e065e51dd8c31e26f`。source／FFmpeg regression、unsigned preview package、renderer/install lifecycle、archive checksum 與 artifact upload 步驟均成功；Authenticode 簽章建置因無憑證而 skipped。
- Artifact `12244799752` 名稱為 `offline-subtitle-factory-0.52.0-windows-x64`，大小 `504,801,641` bytes，未過期。GitHub API digest 為 `sha256:626b3a708d6eb073c72de1cdaff842dcd80dd53a94be33812bef0ddf3d8ab52c`。
- 候選內 `windows-ci-source-manifest-range-check-39380574427.json` 記錄一段 500,000-byte ZIP tail range；7 個 central-directory entries 中所選 manifest／checksum entries 的 CRC 與 uncompressed size 有效，manifest SHA-256 與 artifact checksum sidecar 相符。source/version 正確，73 個共用 app paths 的相對路徑集合相同且 raw SHA-256 全數相符（73/73，0 mismatch）。
- 完整 Windows ZIP 未下載，故沒有 whole-archive integrity 結論。此 unsigned artifact 是 internal preview，不是本次 Windows 發行資產，也不證明 Windows 實機安裝或執行。

## 4. 功能／UI 宣稱與證據

- 判定：**通過，限畫面、版面與 mock 互動範圍。**
- `youtube-ui-smoke.png.json` 記錄 candidate Electron usability audit、四個 viewport、`googleRequests=false` 及錯誤狀態；候選截圖呈現上傳設定視窗與 OAuth 未設定提示。cleanup JSON 記錄 process group 關閉、未強制清理及 profile 移除。
- 3 秒合成媒體的主 smoke 記錄 `currentTime=0.000176`、`paused=true`。這不證明有效播放、全長轉錄或字幕品質。沒有真實 Google OAuth／Keychain／頻道授權、影片上傳或字幕上傳驗收。
- README 與 release notes 對 packaged UI smoke 的範圍限制與證據相符；沒有把此 smoke 描述成有效媒體或實帳號驗收。

## 5. 安全／簽章／依賴揭露

- 判定：**通過，限已檢查的揭露與 audit 結果。**
- `SIGNING-STATUS-macos-arm64.txt` 與 release notes 均揭露 ad-hoc 簽章、沒有 Developer ID／公證、Gatekeeper 未測。strict codesign 成功只證明簽章結構可驗證，不代表 Apple 開發者信任或 Gatekeeper 接受。
- 本輪對指定 source 執行 `npm audit --omit=dev --json`：0 vulnerabilities。完整 `npm audit --json`：8 moderate、0 high／critical，位於 build-time dependency chain；release notes 揭露 `GHSA-hp3w-g68c-fv3c` 與其 build-time 範圍，與 audit 結果一致。
- README／release notes 與工作紀錄揭露真實 Google／Keychain／上傳流程尚未驗收。08 紀錄中的 2026-10-19 發布核准明確接受此風險、build-time advisory 與 ad-hoc／未公證狀態，並未豁免 source、checksum 或審查 gate；`AUTH-2026-07-23-01` 另涵蓋未簽章／未公證風險。

## 6. 治理／流程與發布準備

- 判定：**不通過（BLOCK）。**
- round14 所指的個人 Windows profile 路徑已匿名化，README／release notes 的 source-archive 例外揭露已更新；round14 對 round13 文件同步及 final-gate 時序問題的結案判斷見其原報告第 4 節。`workflows/06-BUILD-RELEASE.md` 與 `07-DOCUMENT-CLOSEOUT.md` 將 `npm run docs:check:final` 定位為發布及資產核對後的結案步驟；本輪未在發布前執行該命令，這一點不構成 blocker。
- 目前受控文件沒有同步本輪結果：`00-CURRENT-STATUS.md:5-13` 仍指向 source `3312c37`，稱 round14 隱私 blocker 尚待修正及 b2b 後續 gate 待執行；`05-DEVELOPMENT-AND-DEPLOYMENT.md:6` 仍稱 round14 整體 BLOCK 且修正後新 SHA 待重驗；`06-TEST-AND-PROCESS-AUDIT.md:3-8` 仍將去識別後的完整 source check、候選、Windows CI/hash 與 round15 列為待執行；`08-CHANGE-LOG.md:16-24` 亦記錄來源尚待 commit/push、新 SHA checks 尚未執行。這些敘述與 b2b942e、其候選與 run 39380574427 的現況衝突。
- GitHub 查核：`v0.52.0` release/tag API 均回 HTTP 404，`git ls-remote` 無該 tag；GitHub Latest 仍為 `v0.51.0`。此為未發布狀態，符合本輪唯讀範圍。
- 有效發布授權存在，但治理紀錄仍待同步，故目前不能據此判定可發布。`docs:check:final` 應依上述 workflow 留至發布後；先修正受控狀態，再依其形成的最終 source SHA 完成相符檢查、候選、exact-source Windows/hash gate 及獨立審查。不要以本輪 b2b942e 證據代表後續不同 SHA。

## 阻擋事項與其他修正要求

1. **P1 — 發布狀態／證據未同步。** 更新 `00-CURRENT-STATUS.md`、`05-DEVELOPMENT-AND-DEPLOYMENT.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`08-CHANGE-LOG.md`，明確記錄 round14 隱私 blocker 已解除及 b2b942e 的來源檢查、macOS 候選、Windows run/artifact/hash、UI 限制、簽章／依賴風險與本輪結論。若更新形成新 commit，對新 SHA 重跑其要求的來源與發布 gate 並取得新的獨立審查；不得標示待驗證事項已完成而未附證據。
2. **P2（非阻擋）— provenance scan scope 註記。** `PROVENANCE.txt:9` 的排除清單漏列兩處通用合成測試 fixture。更新該句或附上精確 scan 結果後再將它作為掃描紀錄引用。此發現沒有顯示額外個人路徑。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證；未修改其他專案檔案，未建立 tag／Release，未上傳資產。
- 本報告未包含任何本機絕對 filesystem path。若上述聲明不實，本報告無效。
