import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(appDir, 'public', 'review.html'), 'utf8');
const css = fs.readFileSync(path.join(appDir, 'public', 'styles.css'), 'utf8');
const js = fs.readFileSync(path.join(appDir, 'public', 'review.js'), 'utf8');

assert.match(html, /id="aiToolbar" class="review-ai-toolbar collapsed"/);
assert.match(html, /id="toggleAiToolbar"[^>]+aria-expanded="false"[^>]+aria-controls="aiToolbarContent"/);
assert.match(html, /展開 AI 優化/);
assert.match(css, /\.review-ai-toolbar\.collapsed \.review-ai-toolbar-content \{ display: none; \}/);
assert.match(css, /grid-template-rows: auto auto minmax\(0, 1fr\)/);
assert.match(js, /AI_TOOLBAR_COLLAPSED_KEY/);
assert.match(js, /setAiToolbarCollapsed\(false\)/);
assert.match(html, /<option value="ja">日文<\/option>/);
assert.match(html, /<option value="custom">自訂 BCP 47…<\/option>/);
assert.match(html, /id="aiCustomLanguageField" hidden/);
assert.match(html, /id="aiCustomLanguage"[^>]+maxlength="255"/);
assert.match(js, /function getAiLanguage\(\)/);
assert.match(js, /language: getAiLanguage\(\)/);

console.log('校閱 UI 測試通過：AI 面板預設收合、狀態記憶、自動展開與字幕清單空間');
