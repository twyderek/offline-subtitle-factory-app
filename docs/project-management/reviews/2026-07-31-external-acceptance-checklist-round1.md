# 獨立審查報告：0.48.x 外部驗收 Checklist

- 審查對象 commit／版本：目前工作樹／`0.48.0`；本輪新增 `docs/project-management/EXTERNAL-ACCEPTANCE-CHECKLIST-0.48.md` 與其 08 changelog 條目。
- 對應 08-CHANGE-LOG 條目：2026-07-31 — 建立 0.48.x 外部驗收 checklist
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-31T11:10+08:00；由主要代理指派的獨立審查上下文，自行執行 requirements preflight、檢查 checklist／changelog／現況文件與文件／差異驗證。
- 審查需求：`NFR-003`、`FR-021`、`BUG-WHISPER-METAL-139`。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `EXTERNAL-ACCEPTANCE-CHECKLIST-0.48.md:9-35` 覆蓋 Windows 10／11 x64、macOS 12+ Apple Silicon、安裝／解除安裝、真實轉錄、輸出、簽章／公證命令與 Whisper Metal／CPU fallback；` :37-56` 覆蓋 Ollama、Groq／Gemini 的格式、品質、錯誤、金鑰與取消／重試驗收。
  - `:3-7` 明確要求每項填日期、OS／硬體、版本、執行者、結果、證據路徑，且未取得實機證據不得標示通過；` :58-61` 明確把 LM Studio與 Electron 43／builder 26 列為本輪未納入。
  - 但實際各驗收項目仍只是 `- [ ]` bullets（例如 `:13-19`、`:27-33`、`:41-45`、`:53-56`），沒有對應欄位或可填寫模板；使用規則要求的日期／執行者／結果／證據路徑無法逐項落位，交接執行性不完整。

## 2. 邏輯正確性

- 判定：通過
- 證據：
  - Windows 清單把 SHA、安裝、Portable、音訊／SRT／VTT、內建工具、離線 UI、SmartScreen分開，並在 `:21` 明定未簽 Authenticode不得宣稱簽章通過；沒有把資產完整性誤當成安裝或簽章成功。
  - macOS 清單把 DMG／ZIP、Metal fallback、設定重啟、取消／長音訊、hdiutil／codesign／spctl分開，` :35` 要求如實記錄 ad-hoc／未公證狀態，與既有 Metal crash／未簽章風險一致。
  - Ollama `:39-47` 分開 strict contract、完整字幕與人工品質，並要求保存 prompt／參數／raw response；沒有把連線或 JSON 格式通過擴大為模型品質通過。

## 3. 邊界情況

- 判定：通過
- 證據：
  - `:6-7` 與 `:58-61` 對 LM Studio 暫緩界線清楚：不得以未執行填通過，並將其列入「尚未納入本輪」，沒有與 Ollama checklist混淆。
  - `:31-33` 要求 Metal失敗時確認 CPU fallback／日誌，並同時檢查取消、長音訊與輸出清理（`:32`）；` :21,35` 保留未簽章／未公證狀態，符合停止條件。
  - Groq／Gemini `:51-56` 納入錯誤金鑰、逾時、429、網路中斷、取消／重試及 secret隔離；雖然本輪不執行真實 smoke，清單未把未取得 key誤寫為完成。

## 4. 程式碼／文件品質

- 判定：部分通過
- 證據：
  - 文件結構簡短、按平台／provider分段，工具與證據要求可讀；`08-CHANGE-LOG.md:55-59` 也正確描述本輪只建立交接清單，不執行實機、LM Studio、Electron major或發布。
  - `EXTERNAL-ACCEPTANCE-CHECKLIST-0.48.md:5` 宣稱「每一項填寫」六種欄位，但沒有表格欄位、模板行或證據命名規則；執行者仍需自行猜測如何回填，容易產生不可比較的實機紀錄。
  - 最新 changelog `08-CHANGE-LOG.md:49,60-61` 仍標示進行中且「實際修改／開發驗證：待執行」，與檔案已存在及本次 `npm run docs:check`／`git diff --check` 實際完成不一致；應在 review 後同步，而非保留待執行。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - `npm run docs:check`（2026-07-31T11:12+08:00）輸出「專案治理文件檢查通過：19 個文件，版本 0.48.0」；`git diff --check`（同時段）通過，證明文件格式與治理引用可解析。
  - 本輪沒有執行 Windows／macOS 實機、Ollama、Groq／Gemini或任何安裝／啟動／斷網驗收；這與 changelog `:56` 的不在範圍及 checklist `:6` 的「未取得證據不得通過」一致。
  - checklist 本身沒有 schema／validator 測試來檢查每一項是否填齊日期、OS、執行者、結果與證據路徑；在補欄位前，文件只能作人工清單，不能保證交付資料完整。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 本輪實際讀取 61 行 checklist，確認所有項目仍為 unchecked，沒有任何平台、版本、執行者、結果或證據路徑被誤標為通過；LM Studio與 Electron major均明確列於未納入。
  - 現況文件 `docs/project-management/00-CURRENT-STATUS.md:59` 與 `06-TEST-AND-PROCESS-AUDIT.md:125,131,137` 同樣保留 LM Studio／跨平台／斷網未驗收，checklist未與既有證據矛盾。
  - 由於沒有實機執行，本報告只能確認清單的範圍與宣稱界線，不能替代任何外部驗收結果。

## 綜合判定

- 結論：有條件通過
- 阻擋問題：
  1. 將每個 checkbox改成可回填的驗收記錄欄位（至少日期、OS／硬體、版本、執行者、結果、證據路徑；可用表格或每項固定 metadata區塊），否則 `:5` 的使用規則無法落實。
  2. 更新 `08-CHANGE-LOG.md:49,60-63`，把 checklist 已建立與 docs／diff 驗證結果寫入「實際修改／開發驗證」，並保留「實機驗收待後續人員執行」；不得完成條目仍留「待執行」。
- 剩餘風險：Windows／macOS 實機、簽章／公證、Metal fallback、Ollama品質、Groq／Gemini真實 smoke與真正斷網均未執行；LM Studio依需求暫緩，Electron／builder major另開相容性工作。這些未驗收狀態已由清單與現況文件正確揭露。
- 給主要開發代理的具體修正要求：補欄位模板並同步 changelog後建立 round2；實機人員回填時仍須逐項附 evidence path，且不得把格式／連線成功寫成品質、簽章或完整端到端通過。

**本輪「2026-07-31 — 建立 0.48.x 外部驗收 checklist」round1 獨立審查結論為有條件通過：清單已涵蓋 Windows／macOS／Ollama／Groq／Gemini 所需工具、操作、證據與停止條件，並明確把 LM Studio 依需求暫緩、把 Electron／builder major列為另開相容性工作；未執行的實機與外部服務均未被標示為通過，與 `00-CURRENT-STATUS.md`／`06-TEST-AND-PROCESS-AUDIT.md` 的未驗收界線一致；但使用規則要求的日期、OS／硬體、版本、執行者、結果、證據路徑尚未在各 checkbox提供可回填欄位，且 08 條目仍把已建立文件與 docs／diff驗證寫成「待執行」，補齊交接欄位並同步工作紀錄後方可結案。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前已確認目標路徑不存在，未覆寫既有審查報告。
- 若上述聲明不實，本報告無效。
