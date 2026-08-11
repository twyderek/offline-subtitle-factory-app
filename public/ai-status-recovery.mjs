export async function fetchAiStatusWithRetry({ request, maxRetries = 2, onRetry = async () => {} }) {
  let attempt = 0;
  while (true) {
    try {
      return await request();
    } catch (error) {
      if (!error?.retryable || attempt >= maxRetries) throw error;
      attempt += 1;
      await onRetry({ attempt, error });
    }
  }
}
