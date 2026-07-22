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
    noAddressAdded: 'No address',
    unableToSaveJob: 'Could not save job.',
    jobTitleRequired: 'Add a job title.',
    statusUpdated: (status) => `Status: ${status.replace('_', ' ')}.`,
    unableToSaveSchedule: 'Could not save schedule.',
    scheduleSaved: 'Schedule saved.',
    reportTitle: (title) => `${title} report`,
    jobCompletedTitle: 'Job complete',
    jobMarkedCompleted: 'Job completed.',
    reportGeneratedTitle: 'Report ready',
    reportCreated: 'Report created.',
    loadingJob: 'Loading...',
    jobAccessDenied: 'Job not found.',
    managementAccess: 'Manager',
    fieldAccess: 'Worker',
    managementAccessCopy: 'You can edit this job.',
    fieldAccessCopy: 'You can update work and add photos.',
    assignedEmail: 'Assigned to',
    jobDetails: 'Details',
    jobDetailsReadOnly: 'Details',
    title: 'Job',
    customer: 'Customer',
    phone: 'Phone',
    address: 'Address',
    jobNotes: 'Job notes',
    priority: 'Priority',
    priorityLow: 'Low',
    priorityNormal: 'Normal',
    priorityHigh: 'High',
    priorityUrgent: 'Urgent',
    internalNotes: 'Notes',
    customerNotes: 'Customer notes',
    completionVerified: 'Verified',
    saveDetails: 'Save',
    removeJobConfirm: 'Remove this job?',
    unableToRemoveJob: 'Could not remove job.',
    jobMarkedCancelled: 'Job cancelled.',
    removeJob: 'Remove job',
    notes: 'Notes',
    noNotes: 'No notes',
    created: 'Created',
    startJob: 'Start',
    markCompleted: 'Finish',
    schedule: 'Schedule',
    scheduleReadOnly: 'Schedule',
    startDate: 'Date',
    startTime: 'Start',
    dueDate: 'Due date',
    endTime: 'End',
    start: 'Start',
    due: 'Due',
    scheduledDuration: (duration) => duration,
    saving: 'Saving...',
    saveSchedule: 'Save',
    photosTitle: 'Photos',
    photosCopy: 'Add before and after photos.',
    proofReport: 'Report',
    proofReportCopy: 'Share job details and photos.',
    creating: 'Creating...',
    createReport: 'Create report',
    viewLatest: 'View report',
    activityTimeline: 'Activity',
    noTimelineEntries: 'No activity yet.',
    updateRecorded: 'Saved'
  },
  es: {
    notSet: 'Sin definir',
    notScheduled: 'Sin programar',
    noAddressAdded: 'Sin dirección',
    unableToSaveJob: 'No se pudo guardar.',
    jobTitleRequired: 'Agrega un título.',
    statusUpdated: (status) => `Estado: ${status.replace('_', ' ')}.`,
    unableToSaveSchedule: 'No se pudo guardar el horario.',
    scheduleSaved: 'Horario guardado.',
    reportTitle: (title) => `Informe de ${title}`,
    jobCompletedTitle: 'Trabajo terminado',
    jobMarkedCompleted: 'Trabajo terminado.',
    reportGeneratedTitle: 'Informe listo',
    reportCreated: 'Informe creado.',
    loadingJob: 'Cargando...',
    jobAccessDenied: 'Trabajo no encontrado.',
    managementAccess: 'Gerente',
    fieldAccess: 'Trabajador',
    managementAccessCopy: 'Puedes editar este trabajo.',
    fieldAccessCopy: 'Puedes actualizar el trabajo y agregar fotos.',
    assignedEmail: 'Asignado a',
    jobDetails: 'Detalles',
    jobDetailsReadOnly: 'Detalles',
    title: 'Trabajo',
    customer: 'Cliente',
    phone: 'Teléfono',
    address: 'Dirección',
    jobNotes: 'Notas del trabajo',
    priority: 'Prioridad',
    priorityLow: 'Baja',
    priorityNormal: 'Normal',
    priorityHigh: 'Alta',
    priorityUrgent: 'Urgente',
    internalNotes: 'Notas',
    customerNotes: 'Notas del cliente',
    completionVerified: 'Verificado',
    saveDetails: 'Guardar',
    removeJobConfirm: '¿Eliminar este trabajo?',
    unableToRemoveJob: 'No se pudo eliminar.',
    jobMarkedCancelled: 'Trabajo cancelado.',
    removeJob: 'Eliminar',
    notes: 'Notas',
    noNotes: 'Sin notas',
    created: 'Creado',
    startJob: 'Iniciar',
    markCompleted: 'Terminar',
    schedule: 'Horario',
    scheduleReadOnly: 'Horario',
    startDate: 'Fecha',
    startTime: 'Inicio',
    dueDate: 'Fecha límite',
    endTime: 'Fin',
    start: 'Inicio',
    due: 'Vence',
    scheduledDuration: (duration) => duration,
    saving: 'Guardando...',
    saveSchedule: 'Guardar',
    photosTitle: 'Fotos',
    photosCopy: 'Agrega fotos de antes y después.',
    proofReport: 'Informe',
    proofReportCopy: 'Comparte detalles y fotos.',
    creating: 'Creando...',
    createReport: 'Crear informe',
    viewLatest: 'Ver informe',
    activityTimeline: 'Actividad',
    noTimelineEntries: 'Sin actividad.',
    updateRecorded: 'Guardado'
  },
  vi: {
    notSet: 'Chưa đặt',
    notScheduled: 'Chưa lên lịch',
    noAddressAdded: 'Chưa có địa chỉ',
    unableToSaveJob: 'Không thể lưu.',
    jobTitleRequired: 'Thêm tên công việc.',
    statusUpdated: (status) => `Trạng thái: ${status.replace('_', ' ')}.`,
    unableToSaveSchedule: 'Không thể lưu lịch.',
    scheduleSaved: 'Đã lưu lịch.',
    reportTitle: (title) => `Báo cáo ${title}`,
    jobCompletedTitle: 'Đã xong việc',
    jobMarkedCompleted: 'Đã hoàn tất.',
    reportGeneratedTitle: 'Báo cáo đã sẵn sàng',
    reportCreated: 'Đã tạo báo cáo.',
    loadingJob: 'Đang tải...',
    jobAccessDenied: 'Không tìm thấy công việc.',
    managementAccess: 'Quản lý',
    fieldAccess: 'Nhân viên',
    managementAccessCopy: 'Bạn có thể sửa công việc này.',
    fieldAccessCopy: 'Bạn có thể cập nhật việc và thêm ảnh.',
    assignedEmail: 'Giao cho',
    jobDetails: 'Chi tiết',
    jobDetailsReadOnly: 'Chi tiết',
    title: 'Công việc',
    customer: 'Khách hàng',
    phone: 'Điện thoại',
    address: 'Địa chỉ',
    jobNotes: 'Ghi chú công việc',
    priority: 'Ưu tiên',
    priorityLow: 'Thấp',
    priorityNormal: 'Bình thường',
    priorityHigh: 'Cao',
    priorityUrgent: 'Khẩn cấp',
    internalNotes: 'Ghi chú',
    customerNotes: 'Ghi chú khách hàng',
    completionVerified: 'Đã xác minh',
    saveDetails: 'Lưu',
    removeJobConfirm: 'Xóa công việc này?',
    unableToRemoveJob: 'Không thể xóa.',
    jobMarkedCancelled: 'Đã hủy công việc.',
    removeJob: 'Xóa',
    notes: 'Ghi chú',
    noNotes: 'Không có ghi chú',
    created: 'Đã tạo',
    startJob: 'Bắt đầu',
    markCompleted: 'Hoàn tất',
    schedule: 'Lịch',
    scheduleReadOnly: 'Lịch',
    startDate: 'Ngày',
    startTime: 'Bắt đầu',
    dueDate: 'Hạn',
    endTime: 'Kết thúc',
    start: 'Bắt đầu',
    due: 'Hạn',
    scheduledDuration: (duration) => duration,
    saving: 'Đang lưu...',
    saveSchedule: 'Lưu',
    photosTitle: 'Ảnh',
    photosCopy: 'Thêm ảnh trước và sau.',
    proofReport: 'Báo cáo',
    proofReportCopy: 'Chia sẻ chi tiết và ảnh.',
    creating: 'Đang tạo...',
    createReport: 'Tạo báo cáo',
    viewLatest: 'Xem báo cáo',
    activityTimeline: 'Hoạt động',
    noTimelineEntries: 'Chưa có hoạt động.',
    updateRecorded: 'Đã lưu'
  }
};

export function getJobDetailCopy(locale: Locale): JobDetailCopy {
  return copy[locale] || copy.en;
}
