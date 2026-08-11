# Whisper 高階模型下載說明

0.48.1 安裝包預設只內建 Tiny。選擇 Base 或 Small 時，第一次提交任務前會顯示下載確認；App 會從官方 Whisper.cpp 固定 revision 下載，寫入 API 顯示的使用者模型快取，並驗證大小與 SHA-256。下載視窗的取消操作會中止背景請求並清除未完成檔案。

| 模型 | 大小 | SHA-256 |
| --- | ---: | --- |
| Base | 147,951,465 bytes | `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe` |
| Small | 487,601,967 bytes | `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b` |

官方固定來源 revision：`5359861c739e955e79d9a303bcbc70fb988958b1`，模型頁為 [ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp)。

若 Windows 網路或權限限制導致自動下載失敗：

1. 在模型下載視窗開啟對應官方 URL。
2. 下載原始檔名 `ggml-base.bin` 或 `ggml-small.bin`。
3. 將檔案放入 App 顯示的 `whisper-models` 快取資料夾。
4. 回到模型管理重新檢查；SHA-256 不符的檔案不會被使用。

下載功能不接受任意 URL，也不會寫入 Windows 安裝目錄；下載失敗時可保留 Tiny 繼續使用。
