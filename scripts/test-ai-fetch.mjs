import assert from 'node:assert/strict';
import { invalidAiApiResponseError, isNetworkFetchFailure, normalizeAiFetchError } from '../public/ai-fetch.mjs';
import { fetchAiStatusWithRetry } from '../public/ai-status-recovery.mjs';

assert.equal(isNetworkFetchFailure(new TypeError('Failed to fetch')), true);
assert.equal(isNetworkFetchFailure(new Error('AI 服務回應失敗：HTTP 500')), false);
const localError = normalizeAiFetchError(new TypeError('Failed to fetch'), { apiBase: 'http://127.0.0.1:8790', operation: '啟動 AI 優化' });
assert.equal(localError.code, 'local_api_unreachable');
assert.equal(localError.retryable, true);
assert.match(localError.message, /127\.0\.0\.1:8790/);
assert.match(localError.message, /重啟 App/);
assert.match(localError.message, /恢復 AI 優化/);
const invalid = invalidAiApiResponseError({ apiBase: 'http://127.0.0.1:8790', operation: '讀取 AI 優化狀態' });
assert.equal(invalid.code, 'invalid_api_response');
assert.equal(invalid.retryable, true);
assert.match(invalid.message, /回應格式無效/);
assert.equal(normalizeAiFetchError(new Error('其他錯誤')).message, '其他錯誤');
for (const status of ['running', 'completed', 'failed']) {
  let calls = 0;
  const result = await fetchAiStatusWithRetry({ request: async () => { calls += 1; return { ok: true, status }; } });
  assert.equal(result.status, status);
  assert.equal(calls, 1, `${status} 狀態不應重試`);
}
let networkCalls = 0;
const networkRetryAttempts = [];
await assert.rejects(
  () => fetchAiStatusWithRetry({
    request: async () => { networkCalls += 1; throw Object.assign(new Error('Failed to fetch'), { code: 'local_api_unreachable', retryable: true }); },
    onRetry: async ({ attempt }) => networkRetryAttempts.push(attempt),
  }),
  /Failed to fetch/,
);
assert.equal(networkCalls, 3, 'GET network failure 應為初次加兩次重試');
assert.deepEqual(networkRetryAttempts, [1, 2]);
let invalidResponseCalls = 0;
const invalidResponseRetries = [];
await assert.rejects(
  () => fetchAiStatusWithRetry({
    request: async () => { invalidResponseCalls += 1; throw invalidAiApiResponseError({ apiBase: 'http://127.0.0.1:8790', operation: '讀取 AI 優化狀態' }); },
    onRetry: async ({ attempt }) => invalidResponseRetries.push(attempt),
  }),
  /回應格式無效/,
);
assert.equal(invalidResponseCalls, 3, 'GET non-JSON failure 應為初次加兩次重試');
assert.deepEqual(invalidResponseRetries, [1, 2]);
console.log('AI fetch 錯誤診斷測試通過：Failed to fetch 正規化、服務回應格式與重試標記');
