'use client';

import { LOCALE_LABELS, LOCALES, type Locale } from '@/lib/i18n/config';
import { useTranslation } from '@/components/locale-provider';
import { persistLocaleChoice } from '@/lib/locale-persist';

type LanguageSwitcherProps = {
  className?: string;
  id?: string;
  /** compact = select only (header bars); drawer = full-width in mobile menu */
  variant?: 'default' | 'compact' | 'drawer';
};

export function LanguageSwitcher({
  className,
  id = 'app-language',
  variant = 'default'
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useTranslation();

  async function onChange(next: Locale) {
    setLocale(next);
    await persistLocaleChoice(next);
  }

  const showLabel = variant !== 'compact';
  const selectStyle =
    variant === 'drawer'
      ? { width: '100%', minWidth: 0 }
      : variant === 'compact'
        ? { width: '8.75rem', minWidth: '8.75rem', maxWidth: '100%' }
        : { width: '100%', minWidth: 0 };

  return (
    <label
      className={
        className
          ? `language-switcher language-switcher-${variant} ${className}`
          : `language-switcher language-switcher-${variant}`
      }
      htmlFor={id}
      style={variant === 'drawer' || variant === 'default' ? { width: '100%', minWidth: 0 } : undefined}
    >
      {showLabel ? <span className="language-switcher-label">{t('common.language')}</span> : null}
      <select
        id={id}
        className="input language-switcher-select"
        value={locale}
        onChange={(event) => void onChange(event.target.value as Locale)}
        aria-label={t('common.language')}
        title={LOCALE_LABELS[locale]}
        style={selectStyle}
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
