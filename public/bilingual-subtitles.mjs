const TIMECODE = /^(\d{2}:\d{2}:\d{2})[,.](\d{1,3})$/;

export function parseSubtitleTime(value) {
  const match = String(value || '').trim().match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!match) return NaN;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4].padEnd(3, '0')) / 1000;
}

export function normalizeBilingualCue(cue, index = 0) {
  const sourceText = String(cue?.sourceText ?? cue?.text ?? '').trim();
  const translatedText = String(cue?.translatedText ?? cue?.text ?? sourceText).trim();
  const start = Number(cue?.start);
  const end = Number(cue?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error(`字幕第 ${index + 1} 段時間碼無效`);
  if (!sourceText && !translatedText) throw new Error(`字幕第 ${index + 1} 段沒有文字`);
  return {
    id: cue?.id ?? index + 1,
    start,
    end,
    startRaw: cue?.startRaw || formatSrtTime(start),
    endRaw: cue?.endRaw || formatSrtTime(end),
    sourceText,
    translatedText,
    text: translatedText || sourceText,
  };
}

export function normalizeBilingualCues(cues) {
  if (!Array.isArray(cues)) throw new Error('字幕 cue 必須是陣列');
  const normalized = cues.map((cue, index) => normalizeBilingualCue(cue, index));
  normalized.forEach((cue, index) => {
    cue.id = index + 1;
    cue.originalSourceText = cue.originalSourceText ?? cue.sourceText;
    cue.originalTranslatedText = cue.originalTranslatedText ?? cue.translatedText;
    cue.originalStartRaw = cue.originalStartRaw ?? cue.startRaw;
    cue.originalEndRaw = cue.originalEndRaw ?? cue.endRaw;
  });
  return normalized;
}

export function parseSrtBilingual(text) {
  const blocks = String(text || '').replace(/^\uFEFF/, '').replace(/\r/g, '').split(/\n{2,}/);
  return normalizeBilingualCues(blocks.map((block, index) => {
    const lines = block.split('\n');
    const timeIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeIndex < 0) return null;
    const [startRaw, endRaw] = lines[timeIndex].split('-->').map((part) => part.trim());
    const body = lines.slice(timeIndex + 1).join('\n').trim();
    return { id: index + 1, start: parseSubtitleTime(startRaw), end: parseSubtitleTime(endRaw), startRaw, endRaw, sourceText: body, translatedText: body };
  }).filter(Boolean));
}

export function renderCueText(cue, layout = 'source-top') {
  const source = String(cue.sourceText ?? cue.text ?? '').trim();
  const translated = String(cue.translatedText ?? cue.text ?? source).trim();
  if (!translated || translated === source) return source || translated;
  return layout === 'translated-top' ? `${translated}\n${source}` : `${source}\n${translated}`;
}

export function serializeSrt(cues, layout = 'source-top') {
  return normalizeBilingualCues(cues).map((cue, index) => `${index + 1}\n${cue.startRaw} --> ${cue.endRaw}\n${renderCueText(cue, layout)}`).join('\n\n') + (cues.length ? '\n' : '');
}

export function serializeVtt(cues, layout = 'source-top') {
  const body = normalizeBilingualCues(cues).map((cue) => `${cue.startRaw.replace(',', '.')} --> ${cue.endRaw.replace(',', '.')}\n${renderCueText(cue, layout)}`).join('\n\n');
  return `WEBVTT\n\n${body}${body ? '\n' : ''}`;
}

export function formatSrtTime(seconds) {
  const totalMs = Math.max(0, Math.round(Number(seconds) * 1000));
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  return `${String(Math.floor(totalSeconds / 3600)).padStart(2, '0')}:${String(Math.floor(totalSeconds / 60) % 60).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}
