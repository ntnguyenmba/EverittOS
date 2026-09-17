import type { Locale } from '@/lib/i18n/config';

type TeamInviteApiCopy = {
  unauthorized: string;
  serverUnavailable: string;
  permissionDenied: string;
  emailRequired: string;
  invalidRole: string;
  ownerOnlyAdmin: string;
  teamLimit: string;
  saveError: string;
  verifyError: string;
  invitationIdRequired: string;
  invitationNotFound: string;
  sent: (email: string) => string;
  manualSend: (email: string) => string;
  resent: (email: string) => string;
  stillActive: (email: string) => string;
  waitForAcceptance: string;
  copyLink: string;
  teamMember: string;
};

const COPY: Record<Locale, TeamInviteApiCopy> = {
  en: {
    unauthorized: 'Unauthorized.',
    serverUnavailable: 'This feature is temporarily unavailable.',
    permissionDenied: 'Permission denied.',
    emailRequired: 'Email is required.',
    invalidRole: 'Invalid role for invitation.',
    ownerOnlyAdmin: 'Only the owner can invite admins.',
    teamLimit: 'Team member limit reached for this plan.',
    saveError: 'Invitation could not be saved.',
    verifyError: 'Invitation was created but could not be verified. Please try sending it again.',
    invitationIdRequired: 'Invitation ID is required.',
    invitationNotFound: 'Invitation not found or already used.',
    sent: (email) => `Invitation email sent successfully to ${email}. They must open the email, sign in with that same address, and accept the invitation.`,
    manualSend: (email) => `Invitation created, but the email was not sent. Copy the invite link and send it manually to ${email}.`,
    resent: (email) => `Invitation email resent successfully to ${email}.`,
    stillActive: (email) => `Invitation is still active, but the email was not sent. Copy the invite link and send it manually to ${email}.`,
    waitForAcceptance: 'Wait for the invitee to accept the invitation.',
    copyLink: 'Use the Copy link button and send the invitation link manually.',
    teamMember: 'Team member'
  },
  es: {
    unauthorized: 'No autorizado.',
    serverUnavailable: 'Esta función no está disponible temporalmente.',
    permissionDenied: 'Permiso denegado.',
    emailRequired: 'El correo electrónico es obligatorio.',
    invalidRole: 'El rol de la invitación no es válido.',
    ownerOnlyAdmin: 'Solo el propietario puede invitar administradores.',
    teamLimit: 'Se alcanzó el límite de miembros del equipo para este plan.',
    saveError: 'No se pudo guardar la invitación.',
    verifyError: 'La invitación se creó, pero no se pudo verificar. Intenta enviarla de nuevo.',
    invitationIdRequired: 'El ID de la invitación es obligatorio.',
    invitationNotFound: 'No se encontró la invitación o ya fue utilizada.',
    sent: (email) => `La invitación se envió correctamente a ${email}. Debe abrir el correo, iniciar sesión con esa misma dirección y aceptar la invitación.`,
    manualSend: (email) => `La invitación se creó, pero el correo no se envió. Copia el enlace de invitación y envíalo manualmente a ${email}.`,
    resent: (email) => `La invitación se volvió a enviar correctamente a ${email}.`,
    stillActive: (email) => `La invitación sigue activa, pero el correo no se envió. Copia el enlace y envíalo manualmente a ${email}.`,
    waitForAcceptance: 'Espera a que la persona acepte la invitación.',
    copyLink: 'Usa el botón Copiar enlace y envía el enlace de invitación manualmente.',
    teamMember: 'Miembro del equipo'
  },
  vi: {
    unauthorized: 'Không được phép.',
    serverUnavailable: 'Tính năng này tạm thời không khả dụng.',
    permissionDenied: 'Không có quyền.',
    emailRequired: 'Email là bắt buộc.',
    invalidRole: 'Vai trò mời không hợp lệ.',
    ownerOnlyAdmin: 'Chỉ chủ sở hữu mới có thể mời quản trị viên.',
    teamLimit: 'Đã đạt giới hạn thành viên nhóm của gói này.',
    saveError: 'Không thể lưu lời mời.',
    verifyError: 'Lời mời đã được tạo nhưng không thể xác minh. Hãy thử gửi lại.',
    invitationIdRequired: 'ID lời mời là bắt buộc.',
    invitationNotFound: 'Không tìm thấy lời mời hoặc lời mời đã được sử dụng.',
    sent: (email) => `Email mời đã được gửi thành công đến ${email}. Người được mời cần mở email, đăng nhập bằng đúng địa chỉ đó và chấp nhận lời mời.`,
    manualSend: (email) => `Lời mời đã được tạo nhưng email chưa được gửi. Hãy sao chép liên kết mời và gửi thủ công đến ${email}.`,
    resent: (email) => `Email mời đã được gửi lại thành công đến ${email}.`,
    stillActive: (email) => `Lời mời vẫn còn hiệu lực nhưng email chưa được gửi. Hãy sao chép liên kết và gửi thủ công đến ${email}.`,
    waitForAcceptance: 'Chờ người được mời chấp nhận lời mời.',
    copyLink: 'Dùng nút Sao chép liên kết và gửi liên kết mời thủ công.',
    teamMember: 'Thành viên nhóm'
  }
};

export function getTeamInviteApiCopy(locale: Locale) {
  return COPY[locale] || COPY.en;
}
