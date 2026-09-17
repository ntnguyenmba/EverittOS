import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  unauthorized:string;
  workspaceNotFound:string;
  permissionDenied:string;
  userIdRequired:string;
  memberNotFound:string;
  invalidRole:string;
  ownerOnlyAdmin:string;
  loadError:string;
  saveError:string;
  removeError:string;
}> = {
  en:{unauthorized:'Unauthorized.',workspaceNotFound:'Workspace not found.',permissionDenied:'Permission denied.',userIdRequired:'User ID is required.',memberNotFound:'Team member not found.',invalidRole:'Invalid role. Use transfer ownership to change the owner.',ownerOnlyAdmin:'Only the owner can assign the admin role.',loadError:'Unable to load team members.',saveError:'Unable to update team member.',removeError:'Unable to remove team member.'},
  es:{unauthorized:'No autorizado.',workspaceNotFound:'No se encontró el espacio de trabajo.',permissionDenied:'Permiso denegado.',userIdRequired:'El ID de usuario es obligatorio.',memberNotFound:'No se encontró al miembro del equipo.',invalidRole:'Rol no válido. Usa la transferencia de propiedad para cambiar al propietario.',ownerOnlyAdmin:'Solo el propietario puede asignar el rol de administrador.',loadError:'No se pudieron cargar los miembros del equipo.',saveError:'No se pudo actualizar al miembro del equipo.',removeError:'No se pudo eliminar al miembro del equipo.'},
  vi:{unauthorized:'Không được phép.',workspaceNotFound:'Không tìm thấy không gian làm việc.',permissionDenied:'Không có quyền.',userIdRequired:'ID người dùng là bắt buộc.',memberNotFound:'Không tìm thấy thành viên nhóm.',invalidRole:'Vai trò không hợp lệ. Hãy dùng chuyển quyền sở hữu để đổi chủ sở hữu.',ownerOnlyAdmin:'Chỉ chủ sở hữu mới có thể gán vai trò quản trị viên.',loadError:'Không thể tải thành viên nhóm.',saveError:'Không thể cập nhật thành viên nhóm.',removeError:'Không thể xóa thành viên nhóm.'}
};

export function getTeamMembersApiCopy(locale: Locale) { return COPY[locale] || COPY.en; }
