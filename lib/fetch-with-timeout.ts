const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      credentials: init.credentials ?? 'same-origin',
      cache: init.cache ?? 'no-store',
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

export function requestFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'The request took too long. Check your connection and try again.';
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
