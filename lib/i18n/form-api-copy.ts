import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  unauthorized:string;
  organizationNotFound:string;
  permissionDenied:string;
  loadForm:string;
  notFound:string;
  saveForm:string;
  saved:string;
  removed:string;
}> = {
  en: {
    unauthorized:'Unauthorized.',
    organizationNotFound:'Organization not found.',
    permissionDenied:'Permission denied.',
    loadForm:'Unable to load form.',
    notFound:'Form not found.',
    saveForm:'Unable to save form. Please try again.',
    saved:'Form saved successfully.',
    removed:'Form removed successfully.'
  },
  es: {
    unauthorized:'No autorizado.',
    organizationNotFound:'No se encontró la organización.',
    permissionDenied:'Permiso denegado.',
    loadForm:'No se pudo cargar el formulario.',
    notFound:'No se encontró el formulario.',
    saveForm:'No se pudo guardar el formulario. Inténtalo de nuevo.',
    saved:'Formulario guardado correctamente.',
    removed:'Formulario eliminado correctamente.'
  },
  vi: {
    unauthorized:'Không được phép.',
    organizationNotFound:'Không tìm thấy tổ chức.',
    permissionDenied:'Không có quyền.',
    loadForm:'Không thể tải biểu mẫu.',
    notFound:'Không tìm thấy biểu mẫu.',
    saveForm:'Không thể lưu biểu mẫu. Hãy thử lại.',
    saved:'Đã lưu biểu mẫu.',
    removed:'Đã xóa biểu mẫu.'
  }
};

export function getFormApiCopy(locale:Locale) {
  return COPY[locale] || COPY.en;
}
