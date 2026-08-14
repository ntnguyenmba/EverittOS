import type { Locale } from '@/lib/i18n/config';

export type ExportCopy = {
  export: string;
  exportCsv: string;
  exportPdf: string;
  downloadMyJobs: string;
  downloadMyJobsCsv: string;
  downloadMyJobsPdf: string;
  myJobHistory: string;
  myAssignedJobs: string;
  privateCompanyRecord: string;
  preparingExport: string;
  exportFailed: string;
  noRecords: string;
  appliedFilters: string;
  generatedOn: string;
  page: string;
  openJob: string;
  job: string;
  shareByEmail: string;
  emailAddress: string;
  sendCsv: string;
  sendPdf: string;
  sending: string;
  shareSent: string;
  shareFailed: string;
  invalidEmail: string;
  emailNotConfigured: string;
  emailSubject: string;
  emailBody: string;
  jobsFinancialTitle: string;
  jobsOperationalTitle: string;
  teamTitle: string;
  expensesTitle: string;
  customersTitle: string;
  invoicesTitle: string;
  paymentsTitle: string;
  dashboardTitle: string;
  dashboardDetailsTitle: string;
  bookkeepingTitle: string;
  contractorPayTitle: string;
  membersLabel: string;
  pendingInvitationsLabel: string;
  recordsLabel: string;
  totalLabel: string;
  rangeLabel: string;
};

const copy: Record<Locale, ExportCopy> = {
  en: {
    export: 'Export',
    exportCsv: 'Export CSV',
    exportPdf: 'Export PDF',
    downloadMyJobs: 'Download my jobs',
    downloadMyJobsCsv: 'Download my jobs CSV',
    downloadMyJobsPdf: 'Download my jobs PDF',
    myJobHistory: 'My job history',
    myAssignedJobs: 'My assigned jobs',
    privateCompanyRecord: 'Private company record',
    preparingExport: 'Preparing export…',
    exportFailed: 'Export failed.',
    noRecords: 'No records to export.',
    appliedFilters: 'Applied filters',
    generatedOn: 'Generated on',
    page: 'Page',
    openJob: 'Open job',
    job: 'Job',
    shareByEmail: 'Share by email',
    emailAddress: 'Email address',
    sendCsv: 'Send CSV',
    sendPdf: 'Send PDF',
    sending: 'Sending…',
    shareSent: 'Export sent.',
    shareFailed: 'Unable to send the export.',
    invalidEmail: 'Enter a valid email address.',
    emailNotConfigured: 'Email is not configured yet.',
    emailSubject: 'EverittOS export: {title}',
    emailBody: 'The requested EverittOS export is attached.',
    jobsFinancialTitle: 'Jobs financial export',
    jobsOperationalTitle: 'Jobs operational export',
    teamTitle: 'Team export',
    expensesTitle: 'Expenses export',
    customersTitle: 'Customers export',
    invoicesTitle: 'Invoices export',
    paymentsTitle: 'Payments export',
    dashboardTitle: 'Dashboard financial report',
    dashboardDetailsTitle: 'Dashboard details export',
    bookkeepingTitle: 'Bookkeeping export',
    contractorPayTitle: 'Contractor pay export',
    membersLabel: 'Members',
    pendingInvitationsLabel: 'Pending invitations',
    recordsLabel: 'Records',
    totalLabel: 'Total',
    rangeLabel: 'Period'
  },
  es: {
    export: 'Exportar',
    exportCsv: 'Exportar CSV',
    exportPdf: 'Exportar PDF',
    downloadMyJobs: 'Descargar mis trabajos',
    downloadMyJobsCsv: 'Descargar mis trabajos CSV',
    downloadMyJobsPdf: 'Descargar mis trabajos PDF',
    myJobHistory: 'Mi historial de trabajos',
    myAssignedJobs: 'Mis trabajos asignados',
    privateCompanyRecord: 'Registro privado de la empresa',
    preparingExport: 'Preparando exportación…',
    exportFailed: 'Error al exportar.',
    noRecords: 'No hay registros para exportar.',
    appliedFilters: 'Filtros aplicados',
    generatedOn: 'Generado el',
    page: 'Página',
    openJob: 'Abrir trabajo',
    job: 'Trabajo',
    shareByEmail: 'Compartir por correo',
    emailAddress: 'Correo electrónico',
    sendCsv: 'Enviar CSV',
    sendPdf: 'Enviar PDF',
    sending: 'Enviando…',
    shareSent: 'Exportación enviada.',
    shareFailed: 'No se pudo enviar la exportación.',
    invalidEmail: 'Introduce una dirección de correo válida.',
    emailNotConfigured: 'El correo aún no está configurado.',
    emailSubject: 'Exportación de EverittOS: {title}',
    emailBody: 'Se adjunta la exportación de EverittOS solicitada.',
    jobsFinancialTitle: 'Exportación financiera de trabajos',
    jobsOperationalTitle: 'Exportación operativa de trabajos',
    teamTitle: 'Exportación del equipo',
    expensesTitle: 'Exportación de gastos',
    customersTitle: 'Exportación de clientes',
    invoicesTitle: 'Exportación de facturas',
    paymentsTitle: 'Exportación de pagos',
    dashboardTitle: 'Informe financiero del panel',
    dashboardDetailsTitle: 'Exportación de detalles del panel',
    bookkeepingTitle: 'Exportación de registros financieros',
    contractorPayTitle: 'Exportación de pagos a contratistas',
    membersLabel: 'Miembros',
    pendingInvitationsLabel: 'Invitaciones pendientes',
    recordsLabel: 'Registros',
    totalLabel: 'Total',
    rangeLabel: 'Período'
  },
  vi: {
    export: 'Xuất',
    exportCsv: 'Xuất CSV',
    exportPdf: 'Xuất PDF',
    downloadMyJobs: 'Tải công việc của tôi',
    downloadMyJobsCsv: 'Tải CSV công việc của tôi',
    downloadMyJobsPdf: 'Tải PDF công việc của tôi',
    myJobHistory: 'Lịch sử công việc của tôi',
    myAssignedJobs: 'Công việc được giao cho tôi',
    privateCompanyRecord: 'Hồ sơ nội bộ công ty',
    preparingExport: 'Đang chuẩn bị xuất…',
    exportFailed: 'Xuất thất bại.',
    noRecords: 'Không có bản ghi để xuất.',
    appliedFilters: 'Bộ lọc đã áp dụng',
    generatedOn: 'Tạo lúc',
    page: 'Trang',
    openJob: 'Mở công việc',
    job: 'Công việc',
    shareByEmail: 'Chia sẻ bằng email',
    emailAddress: 'Địa chỉ email',
    sendCsv: 'Gửi CSV',
    sendPdf: 'Gửi PDF',
    sending: 'Đang gửi…',
    shareSent: 'Đã gửi bản xuất.',
    shareFailed: 'Không thể gửi bản xuất.',
    invalidEmail: 'Nhập địa chỉ email hợp lệ.',
    emailNotConfigured: 'Email chưa được cấu hình.',
    emailSubject: 'Bản xuất EverittOS: {title}',
    emailBody: 'Bản xuất EverittOS bạn yêu cầu được đính kèm.',
    jobsFinancialTitle: 'Xuất tài chính công việc',
    jobsOperationalTitle: 'Xuất vận hành công việc',
    teamTitle: 'Xuất đội ngũ',
    expensesTitle: 'Xuất chi phí',
    customersTitle: 'Xuất khách hàng',
    invoicesTitle: 'Xuất hóa đơn',
    paymentsTitle: 'Xuất thanh toán',
    dashboardTitle: 'Báo cáo tài chính bảng điều khiển',
    dashboardDetailsTitle: 'Xuất chi tiết bảng điều khiển',
    bookkeepingTitle: 'Xuất sổ thu chi',
    contractorPayTitle: 'Xuất thanh toán nhà thầu',
    membersLabel: 'Thành viên',
    pendingInvitationsLabel: 'Lời mời đang chờ',
    recordsLabel: 'Bản ghi',
    totalLabel: 'Tổng',
    rangeLabel: 'Khoảng thời gian'
  }
};

export function getExportCopy(locale: Locale): ExportCopy {
  return copy[locale] || copy.en;
}

export function formatExportCopy(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => String(values[key] ?? ''));
}
