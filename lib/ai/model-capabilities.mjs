function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function modelContextLength(model = {}) {
  return finitePositive(
    model.context_length
      ?? model.contextLength
      ?? model.max_model_len
      ?? model.maxContextLength
      ?? model.details?.context_length,
  );
}

export function parseCapabilityProbe(result = {}) {
  const content = String(result?.choices?.[0]?.message?.content || '').trim();
  const normalized = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed = JSON.parse(normalized);
    return {
      jsonOutput: true,
      traditionalChinese: parsed.traditionalChinese === '繁體中文',
      responseSample: normalized.slice(0, 200),
    };
  } catch {
    return {
      jsonOutput: false,
      traditionalChinese: false,
      responseSample: normalized.slice(0, 200),
    };
  }
}

export async function inspectModelCapabilities(config, provider) {
  const models = await provider.listModels();
  const selected = models.find((model) => String(model?.id || '') === config.model);
  const probe = await provider.optimize({
    model: config.model,
    messages: [
      { role: 'system', content: 'Return only valid JSON. Do not use Markdown.' },
      { role: 'user', content: 'Return exactly {"traditionalChinese":"繁體中文"}.' },
    ],
    max_completion_tokens: 80,
  });
  return {
    modelAvailable: Boolean(selected),
    contextLength: modelContextLength(selected),
    ...parseCapabilityProbe(probe),
  };
}
