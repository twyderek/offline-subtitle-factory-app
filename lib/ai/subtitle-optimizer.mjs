const MODE_INSTRUCTIONS = {
  proofread: '修正錯字、大小寫與標點。',
  breaks: '改善斷句與閱讀節奏，但不可新增、刪除或合併字幕段落。',
  terms: '統一專有名詞與技術名詞寫法。',
  fillers: '移除不影響原意的口頭贅詞，保留說話者語氣。',
  translate: '翻譯成指定輸出語言，保持語意準確自然。',
};

function parseCompletionContent(result) {
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('AI 未回傳字幕內容');
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try { parsed = JSON.parse(cleaned); } catch { throw new Error('AI 回傳內容不是有效 JSON'); }
  return Array.isArray(parsed) ? parsed : parsed.cues;
}

function validateBatch(source, result) {
  if (!Array.isArray(result)) throw new Error('AI 回傳缺少 cues 陣列');
  if (result.length !== source.length) throw new Error('AI 回傳字幕段落數量不符');
  const sourceById = new Map(source.map((cue) => [String(cue.id), cue]));
  const seen = new Set();
  return result.map((cue) => {
    const id = String(cue?.id ?? '');
    const original = sourceById.get(id);
    if (!original || seen.has(id)) throw new Error(`AI 回傳無效或重複的 cue ID：${id || '空白'}`);
    seen.add(id);
    const text = String(cue.text || '').trim();
    if (!text || text.length > Math.max(500, original.text.length * 6)) throw new Error(`cue ${id} 的 AI 文字長度異常`);
    return { id: original.id, text, reason: String(cue.reason || '').trim().slice(0, 240) };
  });
}

export async function optimizeSubtitleCues({ cues, config, mode = 'proofread', instructions = '', language = 'zh-TW', signal, complete }) {
  if (!Array.isArray(cues) || cues.length === 0) throw new Error('沒有可供 AI 優化的字幕');
  const normalized = cues.map((cue, index) => ({
    id: cue.id ?? index + 1,
    start: String(cue.start || ''),
    end: String(cue.end || ''),
    text: String(cue.text || '').trim(),
  }));
  if (normalized.some((cue) => !cue.text)) throw new Error('字幕包含空白段落');
  const batchSize = Math.max(1, Math.min(100, Number(config.batchSize) || 30));
  const totalBatches = Math.ceil(normalized.length / batchSize);
  const suggestions = [];
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
    if (signal?.aborted) throw signal.reason || new Error('AI 優化已取消');
    const batch = normalized.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
    const result = await complete({
      model: config.model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `你是字幕校對員。${MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.proofread}輸出語言：${language}。不可更改 ID、順序、段落數或時間碼，不可杜撰內容。只輸出 JSON：{"cues":[{"id":原ID,"text":"優化文字","reason":"簡短原因"}]}`,
        },
        {
          role: 'user',
          content: `${instructions || config.instructions || ''}\n\n待處理字幕：\n${JSON.stringify(batch)}`,
        },
      ],
    }, signal);
    const validated = validateBatch(batch, parseCompletionContent(result));
    validated.forEach((item, index) => {
      const source = batch[index];
      if (item.text !== source.text) suggestions.push({ ...item, original: source.text, start: source.start, end: source.end });
    });
    complete.progress?.({ completedBatches: batchIndex + 1, totalBatches, processedCues: Math.min(normalized.length, (batchIndex + 1) * batchSize), totalCues: normalized.length });
  }
  return { suggestions, totalCues: normalized.length, changedCues: suggestions.length, totalBatches };
}
