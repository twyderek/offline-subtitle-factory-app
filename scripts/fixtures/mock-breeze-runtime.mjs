import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const valueAfter = (flag) => args[args.indexOf(flag) + 1];
const outputDir = valueAfter('--output_dir');
if (!outputDir) process.exit(2);
fs.writeFileSync(path.join(outputDir, 'breeze-child-started'), 'yes', 'utf8');

const delayed = fs.existsSync(path.join(outputDir, 'breeze-mock-delay'));
const stubborn = fs.existsSync(path.join(outputDir, 'breeze-mock-stubborn'));
const writeSrt = () => {
  fs.writeFileSync(path.join(outputDir, 'whisper-input.srt'), '1\n00:00:00,000 --> 00:00:01,000\nBreeze mock 字幕\n', 'utf8');
};

if (!delayed) {
  writeSrt();
  process.exit(0);
}

process.on('SIGTERM', () => {
  fs.writeFileSync(path.join(outputDir, 'breeze-sigterm-received'), 'yes', 'utf8');
  if (stubborn) return;
  setTimeout(() => {
    fs.writeFileSync(path.join(outputDir, 'breeze-child-closed'), 'yes', 'utf8');
    process.exit(0);
  }, 300);
});
setTimeout(() => {
  writeSrt();
  process.exit(0);
}, 10000);
