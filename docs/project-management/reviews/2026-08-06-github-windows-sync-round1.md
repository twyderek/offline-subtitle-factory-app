# 獨立審查報告：SYNC-024 GitHub Windows 測試修正同步

- 審查對象 commit／版本：工作樹 `170e08e17d38b4c7a9c94d3e1ba031a382539d9a`、GitHub Windows 修正 `4d0bee67886b9bb16980c02d06e900711d6358e2`、最新 `origin/main=baed6d78de236a2b482d64906dda6ec8bdd4677c`；0.48.0 本機同步測試版
- 對應 08-CHANGE-LOG 條目：2026-08-06 — GitHub Windows 測試修正同步（SYNC-024）
- 審查輪次：round1
- 審查代理啟動時間、上下文來源：2026-08-06 11:28 +08:00；獨立讀取現行差異、Git refs、治理文件、測試與兩平台 ZIP，未沿用主要代理的評價性結論。

## 1. 需求／範圍

- 判定：通過
- 證據：`docs/project-management/08-CHANGE-LOG.md:21-32` 將範圍限定為取得遠端 refs、辨識 Windows 修正、只整合相關且未重複的 Azure／OpenAI-compatible 修正、保留本地 Ollama streaming／timeout／repair、保護未提交工作樹、不發布。`git diff --quiet 170e08e 4d0bee6 -- lib/ai/providers.mjs lib/ai/subtitle-optimizer.mjs` 回傳 0，證明 Windows commit 的兩個指定檔案與本地 HEAD 完全一致，未重複套用；就 SYNC-024 相關差異而言，變更集中在選定的 `model-capabilities.mjs`、`openai-compatible.mjs`、`providers.mjs` 及對應測試／封裝同步，未把工作樹其他既有變更誤歸入本輪。

## 2. 程式正確性

- 判定：通過
- 證據：`lib/ai/model-capabilities.mjs:35-45` 將 capability probe 改為 `max_completion_tokens`；`lib/ai/providers.mjs:126-140` 的 Azure adapter 移除 `model` 與 optimizer 內部欄位，保留 deployment URL／`api-version`／`api-key`；`lib/ai/openai-compatible.mjs:136-147` 的 `stripInternalChatFields` 移除 `operation`、`output_language`、cue count／ID。既有 Windows Ollama translation／repair 仍位於本地 HEAD，未被遠端主線覆蓋；`providers.mjs:63-91,171-174` 亦保留 streaming、`num_predict`、`keep_alive` 與 retry timeout options 傳遞。工作樹 source SHA 為 model capabilities `cb5e0700d56be46ed19e5b6d09eaeeb3cf006a30bc4163c60f70de89be952de0`、OpenAI-compatible `c30669e50b04d8b54f4e69d1e23735d7adaba13da8217ef6fa47d0fc069fc705`、providers `26baeebfe374dea6aceb357805ab4e920ff138b0b35b39a3a489f08412826b7d`。

## 3. Windows 相容性

- 判定：部分通過
- 證據：變更使用 URL、JSON、`AbortController` 與 Node fetch，未新增 POSIX 路徑或 shell 依賴；Windows 測試 ZIP 內 executable 由 `file` 識別為 `PE32+ executable (GUI) x86-64, for MS Windows`。最新 Windows ZIP `unzip -t` 通過，且三個 AI runtime marker 均與工作樹一致。這只能證明封裝內容與靜態相容性；目前沒有 Windows 10／11 實機啟動、Ollama 原生 `/api/chat` translation、Azure deployment request 或安裝後 renderer 證據，Ollama／Azure 不同版本行為亦未覆蓋。

## 4. 測試充分性

- 判定：部分通過
- 證據：2026-08-06 11:29 +08:00 執行 `node --check`（三個受影響模組）、`node scripts/test-ai-providers.mjs`、`node scripts/test-ai-optimizer.mjs`、`node scripts/test-ollama-batch-stream.mjs` 均通過；contract tests 覆蓋 Azure `max_completion_tokens`／移除 `model` 與內部欄位、Ollama streaming NDJSON、chunk idle timeout、延遲 headers、translation prompt／`think:false`、redirect blocking。受控權限下完整 `npm run check` 亦通過；預設沙箱第一次執行只因 fixture listener `0.0.0.0:22093` 得到 `EPERM`，重跑並非程式失敗。缺口是沒有真實端點、Windows 實機、安裝後啟動或跨版本測試，且 OpenAI-compatible 內部欄位清理沒有獨立的專門 assertion（目前 provider contract 主要直接斷言 Azure）。

## 5. 文件／追溯性

- 判定：部分通過
- 證據：`08-CHANGE-LOG.md:25-32`、`06-TEST-AND-PROCESS-AUDIT.md:127-133`、`07-DEBUG-AND-FIX-HISTORY.md:208-215` 已記錄基準 refs、選擇性整合理由、測試、ZIP SHA 與未覆蓋的 Windows／真實 endpoint 風險；`/private/tmp/sync024-before.patch` 存在（3,294 行，SHA-256 `cca3522aafed12a08e1b33bb274e2502b2559c87f542eebf4270f0f35a63bd54`），未提交工作樹保護具可追溯證據。獨立報告建立後需由主要代理把本報告路徑與本報告逐字結論句回填 08 條目第 34 行；目前該欄仍是「待審查代理回報」，所以文件閉環尚未完成。`npm run docs:check:final` 於 2026-08-06 11:31 +08:00 通過，但不取代上述連結回填。

## 6. 交付／風險

- 判定：部分通過
- 證據：本輪未建立 Release、未推送，符合條目非正式同步版範圍。最新 macOS ZIP SHA-256 為 `c165d87d6a02c3b4f29b416cec9d79dfa64c8774db3a8e01a169164ffe324014`，Windows ZIP SHA-256 為 `e0d191eff6df14606ba46fc3a2bb366e4adbd4fbf947aed992cb522e9a6a2199`；兩包 `unzip -t` 均回報 compressed data 無錯誤，`lib/ai/model-capabilities.mjs`、`lib/ai/openai-compatible.mjs`、`lib/ai/providers.mjs` 三個 marker 均逐包與工作樹一致。交付仍只能標示本機測試版：真實 Windows Ollama／Azure、模型回應品質、安裝後生命週期與跨版本相容性未驗證。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：沒有已證實的來源重複套用、程式語法、契約 mock 或 ZIP 完整性阻擋；正式跨平台完成宣稱前，必須補 Windows 10／11 實機與真實端點證據，並完成 08-CHANGE-LOG 的獨立審查連結。
- 剩餘風險：Ollama streaming／`keep_alive`／`num_predict` 在不同 Windows Ollama 版本的行為未知；Azure `api-version`、deployment 與 GPT-5 token 欄位尚未使用真實 endpoint 驗證；OpenAI-compatible 內部欄位清理缺少獨立回歸斷言；Windows 安裝後 renderer／網路／取消／重試生命週期未實測。
- 給主要開發代理的具體修正要求：新增 OpenAI-compatible sanitized body 的 provider regression assertion；在 Windows 10／11 x64 實機以真實 Ollama 與 Azure endpoint 驗證 translation／deployment request、安裝後啟動與失敗／timeout／重試；完成後更新 08-CHANGE-LOG 連結本報告並逐字引用結論，未完成前維持「本機同步版、非正式 Release」標示。
- 可逐字引用完整結論句：**本輪 SYNC-024 獨立審查結論為有條件通過：GitHub `4d0bee6` Windows Ollama 修正與本地 HEAD `170e08e` 指定檔案 diff 為空且未重複套用，`origin/main=baed6d7` 的 Azure `max_completion_tokens`／deployment 及 OpenAI-compatible 內部欄位清理已選擇性整合；provider／optimizer／Ollama streaming focused tests、受控完整 `npm run check`、兩平台 ZIP `unzip -t`／source marker／SHA 均通過，但尚無 Windows 10／11 實機、真實 Ollama／Azure endpoint 或安裝後啟動證據，且 OpenAI-compatible 內部欄位清理缺少專門回歸斷言，因此不得宣稱 SYNC-024 已完成跨平台實機驗收或正式 Release。**

## 審查代理聲明

- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。
- 若上述聲明不實，本報告無效。
