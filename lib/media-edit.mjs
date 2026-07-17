import fs from 'node:fs';
import path from 'node:path';

export const EDIT_PLAN_VERSION = 1;
export const MIN_TRIM_DURATION_SECONDS = 0.5;

function roundMillis(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

export function normalizeEditPlan(value = {}, sourceDuration) {
  const duration = Number(sourceDuration ?? value.sourceDuration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('無法取得有效的原始影片長度');
  const start = roundMillis(value.in ?? 0);
  const end = roundMillis(value.out ?? duration);
  if (!Number.isFinite(start) || start < 0) throw new Error('修剪起點不可小於 0');
  if (!Number.isFinite(end) || end > duration + 0.05) throw new Error('修剪終點不可超過影片長度');
  if (end <= start) throw new Error('修剪終點必須晚於起點');
  if (end - start < MIN_TRIM_DURATION_SECONDS) throw new Error(`保留區間不可短於 ${MIN_TRIM_DURATION_SECONDS} 秒`);
  const strategy = ['precise', 'fast'].includes(value.strategy) ? value.strategy : 'precise';
  return {
    version: EDIT_PLAN_VERSION,
    mode: 'single-range',
    sourceDuration: roundMillis(duration),
    in: start,
    out: Math.min(end, roundMillis(duration)),
    outputDuration: roundMillis(Math.min(end, duration) - start),
    strategy,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
  };
}

export function getEditPaths(jobRoot) {
  return {
    plan: path.join(jobRoot, 'working', 'edit-plan.json'),
    trimmed: path.join(jobRoot, 'working', 'media-trimmed.mp4'),
    partial: path.join(jobRoot, 'working', 'media-trimmed.partial.mp4'),
    trimStatus: path.join(jobRoot, 'working', 'trim-status.json'),
  };
}

export function readEditPlan(jobRoot) {
  const { plan } = getEditPaths(jobRoot);
  if (!fs.existsSync(plan)) return null;
  try {
    return JSON.parse(fs.readFileSync(plan, 'utf8'));
  } catch {
    return null;
  }
}

export function resolveEffectiveMediaPath(jobRoot, originalPath) {
  const paths = getEditPaths(jobRoot);
  const plan = readEditPlan(jobRoot);
  if (plan?.appliedAt && fs.existsSync(paths.trimmed) && fs.statSync(paths.trimmed).size > 0) return paths.trimmed;
  return originalPath;
}
