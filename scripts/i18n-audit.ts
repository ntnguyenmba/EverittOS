import { LOCALES } from '@/lib/i18n/config';
import { collectMessageKeys, missingMessageKeys } from '@/lib/i18n/collect-keys';
import { reportMissingTranslationKeys } from '@/lib/i18n/fallback-key';
import { getMessages } from '@/lib/i18n/get-messages';

type MessageTree = Record<string, unknown>;

function resolveMessage(messages: MessageTree, path: string): string | undefined {
  let current: unknown = messages;
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function placeholders(value: string): string[] {
  return Array.from(value.matchAll(/\{([a-zA-Z0-9_]+)\}/g), (match) => match[1]).sort();
}

function sameValues(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

const en = getMessages('en') as MessageTree;
const englishKeys = collectMessageKeys(en);
let exitCode = 0;

for (const locale of LOCALES) {
  if (locale === 'en') continue;

  const catalog = getMessages(locale) as MessageTree;
  const missing = missingMessageKeys(en, catalog);
  const extra = collectMessageKeys(catalog).filter((key) => !englishKeys.includes(key));
  const empty: string[] = [];
  const placeholderMismatch: Array<{ key: string; expected: string[]; actual: string[] }> = [];

  for (const key of englishKeys) {
    const localized = resolveMessage(catalog, key);
    const english = resolveMessage(en, key);
    if (localized === undefined || english === undefined) continue;

    if (!localized.trim()) empty.push(key);

    const expected = placeholders(english);
    const actual = placeholders(localized);
    if (!sameValues(expected, actual)) {
      placeholderMismatch.push({ key, expected, actual });
    }
  }

  console.log(reportMissingTranslationKeys(locale, missing));

  if (extra.length) {
    console.error(`i18n audit: ${locale} has ${extra.length} key(s) not present in English:`);
    for (const key of extra) console.error(`  - ${key}`);
  }

  if (empty.length) {
    console.error(`i18n audit: ${locale} has ${empty.length} empty translation(s):`);
    for (const key of empty) console.error(`  - ${key}`);
  }

  if (placeholderMismatch.length) {
    console.error(`i18n audit: ${locale} has ${placeholderMismatch.length} placeholder mismatch(es):`);
    for (const item of placeholderMismatch) {
      console.error(
        `  - ${item.key}: expected {${item.expected.join('}, {')}} but found {${item.actual.join('}, {')}}`
      );
    }
  }

  if (missing.length || extra.length || empty.length || placeholderMismatch.length) exitCode = 1;
}

if (exitCode === 0) {
  console.log('i18n audit passed: all locales match English keys, contain text, and preserve placeholders.');
}

process.exit(exitCode);
