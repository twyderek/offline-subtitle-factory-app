import assert from 'node:assert/strict';
import { normalizeBilingualCues, parseSrtBilingual, renderCueText, serializeSrt, serializeVtt } from '../public/bilingual-subtitles.mjs';

const legacy = parseSrtBilingual('1\n00:00:01,000 --> 00:00:03,000\nHello\n');
assert.equal(legacy.length, 1);
assert.equal(legacy[0].sourceText, 'Hello');
assert.equal(legacy[0].translatedText, 'Hello');

const bilingual = normalizeBilingualCues([{ id: 9, start: 1, end: 3, sourceText: 'Hello', translatedText: '你好', confidence: 0.2, no_speech_prob: 0.7 }]);
assert.equal(bilingual[0].id, 1, 'cue ID 應重新連續編號');
assert.equal(bilingual[0].confidence, 0.2, '有效 confidence 應保存');
assert.equal(bilingual[0].noSpeechProbability, 0.7, 'snake_case no-speech 應正規化保存');
assert.equal(renderCueText(bilingual[0], 'source-top'), 'Hello\n你好');
assert.equal(renderCueText(bilingual[0], 'translated-top'), '你好\nHello');
assert.match(serializeSrt(bilingual, 'source-top'), /Hello\n你好/);
assert.match(serializeVtt(bilingual, 'translated-top'), /你好\nHello/);

assert.throws(() => normalizeBilingualCues([{ start: 1, end: 1, sourceText: 'x', translatedText: 'y' }]), /時間碼無效/);
assert.throws(() => normalizeBilingualCues([{ start: 1, end: 2, sourceText: '', translatedText: '' }]), /沒有文字/);
for (const invalid of [null, undefined, '', ' ', false, NaN, Infinity]) {
  const normalized = normalizeBilingualCues([{ start: 1, end: 2, sourceText: 'x', translatedText: 'y', confidence: invalid, no_speech_prob: invalid }])[0];
  assert.equal('confidence' in normalized, false, `無效 confidence 不應保存：${String(invalid)}`);
  assert.equal('noSpeechProbability' in normalized, false, `無效 no-speech 不應保存：${String(invalid)}`);
}
const reloaded = normalizeBilingualCues(JSON.parse(JSON.stringify(bilingual)))[0];
assert.deepEqual(
  { id: reloaded.id, start: reloaded.start, end: reloaded.end, sourceText: reloaded.sourceText, translatedText: reloaded.translatedText, confidence: reloaded.confidence, noSpeechProbability: reloaded.noSpeechProbability },
  { id: 1, start: 1, end: 3, sourceText: 'Hello', translatedText: '你好', confidence: 0.2, noSpeechProbability: 0.7 },
  '品質欄位保存後重新載入不得遺失或改變',
);
console.log('雙語字幕資料模型測試通過：舊單語遷移、排列、SRT/VTT 輸出與時間碼／空文字邊界');
