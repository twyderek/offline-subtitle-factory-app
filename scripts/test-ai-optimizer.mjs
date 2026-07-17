import assert from 'node:assert/strict';
import { optimizeSubtitleCues } from '../lib/ai/subtitle-optimizer.mjs';

const source = [
  { id: 1, start: '00:00:00,000', end: '00:00:01,000', text: '介紹ＡＩ api' },
  { id: 2, start: '00:00:01,000', end: '00:00:02,000', text: '第二句字幕' },
];
const progress = [];
const complete = async () => ({ choices: [{ message: { content: JSON.stringify({ cues: [
  { id: 1, text: '介紹 AI API。', reason: '統一縮寫' },
  { id: 2, text: '第二句字幕', reason: '' },
] }) } }] });
complete.progress = (value) => progress.push(value);
const result = await optimizeSubtitleCues({ cues: source, config: { model: 'test', batchSize: 2 }, complete });
assert.equal(result.changedCues, 1);
assert.equal(result.suggestions[0].id, 1);
assert.equal(result.suggestions[0].start, source[0].start);
assert.equal(progress.at(-1).processedCues, 2);

const invalid = async () => ({ choices: [{ message: { content: JSON.stringify({ cues: [{ id: 1, text: '缺一段' }] }) } }] });
await assert.rejects(() => optimizeSubtitleCues({ cues: source, config: { model: 'test', batchSize: 2 }, complete: invalid }), /段落數量不符/);

let retryCalls = 0;
const retryProgress = [];
const retryComplete = async (body) => {
  retryCalls += 1;
  if (retryCalls === 1) {
    const error = new Error('rate limited');
    error.retryable = true;
    error.status = 429;
    error.retryAfterMs = 1;
    throw error;
  }
  const batch = JSON.parse(body.messages[1].content.split('待處理字幕：\n')[1]);
  return { choices: [{ message: { content: JSON.stringify({ cues: batch.map((cue) => ({ id: cue.id, text: `${cue.text}。`, reason: '重試成功' })) }) } }] };
};
retryComplete.progress = (value) => retryProgress.push(value);
const retried = await optimizeSubtitleCues({
  cues: source.slice(0, 1),
  config: { model: 'test', batchSize: 1, maxRetries: 2, retryBaseMs: 1, retryMaxMs: 2, disableRetryJitter: true },
  complete: retryComplete,
});
assert.equal(retried.totalRetries, 1, '429 應自動重試一次');
assert.equal(retryProgress.some((item) => item.retryStatus === 429), true, '進度應包含限流重試狀態');

let resumedCalls = 0;
const resumeComplete = async (body) => {
  resumedCalls += 1;
  const batch = JSON.parse(body.messages[1].content.split('待處理字幕：\n')[1]);
  return { choices: [{ message: { content: JSON.stringify({ cues: batch.map((cue) => ({ id: cue.id, text: `${cue.text}完成`, reason: '續傳' })) }) } }] };
};
const resumed = await optimizeSubtitleCues({
  cues: source,
  config: { model: 'test', batchSize: 1 },
  complete: resumeComplete,
  checkpoint: {
    nextBatchIndex: 1,
    suggestions: [{ id: 1, text: '介紹 AI API。', original: source[0].text, start: source[0].start, end: source[0].end }],
    totalRetries: 2,
  },
});
assert.equal(resumedCalls, 1, '續傳不可重送已完成批次');
assert.equal(resumed.resumedFromBatch, 1);
assert.equal(resumed.suggestions.length, 2);
assert.equal(resumed.totalRetries, 2);
console.log('AI 字幕優化測試通過：固定 cue ID、時間碼、差異建議、進度與回應驗證');
