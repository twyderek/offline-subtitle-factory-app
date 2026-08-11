# 獨立複審報告：0.48.x 穩定化：macOS 封裝與本機 LLM 驗證

- 審查對象 commit／版本：目前工作樹／`0.48.0`；複審範圍為 round1 後的 Ollama evidence 版本化、strict contract 結論、受控測試紀錄及狀態清單編號修正。
- 對應 08-CHANGE-LOG 條目：2026-07-30 — 0.48.x 穩定化：macOS 封裝與本機 LLM 驗證
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-07-30T15:09+08:00；由主要代理啟動的獨立複審上下文，自行重新執行 development preflight、讀取 round1 報告與目前差異，並重跑 JSON、Git 與完整測試檢查。
- round1 對照報告：`docs/project-management/reviews/2026-07-30-0-48x-macos-local-llm-round1.md`。
- 審查需求：`FR-003`、`FR-021`、`NFR-003`、`NFR-005`、`NFR-008`。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/00-CURRENT-STATUS.md:49-57` 的正式發布狀態已修正為連續 1–9；第 57 行把 2026-07-30 probe 限定為 loopback 可連線，明載 capability／single-cue strict contract 失敗、LM Studio 無服務與斷網未驗收。
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:133-138` 及 `docs/project-management/08-CHANGE-LOG.md:55-61` 都保留本輪需求邊界：macOS 目錄版/runtime/SHA 證據不等於跨平台安裝驗收，Ollama transport 不等於模型品質或完整 `FR-021`，LM Studio、人工接受、取消／續跑與真正斷網仍未完成。
  - round1 的需求過度宣稱風險已解除；本輪仍只是部分 `FR-003`／`FR-021` 驗證，不能關閉完整需求，文件有如實揭露。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - `docs/project-management/evidence/2026-07-30-ollama-llama3.2-1b-live.json:2-12` 的日期、Ollama 0.32.5、兩模型、HTTP 200、兩個 strict contract 失敗與非完整離線／`FR-021` 證據結論彼此一致；2026-07-30T15:15:09+08:00 以 Node 逐欄斷言日期、兩個 `failed:`、Markdown／自然語言、時間格式改寫及 scope 結論，結果 `PASS`。
  - `docs/project-management/evidence/2026-07-28-ollama-llama3.2-1b-live.json:2` 已恢復 `capturedAt=2026-07-28T06:45:22.812Z`；同一時間 `git diff --quiet -- <該檔>` exit 0，且工作樹狀態不再把該檔列為修改，證明現檔與 HEAD 歷史版本一致。
  - 但 `docs/project-management/evidence/2026-07-30-ollama-llama3.2-1b-live.json:8-12` 只有人工摘要後的 status／contract／conclusion，沒有 probe 原始 request、response body、模型輸出或 token usage；round1 曾讀到的 2026-07-30 raw capture 因而沒有被完整另存，不能由新 artifact 重新驗證兩個失敗敘述。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:136-138` 已分開記錄三種邊界：Ollama HTTP transport 成功但 strict contract 失敗、LM Studio connection refused、sandbox `listen EPERM` 後受控權限重跑成功；不再把不同層次的結果合併成「本機 LLM 驗證通過」。
  - `docs/project-management/00-CURRENT-STATUS.md:55` 的既有 Ollama 歷史結果與第 57 行的 2026-07-30 新 probe 以日期區分；新失敗沒有反向改寫先前紀錄，也沒有被擴大成穩定模型能力結論。
  - `scripts/probe-ollama-live.mjs:7` 的預設輸出仍固定為 `2026-07-28-ollama-llama3.2-1b-live.json`；再次直接執行文件所列的 `npm run probe:ollama:live` 仍會覆寫已恢復的歷史 artifact。這使版本化修正只在目前工作樹暫時成立，重放邊界尚未安全閉環。

## 4. 程式碼品質

- 判定：部分通過（本輪重點為 evidence／治理品質）
- 證據：
  - 2026-07-30T15:15:09+08:00 對 7/28 與 7/30 兩份 artifact 執行 `jq empty`，exit 0；`git diff --check` 同時通過。
  - 7/28 檔與 HEAD 的 SHA-256 均為 `3d68d4481fd9334627e2646f8053976b20330fb477b822ad639c235b4f85f5e4`，確認歷史檔已逐位元恢復，而非只改回日期欄位。
  - 7/30 檔只有衍生判定、缺少 raw request／response，且 probe 預設檔名仍綁死 7/28；這不符合 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:123` 所描述「保存版本、模型清單、完整 capability／single-cue 請求與原始回應」的可重放 evidence 品質。

## 5. 測試覆蓋

- 判定：通過
- 證據：
  - 2026-07-30T15:14:35+08:00 在 sandbox 執行 `npm run check`，治理、語法與前段回歸通過，至 `scripts/test-core.mjs` 因 `listen EPERM 0.0.0.0:22380` exit 1；失敗原因與 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:138` 記載一致。
  - 隨後於 2026-07-30T15:14+08:00 以受控權限重跑同一 `npm run check`，exit 0；治理檢查、JavaScript 語法、全部資料層/provider/UI 測試及核心回歸均通過。這次獨立重跑補足 round1 所要求的命令、環境、時間與結果證據。
  - 2026-07-30T15:15:09+08:00 再執行 `npm run project:preflight -- --type=development`、兩份 evidence JSON 解析、7/30 annotation 斷言、7/28 HEAD 一致性及 `git diff --check`，全部 exit 0。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - round1 已獨立確認 macOS arm64 runtime verify、目錄版 executable／renderer 證據、DMG／ZIP SHA、Ollama 與 LM Studio connection-refused；本輪修正沒有修改產品程式或封裝資產，故不重複執行會改寫 live artifact 的 probe。
  - 本輪可獨立重現「7/28 檔已恢復」、「7/30 摘要明確標 contract 失敗」、「三份治理文件結論一致」、「狀態編號 1–9」及「受控 `npm run check` 通過」。
  - 目前不能從 7/30 新檔重現實際模型文字及其 JSON parse／cue invariant 失敗；只能依衍生摘要與 round1 當時的審查紀錄判斷。因此新版 raw capture 的持久可回溯性仍不足。

## 綜合判定

- 結論：有條件通過
- 已解除的 round1 問題：
  1. 原 2026-07-28 artifact 已逐位元恢復，7/30 結果已使用獨立日期路徑。
  2. 7/30 artifact、目前狀態、測試稽核與工作條目均明確標示 capability／single-cue strict contract 失敗，並列出 Markdown／自然語言與時間格式改寫；沒有再暗示字幕優化成功。
  3. sandbox `listen EPERM` 與受控 `npm run check` 通過已同步；本審查亦於 2026-07-30T15:14+08:00 獨立重現相同先失敗、後受控通過結果。
  4. `00-CURRENT-STATUS.md` 的狀態清單已修正為 1–9。
- 阻擋問題：
  1. `docs/project-management/evidence/2026-07-30-ollama-llama3.2-1b-live.json` 必須保存 2026-07-30 probe 的完整 request 與 raw response，而非只保留 12 行人工摘要；可在不改動 raw 欄位的前提下新增 validation／conclusion 欄位。
  2. `scripts/probe-ollama-live.mjs:7` 不得再預設覆寫 2026-07-28 歷史檔。應要求明確輸出路徑、依 capture 日期產生不可衝突的新檔，或在既存目標存在時拒絕覆寫；並以不碰觸既有 artifact 的測試驗證。
- 剩餘風險：
  - macOS 證據仍限目前主機的 ad-hoc arm64 目錄版；DMG／ZIP 安裝後、乾淨帳號、macOS 12 最低版、簽章／公證及 Windows 實機未因此完成。
  - `FR-003` 的 Whisper／Metal 實際轉錄與既有 exit 139 風險未在本輪處理。
  - LM Studio、產品 UI 人工接受、取消／checkpoint 續跑及真正斷網仍未完成，完整 `FR-021` 不可關閉。
- 給主要開發代理的具體修正要求：保留目前兩份日期 artifact，不得再次直接執行會寫入 7/28 預設路徑的 probe；從原始執行輸出恢復 7/30 raw capture，或以明確的新輸出路徑重新 probe 並保存 raw response；同步修正 probe 的防覆寫行為與最小回歸後，再建立 round3 複審。

**本輪「2026-07-30 — 0.48.x 穩定化：macOS 封裝與本機 LLM 驗證」round2 獨立複審結論為有條件通過：原始 2026-07-28 artifact 已逐位元恢復，7/30 新檔及三份治理文件也已一致把 capability／single-cue 標為 strict contract 失敗，狀態編號已修正為 1–9，sandbox `listen EPERM` 與受控 `npm run check` 通過亦由本審查獨立重現；但 7/30 新檔目前只有人工衍生的 status／contract／conclusion，沒有 probe 的完整 request 與 raw response，且 `scripts/probe-ollama-live.mjs` 預設仍指向 2026-07-28 歷史路徑，下一次直接重放仍會覆寫已恢復證據，因此 round1 的版本化／可回溯阻擋尚未完全解除，須保存 7/30 raw capture 並加入防覆寫行為後再複審。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前已確認目標路徑不存在，未覆寫既有審查報告。
- 若上述聲明不實，本報告無效。
