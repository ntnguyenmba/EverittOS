import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  unauthorized:string;
  planLocked:string;
  budgetLocked:string;
}> = {
  en:{unauthorized:'Unauthorized.',planLocked:'Everitt AI writing and analysis is available on Business and Enterprise plans. Ask Everitt search still works.',budgetLocked:'The AI budget for this workspace has been reached. Ask Everitt search still works.'},
  es:{unauthorized:'No autorizado.',planLocked:'La redacción y el análisis con Everitt AI están disponibles en los planes Business y Enterprise. La búsqueda de Ask Everitt sigue funcionando.',budgetLocked:'Se alcanzó el presupuesto de IA de este espacio de trabajo. La búsqueda de Ask Everitt sigue funcionando.'},
  vi:{unauthorized:'Không được phép.',planLocked:'Tính năng viết và phân tích bằng Everitt AI có trên các gói Business và Enterprise. Tìm kiếm Ask Everitt vẫn hoạt động.',budgetLocked:'Ngân sách AI của không gian làm việc này đã đạt giới hạn. Tìm kiếm Ask Everitt vẫn hoạt động.'}
};

export function getAiApiCopy(locale: Locale) { return COPY[locale] || COPY.en; }
