# 0.48.x 外部驗收 Checklist

## 使用規則

- 每一項填寫：日期、OS／硬體、版本、執行者、結果、證據路徑。
- 未取得實機證據不得標示通過；連線成功不等於模型品質通過。
- LM Studio 依需求方指示暫緩，不得以「未執行」填成通過。

逐項記錄模板（每個 checklist 項目完成後複製一列）：

| 項目 | 日期 | OS／硬體 | 軟體／版本 | 執行者 | 結果（通過／失敗／阻塞） | 證據路徑／備註 |
|---|---|---|---|---|---|---|
| 範例：Setup 安裝 | YYYY-MM-DD | Windows 11 x64 | 0.48.0 | 姓名 | 待執行 | `evidence/...` |

## 測試素材要求

專案目前不內附外部驗收音訊。驗收者應準備一段 30–60 秒、具清楚人聲且可合法使用的 WAV／MP3／M4A，並另備一份預期文字摘要或人工校閱基準；不得使用含個資或未授權內容。所有平台使用同一素材，才能比較轉錄、字幕時間碼與模型品質差異。

## 1. Windows 10／11 x64

環境：Windows 10 22H2 或 Windows 11 x64、乾淨 VM／實機、PowerShell 5.1+、Windows Defender／SmartScreen；可選 Process Monitor、事件檢視器。

- [ ] 核對 Setup／Portable SHA-256（`SHA256SUMS-windows-x64.txt`）。
- [ ] Setup 安裝、開始選單／桌面捷徑、啟動與解除安裝。
- [ ] Portable 啟動、資料保存與移除語意。
- [ ] 真實音訊轉錄、校閱、SRT／VTT 輸出。
- [ ] 內建 FFmpeg／Whisper.cpp／模型可用。
- [ ] 離線模式與內建操作手冊／三段動畫播放。
- [ ] 記錄 SmartScreen／Unknown Publisher 狀態。

證據：安裝／解除安裝截圖、測試音訊與字幕、事件檢視器、SHA 結果。未簽 Authenticode 時不得宣稱簽章通過。

CI／候選包自動驗收：GitHub Actions `Windows packaged renderer and install lifecycle` 會對 Setup 執行靜默安裝、已安裝 EXE renderer smoke、靜默解除安裝，再對 Portable 執行 renderer smoke。工作流通過只代表候選包流程通過，仍須在 Windows 10／11 實機完成本節的真實音訊與 SmartScreen 檢查。可在 Windows 本機重播：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-windows-installation.ps1 `
  -SetupPath .\dist\離線字幕工廠 Setup 0.48.1.exe `
  -PortablePath .\dist\離線字幕工廠 Portable 0.48.1.exe
```

## 2. macOS Apple Silicon

環境：macOS 12+ Apple Silicon（建議 macOS 12 與較新版各一台）、Finder／Terminal、`hdiutil`、`codesign`、`spctl`。

- [ ] 核對 DMG／ZIP SHA-256（`SHA256SUMS-macos-arm64.txt`）。
- [ ] DMG 掛載、拖曳安裝、啟動與解除安裝。
- [ ] ZIP 解壓後直接啟動。
- [ ] 真實音訊轉錄、校閱、SRT／VTT 輸出。
- [ ] Metal 路徑；若 Metal 失敗，確認 CPU fallback 與日誌。
- [ ] 設定保存／重啟、取消、長音訊與輸出清理。
- [ ] 執行 `hdiutil verify`、`codesign --verify --deep --strict`、`spctl --assess --type execute`。

證據：掛載／啟動紀錄、fallback 日誌、命令輸出。ad-hoc／未公證狀態須如實記錄。

## 3. Ollama 本機 provider

環境：Ollama 0.32.5 或相容版本、`llama3.2:1b`（建議另測 `3b`）、可連線主機、人工校閱者。

- [ ] `/api/tags` 模型列表與能力探測。
- [ ] native `/api/chat` single-cue strict contract。
- [ ] 完整字幕優化，核對 cue ID／數量／順序／時間碼。
- [ ] 逐段人工檢查翻譯品質、標點與模型解說混入。
- [ ] 服務停止、重試與錯誤訊息。

格式通過不代表品質通過；保存完整 prompt／參數／原始 response。

## 3a. Whisper Base／Small 真實模型下載

固定 revision 的模型下載與雜湊可用下列命令重播；命令成功只證明檔案可下載且完整，不代表中文口說辨識品質通過。請把輸出的 JSON 與實際音訊／人工基準一併保存：

```bash
node scripts/verify-whisper-model-downloads.mjs \
  --models base,small \
  --output evidence/whisper-model-download-$(date +%Y%m%dT%H%M%S).json \
  --keep-cache --cache-dir ./evidence/whisper-model-cache
```

## 4. Groq／Gemini／Azure／OpenAI-compatible 真實端點 smoke

這是明確 opt-in 的單 cue 連線／回應格式檢查；API 金鑰只從環境變數讀取，不會寫入證據。LM Studio 仍依需求暫緩。每個 provider 分別執行並保存 JSON：

```bash
OSF_ACCEPT_EXTERNAL=1 \
OSF_PROVIDER=groq \
OSF_BASE_URL=https://api.groq.com/openai/v1 \
OSF_MODEL=<低額度測試模型> \
OSF_API_KEY=<可撤銷金鑰> \
node scripts/probe-provider-live.mjs --output evidence/provider-groq-$(date +%Y%m%dT%H%M%S).json
```

Gemini 使用其 API base URL 與模型；Azure 另設定 `OSF_DEPLOYMENT`、可選 `OSF_API_VERSION`，並確認 endpoint 不含金鑰。端點 smoke 通過不代表翻譯品質、費用或長字幕穩定性通過；仍需完成人工校閱、429／逾時／錯誤金鑰與取消測試。

## 5. 尚未納入本輪

- LM Studio：依需求方指示暫緩。
- Electron 43+／electron-builder 26+：需另開相容性分支，完成雙平台建置、IPC／renderer、原生工具與啟動回歸後再決定。
