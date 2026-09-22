import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createProvider, listProviderDefinitions } from '../lib/ai/providers.mjs';
import { aiEndpointPrivacy, isLoopbackAiUrl } from '../lib/ai/local-ai.mjs';
import { inspectModelCapabilities, modelContextLength, parseCapabilityProbe } from '../lib/ai/model-capabilities.mjs';
import { glossaryToCsv, normalizeProjectAiSettings, parseGlossaryCsv } from '../lib/ai/project-tools.mjs';

const originalFetch = globalThis.fetch;
const requests = [];
let anthropicModelListMode = 'normal';
const providerMockFetch = async (url, options = {}) => {
  requests.push({ url: String(url), options });
  const isAnthropicModels = String(url).includes('api.anthropic.com/v1/models');
  const anthropicAfterId = isAnthropicModels ? new URL(url).searchParams.get('after_id') : '';
  let body;
  if (isAnthropicModels) {
    if (anthropicModelListMode === 'paginated') {
      body = anthropicAfterId === '  page 1/+?  '
        ? { data: [{ id: 'test-model' }], has_more: false, last_id: 'test-model' }
        : { data: [{ id: 'newer-model' }], has_more: true, last_id: '  page 1/+?  ' };
    } else if (anthropicModelListMode === 'empty') {
      body = { data: [], has_more: false, last_id: null };
    } else if (anthropicModelListMode === 'missing-has-more') {
      body = { data: [{ id: 'test-model' }] };
    } else if (anthropicModelListMode === 'missing-cursor') {
      body = { data: [{ id: 'test-model' }], has_more: true, last_id: null };
    } else if (anthropicModelListMode === 'repeated-cursor') {
      body = { data: [{ id: 'test-model' }], has_more: true, last_id: 'same-cursor' };
    } else if (anthropicModelListMode === 'endless-pages') {
      const currentPage = Number(String(anthropicAfterId || '').replace('page-', '')) || 0;
      body = { data: [{ id: `model-${currentPage}` }], has_more: true, last_id: `page-${currentPage + 1}` };
    } else {
      body = { data: [{ id: 'test-model' }], has_more: false, last_id: 'test-model' };
    }
  } else if (String(url).includes('/v1/messages')) {
    body = { id: 'msg_test', model: 'claude-test', content: [{ type: 'text', text: '{"cues":[]}' }], stop_reason: 'end_turn' };
  } else if (options.method === 'POST') {
    body = { choices: [{ message: { content: '{"cues":[]}' } }] };
  } else {
    body = { data: [{ id: 'test-model' }] };
  }
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
};
globalThis.fetch = providerMockFetch;

try {
  const definitions = listProviderDefinitions();
  assert.deepEqual(definitions.map((item) => item.id).sort(), ['anthropic', 'azure', 'gemini', 'groq', 'lm-studio', 'ollama', 'openai', 'openai-compatible']);

  for (const provider of ['openai', 'openai-compatible', 'groq']) {
    const adapter = createProvider({ provider, baseUrl: 'https://example.test/v1', apiKey: `key-${provider}`, model: 'test-model' });
    assert.equal((await adapter.test()).ok, true);
    await adapter.optimize({ model: 'test-model', messages: [] });
    assert.equal(adapter.classifyError(Object.assign(new Error('rate'), { status: 429, retryable: true })).retryable, true);
  }

  const openaiCompatible = createProvider({ provider: 'openai-compatible', baseUrl: 'https://example.test/v1', apiKey: 'compatible-key', model: 'test-model' });
  await openaiCompatible.optimize({
    model: 'test-model',
    operation: 'proofread',
    output_language: 'zh-TW',
    subtitle_cue_count: 1,
    subtitle_cue_ids: ['C1'],
    messages: [{ role: 'user', content: '[{"id":"C1","text":"測試"}]' }],
  });
  const openaiCompatibleBody = JSON.parse(requests.at(-1).options.body);
  assert.equal(openaiCompatibleBody.model, 'test-model');
  assert.equal(openaiCompatibleBody.operation, undefined);
  assert.equal(openaiCompatibleBody.output_language, undefined);
  assert.equal(openaiCompatibleBody.subtitle_cue_count, undefined);
  assert.equal(openaiCompatibleBody.subtitle_cue_ids, undefined);
  assert.ok(Array.isArray(openaiCompatibleBody.messages));

  const azure = createProvider({ provider: 'azure', baseUrl: 'https://resource.openai.azure.com', apiKey: 'azure-key', deployment: 'subtitle', apiVersion: '2024-12-01-preview' });
  assert.equal((await azure.test()).ok, true);
  const azureRequest = requests.at(-1);
  assert.match(azureRequest.url, /deployments\/subtitle\/chat\/completions\?api-version=2024-12-01-preview/);
  assert.equal(azureRequest.options.headers['api-key'], 'azure-key');
  assert.equal(azureRequest.options.headers.Authorization, undefined);
  const azureBody = JSON.parse(azureRequest.options.body);
  assert.equal(azureBody.max_completion_tokens, 16);
  assert.equal(azureBody.max_tokens, undefined);
  await azure.optimize({
    model: 'subtitle',
    operation: 'translate',
    output_language: 'en',
    subtitle_cue_count: 1,
    subtitle_cue_ids: [1],
    messages: [{ role: 'user', content: 'test' }],
  });
  const azureOptimizeBody = JSON.parse(requests.at(-1).options.body);
  assert.equal(azureOptimizeBody.model, undefined);
  assert.equal(azureOptimizeBody.operation, undefined);
  assert.equal(azureOptimizeBody.output_language, undefined);
  assert.equal(azureOptimizeBody.subtitle_cue_count, undefined);
  assert.equal(azureOptimizeBody.subtitle_cue_ids, undefined);
  assert.ok(Array.isArray(azureOptimizeBody.messages));

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
  assert.equal(ollamaNativeBody.stream, true, 'Ollama 原生 chat 應使用 streaming，避免長生成被 idle timeout 中斷');
  assert.equal(ollamaNativeBody.options.temperature, 0);
  assert.equal(ollamaNativeBody.options.num_predict, 512);
  assert.equal(ollamaNativeBody.keep_alive, '10m');
  assert.equal(ollamaNativeBody.format.minItems, undefined);
  assert.equal(ollamaNativeBody.format.properties.cues.minItems, 2);
  assert.equal(ollamaNativeBody.format.properties.cues.maxItems, 2);
  await ollamaNative.optimize({
    model: 'test-model',
    operation: 'translate',
    output_language: 'en',
    subtitle_cue_count: 1,
    subtitle_cue_ids: ['T1'],
    messages: [{ role: 'system', content: 'translate' }, { role: 'user', content: '[{"id":"T1","text":"你好"}]' }],
  });
  const ollamaTranslateRequest = requests.at(-1);
  const ollamaTranslateBody = JSON.parse(ollamaTranslateRequest.options.body);
  assert.equal(ollamaTranslateBody.format, 'json', 'Ollama 翻譯應使用原生 JSON format');
  assert.equal(ollamaTranslateBody.think, false, 'Ollama 翻譯應關閉 thinking，避免解說混入');
  assert.match(ollamaTranslateBody.messages[0].content, /professional subtitle translator/);
  assert.match(ollamaTranslateBody.messages[0].content, /into en/);
  globalThis.fetch = async () => new Response([
    JSON.stringify({ message: { role: 'assistant', content: '{"cues":' }, done: false }),
    JSON.stringify({ message: { role: 'assistant', content: '[]}' }, done: false }),
    JSON.stringify({ message: { role: 'assistant', content: '' }, done: true }),
  ].join('\n') + '\n', { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
  const streamed = await createProvider({ provider: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1', apiKey: '', model: 'test-model', timeoutSeconds: 1 }).optimize({ model: 'test-model', messages: [] });
  assert.equal(streamed.choices[0].message.content, '{"cues":[]}');
  const encoder = new TextEncoder();
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      const chunks = [
        [20, JSON.stringify({ message: { content: '{"cues":' }, done: false })],
        [80, JSON.stringify({ message: { content: '[]}' }, done: false })],
        [140, JSON.stringify({ message: { content: '' }, done: true })],
      ];
      for (const [delay, chunk] of chunks) setTimeout(() => controller.enqueue(encoder.encode(`${chunk}\n`)), delay);
      setTimeout(() => controller.close(), 145);
    },
  }), { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
  const idleTimeoutStream = await createProvider({ provider: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1', apiKey: '', model: 'test-model', timeoutSeconds: 0.1 }).optimize({ model: 'test-model', messages: [] });
  assert.equal(idleTimeoutStream.choices[0].message.content, '{"cues":[]}', 'Ollama streaming 應以 chunk 重設 idle timeout');
  globalThis.fetch = async (_url, options = {}) => {
    await new Promise((resolve) => setTimeout(resolve, 80));
    return new Response(new ReadableStream({
      start(controller) {
        const onAbort = () => controller.error(options.signal.reason || new Error('aborted'));
        options.signal?.addEventListener('abort', onAbort, { once: true });
        setTimeout(() => {
          options.signal?.removeEventListener('abort', onAbort);
          if (!options.signal?.aborted) {
            controller.enqueue(encoder.encode(`${JSON.stringify({ message: { content: '{"cues":[]}' }, done: true })}\n`));
            controller.close();
          }
        }, 80);
      },
    }), { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
  };
  const delayedHeaders = await createProvider({ provider: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1', apiKey: '', model: 'test-model', timeoutSeconds: 0.1 }).optimize({ model: 'test-model', messages: [] });
  assert.equal(delayedHeaders.choices[0].message.content, '{"cues":[]}', '收到 response headers 後應重新開始 body idle timeout');
  globalThis.fetch = providerMockFetch;
  assert.equal(isLoopbackAiUrl('http://[::1]:1234/v1'), true, 'IPv6 loopback 應視為本機');
  assert.equal(isLoopbackAiUrl('http://localhost.example.com:1234/v1'), false, 'localhost 子網域不得視為本機');
  assert.equal(aiEndpointPrivacy('https://example.test/v1'), 'cloud');
  assert.equal(modelContextLength({ context_length: 32768 }), 32768);
  assert.equal(modelContextLength({ details: { context_length: '8192' } }), 8192);
  assert.equal(modelContextLength({}), null);
  const capabilityProbeBodies = [];
  await inspectModelCapabilities(
    { model: 'test-model' },
    {
      listModels: async () => [],
      optimize: async (body) => {
        capabilityProbeBodies.push(body);
        return { choices: [{ message: { content: '{"traditionalChinese":"繁體中文"}' } }] };
      },
    },
  );
  assert.equal(capabilityProbeBodies[0].max_completion_tokens, 80);
  assert.equal(capabilityProbeBodies[0].max_tokens, undefined);
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

  const anthropic = createProvider({ provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1/', apiKey: 'anthropic-key', model: 'test-model' });
  const anthropicConnection = await anthropic.test();
  assert.equal(anthropicConnection.ok, true);
  assert.equal(anthropicConnection.modelAvailable, true);
  assert.equal(anthropicConnection.modelCount, 1);
  const anthropicTestRequest = requests.at(-1);
  assert.equal(new URL(anthropicTestRequest.url).pathname, '/v1/models');
  assert.equal(new URL(anthropicTestRequest.url).searchParams.get('limit'), '1000');
  assert.equal(anthropicTestRequest.url.includes('anthropic-key'), false, 'Anthropic API Key 不得進入 URL');
  assert.equal(anthropicTestRequest.options.headers['x-api-key'], 'anthropic-key');
  assert.equal(anthropicTestRequest.options.headers['anthropic-version'], '2023-06-01');
  assert.equal(anthropicTestRequest.options.headers.Authorization, undefined);
  assert.equal(anthropicTestRequest.options.method, 'GET');
  assert.equal(anthropicTestRequest.options.body, undefined, '連線測試不得送出生成 body');
  const anthropicModels = await anthropic.listModels();
  assert.deepEqual(anthropicModels, [{ id: 'test-model' }]);
  const anthropicModelsRequest = requests.at(-1);
  assert.equal(new URL(anthropicModelsRequest.url).pathname, '/v1/models');
  assert.equal(new URL(anthropicModelsRequest.url).searchParams.get('limit'), '1000');
  assert.equal(anthropicModelsRequest.options.headers['x-api-key'], 'anthropic-key');

  anthropicModelListMode = 'paginated';
  const paginatedAnthropic = createProvider({ provider: 'anthropic', baseUrl: 'https://api.anthropic.com', apiKey: 'anthropic-key', model: 'test-model' });
  const paginatedConnection = await paginatedAnthropic.test();
  assert.equal(paginatedConnection.modelAvailable, true, '第二頁指定模型不得被誤判為不可用');
  assert.equal(paginatedConnection.modelCount, 2, 'Anthropic 模型數量必須包含所有頁面');
  const paginatedRequests = requests.filter((request) => request.url.includes('api.anthropic.com/v1/models')).slice(-2);
  assert.equal(paginatedRequests.length, 2, 'has_more=true 時必須讀取下一頁');
  assert.equal(new URL(paginatedRequests[0].url).searchParams.get('limit'), '1000');
  assert.equal(new URL(paginatedRequests[0].url).searchParams.get('after_id'), null);
  assert.equal(new URL(paginatedRequests[1].url).searchParams.get('limit'), '1000');
  assert.equal(new URL(paginatedRequests[1].url).searchParams.get('after_id'), '  page 1/+?  ', 'opaque cursor 必須安全編碼後原值傳遞');

  anthropicModelListMode = 'missing-has-more';
  await assert.rejects(() => paginatedAnthropic.listModels(), /缺少 has_more/);
  anthropicModelListMode = 'missing-cursor';
  await assert.rejects(() => paginatedAnthropic.listModels(), /缺少 last_id/);
  anthropicModelListMode = 'repeated-cursor';
  await assert.rejects(() => paginatedAnthropic.listModels(), /游標重複/);
  anthropicModelListMode = 'endless-pages';
  await assert.rejects(() => paginatedAnthropic.listModels(), /超過 100 頁安全上限/);
  anthropicModelListMode = 'normal';

  const anthropicResult = await anthropic.optimize({
    model: 'claude-test',
    operation: 'proofread',
    output_language: 'zh-TW',
    subtitle_cue_count: 1,
    subtitle_cue_ids: ['C1'],
    max_completion_tokens: 256,
    temperature: 0,
    top_p: 0.8,
    top_k: 20,
    stop_sequences: ['END'],
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are a subtitle editor.' },
      { role: 'user', content: '[{"id":"C1","text":"測試"}]' },
    ],
  });
  const anthropicRequest = requests.at(-1);
  assert.match(anthropicRequest.url, /api\.anthropic\.com\/v1\/messages$/);
  const anthropicBody = JSON.parse(anthropicRequest.options.body);
  assert.equal(anthropicBody.system, 'You are a subtitle editor.');
  assert.equal(anthropicBody.max_tokens, 256);
  assert.equal(anthropicBody.max_completion_tokens, undefined);
  assert.equal(anthropicBody.temperature, undefined, 'Anthropic 不得外送新模型會拒絕的 temperature');
  assert.equal(anthropicBody.top_p, undefined, 'Anthropic 不得外送新模型會拒絕的 top_p');
  assert.equal(anthropicBody.top_k, undefined, 'Anthropic 不得外送新模型會拒絕的 top_k');
  assert.deepEqual(anthropicBody.stop_sequences, ['END'], 'Anthropic 必須保留支援的 stop_sequences');
  assert.equal(anthropicBody.response_format, undefined);
  assert.equal(anthropicBody.operation, undefined);
  assert.equal(anthropicBody.output_language, undefined);
  assert.deepEqual(anthropicBody.messages, [{ role: 'user', content: '[{"id":"C1","text":"測試"}]' }]);
  assert.equal(anthropicResult.choices[0].message.content, '{"cues":[]}');

  const unavailableAnthropic = createProvider({ provider: 'anthropic', baseUrl: 'https://api.anthropic.com', apiKey: 'anthropic-key', model: 'missing-model' });
  const unavailableConnection = await unavailableAnthropic.test();
  assert.equal(unavailableConnection.ok, true);
  assert.equal(unavailableConnection.modelAvailable, false, '模型清單未包含指定模型時不可誤判可用');
  anthropicModelListMode = 'empty';
  const emptyAnthropic = createProvider({ provider: 'anthropic', baseUrl: 'https://api.anthropic.com', apiKey: 'anthropic-key', model: 'test-model' });
  const emptyConnection = await emptyAnthropic.test();
  assert.equal(emptyConnection.ok, true);
  assert.equal(emptyConnection.modelAvailable, false, '空模型清單不可把指定模型誤判可用');
  assert.equal(emptyConnection.modelCount, 0);
  anthropicModelListMode = 'normal';

  const liveProbeSource = fs.readFileSync(new URL('./probe-provider-live.mjs', import.meta.url), 'utf8');
  assert.match(liveProbeSource, /temperature:\s*0/, '共用 live provider probe 必須維持既有 temperature: 0，由 Anthropic adapter 局部過濾');
  const liveOllamaProbeSource = fs.readFileSync(new URL('./probe-ollama-live.mjs', import.meta.url), 'utf8');
  assert.match(liveOllamaProbeSource, /optimizeSubtitleCues/, 'Ollama live probe 必須驗證實際 optimizer product path');
  assert.match(liveOllamaProbeSource, /LIVE-OPT-1/, 'Ollama optimizer probe 必須保留固定 cue contract');
  const productOllamaProbeSource = fs.readFileSync(new URL('./probe-ollama-product-live.mjs', import.meta.url), 'utf8');
  const uiOllamaProbeSource = fs.readFileSync(new URL('./verify-electron-ollama-ui.mjs', import.meta.url), 'utf8');
  assert.match(productOllamaProbeSource, /OFFLINE_SUBTITLE_DATA_DIR/, 'Ollama product probe 必須隔離暫存資料目錄');
  assert.match(productOllamaProbeSource, /OFFLINE_SUBTITLE_TOOLS_DIR: toolDataDir/, 'Ollama product probe 必須隔離 server tools 目錄');
  assert.match(productOllamaProbeSource, /SUBTITLE_AI_API_KEY: ''/, 'Ollama product probe child server 不得繼承 AI API Key');
  assert.match(productOllamaProbeSource, /SUBTITLE_AI_KEYS_JSON: '\{\}'/, 'Ollama product probe child server 不得繼承 AI keys JSON');
  assert.match(productOllamaProbeSource, /if \(!isLoopbackAiUrl\(ollamaBaseUrl\)\)/, 'Ollama product probe 必須在啟動前拒絕遠端 URL');
  assert.match(productOllamaProbeSource, /if \(fs\.existsSync\(outputPath\)\) throw/, 'Ollama product probe 必須在啟動前拒絕既有 evidence');
  assert.match(productOllamaProbeSource, /systemNetworkDisabled: false/, 'Ollama product probe 不得誤宣稱已關閉系統網路');
  assert.match(productOllamaProbeSource, /loopbackOnlyConfiguration: isLoopbackAiUrl\(ollamaBaseUrl\)/, 'Ollama product probe 必須由 loopback 判定限制配置');
  assert.match(productOllamaProbeSource, /timecodesUnchanged: true/, 'Ollama product probe 必須驗證時間碼未變');
  assert.match(productOllamaProbeSource, /sourceSrtPreserved: true/, 'Ollama product probe 必須驗證原始 SRT 未覆蓋');
  assert.match(productOllamaProbeSource, /sourceSrtBeforeSha256/, 'Ollama product probe 必須保存保存前原始 SRT hash');
  assert.match(productOllamaProbeSource, /sourceSrtAfterSha256/, 'Ollama product probe 必須保存保存後原始 SRT hash');
  assert.match(productOllamaProbeSource, /flag: 'wx'/, 'Ollama product probe 必須以 exclusive create 防止 evidence 競態覆寫');
  assert.match(uiOllamaProbeSource, /Page\.navigate/, 'Ollama UI probe 必須實際導覽封裝版校閱頁');
  assert.match(uiOllamaProbeSource, /getElementById\('openAiSettings'\)\.click/, 'Ollama UI probe 必須從畫面開啟 AI 設定');
  assert.match(uiOllamaProbeSource, /getElementById\('runAiOptimize'\)\.click/, 'Ollama UI probe 必須由畫面按下 AI 優化');
  assert.match(uiOllamaProbeSource, /getElementById\('acceptAllAiSuggestions'\)\.click/, 'Ollama UI probe 必須由畫面接受全部建議');
  assert.match(uiOllamaProbeSource, /clickAndWait\('undoAiSession'/, 'Ollama UI probe 必須驗證畫面 undo');
  assert.match(uiOllamaProbeSource, /clickAndWait\('redoAiSession'/, 'Ollama UI probe 必須驗證畫面 redo');
  assert.match(uiOllamaProbeSource, /const save = document\.getElementById\('saveSrt'\)/, 'Ollama UI probe 必須由畫面另存 SRT');
  assert.match(uiOllamaProbeSource, /if \(!isLoopbackAiUrl\(ollamaBaseUrl\)\)/, 'Ollama UI probe 必須在啟動前拒絕遠端 URL');
  assert.match(uiOllamaProbeSource, /SUBTITLE_AI_API_KEY: ''/, 'Ollama UI probe 不得繼承 AI API Key');
  assert.match(uiOllamaProbeSource, /systemNetworkDisabled: false/, 'Ollama UI probe 不得誤宣稱已關閉系統網路');
  assert.match(uiOllamaProbeSource, /flag: 'wx'/, 'Ollama UI probe 必須以 exclusive create 防止 evidence 覆寫');
  const packageManifest = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageManifest.scripts['acceptance:ollama:product'], 'node scripts/probe-ollama-product-live.mjs', 'Ollama product probe 必須有可重放 npm script');
  assert.equal(packageManifest.scripts['acceptance:ollama:ui'], 'node scripts/verify-electron-ollama-ui.mjs', 'Ollama UI probe 必須有可重放 npm script');

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
