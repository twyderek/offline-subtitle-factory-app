# 獨立審查報告：Whisper fallback 策略函式化與 deterministic 回歸

- 審查對象 commit／版本：目前工作樹／`0.48.0`；本輪新增 `lib/whisper-fallback-policy.mjs`、`scripts/test-whisper-fallback-policy.mjs`，並將策略呼叫接入 `server.mjs` 與 `package.json` 的 test wiring。
- 對應 08-CHANGE-LOG 條目：2026-07-31 — Whisper fallback 策略函式化與 deterministic 回歸
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-31T10:35+08:00；由主要代理指派的獨立審查上下文，自行執行 development preflight、核對純函式／server diff、矩陣測試、npm test wiring與語法／差異檢查。
- 審查需求：`BUG-WHISPER-METAL-139`。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/08-CHANGE-LOG.md:55-59` 要求將 fallback 條件抽成純函式，覆蓋平台／架構／`forceCpu`／退出碼矩陣，且既有轉錄流程不得改變。
  - `lib/whisper-fallback-policy.mjs:1` 確實將條件集中；`server.mjs:1524-1529` 也以該純函式決定清理與 CPU retry，原本的 `--no-gpu`、輸出解析、取消與清理程式碼未被另行重構。
  - 但原 server 條件是 `code !== 0`，新純函式改成 `Number(exitCode) !== 0`；這對 `null` 與字串退出值改變語意，故尚不能宣稱「既有實際轉錄流程不得改變」已完全滿足。

## 2. 邏輯正確性

- 判定：不通過
- 證據：
  - `server.mjs:1523-1524` 先處理 `code !== 0`，原本 Metal `code === null`（例如 child 被 signal 終止但 controller 尚未 abort）會進入 fallback判斷；新 `shouldRetryWhisperOnCpu` 對 `null` 執行 `Number(null) !== 0`，結果為 false，因而跳過 fallback。
  - 2026-07-31T10:53+08:00 實際執行：`shouldRetryWhisperOnCpu({platform:'darwin', arch:'arm64', forceCpu:false, exitCode:null})` 輸出 `false`，同一值的舊條件 `null !== 0` 輸出 `true`。這是可觀察的 refactor semantic regression，不是僅型別或測試敘述差異。
  - 同一命令顯示字串 `"0"` 新函式輸出 false、舊 `"0" !== 0` 為 true；雖 Node `ChildProcess` 正常 exit code通常是 number或 null，純函式既宣稱退出碼矩陣，至少必須明定並測試這些輸入，或刻意保留原始 strict comparison。
  - `undefined` 仍因 `Number(undefined)` 為 NaN而輸出 true，進一步顯示 coercion 使不同非數字輸入的行為不一致。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - `scripts/test-whisper-fallback-policy.mjs:4-8` 覆蓋 darwin arm64 的 139／0、`forceCpu`、Windows x64與 darwin x64，但沒有 `null`、`undefined`、字串或 signal termination 的退出矩陣。
  - `server.mjs:1518-1522` 的 controller abort仍先於 fallback判斷，這條既有取消優先順序未被此抽取改變；然而外部 signal 導致 `exit` code 為 null且 `signal.aborted` 為 false 的邊界未覆蓋。
  - `forceCpu` true、非 macOS arm64與正常 0／139路徑的純函式結果與既有意圖一致；問題集中在「保持原始 `!== 0` 語意」未被明確保留。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - 純函式無副作用、依賴明確參數，server 整合只替換原 fallback predicate；`package.json:17` 將 deterministic test置於 `npm test` 最前，接線位置正確。
  - 函式以 `Number(exitCode)` 隱式接受／轉換輸入，卻沒有輸入正規化契約或測試說明；對 process exit code這種既可能為 number也可能為 null的 Node API，這會讓讀者誤以為所有值都可安全數值化。
  - `node --check server.mjs`、`node --check lib/whisper-fallback-policy.mjs`、`node --check scripts/test-whisper-fallback-policy.mjs`（2026-07-31T10:53+08:00）均通過；`git diff --check`亦通過。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - `node scripts/test-whisper-fallback-policy.mjs`（2026-07-31T10:52+08:00）通過，輸出「平台、架構、forceCpu 與退出碼矩陣」；但該矩陣只包含五個 numeric／platform cases，沒有能捕捉上述 null regression的 case。
  - `npm test` 確實先執行新 policy test、其後 preflight／治理／品質／AI／UI 測試均先通過；最後 `scripts/test-core.mjs` 在 sandbox 嘗試 listen `0.0.0.0:22345` 時因 `listen EPERM` 失敗，故本次完整 npm test 結果不能標記為通過，失敗原因是環境權限而非 policy assertion。
  - `package.json:17` 的 wiring已驗證新測試不會被遺漏；但要完成 deterministic 回歸，仍須補 `null`／signal termination（及若保留 strict comparison則字串）案例，並在可允許 socket 的受控環境重跑完整 npm test。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 純函式 numeric／platform 矩陣可執行，server syntax可解析，新增 test script確實被 npm test呼叫。
  - 本輪沒有改變實際 Whisper child參數、輸出解析或取消處理；但由於 predicate 對 null code與原 server不等價，不能把 numeric矩陣通過解讀為實際 Metal／signal child行為完全未變。
  - 既有完整回歸本次被 sandbox socket EPERM中止；因此沒有新的產品 job／real child evidence可覆蓋外部 signal與CPU retry race。

## 綜合判定

- 結論：不通過
- 阻擋問題：
  1. 修正 `shouldRetryWhisperOnCpu` 使其保留原 server `exitCode !== 0` 的語意，或明確建立 process exit code正規化契約；至少補 `null`（以及若支援的話 string／undefined）測試，確認 signal termination不會意外改變 fallback行為。
  2. 在可允許本機 socket 的環境重跑 `npm test`／`npm run check`；本次 sandbox `listen EPERM` 只能作為環境阻擋，不能作完整回歸通過證據。
- 剩餘風險：即使修正 predicate，實際 child process failure、取消中的 retry、輸出清理與跨平台行為仍需沿用條目已列的後續實測；本純函式測試不取代 real CLI／job-level integration。
- 給主要開發代理的具體修正要求：先修正 null／非 numeric exit code語意並擴充矩陣，再重跑 targeted test、`npm test`、`npm run check`、`npm run docs:check:final`與 `git diff --check`；完成後建立 round2複審。

**本輪「2026-07-31 — Whisper fallback 策略函式化與 deterministic 回歸」round1 獨立審查結論為不通過：純函式與 server 整合已建立且 numeric 平台／架構／forceCpu／退出碼測試可執行，`package.json` 也將新測試接入 `npm test`；但原 server 的 `code !== 0` 被改寫為 `Number(exitCode) !== 0`，實際驗證顯示 `exitCode:null` 由原本會進入 Metal fallback變為不 retry，`"0"` 亦改變判定，且現有矩陣未覆蓋這些邊界，因此尚不能證明純函式抽取保持既有語意；完整 `npm test`另受 sandbox `listen EPERM` 中止，修正 predicate與補矩陣、再完成受控回歸前不得結案。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前已確認目標路徑不存在，未覆寫既有審查報告。
- 若上述聲明不實，本報告無效。
