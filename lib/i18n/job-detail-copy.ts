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
  overview: string;
  overviewCopy: string;
  email: string;
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
  cancelJobConfirm: string;
  restoreJobConfirm: string;
  jobRestored: string;
  bookAgain: string;
  creatingJob: string;
  duplicateFailed: string;
  duplicateCreated: string;
  confirmDateTime: string;
  confirmDateTimeCopy: string;
  unableToUpdateVisit: string;
  visitUpdated: string;
  futureScope: string;
  seriesScope: string;
  applySeriesChanges: (scope: string) => string;
  unableToUpdateSeries: string;
  futureVisitsUpdated: (count: number) => string;
  cancelGeneratedVisitsConfirm: string;
  seriesPaused: string;
  seriesResumed: string;
  seriesEnded: string;
  moreAdvanced: string;
  recurringSeries: string;
  recurringSeriesCopy: (date?: string | null) => string;
  working: string;
  skipVisit: string;
  cancelVisit: string;
  editFuture: string;
  editSeries: string;
  pauseSeries: string;
  resumeSeries: string;
  endSeries: string;
  internalMetadata: string;
  saveInternalNotes: string;
  jobId: string;
  money: string;
  deleteJob: string;
  deleteJobSectionCopyOneTime: string;
  deleteJobSectionCopyRecurring: string;
  deleteJobConfirmOneTime: string;
  deleteJobConfirmRecurring: string;
  deletingJob: string;
  unableToDeleteJob: string;
};

const copy: Record<Locale, JobDetailCopy> = {
  en: {
    notSet: 'Not set', notScheduled: 'Not scheduled', noAddressAdded: 'No address',
    unableToSaveJob: 'Could not save job.', jobTitleRequired: 'Add a job title.',
    statusUpdated: (status) => `Status: ${status.replace('_', ' ')}.`,
    unableToSaveSchedule: 'Could not save schedule.', scheduleSaved: 'Schedule saved.',
    reportTitle: (title) => `${title} report`, jobCompletedTitle: 'Job complete', jobMarkedCompleted: 'Job completed.',
    reportGeneratedTitle: 'Report ready', reportCreated: 'Report created.', loadingJob: 'Loading...', jobAccessDenied: 'Job not found.',
    managementAccess: 'Manager', fieldAccess: 'Worker', managementAccessCopy: 'You can edit this job.', fieldAccessCopy: 'You can update work and add photos.',
    assignedEmail: 'Assigned to', jobDetails: 'Details', jobDetailsReadOnly: 'Details', overview: 'Overview',
    overviewCopy: 'Update the job here without entering the schedule or contractor again.', email: 'Email', title: 'Job', customer: 'Customer', phone: 'Phone', address: 'Address',
    jobNotes: 'Job notes', priority: 'Priority', priorityLow: 'Low', priorityNormal: 'Normal', priorityHigh: 'High', priorityUrgent: 'Urgent',
    internalNotes: 'Team notes', customerNotes: 'Customer notes', completionVerified: 'Verified', saveDetails: 'Save',
    removeJobConfirm: 'Remove this job?', unableToRemoveJob: 'Could not remove job.', jobMarkedCancelled: 'Job cancelled.', removeJob: 'Remove job',
    notes: 'Notes', noNotes: 'No notes', created: 'Created', startJob: 'Start', markCompleted: 'Finish', schedule: 'Schedule', scheduleReadOnly: 'Schedule',
    startDate: 'Date', startTime: 'Start', dueDate: 'Due date', endTime: 'End', start: 'Start', due: 'Due', scheduledDuration: (duration) => duration,
    saving: 'Saving...', saveSchedule: 'Save', photosTitle: 'Photos', photosCopy: 'Add before and after photos.', proofReport: 'Report',
    proofReportCopy: 'Share job details and photos.', creating: 'Creating...', createReport: 'Create report', viewLatest: 'View report', activityTimeline: 'Activity',
    noTimelineEntries: 'No activity yet.', updateRecorded: 'Saved', cancelJobConfirm: 'Cancel this job? It will no longer count on the dashboard.',
    restoreJobConfirm: 'Restore this cancelled job and schedule it again?', jobRestored: 'Job restored.', bookAgain: 'Book again', creatingJob: 'Creating...',
    duplicateFailed: 'Could not create a similar job.', duplicateCreated: 'Draft job created. Confirm the date and time.', confirmDateTime: 'Confirm date and time',
    confirmDateTimeCopy: 'This draft came from a past job. Choose the new visit date and time.', unableToUpdateVisit: 'Could not update this visit.', visitUpdated: 'Visit updated.',
    futureScope: 'this visit and future unfinished visits', seriesScope: 'the series and future unfinished visits',
    applySeriesChanges: (scope) => `Apply the current details, price, and timezone to ${scope}? Finished and paid visits will not change.`,
    unableToUpdateSeries: 'Could not update the series.', futureVisitsUpdated: (count) => `Updated ${count} future visit(s). Past finished visits were not changed.`,
    cancelGeneratedVisitsConfirm: 'Also cancel future visits already created? Choose Cancel to keep them scheduled.', seriesPaused: 'Series paused.', seriesResumed: 'Series resumed.', seriesEnded: 'Series ended.',
    moreAdvanced: 'More / Advanced', recurringSeries: 'Recurring series',
    recurringSeriesCopy: (date) => `This visit is part of a recurring series${date ? ` (${date})` : ''}. Use these actions only for future visits or the series.`,
    working: 'Working...', skipVisit: 'Skip this visit', cancelVisit: 'Cancel this visit', editFuture: 'Edit this and future', editSeries: 'Edit entire series',
    pauseSeries: 'Pause series', resumeSeries: 'Resume series', endSeries: 'End series', internalMetadata: 'Internal details', saveInternalNotes: 'Save team notes', jobId: 'Job ID', money: 'Money',
    deleteJob: 'Delete',
    deleteJobSectionCopyOneTime: '',
    deleteJobSectionCopyRecurring: 'Delete this visit and all future visits? Past completed visits will stay.',
    deleteJobConfirmOneTime: 'Permanently delete this job? This cannot be undone.',
    deleteJobConfirmRecurring: 'Delete this visit and all future visits? Past completed visits will stay. This cannot be undone.',
    deletingJob: 'Deleting…',
    unableToDeleteJob: 'Could not permanently delete this job.'
  },
  es: {
    notSet: 'Sin definir', notScheduled: 'Sin programar', noAddressAdded: 'Sin dirección',
    unableToSaveJob: 'No se pudo guardar.', jobTitleRequired: 'Agrega un título.', statusUpdated: (status) => `Estado: ${status.replace('_', ' ')}.`,
    unableToSaveSchedule: 'No se pudo guardar el horario.', scheduleSaved: 'Horario guardado.', reportTitle: (title) => `Informe de ${title}`,
    jobCompletedTitle: 'Trabajo terminado', jobMarkedCompleted: 'Trabajo terminado.', reportGeneratedTitle: 'Informe listo', reportCreated: 'Informe creado.',
    loadingJob: 'Cargando...', jobAccessDenied: 'Trabajo no encontrado.', managementAccess: 'Gerente', fieldAccess: 'Trabajador',
    managementAccessCopy: 'Puedes editar este trabajo.', fieldAccessCopy: 'Puedes actualizar el trabajo y agregar fotos.', assignedEmail: 'Asignado a',
    jobDetails: 'Detalles', jobDetailsReadOnly: 'Detalles', overview: 'Resumen', overviewCopy: 'Actualiza el trabajo aquí sin volver a ingresar el horario ni el contratista.',
    email: 'Correo electrónico', title: 'Trabajo', customer: 'Cliente', phone: 'Teléfono', address: 'Dirección', jobNotes: 'Notas del trabajo',
    priority: 'Prioridad', priorityLow: 'Baja', priorityNormal: 'Normal', priorityHigh: 'Alta', priorityUrgent: 'Urgente', internalNotes: 'Notas del equipo',
    customerNotes: 'Notas del cliente', completionVerified: 'Verificado', saveDetails: 'Guardar', removeJobConfirm: '¿Eliminar este trabajo?',
    unableToRemoveJob: 'No se pudo eliminar.', jobMarkedCancelled: 'Trabajo cancelado.', removeJob: 'Eliminar', notes: 'Notas', noNotes: 'Sin notas', created: 'Creado',
    startJob: 'Iniciar', markCompleted: 'Terminar', schedule: 'Horario', scheduleReadOnly: 'Horario', startDate: 'Fecha', startTime: 'Inicio', dueDate: 'Fecha límite',
    endTime: 'Fin', start: 'Inicio', due: 'Vence', scheduledDuration: (duration) => duration, saving: 'Guardando...', saveSchedule: 'Guardar', photosTitle: 'Fotos',
    photosCopy: 'Agrega fotos de antes y después.', proofReport: 'Informe', proofReportCopy: 'Comparte detalles y fotos.', creating: 'Creando...', createReport: 'Crear informe',
    viewLatest: 'Ver informe', activityTimeline: 'Actividad', noTimelineEntries: 'Sin actividad.', updateRecorded: 'Guardado',
    cancelJobConfirm: '¿Cancelar este trabajo? Ya no contará en el panel.', restoreJobConfirm: '¿Restaurar este trabajo cancelado y programarlo de nuevo?', jobRestored: 'Trabajo restaurado.',
    bookAgain: 'Reservar de nuevo', creatingJob: 'Creando...', duplicateFailed: 'No se pudo crear un trabajo similar.', duplicateCreated: 'Trabajo en borrador creado. Confirma la fecha y hora.',
    confirmDateTime: 'Confirma la fecha y hora', confirmDateTimeCopy: 'Este borrador viene de un trabajo anterior. Elige la nueva fecha y hora.',
    unableToUpdateVisit: 'No se pudo actualizar esta visita.', visitUpdated: 'Visita actualizada.', futureScope: 'esta visita y las visitas futuras sin terminar',
    seriesScope: 'la serie y las visitas futuras sin terminar', applySeriesChanges: (scope) => `¿Aplicar los detalles, el precio y la zona horaria actuales a ${scope}? Las visitas terminadas y pagadas no cambiarán.`,
    unableToUpdateSeries: 'No se pudo actualizar la serie.', futureVisitsUpdated: (count) => `Se actualizaron ${count} visita(s) futura(s). Las visitas terminadas no cambiaron.`,
    cancelGeneratedVisitsConfirm: '¿También cancelar las visitas futuras ya creadas? Elige Cancelar para mantenerlas programadas.', seriesPaused: 'Serie pausada.', seriesResumed: 'Serie reanudada.', seriesEnded: 'Serie finalizada.',
    moreAdvanced: 'Más / Avanzado', recurringSeries: 'Serie recurrente', recurringSeriesCopy: (date) => `Esta visita forma parte de una serie recurrente${date ? ` (${date})` : ''}. Usa estas acciones solo para visitas futuras o la serie.`,
    working: 'Procesando...', skipVisit: 'Omitir esta visita', cancelVisit: 'Cancelar esta visita', editFuture: 'Editar esta y las futuras', editSeries: 'Editar toda la serie',
    pauseSeries: 'Pausar serie', resumeSeries: 'Reanudar serie', endSeries: 'Finalizar serie', internalMetadata: 'Detalles internos', saveInternalNotes: 'Guardar notas del equipo', jobId: 'ID del trabajo', money: 'Dinero',
    deleteJob: 'Eliminar',
    deleteJobSectionCopyOneTime: '',
    deleteJobSectionCopyRecurring: '¿Eliminar esta visita y todas las visitas futuras? Las visitas completadas anteriores se conservarán.',
    deleteJobConfirmOneTime: '¿Eliminar permanentemente este trabajo? Esto no se puede deshacer.',
    deleteJobConfirmRecurring: '¿Eliminar esta visita y todas las visitas futuras? Las visitas completadas anteriores se conservarán. Esto no se puede deshacer.',
    deletingJob: 'Eliminando…',
    unableToDeleteJob: 'No se pudo eliminar permanentemente este trabajo.'
  },
  vi: {
    notSet: 'Chưa đặt', notScheduled: 'Chưa lên lịch', noAddressAdded: 'Chưa có địa chỉ', unableToSaveJob: 'Không thể lưu.', jobTitleRequired: 'Thêm tên công việc.',
    statusUpdated: (status) => `Trạng thái: ${status.replace('_', ' ')}.`, unableToSaveSchedule: 'Không thể lưu lịch.', scheduleSaved: 'Đã lưu lịch.',
    reportTitle: (title) => `Báo cáo ${title}`, jobCompletedTitle: 'Đã xong việc', jobMarkedCompleted: 'Đã hoàn tất.', reportGeneratedTitle: 'Báo cáo đã sẵn sàng', reportCreated: 'Đã tạo báo cáo.',
    loadingJob: 'Đang tải...', jobAccessDenied: 'Không tìm thấy công việc.', managementAccess: 'Quản lý', fieldAccess: 'Nhân viên', managementAccessCopy: 'Bạn có thể sửa công việc này.',
    fieldAccessCopy: 'Bạn có thể cập nhật việc và thêm ảnh.', assignedEmail: 'Giao cho', jobDetails: 'Chi tiết', jobDetailsReadOnly: 'Chi tiết', overview: 'Tổng quan',
    overviewCopy: 'Cập nhật công việc tại đây mà không cần nhập lại lịch hoặc nhà thầu.', email: 'Email', title: 'Công việc', customer: 'Khách hàng', phone: 'Điện thoại', address: 'Địa chỉ',
    jobNotes: 'Ghi chú công việc', priority: 'Ưu tiên', priorityLow: 'Thấp', priorityNormal: 'Bình thường', priorityHigh: 'Cao', priorityUrgent: 'Khẩn cấp', internalNotes: 'Ghi chú nhóm',
    customerNotes: 'Ghi chú khách hàng', completionVerified: 'Đã xác minh', saveDetails: 'Lưu', removeJobConfirm: 'Xóa công việc này?', unableToRemoveJob: 'Không thể xóa.', jobMarkedCancelled: 'Đã hủy công việc.', removeJob: 'Xóa',
    notes: 'Ghi chú', noNotes: 'Không có ghi chú', created: 'Đã tạo', startJob: 'Bắt đầu', markCompleted: 'Hoàn tất', schedule: 'Lịch', scheduleReadOnly: 'Lịch', startDate: 'Ngày', startTime: 'Bắt đầu',
    dueDate: 'Hạn', endTime: 'Kết thúc', start: 'Bắt đầu', due: 'Hạn', scheduledDuration: (duration) => duration, saving: 'Đang lưu...', saveSchedule: 'Lưu', photosTitle: 'Ảnh', photosCopy: 'Thêm ảnh trước và sau.',
    proofReport: 'Báo cáo', proofReportCopy: 'Chia sẻ chi tiết và ảnh.', creating: 'Đang tạo...', createReport: 'Tạo báo cáo', viewLatest: 'Xem báo cáo', activityTimeline: 'Hoạt động', noTimelineEntries: 'Chưa có hoạt động.', updateRecorded: 'Đã lưu',
    cancelJobConfirm: 'Hủy công việc này? Công việc sẽ không còn được tính trên bảng điều khiển.', restoreJobConfirm: 'Khôi phục công việc đã hủy và lên lịch lại?', jobRestored: 'Đã khôi phục công việc.',
    bookAgain: 'Đặt lại', creatingJob: 'Đang tạo...', duplicateFailed: 'Không thể tạo công việc tương tự.', duplicateCreated: 'Đã tạo công việc nháp. Xác nhận ngày và giờ.',
    confirmDateTime: 'Xác nhận ngày và giờ', confirmDateTimeCopy: 'Bản nháp này được tạo từ công việc trước. Chọn ngày và giờ mới.', unableToUpdateVisit: 'Không thể cập nhật lần làm này.', visitUpdated: 'Đã cập nhật lần làm.',
    futureScope: 'lần làm này và các lần làm chưa hoàn tất trong tương lai', seriesScope: 'chuỗi và các lần làm chưa hoàn tất trong tương lai',
    applySeriesChanges: (scope) => `Áp dụng chi tiết, giá và múi giờ hiện tại cho ${scope}? Các lần làm đã hoàn tất và đã trả tiền sẽ không thay đổi.`, unableToUpdateSeries: 'Không thể cập nhật chuỗi.',
    futureVisitsUpdated: (count) => `Đã cập nhật ${count} lần làm trong tương lai. Các lần đã hoàn tất không thay đổi.`, cancelGeneratedVisitsConfirm: 'Cũng hủy các lần làm tương lai đã tạo? Chọn Hủy để giữ lịch.',
    seriesPaused: 'Đã tạm dừng chuỗi.', seriesResumed: 'Đã tiếp tục chuỗi.', seriesEnded: 'Đã kết thúc chuỗi.', moreAdvanced: 'Thêm / Nâng cao', recurringSeries: 'Chuỗi định kỳ',
    recurringSeriesCopy: (date) => `Lần làm này thuộc chuỗi định kỳ${date ? ` (${date})` : ''}. Chỉ dùng các thao tác này cho các lần làm tương lai hoặc toàn bộ chuỗi.`,
    working: 'Đang xử lý...', skipVisit: 'Bỏ qua lần này', cancelVisit: 'Hủy lần này', editFuture: 'Sửa lần này và tương lai', editSeries: 'Sửa toàn bộ chuỗi',
    pauseSeries: 'Tạm dừng chuỗi', resumeSeries: 'Tiếp tục chuỗi', endSeries: 'Kết thúc chuỗi', internalMetadata: 'Chi tiết nội bộ', saveInternalNotes: 'Lưu ghi chú nhóm', jobId: 'Mã công việc', money: 'Tiền',
    deleteJob: 'Xóa',
    deleteJobSectionCopyOneTime: '',
    deleteJobSectionCopyRecurring: 'Xóa lần làm này và tất cả các lần trong tương lai? Các lần đã hoàn tất trước đó sẽ được giữ lại.',
    deleteJobConfirmOneTime: 'Xóa vĩnh viễn công việc này? Không thể hoàn tác.',
    deleteJobConfirmRecurring: 'Xóa lần làm này và tất cả các lần trong tương lai? Các lần đã hoàn tất trước đó sẽ được giữ lại. Không thể hoàn tác.',
    deletingJob: 'Đang xóa…',
    unableToDeleteJob: 'Không thể xóa vĩnh viễn công việc này.'
  }
};

export function getJobDetailCopy(locale: Locale): JobDetailCopy {
  return copy[locale] || copy.en;
}
