import { LOCALES } from '@/lib/i18n/config';
import { collectMessageKeys, missingMessageKeys } from '@/lib/i18n/collect-keys';
import { reportMissingTranslationKeys } from '@/lib/i18n/fallback-key';
import { getMessages } from '@/lib/i18n/get-messages';

const en = getMessages('en');
let exitCode = 0;

for (const locale of LOCALES) {
  if (locale === 'en') continue;
  const catalog = getMessages(locale);
  const missing = missingMessageKeys(en, catalog);
  console.log(reportMissingTranslationKeys(locale, missing));
  if (missing.length) exitCode = 1;
}

if (exitCode === 0) {
  console.log('i18n audit passed: all locales match English key coverage.');
}

process.exit(exitCode);
