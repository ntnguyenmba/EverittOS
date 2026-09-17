import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  unauthorized:string;
  organizationNotFound:string;
  permissionDenied:string;
  serverUnavailable:string;
  loadError:string;
  planRequired:string;
  nameRequired:string;
  saveError:string;
  workflowNotFound:string;
  workflowTemplateNotFound:string;
  jobNotFound:string;
  noWorkflowTemplate:string;
  stepNotFound:string;
  stepTitleRequired:string;
  stepIdRequired:string;
  stepNoteRequired:string;
  stepSaveError:string;
}> = {
  en: {
    unauthorized:'Unauthorized.',
    organizationNotFound:'Organization not found.',
    permissionDenied:'Permission denied.',
    serverUnavailable:'This feature is temporarily unavailable.',
    loadError:'Unable to load workflows.',
    planRequired:'Workflows require Growth or higher.',
    nameRequired:'Workflow name is required.',
    saveError:'Unable to save workflow.',
    workflowNotFound:'Workflow not found.',
    workflowTemplateNotFound:'Workflow template not found.',
    jobNotFound:'Job not found.',
    noWorkflowTemplate:'This job does not have a workflow template.',
    stepNotFound:'Step not found in workflow.',
    stepTitleRequired:'Step title is required.',
    stepIdRequired:'Step ID is required.',
    stepNoteRequired:'This step requires a note.',
    stepSaveError:'Unable to save workflow step.'
  },
  es: {
    unauthorized:'No autorizado.',
    organizationNotFound:'No se encontró la organización.',
    permissionDenied:'Permiso denegado.',
    serverUnavailable:'Esta función no está disponible temporalmente.',
    loadError:'No se pudieron cargar los flujos.',
    planRequired:'Los flujos requieren Growth o superior.',
    nameRequired:'El nombre del flujo es obligatorio.',
    saveError:'No se pudo guardar el flujo.',
    workflowNotFound:'No se encontró el flujo.',
    workflowTemplateNotFound:'No se encontró la plantilla de flujo.',
    jobNotFound:'No se encontró el trabajo.',
    noWorkflowTemplate:'Este trabajo no tiene una plantilla de flujo.',
    stepNotFound:'No se encontró el paso en el flujo.',
    stepTitleRequired:'El título del paso es obligatorio.',
    stepIdRequired:'El ID del paso es obligatorio.',
    stepNoteRequired:'Este paso requiere una nota.',
    stepSaveError:'No se pudo guardar el paso del flujo.'
  },
  vi: {
    unauthorized:'Không được phép.',
    organizationNotFound:'Không tìm thấy tổ chức.',
    permissionDenied:'Không có quyền.',
    serverUnavailable:'Tính năng này tạm thời không khả dụng.',
    loadError:'Không thể tải quy trình.',
    planRequired:'Quy trình yêu cầu gói Growth trở lên.',
    nameRequired:'Tên quy trình là bắt buộc.',
    saveError:'Không thể lưu quy trình.',
    workflowNotFound:'Không tìm thấy quy trình.',
    workflowTemplateNotFound:'Không tìm thấy mẫu quy trình.',
    jobNotFound:'Không tìm thấy công việc.',
    noWorkflowTemplate:'Công việc này không có mẫu quy trình.',
    stepNotFound:'Không tìm thấy bước trong quy trình.',
    stepTitleRequired:'Tên bước là bắt buộc.',
    stepIdRequired:'ID bước là bắt buộc.',
    stepNoteRequired:'Bước này yêu cầu ghi chú.',
    stepSaveError:'Không thể lưu bước quy trình.'
  }
};

export function getWorkflowApiCopy(locale: Locale) {
  return COPY[locale] || COPY.en;
}
