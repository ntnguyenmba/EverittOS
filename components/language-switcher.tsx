'use client';

import { LOCALE_LABELS, LOCALES, type Locale } from '@/lib/i18n/config';
import { useTranslation } from '@/components/locale-provider';

type LanguageSwitcherProps = {
  className?: string;
  id?: string;
};

export function LanguageSwitcher({ className, id = 'app-language' }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useTranslation();

  return (
    <label className={className ? `language-switcher ${className}` : 'language-switcher'} htmlFor={id}>
      <span className="language-switcher-label">{t('common.language')}</span>
      <select
        id={id}
        className="input language-switcher-select"
        value={locale}
        onChange={(event) => {
          const next = event.target.value as Locale;
          setLocale(next);
          void fetch('/api/account/privacy', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preferred_locale: next })
          });
        }}
        aria-label={t('common.language')}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
