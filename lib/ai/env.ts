/** Server-only environment helpers for AI providers. */

export function envTrim(key: string): string | null {
  const value = (process.env[key] || '').trim();
  return value || null;
}

export function firstEnv(...keys: string[]): string | null {
  for (const key of keys) {
    const value = envTrim(key);
    if (value) return value;
  }
  return null;
}

export function envNumber(key: string, fallback: number): number {
  const raw = envTrim(key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}
