# 專案管理文件入口

本目錄是「離線字幕工廠」後續分析、改版、測試、打包與發布的單一治理入口。舊版根目錄文件保留為歷史證據；若內容衝突，以經實際程式碼、測試與 Release 查證後更新的本目錄文件為準。

## 精簡必讀與任務路由

每次固定只讀四項核心上下文：

1. `AGENTS.md`。
2. 本文件。
3. `00-CURRENT-STATUS.md`。
4. `08-CHANGE-LOG.md` 的範本規則與最新工作條目；歷史條目只有在追溯相關版本／決策時才讀。

再依任務類型讀取 preflight 列出的路由文件：

| `--type` | 額外必讀 |
|---|---|
| `general` | `workflows/07-DOCUMENT-CLOSEOUT.md` |
| `governance` | `01`、`06`、`09`、測試／獨立審查／結案流程 |
| `requirements` | `02`、需求變更／獨立審查／結案流程 |
| `development` | `02`、`03`、`06`、開發／測試／獨立審查／結案流程 |
| `debug` | `03`、`06`、`07`、測試／獨立審查／偵錯／結案流程 |
| `release` | `01`、`05`、`06`、`09`、測試／獨立審查／發布／結案流程 |
| `full` | 00–09 與全部 workflows；只在無法分類或跨域高風險工作使用 |

指令：`npm run project:preflight -- --type=<類型>`。同一任務涉及多類型時使用風險較高者；無法判斷時用 `full`。preflight 只負責檢查與列出上下文，不能取代閱讀。

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
| 常設發布風險授權 | `09-STANDING-AUTHORIZATIONS.md` |

## 舊文件定位

- `README.md`：使用者與開發者入口。
- `RELEASE-NOTES-*.md`：各版本對外說明。
- `FINAL-VERSION-LOG.md`、`NEXT-VERSION-FIX-LOG.md`：早期長篇歷史證據，不再作為目前狀態的唯一來源。
- `WINDOWS-11-TEST-CHECKLIST.md`：Windows 實機驗收清單。
- `AI-ROADMAP-0.50.md`：未來 AI 規劃，未完成項目不得當成現有功能。

## 自動檢查

- `npm run project:preflight -- --type=<類型>`：列出精簡核心與任務路由、版本、分支與紀錄提醒。
- `npm run docs:check`：確認治理文件、必要章節、需求 ID、目前版本與工作紀錄存在。
- `npm run docs:check:final`：結案門檻；除一般檢查外，要求最新工作紀錄為「完成」、不含「待執行」，並驗證新格式、獨立審查報告、發布授權；「待確認」須在遺留風險中具體揭露才可保留。
- `npm run check`：包含 `docs:check` 與程式回歸測試。
