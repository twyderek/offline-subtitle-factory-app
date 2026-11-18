# Security Policy / 安全性通報

## Supported releases / 維護範圍

目前可核對的最新公開 Release 是 [v0.52.0](https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.52.0)，發行資產僅限 macOS Apple Silicon (arm64)；Windows 使用者需參考各歷史 Release。這不是對任何版本提供固定安全更新期限的承諾。

請先閱讀發行說明的已知限制。v0.52.0 仍未完成實際 Google OAuth／YouTube 私人影片及字幕上傳的端到端驗收；macOS 未經 Apple Developer ID 簽章／公證。

## Reporting a vulnerability / 如何通報漏洞

- **請勿**在公開 Issue、Pull Request、截圖或日誌中貼出可以重現的私密利用細節、API Key、OAuth secret／token、個人影音素材或其他敏感資料。
- 若 GitHub Security 頁面提供「Report a vulnerability」私人通報入口，請優先使用該入口；若未開放，請先嘗試由維護者 GitHub 個人頁面取得合適的非公開聯絡方式（本專案目前未公開專用資安信箱），不要直接公開敏感細節。
- 一般功能錯誤、非敏感的相容性問題或功能建議，可以提交 [Issues](https://github.com/twyderek/offline-subtitle-factory-app/issues)。

建議提供最小化的重現步驟、受影響版本／作業系統、風險影響，以及已去識別化的佐證。請勿在未取得授權的情況下測試第三方帳號或資料。

## Scope

特別關注本機檔案及字幕存取、選用 AI 供應商的文字傳送、API 金鑰／作業系統安全儲存、Google OAuth／YouTube 上傳、模型下載完整性和 FFmpeg／Whisper 等第三方元件風險。缺陷處理與正式發布仍遵循專案治理文件及實際測試證據。

## Disclosure

目前**沒有**公開承諾的修補時限或漏洞懸賞計畫。重大安全問題應先由維護者核對、修補與測試後再協調公開說明。
