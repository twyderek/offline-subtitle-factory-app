import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export function probeCommand(command, args = ['--version'], timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (!command) return resolve(false);
    const needsFileCheck = path.isAbsolute(command) || command.includes('\\') || command.includes('/');
    if (needsFileCheck && !fs.existsSync(command)) return resolve(false);
    const child = spawn(command, args, { shell: false, detached: process.platform !== 'win32', stdio: 'ignore', windowsHide: true });
    let settled = false;
    let timeoutRequested = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    const timeout = setTimeout(() => {
      timeoutRequested = true;
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: false, stdio: 'ignore', windowsHide: true });
        killer.once('error', () => child.kill('SIGKILL'));
        killer.once('close', () => { if (!settled) child.kill('SIGKILL'); });
      } else {
        try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); }
        catch { child.kill('SIGKILL'); }
      }
    }, Math.max(250, Number(timeoutMs) || 10000));
    child.on('close', (code) => finish(timeoutRequested ? false : code === 0));
    child.on('error', () => finish(false));
  });
}
