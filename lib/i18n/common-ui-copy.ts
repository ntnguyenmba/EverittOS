import type { Locale } from '@/lib/i18n/config';

type CommonUiCopy = {
  home: string;
  legal: string;
  pricingNavigation: string;
  timeZone: string;
  noRefundPolicy: string;
  recentActivity: string;
  appNavigation: string;
  beforeAfterComparison: string;
  before: string;
  after: string;
  openCalendar: string;
  calendar: string;
  today: string;
  tomorrow: string;
  clear: string;
  enterDate: string;
  invalidDate: string;
  dateOnOrAfter: (date: string) => string;
  dateOnOrBefore: (date: string) => string;
  dismissNotification: string;
  askEveritt: string;
  needsAttention: string;
  photoPreview: string;
  writeMessage: string;
  send: string;
  optionalNote: string;
};

const COPY: Record<Locale, CommonUiCopy> = {
  en: {
    home: 'EverittOS home', legal: 'Legal', pricingNavigation: 'Pricing navigation', timeZone: 'Time zone', noRefundPolicy: 'No refund policy', recentActivity: 'Recent Activity', appNavigation: 'App navigation', beforeAfterComparison: 'Before and after comparison', before: 'Before', after: 'After', openCalendar: 'Open calendar', calendar: 'Calendar', today: 'Today', tomorrow: 'Tomorrow', clear: 'Clear', enterDate: 'Enter a date.', invalidDate: 'Use MM/DD/YYYY, for example 07/11/2026.', dateOnOrAfter: date => `Date must be on or after ${date}.`, dateOnOrBefore: date => `Date must be on or before ${date}.`, dismissNotification: 'Dismiss notification', askEveritt: 'Ask Everitt', needsAttention: 'Needs attention', photoPreview: 'Photo preview', writeMessage: 'Write a message', send: 'Send', optionalNote: 'Optional note'
  },
  es: {
    home: 'Inicio de EverittOS', legal: 'Legal', pricingNavigation: 'Navegación de precios', timeZone: 'Zona horaria', noRefundPolicy: 'Política de no reembolso', recentActivity: 'Actividad reciente', appNavigation: 'Navegación de la aplicación', beforeAfterComparison: 'Comparación antes y después', before: 'Antes', after: 'Después', openCalendar: 'Abrir calendario', calendar: 'Calendario', today: 'Hoy', tomorrow: 'Mañana', clear: 'Borrar', enterDate: 'Ingresa una fecha.', invalidDate: 'Usa MM/DD/AAAA, por ejemplo 07/11/2026.', dateOnOrAfter: date => `La fecha debe ser ${date} o posterior.`, dateOnOrBefore: date => `La fecha debe ser ${date} o anterior.`, dismissNotification: 'Cerrar notificación', askEveritt: 'Preguntar a Everitt', needsAttention: 'Necesita atención', photoPreview: 'Vista previa de foto', writeMessage: 'Escribe un mensaje', send: 'Enviar', optionalNote: 'Nota opcional'
  },
  vi: {
    home: 'Trang chủ EverittOS', legal: 'Pháp lý', pricingNavigation: 'Điều hướng bảng giá', timeZone: 'Múi giờ', noRefundPolicy: 'Chính sách không hoàn tiền', recentActivity: 'Hoạt động gần đây', appNavigation: 'Điều hướng ứng dụng', beforeAfterComparison: 'So sánh trước và sau', before: 'Trước', after: 'Sau', openCalendar: 'Mở lịch', calendar: 'Lịch', today: 'Hôm nay', tomorrow: 'Ngày mai', clear: 'Xóa', enterDate: 'Nhập ngày.', invalidDate: 'Dùng MM/DD/YYYY, ví dụ 07/11/2026.', dateOnOrAfter: date => `Ngày phải là ${date} hoặc sau đó.`, dateOnOrBefore: date => `Ngày phải là ${date} hoặc trước đó.`, dismissNotification: 'Đóng thông báo', askEveritt: 'Hỏi Everitt', needsAttention: 'Cần xử lý', photoPreview: 'Xem trước ảnh', writeMessage: 'Viết tin nhắn', send: 'Gửi', optionalNote: 'Ghi chú tùy chọn'
  }
};

export function getCommonUiCopy(locale: Locale): CommonUiCopy {
  return COPY[locale] || COPY.en;
}
