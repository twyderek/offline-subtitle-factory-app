# 獨立審查報告：精簡治理必讀流程與建立常設簽章風險授權

- 審查對象 commit／版本：工作樹（基準 commit `142b85ddfd7912621e88d71c19cc817e0079c5b0`）／0.46.0
- 對應 08-CHANGE-LOG 條目：2026-07-23 — 精簡治理必讀流程與建立常設簽章風險授權
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-23T15:06:55+08:00，獨立子代理上下文；依 `project:preflight -- --type=governance` 讀取固定核心與 governance 路由，另因本次明示審查範圍讀取 `02-REQUIREMENTS-ANALYSIS.md` 的 NFR-006／NFR-008。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:46-48` 要求每次變更可追溯、自動測試／文件檢查／獨立審查完成，以及發布資產、簽章、SHA、說明一致。
  - `docs/project-management/README.md:7-26` 定義四項固定核心、七種任務類型與保守的 `full`；`AGENTS.md:5-16` 保留立項、審查、結案、發布授權與資產核對的強制門檻。固定核心足以讓每次任務取得規則入口、目前狀態、最新工作與路由，細節再由任務文件承接。
  - `docs/project-management/08-CHANGE-LOG.md:47-66` 記錄目標、排除範圍、風險、驗證計畫與實際修改；`git diff --numstat -- docs/project-management/08-CHANGE-LOG.md` 為新增 54 行、刪除 3 行，工作條目標題數由基準 16 增為目前 18。差異未刪除既有歷史條目；其中一筆既有狀態由「進行中」更新為「完成」，不是歷史刪除。
  - `docs/project-management/09-STANDING-AUTHORIZATIONS.md:10-14` 精確保存原始授權、將 macOS 範圍明確寫為 Apple Developer ID 簽章／公證，並排除未實機測試、checksum／資產／updater metadata、機密、測試／審查與其他未明示風險；第 14 行明確區分常設風險接受與本次立即發布、擴大對象、刪除／覆蓋等操作授權。
  - 未完全通過原因：`docs/project-management/08-CHANGE-LOG.md:59-61` 宣稱「preflight 各任務類型正負案例」與 preflight 路由測試已通過，但 `scripts/test-project-preflight.mjs:5-17` 只斷言 `general`、`release`、`full`、`unknown`，沒有自動驗證 `governance`、`requirements`、`development`、`debug` 的必要路由。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `scripts/project-preflight.mjs:7-21` 的 core 與 routes 和 `docs/project-management/README.md:7-24` 一致。`full` 的 00、08 由 core 提供，routes 補齊 01–07、09 與 01–07 全部 workflows，因此合併後確實涵蓋 00–09 與全部 workflows。
  - `scripts/project-preflight.mjs:23-31` 對未知類型在讀檔前回傳 exit 2；對有效類型實際讀取去除註記後的 core 與 route 檔案，可偵測必要檔案缺失，而不是只列印名稱。
  - 實際逐一執行七種類型後，輸出和 README 表格一致：`general` 1 個路由、`governance` 6 個、`requirements` 4 個、`development` 7 個、`debug` 7 個、`release` 8 個、`full` 15 個；未知類型回傳 2。
  - `docs/project-management/01-PROJECT-GOVERNANCE.md:42-46` 要求每次發布仍確認授權有效、平台／風險相符且不可擴張排除項；`docs/project-management/09-STANDING-AUTHORIZATIONS.md:12-14` 與此一致，沒有把風險接受誤寫為發布操作授權。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 已實測 `--type=general|governance|requirements|development|debug|release|full` 均 exit 0；`--type=unknown` exit 2 且 stderr 含「未知任務類型」。
  - 未提供 `--type` 時，`scripts/project-preflight.mjs:23-24` 明確回退 `general`；無法自然語言分類時，`AGENTS.md:5` 與 `README.md:26` 要求使用 `full`。
  - `08-CHANGE-LOG.md:3,7-12,47-68` 讓前置閱讀只讀範本規則與第一個最新工作條目，同時保留歷史條目供按需追溯；`scripts/check-project-docs.mjs:51-58` 的 final parser 也以第一個具日期條目作為 latest。
  - 未完全通過原因：自動測試未覆蓋四個中間類型，且未斷言每種類型的完整必要文件集合（目前只用少數 `includes`／`not includes`），因此 route 遺漏、誤增或名稱錯置可能在 `npm run check` 中漏網。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - `scripts/project-preflight.mjs` 將 core／routes 集中宣告、去重後實際讀檔，結構簡潔；`node --check` 對 `project-preflight.mjs`、`test-project-preflight.mjs`、`check-project-docs.mjs` 全部通過。
  - `package.json:16-17` 已把新測試納入 `npm test`，因此一般回歸入口會執行它。
  - `scripts/check-project-docs.mjs:19,32-43` 對 09 文件只驗證檔案長度及 `AUTH-2026-07-23-01`、`未簽章`、`未公證`、`明確排除`、`撤銷方式` 等關鍵字存在；它不驗證 Windows Authenticode、macOS Apple Developer ID 簽章／公證、未實機測試排除、風險接受與實際發布操作分離等關鍵語意。因此文件目前內容正確，但 checker 對未來退化的防護不足。
  - `scripts/test-project-preflight.mjs:4-17` 以零散 substring assertions 表達預期，沒有一份可逐類型比對的 expected route map，造成測試敘述「各任務類型」與實際覆蓋不一致。

## 5. 測試覆蓋

- 判定：不通過
- 證據（執行日期 2026-07-23 Asia/Taipei）：
  - `node --check scripts/project-preflight.mjs && node --check scripts/test-project-preflight.mjs && node --check scripts/check-project-docs.mjs`：exit 0。
  - `node scripts/test-project-preflight.mjs`：exit 0，輸出「general、release、full 與未知類型」；此輸出本身證明只涵蓋三個有效類型。
  - 七種類型逐一執行與未知類型負例：人工矩陣全部符合預期，但這不能取代可持續的自動回歸。
  - `npm run check`：exit 0；包含 `docs:check`（19 文件）、語法、preflight、治理 validator、媒體、雙語字幕、AI optimizer／providers、review UI 與核心 API 回歸。
  - `git diff --check`：exit 0。
  - 阻擋缺口一：缺少 `governance`、`requirements`、`development`、`debug` 的自動 expected-route 斷言，與工作條目的「各任務類型」驗證計畫不符。
  - 阻擋缺口二：docs checker／fixture 沒有針對 AUTH-2026-07-23-01 精確平台範圍、排除未實機測試、以及「常設風險接受不等於本次發布操作授權」建立正負案例；僅關鍵字存在不足以守住本次最重要的授權邊界。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - `npm run project:preflight -- --type=governance` 實際列出 4 項固定核心，以及 01、06、09、測試、獨立審查、結案共 6 項路由；其他六個有效類型也逐一成功運行，`full` 列出 15 項額外文件，合併 core 後完整。
  - `node scripts/project-preflight.mjs --type=unknown` 實際 exit 2。
  - `npm run docs:check`（由 `npm run check` 執行）通過；`npm run docs:check:final` 目前 exit 1，原因為最新工作條目仍是「進行中」、含「待執行」、且獨立審查欄尚未更新。這符合審查進行中的預期，但在主要代理引用本報告並結案後必須重跑至通過。
  - 本次是治理與測試變更，不涉及打包、部署或公開發布；未執行平台實機／封裝驗證不構成本輪新增行為的替代證據，也未被 AUTH-2026-07-23-01 授權涵蓋。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪「精簡治理必讀流程與建立常設簽章風險授權」獨立審查結論為不通過：七種類型路由、full 完整性、未知類型失敗、08 最新條目追溯與歷史保留、AUTH-2026-07-23-01 的平台範圍／排除項／發布操作分離均已人工驗證正確，且 npm run check 通過，但 preflight 自動測試未覆蓋 governance、requirements、development、debug 的完整路由，docs checker／fixture 亦未以正負案例鎖定常設授權的精確範圍與邊界，因此尚未滿足 NFR-006 所要求的完整自動測試與文件檢查。**
- 阻擋問題（若有）：
  1. 擴充 `scripts/test-project-preflight.mjs`，以完整 expected map 自動比對七個有效類型的固定核心與路由，並保留未知類型 exit 2 負例；避免只以少數 substring 驗證。
  2. 擴充 docs checker 或其 fixture 測試，加入 AUTH-2026-07-23-01 的正負案例，至少鎖定 Windows Authenticode 未簽章、macOS 未 Apple Developer ID 簽章／公證、未實機測試明確排除，以及常設風險接受不等於本次實際發布操作授權。
  3. 修正後建立 round2 報告複審；主要代理引用結論、將最新工作條目結案後執行 `npm run docs:check:final` 至 exit 0。
- 剩餘風險：
  - 任務類型仍需執行者判斷；分類錯誤可能漏讀文件，但 `full` 提供保守回退。
  - AUTH-2026-07-23-01 只接受明示的簽章／公證風險；未實機測試、checksum／資產／metadata、機密與測試／審查失敗仍須逐次處理。
  - 工作樹含其他既有變更與一份既有未追蹤審查報告；本輪只評估指定治理變更，未替其他工作作背書。
- 給主要開發代理的具體修正要求（若有）：依上述三項阻擋問題補齊測試與結案；不得修改本 round1 報告，修正後另建 round2。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
