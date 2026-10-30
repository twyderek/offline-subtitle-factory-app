# 獨立審查報告：FR-027 v0.52.0 macOS 候選與同源 CI/hash readiness

- 審查對象 commit／版本：`a8e839f3321ac1ea06525261baa8a2da7fe7637b`／`0.52.0`；增量差異基準 `1c045e7fff77049ff084126e3dc59e602fc60918`。
- 候選目錄：`/Users/nycu/Documents/離線字幕工廠/dist/release-0.52.0-macos-a8e839f-normal/`。
- 對應 08-CHANGE-LOG 條目：2026-10-20 — FR-027 v0.52.0 發布候選與同源 CI 驗證（`docs/project-management/08-CHANGE-LOG.md:3-27`）。
- 審查輪次：round8。
- 審查代理啟動時間、上下文來源：2026-10-20（Asia/Taipei）；本輪為獨立上下文，依 repo 規範、round6／round7 原報告、candidate provenance／README／range JSON、候選檔案及唯讀 GitHub 查詢自行核驗。round7 原報告保留且未修改；未沿用其格式或結論作為本輪證據。

## 1. 需求完整性
- 判定：通過。
- 證據：最新工作項明定本階段驗證 macOS arm64 候選與 exact-source Windows preview hash gate，不建立 tag／Release、不上傳資產，實際公開發布另立工作紀錄（`docs/project-management/08-CHANGE-LOG.md:3-15`）。round6 的缺 exact-SHA artifact 阻擋已由 round7 原報告記錄後續證據；本輪重新核對該 run、artifact 與 hashes。需求方對 Google／advisory／簽章揭露的接受範圍記於 `docs/project-management/08-CHANGE-LOG.md:22-26`，不豁免其他 gate。

## 2. 邏輯正確性
- 判定：通過。
- 證據：`git diff 1c045e7fff77049ff084126e3dc59e602fc60918 a8e839f3321ac1ea06525261baa8a2da7fe7637b` 僅有 `.github/workflows/windows-preview.yml` 一個檔案、16 行新增；內容在 checkout 前設 `core.autocrlf=false`、向 checkout 注入 Git 設定並於封裝前 fail-closed 驗證。GitHub run `39351138322` 的 API head SHA 精確等於候選 source；workflow 的 line-ending、checkout assertion、測試、unsigned preview build、renderer/install lifecycle、archive checks 與 artifact upload 步驟均成功，僅 Authenticode signed-build 步驟依 unsigned preview 條件跳過。run API 顯示 workflow path `.github/workflows/windows-preview.yml`、名稱 `Build Windows 0.52.0`。

## 3. 邊界情況
- 判定：部分通過。
- 證據：以 GitHub 認證 artifact redirect 取得 HTTP 206 byte ranges，讀取 ZIP central directory 及 manifest／checksum entries；ZIP 記載 7 個 entries，兩個目標 entry 的 CRC-32 與解壓 size 均有效。獨立重算 manifest SHA-256 為 `e7af0c860f7a7e99f695c8d70f1c85b6463c4320841cbb7c35f771bdd3ffee94`，與 artifact checksum sidecar 相符；manifest 版本／source 正確，與候選 app 排除 `node_modules` 後 73 個路徑集合一致，raw SHA-256 為 73/73 相符、0 mismatch。核驗摘要另存於候選目錄 `windows-ci-source-manifest-range-check-39351138322.json`。完整 504,800,541-byte ZIP 未下載，故不宣稱 whole-archive integrity、Windows 實機驗收或 Windows 發行資產通過。
- 證據：候選 UI retry JSON 記錄四個 viewport、renderer fixture 12/12、`googleRequests=false`；截圖顯示上傳對話框與錯誤提示可見。首次 smoke 的 cleanup JSON 記錄 process group 已關閉、未強制清理、profile 已移除；retry 使用新 evidence path。retry 的 3 秒合成影片 `currentTime=0.000525` 且 `paused=true`，不構成有效播放、完整轉錄或真實上傳證明。

## 4. 程式碼品質
- 判定：部分通過。
- 證據：本輪增量 workflow diff 未更動產品 runtime，`permissions: contents: read` 保留；YAML parser 成功解析，且 exact-SHA workflow 已實際執行成功。`README.md:15`、`RELEASE-NOTES-0.52.0.md:21-23` 揭露真實 Google OAuth／Keychain／頻道上傳未驗收、advisory 與 production audit 範圍；`docs/project-management/09-STANDING-AUTHORIZATIONS.md:5-14` 的 `AUTH-2026-07-23-01` 覆蓋 ad-hoc／未公證風險，但明確不豁免 checksum、機密、測試或審查 gate。候選簽章狀態檔標示 ad-hoc、無 Developer ID／公證、Gatekeeper 未測。`PROVENANCE.txt` 說明未來 tag source archive 含完整 tracked tree；`git grep -n '/Users/nycu' a8e839f... -- docs/project-management` 找到繼承自公開 branch base 的歷史個人路徑。本輪未發現該等路徑是憑證；這項揭露不等同 source archive 不含個人路徑，應帶入另立的公開發布紀錄。

## 5. 測試覆蓋
- 判定：部分通過。
- 證據：本輪實際執行 `npm run docs:check`（19 個文件通過）、`git diff --check`、source diff whitespace check、workflow YAML parse、候選 `shasum -a 256 -c SHA256SUMS-macos-arm64.txt`（四項 OK）、ZIP `unzip -tq`、DMG `hdiutil verify`（VALID）、`codesign --verify --deep --strict`，均通過。以 `OFFLINE_SUBTITLE_TOOLS_DIR=<candidate app>/Contents/Resources/tools node scripts/verify-runtime-package.mjs --target=darwin-arm64` 驗證候選 FFmpeg／FFprobe／Whisper.cpp／Tiny model 與 manifest，回報 `[runtime] OK`。另獨立重算 `latest-mac.yml` 內 DMG／ZIP bytes、大小及 Base64 SHA-512，兩項全符。未重跑完整 `npm run check`；工作紀錄保存的先前完整回歸為 exit 0，exact-source Windows CI 的完整 regression 步驟亦成功。本輪遵照任務指示未執行 `npm run docs:check:final`；該結案檢查由主要代理在報告連結及 milestone 狀態更新後執行。

## 6. 實際運行結果
- 判定：通過。
- 證據：候選 provenance 指向 exact source `a8e839f...`。DMG／ZIP／兩個 blockmap SHA-256 sidecar 全部相符，DMG checksum VALID、ZIP 無壓縮錯誤，deep strict codesign 通過；bundle Info.plist 為 0.52.0，主執行檔為 Mach-O arm64，簽章 identity 為 ad-hoc、無 Team ID。updater metadata 中 ZIP 256,484,010 bytes、DMG 262,455,945 bytes 與各自 SHA-512 均匹配實體檔案。唯讀遠端查詢確認 release branch 指向 `a8e839f...`，run `39351138322` success，artifact `12233128155` 為 504,800,541 bytes 且未過期；Latest 仍 `v0.51.0`，`v0.52.0` tag ref 與 Release 均不存在。未執行 push、tag、Release 或資產上傳。

## 綜合判定
- 結論：通過
- 可逐字引用的完整結論句：**「本輪限定的 v0.52.0 macOS 候選與 exact-source CI/hash readiness 門檻通過；此判定不核准建立 tag、GitHub Release 或上傳資產。」**
- 阻擋問題（若有）：本候選 readiness milestone 無阻擋問題。這不是公開發布核准；公開發布須另立工作紀錄，執行其授權與發布後資產／下載核對。
- 剩餘風險：完整 Windows preview ZIP 未下載，無 whole-archive integrity claim；影片有效播放、真實 Google OAuth／Keychain／頻道授權及影片字幕上傳未驗收；ad-hoc／未公證且 Gatekeeper 未測；已知 build-time moderate advisory；source archive 含既有歷史絕對路徑。以上須在後續公開發布階段持續揭露與核對。`docs:check:final` 尚未由本輪執行。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
