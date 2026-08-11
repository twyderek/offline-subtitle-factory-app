# 獨立審查報告：0.48.x 穩定化：macOS 封裝與本機 LLM 驗證

- 審查對象 commit／版本：目前工作樹／`0.48.0`；本輪差異為 Ollama live evidence JSON、`docs/project-management/00-CURRENT-STATUS.md`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md` 與 `docs/project-management/08-CHANGE-LOG.md` 最新條目，無產品程式變更。
- 對應 08-CHANGE-LOG 條目：2026-07-30 — 0.48.x 穩定化：macOS 封裝與本機 LLM 驗證
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-07-30T15:01+08:00；由主要代理啟動的獨立審查上下文，自行執行 development preflight、讀取固定核心與任務路由、檢查指定差異與 raw evidence，未沿用主要代理對證據品質的評價性結論。
- 審查需求：`FR-003`、`FR-021`、`NFR-003`、`NFR-005`、`NFR-008`。

## 1. 需求完整性

- 判定：部分通過
- 證據：
  - `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:19,37,45,47,50` 分別要求 macOS 封裝 runtime、Ollama／LM Studio 真實端到端與斷網、支援平台、可靠狀態及資產一致性；`docs/project-management/08-CHANGE-LOG.md:52` 已連結全部五項需求。
  - `docs/project-management/08-CHANGE-LOG.md:55-61` 正確把本輪目標限制為目前 macOS 主機可取得的 runtime、目錄版 renderer、SHA 與本機服務證據，並明載不把結果升格成跨平台或完整 `FR-021`。
  - `FR-003` 本輪只證明 bundled runtime 檔案可驗證，沒有執行實際 Whisper 轉錄／Metal 路徑；`FR-021` 只取得 Ollama transport／raw response，LM Studio、產品 UI 人工接受、取消／續跑與真正斷網未完成。這些缺口有在工作條目及測試稽核揭露，故屬部分需求證據而非完成驗收。
  - `docs/project-management/08-CHANGE-LOG.md:59` 原計畫包含可用本機 provider 的優化、取消與續跑，但 Ollama 可用時只執行 direct live probe，沒有產品 UI／API 任務的取消或續跑證據；結案時不得把本輪描述為完成整個該項驗證計畫。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - `docs/project-management/evidence/2026-07-28-ollama-llama3.2-1b-live.json:1-114` 原始內容誠實保存 endpoint、Ollama 0.32.5、兩個模型、capability 及 single-cue HTTP 200 回應，沒有竄改 raw response。
  - 2026-07-30T15:05:52+08:00 本審查代理以 `jq` 讀取 artifact，確認 capability content 為合法 `{"traditionalChinese":"繁體中文"}`；同時以 `JSON.parse` 驗證 single-cue content，實際結果為 `FAIL`，因內容以前置自然語言／Markdown code fence 開始、JSON 字串未閉合，且後段另建議把毫秒時間格式改成無毫秒。這不是只需人工斟酌的語意品質差異，而是 strict JSON／cue 時間保護不合格。
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:136` 與 `docs/project-management/08-CHANGE-LOG.md:61` 寫「probe 通過／取得 single-cue 回應」且僅以「模型輸出仍需人工確認」概括；雖沒有宣稱完整 `FR-021`，但沒有明確記錄 single-cue strict contract 失敗，容易把 transport exit 0 誤讀成字幕優化流程成功。應改寫為「probe transport／capability 成功，single-cue strict validation 失敗，產品應拒絕」。
  - artifact 路徑仍名為 `2026-07-28-...json`，但目前 `capturedAt` 是 `2026-07-30T07:01:49.827Z`，且 git diff 顯示原 7 月 28 日 response 已被覆寫。日期戳 evidence 路徑與 capture 日期矛盾，破壞同一路徑的歷史可追溯性；應恢復 7 月 28 日 artifact，另存新的 7 月 30 日 artifact 並更新引用。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - 2026-07-30T15:05:52+08:00 執行 `curl -sS --max-time 2 http://127.0.0.1:1234/v1/models`，exit 7、`Couldn't connect to server`；這獨立支持 LM Studio connection refused，文件也未把它寫成 provider 缺陷或通過。
  - Ollama evidence 同時呈現成功邊界（loopback endpoint、version、models、capability HTTP 200）與失敗邊界（single-cue malformed／Markdown／時間格式改寫），但治理摘要目前只清楚標示前者，需補後者。
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:135-138` 明確說 Windows renderer／安裝未執行，LM Studio／斷網未完成；沒有用 macOS 目前主機替代 Windows 或完整跨平台。
  - Electron verifier 只針對 `../dist/mac-arm64/離線字幕工廠.app/Contents/MacOS/離線字幕工廠` 目錄版 executable；DMG／ZIP 本輪只核對 SHA。這不能替代 DMG／ZIP 掛載、複製／安裝後、乾淨使用者帳號、未公證 Gatekeeper 或 macOS 12 最低版驗收，文件應繼續維持此限制。

## 4. 程式碼品質

- 判定：部分通過（本輪為 evidence／文件品質）
- 證據：
  - `jq . docs/project-management/evidence/2026-07-28-ollama-llama3.2-1b-live.json` 通過，artifact 是有效 JSON，request／response、token usage、version 與模型清單結構完整。
  - raw evidence 沒有 secrets，endpoint 為精確 loopback；未發現產品程式、封裝資產或 Windows 資產遭修改。
  - 日期戳檔名被新 capture 覆寫使舊證據只能由 git 歷史找回，不符合 `NFR-006` 所需的清楚版本化證據品質。
  - `docs/project-management/00-CURRENT-STATUS.md:49-57` 的正式發布狀態編號目前為 1–7、9、8；雖不改變實質結論，仍應在結案前修正順序。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - 2026-07-30T15:05:29+08:00 本審查代理執行 `npm run runtime:verify:mac`，exit 0，輸出 `[runtime] OK: darwin-arm64`，並列出 FFmpeg、Whisper.cpp 與預設模型實際路徑。
  - 同一時間以 `shasum -a 256` 重算現有 DMG／ZIP，結果分別為 `334e50b59a70c97314629faad88de1dd22f6680018265c54da5f1703becfbeee` 與 `53ca4e3886155e221048d36f103b0933a8d49647f5e509098fcac29f2c652f80`，與 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:135` 一致。
  - 本審查未重跑 Electron GUI verifier；只讀檢查 `scripts/verify-electron-renderer.mjs:15-18,276-320` 確認它會實際啟動指定 executable 並驗證 renderer／API／provider 資產。2026-07-30T15:06+08:00 `file` 確認該 executable 為 Mach-O arm64，`codesign -dv` 確認 app 為 ad-hoc、無 Team ID。主要代理的 verifier exit 0 可作目錄版 evidence，但不是安裝版證據。
  - `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:138` 仍寫 sandbox `listen EPERM` 後「需以受控權限重跑才可結案」，而 `docs/project-management/08-CHANGE-LOG.md:61` 已寫受控權限 `npm run check` 通過；兩份本輪證據互相矛盾，須同步為同一最終狀態並補可回溯的受控重跑時間／結果。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - 2026-07-30T15:01+08:00 親自執行 `npm run project:preflight -- --type=development`，exit 0；版本 `0.48.0`、分支 `codex/0.48-local-llm`，並列出 development 路由。
  - macOS runtime verify、DMG／ZIP SHA、Ollama raw artifact 結構／內容及 LM Studio connection refused 均由本審查獨立重放或讀取核對；`git diff --check` 於 2026-07-30T15:05+08:00 exit 0。
  - Ollama probe 的可支持結論是「本機服務可連、列出兩模型、capability response 合法，但 single-cue response 違反 strict contract」；不能支持「真實字幕優化成功」、人工接受、取消／續跑或真正斷網。
  - 封裝可支持結論是「runtime package、arm64 目錄版 executable／renderer evidence 與既有 DMG／ZIP 位元 SHA 一致」；不能支持 DMG／ZIP 安裝後、macOS 12 最低版、乾淨帳號、正式簽章／公證或跨平台相容。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：
  1. 將 2026-07-30 capture 另存新的日期一致 evidence 檔，恢復／保留原 2026-07-28 artifact，不得以覆寫日期戳歷史證據的方式結案；同步更新三份治理文件引用。
  2. 明確記錄新版 Ollama single-cue 是 strict contract 失敗：content 不是合法 JSON、含 Markdown／自然語言並建議改寫時間格式；把「probe 通過」限定為 loopback transport／models／capability 成功，不得只列為一般人工品質風險或暗示真實字幕優化成功。
  3. 同步 `docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:138` 與 `docs/project-management/08-CHANGE-LOG.md:61` 的受控 `npm run check` 最終狀態，記錄失敗環境與成功重跑的命令／時間／結果；目前一份說仍需重跑、一份說已通過。
- 剩餘風險：
  - Electron 證據只涵蓋目前 macOS 主機的 ad-hoc arm64 目錄版；DMG／ZIP 本輪只有 SHA 一致，安裝後、乾淨帳號、macOS 12 最低版與公證仍未驗收。
  - FR-003 的真實 Whisper／Metal 轉錄未在本輪執行；既有 Metal exit 139 風險未解除。
  - LM Studio、Ollama 產品 UI 人工接受／取消／checkpoint 續跑與真正斷網仍未完成，完整 `FR-021` 不可關閉。
  - `00-CURRENT-STATUS.md` 的 9／8 編號順序應修正，避免狀態清單品質退步。
- 給主要開發代理的具體修正要求（若有）：依三項阻擋修正 evidence 與文件，修正狀態清單編號；修正會影響證據引用與結論，應建立 round2 新報告複審，不得修改本報告。

**本輪「2026-07-30 — 0.48.x 穩定化：macOS 封裝與本機 LLM 驗證」round1 獨立審查結論為有條件通過：macOS arm64 runtime verify、目錄版 Electron executable／renderer 證據、DMG／ZIP SHA、Ollama 0.32.5／兩模型 capability raw response及 LM Studio connection-refused 均有可回溯依據，文件也沒有把目前主機或 Ollama probe 升格為完整跨平台／斷網 `FR-021` 驗收；但新版 single-cue 回應實際不是合法 JSON、含 Markdown／自然語言且建議改寫時間格式，必須明列為 strict contract 失敗而非僅稱人工品質風險，2026-07-30 capture 亦不得覆寫在 2026-07-28 日期戳 evidence 路徑，且測試稽核仍稱受控 `npm run check` 待重跑、與工作條目所載已通過矛盾；修正 evidence 版本化、結果標示及受控權限紀錄後，方可結案。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 本報告建立前已確認目標路徑不存在，未覆寫既有審查報告。
- 若上述聲明不實，本報告無效。
