type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
};

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message.toLowerCase();
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || '').toLowerCase();
  return String(error || '').toLowerCase();
}

export function isRetryableUploadError(error: unknown) {
  const message = messageOf(error);
  return [
    'network',
    'fetch',
    'timeout',
    'timed out',
    'connection',
    'offline',
    'socket',
    '503',
    '502',
    '504',
    'temporarily unavailable'
  ].some((token) => message.includes(token));
}

export async function retryUpload<T>(operation: () => Promise<T>, getError: (result: T) => unknown, options: RetryOptions = {}) {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 700);
  let lastResult: T | undefined;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await operation();
      lastResult = result;
      const error = getError(result);
      if (!error || !isRetryableUploadError(error) || attempt === attempts) return result;
    } catch (error) {
      if (!isRetryableUploadError(error) || attempt === attempts) throw error;
    }
    await wait(baseDelayMs * attempt);
  }

  return lastResult as T;
}
