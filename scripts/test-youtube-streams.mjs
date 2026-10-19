import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { youtube } from '@googleapis/youtube';
import { requestWithMedia } from '../lib/youtube/media-stream.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'youtube-stream-test-'));
const canary = 'PRIVATE-SOURCE-PATH-MUST-NOT-LEAK';
try {
  for (const method of ['video', 'caption']) {
    for (const kind of ['missing', 'mid-read']) {
      const controller = new AbortController();
      let transportClosed = false;
      let source;
      const api = youtube({ version: 'v3', auth: { request: async (options) => {
        const abort = () => options.data.destroy(new Error('LOCAL_TRANSPORT_ABORTED'));
        options.signal.addEventListener('abort', abort, { once: true });
        try {
          for await (const _chunk of options.data) { /* consume real SDK multipart */ }
          return { data: { id: 'must-not-complete' } };
        } finally {
          options.signal.removeEventListener('abort', abort);
          transportClosed = true;
        }
      } } });
      const makeSource = () => {
        source = kind === 'missing' ? fs.createReadStream(path.join(root, canary))
          : Readable.from((async function* () { yield 'partial'; throw new Error(canary); })());
        return source;
      };
      await assert.rejects(requestWithMedia('fixture', controller, (body) => {
        const params = { part: ['snippet'], requestBody: { snippet: { videoId: 'video-1', language: 'zh-TW', name: 'fixture' } },
          media: { mimeType: 'application/octet-stream', body } };
        return method === 'video' ? api.videos.insert(params, { signal: controller.signal, retry: false })
          : api.captions.insert(params, { signal: controller.signal, retry: false });
      }, makeSource), /YOUTUBE_SOURCE_READ_FAILED/);
      assert.equal(controller.signal.aborted, true);
      assert.equal(source.destroyed, true);
      assert.equal(transportClosed, true);
    }
  }
  console.log('YouTube source stream fault tests passed in child Node process: video/caption ENOENT and mid-read errors, controlled rejection, source/SDK transport closed; no unhandled error.');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
