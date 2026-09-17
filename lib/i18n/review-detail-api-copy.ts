import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  unauthorized:string;
  permissionDenied:string;
  notFound:string;
  saveError:string;
  deleteError:string;
  removed:string;
}> = {
  en:{unauthorized:'Unauthorized.',permissionDenied:'Permission denied.',notFound:'Review request not found.',saveError:'Unable to update review request.',deleteError:'Unable to remove review request.',removed:'Review removed successfully.'},
  es:{unauthorized:'No autorizado.',permissionDenied:'Permiso denegado.',notFound:'No se encontró la solicitud de reseña.',saveError:'No se pudo actualizar la solicitud de reseña.',deleteError:'No se pudo eliminar la solicitud de reseña.',removed:'Reseña eliminada correctamente.'},
  vi:{unauthorized:'Không được phép.',permissionDenied:'Không có quyền.',notFound:'Không tìm thấy yêu cầu đánh giá.',saveError:'Không thể cập nhật yêu cầu đánh giá.',deleteError:'Không thể xóa yêu cầu đánh giá.',removed:'Đã xóa đánh giá.'}
};

export function getReviewDetailApiCopy(locale: Locale) { return COPY[locale] || COPY.en; }
