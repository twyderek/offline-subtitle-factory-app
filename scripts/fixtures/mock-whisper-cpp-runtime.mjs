import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const valueAfter = (flag) => args[args.indexOf(flag) + 1];
const audioFile = valueAfter('-f');
const outputBase = valueAfter('-of');
if (!audioFile || !outputBase) process.exit(2);

const outputDir = path.dirname(outputBase);
fs.writeFileSync(path.join(outputDir, 'whisper-cpp-child-started'), 'yes', 'utf8');
if (!fs.existsSync(audioFile)) {
  fs.writeFileSync(path.join(outputDir, 'whisper-cpp-audio-missing'), 'yes', 'utf8');
  process.exit(3);
}

const delayed = fs.existsSync(path.join(outputDir, 'whisper-cpp-mock-delay'));
const stubborn = fs.existsSync(path.join(outputDir, 'whisper-cpp-mock-stubborn'));
const metalCrash = fs.existsSync(path.join(outputDir, 'whisper-cpp-mock-metal-139'));
const metalSignalCrash = fs.existsSync(path.join(outputDir, 'whisper-cpp-mock-metal-sigsegv'));
const cpuRetryFailure = fs.existsSync(path.join(outputDir, 'whisper-cpp-mock-cpu-retry-failure'));
const forceCpu = args.includes('--no-gpu');
if (cpuRetryFailure || (delayed && metalCrash)) {
  fs.appendFileSync(path.join(outputDir, 'whisper-cpp-invocations.log'), `${forceCpu ? 'cpu' : 'metal'}\n`, 'utf8');
}
if (metalSignalCrash && !forceCpu) {
  fs.writeFileSync(`${outputBase}.srt`, 'partial output\n', 'utf8');
  fs.writeFileSync(`${outputBase}.json`, '{"partial":true}', 'utf8');
  fs.writeFileSync(path.join(outputDir, 'whisper-cpp-metal-sigsegv'), 'yes', 'utf8');
  process.stderr.write('ggml_metal_buffer_init: deterministic mock SIGSEGV\n');
  try {
    process.kill(process.pid, 'SIGSEGV');
  } catch {
    process.exit(139);
  }
  setTimeout(() => process.exit(139), 1000);
}
if ((metalCrash || cpuRetryFailure) && !forceCpu) {
  fs.writeFileSync(`${outputBase}.srt`, 'partial output\n', 'utf8');
  fs.writeFileSync(`${outputBase}.json`, '{"partial":true}', 'utf8');
  fs.writeFileSync(path.join(outputDir, 'whisper-cpp-metal-139'), 'yes', 'utf8');
  process.stderr.write('ggml_metal_buffer_init: deterministic mock allocation failure\n');
  process.exit(139);
}
if ((metalCrash || metalSignalCrash || cpuRetryFailure) && forceCpu && (fs.existsSync(`${outputBase}.srt`) || fs.existsSync(`${outputBase}.json`))) {
  fs.writeFileSync(path.join(outputDir, 'whisper-cpp-stale-partial-output'), 'yes', 'utf8');
}
if (cpuRetryFailure && forceCpu) {
  fs.writeFileSync(`${outputBase}.srt`, 'partial CPU output\n', 'utf8');
  fs.writeFileSync(`${outputBase}.json`, '{"partialCpu":true}', 'utf8');
  fs.writeFileSync(path.join(outputDir, 'whisper-cpp-cpu-retry-failed'), 'yes', 'utf8');
  process.stderr.write('whisper.cpp deterministic CPU retry failure\n');
  process.exit(7);
}
const writeOutput = () => {
  fs.writeFileSync(`${outputBase}.srt`, '1\n00:00:00,000 --> 00:00:01,000\nWhisper.cpp mock 字幕\n', 'utf8');
  fs.writeFileSync(`${outputBase}.json`, JSON.stringify({ transcription: [
    { offsets: { from: 0, to: 1000 }, text: 'Whisper.cpp mock 字幕', tokens: [{ p: 0.98, t0: 0, t1: 1000 }] },
  ] }), 'utf8');
};

if (delayed) {
  fs.writeFileSync(`${outputBase}.srt`, 'partial output\n', 'utf8');
  fs.writeFileSync(`${outputBase}.json`, '{"partial":true}', 'utf8');
}

if (!delayed) {
  writeOutput();
  process.exit(0);
}

process.on('SIGTERM', () => {
  fs.writeFileSync(path.join(outputDir, 'whisper-cpp-sigterm-received'), 'yes', 'utf8');
  if (stubborn) return;
  setTimeout(() => {
    fs.writeFileSync(path.join(outputDir, 'whisper-cpp-child-closed'), 'yes', 'utf8');
    process.exit(0);
  }, 300);
});
if (delayed && metalCrash && forceCpu) {
  fs.writeFileSync(path.join(outputDir, 'whisper-cpp-cpu-retry-ready'), 'yes', 'utf8');
}
setTimeout(() => {
  writeOutput();
  process.exit(0);
}, 10000);
