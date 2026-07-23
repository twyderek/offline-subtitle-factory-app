import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { latestReviewReference, validateLatestEntry, validateReviewReport } from './project-docs-validator.mjs';
import { validateStandingAuthorization } from './standing-authorization-validator.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = {
  'AGENTS.md': ['任務開始', '獨立上下文審查代理', 'docs:check:final'],
  'docs/project-management/README.md': ['精簡必讀與任務路由', '每次改版的固定流程', '文件更新責任矩陣'],
  'docs/project-management/00-CURRENT-STATUS.md': ['現行版本', '已知風險與未覆蓋項目'],
  'docs/project-management/01-PROJECT-GOVERNANCE.md': ['角色與責任', '階段關卡', '禁止事項', '審查證據獨立化', '發布授權（強制）', '待確認'],
  'docs/project-management/02-REQUIREMENTS-ANALYSIS.md': ['FR-001', 'NFR-001', '需求變更規則'],
  'docs/project-management/03-FUNCTIONAL-DESIGN.md': ['系統邊界', '主要模組', '核心流程'],
  'docs/project-management/04-DEVELOPMENT-HISTORY.md': ['0.45.1', '歷史文件使用原則'],
  'docs/project-management/05-DEVELOPMENT-AND-DEPLOYMENT.md': ['本機驗證', 'Windows runtime 與打包', 'GitHub 發布清單'],
  'docs/project-management/06-TEST-AND-PROCESS-AUDIT.md': ['測試層級', '六面向獨立審查', '未覆蓋證據'],
  'docs/project-management/07-DEBUG-AND-FIX-HISTORY.md': ['BUG-001', 'BUG-008', '新缺陷處理'],
  'docs/project-management/08-CHANGE-LOG.md': ['紀錄範本', '變更等級', '執行前已讀', '獨立審查是否執行', '審查檔案', '發布授權'],
  'docs/project-management/09-STANDING-AUTHORIZATIONS.md': ['AUTH-2026-07-23-01', '未簽章', '未公證', '明確排除', '撤銷方式'],
  'docs/project-management/workflows/01-REQUIREMENT-CHANGE.md': ['輸入', '步驟', '輸出', '停止條件'],
  'docs/project-management/workflows/02-DEVELOPMENT.md': ['輸入', '步驟', '輸出', '停止條件'],
  'docs/project-management/workflows/03-TEST-VALIDATION.md': ['輸入', '步驟', '輸出', '停止條件'],
  'docs/project-management/workflows/04-INDEPENDENT-REVIEW.md': ['輸入', '審查證據獨立化規則', '獨立審查檔案格式', '步驟', '輸出', '停止條件'],
  'docs/project-management/workflows/05-DEBUG-FIX.md': ['輸入', '步驟', '輸出', '停止條件'],
  'docs/project-management/workflows/06-BUILD-RELEASE.md': ['輸入', '步驟', '輸出', '停止條件'],
  'docs/project-management/workflows/07-DOCUMENT-CLOSEOUT.md': ['輸入', '步驟', '輸出', '停止條件'],
};

const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const errors = [];

for (const [relative, markers] of Object.entries(files)) {
  let content = '';
  try {
    content = await readFile(path.resolve(root, relative), 'utf8');
  } catch (error) {
    errors.push(`${relative}: 無法讀取 (${error.code || error.message})`);
    continue;
  }
  if (content.trim().length < 80) errors.push(`${relative}: 內容過短`);
  for (const marker of markers) {
    if (!content.includes(marker)) errors.push(`${relative}: 缺少必要內容「${marker}」`);
  }
}

const currentStatus = await readFile(path.join(root, 'docs/project-management/00-CURRENT-STATUS.md'), 'utf8');
if (!currentStatus.includes(`現行版本：${packageJson.version}`)) {
  errors.push(`00-CURRENT-STATUS.md 的現行版本未與 package.json ${packageJson.version} 同步`);
}
const standingAuthorization = await readFile(path.join(root, 'docs/project-management/09-STANDING-AUTHORIZATIONS.md'), 'utf8');
errors.push(...validateStandingAuthorization(standingAuthorization));

const changeLog = await readFile(path.join(root, 'docs/project-management/08-CHANGE-LOG.md'), 'utf8');
if (!/^## \d{4}-\d{2}-\d{2} — /m.test(changeLog)) {
  errors.push('08-CHANGE-LOG.md 沒有任何具日期的工作紀錄');
}

if (process.argv.includes('--final')) {
  const entries = [...changeLog.matchAll(/^## \d{4}-\d{2}-\d{2} — .*$(?:\n(?!## ).*)*/gm)];
  const latest = entries[0]?.[0] || '';
  for (const marker of ['- 變更等級：', '- 獨立審查是否執行：', '- 發布授權：']) {
    if (!latest.includes(marker)) errors.push(`最新工作紀錄缺少必要欄位「${marker.slice(2)}」`);
  }
  const reference = latestReviewReference(latest);
  const reviewPath = reference?.path;
  let review = '';
  if (reviewPath) {
    const pathErrors = validateReviewReport('', reviewPath).errors.filter((error) => error.includes('檔案名稱'));
    if (pathErrors.length) errors.push(...pathErrors);
    else {
      try {
        review = await readFile(path.resolve(root, reviewPath), 'utf8');
      } catch (error) {
        errors.push(`無法讀取獨立審查檔案 ${reviewPath} (${error.code || error.message})`);
      }
    }
  }
  errors.push(...validateLatestEntry(latest, review));
}

if (errors.length) {
  console.error('專案治理文件檢查失敗：');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`專案治理文件檢查通過：${Object.keys(files).length} 個文件，版本 ${packageJson.version}${process.argv.includes('--final') ? '，最新紀錄已結案' : ''}`);
