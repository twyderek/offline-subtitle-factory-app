import assert from 'node:assert/strict';
import { latestReviewReference, validateLatestEntry, validateReviewReport } from './project-docs-validator.mjs';

const path = 'docs/project-management/reviews/2026-07-20-governance-round2.md';
const report = `# 獨立審查報告\n## 1. 需求完整性\n- 判定：通過\n- 證據：檔案 a.md:1 與指令測試均通過，證據內容足以回溯。\n## 2. 邏輯正確性\n- 判定：通過\n- 證據：檔案 a.md:2 與指令測試均通過，證據內容足以回溯。\n## 3. 邊界情況\n- 判定：通過\n- 證據：空值、錯誤路徑及邊界輸入均已執行並通過。\n## 4. 程式碼品質\n- 判定：通過\n- 證據：語法、結構及差異檢查均已執行並通過。\n## 5. 測試覆蓋\n- 判定：通過\n- 證據：正向與負向案例均已實際執行並通過驗證。\n## 6. 實際運行結果\n- 判定：通過\n- 證據：實際執行 docs check 與完整測試，結果均為通過。\n## 綜合判定\n- 結論：通過\n- 可逐字引用的完整結論句：**本輪獨立審查結論為通過，所有治理規則與測試均符合需求。**\n- 阻擋問題（若有）：無\n## 審查代理聲明\n- 本審查代理除建立本報告外，僅執行讀取、指令執行與驗證，未修改任何其他專案檔案。\n- 若上述聲明不實，本報告無效。`;
const base = `## 2026-07-20 — fixture\n- 狀態：完成\n- 變更等級：中\n- 實際修改：驗證「待確認／待執行」敘述不應誤判\n- 獨立審查是否執行：是\n- 獨立審查結論：\n  - 審查檔案：\`${path}\`\n  - 判定（逐字引用審查檔案結論句）：**本輪獨立審查結論為通過，所有治理規則與測試均符合需求。**\n- 發布授權：不適用\n- 遺留風險與後續事項：無。`;
assert.deepEqual(validateLatestEntry(base, report), []);
assert(validateLatestEntry(base.replace('- 遺留風險與後續事項：無。', '- 遺留風險與後續事項：待執行獨立審查'), report).some((error) => error.includes('待執行')));
assert(validateReviewReport(report.replace('- 證據：檔案 a.md:1 與指令測試均通過，證據內容足以回溯。', '- 證據：'), path).errors.length);
assert(validateReviewReport(report, 'docs/project-management/reviews/bad.md').errors.length);
assert(validateLatestEntry(base.replace('變更等級：中', '變更等級：低').replace('獨立審查是否執行：是', '獨立審查是否執行：否'), '').length);
const misplaced = base.replace('變更等級：中', '變更等級：發布').replace('- 發布授權：不適用', '- 發布授權：\n  - 是否需要：是\n- 核准人／角色：產品負責人\n- 核准時間：2026-07-20\n- 核准範圍：同意未簽章發布');
assert(validateLatestEntry(misplaced, report).some((error) => error.includes('核准人')));
const riskMissing = base.replace('變更等級：中', '變更等級：發布').replace('- 發布授權：不適用', '- 發布授權：\n  - 是否需要：是\n  - 核准人／角色：產品負責人\n  - 核准時間：2026-07-20T11:00+08:00\n  - 核准範圍：同意一般發布').replace('- 實際修改：', '- 實際修改：未簽章；');
assert(validateLatestEntry(riskMissing, report).some((error) => error.includes('風險「未簽章」')));
const genericAuth = riskMissing.replace('核准範圍：同意一般發布', '核准範圍：使用者要求發布').replace('未簽章；', '');
assert(validateLatestEntry(genericAuth, report).some((error) => error.includes('不能只記錄')));
for (const wording of ['需求方要求進行發布。', '需求方提出發布要求。', '需求方要求進行發布後提供下載']) {
  assert(validateLatestEntry(genericAuth.replace('使用者要求發布', wording), report).some((error) => error.includes('不能只記錄')));
}
const explicitAuth = genericAuth.replace('使用者要求發布', '產品負責人核准對外發布');
assert(!validateLatestEntry(explicitAuth, report).some((error) => error.includes('不能只記錄')));
for (const wording of ['不同意發布', '未核准發布', '不接受未簽章發布']) {
  assert(validateLatestEntry(genericAuth.replace('使用者要求發布', wording), report).some((error) => error.includes('必須明確記錄')));
}
const mixedRisk = riskMissing.replace('核准範圍：同意一般發布', '核准範圍：同意未簽章、未實機測試發布，但未公證風險拒絕接受').replace('實際修改：未簽章；', '實際修改：未簽章、未公證、未實機測試；');
assert(validateLatestEntry(mixedRisk, report).some((error) => error.includes('必須明確記錄')));
const allRisksAccepted = mixedRisk.replace('但未公證風險拒絕接受', '並接受未公證風險');
assert(!validateLatestEntry(allRisksAccepted, report).some((error) => error.includes('發布授權')));
const round1 = base.replace(path, 'docs/project-management/reviews/2026-07-20-governance-round1.md').replace('本輪獨立審查結論為通過，所有治理規則與測試均符合需求。', 'round1 的完整不通過結論句，內容長度足夠驗證。');
const multi = `${round1}\n  - round2 審查檔案：\`${path}\`\n  - round2 判定（逐字引用審查檔案結論句）：**本輪獨立審查結論為通過，所有治理規則與測試均符合需求。**`;
assert.equal(latestReviewReference(multi).round, 2);
const conditional = report.replace('- 結論：通過', '- 結論：有條件通過');
const staleAcceptance = multi.replace('round1 的完整不通過結論句，內容長度足夠驗證。', 'round1 的完整不通過結論句，內容長度足夠驗證。**\n  - 條件是否已被需求方接受：是\n  - filler：**').replace('round2 判定', '條件是否已被需求方接受：否\n  - round2 判定');
assert(validateLatestEntry(staleAcceptance, conditional).some((error) => error.includes('該輪條件')));
const failedReport = report.replace('- 結論：通過', '- 結論：不通過');
assert(validateLatestEntry(base, failedReport).some((error) => error.includes('不通過')));
console.log('治理文件驗證器測試通過：保留字、報告結構、多輪結論、跳過授權、欄位錯置與逐項發布風險');
