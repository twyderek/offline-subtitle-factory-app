import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateStandingAuthorization } from './standing-authorization-validator.mjs';

const content = await readFile('docs/project-management/09-STANDING-AUTHORIZATIONS.md', 'utf8');
assert.deepEqual(validateStandingAuthorization(content), []);
for (const marker of ['Windows Authenticode 未簽章', 'macOS 未經 Apple Developer ID 簽章／公證', '未完成實機測試', '不代表現在立即發布']) {
  const invalid = content.replaceAll(marker, '已刪除界線');
  assert(validateStandingAuthorization(invalid).length, `移除 ${marker} 應失敗`);
}
assert(validateStandingAuthorization(content.replace('明確排除：', '其他說明：')).some((error) => error.includes('排除')));
assert(validateStandingAuthorization(content.replace('發布操作：', '其他說明：')).some((error) => error.includes('發布操作')));
for (const wording of ['永久有效，不得撤銷或限縮', '不可撤銷', '不得限縮']) {
  assert(validateStandingAuthorization(content.replace('有效，直到需求提出者／產品負責人明確撤銷或限縮', wording)).length);
}
assert(validateStandingAuthorization(content.replace('撤銷方式：需求提出者／產品負責人以新指示明確撤銷或限縮', '撤銷方式：永久有效，不得撤銷或限縮')).length);
assert(validateStandingAuthorization(content.replace('以新條目附加記錄，不刪除本歷史授權', '直接覆寫舊授權')).some((error) => error.includes('保留歷史')));
console.log('常設授權測試通過：平台範圍、未實機排除、非立即發布與撤銷界線');
