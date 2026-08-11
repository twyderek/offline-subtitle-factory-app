import assert from 'node:assert/strict';
import { createProvider } from '../lib/ai/providers.mjs';
import { optimizeSubtitleCues } from '../lib/ai/subtitle-optimizer.mjs';

const originalFetch = globalThis.fetch;
const encoder = new TextEncoder();
let calls = 0;

try {
  globalThis.fetch = async (_url, options = {}) => {
    calls += 1;
    const request = JSON.parse(options.body);
    const ids = request.format?.properties?.cues?.items?.properties?.id?.enum || [];
    const output = JSON.stringify({ cues: ids.map((id) => ({ id, text: `cue-${id}`, reason: 'streamed' })) });
    const parts = [
      output.slice(0, Math.ceil(output.length / 3)),
      output.slice(Math.ceil(output.length / 3), Math.ceil(output.length * 2 / 3)),
      output.slice(Math.ceil(output.length * 2 / 3)),
    ];
    return new Response(new ReadableStream({
      start(controller) {
        [20, 80, 140].forEach((delay, index) => setTimeout(() => controller.enqueue(encoder.encode(`${JSON.stringify({ message: { content: parts[index] }, done: index === 2 })}\n`)), delay));
        setTimeout(() => controller.close(), 145);
      },
    }), { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
  };

  const provider = createProvider({ provider: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1', apiKey: '', model: 'test-model', timeoutSeconds: 0.1 });
  const cues = [1, 2, 3].map((id) => ({ id, text: `原文${id}` }));
  const result = await optimizeSubtitleCues({
    cues,
    config: { provider: 'ollama', model: 'test-model', batchSize: 1, maxRetries: 0 },
    complete: (body, signal) => provider.optimize(body, signal),
  });
  assert.equal(calls, 3, '多批次應逐批送出三次 Ollama request');
  assert.equal(result.totalBatches, 3);
  assert.equal(result.totalCues, 3);
  assert.equal(result.suggestions.length, 3);

  let retryCalls = 0;
  globalThis.fetch = async (_url, options = {}) => {
    retryCalls += 1;
    return new Response(new ReadableStream({
      start(controller) {
        if (retryCalls === 1) {
          options.signal?.addEventListener('abort', () => controller.error(options.signal.reason || new Error('aborted')), { once: true });
          return;
        }
        const request = JSON.parse(options.body);
        const ids = request.format?.properties?.cues?.items?.properties?.id?.enum || [];
        setTimeout(() => {
          controller.enqueue(encoder.encode(`${JSON.stringify({ message: { content: JSON.stringify({ cues: ids.map((id) => ({ id, text: `retry-${id}`, reason: 'extended timeout' })) }) }, done: true })}\n`));
          controller.close();
        }, 30);
      },
    }), { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
  };
  const retryProvider = createProvider({ provider: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1', apiKey: '', model: 'test-model', timeoutSeconds: 0.01 });
  const retried = await optimizeSubtitleCues({
    cues: [{ id: 9, text: '原文9' }],
    config: { provider: 'ollama', model: 'test-model', batchSize: 1, timeoutSeconds: 0.01, maxRetries: 1, retryBaseMs: 1, disableRetryJitter: true },
    complete: (body, signal, requestOptions) => retryProvider.optimize(body, signal, requestOptions),
  });
  assert.equal(retryCalls, 2, 'Ollama timeout 應在延長 timeout 後重試一次');
  assert.equal(retried.suggestions.length, 1);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Ollama streaming multi-batch test passed.');
