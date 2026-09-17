import type { Locale } from '@/lib/i18n/config';

type AiApiCopy = {
  unauthorized: string;
  noWorkspace: string;
  planLocked: string;
  subscriptionInactive: string;
  notConfigured: (provider: string) => string;
  serverUnavailable: string;
  permissionDenied: string;
  roleCannotUse: string;
  promptRequired: string;
  rateLimited: string;
  staffDailyLimit: string;
  staffMonthlyLimit: string;
  budgetLocked: string;
  budgetWarning: string;
  budgetVerificationFailed: string;
};

const COPY: Record<Locale, AiApiCopy> = {
  en: {
    unauthorized: 'Unauthorized.',
    noWorkspace: 'No active workspace found.',
    planLocked: 'Everitt AI writing and analysis is available on Business and Enterprise plans. Ask Everitt search still works.',
    subscriptionInactive: 'Update your subscription billing to use AI features.',
    notConfigured: (provider) => `${provider} is not configured on this server.`,
    serverUnavailable: 'Server is not configured.',
    permissionDenied: 'Permission denied.',
    roleCannotUse: 'Your role cannot use Everitt AI.',
    promptRequired: 'A prompt is required.',
    rateLimited: 'AI usage limit reached. Try again later.',
    staffDailyLimit: 'Daily AI prompt limit reached.',
    staffMonthlyLimit: 'Monthly AI prompt limit reached.',
    budgetLocked: 'The AI budget for this workspace has been reached. Ask Everitt search still works.',
    budgetWarning: 'The AI budget for this workspace is nearing its monthly limit.',
    budgetVerificationFailed: 'Unable to verify the AI budget right now.'
  },
  es: {
    unauthorized: 'No autorizado.',
    noWorkspace: 'No se encontró un espacio de trabajo activo.',
    planLocked: 'La redacción y el análisis con Everitt AI están disponibles en los planes Business y Enterprise. La búsqueda de Ask Everitt sigue funcionando.',
    subscriptionInactive: 'Actualiza la facturación de tu suscripción para usar las funciones de IA.',
    notConfigured: (provider) => `${provider} no está configurado en este servidor.`,
    serverUnavailable: 'El servidor no está configurado.',
    permissionDenied: 'Permiso denegado.',
    roleCannotUse: 'Tu rol no puede usar Everitt AI.',
    promptRequired: 'Se requiere una indicación.',
    rateLimited: 'Se alcanzó el límite de uso de IA. Inténtalo de nuevo más tarde.',
    staffDailyLimit: 'Se alcanzó el límite diario de indicaciones de IA.',
    staffMonthlyLimit: 'Se alcanzó el límite mensual de indicaciones de IA.',
    budgetLocked: 'Se alcanzó el presupuesto de IA de este espacio de trabajo. La búsqueda de Ask Everitt sigue funcionando.',
    budgetWarning: 'El presupuesto de IA de este espacio de trabajo se está acercando a su límite mensual.',
    budgetVerificationFailed: 'No se pudo verificar el presupuesto de IA en este momento.'
  },
  vi: {
    unauthorized: 'Không được phép.',
    noWorkspace: 'Không tìm thấy không gian làm việc đang hoạt động.',
    planLocked: 'Tính năng viết và phân tích bằng Everitt AI có trên các gói Business và Enterprise. Tìm kiếm Ask Everitt vẫn hoạt động.',
    subscriptionInactive: 'Cập nhật thanh toán gói đăng ký để sử dụng các tính năng AI.',
    notConfigured: (provider) => `${provider} chưa được cấu hình trên máy chủ này.`,
    serverUnavailable: 'Máy chủ chưa được cấu hình.',
    permissionDenied: 'Không có quyền truy cập.',
    roleCannotUse: 'Vai trò của bạn không thể sử dụng Everitt AI.',
    promptRequired: 'Vui lòng nhập yêu cầu.',
    rateLimited: 'Đã đạt giới hạn sử dụng AI. Hãy thử lại sau.',
    staffDailyLimit: 'Đã đạt giới hạn yêu cầu AI hằng ngày.',
    staffMonthlyLimit: 'Đã đạt giới hạn yêu cầu AI hằng tháng.',
    budgetLocked: 'Ngân sách AI của không gian làm việc này đã đạt giới hạn. Tìm kiếm Ask Everitt vẫn hoạt động.',
    budgetWarning: 'Ngân sách AI của không gian làm việc này sắp đạt giới hạn hàng tháng.',
    budgetVerificationFailed: 'Hiện không thể xác minh ngân sách AI.'
  }
};

export function getAiApiCopy(locale: Locale) {
  return COPY[locale] || COPY.en;
}
