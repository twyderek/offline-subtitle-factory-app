const button = document.getElementById('openYoutubePublish');
const jobId = location.pathname.split('/').filter(Boolean).at(-1);
const dialog = document.createElement('dialog');
dialog.className = 'review-youtube-dialog';
dialog.setAttribute('aria-labelledby', 'youtubeTitle');
dialog.setAttribute('aria-describedby', 'youtubeDescription');
dialog.innerHTML = `
  <header class="review-youtube-header">
    <div><h2 id="youtubeTitle">上傳 YouTube</h2><p id="youtubeDescription">將已匯出的影片與校閱字幕上傳為私人影片。</p></div>
    <button id="youtubeDismiss" class="review-button" type="button" aria-label="關閉 YouTube 上傳視窗">✕</button>
    <p id="youtubeError" class="review-youtube-error" role="alert" hidden></p>
  </header>
  <div class="review-youtube-body" tabindex="0" aria-label="YouTube 上傳設定內容">
    <section class="review-youtube-account" aria-label="YouTube 頻道">
      <p id="youtubeAccount" role="status">正在讀取頻道設定…</p>
      <details id="youtubeSetup">
        <summary>頻道設定與首次使用說明</summary>
        <p>在 Google Cloud 啟用 YouTube Data API v3，建立「桌面應用程式」OAuth client，下載 JSON 後匯入；測試模式須將登入帳號加入測試使用者。</p>
        <div class="review-youtube-actions">
          <button class="review-button" type="button" data-action="configure">匯入 OAuth JSON</button>
          <button class="review-button" type="button" data-action="connect">連結頻道</button>
          <button class="review-button" type="button" data-action="disconnect">移除本機授權</button>
        </div>
        <p>移除本機授權不會撤銷 Google 帳戶端權限；可至 Google 帳戶的第三方連線撤銷。</p>
      </details>
    </section>
    <form id="youtubeForm" class="review-ai-settings-grid">
      <label class="full">已匯出的 MP4 <select name="video" required></select></label>
      <p id="youtubeSubtitle" class="full review-youtube-hint"></p>
      <label class="full">標題 <input name="title" required maxlength="100"></label>
      <label class="full">說明 <textarea name="description" rows="3"></textarea></label>
      <label>字幕語言 <input name="language" value="zh-TW" required maxlength="35"></label>
      <label>兒童專屬內容 <select name="madeForKids" required><option value="">請選擇</option><option value="no">否</option><option value="yes">是</option></select></label>
      <label class="full review-youtube-consent"><input name="consent" type="checkbox" required><span>我同意將選取的影片、已保存字幕與影片資訊上傳至畫面所示頻道。</span></label>
      <p class="full review-youtube-hint">先儲存字幕並匯出 MP4。重試使用原上傳時的字幕快照，新編輯不會套用。公開與排程請至 YouTube Studio 操作。</p>
    </form>
  </div>
  <footer class="review-youtube-footer">
    <p id="youtubeProgress" role="status" aria-live="polite">正在讀取上傳狀態…</p>
    <p id="youtubeIdentifiers" class="review-youtube-hint" aria-live="polite"></p>
    <a id="youtubeResult" target="_blank" rel="noopener noreferrer" hidden>前往 YouTube Studio</a>
    <p id="youtubeBackgroundHint" class="review-youtube-hint" hidden>關閉視窗不會停止上傳；若要取消，請按「停止傳送」。</p>
    <div class="review-youtube-actions">
      <button class="review-button" type="button" id="youtubeClose">關閉視窗</button>
      <button class="review-button" type="button" id="youtubeReset" hidden>清除未傳送工作</button>
      <button class="review-button" type="button" id="youtubeCancel" hidden>停止傳送</button>
      <button class="review-button" type="button" id="youtubeRetry" hidden>只重試原字幕</button>
      <button class="review-button primary" type="submit" form="youtubeForm" id="youtubeStart">上傳為私人影片</button>
    </div>
  </footer>`;
document.body.append(dialog);
const find = (selector) => dialog.querySelector(selector);
const form = find('form');
const fields = form.elements;
let timer;
let pending = false;
let account = {};
let record = null;
let hasSubtitle = false;
let viewGeneration = 0;
let revision = 0;
let fileSignature = '';
let suggestedTitle = false;
const active = () => ['preparing', 'uploading-video', 'uploading-captions'].includes(record?.state);
function setText(selector, value) {
  const element = find(selector);
  if (element.textContent !== value) element.textContent = value;
}
function showError(message) {
  setText('#youtubeError', message);
  find('#youtubeError').hidden = !message;
}
async function invoke(action, input) {
  if (!window.electronAPI?.youtubePublish) throw new Error('此功能需要 Electron 桌面版。');
  const response = await window.electronAPI.youtubePublish(action, jobId, input);
  if (!response.ok) throw new Error(response.error || 'YouTube 操作失敗。');
  return response.result;
}
function controls() {
  const unavailable = !window.electronAPI?.youtubePublish;
  const busy = pending || account.busy;
  find('#youtubeStart').disabled = unavailable || busy || !account.connected || Boolean(record)
    || !fields.video.value || !hasSubtitle || !fields.title.value.trim() || !fields.language.value.trim()
    || !fields.madeForKids.value || !fields.consent.checked;
  find('#youtubeStart').hidden = Boolean(record);
  find('#youtubeRetry').hidden = !record?.videoId || record.state === 'completed' || active();
  find('#youtubeRetry').disabled = unavailable || busy || !account.connected || !fields.consent.checked
    || !record?.videoId || record.state === 'completed' || active();
  find('#youtubeCancel').hidden = !active();
  find('#youtubeCancel').disabled = unavailable || pending || !active();
  find('#youtubeReset').hidden = !record || record.videoAttempted !== false || active();
  find('#youtubeReset').disabled = unavailable || busy;
  find('#youtubeBackgroundHint').hidden = !active();
  form.querySelectorAll('input,textarea,select').forEach((element) => { element.disabled = active(); });
  dialog.querySelectorAll('[data-action]').forEach((element) => { element.disabled = unavailable || busy; });
  dialog.setAttribute('aria-busy', String(Boolean(pending || active())));
}
async function refresh(generation = viewGeneration, requestRevision = revision) {
  const nextAccount = await invoke('status');
  const listing = await invoke('files');
  // A poll from before a user action or a closed view must not restore old UI state.
  if (!dialog.open || generation !== viewGeneration || requestRevision !== revision) return;
  if (account.channel?.id !== nextAccount.channel?.id) fields.consent.checked = false;
  account = nextAccount;
  record = listing.record;
  setText('#youtubeAccount', account.connected
    ? `已連結頻道：${account.channel?.title || ''}（${account.channel?.id || ''}）`
    : account.configured ? '已匯入設定，請在「頻道設定」連結頻道。' : '尚未匯入 OAuth 設定，請先展開「頻道設定」完成連結。');
  const nextSignature = JSON.stringify(listing.videos);
  if (nextSignature !== fileSignature) {
    const selected = fields.video.value;
    if (fileSignature) fields.consent.checked = false;
    fields.video.replaceChildren(...listing.videos.map((video) => {
      const option = document.createElement('option');
      option.value = video.name;
      option.textContent = `${video.name}（${(video.size / 1024 / 1024).toFixed(1)} MB）`;
      return option;
    }));
    if (listing.videos.some((video) => video.name === selected)) fields.video.value = selected;
    if (fields.video.value !== selected) fields.consent.checked = false;
    fileSignature = nextSignature;
  }
  if (!suggestedTitle && fields.video.value) {
    if (!fields.title.value) fields.title.value = fields.video.value.replace(/\.mp4$/i, '').slice(0, 100);
    suggestedTitle = true;
  }
  hasSubtitle = listing.subtitle;
  setText('#youtubeSubtitle', listing.subtitle ? '字幕：已保存的 reviewed.srt' : '尚未保存校閱字幕，請先關閉視窗並按「儲存」。');
  const stateLabels = { preparing: '準備中', 'uploading-video': '影片上傳中', 'uploading-captions': '字幕上傳中',
    completed: '已上傳', partial: '部分完成', cancelled: '已取消', failed: '未完成', interrupted: '上傳中斷' };
  setText('#youtubeProgress', record
    ? `${stateLabels[record.state] || record.state} · ${record.progress || 0}% — ${record.message}`
    : !account.connected ? '請先連結頻道，再確認影片資訊與上傳同意。'
      : !listing.videos.length ? '尚無 MP4，請先匯出影片。'
        : !listing.subtitle ? '請先儲存校閱字幕。' : '確認影片資訊並勾選同意後，即可上傳。');
  setText('#youtubeIdentifiers', record
    ? `影片 ID：${record.videoId || '尚未取得'}；字幕狀態：${record.captionStatus || '尚未取得'}；字幕 ID：${record.captionId || '尚未取得'}` : '');
  const link = find('#youtubeResult');
  link.hidden = !record?.videoId;
  if (record?.videoId) link.href = `https://studio.youtube.com/video/${encodeURIComponent(record.videoId)}/edit`;
  controls();
}
async function perform(action, input) {
  if (pending) return;
  const generation = viewGeneration;
  const requestRevision = ++revision;
  showError('');
  if (action === 'connect' && !account.configured) {
    find('#youtubeSetup').open = true;
    showError('請先匯入 Google Desktop OAuth JSON，再連結頻道。');
    return;
  }
  pending = true; controls();
  try { await invoke(action, input); await refresh(generation, requestRevision); }
  catch (error) { if (generation === viewGeneration) showError(error.message); }
  finally { pending = false; controls(); }
}
async function poll(generation) {
  if (!dialog.open || generation !== viewGeneration) return;
  const requestRevision = revision;
  try { if (!pending) await refresh(generation, requestRevision); }
  catch (error) { if (generation === viewGeneration && requestRevision === revision) showError(error.message); }
  if (dialog.open && generation === viewGeneration) timer = setTimeout(() => poll(generation), 1500);
}
button?.addEventListener('click', async () => {
  if (dialog.open) return;
  const generation = ++viewGeneration;
  dialog.showModal();
  find('#youtubeDismiss').focus({ preventScroll: true });
  controls();
  if (!window.electronAPI?.youtubePublish) {
    showError('此功能需要 Electron 桌面版；瀏覽器模式可繼續離線校閱及輸出。');
    return;
  }
  try { await refresh(generation); }
  catch (error) { if (generation === viewGeneration) showError(error.message); }
  if (dialog.open && generation === viewGeneration) timer = setTimeout(() => poll(generation), 1500);
});
dialog.addEventListener('close', () => {
  if (dialog.open) return; // Ignore a queued close event after a quick reopen.
  ++viewGeneration;
  clearTimeout(timer);
  button?.focus({ preventScroll: true });
});
for (const selector of ['#youtubeClose', '#youtubeDismiss']) find(selector).addEventListener('click', () => dialog.close());
dialog.querySelectorAll('[data-action]').forEach((element) => element.addEventListener('click', () => perform(element.dataset.action)));
form.addEventListener('input', controls);
form.addEventListener('change', (event) => {
  if (event.target === fields.video) fields.consent.checked = false;
  controls();
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (find('#youtubeStart').disabled || find('#youtubeStart').hidden || !form.reportValidity()) return;
  perform('start', { video: fields.video.value, title: fields.title.value, description: fields.description.value,
    language: fields.language.value, madeForKids: fields.madeForKids.value === 'yes', consent: fields.consent.checked });
});
find('#youtubeRetry').addEventListener('click', () => {
  if (!fields.consent.checked) { showError('請勾選上傳同意後再重試字幕。'); return; }
  perform('retry-captions', { consent: true });
});
find('#youtubeCancel').addEventListener('click', () => perform('cancel'));
find('#youtubeReset').addEventListener('click', () => perform('reset-unsent'));
if (button) button.disabled = false;
