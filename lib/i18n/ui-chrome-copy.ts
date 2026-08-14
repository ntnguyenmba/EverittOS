import { normalizeLocale, type Locale } from '@/lib/i18n/config';

export type AiUpgradeCopy = {
  askEveritt: string;
  unavailable: string;
  close: string;
  everittAi: string;
  body: string;
  viewPlans: string;
  notNow: string;
};

export type PasskeyManagerCopy = {
  addError: string;
  added: string;
  removeConfirm: string;
  removeError: string;
  removed: string;
  unavailable: string;
  description: string;
  working: string;
  add: string;
  loading: string;
  empty: string;
  defaultName: string;
  addedOn: string;
  remove: string;
};

export type PasskeySetupCopy = {
  aria: string;
  title: string;
  body: string;
  enable: string;
  notNow: string;
};

export type SessionIdleCopy = {
  title: string;
  body: string;
  staySignedIn: string;
  signOut: string;
};

export type AccessBlockedCopy = {
  openBilling: string;
  hideDetails: string;
  details: string;
};

export type PermissionDeniedCopy = {
  title: string;
  defaultMessage: string;
};

export type ContractorLayoutCopy = {
  dashboard: string;
  jobs: string;
  schedule: string;
  earnings: string;
  settings: string;
  navAria: string;
  portalSubtitle: string;
  roleNote: string;
};

export type CreateCompanyCopy = {
  title: string;
  body: string;
  nameLabel: string;
  namePlaceholder: string;
  creating: string;
  create: string;
  nameRequired: string;
  createError: string;
};

const aiByLocale: Record<Locale, AiUpgradeCopy> = {
  en: {
    askEveritt: 'Ask Everitt',
    unavailable: 'This feature is unavailable for this account.',
    close: 'Close',
    everittAi: 'Everitt AI',
    body: 'Ask Everitt search is included on every plan. Everitt AI writing, summarizing, and analysis is available on Business and Enterprise plans.',
    viewPlans: 'View plans',
    notNow: 'Not now'
  },
  es: {
    askEveritt: 'Ask Everitt',
    unavailable: 'Esta función no está disponible para esta cuenta.',
    close: 'Cerrar',
    everittAi: 'Everitt AI',
    body: 'La búsqueda de Ask Everitt está incluida en todos los planes. La redacción, el resumen y el análisis de Everitt AI están disponibles en los planes Business y Enterprise.',
    viewPlans: 'Ver planes',
    notNow: 'Ahora no'
  },
  vi: {
    askEveritt: 'Ask Everitt',
    unavailable: 'Tính năng này không khả dụng cho tài khoản này.',
    close: 'Đóng',
    everittAi: 'Everitt AI',
    body: 'Tìm kiếm Ask Everitt có trong mọi gói. Viết, tóm tắt và phân tích Everitt AI có trên các gói Business và Enterprise.',
    viewPlans: 'Xem các gói',
    notNow: 'Để sau'
  }
};

const passkeyByLocale: Record<Locale, PasskeyManagerCopy> = {
  en: {
    addError: 'Unable to add passkey.',
    added: 'Passkey added.',
    removeConfirm: 'Remove this passkey? You can add a new one later.',
    removeError: 'Unable to remove passkey.',
    removed: 'Passkey removed.',
    unavailable:
      'Passkeys are not available in this browser or project. Enable passkeys in Supabase Authentication settings, then reload this page.',
    description:
      'Passkeys let you sign in with Face ID, Touch ID, Windows Hello, or a security key. They stay on your device.',
    working: 'Working…',
    add: 'Add passkey',
    loading: 'Loading passkeys…',
    empty: 'No passkeys on this account yet.',
    defaultName: 'Passkey',
    addedOn: 'Added {date}',
    remove: 'Remove'
  },
  es: {
    addError: 'No se pudo agregar la clave de acceso.',
    added: 'Clave de acceso agregada.',
    removeConfirm: '¿Eliminar esta clave de acceso? Puede agregar una nueva más tarde.',
    removeError: 'No se pudo eliminar la clave de acceso.',
    removed: 'Clave de acceso eliminada.',
    unavailable:
      'Las claves de acceso no están disponibles en este navegador o proyecto. Habilítelas en la configuración de autenticación de Supabase y vuelva a cargar esta página.',
    description:
      'Las claves de acceso le permiten iniciar sesión con Face ID, Touch ID, Windows Hello o una llave de seguridad. Permanecen en su dispositivo.',
    working: 'Trabajando…',
    add: 'Agregar clave de acceso',
    loading: 'Cargando claves de acceso…',
    empty: 'Aún no hay claves de acceso en esta cuenta.',
    defaultName: 'Clave de acceso',
    addedOn: 'Agregada el {date}',
    remove: 'Eliminar'
  },
  vi: {
    addError: 'Không thể thêm khóa truy cập.',
    added: 'Đã thêm khóa truy cập.',
    removeConfirm: 'Xóa khóa truy cập này? Bạn có thể thêm khóa mới sau.',
    removeError: 'Không thể xóa khóa truy cập.',
    removed: 'Đã xóa khóa truy cập.',
    unavailable:
      'Khóa truy cập không khả dụng trên trình duyệt hoặc dự án này. Bật khóa truy cập trong cài đặt xác thực Supabase, rồi tải lại trang.',
    description:
      'Khóa truy cập cho phép đăng nhập bằng Face ID, Touch ID, Windows Hello hoặc khóa bảo mật. Chúng lưu trên thiết bị của bạn.',
    working: 'Đang xử lý…',
    add: 'Thêm khóa truy cập',
    loading: 'Đang tải khóa truy cập…',
    empty: 'Tài khoản này chưa có khóa truy cập.',
    defaultName: 'Khóa truy cập',
    addedOn: 'Đã thêm {date}',
    remove: 'Xóa'
  }
};

const passkeySetupByLocale: Record<Locale, PasskeySetupCopy> = {
  en: {
    aria: 'Set up a passkey',
    title: 'Add a passkey?',
    body: 'Sign in faster next time with Face ID, Touch ID, or a security key.',
    enable: 'Add passkey',
    notNow: 'Not now'
  },
  es: {
    aria: 'Configurar una clave de acceso',
    title: '¿Agregar una clave de acceso?',
    body: 'Inicie sesión más rápido la próxima vez con Face ID, Touch ID o una llave de seguridad.',
    enable: 'Agregar clave de acceso',
    notNow: 'Ahora no'
  },
  vi: {
    aria: 'Thiết lập khóa truy cập',
    title: 'Thêm khóa truy cập?',
    body: 'Đăng nhập nhanh hơn lần sau bằng Face ID, Touch ID hoặc khóa bảo mật.',
    enable: 'Thêm khóa truy cập',
    notNow: 'Để sau'
  }
};

const sessionIdleByLocale: Record<Locale, SessionIdleCopy> = {
  en: {
    title: 'Still there?',
    body: 'You will be signed out soon due to inactivity. Stay signed in to continue working.',
    staySignedIn: 'Stay signed in',
    signOut: 'Sign out'
  },
  es: {
    title: '¿Sigue ahí?',
    body: 'Se cerrará su sesión pronto por inactividad. Permanezca conectado para seguir trabajando.',
    staySignedIn: 'Seguir conectado',
    signOut: 'Cerrar sesión'
  },
  vi: {
    title: 'Bạn vẫn ở đó chứ?',
    body: 'Bạn sẽ sớm bị đăng xuất vì không hoạt động. Giữ đăng nhập để tiếp tục làm việc.',
    staySignedIn: 'Tiếp tục đăng nhập',
    signOut: 'Đăng xuất'
  }
};

const accessBlockedByLocale: Record<Locale, AccessBlockedCopy> = {
  en: {
    openBilling: 'Open billing',
    hideDetails: 'Hide details',
    details: 'Details'
  },
  es: {
    openBilling: 'Abrir facturación',
    hideDetails: 'Ocultar detalles',
    details: 'Detalles'
  },
  vi: {
    openBilling: 'Mở thanh toán',
    hideDetails: 'Ẩn chi tiết',
    details: 'Chi tiết'
  }
};

const permissionDeniedByLocale: Record<Locale, PermissionDeniedCopy> = {
  en: {
    title: 'Permission denied',
    defaultMessage: 'You do not have access to this page.'
  },
  es: {
    title: 'Permiso denegado',
    defaultMessage: 'No tiene acceso a esta página.'
  },
  vi: {
    title: 'Không có quyền',
    defaultMessage: 'Bạn không có quyền truy cập trang này.'
  }
};

const contractorLayoutByLocale: Record<Locale, ContractorLayoutCopy> = {
  en: {
    dashboard: 'Dashboard',
    jobs: 'Jobs',
    schedule: 'Schedule',
    earnings: 'Earnings',
    settings: 'Settings',
    navAria: 'Worker navigation',
    portalSubtitle: 'Worker portal',
    roleNote: 'Your assigned work, schedule, and earnings in one place.'
  },
  es: {
    dashboard: 'Panel',
    jobs: 'Trabajos',
    schedule: 'Horario',
    earnings: 'Ganancias',
    settings: 'Configuración',
    navAria: 'Navegación del trabajador',
    portalSubtitle: 'Portal del trabajador',
    roleNote: 'Su trabajo asignado, horario y ganancias en un solo lugar.'
  },
  vi: {
    dashboard: 'Bảng điều khiển',
    jobs: 'Công việc',
    schedule: 'Lịch',
    earnings: 'Thu nhập',
    settings: 'Cài đặt',
    navAria: 'Điều hướng nhân viên',
    portalSubtitle: 'Cổng nhân viên',
    roleNote: 'Công việc, lịch và thu nhập của bạn ở cùng một nơi.'
  }
};

const createCompanyByLocale: Record<Locale, CreateCompanyCopy> = {
  en: {
    title: 'Create your company',
    body: 'Start a new EverittOS company workspace for your business.',
    nameLabel: 'Company name',
    namePlaceholder: 'Your company name',
    creating: 'Creating…',
    create: 'Create company',
    nameRequired: 'Enter a company name.',
    createError: 'Unable to create company.'
  },
  es: {
    title: 'Cree su empresa',
    body: 'Inicie un nuevo espacio de trabajo de EverittOS para su negocio.',
    nameLabel: 'Nombre de la empresa',
    namePlaceholder: 'Nombre de su empresa',
    creating: 'Creando…',
    create: 'Crear empresa',
    nameRequired: 'Ingrese un nombre de empresa.',
    createError: 'No se pudo crear la empresa.'
  },
  vi: {
    title: 'Tạo công ty của bạn',
    body: 'Bắt đầu không gian làm việc EverittOS mới cho doanh nghiệp của bạn.',
    nameLabel: 'Tên công ty',
    namePlaceholder: 'Tên công ty của bạn',
    creating: 'Đang tạo…',
    create: 'Tạo công ty',
    nameRequired: 'Nhập tên công ty.',
    createError: 'Không thể tạo công ty.'
  }
};

export function getAiUpgradeCopy(locale?: string | null): AiUpgradeCopy {
  return aiByLocale[normalizeLocale(locale)];
}

export function getPasskeyManagerCopy(locale?: string | null): PasskeyManagerCopy {
  return passkeyByLocale[normalizeLocale(locale)];
}

export function getPasskeySetupCopy(locale?: string | null): PasskeySetupCopy {
  return passkeySetupByLocale[normalizeLocale(locale)];
}

export function getSessionIdleCopy(locale?: string | null): SessionIdleCopy {
  return sessionIdleByLocale[normalizeLocale(locale)];
}

export function getAccessBlockedCopy(locale?: string | null): AccessBlockedCopy {
  return accessBlockedByLocale[normalizeLocale(locale)];
}

export function getPermissionDeniedCopy(locale?: string | null): PermissionDeniedCopy {
  return permissionDeniedByLocale[normalizeLocale(locale)];
}

export function getContractorLayoutCopy(locale?: string | null): ContractorLayoutCopy {
  return contractorLayoutByLocale[normalizeLocale(locale)];
}

export function getCreateCompanyCopy(locale?: string | null): CreateCompanyCopy {
  return createCompanyByLocale[normalizeLocale(locale)];
}

export function formatUiChromeCopy(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
