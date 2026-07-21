import { normalizeLocale, type Locale } from '@/lib/i18n/config';
import type { DashboardDateRange } from '@/lib/dashboard-metrics';
import type { DashboardDetailMetric } from '@/lib/dashboard-metric-details';

export type DashboardFinanceCopy = {
  ranges: Record<DashboardDateRange, string>;
  metricTitles: Record<DashboardDetailMetric, string>;
  formulas: Record<DashboardDetailMetric, string>;
  details: {
    titleFallback: string;
    subtitle: string;
    exactTotal: string;
    empty: string;
    tryAgain: string;
    unknownMetric: string;
    loadError: string;
    loading: string;
  };
  overview: {
    title: string;
    subtitle: string;
    periodLabel: string;
    moneySummaryTitle: string;
    loadError: string;
  };
  money: {
    collected: string;
    collectedHelp: string;
    outstanding: string;
    outstandingHelp: string;
    invoiced: string;
    invoicedHelp: string;
    netCash: string;
    netCashHelp: string;
    latePayments: string;
    latePaymentsHelp: string;
    lateInvoices: string;
    unpaidInvoices: string;
    unpaidInvoicesHelp: string;
    averageDays: string;
    averageDaysNone: string;
    averageDaysHelp: string;
    averageDaysHelpEmpty: string;
    contractorPay: string;
    contractorPayHelp: string;
    contractorPayOwed: string;
    contractorPayOwedHelp: string;
    contractorPayPending: string;
    contractorPayPendingHelp: string;
    otherExpenses: string;
    otherExpensesHelp: string;
    expectedProfit: string;
    expectedProfitHelp: string;
    cashAfterCosts: string;
    cashAfterCostsHelp: string;
    expectedProfitPct: string;
    expectedProfitPctHelp: string;
    costsMissing: string;
    uninvoicedWork: string;
    uninvoicedWorkHelp: string;
    paymentsMissingDates: string;
    paymentsMissingDatesHelp: string;
    completedJobs: string;
    completedJobsHelp: string;
    jobs: string;
    jobsHelp: string;
    activeCustomersHelp: string;
    bookings: string;
    messages: string;
    reports: string;
    current: string;
    days: string;
  };
  contractorPayPage: {
    title: string;
    subtitle: string;
    permissionDenied: string;
    stillOwed: string;
    pending: string;
    paid: string;
    allPayments: string;
    statusPayments: string;
    changesHint: string;
    showAll: string;
    refresh: string;
    refreshing: string;
    loading: string;
    empty: string;
    openJob: string;
    markPending: string;
    markPaid: string;
    updateError: string;
    markedPaid: string;
    markedStatus: string;
    unnamed: string;
    jobFallback: string;
  };
};

const en: DashboardFinanceCopy = {
  ranges: {
    month: 'This month',
    quarter: 'This quarter',
    year: 'This year',
    last_year: 'Last year',
    all_time: 'All time'
  },
  metricTitles: {
    collected: 'Collected',
    invoiced: 'Invoiced',
    outstanding: 'Outstanding balance',
    late: 'Late payments',
    'unpaid-invoices': 'Unpaid invoices',
    'net-cash': 'Collected cash after costs',
    'estimated-profit': 'Expected profit',
    'contractor-pay': 'Contractor pay',
    'contractor-pay-owed': 'Contractor pay owed',
    'contractor-pay-pending': 'Contractor pay pending',
    expenses: 'Expenses',
    'completed-jobs': 'Completed jobs',
    jobs: 'Jobs',
    'active-customers': 'Active customers'
  },
  formulas: {
    collected:
      'Collected = invoice payments + direct job payments in the selected period. The same payment is never counted twice.',
    invoiced: 'Invoiced = non-cancelled invoice totals created in the selected period.',
    outstanding:
      'Outstanding = unpaid invoice balances + expected amounts on uninvoiced jobs minus direct payments.',
    late: 'Late = unpaid invoice balances past their due date.',
    'unpaid-invoices': 'Unpaid invoices = invoices with a remaining balance.',
    'net-cash':
      'Collected cash after costs = customer payments received minus contractor payments marked paid minus expenses in the selected period.',
    'estimated-profit':
      'Expected profit = invoiced revenue minus contractor costs incurred minus expenses in the selected period.',
    'contractor-pay': 'Contractor pay = labor totals for the selected filter.',
    'contractor-pay-owed': 'Contractor pay owed = labor still marked unpaid.',
    'contractor-pay-pending': 'Contractor pay pending = labor marked pending.',
    expenses: 'Expenses = expense amounts with dates in the selected period.',
    'completed-jobs':
      'Completed jobs counted by completion or work date, not by when the record was created.',
    jobs: 'Jobs counted by operational work date in the selected period.',
    'active-customers':
      'Active customers = customer records with stage Active. Leads and archived records are excluded.'
  },
  details: {
    titleFallback: 'Metric details',
    subtitle: 'See the records behind each dashboard total.',
    exactTotal: 'Exact total',
    empty: 'No records in this period.',
    tryAgain: 'Try again',
    unknownMetric: 'Unknown dashboard metric.',
    loadError: 'Unable to load metric details.',
    loading: 'Loading…'
  },
  overview: {
    title: 'Business overview',
    subtitle: 'See what clients paid, what is still owed, expenses, and expected profit.',
    periodLabel: 'Dashboard period',
    moneySummaryTitle: 'Money summary',
    loadError: 'Some financial totals could not be loaded. Refresh and try again.'
  },
  money: {
    collected: 'Collected',
    collectedHelp:
      'Client payments received during this period from direct job payments and invoice payments. The same payment is never counted twice.',
    outstanding: 'Outstanding balance',
    outstandingHelp:
      'Current unpaid invoice balances plus unpaid expected amounts on jobs that do not have an invoice.',
    invoiced: 'Invoiced',
    invoicedHelp: 'Total of non-cancelled invoices created during this period.',
    netCash: 'Net cash',
    netCashHelp: 'Collected payments for this period minus expenses paid during this period.',
    latePayments: 'Late payments',
    latePaymentsHelp: 'Current unpaid invoice balances that are past their due dates.',
    lateInvoices: 'Late invoices',
    unpaidInvoices: 'Unpaid invoices',
    unpaidInvoicesHelp: 'Count of non-cancelled invoices with a remaining balance.',
    averageDays: 'Average time to get paid',
    averageDaysNone: 'No fully paid invoices yet',
    averageDaysHelp:
      'Average number of days from invoice date to recorded payment date for fully paid invoices in the selected period.',
    averageDaysHelpEmpty:
      'This appears after at least one invoice has an invoice date, is fully paid, and has a recorded payment date.',
    contractorPay: 'Contractor pay',
    contractorPayHelp:
      'Contractor pay recorded for work in the selected period, whether paid or still owed.',
    contractorPayOwed: 'Contractor pay owed',
    contractorPayOwedHelp: 'Contractor pay recorded but not yet marked paid or pending.',
    contractorPayPending: 'Contractor pay pending',
    contractorPayPendingHelp: 'Contractor pay marked pending but not yet marked paid.',
    otherExpenses: 'Other expenses',
    otherExpensesHelp: 'Non-contractor expenses dated in the selected period.',
    expectedProfit: 'Expected profit',
    expectedProfitHelp:
      'Invoiced revenue minus contractor pay and other recorded expenses for this period. It is not the same as cash collected.',
    cashAfterCosts: 'Collected cash after costs',
    cashAfterCostsHelp:
      'Client payments received minus contractor payments actually paid and other expenses paid during this period.',
    expectedProfitPct: 'Expected profit percentage',
    expectedProfitPctHelp: 'Expected profit divided by the amount invoiced for this period.',
    costsMissing: 'Only recorded costs are included.',
    uninvoicedWork: 'Uninvoiced completed work',
    uninvoicedWorkHelp:
      'Completed job revenue that has not been invoiced. It is not included in Invoiced totals.',
    paymentsMissingDates: 'Payments missing dates',
    paymentsMissingDatesHelp:
      'Invoices with a paid amount but no payment date. Add the payment date so period totals and payment speed are accurate.',
    completedJobs: 'Completed jobs',
    completedJobsHelp: 'Jobs whose completion date falls in the selected period.',
    jobs: 'Jobs',
    jobsHelp:
      'Jobs scheduled, started, or completed in the selected period. Record entry dates are not counted.',
    activeCustomersHelp:
      'Customers currently marked active. Leads, past customers, cancelled records, and archived records are kept but are not counted here.',
    bookings: 'Bookings',
    messages: 'Messages',
    reports: 'Reports',
    current: 'Current',
    days: 'days'
  },
  contractorPayPage: {
    title: 'Contractor Pay',
    subtitle:
      'See who needs to be paid, which job the payment belongs to, and whether it is unpaid, pending, or paid.',
    permissionDenied: 'Only owners, admins, and managers can view contractor payments.',
    stillOwed: 'Still owed',
    pending: 'Pending',
    paid: 'Paid',
    allPayments: 'All contractor payments',
    statusPayments: '{status} contractor payments',
    changesHint: 'Changes here automatically update the dashboard totals.',
    showAll: 'Show all',
    refresh: 'Refresh',
    refreshing: 'Refreshing…',
    loading: 'Loading contractor payments…',
    empty: 'No contractor payments match this status.',
    openJob: 'Open job',
    markPending: 'Mark pending',
    markPaid: 'Mark paid',
    updateError: 'Unable to update contractor payment.',
    markedPaid: 'Contractor payment marked paid.',
    markedStatus: 'Contractor payment marked {status}.',
    unnamed: 'Unnamed contractor',
    jobFallback: 'Job'
  }
};

const es: DashboardFinanceCopy = {
  ...en,
  ranges: {
    month: 'Este mes',
    quarter: 'Este trimestre',
    year: 'Este año',
    last_year: 'El año pasado',
    all_time: 'Todo el tiempo'
  },
  metricTitles: {
    collected: 'Cobrado',
    invoiced: 'Facturado',
    outstanding: 'Saldo pendiente',
    late: 'Pagos atrasados',
    'unpaid-invoices': 'Facturas sin pagar',
    'net-cash': 'Efectivo cobrado después de costos',
    'estimated-profit': 'Ganancia esperada',
    'contractor-pay': 'Pago a contratistas',
    'contractor-pay-owed': 'Pago a contratistas adeudado',
    'contractor-pay-pending': 'Pago a contratistas pendiente',
    expenses: 'Gastos',
    'completed-jobs': 'Trabajos completados',
    jobs: 'Trabajos',
    'active-customers': 'Clientes activos'
  },
  formulas: {
    collected:
      'Cobrado = pagos de facturas + pagos directos del trabajo en el período. El mismo pago nunca se cuenta dos veces.',
    invoiced: 'Facturado = totales de facturas no canceladas creadas en el período.',
    outstanding:
      'Pendiente = saldos de facturas sin pagar + montos esperados de trabajos sin factura menos pagos directos.',
    late: 'Atrasado = saldos de facturas sin pagar después de la fecha de vencimiento.',
    'unpaid-invoices': 'Facturas sin pagar = facturas con saldo restante.',
    'net-cash':
      'Efectivo después de costos = pagos de clientes recibidos menos pagos a contratistas marcados como pagados menos gastos del período.',
    'estimated-profit':
      'Ganancia esperada = ingresos facturados menos costos de contratistas menos gastos del período.',
    'contractor-pay': 'Pago a contratistas = totales de mano de obra del filtro seleccionado.',
    'contractor-pay-owed': 'Adeudado = mano de obra aún marcada como no pagada.',
    'contractor-pay-pending': 'Pendiente = mano de obra marcada como pendiente.',
    expenses: 'Gastos = montos con fecha en el período seleccionado.',
    'completed-jobs':
      'Trabajos completados contados por fecha de finalización o trabajo, no por creación del registro.',
    jobs: 'Trabajos contados por la fecha operativa en el período seleccionado.',
    'active-customers':
      'Clientes activos = registros de cliente con etapa Activo. Los leads y archivados no se cuentan.'
  },
  details: {
    titleFallback: 'Detalle de métrica',
    subtitle: 'Vea los registros detrás de cada total del panel.',
    exactTotal: 'Total exacto',
    empty: 'No hay registros en este período.',
    tryAgain: 'Intentar de nuevo',
    unknownMetric: 'Métrica del panel desconocida.',
    loadError: 'No se pudo cargar el detalle de la métrica.',
    loading: 'Cargando…'
  },
  overview: {
    title: 'Resumen del negocio',
    subtitle: 'Vea lo que pagaron los clientes, lo pendiente, los gastos y la ganancia esperada.',
    periodLabel: 'Período del panel',
    moneySummaryTitle: 'Resumen de dinero',
    loadError: 'Algunos totales financieros no se pudieron cargar. Actualice e intente de nuevo.'
  },
  money: {
    ...en.money,
    collected: 'Cobrado',
    collectedHelp:
      'Pagos de clientes recibidos en este período por pagos directos y de facturas. El mismo pago nunca se cuenta dos veces.',
    outstanding: 'Saldo pendiente',
    outstandingHelp:
      'Saldos actuales de facturas sin pagar más montos esperados de trabajos sin factura.',
    invoiced: 'Facturado',
    invoicedHelp: 'Total de facturas no canceladas creadas en este período.',
    netCash: 'Efectivo neto',
    netCashHelp: 'Pagos cobrados en este período menos gastos pagados en el mismo período.',
    latePayments: 'Pagos atrasados',
    latePaymentsHelp: 'Saldos de facturas sin pagar que ya pasaron su fecha de vencimiento.',
    lateInvoices: 'Facturas atrasadas',
    unpaidInvoices: 'Facturas sin pagar',
    unpaidInvoicesHelp: 'Cantidad de facturas no canceladas con saldo restante.',
    averageDays: 'Tiempo promedio para cobrar',
    averageDaysNone: 'Aún no hay facturas pagadas por completo',
    contractorPay: 'Pago a contratistas',
    contractorPayOwed: 'Pago a contratistas adeudado',
    contractorPayPending: 'Pago a contratistas pendiente',
    otherExpenses: 'Otros gastos',
    expectedProfit: 'Ganancia esperada',
    cashAfterCosts: 'Efectivo cobrado después de costos',
    expectedProfitPct: 'Porcentaje de ganancia esperada',
    costsMissing: 'Solo se incluyen costos registrados.',
    uninvoicedWork: 'Trabajo completado sin facturar',
    paymentsMissingDates: 'Pagos sin fecha',
    completedJobs: 'Trabajos completados',
    jobs: 'Trabajos',
    bookings: 'Reservas',
    messages: 'Mensajes',
    reports: 'Informes',
    current: 'Actual',
    days: 'días'
  },
  contractorPayPage: {
    title: 'Pago a contratistas',
    subtitle:
      'Vea a quién hay que pagar, a qué trabajo pertenece y si está sin pagar, pendiente o pagado.',
    permissionDenied: 'Solo propietarios, administradores y gerentes pueden ver estos pagos.',
    stillOwed: 'Aún adeudado',
    pending: 'Pendiente',
    paid: 'Pagado',
    allPayments: 'Todos los pagos a contratistas',
    statusPayments: 'Pagos a contratistas {status}',
    changesHint: 'Los cambios aquí actualizan automáticamente los totales del panel.',
    showAll: 'Mostrar todo',
    refresh: 'Actualizar',
    refreshing: 'Actualizando…',
    loading: 'Cargando pagos a contratistas…',
    empty: 'No hay pagos a contratistas con este estado.',
    openJob: 'Abrir trabajo',
    markPending: 'Marcar pendiente',
    markPaid: 'Marcar pagado',
    updateError: 'No se pudo actualizar el pago al contratista.',
    markedPaid: 'Pago al contratista marcado como pagado.',
    markedStatus: 'Pago al contratista marcado como {status}.',
    unnamed: 'Contratista sin nombre',
    jobFallback: 'Trabajo'
  }
};

const vi: DashboardFinanceCopy = {
  ...en,
  ranges: {
    month: 'Tháng này',
    quarter: 'Quý này',
    year: 'Năm nay',
    last_year: 'Năm trước',
    all_time: 'Toàn thời gian'
  },
  metricTitles: {
    collected: 'Đã thu',
    invoiced: 'Đã xuất hóa đơn',
    outstanding: 'Số dư chưa thu',
    late: 'Thanh toán quá hạn',
    'unpaid-invoices': 'Hóa đơn chưa thanh toán',
    'net-cash': 'Tiền mặt sau chi phí',
    'estimated-profit': 'Lợi nhuận dự kiến',
    'contractor-pay': 'Trả thầu phụ',
    'contractor-pay-owed': 'Còn nợ thầu phụ',
    'contractor-pay-pending': 'Thầu phụ đang chờ',
    expenses: 'Chi phí',
    'completed-jobs': 'Công việc hoàn thành',
    jobs: 'Công việc',
    'active-customers': 'Khách hàng đang hoạt động'
  },
  formulas: {
    collected:
      'Đã thu = thanh toán hóa đơn + thanh toán trực tiếp trong kỳ. Cùng một khoản không được tính hai lần.',
    invoiced: 'Đã xuất hóa đơn = tổng hóa đơn không bị hủy được tạo trong kỳ.',
    outstanding:
      'Chưa thu = số dư hóa đơn chưa trả + số tiền dự kiến của việc chưa có hóa đơn trừ thanh toán trực tiếp.',
    late: 'Quá hạn = số dư hóa đơn chưa trả sau ngày đến hạn.',
    'unpaid-invoices': 'Hóa đơn chưa thanh toán = hóa đơn còn số dư.',
    'net-cash':
      'Tiền mặt sau chi phí = tiền khách đã trả trừ tiền thầu phụ đã trả trừ chi phí trong kỳ.',
    'estimated-profit':
      'Lợi nhuận dự kiến = doanh thu đã xuất hóa đơn trừ chi phí thầu phụ trừ chi phí khác trong kỳ.',
    'contractor-pay': 'Trả thầu phụ = tổng chi phí nhân công theo bộ lọc.',
    'contractor-pay-owed': 'Còn nợ = nhân công vẫn đánh dấu chưa trả.',
    'contractor-pay-pending': 'Đang chờ = nhân công đánh dấu đang chờ.',
    expenses: 'Chi phí = các khoản có ngày trong kỳ đã chọn.',
    'completed-jobs':
      'Công việc hoàn thành tính theo ngày hoàn thành hoặc ngày làm việc, không theo ngày tạo bản ghi.',
    jobs: 'Công việc tính theo ngày vận hành trong kỳ đã chọn.',
    'active-customers':
      'Khách hàng đang hoạt động = bản ghi khách hàng ở giai đoạn Active. Lead và đã lưu trữ không được tính.'
  },
  details: {
    titleFallback: 'Chi tiết chỉ số',
    subtitle: 'Xem các bản ghi tạo nên từng tổng trên bảng điều khiển.',
    exactTotal: 'Tổng chính xác',
    empty: 'Không có bản ghi trong kỳ này.',
    tryAgain: 'Thử lại',
    unknownMetric: 'Chỉ số bảng điều khiển không hợp lệ.',
    loadError: 'Không tải được chi tiết chỉ số.',
    loading: 'Đang tải…'
  },
  overview: {
    title: 'Tổng quan kinh doanh',
    subtitle: 'Xem khách đã trả, còn nợ, chi phí và lợi nhuận dự kiến.',
    periodLabel: 'Kỳ bảng điều khiển',
    moneySummaryTitle: 'Tóm tắt tiền',
    loadError: 'Một số tổng tài chính không tải được. Hãy làm mới và thử lại.'
  },
  money: {
    ...en.money,
    collected: 'Đã thu',
    outstanding: 'Số dư chưa thu',
    invoiced: 'Đã xuất hóa đơn',
    netCash: 'Tiền mặt ròng',
    latePayments: 'Thanh toán quá hạn',
    lateInvoices: 'Hóa đơn quá hạn',
    unpaidInvoices: 'Hóa đơn chưa thanh toán',
    averageDays: 'Thời gian trung bình để thu tiền',
    averageDaysNone: 'Chưa có hóa đơn thanh toán đủ',
    contractorPay: 'Trả thầu phụ',
    contractorPayOwed: 'Còn nợ thầu phụ',
    contractorPayPending: 'Thầu phụ đang chờ',
    otherExpenses: 'Chi phí khác',
    expectedProfit: 'Lợi nhuận dự kiến',
    cashAfterCosts: 'Tiền mặt sau chi phí',
    expectedProfitPct: 'Tỷ lệ lợi nhuận dự kiến',
    costsMissing: 'Chỉ gồm chi phí đã ghi nhận.',
    uninvoicedWork: 'Việc hoàn thành chưa xuất hóa đơn',
    paymentsMissingDates: 'Thanh toán thiếu ngày',
    completedJobs: 'Công việc hoàn thành',
    jobs: 'Công việc',
    bookings: 'Đặt lịch',
    messages: 'Tin nhắn',
    reports: 'Báo cáo',
    current: 'Hiện tại',
    days: 'ngày'
  },
  contractorPayPage: {
    title: 'Trả thầu phụ',
    subtitle: 'Xem cần trả cho ai, thuộc công việc nào, và trạng thái chưa trả, đang chờ hay đã trả.',
    permissionDenied: 'Chỉ chủ sở hữu, quản trị và quản lý mới xem được các khoản trả này.',
    stillOwed: 'Còn nợ',
    pending: 'Đang chờ',
    paid: 'Đã trả',
    allPayments: 'Tất cả khoản trả thầu phụ',
    statusPayments: 'Khoản trả thầu phụ {status}',
    changesHint: 'Thay đổi tại đây sẽ tự cập nhật tổng trên bảng điều khiển.',
    showAll: 'Hiện tất cả',
    refresh: 'Làm mới',
    refreshing: 'Đang làm mới…',
    loading: 'Đang tải khoản trả thầu phụ…',
    empty: 'Không có khoản trả thầu phụ khớp trạng thái này.',
    openJob: 'Mở công việc',
    markPending: 'Đánh dấu đang chờ',
    markPaid: 'Đánh dấu đã trả',
    updateError: 'Không cập nhật được khoản trả thầu phụ.',
    markedPaid: 'Đã đánh dấu khoản trả thầu phụ là đã trả.',
    markedStatus: 'Đã đánh dấu khoản trả thầu phụ là {status}.',
    unnamed: 'Thầu phụ chưa đặt tên',
    jobFallback: 'Công việc'
  }
};

const byLocale: Record<Locale, DashboardFinanceCopy> = { en, es, vi };

export function getDashboardFinanceCopy(locale: string | null | undefined): DashboardFinanceCopy {
  return byLocale[normalizeLocale(locale)];
}

export function formatDashboardCopy(
  template: string,
  values?: Record<string, string | number>
): string {
  if (!values) return template;
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template
  );
}
