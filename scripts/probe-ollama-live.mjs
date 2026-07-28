import fs from 'node:fs/promises';
import path from 'node:path';
import { aiEndpointPrivacy, isLoopbackAiUrl } from '../lib/ai/local-ai.mjs';

const baseUrl = String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/+$/, '');
const model = process.env.OLLAMA_MODEL || 'llama3.2:1b';
const outputPath = process.argv[2] || path.resolve('docs/project-management/evidence/2026-07-28-ollama-llama3.2-1b-live.json');
if (!isLoopbackAiUrl(baseUrl)) throw new Error('Live Ollama probe 只允許 loopback URL');
const requests = [
  {
    name: 'capability',
    pathname: '/chat/completions',
    body: { model, messages: [{ role: 'system', content: 'Return only valid JSON. Do not use Markdown.' }, { role: 'user', content: 'Return exactly {"traditionalChinese":"繁體中文"}.' }], max_tokens: 80 },
  },
  {
    name: 'singleCue',
    pathname: '/chat/completions',
    body: { model, messages: [{ role: 'system', content: 'Return only valid JSON with a cues array. Preserve cue id, start, and end exactly.' }, { role: 'user', content: '待處理字幕：\n[{"id":1,"start":"00:00:00,000","end":"00:00:02,000","text":"這是一個測試字幕。"}]' }], max_tokens: 240 },
  },
];

async function request(pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
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

const versionResponse = await fetch(`${baseUrl.replace(/\/v1$/, '')}/api/version`, { redirect: 'manual' });
const version = await versionResponse.json();
const modelsResponse = await fetch(`${baseUrl}/models`, { redirect: 'manual' });
const models = await modelsResponse.json();
const results = [];
for (const item of requests) results.push({ ...item, response: await request(item.pathname, item.body) });
const artifact = {
  capturedAt: new Date().toISOString(),
  endpoint: baseUrl,
  endpointPrivacy: aiEndpointPrivacy(baseUrl),
  version,
  model,
  models,
  requests: results,
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, version, model, modelCount: models.data?.length || 0, requests: results.map((item) => ({ name: item.name, status: item.response.status })) }, null, 2));
