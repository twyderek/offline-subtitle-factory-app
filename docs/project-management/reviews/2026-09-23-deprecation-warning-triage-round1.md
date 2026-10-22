# npm／Node deprecation warning 依賴來源分流獨立審查

- 審查日期：2026-09-23
- 審查性質：獨立、只讀審查；唯一建立檔案為本報告
- 審查來源：目前工作樹最新 diff、`AGENTS.md`、`08-CHANGE-LOG.md` 最新條目、`00-CURRENT-STATUS.md`、`06-TEST-AND-PROCESS-AUDIT.md`、`package.json`、`package-lock.json`
- 審查範圍：確認 deprecation warning 的依賴來源分流與「本輪不修改依賴／不加 overrides」決策；不執行依賴升級、lockfile 重寫、workflow／Release 變更或 Windows 實機驗收

## 1. 需求完整性

- 判定：通過
- 證據：最新工作樹的本輪變更僅為 `docs/project-management/08-CHANGE-LOG.md` 的 triage 紀錄；`package.json`、`package-lock.json`、`.github/workflows` 與產品程式碼沒有本輪變更。紀錄明確將 `inflight`、`glob`、`rimraf`、`boolean` 的來源追溯、`punycode` 缺席、`npm audit=0` 及不加 overrides 列為驗收條件，並將依賴升級、lockfile 重寫、產品／Release 變更與 Windows 實機列為範圍外。
- 證據：`git diff --name-only` 僅列出 `docs/project-management/08-CHANGE-LOG.md`；`git diff --quiet -- package.json package-lock.json .github/workflows` 退出碼為 0，表示依賴 manifest、lockfile 與 workflow 未被修改。

## 2. 邏輯正確性

- 判定：通過
- 證據：`npm explain inflight --all` 顯示 `inflight@1.0.6` 經 `glob@7.2.3`、`@electron/asar@3.4.1`、`@electron/universal@2.0.3`、`app-builder-lib@26.15.7` 追溯至 `electron-builder@26.15.7`；另一路經 `rimraf@2.6.3`、`temp@0.9.4`、`electron-winstaller@5.4.0`、`electron-builder-squirrel-windows@26.15.7` 回到同一 builder toolchain。
- 證據：`npm explain glob --all` 確認 `glob@7.2.3` 位於 `@electron/asar` 與 Windows installer 相關 transitive chain；`npm explain rimraf --all` 確認 `rimraf@2.6.3` 經 `temp`、`electron-winstaller`、`electron-builder-squirrel-windows` 隸屬 `app-builder-lib@26.15.7`／`electron-builder@26.15.7`；`npm explain boolean --all` 確認 `boolean@3.2.0` 經 `global-agent`、`@electron/get` 位於 `app-builder-lib@26.15.7` 的 builder toolchain。
- 證據：`npm explain punycode --all` 沒有找到任何相依來源；`npm ls punycode --all --json` 未列出該套件，且 `rg -n 'punycode' package.json package-lock.json` 無結果。`npm audit --json` 退出碼為 0，漏洞總數為 0（info／low／moderate／high／critical 均為 0）。因此目前證據支持：這些是上游 transitive deprecation warning 來源，不是本專案直接依賴，也沒有被 `npm audit` 判定為 vulnerability；在沒有安全、最小且已驗證的上游升級路徑前，不修改依賴或加入 overrides 是合理且安全的範圍內決策。

## 3. 邊界情況

- 判定：部分通過
- 證據：目前依賴樹證明的是安裝後的 dev／optional builder toolchain 來源，不代表 warning 已消失，也不代表所有未來版本、不同 npm 解析結果或 production-only 安裝都會呈現相同樹。`rimraf` 的 Windows installer 路徑、`glob`／`inflight` 的 asar／universal 路徑及 `boolean` 的 Electron download／global-agent 路徑已分別核對；`punycode` 則確認不在專案依賴樹。
- 證據：本輪沒有執行依賴升級、`npm install` 重解析、Electron／electron-builder 升級或 Windows runner／實機驗收，因此不能把目前的來源分流延伸成「warning 已修復」或「Windows 已完成」。若日後 `electron-builder`／`app-builder-lib` 發布移除 deprecated transitive packages，或 npm／Node 對 warning 行為改變，應重新執行 `npm explain`、audit 與回歸檢查。

## 4. 程式碼品質

- 判定：通過
- 證據：本輪沒有產品程式碼、依賴宣告、lockfile、workflow 或 Release 檔案變更，沒有以局部 overrides 掩蓋上游來源的做法；`package.json` 仍以 `electron-builder@26.15.7` 作為既有 devDependency，`package-lock.json` 維持 lockfileVersion 3 的一致解析結果。
- 證據：`git diff --check` 退出碼為 0；`npm run docs:check` 通過（19 個治理文件，版本 0.51.0）。目前唯一治理收尾缺口是 `npm run docs:check:final` 仍退出碼 1，因最新 changelog 條目尚未標示「完成」且尚缺本獨立報告的可解析引用；這是審查完成後的文件收尾事項，不是依賴來源判定錯誤。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：已執行 `npm run check`，退出碼為 0；其中包含 Whisper fallback／models／download／SRT、Breeze ASR、Electron main、preflight／standing auth／docs validator、media edit／bilingual／quality、Whisper quality、AI fetch／optimizer／providers、Ollama streaming、review UI 與 core regression 等既有測試，完整檢查通過。
- 證據：已執行 `npm ls electron-builder app-builder-lib builder-util builder-util-runtime inflight glob rimraf boolean punycode --all --depth=20 --json`（退出碼 0）、四組 `npm explain ... --all`、`npm explain punycode --all`、`npm ls punycode --all --json`、`npm audit --json`、`git diff --check` 與依賴／workflow diff guard。這些足以驗證來源分流與安全性決策，但本輪沒有重新捕捉完整 npm／Node deprecation warning 原文，也沒有驗證上游修復；因此測試結論不延伸為 warning 已消失。

## 6. 實際運行結果

- 判定：部分通過
- 證據：目前安裝樹的 `npm explain` 結果可重現四個套件均在 `electron-builder@26.15.7` 相關 transitive toolchain 下；`punycode` 不在 `package.json`／`package-lock.json` 或 npm 依賴樹；`npm audit` 報告 0 vulnerabilities；`npm run check` 全部通過。這支持「本輪不改依賴、不加 overrides」的決策，並確認 deprecation warning 應以維護性／上游來源處理，而非誤報為 vulnerability。
- 證據：沒有執行 `npm install`／lockfile 重建、上游版本升級、Windows runner 或 Windows 實機驗收，也沒有 push、tag 或 Release 操作；因此只能宣稱來源已分流與現有回歸通過，不能宣稱 warning 已消失、CI 已以新依賴驗證或 Windows 已驗收。

## Findings

- F-001（低，治理收尾）：`npm run docs:check:final` 目前不通過，因最新 `08-CHANGE-LOG.md` 條目仍是「進行中」，且尚未有本獨立報告的可解析引用。此問題不影響本輪依賴來源與 `npm audit=0` 判定，但在主要代理完成文件收尾前不能宣稱 final governance gate 已通過。
- F-002（資訊揭露，非阻擋）：本輪未重新捕捉 warning 原文或驗證上游版本已移除 warning；已驗證的是目前 lockfile／node_modules 的來源鏈與安全掃描結果。因此本報告明確不把 deprecation warning 稱為 vulnerability，也不把來源分流稱為 warning 修復。
- 阻擋問題：無依賴安全或產品程式碼阻擋問題；僅有 F-001 的文件收尾缺口待主要代理處理。

## 綜合判定

- 結論：有條件通過；條件是保留本輪不修改依賴／不加 overrides 的決策，並由主要代理補完成 changelog 的完成狀態與本報告引用後再重跑 final governance gate。現有證據足以支持來源分流與 `npm audit=0` 的安全判定，但不代表 deprecation warning 已消失，也不包含 Windows runner／實機驗收或任何 Release 宣稱。
- 可逐字引用完整結論句：**本輪 npm／Node deprecation warning 依賴來源分流的證據足以支持不修改 package.json／package-lock.json、不加 overrides 的安全決策：inflight／glob／rimraf／boolean 均可由 electron-builder@26.15.7 的 app-builder-lib／Windows packaging transitive toolchain 追溯，punycode 不在專案依賴樹，npm audit 為 0 且完整 npm run check 通過；本輪未發現產品／workflow／Release 變更，但 warning 仍屬上游 deprecation 提示而非 vulnerability，後續仍須在上游版本變更時重新評估。**
- 阻擋問題（若有）：無依賴安全或產品程式碼阻擋問題；僅需由主要代理完成文件 final gate。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
