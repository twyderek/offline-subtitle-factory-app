import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { OAuth2Client } from 'google-auth-library';
import { youtube } from '@googleapis/youtube';

// Exercise the installed official SDK's serialization, not a hand-written API stub.
// The transport adapter consumes requests locally; no DNS / socket / Google request.
const auth = new OAuth2Client({ clientId: 'fixture.apps.googleusercontent.com', clientSecret: 'fixture' });
auth.setCredentials({ access_token: 'local-fixture-token', expiry_date: Date.now() + 3600000 });
const calls = [];
let progress = 0;
auth.transporter.defaults.adapter = async (options) => {
  const url = new URL(options.url);
  let body = '';
  if (options.data && typeof options.data[Symbol.asyncIterator] === 'function') {
    for await (const chunk of options.data) body += chunk;
  } else if (options.data) body = typeof options.data === 'string' ? options.data : JSON.stringify(options.data);
  calls.push({ url, body });
  if (url.pathname.endsWith('/videos')) {
    assert.match(body, /"privacyStatus":"private"/);
    assert.match(body, /"selfDeclaredMadeForKids":false/);
    assert.match(body, /video-fixture/);
    assert.equal(url.searchParams.get('notifySubscribers'), 'false');
    assert.equal(url.searchParams.get('uploadType'), 'multipart');
  } else {
    assert.match(body, /subtitle-fixture/);
    if (options.method === 'POST') {
      assert.match(body, /"videoId":"video-1"/);
      assert.match(body, /"language":"zh-TW"/);
    } else assert.match(body, /"id":"caption-1"/);
  }
  return { config: options, status: 200, statusText: 'OK', headers: new Headers(),
    data: url.pathname.endsWith('/videos') ? { id: 'video-1' } : { id: 'caption-1', snippet: { status: 'syncing' } } };
};
const api = youtube({ version: 'v3', auth });
await api.videos.insert({ part: ['snippet', 'status'], notifySubscribers: false,
  requestBody: { snippet: { title: 'fixture', categoryId: '27' }, status: { privacyStatus: 'private', selfDeclaredMadeForKids: false } },
  media: { mimeType: 'video/mp4', body: Readable.from(['video-fixture']) } },
{ retry: false, timeout: 1000, onUploadProgress: (event) => { progress = event.bytesRead; } });
await api.captions.insert({ part: ['snippet'], requestBody: { snippet: { videoId: 'video-1', language: 'zh-TW', name: 'fixture', isDraft: false } },
  media: { mimeType: 'application/octet-stream', body: Readable.from(['subtitle-fixture']) } }, { retry: false, timeout: 1000 });
await api.captions.update({ part: ['snippet'], requestBody: { id: 'caption-1', snippet: { isDraft: false } },
  media: { mimeType: 'application/octet-stream', body: Readable.from(['subtitle-fixture']) } }, { retry: false, timeout: 1000 });
assert.equal(calls.length, 3);
assert.equal(progress, Buffer.byteLength('video-fixture'));
console.log('Official YouTube SDK transport tests passed: video/private metadata, multipart streams, progress, caption insert/update; no network.');
