// API base URL — Web/Electron 都使用目前頁面的本機伺服器
const API_BASE = window.location.origin.startsWith('http')
  ? window.location.origin
  : 'http://127.0.0.1:8790';
const ASS_PLAY_RES_Y = 1080;
const API_TOKEN = new URLSearchParams(window.location.search).get('token') || '';
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const requestUrl = new URL(typeof input === 'string' ? input : input.url, window.location.href);
  if (!API_TOKEN || requestUrl.origin !== API_BASE || !requestUrl.pathname.startsWith('/api/')) {
    return nativeFetch(input, init);
  }
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
  cues: [],
  activeIndex: -1,
  changed: new Set(),
  search: '',
  loopActive: false,
  videoFileName: '',
  subtitleFileName: '',
  dirty: false,
  saveInFlight: false,
  autosaveTimer: null,
  followCue: true,
  changeVersion: 0,
  searchTimer: null,
  waveformPeaks: [],
  waveformDuration: 0,
};

const ids = [
  'reviewVideo', 'reviewStatus', 'cueList', 'currentText', 'currentMeta', 'currentRuleState',
  'cueCount', 'changedCount', 'warningCount', 'clock', 'burnCaption', 'burnOverlay',
  'proofreadPanel', 'burnPanel', 'stageProofread', 'stageBurn', 'cueSearch', 'commandBox',
  'timeAdjustSeconds', 'shortenAllCues', 'extendAllCues', 'followCue',
  'reviewTimeline', 'timelineRuler', 'reviewWaveform', 'waveformStatus', 'timelinePlayhead',
];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const settingIds = ['fontFamily', 'fontSize', 'fontColor', 'outlineColor', 'outlineWidth', 'subtitlePosition', 'marginV', 'bold'];

document.getElementById('reviewVideoFile').addEventListener('change', handleVideoFile);
document.getElementById('reviewSrtFile').addEventListener('change', handleSrtFile);
document.getElementById('loadProjectPreset').addEventListener('click', loadProjectPreset);
document.getElementById('openTrim').addEventListener('click', () => {
  location.href = appUrl(`/trim/${encodeURIComponent(jobId)}`);
});
document.getElementById('applyRules').addEventListener('click', applyRulesToAll);
document.getElementById('downloadSrt').addEventListener('click', downloadSrt);
document.getElementById('saveSrt').addEventListener('click', saveSrt);
document.getElementById('saveReviewPackage').addEventListener('click', saveReviewPackage);
document.getElementById('burnExport').addEventListener('click', burnExport);
document.getElementById('back5').addEventListener('click', () => el.reviewVideo.currentTime = Math.max(0, el.reviewVideo.currentTime - 5));
document.getElementById('forward5').addEventListener('click', () => el.reviewVideo.currentTime = Math.min(el.reviewVideo.duration || Infinity, el.reviewVideo.currentTime + 5));
document.getElementById('playPause').addEventListener('click', () => el.reviewVideo.paused ? el.reviewVideo.play() : el.reviewVideo.pause());
document.getElementById('loopCue').addEventListener('click', () => {
  state.loopActive = !state.loopActive;
  document.getElementById('loopCue').classList.toggle('primary', state.loopActive);
});
el.stageProofread.addEventListener('click', () => setStage('proofread'));
el.stageBurn.addEventListener('click', () => setStage('burn'));
el.cueSearch.addEventListener('input', (event) => {
  state.search = event.target.value.trim();
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(renderCueList, 120);
});
el.shortenAllCues.addEventListener('click', () => adjustAllCueDurations(-getTimeAdjustSeconds()));
el.extendAllCues.addEventListener('click', () => adjustAllCueDurations(getTimeAdjustSeconds()));
el.followCue.addEventListener('click', () => setFollowCue(!state.followCue, true));
settingIds.forEach((id) => document.getElementById(id).addEventListener('input', updateBurnPreview));

el.cueList.addEventListener('wheel', () => setFollowCue(false), { passive: true });
el.cueList.addEventListener('pointerdown', (event) => {
  if (event.target.closest('textarea, input')) setFollowCue(false);
});
el.cueList.addEventListener('click', handleCueListClick);
el.cueList.addEventListener('input', handleCueListInput);
el.cueList.addEventListener('change', handleCueListChange);
window.addEventListener('keydown', handleReviewShortcut);
window.addEventListener('beforeunload', (event) => {
  if (!state.dirty && !state.saveInFlight) return;
  event.preventDefault();
  event.returnValue = '';
});

el.reviewVideo.addEventListener('timeupdate', () => {
  updateActiveCue();
  el.clock.textContent = formatClock(el.reviewVideo.currentTime);
  updateTimelinePlayhead();
  if (state.loopActive && state.activeIndex >= 0) {
    const cue = state.cues[state.activeIndex];
    if (el.reviewVideo.currentTime > cue.end) el.reviewVideo.currentTime = cue.start;
  }
});
el.reviewVideo.addEventListener('loadedmetadata', () => {
  updateTimelineRuler(el.reviewVideo.duration);
  drawWaveform();
  updateTimelinePlayhead();
  updateBurnPreview();
});
el.reviewTimeline?.addEventListener('click', (event) => {
  if (!Number.isFinite(el.reviewVideo.duration) || el.reviewVideo.duration <= 0) return;
  const rect = el.reviewTimeline.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  el.reviewVideo.currentTime = ratio * el.reviewVideo.duration;
});
if (el.reviewTimeline && 'ResizeObserver' in window) {
  new ResizeObserver(() => drawWaveform()).observe(el.reviewTimeline);
}
if (el.reviewVideo?.parentElement && 'ResizeObserver' in window) {
  new ResizeObserver(() => updateBurnPreview()).observe(el.reviewVideo.parentElement);
}

loadProjectPreset();
updateBurnPreview();
applyInitialStage();

async function loadProjectPreset() {
  if (!jobId) {
    statusMessage('缺少任務 ID');
    return;
  }

  try {
    statusMessage('載入任務影片與字幕...');
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/review-data`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    state.videoFileName = data.videoFileName || '';
    state.subtitleFileName = data.subtitleFileName || '';
    el.reviewVideo.src = data.videoUrl;
    loadSrtText(data.subtitle, `已載入任務 ${jobId}`);
    loadJobWaveform();
  } catch (error) {
    statusMessage(`載入失敗：${error.message}`);
  }
}

function handleVideoFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  el.reviewVideo.src = URL.createObjectURL(file);
  state.videoFileName = file.name;
  statusMessage(`已載入影片：${file.name}`);
  loadLocalFileWaveform(file);
}

async function loadJobWaveform() {
  if (!el.reviewWaveform) return;
  setWaveformStatus('正在從影片音軌產生真實聲波…');
  try {
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/waveform?points=640`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.peaks)) throw new Error(data.error || `HTTP ${response.status}`);
    state.waveformPeaks = data.peaks;
    state.waveformDuration = Number(data.duration) || 0;
    el.reviewTimeline?.classList.add('is-ready');
    updateTimelineRuler(state.waveformDuration || el.reviewVideo.duration);
    drawWaveform();
  } catch (error) {
    state.waveformPeaks = [];
    el.reviewTimeline?.classList.remove('is-ready');
    setWaveformStatus(`聲波無法產生：${error.message}`);
    drawWaveform();
  }
}

async function loadLocalFileWaveform(file) {
  if (!el.reviewWaveform) return;
  setWaveformStatus('正在分析本機影片音軌…');
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('此系統不支援音訊解碼');
    const context = new AudioContextClass();
    try {
      const audioBuffer = await context.decodeAudioData(await file.arrayBuffer());
      state.waveformPeaks = downsampleAudioBuffer(audioBuffer, 640);
      state.waveformDuration = audioBuffer.duration;
    } finally {
      await context.close();
    }
    el.reviewTimeline?.classList.add('is-ready');
    updateTimelineRuler(state.waveformDuration);
    drawWaveform();
  } catch (error) {
    state.waveformPeaks = [];
    el.reviewTimeline?.classList.remove('is-ready');
    setWaveformStatus(`聲波無法產生：${error.message}`);
    drawWaveform();
  }
}

function downsampleAudioBuffer(audioBuffer, pointCount) {
  const peaks = new Array(pointCount).fill(0);
  const samples = audioBuffer.length;
  const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));
  for (let point = 0; point < pointCount; point += 1) {
    const start = Math.floor((point * samples) / pointCount);
    const end = Math.max(start + 1, Math.floor(((point + 1) * samples) / pointCount));
    let peak = 0;
    for (const channel of channels) {
      for (let sample = start; sample < end; sample += 1) peak = Math.max(peak, Math.abs(channel[sample] || 0));
    }
    peaks[point] = peak;
  }
  const high = Math.max(...peaks, 0.01);
  return peaks.map((value) => Math.min(1, Math.pow(value / high, 0.68)));
}

function setWaveformStatus(message) {
  el.reviewTimeline?.classList.remove('is-ready');
  if (el.waveformStatus) el.waveformStatus.textContent = message;
}

function drawWaveform() {
  const canvas = el.reviewWaveform;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#f8fafc';
  context.fillRect(0, 0, width, height);
  if (!state.waveformPeaks.length) return;
  const center = height / 2;
  const barWidth = Math.max(1, width / state.waveformPeaks.length * 0.7);
  context.fillStyle = '#9dafc3';
  state.waveformPeaks.forEach((peak, index) => {
    const x = (index / state.waveformPeaks.length) * width;
    const barHeight = Math.max(2, peak * (height - 8));
    context.fillRect(x, center - barHeight / 2, barWidth, barHeight);
  });
  context.fillStyle = '#d2dce7';
  context.fillRect(0, center, width, 1);
}

function updateTimelineRuler(duration) {
  if (!el.timelineRuler || !Number.isFinite(duration) || duration <= 0) return;
  const values = [0, .25, .5, .75, 1].map((ratio) => formatClock(duration * ratio));
  el.timelineRuler.innerHTML = values.map((value) => `<span>${value}</span>`).join('');
}

function updateTimelinePlayhead() {
  if (!el.timelinePlayhead) return;
  const duration = el.reviewVideo.duration || state.waveformDuration;
  const ratio = Number.isFinite(duration) && duration > 0 ? el.reviewVideo.currentTime / duration : 0;
  el.timelinePlayhead.style.left = `${Math.max(0, Math.min(100, ratio * 100))}%`;
}

async function handleSrtFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  state.subtitleFileName = file.name;
  loadSrtText(await file.text(), `已載入字幕：${file.name}`);
}

function loadSrtText(text, message) {
  state.cues = parseSrt(text);
  state.activeIndex = -1;
  state.changed.clear();
  state.dirty = false;
  state.changeVersion = 0;
  clearTimeout(state.autosaveTimer);
  renderCueList();
  updateStats();
  updateActiveCue(true);
  statusMessage(message);
}

function setStage(stage) {
  const burn = stage === 'burn';
  el.proofreadPanel.classList.toggle('active', !burn);
  el.burnPanel.classList.toggle('active', burn);
  el.stageProofread.classList.toggle('active', !burn);
  el.stageBurn.classList.toggle('active', burn);
  updateBurnPreview();
}

function applyInitialStage() {
  const params = new URLSearchParams(location.search);
  const stage = params.get('stage');
  if (stage === 'burn') setStage('burn');
  else setStage('proofread');
}

function parseSrt(text) {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((block, index) => {
      const lines = block.split('\n').filter(Boolean);
      const timeIndex = lines.findIndex((line) => line.includes('-->'));
      if (timeIndex < 0) return null;
      const [startRaw, endRaw] = lines[timeIndex].split('-->').map((part) => part.trim());
      const body = lines.slice(timeIndex + 1).join('\n').trim();
      const start = parseTime(startRaw);
      const end = parseTime(endRaw);
      return {
        id: index + 1,
        start,
        end,
        startRaw,
        endRaw,
        originalStartRaw: startRaw,
        originalEndRaw: endRaw,
        text: body,
        originalText: body,
      };
    })
    .filter((cue) => cue && Number.isFinite(cue.start) && Number.isFinite(cue.end) && (cue.text || cue.end > cue.start));
}

function renderCueList() {
  el.cueList.innerHTML = '';
  const fragment = document.createDocumentFragment();
  const query = state.search.toLowerCase();
  state.cues.forEach((cue, index) => {
    if (query && !cue.text.toLowerCase().includes(query)) return;
    const item = document.createElement('article');
    item.className = 'review-cue';
    item.dataset.index = String(index);
    item.classList.toggle('active', index === state.activeIndex);
    item.classList.toggle('changed', state.changed.has(index));
    item.innerHTML = `
      <div class="review-cue-number">${index + 1}</div>
      <div class="review-cue-content">
        <div class="review-cue-meta">
          <div class="review-time">${cue.startRaw} <span>→</span> ${cue.endRaw}</div>
          <span class="${hasRuleWarning(cue.text) ? 'review-chip warn' : 'review-chip'}">${hasRuleWarning(cue.text) ? '待檢查' : '已確認'}</span>
          <button class="jump cue-more" type="button" title="跳到此字幕">•••</button>
        </div>
        <textarea aria-label="字幕 ${index + 1}">${escapeHtml(cue.text)}</textarea>
        <div class="cue-advanced-actions">
          <label class="duration-field">長度（秒）<input class="duration-input" type="number" min="0.1" step="0.1" value="${formatDuration(cue.end - cue.start)}"></label>
          <div class="cue-mini-buttons"><button class="shorten-cue" type="button">縮短</button><button class="extend-cue" type="button">延長</button></div>
          <button class="merge-next" type="button">合併下段</button>
          <button class="delete-cue" type="button">刪除</button>
        </div>
      </div>
    `;
    fragment.appendChild(item);
  });
  el.cueList.appendChild(fragment);
}

function getCueEventIndex(event) {
  const item = event.target.closest('.review-cue');
  if (!item) return -1;
  const index = Number(item.dataset.index);
  return Number.isInteger(index) ? index : -1;
}

function handleCueListClick(event) {
  const index = getCueEventIndex(event);
  if (index < 0) return;
  if (event.target.closest('.jump')) jumpToCue(index);
  else if (event.target.closest('.shorten-cue')) adjustCueDuration(index, -getTimeAdjustSeconds());
  else if (event.target.closest('.extend-cue')) adjustCueDuration(index, getTimeAdjustSeconds());
  else if (event.target.closest('.merge-next')) mergeCueWithNext(index);
  else if (event.target.closest('.delete-cue')) deleteCue(index);
}

function handleCueListInput(event) {
  if (!event.target.matches('textarea')) return;
  const index = getCueEventIndex(event);
  if (index >= 0) updateCue(index, event.target.value);
}

function handleCueListChange(event) {
  if (!event.target.matches('.duration-input')) return;
  const index = getCueEventIndex(event);
  if (index >= 0) setCueDuration(index, Number(event.target.value));
}

function updateCue(index, value) {
  state.cues[index].text = value;
  syncChangedState(index);
  const cueNode = el.cueList.querySelector(`[data-index="${index}"]`);
  if (cueNode) {
    cueNode.classList.toggle('changed', state.changed.has(index));
    const chip = cueNode.querySelector('.review-chip');
    chip.className = hasRuleWarning(value) ? 'review-chip warn' : 'review-chip';
    chip.textContent = hasRuleWarning(value) ? '待檢查' : 'OK';
  }
  if (index === state.activeIndex) setActiveCue(index);
  updateStats();
  markReviewDirty();
}

function jumpToCue(index) {
  const cue = state.cues[index];
  if (!cue) return;
  el.reviewVideo.currentTime = cue.start;
  el.reviewVideo.play();
  setFollowCue(true);
  setActiveCue(index);
}

function updateActiveCue(force = false) {
  const time = el.reviewVideo.currentTime;
  const index = findCueIndexAtTime(time);
  if (index !== state.activeIndex || force) setActiveCue(index);
}

function findCueIndexAtTime(time) {
  const current = state.cues[state.activeIndex];
  if (current && time >= current.start && time <= current.end) return state.activeIndex;
  const next = state.cues[state.activeIndex + 1];
  if (next && time >= next.start && time <= next.end) return state.activeIndex + 1;
  const previous = state.cues[state.activeIndex - 1];
  if (previous && time >= previous.start && time <= previous.end) return state.activeIndex - 1;

  let low = 0;
  let high = state.cues.length - 1;
  let candidate = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (state.cues[middle].start <= time) {
      candidate = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return candidate >= 0 && time <= state.cues[candidate].end ? candidate : -1;
}

function setActiveCue(index) {
  state.activeIndex = index;
  document.querySelectorAll('.review-cue.active').forEach((node) => node.classList.remove('active'));
  if (index >= 0) {
    const cue = state.cues[index];
    const node = el.cueList.querySelector(`[data-index="${index}"]`);
    if (node) {
      node.classList.add('active');
      if (state.followCue) {
        node.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
    }
    el.currentText.textContent = cue.text || ' ';
    el.currentMeta.textContent = `#${index + 1} ${cue.startRaw} - ${cue.endRaw}`;
    el.currentRuleState.textContent = hasRuleWarning(cue.text) ? '待檢查' : '已校稿';
  } else {
    el.currentText.textContent = '目前沒有對應字幕';
    el.currentMeta.textContent = '尚未選取字幕';
    el.currentRuleState.textContent = '等待播放';
  }
  updateBurnPreview();
}

function applyRulesToAll() {
  state.cues = state.cues.map((cue, index) => {
    const text = cleanSubtitleText(cue.text);
    if (text !== cue.text) state.changed.add(index);
    return { ...cue, text };
  }).filter((cue) => cue.text.trim());
  state.cues.forEach((cue, index) => cue.id = index + 1);
  renderCueList();
  updateStats();
  updateActiveCue(true);
  statusMessage('已套用清理規則');
  markReviewDirty();
}

function deleteCue(index) {
  const cue = state.cues[index];
  if (!cue) return;
  const confirmed = confirm(`確定刪除第 ${index + 1} 段字幕？\n\n${cue.text.slice(0, 80)}`);
  if (!confirmed) return;
  state.cues.splice(index, 1);
  rebuildCueIds();
  rebuildChangedSet();
  state.activeIndex = Math.min(index, state.cues.length - 1);
  renderCueList();
  updateStats();
  setActiveCue(state.activeIndex);
  statusMessage(`已刪除第 ${index + 1} 段字幕`);
  markReviewDirty();
}

function mergeCueWithNext(index) {
  const cue = state.cues[index];
  const nextCue = state.cues[index + 1];
  if (!cue || !nextCue) {
    statusMessage('沒有下一段可合併');
    return;
  }
  const confirmed = confirm(`確定將第 ${index + 1} 段與第 ${index + 2} 段合併？`);
  if (!confirmed) return;
  cue.end = nextCue.end;
  cue.endRaw = nextCue.endRaw;
  cue.text = [cue.text.trim(), nextCue.text.trim()].filter(Boolean).join('\n');
  state.cues.splice(index + 1, 1);
  rebuildCueIds();
  rebuildChangedSet();
  renderCueList();
  updateStats();
  setActiveCue(index);
  statusMessage(`已合併第 ${index + 1} 段與下一段字幕`);
  markReviewDirty();
}

function rebuildCueIds() {
  state.cues.forEach((cue, index) => {
    cue.id = index + 1;
  });
}

function rebuildChangedSet() {
  state.changed.clear();
  state.cues.forEach((cue, index) => {
    if (cue.text !== cue.originalText || cue.startRaw !== cue.originalStartRaw || cue.endRaw !== cue.originalEndRaw) {
      state.changed.add(index);
    }
  });
}

function cleanSubtitleText(value) {
  return value
    .replace(/呃|啊|嗯|那個|就是|然後|這個|你知道吧|對吧/g, '')
    .replace(/所以呢/g, '所以')
    .replace(/[，。、：；（）()[\]「」『』"“”‘’]/g, '')
    .replace(/\b(open\s*ai)\b/gi, 'OPENAI')
    .replace(/\bgpt[-\s]?4\b/gi, 'GPT-4')
    .replace(/\bapi\b/gi, 'API')
    .replace(/\bai\b/gi, 'AI')
    .replace(/\bmoodle\b/gi, 'MOODLE')
    .replace(/\be3\b/gi, 'E3')
    .replace(/\s{3,}/g, '  ')
    .trim();
}

function hasRuleWarning(text) {
  return /呃|啊|嗯|那個|就是|然後|這個|你知道吧|對吧/.test(text)
    || /[，。、：；（）()[\]「」『』"“”‘’]/.test(text)
    || /\b(whisper|openai|api|ai|moodle|token|default|lms|evercam|kmplus)\b/.test(text);
}

function updateStats() {
  el.cueCount.textContent = String(state.cues.length);
  el.changedCount.textContent = String(state.changed.size);
  el.warningCount.textContent = String(state.cues.filter((cue) => hasRuleWarning(cue.text)).length);
}

function getBurnSettings() {
  const position = document.getElementById('subtitlePosition').value;
  const alignment = position === 'top' ? 8 : position === 'middle' ? 5 : 2;
  return {
    fontFamily: document.getElementById('fontFamily').value,
    fontSize: Number(document.getElementById('fontSize').value),
    fontColor: document.getElementById('fontColor').value,
    outlineColor: document.getElementById('outlineColor').value,
    outlineWidth: Number(document.getElementById('outlineWidth').value),
    position,
    marginV: Number(document.getElementById('marginV').value),
    bold: document.getElementById('bold').value === 'true',
    alignment,
  };
}

function updateBurnPreview() {
  const settings = getBurnSettings();
  const cue = state.activeIndex >= 0 ? state.cues[state.activeIndex] : null;
  const preview = getAssPreviewMetrics();
  el.burnCaption.textContent = cue?.text || '字幕燒錄樣式預覽';
  el.burnCaption.style.fontFamily = settings.fontFamily;
  el.burnCaption.style.fontSize = `${Math.max(1, settings.fontSize * preview.scale)}px`;
  el.burnCaption.style.fontWeight = settings.bold ? '800' : '400';
  el.burnCaption.style.color = settings.fontColor;
  el.burnCaption.style.webkitTextStroke = `${Math.max(0, settings.outlineWidth * preview.scale)}px ${settings.outlineColor}`;
  el.burnOverlay.style.left = `${preview.left}px`;
  el.burnOverlay.style.right = `${preview.right}px`;
  el.burnOverlay.style.top = settings.position === 'top'
    ? `${Math.max(0, preview.top + settings.marginV * preview.scale)}px`
    : (settings.position === 'middle' ? `${Math.max(0, preview.top)}px` : 'auto');
  el.burnOverlay.style.bottom = settings.position === 'bottom'
    ? `${Math.max(0, preview.bottom + settings.marginV * preview.scale)}px`
    : (settings.position === 'middle' ? `${Math.max(0, preview.bottom)}px` : 'auto');
  el.burnOverlay.style.alignItems = settings.position === 'middle' ? 'center' : 'flex-start';
  el.burnOverlay.style.height = 'auto';
  el.commandBox.textContent = buildFfmpegStyle(settings);
}

function getAssPreviewMetrics() {
  const rect = el.reviewVideo?.getBoundingClientRect();
  const renderedHeight = rect?.height || el.reviewVideo?.clientHeight || 0;
  const renderedWidth = rect?.width || el.reviewVideo?.clientWidth || 0;
  if (!Number.isFinite(renderedHeight) || renderedHeight <= 0 || !Number.isFinite(renderedWidth) || renderedWidth <= 0) {
    return { scale: 1, left: 0, right: 0, top: 0, bottom: 0 };
  }
  const mediaWidth = el.reviewVideo.videoWidth || renderedWidth;
  const mediaHeight = el.reviewVideo.videoHeight || renderedHeight;
  const mediaAspect = mediaWidth > 0 && mediaHeight > 0 ? mediaWidth / mediaHeight : renderedWidth / renderedHeight;
  const containerAspect = renderedWidth / renderedHeight;
  let boxWidth = renderedWidth;
  let boxHeight = renderedHeight;
  let offsetX = 0;
  let offsetY = 0;
  if (containerAspect > mediaAspect) {
    boxWidth = renderedHeight * mediaAspect;
    offsetX = (renderedWidth - boxWidth) / 2;
  } else if (containerAspect < mediaAspect) {
    boxHeight = renderedWidth / mediaAspect;
    offsetY = (renderedHeight - boxHeight) / 2;
  }
  const horizontalInset = boxWidth * 0.05;
  return {
    scale: boxHeight / ASS_PLAY_RES_Y,
    left: offsetX + horizontalInset,
    right: offsetX + horizontalInset,
    top: offsetY,
    bottom: offsetY,
  };
}

async function saveReviewPackage() {
  const payload = {
    subtitle: buildSrt(),
    settings: getBurnSettings(),
    manifest: {
      jobId,
      savedAt: new Date().toISOString(),
      cueCount: state.cues.length,
      changedCount: state.changed.size,
      warningCount: state.cues.filter((cue) => hasRuleWarning(cue.text)).length,
      sourceVideo: state.videoFileName,
      sourceSubtitle: state.subtitleFileName,
    },
  };
  const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/save-review-package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    statusMessage(`儲存失敗：${result.error || response.status}`);
    throw new Error(result.error || response.status);
  }
  statusMessage(`已儲存校稿包：${result.folder}`);
  return result;
}

async function burnExport() {
  if (!jobId) {
    statusMessage('缺少任務 ID，無法輸出');
    return;
  }
  const button = document.getElementById('burnExport');
  button.disabled = true;
  try {
    statusMessage('先儲存校稿包...');
    await saveReviewPackage();
    statusMessage('啟動硬燒錄輸出...');
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/burn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'hardsub', outputFormat: 'mp4', quality: 'h264-medium' }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
    statusMessage(result.message || '字幕輸出已啟動，請回任務頁查看進度');
  } catch (error) {
    statusMessage(`輸出失敗：${error.message}`);
  } finally {
    button.disabled = false;
  }
}

function buildSrt() {
  return state.cues.map((cue, index) => `${index + 1}\n${cue.startRaw} --> ${cue.endRaw}\n${cue.text.trim()}`).join('\n\n') + '\n';
}

function downloadSrt() {
  const blob = new Blob([buildSrt()], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'media.edited.srt';
  anchor.click();
  URL.revokeObjectURL(url);
}

async function saveSrt(options = {}) {
  if (!jobId || state.saveInFlight) return false;
  clearTimeout(state.autosaveTimer);
  state.saveInFlight = true;
  const savingVersion = state.changeVersion;
  if (!options.silent) statusMessage('正在儲存字幕...');
  try {
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/save-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtitle: buildSrt() }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || String(response.status));
    state.dirty = state.changeVersion !== savingVersion;
    statusMessage(state.dirty
      ? '已儲存先前變更，新的編輯即將自動儲存'
      : (options.silent ? '字幕已自動儲存' : `已另存 SRT：${result.files.subtitle}`));
    return true;
  } catch (error) {
    state.dirty = true;
    statusMessage(`儲存失敗：${error.message}`);
    return false;
  } finally {
    state.saveInFlight = false;
    if (state.dirty) {
      clearTimeout(state.autosaveTimer);
      state.autosaveTimer = setTimeout(() => saveSrt({ silent: true }), 500);
    }
  }
}

function markReviewDirty() {
  state.dirty = true;
  state.changeVersion += 1;
  clearTimeout(state.autosaveTimer);
  statusMessage('字幕有尚未儲存的變更');
  state.autosaveTimer = setTimeout(() => saveSrt({ silent: true }), 1500);
}

function setFollowCue(enabled, alignNow = false) {
  state.followCue = enabled;
  el.followCue.classList.toggle('primary', enabled);
  el.followCue.textContent = `自動跟隨：${enabled ? '開' : '暫停'}`;
  if (enabled && alignNow && state.activeIndex >= 0) setActiveCue(state.activeIndex);
}

function handleReviewShortcut(event) {
  const editing = event.target instanceof HTMLInputElement
    || event.target instanceof HTMLTextAreaElement
    || event.target instanceof HTMLSelectElement
    || event.target?.isContentEditable;
  if (editing) return;
  if (event.code === 'Space') {
    event.preventDefault();
    el.reviewVideo.paused ? el.reviewVideo.play() : el.reviewVideo.pause();
  } else if (event.altKey && event.key === 'ArrowLeft') {
    event.preventDefault();
    el.reviewVideo.currentTime = Math.max(0, el.reviewVideo.currentTime - 5);
  } else if (event.altKey && event.key === 'ArrowRight') {
    event.preventDefault();
    el.reviewVideo.currentTime = Math.min(el.reviewVideo.duration || Infinity, el.reviewVideo.currentTime + 5);
  } else if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowUp') {
    event.preventDefault();
    jumpToCue(Math.max(0, state.activeIndex - 1));
  } else if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowDown') {
    event.preventDefault();
    jumpToCue(Math.min(state.cues.length - 1, state.activeIndex + 1));
  }
}

function getTimeAdjustSeconds() {
  const value = Number(el.timeAdjustSeconds.value);
  return Number.isFinite(value) && value > 0 ? value : 0.5;
}

function setCueDuration(index, duration) {
  const cue = state.cues[index];
  if (!cue || !Number.isFinite(duration) || duration <= 0) return;
  const maxEnd = getCueEndLimit(index);
  cue.end = Math.min(cue.start + duration, maxEnd);
  cue.endRaw = formatSrtTime(cue.end);
  syncChangedState(index);
  renderCueList();
  updateStats();
  setActiveCue(index);
  markReviewDirty();
}

function adjustCueDuration(index, delta) {
  const cue = state.cues[index];
  if (!cue) return;
  setCueDuration(index, Math.max(0.1, cue.end - cue.start + delta));
}

function adjustAllCueDurations(delta) {
  state.cues.forEach((cue, index) => {
    const nextDuration = Math.max(0.1, cue.end - cue.start + delta);
    const maxEnd = getCueEndLimit(index);
    cue.end = Math.min(cue.start + nextDuration, maxEnd);
    cue.endRaw = formatSrtTime(cue.end);
    syncChangedState(index);
  });
  renderCueList();
  updateStats();
  updateActiveCue(true);
  statusMessage(`已${delta > 0 ? '增加' : '減少'}全片每句字幕長度 ${Math.abs(delta)} 秒`);
  markReviewDirty();
}

function getCueEndLimit(index) {
  const nextCue = state.cues[index + 1];
  if (nextCue) return Math.max(state.cues[index].start + 0.1, nextCue.start - 0.001);
  if (Number.isFinite(el.reviewVideo.duration) && el.reviewVideo.duration > 0) return el.reviewVideo.duration;
  return Number.POSITIVE_INFINITY;
}

function syncChangedState(index) {
  const cue = state.cues[index];
  const timeChanged = cue.startRaw !== cue.originalStartRaw || cue.endRaw !== cue.originalEndRaw;
  if (cue.text !== cue.originalText || timeChanged) state.changed.add(index);
  else state.changed.delete(index);
}

function parseTime(value) {
  const match = value.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!match) return 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(`0.${match[4].padEnd(3, '0').slice(0, 3)}`);
}

function formatSrtTime(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const wholeSeconds = Math.floor(safeSeconds % 60);
  const milliseconds = Math.round((safeSeconds - Math.floor(safeSeconds)) * 1000);
  return `${pad(hours)}:${pad(minutes)}:${pad(wholeSeconds)},${String(milliseconds).padStart(3, '0')}`;
}

function formatClock(seconds) {
  if (!Number.isFinite(seconds)) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const second = Math.floor(seconds % 60);
  return `${pad(minutes)}:${pad(second)}`;
}

function formatDuration(value) {
  return (Math.round(value * 10) / 10).toFixed(1);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function buildFfmpegStyle(settings) {
  return [
    `FontName=${settings.fontFamily}`,
    `FontSize=${settings.fontSize}`,
    `Bold=${settings.bold ? 1 : 0}`,
    `PrimaryColour=${hexToAssColor(settings.fontColor)}`,
    `OutlineColour=${hexToAssColor(settings.outlineColor)}`,
    'BorderStyle=1',
    `Outline=${settings.outlineWidth}`,
    'Shadow=0',
    `Alignment=${settings.alignment}`,
    `MarginV=${settings.marginV}`,
  ].join(',');
}

function hexToAssColor(hex) {
  const clean = hex.replace('#', '');
  const red = clean.slice(0, 2);
  const green = clean.slice(2, 4);
  const blue = clean.slice(4, 6);
  return `&H00${blue}${green}${red}`.toUpperCase();
}

function statusMessage(message) {
  el.reviewStatus.textContent = message;
}

// ── 返回任務頁 ──────────────────────────────
document.getElementById('backToHome').addEventListener('click', () => {
  window.location.href = appUrl('/');
});
