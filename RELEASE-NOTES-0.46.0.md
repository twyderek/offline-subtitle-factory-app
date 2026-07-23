# 離線字幕工廠 0.46.0

> **發布風險提醒**：本候選版本的 Windows／macOS 簽章、公證、跨平台乾淨實機與 Electron renderer 驗證狀態，必須以發布時的資產稽核為準；若仍未完成，請核對 SHA-256 並先在非關鍵環境測試。

## 雙語字幕

- cue 保存 `sourceText` 與 `translatedText`，舊單語字幕會安全載入為兩欄相同內容。
- 校閱頁可分別編輯原文與譯文，並選擇原文在上或譯文在上。
- 支援雙語 SRT、VTT、ASS 輸出，ASS 使用換行控制碼與安全字元處理。
- 校稿包與自動保存會保存 `bilingual-cues.json`；保存時驗證 cue 數量與時間碼。
- 規則處理、AI request、分割與合併流程維持雙語欄位。

## 相容性與驗證

- 完整 `npm run check`、雙語資料模型測試、保存／載入／ASS 核心整合測試通過。
- 0.46 round3 獨立複審為有條件通過。
- AI response contract 專門測試、FFmpeg 實際硬燒錄、Electron／Windows／macOS 實機與封裝後 renderer 驗證，若發布前尚未完成，均不得宣稱已完成。

## 版本

- 版本：`0.46.0`
- 標籤：`v0.46.0`
