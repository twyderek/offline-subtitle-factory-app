# 參與貢獻 / Contributing

感謝願意協助改善「離線字幕工廠」的使用者與開發者。這是一個以離線處理、影音隱私與字幕校閱品質為優先的開源專案。Welcome! Contributions that improve usability, privacy, reliability, documentation and reproducible builds are appreciated.

## 開始之前 / Before you start

1. 先閱讀 [README.md](README.md)、[LICENSE](LICENSE)、[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) 與 [GitHub Releases](https://github.com/twyderek/offline-subtitle-factory-app/releases)。
2. 提交功能或較大的修改前，建議先開 [Issue](https://github.com/twyderek/offline-subtitle-factory-app/issues) 說明情境、現有限制與預計解法。
3. **不要**提交真實課程影片、私人字幕、API 金鑰、OAuth 用戶端憑證、token、個人電腦路徑或其他私密內容。回報問題時請使用合成或已取得授權的測試資料。
4. 對可能涉及安全漏洞的問題，請先與專案維護者透過適當的非公開管道確認，避免在公開 Issue 張貼金鑰或可直接利用的敏感資訊。

## 開發環境 / Development

- 建議 Node.js **22.12.0 或更新的相容版本**；請使用對應分支的 `package.json` 與 `package-lock.json`。
- 程式碼以 JavaScript／Electron 為主；離線轉錄與影音處理使用 Whisper.cpp／FFmpeg。各平台 runtime 準備方式請參考 README 的「開發與測試」及專案腳本。
- 初步檢查指令：

```bash
npm ci
npm run project:preflight -- --type=development
npm run check
```

部分整合、封裝、模型下載或真實 AI／OAuth 驗收需要額外的本機 runtime、作業系統環境及測試帳號；`npm run check` 不能證明完整跨平台或真實 YouTube 上傳都已驗收。

## 提交問題 / Issue reports

為了讓維護者重現問題，請盡可能提供：
- App 版本、Git commit 或 Release 連結、作業系統與 CPU 架構。
- 預期結果、實際結果與可重現步驟。
- 去識別化日誌、合成字幕或最小化測試案例；不要包含私人媒體、原始金鑰或帳戶資訊。
- 是否涉及離線模式、本機 LLM、雲端 AI、Breeze、模型下載或 YouTube 選用功能。

## Pull Requests

1. 從適當的開發基線建立短期分支，避免直接修改已發布 tag；目前發布版本與預設分支若不同步，請先在 Issue／PR 註明基線並與維護者確認。
2. 每個 PR 聚焦單一問題，清楚說明範圍、動機、操作方式、已知風險與回復方式。
3. 新增或改動行為時，請附相關測試或最小重現步驟；提交前執行適用的 `npm run check` 及必要的跨平台驗證，並**只聲稱真正執行過的檢查**。
4. 尊重既有保護措施：字幕 cue ID／順序／時間碼不可被 AI 任意改寫；雲端傳輸需明確同意；不得讓憑證流入日誌或前端回應。
5. 如果使用 AI 協助撰寫程式或文件，請自行檢查結果、來源及授權，並揭露重要生成或未經實測的部分；PR 仍由貢獻者負責。
6. 依專案 [AGENTS.md](AGENTS.md) 與 [docs/project-management/README.md](docs/project-management/README.md) 完成所需文件、審查與驗證流程；維護者有權要求補充測試與調整。

## 授權 / License

貢獻者應確認自己有權提交內容，並同意其對本專案的可授權原創貢獻依根目錄 [MIT License](LICENSE) 提供；引用第三方原始碼、模型或資產時，請標明其來源與獨立授權。未經授權的學校、雇主或客戶素材不可納入。

謝謝你協助讓在地端字幕工作流程更可靠、更容易取得。
