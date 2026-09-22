# 獨立審查報告：0.51.0 release-readiness 本機候選核對

- 審查對象 commit／版本：目前 HEAD `17df9788abf2cf964d52df10b74f9a8fcd7a45d6`、版本 `0.51.0`；候選來源為 macOS `88da220`、Windows `91eca2b`
- 對應 08-CHANGE-LOG 條目：2026-09-22 — 0.51.0 release-readiness 本機候選核對（release_qa）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-09-22T10:42:09+08:00（Asia/Taipei）；依 `npm run project:preflight -- --type=release` 讀取本輪固定核心、release 路由與指定證據，為獨立唯讀審查上下文
- 審查限制：只讀指定治理／證據／候選檔案與驗證腳本；未重建、未執行完整 `npm run check`、未上傳、未推送、未建立 tag、未發布

## 1. 需求完整性

- 判定：部分通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-22` 與 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:18-23` 明確定義本輪為本機、非發布的 0.51.0 macOS DMG／ZIP 與 Windows Setup／Portable 候選核對，並列出 checksum、metadata、runtime、封裝及未覆蓋 gate。`docs/project-management/evidence/2026-09-22-release-readiness-audit.json` 的 `scope` 全部標示未上傳／未推送／未建立 tag／未發布，且 `notARelease=true`。但需求的 release-readiness gate 尚未完整滿足：macOS provenance 為 `88da220`、Windows provenance 為 `91eca2b`，目前 HEAD 為 `17df978`，候選不是目前工作樹的重建資產；Windows 真機、macOS 乾淨安裝／Gatekeeper／公證、CI artifact 與發布後資產核對均未完成。

## 2. 邏輯正確性

- 判定：通過
- 證據：獨立解析並斷言 audit JSON 的 schema、版本、current HEAD、`releaseReady=false`、`notARelease=true`、兩個來源 commit 均為目前 HEAD 祖先且各有後續 commit，結果通過（`evidence assertions: OK`）。`git merge-base --is-ancestor`／`git rev-list --count` 重放結果為 macOS `88da220` 後 2 commits、Windows `91eca2b` 後 3 commits。這使「候選靜態核對通過，但不能代表目前 HEAD／dirty worktree」的判定邏輯成立；沒有把候選 checksum 通過誤推論為可發布。

## 3. 邊界情況

- 判定：部分通過
- 證據：已明確覆蓋並保留限制：macOS ad-hoc、無 Developer ID／公證；Windows unsigned、未驗證 Authenticode；Windows `7z` container test 未執行；macOS 乾淨安裝／Gatekeeper、Windows 安裝／解除安裝／renderer／SmartScreen／離線行為、CI artifact 交叉核對與 GitHub upload 後核對未執行。候選 `TEST-CANDIDATE-README.md` 與 `PROVENANCE.txt` 亦逐項揭露上述範圍。現場唯讀探查確認 `7z`／`7zz`／`7za`／`wine`／`wine64` 均不可用。工作樹在審查開始時有 112 個變更路徑；相較 audit JSON 的 111 個快照，差異由該 audit JSON 本身為未追蹤檔可解釋，不改變候選已落後 HEAD 且工作樹不乾淨的 blocker。

## 4. 程式碼品質

- 判定：通過
- 證據：`scripts/verify-runtime-package.mjs:10-17` 以明確 target 選擇 runtime manifest，`68-105` 檢查檔案存在／大小、PE 或 Mach-O magic、manifest SHA-256 與 optional model hash，`116-124` 僅在本機 target 相符時執行 runtime smoke；未見寫入候選或專案檔案的路徑。兩平台 runtime verify 均輸出 `[runtime] OK`。候選 `PROVENANCE.txt`／`SIGNING-STATUS-*.txt`／README 對版本、平台、來源 commit、簽章狀態與非發布範圍的描述彼此一致；audit JSON 為結構化、非敏感證據，未保存 API key 或使用者資料。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：實際執行 `npm run runtime:verify:mac`、`npm run runtime:verify`、兩份 `shasum -a 256 -c`、evidence assertions、macOS `hdiutil verify`、macOS `unzip -t`、latest metadata size／SHA-512 assertions、`npm run docs:check` 與 `git diff --check`，均 exit 0。兩份 SHA-256 manifest 逐項報告 `OK`，metadata assertions 報告 `latest metadata size/SHA-512 assertions: OK`。但依 `06-TEST-AND-PROCESS-AUDIT.md:21-23`，Windows Setup／Portable 容器檢查因無 7z 未執行，且沒有 Windows 實機或 macOS 乾淨安裝／Gatekeeper／公證；本輪也未重跑完整 `npm run check`，所以測試覆蓋只足以支持本機靜態候選核對，不足以支持正式發布。

## 6. 實際運行結果

- 判定：部分通過
- 證據：`hdiutil verify` 回報 DMG checksum `VALID`；`unzip -t` 回報 ZIP `No errors detected in compressed data`；macOS／Windows SHA-256 manifest 全部 `OK`；latest metadata 的檔案 size／SHA-512 重算一致；現有 macOS packaged app 的 `codesign --verify --deep --strict` 回報 `valid on disk`／`satisfies its Designated Requirement`。這些只證明候選資產的靜態 checksum／封裝與既有 macOS ad-hoc 驗證結果，**不等於目前工作樹已重建**；候選仍分別落後目前 HEAD 2／3 commits，且工作樹不乾淨。Windows installer 在本機只能做靜態 PE／metadata 核對，未做 Windows 真機啟動、安裝、renderer、解除安裝或離線驗收；macOS 未做乾淨安裝／Gatekeeper，且無 Developer ID／公證。沒有 tag、push、CI artifact 閉環或 GitHub Release，因此沒有正式發布運行結果。

## 綜合判定

- 結論：不通過
- 可逐字引用完整結論句：**本輪 0.51.0 release-readiness 本機候選核對獨立審查結論為不通過：macOS／Windows 候選的靜態 checksum、封裝／metadata 核對及本機 runtime assertions 通過，但候選 provenance 分別落後目前 HEAD `17df978`（macOS `88da220` 落後 2 commits；Windows `91eca2b` 落後 3 commits），且工作樹非乾淨；因此候選不代表目前工作樹，不得作為可發布資產，亦未完成 Windows／macOS 真機與安裝驗收、正式簽章／公證、CI artifact 交叉核對或正式發布。**
- 阻擋問題（若有）：
  - 候選 provenance 落後目前 HEAD，且工作樹有既有變更；必須從明確、乾淨且可追溯的來源重建兩平台候選並重新完成核對。
  - Windows 7z archive test、Windows 10／11 真機安裝／啟動／renderer／解除安裝／SmartScreen／Authenticode／離線行為未驗收。
  - macOS 乾淨安裝／Gatekeeper、Developer ID 簽章與公證未驗收；現況僅為 ad-hoc。
  - CI artifact 交叉驗證與 GitHub upload 後 asset／digest／下載核對未執行；本輪無發布授權請求或正式發布動作。
- 剩餘風險：候選 README／PROVENANCE 已揭露真實 Anthropic API／模型品質／rate-limit、Whisper Small／Breeze runtime、長音訊品質與效能、跨平台及公開 Release 未驗收；Windows 候選為 unsigned，macOS 候選為 ad-hoc／未公證。現有靜態封裝通過不代表 Windows／macOS 真機可用，也不代表簽章、公證或正式發布。

## 審查代理聲明
本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
