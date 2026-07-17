import { createChatCompletion, requestAiJson, testOpenAiCompatible } from './openai-compatible.mjs';

export const PROVIDER_CAPABILITIES = Object.freeze({
  openai: { jsonSchema: true, streaming: true, modelList: true, localEndpoint: false },
  'openai-compatible': { jsonSchema: false, streaming: true, modelList: true, localEndpoint: true },
  azure: { jsonSchema: true, streaming: true, modelList: false, localEndpoint: false },
});

function normalizeProvider(value) {
  return Object.hasOwn(PROVIDER_CAPABILITIES, value) ? value : 'openai-compatible';
}

function azurePath(config, operation) {
  const deployment = encodeURIComponent(config.deployment || config.model || '');
  const apiVersion = encodeURIComponent(config.apiVersion || '2024-10-21');
  return `/openai/deployments/${deployment}/${operation}?api-version=${apiVersion}`;
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
  azure: {
    test: async (config) => {
      await requestAiJson({
        ...config,
        pathname: azurePath(config, 'chat/completions'),
        method: 'POST',
        body: { messages: [{ role: 'user', content: 'Reply with OK.' }], max_tokens: 2 },
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
      body,
      signal,
      authHeader: 'api-key',
      authPrefix: '',
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
    optimize: (body, signal) => adapter.optimize(config, body, signal),
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
