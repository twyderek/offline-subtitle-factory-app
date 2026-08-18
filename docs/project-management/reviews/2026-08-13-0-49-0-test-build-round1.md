# 獨立審查報告：v0.49.0 雙平台測試軟體重建（REL-032）

- 審查對象 commit／版本：`main`／`origin/main` commit `c41d6ad60441687da19ce67bd847256b843b5e69`，產品版本 0.49.0；工作分支 `codex/049-test-build` 的 REL-032 治理差異與 repo 外 `../dist/test-build-c41d6ad/` 測試候選
- 對應 08-CHANGE-LOG 條目：2026-08-13 — v0.49.0 雙平台測試軟體重建（REL-032）（`docs/project-management/08-CHANGE-LOG.md:16`）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-13T11:39+08:00；由獨立子代理上下文啟動，只收到審查範圍、證據位置與唯讀限制，未沿用主要開發代理的評價性結論
- 證據核對時間：本機重驗 2026-08-13T11:40–11:45+08:00；GitHub Actions run 的原始時間為 2026-08-13T03:21:33Z–03:25:05Z

## 1. 需求完整性

- 判定：通過（限隔離測試候選交付）
- 證據：
  - REL-032 明定來源為 `c41d6ad`、輸出為 macOS arm64 DMG／ZIP 與 Windows x64 Setup／Portable，並明確排除下載／內建 Breeze checkpoint、建立 tag／Release、替換公開資產，以及把 mock／建置證據宣稱成真實品質或乾淨實機驗收（`docs/project-management/08-CHANGE-LOG.md:20-31`）。
  - `git rev-parse HEAD main origin/main` 均為 `c41d6ad60441687da19ce67bd847256b843b5e69`；`v0.49.0^{}` 仍為 `1f50b85c0599ef85c73f05085d70925d4d6b670a`。`git diff --name-status c41d6ad` 只有 REL-032 的兩份治理文件，沒有產品碼、workflow 或版本變更。
  - repo 外目錄實際存在 macOS DMG、ZIP、App、SHA／updater metadata／provenance，以及 Windows run `31663681837` 的完整 artifact ZIP、extracted Setup、Portable、原始 CRLF checksum、LF checksum、metadata、簽章狀態與 provenance。
  - 2026-08-13T11:44+08:00 唯讀查詢 GitHub Release：Latest 仍為公開 `v0.49.0`、9 項既有資產；其正式資產 digest 與本輪測試候選不同，沒有發現 REL-032 資產被誤上傳或替換。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - macOS `shasum -a 256 -c SHA256SUMS-macos-arm64.txt` 於 2026-08-13T11:45:39+08:00 對 DMG／ZIP 均回報 `OK`；獨立重算為 DMG `7ddb472d361734d020d176a2d3ad51cbc0adb61d856ee1da60bcb74acc20002d`（242,706,304 bytes）、ZIP `4d45ae1f48a44332276e37174e40188ea33d27ff4358a30cf43f7c8d90c1ae0c`（249,941,976 bytes）。
  - `latest-mac.yml` 的版本 0.49.0、兩檔 size 與 SHA-512 均和實檔獨立重算一致；App `Info.plist` 為 0.49.0、最低 macOS 12.0。
  - `hdiutil verify` 回報 DMG checksum `VALID`；`unzip -t` 回報 ZIP 無錯；`codesign --verify --deep --strict` 通過，`codesign -dvvv` 明確顯示 `Signature=adhoc`、`TeamIdentifier=not set`，沒有誤稱 Developer ID 或公證。
  - App 內容包含 `docs/BREEZE-ASR-25.md`、`RELEASE-NOTES-0.49.0.md` 與 `ggml-tiny.bin`；未找到 `ggml-small.bin`、Breeze checkpoint／safetensors 或大於 1 GiB 檔案，符合 optional external Breeze runtime 的界線。
  - GitHub API 於 2026-08-13T11:42+08:00 回報 artifact `9167179425` 大小 490,411,789 bytes、digest `sha256:c8d1064a52ade1fd7147fbfad665f342ec9b1aded2323480692113b84c7c8182`、來源 `main@c41d6ad`，與本機完整 ZIP 的 size／SHA-256 完全一致；ZIP `unzip -t` 無錯且包含預期 6 檔。
  - Windows extracted Portable SHA-256 為 `07a3b07bbbc1ab514f8b17f876baae84a923ae43384e9e8ee9e518d31daa3bd9`（244,674,586 bytes），Setup 為 `8461defe905aefddd45aa7ebac56c67d76e13c5226a29f621d3fca74aca78edf`（245,381,834 bytes）；兩者與 checksum 清單一致。`latest.yml` 的 0.49.0、Setup size 與 SHA-512 亦和實檔一致。
  - 兩個 Windows NSIS 外層 stub 由 `file`／`objdump` 識別為 PE/NSIS，Security Directory 均為 `00000000 00000000`；這與 CI `Get-AuthenticodeSignature` 產生的 `UNSIGNED INTERNAL PREVIEW` 相符。x64 是 electron-builder `--win --x64` 內含應用的建置目標，不能把 32-bit NSIS stub 的 `coff-i386` 表示誤讀成 payload 不是 x64。

## 3. 邊界情況

- 判定：通過（已測邊界符合；外部實機缺口保留）
- 證據：
  - Windows 原始 `SHA256SUMS-windows-x64.txt` 經 `file` 與 `xxd` 確認為 CRLF（行尾 `0d0a`）；原檔保留未改。以 `tr -d '\r'` 串流重放兩個 EXE 均 `OK`，另附的 LF 版直接 `shasum -a 256 -c` 亦兩項 `OK`，證明差異只有換行格式而非 digest／檔名內容。
  - Windows workflow 的簽章條件分支符合預期：無 `CSC_LINK` 時 signed step skipped、unsigned step success；CI 後續仍對 Setup／Portable 執行 renderer、silent install／uninstall、NSIS `7z t`、guide／release notes／Small／Breeze checkpoint 排除與 checksum，未因未簽章跳過封裝驗證（`.github/workflows/windows-preview.yml:40-128`）。
  - macOS App 的 Breeze 排除、Small 排除、最大檔案與 ad-hoc 簽章都由本輪直接檢查；packaged renderer 使用新的隔離 userData 再跑，沒有重用既有使用者資料。
  - 尚未實測的 Gatekeeper／SmartScreen、互動式安裝、Breeze checkpoint 缺件與真實 runtime／音訊等，已在工作紀錄與稽核文件明列（`docs/project-management/08-CHANGE-LOG.md:38`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:181`），未被 CI 成功結果掩蓋。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - 本輪來源 commit 後沒有產品程式、版本、build config 或 workflow 改動；工作差異只有 `06-TEST-AND-PROCESS-AUDIT.md` 與 `08-CHANGE-LOG.md` 新增 REL-032 事實紀錄，因此不存在以未提交程式碼產生測試包的情況。
  - `package.json:3,20-32,41-84` 顯示版本 0.49.0、完整回歸／兩平台 runtime 與 build 指令、Breeze guide／Release notes 收錄，以及 secrets／憑證排除規則；`.github/workflows/windows-preview.yml:11-18` 使用最小 `contents: read` 權限與固定 `windows-2022` job。
  - provenance 以 `TEST BUILD ONLY`、來源 commit、平台、簽章狀態與 Breeze 外部依賴清楚標示；Windows 本機 provenance 另記 artifact ID／digest 與 CRLF/LF 邊界，可供後續交叉追溯。
  - `npm run docs:check` 於 2026-08-13T11:44:38+08:00 通過（19 個治理文件、版本 0.49.0），`git diff --check` 無輸出；最終 `docs:check:final` 應由主要代理在引用本報告並將 REL-032 結案後執行。

## 5. 測試覆蓋

- 判定：通過（對測試候選範圍足夠）
- 證據：
  - GitHub run `31663681837` 為 `workflow_dispatch`，head branch `main`、head SHA `c41d6ad`、job `Windows x64 test and package` conclusion `success`。其 2026-08-13T03:22:12Z–03:24:58Z 日誌顯示固定 FFmpeg 8.1.2／Whisper.cpp 1.9.1 runtime、`npm run check` 全部通過、0.49.0 unsigned build、Setup installed renderer、Portable renderer、silent uninstall、兩個 NSIS archive `Everything is Ok`、內容排除與 artifact upload digest。
  - Windows `npm run check` 日誌逐項包含 Whisper fallback／三模型／下載取消與清理、Breeze 模型契約／runtime probe／CLI、治理、媒體／字幕、AI providers／optimizer／Ollama、UI 與核心 API；這是 deterministic/source regression 與真實 FFmpeg 路徑證據，不是 Breeze 真實 checkpoint 品質測試。
  - 本輪獨立重跑：`hdiutil verify`、macOS／Windows ZIP `unzip -t`、macOS deep strict codesign、兩平台 SHA-256、兩份 updater SHA-512／size、Windows CRLF/LF checksum、PE Security Directory、App 版本／最低系統／內容排除，均通過。
  - `npm audit --json` 的 0 弱點／286 dependencies 屬主要代理開發驗證紀錄；本審查未以其取代封裝、checksum 或運行核對。

## 6. 實際運行結果

- 判定：通過（封裝 smoke 層級）
- 證據：
  - 2026-08-13T11:45+08:00 以 `ELECTRON_ENABLE_LOGGING=1 node scripts/verify-electron-renderer.mjs '<test App executable>' 9249 60000` 對同一 macOS App 重跑成功：Electron bridge、設定 modal、health/settings、manual SRT job `201 → 202 → completed`、清理後 SRT、trim/review assets、術語 round-trip、七個 provider 與 folder event 均符合斷言；隔離 userData 使用暫存目錄並由測試腳本清理。
  - Windows run 日誌顯示 Setup 靜默安裝至隔離 temp 後 renderer job `completed`、Portable renderer 同樣完成，最後輸出 `Windows Setup, Portable, and uninstall smoke passed.`；此為 GitHub-hosted `windows-2022` runner 的自動封裝 smoke，不是需求方 Windows 10／11 乾淨使用者實機或 SmartScreen 人工操作。
  - macOS 重跑是未公證 App 的直接 packaged-renderer smoke，不是 DMG 拖曳至 Applications 後的乾淨帳號 Gatekeeper 驗收；manual SRT fixture 也沒有載入真實 Breeze checkpoint，因此不得推論 Breeze 音訊品質、效能、長音訊、取消或 process tree 已通過。

## 發布授權適用性核對

- 判定：通過（限不公開的測試候選產生與交付）
- 證據：需求方於 2026-08-13 指示「請繼續到產生測試軟體」，REL-032 將其限縮為本機／CI 測試候選授權，並明列未獲授權建立新公開 Release、替換既有公開資產或宣稱未完成實機驗收（`docs/project-management/08-CHANGE-LOG.md:36-38`）。
- `AUTH-2026-07-23-01` 只接受 Windows 未 Authenticode 與 macOS 未 Developer ID／未公證的已知風險；它明確排除未實機測試、checksum／metadata 不一致、測試／審查失敗，也不代表立即發布或擴大公開範圍（`docs/project-management/09-STANDING-AUTHORIZATIONS.md:5-14`）。
- 因本輪不公開，現有授權足以支持「產生與交付測試候選」；若後續要把 `c41d6ad` 測試包公開成新 Release 或替換 v0.49.0 資產，必須另取得涵蓋該具體外部操作與仍存實機／Breeze 缺口的需求方授權，且需重新做發布前／後核對。

## 綜合判定

- 結論：通過（限隔離測試候選交付；不授權公開發布）
- 阻擋問題（若有）：無。
- 剩餘風險：
  - macOS 僅 ad-hoc 簽章、未 Developer ID／未公證；未做 DMG 拖曳安裝後乾淨帳號 Gatekeeper 驗收。
  - Windows Setup／Portable 未 Authenticode；GitHub-hosted Windows Server 2022 smoke 不等同 Windows 10／11 乾淨使用者實機、SmartScreen、互動安裝／捷徑操作。
  - Breeze checkpoint、官方／patched Python runtime、真實音訊品質、CPU／CUDA 效能、長音訊、取消與 process tree 均未驗收；封裝只證明 guide／probe 契約存在且大模型未誤內建。
  - Actions v4 的內部 Node 20 相容層 deprecation annotation 仍需後續評估；本輪 run 本身成功，但不得把成功延伸成未來 action 相容性保證。
  - Windows artifact 將於 2026-08-27T03:24:42Z 到期；本機完整 ZIP／provenance 可保留重驗，但不應誤當永久公開下載來源。
- 給主要開發代理的具體修正要求：無阻擋修正。結案時只需在 REL-032 工作紀錄連結本報告、逐字引用下列完整結論句，將狀態／結案欄位改為完成，並執行 `npm run docs:check:final` 與 `git diff --check`；不得擴大成公開 Release 操作。
- 可逐字引用完整結論句：**「REL-032 round1 獨立審查通過：來源 `main@c41d6ad` 的 macOS arm64 DMG／ZIP 與 Windows x64 Setup／Portable 已完成來源、版本、封裝內容、簽章狀態、SHA-256、updater metadata、archive 與 packaged-renderer 核對，可作為隔離測試候選交付；本結論不授權建立或替換公開 Release，亦不代表 macOS／Windows 乾淨使用者實機或真實 Breeze runtime、模型品質與效能已驗收。」**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本審查代理亦未修改 repo 外測試包。
- 本輪 macOS renderer smoke 只在系統暫存目錄使用並清理隔離 userData；沒有修改受審 App／DMG／ZIP 或 Windows artifact。
- 若上述聲明不實，本報告無效。
