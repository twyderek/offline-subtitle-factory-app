import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appSource = fs.readFileSync(path.join(appDir, 'public', 'app.js'), 'utf8');
const reviewSource = fs.readFileSync(path.join(appDir, 'public', 'review.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(appDir, 'server.mjs'), 'utf8');

assert.match(appSource, /function formatModelDownloadSize\(bytes\)\s*\{\s*return formatFileSize\(bytes\);\s*\}/, '模型下載大小應共用檔案大小格式化函數');
const pollingSource = appSource.slice(appSource.indexOf('function stopPolling()'), appSource.indexOf('function openReviewStage('));
assert.doesNotMatch(pollingSource, /setInterval\(/, '自適應輪詢不可使用不會更新間隔的 setInterval');
assert.match(pollingSource, /window\.setTimeout\(poll, (?:visibilityDelay|intervalMs)\)/, '輪詢應在請求完成後以目前間隔排程下一次請求');
assert.match(pollingSource, /await fetch\([^\n]+encodeURIComponent\(pollingJobId\)/, '輪詢 URL 應編碼任務 ID');
assert.match(pollingSource, /pollingGeneration/, '輪詢應忽略舊任務的晚到回應');
assert.match(pollingSource, /await fetch[\s\S]+generation !== pollingGeneration[\s\S]+await response\.json/, '輪詢應在 response 與 JSON 完成後都檢查 generation');
assert.match(pollingSource, /document\.hidden/, '頁面隱藏時輪詢應退避');
assert.match(pollingSource, /if \(document\.hidden\) stopPolling\(\)/, '頁面轉為隱藏時應立即停止既有 timer');
assert.match(appSource, /visibilitychange/, '頁面恢復可見時應重新啟動輪詢');
assert.doesNotMatch(appSource, /clearInterval\(pollTimer\)/, '輪詢生命週期應統一由 stopPolling 管理');

const saveStatusBlock = serverSource.slice(serverSource.indexOf('function saveStatus('), serverSource.indexOf('function sanitizeLog('));
assert.match(saveStatusBlock, /jobsListCache\s*=\s*null/, '保存任務狀態時應立即使任務列表快取失效');
assert.match(serverSource, /function getSafeApiErrorMessage\(error, fallback\)/, 'server 應提供對外錯誤訊息邊界');
assert.match(serverSource, /function sanitizeApiErrorPayload\(value\)/, '巢狀 JSON error 欄位也應經過安全邊界');
assert.match(serverSource, /const safeValue = sanitizeApiErrorPayload\(value\)/, '所有 JSON API 錯誤回應應經過集中安全邊界');
assert.match(serverSource, /\['error', 'message', 'detail', 'reason', 'stderr', 'stdout'\]\.includes\(key\)/, '任務狀態與診斷文字欄位也應經過安全邊界');
assert.match(serverSource, /key === 'logs' && Array\.isArray\(item\)/, '任務 logs 也應遮罩內部診斷細節');
assert.match(serverSource, /internalErrorDetailsPattern/, 'production 錯誤邊界應遮罩內部路徑與工具細節');
assert.match(serverSource, /file:\\\/\\\//, 'production 錯誤邊界應遮罩 file URL 形式的內部路徑');
assert.match(serverSource, /無法分析影片，請確認檔案格式後重試。/, '影片 probe 應使用固定的安全錯誤訊息');
assert.match(serverSource, /無法建立字幕任務，請確認檔案與設定後重試。/, '建立任務應使用固定的安全錯誤訊息');
const apiHandlerSource = serverSource.slice(serverSource.indexOf('async function handleApi('), serverSource.indexOf('const server = createServer('));
assert.doesNotMatch(apiHandlerSource, /error:\s*error\.message/, 'API handler 不應直接回傳原始錯誤訊息');
assert.match(appSource, /async function loadJobStatus\(jobId[\s\S]+currentJobId !== jobId/, '載入任務狀態應忽略切換任務後的晚到回應');

assert.match(reviewSource, /review-time">\$\{escapeHtml\(cue\.startRaw\)\}/, '校閱時間碼起點應轉義');
assert.match(reviewSource, /\$\{escapeHtml\(cue\.endRaw\)\}/, '校閱時間碼終點應轉義');
assert.match(reviewSource, /value="\$\{escapeHtml\(formatDuration\(cue\.end - cue\.start\)\)\}"/, '校閱數值 attribute 應轉義');

async function getFreePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function waitForServer(baseUrl) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/jobs`);
      if (response.ok) return;
    } catch {
      // server 尚未 ready，繼續等待。
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('優化測試 server 未在期限內啟動');
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-subtitle-optimization-test-'));
const leakTestJobRoot = path.join(dataDir, 'status-leak-test');
fs.mkdirSync(leakTestJobRoot, { recursive: true });
fs.writeFileSync(path.join(leakTestJobRoot, 'job-config.json'), JSON.stringify({
  jobId: 'status-leak-test',
  createdAt: new Date().toISOString(),
  files: { video: 'input.mp4' },
}));
fs.writeFileSync(path.join(leakTestJobRoot, 'job-status.json'), JSON.stringify({
  jobId: 'status-leak-test',
  status: 'failed',
  stage: 'failed',
  progress: 100,
  message: 'ffprobe failed at /home/private/input.mp4',
  logs: ['command stderr: /home/private/input.mp4', 'normal progress update'],
  files: {},
}));
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [path.join(appDir, 'server.mjs')], {
  cwd: appDir,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    OFFLINE_SUBTITLE_DATA_DIR: dataDir,
    OFFLINE_SUBTITLE_SETTINGS_DIR: path.join(dataDir, 'config'),
    OFFLINE_SUBTITLE_TOOLS_DIR: path.join(appDir, 'tools'),
    OFFLINE_SUBTITLE_API_TOKEN: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const childExit = new Promise((resolve) => child.once('exit', resolve));

try {
  await waitForServer(baseUrl);
  const statusLeakResponse = await fetch(`${baseUrl}/api/jobs/status-leak-test/status`);
  const statusLeakBody = await statusLeakResponse.json();
  assert.equal(statusLeakResponse.status, 200, '狀態 API 應可讀取最小失敗任務');
  assert.equal(statusLeakBody.message, '操作失敗，請稍後再試。', 'production 狀態 message 不得回傳內部路徑');
  assert.equal(statusLeakBody.logs[0], '操作失敗，請稍後再試。', 'production 狀態 logs 不得回傳內部路徑');
  assert.equal(statusLeakBody.logs[1], 'normal progress update', '正常狀態 logs 應保留');
  const form = new FormData();
  form.set('video', new Blob(['not a valid video']), 'invalid.mp4');
  const response = await fetch(`${baseUrl}/api/video/probe`, { method: 'POST', body: form });
  const body = await response.json();
  assert.equal(response.status, 500, '無效影片 probe 應回傳 500');
  assert.equal(body.error, '無法分析影片，請確認檔案格式後重試。', 'production API 不應回傳內部 ffprobe 錯誤');
  assert.doesNotMatch(body.error, /(?:\/Users\/|\/private\/|ENOENT|ffprobe)/, 'production 錯誤不得含內部路徑或工具細節');
} finally {
  if (child.exitCode === null) child.kill('SIGTERM');
  await childExit;
  fs.rmSync(dataDir, { recursive: true, force: true });
}

console.log('報告參考優化測試通過：輪詢、快取失效、production 錯誤邊界與校閱 DOM 轉義');
