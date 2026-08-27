# DEV-047 0.51.0 Windows preview workflow 版本對齊 round1 審查

- 審查日期：2026-08-27
- 審查範圍：`codex/0.51-anthropic-claude` 工作樹中的 DEV-047 workflow 與相關版本／治理文件
- 審查限制：未觸發 GitHub Actions、未使用 GitHub token 或 Secrets、未修改 workflow／產品程式；本報告是本輪唯一建立的專案檔案。

## 1. 需求完整性

- 判定：通過
- 證據：`.github/workflows/windows-preview.yml:1-9` 已將 workflow 名稱、push branch 與 tag 對齊 `0.51.0`／`codex/0.51-anthropic-claude`／`v0.51.0`；`:57-58` 的 Setup／Portable filters、`:87-90` 的 packaged Release notes 與 `:130` 的 upload artifact name 均為 `0.51.0`。`08-CHANGE-LOG.md` DEV-047 條目列出的成功條件也逐項涵蓋上述版本元素與必要 gates。
- 證據：原始需求要求保留 signed／unsigned 分流、runtime／安裝／renderer／archive／模型排除 gate；workflow `:40-52` 保留 signed／unsigned build，`:54-62` 保留安裝生命週期與 renderer 驗證，`:64-117` 保留 archive、操作手冊／Release notes／Breeze guide、Small／Breeze checkpoint 排除、SHA-256 與簽章狀態，`:127-134` 保留 artifact upload。

## 2. 邏輯正確性

- 判定：通過
- 證據：Node.js 22、`npm ci`、`prepare-windows-runtime.ps1` 與完整 `npm run check` 依序存在於 workflow `:24-38`；Windows build scripts 與 `package.json:28-30` 的 `electron:build`／`electron:build:unsigned` 目標一致。Setup filter `*setup-0.51.0.exe` 與 package artifact name `offline-subtitle-factory-setup-${version}.exe`、Portable filter `*portable-0.51.0.exe` 與 package artifact name `offline-subtitle-factory-portable-${version}.exe` 可互相對應。
- 證據：`:67-72` 會對所有 EXE 執行 `7z t`，`:81-95` 要求操作手冊、0.51.0 Release notes 與 Breeze guide，`:97-105` 明確拒絕 `ggml-small.bin` 與 `breeze-asr-25.pt` 進入封裝，`:107-117` 產生 SHA-256 並區分 Valid Authenticode 與 unsigned preview，`:119-125` 將必要資產複製到 upload 目錄。
- 證據：以 Ruby `YAML.load_file('.github/workflows/windows-preview.yml')` 重放基本解析成功；自製 deterministic marker／gate 檢查的 branch、tag、Setup／Portable filter、Release notes、artifact、runtime、signed／unsigned、install、archive、Small／Breeze exclusion 與 upload 項目全部 PASS。

## 3. 邊界情況

- 判定：部分通過
- 證據：workflow 對缺少 Setup／Portable、EXE 數量不足、archive 驗證失敗、必要文件缺失及意外模型檔均有明確 `throw` gate（`:59`, `:68`, `:71`, `:83-105`）；沒有簽章時仍會產生明確 unsigned 狀態文件（`:111-117`），不會把 unsigned 包標示為 signed。
- 證據：`if: env.CSC_LINK != ''`／`if: env.CSC_LINK == ''`（`:41`, `:48`）及 Secrets 的實際解析、signed／unsigned 分支選擇、Windows runner 上的 PowerShell／7z／Authenticode 行為，只能在 GitHub Actions context 驗證；本機沒有該 Secrets context，因此本輪不能證明有憑證與無憑證兩種分支均實際選對。
- 證據：workflow 沒有本機可重放的 GitHub artifact download／digest 交叉核對，也沒有在目前設定中排除舊 `../dist` 殘留檔案的專門 fixture；這些屬於 runner／外部驗收邊界，未被本輪靜態檢查覆蓋。

## 4. 程式碼品質

- 判定：通過
- 證據：本輪 workflow diff 僅把既有 0.50.0 的 name、branch、tag、Setup／Portable filter、Release notes 與 artifact name 對齊 0.51.0，未改動產品 runtime／UI 或既有驗證 gate；`git diff --check` 通過。
- 證據：workflow 步驟順序維持 checkout → Node／npm → offline runtime → source regression → signed／unsigned package → packaged/install/archive/model checks → upload，責任切分清楚；`RELEASE-NOTES-0.51.0.md` 與 `00-CURRENT-STATUS.md` 均明確寫出 workflow 尚未觸發，不將設定檔存在誤述為 CI 通過。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：本輪實際執行的 marker／gate deterministic 檢查全部 PASS；`node scripts/test-project-docs-validator.mjs`、`node scripts/test-ai-providers.mjs`、`node scripts/test-review-ui.mjs`、`node scripts/test-whisper-models.mjs`、`node scripts/test-breeze-asr.mjs` 均通過；完整 `npm run check`（含治理、語法、AI provider、Breeze、核心回歸）exit 0。
- 證據：`npm run docs:check:final` 本輪 exit 1，且明確指出 DEV-047 最新 changelog 尚為「進行中／待執行／待確認」；這是審查當下治理條目尚未由主要代理結案的預期狀態，不能用來宣稱文件收尾已完成，須在主代理填入本報告結論與開發驗證後重跑。
- 證據：目前沒有 workflow-specific test fixture 可以在本機模擬 GitHub expression／Secrets／Windows PowerShell、沒有實際 Windows runner run；deterministic source tests 因而不能替代 signed／unsigned 分支、Setup／Portable lifecycle 或 CI artifact 的實機覆蓋。

## 6. 實際運行結果

- 判定：部分通過
- 證據：Ruby YAML 基本解析成功；workflow 0.50 marker 檢查成功顯示不再含 `0.50`／`codex/0.50`／`v0.50`；0.51 branch／tag／Setup／Portable filter／Release notes／artifact name 與 signed／unsigned、install、archive、Small／Breeze exclusion gates 的 deterministic checks 全部 PASS；`git diff --check` 與完整 `npm run check` exit 0。
- 證據：本機 `npm run docs:check:final` 尚因 DEV-047 條目待結案而 exit 1；主代理需填入實際修改、驗證、審查欄位並重新執行 final check。這不表示 workflow YAML parse 或產品 deterministic tests 失敗。
- 證據：未驗證 GitHub Windows runner `windows-2022`、Secrets／Authenticode signed path、unsigned path 的 Actions 實際分支、Windows Setup 安裝／解除安裝、packaged renderer、7z archive、artifact upload／download digest、實機模型／runtime／長音訊，也未建立或核對公開 `v0.51.0` tag／Release；相關限制已在 `00-CURRENT-STATUS.md`、`06-TEST-AND-PROCESS-AUDIT.md` 與 `RELEASE-NOTES-0.51.0.md` 揭露。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 DEV-047 0.51.0 Windows preview workflow 版本對齊獨立審查結論為有條件通過：workflow 的 name、`codex/0.51-anthropic-claude` branch、`v0.51.0` tag、Setup／Portable filters、0.51.0 Release notes 與 upload artifact name 均已對齊，Node 22、offline runtime、完整 source regression、signed／unsigned 分流、Windows install／renderer、7z archive、SHA／簽章狀態與 Small／Breeze 模型排除 gates 均保留，0.50 marker／Ruby YAML 基本解析／deterministic marker checks／`git diff --check`／完整 `npm run check` 已通過；但 `docs:check:final` 仍因 DEV-047 條目尚未結案而失敗，且本輪未執行 GitHub Windows runner、Secrets／Authenticode、Setup／Portable 實機 lifecycle／renderer、artifact download digest、真實模型／runtime／長音訊或公開 0.51.0 發布，因此必須完成主代理文件結案並取得外部 runner 證據後，才可宣稱 Windows CI 或公開發布完成。**
- 阻擋問題（若有）：本輪沒有發現 workflow 版本對齊或 gate 保留的 deterministic 阻擋；條件為主代理完成 DEV-047 changelog／final docs check，並在需要宣稱 Windows CI／發布時補做外部 Windows runner、Secrets／簽章、實機與公開資產驗收。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
