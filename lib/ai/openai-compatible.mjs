function buildUrl(baseUrl, pathname) {
  const normalized = String(baseUrl || '').trim().replace(/\/+$/, '');
  const url = new URL(`${normalized}${pathname}`);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('AI Base URL 僅支援 HTTP 或 HTTPS');
  return url;
}

export class AiProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AiProviderError';
    this.status = options.status || 0;
    this.code = options.code || '';
    this.retryable = Boolean(options.retryable);
    this.retryAfterMs = Math.max(0, Number(options.retryAfterMs) || 0);
  }
}

function parseRetryAfter(value) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : 0;
}

function isRetryableStatus(status) {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

export async function requestAiJson({ baseUrl, apiKey, pathname, method = 'GET', body, timeoutSeconds = 60, signal, headers = {}, authHeader = 'Authorization', authPrefix = 'Bearer ' }) {
  if (!apiKey) throw new Error('尚未設定 AI API Key');
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(new Error('AI 請求逾時')), timeoutSeconds * 1000);
  const abort = () => timeoutController.abort(signal?.reason || new Error('AI 請求已取消'));
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(buildUrl(baseUrl, pathname), {
      method,
      headers: {
        [authHeader]: `${authPrefix}${apiKey}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: timeoutController.signal,
    });
    const text = await response.text();
    let result = {};
    try { result = text ? JSON.parse(text) : {}; } catch { result = { raw: text.slice(0, 500) }; }
    if (!response.ok) {
      const detail = result?.error?.message || result?.message || result?.raw || `HTTP ${response.status}`;
      throw new AiProviderError(`AI 服務回應失敗：${detail}`, {
        status: response.status,
        code: String(result?.error?.code || ''),
        retryable: isRetryableStatus(response.status),
        retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
      });
    }
    return result;
  } catch (error) {
    if (error instanceof AiProviderError || signal?.aborted) throw error;
    const timedOut = timeoutController.signal.aborted;
    throw new AiProviderError(timedOut ? 'AI 請求逾時' : `AI 網路請求失敗：${error.message}`, {
      code: timedOut ? 'timeout' : 'network_error',
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function testOpenAiCompatible(config) {
  const result = await requestAiJson({ ...config, pathname: '/models', method: 'GET' });
  const models = Array.isArray(result.data) ? result.data.map((item) => item?.id).filter(Boolean) : [];
  return { ok: true, modelAvailable: !config.model || models.length === 0 || models.includes(config.model), modelCount: models.length };
}

export async function createChatCompletion(config, body, signal) {
  return requestAiJson({ ...config, pathname: '/chat/completions', method: 'POST', body, signal });
}
