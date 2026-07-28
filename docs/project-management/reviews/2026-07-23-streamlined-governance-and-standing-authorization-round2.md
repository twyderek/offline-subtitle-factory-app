# 獨立審查報告：精簡治理必讀流程與建立常設簽章風險授權

- 審查對象 commit／版本：工作樹（基準 commit `142b85ddfd7912621e88d71c19cc817e0079c5b0`）／0.46.0
- 對應 08-CHANGE-LOG 條目：2026-07-23 — 精簡治理必讀流程與建立常設簽章風險授權
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-07-23T15:12:00+08:00；同一獨立審查角色的新一輪上下文，依 governance preflight 重新讀取固定核心、治理路由、round1 報告及修正差異。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - round1 阻擋一已修正：`scripts/test-project-preflight.mjs:6-20` 建立固定核心與七種類型完整 expected matrix，逐類型以 `assert.deepEqual` 深度比對核心與路由；第 21–23 行保留未知類型 exit 2 與 stderr 負例。
  - round1 阻擋二的大部分已修正：`scripts/standing-authorization-validator.mjs:3-8` 檢查 Windows Authenticode 未簽章、macOS 未 Apple Developer ID 簽章／公證、未完成實機測試排除及非立即發布；`scripts/check-project-docs.mjs:51-52` 在一般與 final docs check 都執行 validator；`package.json:16` 把常設授權測試納入完整回歸。
  - `docs/project-management/09-STANDING-AUTHORIZATIONS.md:7-15` 的實際授權內容正確，包含有效狀態、精確平台範圍、未實機測試等排除、非立即發布及可由需求方撤銷／限縮。
  - 未完全通過原因：使用者明示要求正負 fixture 鎖定「撤銷界線」，但 `scripts/test-standing-authorization.mjs:7-12` 的負例沒有替換撤銷條款；測試輸出第 13 行卻宣稱已涵蓋撤銷界線。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - preflight 測試的 parser 會分別擷取「固定核心」與「任務路由」區塊，七類型皆以完整有序陣列比較，能偵測漏項、誤增、錯序及錯名。
  - 常設授權 validator 對平台範圍、明確排除與發布操作使用 marker 加欄位 regex，現有正確文件會通過，刪除關鍵界線會失敗。
  - 撤銷邏輯只有 `scripts/standing-authorization-validator.mjs:3` 的字串 marker `撤銷方式`，沒有驗證可撤銷／限縮、核准角色或附加記錄不刪歷史。實測把第 15 行替換為「撤銷方式：本授權永久有效，不得撤銷或限縮。」後，`validateStandingAuthorization` 回傳 `[]`，矛盾授權仍被接受。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - `node scripts/test-project-preflight.mjs` 實際通過七個有效類型完整矩陣與 `unknown` exit 2。
  - `node scripts/test-standing-authorization.mjs` 實際通過目前的正例，以及移除 Windows、macOS、未實機排除、非立即發布、欄位標題等負例。
  - 額外矛盾撤銷負例指令（2026-07-23 Asia/Taipei）：以 Node 載入實際 09 文件，將 `- 撤銷方式：...` 替換為 `- 撤銷方式：本授權永久有效，不得撤銷或限縮。` 後呼叫 validator；實際輸出 `{"contradictoryRevocationErrors":[]}`。預期至少一個撤銷界線錯誤，實際為零。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - `test-project-preflight.mjs` 的 expected map 清楚且直接對應 production routes，較 round1 的零散 substring assertions 完整。
  - 常設授權驗證已抽成純函式並同時供 docs checker 與單元測試使用，整合方式合理；相關五支 MJS 執行 `node --check` 全部 exit 0。
  - `test-standing-authorization.mjs:13` 的成功訊息超過實際 assertion 覆蓋；validator 對撤銷只檢查標題字樣，是本輪唯一仍未封閉的具體品質問題。

## 5. 測試覆蓋

- 判定：不通過
- 證據：2026-07-23 Asia/Taipei 實際執行下列指令與結果。
  - `node --check scripts/project-preflight.mjs scripts/test-project-preflight.mjs scripts/standing-authorization-validator.mjs scripts/test-standing-authorization.mjs scripts/check-project-docs.mjs`（逐支執行）：全部 exit 0。
  - `node scripts/test-project-preflight.mjs`：exit 0，七種類型完整矩陣與未知類型通過。
  - `node scripts/test-standing-authorization.mjs`：exit 0，既有授權 fixtures 通過。
  - `npm run check`：exit 0；`docs:check` 驗證 19 文件，並完成 preflight、常設授權、治理 validator、媒體、雙語字幕、AI、UI 與核心 API 回歸。
  - `git diff --check`：exit 0。
  - `npm run docs:check:final`：exit 1；目前仍引用 round1 不通過報告且條目為進行中／待 round2，屬主要代理尚未結案的預期狀態。引用本報告並完成條目後仍須重跑至 exit 0。
  - 阻擋缺口：沒有撤銷條款的語意正負 fixture；矛盾撤銷負例已證明目前 checker 會假通過，因此尚不能宣稱鎖定撤銷界線。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 七種 preflight 類型的自動完整矩陣實際通過，round1 對四個中間類型未自動覆蓋的問題已解除。
  - docs checker 已在真實 `npm run check` 路徑執行 standing authorization validator，正確現況通過。
  - 撤銷矛盾 mutation 實際被 checker 核心函式接受，證明剩餘缺口可重現而非理論疑慮。
  - 本輪不涉及打包、部署或公開發布；AUTH-2026-07-23-01 仍只接受簽章／公證風險，不涵蓋未實機測試或本次實際發布操作。

## 綜合判定

- 結論：不通過
- 可逐字引用的完整結論句：**本輪「精簡治理必讀流程與建立常設簽章風險授權」round2 獨立審查結論為不通過：round1 所列七類型完整 preflight 矩陣，以及 Windows Authenticode、macOS Apple Developer ID 簽章／公證、未實機排除與非立即發布的 checker／fixture 缺口均已修正，npm run check 亦完整通過；但常設授權 validator 對撤銷界線只檢查「撤銷方式」字樣，實測「永久有效，不得撤銷或限縮」的矛盾條款仍回傳零錯誤，且測試未建立撤銷負例卻宣稱已涵蓋，因此 NFR-006 的文件防退化驗證仍未完整。**
- 阻擋問題（若有）：
  1. 在 `validateStandingAuthorization` 明確驗證撤銷條款包含需求提出者／產品負責人可「撤銷或限縮」及以新條目附加保留歷史的界線。
  2. 在 `test-standing-authorization.mjs` 增加至少一個移除撤銷語意及一個矛盾「不得撤銷／永久有效」負例，確認 validator 必須失敗。
  3. 修正後另建 round3 複審；通過後由主要代理引用最新報告、結案並將 `npm run docs:check:final` 跑至 exit 0。
- 剩餘風險：
  - 自然語言任務分類仍依賴執行者；不確定時必須使用 `full`。
  - 字串／regex 文件驗證可防止明確條款遺失，但不能完整理解所有自然語言矛盾；fixture 應涵蓋已知高風險反例。
  - 本次不替工作樹中其他既有變更、發布資產或 GitHub 同步狀態背書。
- 給主要開發代理的具體修正要求（若有）：只需補齊上述撤銷語意 validator 與正負 fixture，保留 round1／round2 原文，修正後要求 round3。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
