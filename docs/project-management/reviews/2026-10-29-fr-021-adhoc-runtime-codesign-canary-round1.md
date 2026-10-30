# 獨立六面向審查報告：FR-021 isolated ad-hoc runtime code-sign canary

- 審查對象：`FR-021-DEBUG-20261029-ADHOC-RUNTIME-CODESIGN-CANARY`
- 審查輪次：round1
- 審查上下文：目前工作樹、指定 repo 外新 candidate metadata，以及指定 signing／audit／startup evidence；previous candidate、audit3 與 hardened canary 僅作 immutable baseline。
- 審查限制：未執行 packaged app、UI、Electron replay、network、Ollama 或模型；本報告只做 read-only evidence／文件／source contract review。
- 唯一寫入：本報告。

## 1. 需求完整性

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:51-64` 明確記錄本 work item 的隔離輸出目錄、只在新副本執行 ad-hoc runtime code-sign、immutable evidence、renderer sandbox、outer network deny、cleanup gate，以及不得使用 `--no-sandbox`／`ELECTRON_DISABLE_SANDBOX`；條目仍標為進行中，沒有把本輪診斷宣稱為完成。
- 證據：`docs/project-management/00-CURRENT-STATUS.md:3-7`、`03-FUNCTIONAL-DESIGN.md:3-7`、`05-DEVELOPMENT-AND-DEPLOYMENT.md:55-60`、`06-TEST-AND-PROCESS-AUDIT.md:3-7`、`07-DEBUG-AND-FIX-HISTORY.md:3-7` 對 ad-hoc runtime flag、無 Team ID／entitlement、兩次 startup failure、`systemNetworkDisabled=false`、未跑 UI／AI／Ollama／model 與 FR-021 未完成的界線同步一致。
- 證據：`2026-10-29-fr-021-adhoc-runtime-signing-canary-sign1.json:4-14,16-28` 具體記錄新 candidate、6 個 code object、runtime flag、deep verification、無 Team ID／entitlement 及 diagnostic-only interpretation；scope 同時記錄既有 candidate 未修改、未執行 packaged app／UI、未建立 network／Ollama／model scope。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：`2026-10-29-fr-021-adhoc-runtime-signing-canary-audit1.json` 的 6 個 objects 均記錄 `flags: "0x10002(adhoc,runtime)"`、`verification.succeeded: true`、`teamIdentifier: "not set"`、`entitlements.present: false`；六個 object 的逐筆結果與 summary `allVerified=true`、`allAdHoc=true`、`noTeamIdentifier=true`、`anyEntitlementsPresent=false`、`helperInventoryComplete=true` 一致（audit1:25-175,182-187）。
- 證據：目前 repo 外新 candidate 的只讀 `codesign -dv --verbose=4`／`codesign --verify --deep --strict` 結果與 audit1 一致：主 app、Framework、GPU／Plugin／Renderer／一般 helper 皆為 `0x10002(adhoc,runtime)`、TeamIdentifier 未設定，6 次 verify 均 exit 0；只讀 entitlements probe 對 6 個 object 均為 false。
- 證據：兩份 startup evidence 的 candidate main executable SHA-256 均為 `40a54ae3e981951058d2ebef916b09d9f7f120b18d2e01028e54aa240f8a0be5`，與新 candidate metadata 一致；probe1／probe2 分別使用 `--single-process` 與 `--no-zygote`，沒有把 failure signal 反轉成 pass（probe1:24-35,37-56,73-74；probe2:24-35,37-56,73-74）。
- 證據：`scripts/audit-macos-packaged-security-identity.mjs:122-124,167-168` 的當前 source 只以 `flags?.includes('adhoc')` 計算 `allAdHoc`，且 `status` gate 沒有要求 exact `0x10002(adhoc,runtime)`；因此目前 evidence 的 exact flag 結果是正確的，但 source contract 尚未 fail-closed 保證該條件。

## 3. 邊界情況

- 判定：通過
- 證據：截至 2026-10-29T01:39:53Z 的只讀 `stat`／`shasum`／path isolation check，新 candidate 主 executable hash 為 `40a54ae3e981951058d2ebef916b09d9f7f120b18d2e01028e54aa240f8a0be5`，既有 baseline 為 `b3605c589459068f894a70896b8ed843be3832a839fcdd83aa898e9b16210de4`，hardened baseline 為 `b89fe70df706cecb5388eb979047dead5b20b44e4204a6474e63bf549030ef13`；三者 inode 不同、candidate 不是 symlink，證明新副本與既有 candidate 隔離。既有 baseline／hardened candidate 僅被讀取，未被修改。
- 證據：audit1 helper inventory 的 `missingHelperBundleNames` 與 `unexpectedHelperBundleNames` 均為空，expected helper 為 4 個；主 app、Framework 與 4 個 helper 共 6 個 object 均被納入逐筆稽核（audit1:182-200）。
- 證據：audit1 scope 記錄 `candidateModified=false`、`networkConnectionsAttempted=false`、`packagedAppExecuted=false`、`uiFlowRun=false`、`existingOllamaDaemonStartedOrStopped=false`、`modelDownloaded=false`、`rawCommandOutputPersisted=false`、`absolutePathsPersisted=false`（audit1:206-213）；sign1 亦記錄 new candidate 與既有 candidate 隔離（sign1:16-26）。
- 證據：startup probe source 使用 loopback-only Seatbelt profile，拒絕 outbound／inbound／bind 後只允許 localhost；probe source 沒有 `--no-sandbox` 或 `ELECTRON_DISABLE_SANDBOX`。evidence 正確記錄 `systemNetworkDisabled=false`、loopback control-plane attempted、external socket not attempted，而不是把這個診斷描述成全機 network isolation（`scripts/probe-electron-single-process.mjs:14-20,186-198,236-247,275-285`；probe1／probe2:28-35,65-71）。

## 4. 程式碼品質

- 判定：部分通過
- 證據：`scripts/audit-macos-packaged-security-identity.mjs:101-113` 盤點 Frameworks 下全部 `.app`，保存 expected／missing／unexpected helper names；`inspectCodeObject` 逐一保存 code-sign metadata、deep verification、entitlement presence／digest 與 executable hash（同檔:72-88）。evidence 使用 exclusive `wx` 寫入且不保存 raw diagnostic（同檔:157-170）。
- 證據：`scripts/audit-macos-packaged-security-identity.mjs:168` 的 interpretation 明確表示 ad-hoc／缺少 entitlement 只是 packaging follow-up，不是關閉 sandbox 的理由，也沒有把 metadata audit 宣稱為 renderer、UI 或 FR-021 acceptance。
- 證據：`scripts/probe-electron-single-process.mjs:283-285` 的 probe pass gate 要求 local page、valid local CDP、無 child early exit／spawn error、process group closed 與 temporary root removed；本輪兩次實際結果均 fail-closed，且 cleanup 欄位全通過。
- 證據：Finding F-01：audit helper 的 `allAdHoc` 只檢查 `adhoc` substring，未建立 `allRuntimeFlagsObserved` 的 exact equality gate，也未把 exact runtime flag 納入 `status` 判定。這不否定本輪已保存的 exact evidence，但會讓未來只帶 `0x2(adhoc)` 的 audit 仍可能得到 `status: pass`，不符合本 work item 對 runtime flag 的回歸保證。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：本審查 session 以 `node --check scripts/audit-macos-packaged-security-identity.mjs`、`node --check scripts/probe-electron-single-process.mjs`、四份 evidence 的 `jq -e` invariant assertions 與 `git diff --check` 執行靜態／證據驗證，結果為 `static review validation: pass`；沒有執行 packaged app、UI、replay、network、Ollama 或模型。
- 證據：`jq` assertions 實際核對 sign1 的 6 objects／exact runtime flag／deep verification／scope，audit1 的逐筆 flags／verify／Team ID／entitlement／helper inventory，以及 probe1／probe2 的無 local page／CDP、`SIGABRT`、cleanup、loopback scope 與 `systemNetworkDisabled=false`；結果均通過。
- 證據：目前 test／evidence 覆蓋了本輪具體 candidate 與兩個 bounded startup variants，但沒有 deterministic source assertion 將 `0x10002(adhoc,runtime)` exact equality 納入 audit helper pass gate；此即 F-01 的測試回歸缺口。未補跑禁止範圍內的 UI／AI／Ollama／model，判定不把 scope 限制誤當成測試通過。

## 6. 實際運行結果

- 判定：部分通過
- 證據：read-only `codesign -dv --verbose=4`、`codesign --verify --deep --strict`、`codesign -d --entitlements :-` 與 `shasum`／`stat` 只讀 metadata checks 顯示新副本 6 個 object 均為 `0x10002(adhoc,runtime)`、deep verify exit 0、無 Team ID／entitlement；沒有執行 app binary 本身。
- 證據：startup probe1 的實際結果為 `status=fail`、無 local page／CDP、`SIGABRT`、`ELECTRON_EARLY_EXIT`、process group closed／absent、temporary root removed；probe2 對 `--no-zygote` 得到同樣的 fail-closed 結果（probe1:37-74；probe2:37-74）。這是 blocker persistence 的 bounded diagnosis，不是 UI／AI pass。
- 證據：兩份 probe 均記錄 `networkConnectionsAttempted=true` 但只做 loopback control-plane、`externalSocketAttempted=false`、`systemNetworkDisabled=false`、`outerSandboxProfileApplied=true`、`sandboxedTargetProcessTree=true`；沒有放寬 network policy，也沒有將 runtime flag、failure signal 或 metadata pass 宣稱為 UI／AI／FR-021 pass。
- 證據：`00/03/05/06/07` 的同步段落均明確寫出 FR-021 仍未完成；`08-CHANGE-LOG.md:53` 仍為「進行中」。因此實際運行結果只能結案為 diagnostic identity contrast 與 blocker persistence。

## Findings

- F-01（程式碼品質／回歸覆蓋，非本輪 candidate metadata 的現況矛盾）：`scripts/audit-macos-packaged-security-identity.mjs:123,167` 未以 exact `0x10002(adhoc,runtime)` 作為 summary／status 的 fail-closed invariant；目前 audit1 逐筆 evidence 已正確顯示 exact flags，但未來 flags 回落至 `0x2(adhoc)` 時仍可能被 `allAdHoc` 與 `status` 接受。建議後續在 source 增加 `allRuntimeFlagsObserved` exact equality、將其納入本 canary gate，並加入 deterministic regression assertion；在修正前，不應把 audit helper 稱為對 runtime flag 的完整回歸 gate。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：F-01 是 source／regression gate 的阻擋項，但不是本輪已保存 candidate metadata 的事實矛盾；需補 exact runtime-flag fail-closed assertion 才能讓程式碼契約與本輪 evidence 完整一致。除此之外，沒有發現新副本隔離、6-object metadata、probe fail-closed、cleanup、network scope 或未誠實揭露 UI／AI／FR-021 的問題。
- 可逐字引用的完整結論句：**本輪 FR-021 isolated ad-hoc runtime code-sign canary 有條件通過：新 candidate 與既有 candidate 確實隔離，6 個 code objects 的當前 metadata 均為 `0x10002(adhoc,runtime)`、deep verify 通過、無 Team ID／entitlement；兩次 bounded probe 均誠實 fail-closed（無 local page／CDP、`SIGABRT`、cleanup 通過），保留 renderer sandbox 與 loopback-only control-plane、正確記錄 `systemNetworkDisabled=false`，且未把 runtime flag、failure signal 或 metadata pass 宣稱為 UI／AI／FR-021 pass；但 `audit-macos-packaged-security-identity.mjs` 尚未以 exact runtime flag 作為 fail-closed source gate，故需先補 F-01 才能視為完整的回歸契約。**

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
