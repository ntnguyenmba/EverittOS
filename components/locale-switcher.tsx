'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { LOCALES, LOCALE_LABELS, type AppLocale } from '@/i18n/routing';

type LocaleSwitcherProps = {
  className?: string;
  compact?: boolean;
  showLabel?: boolean;
};

export function LocaleSwitcher({ className, compact = false, showLabel = true }: LocaleSwitcherProps) {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations('locale');
  const commonT = useTranslations('common');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function onChange(nextLocale: AppLocale) {
    if (nextLocale === locale || pending) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/account/locale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: nextLocale })
        });

        if (!res.ok) {
          setMessage(commonT('languageSaveFailed'));
          return;
        }

        router.refresh();
      } catch {
        setMessage(commonT('languageSaveFailed'));
      }
    });
  }

  return (
    <div className={className ? `locale-switcher ${className}` : 'locale-switcher'}>
      {showLabel ? (
        <label className="locale-switcher-label" htmlFor="locale-select">
          {t('label')}
        </label>
      ) : null}
      <select
        id="locale-select"
        className={compact ? 'input locale-switcher-select locale-switcher-select-compact' : 'input locale-switcher-select'}
        value={locale}
        disabled={pending}
        aria-label={t('label')}
        onChange={(event) => onChange(event.target.value as AppLocale)}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
      {message ? <p className="locale-switcher-message muted">{message}</p> : null}
    </div>
  );
}
