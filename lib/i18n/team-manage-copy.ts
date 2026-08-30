export type TeamManageCopy = {
  inviteTitle: string;
  email: string;
  emailPlaceholder: string;
  role: string;
  note: string;
  notePlaceholder: string;
  sendInvite: string;
  copyLink: string;
  manager: string;
  employee: string;
  contractor: string;
  client: string;
  admin: string;
  viewer: string;
  manageAccess: string;
  active: string;
  pendingTitle: string;
  noPending: string;
  historyTitle: string;
  transferTitle: string;
  selectMember: string;
  transferButton: string;
  loading: string;
  noMembersTitle: string;
  noMembersBody: string;
  joined: string;
  lastActive: string;
  deactivate: string;
  reactivate: string;
  remove: string;
  resend: string;
  revoke: string;
  sent: string;
  expires: string;
  planGate: string;
  upgrade: string;
};

const en: TeamManageCopy = {
  inviteTitle: 'Invite by email',
  email: 'Email',
  emailPlaceholder: 'you@company.com',
  role: 'Role',
  note: 'Note (optional)',
  notePlaceholder: 'Optional message',
  sendInvite: 'Send invitation',
  copyLink: 'Copy link',
  manager: 'Manager',
  employee: 'Staff',
  contractor: 'Contractor',
  client: 'Client',
  admin: 'Admin',
  viewer: 'Viewer',
  manageAccess: 'Manage access',
  active: 'active',
  pendingTitle: 'Pending invitations',
  noPending: 'No pending invitations.',
  historyTitle: 'Invitation history',
  transferTitle: 'Transfer ownership',
  selectMember: 'Select member...',
  transferButton: 'Transfer ownership',
  loading: 'Loading team...',
  noMembersTitle: 'No members yet',
  noMembersBody: 'Invite someone to share access.',
  joined: 'Joined',
  lastActive: 'Last active',
  deactivate: 'Deactivate',
  reactivate: 'Reactivate',
  remove: 'Remove',
  resend: 'Resend',
  revoke: 'Revoke',
  sent: 'Sent',
  expires: 'Expires',
  planGate: 'Team management requires Business, Growth, or Enterprise.',
  upgrade: 'Upgrade to Business'
};

const es: TeamManageCopy = {
  inviteTitle: 'Invitar por correo',
  email: 'Correo electronico',
  emailPlaceholder: 'you@company.com',
  role: 'Rol',
  note: 'Nota (opcional)',
  notePlaceholder: 'Mensaje opcional',
  sendInvite: 'Enviar invitacion',
  copyLink: 'Copiar enlace',
  manager: 'Gerente',
  employee: 'Personal',
  contractor: 'Contratista',
  client: 'Cliente',
  admin: 'Admin',
  viewer: 'Observador',
  manageAccess: 'Gestionar acceso',
  active: 'activos',
  pendingTitle: 'Invitaciones pendientes',
  noPending: 'No hay invitaciones pendientes.',
  historyTitle: 'Historial de invitaciones',
  transferTitle: 'Transferir propiedad',
  selectMember: 'Seleccionar miembro...',
  transferButton: 'Transferir propiedad',
  loading: 'Cargando equipo...',
  noMembersTitle: 'Aun no hay miembros',
  noMembersBody: 'Invite a alguien para compartir acceso.',
  joined: 'Ingreso',
  lastActive: 'Ultima actividad',
  deactivate: 'Desactivar',
  reactivate: 'Reactivar',
  remove: 'Quitar',
  resend: 'Reenviar',
  revoke: 'Revocar',
  sent: 'Enviado',
  expires: 'Vence',
  planGate: 'La gestion de equipo requiere Business, Growth o Enterprise.',
  upgrade: 'Actualizar a Business'
};

function vi(): TeamManageCopy {
  return {
    inviteTitle: 'Mời bằng email',
    email: 'Email',
    emailPlaceholder: 'you@company.com',
    role: 'Vai trò',
    note: 'Ghi chú (tùy chọn)',
    notePlaceholder: 'Tin nhắn tùy chọn',
    sendInvite: 'Gửi lời mời',
    copyLink: 'Sao chép liên kết',
    manager: 'Quản lý',
    employee: 'Nhân viên',
    contractor: 'Nhà thầu',
    client: 'Khách',
    admin: 'Quản trị',
    viewer: 'Xem',
    manageAccess: 'Quản lý quyền',
    active: 'đang hoạt động',
    pendingTitle: 'Lời mời đang chờ',
    noPending: 'Không có lời mời đang chờ.',
    historyTitle: 'Lịch sử lời mời',
    transferTitle: 'Chuyển quyền sở hữu',
    selectMember: 'Chọn thành viên...',
    transferButton: 'Chuyển quyền sở hữu',
    loading: 'Đang tải nhóm...',
    noMembersTitle: 'Chưa có thành viên',
    noMembersBody: 'Mời ai đó để chia sẻ quyền.',
    joined: 'Đã tham gia',
    lastActive: 'Hoạt động gần nhất',
    deactivate: 'Vô hiệu',
    reactivate: 'Kích hoạt lại',
    remove: 'Gỡ',
    resend: 'Gửi lại',
    revoke: 'Thu hồi',
    sent: 'Đã gửi',
    expires: 'Hết hạn',
    planGate: 'Quản lý nhóm cần gói Business, Growth hoặc Enterprise.',
    upgrade: 'Nâng cấp Business'
  };
}

export function getTeamManageCopy(locale?: string | null): TeamManageCopy {
  const value = String(locale || 'en').toLowerCase();
  if (value.startsWith('es')) return es;
  if (value.startsWith('vi')) return vi();
  return en;
}
