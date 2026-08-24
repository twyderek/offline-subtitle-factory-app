# 獨立審查報告：REL-042 0.50.0 macOS arm64 測試候選重建

- 審查對象 commit／版本：`codex/0.50-whisper-small-long-cues@bb127c78295d378bba308d2fb39e1f3bb0286a60`；產品來源 `6beee985f50e2045fb9520630e4fde8d67b61bb7`；版本 `0.50.0`。
- 候選目錄：`/Users/nycu/Documents/離線字幕工廠/dist/test-build-bb127c7/`。
- 對應 08-CHANGE-LOG 條目：`2026-08-24 — 0.50.0 macOS 測試候選重建（REL-042）`。
- 審查輪次：round1。
- 審查代理啟動時間、上下文來源：2026-08-24 08:27（+0800）前後；獨立審查上下文，只接收本輪候選、來源 commit、治理路由與驗證範圍，未沿用主要開發代理的評價性結論。
- 審查環境：Apple Silicon arm64、macOS 26.5.2（Build 25F84）、Node.js v22.22.3、npm 10.9.8；分支 `codex/0.50-whisper-small-long-cues`。
- 審查限制：候選是本機隔離測試包，不是公開 Release；本輪沒有下載或執行真實 Whisper Small 權重、Breeze checkpoint／MediaTek patched Whisper runtime，也沒有進行 1:46 長音訊、乾淨帳號安裝、Windows 或跨平台實機驗收。

## 1. 需求完整性

- 判定：通過（限 REL-042 所定義的 macOS arm64 本機隔離測試候選）。
- 證據：REL-042 工作紀錄目前列出的成功條件涵蓋版本、來源、runtime manifest、Tiny 內建、高階模型／Breeze 排除、BUG-024／BUG-025 marker、DMG／ZIP、ad-hoc codesign、updater metadata、SHA-256 與 packaged renderer；候選 `TEST-CANDIDATE-README.md` 與 `PROVENANCE.txt` 分別明確標示來源 `bb127c7`、產品來源 `6beee98`、`darwin-arm64`、`0.50.0` 及 `local isolated testing only; no tag, push, or GitHub Release`。
- 證據：候選 README 明確保留真實 Small／Breeze runtime、1:46 長音訊、乾淨帳號、Windows／跨平台、正式簽章／公證與公開 0.50.0 未驗收；沒有把缺件的 Breeze runtime 或模型寫成隨安裝包提供。
- 證據：`package.json` 與 `package-lock.json` 版本均為 `0.50.0`；候選 `mac-arm64/離線字幕工廠.app/Contents/Info.plist` 顯示 `CFBundleShortVersionString=0.50.0`、`CFBundleVersion=0.50.0`、`LSMinimumSystemVersion=12.0`，Mach-O executable 為 arm64。
- 證據：發布等級授權已在 REL-042 工作紀錄列明為「僅本機測試候選重建與交付，不含公開發布」，核准範圍接受 ad-hoc／未公證及未驗收項目，但不涵蓋 tag、推送、GitHub Release、Windows 或公開 0.50.0；本輪沒有把該授權擴張成公開發布授權。

## 2. 邏輯正確性

- 判定：通過（目前範圍內未發現阻擋性邏輯錯誤）。
- 證據：`lib/whisper-srt.mjs:177-248` 將 SRT 時間解析、無效／零長度 cue 丟棄、連續 ID、長 cue 拆分與輸出集中在同一 sanitizer；`server.mjs:1869-1872` 與 `1998-2001` 僅在 model name 正規化為 `small` 時啟用 `splitLongCues`，Tiny／Base 仍使用原有不改寫路徑。
- 證據：`lib/whisper-srt.mjs:125-153` 對可拆分 cue 按文字權重分配時間，並以至少 1 ms 與剩餘片段保留量避免零長度／逆序時間碼；時間不足時 `:131-139` 回退為單一 cue，不製造無效區間。
- 證據：`lib/whisper-srt.mjs:62-100` 以最多兩行與每行 20 個可見字元為正常顯示限制，文字以包裝／分段處理而非截斷；英文 word boundary 會優先保留空白，無可用空白時才按字元邊界分割。
- 證據：`server.mjs:2014-2035` 在 Small 實際拆分時對 `splitFromSource` cue 不強行套用不精確的 engine segment 對應，未拆分 cue 仍可保留品質 metadata；不會以錯位 metadata 造成假品質指標。
- 證據：`electron/main.mjs:20-28` 先檢查 `ai-keys.safe` 是否存在，再檢查 `safeStorage.isEncryptionAvailable()`；`scripts/test-electron-main.mjs:11-15` 以來源順序回歸測試防止乾淨 profile 再次先觸發 macOS Keychain。

## 3. 邊界情況

- 判定：部分通過；已覆蓋本輪可自動驗證的邊界，但真實模型、長音訊與跨平台邊界仍未覆蓋。
- 證據：`scripts/test-whisper-srt.mjs:5-22` 實測 BOM／CRLF、無效時間碼、零長度、逆序與多行輸入；`:24-48` 實測 Small 長中文 cue 的拆分、連續時間、兩行限制、ID 與文字無損；`:50-60` 實測英文空白與原本兩行可讀 cue；`:62-76` 實測 1 ms 不可拆分 fallback 與純中文不得插入 ASCII 空格。
- 證據：本輪另以 deterministic inline invariant test 對 200 組含中文、標點、英文、空白與 emoji 的隨機長文字驗證 cue 非零時長、連續時間、最多兩行與去空白後文字無損，另驗證 1 ms 中文 fallback；結果 `whisper invariant fuzz passed: 200 cases + 1ms fallback`。
- 證據：受控 renderer smoke 實際選取 `breeze-asr-25`，確認缺件狀態「Breeze ASR 25 尚未安裝（約 2.88 GB）；可開始官方下載。」、下載 modal 開啟、取消後關閉，並切回 `whisper-cpp`；未下載或假裝執行外部 runtime。
- 未覆蓋：真正 Whisper Small／Breeze runtime、真正模型輸出、1:46 長音訊中文／中英斷句、閱讀速度、模型品質、Metal／CPU 效能、取消／中斷模型下載、既有加密 AI key 跨版本解密、乾淨帳號 Gatekeeper／DMG 拖曳安裝、Windows 與跨平台實機。

## 4. 程式碼品質

- 判定：通過（限本輪涉及的產品來源與封裝邊界）。
- 證據：Small 長 cue 規則集中在 `lib/whisper-srt.mjs`，以 `splitLongCues` opt-in 保持 Tiny／Base／非 Small 呼叫者相容；Python Whisper 與 Whisper.cpp 兩條 server 路徑共用 sanitizer，沒有複製兩套拆分演算法。
- 證據：`electron/main.mjs:20-34` 的安全儲存讀寫路徑以 `securePath` 重用、保留 `try/catch` fallback，寫入仍使用 `0o600`；回歸測試直接檢查清潔 profile 的檔案存在順序。
- 證據：完整 `npm test` 已包含 `scripts/test-electron-main.mjs`，且所有 focused／治理／核心測試通過；`node --check` 隨 `npm run check` 覆蓋 server、renderer、review、trim 與 Electron main。
- 證據：候選附帶 `PROVENANCE.txt`、簽章狀態、SHA-256 清單、測試候選 README 與去敏 `mac-renderer-smoke.json`；對候選證據檔執行敏感標記搜尋，未發現 API key、Bearer、token URL 或暫存絕對路徑。
- 注意事項：我重新執行 `npm run runtime:manifest:mac` 後，來源 manifest 的 `generatedAt` 被更新；與候選封裝 manifest 比較時只有該時間欄位不同，去除 volatile `generatedAt` 後 JSON 結構與內容一致。這不是功能差異，但工作紀錄中「byte-identical」的敘述應在結案時改以「內容一致、生成時間欄位不同」或引用建置當時的 manifest 證據，避免把可變時間欄位寫成目前可重現的 byte-identical。

## 5. 測試覆蓋

- 判定：通過（本機候選封裝層級）；實際模型／跨平台品質不升格為通過。
- 證據：2026-08-24 執行 `npm run check` exit 0；治理文件、語法、Whisper fallback／三模型／下載／SRT、Breeze、Electron clean profile、治理 validator、媒體、雙語、字幕品質、AI fetch／optimizer／providers、Ollama streaming、review UI 與核心 API 回歸全部通過。
- 證據：執行 `npm run runtime:manifest:mac` 與 `npm run runtime:verify:mac` 均 exit 0；verify 顯示 FFmpeg、Whisper.cpp 與預設 `ggml-tiny.bin` 路徑有效。
- 證據：候選 `SHA256SUMS-macos-arm64.txt` 以 `shasum -a 256 -c` 重放四項檔案全部 `OK`。DMG SHA-256 為 `0c19a8ad72b4400f0a62a1801959a1f2beadab5fbd254b6a2b997f70deda7624`（242,718,102 bytes），ZIP 為 `57cfff7a14e837aee0e68ec39d8ff28bb7b95ea30dcb4361182495706d6e88e8`（249,955,645 bytes）。
- 證據：`hdiutil verify` exit 0；`unzip -t` exit 0 且無壓縮資料錯誤；`codesign --verify --deep --strict` exit 0。`codesign -dv` 顯示 `Signature=adhoc`、`TeamIdentifier=not set`，未誤稱 Developer ID／公證。
- 證據：用 Node crypto 逐項重算 `latest-mac.yml`：ZIP size `249955645` 與 SHA-512 `rceHRG90iP1Rz7dsqlI3D+/Nq0lCv3McKZOZX/OD61DCji5U2q++Vh5IJ5AuuifnPGfeOIS1ZLXT/fv5FnPXbw==` 一致；DMG size `242718102` 與 SHA-512 `M+srDaPA2lq2J0iXHNCbu6haQWWs2TMMVAAHsYCO6O4WhCsPsVXDXP8l24M7kCc4F76cDjhvx5htTd3cK49nhA==` 一致。
- 證據：第一次在沙箱執行 `node scripts/verify-electron-renderer.mjs ... 9452 120000` 於 120 秒因無 renderer target 失敗；依 listener／Electron 權限限制取得受控權限後，使用同一候選 App、隔離 userData 與 port 9453 重跑 exit 0。這次受控輸出實際通過主視窗／Electron bridge／安全金鑰 API、設定 modal、Breeze modal 開關與缺件取消、health／settings、上傳 201／啟動 202／completed／cleaned SRT、trim 資產、AI review／術語 round-trip／七 provider 與 folder event；結束後程序清單無候選背景程序。
- 結案限制：在 REL-042 工作條目仍為「進行中／待執行」狀態時執行 `npm run docs:check:final`，預期 exit 1，明確回報最新工作紀錄尚未完成、仍有待執行欄位且審查欄位尚未填入。此為主代理文件結案前置條件，不是候選 App 的功能測試失敗；主代理必須在讀取本報告後補齊條目並重跑 final gate。

## 6. 實際運行結果

- 判定：通過（限 macOS arm64 目錄版／本機隔離 smoke，不代表 DMG 拖曳安裝或真實模型運行）。
- 證據：受控 `verify-electron-renderer.mjs` 實際啟動 `/Users/nycu/Documents/離線字幕工廠/dist/test-build-bb127c7/mac-arm64/離線字幕工廠.app/Contents/MacOS/離線字幕工廠`；輸出標題為「本機離線字幕工廠｜字幕生成任務」，`hasHomeDashboard=true`、`hasElectronApi=true`、`hasSafeAiKeyApi=true`，不是僅靜態檔案檢查。
- 證據：受控 smoke 的 `uploadFlow` 回傳 `createStatus=201`、`startStatus=202`、`finalStatus=completed`、`hasCleanedSrt=true`；`aiReviewAssets` 回傳 `saveStatus=200`、glossary round-trip true，provider IDs 為 openai、openai-compatible、azure、groq、gemini、ollama、lm-studio。
- 證據：候選 `mac-renderer-smoke.json` 是已去敏的確定性 smoke 摘要，沒有保存受控執行期間的 API token 或暫存路徑；其 `breezeSelectionFlow.opened／closed`、上傳完成、trim、review、七 provider 與 `scope` 欄位與本輪受控輸出一致。
- 證據：`find mac-arm64 -type f` 的模型／機密排除檢查未找到 `.pt`、`.pth`、`ggml-base.bin`、`ggml-small.bin`、checkpoint、PFX、P12、PEM 或 key；App 內只有 `ggml-tiny.bin`（77,691,713 bytes），沒有大於 1 GiB 的檔案。Breeze source probe／UI 仍存在是功能程式，不是 checkpoint 或 runtime 被內建。
- 證據：候選 `PROVENANCE.txt` 與 `SIGNING-STATUS-macos-arm64.txt` 明確標示 ad-hoc、Developer ID not provided、notarization not performed、Gatekeeper 可能要求使用者核准；`TEST-CANDIDATE-README.md` 明確限制只作本機測試。

## 發布範圍與額外發布審查

- 判定：有條件通過，僅限本機隔離測試候選交付；公開發布不通過。
- 發布授權：REL-042 工作紀錄已記錄需求提出者／產品負責人於 2026-08-24 核准本機候選重建與交付，明確接受 ad-hoc／未公證及真實模型／長音訊／乾淨安裝／跨平台未驗收，但排除 tag、push、GitHub Release、Windows 與公開 0.50.0。
- 資產狀態：本輪未建立或推送 tag，未建立 GitHub Release，未替換公開 `v0.49.1`；候選 DMG／ZIP 只存在指定本機 `dist/test-build-bb127c7/`。
- 條件：主代理需將 REL-042 工作條目完成、填入本報告路徑與下方逐字結論，重跑 `npm run docs:check:final` 與 `git diff --check`；不可因本機 smoke 成功而宣稱真實 Small／Breeze 可用或公開 0.50.0 已發布。

## 綜合判定

- 結論：有條件通過（僅限本機隔離測試候選）。
- 阻擋問題（若有）：
  1. 本機候選交付前的治理結案仍待主代理完成：REL-042 最新工作條目目前為進行中，`docs:check:final` 尚未通過；這阻擋治理結案，不阻擋已完成驗證的本機候選檔案提供測試。
  2. 沙箱權限下首次 renderer smoke 逾時，但受控權限以同一候選成功重播；若要在無提升權限環境宣稱可重現，仍需補充該環境的 listener／Electron 權限設定，不能隱去這次初次失敗。
- 剩餘風險：真實 Whisper Small／Breeze runtime／checkpoint、MediaTek patched Whisper、1:46 長音訊品質與效能、既有加密 AI key 跨版本解密、乾淨帳號 Gatekeeper／DMG 安裝後流程、Windows／跨平台實機、Developer ID／公證，以及公開 tag／Release／下載後核對均未驗收。候選 manifest 的 `generatedAt` 為建置時間欄位，與本輪重新生成來源 manifest 僅有時間差；內容欄位一致，後續紀錄應避免把不同時間的檔案稱為目前 byte-identical。
- 給主要開發代理的具體修正要求：讀取本報告後補齊 REL-042 工作紀錄的審查連結、逐字結論、完成狀態與剩餘風險；重跑 `npm run docs:check:final`／`git diff --check`。若未來要公開發布，另需取得涵蓋公開發布的授權，完成真實模型／跨平台／乾淨安裝驗收與發布後 asset／digest／URL 反向核對，不得沿用本報告的本機候選判定。

- 可逐字引用完整結論句：**本輪 REL-042 0.50.0 macOS arm64 隔離測試候選獨立審查結論為有條件通過：候選來源、版本、Whisper Small 長 cue／BUG-025 marker、Tiny-only 與 Breeze／高階模型排除、DMG／ZIP 完整性、SHA-256、updater metadata、ad-hoc codesign 及受控權限 packaged renderer smoke 均已重放通過，可交付本機隔離測試；但沙箱內首次 smoke 因 listener／Electron 權限逾時且僅受控權限重跑成功、docs:check:final 尚因 REL-042 工作條目進行中而未通過，另真實 Whisper Small／Breeze runtime、1:46 長音訊品質／效能、既有加密 AI 金鑰跨版本 decrypt、乾淨帳號 Gatekeeper／DMG 安裝、Windows／跨平台實機、正式簽章／公證及公開 Release 均未驗收，因此不得宣稱 0.50.0 已完成公開正式發布。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 候選資產未被修改；主代理原有未提交的 `docs/project-management/08-CHANGE-LOG.md` 變更已保留未觸碰。
- 本報告中的完整回歸、候選驗證、受控 renderer smoke 與 200 組 invariant test 均為本輪獨立執行；初次沙箱 smoke 失敗與後續受控權限成功均如實記錄。
- 若上述聲明不實，本報告無效。
