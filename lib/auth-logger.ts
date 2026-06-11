/** Console-safe auth logging — never log passwords, tokens, or keys. */
export function logAuthEvent(event: string, meta?: Record<string, string | number | boolean | null | undefined>) {
  if (process.env.NODE_ENV === 'production' && !process.env.AUTH_DEBUG) return;

  const safe: Record<string, string | number | boolean> = { event };
  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      if (value === undefined || value === null) continue;
      const lower = key.toLowerCase();
      if (lower.includes('password') || lower.includes('token') || lower.includes('secret') || lower.includes('key')) {
        continue;
      }
      safe[key] = typeof value === 'object' ? JSON.stringify(value) : value;
    }
  }

  console.info('[everittos-auth]', safe);
}
