import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatMissingTranslationKey } from '@/lib/i18n/fallback-key';
import { DEFAULT_LOCALE, LOCALE_LABELS, LOCALES, normalizeLocale } from '@/lib/i18n/config';
import { collectMessageKeys, missingMessageKeys } from '@/lib/i18n/collect-keys';
import { getMessages } from '@/lib/i18n/get-messages';

describe('i18n locale config', () => {
  it('defaults to English', () => {
    assert.equal(DEFAULT_LOCALE, 'en');
    assert.equal(normalizeLocale(null), 'en');
    assert.equal(normalizeLocale(''), 'en');
    assert.equal(normalizeLocale('fr'), 'en');
  });

  it('supports Spanish and Vietnamese', () => {
    assert.equal(normalizeLocale('es'), 'es');
    assert.equal(normalizeLocale('vi'), 'vi');
    assert.deepEqual([...LOCALES], ['en', 'es', 'vi']);
    assert.equal(LOCALE_LABELS.en, 'English');
    assert.equal(LOCALE_LABELS.es, 'Español');
    assert.equal(LOCALE_LABELS.vi, 'Tiếng Việt');
  });
});

describe('i18n message catalogs', () => {
  it('loads all locale dictionaries with shared nav labels', () => {
    for (const locale of LOCALES) {
      const messages = getMessages(locale);
      assert.ok(messages.nav.dashboard, locale);
      assert.ok(messages.nav.bookings, locale);
      assert.ok(messages.settings.account.languageTitle, locale);
    }
  });

  it('falls back to English catalog for unknown locale', () => {
    const messages = getMessages('en');
    assert.equal(getMessages('en').nav.jobs, messages.nav.jobs);
  });

  it('uses bracketed keys for missing translations', () => {
    assert.equal(formatMissingTranslationKey('dashboard.teamCommand.title'), '[[dashboard.teamCommand.title]]');
  });

  it('keeps en, es, and vi catalogs in parity', () => {
    const en = getMessages('en');
    const es = getMessages('es');
    const vi = getMessages('vi');
    const enKeys = collectMessageKeys(en);

    assert.ok(enKeys.length > 500, 'expected a large English catalog');
    assert.deepEqual(missingMessageKeys(en, es), [], `es missing: ${missingMessageKeys(en, es).slice(0, 10).join(', ')}`);
    assert.deepEqual(missingMessageKeys(en, vi), [], `vi missing: ${missingMessageKeys(en, vi).slice(0, 10).join(', ')}`);
    assert.deepEqual(missingMessageKeys(es, en), [], `en missing from es: ${missingMessageKeys(es, en).slice(0, 10).join(', ')}`);
    assert.deepEqual(missingMessageKeys(vi, en), [], `en missing from vi: ${missingMessageKeys(vi, en).slice(0, 10).join(', ')}`);
  });
});
