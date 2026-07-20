# 獨立審查報告：補強獨立審查證據與發布授權治理

- 審查對象 commit／版本：`f781acbc14b61f7427c034bbe42f9e75804d6835` 工作樹差異／`0.45.1`（分支 `main`）
- 對應 08-CHANGE-LOG 條目：2026-07-20 — 補強獨立審查證據與發布授權治理
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-07-20 11:18 Asia/Taipei；延續 round1／round2 的相同獨立審查角色，由主要代理提供 round2 四項阻擋的複審範圍，未沿用主要代理的評價性結論。
- 審查環境：macOS sandbox；Node.js `v22.22.3`、npm `10.9.8`。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:39-41` 定義 `NFR-006` 的自動測試、文件檢查與獨立審查，以及 `NFR-008` 的發布完整性。
  - `docs/project-management/08-CHANGE-LOG.md:53` 已記錄由低升中的分類與原因，符合 `docs/project-management/01-PROJECT-GOVERNANCE.md:25` 的變更分類升級規則；本次仍不涉及產品行為或實際發布。
  - round2 第 72 行的中文字尾問題已由 `scripts/project-docs-validator.mjs:42-43` 修正；第 73 行的最高 round 與不通過關卡主要由 `:34-36,52-60` 實作；第 74 行的逐項發布風險由 `:68-76` 實作；第 75 行的 fixture 與路徑先驗證由 `scripts/test-project-docs-validator.mjs:8-22`、`scripts/check-project-docs.mjs:61-73` 實作。
  - 但「拒絕未接受條件」與「需求動作不等於風險授權」仍可透過文字歸屬／措辭變形繞過，故 round2 四項阻擋尚未全數解除。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - `scripts/project-docs-validator.mjs:34-36` 會選最高 round，且 `:58-59` 會拒絕該報告的「不通過」，這部分邏輯正確。
  - 然而 `scripts/project-docs-validator.mjs:60` 對有條件通過使用全條目 `/條件是否已被需求方接受：是/`，沒有綁定最高 round。2026-07-20 11:20 Asia/Taipei 的只讀記憶體測試建立「round1 接受：是、round2 接受：否」，並以 round2 有條件通過報告呼叫 `validateLatestEntry`，實際輸出 `stale-condition-acceptance: []`；舊輪接受狀態錯誤掩蓋最新輪未接受條件。
  - `scripts/project-docs-validator.mjs:74` 只拒絕完全符合 `使用者要求發布`、`需求方要求打包` 等狹窄字串。2026-07-20 11:20 Asia/Taipei 使用 `核准範圍：需求方要求進行發布。` 的記憶體 fixture，實際輸出 `expanded-generic-action: []`，仍把籠統需求動作當成風險授權，違反 `docs/project-management/01-PROJECT-GOVERNANCE.md:43,55`。
  - 同次對精確字串 `使用者要求發布` 的 fixture 輸出 `exact-generic-action: ["發布授權範圍不能只記錄需求方要求打包或發布"]`，證明新增規則有作用但覆蓋面不足。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - `scripts/test-project-docs-validator.mjs:8` 已實測 `待執行獨立審查` 的中文字尾；`:18-22` 已實測 round2 高於 round1及不通過結論；`:15-17` 已實測單一發布風險及精確籠統授權；2026-07-20 11:20:04 Asia/Taipei fixture 全部通過。
  - `scripts/project-docs-validator.mjs:75-76` 逐一巡覽 `未簽章`、`未公證`、`未實機測試`，能防止只接受其中一項就涵蓋全部風險，解除 round2 的集合比對問題。
  - `scripts/check-project-docs.mjs:65-73` 先以檔名 validator 檢查規定 reviews 路徑，通過後才讀檔；round2 的路徑先驗證要求已解除。
  - 未覆蓋邊界包括：舊 round 接受／新 round 拒絕、`要求進行發布`、帶標點或空白、`請求打包` 等語意等價需求動作。上述前兩項已實測為漏判。
  - `scripts/test-project-docs-validator.mjs:21-22` 僅測「不通過」，沒有任何「有條件通過且最新 round 未接受」fixture；`:16-17` 只測唯一精確的 `使用者要求發布`。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - `scripts/project-docs-validator.mjs:34-36` 將 round 解析集中為 `latestReviewReference`，`scripts/check-project-docs.mjs:61-75` 重用相同 reference，避免 I/O 與 validator 選到不同輪次，結構較 round2 清楚。
  - `scripts/check-project-docs.mjs:65-67` 使用既有報告 validator 先做路徑規格檢查，才在 `:68-72` 讀檔，消除 round2 指出的先讀後驗證。
  - 2026-07-20 11:20:04 Asia/Taipei 執行 `node --check` 檢查 `project-docs-validator.mjs`、`test-project-docs-validator.mjs`、`check-project-docs.mjs`，三者均通過；`git diff --check` 通過。
  - 仍以全條目 regex 搜尋條件接受狀態及以狹窄字面 regex 判斷籠統授權，與已建立的 round reference／區塊解析方式不一致，是本輪兩個漏判的直接原因。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-20 11:20:04 Asia/Taipei：三支治理腳本語法檢查通過；`node scripts/test-project-docs-validator.mjs` 通過；`npm run docs:check` 通過；`git diff --check` 通過。
  - 同次 `npm run docs:check:final` 預期失敗，並精確回報三項真實狀態：「最新工作紀錄尚未完成」、「仍有欄位待執行」、「最新一輪 round2 結論不通過」。未再出現敘述性保留字誤判，證明 final 已能辨識中文字尾與最高 round。
  - 2026-07-20 11:20:39 Asia/Taipei：sandbox 內 `npm run check` 的文件、語法、治理 fixture、媒體、AI optimizer、provider、校閱 UI 均通過；核心測試因監聽 `127.0.0.1:21699` 遭 sandbox `EPERM` 中止。
  - 隨後經授權於 sandbox 外執行 `npm test`，同日 11:20 Asia/Taipei 全部通過，包含治理 fixture與核心 API／任務回歸。
  - 既有 fixture 未覆蓋本輪實測失敗的兩種情境，故測試套件雖全綠，仍不足以證明 round2 阻擋全部解除。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 2026-07-20 11:18 Asia/Taipei 執行 `npm run project:preflight` 成功，辨識版本 `0.45.1`、分支 `main` 與既有工作樹變更。
  - 2026-07-20 11:20:04 Asia/Taipei 的 `docs:check:final` 實際選中最高的 round2，而非 round1，並拒絕 round2 不通過；中文字尾待執行亦被阻擋。這三項屬正確的預期失敗。
  - 2026-07-20 11:20 Asia/Taipei 的記憶體邊界測試顯示 `stale-condition-acceptance: []` 與 `expanded-generic-action: []`，代表最新輪條件尚未接受及籠統需求動作仍可被誤放行。
  - sandbox 外 `npm test` 全部通過，未觀察到字幕產品回歸；本次不打包、不部署、不修改 Release，因此沒有新的平台資產實機結果。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪 round3 獨立審查結論為不通過：待執行中文字尾、最高 round 選擇、不通過結論、逐項發布風險與路徑先驗證均已修正，但舊 round 的條件接受狀態仍可掩蓋最新 round 的未接受條件，且「需求方要求進行發布」等籠統需求動作仍可被誤認為發布授權，因此 round2 四項阻擋尚未完全解除。**
- 阻擋問題（若有）：
  1. 將「條件是否已被需求方接受」與最高 round reference 結構化綁定；最高 round 為有條件通過時，只能採用該 round 的接受狀態，不得由舊 round 的「是」滿足，並新增正反 fixture。
  2. 將籠統需求動作檢查涵蓋語意等價措辭與常見標點／空白，例如「需求方要求進行發布。」「使用者請求打包」，或改以明確要求核准範圍含「同意／核准」及具體發布內容／風險，而非維護易漏判的單一精確字串。
- 剩餘風險：即使完成文字與結構驗證，自動檢查仍無法證實核准人身分、核准事實或審查證據真實性，需人工查核；未列入關鍵字集合的新型發布風險仍需治理人員判斷。
- 給主要開發代理的具體修正要求（若有）：修正上述兩項並新增 fixture，重跑三支治理腳本語法檢查、fixture、一般與 final 文件檢查、`npm run check`、`git diff --check`；修正影響結論，須建立 round4 報告複審，不得修改前三輪報告。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
