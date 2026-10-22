import assert from 'node:assert/strict';
import { sanitizeWhisperSrt } from '../lib/whisper-srt.mjs';
import { parseSrtBilingual } from '../public/bilingual-subtitles.mjs';

const sample = `\uFEFF1\r\n00:00:00,000 --> 00:00:01,250\r\n第一段有效字幕\r\n\r\n2\r\n00:00:01,250 --> 00:00:01,250\r\n零長度字幕\r\n\r\n3\r\n00:00:02,500 --> 00:00:02,100\r\n逆序字幕\r\n\r\n4\r\n00:00:xx,000 --> 00:00:03,000\r\n格式錯誤\r\n\r\n5\r\n00:00:03,000 --> 00:00:04,000\r\n多行\r\n文字\r\n`;

const result = sanitizeWhisperSrt(sample);
assert.equal(result.totalBlocks, 5);
assert.equal(result.droppedCount, 3);
assert.equal(result.cues.length, 2);
assert.deepEqual(result.cues.map(({ sourceIndex }) => sourceIndex), [0, 4]);
assert.deepEqual(result.cues.map(({ id, start, end, text }) => ({ id, start, end, text })), [
  { id: 1, start: 0, end: 1.25, text: '第一段有效字幕' },
  { id: 2, start: 3, end: 4, text: '多行\n文字' },
]);
assert.equal(result.subtitle, '1\n00:00:00,000 --> 00:00:01,250\n第一段有效字幕\n\n2\n00:00:03,000 --> 00:00:04,000\n多行\n文字\n\n');
assert.deepEqual(parseSrtBilingual(result.subtitle).map((cue) => cue.id), [1, 2]);

const empty = sanitizeWhisperSrt('1\n00:00:01,000 --> 00:00:01,000\n只有無效段\n');
assert.equal(empty.cues.length, 0);
assert.equal(empty.droppedCount, 1);
assert.equal(empty.subtitle, '');

const longText = '這是一段 Whisper Small 可能產生的過長字幕，應該在不遺失任何文字的前提下依照標點拆分成連續片段，並且讓每一行維持適合閱讀的長度。';
const longSource = `1\n00:00:10,000 --> 00:00:16,000\n${longText}\n`;
const unchanged = sanitizeWhisperSrt(longSource);
assert.equal(unchanged.cues.length, 1, 'Tiny/Base 的預設清理不可改變 cue 數量');
assert.equal(unchanged.cues[0].text, longText, '未啟用 Small 長 cue 政策時不可改寫文字');

const normalized = sanitizeWhisperSrt(longSource, { splitLongCues: true });
assert.equal(normalized.longCueCount, 1);
assert.equal(normalized.splitCueCount, 1, 'Small 長 cue 應拆成多個時間連續的 cue');
assert.equal(normalized.unsplittableLongCueCount, 0);
assert.ok(normalized.cues.length > 1);
assert.deepEqual(normalized.cues.map(({ id }) => id), normalized.cues.map((_, index) => index + 1), '拆分後 ID 應重新連續編號');
assert.equal(normalized.cues[0].start, 10);
assert.equal(normalized.cues.at(-1).end, 16);
for (const [index, cue] of normalized.cues.entries()) {
  assert.ok(cue.end > cue.start, '拆分後不得產生零長度 cue');
  assert.ok(cue.text.split('\n').length <= 2, 'Small 長 cue 最多保留兩行');
  assert.ok(cue.text.split('\n').every((line) => [...line.trimEnd()].length <= 20), 'Small 每行可見文字不得超過 20 字元');
  if (index > 0) assert.equal(cue.start, normalized.cues[index - 1].end, '拆分後時間碼應連續');
}
assert.equal(
  normalized.cues.map((cue) => cue.text.replace(/\s+/gu, '')).join(''),
  longText.replace(/\s+/gu, ''),
  'Small 長 cue 拆分不可遺失文字',
);

const englishLongText = 'This is a very long English sentence that should preserve every word and every space between them when split into subtitles.';
const englishNormalized = sanitizeWhisperSrt(`1\n00:00:00,000 --> 00:00:10,000\n${englishLongText}\n`, { splitLongCues: true });
assert.equal(
  englishNormalized.cues.map((cue) => cue.text.replace(/\n/gu, '')).join('').replace(/\s+/gu, ' ').trim(),
  englishLongText,
  '英文跨 cue／換行後仍應保留字詞分隔空白',
);

const alreadyReadable = sanitizeWhisperSrt('1\n00:00:00,000 --> 00:00:02,000\n一二三四五六七八九十一二三四五六七八九十\n甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉\n', { splitLongCues: true });
assert.equal(alreadyReadable.cues.length, 1, '原本兩行各 20 字元的 Small cue 不應被不必要拆分');
assert.equal(alreadyReadable.cues[0].text.split('\n').length, 2);

const tooShort = sanitizeWhisperSrt(`1\n00:00:01,000 --> 00:00:01,001\n${longText}\n`, { splitLongCues: true });
assert.equal(tooShort.cues.length, 1, '時間不足以安全拆分時應保留單一 cue');
assert.equal(tooShort.unsplittableLongCueCount, 1);
assert.ok(tooShort.cues[0].end > tooShort.cues[0].start);
assert.ok(tooShort.cues[0].text.split('\n').length <= 2, '時間不足 fallback 仍不得產生超過兩行');

const chineseTooShortText = '這是一段超過四十字的純中文長字幕，時間太短時也不能在詞組或標點之間新增英文空格，還必須完整保留原始內容。';
const chineseTooShort = sanitizeWhisperSrt(`1\n00:00:01,000 --> 00:00:01,001\n${chineseTooShortText}\n`, { splitLongCues: true });
assert.equal(chineseTooShort.cues.length, 1);
assert.doesNotMatch(chineseTooShort.cues[0].text, / /u, '中文超短 cue fallback 不應插入 ASCII 空格');
assert.equal(
  chineseTooShort.cues[0].text.replace(/\n/gu, ''),
  chineseTooShortText,
  '中文超短 cue fallback 不可遺失或改寫文字',
);

console.log('Whisper SRT sanitizer tests passed.');
