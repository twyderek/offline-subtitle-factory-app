# REL-046 macOS arm64 DMG／ZIP 測試包獨立審查（round1）

審查日期：2026-08-27（Asia/Taipei）  
審查範圍：`codex/0.51-anthropic-claude@88da220` 產生的本機隔離 macOS arm64 DMG／ZIP 候選  
候選目錄：`/Users/nycu/Documents/離線字幕工廠/dist/test-build-0.51.0-macos-88da220/`

## 1. 需求完整性

- 判定：通過
- 證據：工作紀錄、Release notes、目前狀態與候選 `TEST-CANDIDATE-README.md` 均明確將本輪界定為 0.51.0 macOS arm64 DMG／ZIP 測試包；範圍包含版本、runtime、封裝、checksum、metadata、簽章與 renderer smoke，且明確不包含公開發布。
- 結論：候選目標與不在範圍項目一致，沒有把測試包誤稱為正式 Release。

## 2. 邏輯正確性

- 判定：通過
- 證據：`PROVENANCE.txt` 標示來源分支 `codex/0.51-anthropic-claude`、commit `88da220`、`darwin-arm64`、Electron 43.3.0 與 electron-builder 26.15.7；ZIP 解壓後主程式為 arm64 Mach-O。候選包含 DMG、ZIP、各自 blockmap、`latest-mac.yml`、SHA256、簽章狀態與 smoke 證據。
- 結論：資產內容與來源及平台宣告相符。

## 3. 邊界情況

- 判定：部分通過
- 證據：重放 `shasum -a 256 -c SHA256SUMS-macos-arm64.txt` 全部 OK；`hdiutil verify` 回報 DMG checksum VALID；`unzip -t` 回報無壓縮資料錯誤；以 SHA-512 重新計算 `latest-mac.yml` 中 ZIP／DMG 均與 metadata 一致，大小亦分別為 249959846 與 242726077 bytes。`mac-renderer-smoke.json` 通過結構檢查，確認 source commit、首頁、Breeze modal、manual SRT completed、trim、AI review 與 Anthropic marker。
- 證據補充：候選 DMG 在本審查環境執行唯讀掛載時因系統回報「尚未設定裝置」而無法 attach；因此未將掛載後操作列為已驗收。ZIP 解壓後可重放 codesign 靜態驗證。
- 結論：檔案完整性、metadata 與既有 renderer smoke 可重放；唯讀掛載／拖曳安裝仍需具備可用磁碟映像裝置的 macOS 實機複驗。

## 4. 程式碼品質

- 判定：部分通過
- 證據：ZIP 解壓後 `codesign --verify --deep --strict` 通過；`codesign -dv` 顯示 `Format=app bundle with Mach-O thin (arm64)`、`flags=0x2(adhoc)`、`TeamIdentifier=not set`。候選說明未包含 API key，renderer smoke scope 亦標示未使用真實 Anthropic key。
- 結論：封裝簽章結構可驗證，但這是 ad-hoc 簽章，沒有 Apple Developer ID、Team ID 或公證，Gatekeeper 信任鏈不可宣稱已完成。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：已完成的 packaged renderer smoke 證明首頁、設定、Breeze 首次選擇 modal、手動 SRT 任務、清理 SRT、trim／AI review、術語往返與 Anthropic provider marker 均可在受控隔離環境通過。候選 README 明確提示 Breeze runtime／模型需另行安裝，Anthropic 需使用者自行提供 key 與同意。
- 結論：可支持受控測試流程；尚未證明真實 Breeze／Whisper Small runtime、真實 Anthropic API、模型品質、rate-limit、長音訊效能或實際 DMG 安裝後流程。

## 6. 實際運行結果

- 判定：部分通過
- 證據：候選、`latest-mac.yml` 與文件一致標示 local isolated testing only，未建立 tag、未 push、未建立 GitHub Release；測試包保留 ad-hoc／未公證、未乾淨安裝、Windows／跨平台未驗收等限制。
- 阻擋／條件：不得將本候選標示為正式可發布版本；若後續要公開發布，須另行完成發布授權、乾淨環境／DMG 拖曳安裝、Developer ID／公證決策與發布後資產核對。另須持續揭露 Breeze runtime、Anthropic 外部服務、模型品質與 1:46 長音訊效能缺口。
- 結論：作為本機隔離測試候選可接受；作為正式 macOS 發布資產仍不具備充分驗收證據。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 round1 獨立發布候選審查結論為有條件通過：0.51.0 macOS arm64 DMG／ZIP 候選的來源 commit、版本、SHA-256、`latest-mac.yml` SHA-512／size、DMG `hdiutil verify`、ZIP `unzip -t`、ad-hoc deep codesign 與既有 packaged renderer smoke 證據一致且可部分重放；但本審查環境無法唯讀掛載 DMG，且候選仍未完成乾淨安裝、Developer ID／公證、真實 Anthropic／Breeze runtime、長音訊效能與跨平台實機驗收，因此僅可維持本機隔離測試候選，不得視為正式公開 Release。**
- 阻擋問題（若有）：正式公開發布仍受未完成乾淨安裝／DMG 掛載實機驗收與未公證狀態限制；本輪不阻擋本機隔離測試。
- 條件是否已被需求方接受：尚待主要代理依既有使用者授權與文件揭露判定；本報告不新增發布授權。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
