import fs from 'node:fs';
import { Buffer } from 'node:buffer';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawnManagedChild, stopManagedChild } from '../lib/ai/managed-child-process.mjs';
import { cleanupProcessGroup } from '../lib/process-group-cleanup.mjs';

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function readTags(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    let timer;
    const finish = (error, value) => {
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };
    const request = http.get({ hostname: '127.0.0.1', port, path: '/api/tags' }, (response) => {
      let body = '';
      let bodyBytes = 0;
      response.on('data', (chunk) => {
        bodyBytes += Buffer.byteLength(chunk);
        if (bodyBytes > 1024 * 1024) request.destroy(new Error('TAGS_RESPONSE_TOO_LARGE'));
        else body += chunk;
      });
      response.on('end', () => {
        try { finish(null, { status: response.statusCode, tags: JSON.parse(body) }); }
        catch { finish(new Error('INVALID_TAGS_RESPONSE')); }
      });
      response.on('error', (error) => finish(error));
    });
    timer = setTimeout(() => request.destroy(new Error('TAGS_TIMEOUT')), timeoutMs);
    request.on('error', (error) => finish(error));
  });
}

export async function startLocalAcceptanceDaemon({ model, binary, modelsDirectory, timeoutMs = 90000 }) {
  const handle = { process: null, root: null, port: null, baseUrl: null, preinstalledModelFound: false, failureCode: null, contextLength: 4096, diagnostics: { listeningReported: false, lastHttpStatus: null, lastFetchErrorCode: null } };
  try {
    if (process.platform !== 'darwin') throw new Error('LOCAL_DAEMON_MACOS_REQUIRED');
    fs.accessSync(binary, fs.constants.X_OK);
    if (!fs.statSync(modelsDirectory).isDirectory()) throw new Error('MODEL_STORE_INVALID');
    handle.root = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-subtitle-ollama-ui-daemon-'));
    handle.port = await unusedPort();
    handle.baseUrl = `http://127.0.0.1:${handle.port}/v1`;
    const env = {
      PATH: process.env.PATH || '/usr/bin:/bin',
      HOME: handle.root,
      TMPDIR: handle.root,
      OLLAMA_HOST: `127.0.0.1:${handle.port}`,
      OLLAMA_MODELS: path.resolve(modelsDirectory),
      OLLAMA_CONTEXT_LENGTH: '4096',
      OLLAMA_NUM_PARALLEL: '1',
      OLLAMA_MAX_LOADED_MODELS: '1',
      OLLAMA_NO_CLOUD: '1',
      OLLAMA_NOPRUNE: '1',
    };
    handle.process = spawnManagedChild(path.resolve(binary), ['serve'], {
      cwd: handle.root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const observeStartup = (chunk) => {
      if (/Listening on/.test(String(chunk))) handle.diagnostics.listeningReported = true;
    };
    handle.process.child.stdout.on('data', observeStartup);
    handle.process.child.stderr.on('data', observeStartup);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (handle.process.spawnError || handle.process.closeInfo) throw new Error('LOCAL_DAEMON_START_FAILED');
      let tags;
      try {
        const response = await readTags(handle.port, Math.max(1, Math.min(1000, deadline - Date.now())));
        handle.diagnostics.lastHttpStatus = response.status;
        if (response.status === 200) tags = response.tags;
      } catch (error) {
        const code = String(error.code || error.message || '');
        handle.diagnostics.lastFetchErrorCode = /^[A-Z][A-Z0-9_]+$/.test(code) ? code : 'REQUEST_FAILED';
      }
      if (tags) {
        if (Date.now() >= deadline) throw new Error('LOCAL_DAEMON_START_TIMEOUT');
        handle.preinstalledModelFound = Array.isArray(tags.models) && tags.models.some((item) => item.name === model || item.model === model);
        if (!handle.preinstalledModelFound) throw new Error('MODEL_NOT_PREINSTALLED');
        return handle;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(100, deadline - Date.now()))));
    }
    throw new Error('LOCAL_DAEMON_START_TIMEOUT');
  } catch (error) {
    const allowed = ['LOCAL_DAEMON_MACOS_REQUIRED', 'MODEL_STORE_INVALID', 'LOCAL_DAEMON_START_FAILED', 'LOCAL_DAEMON_START_TIMEOUT', 'MODEL_NOT_PREINSTALLED'];
    handle.failureCode = allowed.includes(error.message) ? error.message : 'LOCAL_DAEMON_PREFLIGHT_FAILED';
    return handle;
  }
}

export async function stopLocalAcceptanceDaemon(handle) {
  if (!handle) return { stopped: true, processGroupAbsent: true, forcedCleanup: false, portClosed: true, temporaryRootRemoved: true };
  const group = await cleanupProcessGroup(handle.process?.child.pid || null, { gracefulMs: 5000, forceMs: 3000 });
  const stopped = await stopManagedChild(handle.process);
  let portClosed = !handle.port;
  if (handle.port) {
    portClosed = await new Promise((resolve) => {
      const socket = net.connect({ host: '127.0.0.1', port: handle.port });
      socket.setTimeout(1000);
      socket.once('connect', () => { socket.destroy(); resolve(false); });
      socket.once('timeout', () => { socket.destroy(); resolve(false); });
      socket.once('error', (error) => resolve(error.code === 'ECONNREFUSED'));
    });
  }
  let temporaryRootRemoved = !handle.root;
  if (handle.root) {
    try {
      fs.rmSync(handle.root, { recursive: true, force: true });
      try { fs.lstatSync(handle.root); }
      catch (error) { temporaryRootRemoved = error.code === 'ENOENT'; }
    } catch {}
  }
  return { stopped, processGroupAbsent: group.groupAbsentAfterCleanup && group.groupClosedConfirmed, forcedCleanup: group.forcedCleanup, portClosed, temporaryRootRemoved };
}
