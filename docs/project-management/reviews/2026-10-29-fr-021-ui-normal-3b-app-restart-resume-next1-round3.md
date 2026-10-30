# 獨立審查報告：FR-021 normal-loopback 3B app-restart resume next1 round3

- 審查對象：`FR-021-REPLAY-20261029-UI-NORMAL-3B-APP-RESTART-RESUME-NEXT1`；本輪只複審治理格式／closeout、next2 authoritative evidence、round1 F-01 修正與 F-02 residual。
- 審查輪次：round3；current `HEAD` 為 `c06d15e95a2f0a0981518c5873003a460e57a5ee`，工作樹既有變更保留未覆蓋。
- 先行規則：已讀取 `scripts/project-docs-validator.mjs` 的 `validateReviewReport`（`:12-34`）與 `validateLatestEntry`（`:51-78`）。本報告採用六個固定標題、每節獨立 `判定`／`證據`、綜合結論／阻擋問題／完整粗體 quote，以及 validator 要求的審查代理聲明。
- 審查方式：未重跑會建立新 live evidence 的 verifier；執行 preflight、focused UI contract、治理 validator、一般 docs check、`git diff --check`，並唯讀核對目前 08 closeout、round1／round2、next1／next2、source 與 next2 權限／SHA-256／scope。

## 1. 需求完整性

- 判定：部分通過（有條件通過）。
- 證據：`08-CHANGE-LOG.md:3-31` 已補上 `狀態：完成`、round1／round2 report path、條件接受、獨立審查、發布授權與遺留風險；需求範圍仍限定為 macOS arm64 current candidate、預裝 `llama3.2:3b`、normal-loopback app-restart／checkpoint／resume lifecycle。技術需求由 next2 status `pass`、0600、第二次 port capture／close 與同一 session／checkpoint assertions 支持；但 08 所指向的 round2 report 未符合 `validateReviewReport` 的 canonical 判定／證據／聲明格式，故 final governance closeout 尚未實際通過。

## 2. 邏輯正確性

- 判定：通過。
- 證據：目前 `scripts/verify-electron-ollama-ui.mjs:426-433` 對 null／非整數／範圍外 port fail-closed；`:824-833` 在第二次 home dashboard 後保存並要求 `secondAppServerPortCaptured`；`:1045-1046` 將實際第二次 port cleanup 保存為 `secondAppServerPortClosed`。next2 的第一個 process group／port close、userData preservation、第二次 launch、second port captured／closed 均為 true，故 round1 F-01 技術 blocker 已解除。cancel POST 由 UI fetch wrapper 實際捕獲 status／去敏 body flags，next2 保存 HTTP 200／accepted／cancelled；同一 candidate／DevTools port、同一 userData、同一 session／checkpoint、page time-origin changed 與 resume batch 1 至 6/6 亦互相一致。

## 3. 邊界情況

- 判定：部分通過（有條件通過）。
- 證據：`scripts/test-ollama-ui-offline.mjs:318-326` 已固定 cancel observability、第一個 process group、userData persistence、第二次 port capture／close、invalid-port fail-closed 與新 renderer regression；next2 cleanup、0600／exclusive-create、raw output exclusion 與 privacy flags 均可唯讀核對。未涵蓋且不得外推的邊界仍包括 Seatbelt renderer、真正全機 egress、signed／notarized、Windows、LM Studio、模型品質與 FR-021 overall；本輪只接受 6 個短 synthetic cues 的 bounded lifecycle。

## 4. 程式碼品質

- 判定：部分通過（有條件通過）。
- 證據：evidence writer 使用 exclusive `wx` 與 owner-only `0600`；process-group cleanup 有 group absent／closed confirmation。next2 artifact hash 與目前 source 核對為 candidate `b3605c589459068f894a70896b8ed843be3832a839fcdd83aa898e9b16210de4`、packaged `review.js` `ac25c6639a282eb5807c903fd0bded2419a39ce304428efeb137ac4a19a2b04b`、Electron Framework `416b6c8cf74c59188266d3ff7a3fc77b9f68bb52f7328d98b382d132580c8cee`。F-02 provenance 仍未完整綁定 source revision、完整 replay command、timeout／環境前提、build provenance 或 replay-time loaded bytes，保留為非阻擋 residual，不得宣稱完整可重現性。

## 5. 測試覆蓋

- 判定：部分通過（有條件通過）。
- 證據：本輪 `npm run project:preflight -- --type=full` exit 0；`node scripts/test-ollama-ui-offline.mjs` exit 0；`node scripts/test-project-docs-validator.mjs` exit 0；`npm run docs:check` exit 0（19 個文件）；`git diff --check` exit 0。未重跑 live verifier。`npm run docs:check:final` 實際 exit 1，並指出 08 指向的 round2 report 六節缺有效 `- 判定：通過／不通過／部分通過` 與 `- 證據：`，且缺少 validator 要求的完整審查代理聲明；因此 focused／一般 docs checks 通過不能等同 final closeout 通過。

## 6. 實際運行結果

- 判定：部分通過（有條件通過）。
- 證據：next2 `docs/project-management/evidence/2026-10-29-fr-021-ui-normal-3b-app-restart-resume-next2.json` 仍是 authoritative bounded evidence，status `pass`、mode `0600`、SHA-256 `e95aa0524fdc32684a49c03bc4c22942afe012657d77dedd6c95e66903256f24`；cancel POST HTTP 200／accepted／cancelled、第一個 process／port 關閉、同一 userData／job root 保留、第二次同一 candidate／DevTools port 重啟、同一 session／checkpoint 恢復、resume 1 至 6/6、第二次 port captured／closed 與最終 cleanup 均成立。當前 08 的狀態欄位已是完成，但 `npm run docs:check:final` 仍因 round2 報告格式失敗，故實際治理 closeout 尚待以本 round3 canonical report 更新引用後重跑。

## 綜合判定

- 結論：有條件通過。
- F-01：已解除；沒有新的技術 blocker。next1 保留為 immutable first-run finding，next2 是修正後 authoritative evidence。
- F-02：仍為非阻擋 provenance residual／後續改善條件；不影響本 bounded lifecycle 的 technical conclusion，但限制可宣稱的 reproducibility。
- 治理 closeout：目前 08 已有完成狀態與必要欄位，但尚未真正通過 final validator。`validateLatestEntry()` 會讀取 08 指向的 round2 report，而該報告缺少 canonical 六節判定／證據與 exact declaration；本 round3 報告本身已依規則建立，但在 08 改為引用本 round3 quote 並重跑 final gate 前，closeout 仍是條件。
- 阻擋問題（若有）：
  - **GOV-R3-01（P1，治理格式／closeout）**：目前 `npm run docs:check:final` exit 1，因 08 仍引用不符合 `validateReviewReport` 的 round2 report。主要代理須只同步 08 的 round3 report path、完整粗體 quote 與對應 closeout reference，再重跑 final gate；本審查代理不修改 08、round2 或其他檔案。
  - **F-01：無**，round1 技術 blocker 已解除。
  - **F-02：無新增技術 blocker**，但 provenance residual 仍須保留並不得擴大 scope。
- 可逐字引用完整結論句：**本輪 `FR-021-REPLAY-20261029-UI-NORMAL-3B-APP-RESTART-RESUME-NEXT1` round3 治理格式／closeout 獨立複審結論為有條件通過：round1 F-01 的第二次 app server port cleanup 技術 blocker 已由 invalid-port fail-closed、第二次 port capture／close assertions、focused regression 與 next2 authoritative immutable evidence 解除；next2 的 cancel POST HTTP 200／accepted／cancelled、第一個 process group／port 關閉、同一 userData／job root 保留、同一 candidate／DevTools port 重啟、同一 session／checkpoint 恢復、從 batch 1 至 6/6 resume、0600／exclusive-create、candidate／Framework／review.js hash、privacy、raw-output exclusion 與 cleanup 均維持成立；F-02 source／command／environment provenance 仍是非阻擋 residual，而 08 雖已標示完成並補上 closeout 欄位，`npm run docs:check:final` 仍因其指向的 round2 報告不符合 `validateReviewReport` 的六節判定／證據與完整審查代理聲明而 exit 1，故須由主要代理將本 round3 canonical report 與完整 quote 同步至 08 後再重跑 final gate；本輪只支持 macOS arm64 current candidate／預裝 `llama3.2:3b`／normal-loopback app-restart lifecycle，不得擴稱 Seatbelt offline、全機 egress、signed／notarized、Windows、LM Studio 或 FR-021 overall。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本輪未重跑會建立 live evidence 的 verifier；未修改 08-CHANGE-LOG.md、source、test、evidence 或既有 round1／round2 報告。唯一寫入目標為本檔案。
- 若上述聲明不實，本報告無效。
