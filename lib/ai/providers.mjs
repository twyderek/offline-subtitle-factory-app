import { createChatCompletion, requestAiJson, stripInternalChatFields, testOpenAiCompatible } from './openai-compatible.mjs';
import { LOCAL_AI_PROVIDERS } from './local-ai.mjs';

export const PROVIDER_CAPABILITIES = Object.freeze({
  openai: { jsonSchema: true, streaming: true, modelList: true, localEndpoint: false },
  'openai-compatible': { jsonSchema: false, streaming: true, modelList: true, localEndpoint: true },
  azure: { jsonSchema: true, streaming: true, modelList: false, localEndpoint: false },
  groq: { jsonSchema: true, streaming: true, modelList: true, localEndpoint: false },
  gemini: { jsonSchema: false, streaming: true, modelList: true, localEndpoint: false },
  ollama: { jsonSchema: false, streaming: true, modelList: true, localEndpoint: true },
  'lm-studio': { jsonSchema: true, structuredOutput: 'json-schema', streaming: true, modelList: true, localEndpoint: true },
});

export const SUPPORTED_PROVIDER_IDS = Object.freeze(Object.keys(PROVIDER_CAPABILITIES));
export const PROVIDER_DEFAULT_BASE_URLS = Object.freeze({
  openai: 'https://api.openai.com/v1',
  'openai-compatible': '',
  azure: '',
  groq: 'https://api.groq.com/openai/v1',
  gemini: 'https://generativelanguage.googleapis.com',
  ollama: LOCAL_AI_PROVIDERS.ollama.baseUrl,
  'lm-studio': LOCAL_AI_PROVIDERS['lm-studio'].baseUrl,
});

export function isSupportedProvider(value) {
  return typeof value === 'string' && Object.hasOwn(PROVIDER_CAPABILITIES, value);
}

function normalizeProvider(value) {
  return isSupportedProvider(value) ? value : 'openai-compatible';
}

function azurePath(config, operation) {
  const deployment = encodeURIComponent(config.deployment || config.model || '');
  const apiVersion = encodeURIComponent(config.apiVersion || '2024-12-01-preview');
  return `/openai/deployments/${deployment}/${operation}?api-version=${apiVersion}`;
}

function ollamaNativeBaseUrl(baseUrl) {
  const url = new URL(String(baseUrl || '').trim());
  url.pathname = url.pathname.replace(/\/v1\/?$/, '') || '/';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

async function optimizeOllamaNative(config, body, signal) {
  const endpoint = new URL(String(config.baseUrl || ''));
  if (endpoint.port && endpoint.port !== '11434') return createChatCompletion(config, body, signal);
  const messages = body.operation === 'translate' && Array.isArray(body.messages)
    ? body.messages.map((message, index) => index === 0
      ? {
        ...message,
        content: `You are a professional subtitle translator. Translate every cue completely into ${body.output_language || 'the requested language'}. Never copy the source text, summarize, explain, or output Markdown. Return only a JSON object with a cues array containing the original IDs, translated text, and a short reason.\n\n${message.content}`,
      }
      : message)
    : body.messages;
  const result = await requestAiJson({
    ...config,
    baseUrl: ollamaNativeBaseUrl(config.baseUrl),
    pathname: '/api/chat',
    method: 'POST',
    body: {
      model: body.model,
      messages,
      stream: true,
      ...(body.operation === 'translate' ? { think: false } : {}),
      format: body.operation === 'translate' ? 'json' : {
        type: 'object',
        additionalProperties: false,
        required: ['cues'],
        properties: {
          cues: {
            type: 'array',
            minItems: Number(body.subtitle_cue_count) || 1,
            maxItems: Number(body.subtitle_cue_count) || 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'text', 'reason'],
              properties: { id: { enum: Array.isArray(body.subtitle_cue_ids) ? body.subtitle_cue_ids : [] }, text: { type: 'string' }, reason: { type: 'string' } },
            },
          },
        },
      },
      options: { temperature: 0, num_predict: 512 },
      keep_alive: '10m',
    },
    signal,
    streamResponse: true,
  });
  return {
    choices: [{ message: { content: result?.message?.content || '' } }],
  };
}

const adapters = {
  openai: {
    test: testOpenAiCompatible,
    listModels: async (config) => (await requestAiJson({ ...config, pathname: '/models' })).data || [],
    optimize: createChatCompletion,
  },
  'openai-compatible': {
    test: testOpenAiCompatible,
    listModels: async (config) => (await requestAiJson({ ...config, pathname: '/models' })).data || [],
    optimize: createChatCompletion,
  },
  ollama: {
    test: testOpenAiCompatible,
    listModels: async (config) => (await requestAiJson({ ...config, pathname: '/models' })).data || [],
    optimize: optimizeOllamaNative,
  },
  'lm-studio': {
    test: testOpenAiCompatible,
    listModels: async (config) => (await requestAiJson({ ...config, pathname: '/models' })).data || [],
    optimize: createChatCompletion,
  },
  azure: {
    test: async (config) => {
      await requestAiJson({
        ...config,
        pathname: azurePath(config, 'chat/completions'),
        method: 'POST',
        body: { messages: [{ role: 'user', content: 'Reply with OK.' }], max_completion_tokens: 16 },
        authHeader: 'api-key',
        authPrefix: '',
      });
      return { ok: true, modelAvailable: true, modelCount: 0 };
    },
    listModels: async () => [],
    optimize: (config, body, signal) => requestAiJson({
      ...config,
      pathname: azurePath(config, 'chat/completions'),
      method: 'POST',
      body: stripInternalChatFields(body, { dropModel: true }),
      signal,
      authHeader: 'api-key',
      authPrefix: '',
    }),
  },
  groq: {
    test: testOpenAiCompatible,
    listModels: async (config) => (await requestAiJson({ ...config, pathname: '/models' })).data || [],
    optimize: createChatCompletion,
  },
  gemini: {
    test: async (config) => {
      const result = await requestAiJson({ ...config, pathname: '/v1beta/models', method: 'GET', authHeader: 'x-goog-api-key', authPrefix: '' });
      const models = Array.isArray(result?.models) ? result.models.map((m) => m?.name).filter(Boolean) : [];
      return { ok: true, modelAvailable: !config.model || models.length === 0 || models.some((m) => m.includes(config.model)), modelCount: models.length };
    },
    listModels: async (config) => {
      const result = await requestAiJson({ ...config, pathname: '/v1beta/models', method: 'GET', authHeader: 'x-goog-api-key', authPrefix: '' });
      return Array.isArray(result?.models) ? result.models.map((m) => ({ id: m?.name || '' })).filter((m) => m.id) : [];
    },
    optimize: (config, body, signal) => requestAiJson({
      ...config,
      pathname: '/v1beta/openai/chat/completions',
      method: 'POST',
      body,
      signal,
    }),
  },
};

export function createProvider(config = {}) {
  const id = normalizeProvider(config.provider);
  const adapter = adapters[id];
  return {
    id,
    capabilities: PROVIDER_CAPABILITIES[id],
    test: () => adapter.test(config),
    listModels: () => adapter.listModels(config),
    optimize: (body, signal, requestOptions = {}) => adapter.optimize({ ...config, ...requestOptions }, body, signal),
    cancel: (controller, reason = new Error('AI 請求已取消')) => controller?.abort(reason),
    classifyError: (error) => ({
      message: String(error?.message || 'AI 服務錯誤'),
      status: Number(error?.status) || 0,
      code: String(error?.code || ''),
      retryable: Boolean(error?.retryable),
      retryAfterMs: Number(error?.retryAfterMs) || 0,
    }),
  };
}

export function listProviderDefinitions() {
  return Object.entries(PROVIDER_CAPABILITIES).map(([id, capabilities]) => ({ id, capabilities }));
}
