# 獨立審查報告：0.51.0 release-readiness 本機 audit 文件結案複審

- 審查對象 commit／版本：目前 HEAD `17df9788abf2cf964d52df10b74f9a8fcd7a45d6`、版本 `0.51.0`；既有 macOS 候選來源 `88da220`、Windows 候選來源 `91eca2b`
- 對應 08-CHANGE-LOG 條目：2026-09-22 — 0.51.0 release-readiness 本機候選核對（release_qa）
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-09-22T10:47:47+08:00（Asia/Taipei）；依 `npm run project:preflight -- --type=release` 讀取 release 治理規則、指定 audit evidence 與 round1 報告，並以既有 round1 可回溯事實完成獨立複審
- 審查範圍：本輪只審查本機 release-readiness audit 的 evidence／文件結案狀態；不授權發布，不重建候選，不執行完整 `npm run check`、建置、長測試、上傳、推送、tag 或發布

## 1. 需求完整性

- 判定：部分通過；本機 audit 文件結案可有條件通過，0.51.0 release candidate 不通過發布需求
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-26` 將本輪明確定義為 local-only、非發布的 0.51.0 macOS DMG／ZIP 與 Windows Setup／Portable 候選核對，並記錄 evidence、round1 報告、未發布範圍與遺留 gate。`docs/project-management/evidence/2026-09-22-release-readiness-audit.json:9-16,73-81` 明確標示 local-only、未上傳／未推送／未建立 tag／未發布、`releaseReady=false`、`notARelease=true`。因此「本機 audit 的 evidence、文件與不發布範圍是否完成」可判定為已完成；但「候選是否可發布」仍不可通過。

## 2. 邏輯正確性

- 判定：通過（就本輪 audit 文件與判定邏輯而言）
- 證據：evidence 的 `currentHead` 為 `17df9788abf2cf964d52df10b74f9a8fcd7a45d6`；macOS 候選來源 `88da220` 且落後 2 commits，Windows 候選來源 `91eca2b` 且落後 3 commits（`evidence:7,23-27,48-52`）。`evidence:73-81` 將 `releaseReady` 保持為 `false`，並將候選 provenance、跨平台實機、簽章／公證、CI artifact 與發布後核對列為 blocker。這與 round1 的完整結論（`2026-09-22-release-readiness-round1.md:39-48`）一致，沒有把 checksum／runtime 通過錯誤推論成可發布。

## 3. 邊界情況

- 判定：部分通過
- 證據：本輪已明確保留邊界而非掩飾缺口：Windows Setup／Portable `7z` container test 為未執行（`evidence:53-64`）；Windows 真機安裝、renderer、解除安裝、SmartScreen、Authenticode 與離線行為未驗證（`evidence:66-70,74-78`）；macOS clean install、Gatekeeper、Developer ID 與 notarization 未驗證，現況僅 ad-hoc（`evidence:42-46,74-78`）；CI artifact 交叉驗證與 GitHub upload 後資產核對未執行。round1 亦確認工作樹非乾淨、候選不是目前工作樹重建資產（`round1:19-22,39-48`）。這些限制足以阻擋 release，但不阻擋本機 audit 文件結案的條件判定。

## 4. 程式碼品質

- 判定：通過（限於本輪 audit 使用的驗證程式與證據文件品質；不代表整個 0.51.0 產品已完成發布品質審核）
- 證據：round1 已核對 `scripts/verify-runtime-package.mjs:10-17,68-105,116-124` 的 target 選擇、檔案／格式／SHA-256／manifest 與本機 runtime smoke 邏輯，並記錄兩平台 runtime verify 通過（`round1:24-27`）。audit JSON 採結構化 schema，記錄版本、HEAD、候選 provenance、範圍旗標、通過項與 blocker（`evidence:1-8,18-21,73-81`），且未保存 API key 或使用者資料。文件也清楚把 audit closeout 與 release readiness 分開，符合治理規則。

## 5. 測試覆蓋

- 判定：部分通過；足以支持本機 audit 文件結案，不足以支持 release
- 證據：既有證據記錄 `npm run runtime:verify:mac` 與 `npm run runtime:verify` 通過，macOS DMG `hdiutil verify`、ZIP `unzip -t`、兩平台 SHA-256 manifest、latest metadata size／SHA-512、packaged version、macOS deep strict ad-hoc codesign 與 Windows PE32+ x86-64 核對通過（`08-CHANGE-LOG.md:15-18`；`evidence:18-70`）。round1 另記錄 evidence assertions、`npm run docs:check` 與 `git diff --check` 通過，但明確未重跑完整 `npm run check`，且 Windows 7z、兩平台實機／安裝與外部 CI gate 未覆蓋（`round1:29-32`）。依本輪限制，不把未執行測試誤寫成通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：既有實際結果支持候選的本機靜態與 runtime 核對：macOS／Windows runtime verification 為 `pass`（`evidence:18-21`），macOS DMG／ZIP checksum／封裝與 metadata 為 `pass`（`evidence:28-46`），Windows SHA-256／metadata／unpacked executable 與版本核對為 `pass`，但 container test 為 `not-run-7z-unavailable`、Windows real-machine validation 為 `not-run-on-macos-host`（`evidence:48-70`）。round1 的實際運行結論也明確指出沒有 Windows 真機、macOS clean install／Gatekeeper、CI artifact 閉環或正式發布運行結果（`round1:34-37`）。因此實際結果只支持 audit closeout，不支持候選發布。

## 綜合判定

- 結論：有條件通過（僅限本輪 release-readiness audit 文件結案；不是 release 通過）
- 可逐字引用完整結論句：**本輪 0.51.0 release-readiness audit 文件結案獨立複審結論為有條件通過：本輪 audit 證據與文件已完成，且不發布範圍已被保留；但 round1 已確認的 stale provenance/worktree blocker 仍未解除，`releaseReady` 必須維持 `false`，0.51.0 release candidate 不可發布，跨平台／簽章／CI gate 尚未完成；候選必須從明確且乾淨來源重建並補齊外部 gate 後，才可另行審查發布資格。**
- 阻擋問題（若有）：
  - round1 已確認 macOS `88da220`、Windows `91eca2b` 的 stale provenance/worktree blocker；候選落後目前 HEAD，且工作樹非乾淨，不能代表目前可發布來源。
  - Windows 10／11 真機安裝、renderer、解除安裝、SmartScreen、Authenticode、離線行為與 7z container test 尚未完成。
  - macOS clean install、Gatekeeper、Developer ID 簽章與 notarization 尚未完成；現有候選僅為 ad-hoc。
  - CI artifact 交叉核對、發布後資產／digest／下載核對與正式發布授權流程尚未完成。
- 條件與具體後續要求：
  - `releaseReady` 維持 `false`，不得將本報告的「有條件通過」解讀為 release 通過或發布授權。
  - 從明確且乾淨的來源 commit／工作樹重建 0.51.0 macOS 與 Windows 候選，重新核對 provenance、版本、runtime、封裝、checksum 與 metadata。
  - 補齊 Windows 真機與 macOS clean install／Gatekeeper 等跨平台 gate，並依實際結果揭露簽章／公證狀態；再完成 CI artifact 交叉驗證與必要的發布授權記錄。
- 剩餘風險：Windows 候選為 unsigned、macOS 候選為 ad-hoc／未公證；真實 provider／模型品質、長音訊效能、跨平台行為與正式發布後狀態仍未由本輪證據覆蓋。常設簽章授權僅涵蓋其明示的未簽章／未公證風險，不解除未實機測試、CI、provenance 或其他 release gate（`docs/project-management/09-STANDING-AUTHORIZATIONS.md:3-15`）。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
