# 軟體開發與部署

## 支援環境

- Node.js 20 以上；CI 目前使用 Node.js 22。
- Windows 10/11 x64；封裝由 `windows-2022` runner 執行。
- Apple Silicon macOS 12 以上。

## 每次開發前

```bash
npm run project:preflight
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

## macOS 打包

```bash
npm ci
npm run check
npm run electron:build:mac:dir
npm run electron:build:mac
```

- 目前為 ad-hoc 簽章、未公證；不得描述為 Apple Developer ID 正式公證版本。
- 發布前驗證 `.app`、DMG、ZIP、bundled runtime 與 SHA。

## GitHub 發布清單

1. 工作樹乾淨，版本號、分支、commit 與 Release tag 關係已記錄。
2. CI build 與必要測試成功；來源 SHA 與 artifact 可追溯。
3. 下載 artifact，核對 runner checksum；展開或列出封裝內容。
4. 更新 Release notes：功能、修正、手冊、簽章狀態、已知風險。
5. 上傳穩定 ASCII 檔名的資產，避免平台改名造成 checksum／updater 不一致。
6. 發布後核對名稱、大小、GitHub digest、直接下載 URL、checksum 內容與 `latest.yml`。
7. 更新 `00-CURRENT-STATUS.md`、`04-DEVELOPMENT-HISTORY.md`、`06-TEST-AND-PROCESS-AUDIT.md` 與 `08-CHANGE-LOG.md`。

## 0.45.2 候選發布

- 版本：`0.45.2`；候選 tag：`v0.45.2`。
- Windows workflow：`Build Windows 0.45.2`，輸出 `offline-subtitle-factory-0.45.2-windows-x64`。
- macOS 與 Windows 均內建 `resources/docs/0.45.2/USER-GUIDE.html` 及圖文／動畫資產。
- 本次授權接受 Windows 未簽章、macOS 未公證及未完成跨平台乾淨實機測試；仍須在 Release notes 與最終狀態持續揭露。

## 回復策略

- 程式缺陷：停止新增下載導流，保留 Release 證據，發布修正版而非靜默覆蓋不可追溯內容。
- 資產命名／說明錯誤：先上傳正確資產並驗證，再刪除明確的錯誤重複項。
- checksum 不一致：視為阻擋；不得要求使用者忽略。
