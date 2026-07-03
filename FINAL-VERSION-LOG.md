# 離線字幕工廠 APP 最終版本整合日誌

> 整合日期：2026-07-03  
> 專案位置：`APP-PROJECT/offline-subtitle-factory-app`  
> 測試輸出位置：`APP-PROJECT/dist/win-unpacked`  
> 目前狀態：已完成 0.20.0 版 Windows x64 Setup / Portable 打包。

---

## 一、目前版本定位

本階段完成「離線字幕工廠」0.20.0 發布版主要功能整合。此版本包含任務管理列表、第 10 步輸出、GPU 偵測、環境安裝引導、NYCU 品牌資訊、專案檔儲存/讀取與校閱/燒錄流程。

正式打包流程會輸出：

- `離線字幕工廠 Setup 0.20.0.exe`
- `離線字幕工廠 0.20.0.exe`
- `dist/win-unpacked`

---

## 0.20.0 發布紀錄

- 發布日期：2026-07-03
- 版本號：`0.20.0`
- 打包狀態：已執行 electron-builder 產生 Windows x64 Setup 與 Portable。
- 打包完成時間：2026-07-03 14:08
- 輸出檔案：
  - `APP-PROJECT/dist/離線字幕工廠 Setup 0.20.0.exe`
  - `APP-PROJECT/dist/離線字幕工廠 0.20.0.exe`
  - `APP-PROJECT/dist/離線字幕工廠 Setup 0.20.0.exe.blockmap`
  - `APP-PROJECT/dist/win-unpacked`
- SHA256：
  - Setup：`3938473C93854B7F7A466B26B7038433D7DD806C6362234228FAAD1E3C7AE3DE`
  - Portable：`0442B6E389F5026272B65C9F8DEB5C3FF11E37C210BC44F54B5448ECD6EF5B40`
- 發布前驗證：
  - source 與 `dist/win-unpacked/resources/app` 同步
  - Node 語法檢查通過
  - `/api/health` 通過
  - `/api/jobs` 任務列表通過
  - 硬燒錄 MP4 與軟字幕 MKV 已於發布前完成 API 實測

---

## 二、已完成主要功能

### 1. Electron 選單與專案檔

- 顯示 Windows 應用程式選單列。
- 選單結構包含：檔案、編輯、檢視、說明。
- 檔案選單新增：
  - 新增專案檔
  - 儲存專案檔
  - 讀取專案檔
  - APP 偏好設定
  - 開啟任務資料夾
  - 開啟設定資料夾
- 專案檔副檔名定義為 `.osfp`。
- APP 啟動預設為空白專案，不再自動載入前次任務。

### 2. 品牌與說明資訊

- 左上品牌圖示已更換為國立陽明交通大學校徽。
- 關於視窗已加入：
  - 軟體名稱
  - 版本
  - 學校：國立陽明交通大學
  - 單位：教務處數位教學中心
  - 版權說明
- 問題回報已加入聯絡資訊：
  - Email：derek@nycu.edu.tw
  - 分機 / 電話：62101

### 3. 環境偵測與工具安裝引導

- Electron 啟動時執行 preflight 檢查。
- 前端啟動時執行 `/api/bootstrap` 輕量檢查。
- `/api/health` 回傳完整狀態：
  - Node.js
  - FFmpeg
  - Python
  - Whisper
  - GPU / CUDA / PyTorch 狀態
- 缺少工具時提供中文安裝指引。
- setup / start 腳本已補強工具存在性與可執行性檢查。

### 4. GPU 狀態檢測

- `/api/health` 新增 GPU 偵測。
- 支援回傳：
  - `cuda`
  - `mps`
  - `cpu-only`
  - `error`
- 前端效能面板 GPU 欄位不再硬編碼為「未使用」。
- 目前測試機偵測結果為 `cpu-only`。

### 5. 影片資訊即時顯示

- 上傳影片後自動顯示：
  - 檔案名稱
  - 時長
  - 解析度
  - 檔案大小
- 透過 `/api/video/probe` 使用 FFprobe 分析影片。

### 6. 字幕規則處理

- 已實作 `parseRules()` 與 `applyRulesToSrt()`。
- 支援：
  - `FORCE_TRADITIONAL`
  - `REMOVE_FILLER`
  - `NORMALIZE_TERM`
  - 自訂文字替換
  - `REGEX_REPLACE`
  - 標點清理
  - 簡體轉繁體
- 已不再只是單純複製 `draft.srt`。

### 7. 任務管理列表

- 新增 `GET /api/jobs`。
- 主畫面左側「任務管理」可開啟歷史任務列表。
- 支援：
  - 搜尋任務
  - 依狀態篩選
  - 重新整理
  - 載入任務
  - 進入校閱
  - 開啟任務資料夾

### 8. 第 10 步輸出

- 新增 `POST /api/jobs/:id/burn`。
- 新增 `POST /api/jobs/:id/cancel-burn`。
- 支援輸出模式：
  - 硬燒錄 MP4
  - 軟字幕 MP4 / MKV
  - 兩者都輸出
- 輸出內容包含：
  - `*_hardsub.mp4`
  - `*_softsub.mkv` 或 `*_softsub.mp4`
  - `*_reviewed.srt`
  - `subtitle.ass`
  - `export-manifest.json`
- 修正 Windows FFmpeg `ass` filter 磁碟機路徑問題，改用 output 工作目錄與相對 `subtitle.ass`。
- 校閱頁新增「燒錄輸出」按鈕，會先儲存校稿包再啟動輸出。

---

## 三、目前重要檔案

| 類型 | 路徑 |
|---|---|
| APP source | `APP-PROJECT/offline-subtitle-factory-app` |
| Electron main | `APP-PROJECT/offline-subtitle-factory-app/electron/main.mjs` |
| 後端 API | `APP-PROJECT/offline-subtitle-factory-app/server.mjs` |
| 主畫面 | `APP-PROJECT/offline-subtitle-factory-app/public/index.html` |
| 主畫面邏輯 | `APP-PROJECT/offline-subtitle-factory-app/public/app.js` |
| 校閱頁 | `APP-PROJECT/offline-subtitle-factory-app/public/review.html` |
| 校閱頁邏輯 | `APP-PROJECT/offline-subtitle-factory-app/public/review.js` |
| 共用樣式 | `APP-PROJECT/offline-subtitle-factory-app/public/styles.css` |
| 測試版執行資料 | `APP-PROJECT/dist/win-unpacked/resources/app` |
| 歷史封存 | `APP-PROJECT/歷史資料/2026-07-03-開發整合封存` |

---

## 四、測試結果

### 語法檢查

以下檔案 source 與 `win-unpacked` 均通過 `node --check`：

- `server.mjs`
- `public/app.js`
- `public/review.js`
- `electron/main.mjs`

### API 與功能測試

- `/api/health`：通過
- `/api/bootstrap`：通過
- `/api/jobs` 任務列表：通過
- 任務建立：通過
- 匯入既有 SRT：通過
- 規則清理：通過
- 硬燒錄 MP4：通過，成功產生 `sample_hardsub.mp4`
- 軟字幕 MKV：通過，成功產生 `sample_softsub.mkv`
- source 與 `win-unpacked/resources/app` 逐對 hash 比對：通過

### 目前測試機環境狀態

- Node.js：OK
- FFmpeg：OK
- Python：OK
- Whisper：OK
- GPU：`cpu-only`

---

## 五、尚未執行事項

- 尚未將版本號升級為 0.20。
- 尚未重新產生正式 Setup 安裝檔。
- 尚未重新產生正式 Portable 免安裝檔。
- 正式發布前應再執行完整 UI 實機測試與打包後 smoke test。

---

## 六、發布前建議檢查清單

1. 確認 `package.json` 版本號改為正式發布版本。
2. 確認 source 與 `dist/win-unpacked/resources/app` 同步。
3. 使用 `win-unpacked` 實機測試：
   - 開啟 APP
   - 建立任務
   - 匯入影片與 SRT
   - 進入校閱
   - 儲存校稿包
   - 硬燒錄輸出
   - 軟字幕輸出
   - 任務管理列表載入歷史任務
4. 使用 electron-builder 產出正式 Setup / Portable。
5. 在乾淨環境安裝測試工具偵測與首次啟動流程。

---

## 七、封存說明

本次已將前期策略文件、測試截圖、舊開發文件、UI 概念圖與舊打包暫存資料整理到：

`APP-PROJECT/歷史資料/2026-07-03-開發整合封存`

根目錄保留本檔作為最新單一版本日誌。
