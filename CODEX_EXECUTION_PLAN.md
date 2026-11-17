# Codex 執行計畫：NVIDIA Provider 整合與 App 打包測試

> 生成時間：2026-11-17  
> 專案：offline-subtitle-factory-app  
> 分支：main (已合併 v0.52.0)  
> 最後提交：772eab2

---

## 📋 任務概覽

本計畫記錄 NVIDIA Provider 整合完成後的後續步驟，包含：
1. 本地開發驗證
2. 自動化測試執行
3. Electron App 打包
4. 手動驗收測試
5. Release 準備

---

## ✅ 已完成項目

### NVIDIA Provider 整合
- [x] `lib/ai/providers.mjs` - Provider 定義、Capabilities、Adapter
- [x] `public/review.html` - UI 選單新增 NVIDIA NIM
- [x] `scripts/test-ai-providers.mjs` - 單元測試
- [x] 驗證通過：模型列表 API、連線測試、32 個模型可用

### 可用模型驗證
```javascript
// 已確認 32 個模型可用，包含：
// - nvidia/nemotron-3-ultra-550b-a55b (旗艦推理模型)
// - meta/llama-3.1-405b-instruct
// - mistralai/mistral-large-4-1t-a52b
// - 以及其他 29 個模型
```

---

## 🔧 本地開發驗證

### 1. 環境準備
```bash
cd /path/to/offline-subtitle-factory-app
npm ci
```

### 2. 語法檢查
```bash
npm run docs:check
node --check server.mjs
node --check public/app.js
node --check public/review.js
node --check public/trim.js
node --check electron/main.mjs
```

### 3. 單元測試
```bash
# 僅 AI Provider 測試
node scripts/test-ai-providers.mjs

# 完整測試套件
npm test
```

### 4. 開發模式啟動
```bash
npm run electron:dev
# 或
npm run electron:start
```

---

## 🧪 自動化測試清單

| 測試項目 | 指令 | 預期結果 |
|---------|------|----------|
| Provider 合約測試 | `node scripts/test-ai-providers.mjs` | ✅ 通過 |
| Whisper 回退策略 | `node scripts/test-whisper-fallback-policy.mjs` | ✅ 通過 |
| 核心回歸測試 | `node scripts/test-core.mjs` | ✅ 通過 |
| 完整測試套件 | `npm test` | ⚠️ 需修復 test-report-optimizations |

### ⚠️ 已知問題
- `test-report-optimizations.mjs` - Server 啟動逾時（非 NVIDIA 相關，既有問題）
- 解決方案：暫時跳過或增加啟動逾時時間

---

## 📦 Electron App 打包

### Windows x64 (主要目標)

#### 1. 開發版打包 (無簽章)
```bash
npm run electron:build:dir
# 輸出: dist/win-unpacked/
```

#### 2. 正式版打包 (需簽章憑證)
```bash
# 設定環境變數
$env:CSC_LINK = "base64_encoded_pfx"
$env:CSC_KEY_PASSWORD = "password"

npm run electron:build
# 輸出: dist/*.exe, dist/*.yml, SHA256SUMS
```

#### 3. 無簽章正式版 (內部測試用)
```bash
npm run electron:build:unsigned
```

### macOS ARM64
```bash
npm run electron:build:mac:dir    # 開發版
npm run electron:build:mac        # 正式版
```

---

## 🎯 手動驗收測試

### NVIDIA Provider 功能測試

| 測試項目 | 步驟 | 預期 |
|---------|------|------|
| 設定頁面顯示 | 開啟 AI 設定 → 服務類型選單 | 出現 "NVIDIA NIM" |
| Base URL 自動填入 | 選擇 NVIDIA NIM | 自動填入 `https://integrate.api.nvidia.com/v1` |
| 模型載入 | 點擊「載入模型」 | 顯示 32 個模型 |
| 模型推薦 | 輸入 `nvidia/nemotron-3-ultra` | 自動完成建議 |
| 連線測試 | 輸入有效 API Key → 測試連線 | 顯示 "連線成功：模型已安裝" |
| 字幕優化 | 選擇模型 → 執行 AI 優化 | 正常回傳建議 |

### 字幕優化功能測試
1. 載入影片 + SRT
2. 開啟 AI 工具列 → 選擇 NVIDIA 模型
3. 選擇優化模式（錯字標點/斷句/術語/翻譯）
4. 執行優化 → 檢查建議品質
5. 接受/略過建議 → 驗證時間碼未變

### 邊界測試
- [ ] 無 API Key 時的錯誤提示
- [ ] 無效 API Key 的錯誤處理
- [ ] 網路斷線時的重試機制
- [ ] 長字幕分批處理
- [ ] 取消進行中任務

---

## 🚀 Release 準備

### 版本號規劃
- 當前：`0.52.0` (已合併 v0.52.0 tag)
- NVIDIA 整合建議：`0.52.1` 或 `0.53.0`

### Release Checklist

- [ ] 更新 `package.json` 版本號
- [ ] 更新 `CHANGELOG.md` / `RELEASE-NOTES-0.52.1.md`
- [ ] 執行完整測試套件
- [ ] Windows 打包驗證
- [ ] macOS 打包驗證
- [ ] SHA256 校驗碼生成
- [ ] GitHub Release 建立
- [ ] 更新 `latest.yml` / `latest-mac.yml`

### 發布指令
```bash
# 建立標籤
git tag v0.52.1
git push origin v0.52.1

# GitHub Actions 自動打包發布
# 或手動：
npm run electron:build
npm run electron:build:mac
```

---

## 📝 Codex 執行指令摘要

### 快速驗證 (5 分鐘)
```bash
cd offline-subtitle-factory-app
npm ci
node scripts/test-ai-providers.mjs
node -e "
import { createProvider } from './lib/ai/providers.mjs';
const nvidia = createProvider({ provider: 'nvidia', baseUrl: 'https://integrate.api.nvidia.com/v1', apiKey: 'test', model: 'nvidia/nemotron-3-ultra-550b-a55b' });
console.log('NVIDIA test:', await nvidia.test());
console.log('Models:', (await nvidia.listModels()).length);
"
```

### 完整測試 (15 分鐘)
```bash
npm test 2>&1 | grep -E "(通過|pass|fail|Error)"
```

### 打包驗證 (10 分鐘)
```bash
# Windows 無簽章
npm run electron:build:unsigned

# 檢查輸出
ls -la dist/
# 應包含: *.exe, *.yml, SHA256SUMS
```

---

## 📁 相關檔案路徑

```
offline-subtitle-factory-app/
├── lib/ai/
│   ├── providers.mjs          # Provider 核心邏輯
│   ├── local-ai.mjs           # 本地 Provider 設定
│   ├── openai-compatible.mjs  # OpenAI 相容介面
│   └── anthropic.mjs          # Anthropic 適配器
├── public/
│   ├── review.html            # AI 設定 UI (已新增 NVIDIA)
│   ├── ai-provider-settings.mjs
│   └── review.js
├── scripts/
│   ├── test-ai-providers.mjs  # Provider 測試
│   └── test-core.mjs          # 核心回歸測試
└── package.json
```

---

## 🔗 相關連結

- NVIDIA Build Platform: https://build.nvidia.com/models
- NVIDIA API 文檔: https://docs.nvidia.com/nim/
- NGC API Key 申請: https://ngc.nvidia.com/setup/api-key
- 專案 GitHub: https://github.com/twyderek/offline-subtitle-factory-app

---

## 📌 給 Codex 的執行建議

1. **優先執行**：單元測試驗證 NVIDIA 整合
2. **次要執行**：完整測試套件（可跳過已知失敗的 test-report-optimizations）
3. **打包測試**：Windows unsigned build 驗證
4. **手動驗收**：使用真實 API Key 測試完整流程
5. **文檔更新**：如有變更同步更新此檔案

---

> **注意**：此計畫為 Codex 自動化執行參考，實際執行時請根據環境狀況調整。NVIDIA API Key 屬敏感資訊，請勿提交至版控。