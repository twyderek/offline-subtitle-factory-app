# 2026-07-30 `dist/` 歷史封裝清理操作摘要

> 本檔建立於清理完成後，用於記錄操作範圍；不是清理前逐檔原始清單，也不能取代已刪除檔案的獨立重算證據。

## 保留範圍

- 0.48.0 macOS arm64 DMG、ZIP 與 blockmap。
- 0.48.0 Windows x64 Setup、Portable 與 Setup blockmap。
- `latest.yml`、`latest-mac.yml`、兩平台 SHA-256 清單、Windows 未簽章狀態。
- 目前 0.48.0 的 `mac-arm64/` 與 `win-unpacked/` 驗證目錄。
- 專案來源碼、Git 歷史／tag、bundled runtime、使用者任務資料與 GitHub Release。

## 移除範圍

- `dist/archive/`：0.21、0.22 preview、0.30、0.40 的歷史封裝，以及 0.41 Google Drive 上傳分片。
- `dist/releases/`：0.41.0 的 macOS／Windows 歷史封裝。
- `dist/build-cache/`：舊 Windows unpacked 建置快取。
- `dist/windows-0.45.0/`：0.45.0 Windows Setup／Portable、blockmap、metadata 與 checksum。
- `dist/` 根目錄：0.45.0、0.45.1、0.45.2、0.46.0、0.47.0、0.47.1 的舊 macOS／Windows 封裝、重複中文檔名資產、blockmap 與舊 checksum。

## 容量與驗證

- 清理前 `du -sh ../dist`：約 10 GB。
- 刪除命令目標的 `du -sk` 合計輸出：8.44 GiB。
- 清理後 `du -sh ../dist`：約 1.9 GB。
- 清理後根目錄檢查未找到 0.21–0.47.1 的封裝檔，保留資產均為 0.48.0 或目前 metadata／驗證目錄。

## 證據限制與回復

- 清理前逐檔 `stat`／`du` 輸出只存在本次任務執行記錄，未於刪除前另存為專案 evidence 檔；因此 8.44 GiB 不能從目前工作樹獨立重算。
- 歷史封裝為永久刪除，未移至垃圾桶。需要時必須從仍可取得的 GitHub Release 下載，或以對應來源 tag 重新建置。
- 本輪未逐一重新驗證每個歷史版本的 GitHub 公開下載可用性。
