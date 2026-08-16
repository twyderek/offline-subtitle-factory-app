# 獨立審查報告：Breeze BUG-022 修正版 macOS 測試包（REL-035）

- 審查對象 commit／版本：`codex/021-breeze-runtime-guide@c5e8bbe67255c030e377bc018cb6f17186db1244`，產品版本 `0.49.0`；候選目錄 `/Users/nycu/Documents/離線字幕工廠/dist/test-build-c5e8bbe/`
- 對應 08-CHANGE-LOG 條目：2026-08-17 — Breeze BUG-022 修正版 macOS 測試包（REL-035）（`docs/project-management/08-CHANGE-LOG.md:5-30`）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-17T07:46:41+08:00；獨立上下文，未沿用開發代理對話記憶。依 release preflight 讀取 `AGENTS.md`、專案管理入口／目前狀態／最新工作條目、release／build／test／independent-review／closeout 路由文件。
- 審查範圍限制：僅讀取目前 repository 與 `/Users/nycu/Documents/離線字幕工廠/dist/test-build-c5e8bbe/`；未執行長時間 `npm test`、完整 `npm run check` 或 renderer smoke。renderer smoke 僅引用主代理在候選 README／工作紀錄提供的證據，明確標示未由本代理重跑。

## 1. 需求完整性

- 判定：通過（限 macOS arm64 隔離測試候選）
- 證據：
  - 候選 README（`/Users/nycu/Documents/離線字幕工廠/dist/test-build-c5e8bbe/TEST-CANDIDATE-README.md:1-21`）標示來源 commit、版本、DMG／ZIP、Breeze BUG-022 修正、未內建 Python／PyTorch／patched Whisper／`.pt` checkpoint，以及「非公開 Release」邊界。
  - `git show -s --format='%H%n%ad%n%s' c5e8bbe67255c030e377bc018cb6f17186db1244` 實際解析至 `c5e8bbe67255c030e377bc018cb6f17186db1244`（`fix: resolve Breeze runtime home paths`）。封裝內 `package.json` 亦實際為 `0.49.0`。
  - 候選資產名稱、平台（macOS arm64）、版本與隔離輸出位置符合 REL-035 工作條目，不涉及 tag、公開 Release 或既有正式資產替換。

## 2. 邏輯正確性

- 判定：通過（限 BUG-022 封裝 marker）
- 證據：
  - 由 ZIP app 直接以 `unzip -p ... '*/Contents/Resources/app/lib/breeze-runtime-probe.mjs' | nl -ba` 讀出封裝內容：`lib/breeze-runtime-probe.mjs:22-48` 依平台選擇 `HOME`／`USERPROFILE`，標準 `Breeze-ASR-25/.venv` runtime 排在 generic bundled Python 前，並保留 `BREEZE_ASR_PYTHON` 明確覆寫。
  - 由 ZIP app 直接以 `unzip -p ... '*/Contents/Resources/app/public/app.js' | nl -ba` 讀出 `public/app.js:416-434`：`/api/health` 成功後呼叫 `updateMetrics(tools)`，符合首頁工具健康卡修正 marker。
  - `latest-mac.yml`（`/Users/nycu/Documents/離線字幕工廠/dist/test-build-c5e8bbe/latest-mac.yml:1-9`）版本、URL、大小與 SHA-512 欄位可解析，且指向同一候選檔案。

## 3. 邊界情況

- 判定：通過；DMG 內容掛載另有環境限制，列入剩餘風險
- 證據：
  - 實際 `shasum -a 256`：DMG `db4bd42ebf32301fa4b25a0ea876a59a067ef0925efbb32bf9ec2a6ee137cac6`、ZIP `fff885f8b9958457ca83aa661913558a2a324221f79d1fc8396af9589410dc9d`；`stat` 大小分別為 `242714797`、`249946819` bytes，與候選 README／metadata 一致。
  - 實際 `openssl dgst -sha512 -binary ... | base64` 與 `latest-mac.yml` 完全一致：ZIP `kgzwoYC1wRb3vQlW8kBA+4LpoIgByclreK0wnk+bnREvNuNUpSAWXPNfLHXc03iRalkjkhob92ShtikUl7aYgA==`；DMG `dgWFDGi0UMN9AJA7PzfWmKkBW4xNOxzkgIi9WcB/WsNL5Dqc+oSaPm60rXUa3wV5X0ol59p+5CheGuKvHsW9QA==`。
  - 實際 `hdiutil verify ...dmg` 完成並回報 `checksum ... is VALID`；實際 `unzip -t ...zip` 完成並回報 `No errors detected in compressed data`。
  - 實際 `unzip -Z1 ...zip | rg -i '\.(pt|pth|ckpt)$|checkpoint'` 無輸出且 exit 1；封裝清單僅見內建 `whisper-models/ggml-tiny.bin`，未見 Breeze `.pt`／checkpoint。ZIP app 內 `docs/BREEZE-ASR-25.md` 也明示本輪不把 Python、PyTorch 或 patched Whisper 放入安裝包。
  - `hdiutil attach -readonly -nobrowse` 嘗試讀取 DMG 時受目前環境回報「尚未設定裝置」；因此本代理未能掛載 DMG 再次逐檔讀 marker。DMG 本身的 `hdiutil verify` 已通過，DMG／ZIP 同候選 README 的封裝證據仍保留，但此項不宣稱 DMG 內容已由本代理逐檔重讀。

## 4. 程式碼品質

- 判定：通過（封裝內容抽查）
- 證據：
  - 封裝內 resolver 與首頁健康卡程式碼為可讀、集中的單一邏輯；無需在封裝中加入第三方 runtime 或 checkpoint，符合 `FR-024`／`BUG-022` 的安全邊界。
  - `tools/manifest.json` 實際標示 `target: darwin-arm64`、內建 Whisper.cpp／Tiny 模型與固定檔案 SHA／大小，沒有把 Breeze `.pt` 偽裝成內建 runtime。
  - `package.json` 實際標示 `version: 0.49.0` 與 `engines.node: >=22.12.0`；封裝內無從 README 所宣稱的公開 Release 操作。

## 5. 測試覆蓋

- 判定：部分通過（資產／封裝完整性實測通過；renderer smoke 未由本代理重跑）
- 證據：
  - 本代理於 2026-08-17T07:46（Asia/Taipei）實際執行：`shasum -a 256`、`stat`、`openssl dgst -sha512 -binary | base64`、`hdiutil verify`、`unzip -t`、`unzip -Z1` checkpoint 搜尋、ZIP app marker 讀取與 codesign verify，結果如第 2／3／6 節所列。
  - 主代理提供的候選 README（`TEST-CANDIDATE-README.md:10-12`）聲明 `npm run check`、runtime manifest／verify、packaged renderer smoke 通過；本代理未重跑這些長時間或 renderer 操作，未將其誤寫為本代理實測。
  - 缺少真實 Breeze patched runtime／約 3 GB checkpoint、真實音訊品質／效能／取消、macOS 乾淨安裝與 Gatekeeper 驗收；這些不在本輪資產審查中，且候選 README 已揭露。

## 6. 實際運行結果

- 判定：通過（封裝可校驗／簽章狀態）；renderer smoke 為主代理證據，未由本代理重跑
- 證據：
  - 從 ZIP 解壓 app 至受控暫存目錄後，實際 `codesign --verify --deep --strict --verbose=2` 回報 `valid on disk` 與 `satisfies its Designated Requirement`。
  - `codesign -dvvv` 實際回報 `Format=app bundle with Mach-O thin (arm64)`、`CodeDirectory ... flags=0x2(adhoc)`、`Signature=adhoc`、`TeamIdentifier=not set`；因此未把 ad-hoc 誤稱為 Developer ID／公證。
  - DMG `hdiutil verify` 與 ZIP `unzip -t` 均直接成功；ZIP app marker／checkpoint 清單亦直接核對。主代理提供的 renderer smoke（Electron bridge、首頁、設定 modal、上傳／完成、修剪頁、review AI 資產與七個 provider）僅作為已提供證據引用，未由本代理重跑。

## 綜合判定

- 結論：通過（限 REL-035 macOS arm64 隔離測試候選交付）
- 阻擋問題（若有）：無。DMG 無法在本審查環境 attach 逐檔讀取（`hdiutil attach` 回報「尚未設定裝置」）是可追溯的環境限制，不是 checksum／metadata／格式失敗；已以 `hdiutil verify`、ZIP 內容實測、候選 README 及主代理提供的 renderer 證據補足本輪交付判定。不得因此擴張為 DMG 安裝後或乾淨實機驗收通過。
- 剩餘風險：macOS ad-hoc／未 Developer ID／未公證；本代理未重跑 renderer smoke；DMG 內容未能掛載逐檔抽查；真實 Breeze patched runtime、模型 checkpoint、音訊品質／效能／長音訊／取消、macOS 乾淨安裝／Gatekeeper 與 Windows 行為仍未覆蓋。此候選不得視為公開 Release。
- 給主要開發代理的具體修正要求（若有）：無。請在 REL-035 工作條目連結本報告並逐字引用下列完整結論；保留未重跑 renderer、DMG attach 限制與真實 runtime／乾淨安裝風險揭露。
- 可逐字引用完整結論句：**「REL-035 round1 獨立審查通過：來源 `codex/021-breeze-runtime-guide@c5e8bbe67255c030e377bc018cb6f17186db1244` 的 macOS arm64 DMG／ZIP 已完成來源、版本、SHA-256、latest-mac.yml SHA-512／大小、DMG `hdiutil verify`、ZIP 完整性、ad-hoc codesign、ZIP 封裝內 BUG-022 runtime／首頁健康卡 marker 與 Breeze `.pt` checkpoint 排除核對，可作為隔離測試候選交付；packaged renderer smoke 為主代理已提供證據，本代理未重跑，且 DMG attach 受環境限制未逐檔抽查；本結論不代表 macOS 乾淨安裝／Gatekeeper、真實 Breeze runtime、約 3 GB checkpoint、模型品質、效能、長音訊或取消已驗收，亦不授權建立、上傳或替換公開 Release。」**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 審查使用的 ZIP 解壓目錄位於 `/tmp`；未將暫存內容寫回 repository 或候選輸出目錄。
- 若上述聲明不實，本報告無效。
