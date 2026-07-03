/** Visible marker for missing translations — grep `[[` to audit untranslated UI. */
export const MISSING_TRANSLATION_PREFIX = '[[';
export const MISSING_TRANSLATION_SUFFIX = ']]';

export function formatMissingTranslationKey(path: string): string {
  return `${MISSING_TRANSLATION_PREFIX}${path}${MISSING_TRANSLATION_SUFFIX}`;
}

export function isMissingTranslationKey(value: string): boolean {
  return value.startsWith(MISSING_TRANSLATION_PREFIX) && value.endsWith(MISSING_TRANSLATION_SUFFIX);
}

/** Collect keys present in English but absent from another locale catalog. */
export function reportMissingTranslationKeys(
  locale: string,
  missingKeys: string[]
): string {
  if (!missingKeys.length) {
    return `i18n: ${locale} catalog is complete against English.`;
  }
  return [`i18n: ${locale} missing ${missingKeys.length} key(s):`, ...missingKeys.map((key) => `  - ${key}`)].join('\n');
}
