'use client';

import { useTranslation } from '@/components/locale-provider';
import { getCommonUiCopy } from '@/lib/i18n/common-ui-copy';

/** Translated in-page loading line; the shell, header, and backdrop stay mounted around it. */
export function PageLoading({ className = 'loading-state' }: { className?: string }) {
  const { locale } = useTranslation();
  return <p className={className} role="status">{getCommonUiCopy(locale).loading}</p>;
}
