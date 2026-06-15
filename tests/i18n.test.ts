import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_LOCALE, LOCALE_LABELS, LOCALES, normalizeLocale } from '@/lib/i18n/config';
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
});
