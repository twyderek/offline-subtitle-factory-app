import assert from 'node:assert/strict';
import { createProvider, listProviderDefinitions } from '../lib/ai/providers.mjs';
import { aiEndpointPrivacy, isLoopbackAiUrl } from '../lib/ai/local-ai.mjs';
import { modelContextLength, parseCapabilityProbe } from '../lib/ai/model-capabilities.mjs';
import { glossaryToCsv, normalizeProjectAiSettings, parseGlossaryCsv } from '../lib/ai/project-tools.mjs';

const originalFetch = globalThis.fetch;
const requests = [];
const providerMockFetch = async (url, options = {}) => {
  requests.push({ url: String(url), options });
  const body = options.method === 'POST'
    ? { choices: [{ message: { content: '{"cues":[]}' } }] }
    : { data: [{ id: 'test-model' }] };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
};
globalThis.fetch = providerMockFetch;

try {
  const definitions = listProviderDefinitions();
  assert.deepEqual(definitions.map((item) => item.id).sort(), ['azure', 'gemini', 'groq', 'lm-studio', 'ollama', 'openai', 'openai-compatible']);

  for (const provider of ['openai', 'openai-compatible', 'groq']) {
    const adapter = createProvider({ provider, baseUrl: 'https://example.test/v1', apiKey: `key-${provider}`, model: 'test-model' });
    assert.equal((await adapter.test()).ok, true);
    await adapter.optimize({ model: 'test-model', messages: [] });
    assert.equal(adapter.classifyError(Object.assign(new Error('rate'), { status: 429, retryable: true })).retryable, true);
  }

  const azure = createProvider({ provider: 'azure', baseUrl: 'https://resource.openai.azure.com', apiKey: 'azure-key', deployment: 'subtitle', apiVersion: '2024-12-01-preview' });
  assert.equal((await azure.test()).ok, true);
  const azureRequest = requests.at(-1);
  assert.match(azureRequest.url, /deployments\/subtitle\/chat\/completions\?api-version=2024-12-01-preview/);
  assert.equal(azureRequest.options.headers['api-key'], 'azure-key');
  assert.equal(azureRequest.options.headers.Authorization, undefined);
  const azureBody = JSON.parse(azureRequest.options.body);
  assert.equal(azureBody.max_completion_tokens, 16);
  assert.equal(azureBody.max_tokens, undefined);

  const groq = createProvider({ provider: 'groq', baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'groq-key', model: 'llama3-8b' });
  assert.equal((await groq.test()).ok, true);
  const groqRequest = requests.at(-1);
  assert.match(groqRequest.url, /\/models$/);
  assert.equal(groqRequest.options.headers.Authorization, 'Bearer groq-key');

  for (const [provider, baseUrl] of [['ollama', 'http://127.0.0.1:11434/v1'], ['lm-studio', 'http://localhost:1234/v1']]) {
    const local = createProvider({ provider, baseUrl, apiKey: '', model: 'test-model' });
    assert.equal((await local.test()).ok, true, `${provider} loopback 不應強制 API Key`);
    assert.equal(requests.at(-1).options.headers.Authorization, undefined, `${provider} 無 Key 時不得送出空 Authorization`);
  }
  const ollamaNative = createProvider({ provider: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1', apiKey: '', model: 'test-model' });
  await ollamaNative.optimize({ model: 'test-model', subtitle_cue_count: 2, messages: [{ role: 'user', content: 'test' }] });
  const ollamaNativeRequest = requests.at(-1);
  assert.match(ollamaNativeRequest.url, /127\.0\.0\.1:11434\/api\/chat$/, 'Ollama 應使用原生 chat endpoint');
  const ollamaNativeBody = JSON.parse(ollamaNativeRequest.options.body);
  assert.equal(ollamaNativeBody.stream, false);
  assert.equal(ollamaNativeBody.options.temperature, 0);
  assert.equal(ollamaNativeBody.format.minItems, undefined);
  assert.equal(ollamaNativeBody.format.properties.cues.minItems, 2);
  assert.equal(ollamaNativeBody.format.properties.cues.maxItems, 2);
  assert.equal(isLoopbackAiUrl('http://[::1]:1234/v1'), true, 'IPv6 loopback 應視為本機');
  assert.equal(isLoopbackAiUrl('http://localhost.example.com:1234/v1'), false, 'localhost 子網域不得視為本機');
  assert.equal(aiEndpointPrivacy('https://example.test/v1'), 'cloud');
  assert.equal(modelContextLength({ context_length: 32768 }), 32768);
  assert.equal(modelContextLength({ details: { context_length: '8192' } }), 8192);
  assert.equal(modelContextLength({}), null);
  assert.deepEqual(
    parseCapabilityProbe({ choices: [{ message: { content: '```json\n{"traditionalChinese":"繁體中文"}\n```' } }] }),
    { jsonOutput: true, traditionalChinese: true, responseSample: '{"traditionalChinese":"繁體中文"}' },
  );
  assert.equal(parseCapabilityProbe({ choices: [{ message: { content: 'not json' } }] }).jsonOutput, false);
  await assert.rejects(
    () => createProvider({ provider: 'ollama', baseUrl: 'https://ollama.example.test/v1', apiKey: '', model: 'test-model' }).test(),
    /尚未設定 AI API Key/,
    '遠端 Ollama 端點不得因 provider 名稱繞過金鑰門檻',
  );

  for (const status of [301, 302, 303, 307, 308]) {
    let redirectRequests = 0;
    globalThis.fetch = async (_url, options = {}) => {
      redirectRequests += 1;
      assert.equal(options.redirect, 'manual', 'AI transport 必須停用自動 redirect');
      return new Response('', { status, headers: { Location: 'http://0.0.0.0:6553/receive' } });
    };
    await assert.rejects(
      () => createProvider({ provider: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1', apiKey: '', model: 'test-model' }).optimize({ model: 'test-model', messages: [] }),
      (error) => error.code === 'redirect_blocked' && error.retryable === false,
      `HTTP ${status} 必須被拒絕且不可重試`,
    );
    assert.equal(redirectRequests, 1, `HTTP ${status} 不得送達 redirect 第二站`);
  }
  globalThis.fetch = providerMockFetch;

  const gemini = createProvider({ provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', apiKey: 'gemini-key', model: 'gemini-1.5-flash' });
  assert.equal((await gemini.test()).ok, true);
  const geminiTestRequest = requests.at(-1);
  assert.match(geminiTestRequest.url, /\/v1beta\/models$/);
  assert.equal(geminiTestRequest.options.headers.Authorization, undefined);
  assert.equal(geminiTestRequest.options.headers['x-goog-api-key'], 'gemini-key');

  await gemini.optimize({ model: 'gemini-1.5-flash', messages: [] });
  const geminiOptimizeRequest = requests.at(-1);
  assert.match(geminiOptimizeRequest.url, /\/v1beta\/openai\/chat\/completions$/);
  assert.equal(geminiOptimizeRequest.options.headers.Authorization, 'Bearer gemini-key');
  assert.equal(geminiOptimizeRequest.options.headers['x-goog-api-key'], undefined);
  const geminiBody = JSON.parse(geminiOptimizeRequest.options.body);
  assert.ok(Array.isArray(geminiBody.messages));

  const csv = 'source,target,caseSensitive,doNotTranslate,note\nOpen AI,OpenAI,true,false,brand\nWhisper,,false,true,keep';
  const glossary = parseGlossaryCsv(csv);
  assert.equal(glossary.length, 2);
  assert.equal(glossary[1].doNotTranslate, true);
  assert.match(glossaryToCsv(glossary), /Open AI/);
  const settings = normalizeProjectAiSettings({ glossary, prompts: { proofread: '自訂校對' } });
  assert.equal(settings.prompts.proofread, '自訂校對');
  assert.ok(settings.prompts.translate);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('AI provider contract 與術語／Prompt 測試通過');
