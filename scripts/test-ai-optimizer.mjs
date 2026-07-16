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
console.log('AI 字幕優化測試通過：固定 cue ID、時間碼、差異建議、進度與回應驗證');
