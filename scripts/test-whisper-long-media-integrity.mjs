import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasSameFileIntegrity, inspectFileIntegrity } from './whisper-long-media-integrity.mjs';

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'osf-long-media-integrity-test-'));

try {
  for (const fileName of ['input-video.fixture', 'source-subtitles.fixture']) {
    const filePath = path.join(temporaryDirectory, fileName);
    const baselineBytes = 'original fixture bytes';
    const changedBytes = 'modified fixture bytes';
    assert.equal(Buffer.byteLength(changedBytes), Buffer.byteLength(baselineBytes), `${fileName}: mutation should keep the same size`);
    fs.writeFileSync(filePath, baselineBytes);

    const before = await inspectFileIntegrity(filePath);
    const unchangedAfter = await inspectFileIntegrity(filePath);
    assert.equal(before.exists, true, `${fileName}: baseline should exist`);
    assert.equal(before.stable, true, `${fileName}: streaming read should be stable`);
    assert.equal(before.fileSizeBytes, Buffer.byteLength(baselineBytes));
    assert.equal(hasSameFileIntegrity(before, unchangedAfter), true, `${fileName}: unchanged input should match`);

    fs.writeFileSync(filePath, changedBytes);
    const changedAfter = await inspectFileIntegrity(filePath);
    assert.notEqual(changedAfter.sha256, before.sha256, `${fileName}: mutation should alter the digest`);
    assert.equal(hasSameFileIntegrity(before, changedAfter), false, `${fileName}: hash mismatch should fail`);

    fs.unlinkSync(filePath);
    const missingAfter = await inspectFileIntegrity(filePath);
    assert.deepEqual(missingAfter, { exists: false, fileSizeBytes: null, sha256: null, stable: false });
    assert.equal(hasSameFileIntegrity(before, missingAfter), false, `${fileName}: disappearance should fail`);
  }
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log(JSON.stringify({
  test: path.basename(fileURLToPath(import.meta.url)),
  fixtures: ['input-video.fixture', 'source-subtitles.fixture'],
  cases: ['unchanged', 'hash-mismatch', 'missing-after'],
  result: 'pass',
}));
