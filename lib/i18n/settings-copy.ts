import { normalizeLocale, type Locale } from '@/lib/i18n/config';

export type SettingsWorkspaceCopy = {
  title: string;
  loading: string;
  saveError: string;
  restartError: string;
  business: string;
  businessName: string;
  phone: string;
  email: string;
  address: string;
  service: string;
  timezone: string;
  eastern: string;
  central: string;
  mountain: string;
  pacific: string;
  utc: string;
  save: string;
  integrations: string;
  quickBooks: string;
  calendarImport: string;
  businessDetails: string;
  legalName: string;
  teamName: string;
  website: string;
  bookingLink: string;
  taxId: string;
  businessType: string;
  teamSize: string;
  select: string;
  customerMessages: string;
  defaultMessage: string;
  invoiceFooter: string;
  branding: string;
  mainColor: string;
  accentColor: string;
  logo: string;
  uploadLogoAria: string;
  uploading: string;
  notifications: string;
  jobAssignments: string;
  dueDates: string;
  completedJobs: string;
  reports: string;
  languageSetup: string;
  restartSetup: string;
  setupChecklist: string;
  account: string;
  signedInAs: string;
  accountDetails: string;
  plansBilling: string;
  logOut: string;
  legalAdvanced: string;
  terms: string;
  privacy: string;
  cookies: string;
  disclaimer: string;
};

export type WorkspaceDeleteCopy = {
  title: string;
  scheduled: string;
  restoreWithin: string;
  beforeDate: string;
  restoreCompany: string;
  deletesAfter: string;
  cancelSubscriptionFirst: string;
  deleteCompany: string;
  confirmTitle: string;
  reviewRemoved: string;
  customers: string;
  jobs: string;
  leads: string;
  invoices: string;
  bookings: string;
  files: string;
  teamMembers: string;
  typeName: string;
  cancel: string;
  scheduleDeletion: string;
  loadError: string;
  deleteError: string;
  restoreError: string;
  scheduledSuccess: string;
  restoredSuccess: string;
};

export type SettingsBillingUiCopy = {
  loading: string;
  activating: string;
  unableOpenPortal: string;
  notScheduled: string;
  currentPlan: string;
  accountStatus: string;
  planAccess: string;
  active: string;
  actionNeeded: string;
  restoring: string;
  restorePurchases: string;
  unableOpenManagement: string;
  refreshing: string;
  unableRefreshStatus: string;
  statusRefreshed: string;
  refreshStatus: string;
  subscriptionActivated: string;
  ownersOnly: string;
  upgradeRequired: string;
  subscription: string;
  renewal: string;
  opening: string;
  manageBilling: string;
  cancelPlan: string;
  activeDiscount: string;
  discount: string;
  code: string;
  savings: string;
  expires: string;
  choosePlan: string;
  choosePlanBody: string;
};

export type NativeStoreSubscribeCopy = {
  availableForPlans: string;
  subscribeApple: string;
  subscribeGoogle: string;
  activated: string;
  storePrice: string;
  processing: string;
  chargedToApple: string;
  chargedToGoogle: string;
  manageApple: string;
  manageGoogle: string;
  terms: string;
  privacy: string;
};

export type SyncSubscriptionCopy = {
  checking: string;
  synced: string;
  noMapping: string;
  activateFailed: string;
  unable: string;
  syncing: string;
  sync: string;
};

const settingsEn: SettingsWorkspaceCopy = {
  title: 'Settings',
  loading: 'Loading…',
  saveError: 'Unable to save settings.',
  restartError: 'Unable to restart onboarding.',
  business: 'Business',
  businessName: 'Business name',
  phone: 'Phone',
  email: 'Email',
  address: 'Address',
  service: 'Service',
  timezone: 'Timezone',
  eastern: 'Eastern (US)',
  central: 'Central (US)',
  mountain: 'Mountain (US)',
  pacific: 'Pacific (US)',
  utc: 'UTC',
  save: 'Save',
  integrations: 'Integrations',
  quickBooks: 'QuickBooks',
  calendarImport: 'Calendar Import',
  businessDetails: 'Business details',
  legalName: 'Legal name',
  teamName: 'Team name',
  website: 'Website',
  bookingLink: 'Booking link',
  taxId: 'Tax ID',
  businessType: 'Business type',
  teamSize: 'Team size',
  select: 'Select',
  customerMessages: 'Customer messages & invoices',
  defaultMessage: 'Default message',
  invoiceFooter: 'Invoice footer',
  branding: 'Branding',
  mainColor: 'Main color',
  accentColor: 'Accent color',
  logo: 'Logo',
  uploadLogoAria: 'Upload organization logo',
  uploading: 'Uploading…',
  notifications: 'Notifications',
  jobAssignments: 'Job assignments',
  dueDates: 'Due dates',
  completedJobs: 'Completed jobs',
  reports: 'Reports',
  languageSetup: 'Language & setup',
  restartSetup: 'Restart setup',
  setupChecklist: 'Setup checklist',
  account: 'Account',
  signedInAs: 'Signed in as {email}',
  accountDetails: 'Account details',
  plansBilling: 'Plans & billing',
  logOut: 'Log out',
  legalAdvanced: 'Legal & advanced',
  terms: 'Terms',
  privacy: 'Privacy',
  cookies: 'Cookies',
  disclaimer: 'Disclaimer'
};

const settingsEs: SettingsWorkspaceCopy = {
  title: 'Configuración',
  loading: 'Cargando…',
  saveError: 'No se pudo guardar la configuración.',
  restartError: 'No se pudo reiniciar la configuración inicial.',
  business: 'Negocio',
  businessName: 'Nombre del negocio',
  phone: 'Teléfono',
  email: 'Correo electrónico',
  address: 'Dirección',
  service: 'Servicio',
  timezone: 'Zona horaria',
  eastern: 'Este (EE. UU.)',
  central: 'Central (EE. UU.)',
  mountain: 'Montaña (EE. UU.)',
  pacific: 'Pacífico (EE. UU.)',
  utc: 'UTC',
  save: 'Guardar',
  integrations: 'Integraciones',
  quickBooks: 'QuickBooks',
  calendarImport: 'Importación de calendario',
  businessDetails: 'Detalles del negocio',
  legalName: 'Nombre legal',
  teamName: 'Nombre del equipo',
  website: 'Sitio web',
  bookingLink: 'Enlace de reservas',
  taxId: 'ID fiscal',
  businessType: 'Tipo de negocio',
  teamSize: 'Tamaño del equipo',
  select: 'Seleccionar',
  customerMessages: 'Mensajes al cliente y facturas',
  defaultMessage: 'Mensaje predeterminado',
  invoiceFooter: 'Pie de factura',
  branding: 'Marca',
  mainColor: 'Color principal',
  accentColor: 'Color de acento',
  logo: 'Logotipo',
  uploadLogoAria: 'Subir logotipo de la organización',
  uploading: 'Subiendo…',
  notifications: 'Notificaciones',
  jobAssignments: 'Asignaciones de trabajos',
  dueDates: 'Fechas de vencimiento',
  completedJobs: 'Trabajos completados',
  reports: 'Informes',
  languageSetup: 'Idioma y configuración',
  restartSetup: 'Reiniciar configuración',
  setupChecklist: 'Lista de configuración',
  account: 'Cuenta',
  signedInAs: 'Sesión iniciada como {email}',
  accountDetails: 'Detalles de la cuenta',
  plansBilling: 'Planes y facturación',
  logOut: 'Cerrar sesión',
  legalAdvanced: 'Legal y avanzado',
  terms: 'Términos',
  privacy: 'Privacidad',
  cookies: 'Cookies',
  disclaimer: 'Aviso legal'
};

const settingsVi: SettingsWorkspaceCopy = {
  title: 'Cài đặt',
  loading: 'Đang tải…',
  saveError: 'Không thể lưu cài đặt.',
  restartError: 'Không thể khởi động lại thiết lập.',
  business: 'Doanh nghiệp',
  businessName: 'Tên doanh nghiệp',
  phone: 'Điện thoại',
  email: 'Email',
  address: 'Địa chỉ',
  service: 'Dịch vụ',
  timezone: 'Múi giờ',
  eastern: 'Miền Đông (Mỹ)',
  central: 'Miền Trung (Mỹ)',
  mountain: 'Miền Núi (Mỹ)',
  pacific: 'Thái Bình Dương (Mỹ)',
  utc: 'UTC',
  save: 'Lưu',
  integrations: 'Tích hợp',
  quickBooks: 'QuickBooks',
  calendarImport: 'Nhập lịch',
  businessDetails: 'Chi tiết doanh nghiệp',
  legalName: 'Tên pháp lý',
  teamName: 'Tên nhóm',
  website: 'Trang web',
  bookingLink: 'Liên kết đặt lịch',
  taxId: 'Mã số thuế',
  businessType: 'Loại hình kinh doanh',
  teamSize: 'Quy mô nhóm',
  select: 'Chọn',
  customerMessages: 'Tin nhắn khách hàng và hóa đơn',
  defaultMessage: 'Tin nhắn mặc định',
  invoiceFooter: 'Chân hóa đơn',
  branding: 'Thương hiệu',
  mainColor: 'Màu chính',
  accentColor: 'Màu nhấn',
  logo: 'Logo',
  uploadLogoAria: 'Tải lên logo tổ chức',
  uploading: 'Đang tải lên…',
  notifications: 'Thông báo',
  jobAssignments: 'Phân công công việc',
  dueDates: 'Ngày đến hạn',
  completedJobs: 'Công việc đã hoàn thành',
  reports: 'Báo cáo',
  languageSetup: 'Ngôn ngữ và thiết lập',
  restartSetup: 'Khởi động lại thiết lập',
  setupChecklist: 'Danh sách thiết lập',
  account: 'Tài khoản',
  signedInAs: 'Đăng nhập với {email}',
  accountDetails: 'Chi tiết tài khoản',
  plansBilling: 'Gói và thanh toán',
  logOut: 'Đăng xuất',
  legalAdvanced: 'Pháp lý và nâng cao',
  terms: 'Điều khoản',
  privacy: 'Quyền riêng tư',
  cookies: 'Cookie',
  disclaimer: 'Tuyên bố miễn trừ'
};

const workspaceDeleteByLocale: Record<Locale, WorkspaceDeleteCopy> = {
  en: {
    title: 'Delete company',
    scheduled: 'This company is scheduled for deletion.',
    restoreWithin: 'Restore it within {days} days',
    beforeDate: ', before {date}',
    restoreCompany: 'Restore company',
    deletesAfter: 'Deletes the company after a {days}-day recovery period.',
    cancelSubscriptionFirst: 'The active subscription will be canceled first.',
    deleteCompany: 'Delete company',
    confirmTitle: 'Delete company?',
    reviewRemoved: 'This will schedule {name} for deletion. Review what will be removed:',
    customers: 'customers',
    jobs: 'jobs',
    leads: 'leads',
    invoices: 'invoices',
    bookings: 'bookings',
    files: 'uploaded files',
    teamMembers: 'team members',
    typeName: 'Type the company name to continue',
    cancel: 'Cancel',
    scheduleDeletion: 'Schedule deletion',
    loadError: 'Unable to load company deletion details.',
    deleteError: 'Unable to delete company.',
    restoreError: 'Unable to restore company.',
    scheduledSuccess: 'This company is scheduled for deletion.',
    restoredSuccess: 'Company deletion canceled. Your company has been restored.'
  },
  es: {
    title: 'Eliminar empresa',
    scheduled: 'Esta empresa está programada para eliminación.',
    restoreWithin: 'Restáurela dentro de {days} días',
    beforeDate: ', antes del {date}',
    restoreCompany: 'Restaurar empresa',
    deletesAfter: 'Elimina la empresa después de un período de recuperación de {days} días.',
    cancelSubscriptionFirst: 'Primero se cancelará la suscripción activa.',
    deleteCompany: 'Eliminar empresa',
    confirmTitle: '¿Eliminar empresa?',
    reviewRemoved: 'Esto programará la eliminación de {name}. Revise lo que se eliminará:',
    customers: 'clientes',
    jobs: 'trabajos',
    leads: 'prospectos',
    invoices: 'facturas',
    bookings: 'reservas',
    files: 'archivos subidos',
    teamMembers: 'miembros del equipo',
    typeName: 'Escriba el nombre de la empresa para continuar',
    cancel: 'Cancelar',
    scheduleDeletion: 'Programar eliminación',
    loadError: 'No se pudieron cargar los detalles de eliminación de la empresa.',
    deleteError: 'No se pudo eliminar la empresa.',
    restoreError: 'No se pudo restaurar la empresa.',
    scheduledSuccess: 'Esta empresa está programada para eliminación.',
    restoredSuccess: 'Se canceló la eliminación. Su empresa ha sido restaurada.'
  },
  vi: {
    title: 'Xóa công ty',
    scheduled: 'Công ty này đã được lên lịch xóa.',
    restoreWithin: 'Khôi phục trong vòng {days} ngày',
    beforeDate: ', trước ngày {date}',
    restoreCompany: 'Khôi phục công ty',
    deletesAfter: 'Xóa công ty sau thời gian khôi phục {days} ngày.',
    cancelSubscriptionFirst: 'Gói đăng ký đang hoạt động sẽ bị hủy trước.',
    deleteCompany: 'Xóa công ty',
    confirmTitle: 'Xóa công ty?',
    reviewRemoved: 'Thao tác này sẽ lên lịch xóa {name}. Xem những gì sẽ bị gỡ bỏ:',
    customers: 'khách hàng',
    jobs: 'công việc',
    leads: 'khách tiềm năng',
    invoices: 'hóa đơn',
    bookings: 'đặt lịch',
    files: 'tệp đã tải lên',
    teamMembers: 'thành viên nhóm',
    typeName: 'Nhập tên công ty để tiếp tục',
    cancel: 'Hủy',
    scheduleDeletion: 'Lên lịch xóa',
    loadError: 'Không thể tải chi tiết xóa công ty.',
    deleteError: 'Không thể xóa công ty.',
    restoreError: 'Không thể khôi phục công ty.',
    scheduledSuccess: 'Công ty này đã được lên lịch xóa.',
    restoredSuccess: 'Đã hủy xóa công ty. Công ty của bạn đã được khôi phục.'
  }
};

const billingUiByLocale: Record<Locale, SettingsBillingUiCopy> = {
  en: {
    loading: 'Loading billing…',
    activating: 'Activating your plan…',
    unableOpenPortal: 'Unable to open billing portal.',
    notScheduled: 'Not scheduled',
    currentPlan: 'Current plan',
    accountStatus: 'Account status',
    planAccess: 'Plan access',
    active: 'Active',
    actionNeeded: 'Action needed',
    restoring: 'Restoring…',
    restorePurchases: 'Restore Purchases',
    unableOpenManagement: 'Unable to open subscription management.',
    refreshing: 'Refreshing…',
    unableRefreshStatus: 'Unable to refresh subscription status.',
    statusRefreshed: 'Subscription status refreshed.',
    refreshStatus: 'Refresh Subscription Status',
    subscriptionActivated: 'Subscription activated.',
    ownersOnly: 'Only workspace owners and admins can change the subscription.',
    upgradeRequired: '{plan} or higher is required for that page. Choose a plan below to upgrade.',
    subscription: 'Subscription',
    renewal: 'Renewal',
    opening: 'Opening…',
    manageBilling: 'Manage billing',
    cancelPlan: 'Cancel plan',
    activeDiscount: 'Active discount',
    discount: 'Discount',
    code: 'Code',
    savings: 'Savings',
    expires: 'Expires',
    choosePlan: 'Choose your plan',
    choosePlanBody: 'Upgrade, switch, or review available plans.'
  },
  es: {
    loading: 'Cargando facturación…',
    activating: 'Activando su plan…',
    unableOpenPortal: 'No se pudo abrir el portal de facturación.',
    notScheduled: 'No programado',
    currentPlan: 'Plan actual',
    accountStatus: 'Estado de la cuenta',
    planAccess: 'Acceso al plan',
    active: 'Activo',
    actionNeeded: 'Acción necesaria',
    restoring: 'Restaurando…',
    restorePurchases: 'Restaurar compras',
    unableOpenManagement: 'No se pudo abrir la administración de suscripciones.',
    refreshing: 'Actualizando…',
    unableRefreshStatus: 'No se pudo actualizar el estado de la suscripción.',
    statusRefreshed: 'Estado de la suscripción actualizado.',
    refreshStatus: 'Actualizar estado de suscripción',
    subscriptionActivated: 'Suscripción activada.',
    ownersOnly: 'Solo los propietarios y administradores pueden cambiar la suscripción.',
    upgradeRequired: 'Se requiere {plan} o superior para esa página. Elija un plan abajo para actualizar.',
    subscription: 'Suscripción',
    renewal: 'Renovación',
    opening: 'Abriendo…',
    manageBilling: 'Administrar facturación',
    cancelPlan: 'Cancelar plan',
    activeDiscount: 'Descuento activo',
    discount: 'Descuento',
    code: 'Código',
    savings: 'Ahorro',
    expires: 'Vence',
    choosePlan: 'Elija su plan',
    choosePlanBody: 'Actualice, cambie o revise los planes disponibles.'
  },
  vi: {
    loading: 'Đang tải thanh toán…',
    activating: 'Đang kích hoạt gói của bạn…',
    unableOpenPortal: 'Không thể mở cổng thanh toán.',
    notScheduled: 'Chưa lên lịch',
    currentPlan: 'Gói hiện tại',
    accountStatus: 'Trạng thái tài khoản',
    planAccess: 'Quyền truy cập gói',
    active: 'Đang hoạt động',
    actionNeeded: 'Cần thao tác',
    restoring: 'Đang khôi phục…',
    restorePurchases: 'Khôi phục giao dịch mua',
    unableOpenManagement: 'Không thể mở quản lý gói đăng ký.',
    refreshing: 'Đang làm mới…',
    unableRefreshStatus: 'Không thể làm mới trạng thái gói đăng ký.',
    statusRefreshed: 'Đã làm mới trạng thái gói đăng ký.',
    refreshStatus: 'Làm mới trạng thái gói đăng ký',
    subscriptionActivated: 'Đã kích hoạt gói đăng ký.',
    ownersOnly: 'Chỉ chủ sở hữu và quản trị viên không gian làm việc mới có thể thay đổi gói đăng ký.',
    upgradeRequired: 'Trang đó yêu cầu {plan} trở lên. Chọn một gói bên dưới để nâng cấp.',
    subscription: 'Gói đăng ký',
    renewal: 'Gia hạn',
    opening: 'Đang mở…',
    manageBilling: 'Quản lý thanh toán',
    cancelPlan: 'Hủy gói',
    activeDiscount: 'Giảm giá đang áp dụng',
    discount: 'Giảm giá',
    code: 'Mã',
    savings: 'Tiết kiệm',
    expires: 'Hết hạn',
    choosePlan: 'Chọn gói của bạn',
    choosePlanBody: 'Nâng cấp, chuyển đổi hoặc xem các gói có sẵn.'
  }
};

const nativeStoreByLocale: Record<Locale, NativeStoreSubscribeCopy> = {
  en: {
    availableForPlans: '{store} is available for Pro and Business.',
    subscribeApple: 'Subscribe with Apple',
    subscribeGoogle: 'Subscribe with Google Play',
    activated: 'Subscription activated.',
    storePrice: 'Store price: {price} · auto-renews monthly until cancelled',
    processing: 'Processing…',
    chargedToApple: 'Payment will be charged to your Apple ID account.',
    chargedToGoogle: 'Payment will be charged to your Google Play account.',
    manageApple: 'Manage or cancel in Settings → Subscriptions.',
    manageGoogle: 'Manage or cancel in Google Play → Subscriptions.',
    terms: 'Terms',
    privacy: 'Privacy'
  },
  es: {
    availableForPlans: '{store} está disponible para Pro y Business.',
    subscribeApple: 'Suscribirse con Apple',
    subscribeGoogle: 'Suscribirse con Google Play',
    activated: 'Suscripción activada.',
    storePrice: 'Precio de la tienda: {price} · se renueva mensualmente hasta cancelar',
    processing: 'Procesando…',
    chargedToApple: 'El pago se cargará a su cuenta de Apple ID.',
    chargedToGoogle: 'El pago se cargará a su cuenta de Google Play.',
    manageApple: 'Administre o cancele en Ajustes → Suscripciones.',
    manageGoogle: 'Administre o cancele en Google Play → Suscripciones.',
    terms: 'Términos',
    privacy: 'Privacidad'
  },
  vi: {
    availableForPlans: '{store} khả dụng cho Pro và Business.',
    subscribeApple: 'Đăng ký bằng Apple',
    subscribeGoogle: 'Đăng ký bằng Google Play',
    activated: 'Đã kích hoạt gói đăng ký.',
    storePrice: 'Giá cửa hàng: {price} · tự gia hạn hàng tháng cho đến khi hủy',
    processing: 'Đang xử lý…',
    chargedToApple: 'Thanh toán sẽ được trừ vào tài khoản Apple ID của bạn.',
    chargedToGoogle: 'Thanh toán sẽ được trừ vào tài khoản Google Play của bạn.',
    manageApple: 'Quản lý hoặc hủy trong Cài đặt → Đăng ký.',
    manageGoogle: 'Quản lý hoặc hủy trong Google Play → Đăng ký.',
    terms: 'Điều khoản',
    privacy: 'Quyền riêng tư'
  }
};

const syncByLocale: Record<Locale, SyncSubscriptionCopy> = {
  en: {
    checking: 'Checking Stripe for your active subscription…',
    synced: 'Subscription synced. Your plan is now {plan}.',
    noMapping:
      'No paid Stripe subscription could be mapped to your EverittOS account. Confirm the Stripe customer email matches your login email.',
    activateFailed:
      'Payment was received, but EverittOS could not activate the subscription. See billing diagnostics for write details.',
    unable: 'Unable to sync subscription right now. Please try again in a minute.',
    syncing: 'Syncing…',
    sync: 'Sync subscription'
  },
  es: {
    checking: 'Comprobando en Stripe su suscripción activa…',
    synced: 'Suscripción sincronizada. Su plan ahora es {plan}.',
    noMapping:
      'No se pudo vincular una suscripción de pago de Stripe a su cuenta de EverittOS. Confirme que el correo del cliente de Stripe coincida con su correo de inicio de sesión.',
    activateFailed:
      'Se recibió el pago, pero EverittOS no pudo activar la suscripción. Revise el diagnóstico de facturación para más detalles.',
    unable: 'No se puede sincronizar la suscripción ahora. Inténtelo de nuevo en un minuto.',
    syncing: 'Sincronizando…',
    sync: 'Sincronizar suscripción'
  },
  vi: {
    checking: 'Đang kiểm tra gói đăng ký đang hoạt động trên Stripe…',
    synced: 'Đã đồng bộ gói đăng ký. Gói hiện tại của bạn là {plan}.',
    noMapping:
      'Không thể ánh xạ gói đăng ký Stripe trả phí với tài khoản EverittOS. Hãy xác nhận email khách hàng Stripe khớp với email đăng nhập.',
    activateFailed:
      'Đã nhận thanh toán nhưng EverittOS không thể kích hoạt gói đăng ký. Xem chẩn đoán thanh toán để biết chi tiết.',
    unable: 'Hiện không thể đồng bộ gói đăng ký. Vui lòng thử lại sau một phút.',
    syncing: 'Đang đồng bộ…',
    sync: 'Đồng bộ gói đăng ký'
  }
};

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export function getSettingsWorkspaceCopy(locale?: string | null): SettingsWorkspaceCopy {
  const normalized = normalizeLocale(locale);
  if (normalized === 'es') return settingsEs;
  if (normalized === 'vi') return settingsVi;
  return settingsEn;
}

export function formatSettingsCopy(template: string, values: Record<string, string | number>): string {
  return fill(template, values);
}

export function getWorkspaceDeleteCopy(locale?: string | null): WorkspaceDeleteCopy {
  return workspaceDeleteByLocale[normalizeLocale(locale)];
}

export function getSettingsBillingUiCopy(locale?: string | null): SettingsBillingUiCopy {
  return billingUiByLocale[normalizeLocale(locale)];
}

export function getNativeStoreSubscribeCopy(locale?: string | null): NativeStoreSubscribeCopy {
  return nativeStoreByLocale[normalizeLocale(locale)];
}

export function getSyncSubscriptionCopy(locale?: string | null): SyncSubscriptionCopy {
  return syncByLocale[normalizeLocale(locale)];
}

export function formatSettingsBillingCopy(template: string, values: Record<string, string | number>): string {
  return fill(template, values);
}
