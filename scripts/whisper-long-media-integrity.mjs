import crypto from 'node:crypto';
import fs from 'node:fs';

function isMissing(error) {
  return error?.code === 'ENOENT';
}

async function statOrNull(filePath) {
  try {
    return await fs.promises.stat(filePath);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

function missingSnapshot() {
  return { exists: false, fileSizeBytes: null, sha256: null, stable: false };
}

function sameReadBoundary(before, after) {
  return before.dev === after.dev
    && before.ino === after.ino
    && before.size === after.size
    && before.mtimeMs === after.mtimeMs
    && before.ctimeMs === after.ctimeMs;
}

export async function inspectFileIntegrity(filePath) {
  const before = await statOrNull(filePath);
  if (!before) return missingSnapshot();
  if (!before.isFile()) {
    return { exists: true, fileSizeBytes: before.size, sha256: null, stable: false };
  }

  const hash = crypto.createHash('sha256');
  let bytesRead = 0;
  try {
    for await (const chunk of fs.createReadStream(filePath)) {
      hash.update(chunk);
      bytesRead += chunk.length;
    }
  } catch (error) {
    if (isMissing(error)) return missingSnapshot();
    throw error;
  }

  const after = await statOrNull(filePath);
  if (!after || !after.isFile()) return missingSnapshot();
  return {
    exists: true,
    fileSizeBytes: before.size,
    sha256: hash.digest('hex'),
    stable: bytesRead === before.size && sameReadBoundary(before, after),
  };
}

export function hasSameFileIntegrity(before, after) {
  return Boolean(before?.exists
    && after?.exists
    && before.stable
    && after.stable
    && before.fileSizeBytes === after.fileSizeBytes
    && before.sha256
    && before.sha256 === after.sha256);
}
