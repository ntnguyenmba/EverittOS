import type { Locale } from '@/lib/i18n/config';

type JobDetailCopy = {
  notSet: string;
  notScheduled: string;
  noAddressAdded: string;
  unableToSaveJob: string;
  jobTitleRequired: string;
  statusUpdated: (status: string) => string;
  unableToSaveSchedule: string;
  scheduleSaved: string;
  reportTitle: (title: string) => string;
  jobCompletedTitle: string;
  jobMarkedCompleted: string;
  reportGeneratedTitle: string;
  reportCreated: string;
  loadingJob: string;
  jobAccessDenied: string;
  managementAccess: string;
  fieldAccess: string;
  managementAccessCopy: string;
  fieldAccessCopy: string;
  assignedEmail: string;
  jobDetails: string;
  jobDetailsReadOnly: string;
  title: string;
  customer: string;
  phone: string;
  address: string;
  jobNotes: string;
  priority: string;
  priorityLow: string;
  priorityNormal: string;
  priorityHigh: string;
  priorityUrgent: string;
  internalNotes: string;
  customerNotes: string;
  completionVerified: string;
  saveDetails: string;
  removeJobConfirm: string;
  unableToRemoveJob: string;
  jobMarkedCancelled: string;
  removeJob: string;
  notes: string;
  noNotes: string;
  created: string;
  startJob: string;
  markCompleted: string;
  schedule: string;
  scheduleReadOnly: string;
  startDate: string;
  startTime: string;
  dueDate: string;
  endTime: string;
  start: string;
  due: string;
  scheduledDuration: (duration: string) => string;
  saving: string;
  saveSchedule: string;
  photosTitle: string;
  photosCopy: string;
  proofReport: string;
  proofReportCopy: string;
  creating: string;
  createReport: string;
  viewLatest: string;
  activityTimeline: string;
  noTimelineEntries: string;
  updateRecorded: string;
};

const copy: Record<Locale, JobDetailCopy> = {
  en: {
    notSet: 'Not set',
    notScheduled: 'Not scheduled',
    noAddressAdded: 'No address added',
    unableToSaveJob: 'Unable to save job.',
    jobTitleRequired: 'Job title is required.',
    statusUpdated: (status) => `Status updated to ${status.replace('_', ' ')}.`,
    unableToSaveSchedule: 'Unable to save schedule.',
    scheduleSaved: 'Schedule saved.',
    reportTitle: (title) => `${title} report`,
    jobCompletedTitle: 'Job completed',
    jobMarkedCompleted: 'Job marked completed',
    reportGeneratedTitle: 'Report generated',
    reportCreated: 'Report created.',
    loadingJob: 'Loading job...',
    jobAccessDenied: 'Job not found or access denied.',
    managementAccess: 'Management access',
    fieldAccess: 'Field access',
    managementAccessCopy:
      'You can edit job details, schedule, assignment, customer notes, and verification. Team changes are recorded in the activity timeline.',
    fieldAccessCopy:
      'You can view the job, update status, complete checklist items, and upload job photos. Details, schedule, customer info, and assignments are read-only.',
    assignedEmail: 'Assigned email',
    jobDetails: 'Job details',
    jobDetailsReadOnly: 'Job details, read-only',
    title: 'Title',
    customer: 'Customer',
    phone: 'Phone',
    address: 'Address',
    jobNotes: 'Job notes',
    priority: 'Priority',
    priorityLow: 'Low',
    priorityNormal: 'Normal',
    priorityHigh: 'High',
    priorityUrgent: 'Urgent',
    internalNotes: 'Internal notes',
    customerNotes: 'Customer notes',
    completionVerified: 'Completion verified',
    saveDetails: 'Save details',
    removeJobConfirm: 'Remove this job?',
    unableToRemoveJob: 'Unable to remove job.',
    jobMarkedCancelled: 'Job marked cancelled (linked records kept).',
    removeJob: 'Remove job',
    notes: 'Notes',
    noNotes: 'No notes',
    created: 'Created',
    startJob: 'Start job',
    markCompleted: 'Mark completed',
    schedule: 'Schedule',
    scheduleReadOnly: 'Schedule, read-only',
    startDate: 'Start date',
    startTime: 'Start time',
    dueDate: 'Due date',
    endTime: 'End time',
    start: 'Start',
    due: 'Due',
    scheduledDuration: (duration) => `Scheduled duration: ${duration}`,
    saving: 'Saving...',
    saveSchedule: 'Save schedule',
    photosTitle: 'Before & after photos',
    photosCopy:
      'Document the job with before and after photos. Upload from your phone camera or desktop. Files are stored securely with this job.',
    proofReport: 'Proof report',
    proofReportCopy: 'Generate a printable report with job details and photos.',
    creating: 'Creating...',
    createReport: 'Create report',
    viewLatest: 'View latest',
    activityTimeline: 'Activity timeline',
    noTimelineEntries: 'No timeline updates yet.',
    updateRecorded: 'Update recorded'
  },
  es: {
    notSet: 'No configurado',
    notScheduled: 'No programado',
    noAddressAdded: 'No se agregó dirección',
    unableToSaveJob: 'No se pudo guardar el trabajo.',
    jobTitleRequired: 'El título del trabajo es obligatorio.',
    statusUpdated: (status) => `Estado actualizado a ${status.replace('_', ' ')}.`,
    unableToSaveSchedule: 'No se pudo guardar el horario.',
    scheduleSaved: 'Horario guardado.',
    reportTitle: (title) => `Informe de ${title}`,
    jobCompletedTitle: 'Trabajo completado',
    jobMarkedCompleted: 'Trabajo marcado como completado',
    reportGeneratedTitle: 'Informe generado',
    reportCreated: 'Informe creado.',
    loadingJob: 'Cargando trabajo...',
    jobAccessDenied: 'Trabajo no encontrado o acceso denegado.',
    managementAccess: 'Acceso de gestión',
    fieldAccess: 'Acceso de campo',
    managementAccessCopy:
      'Puedes editar detalles del trabajo, horario, asignación, notas del cliente y verificación. Los cambios del equipo se registran en la actividad.',
    fieldAccessCopy:
      'Puedes ver el trabajo, actualizar el estado, completar listas y subir fotos. Los detalles, horario, cliente y asignaciones son de solo lectura.',
    assignedEmail: 'Correo asignado',
    jobDetails: 'Detalles del trabajo',
    jobDetailsReadOnly: 'Detalles del trabajo, solo lectura',
    title: 'Título',
    customer: 'Cliente',
    phone: 'Teléfono',
    address: 'Dirección',
    jobNotes: 'Notas del trabajo',
    priority: 'Prioridad',
    priorityLow: 'Baja',
    priorityNormal: 'Normal',
    priorityHigh: 'Alta',
    priorityUrgent: 'Urgente',
    internalNotes: 'Notas internas',
    customerNotes: 'Notas del cliente',
    completionVerified: 'Finalización verificada',
    saveDetails: 'Guardar detalles',
    removeJobConfirm: '¿Eliminar este trabajo?',
    unableToRemoveJob: 'No se pudo eliminar el trabajo.',
    jobMarkedCancelled: 'Trabajo marcado como cancelado (registros vinculados conservados).',
    removeJob: 'Eliminar trabajo',
    notes: 'Notas',
    noNotes: 'Sin notas',
    created: 'Creado',
    startJob: 'Iniciar trabajo',
    markCompleted: 'Marcar completado',
    schedule: 'Horario',
    scheduleReadOnly: 'Horario, solo lectura',
    startDate: 'Fecha de inicio',
    startTime: 'Hora de inicio',
    dueDate: 'Fecha límite',
    endTime: 'Hora de fin',
    start: 'Inicio',
    due: 'Vence',
    scheduledDuration: (duration) => `Duración programada: ${duration}`,
    saving: 'Guardando...',
    saveSchedule: 'Guardar horario',
    photosTitle: 'Fotos antes y después',
    photosCopy:
      'Documenta el trabajo con fotos de antes y después. Sube desde la cámara del teléfono o escritorio. Los archivos se guardan de forma segura con este trabajo.',
    proofReport: 'Informe de prueba',
    proofReportCopy: 'Genera un informe imprimible con detalles y fotos del trabajo.',
    creating: 'Creando...',
    createReport: 'Crear informe',
    viewLatest: 'Ver el más reciente',
    activityTimeline: 'Historial de actividad',
    noTimelineEntries: 'Aún no hay actualizaciones en el historial.',
    updateRecorded: 'Actualización registrada'
  },
  vi: {
    notSet: 'Chưa đặt',
    notScheduled: 'Chưa lên lịch',
    noAddressAdded: 'Chưa thêm địa chỉ',
    unableToSaveJob: 'Không thể lưu công việc.',
    jobTitleRequired: 'Bắt buộc có tiêu đề công việc.',
    statusUpdated: (status) => `Đã cập nhật trạng thái thành ${status.replace('_', ' ')}.`,
    unableToSaveSchedule: 'Không thể lưu lịch.',
    scheduleSaved: 'Đã lưu lịch.',
    reportTitle: (title) => `Báo cáo ${title}`,
    jobCompletedTitle: 'Công việc hoàn tất',
    jobMarkedCompleted: 'Công việc đã được đánh dấu hoàn tất',
    reportGeneratedTitle: 'Đã tạo báo cáo',
    reportCreated: 'Đã tạo báo cáo.',
    loadingJob: 'Đang tải công việc...',
    jobAccessDenied: 'Không tìm thấy công việc hoặc bạn không có quyền truy cập.',
    managementAccess: 'Quyền quản lý',
    fieldAccess: 'Quyền hiện trường',
    managementAccessCopy:
      'Bạn có thể chỉnh sửa chi tiết công việc, lịch, phân công, ghi chú khách hàng và xác minh. Thay đổi của nhóm được ghi lại trong lịch sử hoạt động.',
    fieldAccessCopy:
      'Bạn có thể xem công việc, cập nhật trạng thái, hoàn thành checklist và tải ảnh công việc lên. Chi tiết, lịch, thông tin khách hàng và phân công chỉ được xem.',
    assignedEmail: 'Email được phân công',
    jobDetails: 'Chi tiết công việc',
    jobDetailsReadOnly: 'Chi tiết công việc, chỉ xem',
    title: 'Tiêu đề',
    customer: 'Khách hàng',
    phone: 'Điện thoại',
    address: 'Địa chỉ',
    jobNotes: 'Ghi chú công việc',
    priority: 'Mức ưu tiên',
    priorityLow: 'Thấp',
    priorityNormal: 'Bình thường',
    priorityHigh: 'Cao',
    priorityUrgent: 'Khẩn cấp',
    internalNotes: 'Ghi chú nội bộ',
    customerNotes: 'Ghi chú khách hàng',
    completionVerified: 'Đã xác minh hoàn tất',
    saveDetails: 'Lưu chi tiết',
    removeJobConfirm: 'Xóa công việc này?',
    unableToRemoveJob: 'Không thể xóa công việc.',
    jobMarkedCancelled: 'Công việc đã được đánh dấu hủy (giữ lại hồ sơ liên kết).',
    removeJob: 'Xóa công việc',
    notes: 'Ghi chú',
    noNotes: 'Không có ghi chú',
    created: 'Đã tạo',
    startJob: 'Bắt đầu công việc',
    markCompleted: 'Đánh dấu hoàn tất',
    schedule: 'Lịch',
    scheduleReadOnly: 'Lịch, chỉ xem',
    startDate: 'Ngày bắt đầu',
    startTime: 'Giờ bắt đầu',
    dueDate: 'Ngày đến hạn',
    endTime: 'Giờ kết thúc',
    start: 'Bắt đầu',
    due: 'Đến hạn',
    scheduledDuration: (duration) => `Thời lượng đã lên lịch: ${duration}`,
    saving: 'Đang lưu...',
    saveSchedule: 'Lưu lịch',
    photosTitle: 'Ảnh trước và sau',
    photosCopy:
      'Ghi lại công việc bằng ảnh trước và sau. Tải lên từ camera điện thoại hoặc máy tính. Tệp được lưu an toàn cùng công việc này.',
    proofReport: 'Báo cáo bằng chứng',
    proofReportCopy: 'Tạo báo cáo có thể in với chi tiết công việc và ảnh.',
    creating: 'Đang tạo...',
    createReport: 'Tạo báo cáo',
    viewLatest: 'Xem mới nhất',
    activityTimeline: 'Lịch sử hoạt động',
    noTimelineEntries: 'Chưa có mục lịch sử nào.',
    updateRecorded: 'Đã ghi lại cập nhật'
  }
};

export function getJobDetailCopy(locale: Locale): JobDetailCopy {
  return copy[locale] || copy.en;
}
