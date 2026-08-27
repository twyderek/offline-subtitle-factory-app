# 獨立審查報告：REL-043 0.51.0 macOS arm64 directory 測試候選

- 審查對象 commit／版本：`codex/0.51-anthropic-claude@97191ec`；版本 `0.51.0`。
- 候選目錄：`/Users/nycu/Documents/離線字幕工廠/dist/mac-arm64/`。
- 對應 08-CHANGE-LOG 條目：`2026-08-27 — 0.51.0 macOS arm64 測試候選建置與封裝驗證（REL-043）`。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-08-27（Asia/Taipei）；獨立上下文重新讀取 REL-043 工作紀錄、目前狀態、測試稽核、0.51.0 Release notes、候選資產與 source，未沿用主要代理的評價性結論。
- 審查環境：Apple Silicon macOS；Node.js v22.22.3；目前分支 `codex/0.51-anthropic-claude`。
- 審查限制：本輪沒有使用真實 Anthropic API key，沒有執行外部 provider smoke、真實 Whisper／Breeze runtime 或模型品質測試；候選是本機隔離 directory 測試軟體，不是公開 Release。

## 1. 需求完整性

- 判定：通過（限 REL-043 定義的本機 macOS arm64 隔離測試候選）。
- 證據：`docs/project-management/08-CHANGE-LOG.md:3-18` 將目標限定為由 `97191ec` 建立 macOS arm64 Electron directory candidate，要求 bundled runtime verify、packaged renderer smoke 與可定位／重現的候選資產；同一條目明確排除真實 Anthropic API、外部 provider smoke、公開 tag／GitHub Release、正式公證、跨平台與真實 Breeze／Whisper runtime 完整驗收。
- 證據：候選 `/Users/nycu/Documents/離線字幕工廠/dist/mac-arm64/PROVENANCE.txt` 與 `TEST-CANDIDATE-README.md` 明確標示 `0.51.0`、`darwin-arm64`、來源 branch／commit、local isolated testing only、ad-hoc／未公證與不含真實模型／runtime；沒有把候選寫成正式發布或 Breeze 已可直接使用。
- 證據：候選 App 的 `Contents/Info.plist` 顯示版本 `0.51.0`、最低 macOS `12.0`；主 executable、Whisper.cpp 與 FFmpeg 均為 arm64 Mach-O。
- 證據：REL-043 已記錄核准範圍為僅交付 `../dist/mac-arm64/` 隔離測試，明確不涵蓋 tag、推送、GitHub Release、Windows 資產或公開 0.51.0；本輪沒有越權擴張。

## 2. 邏輯正確性

- 判定：通過（限 source／封裝與 deterministic packaged smoke 範圍）。
- 證據：候選封裝內 `lib/ai/providers.mjs` 匯入 Anthropic adapter、列出 `anthropic` provider、預設 `https://api.anthropic.com`；`public/review.html` 與 `public/review.js` 也包含 Anthropic provider marker。這與 0.51.0 source 的 `/v1/models` 低成本連線測試及 `/v1/messages` 優化 contract 一致。
- 證據：候選封裝內含 `docs/BREEZE-ASR-25.md` 與 Breeze 首次選擇流程，但只含 `ggml-tiny.bin`；未發現 Base／Small／Breeze checkpoint、Python／PyTorch 或 patched runtime。這符合 REL-043 對 runtime／模型排除的範圍，而非把缺件狀態誤判為就緒。
- 證據：受控權限 renderer smoke 實際回傳 `hasElectronApi=true`、`hasSafeAiKeyApi=true`、Breeze modal `opened=true／closed=true` 且狀態為「尚未安裝」；manual SRT 的 create `201`、start `202`、final `completed`、cleaned SRT true；AI review 的 glossary round-trip 與 provider IDs（含 `anthropic`）通過。
- 未覆蓋：上述結果不證明真實 Anthropic 回應品質、rate-limit、proxy／TLS、真實 Breeze runtime 或長音訊推論邏輯。

## 3. 邊界情況

- 判定：部分通過；本輪候選邊界已覆蓋，真實模型／跨平台邊界仍未覆蓋。
- 證據：renderer smoke 在隔離 user-data 下選取 Breeze，確認缺件提示、modal 開啟、取消後關閉，再切回 `whisper-cpp`；未下載模型或建立 Breeze 任務。上傳流程同時驗證 settings／health、manual SRT 任務與輸出清理。
- 證據：候選 `/Users/nycu/Documents/離線字幕工廠/dist/mac-arm64/SHA256SUMS-macos-arm64.txt` 以 `shasum -a 256 -c` 重放，App executable、packaged `package.json`、packaged runtime manifest 三項均為 `OK`。候選 manifest 列出 FFmpeg、Whisper.cpp、Tiny 的固定路徑、大小與 SHA-256。
- 證據：已獨立執行 `npm run runtime:verify:mac`，FFmpeg、Whisper.cpp 與預設 Tiny 路徑均通過；已獨立執行受控權限 `node scripts/verify-electron-renderer.mjs`，同一候選完整通過 packaged UI／API smoke。
- 未覆蓋：第一次沙盒 renderer smoke 因 Electron target 未出現而逾時；取得受控權限後同一候選以隔離 user-data 重跑 exit 0。仍未覆蓋乾淨帳號／Gatekeeper／DMG 拖曳安裝、Windows、跨平台、真實 Small／Breeze checkpoint、1:46 長音訊品質／效能、取消與外部 Anthropic endpoint。

## 4. 程式碼品質

- 判定：通過（限本輪封裝內容與 source marker）。
- 證據：`npm run check` 在受控權限下由本審查重新執行並 exit 0，包含治理文件、所有 syntax check 與完整 deterministic test suite；輸出包含 AI provider、Breeze、Electron clean profile、核心 API 與 review UI 回歸通過。
- 證據：候選附帶 `PROVENANCE.txt`、`TEST-CANDIDATE-README.md`、SHA-256 清單與去敏 `mac-renderer-smoke.json`，將來源、平台、封裝版本、簽章狀態與限制分開記錄；候選檔案中未找到 API key、`sk-ant-`、Bearer credential 或憑證檔案。
- 證據：`codesign --verify --deep --strict` 通過；`codesign -dv` 明確顯示 `Signature=adhoc`、`TeamIdentifier=not set`，文件沒有誤稱 Developer ID 或 notarization。
- 注意事項：候選建立前有一次沙盒網路下載失敗（`getaddrinfo ENOTFOUND github.com`），後續受控網路同一建置成功；這是建置環境限制，已在 REL-043 工作紀錄揭露，不是候選執行時產品錯誤。來源與候選 manifest 的 `generatedAt` 是建置時間欄位，不應在後續宣稱跨時間 byte-identical。

## 5. 測試覆蓋

- 判定：通過（本機 macOS arm64 directory candidate 層級）；不得升格為模型品質／跨平台通過。
- 證據：本審查重新執行 `npm run check`，`docs:check`、所有列出的 npm tests、syntax checks 與核心回歸均 exit 0；無真實 API key 或外部模型呼叫。
- 證據：本審查重新執行 `npm run runtime:verify:mac`，顯示 `darwin-arm64` runtime OK；候選 checksums 三項全部 OK；App／FFmpeg／Whisper.cpp 的 `file` 結果均為 arm64 Mach-O；版本與最低 macOS 值由 Info.plist 重讀確認。
- 證據：本審查重新執行 packaged renderer smoke（受控權限、port 9984、60 秒 timeout）exit 0，實際輸出包含首頁／bridge／安全金鑰 API、設定 modal、Breeze modal 開關、manual SRT 完成／清理、trim assets、AI review、glossary round-trip 與八個 provider IDs（含 Anthropic）。
- 治理缺口：本審查執行 `npm run docs:check:final` 時 exit 1，原因是 REL-043 最新工作紀錄仍為「進行中」、仍有「待執行」欄位，且尚未填入獨立審查欄位。這是主代理結案前的治理阻擋，不是候選 App smoke 失敗。

## 6. 實際運行結果

- 判定：部分通過（僅限 macOS arm64 本機隔離 directory candidate；交付結論仍為有條件通過）。
- 證據：受控 renderer smoke 實際啟動 `/Users/nycu/Documents/離線字幕工廠/dist/mac-arm64/離線字幕工廠.app/Contents/MacOS/離線字幕工廠`，標題為「本機離線字幕工廠｜字幕生成任務」，而非僅靜態檔案掃描；manual SRT job 完成且 cleaned SRT 存在。
- 證據：候選 `mac-renderer-smoke.json` 是去敏摘要，記錄 `sourceCommit=97191ec`、0.51.0 candidate、Breeze 缺件 modal 流程、AI review provider IDs 與 scope；本輪未發現金鑰或受控暫存路徑被寫入該證據。
- 證據：`PROVENANCE.txt` 將 release scope 限定為 local isolated testing only、簽章限 ad-hoc、模型範圍限 Tiny；候選 README 明確說明不含公開 Release、真實 API smoke 或 Breeze patched runtime。

## 綜合判定

- 結論：有條件通過（僅限本機隔離測試候選）。
- 可逐字引用的完整結論句：**本輪 REL-043 0.51.0 macOS arm64 directory 測試候選獨立審查結論為有條件通過：候選來源、版本、arm64 封裝、runtime manifest／FFmpeg／Whisper.cpp／Tiny 驗證、SHA-256、ad-hoc 簽章、Anthropic provider marker 及受控權限 packaged renderer smoke 均已重放通過，可交付本機隔離測試；但 `docs:check:final` 仍因 REL-043 工作紀錄尚未完成而失敗，且首次沙盒 smoke 受 Electron／GUI 權限限制逾時，真實 Anthropic API／模型品質／rate-limit、Whisper Small／Breeze patched runtime、1:46 長音訊品質／效能、乾淨帳號安裝、Windows／跨平台實機、正式簽章／公證與公開 Release 均未驗收，因此不得宣稱 0.51.0 已完成公開正式發布。**
- 阻擋問題（若有）：
  1. 主代理必須在結案前將 REL-043 的狀態改為「完成」、填入本報告路徑與上方逐字結論，再重跑 `npm run docs:check:final`；未完成前，治理結案不得判定通過。
  2. 若要升格為公開 0.51.0 Release，需另取得涵蓋公開發布的授權，完成真實 Anthropic／模型品質／效能、Breeze runtime、跨平台與乾淨安裝驗收；本報告不提供該授權。
- 剩餘風險：真實 Anthropic endpoint／proxy／TLS／rate-limit／計費、Claude 模型輸出品質與長字幕、真實 Whisper Small／Breeze checkpoint／MediaTek patched runtime、Mac／Windows 乾淨安裝與簽章／公證、1:46 長音訊效能、取消與跨平台實機仍未驗收。受控 renderer 成功不能消除沙盒環境的 listener／GUI 權限差異。
- 給主要開發代理的具體修正要求：保留本報告不覆寫；完成 REL-043 治理欄位並重跑 `npm run docs:check:final`、`git diff --check`；交付候選時同時提供 `/Users/nycu/Documents/離線字幕工廠/dist/mac-arm64/TEST-CANDIDATE-README.md`、`PROVENANCE.txt`、`SHA256SUMS-macos-arm64.txt` 與 `mac-renderer-smoke.json`。未完成真實／跨平台驗收前，不得建立公開 tag／GitHub Release 或把 Breeze／Anthropic 宣稱為正式品質通過。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本審查代理未修改程式碼、治理文件或既有審查報告。
- 本輪未使用真實 Anthropic API key，未呼叫外部 provider；renderer smoke 使用隔離 user-data，測試候選資產未被修改。
- 沙盒首次 smoke 逾時與受控權限重跑成功均如實記錄；本報告沒有把環境受限的失敗隱藏或宣稱為公開發布證據。
- 若上述聲明不實，本報告無效。
