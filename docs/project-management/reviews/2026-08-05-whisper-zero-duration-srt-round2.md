# 獨立審查報告：Whisper SRT 零長度時間碼清理（BUG-015）

- 審查對象 commit／版本：0.48.0 工作樹、既有 job 與 2026-08-05 最終本機測試封裝
- 對應 08-CHANGE-LOG 條目：2026-08-05 — 修正 Whisper SRT 零長度時間碼造成的載入失敗（BUG-015）
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-08-05 09:53 +08:00；獨立重新讀取最新來源、round1 後差異、實際 job、隔離 HTTP 回應與兩平台封裝，未修改 round1 報告或其他專案檔案。

## 1. 需求完整性

- 判定：通過
- 證據：`lib/whisper-srt.mjs:24-69` 仍集中提供 SRT 清理器；`server.mjs:1435-1444`、`server.mjs:1558-1579` 覆蓋 Python Whisper／Whisper.cpp 產出，`server.mjs:3641-3682` 新增既有任務 `review-data` 載入 fallback。新版 server 對原始 job 703／704／707 實際回傳 HTTP 200、清理後 cue 可載入，符合「既有任務也能進入校閱」的 round1 缺口修正。

## 2. 邏輯正確性

- 判定：通過
- 證據：`review-data` 先嘗試嚴格 `parseSrtBilingual`，解析失敗才呼叫 `sanitizeWhisperSrt`，以修復後 subtitle 重新解析並保留原始檔（`server.mjs:3652-3666`）；全部無效時不會回傳空的假成功資料，而是沿用原始 parser 錯誤。於隔離設定啟動新版 server：`GET /api/jobs/20260805011912-3fca91/review-data` 回 `HTTP/1.1 200 OK`，回應 `cueCount=2296`、`hasZero=false`，新 cue `id=703` 為 `start=1433.56, end=1433.88`。server log 同時記錄「已略過 3 段無效 Whisper SRT cue」。

## 3. 邊界情況

- 判定：通過
- 證據：`node scripts/test-whisper-srt.mjs` 仍通過 BOM／CRLF、零長度、逆序、格式錯誤、多行、來源索引、重新編號及全部無效輸入；`npm run check` 亦重新通過。實際 job 原始 `draft.srt` 的第 703／704 段為 `00:23:53,560 --> 00:23:53,560`，第 707 段為 `00:23:54,160 --> 00:23:54,160`，HTTP fallback 後三段均不再出現在字幕資料且新 id 連續。尚未在 Windows 實機或超長時碼執行同一端到端流程，列為外部驗收風險而非本次回歸阻擋。

## 4. 程式碼品質

- 判定：通過
- 證據：fallback 只在既有 `review-output/bilingual-cues.json` 不存在且嚴格 parser 拋錯時啟用，避免覆蓋已保存的校稿資料；修復後 response 的 `subtitle` 與 `bilingualCues` 使用同一組有效 cue，並保留 `subtitleFileName`／video 路徑。兩個 ASR 產出路徑及既有任務載入共用同一清理器，無重複 parser。`node --check server.mjs`, `node --check lib/whisper-srt.mjs`, `git diff --check` 均通過。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：2026-08-05 09:53 +08:00 執行 `npm run check` 通過（治理、語法、全套測試與核心 HTTP 回歸），`npm run runtime:verify:mac` 與 `npm run runtime:verify` 均回報 `OK`；另以隔離 `OFFLINE_SUBTITLE_DATA_DIR`／`OFFLINE_SUBTITLE_SETTINGS_DIR` 啟動 server，帶 `X-Offline-Subtitle-Token` 實際請求 job review-data，取得上述 200／2296／無零長度結果。兩 ZIP `unzip -t` 均回報 `No errors detected in compressed data`；兩平台 `inspectWhisperModels` 均為 Tiny `valid:true`、Small `installed:true, valid:true, reason:"ok"`、Base `reason:"missing"`，Small 487,601,967 bytes、SHA-256 `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b`。仍未有 Windows 實機／Python Whisper 真實路徑證據，故不宣稱跨平台實機完成。

## 6. 實際運行結果

- 判定：部分通過
- 證據：實際以最終 macOS ZIP 內的 Electron executable（`ELECTRON_RUN_AS_NODE=1`）啟動 packaged `server.mjs`，HTTP response 的 `subtitleBytes=148645`、`cueCount=2296`、`hasZero=false`、`zeroCount=0`；`cue703` 回傳有效區間 `00:23:53,560 --> 00:23:53,880` 與字幕文字，server log 記錄略過 3 段。兩平台最終 ZIP SHA-256 重新計算一致：macOS `9c3c003d0ac8600674d1c077108aa8ffc30055e42578210ce52753c2bbedcf1f`、Windows `4600737a6c898b42129a954560b57f5931f1e3fc90487d2f6bb0a821178afc38`。兩份 unpacked manifest 與檔案核對一致，且 macOS／Windows 封裝內都包含更新後 `server.mjs:3661` fallback 與 `lib/whisper-srt.mjs`。這已補足 round1 未有的既有 job 實際載入證據；Windows 仍是在 macOS 主機做封裝／manifest／ZIP 驗證。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無已發現的 BUG-015 程式或回歸阻擋；本輪條件僅為保留 Windows 實機、Python Whisper 真實執行、長音訊、取消／fallback 與清理後中文品質的外部驗收界線，不得把本機測試包稱為正式 Release。
- 剩餘風險：若既有任務已存在 `review-output/bilingual-cues.json`，本輪 fallback 不會覆寫該已保存校稿資料；該檔案若自身含無效時間碼仍需另行資料修復。清理無效 cue 可能捨棄少量文字；模型品質與跨平台實機行為不在本輪證據內。
- 給主要開發代理的具體修正要求：在 `08-CHANGE-LOG.md` 逐字引用本報告結論並標示 round2；保留本輪 HTTP 200／2296／`hasZero=false`、兩 ZIP SHA、Small manifest valid 與 `npm run check` 證據；完成後執行 `npm run docs:check:final`。不得修改本報告；若後續新增實機證據改變判定，另建 round3。
- 可逐字引用完整結論句：**本輪 BUG-015 round2 已以新版 server 對實際 job 703／704／707 完成 review-data 端到端回歸：HTTP 200、2,296 段字幕全部為有效時間碼且新第 703 段為 1433.560→1433.880，清理器／兩個 Whisper 產出路徑、兩平台 Small manifest 與最終 ZIP SHA 均核對一致；但 Windows 實機、Python Whisper、長音訊、取消／fallback 與中文品質仍待外部驗收，因此結論為有條件通過，不得宣稱跨平台正式 Release 完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
