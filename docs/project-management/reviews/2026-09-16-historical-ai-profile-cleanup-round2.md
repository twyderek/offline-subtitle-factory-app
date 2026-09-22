# BUG-031 歷史 AI profile 秘密欄位啟動清理獨立複審（round2）
## 1. 需求完整性
- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:7-15` 將成功條件限定為啟動載入既有 `settings.json` 時，清除 AI 根層 legacy secret-shaped 欄位、profile 非 allowlist 欄位與未知 provider，同時保留合法 profile、非敏感未知 AI 根層欄位及既有獨立 secrets，且不自動搬移歷史明文；`docs/project-management/03-FUNCTIONAL-DESIGN.md:79-81`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:90-98` 與 `docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:9-19` 對範圍、失敗行為及剩餘風險記載一致。`server.mjs:117-128` 的固定根層秘密鍵名清單配合 `server.mjs:446-464` 的大小寫／分隔符正規化，只刪除文件限定的 secret-shaped 鍵；`server.mjs:115-116,487-509` 以合法 provider 與六個合法 profile 欄位雙重 allowlist 重建 profiles，會同時移除未知 provider、秘密與其他未知 profile 欄位並保留合法欄位。`server.mjs:450-474` 對 AI 根層採複製後局部刪除，故非敏感未知根層欄位保留。實作未擴張至備份、其他使用者檔案、OS 安全儲存或外部服務，符合明列的不在範圍。
## 2. 邏輯正確性
- 判定：通過
- 證據：`server.mjs:426-440` 先讀取持久化資料、建立 `normalizeSettings()` runtime 值，再由 `sanitizePersistedAiSettings()` 產生窄範圍磁碟遷移；需要變更時才寫回，且寫回失敗仍回傳已正規化的 runtime。`server.mjs:450-474` 會刪除根層固定秘密鍵，並以 `normalizedAi.profiles` 完整取代歷史 profiles；`server.mjs:487-509` 對每個 profile 先驗證 provider，再只收取 `baseUrl`、`model`、`deployment`、`apiVersion`、`batchSize`、`timeoutSeconds`，因此不會讓 profile 秘密或未知 provider 留在磁碟／runtime。`server.mjs:512-538` 將相同 profile 正規化納入所有設定載入與保存路徑，`server.mjs:4036-4043` 的 profile API 只讀取正規化後的 `appSettings`。`server.mjs:541-568` 顯示 `ai-secrets.json` 有獨立讀寫函式，而啟動遷移沒有呼叫這些函式，因此既有 secrets 不會被改寫，也不會接收被刪除的歷史明文。
## 3. 邊界情況
- 判定：通過
- 證據：對合法 JSON 但根層為 `null`、primitive 或 array 的情況，`server.mjs:429-432,450-453` 會以空來源產生正規化設定並安排寫回；根物件合法但 `ai` 缺失、為 primitive 或 array 時，`server.mjs:454-458` 保留其他根層欄位並補入正規化 AI 設定。一般 AI 物件中的非敏感未知欄位由 `server.mjs:459-474` 保留；profile 的非法型別、未知 provider 與未知／秘密欄位由 `server.mjs:487-509` 排除。`server.mjs:282-294` 在同目錄建立只含遷移後值的暫存檔、沿用既有 mode、rename 原子置換，並以 `finally` 清理尚存暫存檔；`server.mjs:433-440` 捕捉寫入／rename／清理失敗，只輸出不含欄位值的權限警告並維持正規化 runtime。既有 `ai-secrets.json` 不在遷移寫入路徑內。上述行為與 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:94-98`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:16-19` 的記錄相符。
## 4. 程式碼品質
- 判定：通過
- 證據：profile 字串／數字欄位與 legacy secret-shaped 名稱集中於 `server.mjs:115-128`，而且位於 `server.mjs:153` 的 `loadSettings()` 模組初始化之前，沒有重現 BUG-029 round1 曾發現的初始化順序問題。`writeJsonAtomic()`、`sanitizePersistedAiSettings()`、`normalizeAiProfiles()` 各自分離原子寫入、窄範圍持久化清理與 profile 契約，命名及責任清楚；啟動遷移重用 `normalizeAiSettings()` 的 profile allowlist，避免磁碟與 runtime 規則分叉。錯誤訊息只指出設定檔權限，不插入原始錯誤或設定值；同目錄暫存與既有 mode 保留亦符合最小風險遷移設計。
## 5. 測試覆蓋
- 判定：通過
- 證據：`scripts/test-core.mjs:13-52` 在啟動前直接建立隔離 `settings.json`／`ai-secrets.json` fixture，包含多種大小寫／分隔形式的根層秘密鍵、Anthropic profile 秘密、未知 profile 欄位、未知 provider、六種合法 profile 欄位、非敏感未知 AI 根層欄位及既有獨立 secret。`scripts/test-core.mjs:143-160` 將該實際 config 目錄傳給新啟動的 `server.mjs`，`scripts/test-core.mjs:269-284` 等 server 可用後直接以 `fs.readFileSync` 讀回遷移後 `settings.json` 與 `ai-secrets.json`，斷言兩組 legacy marker 消失、非敏感根層欄位保留、未知 provider 消失、合法 model 保留、既有 secret 保留、legacy 明文未搬入 secrets，且無 `settings.json.*.tmp`；這些不是只看 API 的間接斷言。`scripts/test-core.mjs:286-291` 再從 profile API 斷言 Base URL、model、batch、timeout 保留且未知欄位不進 runtime；`scripts/test-core.mjs:380-403` 另覆蓋新保存路徑不接受巢狀 profile 秘密。此組測試足以鎖定 BUG-031 的主要磁碟與 runtime 契約。
## 6. 實際運行結果
- 判定：通過
- 證據：主要代理提供的原始運行結果為修正前核心磁碟清理 assertion exit 1；修正後 `node --check server.mjs`、`node --check scripts/test-core.mjs`、`node scripts/test-core.mjs`、`node scripts/test-ai-providers.mjs`、`git diff --check` 與完整 `npm run check` 均 exit 0。相同紅轉綠與完整回歸結果已記錄於 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:93-96` 及 `docs/project-management/08-CHANGE-LOG.md:15-17`，且本輪已獨立核對測試確實啟動實際 server、指向隔離設定目錄並直接讀取遷移後磁碟檔案。本審查依明確指示未重跑測試；此限制列為剩餘風險，不單獨構成部分通過。
## 綜合判定
- 結論：通過
- 可逐字引用的完整結論句：**BUG-031 round2 獨立複審判定通過：AI 根層固定 secret-shaped 鍵清理符合文件限定範圍，provider profile 以 provider／欄位雙重 allowlist 移除未知 provider 與秘密並保留合法欄位，非法根物件、寫入失敗、原子暫存清理、非敏感未知 AI 根層欄位及既有 ai-secrets 的處理均合理；核心 fixture 確實在實際 server 啟動後直接讀回 settings.json 與 ai-secrets.json 並搭配 profile API 斷言，round1 因未完成讀取而保留的條件已解除，未發現阻擋問題。**
- 阻擋問題（若有）：無。
- 剩餘風險：本審查依指示未獨立重跑任何測試，只核對主要代理提供並已寫入治理文件的紅轉綠與完整回歸結果；fixture 未動態模擬一般設定檔不可寫、rename／暫存檔刪除失敗、Windows 真實檔案鎖定或合法 JSON 非物件根層，這些路徑僅由本輪靜態核對確認。啟動 fixture 雖放入 `deployment`／`apiVersion`，但沒有逐欄 assertion；目前由 allowlist 實作保留。根層清理刻意採固定鍵名而非任意秘密偵測，因此未列入清單的歷史別名不在本輪保證範圍；損壞而無法解析的 JSON 仍走既有預設設定 fallback，不會自動覆寫修復。未呼叫外部 AI、未做真實 API Key、跨平台或發布驗收。
- 給主要開發代理的具體修正要求（若有）：無；可將本 round2 報告作為解除 round1 有條件通過限制的獨立證據。若後續要提高失敗邊界覆蓋，可另案補寫入失敗／非法根物件測試及 `deployment`／`apiVersion` 逐欄斷言，不影響本輪通過結論。
## 審查代理聲明
本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
