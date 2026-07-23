import assert from 'node:assert/strict';
import { normalizeBilingualCues, parseSrtBilingual, renderCueText, serializeSrt, serializeVtt } from '../public/bilingual-subtitles.mjs';

const legacy = parseSrtBilingual('1\n00:00:01,000 --> 00:00:03,000\nHello\n');
assert.equal(legacy.length, 1);
assert.equal(legacy[0].sourceText, 'Hello');
assert.equal(legacy[0].translatedText, 'Hello');

const bilingual = normalizeBilingualCues([{ id: 9, start: 1, end: 3, sourceText: 'Hello', translatedText: '你好' }]);
assert.equal(bilingual[0].id, 1, 'cue ID 應重新連續編號');
assert.equal(renderCueText(bilingual[0], 'source-top'), 'Hello\n你好');
assert.equal(renderCueText(bilingual[0], 'translated-top'), '你好\nHello');
assert.match(serializeSrt(bilingual, 'source-top'), /Hello\n你好/);
assert.match(serializeVtt(bilingual, 'translated-top'), /你好\nHello/);

assert.throws(() => normalizeBilingualCues([{ start: 1, end: 1, sourceText: 'x', translatedText: 'y' }]), /時間碼無效/);
assert.throws(() => normalizeBilingualCues([{ start: 1, end: 2, sourceText: '', translatedText: '' }]), /沒有文字/);
console.log('雙語字幕資料模型測試通過：舊單語遷移、排列、SRT/VTT 輸出與時間碼／空文字邊界');
