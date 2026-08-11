import { isLoopbackAiUrl } from './local-ai.mjs';

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

function mergeStreamingRecords(text) {
  const records = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
  if (!records.length) return {};
  if (records.length === 1 && (records[0].choices || records[0].data || records[0].error)) return records[0];
  let content = '';
  let result = {};
  for (const record of records) {
    result = { ...result, ...record };
    const fragment = record?.message?.content ?? record?.response;
    if (typeof fragment === 'string') content += fragment;
  }
  if (!content && result?.message?.content) content = result.message.content;
  return { ...result, message: { ...(result.message || {}), content } };
}

async function readStreamingJson(response, armTimeout) {
  if (!response.body?.getReader) return mergeStreamingRecords(await response.text());
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    armTimeout();
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    text += `${lines.join('\n')}\n`;
  }
  text += buffer;
  return mergeStreamingRecords(text);
}

export async function requestAiJson({ baseUrl, apiKey, pathname, method = 'GET', body, timeoutSeconds = 60, signal, headers = {}, authHeader = 'Authorization', authPrefix = 'Bearer ', streamResponse = false }) {
  const localEndpoint = isLoopbackAiUrl(baseUrl);
  if (!apiKey && !localEndpoint) throw new Error('尚未設定 AI API Key');
  const timeoutController = new AbortController();
  let timer;
  const armTimeout = () => {
    clearTimeout(timer);
    timer = setTimeout(() => timeoutController.abort(new Error('AI 請求逾時')), timeoutSeconds * 1000);
  };
  armTimeout();
  const abort = () => timeoutController.abort(signal?.reason || new Error('AI 請求已取消'));
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(buildUrl(baseUrl, pathname), {
      method,
      redirect: 'manual',
      headers: {
        ...(apiKey ? { [authHeader]: `${authPrefix}${apiKey}` } : {}),
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: timeoutController.signal,
    });
    // Fetch resolves when headers arrive, but Ollama may take additional time
    // before emitting the first NDJSON record.  Treat the body wait as a new
    // idle window instead of charging it against the request/headers window.
    armTimeout();
    const result = response.ok && streamResponse
      ? await readStreamingJson(response, armTimeout)
      : await response.text().then((text) => {
        try { return text ? JSON.parse(text) : {}; } catch { return { raw: text.slice(0, 500) }; }
      });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      throw new AiProviderError('AI 服務重新導向已被安全政策拒絕', {
        status: response.status,
        code: 'redirect_blocked',
        retryable: false,
      });
    }
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

export function stripInternalChatFields(body, { dropModel = false } = {}) {
  const externalBody = { ...(body || {}) };
  for (const field of ['operation', 'output_language', 'subtitle_cue_count', 'subtitle_cue_ids']) delete externalBody[field];
  if (dropModel) delete externalBody.model;
  return externalBody;
}

export async function createChatCompletion(config, body, signal) {
  return requestAiJson({ ...config, pathname: '/chat/completions', method: 'POST', body: stripInternalChatFields(body), signal });
}
