import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  unauthorized:string;
  loadError:string;
  idRequired:string;
  updateError:string;
}> = {
  en:{unauthorized:'Unauthorized.',loadError:'Unable to load notifications.',idRequired:'Notification ID is required.',updateError:'Unable to update notifications.'},
  es:{unauthorized:'No autorizado.',loadError:'No se pudieron cargar las notificaciones.',idRequired:'El ID de la notificación es obligatorio.',updateError:'No se pudieron actualizar las notificaciones.'},
  vi:{unauthorized:'Không được phép.',loadError:'Không thể tải thông báo.',idRequired:'ID thông báo là bắt buộc.',updateError:'Không thể cập nhật thông báo.'}
};

export function getNotificationsApiCopy(locale: Locale) { return COPY[locale] || COPY.en; }
