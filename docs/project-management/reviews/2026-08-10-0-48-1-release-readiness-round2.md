# 獨立複審報告：0.48.1 發布審查修正與結案（REL-025-R1）

- 審查對象 commit／版本：`codex/release-v0.48.1` 工作樹，基準 HEAD `170e08e17d38b4c7a9c94d3e1ba031a382539d9a`，應用程式版本 `0.48.1`；REL-025-R1 與其候選來源仍未提交。
- 對應 08-CHANGE-LOG 條目：`2026-08-10 — 0.48.1 發布審查修正與結案（REL-025-R1）`（`docs/project-management/08-CHANGE-LOG.md:16`）
- 前輪報告：`docs/project-management/reviews/2026-08-10-0-48-1-release-readiness-round1.md`
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-08-10T11:18:15+08:00 前完成 preflight 與固定快照核對；由同一獨立審查角色的新一輪任務執行，判定依目前檔案、可安全重跑的指令與系統明示的權限限制，不把主要代理聲稱的結果冒充成獨立重跑。
- 審查環境：macOS Apple Silicon、Node.js `22.22.3`；不得以繞過方式重跑已被受控權限用量上限拒絕的 loopback／`hdiutil`／GUI 操作。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - REL-025 round1 要求的三項修正均有對應實作：置頂 `REL-025-R1` 使 final gate 選到當前工作、`00-CURRENT-STATUS.md:14` 已移除「待 metadata／SHA」過期敘述、下載取消新增 partial body 單元與 active API 整合案例（`docs/project-management/08-CHANGE-LOG.md:16-41`）。
  - `FR-023` 的「取消須中止背景請求並清除未完成檔案」仍由需求文件明確定義（`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:39`），本輪測試直接對應該驗收條件。
  - 本輪範圍明確排除 push／tag／Release 與 Windows／Base／Small／真實端點外部實機宣稱（`docs/project-management/08-CHANGE-LOG.md:27`、`:39-41`）；這些不是本輪修正遺漏，但仍是公開發布停止條件。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - 測試下載 fixture 同時要求 `NODE_ENV === 'test'` 與 `OFFLINE_SUBTITLE_TEST_WHISPER_PARTIAL_DOWNLOAD === '1'`，正式環境只使用 `globalThis.fetch`（`server.mjs:48-51`、`:1013-1029`），未增加可由產品 API 啟用的任意下載來源。
  - fixture 先 enqueue 一段內容並等待 abort 才 error，server 仍走正式的 `downloadWhisperModelFile`、state、progress、DELETE controller 與 cleanup 路徑；沒有在測試中直接偽造 cancelled 結果（`server.mjs:1001-1052`）。
  - 單元測試等待 `.download` 存在且 size > 0 後才 abort，再確認 `.download`／`.previous` 都不存在（`scripts/test-whisper-model-download.mjs:80-116`）。
  - 核心 API 測試由 POST 得到 202、GET 觀察 `bytesDownloaded > 0`、檢查暫存檔、DELETE 得到 cancelled，最後等待 `.download`／`.previous` 清空（`scripts/test-core.mjs:247-268`），證明 round1 指出的契約缺口已在測試設計上閉合。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 2026-08-10 11:18+08:00 獨立重跑 `node scripts/test-whisper-model-download.mjs` 通過，包含下載前取消、部分 body 已落盤後取消、錯誤 SHA、過大回應、HTTP 503、timeout、Windows 既有損壞檔替換與備份清理。
  - active API 測試另保留「沒有進行中下載時 DELETE 冪等」及「下載中 DELETE」兩種狀態（`scripts/test-core.mjs:241-268`）。
  - 仍未覆蓋 Windows 實機在 stream handle 尚未完全釋放時的 unlink／rename 行為、真實 Base／Small CDN 中斷、睡眠／喚醒、長音訊與安裝後 userData 權限；單元與 macOS loopback fixture 不可宣稱跨平台外部驗收完成。

## 4. 程式碼品質

- 判定：通過
- 證據：
  - 2026-08-10 11:18+08:00 `node --check server.mjs`、`node --check scripts/test-core.mjs`、`node --check scripts/test-whisper-model-download.mjs`、`git diff --check` 與 `npm run docs:check` 均通過。
  - 測試 hook 範圍集中在下載器注入點，沒有為測試複製取消／cleanup 邏輯；單元 fixture 與 API fixture 都使用正式 AbortSignal 契約。
  - `npm ls electron electron-builder --depth=0` 仍解析為 `electron@43.3.0`／`electron-builder@26.15.7`，package／lock/root version 均為 `0.48.1`；本輪沒有新增相依性變更。round1 的完整 `npm audit --json` 0 vulnerabilities 證據仍適用，但本輪未把它記為重新連線稽核。
  - 強特徵機密掃描再次對 private key、GitHub/OpenAI/Google/Slack/AWS token 得到 0 命中；測試 fixture 沒有憑證、任意 URL 或實際模型內容。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 主要代理在置頂條目記錄 focused `test-whisper-model-download.mjs`、`test-core.mjs` 與完整 `npm run check` 通過（`docs/project-management/08-CHANGE-LOG.md:31`）；來源檢查確認完整 `npm run check` 會包含上述兩個測試。
  - 審查代理獨立重跑不需 listener 的 partial-body 單元測試成功；但嘗試重跑 `test-core.mjs`／完整回歸時，受控權限系統以用量上限拒絕建立受控 loopback 執行環境，且明示不得以 workaround 繞過，因此本報告只引用主要代理的核心／完整通過紀錄，不將其描述成 round2 獨立重播成功。
  - `npm run docs:check:final` 現在會針對置頂 REL-025-R1 回報「尚未完成／待執行 round2／發布授權不足」，而非誤驗 FR-024；這證明 round1 的條目指向修正有效。它目前為預期的紅燈，不能在 round2 引用、正確授權與狀態更新前宣稱 final gate 通過。
  - 更重要的是，常設授權不涵蓋未實機測試；若 round2 維持有條件通過且條件未被需求方接受，final gate 應持續阻擋，而不應為求綠燈弱化風險敘述或誤記授權。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 2026-08-10 11:18+08:00 對 round1 修正後的最後 build 執行 `shasum -a 256 -c`，四個主要資產與兩份清單全部 OK：macOS DMG `8e1af746dbb30966b7e276e868f4a705bb275351139c0016a4539aa5e64ffb0d`、ZIP `9acb0d3563180a3f1b11c30608459e839a044bc37d908596c730fb28268a1ab9`、Windows Setup `ecc81fbdae1dceeb7d4866b9bcc4b6b4952a414ccc3013963043cc21748cbadc`、Portable `e2f17b3fd2ff94ad6ac58fe2747cd3333dcf983da53efade122fd7f442ba9c77`。
  - Node crypto 重算確認 `latest-mac.yml` 對 DMG／ZIP及 `latest.yml` 對 Setup 的 URL、size、SHA-512 一致；`unzip -t` 與兩個 `7zz t` 均通過，兩個 NSIS 顯示 `Everything is Ok`。
  - `codesign --verify --deep --strict` 對最後 unpacked macOS App 通過，狀態為 `Signature=adhoc`、`TeamIdentifier=not set`；Windows 簽章狀態檔明示 unsigned，與常設授權揭露一致。
  - `diff -qr`／`cmp` 確認目前工作樹的 `lib`、`public`、`server.mjs` 與最後 macOS／Windows unpacked 封裝完全一致；兩平台封裝版本都是 `0.48.1`，模型目錄都只含 `ggml-tiny.bin`。
  - 限制：最後 build 的 DMG `hdiutil verify` 與 packaged renderer smoke 重跑已被受控權限用量上限拒絕，本輪依明示要求沒有繞過重試；round1 前一 build 的兩項通過只能作回歸參考，不能替代上述最後 DMG／App 的獨立重驗。最後 DMG 目前只有 SHA／metadata 證據，尚缺容器 checksum verify；最後 App 有 source diff／codesign，尚缺實際 renderer 啟動證據。
  - HEAD 仍是基準 `170e08e`，工作樹未提交，沒有本地／遠端 `v0.48.1` tag 或 Release 可追溯性；GitHub 發布後 digest、size 與下載 URL 仍未執行。

## 發現分級

### 阻擋公開發布

1. 最後 build 尚缺 `hdiutil verify` 與 packaged renderer 實際重跑；在補齊這兩項或由需求方明確接受該特定未實測風險前，不得把前一 build 證據移植成最後資產通過。
2. REL-025／REL-025-R1 尚未形成不可變 release commit、push、tag／Release；公開發布後資產 digest 與下載反向核對亦不存在。
3. `AUTH-2026-07-23-01` 只涵蓋 Windows 未簽章與 macOS 未公證，不涵蓋 Windows、Base／Small、真實端點及安裝後實機缺口；需求方尚未接受這些風險。
4. `docs:check:final` 已正確對準 REL-025-R1，但目前仍因 round2 未結案與發布授權範圍不足而失敗；若風險未獲接受，紅燈是正確停止條件，不能藉改寫文件繞過。

### 重要

1. 權限恢復後由獨立上下文重跑 `test-core.mjs` 與完整 `npm run check`，保留本輪 active DELETE fixture 的獨立可重播證據；目前只有主要代理的受控通過紀錄。
2. 在 Windows 10／11 實機中重播 partial download→DELETE→暫存／backup 清理，補齊 Windows stream handle 與 userData 權限差異。
3. 若使用 Windows Actions 產物公開發布，應用 Windows runner 最終 artifact 取代 macOS cross-build 並重算公開 SHA／metadata。

### 建議

1. 測試 hook 後續可抽成僅由測試啟動程式注入的 fetch adapter，減少 production source 中的 fixture 分支；目前雙重環境旗標已足以避免本版正式環境誤啟用。
2. 建立 machine-readable release manifest 綁定最終 commit、四資產 size／SHA-256、updater SHA-512、簽章與實機狀態。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：round1 的條目指向、狀態文件與 partial-body／active DELETE 測試缺口已修正，最終四資產 checksum／archive／metadata／codesign／source diff 亦通過；公開發布仍被最後 build 缺少 `hdiutil verify`／renderer 實測、不可變來源與 GitHub 閉環不存在、外部實機風險未獲授權及 final gate 尚未結案所阻擋。
- 剩餘風險：Windows partial-download 清理、Windows renderer／安裝／解除安裝、Base／Small 真實下載與中文長音訊、真實 Azure／不同 Ollama、最後 DMG 容器驗證、最後 macOS renderer、未簽章／未公證與 `asar:false`。
- 給主要開發代理的具體修正要求（若有）：連結並逐字引用本報告；不得在未接受條件下強制讓 final gate 轉綠；權限恢復後補最後 build 的 `hdiutil verify`、packaged renderer、獨立核心／完整回歸，並在取得外部實機風險接受或驗收完成後建立 release commit／push／tag／Release 與發布後下載核對。
- 可逐字引用完整結論句：**REL-025-R1 round2 獨立複審結論為有條件通過：置頂條目已讓 `docs:check:final` 正確對準目前工作、`00-CURRENT-STATUS.md` 已移除 metadata／SHA 過期敘述，partial body 寫入後取消單元測試與 POST→GET partial bytes→DELETE→暫存清理核心案例已補齊，最後四項資產的 SHA-256、ZIP／NSIS、updater SHA-512、codesign、Tiny-only 與兩平台封裝 source diff 亦通過，但受控權限用量上限使最後 build 的 `hdiutil verify`、packaged renderer 及 round2 核心／完整回歸無法由審查代理重新執行，且來源 commit／push／tag／Release 尚未建立、未實機風險也未獲需求方接受，因此在補齊上述證據與授權前不得公開發布或宣稱 0.48.1 無條件正式版。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告明確區分主要代理已記錄通過的核心／完整測試與審查代理實際重跑的安全檢查，也沒有以 round1 前一 build 的 `hdiutil`／renderer 結果替代最後 build。
- 若上述聲明不實，本報告無效。
