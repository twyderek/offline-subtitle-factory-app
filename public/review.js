// API base URL — Web/Electron 都使用目前頁面的本機伺服器
const API_BASE = window.location.origin.startsWith('http')
  ? window.location.origin
  : 'http://127.0.0.1:8790';

const jobId = location.pathname.split('/').filter(Boolean).at(-1);

const state = {
  cues: [],
  activeIndex: -1,
  changed: new Set(),
  search: '',
  loopActive: false,
  videoFileName: '',
  subtitleFileName: '',
};

const ids = [
  'reviewVideo', 'reviewStatus', 'cueList', 'currentText', 'currentMeta', 'currentRuleState',
  'cueCount', 'changedCount', 'warningCount', 'clock', 'burnCaption', 'burnOverlay',
  'proofreadPanel', 'burnPanel', 'stageProofread', 'stageBurn', 'cueSearch', 'commandBox',
  'timeAdjustSeconds', 'shortenAllCues', 'extendAllCues',
];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const settingIds = ['fontFamily', 'fontSize', 'fontColor', 'outlineColor', 'outlineWidth', 'subtitlePosition', 'marginV', 'bold'];

document.getElementById('reviewVideoFile').addEventListener('change', handleVideoFile);
document.getElementById('reviewSrtFile').addEventListener('change', handleSrtFile);
document.getElementById('loadProjectPreset').addEventListener('click', loadProjectPreset);
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
  renderCueList();
});
el.shortenAllCues.addEventListener('click', () => adjustAllCueDurations(-getTimeAdjustSeconds()));
el.extendAllCues.addEventListener('click', () => adjustAllCueDurations(getTimeAdjustSeconds()));
settingIds.forEach((id) => document.getElementById(id).addEventListener('input', updateBurnPreview));

el.reviewVideo.addEventListener('timeupdate', () => {
  updateActiveCue();
  el.clock.textContent = formatClock(el.reviewVideo.currentTime);
  if (state.loopActive && state.activeIndex >= 0) {
    const cue = state.cues[state.activeIndex];
    if (el.reviewVideo.currentTime > cue.end) el.reviewVideo.currentTime = cue.start;
  }
});

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
  renderCueList();
  updateStats();
  setActiveCue(-1);
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
      <div class="review-cue-meta">
        <div class="review-cue-number">#${index + 1}</div>
        <div class="review-time">${cue.startRaw}<br>${cue.endRaw}</div>
        <label class="duration-field">長度（秒）<input class="duration-input" type="number" min="0.1" step="0.1" value="${formatDuration(cue.end - cue.start)}"></label>
        <div class="cue-mini-buttons"><button class="shorten-cue" type="button">-</button><button class="extend-cue" type="button">+</button></div>
        <button class="jump" type="button">跳轉</button>
        <button class="merge-next" type="button">合併下段</button>
        <button class="delete-cue" type="button">刪除</button>
        <span class="${hasRuleWarning(cue.text) ? 'review-chip warn' : 'review-chip'}">${hasRuleWarning(cue.text) ? '待檢查' : 'OK'}</span>
      </div>
      <textarea aria-label="字幕 ${index + 1}">${escapeHtml(cue.text)}</textarea>
    `;
    item.querySelector('.jump').addEventListener('click', () => jumpToCue(index));
    item.querySelector('textarea').addEventListener('input', (event) => updateCue(index, event.target.value));
    item.querySelector('.duration-input').addEventListener('change', (event) => setCueDuration(index, Number(event.target.value)));
    item.querySelector('.shorten-cue').addEventListener('click', () => adjustCueDuration(index, -getTimeAdjustSeconds()));
    item.querySelector('.extend-cue').addEventListener('click', () => adjustCueDuration(index, getTimeAdjustSeconds()));
    item.querySelector('.merge-next').addEventListener('click', () => mergeCueWithNext(index));
    item.querySelector('.delete-cue').addEventListener('click', () => deleteCue(index));
    fragment.appendChild(item);
  });
  el.cueList.appendChild(fragment);
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
}

function jumpToCue(index) {
  const cue = state.cues[index];
  if (!cue) return;
  el.reviewVideo.currentTime = cue.start;
  el.reviewVideo.play();
  setActiveCue(index);
}

function updateActiveCue(force = false) {
  const time = el.reviewVideo.currentTime;
  const index = state.cues.findIndex((cue) => time >= cue.start && time <= cue.end);
  if (index !== state.activeIndex || force) setActiveCue(index);
}

function setActiveCue(index) {
  state.activeIndex = index;
  document.querySelectorAll('.review-cue.active').forEach((node) => node.classList.remove('active'));
  if (index >= 0) {
    const cue = state.cues[index];
    const node = el.cueList.querySelector(`[data-index="${index}"]`);
    if (node) node.classList.add('active');
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
  el.burnCaption.textContent = cue?.text || '字幕燒錄樣式預覽';
  el.burnCaption.style.fontFamily = settings.fontFamily;
  el.burnCaption.style.fontSize = `${settings.fontSize}px`;
  el.burnCaption.style.fontWeight = settings.bold ? '800' : '400';
  el.burnCaption.style.color = settings.fontColor;
  el.burnCaption.style.webkitTextStroke = `${settings.outlineWidth}px ${settings.outlineColor}`;
  el.burnOverlay.style.top = settings.position === 'top' ? `${settings.marginV}px` : 'auto';
  el.burnOverlay.style.bottom = settings.position === 'bottom' ? `${settings.marginV}px` : 'auto';
  el.burnOverlay.style.alignItems = settings.position === 'middle' ? 'center' : 'flex-start';
  el.burnOverlay.style.height = settings.position === 'middle' ? '100%' : 'auto';
  el.commandBox.textContent = buildFfmpegStyle(settings);
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

async function saveSrt() {
  const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/save-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subtitle: buildSrt() }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    statusMessage(`另存失敗：${result.error || response.status}`);
    return;
  }
  statusMessage(`已另存 SRT：${result.files.subtitle}`);
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
  window.location.href = `${API_BASE}/`;
});
