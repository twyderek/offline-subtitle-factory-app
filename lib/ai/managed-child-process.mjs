import { spawn } from 'node:child_process';

export function spawnManagedChild(command, args, options = {}) {
  const child = spawn(command, args, options);
  let resolveClosed;
  const handle = {
    child,
    started: false,
    spawnError: null,
    closeInfo: null,
    closed: new Promise((resolve) => { resolveClosed = resolve; }),
  };
  child.once('spawn', () => { handle.started = true; });
  child.once('error', (error) => {
    handle.spawnError = { code: String(error?.code || '') };
  });
  child.once('close', (code, signal) => {
    handle.closeInfo = { code, signal };
    resolveClosed(handle.closeInfo);
  });
  return handle;
}

function waitForClose(handle, timeoutMs) {
  if (handle.closeInfo) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    handle.closed.then(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

export async function stopManagedChild(handle, { gracefulTimeoutMs = 8000, forceTimeoutMs = 5000 } = {}) {
  if (!handle) return true;
  if (handle.closeInfo) return true;

  if (handle.spawnError) {
    return waitForClose(handle, gracefulTimeoutMs);
  }

  try { handle.child.kill('SIGTERM'); } catch {}
  const graceful = await waitForClose(handle, gracefulTimeoutMs);
  if (graceful) return true;

  try { handle.child.kill('SIGKILL'); } catch {}
  return waitForClose(handle, forceTimeoutMs);
}
