import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  permissionDenied:string;
  loadError:string;
  saveError:string;
  validAmount:string;
  invalidCadence:string;
  defaultTitle:string;
  invalidTemplateId:string;
  templateNotFound:string;
  pausedInsteadOfDeleted:string;
  deleteError:string;
}> = {
  en:{permissionDenied:'Permission denied.',loadError:'Unable to load recurring invoices.',saveError:'Unable to save recurring invoice.',validAmount:'Enter a valid invoice amount.',invalidCadence:'Invalid cadence.',defaultTitle:'Recurring invoice',invalidTemplateId:'Invalid recurring invoice template ID.',templateNotFound:'Recurring invoice template not found.',pausedInsteadOfDeleted:'This recurring invoice has run history and was paused instead of deleted.',deleteError:'Unable to remove recurring invoice.'},
  es:{permissionDenied:'Permiso denegado.',loadError:'No se pudieron cargar las facturas recurrentes.',saveError:'No se pudo guardar la factura recurrente.',validAmount:'Introduce un importe de factura válido.',invalidCadence:'La frecuencia no es válida.',defaultTitle:'Factura recurrente',invalidTemplateId:'El ID de la plantilla de factura recurrente no es válido.',templateNotFound:'No se encontró la plantilla de factura recurrente.',pausedInsteadOfDeleted:'Esta factura recurrente tiene historial y se pausó en lugar de eliminarse.',deleteError:'No se pudo eliminar la factura recurrente.'},
  vi:{permissionDenied:'Không có quyền.',loadError:'Không thể tải hóa đơn định kỳ.',saveError:'Không thể lưu hóa đơn định kỳ.',validAmount:'Nhập số tiền hóa đơn hợp lệ.',invalidCadence:'Chu kỳ không hợp lệ.',defaultTitle:'Hóa đơn định kỳ',invalidTemplateId:'ID mẫu hóa đơn định kỳ không hợp lệ.',templateNotFound:'Không tìm thấy mẫu hóa đơn định kỳ.',pausedInsteadOfDeleted:'Hóa đơn định kỳ này đã có lịch sử chạy nên được tạm dừng thay vì xóa.',deleteError:'Không thể xóa hóa đơn định kỳ.'}
};

export function getRecurringInvoiceApiCopy(locale: Locale) { return COPY[locale] || COPY.en; }
