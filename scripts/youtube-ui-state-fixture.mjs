// Executed by CDP inside an isolated test Electron renderer. The iframe gets
// a local in-memory bridge; no request reaches real Google or main-process IPC.
export async function runYoutubeUiStateFixture(moduleUrl) {
  const expect = (condition, message) => { if (!condition) throw new Error(message); };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function until(probe) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) { if (probe()) return; await sleep(20); }
    throw new Error('Renderer state fixture timed out.');
  }
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-10000px;width:1100px;height:700px';
  const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  frame.srcdoc = '<!doctype html><html><body><button id="openYoutubePublish">Open fixture</button></body></html>';
  document.body.append(frame);
  await loaded;
  const doc = frame.contentDocument;
  const account = { configured: true, connected: true, channel: { id: 'channel-A', title: 'Fixture' }, busy: false };
  let record = null;
  let hasSubtitle = true;
  let holdFiles = false;
  let heldFiles;
  let connectFails = true;
  const calls = [];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const listing = () => ({ videos: [{ name: 'one.mp4', size: 12 }, { name: 'two.mp4', size: 24 }], subtitle: hasSubtitle, record: clone(record) });
  const api = async (action, _jobId, input) => {
    calls.push({ action, input });
    if (action === 'status') return { ok: true, result: clone(account) };
    if (action === 'files') {
      const result = listing();
      if (holdFiles) {
        holdFiles = false;
        return new Promise((resolve) => { heldFiles = () => resolve({ ok: true, result }); });
      }
      return { ok: true, result };
    }
    if (action === 'connect' && connectFails) return { ok: false, error: 'Fixture authorization failure' };
    if (action === 'start') {
      expect(input.consent === true && input.madeForKids === false && input.video === 'one.mp4', 'Start payload lost consent or metadata.');
      record = { state: 'uploading-video', progress: 10, videoId: 'fixture-video', message: 'Fixture uploading', videoAttempted: true };
      account.busy = true;
    }
    if (action === 'cancel') {
      account.busy = false;
      record = { ...record, state: 'partial', message: 'Fixture partial' };
    }
    if (action === 'retry-captions') {
      expect(input.consent === true, 'Retry lost consent.');
      record = { ...record, state: 'completed', captionStatus: 'syncing', captionId: 'fixture-caption', message: 'Fixture accepted' };
    }
    return { ok: true, result: clone(account) };
  };
  frame.contentWindow.electronAPI = { youtubePublish: api };
  const script = doc.createElement('script');
  script.type = 'module'; script.src = moduleUrl;
  const ready = new Promise((resolve, reject) => { script.onload = resolve; script.onerror = () => reject(new Error('Fixture module failed to load.')); });
  doc.body.append(script);
  try {
    await ready;
    const get = (id) => doc.getElementById(id);
    const open = () => get('openYoutubePublish').click();
    const form = get('youtubeForm');
    const fields = form.elements;
    open();
    await until(() => get('youtubeAccount').textContent.includes('channel-A'));
    expect(get('youtubeStart').disabled, 'Missing consent must block start.');
    fields.madeForKids.value = 'no'; fields.consent.checked = true;
    form.dispatchEvent(new frame.contentWindow.Event('input', { bubbles: true }));
    expect(!get('youtubeStart').disabled, 'Prepared form must allow private upload.');

    const option = fields.video.options[0];
    fields.title.value = '';
    form.dispatchEvent(new frame.contentWindow.Event('input', { bubbles: true }));
    await sleep(1700);
    expect(fields.title.value === '', 'Poll must not overwrite a deliberately cleared title.');
    expect(fields.video.options[0] === option, 'Unchanged poll must not rebuild the file selector.');
    fields.title.value = 'Fixture title';
    fields.video.value = 'two.mp4'; fields.video.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true }));
    expect(!fields.consent.checked, 'File change must clear consent.');
    fields.video.value = 'one.mp4'; fields.video.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true }));
    fields.consent.checked = true; form.dispatchEvent(new frame.contentWindow.Event('input', { bubbles: true }));

    // A pre-action poll returns after start has rendered its new active state.
    holdFiles = true;
    await until(() => heldFiles);
    form.requestSubmit(get('youtubeStart'));
    await until(() => get('youtubeProgress').textContent.includes('Fixture uploading'));
    heldFiles(); heldFiles = null;
    await sleep(100);
    expect(!get('youtubeCancel').hidden && fields.title.disabled, 'Stale poll must not restore the old idle state.');
    expect(!get('youtubeBackgroundHint').hidden, 'Active close/background semantics need an explanation.');
    get('youtubeCancel').click();
    await until(() => get('youtubeProgress').textContent.includes('Fixture partial'));
    expect(!get('youtubeRetry').hidden && !get('youtubeRetry').disabled, 'Partial work should allow caption-only retry.');
    get('youtubeRetry').click();
    await until(() => get('youtubeIdentifiers').textContent.includes('fixture-caption'));
    expect(get('youtubeRetry').hidden && get('youtubeStart').hidden, 'Completed work must not offer duplicate publication.');

    doc.querySelector('[data-action=connect]').click();
    await until(() => !get('youtubeError').hidden);
    const failure = get('youtubeError').textContent;
    await sleep(1700);
    expect(get('youtubeError').textContent === failure && !get('youtubeError').hidden, 'Polling must preserve an IPC action failure.');
    connectFails = false;
    doc.querySelector('[data-action=connect]').click();
    await until(() => get('youtubeError').hidden);

    // Channel changes clear consent; missing subtitle remains fail-closed.
    record = null; hasSubtitle = false; account.channel = { id: 'channel-B', title: 'Second channel' };
    await until(() => get('youtubeAccount').textContent.includes('channel-B'));
    expect(!fields.consent.checked && get('youtubeStart').disabled, 'Channel change or missing SRT must block publication.');
    get('youtubeClose').click();
    await sleep(30);
    expect(doc.activeElement === get('openYoutubePublish'), 'Close must restore entry focus.');
    expect(calls.filter((call) => call.action === 'start').length === 1, 'Only one video-start action is expected.');
    return { passed: true, cases: ['consent', 'preserved-editor-and-options', 'file-change', 'stale-poll', 'active-cancel',
      'caption-only-retry', 'completed-no-duplicate', 'persistent-ipc-error', 'next-action-clear', 'channel-change', 'missing-srt', 'focus-return'],
      videoStarts: 1, realGoogleRequests: false };
  } finally {
    heldFiles?.();
    doc.querySelector('dialog[open]')?.close();
    frame.remove();
  }
}
