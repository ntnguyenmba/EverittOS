import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  unauthorized:string;
  organizationNotFound:string;
  permissionDenied:string;
  loadTemplates:string;
  titleRequired:string;
  saveTemplate:string;
}> = {
  en: {
    unauthorized:'Unauthorized.',
    organizationNotFound:'Organization not found.',
    permissionDenied:'Permission denied.',
    loadTemplates:'Unable to load templates.',
    titleRequired:'Template title is required.',
    saveTemplate:'Unable to save template.'
  },
  es: {
    unauthorized:'No autorizado.',
    organizationNotFound:'No se encontró la organización.',
    permissionDenied:'Permiso denegado.',
    loadTemplates:'No se pudieron cargar las plantillas.',
    titleRequired:'El título de la plantilla es obligatorio.',
    saveTemplate:'No se pudo guardar la plantilla.'
  },
  vi: {
    unauthorized:'Không được phép.',
    organizationNotFound:'Không tìm thấy tổ chức.',
    permissionDenied:'Không có quyền.',
    loadTemplates:'Không thể tải mẫu.',
    titleRequired:'Tên mẫu là bắt buộc.',
    saveTemplate:'Không thể lưu mẫu.'
  }
};

export function getTemplateApiCopy(locale:Locale) {
  return COPY[locale] || COPY.en;
}
