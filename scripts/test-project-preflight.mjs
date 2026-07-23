import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';

const run = (type) => execFileSync(process.execPath, ['scripts/project-preflight.mjs', `--type=${type}`], { encoding: 'utf8' });
const parseList = (output, heading, nextHeading) => output.split(`${heading}\n`)[1].split(nextHeading)[0].trim().split('\n').map((line) => line.replace(/^\d+\. /, ''));
const core = ['AGENTS.md', 'docs/project-management/README.md', 'docs/project-management/00-CURRENT-STATUS.md', 'docs/project-management/08-CHANGE-LOG.md（只讀範本規則與最新條目）'];
const routes = {
  general: ['docs/project-management/workflows/07-DOCUMENT-CLOSEOUT.md'],
  governance: ['docs/project-management/01-PROJECT-GOVERNANCE.md', 'docs/project-management/06-TEST-AND-PROCESS-AUDIT.md', 'docs/project-management/09-STANDING-AUTHORIZATIONS.md', 'docs/project-management/workflows/03-TEST-VALIDATION.md', 'docs/project-management/workflows/04-INDEPENDENT-REVIEW.md', 'docs/project-management/workflows/07-DOCUMENT-CLOSEOUT.md'],
  requirements: ['docs/project-management/02-REQUIREMENTS-ANALYSIS.md', 'docs/project-management/workflows/01-REQUIREMENT-CHANGE.md', 'docs/project-management/workflows/04-INDEPENDENT-REVIEW.md', 'docs/project-management/workflows/07-DOCUMENT-CLOSEOUT.md'],
  development: ['docs/project-management/02-REQUIREMENTS-ANALYSIS.md', 'docs/project-management/03-FUNCTIONAL-DESIGN.md', 'docs/project-management/06-TEST-AND-PROCESS-AUDIT.md', 'docs/project-management/workflows/02-DEVELOPMENT.md', 'docs/project-management/workflows/03-TEST-VALIDATION.md', 'docs/project-management/workflows/04-INDEPENDENT-REVIEW.md', 'docs/project-management/workflows/07-DOCUMENT-CLOSEOUT.md'],
  debug: ['docs/project-management/03-FUNCTIONAL-DESIGN.md', 'docs/project-management/06-TEST-AND-PROCESS-AUDIT.md', 'docs/project-management/07-DEBUG-AND-FIX-HISTORY.md', 'docs/project-management/workflows/03-TEST-VALIDATION.md', 'docs/project-management/workflows/04-INDEPENDENT-REVIEW.md', 'docs/project-management/workflows/05-DEBUG-FIX.md', 'docs/project-management/workflows/07-DOCUMENT-CLOSEOUT.md'],
  release: ['docs/project-management/01-PROJECT-GOVERNANCE.md', 'docs/project-management/05-DEVELOPMENT-AND-DEPLOYMENT.md', 'docs/project-management/06-TEST-AND-PROCESS-AUDIT.md', 'docs/project-management/09-STANDING-AUTHORIZATIONS.md', 'docs/project-management/workflows/03-TEST-VALIDATION.md', 'docs/project-management/workflows/04-INDEPENDENT-REVIEW.md', 'docs/project-management/workflows/06-BUILD-RELEASE.md', 'docs/project-management/workflows/07-DOCUMENT-CLOSEOUT.md'],
  full: ['docs/project-management/01-PROJECT-GOVERNANCE.md', 'docs/project-management/02-REQUIREMENTS-ANALYSIS.md', 'docs/project-management/03-FUNCTIONAL-DESIGN.md', 'docs/project-management/04-DEVELOPMENT-HISTORY.md', 'docs/project-management/05-DEVELOPMENT-AND-DEPLOYMENT.md', 'docs/project-management/06-TEST-AND-PROCESS-AUDIT.md', 'docs/project-management/07-DEBUG-AND-FIX-HISTORY.md', 'docs/project-management/09-STANDING-AUTHORIZATIONS.md', 'docs/project-management/workflows/01-REQUIREMENT-CHANGE.md', 'docs/project-management/workflows/02-DEVELOPMENT.md', 'docs/project-management/workflows/03-TEST-VALIDATION.md', 'docs/project-management/workflows/04-INDEPENDENT-REVIEW.md', 'docs/project-management/workflows/05-DEBUG-FIX.md', 'docs/project-management/workflows/06-BUILD-RELEASE.md', 'docs/project-management/workflows/07-DOCUMENT-CLOSEOUT.md'],
};
for (const [type, expectedRoute] of Object.entries(routes)) {
  const output = run(type);
  assert.deepEqual(parseList(output, '固定核心（每次必讀）：', '\n\n任務路由'), core, `${type} 核心路由不一致`);
  assert.deepEqual(parseList(output, '任務路由（本次額外必讀）：', '\n\n建立 08-CHANGE-LOG'), expectedRoute, `${type} 任務路由不一致`);
}
const invalid = spawnSync(process.execPath, ['scripts/project-preflight.mjs', '--type=unknown'], { encoding: 'utf8' });
assert.equal(invalid.status, 2);
assert(invalid.stderr.includes('未知任務類型'));
console.log('精簡 preflight 路由測試通過：七種任務類型完整矩陣與未知類型');
