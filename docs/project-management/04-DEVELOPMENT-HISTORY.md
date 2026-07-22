# 專案發展歷程

本文件記錄經查證的版本里程碑；細節與原始證據保留在 `RELEASE-NOTES-*.md`、`FINAL-VERSION-LOG.md` 與 `NEXT-VERSION-FIX-LOG.md`。

| 版本／日期 | 里程碑 | 主要驗證／備註 |
|---|---|---|
| 0.20–0.21／2026-07 | Electron 應用、任務管理、專案檔、規則、輸出及 Windows 獨立 runtime | 早期詳細紀錄見 `FINAL-VERSION-LOG.md`；部分狀態已過時 |
| 0.30.0 | 單一區間非破壞影片修剪 | 精準／快速模式、時間軸重算 |
| 0.30.1 | 校閱樣式比例、Windows 中文檔名、VTT、字幕分割、簽章關卡 | 完整回歸與打包流程補強 |
| 0.40.0／2026-07-16 | 可選 AI 字幕優化工作區 | 建議確認、時間碼鎖定、金鑰隔離、mock 測試 |
| 0.41.0 | AI 可靠性與跨平台發布 | 重試、錯誤分類、狀態恢復相關補強 |
| 0.45.0 | 術語、Prompt、多選、session 稽核、撤銷／重做、多 provider | Windows workflow 與 AI 工作流發布 |
| 0.45.1／2026-07-17 | Azure GPT-5 參數相容、AI 面板收合、圖文／動畫操作說明 | macOS DMG/ZIP、Windows Setup/Portable 已發布 |
| 文件治理／2026-07-20 | 建立必讀文件、變更紀錄、文件稽核與獨立審查制度 | 本目錄成為後續改版治理入口 |
| 下一版開發中／2026-07-20 | 多語言 LLM 字幕優化 | 常用語言、自訂 BCP 47、統一 Prompt 與舊設定相容；尚未打包或發布 |
| 0.45.2 候選／2026-07-20 | 多語言 LLM 正式發布流程 | 已取得未簽章、未公證與未完成跨平台乾淨實機測試的風險接受；資產建置與發布進行中 |
| 0.45.2／2026-07-22 | 補齊 Groq／Google Gemini 供應商整合並完成雙平台發布 | 修正 artifact naming／updater metadata；macOS DMG／ZIP 與 Windows Setup／Portable 已驗證後發布 GitHub Release v0.45.2；保留未簽章、未公證、未實機與未真實供應商 smoke test 風險 |
| 0.45.3 規劃／2026-07-22 | 供應商設定一致性與舊設定遷移 | BUG-012：OpenAI-compatible 不得載入 Gemini URL／模型；補安全遷移、回歸測試、實機驗收與真實供應商 smoke test |

## 0.45.1 發布補充

- Azure 測試改用 `max_completion_tokens`，正式優化不固定傳 `temperature: 0.1`。
- AI 面板預設精簡，可記住展開狀態；任務進行時自動展開。
- Windows Release 採穩定英文資產名稱，附 SHA 與未簽章狀態。
- Windows 安裝包內含離線手冊；線上手冊另由 Sites 部署。

## 歷史文件使用原則

舊日誌中出現「目前」「尚未」等相對描述時，必須先用 `00-CURRENT-STATUS.md`、Git、package version、Actions 與 Release 實際狀態交叉查證，不得直接沿用。
