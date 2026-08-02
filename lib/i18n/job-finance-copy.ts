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
    sectionCopy: 'Record money already received, or send the customer an invoice to request payment.',
    recordPayment: 'Record payment',
    createInvoice: 'Send invoice',
    paymentHelper: 'Use Record payment only after the customer has paid. Use Send invoice when the customer still needs to pay.',
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
    paymentViaInvoice: 'Invoice payment',
    paymentDirect: 'Recorded payment',
    paymentAmount: 'Amount',
    paymentDate: 'Date',
    paymentMethod: 'Method',
    paymentReference: 'Reference',
    paymentNotes: 'Notes',
    paymentSaved: 'Payment recorded. A receipt will be sent when an email address is available.',
    paymentUpdated: 'Payment updated.',
    paymentDeleted: 'Payment removed.',
    deletePaymentConfirm: 'Remove this payment?',
    deletePayment: 'Remove',
    confirmRemove: 'Remove',
    editPayment: 'Edit',
    viewReceipt: 'View receipt',
    saveChanges: 'Save',
    expensesAndProfit: 'Expenses & profit',
    cancel: 'Cancel',
    invalidAmount: 'Enter an amount above 0.',
    unableToLoad: 'Could not load money details.',
    unableToSave: 'Could not save amount.',
    unableToRecord: 'Could not record payment.',
    loading: 'Loading...',
    noPaymentsYet: 'No payments recorded yet.',
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
    sectionCopy: 'Registra dinero ya recibido o envía una factura para solicitar el pago.',
    recordPayment: 'Registrar pago',
    createInvoice: 'Enviar factura',
    paymentHelper: 'Usa Registrar pago solo cuando el cliente ya pagó. Usa Enviar factura cuando todavía debe pagar.',
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
    paymentViaInvoice: 'Pago de factura',
    paymentDirect: 'Pago registrado',
    paymentAmount: 'Monto',
    paymentDate: 'Fecha',
    paymentMethod: 'Método',
    paymentReference: 'Referencia',
    paymentNotes: 'Notas',
    paymentSaved: 'Pago registrado. Se enviará un recibo cuando haya un correo disponible.',
    paymentUpdated: 'Pago actualizado.',
    paymentDeleted: 'Pago eliminado.',
    deletePaymentConfirm: '¿Eliminar este pago?',
    deletePayment: 'Eliminar',
    confirmRemove: 'Eliminar',
    editPayment: 'Editar',
    viewReceipt: 'Ver recibo',
    saveChanges: 'Guardar',
    expensesAndProfit: 'Gastos y ganancia',
    cancel: 'Cancelar',
    invalidAmount: 'Ingresa un monto mayor que 0.',
    unableToLoad: 'No se pudo cargar el dinero.',
    unableToSave: 'No se pudo guardar el monto.',
    unableToRecord: 'No se pudo registrar el pago.',
    loading: 'Cargando...',
    noPaymentsYet: 'Aún no hay pagos registrados.',
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
    sectionCopy: 'Ghi nhận tiền đã nhận hoặc gửi hóa đơn để yêu cầu khách thanh toán.',
    recordPayment: 'Ghi nhận thanh toán',
    createInvoice: 'Gửi hóa đơn',
    paymentHelper: 'Chỉ dùng Ghi nhận thanh toán sau khi khách đã trả. Dùng Gửi hóa đơn khi khách vẫn cần thanh toán.',
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
    paymentViaInvoice: 'Thanh toán hóa đơn',
    paymentDirect: 'Thanh toán đã ghi nhận',
    paymentAmount: 'Số tiền',
    paymentDate: 'Ngày',
    paymentMethod: 'Cách trả',
    paymentReference: 'Mã tham chiếu',
    paymentNotes: 'Ghi chú',
    paymentSaved: 'Đã ghi nhận thanh toán. Biên nhận sẽ được gửi khi có địa chỉ email.',
    paymentUpdated: 'Đã cập nhật.',
    paymentDeleted: 'Đã xóa thanh toán.',
    deletePaymentConfirm: 'Xóa thanh toán này?',
    deletePayment: 'Xóa',
    confirmRemove: 'Xóa',
    editPayment: 'Sửa',
    viewReceipt: 'Xem biên nhận',
    saveChanges: 'Lưu',
    expensesAndProfit: 'Chi phí và lợi nhuận',
    cancel: 'Hủy',
    invalidAmount: 'Nhập số tiền lớn hơn 0.',
    unableToLoad: 'Không thể tải thông tin tiền.',
    unableToSave: 'Không thể lưu số tiền.',
    unableToRecord: 'Không thể ghi nhận thanh toán.',
    loading: 'Đang tải...',
    noPaymentsYet: 'Chưa có thanh toán nào được ghi nhận.',
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
