# 離線字幕工廠 0.49.1

## 版本重點

- Breeze ASR 25 選擇器使用一般產品名稱；首次選取會立即檢查模型與 runtime，模型缺失時開啟固定官方下載，完成驗證後接續顯示 patched runtime 安裝／啟動指引。
- Breeze checkpoint 固定使用官方 revision `cffe7ccb404d025296a00758d0a33468bec3a9d0`、檔名 `breeze-asr-25.pt`、大小 3,087,008,569 bytes 與 SHA-256 驗證。
- Breeze readiness 會顯示尚未安裝、模型已安裝但缺 runtime 或已就緒；重複選取會共用同一個 readiness 流程。App 不會自動執行 `pip install`、clone repository 或修改系統 PATH。
- 內建 Whisper.cpp Tiny／Base／Small、模型下載驗證、字幕校閱與既有離線流程維持不變。

## 安裝與使用

- 預設 Whisper.cpp Tiny 隨安裝包提供；Base／Small 仍由首次使用流程安全下載。
- Breeze checkpoint 約 2.88 GiB，不納入 DMG、ZIP、Setup 或 Portable。
- Breeze 的 Python、PyTorch 與 MediaTek patched Whisper runtime 不納入安裝包；請依 [Breeze ASR 25 說明](docs/BREEZE-ASR-25.md) 完成外部安裝，回到 App 重新檢查 runtime。

## 已知限制與效能依據

- Breeze 仍屬 experimental 選用功能；真實 checkpoint／官方 runtime、台灣華語品質、長音訊、CPU／CUDA 效能、記憶體、取消與跨平台乾淨安裝尚未完成完整實機驗收。
- 需求方回報 MacBook Air `Mac15,12`／Apple M3／8 GB／8 cores／macOS `26.5.2`（Build `25F84`）處理 1 小時 46 分鐘影片約需 6 小時，約為影片長度 `3.4×`。這是單一本機 CPU／runtime 觀察，沒有 profiler、原始音訊或完整 telemetry，不代表跨機型保證。
- 對速度敏感的工作可切回內建 Whisper.cpp；Breeze「快速」模式不保證即時或固定倍率。

## 安全與隱私

- 影音與本機轉錄仍保存在使用者電腦；Breeze 模型下載只連線至固定官方模型 URL。
- Windows 資產未使用 Authenticode；macOS 資產未使用 Apple Developer ID 簽章或公證。下載後請核對 Release 所附 SHA-256。
