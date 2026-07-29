import { filterQualityCues } from './subtitle-quality.mjs';

export function selectAiCues({ cues, scope, selectedCueIds = new Set(), search = '', qualityFilter = 'all', activeIndex = -1, mode = 'proofread' }) {
  const allCues = Array.isArray(cues) ? cues : [];
  const source = scope === 'selected'
    ? allCues.filter((cue) => selectedCueIds.has(String(cue.id)))
    : scope === 'search'
      ? allCues.filter((cue) => `${cue.text || ''}`.toLowerCase().includes(search.toLowerCase()))
      : scope === 'quality'
        ? filterQualityCues(allCues, qualityFilter)
        : scope === 'current'
          ? [allCues[activeIndex]].filter(Boolean)
          : allCues;
  return source.map((cue) => ({
    id: cue.id,
    start: cue.startRaw,
    end: cue.endRaw,
    text: mode === 'translate' ? (cue.sourceText || cue.text) : (cue.translatedText || cue.text),
    sourceText: cue.sourceText,
    translatedText: cue.translatedText || cue.text,
  }));
}
