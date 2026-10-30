# 獨立審查報告：0.52.0 unfinished release-scope closeout

- 審查對象 commit／版本：`539d8804265fb1d1738abf205629013bfc4f382a`／`0.52.0`
- 對應 08-CHANGE-LOG 條目：`2026-10-30 — 0.52.0 unfinished release-scope completion audit（OSF-052-INCOMPLETE-RELEASE-CLOSEOUT-20261030）`
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-30（Asia/Taipei）；依使用者指定的 HEAD、GitHub Windows workflow run 與目前共享工作區進行獨立只讀審查，不以主要代理的評價作為證據。
- 審查限制：只讀檢查、必要測試與 GitHub API／CLI read-back；唯一寫入為本報告。未修改 source、workflow、既有 evidence／review，未 stage／commit／push，未觸發 workflow 或外部設定。

## 審查基準與總覽

- 審查開始時工作樹 clean；HEAD、`origin/codex/0.51-anthropic-claude` 與 `git ls-remote` 均為 `539d8804265fb1d1738abf205629013bfc4f382a`。
- `539d880` 相對 `4996a42` 的修改只包含 `06`、`07`、`08` 治理文件，以及四支 signed-canary test：`scripts/test-macos-signed-canary-gate.mjs`、`scripts/test-macos-signed-canary-result.mjs`、`scripts/test-macos-signed-canary-distribution.mjs`、`scripts/test-macos-signed-canary-external-boundary.mjs`。production audit scripts、library 與 Windows／macOS workflow 不在差異內；三支 production evidence writer／archive contract 的 SHA-256 亦與 `4996a42` 完全相同。
- GitHub Actions run `41013639786` 的 HEAD 正是 `539d880`，job `Windows x64 test and package` success；source／offline runtime regression、unsigned preview build、renderer／installation lifecycle、archive／SHA step 與 upload 均 success，Authenticode-signed build step skipped。artifact 為 `offline-subtitle-factory-0.52.0-windows-x64`，ID `12958791997`，504,815,503 bytes，GitHub API／upload log digest `sha256:01f57853d4f585907e5589d15727c2068d0ecc82d9b1a76dd54e048fc40e4a3d`。
- 現有公開 `v0.52.0` 為 non-draft、non-prerelease，annotated tag 指向 `b6b1efd6b72574f9210af74729d2cb2fd869e42d`，Release 只有七項 macOS arm64 資產；沒有 Windows Release asset。基準 HEAD 的 `RELEASE-NOTES-0.52.0.md:20-25`、`docs/project-management/00-CURRENT-STATUS.md:308-318` 與 `docs/project-management/05-DEVELOPMENT-AND-DEPLOYMENT.md:57` 均保留 macOS-only／Windows preview 非公開資產／未 Authenticode／未實機的界線，但尚未記錄本次 run `41013639786` 的新 artifact 詳情；這些文件在審查後的未提交回填不屬於本輪基準。

## Findings

### P1

- `GOV-OSF052-01`：發布等級 closeout 尚未完成。`docs/project-management/08-CHANGE-LOG.md:3-13` 的最新 OSF-052 條目仍為「狀態：進行中」，且沒有「獨立審查是否執行：」與「發布授權：」欄位。`npm run docs:check:final`（2026-10-30 本輪實測）exit 1，明確回報最新條目未完成、缺獨立審查欄位、缺發布授權欄位、缺核准人／時間／範圍及不具體的發布同意範圍。
  - 影響：目前可以判定 bounded source／test 修正與 Windows CI preview 已完成，但不能把 OSF-052 整個發布等級工作項目標示為完成，也不能在 final docs gate 前宣稱本輪 release-scope closeout 已完成。
  - 建議：主要代理回填 08 的實際 CI／artifact／測試結果、連結本報告並逐字引用結論，記錄 `AUTH-2026-07-23-01` 僅涵蓋的未簽章／未公證風險與本次實際發布範圍；若本輪不修改公開 Release，須明確記錄該界線與核准範圍，完成後重跑 `npm run docs:check:final`。不得修改本報告。

### P2

- `GOV-OSF052-02`：06／07 的 BUG-063～066 現況摘要尚未與成功的 CI run 同步。`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-25` 與 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-33` 仍使用「CI 複驗中」、「待 push 後重跑」或「待新的 Windows workflow」等未完成措辭，但 run `41013639786` 已於 2026-10-30 success 並上傳 artifact。
  - 影響：歷史失敗原因本身正確，但目前讀者無法從 BUG-063～066 條目知道其後續已由哪個 run、job、artifact 與 digest 關閉；治理文件的時間狀態不一致。
  - 建議：保留歷史 failure facts，另加成功 CI follow-up，記錄 `41013639786`、HEAD `539d880`、artifact `12958791997`、size／digest、unsigned preview 與「非公開 Release asset」界線；同步將待辦措辭改成已驗證或明確標記為歷史當時狀態。
  - 觀測界線：本報告建立後，shared workspace 又出現未提交的 `06` closeout section 與 `07` BUG-066 wording 回填；它們不在基準 HEAD `539d880`，也不是本審查代理的寫入，因此不改變本輪對基準 commit 的 finding，亦未作為已完成的 round1 closeout 證據。

## 1. 需求／範圍

- 判定：部分通過
- 證據：BUG-063～066 的實作差異均在 test／fixture 層；`scripts/test-macos-signed-canary-gate.mjs:209-213` 改用 `os.tmpdir()`／`path.join()`，`scripts/test-macos-signed-canary-result.mjs:22-26`、`scripts/test-macos-signed-canary-distribution.mjs:9-13`、`scripts/test-macos-signed-canary-external-boundary.mjs:13-17` 只在 POSIX host 比對 `0600`。`scripts/test-macos-signed-canary-distribution.mjs:127-149` 將 `/usr/bin/zip`／`unzip` archive fixture 限定非 Windows，`:212-312` 將需要 POSIX mode／symlink／archive writer 的 fixture 限定非 Windows。
- 判定限制：這完成的是 Windows runner 的 cross-platform test portability 與 unsigned preview CI gate，不是 Windows 公開發行、Windows Authenticode、Windows 實機驗收、Google 真實帳號驗收或 Apple signed／notarized candidate。

## 2. 正確性

- 判定：通過（限 BUG-063～066 bounded source／test scope）
- 證據：四支 focused tests、完整 `npm run check` 與指定 Windows run 均通過。`git diff --name-only 4996a42..539d880` 顯示沒有 production audit／library／workflow source；`git show 539d880:scripts/audit-macos-signed-canary-distribution.mjs`、`git show 4996a42:scripts/audit-macos-signed-canary-distribution.mjs` 的 SHA-256 相同，result／external-boundary production audit 亦相同。
- BUG-063 的 path assertion 仍要求 absolute path／source-tree boundary；BUG-064／066 沒有把 production writer 改成接受錯誤 mode，而是只避免 Windows 以不可表達的 POSIX bits 產生 false failure。

## 3. 跨平台與安全

- 判定：通過（保留平台能力界線）
- 證據：production contract 未被放寬：`scripts/audit-macos-signed-canary-distribution.mjs:87-100` 仍要求 run-scoped absolute path、regular file、`0600`、Accepted／digest；`:136-150` 的 submitted archive binding 仍要求精確 run／temp basename、regular file 與 `0600`；`scripts/audit-macos-signed-canary-result.mjs:355` 與 `scripts/audit-macos-signed-canary-external-boundary.mjs:316-319` 仍使用 exclusive `wx`、mode `0600` writer。production distribution audit 仍由 `:277-288` fail-closed 要求 Darwin arm64。
- `node scripts/assert-macos-signed-canary-ready.mjs` 本輪 exit 1，安全摘要為 `ready:false`、`developer-id-application-not-ready`、`notarization-credential-set-not-ready`、`formalIdentityAvailable:false`、`notarizationStatus:absent`。因此没有把 Windows test portability 修正誤當成 Apple signing／notarization ready，也沒有 unsigned／ad-hoc fallback 被新差異放行。
- 邊界：Windows 不再執行需要 POSIX mode／macOS `/usr/bin/zip` 的 fixture；因此該 runner 不提供 macOS privacy-mode／archive tool 的實際證明，這是明示的測試環境限制，不是 production security contract 的改動。

## 4. 測試與 CI／artifact provenance

- 判定：部分通過
- 證據：`npm run project:preflight -- --type=full` exit 0；四支 `node --check`、四支 focused tests、`npm run docs:check`、完整 `npm run check` 與 `git diff --check` 均 exit 0。完整 check 輸出包含 signed-canary gate／result／distribution／external-boundary、YouTube suites、Ollama、UI 與 core regression。
- CI：`gh run view 41013639786 --json ...` 顯示唯一 Windows job 全部 package／renderer／install／archive／upload steps success，signed build skipped；GitHub API artifact read-back 與 upload log 的 ID、head SHA、size、name、digest 一致。
- provenance 界線：本輪核對了 GitHub artifact metadata、workflow log 與 artifact digest，但未將 504 MB artifact 下載到共享工作區或在本地重新展開／重算其內部七個檔案；因此這份證據只支持「同源 GitHub CI unsigned preview artifact 已產生」，不支持公開 Release asset 或獨立下載後內容核驗。

## 5. 治理／文件

- 判定：不通過（P1 closeout blocker；Release notes 邊界本身正確）
- 通過部分：基準 `RELEASE-NOTES-0.52.0.md:20-25`、`00:308-318` 與 `05:57` 如實維持 macOS-only、Windows 非公開資產、Google／Apple／UI 未完成等風險界線；它們沒有把 Windows CI runner pass 說成實機或正式 Release pass。審查後主要代理已在 shared workspace 未提交地補入 run／artifact 文字，但該回填不屬於基準 commit。
- 阻擋部分：OSF-052 最新 08 條目缺少 final closeout 欄位，且基準 HEAD 的 06／07 BUG-063～066 狀態尚未反映 run `41013639786`；詳見 `GOV-OSF052-01` 與 `GOV-OSF052-02`。

## 6. 剩餘風險與發布聲明

- 判定：有條件通過（僅限既有 macOS-only Release 與本次 Windows CI preview 的 bounded statement）
- 既有 v0.52.0 Release 可維持 macOS arm64-only 描述：GitHub Release API 顯示七項 macOS 資產、無 Windows 資產；tag `v0.52.0` 解析至 `b6b1efd6b72574f9210af74729d2cb2fd869e42d`，不是本輪 Windows preview 的 `539d880`。不得將 artifact `12958791997` 上傳／描述為既有 Release asset，除非另立工作項、取得涵蓋該操作的授權並完成下載／checksum／asset／Release notes 核對。
- Google OAuth／YouTube：release notes 明確說明真實 OAuth client、Keychain、個人頻道影片／字幕 upload E2E 尚未驗收；mock／SDK／lifecycle tests 不替代實帳號。這是如實揭露的外部阻塞，不是本輪可在無帳號／測試素材下補造的 pass。
- Apple：本輪 read-only readiness 仍 blocked；缺 Developer ID Application identity／完整 notarization credential，且 GitHub Environment／required reviewer／protected branch／受控 runner 的實際 signed workflow 未由本輪修改或觸發。不得宣稱 signed／hardened／notarized candidate、Apple ticket、stapler／Gatekeeper pass。
- UI／媒體：Release notes 與目前狀態仍明確說 packaged UI smoke 不等於有效播放、完整轉錄或 upload；Windows CI runner 的 renderer／installation lifecycle success 也不等於 Windows 實機驗收。
- 發布授權：`AUTH-2026-07-23-01` 只提供已知 Windows 未 Authenticode／macOS 未 Developer ID／未公證風險的常設接受，不能取代 OSF-052 最新條目所需的本次 closeout 欄位、artifact／Release 操作範圍與 final docs gate。

## 審查命令與結果

以下命令均在 2026-10-30（Asia/Taipei）本輪執行。審查開始時工作樹為 clean；報告建立後再次檢查時，shared workspace 出現主要代理並行回填的未提交 `README.md`、`RELEASE-NOTES-0.52.0.md`、`docs/project-management/00-CURRENT-STATUS.md`、`04`、`05`、`06`、`07` 變更。本審查代理未寫入這些檔案，且它們不屬於基準 HEAD `539d880`；除指定報告外，本審查代理沒有留下檔案變更：

- `npm run project:preflight -- --type=full`：exit 0。
- `git status --short --branch`、`git rev-parse HEAD`、`git ls-remote origin refs/heads/codex/0.51-anthropic-claude`：clean，local／remote 均為 `539d880`。
- `node --check` 四支 changed test、四支 `node scripts/test-macos-signed-canary-*.mjs` focused tests：全部 exit 0。
- `npm run docs:check`：exit 0；`npm run check`：exit 0；`git diff --check`：exit 0。
- `npm run docs:check:final`：exit 1，原因為最新 08 條目未完成、缺獨立審查欄位、缺發布授權欄位及有效核准範圍。
- `node scripts/assert-macos-signed-canary-ready.mjs`：exit 1，reasons 為 `developer-id-application-not-ready`／`notarization-credential-set-not-ready`。
- `gh run view 41013639786 ...`、`gh api repos/.../actions/artifacts/12958791997`、`gh run view 41013639786 --log`：run success，artifact metadata／upload digest／workflow log 一致。
- `gh release view v0.52.0 ...`、`gh api .../git/ref/tags/v0.52.0`、`gh api .../git/tags/faab81...`：公開 Release 七項 macOS arm64 資產，annotated tag commit 為 `b6b1efd`，無 Windows Release asset。

## 綜合判定

- 結論：有條件通過（technical／CI bounded scope；release-scope governance closeout pending）。
- 阻擋問題（若有）：P1 `GOV-OSF052-01`；在主要代理補齊 OSF-052 的 08 closeout 欄位並使 `npm run docs:check:final` 通過前，不得宣稱本輪 0.52.0 unfinished release-scope closeout 完成。P2 `GOV-OSF052-02` 亦應在同一 closeout 同步 06／07 的 CI follow-up。
- 已通過面向：BUG-063～066 的 source／test correctness、Windows CI portability、production fail-closed contract 保留、macOS-only Release／Windows preview 界線與 Google／Apple／UI 外部阻塞的如實發布聲明。
- 仍保留：Windows preview artifact 未公開、未 Authenticode／未 Windows 實機；真實 Google OAuth／Keychain／頻道 upload 未驗收；Apple signing／notarization／Gatekeeper 未完成；packaged UI 有效播放／完整轉錄未證明；本輪未做 artifact 下載後獨立內容重算。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 未修改產品 source、workflow、既有 evidence／review 或治理文件，未 stage／commit／push，未觸發 workflow、未修改 GitHub Environment／secret／reviewer／branch protection，未執行 builder／codesign／notarytool／stapler／Gatekeeper 或任何外部寫入。
- 若上述聲明不實，本報告無效。
