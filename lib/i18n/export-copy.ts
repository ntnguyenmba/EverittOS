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
    job: 'Job'
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
    job: 'Trabajo'
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
    job: 'Công việc'
  }
};

export function getExportCopy(locale: Locale): ExportCopy {
  return copy[locale] || copy.en;
}
