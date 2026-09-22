export const DIAGNOSTIC_TAIL_LIMIT = 1600;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sanitizeDiagnosticOutput(value, sensitiveValues = []) {
  let output = String(value || '');
  for (const sensitiveValue of sensitiveValues) {
    const candidate = String(sensitiveValue || '');
    if (candidate) output = output.replace(new RegExp(escapeRegExp(candidate), 'g'), '<redacted>');
  }
  return output
    .replace(/((?:api[_-]?key|authorization|access[_-]?token|token|secret|password|credential)\s*[=:]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n,;]*)/gi, '$1<redacted>')
    .replace(/\b((?:bearer|basic))\s+[^\r\n,;]+/gi, '$1 <redacted>')
    .replace(/\/(?:Users|private\/tmp|tmp|var\/folders)\/[^\s"'`,;]+/g, '<path>')
    .slice(-DIAGNOSTIC_TAIL_LIMIT);
}
