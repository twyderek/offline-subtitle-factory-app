# 0.52.0 unfinished release-scope closeout round2 獨立複審報告

- 審查日期：2026-10-30（Asia/Taipei）
- 審查對象：OSF-052 unfinished release-scope closeout、版本 0.52.0、基準 HEAD `539d8804265fb1d1738abf205629013bfc4f382a`
- 分支：`codex/0.51-anthropic-claude`
- 審查身份：獨立複審代理；本輪唯一寫入本報告，未修改 round1 報告或其他專案檔案
- 工作樹界線：審查時共享工作樹已有主要代理的未提交 README、RELEASE-NOTES、00／04／05／06／07／08 文件變更；本輪將其視為待複審內容，未改寫、stage、commit 或 push。
- 審查範圍：需求／範圍、正確性、跨平台與安全、測試／CI／artifact provenance、治理／文件、剩餘風險與發布聲明；特別核對 BUG-063／064／065／066、GOV-OSF052-01／02、final docs gate 與外部阻塞界線。

## 1. 需求完整性

- 判定：部分通過
- 證據：`README.md:5-7`、`RELEASE-NOTES-0.52.0.md:18-25`、`docs/project-management/00-CURRENT-STATUS.md:308-318` 與 `docs/project-management/05-DEVELOPMENT-AND-DEPLOYMENT.md:57` 均把 v0.52.0 公開範圍維持為 macOS arm64；Windows run `41013639786` 只被描述為 unsigned preview，未納入公開 Release。文件亦保留真實 Google OAuth／Keychain／頻道上傳、Windows Authenticode／實機、Apple Developer ID／公證／Gatekeeper 與有效播放／完整轉錄未驗收的界線。
- round1 closure：`GOV-OSF052-02` 已關閉。`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-8` 已記錄 exact-source run、artifact ID／size／API digest、unsigned／non-Release 界線；`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-33` 已將 BUG-063～066 標為 exact-source CI 複驗，並保留各項歷史失敗與 boundary。
- 限制：`GOV-OSF052-01` 尚未關閉，因最新 08 條目雖已標示完成，仍引用格式不符合現行 validator 的 round1 報告，且 final docs gate 未通過；因此不能把整個發布等級 closeout 視為已完成。

## 2. 邏輯正確性

- 判定：通過（BUG-063～066 bounded source／test scope）
- 證據：`HEAD 539d880` 的提交差異只涉及治理文件與 `scripts/test-macos-signed-canary-distribution.mjs`；目前工作樹相對 HEAD 沒有 `scripts/`、`.github/workflows/`、server、public、electron、lib 或 package source diff。四項修正分別將 Windows 不可提供的 macOS／POSIX fixture 限定在適用平台：gate 使用 `os.tmpdir()`／`path.join()`（`scripts/test-macos-signed-canary-gate.mjs:208-213`），POSIX `0600` 只在非 Windows 檢查（`scripts/test-macos-signed-canary-result.mjs:22-26`、`scripts/test-macos-signed-canary-distribution.mjs:9-13`、`scripts/test-macos-signed-canary-external-boundary.mjs:13-17`），macOS `/usr/bin/zip`／`unzip` 與 writer archive fixture 只在非 Windows 執行（`scripts/test-macos-signed-canary-distribution.mjs:127-149,212-312`）。
- production fail-closed 未放寬：`scripts/audit-macos-signed-canary-distribution.mjs:87-100,136-150,277-288` 仍要求 run-scoped absolute path、regular file、POSIX `0600`、exact archive binding 與 Darwin arm64；`scripts/audit-macos-signed-canary-result.mjs:351-357` 與 `scripts/audit-macos-signed-canary-external-boundary.mjs:316-318` 仍保留 fail-closed status、exclusive `wx` 與 mode `0600` writer contract。

## 3. 邊界情況

- 判定：通過（平台／安全／外部阻塞邊界如實）
- 證據：Windows CI 只證明 source／offline runtime、unsigned package、renderer／install lifecycle、archive／SHA 與 artifact upload；Authenticode step 在 run `41013639786` 為 skipped，沒有被誤述為 signed package。POSIX `0600`、macOS ZIP／unzip、symlink／archive writer 等仍由 POSIX／macOS fixture 驗證，沒有用 Windows pass 取代 macOS security evidence。
- `node scripts/assert-macos-signed-canary-ready.mjs` exit 1，輸出 `ready:false`，reasons 為 `developer-id-application-not-ready` 與 `notarization-credential-set-not-ready`；因此 Apple signing／notarization／Gatekeeper 仍是外部 blocker。Google real OAuth／channel E2E、有效播放／完整轉錄與 Windows 實機也未被 mock 或 CI runner 結果取代。
- 剩餘邊界：artifact 未在本輪下載至工作樹並重新展開重算內部檔案；目前證據只支持同源 GitHub CI unsigned preview artifact 已產生，不支持公開 Release asset 或獨立內容核驗。此為已揭露的 residual risk，不是新的 artifact provenance finding。

## 4. 程式碼品質

- 判定：通過（限測試契約與文件同步範圍）
- 證據：修正集中於 test fixture 的平台能力分流，保留原有 source-tree boundary、absolute path、privacy、archive、notary projection 與 negative contract assertions；沒有把 production audit 的條件改成 Windows 可接受，也沒有新增 workflow、signing、notarization 或外部設定寫入。
- `git diff --name-only HEAD -- scripts .github server.mjs public electron lib package.json package-lock.json` 無輸出，確認主要代理本輪文件回填未造成產品 source／workflow 變更；`git diff --check` exit 0，沒有 whitespace／patch 格式問題。

## 5. 測試覆蓋

- 判定：部分通過（程式與 CI coverage 通過；治理 final gate 仍阻擋）
- 證據：`npm run project:preflight -- --type=full` exit 0；`npm run docs:check` exit 0；`node scripts/test-project-docs-validator.mjs` exit 0；四支 signed-canary focused tests 與 syntax checks 通過；`npm run check` exit 0；`git diff --check` exit 0。測試結果支持 BUG-063～066 的 bounded portability 修正與 production fail-closed regression coverage。
- exact-source GitHub read-back：run `41013639786` 對 HEAD `539d8804265fb1d1738abf205629013bfc4f382a`，唯一 Windows job success；source／offline runtime、source／FFmpeg regression、unsigned preview package、renderer／install lifecycle、archive／SHA 與 upload 均 success，Authenticode build step skipped。artifact `offline-subtitle-factory-0.52.0-windows-x64` ID `12958791997`，size `504815503` bytes，API digest `sha256:01f57853d4f585907e5589d15727c2068d0ecc82d9b1a76dd54e048fc40e4a3d`，metadata head SHA 與 workflow run 一致。
- final docs gate：`npm run docs:check:final` exit 1，現行輸出指出 round1 報告的六個固定標題缺少有效判定／具體證據、缺少可逐字引用完整結論句，且 08 的發布授權範圍未被 validator 判定為涵蓋同意打包／發布／提交／推送／共享與「未簽章／未公證」風險。

## 6. 實際運行結果

- 判定：部分通過
- 證據：GitHub release read-back 顯示既有 `v0.52.0` 公開 Release 仍只有七項 macOS arm64 assets，無 Windows asset；tag `v0.52.0` 解析至 commit `b6b1efd6b72574f9210af74729d2cb2fd869e42d`，與 Windows preview run 的 HEAD `539d880` 不同。README、Release notes、00／04／05／06／07 已同步記錄 unsigned／non-Release、artifact provenance 與 Google／Apple／UI 外部阻塞。
- 發布聲明可以成立的範圍：macOS-only v0.52.0 公開 Release 既有界線，以及同源 Windows CI unsigned preview package 的 bounded evidence。不得宣稱 Windows Authenticode、Windows 實機／乾淨安裝、公開 Windows Release、Apple signed／notarized／Gatekeeper candidate、Google real OAuth／channel E2E 或有效播放／完整轉錄。
- 發布聲明不能成立的範圍：因 `npm run docs:check:final` 仍 exit 1，OSF-052 發布等級治理 closeout 尚不可標示完成；這是 governance blocker，不是 BUG-063～066 的 technical regression。

## 審查命令與結果

以下命令均為唯讀檢查或測試；未觸發 workflow、未下載 504 MB artifact、未執行 signing／notarization／Gatekeeper、未對 GitHub 或其他外部系統寫入：

- `npm run project:preflight -- --type=full`：exit 0；提示共享工作樹有主要代理既有未提交文件變更。
- `npm run docs:check`：exit 0；治理文件檢查通過 19 個文件。
- `node scripts/test-project-docs-validator.mjs`：exit 0；validator 測試通過。
- `npm run check`：exit 0。
- `git diff --check`：exit 0。
- `npm run docs:check:final`：exit 1；round1 報告不符合六個固定標題／判定／證據／逐字引用格式，且發布授權風險與操作範圍未通過 validator。
- `node scripts/assert-macos-signed-canary-ready.mjs`：exit 1；`ready:false`，reasons 為 `developer-id-application-not-ready`／`notarization-credential-set-not-ready`。
- `gh run view 41013639786 --json ...`：success，HEAD exact match，Windows job 內 source／runtime／preview package／renderer／install／archive／upload success，Authenticode skipped。
- `gh api repos/twyderek/offline-subtitle-factory-app/actions/artifacts/12958791997`：artifact ID／name／size／digest／workflow run／head SHA 一致。
- `gh release view v0.52.0 --json ...`、tag ref／annotated tag read-back：七項 macOS arm64 assets，無 Windows Release asset；tag commit 為 `b6b1efd6b72574f9210af74729d2cb2fd869e42d`。
- `git diff --name-only HEAD -- scripts .github server.mjs public electron lib package.json package-lock.json`：無輸出；確認目前 shared workspace 的未提交變更限文件，沒有產品 source／workflow diff。

## 綜合判定

- 結論：有條件通過（technical／CI／scope bounded closeout；release-scope governance closeout pending）。
- Findings（本輪新增）：無 technical finding、無 scope finding、無 artifact provenance finding。artifact 未本地下載重算是已揭露 residual risk；Windows unsigned／non-Release 與 macOS-only boundary 已正確保留。
- Round1 finding closure：`GOV-OSF052-02` 已關閉；06／07 已補 exact-source CI run `41013639786`、artifact `12958791997`、size／digest 與 unsigned／non-Release boundary，並將 BUG-063～066 標為已由 exact-source CI 複驗。`GOV-OSF052-01` 未關閉，仍是本輪 P1 治理阻擋項。
- P1 `GOV-OSF052-01`（round1 carry-over，非本輪新 technical finding）：`docs/project-management/08-CHANGE-LOG.md:3-27` 引用 round1 報告，但該檔案使用 `## 1. 需求／範圍` 等舊標題，與 `scripts/project-docs-validator.mjs:17-29` 要求的六個固定標題、`- 判定：`、`- 證據：` 與可逐字引用完整結論句不符；`npm run docs:check:final` 因此 exit 1，並另回報發布授權 scope 未通過打包／發布／提交／推送／共享及未簽章／未公證風險檢查。建議：由主要代理將 08 的最新審查檔案／逐字引用切換至本 round2 報告，按 validator 可解析格式補足發布授權範圍與風險，然後重跑 `npm run docs:check:final`；本報告代理不修改 08。
- 可逐字引用的完整結論句：**本輪 OSF-052 round2 獨立複審結論為有條件通過：round1 的 GOV-OSF052-02 已由 06／07 補入 exact-source run 41013639786、artifact 12958791997、size／digest 與 unsigned／non-Release boundary 而關閉；BUG-063～066 的 test-only portability 修正沒有放寬 production fail-closed contract，Windows artifact provenance、macOS-only Release boundary、Google OAuth／Apple signing／UI residual 均如實；但 GOV-OSF052-01 尚未關閉，因 `npm run docs:check:final` 仍 exit 1，current 08 的 round1 review reference／quote 尚不可解析且發布授權範圍未明確涵蓋打包／發布／提交／推送／共享及未簽章／未公證風險，因此在主要代理補齊 08 並重跑 final docs gate 前，不得標示 OSF-052 完成。**
- 阻擋問題（若有）：僅有 P1 `GOV-OSF052-01`；沒有 technical、scope 或 artifact provenance blocker。OSF-052 只有在主要代理修正 08 的 round2 reference／逐字引用／發布授權欄位並使 `npm run docs:check:final` exit 0 後，才可標示完成。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 未修改 round1 報告、產品 source、workflow、既有 evidence 或其他 review；未 stage／commit／push，未觸發 workflow，未對 GitHub／Keychain／credentials／Environment／reviewer／branch protection 或其他外部系統寫入。
- 若上述聲明不實，本報告無效。
