const BUILTIN_PROMPTS = Object.freeze({
  proofread: '修正錯字、大小寫與標點，保留原意。',
  breaks: '改善斷句與閱讀節奏，不新增、刪除或合併字幕。',
  terms: '依術語表統一專有名詞與技術名詞。',
  fillers: '移除不影響原意的口頭贅詞，保留說話者語氣。',
  translate: '翻譯成指定輸出語言，語意自然準確。',
});

export function normalizeGlossary(entries = []) {
  if (!Array.isArray(entries)) return [];
  return entries.slice(0, 2000).map((item) => ({
    source: String(item?.source || item?.original || '').trim(),
    target: String(item?.target || item?.standard || '').trim(),
    caseSensitive: Boolean(item?.caseSensitive),
    doNotTranslate: Boolean(item?.doNotTranslate),
    note: String(item?.note || '').trim().slice(0, 300),
  })).filter((item) => item.source && (item.target || item.doNotTranslate));
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { current += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { values.push(current); current = ''; }
    else current += char;
  }
  values.push(current);
  return values;
}

export function parseGlossaryCsv(csv = '') {
  const rows = String(csv).split(/\r?\n/).filter((line) => line.trim()).map(parseCsvLine);
  if (!rows.length) return [];
  const header = rows[0].map((value) => value.trim().toLowerCase());
  const column = (names, fallback) => names.map((name) => header.indexOf(name)).find((index) => index >= 0) ?? fallback;
  const source = column(['source', 'original', '原詞'], 0);
  const target = column(['target', 'standard', '標準詞'], 1);
  const caseSensitive = column(['casesensitive', '大小寫'], 2);
  const doNotTranslate = column(['donottranslate', '禁止翻譯'], 3);
  const note = column(['note', '備註'], 4);
  return normalizeGlossary(rows.slice(1).map((row) => ({
    source: row[source], target: row[target],
    caseSensitive: /^(1|true|yes|是)$/i.test(row[caseSensitive] || ''),
    doNotTranslate: /^(1|true|yes|是)$/i.test(row[doNotTranslate] || ''),
    note: row[note],
  })));
}

export function glossaryToCsv(entries = []) {
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return ['source,target,caseSensitive,doNotTranslate,note', ...normalizeGlossary(entries).map((item) => [item.source, item.target, item.caseSensitive, item.doNotTranslate, item.note].map(quote).join(','))].join('\n');
}

export function normalizePromptTemplates(value = {}) {
  return Object.fromEntries(Object.entries(BUILTIN_PROMPTS).map(([key, fallback]) => [key, String(value?.[key] || fallback).trim().slice(0, 4000)]));
}

export function normalizeProjectAiSettings(value = {}) {
  return { glossary: normalizeGlossary(value.glossary), prompts: normalizePromptTemplates(value.prompts) };
}

export function buildGlossaryInstruction(entries = []) {
  const glossary = normalizeGlossary(entries);
  if (!glossary.length) return '';
  return `專案術語表（必須一致套用）：\n${glossary.map((item) => `- ${item.source} → ${item.doNotTranslate ? '禁止翻譯' : item.target}${item.caseSensitive ? '（區分大小寫）' : ''}${item.note ? `；${item.note}` : ''}`).join('\n')}`;
}
