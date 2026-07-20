# 獨立審查報告：補強獨立審查證據與發布授權治理

- 審查對象 commit／版本：`f781acbc14b61f7427c034bbe42f9e75804d6835` 工作樹差異／`0.45.1`（分支 `main`）
- 對應 08-CHANGE-LOG 條目：2026-07-20 — 補強獨立審查證據與發布授權治理
- 審查輪次：round4
- 審查代理啟動時間、上下文來源：2026-07-20 11:22 Asia/Taipei；延續前三輪的相同獨立審查角色，由主要代理提供 round3 兩項阻擋的複審範圍，未沿用主要代理評價性結論。
- 審查環境：macOS sandbox；Node.js `v22.22.3`、npm `10.9.8`。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:39-41` 定義 `NFR-006` 的自動測試、文件檢查與獨立審查，以及 `NFR-008` 的發布完整性。
  - `scripts/project-docs-validator.mjs:34-46,62-70` 已將最高 round 的路徑、逐字引用與條件接受狀態解析成同一 reference，覆蓋 round3 第一項阻擋。
  - `scripts/project-docs-validator.mjs:83-87` 新增授權範圍正規化及籠統需求動作判斷；`scripts/test-project-docs-validator.mjs:16-18` 新增精確句與帶標點／「進行」變體 fixture，覆蓋 round3 第二項阻擋的部分措辭。
  - 但同義需求動作只要調換「要求」與「發布」順序，或在「發布」後加操作尾綴，仍可充當授權；使用者要求的語意等價措辭尚未完整阻擋。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - `scripts/project-docs-validator.mjs:35-46` 先依各審查檔切分 block，再把 `conditionAccepted` 綁在同一 block；`:70` 只讀取最高 round reference 的接受狀態，不再搜尋整條工作紀錄。
  - 2026-07-20 11:24 Asia/Taipei 的只讀記憶體測試建立「round2 接受：是、round3 接受：否」，以 round3 有條件通過報告呼叫 `validateLatestEntry`，實際回報 `localized-condition: ["最新一輪為有條件通過，但該輪條件未記錄為需求方已接受"]`。round3 第一項阻擋已解除。
  - `scripts/project-docs-validator.mjs:84-85` 的籠統授權 regex 要求「需求方／使用者」→「要求／請求」→「打包／發布」，且動作必須位於字串結尾。這是字面順序判斷，不是充分的語意等價判斷。
  - 同一記憶體測試中，`需求方要求進行發布。` 與 `使用者請求打包！` 都正確回報拒絕；但 `需求方提出發布要求。` 與 `需求方要求進行發布後提供下載` 實際回傳 `[]`，仍違反 `docs/project-management/01-PROJECT-GOVERNANCE.md:43,55` 的「需求動作不等於已知風險授權」。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - `scripts/test-project-docs-validator.mjs:22-24` 已加入舊 round 接受、最新 round 拒絕的負向 fixture；2026-07-20 11:24:44 Asia/Taipei fixture 通過。
  - `scripts/test-project-docs-validator.mjs:16-18` 覆蓋 `使用者要求發布` 與 `需求方要求進行發布。`；空白與 `，。；、,.!！` 標點由 `scripts/project-docs-validator.mjs:84` 正規化。
  - 未覆蓋且已實測漏判：動作在「要求」之前的 `需求方提出發布要求。`，以及動作後帶尾綴的 `需求方要求進行發布後提供下載`。兩者都是只描述需求動作、沒有「同意／核准」或風險接受的語意等價措辭。
  - 發布風險仍由 `scripts/project-docs-validator.mjs:86-87` 逐項核對 `未簽章`、`未公證`、`未實機測試`；路徑仍由 `scripts/check-project-docs.mjs:65-73` 先驗證後讀取，先前已解除項未回歸。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - round reference 現在同時封裝 path、round、quote 與 conditionAccepted（`scripts/project-docs-validator.mjs:34-46`），使最高輪次的關聯資料保持局部一致，結構清楚。
  - `scripts/project-docs-validator.mjs:84-85` 的正規化函式簡潔，但以單一正規表示式嘗試判斷自然語言等價句，易受語序、同義動詞與尾綴繞過；應改用明確正向授權格式或更保守的 token 組合規則。
  - 2026-07-20 11:24:44 Asia/Taipei 執行三支治理腳本的 `node --check` 均通過，`git diff --check` 通過。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-20 11:24:44 Asia/Taipei：`node scripts/test-project-docs-validator.mjs` 通過；`npm run docs:check` 通過；三支治理腳本語法與 `git diff --check` 通過。
  - 同次 `npm run docs:check:final` 預期失敗，正確回報最新條目尚未完成、仍含待執行及最高 round3 結論不通過；多輪與結案語意未回歸。
  - 2026-07-20 11:25:20 Asia/Taipei：sandbox 內 `npm run check` 的文件、語法、治理 fixture、媒體、AI optimizer、provider、校閱 UI 均通過；核心測試因監聽 `127.0.0.1:21348` 遭 sandbox `EPERM` 中止。
  - 隨後經授權於 sandbox 外執行 `npm test`，同日 11:25 Asia/Taipei 全部通過，包含治理 fixture 與核心 API／任務回歸。
  - 現有 fixture 未包含本輪兩個漏判句，因此全綠測試仍未覆蓋「語序調換」與「動作尾綴」兩類等價措辭。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 2026-07-20 11:22 Asia/Taipei 執行 `npm run project:preflight` 成功，辨識版本 `0.45.1`、分支 `main` 與既有工作樹變更。
  - 2026-07-20 11:24 Asia/Taipei 的記憶體實測證明最高 round 未接受條件會被拒絕；舊輪接受狀態不再誤放行。
  - 同次四種籠統授權措辭實測中，兩種已拒絕、兩種仍錯誤通過：`需求方提出發布要求。` → `[]`；`需求方要求進行發布後提供下載` → `[]`。
  - sandbox 外 `npm test` 全部通過，未觀察字幕產品回歸；本輪不打包、不部署、不修改現有 Release。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪 round4 獨立審查結論為不通過：最高 round 的條件接受狀態已正確局部綁定，且既有標點與「進行發布」fixture 可攔截，但「需求方提出發布要求」及「需求方要求進行發布後提供下載」仍能充當發布授權，因此 round3 的籠統需求動作阻擋尚未完全解除。**
- 阻擋問題（若有）：
  1. 改用保守且可驗證的發布授權格式：例如要求核准範圍明示「同意／核准」及具體發布內容，並在條目揭露已知風險時逐項明示接受；僅含需求方／使用者、要求／請求／提出、打包／發布等動作描述者一律不得視為授權，不應依賴固定語序或字串結尾。
  2. 新增至少涵蓋 `需求方提出發布要求。`、`需求方要求進行發布後提供下載`、同義動詞與尾綴的負向 fixture，另保留真正明示核准內容的正向 fixture以避免過度攔截。
- 剩餘風險：自然語言規則無法窮舉所有同義句；最可靠做法是要求結構化、明示的核准語句。即使格式通過，自動化仍無法證實核准人身分與核准事實，須人工查核。
- 給主要開發代理的具體修正要求（若有）：依兩項阻擋修正 validator 與 fixture，重跑治理語法、fixture、一般／final 文件檢查、`npm run check`、`git diff --check`；因修正影響結論，須新增 round5 報告複審，不得修改前四輪報告。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
