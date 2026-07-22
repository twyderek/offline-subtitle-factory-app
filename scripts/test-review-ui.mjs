import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { providerProfileMatches, providerProfileSnapshot, runProviderConnectionTest, validateProviderConnectionForm } from '../public/ai-provider-settings.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(appDir, 'public', 'review.html'), 'utf8');
const css = fs.readFileSync(path.join(appDir, 'public', 'styles.css'), 'utf8');
const js = fs.readFileSync(path.join(appDir, 'public', 'review.js'), 'utf8');
const providerFormJs = fs.readFileSync(path.join(appDir, 'public', 'ai-provider-settings.mjs'), 'utf8');

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
assert.match(html, /<option value="groq">Groq<\/option>/);
assert.match(html, /<option value="gemini">Google Gemini<\/option>/);
assert.match(js, /VALID_AI_PROVIDERS/);
assert.match(js, /aiDeployment'\)\.disabled = !azure/);
assert.match(js, /aiApiVersion'\)\.disabled = !azure/);
assert.match(providerFormJs, /請先輸入 API Key 並儲存設定/);
assert.match(js, /ai\/key\?provider=/);
assert.match(js, /keyInput\.dataset\.hasKey = 'false'/);
assert.match(html, /<script type="module" src="\/review\.js"><\/script>/);
assert.match(js, /runProviderConnectionTest\(\{/);

const savedGroq = providerProfileSnapshot({ provider: 'groq', baseUrl: 'https://api.groq.com/openai/v1/', model: 'llama-3.3-70b-versatile' });
assert.equal(providerProfileMatches(savedGroq, { provider: 'groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' }), true, '相同 Groq profile 應允許測試');
assert.equal(providerProfileMatches(savedGroq, { provider: 'groq', baseUrl: 'https://proxy.example/v1', model: 'llama-3.3-70b-versatile' }), false, '未儲存 Base URL 變更必須阻止測試');
assert.equal(providerProfileMatches(savedGroq, { provider: 'groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'different-model' }), false, '未儲存模型變更必須阻止測試');
assert.equal(providerProfileMatches(savedGroq, { provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', model: 'llama-3.3-70b-versatile' }), false, '未儲存供應商變更必須阻止測試');
const savedAzure = providerProfileSnapshot({ provider: 'azure', baseUrl: 'https://example.openai.azure.com', model: 'gpt-5', deployment: 'subtitle', apiVersion: '2024-12-01-preview' });
assert.equal(providerProfileMatches(savedAzure, { ...savedAzure, deployment: 'other' }), false, 'Azure deployment 未儲存變更必須阻止測試');
assert.equal(providerProfileMatches(savedAzure, { ...savedAzure, apiVersion: '2025-01-01-preview' }), false, 'Azure API version 未儲存變更必須阻止測試');
assert.equal(validateProviderConnectionForm(savedGroq, { ...savedGroq, apiKey: '' }, true), '', '已保存且未變更的 profile 應允許測試連線');
assert.match(validateProviderConnectionForm(savedGroq, { ...savedGroq, baseUrl: 'https://proxy.example/v1', apiKey: '' }, true), /未儲存變更/, '未保存 Base URL 不可進入連線 fetch');
assert.match(validateProviderConnectionForm(savedGroq, { ...savedGroq, model: 'different-model', apiKey: '' }, true), /未儲存變更/, '未保存 model 不可進入連線 fetch');
assert.match(validateProviderConnectionForm(savedGroq, { ...savedGroq, apiKey: 'new-key' }, true), /先儲存設定與 API Key/, '輸入中但未保存的 API Key 不可進入連線 fetch');
assert.match(validateProviderConnectionForm(savedGroq, { ...savedGroq, apiKey: '' }, false), /先輸入 API Key 並儲存設定/, '沒有已保存金鑰不可進入連線 fetch');

async function exerciseConnectionController({ savedProfile = savedGroq, currentSettings = { ...savedGroq, apiKey: '' }, hasSavedKey = true, response = { ok: true, status: 200, body: { ok: true, modelAvailable: true } } } = {}) {
  const button = { disabled: false };
  const statuses = [];
  let fetchCount = 0;
  const result = await runProviderConnectionTest({
    button,
    savedProfile,
    currentSettings,
    hasSavedKey,
    request: async () => {
      fetchCount += 1;
      return { ok: response.ok, status: response.status, json: async () => response.body };
    },
    setStatus: (message) => statuses.push(message),
  });
  return { button, statuses, fetchCount, result };
}

for (const [name, currentSettings, savedProfile = savedGroq, hasSavedKey = true] of [
  ['provider', { ...savedGroq, provider: 'gemini', apiKey: '' }],
  ['baseUrl', { ...savedGroq, baseUrl: 'https://proxy.example/v1', apiKey: '' }],
  ['model', { ...savedGroq, model: 'different-model', apiKey: '' }],
  ['Azure deployment', { ...savedAzure, deployment: 'other', apiKey: '' }, savedAzure],
  ['Azure apiVersion', { ...savedAzure, apiVersion: '2025-01-01-preview', apiKey: '' }, savedAzure],
  ['API Key input', { ...savedGroq, apiKey: 'unsaved-key' }],
  ['missing saved key', { ...savedGroq, apiKey: '' }, savedGroq, false],
]) {
  const outcome = await exerciseConnectionController({ savedProfile, currentSettings, hasSavedKey });
  assert.equal(outcome.fetchCount, 0, `${name} 未儲存時不可呼叫連線 API`);
  assert.equal(outcome.button.disabled, false, `${name} 阻擋後按鈕必須恢復`);
  assert.equal(outcome.result, null, `${name} 阻擋時不可回傳成功結果`);
  assert.match(outcome.statuses.at(-1), /連線失敗/, `${name} 阻擋時應顯示失敗原因`);
}

const successfulConnection = await exerciseConnectionController();
assert.equal(successfulConnection.fetchCount, 1, '已保存且未變更的 profile 應呼叫一次連線 API');
assert.equal(successfulConnection.button.disabled, false, '連線成功後按鈕必須恢復');
assert.equal(successfulConnection.result.ok, true, '連線成功應回傳結果');
assert.match(successfulConnection.statuses.at(-1), /連線成功：指定模型可用/, '連線成功應顯示模型狀態');

const failedConnection = await exerciseConnectionController({ response: { ok: false, status: 422, body: { ok: false, error: '供應商拒絕連線' } } });
assert.equal(failedConnection.fetchCount, 1, '供應商失敗案例應只呼叫一次連線 API');
assert.equal(failedConnection.button.disabled, false, '連線 HTTP 失敗後按鈕必須恢復');
assert.equal(failedConnection.result, null, '連線 HTTP 失敗不可回傳成功結果');
assert.match(failedConnection.statuses.at(-1), /供應商拒絕連線/, '連線 HTTP 失敗應顯示後端錯誤');

const thrownButton = { disabled: false };
const thrownStatuses = [];
const thrownConnection = await runProviderConnectionTest({
  button: thrownButton,
  savedProfile: savedGroq,
  currentSettings: { ...savedGroq, apiKey: '' },
  hasSavedKey: true,
  request: async () => { throw new Error('network down'); },
  setStatus: (message) => thrownStatuses.push(message),
});
assert.equal(thrownConnection, null, '連線 fetch 例外不可逃逸控制器');
assert.equal(thrownButton.disabled, false, '連線 fetch 例外後按鈕必須恢復');
assert.match(thrownStatuses.at(-1), /network down/, '連線 fetch 例外應顯示可診斷訊息');

console.log('校閱 UI 測試通過：AI 面板預設收合、狀態記憶、自動展開與字幕清單空間');
