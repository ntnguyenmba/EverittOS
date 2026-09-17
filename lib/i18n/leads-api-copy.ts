import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  unauthorized:string;
  permissionDenied:string;
  loadMetrics:string;
}> = {
  en:{unauthorized:'Unauthorized.',permissionDenied:'Permission denied.',loadMetrics:'Unable to load lead metrics.'},
  es:{unauthorized:'No autorizado.',permissionDenied:'Permiso denegado.',loadMetrics:'No se pudieron cargar las métricas de clientes potenciales.'},
  vi:{unauthorized:'Không được phép.',permissionDenied:'Không có quyền.',loadMetrics:'Không thể tải số liệu khách hàng tiềm năng.'}
};

export function getLeadsApiCopy(locale: Locale) { return COPY[locale] || COPY.en; }
