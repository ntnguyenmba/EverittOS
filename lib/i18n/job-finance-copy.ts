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
  paymentUpdated: string;
  paymentDeleted: string;
  deletePaymentConfirm: string;
  deletePayment: string;
  confirmRemove: string;
  editPayment: string;
  viewReceipt: string;
  saveChanges: string;
  expensesAndProfit: string;
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
  photoProgress: string;
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
    sectionTitle: 'Money',
    sectionCopy: 'Payments, expenses, and profit.',
    recordPayment: 'Get paid',
    createInvoice: 'Invoice',
    paymentHelper: '',
    expectedJobAmount: 'Job amount',
    expectedRevenue: 'Expected',
    collected: 'Paid',
    clientPayments: 'Payments',
    expenses: 'Expenses',
    revenue: 'Income',
    profit: 'Profit',
    balanceDue: 'Owed',
    outstanding: 'Owed',
    collectedProfit: 'Profit collected',
    expectedProfit: 'Expected profit',
    paymentStatus: 'Status',
    statusUnpaid: 'Unpaid',
    statusPartiallyPaid: 'Part paid',
    statusPaid: 'Paid',
    statusNoAmountSet: 'No amount',
    saveExpectedAmount: 'Save',
    saveExpectedAmountHelper: 'What should the customer pay?',
    paymentHistory: 'Payments',
    paymentViaInvoice: 'Invoice',
    paymentDirect: 'Payment',
    paymentAmount: 'Amount',
    paymentDate: 'Date',
    paymentMethod: 'Method',
    paymentReference: 'Reference',
    paymentNotes: 'Notes',
    paymentSaved: 'Payment saved.',
    paymentUpdated: 'Payment updated.',
    paymentDeleted: 'Payment removed.',
    deletePaymentConfirm: 'Remove this payment?',
    deletePayment: 'Remove',
    confirmRemove: 'Remove',
    editPayment: 'Edit',
    viewReceipt: 'Receipt',
    saveChanges: 'Save',
    expensesAndProfit: 'Expenses & profit',
    cancel: 'Cancel',
    invalidAmount: 'Enter an amount above 0.',
    unableToLoad: 'Could not load money details.',
    unableToSave: 'Could not save amount.',
    unableToRecord: 'Could not save payment.',
    loading: 'Loading...',
    noPaymentsYet: 'No payments yet.',
    photoInternalOnly: 'Private',
    photoCustomerReport: 'Show customer',
    photoBefore: 'Before',
    photoAfter: 'After',
    photoProgress: 'Progress',
    photoOther: 'Progress',
    photoVisibilityHelper: 'Only selected photos appear in the report.',
    photoVisibilitySaved: 'Photo updated.',
    noCustomerPhotosYet: 'Choose photos for the customer report.',
    previewCustomerReport: 'Preview report',
    copyShareLink: 'Copy link',
    regenerateLink: 'New link',
    revokeLink: 'Turn off link',
    printReport: 'Print',
    shareLinkCopied: 'Link copied.',
    shareLinkRevoked: 'Link turned off.',
    customerReportShareHelper: 'Share this secure link with the customer.',
    customerCompletionNotes: 'Customer notes',
    reportNotAvailable: 'This report is not available.',
    reportNoPhotos: 'No photos were added to this report.',
    reportServiceTitle: 'Job report',
    reportCompletionSummary: 'Summary',
    reportGeneratedOn: 'Created'
  },
  es: {
    sectionTitle: 'Dinero',
    sectionCopy: 'Pagos, gastos y ganancia.',
    recordPayment: 'Cobrar',
    createInvoice: 'Factura',
    paymentHelper: '',
    expectedJobAmount: 'Monto del trabajo',
    expectedRevenue: 'Esperado',
    collected: 'Pagado',
    clientPayments: 'Pagos',
    expenses: 'Gastos',
    revenue: 'Ingresos',
    profit: 'Ganancia',
    balanceDue: 'Debe',
    outstanding: 'Debe',
    collectedProfit: 'Ganancia cobrada',
    expectedProfit: 'Ganancia esperada',
    paymentStatus: 'Estado',
    statusUnpaid: 'Sin pagar',
    statusPartiallyPaid: 'Pago parcial',
    statusPaid: 'Pagado',
    statusNoAmountSet: 'Sin monto',
    saveExpectedAmount: 'Guardar',
    saveExpectedAmountHelper: '¿Cuánto debe pagar el cliente?',
    paymentHistory: 'Pagos',
    paymentViaInvoice: 'Factura',
    paymentDirect: 'Pago',
    paymentAmount: 'Monto',
    paymentDate: 'Fecha',
    paymentMethod: 'Método',
    paymentReference: 'Referencia',
    paymentNotes: 'Notas',
    paymentSaved: 'Pago guardado.',
    paymentUpdated: 'Pago actualizado.',
    paymentDeleted: 'Pago eliminado.',
    deletePaymentConfirm: '¿Eliminar este pago?',
    deletePayment: 'Eliminar',
    confirmRemove: 'Eliminar',
    editPayment: 'Editar',
    viewReceipt: 'Recibo',
    saveChanges: 'Guardar',
    expensesAndProfit: 'Gastos y ganancia',
    cancel: 'Cancelar',
    invalidAmount: 'Ingresa un monto mayor que 0.',
    unableToLoad: 'No se pudo cargar el dinero.',
    unableToSave: 'No se pudo guardar el monto.',
    unableToRecord: 'No se pudo guardar el pago.',
    loading: 'Cargando...',
    noPaymentsYet: 'Sin pagos.',
    photoInternalOnly: 'Privada',
    photoCustomerReport: 'Mostrar al cliente',
    photoBefore: 'Antes',
    photoAfter: 'Después',
    photoProgress: 'Progreso',
    photoOther: 'Progreso',
    photoVisibilityHelper: 'Solo las fotos elegidas aparecen en el informe.',
    photoVisibilitySaved: 'Foto actualizada.',
    noCustomerPhotosYet: 'Elige fotos para el informe.',
    previewCustomerReport: 'Ver informe',
    copyShareLink: 'Copiar enlace',
    regenerateLink: 'Nuevo enlace',
    revokeLink: 'Desactivar enlace',
    printReport: 'Imprimir',
    shareLinkCopied: 'Enlace copiado.',
    shareLinkRevoked: 'Enlace desactivado.',
    customerReportShareHelper: 'Comparte este enlace seguro con el cliente.',
    customerCompletionNotes: 'Notas del cliente',
    reportNotAvailable: 'Este informe no está disponible.',
    reportNoPhotos: 'No se agregaron fotos.',
    reportServiceTitle: 'Informe del trabajo',
    reportCompletionSummary: 'Resumen',
    reportGeneratedOn: 'Creado'
  },
  vi: {
    sectionTitle: 'Tiền',
    sectionCopy: 'Thanh toán, chi phí và lợi nhuận.',
    recordPayment: 'Nhận tiền',
    createInvoice: 'Hóa đơn',
    paymentHelper: '',
    expectedJobAmount: 'Tiền công việc',
    expectedRevenue: 'Dự kiến',
    collected: 'Đã trả',
    clientPayments: 'Thanh toán',
    expenses: 'Chi phí',
    revenue: 'Thu nhập',
    profit: 'Lợi nhuận',
    balanceDue: 'Còn nợ',
    outstanding: 'Còn nợ',
    collectedProfit: 'Lợi nhuận đã thu',
    expectedProfit: 'Lợi nhuận dự kiến',
    paymentStatus: 'Trạng thái',
    statusUnpaid: 'Chưa trả',
    statusPartiallyPaid: 'Trả một phần',
    statusPaid: 'Đã trả',
    statusNoAmountSet: 'Chưa có số tiền',
    saveExpectedAmount: 'Lưu',
    saveExpectedAmountHelper: 'Khách cần trả bao nhiêu?',
    paymentHistory: 'Thanh toán',
    paymentViaInvoice: 'Hóa đơn',
    paymentDirect: 'Thanh toán',
    paymentAmount: 'Số tiền',
    paymentDate: 'Ngày',
    paymentMethod: 'Cách trả',
    paymentReference: 'Mã tham chiếu',
    paymentNotes: 'Ghi chú',
    paymentSaved: 'Đã lưu thanh toán.',
    paymentUpdated: 'Đã cập nhật.',
    paymentDeleted: 'Đã xóa thanh toán.',
    deletePaymentConfirm: 'Xóa thanh toán này?',
    deletePayment: 'Xóa',
    confirmRemove: 'Xóa',
    editPayment: 'Sửa',
    viewReceipt: 'Biên nhận',
    saveChanges: 'Lưu',
    expensesAndProfit: 'Chi phí và lợi nhuận',
    cancel: 'Hủy',
    invalidAmount: 'Nhập số tiền lớn hơn 0.',
    unableToLoad: 'Không thể tải thông tin tiền.',
    unableToSave: 'Không thể lưu số tiền.',
    unableToRecord: 'Không thể lưu thanh toán.',
    loading: 'Đang tải...',
    noPaymentsYet: 'Chưa có thanh toán.',
    photoInternalOnly: 'Riêng tư',
    photoCustomerReport: 'Cho khách xem',
    photoBefore: 'Trước',
    photoAfter: 'Sau',
    photoProgress: 'Tiến độ',
    photoOther: 'Tiến độ',
    photoVisibilityHelper: 'Chỉ ảnh đã chọn xuất hiện trong báo cáo.',
    photoVisibilitySaved: 'Đã cập nhật ảnh.',
    noCustomerPhotosYet: 'Chọn ảnh cho báo cáo khách hàng.',
    previewCustomerReport: 'Xem báo cáo',
    copyShareLink: 'Sao chép liên kết',
    regenerateLink: 'Liên kết mới',
    revokeLink: 'Tắt liên kết',
    printReport: 'In',
    shareLinkCopied: 'Đã sao chép.',
    shareLinkRevoked: 'Đã tắt liên kết.',
    customerReportShareHelper: 'Chia sẻ liên kết an toàn này với khách.',
    customerCompletionNotes: 'Ghi chú cho khách',
    reportNotAvailable: 'Báo cáo này không có sẵn.',
    reportNoPhotos: 'Chưa thêm ảnh.',
    reportServiceTitle: 'Báo cáo công việc',
    reportCompletionSummary: 'Tóm tắt',
    reportGeneratedOn: 'Đã tạo'
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
