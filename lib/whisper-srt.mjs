const TIMECODE_PATTERN = /^(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})$/;

function parseWhisperTime(value) {
  const match = String(value || '').trim().match(TIMECODE_PATTERN);
  if (!match) return null;
  const [, hours, minutes, seconds, milliseconds] = match;
  const mm = Number(minutes);
  const ss = Number(seconds);
  if (mm > 59 || ss > 59) return null;
  return Number(hours) * 3600 + mm * 60 + ss + Number(milliseconds.padEnd(3, '0')) / 1000;
}

function formatWhisperTime(seconds) {
  const totalMilliseconds = Math.max(0, Math.round(Number(seconds) * 1000));
  const milliseconds = totalMilliseconds % 1000;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const secondsPart = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutesPart = totalMinutes % 60;
  const hoursPart = Math.floor(totalMinutes / 60);
  return `${String(hoursPart).padStart(2, '0')}:${String(minutesPart).padStart(2, '0')}:${String(secondsPart).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Normalize Whisper SRT output before it is exposed to the strict review parser.
 * Invalid or zero-length cues are dropped; valid cues are renumbered sequentially.
 */
export function sanitizeWhisperSrt(input) {
  const blocks = String(input || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const cues = [];
  let droppedCount = 0;

  for (const [sourceIndex, block] of blocks.entries()) {
    const lines = block.split('\n').map((line) => line.trim());
    const timeIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeIndex < 0) {
      droppedCount += 1;
      continue;
    }
    const [startRaw, endRaw] = lines[timeIndex].split('-->').map((part) => part.trim());
    const start = parseWhisperTime(startRaw);
    const end = parseWhisperTime(endRaw);
    const text = lines.slice(timeIndex + 1).join('\n').trim();
    if (start === null || end === null || end <= start || !text) {
      droppedCount += 1;
      continue;
    }
    cues.push({
      id: cues.length + 1,
      sourceIndex,
      start,
      end,
      text,
    });
  }

  return {
    cues,
    droppedCount,
    totalBlocks: blocks.length,
    subtitle: cues.length
      ? `${cues.map((cue) => [String(cue.id), `${formatWhisperTime(cue.start)} --> ${formatWhisperTime(cue.end)}`, cue.text].join('\n')).join('\n\n')}\n\n`
      : '',
  };
}
