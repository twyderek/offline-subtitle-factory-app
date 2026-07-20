# 專案管理文件入口

本目錄是「離線字幕工廠」後續分析、改版、測試、打包與發布的單一治理入口。舊版根目錄文件保留為歷史證據；若內容衝突，以經實際程式碼、測試與 Release 查證後更新的本目錄文件為準。

## 每次執行前必讀順序

1. repo 內的 `AGENTS.md`：可隨 repo 移動的強制協作與獨立審查規則；上層 workspace `../AGENTS.md` 若存在亦須遵守。
2. `00-CURRENT-STATUS.md`：目前版本、發布狀態、已知風險與下一步。
3. `01-PROJECT-GOVERNANCE.md`：角色、階段關卡、文件責任與變更控制。
4. `02-REQUIREMENTS-ANALYSIS.md`：使用者、目標、功能／非功能需求與驗收準則。
5. `03-FUNCTIONAL-DESIGN.md`：系統邊界、模組、資料與主要流程。
6. `04-DEVELOPMENT-HISTORY.md`：版本演進、重要決策與發展脈絡。
7. `05-DEVELOPMENT-AND-DEPLOYMENT.md`：開發、建置、簽章、打包與發布方法。
8. `06-TEST-AND-PROCESS-AUDIT.md`：測試矩陣、證據與流程稽核。
9. `07-DEBUG-AND-FIX-HISTORY.md`：已知問題、根因、修正與防回歸措施。
10. `08-CHANGE-LOG.md`：建立或續寫本次工作紀錄。

完成共通必讀後，依任務類型再閱讀 `workflows/` 中的對應流程；同一任務涉及多種工作時需閱讀全部相關流程：

- 需求新增／調整：`workflows/01-REQUIREMENT-CHANGE.md`
- 程式開發：`workflows/02-DEVELOPMENT.md`
- 測試與驗收：`workflows/03-TEST-VALIDATION.md`
- 獨立審查：`workflows/04-INDEPENDENT-REVIEW.md`
- 偵錯與修正：`workflows/05-DEBUG-FIX.md`
- 打包與發布：`workflows/06-BUILD-RELEASE.md`
- 文件同步與結案：`workflows/07-DOCUMENT-CLOSEOUT.md`

執行 `npm run project:preflight` 可列出上述清單與目前版本；閱讀仍須由執行者實際完成，指令不能取代閱讀。

## 每次改版的固定流程

1. **立項**：建立可執行計畫；在 `08-CHANGE-LOG.md` 先寫需求、範圍、風險與驗證計畫。
2. **需求確認**：更新需求 ID、驗收準則與不在範圍內事項。
3. **設計**：更新受影響模組、資料流、錯誤處理、安全與相容性設計。
4. **開發**：小步修改；不得覆蓋使用者既有變更；所有決策留下理由。
5. **開發驗證**：依風險執行語法、單元、整合、封裝及實機測試，保存指令與結果。
6. **獨立審查**：完成開發後，由獨立只讀代理依六面向審查並自行建立獨立報告；問題由主要代理修正並視影響要求複審。
7. **部署／發布**：先取得並記錄涵蓋實際風險的發布授權，再確認版本、簽章、校驗碼、Release notes、資產與下載連結。
8. **結案**：更新目前狀態、歷程、測試稽核、偵錯紀錄及工作紀錄；執行 `npm run docs:check:final`。

各階段的輸入、步驟、輸出與停止條件已拆分至 `workflows/`，主文件不重複保存操作細節。

## 文件更新責任矩陣

| 發生變更 | 必須更新 |
|---|---|
| 版本、Release、目前風險 | `00-CURRENT-STATUS.md`、`04-DEVELOPMENT-HISTORY.md` |
| 新需求或驗收條件 | `02-REQUIREMENTS-ANALYSIS.md` |
| UI、API、資料、模組或安全設計 | `03-FUNCTIONAL-DESIGN.md` |
| 建置、runtime、簽章或發布流程 | `05-DEVELOPMENT-AND-DEPLOYMENT.md` |
| 測試、門檻或稽核證據 | `06-TEST-AND-PROCESS-AUDIT.md` |
| 缺陷、根因、修復或 workaround | `07-DEBUG-AND-FIX-HISTORY.md` |
| 任何實際工作 | `08-CHANGE-LOG.md` |

## 舊文件定位

- `README.md`：使用者與開發者入口。
- `RELEASE-NOTES-*.md`：各版本對外說明。
- `FINAL-VERSION-LOG.md`、`NEXT-VERSION-FIX-LOG.md`：早期長篇歷史證據，不再作為目前狀態的唯一來源。
- `WINDOWS-11-TEST-CHECKLIST.md`：Windows 實機驗收清單。
- `AI-ROADMAP-0.50.md`：未來 AI 規劃，未完成項目不得當成現有功能。

## 自動檢查

- `npm run project:preflight`：列出必讀文件、版本、分支與紀錄提醒。
- `npm run docs:check`：確認治理文件、必要章節、需求 ID、目前版本與工作紀錄存在。
- `npm run docs:check:final`：結案門檻；除一般檢查外，要求最新工作紀錄為「完成」、不含「待執行」，並驗證新格式、獨立審查報告、發布授權；「待確認」須在遺留風險中具體揭露才可保留。
- `npm run check`：包含 `docs:check` 與程式回歸測試。
