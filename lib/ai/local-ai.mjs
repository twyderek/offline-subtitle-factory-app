export const LOCAL_AI_PROVIDERS = Object.freeze({
  ollama: {
    label: 'Ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    defaultBatchSize: 8,
  },
  'lm-studio': {
    label: 'LM Studio',
    baseUrl: 'http://127.0.0.1:1234/v1',
    defaultBatchSize: 8,
  },
});

export const LOCAL_AI_PROVIDER_IDS = Object.freeze(Object.keys(LOCAL_AI_PROVIDERS));

export function isLocalAiProvider(provider) {
  return LOCAL_AI_PROVIDER_IDS.includes(String(provider || ''));
}

export function isLoopbackAiUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function aiEndpointPrivacy(baseUrl) {
  return isLoopbackAiUrl(baseUrl) ? 'local' : 'cloud';
}

export function localAiCandidates() {
  return LOCAL_AI_PROVIDER_IDS.map((provider) => ({
    provider,
    ...LOCAL_AI_PROVIDERS[provider],
  }));
}
