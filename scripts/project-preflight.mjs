import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = [
  'AGENTS.md',
  'docs/project-management/README.md',
  'docs/project-management/00-CURRENT-STATUS.md',
  'docs/project-management/08-CHANGE-LOG.md（只讀範本規則與最新條目）',
];
const routes = {
  general: ['docs/project-management/workflows/07-DOCUMENT-CLOSEOUT.md'],
  governance: ['docs/project-management/01-PROJECT-GOVERNANCE.md', 'docs/project-management/06-TEST-AND-PROCESS-AUDIT.md', 'docs/project-management/09-STANDING-AUTHORIZATIONS.md', 'docs/project-management/workflows/03-TEST-VALIDATION.md', 'docs/project-management/workflows/04-INDEPENDENT-REVIEW.md', 'docs/project-management/workflows/07-DOCUMENT-CLOSEOUT.md'],
  requirements: ['docs/project-management/02-REQUIREMENTS-ANALYSIS.md', 'docs/project-management/workflows/01-REQUIREMENT-CHANGE.md', 'docs/project-management/workflows/04-INDEPENDENT-REVIEW.md', 'docs/project-management/workflows/07-DOCUMENT-CLOSEOUT.md'],
  development: ['docs/project-management/02-REQUIREMENTS-ANALYSIS.md', 'docs/project-management/03-FUNCTIONAL-DESIGN.md', 'docs/project-management/06-TEST-AND-PROCESS-AUDIT.md', 'docs/project-management/workflows/02-DEVELOPMENT.md', 'docs/project-management/workflows/03-TEST-VALIDATION.md', 'docs/project-management/workflows/04-INDEPENDENT-REVIEW.md', 'docs/project-management/workflows/07-DOCUMENT-CLOSEOUT.md'],
  debug: ['docs/project-management/03-FUNCTIONAL-DESIGN.md', 'docs/project-management/06-TEST-AND-PROCESS-AUDIT.md', 'docs/project-management/07-DEBUG-AND-FIX-HISTORY.md', 'docs/project-management/workflows/03-TEST-VALIDATION.md', 'docs/project-management/workflows/04-INDEPENDENT-REVIEW.md', 'docs/project-management/workflows/05-DEBUG-FIX.md', 'docs/project-management/workflows/07-DOCUMENT-CLOSEOUT.md'],
  release: ['docs/project-management/01-PROJECT-GOVERNANCE.md', 'docs/project-management/05-DEVELOPMENT-AND-DEPLOYMENT.md', 'docs/project-management/06-TEST-AND-PROCESS-AUDIT.md', 'docs/project-management/09-STANDING-AUTHORIZATIONS.md', 'docs/project-management/workflows/03-TEST-VALIDATION.md', 'docs/project-management/workflows/04-INDEPENDENT-REVIEW.md', 'docs/project-management/workflows/06-BUILD-RELEASE.md', 'docs/project-management/workflows/07-DOCUMENT-CLOSEOUT.md'],
};
routes.full = ['docs/project-management/01-PROJECT-GOVERNANCE.md', 'docs/project-management/02-REQUIREMENTS-ANALYSIS.md', 'docs/project-management/03-FUNCTIONAL-DESIGN.md', 'docs/project-management/04-DEVELOPMENT-HISTORY.md', 'docs/project-management/05-DEVELOPMENT-AND-DEPLOYMENT.md', 'docs/project-management/06-TEST-AND-PROCESS-AUDIT.md', 'docs/project-management/07-DEBUG-AND-FIX-HISTORY.md', 'docs/project-management/09-STANDING-AUTHORIZATIONS.md', ...Array.from({ length: 7 }, (_, index) => `docs/project-management/workflows/0${index + 1}-${['REQUIREMENT-CHANGE', 'DEVELOPMENT', 'TEST-VALIDATION', 'INDEPENDENT-REVIEW', 'DEBUG-FIX', 'BUILD-RELEASE', 'DOCUMENT-CLOSEOUT'][index]}.md`)];

const typeArg = process.argv.find((arg) => arg.startsWith('--type='));
const type = typeArg?.slice(7) || 'general';
if (!routes[type]) {
  console.error(`未知任務類型：${type}；可用：${Object.keys(routes).join(', ')}`);
  process.exit(2);
}
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const actualFiles = [...core.map((file) => file.replace(/（.*$/, '')), ...routes[type]];
await Promise.all([...new Set(actualFiles)].map((file) => readFile(path.resolve(root, file), 'utf8')));
let branch = 'unknown';
let dirty = true;
try {
  branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim() || '(detached)';
  dirty = Boolean(execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim());
} catch {}

console.log('離線字幕工廠專案執行前檢查');
console.log(`任務類型：${type}`);
console.log(`版本：${packageJson.version}`);
console.log(`分支：${branch}`);
console.log(`Git 狀態：${dirty ? '有變更，請辨識並保留既有修改' : 'clean'}`);
console.log('\n固定核心（每次必讀）：');
core.forEach((file, index) => console.log(`${index + 1}. ${file}`));
console.log('\n任務路由（本次額外必讀）：');
routes[type].forEach((file, index) => console.log(`${index + 1}. ${file}`));
console.log('\n建立 08-CHANGE-LOG 最新工作條目後才開始修改；歷史文件只在需要追溯時讀取。');
