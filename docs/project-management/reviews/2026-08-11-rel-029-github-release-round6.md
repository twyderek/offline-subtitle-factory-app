# 獨立收尾審查報告：REL-029 GitHub Release

- 審查對象：PR #8、`main`、`v0.48.1` 及公開 GitHub Release；版本 `0.48.1`。
- 對應 08-CHANGE-LOG 條目：`2026-08-11 — 0.48.1 PR 合併、tag 重指向與 GitHub Release（REL-029）`。
- 審查輪次：round6。
- 審查環境與限制：macOS arm64、Node.js `v22.22.3`；以唯讀 Git／GitHub API 核對遠端狀態，未在本輪修改產品、工作紀錄或既有報告。
- 審查時間：2026-08-11（Asia/Taipei）。

## 審查摘要

PR #8 已於 2026-08-11T06:16:48Z 合併，merge commit 為 `c8c657682c1f22e28d5eaa50261d0ca8afd197a9`；遠端 `main` 與 `v0.48.1` peeled tag 均指向同一 SHA。GitHub Release [v0.48.1](https://github.com/twyderek/offline-subtitle-factory-app/releases/tag/v0.48.1) 回報 `draft=false`、`prerelease=false`，並包含 12 項 macOS／Windows 資產及每項 GitHub SHA-256 digest。Windows Actions [run `31464263984`](https://github.com/twyderek/offline-subtitle-factory-app/actions/runs/31464263984) 為 `completed/success`，source regression、unsigned package、renderer／安裝生命週期、archive／SHA 與 artifact upload 均成功；Authenticode signed step 為 skipped，與 Release notes 的 Windows 未簽章揭露一致。仍須將已發布狀態與已接受的外部限制分開理解：Windows 10／11 實機、Base／Small 中文品質、真實 provider endpoint 及安裝後長音訊流程並未因 Release 建立而完成驗收。

## 1. 需求完整性

- 判定：通過
- 證據：
  - PR API 唯讀核對：`number=8`、`state=closed`、`merged=true`、`merge_commit_sha=c8c657682c1f22e28d5eaa50261d0ca8afd197a9`、`base_ref=main`、`head_ref=codex/release-v0.48.1`，URL 為 `https://github.com/twyderek/offline-subtitle-factory-app/pull/8`。
  - `git ls-remote origin refs/heads/main` 回報 `c8c657682c1f22e28d5eaa50261d0ca8afd197a9`；`git ls-remote --tags origin` 回報 annotated tag object `bde44d929286e0a9087a4d741c99806642047ea3` 與 peeled `v0.48.1^{}` `c8c657682c1f22e28d5eaa50261d0ca8afd197a9`。
  - Release API 回報公開、非 draft、非 prerelease，且 Release notes 明確揭露 Windows 未 Authenticode、macOS 未公證及未完成的實機／模型／provider 風險，符合 REL-029 的「發布但不誤宣稱外部驗收」需求。

## 2. 邏輯正確性

- 判定：部分通過
- 證據：
  - `main`、peeled `v0.48.1` 與 PR merge SHA 一致，版本與 Release tag 追溯閉環。
  - Release API 的 12 項資產均有名稱、大小、下載 URL 與 GitHub digest；`latest-mac.yml`／`latest.yml`、兩平台安裝包、blockmap、SHA 清單及 Windows signing status 均存在。
  - Windows run `31464263984` 的 job `Windows x64 test and package` 為 success；source regression、Prepare verified runtime、unsigned build、packaged renderer／安裝生命週期、7z archive／SHA 與 artifact upload 均 success，signed NSIS step 為 skipped。
  - CI run 的 head 是 `657f7c92f6c466d3a1f8f93c5c8686993147f6dc`，而 Release tag／main 是 `c8c6576…`；`657f7c9` 僅刪除重複 Azure contract assertion，但它未在 merge commit 內，故發布資產與 tag 的「完整來源 SHA」仍有可重播性差異，應明確記錄而不可假定完全相同。

## 3. 邊界情況

- 判定：部分通過
- 證據：
  - CI 已實測 Windows source regression、Setup／Portable packaged renderer、靜默安裝／解除安裝、archive test、SHA 產生與 artifact upload；workflow 明確將 signed step 與 unsigned preview 分支分開，且本次 signed step skipped。
  - Release notes 明確寫出 Windows 未 Authenticode、macOS 未公證，並要求使用者先核對 SHA-256；這避免將未簽章資產誤述為 signed release。
  - Base／Small 檔案完整性與首次下載機制不等於中文口說準確率、長音訊、速度或記憶體邊界；Release 也明示此限制。
  - 未覆蓋 Windows 10／11 乾淨實機、SmartScreen／捷徑／userData 權限、真實中文音訊、真實 Azure／Ollama／其他 provider 的 429／timeout／取消序列及安裝後長時間流程；LM Studio 仍依需求暫緩。

## 4. 程式碼品質

- 判定：部分通過
- 證據：
  - PR merge、tag、Release 與資產清單可由 GitHub API／Git ref 反查，Release notes 與 signing status 對未簽章邊界揭露一致。
  - Windows CI 將 source regression、封裝、安裝生命週期、archive／SHA、artifact upload 分成可辨識步驟；本次每個必要 unsigned／驗證步驟均成功。
  - 發布可追溯性仍有一項重要品質問題：run `31464263984` head `657f7c9` 與 Release tag `c8c6576` 不同；雖差異只涉及移除重複測試斷言，後續應保存資產實際 build SHA 或以 tag HEAD 重新執行並引用，避免使用者無法重建同一來源。

## 5. 測試覆蓋

- 判定：部分通過
- 證據：
  - GitHub API jobs/steps 唯讀結果：`Set up job`、checkout、Node、npm install、verified runtime、source／FFmpeg regression、unsigned build、renderer／install lifecycle、archive／SHA、artifact upload 與 cleanup 全部 success；Authenticode signed step skipped。
  - Release API 列出完整 12 項資產及 digest：
    - `latest-mac.yml` 570 bytes；`latest.yml` 380 bytes。
    - `offline-subtitle-factory-0.48.1-macos-arm64.dmg` 242,687,097 bytes；其 `.blockmap` 253,791 bytes。
    - `offline-subtitle-factory-0.48.1-macos-arm64.zip` 249,935,219 bytes；其 `.blockmap` 259,108 bytes。
    - `offline-subtitle-factory-portable-0.48.1.exe` 243,941,915 bytes；`offline-subtitle-factory-setup-0.48.1.exe` 244,649,176 bytes；Setup `.blockmap` 256,186 bytes。
    - `SHA256SUMS-macos-arm64.txt` 228 bytes；`SHA256SUMS-windows-x64.txt` 219 bytes；`SIGNING-STATUS-windows-x64.txt` 125 bytes。
  - GitHub digest 與既有四項 SHA-256 一致：DMG `8e1af746dbb30966b7e276e868f4a705bb275351139c0016a4539aa5e64ffb0d`、macOS ZIP `9acb0d3563180a3f1b11c30608459e839a044bc37d908596c730fb28268a1ab9`、Windows Setup `ecc81fbdae1dceeb7d4866b9bcc4b6b4952a414ccc3013963043cc21748cbadc`、Portable `e2f17b3fd2ff94ad6ac58fe2747cd3333dcf983da53efade122fd7f442ba9c77`。
  - 本輪核對的是 GitHub API 資產 metadata／digest 與 CI job 結果；未再下載 12 項資產至本機重算、未在 Windows 10／11 實機重播，也未做 Base／Small 中文品質或真實 provider probe，因此不能將 API 存在性解讀為完整外部驗收。

## 6. 實際運行結果

- 判定：部分通過
- 證據：
  - Release URL 可公開讀取，`draft=false`、`prerelease=false`，12 項資產均可下載 URL；Release target 為 `main`，且遠端 tag peeled SHA 與 main／merge commit 同一。
  - run `31464263984` URL、status、conclusion、head SHA 及每一步 conclusion 已由 GitHub API 唯讀核對；Windows 安裝後 renderer 與解除安裝流程在 runner 成功，但 runner 不等於使用者 Windows 10／11 實機。
  - Release notes 的已知限制與目前 REL-029 changelog 一致揭露：Windows 10／11、Base／Small 中文品質／效能、真實 provider、安裝後長音訊仍待外部驗證；Windows 未 Authenticode、macOS 未公證。
  - 本地工作樹仍有主要代理的 `README.md`／`08-CHANGE-LOG.md` 修改，本審查未改動；本報告只核對已推送的遠端 refs／Release，不把本地未提交文件狀態當成已發布來源。

## 發現分級

### 阻擋

1. **正式來源與 CI build head 未完全同 SHA。** Release／tag／main 為 `c8c6576…`，Windows run `31464263984` 建置 head 為 `657f7c9…`；雖僅有測試斷言差異，仍應補一份以 tag HEAD 建置或保存資產來源對應的可重播證據。
2. **外部品質驗收仍未完成。** Windows 10／11 實機、Base／Small 中文口說品質、真實 provider endpoint 及安裝後長音訊流程都未由本輪或 CI 證明；Release notes 已揭露且需求方已接受，不可因此改寫成已驗收。

### 重要

1. Windows signed NSIS step 為 skipped，Release 是未 Authenticode 的 unsigned preview；macOS 亦未公證，使用者需依 SHA-256 核對。
2. Release API digest 證明 GitHub 儲存資產的內容摘要，但本輪未重新下載資產、驗證 updater metadata 內 URL／size／SHA-512 或重跑 7z／解壓，仍保留發布後下載核對缺口。
3. Base／Small model evidence 仍是固定檔案完整性，不代表中文口說準確率或一般電腦效能；provider contract smoke 不代表真實 endpoint／人工翻譯品質。

### 建議

1. 以 `v0.48.1` tag HEAD `c8c6576…` 重新跑同一 Windows workflow，或在 evidence 明確記錄 run `31464263984` 的 `657f7c9…` 為資產來源並確認差異僅限測試檔。
2. 由需求方或測試人員在 Windows 10／11 乾淨機完成 Setup／Portable、SmartScreen、userData、離線、Base／Small 中文長音訊與解除安裝 smoke，保存字幕、速度／記憶體與畫面／事件證據。
3. 對 Azure／Ollama／其他 provider 以可撤銷低額度憑證完成真實 endpoint、429／timeout／取消與人工品質驗收；發布後再下載 12 項資產反算 SHA／metadata。

## 綜合判定

- 結論：有條件通過
- 阻擋問題（若有）：REL-029 的 PR merge、main／peeled tag、公開非 draft/non-prerelease Release、12 項資產、GitHub digest 與 Windows run `31464263984` 均已核對成功；但 CI head `657f7c9` 與 Release tag `c8c6576` 不同，且 Windows 10／11 實機、Base／Small 中文品質、真實 provider／音訊、安裝後長音訊與發布後本機下載重算仍未完成。需求方已在 REL-029 授權中接受已揭露外部風險，但接受不應被改寫為測試通過。
- 剩餘風險：unsigned Windows／未公證 macOS、CI build head 與 tag 的可重播差異、發布後下載／updater metadata 反向核對、Windows 實機、Base／Small 中文品質／效能、真實 provider endpoint 與安裝後長音訊流程。
- 給主要開發代理的具體修正要求（若有）：在 REL-029 changelog 引用本報告完整判定句，記錄 run `31464263984` 與 `657f7c9`／`c8c6576` 的差異及其僅限測試檔的事實；若要消除來源差異，從 tag HEAD 重跑 Windows workflow 並更新受影響資產／Release metadata。維持 Release notes 的未簽章、未公證及未實機限制揭露。
- 可逐字引用完整結論句：**REL-029 round6 獨立六面向收尾審查結論為有條件通過：PR #8 已合併至 main 的 c8c657682c1f22e28d5eaa50261d0ca8afd197a9、遠端 v0.48.1 peeled tag 與該 SHA 一致，公開非 draft／非 prerelease Release 已提供 12 項 macOS／Windows 安裝檔、blockmap、updater metadata、SHA 清單及 Windows signing status，Windows run 31464263984 亦已成功完成 source regression、unsigned package、Setup／Portable renderer、安裝生命週期、archive／SHA 與 artifact upload；但該 run 的 build head 657f7c9 與 Release tag c8c6576 不同，且 Windows 10／11 實機、Base／Small 中文口說品質、真實 provider／音訊、安裝後長音訊及發布後本機資產反向核對仍未完成，因此本輪確認 GitHub 來源與公開候選資產已交付並如實揭露限制，不構成上述外部品質驗收已完成或簽章／公證正式版保證。**

## 審查代理聲明

本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。

本報告明確區分 PR／main／tag／Release 的遠端交付證據、Windows CI runner 證據、GitHub 資產 metadata／digest，以及尚未完成的 Windows 實機、模型品質、真實 provider、安裝後與發布後本機核對，不以公開 Release 或 CI 綠燈冒充完整外部驗收。

若上述聲明不實，本報告無效。
