import assert from 'node:assert/strict';
import { assessSubtitleCue, filterQualityCues } from '../lib/subtitle-quality.mjs';

const low = assessSubtitleCue({ start: 0, end: 2, text: 'Hello', confidence: 0.2 });
assert.equal(low.source, 'engine-metrics');
assert.ok(low.reasons.includes('低 confidence'));
assert.equal(assessSubtitleCue({ start: 0, end: 2, text: '測試' }).confidence, null);
for (const missing of [null, '', ' ', false, NaN]) assert.equal(assessSubtitleCue({ start: 0, end: 2, text: '測試', confidence: missing }).source, 'rule-score');
for (const missing of [null, '', ' ', false, NaN, Infinity]) {
  const assessment = assessSubtitleCue({ start: 0, end: 2, text: '測試', confidence: missing, no_speech_prob: missing });
  assert.equal(assessment.confidence, null);
  assert.equal(assessment.noSpeechProbability, null);
  assert.equal(assessment.source, 'rule-score');
  assert.doesNotMatch(assessment.reasons.join('、'), /confidence|no-speech/);
}
assert.ok(assessSubtitleCue({ start: 0, end: 12, text: '這是一段很長的字幕' }).reasons.includes('字幕過長'));
assert.ok(assessSubtitleCue({ start: 0, end: 1, text: '這是一段閱讀速度非常快的字幕內容需要在一秒內讀完' }).reasons.includes('閱讀速度過快'));
assert.ok(assessSubtitleCue({ start: 0, end: 3, text: '測試測試' }).reasons.includes('疑似重複文字'));
assert.equal(filterQualityCues([{ start: 0, end: 2, text: 'ok', confidence: 0.9 }, { start: 0, end: 2, text: 'bad', confidence: 0.1 }], 'low-confidence').length, 1);
assert.equal(filterQualityCues([{ start: 0, end: 2, text: 'ok', confidence: 0.9 }, { start: 0, end: 2, text: 'bad', confidence: 0.1 }], 'all').length, 2, '全部篩選應保留所有 cue');
console.log('字幕品質風險測試通過：引擎指標、缺失指標、長度、速度、重複與篩選');
