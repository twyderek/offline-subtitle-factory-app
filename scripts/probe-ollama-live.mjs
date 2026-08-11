import fs from 'node:fs/promises';
import path from 'node:path';
import { aiEndpointPrivacy, isLoopbackAiUrl } from '../lib/ai/local-ai.mjs';

const baseUrl = String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/+$/, '');
const model = process.env.OLLAMA_MODEL || 'llama3.2:1b';
const nativeBaseUrl = baseUrl.replace(/\/v1\/?$/, '');
const captureDate = new Date().toISOString().slice(0, 10);
const outputPath = process.argv[2] || path.resolve(`docs/project-management/evidence/${captureDate}-ollama-${model.replace(/[^a-z0-9.-]+/gi, '-')}-live.json`);
if (!isLoopbackAiUrl(baseUrl)) throw new Error('Live Ollama probe 只允許 loopback URL');
const requests = [
  {
    name: 'capability',
    pathname: '/chat/completions',
    body: { model, messages: [{ role: 'system', content: 'Return only valid JSON. Do not use Markdown.' }, { role: 'user', content: 'Return exactly {"traditionalChinese":"繁體中文"}.' }], max_tokens: 80 },
  },
  {
    name: 'singleCue',
    pathname: '/api/chat',
    baseUrl: nativeBaseUrl,
    body: {
      model,
      stream: false,
      messages: [{ role: 'system', content: '只輸出符合 schema 的 JSON。不可輸出 Markdown、解說或時間碼。' }, { role: 'user', content: '請保留 cue id、start、end，僅改善 text：[{"id":1,"start":"00:00:00,000","end":"00:00:02,000","text":"這是一個測試字幕。"}]' }],
      format: { type: 'object', additionalProperties: false, required: ['cues'], properties: { cues: { type: 'array', minItems: 1, maxItems: 1, items: { type: 'object', additionalProperties: false, required: ['id', 'text', 'reason'], properties: { id: { enum: [1] }, text: { type: 'string' }, reason: { type: 'string' } } } } } },
      options: { temperature: 0 },
    },
  },
];

async function request(pathname, body, requestBaseUrl = baseUrl) {
  const response = await fetch(`${requestBaseUrl}${pathname}`, {
    method: 'POST',
    redirect: 'manual',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  return { status: response.status, body: parsed ?? { raw: text } };
}

function validateNativeCueResponse(response) {
  const content = response?.body?.message?.content;
  try {
    const parsed = JSON.parse(content || '');
    const cues = parsed?.cues;
    const valid = Array.isArray(cues) && cues.length === 1 && cues[0]?.id === 1 && typeof cues[0]?.text === 'string' && typeof cues[0]?.reason === 'string';
    return { valid, cueCount: Array.isArray(cues) ? cues.length : 0, reason: valid ? '' : 'schema mismatch' };
  } catch {
    return { valid: false, cueCount: 0, reason: 'response content is not JSON' };
  }
}

const versionResponse = await fetch(`${baseUrl.replace(/\/v1$/, '')}/api/version`, { redirect: 'manual' });
const version = await versionResponse.json();
const modelsResponse = await fetch(`${baseUrl}/models`, { redirect: 'manual' });
const models = await modelsResponse.json();
const results = [];
for (const item of requests) results.push({ ...item, response: await request(item.pathname, item.body, item.baseUrl || baseUrl) });
const nativeSingleCue = results.find((item) => item.name === 'singleCue');
const artifact = {
  capturedAt: new Date().toISOString(),
  endpoint: baseUrl,
  endpointPrivacy: aiEndpointPrivacy(baseUrl),
  version,
  model,
  models,
  requests: results,
  validation: { nativeSingleCue: validateNativeCueResponse(nativeSingleCue?.response) },
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
if (await fs.access(outputPath).then(() => true).catch(() => false)) {
  throw new Error(`Refusing to overwrite existing Ollama evidence: ${outputPath}`);
}
await fs.writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, version, model, modelCount: models.data?.length || 0, requests: results.map((item) => ({ name: item.name, status: item.response.status })) }, null, 2));
