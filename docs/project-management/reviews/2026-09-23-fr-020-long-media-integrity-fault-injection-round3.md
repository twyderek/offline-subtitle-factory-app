# 獨立複審報告：FR-020／NFR-006 長媒體 integrity 與 evidence privacy（round3）

- 審查對象 commit／版本：專案 0.51.0；依 round2 所列基準 `299ff5d`，檢查目前尚未提交的工作樹差異。
- 對應 08-CHANGE-LOG 條目：`2026-09-23 — FR-020／NFR-006 長音訊輸入媒體完整性 fault injection`。
- 審查輪次：round3。
- 審查時間：2026-09-23 21:03（Asia/Taipei）。
- 審查代理啟動時間、上下文來源：本報告在新的獨立上下文中完成，未沿用主要開發代理的對話記憶；重新讀取 repo `AGENTS.md`、`docs/project-management/README.md`、`workflows/04-INDEPENDENT-REVIEW.md` 及 debug 路由要求的流程文件，並依 `npm run project:preflight -- --type=debug` 列出的上下文核對。唯一寫入檔案為本 round3 報告。
- 範圍：聚焦 round2 的自訂來源 SRT 路徑錯誤訊息外流，以及 temp root 清理未確認時未 fail-closed 兩項阻擋；核對 `safeProbeFailure`、`removeTempRootAndVerify`、`recordTempRootCleanup`、canary／unit tests、五案 harness 與 v8 evidence。

## 1. 需求完整性

- 判定：部分通過（限本次長媒體完整性 probe 與 evidence 隱私子範圍）。
- 證據：FR-020 定義於 `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:36`，NFR-006 要求變更可追溯、自動測試、文件檢查及獨立審查（`:61`）。本次處理的是 probe 對來源媒體／SRT 的完整性及 evidence 隱私，沒有驗收 FR-020 的信心指標、低可信片段篩選、人工校閱或產品 ASR 全流程。
- `scripts/verify-whisper-long-media.mjs:199-200` 的外層 catch 現在只寫入固定 `safeProbeFailure()` 結果，不再取用例外的 `message`／`code`；v8 第五案以自訂 missing-SRT 路徑觸發該 catch，evidence 為 `PROBE_FAILED`、probe exit 1、暫存清理成功且 canary 不在 evidence（`docs/project-management/evidence/2026-09-23-whisper-long-media-integrity-fault-injection-v8.json:62-70`）。因此 round2 所指出的「完整自訂路徑由 catch exception message 流入 evidence」已修正並有 probe-level 證據。

## 2. 邏輯正確性

- 判定：通過（限已檢查程式路徑）。
- 證據：`safeProbeFailure()` 不接受或序列化原始錯誤，固定回傳 `PROBE_FAILED`（`scripts/whisper-long-media-evidence.mjs:19-21`）。對 missing custom SRT，原始路徑仍用於執行期檢查，但 catch 輸出的 evidence error 不含原始例外文字（`scripts/verify-whisper-long-media.mjs:146-149,199-200`）。
- `removeTempRootAndVerify()` 捕捉 `rmSync` 例外後以 `lstatSync` 確認狀態；只有 `lstat` 回報 `ENOENT` 才回傳已移除，路徑仍存在或錯誤不可判讀都回傳 false（`scripts/whisper-long-media-evidence.mjs:23-35`）。`recordTempRootCleanup()` 對 false 設 `status='fail'`、`tempRootRemoved=false`，並記錄 `TEMP_ROOT_CLEANUP_FAILED`；若同時有 integrity failure 則記 `FINALIZATION_FAILED`（`:37-46`）。probe 寫入 evidence 後，非 pass 或未確認清理會設定 `process.exitCode=1`（`scripts/verify-whisper-long-media.mjs:247-255`）。
- `rmSync` 雖拋錯、但後續 `lstat` 確認路徑已不存在時，helper 會視為清理已達成；這是依「確認最終路徑不存在」判定 postcondition。rm throw 且目錄仍存在／`lstat` 不可確認的負向案例則會 fail closed。若契約要求「只要 rmSync 曾拋錯即使路徑已確認不存在也必須失敗」，目前實作不是該語義；round2 的清理缺口針對未確認移除，本報告依該 postcondition 契約判定。

## 3. 邊界情況

- 判定：已測邊界通過；probe-level cleanup failure 尚未直接注入。
- 證據：`node scripts/test-whisper-long-media-evidence.mjs` 本輪輸出通過。測試涵蓋 transcript-like canary 出現在 stderr／Error、固定化 probe failure、rm throw 後路徑仍存在，以及 rm throw 後 `lstat` 回報 `EACCES`；後兩種均確認回傳 false（`scripts/test-whisper-long-media-evidence.mjs:4-18,20-38`）。另確認 `recordTempRootCleanup(false)` 將 evidence 設為 fail 並填入 cleanup code（`:34-38`）。
- 五案 v8 harness/evidence 包含影片 hash mismatch／missing、來源 SRT hash mismatch／missing，以及自訂 missing-SRT path canary；五案都記錄預期 exit 1、各自錯誤碼或 canary 未保存，正常暫存清理為 true（`scripts/accept-whisper-long-media-integrity-fault-injection.mjs:11-16,73-114,116-145`；`...fault-injection-v8.json:13-70`）。v8 沒有注入 `rmSync` 失敗或清理後目錄仍存在／不可確認，因此不把它描述為 cleanup failure 的端到端故障注入證據。
- 程式串接顯示上述 cleanup false 會記入 evidence 並令 probe 非零結束；但本輪沒有在整個 probe 子程序層級注入清理失敗，故這項最終 evidence 寫入與 exit code 的負向行為是依目前程式控制流程核對，非本輪實際故障重播。

## 4. 程式碼品質／隱私

- 判定：部分通過。
- 證據：stderr 只保留行數／診斷行數摘要，process outcome 只保留固定 exit／signal／啟動失敗文字，不序列化原始 stderr 或啟動錯誤（`scripts/whisper-long-media-evidence.mjs:3-17`）；外層 probe catch 使用固定失敗物件（`:19-21`）。五案 harness 的 canary 驗證證明完整路徑中的目錄 canary 沒有由外層錯誤訊息進入最終 evidence（`scripts/accept-whisper-long-media-integrity-fault-injection.mjs:116-145`）。
- 剩餘隱私界線：evidence 初始化仍會保存 `path.basename(sourceSrtPath)`（`scripts/verify-whisper-long-media.mjs:122`），確認 SRT 後也會保存 basename（`:150-157`）。v8 canary 位於父目錄 `PRIVATE_TRANSCRIPT_CANARY`，檔名為 `missing-source.srt`，故測試證明完整路徑／目錄部分未漏出，但未證明使用者自訂的敏感 SRT basename 不會出現在 evidence。若隱私契約要求連檔名也不得保存，這是可達的殘餘暴露面；目前 round2 的「外層 catch 寫入完整路徑」則已關閉。

## 5. 測試覆蓋

- 判定：部分通過。
- 本輪實際執行（2026-09-23 約 21:03 Asia/Taipei）：
  - `node scripts/test-whisper-long-media-evidence.mjs`：輸出 `Whisper evidence 隱私測試通過`；canary 與三種 cleanup helper 狀態檢查通過。
  - `node scripts/test-whisper-long-media-integrity.mjs`：輸出 fixture `result=pass`；input-video 與 source-subtitles 各自的 unchanged、hash-mismatch、missing-after 共六個案例通過。
- v8 evidence 是既有可讀證據，本輪沒有重跑五案 harness：schema v2、macOS arm64／Node v22.22.3、五案 result pass；標明使用 `synthetic-whisper-cli-wrapper`、未讀原始媒體／SRT且未保存 transcript（`docs/project-management/evidence/2026-09-23-whisper-long-media-integrity-fault-injection-v8.json:1-12,13-72`）。
- 主要代理已告知修正後完整 `npm run check` 通過；依本輪指示未重跑完整回歸。本複審不把該結果寫成本輪獨立執行。cleanup failure 的 probe-level 非零 exit／落盤 evidence 未由 v8 或本輪 focused tests 端到端驗證。

## 6. 實際運行結果

- 判定：短合成 Tiny 正常 replay 與 fake-runtime 五案 evidence 支持有限範圍結果；原片、Windows 與真 Metal fallback 未由本輪驗證。
- 短合成 MP4 evidence v5 記錄約 3.587 秒輸入、bundled Whisper Tiny exit 0、產生非空 SRT／JSON、媒體及 SRT before／after hash 一致、`stderrSummary.contentStored=false`、temp root removed 及 status pass（`docs/project-management/evidence/2026-09-23-whisper-long-media-integrity-short-replay-v5.json:1-16,64-80,92-114`）。這是短合成媒體的 bundled Tiny 正常路徑，不是長原片重跑，也未觀察到真 Metal fallback（`:64-80` 的 `deviceObserved` 為 null）。
- v8 五案使用合成 WAV、bundled FFprobe／FFmpeg 與 fake Whisper wrapper，證明 probe 邊界的四種媒體／SRT 變更與一種錯誤路徑隱私行為；不能視為真實 Whisper 故障注入或模型品質測試（`...fault-injection-v8.json:4-12`）。
- 本輪未重跑 5,416 秒原片；既有原片 artifact 是較早的 v2，不等於本輪 v5 probe replay。Windows 實機與真實 bundled Metal crash→CPU fallback 亦未執行，不能由短 Tiny replay 或 fake runtime 推論已通過。

## 綜合判定

- 結論：有條件通過，僅限本次長媒體完整性 probe 的隱私與清理控制流複審。
- 阻擋問題：round2 的兩項程式邏輯阻擋已修正：自訂 SRT 完整路徑不再經外層 catch 寫入 evidence；清理未確認時會留下 fail evidence 狀態並令 probe 非零結束。尚未以 probe-level 故障注入驗證 cleanup 失敗 evidence 落盤與 exit code。
- 剩餘風險：來源 SRT basename 仍會進入 evidence，v8 canary 未測 basename；rmSync throw 但 lstat 確認路徑不存在時按清理 postcondition 視為成功；cleanup failure 尚無 probe-level 負向重播；本輪未重跑完整 `npm run check`、五案 harness或 5,416 秒原片，亦未驗 Windows 實機與真 Metal fallback。短合成 Tiny replay、fake runtime 與上述項目須保持區分。
- 給主要開發代理的具體要求：如 evidence privacy 範圍要排除來源檔名，請另行將 evidence 的來源 SRT basename 改為不識別值並加入 basename canary；如要把 cleanup failure 宣稱為端到端驗收，需另補 probe-level `rmSync` throw／path remains／`lstat` 不可確認案例，斷言 evidence failure code、`tempRootRemoved=false` 及子程序 exit 1。本報告不要求或執行這些額外變更。
- 可逐字引用的完整單句結論：**本輪 FR-020／NFR-006 長媒體 integrity/evidence privacy round3 獨立複審結論為有條件通過：round2 指出的外層 catch 自訂來源 SRT 完整路徑外流與清理未確認仍可能假成功兩項程式阻擋已修正，兩個 focused tests 本輪均通過，v8 五案證據亦確認 custom-path canary 未進 evidence 且短合成／fake-runtime 範圍如實標示；但 cleanup failure 尚未做 probe-level 非零 exit／落盤 evidence 故障注入，來源 SRT basename 仍可寫入 evidence 且未由 canary 覆蓋，本輪亦未重跑完整 npm run check、5,416 秒原片、Windows 實機或真實 Metal fallback，因此結論只適用於已檢查的 probe 控制流，不代表 FR-020 整體或上述未驗範圍完成。**

## 審查代理聲明

- 本審查代理以新的獨立上下文完成複審；除建立本報告外，只執行讀取與使用者指定的兩項 focused tests，未修改任何其他檔案，亦未重跑完整回歸或 v8 harness。
- 本輪唯一寫入檔案為 `docs/project-management/reviews/2026-09-23-fr-020-long-media-integrity-fault-injection-round3.md`。若上述聲明不實，本報告無效。
