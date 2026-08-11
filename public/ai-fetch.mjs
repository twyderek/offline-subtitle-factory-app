export function isNetworkFetchFailure(error) {
  const message = String(error?.message || error || '');
  return error?.code === 'local_api_unreachable'
    || /Failed to fetch|NetworkError|Load failed|fetch failed|ECONNREFUSED|ERR_CONNECTION_REFUSED/i.test(message);
}

export function normalizeAiFetchError(error, { apiBase = '', operation = 'AI 請求' } = {}) {
  if (!isNetworkFetchFailure(error)) return error instanceof Error ? error : new Error(String(error || 'AI 請求失敗'));
  const normalized = new Error(`無法連線到本機字幕服務（${apiBase || '目前 App 服務'}）。${operation} 未取得服務回應；請重新載入校閱頁或重啟 App。若任務已開始，請使用「恢復 AI 優化」查詢 checkpoint。`);
  normalized.name = 'AiLocalApiError';
  normalized.code = 'local_api_unreachable';
  normalized.retryable = true;
  normalized.cause = error;
  return normalized;
}

export function invalidAiApiResponseError({ apiBase = '', operation = 'AI 請求' } = {}) {
  const error = new Error(`本機字幕服務回應格式無效（${operation}，${apiBase || '目前 App 服務'}）。請重新載入校閱頁；若任務已開始，請使用「恢復 AI 優化」。`);
  error.name = 'AiInvalidApiResponseError';
  error.code = 'invalid_api_response';
  error.retryable = true;
  return error;
}
