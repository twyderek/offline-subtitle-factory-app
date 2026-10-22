import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createPublisher, validateMetadata } from '../lib/youtube/publisher.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'subtitle-youtube-test-'));
const dataDir = path.join(root, 'jobs');
const configDir = path.join(root, 'config');
const srt = '1\n00:00:00,000 --> 00:00:01,000\n測試字幕\n';
const input = { title: '測試影片', description: '說明', language: 'zh-TW', madeForKids: false, consent: true, video: 'test.mp4' };
let client;
let calls = [];
let failCaptions = false;
let cancelUpload = false;
let selectedChannel = 'channel-A';
let openBehavior = 'success';
let listenerUrl;
const secretMarker = 'DO-NOT-LEAK-SECRET';
let safeStorageCiphertextId = 0;
const safeStorageCiphertexts = new Map();
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => {
    const ciphertext = Buffer.from(`safe-storage-fixture:${++safeStorageCiphertextId}`);
    safeStorageCiphertexts.set(ciphertext.toString(), value);
    return ciphertext;
  },
  decryptString: (value) => {
    const plaintext = safeStorageCiphertexts.get(value.toString());
    if (plaintext === undefined) throw new Error('Unknown safeStorage fixture ciphertext');
    return plaintext;
  },
};
class FakeAuth extends EventEmitter {
  setCredentials(tokens) { this.credentials = tokens; }
  generateAuthUrl(options) { this.options = options; return `https://accounts.google.com/o/oauth2/v2/auth?state=${options.state}`; }
  async getToken(options) {
    assert.equal(options.code, 'valid-code');
    assert.equal(options.redirect_uri, listenerUrl);
    assert.equal(this.options.code_challenge, (await import('node:crypto')).createHash('sha256').update(options.codeVerifier).digest('base64url'));
    return { tokens: { refresh_token: secretMarker, access_token: 'access-secret' } };
  }
}
const makeAuth = (_id, _secret, redirect) => { client = new FakeAuth(); listenerUrl = redirect; return client; };
const readStream = async (body) => { let value = ''; for await (const chunk of body) value += chunk; return value; };
const makeApi = () => ({
  channels: { list: async () => ({ data: { items: [{ id: selectedChannel, snippet: { title: 'Test channel' } }] } }) },
  videos: { insert: async (params, options) => {
    calls.push('video');
    assert.equal(params.requestBody.status.privacyStatus, 'private');
    assert.equal(params.notifySubscribers, false);
    assert.equal(params.requestBody.status.selfDeclaredMadeForKids, false);
    assert.equal(options.retry, false);
    await readStream(params.media.body);
    options.onUploadProgress({ bytesRead: 4 });
    if (cancelUpload) await new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error(secretMarker)), { once: true });
    });
    return { data: { id: 'video-1' } };
  } },
  captions: {
    list: async () => ({ data: { items: [] } }),
    insert: async (params) => {
      calls.push('caption');
      assert.equal(params.requestBody.snippet.videoId, 'video-1');
      assert.equal(params.requestBody.snippet.language, 'zh-TW');
      assert.equal(await readStream(params.media.body), srt);
      if (failCaptions) throw { code: 403, message: secretMarker };
      return { data: { id: 'caption-1', snippet: { status: 'syncing' } } };
    },
  },
});
const options = { dataDir, configDir, safeStorage, makeAuth, makeApi, oauthTimeoutMs: 1000,
  openExternal: async (url) => {
    assert.ok(url.startsWith('https://accounts.google.com/'));
    assert.equal(client.options.code_challenge_method, 'S256');
    const wrong = await fetch(`${listenerUrl}?state=wrong&code=evil`);
    assert.equal(wrong.status, 400);
    if (openBehavior === 'timeout') return;
    const callback = new URL(listenerUrl);
    callback.searchParams.set('state', client.options.state);
    callback.searchParams.set(openBehavior === 'denied' ? 'error' : 'code', openBehavior === 'denied' ? 'access_denied' : 'valid-code');
    assert.equal((await fetch(callback)).status, 200);
  } };
const createJob = (id) => {
  const job = path.join(dataDir, id);
  fs.mkdirSync(path.join(job, 'output'), { recursive: true });
  fs.mkdirSync(path.join(job, 'review-output'));
  fs.writeFileSync(path.join(job, 'output/test.mp4'), 'mp4-fixture');
  fs.writeFileSync(path.join(job, 'review-output/reviewed.srt'), srt);
  return job;
};
try {
  for (const bad of [{ ...input, consent: false }, { ...input, language: '' }, { ...input, title: '<evil>' }, { ...input, madeForKids: undefined }]) {
    assert.throws(() => validateMetadata(bad));
  }
  const publisher = createPublisher(options);
  assert.deepEqual(publisher.status(), { configured: false, connected: false, channel: null, busy: false });
  assert.throws(() => publisher.configure('{}'));
  assert.throws(() => publisher.configure('{"web":{}}'));
  const json = JSON.stringify({ installed: { client_id: 'test.apps.googleusercontent.com', client_secret: secretMarker } });
  publisher.configure(json);
  const credentialFile = path.join(configDir, 'youtube-oauth.safe');
  const credentialStats = fs.statSync(credentialFile);
  const credentialCiphertext = fs.readFileSync(credentialFile);
  assert.equal(credentialStats.isFile(), true);
  assert.match(credentialCiphertext.toString(), /^safe-storage-fixture:\d+$/);
  assert.equal(credentialCiphertext.includes(Buffer.from(secretMarker)), false);
  assert.deepEqual(JSON.parse(safeStorage.decryptString(credentialCiphertext)), {
    clientId: 'test.apps.googleusercontent.com', clientSecret: secretMarker,
  });
  if (process.platform !== 'win32') assert.equal(credentialStats.mode & 0o777, 0o600);
  openBehavior = 'denied';
  await assert.rejects(publisher.connect(), /取消/);
  assert.equal(publisher.status().connected, false);
  openBehavior = 'timeout';
  await assert.rejects(publisher.connect(), /逾時/);
  openBehavior = 'success';
  await publisher.connect();
  assert.equal(publisher.status().channel.id, 'channel-A');
  assert.equal(JSON.stringify(publisher.status()).includes(secretMarker), false);
  createJob('success');
  assert.throws(() => publisher.files('../outside'));
  await assert.rejects(publisher.start('success', { ...input, video: '../test.mp4' }));
  await publisher.start('success', input);
  await assert.rejects(publisher.start('success', input), /工作進行中|發布紀錄/);
  await publisher.wait();
  assert.equal(publisher.record('success').state, 'completed');
  assert.equal(publisher.record('success').captionStatus, 'syncing');
  assert.equal(fs.existsSync(path.join(dataDir, 'success/.youtube-upload/video.mp4')), false);
  assert.equal(fs.readFileSync(path.join(dataDir, 'success/output/test.mp4'), 'utf8'), 'mp4-fixture');
  await assert.rejects(publisher.start('success', input), /發布紀錄/);
  createJob('partial'); failCaptions = true;
  await publisher.start('partial', input); await publisher.wait();
  assert.equal(publisher.record('partial').state, 'partial');
  assert.equal(JSON.stringify(publisher.record('partial')).includes(secretMarker), false);
  const videosBeforeRetry = calls.filter((item) => item === 'video').length;
  failCaptions = false;
  await publisher.retryCaptions('partial', { consent: true }); await publisher.wait();
  assert.equal(publisher.record('partial').state, 'completed');
  assert.equal(calls.filter((item) => item === 'video').length, videosBeforeRetry);
  createJob('cancel'); cancelUpload = true;
  await publisher.start('cancel', input);
  while (publisher.record('cancel').state !== 'uploading-video') await new Promise((resolve) => setTimeout(resolve, 5));
  await new Promise((resolve) => setTimeout(resolve, 20));
  publisher.cancel('cancel'); await publisher.wait(); cancelUpload = false;
  assert.equal(publisher.record('cancel').state, 'cancelled');
  const interrupted = createJob('interrupted');
  fs.writeFileSync(path.join(interrupted, 'youtube-publish.json'), JSON.stringify({ state: 'uploading-video', channelId: 'channel-A' }));
  assert.equal(createPublisher(options).record('interrupted').state, 'interrupted');
  const symbolic = createJob('symlink');
  fs.symlinkSync(path.join(dataDir, 'success/output/test.mp4'), path.join(symbolic, 'output/link.mp4'));
  assert.equal(publisher.files('symlink').videos.some((item) => item.name === 'link.mp4'), false);
  await assert.rejects(publisher.start('symlink', { ...input, video: 'link.mp4' }));
  createJob('wrong-channel'); selectedChannel = 'channel-B';
  await publisher.start('wrong-channel', input); await publisher.wait();
  assert.equal(publisher.record('wrong-channel').state, 'failed');
  assert.equal(publisher.record('wrong-channel').videoAttempted, false);
  publisher.resetUnsent('wrong-channel');
  assert.equal(publisher.record('wrong-channel'), null);
  assert.throws(() => publisher.resetUnsent('success'));
  assert.throws(() => publisher.resetUnsent('cancel'));
  assert.equal(calls.filter((item) => item === 'video').length, videosBeforeRetry + 1);
  publisher.disconnect();
  assert.equal(publisher.status().connected, false);
  assert.equal(fs.existsSync(path.join(configDir, 'youtube-oauth.safe')), false);
  console.log('YouTube publisher tests passed: OAuth PKCE/state/denial/timeout, private upload, partial/caption-only retry, cancellation, restart, path boundaries, redaction, disconnect.');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
