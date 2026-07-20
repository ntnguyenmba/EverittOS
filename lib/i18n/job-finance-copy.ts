import type { Locale } from '@/lib/i18n/config';

export type JobFinanceCopy = {
  sectionTitle: string;
  sectionCopy: string;
  recordPayment: string;
  createInvoice: string;
  paymentHelper: string;
  expectedJobAmount: string;
  expectedRevenue: string;
  collected: string;
  clientPayments: string;
  expenses: string;
  revenue: string;
  profit: string;
  balanceDue: string;
  outstanding: string;
  collectedProfit: string;
  expectedProfit: string;
  paymentStatus: string;
  statusUnpaid: string;
  statusPartiallyPaid: string;
  statusPaid: string;
  statusNoAmountSet: string;
  saveExpectedAmount: string;
  saveExpectedAmountHelper: string;
  paymentHistory: string;
  paymentViaInvoice: string;
  paymentDirect: string;
  paymentAmount: string;
  paymentDate: string;
  paymentMethod: string;
  paymentReference: string;
  paymentNotes: string;
  paymentSaved: string;
  paymentDeleted: string;
  deletePaymentConfirm: string;
  deletePayment: string;
  cancel: string;
  invalidAmount: string;
  unableToLoad: string;
  unableToSave: string;
  unableToRecord: string;
  loading: string;
  noPaymentsYet: string;
  photoInternalOnly: string;
  photoCustomerReport: string;
  photoBefore: string;
  photoAfter: string;
  photoOther: string;
  photoVisibilityHelper: string;
  photoVisibilitySaved: string;
  noCustomerPhotosYet: string;
  previewCustomerReport: string;
  copyShareLink: string;
  regenerateLink: string;
  revokeLink: string;
  printReport: string;
  shareLinkCopied: string;
  shareLinkRevoked: string;
  customerReportShareHelper: string;
  customerCompletionNotes: string;
  reportNotAvailable: string;
  reportNoPhotos: string;
  reportServiceTitle: string;
  reportCompletionSummary: string;
  reportGeneratedOn: string;
};

const copy: Record<Locale, JobFinanceCopy> = {
  en: {
    sectionTitle: 'Payments & Profit',
    sectionCopy: 'Track expected amounts, client payments, expenses, and profit for this job.',
    recordPayment: 'Record Payment',
    createInvoice: 'Create Invoice',
    paymentHelper: 'Record a payment even if the invoice was created somewhere else.',
    expectedJobAmount: 'Expected Job Amount',
    expectedRevenue: 'Expected Revenue',
    collected: 'Collected',
    clientPayments: 'Client Payments',
    expenses: 'Expenses',
    revenue: 'Revenue',
    profit: 'Profit',
    balanceDue: 'Balance Due',
    outstanding: 'Outstanding',
    collectedProfit: 'Collected Profit',
    expectedProfit: 'Expected Profit',
    paymentStatus: 'Payment status',
    statusUnpaid: 'Unpaid',
    statusPartiallyPaid: 'Partially Paid',
    statusPaid: 'Paid',
    statusNoAmountSet: 'No amount set',
    saveExpectedAmount: 'Save expected amount',
    saveExpectedAmountHelper: 'Set what the customer should pay for this job.',
    paymentHistory: 'Payment history',
    paymentViaInvoice: 'Via invoice',
    paymentDirect: 'Direct job payment',
    paymentAmount: 'Amount',
    paymentDate: 'Payment date',
    paymentMethod: 'Payment method',
    paymentReference: 'Reference (optional)',
    paymentNotes: 'Notes (optional)',
    paymentSaved: 'Payment recorded.',
    paymentDeleted: 'Payment removed.',
    deletePaymentConfirm: 'Remove this payment record?',
    deletePayment: 'Remove payment',
    cancel: 'Cancel',
    invalidAmount: 'Enter a positive payment amount.',
    unableToLoad: 'Unable to load job financials.',
    unableToSave: 'Unable to save expected amount.',
    unableToRecord: 'Unable to record payment.',
    loading: 'Loading...',
    noPaymentsYet: 'No client payments recorded yet.',
    photoInternalOnly: 'Internal only',
    photoCustomerReport: 'Include in customer report',
    photoBefore: 'Before',
    photoAfter: 'After',
    photoOther: 'Other',
    photoVisibilityHelper: 'Only photos marked for the customer report will be visible through the share link.',
    photoVisibilitySaved: 'Photo visibility updated.',
    noCustomerPhotosYet: 'No photos are included in the customer report yet. Select the photos you want the customer to see.',
    previewCustomerReport: 'Preview Customer Report',
    copyShareLink: 'Copy Share Link',
    regenerateLink: 'Regenerate Link',
    revokeLink: 'Revoke Link',
    printReport: 'Print Report',
    shareLinkCopied: 'Share link copied.',
    shareLinkRevoked: 'Share link revoked.',
    customerReportShareHelper: 'Share a secure link with your customer. Internal photos and notes stay private.',
    customerCompletionNotes: 'Customer-facing completion notes',
    reportNotAvailable: 'This report link is not available.',
    reportNoPhotos: 'The service report is available, but no photos were included.',
    reportServiceTitle: 'Service report',
    reportCompletionSummary: 'Completion summary',
    reportGeneratedOn: 'Generated'
  },
  es: {
    sectionTitle: 'Pagos y ganancia',
    sectionCopy: 'Registre montos esperados, pagos del cliente, gastos y ganancia de este trabajo.',
    recordPayment: 'Registrar pago',
    createInvoice: 'Crear factura',
    paymentHelper: 'Registre un pago aunque la factura se haya creado en otro lugar.',
    expectedJobAmount: 'Monto esperado del trabajo',
    expectedRevenue: 'Ingresos esperados',
    collected: 'Cobrado',
    clientPayments: 'Pagos del cliente',
    expenses: 'Gastos',
    revenue: 'Ingresos',
    profit: 'Ganancia',
    balanceDue: 'Saldo pendiente',
    outstanding: 'Pendiente',
    collectedProfit: 'Ganancia cobrada',
    expectedProfit: 'Ganancia esperada',
    paymentStatus: 'Estado de pago',
    statusUnpaid: 'Sin pagar',
    statusPartiallyPaid: 'Parcialmente pagado',
    statusPaid: 'Pagado',
    statusNoAmountSet: 'Sin monto definido',
    saveExpectedAmount: 'Guardar monto esperado',
    saveExpectedAmountHelper: 'Indique lo que el cliente debe pagar por este trabajo.',
    paymentHistory: 'Historial de pagos',
    paymentViaInvoice: 'Por factura',
    paymentDirect: 'Pago directo al trabajo',
    paymentAmount: 'Monto',
    paymentDate: 'Fecha de pago',
    paymentMethod: 'Método de pago',
    paymentReference: 'Referencia (opcional)',
    paymentNotes: 'Notas (opcional)',
    paymentSaved: 'Pago registrado.',
    paymentDeleted: 'Pago eliminado.',
    deletePaymentConfirm: '¿Eliminar este registro de pago?',
    deletePayment: 'Eliminar pago',
    cancel: 'Cancelar',
    invalidAmount: 'Ingrese un monto de pago positivo.',
    unableToLoad: 'No se pudieron cargar las finanzas del trabajo.',
    unableToSave: 'No se pudo guardar el monto esperado.',
    unableToRecord: 'No se pudo registrar el pago.',
    loading: 'Cargando...',
    noPaymentsYet: 'Aún no hay pagos del cliente registrados.',
    photoInternalOnly: 'Solo interno',
    photoCustomerReport: 'Incluir en informe al cliente',
    photoBefore: 'Antes',
    photoAfter: 'Después',
    photoOther: 'Otro',
    photoVisibilityHelper: 'Solo las fotos marcadas para el informe al cliente serán visibles en el enlace compartido.',
    photoVisibilitySaved: 'Visibilidad de foto actualizada.',
    noCustomerPhotosYet: 'Aún no hay fotos incluidas en el informe al cliente. Seleccione las fotos que desea mostrar.',
    previewCustomerReport: 'Vista previa del informe al cliente',
    copyShareLink: 'Copiar enlace',
    regenerateLink: 'Regenerar enlace',
    revokeLink: 'Revocar enlace',
    printReport: 'Imprimir informe',
    shareLinkCopied: 'Enlace copiado.',
    shareLinkRevoked: 'Enlace revocado.',
    customerReportShareHelper: 'Comparta un enlace seguro con su cliente. Las fotos y notas internas permanecen privadas.',
    customerCompletionNotes: 'Notas de finalización para el cliente',
    reportNotAvailable: 'Este enlace de informe no está disponible.',
    reportNoPhotos: 'El informe de servicio está disponible, pero no se incluyeron fotos.',
    reportServiceTitle: 'Informe de servicio',
    reportCompletionSummary: 'Resumen de finalización',
    reportGeneratedOn: 'Generado'
  },
  vi: {
    sectionTitle: 'Thanh toán và lợi nhuận',
    sectionCopy: 'Theo dõi số tiền dự kiến, thanh toán của khách, chi phí và lợi nhuận cho công việc này.',
    recordPayment: 'Ghi nhận thanh toán',
    createInvoice: 'Tạo hóa đơn',
    paymentHelper: 'Ghi nhận thanh toán ngay cả khi hóa đơn được tạo ở nơi khác.',
    expectedJobAmount: 'Số tiền dự kiến của công việc',
    expectedRevenue: 'Doanh thu dự kiến',
    collected: 'Đã thu',
    clientPayments: 'Thanh toán của khách',
    expenses: 'Chi phí',
    revenue: 'Doanh thu',
    profit: 'Lợi nhuận',
    balanceDue: 'Số còn nợ',
    outstanding: 'Còn phải thu',
    collectedProfit: 'Lợi nhuận đã thu',
    expectedProfit: 'Lợi nhuận dự kiến',
    paymentStatus: 'Trạng thái thanh toán',
    statusUnpaid: 'Chưa thanh toán',
    statusPartiallyPaid: 'Thanh toán một phần',
    statusPaid: 'Đã thanh toán',
    statusNoAmountSet: 'Chưa đặt số tiền',
    saveExpectedAmount: 'Lưu số tiền dự kiến',
    saveExpectedAmountHelper: 'Nhập số tiền khách hàng cần trả cho công việc này.',
    paymentHistory: 'Lịch sử thanh toán',
    paymentViaInvoice: 'Qua hóa đơn',
    paymentDirect: 'Thanh toán trực tiếp cho công việc',
    paymentAmount: 'Số tiền',
    paymentDate: 'Ngày thanh toán',
    paymentMethod: 'Phương thức thanh toán',
    paymentReference: 'Mã tham chiếu (tùy chọn)',
    paymentNotes: 'Ghi chú (tùy chọn)',
    paymentSaved: 'Đã ghi nhận thanh toán.',
    paymentDeleted: 'Đã xóa thanh toán.',
    deletePaymentConfirm: 'Xóa bản ghi thanh toán này?',
    deletePayment: 'Xóa thanh toán',
    cancel: 'Hủy',
    invalidAmount: 'Nhập số tiền thanh toán lớn hơn 0.',
    unableToLoad: 'Không thể tải dữ liệu tài chính của công việc.',
    unableToSave: 'Không thể lưu số tiền dự kiến.',
    unableToRecord: 'Không thể ghi nhận thanh toán.',
    loading: 'Đang tải...',
    noPaymentsYet: 'Chưa có thanh toán của khách được ghi nhận.',
    photoInternalOnly: 'Chỉ nội bộ',
    photoCustomerReport: 'Đưa vào báo cáo cho khách',
    photoBefore: 'Trước',
    photoAfter: 'Sau',
    photoOther: 'Khác',
    photoVisibilityHelper: 'Chỉ ảnh được đánh dấu cho báo cáo khách mới hiển thị qua liên kết chia sẻ.',
    photoVisibilitySaved: 'Đã cập nhật hiển thị ảnh.',
    noCustomerPhotosYet: 'Chưa có ảnh nào trong báo cáo cho khách. Chọn ảnh bạn muốn khách xem.',
    previewCustomerReport: 'Xem trước báo cáo khách',
    copyShareLink: 'Sao chép liên kết',
    regenerateLink: 'Tạo lại liên kết',
    revokeLink: 'Thu hồi liên kết',
    printReport: 'In báo cáo',
    shareLinkCopied: 'Đã sao chép liên kết.',
    shareLinkRevoked: 'Đã thu hồi liên kết.',
    customerReportShareHelper: 'Chia sẻ liên kết an toàn với khách. Ảnh và ghi chú nội bộ vẫn được giữ riêng.',
    customerCompletionNotes: 'Ghi chú hoàn thành cho khách',
    reportNotAvailable: 'Liên kết báo cáo này không khả dụng.',
    reportNoPhotos: 'Báo cáo dịch vụ có sẵn, nhưng không có ảnh nào được đưa vào.',
    reportServiceTitle: 'Báo cáo dịch vụ',
    reportCompletionSummary: 'Tóm tắt hoàn thành',
    reportGeneratedOn: 'Tạo lúc'
  }
};

export function getJobFinanceCopy(locale: Locale): JobFinanceCopy {
  return copy[locale] || copy.en;
}

export function paymentMethodLabel(method: string, locale: Locale): string {
  const labels: Record<Locale, Record<string, string>> = {
    en: {
      Cash: 'Cash',
      Check: 'Check',
      'ACH / Bank Transfer': 'ACH / Bank Transfer',
      Zelle: 'Zelle',
      Venmo: 'Venmo',
      'Credit Card': 'Credit Card',
      'Debit Card': 'Debit Card',
      Stripe: 'Stripe',
      Square: 'Square',
      'Property Management Portal': 'Property Management Portal',
      Other: 'Other'
    },
    es: {
      Cash: 'Efectivo',
      Check: 'Cheque',
      'ACH / Bank Transfer': 'ACH / transferencia bancaria',
      Zelle: 'Zelle',
      Venmo: 'Venmo',
      'Credit Card': 'Tarjeta de crédito',
      'Debit Card': 'Tarjeta de débito',
      Stripe: 'Stripe',
      Square: 'Square',
      'Property Management Portal': 'Portal de administración',
      Other: 'Otro'
    },
    vi: {
      Cash: 'Tiền mặt',
      Check: 'Séc',
      'ACH / Bank Transfer': 'ACH / chuyển khoản',
      Zelle: 'Zelle',
      Venmo: 'Venmo',
      'Credit Card': 'Thẻ tín dụng',
      'Debit Card': 'Thẻ ghi nợ',
      Stripe: 'Stripe',
      Square: 'Square',
      'Property Management Portal': 'Cổng quản lý tài sản',
      Other: 'Khác'
    }
  };
  return labels[locale]?.[method] || labels.en[method] || method;
}
