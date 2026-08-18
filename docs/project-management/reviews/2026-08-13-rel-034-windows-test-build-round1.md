# 獨立審查報告：Windows x64 測試版重新打包（REL-034）

- 審查對象 commit／版本：`codex/021-breeze-runtime-guide` commit `2b44d1072cf137251c3acb0be9824eeb4587f8e2`，產品版本 0.49.0；GitHub Actions run `31679412779` 與 artifact `9172938395`
- 對應 08-CHANGE-LOG 條目：2026-08-13 — Windows x64 測試版重新打包（REL-034）（`docs/project-management/08-CHANGE-LOG.md:5`）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-13T15:54+08:00；獨立審查上下文，只依 release preflight、REL-034 工作紀錄、指定來源、workflow、GitHub run／artifact API metadata 與 raw log 判定
- 證據核對時間：本機與 GitHub API 重驗 2026-08-13T15:54–16:00+08:00；run 原始時間 2026-08-13T07:49:59Z–07:53:37Z

## 1. 需求完整性

- 判定：通過（限 Windows x64 隔離測試候選）
- 證據：
  - REL-034 明定從 commit `2b44d10` 重新產生 Windows x64 unsigned Setup／Portable；不下載或內建 Breeze checkpoint／Python／PyTorch／patched runtime，不建立 tag／公開 Release，不替換既有 v0.49.0 資產。
  - `git rev-parse HEAD`、run API `headSha`、checkout raw log 與 artifact API `workflow_run.head_sha` 均為完整 SHA `2b44d1072cf137251c3acb0be9824eeb4587f8e2`；run branch 為 `codex/021-breeze-runtime-guide`、事件為 `workflow_dispatch`。
  - artifact 名稱 `offline-subtitle-factory-0.49.0-windows-x64` 符合 0.49.0 Windows x64 測試候選命名；CI upload 前要求 Setup、Portable、blockmap、`latest.yml`、SHA 清單與 signing status 共 6 檔。
  - 本輪只審查 Actions 隔離候選，不上傳公開 Release、不修改 tag 或正式資產，與需求方授權界線一致。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - run `31679412779` conclusion `success`；job `Windows x64 test and package` 的 checkout、Node、`npm ci`、runtime prepare、source regression、unsigned build、renderer/install lifecycle、archive/SHA 與 upload 等實際 steps 全部 success，signed build 因沒有簽章憑證如預期 skipped。
  - runtime prepare 下載並驗證固定 FFmpeg 8.1.2、Whisper.cpp 1.9.1 x64 與 multilingual Tiny；`runtime:verify` 回報 `[runtime] OK: win32-x64`，沒有將外部 Breeze runtime 混入 bundled runtime。
  - `npm run check` 完整通過；其中 Breeze 測試明確回報「Breeze ASR 25 模型契約、runtime 探針與 CLI 參數測試通過」，並完成語法、治理、Whisper、UI、AI 與核心 API regression。
  - builder 使用 `electron-builder --win --x64 --publish never` 的 unsigned 路徑。Setup 為 245,386,133 bytes、Portable 為 244,678,788 bytes；7-Zip 均辨識為 NSIS-3 Unicode 並回報 `Everything is Ok`。

## 3. 邊界情況

- 判定：通過（CI 可驗證邊界符合；乾淨實機缺口保留）
- 證據：
  - workflow 以 `Get-AuthenticodeSignature` 判斷兩個 EXE；因簽章不為 Valid，產生 `UNSIGNED INTERNAL PREVIEW: Windows may display Unknown Publisher or SmartScreen warnings.`，沒有把 unsigned 候選誤稱正式已簽章軟體。
  - 封裝檢查要求 Breeze guide 存在，且精確拒絕 `resources/tools/breeze-asr/breeze-asr-25.pt`；run 成功證明約定的 Breeze checkpoint 未進入 `win-unpacked`。Small model 亦維持首次使用下載而未內建。
  - Setup 使用隔離 temp 目錄靜默安裝後啟動 renderer，接著執行解除安裝與清理；Portable 另行啟動 renderer。最後 raw log 明確輸出 `Windows Setup, Portable, and uninstall smoke passed.`。
  - 此 lifecycle 發生於 GitHub-hosted Windows Server 2022 runner，不等於 Windows 10／11 乾淨使用者帳號、互動式 Setup、捷徑、SmartScreen 或完整子程序樹驗收。

## 4. 程式碼品質

- 判定：通過（來源與產物追溯充分）
- 證據：
  - commit `2b44d10` 相對前一候選來源 `d31873f` 只新增 REL-033 治理結案與其獨立報告，沒有產品程式、workflow、版本或 runtime 契約改動；不會以未提交產品碼偷偷改變本輪封裝行為。
  - `.github/workflows/windows-preview.yml` 使用 `permissions: contents: read`、固定 `windows-2022`、Node 22、`npm ci`、固定 runtime prepare 與 `--publish never`；signed／unsigned 分支互斥，並在 upload 前完成 renderer、archive、內容、SHA 與簽章狀態檢查。
  - SHA 清單由同一組實際 EXE 以 `Get-FileHash -Algorithm SHA256` 生成；signing status 由同一組 EXE 的 Authenticode 狀態生成，減少檔名或來源分歧。
  - artifact API 將 run、branch、source SHA、大小、digest、建立與到期時間連結在同一 metadata 中，可供後續下載者追溯。

## 5. 測試覆蓋

- 判定：通過（對 Windows x64 隔離測試候選範圍足夠）
- 證據：
  - 2026-08-13T07:50:38Z–07:50:48Z 的 CI `npm run check` 通過：docs、Node syntax、Breeze contract、Whisper 模型／下載／品質、媒體、AI provider、review UI 與核心 API；核心回歸包含真實 FFmpeg 聲波與精準修剪路徑。
  - 2026-08-13T07:52:19Z–07:53:14Z 的 packaged lifecycle 對 Setup installed 與 Portable executable 各自執行 renderer smoke；JSON 顯示 preload bridge、settings modal、health/settings、manual SRT job、trim/review assets、provider 與 folder flow 通過。
  - 2026-08-13T07:53:14Z–07:53:15Z 的封裝步驟完成兩個 NSIS archive 測試、Breeze guide／release notes／操作手冊、Small／Breeze checkpoint 排除、EXE SHA-256 與 signing status。
  - 本審查於 2026-08-13T15:56:58+08:00 獨立重跑 `node scripts/test-breeze-asr.mjs`、`npm run docs:check` 與 `git diff --check`，均通過。本輪依指定審查來源使用 API metadata 與 raw log，未另下載約 490 MB artifact，因此不宣稱已在本機重算其中兩個 EXE 的個別 SHA。

## 6. 實際運行結果

- 判定：通過（限 GitHub-hosted Windows packaged smoke）
- 證據：
  - Setup 安裝版 renderer 與 Portable renderer 均完成 manual SRT deterministic flow，包含 create `201`、start `202`、final status `completed` 與 cleaned SRT；一般設定、trim/review/provider/folder assertions 亦通過。
  - Setup silent uninstall 後 lifecycle script 完成且 step conclusion success；兩個最終 EXE 均可由 7-Zip 完整解析，證明不是只有 unpacked directory 成功。
  - artifact `9172938395` API 大小為 490,420,392 bytes，digest 為 `sha256:ea42572d49ef6d46141621bb1ed1291c31b2617dd2b539a642d32b6d92b714fb`；這與 upload raw log 的 final size、SHA256 digest 及 artifact ID 完全一致，且 artifact 於核對時 `expired=false`，到期時間為 2026-08-27T07:53:18Z。
  - renderer 使用 manual SRT／deterministic 測試，沒有載入真實 Breeze checkpoint 或 patched runtime，因此不能推論 Breeze 音訊品質、效能、長音訊、取消或 process-tree 已通過。

## 發布授權適用性核對

- 判定：通過（只適用 Windows x64 隔離測試候選交付）
- 證據：REL-034 工作紀錄已載明需求提出者／產品負責人於 2026-08-13 核准打包、提交與共享本輪 Windows x64 隔離測試候選，並接受 Windows 未 Authenticode 及真實 Breeze／乾淨實機尚未驗收風險。
- 授權界線：該核准不授權建立 tag、公開 GitHub Release、替換 v0.49.0 正式資產或宣稱未完成的實機／Breeze 驗收為完成；本審查結論亦不擴張授權。

## 綜合判定

- 結論：通過（限 Windows x64 隔離測試候選交付；不授權公開 Release）
- 阻擋問題（若有）：無。
- 剩餘風險：Setup／Portable 未 Authenticode，會有 Unknown Publisher／SmartScreen 風險；Windows Server 2022 CI smoke 未涵蓋 Windows 10／11 乾淨使用者實機、互動安裝、捷徑、權限、重啟、解除安裝殘留或完整 process-tree；真實 Breeze patched runtime、Python／PyTorch、約 3 GB checkpoint、模型品質、CPU／CUDA 效能、長音訊、取消與失敗復原均未驗收；artifact 有 14 天保留期限，且本輪未本機下載後重算兩個 EXE SHA，不得把 CI／metadata 證據擴張成永久下載或本機實體交叉驗證。
- 給主要開發代理的具體修正要求：無阻擋修正。主要代理可在 REL-034 工作紀錄逐字引用下列完整結論句，補齊實際驗證與本報告連結，再執行 `npm run docs:check:final`、`git diff --check`；交付只能使用本輪 Windows x64 隔離候選，不得建立或修改公開 Release。
- 可逐字引用完整結論句：**「REL-034 round1 獨立審查通過：來源 `codex/021-breeze-runtime-guide@2b44d1072cf137251c3acb0be9824eeb4587f8e2` 的 GitHub Actions run `31679412779` 已完成 source／npm check／Breeze 契約、Windows x64 unsigned Setup／Portable 建置、renderer／安裝／解除安裝 smoke、NSIS archive、SHA 與 Breeze checkpoint 排除，artifact `9172938395` 的 490,420,392 bytes 與 digest `sha256:ea42572d49ef6d46141621bb1ed1291c31b2617dd2b539a642d32b6d92b714fb` 亦完成核對，可作為 Windows x64 隔離測試候選交付；本結論不授權建立、上傳或替換公開 Release，亦不代表 Windows 10／11 乾淨實機、SmartScreen、Authenticode、真實 Breeze runtime、模型品質、效能或 process-tree 已驗收。」**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本審查代理未修改 repo 外測試包、GitHub Actions artifact、tag 或公開 Release。
- 若上述聲明不實，本報告無效。
