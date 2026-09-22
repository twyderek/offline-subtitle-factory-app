# 2026-09-22 GitHub release post-publish round2

審查範圍：公開 GitHub `v0.51.0` macOS arm64 Release、latest 狀態、tag、9 項公開資產、遠端下載回讀、Release notes 尾端換行、Windows workflow 狀態與剩餘風險。

本輪只執行 GitHub API／`gh`／Git remote／遠端下載串流／本地檔案讀取與驗證；未修改其他檔案，未 push、tag、建立或修改 Release，未重建封裝，未執行 Windows。

## 1. 需求完整性

- 判定：通過
- 證據：`gh release list --limit 5` 將「離線字幕工廠 0.51.0」標示為 `Latest`，tag 為 `v0.51.0`；GitHub API 回報 `draft=false`、`prerelease=false`、公開 URL `https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.51.0`、發布時間 `2026-09-22T09:01:17Z`，共 9 項資產。`git ls-remote --tags origin` 回報 annotated tag object `870704fa0b20486de4c234c6e4d5248b404c7233`，其 dereferenced commit 為 `53956ccdee6e16e4c0413f09312a419613b27da6`，與要求完全一致。Release 範圍維持 macOS arm64；Windows 未被誤列入本次公開資產。

## 2. 邏輯正確性

- 判定：通過
- 證據：GitHub API 的 9 項資產名稱、大小與 digest 如下，且每項均由遠端回讀重新計算 SHA-256 後與 API digest 一致：

  | 資產 | 大小 bytes | GitHub digest |
  |---|---:|---|
  | `PROVENANCE.txt` | 842 | `sha256:7a22bd620da0d5575e174c4f2f87042fc3240f925184a2e385ebda20a718ec52` |
  | `SHA256SUMS-macos-arm64.txt` | 474 | `sha256:e4b1a0b239235367da678ceabc2c4df7f8d1d542af6e8b214c8fbd7727c815fa` |
  | `SIGNING-STATUS-macos-arm64.txt` | 379 | `sha256:aa9a29476c64c88cdb639cf27f7ad43b5b6562b8a6ed67efac11c976fd4b8a5d` |
  | `TEST-CANDIDATE-README.md` | 984 | `sha256:77078bbbd62ec94801a1e13bef404cbf09ccb8113ab6862ce600bd7020a9e38a` |
  | `latest-mac.yml` | 566 | `sha256:741686e34932e3422a375d2f6317bac562b7f9d4b1882821ea5e8bb1c1a63589` |
  | `offline-subtitle-factory-0.51.0-macos-arm64.dmg` | 242742979 | `sha256:2fd5ee33b74c19cf65791f844be645becc3482d2eba2538a38e3343f2e17263d` |
  | `offline-subtitle-factory-0.51.0-macos-arm64.dmg.blockmap` | 254668 | `sha256:75324cc83f2141ed93d3d4ee4f41def04933489d9876e3e79794906180ac35fb` |
  | `offline-subtitle-factory-0.51.0-macos-arm64.zip` | 249963233 | `sha256:e5499742edf2660a9e7fafcd7fde7eb5d513fa1e6523ea33bbc30019d507d260` |
  | `offline-subtitle-factory-0.51.0-macos-arm64.zip.blockmap` | 259030 | `sha256:bbec76e809f8e054c24e0280a9d72b53e6eceb82108926df81997c7d581d6800` |

  遠端 `latest-mac.yml` 回讀內容的 version、ZIP／DMG URL、size、SHA-512、top-level path／sha512 與本地 candidate 一致；遠端 `SHA256SUMS-macos-arm64.txt` 四行 checksum 也與本地候選一致。遠端 DMG／ZIP／兩個 blockmap 串流回讀的 SHA-256 分別與 GitHub digest 及本地候選 bytes 一致；因此既有本地 `hdiutil verify`／`unzip -t` 的完整性證據可追溯到公開下載 bytes。

## 3. 邊界情況

- 判定：部分通過
- 證據：發布資產與 metadata 的公開回讀無不一致；但本地候選 evidence／`SIGNING-STATUS-macos-arm64.txt` 明確記錄 deep strict codesign 通過、簽章為 ad-hoc、Developer ID 不存在、未 notarized，`spctl` exit 3／rejected 是預期限制，不可解讀為 Gatekeeper 通過。另有 Release notes 尾端差異：本地 `RELEASE-NOTES-0.51.0.md` 為 5164 bytes、以一個 LF 結尾；GitHub Release body 為 5165 bytes、以兩個 LF 結尾；兩者去除尾端 LF 後內容完全一致，差異僅為 GitHub 多一個空白結尾換行。真正斷網、真實 Anthropic／外部 AI 模型品質、正式 Applications／乾淨帳號與 Gatekeeper 通過仍未驗收。

## 4. 程式碼品質

- 判定：部分通過
- 證據：公開資產均可由同一 tag／commit 追溯，檔名、updater metadata、checksum、provenance、簽章狀態與 Release notes 的 macOS-only 邊界互相一致；遠端文字資產與本地候選逐 byte 比較均為 `match`。但本輪是發布後資產與治理一致性審查，沒有重新審閱或重建產品程式碼，也不能以 macOS 資產一致性推論 Windows 程式碼或正式 Apple signing 品質已通過。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：發布前 candidate evidence 已記錄 DMG／ZIP 兩條新 macOS 實機 renderer／手動字幕／real trim／post-trim／AI／glossary／8 provider smoke 通過；本輪新增公開面驗證包含 latest／公開 Release、tag 指向、9 項 asset API size／digest、DMG／ZIP／blockmap 遠端串流 hash、`latest-mac.yml`／SHA256SUMS 回讀與 Release notes byte／tail 比較。Windows tag run `35700315448` 與 branch run `35700305138` 均為 `Build Windows 0.49.1` 的 `Windows x64 test and package` job 失敗，失敗 step 為 `Run source and real FFmpeg regression tests`，錯誤為 `scripts/test-breeze-asr.mjs:176` 的「應存在可測試的 Breeze 效能提示更新函式」。這是實際 Windows CI 未通過，不是 Windows 通過證據；因需求方已指定 Windows 暫緩，該失敗屬本次 Release 明確排除的平台範圍，但仍須列為後續 Windows blocker。

## 6. 實際運行結果

- 判定：通過
- 證據：GitHub `v0.51.0` 現為公開且 latest，非 draft／非 prerelease；tag dereference 精確指向 `53956ccdee6e16e4c0413f09312a419613b27da6`。9 項資產均有 API size／digest，遠端 DMG／ZIP／blockmap 下載串流 hash 與 API／本地 candidate 一致，遠端 `latest-mac.yml` 與 `SHA256SUMS-macos-arm64.txt` 回讀內容與本地一致。公開 Release 已完成 macOS arm64 資產交付；Windows workflow failure 僅發生於 Windows x64 workflow，未影響本輪已發布的 macOS 資產回讀結果。

## 綜合判定

- 結論：有條件通過
- 可逐字引用完整結論句：**本輪 v0.51.0 macOS arm64 GitHub Release 已公開並標示 latest，tag 正確指向 53956cc，9 項資產的名稱／大小／GitHub digest 與遠端 DMG／ZIP／latest-mac.yml／SHA256SUMS 回讀均一致，Release notes 僅有一個尾端換行差異，Windows workflow failure 僅屬需求方已暫緩的 Windows 範圍，但 macOS 仍維持 ad-hoc／未公證、真正斷網／外部 AI 品質／乾淨安裝未覆蓋等剩餘風險。**
- 阻擋問題（若有）：本輪 macOS 公開 Release 的資產、tag、latest 與遠端回讀沒有發現阻擋；Windows tag／branch workflow 仍因 Breeze 效能提示測試失敗而未通過，必須維持「Windows 暫緩」而不得宣稱跨平台完成。ad-hoc／未 Developer ID／未公證造成 `spctl` rejected，屬已揭露且依授權接受的發布風險；Release notes 多一個尾端 LF 為非內容差異，未形成資產或功能阻擋。

## 審查代理聲明

本輪未 push、tag、建立或修改 GitHub Release，未重建封裝，未執行 Windows。

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
若上述聲明不實，本報告無效。
