const API_BASE = window.location.origin.startsWith('http') ? window.location.origin : 'http://127.0.0.1:8790';
const API_TOKEN = new URLSearchParams(window.location.search).get('token') || '';
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const requestUrl = new URL(typeof input === 'string' ? input : input.url, window.location.href);
  if (!API_TOKEN || requestUrl.origin !== API_BASE || !requestUrl.pathname.startsWith('/api/')) return nativeFetch(input, init);
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
  headers.set('X-Offline-Subtitle-Token', API_TOKEN);
  return nativeFetch(input, { ...init, headers });
};

function appUrl(pathname) {
  const url = new URL(pathname, `${API_BASE}/`);
  if (API_TOKEN) url.searchParams.set('token', API_TOKEN);
  return url.toString();
}

const jobId = location.pathname.split('/').filter(Boolean).at(-1);
const state = {
  duration: 0,
  start: 0,
  end: 0,
  peaks: [],
  dragging: '',
  loop: false,
  pollTimer: null,
  applied: false,
  jobStatus: '',
};
const ids = [
  'trimVideo', 'trimProjectName', 'trimSaveState', 'trimBack5', 'trimPlay', 'trimForward5', 'trimLoop', 'trimClock',
  'trimRuler', 'trimTimeline', 'trimWaveform', 'trimDiscardLeft', 'trimSelection', 'trimDiscardRight', 'trimPlayhead',
  'trimInHandle', 'trimOutHandle', 'trimInLabel', 'trimOutLabel', 'trimWaveformStatus', 'trimOriginalDuration',
  'trimKeepDuration', 'trimRemoveDuration', 'trimStartInput', 'trimEndInput', 'trimSetIn', 'trimSetOut', 'trimModeHint',
  'trimProgressPanel', 'trimProgressText', 'trimProgressPercent', 'trimProgressBar', 'trimCancelProcess', 'trimStatusMessage',
  'trimReset', 'trimApply', 'trimApplyTop', 'trimRestore', 'trimBackHome', 'trimOpenReview', 'trimOpenExport',
  'trimImport', 'trimLoadVideo', 'trimStartJob',
];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

el.trimBackHome.addEventListener('click', () => { location.href = appUrl('/'); });
el.trimImport.addEventListener('click', () => { location.href = appUrl('/?open=import'); });
el.trimLoadVideo.addEventListener('click', () => { location.href = appUrl('/?open=new-project'); });
el.trimOpenReview.addEventListener('click', () => { location.href = appUrl(`/review/${encodeURIComponent(jobId)}?stage=proofread`); });
el.trimOpenExport.addEventListener('click', () => { location.href = appUrl(`/review/${encodeURIComponent(jobId)}?stage=burn`); });
el.trimBack5.addEventListener('click', () => seek(el.trimVideo.currentTime - 5));
el.trimForward5.addEventListener('click', () => seek(el.trimVideo.currentTime + 5));
el.trimPlay.addEventListener('click', togglePlay);
el.trimLoop.addEventListener('click', () => {
  state.loop = !state.loop;
  el.trimLoop.classList.toggle('active', state.loop);
});
el.trimSetIn.addEventListener('click', () => setBoundary('in', el.trimVideo.currentTime));
el.trimSetOut.addEventListener('click', () => setBoundary('out', el.trimVideo.currentTime));
el.trimStartInput.addEventListener('change', () => setBoundary('in', parseClock(el.trimStartInput.value)));
el.trimEndInput.addEventListener('change', () => setBoundary('out', parseClock(el.trimEndInput.value)));
[el.trimStartInput, el.trimEndInput].forEach((input, index) => {
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    setBoundary(index === 0 ? 'in' : 'out', parseClock(input.value));
    input.select();
  });
});
el.trimReset.addEventListener('click', resetRange);
el.trimApply.addEventListener('click', applyTrim);
el.trimApplyTop.addEventListener('click', applyTrim);
el.trimRestore.addEventListener('click', restoreOriginal);
el.trimCancelProcess.addEventListener('click', cancelTrim);
el.trimStartJob.addEventListener('click', startSubtitleJob);
document.querySelectorAll('input[name="trimStrategy"]').forEach((input) => input.addEventListener('change', updateModeHint));

el.trimTimeline.addEventListener('pointerdown', handleTimelinePointerDown);
window.addEventListener('pointermove', handleTimelinePointerMove);
window.addEventListener('pointerup', () => { state.dragging = ''; });
el.trimInHandle.addEventListener('pointerdown', (event) => beginHandleDrag(event, 'in'));
el.trimOutHandle.addEventListener('pointerdown', (event) => beginHandleDrag(event, 'out'));
el.trimVideo.addEventListener('timeupdate', () => {
  if (state.loop && el.trimVideo.currentTime >= state.end) seek(state.start);
  updatePlayhead();
});
el.trimVideo.addEventListener('play', () => { el.trimPlay.textContent = 'Ⅱ'; });
el.trimVideo.addEventListener('pause', () => { el.trimPlay.textContent = '▶'; });
window.addEventListener('keydown', handleShortcut);
if ('ResizeObserver' in window) new ResizeObserver(drawWaveform).observe(el.trimTimeline);

loadTrimProject();

async function loadTrimProject() {
  if (!jobId) return statusMessage('缺少任務 ID', true);
  try {
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/edit-plan`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    state.duration = Number(data.sourceDuration || 0);
    state.start = Number(data.plan?.in ?? 0);
    state.end = Number(data.plan?.out ?? state.duration);
    state.applied = Boolean(data.plan?.appliedAt);
    state.jobStatus = data.jobStatus?.status || '';
    el.trimProjectName.textContent = String(data.sourceFileName || jobId).replace(/\.[^.]+$/, '');
    el.trimSaveState.textContent = state.applied ? '已套用修剪' : '非破壞式編輯';
    el.trimVideo.src = data.originalVideoUrl;
    const strategy = data.plan?.strategy || 'precise';
    const strategyInput = document.querySelector(`input[name="trimStrategy"][value="${strategy}"]`);
    if (strategyInput) strategyInput.checked = true;
    updateModeHint();
    renderTimeline();
    updateStartJobAction();
    await loadWaveform();
    if (data.trimStatus?.status === 'running') startPolling();
    else statusMessage(state.applied ? '目前已使用修剪後影片，可重新調整或還原。' : '拖曳時間軸把手，或使用 I／O 設定起點與終點。');
  } catch (error) {
    statusMessage(`載入修剪工作區失敗：${error.message}`, true);
  }
}

async function loadWaveform() {
  el.trimWaveformStatus.hidden = false;
  el.trimWaveformStatus.textContent = '正在讀取原始影片聲波…';
  try {
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/waveform?points=720&source=original`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.peaks)) throw new Error(data.error || `HTTP ${response.status}`);
    state.peaks = data.peaks;
    el.trimWaveformStatus.hidden = true;
    drawWaveform();
  } catch (error) {
    state.peaks = [];
    el.trimWaveformStatus.textContent = `無法產生聲波：${error.message}`;
    drawWaveform();
  }
}

function beginHandleDrag(event, boundary) {
  event.preventDefault();
  event.stopPropagation();
  state.dragging = boundary;
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function handleTimelinePointerDown(event) {
  if (event.target.closest('.trim-handle')) return;
  const value = timelineSeconds(event.clientX);
  seek(value);
}

function handleTimelinePointerMove(event) {
  if (!state.dragging) return;
  setBoundary(state.dragging, timelineSeconds(event.clientX), false);
}

function timelineSeconds(clientX) {
  const rect = el.trimTimeline.getBoundingClientRect();
  return Math.max(0, Math.min(state.duration, ((clientX - rect.left) / rect.width) * state.duration));
}

function setBoundary(type, value, seekVideo = true) {
  if (!Number.isFinite(value)) return renderTimeline();
  if (type === 'in') state.start = Math.max(0, Math.min(value, state.end - 0.5));
  else state.end = Math.min(state.duration, Math.max(value, state.start + 0.5));
  if (seekVideo) seek(type === 'in' ? state.start : state.end);
  state.applied = false;
  el.trimSaveState.textContent = '尚未套用';
  renderTimeline();
}

function resetRange() {
  state.start = 0;
  state.end = state.duration;
  state.applied = false;
  el.trimSaveState.textContent = '尚未套用';
  renderTimeline();
  seek(0);
}

function renderTimeline() {
  const startRatio = state.duration > 0 ? state.start / state.duration : 0;
  const endRatio = state.duration > 0 ? state.end / state.duration : 1;
  const startPercent = `${startRatio * 100}%`;
  const endPercent = `${endRatio * 100}%`;
  el.trimDiscardLeft.style.width = startPercent;
  el.trimSelection.style.left = startPercent;
  el.trimSelection.style.width = `${Math.max(0, endRatio - startRatio) * 100}%`;
  el.trimDiscardRight.style.left = endPercent;
  el.trimDiscardRight.style.width = `${Math.max(0, 1 - endRatio) * 100}%`;
  el.trimInHandle.style.left = startPercent;
  el.trimOutHandle.style.left = endPercent;
  el.trimInLabel.textContent = `起點 ${formatClock(state.start)}`;
  el.trimOutLabel.textContent = `終點 ${formatClock(state.end)}`;
  el.trimStartInput.value = formatClock(state.start);
  el.trimEndInput.value = formatClock(state.end);
  el.trimOriginalDuration.textContent = formatClock(state.duration);
  el.trimKeepDuration.textContent = formatClock(Math.max(0, state.end - state.start));
  el.trimRemoveDuration.textContent = formatClock(Math.max(0, state.duration - (state.end - state.start)));
  const ruler = [0, .25, .5, .75, 1].map((ratio) => `<span>${formatShortClock(state.duration * ratio)}</span>`).join('');
  el.trimRuler.innerHTML = ruler;
  updatePlayhead();
}

function drawWaveform() {
  const canvas = el.trimWaveform;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const ratio = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  context.fillStyle = '#f8fafc';
  context.fillRect(0, 0, width, height);
  if (!state.peaks.length) return;
  const center = height / 2;
  const barWidth = Math.max(1, (width / state.peaks.length) * .72);
  context.fillStyle = '#6d9fe9';
  state.peaks.forEach((peak, index) => {
    const barHeight = Math.max(2, Number(peak) * (height - 14));
    context.fillRect((index / state.peaks.length) * width, center - barHeight / 2, barWidth, barHeight);
  });
}

function updatePlayhead() {
  const ratio = state.duration > 0 ? el.trimVideo.currentTime / state.duration : 0;
  el.trimPlayhead.style.left = `${Math.max(0, Math.min(100, ratio * 100))}%`;
  el.trimClock.textContent = formatClock(el.trimVideo.currentTime || 0);
}

function seek(value) {
  const time = Math.max(0, Math.min(state.duration || Infinity, Number(value) || 0));
  el.trimVideo.currentTime = time;
  updatePlayhead();
}

function togglePlay() {
  if (el.trimVideo.paused) {
    if (el.trimVideo.currentTime < state.start || el.trimVideo.currentTime >= state.end) seek(state.start);
    el.trimVideo.play();
  } else el.trimVideo.pause();
}

function updateModeHint() {
  const strategy = document.querySelector('input[name="trimStrategy"]:checked')?.value || 'precise';
  el.trimModeHint.textContent = strategy === 'precise'
    ? '精準模式可準確保留所選畫面，適合字幕製作。'
    : '快速模式不重新編碼，速度快，但起點可能受關鍵影格影響。';
}

async function applyTrim() {
  const strategy = document.querySelector('input[name="trimStrategy"]:checked')?.value || 'precise';
  setBusy(true);
  statusMessage('正在儲存修剪範圍…');
  try {
    const planResponse = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/edit-plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ in: state.start, out: state.end, strategy }),
    });
    const planResult = await planResponse.json();
    if (!planResponse.ok) throw new Error(planResult.error || `HTTP ${planResponse.status}`);
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/apply-trim`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    el.trimProgressPanel.hidden = false;
    startPolling();
  } catch (error) {
    setBusy(false);
    statusMessage(`無法套用修剪：${error.message}`, true);
  }
}

function startPolling() {
  clearInterval(state.pollTimer);
  el.trimProgressPanel.hidden = false;
  pollTrimStatus();
  state.pollTimer = setInterval(pollTrimStatus, 500);
}

async function pollTrimStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/trim-status`, { cache: 'no-store' });
    const status = await response.json();
    const progress = Math.max(0, Math.min(100, Math.round(status.progress || 0)));
    el.trimProgressText.textContent = status.message || '正在處理';
    el.trimProgressPercent.textContent = `${progress}%`;
    el.trimProgressBar.style.width = `${progress}%`;
    statusMessage(status.message || '正在處理');
    if (['completed', 'failed', 'cancelled'].includes(status.status)) {
      clearInterval(state.pollTimer);
      setBusy(false);
      if (status.status === 'completed') {
        state.applied = true;
        el.trimSaveState.textContent = '已套用修剪';
        statusMessage('影片修剪完成，字幕時間軸已同步。');
        updateStartJobAction();
      } else statusMessage(status.message || '修剪未完成', status.status === 'failed');
      setTimeout(() => { el.trimProgressPanel.hidden = true; }, 1600);
    }
  } catch (error) {
    clearInterval(state.pollTimer);
    setBusy(false);
    statusMessage(`讀取修剪進度失敗：${error.message}`, true);
  }
}

async function cancelTrim() {
  const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/cancel-trim`, { method: 'POST' });
  const result = await response.json();
  if (!response.ok) statusMessage(result.error || '取消失敗', true);
}

async function restoreOriginal() {
  if (!confirm('確定要停用修剪並還原原始影片嗎？原始影片不會被刪除。')) return;
  setBusy(true);
  try {
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/trim`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    await loadTrimProject();
    statusMessage('已還原原始影片。');
  } catch (error) {
    statusMessage(`還原失敗：${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

async function startSubtitleJob() {
  el.trimStartJob.disabled = true;
  statusMessage('正在啟動離線字幕生成…');
  try {
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/start`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    location.href = appUrl('/?open=processing');
  } catch (error) {
    el.trimStartJob.disabled = false;
    statusMessage(`無法開始字幕生成：${error.message}`, true);
  }
}

function updateStartJobAction() {
  el.trimStartJob.hidden = !(state.applied && state.jobStatus === 'created');
}

function setBusy(busy) {
  [el.trimApply, el.trimApplyTop, el.trimRestore, el.trimReset].forEach((button) => { button.disabled = busy; });
}

function statusMessage(message, error = false) {
  el.trimStatusMessage.textContent = message;
  el.trimStatusMessage.classList.toggle('error', error);
}

function handleShortcut(event) {
  const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
  if (editing) return;
  if (event.code === 'Space') {
    event.preventDefault();
    togglePlay();
  } else if (event.key.toLowerCase() === 'i') {
    event.preventDefault();
    setBoundary('in', el.trimVideo.currentTime);
  } else if (event.key.toLowerCase() === 'o') {
    event.preventDefault();
    setBoundary('out', el.trimVideo.currentTime);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    seek(el.trimVideo.currentTime - (event.shiftKey ? .1 : 1));
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    seek(el.trimVideo.currentTime + (event.shiftKey ? .1 : 1));
  }
}

function parseClock(value) {
  const text = String(value || '').trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  const parts = text.replace(',', '.').split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return NaN;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return NaN;
}

function formatClock(value) {
  const milliseconds = Math.max(0, Math.round((Number(value) || 0) * 1000));
  const ms = milliseconds % 1000;
  const totalSeconds = Math.floor(milliseconds / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function formatShortClock(value) {
  const total = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
