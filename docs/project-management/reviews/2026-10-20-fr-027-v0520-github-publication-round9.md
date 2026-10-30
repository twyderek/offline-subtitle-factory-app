# 獨立審查報告：FR-027 v0.52.0 GitHub 公開發布 round9

- 審查對象 commit／版本：`a8e839f3321ac1ea06525261baa8a2da7fe7637b`／`0.52.0`。
- 候選目錄：`/Users/nycu/Documents/離線字幕工廠/dist/release-0.52.0-macos-a8e839f-normal/`。
- 對應 08-CHANGE-LOG 條目：2026-10-20 — FR-027 v0.52.0 GitHub 公開發布（macOS arm64），`docs/project-management/08-CHANGE-LOG.md:3-25`。
- 審查輪次：round9。
- 審查代理啟動時間、上下文來源：2026-10-20 09:51–09:54（Asia/Taipei；查證時間戳取樣為 09:51:36、09:53:23、09:54:18）。本報告由獨立審查上下文完成，只依本次審查要求、repo 規範、工作樹、候選產物與唯讀 GitHub 查詢；未收到開發代理的評價性摘要，未沿用其結論。

## 1. 需求完整性
- 判定：部分通過。
- 證據：`docs/project-management/08-CHANGE-LOG.md:11-13,19-25` 記錄發布範圍為 macOS arm64、明確授權 tag／Release 與資產公開，並接受真實 Google OAuth／Keychain／頻道上傳、`GHSA-hp3w-g68c-fv3c` 及 ad-hoc／未公證風險；`docs/project-management/09-STANDING-AUTHORIZATIONS.md:5-14` 的 `AUTH-2026-07-23-01` 涵蓋未簽章／未公證發布。`RELEASE-NOTES-0.52.0.md:20-23` 已揭露 macOS arm64 範圍、真實 Google／Keychain／上傳尚未驗收、ad-hoc／未公證，以及 8 個 moderate build-time advisory paths；這些已接受風險有對應文字。
- 證據：額外發布授權與風險核對：候選 `PROVENANCE.txt:9` 明載未來 tag source archive 包含完整 tracked tree 及既有歷史本機絕對路徑；對指定 commit 執行 `git grep -n -I -E '/Users/nycu|/Users/[^/[:space:]]+' a8e839f3321ac1ea06525261baa8a2da7fe7637b -- docs/project-management`，結果為 145 行、60 個文件。例：`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:327,339`、`docs/project-management/08-CHANGE-LOG.md:912,917,926`（路徑值在此刻意不重複輸出）。`08-CHANGE-LOG.md:15` 要求在 README／Release notes 保留該 source archive 風險，但 `README.md:3-17` 與 `RELEASE-NOTES-0.52.0.md:1-35` 均未揭露。當前授權列出的風險未明確接受 source archive 本機路徑曝光。
- 證據：`PROVENANCE.txt:18` 記錄 3 秒合成影片的播放進度僅 0.000525 秒且 paused；`RELEASE-NOTES-0.52.0.md:16` 只稱本機 packaged UI 檢查通過，未說明該 smoke 不構成有效播放驗收。此與 `08-CHANGE-LOG.md:15` 要求保留的播放限制不一致。兩項揭露缺口影響發布前風險知情同意，列為阻擋。

## 2. 邏輯正確性
- 判定：通過。
- 證據：唯讀 Git 檢查的 HEAD 與候選 provenance 均為 `a8e839f3321ac1ea06525261baa8a2da7fe7637b`；遠端 `codex/0.51-anthropic-claude` 亦指向該 SHA，`main` 指向 `7829876862bca5dff72098aa6831b61fc266d594`。Preflight／`git status --short` 顯示工作樹有既存文件與 evidence 變更；依 exact SHA 建立 tag 不會包含未提交變更。`git ls-remote` 查無 `refs/tags/v0.52.0`；GitHub Releases API 查得 Latest 為 `v0.51.0`，`/releases/tags/v0.52.0` 回應 404。無既有 v0.52.0 tag／Release 可被覆寫。
- 證據：在候選目錄重跑 `shasum -a 256 -c SHA256SUMS-macos-arm64.txt` 四項皆 OK，並以 `stat -f '%z %N'` 實量候選資產：

  | 檔名 | 大小（bytes） | SHA-256 |
  |---|---:|---|
  | `offline-subtitle-factory-0.52.0-macos-arm64.dmg` | 262455945 | `ad59d2b4e219dbe83414f65c7c99a053a23ccd96b948658dae6bc801f80416e1` |
  | `offline-subtitle-factory-0.52.0-macos-arm64.zip` | 256484010 | `7409ab2141301aaf7fc324a5ac9d1be4608639d15b14b67d49a7ec60930ff099` |
  | `offline-subtitle-factory-0.52.0-macos-arm64.dmg.blockmap` | 275278 | `60879d9d90ab45669a8e5e8edc5ceaf1bc41d3ab367a29b7ea26bd44d7d564e4` |
  | `offline-subtitle-factory-0.52.0-macos-arm64.zip.blockmap` | 268340 | `9a04b4324422f3b7c016b1efc2705396d62953fa21263208cb1fcc94d0d4aef9` |

  `latest-mac.yml` 為 570 bytes：ZIP 256484010 bytes／SHA-512 `jKL+SFsyJsBxm1hVvPYgr9Xvy1jUj7Veln1TRPETyjH0cyCUxRS9pZi8dSCAM8ZXkvFqP6oWj05Yk934S3K5uA==`、DMG 262455945 bytes／SHA-512 `t9qz8DgeobR76rMCw/wPH5K5n6nmWDuxvhR4Cs7/UbF06MPSTLDEkTNX945z1w8NGPumSzZ7vvNVyQkJuYz+5Q==`；本輪對兩檔重新計算所得值與 metadata 相同。另有 `SHA256SUMS-macos-arm64.txt` 474 bytes、`SIGNING-STATUS-macos-arm64.txt` 367 bytes、`PROVENANCE.txt` 5245 bytes、`TEST-CANDIDATE-README.md` 2986 bytes。08 條目列出的預定上傳清單為前七項；兩份候選說明文件目前未列入上傳清單。
- 證據：`unzip -tq` 完整檢查本機 macOS ZIP 無錯；`hdiutil verify` 回報 DMG checksum VALID；`latest-mac.yml` 的版本、URL、大小及 SHA-512 對應本機 bytes。上述只證明這些本機候選的關聯正確，尚非 GitHub 上傳後核對。

## 3. 邊界情況
- 判定：部分通過。
- 證據：候選目錄 `windows-ci-source-manifest-range-check-39351138322.json` 記錄 exact-source Windows run `39351138322` 成功、artifact `12233128155` 大小 504800541 bytes、manifest checksum sidecar 相符、73/73 shared raw hashes 相符。但該 JSON 同時明載 `completeArtifactArchiveDownloaded=false`，只以 HTTP byte ranges 讀取 ZIP directory、manifest 與 checksum entries 並核對其 entry CRC／size；不能稱完整 Windows ZIP integrity 已驗證，該 artifact 亦非 Windows 發行資產或實機驗收。
- 證據：`PROVENANCE.txt:18,20,22-25` 與 `youtube-ui-smoke-retry1.png.json` 顯示 UI fixture 12/12、四個 viewport、`googleRequests=false`，但 3 秒合成影片 `currentTime=0.000525`、`paused=true`。候選證據不涵蓋有效影片播放／全長轉錄、真實 Google OAuth、Keychain、頻道授權或影片／字幕上傳；本報告未把 byte-range 核對擴稱 ZIP 完整性，也未把 UI smoke 擴稱媒體或 Google 實測。

## 4. 程式碼品質
- 判定：部分通過。
- 證據：round9 發布前增量由 `git diff 1c045e7fff77049ff084126e3dc59e602fc60918 a8e839f3321ac1ea06525261baa8a2da7fe7637b` 核對，只改 `.github/workflows/windows-preview.yml` 16 行：checkout 前設定並注入 `core.autocrlf=false`，另在封裝前斷言設定值；產品 runtime 未變。exact SHA 的 Windows workflow run 成功，候選 source/app manifest 及 73 個跨平台共用檔案 hash gate 通過，未發現這項增量的邏輯或封裝回歸。
- 證據：候選 provenance 說明 electron-builder app bundle 排除 `docs/project-management/`，但 GitHub source archive 會包含這些 tracked files；上述 145 行本機絕對路徑仍在來源樹中。這不是 app bundle 的程式缺陷，卻是公開 source archive 的個資／路徑揭露邊界，且目前發布說明與明確風險接受均未涵蓋，阻止完整程式交付品質判定。

## 5. 測試覆蓋
- 判定：部分通過。
- 證據：本輪於 2026-10-20 約 09:52（Asia/Taipei）執行 `npm run check`，exit 0，耗時約 21 秒；`docs:check` 的 19 個文件檢查、語法檢查、完整核心 test suite 及 posttest 四組 YouTube publisher／SDK／stream／lifecycle suites 均通過。`OFFLINE_SUBTITLE_TOOLS_DIR=<候選 app>/Contents/Resources/tools node scripts/verify-runtime-package.mjs --target=darwin-arm64` exit 0；`npm audit --omit=dev` 為 0 vulnerabilities。完整 `npm audit` exit 1，列出 8 moderate paths，均沿 electron-builder build-time chain 並歸至 `GHSA-hp3w-g68c-fv3c`，與 Release notes 揭露一致。
- 證據：本輪另重跑 SHA256SUMS、DMG／macOS ZIP integrity、updater SHA-512／size 及 strict codesign，均通過。未執行 `npm run docs:check:final`；該命令屬目前公開發布工作項的文件結案步驟，工作項仍進行中且本審查唯一檔案寫入限制不允許我更新 08。完整 Windows preview ZIP 未下載、Windows 實機與真實 Google 流程均不在已完成測試範圍。

## 6. 實際運行結果
- 判定：部分通過。
- 證據：`mac-arm64/離線字幕工廠.app/Contents/Info.plist` 版本為 0.52.0，主執行檔為 arm64 Mach-O；`codesign --verify --deep --strict` 成功，簽章資訊為 `Signature=adhoc`、`TeamIdentifier=not set`。`SIGNING-STATUS-macos-arm64.txt:3-8` 明列未使用 Developer ID、未公證且 Gatekeeper 未測。candidate runtime package verifier 回報 `[runtime] OK: darwin-arm64`。
- 證據：檢視 exact-source 候選保存的 `youtube-ui-smoke-retry1.png` 及 JSON：UI modal／錯誤提示可見、fixture 12/12、cleanup JSON 記錄 process group closed、未強制終止、profile removed；但影片停在 0.000525 秒，沒有真實 Google requests。這證明有限 UI/layout/usability smoke 與清理結果，不證明有效播放、完整轉錄或上傳。未建立 tag／Release，未上傳任何資產。

## 綜合判定
- 結論：不通過
- 可逐字引用的完整結論句：**本輪 0.52.0 GitHub 公開發布前審查不通過：Release notes 未揭露 source archive 既有本機絕對路徑及 UI smoke 未驗證有效播放，補齊揭露並取得相應風險接受或移除路徑後，才可繼續發布。**
- 阻擋問題（若有）：
  1. **P1 — source archive 路徑揭露／授權缺口。** `PROVENANCE.txt:9` 與 exact commit 的 `git grep` 證明 source archive 會帶入 145 行、60 個治理文件中的歷史本機路徑；`README.md`、`RELEASE-NOTES-0.52.0.md` 未揭露，且 `08-CHANGE-LOG.md:23` 已記風險接受範圍沒有列此項。未取得需求方明確接受並完成披露，或從發布 source tree 移除該路徑前，不得建立 tag／Release。
  2. **P2 — packaged UI 播放宣稱邊界未在 Release notes 明示。** `RELEASE-NOTES-0.52.0.md:16` 稱 packaged UI checks 通過；實際候選影片只有 0.000525 秒進度且 paused。需明示 smoke 不構成有效播放／轉錄驗收，以免讀者擴大解讀。
- 剩餘風險：Windows preview artifact 僅做抽樣 byte-range／73 個共享檔 hash 核對，完整 ZIP integrity 未驗證；沒有 Windows 實機驗收。真實 Google OAuth、Keychain、頻道授權、影片及字幕上傳未驗收。ad-hoc／未 Developer ID／未公證，Gatekeeper 未測。媒體有效播放／完整轉錄未驗收。完整 dependency audit 有 8 moderate build-time paths，production audit 為 0。這些限制不因候選完整性或核准的三項風險而消失。
- 給主要開發代理的具體修正要求：在 README 與 Release notes 清楚揭露 source archive 的歷史本機路徑範圍，並取得需求方對該額外風險的明確接受；或先清除發布 source tree 內路徑，再以新 source commit 重建並重跑來源／CI／候選 checks。Release notes 同時說明目前 UI smoke 僅為 UI/layout 驗證，3 秒合成媒體只前進 0.000525 秒，不是播放、轉錄或 Google 上傳驗收。任何 source／發布文字變更影響候選時，依 exact source 更新資產與 CI 證據並另行複審。本輪結論不授權 tag、Release 或資產上傳。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
