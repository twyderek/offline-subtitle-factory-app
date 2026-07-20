# 獨立審查報告：補強獨立審查證據與發布授權治理

- 審查對象 commit／版本：`f781acbc14b61f7427c034bbe42f9e75804d6835` 工作樹差異／`0.45.1`（分支 `main`）
- 對應 08-CHANGE-LOG 條目：2026-07-20 — 補強獨立審查證據與發布授權治理
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-07-20 11:13 Asia/Taipei；延續 round1 的相同獨立審查角色，由主要代理提供修正後差異與四項阻擋複審要求，未取得或沿用主要開發代理的評價性結論。
- 審查環境：macOS sandbox；Node.js `v22.22.3`、npm `10.9.8`。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:39-41` 的 `NFR-006` 要求自動測試、文件檢查與獨立審查完成，`NFR-008` 要求發布完整性。
  - `docs/project-management/08-CHANGE-LOG.md:53` 已依 round1 發現的流程行為影響，將變更由低升為中並記錄原因，符合 `docs/project-management/01-PROJECT-GOVERNANCE.md:25` 的分類升級規則。
  - `docs/project-management/01-PROJECT-GOVERNANCE.md:34-56` 與 `docs/project-management/08-CHANGE-LOG.md:85-86,104-105` 仍清楚區分獨立報告、歷史缺口、需求動作與風險授權，未補造歷史證據。
  - `scripts/project-docs-validator.mjs:12-30` 已新增報告命名、六面向判定／證據、完整結論句、阻擋欄位與聲明驗證；`:55-58` 已新增跳過審查的等級、原因及同意記錄驗證；`:61-67` 已改為解析發布授權區塊。這些修正覆蓋 round1 阻擋的主要方向。
  - 但 `scripts/project-docs-validator.mjs:36-39,46-53,61-67` 仍可讓未完成事項、已不通過的 round1 及籠統「使用者要求發布」通過，核心成功條件尚未完整達成。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - `scripts/project-docs-validator.mjs:37` 只把「待執行」後接空白或行尾視為未決；中文欄位值 `待執行獨立審查`（`docs/project-management/08-CHANGE-LOG.md:69`）在「待執行」後直接接中文字，未被識別。
  - 2026-07-20 11:15 Asia/Taipei 以記憶體把最新條目的 `狀態：進行中` 單獨替換成 `狀態：完成`，再呼叫 `validateLatestEntry(latest, round1Report)`，實際輸出 `status-only-completed: []`。這證明即使遺留風險仍明載「待執行獨立審查」，final gate 仍可放行。
  - `scripts/check-project-docs.mjs:61` 與 `scripts/project-docs-validator.mjs:47,52` 都用第一次 regex 命中審查檔與判定；最新工作紀錄已有 round1（`docs/project-management/08-CHANGE-LOG.md:64-66`），後續新增 round2 時仍會先讀取與比對 round1。
  - `scripts/project-docs-validator.mjs:25-28` 僅確認綜合結論是三種合法字串及存在阻擋欄位，沒有要求 final gate 的最新審查結論必須為「通過／可接受的有條件通過」、也未阻擋「不通過」。上述同一記憶體實測把 round1 不通過報告當作 reviewContent，仍回傳空錯誤。
  - `scripts/project-docs-validator.mjs:63-67` 驗證發布授權欄位存在及風險關鍵字，但沒有禁止治理明文排除的籠統需求動作。2026-07-20 11:15 Asia/Taipei 的記憶體 fixture 使用 `核准範圍：使用者要求發布`，實際輸出 `generic-request-as-auth: []`，違反 `docs/project-management/01-PROJECT-GOVERNANCE.md:43,55`。

## 3. 邊界情況

- 判定：不通過
- 證據：
  - 已通過邊界：`scripts/test-project-docs-validator.mjs:6-14` 實測敘述性保留字、空報告證據、錯誤 round 路徑、未授權跳過、發布欄位錯置及風險範圍缺漏；2026-07-20 11:15:23 Asia/Taipei 執行後輸出「治理文件驗證器測試通過」。
  - 未覆蓋且實際失敗的邊界：欄位值以 `待執行` 開頭但後接中文字；同條工作紀錄有多輪審查；最新被選中的審查結論為不通過；發布核准範圍只有「使用者要求發布」。前述兩個記憶體測試都錯誤回傳 `[]`。
  - `scripts/project-docs-validator.mjs:67` 只要最新條目出現任一發布風險，核准範圍含任一風險詞即通過；若條目同時揭露「未簽章、未公證、未實機測試」，範圍只接受其中一項仍可放行，尚未逐項比對實際風險集合。
  - `scripts/check-project-docs.mjs:63-65` 在驗證檔名及 reviews 目錄之前就對 `path.resolve(root, reviewPath)` 讀檔；雖後續 validator 會報錯且目前是只讀操作，仍應先驗證規定路徑再存取，避免不必要讀取目錄外檔案。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - 新增 `scripts/project-docs-validator.mjs` 將結構驗證從 I/O 腳本分離，`scripts/check-project-docs.mjs:4,70` 只負責載入與聚合錯誤，較 round1 容易測試與維護。
  - `package.json:16-17` 已把治理 fixture 放入 `npm test`，因此一般 `npm run check` 會自動執行。
  - 2026-07-20 11:15:23 Asia/Taipei 執行三支治理腳本的 `node --check` 均通過；`git diff --check` 通過。
  - 然而「首筆 regex 命中」分散在 `scripts/check-project-docs.mjs:61` 與 `scripts/project-docs-validator.mjs:47,52`，缺少明確的審查輪次選擇模型；`sectionValue` 已顯示可解析區塊，審查結論亦應採相同結構化方法，否則多輪流程必然歧義。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-20 11:15:23 Asia/Taipei：`node scripts/test-project-docs-validator.mjs` 通過；`npm run docs:check` 通過；`git diff --check` 通過。
  - 同次 `npm run docs:check:final` 只回報「最新工作紀錄尚未標示完成」。未再把敘述中的保留字誤判為未決，round1 的誤判已改善；但沒有回報 `docs/project-management/08-CHANGE-LOG.md:69` 的實際「待執行獨立審查」，證明存在相反方向漏判。
  - 2026-07-20 11:15:32 Asia/Taipei：sandbox 內 `npm run check` 的文件、語法、治理 fixture、媒體、AI optimizer、provider、校閱 UI 均通過；核心測試因監聽 `127.0.0.1:21435` 遭 sandbox `EPERM` 中止。
  - 隨後經授權於 sandbox 外執行 `npm test`，同日 11:15 Asia/Taipei 全部通過，包含治理 fixture 與核心 API／任務回歸。
  - `scripts/test-project-docs-validator.mjs:4-14` 僅有約六組 fixture，沒有 round1 要求中極關鍵的多輪審查與最終結論關卡，也沒有「待執行」後接中文、籠統需求動作充當授權、多個風險僅接受一個等負向案例；fixture 覆蓋仍不足以防止目前漏判。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 2026-07-20 11:13 Asia/Taipei 執行 `npm run project:preflight` 成功，辨識版本 `0.45.1`、分支 `main` 與既有工作樹變更。
  - 2026-07-20 11:15:23 Asia/Taipei 的一般文件檢查與治理 fixture 成功；final 目前因狀態仍為進行中而失敗，此「狀態未完成」為預期失敗。
  - 同一 final 輸出沒有再包含敘述性「待確認／待執行」誤判，這部分 round1 修正有效；但也沒有辨識真實欄位 `遺留風險與後續事項：待執行獨立審查`，屬漏判。
  - 2026-07-20 11:15 Asia/Taipei 的兩個只讀記憶體情境實測分別輸出 `status-only-completed: []` 與 `generic-request-as-auth: []`；證明只改狀態即可繞過未完成審查，且籠統發布要求可被誤當發布授權。
  - sandbox 外 `npm test` 全部通過，既有字幕產品行為未見回歸；本次不涉及打包、部署或 Release，NFR-008 的實際資產一致性不在本輪運行範圍。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪 round2 獨立審查結論為不通過：round1 的敘述性保留字誤判、基本報告結構、跳過審查與授權區塊檢查已有改善，但 final gate 仍會漏判「待執行獨立審查」、優先採用 round1 不通過報告而忽略後續輪次，並接受「使用者要求發布」作為發布授權，因此四項阻擋尚未全部解除。**
- 阻擋問題（若有）：
  1. 修正未決欄位解析：欄位值以「待執行」開頭即應阻擋，並新增 `待執行獨立審查` 等後接中文字 fixture；同時保留敘述性引用不誤判。
  2. 結構化解析同一條目的每輪審查，明確選擇最高／最新 round；final gate 必須拒絕最新結論「不通過」，並驗證有條件通過的條件與接受狀態，不能永遠取第一個 round。
  3. 發布授權須明確拒絕只有「使用者要求打包／發布」的核准範圍，並逐項確認條目揭露的未簽章、未公證、未實機測試等每一風險都被核准範圍涵蓋。
  4. 擴充 fixture 覆蓋上述三項，以及多輪中 round1 不通過／round2 通過與相反順序、路徑先驗證後讀取；修正後重新執行完整門檻並進行 round3 複審。
- 剩餘風險：自動化只能驗證格式與明示文字，無法證實核准人身分或證據真實性，仍須人工查核；變更分類是否應升級亦有人工判斷成分。本次已正確由低升為中，但檢查器本身無法自動證明分類合理。
- 給主要開發代理的具體修正要求（若有）：依四項阻擋問題修正 validator、I/O 選擇邏輯及 fixture；完成後重跑三支治理腳本語法檢查、治理 fixture、`npm run docs:check`、結案情境、`npm run check`、`git diff --check`，並建立 round3 新報告複審，不得修改 round1 或 round2。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
