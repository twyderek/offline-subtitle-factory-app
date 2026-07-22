# 獨立審查報告：重建 0.45.2 AI 供應商修正版候選資產

- 審查對象 commit／版本：工作樹 `codex/release-v0.45.2`／`0.45.2`；本輪未指定 commit，工作樹含未提交修改
- 對應 08-CHANGE-LOG 條目：2026-07-22 — 重建 0.45.2 AI 供應商修正版候選資產
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-22（Asia/Taipei）；由獨立委派上下文啟動，未沿用主要開發代理的對話記憶

## 1. 需求完整性

- 判定：不通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md` 的 FR-009／NFR-003／NFR-004／NFR-008 要求供應商整合、Apple Silicon 相容、封裝 runtime 與發布資產一致。
  - `docs/project-management/05-DEVELOPMENT-AND-DEPLOYMENT.md` 要求 macOS 的 `.app`、DMG、ZIP、bundled runtime、SHA 及 updater metadata 一致，並要求穩定 ASCII 發布檔名。
  - macOS arm64 `.app`、DMG、ZIP 已產生，App 版本為 `0.45.2`，且內含 provider、手冊與 runtime；但 `/Users/nycu/Documents/離線字幕工廠/dist/latest-mac.yml` 參照的 `offline-subtitle-factory-0.45.2-arm64-mac.zip` 與 `offline-subtitle-factory-0.45.2.dmg` 均不存在，實際產物為 `離線字幕工廠 0.45.2 macOS-arm64.zip` 與 `離線字幕工廠 0.45.2 macOS-arm64.dmg`。
  - `docs/project-management/00-CURRENT-STATUS.md` 已記錄 Windows 候選仍為 2026-07-20 CI 資產，落後 2026-07-22 provider 修正；因此兩平台候選尚未同時代表目前來源。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - `npm run check`（2026-07-22，Asia/Taipei）通過文件檢查、JavaScript 語法、治理 validator、媒體、AI optimizer、provider、review UI 與核心回歸測試。
  - `npm run electron:build:mac` 的建置輸出確認 electron-builder 產生中文檔名 DMG／ZIP；同一輪輸出的 `latest-mac.yml` 卻使用另一組 ASCII 檔名。依檔案存在性核對，兩個 metadata URL 均為 `MISSING`，所以自動更新／下載解析會指向不存在的資產。
  - `package.json:138` 將 macOS `artifactName` 設為 `${productName} ${version} macOS-${arch}.${ext}`；此設定直接造成實際資產名稱與 `latest-mac.yml` 內容不一致，屬可重現的打包設定／metadata 邏輯缺陷。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 已驗證 DMG 完整性：`hdiutil verify` 回報 checksum `VALID`。
  - 已驗證 ZIP 完整性：`unzip -t` 回報 `ZIP_TEST_OK`。
  - 已驗證 App ad-hoc codesign：`codesign --verify --deep --strict --verbose=2` 回報 `valid on disk` 且 `satisfies its Designated Requirement`。
  - 已驗證 App 的版本、bundle identifier、FFmpeg、FFprobe、Whisper CLI、`ggml-tiny.bin`、runtime manifest、`resources/docs/0.45.2/USER-GUIDE.html`，以及 ZIP 中的 `ai-provider-settings.mjs`／`review.js`。
  - 未覆蓋真實 Groq／Gemini API key 外部呼叫、Windows 目前來源重建、Windows／macOS 乾淨實機安裝啟動，以及完整使用者流程。macOS 資產仍是 ad-hoc、未 Apple Developer ID 簽章／公證；Windows 候選亦未 Authenticode 簽章。這些風險雖有文件揭露，仍是發布候選的未覆蓋邊界。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - provider registry、UI provider settings 與 renderer 驗證由 `npm run check` 的 provider／review UI／core 測試覆蓋，且封裝後 App 實際包含 `public/ai-provider-settings.mjs`、`public/review.js` 與 `server.mjs`。
  - 建置設定將使用者可見的中文 `productName` 放入 macOS `artifactName`，但 updater metadata 仍產生 ASCII 預設檔名；沒有在產物交付前以實際檔名閉環驗證，造成可避免的發布品質缺陷。
  - `asar` disabled 與 ad-hoc identity 設定屬既有明示風險；本輪未將其誤宣稱為正式簽章或公證版本。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 獨立審查執行 `npm run project:preflight`：版本 `0.45.2`、分支 `codex/release-v0.45.2`，並確認工作樹有既有修改。
  - 獨立審查執行 `npm run check`（2026-07-22，Asia/Taipei）：治理文件檢查、語法檢查及全部 npm test 通過；核心回歸包含 API token、Origin、串流上傳、任務、聲波、修剪、字幕重算、還原、分頁與取消狀態。
  - 主要建置證據：`npm run electron:build:mac:dir` 與 `npm run electron:build:mac` 均完成；runtime manifest／verify 通過，App 內資產核對通過。
  - 封裝格式測試通過，但 updater metadata 的檔名／URL 一致性測試未通過；既有自動測試沒有捕捉此問題。也未完成乾淨實機、安裝後啟動、updater 實際下載或真實供應商網路 smoke test。

## 6. 實際運行結果

- 判定：不通過
- 證據：
  - 實際檢查 `/Users/nycu/Documents/離線字幕工廠/dist/mac-arm64/離線字幕工廠.app` 的 Info.plist 得到版本 `0.45.2`、bundle identifier `com.offline-subtitle-factory.app`。
  - 實際 `codesign` 驗證 App 成功；實際檢查 bundled FFmpeg／Whisper／model／manifest／手冊及 ZIP listing 成功；實際 DMG verify 與 ZIP test 成功。
  - 實際讀取 `latest-mac.yml` 得到：`offline-subtitle-factory-0.45.2-arm64-mac.zip` 與 `offline-subtitle-factory-0.45.2.dmg`；實際列出 `dist` 得到：`離線字幕工廠 0.45.2 macOS-arm64.zip` 與 `離線字幕工廠 0.45.2 macOS-arm64.dmg`。兩者不一致且 metadata 指向的檔案不存在。
  - 因此可以證明「封裝檔本身可驗證」，但不能證明「依 updater metadata 可下載／更新」；也沒有乾淨實機啟動與完整操作證據。

## 綜合判定

- 結論：不通過
- 阻擋問題：
  1. `latest-mac.yml` 的兩個檔名與實際 macOS DMG／ZIP 檔名不一致，且 metadata 指向檔案不存在；需修正 artifact naming 或 metadata 產生流程後重新封裝並重新核對 SHA／大小／URL。
  2. Windows 候選資產仍為 2026-07-20 CI 版本，未包含 2026-07-22 AI provider 修正；需由 Windows CI 重新建置並核對 archive、runtime、SHA 與 metadata。
- 剩餘風險：Windows Authenticode 未簽章；macOS 僅 ad-hoc 簽章且未 Developer ID／公證；兩平台未完成乾淨實機安裝／啟動／操作；未使用真實 Groq／Gemini key 執行外部 smoke test；`asar` disabled 的既有封裝風險；npm audit build-only／runtime 影響及 Actions Node 20 deprecation 尚未完成分類。
- 給主要開發代理的具體修正要求：修正 macOS `artifactName` 與 updater metadata 的一致性，重新產生 DMG／ZIP／blockmap／`latest-mac.yml`，確認 metadata 所有 URL 實際存在並以實際檔案計算 SHA／大小；重新執行 Windows 0.45.2 workflow 產生包含目前來源的候選；修正後由同一獨立審查角色建立 round2 複審報告。未完成上述修正前不得建立或更新 v0.45.2 GitHub Release。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。

