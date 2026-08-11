# 獨立複審報告：0.48.x 穩定化：Ollama single-cue contract 修正

- 審查對象 commit／版本：目前工作樹／`0.48.0`；複審範圍為 round1 後的 cue ID enum、native response validator、持久 raw evidence 與 native-smoke 文件定位。
- 對應 08-CHANGE-LOG 條目：2026-07-30 — 0.48.x 穩定化：Ollama single-cue contract 修正
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-07-30T15:53+08:00；由主要代理啟動的獨立複審上下文，自行重跑 development preflight、核對 round1 報告、目前差異、持久 artifact 與 production provider／optimizer 回歸。
- round1 報告：`docs/project-management/reviews/2026-07-30-0-48x-ollama-contract-round1.md`。
- 審查需求：`FR-021`、`NFR-005`、`NFR-006`。

## 1. 需求完整性

- 判定：通過
- 證據：
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:142-144` 與 `docs/project-management/08-CHANGE-LOG.md:60-61` 現將本輪明確定位為 native smoke，並分開說明 production strict optimizer 未放寬、模型標點品質仍需人工審核。
  - `docs/project-management/evidence/2026-07-30-ollama-native-contract-rerun.json:1-155` 持久保存 Ollama 版本、兩模型、完整 capability／native single-cue requests、raw responses 與 validator 結果，補足 `NFR-006` 可回溯證據。
  - LM Studio、真正斷網、產品 UI 與跨平台實機仍明列未驗收，沒有把 single-cue smoke 擴張成完整 `FR-021`。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - `scripts/probe-ollama-live.mjs:25` 的 native cue schema 現使用 `id: { enum: [1] }`，與 production `lib/ai/providers.mjs:59-77` 依輸入 cue IDs 建立 enum 的約束一致，不再接受任意 integer。
  - `scripts/probe-ollama-live.mjs:44-54` 解析 native `message.content`，檢查 cues array、數量 1、ID 1、text 與 reason 型別，並將結果寫入 artifact 的 `validation.nativeSingleCue`。
  - `docs/project-management/evidence/2026-07-30-ollama-native-contract-rerun.json:71-154` 顯示 `/api/chat` request 使用 enum `[1]`、minItems／maxItems 1、`stream:false`、temperature 0；raw response 可解析為單一 ID 1 cue，validation 為 `valid:true`、`cueCount:1`。
  - 文件不再把簡化 probe messages 稱為完整 production replay，而限定為 native smoke；round1 的 parity 過度宣稱已解除。

## 3. 邊界情況

- 判定：通過
- 證據：
  - probe validator 對非 JSON、缺 cues、cue 數量不為 1、ID 不為 1、text／reason 非字串皆回報 `valid:false` 與可診斷 reason；schema 同時以 additionalProperties false、required、minItems／maxItems 與 ID enum 約束模型輸出。
  - 生產 `lib/ai/subtitle-optimizer.mjs:91-124` 的 cues array、數量、未知／重複 ID、順序、空白／異常長度文字檢查及原 cue 時間碼綁定均未改動。
  - 文件保留全形句號改半形是人工品質風險，沒有因 JSON shape 合法而自動接受建議。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - probe 將 native shape validation 與 raw capture 一併保存，欄位命名清楚；既有 loopback 限制、manual redirect、日期／模型檔名及拒絕覆寫行為均保留。
  - 2026-07-30T15:55:26+08:00 執行 `node --check scripts/probe-ollama-live.mjs` 與 `git diff --check`，均 exit 0。
  - validator 目前是 smoke-level shape check，未取代 production validator；文件已按此能力正確定界。

## 5. 測試覆蓋

- 判定：通過
- 證據：
  - 2026-07-30T15:55:26+08:00 執行 `node scripts/test-ai-providers.mjs`，exit 0；確認 production Ollama `/api/chat`、stream、temperature、schema count 與 provider 安全邊界維持通過。
  - 同時執行 `node scripts/test-ai-optimizer.mjs`，exit 0；固定 cue ID、數量／順序拒絕、時間碼綁定、文字品質、進度與回應驗證均通過。
  - 以 Node 對持久 artifact 逐欄斷言 endpoint、stream、temperature、ID enum、validation、cue count 與 raw response ID，輸出 `persistent native smoke artifact assertions: PASS`。
  - `docs/project-management/08-CHANGE-LOG.md:61` 另記錄主要代理的受控 `npm run check` 通過；本輪針對性複審未發現與完整回歸矛盾。

## 6. 實際運行結果

- 判定：通過
- 證據：
  - 持久 artifact 的 `capturedAt` 為 `2026-07-30T07:54:05.689Z`，實際使用 Ollama 0.32.5／`llama3.2:1b`，native response HTTP 200 且 validator 通過。
  - raw response 文字為 `這是一個測試字幕.`，可直接證明 JSON／cue shape 成功與全形句號品質退步同時存在；audit／changelog 對兩者的區分與 artifact 一致。
  - evidence 已位於 `docs/project-management/evidence/2026-07-30-ollama-native-contract-rerun.json`，不再依賴可能消失的 `/tmp`。

## 綜合判定

- 結論：通過
- round1 阻擋解除情況：
  1. probe schema 已使用 production cue ID enum，新增 native cues／ID／數量／text／reason validator；文件也正確降格為 native smoke，不再宣稱完整重放 production messages／validator。
  2. 完整 raw request／response 與 validation 已保存於專案內版本化 evidence，06 audit／08 changelog 均引用該持久路徑。
- 阻擋問題：無。
- 剩餘風險：
  - native smoke validator 只檢查 shape，且目前以 validation 欄位記錄失敗而非讓 probe 強制 exit nonzero；production strict validator 仍是最終安全門檻。
  - `llama3.2:1b` 仍把全形句號改為半形，合法 JSON 不代表模型品質可自動接受。
  - capability 仍是相容端點觀察；LM Studio、真正斷網、產品 UI／人工接受／取消／續跑與跨平台實機仍未完成。
- 給主要開發代理的具體修正要求：無；可依 closeout 流程更新工作條目並執行最終文件檢查。

**本輪「2026-07-30 — 0.48.x 穩定化：Ollama single-cue contract 修正」round2 獨立複審結論為通過：probe 的 native cue schema 已由任意 integer 收斂為 production ID enum `[1]`，並新增 cues／ID／數量／text／reason shape validator；完整 Ollama 0.32.5／`llama3.2:1b` raw request、response 與 `valid:true` 結果已保存於專案內版本化 evidence，audit／changelog 也改以 native smoke 定位而不再宣稱完整 production replay；production optimizer 的數量、ID、重複 ID、順序、文字與時間碼綁定驗證未被放寬，provider／optimizer 針對性回歸通過，模型將全形句號改為半形的品質風險亦持續誠實揭露，round1 兩項阻擋均已解除，未發現新的阻擋。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前已確認目標路徑不存在，未覆寫既有審查報告。
- 若上述聲明不實，本報告無效。
