const QUALITY_KEYS = ['confidence', 'noSpeechProbability', 'no_speech_prob'];

function finite(value) {
  if (value === null || value === undefined || value === '' || value === false) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function probability(value) {
  const number = finite(value);
  return number !== null && number >= 0 && number <= 1 ? number : null;
}

function readQuality(segment) {
  const result = {};
  for (const key of QUALITY_KEYS) {
    const value = probability(segment?.[key]);
    if (value !== null) {
      if (key === 'no_speech_prob') result.noSpeechProbability = value;
      else result[key] = value;
    }
  }
  return result;
}

function readTime(segment, side) {
  const seconds = finite(segment?.[side] ?? segment?.[{ from: 'start', to: 'end' }[side]]);
  if (seconds !== null) return seconds;
  const timestamp = segment?.timestamps?.[side];
  const timestampMatch = typeof timestamp === 'string' ? timestamp.match(/^(\d+):(\d{2}):(\d{2})[,.](\d{1,3})$/) : null;
  if (timestampMatch) return Number(timestampMatch[1]) * 3600 + Number(timestampMatch[2]) * 60 + Number(timestampMatch[3]) + Number(timestampMatch[4].padEnd(3, '0')) / 1000;
  const milliseconds = finite(segment?.offsets?.[side]);
  return milliseconds === null ? null : milliseconds / 1000;
}

export function parseWhisperQualityJson(payload) {
  const segments = Array.isArray(payload?.transcription) && payload.transcription.length ? payload.transcription : Array.isArray(payload?.segments) ? payload.segments : [];
  return segments.map((segment, index) => ({
    index,
    ...(segment?.id === undefined ? {} : { id: segment.id }),
    start: readTime(segment, 'from'),
    end: readTime(segment, 'to'),
    ...readQuality(segment),
  }));
}

export function attachWhisperQuality(cues, qualitySegments, tolerance = 0.05) {
  if (!Array.isArray(cues) || !Array.isArray(qualitySegments) || cues.length !== qualitySegments.length) return { cues, matched: false, reason: 'count-mismatch' };
  const enriched = cues.map((cue, index) => {
    const segment = qualitySegments[index];
    if (segment.start === null || segment.end === null || segment.end <= segment.start) return null;
    if (segment.id === undefined || String(segment.id) !== String(cue.id)) return null;
    if (Math.abs(Number(cue.start) - segment.start) > tolerance || Math.abs(Number(cue.end) - segment.end) > tolerance) return null;
    return { ...cue, ...(segment.confidence === undefined ? {} : { confidence: segment.confidence }), ...(segment.noSpeechProbability === undefined ? {} : { noSpeechProbability: segment.noSpeechProbability }) };
  });
  return enriched.some((cue) => cue === null) ? { cues, matched: false, reason: 'timing-mismatch' } : { cues: enriched, matched: true, reason: qualitySegments.some((segment) => segment.confidence !== undefined || segment.noSpeechProbability !== undefined) ? 'engine-metrics' : 'no-quality-fields' };
}
