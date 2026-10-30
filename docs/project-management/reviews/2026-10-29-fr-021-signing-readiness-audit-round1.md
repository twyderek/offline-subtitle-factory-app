# 獨立審查報告：FR-021 formal signing／hardened-runtime readiness audit

- 審查對象 commit／版本：工作樹 `c06d15e95a2f0a0981518c5873003a460e57a5ee`、branch `codex/0.51-anthropic-claude`、package version `0.52.0`；工作樹有既有未提交變更，以下結論只針對目前可讀內容，不把 HEAD 視為完整提交快照。
- 對應 08-CHANGE-LOG 條目：`2026-10-29 — formal signing／hardened-runtime readiness audit（FR-021-DEBUG-20261029-SIGNING-READINESS-AUDIT）`
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-29（Asia/Taipei；本報告 session 的 UTC timestamp check 為 `2026-10-29T01:50:05Z`）；本報告依目前工作樹、`project:preflight -- --type=full` 列出的治理文件、source、evidence 與實際命令輸出獨立完成，未沿用主要代理的結論作為判定前提。
- 審查限制：僅讀取、語法／測試／文件驗證與 read-only identity query；未執行 signing、notarization、keychain 修改、packaged app、UI、Electron／Ollama／model 或任何 network acceptance。

## 審查基線與證據集合

- 需求與範圍：`docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37,48-60,64-69`、`docs/project-management/08-CHANGE-LOG.md:3-23`。
- 被審查程式：`scripts/audit-macos-signing-readiness.mjs:16-212`。
- authoritative readiness evidence：`docs/project-management/evidence/2026-10-29-fr-021-signing-readiness-audit2.json:1-121`；audit1 是較早 baseline，未被覆寫。
- 參照的 ad-hoc runtime audit2：`docs/project-management/evidence/2026-10-29-fr-021-adhoc-runtime-signing-canary-audit2.json:1-220`；本報告只核對 readiness audit 對它的摘要，不把 ad-hoc runtime metadata 當正式 signed／hardened proof。

## 1. 需求完整性

- 判定：部分通過
- 證據：FR-021 的原始驗收仍要求本機 LLM、斷網產品流程與端到端結果（`02-REQUIREMENTS-ANALYSIS.md:37`），且文件明確指出 loopback／受控子程序證據不能宣稱 FR-021 整體完成（`:48-60`）。本輪 08 條目正確把 readiness work 限定為工具鏈、identity、source config、去敏環境摘要與外部 blocker（`08-CHANGE-LOG.md:7-23`），audit2 也明確寫成 `blocked-external-signing-identity`、`formalSigningReady=false`，並在 interpretation 中排除 FR-021 pass／renderer diagnosis（`audit2.json:97-121`）。因此沒有發現把「工具可用」或「0 valid identities」擴大成 FR-021 通過的需求語意錯誤。
- Finding F-05 [P1]：工作紀錄的正式 readiness 條目仍為「進行中」，缺少「獨立審查是否執行／發布授權」欄位；實際執行 `npm run docs:check:final`（2026-10-29，本審查 session）得到 exit 1，明確報告最新條目缺少兩欄、尚未標示「完成」且獨立審查欄位不是是／否。新的 readiness slug 也只在 `08-CHANGE-LOG.md` 與兩份 readiness evidence 中出現；00／03／05／06／07 沒有本次 readiness audit 的對應條目，只有既有 packaging／identity blocker 敘述。這使「已完成一個可重算、可結案的 readiness audit」的文件需求尚未滿足。
- 主要代理需修正：保留本報告原件，補齊受影響的 00／03／05／06／07／08 實況與 review link；不要將補文件誤寫成 FR-021 完成，並保留 `external Developer ID identity blocker` 與「FR-021 未完成」。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：程式使用固定絕對命令、非 shell spawn 與只傳遞受限 `PATH` 的環境（`audit-macos-signing-readiness.mjs:16-29`）；evidence path 只允許 evidence 目錄下的 `.json`、拒絕已存在檔案（`:112-116`），並以 `wx`／`0600` 建立（`:211`）。對目前實際 run，audit2 的 `identity.commandSucceeded=true`、`validIdentityCount=0`、`formalIdentityAvailable=false`、`toolchainReady=true`、`sourceConfigReady=false`、`formalSigningReady=false` 與 status 互相一致（`audit2.json:46-63,97-121`）。
- Finding F-01 [P1]：identity command 的可用性沒有被 formal identity gate 消費。`summarizeIdentityAvailability()` 只把 regex 得到的 count／class 寫入結果（`audit-macos-signing-readiness.mjs:69-88`）；`formalIdentityAvailable` 只由 `Developer ID Application:` 字串決定（`:74-84`），而 decision 只檢查它、`toolchainReady` 與 `sourceConfigReady`（`:159-170`），沒有要求 `identity.commandSucceeded===true` 或 `validIdentityCount>0`。因此若 `security find-identity` 失敗、輸出格式變更或 stderr 只有診斷文字，script 可能把「identity probe 不可判定」錯報成 `blocked-external-signing-identity`，而非另一個 fail-closed 的 audit-command-unavailable 結果；目前 audit2 的 commandSucceeded 為 true，所以此 finding 是可達邊界缺口，不是對本次 0 identity 值的反證。
- Finding F-02 [P1]：privacy／scope 是輸出中的固定宣告，而不是寫檔前的 fail-closed invariant。`scope` 的所有禁止操作與 privacy flags 在 evidence 建構時直接設為 `false`（`:192-207`）；`summarizeExistingEvidence()` 對既有 evidence 的 `status` 與 `requiredCodeSignFlag` 直接複製，沒有型別／allowlist／forbidden-token validation（`:91-109`）。若既有檔案被污染，新的 readiness evidence 可能把 path、raw-like status 或非預期字串帶入，而仍宣告 `rawCommandOutputPersisted=false`／`secretsPersisted=false`；目前 audit2 的值確實安全，但 source contract 沒有 fail-closed 保證。
- Finding F-03 [P2]：程式收集了 `productbuild`、`spctl`、`xcodeSelect` 與 `xcrunNotarytool` availability（`:124-132`），但 `toolchainReady` 只使用 `codesign.executablePresent`、`xcrun.executablePresent`、`xcrunCodesign.commandSucceeded`（`:159-161`）。若任一其他被記錄的工具缺失，仍可能得到 `ready-for-isolated-signed-canary`。本次 audit2 的各項工具目前均 present／success，故沒有造成目前 status 的錯判；但「已記錄的 readiness contract」與實際 decision gate 不一致，應明確區分 required／optional 或全部 fail-closed。
- 目前未列為 finding 的正面結果：source config 目前明確為 `identityConfiguration=unset`、`hardenedRuntimeConfigured=false`、`gatekeeperAssessConfigured=false`（`audit2.json:58-63`；`package.json:168-189`），所以 script 沒有把 CLI tool availability 誤當成已形成 signed／hardened package；此點與文件的 external identity blocker 說法一致。

## 3. 邊界情況

- 判定：部分通過
- 證據：非 macOS／非 arm64 會在產生 evidence 前拒絕（`audit-macos-signing-readiness.mjs:112`）；缺少 output path、目錄外 path、非 JSON 與已存在 output 會拒絕（`:113-116`）；固定命令只在記憶體持有 stdout／stderr，不把 raw output 放進 evidence（`:16-29,175-210`）。本次 read-only `/usr/bin/security find-identity -v -p codesigning` query 得到 `live_read_only_valid_identity_count=0`，沒有修改 keychain。
- Finding F-01 的 boundary 影響：目前沒有 deterministic test 覆蓋 `security` exit non-zero、malformed count、身份 probe timeout 或「字串含 Developer ID 但 count 為零」；因此上述錯判路徑不是實際 run 已發生，而是由 source 可直接推得的未測 fail-open／misclassification。
- Finding F-02 的 boundary 影響：目前沒有 test 覆蓋既有 evidence 的 `status`／`requiredCodeSignFlag` 非 primitive、含 `/Users/`／`/private/var/`／`/tmp/`、secret-shaped token 或超長值；也沒有在 `fs.writeFileSync` 前進行整份 evidence leakage scan。現存 audit2 的 read-only invariant check（本 session）得到所有 checks `true`，但這只能證明目前檔案安全，不補足未測輸入。
- 觀察 F-04 [P2]：`sanitizedVersion()` 只讀 stdout（`:60-66`），而 audit2 的 `environment.codesign`／`productbuild` 都是 `null`（`audit2.json:5-12`），同時對應 executablePresent 為 true（`:14-20`）。這是可接受的「未保存版本」fail-safe，但沒有保存 `commandSucceeded`，使版本結果不可完整解釋；應將 stderr-only version output 轉為安全摘要或明確保存 success／unavailable 狀態。

## 4. 程式碼品質

- 判定：部分通過
- 證據：程式短小、命令集合固定、沒有 shell interpolation、環境變數只以 boolean presence 保存（`audit-macos-signing-readiness.mjs:16-29,147-154`），並以 exclusive create／0600 限制 evidence 建立（`:211`）。這些設計降低 command injection、credential value 與覆寫既有 evidence 的風險。
- Finding F-02 與 F-04 同時是品質問題：summary projector 沒有純化的 schema／型別驗證函式，privacy 狀態依賴 hard-coded false，且版本欄位的 stdout-only 行為讓工具結果可觀測性不足（`:60-109,192-208`）。這使 code review 很難單靠 helper 函式證明「所有輸出永遠去敏」。
- Finding F-04 [P2]：readiness evidence 沒有保存執行此 audit 的 source script SHA-256、git HEAD、命令／schema revision，也沒有對兩份 existing evidence 保存 immutable hash；因此 audit2 的 JSON 內部一致且檔案 mode `0600`，但不能由 evidence 自身證明它是由目前這一版 script 實際產生。這不表示 audit2 已被偽造，而是其 provenance 強度不足以支撐「可重算」的最強語意。
- 主要代理需修正：加入可去敏且不保存 path／secret 的 source／runner provenance，或把 evidence 明確標成未綁定 source revision；將 summarizer 與 privacy gate 拆成可測的純函式，避免之後以文件敘述取代 executable invariant。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：本審查實際執行並觀察到：
  - `node --check scripts/audit-macos-signing-readiness.mjs`：exit 0。
  - `node scripts/test-project-docs-validator.mjs`：通過。
  - `npm run check`：exit 0；包含 `docs:check`、全套 deterministic regression、Ollama offline contract fixture、AI/provider、core 與 YouTube tests。
  - `npm run docs:check:final`：exit 1，原因為最新 08 條目尚未結案及缺少獨立審查／發布授權欄位。
  - audit2 read-only JSON invariant／source-config parity／privacy path guard、SHA-256 與 mode check：全部 `true`；audit2 SHA-256 為 `762dfe859895a06e3e5f3ac012967c4ba17fedcd597807acd0ca116bd84d001e`，mode 為 `-rw-------`。
  - `git diff --check`：exit 0。
- Finding F-05 [P1]：`package.json:31-32` 的 `npm test`／`npm run check` 命令清單沒有 `node --check scripts/audit-macos-signing-readiness.mjs`、readiness focused test 或 privacy／identity failure injection；`rg` 也沒有找到針對該 script 的 deterministic test。故本次 full green 只證明現有產品與治理回歸，不能證明 readiness script 的關鍵 gate。
- 未覆蓋案例：identity command failure／timeout、malformed security output、missing optional／required tool、污染 existing evidence、stderr-only version、output write failure，以及 audit2 source provenance mismatch。這些正好覆蓋 F-01～F-04 的主要風險，應在主要代理修正後新增 focused regression，再重跑 full check。

## 6. 實際運行結果

- 判定：部分通過
- 證據：audit2 的實際保存結果為 `status=blocked-external-signing-identity`；`identity.commandSucceeded=true`、`validIdentityCount=0`、`developerIdApplicationPresent=false`、`formalIdentityAvailable=false`（`audit2.json:46-56`）；toolchain decision 為 true，但 source config 與 formal signing decision 為 false（`:97-102`）。`scope` 內 candidate、keychain、signing、notarization、network、packaged app、UI、Ollama、model、raw output、absolute path、identity metadata、secret flags 全為 false（`:104-118`）。
- audit2 與目前 source config 的 read-only parity check 通過：`package.json:168-189` 的 null identity／false hardened runtime／false gatekeeper 與 evidence `:58-63` 相符。audit2 與 audit1 分開存在；兩者 SHA-256 分別為 `5a247459009b8b5d077db22964341b35296894186ea7e001053c98f37c92609c` 與 `762dfe859895a06e3e5f3ac012967c4ba17fedcd597807acd0ca116bd84d001e`，沒有發現本輪覆寫原件。
- 實際運行結論的限制：本審查沒有重跑 readiness script 以免新增 evidence（使用者限定唯一可寫檔案為本報告），也沒有執行 signing／notarization／packaged app／UI／Ollama／model。故 audit2 的「執行結果」可由內部欄位、檔案 mode／hash 與一次 read-only identity query 支持，但缺少 source revision／command transcript binding；應視為 bounded recorded result，不是正式 signed package 或 FR-021 runtime acceptance。
- 沒有發現把 `toolchainReady=true`、`validIdentityCount=0` 或 ad-hoc runtime audit2 擴大成 FR-021 通過的實際文件宣稱；相反地，readiness audit interpretation 明確排除 FR-021／renderer diagnosis（`audit2.json:120`）。但現有 `external Developer ID identity blocker` 仍只證明本機無 valid identity；source config 也未開啟 hardened runtime，兩者都不能被忽略。

## 綜合判定

- 結論：有條件通過（conditional pass）
- 可逐字引用的完整結論句：**本輪 FR-021 formal signing／hardened-runtime readiness audit round1 有條件通過：audit2 的讀取結果、零 valid identity、source config mismatch、工具鏈摘要與目前 privacy scope 在工作樹下的 JSON 不變式一致，且未發現已把工具可用性或 0 identity 誤寫成 FR-021 通過；但 readiness script 尚未對 identity command failure、匯入 evidence 欄位及工具缺失採完整 fail-closed gate，缺少專用 focused regression 與 source provenance，`docs:check:final` 仍因最新工作條目未完成而失敗，因此正式 signed／hardened canary 仍被 external Developer ID identity blocker 阻擋，FR-021 未完成。**
- 阻擋問題（若有）：
  - F-01：identity probe failure／malformed output 沒有獨立 fail-closed decision。
  - F-02：privacy scope 與 imported evidence projection 沒有 executable fail-closed guard。
  - F-05：readiness script 缺少 focused regression，且治理 final gate 仍失敗。
  - 外部 blocker：read-only query 顯示 `0` valid codesigning identities；source `identity: null`、`hardenedRuntime: false`、`gatekeeperAssess: false`，所以沒有正式 Developer ID signed／hardened 對照。
- 條件是否已被需求方接受：否／待主要代理修正與複審；本報告只接受 bounded readiness evidence 的目前結果，不接受將它升格為 FR-021 完成。
- 剩餘風險：即使上述 script／文件問題修正，沒有外部 Developer ID Application identity／entitlements 仍不能建立正式 signed／hardened canary；nested Chromium renderer、UI／AI、真正全機 egress、Windows 與完整 FR-021 仍未驗收。`systemNetworkDisabled` 不是本次 readiness audit 的成功條件，也不應被推導成 true。
- 給主要開發代理的具體修正要求（若有）：
  1. 將 `identity.commandSucceeded`、valid count 與正式 identity class 納入 decision gate，對 command unavailable／malformed output 使用獨立 fail-closed status。
  2. 對 existing evidence summary 做 primitive／allowlist／length／forbidden-token validation，並在寫檔前以可測 privacy invariant 驗證所有 raw output、path、identity name/hash、secret 與 credential value 均未落盤。
  3. 明確定義 `toolchainReady` 的 required／optional 工具；補 stderr-only version 的安全結果與 source／runner provenance，或降低 evidence 的可重算宣稱。
  4. 新增 readiness focused test（含 failure injection、privacy、path、existing evidence 污染與 tool availability），將 readiness syntax／focused test 納入 `npm run check`，再重跑 full check、validator、`git diff --check` 與 final docs gate。
  5. 更新 00／03／05／06／07／08，保留 external Developer ID identity blocker 與「FR-021 未完成」；修正後以 round2 複審，不覆寫本 round1 報告。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
