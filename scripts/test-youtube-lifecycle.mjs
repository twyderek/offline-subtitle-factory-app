import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPublisher } from '../lib/youtube/publisher.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'youtube-lifecycle-test-'));
const dataDir = path.join(root, 'jobs');
const configDir = path.join(root, 'config');
fs.mkdirSync(configDir);
fs.mkdirSync(dataDir);
const token = 'youtube-lifecycle-test-token';
const portProbe = createServer();
await new Promise((resolve) => portProbe.listen(0, '127.0.0.1', resolve));
const port = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
const child = spawn(process.execPath, [path.join(appDir, 'server.mjs')], { cwd: appDir,
  env: { ...process.env, NODE_ENV: 'test', PORT: String(port), TEMP: root,
    OFFLINE_SUBTITLE_DATA_DIR: dataDir, OFFLINE_SUBTITLE_SETTINGS_DIR: configDir, OFFLINE_SUBTITLE_API_TOKEN: token },
  stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
let startupError;
child.on('error', (error) => { startupError = error; });
child.stdout.on('data', (chunk) => { output = (output + chunk).slice(-4000); });
child.stderr.on('data', () => {});
async function until(probe) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (startupError) throw startupError;
    const value = await probe(); if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Lifecycle test timed out.');
}
let base;
const request = (jobId, action, method = 'POST', body = {}) => fetch(`${base}/api/jobs/${jobId}${action ? `/${action}` : ''}`, {
  method, headers: { 'Content-Type': 'application/json', 'X-Offline-Subtitle-Token': token }, body: JSON.stringify(body),
  signal: AbortSignal.timeout(5000), redirect: 'error',
});
const acquireLease = async (id, expectedRoot) => {
  const response = await request(id, 'youtube-publish-lease', 'POST', { expectedRoot });
  assert.equal(response.status, 200);
  const { leaseId } = await response.json();
  return { release: async () => {
    assert.equal((await request(id, 'youtube-publish-release', 'POST', { leaseId })).status, 200);
  } };
};
const createJob = (id) => {
  const job = path.join(dataDir, id);
  fs.mkdirSync(path.join(job, 'output'), { recursive: true }); fs.mkdirSync(path.join(job, 'review-output'));
  fs.writeFileSync(path.join(job, 'output/test.mp4'), 'fixture');
  fs.writeFileSync(path.join(job, 'review-output/reviewed.srt'), '1\n00:00:00,000 --> 00:00:01,000\nTest\n');
  fs.writeFileSync(path.join(job, 'job-config.json'), JSON.stringify({ jobId: id, files: {} }));
  fs.writeFileSync(path.join(job, 'job-status.json'), JSON.stringify({ status: 'completed', files: {} }));
  return job;
};
const fakeCredentials = { clientId: 'fixture.apps.googleusercontent.com', clientSecret: 'fixture',
  tokens: { access_token: 'fixture' }, channel: { id: 'channel-A', title: 'fixture' } };
fs.writeFileSync(path.join(configDir, 'youtube-oauth.safe'), JSON.stringify(fakeCredentials));
const input = { title: 'Test', language: 'en', madeForKids: false, consent: true, video: 'test.mp4' };
let finishVideo;
let holdVideo = true;
let captionCalls = 0;
let captionFault = false;
class Auth extends EventEmitter { setCredentials() {} }
const consume = async (source) => { for await (const _chunk of source) { /* local only */ } };
const publisher = createPublisher({ dataDir, configDir, acquireLease,
  safeStorage: { isEncryptionAvailable: () => true, decryptString: (value) => value.toString() },
  openExternal: async () => { throw new Error('No OAuth in this test.'); }, makeAuth: () => new Auth(),
  openMediaStream: (file) => fs.createReadStream(captionFault && file.endsWith('captions.srt') ? path.join(root, 'MISSING-PRIVATE-PATH') : file),
  makeApi: () => ({
    channels: { list: async () => ({ data: { items: [{ id: 'channel-A', snippet: { title: 'fixture' } }] } }) },
    videos: { insert: async (params) => {
      await consume(params.media.body);
      if (holdVideo) await new Promise((resolve) => { finishVideo = resolve; });
      return { data: { id: 'video-1' } };
    } },
    captions: { list: async () => ({ data: { items: [] } }), insert: async (params) => {
      captionCalls++;
      await consume(params.media.body);
      return { data: { id: 'caption-1', snippet: { status: 'syncing' } } };
    } },
  }),
});
try {
  await until(() => output.includes('Offline Subtitle Factory running at'));
  base = output.match(/Offline Subtitle Factory running at (http:\/\/127\.0\.0\.1:\d+)/)[1];
  const active = createJob('active');
  await publisher.start('active', input);
  await until(() => finishVideo);
  assert.equal((await request('active', '', 'DELETE')).status, 409);
  assert.equal(fs.existsSync(active), true);
  assert.equal((await request('active', 'youtube-publish-lease', 'POST', { expectedRoot: active })).status, 409);
  assert.equal((await request('active', 'youtube-publish-release', 'POST', { leaseId: 'wrong' })).status, 409);
  finishVideo(); await publisher.wait();
  assert.equal(publisher.record('active').state, 'completed');
  assert.equal((await request('active', '', 'DELETE')).status, 200);
  assert.equal(fs.existsSync(active), false);
  assert.ok(fs.readdirSync(path.join(configDir, 'youtube-publish-history')).length);

  // Simulate removal outside the API while a remote response is in flight.
  const external = createJob('external'); finishVideo = null;
  const before = captionCalls;
  await publisher.start('external', input); await until(() => finishVideo);
  fs.rmSync(external, { recursive: true }); finishVideo();
  await publisher.wait().catch(() => {});
  assert.equal(fs.existsSync(external), false);
  assert.equal(captionCalls, before);
  const ledger = fs.readdirSync(path.join(configDir, 'youtube-publish-history')).map((file) =>
    JSON.parse(fs.readFileSync(path.join(configDir, 'youtube-publish-history', file), 'utf8')));
  assert.ok(ledger.some((record) => record.videoId === 'video-1' && record.state === 'partial'));
  assert.equal(publisher.status().busy, false);

  holdVideo = false; captionFault = true;
  createJob('source-error');
  await publisher.start('source-error', input); await publisher.wait();
  assert.equal(publisher.record('source-error').state, 'partial');
  assert.equal(publisher.record('source-error').videoId, 'video-1');
  assert.equal(JSON.stringify(publisher.record('source-error')).includes('MISSING-PRIVATE-PATH'), false);
  assert.equal(publisher.status().busy, false);
  captionFault = false;
  await publisher.retryCaptions('source-error', { consent: true }); await publisher.wait();
  assert.equal(publisher.record('source-error').state, 'completed');
  assert.equal((await request('source-error', '', 'DELETE')).status, 200);
  console.log('YouTube lifecycle integration passed: real HTTP lease/delete 409, release then deletion, external removal no resurrection/captions, independent remote-ID ledger, controlled source failure and retry.');
} finally {
  finishVideo?.();
  child.kill('SIGTERM');
  if (!startupError) await until(() => child.exitCode !== null || child.signalCode !== null);
  fs.rmSync(root, { recursive: true, force: true });
}
