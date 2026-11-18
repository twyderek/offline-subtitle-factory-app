# 軟體開發與部署

## 2026-10-22 更新：目前公開發行與分支狀態

- GitHub 的最新 Release 為 `v0.52.0`（2026-10-20，macOS arm64-only）。下方 2026-10-20 的「尚未公開」「Latest 0.51.0」屬**發版前歷史快照**，不得當成今日狀態。
- `main` 仍為 0.49.1 原始碼加 MIT 授權提交，與已發行 v0.52.0 tag 未同步；OSS 準備草稿 PR #15 提供同步候選，不能在尚未執行新 PR HEAD 的回歸與審查前直接合併。
- 新增 `.github/workflows/oss-pr-check.yml` 的文檔與授權檢查、production npm audit 和 Windows source regression。必須查閱 GitHub Actions run 結果；僅建立 workflow 不能宣稱通過。
- 此次文件作業不觸及安裝檔、簽章、macOS 公證或真實 YouTube OAuth 測試。第三方 binary／模型各自授權，詳見 `THIRD-PARTY-NOTICES.md`。

## 支援環境

- Node.js 22.12.0 以上；CI 目前使用 Node.js 22。Electron 43 的安裝工具鏈不再支援 Node 20。
- 0.51.0 公開版使用 Electron 43.3.0／electron-builder 26.15.7。0.52.0 source `b2b942eb6d941e61f1a5a27e065e51dd8c31e26f` 使用 Electron 43.8.0／electron-builder 26.17.0；round15 確認該 SHA 的完整 source check／production audit、macOS arm64 candidate package／runtime／checksum／signature／UI smoke、exact-source Windows CI run `39380574427`／artifact `12244799752` 與 73/73 shared app hashes 通過各自聲明範圍。Windows artifact 僅讀取 500,000-byte ZIP tail range，未下載完整 archive，無 whole-archive integrity claim；smoke 合成影片沒有有效播放／完整轉錄證明。round14 發現的額外 Windows user-profile 路徑已以中性佔位符去識別；round12 報告中的單一路徑為需求方明確核准且在 README／Release notes 揭露的唯一例外。round15 整體判 BLOCK，原因是 `00`／`05`／`06`／`08` 未同步 b2b942e 的實際證據；新工作項目已立項同步文件，文件新 SHA 須重新通過完整 check、macOS arm64 candidate、exact-source Windows CI／73-file hash gate 與 round16 無阻擋複審。依 `workflows/06-BUILD-RELEASE.md`／`workflows/07-DOCUMENT-CLOSEOUT.md`，`docs:check:final` 在發布及資產核對後執行。此版不含 Windows assets；`GHSA-hp3w-g68c-fv3c`、ad-hoc／未公證與 Google 流程未驗收仍須揭露。GitHub Latest 仍 0.51.0；不得覆寫既有 tag／Release。
- 0.50.0 開發分支目前只變更 Breeze 效能參考 payload、選取後提醒與版本識別；尚未建立 tag／Release。若進入發布流程，需以 `v0.50.0` 重新建置並重新核對雙平台資產。
- Windows 10/11 x64；封裝由 `windows-2022` runner 執行。
- Apple Silicon macOS 12 以上。

## 每次開發前

```bash
npm run project:preflight -- --type=development
git status --short
```

完成必讀並在 `08-CHANGE-LOG.md` 建立工作項目後，才可修改。安裝依賴使用 `npm ci`；不得將 token、API Key、PFX 或密碼寫入檔案。

## 本機驗證

```bash
npm run docs:check
npm run check
```

`npm run check` 應包含文件完整性、語法、媒體編輯、AI optimizer、provider、校閱 UI 與核心 API 回歸。需要本機 port 的測試若受 sandbox 限制，須明確取得授權後重跑。

## Windows runtime 與打包

```powershell
npm ci
Set-ExecutionPolicy -Scope Process Bypass
./scripts/prepare-windows-runtime.ps1
npm run check
npm run electron:build       # 需要有效簽章設定
npm run electron:build:unsigned  # 僅供已明確接受風險的未簽章版本
```

- runtime 固定版本並比對 SHA；不得依賴開發機 venv 或系統 PATH。
- 正式可信發布應配置 `WINDOWS_CODESIGN_PFX_BASE64` 與 `WINDOWS_CODESIGN_PASSWORD`。
- 未簽章發布必須在 Release notes、狀態檔與交付說明標示 Unknown Publisher／SmartScreen，並附 SHA。
- Setup、Portable、blockmap、`latest.yml` 的檔名必須彼此一致；上傳後需重新核對 GitHub 實際資產名稱。
- Breeze checkpoint、Python／PyTorch／patched Whisper runtime 不納入 Windows runtime 或安裝包；封裝必須包含 `docs/BREEZE-ASR-25.md` 與 0.49.1 Release notes，並維持 Whisper.cpp Tiny 為預設可用路徑。

## macOS 打包

```bash
npm ci
npm run check
npm run electron:build:mac:dir
npm run electron:build:mac
```

- 目前為 ad-hoc 簽章、未公證；不得描述為 Apple Developer ID 正式公證版本。
- 發布前驗證 `.app`、DMG、ZIP、bundled runtime 與 SHA。
- Electron 43 是目前維持 macOS 12 最低版本的升級線；後續若升至 Electron 44 以上，須先把最低支援版本重新評估為 macOS 13 以上。
- Breeze checkpoint、Python／PyTorch／patched Whisper runtime 不納入 App bundle；封裝內容檢查須確認沒有意外帶入開發機 venv、模型快取或約 3 GB checkpoint。

## GitHub 發布清單

1. 執行 `npm run project:preflight -- --type=release`；確認工作樹、版本號、分支、commit 與 Release tag 關係已記錄。
2. CI build 與必要測試成功；來源 SHA 與 artifact 可追溯。
3. 下載 artifact，核對 runner checksum；展開或列出封裝內容。
4. 更新 Release notes：功能、修正、手冊、簽章狀態、已知風險。
5. 上傳穩定 ASCII 檔名的資產，避免平台改名造成 checksum／updater 不一致。
6. 發布後核對名稱、大小、GitHub digest、直接下載 URL、checksum 內容與 `latest.yml`。
7. 更新 `00-CURRENT-STATUS.md`、`04-DEVELOPMENT-HISTORY.md`、`06-TEST-AND-PROCESS-AUDIT.md` 與 `08-CHANGE-LOG.md`。

## 常設簽章風險授權

- `AUTH-2026-07-23-01` 已同意 Windows Authenticode 未簽章及 macOS 未經 Apple Developer ID 簽章／公證狀態下公開發布。
- 每次適用發布須在工作紀錄引用該 ID，並持續揭露 Windows Unknown Publisher／SmartScreen 與 macOS Gatekeeper 風險。
- 此授權不涵蓋未實機測試、checksum／資產不一致、未驗證 updater metadata、機密洩漏或測試／審查失敗；完整範圍見 `09-STANDING-AUTHORIZATIONS.md`。

## 0.45.2 候選發布

- 版本：`0.45.2`；候選 tag：`v0.45.2`。
- Windows workflow：`Build Windows 0.45.2`，輸出 `offline-subtitle-factory-0.45.2-windows-x64`。
- macOS 與 Windows 均內建 `resources/docs/0.45.2/USER-GUIDE.html` 及圖文／動畫資產。
- 本次授權接受 Windows 未簽章、macOS 未公證及未完成跨平台乾淨實機測試；仍須在 Release notes 與最終狀態持續揭露。

## 回復策略

- 程式缺陷：停止新增下載導流，保留 Release 證據，發布修正版而非靜默覆蓋不可追溯內容。
- 資產命名／說明錯誤：先上傳正確資產並驗證，再刪除明確的錯誤重複項。
- checksum 不一致：視為阻擋；不得要求使用者忽略。
