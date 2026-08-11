import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export function probeCommand(command, args = ['--version'], timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (!command) return resolve(false);
    const needsFileCheck = path.isAbsolute(command) || command.includes('\\') || command.includes('/');
    if (needsFileCheck && !fs.existsSync(command)) return resolve(false);
    const child = spawn(command, args, { shell: false, stdio: 'ignore', windowsHide: true });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      finish(false);
    }, Math.max(250, Number(timeoutMs) || 10000));
    child.on('exit', (code) => finish(code === 0));
    child.on('error', () => finish(false));
  });
}
