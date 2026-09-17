import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  unauthorized:string;
  organizationNotFound:string;
  serverUnavailable:string;
  loadError:string;
  planRequired:string;
  nameRequired:string;
  saveError:string;
}> = {
  en:{unauthorized:'Unauthorized.',organizationNotFound:'Organization not found.',serverUnavailable:'This feature is temporarily unavailable.',loadError:'Unable to load departments.',planRequired:'Departments require Growth or Enterprise.',nameRequired:'Department name is required.',saveError:'Unable to save department.'},
  es:{unauthorized:'No autorizado.',organizationNotFound:'No se encontró la organización.',serverUnavailable:'Esta función no está disponible temporalmente.',loadError:'No se pudieron cargar los departamentos.',planRequired:'Los departamentos requieren Growth o Enterprise.',nameRequired:'El nombre del departamento es obligatorio.',saveError:'No se pudo guardar el departamento.'},
  vi:{unauthorized:'Không được phép.',organizationNotFound:'Không tìm thấy tổ chức.',serverUnavailable:'Tính năng này tạm thời không khả dụng.',loadError:'Không thể tải phòng ban.',planRequired:'Phòng ban yêu cầu gói Growth hoặc Enterprise.',nameRequired:'Tên phòng ban là bắt buộc.',saveError:'Không thể lưu phòng ban.'}
};

export function getDepartmentsApiCopy(locale: Locale) { return COPY[locale] || COPY.en; }
