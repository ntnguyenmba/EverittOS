import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  permissionDenied: string;
  planRequired: (plan: string) => string;
}> = {
  en: {
    permissionDenied: 'Permission denied.',
    planRequired: (plan) => `${plan} plan or higher is required for financial tracking.`
  },
  es: {
    permissionDenied: 'Permiso denegado.',
    planRequired: (plan) => `Se requiere el plan ${plan} o uno superior para el seguimiento financiero.`
  },
  vi: {
    permissionDenied: 'Không có quyền.',
    planRequired: (plan) => `Cần gói ${plan} trở lên để theo dõi tài chính.`
  }
};

export function getFinanceApiCopy(locale: Locale) {
  return COPY[locale] || COPY.en;
}
