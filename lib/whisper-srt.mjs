const TIMECODE_PATTERN = /^(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})$/;

// Whisper Small occasionally emits a complete sentence as one SRT cue. Keep
// the readability policy local to this sanitizer so every output path shares
// the same deterministic behaviour. These limits are display limits, not a
// model prompt or a truncation policy: text is wrapped or split, never cut.
export const WHISPER_SMALL_MAX_LINE_CHARACTERS = 20;
export const WHISPER_SMALL_MAX_CUE_CHARACTERS = WHISPER_SMALL_MAX_LINE_CHARACTERS * 2;
const CUE_BREAK_PATTERN = /[。！？!?；;：:，,、]/u;

function characterCount(value) {
  return [...String(value || '')].length;
}

function collapseWhisperText(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}

function findBreakPosition(value, limit) {
  const characters = [...String(value || '')];
  if (characters.length <= limit) return characters.length;
  // Prefer a sentence boundary whenever it does not make the preceding
  // chunk unreasonably short; for a 40-character cue this still accepts a
  // punctuation mark around the halfway point.
  const minimumPreferred = Math.max(1, Math.ceil(limit / 2));
  let preferred = 0;
  for (let index = 1; index <= limit; index += 1) {
    const character = characters[index - 1];
    if (CUE_BREAK_PATTERN.test(character)) preferred = index;
    else if (/\s/u.test(character)) preferred = index - 1;
  }
  return preferred >= minimumPreferred ? preferred : limit;
}

function splitWhisperText(value, limit) {
  const chunks = [];
  let remaining = collapseWhisperText(value);
  while (remaining) {
    const characters = [...remaining];
    if (characters.length <= limit) {
      chunks.push(remaining);
      break;
    }
    let cut = findBreakPosition(remaining, limit);
    if (cut <= 0) cut = limit;
    const boundaryIsWhitespace = /\s/u.test(characters[cut] || '');
    const chunk = characters.slice(0, cut).join('').trim();
    if (!chunk) {
      cut = Math.min(limit, characters.length);
      chunks.push(characters.slice(0, cut).join('').trim());
    } else {
      // Keep a separator at a word boundary. It is invisible at the end of
      // an SRT cue, but preserves the exact text when sanitizer cues are
      // reconstructed before the file is parsed by a renderer.
      chunks.push(boundaryIsWhitespace ? `${chunk} ` : chunk);
    }
    remaining = characters.slice(boundaryIsWhitespace ? cut + 1 : cut).join('').trim();
  }
  return chunks.filter(Boolean);
}

function wrapWhisperText(value, limit) {
  const preserveTrailingSpace = /\s/u.test(String(value || '').slice(-1));
  const normalized = collapseWhisperText(value);
  const characters = [...normalized];
  if (characters.length <= limit) return `${normalized}${preserveTrailingSpace ? ' ' : ''}`;
  // A cue chunk is bounded to two lines. Choose a punctuation/whitespace
  // boundary inside the range where both resulting lines fit, then fall back
  // to the nearest character boundary. This avoids a third one-character
  // line when a punctuation boundary occurs just before the hard limit.
  const minimumCut = Math.max(1, characters.length - limit);
  const maximumCut = Math.min(limit, characters.length - 1);
  let cut = maximumCut;
  let lineBoundaryIsWhitespace = false;
  for (let index = Math.min(characters.length - 1, maximumCut + 1); index >= minimumCut; index -= 1) {
    const character = characters[index - 1];
    if (CUE_BREAK_PATTERN.test(character) || /\s/u.test(character)) {
      lineBoundaryIsWhitespace = /\s/u.test(character);
      cut = index;
      break;
    }
  }
  // If keeping both lines within the hard width would split an ASCII word,
  // prefer an earlier whitespace boundary and allow the second line to be a
  // little longer. Word integrity is more important than a one-character
  // display-width deviation.
  if (!lineBoundaryIsWhitespace && cut === maximumCut) {
    for (let index = minimumCut - 1; index >= 1; index -= 1) {
      if (/\s/u.test(characters[index - 1])) {
        cut = index;
        lineBoundaryIsWhitespace = true;
        break;
      }
    }
  }
  const lowerBound = lineBoundaryIsWhitespace ? 1 : minimumCut;
  const upperBound = lineBoundaryIsWhitespace ? Math.min(characters.length - 1, maximumCut + 1) : maximumCut;
  cut = Math.min(upperBound, Math.max(lowerBound, cut));
  return `${characters.slice(0, cut).join('').trim()}${lineBoundaryIsWhitespace ? ' ' : ''}\n${characters.slice(cut).join('').trim()}${preserveTrailingSpace ? ' ' : ''}`;
}

function normalizeLongCueText(text, options) {
  const raw = String(text || '').trim();
  const maxLineCharacters = Number(options.maxLineCharacters) > 0
    ? Number(options.maxLineCharacters)
    : WHISPER_SMALL_MAX_LINE_CHARACTERS;
  const maxCueCharacters = Number(options.maxCueCharacters) > 0
    ? Number(options.maxCueCharacters)
    : Math.max(maxLineCharacters * 2, WHISPER_SMALL_MAX_CUE_CHARACTERS);
  const rawLines = raw.split('\n');
  const rawCueCharacters = rawLines.reduce((sum, line) => sum + characterCount(line.trim()), 0);
  const alreadyReadable = rawLines.length <= 2
    && rawLines.every((line) => characterCount(line.trim()) <= maxLineCharacters)
    && rawCueCharacters <= maxCueCharacters;
  if (alreadyReadable) return { texts: [raw], changed: false, wasLong: false };
  const chunks = splitWhisperText(raw, maxCueCharacters);
  const texts = chunks.map((chunk) => wrapWhisperText(chunk, maxLineCharacters));
  return {
    texts: texts.length ? texts : [raw],
    changed: texts.some((value, index) => value !== rawLines[index]) || texts.length !== 1,
    wasLong: true,
  };
}

function splitCueTiming(cue, texts, options = {}) {
  if (texts.length <= 1) return [{ ...cue, text: texts[0] || cue.text }];
  const startMilliseconds = Math.round(cue.start * 1000);
  const endMilliseconds = Math.round(cue.end * 1000);
  const durationMilliseconds = endMilliseconds - startMilliseconds;
  // A one-millisecond minimum keeps every generated cue valid. If the source
  // interval is shorter than the number of pieces, retain one readable cue
  // instead of manufacturing zero/negative timestamps.
  if (durationMilliseconds < texts.length) {
    const maxLineCharacters = Number(options.maxLineCharacters) > 0
      ? Number(options.maxLineCharacters)
      : WHISPER_SMALL_MAX_LINE_CHARACTERS;
    const fallbackText = texts.join('').replace(/\n/gu, '');
    return [{ ...cue, text: wrapWhisperText(fallbackText, maxLineCharacters) }];
  }
  const weights = texts.map((text) => Math.max(1, characterCount(text)));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const result = [];
  let cursor = startMilliseconds;
  for (const [index, text] of texts.entries()) {
    const remainingPieces = texts.length - index - 1;
    const proposed = index === texts.length - 1
      ? endMilliseconds
      : cursor + Math.max(1, Math.round(durationMilliseconds * weights[index] / totalWeight));
    const pieceEnd = Math.min(endMilliseconds - remainingPieces, proposed);
    result.push({ ...cue, start: cursor / 1000, end: pieceEnd / 1000, text, splitFromSource: true });
    cursor = pieceEnd;
  }
  return result;
}

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
 * `splitLongCues` is intentionally opt-in because it is the Whisper Small
 * readability policy; Tiny/Base and legacy callers retain their original text.
 */
export function sanitizeWhisperSrt(input, options = {}) {
  const splitLongCues = options.splitLongCues === true;
  const blocks = String(input || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const cues = [];
  let droppedCount = 0;
  let longCueCount = 0;
  let normalizedCueCount = 0;
  let splitCueCount = 0;
  let unsplittableLongCueCount = 0;

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
    const cue = {
      id: cues.length + 1,
      sourceIndex,
      start,
      end,
      text,
    };
    if (!splitLongCues) {
      cues.push(cue);
      continue;
    }
    const normalized = normalizeLongCueText(text, options);
    if (!normalized.wasLong) {
      cues.push(cue);
      continue;
    }
    longCueCount += 1;
    if (normalized.changed) normalizedCueCount += 1;
    const splitCues = splitCueTiming(cue, normalized.texts, options);
    if (splitCues.length === 1 && normalized.texts.length > 1) unsplittableLongCueCount += 1;
    if (splitCues.length > 1) splitCueCount += 1;
    cues.push(...splitCues.map((splitCue, index) => ({ ...splitCue, id: cues.length + index + 1 })));
  }

  return {
    cues,
    droppedCount,
    totalBlocks: blocks.length,
    longCueCount,
    normalizedCueCount,
    splitCueCount,
    unsplittableLongCueCount,
    subtitle: cues.length
      ? `${cues.map((cue) => [String(cue.id), `${formatWhisperTime(cue.start)} --> ${formatWhisperTime(cue.end)}`, cue.text].join('\n')).join('\n\n')}\n\n`
      : '',
  };
}
