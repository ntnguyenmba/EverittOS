import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  permissionDenied:string;
  loadError:string;
  saveError:string;
  validAmount:string;
  invalidCadence:string;
  defaultTitle:string;
}> = {
  en:{permissionDenied:'Permission denied.',loadError:'Unable to load recurring invoices.',saveError:'Unable to save recurring invoice.',validAmount:'Enter a valid invoice amount.',invalidCadence:'Invalid cadence.',defaultTitle:'Recurring invoice'},
  es:{permissionDenied:'Permiso denegado.',loadError:'No se pudieron cargar las facturas recurrentes.',saveError:'No se pudo guardar la factura recurrente.',validAmount:'Introduce un importe de factura válido.',invalidCadence:'La frecuencia no es válida.',defaultTitle:'Factura recurrente'},
  vi:{permissionDenied:'Không có quyền.',loadError:'Không thể tải hóa đơn định kỳ.',saveError:'Không thể lưu hóa đơn định kỳ.',validAmount:'Nhập số tiền hóa đơn hợp lệ.',invalidCadence:'Chu kỳ không hợp lệ.',defaultTitle:'Hóa đơn định kỳ'}
};

export function getRecurringInvoiceApiCopy(locale: Locale) { return COPY[locale] || COPY.en; }
