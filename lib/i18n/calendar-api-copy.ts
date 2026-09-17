import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  unauthorized:string; permissionDenied:string; serverUnavailable:string; disconnectFailed:string;
  jobIdRequired:string; jobNotFound:string; syncFailed:string;
}> = {
  en:{unauthorized:'Unauthorized.',permissionDenied:'Permission denied.',serverUnavailable:'This feature is temporarily unavailable.',disconnectFailed:'Unable to disconnect Google Calendar.',jobIdRequired:'Job ID is required.',jobNotFound:'Job not found.',syncFailed:'Unable to sync this job to Google Calendar.'},
  es:{unauthorized:'No autorizado.',permissionDenied:'Permiso denegado.',serverUnavailable:'Esta función no está disponible temporalmente.',disconnectFailed:'No se pudo desconectar Google Calendar.',jobIdRequired:'El ID del trabajo es obligatorio.',jobNotFound:'No se encontró el trabajo.',syncFailed:'No se pudo sincronizar este trabajo con Google Calendar.'},
  vi:{unauthorized:'Không được phép.',permissionDenied:'Không có quyền.',serverUnavailable:'Tính năng này tạm thời không khả dụng.',disconnectFailed:'Không thể ngắt kết nối Google Calendar.',jobIdRequired:'ID công việc là bắt buộc.',jobNotFound:'Không tìm thấy công việc.',syncFailed:'Không thể đồng bộ công việc này với Google Calendar.'}
};

export function getCalendarApiCopy(locale: Locale) { return COPY[locale] || COPY.en; }
