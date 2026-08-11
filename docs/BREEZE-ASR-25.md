# Breeze ASR 25 實驗性轉錄

本分支新增 MediaTek Research Breeze ASR 25 選項，目標是改善台灣華語、中英混用與字幕時間對齊。這是選用功能；內建 Whisper.cpp Tiny／Base／Small 仍是預設，不受影響。

## 目前支援範圍

- App 可從固定官方 revision 下載 `breeze-asr-25.pt` 至使用者模型快取。
- 下載前需人工確認；下載使用暫存檔，完成後驗證 3,087,008,569 bytes 與 SHA-256 `9c94a3554ff4f0de83494e2ed7ba5826efa74bd87955c034b4d0fd681746b690`。
- App 只在 Python 的 `whisper.available_models()` 確實包含 `breeze-asr-25` 時啟動推論。
- 轉錄沿用既有 16 kHz 音訊準備、取消、SRT 時間碼清理、繁體規則與人工校閱。

本輪沒有把 Python、PyTorch 或 patched Whisper 放入安裝包，因此只有下載模型仍不足以執行 Breeze。

## 安裝官方 runtime

建議使用獨立 Python 3.8–3.11 virtual environment：

```bash
git clone https://github.com/mtkresearch/Breeze-ASR-25.git
cd Breeze-ASR-25
git submodule update --init --recursive
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install third_party/whisper-patch-breeze
python -c "import whisper; assert 'breeze-asr-25' in whisper.available_models()"
```

Windows PowerShell 請以 `.venv\Scripts\python.exe` 取代 `.venv/bin/python`。PyTorch 是否能使用 CUDA 取決於安裝方式與電腦驅動；沒有 CUDA 時會使用 CPU，2B 參數模型可能非常慢且需要大量記憶體。

啟動 App 前將 Python 路徑設為 `BREEZE_ASR_PYTHON`。例如 macOS／Linux：

```bash
BREEZE_ASR_PYTHON=/absolute/path/Breeze-ASR-25/.venv/bin/python npm start
```

Windows PowerShell：

```powershell
$env:BREEZE_ASR_PYTHON='C:\absolute\path\Breeze-ASR-25\.venv\Scripts\python.exe'
npm start
```

未設定環境變數時，App 會依序嘗試現有 bundled Python 與系統 `python3`／`python`，但仍必須通過模型能力探針。

## 安全與回復

- App 不接受任意模型 URL、檔名、大小或 SHA。
- 模型未完成驗證、runtime 不相容或推論失敗時，任務不會標記成功。
- 若不使用 Breeze，將 ASR 模型選回「內建 Whisper.cpp」即可；可刪除 App 顯示的 Breeze 模型快取以回收約 3 GB 空間。
- 本功能尚未完成 Windows／macOS 安裝版實機、長音訊效能與真實台灣華語品質驗收。

## 官方來源

- 模型與授權：<https://huggingface.co/MediaTek-Research/Breeze-ASR-25>
- 官方程式與 patched Whisper 安裝方式：<https://github.com/mtkresearch/Breeze-ASR-25>
