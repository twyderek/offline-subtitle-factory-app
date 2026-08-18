# 獨立審查報告：Breeze runtime 引導修正版隔離測試候選（REL-033）

- 審查對象 commit／版本：`codex/021-breeze-runtime-guide` commit `d31873f62171c26f71175fc77e253866a3eb805d`，產品版本 0.49.0；repo 外 `../dist/test-build-d31873f/` macOS arm64 候選與 GitHub Actions run `31675687917`／artifact `9171511697` Windows x64 候選
- 對應 08-CHANGE-LOG 條目：2026-08-13 — Breeze runtime 引導修正版隔離測試軟體（REL-033）（`docs/project-management/08-CHANGE-LOG.md:5`）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-13T15:00+08:00；獨立審查上下文，只依 release preflight、REL-033 工作紀錄、原始產物、GitHub run／artifact metadata 與 raw log 判定
- 證據核對時間：本機重驗 2026-08-13T15:00–15:15+08:00；macOS renderer JSON 產生於 2026-08-13T15:09:23+08:00；GitHub run 原始時間 2026-08-13T06:55:31Z–06:58:56Z

## 1. 需求完整性

- 判定：通過（限隔離測試候選交付）
- 證據：
  - REL-033 固定來源為 `d31873f`，目標為 macOS arm64 DMG／ZIP 與 Windows x64 Setup／Portable，並明確排除 Breeze checkpoint、Python／PyTorch／patched runtime、tag、公開 Release 與正式資產替換。
  - `git rev-parse HEAD` 與 provenance 均為完整 SHA `d31873f62171c26f71175fc77e253866a3eb805d`；`package.json`、App `Info.plist` 與 updater metadata 均維持 0.49.0。
  - macOS 候選位於獨立 `../dist/test-build-d31873f/`；Windows 候選只由 run `31675687917` 以 Actions artifact 交付。沒有把候選加入 Git、建立 tag 或授權公開 Release。
  - 候選 README／provenance 已將一般 packaged renderer smoke 與 Breeze guide／UI marker 的靜態封裝核對分開；沒有再把一般設定 modal 的 `modalOpenAfterEvent` 說成 Breeze runtime modal 互動驗收。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - macOS DMG 為 242,714,472 bytes、SHA-256 `3d896d1614e39b5cf51ca10ff1f6f88b5b5c4caa008d9638242b8e6c89bad424`；ZIP 為 249,946,568 bytes、SHA-256 `aeb9202dc5d602c0ccf59591bce3092e1f476327968f59135c86ac080d1cff20`。本輪獨立 `shasum -a 256` 與清單一致。
  - `hdiutil verify` 回報 DMG checksum `VALID`；`unzip -t` 回報 ZIP 無錯；`codesign --verify --deep --strict` 通過，且 `codesign -dvvv` 明示 arm64、`Signature=adhoc`、`TeamIdentifier=not set`，沒有誤稱 Developer ID／公證。
  - App `CFBundleShortVersionString`／`CFBundleVersion` 均為 0.49.0，最低 macOS 為 12.0。`latest-mac.yml` 的兩檔 size 及 SHA-512 均與實檔獨立重算一致。
  - 封裝內容實際包含 `docs/BREEZE-ASR-25.md`、recursive-submodule 指令、開發版／macOS 安裝版／Windows 安裝版啟動命令，以及 `breezeRuntimeModal`、`copyBreezeRuntimePackagedLaunch`、persistent `openBreezeRuntimeGuideButton` marker。
  - App 只含既有 Breeze probe／guide 程式，未找到 safetensors、Breeze checkpoint、外部 Python／PyTorch／patched runtime 或大於 1 GiB 的模型檔；不能把程式檔 `lib/breeze-runtime-probe.mjs` 誤判為已內建推論 runtime。

## 3. 邊界情況

- 判定：通過（已驗證封裝邊界；實機缺口保留）
- 證據：
  - macOS signing status 明列 `AD-HOC / UNSIGNED TEST CANDIDATE`、來源 `d31873f`、非公開 Release、未內建 Breeze runtime／checkpoint。
  - Windows run 的簽章條件符合預期：signed build step skipped，unsigned x64 build success；後續仍執行 Setup／Portable renderer、安裝／解除安裝、archive、checksum、內容排除與 artifact upload，沒有因未簽章跳過封裝驗證。
  - Windows raw log 顯示 Setup 隔離安裝後 renderer smoke、Portable renderer smoke、silent uninstall 均完成，兩個 NSIS archive `Everything is Ok`；這只代表 GitHub-hosted runner lifecycle，不代表 Windows 10／11 乾淨使用者、SmartScreen 或完整 process-tree。
  - macOS checksum 清單使用從 repo root 可解析的 `../dist/...` 路徑；若使用者先 `cd` 至候選目錄再直接執行 `shasum -c`，路徑不適用。實檔 digest 已獨立核對，因此此為重放便利性風險，不是內容完整性阻擋。

## 4. 程式碼品質

- 判定：通過（來源與交付可追溯）
- 證據：
  - 候選 provenance 記錄來源 branch／完整 commit、macOS／Windows target、Windows run／artifact、artifact digest、兩平台未簽章狀態、Breeze 外部依賴與「非公開 Release」界線。
  - Breeze guide、API/UI markers 與 BUG-021 round3 已通過的來源一致；封裝不額外注入 checkpoint、秘密、憑證或可自動執行的第三方安裝流程。
  - Windows workflow 使用同一 `d31873f` 來源完成 `npm ci`、runtime prepare、source／FFmpeg regression、unsigned package、renderer／install lifecycle、archive／SHA 與 upload，各 step conclusion 皆為 success；signed step 因無憑證如預期 skipped。
  - 本輪沒有修改產品程式、workflow、版本、changelog 或 repo 外測試包；只建立本審查報告。

## 5. 測試覆蓋

- 判定：通過（對隔離測試候選範圍足夠）
- 證據：
  - GitHub API 核對 run `31675687917` 為 `workflow_dispatch`、branch `codex/021-breeze-runtime-guide`、head SHA `d31873f62171c26f71175fc77e253866a3eb805d`、結論 success；job 所有實際執行 steps 成功。
  - artifact `9171511697` 名稱為 `offline-subtitle-factory-0.49.0-windows-x64`、大小 490,420,415 bytes、digest `sha256:25217ae11e83dc9f6f108983c496ee9ed8d273bc209d054051447a5e6dfdbf38`；run log 另證明 Setup／Portable archive、SHA 清單、unsigned signing status 及 checkpoint 排除已產生並在 upload 前核對。本輪依審查範圍未重下載 490 MB artifact。
  - 本輪獨立重跑 macOS SHA-256、updater SHA-512／size、`hdiutil verify`、`unzip -t`、deep strict codesign、版本／最低系統、Breeze guide／UI marker、checkpoint／大檔排除與 `git diff --check`，均通過。
  - 同一 macOS App 以 port 9351 重跑 packaged renderer 成功，完整結果保存於 repo 外 `../dist/test-build-d31873f/mac-renderer-smoke.json`：Electron bridge、一般 settings modal、health/settings、manual SRT job `201 → 202 → completed`、cleaned SRT、trim/review assets、glossary、七個 provider 與 folder event 均符合斷言。本審查先前以未提升權限的新 port 執行曾逾時等待 renderer target；保存的成功 JSON 已提供可重驗的最終證據，但一般 settings modal 事件不等於 Breeze runtime modal 互動。

## 6. 實際運行結果

- 判定：通過（一般 packaged renderer／CI lifecycle 層級）
- 證據：
  - macOS 既有 packaged renderer smoke 證明 Electron preload bridge、一般設定 modal、health/settings、manual SRT job、trim/review assets、provider／folder flow 可在同一封裝 App 啟動；Breeze guide/UI 則由封裝內容 marker 獨立核對。
  - Windows run 證明 Setup 隔離安裝、renderer manual SRT job、Portable renderer、解除安裝與 archive lifecycle 成功；artifact upload digest 與 API metadata一致。
  - 兩平台 renderer 都使用 manual SRT／deterministic 路徑，沒有載入約 3 GB Breeze checkpoint、沒有執行真實 patched runtime，也沒有評估轉錄品質、效能、長音訊、取消或子程序清理。

## 發布授權適用性核對

- 判定：通過（只適用隔離測試候選交付）
- 證據：需求方要求繼續產生測試軟體，足以涵蓋本機／CI 打包及隔離候選交付；既有 `AUTH-2026-07-23-01` 可接受 macOS 未 Developer ID／未公證與 Windows 未 Authenticode 的已知測試候選風險，但不消除 checksum、測試、審查或實機驗收要求。
- 授權界線：本輪沒有且不授權建立新 tag、建立公開 GitHub Release、上傳或替換 v0.49.0 正式資產、公開 artifact 下載入口，亦不授權宣稱真實 Breeze 品質或跨平台乾淨實機已完成。

## 綜合判定

- 結論：通過（限隔離測試候選交付；不授權公開 Release）
- 阻擋問題（若有）：無。
- 剩餘風險：真實 Breeze patched runtime／Python／PyTorch／約 3 GB checkpoint、模型品質、CPU／CUDA 效能、長音訊、取消與失敗復原均未驗收；macOS 未 Developer ID／未公證且未做 DMG 拖曳後乾淨帳號 Gatekeeper；Windows 未 Authenticode且未做 Windows 10／11 乾淨使用者 SmartScreen、互動式安裝、捷徑、Portable 與完整 process-tree；本輪未重下載 Windows artifact，且保存的 macOS renderer JSON只涵蓋一般設定與 manual SRT 等 deterministic flow，故不得把既有 CI／packaged renderer 證據擴張成乾淨實機、Breeze modal 互動或真實 Breeze 運行證據。
- 給主要開發代理的具體修正要求：無阻擋修正。主要代理可在 REL-033 工作紀錄逐字引用下列完整結論句，補齊實際驗證與本報告連結後執行 `npm run docs:check:final`、`git diff --check`；交付範圍必須保持隔離測試候選，不得建立或修改公開 Release。
- 可逐字引用完整結論句：**「REL-033 round1 獨立審查通過：來源 `codex/021-breeze-runtime-guide@d31873f` 的 macOS arm64 DMG／ZIP與 GitHub Actions run `31675687917` 產生的 Windows x64 Setup／Portable，已完成來源、版本、封裝內容、Breeze guide／UI marker、checkpoint／runtime 排除、簽章狀態、SHA／updater metadata、archive 與一般 packaged-renderer／安裝生命週期核對，可作為隔離測試候選交付；本結論不授權建立、上傳或替換公開 Release，亦不代表真實 Breeze runtime、模型品質、效能、Windows process tree或 macOS／Windows 乾淨使用者實機已驗收。」**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本審查代理未修改 repo 外測試包；macOS renderer 重跑只建立並由腳本清理系統暫存 userData。
- 若上述聲明不實，本報告無效。
