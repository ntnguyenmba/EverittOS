import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, { unauthorized:string; resourceRequired:string }> = {
  en:{unauthorized:'Unauthorized.',resourceRequired:'Plan resource is required.'},
  es:{unauthorized:'No autorizado.',resourceRequired:'El recurso del plan es obligatorio.'},
  vi:{unauthorized:'Không được phép.',resourceRequired:'Tài nguyên của gói là bắt buộc.'}
};

export function getPlanApiCopy(locale: Locale) { return COPY[locale] || COPY.en; }
