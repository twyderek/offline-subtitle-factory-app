# Breeze ASR 25 實驗性轉錄

本分支新增 MediaTek Research Breeze ASR 25 選項，目標是改善台灣華語、中英混用與字幕時間對齊。這是選用功能；內建 Whisper.cpp Tiny／Base／Small 仍是預設，不受影響。

## 目前支援範圍

- App 可從固定官方 revision 下載 `breeze-asr-25.pt` 至使用者模型快取。
- 下載前需人工確認；下載使用暫存檔，完成後驗證 3,087,008,569 bytes 與 SHA-256 `9c94a3554ff4f0de83494e2ed7ba5826efa74bd87955c034b4d0fd681746b690`。
- App 只在 Python 的 `whisper.available_models()` 確實包含 `breeze-asr-25` 時啟動推論。
- 轉錄沿用既有 16 kHz 音訊準備、取消、SRT 時間碼清理、繁體規則與人工校閱。

本輪沒有把 Python、PyTorch 或 patched Whisper 放入安裝包，因此只有下載模型仍不足以執行 Breeze。

## 第一次選擇 Breeze

首頁選取 `Breeze ASR 25` 後，App 會立即檢查模型與 runtime；模型缺失時開啟固定官方版本的下載對話框，下載完成並通過大小／SHA-256 驗證後，若仍缺少 runtime 會接續開啟安裝與啟動指引。下載約 2.88 GiB，需由使用者確認開始；App 不會在背景自動執行下載、`git clone`、`pip install` 或修改 PATH。完成指引中的外部安裝並重新啟動 App 後，按「重新檢查 runtime」即可繼續。若暫不設定，可在 runtime 對話框切回內建 Whisper.cpp。

## 安裝官方 runtime

建議使用獨立 Python 3.8–3.11 virtual environment：

```bash
BREEZE_REPO="$HOME/Breeze-ASR-25"
git clone --recurse-submodules https://github.com/mtkresearch/Breeze-ASR-25.git "$BREEZE_REPO"
PYTHON_BIN="$(command -v python3.11 || true)"
test -n "$PYTHON_BIN" || { echo "需要 Python 3.11（Python 3.8–3.11 皆可，請調整 PYTHON_BIN）" >&2; exit 1; }
"$PYTHON_BIN" -m venv "$BREEZE_REPO/.venv"
"$BREEZE_REPO/.venv/bin/python" -m pip install --upgrade pip
"$BREEZE_REPO/.venv/bin/python" -m pip install "$BREEZE_REPO/third_party/whisper-patch-breeze"
"$BREEZE_REPO/.venv/bin/python" -c "import whisper; assert 'breeze-asr-25' in whisper.available_models()"
```

Windows PowerShell：

```powershell
$BreezeRepo = Join-Path $HOME 'Breeze-ASR-25'
git clone --recurse-submodules https://github.com/mtkresearch/Breeze-ASR-25.git $BreezeRepo
py -3.11 -m venv (Join-Path $BreezeRepo '.venv')
$BreezePython = Join-Path $BreezeRepo '.venv\Scripts\python.exe'
& $BreezePython -m pip install --upgrade pip
& $BreezePython -m pip install (Join-Path $BreezeRepo 'third_party\whisper-patch-breeze')
& $BreezePython -c "import whisper; assert 'breeze-asr-25' in whisper.available_models()"
```

上面的 `--recurse-submodules` 不可省略，因官方 `third_party/whisper-patch-breeze` 是 git submodule。PyTorch 是否能使用 CUDA 取決於安裝方式與電腦驅動；沒有 CUDA 時會使用 CPU，2B 參數模型可能非常慢且需要大量記憶體。

啟動 App 前將 Python 路徑設為 `BREEZE_ASR_PYTHON`。開發版必須在本專案 `offline-subtitle-factory-app` 目錄執行：

```bash
BREEZE_ASR_PYTHON="$HOME/Breeze-ASR-25/.venv/bin/python" npm start
```

macOS 已安裝 App（預設 `/Applications` 路徑）：

```bash
BREEZE_ASR_PYTHON="$HOME/Breeze-ASR-25/.venv/bin/python" "/Applications/離線字幕工廠.app/Contents/MacOS/離線字幕工廠"
```

Windows 開發版必須在本專案 `offline-subtitle-factory-app` 目錄執行：

```powershell
$env:BREEZE_ASR_PYTHON = (Join-Path $HOME 'Breeze-ASR-25\.venv\Scripts\python.exe')
npm start
```

Windows 已安裝 App（NSIS 預設路徑）：

```powershell
$env:BREEZE_ASR_PYTHON = (Join-Path $HOME 'Breeze-ASR-25\.venv\Scripts\python.exe')
& (Join-Path $env:LOCALAPPDATA 'Programs\離線字幕工廠\離線字幕工廠.exe')
```

若安裝位置自訂，只替換最後一行的 App executable 路徑；不要在 Breeze 官方 repo 內執行 `npm start`。完成啟動後回到 App 按「重新檢查 runtime」。

未設定環境變數時，App 會依序嘗試現有 bundled Python 與系統 `python3`／`python`，但仍必須通過模型能力探針。

## 外部驗收前檢查

安裝 runtime 或下載模型前，可先用只讀探針確認目前環境：

```bash
BREEZE_ASR_MODEL_DIR=/absolute/path/to/breeze-asr \\
BREEZE_ASR_PYTHON=/absolute/path/Breeze-ASR-25/.venv/bin/python \\
npm run probe:breeze -- --json
```

探針會輸出固定 revision／檔名／大小／SHA、模型快取狀態、`whisper.available_models()` 結果、runtime stderr 與耗時；runtime 缺失、模型缺失、SHA 不符或 probe timeout 時以非零狀態結束。它不會執行 `pip`、下載檔案或啟動字幕任務。

## 安全與回復

- App 不接受任意模型 URL、檔名、大小或 SHA。
- 模型未完成驗證、runtime 不相容或推論失敗時，任務不會標記成功。
- 若不使用 Breeze，將 ASR 模型選回「內建 Whisper.cpp」即可；可刪除 App 顯示的 Breeze 模型快取以回收約 3 GB 空間。
- 本功能尚未完成 Windows／macOS 安裝版實機、長音訊效能與真實台灣華語品質驗收。

## Mac Air 效能發布依據（需求方實機回報）

- 環境：MacBook Air `Mac15,12`、Apple M3、8 GB RAM、8 cores、macOS `26.5.2`（Build `25F84`）。
- Breeze ASR 25 對約 1 小時 46 分鐘影片耗時約 6 小時，約為影片長度的 `3.4×`；這是單一低資源 Mac Air 的 CPU／runtime 觀察，不是跨機型保證。
- 未保存 profiler、原始音訊或完整逐段 telemetry，因此不能據此推導品質、溫度、記憶體峰值或其他硬體效能。需要較快結果時，請改用內建 Whisper.cpp；Breeze 的「快速」模式僅是參數選擇，不保證達到即時或固定倍率。

## 官方來源

- 模型與授權：<https://huggingface.co/MediaTek-Research/Breeze-ASR-25>
- 官方程式與 patched Whisper 安裝方式：<https://github.com/mtkresearch/Breeze-ASR-25>
