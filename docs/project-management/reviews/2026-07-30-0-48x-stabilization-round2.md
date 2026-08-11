# 獨立審查報告：0.48.x 穩定化：設定遷移與驗收基線

- 審查對象 commit／版本：目前工作樹／`0.48.0`；針對 round1 條件修正後的 `scripts/test-core.mjs` 與最新工作條目做必要最小複審。
- 對應 08-CHANGE-LOG 條目：2026-07-30 — 0.48.x 穩定化：設定遷移與驗收基線
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-07-30T14:37+08:00；同一獨立審查角色的新一輪任務，自行重新執行 debug preflight，只讀比對 round1 報告、修正差異、產品 secrets／settings 路徑與最新條目。
- 複審範圍：round1 所列「重啟成功條件與實際覆蓋不一致」及「既有 Gemini profile／provider secret 缺少保存斷言」兩項條件。

## 1. 需求完整性

- 判定：通過
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:55` 已將成功條件收斂為同一 server 的實際持久化路徑，並明列既有 provider secret 與 Gemini profile 不得刪除；跨平台重啟仍列為需後續實機驗收，與 `FR-014`、`NFR-005` 的本輪可驗證範圍一致。
  - `scripts/test-core.mjs:318-320` 在遷移輸入中建立 Gemini profile fixture；第 329-336 行同時驗證 top-level provider／Base URL／model、Gemini profile、OpenAI-compatible secret 與 Gemini secret 的磁碟結果，涵蓋 `FR-014`「不刪除 API Key 或 Gemini profile」。
  - `docs/project-management/08-CHANGE-LOG.md:52,68` 仍追溯 `FR-021`、`NFR-005`、`NFR-006`、`NFR-008`，並保留 LM Studio／斷網／跨平台等未完成驗收，沒有因 BUG-012 測試擴大完成宣稱。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `scripts/test-core.mjs:305-308` 先讀既有 `ai-secrets.json`，保留原 providers 並加入 `gemini-test-secret`；第 334-336 行在 migration POST 完成後重新讀磁碟，斷言原 OpenAI-compatible secret 與 Gemini secret 均保留。
  - migration payload 在 `scripts/test-core.mjs:310-322` 同時帶入 legacy top-level Gemini 混用值與獨立 Gemini profile；產品 route `server.mjs:3267-3275` 合併 profiles、只覆寫目前 `openai-compatible` profile，並在沒有新 `apiKey` 時不改 secrets。測試結果可識別錯刪 profile 或任一 provider secret。
  - `server.mjs:410-428` 使用 `config/ai-secrets.json` 的 `providers` map 儲存 provider secret；測試讀取的檔案與欄位結構正是產品實際路徑，不是自造的平行 fixture。
  - 工作條目不再把 process restart 當成本輪成功條件；`docs/project-management/08-CHANGE-LOG.md:55,68` 對持久化已驗證、跨平台啟動／重啟未驗證的界線一致。

## 3. 邊界情況

- 判定：通過
- 證據：
  - 同一案例同時覆蓋 legacy top-level Gemini URL／model 被清空，以及合法獨立 Gemini profile／secret 被保留，避免「修正混用資料」誤傷正常 Gemini 資料。
  - `scripts/test-core.mjs:329-336` 從兩個實際磁碟檔案分別驗證一般設定與 secrets；既有第 250-254 行另確保 API Key 不出現在公開回應或 `settings.json`，保存與不洩漏兩個邊界都有斷言。
  - `docs/project-management/00-CURRENT-STATUS.md:41`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:129-131` 與 `docs/project-management/08-CHANGE-LOG.md:68` 均保留既有使用者資料目錄、跨平台 process restart、LM Studio UI／取消／續跑、真正斷網與其他實機缺口。
  - 刻意使用 Gemini proxy 的 OpenAI-compatible 進階情境仍是既有啟發式遷移風險，但本輪沒有將該未覆蓋邊界描述為已驗收。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - 新 fixture 與斷言位於既有 BUG-012 案例相鄰區塊（`scripts/test-core.mjs:299-336`），使用明確名稱 `existingAiSecrets`、`persistedMigratedSettings`、`persistedAiSecrets`，失敗訊息可直接指出 profile 或哪一個 provider secret 遺失。
  - 測試沿用產品現有 JSON 結構，保留原 providers 後只加入 Gemini fixture，沒有覆蓋先前建立的 OpenAI-compatible secret；可同時偵測跨 provider 資料破壞。
  - 本輪仍未修改 `server.mjs`、封裝、發布或外部服務；差異範圍維持測試與治理文件，未發現未授權擴張。

## 5. 測試覆蓋

- 判定：通過（本輪修正範圍）
- 證據：
  - 主要代理記錄 `npm run check` 已通過（`docs/project-management/08-CHANGE-LOG.md:61`），涵蓋文件、語法與完整回歸。
  - 2026-07-30T14:38:46+08:00 本審查代理另執行 `npm test`，2026-07-30T14:38:48+08:00 exit 0；輸出顯示全部治理／功能測試與 `node scripts/test-core.mjs` 核心回歸通過，證明新增 profile／兩個 secret 斷言確實執行且未失敗。
  - 2026-07-30T14:38:14+08:00 執行 `git diff --check`，exit 0。
  - process restart 與跨平台實機未納入本輪自動測試，但已從成功條件移除並列為遺留風險，因此不再構成本輪結案敘述矛盾。

## 6. 實際運行結果

- 判定：通過（複審範圍）
- 證據：
  - 2026-07-30T14:37+08:00 親自執行 `npm run project:preflight -- --type=debug`，exit 0；輸出版本 `0.48.0`、分支 `codex/0.48-local-llm` 並列出 debug 路由。
  - 本輪實際 `npm test` exit 0，若遷移刪除 Gemini profile、OpenAI-compatible secret 或 Gemini secret，`scripts/test-core.mjs:333-336` 會直接失敗；實跑結果未發現此回歸。
  - 本輪沒有操作 Windows／macOS 使用者資料目錄、重啟、LM Studio 斷網或外部 provider；文件將其保持為未完成，沒有用自動回歸代替實機。

## 綜合判定

- 結論：通過
- 阻擋問題（若有）：無。round1 的成功條件不一致與 profile／secret 保存缺口均已解除。
- 剩餘風險：
  - 既有使用者 `settings.json`／`ai-secrets.json` 的跨平台啟動與 process restart 仍待實機驗收。
  - OpenAI-compatible 刻意代理 Gemini 的啟發式邊界、LM Studio UI／取消／續跑／真正斷網、Whisper Metal、外部 provider 與雙平台乾淨安裝仍未完成；治理文件已如實揭露。
  - 本輪不發布；Windows 未 Authenticode、macOS 未 Developer ID／公證及既有發布風險未因本測試消失。
- 給主要開發代理的具體修正要求（若有）：無新的修正要求。主要代理可回填 round2 報告與下方逐字結論，保留列出的實機風險並完成結案檢查。

**本輪「2026-07-30 — 0.48.x 穩定化：設定遷移與驗收基線」round2 獨立複審結論為通過：工作條目已將成功條件收斂為同一 server 的實際持久化路徑，並把跨平台 process restart 保留為遺留風險；`scripts/test-core.mjs` 現於 BUG-012 遷移輸入中帶入 Gemini profile、於實際 `ai-secrets.json` 預置 Gemini secret，遷移後從磁碟斷言 top-level 正規化值、Gemini profile、既有 OpenAI-compatible secret 與 Gemini secret 均正確保存，本輪 `npm test` 與 `git diff --check` 亦通過；round1 的兩項條件均已解除，文件仍誠實區分尚未完成的跨平台重啟、LM Studio／斷網與其他實機項目，未發現新的阻擋或未授權範圍擴張。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前已確認目標路徑不存在，未覆寫 round1 或其他既有審查報告。
- 若上述聲明不實，本報告無效。
