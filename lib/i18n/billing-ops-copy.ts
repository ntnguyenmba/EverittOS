import type { Locale } from '@/lib/i18n/config';
import { normalizeLocale } from '@/lib/i18n/config';
import type { JobBillingStatus } from '@/lib/jobs/billing-status';
import type { OutboundDocType, OutboundTab } from '@/lib/outbound/types';

export type BillingOpsCopy = {
  createInvoice: string;
  createDraft: string;
  createAnInvoice: string;
  sendReceipt: string;
  paymentReceipt: string;
  paymentRecorded: string;
  notInvoiced: string;
  draftInvoice: string;
  invoiceSent: string;
  invoiceSentUnpaid: string;
  partiallyPaid: string;
  paid: string;
  unpaid: string;
  overdue: string;
  cancelled: string;
  receiptSent: string;
  later: string;
  billingStatus: string;
  missingAmount: string;
  missingAmountHint: string;
  existingInvoiceFound: string;
  existingReceiptFound: string;
  loadingPrefill: string;
  jobCompleted: string;
  jobCompletedHint: string;
  receiptsSubtitle: string;
  createAnotherInvoice: string;
  loading: string;
  loadingDocuments: string;
  unableLoadDocuments: string;
  unableLoadInvoice: string;
  unableLoadReceipt: string;
  unableRecordPayment: string;
  unableSave: string;
  sendFailed: string;
  emailFailed: string;
  deliveryFailed: string;
  deleteFailed: string;
  scheduled: string;
  draft: string;
  sent: string;
  retry: string;
  edit: string;
  remove: string;
  deleteDraft: string;
  cancelSchedule: string;
  hideFromHistory: string;
  removeItemConfirm: string;
  nothingSentYet: string;
  noScheduledItems: string;
  noDrafts: string;
  noFailedDeliveries: string;
  noInvoicesMatchFilter: string;
  recordPayment: string;
  savePayment: string;
  saving: string;
  savingEllipsis: string;
  saved: string;
  notSavedRetry: string;
  autoSaveOn: string;
  paymentAmount: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  notes: string;
  invoiceTotal: string;
  stillOwed: string;
  recordPaymentOnce: string;
  invoiceForCompletedWork: string;
  thankYouBusiness: string;
  thankYouPayment: string;
  thankYouPaymentReceived: string;
  invoiceNotFound: string;
  paymentNotFound: string;
  jobNotFound: string;
  permissionDenied: string;
  invalidDocumentType: string;
  invalidJobId: string;
  invalidCustomerId: string;
  invalidInvoiceId: string;
  invalidPaymentId: string;
  enterPositivePayment: string;
  addRecipientAndMessage: string;
  enterRecipientEmail: string;
  open: string;
  maps: string;
  bookAgain: string;
  more: string;
  needsWorker: string;
  unscheduled: string;
  noCustomer: string;
  noAddress: string;
  noRecipient: string;
  untitled: string;
  photos: string;
  photo: string;
  customer: string;
  email: string;
  workAndMessage: string;
  emailSubject: string;
  sendLater: string;
  send: string;
  schedule: string;
  sending: string;
  startOver: string;
  newInvoice: string;
  newEstimate: string;
  newProposal: string;
  newMessage: string;
  amountDue: string;
  amountPaid: string;
  estimateTotal: string;
  proposalTotal: string;
  amount: string;
  customerNamePlaceholder: string;
  messagePlaceholder: string;
  invoices: string;
  receipts: string;
  sentHistory: string;
  overdueInvoices: string;
  whoStillOwesYou: string;
  outstandingBalances: string;
  outstandingSubtitle: string;
  outstandingRowHint: string;
  paymentFilterHint: string;
  reviewUninvoicedJobs: string;
  paymentConnections: string;
  subscription: string;
  sentHistoryHint: string;
  failedHistoryHint: string;
  reasonPrefix: string;
  documentStatus: string;
  tabSent: string;
  tabScheduled: string;
  tabDrafts: string;
  tabFailed: string;
  schemaNotice: string;
  paymentMethods: Record<string, string>;
  billing: Record<JobBillingStatus, string>;
};

const en: BillingOpsCopy = {
  createInvoice: 'Create invoice',
  createDraft: 'Create draft',
  createAnInvoice: 'Create an invoice',
  sendReceipt: 'Send receipt',
  paymentReceipt: 'Payment receipt',
  paymentRecorded: 'Payment recorded',
  notInvoiced: 'Not invoiced',
  draftInvoice: 'Draft invoice',
  invoiceSent: 'Invoice sent',
  invoiceSentUnpaid: 'Invoice sent, payment not recorded',
  partiallyPaid: 'Partially paid',
  paid: 'Paid',
  unpaid: 'Unpaid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  receiptSent: 'Receipt sent',
  later: 'Later',
  billingStatus: 'Billing status',
  missingAmount: 'Missing amount',
  missingAmountHint: 'Missing amount — enter the amount before sending.',
  existingInvoiceFound: 'Existing invoice found',
  existingReceiptFound: 'Existing receipt found',
  loadingPrefill: 'Loading customer and job details…',
  jobCompleted: 'Job completed',
  jobCompletedHint: 'Create an invoice for this completed job when you are ready.',
  receiptsSubtitle: 'Send payment receipts to customers. Details are filled from the paid invoice.',
  createAnotherInvoice: 'Create another invoice',
  loading: 'Loading…',
  loadingDocuments: 'Loading…',
  unableLoadDocuments: 'Unable to load documents',
  unableLoadInvoice: 'Unable to load invoice details',
  unableLoadReceipt: 'Unable to load receipt details',
  unableRecordPayment: 'Unable to record payment',
  unableSave: 'Unable to save',
  sendFailed: 'Send failed',
  emailFailed: 'Email failed. Check the Failed tab to retry.',
  deliveryFailed: 'Delivery failed',
  deleteFailed: 'Delete failed',
  scheduled: 'Scheduled',
  draft: 'Draft',
  sent: 'Sent',
  retry: 'Retry',
  edit: 'Edit',
  remove: 'Remove',
  deleteDraft: 'Delete draft',
  cancelSchedule: 'Cancel schedule',
  hideFromHistory: 'Hide from history',
  removeItemConfirm: 'Remove this item?',
  nothingSentYet: 'Nothing sent yet. Compose above and tap Send.',
  noScheduledItems: 'No scheduled items.',
  noDrafts: 'No drafts. Your work saves automatically while you type.',
  noFailedDeliveries: 'No failed deliveries.',
  noInvoicesMatchFilter: 'No invoices match this filter',
  recordPayment: 'Record payment',
  savePayment: 'Save payment',
  saving: 'Saving',
  savingEllipsis: 'Saving…',
  saved: 'Saved',
  notSavedRetry: 'Not saved. Keep typing to retry.',
  autoSaveOn: 'Auto-save on',
  paymentAmount: 'Payment amount',
  paymentDate: 'Payment date',
  paymentMethod: 'Payment method',
  referenceNumber: 'Reference number',
  notes: 'Notes',
  invoiceTotal: 'Invoice total',
  stillOwed: 'Still owed',
  recordPaymentOnce:
    'Record this payment once. Dashboard, reports, and cash metrics update automatically.',
  invoiceForCompletedWork: 'Invoice for completed work',
  thankYouBusiness: 'Thank you for your business. Please find your invoice details below.',
  thankYouPayment: 'Thank you for your payment.',
  thankYouPaymentReceived: 'Thank you. We received your payment.',
  invoiceNotFound: 'Invoice not found',
  paymentNotFound: 'Payment not found',
  jobNotFound: 'Job not found',
  permissionDenied: 'Permission denied',
  invalidDocumentType: 'Invalid document type',
  invalidJobId: 'Invalid job ID',
  invalidCustomerId: 'Invalid customer ID',
  invalidInvoiceId: 'Invalid invoice ID',
  invalidPaymentId: 'Invalid payment ID',
  enterPositivePayment: 'Enter a positive payment amount',
  addRecipientAndMessage: 'Add a recipient and message before sending',
  enterRecipientEmail: 'Enter a recipient email before sending.',
  open: 'Open',
  maps: 'Maps',
  bookAgain: 'Book again',
  more: 'More',
  needsWorker: 'Needs worker',
  unscheduled: 'Unscheduled',
  noCustomer: 'No customer',
  noAddress: 'No address',
  noRecipient: 'No recipient',
  untitled: 'Untitled',
  photos: 'photos',
  photo: 'photo',
  customer: 'Customer',
  email: 'Email',
  workAndMessage: 'Work and message',
  emailSubject: 'Email subject',
  sendLater: 'Send later',
  send: 'Send',
  schedule: 'Schedule',
  sending: 'Sending…',
  startOver: 'Start over',
  newInvoice: 'New invoice',
  newEstimate: 'New estimate',
  newProposal: 'New proposal',
  newMessage: 'New message',
  amountDue: 'Amount due',
  amountPaid: 'Amount paid',
  estimateTotal: 'Estimate total',
  proposalTotal: 'Proposal total',
  amount: 'Amount',
  customerNamePlaceholder: 'Customer name',
  messagePlaceholder: 'Describe the work, price, and anything the customer needs to know.',
  invoices: 'Invoices',
  receipts: 'Receipts',
  sentHistory: 'Sent history',
  overdueInvoices: 'Overdue invoices',
  whoStillOwesYou: 'Who still owes you',
  outstandingBalances: 'Outstanding balances',
  outstandingSubtitle:
    'See exactly which invoices are unpaid or overdue. Uninvoiced job balances are reviewed from Jobs.',
  outstandingRowHint:
    'Each row below shows the customer, invoice, amount billed, amount paid, and remaining balance.',
  paymentFilterHint:
    'Showing filtered invoices. Record payment here once and every dashboard metric updates from this.',
  reviewUninvoicedJobs: 'Review uninvoiced jobs',
  paymentConnections: 'Payment connections',
  subscription: 'Subscription',
  sentHistoryHint:
    'Sent items cannot be unsent. Hiding an item only removes it from this history list. Use Record payment when a customer pays.',
  failedHistoryHint: 'Failed deliveries were not sent. Fix the recipient or email settings, then retry.',
  reasonPrefix: 'Reason:',
  documentStatus: 'Document status',
  tabSent: 'Sent',
  tabScheduled: 'Scheduled',
  tabDrafts: 'Drafts',
  tabFailed: 'Failed',
  schemaNotice:
    'Outbound tables are not set up in this database yet. Run supabase/manual_schema_repair.sql in the Supabase SQL Editor, then refresh this page.',
  paymentMethods: {
    Cash: 'Cash',
    Check: 'Check',
    Card: 'Card',
    ACH: 'ACH',
    Zelle: 'Zelle',
    Venmo: 'Venmo',
    Other: 'Other'
  },
  billing: {
    not_invoiced: 'Not invoiced',
    draft_invoice: 'Draft invoice',
    invoice_sent: 'Invoice sent',
    partially_paid: 'Partially paid',
    paid: 'Paid',
    receipt_sent: 'Receipt sent'
  }
};

const es: BillingOpsCopy = {
  ...en,
  createInvoice: 'Crear factura',
  createDraft: 'Crear borrador',
  createAnInvoice: 'Crear una factura',
  sendReceipt: 'Enviar recibo',
  paymentReceipt: 'Recibo de pago',
  paymentRecorded: 'Pago registrado',
  notInvoiced: 'Sin facturar',
  draftInvoice: 'Borrador de factura',
  invoiceSent: 'Factura enviada',
  invoiceSentUnpaid: 'Factura enviada, pago no registrado',
  partiallyPaid: 'Pago parcial',
  paid: 'Pagado',
  unpaid: 'Sin pagar',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
  receiptSent: 'Recibo enviado',
  later: 'Más tarde',
  billingStatus: 'Estado de facturación',
  missingAmount: 'Monto faltante',
  missingAmountHint: 'Monto faltante: ingresa el monto antes de enviar.',
  existingInvoiceFound: 'Factura existente encontrada',
  existingReceiptFound: 'Recibo existente encontrado',
  loadingPrefill: 'Cargando datos del cliente y del trabajo…',
  jobCompleted: 'Trabajo completado',
  jobCompletedHint: 'Crea una factura para este trabajo completado cuando estés listo.',
  receiptsSubtitle: 'Envía recibos de pago a tus clientes. Los detalles se completan desde la factura pagada.',
  createAnotherInvoice: 'Crear otra factura',
  loading: 'Cargando…',
  loadingDocuments: 'Cargando…',
  unableLoadDocuments: 'No se pudieron cargar los documentos',
  unableLoadInvoice: 'No se pudieron cargar los detalles de la factura',
  unableLoadReceipt: 'No se pudieron cargar los detalles del recibo',
  unableRecordPayment: 'No se pudo registrar el pago',
  unableSave: 'No se pudo guardar',
  sendFailed: 'Error al enviar',
  emailFailed: 'Error de correo. Revisa la pestaña Fallidos para reintentar.',
  deliveryFailed: 'Entrega fallida',
  deleteFailed: 'Error al eliminar',
  scheduled: 'Programado',
  draft: 'Borrador',
  sent: 'Enviado',
  retry: 'Reintentar',
  edit: 'Editar',
  remove: 'Eliminar',
  deleteDraft: 'Eliminar borrador',
  cancelSchedule: 'Cancelar programación',
  hideFromHistory: 'Ocultar del historial',
  removeItemConfirm: '¿Eliminar este elemento?',
  nothingSentYet: 'Aún no hay envíos. Redacta arriba y toca Enviar.',
  noScheduledItems: 'No hay elementos programados.',
  noDrafts: 'No hay borradores. Tu trabajo se guarda automáticamente mientras escribes.',
  noFailedDeliveries: 'No hay entregas fallidas.',
  noInvoicesMatchFilter: 'Ninguna factura coincide con este filtro',
  recordPayment: 'Registrar pago',
  savePayment: 'Guardar pago',
  saving: 'Guardando',
  savingEllipsis: 'Guardando…',
  saved: 'Guardado',
  notSavedRetry: 'No se guardó. Sigue escribiendo para reintentar.',
  autoSaveOn: 'Autoguardado activado',
  paymentAmount: 'Monto del pago',
  paymentDate: 'Fecha de pago',
  paymentMethod: 'Método de pago',
  referenceNumber: 'Número de referencia',
  notes: 'Notas',
  invoiceTotal: 'Total de la factura',
  stillOwed: 'Saldo pendiente',
  recordPaymentOnce:
    'Registra este pago una sola vez. El panel, los informes y las métricas de efectivo se actualizan automáticamente.',
  invoiceForCompletedWork: 'Factura por trabajo completado',
  thankYouBusiness: 'Gracias por su preferencia. A continuación encontrará los detalles de su factura.',
  thankYouPayment: 'Gracias por su pago.',
  thankYouPaymentReceived: 'Gracias. Recibimos su pago.',
  invoiceNotFound: 'Factura no encontrada',
  paymentNotFound: 'Pago no encontrado',
  jobNotFound: 'Trabajo no encontrado',
  permissionDenied: 'Permiso denegado',
  invalidDocumentType: 'Tipo de documento no válido',
  invalidJobId: 'ID de trabajo no válido',
  invalidCustomerId: 'ID de cliente no válido',
  invalidInvoiceId: 'ID de factura no válido',
  invalidPaymentId: 'ID de pago no válido',
  enterPositivePayment: 'Ingresa un monto de pago positivo',
  addRecipientAndMessage: 'Agrega un destinatario y un mensaje antes de enviar',
  enterRecipientEmail: 'Ingresa un correo del destinatario antes de enviar.',
  open: 'Abrir',
  maps: 'Mapas',
  bookAgain: 'Reservar de nuevo',
  more: 'Más',
  needsWorker: 'Necesita trabajador',
  unscheduled: 'Sin programar',
  noCustomer: 'Sin cliente',
  noAddress: 'Sin dirección',
  noRecipient: 'Sin destinatario',
  untitled: 'Sin título',
  photos: 'fotos',
  photo: 'foto',
  customer: 'Cliente',
  email: 'Correo',
  workAndMessage: 'Trabajo y mensaje',
  emailSubject: 'Asunto del correo',
  sendLater: 'Enviar más tarde',
  send: 'Enviar',
  schedule: 'Programar',
  sending: 'Enviando…',
  startOver: 'Empezar de nuevo',
  newInvoice: 'Nueva factura',
  newEstimate: 'Nuevo presupuesto',
  newProposal: 'Nueva propuesta',
  newMessage: 'Nuevo mensaje',
  amountDue: 'Monto adeudado',
  amountPaid: 'Monto pagado',
  estimateTotal: 'Total del presupuesto',
  proposalTotal: 'Total de la propuesta',
  amount: 'Monto',
  customerNamePlaceholder: 'Nombre del cliente',
  messagePlaceholder: 'Describe el trabajo, el precio y lo que el cliente necesita saber.',
  invoices: 'Facturas',
  receipts: 'Recibos',
  sentHistory: 'Historial enviado',
  overdueInvoices: 'Facturas vencidas',
  whoStillOwesYou: 'Quién aún te debe',
  outstandingBalances: 'Saldos pendientes',
  outstandingSubtitle:
    'Consulta exactamente qué facturas están sin pagar o vencidas. Los trabajos sin facturar se revisan en Trabajos.',
  outstandingRowHint:
    'Cada fila muestra el cliente, la factura, el monto facturado, el monto pagado y el saldo restante.',
  paymentFilterHint:
    'Mostrando facturas filtradas. Registra el pago aquí una vez y todas las métricas del panel se actualizan.',
  reviewUninvoicedJobs: 'Revisar trabajos sin facturar',
  paymentConnections: 'Conexiones de pago',
  subscription: 'Suscripción',
  sentHistoryHint:
    'Los elementos enviados no se pueden anular. Ocultar solo lo quita de este historial. Usa Registrar pago cuando el cliente pague.',
  failedHistoryHint:
    'Las entregas fallidas no se enviaron. Corrige el destinatario o la configuración de correo y reintenta.',
  reasonPrefix: 'Motivo:',
  documentStatus: 'Estado del documento',
  tabSent: 'Enviados',
  tabScheduled: 'Programados',
  tabDrafts: 'Borradores',
  tabFailed: 'Fallidos',
  schemaNotice:
    'Las tablas de envío aún no están configuradas. Ejecuta supabase/manual_schema_repair.sql en el Editor SQL de Supabase y actualiza esta página.',
  paymentMethods: {
    Cash: 'Efectivo',
    Check: 'Cheque',
    Card: 'Tarjeta',
    ACH: 'ACH',
    Zelle: 'Zelle',
    Venmo: 'Venmo',
    Other: 'Otro'
  },
  billing: {
    not_invoiced: 'Sin facturar',
    draft_invoice: 'Borrador de factura',
    invoice_sent: 'Factura enviada',
    partially_paid: 'Pago parcial',
    paid: 'Pagado',
    receipt_sent: 'Recibo enviado'
  }
};

const vi: BillingOpsCopy = {
  ...en,
  createInvoice: 'Tạo hóa đơn',
  createDraft: 'Tạo bản nháp',
  createAnInvoice: 'Tạo một hóa đơn',
  sendReceipt: 'Gửi biên nhận',
  paymentReceipt: 'Biên nhận thanh toán',
  paymentRecorded: 'Đã ghi nhận thanh toán',
  notInvoiced: 'Chưa xuất hóa đơn',
  draftInvoice: 'Hóa đơn nháp',
  invoiceSent: 'Đã gửi hóa đơn',
  invoiceSentUnpaid: 'Đã gửi hóa đơn, chưa ghi nhận thanh toán',
  partiallyPaid: 'Thanh toán một phần',
  paid: 'Đã thanh toán',
  unpaid: 'Chưa thanh toán',
  overdue: 'Quá hạn',
  cancelled: 'Đã hủy',
  receiptSent: 'Đã gửi biên nhận',
  later: 'Để sau',
  billingStatus: 'Trạng thái thanh toán',
  missingAmount: 'Thiếu số tiền',
  missingAmountHint: 'Thiếu số tiền — hãy nhập số tiền trước khi gửi.',
  existingInvoiceFound: 'Đã tìm thấy hóa đơn hiện có',
  existingReceiptFound: 'Đã tìm thấy biên nhận hiện có',
  loadingPrefill: 'Đang tải thông tin khách hàng và công việc…',
  jobCompleted: 'Công việc đã hoàn thành',
  jobCompletedHint: 'Tạo hóa đơn cho công việc đã hoàn thành khi bạn sẵn sàng.',
  receiptsSubtitle: 'Gửi biên nhận thanh toán cho khách hàng. Chi tiết được điền từ hóa đơn đã thanh toán.',
  createAnotherInvoice: 'Tạo hóa đơn khác',
  loading: 'Đang tải…',
  loadingDocuments: 'Đang tải…',
  unableLoadDocuments: 'Không thể tải tài liệu',
  unableLoadInvoice: 'Không thể tải chi tiết hóa đơn',
  unableLoadReceipt: 'Không thể tải chi tiết biên nhận',
  unableRecordPayment: 'Không thể ghi nhận thanh toán',
  unableSave: 'Không thể lưu',
  sendFailed: 'Gửi thất bại',
  emailFailed: 'Gửi email thất bại. Kiểm tra tab Thất bại để thử lại.',
  deliveryFailed: 'Giao nhận thất bại',
  deleteFailed: 'Xóa thất bại',
  scheduled: 'Đã lên lịch',
  draft: 'Bản nháp',
  sent: 'Đã gửi',
  retry: 'Thử lại',
  edit: 'Sửa',
  remove: 'Xóa',
  deleteDraft: 'Xóa bản nháp',
  cancelSchedule: 'Hủy lịch gửi',
  hideFromHistory: 'Ẩn khỏi lịch sử',
  removeItemConfirm: 'Xóa mục này?',
  nothingSentYet: 'Chưa có gì được gửi. Soạn phía trên rồi nhấn Gửi.',
  noScheduledItems: 'Không có mục đã lên lịch.',
  noDrafts: 'Không có bản nháp. Công việc tự động lưu khi bạn nhập.',
  noFailedDeliveries: 'Không có lần gửi thất bại.',
  noInvoicesMatchFilter: 'Không có hóa đơn khớp bộ lọc này',
  recordPayment: 'Ghi nhận thanh toán',
  savePayment: 'Lưu thanh toán',
  saving: 'Đang lưu',
  savingEllipsis: 'Đang lưu…',
  saved: 'Đã lưu',
  notSavedRetry: 'Chưa lưu. Tiếp tục nhập để thử lại.',
  autoSaveOn: 'Đang tự động lưu',
  paymentAmount: 'Số tiền thanh toán',
  paymentDate: 'Ngày thanh toán',
  paymentMethod: 'Phương thức thanh toán',
  referenceNumber: 'Số tham chiếu',
  notes: 'Ghi chú',
  invoiceTotal: 'Tổng hóa đơn',
  stillOwed: 'Còn nợ',
  recordPaymentOnce:
    'Ghi nhận thanh toán này một lần. Bảng điều khiển, báo cáo và số liệu tiền mặt sẽ tự cập nhật.',
  invoiceForCompletedWork: 'Hóa đơn cho công việc đã hoàn thành',
  thankYouBusiness: 'Cảm ơn quý khách. Chi tiết hóa đơn được nêu bên dưới.',
  thankYouPayment: 'Cảm ơn quý khách đã thanh toán.',
  thankYouPaymentReceived: 'Cảm ơn. Chúng tôi đã nhận được thanh toán của bạn.',
  invoiceNotFound: 'Không tìm thấy hóa đơn',
  paymentNotFound: 'Không tìm thấy thanh toán',
  jobNotFound: 'Không tìm thấy công việc',
  permissionDenied: 'Không có quyền',
  invalidDocumentType: 'Loại tài liệu không hợp lệ',
  invalidJobId: 'ID công việc không hợp lệ',
  invalidCustomerId: 'ID khách hàng không hợp lệ',
  invalidInvoiceId: 'ID hóa đơn không hợp lệ',
  invalidPaymentId: 'ID thanh toán không hợp lệ',
  enterPositivePayment: 'Nhập số tiền thanh toán lớn hơn 0',
  addRecipientAndMessage: 'Thêm người nhận và nội dung trước khi gửi',
  enterRecipientEmail: 'Nhập email người nhận trước khi gửi.',
  open: 'Mở',
  maps: 'Bản đồ',
  bookAgain: 'Đặt lại',
  more: 'Thêm',
  needsWorker: 'Cần nhân sự',
  unscheduled: 'Chưa lên lịch',
  noCustomer: 'Không có khách hàng',
  noAddress: 'Không có địa chỉ',
  noRecipient: 'Không có người nhận',
  untitled: 'Không có tiêu đề',
  photos: 'ảnh',
  photo: 'ảnh',
  customer: 'Khách hàng',
  email: 'Email',
  workAndMessage: 'Công việc và nội dung',
  emailSubject: 'Tiêu đề email',
  sendLater: 'Gửi sau',
  send: 'Gửi',
  schedule: 'Lên lịch',
  sending: 'Đang gửi…',
  startOver: 'Bắt đầu lại',
  newInvoice: 'Hóa đơn mới',
  newEstimate: 'Báo giá mới',
  newProposal: 'Đề xuất mới',
  newMessage: 'Tin nhắn mới',
  amountDue: 'Số tiền phải trả',
  amountPaid: 'Số tiền đã trả',
  estimateTotal: 'Tổng báo giá',
  proposalTotal: 'Tổng đề xuất',
  amount: 'Số tiền',
  customerNamePlaceholder: 'Tên khách hàng',
  messagePlaceholder: 'Mô tả công việc, giá và thông tin khách hàng cần biết.',
  invoices: 'Hóa đơn',
  receipts: 'Biên nhận',
  sentHistory: 'Lịch sử đã gửi',
  overdueInvoices: 'Hóa đơn quá hạn',
  whoStillOwesYou: 'Ai còn nợ bạn',
  outstandingBalances: 'Số dư còn lại',
  outstandingSubtitle:
    'Xem chính xác hóa đơn nào chưa thanh toán hoặc quá hạn. Công việc chưa xuất hóa đơn được xem trong Công việc.',
  outstandingRowHint:
    'Mỗi hàng hiển thị khách hàng, hóa đơn, số tiền đã lập, số tiền đã trả và số còn nợ.',
  paymentFilterHint:
    'Đang hiển thị hóa đơn đã lọc. Ghi nhận thanh toán tại đây một lần và mọi số liệu bảng điều khiển sẽ cập nhật.',
  reviewUninvoicedJobs: 'Xem công việc chưa xuất hóa đơn',
  paymentConnections: 'Kết nối thanh toán',
  subscription: 'Gói đăng ký',
  sentHistoryHint:
    'Mục đã gửi không thể thu hồi. Ẩn chỉ gỡ khỏi danh sách lịch sử này. Dùng Ghi nhận thanh toán khi khách thanh toán.',
  failedHistoryHint:
    'Các lần gửi thất bại chưa được gửi. Sửa người nhận hoặc cài đặt email rồi thử lại.',
  reasonPrefix: 'Lý do:',
  documentStatus: 'Trạng thái tài liệu',
  tabSent: 'Đã gửi',
  tabScheduled: 'Đã lên lịch',
  tabDrafts: 'Bản nháp',
  tabFailed: 'Thất bại',
  schemaNotice:
    'Các bảng gửi đi chưa được thiết lập. Chạy supabase/manual_schema_repair.sql trong Supabase SQL Editor rồi tải lại trang.',
  paymentMethods: {
    Cash: 'Tiền mặt',
    Check: 'Séc',
    Card: 'Thẻ',
    ACH: 'ACH',
    Zelle: 'Zelle',
    Venmo: 'Venmo',
    Other: 'Khác'
  },
  billing: {
    not_invoiced: 'Chưa xuất hóa đơn',
    draft_invoice: 'Hóa đơn nháp',
    invoice_sent: 'Đã gửi hóa đơn',
    partially_paid: 'Thanh toán một phần',
    paid: 'Đã thanh toán',
    receipt_sent: 'Đã gửi biên nhận'
  }
};

const copy: Record<Locale, BillingOpsCopy> = { en, es, vi };

export function getBillingOpsCopy(locale: Locale | string | null | undefined): BillingOpsCopy {
  return copy[normalizeLocale(locale)] || copy.en;
}

export function emptyTabMessage(copy: BillingOpsCopy, tab: OutboundTab): string {
  if (tab === 'sent') return copy.nothingSentYet;
  if (tab === 'scheduled') return copy.noScheduledItems;
  if (tab === 'drafts') return copy.noDrafts;
  return copy.noFailedDeliveries;
}

export function removeActionLabel(copy: BillingOpsCopy, tab: OutboundTab): string {
  if (tab === 'sent') return copy.hideFromHistory;
  if (tab === 'scheduled') return copy.cancelSchedule;
  return copy.deleteDraft;
}

export function composerTitle(copy: BillingOpsCopy, docType: OutboundDocType): string {
  if (docType === 'estimate') return copy.newEstimate;
  if (docType === 'proposal') return copy.newProposal;
  if (docType === 'invoice') return copy.newInvoice;
  if (docType === 'receipt') return copy.paymentReceipt;
  return copy.newMessage;
}

export function amountFieldLabel(copy: BillingOpsCopy, docType: OutboundDocType): string {
  if (docType === 'estimate') return copy.estimateTotal;
  if (docType === 'proposal') return copy.proposalTotal;
  if (docType === 'invoice') return copy.amountDue;
  if (docType === 'receipt') return copy.amountPaid;
  return copy.amount;
}

export function localizedInvoiceSubject(locale: Locale | string | null | undefined, jobTitle?: string): string {
  const c = getBillingOpsCopy(locale);
  const title = String(jobTitle || '').trim();
  if (!title) return c.invoiceForCompletedWork;
  if (normalizeLocale(locale) === 'es') return `Factura por ${title}`;
  if (normalizeLocale(locale) === 'vi') return `Hóa đơn cho ${title}`;
  return `Invoice for ${title}`;
}

export function localizedInvoiceBody(locale: Locale | string | null | undefined, jobTitle?: string): string {
  const c = getBillingOpsCopy(locale);
  const title = String(jobTitle || '').trim();
  if (!title) return c.thankYouBusiness;
  if (normalizeLocale(locale) === 'es') {
    return `Gracias por su preferencia. A continuación encontrará la factura de ${title}.`;
  }
  if (normalizeLocale(locale) === 'vi') {
    return `Cảm ơn quý khách. Hóa đơn cho ${title} được nêu bên dưới.`;
  }
  return `Thank you for your business. Please find the invoice for ${title} below.`;
}

export function localizedReceiptSubject(locale: Locale | string | null | undefined): string {
  return getBillingOpsCopy(locale).paymentReceipt;
}

export function localizedReceiptBody(
  locale: Locale | string | null | undefined,
  input: {
    amountLabel: string;
    whenLabel: string;
    jobTitle?: string;
    paymentMethod?: string | null;
    paymentReference?: string | null;
  }
): string {
  const c = getBillingOpsCopy(locale);
  const normalized = normalizeLocale(locale);
  const forJob = input.jobTitle?.trim()
    ? normalized === 'es'
      ? ` por ${input.jobTitle.trim()}`
      : normalized === 'vi'
        ? ` cho ${input.jobTitle.trim()}`
        : ` for ${input.jobTitle.trim()}`
    : '';

  let body =
    normalized === 'es'
      ? `Gracias. Recibimos su pago de ${input.amountLabel}${forJob} el ${input.whenLabel}.`
      : normalized === 'vi'
        ? `Cảm ơn. Chúng tôi đã nhận thanh toán ${input.amountLabel}${forJob} vào ${input.whenLabel}.`
        : `Thank you. We received your payment of ${input.amountLabel}${forJob} on ${input.whenLabel}.`;

  if (input.paymentMethod) {
    body +=
      normalized === 'es'
        ? `\nMétodo de pago: ${input.paymentMethod}`
        : normalized === 'vi'
          ? `\nPhương thức thanh toán: ${input.paymentMethod}`
          : `\nPayment method: ${input.paymentMethod}`;
  }
  if (input.paymentReference) {
    body +=
      normalized === 'es'
        ? `\nReferencia: ${input.paymentReference}`
        : normalized === 'vi'
          ? `\nTham chiếu: ${input.paymentReference}`
          : `\nReference: ${input.paymentReference}`;
  }

  // Keep thank-you fallback phrase available for simple defaults.
  void c.thankYouPaymentReceived;
  return body;
}

export function paymentStatusLabelLocalized(
  locale: Locale | string | null | undefined,
  status: string | null | undefined
): string {
  const c = getBillingOpsCopy(locale);
  switch (String(status || '').toLowerCase()) {
    case 'paid':
      return c.paid;
    case 'partially_paid':
      return c.partiallyPaid;
    case 'overdue':
      return c.overdue;
    case 'cancelled':
    case 'canceled':
      return c.cancelled;
    case 'unpaid':
    default:
      return c.unpaid;
  }
}

export function invoiceDeliveryPaymentLabelLocalized(
  locale: Locale | string | null | undefined,
  input: {
    deliveryStatus?: string | null;
    paymentStatus?: string | null;
    documentStatus?: string | null;
    amount?: number | null;
    amountPaid?: number | null;
  }
): string {
  const c = getBillingOpsCopy(locale);
  if (input.deliveryStatus === 'failed') return c.deliveryFailed;
  if (input.paymentStatus === 'cancelled' || input.documentStatus === 'cancelled') return c.cancelled;
  if (input.paymentStatus === 'paid' || input.documentStatus === 'paid') return c.paid;
  if (input.documentStatus === 'overdue' || input.paymentStatus === 'overdue') return c.overdue;
  if (input.paymentStatus === 'partially_paid') return c.partiallyPaid;
  if (input.deliveryStatus === 'sent' || input.deliveryStatus === 'scheduled') {
    const paid = Number(input.amountPaid || 0);
    if (paid <= 0) return c.invoiceSentUnpaid;
  }
  return paymentStatusLabelLocalized(locale, input.paymentStatus);
}

export function deliveryStatusLabel(
  locale: Locale | string | null | undefined,
  status: string | null | undefined
): string {
  const c = getBillingOpsCopy(locale);
  const value = String(status || '').toLowerCase();
  if (value === 'failed') return c.deliveryFailed;
  if (value === 'scheduled') return c.scheduled;
  if (value === 'draft') return c.draft;
  return c.sent;
}
