# 獨立審查報告：0.47.0 發布閉環與 Windows 資產核對

- 審查對象 commit／版本：本機與 `origin/codex/release-v0.47.0` `efc6259140640e65f9273284811c365da473bc88`；GitHub `v0.47.0` tag／Release target `7946f7fa8e080f28a65639053f674fa8babcd5fe`
- 對應 08-CHANGE-LOG 條目：2026-07-28 — 0.47.0 發布閉環與 Windows 資產核對
- 審查輪次：round2（報告格式複審；不覆寫 round1）
- 審查代理啟動時間、上下文來源：2026-07-28（Asia/Taipei）；獨立上下文，只讀檢查本輪 round1 報告格式與既有證據；除建立本報告外未修改專案檔案。

## 1. 需求完整性
- 判定：不通過
- 證據：本條目仍記錄「狀態：進行中」，實際修改、開發驗證、獨立審查與部署結果仍為「待執行」。發布授權 `AUTH-2026-07-23-01` 僅涵蓋未簽章／未公證，不涵蓋 checksum／資產不一致或未實機測試。

## 2. 邏輯正確性
- 判定：不通過
- 證據：本機／遠端分支 HEAD `efc6259...`，GitHub `v0.47.0` tag／Release target `7946f7f...`；Release body 指向 Windows Actions artifact，不等於 Windows 公開 Release asset。

## 3. 邊界情況
- 判定：不通過
- 證據：已核對 tag、Release metadata、branch head、Release assets、asset digest 及 Windows artifact 記錄；未完成 Windows artifact 下載／解壓／Setup／Portable／metadata／SHA 核對。公開下載 URL 測試因 `github.com` DNS 解析失敗而未完成。

## 4. 程式碼品質
- 判定：部分通過
- 證據：本輪未修改產品程式碼；工作樹的發布收尾以文件與 API 證據核對，且明確禁止靜默移動 tag、刪除資產及宣稱實機驗收。惟工作條目尚未結案。

## 5. 測試覆蓋
- 判定：不通過
- 證據：已執行 `npm run project:preflight -- --type=release`（2026-07-28，成功）及 Git／GitHub REST API 查核；未提供本輪 `docs:check:final`、完整公開資產下載後核對或 Windows artifact 內容驗證結果。既有 round1 報告列出的 Release target、Windows asset 與下載核對阻擋仍存在。

## 6. 實際運行結果
- 判定：不通過
- 證據：GitHub REST API 可讀取 Release、tag ref 與 branch API，顯示 Release target `7946f7f...`、branch `efc6259...`，assets 僅 macOS DMG、ZIP、checksum 三項；公開下載因 `github.com` DNS 失敗未完成。沒有 Windows／macOS 安裝、啟動、Electron renderer 或真實轉錄實機證據。

## 綜合判定
- 結論：不通過
- 阻擋問題（若有）：
  1. `v0.47.0` tag／Release 指向 `7946f7f...`，目前分支／HEAD 為 `efc6259...`，來源可追溯性未收斂。
  2. GitHub Release 缺少 Windows Setup／Portable 公開資產；Actions artifact 尚未完成內容與 SHA 核對。
  3. 公開 Release 資產下載後 digest 核對受 DNS 阻擋，且本輪未提供 `docs:check:final` 結案證據。
  4. Metal exit 139、未簽章／未公證及跨平台／Electron 實機缺口仍未解除；既有常設授權不涵蓋未驗證項。
- 剩餘風險：Windows 未 Authenticode；macOS 未 Developer ID／公證；Whisper Metal exit 139；未完成跨平台安裝後與長音訊實機驗收；Release notes 雖揭露限制，仍不得稱為完整發布驗收。
- 給主要開發代理的具體修正要求：決定保留既有 `v0.47.0` 歷史 Release 並另發修正版，或取得明確授權後重建可追溯版本（不得靜默移動 tag）；重新產出／下載 Windows 資產並核對 Setup、Portable、metadata、SHA；完成公開 Release 資產下載後 digest、`docs:check:final` 與 `git diff --check`；必要時建立下一輪複審。

## 可逐字引用的完整結論句

**本輪 round2 獨立發布複審結論為不通過：GitHub `v0.47.0` tag／Release 仍指向 `7946f7f...` 而目前分支／HEAD 為 `efc6259...`，公開 Release 僅含 macOS 三項資產且未含 Windows Setup／Portable，Windows Actions artifact 與公開下載內容尚未完成解壓／SHA 反向核對，公開下載測試又受 `github.com` DNS 解析失敗阻擋，`docs:check:final` 結案證據與跨平台／Electron 實機、Whisper Metal exit 139 缺口仍未解除，因此在來源一致性、Windows 資產核對、下載驗證及未驗證風險完成前不得宣稱 0.47.0 發布通過。**

## 審查代理聲明
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
