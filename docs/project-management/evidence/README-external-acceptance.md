# 外部驗收證據保存規範

## 命名

格式：`YYYY-MM-DD-<platform>-<area>-<result>.<ext>`

範例：

- `2026-08-01-win11-setup-install-pass.md`
- `2026-08-01-macos12-metal-fallback-blocked.md`
- `2026-08-01-ollama-llama3.2-1b-contract-fail.json`

## 每筆證據必填

- 執行日期與時區
- OS、版本、架構與硬體
- 應用版本與資產檔名
- 驗收項目編號／名稱
- 執行者
- 結果：`pass`、`fail` 或 `blocked`
- 實際命令與精簡輸出
- 截圖／錄影／原始輸出路徑
- 已知限制與後續事項

## 敏感資訊

- API key、access token、Cookie、私人路徑與個資一律遮罩。
- 不提交 `.env`、金鑰檔、完整 Authorization header 或未遮罩的服務回應。
- 若需保存 provider 回應，先移除 prompt 中的私人內容與帳號識別資訊。

## 結果規則

- `pass` 必須有可重現步驟與證據路徑。
- `fail` 必須記錄實際錯誤、影響與重現條件。
- `blocked` 只用於環境／權限／服務不可用，並記錄阻塞原因；不得當作通過。
- Checklist 未完成項目保持未勾選，不以文字敘述取代證據。
