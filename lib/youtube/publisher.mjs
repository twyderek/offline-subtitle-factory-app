import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import { OAuth2Client } from 'google-auth-library';
import { youtube } from '@googleapis/youtube';
import { parseSrtBilingual } from '../../public/bilingual-subtitles.mjs';
import { requestWithMedia } from './media-stream.mjs';

const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
const ACTIVE = new Set(['preparing', 'uploading-video', 'uploading-captions']);
const validId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const publicError = (error) => {
  const status = Number(error?.response?.status || error?.code);
  if (status === 401) return '授權已失效，請重新連結 YouTube。';
  if (status === 403) return 'YouTube 拒絕請求，請檢查權限、API 配額及頻道設定。';
  if (status === 400) return 'YouTube 未接受影片或字幕設定，請檢查內容。';
  return 'YouTube 操作未完成；遠端可能已收到資料，請查看工作狀態或 YouTube Studio。';
};

function atomicJson(file, value) {
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
    fs.renameSync(temp, file);
  } finally { fs.rmSync(temp, { force: true }); }
}

export function validateMetadata(input) {
  if (!input || typeof input !== 'object') throw new Error('請填寫影片資訊。');
  const title = String(input.title || '').trim();
  const description = String(input.description || '');
  if (!title || [...title].length > 100 || /[<>]/.test(title)) throw new Error('標題須為 1–100 字且不含 < >。');
  if (Buffer.byteLength(description, 'utf8') > 5000 || /[<>]/.test(description)) throw new Error('說明須小於 5000 UTF-8 bytes 且不含 < >。');
  let language;
  try { language = Intl.getCanonicalLocales(input.language)[0]; } catch { /* validated below */ }
  if (!language || language.length > 35) throw new Error('請填寫有效的字幕語言，例如 zh-TW。');
  if (typeof input.madeForKids !== 'boolean') throw new Error('請指定是否為兒童專屬內容。');
  if (input.consent !== true) throw new Error('請先同意將選取的影片、字幕與資訊上傳至 YouTube。');
  return { title, description, language, madeForKids: input.madeForKids };
}

export function createPublisher({ dataDir, configDir, safeStorage, openExternal,
  makeAuth = (id, secret, redirect) => new OAuth2Client({ clientId: id, clientSecret: secret, redirectUri: redirect,
    transporterOptions: { timeout: 30000 } }),
  makeApi = (auth) => youtube({ version: 'v3', auth }), oauthTimeoutMs = 180000,
  acquireLease = async () => ({ release: async () => {} }), openMediaStream = fs.createReadStream,
}) {
  const secretFile = path.join(configDir, 'youtube-oauth.safe');
  let credentials;
  let channel = null;
  let authBusy = false;
  let operation = null;
  const records = new Map();
  const historyFile = (root) => path.join(configDir, 'youtube-publish-history', `${crypto.createHash('sha256').update(root).digest('hex')}.json`);
  const assertIdle = () => { if (operation || authBusy) throw new Error('YouTube 工作進行中，請先取消或等待完成。'); };
  const secureAvailable = () => safeStorage.isEncryptionAvailable()
    && safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
  function loadCredentials() {
    if (credentials) return credentials;
    if (!fs.existsSync(secretFile)) return null;
    if (!secureAvailable()) throw new Error('作業系統加密儲存目前不可用。');
    try { credentials = JSON.parse(safeStorage.decryptString(fs.readFileSync(secretFile))); }
    catch { throw new Error('無法讀取 YouTube 授權，請重新匯入 OAuth 設定。'); }
    return credentials;
  }
  function saveCredentials(value) {
    if (!secureAvailable()) throw new Error('作業系統加密儲存目前不可用。');
    fs.mkdirSync(configDir, { recursive: true });
    const temp = `${secretFile}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temp, safeStorage.encryptString(JSON.stringify(value)), { mode: 0o600 });
      fs.renameSync(temp, secretFile);
      credentials = value;
    } finally { fs.rmSync(temp, { force: true }); }
  }
  function authClient(redirect, persistTokens = true) {
    const value = loadCredentials();
    if (!value) throw new Error('請先匯入 Google Desktop OAuth client JSON。');
    const auth = makeAuth(value.clientId, value.clientSecret, redirect);
    auth.setCredentials(value.tokens || {});
    auth.on('tokens', (tokens) => {
      // Persist refresh-token rotations without losing the existing refresh token.
      const current = loadCredentials();
      if (persistTokens && current) saveCredentials({ ...current, tokens: { ...current.tokens, ...tokens } });
    });
    return auth;
  }
  function jobRoot(jobId) {
    if (!validId(jobId)) throw new Error('無效的專案 ID。');
    if (operation?.jobId === jobId) return operation.root;
    const base = fs.realpathSync(typeof dataDir === 'function' ? dataDir() : dataDir);
    const root = fs.realpathSync(path.join(base, jobId));
    if (path.dirname(root) !== base) throw new Error('專案路徑不允許。');
    return root;
  }
  function localFile(root, relative) {
    const candidate = path.join(root, relative);
    const resolved = fs.realpathSync(candidate);
    if (resolved !== candidate || !fs.statSync(resolved).isFile()) throw new Error('檔案不可為符號連結或目錄。');
    return resolved;
  }
  function readRecord(jobId) {
    const root = jobRoot(jobId);
    if (records.has(root)) return records.get(root);
    let file = path.join(root, 'youtube-publish.json');
    if (!fs.existsSync(file)) file = historyFile(root);
    if (!fs.existsSync(file)) return null;
    let value;
    try { value = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { throw new Error('發布紀錄損毀，請先在 YouTube Studio 核對，避免重複上傳。'); }
    // Never project arbitrary local JSON values into renderer state or remote IDs.
    if (!['completed', 'partial', 'cancelled', 'failed', 'interrupted', ...ACTIVE].includes(value.state)
      || !validId(value.channelId) || (value.videoId && !validId(value.videoId))) {
      throw new Error('發布紀錄無效，請先在 YouTube Studio 核對。');
    }
    const record = {
      state: ACTIVE.has(value.state) ? 'interrupted' : value.state,
      channelId: value.channelId, videoId: value.videoId || null,
      captionId: validId(value.captionId) ? value.captionId : null,
      captionStatus: ['serving', 'syncing', 'failed'].includes(value.captionStatus) ? value.captionStatus : null,
      progress: Number.isFinite(value.progress) ? Math.min(100, Math.max(0, value.progress)) : 0,
      language: typeof value.language === 'string' ? value.language.slice(0, 35) : 'zh-TW',
      videoAttempted: value.videoAttempted !== false,
      captionSha256: /^[a-f0-9]{64}$/.test(value.captionSha256) ? value.captionSha256 : null,
      message: '已載入前次發布紀錄；如上傳中斷，請先查看 YouTube Studio。',
    };
    records.set(root, record);
    return record;
  }
  function persist(jobId, record, exclusive = false) {
    const root = jobRoot(jobId);
    // Preserve remote IDs / unknown outcomes even if files are removed outside
    // the app. This ledger contains no paths, credentials or request payloads.
    const backup = historyFile(root);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    if (exclusive) {
      fs.writeFileSync(path.join(root, 'youtube-publish.json'), JSON.stringify(record), { flag: 'wx', mode: 0o600 });
    }
    atomicJson(backup, record);
    if (fs.realpathSync(root) !== root) throw new Error('專案目錄已移除或變動。');
    if (!exclusive) atomicJson(path.join(root, 'youtube-publish.json'), record);
    records.set(root, record);
  }
  function files(jobId) {
    const root = jobRoot(jobId);
    let videos = [];
    try {
      videos = fs.readdirSync(path.join(root, 'output')).filter((name) => /\.mp4$/i.test(name)).flatMap((name) => {
        try { const file = localFile(root, path.join('output', name)); return [{ name, size: fs.statSync(file).size }]; }
        catch { return []; }
      });
    } catch { /* no exports yet */ }
    let subtitle = false;
    try { localFile(root, 'review-output/reviewed.srt'); subtitle = true; } catch { /* no saved review */ }
    return { videos, subtitle, record: readRecord(jobId) };
  }
  async function account(auth, signal) {
    const { data } = await makeApi(auth).channels.list({ part: ['snippet'], mine: true }, { signal, timeout: 30000 });
    if (data.items?.length !== 1 || !validId(data.items[0].id)) throw new Error('請授權一個有效的 YouTube 頻道。');
    return { id: data.items[0].id, title: String(data.items[0].snippet?.title || '').slice(0, 150) };
  }
  async function connect() {
    assertIdle();
    authBusy = true;
    let server;
    let timer;
    try {
      const value = loadCredentials();
      if (!value) throw new Error('請先匯入 Google Desktop OAuth client JSON。');
      if (!secureAvailable()) throw new Error('作業系統加密儲存目前不可用。');
      const state = crypto.randomBytes(32).toString('hex');
      const verifier = crypto.randomBytes(48).toString('base64url');
      let finish;
      const callback = new Promise((resolve, reject) => { finish = { resolve, reject }; });
      // Attach rejection handler before opening the browser.
      callback.catch(() => {});
      server = createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        if (req.method !== 'GET' || url.pathname !== '/oauth/youtube/callback' || url.searchParams.get('state') !== state) {
          res.writeHead(400).end('無效的授權回應。'); return;
        }
        const code = url.searchParams.get('code');
        res.end('授權回應已收到，請返回離線字幕工廠查看結果。');
        if (url.searchParams.has('error') || !code) finish.reject(new Error('YouTube 授權已取消。'));
        else finish.resolve(code);
      });
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      const redirect = `http://127.0.0.1:${server.address().port}/oauth/youtube/callback`;
      const auth = authClient(redirect, false);
      const url = auth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: [SCOPE], state,
        code_challenge_method: 'S256', code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url') });
      timer = setTimeout(() => finish.reject(new Error('YouTube 授權等待逾時，請重新連結。')), oauthTimeoutMs);
      await openExternal(url);
      const code = await callback;
      const { tokens } = await auth.getToken({ code, codeVerifier: verifier, redirect_uri: redirect });
      auth.setCredentials(tokens);
      const selected = await account(auth);
      saveCredentials({ clientId: value.clientId, clientSecret: value.clientSecret, tokens, channel: selected });
      channel = selected;
      return status();
    } finally {
      clearTimeout(timer);
      server?.close();
      server?.closeAllConnections();
      authBusy = false;
    }
  }
  function status() {
    const value = loadCredentials();
    return { configured: Boolean(value), connected: Boolean(value?.tokens?.refresh_token || value?.tokens?.access_token),
      channel: channel || value?.channel || null, busy: Boolean(operation || authBusy) };
  }
  function configure(json) {
    assertIdle();
    let value;
    try { value = JSON.parse(json).installed; } catch { /* validated below */ }
    if (!value || typeof value.client_id !== 'string' || !value.client_id.endsWith('.apps.googleusercontent.com')
      || typeof value.client_secret !== 'string' || value.client_secret.length > 1024) throw new Error('請匯入 Google Desktop 類型的 OAuth client JSON。');
    saveCredentials({ clientId: value.client_id, clientSecret: value.client_secret });
    channel = null;
    return status();
  }
  function disconnect() {
    assertIdle();
    fs.rmSync(secretFile, { force: true });
    credentials = null; channel = null;
    return status();
  }
  function resetUnsent(jobId) {
    assertIdle();
    const root = jobRoot(jobId);
    const previous = readRecord(jobId);
    if (!previous || previous.videoId || previous.videoAttempted !== false) throw new Error('已嘗試傳送影片，不能清除紀錄後重傳。');
    const snapshotDir = path.join(root, '.youtube-upload');
    if (fs.existsSync(snapshotDir)) {
      if (fs.realpathSync(snapshotDir) !== snapshotDir) throw new Error('暫存路徑不允許。');
      for (const file of ['video.mp4', 'captions.srt']) fs.rmSync(path.join(snapshotDir, file), { force: true });
      fs.rmdirSync(snapshotDir);
    }
    fs.unlinkSync(path.join(root, 'youtube-publish.json'));
    fs.rmSync(historyFile(root), { force: true });
    records.delete(root);
    return { ok: true };
  }
  async function run(jobId, input, retry) {
    assertIdle();
    if (!status().connected) throw new Error('請先連結 YouTube。');
    const root = jobRoot(jobId);
    const previous = readRecord(jobId);
    if (!retry && previous) throw new Error('此專案已有發布紀錄，請查看 YouTube Studio，避免重複上傳。');
    if (retry && (!previous?.videoId || previous.state === 'completed')) throw new Error('沒有可重試的字幕工作。');
    const metadata = retry ? null : validateMetadata(input);
    if (retry && input?.consent !== true) throw new Error('請同意重新上傳字幕。');
    const selected = status().channel;
    if (!selected?.id || (previous && previous.channelId !== selected.id)) throw new Error('請連結原發布頻道再重試。');
    let videoPath;
    let srtPath;
    let subtitleBytes;
    let videoStat;
    if (!retry) {
      if (typeof input.video !== 'string' || path.basename(input.video) !== input.video || !/\.mp4$/i.test(input.video)) throw new Error('請選擇已輸出的 MP4。');
      videoPath = localFile(root, path.join('output', input.video));
      videoStat = fs.statSync(videoPath);
      if (!videoStat.size) throw new Error('影片是空檔案。');
      const jobStatus = path.join(root, 'job-status.json');
      if (fs.existsSync(jobStatus) && JSON.parse(fs.readFileSync(jobStatus, 'utf8')).status === 'running') throw new Error('請等待影片輸出完成。');
      srtPath = localFile(root, 'review-output/reviewed.srt');
      if (fs.statSync(srtPath).size > 10 * 1024 * 1024) throw new Error('字幕超過本版本 10 MB 限制。');
      const bytes = subtitleBytes = fs.readFileSync(srtPath);
      if (bytes.length > 10 * 1024 * 1024) throw new Error('字幕超過本版本 10 MB 限制。');
      const srt = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (!parseSrtBilingual(srt).length) throw new Error('已保存的字幕沒有有效 cue。');
    } else {
      srtPath = localFile(root, '.youtube-upload/captions.srt');
      if (fs.statSync(srtPath).size > 10 * 1024 * 1024) throw new Error('字幕 snapshot 超過限制。');
      if (!previous.captionSha256 || crypto.createHash('sha256').update(fs.readFileSync(srtPath)).digest('hex') !== previous.captionSha256) throw new Error('字幕 snapshot 已變動，不能作為原字幕重試。');
    }
    const record = { ...(previous || {}), state: 'preparing', progress: 0, channelId: selected.id,
      videoAttempted: previous?.videoAttempted || false,
      captionSha256: previous?.captionSha256 || crypto.createHash('sha256').update(subtitleBytes).digest('hex'),
      language: previous?.language || metadata.language, message: '準備私人上傳。' };
    const controller = new AbortController();
    const op = { jobId, root, controller, done: null };
    operation = op;
    // The server arbitrates this lease and deletion in the same event loop.
    let lease;
    try {
      lease = await acquireLease(jobId, root, controller.signal);
      // Re-read durable state under the lease, including other app instances.
      records.delete(root);
      const currentRecord = readRecord(jobId);
      if (!retry && currentRecord) throw new Error('此專案已有發布紀錄。');
      if (retry && (!currentRecord || currentRecord.videoId !== previous.videoId || currentRecord.state === 'completed')) throw new Error('字幕發布紀錄已變動。');
      persist(jobId, record, !retry);
    } catch (error) {
      try { await lease?.release(); } finally { operation = null; }
      throw error;
    }
    op.done = (async () => {
      try {
        const auth = authClient();
        const api = makeApi(auth);
        const actual = await account(auth, controller.signal);
        if (actual.id !== record.channelId) throw new Error('頻道與授權不一致。');
        const snapshotDir = path.join(root, '.youtube-upload');
        if (!retry) {
          // An existing snapshot may be retained after an interrupted upload; never overwrite it.
          fs.mkdirSync(snapshotDir, { mode: 0o700 });
          await fsp.writeFile(path.join(snapshotDir, 'captions.srt'), subtitleBytes, { flag: 'wx', mode: 0o600 });
          await fsp.copyFile(videoPath, path.join(snapshotDir, 'video.mp4'), fs.constants.COPYFILE_EXCL);
          const current = fs.statSync(videoPath);
          if (current.size !== videoStat.size || current.mtimeMs !== videoStat.mtimeMs) throw new Error('影片輸出仍在變動。');
        }
        controller.signal.throwIfAborted();
        const options = { signal: controller.signal, timeout: 30 * 60 * 1000, retry: false };
        if (!retry) {
          record.state = 'uploading-video'; record.videoAttempted = true;
          record.message = '正在上傳私人影片。'; persist(jobId, record);
          const size = fs.statSync(path.join(snapshotDir, 'video.mp4')).size;
          const { data } = await requestWithMedia(path.join(snapshotDir, 'video.mp4'), controller, (videoStream) => api.videos.insert({ part: ['snippet', 'status'], notifySubscribers: false,
            requestBody: { snippet: { title: metadata.title, description: metadata.description, categoryId: '27' },
              status: { privacyStatus: 'private', selfDeclaredMadeForKids: metadata.madeForKids } },
            media: { mimeType: 'video/mp4', body: videoStream } }, { ...options, onUploadProgress: (event) => {
              record.progress = Math.min(99, Math.round(Number(event.bytesRead || 0) / size * 100));
            } }), openMediaStream);
          if (!validId(data.id)) throw new Error('YouTube 未回傳有效影片 ID。');
          record.videoId = data.id;
          record.progress = 100;
          persist(jobId, record);
        }
        controller.signal.throwIfAborted();
        record.state = 'uploading-captions'; record.message = '影片已上傳，正在傳送字幕。'; persist(jobId, record);
        const trackName = `Offline Subtitle Factory ${jobId}`.slice(0, 150);
        // Reconcile after unknown caption outcomes to avoid inserting duplicate tracks.
        const existing = await api.captions.list({ part: ['snippet'], videoId: record.videoId }, options);
        const track = existing.data.items?.find((item) => item.snippet?.name === trackName && item.snippet?.language === record.language);
        const response = await requestWithMedia(path.join(snapshotDir, 'captions.srt'), controller, (captionStream) => {
          const params = { part: ['snippet'], requestBody: { snippet: { videoId: record.videoId, language: record.language,
            name: trackName, isDraft: false } }, media: { mimeType: 'application/octet-stream', body: captionStream } };
          return track
            ? api.captions.update({ ...params, requestBody: { id: track.id, snippet: { isDraft: false } } }, options)
            : api.captions.insert(params, options);
        }, openMediaStream);
        if (!validId(response.data.id)) throw new Error('YouTube 未回傳有效字幕 ID。');
        record.captionId = response.data.id;
        record.captionStatus = response.data.snippet?.status || 'syncing';
        record.state = record.captionStatus === 'failed' ? 'partial' : 'completed';
        record.message = record.state === 'partial' ? '私人影片已上傳，但 YouTube 字幕處理失敗。'
          : '私人影片與字幕已上傳；YouTube 仍可能處理影片／字幕，請至 Studio 確認。';
      } catch (error) {
        const cancelled = controller.signal.aborted && controller.signal.reason?.message !== 'YOUTUBE_SOURCE_READ_FAILED';
        record.state = cancelled ? 'cancelled' : record.videoId ? 'partial' : 'failed';
        record.message = cancelled
          ? '已停止傳送；遠端可能已收到資料，請查看 YouTube Studio。' : publicError(error);
      } finally {
        try { persist(jobId, record); }
        finally {
          // Retain only the subtitle snapshot for caption retry. Never delete user's exports.
          const tempVideo = path.join(root, '.youtube-upload', 'video.mp4');
          try { await fsp.unlink(tempVideo); } catch { /* absent / retained on filesystem failure */ }
          try { await lease.release(); } finally { operation = null; }
        }
      }
    })();
    // Prevent background failures from leaking raw SDK errors / tokens into logs.
    op.done.catch(() => {});
    return { ...record };
  }
  return { status, configure, connect, disconnect, files, resetUnsent,
    start: (jobId, input) => run(jobId, input, false),
    retryCaptions: (jobId, input) => run(jobId, input, true),
    record: (jobId) => readRecord(jobId),
    cancel: (jobId) => { if (operation?.jobId === jobId) operation.controller.abort(); return { ok: true }; },
    wait: async () => { await operation?.done; },
  };
}
