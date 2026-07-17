function parseTime(value) {
  const match = String(value || '').match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!match) return NaN;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4].padEnd(3, '0')) / 1000;
}

function formatTime(seconds) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const ms = milliseconds % 1000;
  const totalSeconds = Math.floor(milliseconds / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function parseSrtForTrim(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n').filter(Boolean);
      const timeIndex = lines.findIndex((line) => line.includes('-->'));
      if (timeIndex < 0) return null;
      const [startRaw, endRaw] = lines[timeIndex].split('-->').map((part) => part.trim());
      const start = parseTime(startRaw);
      const end = parseTime(endRaw);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
      return { start, end, text: lines.slice(timeIndex + 1).join('\n').trim() };
    })
    .filter(Boolean);
}

export function trimSrtToRange(text, rangeStart, rangeEnd) {
  const start = Number(rangeStart);
  const end = Number(rangeEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('字幕修剪區間無效');
  const source = parseSrtForTrim(text);
  const cues = [];
  let removedCount = 0;
  let boundaryCount = 0;
  for (const cue of source) {
    if (cue.end <= start || cue.start >= end) {
      removedCount += 1;
      continue;
    }
    const clippedStart = Math.max(cue.start, start);
    const clippedEnd = Math.min(cue.end, end);
    if (clippedEnd - clippedStart < 0.1) {
      removedCount += 1;
      continue;
    }
    const needsReview = clippedStart !== cue.start || clippedEnd !== cue.end;
    if (needsReview) boundaryCount += 1;
    cues.push({
      start: clippedStart - start,
      end: clippedEnd - start,
      text: cue.text,
      needsReview,
    });
  }
  const subtitle = cues.map((cue, index) => `${index + 1}\r\n${formatTime(cue.start)} --> ${formatTime(cue.end)}\r\n${cue.text}`).join('\r\n\r\n') + (cues.length ? '\r\n' : '');
  return { subtitle, cues, sourceCount: source.length, removedCount, boundaryCount };
}
