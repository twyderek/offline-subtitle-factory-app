# 獨立審查報告：0.47.0 發布閉環與 Windows 資產核對

- 審查對象 commit／版本：本機與 `origin/codex/release-v0.47.0` `efc6259140640e65f9273284811c365da473bc88`；GitHub `v0.47.0` tag／Release target `7946f7fa8e080f28a65639053f674fa8babcd5fe`
- 對應 08-CHANGE-LOG 條目：2026-07-28 — 0.47.0 發布閉環與 Windows 資產核對
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-28（Asia/Taipei）；獨立上下文，只讀檢查工作樹、治理文件、既有報告、本機 Git 與 GitHub REST API；除建立本報告外未修改專案檔案。

## 1. 需求完整性
- 判定：不通過
- 證據：本條目目標要求釐清來源／tag／Release、核對公開資產與 Windows artifact、checksum／digest／下載 URL，並在發現阻擋時停止。`08-CHANGE-LOG.md:47-81` 仍為「狀態：進行中」，實際修改、開發驗證、獨立審查與部署結果仍為「待執行」。常設授權 `AUTH-2026-07-23-01` 只涵蓋未簽章／未公證，不涵蓋 checksum／資產不一致或未實機測試。
- GitHub API（2026-07-28）確認 Release `v0.47.0` 存在且 `target_commitish=7946f7f...`；公開資產僅 macOS DMG、ZIP、macOS checksum 三項，未見 Windows Release asset。Windows 僅在 Release body 指向 Actions artifact `8640388049`。

## 2. 邏輯正確性
- 判定：不通過
- 證據：本機 `git log -1` 與分支 API 均為 `efc6259...`，而 tag ref API 為 `7946f7f...`，兩者不一致；因此目前工作樹的 `docs: publish Windows artifact location` 變更不在既有 Release tag。將 Actions artifact 連結寫入 Release notes 不等同於將 Windows 安裝包公開為 Release asset。
- GitHub API 的 Release asset digest 與本機先前記錄的 macOS digest 一致：DMG `d96d7a...a6ee`、ZIP `aebc1e...2dec6`；但這只證明 API metadata 與記錄一致，未證明下載後內容（本環境 `github.com` DNS 解析失敗）。

## 3. 邊界情況
- 判定：不通過
- 證據：核對了 tag ref、release metadata、branch head、Release asset 清單、asset digest、Windows artifact ID／digest 記錄。未能完成 Windows artifact 下載、解壓、Setup／Portable／`latest.yml`／SHA 內容核對；未能完成每個公開 Release URL 的下載後 SHA 反向核對（`curl https://github.com/...` 於 2026-07-28 回報 `Could not resolve host: github.com`）。未能證實 Release notes、`00-CURRENT-STATUS.md` 與最新 HEAD 已同步。

## 4. 程式碼品質
- 判定：部分通過
- 證據：本輪未修改產品程式碼；工作樹只有既存 `08-CHANGE-LOG.md` 修改與未追蹤的 2026-07-23 審查報告。發布收尾採文件與 API 證據核對，且條目明確禁止靜默移動 tag、刪除資產及宣稱實機驗收，方向符合治理規範。惟條目仍以「待執行」結案前狀態存在，不能作為完成紀錄。

## 5. 測試覆蓋
- 判定：不通過
- 證據：已執行 `npm run project:preflight -- --type=release`（2026-07-28，成功）及本機 Git／GitHub REST API 查核。未見本輪完成 `npm run docs:check:final`、`git diff --check` 或 Windows artifact 內容驗證的結果；既有 round1 報告（`2026-07-27-release-v0.47.0-round1.md`）明確列出 Release target 不一致、Windows 未直接附 Release、下載核對與獨立審查為阻擋。

## 6. 實際運行結果
- 判定：不通過
- 證據：GitHub REST API 可讀取 `https://api.github.com/repos/twyderek/offline-subtitle-factory-app/releases/tags/v0.47.0`、tag ref 與 branch API；結果顯示 Release target `7946f7f...`、branch `efc6259...`，且 assets 限 macOS 三項。公開下載 URL 的實際下載測試因 `github.com` DNS 失敗而未完成。沒有 Windows／macOS 安裝、啟動、Electron renderer 或真實轉錄實機證據。

## 綜合判定
- 結論：不通過
- 阻擋問題：
  1. `v0.47.0` tag／Release 指向 `7946f7f...`，目前分支／HEAD 為 `efc6259...`；來源可追溯性尚未收斂。
  2. GitHub Release 公開資產缺少 Windows Setup／Portable；Actions artifact 不可視為 Release asset，且尚未完成下載／解壓／SHA 核對。
  3. 公開 Release 資產下載後核對受 DNS 阻擋；`docs:check:final` 與本輪完整結案證據未提供。
  4. 既有 round1 所列 Metal exit 139、未簽章／未公證及跨平台／Electron 實機缺口仍未解除；發布授權不涵蓋這些未驗證項。
- 剩餘風險：Windows 未 Authenticode；macOS 未 Developer ID／公證；Whisper Metal exit 139；未完成跨平台安裝後與長音訊實機驗收。Release notes 雖有揭露，仍不得稱為完整發布驗收。
- 給主要開發代理的具體修正要求：先決定保留既有 `v0.47.0` 歷史 Release 並另發修正版，或在明確授權下重建可追溯版本（不得靜默移動 tag）；重新產出／下載 Windows 資產並核對 Setup、Portable、metadata、SHA；補齊公開 Release 資產下載後 digest；完成 `docs:check:final`、`git diff --check`；必要時建立下一輪獨立複審報告，並在 08-CHANGE-LOG 逐字引用本報告結論。

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
