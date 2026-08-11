# 獨立複審報告：Whisper 三模型可選模式與模擬 runtime 驗證

- 審查對象 commit／版本：工作樹現行 0.48.0；承接 round1 `docs/project-management/reviews/2026-08-04-whisper-three-models-round1.md`
- 對應 08-CHANGE-LOG 條目：2026-08-04 — Whisper 三模型可選模式與模擬 runtime 驗證
- 審查輪次：round2
- 審查代理啟動時間、上下文來源：2026-08-04（獨立複審）；只讀取現行差異與 round1 要求，並執行 focused/docs/diff 驗證。

## 1. 需求完整性

- 判定：通過
- 證據：`scripts/test-whisper-models.mjs:76-103` 新增 round1 要求的 three-model too-small、SHA mismatch、manifest-size mismatch 邊界；`:105-108` 新增 `public/index.html` 的 tiny／base／small option presence assertion。原 FR-022 白名單／相容／不自動下載範圍仍由 `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:38` 與 `03-FUNCTIONAL-DESIGN.md:47-51` 定義，未擴張成實際模型品質驗收。

## 2. 邏輯正確性

- 判定：通過
- 證據：too-small case 以 production `allowMock` 預設 false 檢查 base，斷言 `valid:false`／`reason:'too-small'`（`scripts/test-whisper-models.mjs:81-88`）；同一 base 檔案再以錯誤 SHA 與錯誤 manifest size 斷言 `sha256-mismatch`／`size-mismatch`（`:89-103`），證明不會因 mock 尺寸繞過而假成功。repair 不涉及 production source；UI assertion 讀取實際 `public/index.html` 並固定三個 option 值（`:105-108`）。

## 3. 邊界情況

- 判定：通過
- 證據：round1 已有空值、multilingual／ggml alias、未知值回 tiny、三模型 mock SRT／JSON／quality metadata 與 base 缺檔（`scripts/test-whisper-models.mjs:31-35,37-74`）；本輪補上 too-small、錯誤 SHA、錯誤 size 及 UI option presence。`allowMock:true` 僅出現在測試成功 fixture（`:42-46`）及 hash／size failure fixture（`:90,96`），production server 沒有 mock bypass。取消、Metal fallback、長音訊與真實模型仍屬既有分層／外部驗收邊界。

## 4. 程式碼品質

- 判定：通過
- 證據：本輪變更集中於 deterministic test assertions；沒有修改 `lib/whisper-models.mjs`、`server.mjs` 或 manifest verifier。測試以 helper 回傳的具體 reason 做斷言，避免只檢查布林成功；UI assertion 從實際 index HTML 讀取，未重複維護另一份選項清單。

## 5. 測試覆蓋

- 判定：通過
- 證據：2026-08-04 執行 `node scripts/test-whisper-models.mjs` 通過，輸出涵蓋 tiny／base／small 選擇、路徑、CLI、SRT／JSON、缺檔；測試新增四類 failure／UI assertions。`npm run docs:check`、`node scripts/test-project-docs-validator.mjs` 與 `git diff --check` 均通過。round1 已取得受控權限的完整 `npm run check` 通過證據；本輪聚焦驗證未下載外部模型。

## 6. 實際運行結果

- 判定：通過
- 證據：mock runner 仍逐模型實際寫入並解析 SRT／JSON／quality metadata（`scripts/test-whisper-models.mjs:19-28,61-69`）；新增 failure fixtures 實際回報 too-small、SHA mismatch、size mismatch 而非成功。UI option assertion 讀取現行 `public/index.html`，並確認三模式存在。這些結果證明契約與錯誤邊界，不等同 Windows／macOS 安裝後或實際 base／small 模型品質。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：無本輪測試或 production code 阻擋；實際 base／small 權重、跨平台安裝後 smoke、取消／fallback 長音訊與模型品質仍未執行。
- 剩餘風險：本輪只補 deterministic validation 與 static UI option presence，沒有瀏覽器互動、真實權重或跨平台安裝證據；runtime manifest 目前仍可只列 tiny optional model entry。
- 給主要開發代理的具體修正要求：保留新增 failure／UI assertions；取得 base／small 資產後，依 FR-022 逐一執行 Windows／macOS 安裝、取消／Metal→CPU、quality metadata、長音訊與中文品質 smoke，並保存 evidence。
- 可逐字引用完整結論句：**本輪 FR-022 Whisper 三模型 round2 複審結論為有條件通過：新增測試已 deterministic 證明 tiny／base／small 的 too-small、SHA mismatch、manifest-size mismatch 會拒絕，且實際 index HTML 含三個 UI options；round1 的 mock SRT／JSON／quality metadata、alias／缺檔與完整回歸證據仍有效，未修改 production validator，但實際 base／small 權重、跨平台安裝後 smoke、取消／fallback 長音訊與模型品質仍待外部驗收，不得宣稱三模型實機完成。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
