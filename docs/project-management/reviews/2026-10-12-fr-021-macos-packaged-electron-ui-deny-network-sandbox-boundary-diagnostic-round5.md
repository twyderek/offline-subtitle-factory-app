# 獨立審查報告：FR-021 replay11 Electron Framework 靜態身分補記

- 審查對象 commit／版本：工作樹目前 v0.51.0 文件與 evidence 更新；未以 commit 作為審查基準。
- 對應 08-CHANGE-LOG 條目：2026-10-01 — FR-021 macOS packaged Electron UI Seatbelt nested-profile 診斷（2026-10-12 唯讀 bundle identity 追加計畫）。
- 審查輪次：round5
- 審查代理啟動時間、上下文來源：2026-10-12 UTC；獨立 reviewer context，依需求方指示與主要代理分開執行，並非沿用主要代理對話記憶。實際驗證約於 08:09 UTC 完成。
- 審查範圍：`docs/project-management/evidence/2026-10-12-fr-021-replay11-electron-framework-identity.json`，以及 `00-CURRENT-STATUS.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`07-DEBUG-AND-FIX-HISTORY.md`、`08-CHANGE-LOG.md` 的對應內容。未擴展至 app、Ollama、網路或系統設定測試。

## 1. 需求完整性

- 判定：通過。
- 證據：新 evidence 記錄來源 replay、目前 bundle 路徑、bundle 版本／識別碼、replay 與目前 executable SHA-256、Framework 版本／SHA-256／mtime、deep code-signature 驗證結果及限制（evidence JSON 第 1–27 行）。主程式目前 SHA-256 `e872f406bfb64ced064cdf8efaf0ae329e0db82e3ac0d92a4b192da3963f80ec` 與 replay11 JSON 的 `candidate.executableSha256` 相同。指定文件均保留 FR-021 offline UI 尚未驗收、無 exact generated profile，亦不把靜態關聯稱為 root cause 或 replay-time provenance（00 第 12、15 行；07 第 6–8 行；08 第 20–22、30 行）。

## 2. 邏輯正確性

- 判定：通過，有明確的證明界線。
- 證據：目前保留 bundle 的 executable hash 與 replay11 相同，足以識別此為 executable-hash-matching 的 bundle copy；不能單獨證明 replay 時實際使用了該 bundle path，也不能證明當時載入的 Framework bytes。Evidence limitations 第 24–26 行正確保留上述限制。相同的檔案 mtime 和現在的簽章驗證不等於 replay-time provenance。

## 3. 邊界情況

- 判定：部分通過；有一處文件措辭需釐清。
- 證據：replay11 JSON 有 `candidate.executableSha256`、bundle version／identifier，但沒有 source commit、build provenance、bundle path 或 Framework hash；JSON 的 top-level keys 與 candidate 欄位已實際解析確認。新 evidence 沒有據此推導 replay-time Framework 身分、exact generated profile、root cause 或 UI acceptance。
- 需修正的表述：`06-TEST-AND-PROCESS-AUDIT.md` 第 23 行「亦未核驗失敗候選內 Chromium framework hash」及第 26 行「候選內 framework hash……仍缺」沒有區分「已量測目前 executable-hash-matching bundle」與「尚未證明 replay-time Framework bytes／hash／provenance」。建議明確寫成「目前 hash-matching bundle 的 Framework hash 已量測；replay-time exact Framework hash／identity／provenance 仍未驗證」。這避免舊句被理解為本輪連目前 bundle 的 Framework 都未檢查，也不擴張本輪證據。

## 4. 文件／程式品質

- 判定：部分通過（文件內容整體清楚；06 有上述一致性修正建議）。
- 證據：evidence 對 observed value 與 replay-time limitation 分欄敘述，00、07、08 也已明確說明目前 Framework hash 僅是靜態測量。這次沒有程式碼變更，故不評定程式碼品質。06 的兩處舊措辭應與新 evidence 及其他文件同步精確化。

## 5. 測試覆蓋

- 判定：通過（限本輪文件／靜態 bundle identity 範圍）。
- 證據：本 reviewer 於 2026-10-12 約 08:09 UTC 執行 `npm run docs:check`，19 份治理文件通過；`git diff --check` exit 0；以 Node.js 分別解析新 evidence 與 replay11 JSON 並核對 hash；replay11 candidate hash 與磁碟 executable SHA-256 相符；讀取 app／Framework plist 欄位、檢查兩檔 mtime，並執行 app `codesign --verify --deep --strict` 及 Framework `codesign --verify --strict`，兩者皆 exit 0。這些檢查不包含 UI／offline acceptance。

## 6. 實際運行結果

- 判定：通過（只讀檢查）。
- 證據：目前 bundle 的 Framework `CFBundleVersion` 為 `43.3.0`，binary SHA-256 為 `a6763870b706a065d621935435d82ea206747192b3948c8b17b7f5e2930c758a`；Framework 與主 executable 的 mtime 均為 `2026-09-22 15:21:23 CST`。App deep strict signature verification 與 Framework signature verification 均回報 valid／exit 0。這些是目前磁碟狀態的測量，不是 replay 當時載入內容的觀察。本 reviewer 未啟動 app／Ollama，未做 socket／network probe，未更改系統設定。

## 綜合判定

- 結論：有條件通過。
- 阻擋問題：無證據完整性阻擋；建議主要代理修正 `06-TEST-AND-PROCESS-AUDIT.md` 第 23、26 行的舊措辭，使它精確表達 replay-time Framework identity/hash/provenance 未驗證，而非暗示目前 matching bundle 的 Framework hash 未測量。
- 剩餘風險：replay11 沒有 bundle path、Framework hash、source commit 或可驗證 build provenance；目前 Framework hash、mtime 及簽章結果不能證明 replay-time bytes。Exact generated profile、root cause、外連受控下的 packaged UI acceptance 均未驗證。
- 給主要開發代理的具體修正要求：依上列建議釐清 06 第 23、26 行；保留「replay-time exact Framework bytes／provenance 未證明」及 FR-021 acceptance 未完成的限制。此報告不代表要求或授權 app／網路測試。

## 審查代理聲明

- 本審查代理除建立本報告外，僅讀取文件／evidence 並執行上述唯讀驗證，未修改任何其他專案檔案。
- 未啟動 app／Ollama，未執行網路探測，未變更系統設定。
- 若上述聲明不實，本報告無效。
