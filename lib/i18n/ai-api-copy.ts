import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  unauthorized:string;
  noWorkspace:string;
  planLocked:string;
  subscriptionInactive:string;
  notConfigured:(provider:string)=>string;
  rateLimited:string;
  staffDailyLimit:string;
  staffMonthlyLimit:string;
  budgetLocked:string;
  budgetVerificationFailed:string;
}> = {
  en:{unauthorized:'Unauthorized.',noWorkspace:'No active workspace found.',planLocked:'Everitt AI writing and analysis is available on Business and Enterprise plans. Ask Everitt search still works.',subscriptionInactive:'Update your subscription billing to use AI features.',notConfigured:(provider)=>`${provider} is not configured on this server.`,rateLimited:'AI usage limit reached. Try again later.',staffDailyLimit:'Daily AI prompt limit reached.',staffMonthlyLimit:'Monthly AI prompt limit reached.',budgetLocked:'The AI budget for this workspace has been reached. Ask Everitt search still works.',budgetVerificationFailed:'Unable to verify the AI budget right now.'},
  es:{unauthorized:'No autorizado.',noWorkspace:'No se encontró un espacio de trabajo activo.',planLocked:'La redacción y el análisis con Everitt AI están disponibles en los planes Business y Enterprise. La búsqueda de Ask Everitt sigue funcionando.',subscriptionInactive:'Actualiza la facturación de tu suscripción para usar las funciones de IA.',notConfigured:(provider)=>`${provider} no está configurado en este servidor.`,rateLimited:'Se alcanzó el límite de uso de IA. Inténtalo de nuevo más tarde.',staffDailyLimit:'Se alcanzó el límite diario de indicaciones de IA.',staffMonthlyLimit:'Se alcanzó el límite mensual de indicaciones de IA.',budgetLocked:'Se alcanzó el presupuesto de IA de este espacio de trabajo. La búsqueda de Ask Everitt sigue funcionando.',budgetVerificationFailed:'No se pudo verificar el presupuesto de IA en este momento.'},
  vi:{unauthorized:'Không được phép.',noWorkspace:'Không tìm thấy không gian làm việc đang hoạt động.',planLocked:'Tính năng viết và phân tích bằng Everitt AI có trên các gói Business và Enterprise. Tìm kiếm Ask Everitt vẫn hoạt động.',subscriptionInactive:'Cập nhật thanh toán gói đăng ký để sử dụng các tính năng AI.',notConfigured:(provider)=>`${provider} chưa được cấu hình trên máy chủ này.`,rateLimited:'Đã đạt giới hạn sử dụng AI. Hãy thử lại sau.',staffDailyLimit:'Đã đạt giới hạn yêu cầu AI hằng ngày.',staffMonthlyLimit:'Đã đạt giới hạn yêu cầu AI hằng tháng.',budgetLocked:'Ngân sách AI của không gian làm việc này đã đạt giới hạn. Tìm kiếm Ask Everitt vẫn hoạt động.',budgetVerificationFailed:'Hiện không thể xác minh ngân sách AI.'}
};

export function getAiApiCopy(locale: Locale) { return COPY[locale] || COPY.en; }
