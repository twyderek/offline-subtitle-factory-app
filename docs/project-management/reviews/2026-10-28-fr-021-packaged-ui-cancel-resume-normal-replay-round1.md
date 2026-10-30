# FR-021 current-source packaged Ollama UI cancel/resume normal-path replay：獨立六面向審查

- 審查日期：2026-10-28（Asia/Taipei）
- 審查角色：本輪獨立六面向審查代理
- 對應 08-CHANGE-LOG 條目：2026-10-28 — current-source packaged Ollama UI cancel/resume normal-path replay（`FR-021-REPLAY-20261028-UI-CANCEL-RESUME-NORMAL`）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-28；獨立審查上下文，僅依本輪指定 evidence、source、candidate identity 與治理文件唯讀核對
- 審查範圍：current-source macOS arm64 directory candidate、預裝 `llama3.2:1b`、normal loopback packaged Electron UI 的 cancel／checkpoint／reload／resume replay
- 唯讀限制：未啟動 Electron、Ollama、live replay 或任何 network request；未下載模型、未修改 OS network；僅讀取 evidence、source、candidate identity、治理文件並執行唯讀 shell checks
- 指定報告路徑在審查開始前確認不存在；本報告為本輪唯一建立的檔案

## 1. 需求完整性

- 判定：部分通過
- 證據：

- `2026-10-28-ollama-llama3.2-1b-packaged-ui-cancel-resume-normal-replay1.json` 與 `...replay2.json` 均記錄 `loopbackOnlyConfiguration=true`、`apiKeySupplied=false`、`isolatedAcceptanceDaemon=true`，但 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`；治理文件另記 `outerSandboxProfileApplied=false`。因此這兩次不是 Seatbelt offline 或全機斷網 run。
- current-source candidate 的 executable SHA-256 為 `b3605c589459068f894a70896b8ed843be3832a839fcdd83aa898e9b16210de4`，Electron Framework SHA-256 為 `416b6c8cf74c59188266d3ff7a3fc77b9f68bb52f7328d98b382d132580c8cee`。`00-CURRENT-STATUS.md`、`06-TEST-AND-PROCESS-AUDIT.md` 與 `08-CHANGE-LOG.md` 均記錄 replay2 沿用同一 candidate identity。
- `2026-10-28-ollama-llama3.2-1b-packaged-ui-normal-replay1-artifact-parity.json` status 為 `pass`；其中 `lib/ai/providers.mjs` source／candidate hash 均為 `f402f835ba55c7b776a9280d9b5637fb26fa1af59543901b6b7aef11d74967ed`，`byteForByteEqual=true`，並記錄 `isLoopbackAiUrl`、`buildOllamaCueResponseFormat`、`num_ctx=4096`、`strictJson=true` markers。該 audit 也如實記錄 `scripts/test-ai-providers.mjs` 是 worktree-only、未進入 packaged runtime。
- `scripts/verify-electron-ollama-ui.mjs` 的唯讀 diff 只新增 `cancelResumeSourceCues`，並將 cancel-resume synthetic fixture 從較不穩定的英文／中英混合短句改為短中文句；正常 2-cue fixture、產品 runtime、provider source 與 candidate bundle 沒有在該 diff 中改動。`node --check scripts/verify-electron-ollama-ui.mjs` 與該檔案的 `git diff --check` 通過。

candidate executable／Framework identity 與 packaged provider parity 有可追溯證據，fixture 變更也被限制在 verifier worktree source；但兩份 cancel/resume evidence 的 runner／artifact identity 欄位本身為 null，candidate 關聯主要依治理文件與既有 parity audit 對照，且 scope 明確不是 offline boundary。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：

- replay1 status `fail`，`error.stage=checkpoint_cancel`、`category=UI_ACCEPTANCE_ASSERTION_FAILED`；開始任務已捕捉 6 cues request，但 `optimize.status` 為空、`suggestionCount=0`，`cancelResume.cancelled=false`、`observedStatus=checkpoint-window-missed`、`observedTaskStatus=failed`、`completedBatches=0`／`totalBatches=0`。這表示第一次未取得可取消 checkpoint，不能當作功能 pass。
- replay1 的 failure 原件沒有被覆寫；`07-DEBUG-AND-FIX-HISTORY.md` 與 `08-CHANGE-LOG.md` 將其描述為原 fixture 使 1B 模型先發生翻譯契約 failure，而非把它改寫成 checkpoint 成功。
- replay2 status `pass`；`ui.optimize` 為 `completed`，`suggestionCount=6`、`completedBatches=6`／`totalBatches=6`、`processedCues=6`／`totalCues=6`。`cancelResume` 記錄 `cancelled=true`、`observedStatus=cancelled`、`retryable=true`、checkpoint `completedBatches=1`／`totalBatches=6`、`checkpointPersisted=true`、`checkpointSuggestionCount=1`。
- replay2 在 reload 後記錄 `resumeVisibleAfterReload=true`、`sessionUnchangedAfterReload=true`、`checkpointUnchangedAfterReload=true`、`resumeRequestAccepted=true`、`resumedFromBatch=1`、`resumeStartsAtCheckpoint=true`、`sessionUnchangedAfterResume=true`，隨後同一 session 完成剩餘流程。`accept.accepted=6`、`history.undo=true`、`history.redo=true`，save 也為 true。

replay2 對本輪指定的 6 cues／6 batches、checkpoint cancel、同 session reload／resume、完成與結果操作均有直接欄位證據；但只有一份成功 replay，且成功依賴 worktree-only 的短句 fixture 與預裝 1B 模型，不能泛化為所有字幕內容、模型或版本。replay1 failure 必須與 replay2 pass 並列保留。

## 3. 邊界情況

- 判定：部分通過
- 證據：

- replay2 settings 記錄 provider `ollama`、model `llama3.2:1b`、language `en`、`baseUrl` 為 loopback、`keyEmpty=true`、`keyHasSavedValue=false`、`privacyIsLocal=true`、`consentDisabled=true`；未提供 API Key。
- replay2 的 optimize／request flow 維持 6 cues 與 6 batches；accept count 為 6，save 的 `cueCount=6`、`subtitleFileName=reviewed.srt`、`timecodesUnchanged=true`、`hasEnglishTranslation=true`，並有 `reviewSha256=936fea99c8f3059fe45e6fbf9a345f260ced2a313b6f73a0c8c7a16aab481ca3`。
- cancel 後 `sourceSubtitleUnchangedAfterCancel=true`、`originalSrtUnchangedAfterCancel=true`；replay2 save 亦確認 timecode 未變。replay1 因取消 checkpoint 未發生而記錄 `sourceSubtitleUnchangedAfterCancel=false`，不能把該欄位解讀成已完成取消後資料保護驗證；其 `originalSrtUnchangedAfterCancel=true` 仍應如實保留。
- parity audit 靜態核對 packaged provider 與目前 source 的 routing／schema／context／strict markers 一致；但這是 provider artifact parity，不是模型輸出品質或所有 Ollama 版本的 schema 相容性證明。

成功 replay 對本輪資料不變、cue 數量、英文翻譯、接受結果與保存契約提供足夠的 normal-path evidence；但沒有把短句 synthetic fixture、單一預裝 1B 或一次 `reviewSha256` 擴大成字幕品質、長 prompt、不同模型／版本或完整資料來源 provenance 保證。

## 4. 程式碼品質

- 判定：部分通過
- 證據：

- replay1 雖然在 `checkpoint_cancel` failure，cleanup 仍完整通過：`electronExited=true`、`electronProcessGroupAbsentAfterCleanup=true`、`electronProcessGroupClosedConfirmed=true`、`appServerPortClosed=true`、`userDataRemoved=true`；owned daemon 的 `stopped`、`processGroupAbsent`、`portClosed`、`temporaryRootRemoved` 均為 true，且 `forcedCleanup=false`。
- replay2 `error=null`，cleanup 同樣記錄 Electron process group、app server port、temporary userData，以及 owned daemon process group／port／temporary root 全部清理成功，未使用 forced cleanup。
- replay1 的 evidence `error.code` 為空字串，雖然 stage／category 與治理文件能辨識 failure，落盤 evidence 本身沒有更細的模型契約錯誤碼。這限制了對首次模型輸出 failure 的 machine-readable root-cause 精度，但不構成將 failure 隱藏或誤報為 pass。
- 兩次 daemon 都記錄 `preinstalledModelFound=true`、`modelDownloadAttempted=false`、`existingServiceModified=false`、`contextLength=4096`；沒有證據顯示本輪下載模型或修改既有桌面服務。

cleanup 子範圍通過；錯誤保留與 fail-closed 文件化通過。整體仍為有條件通過，因 replay1 的 failure code 粗粒度，且 cleanup／錯誤證據只支持這兩次 normal run，不替代更廣泛的 process-tree 或 OS egress 驗證。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：

- 唯讀 syntax／diff checks：`node --check scripts/verify-electron-ollama-ui.mjs` exit 0，`git diff --check -- scripts/verify-electron-ollama-ui.mjs` exit 0。完整 deterministic／治理檢查的結果由主要代理治理紀錄聲稱已執行；本審查代理遵守不得寫入或啟動服務的限制，未重跑 live 或會改變外部狀態的流程。
- `00-CURRENT-STATUS.md` 頂端同時記錄 replay1 failure、fixture-only 修正、replay2 pass、candidate hashes 與 normal loopback scope。
- `06-TEST-AND-PROCESS-AUDIT.md` 對 replay1 的 `checkpoint_cancel`／cleanup、replay2 的 1/6 checkpoint／reload／resume／6 cue 完成，以及 `systemNetworkDisabled=false`／`sandboxedTargetProcessTree=false` 均有對照記錄。
- `07-DEBUG-AND-FIX-HISTORY.md` 將 failure 原因限縮為 1B translation fixture 穩定性，明確記錄沒有修改產品 runtime、沒有以 retry 堆疊成功樣本，並保留 offline／Windows／FR-021 residual。
- `08-CHANGE-LOG.md` 的最新條目仍為「進行中（replay2 已通過，待獨立審查與 final gate）」；截至本審查，尚未引用本報告的完整結論句，也尚未完成 `npm run docs:check:final` closeout。這是治理上的明確待辦，不應被 replay2 pass 掩蓋。
- 前一輪 normal-path review 只作 background：它支持相同 candidate／normal loopback 的一般 settings／optimize／accept／undo／redo／save，但沒有覆蓋本輪 cancel／resume，也不覆蓋本輪結論。

六面向的 evidence／治理文件目前互相一致，replay1 failure 與 replay2 pass 沒有被混寫；但 08 尚未完成本輪 review citation 與 final gate，因此本輪不能宣稱治理無條件結案。

## 6. 實際運行結果

- 判定：部分通過
- 證據：

- 本輪沒有發布、tag、Release、PR 或 GitHub asset；candidate 是 repo 外的本機 macOS arm64 directory candidate，只供本機驗證。
- replay1／replay2 都是 `systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false` 的 normal loopback run。`loopbackOnlyConfiguration=true` 只表示本次設定使用 loopback endpoint，不等於整棵 packaged process tree 或整台機器被禁止外連。
- 本輪沒有證明 Seatbelt packaged UI 能在 Chromium nested sandbox 條件下啟動，也沒有證明真正全機斷網／per-app egress control；既有 `CHROMIUM_CHILD_SANDBOX_INIT_FAILED` blocker 不因 replay2 pass 消失。
- 未驗收 Windows、其他模型／版本、長 prompt／長字幕、不同硬體、正式安裝／公證／Gatekeeper，也未把 normal UI flow 擴大為 FR-021 全部需求完成。

不提供發布授權；僅對本輪 normal loopback packaged UI cancel／resume 子範圍有條件通過。所有上述未驗範圍保留為 residual risk。

## 綜合判定

- 結論：有條件通過。
- 阻擋問題（若有）：本輪沒有阻擋問題；residual／條件是 08 尚須完成本報告 citation 與 `npm run docs:check:final`，且本輪 evidence 僅限 normal loopback packaged UI cancel/resume，不解除 Seatbelt／全機 egress、Windows、其他模型／版本或 FR-021 完整驗收缺口。
- 本輪條件是否已被需求方接受：是；需求方以「繼續」要求完成 review citation 與 final gate，接受本條目僅限 normal loopback packaged UI cancel/resume，不宣稱 offline／全機斷網／Windows／FR-021 完整驗收。
- 可逐字引用的完整結論句：**本輪 current-source packaged Ollama UI cancel/resume normal-path replay 的獨立六面向審查結論為有條件通過：candidate identity、replay2 的 normal loopback cancel／checkpoint／reload／resume／complete／save、資料契約與 cleanup 均有 evidence 支持，replay1 的 immutable failure 已如實保留且未被 pass 覆寫；但本結論只適用 normal loopback packaged UI cancel/resume，replay1 failure 仍是本輪真實歷史結果，`systemNetworkDisabled=false`、`sandboxedTargetProcessTree=false`、`outerSandboxProfileApplied=false`，且不得宣稱 offline／全機斷網／Windows／FR-021 完整驗收，並須完成 08 review citation 與 `npm run docs:check:final` 才能完成治理 closeout。**
- Closeout condition：主要代理須將本報告路徑與上述完整結論句逐字同步至最新 `08-CHANGE-LOG.md`，補齊本輪審查／發布不適用欄位，並成功執行 `npm run docs:check:final`。此條件只關閉本輪 normal replay 的治理文件，不擴大任何 offline、全機斷網、Windows 或 FR-021 完整驗收語意。

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

唯一寫入路徑：`/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/reviews/2026-10-28-fr-021-packaged-ui-cancel-resume-normal-replay-round1.md`

若上述聲明不實，本報告無效。
