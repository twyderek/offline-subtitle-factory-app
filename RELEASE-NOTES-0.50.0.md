# 離線字幕工廠 0.50.0（開發中）

## 版本重點

- Breeze ASR 25 的 `/api/breeze-asr` 狀態回應新增固定 `performanceReference`，讓 UI、說明與發布紀錄使用同一組可追溯數值。
- 選取 Breeze ASR 25 後，產品名稱維持乾淨顯示；選擇器外新增效能提示，揭露低資源 Mac 可能遠慢於影片時長，並提供切回內建 Whisper.cpp 的建議。
- Whisper.cpp 仍是預設路徑；首次 Breeze 模型下載與 patched runtime 設定流程不變。
- Whisper Small 遇到過長字幕 cue 時，會保留完整文字，依標點／空白拆成連續時間碼，正常情況每行最多 20 字元、每個 cue 最多兩行；若原始 cue 時間短到無法安全分配多段，會保留單一 cue 並允許第二行超過 20 字元，以避免拆斷英文單字。Tiny／Base 行為不變。

## 效能參考與限制

- 單一需求方觀察：MacBook Air `Mac15,12`／Apple M3／8 GB／8 cores／macOS `26.5.2`，1 小時 46 分影片約耗時 6 小時，約 `3.4×` 影片時長。
- 這是 2026-08-18 的單機 CPU／runtime 觀察，未保存 profiler、原始音訊或完整 telemetry；不代表跨機型效能保證，也不代表真實模型品質或 0.50 已完成 runtime 驗收。
- 對速度敏感的工作可切回內建 Whisper.cpp；Breeze「快速」模式仍不保證即時或固定倍率。
- Small cue 拆分來源不沿用原始 Whisper.cpp segment 的不精確對應；未拆分 cue 仍保留可取得的 quality metadata，拆分 cue 由規則重新評估。真實 Small 長音訊閱讀速度與跨平台品質仍待實機驗收。

## 目前狀態

- 0.50.0 目前為開發分支版本，尚未建立公開 tag、GitHub Release 或新的安裝資產。
- Python、PyTorch、MediaTek patched Whisper runtime 與約 3 GB checkpoint 仍不納入安裝包；請依 [Breeze ASR 25 說明](docs/BREEZE-ASR-25.md) 外部設定。
