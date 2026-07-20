import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'AGENTS.md',
  'docs/project-management/README.md',
  'docs/project-management/00-CURRENT-STATUS.md',
  'docs/project-management/01-PROJECT-GOVERNANCE.md',
  'docs/project-management/02-REQUIREMENTS-ANALYSIS.md',
  'docs/project-management/03-FUNCTIONAL-DESIGN.md',
  'docs/project-management/04-DEVELOPMENT-HISTORY.md',
  'docs/project-management/05-DEVELOPMENT-AND-DEPLOYMENT.md',
  'docs/project-management/06-TEST-AND-PROCESS-AUDIT.md',
  'docs/project-management/07-DEBUG-AND-FIX-HISTORY.md',
  'docs/project-management/08-CHANGE-LOG.md',
];

const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
let branch = 'unknown';
let status = 'unknown';
let gitWarning = '';
try {
  branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim() || '(detached)';
  status = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim() || 'clean';
} catch (error) {
  gitWarning = `Git 狀態偵測失敗：${error.message}`;
}

for (const relative of required) {
  await readFile(path.resolve(root, relative), 'utf8');
}

console.log('離線字幕工廠專案執行前檢查');
console.log(`版本：${packageJson.version}`);
console.log(`分支：${branch}`);
console.log(`Git 狀態：${status === 'clean' ? 'clean' : '有變更，請先辨識並保留既有修改'}`);
if (gitWarning) console.warn(gitWarning);
console.log('\n共通必讀文件（須完整閱讀）：');
required.forEach((file, index) => console.log(`${index + 1}. ${file}`));
console.log('\n再依任務閱讀 docs/project-management/workflows/ 的相關流程。');
console.log('開始修改前，必須先在 08-CHANGE-LOG.md 建立本次工作紀錄。');
