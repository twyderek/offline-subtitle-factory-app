# 獨立複審報告：FR-020／NFR-006 長媒體完整性 fault injection（round6）

- 審查對象 commit／版本：`299ff5d`；版本 `0.51.0`；分支 `codex/0.51-anthropic-claude`；目前工作樹含既有未提交變更，本輪未修改既有檔案。
- 對應 08-CHANGE-LOG 條目：`2026-09-23 — FR-020／NFR-006 長音訊輸入媒體完整性 fault injection`（`docs/project-management/08-CHANGE-LOG.md:3-29`）。
- 審查輪次：round6。
- 審查代理啟動時間、上下文來源：2026-09-29 10:24 Asia/Taipei；本報告由獨立審查上下文重新執行 preflight、讀取治理文件、round5 報告、目前 source／tests／evidence，並重新執行本輪指定驗證；未沿用主要開發代理對結果的評價。
- 審查環境：macOS Darwin arm64、Node.js `v22.22.3`；preflight 回報版本 `0.51.0`、分支 `codex/0.51-anthropic-claude`，並指出工作樹已有變更（`npm run project:preflight -- --type=development`，2026-09-29 10:24:53 Asia/Taipei，exit 0）。

## 1. 需求完整性

- 判定：部分通過。
- 證據：`FR-020` 與 `NFR-006` 分別記載於 `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:36,61`；本輪對應的 acceptance probe 界線與四種檔案完整性故障、privacy、cleanup fail-closed 要求記載於 `docs/project-management/03-FUNCTIONAL-DESIGN.md:121-123` 及 `docs/project-management/08-CHANGE-LOG.md:11,20`。round5 報告要求的三項收斂條件位於 `docs/project-management/reviews/2026-09-29-fr-020-long-media-integrity-fault-injection-round5.md:52-55`。
- 本輪已實際重播 round5 要求的 repo 外七案 acceptance，並逐項核對四項修正：harness 不再使用 cleanup marker（`scripts/accept-whisper-long-media-integrity-fault-injection.mjs:62-84,202-250` 無 marker 讀寫流程）；probe root 由 cleanup case 內的固定 exact path 預選（`:202-210`）；preload 以 `path.resolve(String(target)) === cleanupTargetRoot` 精確攔截 `rmSync` 並注入 `EACCES`（`:67-82`）；父 harness 在 `finally` 清理該 exact path，之後以原生 `lstatSync` 斷言 `ENOENT`（`:247-251`）。
- 「部分」只表示本輪審查範圍是長媒體 integrity probe 的 round5 條件，不把 FR-020 的字幕品質、人工校閱或完整產品工作流宣稱完成。

## 2. 邏輯正確性

- 判定：通過。
- 證據：目前 harness 在每次 cleanup case 內先建立 isolated `caseRoot`，以 `cleanupTempRoot = path.join(cleanupCaseRoot, 'osf-whisper-long-media-probe-fixture')` 預選尚不存在的 root，並以 `path.dirname(cleanupTempRoot) === cleanupCaseRoot` 驗證直接子目錄（`scripts/accept-whisper-long-media-integrity-fault-injection.mjs:202-210,226-230`）。preload 只對解析後完全相同的 root 丟出 `error.code = 'EACCES'`，未呼叫原始 `rmSync`（`:62-84`）。
- probe production path 使用 `removeTempRootAndVerify`：先嘗試移除，再以 `lstatSync` 僅在 `ENOENT` 時回傳成功（`scripts/whisper-long-media-evidence.mjs:23-35`）；清理失敗會將 evidence 設為 `fail`、`TEMP_ROOT_CLEANUP_FAILED`，且 probe 以非零 exit 結束（同檔 `:37-45`；`scripts/verify-whisper-long-media.mjs:247-255`）。這與 round5 所要求的 fail-closed 行為一致。
- 這是 Node preload 在 `rmSync` 呼叫邊界注入的 `EACCES`，不是作業系統原生權限拒絕；因此邏輯控制流已驗證，但不能推廣為所有 filesystem／OS permission fault 的證明。

## 3. 邊界情況

- 判定：通過。
- 證據：本輪 acceptance harness 執行時間為 2026-09-29 10:23:23–10:23:25 Asia/Taipei，指令 `npm run acceptance:whisper:integrity-fault-injection -- /private/tmp/fr020-round6.MBdol9/evidence-v11-round6.json`，exit 0，輸出 `result: "pass"`、`cases: 7`。唯一本輪新增的 repo 外 evidence path 在執行前不存在，完整路徑為 `/private/tmp/fr020-round6.MBdol9/evidence-v11-round6.json`。
- 七案結果可由該 evidence `:13-92` 回溯：input media hash mismatch／missing 各為 exit 1、`INPUT_MEDIA_MODIFIED` 且 probe temp root 已清理；source SRT hash mismatch／missing 各為 exit 1、`SOURCE_SRT_MODIFIED` 且已清理；custom source SRT path 以 `PROBE_FAILED`、`canaryStored=false` 通過；custom basename 固定為 `source.srt` 且 canary 未保存；cleanup fault 為 exit 1、`TEMP_ROOT_CLEANUP_FAILED`、`tempRootRemoved=false`、父清理前 `lstat` 確認存在，finally 後 `tempRootRemovedByHarness=true`。
- 持久 v11 artifact 也記錄同一 cleanup 邊界：`docs/project-management/evidence/2026-09-29-whisper-long-media-integrity-fault-injection-v11.json:80-90`。round5 所引用的 repo 外 replay／v11 條件因此由本輪實跑再次得到支持，而非只採信歷史文字。

## 4. 程式碼品質

- 判定：通過。
- 證據：probe 不再把 raw stderr 或 child startup error 寫入 evidence；固定化摘要與 cleanup fail-closed helper 位於 `scripts/whisper-long-media-evidence.mjs:3-45`，probe 僅保存 stderr 統計與 `contentStored=false`（`scripts/verify-whisper-long-media.mjs:107-113,180-200`）。來源 SRT evidence 使用固定 `source.srt` 標籤，不保存實際 basename 或 custom path（`scripts/verify-whisper-long-media.mjs:122,146-157`；harness `:140-200`）。
- cleanup fault evidence 的 `PRIVATE_CLEANUP_DIAGNOSTIC_CANARY` 不會落盤；本輪外部 evidence `:83-89` 與 source assertions `scripts/accept-whisper-long-media-integrity-fault-injection.mjs:231-245` 均確認固定錯誤碼、布林結果與清理狀態。
- 相關六個 MJS 檔案的 `node --check` 於 2026-09-29 10:25:05–10:25:06 Asia/Taipei 執行，exit 0（檢查數量 6）。

## 5. 測試覆蓋

- 判定：部分通過。
- 證據：本輪實際執行結果如下。
  - `node scripts/test-whisper-long-media-integrity.mjs`：2026-09-29 10:23:11 Asia/Taipei，exit 0；unchanged、同大小 hash mismatch、missing-after，涵蓋 input-video 與 source-subtitles fixture，共六個 helper 情境，輸出 `result: "pass"`。
  - `node scripts/test-whisper-long-media-evidence.mjs`：2026-09-29 10:23:11 Asia/Taipei，exit 0；輸出 `Whisper evidence 隱私測試通過`，transcript-like canary 不在序列化摘要中，cleanup remains／unverifiable 皆 fail closed。
  - `npm run acceptance:whisper:integrity-fault-injection -- /private/tmp/fr020-round6.MBdol9/evidence-v11-round6.json`：2026-09-29 10:23:23–10:23:25 Asia/Taipei，exit 0，七案通過。
  - `npm run docs:check`：2026-09-29 10:23:36 Asia/Taipei，exit 0；`專案治理文件檢查通過：19 個文件，版本 0.51.0`。
  - `git diff --check`：2026-09-29 10:23:36 Asia/Taipei，exit 0。
- 依本輪明確範圍未執行完整 `npm run check`；也未執行 `npm run docs:check:final`。因此本節不能宣稱完整自動回歸或治理結案門檻已由本輪確認。round5／工作紀錄對 `docs:check:final` 的待辦仍見 `docs/project-management/08-CHANGE-LOG.md:27` 及 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:28`。

## 6. 實際運行結果

- 判定：通過。
- 證據：本輪在 macOS arm64／Node `v22.22.3` 的現有工作樹實際重跑 acceptance harness，使用 synthetic WAV、isolated fake Whisper runtime、bundled FFmpeg／FFprobe／Tiny model symlink；probe 子程序對 cleanup root 實際返回 exit 1，evidence 寫入 `status=fail`／`tempRootRemoved=false`／`TEMP_ROOT_CLEANUP_FAILED`，父 harness 再移除 exact path 並以 `lstatSync` 取得 `ENOENT`。輸出 evidence 的 `environment` 與七案可回溯於 `/private/tmp/fr020-round6.MBdol9/evidence-v11-round6.json:1-92`。
- v11 持久 artifact 的 `originalMediaRead=false`、`originalSrtRead=false`、`transcriptStored=false`（`docs/project-management/evidence/2026-09-29-whisper-long-media-integrity-fault-injection-v11.json:3-12`）與本輪外部重播一致；本輪未讀寫需求方原始長片／SRT。
- preflight、兩個 focused tests、acceptance harness、docs check、diff check 均有實際 exit／時間戳；工作樹最後仍只呈現 pre-existing tracked／untracked changes，未因本輪驗證新增 repo 檔案。

## 綜合判定

- 結論：**CONDITIONAL PASS**。
- 可逐字引用的完整結論句：**FR-020／NFR-006 長媒體 integrity probe 的 round5 四項條件已由目前 source、v11 artifact 與本輪 repo 外七案 acceptance replay 實際驗證，cleanup marker 已移除、probe root 限於 isolated case 的預選 exact path、preload 以 resolve exact equality 注入 rmSync EACCES、父 finally 清理 exact path 並以 ENOENT 確認；本輪結論為 CONDITIONAL PASS，因完整治理結案仍須由主要代理在同步工作紀錄後執行 npm run docs:check:final。**
- 阻擋問題（若有）：本輪未發現 round5 所列的 marker／路徑授權／父清理阻擋；`npm run docs:check:final` 未執行，故尚不能宣稱本工作項目已完成治理結案。
- Conditions：主要代理完成 round6 工作紀錄連結與逐字引用、確認「待確認／待執行」狀態已收斂後，執行 `npm run docs:check:final`；若 final validator 發現報告格式或工作紀錄問題，須修正來源文件並依影響重審。本報告本身不可被覆寫。
- 未驗範圍／剩餘風險：未重跑 5,416 秒原始影片；未驗證字幕語意正確率、confidence／no-speech 品質、來源 SRT 是否為 ground truth、人工影音校閱、真實 bundled Metal crash→CPU fallback、Windows 實機、乾淨安裝、Release 或原生 OS 權限拒絕。這些限制與 probe 設計界線一致（`docs/project-management/03-FUNCTIONAL-DESIGN.md:121-123`；`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:27-29`），不得由本輪 synthetic replay 擴大宣稱。
- 給主要開發代理的具體修正要求（若有）：完成上述 `docs:check:final` closeout；本輪沒有要求修改產品、測試或 harness source。

## 審查代理聲明

- 本審查代理確認使用獨立上下文，除建立本報告外，僅執行讀取、`npm run project:preflight -- --type=development`、`node --check`、本報告列出的兩個 focused tests、一次 repo 外 acceptance harness、`npm run docs:check` 與 `git diff --check`；未修改任何其他專案檔案或既有審查報告。
- 本輪唯一新增的 repo 檔案是 `docs/project-management/reviews/2026-09-29-fr-020-long-media-integrity-fault-injection-round6.md`；acceptance evidence 留在 repo 外 `/private/tmp/fr020-round6.MBdol9/evidence-v11-round6.json`。
- 若上述聲明不實，本報告無效。
