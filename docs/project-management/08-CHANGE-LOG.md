# 改版與工作紀錄

本文件必須在每次分析、改版、測試、打包或發布開始前建立條目，完成後再補齊結果。最新項目置頂；未完成欄位使用「待執行／待確認」，不得刪除。

## 範本修訂說明（2026-07-20 補強）

自本次補強起，範本新增／變更以下規則，適用於本次之後建立的所有條目；既有歷史條目不回溯修改，只能附加稽核註記並保留原始內容：

1. 新增「變更等級」與「發布授權」欄位：凡變更等級為「發布」（見 `01-PROJECT-GOVERNANCE.md` 變更分類表），發布授權為必填，須記錄核准人／角色、核准時間、核准範圍（例如是否同意在未簽章狀態下對外發布）。非發布等級變更填「不適用」。
2. 「獨立審查結論」欄位改為**連結制**：只能填寫審查檔案路徑（`docs/project-management/reviews/YYYY-MM-DD-<slug>-round<N>.md`）與審查代理自己寫下的最終判定字句（通過／有條件通過／不通過），**不得**由主要開發代理重新轉述審查過程或自行摘要審查代理的推理。詳細規則見 `workflows/04-INDEPENDENT-REVIEW.md`。
3. 若判定為「有條件通過」，須列出條件內容與是否已被「發布授權」欄位中的核准人接受。
4. 「待確認」可在結案後保留，但必須於遺留風險明確說明待人類查證的事實、影響與追蹤方式；「待執行」表示工作未完成，完成條目不得保留。

## 紀錄範本

### YYYY-MM-DD — 工作名稱

- 狀態：規劃中／進行中／完成／受阻
- 執行者：
- 需求來源：
- 關聯需求／缺陷：`FR-xxx`、`NFR-xxx`、`BUG-xxx`
- 變更等級：低／中／高／發布（依 `01-PROJECT-GOVERNANCE.md` 分類）
- 執行前已讀：`AGENTS.md` 與治理文件 00–08（是／否）
- 目標與成功條件：
- 不在範圍：
- 預計影響檔案／模組：
- 風險與回復方式：
- 驗證計畫：
- 實際修改：
- 開發驗證結果：
- 獨立審查是否執行：是／否（若否，依 `04-INDEPENDENT-REVIEW.md` 可跳過情境填寫原因與需求方同意記錄）
- 獨立審查結論：
  - 審查檔案：`docs/project-management/reviews/____.md`
  - 判定（逐字引用審查檔案結論句，並標注章節或行號）：
  - 條件（若為有條件通過）：
  - 條件是否已被需求方接受：是／否／不適用
- 發布授權：
  - 是否需要：是／否（非發布等級填「不適用」）
  - 核准人／角色：
  - 核准時間：
  - 核准範圍（例如是否同意未簽章發布、是否同意跳過實機測試）：
- 部署／發布結果：
- 遺留風險與後續事項：

---

## 2026-07-22 — 修正 0.45.2 updater metadata 並完成發布準備

- 狀態：進行中
- 執行者：Codex 主要開發代理
- 需求來源：使用者要求修正已知問題並完成 0.45.2 發布。
- 關聯需求／缺陷：`NFR-003`、`NFR-004`、`NFR-008`、`BUG-011`
- 變更等級：發布
- 執行前已讀：`AGENTS.md`、治理文件 00–08、測試、獨立審查、打包發布與結案流程（是）
- 目標與成功條件：使 macOS artifact 檔名、`latest-mac.yml` URL、SHA、大小與實際產物一致；重新驗證 macOS 候選，取得 Windows 最新 CI 候選，完成獨立複審後發布 v0.45.2。
- 不在範圍：正式 Apple Developer ID／公證、Windows Authenticode、乾淨實機驗收、真實 Groq／Gemini API smoke test；風險須在 Release notes 揭露。
- 預計影響檔案／模組：`package.json` macOS artifact 命名、`dist/` 產物、治理文件與 GitHub Release。
- 風險與回復方式：若 metadata、checksum、CI artifact 或審查不一致則停止發布；保留既有未提交修改，不使用破壞性 Git 操作。
- 驗證計畫：完整回歸、macOS DMG／ZIP／metadata／SHA 驗證、Windows CI artifact 交叉核對、獨立 round2 複審、發布後 GitHub 資產核對與 `docs:check:final`。
- 實際修改：macOS `artifactName` 已改為 ASCII；初次 Windows CI 交叉核對又發現 Setup／Portable 實際輸出仍為中文檔名而 `latest.yml` 指向 ASCII，已補上 Windows NSIS／Portable 的 ASCII `artifactName` 設定，待重新 CI。
- 開發驗證結果：`npm run check`、macOS 重建、DMG／ZIP／`latest-mac.yml` URL 存在性與完整性驗證通過；Windows run `29886119926` 測試與封裝成功，但因檔名 metadata 不一致，不採用該資產發布，待新 CI run。
- 獨立審查是否執行：待執行。
- 獨立審查結論：待執行。
- 發布授權：
  - 是否需要：是
  - 核准人／角色：需求提出者／產品負責人（本次對話使用者）
  - 核准時間：2026-07-22 本次明確要求
  - 核准範圍：修正問題、重建／核對資產並完成 v0.45.2 GitHub Release；接受未簽章、未公證、未完成實機與真實 API smoke test 風險之揭露。
- 部署／發布結果：待執行。
- 遺留風險與後續事項：待執行；若 Windows CI 無法取得最新來源資產，停止公開發布並回報。

---

## 2026-07-22 — 重建 0.45.2 AI 供應商修正版候選資產

- 狀態：進行中
- 執行者：Codex 主要開發代理
- 需求來源：使用者要求繼續進行；承接已完成的 Groq／Gemini 供應商修正，重新建立可代表目前來源的 0.45.2 候選資產。
- 關聯需求／缺陷：`FR-008`、`FR-009`、`FR-013`、`NFR-001`、`NFR-002`、`NFR-003`、`NFR-004`、`NFR-006`、`NFR-008`、`BUG-010`
- 變更等級：發布（候選資產重建；本次不建立 GitHub Release、不上傳、不對外發布）
- 執行前已讀：`AGENTS.md`、治理文件 00–08、打包發布、獨立審查與文件結案流程（是）
- 目標與成功條件：依目前通過 round5 審查的來源重建可驗證的 macOS arm64 候選 DMG／ZIP；確認版本、runtime manifest、內建手冊／動畫／FFmpeg／Whisper／模型、ad-hoc 簽章與 SHA；Windows 候選若無本機 Windows 建置環境則保留既有 CI 資產為過期狀態，不冒充已重建。
- 不在範圍：GitHub tag／Release、資產上傳、Windows CI 重新觸發、正式簽章／公證、乾淨實機安裝驗收、真實 Groq／Gemini 外部 smoke test。
- 預計影響檔案／模組：`dist/`／electron-builder 產物、runtime manifest、`docs/project-management/00-CURRENT-STATUS.md`、`05-DEVELOPMENT-AND-DEPLOYMENT.md`、`06-TEST-AND-PROCESS-AUDIT.md`、本工作紀錄；不修改產品程式碼。
- 風險與回復方式：封裝可能寫入未追蹤產物或更新 manifest；僅使用專案既定 build 指令與明確產物路徑，建置前保存 Git 狀態，資產不納入來源提交；checksum／版本／資源不一致即停止。
- 驗證計畫：`npm run check`、`runtime:manifest:mac`、`runtime:verify:mac`、`electron:build:mac:dir`、DMG／ZIP／`hdiutil verify`／`unzip -t`／codesign／SHA／資產清單核對，最後由獨立發布候選審查代理驗證。
- 實際修改：依既定指令重建 macOS arm64 未封裝 App、DMG、ZIP 與 blockmap；同步更新目前狀態、開發歷程與測試稽核，未修改產品程式碼。產物位於工作區 `dist/`，未納入來源提交。
- 開發驗證結果：`npm run check` 通過；`electron:build:mac` 完成；App 通過 ad-hoc `codesign` 驗證；DMG `hdiutil verify` 通過；ZIP `unzip -t` 通過；App 內確認 `ai-provider-settings.mjs`、`review.js`、`server.mjs`。DMG SHA-256：`a9b41b8eaf8023a00f39944b2324210d022471e6fd04e821718cd6efaae7cd2d`；ZIP SHA-256：`61a984dd8d927246beeb848a3dbad17b09f2113a775bc7cab5b4115c8eca6e86`。發現 `latest-mac.yml` 使用英文資產檔名，但實際輸出為中文檔名，updater metadata 需修正後複驗。
- 獨立審查是否執行：是（已啟動獨立審查代理；目前因其工具權限核准狀態停滯，報告尚未完成）。
- 獨立審查結論：待執行；不得將本候選標示為完成或可發布。
- 發布授權：
  - 是否需要：是（候選封裝屬發布等級工作；本次不對外發布）
  - 核准人／角色：需求提出者／產品負責人（本次對話使用者；承接 v0.45.2 已有授權）
  - 核准時間：2026-07-20 12:16 CST 前之使用者明確回覆
  - 核准範圍：同意重建 v0.45.2 候選資產；未簽章、未公證、未完成跨平台乾淨實機測試與本次不對外發布的限制均維持揭露，不將候選重建視為 GitHub Release。
- 部署／發布結果：本次不部署、不上傳、不建立 Release。
- 遺留風險與後續事項：先修正 `latest-mac.yml` 資產命名並重新驗證；Windows 候選資產需另由 CI 重建；正式簽章／公證、乾淨實機驗收與真實 Groq／Gemini smoke test 尚未完成；獨立審查代理需完成報告後才能結案。

---

## 2026-07-22 — 完成 0.45.2 AI 供應商整合缺口

- 狀態：完成
- 執行者：Codex 主要開發代理
- 需求來源：使用者提供 `AI-供應商功能待辦進度.md`，要求更新未完成的 0.45.2 已知進度問題。
- 關聯需求／缺陷：`FR-008`、`FR-009`、`NFR-001`、`NFR-002`、`NFR-005`、`NFR-006`、`BUG-010`
- 變更等級：高（涉及外部 AI 供應商、API Key、設定持久化、請求格式與錯誤處理；本次不執行發布）
- 執行前已讀：`AGENTS.md`、治理文件 00–08、需求變更、開發、測試、獨立審查、偵錯與文件結案流程，以及使用者提供的待辦進度文件（是）
- 目標與成功條件：Groq 與 Google Gemini 可被前後端一致識別、分供應商保存／清除金鑰及設定、使用正確驗證與請求協定；切換非 Azure 供應商不殘留 Azure 欄位；連線測試對未保存欄位與金鑰提供可採取行動的錯誤；自動測試覆蓋合法／非法供應商、設定持久化、金鑰隔離、URL／認證及 UI 狀態。
- 不在範圍：新增圖片輸入／vision 功能；目前程式碼與字幕 AI 資料流未傳送圖片，外部待辦所述「5 張圖片超過 4 張限制」缺乏本專案可重現路徑，先列為待確認而不臆測修改。Hot Reload 屬開發流程改善，不納入本次 0.45.2 功能修復；本次不打包、不建立 GitHub Release。
- 預計影響檔案／模組：`server.mjs`、`lib/ai/providers.mjs`、`lib/ai/openai-compatible.mjs`、`public/review.html`、`public/review.js`、AI provider／UI／核心測試，以及需求、設計、測試、偵錯、狀態與工作紀錄文件。
- 風險與回復方式：Gemini 原生 API 與 OpenAI 相容介面格式不同，錯誤適配可能造成假成功或回應無法被 optimizer 驗證；供應商回退可能讓金鑰寫入錯誤槽位。採集中供應商白名單、明確拒絕非法值、分供應商 profile／secret 測試及 provider contract tests；修改可逐檔回復，不遷移字幕資料。
- 驗證計畫：先執行 provider／review UI／core API 相關測試，涵蓋 Groq、Gemini、非法 provider、查詢參數認證不洩漏 Authorization、profile 與 runtime key 隔離、Azure 欄位切換、連線前欄位驗證；再執行 `npm run check`、必要實際 UI 驗證、`git diff --check` 與獨立六面向審查。
- 實際修改：provider registry 新增 Groq／Gemini、共用合法 ID 與供應商預設 Base URL；server settings／profile／runtime-key／DELETE key 明確驗證 provider 並按供應商隔離 profile 與 secrets；Gemini models 使用 `x-goog-api-key`、OpenAI 相容 chat completions 使用 Bearer，API Key 不進 URL；UI 增加兩個供應商、非 Azure 欄位清空停用、清除指定供應商金鑰、連線前保存狀態驗證；新增 `ai-provider-settings.mjs` 保存 profile 快照並阻擋未儲存 provider／Base URL／model／Azure deployment／API version；同步更新需求、設計、歷程、測試、偵錯、狀態、Release notes 與封裝 renderer 驗證。
- 開發驗證結果：2026-07-22 macOS／Node.js v22.22.3：provider、review UI、core API 與完整 `npm run check` 在允許本機 listen 的環境通過；本機瀏覽器實測 Groq／Gemini／Azure 切換、預設 URL 與 Azure 欄位狀態通過。round1 後新增可執行表單狀態測試及實際瀏覽器案例：已有 Groq key/profile 時把模型改為 `unsaved-model` 後按「測試連線」，畫面顯示「供應商、Base URL 或模型已有未儲存變更；請先儲存設定」、按鈕恢復可用，server log 無 `/api/ai/test` 請求。Google 官方文件核對 OpenAI 相容端點與 Bearer 認證完成。圖片限制問題經 `rg` 查證目前 AI 字幕資料流無圖片輸入／`image_url`，不做無重現修正。
- 獨立審查是否執行：是（round1–round5；前兩輪阻擋由主要代理修正，round3 功能審查通過，round4／round5 依序補齊完整判定句及治理檢查器要求的精確欄位格式）
- 獨立審查結論：
  - round1 審查檔案：`docs/project-management/reviews/2026-07-22-ai-provider-integration-gaps-round1.md`
  - round1 判定（逐字引用「綜合判定」）：**不通過**
  - round1 處理狀態：已新增已保存 profile 快照、未保存欄位比較、可執行狀態測試與瀏覽器實測；測試前阻擋未保存 provider／Base URL／model，Azure 另比較 deployment／apiVersion，且確認阻擋時不發送 `/api/ai/test`。round1 報告保持原文、不覆寫，待 round2 複審。
  - round2 審查檔案：`docs/project-management/reviews/2026-07-22-ai-provider-integration-gaps-round2.md`
  - round2 判定（逐字引用「綜合判定」）：**不通過**
  - round2 處理狀態：已將完整連線流程抽成可注入的 `runProviderConnectionTest` 控制器；自動測試實際執行控制器並計數 request，覆蓋未保存 provider／Base URL／model／Azure deployment／apiVersion／API Key 與無已保存 key 均為 0 次請求，已保存未變更 profile 為 1 次；阻擋、成功、HTTP 失敗及 fetch 例外後按鈕皆恢復可用。round2 報告保持原文、不覆寫，待 round3 複審。
  - round3 審查檔案：`docs/project-management/reviews/2026-07-22-ai-provider-integration-gaps-round3.md`
  - round3 判定（逐字引用「綜合判定」）：**通過**
  - round3 阻擋問題：無。
  - 條件：不適用。
  - 條件是否已被需求方接受：不適用。
  - round4 審查檔案：`docs/project-management/reviews/2026-07-22-ai-provider-integration-gaps-round4.md`
  - round4 判定（逐字引用「綜合判定」）：**本輪 round4 獨立審查結論為通過：必要最小複審確認 round3 已驗證的實際 handler 共用連線控制器、未保存設定與金鑰的零請求阻擋、合法設定的單次請求、所有成功與失敗路徑按鈕恢復、Groq／Gemini 契約、MIME、key 隔離及治理追溯均未回歸，且本輪未發現未處理阻擋問題。**
  - round4 阻擋問題：無。
  - 條件：不適用。
  - 條件是否已被需求方接受：不適用。
  - round5 審查檔案：`docs/project-management/reviews/2026-07-22-ai-provider-integration-gaps-round5.md`
  - round5 判定（逐字引用「綜合判定」）：**本輪 round5 獨立審查結論為通過：必要最小複審確認 round3 已驗證的實際 handler 共用連線控制器、未保存設定與金鑰的零請求阻擋、合法設定的單次請求、所有成功與失敗路徑按鈕恢復、Groq／Gemini 契約、MIME、key 隔離及治理追溯均未回歸，且本輪未發現未處理阻擋問題。**
  - round5 阻擋問題：無。
  - 條件：不適用。
  - 條件是否已被需求方接受：不適用。
- 發布授權：
  - 是否需要：不適用（本次不發布）
  - 核准人／角色：不適用
  - 核准時間：不適用
  - 核准範圍：不適用
- 部署／發布結果：本次不部署、不打包、不發布。
- 遺留風險與後續事項：真實 Groq／Gemini 外部 smoke test、修正後 Windows／macOS 候選重建與乾淨實機驗證尚未執行；圖片限制問題目前待確認其來源、重現資料與實際呼叫路徑，目前程式碼未發現圖片傳送功能。

---

## 2026-07-22 — 目前進度盤點

- 狀態：完成
- 執行者：Codex 主要開發代理
- 需求來源：使用者要求先更新本專案目前進度。
- 關聯需求／缺陷：`NFR-006`、`NFR-008`
- 變更等級：低（治理與狀態盤點；未修改產品行為、未打包、未發布）
- 執行前已讀：`AGENTS.md` 與治理文件 00–08（是）
- 目標與成功條件：以目前工作樹、版本、分支、治理文件與既有驗證紀錄為依據，更新並回報可查證的開發／發布進度，區分公開版、候選版與未完成事項。
- 不在範圍：產品功能修改、打包、部署、GitHub Release、跨平台實機驗收。
- 預計影響檔案／模組：`docs/project-management/08-CHANGE-LOG.md`；本次不預期修改產品程式碼。
- 風險與回復方式：工作樹已有使用者既存修改；僅新增本盤點紀錄，不覆蓋或重置既有變更，必要時可由 Git 差異回溯。
- 驗證計畫：`npm run project:preflight`、Git 狀態／紀錄盤點、`npm run docs:check`、`git diff --check`。
- 實際修改：新增本次進度盤點紀錄；確認目前版本 `0.45.2`、分支 `codex/release-v0.45.2`、公開版 `v0.45.1`、候選資產狀態及既有未完成風險。
- 開發驗證結果：已完成 preflight；工作樹含既存修改與兩份 v0.45.2 發布審查報告；治理文件檢查與差異檢查於本條目完成後執行。
- 獨立審查是否執行：否（本次為低等級只讀進度盤點與治理紀錄，不改產品行為、不發布；依獨立審查流程之低風險文件／盤點情境跳過）
- 獨立審查結論：不適用。
- 發布授權：
  - 是否需要：不適用
  - 核准人／角色：不適用
  - 核准時間：不適用
  - 核准範圍：不適用
- 部署／發布結果：不適用；本次未部署、未打包、未發布。
- 遺留風險與後續事項：v0.45.2 仍是候選版本，尚未完成 GitHub Release、Windows／macOS 乾淨實機 smoke test、正式簽章／公證與 npm audit runtime/build-only 分類；既存工作樹修改仍待其原工作項目完成或結案。

---

## 2026-07-20 — 發布多語言 LLM v0.45.2

- 狀態：進行中
- 執行者：Codex 主要開發代理
- 需求來源：使用者要求繼續，並於 2026-07-20 12:16 前明確同意發布 v0.45.2，接受 Windows 未簽章、macOS 未公證及尚未完成跨平台乾淨實機測試的風險。
- 關聯需求／缺陷：`FR-008`、`FR-009`、`FR-013`、`NFR-001`、`NFR-002`、`NFR-003`、`NFR-004`、`NFR-006`、`NFR-008`、`BUG-009`
- 變更等級：發布
- 執行前已讀：`AGENTS.md`、治理文件 00–08、打包發布、獨立審查與文件結案流程（是）
- 目標與成功條件：將已通過開發審查的多語言 LLM 功能定版為 0.45.2；更新版本、手冊與 Release notes；本機建立並驗證 macOS DMG／ZIP；由 Windows 2022 CI 建立 Setup／Portable 並驗證封裝；產生 SHA；獨立發布審查無未處理阻擋；GitHub tag／Release／資產名稱、大小、digest 與下載結果一致。
- 不在範圍：Windows Authenticode、Apple Developer ID／notarization、跨平台乾淨實機安裝驗收、雙語 cue／輸出、介面完整本地化。
- 預計影響檔案／模組：版本檔、Windows workflow、README、`RELEASE-NOTES-0.45.2.md`、`docs/0.45.2/`、治理文件、Git branch／commit／tag、macOS 與 Windows 發布資產。
- 風險與回復方式：未簽章／未公證可能觸發 OS 警示；未實機測試可能遺漏平台問題；模型語言遵循受供應商影響。Release notes、狀態與交付均明確揭露；checksum 或封裝驗證不一致立即停止；已發布後若發現核心缺陷，停止導流並發布可追溯修正版，不靜默替換。
- 驗證計畫：`npm run check`、`docs:check:final`、runtime manifest／verify、macOS unpacked／DMG／ZIP、codesign 與 SHA；Windows Actions 完整測試、archive／手冊／runtime／簽章狀態與 SHA；獨立六面向發布審查；GitHub Release 上傳後名稱／大小／digest／下載核對。
- 實際修改：版本更新為 0.45.2；新增多語言 Release notes 與內建 `docs/0.45.2` 手冊；README 更新版本與風險；macOS／Windows 均封裝 0.45.2 手冊；Windows workflow 更新為 0.45.2 分支／tag／artifact／手冊驗證；建立 `codex/release-v0.45.2`、commit `168abd7` 與 PR #6。
- 開發驗證結果：`npm run check` 通過；macOS runtime verify、arm64 App、DMG、ZIP、`hdiutil verify`、`unzip -t`、版本、ad-hoc codesign、手冊／動畫／FFmpeg／Whisper／模型檢查通過；macOS SHA 已產生。Windows Actions run `29716922238` 在 Windows Server 2022 通過完整回歸、runtime、未簽章建置、archive、0.45.2 手冊及 artifact；下載 433 MB artifact 後，本機 SHA 與 runner 完全一致，Setup／Portable `7za t` 均為 `Everything is Ok`，Portable 清單包含語言模組、0.45.2 手冊／動畫、manifest 與模型。Actions 有 Node 20 淘汰警告但不影響本輪結果。
- 獨立審查是否執行：是（發布資產完成後執行）
- 獨立審查結論：
  - round1 審查檔案：`docs/project-management/reviews/2026-07-20-release-v0-45-2-round1.md`
  - round1 判定（逐字引用「綜合判定」）：**本輪 round1 獨立發布審查結論為不通過：候選 commit、PR／Windows CI、版本、SHA、Windows latest.yml、封裝內容與未簽章／ad-hoc 簽章證據均可追溯，Release notes 與發布授權也完整接受並揭露 Windows 未簽章、macOS 未公證及未完成跨平台乾淨實機測試；但 00-CURRENT-STATUS 仍列 0.45.1 資產並錯稱多語言版本尚未跨平台封裝，且 latest-mac.yml 指向不存在的非發布檔名，因此發布狀態真實性與 updater 資產一致性尚有兩項未處理阻擋。**
  - round1 處理狀態：已將目前狀態改為區分 v0.45.1 公開版與 v0.45.2 候選資產，並明示候選封裝完成但乾淨實機驗證未完成；已將 `latest-mac.yml` 的 ZIP／DMG URL 與 path 改為實際 ASCII 發布檔名，保留並重新核對原檔 SHA-512 與大小，待 round2 複審。
  - round2 審查檔案：`docs/project-management/reviews/2026-07-20-release-v0-45-2-round2.md`
  - round2 判定（逐字引用「綜合判定」）：**本輪 round2 獨立發布審查結論為通過：round1 的狀態文件矛盾與 macOS updater 檔名不一致均已解除，00-CURRENT-STATUS 現在準確區分 v0.45.1 公開版與 v0.45.2 候選並明示 Windows 未簽章、macOS 未公證及未完成跨平台乾淨實機測試，latest-mac.yml 的 ASCII ZIP／DMG 名稱、實際大小與重新計算的 SHA-512 亦完全一致；結合候選 commit、Windows CI、完整回歸、版本、封裝、SHA 與簽章狀態證據，發布前六面向未發現未處理阻擋問題。**
  - round2 阻擋問題：無；可進入 tag／Release 與上傳步驟，發布後仍須核對 GitHub 實際資產、digest、checksum、updater metadata 與下載 URL。
  - 條件（若為有條件通過）：不適用。
  - 條件是否已被需求方接受：是；使用者明確接受本條所列未簽章、未公證與未完成跨平台乾淨實機測試風險。
- 發布授權：
  - 是否需要：是
  - 核准人／角色：需求提出者／產品負責人（本次對話使用者）
  - 核准時間：2026-07-20 12:16 CST 前之使用者明確回覆
  - 核准範圍（例如是否同意未簽章發布、是否同意跳過實機測試）：使用者同意發布 v0.45.2，並接受 Windows 未簽章、macOS 未公證，以及尚未完成跨平台乾淨實機測試的風險。
- 部署／發布結果：待執行。
- 遺留風險與後續事項：待確認；影響為 OS 信任警示及平台相容性可能未完全覆蓋，追蹤方式為發布說明揭露、SHA 核對與後續 Windows／macOS 實機 smoke test。

---

## 2026-07-20 — 多語言 LLM 字幕優化支援

- 狀態：完成
- 執行者：Codex 主要開發代理
- 需求來源：使用者要求依專案規範推進為可支援多語言 LLM 的版本。
- 關聯需求／缺陷：新增 `FR-013`；`FR-008`、`FR-009`、`FR-012`、`NFR-001`、`NFR-002`、`NFR-006`
- 變更等級：高（涉及 AI Prompt、設定持久化、API、UI、外部文字傳輸與相容性；本次不發布）
- 執行前已讀：`AGENTS.md`、治理文件 00–08、需求變更、開發、測試、獨立審查、偵錯、文件結案流程及 `AI-ROADMAP-0.50.md`（是）
- 目標與成功條件：建立正規化多語言模型；使用者可選擇常用目標語言或自訂 BCP 47 語言標籤；設定可保存／載入；翻譯與一般優化 Prompt 明確遵守目標語言；provider 共用且不改變 cue ID、數量、順序與時間碼；舊設定無損回退；自動測試覆蓋 API、Prompt、UI 與邊界輸入。
- 不在範圍：雙語 cue 資料模型與雙語 SRT／VTT／ASS 輸出、UI 介面語系本地化、自動偵測或下載本機 LLM、打包與 GitHub 發布。
- 預計影響檔案／模組：`server.mjs`、`lib/ai/subtitle-optimizer.mjs`、`public/review.html`、`public/review.js`、AI／UI／核心測試、需求／設計／狀態／測試與工作紀錄文件。
- 風險與回復方式：無效語言標籤造成 Prompt 注入或語意不穩；以白名單常用語言、嚴格 BCP 47 正規化、顯示名稱長度限制及後端重新驗證隔離。舊設定維持預設繁體中文；可逐檔回復且不遷移字幕資料。
- 驗證計畫：需求→測試追溯；語言正規化單元測試；optimizer Prompt 與 cue 保護測試；設定 API 金鑰隔離與舊設定回退；UI 控制與持久化測試；`npm run check`；必要人工 UI 驗證；獨立代理建立六面向審查報告。
- 實際修改：新增共用 `lib/ai/languages.mjs`，以 `Intl.getCanonicalLocales` 驗證並標準化最長 255 字元 BCP 47 標籤；設定 UI 提供 12 個常用語言與自訂欄位；一般設定、AI 專用設定及 AI 任務 API 統一拒絕新非法值，舊磁碟設定仍回退繁中；optimizer 對翻譯與其他模式建立明確目標語言指令，嚴格拒絕 cue 數量、ID 或順序異常；同步更新需求、設計、歷程、測試及偵錯文件。
- 開發驗證結果：2026-07-20（Asia/Taipei）三次修正後完整 `npm run check` 均通過最後一次結果，包含治理文件、JavaScript 語法、媒體、AI optimizer/provider、review UI 與核心整合測試；核心測試驗證三個 API 非法值 400、舊磁碟設定啟動回退與多語設定保存。瀏覽器實際操作確認 12 個常用選項可見，切換「自訂 BCP 47」會顯示欄位並可輸入 `fr-CA`。`git diff --check` 通過。
- 獨立審查是否執行：是（round1–round3；前兩輪阻擋由主要代理修正，round3 通過）
- 獨立審查結論：
  - round1 審查檔案：`docs/project-management/reviews/2026-07-20-multilingual-llm-support-round1.md`
  - round1 判定（逐字引用「綜合判定」）：**本輪 round1 獨立審查結論為不通過：多語言設定、專用 API 驗證、舊值回退與目標語言 Prompt 的基本路徑已建立，現有完整自動測試亦通過，但 AI 回傳 cue 順序交換未被拒絕且會把建議綁到錯誤的原文與時間碼，並且自訂驗證器拒絕合法 BCP 47 variant／extension，因此 FR-008、FR-013 與設計所要求的 cue 順序／時間碼保護及自訂 BCP 47 支援尚未達成。**
  - round1 處理狀態：已嚴格拒絕 cue 順序交換；改由 `Intl.getCanonicalLocales` 驗證並接受 variant／extension；一般設定 API 統一拒絕新非法值；新增交換順序、完整語言標籤、三個 API 邊界及舊設定啟動回退測試。round1 報告保持原文、不覆寫，待 round2 複審。
  - round2 審查檔案：`docs/project-management/reviews/2026-07-20-multilingual-llm-support-round2.md`
  - round2 判定（逐字引用「綜合判定」）：**本輪 round2 獨立審查結論為不通過：round1 的 cue 順序與 metadata 錯配、代表性 BCP 47 variant／extension、三個新 API 非法值拒絕及舊磁碟設定啟動回退均已修正且完整自動測試通過，但後端與 UI 仍以未具需求或標準依據的 35 字元上限拒絕可由 `Intl.getCanonicalLocales` 接受的合法 BCP 47 標籤，因此 FR-013 的自訂 BCP 47 支援尚未完整達成。**
  - round2 處理狀態：已將前後端自訂標籤上限統一為 BCP 47 通用最大長度 255，新增 40 字元合法 extension 正向測試、超長負向測試及 UI maxlength 契約測試；round2 報告保持原文、不覆寫，待 round3 複審。
  - round3 審查檔案：`docs/project-management/reviews/2026-07-20-multilingual-llm-support-round3.md`
  - round3 判定（逐字引用「綜合判定」）：**本輪 round3 獨立審查結論為通過：後端與 UI 的 BCP 47 上限已同步為 255 字元，獨立探針及回歸測試確認 40 與 255 字元合法標籤可接受、256 字元及注入值會拒絕；round1 的 cue 順序／metadata 保護、variant／extension、三個新 API 非法值 400 與舊磁碟設定啟動回退亦均未回歸，六面向未發現未處理阻擋問題。**
  - round3 阻擋問題：無。
  - 條件（若為有條件通過）：不適用。
  - 條件是否已被需求方接受：不適用。
- 發布授權：
  - 是否需要：不適用（本次不是發布等級）
  - 核准人／角色：不適用。
  - 核准時間：不適用。
  - 核准範圍（例如是否同意未簽章發布、是否同意跳過實機測試）：不適用。
- 部署／發布結果：本次不打包、不部署、不發布。
- 遺留風險與後續事項：真實供應商模型是否完全遵循目標語言仍受模型能力影響，須由使用者逐段確認建議；常用語言清單在 HTML 與後端重複維護，擴充時需同步；本輪未打包、未做 Windows／macOS 實機驗證，也未實作雙語 cue／輸出或介面本地化。

## 2026-07-20 — 補強獨立審查證據與發布授權治理

- 狀態：完成
- 執行者：Codex 主要開發代理
- 需求來源：使用者提供「專案規範與治理」全文及 `files.zip` 內兩份治理文件，要求導入審查證據獨立化、發布授權與歷史缺口規則。
- 關聯需求／缺陷：`NFR-006`、`NFR-008`
- 變更等級：中（原分類為低；round1 審查確認 `docs:check:final` 是合併／結案門檻且具有流程行為影響，故於開發中立即升級並記錄原因；不改變字幕產品行為、不發布）
- 執行前已讀：`AGENTS.md` 與治理文件 00–08（是；另已讀需求變更、測試、獨立審查及文件結案流程）
- 目標與成功條件：治理文件完整反映使用者規範；獨立審查以不可由主要代理代寫的獨立檔案留證；發布等級工作必須具可查核授權；歷史缺口不得回溯偽造；自動檢查能驗證新範本與結案語意。
- 不在範圍：修改字幕產品功能、重新打包或發布 0.45.1、替歷史工作補造審查或授權證據。
- 預計影響檔案／模組：`01-PROJECT-GOVERNANCE.md`、`08-CHANGE-LOG.md`、`workflows/04-INDEPENDENT-REVIEW.md`、相關治理入口／稽核文件與 `scripts/check-project-docs.mjs`。
- 風險與回復方式：新規則可能與舊紀錄格式衝突；保留舊紀錄並新增稽核註記，差異可由版本控制逐檔回復。
- 驗證計畫：`npm run docs:check`、治理檢查器情境測試、`npm run check`、`git diff --check`，再由獨立只讀審查代理依六面向驗證並自行建立獨立報告。
- 實際修改：合併 `files.zip` 的獨立審查流程與工作紀錄範本；更新治理、AGENTS、稽核與結案文件，明定審查報告獨立留證、發布授權、歷史缺口及「待確認／待執行」語意；新增結構化 `project-docs-validator.mjs` 並由 `check-project-docs.mjs` 的 final 模式驗證欄位、審查檔名／內容／逐字引用、跳過授權與發布授權區塊；新增正負 fixture 測試並納入 `npm test`。
- 開發驗證結果：2026-07-20（Asia/Taipei）執行兩支治理檢查器 `node --check`、`node scripts/test-project-docs-validator.mjs`、`npm run docs:check`、`git diff --check` 通過；修正前後 `npm run check` 的文件、語法、治理 fixture、媒體、AI provider／optimizer、校閱 UI 均通過，核心整合測試在 sandbox 因本機 listen `EPERM` 中止；經授權於 sandbox 外重跑修正後 `npm test`，全部測試（含核心 API 與任務回歸）通過。
- 獨立審查是否執行：是（round1–round7；前六輪阻擋均由主要代理修正，round7 通過）
- 獨立審查結論：
  - round1 審查檔案：`docs/project-management/reviews/2026-07-20-governance-evidence-and-release-authorization-round1.md`
  - round1 判定（逐字引用「綜合判定」第 66 行）：**本輪獨立審查結論為不通過：治理文件已涵蓋審查證據獨立化、歷史缺口、發布授權與變更分類原則，但 `docs:check:final` 仍會誤判敘述中的「待確認／待執行」，且會漏判不完整審查報告、未授權跳過審查與欄位歸屬錯誤的發布授權，因此 NFR-006 與 NFR-008 的自動治理門檻尚未達成。**
  - round1 處理狀態：四項阻擋問題已由主要開發代理修正並新增 fixture 測試；round1 報告保持原文、不覆寫，待 round2 複審。
  - round2 審查檔案：`docs/project-management/reviews/2026-07-20-governance-evidence-and-release-authorization-round2.md`
  - round2 判定（逐字引用「綜合判定」第 70 行）：**本輪 round2 獨立審查結論為不通過：round1 的敘述性保留字誤判、基本報告結構、跳過審查與授權區塊檢查已有改善，但 final gate 仍會漏判「待執行獨立審查」、優先採用 round1 不通過報告而忽略後續輪次，並接受「使用者要求發布」作為發布授權，因此四項阻擋尚未全部解除。**
  - round2 處理狀態：已修正待執行中文字尾、多輪最高 round 選擇、最新不通過／有條件通過關卡、籠統需求動作授權、逐項風險涵蓋與路徑先驗證；fixture 已補齊，待 round3 複審。
  - round3 審查檔案：`docs/project-management/reviews/2026-07-20-governance-evidence-and-release-authorization-round3.md`
  - round3 判定（逐字引用「綜合判定」第 68 行）：**本輪 round3 獨立審查結論為不通過：待執行中文字尾、最高 round 選擇、不通過結論、逐項發布風險與路徑先驗證均已修正，但舊 round 的條件接受狀態仍可掩蓋最新 round 的未接受條件，且「需求方要求進行發布」等籠統需求動作仍可被誤認為發布授權，因此 round2 四項阻擋尚未完全解除。**
  - round3 處理狀態：已將條件接受狀態綁定最高 round，並正規化與拒絕需求方／使用者要求或請求打包／發布的籠統措辭；新增對應 fixture，待 round4 複審。
  - round4 審查檔案：`docs/project-management/reviews/2026-07-20-governance-evidence-and-release-authorization-round4.md`
  - round4 判定（逐字引用「綜合判定」第 66 行）：**本輪 round4 獨立審查結論為不通過：最高 round 的條件接受狀態已正確局部綁定，且既有標點與「進行發布」fixture 可攔截，但「需求方提出發布要求」及「需求方要求進行發布後提供下載」仍能充當發布授權，因此 round3 的籠統需求動作阻擋尚未完全解除。**
  - round4 處理狀態：發布授權改採正向格式，核准範圍必須同時含同意／核准／接受及打包／發布，並保留已知風險逐項涵蓋；正負 fixture 已新增，待 round5 複審。
  - round5 審查檔案：`docs/project-management/reviews/2026-07-20-governance-evidence-and-release-authorization-round5.md`
  - round5 判定（逐字引用「綜合判定」第 67 行）：**本輪 round5 獨立審查結論為不通過：round4 指出的需求動作語序與尾綴繞過已修正，且明示核准正向案例不會被過度攔截，但「不同意發布」「未核准發布」「不接受未簽章發布」仍因包含正向關鍵字而被視為有效授權，因此發布授權正向格式尚未可靠。**
  - round5 處理狀態：已拒絕不／未修飾的同意／核准／接受，並在逐項風險檢查拒絕否定接受；新增整體否定與風險否定 fixture，待 round6 複審。
  - round6 審查檔案：`docs/project-management/reviews/2026-07-20-governance-evidence-and-release-authorization-round6.md`
  - round6 判定（逐字引用「綜合判定」）：**本輪 round6 獨立審查結論為不通過：整句「不同意／未核准／不接受」已能被攔截，完整正向接受也能通過，但「同意未簽章、未實機測試發布，但未公證風險拒絕接受」仍被判為有效授權，顯示每項已知風險必須獲得接受的要求尚未可靠落實，且缺少部分接受／部分拒絕的回歸 fixture。**
  - round6 處理狀態：只要核准範圍含拒絕、不同意、未核准或不接受即整體拒絕；新增部分接受／部分拒絕與三項風險完整接受 fixture，待 round7 複審。
  - round7 審查檔案：`docs/project-management/reviews/2026-07-20-governance-evidence-and-release-authorization-round7.md`
  - round7 判定（逐字引用「綜合判定」）：**本輪 round7 獨立審查結論為通過：發布授權核准範圍現在會阻擋任何含「拒絕／不同意／未核准／不接受」的整句或混合拒絕語意，round6 的部分接受／部分拒絕繞過已修正，且 fixture 與獨立案例矩陣均確認整句否定、混合拒絕及三項已知風險完整正向接受的結果符合預期。**
  - round7 阻擋問題：無。
- 發布授權：不適用（本次不是發布等級變更）
- 部署／發布結果：不適用；本次未打包、部署或發布，也未修改現有 Release。
- 遺留風險與後續事項：自動檢查只能驗證格式、明示文字與部分一致性，不能證實核准人身分、核准事實或審查證據內容的真實性；未列入規則的新型風險仍須人工判斷。本次沒有未處理阻擋問題。

## 2026-07-20 — 建立專案治理與改版前必讀制度

- 狀態：完成
- 執行者：Codex 主要開發代理
- 需求來源：使用者要求依專案管理流程建立完整參考文件，並強制每次改版前閱讀與留存紀錄。
- 關聯需求／缺陷：`NFR-006`、`NFR-008`
- 執行前已讀：`AGENTS.md`、README、FINAL-VERSION-LOG、NEXT-VERSION-FIX-LOG、package／workflow 與現有文件（是；本目錄為本次建立成果）
- 目標與成功條件：建立單一文件入口、七類治理資料、目前狀態、必讀順序、工作紀錄範本、自動檢查與 AGENTS 強制規範。
- 不在範圍：修改字幕功能、重新打包 0.45.1、改動 Release 資產。
- 預計影響檔案／模組：上層 `AGENTS.md`、`docs/project-management/*`、`scripts/project-*.mjs`、`package.json`。
- 風險與回復方式：文件與實況不一致；以程式碼、測試、GitHub Release 證據交叉查證，未知項標示未覆蓋。
- 驗證計畫：執行 `project:preflight`、`docs:check`、`npm run check`、`git diff --check`，再由獨立只讀代理六面向審查。
- 實際修改：更新上層與 repo 內 `AGENTS.md` 強制前置程序；建立 00–08 分類治理文件；另將需求、開發、測試、審查、偵錯、發布、結案拆成七個獨立流程檔；新增 `project:preflight`、`docs:check`、`docs:check:final`，把一般文件檢查納入 `npm run check`，並以 final 模式阻擋最新工作紀錄未結案。
- 開發驗證結果：`project:preflight` 正確列出版本、分支、Git 狀態、11 份共通必讀與流程提示；`docs:check` 驗證 18 個治理文件與 repo 規範通過；`docs:check:final` 驗證最新紀錄已完成且無未決欄位；兩支治理腳本 `node --check`、`git diff --check` 與完整 `npm run check` 通過。
- 獨立審查結論（原始記錄，未附獨立審查檔案，本次補強前之歷史證據，未回溯補檔）：首次六面向只讀審查提出 repo 外 AGENTS 可攜性與未結案門檻風險；主要代理加入 repo 內 `AGENTS.md`、Git 偵測警告與 `docs:check:final`，並統一治理入口的結案命令。最終複審六面向全部通過，阻擋問題 0；審查代理全程未修改檔案。
  - **稽核註記（本次補強新增）：本條目的審查結論由主要開發代理轉述，未附審查代理獨立產出的檔案，不符合本次補強後的證據獨立化規則。此紀錄只能視為歷史缺口，不得作為目前治理制度已通過獨立驗證的可信依據；不得回溯補造聲稱代表當時產出的報告。**
- 部署／發布結果：本次為治理文件與檢查工具更新，不重新打包、不部署、不修改既有 0.45.1 Release。
- 遺留風險與後續事項：自動檢查以結構與關鍵內容為主，不能取代人工閱讀與內容正確性判斷；需求到測試的完整關聯仍依工作紀錄人工維護。後續可視紀錄量再導入結構化 schema。

## 2026-07-17 — 發布 0.45.1 Windows 與操作說明

- 狀態：完成
- 執行者：Codex 主要開發代理
- 需求來源：使用者要求 Windows 打包、GitHub 發布與內建完整說明。
- 關聯需求／缺陷：`FR-009`、`FR-011`、`FR-012`、`NFR-008`、`BUG-004` 至 `BUG-008`
- 執行前已讀：當時依既有 AGENTS 與相關發布文件執行；本治理目錄尚未建立。
- 目標與成功條件：Setup／Portable 可下載；內含離線手冊；Release 說明、SHA 與簽章狀態完整。
- 不在範圍：購買或配置程式碼簽章憑證、Windows 實機 smoke test。
- 預計影響檔案／模組：AI provider、校閱 UI、測試、workflow、打包資源、README、release notes、說明網站。
- 風險與回復方式：未簽章警示；以清楚標示與 SHA 驗證降低風險。
- 驗證計畫：完整回歸、Windows runner、封裝內容、ffprobe、SHA、獨立審查與發布後 digest 核對。
- 實際修改：完成 Azure GPT-5 相容、AI 面板收合、圖文／動畫手冊、Windows 封裝與 Release。
- 開發驗證結果：本機與 CI 通過；Setup／Portable archive、手冊資產、SHA 與 GitHub digest 已核對。
- 獨立審查結論：在明確揭露未簽章風險前提下有條件通過。
  - **稽核註記（本次補強新增）：本條目未記錄審查檔案路徑，也未記錄發布授權所需的核准人、時間與範圍。0.45.1 屬「發布」等級；發布授權狀態為「待確認」，不得推定當時已核准未簽章、未公證或未實機測試等風險，也不得回溯補造證據。應由需求方／產品負責人另行確認或明確追認。**
- 部署／發布結果：v0.45.1 已發布 macOS 與 Windows；線上手冊已部署。
- 遺留風險與後續事項：Windows 實機 smoke test、正式簽章、公證、npm audit 分類。
