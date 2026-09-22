# 2026-09-22 macOS ZIP／隔離安裝路徑補驗 round1 獨立審查

## 1. 需求完整性

- 判定：部分通過
- 證據：本輪要求的 macOS Apple Silicon ZIP integrity、解壓、隔離 Applications-like copy、deep strict codesign、renderer、手動字幕、real trim／post-trim、AI review、xattr 與 cleanup 均有 evidence 欄位；候選 evidence 也明確標示 `windowsExecuted=false`、`externalApiUsed=false`、`releaseReady=false`。但本輪是候選實機補驗，不包含正式 Release 所需的 Developer ID／公證、Windows、真正斷網、真實 AI／模型品質、正式 Applications／乾淨帳號或公開 Release。
- 依據：[ZIP acceptance evidence](/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/evidence/2026-09-22-macos-zip-acceptance-rel-047.json:6)、[目前狀態](/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/00-CURRENT-STATUS.md:49)、[候選 PROVENANCE](/Users/nycu/Documents/離線字幕工廠/dist/test-build-0.51.0-macos-88da220/PROVENANCE.txt:8)。

## 2. 邏輯正確性

- 判定：通過
- 證據：evidence 的 `integrity=pass`、`extract=pass`、`isolatedApplicationsLikeCopy=pass`、`deepStrictCodesign=pass` 與 renderer 結果彼此一致；renderer smoke 另記錄手動字幕 completed、real trim completed、trim duration 約 2 秒、post-trim subtitle completed、使用 trimmed video、字幕時間位移與 AI review／glossary／8 provider 結果。`spctlAssessment=rejected` 與 `developerId=false`／`notarized=false` 一致，屬 ad-hoc／未 Developer ID／未公證限制，不是 renderer 啟動失敗。
- 依據：[ZIP acceptance evidence](/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/evidence/2026-09-22-macos-zip-acceptance-rel-047.json:24)、[renderer 驗證腳本](/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/scripts/verify-electron-renderer.mjs:347)、[候選 SIGNING-STATUS](/Users/nycu/Documents/離線字幕工廠/dist/test-build-0.51.0-macos-88da220/SIGNING-STATUS-macos-arm64.txt:2)。

## 3. 邊界情況

- 判定：部分通過
- 證據：隔離暫存路徑、隔離 userData、ZIP 解壓後移除與 cleanup 均有通過結果；xattr 指令通過，未發現 `com.apple.quarantine`，但存在 `com.apple.provenance`。已明確保留 ad-hoc Gatekeeper rejection、stale provenance、Windows 暫緩與未完成的正式安裝／乾淨帳號限制。仍未覆蓋真正斷網、真實 AI／模型品質、正式 Applications／乾淨帳號與公開 Release，故不能把隔離路徑結果外推到正式發布或所有安全邊界。
- 依據：[ZIP acceptance evidence](/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/evidence/2026-09-22-macos-zip-acceptance-rel-047.json:41)、[目前狀態](/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/00-CURRENT-STATUS.md:49)、[候選 PROVENANCE](/Users/nycu/Documents/離線字幕工廠/dist/test-build-0.51.0-macos-88da220/PROVENANCE.txt:11)。

## 4. 程式碼品質

- 判定：部分通過
- 證據：`verify-electron-renderer.mjs` 使用暫存 userData、有限等待、DevTools target 篩選、明確 HTTP／UI／job assertions，並以 `finally` 統一關閉 WebSocket、終止 Electron 與清理暫存；這足以支撐本輪 packaged renderer smoke。仍有範圍性品質限制：target 依賴本地 URL 與包含「字幕」的 title，HTML asset 檢查使用字串包含，macOS cleanup 只有一次 `rmSync` 嘗試，且多個 fetch／DevTools 解析路徑未建立獨立 fault-injection 證據。因此可支持本輪正向結果，但不等於完整可靠性或正式發布等級的測試工具保證。
- 依據：[renderer 驗證腳本](/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/scripts/verify-electron-renderer.mjs:17)、[renderer 驗證腳本](/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/scripts/verify-electron-renderer.mjs:61)、[renderer 驗證腳本](/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/scripts/verify-electron-renderer.mjs:381)。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：本輪 evidence 已覆蓋 ZIP integrity、解壓、隔離安裝、deep strict codesign、renderer smoke、手動字幕、real trim、post-trim、AI review、xattr 與 cleanup；renderer 腳本也對首頁／bridge／設定、Breeze 開啟取消、manual job、trim asset、AI review settings、glossary round-trip、provider definitions 與 trimmed media synchronization 建立 assertions。未覆蓋或本輪明確排除的項目包括 Windows、真正斷網、真實 AI／模型品質、正式 Applications／乾淨帳號、Developer ID／公證與公開 Release。
- 依據：[ZIP acceptance evidence](/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/evidence/2026-09-22-macos-zip-acceptance-rel-047.json:46)、[renderer 驗證腳本](/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/scripts/verify-electron-renderer.mjs:334)、[變更紀錄最新條目](/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/08-CHANGE-LOG.md:3)。

## 6. 實際運行結果

- 判定：通過
- 證據：既有 ZIP evidence 記錄 Apple Silicon host、ZIP integrity／extract／隔離 Applications-like copy 通過，deep strict codesign 通過，renderer smoke 通過，手動字幕 job completed 且產生 cleaned SRT，real trim completed，post-trim subtitle job completed，AI review assets／glossary round-trip／8 provider definitions 通過，isolated userData cleanup 與 ZIP removal 通過。`spctl` 為 rejected，且 evidence 明確標記這是 ad-hoc／未 Developer ID／未公證候選的預期限制；`xattr` 未發現 `com.apple.quarantine` 但有 `com.apple.provenance`。
- 依據：[ZIP acceptance evidence](/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/evidence/2026-09-22-macos-zip-acceptance-rel-047.json:24)、[目前狀態](/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/00-CURRENT-STATUS.md:49)。

## 綜合判定

- 判定：有條件通過
- 證據：本結論只針對本輪 macOS ZIP 候選在 Apple Silicon 實機的 ZIP integrity／解壓／隔離安裝／renderer／real trim／清理補驗；candidate evidence 的 `releaseReady=false` 且 `notARelease=true`。候選 provenance `88da220` 落後目前 HEAD `17df978`，不是目前 dirty worktree 重建資產；因此本輪補驗不能解除 release provenance blocker。
- 結論：有條件通過
- 可逐字引用完整結論句：**本輪 macOS ZIP 候選在 Apple Silicon 實機的 ZIP integrity／解壓／隔離安裝／renderer／real trim／清理補驗有條件通過：ZIP integrity、解壓、deep strict codesign、renderer smoke、手動字幕、real trim、post-trim、AI review、cleanup 均通過；spctl rejected 是 ad-hoc／未 Developer ID／未公證限制；xattr 未發現 com.apple.quarantine 但有 com.apple.provenance；候選 provenance 88da220 落後目前 HEAD 17df978、不是目前 dirty worktree 重建資產；Windows 暫緩；真正斷網、真實 AI／模型品質、正式 Applications／乾淨帳號與公開 Release 未覆蓋，因此本結論不是 release 通過。**
- 阻擋問題（若有）：有：候選 provenance `88da220` 落後目前 HEAD `17df978` 且非目前 dirty worktree 重建資產；ad-hoc／未 Developer ID／未公證使 `spctl` rejected；Windows 暫緩；真正斷網、真實 AI／模型品質、正式 Applications／乾淨帳號與公開 Release 尚未覆蓋。這些是 release／外部驗收限制，不否定本輪 ZIP 隔離路徑補驗的通過結果。
- 依據：[ZIP acceptance evidence](/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/evidence/2026-09-22-macos-zip-acceptance-rel-047.json:66)、[候選 PROVENANCE](/Users/nycu/Documents/離線字幕工廠/dist/test-build-0.51.0-macos-88da220/PROVENANCE.txt:3)、[目前狀態](/Users/nycu/Documents/離線字幕工廠/offline-subtitle-factory-app/docs/project-management/00-CURRENT-STATUS.md:49)。

## 審查代理聲明

- 判定：通過
- 證據：本輪依既有 ZIP evidence、目前狀態、測試／流程稽核、renderer 驗證腳本及候選 PROVENANCE／SIGNING-STATUS 進行讀取與判定；未執行完整 `npm check`、建置、長測試、Windows 驗收、上傳、推送、tag 或發布。
- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。若上述聲明不實，本報告無效。
