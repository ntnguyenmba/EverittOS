import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  unauthorized:string;
  organizationNotFound:string;
  permissionDenied:string;
  serverUnavailable:string;
  loadError:string;
  planRequired:string;
  nameRequired:string;
  saveError:string;
  departmentNotFound:string;
  userIdRequired:string;
  inactiveMember:string;
  membershipSaveError:string;
}> = {
  en:{unauthorized:'Unauthorized.',organizationNotFound:'Organization not found.',permissionDenied:'Permission denied.',serverUnavailable:'This feature is temporarily unavailable.',loadError:'Unable to load departments.',planRequired:'Departments require Growth or Enterprise.',nameRequired:'Department name is required.',saveError:'Unable to save department.',departmentNotFound:'Department not found.',userIdRequired:'User ID is required.',inactiveMember:'This user is not an active member of this organization.',membershipSaveError:'Unable to update department membership.'},
  es:{unauthorized:'No autorizado.',organizationNotFound:'No se encontró la organización.',permissionDenied:'Permiso denegado.',serverUnavailable:'Esta función no está disponible temporalmente.',loadError:'No se pudieron cargar los departamentos.',planRequired:'Los departamentos requieren Growth o Enterprise.',nameRequired:'El nombre del departamento es obligatorio.',saveError:'No se pudo guardar el departamento.',departmentNotFound:'No se encontró el departamento.',userIdRequired:'El ID de usuario es obligatorio.',inactiveMember:'Este usuario no es un miembro activo de esta organización.',membershipSaveError:'No se pudo actualizar la membresía del departamento.'},
  vi:{unauthorized:'Không được phép.',organizationNotFound:'Không tìm thấy tổ chức.',permissionDenied:'Không có quyền.',serverUnavailable:'Tính năng này tạm thời không khả dụng.',loadError:'Không thể tải phòng ban.',planRequired:'Phòng ban yêu cầu gói Growth hoặc Enterprise.',nameRequired:'Tên phòng ban là bắt buộc.',saveError:'Không thể lưu phòng ban.',departmentNotFound:'Không tìm thấy phòng ban.',userIdRequired:'ID người dùng là bắt buộc.',inactiveMember:'Người dùng này không phải là thành viên đang hoạt động của tổ chức.',membershipSaveError:'Không thể cập nhật thành viên phòng ban.'}
};

export function getDepartmentsApiCopy(locale: Locale) { return COPY[locale] || COPY.en; }
