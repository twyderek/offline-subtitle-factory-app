import { requestAiJson } from './openai-compatible.mjs';

const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODELS_PAGE_LIMIT = 1000;
const ANTHROPIC_MODELS_MAX_PAGES = 100;

function normalizeBaseUrl(baseUrl) {
  const value = String(baseUrl || '').trim();
  if (!value) return value;
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/v1\/?$/, '') || '/';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function requestConfig(config, pathname, method = 'GET', body, signal) {
  return {
    ...config,
    baseUrl: normalizeBaseUrl(config.baseUrl),
    pathname,
    method,
    body,
    signal,
    authHeader: 'x-api-key',
    authPrefix: '',
    headers: { 'anthropic-version': ANTHROPIC_VERSION },
  };
}

function contentToText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content || '');
  return content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}

function toAnthropicMessages(messages = []) {
  const system = [];
  const converted = [];
  for (const message of Array.isArray(messages) ? messages : []) {
    const role = String(message?.role || '').toLowerCase();
    const content = contentToText(message?.content).trim();
    if (!content) continue;
    if (role === 'system' || role === 'developer') {
      system.push(content);
      continue;
    }
    const normalizedRole = role === 'assistant' ? 'assistant' : 'user';
    const previous = converted.at(-1);
    if (previous?.role === normalizedRole) previous.content = `${previous.content}\n\n${content}`;
    else converted.push({ role: normalizedRole, content });
  }
  return { system: system.join('\n\n'), messages: converted };
}

function toAnthropicBody(config, body = {}) {
  const { system, messages } = toAnthropicMessages(body.messages);
  const maxTokens = Math.max(1, Math.floor(Number(body.max_tokens || body.max_completion_tokens || 1024)));
  return {
    model: String(body.model || config.model || '').trim(),
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: messages.length ? messages : [{ role: 'user', content: 'Reply with JSON.' }],
    ...(Array.isArray(body.stop_sequences) ? { stop_sequences: body.stop_sequences } : {}),
  };
}

function normalizeResponse(result) {
  const content = Array.isArray(result?.content)
    ? result.content.filter((part) => part?.type === 'text').map((part) => part.text || '').join('')
    : '';
  return {
    id: result?.id,
    model: result?.model,
    stop_reason: result?.stop_reason,
    choices: [{ message: { role: 'assistant', content } }],
  };
}

export async function testAnthropic(config) {
  const models = await listAnthropicModels(config);
  const ids = models.map((model) => String(model?.id || '')).filter(Boolean);
  return {
    ok: true,
    modelAvailable: !config.model || ids.includes(config.model),
    modelCount: ids.length,
  };
}

export async function listAnthropicModels(config) {
  const models = [];
  const seenCursors = new Set();
  let afterId = '';
  for (let page = 0; page < ANTHROPIC_MODELS_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ limit: String(ANTHROPIC_MODELS_PAGE_LIMIT) });
    if (afterId) params.set('after_id', afterId);
    const result = await requestAiJson(requestConfig(config, `/v1/models?${params}`));
    if (Array.isArray(result?.data)) models.push(...result.data);
    if (typeof result?.has_more !== 'boolean') {
      throw new Error('Anthropic 模型清單分頁回應缺少 has_more');
    }
    if (!result.has_more) return models;
    const nextCursor = result.last_id;
    if (typeof nextCursor !== 'string' || !nextCursor.trim()) {
      throw new Error('Anthropic 模型清單分頁回應缺少 last_id');
    }
    if (seenCursors.has(nextCursor)) throw new Error('Anthropic 模型清單分頁游標重複');
    seenCursors.add(nextCursor);
    afterId = nextCursor;
  }
  throw new Error(`Anthropic 模型清單超過 ${ANTHROPIC_MODELS_MAX_PAGES} 頁安全上限`);
}

export async function createAnthropicMessage(config, body, signal) {
  const result = await requestAiJson(requestConfig(config, '/v1/messages', 'POST', toAnthropicBody(config, body), signal));
  return normalizeResponse(result);
}

export { ANTHROPIC_VERSION, normalizeBaseUrl, toAnthropicBody, normalizeResponse };
