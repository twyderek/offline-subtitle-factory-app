import fs from 'node:fs';
import path from 'node:path';
import { createProvider, isSupportedProvider } from '../lib/ai/providers.mjs';

const args = process.argv.slice(2);
const readArg = (name, fallback = '') => {
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] || fallback) : fallback;
};
const outputPath = readArg('--output');
const providerId = String(process.env.OSF_PROVIDER || readArg('--provider')).trim().toLowerCase();
const baseUrl = String(process.env.OSF_BASE_URL || readArg('--base-url')).trim();
const model = String(process.env.OSF_MODEL || readArg('--model')).trim();
const apiKey = String(process.env.OSF_API_KEY || '').trim();
const deployment = String(process.env.OSF_DEPLOYMENT || '').trim();
const apiVersion = String(process.env.OSF_API_VERSION || '2024-12-01-preview').trim();
const timeoutSeconds = Number(process.env.OSF_TIMEOUT_SECONDS || readArg('--timeout-seconds', '60'));

if (process.env.OSF_ACCEPT_EXTERNAL !== '1') throw new Error('真實端點驗收必須明確設定 OSF_ACCEPT_EXTERNAL=1');
if (!outputPath) throw new Error('Usage: OSF_ACCEPT_EXTERNAL=1 OSF_PROVIDER=groq ... node scripts/probe-provider-live.mjs --output <json>');
if (!isSupportedProvider(providerId)) throw new Error(`不支援的 provider：${providerId || '(未設定)'}`);
if (providerId === 'lm-studio') throw new Error('LM Studio 依目前需求暫緩，不執行真實端點驗收');
if (!baseUrl) throw new Error('OSF_BASE_URL 必須設定');
if (!model && providerId !== 'azure') throw new Error('OSF_MODEL 必須設定');
if (providerId === 'azure' && !deployment) throw new Error('Azure 真實端點必須設定 OSF_DEPLOYMENT');
if (!apiKey && !['ollama'].includes(providerId) && !/^https?:\/\/(localhost|127\.0\.0\.1|::1)(?:[:/]|$)/i.test(baseUrl)) {
  throw new Error('非本機 provider 必須設定 OSF_API_KEY');
}

const sanitizeUrl = (value) => {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '[invalid-url]';
  }
};

const config = {
  provider: providerId,
  baseUrl,
  apiKey,
  model,
  deployment: deployment || model,
  apiVersion,
  timeoutSeconds: Number.isFinite(timeoutSeconds) && timeoutSeconds > 0 ? timeoutSeconds : 60,
};
const startedAt = new Date().toISOString();
const started = Date.now();
let result;
let error;
try {
  const provider = createProvider(config);
  const testResult = await provider.test();
  if (!testResult?.ok) throw new Error('provider test 未回報 ok');
  if (testResult.modelAvailable === false) throw new Error(`指定模型不可用：${model || deployment}`);
  const body = {
    operation: 'translate',
    output_language: 'en',
    subtitle_cue_count: 1,
    subtitle_cue_ids: ['LIVE-1'],
    model,
    messages: [
      { role: 'system', content: 'Return only a JSON object with a cues array. Each cue must contain id, text, and reason.' },
      { role: 'user', content: '[{"id":"LIVE-1","text":"今天天氣很好。"}]' },
    ],
    temperature: 0,
  };
  const response = await provider.optimize(body);
  const content = response?.choices?.[0]?.message?.content ?? response?.message?.content ?? '';
  let parsed;
  try { parsed = JSON.parse(content); } catch { throw new Error('provider 回應不是有效 JSON'); }
  if (!parsed || !Array.isArray(parsed.cues) || parsed.cues.length !== 1) throw new Error('provider 回應 cues 數量不是 1');
  const cue = parsed.cues[0];
  if (String(cue?.id || '') !== 'LIVE-1' || !String(cue?.text || '').trim() || !String(cue?.reason || '').trim()) {
    throw new Error('provider 回應不符合 LIVE-1 cue contract');
  }
  result = {
    status: 'pass',
    test: {
      ok: Boolean(testResult?.ok),
      modelAvailable: testResult?.modelAvailable ?? null,
      modelCount: Number(testResult?.modelCount) || 0,
    },
    optimize: {
      responsePresent: Boolean(response),
      contentLength: typeof content === 'string' ? content.length : 0,
      contentIsJson: true,
      cueContract: 'LIVE-1/one-cue/id-text-reason',
    },
  };
} catch (caught) {
  error = { message: String(caught?.message || caught), code: String(caught?.code || ''), status: Number(caught?.status) || 0 };
}

const evidence = {
  schema: 'offline-subtitle-factory.provider-live-acceptance.v1',
  startedAt,
  completedAt: new Date().toISOString(),
  elapsedMs: Date.now() - started,
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  provider: providerId,
  baseUrl: sanitizeUrl(baseUrl),
  model: model || null,
  deployment: deployment || null,
  apiVersion: providerId === 'azure' ? apiVersion : null,
  ...result,
  ...(error ? { status: 'fail', error } : {}),
};
fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(`真實 provider 端點驗收證據已寫入 ${path.resolve(outputPath)}`);
if (error || evidence.status !== 'pass') process.exitCode = 1;
