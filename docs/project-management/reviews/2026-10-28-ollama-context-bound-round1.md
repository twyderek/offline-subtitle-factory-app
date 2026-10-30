# 獨立審查報告：BUG-059 Ollama native request context resource bound

- 審查對象 commit／版本：目前工作樹（dirty，專案版本 `0.52.0`）；本輪只審查 `lib/ai/providers.mjs` 的 Ollama-only `num_ctx=4096`、`scripts/test-ai-providers.mjs` regression、03／06／07／08 文件與指定 evidence。
- 對應 08-CHANGE-LOG 條目：2026-10-28 — Ollama native request context 過大造成 3B product flow stall（BUG-059）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-10-28T03:10:19+00:00；使用本輪獨立審查上下文，重新讀取 `AGENTS.md`、`docs/project-management/README.md`、最新 08、00、03、06、07，以及 debug／test／independent-review／closeout workflows；依目前工作樹、source、測試輸出與 evidence 判定，未以主要代理的結論取代核對。

## 1. 需求完整性

- 判定：通過
- 證據：FR-021 要求本機 LLM 的 loopback 支援與嚴格 cue 契約，並在 `docs/project-management/02-REQUIREMENTS-ANALYSIS.md:37` 明確保留「不自動下載模型」與端到端驗證邊界；BUG-059 的最新條目 `docs/project-management/08-CHANGE-LOG.md:3-18` 將本輪範圍精確限定為 Ollama native `/api/chat` request 的 request-level `num_ctx=4096`、其他 provider 邊界、3B bounded/product evidence，不修改 daemon、全域設定、模型檔、batch／timeout／retry、cue contract、UI、Windows、LM Studio 或發布。`docs/project-management/03-FUNCTIONAL-DESIGN.md:151`、`docs/project-management/06-TEST-AND-PROCESS-AUDIT.md:3-9`、`docs/project-management/07-DEBUG-AND-FIX-HISTORY.md:3-9` 的範圍與不宣稱所有模型／硬體的措辭一致。

## 2. 邏輯正確性

- 判定：通過
- 證據：`lib/ai/providers.mjs:50-54` 定義固定常數並只在原生 port `11434` 進入 Ollama native path；`lib/ai/providers.mjs:63-103` 的 `/api/chat` body 在既有 `temperature`／`num_predict`／stream／format／keep-alive 旁加入 `options.num_ctx=OLLAMA_REQUEST_CONTEXT_TOKENS`，未改 strict stream、repair、retry 或 cue schema。`scripts/test-ai-providers.mjs:112-124` 實際斷言 native endpoint、stream、`num_predict=512`、`num_ctx=4096` 與 cue bound；focused test 於 2026-10-28T03:10:45Z exit 0。這是 request-local bound，不是 daemon 或全域設定變更。

## 3. 邊界情況

- 判定：部分通過
- 證據：`scripts/test-ai-providers.mjs:58-74` 直接斷言非 Ollama provider 不帶 `options.num_ctx`；同檔 `:107-110` 保留 Ollama／LM Studio loopback 無 API Key 邊界。另以唯讀 fake-fetch probe（2026-10-28T03:11Z）實際核對 `ollama` 的 `127.0.0.1:11435/v1` fallback、`lm-studio` `:1234/v1` 與遠端 `openai-compatible`：三者 request body 的 `options.num_ctx` 均為 `undefined`，而 native `:11434` 由 focused regression 固定為 `4096`。`docs/project-management/03-FUNCTIONAL-DESIGN.md:147,151` 也記錄自訂 loopback port 可保存，以及本 bound 只屬 native request。剩餘邊界未被本輪測試覆蓋：長 prompt／大量文字、模型本身 context 小於或需要大於 4096、不同模型／版本與不同硬體；固定 cap 可能造成截斷、品質下降或 backend rejection，不能推論為普遍最佳值。

## 4. 程式碼品質

- 判定：通過
- 證據：變更以命名常數 `OLLAMA_REQUEST_CONTEXT_TOKENS` 集中表達，且只進入 Ollama native body；`lib/ai/providers.mjs:118-137` 的其他 provider adapter 未被加入該欄位。`git diff --check` 於 2026-10-28T03:10:45Z exit 0。工作樹雖有既有 BUG-058 source dirty diff，但本輪沒有修改 `lib/ai/openai-compatible.mjs`，也沒有修改既有 BUG-058 review。

## 5. 測試覆蓋

- 判定：通過
- 證據：本輪實際執行並取得 exit 0：`node scripts/test-ai-providers.mjs`（03:10:45Z，含 Ollama body 與非 Ollama boundary）、`node scripts/test-ollama-batch-stream.mjs`（03:10:45Z）、`node scripts/test-ai-optimizer.mjs`（03:10:45Z）、`npm run check`（03:10:45Z–03:11:06Z，治理檢查、syntax、完整 npm test 與 YouTube posttest）、`git diff --check`（03:10:45Z）及 `node scripts/test-project-docs-validator.mjs`（03:10:45Z）。此外，validator 測試實際覆蓋六標題、完整結論句、逐字引用、多輪 review、發布欄位與條件接受格式；本輪未以 live second Ollama、模型下載或 OS 網路變更代替 deterministic regression。

## 6. 實際運行結果

- 判定：通過
- 證據：指定 evidence `docs/project-management/evidence/2026-10-28-ollama-llama3.2-3b-product-offline-replay2.json:1-69` 為 `schema=offline-subtitle-factory.ollama-product-offline-acceptance.v1`、`darwin/arm64`、`ollama`、`llama3.2:3b`、`status=pass`；`productFlow` 顯示 job created／AI completed、2 suggestions、0 retries、接受 2、undo／redo 各 2、雙語 review saved、2 cues、timecodes unchanged、source SRT preserved 且 before／after SHA-256 相同（`:36-62`）。隔離證據顯示 macOS Seatbelt loopback-only、外連 socket `EPERM`、product server 繼承隔離（`:17-27,61`）；daemon 顯示模型預裝、未下載且已停止（`:29-35`），cleanup 顯示 temporary root removed、daemon stopped、port closed（`:64-68`）。本證據的 `systemNetworkDisabled=false`，所以只證明受控 acceptance 子程序，不是全機斷網。

  原始 FR-021 replay1 fail evidence `docs/project-management/evidence/2026-10-28-ollama-llama3.2-3b-product-offline-replay1.json:1-47` 仍保留：`status=fail`、`failureStage=product_probe`、`failureCode=MODEL_RESPONSE_CONTRACT_REJECTED`（`:11-16,36-40`），但其 Seatbelt／EPERM／預裝／未下載／cleanup 欄位仍完整（`:17-45`）。本輪檢查前 SHA-256 為 `23df12b43a3866713cc965fde1e40b48482fc2717ee394d755eae89ebf170cbb`；replay2 SHA-256 為 `ce9854795398b7130d57b6cf4f8091cd051100ec7e6c2a32b362d9bfb9a0694a`。本審查未啟動第二次 Ollama、未下載／停止模型、未修改 OS 網路；既有 BUG-058 source／round1／round2 review 檔案均未被本輪修改。

## 綜合判定

- 結論：有條件通過
- 可逐字引用的完整結論句：**本輪 BUG-059 獨立審查結論為有條件通過：Ollama native `/api/chat` 的 request-local `num_ctx=4096` 已以 source、Ollama-only body regression、其他 provider／非 native port 邊界 probe、完整 deterministic regression 及 3B macOS arm64 Seatbelt product replay2 核對，且 replay1 的 `MODEL_RESPONSE_CONTRACT_REJECTED` fail evidence 與 BUG-058 source／reviews 均保留未修改；條件僅為主要代理在 `08-CHANGE-LOG.md` 同步本報告連結與本句逐字引用、記錄發布不適用並重跑 `npm run docs:check:final`。本結論不等於 4096 適用所有模型／硬體或長 prompt，也不等於 Electron UI、Windows、真正全機斷網或 FR-021 全部驗收。**
- 阻擋問題（若有）：目前沒有需要主要代理修改 source／test 的產品邏輯阻擋；唯一治理結案條件是上列 08 link／逐字 quote／發布不適用同步及 `npm run docs:check:final` 成功。完成該條件前，BUG-059 不應在 08 標為完成。
- 剩餘風險：`num_ctx=4096` 是目前 8 GiB macOS arm64、`llama3.2:3b` 受控流程的 resource-bound 預設，不是所有模型、量化、硬體或長字幕 prompt 的效能／品質保證；source 沒有本輪新增的 prompt token fit guard 或依模型 context 動態調整。自訂 Ollama port 會沿用既有 OpenAI-compatible fallback，故不會取得 native `num_ctx`；若日後要求所有自訂 Ollama port 都有同一 resource bound，須另立明確 scope。replay2 仍不涵蓋 Electron UI、取消／續跑、Windows、真正全機斷網或 FR-021 全部驗收；LM Studio 仍依目前政策為相容性／歷史範圍。
- 給主要開發代理的具體修正要求（若有）：只需完成治理 closeout：在 BUG-059 最新 08 條目標示本報告路徑 `docs/project-management/reviews/2026-10-28-ollama-context-bound-round1.md`，逐字採用上列完整結論句，記錄發布授權不適用，保留 replay1／replay2 與 BUG-058 source／reviews 原件，然後重跑 `npm run docs:check:final`。不得把本報告或 replay2 擴大為所有模型／硬體、Electron UI、Windows、全機斷網或 FR-021 完整通過。

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
