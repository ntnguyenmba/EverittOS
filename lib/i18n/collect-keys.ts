/** Flatten nested message trees into dot-path keys. */
export function collectMessageKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return prefix ? [prefix] : [];
  }

  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      keys.push(path);
    } else if (value && typeof value === 'object') {
      keys.push(...collectMessageKeys(value, path));
    }
  }
  return keys.sort();
}

export function missingMessageKeys(
  base: Record<string, unknown>,
  other: Record<string, unknown>
): string[] {
  const baseKeys = collectMessageKeys(base);
  const otherSet = new Set(collectMessageKeys(other));
  return baseKeys.filter((key) => !otherSet.has(key));
}
