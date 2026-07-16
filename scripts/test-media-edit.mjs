import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getEditPaths, normalizeEditPlan, resolveEffectiveMediaPath } from '../lib/media-edit.mjs';
import { trimSrtToRange } from '../lib/subtitle-timeline.mjs';

const plan = normalizeEditPlan({ in: 2, out: 7, strategy: 'precise' }, 10);
assert.deepEqual({ in: plan.in, out: plan.out, outputDuration: plan.outputDuration, strategy: plan.strategy }, { in: 2, out: 7, outputDuration: 5, strategy: 'precise' });
assert.throws(() => normalizeEditPlan({ in: -1, out: 7 }, 10), /起點/);
assert.throws(() => normalizeEditPlan({ in: 8, out: 7 }, 10), /終點/);
assert.throws(() => normalizeEditPlan({ in: 9.8, out: 10 }, 10), /0.5/);
assert.throws(() => normalizeEditPlan({ in: 1, out: 11 }, 10), /影片長度/);

const srt = `1\n00:00:00,000 --> 00:00:02,500\n片頭\n\n2\n00:00:02,000 --> 00:00:04,000\n跨越起點\n\n3\n00:00:05,000 --> 00:00:06,000\n保留\n\n4\n00:00:06,500 --> 00:00:08,000\n跨越終點\n\n5\n00:00:08,000 --> 00:00:09,000\n片尾\n`;
const trimmed = trimSrtToRange(srt, 2.5, 7.5);
assert.equal(trimmed.sourceCount, 5);
assert.equal(trimmed.cues.length, 3);
assert.equal(trimmed.removedCount, 2);
assert.equal(trimmed.boundaryCount, 2);
assert.match(trimmed.subtitle, /00:00:00,000 --> 00:00:01,500/);
assert.match(trimmed.subtitle, /00:00:02,500 --> 00:00:03,500/);
assert.match(trimmed.subtitle, /00:00:04,000 --> 00:00:05,000/);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-edit-path-'));
try {
  const original = path.join(root, 'input.mp4');
  fs.writeFileSync(original, 'original');
  assert.equal(resolveEffectiveMediaPath(root, original), original);
  const paths = getEditPaths(root);
  fs.mkdirSync(path.dirname(paths.plan), { recursive: true });
  fs.writeFileSync(paths.trimmed, 'trimmed');
  fs.writeFileSync(paths.plan, JSON.stringify({ ...plan, appliedAt: new Date().toISOString() }));
  assert.equal(resolveEffectiveMediaPath(root, original), paths.trimmed);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('影片修剪資料層測試通過：edit plan、effective media 與字幕時間重算');
