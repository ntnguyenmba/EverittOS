import type { Locale } from '@/lib/i18n/config';

const COPY = {
 en:{serviceName:'Service name is required.',duration:'Duration must be greater than zero.',price:'Price must be zero or greater.',loadServices:'Unable to load services.',saveService:'Unable to save service.',serviceSaved:'Service saved successfully.',workerName:'Worker name is required.',workerLimit:'Team member limit reached for this plan.',workerSaved:'Worker saved successfully.'},
 es:{serviceName:'El nombre del servicio es obligatorio.',duration:'La duración debe ser mayor que cero.',price:'El precio debe ser cero o mayor.',loadServices:'No se pudieron cargar los servicios.',saveService:'No se pudo guardar el servicio.',serviceSaved:'Servicio guardado correctamente.',workerName:'El nombre del trabajador es obligatorio.',workerLimit:'Se alcanzó el límite de miembros del equipo para este plan.',workerSaved:'Trabajador guardado correctamente.'},
 vi:{serviceName:'Tên dịch vụ là bắt buộc.',duration:'Thời lượng phải lớn hơn 0.',price:'Giá phải bằng hoặc lớn hơn 0.',loadServices:'Không thể tải dịch vụ.',saveService:'Không thể lưu dịch vụ.',serviceSaved:'Đã lưu dịch vụ.',workerName:'Tên nhân viên là bắt buộc.',workerLimit:'Đã đạt giới hạn thành viên nhóm của gói này.',workerSaved:'Đã lưu nhân viên.'}
} as const;
export function getResourceApiCopy(locale:Locale){return COPY[locale]||COPY.en;}
