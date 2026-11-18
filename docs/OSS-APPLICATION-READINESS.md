# Codex for OSS — 公開專案核查與送件證據

> 查核日：2026-10-22（Asia/Taipei）。本文件是**公開可驗證的證據索引**，不是 OpenAI 的審查結論，也不代表申請已獲核准。

## 專案資訊

- Repository: <https://github.com/twyderek/offline-subtitle-factory-app>
- Primary maintainer: [@twyderek](https://github.com/twyderek)
- 原始碼授權：根目錄 `LICENSE` 的 MIT（前提是提交者對該原創內容具有授權權利）；第三方元件依 [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md)。
- 最新公開發行版（查核當日）：[v0.52.0，2026-10-20](https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.52.0)。**v0.52.0 只提供 macOS Apple Silicon 安裝包**；Windows v0.52.0 未發行。
- 原始碼：JavaScript／Electron 桌面工具；使用 FFmpeg、Whisper.cpp 等處理影音，另可選本機或線上 AI 字幕文字優化。v0.52.0 的 YouTube 上傳屬選用功能，真實 OAuth／頻道端到端測試尚未完成。

## 持續維護證據

- [GitHub Releases](https://github.com/twyderek/offline-subtitle-factory-app/releases)：多版本公開發布、附安裝包／雜湊／版本說明及已知風險。
- [Pull Requests](https://github.com/twyderek/offline-subtitle-factory-app/pulls?q=is%3Apr+is%3Amerged)：可查閱已合併的功能／修復／發布 PR；**不能單憑 PR 數量推斷外部貢獻者數或使用者數**。
- [Governance and release records](project-management/README.md)：專案需求、版本、測試、獨立審查與風險的歷史紀錄；紀錄中的歷史「尚未發布」文字不得被視為當前 Release 狀態。
- [Contribution guide](../CONTRIBUTING.md)：開發測試、issue、PR 及隱私要求。
- [Security Policy](../SECURITY.md)：私密問題通報與外部整合風險。
- [CI workflows](../.github/workflows)：自動化測試腳本；**只有 GitHub Actions 實際完成的 workflow run 才可當成 CI 成功證據**。

## 公開價值與限制

專案以本機字幕製作及人工校閱為核心，供教育工作者、影片製作者及注重資訊保護的使用者選用。預設可在本機進行語音辨識、編輯與輸出；使用者主動設定的雲端 AI 文字服務或 YouTube 上傳不屬預設完全離線流程。

截至本文件編寫時，未取得可獨立驗證的外部活躍使用者數、學校正式部署證據或獨立貢獻者數；請不要於 Codex for OSS 申請表聲稱具有大規模採用。GitHub Release 的下載計數不是獨立使用者數。

## 送件前不可跳過的門檻

1. 目前 `main` 仍落後於已發布的 v0.52.0，候選同步集中於 [PR #15](https://github.com/twyderek/offline-subtitle-factory-app/pull/15)；必須確認 PR 中大型版本差異、權利歸屬與治理流程後才能合併。
2. 驗證 MIT LICENSE 在 `main` 生效，並確認第三方元件再散布義務；不能以 MIT 取代 FFmpeg／模型等授權。
3. 以 CI 執行結果／獨立審查報告作為品質依據；不得將 mock／靜態檢查當成 macOS／Windows、YouTube 真實帳號的完整實機測試。
4. 統計資料、使用案例、媒體報導、外部推薦應以經同意且能獨立查證的材料提供，沒有資料便誠實省略。

## 供 Codex for OSS 申請時可核對的描述

> Offline Subtitle Factory is a public, local-first subtitle generation and review application. It maintains public releases, test scripts, contribution guidance and explicit privacy safeguards. It supports offline transcription, subtitle editing and exports. Optional cloud integrations are user-initiated and documented with known limitations. The project is early in community adoption and is seeking support for ongoing development, quality assurance and OSS maintenance.

此內容僅作為資料整理，不承諾 OpenAI 核准或 API 額度。
