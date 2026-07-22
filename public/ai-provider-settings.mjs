export function providerProfileSnapshot(value = {}) {
  const provider = String(value.provider || '').trim();
  return {
    provider,
    baseUrl: String(value.baseUrl || '').trim().replace(/\/+$/, ''),
    model: String(value.model || '').trim(),
    deployment: provider === 'azure' ? String(value.deployment || '').trim() : '',
    apiVersion: provider === 'azure' ? String(value.apiVersion || '').trim() : '',
  };
}

export function providerProfileMatches(saved, current) {
  if (!saved) return false;
  const left = providerProfileSnapshot(saved);
  const right = providerProfileSnapshot(current);
  return Object.keys(left).every((key) => left[key] === right[key]);
}

export function validateProviderConnectionForm(saved, current, hasSavedKey) {
  const profile = providerProfileSnapshot(current);
  if (!profile.baseUrl) return '請先填寫 API Base URL 並儲存設定';
  if (!profile.model) return '請先填寫模型名稱並儲存設定';
  if (String(current?.apiKey || '').trim()) return '請先儲存設定與 API Key，再測試連線';
  if (!hasSavedKey) return '請先輸入 API Key 並儲存設定';
  if (!providerProfileMatches(saved, profile)) return '供應商、Base URL 或模型已有未儲存變更；請先儲存設定';
  return '';
}

export async function runProviderConnectionTest({ button, savedProfile, currentSettings, hasSavedKey, request, setStatus }) {
  button.disabled = true;
  setStatus('正在測試 AI 服務…');
  try {
    const validationError = validateProviderConnectionForm(savedProfile, currentSettings, hasSavedKey);
    if (validationError) throw new Error(validationError);
    const response = await request();
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
    const modelMessage = result.modelAvailable ? '指定模型可用' : '已連線，但模型清單中找不到指定模型';
    setStatus(`連線成功：${modelMessage}`);
    return result;
  } catch (error) {
    setStatus(`連線失敗：${error.message}`);
    return null;
  } finally {
    button.disabled = false;
  }
}
