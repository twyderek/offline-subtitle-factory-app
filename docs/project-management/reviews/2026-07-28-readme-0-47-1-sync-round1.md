# 獨立審查報告：README 0.47.1 與 main 同步準備

- 審查對象 commit／版本：工作樹 `README.md` 與 `docs/project-management/08-CHANGE-LOG.md` 未提交差異；基底 commit `5f792266faa34b63d236fd419ea39a29074fc76b`；版本 `0.47.1`
- 對應 08-CHANGE-LOG 條目：2026-07-28 — README 0.47.1 與 main 同步準備
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-28T10:14:46+08:00；由主要代理啟動的獨立上下文，未沿用開發代理對話記憶；本輪只讀核對並僅建立本報告。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `README.md:3-15` 已將首頁首段更新為 0.47.1，提供正式 Release URL、macOS／Windows 平台資產類型、0.47 品質校閱功能與未簽章／未公證／Metal／Electron／跨平台實機缺口。
  - `README.md:81`、`README.md:88` 的 macOS DMG、Windows Setup／Portable 檔名與 `RELEASE-NOTES-0.47.1.md:23-25` 一致；`package.json` 的實際版本由 `node -p "require('./package.json').version"` 核對為 `0.47.1`。
  - `docs/project-management/08-CHANGE-LOG.md:813` 將成功條件定為 README 正確顯示 0.47.1 公開版本、下載資產、功能、風險、目前開發分支，並建立同步至 `main` 的 Draft PR；目前 `git status --short` 顯示 README 與工作紀錄仍未提交，且尚無可核對的 Draft PR 證據，因此成功條件尚未完成。
  - `README.md:153` 僅指示開發者切換 `main`，未說明目前工作來源為 `codex/release-v0.47.1`；若「目前開發分支」仍是本條目的必要成功條件，README 尚未滿足，否則主要代理應修正工作紀錄的成功條件，避免要求與交付不一致。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - `README.md:5` 與 `README.md:7` 明確宣稱 0.47.1 已正式發布並連到正式 Release；但 `README.md:90` 同時稱 Windows 為「預覽成品」並寫「不建議在完成實機驗收前對外正式發布」。同一文件對已發生的公開發布給出相反狀態，會使使用者無法判斷該資產是正式公開版本或僅內部預覽。
  - `README.md:15` 已採較準確的條件式風險揭露：說明未簽章／未公證與未覆蓋驗收，要求先核對 SHA 並在非關鍵環境測試；可據此修正 `README.md:90`，保留風險而不否定已完成的正式發布事實。
  - `README.md:94-101` 說明 0.47.1 安裝包內建 `resources/docs/0.45.2/USER-GUIDE.html`，且已明標為「目前內建手冊版本」，與現有路徑一致，未誤稱為 0.47.1 手冊。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - README 同時涵蓋 macOS DMG／ZIP 與 Windows Setup／Portable，並揭露 Windows Unknown Publisher／SmartScreen、macOS Gatekeeper、Metal、Electron 與跨平台實機缺口。
  - `RELEASE-NOTES-0.47.1.md:11-14` 的 rule-score、Metal exit 139、Electron／長音訊實機、未簽章／未公證限制已在 `README.md:14-15` 摘要呈現，未把缺口寫成完成。
  - GitHub API 即時核對命令 `gh api repos/twyderek/offline-subtitle-factory-app/releases/tags/v0.47.1 ...` 於本輪回覆 `error connecting to api.github.com`，故無法重新驗證 Release 是否仍為非 draft、7 項資產是否仍存在或直接下載 URL 是否可用；外部狀態只能引用 `docs/project-management/reviews/2026-07-28-0-47-1-release-round3.md:11,45-51` 的既有可追溯證據，並維持「待網路可達時重放」風險。
  - 未測 README 連結的實際 HTTP 回應，原因同上；不能用字串存在替代可下載驗證。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - 本輪為純文件變更；`git diff -- README.md` 顯示修改集中於版本入口、安裝檔名、隱私說明與開發分支指令，未修改產品程式碼。
  - `git diff --check` 於 2026-07-28T10:14:46+08:00 通過，未發現空白或 patch 格式錯誤。
  - `docs/project-management/08-CHANGE-LOG.md:805-832` 的最新工作條目被附加在檔案最末端，而該檔 `docs/project-management/08-CHANGE-LOG.md:3` 明定「最新項目置頂」。此排序偏離治理規範，且會讓前置閱讀者先看到舊條目；主要代理應將本條目移至歷史條目之前的最新位置，或明確修正文檔排序規則與檢查器。
  - `README.md:17` 直接從 0.47.1 跳回 0.45.2，並不構成版本錯誤，但容易讓讀者忽略 0.46.0／0.47.0 的演進；本輪不列為阻擋，建議以 changelog／Release 連結取代持續堆疊首頁舊版重點。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-28T10:14:46+08:00 實際執行 `npm run docs:check`，結果為「專案治理文件檢查通過：19 個文件，版本 0.47.1」。
  - 同時執行 `git diff --check`，exit 0。
  - `docs:check` 僅驗證治理文件結構與版本，沒有攔截 `README.md:5-7` 與 `README.md:90` 的發布狀態矛盾，也沒有攔截工作紀錄最新條目置底；因此綠燈不足以證明本次同步內容正確。
  - 未執行 `npm run docs:check:final`：工作紀錄 `docs/project-management/08-CHANGE-LOG.md:807-832` 明確仍為「進行中」並含多個「待執行」，final gate 此時預期不應通過；主要代理完成修正、引用本報告及建立 Draft PR 後仍須實際執行。

## 6. 實際運行結果

- 判定：不通過
- 證據：
  - 本地 `git branch --show-current` 為 `codex/release-v0.47.1`；HEAD 與 `origin/codex/release-v0.47.1` 都是 `5f792266faa34b63d236fd419ea39a29074fc76b`，但目前 README／工作紀錄差異尚未提交。
  - `git rev-list --left-right --count origin/main...HEAD` 為 `0 22`，且 `git merge-base --is-ancestor origin/main HEAD` exit 0：現有 release 分支完整包含遠端追蹤 `main` 並領先 22 commits。`git diff --stat main...HEAD` 顯示 123 個檔案、6828 additions／113 deletions，故同步 PR 不是 README 單檔 PR，而是完整 0.45.2–0.47.1 開發／治理差異，合併前必須如實揭露範圍。
  - `git rev-parse origin/main` 為 `f781acbc14b61f7427c034bbe42f9e75804d6835`；這只是本地遠端追蹤引用。因 GitHub API 本輪不可達，無法證明 GitHub 即時 default branch HEAD 未再前進。
  - 尚未提供 Draft PR URL、PR base/head、GitHub compare 或 checks 證據，因此「同步到 GitHub `main`」尚未實際發生；目前只能判定為本地同步準備。

## 綜合判定

- 結論：不通過
- 精確阻擋欄位：
  1. `README.md:90`：與 `README.md:5-7` 的「0.47.1 已正式發布」相衝突，須改為「已公開但仍未簽章／未完成實機驗收」的風險說明，不得再稱不建議對外正式發布。
  2. `docs/project-management/08-CHANGE-LOG.md:813`：成功條件包含「目前開發分支」，但 `README.md` 未呈現該資訊；須補足或收斂成功條件。
  3. `docs/project-management/08-CHANGE-LOG.md:818-832`：實際修改、開發驗證、獨立審查、部署／發布結果與遺留風險仍為待執行，尚不能結案或通過 `docs:check:final`。
  4. `docs/project-management/08-CHANGE-LOG.md:805-832`：最新工作條目置底，違反該檔第 3 行「最新項目置頂」規則。
  5. GitHub 同步證據：README 變更未提交，未提供 Draft PR URL／base／head／diff／checks；`main` 仍未包含本輪更新。GitHub API／直接下載重放亦因網路不可達而缺證。
- 剩餘風險：
  - Windows 未 Authenticode、macOS 未 Developer ID 簽章／公證；Metal exit 139、Electron、跨平台安裝後與長音訊實機仍未驗收。
  - release 分支相對本地遠端追蹤 `main` 領先 22 commits、涉及 123 檔；PR 合併範圍遠大於 README，需由主要代理與使用者確認完整差異，而非描述為單純 README 更新。
  - GitHub 即時 default branch、Release assets 與下載連結本輪未能重放，網路恢復後應重新核對。
- 給主要開發代理的具體修正要求：
  1. 修正 `README.md:90` 的正式發布矛盾，並決定是否在 README 顯示 release 分支或收斂工作紀錄中的成功條件。
  2. 將最新工作條目移至規範位置，補齊實際修改與驗證；修正後執行 `npm run docs:check`、`git diff --check`，並建立 round2 複審。
  3. 通過複審後提交／推送，建立 base=`main`、head=`codex/release-v0.47.1` 的 Draft PR；核對 PR 實際包含 22 commits／123 檔的完整差異並記錄 URL。
  4. 網路可達時重放 GitHub repository/default branch、v0.47.1 Release 7 assets 與直接下載 URL；最後補齊工作紀錄並執行 `npm run docs:check:final`。

- 可供 validator 與工作紀錄逐字引用的完整結論句：**本輪 README 0.47.1 與 main 同步準備獨立審查結論為不通過：README 已更新 0.47.1 版本、資產、功能與主要風險，但 Windows 段落仍以「不建議對外正式發布」否定已正式公開的 v0.47.1，工作紀錄的目前開發分支要求與最新條目排序尚未落實，README 變更仍未提交且缺少 Draft PR／main 同步證據，GitHub API／直接下載也因網路不可達未能重放，因此目前不得宣稱進度已同步至 GitHub main。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
