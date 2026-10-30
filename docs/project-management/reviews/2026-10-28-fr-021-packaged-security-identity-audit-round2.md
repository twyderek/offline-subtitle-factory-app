# 獨立複審報告：FR-021 packaged Electron helper signing／entitlement audit

- 審查對象 commit／版本：目前工作樹、專案版本 `0.52.0`、分支 `codex/0.51-anthropic-claude`；本輪未指定 commit，既有 dirty worktree 均予保留。
- 對應 08-CHANGE-LOG 條目：2026-10-28 — packaged Electron helper signing／entitlement audit（`FR-021-DEBUG-20261028-PACKAGED-SECURITY-IDENTITY-AUDIT`）。
- 審查輪次：round2（針對 round1 F-01 的獨立六面向複審）。
- 審查上下文與限制：重新只讀核對 round1 報告、`scripts/audit-macos-packaged-security-identity.mjs`、`scripts/test-ollama-ui-offline.mjs`、audit1／audit2／audit3 evidence 與治理文件；未執行 packaged app、UI、Electron replay、network、Ollama 或模型，未修改任何非本報告檔案。

## 1. 需求完整性

- 判定：通過
- 證據：audit3 保存完整 helper inventory 與 scope metadata，且本 audit 的範圍仍明確排除 runtime、UI、network、Ollama／model 與 FR-021 完整驗收。
- round1 F-01 已由目前 source 修正：`scripts/audit-macos-packaged-security-identity.mjs:107-113` 以 `Frameworks` 目錄中所有 `.app` 結尾項目建立排序後 inventory，不再只依固定 helper 名稱選取；同時計算 expected、missing、unexpected，並只將 expected 項目送入 code-object inspection。
- evidence `docs/project-management/evidence/2026-10-28-fr-021-packaged-security-identity-audit3.json:181-203` 保存 `frameworkAppEntries`、`expectedHelperBundleNames`、`missingHelperBundleNames`、`unexpectedHelperBundleNames`；本次為 4 個預期 helper、missing／unexpected 皆為空，`helperInventoryComplete=true`。
- audit3 的 scope 仍限定為 read-only identity audit；沒有把 inventory 修正擴大為 runtime、UI、network、Ollama／model 或 FR-021 完整驗收。

## 2. 邏輯正確性

- 判定：通過
- 證據：source `scripts/audit-macos-packaged-security-identity.mjs:107-113` inventory 所有 Frameworks `.app`，`:167` 將 `helperInventoryComplete` 納入 pass gate；audit3 六個 object 的 verification、code-sign 與 entitlement command 均成功。
- `missingHelperBundleNames.length !== 0` 或 `unexpectedHelperBundleNames.length !== 0` 時，`helperInventoryComplete` 為 false；`scripts/audit-macos-packaged-security-identity.mjs:167` 將其納入 status pass gate，因此非匹配或缺失 helper 會 fail-closed，不會靜默產生 pass。
- `objects` 仍只包含主 app、Electron Framework 與 inventory 中的 expected helper；`allVerified` 要求每個 object 的 verification、code-sign command 與 entitlement command 均成功。audit3 `objects` 長度為 6，6 個 object 均 `verification.succeeded=true`、`codeSign.commandSucceeded=true`、`entitlements.commandSucceeded=true`。
- audit3 的 6 個 object、candidate、source build config、scope 與 interpretation 與 audit2 對應欄位完全一致；audit3 只新增 inventory 欄位與修正後的 authoritative 結果，不把 helper coverage 誤報成 nested Chromium 根因或 UI pass。
- F-01 結論：已修正，無目前可升級的 correctness／safety finding。

## 3. 邊界情況

- 判定：通過
- 證據：source `scripts/audit-macos-packaged-security-identity.mjs:95-96,170` 以 evidence path guard、既有檔案拒絕與 exclusive `wx` 建立不可覆寫的去敏 evidence；audit3 scope/privacy metadata 全部符合 read-only 邊界。
- source 在 `scripts/audit-macos-packaged-security-identity.mjs:95-96` 拒絕 evidence 目錄外／非 JSON 路徑並拒絕既有輸出，`170` 再用 `flag: 'wx'`、`mode: 0o600` 建立 evidence；audit3 不會覆寫 audit1 或 audit2。
- 本輪觀察到 audit1、audit2、audit3 是三個獨立存在的六-object JSON 檔，SHA-256 分別為 `c460ebfef14ef27e67194cb53f275d2657d526464f119ef6cf57274149d813d7`、`e9ff41290d452734ba4984005edadd44368f36284eee9910f6ef729cc6a8dc85`、`fc18682da1b669f09650a068db623dca2102e4c0b2e2eb4b303feba126bb46d0`；audit3 的建立時間晚於 audit1／audit2，路徑不同，未發現原件被覆寫。
- audit3 的 objects 保存 binary／diagnostic digest、CDHash、identifier、flags、verification 與 entitlement presence／digest／byte count，不保存 raw code-sign output 或 entitlement XML；`scope` 明確記錄 candidate 未修改、未建立 network、未執行 packaged app／UI、未啟停既有 Ollama、未下載模型、未落盤 raw output／絕對路徑（`audit3:205-213`）。

## 4. 程式碼品質

- 判定：通過
- 證據：`scripts/test-ollama-ui-offline.mjs:361-369` 已有 deterministic source assertions，且本輪 `node --check scripts/audit-macos-packaged-security-identity.mjs` 與 audit2／audit3 normalized evidence comparison 均通過；這只確認 source/evidence contract，不等同 runtime acceptance。
- deterministic source assertions 已存在於 `scripts/test-ollama-ui-offline.mjs:361-369`：固定 code-sign／entitlement 檢查、read-only／raw-output exclusion、exclusive create、Frameworks `.app` inventory、unexpected helper 保存、helper inventory fail-closed，以及禁止 sandbox disabling flags。
- 本輪已唯讀執行 `node --check scripts/audit-macos-packaged-security-identity.mjs`；通過。另以 JSON assertions 核對 audit3 status、6 objects、4 helpers、inventory complete、expected／missing／unexpected 欄位與全部 scope／privacy flags；通過。audit2／audit3 的 candidate、sourceBuildConfig、objects、scope、interpretation normalized comparison 完全一致。
- 本輪依使用者限制未執行 focused runtime test、packaged app、UI、Electron replay、network、Ollama 或模型；因此本複審只確認 deterministic source contract 與已保存 evidence，不宣稱 runtime reproduction。

## 5. 測試覆蓋

- 判定：通過
- 證據：08 work item 與 00／03／05／06／07／08 文件已記錄 audit3 authoritative evidence、round1 F-01 修正及 bounded scope，並保留 audit1／audit2 原件與 final governance gate 要求。
- 08 work item 已先建立，並已記錄 audit3 authoritative evidence、round1 F-01、修正後的 inventory／fail-closed 行為、scope 與尚未完成的 final checks；00／03／05／06／07／08 均維持「packaging follow-up signal，不是 root cause、sandbox workaround、UI acceptance 或 FR-021 completion」的界線。
- audit1 保留為 parser 修正前原件，audit2 保留為 round1 baseline，audit3 作為 inventory 修正後 authoritative evidence；文件沒有以 audit1 的舊 parser 結果覆寫或反向改寫後續 evidence。
- 本報告本身只新增 round2 review；主要代理仍須在本報告整合後完成治理 validator、完整 checks、immutable／scope guard、`git diff --check` 與 `npm run docs:check:final`，再決定 work item 的 bounded closeout 狀態。

## 6. 實際運行結果

- 判定：部分通過
- 證據：audit3 status 為 `pass` 且 6 個 objects／helper inventory／scope metadata 均核對通過，但 evidence 明確保留 ad-hoc packaging 與未執行 runtime 的 bounded scope。
- F-01 的 inventory coverage、expected／missing／unexpected 保存與不完整時 fail-closed 已由 source、deterministic assertions 與 audit3 共同支持；本輪 findings 為 none。
- 仍有非本 finding 的界線：目前 bundle 仍是全 ad-hoc、無 Team ID、無 entitlement，source config 仍為 `identity: null`、`hardenedRuntime: false`、`gatekeeperAssess: false`；這只能支持另立正規 signed／hardened packaging canary，不證明 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` 的唯一根因。
- audit3 不是 packaged renderer readiness、UI offline、全機 egress、Windows 或 FR-021 完整驗收。後續若進行 packaging canary，必須另建隔離 candidate 與新的 exclusive evidence，保留 renderer sandbox，不得使用 `--no-sandbox`、`ELECTRON_DISABLE_SANDBOX` 或放寬 network policy 取得假 pass。

## Findings

- none（round1 F-01 已修正並由本輪 source／evidence／deterministic assertions 複核通過）。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無新的 F-01 阻擋問題；本 bounded audit 仍不能轉化為 FR-021 完整驗收，且主要代理尚須完成 final governance gate。
- 本輪條件是否已被需求方接受：是；接受範圍僅為 packaged security identity audit 的 F-01 修正與 bounded closeout，不代表 packaged UI、全機 egress、Windows 或 FR-021 完整驗收。
- 發布授權：不適用；本輪未建立或發布任何資產。
- 可逐字引用的完整結論句：**本輪 FR-021 packaged security identity audit round2 獨立複審通過 round1 F-01 修正：目前 source 已 inventory Frameworks 下所有 `.app`，保存 expected／missing／unexpected helper names，並在非匹配或缺失時以 `helperInventoryComplete` 使 status fail-closed；audit3 的 6 個 objects、helper inventory、scope／privacy metadata 與 audit2 對應欄位一致，audit1／audit2 原件均保留且未被覆寫，deterministic source assertions 已存在；但目前 evidence 仍只證明 read-only packaging identity metadata，不能宣稱 nested Chromium 唯一根因、packaged UI offline pass、全機 egress、Windows 或 FR-021 完整驗收。**

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
