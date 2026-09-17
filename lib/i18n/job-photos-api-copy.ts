import type { Locale } from '@/lib/i18n/config';

type JobPhotosApiCopy = {
  invalidJobId: string;
  unauthorized: string;
  loadError: string;
  photoIdRequired: string;
  organizationNotFound: string;
  serverUnavailable: string;
  jobNotFound: string;
  photoNotFound: string;
  permissionDenied: string;
  deleteError: string;
  teamMember: string;
};

const COPY: Record<Locale, JobPhotosApiCopy> = {
  en: {
    invalidJobId: 'Invalid job ID.',
    unauthorized: 'Unauthorized.',
    loadError: 'Unable to load job photos.',
    photoIdRequired: 'A valid photo ID is required.',
    organizationNotFound: 'Organization not found.',
    serverUnavailable: 'This feature is temporarily unavailable.',
    jobNotFound: 'Job not found.',
    photoNotFound: 'Photo not found.',
    permissionDenied: 'Permission denied.',
    deleteError: 'Unable to delete the photo.',
    teamMember: 'Team member'
  },
  es: {
    invalidJobId: 'El ID del trabajo no es válido.',
    unauthorized: 'No autorizado.',
    loadError: 'No se pudieron cargar las fotos del trabajo.',
    photoIdRequired: 'Se requiere un ID de foto válido.',
    organizationNotFound: 'No se encontró la organización.',
    serverUnavailable: 'Esta función no está disponible temporalmente.',
    jobNotFound: 'No se encontró el trabajo.',
    photoNotFound: 'No se encontró la foto.',
    permissionDenied: 'Permiso denegado.',
    deleteError: 'No se pudo eliminar la foto.',
    teamMember: 'Miembro del equipo'
  },
  vi: {
    invalidJobId: 'ID công việc không hợp lệ.',
    unauthorized: 'Không được phép.',
    loadError: 'Không thể tải ảnh công việc.',
    photoIdRequired: 'Cần có ID ảnh hợp lệ.',
    organizationNotFound: 'Không tìm thấy tổ chức.',
    serverUnavailable: 'Tính năng này tạm thời không khả dụng.',
    jobNotFound: 'Không tìm thấy công việc.',
    photoNotFound: 'Không tìm thấy ảnh.',
    permissionDenied: 'Không có quyền.',
    deleteError: 'Không thể xóa ảnh.',
    teamMember: 'Thành viên nhóm'
  }
};

export function getJobPhotosApiCopy(locale: Locale) {
  return COPY[locale] || COPY.en;
}
