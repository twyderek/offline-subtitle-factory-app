import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const outputFile = args.at(-1);
if (!outputFile) process.exit(2);

const outputDir = path.dirname(outputFile);
fs.writeFileSync(path.join(outputDir, 'ffmpeg-child-started'), 'yes', 'utf8');

const delayed = fs.existsSync(path.join(outputDir, 'ffmpeg-mock-delay'));
const stubborn = fs.existsSync(path.join(outputDir, 'ffmpeg-mock-stubborn'));
const writeOutput = () => {
  fs.writeFileSync(outputFile, Buffer.from('mock ffmpeg audio'), 'utf8');
};

if (!delayed) {
  writeOutput();
  process.exit(0);
}

writeOutput();
process.on('SIGTERM', () => {
  fs.writeFileSync(path.join(outputDir, 'ffmpeg-sigterm-received'), 'yes', 'utf8');
  if (stubborn) return;
  setTimeout(() => {
    fs.writeFileSync(path.join(outputDir, 'ffmpeg-child-closed'), 'yes', 'utf8');
    process.exit(0);
  }, 300);
});
setTimeout(() => process.exit(0), 10000);
