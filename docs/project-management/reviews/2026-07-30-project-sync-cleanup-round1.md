# 獨立審查報告：專案狀態同步與舊版封裝清理

- 審查對象 commit／版本：`dc143d24064b50ca4ddf645037d339a73d60baf4`／`0.48.0`，以及 2026-07-30 11:36 +08:00 時的未提交差異
- 對應 08-CHANGE-LOG 條目：2026-07-30 — 專案狀態同步與舊版封裝清理
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-30T11:20:00+08:00；由主要代理另行啟動的獨立上下文，只取得工作目錄、需求、指定工作條目、已知 GitHub 網路限制與清理容量摘要，未沿用開發代理對話記憶

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:48-50` 將本輪需求連結至 `NFR-006`（變更可追溯、文件檢查與獨立審查）及 `NFR-008`（安裝包、簽章、SHA、版本說明與下載資產一致）。
  - `docs/project-management/00-CURRENT-STATUS.md:3-6,47-62`、`docs/project-management/04-DEVELOPMENT-HISTORY.md:21-23`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:127-135` 與 `RELEASE-NOTES-0.48.0.md:22-33` 已同步正式候選、來源 SHA、資產、限制及清理摘要；`README.md:89-117` 已改為 0.48.0 安裝檔名與內建內容。
  - 2026-07-30 11:28–11:36 +08:00 執行 `find ../dist -maxdepth 1 -mindepth 1 -print | sort`、`du -sh ../dist` 與 allowlist 負向 `find`，確認清理後為 `1.9G`，根目錄只保留 0.48.0 DMG／ZIP／Setup／Portable、blockmap、兩份 updater metadata、兩份 SHA、Windows 未簽章說明、builder metadata、`mac-arm64/`、`win-unpacked/` 與 `.DS_Store`；未發現 0.21–0.47.1 命名的根目錄歷史封裝。
  - `git rev-parse HEAD` 與 `git rev-parse origin/codex/0.48-local-llm` 均回傳 `dc143d24064b50ca4ddf645037d339a73d60baf4`；這只證明本機 remote-tracking ref 與 HEAD 一致，不等同 GitHub Release 已公開。
  - 未完整達成處：`README.md:101` 已直接寫成可從 `v0.48.0` Release 下載，卻與 `docs/project-management/00-CURRENT-STATUS.md:5,56` 及 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:132` 的「公開資產／下載 URL 尚待反向核對」衝突。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - `docs/project-management/00-CURRENT-STATUS.md:5,56` 明確把現行公開版本維持為 0.47.1，並說 0.48.0 公開名稱、大小、digest 與下載 URL 尚待反向核對；`README.md:101` 卻使用現在式「可從 GitHub 的 v0.48.0 Release 下載」。在外部狀態未驗證前，兩個使用者入口無法同時為真，違反 `NFR-008`。
  - `docs/project-management/08-CHANGE-LOG.md:47-68` 把本輪條目寫成 2026-07-28 二級條目之下的三級標題。`scripts/check-project-docs.mjs:52-54`（`--final` 區段的 `^##` 規則）只辨識二級日期標題，因此 2026-07-30 11:27 +08:00 執行 `npm run docs:check:final` 雖顯示「最新紀錄已結案」，實際未把 `docs/project-management/08-CHANGE-LOG.md:49-68` 這筆仍為「進行中／審查進行中／遺留風險進行中」的工作當作最新條目驗證。此結果不能作為本輪結案證據，違反 `NFR-006` 的可追溯結案門檻。
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:133` 與 `docs/project-management/08-CHANGE-LOG.md:63` 宣稱有「精確刪除清單」合計約 8.44 GiB，但目前差異與專案 evidence 中只保存分類摘要及合計，沒有可逐檔回溯的清理前清單。清理後狀態可驗證，清理前逐檔選定範圍無法由本輪獨立重現。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 2026-07-30 11:31 +08:00 執行根目錄 allowlist 負向 `find`，沒有輸出；另以版本型樣搜尋 0.21–0.47.1 根目錄項目，也沒有輸出，證明目前沒有把舊版根目錄封裝遺留在 `dist/`。
  - `find .. -maxdepth 1 -mindepth 1 -print | sort` 顯示來源 repo、`../archive`、`../assets`、`../offline-subtitle-factory-guide` 與 `../dist` 仍存在；`git tag --list` 仍可讀到既有本機 tags；目前工作樹六個既有修改檔與一個無關未追蹤審查報告亦未被測試覆蓋。
  - `electron/main.mjs:597-605` 顯示使用者任務資料由 `app.getPath('userData')/jobs` 傳入 `OFFLINE_SUBTITLE_DATA_DIR`，與本輪 `../dist` 清理路徑分離；本輪沒有讀取或改寫實際使用者任務內容。
  - 0.48.0 的主要資產、blockmap、updater metadata、SHA、簽章狀態與 unpacked 驗證目錄均在 allowlist 內並實際存在。
  - 未覆蓋：不可逆清理完成後無法從現況證明每一個已刪項目確實都曾公開發布；GitHub 公開 Release、tag、digest 與直接下載 URL仍未取得反向證據。清理前逐檔清單未持久保存，降低誤刪邊界的事後稽核能力。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - 本輪未修改產品程式碼；`git diff --stat` 顯示六個文件共新增 51 行、刪除 8 行，變更範圍大致符合專案狀態／Release 說明同步。
  - 2026-07-30 11:31 +08:00 執行 `git diff --check` 無輸出，未發現空白或 patch 格式錯誤。
  - 文件對未簽章／未公證、Windows／macOS 實機缺口及 GitHub 反向核對缺口多數採保守用語，`docs/project-management/00-CURRENT-STATUS.md:54-56` 沒有把建置成功誤寫成完整實機驗收。
  - 不通過項仍影響文件品質：`README.md:101` 的公開下載斷言沒有跟狀態文件採同一事實來源；本輪變更沿用三級工作標題，卻未同步確保 `scripts/check-project-docs.mjs` 能辨識該結構，導致結案檢查假陽性。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-30 11:30 +08:00 執行 `npm run check`，`docs:check`、JavaScript 語法檢查、preflight、授權、治理文件 validator、媒體編輯、雙語字幕、字幕品質、Whisper metadata、AI optimizer/provider、校閱 UI 與核心 API 回歸全部 exit 0。
  - 2026-07-30 11:27 +08:00 執行 `npm run docs:check:final` exit 0；但依第 2 節證據，它驗證的是二級 2026-07-28 umbrella，而非本輪三級工作條目，因此不得視為本輪結案門檻已通過。
  - 2026-07-30 11:28–11:31 +08:00 執行四個資產的 `shasum -a 256 -c` 全部 `OK`；重算 Setup／macOS ZIP／DMG 的 SHA-512 base64 與 `latest.yml`／`latest-mac.yml` 完全一致，metadata size 也與 `stat` 相符。
  - 覆蓋缺口：沒有針對「最新日期工作使用三級標題」的 validator 回歸案例；沒有清理前／後 manifest 自動比對或永久 evidence，因此 8.44 GiB 只能接受既有操作摘要，不能在本輪重算。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 2026-07-30 11:29 +08:00 執行 `unzip -t ../dist/offline-subtitle-factory-0.48.0-macos-arm64.zip`，結尾為 `No errors detected`。
  - 同時執行 `hdiutil verify ../dist/offline-subtitle-factory-0.48.0-macos-arm64.dmg`，結尾為 checksum `VALID`。
  - `file` 將 Setup 與 Portable 均辨識為 Windows PE32 NSIS executable；DMG 與 ZIP 格式可辨識。`plutil` 讀得 macOS App 的 `CFBundleShortVersionString`／`CFBundleVersion` 均為 0.48.0，兩個 unpacked app 內 `package.json` 版本也均為 0.48.0。
  - `latest.yml` 的 Setup size／SHA-512 與實檔相符；`latest-mac.yml` 的 ZIP、DMG size／SHA-512 與實檔相符；Windows 簽章狀態檔明確寫出未 Authenticode 簽章。
  - GitHub `v0.48.0` 公開頁面、公開資產名稱／大小／digest、直接下載 URL 與 latest Release 指向均未完成實際運行核對；Windows 安裝／啟動及乾淨 macOS 安裝後驗收也不在本輪新增證據內。

## 綜合判定

- 結論：不通過；本機清理後邊界、0.48.0 正式候選檔案、checksum、updater metadata 與封裝完整性均已通過獨立驗證，但 README 的未驗證公開下載斷言及 `docs:check:final` 未實際覆蓋本輪工作條目，分別違反 `NFR-008` 與 `NFR-006`，在修正並複審前不能結案。
- 可逐字引用的完整結論句：**本輪獨立審查判定為不通過；本機清理後邊界、0.48.0 正式候選檔案、checksum、updater metadata 與封裝完整性均已通過獨立驗證，但 README 的未驗證公開下載斷言及 `docs:check:final` 未實際覆蓋本輪工作條目，分別違反 `NFR-008` 與 `NFR-006`，在修正並複審前不能結案。**
- 阻擋問題（若有）：
  1. 將 `README.md:101` 改成與已查證狀態一致的候選／上傳中用語，或在 GitHub 公開反向核對完成後，以實際資產證據再保留「可下載」敘述；不得在尚未核對時預告為已可下載。
  2. 讓本輪 2026-07-30 工作成為結案檢查真正辨識的最新條目（例如改為置頂二級日期條目），或同步修正 validator 與測試以支援三級工作條目；修正後須證明「進行中」會使 final check 失敗，而完成並連結本報告後才會通過。
  3. 保存清理前精確選定清單的可回溯證據（逐路徑、size、總和與選定理由），或若原始清單已不可取得，將文件改為誠實的「操作摘要／合計」並把無法獨立重算列為遺留風險，不得繼續宣稱現有文件已提供精確清單。
- 剩餘風險：
  - GitHub `v0.48.0` 的公開 Release metadata、資產 digest、直接下載 URL 與最新版本指向尚待網路可達後反向核對；remote-tracking ref 相同不能取代此驗證。
  - 歷史封裝為永久刪除，未送入垃圾桶；只能從可取得的 GitHub Release 重新下載或由既有來源重新建置。部分歷史版本是否都有可立即下載的公開資產，本輪未逐版重驗。
  - Windows 未 Authenticode 簽章、macOS 未 Developer ID 簽章／公證，且 Windows 乾淨實機及完整跨平台安裝後操作仍屬既有未覆蓋風險。
- 給主要開發代理的具體修正要求（若有）：依三項阻擋問題修正文件與結案檢查／可追溯證據；重跑 `npm run check`、`npm run docs:check:final`、`git diff --check`，並建立 `2026-07-30-project-sync-cleanup-round2.md` 複審，不得覆寫本報告。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
