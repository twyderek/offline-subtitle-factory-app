# 獨立複審報告：Breeze ASR 25 實驗性本機轉錄整合（FR-024）

- 審查對象 commit／版本：目前分支 `codex/release-v0.48.1`；基準 HEAD `170e08e17d38b4c7a9c94d3e1ba031a382539d9a`；尚未提交的 FR-024 round2 條件修正工作樹
- 對應 08-CHANGE-LOG 條目：`2026-08-10 — Breeze ASR 25 實驗性本機轉錄整合（FR-024）`
- 前輪報告：`docs/project-management/reviews/2026-08-10-breeze-asr-25-integration-round2.md`
- 審查輪次：round3
- 審查代理啟動時間、上下文來源：2026-08-10 10:49（Asia/Taipei）；由主要代理重新指派同一獨立審查角色，只針對 round2 唯一條件與受影響六面向查證
- 審查環境：macOS、Node.js `v22.22.3`；沒有真實 Windows、3,087,008,569-byte checkpoint、官方 Python／PyTorch／patched Whisper runtime

## Round2 唯一條件複審

- 條件：stubborn child 的 grace→強制終止必須有測試；Windows process tree 不得因 parent 提前 close 而跳過 `taskkill /T /F`。
- 判定：已解除（程式邏輯與可在本機執行的 deterministic 範圍）。
- 程式證據：
  - Windows abort 不再先對父 child 送 `SIGTERM`；`server.mjs:1672-1686` 立即 spawn `taskkill /pid <pid> /T /F`，並以 `windowsTreeKillPending` 保存 tree-kill 尚未完成狀態。
  - `server.mjs:1707-1713` 在 cancelled child close 時設定 `cancelledChildClosed`；若 Windows tree-kill 尚在進行就不 settle。反向地，tree-kill 完成時只有在 child 已 close 才清理並 reject cancelled（`server.mjs:1676-1683`）。因此 parent close 不會再清除或跳過 tree-kill，job slot 要等兩者完成才釋放。
  - POSIX 維持先 `SIGTERM`，3 秒後 `SIGKILL`（`server.mjs:1687-1690`）；取消只在 child `close` 後清理音訊與非 draft SRT 並完成。
- 測試證據：
  - `scripts/fixtures/mock-breeze-runtime.mjs:10-32` 新增 stubborn 模式，收到 SIGTERM 時刻意不退出。
  - `scripts/test-core.mjs:516-535` 在非 Windows 平台建立 stubborn Breeze server job，確認取消到 terminal 至少等待 2.8 秒、最後進入 cancelled，且 `whisper-input.wav`／部分 SRT 不殘留。
  - graceful child-close 與成功 SRT 案例仍由 `scripts/test-core.mjs:481-514` 覆蓋。
- 平台證據邊界：本輪未在 Windows 真實執行 `taskkill` 或建立 descendant process tree；round3 只證明 Windows source control flow 不再有 round2 指出的 timer 被 parent close 清除問題。Windows 實機行為保留為剩餘風險，不宣稱已實測。

## 1. 需求完整性

- 判定：通過（本輪 experimental/deterministic 範圍）
- 證據：round1／round2 的固定官方 metadata、非同步模型驗證、runtime capability timeout、UI 缺件提示、Whisper.cpp 預設、server 成功 SRT 與 graceful 取消均已保留；本輪再補齊 stubborn child 強制取消與 Windows tree-kill 等待邏輯。真實模型/runtime 不在安裝包且未驗證的限制仍在文件中明示。

## 2. 邏輯正確性

- 判定：通過
- 證據：Windows 取消現在明確等待 `taskkill /T /F` 與 child close 兩個完成條件；POSIX 等待 child close 並在 grace 後升級 SIGKILL；上層 `runJob` promise settled 後才釋放 concurrency slot。round2 指出的提前取消／descendant 風險已在 source control flow 上修正。

## 3. 邊界情況

- 判定：通過（deterministic 範圍）
- 證據：已涵蓋正常 SRT、graceful SIGTERM、忽略 SIGTERM、grace timeout、SIGKILL、cancelling 中間狀態、child close 後 terminal 狀態，以及音訊／部分 SRT 清理。未覆蓋的 Windows 實機、真實 3 GB I/O、OOM、長音訊與磁碟不足列為剩餘風險而非偽稱完成。

## 4. 程式碼品質

- 判定：通過
- 證據：Windows 與 POSIX 取消分支清楚分流；`windowsTreeKillPending`／`cancelledChildClosed` 使兩個非同步完成條件可追蹤，測試專用 runner 仍受 `NODE_ENV=test` 與顯式環境變數限制，production 模型／runtime 契約未被放寬。

## 5. 測試覆蓋

- 判定：通過（本機可執行範圍）
- 證據：
  - 2026-08-10 10:50:12：`node --check server.mjs scripts/fixtures/mock-breeze-runtime.mjs scripts/test-core.mjs` 對應逐一 exit 0。
  - 2026-08-10 10:50:12：`node scripts/test-breeze-asr.mjs` exit 0；`git diff --check` exit 0。
  - 2026-08-10 約 10:50：受控權限 `npm run check` exit 0，耗時約 7.6 秒；完整 suite 實際包含新增的約 3 秒 stubborn-child 強制取消案例與既有 Whisper／manual／核心回歸。
  - Windows `taskkill` 實機案例尚未執行，明列於剩餘風險。

## 6. 實際運行結果

- 判定：部分通過
- 證據：本機 server／FFmpeg／mock Breeze runtime 已實際完成成功 SRT、graceful 取消、stubborn child grace→SIGKILL 與清理；這是 orchestration 證據。沒有真實 checkpoint、官方 patched runtime、台灣華語／中英混用音訊或 Windows 安裝版執行，因此模型品質、效能、記憶體與真實跨平台取消不得宣稱已通過。

## 綜合判定

- 結論：通過（限 FR-024 本輪 experimental/deterministic 整合範圍）
- 阻擋問題（若有）：無；round2 唯一條件已解除。
- 剩餘風險：真實 Windows `taskkill /T /F`／descendant process-tree、3,087,008,569-byte checkpoint 下載與 I/O、官方 Python／PyTorch／patched Whisper、台灣華語／中英混用品質、字幕對齊、CPU／CUDA 效能／記憶體、長音訊、磁碟空間與兩平台安裝後流程均未驗證；Breeze 必須保持實驗性且不隨安裝包提供 runtime，mock 證據不得取代上述外部驗收。
- 後續建議：若要把 Breeze 標示為正式可用或納入發布品質承諾，須另做 Windows／macOS 真實 runtime、checkpoint、音訊、資源與取消驗收；這些不影響本輪 deterministic 整合通過，但必須持續揭露。
- 可逐字引用完整結論句：**FR-024 Breeze ASR 25 實驗性本機轉錄整合 round3 獨立複審判定為通過，且僅限本輪 experimental/deterministic 整合範圍：Windows 取消已改為立即執行並等待 `taskkill /T /F` 與 child close，POSIX stubborn child 已由完整回歸證實會等待 3 秒 grace、升級 SIGKILL、完成 cancelled 並清理音訊與部分 SRT，因此 round2 唯一條件已解除；但真實 Windows process tree、3,087,008,569-byte checkpoint、官方 patched runtime、台灣華語／中英混用品質、效能、記憶體、長音訊與安裝後流程仍未驗證，mock 證據不得被引用為這些外部驗收已通過。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
