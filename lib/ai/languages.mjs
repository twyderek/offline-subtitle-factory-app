export const DEFAULT_AI_LANGUAGE = 'zh-TW';

export const COMMON_AI_LANGUAGES = Object.freeze([
  ['zh-TW', '繁體中文'],
  ['en', '英文'],
  ['ja', '日文'],
  ['ko', '韓文'],
  ['es', '西班牙文'],
  ['fr', '法文'],
  ['de', '德文'],
  ['pt-BR', '葡萄牙文（巴西）'],
  ['vi', '越南文'],
  ['th', '泰文'],
  ['id', '印尼文'],
]);

const LANGUAGE_NAMES = new Map(COMMON_AI_LANGUAGES);
export function canonicalizeLanguageTag(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 255) {
    throw new Error('輸出語言必須是有效的 BCP 47 語言標籤，例如 zh-TW、en、ja 或 fr-CA');
  }
  try {
    return Intl.getCanonicalLocales(raw)[0];
  } catch {
    throw new Error('輸出語言必須是有效的 BCP 47 語言標籤，例如 zh-TW、en、ja 或 fr-CA');
  }
}

export function normalizeLanguageTag(value, fallback = DEFAULT_AI_LANGUAGE) {
  try {
    return canonicalizeLanguageTag(value);
  } catch {
    return canonicalizeLanguageTag(fallback);
  }
}

export function languagePromptInstruction(value, mode = 'proofread') {
  const tag = canonicalizeLanguageTag(value);
  const name = LANGUAGE_NAMES.get(tag) || tag;
  if (mode === 'translate') {
    return `將所有字幕翻譯為${name}（BCP 47：${tag}）；不得保留未翻譯的來源語句，專有名詞與術語表指定內容除外。`;
  }
  return `所有修改後的字幕必須使用${name}（BCP 47：${tag}）；若原文不是該語言，請在保留原意的前提下轉換為該語言。`;
}
