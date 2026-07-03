// API base URL — Web/Electron 都使用目前頁面的本機伺服器
const API_BASE = window.location.origin.startsWith('http')
  ? window.location.origin
  : 'http://127.0.0.1:8790';

const form = document.getElementById('jobForm');
const progressNumber = document.getElementById('progressNumber');
const progressBar = document.getElementById('progressBar');
const stageName = document.getElementById('stageName');
const statusText = document.getElementById('statusText');
const logBox = document.getElementById('logBox');
const jobBadge = document.getElementById('jobBadge');
const openReview = document.getElementById('openReview');
const healthButton = document.getElementById('healthButton');
const openJobFolder = document.getElementById('openJobFolder');
const ffmpegMetric = document.getElementById('ffmpegMetric');
const pythonMetric = document.getElementById('pythonMetric');
const whisperMetric = document.getElementById('whisperMetric');
const gpuMetric = document.getElementById('gpuMetric');
const appLanguage = document.getElementById('appLanguage');
const projectFolder = document.getElementById('projectFolder');
const importFolder = document.getElementById('importFolder');
const exportFolder = document.getElementById('exportFolder');
const saveSettingsButton = document.getElementById('saveSettings');
const reloadSettingsButton = document.getElementById('reloadSettings');
const openProjectFolderButton = document.getElementById('openProjectFolder');
const openSettingsButton = document.getElementById('openSettings');
const closeSettingsButton = document.getElementById('closeSettings');
const appSettingsModal = document.getElementById('appSettings');
const settingsStatus = document.getElementById('settingsStatus');
const settingsSummary = document.getElementById('settingsSummary');
const taskManagerBtn = document.getElementById('taskManagerBtn');
const taskManagerModal = document.getElementById('taskManagerModal');
const closeTaskManagerBtn = document.getElementById('closeTaskManager');
const taskSearchInput = document.getElementById('taskSearch');
const taskFilterSelect = document.getElementById('taskFilter');
const refreshTasksBtn = document.getElementById('refreshTasks');
const taskListContainer = document.getElementById('taskListContainer');
const taskCountEl = document.getElementById('taskCount');
const exportModal = document.getElementById('exportModal');
const closeExportModalBtn = document.getElementById('closeExportModal');
const exportMode = document.getElementById('exportMode');
const exportFormat = document.getElementById('exportFormat');
const exportQuality = document.getElementById('exportQuality');
const startExportBtn = document.getElementById('startExport');
const cancelExportBtn = document.getElementById('cancelExport');
const openOutputFolderBtn = document.getElementById('openOutputFolder');
const exportStatus = document.getElementById('exportStatus');

let currentJobId = null;
let pollTimer = null;
let currentSettings = null;
let currentProjectPath = null;
let allTasks = [];

// ── First-launch bootstrap check ────────────────────────────────────────────
(async function runBootstrapCheck() {
  const overlay = document.getElementById('bootstrapOverlay');
  const checkDiv = document.getElementById('bootstrapCheck');
  const resultDiv = document.getElementById('bootstrapResult');
  const successDiv = document.getElementById('bootstrapSuccess');
  const missingDiv = document.getElementById('bootstrapMissing');
  const missingListEl = document.getElementById('bootstrapMissingList');
  const stepsEl = document.getElementById('bootstrapSteps');
  const openSetupBtn = document.getElementById('bootstrapOpenSetup');
  const retryBtn = document.getElementById('bootstrapRetry');

  if (!overlay) {
    // No bootstrap UI — skip check, proceed normally
    return;
  }

  // Show spinner
  overlay.style.display = 'flex';
  checkDiv.style.display = 'block';
  resultDiv.style.display = 'none';

  try {
    const resp = await fetch(`${API_BASE}/api/bootstrap`, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    checkDiv.style.display = 'none';
    resultDiv.style.display = 'block';

    if (data.ready) {
      // All tools present — show success and auto-dismiss
      successDiv.style.display = 'block';
      missingDiv.style.display = 'none';
      overlay.style.display = 'none';
      // Store in localStorage so we don't show again
      try { localStorage.setItem('bootstrap_done', 'true'); } catch {}
    } else {
      // Some tools missing — show guidance
      successDiv.style.display = 'none';
      missingDiv.style.display = 'block';

      missingListEl.textContent = `缺少工具：${data.missingTools.join('、')}`;

      if (data.installGuide?.steps?.length) {
        stepsEl.innerHTML = data.installGuide.steps.map((s) => `<li>${s}</li>`).join('');
      }

      if (openSetupBtn) {
        openSetupBtn.addEventListener('click', () => {
          // Try to open the setup script location
          const setupPath = 'setup-local-tools.bat';
          if (window.electronAPI?.openExternal) {
            // In Electron, try to open the folder containing setup script
            try {
              window.electronAPI.openExternal(`file://${setupPath}`);
            } catch {}
          }
          // Fallback: try to execute via shell
          if (window.electronAPI?.openFolder) {
            // Open the app directory
          }
          // Last resort: copy the path to clipboard
          if (navigator.clipboard) {
            navigator.clipboard.writeText(setupPath).then(() => {
              openSetupBtn.textContent = '✅ 已複製路徑到剪貼簿';
            }).catch(() => {});
          }
        });
      }

      if (retryBtn) {
        retryBtn.addEventListener('click', async () => {
          retryBtn.disabled = true;
          retryBtn.textContent = '檢查中...';
          checkDiv.style.display = 'block';
          resultDiv.style.display = 'none';
          try {
            const resp2 = await fetch(`${API_BASE}/api/bootstrap`, { cache: 'no-store' });
            if (!resp2.ok) throw new Error(`HTTP ${resp2.status}`);
            const data2 = await resp2.json();
            checkDiv.style.display = 'none';
            resultDiv.style.display = 'block';
            if (data2.ready) {
              successDiv.style.display = 'block';
              missingDiv.style.display = 'none';
              overlay.style.display = 'none';
              try { localStorage.setItem('bootstrap_done', 'true'); } catch {}
            } else {
              missingListEl.textContent = `缺少工具：${data2.missingTools.join('、')}`;
              if (data2.installGuide?.steps?.length) {
                stepsEl.innerHTML = data2.installGuide.steps.map((s) => `<li>${s}</li>`).join('');
              }
            }
          } catch (e) {
            missingListEl.textContent = `檢查失敗：${e.message}`;
          }
          retryBtn.disabled = false;
          retryBtn.textContent = '🔄 重新檢查';
        });
      }
    }
  } catch (err) {
    // Could not reach server — hide overlay and let the main UI handle it
    console.warn('[bootstrap] Could not reach server:', err.message);
    overlay.style.display = 'none';
  }
})();

// ── 影片資訊即時顯示 ──────────────────────────────
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}
async function updateVideoInfoFromProbe(file) {
  const elDuration = document.getElementById('infoDuration');
  const elResolution = document.getElementById('infoResolution');
  if (!elDuration || !elResolution) return;
  elDuration.textContent = '分析中…';
  elResolution.textContent = '分析中…';
  try {
    const formData = new FormData();
    formData.append('video', file);
    const resp = await fetch(`${API_BASE}/api/video/probe`, {
      method: 'POST',
      body: formData,
    });
    if (!resp.ok) throw new Error('probe failed');
    const info = await resp.json();
    elDuration.textContent = formatDuration(info.duration);
    elResolution.textContent = info.resolution;
  } catch (err) {
    console.error('影片資訊分析失敗:', err);
    elDuration.textContent = '分析失敗';
    elResolution.textContent = '分析失敗';
  }
}

localStorage.removeItem('offlineSubtitleFactory.currentJobId');
loadAppSettings();
bindFileLabel('videoFile', 'videoName', (file) => {
  const elName = document.getElementById('infoFileName');
  const elFileSize = document.getElementById('infoFileSize');
  if (elName) elName.textContent = file ? file.name : '-';
  if (elFileSize) elFileSize.textContent = file ? formatFileSize(file.size) : '-';
  if (file) updateVideoInfoFromProbe(file);
});
bindFileLabel('ruleFile', 'ruleName');
bindFileLabel('existingSrt', 'srtName');
bindDropUploads();
bindSettingsControls();
bindProjectMenuControls();
bindTaskManagerControls();
bindExportControls();

document.querySelectorAll('.workflow button').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.step === 'review') {
      openReviewStage('proofread');
      return;
    }
    if (button.dataset.step === 'burn') {
      openReviewStage('burn');
      return;
    }
    if (button.dataset.step === 'export') {
      handleExportStep();
      return;
    }
    document.querySelectorAll('.workflow button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    const target = document.getElementById(button.dataset.step);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});

healthButton.addEventListener('click', async () => {
  setStatus({
    progress: 8,
    stage: 'preflight',
    message: '正在檢查本機環境',
    logs: ['呼叫 /api/health'],
  });

  const response = await fetch(`${API_BASE}/api/health`, { cache: 'no-store' });
  const health = await response.json();
  updateMetrics(health.tools);
  setStatus({
    progress: 18,
    stage: 'preflight',
    message: `Node ${health.node}，環境檢查完成`,
    logs: [
      `FFmpeg=${labelOk(health.tools.ffmpeg)}`,
      `Python=${labelOk(health.tools.python)}`,
      `Whisper=${labelOk(health.tools.whisper)}`,
      `GPU=${gpuSummary(health.tools.gpu)}`,
    ],
    metrics: {
      hasFfmpeg: health.tools.ffmpeg,
      hasPython: health.tools.python,
      hasWhisper: health.tools.whisper,
      gpu: health.tools.gpu,
    },
  });
});

async function loadAppSettings() {
  try {
    const response = await fetch(`${API_BASE}/api/settings`, { cache: 'no-store' });
    if (!response.ok) throw new Error(await response.text());
    const settings = await response.json();
    currentSettings = settings;
    fillSettingsForm(settings);
    applyInterfaceLanguage(settings.appLanguage);
    updateSettingsStatus('設定已載入');
  } catch (error) {
    updateSettingsStatus(`設定載入失敗：${error.message}`);
  }
}

function fillSettingsForm(settings) {
  appLanguage.value = settings.appLanguage || 'zh-TW';
  projectFolder.value = settings.projectFolder || '';
  importFolder.value = settings.importFolder || '';
  exportFolder.value = settings.exportFolder || '';
  settingsSummary.textContent = settings.projectFolder
    ? `新任務會儲存在：${settings.projectFolder}`
    : '設定將套用到下一個新任務。';
}

function readSettingsForm() {
  return {
    appLanguage: appLanguage.value,
    projectFolder: projectFolder.value.trim(),
    importFolder: importFolder.value.trim(),
    exportFolder: exportFolder.value.trim(),
  };
}

function bindSettingsControls() {
  saveSettingsButton?.addEventListener('click', saveAppSettings);
  reloadSettingsButton?.addEventListener('click', loadAppSettings);
  openSettingsButton?.addEventListener('click', openSettingsPanel);
  closeSettingsButton?.addEventListener('click', closeSettingsPanel);
  appSettingsModal?.addEventListener('click', (event) => {
    if (event.target === appSettingsModal) closeSettingsPanel();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && appSettingsModal?.classList.contains('is-open')) closeSettingsPanel();
  });
  window.electronAPI?.onOpenSettings?.(() => {
    openSettingsPanel();
  });
  window.addEventListener('open-app-settings', () => {
    openSettingsPanel();
  });
  if (window.location.hash === '#settings') {
    openSettingsPanel();
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#settings') {
      openSettingsPanel();
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  });
  appLanguage?.addEventListener('change', () => {
    applyInterfaceLanguage(appLanguage.value);
  });
  openProjectFolderButton?.addEventListener('click', async () => {
    const folder = projectFolder.value.trim();
    if (!folder) {
      updateSettingsStatus('請先設定專案資料夾');
      return;
    }
    if (window.electronAPI?.openArbitraryFolder) {
      try {
        await window.electronAPI.openArbitraryFolder(folder);
        updateSettingsStatus(`已開啟：${folder}`);
      } catch (err) {
        updateSettingsStatus(`開啟失敗：${err.message}`);
      }
    } else if (window.electronAPI?.openFolder) {
      try {
        await window.electronAPI.openFolder(folder);
        updateSettingsStatus(`已開啟：${folder}`);
      } catch {
        updateSettingsStatus('開啟失敗，請手動開啟');
      }
    } else {
      updateSettingsStatus('網頁模式無法直接開啟本機資料夾，請複製路徑後手動開啟');
    }
  });
  document.querySelectorAll('.folder-picker').forEach((button) => {
    button.addEventListener('click', async () => {
      const input = document.getElementById(button.dataset.folderInput);
      if (!input) return;
      if (!window.electronAPI?.selectFolder) {
        updateSettingsStatus('ElectV 模式請直接輸入資料夾路徑');
        input.focus();
        return;
      }
      const labelSpan = button.closest('label')?.querySelector('span');
      const selected = await window.electronAPI.selectFolder({
        title: labelSpan?.textContent || '選擇資料夾',
        message: '請選擇一個資料夾',
        defaultPath: input.value || projectFolder.value || undefined,
      });
      if (selected) {
        input.value = selected;
        updateSettingsStatus(`已選擇：${selected}`);
      }
    });
  });

  // Bind folder-open buttons (📂 to open the entered path)
  document.querySelectorAll('.folder-open').forEach((button) => {
    button.addEventListener('click', async () => {
      const inputId = button.dataset.folderTarget;
      const input = document.getElementById(inputId);
      if (!input) return;
      const folder = input.value.trim();
      if (!folder) {
        updateSettingsStatus('請先輸入資料夾路徑');
        return;
      }
      button.dataset.openRequested = folder;
      if (window.__skipNativeFolderOpenForTest) {
        button.dataset.openResult = 'skipped';
        updateSettingsStatus(`已確認開啟流程：${folder}`);
        return;
      }
      if (window.electronAPI?.openArbitraryFolder) {
        try {
          const result = await window.electronAPI.openArbitraryFolder(folder);
          if (result) throw new Error(result);
          button.dataset.openResult = 'ok';
          updateSettingsStatus(`已開啟：${folder}`);
        } catch (err) {
          button.dataset.openResult = 'failed';
          updateSettingsStatus(`開啟失敗：${err.message}`);
        }
      } else if (window.electronAPI?.openFolder) {
        try {
          const result = await window.electronAPI.openFolder(folder);
          if (result) throw new Error(result);
          button.dataset.openResult = 'ok';
          updateSettingsStatus(`已開啟：${folder}`);
        } catch {
          button.dataset.openResult = 'failed';
          updateSettingsStatus('開啟失敗，請確認路徑正確');
        }
      } else {
        button.dataset.openResult = 'failed';
        updateSettingsStatus('網頁模式無法直接開啟本機資料夾');
      }
    });
  });
}

function openSettingsPanel() {
  appSettingsModal?.classList.add('is-open');
  appSettingsModal?.setAttribute('aria-hidden', 'false');
  loadAppSettings();
  setTimeout(() => appLanguage?.focus(), 0);
}

function closeSettingsPanel() {
  appSettingsModal?.classList.remove('is-open');
  appSettingsModal?.setAttribute('aria-hidden', 'true');
  openSettingsButton?.focus?.();
}

async function saveAppSettings() {
  updateSettingsStatus('正在儲存設定...');
  try {
    const response = await fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readSettingsForm()),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || '儲存失敗');
    currentSettings = result.settings;
    fillSettingsForm(result.settings);
    applyInterfaceLanguage(result.settings.appLanguage);
    updateSettingsStatus('設定已儲存，下一個新任務會使用新的專案資料夾');
  } catch (error) {
    updateSettingsStatus(`設定儲存失敗：${error.message}`);
  }
}

function applyInterfaceLanguage(language) {
  document.documentElement.lang = language === 'en' ? 'en' : language === 'zh-CN' ? 'zh-Hans' : 'zh-Hant';
  const formLanguage = form.elements.language;
  if (formLanguage && !currentJobId) {
    formLanguage.value = language === 'en' ? 'en' : language === 'zh-CN' ? 'zh' : 'zh-TW';
  }
}

function updateSettingsStatus(message) {
  if (settingsStatus) settingsStatus.textContent = message;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  // Reset video info (will be taken over by job status after submission)
  const elDuration = document.getElementById('infoDuration');
  const elResolution = document.getElementById('infoResolution');
  if (elDuration) elDuration.textContent = '-';
  if (elResolution) elResolution.textContent = '-';
  openReview.disabled = true;
  setStatus({
    progress: 4,
    stage: 'uploading',
    message: '正在建立任務並上傳檔案',
    logs: ['準備送出影片、規則檔與需求說明'],
  });

  const response = await fetch(`${API_BASE}/api/jobs`, {
    method: 'POST',
    body: new FormData(form),
  });

  if (!response.ok) {
    const text = await response.text();
    setStatus({
      status: 'failed',
      stage: 'failed',
      progress: 100,
      message: `建立任務失敗：${text}`,
      logs: [text],
    });
    return;
  }

  const created = await response.json();
  currentJobId = created.jobId;
  jobBadge.textContent = `workspace/jobs/${currentJobId}`;
  setStatus(created.status);

  await fetch(`${API_BASE}/api/jobs/${currentJobId}/start`, { method: 'POST' });
  startPolling();
});

openReview.addEventListener('click', () => {
  if (!currentJobId) return;
  openReviewStage('proofread');
});

openJobFolder.addEventListener('click', () => {
  openFolder('job');
});

function bindFileLabel(inputId, labelId, onChange) {
  const input = document.getElementById(inputId);
  const label = document.getElementById(labelId);
  input.addEventListener('change', () => {
    const file = input.files[0];
    label.textContent = file?.name || '尚未選擇';
    if (onChange) onChange(file);
  });
}

function bindDropUploads() {
  document.querySelectorAll('[data-drop-target]').forEach((dropZone) => {
    const input = document.getElementById(dropZone.dataset.dropTarget);
    if (!input) return;
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.remove('drag-over');
      });
    });
    dropZone.addEventListener('drop', (event) => {
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!currentJobId) return;
    const response = await fetch(`${API_BASE}/api/jobs/${currentJobId}/status`, { cache: 'no-store' });
    if (!response.ok) return;
    const status = await response.json();
    setStatus(status);
    const terminalStates = ['completed', 'failed', 'cancelled', 'needs-action'];
    if (terminalStates.includes(status.status)) {
      clearInterval(pollTimer);
      openReview.disabled = status.status !== 'completed';
      if (status.status === 'completed') {
      }
    }
  }, 1000);
}

function openReviewStage(stage) {
  if (!currentJobId) {
    setStatus({
      progress: 0,
      stage: 'waiting',
      message: '請先完成字幕生成，才能進入校閱或燒錄預覽。',
      logs: ['尚未有可校閱的任務 ID'],
    });
    return;
  }
  // Electron 環境和網頁環境都指向本機伺服器
  window.location.href = `${API_BASE}/review/${encodeURIComponent(currentJobId)}?stage=${encodeURIComponent(stage)}`;
}

async function openFolder(target) {
  if (!currentJobId) {
    setStatus({
      progress: 0,
      stage: 'waiting',
      message: '請先建立任務，才能開啟任務資料夾。',
      logs: ['尚未有可開啟的任務資料夾'],
    });
    return;
  }
  const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(currentJobId)}/open-folder?target=${encodeURIComponent(target)}`, {
    method: 'POST',
  });
  const result = await response.json();
  if (result.ok) {
    if (window.electronAPI) {
      // Electron 環境：透過 IPC 開啟資料夾（server 回傳的是相對路徑，由 main process 解析）
      try {
        await window.electronAPI.openFolder(result.folder);
      } catch {
        // IPC 失敗時 fallback 到顯示訊息
      }
    }
  }
  setStatus({
    progress: Number(progressNumber.textContent.replace('%', '')) || 0,
    stage: result.ok ? 'ready-review' : 'failed',
    message: result.ok ? `已開啟資料夾：${result.folder}` : `開啟資料夾失敗：${result.error}`,
    logs: [result.ok ? `已開啟 ${result.folder}` : result.error],
  });
}

function handleExportStep() {
  if (!currentJobId) {
    setStatus({
      progress: 0,
      stage: 'waiting',
      message: '請先完成字幕生成與校閱，再進行輸出。',
      logs: ['尚未有可輸出的任務'],
    });
    return;
  }

  openExportModal();
}

function bindTaskManagerControls() {
  taskManagerBtn?.addEventListener('click', openTaskManager);
  taskManagerBtn?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openTaskManager();
    }
  });
  closeTaskManagerBtn?.addEventListener('click', closeTaskManager);
  refreshTasksBtn?.addEventListener('click', loadTaskList);
  taskSearchInput?.addEventListener('input', renderTaskList);
  taskFilterSelect?.addEventListener('change', renderTaskList);
  taskManagerModal?.addEventListener('click', (event) => {
    if (event.target === taskManagerModal) closeTaskManager();
  });
}

function openTaskManager() {
  if (!taskManagerModal) return;
  taskManagerModal.classList.add('is-open');
  taskManagerModal.setAttribute('aria-hidden', 'false');
  loadTaskList();
  setTimeout(() => taskSearchInput?.focus(), 0);
}

function closeTaskManager() {
  taskManagerModal?.classList.remove('is-open');
  taskManagerModal?.setAttribute('aria-hidden', 'true');
}

async function loadTaskList() {
  if (!taskListContainer) return;
  taskListContainer.innerHTML = '<p class="task-list-empty">載入任務中...</p>';
  try {
    const response = await fetch(`${API_BASE}/api/jobs`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    allTasks = Array.isArray(data.jobs) ? data.jobs : [];
    renderTaskList();
  } catch (error) {
    taskListContainer.innerHTML = `<p class="task-list-empty">讀取任務失敗：${escapeHtml(error.message)}</p>`;
    if (taskCountEl) taskCountEl.textContent = '讀取失敗';
  }
}

function renderTaskList() {
  if (!taskListContainer) return;
  const query = (taskSearchInput?.value || '').trim().toLowerCase();
  const filter = taskFilterSelect?.value || 'all';
  const tasks = allTasks.filter((task) => {
    const matchesFilter = filter === 'all' || task.status === filter;
    const haystack = [task.jobId, task.files?.video, task.files?.ruleFile, task.message, task.stage]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return matchesFilter && (!query || haystack.includes(query));
  });
  if (taskCountEl) taskCountEl.textContent = `共 ${tasks.length} / ${allTasks.length} 個任務`;
  if (!tasks.length) {
    taskListContainer.innerHTML = '<p class="task-list-empty">沒有符合條件的任務。</p>';
    return;
  }
  taskListContainer.innerHTML = tasks.map((task) => {
    const created = formatDateTime(task.createdAt);
    const video = task.files?.video || '未命名影片';
    return `
      <article class="task-item" data-job-id="${escapeHtml(task.jobId)}">
        <div>
          <strong class="task-item-title">${escapeHtml(video)}</strong>
          <span class="task-item-meta">${escapeHtml(task.jobId)}｜${escapeHtml(created)}｜${escapeHtml(stageLabel(task.stage))} ${Math.round(task.progress || 0)}%</span>
          <em class="task-item-message">${escapeHtml(task.message || '沒有狀態訊息')}</em>
        </div>
        <div class="task-item-actions">
          <span class="status-pill ${escapeHtml(task.status)}">${escapeHtml(statusLabel(task.status))}</span>
          <button type="button" class="small-button" data-task-action="load">載入</button>
          <button type="button" class="small-button" data-task-action="review">校閱</button>
          <button type="button" class="small-button" data-task-action="folder">資料夾</button>
        </div>
      </article>`;
  }).join('');
  taskListContainer.querySelectorAll('[data-task-action]').forEach((button) => {
    button.addEventListener('click', handleTaskAction);
  });
}

async function handleTaskAction(event) {
  const item = event.currentTarget.closest('.task-item');
  const jobId = item?.dataset.jobId;
  if (!jobId) return;
  const action = event.currentTarget.dataset.taskAction;
  if (action === 'review') {
    window.location.href = `${API_BASE}/review/${encodeURIComponent(jobId)}?stage=proofread`;
    return;
  }
  if (action === 'folder') {
    const previousJobId = currentJobId;
    currentJobId = jobId;
    await openFolder('job');
    currentJobId = previousJobId;
    return;
  }
  currentJobId = jobId;
  jobBadge.textContent = `workspace/jobs/${currentJobId}`;
  await loadJobStatus(jobId, { fallbackMessage: `已載入歷史任務：${jobId}` });
  closeTaskManager();
}

function bindExportControls() {
  closeExportModalBtn?.addEventListener('click', closeExportModal);
  exportModal?.addEventListener('click', (event) => {
    if (event.target === exportModal) closeExportModal();
  });
  startExportBtn?.addEventListener('click', startExportJob);
  cancelExportBtn?.addEventListener('click', cancelExportJob);
  openOutputFolderBtn?.addEventListener('click', () => openFolder('output'));
}

function openExportModal() {
  if (!exportModal) return;
  exportModal.classList.add('is-open');
  exportModal.setAttribute('aria-hidden', 'false');
  if (exportStatus) exportStatus.textContent = `目前任務：${currentJobId}`;
}

function closeExportModal() {
  exportModal?.classList.remove('is-open');
  exportModal?.setAttribute('aria-hidden', 'true');
}

async function startExportJob() {
  if (!currentJobId) return;
  startExportBtn.disabled = true;
  if (exportStatus) exportStatus.textContent = '正在啟動輸出...';
  try {
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(currentJobId)}/burn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: exportMode?.value || 'hardsub',
        outputFormat: exportFormat?.value || 'mp4',
        quality: exportQuality?.value || 'h264-medium',
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
    if (exportStatus) exportStatus.textContent = result.message || '字幕輸出已啟動';
    setStatus({
      status: 'running',
      stage: 'export-start',
      progress: 6,
      message: '字幕輸出已啟動',
      logs: ['FFmpeg 輸出程序已啟動'],
    });
    startPolling();
  } catch (error) {
    if (exportStatus) exportStatus.textContent = `輸出失敗：${error.message}`;
    setStatus({
      status: 'failed',
      stage: 'burn-failed',
      progress: 100,
      message: `輸出啟動失敗：${error.message}`,
      logs: [error.message],
    });
  } finally {
    startExportBtn.disabled = false;
  }
}

async function cancelExportJob() {
  if (!currentJobId) return;
  const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(currentJobId)}/cancel-burn`, {
    method: 'POST',
  });
  const result = await response.json().catch(() => ({}));
  if (exportStatus) exportStatus.textContent = result.cancelled ? '已送出取消輸出' : '目前沒有進行中的輸出';
}

function statusLabel(status) {
  const labels = {
    created: '未開始',
    running: '進行中',
    completed: '已完成',
    failed: '失敗',
    cancelled: '已取消',
    'needs-action': '待處理',
  };
  return labels[status] || status || '未知';
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-TW', { hour12: false });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setStatus(status) {
  const progress = Number(status.progress || 0);
  progressNumber.textContent = `${Math.round(progress)}%`;
  progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  stageName.textContent = stageLabel(status.stage || 'waiting');
  statusText.textContent = status.message || status.status || '等待開始';

  const logs = status.logs?.length ? status.logs : ['等待建立字幕任務'];
  logBox.textContent = sanitizeLogs(logs).join('\n');

  if (status.metrics) {
    updateMetrics({
      ffmpeg: status.metrics.hasFfmpeg,
      python: status.metrics.hasPython,
      whisper: status.metrics.hasWhisper,
      gpu: status.metrics.gpu,
    });
  }
}

function bindProjectMenuControls() {
  window.electronAPI?.onProjectNew?.(() => {
    newBlankProject({ confirmFirst: true });
  });
  window.electronAPI?.onProjectSave?.(() => {
    saveProjectFile();
  });
  window.electronAPI?.onProjectOpen?.(() => {
    openProjectFile();
  });
}

function collectProjectData() {
  return {
    appVersion: '0.1.0',
    jobId: currentJobId,
    projectPath: currentProjectPath,
    form: {
      language: form.elements.language?.value || '',
      asrEngine: form.elements.asrEngine?.value || '',
      modelName: form.elements.modelName?.value || '',
      outputFormats: form.elements.outputFormats?.value || '',
      requirements: form.elements.requirements?.value || '',
    },
    selectedFiles: {
      video: fileSummary('videoFile'),
      ruleFile: fileSummary('ruleFile'),
      existingSrt: fileSummary('existingSrt'),
    },
    status: {
      progress: Number(progressNumber.textContent.replace('%', '')) || 0,
      stage: stageName.textContent || '等待中',
      message: statusText.textContent || '',
      logs: logBox.textContent || '',
    },
    savedAt: new Date().toISOString(),
  };
}

function fileSummary(inputId) {
  const input = document.getElementById(inputId);
  const file = input?.files?.[0];
  if (!file) return null;
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  };
}

async function saveProjectFile() {
  if (!window.electronAPI?.saveProjectFile) {
    setStatus({
      progress: Number(progressNumber.textContent.replace('%', '')) || 0,
      stage: 'waiting',
      message: '目前環境不支援儲存專案檔，請使用 Electron 版本。',
      logs: ['缺少 electronAPI.saveProjectFile'],
    });
    return;
  }
  try {
    const result = await window.electronAPI.saveProjectFile(collectProjectData());
    if (!result?.ok) return;
    currentProjectPath = result.filePath;
    setStatus({
      progress: Number(progressNumber.textContent.replace('%', '')) || 0,
      stage: currentJobId ? 'ready-review' : 'waiting',
      message: `專案檔已儲存：${result.filePath}`,
      logs: [`已儲存 .osfp 專案檔：${result.filePath}`],
    });
  } catch (error) {
    setStatus({
      progress: Number(progressNumber.textContent.replace('%', '')) || 0,
      stage: 'failed',
      message: `儲存專案檔失敗：${error.message}`,
      logs: [error.message],
    });
  }
}

async function openProjectFile() {
  if (!window.electronAPI?.openProjectFile) {
    setStatus({
      progress: 0,
      stage: 'waiting',
      message: '目前環境不支援讀取專案檔，請使用 Electron 版本。',
      logs: ['缺少 electronAPI.openProjectFile'],
    });
    return;
  }
  try {
    const result = await window.electronAPI.openProjectFile();
    if (!result?.ok) return;
    await applyProjectData(result.project, result.filePath);
  } catch (error) {
    setStatus({
      progress: 0,
      stage: 'failed',
      message: `讀取專案檔失敗：${error.message}`,
      logs: [error.message],
    });
  }
}

async function applyProjectData(project, filePath) {
  clearInterval(pollTimer);
  currentProjectPath = filePath || null;
  currentJobId = project?.jobId || null;
  form.reset();
  applyFormValues(project?.form || {});
  clearFileInputs();
  applySavedFileLabels(project?.selectedFiles || {});
  jobBadge.textContent = currentJobId ? `workspace/jobs/${currentJobId}` : 'workspace/jobs/尚未建立';

  if (currentJobId) {
    await loadJobStatus(currentJobId, {
      fallbackMessage: `已讀取專案檔：${filePath}`,
      fallbackLogs: ['專案檔已載入，但目前伺服器找不到對應任務狀態。'],
    });
  } else {
    setStatus({
      progress: 0,
      stage: 'waiting',
      message: `已讀取專案檔：${filePath}`,
      logs: ['此專案尚未建立任務；請重新選擇影片/規則檔後開始字幕生成。'],
    });
    openReview.disabled = true;
  }
}

function applyFormValues(values) {
  if (form.elements.language && values.language) form.elements.language.value = values.language;
  if (form.elements.asrEngine && values.asrEngine) form.elements.asrEngine.value = values.asrEngine;
  if (form.elements.modelName) form.elements.modelName.value = values.modelName || '';
  if (form.elements.outputFormats) form.elements.outputFormats.value = values.outputFormats || 'srt,vtt';
  if (form.elements.requirements) form.elements.requirements.value = values.requirements || '';
}

function clearFileInputs() {
  ['videoFile', 'ruleFile', 'existingSrt'].forEach((inputId) => {
    const input = document.getElementById(inputId);
    if (input) input.value = '';
  });
  document.getElementById('videoName').textContent = '支援格式：MP4、MOV、M4V（建議使用 MP4）';
  document.getElementById('ruleName').textContent = '建議檔名：rule.txt（UTF-8 編碼）';
  document.getElementById('srtName').textContent = '尚未選擇 SRT';
  // Reset video info box
  const infoElements = { infoFileName: '-', infoDuration: '-', infoResolution: '-', infoFileSize: '-' };
  for (const [id, value] of Object.entries(infoElements)) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
}

function applySavedFileLabels(files) {
  if (files.video?.name) document.getElementById('videoName').textContent = `${files.video.name}（請重新選擇檔案）`;
  if (files.ruleFile?.name) document.getElementById('ruleName').textContent = `${files.ruleFile.name}（請重新選擇檔案）`;
  if (files.existingSrt?.name) document.getElementById('srtName').textContent = `${files.existingSrt.name}（請重新選擇檔案）`;
}

async function loadJobStatus(jobId, { fallbackMessage, fallbackLogs } = {}) {
  try {
    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/status`, { cache: 'no-store' });
    if (!response.ok) throw new Error(await response.text());
    const status = await response.json();
    setStatus(status);
    openReview.disabled = status.status !== 'completed';
    if (status.status === 'running') startPolling();
  } catch (error) {
    setStatus({
      progress: 0,
      stage: 'waiting',
      message: fallbackMessage || `無法載入任務：${jobId}`,
      logs: fallbackLogs || [error.message],
    });
    openReview.disabled = true;
  }
}

function newBlankProject({ confirmFirst = false } = {}) {
  if (confirmFirst && !confirm('確定要建立空白專案嗎？目前未儲存的表單內容會被清除。')) return;
  clearInterval(pollTimer);
  currentJobId = null;
  currentProjectPath = null;
  localStorage.removeItem('offlineSubtitleFactory.currentJobId');
  form.reset();
  if (form.elements.outputFormats) form.elements.outputFormats.value = 'srt,vtt';
  applyInterfaceLanguage(currentSettings?.appLanguage || appLanguage?.value || 'zh-TW');
  clearFileInputs();
  jobBadge.textContent = 'workspace/jobs/尚未建立';
  openReview.disabled = true;
  setStatus({
    progress: 0,
    stage: 'waiting',
    message: '已建立空白專案，請設定任務並開始生成字幕。',
    logs: ['空白專案已準備就緒'],
    metrics: {},
  });
}

function updateMetrics(tools) {
  ffmpegMetric.textContent = labelPending(tools?.ffmpeg);
  pythonMetric.textContent = labelPending(tools?.python);
  whisperMetric.textContent = labelPending(tools?.whisper);

  const gpu = tools?.gpu;
  if (!gpu) {
    gpuMetric.textContent = '無資料';
    gpuMetric.removeAttribute('title');
    return;
  }
  gpuMetric.textContent = gpu.available
    ? (gpu.deviceName || gpu.status)
    : 'CPU 運算';
  gpuMetric.title = buildGpuTooltip(gpu);
}

function gpuSummary(gpu) {
  if (!gpu) return '無資料';
  if (gpu.available) return gpu.deviceName || gpu.status;
  return 'CPU only';
}

function buildGpuTooltip(gpu) {
  const parts = [];
  if (gpu.available) {
    const statusLabel = gpu.status === 'cuda'
      ? 'CUDA'
      : gpu.status === 'mps'
        ? 'Metal (Apple Silicon)'
        : gpu.status;
    parts.push(`狀態：${statusLabel} 可用`);
    if (gpu.deviceName) parts.push(`裝置：${gpu.deviceName}`);
    if (gpu.memoryMb) parts.push(`顯存：${Math.round(gpu.memoryMb)} MB`);
    if (gpu.cudaVersion) parts.push(`CUDA 版本：${gpu.cudaVersion}`);
  } else {
    parts.push('狀態：無 GPU 可用，將使用 CPU 運算');
    parts.push('提示：安裝 NVIDIA 驅動 + CUDA Toolkit 或使用 Apple Silicon Mac 可啟用 GPU 加速');
  }
  if (gpu.error) parts.push(`錯誤：${gpu.error}`);
  return parts.join('\n');
}

function labelPending(value) {
  if (value === undefined) return '待檢查';
  return labelOk(value);
}

function labelOk(value) {
  return value ? 'OK' : '未安裝';
}

function stageLabel(stage) {
  const labels = {
    waiting: '等待開始',
    created: '建立任務',
    uploading: '上傳中',
    preflight: '環境檢查',
    'import-srt': '匯入 SRT',
    transcribing: '自動轉錄',
    'rule-cleanup': '套用規則',
    'ready-review': '準備校閱',
    'export-start': '準備輸出',
    'softsub-export': '輸出軟字幕',
    'hardsub-burn': '硬燒錄中',
    'export-completed': '輸出完成',
    'burn-cancelled': '輸出已取消',
    'burn-failed': '輸出失敗',
    'missing-asr': '缺少 ASR',
    failed: '流程失敗',
    cancelled: '已取消',
  };
  return labels[stage] || stage;
}

function sanitizeLogs(logs) {
  return logs
    .map((line) => String(line || '').replace(/[�]+/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((line) => {
      const percentMatch = line.match(/(\d{1,3})%/);
      const speedMatch = line.match(/([0-9.]+\s*(?:MiB|KiB|B|it)\/s)/i);
      if (percentMatch) {
        const speed = speedMatch ? `，速度 ${speedMatch[1]}` : '';
        return `Whisper 轉錄進度 ${percentMatch[1]}%${speed}`;
      }
      return line.length > 160 ? line.slice(0, 160) : line;
    });
}

// ── Cancel / Retry ──────────────────────────────

let cancelBtn = document.getElementById('cancelButton');
let retryBtn = document.getElementById('retryButton');

function updateActionButtons(status) {
  if (!cancelBtn || !retryBtn) return;

  const isRunning = status?.status === 'running';
  const isTerminal = ['completed', 'failed', 'cancelled', 'needs-action'].includes(status?.status);

  cancelBtn.style.display = isRunning ? 'inline-block' : 'none';
  retryBtn.style.display = (status?.status === 'cancelled' || status?.status === 'failed') ? 'inline-block' : 'none';
}

if (cancelBtn) {
  cancelBtn.addEventListener('click', async () => {
    if (!currentJobId) return;
    if (!confirm('確定要取消目前任務嗎？')) return;

    cancelBtn.disabled = true;
    cancelBtn.textContent = '取消中...';

    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(currentJobId)}/cancel`, {
      method: 'POST',
    });

    if (!response.ok) {
      const err = await response.json();
      setStatus({
        progress: Number(progressNumber.textContent.replace('%', '')) || 0,
        stage: 'failed',
        message: `取消失敗：${err.error}`,
        logs: [`取消任務失敗：${err.error}`],
      });
    } else {
      // 立即讀取最新狀態
      const statusResp = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(currentJobId)}/status`);
      if (statusResp.ok) {
        const status = await statusResp.json();
        setStatus(status);
        clearInterval(pollTimer);
      }
    }
    cancelBtn.disabled = false;
    cancelBtn.textContent = '中止任務';
  });
}

if (retryBtn) {
  retryBtn.addEventListener('click', async () => {
    if (!currentJobId) return;
    if (!confirm('確定要重試此任務嗎？系統將從頭重新執行。')) return;

    retryBtn.disabled = true;
    retryBtn.textContent = '重試中...';

    const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(currentJobId)}/retry`, {
      method: 'POST',
    });

    if (!response.ok) {
      const err = await response.json();
      setStatus({
        progress: 0,
        stage: 'failed',
        message: `重試失敗：${err.error}`,
        logs: [`重試任務失敗：${err.error}`],
      });
    } else {
      setStatus({
        progress: 0,
        stage: 'preflight',
        message: '任務重試中...',
        logs: ['已重新啟動任務'],
      });
      startPolling();
    }
    retryBtn.disabled = false;
    retryBtn.textContent = '重新執行';
  });
}

// 在 setStatus 中自動更新按鈕狀態
const originalSetStatus = setStatus;
setStatus = function (status) {
  originalSetStatus(status);
  updateActionButtons(status);
};
