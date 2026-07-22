import assert from 'node:assert/strict';
import { createProvider, listProviderDefinitions } from '../lib/ai/providers.mjs';
import { glossaryToCsv, normalizeProjectAiSettings, parseGlossaryCsv } from '../lib/ai/project-tools.mjs';

const originalFetch = globalThis.fetch;
const requests = [];
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url: String(url), options });
  const body = options.method === 'POST'
    ? { choices: [{ message: { content: '{"cues":[]}' } }] }
    : { data: [{ id: 'test-model' }] };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
};

try {
  const definitions = listProviderDefinitions();
  assert.deepEqual(definitions.map((item) => item.id).sort(), ['azure', 'gemini', 'groq', 'openai', 'openai-compatible']);

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
