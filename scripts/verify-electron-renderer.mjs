import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const exePath = process.argv[2];
const port = Number(process.argv[3] || 9235);
const timeoutMs = Number(process.argv[4] || 30000);
const trimMediaPath = process.argv[5] || '';

if (!exePath) {
  throw new Error('Usage: node scripts/verify-electron-renderer.mjs <exe-path> [debug-port]');
}

const child = spawn(exePath, [`--remote-debugging-port=${port}`], {
  stdio: 'ignore',
  detached: false,
});

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function waitForTarget() {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const targets = await getJson(`http://127.0.0.1:${port}/json`);
      const pages = targets.filter((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      const page = pages.find((target) => /^http:\/\/127\.0\.0\.1:\d+\//.test(target.url || ''));
      if (page) return page;
    } catch {
      // App is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for Electron renderer target');
}

async function connectWebSocket(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out connecting to Electron DevTools')), 5000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('Failed to connect to Electron DevTools'));
    }, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const data = JSON.parse(String(event.data));
    if (data.id && pending.has(data.id)) {
      const { resolve, timer } = pending.get(data.id);
      clearTimeout(timer);
      pending.delete(data.id);
      resolve(data);
    }
  });

  return {
    call(method, params = {}) {
      const messageId = ++id;
      const message = JSON.stringify({ id: messageId, method, params });
      socket.send(message);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(messageId);
          reject(new Error(`Timed out waiting for DevTools method ${method}`));
        }, 15000);
        pending.set(messageId, { resolve, timer });
      });
    },
    close() {
      socket.close();
    },
  };
}

let client;
try {
  const target = await waitForTarget();
  client = await connectWebSocket(target.webSocketDebuggerUrl);

  const inspectExpression = `(() => ({
    href: location.href,
    title: document.title,
    hasPageSettingsButton: Boolean(document.getElementById('openSettings')),
    hasSettingsModal: Boolean(document.getElementById('appSettings')),
    hasWorkflowSettings: Boolean(document.querySelector('[data-step="appSettings"]')),
    hasHomeDashboard: Boolean(document.getElementById('homeDashboard')),
    homeDashboardVisible: !document.getElementById('homeDashboard')?.classList.contains('is-hidden'),
    hasHomeNavigation: Boolean(document.getElementById('navHome') && document.getElementById('navProjects') && document.getElementById('navProcessing')),
    hasNewProjectButton: Boolean(document.getElementById('homeNewProject')),
    hasCreateAndTrimButton: Boolean(document.getElementById('createAndTrim')),
    hasElectronApi: Boolean(window.electronAPI),
    hasSelectFolder: typeof window.electronAPI?.selectFolder === 'function',
    hasOpenArbitraryFolder: typeof window.electronAPI?.openArbitraryFolder === 'function',
    hasSafeAiKeyApi: typeof window.electronAPI?.saveAiKey === 'function' && typeof window.electronAPI?.clearAiKey === 'function',
    modalOpenBefore: document.getElementById('appSettings')?.classList.contains('is-open') || false
  }))()`;
  const before = await client.call('Runtime.evaluate', { expression: inspectExpression, returnByValue: true });
  await client.call('Runtime.evaluate', {
    expression: `window.dispatchEvent(new CustomEvent('open-app-settings'));`,
    returnByValue: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const after = await client.call('Runtime.evaluate', {
    expression: `(() => {
      const modal = document.getElementById('appSettings');
      return Boolean(modal?.classList.contains('is-open') && getComputedStyle(modal).display !== 'none' && modal.getClientRects().length);
    })()`,
    returnByValue: true,
  });

  const uploadFlow = await client.call('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const health = await fetch('/api/health', { cache: 'no-store' }).then((res) => res.json());
      const settings = await fetch('/api/settings', { cache: 'no-store' }).then((res) => res.json());
      const form = new FormData();
      form.append('video', new File([new Uint8Array([0, 1, 2, 3])], 'renderer-upload-test.mp4', { type: 'video/mp4' }));
      form.append('existingSrt', new File(['1\\n00:00:00,000 --> 00:00:01,000\\n打包版上傳測試\\n'], 'renderer-upload-test.srt', { type: 'text/plain' }));
      form.append('ruleFile', new File(['REMOVE_FILLER: 呃,啊\\n'], 'rule.txt', { type: 'text/plain' }));
      form.append('language', 'zh-TW');
      form.append('asrEngine', 'manual');
      form.append('outputFormats', 'srt');
      const createResponse = await fetch('/api/jobs', { method: 'POST', body: form });
      const created = await createResponse.json();
      if (!createResponse.ok) return { healthOk: health.ok, settingsOk: Boolean(settings.projectFolder), createStatus: createResponse.status, created };
      const startResponse = await fetch('/api/jobs/' + encodeURIComponent(created.jobId) + '/start', { method: 'POST' });
      let status = null;
      for (let i = 0; i < 20; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        status = await fetch('/api/jobs/' + encodeURIComponent(created.jobId) + '/status', { cache: 'no-store' }).then((res) => res.json());
        if (['completed', 'failed', 'cancelled', 'needs-action'].includes(status.status)) break;
      }
      return {
        healthOk: health.ok,
        settingsOk: Boolean(settings.projectFolder),
        createStatus: createResponse.status,
        startStatus: startResponse.status,
        jobId: created.jobId,
        finalStatus: status?.status,
        hasCleanedSrt: Boolean(status?.files?.cleanedSrt),
        folder: status?.folder,
      };
    })()`,
  });

  const trimAssets = await client.call('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const page = await fetch('/trim/packaged-smoke-test').then((res) => ({ ok: res.ok, text: res.text() }));
      const html = await page.text;
      const scriptOk = await fetch('/trim.js').then((res) => res.ok);
      return { pageOk: page.ok, scriptOk, hasWorkspace: html.includes('影片修剪工作區'), hasStartJob: html.includes('trimStartJob') };
    })()`,
  });

  const rendererJobId = uploadFlow.result.result.value.jobId;
  const aiReviewAssets = await client.call('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const jobId = ${JSON.stringify(rendererJobId)};
      const htmlResponse = await fetch('/review/' + encodeURIComponent(jobId));
      const html = await htmlResponse.text();
      const saveResponse = await fetch('/api/jobs/' + encodeURIComponent(jobId) + '/ai-project-settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ glossary: [{ source: 'Open AI', target: 'OpenAI', note: 'brand' }], prompts: { proofread: '測試範本' } })
      });
      const loaded = await fetch('/api/jobs/' + encodeURIComponent(jobId) + '/ai-project-settings').then((res) => res.json());
      const providers = await fetch('/api/ai/settings').then((res) => res.json());
      return {
        pageOk: htmlResponse.ok,
        saveStatus: saveResponse.status,
        hasSelectionUi: html.includes('aiScopeEstimate') && html.includes('value="search"') && html.includes('value="selected"'),
        hasSessionUi: html.includes('undoAiSession') && html.includes('redoAiSession'),
        hasSecureKeyUi: html.includes('clearAiKey') && html.includes('aiConsent'),
        hasCollapsibleAiUi: html.includes('id="aiToolbar" class="review-ai-toolbar collapsed"') && html.includes('id="toggleAiToolbar"') && html.includes('aria-controls="aiToolbarContent"'),
        glossaryRoundTrip: loaded.settings?.glossary?.[0]?.target === 'OpenAI',
        providerIds: providers.settings?.providers?.map((item) => item.id) || [],
      };
    })()`,
  });

  let packagedTrimFlow = { result: { result: { value: null } } };
  if (trimMediaPath) {
    const mediaBase64 = readFileSync(trimMediaPath).toString('base64');
    packagedTrimFlow = await client.call('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        const bytes = Uint8Array.from(atob('${mediaBase64}'), (char) => char.charCodeAt(0));
        const form = new FormData();
        form.append('video', new File([bytes], 'packaged-trim-test.mp4', { type: 'video/mp4' }));
        form.append('existingSrt', new File(['1\\n00:00:00,500 --> 00:00:01,500\\n跨越起點\\n\\n2\\n00:00:01,500 --> 00:00:02,500\\n保留字幕\\n\\n3\\n00:00:02,500 --> 00:00:03,500\\n跨越終點\\n'], 'packaged-trim-test.srt', { type: 'text/plain' }));
        form.append('language', 'zh-TW');
        const createdResponse = await fetch('/api/jobs', { method: 'POST', body: form });
        const created = await createdResponse.json();
        if (!createdResponse.ok) return { createStatus: createdResponse.status, error: created.error };
        const planResponse = await fetch('/api/jobs/' + encodeURIComponent(created.jobId) + '/edit-plan', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ in: 1, out: 3, strategy: 'precise' })
        });
        const applyResponse = await fetch('/api/jobs/' + encodeURIComponent(created.jobId) + '/apply-trim', { method: 'POST' });
        let trimStatus = null;
        for (let i = 0; i < 80; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          trimStatus = await fetch('/api/jobs/' + encodeURIComponent(created.jobId) + '/trim-status', { cache: 'no-store' }).then((res) => res.json());
          if (['completed', 'failed', 'cancelled'].includes(trimStatus.status)) break;
        }
        const startResponse = await fetch('/api/jobs/' + encodeURIComponent(created.jobId) + '/start', { method: 'POST' });
        let jobStatus = null;
        for (let i = 0; i < 40; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          jobStatus = await fetch('/api/jobs/' + encodeURIComponent(created.jobId) + '/status', { cache: 'no-store' }).then((res) => res.json());
          if (['completed', 'failed', 'cancelled', 'needs-action'].includes(jobStatus.status)) break;
        }
        const review = await fetch('/api/jobs/' + encodeURIComponent(created.jobId) + '/review-data').then((res) => res.json());
        return {
          jobId: created.jobId,
          createStatus: createdResponse.status,
          planStatus: planResponse.status,
          applyStatus: applyResponse.status,
          trimStatus: trimStatus?.status,
          trimDuration: trimStatus?.mediaInfo?.duration,
          startStatus: startResponse.status,
          jobStatus: jobStatus?.status,
          usesTrimmedVideo: /media-trimmed\\.mp4/.test(review.videoUrl || ''),
          shiftedSubtitle: /00:00:00,000 --> 00:00:00,500/.test(review.subtitle || ''),
        };
      })()`,
    });
  }

  const folderIconFlow = await client.call('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      window.dispatchEvent(new CustomEvent('open-app-settings'));
      await new Promise((resolve) => setTimeout(resolve, 200));
      const input = document.getElementById('projectFolder');
      const button = document.querySelector('.folder-open[data-folder-target="projectFolder"]');
      window.__skipNativeFolderOpenForTest = true;
      input.value = 'C:\\\\Temp\\\\offline-subtitle-folder-open-test';
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 300));
      delete window.__skipNativeFolderOpenForTest;
      return {
        hasButton: Boolean(button),
        requestedPath: button.dataset.openRequested || null,
        openResult: button.dataset.openResult || null,
      };
    })()`,
  });

  const result = {
    exe: path.resolve(exePath),
    before: before.result.result.value,
    modalOpenAfterEvent: after.result.result.value,
    uploadFlow: uploadFlow.result.result.value,
    trimAssets: trimAssets.result.result.value,
    aiReviewAssets: aiReviewAssets.result.result.value,
    packagedTrimFlow: packagedTrimFlow.result.result.value,
    folderIconFlow: folderIconFlow.result.result.value,
  };
  console.log(JSON.stringify(result, null, 2));

  if (result.before.hasPageSettingsButton) throw new Error('Page settings button still exists');
  if (!result.before.hasSettingsModal) throw new Error('Settings modal is missing');
  if (result.before.hasWorkflowSettings) throw new Error('Workflow settings step still exists');
  if (!result.before.hasHomeDashboard || !result.before.homeDashboardVisible) throw new Error('Approved home dashboard is missing or hidden');
  if (!result.before.hasHomeNavigation) throw new Error('Home navigation is missing');
  if (!result.before.hasNewProjectButton) throw new Error('New project action is missing');
  if (!result.before.hasCreateAndTrimButton) throw new Error('Create-and-trim action is missing');
  if (!result.before.hasElectronApi) throw new Error('Electron preload API is missing');
  if (!result.before.hasSelectFolder) throw new Error('Electron selectFolder API is missing');
  if (!result.before.hasOpenArbitraryFolder) throw new Error('Electron openArbitraryFolder API is missing');
  if (!result.before.hasSafeAiKeyApi) throw new Error('Electron safe AI key API is missing');
  if (!result.modalOpenAfterEvent) throw new Error('Settings modal did not open visibly from renderer event');
  if (!result.uploadFlow.healthOk) throw new Error('Renderer health fetch failed');
  if (!result.uploadFlow.settingsOk) throw new Error('Renderer settings fetch failed');
  if (result.uploadFlow.createStatus !== 201) throw new Error(`Renderer upload create job failed: ${result.uploadFlow.createStatus}`);
  if (result.uploadFlow.startStatus !== 202) throw new Error(`Renderer start job failed: ${result.uploadFlow.startStatus}`);
  if (result.uploadFlow.finalStatus !== 'completed') throw new Error(`Renderer upload job did not complete: ${result.uploadFlow.finalStatus}`);
  if (!result.uploadFlow.hasCleanedSrt) throw new Error('Renderer upload job did not produce cleaned SRT');
  if (!result.trimAssets.pageOk || !result.trimAssets.scriptOk || !result.trimAssets.hasWorkspace || !result.trimAssets.hasStartJob) throw new Error('Packaged trim workspace assets are missing');
  if (!result.aiReviewAssets.pageOk || result.aiReviewAssets.saveStatus !== 200) throw new Error('Packaged AI review settings API is unavailable');
  if (!result.aiReviewAssets.hasSelectionUi || !result.aiReviewAssets.hasSessionUi || !result.aiReviewAssets.hasSecureKeyUi) throw new Error('Packaged 0.45 AI review controls are missing');
  if (!result.aiReviewAssets.hasCollapsibleAiUi) throw new Error('Packaged 0.45.1 collapsible AI toolbar is missing');
  if (!result.aiReviewAssets.glossaryRoundTrip) throw new Error('Packaged glossary settings did not round-trip');
  if (!['openai', 'openai-compatible', 'azure'].every((id) => result.aiReviewAssets.providerIds.includes(id))) throw new Error('Packaged provider definitions are incomplete');
  if (trimMediaPath) {
    if (result.packagedTrimFlow.createStatus !== 201 || result.packagedTrimFlow.planStatus !== 200 || result.packagedTrimFlow.applyStatus !== 202) throw new Error('Packaged real trim flow could not start');
    if (result.packagedTrimFlow.trimStatus !== 'completed' || Math.abs(result.packagedTrimFlow.trimDuration - 2) > 0.5) throw new Error('Packaged real trim output is invalid');
    if (result.packagedTrimFlow.startStatus !== 202 || result.packagedTrimFlow.jobStatus !== 'completed') throw new Error('Packaged post-trim subtitle job did not complete');
    if (!result.packagedTrimFlow.usesTrimmedVideo || !result.packagedTrimFlow.shiftedSubtitle) throw new Error('Packaged review data is not synchronized to trimmed media');
  }
  if (!result.folderIconFlow.hasButton) throw new Error('Folder open icon button is missing');
  if (!result.folderIconFlow.requestedPath?.includes('offline-subtitle-folder-open-test')) throw new Error('Folder open icon did not request the entered path');
  if (result.folderIconFlow.openResult !== 'skipped') throw new Error('Folder open icon did not reach the open-folder flow');
} finally {
  client?.close();
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }).on('error', () => {});
  } else {
    child.kill('SIGTERM');
  }
}
