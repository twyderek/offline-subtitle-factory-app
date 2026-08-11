# 獨立審查報告：Whisper SRT 零長度時間碼清理（BUG-015）

- 審查對象 commit／版本：0.48.0 工作樹與 2026-08-05 本機測試封裝
- 對應 08-CHANGE-LOG 條目：2026-08-05 — 修正 Whisper SRT 零長度時間碼造成的載入失敗（BUG-015）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-05 09:43 +08:00；獨立讀取現行工作紀錄、來源差異、實際 job、測試與封裝產物，未沿用主要代理的評價性結論。

## 1. 需求完整性

- 判定：通過
- 證據：`lib/whisper-srt.mjs:24-69` 提供純函式清理器；`server.mjs:1435-1444` 與 `server.mjs:1558-1579` 分別覆蓋 Python Whisper 與 Whisper.cpp 寫入 `draft.srt` 前的清理。有效 cue 重新編號，`end <= start`／格式錯誤／空文字會捨棄；全部無效時兩路徑均回報可採取行動的錯誤。`scripts/test-whisper-srt.mjs:5-22` 覆蓋本次缺陷及全部無效邊界，且已納入 `package.json` 的 `npm test`。

## 2. 邏輯正確性

- 判定：通過
- 證據：清理器以嚴格 `HH:MM:SS,mmm`／句點時間碼解析，拒絕分鐘／秒數超界（`lib/whisper-srt.mjs:1-10`），以 `end <= start` 判斷零長度與逆序，保留 `sourceIndex` 供 Whisper.cpp JSON 指標對應（`lib/whisper-srt.mjs:38-59`）。實際以 job 的原始檔驗證：`public/bilingual-subtitles.mjs` 直接解析時回報「字幕第 703 段時間碼無效」；`sanitizeWhisperSrt` 回傳 `totalBlocks=2299, droppedCount=3, cues=2296`，清理後 `parseSrtBilingual` 成功載入 2296 cues，且第 703、704、707 段均被排除。Whisper.cpp 品質 metadata 以 `sourceIndex` 對回原始 JSON，再以新 cue id／時間碼驗證（`server.mjs:1567-1577`）。

## 3. 邊界情況

- 判定：通過
- 證據：`node scripts/test-whisper-srt.mjs` 實測通過 BOM／CRLF、正常 cue、零長度、逆序、格式錯誤、多行文字、來源索引與重新編號；全部無效輸入回傳空字幕而非送入 parser。另以 `parseWhisperQualityJson`／`attachWhisperQuality` 的合成資料驗證：原始第 2 段無效時，來源索引 `[0,2]` 仍可把第 1／3 段品質指標正確對回新 id `[1,2]`。保留風險是尚未以超過 99 小時的長時碼或真正含空白行字幕文字做引擎端到端驗收；這不影響本次零長度修正判定。

## 4. 程式碼品質

- 判定：通過
- 證據：清理邏輯集中於單一無副作用模組，兩個 ASR 路徑共用；原始 Whisper.cpp 輸出仍保留，`draft.srt` 只寫入標準化結果，無效 cue 數量寫入 job message／log（`server.mjs:1440-1444`, `1558-1566`）。錯誤訊息明確指向確認音訊或改用其他模型。`node --check lib/whisper-srt.mjs`, `node --check server.mjs` 與 `git diff --check` 均通過。

## 5. 測試覆蓋

- 判定：有條件通過
- 證據：2026-08-05 09:43 +08:00 執行 `npm run check` 通過（治理文件檢查、所有既有測試、`test-whisper-srt`、核心回歸）；`unzip -t` 對 macOS／Windows 測試 ZIP 均回報 `No errors detected in compressed data`。兩平台 unpacked 的 `inspectWhisperModels` 均回報 Tiny `valid:true`、Small `installed:true, valid:true, reason:"ok"`、Base `reason:"missing"`；Small 均為 487,601,967 bytes、SHA-256 `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b`。目前測試沒有在 Windows 實機啟動 packaged renderer／ASR，也沒有以真正 Whisper Python 路徑重跑此 job；因此不能把目錄／ZIP 驗證視為跨平台端到端驗收。

## 6. 實際運行結果

- 判定：有條件通過
- 證據：實際 job `/Users/nycu/Library/Application Support/offline-subtitle-factory/jobs/20260805011912-3fca91/working/draft.srt` 的原始第 703、704 段均為 `00:23:53,560 --> 00:23:53,560`，第 707 段為 `00:23:54,160 --> 00:23:54,160`；原始檔解析確實失敗，清理後解析成功並保留 2,296 段。兩個最新測試 ZIP 的目前 SHA-256 為 macOS `6f9aeddc8252906e75eba8002c27a8104426a61bb468fec8c29a90422112a18a`、Windows `5f81fd213717578e8c818e2f325a62ebecfb96c766f46ffd1f334fefcd6d45d5`；兩平台封裝內均含更新後的 `server.mjs`／`lib/whisper-srt.mjs` 與 Tiny／Small，manifest／檔案大小／SHA 一致。現有 job 是缺陷重現原始輸出，尚未取得透過新版 server 實際重跑後的 `job-status`／`draft.srt` 證據；另缺 Windows 實機與 packaged ASR 執行證據。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無已發現的清理器程式阻擋；結案前須由主要代理更新 BUG-015 changelog 的實際修改／驗證／獨立審查欄位，記錄本輪新 ZIP SHA，並補做新版 server 對 job 703／704／707 的實際重跑或等價 packaged ASR evidence。Windows 實機與 Python Whisper 路徑仍是未驗收條件，不得宣稱跨平台正式 Release 完成。
- 剩餘風險：捨棄無效 cue 可能造成少量內容遺失；長音訊、Windows 實機、Python Whisper、取消／fallback 與清理後中文內容品質仍未驗收。當前 changelog 的 Small 封裝 SHA 是先前產物，與本輪重新計算的 ZIP SHA 不同，需同步更新以避免證據歧義。
- 給主要開發代理的具體修正要求：保留本報告原文；在 `08-CHANGE-LOG.md` 逐字引用本報告結論並標示 `獨立審查是否執行：是`，補入本輪兩 ZIP SHA、實際 job 清理／parser 載入數量與條件接受狀態；完成後執行 `npm run docs:check:final`。若新增端到端證據改變本結論，建立 round2，不覆寫本報告。
- 可逐字引用完整結論句：**本輪 BUG-015 清理器與兩個 Whisper 輸出路徑的程式與測試均通過，實際 job 第 703／704／707 段可由清理器移除並讓 2,296 段字幕成功載入，兩平台測試 ZIP／Small manifest 亦核對一致；但新版 server 對該 job 的端到端重跑、Windows 實機與 Python Whisper 路徑尚未驗收，因此本輪結論為有條件通過，不得宣稱跨平台正式 Release 完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
