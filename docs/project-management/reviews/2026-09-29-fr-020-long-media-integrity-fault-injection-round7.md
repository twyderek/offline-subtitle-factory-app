# 獨立複審報告：FR-020／NFR-006 長媒體完整性 fault injection（round7）

- 審查對象 commit／版本：版本 `0.51.0`；分支 `codex/0.51-anthropic-claude`；preflight 顯示工作樹已有變更；本輪未另行擷取 HEAD SHA。
- 對應 08-CHANGE-LOG 條目：`2026-09-23 — FR-020／NFR-006 長音訊輸入媒體完整性 fault injection`（目前 `docs/project-management/08-CHANGE-LOG.md:3-33`）。
- 審查輪次：round7。
- 審查代理啟動時間、上下文來源：2026-09-29；精確啟動時刻未記錄。這是本輪獨立審查上下文；重新讀取需求、source、tests、v11 artifact、round5／round6 與治理差異，並重新執行下列 focused 驗證；未沿用 round6 的綜合結論作為本輪判定。
- 審查環境：macOS Darwin arm64、Node.js `v22.22.3`；`npm run project:preflight -- --type=development` 於 2026-09-29 11:24:05 CST exit 0，回報版本 `0.51.0`、分支 `codex/0.51-anthropic-claude`、工作樹已有變更。

## 1. 需求完整性

- 判定：部分通過。
- 證據：需求表 `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:36,61` 將 FR-020 定義為低可信片段工作流，NFR-006 要求變更可追溯並完成測試、文件檢查及獨立審查；本次只審查長媒體 integrity probe 的完整性／隱私／cleanup fault-injection 切片，不代表 FR-020 其他字幕品質與人工校閱需求已完成。設計邊界及不宣稱 ground truth 的限制見 `docs/project-management/03-FUNCTIONAL-DESIGN.md:121-123`；最新工作紀錄 `08-CHANGE-LOG.md:5-6,20-21` 目前標為進行中，表示 round7 及 final gate 尚待結束。

## 2. 邏輯正確性

- 判定：通過。
- 證據：`scripts/whisper-long-media-integrity.mjs:29-55,58-66` 以串流 SHA-256 計算檔案摘要，並用讀取前後的 device／inode／size／mtime／ctime、讀取 byte 數及 digest 驗證 snapshot 穩定；`hasSameFileIntegrity` 僅在兩側存在且穩定、大小及 hash 一致時回傳 true。`scripts/verify-whisper-long-media.mjs:140-157,204-246` 對輸入媒體與來源 SRT 保存 before／after 狀態，變更、消失或無法完成 hash 均記錄 integrity failure；`:247-255` 要求 temp root 經移除後由 `lstat` 確認不存在，清理未確認時 evidence fail 且 exit 非零。round5 的 repo 外 replay、精確路徑及 final gate 條件見 round5 報告 `:52-55`；round6 對目前 exact-path 注入的檢視見 round6 報告 `:18-21`。本輪重播亦再次通過七案（第 3、6 節）。

## 3. 邊界情況

- 判定：通過。
- 證據：`node scripts/test-whisper-long-media-integrity.mjs`（2026-09-29 11:20:34 CST，exit 0）以兩種 fixture 各驗證 unchanged、同大小 hash mismatch、missing-after，共六種結果；`node scripts/test-whisper-long-media-evidence.mjs`（同時刻，exit 0）確認 transcript-like canary 不進入 stderr／process failure 摘要，並確認 rm 後仍存在或 `lstat` 無法確認都會 fail closed。`npm run acceptance:whisper:integrity-fault-injection -- /private/tmp/fr020-round7.3T32xI/evidence-v11-round7.json`（2026-09-29 11:22:37–11:22:39 CST，exit 0，七案 pass）涵蓋媒體改寫／消失、SRT 改寫／消失、自訂路徑與 basename 隱私、cleanup 實際拒絕刪除且 root 殘留；外部 evidence `:13-92` 逐案記錄預期／實際 exit、failure code、canary 與 cleanup 結果。未驗證「檔案在兩次 snapshot 間改寫後又恢復原內容」等短暫變更，這仍是 before／after hash 方法的固有限制。

## 4. 程式碼品質

- 判定：通過。
- 證據：`scripts/whisper-long-media-evidence.mjs:3-20` 將 stderr 降為行數／診斷計數，process error 只輸出固定摘要；`:23-45` 將 `lstat` 的 `ENOENT` 作為清理成功條件，其他結果均 fail closed。`scripts/verify-whisper-long-media.mjs:122,146-157,199-200` 對來源 SRT 使用固定 `source.srt` 標籤，外層錯誤不保存原始例外路徑；fault-injection harness `scripts/accept-whisper-long-media-integrity-fault-injection.mjs:202-250` 在 isolated case 內預選 root、只攔截 resolve 後完全相等路徑，並在 finally 清理後斷言 `ENOENT`。六個相關 MJS 的 `node --check`（2026-09-29 11:20:34 CST）全部 exit 0。此判定限 probe／測試程式，不延伸為產品 ASR 品質判定。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：本輪已實際執行兩個 focused tests（2026-09-29 11:20:34 CST，均 exit 0）、六個相關 MJS 的 `node --check`（同時刻，exit 0）、七案 acceptance harness（11:22:37–11:22:39 CST，exit 0）、`npm run docs:check`（11:22:49 CST，exit 0，19 個治理文件）及 `git diff --check`（11:22:49 CST，exit 0）。此外，`npm run docs:check:final` 於 11:18:26 CST 實際 exit 1，validator 明確輸出 round6 報告「缺少有效綜合結論」及「審查代理聲明不完整」兩項錯誤；規則可回溯至 `scripts/project-docs-validator.mjs:24-32`。round6 原文第 57 行使用 `- 結論：**CONDITIONAL PASS**`，不符合 validator 要求的中文結論詞；第 66-68 行亦未逐字含有固定聲明句「本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。」及「若上述聲明不實，本報告無效。」本報告依固定中文欄位與逐字聲明撰寫。未執行完整 `npm run check`、長片重播或 Windows 實機；完整自動回歸僅有 08 條目歷史記錄，未由本輪獨立重跑。

## 6. 實際運行結果

- 判定：通過。
- 證據：本輪於 macOS arm64／Node `v22.22.3` 實際執行 acceptance harness，輸入由 FFmpeg 生成的一秒合成 WAV，使用 isolated fake Whisper wrapper；只 symlink bundled FFmpeg／FFprobe／Tiny model，不執行 bundled Whisper 長片路徑。命令及時間見第 3 節；輸出 `/private/tmp/fr020-round7.3T32xI/evidence-v11-round7.json:1-92` 記錄 `originalMediaRead=false`、`originalSrtRead=false`、`transcriptStored=false`，七案全部 pass。cleanup fault 案記錄 probe exit 1、`TEMP_ROOT_CLEANUP_FAILED`、`tempRootRemoved=false`、清理前 root 確實存在、父 harness finally 清理後 `tempRootRemovedByHarness=true`（`:80-89`）。本輪沒有讀寫需求方原始 5,416 秒媒體；未重跑該來源媒體。

## 綜合判定

- 結論：有條件通過
- 可逐字引用完整結論句：**本輪獨立複審確認 FR-020／NFR-006 長媒體 integrity probe 的前後 SHA-256、evidence 隱私與 cleanup fail-closed 控制流由目前 source、兩項 focused tests、v11 artifact 及本輪 repo 外七案 replay 支持；惟 npm run docs:check:final 實際因 round6 報告缺少有效綜合結論及固定聲明而 exit 1，且最新 08-CHANGE-LOG 尚未引用 round7 報告與本句，因此僅就 probe 完整性切片有條件通過，待主要代理同步本報告路徑及逐字結論句後重跑並通過 final gate，方可結案。**
- 阻擋問題（若有）：治理 final gate 尚未完成。實際 `npm run docs:check:final` exit 1，round6 報告有兩項 validator 格式錯誤；最新工作紀錄 `docs/project-management/08-CHANGE-LOG.md:20-21,28-31` 已記錄 round7 進行中與 final gate 失敗，但目前只連結／逐字引用 round6，尚未加入本 round7 報告及本報告完整結論句。此報告代理受限於僅能建立 round7 報告，未修改工作紀錄或 round6 原件；主要代理同步後仍須重新執行 final gate，未通過前不可宣稱結案。
- 剩餘風險與未驗項：未執行完整 `npm run check`、未重跑原始 5,416 秒來源媒體、未驗證字幕語意／人工校閱、confidence／no-speech 品質、來源 SRT ground truth、真實 bundled Metal crash→CPU fallback、原生 OS 權限拒絕、Windows 實機、乾淨安裝或 Release。七案只證明此 synthetic probe fault-injection 切片；不得擴大宣稱 FR-020 整體完成。
- 給主要開發代理的具體修正要求（若有）：保留 round6 原件；在最新 08 工作紀錄加入本報告路徑及上列完整結論句的逐字引用，反映治理 gate 仍待通過，之後重跑 `npm run docs:check:final` 並記錄實際結果。不要以既有 `npm run docs:check` 通過代替 final gate。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
