# 獨立複審報告：0.48.1 最終候選驗證補充（REL-025-R2）

- 審查對象 commit／版本：`codex/release-v0.48.1` 工作樹，基準 HEAD `170e08e17d38b4c7a9c94d3e1ba031a382539d9a`，應用程式版本 `0.48.1`；REL-025、REL-025-R1、REL-025-R2 來源仍未提交。
- 對應 08-CHANGE-LOG 條目：`2026-08-11 — 0.48.1 最終候選驗證補充（REL-025-R2）`（`docs/project-management/08-CHANGE-LOG.md:16`）。
- 前輪報告：`docs/project-management/reviews/2026-08-10-0-48-1-release-readiness-round2.md`。
- 審查輪次：round3。
- 審查代理啟動時間、上下文來源：2026-08-11T10:10:18+08:00 前完成 release preflight 與固定快照核對；由獨立審查上下文依目前工作樹、最終 `dist` 產物及可重播指令判定，不以主要代理的敘述替代本輪可獨立重驗項目。
- 審查環境：macOS Apple Silicon、Node.js `22.22.3`；Windows 候選為 macOS cross-build，未在 Windows 10／11 實機啟動。

## 審查摘要

REL-025-R2 已置頂並正確描述目前狀態；round2 的兩個最終本機證據缺口已由本輪對同一最終 DMG 與 macOS executable 獨立重驗解除，完整 `npm run check`、四資產、封裝來源及既有安全證據亦一致。這只足以判定「0.48.1 本機候選證據補齊」；來源尚未形成不可變 commit，遠端 branch／tag／Release 仍不存在，Windows／Base／Small／真實端點／安裝後實機缺口也未獲需求方接受，因此不構成「可公開 Release」。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - 置頂條目確為 `REL-025-R2`（`docs/project-management/08-CHANGE-LOG.md:16-42`），成功條件直接追溯 round2 所列最後 DMG checksum 與 packaged renderer 缺口，並保留不可變來源、GitHub 閉環及未實機風險為公開發布停止條件。
  - `docs/project-management/00-CURRENT-STATUS.md:14` 已同步為「最後 build 的 `hdiutil verify` 與 packaged renderer smoke 已補驗」，不再保留過期的 metadata／SHA 或上述兩項待驗敘述；同段仍明列 release commit／GitHub 閉環與未實機風險接受尚未完成。
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:188-193` 保留 round2 當時受阻事實並在下一行補記 2026-08-11 同一最終 build 的新證據，沒有回寫歷史或把前一 build 結果冒充為最後 build。
  - FR-022／FR-023 的三模型、固定來源、完整性驗證、快取及取消清理需求，仍由完整回歸、Tiny-only 封裝與 source diff 追溯；但 Base／Small 真實下載與品質／效能、Windows 安裝後行為不在本輪本機證據範圍。
  - `npm run docs:check:final` 已實際對準 REL-025-R2，並因最新工作紀錄仍為「進行中」、round3 欄位仍「待執行」、獨立審查欄位尚未回填而 exit 1。這是報告尚未由主要代理連結與條件尚未結案時的正確停止閘門，不是可忽略的假陽性。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - 2026-08-11 本輪獨立執行完整 `npm run check` 通過，涵蓋 Whisper fallback／三模型／下載取消與清理／SRT、Breeze 契約、媒體／雙語／品質、AI fetch／optimizer／providers、Ollama streaming、review UI 與核心 API；核心摘要明列 API token、Origin、Whisper 部分下載取消清理、串流上傳、任務執行、聲波、修剪、字幕重算、還原、分頁及取消狀態皆通過。
  - Whisper 下載測試包含下載前取消及 partial body 已落入 `.download` 後取消；核心 API 以 POST 啟動、GET 觀察 `bytesDownloaded > 0`、DELETE 取消，再確認 `.download`／`.previous` 清除，round1 指出的「只在 response 前取消」缺口已閉合。
  - 測試 fixture 僅在 `NODE_ENV=test` 與顯式旗標同時成立時啟用；正式下載仍使用固定白名單模型與正式 fetch／AbortSignal／cleanup 契約，沒有加入產品可指定任意 URL 的路徑。
  - 目前工作樹的 `lib`、`public`、`server.mjs` 與最終 macOS、Windows unpacked resources 經 `diff -qr`／`cmp` 均無差異；兩平台版本均為 `0.48.1`，排除「測到未封裝來源」的邏輯落差。
  - Electron `43.3.0`、electron-builder `26.15.7` 與 round2 前的 `npm audit --json` 0 vulnerabilities 證據仍有效；本輪未修改產品來源、相依性或四項資產。既有機密／大型檔排除及封裝白名單證據亦未因本輪純驗證工作改變。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 下載器 deterministic 回歸覆蓋下載前取消、partial body 後取消、錯誤 SHA、超過大小、HTTP 503、timeout、Windows 既有損壞檔替換、backup／temporary cleanup；active API 另覆蓋 POST→GET partial bytes→DELETE 及無進行中下載時 DELETE 的狀態。
  - 最終 macOS executable 使用隔離 userData 執行，避免既有使用者設定、任務或快取誤使 smoke 通過；上傳工作實際從建立、啟動走到 `completed`，並確認產生 cleaned SRT。
  - 最終封裝只內建 `ggml-tiny.bin`；Base／Small 依設計在首次使用時下載。這證明封裝邊界正確，但未證明兩個較大模型在真實 CDN 中斷、睡眠／喚醒、磁碟不足、Windows handle 釋放或中文長音訊下的行為。
  - 未覆蓋 Windows 10／11 的 renderer、Setup／Portable 安裝、捷徑、userData 權限、解除安裝；亦未覆蓋真實 Azure、不同 Windows Ollama、Base／Small 中文準確率、效能與記憶體。這些外部邊界不能由 macOS cross-build、mock 或本機 loopback 推論為通過。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - 本輪 `npm run check` 完整通過，內含文件檢查、語法檢查及全套測試；`git diff --check` 亦通過，沒有 whitespace error。
  - round2 已確認 partial-body fixture 使用正式 AbortSignal 與 cleanup 實作，測試 hook 收斂於雙重測試旗標；本輪完整回歸沒有發現該補強造成產品或其他測試退化。
  - `codesign --verify --deep --strict` 對最終 unpacked macOS App 通過；狀態仍為 `Signature=adhoc`、`TeamIdentifier=not set`，文件沒有把 ad-hoc 誤述為 Developer ID 簽章或公證。
  - 工作樹對兩平台封裝來源相同、版本一致且模型目錄 Tiny-only；目前 `asar:false` 維持既有、已揭露的後續封裝強化風險，未在本輪冒險改變 runtime 路徑。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 與 round2 不同，本輪審查代理已獨立完成完整 `npm run check`，不再只引用主要代理的核心／完整回歸紀錄；因此 round2 因受控權限用量上限留下的本機自動回歸可重播性缺口已解除。
  - 本輪獨立執行 `hdiutil verify ../dist/offline-subtitle-factory-0.48.1-macos-arm64.dmg`，最終輸出為 `checksum ... is VALID`；這是最後 DMG 本身的容器 checksum 驗證，不是前一 build 的替代證據。
  - 本輪獨立以 `node scripts/verify-electron-renderer.mjs '../dist/mac-arm64/離線字幕工廠.app/Contents/MacOS/離線字幕工廠' 9253 30000` 啟動最後 macOS executable；health／settings、bridge、上傳→completed→cleaned SRT、trim assets、review AI、七 provider、glossary round-trip 及 folder event 均通過。
  - round2 的 SHA／archive／metadata／codesign／source diff 已再次核對且資產未變；但自動測試與 macOS packaged smoke 不等同 Windows、Base／Small、真實供應商端點或安裝後實機覆蓋，故公開發布矩陣仍只能判為部分通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - `shasum -a 256 -c` 對兩份清單及四個最終主要資產全部 OK：macOS DMG `8e1af746dbb30966b7e276e868f4a705bb275351139c0016a4539aa5e64ffb0d`、ZIP `9acb0d3563180a3f1b11c30608459e839a044bc37d908596c730fb28268a1ab9`、Windows Setup `ecc81fbdae1dceeb7d4866b9bcc4b6b4952a414ccc3013963043cc21748cbadc`、Portable `e2f17b3fd2ff94ad6ac58fe2747cd3333dcf983da53efade122fd7f442ba9c77`。
  - Node crypto 重算確認 `latest-mac.yml` 的 ZIP／DMG 與 `latest.yml` 的 Setup URL、size、SHA-512 均一致；`unzip -t` 對 macOS ZIP 無錯誤，兩個 Windows EXE 的 `7zz t` 均回報 `Everything is Ok`。
  - 最終 DMG 的 `hdiutil verify` 已在本輪獨立回報 checksum `VALID`。最終 macOS executable 的隔離 userData renderer smoke 回報：upload create `201`、start `202`、final status `completed`、`hasCleanedSrt=true`，trim workspace／job、review save、AI selection／session／secure key／collapsible UI、glossary round-trip 皆成功；provider 精確包含 `openai`、`openai-compatible`、`azure`、`groq`、`gemini`、`ollama`、`lm-studio`，folder request event 亦收到測試路徑。
  - `diff -qr`／`cmp` 證實目前產品來源與 macOS／Windows 最終封裝 resources 一致，且兩平台模型目錄都只含 `ggml-tiny.bin`；因此可判定「本機候選證據補齊」。
  - Git／GitHub 狀態仍未閉環：分支為 `codex/release-v0.48.1`，HEAD 仍是舊基準 `170e08e...`，大量 0.48.1 來源未提交；本輪核對未找到遠端同名 branch、`v0.48.1` tag 或 GitHub Release。2026-08-11 後續遠端重查曾遇 DNS 無法解析，這不會產生發布證據，也不能把「目前查不到」轉述成已推送或已發布。
  - 實際 Windows 啟動／安裝、Base／Small 下載與中文口說辨識、真實端點仍未執行。最終本機資產可驗證不等於 GitHub 公開下載可追溯或跨平台外部驗收完成。

## 發現分級

### 阻擋公開發布

1. 0.48.1 來源仍只是基於舊 HEAD 的未提交工作樹，尚未建立代表已驗證來源的不可變 release commit；遠端 branch、`v0.48.1` tag 與 GitHub Release 均不存在，也沒有發布後資產 digest、size、URL 與 tag target 反向核對。
2. `AUTH-2026-07-23-01` 只接受 Windows 未 Authenticode 與 macOS 未 Developer ID 簽章／公證，明確不涵蓋未實機測試；Windows、Base／Small、真實端點及安裝後實機缺口尚未由需求方另行接受或完成驗收。
3. REL-025-R2 尚須由主要代理連結本 round3 報告、逐字引用結論並如實處理狀態／授權欄位；目前 `docs:check:final` 的紅燈是正確停止條件。即使治理欄位回填完成，若未實機風險仍未獲接受，也不得將本報告解讀為公開發布授權。

### 重要

1. 在 Windows 10／11 乾淨實機重播 Setup／Portable 啟動、renderer、partial download→DELETE→暫存／backup 清理、userData 權限、捷徑與解除安裝；若使用 Windows Actions 產物發布，須以 runner 最終 artifact 取代或核對 cross-build 並重算所有公開 metadata／digest。
2. 至少對 Base／Small 固定來源完成首次下載、中斷／重試／取消、磁碟空間與中文長音訊品質／速度／記憶體驗收；Tiny-only 安裝包成功不能替代高階模型實測。
3. 以可安全使用的真實 Azure 與代表性 Windows Ollama 版本執行端點 smoke；測試需保存版本、request contract、輸出與人工品質判定，不能把 mock provider 契約宣稱為真實服務驗收。

### 建議

1. 建立 machine-readable release manifest，綁定最終 commit、四資產名稱／size／SHA-256、updater SHA-512、簽章狀態、封裝來源 diff 與各實機驗收狀態。
2. GitHub 發布後下載全部公開資產重新計算 digest，並核對 Release target、tag、Latest、資產 URL、size 與本機清單；不可靜默替換相同版本資產。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：round2 所列最後 build 的 DMG 容器與 packaged renderer 本機證據缺口已解除，完整自動回歸與最終資產／來源亦通過；公開發布仍被不可變 release commit／GitHub 閉環不存在、Windows／Base／Small／真實端點／安裝後實機缺口未驗收且未獲風險接受，以及 REL-025-R2 治理停止閘門尚未結案所阻擋。
- 剩餘風險：Windows renderer、安裝／解除安裝、stream handle 與 userData 權限；Base／Small 真實下載、中文口說品質、長音訊效能與資源用量；真實 Azure／Windows Ollama；未簽章／未公證、`asar:false`；GitHub 發布後資產與來源追溯尚不存在。
- 給主要開發代理的具體修正要求（若有）：連結並逐字引用本報告，明確把「本機候選證據補齊」與「可公開 Release」分開；不要因本輪本機通過而把未實機條件改成已接受。先取得需求方對具體未實機風險的接受或完成外部驗收，再建立／審核 release commit、推送、tag、Release，並執行發布後下載反向核對；若任一來源或資產改變，相關 checksum、metadata、source diff、DMG／renderer 與必要回歸必須從新快照重做。
- 可逐字引用完整結論句：**REL-025-R2 round3 獨立複審結論為有條件通過：0.48.1 最終本機候選已由本輪獨立重驗通過 DMG hdiutil checksum、隔離 userData packaged renderer、完整 npm run check、四項資產 SHA-256、ZIP／NSIS、updater SHA-512、codesign、Tiny-only 及兩平台封裝 source diff，因此 round2 的本機證據缺口已解除；但目前工作樹尚未形成不可變 release commit、遠端 branch／v0.48.1 tag／GitHub Release 均不存在，Windows／Base／Small／真實端點／安裝後實機也未驗收且未獲需求方風險接受，所以本輪只證明本機候選證據補齊，不構成可公開 Release 的授權或 GitHub 發布完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告明確區分本輪獨立重驗、round2 仍有效的同一資產證據、本機候選完成與公開 Release 授權；沒有以 macOS／mock／cross-build 結果替代 Windows、Base／Small、真實端點或安裝後實機驗收。
- 若上述聲明不實，本報告無效。
