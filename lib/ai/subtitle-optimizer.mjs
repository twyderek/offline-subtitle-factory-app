const MODE_INSTRUCTIONS = {
  proofread: '修正錯字、大小寫與標點。',
  breaks: '改善斷句與閱讀節奏，但不可新增、刪除或合併字幕段落。',
  terms: '統一專有名詞與技術名詞寫法。',
  fillers: '移除不影響原意的口頭贅詞，保留說話者語氣。',
  translate: '翻譯成指定輸出語言，保持語意準確自然。',
};

import { buildGlossaryInstruction } from './project-tools.mjs';

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

function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason || new Error('AI 優化已取消'));
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason || new Error('AI 優化已取消'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function retryDelay(error, attempt, config) {
  const base = Math.max(1, Number(config.retryBaseMs) || 1000);
  const ceiling = Math.max(base, Number(config.retryMaxMs) || 30000);
  const exponential = Math.min(ceiling, base * (2 ** attempt));
  const jitter = config.disableRetryJitter ? 0 : Math.floor(Math.random() * Math.max(1, exponential * 0.2));
  return Math.max(Number(error.retryAfterMs) || 0, exponential + jitter);
}

async function completeWithRetry({ complete, body, signal, config, batchIndex, progress, retryCount }) {
  const configuredRetries = Number(config.maxRetries);
  const maxRetries = Math.max(0, Math.min(8, Number.isFinite(configuredRetries) ? configuredRetries : 3));
  let attempt = 0;
  while (true) {
    try {
      return await complete(body, signal);
    } catch (error) {
      if (signal?.aborted || !error?.retryable || attempt >= maxRetries) throw error;
      const waitMs = retryDelay(error, attempt, config);
      attempt += 1;
      retryCount.value += 1;
      complete.progress?.({ ...progress, activeBatch: batchIndex + 1, retryAttempt: attempt, retryWaitMs: waitMs, retryStatus: error.status || 0, totalRetries: retryCount.value });
      await abortableDelay(waitMs, signal);
    }
  }
}

export async function optimizeSubtitleCues({ cues, config, mode = 'proofread', instructions = '', promptTemplate = '', glossary = [], language = 'zh-TW', signal, complete, checkpoint = {}, onCheckpoint }) {
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
  const startBatchIndex = Math.max(0, Math.min(totalBatches, Number(checkpoint.nextBatchIndex) || 0));
  const suggestions = Array.isArray(checkpoint.suggestions) ? [...checkpoint.suggestions] : [];
  const retryCount = { value: Math.max(0, Number(checkpoint.totalRetries) || 0) };
  for (let batchIndex = startBatchIndex; batchIndex < totalBatches; batchIndex += 1) {
    if (signal?.aborted) throw signal.reason || new Error('AI 優化已取消');
    const batch = normalized.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
    const progress = { completedBatches: batchIndex, totalBatches, processedCues: Math.min(normalized.length, batchIndex * batchSize), totalCues: normalized.length, totalRetries: retryCount.value };
    const body = {
      model: config.model,
      temperature: 0.1,
      ...(config.capabilities?.jsonSchema !== false ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        {
          role: 'system',
          content: `你是字幕校對員。${promptTemplate || MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.proofread}輸出語言：${language}。不可更改 ID、順序、段落數或時間碼，不可杜撰內容。只輸出 JSON：{"cues":[{"id":原ID,"text":"優化文字","reason":"簡短原因"}]}`,
        },
        {
          role: 'user',
          content: `${instructions || config.instructions || ''}\n${buildGlossaryInstruction(glossary)}\n\n待處理字幕：\n${JSON.stringify(batch)}`,
        },
      ],
    };
    const result = await completeWithRetry({ complete, body, signal, config, batchIndex, progress, retryCount });
    const validated = validateBatch(batch, parseCompletionContent(result));
    validated.forEach((item, index) => {
      const source = batch[index];
      if (item.text !== source.text) suggestions.push({ ...item, original: source.text, start: source.start, end: source.end });
    });
    const completedProgress = { completedBatches: batchIndex + 1, totalBatches, processedCues: Math.min(normalized.length, (batchIndex + 1) * batchSize), totalCues: normalized.length, totalRetries: retryCount.value };
    await onCheckpoint?.({ nextBatchIndex: batchIndex + 1, suggestions, totalRetries: retryCount.value, progress: completedProgress });
    complete.progress?.(completedProgress);
  }
  return { suggestions, totalCues: normalized.length, changedCues: suggestions.length, totalBatches, totalRetries: retryCount.value, resumedFromBatch: startBatchIndex };
}
