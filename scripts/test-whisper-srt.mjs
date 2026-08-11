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

console.log('Whisper SRT sanitizer tests passed.');
