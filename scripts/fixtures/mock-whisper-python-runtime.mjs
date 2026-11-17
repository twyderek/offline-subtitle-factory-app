import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const valueAfter = (flag) => args[args.indexOf(flag) + 1];
const audioFile = args.find((value) => value.toLowerCase().endsWith('.wav'));
const outputDir = valueAfter('--output_dir');
if (!audioFile || !outputDir) process.exit(2);

const outputBase = path.join(outputDir, path.parse(audioFile).name);
fs.writeFileSync(path.join(outputDir, 'whisper-python-child-started'), 'yes', 'utf8');
if (!fs.existsSync(audioFile)) {
  fs.writeFileSync(path.join(outputDir, 'whisper-python-audio-missing'), 'yes', 'utf8');
  process.exit(3);
}

const delayed = fs.existsSync(path.join(outputDir, 'whisper-python-mock-delay'));
const stubborn = fs.existsSync(path.join(outputDir, 'whisper-python-mock-stubborn'));
const writeOutput = () => {
  fs.writeFileSync(`${outputBase}.srt`, '1\n00:00:00,000 --> 00:00:01,000\nWhisper Python mock 字幕\n', 'utf8');
};

if (delayed) fs.writeFileSync(`${outputBase}.srt`, 'partial output\n', 'utf8');
if (!delayed) {
  writeOutput();
  process.exit(0);
}

process.on('SIGTERM', () => {
  fs.writeFileSync(path.join(outputDir, 'whisper-python-sigterm-received'), 'yes', 'utf8');
  if (stubborn) return;
  setTimeout(() => {
    fs.writeFileSync(path.join(outputDir, 'whisper-python-child-closed'), 'yes', 'utf8');
    process.exit(0);
  }, 300);
});
setTimeout(() => {
  writeOutput();
  process.exit(0);
}, 10000);
