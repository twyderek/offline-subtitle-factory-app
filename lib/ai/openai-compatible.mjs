function buildUrl(baseUrl, pathname) {
  const normalized = String(baseUrl || '').trim().replace(/\/+$/, '');
  const url = new URL(`${normalized}${pathname}`);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('AI Base URL 僅支援 HTTP 或 HTTPS');
  return url;
}

async function requestJson({ baseUrl, apiKey, pathname, method = 'GET', body, timeoutSeconds = 60, signal }) {
  if (!apiKey) throw new Error('尚未設定 AI API Key');
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(new Error('AI 請求逾時')), timeoutSeconds * 1000);
  const abort = () => timeoutController.abort(signal?.reason || new Error('AI 請求已取消'));
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(buildUrl(baseUrl, pathname), {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: timeoutController.signal,
    });
    const text = await response.text();
    let result = {};
    try { result = text ? JSON.parse(text) : {}; } catch { result = { raw: text.slice(0, 500) }; }
    if (!response.ok) {
      const detail = result?.error?.message || result?.message || result?.raw || `HTTP ${response.status}`;
      throw new Error(`AI 服務回應失敗：${detail}`);
    }
    return result;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function testOpenAiCompatible(config) {
  const result = await requestJson({ ...config, pathname: '/models', method: 'GET' });
  const models = Array.isArray(result.data) ? result.data.map((item) => item?.id).filter(Boolean) : [];
  return { ok: true, modelAvailable: !config.model || models.length === 0 || models.includes(config.model), modelCount: models.length };
}

export async function createChatCompletion(config, body, signal) {
  return requestJson({ ...config, pathname: '/chat/completions', method: 'POST', body, signal });
}
