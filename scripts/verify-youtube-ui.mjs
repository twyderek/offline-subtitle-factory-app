import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { runYoutubeUiStateFixture } from './youtube-ui-state-fixture.mjs';
import { compareInstalledUi } from './compare-installed-ui.mjs';
import { cleanupProcessGroup } from '../lib/process-group-cleanup.mjs';
import { parseNativeTarget, validateCandidateApp } from './youtube-ui-cli.mjs';

// Source Electron UI smoke with an isolated profile. No OAuth or external uploads.
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = process.argv[2];
if (evidence?.startsWith('-')) throw new Error('Evidence output path must be the first positional argument.');
const validateUsability = process.argv.includes('--validate-usability');
const { nativeVersion, candidateAppPath } = parseNativeTarget(process.argv.slice(3));
const { candidateAppRoot, candidateExecutable } = candidateAppPath
  ? validateCandidateApp(candidateAppPath)
  : { candidateAppRoot: null, candidateExecutable: null };
const usabilityAudit = process.argv.includes('--usability') || validateUsability;
if (evidence && fs.existsSync(evidence)) throw new Error('Screenshot path already exists.');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'youtube-ui-smoke-'));
const job = path.join(profile, 'jobs', 'youtube-ui-smoke');
fs.mkdirSync(path.join(job, 'output'), { recursive: true });
fs.mkdirSync(path.join(job, 'review-output'));
fs.writeFileSync(path.join(job, 'output', '示範影片.mp4'), 'fixture-not-uploaded');
if (usabilityAudit || nativeVersion || process.argv.includes('--compare-installed')) {
  const media = spawnSync(path.join(appDir, 'tools/ffmpeg/bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'), [
    '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=navy:s=640x360:r=24',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100', '-t', '3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-movflags', '+faststart', path.join(job, 'output', '示範影片.mp4'),
  ], { timeout: 15000 });
  assert.equal(media.status, 0, 'Synthetic MP4 generation failed.');
}
fs.writeFileSync(path.join(job, 'review-output', 'reviewed.srt'), '1\n00:00:00,000 --> 00:00:01,000\n測試\n');
fs.mkdirSync(path.join(job, 'input'));
fs.copyFileSync(path.join(job, 'output', '示範影片.mp4'), path.join(job, 'input', '示範影片.mp4'));
fs.writeFileSync(path.join(job, 'job-config.json'), JSON.stringify({ jobId: 'youtube-ui-smoke', settings: {}, files: { video: '示範影片.mp4' } }));
fs.writeFileSync(path.join(job, 'job-status.json'), JSON.stringify({ status: 'completed', files: { reviewedSrt: path.join(job, 'review-output/reviewed.srt') } }));
const executable = nativeVersion === 'installed' ? '/Applications/離線字幕工廠.app/Contents/MacOS/離線字幕工廠'
  : nativeVersion === 'candidate' ? candidateExecutable : createRequire(import.meta.url)('electron');
let port;
let usabilityAuditResult;
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(executable, [...(nativeVersion === 'installed' || nativeVersion === 'candidate' ? [] : [appDir]), `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1'],
  { env, detached: Boolean(nativeVersion), stdio: ['ignore', 'ignore', 'ignore'] });
let spawnError;
child.on('error', (error) => { spawnError = error; });
let socket;
let sequence = 0;
const requests = new Map();
const rendererErrors = [];
async function call(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { requests.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, method === 'Runtime.evaluate' ? 30000 : 10000);
    requests.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description?.split('\n')[0] || 'Renderer evaluation failed.');
  return result.result?.value;
}
async function until(probe, { cleanup = false } = {}) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (!cleanup && rendererErrors.length) throw new Error(`Renderer: ${rendererErrors.slice(-3).join(' / ')}`);
    try { const value = await probe(); if (value) return value; } catch { /* wait for startup / navigation */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`UI smoke timed out.${rendererErrors.length ? ` Renderer: ${rendererErrors.slice(-3).join(' / ')}` : ''}`);
}
try {
  const activePort = path.join(profile, 'DevToolsActivePort');
  await until(() => fs.existsSync(activePort));
  const [portValue, browserEndpoint] = fs.readFileSync(activePort, 'utf8').trim().split('\n');
  port = Number(portValue);
  assert.ok(Number.isInteger(port) && port > 0 && port < 65536);
  assert.match(browserEndpoint, /^\/devtools\/browser\/[a-f0-9-]+$/);
  // The debugger endpoint comes only from this new profile's child process.
  const target = await until(async () => {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    return targets.find((item) => item.type === 'page' && item.url.startsWith('http://127.0.0.1:'));
  });
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === 'Runtime.exceptionThrown') {
      const detail = message.params.exceptionDetails;
      rendererErrors.push(detail.exception?.description?.split('\n')[0] || detail.text);
    }
    const request = requests.get(message.id);
    if (!request) return;
    clearTimeout(request.timeout); requests.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  });
  await call('Runtime.enable');
  const review = new URL(target.url); review.pathname = '/review/youtube-ui-smoke';
  await call('Page.navigate', { url: review.href });
  if (nativeVersion) {
    assert.ok(evidence, 'Native app diagnostic requires a fresh evidence path.');
    const runtimeAppRoot = nativeVersion === 'installed' ? '/Applications/離線字幕工廠.app/Contents/Resources/app'
      : nativeVersion === 'candidate' ? candidateAppRoot : appDir;
    await compareInstalledUi({ call, evaluate, socket, until, review, evidence, nativeVersion, executable, runtimeAppRoot });
    console.log(`Native ${nativeVersion} app diagnostic completed; measurements are not full product acceptance.`);
  }
  if (!nativeVersion || usabilityAudit) {
  if (process.argv.includes('--compare-installed')) {
    assert.ok(evidence, 'Frontend comparison requires a fresh evidence path.');
    await compareInstalledUi({ call, evaluate, socket, until, review, evidence });
  }
  await until(() => evaluate('Boolean(document.getElementById("openYoutubePublish") && !document.getElementById("openYoutubePublish").disabled && document.getElementById("youtubeDismiss") && window.electronAPI?.youtubePublish)'));
  const initial = await evaluate('window.electronAPI.youtubePublish("status")');
  assert.equal(initial.ok, true);
  assert.equal(initial.result.connected, false);
  const listing = await evaluate('window.electronAPI.youtubePublish("files", "youtube-ui-smoke")');
  assert.equal(listing.ok, true);
  assert.equal(listing.result.videos[0].name, '示範影片.mp4');
  const illegal = await evaluate('window.electronAPI.youtubePublish("files", "../escape")');
  assert.equal(illegal.ok, false);
  await evaluate('document.getElementById("openYoutubePublish").click()');
  await until(() => evaluate('document.getElementById("youtubeAccount")?.textContent.includes("尚未匯入")'));
  const ui = await evaluate(`(() => {
    const dialog = document.querySelector('dialog[aria-labelledby="youtubeTitle"]');
    const form = document.getElementById('youtubeForm');
    return { open: dialog.open, title: form.elements.title.value, video: form.elements.video.value,
      startDisabled: document.getElementById('youtubeStart').disabled,
      retryDisabled: document.getElementById('youtubeRetry').disabled,
      cancelDisabled: document.getElementById('youtubeCancel').disabled,
      consent: form.elements.consent.checked, fits: dialog.getBoundingClientRect().right <= innerWidth };
  })()`);
  assert.equal(ui.open, true); assert.equal(ui.video, '示範影片.mp4');
  assert.equal(ui.title, '示範影片');
  assert.equal(ui.startDisabled, true); assert.equal(ui.retryDisabled, true); assert.equal(ui.cancelDisabled, true);
  assert.equal(ui.consent, false); assert.equal(ui.fits, true);
  if (usabilityAudit) {
    assert.ok(evidence, 'Usability audit requires a fresh screenshot path.');
    await until(() => evaluate('document.getElementById("reviewVideo").readyState >= 1'));
    const audit = { mode: `${nativeVersion || 'source'}-electron-usability-audit`, googleRequests: false, measurements: [] };
    usabilityAuditResult = audit;
    audit.playback = await evaluate(`(async () => {
      const video=document.getElementById('reviewVideo'); video.muted=true; await video.play();
      const deadline=performance.now()+5000;
      while(video.currentTime <= 0 && performance.now()<deadline) await new Promise(resolve=>setTimeout(resolve,50));
      video.pause();
      return {duration:video.duration,currentTime:video.currentTime,paused:video.paused};
    })()`);
    assert.ok(audit.playback.currentTime > 0);
    for (const [width, height] of [[1400, 900], [1280, 800], [1100, 700], [1024, 700]]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      audit.measurements.push(await evaluate(`(() => {
        const dialog = document.querySelector('dialog[aria-labelledby=youtubeTitle]');
        const body = document.querySelector('.review-youtube-body'); body.scrollTop = 0;
        const rect = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return { left:r.left,right:r.right,top:r.top,bottom:r.bottom }; };
        const style = (id) => { const s=getComputedStyle(document.getElementById(id)); return {font:s.font,fontSize:s.fontSize,borderRadius:s.borderRadius,padding:s.padding,background:s.backgroundColor}; };
        const entry=rect('openYoutubePublish');
        const entryButton=document.getElementById('openYoutubePublish'); entryButton.style.display='none';
        const withoutYoutubeExport=rect('burnExport'); entryButton.style.display='';
        return { width:innerWidth,height:innerHeight,mediaDuration:document.getElementById('reviewVideo').duration,
          dialog:{clientHeight:dialog.clientHeight,scrollHeight:dialog.scrollHeight},
          body:{clientHeight:body.clientHeight,scrollHeight:body.scrollHeight},
          upload:rect('youtubeStart'),close:rect('youtubeClose'),entry,withoutYoutubeExport,
          existingButtonStyle:style('burnExport'),youtubeButtonStyle:style('youtubeStart'),
          reviewStatus:document.getElementById('reviewStatus').textContent };
      })()`));
    }
    if (validateUsability) {
      for (const measurement of audit.measurements.filter((item) => item.width >= 1100)) {
        assert.ok(measurement.entry.right <= measurement.width, 'YouTube entry must fit supported viewport.');
        for (const item of [measurement.upload, measurement.close]) {
          assert.ok(item.top >= 0 && item.bottom <= measurement.height, 'Footer actions must stay visible.');
        }
        assert.ok(measurement.body.clientHeight > 100, 'Scrollable body needs usable space.');
        assert.equal(measurement.youtubeButtonStyle.fontSize, measurement.existingButtonStyle.fontSize);
        assert.equal(measurement.youtubeButtonStyle.borderRadius, measurement.existingButtonStyle.borderRadius);
      }
    }
    // Missing config fails before opening an OAuth browser or making Google requests.
    await evaluate('document.querySelector("[data-action=connect]").click()');
    await until(() => evaluate('!document.getElementById("youtubeError").hidden'));
    audit.errorImmediately = await evaluate('document.getElementById("youtubeError").textContent');
    await new Promise((resolve) => setTimeout(resolve, 1900));
    audit.errorAfterPolling = await evaluate('document.getElementById("youtubeError").textContent');
    if (validateUsability) assert.equal(audit.errorAfterPolling, audit.errorImmediately);
    await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await evaluate('document.querySelector(".review-youtube-body").scrollTop=0');
    const screenshot = await call('Page.captureScreenshot', { format:'png' });
    fs.writeFileSync(evidence, Buffer.from(screenshot.data,'base64'), {flag:'wx'});
  }
  const record = { state: 'completed', channelId: 'channel-A', videoId: 'ui-video-1', captionId: 'ui-caption-1',
    captionStatus: 'syncing', progress: 100, language: 'zh-TW', videoAttempted: true };
  fs.writeFileSync(path.join(job, 'youtube-publish.json'), JSON.stringify(record));
  await until(() => evaluate('document.getElementById("youtubeIdentifiers")?.textContent.includes("ui-video-1")'));
  assert.match(await evaluate('document.getElementById("youtubeIdentifiers").textContent'), /syncing/);
  assert.equal(await evaluate('document.getElementById("youtubeResult").hidden'), false);
  assert.equal(await evaluate('document.getElementById("youtubeRetry").disabled'), true);
  // Exercise real Chromium keyboard behavior on the native dialog.
  await evaluate('document.getElementById("youtubeDismiss").focus()');
  for (let index = 0; index < 6; index++) {
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    assert.equal(await evaluate('document.querySelector("dialog[open]").contains(document.activeElement)'), true);
  }
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await until(() => evaluate('!document.querySelector("dialog[aria-labelledby=youtubeTitle]").open && document.activeElement.id === "openYoutubePublish"'));
  assert.equal(await evaluate('document.activeElement.id'), 'openYoutubePublish');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await until(() => evaluate('document.querySelector("dialog[aria-labelledby=youtubeTitle]").open'));
  if (evidence && !usabilityAudit) {
    await evaluate('document.querySelector("dialog[aria-labelledby=youtubeTitle]").scrollTop = document.querySelector("dialog[aria-labelledby=youtubeTitle]").scrollHeight');
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(evidence, Buffer.from(shot.data, 'base64'), { flag: 'wx' });
  }
  await evaluate('document.getElementById("youtubeClose").click()');
  assert.equal(await evaluate('document.querySelector("dialog[aria-labelledby=youtubeTitle]").open'), false);
  const partialJob = path.join(profile, 'jobs', 'youtube-ui-partial');
  fs.cpSync(job, partialJob, { recursive: true });
  fs.writeFileSync(path.join(partialJob, 'youtube-publish.json'), JSON.stringify({ ...record, state: 'partial', captionStatus: 'failed' }));
  review.pathname = '/review/youtube-ui-partial';
  await call('Page.navigate', { url: review.href });
  await until(() => evaluate('Boolean(document.getElementById("openYoutubePublish") && document.getElementById("youtubeIdentifiers"))'));
  await evaluate('document.getElementById("openYoutubePublish").click()');
  await until(() => evaluate('document.getElementById("youtubeIdentifiers")?.textContent.includes("failed")'));
  assert.match(await evaluate('document.getElementById("youtubeProgress").textContent'), /部分完成/);
  if (validateUsability) {
    await evaluate('document.getElementById("youtubeClose").click()');
    const fixture = await evaluate(`(${runYoutubeUiStateFixture.toString()})(${JSON.stringify(new URL('/youtube-publish.mjs?fixture=ui-state', review).href)})`);
    assert.equal(fixture.passed, true);
    usabilityAuditResult.rendererStateFixture = fixture;
  }
  if (usabilityAuditResult) {
    fs.writeFileSync(`${evidence}.json`, JSON.stringify(usabilityAuditResult, null, 2), { flag: 'wx' });
    console.log(JSON.stringify(usabilityAuditResult));
    console.log(validateUsability ? 'Supported viewport/style/error-retention assertions passed; real Google acceptance remains untested.'
      : 'Usability audit captured; measurements alone are not a usability pass.');
  }
  console.log(`YouTube Electron UI smoke passed: owned dynamic debugger, isolated profile, real IPC/file listing/traversal, modal controls/consent, video ID and syncing/failed caption states; screenshot=${Boolean(evidence)}. No Google requests.`);
  }
} finally {
  socket?.close();
  for (const pending of requests.values()) clearTimeout(pending.timeout);
  let cleanup;
  if (!spawnError) {
    if (nativeVersion) {
      cleanup = await cleanupProcessGroup(child.pid);
      assert.equal(cleanup.groupClosedConfirmed, true, 'Owned native process group cleanup unconfirmed; retaining profile.');
    } else child.kill('SIGTERM');
    await until(async () => child.exitCode !== null || child.signalCode !== null, { cleanup: true });
  }
  fs.rmSync(profile, { recursive: true, force: true });
  if (nativeVersion && evidence) fs.writeFileSync(`${evidence}.cleanup.json`, JSON.stringify({ ...cleanup, profileRemoved: !fs.existsSync(profile) }, null, 2), { flag: 'wx' });
}
