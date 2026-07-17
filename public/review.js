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
  ruleFile: null,
  dirty: false,
  saveInFlight: false,
  autosaveTimer: null,
  followCue: true,
  changeVersion: 0,
  searchTimer: null,
  waveformPeaks: [],
  waveformDuration: 0,
  aiSuggestions: new Map(),
  aiPolling: false,
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
const aiSettingIds = ['aiEnabled', 'aiProvider', 'aiBaseUrl', 'aiModel', 'aiBatchSize', 'aiApiKey', 'aiLanguage', 'aiTimeoutSeconds', 'aiMaxRetries', 'aiRetryBaseMs', 'aiInstructions'];

document.getElementById('reviewVideoFile').addEventListener('change', handleVideoFile);
document.getElementById('reviewSrtFile').addEventListener('change', handleSrtFile);
document.getElementById('reviewRuleFile').addEventListener('change', handleRuleFile);
document.getElementById('loadProjectPreset').addEventListener('click', loadProjectPreset);
document.getElementById('openTrim').addEventListener('click', () => {
  location.href = appUrl(`/trim/${encodeURIComponent(jobId)}`);
});
document.getElementById('applyRules').addEventListener('click', applyRulesToAll);
document.getElementById('openAiSettings').addEventListener('click', openAiSettings);
document.getElementById('closeAiSettings').addEventListener('click', closeAiSettings);
document.getElementById('saveAiSettings').addEventListener('click', saveAiSettings);
document.getElementById('testAiConnection').addEventListener('click', testAiConnection);
document.getElementById('runAiOptimize').addEventListener('click', runAiOptimize);
document.getElementById('resumeAiOptimize').addEventListener('click', resumeAiOptimize);
document.getElementById('cancelAiOptimize').addEventListener('click', cancelAiOptimize);
document.getElementById('acceptAllAiSuggestions').addEventListener('click', acceptAllAiSuggestions);
document.getElementById('rejectAllAiSuggestions').addEventListener('click', rejectAllAiSuggestions);
document.getElementById('aiSettingsModal').addEventListener('click', (event) => {
  if (event.target.id === 'aiSettingsModal') closeAiSettings();
});
document.querySelectorAll('.ai-mode').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.ai-mode').forEach((item) => item.classList.toggle('active', item === button));
}));
document.getElementById('downloadSrt').addEventListener('click', downloadSrt);
document.getElementById('downloadVtt').addEventListener('click', downloadVtt);
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
loadAiSettings();

function openAiSettings() {
  const modal = document.getElementById('aiSettingsModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeAiSettings() {
  const modal = document.getElementById('aiSettingsModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function setAiSettingsStatus(message) {
  document.getElementById('aiSettingsStatus').textContent = message;
}

function applyAiSettings(settings) {
  document.getElementById('aiEnabled').checked = Boolean(settings.enabled);
  document.getElementById('aiProvider').value = settings.provider || 'openai-compatible';
  document.getElementById('aiBaseUrl').value = settings.baseUrl || '';
  document.getElementById('aiModel').value = settings.model || '';
  document.getElementById('aiBatchSize').value = settings.batchSize || 30;
  document.getElementById('aiApiKey').value = '';
  document.getElementById('aiApiKey').placeholder = settings.hasApiKey ? '已安全保存；留空表示沿用' : '請輸入 API Key';
  document.getElementById('aiLanguage').value = settings.language || 'zh-TW';
  document.getElementById('aiTimeoutSeconds').value = settings.timeoutSeconds || 60;
  document.getElementById('aiMaxRetries').value = settings.maxRetries ?? 3;
  document.getElementById('aiRetryBaseMs').value = settings.retryBaseMs || 1000;
  document.getElementById('aiInstructions').value = settings.instructions || '';
  const badge = document.getElementById('aiConnectionBadge');
  const ready = Boolean(settings.enabled && settings.model && settings.hasApiKey);
  badge.textContent = ready ? 'AI 已設定' : '尚未設定';
  badge.classList.toggle('offline', !ready);
}

async function loadAiSettings() {
  try {
    const response = await fetch(`${API_BASE}/api/ai/settings`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
    applyAiSettings(result.settings);
    setAiSettingsStatus('設定已載入');
  } catch (error) {
    setAiSettingsStatus(`載入失敗：${error.message}`);
  }
}

function collectAiSettings() {
  return {
    enabled: document.getElementById('aiEnabled').checked,
    provider: document.getElementById('aiProvider').value,
    baseUrl: document.getElementById('aiBaseUrl').value.trim(),
    model: document.getElementById('aiModel').value.trim(),
    batchSize: Number(document.getElementById('aiBatchSize').value),
    apiKey: document.getElementById('aiApiKey').value.trim(),
    language: document.getElementById('aiLanguage').value,
    timeoutSeconds: Number(document.getElementById('aiTimeoutSeconds').value),
    maxRetries: Number(document.getElementById('aiMaxRetries').value),
    retryBaseMs: Number(document.getElementById('aiRetryBaseMs').value),
    instructions: document.getElementById('aiInstructions').value.trim(),
  };
}

async function saveAiSettings() {
  const button = document.getElementById('saveAiSettings');
  button.disabled = true;
  setAiSettingsStatus('正在儲存…');
  try {
    const response = await fetch(`${API_BASE}/api/ai/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectAiSettings()),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
    applyAiSettings(result.settings);
    setAiSettingsStatus('設定已儲存；API Key 不會回傳到畫面');
  } catch (error) {
    setAiSettingsStatus(`儲存失敗：${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function testAiConnection() {
  const button = document.getElementById('testAiConnection');
  button.disabled = true;
  setAiSettingsStatus('正在測試 AI 服務…');
  try {
    const response = await fetch(`${API_BASE}/api/ai/test`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
    const modelMessage = result.modelAvailable ? '指定模型可用' : '已連線，但模型清單中找不到指定模型';
    setAiSettingsStatus(`連線成功：${modelMessage}`);
    const badge = document.getElementById('aiConnectionBadge');
    badge.textContent = 'AI 已連線';
    badge.classList.remove('offline');
  } catch (error) {
    setAiSettingsStatus(`連線失敗：${error.message}`);
  } finally {
    button.disabled = false;
  }
}

function setAiProgress(progress, message) {
  const wrap = document.getElementById('aiProgressWrap');
  const percent = progress?.totalCues ? Math.round((progress.processedCues / progress.totalCues) * 100) : 0;
  wrap.hidden = false;
  document.getElementById('aiProgress').value = percent;
  document.getElementById('aiProgressPercent').textContent = `${percent}%`;
  const retryMessage = progress?.retryAttempt
    ? `第 ${progress.activeBatch} 批受限或失敗，第 ${progress.retryAttempt} 次重試，等待 ${Math.ceil((progress.retryWaitMs || 0) / 1000)} 秒`
    : '';
  document.getElementById('aiProgressText').textContent = message || retryMessage || `第 ${progress?.completedBatches || 0}／${progress?.totalBatches || 0} 批・累計重試 ${progress?.totalRetries || 0} 次`;
}

function setAiRunning(running) {
  state.aiPolling = running;
  document.getElementById('runAiOptimize').disabled = running;
  document.getElementById('cancelAiOptimize').hidden = !running;
  if (running) document.getElementById('resumeAiOptimize').hidden = true;
}

function aiRequestCues() {
  const scope = document.getElementById('aiScope').value;
  const source = scope === 'selected' ? [state.cues[state.activeIndex]].filter(Boolean) : state.cues;
  return source.map((cue) => ({ id: cue.id, start: cue.startRaw, end: cue.endRaw, text: cue.text }));
}

async function runAiOptimize() {
  const cues = aiRequestCues();
  if (!cues.length) {
    statusMessage(document.getElementById('aiScope').value === 'selected' ? '請先選取一段字幕' : '沒有可優化的字幕');
    return;
  }
  const mode = document.querySelector('.ai-mode.active')?.dataset.aiMode || 'proofread';
  setAiRunning(true);
  setAiProgress({ processedCues: 0, totalCues: cues.length, completedBatches: 0, totalBatches: 1 }, '正在啟動 AI 優化…');
  try {
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/ai-optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cues,
        mode,
        preserveTiming: document.getElementById('aiPreserveTiming').checked,
        language: document.getElementById('aiLanguage').value,
        instructions: document.getElementById('aiInstructions').value.trim(),
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
    await pollAiOptimization();
  } catch (error) {
    setAiRunning(false);
    setAiProgress(null, `AI 優化失敗：${error.message}`);
    statusMessage(`AI 優化失敗：${error.message}`);
  }
}

async function pollAiOptimization() {
  while (state.aiPolling) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/ai-optimize`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
    setAiProgress(result.progress, result.status === 'running' ? undefined : `AI 任務：${result.status}`);
    if (result.status === 'running') continue;
    setAiRunning(false);
    if (result.status === 'completed') {
      state.aiSuggestions = new Map((result.result?.suggestions || []).map((item) => [String(item.id), item]));
      updateAiSuggestionActions();
      renderCueList();
      statusMessage(`AI 優化完成：${state.aiSuggestions.size} 段有修改建議，請逐項確認`);
      return;
    }
    if (result.status === 'cancelled') {
      document.getElementById('resumeAiOptimize').hidden = !result.retryable;
      statusMessage('AI 優化已取消，原字幕未變更');
      return;
    }
    document.getElementById('resumeAiOptimize').hidden = !result.retryable;
    throw new Error(result.error || 'AI 優化失敗');
  }
}

async function restoreAiOptimizationStatus() {
  if (!jobId) return;
  try {
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/ai-optimize`, { cache: 'no-store' });
    if (response.status === 404) return;
    const result = await response.json();
    if (!response.ok || !result.ok) return;
    if (result.status === 'running') {
      setAiRunning(true);
      setAiProgress(result.progress, '正在恢復 AI 任務狀態…');
      pollAiOptimization().catch((error) => statusMessage(`AI 狀態恢復失敗：${error.message}`));
      return;
    }
    if (result.status === 'completed' && result.result) {
      state.aiSuggestions = new Map((result.result.suggestions || []).map((item) => [String(item.id), item]));
      updateAiSuggestionActions();
      renderCueList();
      setAiProgress(result.progress, '先前 AI 優化已完成，請確認建議');
      return;
    }
    if (['failed', 'interrupted', 'cancelled'].includes(result.status)) {
      document.getElementById('resumeAiOptimize').hidden = !result.retryable;
      setAiProgress(result.progress, result.error || 'AI 任務可繼續');
    }
  } catch {}
}

async function resumeAiOptimize() {
  const button = document.getElementById('resumeAiOptimize');
  button.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/resume-ai-optimize`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
    setAiRunning(true);
    setAiProgress(result.progress, `從第 ${Number(result.resumedFromBatch || 0) + 1} 批繼續`);
    await pollAiOptimization();
  } catch (error) {
    statusMessage(`恢復 AI 任務失敗：${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function cancelAiOptimize() {
  try {
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/cancel-ai-optimize`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
    setAiRunning(false);
    setAiProgress(null, 'AI 優化已取消');
    statusMessage('AI 優化已取消，原字幕未變更');
  } catch (error) {
    statusMessage(`取消失敗：${error.message}`);
  }
}

function acceptAiSuggestion(index) {
  const cue = state.cues[index];
  const suggestion = cue ? state.aiSuggestions.get(String(cue.id)) : null;
  if (!cue || !suggestion) return;
  state.aiSuggestions.delete(String(cue.id));
  updateCue(index, suggestion.text);
  updateAiSuggestionActions();
  renderCueList();
  statusMessage(`已接受第 ${index + 1} 段 AI 建議，時間碼未變更`);
}

function rejectAiSuggestion(index) {
  const cue = state.cues[index];
  if (!cue) return;
  state.aiSuggestions.delete(String(cue.id));
  updateAiSuggestionActions();
  renderCueList();
  statusMessage(`已略過第 ${index + 1} 段 AI 建議`);
}

function updateAiSuggestionActions() {
  const count = state.aiSuggestions.size;
  document.getElementById('aiSuggestionActions').hidden = count === 0;
  document.getElementById('aiSuggestionSummary').textContent = `${count} 段 AI 建議等待確認`;
}

function acceptAllAiSuggestions() {
  let accepted = 0;
  state.cues.forEach((cue, index) => {
    const suggestion = state.aiSuggestions.get(String(cue.id));
    if (!suggestion) return;
    cue.text = suggestion.text;
    syncChangedState(index);
    accepted += 1;
  });
  state.aiSuggestions.clear();
  updateAiSuggestionActions();
  renderCueList();
  updateStats();
  updateActiveCue(true);
  if (accepted) markReviewDirty();
  statusMessage(`已接受 ${accepted} 段 AI 建議，所有時間碼維持不變`);
}

function rejectAllAiSuggestions() {
  const rejected = state.aiSuggestions.size;
  state.aiSuggestions.clear();
  updateAiSuggestionActions();
  renderCueList();
  statusMessage(`已略過 ${rejected} 段 AI 建議，原字幕未變更`);
}

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
    restoreAiOptimizationStatus();
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

function handleRuleFile(event) {
  const file = event.target.files[0];
  state.ruleFile = file || null;
  statusMessage(file ? `已載入規則檔：${file.name}` : '已清除規則檔');
}

function loadSrtText(text, message) {
  state.cues = parseSrt(text);
  state.aiSuggestions.clear();
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
    const aiSuggestion = state.aiSuggestions.get(String(cue.id));
    item.innerHTML = `
      <div class="review-cue-number">${index + 1}</div>
      <div class="review-cue-content">
        <div class="review-cue-meta">
          <div class="review-time">${cue.startRaw} <span>→</span> ${cue.endRaw}</div>
          <span class="${hasRuleWarning(cue.text) ? 'review-chip warn' : 'review-chip'}">${hasRuleWarning(cue.text) ? '待檢查' : '已確認'}</span>
          <button class="jump cue-more" type="button" title="跳到此字幕">•••</button>
        </div>
        <textarea aria-label="字幕 ${index + 1}">${escapeHtml(cue.text)}</textarea>
        ${aiSuggestion ? `<div class="review-ai-suggestion">
          <div><strong>AI 建議</strong><span>${escapeHtml(aiSuggestion.reason || '文字優化')}</span></div>
          <p>${escapeHtml(aiSuggestion.text)}</p>
          <div><button class="accept-ai-suggestion" type="button">接受</button><button class="reject-ai-suggestion" type="button">略過</button></div>
        </div>` : ''}
        <div class="cue-advanced-actions">
          <label class="duration-field">長度（秒）<input class="duration-input" type="number" min="0.1" step="0.1" value="${formatDuration(cue.end - cue.start)}"></label>
          <div class="cue-mini-buttons"><button class="shorten-cue" type="button">縮短</button><button class="extend-cue" type="button">延長</button></div>
          <button class="split-cue" type="button">分割</button>
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
  else if (event.target.closest('.split-cue')) splitCue(index, event.target.closest('.review-cue')?.querySelector('textarea'));
  else if (event.target.closest('.merge-next')) mergeCueWithNext(index);
  else if (event.target.closest('.delete-cue')) deleteCue(index);
  else if (event.target.closest('.accept-ai-suggestion')) acceptAiSuggestion(index);
  else if (event.target.closest('.reject-ai-suggestion')) rejectAiSuggestion(index);
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

async function applyRulesToAll() {
  if (!state.cues.length) {
    statusMessage('請先載入字幕後再套用規則');
    return;
  }
  if (!state.ruleFile) {
    statusMessage('請先在上方載入規則檔，再按「套用規則」');
    return;
  }
  const button = document.getElementById('applyRules');
  button.disabled = true;
  statusMessage('正在套用規則檔...');
  try {
    const form = new FormData();
    form.set('ruleFile', state.ruleFile, state.ruleFile.name || 'review-rule.txt');
    form.set('subtitle', new Blob([buildSrt()], { type: 'text/plain;charset=utf-8' }), 'current-review.srt');
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/apply-rules`, {
      method: 'POST',
      body: form,
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
    loadSrtText(result.subtitle, `已套用規則：${result.changedCues}/${result.totalCues} 段字幕有修改`);
  } catch (error) {
    statusMessage(`套用規則失敗：${error.message}`);
  } finally {
    button.disabled = false;
  }
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

function splitCue(index, textarea) {
  const cue = state.cues[index];
  if (!cue) return;
  const splitAt = getCueSplitIndex(cue.text, textarea);
  if (splitAt <= 0 || splitAt >= cue.text.length) {
    statusMessage('這段字幕太短，無法分割');
    return;
  }
  const firstText = cue.text.slice(0, splitAt).trim();
  const secondText = cue.text.slice(splitAt).trim();
  if (!firstText || !secondText) {
    statusMessage('分割點前後都需要有文字');
    return;
  }
  const midpoint = cue.start + Math.max(0.1, (cue.end - cue.start) / 2);
  const splitTime = Math.min(cue.end - 0.1, Math.max(cue.start + 0.1, midpoint));
  if (splitTime <= cue.start || splitTime >= cue.end) {
    statusMessage('這段字幕時間太短，無法分割');
    return;
  }
  const firstCue = {
    ...cue,
    end: splitTime,
    endRaw: formatSrtTime(splitTime),
    text: firstText,
  };
  const secondCue = {
    ...cue,
    id: cue.id + 1,
    start: splitTime,
    startRaw: formatSrtTime(splitTime),
    text: secondText,
    originalText: cue.originalText,
    originalStartRaw: cue.originalStartRaw,
    originalEndRaw: cue.originalEndRaw,
  };
  state.cues.splice(index, 1, firstCue, secondCue);
  rebuildCueIds();
  rebuildChangedSet();
  renderCueList();
  updateStats();
  setActiveCue(index);
  statusMessage(`已將第 ${index + 1} 段字幕分割成兩段`);
  markReviewDirty();
}

function getCueSplitIndex(text, textarea) {
  const value = String(text || '');
  const cursor = textarea && document.activeElement === textarea
    ? Number(textarea.selectionStart)
    : -1;
  if (Number.isInteger(cursor) && cursor > 0 && cursor < value.length) return cursor;
  const middle = Math.floor(value.length / 2);
  const candidates = [];
  for (let distance = 0; distance < value.length; distance += 1) {
    for (const pos of [middle - distance, middle + distance]) {
      if (pos <= 0 || pos >= value.length) continue;
      const char = value[pos];
      if (/[，。！？；、,.!?;\s\n]/.test(char)) candidates.push(pos + (/\s|\n/.test(char) ? 0 : 1));
    }
    if (candidates.length) break;
  }
  return candidates[0] || middle;
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

function buildVtt() {
  const body = state.cues.map((cue) => [
    `${cue.startRaw.replace(',', '.')} --> ${cue.endRaw.replace(',', '.')}`,
    cue.text.trim(),
  ].join('\n')).join('\n\n');
  return `WEBVTT\n\n${body}${body ? '\n' : ''}`;
}

async function downloadSubtitle(format) {
  if (state.dirty) await saveSrt({ silent: true });
  if (jobId) {
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/subtitle?format=${encodeURIComponent(format)}`, { cache: 'no-store' });
    if (response.ok) {
      const blob = await response.blob();
      downloadBlob(blob, `${state.videoFileName || 'media'}.edited.${format}`);
      return;
    }
  }
  const text = format === 'vtt' ? buildVtt() : buildSrt();
  const type = format === 'vtt' ? 'text/vtt;charset=utf-8' : 'text/plain;charset=utf-8';
  downloadBlob(new Blob([text], { type }), `media.edited.${format}`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadSrt() {
  downloadSubtitle('srt');
}

function downloadVtt() {
  downloadSubtitle('vtt');
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
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const milliseconds = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const wholeSeconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
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
