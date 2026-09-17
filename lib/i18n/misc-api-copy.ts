import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  unauthorized:string;
  permissionDenied:string;
  apiAccessPlan:string;
  serverUnavailable:string;
  keyNotFound:string;
  invalidRouteId:string;
  routeNotFound:string;
  loadRoute:string;
}> = {
  en:{unauthorized:'Unauthorized.',permissionDenied:'Permission denied.',apiAccessPlan:'API access requires Growth or Enterprise.',serverUnavailable:'This feature is temporarily unavailable.',keyNotFound:'Key not found or already revoked.',invalidRouteId:'Invalid route ID.',routeNotFound:'Route run not found.',loadRoute:'Unable to load route.'},
  es:{unauthorized:'No autorizado.',permissionDenied:'Permiso denegado.',apiAccessPlan:'El acceso a la API requiere Growth o Enterprise.',serverUnavailable:'Esta función no está disponible temporalmente.',keyNotFound:'No se encontró la clave o ya fue revocada.',invalidRouteId:'ID de ruta no válido.',routeNotFound:'No se encontró la ejecución de la ruta.',loadRoute:'No se pudo cargar la ruta.'},
  vi:{unauthorized:'Không được phép.',permissionDenied:'Không có quyền.',apiAccessPlan:'Quyền truy cập API yêu cầu gói Growth hoặc Enterprise.',serverUnavailable:'Tính năng này tạm thời không khả dụng.',keyNotFound:'Không tìm thấy khóa hoặc khóa đã bị thu hồi.',invalidRouteId:'ID tuyến đường không hợp lệ.',routeNotFound:'Không tìm thấy lần chạy tuyến đường.',loadRoute:'Không thể tải tuyến đường.'}
};

export function getMiscApiCopy(locale: Locale) { return COPY[locale] || COPY.en; }
