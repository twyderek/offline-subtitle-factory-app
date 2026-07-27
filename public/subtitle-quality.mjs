const PROPER_NOUN_PATTERN = /(?:[A-Z][a-z]{2,}|[A-Z]{2,}|[\u4e00-\u9fff]{2,}(?:大學|學院|公司|醫院|計畫|系統))/;
function finite(value) { if (value === null || value === undefined || typeof value === 'string' && value.trim() === '' || value === false) return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
export function assessSubtitleCue(cue, options = {}) {
  const text = String(cue?.translatedText ?? cue?.text ?? cue?.sourceText ?? '').trim();
  const start = finite(cue?.start); const end = finite(cue?.end);
  const duration = start !== null && end !== null ? Math.max(0, end - start) : null;
  const confidence = finite(cue?.confidence); const noSpeechProbability = finite(cue?.noSpeechProbability ?? cue?.no_speech_prob);
  const threshold = finite(options.confidenceThreshold) ?? 0.6; const noSpeechThreshold = finite(options.noSpeechThreshold) ?? 0.5;
  const reasons = [];
  if (confidence !== null && confidence < threshold) reasons.push('低 confidence');
  if (noSpeechProbability !== null && noSpeechProbability >= noSpeechThreshold) reasons.push('高 no-speech');
  if (duration !== null && duration > (finite(options.longCueSeconds) ?? 10)) reasons.push('字幕過長');
  const charsPerSecond = duration && duration > 0 ? [...text].length / duration : null;
  if (charsPerSecond !== null && charsPerSecond > (finite(options.fastRate) ?? 18)) reasons.push('閱讀速度過快');
  if (text && /(.{2,})\1/.test(text.replace(/\s+/g, ''))) reasons.push('疑似重複文字');
  if (PROPER_NOUN_PATTERN.test(text)) reasons.push('疑似專有名詞');
  const score = Math.min(100, (confidence !== null && confidence < threshold ? 45 : 0) + (noSpeechProbability !== null && noSpeechProbability >= noSpeechThreshold ? 35 : 0) + (duration !== null && duration > (finite(options.longCueSeconds) ?? 10) ? 10 : 0) + (charsPerSecond !== null && charsPerSecond > (finite(options.fastRate) ?? 18) ? 10 : 0) + (reasons.includes('疑似重複文字') ? 5 : 0) + (reasons.includes('疑似專有名詞') ? 5 : 0));
  return { score, reasons, source: confidence !== null || noSpeechProbability !== null ? 'engine-metrics' : 'rule-score', confidence, noSpeechProbability, duration, charsPerSecond };
}
export function filterQualityCues(cues, filter = 'all', options = {}) {
  return (Array.isArray(cues) ? cues : []).filter((cue) => { const reasons = assessSubtitleCue(cue, options).reasons;
    if (filter === 'issues') return reasons.length > 0; if (filter === 'low-confidence') return reasons.includes('低 confidence') || reasons.includes('高 no-speech'); if (filter === 'long') return reasons.includes('字幕過長'); if (filter === 'fast') return reasons.includes('閱讀速度過快'); if (filter === 'repeat') return reasons.includes('疑似重複文字'); if (filter === 'proper-noun') return reasons.includes('疑似專有名詞'); return true; });
}
